import React from "react";

// Colores unificados por estado - aplicados en listados, dashboard y detalles
export const STATUS_META = {
  disponible:     { label: "Disponible",     cls: "bg-emerald-100 text-emerald-800 border-emerald-300",  dot: "bg-emerald-500",  hex: "#10b981" },
  asignado:       { label: "Asignado",       cls: "bg-blue-100 text-blue-800 border-blue-300",           dot: "bg-blue-500",     hex: "#3b82f6" },
  entregado:      { label: "Entregado",      cls: "bg-blue-100 text-blue-800 border-blue-300",           dot: "bg-blue-500",     hex: "#3b82f6" },
  mantenimiento:  { label: "Mantenimiento",  cls: "bg-amber-100 text-amber-900 border-amber-300",        dot: "bg-amber-500",    hex: "#f59e0b" },
  danado:         { label: "Dañado",         cls: "bg-red-100 text-red-800 border-red-300",              dot: "bg-red-500",      hex: "#ef4444" },
  transito:       { label: "En Tránsito",    cls: "bg-sky-100 text-sky-800 border-sky-300",              dot: "bg-sky-500",      hex: "#0ea5e9" },
  reservado:      { label: "Reservado",      cls: "bg-violet-100 text-violet-800 border-violet-300",     dot: "bg-violet-500",   hex: "#8b5cf6" },
  baja:           { label: "De Baja",        cls: "bg-slate-200 text-slate-700 border-slate-300",        dot: "bg-slate-400",    hex: "#94a3b8" },
  // Tickets / prioridades (reusables)
  abierto:        { label: "Abierto",        cls: "bg-blue-100 text-blue-800 border-blue-300",           dot: "bg-blue-500",     hex: "#3b82f6" },
  en_progreso:    { label: "En Progreso",    cls: "bg-amber-100 text-amber-900 border-amber-300",        dot: "bg-amber-500",    hex: "#f59e0b" },
  en_espera:      { label: "En Espera",      cls: "bg-violet-100 text-violet-800 border-violet-300",     dot: "bg-violet-500",   hex: "#8b5cf6" },
  resuelto:       { label: "Resuelto",       cls: "bg-emerald-100 text-emerald-800 border-emerald-300",  dot: "bg-emerald-500",  hex: "#10b981" },
  cerrado:        { label: "Cerrado",        cls: "bg-slate-200 text-slate-700 border-slate-300",        dot: "bg-slate-400",    hex: "#94a3b8" },
  media:          { label: "Media",          cls: "bg-blue-100 text-blue-800 border-blue-300",           dot: "bg-blue-500",     hex: "#3b82f6" },
  alta:           { label: "Alta",           cls: "bg-amber-100 text-amber-900 border-amber-300",        dot: "bg-amber-500",    hex: "#f59e0b" },
  critica:        { label: "Crítica",        cls: "bg-red-100 text-red-800 border-red-300",              dot: "bg-red-500",      hex: "#ef4444" },
};

// Estados de activos que deben mostrarse con color en todo el sistema
export const ASSET_STATUSES = [
  "disponible", "asignado", "mantenimiento", "danado",
  "transito", "reservado", "baja",
];

export function getStatusMeta(value) {
  return STATUS_META[value] || { label: value || "—",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400", hex: "#94a3b8" };
}

export default function StatusBadge({ value, testid, size = "md" }) {
  const cfg = getStatusMeta(value);
  const sz = size === "sm"
    ? "px-2 py-0.5 text-[11px]"
    : "px-2.5 py-0.5 text-xs";
  return (
    <span data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${sz} ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
