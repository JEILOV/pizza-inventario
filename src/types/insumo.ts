export type Zona = "cocina" | "salon";
export type TipoInsumo = "externo" | "interno";

export interface Insumo {
  id: string;
  nombre: string;
  zona: Zona;
  tipo: TipoInsumo;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  stockMinimoFinDeSemana: number | null;
  leadTimeDias: number;
  diasAnticipacionAlerta: number;
  rendimientoPorLote: number | null;
  loteUnidad: string;
  activo: boolean;
  actualizadoEn?: number; // Requerido por Firestore
}

// Tipo usado para enviar datos antes de que Firestore genere el ID
export type InsumoInput = Omit<Insumo, "id">;