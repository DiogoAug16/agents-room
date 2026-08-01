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
from .models import Agent, AgentInteraction, AgentPlugin, AgentSession, AgentSkill, Approval, Plugin, Skill, Task, Workspace, Workstation, now
from .schemas import AgentCreate, ApprovalDecision, DelegationCreate, InteractionCreate, PluginAssignment, PluginEnabledUpdate, PositionUpdate, SkillAssignment, SkillEnabledUpdate, TaskCreate
from .workspace_metadata import current_git_branch

ROOT = Path(__file__).resolve().parents[2]
ACTIVE_TASK_STATES = ("created", "queued", "starting", "running", "waiting_approval", "cancelling")
task_semaphore = asyncio.Semaphore(3)
active_providers: dict[str, CodexAgentProvider] = {}
write_locks: dict[str, asyncio.Lock] = {}
WORKSTATION_CELLS = ((5, 23), (11, 23), (11, 13), (5, 13), (11, 10), (21, 5), (22, 12), (32, 21))
FURNITURE_CELLS = frozenset()
MAX_DELEGATION_DEPTH = 2
MAX_SUBTASKS_PER_TASK = 4
TASK_TIMEOUT_SECONDS = 600
SKILL_CATALOG = (
    {"id": "fastapi", "name": "FastAPI", "description": "APIs locais tipadas", "category": "Backend", "manifest": {"version": "1.0.0", "tags": ["python", "api"], "compatibility": ["codex"], "recommendedPermission": "workspace_write", "dependencies": [], "instructions": "Implemente APIs FastAPI tipadas e teste os contratos."}},
    {"id": "testing", "name": "Testes", "description": "Testes e regressões", "category": "Qualidade", "manifest": {"version": "1.0.0", "tags": ["tests", "regression"], "compatibility": ["codex"], "recommendedPermission": "read_only", "dependencies": [], "instructions": "Crie testes determinísticos e valide regressões."}},
    {"id": "ui", "name": "Interface", "description": "Fluxos React e acessibilidade", "category": "Frontend", "manifest": {"version": "1.0.0", "tags": ["react", "accessibility"], "compatibility": ["codex"], "recommendedPermission": "workspace_write", "dependencies": [], "instructions": "Implemente fluxos React acessíveis e valide interação."}},
)
CODEX_PLUGIN_MANIFEST = {"version": "1.0.0", "skills": [item["id"] for item in SKILL_CATALOG], "integrations": ["codex-cli"], "apps": [], "mcpServers": [], "environment": [], "permissions": ["read_only", "workspace_write"]}


def write_lock_for(project_root: str) -> asyncio.Lock:
    return write_locks.setdefault(project_root, asyncio.Lock())


def interaction_points_for(x: int, y: int) -> list[dict[str, int]]:
    return [{"x": point_x, "y": point_y} for point_x, point_y in ((x, y - 1), (x + 1, y), (x - 1, y)) if 0 <= point_x < 40 and 0 <= point_y < 38]


def next_workstation(session: Session, workspace_id: str) -> tuple[int, int]:
    occupied = {(x, y) for x, y in session.execute(select(Agent.base_x, Agent.base_y).where(Agent.workspace_id == workspace_id)).tuples()}
    return next((cell for cell in WORKSTATION_CELLS if cell not in occupied), None)


def agent_payload(agent: Agent) -> dict:
    workstation = agent.workstation
    return {"id": agent.id, "name": agent.name, "role": agent.role, "description": agent.description, "appearance": agent.appearance, "visualStatus": agent.visual_status, "position": {"x": agent.current_x, "y": agent.current_y}, "basePosition": {"x": agent.base_x, "y": agent.base_y}, "direction": agent.direction, "permission": agent.permission, "sessionId": agent.session.external_session_id if agent.session else None, "workstation": {"position": {"x": workstation.x, "y": workstation.y}, "interactionPoints": workstation.interaction_points} if workstation else None, "skills": [{"id": link.skill.id, "name": link.skill.name, "enabled": link.enabled} for link in agent.skills], "plugins": [{"id": link.plugin.id, "name": link.plugin.name, "enabled": link.enabled} for link in agent.plugins]}


def task_payload(task: Task) -> dict:
    return {"id": task.id, "prompt": task.prompt, "state": task.state, "accessMode": task.access_mode, "parentTaskId": task.parent_task_id, "delegationDepth": task.delegation_depth, "result": task.result, "createdAt": task.created_at.isoformat(), "finishedAt": task.finished_at.isoformat() if task.finished_at else None}


def task_ancestors(session: Session, task: Task) -> list[Task]:
    ancestors: list[Task] = []
    seen: set[str] = set()
    current: Task | None = task
    while current:
        if current.id in seen:
            raise HTTPException(409, "Task delegation cycle detected")
        seen.add(current.id)
        ancestors.append(current)
        current = session.get(Task, current.parent_task_id) if current.parent_task_id else None
    return ancestors


def task_descendants(session: Session, root_id: str) -> list[Task]:
    pending = [root_id]
    seen = {root_id}
    descendants: list[Task] = []
    while pending:
        children = session.scalars(select(Task).where(Task.parent_task_id.in_(pending))).all()
        pending = [child.id for child in children if child.id not in seen]
        seen.update(pending)
        descendants.extend(child for child in children if child.id in pending)
    return descendants


def ensure_catalog(session: Session) -> None:
    for item in SKILL_CATALOG:
        skill = session.get(Skill, item["id"])
        if skill:
            skill.name = item["name"]; skill.description = item["description"]; skill.category = item["category"]; skill.manifest = item["manifest"]
        else:
            session.add(Skill(**item))
    plugin = session.get(Plugin, "codex-local")
    if plugin:
        plugin.name = "Codex Local"; plugin.description = "Sessões Codex locais para agentes."; plugin.manifest = CODEX_PLUGIN_MANIFEST
    else:
        session.add(Plugin(id="codex-local", name="Codex Local", description="Sessões Codex locais para agentes.", manifest=CODEX_PLUGIN_MANIFEST))
    session.commit()


def seed(session: Session) -> Workspace:
    workspace = session.scalar(select(Workspace).limit(1))
    if workspace:
        if workspace.settings.get("scene_layout_version") != 9:
            legacy_positions = {("Ana", 8, 6): (11, 23), ("Ana", 9, 12): (11, 23), ("Bruno", 14, 8): (11, 13), ("Bruno", 7, 4): (11, 13), ("Bruno", 9, 6): (11, 13), ("Bruno", 11, 1): (11, 13), ("Bruno", 10, 4): (11, 13), ("Joao", 3, 18): (5, 23)}
            agents = list(session.scalars(select(Agent).where(Agent.workspace_id == workspace.id)))
            occupied: set[tuple[int, int]] = set()
            for agent in agents:
                position = legacy_positions.get((agent.name, agent.base_x, agent.base_y))
                if not position and (agent.base_x, agent.base_y) not in WORKSTATION_CELLS:
                    position = next((cell for cell in WORKSTATION_CELLS if cell not in occupied), None)
                if not position:
                    occupied.add((agent.base_x, agent.base_y))
                    continue
                agent.base_x = agent.current_x = position[0]; agent.base_y = agent.current_y = position[1]
                if agent.workstation:
                    agent.workstation.x, agent.workstation.y = position
                    agent.workstation.interaction_points = interaction_points_for(*position)
                occupied.add(position)
            workspace.settings = {**workspace.settings, "scene_layout_version": 9}
            workspace.room_width, workspace.room_height = 40, 38
            session.commit()
        ensure_catalog(session)
        return workspace
    workspace = Workspace(name="Agents Room", project_root=str(ROOT), settings={"max_agents": 8, "max_parallel_tasks": 3, "cancel_delegations_on_parent_cancel": True})
    session.add(workspace)
    ensure_catalog(session)
    session.flush()
    for index, (name, role, description, x, y) in enumerate((
        ("Ana", "Engenharia", "Implementa e revisa serviços.", 11, 23),
        ("Bruno", "Qualidade", "Cria testes e avalia mudanças.", 11, 13),
    )):
        agent = Agent(workspace_id=workspace.id, name=name, role=role, description=description, appearance={"characterPreset": f"agent-{index + 1:03}"}, visual_status="working" if index == 0 else "seated", base_x=x, base_y=y, current_x=x, current_y=y)
        session.add(agent); session.flush()
        session.add(Workstation(workspace_id=workspace.id, agent_id=agent.id, x=x, y=y, interaction_points=interaction_points_for(x, y)))
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
    return {"id": workspace.id, "name": workspace.name, "room": {"width": workspace.room_width, "height": workspace.room_height}, "projectRoot": workspace.project_root, "gitBranch": current_git_branch(workspace.project_root)}


@app.get("/workspaces/{workspace_id}/agents")
def list_agents(workspace_id: str, session: Session = Depends(get_session)) -> list[dict]:
    agents = session.scalars(select(Agent).options(joinedload(Agent.skills).joinedload(AgentSkill.skill), joinedload(Agent.plugins).joinedload(AgentPlugin.plugin), joinedload(Agent.session)).where(Agent.workspace_id == workspace_id)).unique().all()
    return [agent_payload(agent) for agent in agents]


@app.post("/workspaces/{workspace_id}/agents", status_code=201)
async def create_agent(workspace_id: str, body: AgentCreate, session: Session = Depends(get_session)) -> dict:
    workspace = session.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    count = len(session.scalars(select(Agent.id).where(Agent.workspace_id == workspace_id)).all())
    if count >= 8:
        raise HTTPException(409, "A workspace supports at most eight agents")
    position = next_workstation(session, workspace_id)
    if not position:
        raise HTTPException(409, "No mapped workstation is available")
    x, y = position
    agent = Agent(workspace_id=workspace_id, name=body.name, role=body.role, description=body.description, permission=body.permission, appearance={"characterPreset": f"agent-{count + 1:03}"}, base_x=x, base_y=y, current_x=x, current_y=y)
    session.add(agent); session.flush()
    session.add(Workstation(workspace_id=workspace_id, agent_id=agent.id, x=x, y=y, interaction_points=interaction_points_for(x, y)))
    session.commit(); session.refresh(agent)
    payload = agent_payload(agent)
    await emit(session, workspace_id, "agent.created", source_agent_id=agent.id, payload=payload)
    return payload


@app.patch("/agents/{agent_id}/position")
async def update_position(agent_id: str, body: PositionUpdate, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    if (body.x, body.y) not in WORKSTATION_CELLS:
        raise HTTPException(409, "A workstation must use a mapped chair anchor")
    occupied = session.scalar(select(Agent).where(Agent.workspace_id == agent.workspace_id, Agent.current_x == body.x, Agent.current_y == body.y, Agent.id != agent.id))
    if occupied:
        raise HTTPException(409, "A cell cannot be occupied by two agents")
    agent.current_x = agent.base_x = body.x; agent.current_y = agent.base_y = body.y
    if agent.workstation:
        agent.workstation.x = body.x; agent.workstation.y = body.y; agent.workstation.interaction_points = interaction_points_for(body.x, body.y)
    session.commit()
    payload = {"x": body.x, "y": body.y, "workstation": {"position": {"x": body.x, "y": body.y}, "interactionPoints": interaction_points_for(body.x, body.y)}}
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


@app.delete("/agents/{agent_id}/skills/{skill_id}", status_code=204)
async def remove_skill(agent_id: str, skill_id: str, session: Session = Depends(get_session)) -> None:
    agent = session.get(Agent, agent_id)
    link = session.scalar(select(AgentSkill).where(AgentSkill.agent_id == agent_id, AgentSkill.skill_id == skill_id))
    if not agent or not link:
        raise HTTPException(404, "Agent skill not found")
    session.delete(link); session.commit()
    await emit(session, agent.workspace_id, "skill.removed", source_agent_id=agent_id, payload={"skillId": skill_id})


@app.patch("/agents/{agent_id}/skills/{skill_id}")
async def update_skill(agent_id: str, skill_id: str, body: SkillEnabledUpdate, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id)
    link = session.scalar(select(AgentSkill).where(AgentSkill.agent_id == agent_id, AgentSkill.skill_id == skill_id))
    if not agent or not link:
        raise HTTPException(404, "Agent skill not found")
    link.enabled = body.enabled; session.commit()
    payload = {"skillId": skill_id, "enabled": link.enabled}
    await emit(session, agent.workspace_id, "skill.updated", source_agent_id=agent_id, payload=payload)
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


@app.delete("/agents/{agent_id}/plugins/{plugin_id}", status_code=204)
async def remove_plugin(agent_id: str, plugin_id: str, session: Session = Depends(get_session)) -> None:
    agent = session.get(Agent, agent_id)
    link = session.scalar(select(AgentPlugin).where(AgentPlugin.agent_id == agent_id, AgentPlugin.plugin_id == plugin_id))
    if not agent or not link:
        raise HTTPException(404, "Agent plugin not found")
    session.delete(link); session.commit()
    await emit(session, agent.workspace_id, "plugin.removed", source_agent_id=agent_id, payload={"pluginId": plugin_id})


@app.patch("/agents/{agent_id}/plugins/{plugin_id}")
async def update_plugin(agent_id: str, plugin_id: str, body: PluginEnabledUpdate, session: Session = Depends(get_session)) -> dict:
    agent = session.get(Agent, agent_id)
    link = session.scalar(select(AgentPlugin).where(AgentPlugin.agent_id == agent_id, AgentPlugin.plugin_id == plugin_id))
    if not agent or not link:
        raise HTTPException(404, "Agent plugin not found")
    link.enabled = body.enabled; session.commit()
    payload = {"pluginId": plugin_id, "enabled": link.enabled}
    await emit(session, agent.workspace_id, "plugin.updated", source_agent_id=agent_id, payload=payload)
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
            agent_session = session.scalar(select(AgentSession).where(AgentSession.agent_id == task.agent_id))
            provider = CodexAgentProvider(Path(workspace.project_root))
            active_providers[task.id] = provider
            try:
                resume_id = agent_session.external_session_id if agent_session and agent_session.access_mode == task.access_mode else None
                events = await asyncio.wait_for(asyncio.to_thread(lambda: list(provider.run(task.prompt, task.access_mode, resume_id))), timeout=TASK_TIMEOUT_SECONDS)
            except TimeoutError:
                provider.cancel()
                raise RuntimeError("Codex task timed out")
            task = session.get(Task, task_id)
            if task and task.state != "cancelled":
                session_id = next((event.session_id for event in events if event.session_id), resume_id)
                if session_id:
                    agent_session = session.scalar(select(AgentSession).where(AgentSession.agent_id == task.agent_id))
                    if agent_session:
                        agent_session.external_session_id = session_id; agent_session.access_mode = task.access_mode; agent_session.last_resumed_at = now()
                    else:
                        session.add(AgentSession(agent_id=task.agent_id, provider="codex", external_session_id=session_id, access_mode=task.access_mode))
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


@app.get("/agents/{agent_id}/tasks")
def list_tasks(agent_id: str, session: Session = Depends(get_session)) -> list[dict]:
    if not session.get(Agent, agent_id): raise HTTPException(404, "Agent not found")
    return [task_payload(task) for task in session.scalars(select(Task).where(Task.agent_id == agent_id).order_by(Task.created_at.desc()).limit(12)).all()]


@app.post("/tasks/{task_id}/delegations", status_code=202)
async def delegate_task(task_id: str, body: DelegationCreate, session: Session = Depends(get_session)) -> dict:
    parent = session.get(Task, task_id)
    target = session.get(Agent, body.target_agent_id)
    if not parent or not target:
        raise HTTPException(404, "Task or target agent not found")
    if parent.state not in ACTIVE_TASK_STATES:
        raise HTTPException(409, "Only an active task can delegate")
    if target.workspace_id != parent.workspace_id or target.id == parent.agent_id:
        raise HTTPException(409, "Delegation target must be another agent in the same workspace")
    if session.scalar(select(Task).where(Task.agent_id == target.id, Task.state.in_(ACTIVE_TASK_STATES))):
        raise HTTPException(409, "Target agent already has an active task")
    ancestors = task_ancestors(session, parent)
    if target.id in {ancestor.agent_id for ancestor in ancestors}:
        raise HTTPException(409, "Delegation would create an agent cycle")
    if parent.delegation_depth >= MAX_DELEGATION_DEPTH:
        raise HTTPException(409, "Maximum delegation depth reached")
    if len(session.scalars(select(Task.id).where(Task.parent_task_id == parent.id)).all()) >= MAX_SUBTASKS_PER_TASK:
        raise HTTPException(409, "Maximum subtasks reached")
    requires_approval = parent.access_mode == "workspace_write"
    child = Task(workspace_id=parent.workspace_id, agent_id=target.id, parent_task_id=parent.id, delegation_depth=parent.delegation_depth + 1, prompt=body.prompt, access_mode=parent.access_mode, state="waiting_approval" if requires_approval else "queued")
    target.visual_status = "waiting_approval" if requires_approval else "queued"
    session.add(child); session.flush()
    interaction = AgentInteraction(workspace_id=parent.workspace_id, source_agent_id=parent.agent_id, target_agent_id=target.id, task_id=child.id, kind="delegation", summary=body.summary)
    session.add(interaction)
    approval = Approval(task_id=child.id, kind="workspace_write", summary="A subtarefa delegada pode modificar arquivos dentro do workspace selecionado.") if requires_approval else None
    if approval:
        session.add(approval)
    session.commit(); session.refresh(child)
    interaction_payload = {"interactionId": interaction.id, "kind": interaction.kind, "summary": interaction.summary, "taskId": child.id}
    await emit(session, parent.workspace_id, "agent.interaction.requested", source_agent_id=parent.agent_id, target_agent_id=target.id, task_id=parent.id, payload=interaction_payload)
    await emit(session, parent.workspace_id, "task.created", source_agent_id=target.id, task_id=child.id, payload={"summary": "Subtarefa delegada e aguardando interação.", "parentTaskId": parent.id, "delegationDepth": child.delegation_depth})
    if approval:
        await emit(session, parent.workspace_id, "task.approval.requested", source_agent_id=target.id, task_id=child.id, payload={"approvalId": approval.id, "summary": approval.summary})
    return {"id": child.id, "state": child.state, "interactionId": interaction.id, "parentTaskId": parent.id, "delegationDepth": child.delegation_depth}


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
    interaction = session.scalar(select(AgentInteraction).where(AgentInteraction.task_id == task.id, AgentInteraction.state.in_(("requested", "started"))))
    if body.approved and (not interaction or interaction.state == "started"): asyncio.create_task(execute_task(task.id))
    else: await emit(session, task.workspace_id, "task.cancelled", source_agent_id=task.agent_id, task_id=task.id, payload={"summary": "Tarefa rejeitada na aprovação."})
    return {"id": approval.id, "state": approval.state}


@app.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, session: Session = Depends(get_session)) -> dict:
    task = session.get(Task, task_id)
    if not task: raise HTTPException(404, "Task not found")
    if task.state in ("cancelled", "succeeded", "failed"): return {"id": task.id, "state": task.state}
    workspace = session.get(Workspace, task.workspace_id)
    cancelled = [task]
    if workspace.settings.get("cancel_delegations_on_parent_cancel", True):
        cancelled.extend(task_descendants(session, task.id))
    active = [item for item in cancelled if item.state not in ("cancelled", "succeeded", "failed")]
    for item in active:
        provider = active_providers.get(item.id)
        if provider: provider.cancel()
        item.state = "cancelled"; item.finished_at = now(); item.agent.visual_status = "idle"
        approval = session.scalar(select(Approval).where(Approval.task_id == item.id, Approval.state == "pending"))
        if approval: approval.state = "cancelled"; approval.decided_at = now()
    session.commit()
    for item in active:
        await emit(session, item.workspace_id, "task.cancelled", source_agent_id=item.agent_id, task_id=item.id, payload={"summary": "Tarefa cancelada." if item.id == task.id else "Subtarefa cancelada em cascata.", "parentTaskId": item.parent_task_id})
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
    if interaction.state not in ("requested", "started"):
        return {"id": interaction.id, "state": interaction.state}
    should_start_task = interaction.state == "requested"
    if should_start_task: interaction.state = "started"; session.commit()
    payload = {"interactionId": interaction.id, "kind": interaction.kind, "summary": interaction.summary}
    await emit(session, interaction.workspace_id, "agent.interaction.started", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    await emit(session, interaction.workspace_id, "agent.interaction.message", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    child = session.get(Task, interaction.task_id) if should_start_task and interaction.task_id else None
    if child and child.state == "queued": asyncio.create_task(execute_task(child.id))
    return {"id": interaction.id, "state": interaction.state}


@app.post("/interactions/{interaction_id}/completed")
async def complete_interaction(interaction_id: str, session: Session = Depends(get_session)) -> dict:
    interaction = session.get(AgentInteraction, interaction_id)
    if not interaction: raise HTTPException(404, "Interaction not found")
    if interaction.state == "failed":
        return {"id": interaction.id, "state": interaction.state}
    if interaction.state != "completed": interaction.state = "completed"; interaction.completed_at = now(); session.commit()
    payload = {"interactionId": interaction.id, "summary": interaction.summary}
    await emit(session, interaction.workspace_id, "agent.interaction.completed", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    return {"id": interaction.id, "state": interaction.state}


@app.post("/interactions/{interaction_id}/failed")
async def fail_interaction(interaction_id: str, session: Session = Depends(get_session)) -> dict:
    interaction = session.get(AgentInteraction, interaction_id)
    if not interaction: raise HTTPException(404, "Interaction not found")
    child = session.get(Task, interaction.task_id) if interaction.task_id else None
    cancelled_child = child and child.state not in ("cancelled", "succeeded", "failed")
    if interaction.state != "completed": interaction.state = "failed"; interaction.completed_at = now()
    if cancelled_child: child.state = "cancelled"; child.finished_at = now(); child.agent.visual_status = "idle"
    session.commit()
    payload = {"interactionId": interaction.id, "summary": "Não foi possível encontrar uma rota para a interação."}
    await emit(session, interaction.workspace_id, "agent.interaction.completed", source_agent_id=interaction.source_agent_id, target_agent_id=interaction.target_agent_id, payload=payload)
    if cancelled_child: await emit(session, child.workspace_id, "task.cancelled", source_agent_id=child.agent_id, task_id=child.id, payload={"summary": "Subtarefa cancelada porque a interação não encontrou rota."})
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
