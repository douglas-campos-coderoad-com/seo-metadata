"""Add url to projects

Revision ID: 008
Revises: 007
Create Date: 2026-08-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable: projects created before this column existed have no URL until
    # someone edits them, and the field stays optional for new ones too.
    op.add_column('projects', sa.Column('url', sa.String(2048), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'url')
