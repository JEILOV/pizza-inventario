import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Zona } from "@/types/insumo";

export interface CierreItemInput {
  insumoId: string;
  stockAnterior: number;
  stockNuevo: number;
  diferencia: number;
  nota?: string;
}

export interface CierreInput {
  zona: Zona;
  turno: string;
  usuarioId: string;
  notaGeneral?: string;
  items: CierreItemInput[];
}

/**
 * Confirma un cierre de turno completo: crea el documento de historial
 * en `cierres` y actualiza `stockActual` de cada insumo contado, todo
 * en un único batch — o se escribe todo, o no se escribe nada.
 *
 * Nota de diseño: usamos writeBatch (no runTransaction) porque los
 * valores que se escriben son conteos absolutos ingresados por la
 * persona que cierra, no dependen de leer el valor actual en el
 * servidor antes de escribir. Si más adelante el "Ajuste Rápido"
 * concurrente se vuelve un problema real (alguien ajusta un insumo
 * justo mientras otro está cerrando turno), se puede migrar esta
 * función a runTransaction para leer y comparar stockActual antes
 * de sobrescribir.
 */
export async function confirmarCierreTurno(input: CierreInput): Promise<string> {
  const batch = writeBatch(db);

  const cierreRef = doc(collection(db, "cierres"));
  batch.set(cierreRef, {
    zona: input.zona,
    turno: input.turno,
    usuarioId: input.usuarioId,
    notaGeneral: input.notaGeneral?.trim() || null,
    fechaHora: serverTimestamp(),
    items: input.items.map((item) => ({
      insumoId: item.insumoId,
      stockAnterior: item.stockAnterior,
      stockNuevo: item.stockNuevo,
      diferencia: item.diferencia,
      nota: item.nota?.trim() || null,
    })),
  });

  for (const item of input.items) {
    const insumoRef = doc(db, "insumos", item.insumoId);
    batch.update(insumoRef, {
      stockActual: item.stockNuevo,
      actualizadoEn: serverTimestamp(),
    });
  }

  await batch.commit();
  return cierreRef.id;
}