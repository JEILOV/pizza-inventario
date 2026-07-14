"use client";

import { useMemo } from "react";
import {
  Flame,
  AlertTriangle,
  ChefHat,
  ClipboardList,
  Clock,
  ArrowRight,
  CalendarDays,
  PackageCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

type TipoInsumo = "externo" | "interno";
type Estado = "rojo" | "amarillo" | "verde";

interface Insumo {
  id: string;
  nombre: string;
  tipo: TipoInsumo;
  unidad: string;
  stockActual: number;
  stockMinimo: number; // lunes a jueves
  stockMinimoFinDeSemana: number; // viernes, sábado, domingo
  // Informativo, NO se usa para deducción automática — ver ADR de recetas.
  rendimientoPorLote?: number;
  loteUnidad?: string;
}

// ─────────────────────────────────────────────────────────────
// Datos mock
// ─────────────────────────────────────────────────────────────

// Simulamos que "hoy" es viernes para activar el mínimo de fin de semana.
const HOY_SIMULADO = new Date("2026-07-17T16:30:00"); // viernes

const ULTIMO_CIERRE_SIMULADO = new Date("2026-07-17T11:40:00");

const INSUMOS_MOCK: Insumo[] = [
  {
    id: "masa-personal",
    nombre: "Masa personal",
    tipo: "interno",
    unidad: "bolitas",
    stockActual: 18,
    stockMinimo: 25,
    stockMinimoFinDeSemana: 60,
    rendimientoPorLote: 20,
    loteUnidad: "bolitas por tanda",
  },
  {
    id: "masa-familiar",
    nombre: "Masa familiar",
    tipo: "interno",
    unidad: "bolitas",
    stockActual: 22,
    stockMinimo: 15,
    stockMinimoFinDeSemana: 35,
    rendimientoPorLote: 12,
    loteUnidad: "bolitas por tanda",
  },
  {
    id: "salsa-tomate",
    nombre: "Salsa de tomate",
    tipo: "interno",
    unidad: "kg",
    stockActual: 4.5,
    stockMinimo: 5,
    stockMinimoFinDeSemana: 9,
    rendimientoPorLote: 6,
    loteUnidad: "kg por olla",
  },
  {
    id: "pina-dulce",
    nombre: "Piña dulce (preparada)",
    tipo: "interno",
    unidad: "kg",
    stockActual: 6,
    stockMinimo: 4,
    stockMinimoFinDeSemana: 8,
  },
  // Insumos externos — no aparecen en las secciones de producción,
  // solo cuentan para el resumen de "Por contar".
  {
    id: "harina",
    nombre: "Harina",
    tipo: "externo",
    unidad: "sacos",
    stockActual: 4,
    stockMinimo: 2,
    stockMinimoFinDeSemana: 3,
  },
  {
    id: "queso-mozzarella",
    nombre: "Queso mozzarella",
    tipo: "externo",
    unidad: "kg",
    stockActual: 15,
    stockMinimo: 8,
    stockMinimoFinDeSemana: 14,
  },
];

// Factor de colchón para el estado amarillo mientras no tengamos
// consumo histórico real (colección `movimientos`) para calcularlo.
// Cuando exista ese dato, reemplazar por: stockMinimoVigente +
// consumoDiarioPromedio * (leadTimeDias + diasAnticipacionAlerta).
const FACTOR_COLCHON_AMARILLO = 1.4;

// ─────────────────────────────────────────────────────────────
// Lógica de negocio
// ─────────────────────────────────────────────────────────────

function esFinDeSemana(fecha: Date) {
  const dia = fecha.getDay(); // 0 = domingo, 5 = viernes, 6 = sábado
  return dia === 0 || dia === 5 || dia === 6;
}

function getStockMinimoVigente(insumo: Insumo, fecha: Date) {
  return esFinDeSemana(fecha)
    ? insumo.stockMinimoFinDeSemana
    : insumo.stockMinimo;
}

function calcularEstado(insumo: Insumo, fecha: Date): Estado {
  const minimoVigente = getStockMinimoVigente(insumo, fecha);
  if (insumo.stockActual <= minimoVigente) return "rojo";
  if (insumo.stockActual <= minimoVigente * FACTOR_COLCHON_AMARILLO) return "amarillo";
  return "verde";
}

function formatearTiempoTranscurrido(desde: Date, hasta: Date) {
  const minutos = Math.round((hasta.getTime() - desde.getTime()) / 60000);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `hace ${horas}h ${resto > 0 ? `${resto}min` : ""}`.trim();
}

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

interface KitchenDashboardProps {
  onIrAlChecklist?: () => void;
}

export default function KitchenDashboard({ onIrAlChecklist }: KitchenDashboardProps) {
  const hoy = HOY_SIMULADO;
  const finDeSemana = esFinDeSemana(hoy);

  const { rojos, amarillos, totalExternos } = useMemo(() => {
    const internos = INSUMOS_MOCK.filter((i) => i.tipo === "interno");
    return {
      rojos: internos.filter((i) => calcularEstado(i, hoy) === "rojo"),
      amarillos: internos.filter((i) => calcularEstado(i, hoy) === "amarillo"),
      totalExternos: INSUMOS_MOCK.filter((i) => i.tipo === "externo").length,
    };
  }, [hoy]);

  const tiempoDesdeCierre = formatearTiempoTranscurrido(ULTIMO_CIERRE_SIMULADO, hoy);
  const horasDesdeCierre =
    (hoy.getTime() - ULTIMO_CIERRE_SIMULADO.getTime()) / (1000 * 60 * 60);
  const cierrePendiente = horasDesdeCierre >= 6; // ajustar según duración real de turno

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <ChefHat className="h-6 w-6 text-orange-700" strokeWidth={1.75} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Cocina — Panel del turno
            </h1>
            <p className="text-sm text-stone-500">
              {hoy.toLocaleDateString("es-PE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>

        {finDeSemana && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700">
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
            Fin de semana — mínimos elevados
          </span>
        )}
      </div>

      {/* Sección: Por preparar ahora (rojo) */}
      <Section
        titulo="Por preparar ahora"
        subtitulo="Ya está por debajo del mínimo. Poner a producir cuanto antes."
        icono={<Flame className="h-4 w-4" strokeWidth={2} />}
        color="rojo"
        vacio="No hay insumos internos en estado crítico."
      >
        {rojos.map((insumo) => (
          <TarjetaInsumo key={insumo.id} insumo={insumo} fecha={hoy} color="rojo" />
        ))}
      </Section>

      {/* Sección: Preparar pronto (amarillo) */}
      <Section
        titulo="Preparar pronto"
        subtitulo="Se acerca al mínimo. Conviene dejarlo listo antes de que falte."
        icono={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}
        color="amarillo"
        vacio="No hay insumos internos acercándose al mínimo."
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
              <Clock className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-medium text-stone-900">
                Último cierre de cocina: {tiempoDesdeCierre}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
                <PackageCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                {totalExternos} insumos externos y {INSUMOS_MOCK.length - totalExternos} internos
                pendientes de conteo en el próximo cierre.
              </p>
              {cierrePendiente && (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  Ya pasaron varias horas — conviene cerrar pronto.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onIrAlChecklist}
            className="flex w-full flex-none items-center justify-center gap-2 rounded-xl bg-orange-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-800 sm:w-auto"
          >
            <ClipboardList className="h-4 w-4" strokeWidth={2} />
            Ir al checklist de cierre
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
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
    color === "rojo"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
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
  const faltante = Math.max(minimoVigente - insumo.stockActual, 0);

  const lotesSugeridos =
    insumo.rendimientoPorLote && faltante > 0
      ? Math.ceil(faltante / insumo.rendimientoPorLote)
      : null;

  const estilos =
    color === "rojo"
      ? {
          borde: "border-red-200",
          fondo: "bg-red-50/60",
          barra: "bg-red-500",
          texto: "text-red-700",
        }
      : {
          borde: "border-amber-200",
          fondo: "bg-amber-50/60",
          barra: "bg-amber-400",
          texto: "text-amber-700",
        };

  const progreso = Math.min((insumo.stockActual / minimoVigente) * 100, 100);

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

      {/* Barra de progreso hacia el mínimo */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div
          className={["h-full rounded-full", estilos.barra].join(" ")}
          style={{ width: `${progreso}%` }}
        />
      </div>

      <p className={["mt-2 text-xs font-medium", estilos.texto].join(" ")}>
        Faltan {faltante} {insumo.unidad} para el mínimo
        {lotesSugeridos ? ` · ~${lotesSugeridos} tanda${lotesSugeridos > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}