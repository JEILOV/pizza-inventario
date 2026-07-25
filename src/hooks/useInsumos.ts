import { useCallback } from "react";
import {
  crearInsumo,
  actualizarInsumo,
  toggleActivoInsumo,
} from "@/services/insumosService";
import { useInsumosContext } from "@/contexts/InsumosContext";
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
  // Sin useState/useEffect propios: los datos vienen del único listener
  // vivo en InsumosProvider (montado en el layout raíz). Múltiples
  // componentes pueden llamar useInsumos() a la vez sin abrir listeners
  // adicionales — solo se suscriben al re-render de React cuando el
  // contexto cambia, que es gratis en términos de lecturas de Firestore.
  const { insumos, cargando, error } = useInsumosContext();

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