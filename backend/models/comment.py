import uuid
from datetime import datetime
from extensions import db

class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=False, index=True)
    author_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.String(36), db.ForeignKey('comments.id'), nullable=True, index=True)
    content = db.Column(db.Text, nullable=False)
    resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Threaded replies relationship
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "author_id": self.author_id,
            "author_name": self.author.name if self.author else None,
            "author_email": self.author.email if self.author else None,
            "parent_id": self.parent_id,
            "content": self.content,
            "resolved": self.resolved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "replies": [reply.to_dict() for reply in self.replies] if self.replies else []
        }
