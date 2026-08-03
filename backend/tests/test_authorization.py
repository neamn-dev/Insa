import pytest

def get_token(client, email, name):
    client.post('/api/auth/register', json={"name": name, "email": email, "password": "Password123"})
    res = client.post('/api/auth/login', json={"email": email, "password": "Password123"})
    return res.get_json()["access_token"]

def test_role_based_permissions_matrix(client):
    owner_token = get_token(client, "owner@syncwrite.test", "Owner User")
    viewer_token = get_token(client, "viewer@syncwrite.test", "Viewer User")
    commenter_token = get_token(client, "commenter@syncwrite.test", "Commenter User")
    editor_token = get_token(client, "editor@syncwrite.test", "Editor User")

    owner_hdr = {"Authorization": f"Bearer {owner_token}"}
    viewer_hdr = {"Authorization": f"Bearer {viewer_token}"}
    commenter_hdr = {"Authorization": f"Bearer {commenter_token}"}
    editor_hdr = {"Authorization": f"Bearer {editor_token}"}

    # 1. Owner creates document
    doc_res = client.post('/api/documents', json={"title": "Shared Project Spec"}, headers=owner_hdr)
    doc_id = doc_res.get_json()["document"]["id"]

    # 2. Share with Viewer, Commenter, Editor
    client.post(f'/api/documents/{doc_id}/shares', json={"email": "viewer@syncwrite.test", "role": "VIEWER"}, headers=owner_hdr)
    client.post(f'/api/documents/{doc_id}/shares', json={"email": "commenter@syncwrite.test", "role": "COMMENTER"}, headers=owner_hdr)
    client.post(f'/api/documents/{doc_id}/shares', json={"email": "editor@syncwrite.test", "role": "EDITOR"}, headers=owner_hdr)

    # 3. Viewer Tests
    # Viewer can read
    assert client.get(f'/api/documents/{doc_id}', headers=viewer_hdr).status_code == 200
    # Viewer cannot rename
    assert client.put(f'/api/documents/{doc_id}', json={"title": "Hacked Title"}, headers=viewer_hdr).status_code == 403
    # Viewer cannot comment
    assert client.post(f'/api/documents/{doc_id}/comments', json={"content": "Illegal comment"}, headers=viewer_hdr).status_code == 403

    # 4. Commenter Tests
    # Commenter can read
    assert client.get(f'/api/documents/{doc_id}', headers=commenter_hdr).status_code == 200
    # Commenter can comment
    assert client.post(f'/api/documents/{doc_id}/comments', json={"content": "Great spec!"}, headers=commenter_hdr).status_code == 201
    # Commenter cannot rename
    assert client.put(f'/api/documents/{doc_id}', json={"title": "Commenter Title"}, headers=commenter_hdr).status_code == 403

    # 5. Editor Tests
    # Editor can read, comment, and rename
    assert client.get(f'/api/documents/{doc_id}', headers=editor_hdr).status_code == 200
    assert client.post(f'/api/documents/{doc_id}/comments', json={"content": "Adding section 2"}, headers=editor_hdr).status_code == 201
    assert client.put(f'/api/documents/{doc_id}', json={"title": "Spec v2 Updated"}, headers=editor_hdr).status_code == 200
    # Editor cannot delete document
    assert client.delete(f'/api/documents/{doc_id}', headers=editor_hdr).status_code == 403

    # 6. Owner can delete
    assert client.delete(f'/api/documents/{doc_id}', headers=owner_hdr).status_code == 200
