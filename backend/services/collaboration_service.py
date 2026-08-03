from datetime import datetime
from extensions import db
from models import Document, DocumentState

DEFAULT_DOCUMENT_HTML = ""

def get_document_state(document_id):
    state = DocumentState.query.filter_by(document_id=document_id).first()
    if not state or not state.state_data:
        return ""
    return state.state_data


def save_document_state(document_id, state_data):
    state = DocumentState.query.filter_by(document_id=document_id).first()
    if not state:
        state = DocumentState(document_id=document_id, state_data=state_data, state_version=1)
        db.session.add(state)
    else:
        state.state_data = state_data
        state.state_version = (state.state_version or 1) + 1
        state.updated_at = datetime.utcnow()

    doc = Document.query.get(document_id)
    if doc:
        doc.updated_at = datetime.utcnow()

    db.session.commit()
    return state
