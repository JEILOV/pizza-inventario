"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  AlertTriangle,
  MessageSquarePlus,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { useInsumosPorZona } from "@/hooks/useInsumosPorZona";
import { confirmarCierreTurno } from "@/services/cierresService";
import type { Zona } from "@/types/insumo";

// ─────────────────────────────────────────────────────────────
// Tipos locales del formulario (no del dominio — eso vive en types/insumo)
// ─────────────────────────────────────────────────────────────

interface ItemCierre {
  nuevoConteo: string; // se maneja como string para permitir campo vacío mientras se escribe
  nota: string;
  notaAbierta: boolean;
}

// Umbral por el cual una diferencia se considera "revisar antes de enviar"
const UMBRAL_ALERTA_PORCENTAJE = 0.3; // 30%

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

function calcularDelta(stockActual: number, nuevoConteo: string) {
  if (nuevoConteo.trim() === "") return null;
  const nuevo = Number(nuevoConteo);
  if (Number.isNaN(nuevo)) return null;
  return nuevo - stockActual;
}

function esDiferenciaGrande(stockActual: number, delta: number) {
  if (stockActual === 0) return delta !== 0;
  return Math.abs(delta) / stockActual >= UMBRAL_ALERTA_PORCENTAJE;
}

// Validación estricta del conteo: no vacío, no NaN, no negativo.
// "12.5.3" o "abc" también deben quedar fuera — Number() es permisivo
// con espacios pero no con texto no numérico, así que Number.isNaN
// cubre el caso general.
function esConteoValido(valor: string): boolean {
  if (valor.trim() === "") return false;
  const n = Number(valor);
  return !Number.isNaN(n) && n >= 0;
}

// Heurística simple mientras no haya turnos configurados en el backend —
// reemplazar cuando exista un selector de turno real o venga del roster.
function getTurnoActual(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "mañana";
  if (hora < 18) return "tarde";
  return "noche";
}

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

export default function ShiftCloseChecklist({
  zona = "cocina",
  usuarioId,
  turno,
}: {
  zona?: Zona;
  usuarioId: string;
  turno?: string;
}) {
  const { insumos, cargando, error } = useInsumosPorZona(zona);

  const [items, setItems] = useState<Record<string, ItemCierre>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Única fuente de lectura de `items`. Cubre la ventana de la condición
  // de carrera: el useEffect de abajo llena `items` después del commit,
  // así que en cualquier render entre "insumos ya llegó" y "el efecto ya
  // corrió", esto evita leer undefined. No es un parche temporal — es
  // la segunda mitad necesaria de sincronizar estado externo (Firestore)
  // hacia estado local de formulario.
  const getItem = (id: string): ItemCierre =>
    items[id] ?? { nuevoConteo: "", nota: "", notaAbierta: false };

  // Cuando llegan (o cambian) los insumos desde Firestore, inicializa una
  // entrada por cada uno — pero solo si todavía no existe. Así, si el
  // listener empuja una actualización mientras la persona está a mitad
  // de conteo (ej. alguien hizo un ajuste rápido), no se le borra lo
  // que ya escribió.
  useEffect(() => {
    setItems((prev) => {
      const siguiente = { ...prev };
      let huboCambios = false;
      for (const insumo of insumos) {
        if (!siguiente[insumo.id]) {
          siguiente[insumo.id] = { nuevoConteo: "", nota: "", notaAbierta: false };
          huboCambios = true;
        }
      }
      return huboCambios ? siguiente : prev;
    });
  }, [insumos]);

  const actualizarConteo = (id: string, valor: string) => {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], nuevoConteo: valor },
    }));
  };

  const actualizarNota = (id: string, valor: string) => {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], nota: valor },
    }));
  };

  const toggleNota = (id: string) => {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], notaAbierta: !prev[id].notaAbierta },
    }));
  };

  const conteosCompletados = useMemo(
    () => insumos.filter((i) => esConteoValido(getItem(i.id).nuevoConteo)).length,
    [insumos, items]
  );

  const listoParaEnviar = insumos.length > 0 && conteosCompletados === insumos.length;

  const handleConfirmar = async () => {
    if (!listoParaEnviar || enviando) return;

    setErrorEnvio(null);
    setEnviando(true);
    try {
      await confirmarCierreTurno({
        zona,
        turno: turno ?? getTurnoActual(),
        usuarioId,
        items: insumos.map((insumo) => {
          const item = getItem(insumo.id);
          const nuevo = Number(item.nuevoConteo);
          return {
            insumoId: insumo.id,
            stockAnterior: insumo.stockActual,
            stockNuevo: nuevo,
            diferencia: nuevo - insumo.stockActual,
            nota: item.nota.trim() || undefined,
          };
        }),
      });
      setEnviado(true);
    } catch (e) {
      console.error("Error al confirmar cierre de turno:", e);
      setErrorEnvio("No se pudo guardar el cierre. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="mx-auto flex min-h-[300px] w-full max-w-5xl items-center justify-center gap-2 px-4 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando insumos de {zona === "cocina" ? "cocina" : "salón"}...
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

  if (enviado) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" strokeWidth={1.5} />
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Cierre de turno registrado
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Se guardaron {insumos.length} conteos correctamente.
          </p>
        </div>
        <button
          onClick={() => {
            setItems({});
            setEnviado(false);
          }}
          className="mt-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Registrar otro cierre
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-1 border-b border-stone-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-6 w-6 text-orange-700" strokeWidth={1.75} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Cierre de turno — {zona === "cocina" ? "Cocina" : "Salón"}
            </h1>
            <p className="text-sm text-stone-500">
              Cuenta el stock físico de cada insumo y confirma al terminar.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
          {conteosCompletados} / {insumos.length} contados
        </span>
      </div>

      {/* Encabezado de tabla — solo visible en escritorio */}
      <div className="mb-2 hidden grid-cols-[1.6fr_0.9fr_1fr_0.7fr_auto] gap-4 px-4 text-xs font-medium uppercase tracking-wide text-stone-400 md:grid">
        <span>Insumo</span>
        <span>Stock actual</span>
        <span>Nuevo conteo</span>
        <span>Diferencia</span>
        <span className="sr-only">Nota</span>
      </div>

      {/* Lista de insumos */}
      <ul className="flex flex-col gap-3">
        {insumos.map((insumo) => {
          const item = getItem(insumo.id);
          const delta = calcularDelta(insumo.stockActual, item.nuevoConteo);
          const alerta = delta !== null && esDiferenciaGrande(insumo.stockActual, delta);
          const tieneTexto = item.nuevoConteo.trim() !== "";
          const invalido = tieneTexto && !esConteoValido(item.nuevoConteo);

          return (
            <li
              key={insumo.id}
              className={[
                "rounded-xl border bg-white p-4 shadow-sm transition-colors",
                invalido
                  ? "border-red-300 bg-red-50/40"
                  : alerta
                  ? "border-amber-300 bg-amber-50/40"
                  : "border-stone-200",
              ].join(" ")}
            >
              {/* Fila principal: card en móvil, grid de "tabla" en desktop */}
              <div className="flex flex-col gap-3 md:grid md:grid-cols-[1.6fr_0.9fr_1fr_0.7fr_auto] md:items-center md:gap-4">
                {/* Nombre + tipo */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={[
                      "flex h-8 w-8 flex-none items-center justify-center rounded-lg",
                      insumo.tipo === "interno"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-stone-100 text-stone-500",
                    ].join(" ")}
                    title={insumo.tipo === "interno" ? "Producción interna" : "Insumo externo"}
                  >
                    <Package className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900">
                      {insumo.nombre}
                    </p>
                    <p className="text-xs text-stone-400 md:hidden">
                      Stock actual: {insumo.stockActual} {insumo.unidad}
                    </p>
                  </div>
                </div>

                {/* Stock actual — solo visible como columna en desktop */}
                <div className="hidden text-sm text-stone-600 md:block">
                  {insumo.stockActual}{" "}
                  <span className="text-stone-400">{insumo.unidad}</span>
                </div>

                {/* Input nuevo conteo */}
                <div className="flex items-center gap-2">
                  <label htmlFor={`conteo-${insumo.id}`} className="text-xs font-medium text-stone-500 md:hidden">
                    Nuevo conteo
                  </label>
                  <div className="relative flex-1 md:max-w-[140px]">
                    <input
                      id={`conteo-${insumo.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="0"
                      value={item.nuevoConteo}
                      onChange={(e) => actualizarConteo(insumo.id, e.target.value)}
                      aria-invalid={invalido}
                      className={[
                        "w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-stone-900 outline-none transition-colors",
                        "focus:border-orange-500 focus:ring-2 focus:ring-orange-100",
                        invalido ? "border-red-400" : alerta ? "border-amber-400" : "border-stone-300",
                      ].join(" ")}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                      {insumo.unidad}
                    </span>
                    {invalido && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Ingresa un número válido (0 o mayor)
                      </p>
                    )}
                  </div>
                </div>

                {/* Delta */}
                <div className="flex items-center gap-1.5">
                  {invalido ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                      Inválido
                    </span>
                  ) : delta === null ? (
                    <span className="text-sm text-stone-300">—</span>
                  ) : (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold tabular-nums",
                        delta === 0
                          ? "bg-stone-100 text-stone-500"
                          : delta > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600",
                      ].join(" ")}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  )}
                  {!invalido && alerta && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                      <span className="hidden sm:inline">Revisar</span>
                    </span>
                  )}
                </div>

                {/* Botón de nota */}
                <button
                  type="button"
                  onClick={() => toggleNota(insumo.id)}
                  className={[
                    "flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors md:self-auto",
                    item.nota.trim() !== ""
                      ? "bg-orange-50 text-orange-700"
                      : "text-stone-400 hover:bg-stone-50 hover:text-stone-600",
                  ].join(" ")}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {item.nota.trim() !== "" ? "Nota agregada" : "Agregar nota"}
                  <ChevronDown
                    className={[
                      "h-3.5 w-3.5 transition-transform",
                      item.notaAbierta ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Campo de nota expandible */}
              {item.notaAbierta && (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <textarea
                    value={item.nota}
                    onChange={(e) => actualizarNota(insumo.id, e.target.value)}
                    placeholder='Ej. "Se botaron 2 masas porque se cayeron"'
                    rows={2}
                    className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Acción principal */}
      <div className="sticky bottom-0 mt-6 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {errorEnvio && (
          <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
            {errorEnvio}
          </p>
        )}
        <button
          onClick={handleConfirmar}
          disabled={!listoParaEnviar || enviando}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm transition-colors",
            listoParaEnviar && !enviando
              ? "bg-orange-700 text-white hover:bg-orange-800"
              : "cursor-not-allowed bg-stone-200 text-stone-400",
          ].join(" ")}
        >
          {enviando ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Guardando cierre...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Confirmar cierre de turno
            </>
          )}
        </button>
        {!listoParaEnviar && (
          <p className="mt-2 text-center text-xs text-stone-400">
            Completa el conteo de los {insumos.length} insumos para poder confirmar.
          </p>
        )}
      </div>
    </div>
  );
}