"""Add ingested_urls table for URL ingestion feature

Revision ID: 002
Revises: 001
Create Date: 2026-08-08 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ingested_urls table
    op.create_table(
        'ingested_urls',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(2048), nullable=False),
        sa.Column('html', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='success'),
        sa.Column('http_status', sa.Integer(), nullable=True),
        sa.Column('content_type', sa.String(255), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('url'),
    )
    op.create_index('ix_ingested_urls_url', 'ingested_urls', ['url'])


def downgrade() -> None:
    op.drop_index('ix_ingested_urls_url', table_name='ingested_urls')
    op.drop_table('ingested_urls')