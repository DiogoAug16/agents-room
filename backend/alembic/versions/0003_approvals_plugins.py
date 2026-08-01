"""Add plugins and approval workflow."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("plugins"):
        op.create_table("plugins",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False, unique=True),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("manifest", sa.JSON(), nullable=False),
        )
    if not inspector.has_table("agent_plugins"):
        op.create_table("agent_plugins",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("agent_id", sa.String(), sa.ForeignKey("agents.id"), nullable=False),
            sa.Column("plugin_id", sa.String(), sa.ForeignKey("plugins.id"), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.UniqueConstraint("agent_id", "plugin_id", name="uq_agent_plugin"),
        )
        op.create_index("ix_agent_plugins_agent_id", "agent_plugins", ["agent_id"])
    if not inspector.has_table("approvals"):
        op.create_table("approvals",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id"), nullable=False, unique=True),
            sa.Column("kind", sa.String(64), nullable=False),
            sa.Column("summary", sa.String(500), nullable=False),
            sa.Column("state", sa.String(32), nullable=False),
            sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("decided_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_approvals_task_id", "approvals", ["task_id"])
        op.create_index("ix_approvals_state", "approvals", ["state"])

def downgrade():
    op.drop_table("approvals")
    op.drop_table("agent_plugins")
    op.drop_table("plugins")
