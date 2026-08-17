import React, { useEffect, useMemo, useState } from "react";
import api, { apiError, API } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge, { STATUS_META } from "@/components/StatusBadge";
import Typeahead from "@/components/Typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart3, Loader2, FileSpreadsheet, FileText, Play, Inbox } from "lucide-react";

const ASSET_STATUSES = ["disponible", "asignado", "mantenimiento", "danado", "transito", "reservado", "baja"];

const CATEGORY_FIELDS = {
  deliveries_by_employee_date: ["employee", "date"],
  returns_by_period: ["from_date", "to_date"],
  assets_by_status: ["status"],
  assets_by_department: ["department"],
  assignment_history: ["employee", "from_date", "to_date"],
};

export default function Reports() {
  const [cats, setCats] = useState([]);
  const [category, setCategory] = useState("deliveries_by_employee_date");
  const [emp, setEmp] = useState(null);
  const [dep, setDep] = useState("todos");
  const [deps, setDeps] = useState([]);
  const [status, setStatus] = useState("todos");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null); // 'xlsx' | 'pdf' | null

  useEffect(() => {
    api.get("/reports/categories").then((r) => setCats(r.data.items || [])).catch(() => {});
    api.get("/departments", { params: { page_size: 500 } }).then((r) => setDeps(r.data.items || [])).catch(() => {});
  }, []);

  const needs = (key) => CATEGORY_FIELDS[category]?.includes(key);

  const buildParams = () => {
    const p = { category };
    if (needs("employee") && emp) { p.employee_id = emp.id; p.employee_code = emp.code; }
    if (needs("date")) p.date = date;
    if (needs("from_date") && fromDate) p.from_date = fromDate;
    if (needs("to_date") && toDate) p.to_date = toDate;
    if (needs("status") && status !== "todos") p.status = status;
    if (needs("department") && dep !== "todos") p.department_id = dep;
    return p;
  };

  const run = async () => {
    setLoading(true); setPreview(null);
    try {
      const { data } = await api.get("/reports/preview", { params: buildParams() });
      setPreview(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  const doExport = async (format) => {
    setExporting(format);
    try {
      const token = localStorage.getItem("cisa_token");
      const qs = new URLSearchParams({ ...buildParams(), format }).toString();
      const res = await fetch(`${API}/reports/export?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo exportar el reporte");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${category}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Reporte exportado como ${format.toUpperCase()}`);
    } catch (e) { toast.error(e.message || String(e)); }
    finally { setExporting(null); }
  };

  const empSuggest = (it) => (
    <div className="flex flex-col">
      <span><span className="font-mono text-xs text-primary">{it.code}</span> · <span className="font-medium">{it.name}</span></span>
      <span className="text-xs text-muted-foreground">{it.department_name || "Sin departamento"}</span>
    </div>
  );
  const empSelected = (it) => <span><span className="font-mono text-xs text-primary">{it.code}</span> · {it.name}</span>;

  const catTitle = useMemo(() => cats.find((c) => c.key === category)?.title || "Reporte", [cats, category]);

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Reportes categorizados con exportación a Excel y PDF" icon={BarChart3} />

      <div className="rounded-lg border border-border bg-white p-4 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <Label className="mb-1.5 block">Categoría de reporte</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPreview(null); }}>
              <SelectTrigger data-testid="report-category-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.key} value={c.key}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {needs("employee") && (
            <div className="lg:col-span-2">
              <Label className="mb-1.5 block">Empleado {category === "deliveries_by_employee_date" ? "(opcional)" : ""}</Label>
              <Typeahead endpoint="/employees/search" value={emp} onChange={setEmp}
                placeholder="Escriba código o nombre..."
                renderItem={empSuggest} renderSelected={empSelected}
                testId="report-employee-typeahead" />
            </div>
          )}

          {needs("date") && (
            <div>
              <Label className="mb-1.5 block">Fecha <span className="text-primary">*</span></Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="report-date" />
            </div>
          )}
          {needs("from_date") && (
            <div>
              <Label className="mb-1.5 block">Desde</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="report-from-date" />
            </div>
          )}
          {needs("to_date") && (
            <div>
              <Label className="mb-1.5 block">Hasta</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="report-to-date" />
            </div>
          )}
          {needs("status") && (
            <div>
              <Label className="mb-1.5 block">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="report-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ASSET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_META[s]?.label || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {needs("department") && (
            <div className="lg:col-span-2">
              <Label className="mb-1.5 block">Departamento</Label>
              <Select value={dep} onValueChange={setDep}>
                <SelectTrigger data-testid="report-department-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {deps.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={loading} data-testid="report-run-btn">
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
            Generar
          </Button>
          <Button variant="outline" onClick={() => doExport("xlsx")} disabled={exporting === "xlsx"} data-testid="report-export-xlsx">
            {exporting === "xlsx" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-700" />}
            Excel
          </Button>
          <Button variant="outline" onClick={() => doExport("pdf")} disabled={exporting === "pdf"} data-testid="report-export-pdf">
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5 text-red-700" />}
            PDF
          </Button>
          {preview && <span className="ml-auto text-sm text-muted-foreground tabular">{preview.total} registro(s)</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-x-auto">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <h3 className="font-bold">{catTitle}</h3>
        </div>
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : !preview ? (
          <div className="py-16 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Seleccione filtros y pulse <b>Generar</b> para ver el reporte.
          </div>
        ) : preview.total === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Sin resultados con los filtros aplicados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left">
                {preview.columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0 hover:bg-secondary/50" data-testid={`report-row-${ri}`}>
                  {row.map((v, ci) => {
                    const key = preview.columns[ci]?.key;
                    if (key === "status" && v) {
                      return <td key={ci} className="px-4 py-2.5"><StatusBadge value={v} size="sm" /></td>;
                    }
                    return <td key={ci} className="px-4 py-2.5">{v || <span className="text-muted-foreground">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
