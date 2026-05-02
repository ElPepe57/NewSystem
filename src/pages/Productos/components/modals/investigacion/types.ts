/**
 * Tipos del Modal Investigación Completo
 *
 * Mockups: 24, 25, 26, 27
 * Estos tipos son la API pública del modal — el caller le pasa los datos ya estructurados.
 */

export interface ProveedorInvestigacion {
  id: string;
  ranking: number;                // 1, 2, 3...
  nombre: string;                 // "SkinTech Korea"
  ubicacion?: string;             // "Korea", "USA", etc.
  esTopEleccion?: boolean;        // ranking 1
  rating?: number;                // 0..5 (estrellas)
  ocsHistoricas?: number;
  ultimaOC?: string;              // "15 abril 2026"
  notas?: string;
  costoUnidadUSD: number;         // 38.50
  leadTimeDias: number;           // 22
  minOrdenUSD?: number;
  formaPago?: string;             // "PayPal · 30/70"
  ctruEstimadoPEN?: number;       // 137
  margenProyectadoPct?: number;   // 52
  sinStock?: boolean;
}

export interface CompetidorInvestigacion {
  id: string;
  iniciales: string;              // "JE", "DA"
  nombre: string;
  url?: string;
  ubicacion?: string;
  precioPEN: number;
  variacionPct?: number;          // -5.6, +12.3
  porcentajeVsTuPrecio?: number;  // 94, 105 (% del tu precio)
  tendencia30d: 'sube' | 'baja' | 'estable';
  variacionTendenciaPct?: number; // 8 (para "+8% subió")
  stock?: number;
  esTu?: boolean;                 // fila highlight "TÚ"
  colorAvatar?: 'emerald' | 'indigo' | 'rose' | 'purple' | 'amber' | 'slate';
}

export interface CriterioDecision {
  key: string;
  label: string;
  icon: 'dollar' | 'users' | 'award' | 'trending' | 'alert';
  score: number;                  // 0..10
  etiqueta: string;               // "Excelente", "Alta", "Bajo · 24m vida"
  semaforo: 'emerald' | 'amber' | 'rose';
}

export interface DecisionInvestigacion {
  recomendacion: 'importar' | 'descartar' | 'evaluar';
  precioSugeridoPEN: number;
  costoUnitarioPEN: number;
  margenBrutoPct: number;
  margenBrutoPEN: number;
  breakEvenUds: number;
  proveedorPrincipalId?: string;
  stockInicialSugerido?: number;
  resumen: string;
  scoreGlobal: number;            // 0..10
  criterios: CriterioDecision[];
  consideraciones?: string[];     // 2-5 alertas/notas
}

export interface AlertaInvestigacion {
  id: string;
  tipo: 'precio_competencia' | 'stock_proveedor' | 'margen' | 'otro';
  mensaje: string;
}

export interface InvestigacionPayload {
  productoId: string;
  productoNombre: string;
  productoSku: string;
  productoMarca?: string;
  ultimaActualizacion?: string;   // "12 abril 2026"
  hace?: string;                  // "20 días"
  alertas: AlertaInvestigacion[];
  proveedores: ProveedorInvestigacion[];
  competidores: CompetidorInvestigacion[];
  decision: DecisionInvestigacion;
}
