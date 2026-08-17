import uuid
import io
import base64
from datetime import datetime, timezone
from typing import Optional
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from core.database import db
from core.deps import require_permission
from core.audit import log_audit

router = APIRouter(prefix="/assets", tags=["Activos"])

ASSET_STATUSES = ["disponible", "asignado", "mantenimiento", "danado", "baja", "reservado", "transito"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class AssetInput(BaseModel):
    asset_tag: Optional[str] = None
    name: str
    serial_number: Optional[str] = None
    category_id: Optional[str] = None
    manufacturer_id: Optional[str] = None
    model_id: Optional[str] = None
    branch_id: Optional[str] = None
    department_id: Optional[str] = None
    location_id: Optional[str] = None
    supplier_id: Optional[str] = None
    status: str = "disponible"
    condition: Optional[str] = "nuevo"
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    warranty_end: Optional[str] = None
    depreciation_years: Optional[int] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    specs: Optional[dict] = None
    notes: Optional[str] = None
    photos: Optional[list] = None
    documents: Optional[list] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None


async def _gen_asset_tag():
    year = datetime.now().year
    count = await db.assets.count_documents({}) + 1
    return f"CISA-{year}-{count:05d}"


async def _add_history(asset_id, action, user, detail, before=None, after=None):
    await db.asset_history.insert_one({
        "id": str(uuid.uuid4()), "asset_id": asset_id, "action": action,
        "detail": detail, "before": before, "after": after,
        "user_email": user.get("email"), "user_name": user.get("name"),
        "timestamp": now_iso(),
    })


def _depreciation(asset):
    cost = asset.get("purchase_cost")
    years = asset.get("depreciation_years")
    pdate = asset.get("purchase_date")
    if not cost or not years or not pdate:
        return None
    try:
        start = datetime.fromisoformat(pdate)
    except Exception:
        return None
    elapsed = (datetime.now(timezone.utc) - start.replace(tzinfo=timezone.utc)).days / 365.25
    annual = cost / years
    accumulated = min(annual * elapsed, cost)
    book = max(cost - accumulated, 0)
    return {"annual": round(annual, 2), "accumulated": round(accumulated, 2),
            "book_value": round(book, 2), "elapsed_years": round(elapsed, 2)}


@router.get("")
async def list_assets(q: Optional[str] = None, status: Optional[str] = None,
                      category_id: Optional[str] = None, branch_id: Optional[str] = None,
                      department_id: Optional[str] = None, unassigned: Optional[bool] = None,
                      page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                      user: dict = Depends(require_permission("assets:read"))):
    query = {"deleted": {"$ne": True}}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"asset_tag": {"$regex": q, "$options": "i"}},
                        {"serial_number": {"$regex": q, "$options": "i"}},
                        {"hostname": {"$regex": q, "$options": "i"}}]
    if status:
        query["status"] = status
    if category_id:
        query["category_id"] = category_id
    if branch_id:
        query["branch_id"] = branch_id
    if department_id:
        query["department_id"] = department_id
    if unassigned:
        query["$and"] = [{"$or": [{"assigned_to": None}, {"assigned_to": ""}]}]
    total = await db.assets.count_documents(query)
    items = await db.assets.find(query, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    for a in items:
        a["depreciation"] = _depreciation(a)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/statuses")
async def statuses(user: dict = Depends(require_permission("assets:read"))):
    return {"statuses": ASSET_STATUSES}


@router.get("/search")
async def search_assets(q: str = Query(..., min_length=1),
                        available_only: bool = False,
                        limit: int = Query(10, ge=1, le=25),
                        user: dict = Depends(require_permission("assets:read"))):
    """Autocompletado/typeahead para equipos por número de serie, nombre, MAC o etiqueta."""
    query = {"deleted": {"$ne": True},
             "$or": [{"serial_number": {"$regex": q, "$options": "i"}},
                     {"name": {"$regex": q, "$options": "i"}},
                     {"mac_address": {"$regex": q, "$options": "i"}},
                     {"asset_tag": {"$regex": q, "$options": "i"}},
                     {"hostname": {"$regex": q, "$options": "i"}}]}
    if available_only:
        query["status"] = "disponible"
    items = await db.assets.find(query, {"_id": 0, "id": 1, "asset_tag": 1, "name": 1,
                                          "serial_number": 1, "mac_address": 1, "status": 1,
                                          "category_id": 1, "hostname": 1}).limit(limit).to_list(limit)
    return {"items": items}


@router.get("/{asset_id}")
async def get_asset(asset_id: str, user: dict = Depends(require_permission("assets:read"))):
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    asset["depreciation"] = _depreciation(asset)
    return asset


@router.get("/{asset_id}/history")
async def asset_history(asset_id: str, user: dict = Depends(require_permission("assets:read"))):
    items = await db.asset_history.find({"asset_id": asset_id}, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return {"items": items}


@router.get("/{asset_id}/qr")
async def asset_qr(asset_id: str, user: dict = Depends(require_permission("assets:read"))):
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    payload = f"CISA-TI|{asset.get('asset_tag')}|{asset_id}"
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return {"asset_tag": asset.get("asset_tag"), "qr": f"data:image/png;base64,{b64}", "payload": payload}


@router.post("")
async def create_asset(data: AssetInput, request: Request,
                       user: dict = Depends(require_permission("assets:write"))):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    if not doc.get("asset_tag"):
        doc["asset_tag"] = await _gen_asset_tag()
    if await db.assets.find_one({"asset_tag": doc["asset_tag"], "deleted": {"$ne": True}}):
        raise HTTPException(status_code=400, detail="Ya existe un activo con esa etiqueta")
    doc["deleted"] = False
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    doc["created_by"] = user.get("email")
    await db.assets.insert_one(dict(doc))
    doc.pop("_id", None)
    await _add_history(doc["id"], "create", user, "Activo registrado en el sistema", None, doc)
    await log_audit(request, user, "create", "assets", doc["id"], None, doc, "Registró activo")
    return doc


@router.put("/{asset_id}")
async def update_asset(asset_id: str, data: AssetInput, request: Request,
                       user: dict = Depends(require_permission("assets:write"))):
    before = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    updates = data.model_dump()
    updates["updated_at"] = now_iso()
    updates["updated_by"] = user.get("email")
    await db.assets.update_one({"id": asset_id}, {"$set": updates})
    after = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    await _add_history(asset_id, "update", user, "Datos del activo actualizados", before, after)
    await log_audit(request, user, "update", "assets", asset_id, before, after, "Editó activo")
    return after


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, request: Request,
                       user: dict = Depends(require_permission("assets:delete"))):
    before = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    await db.assets.update_one({"id": asset_id}, {"$set": {"deleted": True, "status": "baja",
                                                           "deleted_at": now_iso(), "deleted_by": user.get("email")}})
    await _add_history(asset_id, "delete", user, "Activo dado de baja (soft delete)", before, None)
    await log_audit(request, user, "delete", "assets", asset_id, before, None, "Dio de baja activo")
    return {"success": True}
