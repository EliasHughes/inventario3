import uuid
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from core.database import db
from core.security import (hash_password, verify_password, create_access_token,
                           create_refresh_token, decode_token)
from core.deps import get_current_user, get_user_permissions
from core.config import settings
from core.audit import log_audit, _client_ip

router = APIRouter(prefix="/auth", tags=["Autenticación"])


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


def _set_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False,
                        samesite="lax", max_age=settings.ACCESS_TOKEN_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False,
                        samesite="lax", max_age=settings.REFRESH_TOKEN_DAYS * 86400, path="/")


async def _public_user(user: dict) -> dict:
    user.pop("_id", None)
    user.pop("password_hash", None)
    perms = await get_user_permissions(user)
    user["permissions"] = sorted(perms)
    return user


@router.post("/login")
async def login(data: LoginInput, request: Request, response: Response):
    email = data.email.lower().strip()
    identifier = f"{_client_ip(request)}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("locked_until"):
        locked_until = datetime.fromisoformat(attempt["locked_until"])
        if locked_until > now:
            mins = int((locked_until - now).total_seconds() // 60) + 1
            raise HTTPException(status_code=429,
                                detail=f"Cuenta bloqueada por intentos fallidos. Intente en {mins} min.")

    user = await db.users.find_one({"email": email, "deleted": {"$ne": True}})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        count = (attempt.get("count", 0) if attempt else 0) + 1
        update = {"identifier": identifier, "count": count, "last_attempt": now.isoformat()}
        if count >= settings.MAX_LOGIN_ATTEMPTS:
            update["locked_until"] = (now + timedelta(minutes=settings.LOCKOUT_MINUTES)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        await log_audit(request, {"email": email}, "login_failed", "auth", None, None, None,
                        "Intento de inicio de sesión fallido")
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Usuario inactivo. Contacte al administrador.")

    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])
    _set_cookies(response, access, refresh)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now.isoformat()}})
    await log_audit(request, user, "login", "auth", user["id"], None, None, "Inicio de sesión exitoso")
    pub = await _public_user(user)
    return {"user": pub, "access_token": access, "refresh_token": refresh}


@router.post("/logout")
async def logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    await log_audit(request, user, "logout", "auth", user["id"], None, None, "Cierre de sesión")
    return {"success": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return await _public_user(user)


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sin token de actualización")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        access = create_access_token(user["id"], user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=False,
                            samesite="lax", max_age=settings.ACCESS_TOKEN_MINUTES * 60, path="/")
        return {"access_token": access}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


@router.post("/change-password")
async def change_password(data: ChangePasswordInput, request: Request,
                          user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(data.current_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")
    await db.users.update_one({"id": user["id"]},
                              {"$set": {"password_hash": hash_password(data.new_password),
                                        "updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_audit(request, user, "change_password", "auth", user["id"], None, None, "Cambió su contraseña")
    return {"success": True}
