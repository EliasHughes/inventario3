import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Search, Eye } from "lucide-react";

const fdate = (v) => (v ? new Date(v).toLocaleString("es-DO") : "—");
const ACTION_COLORS = {
  create: "text-emerald-600", update: "text-blue-600", delete: "text-red-600",
  login: "text-slate-600", logout: "text-slate-500", login_failed: "text-amber-600",
  delivery: "text-blue-600", return: "text-violet-600", reconcile: "text-cyan-600",
};

export default function Audit() {
  const [rows, setRows] = useState([]); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1); const [q, setQ] = useState(""); const [action, setAction] = useState("todas");
  const [loading, setLoading] = useState(true); const [detail, setDetail] = useState(null);
  const pageSize = 30;

  const load = async () => {
    setLoading(true);
    try {
      const params = { q, page, page_size: pageSize }; if (action !== "todas") params.action = action;
      const { data } = await api.get("/audit", { params }); setRows(data.items); setTotal(data.total);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, action]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 350); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora inmutable de todas las acciones del sistema" icon={ShieldCheck} />
      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por usuario, IP, descripción..." className="pl-9" data-testid="audit-search-input" />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las acciones</SelectItem>
              {["create", "update", "delete", "login", "logout", "login_failed", "delivery", "return", "reconcile"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto tabular">{total} registro(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-secondary/60 text-left">
              {["Fecha/Hora", "Usuario", "Acción", "Entidad", "Descripción", "IP", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
                : rows.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-muted-foreground">Sin registros de auditoría</td></tr>
                  : rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-2.5 tabular whitespace-nowrap">{fdate(r.timestamp)}</td>
                      <td className="px-4 py-2.5">{r.user_name || r.user_email || "—"}</td>
                      <td className={`px-4 py-2.5 font-semibold ${ACTION_COLORS[r.action] || "text-slate-600"}`}>{r.action}</td>
                      <td className="px-4 py-2.5">{r.entity_type}</td>
                      <td className="px-4 py-2.5">{r.description}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.ip_address}</td>
                      <td className="px-4 py-2.5 text-right">{(r.before || r.after) && <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetail(r)} data-testid={`audit-view-${r.id}`}><Eye className="h-4 w-4" /></Button>}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle de Auditoría</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-bold mb-1 text-muted-foreground">Valores Anteriores</div>
              <pre className="rounded-md bg-secondary p-3 overflow-auto max-h-80">{JSON.stringify(detail?.before, null, 2) || "—"}</pre>
            </div>
            <div>
              <div className="font-bold mb-1 text-muted-foreground">Valores Nuevos</div>
              <pre className="rounded-md bg-secondary p-3 overflow-auto max-h-80">{JSON.stringify(detail?.after, null, 2) || "—"}</pre>
            </div>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-2">
            Equipo: {detail?.hostname} · Usuario AD: {detail?.user_email} · {fdate(detail?.timestamp)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
