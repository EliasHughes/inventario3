"""Fábrica genérica de routers CRUD con soft-delete, auditoría y paginación."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from core.database import db
from core.deps import require_permission
from core.audit import log_audit


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def make_crud_router(*, prefix: str, collection: str, permission: str,
                     entity_label: str, search_fields=None):
    router = APIRouter(prefix=prefix, tags=[entity_label])
    search_fields = search_fields or ["name"]
    col = db[collection]

    @router.get("")
    async def list_items(
        request: Request,
        q: Optional[str] = None,
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=500),
        include_deleted: bool = False,
        user: dict = Depends(require_permission(f"{permission}:read")),
    ):
        query = {}
        if not include_deleted:
            query["deleted"] = {"$ne": True}
        if q:
            query["$or"] = [{f: {"$regex": q, "$options": "i"}} for f in search_fields]
        total = await col.count_documents(query)
        cursor = col.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
        items = await cursor.to_list(page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.get("/{item_id}")
    async def get_item(item_id: str, user: dict = Depends(require_permission(f"{permission}:read"))):
        item = await col.find_one({"id": item_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail=f"{entity_label} no encontrado")
        return item

    @router.post("")
    async def create_item(request: Request, payload: dict,
                          user: dict = Depends(require_permission(f"{permission}:write"))):
        doc = dict(payload)
        doc.pop("_id", None)
        doc["id"] = str(uuid.uuid4())
        doc["deleted"] = False
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        doc["created_by"] = user.get("email")
        await col.insert_one(dict(doc))
        doc.pop("_id", None)
        await log_audit(request, user, "create", collection, doc["id"], None, doc,
                        f"Creó {entity_label}")
        return doc

    @router.put("/{item_id}")
    async def update_item(item_id: str, request: Request, payload: dict,
                          user: dict = Depends(require_permission(f"{permission}:write"))):
        before = await col.find_one({"id": item_id}, {"_id": 0})
        if not before:
            raise HTTPException(status_code=404, detail=f"{entity_label} no encontrado")
        updates = dict(payload)
        updates.pop("_id", None)
        updates.pop("id", None)
        updates["updated_at"] = now_iso()
        updates["updated_by"] = user.get("email")
        await col.update_one({"id": item_id}, {"$set": updates})
        after = await col.find_one({"id": item_id}, {"_id": 0})
        await log_audit(request, user, "update", collection, item_id, before, after,
                        f"Editó {entity_label}")
        return after

    @router.delete("/{item_id}")
    async def delete_item(item_id: str, request: Request,
                          user: dict = Depends(require_permission(f"{permission}:delete"))):
        before = await col.find_one({"id": item_id}, {"_id": 0})
        if not before:
            raise HTTPException(status_code=404, detail=f"{entity_label} no encontrado")
        await col.update_one({"id": item_id}, {"$set": {"deleted": True, "deleted_at": now_iso(),
                                                         "deleted_by": user.get("email")}})
        await log_audit(request, user, "delete", collection, item_id, before, None,
                        f"Eliminó (soft) {entity_label}")
        return {"success": True, "id": item_id}

    return router
