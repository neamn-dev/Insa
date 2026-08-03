from datetime import datetime
from extensions import db
from models import DocumentShare, User, Document, DocumentActivity
from services.permission_service import is_owner, can_view

def list_document_shares(document_id, user_id):
    if not can_view(user_id, document_id):
        return None, "Permission denied."

    shares = DocumentShare.query.filter_by(document_id=document_id).all()
    return [s.to_dict() for s in shares], None

def add_or_update_share(document_id, owner_id, target_email, role):
    if not is_owner(owner_id, document_id):
        return None, "Permission denied. Only the document Owner can manage sharing."

    role_upper = role.upper()
    if role_upper not in ['VIEWER', 'COMMENTER', 'EDITOR']:
        return None, "Invalid role. Must be VIEWER, COMMENTER, or EDITOR."

    target_user = User.query.filter(db.func.lower(User.email) == target_email.strip().lower()).first()
    if not target_user:
        return None, "User with this email not found."

    doc = Document.query.get(document_id)
    if doc.owner_id == target_user.id:
        return None, "Cannot change role of document Owner."

    share = DocumentShare.query.filter_by(document_id=document_id, user_id=target_user.id).first()
    if share:
        share.role = role_upper
        share.updated_at = datetime.utcnow()
    else:
        share = DocumentShare(
            document_id=document_id,
            user_id=target_user.id,
            role=role_upper
        )
        db.session.add(share)

    activity = DocumentActivity(
        document_id=document_id,
        user_id=owner_id,
        action=f"SHARE_{role_upper}_{target_user.email}"
    )
    db.session.add(activity)

    db.session.commit()
    return share.to_dict(), None

def remove_share(document_id, owner_id, target_user_id):
    if not is_owner(owner_id, document_id):
        return False, "Permission denied. Only the document Owner can manage sharing."

    share = DocumentShare.query.filter_by(document_id=document_id, user_id=target_user_id).first()
    if not share:
        return False, "Share permission not found."

    db.session.delete(share)
    
    activity = DocumentActivity(
        document_id=document_id,
        user_id=owner_id,
        action=f"REMOVE_SHARE_{target_user_id}"
    )
    db.session.add(activity)

    db.session.commit()
    return True, "Share removed successfully."

def search_users_to_share(query_text, current_user_id):
    if not query_text or len(query_text.strip()) < 2:
        return []

    users = User.query.filter(
        User.id != current_user_id,
        db.or_(
            db.func.lower(User.email).like(f"%{query_text.strip().lower()}%"),
            db.func.lower(User.name).like(f"%{query_text.strip().lower()}%")
        )
    ).limit(10).all()

    return [u.to_dict() for u in users]
