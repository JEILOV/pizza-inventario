"use client";

import { useMemo } from "react";
import { AlertTriangle, MessageCircle } from "lucide-react";
import type { Insumo, TipoInsumo } from "@/types/insumo";
import { calcularEstado, getStockMinimoVigente } from "@/lib/reglasInventario";

interface AlertasCompraProps {
  insumos: Insumo[];
  /** Qué tipo de insumos filtrar en este panel — cada rol solo ve el
   *  tipo del que es responsable de avisar (ver nota más abajo). */
  tipo: TipoInsumo;
  /** Título del panel, ej. "Alertas de compra" o "Alertas de preparación". */
  titulo: string;
  /** Texto del botón que abre WhatsApp, ej. "Pedir insumos externos a Gerencia". */
  textoBoton: string;
  /** Primera línea del mensaje de WhatsApp generado. Si no se pasa, se
   *  usa un texto por defecto acorde al `tipo`. */
  mensajeWhatsApp?: string;
  /** Subtítulo bajo el título del panel. Si no se pasa, se usa un texto
   *  genérico por defecto. */
  subtitulo?: string;
}

const ETIQUETA_ZONA: Record<Insumo["zona"], string> = {
  cocina: "Cocina",
  salon: "Salón",
};

// Mensaje de WhatsApp por defecto según a quién le corresponde actuar:
// externo → el empleado le pide a Gerencia que compre; interno → el
// admin le recuerda al equipo que prepare.
const MENSAJE_WHATSAPP_POR_DEFECTO: Record<TipoInsumo, string> = {
  externo: "Hola, necesitamos pedir estos insumos externos para Pizza Republic:",
  interno: "Hola equipo, hay que preparar estos insumos internos para Pizza Republic:",
};

/**
 * Panel de alertas de stock bajo mínimo, filtrado por `tipo` de insumo.
 *
 * Responsabilidad de negocio (por qué se filtra por tipo y no se
 * muestra todo junto, como antes): los insumos "externos" (se compran
 * hechos) son responsabilidad de Gerencia/Admin comprarlos, así que son
 * los empleados de Cocina/Salón quienes deben avisar que faltan — ellos
 * ven el panel de "externo". Los insumos "internos" (se preparan en el
 * local: masas, salsas) son responsabilidad del propio equipo de
 * producirlos, así que es el Admin quien necesita recordárselo — el
 * Admin ve el panel de "interno". Cada rol ve el panel del tipo que
 * OTRO debe resolver, nunca ambos a la vez, para no duplicar alertas ni
 * mezclar responsabilidades en la misma pantalla.
 *
 * Nota de diseño: el mínimo "vigente" respeta `stockMinimoFinDeSemana`
 * (viernes a domingo) igual que el semáforo del resto de la app —
 * reutiliza `calcularEstado`/`getStockMinimoVigente` de
 * `lib/reglasInventario` en vez de comparar contra el `stockMinimo`
 * base a secas, para no tener dos definiciones de "bajo mínimo"
 * viviendo en paralelo (una en ZoneDashboard, otra acá).
 *
 * Todo client-side: no hay Cloud Function ni backend (plan Spark).
 * El botón arma el texto y abre un link `wa.me/?text=...` — WhatsApp
 * se encarga de que el usuario elija a quién se lo manda.
 */
export default function AlertasCompra({
  insumos,
  tipo,
  titulo,
  textoBoton,
  mensajeWhatsApp,
  subtitulo = "Hoy están en cero o por debajo de lo necesario. Conviene resolverlo cuanto antes.",
}: AlertasCompraProps) {
  const hoy = useMemo(() => new Date(), []);

  const enAlerta = useMemo(
    () =>
      insumos
        .filter((i) => i.activo)
        .filter((i) => i.tipo === tipo)
        .filter((i) => calcularEstado(i, hoy) === "rojo")
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [insumos, tipo, hoy]
  );

  if (enAlerta.length === 0) return null;

  function generarPedidoWhatsApp() {
    const lineas = enAlerta.map(
      (i) => `- ${i.nombre} (Quedan ${i.stockActual} ${i.unidad})`
    );
    const encabezado = mensajeWhatsApp ?? MENSAJE_WHATSAPP_POR_DEFECTO[tipo];
    const texto = `${encabezado}\n${lineas.join("\n")}`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-red-600" strokeWidth={2} />
          <div>
            <h2 className="text-sm font-semibold text-red-900">
              {titulo} — {enAlerta.length}{" "}
              {enAlerta.length === 1 ? "insumo" : "insumos"} por debajo del mínimo
            </h2>
            <p className="text-sm text-red-700/80">{subtitulo}</p>
          </div>
        </div>

        <button
          onClick={generarPedidoWhatsApp}
          className="flex w-full flex-none items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover sm:w-auto"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
          {textoBoton}
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {enAlerta.map((insumo) => (
          <li
            key={insumo.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-white px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">{insumo.nombre}</p>
              <p className="text-xs text-stone-500">{ETIQUETA_ZONA[insumo.zona]}</p>
            </div>
            <div className="flex-none text-right">
              <p className="text-sm font-semibold text-red-700">
                {insumo.stockActual} {insumo.unidad}
              </p>
              <p className="text-xs text-stone-400">
                mín. {getStockMinimoVigente(insumo, hoy)} {insumo.unidad}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}