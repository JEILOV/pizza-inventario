import { useEffect, useMemo, useState } from "react";
import {
  subscribeAjustesRecientes,
  subscribeCierresConNotas,
  type EventoAjuste,
  type EventoCierre,
  type EventoBuzon,
} from "@/services/notasService";
import { subscribeNombresUsuarios, type MapaNombresUsuarios } from "@/services/usuariosService";

interface UseBuzonNotasResult {
  eventos: EventoBuzon[];
  nombresUsuarios: MapaNombresUsuarios;
  cargando: boolean;
  error: string | null;
}

/**
 * Fuente única del Buzón de Notas: combina dos listeners de Firestore
 * (ajustes y cierres-con-nota) más el mapa de nombres de usuarios, y
 * expone un solo arreglo ya mezclado y ordenado por fecha descendente.
 */
export function useBuzonNotas(): UseBuzonNotasResult {
  const [ajustes, setAjustes] = useState<EventoAjuste[]>([]);
  const [cierres, setCierres] = useState<EventoCierre[]>([]);
  const [nombresUsuarios, setNombresUsuarios] = useState<MapaNombresUsuarios>({});

  const [cargandoAjustes, setCargandoAjustes] = useState(true);
  const [cargandoCierres, setCargandoCierres] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubAjustes = subscribeAjustesRecientes(
      (data) => {
        setAjustes(data);
        setCargandoAjustes(false);
      },
      () => {
        setError("No se pudieron cargar los ajustes recientes.");
        setCargandoAjustes(false);
      }
    );

    const unsubCierres = subscribeCierresConNotas(
      (data) => {
        setCierres(data);
        setCargandoCierres(false);
      },
      () => {
        setError("No se pudieron cargar los cierres recientes.");
        setCargandoCierres(false);
      }
    );

    // Best-effort: si por alguna razón esto falla (ej. reglas, o la
    // colección todavía no existe), el buzón sigue funcionando y
    // simplemente muestra el uid en vez del nombre — no es un error
    // que deba bloquear la vista.
    const unsubUsuarios = subscribeNombresUsuarios((mapa) => setNombresUsuarios(mapa));

    return () => {
      unsubAjustes();
      unsubCierres();
      unsubUsuarios();
    };
  }, []);

  const eventos = useMemo(
    () => [...ajustes, ...cierres].sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime()),
    [ajustes, cierres]
  );

  return {
    eventos,
    nombresUsuarios,
    cargando: cargandoAjustes || cargandoCierres,
    error,
  };
}