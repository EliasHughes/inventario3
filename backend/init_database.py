"""
================================================================================
 Cisa TI · Inicializador de Base de Datos (Multi-Motor)
================================================================================
Detecta automáticamente qué motor de base de datos está disponible en el equipo
(SQL Server 2019+ o MongoDB) y crea TODA la estructura necesaria:
  - Tablas / colecciones normalizadas con sus campos
  - Índices y claves foráneas (en SQL Server)
  - Soft delete
  - Datos base (roles, permisos, usuario administrador, catálogos)

USO:
    python init_database.py                 # autodetecta el motor
    python init_database.py --engine mongodb
    python init_database.py --engine sqlserver

Variables de entorno (archivo backend/.env):
  # Comunes
  DB_ENGINE=auto|mongodb|sqlserver          (opcional, por defecto: auto)
  ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME

  # MongoDB
  MONGO_URL=mongodb://localhost:27017
  DB_NAME=cisa_ti_itam

  # SQL Server
  SQLSERVER_HOST=localhost\\SQLEXPRESS
  SQLSERVER_DB=cisa_ti_itam
  SQLSERVER_USER=sa                         (vacío = Windows Authentication)
  SQLSERVER_PASSWORD=TuPassword
  SQLSERVER_DRIVER=ODBC Driver 17 for SQL Server
================================================================================
"""
import os
import sys
import json
import uuid
import argparse
from datetime import datetime, timezone

import bcrypt
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT, ".env"))

NOW = datetime.now(timezone.utc).isoformat()


# ----------------------------------------------------------------------------
# Datos base compartidos (roles, admin, catálogos)
# ----------------------------------------------------------------------------
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()


DEFAULT_ROLES = [
    {"name": "admin", "description": "Administrador del sistema con acceso total.",
     "permissions": ["*"], "is_system": True},
    {"name": "gestor_ti", "description": "Gestor de TI: activos, compras, asignaciones y mantenimientos.",
     "permissions": ["dashboard:read", "assets:read", "assets:write", "assets:delete", "catalog:read",
                     "catalog:write", "purchases:read", "purchases:write", "assignments:read",
                     "assignments:write", "maintenance:read", "maintenance:write", "software:read",
                     "software:write", "inventory:read", "inventory:write", "tickets:read",
                     "tickets:write", "notifications:read"], "is_system": True},
    {"name": "tecnico", "description": "Técnico de soporte: asignaciones, mantenimientos y tickets.",
     "permissions": ["dashboard:read", "assets:read", "catalog:read", "assignments:read",
                     "assignments:write", "maintenance:read", "maintenance:write", "inventory:read",
                     "inventory:write", "tickets:read", "tickets:write"], "is_system": True},
    {"name": "auditor", "description": "Auditor: solo lectura y bitácora de auditoría.",
     "permissions": ["dashboard:read", "assets:read", "catalog:read", "purchases:read",
                     "assignments:read", "maintenance:read", "software:read", "inventory:read",
                     "tickets:read", "audit:read"], "is_system": True},
    {"name": "consulta", "description": "Consulta: solo lectura del inventario y panel.",
     "permissions": ["dashboard:read", "assets:read", "catalog:read"], "is_system": True},
]

CATEGORIES = [
    ("Laptop", "computo", 4), ("Desktop", "computo", 4), ("Servidor", "computo", 5),
    ("Monitor", "periferico", 5), ("Impresora", "periferico", 5), ("Escáner", "periferico", 5),
    ("Switch", "red", 7), ("Router", "red", 7), ("Firewall", "red", 5), ("Access Point", "red", 5),
    ("UPS", "energia", 4), ("Teléfono IP", "telefonia", 5), ("Dispositivo Móvil", "movil", 3),
    ("Lector Biométrico", "seguridad", 5), ("Hand Held", "movil", 4), ("Licencia Software", "software", 1),
]
BRANCHES = [("Sede Central", "SC-01", "Santo Domingo", "Av. San Martín 236"),
            ("Planta Haina", "PH-02", "Haina", "Zona Industrial Haina"),
            ("Sucursal Santiago", "SS-03", "Santiago", "Av. Estrella Sadhalá")]
DEPARTMENTS = [("Tecnología", "TI"), ("Finanzas", "FIN"), ("Ventas", "VEN"),
               ("Recursos Humanos", "RRHH"), ("Operaciones", "OPS"), ("Logística", "LOG")]
MANUFACTURERS = ["Dell", "HP", "Lenovo", "Cisco", "Fortinet", "APC", "Epson", "Ubiquiti", "Microsoft"]
SUPPLIERS = [("Tecnología Empresarial SRL", "130-12345-6"), ("CompuMundo RD", "101-98765-4")]

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@cesariglesias.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin2026!")
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Administrador TI")


# ============================================================================
# DETECCIÓN DE MOTOR
# ============================================================================
def try_sqlserver():
    try:
        import pyodbc  # noqa
    except ImportError:
        return None
    conn_str = build_sqlserver_conn(master=True)
    try:
        cn = pyodbc.connect(conn_str, timeout=4)
        cn.close()
        return "sqlserver"
    except Exception:
        return None


def try_mongodb():
    try:
        from pymongo import MongoClient
    except ImportError:
        return None
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    try:
        c = MongoClient(url, serverSelectionTimeoutMS=3000)
        c.admin.command("ping")
        c.close()
        return "mongodb"
    except Exception:
        return None


def detect_engine():
    override = os.environ.get("DB_ENGINE", "auto").lower()
    if override in ("mongodb", "sqlserver"):
        return override
    print("Autodetectando motor de base de datos...")
    for fn, name in [(try_sqlserver, "SQL Server"), (try_mongodb, "MongoDB")]:
        eng = fn()
        if eng:
            print(f"  -> Detectado: {name}")
            return eng
    return None


def build_sqlserver_conn(master=False):
    driver = os.environ.get("SQLSERVER_DRIVER", "ODBC Driver 17 for SQL Server")
    host = os.environ.get("SQLSERVER_HOST", "localhost\\SQLEXPRESS")
    db = "master" if master else os.environ.get("SQLSERVER_DB", "cisa_ti_itam")
    user = os.environ.get("SQLSERVER_USER", "")
    pwd = os.environ.get("SQLSERVER_PASSWORD", "")
    parts = [f"DRIVER={{{driver}}}", f"SERVER={host}", f"DATABASE={db}",
             "TrustServerCertificate=yes"]
    if user:
        parts += [f"UID={user}", f"PWD={pwd}"]
    else:
        parts.append("Trusted_Connection=yes")
    return ";".join(parts) + ";"


# ============================================================================
# MONGODB
# ============================================================================
def init_mongodb():
    from pymongo import MongoClient, ASCENDING
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "cisa_ti_itam")
    db = MongoClient(url)[dbname]
    print(f"MongoDB · base de datos '{dbname}'")

    # Índices
    db.users.create_index("email", unique=True)
    db.assets.create_index("asset_tag", unique=True, sparse=True)
    db.assets.create_index("serial_number")
    db.assets.create_index("status")
    db.assets.create_index("category_id")
    db.assets.create_index("branch_id")
    db.audit_logs.create_index("timestamp")
    db.login_attempts.create_index("identifier")
    db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    print("  Índices creados.")

    # Roles
    for r in DEFAULT_ROLES:
        db.roles.update_one({"name": r["name"]},
                            {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": NOW}, "$set": r},
                            upsert=True)
    # Admin
    if not db.users.find_one({"email": ADMIN_EMAIL}):
        db.users.insert_one({"id": str(uuid.uuid4()), "email": ADMIN_EMAIL, "name": ADMIN_NAME,
                             "password_hash": hash_password(ADMIN_PASSWORD), "role": "admin",
                             "is_active": True, "extra_permissions": [], "deleted": False, "created_at": NOW})
    # Catálogos
    if db.categories.count_documents({}) == 0:
        db.categories.insert_many([{"id": str(uuid.uuid4()), "name": n, "type": t,
                                    "depreciation_years": d, "deleted": False, "created_at": NOW}
                                   for n, t, d in CATEGORIES])
    if db.branches.count_documents({}) == 0:
        db.branches.insert_many([{"id": str(uuid.uuid4()), "name": n, "code": c, "city": ci,
                                  "address": a, "deleted": False, "created_at": NOW}
                                 for n, c, ci, a in BRANCHES])
    if db.departments.count_documents({}) == 0:
        db.departments.insert_many([{"id": str(uuid.uuid4()), "name": n, "code": c,
                                     "deleted": False, "created_at": NOW} for n, c in DEPARTMENTS])
    if db.manufacturers.count_documents({}) == 0:
        db.manufacturers.insert_many([{"id": str(uuid.uuid4()), "name": m, "deleted": False,
                                       "created_at": NOW} for m in MANUFACTURERS])
    if db.suppliers.count_documents({}) == 0:
        db.suppliers.insert_many([{"id": str(uuid.uuid4()), "name": n, "rnc": r, "deleted": False,
                                   "created_at": NOW} for n, r in SUPPLIERS])
    print("  Roles, administrador y catálogos base creados.")
    print("MongoDB inicializado correctamente.")


# ============================================================================
# SQL SERVER
# ============================================================================
SQL_TABLES = [
    # roles
    """IF OBJECT_ID('roles','U') IS NULL CREATE TABLE roles(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(80) UNIQUE NOT NULL,
        description NVARCHAR(400), permissions NVARCHAR(MAX), is_system BIT DEFAULT 0,
        created_at NVARCHAR(40));""",
    # users
    """IF OBJECT_ID('users','U') IS NULL CREATE TABLE users(
        id NVARCHAR(36) PRIMARY KEY, email NVARCHAR(160) UNIQUE NOT NULL, name NVARCHAR(160),
        password_hash NVARCHAR(200), role NVARCHAR(80), department_id NVARCHAR(36),
        branch_id NVARCHAR(36), employee_code NVARCHAR(60), phone NVARCHAR(40),
        is_active BIT DEFAULT 1, extra_permissions NVARCHAR(MAX), last_login NVARCHAR(40),
        deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40), created_by NVARCHAR(160),
        updated_at NVARCHAR(40), updated_by NVARCHAR(160));""",
    # departments
    """IF OBJECT_ID('departments','U') IS NULL CREATE TABLE departments(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(160), code NVARCHAR(40), manager NVARCHAR(160),
        deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # branches
    """IF OBJECT_ID('branches','U') IS NULL CREATE TABLE branches(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(160), code NVARCHAR(40), city NVARCHAR(120),
        address NVARCHAR(300), phone NVARCHAR(40), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40),
        created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # locations
    """IF OBJECT_ID('locations','U') IS NULL CREATE TABLE locations(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(160), branch_id NVARCHAR(36), floor NVARCHAR(60),
        area NVARCHAR(120), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40),
        updated_at NVARCHAR(40),
        CONSTRAINT FK_loc_branch FOREIGN KEY (branch_id) REFERENCES branches(id));""",
    # manufacturers
    """IF OBJECT_ID('manufacturers','U') IS NULL CREATE TABLE manufacturers(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(160), website NVARCHAR(200), support_phone NVARCHAR(60),
        deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # categories
    """IF OBJECT_ID('categories','U') IS NULL CREATE TABLE categories(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(160), type NVARCHAR(60), depreciation_years INT,
        deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # asset_models
    """IF OBJECT_ID('asset_models','U') IS NULL CREATE TABLE asset_models(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(160), model_number NVARCHAR(120),
        manufacturer_id NVARCHAR(36), category_id NVARCHAR(36), deleted BIT DEFAULT 0,
        deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40),
        CONSTRAINT FK_model_man FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id),
        CONSTRAINT FK_model_cat FOREIGN KEY (category_id) REFERENCES categories(id));""",
    # suppliers
    """IF OBJECT_ID('suppliers','U') IS NULL CREATE TABLE suppliers(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(200), rnc NVARCHAR(40), contact_name NVARCHAR(160),
        phone NVARCHAR(40), email NVARCHAR(160), address NVARCHAR(300), deleted BIT DEFAULT 0,
        deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # purchase_orders
    """IF OBJECT_ID('purchase_orders','U') IS NULL CREATE TABLE purchase_orders(
        id NVARCHAR(36) PRIMARY KEY, po_number NVARCHAR(60), supplier_name NVARCHAR(200),
        order_date NVARCHAR(40), total DECIMAL(18,2), status NVARCHAR(40), notes NVARCHAR(MAX),
        deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # invoices
    """IF OBJECT_ID('invoices','U') IS NULL CREATE TABLE invoices(
        id NVARCHAR(36) PRIMARY KEY, invoice_number NVARCHAR(60), ncf NVARCHAR(40),
        supplier_name NVARCHAR(200), amount DECIMAL(18,2), invoice_date NVARCHAR(40),
        po_number NVARCHAR(60), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40),
        updated_at NVARCHAR(40));""",
    # warranties
    """IF OBJECT_ID('warranties','U') IS NULL CREATE TABLE warranties(
        id NVARCHAR(36) PRIMARY KEY, asset_tag NVARCHAR(60), provider NVARCHAR(200), type NVARCHAR(40),
        start_date NVARCHAR(40), end_date NVARCHAR(40), notes NVARCHAR(MAX), deleted BIT DEFAULT 0,
        deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # assets
    """IF OBJECT_ID('assets','U') IS NULL CREATE TABLE assets(
        id NVARCHAR(36) PRIMARY KEY, asset_tag NVARCHAR(60) UNIQUE, name NVARCHAR(200),
        serial_number NVARCHAR(120), category_id NVARCHAR(36), manufacturer_id NVARCHAR(36),
        model_id NVARCHAR(36), branch_id NVARCHAR(36), department_id NVARCHAR(36), location_id NVARCHAR(36),
        supplier_id NVARCHAR(36), status NVARCHAR(40), condition NVARCHAR(40), purchase_date NVARCHAR(40),
        purchase_cost DECIMAL(18,2), warranty_end NVARCHAR(40), depreciation_years INT,
        mac_address NVARCHAR(60), ip_address NVARCHAR(60), hostname NVARCHAR(120), specs NVARCHAR(MAX),
        notes NVARCHAR(MAX), photos NVARCHAR(MAX), documents NVARCHAR(MAX), assigned_to NVARCHAR(160),
        assigned_to_name NVARCHAR(160), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40),
        created_at NVARCHAR(40), created_by NVARCHAR(160), updated_at NVARCHAR(40), updated_by NVARCHAR(160),
        CONSTRAINT FK_asset_cat FOREIGN KEY (category_id) REFERENCES categories(id),
        CONSTRAINT FK_asset_branch FOREIGN KEY (branch_id) REFERENCES branches(id));""",
    # asset_history (inmutable)
    """IF OBJECT_ID('asset_history','U') IS NULL CREATE TABLE asset_history(
        id NVARCHAR(36) PRIMARY KEY, asset_id NVARCHAR(36), action NVARCHAR(60), detail NVARCHAR(MAX),
        before_json NVARCHAR(MAX), after_json NVARCHAR(MAX), user_email NVARCHAR(160),
        user_name NVARCHAR(160), timestamp NVARCHAR(40),
        CONSTRAINT FK_hist_asset FOREIGN KEY (asset_id) REFERENCES assets(id));""",
    # deliveries
    """IF OBJECT_ID('deliveries','U') IS NULL CREATE TABLE deliveries(
        id NVARCHAR(36) PRIMARY KEY, asset_id NVARCHAR(36), asset_tag NVARCHAR(60), asset_name NVARCHAR(200),
        serial_number NVARCHAR(120), assigned_to_name NVARCHAR(160), employee_code NVARCHAR(60),
        department_id NVARCHAR(36), branch_id NVARCHAR(36), expected_return NVARCHAR(40),
        condition NVARCHAR(40), notes NVARCHAR(MAX), signature NVARCHAR(MAX), accessories NVARCHAR(MAX),
        delivered_by NVARCHAR(160), delivered_by_email NVARCHAR(160), delivery_date NVARCHAR(40),
        returned BIT DEFAULT 0, return_date NVARCHAR(40), deleted BIT DEFAULT 0, created_at NVARCHAR(40),
        CONSTRAINT FK_deliv_asset FOREIGN KEY (asset_id) REFERENCES assets(id));""",
    # returns
    """IF OBJECT_ID('returns','U') IS NULL CREATE TABLE returns(
        id NVARCHAR(36) PRIMARY KEY, delivery_id NVARCHAR(36), asset_id NVARCHAR(36), asset_tag NVARCHAR(60),
        asset_name NVARCHAR(200), returned_by NVARCHAR(160), employee_code NVARCHAR(60),
        received_by NVARCHAR(160), condition NVARCHAR(40), notes NVARCHAR(MAX), signature NVARCHAR(MAX),
        return_date NVARCHAR(40), created_at NVARCHAR(40));""",
    # receptions
    """IF OBJECT_ID('receptions','U') IS NULL CREATE TABLE receptions(
        id NVARCHAR(36) PRIMARY KEY, asset_id NVARCHAR(36), description NVARCHAR(300),
        serial_number NVARCHAR(120), category_id NVARCHAR(36), delivered_by NVARCHAR(160),
        employee_code NVARCHAR(60), condition NVARCHAR(40), notes NVARCHAR(MAX), signature NVARCHAR(MAX),
        received_by NVARCHAR(160), received_by_email NVARCHAR(160), reception_date NVARCHAR(40),
        created_at NVARCHAR(40));""",
    # maintenance
    """IF OBJECT_ID('maintenance','U') IS NULL CREATE TABLE maintenance(
        id NVARCHAR(36) PRIMARY KEY, asset_tag NVARCHAR(60), type NVARCHAR(40), technician NVARCHAR(160),
        scheduled_date NVARCHAR(40), completed_date NVARCHAR(40), cost DECIMAL(18,2), status NVARCHAR(40),
        description NVARCHAR(MAX), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40),
        updated_at NVARCHAR(40));""",
    # software
    """IF OBJECT_ID('software','U') IS NULL CREATE TABLE software(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(200), publisher NVARCHAR(160), version NVARCHAR(60),
        type NVARCHAR(60), notes NVARCHAR(MAX), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40),
        created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # licenses
    """IF OBJECT_ID('licenses','U') IS NULL CREATE TABLE licenses(
        id NVARCHAR(36) PRIMARY KEY, software_name NVARCHAR(200), license_key NVARCHAR(200), type NVARCHAR(60),
        seats INT, seats_used INT, purchase_date NVARCHAR(40), expiry_date NVARCHAR(40),
        supplier_name NVARCHAR(200), deleted BIT DEFAULT 0, deleted_at NVARCHAR(40), created_at NVARCHAR(40),
        updated_at NVARCHAR(40));""",
    # inventory_sessions
    """IF OBJECT_ID('inventory_sessions','U') IS NULL CREATE TABLE inventory_sessions(
        id NVARCHAR(36) PRIMARY KEY, name NVARCHAR(200), branch_id NVARCHAR(36), department_id NVARCHAR(36),
        notes NVARCHAR(MAX), status NVARCHAR(40), counted INT DEFAULT 0, report NVARCHAR(MAX),
        created_by NVARCHAR(160), deleted BIT DEFAULT 0, created_at NVARCHAR(40));""",
    # inventory_counts
    """IF OBJECT_ID('inventory_counts','U') IS NULL CREATE TABLE inventory_counts(
        id NVARCHAR(36) PRIMARY KEY, session_id NVARCHAR(36), asset_tag NVARCHAR(60), asset_id NVARCHAR(36),
        asset_name NVARCHAR(200), found BIT, system_status NVARCHAR(40), condition NVARCHAR(40),
        location_note NVARCHAR(200), counted_by NVARCHAR(160), counted_at NVARCHAR(40),
        CONSTRAINT FK_count_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id));""",
    # tickets
    """IF OBJECT_ID('tickets','U') IS NULL CREATE TABLE tickets(
        id NVARCHAR(36) PRIMARY KEY, ticket_number NVARCHAR(40), title NVARCHAR(300), description NVARCHAR(MAX),
        type NVARCHAR(40), priority NVARCHAR(40), status NVARCHAR(40), asset_id NVARCHAR(36),
        asset_tag NVARCHAR(60), category NVARCHAR(80), assigned_to NVARCHAR(160), branch_id NVARCHAR(36),
        department_id NVARCHAR(36), reported_by NVARCHAR(160), reported_by_email NVARCHAR(160),
        resolution NVARCHAR(MAX), comments NVARCHAR(MAX), closed_at NVARCHAR(40), deleted BIT DEFAULT 0,
        deleted_at NVARCHAR(40), created_at NVARCHAR(40), updated_at NVARCHAR(40));""",
    # audit_logs (inmutable)
    """IF OBJECT_ID('audit_logs','U') IS NULL CREATE TABLE audit_logs(
        id NVARCHAR(36) PRIMARY KEY, action NVARCHAR(60), entity_type NVARCHAR(80), entity_id NVARCHAR(36),
        description NVARCHAR(400), before_json NVARCHAR(MAX), after_json NVARCHAR(MAX),
        user_id NVARCHAR(36), user_email NVARCHAR(160), user_name NVARCHAR(160), ip_address NVARCHAR(60),
        hostname NVARCHAR(200), timestamp NVARCHAR(40));""",
    # notifications
    """IF OBJECT_ID('notifications','U') IS NULL CREATE TABLE notifications(
        id NVARCHAR(36) PRIMARY KEY, user_id NVARCHAR(36), title NVARCHAR(200), message NVARCHAR(MAX),
        [read] BIT DEFAULT 0, created_at NVARCHAR(40));""",
    # settings
    """IF OBJECT_ID('settings','U') IS NULL CREATE TABLE settings(
        id NVARCHAR(36) PRIMARY KEY, company_name NVARCHAR(200), app_name NVARCHAR(120), currency NVARCHAR(10),
        password_min_length INT, session_minutes INT, warranty_alert_days INT, license_alert_days INT,
        updated_at NVARCHAR(40));""",
    # login_attempts
    """IF OBJECT_ID('login_attempts','U') IS NULL CREATE TABLE login_attempts(
        identifier NVARCHAR(200) PRIMARY KEY, count INT, last_attempt NVARCHAR(40), locked_until NVARCHAR(40));""",
]

SQL_INDEXES = [
    "IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_assets_status') CREATE INDEX IX_assets_status ON assets(status);",
    "IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_assets_serial') CREATE INDEX IX_assets_serial ON assets(serial_number);",
    "IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_assets_cat') CREATE INDEX IX_assets_cat ON assets(category_id);",
    "IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_assets_branch') CREATE INDEX IX_assets_branch ON assets(branch_id);",
    "IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_audit_ts') CREATE INDEX IX_audit_ts ON audit_logs(timestamp);",
    "IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_hist_asset') CREATE INDEX IX_hist_asset ON asset_history(asset_id);",
]


def init_sqlserver():
    import pyodbc
    dbname = os.environ.get("SQLSERVER_DB", "cisa_ti_itam")

    # 1) Crear la base de datos si no existe (conectando a master)
    master = pyodbc.connect(build_sqlserver_conn(master=True), autocommit=True)
    master.cursor().execute(
        f"IF DB_ID('{dbname}') IS NULL CREATE DATABASE [{dbname}];")
    master.close()
    print(f"SQL Server · base de datos '{dbname}' verificada/creada.")

    # 2) Conectar a la base y crear tablas + índices
    cn = pyodbc.connect(build_sqlserver_conn(master=False), autocommit=True)
    cur = cn.cursor()
    for ddl in SQL_TABLES:
        cur.execute(ddl)
    print("  Tablas normalizadas creadas (con claves foráneas y soft delete).")
    for ix in SQL_INDEXES:
        cur.execute(ix)
    print("  Índices creados.")

    # 3) Semilla
    def exists(table, where, params):
        cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", params)
        return cur.fetchone()[0] > 0

    for r in DEFAULT_ROLES:
        if not exists("roles", "name=?", (r["name"],)):
            cur.execute("INSERT INTO roles(id,name,description,permissions,is_system,created_at) VALUES(?,?,?,?,?,?)",
                        (str(uuid.uuid4()), r["name"], r["description"],
                         json.dumps(r["permissions"]), 1 if r["is_system"] else 0, NOW))
    if not exists("users", "email=?", (ADMIN_EMAIL,)):
        cur.execute("INSERT INTO users(id,email,name,password_hash,role,is_active,extra_permissions,deleted,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), ADMIN_EMAIL, ADMIN_NAME, hash_password(ADMIN_PASSWORD),
                     "admin", 1, "[]", 0, NOW))
    if not exists("categories", "1=1", ()):
        for n, t, d in CATEGORIES:
            cur.execute("INSERT INTO categories(id,name,type,depreciation_years,deleted,created_at) VALUES(?,?,?,?,?,?)",
                        (str(uuid.uuid4()), n, t, d, 0, NOW))
    if not exists("branches", "1=1", ()):
        for n, c, ci, a in BRANCHES:
            cur.execute("INSERT INTO branches(id,name,code,city,address,deleted,created_at) VALUES(?,?,?,?,?,?,?)",
                        (str(uuid.uuid4()), n, c, ci, a, 0, NOW))
    if not exists("departments", "1=1", ()):
        for n, c in DEPARTMENTS:
            cur.execute("INSERT INTO departments(id,name,code,deleted,created_at) VALUES(?,?,?,?,?)",
                        (str(uuid.uuid4()), n, c, 0, NOW))
    if not exists("manufacturers", "1=1", ()):
        for m in MANUFACTURERS:
            cur.execute("INSERT INTO manufacturers(id,name,deleted,created_at) VALUES(?,?,?,?)",
                        (str(uuid.uuid4()), m, 0, NOW))
    if not exists("suppliers", "1=1", ()):
        for n, r in SUPPLIERS:
            cur.execute("INSERT INTO suppliers(id,name,rnc,deleted,created_at) VALUES(?,?,?,?,?)",
                        (str(uuid.uuid4()), n, r, 0, NOW))
    if not exists("settings", "1=1", ()):
        cur.execute("INSERT INTO settings(id,company_name,app_name,currency,password_min_length,session_minutes,warranty_alert_days,license_alert_days) VALUES(?,?,?,?,?,?,?,?)",
                    ("system", "César Iglesias S.A.", "Cisa TI", "DOP", 8, 60, 60, 60))
    cn.close()
    print("  Roles, administrador, catálogos y configuración base creados.")
    print("SQL Server inicializado correctamente.")


# ============================================================================
# MAIN
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description="Inicializador de BD Cisa TI")
    parser.add_argument("--engine", choices=["auto", "mongodb", "sqlserver"], default=None)
    args = parser.parse_args()
    if args.engine:
        os.environ["DB_ENGINE"] = args.engine

    print("=" * 64)
    print(" Cisa TI · Inicializador de Base de Datos")
    print("=" * 64)
    engine = detect_engine()
    if not engine:
        print("\nERROR: No se detectó ningún motor de base de datos disponible.")
        print("  - Verifique que SQL Server o MongoDB esté instalado y en ejecución.")
        print("  - Revise las variables de conexión en backend/.env")
        print("  - Instale el conector: pip install pyodbc   (SQL Server)  o  pip install pymongo")
        sys.exit(1)
    try:
        if engine == "sqlserver":
            init_sqlserver()
        else:
            init_mongodb()
    except Exception as e:
        print(f"\nERROR durante la inicialización ({engine}): {e}")
        sys.exit(1)
    print("\nListo. Administrador: " + ADMIN_EMAIL)


if __name__ == "__main__":
    main()
