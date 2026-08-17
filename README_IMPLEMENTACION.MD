# Cisa TI · Plataforma ITAM — Guía de Implementación Completa

Plataforma empresarial de **Gestión de Activos Tecnológicos (ITAM)** para César Iglesias S.A.
Stack: **FastAPI (Python)** + **React** + base de datos **MongoDB o SQL Server** (multi-motor).

> Este documento cubre: (1) estructura completa de carpetas y archivos, (2) cómo crear todo desde cero,
> (3) inicialización de la base de datos, (4) pruebas en **Windows 11 local**, y (5) despliegue en **IIS / Windows Server**.

---

## ÍNDICE
1. [Estructura de carpetas y archivos](#1-estructura-de-carpetas-y-archivos)
2. [¿Por qué existen los archivos `__init__.py`?](#2-por-qué-existen-los-archivos-__init__py)
3. [Requisitos previos](#3-requisitos-previos)
4. [Creación paso a paso (desde cero)](#4-creación-paso-a-paso-desde-cero)
5. [Inicializar la base de datos (SQL Server o MongoDB)](#5-inicializar-la-base-de-datos)
6. [Ejecutar y probar en Windows 11 local](#6-ejecutar-y-probar-en-windows-11-local)
7. [Despliegue en IIS / Windows Server](#7-despliegue-en-iis--windows-server)
8. [Credenciales por defecto](#8-credenciales-por-defecto)

---

## 1. Estructura de carpetas y archivos

```
cisa-ti/
│
├── backend/                         # === API FastAPI (Python) ===
│   ├── .env                         # Variables de entorno (NO subir a git)
│   ├── requirements.txt             # Dependencias Python
│   ├── server.py                    # Punto de entrada: crea la app, monta routers, CORS, startup
│   ├── seed.py                      # Semilla automática al arrancar (roles, admin, catálogos)
│   ├── init_database.py             # Script MULTI-MOTOR: crea BD en SQL Server o MongoDB
│   │
│   ├── core/                        # --- Núcleo / Infraestructura (Arquitectura Limpia) ---
│   │   ├── __init__.py              # Marca la carpeta como paquete Python
│   │   ├── config.py                # Carga .env y expone Settings (URLs, JWT, admin, etc.)
│   │   ├── database.py              # Conexión MongoDB (Motor) + creación de índices
│   │   ├── security.py              # Hash BCrypt + generación/validación de JWT
│   │   ├── deps.py                  # Dependencias: get_current_user + require_permission (RBAC)
│   │   ├── audit.py                 # log_audit(): bitácora inmutable (quién/qué/cuándo/IP/equipo)
│   │   ├── permissions.py           # Catálogo de módulos, permisos y roles por defecto
│   │   └── crud.py                  # Fábrica genérica de endpoints CRUD (list/get/create/update/soft-delete)
│   │
│   ├── routers/                     # --- Capa API: un archivo por módulo funcional ---
│   │   ├── __init__.py              # Marca la carpeta como paquete Python
│   │   ├── auth.py                  # /api/auth: login, logout, me, refresh, change-password
│   │   ├── users.py                 # /api/users, /api/roles, /api/permissions/catalog
│   │   ├── catalog.py               # /api/departments, /branches, /locations, /manufacturers,
│   │   │                            #   /models, /categories, /suppliers  (usa crud.py)
│   │   ├── assets.py                # /api/assets: CRUD, filtros, historial, QR, depreciación
│   │   ├── purchases.py             # /api/purchase-orders, /invoices, /warranties (usa crud.py)
│   │   ├── assignments.py           # /api/deliveries, /returns, /receptions (firma digital)
│   │   ├── maintenance.py           # /api/maintenance, /software, /licenses (usa crud.py)
│   │   ├── inventory.py             # /api/inventory: sesiones, conteo por QR, conciliación
│   │   ├── tickets.py               # /api/tickets: incidencias ITIL, estados, comentarios
│   │   ├── audit.py                 # /api/audit: consulta de la bitácora
│   │   ├── dashboard.py             # /api/dashboard: summary, charts, alerts, recent-activity
│   │   └── settings.py              # /api/settings + /api/notifications
│   │
│   └── tests/
│       └── backend_test.py          # Pruebas automatizadas (pytest)
│
└── frontend/                        # === Aplicación React ===
    ├── .env                         # REACT_APP_BACKEND_URL
    ├── package.json                 # Dependencias Node
    ├── tailwind.config.js           # Configuración de Tailwind
    ├── craco.config.js              # Alias @/ y configuración de build
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js                 # Bootstrap de React + React Query
        ├── index.css                # Estilos globales, tokens de color (rojo corporativo), fuentes
        ├── App.css
        ├── App.js                   # Router principal + rutas protegidas (RBAC)
        │
        ├── lib/
        │   ├── api.js               # Instancia axios (token Bearer) + helper de errores
        │   └── utils.js             # cn() (merge de clases Tailwind)
        │
        ├── context/
        │   └── AuthContext.jsx      # Estado de sesión, login/logout, hasPerm()
        │
        ├── constants/
        │   └── nav.jsx              # Definición del menú lateral (con permisos por ítem)
        │
        ├── components/
        │   ├── AppLayout.jsx        # Sidebar + topbar + contenedor
        │   ├── NotificationBell.jsx # Campana de notificaciones
        │   ├── PageHeader.jsx       # Encabezado reutilizable
        │   ├── StatusBadge.jsx      # Insignias de estado (colores)
        │   ├── ResourceManager.jsx  # Componente CRUD genérico (tabla + formulario en panel lateral)
        │   ├── SignaturePad.jsx     # Firma digital en canvas (entregas/devoluciones)
        │   └── ui/                  # Componentes base shadcn/ui (button, input, dialog, sheet, ...)
        │
        └── pages/
            ├── Login.jsx            # Pantalla de inicio de sesión
            ├── Dashboard.jsx        # Panel ejecutivo (KPIs, gráficos, alertas)
            ├── Assets.jsx           # Activos: lista, filtros, detalle, QR, historial
            ├── Assignments.jsx      # Entregas, Devoluciones, Recepciones (3 componentes)
            ├── Inventory.jsx        # Inventario físico y conciliación
            ├── Tickets.jsx          # Tickets / incidencias
            ├── Audit.jsx            # Bitácora de auditoría
            ├── UsersRoles.jsx       # Usuarios y Roles (matriz de permisos)
            ├── Settings.jsx         # Configuración del sistema
            ├── ChangePassword.jsx   # Cambio de contraseña
            └── ResourcePages.jsx    # Catálogos, compras, mantenimiento, software (usa ResourceManager)
```

---

## 2. ¿Por qué existen los archivos `__init__.py`?

Los archivos `core/__init__.py` y `routers/__init__.py` **NO están vacíos por error**: contienen el
comentario `# package` y son **obligatorios en Python** para que esas carpetas sean reconocidas como
"paquetes" y se puedan importar así:

```python
from core.config import settings
from routers import auth, users, assets
```

Sin `__init__.py`, Python no encuentra los módulos y la app no arranca. Puede dejarse solo con el comentario.

---

## 3. Requisitos previos

Instalar en el equipo (Windows 11 o Windows Server):

| Componente | Versión | Descarga |
|---|---|---|
| Python | 3.11+ | https://www.python.org/downloads/ (marcar "Add to PATH") |
| Node.js + Yarn | Node 18/20 LTS | https://nodejs.org — luego `npm install -g yarn` |
| **Una** base de datos | MongoDB 6+ **o** SQL Server 2019+ | https://www.mongodb.com/try/download/community · https://www.microsoft.com/sql-server |
| ODBC Driver (solo SQL Server) | 17 o 18 | "ODBC Driver for SQL Server" |
| Git (opcional) | — | https://git-scm.com |

---

## 4. Creación paso a paso (desde cero)

> Si ya tienes el repositorio, salta a la sección 5. Esta guía es para reconstruir la estructura manualmente.

### 4.1 Crear las carpetas
```powershell
mkdir cisa-ti
cd cisa-ti
mkdir backend, frontend
mkdir backend\core, backend\routers, backend\tests
mkdir frontend\src
mkdir frontend\src\lib, frontend\src\context, frontend\src\constants
mkdir frontend\src\components, frontend\src\components\ui, frontend\src\pages
```

### 4.2 Colocar los archivos del BACKEND
Coloca cada archivo `.py` en su carpeta según la [estructura de la sección 1](#1-estructura-de-carpetas-y-archivos):
- `server.py`, `seed.py`, `init_database.py`, `requirements.txt`, `.env` → en `backend/`
- `config.py`, `database.py`, `security.py`, `deps.py`, `audit.py`, `permissions.py`, `crud.py`, `__init__.py` → en `backend/core/`
- `auth.py`, `users.py`, `catalog.py`, `assets.py`, `purchases.py`, `assignments.py`, `maintenance.py`, `inventory.py`, `tickets.py`, `audit.py`, `dashboard.py`, `settings.py`, `__init__.py` → en `backend/routers/`

Crear el archivo **`backend/.env`**:
```dotenv
# --- Comunes ---
DB_ENGINE=auto
JWT_SECRET=cambie-esto-por-64-caracteres-hex-aleatorios
ACCESS_TOKEN_MINUTES=60
REFRESH_TOKEN_DAYS=7
ADMIN_EMAIL=admin@cesariglesias.com
ADMIN_PASSWORD=Admin2026!
ADMIN_NAME=Administrador TI
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
CORS_ORIGINS=*
FRONTEND_URL=http://localhost:3000

# --- MongoDB (si usas Mongo) ---
MONGO_URL=mongodb://localhost:27017
DB_NAME=cisa_ti_itam

# --- SQL Server (si usas SQL Server) ---
SQLSERVER_HOST=localhost\SQLEXPRESS
SQLSERVER_DB=cisa_ti_itam
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=TuPasswordSeguro
SQLSERVER_DRIVER=ODBC Driver 17 for SQL Server
```

### 4.3 Colocar los archivos del FRONTEND
Coloca cada archivo `.jsx`/`.js` en su carpeta (ver estructura). Crear **`frontend/.env`**:
```dotenv
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 4.4 Instalar dependencias
```powershell
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Conector de BD según el motor:
pip install pymongo            # si usas MongoDB
pip install pyodbc             # si usas SQL Server

# Frontend
cd ..\frontend
yarn install
```

---

## 5. Inicializar la base de datos

El script **`backend/init_database.py`** detecta automáticamente el motor disponible y crea **toda**
la estructura (tablas/colecciones, campos, índices, claves foráneas y datos base: roles, permisos,
usuario administrador y catálogos).

```powershell
cd backend
venv\Scripts\activate

# Autodetección (prueba SQL Server, luego MongoDB)
python init_database.py

# Forzar un motor específico
python init_database.py --engine sqlserver
python init_database.py --engine mongodb
```

Salida esperada:
```
 Cisa TI · Inicializador de Base de Datos
Autodetectando motor de base de datos...
  -> Detectado: SQL Server
SQL Server · base de datos 'cisa_ti_itam' verificada/creada.
  Tablas normalizadas creadas (con claves foráneas y soft delete).
  Índices creados.
  Roles, administrador, catálogos y configuración base creados.
SQL Server inicializado correctamente.
```

> **Nota:** El backend en el preview usa MongoDB (`core/database.py`). Para operar sobre SQL Server en
> producción, la capa de repositorios (`core/crud.py` y los routers) debe apuntar a SQL Server
> (SQLAlchemy async + aioodbc). El script `init_database.py` ya deja el **esquema SQL Server completo creado**.
> Ver `DESPLIEGUE_WINDOWS_ONPREMISE.md` para el detalle de la portabilidad.

---

## 6. Ejecutar y probar en Windows 11 local

### 6.1 Levantar el backend (API)
```powershell
cd backend
venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
- API: http://localhost:8001/api/health  → `{"status":"healthy"}`
- Documentación OpenAPI (Swagger): **http://localhost:8001/docs**

### 6.2 Levantar el frontend (en otra terminal)
```powershell
cd frontend
yarn start
```
- App: **http://localhost:3000**

### 6.3 Probar
1. Abre http://localhost:3000 → inicia sesión con el admin (sección 8).
2. Verifica el **Panel Ejecutivo** (KPIs y gráficos).
3. Crea un **Activo** en el módulo *Activos Tecnológicos*; genera su **QR**.
4. Registra una **Entrega** con firma y luego una **Devolución**.
5. Crea una **Sesión de Inventario Físico**, cuenta activos por etiqueta y **Concilia**.
6. Revisa la **Auditoría**: cada acción queda registrada con usuario, IP y equipo.

### 6.4 Pruebas automatizadas (opcional)
```powershell
cd backend
venv\Scripts\activate
pytest tests\backend_test.py -v
```

---

## 7. Despliegue en IIS / Windows Server

Objetivo: **IIS** sirve el frontend estático y actúa como **Reverse Proxy** hacia el backend FastAPI,
que corre como **Servicio de Windows**.

### 7.1 Compilar el frontend
```powershell
cd frontend
# Apunta el frontend al dominio de producción:
#   frontend\.env  ->  REACT_APP_BACKEND_URL=https://itam.cesariglesias.com
yarn build
```
Copia el contenido de `frontend/build/` al sitio de IIS, p.ej. `C:\inetpub\wwwroot\cisa-ti`.

### 7.2 Backend como Servicio de Windows
Instala un servidor WSGI/ASGI de producción y NSSM:
```powershell
cd backend
venv\Scripts\activate
pip install uvicorn
# Descarga NSSM (https://nssm.cc) y registra el servicio:
nssm install CisaTI-API "C:\ruta\cisa-ti\backend\venv\Scripts\python.exe" ^
  "-m uvicorn server:app --host 127.0.0.1 --port 8001 --workers 4"
nssm set CisaTI-API AppDirectory "C:\ruta\cisa-ti\backend"
nssm start CisaTI-API
```
El servicio arranca automáticamente con el servidor y reinicia si falla.

### 7.3 Configurar IIS
1. Instala en IIS: **URL Rewrite** y **Application Request Routing (ARR)**.
   Panel de ARR → *Server Proxy Settings* → marcar **Enable proxy**.
2. Crea un **Sitio Web** apuntando a `C:\inetpub\wwwroot\cisa-ti` (puerto 443 con certificado SSL).
3. Crea el archivo `C:\inetpub\wwwroot\cisa-ti\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Enruta /api/* al backend FastAPI -->
        <rule name="ProxyAPI" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:8001/api/{R:1}" />
        </rule>
        <!-- SPA: cualquier otra ruta sirve index.html (React Router) -->
        <rule name="ReactRoutes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api/" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 7.4 Autenticación con Active Directory (SSO) — producción
- Habilita **Windows Authentication (Negotiate/Kerberos)** en el sitio de IIS para SSO transparente.
- El backend valida el usuario contra **AD (LDAP)** y mapea grupos de AD a los roles internos.
- Detalle completo en `DESPLIEGUE_WINDOWS_ONPREMISE.md`.

### 7.5 Ajustes de producción
- En `backend/.env`: `CORS_ORIGINS=https://itam.cesariglesias.com` y `FRONTEND_URL` con el mismo dominio.
- Cookies `secure=True` (HTTPS). Cambia `JWT_SECRET` y `ADMIN_PASSWORD`.
- Base de datos: **SQL Server Always On** + respaldos (SQL Server Backup + Windows Server Backup).
- Monitoreo: Event Viewer / Performance Monitor / System Center / PRTG / Zabbix (usar `/api/health`).

---

## 8. Credenciales por defecto

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin@cesariglesias.com` | `Admin2026!` |
| Técnico de Soporte | `tecnico@cesariglesias.com` | `Tecnico2026!` |

> Cambia estas contraseñas en producción (variables `ADMIN_*` en `.env` y desde *Usuarios y Roles* en la app).

---

### Resumen de comandos rápidos
```powershell
# 1. Instalar dependencias
cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt && pip install pymongo pyodbc
cd ..\frontend && yarn install

# 2. Crear la base de datos
cd ..\backend && python init_database.py

# 3. Ejecutar (2 terminales)
uvicorn server:app --port 8001 --reload      # Terminal A (backend)
cd ..\frontend && yarn start                 # Terminal B (frontend)
```
