import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });

  const load = async () => {
    try {
      // const res = await api.get("/notifications");
      console.log("Cargando notificaciones...");
      setData({ items: [], unread: 2 });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    console.log("Marcar todas como leídas");
    load();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-secondary text-slate-600">
          <Bell className="h-5 w-5" />
          {data.unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {data.unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          <button className="text-xs text-primary hover:underline" onClick={markAll}>Marcar leídas</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {data.items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Sin notificaciones</div>
          ) : (
            data.items.map((n) => (
              <div key={n.id} className="px-3 py-2 border-b last:border-0">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.message}</div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
