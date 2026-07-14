import { useEffect, useState, useCallback } from "react";
import {
  subscribeInsumos,
  crearInsumo,
  actualizarInsumo,
  toggleActivoInsumo,
} from "@/services/insumosService";
import type { Insumo, InsumoInput } from "@/types/insumo";

interface UseInsumosResult {
  insumos: Insumo[];
  cargando: boolean;
  error: string | null;
  crear: (input: InsumoInput) => Promise<void>;
  actualizar: (id: string, cambios: Partial<InsumoInput>) => Promise<void>;
  toggleActivo: (id: string, activo: boolean) => Promise<void>;
}

/**
 * Fuente única de verdad para la lista de insumos en toda la app.
 * El listener de Firestore (onSnapshot) mantiene `insumos` sincronizado
 * automáticamente — crear/actualizar no necesitan tocar el estado local,
 * el snapshot que llega después de escribir ya trae el cambio.
 */
export function useInsumos(): UseInsumosResult {
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

  const crear = useCallback(async (input: InsumoInput) => {
    try {
      await crearInsumo(input);
    } catch (e) {
      console.error(e);
      throw new Error("No se pudo crear el insumo.");
    }
  }, []);

  const actualizar = useCallback(async (id: string, cambios: Partial<InsumoInput>) => {
    try {
      await actualizarInsumo(id, cambios);
    } catch (e) {
      console.error(e);
      throw new Error("No se pudo guardar el cambio.");
    }
  }, []);

  const toggleActivo = useCallback(async (id: string, activo: boolean) => {
    try {
      await toggleActivoInsumo(id, activo);
    } catch (e) {
      console.error(e);
      throw new Error("No se pudo cambiar el estado del insumo.");
    }
  }, []);

  return { insumos, cargando, error, crear, actualizar, toggleActivo };
}