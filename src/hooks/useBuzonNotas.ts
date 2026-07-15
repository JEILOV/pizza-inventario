import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subscribeAjustesRecientes,
  subscribeCierresConNotas,
  limpiarBuzon as limpiarBuzonEnFirestore,
  type EventoAjuste,
  type EventoCierre,
  type EventoBuzon,
  type ReferenciaEventoBuzon,
} from "@/services/notasService";
import { subscribeNombresUsuarios, type MapaNombresUsuarios } from "@/services/usuariosService";

interface UseBuzonNotasResult {
  eventos: EventoBuzon[];
  nombresUsuarios: MapaNombresUsuarios;
  cargando: boolean;
  error: string | null;
  /** true mientras un archivado disparado por `limpiarBuzon` está en vuelo. */
  limpiando: boolean;
  /** Archiva los eventos indicados (`archivado: true`, sin borrar nada
   *  de Firestore — ver `limpiarBuzon` en `notasService` para el
   *  detalle). Tras el `commit` del batch, los listeners de arriba
   *  reciben el cambio solos y los filtran del Buzón — no hace falta
   *  quitar nada del estado local a mano. */
  limpiarBuzon: (eventos: ReferenciaEventoBuzon[]) => Promise<void>;
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
  const [limpiando, setLimpiando] = useState(false);

  useEffect(() => {
    const unsubAjustes = subscribeAjustesRecientes(
      (data) => {
        // Filtro en memoria, no en la query de Firestore: agregar
        // `where("archivado", "==", false)` junto al `orderBy("fechaHora")`
        // ya existente pediría un índice compuesto — evitable en plan
        // Spark filtrando acá, sobre un máximo de `LIMITE_RECIENTES` (100)
        // documentos que de todos modos ya se leyeron.
        setAjustes(data.filter((evento) => !evento.archivado));
        setCargandoAjustes(false);
      },
      () => {
        setError("No se pudieron cargar los ajustes recientes.");
        setCargandoAjustes(false);
      }
    );

    const unsubCierres = subscribeCierresConNotas(
      (data) => {
        setCierres(data.filter((evento) => !evento.archivado));
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

  const limpiarBuzon = useCallback(async (aArchivar: ReferenciaEventoBuzon[]) => {
    setLimpiando(true);
    setError(null);
    try {
      await limpiarBuzonEnFirestore(aArchivar);
    } catch (e) {
      console.error("Error al limpiar el buzón:", e);
      setError("No se pudo limpiar el buzón. Intenta de nuevo.");
    } finally {
      setLimpiando(false);
    }
  }, []);

  return {
    eventos,
    nombresUsuarios,
    cargando: cargandoAjustes || cargandoCierres,
    error,
    limpiando,
    limpiarBuzon,
  };
}