from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Permission = Literal["read_only", "workspace_write"]


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    role: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    permission: Permission = "read_only"


class PositionUpdate(BaseModel):
    x: int = Field(ge=0, lt=24)
    y: int = Field(ge=0, lt=16)


class SkillAssignment(BaseModel):
    skill_id: str


class PluginAssignment(BaseModel):
    plugin_id: str


class TaskCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    access_mode: Permission = "read_only"


class ApprovalDecision(BaseModel):
    approved: bool


class InteractionCreate(BaseModel):
    target_agent_id: str
    summary: str = Field(min_length=3, max_length=500)
    kind: Literal["delegation", "review_request", "context_share", "help_request", "completion", "error"] = "context_share"
