/**
 * Tipos del pipeline de estados de Compras (Borrador → Confirmada → En Despacho → Completada).
 * Extraídos de PipelineCompras.tsx (componente visual retirado · dead-code, F0 rework Compras).
 * Consumidos por la página OrdenesCompra para el mapeo de filtros por etapa.
 */
export type EstadoPipelineCompras =
  | 'borrador'
  | 'confirmada'
  | 'en_despacho'
  | 'completada';

export interface PipelineComprasStage {
  id: EstadoPipelineCompras;
  label: string;
  count: number;
}
