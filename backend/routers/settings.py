import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from core.database import db
from core.deps import require_permission, get_current_user
from core.audit import log_audit

router = APIRouter(tags=["Notificaciones y Configuración"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find(
        {"$or": [{"user_id": user["id"]}, {"user_id": None}]}, {"_id": 0}) \
        .sort("created_at", -1).limit(100).to_list(100)
    unread = sum(1 for i in items if not i.get("read"))
    return {"items": items, "unread": unread}


@router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id}, {"$set": {"read": True}})
    return {"success": True}


@router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"$or": [{"user_id": user["id"]}, {"user_id": None}]}, {"$set": {"read": True}})
    return {"success": True}


@router.get("/settings")
async def get_settings(user: dict = Depends(require_permission("settings:read"))):
    doc = await db.settings.find_one({"id": "system"}, {"_id": 0})
    if not doc:
        doc = {"id": "system", "company_name": "César Iglesias S.A.",
               "app_name": "Cisa TI", "currency": "DOP",
               "password_min_length": 8, "session_minutes": 60,
               "warranty_alert_days": 60, "license_alert_days": 60}
        await db.settings.insert_one(dict(doc))
        doc.pop("_id", None)
    return doc


@router.put("/settings")
async def update_settings(payload: dict, request: Request,
                          user: dict = Depends(require_permission("settings:write"))):
    payload.pop("_id", None)
    payload["id"] = "system"
    payload["updated_at"] = now_iso()
    await db.settings.update_one({"id": "system"}, {"$set": payload}, upsert=True)
    after = await db.settings.find_one({"id": "system"}, {"_id": 0})
    await log_audit(request, user, "update", "settings", "system", None, after,
                    "Actualizó configuración del sistema")
    return after
