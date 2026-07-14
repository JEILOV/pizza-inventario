"use client";

import { useState } from "react";
import {
  Settings,
  ChefHat,
  Store,
  ClipboardList,
  Inbox,
  LogOut,
  Pizza,
} from "lucide-react";
import AdminInsumosCRUD from "@/components/admin/AdminInsumosCRUD";
import KitchenDashboard from "@/components/cocina/KitchenDashboard";
import SalonDashboard from "@/components/salon/SalonDashboard";
import ShiftCloseChecklist from "@/components/salon/ShiftCloseChecklist";
import type { RolUsuario, Usuario } from "@/types/usuario";

// ─────────────────────────────────────────────────────────────
// Usuarios simulados — reemplazar por Firebase Auth + colección
// `usuarios/{uid}` cuando conectemos el login real. La forma de este
// objeto es intencionalmente la misma que va a devolver el hook de
// sesión real, para que el resto del Hub no tenga que cambiar.
// ─────────────────────────────────────────────────────────────

const USUARIOS_DEMO: Usuario[] = [
  { uid: "demo-admin", nombre: "Ana (Admin)", rol: "admin" },
  { uid: "demo-cocina", nombre: "Luis (Cocina)", rol: "cocina" },
  { uid: "demo-salon", nombre: "María (Salón)", rol: "salon" },
];

// Vistas disponibles dentro del Hub. Los ids son únicos entre roles para
// que el switch de abajo no tenga ambigüedad.
type VistaId =
  | "insumos"
  | "cocina-dashboard"
  | "cocina-cierre"
  | "salon-dashboard"
  | "salon-cierre"
  | "notas";

interface TabConfig {
  id: VistaId;
  label: string;
  icono: React.ReactNode;
}

const TABS_POR_ROL: Record<RolUsuario, TabConfig[]> = {
  admin: [
    { id: "insumos", label: "Insumos", icono: <Settings className="h-4 w-4" /> },
    { id: "cocina-dashboard", label: "Cocina", icono: <ChefHat className="h-4 w-4" /> },
    { id: "salon-dashboard", label: "Salón", icono: <Store className="h-4 w-4" /> },
    { id: "notas", label: "Buzón de notas", icono: <Inbox className="h-4 w-4" /> },
  ],
  cocina: [
    { id: "cocina-dashboard", label: "Panel", icono: <ChefHat className="h-4 w-4" /> },
    { id: "cocina-cierre", label: "Cerrar turno", icono: <ClipboardList className="h-4 w-4" /> },
  ],
  salon: [
    { id: "salon-dashboard", label: "Panel", icono: <Store className="h-4 w-4" /> },
    { id: "salon-cierre", label: "Cerrar turno", icono: <ClipboardList className="h-4 w-4" /> },
  ],
};

const VISTA_INICIAL_POR_ROL: Record<RolUsuario, VistaId> = {
  admin: "insumos",
  cocina: "cocina-dashboard",
  salon: "salon-dashboard",
};

const ESTILO_ROL: Record<RolUsuario, string> = {
  admin: "bg-stone-100 text-stone-700",
  cocina: "bg-orange-50 text-orange-700",
  salon: "bg-blue-50 text-blue-700",
};

export default function Home() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [vista, setVista] = useState<VistaId>("insumos");

  const iniciarSesion = (u: Usuario) => {
    setUsuario(u);
    setVista(VISTA_INICIAL_POR_ROL[u.rol]);
  };

  const cerrarSesion = () => setUsuario(null);

  if (!usuario) {
    return <SelectorDeUsuario onSeleccionar={iniciarSesion} />;
  }

  const tabs = TABS_POR_ROL[usuario.rol];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Barra superior */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Pizza className="h-5 w-5 text-orange-700" strokeWidth={1.75} />
            <span className="font-semibold text-stone-900">Pizza Republic</span>
            <span className="hidden text-sm text-stone-400 sm:inline">· Inventario</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-700">{usuario.nombre}</span>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  ESTILO_ROL[usuario.rol],
                ].join(" ")}
              >
                {usuario.rol}
              </span>
            </div>
            <button
              onClick={cerrarSesion}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              title="Cambiar de usuario (simulado — hasta conectar Auth real)"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Cambiar usuario
            </button>
          </div>
        </div>

        {/* Navegación por rol */}
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id)}
              className={[
                "flex flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                vista === tab.id
                  ? "bg-orange-700 text-white"
                  : "text-stone-500 hover:bg-stone-100",
              ].join(" ")}
            >
              {tab.icono}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Cuerpo */}
      <main className="py-8">
        {vista === "insumos" && <AdminInsumosCRUD />}

        {vista === "cocina-dashboard" && (
          <KitchenDashboard onIrAlChecklist={() => setVista("cocina-cierre")} />
        )}
        {vista === "cocina-cierre" && (
          <ShiftCloseChecklist zona="cocina" usuarioId={usuario.uid} />
        )}

        {vista === "salon-dashboard" && (
          <SalonDashboard onIrAlChecklist={() => setVista("salon-cierre")} />
        )}
        {vista === "salon-cierre" && (
          <ShiftCloseChecklist zona="salon" usuarioId={usuario.uid} />
        )}

        {vista === "notas" && <BuzonNotasPlaceholder />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Selector de usuario — pantalla de entrada simulada
// ─────────────────────────────────────────────────────────────

function SelectorDeUsuario({ onSeleccionar }: { onSeleccionar: (u: Usuario) => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Pizza className="h-8 w-8 text-orange-700" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          Pizza Republic — Inventario
        </h1>
        <p className="max-w-xs text-sm text-stone-500">
          Selecciona tu usuario para continuar. Esta pantalla es temporal —
          será reemplazada por un login real con Firebase Auth.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {USUARIOS_DEMO.map((u) => (
          <button
            key={u.uid}
            onClick={() => onSeleccionar(u)}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40"
          >
            <div>
              <p className="font-medium text-stone-900">{u.nombre}</p>
              <p className="text-xs capitalize text-stone-400">{u.rol}</p>
            </div>
            <span
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                ESTILO_ROL[u.rol],
              ].join(" ")}
            >
              {u.rol}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Placeholder del buzón de notas — la funcionalidad real viene después
// ─────────────────────────────────────────────────────────────

function BuzonNotasPlaceholder() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-16 text-center">
      <Inbox className="h-8 w-8 text-stone-300" strokeWidth={1.5} />
      <p className="text-sm text-stone-500">
        El buzón de notas todavía no está construido — lo dejamos pendiente
        junto con el Ajuste Rápido.
      </p>
    </div>
  );
}