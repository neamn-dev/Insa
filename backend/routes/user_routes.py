from flask import Blueprint, request, jsonify
from services import share_service
from middleware import login_required

user_bp = Blueprint('users', __name__, url_prefix='/api/users')

@user_bp.route('/search', methods=['GET'])
@login_required
def search_users():
    query_text = request.args.get('q', '')
    users = share_service.search_users_to_share(query_text, request.user_id)
    return jsonify({
        "status": "success",
        "users": users
    }), 200
