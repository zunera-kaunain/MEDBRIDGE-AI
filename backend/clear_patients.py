import asyncio
import database as db

async def clear():
    result = await db.patients().delete_many({})
    print(f'Deleted {result.deleted_count} old patients')

asyncio.run(clear())