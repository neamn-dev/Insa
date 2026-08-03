from flask import Blueprint, request, jsonify
from services import share_service
from middleware import login_required, require_document_permission

share_bp = Blueprint('shares', __name__, url_prefix='/api/documents')

@share_bp.route('/<id>/shares', methods=['GET'])
@login_required
@require_document_permission('VIEWER')
def get_shares(id):
    shares, error = share_service.list_document_shares(id, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 403
    return jsonify({
        "status": "success",
        "shares": shares
    }), 200

@share_bp.route('/<id>/shares', methods=['POST'])
@login_required
@require_document_permission('OWNER')
def add_or_update_share(id):
    data = request.get_json() or {}
    email = data.get('email')
    role = data.get('role', 'VIEWER')

    if not email or not role:
        return jsonify({"status": "fail", "message": "User email and role are required."}), 400

    share_dict, error = share_service.add_or_update_share(id, request.user_id, email, role)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    return jsonify({
        "status": "success",
        "message": f"Document shared with {email} as {role}.",
        "share": share_dict
    }), 200

@share_bp.route('/<id>/shares/<userId>', methods=['DELETE'])
@login_required
@require_document_permission('OWNER')
def remove_share(id, userId):
    success, message = share_service.remove_share(id, request.user_id, userId)
    if not success:
        return jsonify({"status": "fail", "message": message}), 400

    return jsonify({
        "status": "success",
        "message": message
    }), 200
