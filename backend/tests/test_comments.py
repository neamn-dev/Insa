import pytest

def get_token(client, email):
    client.post('/api/auth/register', json={"name": email.split('@')[0], "email": email, "password": "Password123"})
    res = client.post('/api/auth/login', json={"email": email, "password": "Password123"})
    return res.get_json()["access_token"]

def test_comments_and_threaded_replies(client):
    owner_token = get_token(client, "comment_owner@syncwrite.test")
    commenter_token = get_token(client, "commenter_user@syncwrite.test")
    other_token = get_token(client, "other_user@syncwrite.test")

    owner_hdr = {"Authorization": f"Bearer {owner_token}"}
    commenter_hdr = {"Authorization": f"Bearer {commenter_token}"}
    other_hdr = {"Authorization": f"Bearer {other_token}"}

    # 1. Owner creates document & shares with commenter
    doc_res = client.post('/api/documents', json={"title": "Design Specs"}, headers=owner_hdr)
    doc_id = doc_res.get_json()["document"]["id"]
    client.post(f'/api/documents/{doc_id}/shares', json={"email": "commenter_user@syncwrite.test", "role": "COMMENTER"}, headers=owner_hdr)

    # 2. Add top-level comment
    c1_res = client.post(f'/api/documents/{doc_id}/comments', json={"content": "Should we use dark mode by default?"}, headers=commenter_hdr)
    assert c1_res.status_code == 201
    c1 = c1_res.get_json()["comment"]
    c1_id = c1["id"]

    # 3. Add threaded reply
    r1_res = client.post(f'/api/documents/{doc_id}/comments', json={"content": "Yes, dark mode looks modern!", "parent_id": c1_id}, headers=owner_hdr)
    assert r1_res.status_code == 201

    # 4. List comments with thread structure
    list_res = client.get(f'/api/documents/{doc_id}/comments', headers=commenter_hdr)
    assert list_res.status_code == 200
    comments = list_res.get_json()["comments"]
    assert len(comments) == 1
    assert len(comments[0]["replies"]) == 1

    # 5. Resolve comment
    res_res = client.put(f'/api/comments/{c1_id}/resolve', json={"resolved": True}, headers=owner_hdr)
    assert res_res.status_code == 200
    assert res_res.get_json()["comment"]["resolved"] is True

    # 6. Delete comment permission test: other user cannot delete commenter's comment
    del_fail = client.delete(f'/api/comments/{c1_id}', headers=other_hdr)
    assert del_fail.status_code == 403

    # Commenter can delete own comment
    del_ok = client.delete(f'/api/comments/{c1_id}', headers=commenter_hdr)
    assert del_ok.status_code == 200
