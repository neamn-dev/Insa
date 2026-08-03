import os
import time
import re
import uuid
from datetime import datetime, timedelta, timezone
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from extensions import db
from config import Config
from models import User, Session, LoginAttempt

def validate_password_strength(password):
    """
    Validates password strength according to Challenge 2 policy:
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

def get_user_by_email(email):
    if not email:
        return None
    try:
        return User.query.filter(db.func.lower(User.email) == email.strip().lower()).first()
    except SQLAlchemyError as e:
        db.session.rollback()
        if "does not exist" in str(e).lower() or "undefinedtable" in str(e).lower():
            try:
                db.create_all()
                return User.query.filter(db.func.lower(User.email) == email.strip().lower()).first()
            except Exception:
                pass
        raise

def get_user_by_id(user_id):
    if not user_id:
        return None
    try:
        return db.session.get(User, user_id)
    except SQLAlchemyError as e:
        db.session.rollback()
        if "does not exist" in str(e).lower() or "undefinedtable" in str(e).lower():
            try:
                db.create_all()
                return db.session.get(User, user_id)
            except Exception:
                pass
        raise

def create_user(email, password=None, is_google=False, name=None):
    email_clean = email.strip().lower()
    password_hash = generate_password_hash(password) if password else None
    
    user = User(
        email=email_clean,
        name=name or email_clean.split('@')[0],
        password_hash=password_hash,
        is_google=is_google
    )
    try:
        db.session.add(user)
        db.session.commit()
        return user
    except IntegrityError:
        db.session.rollback()
        raise ValueError("Email is already registered. Please log in.")
    except SQLAlchemyError as e:
        db.session.rollback()
        if "does not exist" in str(e).lower() or "undefinedtable" in str(e).lower():
            try:
                db.create_all()
                db.session.add(user)
                db.session.commit()
                return user
            except Exception:
                pass
        raise Exception(f"Database error during user creation: {str(e)}")


def is_account_locked(user):
    """Check if user account is locked due to brute-force protection."""
    if not user:
        return False, 0
    lockout_until = user.lockout_until or 0
    now = int(time.time())
    if lockout_until > now:
        remaining = lockout_until - now
        return True, remaining
    return False, 0

def record_login_attempt(email, success=False, ip_address=None, user_agent=None):
    """
    Tracks failed login attempts and applies progressive lockout after 5 consecutive tries.
    Audits every attempt in the login_attempts table.
    """
    email_clean = email.strip().lower() if email else ""
    try:
        user = get_user_by_email(email_clean)
        user_id = user.id if user else None

        risk_flags = '{}'
        if not success and user:
            current_fails = (user.failed_attempts or 0) + 1
            if current_fails >= Config.MAX_FAILED_ATTEMPTS:
                risk_flags = '{"lockout_triggered": true}'

        attempt = LoginAttempt(
            user_id=user_id,
            email_attempted=email_clean,
            ip_address=ip_address or '127.0.0.1',
            user_agent=user_agent or 'Unknown Browser',
            success=success,
            risk_flags=risk_flags
        )
        db.session.add(attempt)

        if user:
            if success:
                user.failed_attempts = 0
                user.lockout_until = 0
            else:
                user.failed_attempts = (user.failed_attempts or 0) + 1
                if user.failed_attempts >= Config.MAX_FAILED_ATTEMPTS:
                    user.lockout_until = int(time.time() + Config.LOCKOUT_TIME_SECONDS)

        db.session.commit()
        return user
    except SQLAlchemyError:
        db.session.rollback()
        return None

def check_suspicious_device(user_id, incoming_user_agent):
    """
    Detect suspicious login by comparing current User-Agent with last known User-Agent.
    Returns (is_suspicious, previous_agent)
    """
    try:
        user = get_user_by_id(user_id)
        if not user:
            return False, None

        last_agent = user.last_user_agent
        is_suspicious = (last_agent is not None and last_agent != incoming_user_agent)
        user.last_user_agent = incoming_user_agent
        db.session.commit()
        return is_suspicious, last_agent
    except SQLAlchemyError:
        db.session.rollback()
        return False, None

def generate_tokens(user_id, session_id):
    now = datetime.now(timezone.utc)
    
    access_payload = {
        "user_id": user_id,
        "session_id": session_id,
        "type": "access",
        "exp": now + timedelta(minutes=Config.ACCESS_TOKEN_EXPIRES_MINUTES),
        "iat": now
    }
    refresh_payload = {
        "user_id": user_id,
        "session_id": session_id,
        "type": "refresh",
        "exp": now + timedelta(days=Config.REFRESH_TOKEN_EXPIRES_DAYS),
        "iat": now
    }
    
    access_token = jwt.encode(access_payload, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)
    refresh_token = jwt.encode(refresh_payload, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)
    
    return access_token, refresh_token

def create_session(user_id, user_agent, ip_address):
    try:
        session = Session(
            user_id=user_id,
            user_agent=user_agent or "Unknown Device",
            ip_address=ip_address or "127.0.0.1",
            created_at=datetime.now(timezone.utc),
            last_active=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=Config.REFRESH_TOKEN_EXPIRES_DAYS),
            is_active=True
        )
        db.session.add(session)
        db.session.commit()

        access_token, refresh_token = generate_tokens(user_id, session.id)
        session.refresh_token_hash = generate_password_hash(refresh_token)
        db.session.commit()

        return session.id, access_token, refresh_token
    except SQLAlchemyError as e:
        db.session.rollback()
        if "does not exist" in str(e).lower() or "undefinedtable" in str(e).lower():
            try:
                db.create_all()
                session = Session(
                    user_id=user_id,
                    user_agent=user_agent or "Unknown Device",
                    ip_address=ip_address or "127.0.0.1",
                    created_at=datetime.now(timezone.utc),
                    last_active=datetime.now(timezone.utc),
                    expires_at=datetime.now(timezone.utc) + timedelta(days=Config.REFRESH_TOKEN_EXPIRES_DAYS),
                    is_active=True
                )
                db.session.add(session)
                db.session.commit()
                access_token, refresh_token = generate_tokens(user_id, session.id)
                session.refresh_token_hash = generate_password_hash(refresh_token)
                db.session.commit()
                return session.id, access_token, refresh_token
            except Exception:
                pass
        raise Exception(f"Failed to create user session: {str(e)}")


def verify_token(token, token_type="access"):
    """
    Verifies JWT token and checks if the underlying session is active in PostgreSQL.
    Updates last_active on successful access token validation.
    """
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
        if payload.get("type") != token_type:
            return None, "Invalid token type."
        
        session_id = payload.get("session_id")
        session = db.session.get(Session, session_id)
        
        if not session or not session.is_active:
            return None, "Session has been revoked or logged out."
        
        now = datetime.now(timezone.utc)
        expires_at = session.expires_at
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < now:
                session.is_active = False
                db.session.commit()
                return None, "Session has expired."

        if token_type == "access":
            session.last_active = now
            db.session.commit()
        
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired."
    except jwt.InvalidTokenError:
        return None, "Invalid token."
    except SQLAlchemyError:
        db.session.rollback()
        return None, "Database error during token verification."

def get_user_sessions(user_id, current_session_id=None):
    try:
        sessions = Session.query.filter_by(user_id=user_id, is_active=True).order_by(Session.last_active.desc()).all()
        return [s.to_dict(current_session_id=current_session_id) for s in sessions]
    except SQLAlchemyError:
        db.session.rollback()
        return []

def revoke_session(session_id, user_id=None):
    try:
        query = Session.query.filter_by(id=session_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        session = query.first()
        if session:
            session.is_active = False
            db.session.commit()
            return True
        return False
    except SQLAlchemyError:
        db.session.rollback()
        return False

def revoke_all_other_sessions(user_id, current_session_id):
    try:
        sessions = Session.query.filter(Session.user_id == user_id, Session.id != current_session_id, Session.is_active == True).all()
        for s in sessions:
            s.is_active = False
        db.session.commit()
        return True
    except SQLAlchemyError:
        db.session.rollback()
        return False

def get_login_history(user_id, limit=20):
    try:
        attempts = LoginAttempt.query.filter_by(user_id=user_id).order_by(LoginAttempt.created_at.desc()).limit(limit).all()
        return [a.to_dict() for a in attempts]
    except SQLAlchemyError:
        db.session.rollback()
        return []

def update_user_profile(user_id, name):
    try:
        user = get_user_by_id(user_id)
        if not user:
            return None
        user.name = name.strip()
        db.session.commit()
        return user
    except SQLAlchemyError:
        db.session.rollback()
        return None

def change_password(user_id, current_password, new_password):
    try:
        user = get_user_by_id(user_id)
        if not user:
            return False, "User not found."
        
        if user.is_google and not user.password_hash:
            return False, "Google accounts cannot change password here."
        
        if not user.password_hash or not check_password_hash(user.password_hash, current_password):
            return False, "Current password is incorrect."
        
        valid, msg = validate_password_strength(new_password)
        if not valid:
            return False, msg
        
        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return True, "Password changed successfully."
    except SQLAlchemyError as e:
        db.session.rollback()
        return False, f"Database error: {str(e)}"
