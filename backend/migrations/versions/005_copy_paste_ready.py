"""Add copy_paste_ready column to url_optimizations

Revision ID: 005
Revises: 004
Create Date: 2026-08-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'url_optimizations',
        sa.Column('copy_paste_ready', JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('url_optimizations', 'copy_paste_ready')