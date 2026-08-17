import React from "react";
import ResourceManager from "@/components/ResourceManager";
import StatusBadge from "@/components/StatusBadge";
import {
  Building2, MapPin, Factory, Boxes, Tags, ShoppingCart, FileText,
  BadgeCheck, Wrench, AppWindow, KeyRound,
} from "lucide-react";

const money = (v) => (v ? `RD$ ${Number(v).toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : "—");
const date = (v) => (v ? new Date(v).toLocaleDateString("es-DO") : "—");

export function Departamentos() {
  return <ResourceManager title="Departamentos" subtitle="Áreas organizacionales de la empresa"
    icon={Building2} endpoint="/departments" permission="catalog"
    columns={[{ key: "name", label: "Nombre" }, { key: "code", label: "Código" }, { key: "manager", label: "Responsable" }]}
    fields={[
      { name: "name", label: "Nombre", required: true },
      { name: "code", label: "Código", colSpan: 1 },
      { name: "manager", label: "Responsable", colSpan: 1 },
    ]} />;
}

export function Sucursales() {
  return <ResourceManager title="Sucursales" subtitle="Sedes y plantas de César Iglesias"
    icon={Building2} endpoint="/branches" permission="catalog"
    columns={[{ key: "name", label: "Nombre" }, { key: "code", label: "Código" }, { key: "city", label: "Ciudad" }, { key: "address", label: "Dirección" }]}
    fields={[
      { name: "name", label: "Nombre", required: true },
      { name: "code", label: "Código", colSpan: 1 },
      { name: "city", label: "Ciudad", colSpan: 1 },
      { name: "address", label: "Dirección" },
      { name: "phone", label: "Teléfono", colSpan: 1 },
    ]} />;
}

export function Ubicaciones() {
  return <ResourceManager title="Ubicaciones" subtitle="Ubicaciones físicas dentro de las sucursales"
    icon={MapPin} endpoint="/locations" permission="catalog"
    columns={[{ key: "name", label: "Nombre" }, { key: "branch_id", label: "Sucursal", relation: true }, { key: "floor", label: "Piso" }, { key: "area", label: "Área" }]}
    fields={[
      { name: "name", label: "Nombre", required: true },
      { name: "branch_id", label: "Sucursal", relation: { endpoint: "/branches" } },
      { name: "floor", label: "Piso", colSpan: 1 },
      { name: "area", label: "Área", colSpan: 1 },
    ]} />;
}

export function Fabricantes() {
  return <ResourceManager title="Fabricantes" subtitle="Marcas de los activos tecnológicos"
    icon={Factory} endpoint="/manufacturers" permission="catalog"
    columns={[{ key: "name", label: "Nombre" }, { key: "website", label: "Sitio Web" }, { key: "support_phone", label: "Soporte" }]}
    fields={[
      { name: "name", label: "Nombre", required: true },
      { name: "website", label: "Sitio Web" },
      { name: "support_phone", label: "Teléfono de Soporte", colSpan: 1 },
    ]} />;
}

export function Modelos() {
  return <ResourceManager title="Modelos" subtitle="Modelos específicos de equipos"
    icon={Boxes} endpoint="/models" permission="catalog"
    columns={[{ key: "name", label: "Modelo" }, { key: "model_number", label: "N° Modelo" }, { key: "manufacturer_id", label: "Fabricante", relation: true }, { key: "category_id", label: "Categoría", relation: true }]}
    fields={[
      { name: "name", label: "Nombre del Modelo", required: true },
      { name: "model_number", label: "Número de Modelo", colSpan: 1 },
      { name: "manufacturer_id", label: "Fabricante", relation: { endpoint: "/manufacturers" } },
      { name: "category_id", label: "Categoría", relation: { endpoint: "/categories" } },
    ]} />;
}

export function Categorias() {
  return <ResourceManager title="Categorías" subtitle="Clasificación de activos y años de depreciación"
    icon={Tags} endpoint="/categories" permission="catalog"
    columns={[{ key: "name", label: "Nombre" }, { key: "type", label: "Tipo" }, { key: "depreciation_years", label: "Depreciación (años)" }]}
    fields={[
      { name: "name", label: "Nombre", required: true },
      { name: "type", label: "Tipo", type: "select", colSpan: 1, options: [
        { value: "computo", label: "Cómputo" }, { value: "periferico", label: "Periférico" },
        { value: "red", label: "Red" }, { value: "energia", label: "Energía" },
        { value: "telefonia", label: "Telefonía" }, { value: "movil", label: "Móvil" },
        { value: "seguridad", label: "Seguridad" }, { value: "software", label: "Software" },
      ] },
      { name: "depreciation_years", label: "Años de Depreciación", type: "number", colSpan: 1 },
    ]} />;
}

export function Proveedores() {
  return <ResourceManager title="Proveedores" subtitle="Suplidores de equipos y servicios"
    icon={Factory} endpoint="/suppliers" permission="catalog"
    columns={[{ key: "name", label: "Nombre" }, { key: "rnc", label: "RNC" }, { key: "contact_name", label: "Contacto" }, { key: "phone", label: "Teléfono" }]}
    fields={[
      { name: "name", label: "Nombre / Razón Social", required: true },
      { name: "rnc", label: "RNC", colSpan: 1 },
      { name: "contact_name", label: "Contacto", colSpan: 1 },
      { name: "phone", label: "Teléfono", colSpan: 1 },
      { name: "email", label: "Correo", colSpan: 1 },
      { name: "address", label: "Dirección" },
    ]} />;
}

export function OrdenesCompra() {
  return <ResourceManager title="Órdenes de Compra" subtitle="Gestión de compras de activos"
    icon={ShoppingCart} endpoint="/purchase-orders" permission="purchases"
    columns={[
      { key: "po_number", label: "N° Orden" }, { key: "supplier_name", label: "Proveedor" },
      { key: "total", label: "Total", render: (r) => money(r.total) },
      { key: "order_date", label: "Fecha", render: (r) => date(r.order_date) },
      { key: "status", label: "Estado" },
    ]}
    fields={[
      { name: "po_number", label: "Número de Orden", required: true, colSpan: 1 },
      { name: "supplier_name", label: "Proveedor", colSpan: 1 },
      { name: "order_date", label: "Fecha de Orden", type: "date", colSpan: 1 },
      { name: "total", label: "Monto Total (RD$)", type: "number", colSpan: 1 },
      { name: "status", label: "Estado", type: "select", colSpan: 1, default: "pendiente", options: [
        { value: "pendiente", label: "Pendiente" }, { value: "aprobada", label: "Aprobada" },
        { value: "recibida", label: "Recibida" }, { value: "cancelada", label: "Cancelada" },
      ] },
      { name: "notes", label: "Notas", type: "textarea" },
    ]} />;
}

export function Facturas() {
  return <ResourceManager title="Facturas" subtitle="Facturas de proveedores (NCF)"
    icon={FileText} endpoint="/invoices" permission="purchases"
    columns={[
      { key: "invoice_number", label: "N° Factura" }, { key: "ncf", label: "NCF" },
      { key: "supplier_name", label: "Proveedor" },
      { key: "amount", label: "Monto", render: (r) => money(r.amount) },
      { key: "invoice_date", label: "Fecha", render: (r) => date(r.invoice_date) },
    ]}
    fields={[
      { name: "invoice_number", label: "Número de Factura", required: true, colSpan: 1 },
      { name: "ncf", label: "NCF", colSpan: 1 },
      { name: "supplier_name", label: "Proveedor", colSpan: 1 },
      { name: "amount", label: "Monto (RD$)", type: "number", colSpan: 1 },
      { name: "invoice_date", label: "Fecha", type: "date", colSpan: 1 },
      { name: "po_number", label: "Orden de Compra Ref.", colSpan: 1 },
    ]} />;
}

export function Garantias() {
  return <ResourceManager title="Garantías" subtitle="Control de garantías de activos"
    icon={BadgeCheck} endpoint="/warranties" permission="purchases"
    columns={[
      { key: "asset_tag", label: "Activo" }, { key: "provider", label: "Proveedor" },
      { key: "type", label: "Tipo" },
      { key: "start_date", label: "Inicio", render: (r) => date(r.start_date) },
      { key: "end_date", label: "Vencimiento", render: (r) => date(r.end_date) },
    ]}
    fields={[
      { name: "asset_tag", label: "Etiqueta del Activo", required: true, colSpan: 1 },
      { name: "provider", label: "Proveedor", colSpan: 1 },
      { name: "type", label: "Tipo", type: "select", colSpan: 1, default: "fabricante", options: [
        { value: "fabricante", label: "Fabricante" }, { value: "extendida", label: "Extendida" },
        { value: "proveedor", label: "Proveedor" },
      ] },
      { name: "start_date", label: "Inicio", type: "date", colSpan: 1 },
      { name: "end_date", label: "Vencimiento", type: "date", colSpan: 1 },
      { name: "notes", label: "Notas", type: "textarea" },
    ]} />;
}

export function Mantenimientos() {
  return <ResourceManager title="Mantenimientos" subtitle="Preventivos y correctivos de activos"
    icon={Wrench} endpoint="/maintenance" permission="maintenance"
    columns={[
      { key: "asset_tag", label: "Activo" }, { key: "type", label: "Tipo" },
      { key: "technician", label: "Técnico" },
      { key: "scheduled_date", label: "Programado", render: (r) => date(r.scheduled_date) },
      { key: "status", label: "Estado", render: (r) => <StatusBadge value={r.status} /> },
      { key: "cost", label: "Costo", render: (r) => money(r.cost) },
    ]}
    fields={[
      { name: "asset_tag", label: "Etiqueta del Activo", required: true, colSpan: 1 },
      { name: "type", label: "Tipo", type: "select", colSpan: 1, default: "preventivo", options: [
        { value: "preventivo", label: "Preventivo" }, { value: "correctivo", label: "Correctivo" },
      ] },
      { name: "technician", label: "Técnico", colSpan: 1 },
      { name: "scheduled_date", label: "Fecha Programada", type: "date", colSpan: 1 },
      { name: "completed_date", label: "Fecha Realizado", type: "date", colSpan: 1 },
      { name: "cost", label: "Costo (RD$)", type: "number", colSpan: 1 },
      { name: "status", label: "Estado", type: "select", colSpan: 1, default: "programado", options: [
        { value: "programado", label: "Programado" }, { value: "pendiente", label: "Pendiente" },
        { value: "en_proceso", label: "En Proceso" }, { value: "completado", label: "Completado" },
        { value: "cancelado", label: "Cancelado" },
      ] },
      { name: "description", label: "Descripción del Trabajo", type: "textarea" },
    ]} />;
}

export function Software() {
  return <ResourceManager title="Software" subtitle="Catálogo de software de la organización"
    icon={AppWindow} endpoint="/software" permission="software"
    columns={[
      { key: "name", label: "Nombre" }, { key: "publisher", label: "Fabricante" },
      { key: "version", label: "Versión" }, { key: "type", label: "Tipo" },
    ]}
    fields={[
      { name: "name", label: "Nombre", required: true },
      { name: "publisher", label: "Fabricante", colSpan: 1 },
      { name: "version", label: "Versión", colSpan: 1 },
      { name: "type", label: "Tipo", type: "select", colSpan: 1, default: "aplicacion", options: [
        { value: "sistema_operativo", label: "Sistema Operativo" }, { value: "aplicacion", label: "Aplicación" },
        { value: "utilidad", label: "Utilidad" }, { value: "seguridad", label: "Seguridad" },
      ] },
      { name: "notes", label: "Notas", type: "textarea" },
    ]} />;
}

export function Licencias() {
  return <ResourceManager title="Licencias" subtitle="Licencias de software y vencimientos"
    icon={KeyRound} endpoint="/licenses" permission="software"
    columns={[
      { key: "software_name", label: "Software" }, { key: "type", label: "Tipo" },
      { key: "seats", label: "Puestos" }, { key: "seats_used", label: "Usados" },
      { key: "expiry_date", label: "Expira", render: (r) => date(r.expiry_date) },
    ]}
    fields={[
      { name: "software_name", label: "Software", required: true, colSpan: 1 },
      { name: "license_key", label: "Clave / Serial", colSpan: 1 },
      { name: "type", label: "Tipo", type: "select", colSpan: 1, default: "suscripcion", options: [
        { value: "perpetua", label: "Perpetua" }, { value: "suscripcion", label: "Suscripción" },
        { value: "volumen", label: "Por Volumen" }, { value: "oem", label: "OEM" },
      ] },
      { name: "seats", label: "Puestos Totales", type: "number", colSpan: 1 },
      { name: "seats_used", label: "Puestos Usados", type: "number", colSpan: 1 },
      { name: "purchase_date", label: "Fecha de Compra", type: "date", colSpan: 1 },
      { name: "expiry_date", label: "Fecha de Expiración", type: "date", colSpan: 1 },
      { name: "supplier_name", label: "Proveedor", colSpan: 1 },
    ]} />;
}
