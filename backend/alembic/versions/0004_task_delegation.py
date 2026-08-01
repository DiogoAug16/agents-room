"""Add task delegation links and depth."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("tasks")}
    with op.batch_alter_table("tasks") as batch:
        if "parent_task_id" not in columns:
            batch.add_column(sa.Column("parent_task_id", sa.String(), nullable=True))
            batch.create_index("ix_tasks_parent_task_id", ["parent_task_id"])
        if "delegation_depth" not in columns:
            batch.add_column(sa.Column("delegation_depth", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    with op.batch_alter_table("tasks") as batch:
        batch.drop_index("ix_tasks_parent_task_id")
        batch.drop_column("delegation_depth")
        batch.drop_column("parent_task_id")
