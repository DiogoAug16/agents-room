"""Add persisted agent interactions."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

def upgrade():
    if sa.inspect(op.get_bind()).has_table("agent_interactions"):
        return
    op.create_table("agent_interactions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("workspace_id", sa.String(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("source_agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("target_agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id")),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_agent_interactions_workspace_id", "agent_interactions", ["workspace_id"])
    op.create_index("ix_agent_interactions_source_agent_id", "agent_interactions", ["source_agent_id"])
    op.create_index("ix_agent_interactions_target_agent_id", "agent_interactions", ["target_agent_id"])
    op.create_index("ix_agent_interactions_state", "agent_interactions", ["state"])

def downgrade():
    op.drop_table("agent_interactions")
