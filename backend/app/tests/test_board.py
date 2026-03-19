import pytest

pytestmark = pytest.mark.asyncio


async def test_board_operations(client):
    resp = await client.post("/api/projects", json={"name": "Board Test"})
    project_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/backlog", json={
        "title": "Board Task", "priority": "P0", "story_points": 5,
    })
    item_id = resp.json()["id"]

    resp = await client.post(f"/api/projects/{project_id}/sprints", json={"goal": "Board"})
    sprint_id = resp.json()["id"]

    resp = await client.post(f"/api/sprints/{sprint_id}/items", json={
        "backlog_item_id": item_id, "assignee_role": "FE",
    })
    si_id = resp.json()["id"]

    resp = await client.get(f"/api/sprints/{sprint_id}/board")
    assert resp.status_code == 200
    board = resp.json()
    assert len(board["todo"]) == 1
    assert board["todo"][0]["title"] == "Board Task"

    resp = await client.put(f"/api/board/items/{si_id}/move", json={
        "board_status": "in_progress", "order": 0,
    })
    assert resp.status_code == 200

    resp = await client.get(f"/api/sprints/{sprint_id}/board")
    board = resp.json()
    assert len(board["todo"]) == 0
    assert len(board["in_progress"]) == 1

    resp = await client.put(f"/api/board/items/{si_id}/move", json={
        "board_status": "invalid", "order": 0,
    })
    assert resp.status_code == 400
