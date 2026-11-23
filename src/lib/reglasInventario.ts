import type { Insumo } from "@/types/insumo";

export type EstadoInsumo = "rojo" | "amarillo" | "verde";

// Subconjunto de campos que esta lógica realmente necesita — así se puede
// usar tanto con un Insumo completo de Firestore como con datos parciales
// (útil para tests o para el formulario de Admin antes de guardar).
type ReglasStock = Pick<Insumo, "stockActual" | "stockMinimo" | "stockMinimoFinDeSemana"> & Partial<Pick<Insumo, "leadTimeDias" | "diasAnticipacionAlerta" | "consumoDiarioEstimado">>;

// Factor de colchón para el estado amarillo mientras no tengamos consumo
// histórico real (colección `movimientos`) para calcularlo. Cuando exista
// ese dato, reemplazar por: stockMinimoVigente + consumoDiarioPromedio *
// (leadTimeDias + diasAnticipacionAlerta).
const FACTOR_COLCHON_AMARILLO = 1.4;
const formatoDia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", weekday: "short" });

/**
 * Viernes, sábado o domingo — los días de mínimo elevado por mayor demanda.
 */
export function esFinDeSemana(fecha: Date = new Date()): boolean {
  const dia = formatoDia.format(fecha);
  return ["Fri", "Sat", "Sun"].includes(dia);
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
  const dias = Math.min(365, Math.max(0, (insumo.leadTimeDias ?? 0) + (insumo.diasAnticipacionAlerta ?? 0)));
  let minimoProximo = minimoVigente;
  // Los mínimos se repiten semanalmente; no recorrer meses por cada tarjeta.
  for (let d = 1; d <= Math.min(7, Math.ceil(dias)); d++) {
    minimoProximo = Math.max(minimoProximo, getStockMinimoVigente(insumo, new Date(fecha.getTime() + d * 86400000)));
  }
  const umbral = Math.max(minimoVigente * FACTOR_COLCHON_AMARILLO, minimoProximo + (insumo.consumoDiarioEstimado ?? 0) * dias);
  if (insumo.stockActual <= umbral) return "amarillo";
  return "verde";
}

/**
 * Cuánto falta para alcanzar el mínimo vigente (nunca negativo).
 */
export function calcularFaltante(insumo: ReglasStock, fecha: Date = new Date()): number {
  const minimoVigente = getStockMinimoVigente(insumo, fecha);
  return Math.max(minimoVigente - insumo.stockActual, 0);
}
