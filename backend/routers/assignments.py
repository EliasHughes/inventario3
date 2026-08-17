import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from core.database import db
from core.deps import require_permission
from core.audit import log_audit

router = APIRouter(tags=["Asignaciones"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def _asset_history(asset_id, action, user, detail):
    await db.asset_history.insert_one({
        "id": str(uuid.uuid4()), "asset_id": asset_id, "action": action, "detail": detail,
        "user_email": user.get("email"), "user_name": user.get("name"), "timestamp": now_iso()})


class DeliveryInput(BaseModel):
    asset_id: str
    assigned_to_name: str
    employee_id: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[str] = None
    branch_id: Optional[str] = None
    expected_return: Optional[str] = None
    condition: Optional[str] = "bueno"
    notes: Optional[str] = None
    signature: Optional[str] = None  # base64 data URL
    accessories: Optional[list] = None


class ReturnInput(BaseModel):
    delivery_id: str
    condition: Optional[str] = "bueno"
    received_by: Optional[str] = None
    notes: Optional[str] = None
    signature: Optional[str] = None


class ReceptionInput(BaseModel):
    asset_id: Optional[str] = None
    description: str
    serial_number: Optional[str] = None
    category_id: Optional[str] = None
    delivered_by: Optional[str] = None
    employee_code: Optional[str] = None
    condition: Optional[str] = "bueno"
    notes: Optional[str] = None
    signature: Optional[str] = None


# -------- Entregas --------
@router.get("/deliveries")
async def list_deliveries(q: Optional[str] = None,
                          active_only: Optional[bool] = None, page: int = Query(1, ge=1),
                          page_size: int = Query(50, ge=1, le=500),
                          from_date: Optional[str] = None, to_date: Optional[str] = None,
                          employee_id: Optional[str] = None,
                          user: dict = Depends(require_permission("assignments:read"))):
    query = {"deleted": {"$ne": True}}
    if active_only:
        query["returned"] = {"$ne": True}
    if employee_id:
        query["employee_id"] = employee_id
    if q:
        query["$or"] = [{"asset_tag": {"$regex": q, "$options": "i"}},
                        {"asset_name": {"$regex": q, "$options": "i"}},
                        {"serial_number": {"$regex": q, "$options": "i"}},
                        {"mac_address": {"$regex": q, "$options": "i"}},
                        {"employee_code": {"$regex": q, "$options": "i"}},
                        {"assigned_to_name": {"$regex": q, "$options": "i"}}]
    if from_date or to_date:
        rng = {}
        if from_date:
            rng["$gte"] = from_date
        if to_date:
            rng["$lte"] = to_date
        query["delivery_date"] = rng
    total = await db.deliveries.count_documents(query)
    items = await db.deliveries.find(query, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/deliveries")
async def create_delivery(data: DeliveryInput, request: Request,
                          user: dict = Depends(require_permission("assignments:write"))):
    asset = await db.assets.find_one({"id": data.asset_id, "deleted": {"$ne": True}})
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    if asset.get("status") not in ("disponible",):
        raise HTTPException(status_code=400,
                            detail=f"El activo no se puede entregar (estado actual: {asset.get('status')})")
    # Enriquecer con datos del empleado si viene employee_id
    emp = None
    if data.employee_id:
        emp = await db.employees.find_one({"id": data.employee_id, "deleted": {"$ne": True}},
                                          {"_id": 0})
    doc = data.model_dump()
    if emp:
        doc["employee_code"] = doc.get("employee_code") or emp.get("code")
        doc["assigned_to_name"] = doc.get("assigned_to_name") or emp.get("name")
        doc["department_id"] = doc.get("department_id") or emp.get("department_id")
    doc.update({"id": str(uuid.uuid4()), "asset_tag": asset.get("asset_tag"),
                "asset_name": asset.get("name"), "serial_number": asset.get("serial_number"),
                "mac_address": asset.get("mac_address"),
                "delivered_by": user.get("name"), "delivered_by_email": user.get("email"),
                "delivery_date": now_iso(), "returned": False, "deleted": False,
                "created_at": now_iso()})
    await db.deliveries.insert_one(dict(doc))
    doc.pop("_id", None)
    await db.assets.update_one({"id": data.asset_id}, {"$set": {
        "status": "asignado", "assigned_to": doc.get("employee_code") or doc.get("assigned_to_name"),
        "assigned_to_name": doc.get("assigned_to_name"),
        "department_id": doc.get("department_id") or asset.get("department_id"),
        "updated_at": now_iso()}})
    await _asset_history(data.asset_id, "delivery", user,
                         f"Entregado a {doc.get('assigned_to_name')}")
    await log_audit(request, user, "delivery", "deliveries", doc["id"], None, doc,
                    f"Entregó activo {asset.get('asset_tag')} a {doc.get('assigned_to_name')}")
    return doc


# -------- Devoluciones --------
@router.get("/returns")
async def list_returns(q: Optional[str] = None,
                       from_date: Optional[str] = None, to_date: Optional[str] = None,
                       page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                       user: dict = Depends(require_permission("assignments:read"))):
    query = {}
    if q:
        query["$or"] = [{"asset_tag": {"$regex": q, "$options": "i"}},
                        {"asset_name": {"$regex": q, "$options": "i"}},
                        {"returned_by": {"$regex": q, "$options": "i"}},
                        {"employee_code": {"$regex": q, "$options": "i"}}]
    if from_date or to_date:
        rng = {}
        if from_date:
            rng["$gte"] = from_date
        if to_date:
            rng["$lte"] = to_date
        query["return_date"] = rng
    total = await db.returns.count_documents(query)
    items = await db.returns.find(query, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/returns")
async def create_return(data: ReturnInput, request: Request,
                        user: dict = Depends(require_permission("assignments:write"))):
    delivery = await db.deliveries.find_one({"id": data.delivery_id})
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    if delivery.get("returned"):
        raise HTTPException(status_code=400, detail="Esta entrega ya fue devuelta")
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "asset_id": delivery.get("asset_id"),
                "asset_tag": delivery.get("asset_tag"), "asset_name": delivery.get("asset_name"),
                "returned_by": delivery.get("assigned_to_name"),
                "employee_code": delivery.get("employee_code"),
                "received_by": data.received_by or user.get("name"),
                "return_date": now_iso(), "created_at": now_iso()})
    await db.returns.insert_one(dict(doc))
    doc.pop("_id", None)
    await db.deliveries.update_one({"id": data.delivery_id},
                                   {"$set": {"returned": True, "return_date": now_iso()}})
    new_status = "danado" if data.condition in ("danado", "malo") else "disponible"
    await db.assets.update_one({"id": delivery.get("asset_id")}, {"$set": {
        "status": new_status, "assigned_to": None, "assigned_to_name": None, "updated_at": now_iso()}})
    await _asset_history(delivery.get("asset_id"), "return", user,
                         f"Devuelto por {delivery.get('assigned_to_name')} - condición {data.condition}")
    await log_audit(request, user, "return", "returns", doc["id"], None, doc,
                    f"Registró devolución de {delivery.get('asset_tag')}")
    return doc


# -------- Recepciones --------
@router.get("/receptions")
async def list_receptions(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                          user: dict = Depends(require_permission("assignments:read"))):
    total = await db.receptions.count_documents({})
    items = await db.receptions.find({}, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/receptions")
async def create_reception(data: ReceptionInput, request: Request,
                           user: dict = Depends(require_permission("assignments:write"))):
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "received_by": user.get("name"),
                "received_by_email": user.get("email"), "reception_date": now_iso(),
                "created_at": now_iso()})
    await db.receptions.insert_one(dict(doc))
    doc.pop("_id", None)
    if data.asset_id:
        await _asset_history(data.asset_id, "reception", user, f"Recepción registrada: {data.description}")
    await log_audit(request, user, "reception", "receptions", doc["id"], None, doc,
                    f"Registró recepción: {data.description}")
    return doc
