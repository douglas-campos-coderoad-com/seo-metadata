"""Add url_analyses table for SEO/GEO analysis feature

Revision ID: 003
Revises: 002
Create Date: 2026-08-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create url_analyses table
    op.create_table(
        'url_analyses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ingested_url_id', sa.Integer(), nullable=False),
        sa.Column('seo_score', sa.Integer(), nullable=True),
        sa.Column('geo_score', sa.Integer(), nullable=True),
        sa.Column('overall_score', sa.Integer(), nullable=True),
        sa.Column('analysis', JSONB(), nullable=True),
        sa.Column('json_ld', JSONB(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ingested_url_id'], ['ingested_urls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_url_analyses_ingested_url_id', 'url_analyses', ['ingested_url_id'])


def downgrade() -> None:
    op.drop_index('ix_url_analyses_ingested_url_id', table_name='url_analyses')
    op.drop_table('url_analyses')