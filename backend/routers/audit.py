from typing import Optional
from fastapi import APIRouter, Depends, Query
from core.database import db
from core.deps import require_permission

router = APIRouter(prefix="/audit", tags=["Auditoría"])


@router.get("")
async def list_audit(q: Optional[str] = None, entity_type: Optional[str] = None,
                     action: Optional[str] = None, user_email: Optional[str] = None,
                     page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                     user: dict = Depends(require_permission("audit:read"))):
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}
    if q:
        query["$or"] = [{"description": {"$regex": q, "$options": "i"}},
                        {"user_name": {"$regex": q, "$options": "i"}},
                        {"ip_address": {"$regex": q, "$options": "i"}}]
    total = await db.audit_logs.count_documents(query)
    items = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}
