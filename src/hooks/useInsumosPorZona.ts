import { useMemo } from "react";
import { useInsumosContext } from "../contexts/InsumosContext";
import type { Insumo, Zona } from "../types/insumo";

interface UseInsumosPorZonaResult {
  insumos: Insumo[];
  cargando: boolean;
  error: string | null;
}

/**
 * Antes abría su propio `onSnapshot` sobre TODA la colección `insumos`
 * cada vez que `ZoneDashboard` o `ShiftCloseChecklist` se montaban (ej.
 * cada cambio de pestaña Cocina <-> Cerrar turno). Ahora reutiliza el
 * único listener de `InsumosProvider` y solo filtra en memoria - cero
 * lecturas adicionales sin importar cuántas veces se monte o cuántos
 * componentes lo usen a la vez.
 */
export function useInsumosPorZona(zona: Zona): UseInsumosPorZonaResult {
  const { insumos, cargando, error } = useInsumosContext();

  const insumosDeZona = useMemo(
    () => insumos.filter((i) => i.activo && i.zona === zona),
    [insumos, zona]
  );

  return { insumos: insumosDeZona, cargando, error };
}
