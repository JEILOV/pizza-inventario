import type { Insumo } from "@/types/insumo";
import { esFinDeSemana, getStockMinimoVigente } from "./reglasInventario";

export const CATEGORIAS = ["Masas", "Salsas", "Quesos", "Proteínas", "Vegetales", "Otros ingredientes", "Bebidas", "Delivery", "Servicio de mesa", "Limpieza", "Otros"];
export const categoriaDe = (i: Insumo) => i.categoria?.trim() || "Sin categoría";
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function fechaLocal(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}
export function turnoActual(fecha = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", hourCycle: "h23" }).format(fecha));
  return h < 12 ? "mañana" : h < 18 ? "tarde" : "noche";
}
export function objetivoStock(i: Insumo, fecha = new Date()) {
  const meta = esFinDeSemana(fecha) ? i.stockObjetivoFinDeSemana ?? i.stockObjetivo : i.stockObjetivo;
  return Math.max(getStockMinimoVigente(i, fecha), meta ?? getStockMinimoVigente(i, fecha));
}
export function cantidadPendiente(i: Insumo, fecha = new Date()) {
  return Math.max(0, Math.round((objetivoStock(i, fecha) - i.stockActual) * 1000) / 1000);
}
export function ordenarInsumos(insumos: Insumo[]) {
  return [...insumos].sort((a, b) => categoriaDe(a).localeCompare(categoriaDe(b), "es") || (a.ubicacion ?? "").localeCompare(b.ubicacion ?? "", "es") || a.nombre.localeCompare(b.nombre, "es"));
}
export function textoLista(insumos: Insumo[], tipo: "externo" | "interno", fecha = new Date()) {
  return [`Pizza Republic · ${tipo === "externo" ? "Lista de compras" : "Preparaciones pendientes"} · ${fechaLocal(fecha)}`,
    ...insumos.map((i) => `• ${i.nombre} (${i.zona === "salon" ? "Salón" : "Cocina"} / ${categoriaDe(i)}): quedan ${i.stockActual} ${i.unidad}; ${cantidadPendiente(i, fecha) > 0 ? `faltan ${cantidadPendiente(i, fecha)} ${i.unidad} para la meta` : "revisar reposición anticipada"}.`),
  ].join("\n");
}
