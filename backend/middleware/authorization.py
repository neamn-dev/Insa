from functools import wraps
from flask import request, jsonify
from services import permission_service

def require_document_permission(required_role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            document_id = kwargs.get('document_id') or kwargs.get('id')
            user_id = getattr(request, 'user_id', None)

            if not user_id:
                return jsonify({"status": "fail", "message": "Authentication required."}), 401
            if not document_id:
                return jsonify({"status": "fail", "message": "Document ID required."}), 400

            if not permission_service.has_minimum_role(user_id, document_id, required_role):
                return jsonify({
                    "status": "fail",
                    "message": f"Permission denied. Required role: {required_role}"
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator
