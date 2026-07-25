"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subscribeInsumos } from "@/services/insumosService";
import { useAuth } from "@/contexts/AuthContext";
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
  // Coordinado con AuthContext a propósito: firestore.rules exige
  // `estaAutenticado()` para leer insumos, pero restaurar la sesión de
  // Firebase (leer el token guardado) es async y toma una fracción de
  // segundo. Si abrimos el listener ANTES de que Auth termine de
  // resolver, Firestore ve `request.auth == null` en ese instante y
  // responde "Missing or insufficient permissions" — aunque medio
  // segundo después la sesión sí se restaure. Por eso esperamos a que
  // `cargandoAuth` sea false, y re-suscribimos cada vez que cambia
  // `usuario` (login/logout).
  const { usuario, cargando: cargandoAuth } = useAuth();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cargandoAuth) {
      // Sesión todavía resolviéndose — no intentamos leer Firestore
      // todavía para no disparar un permission-denied de arranque.
      setCargando(true);
      return;
    }

    if (!usuario) {
      // Sin sesión válida (deslogueado, o cuenta sin rol asignado):
      // no hay nada que suscribir, y Firestore lo rechazaría igual.
      setInsumos([]);
      setCargando(false);
      setError(null);
      return;
    }

    setError(null);
    setCargando(true);

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
  }, [usuario, cargandoAuth]);

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