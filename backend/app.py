import os
import psycopg2
from urllib.parse import urlparse
from flask import Flask, jsonify, request, send_from_directory, redirect
from config import Config
from extensions import db, migrate, socketio, cors
from models import *
from routes import auth_bp, doc_bp, share_bp, comment_bp, version_bp, user_bp
import sockets  # Register Socket.IO handlers

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

def ensure_postgres_database(database_url):
    """Ensure PostgreSQL database exists, creating it if necessary."""
    try:
        url = urlparse(database_url)
        dbname = url.path.lstrip('/')
        if not dbname:
            dbname = 'syncwrite'
        
        user = url.username or 'postgres'
        password = url.password or 'postgres'
        host = url.hostname or 'localhost'
        port = url.port or 5432

        # Connect to default postgres database
        conn = psycopg2.connect(
            dbname='postgres',
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.autocommit = True
        cursor = conn.cursor()

        # Check if target database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f'CREATE DATABASE "{dbname}"')
            print(f"[Database] Created PostgreSQL database '{dbname}' successfully.")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[Database] PostgreSQL connection check warning: {e}")

def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIR)
    app.config.from_object(Config)

    # Ensure PostgreSQL database exists before initializing SQLAlchemy
    ensure_postgres_database(Config.SQLALCHEMY_DATABASE_URI)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, supports_credentials=True)
    socketio.init_app(app, cors_allowed_origins="*")

    # Security Headers
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        return response

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(doc_bp)
    app.register_blueprint(share_bp)
    app.register_blueprint(comment_bp)
    app.register_blueprint(version_bp)
    app.register_blueprint(user_bp)

    # Static file serving
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            if os.path.exists(os.path.join(app.static_folder, 'index.html')):
                return send_from_directory(app.static_folder, 'index.html')
            return redirect('/login.html')

    # Create tables automatically inside app context
    with app.app_context():
        try:
            db.create_all()
            print("[Database] PostgreSQL tables verified/created successfully.")
        except Exception as e:
            print(f"[Database] Error creating PostgreSQL tables: {e}")

    return app

app = create_app()

if __name__ == '__main__':
    print("SyncWrite Backend running on http://127.0.0.1:5000 with PostgreSQL")
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, allow_unsafe_werkzeug=True)
