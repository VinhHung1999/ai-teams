import pytest

pytestmark = pytest.mark.asyncio


async def test_create_and_list_backlog(client):
    resp = await client.post("/api/projects", json={"name": "Test Project"})
    assert resp.status_code == 200
    project_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/backlog", json={
        "title": "User authentication", "priority": "P0", "story_points": 5,
    })
    assert resp.status_code == 200
    item1_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/backlog", json={
        "title": "Dashboard UI", "priority": "P1", "story_points": 8,
    })
    assert resp.status_code == 200

    resp = await client.get(f"/api/projects/{project_id}/backlog")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    resp = await client.put(f"/api/backlog/{item1_id}", json={"priority": "P1"})
    assert resp.status_code == 200
    assert resp.json()["priority"] == "P1"

    resp = await client.delete(f"/api/backlog/{item1_id}")
    assert resp.status_code == 200


async def test_reorder_backlog(client):
    resp = await client.post("/api/projects", json={"name": "Reorder Test"})
    project_id = resp.json()["id"]

    ids = []
    for title in ["A", "B", "C"]:
        resp = await client.post(f"/api/projects/{project_id}/backlog", json={"title": title})
        ids.append(resp.json()["id"])

    resp = await client.put(
        f"/api/projects/{project_id}/backlog/reorder",
        json={"item_ids": [ids[2], ids[0], ids[1]]},
    )
    assert resp.status_code == 200

    resp = await client.get(f"/api/projects/{project_id}/backlog")
    items = resp.json()
    assert items[0]["title"] == "C"
    assert items[1]["title"] == "A"
    assert items[2]["title"] == "B"
