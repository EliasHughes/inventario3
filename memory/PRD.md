# PRD — Cisa TI · Plataforma ITAM (César Iglesias S.A.)

## Problema / Visión
Rediseñar la app de inventario del Depto. de Tecnología en una plataforma empresarial integral de
gestión de activos tecnológicos (ITAM), portable al ecosistema Microsoft On-Premise (Windows Server,
SQL Server, IIS, Active Directory). Preview funcional sobre FastAPI + React + MongoDB.

## Decisiones (confirmadas con el usuario)
- Plataforma ITAM completa funcional en FastAPI + React + MongoDB + doc. de portabilidad a Windows/SQL/AD.
- Auth: JWT + RBAC con usuarios/roles/permisos en BD.
- Alcance: todos los módulos.
- Idioma: Español. Branding: rojo corporativo de César Iglesias (cesariglesias.com).

## Arquitectura
- Backend: FastAPI, Arquitectura Limpia (core/, routers/, crud genérico, auditoría, RBAC), MongoDB (Motor).
- Frontend: React 19 + Tailwind + shadcn/ui + Recharts. Fuentes Chivo + IBM Plex Sans. Primary HSL 353 100% 40%.
- Auth JWT (BCrypt, lockout, refresh), permisos `modulo:accion`, roles de sistema.

## Personas
- Administrador TI (acceso total), Gestor TI, Técnico de soporte, Auditor, Consulta.

## Implementado (2026-07-20) — MVP completo
- Auth JWT + RBAC + lockout + change-password + seeding idempotente.
- Módulos: Dashboard ejecutivo (KPIs, gráficos, alertas, actividad), Activos (CRUD, filtros, detalle,
  depreciación, historial inmutable, QR), Catálogos (7 entidades), Compras (órdenes/facturas/garantías),
  Asignaciones (entregas/devoluciones/recepciones con firma digital canvas), Mantenimientos,
  Software/Licencias, Inventario físico (sesiones, conteo por etiqueta/QR, conciliación vs sistema),
  Tickets/Incidencias (ITIL, comentarios, estados), Auditoría (bitácora inmutable con before/after),
  Usuarios/Roles (matriz de permisos granular), Configuración, Notificaciones.
- Soft delete en todas las entidades. Datos sembrados (12 activos, categorías, sucursales, etc.).
- Testing: 55/55 pruebas backend OK; flujos críticos frontend validados 100%.
- Documentación de portabilidad: /app/DESPLIEGUE_WINDOWS_ONPREMISE.md

## Backlog / Próximas mejoras (P1/P2)
- P1: Carga real de fotos/manuales/facturas (object storage → portable a File Server/DFS).
- P1: Reportes exportables (PDF/Excel) e impresión de actas de entrega/devolución con firma.
- P1: Escaneo de QR por cámara en inventario físico (frontend).
- P2: Depreciación avanzada, dashboards por sede/departamento con drill-down, tendencias históricas.
- P2: Notificaciones automáticas (garantías/licencias por vencer), integración correo (SendGrid/SMTP).
- P2: Integración Active Directory/LDAP real + SSO Kerberos (para despliegue on-premise).

## Credenciales
Ver /app/memory/test_credentials.md

## Ampliación (2026-08-13) — Módulo de Empleados, Reportes y UX de Entregas
### Nuevo
- **Módulo de Empleados** (/empleados): CRUD con código manual único, nombre, departamento (FK a /departments con CRUD completo), supervisor, cargo, correo, teléfono. Búsqueda por código o nombre. Filtro por departamento. Bloquea eliminación si tiene entregas activas.
- **Módulo de Reportes** (/reportes): 5 categorías — Equipos entregados por empleado en un día específico, Devoluciones por período, Equipos por estado, Equipos por departamento, Historial de asignaciones. Exportación a Excel (.xlsx) y PDF con branding Cisa TI.
- **Typeahead en Entregas**: búsqueda dinámica de empleados por código/nombre y de equipos por número de serie/nombre/MAC/etiqueta/hostname (mínimo 2 caracteres, debounce 220ms). Solo lista equipos con estado 'disponible'. Asignación automática con datos enriquecidos.
- **Typeahead en Devoluciones**: búsqueda dinámica sobre entregas activas por etiqueta, serie, MAC o empleado.
- **Dashboard clickeable**: todas las tarjetas KPI navegan a /activos con filtros (status, unassigned). Gráfico circular de estados y leyenda también clickeables. Barra de categorías clickeable.
- **Colores unificados por estado**: componente StatusBadge y paleta STATUS_META usados en listados, dashboard y detalles — Disponible (verde), Asignado/Entregado (azul), Mantenimiento (amarillo), Dañado (rojo), En tránsito (celeste), Reservado (morado), Baja (gris).

### Backend
- Nuevos permisos: `employees:{read,write,delete}`, `reports:read` (asignados a admin, gestor_ti, tecnico, auditor según rol).
- Nuevos endpoints:
  - GET/POST/PUT/DELETE `/api/employees`, GET `/api/employees/search?q=`
  - GET `/api/assets/search?q=&available_only=`
  - GET `/api/reports/categories`, `/api/reports/preview`, `/api/reports/export?format=xlsx|pdf`
  - GET `/api/deliveries?q=&from_date=&to_date=&employee_id=` (búsqueda ampliada)
  - GET `/api/returns?q=&from_date=&to_date=` (búsqueda ampliada)
- Dependencias añadidas: openpyxl, reportlab (backend); xlsx, jspdf, jspdf-autotable, file-saver (frontend, disponibles para futuras exportaciones cliente).

### Backlog (opcional)
- Bulk import de empleados desde Excel.
- Envío por correo del reporte generado.
- Reporte de garantías por vencer y de licencias por expirar.
- Fotografía del empleado.

## Fix (2026-08-13) — Login + Entregas vencidas
- **Login**: reseteado el password_hash del admin en Mongo (estaba desincronizado con .env). Mensaje de error en Login.jsx ahora refleja el `detail` del backend (401/429).
- **Entregas vencidas en rojo**: helpers `isOverdue` / `daysOverdue` en Assignments.jsx.
  - /entregas: fila con bg-red-50, badge "Vencida Xd" y StatusBadge en rojo cuando expected_return < hoy y no está devuelta.
  - /devoluciones: nueva sección "Entregas pendientes de devolución" con las mismas indicaciones + botón "Devolver" inline. Contador global "X vencida(s)".
- Testing agent: 27/27 backend + UI flows PASS (iteration_2.json).
