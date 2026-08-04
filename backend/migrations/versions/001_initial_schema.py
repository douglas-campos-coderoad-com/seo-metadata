"""Initial schema with categories, periods, dealers, and items

Revision ID: 001
Revises:
Create Date: 2026-08-04 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_categories_name', 'categories', ['name'])

    # Create periods table
    op.create_table(
        'periods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('start_year', sa.Integer(), nullable=False),
        sa.Column('end_year', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_periods_name', 'periods', ['name'])

    # Create dealers table
    op.create_table(
        'dealers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('inquiries_enabled', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_dealers_name', 'dealers', ['name'])
    op.create_index('ix_dealers_email', 'dealers', ['email'])

    # Create items table
    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('period_id', sa.Integer(), nullable=False),
        sa.Column('dealer_id', sa.Integer(), nullable=False),
        sa.Column('image_urls', sa.ARRAY(sa.String()), nullable=True),
        sa.Column('condition', sa.String(255), nullable=True),
        sa.Column('asking_price', sa.Float(), nullable=True),
        sa.Column('status', sa.String(50), default='available', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
        sa.ForeignKeyConstraint(['period_id'], ['periods.id'], ),
        sa.ForeignKeyConstraint(['dealer_id'], ['dealers.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_items_title', 'items', ['title'])
    op.create_index('ix_items_category_id', 'items', ['category_id'])
    op.create_index('ix_items_period_id', 'items', ['period_id'])
    op.create_index('ix_items_dealer_id', 'items', ['dealer_id'])
    op.create_index('ix_items_status', 'items', ['status'])


def downgrade() -> None:
    op.drop_index('ix_items_status', table_name='items')
    op.drop_index('ix_items_dealer_id', table_name='items')
    op.drop_index('ix_items_period_id', table_name='items')
    op.drop_index('ix_items_category_id', table_name='items')
    op.drop_index('ix_items_title', table_name='items')
    op.drop_table('items')
    op.drop_index('ix_dealers_email', table_name='dealers')
    op.drop_index('ix_dealers_name', table_name='dealers')
    op.drop_table('dealers')
    op.drop_index('ix_periods_name', table_name='periods')
    op.drop_table('periods')
    op.drop_index('ix_categories_name', table_name='categories')
    op.drop_table('categories')
