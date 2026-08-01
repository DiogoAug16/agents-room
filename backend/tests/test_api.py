import os
import tempfile
import unittest
import asyncio
from pathlib import Path
from unittest.mock import patch

TEST_DB = Path(tempfile.gettempdir()) / "agents-room-api-test.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["AGENTS_ROOM_DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from fastapi.testclient import TestClient  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app, execute_task  # noqa: E402
from app.models import AgentSession, Task  # noqa: E402
from app.codex_provider import ProviderEvent  # noqa: E402


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
        moved = self.client.patch(f"/agents/{agent['id']}/position", json={"x": 21, "y": 5}).json()
        self.assertEqual(moved["workstation"], {"position": {"x": 21, "y": 5}, "interactionPoints": [{"x": 21, "y": 4}, {"x": 22, "y": 5}, {"x": 20, "y": 5}]})
        listed = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        refreshed = next(item for item in listed if item["id"] == agent["id"])
        self.assertEqual(refreshed["basePosition"], {"x": 21, "y": 5})
        self.assertEqual(refreshed["workstation"], moved["workstation"])

    def test_rejects_two_agents_in_the_same_cell(self) -> None:
        workspace_id = self.workspace["id"]
        agents = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        self.assertEqual(self.client.patch(f"/agents/{agents[1]['id']}/position", json=agents[0]["position"]).status_code, 409)

    def test_rejects_station_move_over_furniture(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.get(f"/workspaces/{workspace_id}/agents").json()[0]
        self.assertEqual(self.client.patch(f"/agents/{agent['id']}/position", json={"x": 8, "y": 5}).status_code, 409)
        self.assertEqual(self.client.patch(f"/agents/{agent['id']}/position", json={"x": 4, "y": 14}).status_code, 409)

    def test_persists_interaction_and_emits_requested_event(self) -> None:
        workspace_id = self.workspace["id"]
        agents = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        with self.client.websocket_connect(f"/ws/workspaces/{workspace_id}") as socket:
            response = self.client.post(f"/agents/{agents[0]['id']}/interactions", json={"target_agent_id": agents[1]["id"], "kind": "review_request", "summary": "Solicitando revisão da rota."})
            self.assertEqual(response.status_code, 201)
            for _ in range(20):
                event = socket.receive_json()
                if event["type"] == "agent.interaction.requested" and event["payload"].get("summary") == "Solicitando revisão da rota.":
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

    def test_returns_local_catalog_manifests(self) -> None:
        skills = self.client.get("/skills").json()
        fastapi = next(skill for skill in skills if skill["id"] == "fastapi")
        self.assertEqual(fastapi["manifest"]["recommendedPermission"], "workspace_write")
        plugin = self.client.get("/plugins").json()[0]
        self.assertEqual(plugin["manifest"]["integrations"], ["codex-cli"])
        self.assertEqual(plugin["manifest"]["skills"], ["fastapi", "testing", "ui"])

    def test_returns_the_agent_codex_session(self) -> None:
        agent = self.client.get(f"/workspaces/{self.workspace['id']}/agents").json()[0]
        session = SessionLocal()
        agent_session = session.query(AgentSession).filter_by(agent_id=agent["id"]).one_or_none()
        if agent_session:
            agent_session.external_session_id = "thread-123"
        else:
            session.add(AgentSession(agent_id=agent["id"], provider="codex", external_session_id="thread-123", access_mode="read_only"))
        session.commit(); session.close()
        refreshed = self.client.get(f"/workspaces/{self.workspace['id']}/agents").json()[0]
        self.assertEqual(refreshed["sessionId"], "thread-123")

    def test_persists_and_reuses_the_agent_codex_session(self) -> None:
        agent = self.client.get(f"/workspaces/{self.workspace['id']}/agents").json()[0]
        db = SessionLocal()
        first = Task(workspace_id=self.workspace["id"], agent_id=agent["id"], prompt="primeira", state="queued", access_mode="read_only")
        db.add(first); db.commit(); first_id = first.id; db.close()

        class FakeProvider:
            def __init__(self): self.session_ids: list[str | None] = []
            def run(self, _prompt, _access_mode, session_id=None):
                self.session_ids.append(session_id)
                yield ProviderEvent(type="thread.started", summary="Sessão Codex iniciada.", session_id="thread-456")
            def cancel(self): return True

        provider = FakeProvider()
        with patch("app.main.CodexAgentProvider", return_value=provider):
            asyncio.run(execute_task(first_id))
        db = SessionLocal()
        session = db.query(AgentSession).filter_by(agent_id=agent["id"]).one()
        self.assertEqual(session.external_session_id, "thread-456")
        second = Task(workspace_id=self.workspace["id"], agent_id=agent["id"], prompt="segunda", state="queued", access_mode="read_only")
        db.add(second); db.commit(); second_id = second.id; db.close()
        with patch("app.main.CodexAgentProvider", return_value=provider):
            asyncio.run(execute_task(second_id))
        self.assertEqual(provider.session_ids, [None, "thread-456"])

    def test_disables_an_assigned_plugin(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.post(f"/workspaces/{workspace_id}/agents", json={"name": "Dora", "role": "Produto"}).json()
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/plugins", json={"plugin_id": "codex-local"}).status_code, 201)
        self.assertEqual(self.client.patch(f"/agents/{agent['id']}/plugins/codex-local", json={"enabled": False}).json(), {"pluginId": "codex-local", "enabled": False})
        refreshed = next(item for item in self.client.get(f"/workspaces/{workspace_id}/agents").json() if item["id"] == agent["id"])
        self.assertEqual(refreshed["plugins"], [{"id": "codex-local", "name": "Codex Local", "enabled": False}])

    def test_removes_an_assigned_plugin(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.post(f"/workspaces/{workspace_id}/agents", json={"name": "Davi", "role": "Produto"}).json()
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/plugins", json={"plugin_id": "codex-local"}).status_code, 201)
        self.assertEqual(self.client.delete(f"/agents/{agent['id']}/plugins/codex-local").status_code, 204)
        refreshed = next(item for item in self.client.get(f"/workspaces/{workspace_id}/agents").json() if item["id"] == agent["id"])
        self.assertEqual(refreshed["plugins"], [])

    def test_removes_an_assigned_skill(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.get(f"/workspaces/{workspace_id}/agents").json()[0]
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/skills", json={"skill_id": "testing"}).status_code, 201)
        self.assertEqual(self.client.delete(f"/agents/{agent['id']}/skills/testing").status_code, 204)
        refreshed = self.client.get(f"/workspaces/{workspace_id}/agents").json()[0]
        self.assertNotIn("testing", [skill["id"] for skill in refreshed["skills"]])

    def test_disables_an_assigned_skill(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.get(f"/workspaces/{workspace_id}/agents").json()[0]
        self.assertEqual(self.client.post(f"/agents/{agent['id']}/skills", json={"skill_id": "ui"}).status_code, 201)
        self.assertEqual(self.client.patch(f"/agents/{agent['id']}/skills/ui", json={"enabled": False}).json(), {"skillId": "ui", "enabled": False})
        refreshed = self.client.get(f"/workspaces/{workspace_id}/agents").json()[0]
        self.assertEqual(refreshed["skills"], [{"id": "ui", "name": "Interface", "enabled": False}])

    def test_workspace_write_requires_and_records_rejection(self) -> None:
        workspace_id = self.workspace["id"]
        agent = self.client.get(f"/workspaces/{workspace_id}/agents").json()[1]
        task = self.client.post(f"/agents/{agent['id']}/tasks", json={"prompt": "crie um arquivo", "access_mode": "workspace_write"}).json()
        self.assertEqual(task["state"], "waiting_approval")
        approvals = self.client.get(f"/workspaces/{workspace_id}/approvals").json()
        approval = next(item for item in approvals if item["taskId"] == task["id"])
        decision = self.client.post(f"/approvals/{approval['id']}/decision", json={"approved": False})
        self.assertEqual(decision.json()["state"], "rejected")
        history = self.client.get(f"/agents/{agent['id']}/tasks").json()
        self.assertEqual(history[0]["state"], "cancelled")

    def test_delegation_links_tasks_starts_after_interaction_and_cascades_cancel(self) -> None:
        workspace_id = self.workspace["id"]
        agents = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        parent = self.client.post(f"/agents/{agents[0]['id']}/tasks", json={"prompt": "implemente a tarefa", "access_mode": "workspace_write"}).json()
        delegated = self.client.post(f"/tasks/{parent['id']}/delegations", json={"target_agent_id": agents[1]["id"], "prompt": "crie os testes", "summary": "Delegando a criação dos testes unitários."})
        self.assertEqual(delegated.status_code, 202)
        child = delegated.json()
        child_history = self.client.get(f"/agents/{agents[1]['id']}/tasks").json()[0]
        self.assertEqual(child_history["parentTaskId"], parent["id"])
        self.assertEqual(child_history["delegationDepth"], 1)
        self.assertEqual(child_history["state"], "waiting_approval")
        self.assertEqual(self.client.post(f"/interactions/{child['interactionId']}/started").status_code, 200)
        self.assertEqual(self.client.post(f"/interactions/{child['interactionId']}/completed").status_code, 200)
        cancelled = self.client.post(f"/tasks/{parent['id']}/cancel")
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(self.client.get(f"/agents/{agents[1]['id']}/tasks").json()[0]["state"], "cancelled")

    def test_delegation_rejects_agent_cycle(self) -> None:
        workspace_id = self.workspace["id"]
        agents = self.client.get(f"/workspaces/{workspace_id}/agents").json()
        parent = self.client.post(f"/agents/{agents[0]['id']}/tasks", json={"prompt": "coordene a tarefa", "access_mode": "workspace_write"}).json()
        first = self.client.post(f"/tasks/{parent['id']}/delegations", json={"target_agent_id": agents[1]["id"], "prompt": "revise", "summary": "Solicitando revisão."}).json()
        self.assertEqual(self.client.post(f"/tasks/{first['id']}/delegations", json={"target_agent_id": agents[0]["id"], "prompt": "retorne", "summary": "Retornando contexto."}).status_code, 409)
        self.client.post(f"/interactions/{first['interactionId']}/failed")
        self.client.post(f"/tasks/{parent['id']}/cancel")


if __name__ == "__main__":
    unittest.main()
