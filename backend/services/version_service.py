from datetime import datetime
from extensions import db
from models import Document, DocumentState, DocumentVersion, DocumentActivity
from services.permission_service import can_view, can_edit, is_owner

def list_versions(document_id, user_id):
    if not can_view(user_id, document_id):
        return None, "Permission denied."

    versions = DocumentVersion.query.filter_by(document_id=document_id)\
        .order_by(DocumentVersion.version_number.desc()).all()
    
    return [v.to_dict() for v in versions], None

def create_version_checkpoint(document_id, user_id, version_type="MANUAL"):
    if not can_edit(user_id, document_id):
        return None, "Permission denied. Only Editors and Owners can create versions."

    state = DocumentState.query.filter_by(document_id=document_id).first()
    snapshot_data = state.state_data if state else ""

    # Get max version number
    last_version = DocumentVersion.query.filter_by(document_id=document_id)\
        .order_by(DocumentVersion.version_number.desc()).first()
    
    next_num = (last_version.version_number + 1) if last_version else 1

    version = DocumentVersion(
        document_id=document_id,
        snapshot_data=snapshot_data,
        version_number=next_num,
        created_by=user_id,
        version_type=version_type
    )
    db.session.add(version)

    activity = DocumentActivity(
        document_id=document_id,
        user_id=user_id,
        action=f"CREATE_VERSION_{version_type}"
    )
    db.session.add(activity)
    db.session.commit()

    return version.to_dict(), None

def get_version_by_id(document_id, version_id, user_id):
    if not can_view(user_id, document_id):
        return None, "Permission denied."

    version = DocumentVersion.query.filter_by(id=version_id, document_id=document_id).first()
    if not version:
        return None, "Version not found."

    return version.to_dict(), None

def restore_version(document_id, version_id, user_id):
    if not can_edit(user_id, document_id):
        return None, "Permission denied. Only Editors and Owners can restore document versions."

    target_version = DocumentVersion.query.filter_by(id=version_id, document_id=document_id).first()
    if not target_version:
        return None, "Target version not found."

    # 1. Update DocumentState to target_version's snapshot_data
    state = DocumentState.query.filter_by(document_id=document_id).first()
    if not state:
        state = DocumentState(document_id=document_id, state_data=target_version.snapshot_data, state_version=1)
        db.session.add(state)
    else:
        state.state_data = target_version.snapshot_data
        state.state_version = (state.state_version or 1) + 1
        state.updated_at = datetime.utcnow()

    # 2. Create a NEW version record with version_type = 'RESTORE'
    last_version = DocumentVersion.query.filter_by(document_id=document_id)\
        .order_by(DocumentVersion.version_number.desc()).first()
    
    next_num = (last_version.version_number + 1) if last_version else 1

    restore_version_record = DocumentVersion(
        document_id=document_id,
        snapshot_data=target_version.snapshot_data,
        version_number=next_num,
        created_by=user_id,
        version_type="RESTORE"
    )
    db.session.add(restore_version_record)

    # 3. Log activity
    activity = DocumentActivity(
        document_id=document_id,
        user_id=user_id,
        action=f"RESTORE_VERSION_v{target_version.version_number}"
    )
    db.session.add(activity)

    doc = Document.query.get(document_id)
    if doc:
        doc.updated_at = datetime.utcnow()

    db.session.commit()

    return {
        "restored_version": restore_version_record.to_dict(),
        "state_data": target_version.snapshot_data
    }, None
