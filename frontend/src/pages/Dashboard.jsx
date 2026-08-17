import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { STATUS_META, getStatusMeta } from "@/components/StatusBadge";
import {
  LayoutDashboard, Monitor, CheckCircle2, Truck, Wrench, AlertTriangle,
  UserX, DollarSign, ShieldAlert, KeyRound, CalendarClock, Ticket,
  TrendingUp, Activity, ArrowUpRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";

/**
 * Tarjeta KPI clickeable.
 * Al hacer clic navega a la ruta indicada (con querystring de filtro).
 */
function Kpi({ icon: Icon, label, value, sub, accent = "text-slate-400",
              accentBg = "bg-slate-100", onClick, testid, active }) {
  const clickable = !!onClick;
  return (
    <button type="button" onClick={onClick} disabled={!clickable}
      className={`kpi-card group text-left rounded-lg border bg-white p-4 transition-all
        ${clickable ? "hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50 cursor-pointer" : "cursor-default"}
        ${active ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border"}`}
      data-testid={testid}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            {label}
            {clickable && <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
          <div className="mt-1 text-3xl font-black tabular text-foreground">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className={`h-9 w-9 shrink-0 rounded-md ${accentBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState({ warranties: [], licenses: [] });

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setS(r.data)).catch(() => {});
    api.get("/dashboard/charts").then((r) => setCharts(r.data)).catch(() => {});
    api.get("/dashboard/recent-activity").then((r) => setActivity(r.data.items)).catch(() => {});
    api.get("/dashboard/alerts").then((r) => setAlerts(r.data)).catch(() => {});
  }, []);

  const money = (v) => `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 0 })}`;

  const goAssets = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    navigate(qs ? `/activos?${qs}` : "/activos");
  };

  return (
    <div>
      <PageHeader title="Panel Ejecutivo" subtitle="Haga clic en las tarjetas para filtrar el inventario" icon={LayoutDashboard} />

      {/* Primary KPIs - clickables */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
        <Kpi icon={Monitor} label="Total de Activos" value={s?.total_assets ?? "—"}
          accent="text-primary" accentBg="bg-red-50"
          onClick={() => goAssets()} testid="kpi-total" />
        <Kpi icon={CheckCircle2} label={STATUS_META.disponible.label} value={s?.disponibles ?? "—"}
          accent="text-emerald-600" accentBg="bg-emerald-50"
          onClick={() => goAssets({ status: "disponible" })} testid="kpi-available" />
        <Kpi icon={Truck} label={STATUS_META.asignado.label} value={s?.asignados ?? "—"}
          sub={`Utilización ${s?.utilizacion ?? 0}%`}
          accent="text-blue-600" accentBg="bg-blue-50"
          onClick={() => goAssets({ status: "asignado" })} testid="kpi-assigned" />
        <Kpi icon={Wrench} label={STATUS_META.mantenimiento.label} value={s?.mantenimiento ?? "—"}
          accent="text-amber-600" accentBg="bg-amber-50"
          onClick={() => goAssets({ status: "mantenimiento" })} testid="kpi-maintenance" />
        <Kpi icon={AlertTriangle} label={STATUS_META.danado.label} value={s?.danados ?? "—"}
          accent="text-red-600" accentBg="bg-red-50"
          onClick={() => goAssets({ status: "danado" })} testid="kpi-damaged" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Kpi icon={DollarSign} label="Valor Inventario" value={money(s?.valor_inventario)}
          accent="text-emerald-700" accentBg="bg-emerald-50" testid="kpi-value" />
        <Kpi icon={UserX} label="Sin Responsable" value={s?.sin_responsable ?? "—"}
          accent="text-slate-600" accentBg="bg-slate-100"
          onClick={() => goAssets({ unassigned: "true" })} testid="kpi-unassigned" />
        <Kpi icon={ShieldAlert} label="Garantías x Vencer" value={s?.garantias_por_vencer ?? "—"}
          sub="Próx. 60 días" accent="text-amber-700" accentBg="bg-amber-50"
          onClick={() => goAssets({ warranty_soon: "true" })} testid="kpi-warranties" />
        <Kpi icon={KeyRound} label="Licencias x Expirar" value={s?.licencias_por_expirar ?? "—"}
          sub="Próx. 60 días" accent="text-violet-700" accentBg="bg-violet-50"
          onClick={() => navigate("/licencias")} testid="kpi-licenses" />
        <Kpi icon={CalendarClock} label="Mant. Programados" value={s?.mantenimientos_programados ?? "—"}
          accent="text-cyan-700" accentBg="bg-cyan-50"
          onClick={() => navigate("/mantenimientos")} testid="kpi-scheduled" />
        <Kpi icon={Ticket} label="Tickets Abiertos" value={s?.tickets_abiertos ?? "—"}
          accent="text-primary" accentBg="bg-red-50"
          onClick={() => navigate("/tickets")} testid="kpi-tickets" />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-white p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Activos por Categoría</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts?.by_category || []} margin={{ left: -20 }}
              onClick={(e) => {
                const p = e?.activePayload?.[0]?.payload;
                if (p) goAssets({ category_name: p.name });
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#CC0000" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="font-bold mb-4">Estado del Inventario</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={charts?.by_status || []} dataKey="value" nameKey="name" cx="50%" cy="45%"
                outerRadius={90} label={(e) => e.value} cursor="pointer"
                onClick={(p) => p?.name && goAssets({ status: p.name })}>
                {(charts?.by_status || []).map((d, i) => (
                  <Cell key={i} fill={getStatusMeta(d.name).hex} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {(charts?.by_status || []).map((d, i) => {
              const meta = getStatusMeta(d.name);
              return (
                <button key={i} onClick={() => goAssets({ status: d.name })}
                  className="flex items-center gap-1.5 text-xs hover:underline"
                  data-testid={`legend-status-${d.name}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.hex }} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Activity */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-white p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Actividad Reciente</h3>
          {activity.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No hay actividad aún</div>
          ) : (
            <div className="space-y-1">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="flex-1">{a.description || a.action}</span>
                  <span className="text-xs text-muted-foreground">{a.user_name}</span>
                  <span className="text-xs text-muted-foreground tabular">{new Date(a.timestamp).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" /> Alertas</h3>
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Garantías por vencer</div>
            {alerts.warranties.length === 0 ? <p className="text-sm text-muted-foreground">Ninguna</p> :
              alerts.warranties.slice(0, 5).map((w, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="truncate">{w.asset_tag} · {w.name}</span>
                  <span className="text-amber-600 tabular">{new Date(w.warranty_end).toLocaleDateString("es-DO")}</span>
                </div>
              ))}
            <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">Licencias por expirar</div>
            {alerts.licenses.length === 0 ? <p className="text-sm text-muted-foreground">Ninguna</p> :
              alerts.licenses.slice(0, 5).map((l, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="truncate">{l.software_name}</span>
                  <span className="text-violet-600 tabular">{new Date(l.expiry_date).toLocaleDateString("es-DO")}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
