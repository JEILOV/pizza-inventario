import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
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

export interface UltimoCierre {
  fechaHora: Date;
  usuarioId: string;
  turno: string;
}

/**
 * Trae el cierre más reciente de una zona — solo lectura, para mostrar
 * "hace cuánto se contó por última vez" en el dashboard de esa zona.
 *
 * Una sola igualdad (`zona`) + un solo orderBy (`fechaHora`) no necesita
 * índice compuesto, igual que en `subscribeInsumos`.
 *
 * Es un fetch puntual (getDocs), no un listener en tiempo real: si otra
 * persona cierra turno en otra pestaña mientras el dashboard sigue
 * abierto, este dato no se actualiza solo hasta que el componente se
 * vuelva a montar (o se llame de nuevo). Si eso se vuelve un problema
 * real, se puede migrar a onSnapshot — por ahora es una lectura mucho
 * más barata y simple para el caso de uso.
 */
export async function obtenerUltimoCierre(zona: Zona): Promise<UltimoCierre | null> {
  const q = query(
    collection(db, "cierres"),
    where("zona", "==", zona),
    orderBy("fechaHora", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const data = snapshot.docs[0].data();

  // fechaHora se escribe con serverTimestamp(); si por alguna razón
  // todavía no se resolvió del lado del servidor (lectura casi
  // inmediata a la escritura, desde el mismo cliente), toMillis()
  // no existiría — en ese caso raro, tratamos el cierre como "ahora".
  const fechaHora =
    data.fechaHora && typeof data.fechaHora.toDate === "function"
      ? data.fechaHora.toDate()
      : new Date();

  return {
    fechaHora,
    usuarioId: data.usuarioId as string,
    turno: data.turno as string,
  };
}