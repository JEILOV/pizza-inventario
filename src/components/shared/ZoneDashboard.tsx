"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  AlertTriangle,
  ClipboardList,
  Clock,
  ArrowRight,
  CalendarDays,
  PackageCheck,
  PackagePlus,
  Loader2,
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
  onIrAlChecklist?: () => void;
}

export default function ZoneDashboard({
  zona,
  titulo,
  icono,
  nombreZona,
  usuarioId,
  onIrAlChecklist,
}: ZoneDashboardProps) {
  const { insumos, cargando, error } = useInsumosPorZona(zona);

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

  const { rojos, amarillos, totalExternos, totalInternos } = useMemo(() => {
    return {
      rojos: insumos.filter((i) => calcularEstado(i, hoy) === "rojo"),
      amarillos: insumos.filter((i) => calcularEstado(i, hoy) === "amarillo"),
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
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

          <button
            onClick={() => setAjusteAbierto(true)}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
          >
            <PackagePlus className="h-3.5 w-3.5" strokeWidth={2} />
            Ajuste rápido
          </button>
        </div>
      </div>

      {/* Sección: Por reponer ahora (rojo) */}
      <Section
        titulo="Por reponer ahora"
        subtitulo="Ya está por debajo del mínimo. Producir o pedir al proveedor cuanto antes, según corresponda."
        icono={<Flame className="h-4 w-4" strokeWidth={2} />}
        color="rojo"
        vacio={`No hay insumos de ${nombreZona} en estado crítico.`}
      >
        {rojos.map((insumo) => (
          <TarjetaInsumo key={insumo.id} insumo={insumo} fecha={hoy} color="rojo" />
        ))}
      </Section>

      {/* Sección: Reponer pronto (amarillo) */}
      <Section
        titulo="Reponer pronto"
        subtitulo="Se acerca al mínimo. Conviene dejarlo listo o pedirlo antes de que falte."
        icono={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}
        color="amarillo"
        vacio={`No hay insumos de ${nombreZona} acercándose al mínimo.`}
      >
        {amarillos.map((insumo) => (
          <TarjetaInsumo key={insumo.id} insumo={insumo} fecha={hoy} color="amarillo" />
        ))}
      </Section>

      {/* Sección: Por contar */}
      <div className="mt-8">
        <div
          className={[
            "flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between",
            cierrePendiente
              ? "border-amber-300 bg-amber-50/50"
              : "border-stone-200 bg-stone-50",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <span
              className={[
                "flex h-10 w-10 flex-none items-center justify-center rounded-xl",
                cierrePendiente ? "bg-amber-100 text-amber-700" : "bg-white text-stone-500",
              ].join(" ")}
            >
              {cargandoCierre ? (
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Clock className="h-5 w-5" strokeWidth={1.75} />
              )}
            </span>
            <div>
              <p className="font-medium text-stone-900">
                {cargandoCierre
                  ? "Consultando último cierre..."
                  : errorCierre
                  ? errorCierre
                  : ultimoCierre
                  ? `Último cierre de ${nombreZona}: ${tiempoDesdeCierre}`
                  : `Todavía no hay ningún cierre registrado en ${nombreZona}.`}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
                <PackageCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                {totalExternos} insumos externos y {totalInternos} internos activos en esta zona.
              </p>
              {!cargandoCierre && cierrePendiente && (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  Ya pasaron varias horas — conviene cerrar pronto.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onIrAlChecklist}
            className="flex w-full flex-none items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover sm:w-auto"
          >
            <ClipboardList className="h-4 w-4" strokeWidth={2} />
            Ir al checklist de cierre
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

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

function Section({
  titulo,
  subtitulo,
  icono,
  color,
  vacio,
  children,
}: {
  titulo: string;
  subtitulo: string;
  icono: React.ReactNode;
  color: "rojo" | "amarillo";
  vacio: string;
  children: React.ReactNode;
}) {
  const estiloEncabezado =
    color === "rojo" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";

  const hayContenido = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className={["flex h-6 w-6 items-center justify-center rounded-md", estiloEncabezado].join(" ")}>
          {icono}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-stone-900">{titulo}</h2>
          <p className="text-xs text-stone-500">{subtitulo}</p>
        </div>
      </div>

      {hayContenido ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-400">
          {vacio}
        </p>
      )}
    </div>
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