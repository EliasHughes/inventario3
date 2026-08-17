import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from core.database import db
from core.deps import require_permission
from core.audit import log_audit

router = APIRouter(prefix="/tickets", tags=["Tickets"])

STATUSES = ["abierto", "en_progreso", "en_espera", "resuelto", "cerrado"]
PRIORITIES = ["baja", "media", "alta", "critica"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class TicketInput(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "incidencia"  # incidencia | solicitud
    priority: str = "media"
    asset_id: Optional[str] = None
    asset_tag: Optional[str] = None
    category: Optional[str] = None
    assigned_to: Optional[str] = None
    branch_id: Optional[str] = None
    department_id: Optional[str] = None


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    comment: Optional[str] = None
    resolution: Optional[str] = None


async def _gen_ticket_number():
    count = await db.tickets.count_documents({}) + 1
    return f"TK-{datetime.now().year}-{count:05d}"


@router.get("/meta")
async def meta(user: dict = Depends(require_permission("tickets:read"))):
    return {"statuses": STATUSES, "priorities": PRIORITIES}


@router.get("")
async def list_tickets(q: Optional[str] = None, status: Optional[str] = None,
                       priority: Optional[str] = None, page: int = Query(1, ge=1),
                       page_size: int = Query(50, ge=1, le=500),
                       user: dict = Depends(require_permission("tickets:read"))):
    query = {"deleted": {"$ne": True}}
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                        {"ticket_number": {"$regex": q, "$options": "i"}}]
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    total = await db.tickets.count_documents(query)
    items = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(require_permission("tickets:read"))):
    t = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return t


@router.post("")
async def create_ticket(data: TicketInput, request: Request,
                        user: dict = Depends(require_permission("tickets:write"))):
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "ticket_number": await _gen_ticket_number(),
                "status": "abierto", "reported_by": user.get("name"),
                "reported_by_email": user.get("email"), "comments": [], "deleted": False,
                "created_at": now_iso(), "updated_at": now_iso()})
    await db.tickets.insert_one(dict(doc))
    doc.pop("_id", None)
    await log_audit(request, user, "create", "tickets", doc["id"], None, doc,
                    f"Creó ticket {doc['ticket_number']}")
    return doc


@router.put("/{ticket_id}")
async def update_ticket(ticket_id: str, data: TicketUpdate, request: Request,
                        user: dict = Depends(require_permission("tickets:write"))):
    before = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    updates = {"updated_at": now_iso()}
    for f in ["status", "priority", "assigned_to", "resolution"]:
        v = getattr(data, f)
        if v is not None:
            updates[f] = v
    if data.status in ("resuelto", "cerrado") and not before.get("closed_at"):
        updates["closed_at"] = now_iso()
    if data.comment:
        comment = {"id": str(uuid.uuid4()), "text": data.comment, "author": user.get("name"),
                   "at": now_iso()}
        await db.tickets.update_one({"id": ticket_id}, {"$push": {"comments": comment}})
    await db.tickets.update_one({"id": ticket_id}, {"$set": updates})
    after = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    await log_audit(request, user, "update", "tickets", ticket_id, before, after, "Actualizó ticket")
    return after


@router.delete("/{ticket_id}")
async def delete_ticket(ticket_id: str, request: Request,
                        user: dict = Depends(require_permission("tickets:delete"))):
    before = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    await db.tickets.update_one({"id": ticket_id}, {"$set": {"deleted": True, "deleted_at": now_iso()}})
    await log_audit(request, user, "delete", "tickets", ticket_id, before, None, "Eliminó ticket")
    return {"success": True}
