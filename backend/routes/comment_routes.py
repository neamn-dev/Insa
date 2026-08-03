from flask import Blueprint, request, jsonify
from extensions import socketio
from models import Comment
from services import comment_service
from middleware import login_required, require_document_permission

comment_bp = Blueprint('comments', __name__)

@comment_bp.route('/api/documents/<id>/comments', methods=['GET'])
@login_required
@require_document_permission('VIEWER')
def get_comments(id):
    comments, error = comment_service.list_document_comments(id, request.user_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 403

    return jsonify({
        "status": "success",
        "comments": comments
    }), 200

@comment_bp.route('/api/documents/<id>/comments', methods=['POST'])
@login_required
@require_document_permission('COMMENTER')
def add_comment(id):
    data = request.get_json() or {}
    content = data.get('content')
    parent_id = data.get('parent_id')

    if not content:
        return jsonify({"status": "fail", "message": "Comment content required."}), 400

    comment_dict, error = comment_service.add_comment(id, request.user_id, content, parent_id=parent_id)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    # Broadcast real-time comment addition/reply to all room members
    socketio.emit('comment:update', {
        'document_id': id,
        'action': 'add',
        'comment': comment_dict
    }, to=f"document:{id}")

    return jsonify({
        "status": "success",
        "message": "Comment added successfully.",
        "comment": comment_dict
    }), 201

@comment_bp.route('/api/comments/<id>/resolve', methods=['PUT'])
@login_required
def resolve_comment(id):
    data = request.get_json() or {}
    resolved = data.get('resolved', True)

    comment_dict, error = comment_service.resolve_comment(id, request.user_id, resolved=resolved)
    if error:
        return jsonify({"status": "fail", "message": error}), 400

    doc_id = comment_dict.get('document_id')
    if doc_id:
        socketio.emit('comment:update', {
            'document_id': doc_id,
            'action': 'resolve',
            'comment': comment_dict
        }, to=f"document:{doc_id}")

    return jsonify({
        "status": "success",
        "message": "Comment status updated.",
        "comment": comment_dict
    }), 200

@comment_bp.route('/api/comments/<id>', methods=['DELETE'])
@login_required
def delete_comment(id):
    comment_obj = Comment.query.get(id)
    doc_id = comment_obj.document_id if comment_obj else None

    success, message = comment_service.delete_comment(id, request.user_id)
    if not success:
        return jsonify({"status": "fail", "message": message}), 403

    if doc_id:
        socketio.emit('comment:update', {
            'document_id': doc_id,
            'action': 'delete',
            'comment_id': id
        }, to=f"document:{doc_id}")

    return jsonify({
        "status": "success",
        "message": message
    }), 200
