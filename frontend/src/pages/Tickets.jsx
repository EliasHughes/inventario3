import React, { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Ticket, Plus, Loader2, Inbox, Eye, Search } from "lucide-react";

const fdate = (v) => (v ? new Date(v).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function Tickets() {
  const { hasPerm } = useAuth();
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); const [fStatus, setFStatus] = useState("todos");
  const [meta, setMeta] = useState({ statuses: [], priorities: [] });
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "incidencia", priority: "media" });
  const [detail, setDetail] = useState(null); const [comment, setComment] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = { q }; if (fStatus !== "todos") params.status = fStatus;
      const { data } = await api.get("/tickets", { params }); setRows(data.items);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { api.get("/tickets/meta").then((r) => setMeta(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fStatus]);
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const save = async () => {
    if (!form.title) { toast.error("Ingrese el título del ticket"); return; }
    setSaving(true);
    try { await api.post("/tickets", form); toast.success("Ticket creado correctamente"); setOpen(false); setForm({ type: "incidencia", priority: "media" }); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const updateTicket = async (patch) => {
    try {
      const { data } = await api.put(`/tickets/${detail.id}`, patch);
      setDetail(data); setComment(""); toast.success("Ticket actualizado"); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title="Tickets / Incidencias" subtitle="Gestión de solicitudes e incidencias (ITIL)" icon={Ticket}
        actions={hasPerm("tickets:write") && <Button onClick={() => setOpen(true)} data-testid="ticket-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nuevo Ticket</Button>} />

      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ticket..." className="pl-9" data-testid="ticket-search-input" />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{meta.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-secondary/60 text-left">
              {["N° Ticket", "Título", "Tipo", "Prioridad", "Estado", "Reportado Por", "Fecha", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} className="py-16 text-center text-muted-foreground"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />No hay tickets</td></tr>
                  : rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-2.5 font-mono text-xs text-primary">{r.ticket_number}</td>
                      <td className="px-4 py-2.5 font-medium">{r.title}</td>
                      <td className="px-4 py-2.5 capitalize">{r.type}</td>
                      <td className="px-4 py-2.5"><StatusBadge value={r.priority} /></td>
                      <td className="px-4 py-2.5"><StatusBadge value={r.status} /></td>
                      <td className="px-4 py-2.5">{r.reported_by}</td>
                      <td className="px-4 py-2.5 tabular">{fdate(r.created_at)}</td>
                      <td className="px-4 py-2.5 text-right"><Button variant="ghost" size="sm" onClick={() => setDetail(r)} className="h-8 w-8 p-0" data-testid={`ticket-view-${r.id}`}><Eye className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Nuevo Ticket</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div><Label className="mb-1.5 block">Título *</Label><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="ticket-title-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="incidencia">Incidencia</SelectItem><SelectItem value="solicitud">Solicitud</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="mb-1.5 block">Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger data-testid="ticket-priority-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="mb-1.5 block">Activo relacionado (etiqueta)</Label><Input value={form.asset_tag || ""} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} /></div>
            <div><Label className="mb-1.5 block">Descripción</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="ticket-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Crear</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader><SheetTitle><span className="font-mono text-primary">{detail.ticket_number}</span> · {detail.title}</SheetTitle></SheetHeader>
              <div className="space-y-3 py-4">
                <div className="flex gap-2"><StatusBadge value={detail.status} /><StatusBadge value={detail.priority} /></div>
                <p className="text-sm text-muted-foreground">{detail.description || "Sin descripción"}</p>
                {detail.asset_tag && <p className="text-sm">Activo: <span className="font-mono">{detail.asset_tag}</span></p>}
                <div className="text-xs text-muted-foreground">Reportado por {detail.reported_by} · {fdate(detail.created_at)}</div>

                {hasPerm("tickets:write") && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div><Label className="mb-1.5 block">Estado</Label>
                      <Select value={detail.status} onValueChange={(v) => updateTicket({ status: v })}>
                        <SelectTrigger data-testid="ticket-status-select"><SelectValue /></SelectTrigger>
                        <SelectContent>{meta.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="mb-1.5 block">Asignado a</Label><Input defaultValue={detail.assigned_to || ""} onBlur={(e) => e.target.value !== detail.assigned_to && updateTicket({ assigned_to: e.target.value })} /></div>
                  </div>
                )}

                <div className="pt-2">
                  <Label className="mb-1.5 block">Comentarios</Label>
                  <div className="space-y-2 mb-2">
                    {(detail.comments || []).map((c) => (
                      <div key={c.id} className="rounded-md bg-secondary p-2 text-sm">
                        <div className="font-medium">{c.author}</div><div>{c.text}</div>
                        <div className="text-xs text-muted-foreground">{fdate(c.at)}</div>
                      </div>
                    ))}
                    {(!detail.comments || detail.comments.length === 0) && <p className="text-sm text-muted-foreground">Sin comentarios</p>}
                  </div>
                  {hasPerm("tickets:write") && (
                    <div className="flex gap-2">
                      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Agregar comentario..." data-testid="ticket-comment-input" />
                      <Button onClick={() => comment && updateTicket({ comment })} data-testid="ticket-comment-btn">Enviar</Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
