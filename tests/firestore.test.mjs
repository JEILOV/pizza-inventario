import { before, after, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, where, runTransaction } from "firebase/firestore";
let env;
const proyecto = "demo-pizza-inventario";
const stock = { nombre: "Masa", zona: "cocina", tipo: "interno", unidad: "bolas", stockActual: 10, stockMinimo: 5, activo: true };
const db = (uid, claims = {}) => env.authenticatedContext(uid, { email: `${uid}@example.test`, ...claims }).firestore();
before(async () => {
  env = await initializeTestEnvironment({ projectId: proyecto, firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    for (const [uid, rol] of [["admin", "admin"], ["cocinero", "cocina"], ["mesero", "salon"]]) await setDoc(doc(d, "usuarios", uid), { nombre: uid, rol, activo: true });
    await setDoc(doc(d, "insumos", "masa"), stock);
  });
});
test("nuevo usuario lee su perfil ausente y se registra sin privilegios", async () => {
  const d = db("nuevo");
  await assertSucceeds(getDoc(doc(d, "usuarios", "nuevo")));
  await assertSucceeds(setDoc(doc(d, "usuarios", "nuevo"), { nombre: "Nuevo", email: "nuevo@example.test", rol: null, activo: true, creadoEn: serverTimestamp() }));
  await assertFails(getDocs(collection(d, "insumos")));
  await assertFails(updateDoc(doc(d, "usuarios", "nuevo"), { rol: "admin" }));
  await assertSucceeds(updateDoc(doc(db("admin"), "usuarios", "nuevo"), { rol: "cocina" }));
  await assertSucceeds(getDocs(collection(d, "insumos")));
});
test("nadie se autorregistra como administrador ni escribe otro perfil", async () => {
  await assertFails(setDoc(doc(db("nuevo"), "usuarios", "nuevo"), { nombre: "Nuevo", email: "nuevo@example.test", rol: "admin", activo: true, creadoEn: serverTimestamp() }));
  await assertFails(setDoc(doc(db("nuevo"), "usuarios", "otro"), { nombre: "Otro", rol: null, activo: true }));
});
test("admin asigna y desactiva con efecto inmediato aun con claim viejo", async () => {
  await assertSucceeds(getDocs(collection(db("cocinero"), "insumos")));
  await assertSucceeds(updateDoc(doc(db("admin"), "usuarios", "cocinero"), { activo: false }));
  await assertFails(getDocs(collection(db("cocinero", { rol: "admin" }), "insumos")));
  await assertSucceeds(getDoc(doc(db("cocinero"), "usuarios", "cocinero")));
  await assertFails(updateDoc(doc(db("admin"), "usuarios", "admin"), { activo: false }));
  await assertFails(updateDoc(doc(db("admin"), "usuarios", "admin"), { rol: "cocina" }));
});
test("solo admin lista personal y cambia catálogo", async () => {
  await assertSucceeds(getDocs(collection(db("admin"), "usuarios")));
  await assertFails(getDocs(collection(db("cocinero"), "usuarios")));
  await assertFails(updateDoc(doc(db("cocinero"), "insumos", "masa"), { stockMinimo: 1 }));
  await assertSucceeds(updateDoc(doc(db("admin"), "insumos", "masa"), { categoria: "Masas", ubicacion: "Refrigeradora", stockObjetivo: 30 }));
});
test("personal solo ajusta stock de su zona y nunca negativo", async () => {
  await assertSucceeds(updateDoc(doc(db("cocinero"), "insumos", "masa"), { stockActual: 12, actualizadoEn: serverTimestamp() }));
  await assertFails(updateDoc(doc(db("mesero"), "insumos", "masa"), { stockActual: 12, actualizadoEn: serverTimestamp() }));
  await assertFails(updateDoc(doc(db("cocinero"), "insumos", "masa"), { stockActual: -1, actualizadoEn: serverTimestamp() }));
});
test("reportes se crean por zona, se consultan y se resuelven sin alterar autor", async () => {
  const r = { insumoId: "masa", nombre: "Masa", zona: "cocina", tipo: "poco", nota: "", usuarioId: "cocinero", usuarioNombre: "Cocina", resuelto: false, fechaHora: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db("cocinero"), "reportes", "r"), r));
  await assertSucceeds(getDocs(query(collection(db("cocinero"), "reportes"), where("zona", "==", "cocina"), where("resuelto", "==", false))));
  await assertFails(getDocs(collection(db("mesero"), "reportes")));
  await assertFails(setDoc(doc(db("mesero"), "reportes", "falso"), { ...r, zona: "salon", usuarioId: "mesero" }));
  await assertFails(updateDoc(doc(db("cocinero"), "reportes", "r"), { usuarioId: "admin" }));
  await assertSucceeds(updateDoc(doc(db("admin"), "reportes", "r"), { resuelto: true, resueltoPor: "admin", resueltoEn: serverTimestamp() }));
});
test("tareas están aisladas por zona y registran responsable", async () => {
  const id = "2026-11-23_noche_cocina_preparar";
  const t = { zona: "cocina", fecha: "2026-11-23", turno: "noche", tareaId: "preparar", texto: "Preparar estación", completada: true, usuarioId: "cocinero", usuarioNombre: "Cocina", actualizadoEn: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db("cocinero"), "tareasTurno", id), t));
  await assertFails(setDoc(doc(db("mesero"), "tareasTurno", id), { ...t, usuarioId: "mesero" }));
  await assertFails(setDoc(doc(db("cocinero"), "tareasTurno", "otro-id"), t));
  await assertSucceeds(getDocs(query(collection(db("cocinero"), "tareasTurno"), where("zona", "==", "cocina"), where("fecha", "==", t.fecha), where("turno", "==", t.turno))));
});
test("preparación y cierre pueden guardar stock e historial atómicamente", async () => {
  const d = db("cocinero");
  await assertSucceeds(runTransaction(d, async (tx) => {
    const ref = doc(d, "insumos", "masa");
    const s = await tx.get(ref);
    tx.update(ref, { stockActual: s.data().stockActual + 5, actualizadoEn: serverTimestamp() });
    tx.set(doc(d, "ajustes", "preparacion"), { insumoId: "masa", zona: "cocina", tipo: "reposicion", cantidad: 5, motivo: "Preparación lista", stockAnterior: 10, stockNuevo: 15, usuarioId: "cocinero", fechaHora: serverTimestamp() });
  }));
  await assertSucceeds(runTransaction(d, async (tx) => {
    const ref = doc(d, "insumos", "masa"); await tx.get(ref);
    tx.update(ref, { stockActual: 12, actualizadoEn: serverTimestamp() });
    tx.set(doc(d, "cierres", "turno"), { zona: "cocina", usuarioId: "cocinero", fechaHora: serverTimestamp(), items: [{ insumoId: "masa", stockNuevo: 12 }] });
  }));
});
