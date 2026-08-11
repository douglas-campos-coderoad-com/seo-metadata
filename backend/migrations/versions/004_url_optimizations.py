"""Add url_optimizations table for SEO/GEO/AEO optimizer feature

Revision ID: 004
Revises: 003
Create Date: 2026-08-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create url_optimizations table
    op.create_table(
        'url_optimizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=False),
        sa.Column('optimized_html', sa.Text(), nullable=True),
        sa.Column('optimized_json_ld', JSONB(), nullable=True),
        sa.Column('optimized_content', JSONB(), nullable=True),
        sa.Column('changes', JSONB(), nullable=True),
        sa.Column('score_before', JSONB(), nullable=True),
        sa.Column('score_after_estimated', JSONB(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['analysis_id'], ['url_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_url_optimizations_analysis_id', 'url_optimizations', ['analysis_id'])


def downgrade() -> None:
    op.drop_index('ix_url_optimizations_analysis_id', table_name='url_optimizations')
    op.drop_table('url_optimizations')