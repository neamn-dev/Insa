import uuid
from datetime import datetime
from extensions import db

class DocumentShare(db.Model):
    __tablename__ = 'document_shares'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=False, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    role = db.Column(db.String(32), nullable=False, default='VIEWER') # VIEWER, COMMENTER, EDITOR
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('document_id', 'user_id', name='_document_user_share_uc'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
