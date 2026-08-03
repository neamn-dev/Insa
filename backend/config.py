import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file from project root
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
env_path = os.path.join(ROOT_DIR, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'demo-flask-auth-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-demo-secret-key-syncwrite')
    JWT_ALGORITHM = 'HS256'
    ACCESS_TOKEN_EXPIRES_MINUTES = 15
    REFRESH_TOKEN_EXPIRES_DAYS = 7
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_TIME_SECONDS = 300

    # PostgreSQL Database Configuration
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/syncwrite')
    # Clean database URL if schema param present
    if '?' in DATABASE_URL and 'schema=' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.split('?')[0]
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Google OAuth 2.0 Credentials
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '').strip()
    GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5000/api/auth/google/callback').strip()
