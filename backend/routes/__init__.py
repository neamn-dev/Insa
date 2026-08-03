from routes.auth_routes import auth_bp
from routes.document_routes import doc_bp
from routes.share_routes import share_bp
from routes.comment_routes import comment_bp
from routes.version_routes import version_bp
from routes.user_routes import user_bp

__all__ = [
    'auth_bp',
    'doc_bp',
    'share_bp',
    'comment_bp',
    'version_bp',
    'user_bp'
]
