import pytest

def get_auth_header(client, email, password, name="Test User"):
    client.post('/api/auth/register', json={"name": name, "email": email, "password": password})
    res = client.post('/api/auth/login', json={"email": email, "password": password})
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_document_crud_and_duplication(client):
    headers = get_auth_header(client, "doc_owner@syncwrite.test", "Password123", "Doc Owner")

    # 1. Create Document
    create_res = client.post('/api/documents', json={"title": "Q3 Strategy Document"}, headers=headers)
    assert create_res.status_code == 201
    doc = create_res.get_json()["document"]
    doc_id = doc["id"]
    assert doc["title"] == "Q3 Strategy Document"
    assert doc["user_role"] == "OWNER"

    # 2. Get Document
    get_res = client.get(f'/api/documents/{doc_id}', headers=headers)
    assert get_res.status_code == 200
    assert get_res.get_json()["document"]["id"] == doc_id

    # 3. Update Title
    put_res = client.put(f'/api/documents/{doc_id}', json={"title": "Q3 Final Strategy"}, headers=headers)
    assert put_res.status_code == 200
    assert put_res.get_json()["document"]["title"] == "Q3 Final Strategy"

    # 4. Duplicate Document
    dup_res = client.post(f'/api/documents/{doc_id}/duplicate', headers=headers)
    assert dup_res.status_code == 201
    dup_doc = dup_res.get_json()["document"]
    assert dup_doc["title"] == "Copy of Q3 Final Strategy"
    assert dup_doc["id"] != doc_id

    # 5. List Documents
    list_res = client.get('/api/documents', headers=headers)
    assert list_res.status_code == 200
    data = list_res.get_json()["data"]
    assert len(data["my_documents"]) >= 2

    # 6. Delete Document
    del_res = client.delete(f'/api/documents/{doc_id}', headers=headers)
    assert del_res.status_code == 200
