from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.item import Item
from src.models.category import Category
from src.models.period import Period
from src.models.dealer import Dealer
from src.schemas.items import ItemDetailSchema, ItemListSchema
from typing import Optional, Tuple


class ItemService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_items(
        self,
        category_id: Optional[int] = None,
        period_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
        status: str = 'available'
    ) -> Tuple[list[ItemListSchema], int]:
        # Build filter conditions
        conditions = [Item.status == status]
        if category_id:
            conditions.append(Item.category_id == category_id)
        if period_id:
            conditions.append(Item.period_id == period_id)

        # Get total count
        count_query = select(Item).where(and_(*conditions))
        count_result = await self.session.execute(count_query)
        total = len(count_result.fetchall())

        # Get paginated results with relationships loaded
        query = (
            select(Item)
            .where(and_(*conditions))
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        items = result.scalars().all()

        # Convert to schemas
        items_schema = []
        for item in items:
            # Load related data
            category_query = select(Category).where(Category.id == item.category_id)
            category_result = await self.session.execute(category_query)
            category = category_result.scalar_one()

            period_query = select(Period).where(Period.id == item.period_id)
            period_result = await self.session.execute(period_query)
            period = period_result.scalar_one()

            dealer_query = select(Dealer).where(Dealer.id == item.dealer_id)
            dealer_result = await self.session.execute(dealer_query)
            dealer = dealer_result.scalar_one()

            items_schema.append(
                ItemListSchema(
                    id=item.id,
                    title=item.title,
                    category={'id': category.id, 'name': category.name},
                    period={'id': period.id, 'name': period.name},
                    dealer={
                        'id': dealer.id,
                        'name': dealer.name,
                        'inquiries_enabled': dealer.inquiries_enabled,
                    },
                    image_urls=item.image_urls or [],
                    status=item.status,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        return items_schema, total

    async def get_item_by_id(self, item_id: int) -> Optional[ItemDetailSchema]:
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        item = result.scalar_one_or_none()

        if not item:
            return None

        # Load related data
        category_query = select(Category).where(Category.id == item.category_id)
        category_result = await self.session.execute(category_query)
        category = category_result.scalar_one()

        period_query = select(Period).where(Period.id == item.period_id)
        period_result = await self.session.execute(period_query)
        period = period_result.scalar_one()

        dealer_query = select(Dealer).where(Dealer.id == item.dealer_id)
        dealer_result = await self.session.execute(dealer_query)
        dealer = dealer_result.scalar_one()

        return ItemDetailSchema(
            id=item.id,
            title=item.title,
            description=item.description,
            category={'id': category.id, 'name': category.name},
            period={'id': period.id, 'name': period.name},
            dealer={
                'id': dealer.id,
                'name': dealer.name,
                'inquiries_enabled': dealer.inquiries_enabled,
            },
            image_urls=item.image_urls or [],
            condition=item.condition,
            asking_price=item.asking_price,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
