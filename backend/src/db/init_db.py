import asyncio
from sqlalchemy import text
from src.db.session import AsyncSessionLocal, engine


async def init_db():
    """Initialize database with seed data."""
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: None)

    # Seed initial data
    async with AsyncSessionLocal() as session:
        try:
            # Check if categories already exist
            result = await session.execute(
                text('SELECT COUNT(*) FROM categories')
            )
            if result.scalar() == 0:
                # Seed categories
                await session.execute(
                    text('''
                    INSERT INTO categories (name, description) VALUES
                    ('Furniture', 'High-end furniture pieces'),
                    ('Fine Art', 'Paintings, sculptures, and artworks'),
                    ('Antiques', 'Antique objects and collectibles'),
                    ('Decorative Objects', 'Decorative home accessories'),
                    ('Jewelry', 'Fine jewelry and accessories')
                    ''')
                )

                # Seed periods
                await session.execute(
                    text('''
                    INSERT INTO periods (name, start_year, end_year) VALUES
                    ('18th Century', 1700, 1799),
                    ('19th Century', 1800, 1899),
                    ('Early 20th Century', 1900, 1950),
                    ('Contemporary', 2000, 2025)
                    ''')
                )

                # Seed dealers
                await session.execute(
                    text('''
                    INSERT INTO dealers (name, email, inquiries_enabled) VALUES
                    ('Antique Emporium', 'contact@antique-emporium.com', true),
                    ('Modern Gallery', 'hello@modern-gallery.com', true)
                    ''')
                )

                await session.commit()
                print('Database initialized with seed data')
            else:
                print('Database already contains data')
        except Exception as e:
            await session.rollback()
            print(f'Error initializing database: {e}')


if __name__ == '__main__':
    asyncio.run(init_db())
