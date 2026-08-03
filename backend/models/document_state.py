import uuid
from datetime import datetime
from extensions import db

class DocumentState(db.Model):
    __tablename__ = 'document_states'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=False, unique=True, index=True)
    state_data = db.Column(db.Text, nullable=True) # Base64-encoded Yjs state vector / update snapshot
    state_version = db.Column(db.Integer, default=1)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "state_data": self.state_data,
            "state_version": self.state_version,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
