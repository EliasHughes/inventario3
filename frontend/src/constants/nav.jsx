import {
  LayoutDashboard, Monitor,MonitorPlay, Truck, RotateCcw, Inbox, Wrench, AppWindow,
  KeyRound, ScanLine, Ticket, ShieldCheck, Users, Settings, Building2,
  MapPin, Factory, Boxes, Tags, ShoppingCart, FileText, BadgeCheck,
  UserSquare2, BarChart3,
} from "lucide-react";

// grouped navigation with permission gate (perm=null means always visible)
export const NAV_GROUPS = [
  {
    title: "General",
    items: [
      { to: "/", label: "Panel Ejecutivo", icon: LayoutDashboard, perm: "dashboard:read", testid: "nav-dashboard" },
      { to: "/activos", label: "Activos Tecnológicos", icon: Monitor, perm: "assets:read", testid: "nav-assets" },
      { to: "/control-remoto", label: "Control remoto", icon: MonitorPlay, testid: "nav-control-remoto" },
      { to: "/empleados", label: "Empleados", icon: UserSquare2, perm: "employees:read", testid: "nav-employees" },
      { to: "/reportes", label: "Reportes", icon: BarChart3, perm: "reports:read", testid: "nav-reports" },
    ],
  },
  {
    title: "Operación",
    items: [
      { to: "/entregas", label: "Entregas", icon: Truck, perm: "assignments:read", testid: "nav-deliveries" },
      { to: "/devoluciones", label: "Devoluciones", icon: RotateCcw, perm: "assignments:read", testid: "nav-returns" },
      { to: "/recepciones", label: "Recepciones", icon: Inbox, perm: "assignments:read", testid: "nav-receptions" },
      { to: "/mantenimientos", label: "Mantenimientos", icon: Wrench, perm: "maintenance:read", testid: "nav-maintenance" },
      { to: "/inventario-fisico", label: "Inventario Físico", icon: ScanLine, perm: "inventory:read", testid: "nav-inventory" },
      { to: "/tickets", label: "Tickets / Incidencias", icon: Ticket, perm: "tickets:read", testid: "nav-tickets" },
    ],
  },
  {
    title: "Software y Compras",
    items: [
      { to: "/software", label: "Software", icon: AppWindow, perm: "software:read", testid: "nav-software" },
      { to: "/licencias", label: "Licencias", icon: KeyRound, perm: "software:read", testid: "nav-licenses" },
      { to: "/ordenes-compra", label: "Órdenes de Compra", icon: ShoppingCart, perm: "purchases:read", testid: "nav-po" },
      { to: "/facturas", label: "Facturas", icon: FileText, perm: "purchases:read", testid: "nav-invoices" },
      { to: "/garantias", label: "Garantías", icon: BadgeCheck, perm: "purchases:read", testid: "nav-warranties" },
    ],
  },
  {
    title: "Catálogos",
    items: [
      { to: "/departamentos", label: "Departamentos", icon: Building2, perm: "catalog:read", testid: "nav-departments" },
      { to: "/sucursales", label: "Sucursales", icon: Building2, perm: "catalog:read", testid: "nav-branches" },
      { to: "/ubicaciones", label: "Ubicaciones", icon: MapPin, perm: "catalog:read", testid: "nav-locations" },
      { to: "/fabricantes", label: "Fabricantes", icon: Factory, perm: "catalog:read", testid: "nav-manufacturers" },
      { to: "/modelos", label: "Modelos", icon: Boxes, perm: "catalog:read", testid: "nav-models" },
      { to: "/categorias", label: "Categorías", icon: Tags, perm: "catalog:read", testid: "nav-categories" },
      { to: "/proveedores", label: "Proveedores", icon: Factory, perm: "catalog:read", testid: "nav-suppliers" },
    ],
  },
  {
    title: "Administración",
    items: [
      { to: "/auditoria", label: "Auditoría", icon: ShieldCheck, perm: "audit:read", testid: "nav-audit" },
      { to: "/usuarios", label: "Usuarios y Roles", icon: Users, perm: "users:read", testid: "nav-users" },
      { to: "/configuracion", label: "Configuración", icon: Settings, perm: "settings:read", testid: "nav-settings" },
    ],
  },
];
