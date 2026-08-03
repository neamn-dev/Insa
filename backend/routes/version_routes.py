from flask import Blueprint, request, jsonify
from extensions import socketio
from services import version_service
from middleware import login_required, require_document_permission

version_bp = Blueprint('versions', __name__, url_prefix='/api/documents')

@version_bp.route('/<id>/versions', methods=['GET'])
@login_required
@require_document_permission('VIEWER')
def list_versions(id):
    versions, error = version_service.list_versions(id, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 403

    return jsonify({
        "status": "success",
        "versions": versions
    }), 200

@version_bp.route('/<id>/versions', methods=['POST'])
@login_required
@require_document_permission('EDITOR')
def create_checkpoint(id):
    data = request.get_json() or {}
    version_type = data.get('version_type', 'MANUAL')

    version_dict, error = version_service.create_version_checkpoint(id, request.user_id, version_type=version_type)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    return jsonify({
        "status": "success",
        "message": "Version checkpoint created.",
        "version": version_dict
    }), 201

@version_bp.route('/<id>/versions/<versionId>', methods=['GET'])
@login_required
@require_document_permission('VIEWER')
def get_version(id, versionId):
    version_dict, error = version_service.get_version_by_id(id, versionId, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 404

    return jsonify({
        "status": "success",
        "version": version_dict
    }), 200

@version_bp.route('/<id>/versions/<versionId>/restore', methods=['POST'])
@login_required
@require_document_permission('EDITOR')
def restore_version(id, versionId):
    result, error = version_service.restore_version(id, versionId, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    restored_state = result.get('state_data', '')

    # Broadcast updated document state to all connected room members in real-time
    socketio.emit('document:sync', {
        'document_id': id,
        'state_data': restored_state,
        'user_role': 'EDITOR'
    }, to=f"document:{id}")

    return jsonify({
        "status": "success",
        "message": "Document version restored successfully (new version created).",
        "data": result
    }), 200
