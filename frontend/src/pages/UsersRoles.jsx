import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react";

export default function UsersRoles() {
  const { hasPerm, user: me } = useAuth();
  const [users, setUsers] = useState([]); const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState({ modules: [] });
  const [loading, setLoading] = useState(true);
  const [uOpen, setUOpen] = useState(false); const [uForm, setUForm] = useState({}); const [uEdit, setUEdit] = useState(null);
  const [rOpen, setROpen] = useState(false); const [rForm, setRForm] = useState({ permissions: [] }); const [rEdit, setREdit] = useState(null);
  const [delUser, setDelUser] = useState(null); const [saving, setSaving] = useState(false);
  const canWrite = hasPerm("users:write");

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, c] = await Promise.all([api.get("/users"), api.get("/roles"), api.get("/permissions/catalog")]);
      setUsers(u.data.items); setRoles(r.data.items); setCatalog(c.data);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveUser = async () => {
    if (!uForm.email || !uForm.name || (!uEdit && !uForm.password)) { toast.error("Complete nombre, correo y contraseña"); return; }
    setSaving(true);
    try {
      if (uEdit) { const p = { ...uForm }; if (!p.password) delete p.password; await api.put(`/users/${uEdit.id}`, p); }
      else await api.post("/users", uForm);
      toast.success(uEdit ? "Usuario actualizado" : "Usuario creado correctamente");
      setUOpen(false); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const saveRole = async () => {
    if (!rForm.name) { toast.error("Ingrese el nombre del rol"); return; }
    setSaving(true);
    try {
      if (rEdit) await api.put(`/roles/${rEdit.id}`, rForm); else await api.post("/roles", rForm);
      toast.success(rEdit ? "Rol actualizado" : "Rol creado"); setROpen(false); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const togglePerm = (key) => {
    setRForm((prev) => ({ ...prev, permissions: prev.permissions.includes(key) ? prev.permissions.filter((p) => p !== key) : [...prev.permissions, key] }));
  };

  return (
    <div>
      <PageHeader title="Usuarios y Roles" subtitle="Control de acceso basado en roles (RBAC) con permisos granulares" icon={Users} />
      <Tabs defaultValue="users">
        <TabsList><TabsTrigger value="users" data-testid="tab-users">Usuarios</TabsTrigger><TabsTrigger value="roles" data-testid="tab-roles">Roles y Permisos</TabsTrigger></TabsList>

        <TabsContent value="users" className="pt-4">
          {canWrite && <Button className="mb-3" onClick={() => { setUForm({ role: "consulta", is_active: true }); setUEdit(null); setUOpen(true); }} data-testid="user-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nuevo Usuario</Button>}
          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-secondary/60 text-left">{["Nombre", "Correo", "Rol", "Activo", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold text-slate-600">{h}</th>)}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr>
                  : users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-2.5 font-medium">{u.name}</td>
                      <td className="px-4 py-2.5">{u.email}</td>
                      <td className="px-4 py-2.5 capitalize">{u.role?.replace("_", " ")}</td>
                      <td className="px-4 py-2.5">{u.is_active ? <span className="text-emerald-600">Sí</span> : <span className="text-red-600">No</span>}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canWrite && <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setUForm({ ...u, password: "" }); setUEdit(u); setUOpen(true); }} data-testid={`user-edit-${u.id}`}><Pencil className="h-4 w-4" /></Button>}
                        {hasPerm("users:delete") && u.id !== me?.id && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={() => setDelUser(u.id)} data-testid={`user-delete-${u.id}`}><Trash2 className="h-4 w-4" /></Button>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="pt-4">
          {canWrite && <Button className="mb-3" onClick={() => { setRForm({ name: "", description: "", permissions: [] }); setREdit(null); setROpen(true); }} data-testid="role-create-btn"><Plus className="h-4 w-4 mr-1.5" /> Nuevo Rol</Button>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((r) => (
              <div key={r.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-bold capitalize">{r.name.replace("_", " ")} {r.is_system && <span className="text-[10px] uppercase text-muted-foreground">(sistema)</span>}</div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    </div>
                  </div>
                  {canWrite && <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setRForm({ name: r.name, description: r.description, permissions: r.permissions.includes("*") ? catalog.all : r.permissions }); setREdit(r); setROpen(true); }} data-testid={`role-edit-${r.id}`}><Pencil className="h-4 w-4" /></Button>}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{r.user_count} usuario(s) · {r.permissions.includes("*") ? "Acceso total" : `${r.permissions.length} permisos`}</div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* User form */}
      <Sheet open={uOpen} onOpenChange={setUOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{uEdit ? "Editar Usuario" : "Nuevo Usuario"}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div><Label className="mb-1.5 block">Nombre *</Label><Input value={uForm.name || ""} onChange={(e) => setUForm({ ...uForm, name: e.target.value })} data-testid="user-name-input" /></div>
            <div><Label className="mb-1.5 block">Correo *</Label><Input type="email" value={uForm.email || ""} onChange={(e) => setUForm({ ...uForm, email: e.target.value })} disabled={!!uEdit} data-testid="user-email-input" /></div>
            <div><Label className="mb-1.5 block">{uEdit ? "Nueva contraseña (opcional)" : "Contraseña *"}</Label><Input type="password" value={uForm.password || ""} onChange={(e) => setUForm({ ...uForm, password: e.target.value })} data-testid="user-password-input" /></div>
            <div><Label className="mb-1.5 block">Rol</Label>
              <Select value={uForm.role || "consulta"} onValueChange={(v) => setUForm({ ...uForm, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.name} className="capitalize">{r.name.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block">Cód. Empleado</Label><Input value={uForm.employee_code || ""} onChange={(e) => setUForm({ ...uForm, employee_code: e.target.value })} /></div>
              <div><Label className="mb-1.5 block">Teléfono</Label><Input value={uForm.phone || ""} onChange={(e) => setUForm({ ...uForm, phone: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={uForm.is_active !== false} onCheckedChange={(v) => setUForm({ ...uForm, is_active: v })} data-testid="user-active-switch" /><Label>Usuario activo</Label></div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setUOpen(false)}>Cancelar</Button>
            <Button onClick={saveUser} disabled={saving} data-testid="user-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Guardar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Role form */}
      <Sheet open={rOpen} onOpenChange={setROpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{rEdit ? "Editar Rol" : "Nuevo Rol"}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div><Label className="mb-1.5 block">Nombre del rol *</Label><Input value={rForm.name || ""} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} disabled={rEdit?.is_system} data-testid="role-name-input" /></div>
            <div><Label className="mb-1.5 block">Descripción</Label><Input value={rForm.description || ""} onChange={(e) => setRForm({ ...rForm, description: e.target.value })} /></div>
            <div>
              <Label className="mb-2 block">Permisos por módulo</Label>
              <div className="space-y-3 rounded-md border p-3 max-h-[50vh] overflow-y-auto">
                {catalog.modules.map((m) => (
                  <div key={m.module}>
                    <div className="font-semibold text-sm mb-1">{m.label}</div>
                    <div className="flex flex-wrap gap-4">
                      {m.permissions.map((p) => (
                        <label key={p.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox checked={rForm.permissions?.includes(p.key)} onCheckedChange={() => togglePerm(p.key)} data-testid={`perm-${p.key}`} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setROpen(false)}>Cancelar</Button>
            <Button onClick={saveRole} disabled={saving} data-testid="role-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Guardar Rol</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>El usuario será desactivado y eliminado lógicamente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { try { await api.delete(`/users/${delUser}`); toast.success("Usuario eliminado"); setDelUser(null); load(); } catch (e) { toast.error(apiError(e)); } }} className="bg-red-600 hover:bg-red-700" data-testid="confirm-user-delete">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
