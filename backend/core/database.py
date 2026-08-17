from motor.motor_asyncio import AsyncIOMotorClient as AsyncMongoClient
from core.config import settings

client = AsyncMongoClient(settings.MONGO_URL)
db = client[settings.DB_NAME]


def get_db():
    return db


async def create_indexes():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("deleted")
        await db.login_attempts.create_index("identifier")
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.assets.create_index("asset_tag", unique=True, sparse=True)
        await db.assets.create_index("serial_number")
        await db.assets.create_index("status")
        await db.assets.create_index("category_id")
        await db.assets.create_index("branch_id")
        await db.audit_logs.create_index("timestamp")
        await db.audit_logs.create_index("entity_type")
    except Exception as e:
        print(f"⚠️ No se pudieron crear índices (continuando): {e}")