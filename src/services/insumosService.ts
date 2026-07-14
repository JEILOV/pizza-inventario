import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Insumo, InsumoInput } from "@/types/insumo";

const COLECCION = "insumos";

// Documento tal como vive en Firestore — el timestamp llega como objeto
// Timestamp, no como number, así que lo mapeamos al leer.
function mapearDocumento(id: string, data: Record<string, unknown>): Insumo {
  return {
    id,
    nombre: data.nombre as string,
    zona: data.zona as Insumo["zona"],
    tipo: data.tipo as Insumo["tipo"],
    unidad: data.unidad as string,
    stockActual: data.stockActual as number,
    stockMinimo: data.stockMinimo as number,
    stockMinimoFinDeSemana: (data.stockMinimoFinDeSemana as number | null) ?? null,
    leadTimeDias: (data.leadTimeDias as number) ?? 0,
    diasAnticipacionAlerta: (data.diasAnticipacionAlerta as number) ?? 0,
    rendimientoPorLote: (data.rendimientoPorLote as number | null) ?? null,
    loteUnidad: (data.loteUnidad as string) ?? "",
    activo: (data.activo as boolean) ?? true,
    actualizadoEn:
      data.actualizadoEn && typeof (data.actualizadoEn as any).toMillis === "function"
        ? (data.actualizadoEn as any).toMillis()
        : undefined,
  };
}

/**
 * Suscribe a la lista completa de insumos en tiempo real.
 * Devuelve la función `unsubscribe` — el llamador debe invocarla al
 * desmontar (ej. dentro del cleanup de un useEffect).
 */
export function subscribeInsumos(
  onData: (insumos: Insumo[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, COLECCION), orderBy("nombre"));

  return onSnapshot(
    q,
    (snapshot) => {
      const insumos = snapshot.docs.map((d) => mapearDocumento(d.id, d.data()));
      onData(insumos);
    },
    (error) => {
      console.error("Error al escuchar insumos:", error);
      onError?.(error);
    }
  );
}

/**
 * Crea un insumo nuevo. Firestore genera el ID automáticamente (addDoc),
 * evitando colisiones de nombres parecidos que tendría un slug manual.
 */
export async function crearInsumo(input: InsumoInput): Promise<string> {
  const ref = await addDoc(collection(db, COLECCION), {
    ...input,
    activo: true,
    actualizadoEn: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Actualiza campos parciales de un insumo existente (edición del
 * formulario, o cualquier cambio puntual).
 */
export async function actualizarInsumo(
  id: string,
  cambios: Partial<InsumoInput>
): Promise<void> {
  await updateDoc(doc(db, COLECCION, id), {
    ...cambios,
    actualizadoEn: serverTimestamp(),
  });
}

/**
 * Atajo específico para el toggle activo/inactivo de la tabla —
 * misma operación que actualizarInsumo, pero más explícito en el
 * call site del componente.
 */
export async function toggleActivoInsumo(id: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, COLECCION, id), {
    activo,
    actualizadoEn: serverTimestamp(),
  });
}