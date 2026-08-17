import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NAV_GROUPS } from "@/constants/nav";
import { Menu, LogOut, ShieldCheck, ChevronLeft, KeyRound } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppLayout({ children }) {
  const { user, logout, hasPerm } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const initials = (user?.name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const SidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-sm shrink-0">
          CI
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-black text-[15px] text-foreground">Cisa TI</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gestión de Activos</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.perm || hasPerm(i.perm));
          if (!items.length) return null;
          return (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    data-testid={item.testid}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `nav-item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-accent text-primary border-l-2 border-primary"
                          : "text-slate-600 hover:bg-secondary hover:text-foreground border-l-2 border-transparent"
                      }`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-secondary">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block border-r border-border shrink-0 transition-all duration-200"
        style={{ width: collapsed ? 64 : 260 }}
      >
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 shadow-xl">{SidebarContent}</div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-white/90 backdrop-blur px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary text-slate-600"
              onClick={() => setCollapsed((c) => !c)}
              data-testid="toggle-sidebar-btn"
            >
              <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
            <button
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-md hover:bg-secondary text-slate-600"
              onClick={() => setMobileOpen(true)}
              data-testid="mobile-menu-btn"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block text-sm text-muted-foreground">
              César Iglesias S.A. · <span className="font-semibold text-foreground">Departamento de Tecnología</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-secondary" data-testid="user-menu-btn">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden sm:block text-left leading-tight">
                    <span className="block text-sm font-semibold text-foreground">{user?.name}</span>
                    <span className="block text-[11px] capitalize text-muted-foreground">{user?.role?.replace("_", " ")}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/cambiar-clave")} data-testid="menu-change-password">
                  <KeyRound className="h-4 w-4 mr-2" /> Cambiar contraseña
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} data-testid="logout-btn" className="text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1400px] animate-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
