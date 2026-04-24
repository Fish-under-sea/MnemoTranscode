import asyncio
from sqlalchemy import text
from app.core.database import engine

async def test():
    async with engine.begin() as conn:
        r = await conn.execute(text("SELECT 1"))
        print("DB OK:", r.scalar())

asyncio.run(test())
