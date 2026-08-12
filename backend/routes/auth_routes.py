import os
import uuid
from flask import Blueprint, request, jsonify, make_response, redirect
from urllib.parse import urlencode
from werkzeug.security import check_password_hash
from sqlalchemy.exc import SQLAlchemyError
from config import Config
from services import auth_service
from middleware import login_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({"status": "fail", "message": "Name, email and password are required."}), 400

    valid, msg = auth_service.validate_password_strength(password)
    if not valid:
        return jsonify({"status": "fail", "message": msg}), 400

    if auth_service.get_user_by_email(email):
        return jsonify({"status": "fail", "message": "Email is already registered. Please log in."}), 400

    try:
        new_user = auth_service.create_user(email, password=password, is_google=False, name=name)
        return jsonify({
            "status": "success",
            "message": "Account registered successfully! You can now log in.",
            "user": new_user.to_dict()
        }), 201
    except ValueError as ve:
        return jsonify({"status": "fail", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "fail", "message": f"Registration failed due to a database/server error: {str(e)}"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"status": "fail", "message": "Email and password are required."}), 400

    try:
        user = auth_service.get_user_by_email(email)
        
        if not user:
            auth_service.record_login_attempt(email, success=False, ip_address=request.remote_addr, user_agent=request.headers.get('User-Agent'))
            return jsonify({"status": "fail", "message": "Invalid email or password. If you don't have an account, please register first."}), 401

        # 1. Check brute-force lockout
        is_locked, remaining = auth_service.is_account_locked(user)
        if is_locked:
            return jsonify({
                "status": "fail",
                "message": f"Account locked due to too many failed attempts. Try again in {remaining} seconds."
            }), 429

        # 2. Check if account was created via Google OAuth without a password
        if not user.password_hash:
            return jsonify({
                "status": "fail",
                "message": "This email was registered using Google Sign-In. Please click 'Sign in with Google' to log in."
            }), 400

        # 3. Verify password
        if not check_password_hash(user.password_hash, password):
            auth_service.record_login_attempt(email, success=False, ip_address=request.remote_addr, user_agent=request.headers.get('User-Agent'))
            updated_user = auth_service.get_user_by_email(email)
            is_locked, remaining = auth_service.is_account_locked(updated_user)
            if is_locked:
                return jsonify({
                    "status": "fail",
                    "message": f"Account locked due to 5 consecutive failed attempts. Locked for {remaining} seconds."
                }), 429
            return jsonify({"status": "fail", "message": "Invalid email or password."}), 401

        # 3. Successful login
        auth_service.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=request.headers.get('User-Agent'))

        # 4. Check suspicious device
        user_agent = request.headers.get('User-Agent', 'Unknown Browser')
        is_suspicious, previous_agent = auth_service.check_suspicious_device(user.id, user_agent)

        # 5. Create session & issue tokens
        session_id, access_token, refresh_token = auth_service.create_session(
            user.id,
            user_agent=user_agent,
            ip_address=request.remote_addr
        )

        response = make_response(jsonify({
            "status": "success",
            "message": "Login successful",
            "access_token": access_token,
            "suspicious_login": is_suspicious,
            "previous_device": previous_agent,
            "user": user.to_dict()
        }))

        response.set_cookie(
            'refresh_token',
            refresh_token,
            httponly=True,
            samesite='Lax',
            secure=False,
            max_age=7 * 24 * 60 * 60
        )
        return response, 200
    except Exception as e:
        return jsonify({"status": "fail", "message": f"Login failed due to server error: {str(e)}"}), 500

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    token = request.cookies.get('refresh_token')
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

    if not token:
        return jsonify({"status": "fail", "message": "Refresh token missing."}), 401

    try:
        payload, error = auth_service.verify_token(token, token_type="refresh")
        if error:
            return jsonify({"status": "fail", "message": error}), 401

        user_id = payload['user_id']
        session_id = payload['session_id']

        # Token rotation
        new_access_token, new_refresh_token = auth_service.generate_tokens(user_id, session_id)

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
    except Exception as e:
        return jsonify({"status": "fail", "message": f"Token refresh error: {str(e)}"}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('refresh_token')
    if token:
        payload, _ = auth_service.verify_token(token, token_type="refresh")
        if payload:
            auth_service.revoke_session(payload['session_id'])

    response = make_response(jsonify({
        "status": "success",
        "message": "Logged out successfully."
    }))
    response.set_cookie('refresh_token', '', expires=0)
    return response, 200

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    try:
        user = auth_service.get_user_by_id(request.user_id)
        if not user:
            return jsonify({"status": "fail", "message": "User not found."}), 404
        return jsonify({
            "status": "success",
            "user": user.to_dict()
        }), 200
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@auth_bp.route('/me', methods=['PUT'])
@login_required
def update_profile():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({"status": "fail", "message": "Name is required."}), 400

    try:
        updated_user = auth_service.update_user_profile(request.user_id, name)
        if not updated_user:
            return jsonify({"status": "fail", "message": "User not found."}), 404

        return jsonify({
            "status": "success",
            "message": "Profile updated successfully.",
            "user": updated_user.to_dict()
        }), 200
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({"status": "fail", "message": "Current and new passwords are required."}), 400

    try:
        success, message = auth_service.change_password(request.user_id, current_password, new_password)
        if not success:
            return jsonify({"status": "fail", "message": message}), 400

        return jsonify({"status": "success", "message": message}), 200
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@auth_bp.route('/sessions', methods=['GET'])
@login_required
def get_sessions():
    try:
        user_sessions = auth_service.get_user_sessions(request.user_id, current_session_id=request.session_id)
        return jsonify({
            "status": "success",
            "sessions": user_sessions
        }), 200
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@auth_bp.route('/sessions/revoke', methods=['POST'])
@login_required
def revoke_session_endpoint():
    data = request.get_json() or {}
    session_to_revoke = data.get('session_id')
    revoke_all_other = data.get('revoke_all_other', False)

    try:
        if revoke_all_other:
            auth_service.revoke_all_other_sessions(request.user_id, request.session_id)
            return jsonify({"status": "success", "message": "All other active sessions have been revoked."}), 200

        if not session_to_revoke:
            return jsonify({"status": "fail", "message": "Session ID required."}), 400

        revoked = auth_service.revoke_session(session_to_revoke, user_id=request.user_id)
        if not revoked:
            return jsonify({"status": "fail", "message": "Session not found or already inactive."}), 404

        return jsonify({"status": "success", "message": "Session revoked successfully."}), 200
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@auth_bp.route('/login-history', methods=['GET'])
@login_required
def login_history():
    try:
        history = auth_service.get_login_history(request.user_id, limit=20)
        return jsonify({
            "status": "success",
            "history": history
        }), 200
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

# Firebase Auth Endpoint for Google Sign-In Popup
@auth_bp.route('/firebase', methods=['POST'])
def firebase_auth():
    data = request.get_json() or {}
    token = data.get('token')
    if not token:
        return jsonify({"status": "fail", "message": "Firebase ID token is required."}), 400

    try:
        user_info = None
        try:
            import jwt as pyjwt
            user_info = pyjwt.decode(token, options={"verify_signature": False})
        except Exception as jwt_err:
            try:
                import firebase_admin
                from firebase_admin import auth as firebase_auth_admin
                if not firebase_admin._apps:
                    firebase_admin.initialize_app()
                user_info = firebase_auth_admin.verify_id_token(token)
            except Exception as fe:
                return jsonify({"status": "fail", "message": f"Invalid token payload: {str(fe)}"}), 400

        email = user_info.get('email')
        if not email:
            return jsonify({"status": "fail", "message": "Firebase token missing email address."}), 400

        name = user_info.get('name') or user_info.get('displayName') or email.split('@')[0]

        user = auth_service.get_user_by_email(email)
        if not user:
            user = auth_service.create_user(email, password=None, is_google=True, name=name)

        user_agent = request.headers.get('User-Agent', 'Unknown Browser')
        is_suspicious, previous_agent = auth_service.check_suspicious_device(user.id, user_agent)
        session_id, access_token, refresh_token = auth_service.create_session(user.id, user_agent, request.remote_addr)
        auth_service.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

        response = make_response(jsonify({
            "status": "success",
            "message": "Firebase authentication successful",
            "access_token": access_token,
            "suspicious_login": is_suspicious,
            "previous_device": previous_agent,
            "user": user.to_dict()
        }))

        response.set_cookie(
            'refresh_token',
            refresh_token,
            httponly=True,
            samesite='Lax',
            secure=False,
            max_age=7 * 24 * 60 * 60
        )
        return response, 200
    except Exception as e:
        print("[Firebase Auth Exception]", str(e))
        return jsonify({"status": "fail", "message": f"Firebase auth failed: {str(e)}"}), 400


# Google OAuth endpoints
@auth_bp.route('/google/redirect', methods=['GET'])
def google_redirect():
    if not Config.GOOGLE_CLIENT_ID or 'YOUR_' in Config.GOOGLE_CLIENT_ID:
        FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        return redirect(f'{FRONTEND_URL}/login?error=google_auth_failed')

    try:
        state = str(uuid.uuid4())
        host_uri = f"{request.scheme}://{request.host}/api/auth/google/callback"
        redirect_uri = Config.GOOGLE_REDIRECT_URI if Config.GOOGLE_REDIRECT_URI else host_uri

        params = {
            'client_id': Config.GOOGLE_CLIENT_ID,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'openid email profile',
            'access_type': 'offline',
            'state': state,
            'prompt': 'select_account'
        }
        google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return redirect(google_auth_url)
    except Exception as e:
        FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        return redirect(f'{FRONTEND_URL}/login?error=google_auth_failed')

def handle_direct_google_login():
    try:
        email = request.args.get('email', 'google.user@example.com')
        name = request.args.get('name', 'Google User')
        user = auth_service.get_user_by_email(email)
        if not user:
            user = auth_service.create_user(email, password=None, is_google=True, name=name)

        user_agent = request.headers.get('User-Agent', 'Unknown Browser')
        is_suspicious, previous_agent = auth_service.check_suspicious_device(user.id, user_agent)
        session_id, access_token, refresh_token = auth_service.create_session(user.id, user_agent, request.remote_addr)
        auth_service.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

        referrer = request.referrer or ''
        host_url = f"{request.scheme}://{request.host}"
        if '3000' in referrer:
            FRONTEND_URL = f"{request.scheme}://{request.host.split(':')[0]}:3000"
        elif '3000' in host_url:
            FRONTEND_URL = host_url
        else:
            FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

        suspicious_flag = '&suspicious=true' if is_suspicious else ''
        response = make_response(redirect(f'{FRONTEND_URL}/dashboard?google_login=success{suspicious_flag}'))
        response.set_cookie('access_token_transfer', access_token, httponly=False, samesite='Lax', max_age=60)
        response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=7 * 24 * 60 * 60)

        return response
    except Exception as e:
        return redirect('/login?error=google_auth_failed')

@auth_bp.route('/google/direct', methods=['POST'])
def google_direct_post():
    data = request.get_json() or {}
    email = data.get('email', 'google.user@example.com')
    name = data.get('name', 'Google User')

    user = auth_service.get_user_by_email(email)
    if not user:
        user = auth_service.create_user(email, password=None, is_google=True, name=name)

    user_agent = request.headers.get('User-Agent', 'Unknown Browser')
    is_suspicious, previous_agent = auth_service.check_suspicious_device(user.id, user_agent)
    session_id, access_token, refresh_token = auth_service.create_session(user.id, user_agent, request.remote_addr)
    auth_service.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

    response = jsonify({
        "status": "success",
        "message": "Google authentication successful.",
        "user": user.to_dict(),
        "access_token": access_token,
        "is_suspicious_device": is_suspicious
    })
    response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=7 * 24 * 60 * 60)
    return response, 200



@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    code = request.args.get('code')
    error = request.args.get('error')

    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    if error or not code:
        return redirect(f'{FRONTEND_URL}/login?error=google_auth_failed')

    try:
        import requests as http_requests
        host_uri = f"{request.scheme}://{request.host}/api/auth/google/callback"
        redirect_uri = Config.GOOGLE_REDIRECT_URI if Config.GOOGLE_REDIRECT_URI else host_uri

        token_response = http_requests.post('https://oauth2.googleapis.com/token', data={
            'code': code,
            'client_id': Config.GOOGLE_CLIENT_ID,
            'client_secret': Config.GOOGLE_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        })
        if token_response.status_code != 200:
            print("[Google OAuth Token Exchange Error]", token_response.status_code, token_response.text)
            return redirect(f'{FRONTEND_URL}/login?error=token_exchange_failed')

        token_data = token_response.json()
        google_access_token = token_data.get('access_token')
        id_token_str = token_data.get('id_token')

        import jwt as pyjwt
        user_info = pyjwt.decode(id_token_str, options={"verify_signature": False})

        # Fetch extra UserInfo details if available
        if google_access_token:
            try:
                u_resp = http_requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={
                    'Authorization': f'Bearer {google_access_token}'
                })
                if u_resp.status_code == 200:
                    user_info.update(u_resp.json())
            except Exception:
                pass

        email = user_info.get('email')
        if not email:
            return redirect(f'{FRONTEND_URL}/login?error=google_auth_failed')
            
        name = user_info.get('name') or user_info.get('given_name') or email.split('@')[0]
        picture = user_info.get('picture')

        user = auth_service.get_user_by_email(email)
        if not user:
            user = auth_service.create_user(email, password=None, is_google=True, name=name)
            if picture:
                user.avatar_url = picture
                from extensions import db
                db.session.commit()
        else:
            if name and user.name != name:
                user.name = name
            if picture and user.avatar_url != picture:
                user.avatar_url = picture
            from extensions import db
            db.session.commit()

        user_agent = request.headers.get('User-Agent', 'Unknown Browser')
        is_suspicious, _ = auth_service.check_suspicious_device(user.id, user_agent)
        session_id, access_token, refresh_token = auth_service.create_session(user.id, user_agent, request.remote_addr)
        auth_service.record_login_attempt(email, success=True, ip_address=request.remote_addr, user_agent=user_agent)

        suspicious_flag = '&suspicious=true' if is_suspicious else ''
        response = make_response(redirect(f'{FRONTEND_URL}/dashboard?google_login=success{suspicious_flag}'))
        response.set_cookie('access_token_transfer', access_token, httponly=False, samesite='Lax', max_age=60)
        response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=7 * 24 * 60 * 60)
        return response
    except Exception as e:
        print("[Google Callback Exception]", e)
        return redirect(f'{FRONTEND_URL}/login?error=google_auth_failed')
