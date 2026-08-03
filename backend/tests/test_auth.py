import pytest
from models import User, Session, LoginAttempt

def test_registration_success(client):
    res = client.post('/api/auth/register', json={
        "name": "Alice Developer",
        "email": "alice@syncwrite.test",
        "password": "Password123"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "success"
    assert data["user"]["email"] == "alice@syncwrite.test"

def test_registration_password_policy_fail(client):
    # Short password
    res = client.post('/api/auth/register', json={
        "name": "Bad User",
        "email": "bad1@syncwrite.test",
        "password": "pass"
    })
    assert res.status_code == 400

    # No number
    res = client.post('/api/auth/register', json={
        "name": "Bad User",
        "email": "bad2@syncwrite.test",
        "password": "onlyletters"
    })
    assert res.status_code == 400

def test_registration_duplicate_email_fail(client):
    res = client.post('/api/auth/register', json={
        "name": "Alice Dup",
        "email": "alice@syncwrite.test",
        "password": "Password123"
    })
    assert res.status_code == 400
    assert "already registered" in res.get_json()["message"]

def test_login_success_and_tokens(client):
    res = client.post('/api/auth/login', json={
        "email": "alice@syncwrite.test",
        "password": "Password123"
    }, headers={"User-Agent": "TestBrowser/1.0"})
    
    assert res.status_code == 200
    data = res.get_json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@syncwrite.test"

def test_brute_force_lockout(client):
    # Create test user
    client.post('/api/auth/register', json={
        "name": "Target User",
        "email": "target@syncwrite.test",
        "password": "Password123"
    })

    # Fail 5 times
    for i in range(5):
        res = client.post('/api/auth/login', json={
            "email": "target@syncwrite.test",
            "password": "WrongPassword!"
        })
        if i == 4:
            assert res.status_code == 429
            assert "locked" in res.get_json()["message"].lower()

def test_suspicious_device_detection(client):
    # Login with Agent A
    res1 = client.post('/api/auth/login', json={
        "email": "alice@syncwrite.test",
        "password": "Password123"
    }, headers={"User-Agent": "Device-A"})
    assert res1.status_code == 200

    # Login with Agent B (Different device)
    res2 = client.post('/api/auth/login', json={
        "email": "alice@syncwrite.test",
        "password": "Password123"
    }, headers={"User-Agent": "Device-B"})
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2.get("suspicious_login") is True
    assert data2.get("previous_device") == "Device-A"

def test_session_management_and_revocation(client):
    login_res = client.post('/api/auth/login', json={
        "email": "alice@syncwrite.test",
        "password": "Password123"
    })
    token = login_res.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get sessions
    sessions_res = client.get('/api/auth/sessions', headers=headers)
    assert sessions_res.status_code == 200
    sessions = sessions_res.get_json()["sessions"]
    assert len(sessions) > 0

    # Get login history
    history_res = client.get('/api/auth/login-history', headers=headers)
    assert history_res.status_code == 200
    history = history_res.get_json()["history"]
    assert len(history) > 0

def test_firebase_auth_endpoint(client):
    import jwt
    dummy_payload = {
        "email": "firebase_user@syncwrite.test",
        "name": "Firebase User",
        "sub": "firebase_uid_123"
    }
    dummy_token = jwt.encode(dummy_payload, "secret", algorithm="HS256")

    res = client.post('/api/auth/firebase', json={"token": dummy_token})
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["user"]["email"] == "firebase_user@syncwrite.test"
    assert data["user"]["name"] == "Firebase User"

