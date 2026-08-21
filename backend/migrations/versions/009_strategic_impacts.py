"""Add strategic_impacts to url_optimizations

Revision ID: 009
Revises: 008
Create Date: 2026-08-21 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable: optimizations produced before this column existed have no impacts,
    # and a run whose LLM call fails still persists without them.
    op.add_column(
        'url_optimizations',
        sa.Column('strategic_impacts', sa.JSON().with_variant(JSONB, 'postgresql'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('url_optimizations', 'strategic_impacts')
