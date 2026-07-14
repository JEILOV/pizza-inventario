"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Settings,
  ChefHat,
  Store,
  ClipboardList,
  Inbox,
  LogOut,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShieldQuestion,
} from "lucide-react";
import AdminInsumosCRUD from "@/components/admin/AdminInsumosCRUD";
import BuzonNotas from "@/components/admin/BuzonNotas";
import KitchenDashboard from "@/components/cocina/KitchenDashboard";
import SalonDashboard from "@/components/salon/SalonDashboard";
import ShiftCloseChecklist from "@/components/salon/ShiftCloseChecklist";
import { useAuth } from "@/contexts/AuthContext";
import type { RolUsuario } from "@/types/usuario";

// ─────────────────────────────────────────────────────────────
// Vistas disponibles dentro del Hub. Los ids son únicos entre roles
// para que el switch de abajo no tenga ambigüedad.
// ─────────────────────────────────────────────────────────────

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
  const { usuario, cargando, cuentaPendiente, error } = useAuth();

  // Pantalla de carga inicial — mientras se resuelve si hay sesión de
  // Firebase Auth activa y, si la hay, mientras se leen sus claims.
  if (cargando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-stone-50 px-4 text-sm text-stone-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Verificando sesión...
      </div>
    );
  }

  if (cuentaPendiente) {
    return <CuentaPendiente />;
  }

  if (!usuario) {
    return <PantallaLogin />;
  }

  return <Hub usuario={usuario} />;
}

// ─────────────────────────────────────────────────────────────
// Hub principal — solo se renderiza con un usuario ya autenticado
// y con un rol válido.
// ─────────────────────────────────────────────────────────────

function Hub({ usuario }: { usuario: NonNullable<ReturnType<typeof useAuth>["usuario"]> }) {
  const { cerrarSesion } = useAuth();
  const [vista, setVista] = useState<VistaId>(VISTA_INICIAL_POR_ROL[usuario.rol]);

  // Si el rol cambiara en caliente (ej. un admin te reasigna de zona y
  // usas "recargar permisos" sin recargar la página), la vista activa
  // vuelve a la vista inicial de tu nuevo rol en vez de quedar en una
  // pestaña que ya no existe para ti.
  useEffect(() => {
    setVista(VISTA_INICIAL_POR_ROL[usuario.rol]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.rol]);

  const tabs = TABS_POR_ROL[usuario.rol];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Barra superior */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-pizza-republic.png"
              alt="Pizza Republic"
              width={1220}
              height={507}
              className="h-6 w-auto"
              priority
            />
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
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Cerrar sesión
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
                  ? "bg-brand text-white"
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
          <KitchenDashboard
            usuarioId={usuario.uid}
            onIrAlChecklist={() => setVista("cocina-cierre")}
          />
        )}
        {vista === "cocina-cierre" && (
          <ShiftCloseChecklist zona="cocina" usuarioId={usuario.uid} />
        )}

        {vista === "salon-dashboard" && (
          <SalonDashboard
            usuarioId={usuario.uid}
            onIrAlChecklist={() => setVista("salon-cierre")}
          />
        )}
        {vista === "salon-cierre" && (
          <ShiftCloseChecklist zona="salon" usuarioId={usuario.uid} />
        )}

        {vista === "notas" && <BuzonNotas />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pantalla de login — botón de Google, un clic.
// ─────────────────────────────────────────────────────────────

function PantallaLogin() {
  const { iniciarSesionConGoogle, error } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      {/* Cuerpo centrado */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {/* Acento de marca — el logo trae su propio color corporativo
              (isotipo + wordmark en #006654 sobre fondo blanco opaco),
              así que no va sobre una franja verde: eso lo dejaría
              invisible. Solo una línea fina como guiño de marca. */}
          <div className="h-1.5 bg-brand" />

          <div className="flex flex-col items-center gap-1 px-6 pb-2 pt-7">
            <Image
              src="/logo-pizza-republic.png"
              alt="Pizza Republic"
              width={1220}
              height={507}
              className="h-auto w-52"
              priority
            />
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Inventario
            </p>
          </div>

          {/* Formulario */}
          <div className="flex flex-col gap-5 px-6 pb-7 pt-5">
            <p className="text-center text-sm text-stone-500">
              Inicia sesión con tu cuenta de Google para continuar.
            </p>

            <button
              onClick={iniciarSesionConGoogle}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover"
            >
              <GoogleIcon className="h-4 w-4" />
              Continuar con Google
            </button>

            {error && (
              <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer sutil, fuera de la tarjeta */}
      <footer className="pb-6 text-center text-xs text-stone-400">
        Desarrollado por Jordan
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cuenta autenticada en Google pero sin rol asignado todavía en
// Firestore/Custom Claims — pantalla de espera, no de error.
// ─────────────────────────────────────────────────────────────

function CuentaPendiente() {
  const { cerrarSesion, recargarPermisos, error } = useAuth();
  const [verificando, setVerificando] = useState(false);

  const handleVerificar = async () => {
    setVerificando(true);
    try {
      await recargarPermisos();
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 text-center">
      <ShieldQuestion className="h-10 w-10 text-amber-500" strokeWidth={1.5} />
      <h1 className="mt-3 text-lg font-semibold text-stone-900">
        Tu cuenta está pendiente de activación
      </h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        Iniciaste sesión correctamente, pero todavía no tienes un rol
        asignado en el sistema. Pídele a un administrador que te agregue,
        y luego presiona &quot;Ya me activaron&quot;.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={cerrarSesion}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Cerrar sesión
        </button>
        <button
          onClick={handleVerificar}
          disabled={verificando}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verificando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
          )}
          Ya me activaron
        </button>
      </div>

      {error && (
        <p className="mt-4 flex max-w-sm items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ícono de Google en SVG puro — evita jalar un paquete de íconos extra
// solo para este logo de cuatro colores.
// ─────────────────────────────────────────────────────────────
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.6 5.6C39.5 37.4 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}