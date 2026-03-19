import pytest

pytestmark = pytest.mark.asyncio


async def test_sprint_lifecycle(client):
    resp = await client.post("/api/projects", json={"name": "Sprint Test"})
    project_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/backlog", json={
        "title": "Task 1", "priority": "P0", "story_points": 3,
    })
    item_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/sprints", json={"goal": "MVP"})
    assert resp.status_code == 200
    sprint = resp.json()
    assert sprint["number"] == 1
    assert sprint["status"] == "planning"
    sprint_id = sprint["id"]

    resp = await client.post(f"/api/sprints/{sprint_id}/items", json={
        "backlog_item_id": item_id, "assignee_role": "BE",
    })
    assert resp.status_code == 200

    resp = await client.put(f"/api/sprints/{sprint_id}/start")
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    resp = await client.put(f"/api/sprints/{sprint_id}/start")
    assert resp.status_code == 400

    resp = await client.put(f"/api/sprints/{sprint_id}/complete")
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


async def test_remove_item_from_sprint(client):
    resp = await client.post("/api/projects", json={"name": "Remove Test"})
    project_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/backlog", json={"title": "Task"})
    item_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/sprints", json={"goal": "Test"})
    sprint_id = resp.json()["id"]

    resp = await client.post(f"/api/sprints/{sprint_id}/items", json={"backlog_item_id": item_id})
    si_id = resp.json()["id"]

    resp = await client.delete(f"/api/sprints/{sprint_id}/items/{si_id}")
    assert resp.status_code == 200
