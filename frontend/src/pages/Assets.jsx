import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Monitor, Plus, Search, Pencil, Trash2, Loader2, Inbox, QrCode, History, Eye, X, Download } from "lucide-react";
import { STATUS_META } from "@/components/StatusBadge";

const money = (v) => (v ? `RD$ ${Number(v).toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : "—");
const fdate = (v) => (v ? new Date(v).toLocaleDateString("es-DO") : "—");

const F = ({ label, children, span2 }) => (
  <div className={span2 ? "col-span-2" : "col-span-1"}>
    <Label className="mb-1.5 block">{label}</Label>{children}
  </div>
  );
export default function Assets() {
  const { hasPerm } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState(searchParams.get("status") || "todos");
  const [fCat, setFCat] = useState(searchParams.get("category_id") || "todas");
  const [fBranch, setFBranch] = useState(searchParams.get("branch_id") || "todas");
  const [fUnassigned, setFUnassigned] = useState(searchParams.get("unassigned") === "true");
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState([]);
  const [cats, setCats] = useState([]);
  const [branches, setBranches] = useState([]);
  const [deps, setDeps] = useState([]);
  const [manus, setManus] = useState([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [qr, setQr] = useState(null);
  const pageSize = 25;

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";

  const load = async () => {
    setLoading(true);
    try {
      const params = { q, page, page_size: pageSize };
      if (fStatus !== "todos") params.status = fStatus;
      if (fCat !== "todas") params.category_id = fCat;
      if (fBranch !== "todas") params.branch_id = fBranch;
      if (fUnassigned) params.unassigned = true;
      const { data } = await api.get("/assets", { params });
      setRows(data.items || []); setTotal(data.total || 0);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/assets/statuses").then((r) => setStatuses(r.data.statuses)).catch(() => {});
    api.get("/categories", { params: { page_size: 500 } }).then((r) => setCats(r.data.items)).catch(() => {});
    api.get("/branches", { params: { page_size: 500 } }).then((r) => setBranches(r.data.items)).catch(() => {});
    api.get("/departments", { params: { page_size: 500 } }).then((r) => setDeps(r.data.items)).catch(() => {});
    api.get("/manufacturers", { params: { page_size: 500 } }).then((r) => setManus(r.data.items)).catch(() => {});
  }, []);

  // Resolver filtro por nombre de categoría (llega desde Dashboard chart)
  useEffect(() => {
    const catName = searchParams.get("category_name");
    if (catName && cats.length) {
      const found = cats.find((c) => c.name === catName);
      if (found) {
        setFCat(found.id);
        searchParams.delete("category_name");
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line
  }, [cats]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, fStatus, fCat, fBranch, fUnassigned]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 350); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const openCreate = () => { setForm({ status: "disponible", condition: "nuevo" }); setEditing(null); setSheetOpen(true); };
  const openEdit = (row) => { setForm({ ...row }); setEditing(row); setSheetOpen(true); };

  const save = async () => {
    if (!form.name) { toast.error('El campo "Nombre" es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      ["purchase_cost", "depreciation_years"].forEach((k) => { if (payload[k] !== undefined && payload[k] !== "") payload[k] = Number(payload[k]); });
      if (editing) await api.put(`/assets/${editing.id}`, payload);
      else await api.post("/assets", payload);
      toast.success(editing ? "Activo actualizado" : "Activo registrado correctamente");
      setSheetOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    try { await api.delete(`/assets/${deleteId}`); toast.success("Activo dado de baja"); setDeleteId(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const openDetail = async (row) => {
    setDetail(row); setHistory([]); setQr(null);
    try {
      const [h, qrRes] = await Promise.all([
        api.get(`/assets/${row.id}/history`),
        api.get(`/assets/${row.id}/qr`),
      ]);
      setHistory(h.data.items); setQr(qrRes.data);
      const fresh = await api.get(`/assets/${row.id}`); setDetail(fresh.data);
    } catch {}
  };

  const canWrite = hasPerm("assets:write");
  const canDelete = hasPerm("assets:delete");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

 return (
       <div>
        <PageHeader
          title="Activos Tecnológicos"
          subtitle="Ciclo de vida completo de los equipos de TI"
          icon={Monitor}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => (window.location.href = "http://172.21.20.14:8006/api/agent/download-script")}
                title="Descargar agente en PowerShell para despliegue por GPO en Active Directory"
              >
                <Download className="h-4 w-4 mr-1.5 text-emerald-600" /> Agente GPO (.ps1)
              </Button>

              {canWrite && (
                <Button onClick={openCreate} data-testid="asset-create-btn">
                  <Plus className="h-4 w-4 mr-1.5" /> Nuevo Activo
                </Button>
              )}
            </div>
          }
        />
      
      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por etiqueta, serie, nombre..." className="pl-9" data-testid="asset-search-input" />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s]?.label || s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCat} onValueChange={setFCat}>
            <SelectTrigger className="w-[160px]" data-testid="filter-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fBranch} onValueChange={setFBranch}>
            <SelectTrigger className="w-[150px]" data-testid="filter-branch"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sucursales</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {fUnassigned && (
            <button onClick={() => setFUnassigned(false)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              data-testid="filter-unassigned-chip">
              Sin responsable <X className="h-3 w-3" />
            </button>
          )}
          <span className="text-sm text-muted-foreground ml-auto tabular">{total} activo(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left">
                {["Etiqueta", "Nombre", "Serie", "Categoría", "Estado", "Responsable", "Sucursal", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-muted-foreground"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />No se encontraron activos</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{r.asset_tag}</td>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.serial_number || "—"}</td>
                  <td className="px-4 py-2.5">{nameOf(cats, r.category_id)}</td>
                  <td className="px-4 py-2.5"><StatusBadge value={r.status} /></td>
                  <td className="px-4 py-2.5">{r.assigned_to_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5">{nameOf(branches, r.branch_id)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(r)} className="h-8 w-8 p-0" data-testid={`view-btn-${r.id}`}><Eye className="h-4 w-4" /></Button>
                    {canWrite && <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="h-8 w-8 p-0" data-testid={`asset-edit-${r.id}`}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleteId(r.id)} className="h-8 w-8 p-0 text-red-600" data-testid={`asset-delete-${r.id}`}><Trash2 className="h-4 w-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        )}
      </div>
      

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar Activo" : "Nuevo Activo"}</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <F label="Etiqueta (auto si vacío)"><Input value={form.asset_tag || ""} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} data-testid="field-asset_tag" /></F>
            <F label="Nombre *"><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="field-name" /></F>
            <F label="Número de Serie"><Input value={form.serial_number || ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} data-testid="field-serial" /></F>
            <F label="Estado">
              <Select value={form.status || "disponible"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="field-status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s]?.label || s}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Categoría">
              <Select value={form.category_id || ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger data-testid="field-category"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Fabricante">
              <Select value={form.manufacturer_id || ""} onValueChange={(v) => setForm({ ...form, manufacturer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>{manus.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Sucursal">
              <Select value={form.branch_id || ""} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Departamento">
              <Select value={form.department_id || ""} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>{deps.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Fecha de Compra"><Input type="date" value={form.purchase_date || ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></F>
            <F label="Costo (RD$)"><Input type="number" value={form.purchase_cost ?? ""} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} data-testid="field-cost" /></F>
            <F label="Fin de Garantía"><Input type="date" value={form.warranty_end || ""} onChange={(e) => setForm({ ...form, warranty_end: e.target.value })} /></F>
            <F label="Depreciación (años)"><Input type="number" value={form.depreciation_years ?? ""} onChange={(e) => setForm({ ...form, depreciation_years: e.target.value })} /></F>
            <F label="Hostname"><Input value={form.hostname || ""} onChange={(e) => setForm({ ...form, hostname: e.target.value })} /></F>
            <F label="Dirección IP"><Input value={form.ip_address || ""} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} /></F>
            <F label="Dirección MAC"><Input value={form.mac_address || ""} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} /></F>
            <F label="Condición">
              <Select value={form.condition || "nuevo"} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["nuevo", "bueno", "regular", "malo"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Notas" span2><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="asset-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{editing ? "Guardar" : "Registrar"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="font-mono text-primary">{detail?.asset_tag}</span> · {detail?.name}
            </SheetTitle>
          </SheetHeader>
          {detail && (
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> Historial</TabsTrigger>
                <TabsTrigger value="qr"><QrCode className="h-3.5 w-3.5 mr-1" /> QR</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-2 pt-4">
                {[
                  ["Estado", <StatusBadge value={detail.status} />], ["Serie", detail.serial_number],
                  ["Categoría", nameOf(cats, detail.category_id)], ["Fabricante", nameOf(manus, detail.manufacturer_id)],
                  ["Sucursal", nameOf(branches, detail.branch_id)], ["Departamento", nameOf(deps, detail.department_id)],
                  ["Responsable", detail.assigned_to_name], ["Hostname", detail.hostname],
                  ["IP", detail.ip_address], ["MAC", detail.mac_address],
                  ["Compra", fdate(detail.purchase_date)], ["Costo", money(detail.purchase_cost)],
                  ["Fin Garantía", fdate(detail.warranty_end)], ["Condición", detail.condition],
                ].map(([k, v], i) => (
                  <div key={i} className="flex justify-between border-b border-border py-2 text-sm">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-right">{v || "—"}</span>
                  </div>
                ))}
                {detail.depreciation && (
                  <div className="mt-3 rounded-md bg-secondary p-3 text-sm">
                    <div className="font-semibold mb-1">Depreciación</div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor en libros</span><span className="font-bold text-emerald-700">{money(detail.depreciation.book_value)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Acumulada</span><span>{money(detail.depreciation.accumulated)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Antigüedad</span><span>{detail.depreciation.elapsed_years} años</span></div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history" className="pt-4">
                {history.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sin historial</p> :
                  <div className="space-y-3">
                    {history.map((h) => (
                      <div key={h.id} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <div>
                          <div className="font-medium">{h.detail}</div>
                          <div className="text-xs text-muted-foreground">{h.user_name} · {new Date(h.timestamp).toLocaleString("es-DO")}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
              </TabsContent>
              <TabsContent value="qr" className="pt-4 text-center">
                {qr ? (
                  <>
                    <img src={qr.qr} alt="QR" className="mx-auto w-56 h-56 border border-border rounded-lg p-2" data-testid="asset-qr-img" />
                    <p className="mt-3 font-mono text-sm">{qr.asset_tag}</p>
                    <a href={qr.qr} download={`${qr.asset_tag}.png`}><Button variant="outline" className="mt-3">Descargar etiqueta QR</Button></a>
                  </>
                ) : <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja el activo?</AlertDialogTitle>
            <AlertDialogDescription>Eliminación lógica (soft delete). El historial completo se conserva para auditoría.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-asset-delete">Dar de baja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
