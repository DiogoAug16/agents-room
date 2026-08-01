"""Persist the Codex session owned by each agent."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table("agent_sessions"):
        return
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False, unique=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("external_session_id", sa.String(128), nullable=False),
        sa.Column("access_mode", sa.String(32), nullable=False),
        sa.Column("last_resumed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_sessions_agent_id", "agent_sessions", ["agent_id"])


def downgrade():
    op.drop_table("agent_sessions")
