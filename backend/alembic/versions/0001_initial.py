"""Initial Agents Room schema."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table("workspaces"):
        return
    op.create_table("workspaces",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("project_root", sa.String(2048), nullable=False),
        sa.Column("room_width", sa.Integer(), nullable=False),
        sa.Column("room_height", sa.Integer(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
    )
    op.create_table("agents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("workspace_id", sa.String(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("appearance", sa.JSON(), nullable=False),
        sa.Column("visual_status", sa.String(32), nullable=False),
        sa.Column("base_x", sa.Integer(), nullable=False),
        sa.Column("base_y", sa.Integer(), nullable=False),
        sa.Column("current_x", sa.Integer(), nullable=False),
        sa.Column("current_y", sa.Integer(), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("permission", sa.String(32), nullable=False),
    )
    op.create_index("ix_agents_workspace_id", "agents", ["workspace_id"])
    op.create_table("workstations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("workspace_id", sa.String(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False, unique=True),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
        sa.Column("orientation", sa.String(8), nullable=False),
        sa.Column("interaction_points", sa.JSON(), nullable=False),
    )
    op.create_index("ix_workstations_workspace_id", "workstations", ["workspace_id"])
    op.create_table("skills",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("manifest", sa.JSON(), nullable=False),
    )
    op.create_table("agent_skills",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("skill_id", sa.String(), sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("agent_id", "skill_id", name="uq_agent_skill"),
    )
    op.create_index("ix_agent_skills_agent_id", "agent_skills", ["agent_id"])
    op.create_table("tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("workspace_id", sa.String(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column("access_mode", sa.String(32), nullable=False),
        sa.Column("result", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_tasks_workspace_id", "tasks", ["workspace_id"])
    op.create_index("ix_tasks_agent_id", "tasks", ["agent_id"])
    op.create_index("ix_tasks_state", "tasks", ["state"])
    op.create_table("workspace_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("workspace_id", sa.String(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("source_agent_id", sa.String()),
        sa.Column("target_agent_id", sa.String()),
        sa.Column("task_id", sa.String()),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_workspace_events_workspace_id", "workspace_events", ["workspace_id"])


def downgrade():
    op.drop_table("workspace_events")
    op.drop_table("tasks")
    op.drop_table("agent_skills")
    op.drop_table("skills")
    op.drop_table("workstations")
    op.drop_table("agents")
    op.drop_table("workspaces")
