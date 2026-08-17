"""Módulo de Empleados: CRUD + búsqueda dinámica (typeahead).

Un empleado tiene:
- code: código manual único (ingresado por el usuario de TI)
- name: nombre completo
- department_id: FK a /departments
- supervisor: nombre del supervisor (texto)
- email, phone, position: opcionales
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from core.database import db
from core.deps import require_permission
from core.audit import log_audit

router = APIRouter(prefix="/employees", tags=["Empleados"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class EmployeeInput(BaseModel):
    code: str
    name: str
    department_id: Optional[str] = None
    supervisor: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    branch_id: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_employees(q: Optional[str] = None, department_id: Optional[str] = None,
                         page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                         user: dict = Depends(require_permission("employees:read"))):
    query = {"deleted": {"$ne": True}}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"code": {"$regex": q, "$options": "i"}},
                        {"email": {"$regex": q, "$options": "i"}}]
    if department_id:
        query["department_id"] = department_id
    total = await db.employees.count_documents(query)
    items = await db.employees.find(query, {"_id": 0}).sort("name", 1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    # Adjuntar nombre del departamento
    dep_ids = list({i.get("department_id") for i in items if i.get("department_id")})
    if dep_ids:
        deps = await db.departments.find({"id": {"$in": dep_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
        dep_map = {d["id"]: d["name"] for d in deps}
        for it in items:
            it["department_name"] = dep_map.get(it.get("department_id"))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/search")
async def search_employees(q: str = Query(..., min_length=1),
                           limit: int = Query(10, ge=1, le=25),
                           user: dict = Depends(require_permission("employees:read"))):
    """Autocompletado/typeahead para empleados por código o nombre."""
    query = {"deleted": {"$ne": True},
             "$or": [{"code": {"$regex": q, "$options": "i"}},
                     {"name": {"$regex": q, "$options": "i"}}]}
    items = await db.employees.find(query, {"_id": 0, "id": 1, "code": 1, "name": 1,
                                             "department_id": 1, "supervisor": 1,
                                             "position": 1}).limit(limit).to_list(limit)
    # nombre depto
    dep_ids = list({i.get("department_id") for i in items if i.get("department_id")})
    if dep_ids:
        deps = await db.departments.find({"id": {"$in": dep_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
        dep_map = {d["id"]: d["name"] for d in deps}
        for it in items:
            it["department_name"] = dep_map.get(it.get("department_id"))
    return {"items": items}


@router.get("/{emp_id}")
async def get_employee(emp_id: str, user: dict = Depends(require_permission("employees:read"))):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    if emp.get("department_id"):
        dep = await db.departments.find_one({"id": emp["department_id"]}, {"_id": 0, "name": 1})
        emp["department_name"] = dep.get("name") if dep else None
    return emp


@router.post("")
async def create_employee(data: EmployeeInput, request: Request,
                          user: dict = Depends(require_permission("employees:write"))):
    code = (data.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="El código del empleado es obligatorio")
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="El nombre del empleado es obligatorio")
    exists = await db.employees.find_one({"code": code, "deleted": {"$ne": True}})
    if exists:
        raise HTTPException(status_code=400, detail=f"Ya existe un empleado con el código {code}")
    doc = data.model_dump()
    doc["code"] = code
    doc["name"] = data.name.strip()
    doc["id"] = str(uuid.uuid4())
    doc["deleted"] = False
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    doc["created_by"] = user.get("email")
    await db.employees.insert_one(dict(doc))
    doc.pop("_id", None)
    await log_audit(request, user, "create", "employees", doc["id"], None, doc,
                    f"Registró empleado {doc['code']} · {doc['name']}")
    return doc


@router.put("/{emp_id}")
async def update_employee(emp_id: str, data: EmployeeInput, request: Request,
                          user: dict = Depends(require_permission("employees:write"))):
    before = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    new_code = (data.code or "").strip()
    if not new_code:
        raise HTTPException(status_code=400, detail="El código del empleado es obligatorio")
    if new_code != before.get("code"):
        clash = await db.employees.find_one({"code": new_code, "deleted": {"$ne": True},
                                              "id": {"$ne": emp_id}})
        if clash:
            raise HTTPException(status_code=400, detail=f"Ya existe un empleado con el código {new_code}")
    updates = data.model_dump()
    updates["code"] = new_code
    updates["name"] = data.name.strip()
    updates["updated_at"] = now_iso()
    updates["updated_by"] = user.get("email")
    await db.employees.update_one({"id": emp_id}, {"$set": updates})
    after = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    await log_audit(request, user, "update", "employees", emp_id, before, after,
                    f"Editó empleado {after.get('code')} · {after.get('name')}")
    return after


@router.delete("/{emp_id}")
async def delete_employee(emp_id: str, request: Request,
                          user: dict = Depends(require_permission("employees:delete"))):
    before = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    # No permitir eliminar si tiene entregas activas
    active = await db.deliveries.count_documents({"employee_id": emp_id, "returned": {"$ne": True},
                                                   "deleted": {"$ne": True}})
    if active:
        raise HTTPException(status_code=400,
                            detail=f"El empleado tiene {active} entrega(s) activa(s). Devuelva los equipos antes de eliminar.")
    await db.employees.update_one({"id": emp_id}, {"$set": {"deleted": True, "deleted_at": now_iso(),
                                                             "deleted_by": user.get("email")}})
    await log_audit(request, user, "delete", "employees", emp_id, before, None,
                    f"Eliminó empleado {before.get('code')}")
    return {"success": True}
