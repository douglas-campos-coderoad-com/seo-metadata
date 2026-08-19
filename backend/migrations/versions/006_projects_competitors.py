"""Add projects and competitors tables, link url_analyses to projects

Revision ID: 006
Revises: 005
Create Date: 2026-08-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('country', sa.String(100), nullable=False),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'competitors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(2048), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_competitors_project_id', 'competitors', ['project_id'])

    op.add_column(
        'url_analyses',
        sa.Column('project_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_url_analyses_project_id',
        'url_analyses',
        'projects',
        ['project_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_url_analyses_project_id', 'url_analyses', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_url_analyses_project_id', table_name='url_analyses')
    op.drop_constraint('fk_url_analyses_project_id', 'url_analyses', type_='foreignkey')
    op.drop_column('url_analyses', 'project_id')

    op.drop_index('ix_competitors_project_id', table_name='competitors')
    op.drop_table('competitors')

    op.drop_table('projects')
