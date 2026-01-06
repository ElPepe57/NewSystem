# Plan de Implementación: Analytics Individuales para Maestros

## Resumen Ejecutivo

Este documento detalla la implementación de servicios de analytics individuales para **Almacenes**, **Competidores**, **Transportistas** y **Canales de Venta**, siguiendo el patrón establecido por los analytics de Clientes, Marcas y Proveedores.

---

## Estado Actual vs. Objetivo

| Entidad | Estado Actual | Objetivo |
|---------|---------------|----------|
| **Clientes** | ✅ 100% - Referencia | Mantener |
| **Marcas** | ✅ 100% - Referencia | Mantener |
| **Proveedores** | ✅ 100% - Referencia | Mantener |
| **Almacenes** | 80% - Falta analytics service | 100% |
| **Competidores** | 60% - Sin analytics service | 100% |
| **Transportistas** | 50% - Sin stats ni analytics | 100% |
| **Canales de Venta** | 40% - Sin stats ni analytics | 100% |

---

## Arquitectura de Analytics (Patrón Existente)

```
┌─────────────────────────────────────────────────────────────────┐
│                         PÁGINA MAESTROS                          │
│  (8 Tabs: Resumen, Clientes, Marcas, Proveedores, Almacenes,    │
│   Competidores, Transportistas, Canales)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENTE DE GESTIÓN                         │
│  (Ej: AlmacenesLogistica.tsx)                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ SubTabs: Lista | Dashboard | [Tab Específico]               ││
│  │                                                              ││
│  │ • Lista: Tabla + Filtros + Acciones                         ││
│  │ • Dashboard: KPIs + Gráficos + Alertas                      ││
│  │ • Tab Específico: Análisis especializado                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│         STORE            │    │    MODAL DE DETALLE      │
│  (Zustand)               │    │  (Analytics Individual)  │
│  • fetchEntidades()      │    │  ┌────────────────────┐  │
│  • fetchStats()          │    │  │ 5 Tabs:            │  │
│  • filtros               │    │  │ • Resumen          │  │
│  • acciones CRUD         │    │  │ • Historial        │  │
└──────────────────────────┘    │  │ • Analytics        │  │
            │                   │  │ • Comparativa      │  │
            ▼                   │  │ • Predicciones     │  │
┌──────────────────────────┐    │  └────────────────────┘  │
│     SERVICE BÁSICO       │    └──────────────────────────┘
│  (CRUD + Stats)          │                │
│  • getAll(), getById()   │                ▼
│  • create(), update()    │    ┌──────────────────────────┐
│  • getStats()            │    │   ANALYTICS SERVICE      │
└──────────────────────────┘    │  (Cálculos Avanzados)    │
                                │  • getAnalytics(id)      │
                                │  • calcularMetricas()    │
                                │  • generarPredicciones() │
                                │  • compararEntidades()   │
                                └──────────────────────────┘
```

---

## 1. ALMACENES Analytics

### 1.1 Archivo: `src/services/almacen.analytics.service.ts`

**Tipos a implementar:**

```typescript
// ============================================
// TIPOS PARA ANALYTICS DE ALMACENES
// ============================================

interface MovimientoAlmacen {
  id: string;
  fecha: Date;
  tipo: 'entrada' | 'salida' | 'transferencia_entrada' | 'transferencia_salida';
  cantidad: number;
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  origen?: string;  // Para transferencias
  destino?: string; // Para transferencias
  ordenCompraId?: string;
  ventaId?: string;
  transferenciaId?: string;
}

interface CapacidadHistorico {
  fecha: Date;
  capacidadTotal: number;
  capacidadUtilizada: number;
  porcentajeUtilizacion: number;
  productosUnicos: number;
  unidadesTotales: number;
}

interface RotacionProducto {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  stockActual: number;
  entradasPeriodo: number;
  salidasPeriodo: number;
  rotacionDias: number;
  valorInventarioUSD: number;
  diasSinMovimiento: number;
  tendencia: 'alta' | 'normal' | 'baja' | 'estancado';
}

interface IncidenciaAlmacen {
  id: string;
  fecha: Date;
  tipo: 'merma' | 'vencimiento' | 'danio' | 'diferencia_inventario' | 'robo';
  severidad: 'leve' | 'moderada' | 'grave';
  productoId?: string;
  cantidad?: number;
  impactoUSD?: number;
  descripcion: string;
  resuelta: boolean;
  accionCorrectiva?: string;
}

interface TransferenciaHistorial {
  id: string;
  fecha: Date;
  tipoMovimiento: 'entrada' | 'salida';
  almacenOrigenId: string;
  almacenOrigenNombre: string;
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  productos: Array<{
    productoId: string;
    sku: string;
    nombre: string;
    cantidad: number;
    valorUSD: number;
  }>;
  totalUnidades: number;
  valorTotalUSD: number;
  estado: string;
  tiempoTransito?: number; // días
}

interface MetricasViajero {
  // Solo para almacenes tipo 'viajero'
  totalViajes: number;
  viajesUltimos30Dias: number;
  viajesUltimos90Dias: number;
  proximoViaje?: Date;
  capacidadPromedioViaje: number;
  unidadesTransportadasTotal: number;
  valorTransportadoUSD: number;
  tiempoPromedioViaje: number; // días
  tasaIncidencias: number;
}

interface ComparativaAlmacen {
  almacenId: string;
  nombreAlmacen: string;
  tipo: string;
  pais: string;
  capacidadUtilizada: number;
  rotacionPromedio: number;
  valorInventarioUSD: number;
  movimientosMensuales: number;
  incidencias: number;
  evaluacion: number;
  ranking: number;
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

interface AlmacenAnalytics {
  almacen: Almacen;

  // Inventario actual
  inventarioActual: {
    productosUnicos: number;
    unidadesTotales: number;
    valorTotalUSD: number;
    valorTotalPEN: number;
    capacidadUtilizada: number;
    diasPromedioInventario: number;
  };

  // Historial de capacidad
  historialCapacidad: CapacidadHistorico[];
  tendenciaCapacidad: 'creciendo' | 'decreciendo' | 'estable';

  // Movimientos
  movimientosHistorial: MovimientoAlmacen[];
  movimientosUltimos30Dias: number;
  movimientosUltimos90Dias: number;
  promedioMovimientosDiarios: number;

  // Rotación por producto
  rotacionProductos: RotacionProducto[];
  rotacionPromedioGlobal: number;
  productosEstancados: RotacionProducto[];
  productosAltaRotacion: RotacionProducto[];

  // Transferencias
  transferenciasHistorial: TransferenciaHistorial[];
  transferenciasEnviadas: number;
  transferenciasRecibidas: number;
  balanceTransferencias: number; // positivo = más entradas

  // Incidencias
  incidencias: IncidenciaAlmacen[];
  totalIncidencias: number;
  incidenciasAbiertas: number;
  tasaIncidencia: number;
  impactoTotalIncidenciasUSD: number;

  // Métricas de viajero (solo si tipo === 'viajero')
  metricasViajero?: MetricasViajero;

  // Evaluación
  evaluacionActual: number;
  historialEvaluaciones: Array<{
    fecha: Date;
    puntaje: number;
    factores: Record<string, number>;
  }>;
  tendenciaEvaluacion: 'mejorando' | 'estable' | 'empeorando';

  // Comparativa
  comparativaAlmacenes: ComparativaAlmacen[];
  rankingGeneral: number;
  totalAlmacenes: number;

  // Alertas
  alertas: Array<{
    tipo: 'capacidad' | 'rotacion' | 'incidencia' | 'evaluacion' | 'viaje';
    severidad: 'info' | 'warning' | 'danger';
    mensaje: string;
    accionRecomendada?: string;
  }>;

  // Predicciones
  predicciones: {
    capacidadEstimada30Dias: number;
    riesgoSobrecapacidad: number;
    productosProximosVencer: number;
    valorEnRiesgoUSD: number;
  };
}
```

**Métodos a implementar:**

```typescript
class AlmacenAnalyticsService {
  // Principal
  async getAlmacenAnalytics(almacenId: string): Promise<AlmacenAnalytics>;

  // Inventario
  private async calcularInventarioActual(almacenId: string);
  private async getHistorialCapacidad(almacenId: string, dias: number);

  // Movimientos
  private async getMovimientosHistorial(almacenId: string);
  private async calcularRotacionProductos(almacenId: string);

  // Transferencias
  private async getTransferenciasHistorial(almacenId: string);
  private calcularBalanceTransferencias(transferencias: TransferenciaHistorial[]);

  // Incidencias
  private async getIncidencias(almacenId: string);
  private calcularTasaIncidencia(incidencias: IncidenciaAlmacen[], movimientos: number);

  // Viajeros
  private async calcularMetricasViajero(almacenId: string);

  // Evaluación
  private async getHistorialEvaluaciones(almacenId: string);
  private calcularTendenciaEvaluacion(historial: Array<{fecha: Date, puntaje: number}>);

  // Comparativa
  async compararAlmacenes(almacenIds?: string[]): Promise<ComparativaAlmacen[]>;

  // Alertas
  private generarAlertas(analytics: Partial<AlmacenAnalytics>);

  // Predicciones
  private calcularPredicciones(analytics: Partial<AlmacenAnalytics>);
}
```

### 1.2 KPIs para Dashboard de Almacén Individual

| KPI | Descripción | Cálculo |
|-----|-------------|---------|
| Capacidad Utilizada | % de capacidad en uso | (unidades actuales / capacidad máxima) × 100 |
| Valor Inventario | Valor total en USD/PEN | Σ(unidades × costo unitario) |
| Rotación Promedio | Días promedio en almacén | Promedio de rotación de todos los productos |
| Productos Estancados | Sin movimiento 60+ días | Count de productos sin salidas |
| Movimientos/Día | Promedio diario | Total movimientos / días del período |
| Tasa Incidencias | % de movimientos con problemas | (incidencias / movimientos) × 100 |
| Evaluación | Puntaje 0-100 | Score calculado por factores |
| Transferencias Pendientes | Transferencias en tránsito | Count estado = 'en_transito' |

### 1.3 Modal de Detalle (AlmacenDetailView.tsx)

**5 Tabs:**

1. **Resumen**
   - Datos generales del almacén
   - KPIs principales en cards
   - Gráfico de capacidad últimos 30 días
   - Alertas activas

2. **Inventario**
   - Tabla de productos con stock
   - Filtros por rotación, valor, días sin movimiento
   - Gráfico de distribución por categoría
   - Productos próximos a vencer

3. **Movimientos**
   - Timeline de movimientos recientes
   - Gráfico de movimientos por día
   - Balance entradas vs salidas
   - Transferencias historial

4. **Análisis**
   - Matriz de rotación (alta/baja × valor alto/bajo)
   - Tendencias de capacidad
   - Incidencias historial
   - Historial de evaluaciones

5. **Comparativa**
   - Ranking vs otros almacenes
   - Comparación de métricas clave
   - Gráfico radar de factores
   - Benchmarking

---

## 2. COMPETIDORES Analytics

### 2.1 Archivo: `src/services/competidor.analytics.service.ts`

**Tipos a implementar:**

```typescript
// ============================================
// TIPOS PARA ANALYTICS DE COMPETIDORES
// ============================================

interface AnalisisPrecio {
  productoId: string;
  sku: string;
  nombreProducto: string;
  marca: string;
  fechaAnalisis: Date;
  precioCompetidor: number;
  nuestroPrecio: number;
  diferenciaPorcentaje: number;
  ventajaCompetitiva: 'nosotros' | 'competidor' | 'igual';
  plataforma: string;
  urlProducto?: string;
}

interface HistorialPrecio {
  fecha: Date;
  productoId: string;
  precio: number;
  plataforma: string;
  disponible: boolean;
  observaciones?: string;
}

interface TendenciaPrecio {
  productoId: string;
  sku: string;
  nombreProducto: string;
  precioInicial: number;
  precioActual: number;
  variacion: number;
  tendencia: 'subiendo' | 'bajando' | 'estable';
  volatilidad: 'alta' | 'media' | 'baja';
  historial: Array<{fecha: Date; precio: number}>;
}

interface AnalisisPlataforma {
  plataforma: string;
  productosAnalizados: number;
  precioPromedio: number;
  diferenciaNosotros: number;
  reputacion: number;
  ultimoAnalisis: Date;
  frecuenciaActualizacion: string;
}

interface FortalezaDebilidad {
  tipo: 'fortaleza' | 'debilidad';
  categoria: 'precio' | 'variedad' | 'reputacion' | 'servicio' | 'disponibilidad';
  descripcion: string;
  impacto: 'alto' | 'medio' | 'bajo';
  productosAfectados?: number;
}

interface ComparativaCompetidores {
  competidorId: string;
  nombre: string;
  plataformas: string[];
  productosEnComun: number;
  precioPromedioVsNosotros: number; // % diferencia
  nivelAmenaza: 'alto' | 'medio' | 'bajo';
  reputacion: number;
  ventajasNuestras: number;
  ventajasSuyas: number;
  ranking: number;
}

interface AlertaCompetencia {
  tipo: 'precio_bajo' | 'nuevo_producto' | 'promocion' | 'reputacion' | 'actividad';
  severidad: 'info' | 'warning' | 'danger';
  fecha: Date;
  competidorId: string;
  competidorNombre: string;
  mensaje: string;
  productoAfectado?: {
    id: string;
    sku: string;
    nombre: string;
  };
  accionRecomendada?: string;
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

interface CompetidorAnalytics {
  competidor: Competidor;

  // Análisis de precios
  analisisPreciosActual: AnalisisPrecio[];
  productosAnalizados: number;
  productosMasBaratos: number;
  productosMasCaros: number;
  productosIgualPrecio: number;
  diferenciaPromedioGlobal: number;

  // Historial de precios
  historialPrecios: HistorialPrecio[];
  tendenciasPrecios: TendenciaPrecio[];
  tendenciaGeneralPrecios: 'subiendo' | 'bajando' | 'estable';

  // Por plataforma
  analisisPorPlataforma: AnalisisPlataforma[];
  plataformaPrincipal: string;

  // Fortalezas y debilidades
  fortalezas: FortalezaDebilidad[];
  debilidades: FortalezaDebilidad[];
  scoreCompetitivo: number; // 0-100

  // Actividad
  ultimoAnalisis: Date;
  diasSinAnalisis: number;
  frecuenciaAnalisis: number; // promedio días entre análisis
  totalAnalisisHistoricos: number;

  // Métricas de amenaza
  nivelAmenaza: 'alto' | 'medio' | 'bajo';
  factoresAmenaza: {
    precioCompetitivo: number; // 0-100
    variedad: number;
    reputacion: number;
    actividad: number;
    crecimiento: number;
  };
  tendenciaAmenaza: 'aumentando' | 'estable' | 'disminuyendo';

  // Comparativa
  comparativaCompetidores: ComparativaCompetidores[];
  rankingAmenaza: number;
  totalCompetidores: number;

  // Alertas
  alertas: AlertaCompetencia[];
  alertasActivas: number;

  // Historial
  historialAnalisis: Array<{
    fecha: Date;
    productosAnalizados: number;
    precioPromedio: number;
    diferenciaPromedio: number;
  }>;

  // Recomendaciones
  recomendaciones: Array<{
    tipo: 'precio' | 'producto' | 'marketing' | 'estrategia';
    prioridad: 'alta' | 'media' | 'baja';
    descripcion: string;
    productosRelacionados?: string[];
  }>;
}
```

**Métodos a implementar:**

```typescript
class CompetidorAnalyticsService {
  // Principal
  async getCompetidorAnalytics(competidorId: string): Promise<CompetidorAnalytics>;

  // Análisis de precios
  private async getAnalisisPrecios(competidorId: string);
  private async getHistorialPrecios(competidorId: string);
  private calcularTendenciasPrecios(historial: HistorialPrecio[]);

  // Plataformas
  private agruparPorPlataforma(analisis: AnalisisPrecio[]);

  // Fortalezas/Debilidades
  private analizarFortalezasDebilidades(analytics: Partial<CompetidorAnalytics>);
  private calcularScoreCompetitivo(fortalezas: number, debilidades: number);

  // Amenaza
  private calcularFactoresAmenaza(analytics: Partial<CompetidorAnalytics>);
  private determinarNivelAmenaza(factores: Record<string, number>);

  // Comparativa
  async compararCompetidores(competidorIds?: string[]): Promise<ComparativaCompetidores[]>;

  // Alertas
  private generarAlertas(analytics: Partial<CompetidorAnalytics>);

  // Recomendaciones
  private generarRecomendaciones(analytics: Partial<CompetidorAnalytics>);
}
```

### 2.2 KPIs para Dashboard de Competidor Individual

| KPI | Descripción | Cálculo |
|-----|-------------|---------|
| Productos Analizados | Total SKUs monitoreados | Count análisis únicos |
| Diferencia Promedio | % precio vs nosotros | Promedio de (precio_comp - precio_nuestro) / precio_nuestro |
| Nivel Amenaza | Score de competitividad | Ponderación de factores |
| Productos + Baratos | Ellos más económicos | Count donde precio_comp < precio_nuestro |
| Productos + Caros | Nosotros más económicos | Count donde precio_comp > precio_nuestro |
| Reputación | Score de reputación | Promedio de ratings en plataformas |
| Días Sin Análisis | Último monitoreo | Hoy - última fecha análisis |
| Score Competitivo | Nuestra posición vs ellos | (fortalezas / (fortalezas + debilidades)) × 100 |

### 2.3 Modal de Detalle (CompetidorDetailView.tsx)

**5 Tabs:**

1. **Resumen**
   - Info general del competidor
   - KPIs principales
   - Nivel de amenaza visual (gauge)
   - Alertas recientes

2. **Precios**
   - Tabla comparativa de precios por producto
   - Filtros por marca, categoría, ventaja
   - Gráfico de distribución de diferencias
   - Tendencia general de precios

3. **Historial**
   - Timeline de análisis realizados
   - Gráficos de evolución de precios
   - Cambios detectados
   - Frecuencia de monitoreo

4. **Análisis**
   - Fortalezas y debilidades
   - Factores de amenaza (radar)
   - Análisis por plataforma
   - Recomendaciones

5. **Comparativa**
   - Ranking vs otros competidores
   - Matriz de posicionamiento
   - Comparación de métricas clave
   - Oportunidades/Amenazas

---

## 3. TRANSPORTISTAS Analytics

### 3.1 Archivo: `src/services/transportista.analytics.service.ts`

**Tipos a implementar:**

```typescript
// ============================================
// TIPOS PARA ANALYTICS DE TRANSPORTISTAS
// ============================================

interface EntregaHistorial {
  id: string;
  fecha: Date;
  ventaId: string;
  numeroVenta: string;
  clienteId: string;
  clienteNombre: string;
  zona: string;
  distrito: string;
  direccion: string;
  unidades: number;
  pesoKg?: number;
  volumenM3?: number;
  costoEntrega: number;
  tiempoEntrega: number; // horas desde asignación
  estado: 'completada' | 'fallida' | 'reprogramada';
  motivoFallo?: string;
  calificacionCliente?: number;
  observaciones?: string;
}

interface MetricasZona {
  zona: string;
  distrito: string;
  totalEntregas: number;
  entregasExitosas: number;
  entregasFallidas: number;
  tasaExito: number;
  tiempoPromedioHoras: number;
  costoPromedio: number;
  distanciaPromedioKm?: number;
  diasConMasEntregas: string[];
  horariosOptimos: string[];
}

interface MetricasCosto {
  costoTotalPeriodo: number;
  costoPromedioEntrega: number;
  costoPromedioUnidad: number;
  costoPorKm?: number;
  costoPorKg?: number;

  distribucionCostos: {
    combustible?: number;
    manoObra?: number;
    vehiculo?: number;
    otros?: number;
  };

  tendenciaCostos: 'aumentando' | 'estable' | 'disminuyendo';
  variacionCostosMes: number;
}

interface AnalisisRendimiento {
  entregasTotales: number;
  entregasExitosas: number;
  entregasFallidas: number;
  entregasReprogramadas: number;
  tasaExitoGlobal: number;
  tasaReprogramacion: number;

  tiempoPromedioEntrega: number;
  tiempoMinimoEntrega: number;
  tiempoMaximoEntrega: number;

  puntualidad: number; // % entregas en tiempo acordado

  calificacionPromedio: number;
  totalCalificaciones: number;

  capacidadDiaria: number;
  utilizacionCapacidad: number;
}

interface IncidenciaTransportista {
  id: string;
  fecha: Date;
  tipo: 'retraso' | 'danio_producto' | 'perdida' | 'queja_cliente' | 'accidente' | 'otro';
  severidad: 'leve' | 'moderada' | 'grave';
  entregaId?: string;
  descripcion: string;
  impactoCosto?: number;
  resuelta: boolean;
  accionCorrectiva?: string;
}

interface ComparativaTransportistas {
  transportistaId: string;
  nombre: string;
  tipo: 'interno' | 'externo';
  entregas: number;
  tasaExito: number;
  tiempoPromedio: number;
  costoPromedio: number;
  calificacion: number;
  incidencias: number;
  ranking: number;
  esRecomendado: boolean;
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

interface TransportistaAnalytics {
  transportista: Transportista;

  // Rendimiento general
  rendimiento: AnalisisRendimiento;
  tendenciaRendimiento: 'mejorando' | 'estable' | 'empeorando';

  // Historial de entregas
  entregasHistorial: EntregaHistorial[];
  entregasUltimos30Dias: number;
  entregasUltimos90Dias: number;
  primeraEntrega?: Date;
  ultimaEntrega?: Date;
  diasActivo: number;

  // Por zona
  metricasPorZona: MetricasZona[];
  zonasConMejorRendimiento: string[];
  zonasProblematicas: string[];

  // Costos
  metricasCosto: MetricasCosto;
  costoTotalHistorico: number;

  // Distribución temporal
  distribucionPorDia: Array<{
    dia: string; // 'lunes', 'martes', etc.
    entregas: number;
    tasaExito: number;
  }>;
  distribucionPorHora: Array<{
    hora: string; // '08:00', '09:00', etc.
    entregas: number;
    tasaExito: number;
  }>;

  // Incidencias
  incidencias: IncidenciaTransportista[];
  totalIncidencias: number;
  incidenciasAbiertas: number;
  tasaIncidencia: number;

  // Calidad
  calificacionPromedio: number;
  distribucionCalificaciones: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  comentariosRecientes: Array<{
    fecha: Date;
    calificacion: number;
    comentario: string;
    clienteNombre: string;
  }>;

  // Comparativa
  comparativaTransportistas: ComparativaTransportistas[];
  rankingGeneral: number;
  totalTransportistas: number;
  percentilRendimiento: number;

  // ROI
  roi: {
    ingresoGenerado: number; // valor de ventas entregadas
    costoTotal: number;
    margenNeto: number;
    retornoInversion: number;
  };

  // Alertas
  alertas: Array<{
    tipo: 'rendimiento' | 'costo' | 'incidencia' | 'capacidad';
    severidad: 'info' | 'warning' | 'danger';
    mensaje: string;
    accionRecomendada?: string;
  }>;

  // Predicciones
  predicciones: {
    entregasEstimadas30Dias: number;
    costoEstimado30Dias: number;
    riesgoRotacion: number; // solo externos
    capacidadOptima: number;
  };
}
```

**Métodos a implementar:**

```typescript
class TransportistaAnalyticsService {
  // Principal
  async getTransportistaAnalytics(transportistaId: string): Promise<TransportistaAnalytics>;

  // Rendimiento
  private async calcularRendimiento(transportistaId: string);
  private calcularTendenciaRendimiento(historial: EntregaHistorial[]);

  // Entregas
  private async getEntregasHistorial(transportistaId: string);

  // Zonas
  private agruparPorZona(entregas: EntregaHistorial[]);
  private identificarZonasProblematicas(zonas: MetricasZona[]);

  // Costos
  private calcularMetricasCosto(entregas: EntregaHistorial[]);

  // Distribución temporal
  private calcularDistribucionTemporal(entregas: EntregaHistorial[]);

  // Incidencias
  private async getIncidencias(transportistaId: string);

  // Calidad
  private calcularMetricasCalidad(entregas: EntregaHistorial[]);

  // Comparativa
  async compararTransportistas(ids?: string[]): Promise<ComparativaTransportistas[]>;

  // ROI
  private calcularROI(entregas: EntregaHistorial[], costos: MetricasCosto);

  // Alertas
  private generarAlertas(analytics: Partial<TransportistaAnalytics>);

  // Predicciones
  private calcularPredicciones(analytics: Partial<TransportistaAnalytics>);
}
```

### 3.2 KPIs para Dashboard de Transportista Individual

| KPI | Descripción | Cálculo |
|-----|-------------|---------|
| Entregas Totales | Total histórico | Count entregas |
| Tasa Éxito | % entregas exitosas | (exitosas / totales) × 100 |
| Tiempo Promedio | Horas por entrega | Promedio de tiempos |
| Costo Promedio | PEN por entrega | Total costos / entregas |
| Calificación | Rating clientes | Promedio de calificaciones |
| Puntualidad | % a tiempo | (a tiempo / totales) × 100 |
| Incidencias | Total problemas | Count incidencias |
| ROI | Retorno inversión | (ingresos - costos) / costos × 100 |

### 3.3 Modal de Detalle (TransportistaDetailView.tsx)

**5 Tabs:**

1. **Resumen**
   - Info general del transportista
   - KPIs principales en cards
   - Gráfico de entregas últimos 30 días
   - Alertas activas

2. **Entregas**
   - Timeline de entregas recientes
   - Tabla con filtros
   - Mapa de zonas (heatmap)
   - Distribución por estado

3. **Rendimiento**
   - Gráficos de tendencia
   - Análisis por zona
   - Distribución por día/hora
   - Comparación períodos

4. **Costos**
   - Desglose de costos
   - Tendencias
   - Costo por zona
   - ROI detallado

5. **Comparativa**
   - Ranking vs otros transportistas
   - Radar de métricas
   - Benchmarking
   - Recomendaciones

---

## 4. CANALES DE VENTA Analytics

### 4.1 Archivo: `src/services/canalVenta.analytics.service.ts`

**Tipos a implementar:**

```typescript
// ============================================
// TIPOS PARA ANALYTICS DE CANALES DE VENTA
// ============================================

interface VentaCanal {
  ventaId: string;
  numeroVenta: string;
  fecha: Date;
  clienteId: string;
  clienteNombre: string;
  productos: number;
  unidades: number;
  subtotalPEN: number;
  descuento: number;
  totalPEN: number;
  margen: number;
  estado: string;
  tiempoConversion?: number; // días desde cotización
}

interface CotizacionCanal {
  cotizacionId: string;
  numero: string;
  fecha: Date;
  clienteId: string;
  clienteNombre: string;
  montoPEN: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'vencida';
  convertidaVenta: boolean;
  ventaId?: string;
  diasHastaConversion?: number;
  motivoRechazo?: string;
}

interface MetricasConversion {
  cotizacionesTotales: number;
  cotizacionesConvertidas: number;
  cotizacionesRechazadas: number;
  cotizacionesPendientes: number;
  cotizacionesVencidas: number;

  tasaConversion: number;
  tiempoPromedioConversion: number; // días
  valorPromedioConvertida: number;
  valorPromedioPerdida: number;

  motivosRechazo: Array<{
    motivo: string;
    count: number;
    porcentaje: number;
  }>;
}

interface MetricasVenta {
  ventasTotales: number;
  ventasUltimos30Dias: number;
  ventasUltimos90Dias: number;

  ingresosTotales: number;
  ingresosUltimos30Dias: number;
  ingresosUltimos90Dias: number;

  ticketPromedio: number;
  ticketMaximo: number;
  ticketMinimo: number;

  unidadesVendidas: number;
  productosUnicos: number;

  margenPromedio: number;
  margenTotal: number;
}

interface MetricasCliente {
  clientesUnicos: number;
  clientesNuevos: number;
  clientesRecurrentes: number;
  tasaRecurrencia: number;

  clienteTop: {
    id: string;
    nombre: string;
    compras: number;
    montoPEN: number;
  };

  adquisicionClientes: Array<{
    periodo: string;
    nuevos: number;
    recurrentes: number;
  }>;
}

interface MetricasROI {
  ingresosTotales: number;
  costoCanal: number; // comisiones, fees, etc.
  margenBruto: number;

  comisionesPagadas: number;
  tasaComision: number;

  costoAdquisicionCliente: number;
  valorVidaCliente: number;

  roiPorcentaje: number;
  rentabilidadNeta: number;
}

interface HistorialPeriodo {
  periodo: string;
  mes: number;
  anio: number;
  ventas: number;
  ingresos: number;
  margen: number;
  clientes: number;
  ticketPromedio: number;
  tasaConversion: number;
}

interface ComparativaCanales {
  canalId: string;
  nombre: string;
  codigo: string;
  ventas: number;
  ingresos: number;
  margen: number;
  ticketPromedio: number;
  tasaConversion: number;
  clientes: number;
  participacion: number; // % del total
  ranking: number;
  tendencia: 'creciendo' | 'estable' | 'decreciendo';
}

// ============================================
// ANALYTICS COMPLETO
// ============================================

interface CanalVentaAnalytics {
  canal: CanalVenta;

  // Ventas
  metricasVenta: MetricasVenta;
  ventasHistorial: VentaCanal[];
  tendenciaVentas: 'creciendo' | 'decreciendo' | 'estable';
  tasaCrecimiento: number;

  // Conversión
  metricasConversion: MetricasConversion;
  cotizacionesHistorial: CotizacionCanal[];
  funnelConversion: {
    cotizaciones: number;
    enNegociacion: number;
    aprobadas: number;
    convertidas: number;
  };

  // Clientes
  metricasCliente: MetricasCliente;
  clientesTop: Array<{
    id: string;
    nombre: string;
    compras: number;
    monto: number;
    ultimaCompra: Date;
  }>;

  // Productos
  productosTop: Array<{
    id: string;
    sku: string;
    nombre: string;
    unidades: number;
    ingresos: number;
    margen: number;
  }>;
  categoriasTop: Array<{
    categoria: string;
    unidades: number;
    ingresos: number;
  }>;

  // ROI
  metricasROI: MetricasROI;

  // Historial
  historialMensual: HistorialPeriodo[];
  mejorMes: HistorialPeriodo;
  peorMes: HistorialPeriodo;

  // Estacionalidad
  patronesEstacionales: Array<{
    patron: string;
    descripcion: string;
    mesesAfectados: number[];
    impacto: 'positivo' | 'negativo';
  }>;

  // Comparativa
  comparativaCanales: ComparativaCanales[];
  rankingGeneral: number;
  totalCanales: number;
  participacionMercado: number;

  // Alertas
  alertas: Array<{
    tipo: 'ventas' | 'conversion' | 'clientes' | 'roi';
    severidad: 'info' | 'warning' | 'danger';
    mensaje: string;
    accionRecomendada?: string;
  }>;

  // Predicciones
  predicciones: {
    ventasEstimadas30Dias: number;
    ingresosEstimados30Dias: number;
    tendenciaProxMes: 'positiva' | 'negativa' | 'estable';
    riesgoDeclinacion: number;
  };
}
```

**Métodos a implementar:**

```typescript
class CanalVentaAnalyticsService {
  // Principal
  async getCanalVentaAnalytics(canalId: string): Promise<CanalVentaAnalytics>;

  // Ventas
  private async getVentasHistorial(canalId: string);
  private calcularMetricasVenta(ventas: VentaCanal[]);
  private calcularTendenciaVentas(historial: HistorialPeriodo[]);

  // Conversión
  private async getCotizacionesHistorial(canalId: string);
  private calcularMetricasConversion(cotizaciones: CotizacionCanal[]);
  private construirFunnelConversion(cotizaciones: CotizacionCanal[]);

  // Clientes
  private calcularMetricasCliente(ventas: VentaCanal[]);
  private identificarClientesTop(ventas: VentaCanal[]);

  // Productos
  private identificarProductosTop(ventas: VentaCanal[]);

  // ROI
  private calcularMetricasROI(ventas: VentaCanal[], canal: CanalVenta);

  // Historial
  private construirHistorialMensual(ventas: VentaCanal[]);

  // Estacionalidad
  private detectarPatronesEstacionales(historial: HistorialPeriodo[]);

  // Comparativa
  async compararCanales(canalIds?: string[]): Promise<ComparativaCanales[]>;

  // Alertas
  private generarAlertas(analytics: Partial<CanalVentaAnalytics>);

  // Predicciones
  private calcularPredicciones(analytics: Partial<CanalVentaAnalytics>);
}
```

### 4.2 KPIs para Dashboard de Canal Individual

| KPI | Descripción | Cálculo |
|-----|-------------|---------|
| Ventas Totales | Número de ventas | Count ventas |
| Ingresos | Total facturado PEN | Σ totales de ventas |
| Ticket Promedio | Valor promedio por venta | Ingresos / Ventas |
| Tasa Conversión | % cotizaciones → ventas | (convertidas / cotizaciones) × 100 |
| Margen Promedio | % margen | Promedio de márgenes |
| Clientes Únicos | Total clientes | Count distinct clientes |
| Participación | % del total de ventas | (ventas_canal / ventas_totales) × 100 |
| ROI | Retorno de inversión | (ingresos - costos) / costos × 100 |

### 4.3 Modal de Detalle (CanalVentaDetailView.tsx)

**5 Tabs:**

1. **Resumen**
   - Info general del canal
   - KPIs principales
   - Gráfico de ventas últimos 30 días
   - Alertas activas

2. **Ventas**
   - Tabla de ventas recientes
   - Gráficos de tendencia
   - Top productos y categorías
   - Distribución por estado

3. **Conversión**
   - Funnel visual
   - Tabla de cotizaciones
   - Motivos de rechazo
   - Tiempo de conversión

4. **Clientes**
   - Top clientes
   - Adquisición vs recurrencia
   - Valor de vida
   - Segmentación

5. **Comparativa**
   - Ranking vs otros canales
   - Participación de mercado
   - Tendencias comparadas
   - Benchmarking

---

## 5. PLAN DE IMPLEMENTACIÓN

### Fase 1: Tipos y Estructuras (Base)

**Archivos a crear/modificar:**

1. `src/types/almacen.analytics.types.ts`
2. `src/types/competidor.analytics.types.ts`
3. `src/types/transportista.analytics.types.ts`
4. `src/types/canalVenta.analytics.types.ts`

### Fase 2: Servicios de Analytics

**Archivos a crear:**

1. `src/services/almacen.analytics.service.ts`
2. `src/services/competidor.analytics.service.ts`
3. `src/services/transportista.analytics.service.ts`
4. `src/services/canalVenta.analytics.service.ts`

**Orden de implementación:**
1. Almacenes (80% existente, más fácil)
2. Canales de Venta (conectado a ventas existentes)
3. Transportistas (conectado a entregas)
4. Competidores (requiere más estructura nueva)

### Fase 3: Stores

**Archivos a modificar:**

1. `src/store/almacenStore.ts` - agregar fetchAnalytics
2. `src/store/competidorStore.ts` - agregar fetchStats completo
3. `src/store/transportistaStore.ts` - agregar fetchStats
4. `src/store/canalVentaStore.ts` - agregar fetchStats

### Fase 4: Componentes de Detalle

**Archivos a crear:**

1. `src/components/Maestros/AlmacenDetailView.tsx`
2. `src/components/Maestros/CompetidorDetailView.tsx`
3. `src/components/Maestros/TransportistaDetailView.tsx`
4. `src/components/Maestros/CanalVentaDetailView.tsx`

### Fase 5: Integración en Maestros

**Archivos a modificar:**

1. `src/components/Maestros/AlmacenesLogistica.tsx`
2. `src/components/Maestros/CompetidoresIntel.tsx`
3. `src/components/Maestros/TransportistasLogistica.tsx`
4. `src/components/Maestros/CanalesVentaAnalytics.tsx`

---

## 6. RESUMEN DE ENTREGABLES

### Por Módulo:

| Módulo | Types | Service | Store | DetailView | Integración |
|--------|-------|---------|-------|------------|-------------|
| Almacenes | Nuevo archivo | Nuevo (700-900 líneas) | Modificar | Nuevo (600-800 líneas) | Modificar |
| Competidores | Nuevo archivo | Nuevo (600-800 líneas) | Modificar | Nuevo (600-800 líneas) | Modificar |
| Transportistas | Nuevo archivo | Nuevo (700-900 líneas) | Modificar | Nuevo (600-800 líneas) | Modificar |
| Canales | Nuevo archivo | Nuevo (600-800 líneas) | Modificar | Nuevo (600-800 líneas) | Modificar |

### Total estimado:

- **Archivos nuevos:** 12
- **Archivos modificados:** 8
- **Líneas de código aproximadas:** 8,000 - 10,000

---

## 7. DEPENDENCIAS Y CONSIDERACIONES

### Datos requeridos:

1. **Almacenes:** Inventario, Transferencias, Unidades
2. **Competidores:** Análisis de precios (estructura a definir)
3. **Transportistas:** Entregas, Movimientos
4. **Canales:** Ventas, Cotizaciones

### Componentes comunes a usar:

- `KPICard` - para métricas
- `Charts` - para gráficos (Line, Bar, Pie, Radar)
- `Tabs` - para navegación interna
- `Modal` - para vistas de detalle
- `Pagination` - para tablas
- `Badge` - para estados
- `EmptyState` - para datos vacíos

### Consideraciones de rendimiento:

- Usar cálculos en servidor (Firebase Functions) para analytics pesados
- Cachear resultados de analytics con TTL
- Paginación en historial de movimientos/entregas
- Lazy loading de tabs en modales de detalle
