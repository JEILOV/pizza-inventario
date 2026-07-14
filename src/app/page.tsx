"use client";

import { useState } from "react";
import AdminInsumosCRUD from "@/components/admin/AdminInsumosCRUD";
import KitchenDashboard from "@/components/cocina/KitchenDashboard";
import ShiftCloseChecklist from "@/components/salon/ShiftCloseChecklist";
import { Store, ChefHat, Settings } from "lucide-react";

export default function Home() {
  const [vistaActual, setVistaActual] = useState<"admin" | "cocina" | "salon">("admin");

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Menú de Navegación Temporal para Desarrollo */}
      <nav className="bg-stone-900 p-4 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="font-bold text-orange-500">Pizza Republic - Inventario (Dev)</div>
          <div className="flex gap-4">
            <button
              onClick={() => setVistaActual("admin")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                vistaActual === "admin" ? "bg-orange-600" : "hover:bg-stone-800"
              }`}
            >
              <Settings className="h-4 w-4" />
              Admin
            </button>
            <button
              onClick={() => setVistaActual("cocina")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                vistaActual === "cocina" ? "bg-orange-600" : "hover:bg-stone-800"
              }`}
            >
              <ChefHat className="h-4 w-4" />
              Cocina
            </button>
            <button
              onClick={() => setVistaActual("salon")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                vistaActual === "salon" ? "bg-orange-600" : "hover:bg-stone-800"
              }`}
            >
              <Store className="h-4 w-4" />
              Salón (Checklist)
            </button>
          </div>
        </div>
      </nav>

      {/* Renderizado Dinámico de Vistas */}
      <main className="py-8">
        {vistaActual === "admin" && <AdminInsumosCRUD />}
        {vistaActual === "cocina" && <KitchenDashboard />}
        {vistaActual === "salon" && <ShiftCloseChecklist zona="salon" usuarioId="test-user-123" />}
      </main>
    </div>
  );
}