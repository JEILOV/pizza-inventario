"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  X,
  Search,
  Soup,
  Store,
  Boxes,
  ChefHat,
  Save,
  ToggleLeft,
  ToggleRight,
  Info,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useInsumos } from "@/hooks/useInsumos";
import type { Zona, TipoInsumo, Insumo } from "@/types/insumo";

// Estado editable del formulario — todo como string para inputs controlados,
// se castea a número/null recién al guardar.
interface FormState {
  nombre: string;
  zona: Zona;
  tipo: TipoInsumo;
  unidad: string;
  stockActual: string;
  stockMinimo: string;
  stockMinimoFinDeSemana: string;
  leadTimeDias: string;
  diasAnticipacionAlerta: string;
  rendimientoPorLote: string;
  loteUnidad: string;
}

const FORM_VACIO: FormState = {
  nombre: "",
  zona: "cocina",
  tipo: "externo",
  unidad: "",
  stockActual: "",
  stockMinimo: "",
  stockMinimoFinDeSemana: "",
  leadTimeDias: "",
  diasAnticipacionAlerta: "",
  rendimientoPorLote: "",
  loteUnidad: "",
};

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

type FiltroZona = "todas" | Zona;
type FiltroTipo = "todos" | TipoInsumo;

export default function AdminInsumosCRUD() {
  const { insumos, cargando, error, crear, actualizar, toggleActivo: toggleActivoRemoto } =
    useInsumos();
  const [busqueda, setBusqueda] = useState("");
  const [filtroZona, setFiltroZona] = useState<FiltroZona>("todas");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});

  const insumosFiltrados = useMemo(() => {
    return insumos.filter((i) => {
      if (filtroZona !== "todas" && i.zona !== filtroZona) return false;
      if (filtroTipo !== "todos" && i.tipo !== filtroTipo) return false;
      if (busqueda.trim() && !i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
        return false;
      return true;
    });
  }, [insumos, filtroZona, filtroTipo, busqueda]);

  // ── Abrir panel ──
  const abrirCreacion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setErrores({});
    setPanelAbierto(true);
  };

  const abrirEdicion = (insumo: Insumo) => {
    setEditandoId(insumo.id);
    setForm({
      nombre: insumo.nombre,
      zona: insumo.zona,
      tipo: insumo.tipo,
      unidad: insumo.unidad,
      stockActual: String(insumo.stockActual),
      stockMinimo: String(insumo.stockMinimo),
      stockMinimoFinDeSemana:
        insumo.stockMinimoFinDeSemana === null ? "" : String(insumo.stockMinimoFinDeSemana),
      leadTimeDias: String(insumo.leadTimeDias),
      diasAnticipacionAlerta: String(insumo.diasAnticipacionAlerta),
      rendimientoPorLote:
        insumo.rendimientoPorLote === null ? "" : String(insumo.rendimientoPorLote),
      loteUnidad: insumo.loteUnidad,
    });
    setErrores({});
    setPanelAbierto(true);
  };

  const cerrarPanel = () => setPanelAbierto(false);

  // ── Guardar ──
  const validar = (f: FormState) => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!f.nombre.trim()) e.nombre = "El nombre es obligatorio.";
    if (!f.unidad.trim()) e.unidad = "Define una unidad de medida.";
    if (f.stockMinimo.trim() === "" || Number(f.stockMinimo) < 0)
      e.stockMinimo = "Ingresa un mínimo válido (0 o mayor).";
    if (f.stockActual.trim() === "" || Number(f.stockActual) < 0)
      e.stockActual = "Ingresa un stock inicial válido.";
    if (
      f.stockMinimoFinDeSemana.trim() !== "" &&
      Number(f.stockMinimoFinDeSemana) < Number(f.stockMinimo || 0)
    ) {
      e.stockMinimoFinDeSemana =
        "El mínimo de fin de semana no debería ser menor al mínimo normal.";
    }
    if (f.tipo === "interno" && f.rendimientoPorLote.trim() !== "" && !f.loteUnidad.trim()) {
      e.loteUnidad = "Describe la unidad del lote (ej. 'bolitas por tanda').";
    }
    return e;
  };

  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const e = validar(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    const datos = {
      nombre: form.nombre.trim(),
      zona: form.zona,
      tipo: form.tipo,
      unidad: form.unidad.trim(),
      stockActual: Number(form.stockActual),
      stockMinimo: Number(form.stockMinimo),
      stockMinimoFinDeSemana:
        form.stockMinimoFinDeSemana.trim() === "" ? null : Number(form.stockMinimoFinDeSemana),
      leadTimeDias: form.leadTimeDias.trim() === "" ? 0 : Number(form.leadTimeDias),
      diasAnticipacionAlerta:
        form.diasAnticipacionAlerta.trim() === "" ? 0 : Number(form.diasAnticipacionAlerta),
      rendimientoPorLote:
        form.tipo === "interno" && form.rendimientoPorLote.trim() !== ""
          ? Number(form.rendimientoPorLote)
          : null,
      loteUnidad: form.tipo === "interno" ? form.loteUnidad.trim() : "",
      activo: true,
    };

    setGuardando(true);
    try {
      if (editandoId) {
        await actualizar(editandoId, datos);
      } else {
        await crear(datos);
      }
      // No hace falta actualizar estado local: el listener onSnapshot
      // de useInsumos recibe el cambio y re-renderiza solo.
      setPanelAbierto(false);
    } catch {
      setErrores({ nombre: "No se pudo guardar. Revisa tu conexión e intenta de nuevo." });
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (id: string, activoActual: boolean) => {
    try {
      await toggleActivoRemoto(id, !activoActual);
    } catch {
      // Silencioso a propósito: si falla, el listener simplemente no
      // refleja el cambio y el admin puede reintentar el toggle.
      console.error("No se pudo cambiar el estado del insumo", id);
    }
  };

  const actualizarCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  if (cargando) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 py-16 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando insumos...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2} />
          {error}
        </div>
      )}

      {/* Encabezado */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Insumos
          </h1>
          <p className="text-sm text-stone-500">
            Crea y configura las reglas logísticas de cada insumo.
          </p>
        </div>
        <button
          onClick={abrirCreacion}
          className="flex w-fit items-center gap-2 rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-800"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Nuevo insumo
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar insumo..."
            className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FiltroPill
            opciones={[
              { valor: "todas", label: "Todas las zonas" },
              { valor: "cocina", label: "Cocina" },
              { valor: "salon", label: "Salón" },
            ]}
            valor={filtroZona}
            onChange={(v) => setFiltroZona(v as FiltroZona)}
          />
          <FiltroPill
            opciones={[
              { valor: "todos", label: "Todos los tipos" },
              { valor: "interno", label: "Interno" },
              { valor: "externo", label: "Externo" },
            ]}
            valor={filtroTipo}
            onChange={(v) => setFiltroTipo(v as FiltroTipo)}
          />
        </div>
      </div>

      {/* Tabla — desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Zona</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Mín. L-J</th>
              <th className="px-4 py-3">Mín. Vie-Dom</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {insumosFiltrados.map((insumo) => (
              <tr
                key={insumo.id}
                className={[
                  "border-b border-stone-100 last:border-0",
                  insumo.activo ? "" : "opacity-50",
                ].join(" ")}
              >
                <td className="px-4 py-3 font-medium text-stone-900">{insumo.nombre}</td>
                <td className="px-4 py-3">
                  <BadgeZona zona={insumo.zona} />
                </td>
                <td className="px-4 py-3">
                  <BadgeTipo tipo={insumo.tipo} />
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {insumo.stockActual} <span className="text-stone-400">{insumo.unidad}</span>
                </td>
                <td className="px-4 py-3 text-stone-600">{insumo.stockMinimo}</td>
                <td className="px-4 py-3 text-stone-600">
                  {insumo.stockMinimoFinDeSemana ?? (
                    <span className="text-stone-400">= L-J</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActivo(insumo.id, insumo.activo)}
                    className={[
                      "inline-flex items-center gap-1.5 text-xs font-medium",
                      insumo.activo ? "text-emerald-600" : "text-stone-400",
                    ].join(" ")}
                  >
                    {insumo.activo ? (
                      <ToggleRight className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <ToggleLeft className="h-4 w-4" strokeWidth={2} />
                    )}
                    {insumo.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => abrirEdicion(insumo)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {insumosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-stone-400">
                  No hay insumos que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — móvil */}
      <div className="flex flex-col gap-3 md:hidden">
        {insumosFiltrados.map((insumo) => (
          <div
            key={insumo.id}
            className={[
              "rounded-xl border border-stone-200 bg-white p-4 shadow-sm",
              insumo.activo ? "" : "opacity-50",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-stone-900">{insumo.nombre}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <BadgeZona zona={insumo.zona} />
                  <BadgeTipo tipo={insumo.tipo} />
                </div>
              </div>
              <button
                onClick={() => abrirEdicion(insumo)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-stone-400">Stock</p>
                <p className="font-medium text-stone-700">
                  {insumo.stockActual} {insumo.unidad}
                </p>
              </div>
              <div>
                <p className="text-stone-400">Mín. L-J</p>
                <p className="font-medium text-stone-700">{insumo.stockMinimo}</p>
              </div>
              <div>
                <p className="text-stone-400">Mín. Vie-Dom</p>
                <p className="font-medium text-stone-700">
                  {insumo.stockMinimoFinDeSemana ?? "= L-J"}
                </p>
              </div>
            </div>

            <button
              onClick={() => toggleActivo(insumo.id, insumo.activo)}
              className={[
                "mt-3 inline-flex items-center gap-1.5 text-xs font-medium",
                insumo.activo ? "text-emerald-600" : "text-stone-400",
              ].join(" ")}
            >
              {insumo.activo ? (
                <ToggleRight className="h-4 w-4" strokeWidth={2} />
              ) : (
                <ToggleLeft className="h-4 w-4" strokeWidth={2} />
              )}
              {insumo.activo ? "Activo" : "Inactivo"}
            </button>
          </div>
        ))}
        {insumosFiltrados.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            No hay insumos que coincidan con el filtro.
          </p>
        )}
      </div>

      {/* Slide-over: formulario de creación/edición */}
      {panelAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <button
            aria-label="Cerrar panel"
            onClick={cerrarPanel}
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[1px]"
          />

          {/* Panel */}
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-base font-semibold text-stone-900">
                {editandoId ? "Editar insumo" : "Nuevo insumo"}
              </h2>
              <button
                onClick={cerrarPanel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="flex flex-col gap-5">
                {/* Nombre */}
                <Campo label="Nombre" error={errores.nombre}>
                  <input
                    value={form.nombre}
                    onChange={(e) => actualizarCampo("nombre", e.target.value)}
                    placeholder="Ej. Harina, Cajas familiares"
                    className={inputClase(!!errores.nombre)}
                  />
                </Campo>

                {/* Zona y Tipo */}
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Zona">
                    <SegmentedControl
                      opciones={[
                        { valor: "cocina", label: "Cocina", icono: <Soup className="h-3.5 w-3.5" /> },
                        { valor: "salon", label: "Salón", icono: <Store className="h-3.5 w-3.5" /> },
                      ]}
                      valor={form.zona}
                      onChange={(v) => actualizarCampo("zona", v as Zona)}
                    />
                  </Campo>
                  <Campo label="Tipo">
                    <SegmentedControl
                      opciones={[
                        { valor: "externo", label: "Externo", icono: <Boxes className="h-3.5 w-3.5" /> },
                        { valor: "interno", label: "Interno", icono: <ChefHat className="h-3.5 w-3.5" /> },
                      ]}
                      valor={form.tipo}
                      onChange={(v) => actualizarCampo("tipo", v as TipoInsumo)}
                    />
                  </Campo>
                </div>

                {/* Unidad y stock actual */}
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Unidad de medida" error={errores.unidad}>
                    <input
                      value={form.unidad}
                      onChange={(e) => actualizarCampo("unidad", e.target.value)}
                      placeholder="kg, sacos, unidades..."
                      className={inputClase(!!errores.unidad)}
                    />
                  </Campo>
                  <Campo label="Stock inicial" error={errores.stockActual}>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.stockActual}
                      onChange={(e) => actualizarCampo("stockActual", e.target.value)}
                      placeholder="0"
                      className={inputClase(!!errores.stockActual)}
                    />
                  </Campo>
                </div>

                {/* Reglas de stock mínimo */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Reglas de stock mínimo
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Lunes a jueves" error={errores.stockMinimo}>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={form.stockMinimo}
                        onChange={(e) => actualizarCampo("stockMinimo", e.target.value)}
                        placeholder="0"
                        className={inputClase(!!errores.stockMinimo)}
                      />
                    </Campo>
                    <Campo label="Viernes a domingo" error={errores.stockMinimoFinDeSemana}>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={form.stockMinimoFinDeSemana}
                        onChange={(e) => actualizarCampo("stockMinimoFinDeSemana", e.target.value)}
                        placeholder="Igual al mínimo normal"
                        className={inputClase(!!errores.stockMinimoFinDeSemana)}
                      />
                    </Campo>
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 flex-none" strokeWidth={1.75} />
                    Si dejas vacío el mínimo de fin de semana, el sistema usa el mismo valor de
                    lunes a jueves.
                  </p>
                </div>

                {/* Lead time y anticipación */}
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Lead time (días)">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.leadTimeDias}
                      onChange={(e) => actualizarCampo("leadTimeDias", e.target.value)}
                      placeholder="0"
                      className={inputClase(false)}
                    />
                  </Campo>
                  <Campo label="Días de anticipación">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.diasAnticipacionAlerta}
                      onChange={(e) => actualizarCampo("diasAnticipacionAlerta", e.target.value)}
                      placeholder="0"
                      className={inputClase(false)}
                    />
                  </Campo>
                </div>

                {/* Rendimiento por lote — solo si es interno */}
                {form.tipo === "interno" && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-700">
                      <ChefHat className="h-3.5 w-3.5" strokeWidth={2} />
                      Producción interna (opcional)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Campo label="Rendimiento por lote">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={form.rendimientoPorLote}
                          onChange={(e) => actualizarCampo("rendimientoPorLote", e.target.value)}
                          placeholder="Ej. 20"
                          className={inputClase(false)}
                        />
                      </Campo>
                      <Campo label="Descripción del lote" error={errores.loteUnidad}>
                        <input
                          value={form.loteUnidad}
                          onChange={(e) => actualizarCampo("loteUnidad", e.target.value)}
                          placeholder="Ej. bolitas por tanda"
                          className={inputClase(!!errores.loteUnidad)}
                        />
                      </Campo>
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-orange-700/80">
                      <Info className="mt-0.5 h-3.5 w-3.5 flex-none" strokeWidth={1.75} />
                      Solo es un indicador para el cocinero (ej. "faltan ~3 tandas"). No descuenta
                      insumos automáticamente.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-stone-200 px-5 py-4">
              <button
                onClick={cerrarPanel}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={2} />
                )}
                {editandoId ? "Guardar cambios" : "Crear insumo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes de UI
// ─────────────────────────────────────────────────────────────

function inputClase(conError: boolean) {
  return [
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors",
    "focus:border-orange-500 focus:ring-2 focus:ring-orange-100",
    conError ? "border-red-400" : "border-stone-300",
  ].join(" ");
}

function Campo({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

function SegmentedControl<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; label: string; icono?: React.ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-stone-300 bg-white p-0.5">
      {opciones.map((op) => (
        <button
          key={op.valor}
          type="button"
          onClick={() => onChange(op.valor)}
          className={[
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            valor === op.valor
              ? "bg-orange-700 text-white"
              : "text-stone-500 hover:bg-stone-50",
          ].join(" ")}
        >
          {op.icono}
          {op.label}
        </button>
      ))}
    </div>
  );
}

function FiltroPill({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((op) => (
        <button
          key={op.valor}
          onClick={() => onChange(op.valor)}
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            valor === op.valor
              ? "border-orange-700 bg-orange-700 text-white"
              : "border-stone-300 text-stone-600 hover:bg-stone-50",
          ].join(" ")}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}

function BadgeZona({ zona }: { zona: Zona }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        zona === "cocina" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700",
      ].join(" ")}
    >
      {zona === "cocina" ? (
        <Soup className="h-3 w-3" strokeWidth={2} />
      ) : (
        <Store className="h-3 w-3" strokeWidth={2} />
      )}
      {zona === "cocina" ? "Cocina" : "Salón"}
    </span>
  );
}

function BadgeTipo({ tipo }: { tipo: TipoInsumo }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tipo === "interno" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600",
      ].join(" ")}
    >
      {tipo === "interno" ? (
        <ChefHat className="h-3 w-3" strokeWidth={2} />
      ) : (
        <Boxes className="h-3 w-3" strokeWidth={2} />
      )}
      {tipo === "interno" ? "Interno" : "Externo"}
    </span>
  );
}