import uuid
from datetime import datetime
from extensions import db

class LoginAttempt(db.Model):
    __tablename__ = 'login_attempts'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    email_attempted = db.Column(db.String(255), nullable=False, index=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    success = db.Column(db.Boolean, default=False)
    risk_flags = db.Column(db.Text, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "email_attempted": self.email_attempted,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "success": self.success,
            "risk_flags": self.risk_flags,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
