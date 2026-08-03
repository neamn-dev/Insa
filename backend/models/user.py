import uuid
from datetime import datetime
from extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    avatar_url = db.Column(db.String(512), nullable=True)
    is_google = db.Column(db.Boolean, default=False)
    failed_attempts = db.Column(db.Integer, default=0)
    lockout_until = db.Column(db.BigInteger, default=0)
    last_user_agent = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sessions = db.relationship('Session', backref='user', lazy=True, cascade="all, delete-orphan")
    documents = db.relationship('Document', backref='owner', lazy=True, cascade="all, delete-orphan")
    shares = db.relationship('DocumentShare', backref='user', lazy=True, cascade="all, delete-orphan")
    comments = db.relationship('Comment', backref='author', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name or self.email.split('@')[0],
            "avatar_url": self.avatar_url,
            "is_google": self.is_google,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
