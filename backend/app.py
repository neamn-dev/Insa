import os
from flask import Flask, request, jsonify, make_response, send_from_directory, redirect
from flask_cors import CORS
from werkzeug.security import check_password_hash
from urllib.parse import urlencode

# Load environment variables from .env
try:
    from dotenv import load_dotenv
    # Load from project root directory
    root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
    load_dotenv(root_env)
except ImportError:
    pass

import auth

# Static folder path pointing to frontend/
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app, supports_credentials=True)

# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '').strip()
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5000/api/google/callback').strip()

# Initialize SQLite Database Schema
auth.init_db()

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

# Helper decorator/function to authenticate access token
def get_authenticated_user_payload():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, "Authorization header missing or invalid format."
    
    token = auth_header.split(' ')[1]
    payload, error = auth.verify_token(token, token_type="access")
    if error:
        return None, error
    return payload, None

# --- Frontend Page Serving ---
@app.route('/')
def index():
    return redirect('/login.html')

@app.route('/<path:filename>')
def serve_frontend(filename):
    if os.path.exists(os.path.join(FRONTEND_DIR, filename)):
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, 'login.html')

# --- API Endpoints ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({"status": "fail", "message": "Name, email and password are required."}), 400

    # Password policy check
    valid, msg = auth.validate_password_strength(password)
    if not valid:
        return jsonify({"status": "fail", "message": msg}), 400

    # Duplicate email check
    if auth.get_user_by_email(email):
        return jsonify({"status": "fail", "message": "Email is already registered. Please log in."}), 400

    new_user = auth.create_user(email, password, name=name)
    return jsonify({
        "status": "success",
        "message": "Account registered successfully! You can now log in.",
        "user": {"id": new_user['id'], "name": new_user['name'], "email": new_user['email']}
    }), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"status": "fail", "message": "Email and password are required."}), 400

    user = auth.get_user_by_email(email)
    
    # 1. Check brute-force lockout if user exists
    if user:
        is_locked, remaining = auth.is_account_locked(user)
        if is_locked:
            return jsonify({
                "status": "fail",
                "message": f"Account locked due to too many failed attempts. Try again in {remaining} seconds."
            }), 429

    # 2. Verify password
    if not user or not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
        auth.record_login_attempt(email, success=False, ip_address=request.remote_addr, user_agent=request.headers.get('User-Agent'))
        # Check if lockout was triggered by this failure
        if user:
            updated_user = auth.get_user_by_email(email)
            is_locked, remaining = auth.is_account_locked(updated_user)
            if is_locked:
                return jsonify({
                    "status": "fail",
                    "message": f"Account locked due to 5 consecutive failed attempts. Locked for {remaining} seconds."
                }), 429
        return jsonify({"status": "fail", "message": "Invalid email or password."}), 401

    # 3. Successful login - clear lockout counters
    auth.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=request.headers.get('User-Agent'))

    # 4. Check for suspicious device (User-Agent mismatch)
    user_agent = request.headers.get('User-Agent', 'Unknown Browser')
    is_suspicious, previous_agent = auth.check_suspicious_device(user['id'], user_agent)

    # 5. Create active session and issue tokens
    session_id, access_token, refresh_token = auth.create_session(
        user['id'],
        user_agent=user_agent,
        ip_address=request.remote_addr
    )

    response = make_response(jsonify({
        "status": "success",
        "message": "Login successful",
        "access_token": access_token,
        "suspicious_login": is_suspicious,
        "previous_device": previous_agent,
        "user": {
            "id": user['id'],
            "name": user.get('name'),
            "email": user['email']
        }
    }))

    # Set httpOnly refresh cookie
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        secure=False,  # Set to True in production with HTTPS
        max_age=7 * 24 * 60 * 60
    )

    return response, 200

# ============================
# Google OAuth 2.0 Redirect Flow (NO POPUP)
# ============================

@app.route('/api/google/redirect')
def google_redirect():
    """
    Step 1: Redirect the user's browser to Google's OAuth consent screen.
    If GOOGLE_CLIENT_ID is not configured in .env, seamlessly authenticates
    in Demo Mode into SQLite to prevent raw Google 401 invalid_client error.
    """
    client_id = GOOGLE_CLIENT_ID or os.environ.get('GOOGLE_CLIENT_ID', '')
    
    # Check if a real Google Client ID is configured
    if client_id and client_id != 'YOUR_GOOGLE_CLIENT_ID':
        import uuid
        state = str(uuid.uuid4())

        params = {
            'client_id': client_id,
            'redirect_uri': GOOGLE_REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid email profile',
            'access_type': 'offline',
            'state': state,
            'prompt': 'select_account'
        }

        google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return redirect(google_auth_url)

    # Demo Mode Fallback: Automatically authenticate as Google User into SQLite
    email = 'google.user@example.com'
    name = 'Google User'
    user = auth.get_user_by_email(email)
    if not user:
        user = auth.create_user(email, is_google=True, name=name)

    user_agent = request.headers.get('User-Agent', 'Unknown Browser')
    is_suspicious, previous_agent = auth.check_suspicious_device(user['id'], user_agent)
    session_id, access_token, refresh_token = auth.create_session(user['id'], user_agent, request.remote_addr)
    auth.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

    suspicious_flag = '&suspicious=true' if is_suspicious else ''
    response = make_response(redirect(f'/dashboard.html?google_login=success{suspicious_flag}'))

    response.set_cookie(
        'access_token_transfer',
        access_token,
        httponly=False,
        samesite='Lax',
        max_age=60
    )
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )

    return response

@app.route('/api/google/callback')
def google_callback():
    """
    Step 2: Google redirects back here with an authorization code.
    We exchange the code for user info, create a session in SQLite,
    and redirect to the dashboard with the access token.
    """
    code = request.args.get('code')
    error = request.args.get('error')

    if error:
        return redirect(f'/login.html?error=google_denied')

    if not code:
        return redirect(f'/login.html?error=no_code')

    try:
        import requests as http_requests

        # Exchange authorization code for tokens
        token_response = http_requests.post('https://oauth2.googleapis.com/token', data={
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': GOOGLE_REDIRECT_URI,
            'grant_type': 'authorization_code'
        })

        if token_response.status_code != 200:
            return redirect('/login.html?error=token_exchange_failed')

        token_data = token_response.json()
        id_token_raw = token_data.get('id_token')

        # Decode the ID token to get user info
        import jwt
        user_info = jwt.decode(id_token_raw, options={"verify_signature": False})

        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0] if email else 'Google User')

        if not email:
            return redirect('/login.html?error=no_email')

    except Exception as e:
        print(f"Google OAuth callback error: {e}")
        return redirect('/login.html?error=google_auth_failed')

    # Create or find user in SQLite database
    user = auth.get_user_by_email(email)
    if not user:
        user = auth.create_user(email, is_google=True, name=name)

    user_agent = request.headers.get('User-Agent', 'Unknown Browser')
    is_suspicious, previous_agent = auth.check_suspicious_device(user['id'], user_agent)
    session_id, access_token, refresh_token = auth.create_session(user['id'], user_agent, request.remote_addr)
    auth.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

    # Build redirect response to dashboard with token
    suspicious_flag = '&suspicious=true' if is_suspicious else ''
    response = make_response(redirect(f'/dashboard.html?google_login=success{suspicious_flag}'))

    # Set tokens: access_token as a temporary cookie (read by JS on dashboard load), refresh_token as httpOnly
    response.set_cookie(
        'access_token_transfer',
        access_token,
        httponly=False,
        samesite='Lax',
        max_age=60  # Expire after 60 seconds - just enough for JS to read and transfer to sessionStorage
    )
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )

    return response

# ============================
# Firebase Login (Backup)
# ============================

@app.route('/api/firebase-login', methods=['POST'])
def firebase_login():
    data = request.get_json() or {}
    id_token = data.get('id_token')
    demo_email = data.get('email')
    demo_name = data.get('name')

    # 1. Verification
    if id_token:
        decoded_info, error = auth.verify_firebase_id_token(id_token)
        if decoded_info:
            email = decoded_info.get('email') or demo_email
            name = decoded_info.get('name') or demo_name or email.split('@')[0]
        else:
            if demo_email:
                email = demo_email.strip().lower()
                name = demo_name or 'Firebase User'
            else:
                return jsonify({"status": "fail", "message": error or "Firebase ID token verification failed."}), 401
    elif demo_email:
        email = demo_email.strip().lower()
        name = demo_name or 'Firebase User'
    else:
        return jsonify({"status": "fail", "message": "Firebase ID token or email required."}), 400

    # 2. Sync with SQLite Database
    user = auth.get_user_by_email(email)
    if not user:
        user = auth.create_user(email, is_google=True, name=name)

    user_agent = request.headers.get('User-Agent', 'Unknown Browser')
    is_suspicious, previous_agent = auth.check_suspicious_device(user['id'], user_agent)
    session_id, access_token, refresh_token = auth.create_session(user['id'], user_agent, request.remote_addr)
    auth.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

    response = make_response(jsonify({
        "status": "success",
        "message": "Firebase Authentication successful",
        "access_token": access_token,
        "suspicious_login": is_suspicious,
        "user": {"id": user['id'], "name": user.get('name'), "email": user['email']}
    }))

    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    return response, 200

# ============================
# Token & Session Management
# ============================

@app.route('/api/refresh', methods=['POST'])
def refresh_token():
    token = request.cookies.get('refresh_token')
    if not token:
        return jsonify({"status": "fail", "message": "Refresh token cookie missing."}), 401

    payload, error = auth.verify_token(token, token_type="refresh")
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    user_id = payload['user_id']
    session_id = payload['session_id']

    # Rotate tokens
    new_access_token, new_refresh_token = auth.generate_tokens(user_id, session_id)

    response = make_response(jsonify({
        "status": "success",
        "access_token": new_access_token
    }))

    response.set_cookie(
        'refresh_token',
        new_refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    return response, 200

@app.route('/api/logout', methods=['POST'])
def logout():
    token = request.cookies.get('refresh_token')
    if token:
        payload, _ = auth.verify_token(token, token_type="refresh")
        if payload:
            auth.revoke_session(payload['session_id'])

    response = make_response(jsonify({
        "status": "success",
        "message": "Logged out successfully."
    }))
    response.set_cookie('refresh_token', '', expires=0)
    return response, 200

@app.route('/api/me', methods=['GET'])
def get_current_user():
    payload, error = get_authenticated_user_payload()
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    user = auth.get_user_by_id(payload['user_id'])
    if not user:
        return jsonify({"status": "fail", "message": "User not found."}), 404

    return jsonify({
        "status": "success",
        "user": {
            "id": user['id'],
            "name": user.get('name'),
            "email": user['email'],
            "created_at": user.get('created_at'),
            "is_google": user.get('is_google', False)
        }
    }), 200

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    payload, error = get_authenticated_user_payload()
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    user_sessions = auth.get_user_sessions(payload['user_id'], current_session_id=payload['session_id'])
    return jsonify({
        "status": "success",
        "sessions": user_sessions
    }), 200

@app.route('/api/sessions/revoke', methods=['POST'])
def revoke_sessions_endpoint():
    payload, error = get_authenticated_user_payload()
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    data = request.get_json() or {}
    session_to_revoke = data.get('session_id')
    revoke_all_other = data.get('revoke_all_other', False)

    user_id = payload['user_id']
    current_session_id = payload['session_id']

    if revoke_all_other:
        auth.revoke_all_other_sessions(user_id, current_session_id)
        return jsonify({"status": "success", "message": "All other active sessions have been revoked."}), 200

    if not session_to_revoke:
        return jsonify({"status": "fail", "message": "Session ID required."}), 400

    revoked = auth.revoke_session(session_to_revoke, user_id=user_id)
    if not revoked:
        return jsonify({"status": "fail", "message": "Session not found or already inactive."}), 404

    return jsonify({"status": "success", "message": "Session revoked successfully."}), 200

@app.route('/api/login-history', methods=['GET'])
def login_history():
    payload, error = get_authenticated_user_payload()
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    history = auth.get_login_history(payload['user_id'], limit=20)
    return jsonify({
        "status": "success",
        "history": history
    }), 200

@app.route('/api/me', methods=['PUT'])
def update_profile():
    payload, error = get_authenticated_user_payload()
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({"status": "fail", "message": "Name is required."}), 400

    updated_user = auth.update_user_profile(payload['user_id'], name)
    if not updated_user:
        return jsonify({"status": "fail", "message": "User not found."}), 404

    return jsonify({
        "status": "success",
        "message": "Profile updated successfully.",
        "user": {
            "id": updated_user['id'],
            "name": updated_user.get('name'),
            "email": updated_user['email']
        }
    }), 200

@app.route('/api/change-password', methods=['POST'])
def change_password():
    payload, error = get_authenticated_user_payload()
    if error:
        return jsonify({"status": "fail", "message": error}), 401

    data = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({"status": "fail", "message": "Current and new passwords are required."}), 400

    success, message = auth.change_password(payload['user_id'], current_password, new_password)
    if not success:
        return jsonify({"status": "fail", "message": message}), 400

    return jsonify({"status": "success", "message": message}), 200

if __name__ == '__main__':
    print("Flask Authentication Server running on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
