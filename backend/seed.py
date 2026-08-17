import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from core.database import db
from core.security import hash_password, verify_password
from core.config import settings
from core.permissions import DEFAULT_ROLES


async def seed():
    now = datetime.now(timezone.utc).isoformat()

    # Roles
    for role in DEFAULT_ROLES:
        existing = await db.roles.find_one({"name": role["name"]})
        if not existing:
            await db.roles.insert_one({"id": str(uuid.uuid4()), **role, "created_at": now})
        else:
            await db.roles.update_one({"name": role["name"]},
                                      {"$set": {"permissions": role["permissions"],
                                                "description": role["description"],
                                                "is_system": role["is_system"]}})

    # Admin
    admin = await db.users.find_one({"email": settings.ADMIN_EMAIL})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": settings.ADMIN_EMAIL,
            "name": settings.ADMIN_NAME, "password_hash": hash_password(settings.ADMIN_PASSWORD),
            "role": "admin", "is_active": True, "extra_permissions": [], "deleted": False,
            "created_at": now,
        })
    elif not verify_password(settings.ADMIN_PASSWORD, admin.get("password_hash", "")):
        await db.users.update_one({"email": settings.ADMIN_EMAIL},
                                  {"$set": {"password_hash": hash_password(settings.ADMIN_PASSWORD),
                                            "role": "admin", "is_active": True}})

    # Sample support user
    tech_email = "tecnico@cesariglesias.com"
    if not await db.users.find_one({"email": tech_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": tech_email, "name": "Técnico de Soporte",
            "password_hash": hash_password("Tecnico2026!"), "role": "tecnico",
            "is_active": True, "extra_permissions": [], "deleted": False, "created_at": now,
        })

    # Datos maestros base (solo si vacío)
    if await db.categories.count_documents({}) == 0:
        cats = [
            ("Laptop", "computo", 4), ("Desktop", "computo", 4), ("Servidor", "computo", 5),
            ("Monitor", "periferico", 5), ("Impresora", "periferico", 5), ("Escáner", "periferico", 5),
            ("Switch", "red", 7), ("Router", "red", 7), ("Firewall", "red", 5),
            ("Access Point", "red", 5), ("UPS", "energia", 4), ("Teléfono IP", "telefonia", 5),
            ("Dispositivo Móvil", "movil", 3), ("Lector Biométrico", "seguridad", 5),
            ("Hand Held", "movil", 4), ("Licencia Software", "software", 1),
        ]
        for name, tipo, dep in cats:
            await db.categories.insert_one({"id": str(uuid.uuid4()), "name": name, "type": tipo,
                                            "depreciation_years": dep, "deleted": False, "created_at": now})

    if await db.branches.count_documents({}) == 0:
        branches = [("Sede Central", "SC-01", "Santo Domingo", "Av. San Martín 236"),
                    ("Planta Haina", "PH-02", "Haina", "Zona Industrial Haina"),
                    ("Sucursal Santiago", "SS-03", "Santiago", "Av. Estrella Sadhalá")]
        for name, code, city, addr in branches:
            await db.branches.insert_one({"id": str(uuid.uuid4()), "name": name, "code": code,
                                          "city": city, "address": addr, "deleted": False, "created_at": now})

    if await db.departments.count_documents({}) == 0:
        deps = [("Tecnología", "TI"), ("Finanzas", "FIN"), ("Ventas", "VEN"),
                ("Recursos Humanos", "RRHH"), ("Operaciones", "OPS"), ("Logística", "LOG")]
        for name, code in deps:
            await db.departments.insert_one({"id": str(uuid.uuid4()), "name": name, "code": code,
                                             "deleted": False, "created_at": now})

    if await db.manufacturers.count_documents({}) == 0:
        for m in ["Dell", "HP", "Lenovo", "Cisco", "Fortinet", "APC", "Epson", "Ubiquiti", "Microsoft"]:
            await db.manufacturers.insert_one({"id": str(uuid.uuid4()), "name": m,
                                               "deleted": False, "created_at": now})

    if await db.suppliers.count_documents({}) == 0:
        for s in [("Tecnología Empresarial SRL", "130-12345-6"), ("CompuMundo RD", "101-98765-4")]:
            await db.suppliers.insert_one({"id": str(uuid.uuid4()), "name": s[0], "rnc": s[1],
                                           "deleted": False, "created_at": now})

    await _write_credentials()


async def _write_credentials():
    logger = logging.getLogger(__name__)
    content = f"""# Credenciales de Prueba - Cisa TI (ITAM)

## Administrador
- Email: {settings.ADMIN_EMAIL}
- Password: {settings.ADMIN_PASSWORD}
- Rol: admin (acceso total)

## Técnico de Soporte
- Email: tecnico@cesariglesias.com
- Password: Tecnico2026!
- Rol: tecnico

## Endpoints de autenticación
- POST /api/auth/login
- GET  /api/auth/me
- POST /api/auth/logout
- POST /api/auth/refresh
- POST /api/auth/change-password
"""
    try:
        memory = Path(__file__).parent / "memory"
        memory.mkdir(parents=True, exist_ok=True)
        (memory / "test_credentials.md").write_text(content, encoding="utf-8")
    except Exception as e:
        logger.warning("No se pudo escribir test_credentials.md: %s", e)
