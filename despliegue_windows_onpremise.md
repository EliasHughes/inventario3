# Guía de Despliegue On-Premise (Ecosistema Microsoft) — Cisa TI ITAM

> La plataforma corre en el preview sobre **FastAPI + React + MongoDB (Linux/contenedor)**.
> Este documento describe cómo portar la solución al entorno corporativo objetivo:
> **Windows Server 2022/2025 + SQL Server 2019 + IIS + Active Directory**.
> El backend implementa **Arquitectura Limpia** (Presentación · API · Servicios · Dominio · Repositorios · Infraestructura),
> lo que permite reemplazar la capa de Infraestructura (base de datos, auth) sin tocar el Dominio ni la API.

---

## 1. Arquitectura Objetivo

```
                    ┌───────────────────────────────────────────────┐
  Windows 11        │              Windows Server 2022/2025          │
  (Estación)        │                                                │
  Navegador ─────►  │  IIS (Reverse Proxy + SSL + Windows Auth)      │
                    │        │                                        │
                    │        ├─► Frontend React (build estático)      │
                    │        └─► ARR ─► FastAPI (Kestrel/Uvicorn)     │
                    │                     como Windows Service        │
                    │                        │                        │
                    │                        ▼                        │
                    │             SQL Server 2019 (Always On AG)      │
                    │             Windows File Server + DFS (docs)    │
                    │                                                │
                    │  Active Directory (LDAP/Kerberos) ── SSO        │
                    └───────────────────────────────────────────────┘
```

---

## 2. Base de Datos: de MongoDB a SQL Server 2019

El acceso a datos está centralizado en la capa de **Repositorios** (`core/crud.py`, routers). Para migrar:

1. Instalar **SQL Server 2019** + `pyodbc` / `SQLAlchemy` (async con `aioodbc`).
2. Crear la base de datos normalizada con las tablas del modelo de dominio (ver §6).
3. Reemplazar `core/database.py` (Motor) por un motor SQLAlchemy async y adaptar `make_crud_router`
   para usar sesiones SQLAlchemy en lugar de colecciones Motor. La firma de los repositorios se mantiene.
4. **Índices y claves foráneas**: crear FKs entre `assets`, `categories`, `branches`, etc. e índices en
   `asset_tag`, `serial_number`, `status`, `category_id`, `branch_id`, `audit_logs.timestamp`.
5. **Soft Delete**: conservar la columna `deleted BIT NOT NULL DEFAULT 0` + `deleted_at`, `deleted_by`.
6. **Procedimientos almacenados**: usarlos SOLO donde aporten rendimiento (p.ej. agregaciones del dashboard,
   reportes de conciliación de inventario).
7. **Concurrencia**: usar columna `rowversion`/`updated_at` para control optimista de concurrencia.

### Alta Disponibilidad
- Configurar **SQL Server Always On Availability Groups** (mínimo 2 réplicas + testigo).
- Respaldos: **SQL Server Backup** (full diario + differential + transaction log cada 15 min) y
  **Windows Server Backup** para el File Server de documentos.

---

## 3. Autenticación: JWT → Active Directory + SSO

El preview usa **JWT + RBAC** (BCrypt) con roles/permisos en base de datos. Para el entorno corporativo:

- **Windows Authentication / Kerberos** habilitado en IIS (Negotiate) para SSO transparente.
- **LDAP**: validar credenciales y sincronizar grupos de AD contra los roles internos
  (mapa `Grupo AD → Rol Cisa TI`). Librería sugerida: `ldap3` o `pyspnego`.
- La API sigue emitiendo **JWT** para clientes desacoplados; el claim de identidad proviene del usuario AD.
- Mantener el modelo **RBAC granular** existente (`core/permissions.py`): los permisos `modulo:accion`
  se asignan a los roles, y los roles se enlazan con grupos de seguridad de AD.
- Auditoría: registrar el **usuario autenticado de AD**, IP, nombre del equipo Windows (ya soportado en
  `core/audit.py` vía cabecera `x-machine-name`).

---

## 4. Servidor Web: IIS como Reverse Proxy

1. Instalar **IIS** + módulos **URL Rewrite** y **Application Request Routing (ARR)**.
2. Publicar el build de React (`yarn build`) como sitio estático en IIS.
3. Ejecutar FastAPI con **Uvicorn/Hypercorn** enlazado a `127.0.0.1:8001`, expuesto como
   **Windows Service** (usar `nssm` o un wrapper `pywin32`/`win32serviceutil`).
4. Regla de Reverse Proxy: `^/api/(.*)` → `http://127.0.0.1:8001/api/{R:1}`.
5. Habilitar **HTTPS** con certificado corporativo; poner cookies `secure=True` y `SameSite=Strict`.

---

## 5. Gestión Documental (File Server + DFS)

- Almacenar fotos, manuales, facturas y garantías en un **Windows File Server con DFS** (namespace replicado).
- La API guarda solo la ruta/URL lógica; los binarios viven en el recurso DFS con permisos NTFS por rol.
- Alternativa en el preview: subida a almacenamiento de objetos / base64 (portable a UNC path `\\dfs\cisa-ti\...`).

---

## 6. Modelo de Datos (Dominio Normalizado)

Colecciones/tablas implementadas: `users`, `roles` (permissions), `departments`, `branches`, `locations`,
`manufacturers`, `asset_models`, `categories`, `suppliers`, `purchase_orders`, `invoices`, `warranties`,
`assets`, `asset_history` (historial inmutable), `deliveries`, `returns`, `receptions`, `maintenance`,
`software`, `licenses`, `inventory_sessions`, `inventory_counts`, `tickets`, `audit_logs`, `notifications`,
`settings`, `login_attempts`.

Todas incluyen: `id` (UUID/PK), `created_at`, `updated_at`, `deleted` (soft delete), y campos de auditoría
`created_by`/`updated_by`/`deleted_by`.

---

## 7. Monitoreo, CI/CD y Operación

- **Monitoreo**: Windows **Event Viewer** + **Performance Monitor**; integración con **System Center**,
  **PRTG** o **Zabbix** (endpoint `/api/health` disponible para checks).
- **Logging estructurado**: ya implementado con `logging` (formato con timestamp/nivel); enviar a
  Event Log de Windows o a un colector central.
- **CI/CD**: pipelines en **Azure DevOps Server** o **GitHub Enterprise**
  (build React + build/empaquetado del servicio Python + despliegue a IIS y actualización del Windows Service).
- **Seguridad**: BCrypt/Argon2 (implementado BCrypt), protección contra SQL Injection (ORM parametrizado),
  XSS/CSRF (tokens + SameSite), políticas de contraseña, bloqueo por intentos fallidos (implementado),
  expiración de sesión y cifrado de datos sensibles (TDE en SQL Server).

---

## 8. Seguridad ya implementada en el preview

- Hash de contraseñas con **BCrypt**.
- **Bloqueo por intentos fallidos** (5 intentos → 15 min) por IP+usuario.
- **JWT** access (60 min) + refresh (7 días), httpOnly cookies + Bearer.
- **RBAC granular** con permisos `modulo:accion` y roles de sistema.
- **Auditoría completa e inmutable** (quién, qué, cuándo, IP, equipo, valores antes/después).
- **Soft Delete** en todas las entidades para conservar el historial.
- **Manejo global de excepciones** y validaciones centralizadas (Pydantic).
