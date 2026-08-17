import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserSquare2, Plus, Search, Pencil, Trash2, Loader2, Inbox } from "lucide-react";

export default function Employees() {
  const { hasPerm } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [depFilter, setDepFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [deps, setDeps] = useState([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const pageSize = 25;
  const canWrite = hasPerm("employees:write");
  const canDelete = hasPerm("employees:delete");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const nameOfDep = (id) => deps.find((d) => d.id === id)?.name || "—";

  const load = async () => {
    setLoading(true);
    try {
      const params = { q, page, page_size: pageSize };
      if (depFilter !== "todos") params.department_id = depFilter;
      const { data } = await api.get("/employees", { params });
      setRows(data.items || []); setTotal(data.total || 0);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/departments", { params: { page_size: 500 } }).then((r) => setDeps(r.data.items || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, depFilter]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const openCreate = () => { setForm({}); setEditing(null); setOpen(true); };
  const openEdit = (row) => { setForm({ ...row }); setEditing(row); setOpen(true); };

  const save = async () => {
    if (!form.code?.trim()) { toast.error("Ingrese el código del empleado"); return; }
    if (!form.name?.trim()) { toast.error("Ingrese el nombre del empleado"); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/employees/${editing.id}`, form);
      else await api.post("/employees", form);
      toast.success(editing ? "Empleado actualizado" : "Empleado registrado");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    try { await api.delete(`/employees/${deleteId}`); toast.success("Empleado eliminado"); setDeleteId(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title="Empleados" subtitle="Colaboradores que reciben equipos de TI" icon={UserSquare2}
        actions={canWrite && <Button onClick={openCreate} data-testid="employee-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nuevo Empleado</Button>} />

      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o nombre..." className="pl-9" data-testid="employee-search-input" />
          </div>
          <Select value={depFilter} onValueChange={setDepFilter}>
            <SelectTrigger className="w-[220px]" data-testid="employee-filter-department"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los departamentos</SelectItem>
              {deps.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto tabular">{total} empleado(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left">
                {["Código", "Nombre", "Departamento", "Supervisor", "Cargo", "Correo", "Teléfono", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-muted-foreground"><Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />No hay empleados registrados</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors" data-testid={`employee-row-${r.id}`}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{r.code}</td>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5">{r.department_name || nameOfDep(r.department_id)}</td>
                  <td className="px-4 py-2.5">{r.supervisor || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5">{r.position || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5">{r.email || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5">{r.phone || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    {canWrite && <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="h-8 w-8 p-0" data-testid={`employee-edit-${r.id}`}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleteId(r.id)} className="h-8 w-8 p-0 text-red-600" data-testid={`employee-delete-${r.id}`}><Trash2 className="h-4 w-4" /></Button>}
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar Empleado" : "Nuevo Empleado"}</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-1">
              <Label className="mb-1.5 block">Código <span className="text-primary">*</span></Label>
              <Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ej: 001, EMP-123" data-testid="employee-field-code" />
            </div>
            <div className="col-span-1">
              <Label className="mb-1.5 block">Cargo</Label>
              <Input value={form.position || ""} onChange={(e) => setForm({ ...form, position: e.target.value })} data-testid="employee-field-position" />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Nombre completo <span className="text-primary">*</span></Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="employee-field-name" />
            </div>
            <div className="col-span-1">
              <Label className="mb-1.5 block">Departamento</Label>
              <Select value={form.department_id || ""} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger data-testid="employee-field-department"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>{deps.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Label className="mb-1.5 block">Supervisor</Label>
              <Input value={form.supervisor || ""} onChange={(e) => setForm({ ...form, supervisor: e.target.value })} data-testid="employee-field-supervisor" />
            </div>
            <div className="col-span-1">
              <Label className="mb-1.5 block">Correo</Label>
              <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-1">
              <Label className="mb-1.5 block">Teléfono</Label>
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Notas</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="employee-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{editing ? "Guardar" : "Registrar"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>Se realiza una eliminación lógica. Si tiene equipos entregados activos, se rechazará.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-employee-delete">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
