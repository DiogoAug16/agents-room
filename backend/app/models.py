from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120))
    project_root: Mapped[str] = mapped_column(String(2048))
    room_width: Mapped[int] = mapped_column(Integer, default=24)
    room_height: Mapped[int] = mapped_column(Integer, default=16)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    agents: Mapped[list["Agent"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    appearance: Mapped[dict] = mapped_column(JSON, default=dict)
    visual_status: Mapped[str] = mapped_column(String(32), default="idle")
    base_x: Mapped[int] = mapped_column(Integer)
    base_y: Mapped[int] = mapped_column(Integer)
    current_x: Mapped[int] = mapped_column(Integer)
    current_y: Mapped[int] = mapped_column(Integer)
    direction: Mapped[str] = mapped_column(String(8), default="south")
    permission: Mapped[str] = mapped_column(String(32), default="read_only")
    workspace: Mapped[Workspace] = relationship(back_populates="agents")
    workstation: Mapped["Workstation"] = relationship(back_populates="agent", cascade="all, delete-orphan", uselist=False)
    skills: Mapped[list["AgentSkill"]] = relationship(back_populates="agent", cascade="all, delete-orphan")
    plugins: Mapped[list["AgentPlugin"]] = relationship(back_populates="agent", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class Workstation(Base):
    __tablename__ = "workstations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), unique=True)
    x: Mapped[int] = mapped_column(Integer)
    y: Mapped[int] = mapped_column(Integer)
    orientation: Mapped[str] = mapped_column(String(8), default="south")
    interaction_points: Mapped[list] = mapped_column(JSON, default=list)
    agent: Mapped[Agent] = relationship(back_populates="workstation")


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80))
    manifest: Mapped[dict] = mapped_column(JSON, default=dict)


class AgentSkill(Base):
    __tablename__ = "agent_skills"
    __table_args__ = (UniqueConstraint("agent_id", "skill_id", name="uq_agent_skill"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    agent: Mapped[Agent] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship()


class Plugin(Base):
    __tablename__ = "plugins"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)
    manifest: Mapped[dict] = mapped_column(JSON, default=dict)


class AgentPlugin(Base):
    __tablename__ = "agent_plugins"
    __table_args__ = (UniqueConstraint("agent_id", "plugin_id", name="uq_agent_plugin"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    plugin_id: Mapped[str] = mapped_column(ForeignKey("plugins.id"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    agent: Mapped[Agent] = relationship(back_populates="plugins")
    plugin: Mapped[Plugin] = relationship()


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(32), default="created", index=True)
    access_mode: Mapped[str] = mapped_column(String(32), default="read_only")
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    agent: Mapped[Agent] = relationship(back_populates="tasks")


class AgentInteraction(Base):
    __tablename__ = "agent_interactions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    source_agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    target_agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(64), default="context_share")
    summary: Mapped[str] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(32), default="requested", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkspaceEvent(Base):
    __tablename__ = "workspace_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(100))
    source_agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    target_agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
