from fastapi import Request, HTTPException, Depends
from core.security import decode_token
from core.database import db

ROLE_CACHE = {}


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"id": payload["sub"], "deleted": {"$ne": True}})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


async def get_user_permissions(user: dict) -> set:
    role_name = user.get("role")
    role = await db.roles.find_one({"name": role_name})
    perms = set(role.get("permissions", [])) if role else set()
    perms |= set(user.get("extra_permissions", []) or [])
    return perms


def require_permission(permission: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        perms = await get_user_permissions(user)
        if "*" in perms or permission in perms:
            return user
        raise HTTPException(status_code=403, detail="Permiso denegado: " + permission)
    return checker
