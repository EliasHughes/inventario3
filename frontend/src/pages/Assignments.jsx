import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import SignaturePad from "@/components/SignaturePad";
import StatusBadge from "@/components/StatusBadge";
import Typeahead from "@/components/Typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, RotateCcw, Inbox, Plus, Loader2, CheckCircle2, Search, AlertTriangle } from "lucide-react";

const fdate = (v) => (v ? new Date(v).toLocaleDateString("es-DO") : "—");
const fdt = (v) => (v ? new Date(v).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" }) : "—");
const isOverdue = (r) => {
  if (!r?.expected_return || r?.returned) return false;
  const exp = new Date(r.expected_return);
  if (isNaN(exp)) return false;
  // Comparar solo la fecha (sin hora) para evitar falsos positivos el mismo día
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return exp < today;
};
const daysOverdue = (r) => {
  const exp = new Date(r.expected_return);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - exp) / (1000 * 60 * 60 * 24));
};

function DataTable({ head, rows, loading, empty, render }) {
  return (
    <div className="rounded-lg border border-border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/60 text-left">
          {head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}
        </tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={head.length} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
            : rows.length === 0 ? <tr><td colSpan={head.length} className="py-16 text-center text-muted-foreground"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />{empty}</td></tr>
              : rows.map(render)}
        </tbody>
      </table>
    </div>
  );
}

const empSuggest = (it) => (
  <div className="flex flex-col">
    <span><span className="font-mono text-xs text-primary">{it.code}</span> · <span className="font-medium">{it.name}</span></span>
    <span className="text-xs text-muted-foreground">{it.department_name || "Sin departamento"}{it.position ? ` · ${it.position}` : ""}</span>
  </div>
);
const empSelected = (it) => (
  <span><span className="font-mono text-xs text-primary">{it.code}</span> · <span className="font-medium">{it.name}</span> {it.department_name && <span className="text-xs text-muted-foreground">· {it.department_name}</span>}</span>
);
const assetSuggest = (it) => (
  <div className="flex flex-col">
    <span><span className="font-mono text-xs text-primary">{it.asset_tag}</span> · <span className="font-medium">{it.name}</span></span>
    <span className="text-xs text-muted-foreground">
      {it.serial_number ? `SN: ${it.serial_number}` : ""}
      {it.mac_address ? ` · MAC: ${it.mac_address}` : ""}
      {it.hostname ? ` · ${it.hostname}` : ""}
    </span>
  </div>
);
const assetSelected = (it) => (
  <span>
    <span className="font-mono text-xs text-primary">{it.asset_tag}</span> · <span className="font-medium">{it.name}</span>
    {it.serial_number && <span className="text-xs text-muted-foreground"> · SN {it.serial_number}</span>}
  </span>
);

export function Entregas() {
  const { hasPerm } = useAuth();
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ condition: "bueno" });
  const [emp, setEmp] = useState(null);
  const [asset, setAsset] = useState(null);
  const [sig, setSig] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/deliveries", { params: q ? { q } : {} }); setRows(data.items); }
    catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const resetForm = () => { setForm({ condition: "bueno" }); setEmp(null); setAsset(null); setSig(null); };

  const save = async () => {
    if (!asset) { toast.error("Seleccione un equipo"); return; }
    if (!emp && !form.assigned_to_name) { toast.error("Seleccione o escriba el empleado"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        asset_id: asset.id,
        signature: sig,
      };
      if (emp) {
        payload.employee_id = emp.id;
        payload.employee_code = emp.code;
        payload.assigned_to_name = emp.name;
        payload.department_id = emp.department_id;
      }
      await api.post("/deliveries", payload);
      toast.success("Entrega registrada correctamente");
      setOpen(false); resetForm(); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Entregas" subtitle="Asignación de activos a colaboradores con firma digital" icon={Truck}
        actions={hasPerm("assignments:write") && <Button onClick={() => { resetForm(); setOpen(true); }} data-testid="delivery-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nueva Entrega</Button>} />

      <div className="mb-3 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por etiqueta, serie, MAC, código o nombre..." className="pl-9" data-testid="delivery-search-input" />
      </div>

      <DataTable head={["Fecha", "Equipo", "Serie / MAC", "Empleado", "Cód.", "Entregado Por", "Devolución Esp.", "Estado"]}
        rows={rows} loading={loading} empty="No hay entregas registradas"
        render={(r) => {
          const overdue = isOverdue(r);
          return (
          <tr key={r.id}
              className={`border-b border-border last:border-0 transition-colors ${overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-secondary/50"}`}
              data-testid={`delivery-row-${r.id}`}
              data-overdue={overdue ? "true" : "false"}>
            <td className={`px-4 py-2.5 tabular ${overdue ? "text-red-800 font-semibold" : ""}`}>{fdt(r.delivery_date)}</td>
            <td className="px-4 py-2.5"><span className="font-mono text-xs text-primary">{r.asset_tag}</span> {r.asset_name}</td>
            <td className="px-4 py-2.5 text-muted-foreground text-xs">
              {r.serial_number ? <div>SN: {r.serial_number}</div> : null}
              {r.mac_address ? <div>MAC: {r.mac_address}</div> : null}
              {!r.serial_number && !r.mac_address && "—"}
            </td>
            <td className={`px-4 py-2.5 font-medium ${overdue ? "text-red-800" : ""}`}>{r.assigned_to_name}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{r.employee_code || "—"}</td>
            <td className="px-4 py-2.5">{r.delivered_by}</td>
            <td className={`px-4 py-2.5 ${overdue ? "text-red-700 font-semibold" : ""}`}>
              {fdate(r.expected_return)}
              {overdue && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      data-testid={`delivery-overdue-badge-${r.id}`}>
                  <AlertTriangle className="h-3 w-3" />
                  Vencida {daysOverdue(r)}d
                </span>
              )}
            </td>
            <td className="px-4 py-2.5">
              {r.returned
                ? <StatusBadge value="disponible" testid={`delivery-status-${r.id}`} />
                : overdue
                  ? <StatusBadge value="danado" testid={`delivery-status-${r.id}`} />
                  : <StatusBadge value="asignado" testid={`delivery-status-${r.id}`} />}
            </td>
          </tr>
        );}} />

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nueva Entrega</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1.5 block">Empleado (busque por código o nombre) <span className="text-primary">*</span></Label>
              <Typeahead endpoint="/employees/search" value={emp} onChange={setEmp}
                placeholder="Escriba código o nombre..."
                renderItem={empSuggest} renderSelected={empSelected}
                testId="delivery-employee-typeahead" />
            </div>
            <div>
              <Label className="mb-1.5 block">Equipo (serie, nombre, MAC o etiqueta) <span className="text-primary">*</span></Label>
              <Typeahead endpoint="/assets/search" params={{ available_only: true }}
                value={asset} onChange={setAsset}
                placeholder="Escriba serie, nombre, MAC..."
                renderItem={assetSuggest} renderSelected={assetSelected}
                testId="delivery-asset-typeahead" />
              <p className="text-xs text-muted-foreground mt-1">Solo se muestran equipos con estado <b>Disponible</b>.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block">Devolución esperada</Label><Input type="date" value={form.expected_return || ""} onChange={(e) => setForm({ ...form, expected_return: e.target.value })} data-testid="delivery-expected-return" /></div>
              <div>
                <Label className="mb-1.5 block">Condición</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["nuevo", "bueno", "regular", "malo"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="mb-1.5 block">Notas</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label className="mb-1.5 block">Firma de recibido</Label><SignaturePad onChange={setSig} /></div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="delivery-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Registrar Entrega</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Devoluciones() {
  const { hasPerm } = useAuth();
  const [returns, setReturns] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [form, setForm] = useState({ condition: "bueno" }); const [sig, setSig] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get("/returns", { params: q ? { q } : {} }),
        api.get("/deliveries", { params: { active_only: true, page_size: 500 } }),
      ]);
      setReturns(r.data.items); setPending(p.data.items);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const resetForm = () => { setForm({ condition: "bueno" }); setSelectedDelivery(null); setSig(null); };

  const deliverySuggest = (it) => (
    <div className="flex flex-col">
      <span><span className="font-mono text-xs text-primary">{it.asset_tag}</span> · <span className="font-medium">{it.asset_name}</span></span>
      <span className="text-xs text-muted-foreground">
        {it.assigned_to_name} {it.employee_code ? `· ${it.employee_code}` : ""}
        {it.serial_number ? ` · SN: ${it.serial_number}` : ""}
      </span>
    </div>
  );
  const deliverySelected = (it) => (
    <span><span className="font-mono text-xs text-primary">{it.asset_tag}</span> · <span className="font-medium">{it.asset_name}</span> · {it.assigned_to_name}</span>
  );

  const save = async () => {
    if (!selectedDelivery) { toast.error("Seleccione la entrega a devolver"); return; }
    setSaving(true);
    try {
      await api.post("/returns", { ...form, delivery_id: selectedDelivery.id, signature: sig });
      toast.success("Devolución registrada correctamente");
      setOpen(false); resetForm(); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Devoluciones" subtitle="Registro ágil de devolución de equipos entregados" icon={RotateCcw}
        actions={hasPerm("assignments:write") && <Button onClick={() => { resetForm(); setOpen(true); }} data-testid="return-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Registrar Devolución</Button>} />

      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por etiqueta, serie, empleado..." className="pl-9" data-testid="return-search-input" />
        </div>
        <span className="text-sm text-muted-foreground">
          Pendientes: <span className="font-bold text-blue-700">{pending.length}</span>
          {(() => {
            const overdue = pending.filter(isOverdue).length;
            return overdue > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" data-testid="return-overdue-count">
                <AlertTriangle className="h-3 w-3" />{overdue} vencida(s)
              </span>
            ) : null;
          })()}
        </span>
      </div>

      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-blue-600" /> Entregas pendientes de devolución
          </h3>
          <DataTable head={["Fecha Entrega", "Equipo", "Empleado", "Cód.", "Devolución Esp.", "Días", ""]}
            rows={pending} loading={false} empty=""
            render={(d) => {
              const overdue = isOverdue(d);
              return (
                <tr key={d.id}
                    className={`border-b border-border last:border-0 transition-colors ${overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-secondary/50"}`}
                    data-testid={`pending-row-${d.id}`}
                    data-overdue={overdue ? "true" : "false"}>
                  <td className={`px-4 py-2.5 tabular ${overdue ? "text-red-800 font-semibold" : ""}`}>{fdt(d.delivery_date)}</td>
                  <td className="px-4 py-2.5"><span className="font-mono text-xs text-primary">{d.asset_tag}</span> {d.asset_name}
                    {d.serial_number && <span className="ml-1 text-xs text-muted-foreground">· SN {d.serial_number}</span>}
                  </td>
                  <td className={`px-4 py-2.5 font-medium ${overdue ? "text-red-800" : ""}`}>{d.assigned_to_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{d.employee_code || "—"}</td>
                  <td className={`px-4 py-2.5 ${overdue ? "text-red-700 font-semibold" : ""}`}>{fdate(d.expected_return)}</td>
                  <td className="px-4 py-2.5">
                    {overdue ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                            data-testid={`pending-overdue-badge-${d.id}`}>
                        <AlertTriangle className="h-3 w-3" />
                        {daysOverdue(d)} día(s) vencida
                      </span>
                    ) : d.expected_return ? (
                      <span className="text-xs text-muted-foreground">A tiempo</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin fecha</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {hasPerm("assignments:write") && (
                      <Button size="sm" variant="outline" onClick={() => { setSelectedDelivery(d); setForm({ condition: "bueno" }); setSig(null); setOpen(true); }}
                              data-testid={`pending-return-btn-${d.id}`}>
                        Devolver
                      </Button>
                    )}
                  </td>
                </tr>
              );
            }} />
        </div>
      )}

      <h3 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Devoluciones registradas
      </h3>
      <DataTable head={["Fecha Devol.", "Equipo", "Serie", "Devuelto Por", "Cód.", "Recibido Por", "Condición"]}
        rows={returns} loading={loading} empty="Sin devoluciones registradas"
        render={(r) => (
          <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
            <td className="px-4 py-2.5 tabular">{fdt(r.return_date)}</td>
            <td className="px-4 py-2.5"><span className="font-mono text-xs text-primary">{r.asset_tag}</span> {r.asset_name}</td>
            <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.serial_number || "—"}</td>
            <td className="px-4 py-2.5 font-medium">{r.returned_by}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{r.employee_code || "—"}</td>
            <td className="px-4 py-2.5">{r.received_by}</td>
            <td className="px-4 py-2.5">
              {r.condition === "danado" || r.condition === "malo"
                ? <StatusBadge value="danado" size="sm" />
                : <span className="capitalize">{r.condition}</span>}
            </td>
          </tr>
        )} />

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Registrar Devolución</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1.5 block">Entrega a devolver <span className="text-primary">*</span></Label>
              <Typeahead endpoint="/deliveries" params={{ active_only: true, page_size: 25 }}
                value={selectedDelivery} onChange={setSelectedDelivery}
                placeholder="Escriba etiqueta, serie, MAC, empleado..."
                renderItem={deliverySuggest} renderSelected={deliverySelected}
                testId="return-delivery-typeahead" />
              <p className="text-xs text-muted-foreground mt-1">Búsqueda entre <b>{pending.length}</b> entrega(s) activa(s).</p>
            </div>
            <div>
              <Label className="mb-1.5 block">Condición de retorno</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger data-testid="return-condition-select"><SelectValue /></SelectTrigger>
                <SelectContent>{["bueno", "regular", "danado", "malo"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1.5 block">Recibido por (opcional)</Label><Input value={form.received_by || ""} onChange={(e) => setForm({ ...form, received_by: e.target.value })} placeholder="Nombre de quien recibe" /></div>
            <div><Label className="mb-1.5 block">Notas</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label className="mb-1.5 block">Firma de quien devuelve</Label><SignaturePad onChange={setSig} /></div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="return-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Registrar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Recepciones() {
  const { hasPerm } = useAuth();
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ condition: "bueno" }); const [sig, setSig] = useState(null);
  const [cats, setCats] = useState([]);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/receptions"); setRows(data.items); } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); api.get("/categories", { params: { page_size: 500 } }).then((r) => setCats(r.data.items)).catch(() => {}); }, []);

  const save = async () => {
    if (!form.description) { toast.error("Ingrese la descripción del equipo recibido"); return; }
    setSaving(true);
    try {
      await api.post("/receptions", { ...form, signature: sig });
      toast.success("Recepción registrada correctamente");
      setOpen(false); setForm({ condition: "bueno" }); setSig(null); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Recepciones" subtitle="Registro de equipos recibidos en almacén" icon={Inbox}
        actions={hasPerm("assignments:write") && <Button onClick={() => setOpen(true)} data-testid="reception-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nueva Recepción</Button>} />
      <DataTable head={["Fecha", "Equipo / Descripción", "Serie", "Entregado Por", "Cód. Empleado", "Recibido Por", "Condición"]}
        rows={rows} loading={loading} empty="No hay recepciones registradas"
        render={(r) => (
          <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
            <td className="px-4 py-2.5 tabular">{fdate(r.reception_date)}</td>
            <td className="px-4 py-2.5 font-medium">{r.description}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{r.serial_number || "—"}</td>
            <td className="px-4 py-2.5">{r.delivered_by || "—"}</td>
            <td className="px-4 py-2.5">{r.employee_code || "—"}</td>
            <td className="px-4 py-2.5">{r.received_by}</td>
            <td className="px-4 py-2.5 capitalize">{r.condition}</td>
          </tr>
        )} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nueva Recepción</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div><Label className="mb-1.5 block">Descripción del equipo *</Label><Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="reception-desc-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block">Serie</Label><Input value={form.serial_number || ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
              <div><Label className="mb-1.5 block">Categoría</Label>
                <Select value={form.category_id || ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block">Entregado por</Label><Input value={form.delivered_by || ""} onChange={(e) => setForm({ ...form, delivered_by: e.target.value })} /></div>
              <div><Label className="mb-1.5 block">Cód. Empleado</Label><Input value={form.employee_code || ""} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
            </div>
            <div><Label className="mb-1.5 block">Condición</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["bueno", "regular", "danado", "malo"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1.5 block">Notas</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label className="mb-1.5 block">Firma</Label><SignaturePad onChange={setSig} /></div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="reception-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Registrar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
