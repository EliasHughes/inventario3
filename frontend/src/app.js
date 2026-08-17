import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Assets from "@/pages/Assets";
import Employees from "@/pages/Employees";
import Reports from "@/pages/Reports";
import { Entregas, Devoluciones, Recepciones } from "@/pages/Assignments";
import Inventory from "@/pages/Inventory";
import Tickets from "@/pages/Tickets";
import Audit from "@/pages/Audit";
import UsersRoles from "@/pages/UsersRoles";
import Settings from "@/pages/Settings";
import ChangePassword from "@/pages/ChangePassword";
import RemoteControl from "@/pages/RemoteControl";
import {
  Departamentos, Sucursales, Ubicaciones, Fabricantes, Modelos, Categorias,
  Proveedores, OrdenesCompra, Facturas, Garantias, Mantenimientos, Software, Licencias,
} from "@/pages/ResourcePages";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return <div className="flex h-screen items-center justify-center bg-secondary"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return <div className="flex h-screen items-center justify-center bg-secondary"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

const R = (el) => <Protected>{el}</Protected>;

function App() {

  // const _check = { Dashboard, Assets, Inventory, Tickets, Audit, UsersRoles,
  //   Settings, ChangePassword, Entregas, Devoluciones, Recepciones,
  //   Departamentos, Sucursales, Ubicaciones, Fabricantes, Modelos, Categorias,
  //   Proveedores, OrdenesCompra, Facturas, Garantias, Mantenimientos, Software, Licencias };
  //   Object.entries(_check).forEach(([n, c]) => {
  //   if (typeof c !== "function" && !(c && c.$$typeof)) console.error("❌ INVÁLIDO:", n, c);
  //   });
  
  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/" element={R(<Dashboard />)} />
            <Route path="/activos" element={R(<Assets />)} />
            <Route path="/control-remoto" element={R(<RemoteControl />)} />
            <Route path="/empleados" element={R(<Employees />)} />
            <Route path="/reportes" element={R(<Reports />)} />
            <Route path="/entregas" element={R(<Entregas />)} />
            <Route path="/devoluciones" element={R(<Devoluciones />)} />
            <Route path="/recepciones" element={R(<Recepciones />)} />
            <Route path="/mantenimientos" element={R(<Mantenimientos />)} />
            <Route path="/inventario-fisico" element={R(<Inventory />)} />
            <Route path="/tickets" element={R(<Tickets />)} />
            <Route path="/software" element={R(<Software />)} />
            <Route path="/licencias" element={R(<Licencias />)} />
            <Route path="/ordenes-compra" element={R(<OrdenesCompra />)} />
            <Route path="/facturas" element={R(<Facturas />)} />
            <Route path="/garantias" element={R(<Garantias />)} />
            <Route path="/departamentos" element={R(<Departamentos />)} />
            <Route path="/sucursales" element={R(<Sucursales />)} />
            <Route path="/ubicaciones" element={R(<Ubicaciones />)} />
            <Route path="/fabricantes" element={R(<Fabricantes />)} />
            <Route path="/modelos" element={R(<Modelos />)} />
            <Route path="/categorias" element={R(<Categorias />)} />
            <Route path="/proveedores" element={R(<Proveedores />)} />
            <Route path="/auditoria" element={R(<Audit />)} />
            <Route path="/usuarios" element={R(<UsersRoles />)} />
            <Route path="/configuracion" element={R(<Settings />)} />
            <Route path="/cambiar-clave" element={R(<ChangePassword />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
