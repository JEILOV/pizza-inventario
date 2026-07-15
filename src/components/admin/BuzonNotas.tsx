"use client";

import { useMemo, useState } from "react";
import {
  Inbox,
  Loader2,
  AlertTriangle,
  MessageSquareText,
  MessageCircle,
  ClipboardList,
  Minus,
  Plus,
  ChefHat,
  Store,
  Trash2,
} from "lucide-react";
import { useBuzonNotas } from "@/hooks/useBuzonNotas";
import { useInsumos } from "@/hooks/useInsumos";
import type { EventoBuzon } from "@/services/notasService";
import type { Zona } from "@/types/insumo";

// ─────────────────────────────────────────────────────────────
// Utilidades locales de presentación
// ─────────────────────────────────────────────────────────────

function formatearTiempoTranscurrido(desde: Date, hasta: Date) {
  const minutos = Math.round((hasta.getTime() - desde.getTime()) / 60000);
  if (minutos < 1) return "hace instantes";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias}d`;
}

function formatearFechaCompleta(fecha: Date) {
  return fecha.toLocaleString("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// true si el evento trae algo que valga la pena reenviar — el motivo de
// un ajuste siempre existe (es obligatorio en el modal), pero un cierre
// puede no tener ninguna nota cargada.
function tieneNotaParaReenviar(evento: EventoBuzon): boolean {
  if (evento.origen === "ajuste") return true;
  return Boolean(evento.notaGeneral) || evento.notasDeItems.length > 0;
}

// Arma el texto plano que se manda por WhatsApp — mismo contenido que ya
// se ve en la tarjeta, sin inventar datos que el evento no tenga.
function construirMensajeWhatsApp(
  evento: EventoBuzon,
  nombreUsuario: string,
  nombresInsumos: Record<string, string>
): string {
  const encabezado = `Nota de Pizza Republic (${ETIQUETA_ZONA[evento.zona]})`;

  if (evento.origen === "ajuste") {
    const verbo = evento.tipoAjuste === "descuento" ? "Se descontaron" : "Se agregaron";
    return [
      encabezado,
      `${verbo} ${evento.cantidad} de ${evento.insumoNombre}`,
      `Motivo: ${evento.motivo}`,
      `Registrado por ${nombreUsuario}`,
    ].join("\n");
  }

  const lineas = [encabezado, `Cierre de turno — ${evento.turno}`];
  if (evento.notaGeneral) {
    lineas.push(`Nota general: ${evento.notaGeneral}`);
  }
  for (const item of evento.notasDeItems) {
    const nombreInsumo = nombresInsumos[item.insumoId] ?? "Insumo";
    lineas.push(`- ${nombreInsumo}: ${item.nota}`);
  }
  lineas.push(`Registrado por ${nombreUsuario}`);
  return lineas.join("\n");
}

function abrirWhatsApp(texto: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

const ETIQUETA_ZONA: Record<Zona, string> = {
  cocina: "Cocina",
  salon: "Salón",
};

const ESTILO_ZONA: Record<Zona, string> = {
  cocina: "bg-orange-50 text-orange-700",
  salon: "bg-blue-50 text-blue-700",
};

const ICONO_ZONA: Record<Zona, React.ReactNode> = {
  cocina: <ChefHat className="h-3 w-3" strokeWidth={2} />,
  salon: <Store className="h-3 w-3" strokeWidth={2} />,
};

type FiltroZona = "todas" | Zona;

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

export default function BuzonNotas() {
  const { eventos, nombresUsuarios, cargando, error, limpiando, limpiarBuzon } = useBuzonNotas();
  const { insumos } = useInsumos();
  const [filtroZona, setFiltroZona] = useState<FiltroZona>("todas");

  const nombresInsumos = useMemo(
    () => Object.fromEntries(insumos.map((i) => [i.id, i.nombre])),
    [insumos]
  );

  const eventosFiltrados = useMemo(() => {
    if (filtroZona === "todas") return eventos;
    return eventos.filter((e) => e.zona === filtroZona);
  }, [eventos, filtroZona]);

  // Limpia justo lo que se está viendo (respeta el filtro de zona
  // activo): si el admin filtró a "Cocina" y limpia, solo se borran las
  // notas de Cocina, no las de Salón que en ese momento están ocultas.
  async function handleLimpiarBuzon() {
    if (eventosFiltrados.length === 0) return;
    const confirmado = window.confirm(
      "¿Estás seguro de eliminar todas las notas de este buzón? Esta acción no se puede deshacer."
    );
    if (!confirmado) return;
    await limpiarBuzon(eventosFiltrados);
  }

  const ahora = new Date();

  if (cargando) {
    return (
      <div className="mx-auto flex min-h-[300px] w-full max-w-3xl items-center justify-center gap-2 px-4 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando buzón de notas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[300px] w-full max-w-3xl flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500" strokeWidth={1.75} />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Inbox className="h-6 w-6 text-stone-700" strokeWidth={1.75} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Buzón de notas
            </h1>
            <p className="text-sm text-stone-500">
              Ajustes rápidos y cierres de turno con observaciones del equipo.
            </p>
          </div>
        </div>

        {/* Filtro por zona */}
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5">
          {(["todas", "cocina", "salon"] as const).map((valor) => (
            <button
              key={valor}
              onClick={() => setFiltroZona(valor)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filtroZona === valor
                  ? "bg-brand text-white"
                  : "text-stone-500 hover:bg-stone-50",
              ].join(" ")}
            >
              {valor === "todas" ? "Todas" : ETIQUETA_ZONA[valor]}
            </button>
          ))}
        </div>
      </div>

      {/* Acción: limpiar lo que se está viendo actualmente */}
      {eventosFiltrados.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleLimpiarBuzon}
            disabled={limpiando}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {limpiando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {limpiando ? "Limpiando..." : "Limpiar buzón"}
          </button>
        </div>
      )}

      {/* Timeline */}
      {eventosFiltrados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-400">
          Todavía no hay observaciones registradas
          {filtroZona !== "todas" ? ` en ${ETIQUETA_ZONA[filtroZona]}` : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {eventosFiltrados.map((evento) => (
            <TarjetaEvento
              key={`${evento.origen}-${evento.id}`}
              evento={evento}
              ahora={ahora}
              nombreUsuario={nombresUsuarios[evento.usuarioId] ?? evento.usuarioId}
              nombresInsumos={nombresInsumos}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────

function TarjetaEvento({
  evento,
  ahora,
  nombreUsuario,
  nombresInsumos,
}: {
  evento: EventoBuzon;
  ahora: Date;
  nombreUsuario: string;
  nombresInsumos: Record<string, string>;
}) {
  const esAjuste = evento.origen === "ajuste";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      {/* Fila superior: tipo de evento + zona + fecha */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconoTipoEvento evento={evento} />
          <span className="text-sm font-semibold text-stone-900">
            {esAjuste ? "Ajuste rápido" : "Cierre de turno"}
          </span>
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              ESTILO_ZONA[evento.zona],
            ].join(" ")}
          >
            {ICONO_ZONA[evento.zona]}
            {ETIQUETA_ZONA[evento.zona]}
          </span>
        </div>
        <span
          className="text-xs text-stone-400"
          title={formatearFechaCompleta(evento.fechaHora)}
        >
          {formatearTiempoTranscurrido(evento.fechaHora, ahora)}
        </span>
      </div>

      {/* Cuerpo: contenido específico del tipo de evento */}
      <div className="mt-3">
        {esAjuste ? (
          <ContenidoAjuste evento={evento} />
        ) : (
          <ContenidoCierre evento={evento} nombresInsumos={nombresInsumos} />
        )}
      </div>

      {/* Pie: quién lo hizo + reenviar por WhatsApp */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-stone-400">
          Registrado por <span className="font-medium text-stone-600">{nombreUsuario}</span>
        </p>

        {tieneNotaParaReenviar(evento) && (
          <button
            onClick={() =>
              abrirWhatsApp(construirMensajeWhatsApp(evento, nombreUsuario, nombresInsumos))
            }
            className="flex flex-none items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
            Reenviar por WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}

function IconoTipoEvento({ evento }: { evento: EventoBuzon }) {
  if (evento.origen === "ajuste") {
    const esDescuento = evento.tipoAjuste === "descuento";
    return (
      <span
        className={[
          "flex h-6 w-6 items-center justify-center rounded-md",
          esDescuento ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
        ].join(" ")}
      >
        {esDescuento ? (
          <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
        ) : (
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        )}
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-100 text-stone-600">
      <ClipboardList className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  );
}

function ContenidoAjuste({
  evento,
}: {
  evento: Extract<EventoBuzon, { origen: "ajuste" }>;
}) {
  const verbo = evento.tipoAjuste === "descuento" ? "Se descontaron" : "Se agregaron";

  return (
    <div>
      <p className="text-sm text-stone-700">
        {verbo}{" "}
        <span className="font-semibold text-stone-900">{evento.cantidad}</span> de{" "}
        <span className="font-medium text-stone-900">{evento.insumoNombre}</span>
      </p>
      <NotaResaltada texto={evento.motivo} />
    </div>
  );
}

function ContenidoCierre({
  evento,
  nombresInsumos,
}: {
  evento: Extract<EventoBuzon, { origen: "cierre" }>;
  nombresInsumos: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-stone-700">
        Turno de <span className="font-medium text-stone-900">{evento.turno}</span>
      </p>

      {evento.notaGeneral && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-stone-500">
            <MessageSquareText className="h-3 w-3" strokeWidth={2} />
            Nota general
          </p>
          <NotaResaltada texto={evento.notaGeneral} />
        </div>
      )}

      {evento.notasDeItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1 text-xs font-medium text-stone-500">
            <MessageSquareText className="h-3 w-3" strokeWidth={2} />
            Notas por insumo
          </p>
          {evento.notasDeItems.map((item, i) => (
            <div key={`${item.insumoId}-${i}`} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-stone-600">
                {nombresInsumos[item.insumoId] ?? "Insumo"}
              </span>
              <NotaResaltada texto={item.nota} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotaResaltada({ texto }: { texto: string }) {
  return (
    <p className="mt-1 rounded-lg bg-amber-50/70 px-3 py-2 text-sm text-stone-700">
      &ldquo;{texto}&rdquo;
    </p>
  );
}