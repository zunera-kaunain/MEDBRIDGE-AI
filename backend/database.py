"""MongoDB connection and collection handles."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    """Return the database handle, connecting on first use.

    Note the explicit `is None` checks. Motor objects raise NotImplementedError
    on truth-testing, so `if not _db` would blow up rather than doing what it
    looks like it does.
    """
    global _client, _db
    if _db is None:
        if not settings.mongodb_url:
            raise RuntimeError("MONGODB_URL is not set in backend/.env")
        _client = AsyncIOMotorClient(settings.mongodb_url)
        _db = _client[settings.db_name]
    return _db


# Collection accessors — routers use these rather than raw string names, so a
# typo becomes an import error instead of a silently empty collection.
def doctors():
    return get_db()["doctors"]


def patients():
    return get_db()["patients"]


def sessions():
    return get_db()["sessions"]


def reports():
    return get_db()["reports"]


def patient_cards():
    return get_db()["patient_cards"]


async def ensure_indexes() -> None:
    """Create indexes. Idempotent — safe to run on every startup."""
    await doctors().create_index("email", unique=True)
    await patients().create_index([("doctor_id", 1), ("full_name", 1)])
    await patients().create_index([("doctor_id", 1), ("phone", 1)])
    await sessions().create_index([("doctor_id", 1), ("encounter_start", -1)])
    await sessions().create_index("patient_id")
    await reports().create_index("session_id", unique=True)
    await patient_cards().create_index([("session_id", 1), ("language", 1)])


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None