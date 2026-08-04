from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.category import Category
from src.schemas.categories import CategorySchema
from typing import List, Optional


class CategoryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_categories(self) -> List[CategorySchema]:
        query = select(Category)
        result = await self.session.execute(query)
        categories = result.scalars().all()

        return [
            CategorySchema(
                id=cat.id,
                name=cat.name,
                description=cat.description,
                created_at=cat.created_at,
                updated_at=cat.updated_at,
            )
            for cat in categories
        ]

    async def get_category(self, category_id: int) -> Optional[CategorySchema]:
        query = select(Category).where(Category.id == category_id)
        result = await self.session.execute(query)
        category = result.scalar_one_or_none()

        if not category:
            return None

        return CategorySchema(
            id=category.id,
            name=category.name,
            description=category.description,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )
