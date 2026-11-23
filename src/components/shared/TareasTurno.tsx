"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Zona } from "@/types/insumo";
import { fechaLocal, turnoActual } from "@/lib/operacion";
import { escucharPlantillas, escucharTareas, guardarTarea, guardarPlantilla, type TareaPlantilla, type TareaHecha } from "@/services/operacionService";

export default function TareasTurno({ zona }: { zona: Zona }) {
  const { usuario } = useAuth();
  const [fecha, setFecha] = useState(fechaLocal());
  const [turno, setTurno] = useState(turnoActual());
  const [plantillas, setPlantillas] = useState<TareaPlantilla[]>([]);
  const [hechas, setHechas] = useState<TareaHecha[]>([]);
  const [texto, setTexto] = useState("");
  const [etapa, setEtapa] = useState<"apertura" | "cierre">("apertura");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => escucharPlantillas(zona, setPlantillas, () => setError("No se pudieron cargar las tareas.")), [zona]);
  useEffect(() => {
    setCargando(true); setHechas([]); setError("");
    return escucharTareas(zona, fecha, turno, (t) => { setHechas(t); setCargando(false); }, () => { setError("No se pudo cargar el avance del turno."); setCargando(false); });
  }, [zona, fecha, turno]);
  async function ejecutar(fn: () => Promise<void>) {
    setOcupado(true); setError("");
    try { await fn(); } catch { setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo."); }
    finally { setOcupado(false); }
  }
  return <section className="ops-card mt-6">
    <h2 className="text-lg font-semibold">Preparar y entregar el turno · {zona === "salon" ? "Salón" : "Cocina"}</h2>
    <p className="ops-muted">Marca lo que ya está listo. El equipo comparte este avance.</p>
    <div className="my-4 flex flex-wrap gap-3">
      <label>Fecha<input type="date" className="ops-input" value={fecha} max={fechaLocal()} onChange={(e) => e.target.value && setFecha(e.target.value)} /></label>
      <label>Turno<select className="ops-input" value={turno} onChange={(e) => setTurno(e.target.value)}>{["mañana", "tarde", "noche"].map((t) => <option key={t}>{t}</option>)}</select></label>
    </div>
    {error && <p className="ops-error" role="alert">{error}</p>}
    {cargando ? <p>Cargando avance…</p> : ["apertura", "cierre"].map((et) => <div key={et} className="mt-4">
      <h3 className="font-semibold">{et === "apertura" ? "Antes del servicio" : "Entrega al siguiente turno"}</h3>
      {plantillas.filter((t) => t.etapa === et).map((t) => {
        const hecha = hechas.find((h) => h.id === `${fecha}_${turno}_${zona}_${t.id}`);
        return <div key={t.id} className="flex items-center gap-2 border-b border-stone-100 py-3">
          <label className="flex flex-1 cursor-pointer items-center gap-3"><input className="h-5 w-5 accent-emerald-800" type="checkbox" checked={hecha?.completada ?? false} disabled={ocupado || fecha !== fechaLocal()} onChange={(e) => ejecutar(() => guardarTarea(t, fecha, turno, e.target.checked, usuario!.uid, usuario!.nombre))} /><span>{t.texto}{hecha?.completada && <small className="block text-stone-500">Listo · {hecha.usuarioNombre}</small>}</span></label>
          {usuario?.rol === "admin" && <button className="ops-secondary" disabled={ocupado} onClick={() => ejecutar(() => guardarPlantilla({ zona, etapa: t.etapa, texto: t.texto, activo: false }, t.id))}>Quitar</button>}
        </div>;
      })}
    </div>)}
    {usuario?.rol === "admin" && <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!texto.trim()) return; ejecutar(async () => { await guardarPlantilla({ zona, etapa, texto: texto.trim(), activo: true }); setTexto(""); }); }}>
      <label className="flex-1">Nueva tarea<input className="ops-input" maxLength={200} required value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Dejar cajas armadas" /></label>
      <label>Momento<select className="ops-input" value={etapa} onChange={(e) => setEtapa(e.target.value as typeof etapa)}><option value="apertura">Apertura</option><option value="cierre">Cierre</option></select></label>
      <button className="ops-primary" disabled={ocupado}>Agregar</button>
    </form>}
  </section>;
}
