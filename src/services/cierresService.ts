import {
  collection,
  doc,
  runTransaction,
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

/** Guarda el cierre de forma atómica y detecta cambios de stock ocurridos durante el conteo. */
export async function confirmarCierreTurno(input: CierreInput): Promise<string> {
  if (!input.items.length || input.items.length > 400 || new Set(input.items.map((i) => i.insumoId)).size !== input.items.length) throw new Error("Revisa los insumos del cierre (entre 1 y 400, sin duplicados).");
  if (input.items.some((i) => !Number.isFinite(i.stockNuevo) || i.stockNuevo < 0)) throw new Error("Revisa las cantidades del cierre.");

  const cierreRef = doc(collection(db, "cierres"));
  await runTransaction(db, async (tx) => {
    const lecturas = await Promise.all(input.items.map((i) => tx.get(doc(db, "insumos", i.insumoId))));
    lecturas.forEach((snap, n) => {
      if (!snap.exists() || snap.data().zona !== input.zona || snap.data().activo === false) throw new Error("Revisa el inventario: un insumo cambió o fue desactivado.");
      if (snap.data().stockActual !== input.items[n].stockAnterior) throw new Error(`Revisa ${snap.data().nombre}: el stock cambió mientras contabas. Vuelve a contar y edita esa cantidad antes de confirmar.`);
    });
    tx.set(cierreRef, {
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
    // Igual que en ajustesService: sin esto, where("archivado", "==",
    // false) en subscribeCierresConNotas excluiría este documento por
    // no tener el campo, no por tenerlo en true.
    archivado: false,
  });

  for (const item of input.items) {
    const insumoRef = doc(db, "insumos", item.insumoId);
    tx.update(insumoRef, {
      stockActual: item.stockNuevo,
      actualizadoEn: serverTimestamp(),
    });
  }

  });
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