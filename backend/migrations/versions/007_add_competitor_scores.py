"""Add seo/geo scores, status and analyzed_at to competitors

Revision ID: 007
Revises: 006
Create Date: 2026-08-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('competitors', sa.Column('seo_score', sa.Integer(), nullable=True))
    op.add_column('competitors', sa.Column('geo_score', sa.Integer(), nullable=True))
    op.add_column('competitors', sa.Column('status', sa.String(50), nullable=True))
    op.add_column('competitors', sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('competitors', 'analyzed_at')
    op.drop_column('competitors', 'status')
    op.drop_column('competitors', 'geo_score')
    op.drop_column('competitors', 'seo_score')