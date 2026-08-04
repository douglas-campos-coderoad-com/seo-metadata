import asyncio
from sqlalchemy import select
from src.db.session import AsyncSessionLocal
from src.models.category import Category
from src.models.period import Period
from src.models.dealer import Dealer
from src.models.item import Item


async def seed_database():
    async with AsyncSessionLocal() as session:
        try:
            # Check if data already exists
            result = await session.execute(select(Category))
            if result.scalar_one_or_none():
                print('Database already contains data, skipping seed')
                return

            # Seed categories
            categories = [
                Category(name='Furniture', description='High-end furniture pieces'),
                Category(name='Fine Art', description='Paintings, sculptures, and artworks'),
                Category(name='Antiques', description='Antique objects and collectibles'),
                Category(name='Decorative Objects', description='Decorative home accessories'),
                Category(name='Jewelry', description='Fine jewelry and accessories'),
            ]
            session.add_all(categories)
            await session.flush()

            # Seed periods
            periods = [
                Period(name='18th Century', start_year=1700, end_year=1799),
                Period(name='19th Century', start_year=1800, end_year=1899),
                Period(name='Early 20th Century', start_year=1900, end_year=1950),
                Period(name='Contemporary', start_year=2000, end_year=2025),
            ]
            session.add_all(periods)
            await session.flush()

            # Seed dealers
            dealers = [
                Dealer(
                    name='Antique Emporium',
                    email='contact@antique-emporium.com',
                    description='Specialized in rare antiques and collectibles',
                    inquiries_enabled=True,
                ),
                Dealer(
                    name='Modern Gallery',
                    email='hello@modern-gallery.com',
                    description='Contemporary art and modern furniture',
                    inquiries_enabled=True,
                ),
                Dealer(
                    name='Jewelry House',
                    email='info@jewelry-house.com',
                    description='Fine jewelry and accessories',
                    inquiries_enabled=True,
                ),
            ]
            session.add_all(dealers)
            await session.flush()

            # Get IDs for foreign keys
            cat_furniture = categories[0]
            cat_art = categories[1]
            cat_antiques = categories[2]
            cat_jewelry = categories[4]

            period_19th = periods[1]
            period_20th = periods[2]
            period_contemporary = periods[3]

            dealer1 = dealers[0]
            dealer2 = dealers[1]
            dealer3 = dealers[2]

            # Seed items
            items = [
                Item(
                    title='Victorian Oak Desk',
                    description='Stunning Victorian-era oak desk with intricate carvings',
                    category_id=cat_furniture.id,
                    period_id=period_19th.id,
                    dealer_id=dealer1.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Victorian+Desk'],
                    condition='Excellent',
                    asking_price=2500.00,
                    status='available',
                ),
                Item(
                    title='Abstract Expressionist Canvas',
                    description='Original abstract expressionist painting by contemporary artist',
                    category_id=cat_art.id,
                    period_id=period_contemporary.id,
                    dealer_id=dealer2.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Abstract+Art'],
                    condition='Excellent',
                    asking_price=5000.00,
                    status='available',
                ),
                Item(
                    title='Porcelain Vase',
                    description='Antique Chinese porcelain vase from the Qing Dynasty',
                    category_id=cat_antiques.id,
                    period_id=period_19th.id,
                    dealer_id=dealer1.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Porcelain+Vase'],
                    condition='Good',
                    asking_price=1800.00,
                    status='available',
                ),
                Item(
                    title='Diamond Solitaire Ring',
                    description='18K white gold diamond solitaire engagement ring',
                    category_id=cat_jewelry.id,
                    period_id=period_contemporary.id,
                    dealer_id=dealer3.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Diamond+Ring'],
                    condition='Excellent',
                    asking_price=8500.00,
                    status='available',
                ),
                Item(
                    title='Art Deco Sideboard',
                    description='1920s Art Deco walnut sideboard with geometric details',
                    category_id=cat_furniture.id,
                    period_id=period_20th.id,
                    dealer_id=dealer1.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Art+Deco+Sideboard'],
                    condition='Very Good',
                    asking_price=3200.00,
                    status='available',
                ),
                Item(
                    title='Still Life Oil Painting',
                    description='18th century still life oil painting of fruit and flowers',
                    category_id=cat_art.id,
                    period_id=period_19th.id,
                    dealer_id=dealer2.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Still+Life'],
                    condition='Good',
                    asking_price=4200.00,
                    status='available',
                ),
                Item(
                    title='Persian Carpet Fragment',
                    description='19th century Persian carpet fragment with intricate patterns',
                    category_id=cat_antiques.id,
                    period_id=period_19th.id,
                    dealer_id=dealer1.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Persian+Carpet'],
                    condition='Good',
                    asking_price=2100.00,
                    status='available',
                ),
                Item(
                    title='Tiffany Lamp',
                    description='Authentic Tiffany-style lamp with stained glass shade',
                    category_id=cat_antiques.id,
                    period_id=period_20th.id,
                    dealer_id=dealer2.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Tiffany+Lamp'],
                    condition='Very Good',
                    asking_price=3500.00,
                    status='available',
                ),
                Item(
                    title='Emerald Bracelet',
                    description='Vintage emerald and diamond bracelet in platinum',
                    category_id=cat_jewelry.id,
                    period_id=period_20th.id,
                    dealer_id=dealer3.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Emerald+Bracelet'],
                    condition='Excellent',
                    asking_price=12000.00,
                    status='available',
                ),
                Item(
                    title='Ming Dynasty Bowl',
                    description='Rare Ming Dynasty blue and white porcelain bowl',
                    category_id=cat_antiques.id,
                    period_id=period_19th.id,
                    dealer_id=dealer1.id,
                    image_urls=['https://via.placeholder.com/400x300?text=Ming+Bowl'],
                    condition='Excellent',
                    asking_price=6500.00,
                    status='available',
                ),
            ]
            session.add_all(items)
            await session.commit()

            print('✅ Database seeded successfully!')
            print(f'  - {len(categories)} categories')
            print(f'  - {len(periods)} periods')
            print(f'  - {len(dealers)} dealers')
            print(f'  - {len(items)} items')

        except Exception as e:
            await session.rollback()
            print(f'❌ Error seeding database: {e}')
            raise


if __name__ == '__main__':
    asyncio.run(seed_database())
