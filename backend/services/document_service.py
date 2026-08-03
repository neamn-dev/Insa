from datetime import datetime
from extensions import db
from models import Document, DocumentShare, DocumentState, DocumentVersion, DocumentActivity, User
from services.permission_service import get_user_document_role, is_owner, can_edit, can_view

def create_document(owner_id, title="Untitled Document"):
    title_clean = title.strip() if title else "Untitled Document"
    
    doc = Document(
        title=title_clean,
        owner_id=owner_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        last_opened_at=datetime.utcnow()
    )
    db.session.add(doc)
    db.session.flush()

    # Create initial Yjs state container
    state = DocumentState(
        document_id=doc.id,
        state_data="", # Initial state
        state_version=1
    )
    db.session.add(state)

    # Create initial version snapshot
    initial_version = DocumentVersion(
        document_id=doc.id,
        snapshot_data="",
        version_number=1,
        created_by=owner_id,
        version_type="AUTO"
    )
    db.session.add(initial_version)

    # Record activity
    activity = DocumentActivity(
        document_id=doc.id,
        user_id=owner_id,
        action="CREATE"
    )
    db.session.add(activity)

    db.session.commit()
    return doc

def get_user_documents(user_id):
    """
    Returns dict containing:
    - my_documents: documents owned by user_id
    - shared_with_me: documents shared with user_id
    - recent_documents: recently opened documents by user_id
    """
    # 1. My Documents
    my_docs = Document.query.filter_by(owner_id=user_id).order_by(Document.updated_at.desc()).all()
    my_docs_list = [d.to_dict(user_id=user_id, user_role='OWNER') for d in my_docs]


    # 2. Shared With Me
    shares = DocumentShare.query.filter_by(user_id=user_id).all()
    shared_docs_list = []
    for s in shares:
        if s.document:
            shared_docs_list.append(s.document.to_dict(user_id=user_id, user_role=s.role))

    # 3. Recent Documents (from activities or last_opened_at)
    recent_activities = db.session.query(DocumentActivity.document_id).filter_by(user_id=user_id)\
        .order_by(DocumentActivity.created_at.desc()).limit(10).all()
    recent_doc_ids = list(dict.fromkeys([r[0] for r in recent_activities]))

    recent_docs_list = []
    for doc_id in recent_doc_ids:
        doc = Document.query.get(doc_id)
        if doc and can_view(user_id, doc.id):
            role = get_user_document_role(user_id, doc.id)
            recent_docs_list.append(doc.to_dict(user_id=user_id, user_role=role))

    return {
        "my_documents": my_docs_list,
        "shared_with_me": shared_docs_list,
        "recent_documents": recent_docs_list
    }

def get_document_by_id(document_id, user_id):
    role = get_user_document_role(user_id, document_id)
    if not role:
        return None, "Access denied or document not found."

    doc = Document.query.get(document_id)
    if not doc:
        return None, "Document not found."

    # Update last_opened_at
    doc.last_opened_at = datetime.utcnow()
    
    # Track activity
    activity = DocumentActivity(
        document_id=doc.id,
        user_id=user_id,
        action="OPEN"
    )
    db.session.add(activity)
    db.session.commit()

    return doc.to_dict(user_id=user_id, user_role=role), None

def update_document_title(document_id, user_id, new_title):
    role = get_user_document_role(user_id, document_id)
    if role not in ['OWNER', 'EDITOR']:
        return None, "Permission denied. Only Owner or Editors can rename documents."

    doc = Document.query.get(document_id)
    if not doc:
        return None, "Document not found."

    doc.title = new_title.strip() or "Untitled Document"
    doc.updated_at = datetime.utcnow()

    activity = DocumentActivity(
        document_id=doc.id,
        user_id=user_id,
        action="RENAME"
    )
    db.session.add(activity)
    db.session.commit()

    return doc.to_dict(user_id=user_id, user_role=role), None

def delete_document(document_id, user_id):
    if not is_owner(user_id, document_id):
        return False, "Permission denied. Only the Owner can delete this document."

    doc = Document.query.get(document_id)
    if not doc:
        return False, "Document not found."

    db.session.delete(doc)
    db.session.commit()
    return True, "Document deleted successfully."

def toggle_star_document(document_id, user_id):
    if not can_view(user_id, document_id):
        return None, "Permission denied."

    doc = db.session.get(Document, document_id)
    if not doc:
        return None, "Document not found."

    doc.is_starred = not bool(doc.is_starred)
    db.session.commit()

    role = get_user_document_role(user_id, document_id)
    return doc.to_dict(user_id=user_id, user_role=role), None


def duplicate_document(document_id, user_id):
    if not can_view(user_id, document_id):
        return None, "Permission denied."

    original = Document.query.get(document_id)
    if not original:
        return None, "Original document not found."

    # Create new doc
    new_doc = Document(
        title=f"Copy of {original.title}",
        owner_id=user_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        last_opened_at=datetime.utcnow()
    )
    db.session.add(new_doc)
    db.session.flush()

    # Copy state
    original_state = DocumentState.query.filter_by(document_id=original.id).first()
    state_data = original_state.state_data if original_state else ""

    new_state = DocumentState(
        document_id=new_doc.id,
        state_data=state_data,
        state_version=1
    )
    db.session.add(new_state)

    # Initial version
    new_version = DocumentVersion(
        document_id=new_doc.id,
        snapshot_data=state_data,
        version_number=1,
        created_by=user_id,
        version_type="AUTO"
    )
    db.session.add(new_version)

    activity = DocumentActivity(
        document_id=new_doc.id,
        user_id=user_id,
        action="DUPLICATE"
    )
    db.session.add(activity)

    db.session.commit()
    return new_doc.to_dict(user_id=user_id, user_role='OWNER'), None
