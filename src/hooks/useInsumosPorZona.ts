import { useEffect, useState } from "react";
import { subscribeInsumos } from "../services/insumosService";
import type { Insumo, Zona } from "../types/insumo";

interface UseInsumosPorZonaResult {
  insumos: Insumo[];
  cargando: boolean;
  error: string | null;
}

export function useInsumosPorZona(zona: Zona): UseInsumosPorZonaResult {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    // Solo le pasamos los 2 argumentos originales
    const unsubscribe = subscribeInsumos(
      (data) => {
        // Filtramos por activo y por la zona que nos piden
        setInsumos(data.filter((i) => i.activo && i.zona === zona));
        setCargando(false);
      },
      () => {
        setError("No se pudo cargar el inventario. Revisa tu conexión.");
        setCargando(false);
      }
    );

    return () => unsubscribe();
  }, [zona]);

  return { insumos, cargando, error };
}