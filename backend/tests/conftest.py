import os
import pytest
from app import create_app
from extensions import db
from models import User, Document, DocumentShare, DocumentState, DocumentVersion, Comment, Session, LoginAttempt

@pytest.fixture(scope='module')
def app():
    db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/syncwrite_test')
    if 'syncwrite' in db_url and not db_url.endswith('_test'):
        # replace database name with syncwrite_test
        if 'syncwrite?' in db_url:
            db_url = db_url.replace('syncwrite?', 'syncwrite_test?')
        else:
            db_url = db_url.replace('/syncwrite', '/syncwrite_test')
    os.environ['DATABASE_URL'] = db_url
    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        with db.engine.connect() as conn:
            conn.execute(db.text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
            conn.commit()
        db.create_all()
        yield app
        db.session.remove()
        with db.engine.connect() as conn:
            conn.execute(db.text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
            conn.commit()



@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()
