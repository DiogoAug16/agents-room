from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .codex_provider import CodexAgentProvider
from .database import Base, SessionLocal, engine, get_session
from .events import emit, manager, replay
from .models import Agent, AgentInteraction, AgentPlugin, AgentSkill, Approval, Plugin, Skill, Task, Workspace, Workstation, now
from .schemas import AgentCreate, ApprovalDecision, InteractionCreate, PluginAssignment, PositionUpdate, SkillAssignment, TaskCreate

ROOT = Path(__file__).resolve().parents[2]
ACTIVE_TASK_STATES = ("created", "queued", "starting", "running", "waiting_approval", "cancelling")
task_semaphore = asyncio.Semaphore(3)
active_providers: dict[str, CodexAgentProvider] = {}
write_locks: dict[str, asyncio.Lock] = {}


def write_lock_for(project_root: str) -> asyncio.Lock:
    return write_locks.setdefault(project_root, asyncio.Lock())


def agent_payload(agent: Agent) -> dict:
    return {"id": agent.id, "name": agent.name, "role": agent.role, "description": agent.description, "appearance": agent.appearance, "visualStatus": agent.visual_status, "position": {"x": agent.current_x, "y": agent.current_y}, "basePosition": {"x": agent.base_x, "y": agent.base_y}, "direction": agent.direction, "permission": agent.permission, "skills": [{"id": link.skill.id, "name": link.skill.name, "enabled": link.enabled} for link in agent.skills], "plugins": [{"id": link.plugin.id, "name": link.plugin.name, "enabled": link.enabled} for link in agent.plugins]}


def seed(session: Session) -> Workspace:
    workspace = session.scalar(select(Workspace).limit(1))
    if workspace:
        if not session.get(Plugin, "codex-local"):
            session.add(Plugin(id="codex-local", name="Codex Local", description="Sessões Codex locais para agentes.", manifest={"permissions": ["read_only", "workspace_write"]}))
            session.commit()
        return workspace
    workspace = Workspace(name="Agents Room", project_root=str(ROOT), settings={"max_agents": 8, "max_parallel_tasks": 3})
    session.add(workspace)
    session.add_all([Skill(id="fastapi", name="FastAPI", description="APIs locais tipadas", category="Backend"), Skill(id="testing", name="Testes", description="Testes e regressões", category="Qualidade"), Skill(id="ui", name="Interface", description="Fluxos React e acessibilidade", category="Frontend"), Plugin(id="codex-local", name="Codex Local", description="Sessões Codex locais para agentes.", manifest={"permissions": ["read_only", "workspace_write"]})])
    session.flush()
    for index, (name, role, description, x, y) in enumerate((
        ("Ana", "Engenharia", "Implementa e revisa serviços.", 8, 6),
        ("Bruno", "Qualidade", "Cria testes e avalia mudanças.", 14, 8),
    )):
        agent = Agent(workspace_id=workspace.id, name=name, role=role, description=description, appearance={"characterPreset": f"agent-{index + 1:03}"}, visual_status="working" if index == 0 else "seated", base_x=x, base_y=y, current_x=x, current_y=y)
        session.add(agent); session.flush()
        session.add(Workstation(workspace_id=workspace.id, agent_id=agent.id, x=x, y=y, interaction_points=[{"x": x, "y": y - 1}]))
    session.commit()
    return workspace


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    seed(session)
    session.close()
    yield


app = FastAPI(title="Agents Room", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "codexAvailable": CodexAgentProvider(ROOT).is_available()}


@app.get("/workspaces/default")
def get_workspace(session: Session = Depends(get_session)) -> dict:
    workspace = seed(session)
    return {"id": workspace.id, "name": workspace.name, "room": {"width": workspace.room_width, "height": workspace.room_height}, "projectRoot": workspace.project_root}


@app.get("/workspaces/{workspace_id}/agents")
def list_agents(workspace_id: str, session: Session = Depends(get_session)) -> list[dict]:
    agents = session.scalars(select(Agent).options(joinedload(Agent.skills).joinedload(AgentSkill.skill), joinedload(Agent.plugins).joinedload(AgentPlugin.plugin)).where(Agent.workspace_id == workspace_id)).unique().all()
    return [agent_payload(agent) for agent in agents]


@app.post("/workspaces/{workspace_id}/agents", status_code=201)
async def create_agent(workspace_id: str, body: AgentCreate, session: Session = Depends(get_session)) -> dict:
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    count = len(session.scalars(select(Agent.id).where(Agent.workspace_id == workspace_id)).all())
    if count >= 8:
        raise HTTPException(409, "A workspace supports at most eight agents")
    x, y = 5 + count * 2, 10
    agent = Agent(workspace_id=workspace_id, name=body.name, role=body.role, description=body.description, permission=body.permission, appearance={"characterPreset": f"agent-{count + 1:03}"}, base_x=x, base_y=y, current_x=x, current_y=y)
    session.add(agent); session.flush()
    session.add(Workstation(workspace_id=workspace_id, agent_id=agent.id, x=x, y=y, interaction_points=[{"x": x, "y": y - 1}]))
    session.commit(); session.refresh(agent)
    payload = agent_payload(agent)
    await emit(session, workspace_id, "agent.created", source_agent_id=agent.id, payload=payload)
    return payload


@app.patch("/agents/{agent_id}/position")
async def update_position(agent_id: str, body: PositionUpdate, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    agent.current_x = agent.base_x = body.x; agent.current_y = agent.base_y = body.y
    if agent.workstation: agent.workstation.x = body.x; agent.workstation.y = body.y
    session.commit()
    payload = {"x": body.x, "y": body.y}
    await emit(session, agent.workspace_id, "agent.position.changed", source_agent_id=agent.id, payload=payload)
    return payload


@app.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, session: Session = Depends(get_session)) -> None:
    agent = session.get(Agent, agent_id)
    if not agent: raise HTTPException(404, "Agent not found")
    workspace_id = agent.workspace_id
    session.delete(agent); session.commit()
    await emit(session, workspace_id, "agent.deleted", source_agent_id=agent_id)


@app.get("/skills")
def list_skills(session: Session = Depends(get_session)) -> list[dict]:
    return [{"id": skill.id, "name": skill.name, "description": skill.description, "category": skill.category, "manifest": skill.manifest} for skill in session.scalars(select(Skill).order_by(Skill.name)).all()]


@app.post("/agents/{agent_id}/skills", status_code=201)
async def assign_skill(agent_id: str, body: SkillAssignment, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id); skill = session.get(Skill, body.skill_id)
    if not agent or not skill: raise HTTPException(404, "Agent or skill not found")
    if session.scalar(select(AgentSkill).where(AgentSkill.agent_id == agent_id, AgentSkill.skill_id == body.skill_id)):
        raise HTTPException(409, "Skill already assigned")
    session.add(AgentSkill(agent_id=agent_id, skill_id=body.skill_id)); session.commit()
    payload = {"skillId": skill.id, "name": skill.name}
    await emit(session, agent.workspace_id, "skill.assigned", source_agent_id=agent_id, payload=payload)
    return payload


@app.get("/plugins")
def list_plugins(session: Session = Depends(get_session)) -> list[dict]:
    return [{"id": plugin.id, "name": plugin.name, "description": plugin.description, "manifest": plugin.manifest} for plugin in session.scalars(select(Plugin).order_by(Plugin.name)).all()]


@app.post("/agents/{agent_id}/plugins", status_code=201)
async def assign_plugin(agent_id: str, body: PluginAssignment, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id); plugin = session.get(Plugin, body.plugin_id)
    if not agent or not plugin: raise HTTPException(404, "Agent or plugin not found")
    if session.scalar(select(AgentPlugin).where(AgentPlugin.agent_id == agent_id, AgentPlugin.plugin_id == body.plugin_id)): raise HTTPException(409, "Plugin already assigned")
    session.add(AgentPlugin(agent_id=agent_id, plugin_id=plugin.id)); session.commit()
    payload = {"pluginId": plugin.id, "name": plugin.name}
    await emit(session, agent.workspace_id, "plugin.assigned", source_agent_id=agent.id, payload=payload)
    return payload


async def execute_task(task_id: str) -> None:
    async with task_semaphore:
        session = SessionLocal()
        task = session.get(Task, task_id)
        if not task or task.state == "cancelled": session.close(); return
        workspace = session.get(Workspace, task.workspace_id)
        write_lock = write_lock_for(workspace.project_root) if task.access_mode == "workspace_write" else None
        if write_lock: await write_lock.acquire()
        try:
            task.state = "running"; task.agent.visual_status = "working"; session.commit()
            await emit(session, task.workspace_id, "task.started", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": "Codex iniciou a tarefa."})
            provider = CodexAgentProvider(ROOT)
            active_providers[task.id] = provider
            events = await asyncio.to_thread(lambda: list(provider.run(task.prompt, task.access_mode)))
            task = session.get(Task, task_id)
            if task and task.state != "cancelled":
                task.state = "succeeded"; task.result = "Concluída pelo Codex."; task.finished_at = now(); task.agent.visual_status = "completed"; session.commit()
                for provider_event in events:
                    await emit(session, task.workspace_id, "task.progress", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": provider_event.summary, "providerEvent": provider_event.type})
                await emit(session, task.workspace_id, "task.completed", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": task.result})
        except Exception:
            task = session.get(Task, task_id)
            if task and task.state != "cancelled":
                task.state = "failed"; task.result = "A execução local do Codex falhou."; task.finished_at = now(); task.agent.visual_status = "error"; session.commit()
                await emit(session, task.workspace_id, "task.failed", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": task.result})
        finally:
            active_providers.pop(task_id, None)
            if write_lock and write_lock.locked(): write_lock.release()
            session.close()


@app.post("/agents/{agent_id}/tasks", status_code=202)
async def create_task(agent_id: str, body: TaskCreate, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id)
    if not agent: raise HTTPException(404, "Agent not found")
    if session.scalar(select(Task).where(Task.agent_id == agent_id, Task.state.in_(ACTIVE_TASK_STATES))): raise HTTPException(409, "Agent already has an active task")
    requires_approval = body.access_mode == "workspace_write"
    task = Task(workspace_id=agent.workspace_id, agent_id=agent.id, prompt=body.prompt, access_mode=body.access_mode, state="waiting_approval" if requires_approval else "queued")
    agent.visual_status = "waiting_approval" if requires_approval else "queued"; session.add(task); session.flush()
    approval = Approval(task_id=task.id, kind="workspace_write", summary="A tarefa pode modificar arquivos dentro do workspace selecionado.") if requires_approval else None
    if approval: session.add(approval)
    session.commit(); session.refresh(task)
    await emit(session, agent.workspace_id, "task.created", source_agent_id=agent.id, task_id=task.id, payload={"summary": "Tarefa adicionada à fila."})
    if approval: await emit(session, agent.workspace_id, "task.approval.requested", source_agent_id=agent.id, task_id=task.id, payload={"approvalId": approval.id, "summary": approval.summary})
    else: asyncio.create_task(execute_task(task.id))
    return {"id": task.id, "state": task.state}


@app.get("/workspaces/{workspace_id}/approvals")
def list_approvals(workspace_id: str, session: Session = Depends(get_session)) -> list[dict]:
    approvals = session.scalars(select(Approval).join(Task).where(Task.workspace_id == workspace_id, Approval.state == "pending")).all()
    return [{"id": approval.id, "taskId": approval.task_id, "kind": approval.kind, "summary": approval.summary} for approval in approvals]


@app.post("/approvals/{approval_id}/decision")
async def decide_approval(approval_id: str, body: ApprovalDecision, session: Session = Depends(get_session)) -> dict:
    approval = session.get(Approval, approval_id)
    if not approval: raise HTTPException(404, "Approval not found")
    task = session.get(Task, approval.task_id)
    if approval.state != "pending": return {"id": approval.id, "state": approval.state}
    approval.state = "approved" if body.approved else "rejected"; approval.decided_at = now()
    task.state = "queued" if body.approved else "cancelled"; task.agent.visual_status = "queued" if body.approved else "idle"
    if not body.approved: task.finished_at = now()
    session.commit()
    await emit(session, task.workspace_id, "approval.decided", source_agent_id=task.agent_id, task_id=task.id, payload={"approvalId": approval.id, "approved": body.approved, "summary": "Ação aprovada." if body.approved else "Ação rejeitada."})
    if body.approved: asyncio.create_task(execute_task(task.id))
    else: await emit(session, task.workspace_id, "task.cancelled", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": "Tarefa rejeitada na aprovação."})
    return {"id": approval.id, "state": approval.state}


@app.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, session: Session = Depends(get_session)) -> dict:
    task = session.get(Task, task_id)
    if not task: raise HTTPException(404, "Task not found")
    if task.state in ("cancelled", "succeeded", "failed"): return {"id": task.id, "state": task.state}
    provider = active_providers.get(task.id)
    if provider: provider.cancel()
    task.state = "cancelled"; task.finished_at = now(); task.agent.visual_status = "idle"; session.commit()
    await emit(session, task.workspace_id, "task.cancelled", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": "Tarefa cancelada."})
    return {"id": task.id, "state": task.state}


@app.post("/agents/{agent_id}/interactions", status_code=201)
async def request_interaction(agent_id: str, body: InteractionCreate, session: Session = Depends(get_session)) -> dict:
    source = session.get(Agent, agent_id); target = session.get(Agent, body.target_agent_id)
    if not source or not target: raise HTTPException(404, "Agent not found")
    if source.workspace_id != target.workspace_id or source.id == target.id: raise HTTPException(409, "Agents must be different and in the same workspace")
    busy = session.scalar(select(AgentInteraction).where(AgentInteraction.state.in_(("requested", "started")), (AgentInteraction.source_agent_id.in_((source.id, target.id))) | (AgentInteraction.target_agent_id.in_((source.id, target.id)))))
    if busy: raise HTTPException(409, "An agent already has an active interaction")
    interaction = AgentInteraction(workspace_id=source.workspace_id, source_agent_id=source.id, target_agent_id=target.id, kind=body.kind, summary=body.summary)
    session.add(interaction); session.commit(); session.refresh(interaction)
    payload = {"interactionId": interaction.id, "kind": interaction.kind, "summary": interaction.summary}
    await emit(session, source.workspace_id, "agent.interaction.requested", source_agent_id=source.id, target_agent_id=target.id, payload=payload)
    return {"id": interaction.id, "state": interaction.state}


@app.post("/interactions/{interaction_id}/started")
async def start_interaction(interaction_id: str, session: Session = Depends(get_session)) -> dict:
    interaction = session.get(AgentInteraction, interaction_id)
    if not interaction: raise HTTPException(404, "Interaction not found")
    if interaction.state == "requested": interaction.state = "started"; session.commit()
    payload = {"interactionId": interaction.id, "kind": interaction.kind, "summary": interaction.summary}
    await emit(session, interaction.workspace_id, "agent.interaction.started", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    await emit(session, interaction.workspace_id, "agent.interaction.message", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    return {"id": interaction.id, "state": interaction.state}


@app.post("/interactions/{interaction_id}/completed")
async def complete_interaction(interaction_id: str, session: Session = Depends(get_session)) -> dict:
    interaction = session.get(AgentInteraction, interaction_id)
    if not interaction: raise HTTPException(404, "Interaction not found")
    if interaction.state != "completed": interaction.state = "completed"; interaction.completed_at = now(); session.commit()
    payload = {"interactionId": interaction.id, "summary": interaction.summary}
    await emit(session, interaction.workspace_id, "agent.interaction.completed", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    return {"id": interaction.id, "state": interaction.state}


@app.post("/interactions/{interaction_id}/failed")
async def fail_interaction(interaction_id: str, session: Session = Depends(get_session)) -> dict:
    interaction = session.get(AgentInteraction, interaction_id)
    if not interaction: raise HTTPException(404, "Interaction not found")
    if interaction.state != "completed": interaction.state = "failed"; interaction.completed_at = now(); session.commit()
    payload = {"interactionId": interaction.id, "summary": "Não foi possível encontrar uma rota para a interação."}
    await emit(session, interaction.workspace_id, "agent.interaction.completed", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    return {"id": interaction.id, "state": interaction.state}


@app.websocket("/ws/workspaces/{workspace_id}")
async def workspace_events(socket: WebSocket, workspace_id: str, after: int = 0) -> None:
    await manager.connect(workspace_id, socket)
    session = SessionLocal()
    try:
        for event in await replay(session, workspace_id, after): await socket.send_json(event)
        while True: await socket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(workspace_id, socket); session.close()
