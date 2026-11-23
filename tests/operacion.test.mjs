import test from "node:test";
import assert from "node:assert/strict";
import { calcularEstado, esFinDeSemana } from "../src/lib/reglasInventario.ts";
import { objetivoStock, cantidadPendiente, textoLista, normalizar, fechaLocal, turnoActual } from "../src/lib/operacion.ts";
const jueves = new Date("2026-11-26T17:00:00Z");
const viernes = new Date("2026-11-27T17:00:00Z");
const base = { id: "masa", nombre: "Masa", zona: "cocina", tipo: "interno", unidad: "bolas", activo: true, stockActual: 12, stockMinimo: 10, stockMinimoFinDeSemana: 20, leadTimeDias: 0, diasAnticipacionAlerta: 0 };
test("el fin de semana respeta Lima aunque UTC ya sea viernes", () => {
  assert.equal(esFinDeSemana(new Date("2026-11-27T02:00:00Z")), false);
  assert.equal(esFinDeSemana(viernes), true);
  assert.equal(fechaLocal(new Date("2026-11-27T02:00:00Z")), "2026-11-26");
  assert.equal(turnoActual(new Date("2026-11-27T02:00:00Z")), "noche");
});
test("alertas: crítico en el mínimo, preventivo con colchón, suficiente por encima", () => {
  assert.equal(calcularEstado({ ...base, stockActual: 10 }, jueves), "rojo");
  assert.equal(calcularEstado(base, jueves), "amarillo");
  assert.equal(calcularEstado({ ...base, stockActual: 15 }, jueves), "verde");
});
test("avisa antes del fin de semana según días de entrega", () => {
  assert.equal(calcularEstado({ ...base, stockActual: 18, leadTimeDias: 1 }, jueves), "amarillo");
});
test("consumo estimado anticipa faltantes antes de agotarse", () => {
  assert.equal(calcularEstado({ ...base, stockActual: 35, leadTimeDias: 2, diasAnticipacionAlerta: 1, consumoDiarioEstimado: 6 }, jueves), "amarillo");
});
test("metas normales y de fin de semana no bajan del mínimo", () => {
  assert.equal(objetivoStock(base, jueves), 10);
  assert.equal(objetivoStock({ ...base, stockObjetivo: 30 }, jueves), 30);
  assert.equal(objetivoStock({ ...base, stockObjetivo: 30, stockObjetivoFinDeSemana: 50 }, viernes), 50);
  assert.equal(objetivoStock({ ...base, stockObjetivo: 5 }, viernes), 20);
  assert.equal(cantidadPendiente({ ...base, stockActual: 70, stockObjetivo: 30 }, jueves), 0);
});
test("WhatsApp incluye unidad, zona y cantidad faltante", () => {
  const texto = textoLista([{ ...base, stockObjetivo: 30 }], "interno", jueves);
  assert.match(texto, /Preparaciones pendientes/);
  assert.match(texto, /faltan 18 bolas/);
  assert.match(texto, /Cocina/);
  assert.equal(normalizar("PROTEÍNAS"), "proteinas");
});
