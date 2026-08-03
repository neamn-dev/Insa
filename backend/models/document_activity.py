import uuid
from datetime import datetime
from extensions import db

class DocumentActivity(db.Model):
    __tablename__ = 'document_activity'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=False, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    action = db.Column(db.String(64), nullable=False) # e.g. 'OPEN', 'EDIT', 'SHARE', 'RESTORE_VERSION'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "action": self.action,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
