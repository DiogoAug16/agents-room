from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Permission = Literal["read_only", "workspace_write"]


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    role: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    permission: Permission = "read_only"


class PositionUpdate(BaseModel):
    x: int = Field(ge=0, lt=40)
    y: int = Field(ge=0, lt=42)


class ScenePosition(BaseModel):
    x: int = Field(ge=0, lt=40)
    y: int = Field(ge=0, lt=42)


class LocalOffset(BaseModel):
    x: int = Field(ge=-512, le=512)
    y: int = Field(ge=-512, le=512)


class FurnitureInstancePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=128)
    asset_id: str = Field(alias="assetId", min_length=1, max_length=128)
    position: ScenePosition
    orientation: Literal["north_east", "north_west", "south_east", "south_west"]
    created_at: str = Field(alias="createdAt", min_length=1, max_length=128)
    group_id: str | None = Field(default=None, alias="groupId", max_length=128)
    parent_id: str | None = Field(default=None, alias="parentId", max_length=128)
    surface_offset: LocalOffset | None = Field(default=None, alias="surfaceOffset")


class FurnitureGroupPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=128)
    instance_ids: list[str] = Field(alias="instanceIds", min_length=1, max_length=200)
    group_type: Literal["workstation", "lounge"] = Field(alias="groupType")


class OfficeLayoutUpdate(BaseModel):
    schema_version: Literal[4] = 4
    furniture_instances: list[FurnitureInstancePayload] = Field(default_factory=list, max_length=200)
    furniture_groups: list[FurnitureGroupPayload] = Field(default_factory=list, max_length=100)
    agent_seat_assignments: dict[str, str] = Field(default_factory=dict)


class SkillAssignment(BaseModel):
    skill_id: str


class SkillEnabledUpdate(BaseModel):
    enabled: bool


class PluginAssignment(BaseModel):
    plugin_id: str


class PluginEnabledUpdate(BaseModel):
    enabled: bool


class TaskCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    access_mode: Permission = "read_only"


class DelegationCreate(BaseModel):
    target_agent_id: str
    prompt: str = Field(min_length=1, max_length=20000)
    summary: str = Field(min_length=3, max_length=500)


class ApprovalDecision(BaseModel):
    approved: bool


class InteractionCreate(BaseModel):
    target_agent_id: str
    summary: str = Field(min_length=3, max_length=500)
    kind: Literal["delegation", "review_request", "context_share", "help_request", "completion", "error"] = "context_share"
