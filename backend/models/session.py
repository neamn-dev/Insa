import uuid
from datetime import datetime, timedelta
from extensions import db

class Session(db.Model):
    __tablename__ = 'sessions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    refresh_token_hash = db.Column(db.String(255), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(days=7))
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self, current_session_id=None):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_agent": self.user_agent or "Unknown Device",
            "ip_address": self.ip_address or "127.0.0.1",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "last_active": self.last_active.strftime("%Y-%m-%d %H:%M:%S") if self.last_active else None,
            "is_active": self.is_active,
            "is_current": (self.id == current_session_id)
        }
