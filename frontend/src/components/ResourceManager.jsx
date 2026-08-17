import React, { useEffect, useMemo, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Loader2, Inbox } from "lucide-react";

export default function ResourceManager({
  title, subtitle, icon, endpoint, permission, columns, fields,
  emptyText = "No hay registros aún.",
}) {
  const { hasPerm } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [relations, setRelations] = useState({});
  const pageSize = 25;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, { params: { q, page, page_size: pageSize } });
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t); /* eslint-disable-next-line */
  }, [q]);

  // load relation options
  useEffect(() => {
    const relFields = fields.filter((f) => f.relation);
    relFields.forEach(async (f) => {
      try {
        const { data } = await api.get(f.relation.endpoint, { params: { page_size: 500 } });
        setRelations((prev) => ({ ...prev, [f.name]: data.items || [] }));
      } catch {}
    });
    /* eslint-disable-next-line */
  }, []);

  const relLabel = (fieldName, id) => {
    const opts = relations[fieldName] || [];
    const found = opts.find((o) => o.id === id);
    return found ? (found.name || found.title || id) : (id || "—");
  };

  const openCreate = () => {
    const init = {};
    fields.forEach((f) => { if (f.default !== undefined) init[f.name] = f.default; });
    setForm(init); setEditing(null); setSheetOpen(true);
  };

  const openEdit = (row) => {
    setForm({ ...row }); setEditing(row); setSheetOpen(true);
  };

  const save = async () => {
    for (const f of fields) {
      if (f.required && !form[f.name] && form[f.name] !== 0) {
        toast.error(`El campo "${f.label}" es obligatorio`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach((f) => {
        if (f.type === "number" && payload[f.name] !== undefined && payload[f.name] !== "")
          payload[f.name] = Number(payload[f.name]);
      });
      if (editing) await api.put(`${endpoint}/${editing.id}`, payload);
      else await api.post(endpoint, payload);
      toast.success(editing ? "Registro actualizado correctamente" : "Registro creado correctamente");
      setSheetOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`${endpoint}/${deleteId}`);
      toast.success("Registro eliminado");
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const canWrite = hasPerm(`${permission}:write`);
  const canDelete = hasPerm(`${permission}:delete`);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const renderCell = (col, row) => {
    if (col.render) return col.render(row, relLabel);
    if (col.relation) return relLabel(col.relationField || col.key, row[col.key]);
    const v = row[col.key];
    return v === null || v === undefined || v === "" ? <span className="text-muted-foreground">—</span> : String(v);
  };

  return (
    <div>
      <PageHeader
        title={title} subtitle={subtitle} icon={icon}
        actions={canWrite && (
          <Button onClick={openCreate} className="rounded-md" data-testid="resource-create-btn">
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo
          </Button>
        )}
      />

      <div className="rounded-lg border border-border bg-white">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..."
              className="pl-9" data-testid="resource-search-input" />
          </div>
          <span className="text-sm text-muted-foreground ml-auto tabular">{total} registro(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left">
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="py-16 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="py-16 text-center text-muted-foreground">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />{emptyText}
                </td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 align-middle">{renderCell(c, row)}</td>
                  ))}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}
                        data-testid={`edit-btn-${row.id}`} className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(row.id)}
                        data-testid={`delete-btn-${row.id}`} className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar" : "Nuevo"} · {title}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {fields.map((f) => (
              <div key={f.name} className={f.colSpan === 1 ? "col-span-1" : "col-span-2"}>
                <Label className="mb-1.5 block">{f.label}{f.required && <span className="text-primary"> *</span>}</Label>
                {f.type === "textarea" ? (
                  <Textarea value={form[f.name] || ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    data-testid={`field-${f.name}`} />
                ) : f.type === "select" || f.relation ? (
                  <Select value={form[f.name] || ""} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                    <SelectTrigger data-testid={`field-${f.name}`}><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {(f.relation ? (relations[f.name] || []).map((o) => ({ value: o.id, label: o.name || o.title })) : f.options).map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    data-testid={`field-${f.name}`} />
                )}
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} data-testid="resource-save-btn">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Guardar cambios" : "Crear"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción realiza una eliminación lógica (soft delete). El historial se conserva para auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-btn">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
