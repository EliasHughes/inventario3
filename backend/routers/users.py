import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, EmailStr
from core.database import db
from core.deps import require_permission, get_current_user
from core.security import hash_password
from core.audit import log_audit
from core.permissions import (all_permissions, MODULES, ACTIONS, MODULE_LABELS,
                              ACTION_LABELS, DEFAULT_ROLES)

router = APIRouter(tags=["Usuarios y Roles"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "consulta"
    department_id: Optional[str] = None
    branch_id: Optional[str] = None
    employee_code: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    extra_permissions: list = []


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[str] = None
    branch_id: Optional[str] = None
    employee_code: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    extra_permissions: Optional[list] = None


class RoleInput(BaseModel):
    name: str
    description: str = ""
    permissions: list = []


# -------- Permisos catálogo --------
@router.get("/permissions/catalog")
async def permissions_catalog(user: dict = Depends(require_permission("users:read"))):
    catalog = []
    for m in MODULES:
        catalog.append({
            "module": m,
            "label": MODULE_LABELS.get(m, m),
            "permissions": [{"key": f"{m}:{a}", "label": ACTION_LABELS[a]} for a in ACTIONS],
        })
    return {"modules": catalog, "all": all_permissions()}


# -------- Roles --------
@router.get("/roles")
async def list_roles(user: dict = Depends(require_permission("users:read"))):
    roles = await db.roles.find({}, {"_id": 0}).to_list(200)
    for r in roles:
        r["user_count"] = await db.users.count_documents({"role": r["name"], "deleted": {"$ne": True}})
    return {"items": roles}


@router.post("/roles")
async def create_role(data: RoleInput, request: Request,
                      user: dict = Depends(require_permission("users:write"))):
    if await db.roles.find_one({"name": data.name}):
        raise HTTPException(status_code=400, detail="Ya existe un rol con ese nombre")
    doc = {"id": str(uuid.uuid4()), "name": data.name, "description": data.description,
           "permissions": data.permissions, "is_system": False, "created_at": now_iso()}
    await db.roles.insert_one(dict(doc))
    doc.pop("_id", None)
    await log_audit(request, user, "create", "roles", doc["id"], None, doc, "Creó rol")
    return doc


@router.put("/roles/{role_id}")
async def update_role(role_id: str, data: RoleInput, request: Request,
                      user: dict = Depends(require_permission("users:write"))):
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    updates = {"description": data.description, "permissions": data.permissions, "updated_at": now_iso()}
    if not role.get("is_system"):
        updates["name"] = data.name
    await db.roles.update_one({"id": role_id}, {"$set": updates})
    after = await db.roles.find_one({"id": role_id}, {"_id": 0})
    await log_audit(request, user, "update", "roles", role_id, role, after, "Editó rol")
    return after


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, request: Request,
                      user: dict = Depends(require_permission("users:delete"))):
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="No se puede eliminar un rol del sistema")
    if await db.users.count_documents({"role": role["name"], "deleted": {"$ne": True}}) > 0:
        raise HTTPException(status_code=400, detail="El rol tiene usuarios asignados")
    await db.roles.delete_one({"id": role_id})
    await log_audit(request, user, "delete", "roles", role_id, role, None, "Eliminó rol")
    return {"success": True}


# -------- Usuarios --------
@router.get("/users")
async def list_users(q: Optional[str] = None, page: int = Query(1, ge=1),
                     page_size: int = Query(50, ge=1, le=500),
                     user: dict = Depends(require_permission("users:read"))):
    query = {"deleted": {"$ne": True}}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"email": {"$regex": q, "$options": "i"}},
                        {"employee_code": {"$regex": q, "$options": "i"}}]
    total = await db.users.count_documents(query)
    items = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1) \
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/users")
async def create_user(data: UserCreate, request: Request,
                      user: dict = Depends(require_permission("users:write"))):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo")
    doc = {"id": str(uuid.uuid4()), "email": email, "name": data.name,
           "password_hash": hash_password(data.password), "role": data.role,
           "department_id": data.department_id, "branch_id": data.branch_id,
           "employee_code": data.employee_code, "phone": data.phone,
           "is_active": data.is_active, "extra_permissions": data.extra_permissions,
           "deleted": False, "created_at": now_iso(), "created_by": user.get("email")}
    await db.users.insert_one(dict(doc))
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    await log_audit(request, user, "create", "users", doc["id"], None, doc, "Creó usuario")
    return doc


@router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, request: Request,
                      user: dict = Depends(require_permission("users:write"))):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    updates["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": updates})
    after = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    await log_audit(request, user, "update", "users", user_id, target, after, "Editó usuario")
    return after


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request,
                      user: dict = Depends(require_permission("users:delete"))):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="No puede eliminar su propio usuario")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.users.update_one({"id": user_id}, {"$set": {"deleted": True, "is_active": False,
                                                         "deleted_at": now_iso()}})
    await log_audit(request, user, "delete", "users", user_id, target, None, "Eliminó usuario")
    return {"success": True}
