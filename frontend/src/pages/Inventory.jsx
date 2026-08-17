import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScanLine, Plus, Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function Inventory() {
  const { hasPerm } = useAuth();
  const [sessions, setSessions] = useState([]); const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); const [form, setForm] = useState({}); const [branches, setBranches] = useState([]);
  const [active, setActive] = useState(null); const [code, setCode] = useState(""); const [report, setReport] = useState(null);
  const canWrite = hasPerm("inventory:write");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/inventory/sessions"); setSessions(data.items); } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); api.get("/branches", { params: { page_size: 500 } }).then((r) => setBranches(r.data.items)).catch(() => {}); }, []);

  const create = async () => {
    if (!form.name) { toast.error("Ingrese un nombre para la sesión"); return; }
    try { await api.post("/inventory/sessions", form); toast.success("Sesión de inventario creada"); setOpen(false); setForm({}); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const openSession = async (s) => {
    try { const { data } = await api.get(`/inventory/sessions/${s.id}`); setActive(data); setReport(data.report || null); }
    catch (e) { toast.error(apiError(e)); }
  };

  const addCount = async () => {
    if (!code.trim()) return;
    try {
      const { data } = await api.post(`/inventory/sessions/${active.id}/count`, { code: code.trim() });
      if (data.found) toast.success(`Contado: ${data.asset_name}`); else toast.warning(`Código no encontrado en sistema: ${data.asset_tag}`);
      setCode(""); openSession(active);
    } catch (e) { toast.error(apiError(e)); }
  };

  const reconcile = async () => {
    try { const { data } = await api.post(`/inventory/sessions/${active.id}/reconcile`); setReport(data); toast.success("Conciliación completada"); openSession(active); }
    catch (e) { toast.error(apiError(e)); }
  };

  if (active) {
    return (
      <div>
        <Button variant="ghost" onClick={() => { setActive(null); load(); }} className="mb-3"><ArrowLeft className="h-4 w-4 mr-1" /> Volver a sesiones</Button>
        <PageHeader title={active.name} subtitle={`Estado: ${active.status} · Contados: ${active.counts?.length || 0}`} icon={ScanLine}
          actions={canWrite && <Button onClick={reconcile} data-testid="reconcile-btn">Conciliar vs Sistema</Button>} />

        {canWrite && (
          <div className="rounded-lg border border-border bg-white p-4 mb-4">
            <Label className="mb-1.5 block">Escanear / ingresar etiqueta de activo</Label>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCount()}
                placeholder="Ej: CISA-2026-00001 o contenido del QR" data-testid="inventory-code-input" autoFocus />
              <Button onClick={addCount} data-testid="inventory-count-btn"><Plus className="h-4 w-4 mr-1" /> Contar</Button>
            </div>
          </div>
        )}

        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="rounded-lg border bg-white p-4"><div className="text-sm text-muted-foreground">En Sistema</div><div className="text-2xl font-black tabular">{report.system_total}</div></div>
            <div className="rounded-lg border bg-white p-4"><div className="text-sm text-muted-foreground">Contados</div><div className="text-2xl font-black tabular">{report.counted_total}</div></div>
            <div className="rounded-lg border bg-white p-4"><div className="text-sm text-emerald-600">Coinciden</div><div className="text-2xl font-black tabular text-emerald-600">{report.matched}</div></div>
            <div className="rounded-lg border bg-white p-4"><div className="text-sm text-red-600">Faltantes</div><div className="text-2xl font-black tabular text-red-600">{report.missing?.length || 0}</div></div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-white">
            <div className="border-b p-3 font-bold">Activos Contados</div>
            <div className="max-h-96 overflow-y-auto">
              {(active.counts || []).length === 0 ? <p className="p-6 text-center text-muted-foreground text-sm">Aún no se han contado activos</p> :
                (active.counts || []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 border-b p-2.5 text-sm last:border-0">
                    {c.found ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    <span className="font-mono text-xs">{c.asset_tag}</span><span className="flex-1">{c.asset_name}</span>
                    <span className="text-xs text-muted-foreground">{c.condition}</span>
                  </div>
                ))}
            </div>
          </div>
          {report && (
            <div className="rounded-lg border border-border bg-white">
              <div className="border-b p-3 font-bold text-red-600">Faltantes (en sistema, no contados)</div>
              <div className="max-h-96 overflow-y-auto">
                {report.missing?.length === 0 ? <p className="p-6 text-center text-muted-foreground text-sm">Ninguno</p> :
                  report.missing?.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 border-b p-2.5 text-sm last:border-0">
                      <XCircle className="h-4 w-4 text-red-500" /><span className="font-mono text-xs">{m.asset_tag}</span><span>{m.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Inventario Físico" subtitle="Levantamientos físicos con QR/código de barras y conciliación" icon={ScanLine}
        actions={canWrite && <Button onClick={() => setOpen(true)} data-testid="inventory-session-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nueva Sesión</Button>} />
      <div className="rounded-lg border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-secondary/60 text-left">
            {["Sesión", "Sucursal", "Estado", "Contados", "Fecha", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold text-slate-600">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
              : sessions.length === 0 ? <tr><td colSpan={6} className="py-16 text-center text-muted-foreground">No hay sesiones de inventario</td></tr>
                : sessions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5">{branches.find((b) => b.id === s.branch_id)?.name || "Todas"}</td>
                    <td className="px-4 py-2.5 capitalize">{s.status}</td>
                    <td className="px-4 py-2.5 tabular">{s.counted || 0}</td>
                    <td className="px-4 py-2.5 tabular">{new Date(s.created_at).toLocaleDateString("es-DO")}</td>
                    <td className="px-4 py-2.5 text-right"><Button variant="outline" size="sm" onClick={() => openSession(s)} data-testid={`open-session-${s.id}`}>Abrir</Button></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Sesión de Inventario</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="mb-1.5 block">Nombre *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Inventario Sede Central Q3" data-testid="session-name-input" /></div>
            <div><Label className="mb-1.5 block">Sucursal (opcional)</Label>
              <Select value={form.branch_id || ""} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} data-testid="session-save-btn">Crear Sesión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
