import os
import tempfile
import unittest
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / "agents-room-api-test.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["AGENTS_ROOM_DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.client.__enter__()
        self.workspace = self.client.get("/workspaces/default").json()

    def tearDown(self) -> None:
        self.client.__exit__(None, None, None)

    def test_creates_agent_assigns_skill_and_streams_event(self) -> None:
        workspace_id = self.workspace["id"]
        with self.client.websocket_connect(f"/ws/workspaces/{workspace_id}") as socket:
            response = self.client.post(f"/workspaces/{workspace_id}/agents", json={"name": "Clara", "role": "Revisão"})
            self.assertEqual(response.status_code, 201)
            agent = response.json()
            for _ in range(20):
                event = socket.receive_json()
                if event["type"] == "agent.created":
                    break
            else:
                self.fail("Agent creation event was not emitted")
            self.assertEqual(event["type"], "agent.created")
            self.assertEqual(event["sourceAgentId"], agent["id"])
        assigned = self.client.post(f"/agents/{agent['id']}/skills", json={"skill_id": "testing"})
        self.assertEqual(assigned.status_code, 201)
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/skills", json={"skill_id": "testing"}).status_code, 409)

    def test_persists_a_station_move(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.post(f"/workspaces/{workspace_id}/agents", json={"name": "Lia", "role": "Backend"}).json()
        self.assertEqual(self.client.patch(f"/agents/{agent['id']}/position", json={"x": 9, "y": 7}).json(), {"x": 9, "y": 7})
        listed = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        self.assertEqual(next(item for item in listed if item["id"] == agent["id"])["basePosition"], {"x": 9, "y": 7})

    def test_persists_interaction_and_emits_requested_event(self) -> None:
        workspace_id = self.workspace["id"]
        agents = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        with self.client.websocket_connect(f"/ws/workspaces/{workspace_id}") as socket:
            response = self.client.post(f"/agents/{agents[0]['id']}/interactions", json={"target_agent_id": agents[1]["id"], "kind": "review_request", "summary": "Solicitando revisão da rota."})
            self.assertEqual(response.status_code, 201)
            for _ in range(20):
                event = socket.receive_json()
                if event["type"] == "agent.interaction.requested":
                    break
            else:
                self.fail("Interaction event was not emitted")
            self.assertEqual(event["type"], "agent.interaction.requested")
            self.assertEqual(event["payload"]["summary"], "Solicitando revisão da rota.")

    def test_assigns_plugin_once(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.get(f"/workspaces/{workspace_id}/agents").json()[0]
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/plugins", json={"plugin_id": "codex-local"}).status_code, 201)
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/plugins", json={"plugin_id": "codex-local"}).status_code, 409)

    def test_workspace_write_requires_and_records_rejection(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.get(f"/workspaces/{workspace_id}/agents").json()[1]
        task = self.client.post(f"/agents/{agent['id']}/tasks", json={"prompt": "crie um arquivo", "access_mode": "workspace_write"}).json()
        self.assertEqual(task["state"], "waiting_approval")
        approvals = self.client.get(f"/workspaces/{workspace_id}/approvals").json()
        self.assertEqual(len(approvals), 1)
        decision = self.client.post(f"/approvals/{approvals[0]['id']}/decision", json={"approved": False})
        self.assertEqual(decision.json()["state"], "rejected")


if __name__ == "__main__":
    unittest.main()
