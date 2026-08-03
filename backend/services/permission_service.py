from models import Document, DocumentShare

# Role hierarchies and permissions mapping
ROLE_HIERARCHY = {
    'VIEWER': 1,
    'COMMENTER': 2,
    'EDITOR': 3,
    'OWNER': 4
}

def get_user_document_role(user_id, document_id):
    """
    Returns the user's role on a given document: 'OWNER', 'EDITOR', 'COMMENTER', 'VIEWER', or None.
    """
    if not user_id or not document_id:
        return None

    doc = Document.query.get(document_id)
    if not doc:
        return None

    # Owner check
    if doc.owner_id == user_id:
        return 'OWNER'

    # Share check
    share = DocumentShare.query.filter_by(document_id=document_id, user_id=user_id).first()
    if share:
        return share.role.upper()

    return None

def has_minimum_role(user_id, document_id, required_role):
    """
    Checks if a user has at least the required_role ('VIEWER', 'COMMENTER', 'EDITOR', 'OWNER') for document_id.
    """
    user_role = get_user_document_role(user_id, document_id)
    if not user_role:
        return False

    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ROLE_HIERARCHY.get(required_role.upper(), 99)

    return user_level >= required_level

def can_view(user_id, document_id):
    return has_minimum_role(user_id, document_id, 'VIEWER')

def can_comment(user_id, document_id):
    return has_minimum_role(user_id, document_id, 'COMMENTER')

def can_edit(user_id, document_id):
    return has_minimum_role(user_id, document_id, 'EDITOR')

def is_owner(user_id, document_id):
    return get_user_document_role(user_id, document_id) == 'OWNER'
