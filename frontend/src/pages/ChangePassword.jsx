import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

export default function ChangePassword() {
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [conf, setConf] = useState("");
  const [saving, setSaving] = useState(false); const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (nw !== conf) { toast.error("Las contraseñas no coinciden"); return; }
    if (nw.length < 8) { toast.error("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: nw });
      toast.success("Contraseña actualizada correctamente"); navigate("/");
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-md">
      <PageHeader title="Cambiar Contraseña" subtitle="Actualice sus credenciales de acceso" icon={KeyRound} />
      <form onSubmit={submit} className="rounded-lg border bg-white p-6 space-y-4">
        <div><Label className="mb-1.5 block">Contraseña actual</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required data-testid="current-password-input" /></div>
        <div><Label className="mb-1.5 block">Nueva contraseña</Label><Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} required data-testid="new-password-input" /></div>
        <div><Label className="mb-1.5 block">Confirmar nueva contraseña</Label><Input type="password" value={conf} onChange={(e) => setConf(e.target.value)} required data-testid="confirm-password-input" /></div>
        <Button type="submit" disabled={saving} data-testid="change-password-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Actualizar Contraseña</Button>
      </form>
    </div>
  );
}
