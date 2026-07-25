"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subscribeInsumos } from "@/services/insumosService";
import type { Insumo } from "@/types/insumo";

interface InsumosContextValue {
  insumos: Insumo[];
  cargando: boolean;
  error: string | null;
}

const InsumosContext = createContext<InsumosContextValue | null>(null);

/**
 * Única suscripción `onSnapshot` a la colección `insumos` en toda la app.
 * Vive en el layout raíz (junto a AuthProvider) y NUNCA se desmonta por
 * cambios de pestaña dentro del Hub — eso es justamente lo que evita que
 * cada clic entre vistas dispare una lectura completa de la colección.
 * `useInsumos` y `useInsumosPorZona` leen de aquí en vez de abrir su
 * propio listener.
 */
export function InsumosProvider({ children }: { children: ReactNode }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeInsumos(
      (data) => {
        setInsumos(data);
        setCargando(false);
      },
      () => {
        setError("No se pudo cargar la lista de insumos. Intenta de nuevo.");
        setCargando(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <InsumosContext.Provider value={{ insumos, cargando, error }}>
      {children}
    </InsumosContext.Provider>
  );
}

export function useInsumosContext(): InsumosContextValue {
  const ctx = useContext(InsumosContext);
  if (!ctx) {
    throw new Error("useInsumosContext debe usarse dentro de un <InsumosProvider>.");
  }
  return ctx;
}
