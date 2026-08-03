import uuid
from datetime import datetime
from extensions import db

class Document(db.Model):
    __tablename__ = 'documents'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), nullable=False, default="Untitled Document")
    owner_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_opened_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_starred = db.Column(db.Boolean, default=False)

    # Relationships
    shares = db.relationship('DocumentShare', backref='document', lazy=True, cascade="all, delete-orphan")
    state = db.relationship('DocumentState', backref='document', uselist=False, lazy=True, cascade="all, delete-orphan")
    versions = db.relationship('DocumentVersion', backref='document', lazy=True, cascade="all, delete-orphan")
    comments = db.relationship('Comment', backref='document', lazy=True, cascade="all, delete-orphan")
    activities = db.relationship('DocumentActivity', backref='document', lazy=True, cascade="all, delete-orphan")

    def to_dict(self, user_id=None, user_role=None):
        return {
            "id": self.id,
            "title": self.title,
            "owner_id": self.owner_id,
            "owner_name": self.owner.name if self.owner else None,
            "owner_email": self.owner.email if self.owner else None,
            "is_starred": bool(self.is_starred),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_opened_at": self.last_opened_at.isoformat() if self.last_opened_at else None,
            "user_role": user_role or ('OWNER' if user_id and self.owner_id == user_id else None)
        }

