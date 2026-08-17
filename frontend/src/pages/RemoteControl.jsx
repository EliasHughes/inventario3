import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import RemoteViewer from "@/components/RemoteViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Monitor, Search, Loader2, Inbox, X } from "lucide-react";

export default function RemoteControl() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null); // { hostname, name, asset_tag }

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/assets", {
        params: { page: 1, page_size: 200, q: q || undefined },
      });
      // Solo equipos con hostname (vienen del agente)
      const items = (data.items || []).filter((a) => a.hostname);
      setRows(items);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  return (
    <div>
      <PageHeader
        title="Control Remoto"
        subtitle="Acceso a escritorios de equipos del dominio"
        icon={Monitor}
      />

      {!selected ? (
        <div className="rounded-lg border border-border bg-white">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por hostname, nombre, etiqueta..."
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground ml-auto">
              {rows.length} equipo(s) con hostname
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left">
                  {["Etiqueta", "Nombre", "Hostname", "IP", "Usuario", "Acción"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      No hay equipos con hostname. Ejecute el agente de inventario en las PCs.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">
                        {r.asset_tag}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.hostname}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.ip_address || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.last_user || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            setSelected({
                              hostname: r.hostname,
                              name: r.name,
                              asset_tag: r.asset_tag,
                            })
                          }
                        >
                          Conectar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-white p-3">
            <div>
              <div className="font-semibold">
                {selected.name}{" "}
                <span className="font-mono text-primary text-sm">({selected.asset_tag})</span>
              </div>
              <div className="text-sm text-muted-foreground font-mono">{selected.hostname}</div>
            </div>
            <Button variant="outline" onClick={() => setSelected(null)}>
              <X className="h-4 w-4 mr-1.5" />
              Desconectar
            </Button>
          </div>

          <RemoteViewer hostname={selected.hostname} />
        </div>
      )}
    </div>
  );
}