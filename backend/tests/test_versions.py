import pytest

def get_token(client, email):
    client.post('/api/auth/register', json={"name": email.split('@')[0], "email": email, "password": "Password123"})
    res = client.post('/api/auth/login', json={"email": email, "password": "Password123"})
    return res.get_json()["access_token"]

def test_version_history_and_restoration(client):
    token = get_token(client, "version_user@syncwrite.test")
    hdr = {"Authorization": f"Bearer {token}"}

    # 1. Create document
    doc_res = client.post('/api/documents', json={"title": "Versioned Document"}, headers=hdr)
    doc_id = doc_res.get_json()["document"]["id"]

    # 2. List initial versions
    v_res1 = client.get(f'/api/documents/{doc_id}/versions', headers=hdr)
    assert v_res1.status_code == 200
    versions1 = v_res1.get_json()["versions"]
    assert len(versions1) >= 1
    v1_id = versions1[0]["id"]

    # 3. Create manual version checkpoint
    chk_res = client.post(f'/api/documents/{doc_id}/versions', json={"version_type": "MANUAL"}, headers=hdr)
    assert chk_res.status_code == 201
    v2 = chk_res.get_json()["version"]
    assert v2["version_type"] == "MANUAL"
    assert v2["version_number"] == 2

    # 4. Restore v1
    res_res = client.post(f'/api/documents/{doc_id}/versions/{v1_id}/restore', headers=hdr)
    assert res_res.status_code == 200
    restored_info = res_res.get_json()["data"]
    assert restored_info["restored_version"]["version_type"] == "RESTORE"
    assert restored_info["restored_version"]["version_number"] == 3

    # 5. Verify complete audit trail remains intact
    v_res2 = client.get(f'/api/documents/{doc_id}/versions', headers=hdr)
    all_versions = v_res2.get_json()["versions"]
    assert len(all_versions) == 3
