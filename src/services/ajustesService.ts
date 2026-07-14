import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Zona } from "@/types/insumo";

export type TipoAjuste = "descuento" | "reposicion";

export interface AjusteInput {
  insumoId: string;
  zona: Zona;
  tipo: TipoAjuste;
  cantidad: number; // magnitud positiva — el signo lo aplica esta función según `tipo`
  motivo: string;
  usuarioId: string;
}

/**
 * Registra un ajuste puntual de stock (merma, daño, reposición fuera del
 * cierre de turno). A diferencia de `confirmarCierreTurno` (writeBatch,
 * valores absolutos), esto usa `runTransaction` porque el resultado
 * depende de leer el stock actual del servidor en el momento exacto de
 * escribir — dos ajustes concurrentes sobre el mismo insumo no deben
 * pisarse entre sí.
 */
export async function registrarAjusteRapido(input: AjusteInput): Promise<void> {
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    throw new Error("La cantidad del ajuste debe ser un número mayor a 0.");
  }
  const motivo = input.motivo.trim();
  if (!motivo) {
    throw new Error("El motivo del ajuste es obligatorio.");
  }

  const insumoRef = doc(db, "insumos", input.insumoId);

  await runTransaction(db, async (transaction) => {
    // Todas las lecturas de una transacción deben ir antes que cualquier
    // escritura — por eso el get() es lo primero que hace este callback.
    const snap = await transaction.get(insumoRef);
    if (!snap.exists()) {
      throw new Error("El insumo ya no existe — puede haber sido eliminado.");
    }

    const stockAnterior = (snap.data().stockActual as number) ?? 0;
    const delta = input.tipo === "descuento" ? -input.cantidad : input.cantidad;
    // Nunca negativo: si el descuento pedido supera el stock real leído
    // en este instante (por ejemplo, otro ajuste lo vació segundos antes),
    // el stock queda en 0 en vez de pasar a negativo.
    const stockNuevo = Math.max(stockAnterior + delta, 0);

    transaction.update(insumoRef, {
      stockActual: stockNuevo,
      actualizadoEn: serverTimestamp(),
    });

    const ajusteRef = doc(collection(db, "ajustes"));
    transaction.set(ajusteRef, {
      insumoId: input.insumoId,
      insumoNombre: (snap.data().nombre as string) ?? "",
      zona: input.zona,
      tipo: input.tipo,
      cantidad: input.cantidad,
      motivo,
      stockAnterior,
      stockNuevo,
      usuarioId: input.usuarioId,
      fechaHora: serverTimestamp(),
    });
  });
}