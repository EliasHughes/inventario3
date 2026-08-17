import uuid
import socket
from datetime import datetime, timezone
from fastapi import Request
from core.database import db


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def log_audit(request: Request, user: dict, action: str, entity_type: str,
                    entity_id: str = None, before=None, after=None, description: str = ""):
    doc = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "before": before,
        "after": after,
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "user_name": user.get("name") if user else None,
        "ip_address": _client_ip(request),
        "hostname": request.headers.get("x-machine-name") or request.headers.get("user-agent", "")[:120],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc
