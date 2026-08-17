import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from core.database import db
from core.deps import require_permission
from core.audit import log_audit

router = APIRouter(prefix="/inventory", tags=["Inventario Físico"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class SessionInput(BaseModel):
    name: str
    branch_id: Optional[str] = None
    department_id: Optional[str] = None
    notes: Optional[str] = None


class CountInput(BaseModel):
    code: str  # asset_tag or scanned payload
    condition: Optional[str] = "bueno"
    location_note: Optional[str] = None


@router.get("/sessions")
async def list_sessions(user: dict = Depends(require_permission("inventory:read"))):
    items = await db.inventory_sessions.find({"deleted": {"$ne": True}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    return {"items": items}


@router.post("/sessions")
async def create_session(data: SessionInput, request: Request,
                         user: dict = Depends(require_permission("inventory:write"))):
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "status": "abierta", "counted": 0,
                "created_by": user.get("email"), "deleted": False, "created_at": now_iso()})
    await db.inventory_sessions.insert_one(dict(doc))
    doc.pop("_id", None)
    await log_audit(request, user, "create", "inventory_sessions", doc["id"], None, doc,
                    "Inició sesión de inventario físico")
    return doc


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(require_permission("inventory:read"))):
    session = await db.inventory_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    counts = await db.inventory_counts.find({"session_id": session_id}, {"_id": 0}) \
        .sort("counted_at", -1).to_list(2000)
    session["counts"] = counts
    return session


@router.post("/sessions/{session_id}/count")
async def add_count(session_id: str, data: CountInput, request: Request,
                    user: dict = Depends(require_permission("inventory:write"))):
    session = await db.inventory_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    tag = data.code.split("|")[1] if "|" in data.code else data.code
    asset = await db.assets.find_one({"asset_tag": tag, "deleted": {"$ne": True}}, {"_id": 0})
    exists = await db.inventory_counts.find_one({"session_id": session_id, "asset_tag": tag})
    if exists:
        raise HTTPException(status_code=400, detail="Este activo ya fue contado en esta sesión")
    doc = {"id": str(uuid.uuid4()), "session_id": session_id, "asset_tag": tag,
           "asset_id": asset.get("id") if asset else None,
           "asset_name": asset.get("name") if asset else "DESCONOCIDO",
           "found": bool(asset), "system_status": asset.get("status") if asset else None,
           "condition": data.condition, "location_note": data.location_note,
           "counted_by": user.get("name"), "counted_at": now_iso()}
    await db.inventory_counts.insert_one(dict(doc))
    doc.pop("_id", None)
    await db.inventory_sessions.update_one({"id": session_id}, {"$inc": {"counted": 1}})
    return doc


@router.post("/sessions/{session_id}/reconcile")
async def reconcile(session_id: str, request: Request,
                    user: dict = Depends(require_permission("inventory:write"))):
    session = await db.inventory_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    counts = await db.inventory_counts.find({"session_id": session_id}, {"_id": 0}).to_list(5000)
    counted_tags = {c["asset_tag"] for c in counts}
    query = {"deleted": {"$ne": True}}
    if session.get("branch_id"):
        query["branch_id"] = session["branch_id"]
    system_assets = await db.assets.find(query, {"_id": 0, "asset_tag": 1, "name": 1, "status": 1}).to_list(10000)
    system_tags = {a["asset_tag"] for a in system_assets if a.get("asset_tag")}
    missing = [a for a in system_assets if a.get("asset_tag") not in counted_tags]
    unexpected = [c for c in counts if not c.get("found")]
    report = {
        "system_total": len(system_tags), "counted_total": len(counted_tags),
        "matched": len(counted_tags & system_tags),
        "missing": missing, "unexpected": unexpected,
        "reconciled_at": now_iso(), "reconciled_by": user.get("email"),
    }
    await db.inventory_sessions.update_one({"id": session_id},
                                           {"$set": {"status": "conciliada", "report": report}})
    await log_audit(request, user, "reconcile", "inventory_sessions", session_id, None, report,
                    "Concilió inventario físico vs sistema")
    return report
