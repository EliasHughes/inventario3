import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings as SettingsIcon, Loader2, Server, Database, ShieldCheck } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)).catch((e) => toast.error(apiError(e))); }, []);

  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put("/settings", s); setS(data); toast.success("Configuración guardada correctamente"); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  if (!s) return <Loader2 className="h-6 w-6 animate-spin mx-auto mt-20 text-primary" />;
  const set = (k, v) => setS({ ...s, [k]: v });

  return (
    <div>
      <PageHeader title="Configuración del Sistema" subtitle="Parámetros generales y políticas de la plataforma" icon={SettingsIcon} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="font-bold mb-4">General</h3>
          <div className="space-y-4">
            <div><Label className="mb-1.5 block">Empresa</Label><Input value={s.company_name || ""} onChange={(e) => set("company_name", e.target.value)} data-testid="setting-company" /></div>
            <div><Label className="mb-1.5 block">Nombre de la plataforma</Label><Input value={s.app_name || ""} onChange={(e) => set("app_name", e.target.value)} /></div>
            <div><Label className="mb-1.5 block">Moneda</Label><Input value={s.currency || ""} onChange={(e) => set("currency", e.target.value)} /></div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <h3 className="font-bold mb-4">Seguridad y Alertas</h3>
          <div className="space-y-4">
            <div><Label className="mb-1.5 block">Longitud mínima de contraseña</Label><Input type="number" value={s.password_min_length || 8} onChange={(e) => set("password_min_length", Number(e.target.value))} /></div>
            <div><Label className="mb-1.5 block">Expiración de sesión (minutos)</Label><Input type="number" value={s.session_minutes || 60} onChange={(e) => set("session_minutes", Number(e.target.value))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block">Alerta garantías (días)</Label><Input type="number" value={s.warranty_alert_days || 60} onChange={(e) => set("warranty_alert_days", Number(e.target.value))} /></div>
              <div><Label className="mb-1.5 block">Alerta licencias (días)</Label><Input type="number" value={s.license_alert_days || 60} onChange={(e) => set("license_alert_days", Number(e.target.value))} /></div>
            </div>
          </div>
        </div>
      </div>
      <Button className="mt-6" onClick={save} disabled={saving} data-testid="settings-save-btn">{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Guardar Configuración</Button>

      <div className="mt-8 rounded-lg border border-dashed bg-white p-6">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> Arquitectura de Despliegue (On-Premise Microsoft)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Esta plataforma implementa Arquitectura Limpia (Presentación · API · Servicios · Dominio · Repositorios · Infraestructura) y está diseñada
          para operar sobre el ecosistema Microsoft. La versión de preview corre sobre FastAPI + MongoDB; en producción es portable a los componentes indicados.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-md bg-secondary p-3"><Database className="h-4 w-4 mb-1 text-primary" /><b>Base de Datos</b><br />SQL Server 2019 + Always On Availability Groups, respaldos automáticos.</div>
          <div className="rounded-md bg-secondary p-3"><Server className="h-4 w-4 mb-1 text-primary" /><b>Servidor Web</b><br />IIS como Reverse Proxy hacia FastAPI (Windows Service / Kestrel).</div>
          <div className="rounded-md bg-secondary p-3"><ShieldCheck className="h-4 w-4 mb-1 text-primary" /><b>Autenticación</b><br />Active Directory (LDAP/Kerberos) + SSO, JWT para la API, RBAC granular.</div>
        </div>
      </div>
    </div>
  );
}
