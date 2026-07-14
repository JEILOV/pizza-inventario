import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Zona } from "@/types/insumo";
import type { TipoAjuste } from "@/services/ajustesService";

// Cuántos documentos recientes de cada colección se traen. El Buzón es
// una vista de "lo último que pasó", no un historial completo — 100 da
// bastante margen sin paginar todavía.
const LIMITE_RECIENTES = 100;

// ─────────────────────────────────────────────────────────────
// Tipos del timeline unificado
// ─────────────────────────────────────────────────────────────

export interface EventoAjuste {
  origen: "ajuste";
  id: string;
  fechaHora: Date;
  zona: Zona;
  usuarioId: string;
  insumoNombre: string;
  cantidad: number;
  tipoAjuste: TipoAjuste;
  motivo: string;
}

export interface NotaCierreItem {
  insumoId: string;
  nota: string;
}

export interface EventoCierre {
  origen: "cierre";
  id: string;
  fechaHora: Date;
  zona: Zona;
  usuarioId: string;
  turno: string;
  notaGeneral: string | null;
  notasDeItems: NotaCierreItem[];
}

export type EventoBuzon = EventoAjuste | EventoCierre;

// serverTimestamp() puede llegar como null en la primera lectura local
// justo después de escribir (antes de que el servidor confirme) — en
// ese caso rarísimo, tratamos el evento como "ahora mismo" en vez de
// reventar con una fecha inválida.
function timestampADate(valor: unknown): Date {
  if (
    valor &&
    typeof valor === "object" &&
    "toDate" in valor &&
    typeof (valor as { toDate: unknown }).toDate === "function"
  ) {
    return (valor as { toDate: () => Date }).toDate();
  }
  return new Date();
}

// ─────────────────────────────────────────────────────────────
// Ajustes recientes — todos entran, todos tienen `motivo`.
// ─────────────────────────────────────────────────────────────

export function subscribeAjustesRecientes(
  onData: (eventos: EventoAjuste[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, "ajustes"),
    orderBy("fechaHora", "desc"),
    limit(LIMITE_RECIENTES)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const eventos: EventoAjuste[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          origen: "ajuste",
          id: d.id,
          fechaHora: timestampADate(data.fechaHora),
          zona: data.zona as Zona,
          usuarioId: data.usuarioId as string,
          insumoNombre: (data.insumoNombre as string) ?? "Insumo",
          cantidad: data.cantidad as number,
          tipoAjuste: data.tipo as TipoAjuste,
          motivo: (data.motivo as string) ?? "",
        };
      });
      onData(eventos);
    },
    (error) => {
      console.error("Error al escuchar ajustes recientes:", error);
      onError?.(error);
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Cierres recientes — solo entran los que traen alguna observación
// (notaGeneral, o al menos un item con nota). Firestore no puede
// filtrar del lado del servidor "algún elemento de un array cumple
// una condición" sin duplicar datos en un campo aparte, así que este
// descarte se hace en el cliente después de leer los recientes.
// ─────────────────────────────────────────────────────────────

export function subscribeCierresConNotas(
  onData: (eventos: EventoCierre[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, "cierres"),
    orderBy("fechaHora", "desc"),
    limit(LIMITE_RECIENTES)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const eventos: EventoCierre[] = [];

      for (const d of snapshot.docs) {
        const data = d.data();
        const notaGeneral = ((data.notaGeneral as string | null) ?? null) || null;
        const itemsCrudos = (data.items as Array<Record<string, unknown>>) ?? [];

        const notasDeItems: NotaCierreItem[] = itemsCrudos
          .filter(
            (item) => typeof item.nota === "string" && (item.nota as string).trim() !== ""
          )
          .map((item) => ({
            insumoId: item.insumoId as string,
            nota: item.nota as string,
          }));

        if (!notaGeneral && notasDeItems.length === 0) continue;

        eventos.push({
          origen: "cierre",
          id: d.id,
          fechaHora: timestampADate(data.fechaHora),
          zona: data.zona as Zona,
          usuarioId: data.usuarioId as string,
          turno: (data.turno as string) ?? "",
          notaGeneral,
          notasDeItems,
        });
      }

      onData(eventos);
    },
    (error) => {
      console.error("Error al escuchar cierres recientes:", error);
      onError?.(error);
    }
  );
}