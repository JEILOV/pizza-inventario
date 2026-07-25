"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  AlertTriangle,
  ClipboardList,
  Clock,
  CalendarDays,
  PackageCheck,
  PackagePlus,
  Loader2,
  Search,
  X,
  ChevronDown,
  ChefHat,
  Boxes,
  LayoutGrid,
} from "lucide-react";
import { useInsumosPorZona } from "@/hooks/useInsumosPorZona";
import { obtenerUltimoCierre, type UltimoCierre } from "@/services/cierresService";
import {
  calcularEstado,
  calcularFaltante,
  esFinDeSemana,
  getStockMinimoVigente,
} from "@/lib/reglasInventario";
import AjusteRapidoModal from "@/components/shared/AjusteRapidoModal";
import AlertasCompra from "@/components/shared/AlertasCompra";
import ShiftCloseChecklist from "@/components/salon/ShiftCloseChecklist";
import type { Insumo, Zona } from "@/types/insumo";

// ─────────────────────────────────────────────────────────────
// Utilidades locales de presentación
// ─────────────────────────────────────────────────────────────

function formatearTiempoTranscurrido(desde: Date, hasta: Date) {
  const minutos = Math.round((hasta.getTime() - desde.getTime()) / 60000);
  if (minutos < 1) return "hace instantes";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `hace ${horas}h ${resto > 0 ? `${resto}min` : ""}`.trim();
}

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

type TabZona = "inventario" | "cierre";

export interface ZoneDashboardProps {
  zona: Zona;
  /** Ej. "Cocina — Panel del turno" */
  titulo: string;
  /** Ícono de lucide-react ya instanciado, ej. <ChefHat className="h-6 w-6" /> */
  icono: React.ReactNode;
  /** Nombre de la zona en minúsculas para textos ("cocina" / "salón") */
  nombreZona: string;
  /** uid del usuario en sesión — queda registrado en cada ajuste rápido que haga */
  usuarioId: string;
  /**
   * Ya no hace falta para navegar al checklist (ahora es una sub-pestaña
   * local dentro de este mismo componente). Se mantiene solo por
   * compatibilidad hacia atrás, por si algún llamador todavía la usa
   * para otra cosa (ej. analítica). ZoneDashboard NO la invoca al
   * cambiar de pestaña.
   */
  onIrAlChecklist?: () => void;
}

export default function ZoneDashboard({
  zona,
  titulo,
  icono,
  nombreZona,
  usuarioId,
}: ZoneDashboardProps) {
  const { insumos, cargando, error } = useInsumosPorZona(zona);

  // ── Estado local de UI únicamente. Nada de esto toca Firestore ni
  //    useInsumosPorZona — cambiar de pestaña o buscar es puramente
  //    en memoria sobre los datos que ya trajo InsumosProvider. ──
  const [tabActiva, setTabActiva] = useState<TabZona>("inventario");
  const [busqueda, setBusqueda] = useState("");
  const [seccionAbierta, setSeccionAbierta] = useState({
    // Todas las secciones arrancan cerradas: en celular, mostrar de
    // golpe las tarjetas de "Por reponer ahora" hacía que la pantalla
    // de inicio se sintiera saturada apenas se entraba al panel.
    // AlertasCompra (arriba) ya resume lo urgente en un banner
    // colapsable; este acordeón es para quien quiere profundizar.
    rojo: false,
    amarillo: false,
    todos: false,
  });
  const [tipoAbierto, setTipoAbierto] = useState({ interno: true, externo: true });

  const [ultimoCierre, setUltimoCierre] = useState<UltimoCierre | null>(null);
  const [cargandoCierre, setCargandoCierre] = useState(true);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [ajusteAbierto, setAjusteAbierto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargandoCierre(true);
    setErrorCierre(null);

    obtenerUltimoCierre(zona)
      .then((resultado) => {
        if (!cancelado) setUltimoCierre(resultado);
      })
      .catch((e) => {
        console.error("No se pudo obtener el último cierre:", e);
        if (!cancelado) setErrorCierre("No se pudo cargar la hora del último cierre.");
      })
      .finally(() => {
        if (!cancelado) setCargandoCierre(false);
      });

    return () => {
      cancelado = true;
    };
  }, [zona]);

  const hoy = new Date();
  const finDeSemana = esFinDeSemana(hoy);

  const { rojos, amarillos, todosOrdenados, totalExternos, totalInternos } = useMemo(() => {
    const ordenados = [...insumos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return {
      rojos: insumos.filter((i) => calcularEstado(i, hoy) === "rojo"),
      amarillos: insumos.filter((i) => calcularEstado(i, hoy) === "amarillo"),
      todosOrdenados: ordenados,
      totalExternos: insumos.filter((i) => i.tipo === "externo").length,
      totalInternos: insumos.filter((i) => i.tipo === "interno").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insumos]);

  const tiempoDesdeCierre = ultimoCierre
    ? formatearTiempoTranscurrido(ultimoCierre.fechaHora, hoy)
    : null;
  const horasDesdeCierre = ultimoCierre
    ? (hoy.getTime() - ultimoCierre.fechaHora.getTime()) / (1000 * 60 * 60)
    : null;
  const cierrePendiente = horasDesdeCierre === null || horasDesdeCierre >= 6;

  // ── Filtro de búsqueda — solo estado local, recalculado en cada
  //    render (la lista nunca pasa de ~cientos de insumos, así que
  //    no hace falta memoizar esto por separado). ──
  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const coincide = (i: Insumo) =>
    busquedaNormalizada === "" || i.nombre.toLowerCase().includes(busquedaNormalizada);

  const rojosFiltrados = rojos.filter(coincide);
  const amarillosFiltrados = amarillos.filter(coincide);
  const todosFiltrados = todosOrdenados.filter(coincide);
  const internosFiltrados = todosFiltrados.filter((i) => i.tipo === "interno");
  const externosFiltrados = todosFiltrados.filter((i) => i.tipo === "externo");

  const hayBusqueda = busquedaNormalizada !== "";

  const toggleSeccion = (clave: keyof typeof seccionAbierta) =>
    setSeccionAbierta((prev) => ({ ...prev, [clave]: !prev[clave] }));

  const toggleTipo = (clave: keyof typeof tipoAbierto) =>
    setTipoAbierto((prev) => ({ ...prev, [clave]: !prev[clave] }));

  if (cargando) {
    return (
      <div className="mx-auto flex min-h-[300px] w-full max-w-5xl items-center justify-center gap-2 px-4 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando panel de {nombreZona}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[300px] w-full max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500" strokeWidth={1.75} />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* ── Encabezado + Sub-pestañas — siempre visibles, sin importar
          el scroll del contenido de abajo. ── */}
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {icono}
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">{titulo}</h1>
              <p className="text-sm text-stone-500">
                {hoy.toLocaleDateString("es-PE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {finDeSemana && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                Fin de semana — mínimos elevados
              </span>
            )}

            {tabActiva === "inventario" && (
              <button
                onClick={() => setAjusteAbierto(true)}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
              >
                <PackagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                Ajuste rápido
              </button>
            )}
          </div>
        </div>

        {/* Sub-pestañas: Inventario / Cierre de turno — botones grandes,
            pensados para tocar con el dedo en tablet/celular. */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5">
          <button
            type="button"
            onClick={() => setTabActiva("inventario")}
            className={[
              "flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors sm:text-base",
              tabActiva === "inventario"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700",
            ].join(" ")}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={2} />
            Inventario
            {rojos.length > 0 && (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {rojos.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("cierre")}
            className={[
              "flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors sm:text-base",
              tabActiva === "cierre"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700",
            ].join(" ")}
          >
            <ClipboardList className="h-4 w-4" strokeWidth={2} />
            Cierre de turno
            {cierrePendiente && !cargandoCierre && (
              <span className="ml-0.5 h-2 w-2 flex-none rounded-full bg-amber-500" title="Cierre pendiente" />
            )}
          </button>
        </div>
      </div>

      {/* ── Contenido de la pestaña activa ── */}
      {tabActiva === "cierre" ? (
        // ShiftCloseChecklist ya trae su propio contenedor/padding —
        // se embebe tal cual, sin envolverlo en más wrappers, para no
        // duplicar el layout. Usa useInsumosPorZona internamente, así
        // que sigue leyendo del mismo InsumosProvider sin listeners
        // nuevos al cambiar de pestaña.
        <ShiftCloseChecklist zona={zona} usuarioId={usuarioId} />
      ) : (
        <div className="px-4 pb-8 sm:px-6 lg:px-8">
          {/* Alertas de compra — resumen compacto, siempre visible
              arriba de todo (no es parte del acordeón porque es lo
              primero que Cocina/Salón necesita ver). */}
          <AlertasCompra
            insumos={insumos}
            tipo="externo"
            titulo="Alertas de compra"
            subtitulo="Insumos externos en cero o por debajo del mínimo. Conviene avisarle a Gerencia cuanto antes."
            textoBoton="Pedir insumos externos a Gerencia"
          />

          {/* Aviso de último cierre — informativo, ya no lleva botón de
              navegación externa: si hace falta cerrar, el usuario solo
              toca la pestaña "Cierre de turno" de arriba. */}
          <div
            className={[
              "mb-6 flex items-center gap-3 rounded-2xl border p-4",
              cierrePendiente ? "border-amber-300 bg-amber-50/50" : "border-stone-200 bg-stone-50",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-9 w-9 flex-none items-center justify-center rounded-xl",
                cierrePendiente ? "bg-amber-100 text-amber-700" : "bg-white text-stone-500",
              ].join(" ")}
            >
              {cargandoCierre ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Clock className="h-4 w-4" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">
                {cargandoCierre
                  ? "Consultando último cierre..."
                  : errorCierre
                  ? errorCierre
                  : ultimoCierre
                  ? `Último cierre de ${nombreZona}: ${tiempoDesdeCierre}`
                  : `Todavía no hay ningún cierre registrado en ${nombreZona}.`}
              </p>
              <p className="text-xs text-stone-500">
                {totalExternos} insumos externos y {totalInternos} internos activos en esta zona.
              </p>
            </div>
          </div>

          {/* Buscador local — filtra en memoria por nombre, cero
              lecturas nuevas a Firestore. */}
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={`Buscar insumo de ${nombreZona}...`}
              className="w-full rounded-xl border border-stone-300 bg-white py-3.5 pl-10 pr-10 text-sm text-stone-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-base"
            />
            {busqueda !== "" && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Acordeón: Por reponer ahora (rojo) */}
          <Acordeon
            titulo="Por reponer ahora"
            subtitulo="Ya está por debajo del mínimo."
            icono={<Flame className="h-4 w-4" strokeWidth={2} />}
            colorIcono="bg-red-50 text-red-700"
            contador={rojosFiltrados.length}
            abierto={seccionAbierta.rojo || hayBusqueda}
            onToggle={() => toggleSeccion("rojo")}
          >
            {rojosFiltrados.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rojosFiltrados.map((insumo) => (
                  <TarjetaInsumo key={insumo.id} insumo={insumo} fecha={hoy} color="rojo" />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-400">
                {hayBusqueda
                  ? "Ningún insumo crítico coincide con tu búsqueda."
                  : `No hay insumos de ${nombreZona} en estado crítico.`}
              </p>
            )}
          </Acordeon>

          {/* Acordeón: Reponer pronto (amarillo) */}
          <Acordeon
            titulo="Reponer pronto"
            subtitulo="Se acerca al mínimo."
            icono={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}
            colorIcono="bg-amber-50 text-amber-700"
            contador={amarillosFiltrados.length}
            abierto={seccionAbierta.amarillo || hayBusqueda}
            onToggle={() => toggleSeccion("amarillo")}
          >
            {amarillosFiltrados.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {amarillosFiltrados.map((insumo) => (
                  <TarjetaInsumo key={insumo.id} insumo={insumo} fecha={hoy} color="amarillo" />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-400">
                {hayBusqueda
                  ? "Ningún insumo por acercarse al mínimo coincide con tu búsqueda."
                  : `No hay insumos de ${nombreZona} acercándose al mínimo.`}
              </p>
            )}
          </Acordeon>

          {/* Acordeón: Todo el inventario — agrupado por tipo. Colapsado
              por defecto para no renderizar de golpe los ~90 insumos;
              solo pinta las filas cuando el usuario lo abre (o cuando
              está buscando algo). */}
          <Acordeon
            titulo="Todo el inventario"
            subtitulo="Producción interna y compras externas."
            icono={<PackageCheck className="h-4 w-4" strokeWidth={2} />}
            colorIcono="bg-stone-100 text-stone-600"
            contador={todosFiltrados.length}
            abierto={seccionAbierta.todos || hayBusqueda}
            onToggle={() => toggleSeccion("todos")}
          >
            {todosFiltrados.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-400">
                Ningún insumo coincide con tu búsqueda.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <SubgrupoTipo
                  titulo="Producción interna"
                  icono={<ChefHat className="h-3.5 w-3.5" strokeWidth={2} />}
                  color="bg-emerald-50 text-emerald-700"
                  insumos={internosFiltrados}
                  fecha={hoy}
                  abierto={tipoAbierto.interno || hayBusqueda}
                  onToggle={() => toggleTipo("interno")}
                />
                <SubgrupoTipo
                  titulo="Compras externas"
                  icono={<Boxes className="h-3.5 w-3.5" strokeWidth={2} />}
                  color="bg-stone-100 text-stone-600"
                  insumos={externosFiltrados}
                  fecha={hoy}
                  abierto={tipoAbierto.externo || hayBusqueda}
                  onToggle={() => toggleTipo("externo")}
                />
              </div>
            )}
          </Acordeon>
        </div>
      )}

      <AjusteRapidoModal
        abierto={ajusteAbierto}
        onClose={() => setAjusteAbierto(false)}
        zona={zona}
        insumos={insumos}
        usuarioId={usuarioId}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────

function Acordeon({
  titulo,
  subtitulo,
  icono,
  colorIcono,
  contador,
  abierto,
  onToggle,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  icono: React.ReactNode;
  colorIcono: string;
  contador: number;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-stone-50 active:bg-stone-100 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={["flex h-9 w-9 flex-none items-center justify-center rounded-xl", colorIcono].join(" ")}>
            {icono}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">{titulo}</p>
            {subtitulo && <p className="truncate text-xs text-stone-500">{subtitulo}</p>}
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
            {contador}
          </span>
          <ChevronDown
            className={["h-5 w-5 text-stone-400 transition-transform", abierto ? "rotate-180" : ""].join(" ")}
            strokeWidth={2}
          />
        </div>
      </button>
      {abierto && <div className="border-t border-stone-100 p-4 sm:p-5">{children}</div>}
    </div>
  );
}

function SubgrupoTipo({
  titulo,
  icono,
  color,
  insumos,
  fecha,
  abierto,
  onToggle,
}: {
  titulo: string;
  icono: React.ReactNode;
  color: string;
  insumos: Insumo[];
  fecha: Date;
  abierto: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-stone-50 active:bg-stone-100"
      >
        <span className="flex items-center gap-2">
          <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", color].join(" ")}>
            {icono}
            {titulo}
          </span>
          <span className="text-xs text-stone-400">({insumos.length})</span>
        </span>
        <ChevronDown
          className={["h-4 w-4 text-stone-400 transition-transform", abierto ? "rotate-180" : ""].join(" ")}
          strokeWidth={2}
        />
      </button>
      {abierto &&
        (insumos.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {insumos.map((insumo) => (
              <FilaInsumo key={insumo.id} insumo={insumo} fecha={fecha} />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-2 text-xs text-stone-400">Sin insumos en este grupo.</p>
        ))}
    </div>
  );
}

function FilaInsumo({ insumo, fecha }: { insumo: Insumo; fecha: Date }) {
  const estado = calcularEstado(insumo, fecha);
  const minimoVigente = getStockMinimoVigente(insumo, fecha);

  const colorPunto =
    estado === "rojo" ? "bg-red-500" : estado === "amarillo" ? "bg-amber-400" : "bg-emerald-500";

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={["h-2.5 w-2.5 flex-none rounded-full", colorPunto].join(" ")}
          title={estado === "rojo" ? "Crítico" : estado === "amarillo" ? "Por acercarse" : "OK"}
        />
        <p className="truncate text-sm font-medium text-stone-900">{insumo.nombre}</p>
      </div>
      <div className="flex flex-none items-baseline gap-1 text-sm tabular-nums">
        <span className="font-semibold text-stone-900">{insumo.stockActual}</span>
        <span className="text-stone-400">
          / {minimoVigente} {insumo.unidad}
        </span>
      </div>
    </li>
  );
}

function TarjetaInsumo({
  insumo,
  fecha,
  color,
}: {
  insumo: Insumo;
  fecha: Date;
  color: "rojo" | "amarillo";
}) {
  const minimoVigente = getStockMinimoVigente(insumo, fecha);
  const faltante = calcularFaltante(insumo, fecha);

  const lotesSugeridos =
    insumo.rendimientoPorLote && faltante > 0
      ? Math.ceil(faltante / insumo.rendimientoPorLote)
      : null;

  const estilos =
    color === "rojo"
      ? { borde: "border-red-200", fondo: "bg-red-50/60", barra: "bg-red-500", texto: "text-red-700" }
      : { borde: "border-amber-200", fondo: "bg-amber-50/60", barra: "bg-amber-400", texto: "text-amber-700" };

  const progreso =
    minimoVigente > 0 ? Math.min((insumo.stockActual / minimoVigente) * 100, 100) : 100;

  return (
    <div className={["rounded-xl border p-4 shadow-sm", estilos.borde, estilos.fondo].join(" ")}>
      <p className="font-medium text-stone-900">{insumo.nombre}</p>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-stone-900">
          {insumo.stockActual}
        </span>
        <span className="text-xs text-stone-500">
          / {minimoVigente} {insumo.unidad} mín.
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div className={["h-full rounded-full", estilos.barra].join(" ")} style={{ width: `${progreso}%` }} />
      </div>

      <p className={["mt-2 text-xs font-medium", estilos.texto].join(" ")}>
        Faltan {faltante} {insumo.unidad} para el mínimo
        {lotesSugeridos ? ` · ~${lotesSugeridos} tanda${lotesSugeridos > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}