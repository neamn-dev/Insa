import uuid
from datetime import datetime
from extensions import db

class DocumentVersion(db.Model):
    __tablename__ = 'document_versions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=False, index=True)
    snapshot_data = db.Column(db.Text, nullable=False) # Immutable snapshot state
    version_number = db.Column(db.Integer, nullable=False)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    version_type = db.Column(db.String(32), default='MANUAL') # AUTO, MANUAL, RESTORE

    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "snapshot_data": self.snapshot_data,
            "version_number": self.version_number,
            "created_by": self.created_by,
            "creator_name": self.creator.name if self.creator else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "version_type": self.version_type
        }
