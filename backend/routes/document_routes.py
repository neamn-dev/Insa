from flask import Blueprint, request, jsonify
from services import document_service, collaboration_service
from middleware import login_required, require_document_permission

doc_bp = Blueprint('documents', __name__, url_prefix='/api/documents')

@doc_bp.route('', methods=['GET'])
@login_required
def list_documents():
    docs = document_service.get_user_documents(request.user_id)
    return jsonify({
        "status": "success",
        "data": docs
    }), 200

@doc_bp.route('', methods=['POST'])
@login_required
def create_document():
    data = request.get_json() or {}
    title = data.get('title', 'Untitled Document')
    doc = document_service.create_document(request.user_id, title=title)
    return jsonify({
        "status": "success",
        "message": "Document created successfully.",
        "document": doc.to_dict(user_id=request.user_id, user_role='OWNER')
    }), 201

@doc_bp.route('/<id>', methods=['GET'])
@login_required
@require_document_permission('VIEWER')
def get_document(id):
    doc_dict, error = document_service.get_document_by_id(id, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 404
    
    state_data = collaboration_service.get_document_state(id)
    doc_dict['state_data'] = state_data

    return jsonify({
        "status": "success",
        "document": doc_dict
    }), 200

@doc_bp.route('/<id>', methods=['PUT'])
@login_required
@require_document_permission('EDITOR')
def update_document(id):
    data = request.get_json() or {}
    title = data.get('title')
    if not title:
        return jsonify({"status": "fail", "message": "Title is required."}), 400

    doc_dict, error = document_service.update_document_title(id, request.user_id, title)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    try:
        from extensions import socketio
        socketio.emit('document:title_updated', {
            'document_id': id,
            'title': title
        }, to=f"document:{id}")
    except Exception as e:
        print("[Title Socket Warning]", e)

    return jsonify({
        "status": "success",
        "message": "Document title updated successfully.",
        "document": doc_dict
    }), 200

@doc_bp.route('/<id>', methods=['DELETE'])
@login_required
@require_document_permission('OWNER')
def delete_document(id):
    success, message = document_service.delete_document(id, request.user_id)
    if not success:
        return jsonify({"status": "fail", "message": message}), 403

    return jsonify({
        "status": "success",
        "message": message
    }), 200

@doc_bp.route('/<id>/duplicate', methods=['POST'])
@login_required
@require_document_permission('VIEWER')
def duplicate_document(id):
    new_doc_dict, error = document_service.duplicate_document(id, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    return jsonify({
        "status": "success",
        "message": "Document duplicated successfully.",
        "document": new_doc_dict
    }), 201

@doc_bp.route('/<id>/star', methods=['POST'])
@login_required
@require_document_permission('VIEWER')
def star_document(id):
    doc_dict, error = document_service.toggle_star_document(id, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    return jsonify({
        "status": "success",
        "message": "Document star status toggled.",
        "document": doc_dict
    }), 200

