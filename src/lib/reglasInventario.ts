import type { Insumo } from "@/types/insumo";

export type EstadoInsumo = "rojo" | "amarillo" | "verde";

// Subconjunto de campos que esta lógica realmente necesita — así se puede
// usar tanto con un Insumo completo de Firestore como con datos parciales
// (útil para tests o para el formulario de Admin antes de guardar).
type ReglasStock = Pick<Insumo, "stockActual" | "stockMinimo" | "stockMinimoFinDeSemana">;

// Factor de colchón para el estado amarillo mientras no tengamos consumo
// histórico real (colección `movimientos`) para calcularlo. Cuando exista
// ese dato, reemplazar por: stockMinimoVigente + consumoDiarioPromedio *
// (leadTimeDias + diasAnticipacionAlerta).
const FACTOR_COLCHON_AMARILLO = 1.4;

/**
 * Viernes, sábado o domingo — los días de mínimo elevado por mayor demanda.
 */
export function esFinDeSemana(fecha: Date = new Date()): boolean {
  const dia = fecha.getDay(); // 0 = domingo, 5 = viernes, 6 = sábado
  return dia === 0 || dia === 5 || dia === 6;
}

/**
 * Mínimo aplicable según el día. Si no hay mínimo de fin de semana
 * configurado (null), cae al mínimo normal — misma regla `??` que ya
 * usa el formulario de Admin.
 */
export function getStockMinimoVigente(insumo: ReglasStock, fecha: Date = new Date()): number {
  if (!esFinDeSemana(fecha)) return insumo.stockMinimo;
  return insumo.stockMinimoFinDeSemana ?? insumo.stockMinimo;
}

/**
 * Semáforo del insumo para el día dado.
 */
export function calcularEstado(insumo: ReglasStock, fecha: Date = new Date()): EstadoInsumo {
  const minimoVigente = getStockMinimoVigente(insumo, fecha);
  if (insumo.stockActual <= minimoVigente) return "rojo";
  if (insumo.stockActual <= minimoVigente * FACTOR_COLCHON_AMARILLO) return "amarillo";
  return "verde";
}

/**
 * Cuánto falta para alcanzar el mínimo vigente (nunca negativo).
 */
export function calcularFaltante(insumo: ReglasStock, fecha: Date = new Date()): number {
  const minimoVigente = getStockMinimoVigente(insumo, fecha);
  return Math.max(minimoVigente - insumo.stockActual, 0);
}