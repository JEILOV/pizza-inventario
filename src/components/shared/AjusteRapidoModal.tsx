"use client";

import { useState } from "react";
import { X, Minus, Plus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { registrarAjusteRapido, type TipoAjuste } from "@/services/ajustesService";
import type { Insumo, Zona } from "@/types/insumo";

const MOTIVOS_SUGERIDOS = [
  "Insumo malogrado",
  "Se cayó / rompió",
  "Error de conteo anterior",
  "Reposición de proveedor",
];

interface AjusteRapidoModalProps {
  abierto: boolean;
  onClose: () => void;
  zona: Zona;
  insumos: Insumo[];
  usuarioId: string;
}

export default function AjusteRapidoModal({
  abierto,
  onClose,
  zona,
  insumos,
  usuarioId,
}: AjusteRapidoModalProps) {
  const [insumoId, setInsumoId] = useState("");
  const [tipo, setTipo] = useState<TipoAjuste>("descuento");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const insumoSeleccionado = insumos.find((i) => i.id === insumoId) ?? null;

  const cantidadNum = Number(cantidad);
  const cantidadValida = cantidad.trim() !== "" && Number.isFinite(cantidadNum) && cantidadNum > 0;

  // Validación de UX, no de seguridad: evita el caso más común (pedir
  // descontar más de lo que hay) antes de llegar al servidor. La
  // transacción igual protege el caso raro de que el stock haya
  // cambiado justo entre que se abrió el modal y se envió el ajuste.
  const excedeStock =
    tipo === "descuento" &&
    insumoSeleccionado !== null &&
    cantidadValida &&
    cantidadNum > insumoSeleccionado.stockActual;

  const listoParaEnviar =
    insumoSeleccionado !== null && cantidadValida && !excedeStock && motivo.trim() !== "";

  const resetFormulario = () => {
    setInsumoId("");
    setTipo("descuento");
    setCantidad("");
    setMotivo("");
    setError(null);
    setExito(false);
  };

  const cerrar = () => {
    onClose();
    // Pequeño delay no es necesario — el modal se desmonta al cerrar
    // (abierto=false), así que resetear de una vez está bien.
    resetFormulario();
  };

  const handleConfirmar = async () => {
    if (!listoParaEnviar || !insumoSeleccionado || enviando) return;

    setError(null);
    setEnviando(true);
    try {
      await registrarAjusteRapido({
        insumoId: insumoSeleccionado.id,
        zona,
        tipo,
        cantidad: cantidadNum,
        motivo,
        usuarioId,
      });
      setExito(true);
    } catch (e) {
      console.error("Error al registrar ajuste rápido:", e);
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el ajuste. Intenta de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px]"
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">Ajuste rápido</h2>
          <button
            onClick={cerrar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {exito ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" strokeWidth={1.5} />
            <p className="text-sm font-medium text-stone-900">Ajuste registrado</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={resetFormulario}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Registrar otro
              </button>
              <button
                onClick={cerrar}
                className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Insumo */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-stone-600">Insumo</span>
              <select
                value={insumoId}
                onChange={(e) => setInsumoId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Selecciona un insumo...</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.stockActual} {i.unidad})
                  </option>
                ))}
              </select>
            </label>

            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-stone-600">Tipo de ajuste</span>
              <div className="flex rounded-lg border border-stone-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setTipo("descuento")}
                  className={[
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    tipo === "descuento" ? "bg-red-600 text-white" : "text-stone-500 hover:bg-stone-50",
                  ].join(" ")}
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Descontar
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("reposicion")}
                  className={[
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    tipo === "reposicion"
                      ? "bg-emerald-600 text-white"
                      : "text-stone-500 hover:bg-stone-50",
                  ].join(" ")}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Agregar
                </button>
              </div>
            </div>

            {/* Cantidad */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-stone-600">
                Cantidad {insumoSeleccionado ? `(${insumoSeleccionado.unidad})` : ""}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className={[
                  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors",
                  "focus:border-orange-500 focus:ring-2 focus:ring-orange-100",
                  excedeStock ? "border-red-400" : "border-stone-300",
                ].join(" ")}
              />
              {excedeStock && (
                <span className="text-xs font-medium text-red-600">
                  No puedes descontar más de lo que hay en stock
                  ({insumoSeleccionado?.stockActual} {insumoSeleccionado?.unidad}).
                </span>
              )}
            </label>

            {/* Motivo */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-stone-600">Motivo</span>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_SUGERIDOS.map((sugerido) => (
                  <button
                    key={sugerido}
                    type="button"
                    onClick={() => setMotivo(sugerido)}
                    className={[
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      motivo === sugerido
                        ? "border-orange-700 bg-orange-700 text-white"
                        : "border-stone-300 text-stone-600 hover:bg-stone-50",
                    ].join(" ")}
                  >
                    {sugerido}
                  </button>
                ))}
              </div>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe el motivo del ajuste..."
                rows={2}
                className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
                {error}
              </p>
            )}

            <div className="mt-1 flex gap-3">
              <button
                onClick={cerrar}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={!listoParaEnviar || enviando}
                className={[
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                  listoParaEnviar && !enviando
                    ? "bg-orange-700 text-white hover:bg-orange-800"
                    : "cursor-not-allowed bg-stone-200 text-stone-400",
                ].join(" ")}
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar ajuste
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}