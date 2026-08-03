from datetime import datetime
from extensions import db
from models import Comment, DocumentActivity
from services.permission_service import can_comment, can_view, is_owner

def list_document_comments(document_id, user_id):
    if not can_view(user_id, document_id):
        return None, "Permission denied."

    # Return top-level comments (parent_id is None) with nested replies
    comments = Comment.query.filter_by(document_id=document_id, parent_id=None)\
        .order_by(Comment.created_at.asc()).all()
    
    return [c.to_dict() for c in comments], None

def add_comment(document_id, author_id, content, parent_id=None):
    if not can_comment(author_id, document_id):
        return None, "Permission denied. Only Commenters, Editors, and Owners can comment."

    if not content or not content.strip():
        return None, "Comment content cannot be empty."

    # If parent_id provided, verify parent comment exists
    if parent_id:
        parent = Comment.query.filter_by(id=parent_id, document_id=document_id).first()
        if not parent:
            return None, "Parent comment not found."

    comment = Comment(
        document_id=document_id,
        author_id=author_id,
        parent_id=parent_id,
        content=content.strip(),
        resolved=False
    )
    db.session.add(comment)

    activity = DocumentActivity(
        document_id=document_id,
        user_id=author_id,
        action="ADD_COMMENT"
    )
    db.session.add(activity)

    db.session.commit()

    return comment.to_dict(), None

def resolve_comment(comment_id, user_id, resolved=True):
    comment = Comment.query.get(comment_id)
    if not comment:
        return None, "Comment not found."

    if not can_comment(user_id, comment.document_id):
        return None, "Permission denied."

    comment.resolved = resolved
    comment.updated_at = datetime.utcnow()
    db.session.commit()

    return comment.to_dict(), None

def delete_comment(comment_id, user_id):
    comment = Comment.query.get(comment_id)
    if not comment:
        return False, "Comment not found."

    # Author can delete own comment, or Document Owner can delete any comment
    if comment.author_id != user_id and not is_owner(user_id, comment.document_id):
        return False, "Permission denied. You can only delete your own comments."

    db.session.delete(comment)
    db.session.commit()
    return True, "Comment deleted successfully."
