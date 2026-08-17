"""Catálogo central de módulos y permisos RBAC."""

MODULES = [
    "dashboard", "assets", "catalog", "purchases", "assignments",
    "maintenance", "software", "inventory", "tickets", "audit",
    "users", "notifications", "settings", "employees", "reports",
]

# Etiquetas legibles en español para permisos
ACTIONS = ["read", "write", "delete"]

ACTION_LABELS = {"read": "Ver", "write": "Crear/Editar", "delete": "Eliminar"}

MODULE_LABELS = {
    "dashboard": "Panel Ejecutivo",
    "assets": "Activos Tecnológicos",
    "catalog": "Catálogos (Depto/Sucursal/Fabricante...)",
    "purchases": "Compras y Garantías",
    "assignments": "Entregas / Devoluciones / Recepciones",
    "maintenance": "Mantenimientos",
    "software": "Software y Licencias",
    "inventory": "Inventario Físico",
    "tickets": "Tickets / Incidencias",
    "audit": "Auditoría",
    "users": "Usuarios / Roles",
    "notifications": "Notificaciones",
    "settings": "Configuración",
    "employees": "Empleados",
    "reports": "Reportes",
}


def all_permissions():
    perms = []
    for m in MODULES:
        for a in ACTIONS:
            perms.append(f"{m}:{a}")
    return perms


DEFAULT_ROLES = [
    {
        "name": "admin",
        "description": "Administrador del sistema con acceso total.",
        "permissions": ["*"],
        "is_system": True,
    },
    {
        "name": "gestor_ti",
        "description": "Gestor de TI: administra activos, compras, asignaciones y mantenimientos.",
        "permissions": [
            "dashboard:read", "assets:read", "assets:write", "assets:delete",
            "catalog:read", "catalog:write", "purchases:read", "purchases:write",
            "assignments:read", "assignments:write", "maintenance:read", "maintenance:write",
            "software:read", "software:write", "inventory:read", "inventory:write",
            "tickets:read", "tickets:write", "notifications:read",
            "employees:read", "employees:write", "employees:delete",
            "reports:read",
        ],
        "is_system": True,
    },
    {
        "name": "tecnico",
        "description": "Técnico de soporte: gestiona asignaciones, mantenimientos y tickets.",
        "permissions": [
            "dashboard:read", "assets:read", "catalog:read", "assignments:read",
            "assignments:write", "maintenance:read", "maintenance:write",
            "inventory:read", "inventory:write", "tickets:read", "tickets:write",
            "employees:read", "reports:read",
        ],
        "is_system": True,
    },
    {
        "name": "auditor",
        "description": "Auditor: acceso de solo lectura y a la bitácora de auditoría.",
        "permissions": [
            "dashboard:read", "assets:read", "catalog:read", "purchases:read",
            "assignments:read", "maintenance:read", "software:read",
            "inventory:read", "tickets:read", "audit:read",
            "employees:read", "reports:read",
        ],
        "is_system": True,
    },
    {
        "name": "consulta",
        "description": "Consulta: solo lectura del inventario y panel.",
        "permissions": ["dashboard:read", "assets:read", "catalog:read"],
        "is_system": True,
    },
]
