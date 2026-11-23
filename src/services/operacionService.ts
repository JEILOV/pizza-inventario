import { collection, doc, addDoc, updateDoc, setDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Zona } from "@/types/insumo";

export interface Reporte {
  id: string; insumoId: string; nombre: string; zona: Zona;
  tipo: "poco" | "agotado" | "problema"; nota: string; usuarioId: string; usuarioNombre: string;
  resuelto: boolean;
}
export function escucharReportes(zona: Zona | undefined, ok: (r: Reporte[]) => void, error: () => void) {
  const base = collection(db, "reportes");
  return onSnapshot(query(base, where("resuelto", "==", false), ...(zona ? [where("zona", "==", zona)] : [])),
    (s) => ok(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Reporte)), error);
}
export async function crearReporte(reporte: Omit<Reporte, "id" | "resuelto">) {
  await addDoc(collection(db, "reportes"), { ...reporte, resuelto: false, fechaHora: serverTimestamp() });
}
export async function resolverReporte(id: string, uid: string) {
  await updateDoc(doc(db, "reportes", id), { resuelto: true, resueltoPor: uid, resueltoEn: serverTimestamp() });
}
export interface TareaPlantilla { id: string; zona: Zona; etapa: "apertura" | "cierre"; texto: string; activo: boolean }
export interface TareaHecha { id: string; completada: boolean; usuarioNombre: string }
export const TAREAS_BASE: TareaPlantilla[] = [
  { id: "cocina-preparaciones", zona: "cocina", etapa: "apertura", texto: "Revisar masas, salsas y porciones para el servicio", activo: true },
  { id: "cocina-estacion", zona: "cocina", etapa: "apertura", texto: "Dejar ingredientes y estación de trabajo listos", activo: true },
  { id: "cocina-pendientes", zona: "cocina", etapa: "cierre", texto: "Reportar faltantes y preparaciones del siguiente turno", activo: true },
  { id: "salon-delivery", zona: "salon", etapa: "apertura", texto: "Reponer cajas, bolsas, envases y servilletas de delivery", activo: true },
  { id: "salon-servicio", zona: "salon", etapa: "apertura", texto: "Revisar bebidas y materiales de atención", activo: true },
  { id: "salon-pendientes", zona: "salon", etapa: "cierre", texto: "Reportar faltantes y dejar el área preparada", activo: true },
];
export function escucharPlantillas(zona: Zona, ok: (t: TareaPlantilla[]) => void, error: () => void) {
  return onSnapshot(query(collection(db, "tareasPlantilla"), where("zona", "==", zona)), (s) => {
    const mapa = new Map(TAREAS_BASE.filter((t) => t.zona === zona).map((t) => [t.id, t]));
    s.docs.forEach((d) => mapa.set(d.id, { ...d.data(), id: d.id } as TareaPlantilla));
    ok([...mapa.values()].filter((t) => t.activo));
  }, error);
}
export function escucharTareas(zona: Zona, fecha: string, turno: string, ok: (t: TareaHecha[]) => void, error: () => void) {
  return onSnapshot(query(collection(db, "tareasTurno"), where("zona", "==", zona), where("fecha", "==", fecha), where("turno", "==", turno)),
    (s) => ok(s.docs.map((d) => ({ ...d.data(), id: d.id } as TareaHecha))), error);
}
export async function guardarTarea(tarea: TareaPlantilla, fecha: string, turno: string, completada: boolean, usuarioId: string, usuarioNombre: string) {
  await setDoc(doc(db, "tareasTurno", `${fecha}_${turno}_${tarea.zona}_${tarea.id}`), {
    zona: tarea.zona, fecha, turno, tareaId: tarea.id, texto: tarea.texto, completada, usuarioId, usuarioNombre, actualizadoEn: serverTimestamp(),
  });
}
export async function guardarPlantilla(t: Omit<TareaPlantilla, "id">, id?: string) {
  if (id) await setDoc(doc(db, "tareasPlantilla", id), t);
  else await addDoc(collection(db, "tareasPlantilla"), t);
}
