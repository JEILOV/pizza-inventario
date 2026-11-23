"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInsumosContext } from "@/contexts/InsumosContext";
import { calcularEstado } from "@/lib/reglasInventario";
import { cantidadPendiente, categoriaDe, normalizar, objetivoStock, ordenarInsumos, textoLista } from "@/lib/operacion";
import { crearReporte, escucharReportes, resolverReporte, type Reporte } from "@/services/operacionService";
import { registrarAjusteRapido } from "@/services/ajustesService";
import type { Insumo, Zona } from "@/types/insumo";
import TareasTurno from "./TareasTurno";

export default function OperacionPanel() {
  const { usuario } = useAuth();
  const { insumos, cargando, error: errorInsumos } = useInsumosContext();
  const admin = usuario?.rol === "admin";
  const zonaUsuario = admin ? undefined : usuario?.rol as Zona;
  const [zonaFiltro, setZonaFiltro] = useState("todas");
  const [categoria, setCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"compras" | "preparar" | "reportar">("compras");
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [errorReportes, setErrorReportes] = useState("");
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [seleccion, setSeleccion] = useState<{ insumo: Insumo; accion: "preparar" | "reposicion" | Reporte["tipo"] } | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (seleccion) dialogo.current?.showModal(); }, [seleccion]);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    setCargandoReportes(true); setErrorReportes(""); setReportes([]);
    return escucharReportes(zonaUsuario, (r) => { setReportes(r); setCargandoReportes(false); }, () => { setErrorReportes("No se pudieron cargar los reportes del equipo."); setCargandoReportes(false); });
  }, [zonaUsuario]);
  const activos = insumos.filter((i) => i.activo && (!zonaUsuario || i.zona === zonaUsuario));
  const compras = activos.filter((i) => i.tipo === "externo" && (calcularEstado(i, ahora) !== "verde" || reportes.some((r) => r.insumoId === i.id)));
  const preparar = activos.filter((i) => i.tipo === "interno" && (cantidadPendiente(i, ahora) > 0 || calcularEstado(i, ahora) !== "verde" || reportes.some((r) => r.insumoId === i.id)));
  const lista = ordenarInsumos((vista === "compras" ? compras : vista === "preparar" ? preparar : activos).filter((i) =>
    (zonaFiltro === "todas" || i.zona === zonaFiltro) && (!categoria || categoriaDe(i) === categoria) && normalizar(`${i.nombre} ${i.ubicacion ?? ""} ${categoriaDe(i)}`).includes(normalizar(busqueda))));
  async function ejecutar(fn: () => Promise<void>, exito: string) {
    if (ocupado) return;
    setOcupado(true); setError(""); setMensaje("");
    try { await fn(); setMensaje(exito); setSeleccion(null); }
    catch (e) { setError(e instanceof Error && e.message.startsWith("La cantidad") ? e.message : "No se pudo guardar. Revisa tu conexión e intenta de nuevo."); }
    finally { setOcupado(false); }
  }
  function abrir(insumo: Insumo, accion: NonNullable<typeof seleccion>["accion"]) { setSeleccion({ insumo, accion }); setNota(""); setCantidad(""); setError(""); setMensaje(""); }
  function compartir() {
    const avisos = reportes.filter((r) => lista.some((i) => i.id === r.insumoId));
    const texto = textoLista(lista, vista === "compras" ? "externo" : "interno", ahora) + (avisos.length ? "\n\nAvisos del equipo:\n" + avisos.map((r) => `• ${r.nombre}: ${r.tipo === "agotado" ? "Se acabó" : r.tipo === "poco" ? "Queda poco" : "Problema"}${r.nota ? ` — ${r.nota}` : ""}`).join("\n") : "");
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }
  if (cargando) return <div className="ops-page">Cargando el resumen del día…</div>;
  if (errorInsumos) return <div className="ops-page ops-error" role="alert">{errorInsumos}</div>;
  return <main className="ops-page">
    <div className="mb-5"><p className="text-sm font-medium text-emerald-800">PIZZA REPUBLIC · OPERACIÓN</p><h1 className="ops-title">Lo que necesitamos hoy</h1><p className="ops-muted">{admin ? "Compras, preparación y avisos de cocina y salón." : `Hola, ${usuario?.nombre}. Revisa faltantes y deja tu turno listo.`}</p></div>
    <div className="mb-5 grid grid-cols-3 gap-2">
      {([{ id: "compras", nombre: "Comprar", total: compras.length }, { id: "preparar", nombre: "Preparar", total: preparar.length }, { id: "reportar", nombre: "Reportar", total: activos.length }] as const).map((v) => <button key={v.id} aria-pressed={vista === v.id} onClick={() => { setVista(v.id); setCategoria(""); }} className={`rounded-xl border p-3 text-left ${vista === v.id ? "border-brand bg-brand text-white" : "border-stone-200 bg-white text-stone-700"}`}><strong className="block text-2xl">{v.total}</strong>{v.nombre}</button>)}
    </div>
    <section className="ops-card">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{vista === "compras" ? "Lista de compras" : vista === "preparar" ? "Preparación para el servicio" : "Reportar un insumo"}</h2><p className="ops-muted">{vista === "compras" ? "Incluye faltantes y alertas anticipadas. Comparte la lista con quien realiza las compras." : vista === "preparar" ? "Registra solo la cantidad que acabas de preparar; se sumará al stock disponible." : "Un aviso rápido informa al equipo sin cambiar el conteo de inventario."}</p></div>{vista !== "reportar" && <button className="ops-primary" onClick={compartir} disabled={!lista.length}>Compartir por WhatsApp</button>}</div>
      <div className="my-4 grid gap-3 sm:grid-cols-3">
        <label>Buscar<input className="ops-input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o ubicación" /></label>
        <label>Categoría<select className="ops-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas las categorías</option>{[...new Set(activos.map(categoriaDe))].sort().map((c) => <option key={c}>{c}</option>)}</select></label>
        {admin && <label>Área<select className="ops-input" value={zonaFiltro} onChange={(e) => setZonaFiltro(e.target.value)}><option value="todas">Cocina y salón</option><option value="cocina">Cocina</option><option value="salon">Salón</option></select></label>}
      </div>
      {mensaje && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{mensaje}</p>}
      {error && !seleccion && <p role="alert" className="ops-error">{error}</p>}
      {!lista.length && <p className="py-8 text-center text-stone-500">{activos.length ? "No hay insumos que coincidan con esta vista y sus filtros." : "Todavía no hay insumos activos en esta área."}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {lista.map((i) => <article key={i.id} className="rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">{categoriaDe(i)} · {i.zona === "salon" ? "Salón" : "Cocina"}{i.ubicacion && ` · ${i.ubicacion}`}</p>
          <h3 className="mt-1 text-lg font-semibold">{i.nombre}</h3>
          <p>Quedan <strong>{i.stockActual} {i.unidad}</strong>{vista !== "reportar" && ` · Meta: ${objetivoStock(i, ahora)} ${i.unidad}`}</p>
          {vista !== "reportar" && <p className="mt-1 text-sm font-medium text-amber-800">{cantidadPendiente(i, ahora) > 0 ? `Faltan ${cantidadPendiente(i, ahora)} ${i.unidad} para la meta` : "Revisar reposición anticipada / aviso del equipo"}{i.tipo === "interno" && i.rendimientoPorLote && cantidadPendiente(i, ahora) > 0 ? ` · ${Math.ceil(cantidadPendiente(i, ahora) / i.rendimientoPorLote)} tandas` : ""}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{vista === "compras" && <button disabled={ocupado} className="ops-primary" onClick={() => abrir(i, "reposicion")}>Registrar reposición</button>}{vista === "preparar" ? <button disabled={ocupado} className="ops-primary" onClick={() => abrir(i, "preparar")}>Registrar preparado</button> : <>{([ ["poco", "Queda poco"], ["agotado", "Se acabó"], ["problema", "Problema"] ] as const).map(([accion, titulo]) => <button key={accion} disabled={ocupado} className="ops-secondary" onClick={() => abrir(i, accion)}>{titulo}</button>)}</>}</div>
        </article>)}
      </div>
    </section>
    <section className="ops-card mt-6">
      <h2 className="text-lg font-semibold">Avisos del equipo y entrega de turno</h2>
      <p className="ops-muted">Los avisos siguen visibles hasta resolverlos, aunque cambie el turno.</p>
      {errorReportes && <p role="alert" className="ops-error">{errorReportes}</p>}
      {cargandoReportes ? <p>Cargando avisos…</p> : !errorReportes && !reportes.length && <p className="mt-3 text-stone-500">No hay avisos pendientes.</p>}
      {reportes.map((r) => <article key={r.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3"><div><h3 className="font-semibold">{r.nombre} · {r.tipo === "poco" ? "Queda poco" : r.tipo === "agotado" ? "Se acabó" : "Problema"}</h3><p className="whitespace-pre-wrap">{r.nota}</p><p className="ops-muted">{r.zona === "salon" ? "Salón" : "Cocina"} · {r.usuarioNombre}</p></div><button className="ops-secondary" disabled={ocupado} onClick={() => ejecutar(() => resolverReporte(r.id, usuario!.uid), "Aviso resuelto.")}>Marcar resuelto</button></article>)}
    </section>
    {(admin ? ["cocina", "salon"] as Zona[] : [zonaUsuario!]).map((z) => <TareasTurno key={z} zona={z} />)}
    {seleccion && <dialog ref={dialogo} className="m-auto w-full max-w-lg bg-transparent p-4 backdrop:bg-black/40" aria-labelledby="accion-titulo" onCancel={(e) => { e.preventDefault(); if (!ocupado) setSeleccion(null); }}>
      <form className="ops-card w-full max-w-md" onSubmit={(e) => {
        e.preventDefault();
        const s = seleccion;
        ejecutar(async () => {
          if (s.accion === "preparar" || s.accion === "reposicion") {
            if (!cantidad.trim() || !Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) throw new Error("La cantidad debe ser mayor que cero.");
            await registrarAjusteRapido({ insumoId: s.insumo.id, zona: s.insumo.zona, tipo: "reposicion", cantidad: Number(cantidad), motivo: `${s.accion === "preparar" ? "Preparación lista" : "Reposición recibida"}${nota.trim() ? `: ${nota.trim()}` : ""}`, usuarioId: usuario!.uid });
          } else await crearReporte({ insumoId: s.insumo.id, nombre: s.insumo.nombre, zona: s.insumo.zona, tipo: s.accion, nota: nota.trim(), usuarioId: usuario!.uid, usuarioNombre: usuario!.nombre });
        }, s.accion === "preparar" || s.accion === "reposicion" ? "Cantidad registrada y stock actualizado." : "Aviso enviado al equipo.");
      }}>
        <h2 id="accion-titulo" className="text-xl font-semibold">{seleccion.insumo.nombre}</h2>
        <p className="ops-muted mb-4">{seleccion.accion === "reposicion" ? "Cantidad que acaba de llegar, adicional a lo que ya había." : seleccion.accion === "preparar" ? "Cantidad recién preparada, adicional a lo que ya había." : seleccion.accion === "poco" ? "Avisar: queda poco" : seleccion.accion === "agotado" ? "Avisar: se acabó" : "Reportar un problema"}</p>
        {(seleccion.accion === "preparar" || seleccion.accion === "reposicion") && <label>Cantidad ({seleccion.insumo.unidad})<input autoFocus required min="0.001" step="any" type="number" inputMode="decimal" className="ops-input" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></label>}
        <label className="mt-3 block">{seleccion.accion === "problema" ? "Describe el problema" : "Nota opcional"}<textarea className="ops-input" maxLength={500} required={seleccion.accion === "problema"} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
        {error && <p role="alert" className="ops-error">{error}</p>}
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="ops-secondary" disabled={ocupado} onClick={() => setSeleccion(null)}>Cancelar</button><button className="ops-primary" disabled={ocupado}>{ocupado ? "Guardando…" : "Confirmar"}</button></div>
      </form>
    </dialog>}
  </main>;
}
