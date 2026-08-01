"""Scenario eval for delegation limits and cascade cancellation."""

import os
import tempfile
from pathlib import Path

database = Path(tempfile.gettempdir()) / "agents-room-delegation-eval.db"
if database.exists():
    database.unlink()
os.environ["AGENTS_ROOM_DATABASE_URL"] = f"sqlite:///{database}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


with TestClient(app) as client:
    workspace = client.get("/workspaces/default").json()
    agents = client.get(f"/workspaces/{workspace['id']}/agents").json()
    agents.extend(client.post(f"/workspaces/{workspace['id']}/agents", json={"name": name, "role": "Avaliação"}).json() for name in ("Cris", "Dani"))
    parent = client.post(f"/agents/{agents[0]['id']}/tasks", json={"prompt": "coordene", "access_mode": "workspace_write"}).json()
    child = client.post(f"/tasks/{parent['id']}/delegations", json={"target_agent_id": agents[1]["id"], "prompt": "revise", "summary": "Delegando revisão."}).json()
    grandchild = client.post(f"/tasks/{child['id']}/delegations", json={"target_agent_id": agents[2]["id"], "prompt": "teste", "summary": "Delegando testes."}).json()
    blocked = client.post(f"/tasks/{grandchild['id']}/delegations", json={"target_agent_id": agents[3]["id"], "prompt": "documente", "summary": "Delegando documentação."})
    assert blocked.status_code == 409
    assert client.post(f"/tasks/{parent['id']}/cancel").status_code == 200
    assert client.get(f"/agents/{agents[2]['id']}/tasks").json()[0]["state"] == "cancelled"

print("PASS: delegation depth limit and cascade cancellation")
