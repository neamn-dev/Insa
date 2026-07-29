import os
import sqlite3
import time
import re
import uuid
from datetime import datetime, timedelta, timezone
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

SECRET_KEY = "demo-flask-auth-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRES_MINUTES = 5
REFRESH_TOKEN_EXPIRES_DAYS = 7
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_TIME_SECONDS = 300  # 5 minutes lockout

# Database path configuration: supports backend/database/neamndb.db and root database/neamndb.db
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ROOT_DB_PATH = os.path.join(ROOT_DIR, 'database', 'neamndb.db')
BACKEND_DB_DIR = os.path.join(os.path.dirname(__file__), 'database')
BACKEND_DB_PATH = os.path.join(BACKEND_DB_DIR, 'neamndb.db')

def get_db_path():
    if os.path.exists(ROOT_DB_PATH):
        return ROOT_DB_PATH
    os.makedirs(BACKEND_DB_DIR, exist_ok=True)
    return BACKEND_DB_PATH

def get_db_connection():
    """Returns a connection to the SQLite database (neamndb.db) with dict-like row access."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQLite database tables for users and sessions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            password_hash TEXT,
            is_google INTEGER DEFAULT 0,
            failed_attempts INTEGER DEFAULT 0,
            lockout_until INTEGER DEFAULT 0,
            last_user_agent TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    # Sessions Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_agent TEXT,
            ip_address TEXT,
            created_at TEXT NOT NULL,
            last_active TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Login Attempts Audit Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS login_attempts (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            email_attempted TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            success INTEGER DEFAULT 0,
            risk_flags TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    conn.commit()
    conn.close()

# Auto-initialize database schema on import
init_db()

# --- Password Validation ---
def validate_password_strength(password):
    """
    Validates password strength:
    - Minimum 8 characters
    - At least 1 letter (a-z or A-Z)
    - At least 1 number (0-9)
    """
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r'[a-zA-Z]', password):
        return False, "Password must contain at least one letter."
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number."
    return True, None

# --- User Management ---
def get_user_by_email(email):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email.strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(email, password=None, is_google=False, name=None):
    user_id = str(uuid.uuid4())
    password_hash = generate_password_hash(password) if password else None
    email_clean = email.strip().lower()
    created_at = datetime.now().isoformat()
    is_google_int = 1 if is_google else 0

    conn = get_db_connection()
    conn.execute('''
        INSERT INTO users (id, email, name, password_hash, is_google, failed_attempts, lockout_until, last_user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)
    ''', (user_id, email_clean, name, password_hash, is_google_int, created_at))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row)

def is_account_locked(user):
    """Check if user account is currently locked out."""
    lockout_until = user.get('lockout_until', 0) or 0
    now = time.time()
    if lockout_until > now:
        remaining = int(lockout_until - now)
        return True, remaining
    return False, 0

def record_login_attempt(email, success=False, ip_address=None, user_agent=None):
    """Tracks failed login attempts and applies progressive lockout after 5 tries.
    Also inserts an audit record into the login_attempts table."""
    conn = get_db_connection()
    email_clean = email.strip().lower()
    row = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email_clean,)).fetchone()

    user_id = row['id'] if row else None

    # Insert audit record into login_attempts table
    attempt_id = str(uuid.uuid4())
    now_str = datetime.now().isoformat()
    risk_flags = '{}'
    if not success and row:
        current_fails = (row['failed_attempts'] or 0) + 1
        if current_fails >= MAX_FAILED_ATTEMPTS:
            risk_flags = '{"lockout_triggered": true}'
    conn.execute('''
        INSERT INTO login_attempts (id, user_id, email_attempted, ip_address, user_agent, success, risk_flags, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (attempt_id, user_id, email_clean, ip_address or '0.0.0.0', user_agent or 'Unknown', 1 if success else 0, risk_flags, now_str))

    if not row:
        conn.commit()
        conn.close()
        return None

    if success:
        conn.execute("UPDATE users SET failed_attempts = 0, lockout_until = 0 WHERE id = ?", (row['id'],))
    else:
        new_failed = (row['failed_attempts'] or 0) + 1
        lockout_until = 0
        if new_failed >= MAX_FAILED_ATTEMPTS:
            lockout_until = int(time.time() + LOCKOUT_TIME_SECONDS)
        conn.execute("UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE id = ?", (new_failed, lockout_until, row['id']))
    
    conn.commit()
    updated = conn.execute("SELECT * FROM users WHERE id = ?", (row['id'],)).fetchone()
    conn.close()
    return dict(updated)

def check_suspicious_device(user_id, incoming_user_agent):
    """
    Detect suspicious login by comparing current User-Agent with previous.
    Returns (is_suspicious, previous_agent)
    """
    conn = get_db_connection()
    row = conn.execute("SELECT last_user_agent FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return False, None

    last_agent = row['last_user_agent']
    is_suspicious = (last_agent is not None and last_agent != incoming_user_agent)
    conn.execute("UPDATE users SET last_user_agent = ? WHERE id = ?", (incoming_user_agent, user_id))
    conn.commit()
    conn.close()
    return is_suspicious, last_agent

# --- Session & Token Operations ---
def generate_tokens(user_id, session_id):
    now = datetime.now(timezone.utc)
    
    access_payload = {
        "user_id": user_id,
        "session_id": session_id,
        "type": "access",
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRES_MINUTES),
        "iat": now
    }
    refresh_payload = {
        "user_id": user_id,
        "session_id": session_id,
        "type": "refresh",
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRES_DAYS),
        "iat": now
    }
    
    access_token = jwt.encode(access_payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    return access_token, refresh_token

def create_session(user_id, user_agent, ip_address):
    session_id = str(uuid.uuid4())
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    agent = user_agent or "Unknown Device"
    ip = ip_address or "127.0.0.1"

    conn = get_db_connection()
    conn.execute('''
        INSERT INTO sessions (id, user_id, user_agent, ip_address, created_at, last_active, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ''', (session_id, user_id, agent, ip, now_str, now_str))
    conn.commit()
    conn.close()

    access_token, refresh_token = generate_tokens(user_id, session_id)
    return session_id, access_token, refresh_token

def verify_token(token, token_type="access"):
    """Verifies JWT token and checks if the session is still active in SQLite sessions table.
    Also updates session last_active timestamp for access tokens."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            return None, "Invalid token type."
        
        session_id = payload.get("session_id")
        conn = get_db_connection()
        row = conn.execute("SELECT is_active FROM sessions WHERE id = ?", (session_id,)).fetchone()
        
        if not row or not row['is_active']:
            conn.close()
            return None, "Session has been revoked or logged out."
        
        # Update last_active timestamp on every successful access token verification
        if token_type == "access":
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn.execute("UPDATE sessions SET last_active = ? WHERE id = ?", (now_str, session_id))
            conn.commit()
        
        conn.close()
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired."
    except jwt.InvalidTokenError:
        return None, "Invalid token."

def get_user_sessions(user_id, current_session_id=None):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM sessions WHERE user_id = ? AND is_active = 1", (user_id,)).fetchall()
    conn.close()

    user_sessions = []
    for r in rows:
        s_copy = dict(r)
        s_copy['is_current'] = (s_copy['id'] == current_session_id)
        s_copy['is_active'] = bool(s_copy['is_active'])
        user_sessions.append(s_copy)
    return user_sessions

def revoke_session(session_id, user_id=None):
    conn = get_db_connection()
    if user_id:
        cursor = conn.execute("UPDATE sessions SET is_active = 0 WHERE id = ? AND user_id = ?", (session_id, user_id))
    else:
        cursor = conn.execute("UPDATE sessions SET is_active = 0 WHERE id = ?", (session_id,))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

def revoke_all_other_sessions(user_id, current_session_id):
    conn = get_db_connection()
    cursor = conn.execute("UPDATE sessions SET is_active = 0 WHERE user_id = ? AND id != ?", (user_id, current_session_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

# --- Login History ---
def get_login_history(user_id, limit=20):
    """Returns recent login attempts for a user, ordered newest first."""
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT id, email_attempted, ip_address, user_agent, success, risk_flags, created_at
        FROM login_attempts
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    ''', (user_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Profile Management ---
def update_user_profile(user_id, name):
    """Updates user profile name."""
    conn = get_db_connection()
    conn.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip(), user_id))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def change_password(user_id, current_password, new_password):
    """Changes user password after verifying the current one.
    Returns (success, message) tuple."""
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    
    if not row:
        return False, "User not found."
    
    user = dict(row)
    
    # Google-only users can't change password via this flow
    if user.get('is_google') and not user.get('password_hash'):
        return False, "Google accounts cannot change password here."
    
    # Verify current password
    if not user.get('password_hash') or not check_password_hash(user['password_hash'], current_password):
        return False, "Current password is incorrect."
    
    # Validate new password strength
    valid, msg = validate_password_strength(new_password)
    if not valid:
        return False, msg
    
    # Update password
    new_hash = generate_password_hash(new_password)
    conn = get_db_connection()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()
    
    return True, "Password changed successfully."

# --- Firebase Authentication Helper ---
def verify_firebase_id_token(id_token):
    """
    Verifies a Firebase ID token using firebase_admin SDK.
    Falls back to verify_google_id_token if firebase_admin app is not credentialed.
    Returns (id_info, error) tuple.
    """
    if not id_token:
        return None, "ID token required."

    try:
        import firebase_admin
        from firebase_admin import auth as fb_auth, credentials

        # Initialize firebase_admin if not already initialized
        if not firebase_admin._apps:
            service_account_path = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
            if os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
            else:
                firebase_admin.initialize_app()

        decoded_token = fb_auth.verify_id_token(id_token)
        return decoded_token, None
    except Exception as e:
        print("Firebase Admin verification fallback:", e)
        # Fallback to Google ID Token verification
        google_info = verify_google_id_token(id_token)
        if google_info:
            return google_info, None
        return None, f"Firebase token verification failed: {str(e)}"

# --- Google OAuth Verification Helper ---
def verify_google_id_token(id_token):
    """Verifies a Google ID token."""
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        
        id_info = google_id_token.verify_oauth2_token(id_token, google_requests.Request())
        return id_info
    except Exception as e:
        print("Google token verification error:", e)
        return None
