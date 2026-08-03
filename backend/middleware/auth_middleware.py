from functools import wraps
from flask import request, jsonify
from services import auth_service

def get_authenticated_user_payload():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, "Authorization header missing or invalid format."
    
    token = auth_header.split(' ')[1]
    payload, error = auth_service.verify_token(token, token_type="access")
    if error:
        return None, error
    return payload, None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        payload, error = get_authenticated_user_payload()
        if error:
            return jsonify({"status": "fail", "message": error}), 401
        request.user_id = payload['user_id']
        request.session_id = payload['session_id']
        return f(*args, **kwargs)
    return decorated_function

def verify_socket_token(token):
    if not token:
        return None, "Missing authentication token."
    payload, error = auth_service.verify_token(token, token_type="access")
    if error:
        return None, error
    user = auth_service.get_user_by_id(payload['user_id'])
    if not user:
        return None, "Authenticated user not found."
    return {
        "user_id": user.id,
        "email": user.email,
        "name": user.name or user.email.split('@')[0],
        "session_id": payload['session_id']
    }, None
