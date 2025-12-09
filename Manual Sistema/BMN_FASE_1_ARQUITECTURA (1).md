# 🏗️ ARQUITECTURA BUSINESSMN 2.0 - FASE 1

## 📋 TABLA DE CONTENIDOS
1. [Visión General](#visión-general)
2. [Arquitectura de Datos](#arquitectura-de-datos)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Módulos de la Fase 1](#módulos-de-la-fase-1)
5. [Lógica de Negocio Crítica](#lógica-de-negocio-crítica)
6. [Plan de Implementación](#plan-de-implementación)

---

## 🎯 VISIÓN GENERAL

### Objetivo Fase 1
Construir el núcleo operativo del ERP que permita:
- ✅ Control total de productos y SKUs
- ✅ Gestión de inventario USA + Perú con trazabilidad
- ✅ Órdenes de compra con control cambiario multicapa
- ✅ Cálculo CTRU dinámico en tiempo real
- ✅ Ventas y cotizaciones con rentabilidad visible
- ✅ Dashboard ejecutivo con KPIs críticos

### Stack Tecnológico
```
Frontend:
- React 18 + TypeScript
- Vite (build tool)
- Zustand (state management)
- TanStack Query (data fetching & caching)
- Tailwind CSS (styling)
- Recharts (gráficos)
- React Hook Form + Zod (forms + validación)

Backend:
- Firebase Authentication
- Firestore (base de datos)
- Cloud Functions (lógica backend)
- Firebase Storage (imágenes, documentos)

APIs Externas:
- API de Tipo de Cambio (para TC diario)
```

---

## 🗄️ ARQUITECTURA DE DATOS

### 1. Colección: `productos` (SKUs)

```typescript
interface Producto {
  // Identificación
  id: string;
  sku: string; // Generado automáticamente
  
  // Información Básica
  marca: string;
  nombreComercial: string;
  presentacion: 'tabletas' | 'gomitas' | 'capsulas' | 'polvo' | 'liquido';
  dosaje: string; // "5mg", "1000 IU", etc.
  contenido: string; // "60 caps", "120 tabs", etc.
  
  // Clasificación
  grupo: string; // "Vitaminas", "Minerales", "Nootrópicos", etc.
  subgrupo: string; // "Melatonina", "Magnesio", "Ashwagandha", etc.
  
  // Datos Comerciales
  codigoUPC?: string;
  enlaceProveedor: string; // URL Amazon, iHerb, etc.
  
  // Estados y Etiquetas
  estado: 'activo' | 'deshabilitado';
  etiquetas: Array<
    'riesgo_alto_ctru' | 
    'ctru_elevado' | 
    'margen_bajo' | 
    'premium' | 
    'competitividad_alta' | 
    'revisar_precio' | 
    'nuevo' | 
    'agotado_temporalmente'
  >;
  
  // Mercado Libre
  habilitadoML: boolean;
  restriccionML?: string; // Motivo si no está habilitado
  
  // Investigación de Mercado
  investigacion?: {
    fechaInvestigacion: Timestamp;
    vigenciaHasta: Timestamp; // +60 días
    precioUSAMin: number;
    precioUSAMax: number;
    precioUSAPromedio: number;
    precioPERUMin: number;
    precioPERUMax: number;
    precioPERUPromedio: number;
    presenciaML: boolean;
    notas?: string;
  };
  
  // Costos y Pricing
  ctruPromedio: number; // Costo Total Real por Unidad (actualizado dinámicamente)
  precioSugerido: number;
  margenMinimo: number; // %
  margenObjetivo: number; // %
  
  // Inventarios (Agregados)
  stockUSA: number;
  stockPeru: number;
  stockTransito: number;
  stockReservado: number;
  stockDisponible: number; // stockPeru - stockReservado
  
  // Inventario Mínimo/Máximo
  stockMinimo: number;
  stockMaximo: number;
  
  // Rotación
  rotacionPromedio: number; // Unidades por mes
  diasParaQuiebre: number; // Calculado automáticamente
  
  // Variantes (Padre-Hijo)
  esPadre: boolean;
  skuPadre?: string; // Si es hijo, referencia al padre
  variantes?: string[]; // Si es padre, lista de SKUs hijos
  
  // Metadata
  imagenURL?: string;
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion: Timestamp;
  editadoPor: string;
}
```

### 2. Colección: `unidades` (Unidad Originaria Digital)

```typescript
interface Unidad {
  // Identificación
  id: string; // UID único de la unidad
  skuId: string; // Referencia al producto
  
  // Origen
  ocId: string; // Orden de compra que la originó
  fechaOrigen: Timestamp;
  
  // Costos
  costoUSA: number; // Precio de compra en USD
  tcCompra: number; // Tipo de cambio al registrar OC
  tcPago?: number; // Tipo de cambio al momento del pago real
  
  // Logística
  costoLogisticaUSAPeru: number; // Flete prorrateado
  costoOperativoProrrateado: number;
  costoAdministrativoProrrateado: number;
  costoML?: number; // Si se vende por ML
  costoDelivery?: number; // Si aplica delivery
  
  // CTRU
  ctruInicial: number; // Al momento de recibir en Perú
  ctruDinamico: number; // Actualizado con cada gasto
  
  // Estados
  estado: 
    | 'recibida_usa'
    | 'disponible_usa'
    | 'en_transito'
    | 'recibida_peru'
    | 'disponible_peru'
    | 'reservada_sin_pago'
    | 'reservada_con_adelanto'
    | 'asignada_pedido'
    | 'en_despacho'
    | 'entregada'
    | 'merma'
    | 'obsoleta';
  
  // Ubicación
  almacenActual: string; // 'USA-Miami1', 'Peru-Principal', etc.
  ubicacionEspecifica?: string;
  
  // Vencimiento (FEFO)
  fechaVencimiento?: Timestamp;
  diasParaVencer?: number; // Calculado
  
  // Ventas
  ventaId?: string; // Si fue vendida
  fechaVenta?: Timestamp;
  precioVenta?: number;
  margenReal?: number;
  
  // Historial
  historial: Array<{
    fecha: Timestamp;
    accion: string;
    usuario: string;
    estadoAnterior?: string;
    estadoNuevo?: string;
    detalles?: any;
  }>;
  
  // Metadata
  creadoPor: string;
  fechaCreacion: Timestamp;
}
```

### 3. Colección: `ordenesCompra` (OC)

```typescript
interface OrdenCompra {
  // Identificación
  id: string;
  numeroOC: string; // Auto-generado: OC-2024-001
  
  // Proveedor
  proveedor: string; // "Amazon", "iHerb", "Walmart", etc.
  enlaceCompra?: string;
  
  // Fechas
  fechaRegistro: Timestamp;
  fechaPagoEstimada?: Timestamp;
  fechaPagoReal?: Timestamp;
  fechaRecepcionEstimada?: Timestamp;
  fechaRecepcionReal?: Timestamp;
  
  // Control Cambiario
  tcCompra: number; // TC del día de registro
  tcPago?: number; // TC del día del pago real
  diferenciaTcPorDolar?: number; // Ganancia/pérdida cambiaria
  diferenciaTcTotal?: number;
  
  // Productos
  items: Array<{
    skuId: string;
    nombreProducto: string;
    cantidad: number;
    precioUnitarioUSD: number;
    subtotalUSD: number;
  }>;
  
  // Totales
  totalUSD: number;
  totalPENCompra: number; // Total en soles con TC compra
  totalPENPago?: number; // Total en soles con TC pago
  
  // Destino
  almacenUSADestino: string; // "USA-Miami1", "USA-Utah", etc.
  
  // Estados
  estadoOC: 'pendiente' | 'pagada' | 'recibida_usa' | 'enviada_peru' | 'completada' | 'cancelada';
  estadoPago: 'pendiente' | 'pagada' | 'parcial';
  estadoRecepcion: 'pendiente' | 'recibida_completa' | 'recibida_parcial' | 'faltantes';
  
  // Incidencias
  unidadesFaltantes?: number;
  unidadesDanadas?: number;
  incidencias?: Array<{
    fecha: Timestamp;
    tipo: string;
    descripcion: string;
    responsable: string;
    imagenURL?: string;
  }>;
  
  // Notas
  notas?: string;
  
  // Metadata
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion: Timestamp;
}
```

### 4. Colección: `ventas`

```typescript
interface Venta {
  // Identificación
  id: string;
  numeroVenta: string; // V-2024-001
  
  // Cliente
  clienteId?: string;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  
  // Canal
  canal: 'retail' | 'mayorista' | 'mercadolibre';
  origenVenta: 'whatsapp' | 'ml' | 'local' | 'telefono';
  
  // Productos
  items: Array<{
    unidadId: string;
    skuId: string;
    nombreProducto: string;
    cantidad: number;
    ctruUnitario: number;
    precioUnitario: number;
    margenUnitario: number; // %
    subtotal: number;
  }>;
  
  // Totales
  subtotal: number;
  delivery?: number;
  total: number;
  
  // Costos
  costoTotal: number; // Suma de CTRU
  costoML?: number; // Comisión ML
  costoDelivery?: number;
  costoEmpaque?: number;
  
  // Rentabilidad
  margenBruto: number; // Total - CostoTotal
  margenBrutoPorc: number; // %
  margenNeto: number; // Después de ML, delivery, empaque
  margenNetoPorc: number; // %
  
  // Control Cambiario
  tcVenta: number;
  
  // Estado y Entrega
  estadoVenta: 'cotizacion' | 'confirmada' | 'preparando' | 'en_despacho' | 'entregada' | 'cancelada';
  estadoPago: 'pendiente' | 'adelanto' | 'pagada';
  montoAdelanto?: number;
  montoPendiente?: number;
  
  // Fechas
  fechaVenta: Timestamp;
  fechaEntregaEstimada?: Timestamp;
  fechaEntregaReal?: Timestamp;
  
  // Mercado Libre Específico
  mlVentaId?: string; // ID de ML
  mlTiempoLimite?: Timestamp;
  mlEstado?: string;
  
  // Notas
  notas?: string;
  
  // Metadata
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion: Timestamp;
}
```

### 5. Colección: `cotizaciones`

```typescript
interface Cotizacion {
  // Identificación
  id: string;
  numeroCotizacion: string; // COT-2024-001
  
  // Cliente
  clienteNombre: string;
  clienteTelefono?: string;
  
  // Productos
  items: Array<{
    skuId: string;
    nombreProducto: string;
    cantidad: number;
    ctruUnitario: number; // Al momento de cotizar
    precioSugeridoSistema: number;
    precioOfrecido: number; // Lo que define el vendedor
    margenEstimado: number;
  }>;
  
  // Totales
  subtotal: number;
  delivery?: number;
  total: number;
  
  // Control Cambiario
  tcCotizacion: number;
  
  // Vigencia
  fechaEmision: Timestamp;
  fechaExpiracion: Timestamp; // +7 días típicamente
  
  // Estado
  estado: 'pendiente' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada' | 'convertida';
  ventaId?: string; // Si se convirtió en venta
  
  // Notas
  notas?: string;
  
  // Metadata
  creadoPor: string;
  fechaCreacion: Timestamp;
}
```

### 6. Colección: `tiposCambio`

```typescript
interface TipoCambio {
  id: string; // YYYY-MM-DD
  fecha: Timestamp;
  compra: number;
  venta: number;
  fuente: 'manual' | 'api';
  registradoPor?: string;
  fechaRegistro: Timestamp;
}
```

### 7. Colección: `gastos`

```typescript
interface Gasto {
  id: string;
  numeroGasto: string; // GASTO-2024-001
  
  // Tipo
  tipo: 
    | 'compra_usa'
    | 'flete_usa_peru'
    | 'administrativo'
    | 'operativo'
    | 'ml_comision'
    | 'delivery'
    | 'empaque'
    | 'courier'
    | 'otro'
    | 'personal_no_atribuible';
  
  // Monto
  monto: number;
  moneda: 'USD' | 'PEN';
  tc?: number; // Si es USD
  montoPEN: number; // Siempre en soles para consolidación
  
  // Fecha
  fecha: Timestamp;
  
  // Prorrrateo
  esProrrateable: boolean; // False si es "personal_no_atribuible"
  prorrateadoA?: 'todas_unidades' | 'oc_especifica' | 'sku_especifico';
  referenciaId?: string; // ID de la OC o SKU si aplica
  
  // Descripción
  concepto: string;
  notas?: string;
  
  // Comprobante
  comprobanteURL?: string;
  
  // Metadata
  registradoPor: string;
  fechaRegistro: Timestamp;
}
```

### 8. Colección: `almacenes`

```typescript
interface Almacen {
  id: string;
  nombre: string; // "USA-Miami1", "Peru-Principal", etc.
  tipo: 'usa' | 'peru' | 'transito';
  
  // Capacidad
  capacidadTotal?: number; // Unidades
  capacidadUsada: number;
  capacidadDisponible: number;
  
  // Dirección
  direccion?: string;
  pais: 'USA' | 'PERU';
  
  // Estado
  activo: boolean;
  
  // Metadata
  fechaCreacion: Timestamp;
}
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
businessmn-v2/
├── public/
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   │
│   ├── components/
│   │   ├── common/           # Componentes reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Alert.tsx
│   │   │   └── Loading.tsx
│   │   │
│   │   ├── layout/           # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   └── DashboardLayout.tsx
│   │   │
│   │   └── modules/          # Componentes por módulo
│   │       ├── productos/
│   │       ├── inventario/
│   │       ├── compras/
│   │       ├── ventas/
│   │       └── dashboard/
│   │
│   ├── hooks/                # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useProductos.ts
│   │   ├── useInventario.ts
│   │   ├── useOrdenes.ts
│   │   ├── useVentas.ts
│   │   └── useDashboard.ts
│   │
│   ├── lib/                  # Utilities & configs
│   │   ├── firebase.ts
│   │   ├── api.ts
│   │   └── utils.ts
│   │
│   ├── services/             # Lógica de negocio & APIs
│   │   ├── productos.service.ts
│   │   ├── inventario.service.ts
│   │   ├── ordenes.service.ts
│   │   ├── ventas.service.ts
│   │   ├── ctru.service.ts
│   │   ├── tipoCambio.service.ts
│   │   └── dashboard.service.ts
│   │
│   ├── store/                # Zustand stores
│   │   ├── authStore.ts
│   │   ├── productosStore.ts
│   │   ├── inventarioStore.ts
│   │   └── appStore.ts
│   │
│   ├── types/                # TypeScript types
│   │   ├── producto.types.ts
│   │   ├── unidad.types.ts
│   │   ├── ordenCompra.types.ts
│   │   ├── venta.types.ts
│   │   └── common.types.ts
│   │
│   ├── pages/                # Páginas principales
│   │   ├── Dashboard.tsx
│   │   ├── Productos/
│   │   │   ├── ProductosList.tsx
│   │   │   ├── ProductoForm.tsx
│   │   │   └── ProductoDetail.tsx
│   │   ├── Inventario/
│   │   │   ├── InventarioGeneral.tsx
│   │   │   ├── InventarioUSA.tsx
│   │   │   ├── InventarioPeru.tsx
│   │   │   └── UnidadDetail.tsx
│   │   ├── Compras/
│   │   │   ├── OrdenesList.tsx
│   │   │   ├── OrdenForm.tsx
│   │   │   └── OrdenDetail.tsx
│   │   ├── Ventas/
│   │   │   ├── VentasList.tsx
│   │   │   ├── VentaForm.tsx
│   │   │   ├── CotizacionForm.tsx
│   │   │   └── VentaDetail.tsx
│   │   └── Auth/
│   │       ├── Login.tsx
│   │       └── Register.tsx
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── functions/                # Firebase Cloud Functions
│   ├── src/
│   │   ├── triggers/
│   │   │   ├── onOrdenCompraCreated.ts
│   │   │   ├── onUnidadCreated.ts
│   │   │   ├── onGastoCreated.ts
│   │   │   └── onVentaCreated.ts
│   │   ├── scheduled/
│   │   │   ├── actualizarTipoCambio.ts
│   │   │   └── calcularCTRUDinamico.ts
│   │   └── callable/
│   │       ├── crearOrdenCompra.ts
│   │       ├── procesarVenta.ts
│   │       └── calcularCotizacion.ts
│   │
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 🧩 MÓDULOS DE LA FASE 1

### 1️⃣ Módulo: Productos & SKUs

**Funcionalidades:**
- ✅ CRUD completo de productos
- ✅ Sistema de variantes padre-hijo
- ✅ Investigación de mercado con vigencia
- ✅ Cálculo de CTRU promedio
- ✅ Etiquetas de clasificación
- ✅ Control de habilitación ML
- ✅ Historial de cambios
- ✅ Búsqueda y filtros avanzados

**Pantallas principales:**
1. Lista de productos (tabla con filtros)
2. Formulario de creación/edición
3. Detalle de producto (con métricas)
4. Modal de investigación de mercado

**Componentes clave:**
```typescript
// ProductosList.tsx - Vista principal
// ProductoForm.tsx - Crear/Editar
// ProductoCard.tsx - Tarjeta de producto
// InvestigacionModal.tsx - Investigación de mercado
// ProductoFilters.tsx - Filtros avanzados
```

---

### 2️⃣ Módulo: Inventario

**Funcionalidades:**
- ✅ Vista unificada de stock (USA + Perú + Tránsito)
- ✅ Gestión de almacenes
- ✅ Trazabilidad por unidad
- ✅ Estados de unidades
- ✅ Movimientos entre almacenes
- ✅ FEFO automático
- ✅ Alertas de stock mínimo
- ✅ Alertas de vencimiento

**Pantallas principales:**
1. Inventario general (resumen por SKU)
2. Inventario USA (desglose por almacén)
3. Inventario Perú (desglose por almacén)
4. Vista de unidades (detalle individual)
5. Movimientos de inventario

**Componentes clave:**
```typescript
// InventarioGeneral.tsx
// InventarioUSA.tsx
// InventarioPeru.tsx
// UnidadCard.tsx
// UnidadTimeline.tsx - Historial de movimientos
// MovimientoForm.tsx - Registrar movimiento
// StockAlerts.tsx - Alertas de stock
```

---

### 3️⃣ Módulo: Órdenes de Compra

**Funcionalidades:**
- ✅ Crear OC con múltiples productos
- ✅ Control cambiario (TC compra vs TC pago)
- ✅ Registro de pago
- ✅ Recepción en USA
- ✅ Generación automática de unidades
- ✅ Cálculo de diferencias cambiarias
- ✅ Incidencias (faltantes, dañados)
- ✅ Estados de OC

**Pantallas principales:**
1. Lista de órdenes (con filtros)
2. Formulario de nueva OC
3. Detalle de OC
4. Registro de pago
5. Registro de recepción USA

**Componentes clave:**
```typescript
// OrdenesList.tsx
// OrdenForm.tsx
// OrdenDetail.tsx
// PagoForm.tsx - Registrar pago
// RecepcionForm.tsx - Registrar recepción
// DiferenciasCambiarias.tsx - Vista de diferencias TC
```

---

### 4️⃣ Módulo: Ventas & Cotizaciones

**Funcionalidades:**
- ✅ Crear cotizaciones
- ✅ Convertir cotización a venta
- ✅ Registro de ventas directas
- ✅ Cálculo de rentabilidad en tiempo real
- ✅ Asignación de unidades (FEFO)
- ✅ Control de adelantos
- ✅ Seguimiento de entregas
- ✅ Análisis de márgenes

**Pantallas principales:**
1. Lista de ventas
2. Lista de cotizaciones
3. Formulario de cotización
4. Formulario de venta
5. Detalle de venta

**Componentes clave:**
```typescript
// VentasList.tsx
// CotizacionesList.tsx
// CotizacionForm.tsx
// VentaForm.tsx
// VentaDetail.tsx
// RentabilidadCalculator.tsx - Muestra márgenes en tiempo real
// AsignacionUnidades.tsx - Selector de unidades FEFO
```

---

### 5️⃣ Módulo: Control Cambiario

**Funcionalidades:**
- ✅ Registro diario de TC (compra/venta)
- ✅ Historial de TC
- ✅ API automática para obtener TC
- ✅ Cálculo de diferencias cambiarias
- ✅ Análisis de riesgo FX

**Pantallas principales:**
1. Registro de TC diario
2. Historial de TC
3. Dashboard de diferencias cambiarias

**Componentes clave:**
```typescript
// TipoCambioForm.tsx
// TipoCambioHistorial.tsx
// DiferenciasCambiariasDashboard.tsx
```

---

### 6️⃣ Módulo: Dashboard Ejecutivo

**Funcionalidades:**
- ✅ KPIs principales
- ✅ Resumen de inventario
- ✅ Ventas del mes
- ✅ Rentabilidad
- ✅ Productos más vendidos
- ✅ Alertas críticas
- ✅ Gráficos de tendencias

**Métricas principales:**
```typescript
interface DashboardMetrics {
  // Inventario
  totalUnidadesPeru: number;
  totalUnidadesUSA: number;
  valorInventarioPEN: number;
  productosStockCritico: number;
  
  // Ventas
  ventasMes: number;
  ventasSemana: number;
  ventasHoy: number;
  margenPromedioMes: number;
  
  // Compras
  ordenesAbiertas: number;
  valorOrdenesAbiertas: number;
  unidadesEnTransito: number;
  
  // Financiero
  ctruPromedio: number;
  riesgoCambiarioMes: number;
  
  // Alertas
  productosStockMinimo: number;
  productosProximosVencer: number;
  cotizacionesPendientes: number;
}
```

**Componentes clave:**
```typescript
// Dashboard.tsx - Vista principal
// MetricCard.tsx - Tarjeta de métrica
// SalesChart.tsx - Gráfico de ventas
// InventoryChart.tsx - Gráfico de inventario
// TopProductos.tsx - Productos más vendidos
// AlertasPanel.tsx - Panel de alertas
```

---

## ⚙️ LÓGICA DE NEGOCIO CRÍTICA

### 1. Cálculo CTRU Dinámico

El CTRU (Costo Total Real por Unidad) se calcula y actualiza automáticamente.

**Fórmula CTRU:**
```typescript
CTRU = 
  + Costo USA (en PEN con TC pago o TC compra)
  + Costo Logística USA→Perú (prorrateado)
  + Costo Operativo (prorrateado)
  + Costo Administrativo (prorrateado)
  + Costo ML (solo si se vende por ML)
  + Costo Delivery (solo si aplica)
  + Costo Empaque (solo si aplica)
```

**Implementación:**
```typescript
// services/ctru.service.ts

export class CTRUService {
  /**
   * Calcula el CTRU inicial de una unidad al recibirla en Perú
   */
  async calcularCTRUInicial(unidadId: string): Promise<number> {
    const unidad = await getUnidad(unidadId);
    const oc = await getOrdenCompra(unidad.ocId);
    
    // 1. Costo USA en PEN
    const tcAplicable = oc.tcPago || oc.tcCompra;
    const costoUSAPEN = unidad.costoUSA * tcAplicable;
    
    // 2. Costo logística prorrateado
    const costoLogistica = await this.prorratearCostoLogistica(unidadId);
    
    // 3. Gastos operativos y administrativos del mes
    const gastosProrrateados = await this.calcularGastosProrrateados(unidadId);
    
    const ctru = costoUSAPEN + costoLogistica + gastosProrrateados;
    
    return ctru;
  }
  
  /**
   * Recalcula el CTRU dinámico cuando hay nuevos gastos
   * Se ejecuta cada vez que se registra un gasto
   */
  async recalcularCTRUDinamico(): Promise<void> {
    // 1. Obtener todas las unidades disponibles en Perú
    const unidades = await getUnidadesDisponibles();
    
    // 2. Calcular gastos del mes actual
    const gastosMes = await getGastosMesActual();
    const gastosProrrateables = gastosMes.filter(g => g.esProrrateable);
    
    // 3. Calcular prorrateo por unidad
    const totalUnidades = unidades.length;
    const gastoTotalProrrateable = gastosProrrateables.reduce(
      (sum, g) => sum + g.montoPEN, 
      0
    );
    const gastoPorUnidad = gastoTotalProrrateable / totalUnidades;
    
    // 4. Actualizar CTRU de cada unidad
    for (const unidad of unidades) {
      const ctruActualizado = unidad.ctruInicial + gastoPorUnidad;
      await updateUnidad(unidad.id, { ctruDinamico: ctruActualizado });
    }
    
    // 5. Actualizar CTRU promedio por SKU
    await this.actualizarCTRUPromedioSKUs();
  }
  
  /**
   * Calcula el costo logístico prorrateado para una unidad
   */
  private async prorratearCostoLogistica(unidadId: string): Promise<number> {
    const unidad = await getUnidad(unidadId);
    const oc = await getOrdenCompra(unidad.ocId);
    
    // Obtener gastos de flete de esta OC
    const gastosLogistica = await getGastosByOC(oc.id, 'flete_usa_peru');
    const totalLogistica = gastosLogistica.reduce(
      (sum, g) => sum + g.montoPEN, 
      0
    );
    
    // Prorratear entre todas las unidades de la OC
    const totalUnidadesOC = await countUnidadesByOC(oc.id);
    return totalLogistica / totalUnidadesOC;
  }
  
  /**
   * Calcula gastos administrativos y operativos prorrateados
   */
  private async calcularGastosProrrateados(unidadId: string): Promise<number> {
    const unidad = await getUnidad(unidadId);
    const fechaRecepcion = unidad.fechaCreacion;
    
    // Gastos del mes de recepción
    const gastosDelMes = await getGastosMes(
      fechaRecepcion.toDate().getMonth(),
      fechaRecepcion.toDate().getFullYear()
    );
    
    const gastosProrrateables = gastosDelMes.filter(
      g => g.esProrrateable && 
           (g.tipo === 'administrativo' || g.tipo === 'operativo')
    );
    
    const totalGastos = gastosProrrateables.reduce(
      (sum, g) => sum + g.montoPEN, 
      0
    );
    
    // Prorratear entre todas las unidades del mes
    const totalUnidadesMes = await countUnidadesByMonth(
      fechaRecepcion.toDate().getMonth(),
      fechaRecepcion.toDate().getFullYear()
    );
    
    return totalGastos / totalUnidadesMes;
  }
  
  /**
   * Actualiza el CTRU promedio de cada SKU
   */
  private async actualizarCTRUPromedioSKUs(): Promise<void> {
    const productos = await getAllProductos();
    
    for (const producto of productos) {
      const unidadesDisponibles = await getUnidadesBySkuId(
        producto.id,
        ['disponible_peru', 'reservada_sin_pago', 'reservada_con_adelanto']
      );
      
      if (unidadesDisponibles.length === 0) continue;
      
      const ctruPromedio = unidadesDisponibles.reduce(
        (sum, u) => sum + u.ctruDinamico, 
        0
      ) / unidadesDisponibles.length;
      
      await updateProducto(producto.id, { ctruPromedio });
    }
  }
}
```

---

### 2. Control Cambiario Multicapa

**Escenarios de TC:**

1. **TC Compra**: Se registra al crear la OC
2. **TC Pago**: Se registra al momento del pago real
3. **TC Venta**: Se usa al momento de vender

**Cálculo de diferencias cambiarias:**
```typescript
// services/tipoCambio.service.ts

export class TipoCambioService {
  /**
   * Calcula la diferencia cambiaria de una OC
   */
  calcularDiferenciaCambiaria(oc: OrdenCompra): {
    diferenciaPorDolar: number;
    diferenciaTotal: number;
    tipo: 'ganancia' | 'perdida';
  } {
    if (!oc.tcPago) {
      return {
        diferenciaPorDolar: 0,
        diferenciaTotal: 0,
        tipo: 'ganancia'
      };
    }
    
    const diferenciaPorDolar = oc.tcCompra - oc.tcPago;
    const diferenciaTotal = diferenciaPorDolar * oc.totalUSD;
    
    return {
      diferenciaPorDolar,
      diferenciaTotal,
      tipo: diferenciaPorDolar > 0 ? 'ganancia' : 'perdida'
    };
  }
  
  /**
   * Obtiene o crea el TC del día
   */
  async getTipoCambioDia(fecha: Date): Promise<TipoCambio> {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    
    let tc = await getTipoCambioByFecha(fechaStr);
    
    if (!tc) {
      // Intentar obtener de API
      try {
        const tcAPI = await this.fetchTipoCambioAPI();
        tc = await createTipoCambio({
          id: fechaStr,
          fecha: Timestamp.fromDate(fecha),
          compra: tcAPI.compra,
          venta: tcAPI.venta,
          fuente: 'api',
          fechaRegistro: Timestamp.now()
        });
      } catch (error) {
        // Si falla API, usar el último TC conocido
        const ultimoTC = await getUltimoTipoCambio();
        tc = ultimoTC;
      }
    }
    
    return tc;
  }
  
  /**
   * Obtiene TC de una API externa (ejemplo con sunat)
   */
  private async fetchTipoCambioAPI(): Promise<{
    compra: number;
    venta: number;
  }> {
    // Aquí llamarías a una API real
    // Por ejemplo: https://api.apis.net.pe/v1/tipo-cambio-sunat
    
    const response = await fetch('https://api.apis.net.pe/v1/tipo-cambio-sunat');
    const data = await response.json();
    
    return {
      compra: data.compra,
      venta: data.venta
    };
  }
}
```

---

### 3. Sistema FEFO (First Expire, First Out)

**Selección automática de unidades:**
```typescript
// services/inventario.service.ts

export class InventarioService {
  /**
   * Selecciona unidades para una venta usando FEFO
   */
  async seleccionarUnidadesFEFO(
    skuId: string,
    cantidad: number
  ): Promise<Unidad[]> {
    // 1. Obtener unidades disponibles del SKU
    const unidadesDisponibles = await getUnidadesBySkuId(
      skuId,
      ['disponible_peru']
    );
    
    if (unidadesDisponibles.length < cantidad) {
      throw new Error('Stock insuficiente');
    }
    
    // 2. Ordenar por fecha de vencimiento (FEFO)
    const unidadesOrdenadas = unidadesDisponibles.sort((a, b) => {
      // Si tienen fecha de vencimiento, ordenar por esa
      if (a.fechaVencimiento && b.fechaVencimiento) {
        return a.fechaVencimiento.toMillis() - b.fechaVencimiento.toMillis();
      }
      
      // Si no tienen vencimiento, usar FIFO (fecha de origen)
      return a.fechaOrigen.toMillis() - b.fechaOrigen.toMillis();
    });
    
    // 3. Seleccionar las primeras 'cantidad' unidades
    return unidadesOrdenadas.slice(0, cantidad);
  }
  
  /**
   * Verifica alertas de vencimiento
   */
  async verificarAlertasVencimiento(): Promise<{
    unidadesProximasVencer: Unidad[];
    skusRiesgoVencimiento: Producto[];
  }> {
    const hoy = new Date();
    const en90Dias = addDays(hoy, 90);
    
    // Unidades que vencen en menos de 90 días
    const unidadesProximas = await getUnidadesByVencimiento(en90Dias);
    
    // SKUs donde más del 50% está próximo a vencer
    const skusRiesgo: Producto[] = [];
    const productos = await getAllProductos();
    
    for (const producto of productos) {
      const totalUnidades = producto.stockPeru;
      const unidadesProximasDelSKU = unidadesProximas.filter(
        u => u.skuId === producto.id
      ).length;
      
      if (unidadesProximasDelSKU / totalUnidades > 0.5) {
        skusRiesgo.push(producto);
      }
    }
    
    return {
      unidadesProximasVencer: unidadesProximas,
      skusRiesgoVencimiento: skusRiesgo
    };
  }
}
```

---

### 4. Generación Automática de Unidades

**Al recibir una OC en USA:**
```typescript
// functions/src/triggers/onOrdenCompraRecibida.ts

export const onOrdenCompraRecibida = functions.firestore
  .document('ordenesCompra/{ocId}')
  .onUpdate(async (change, context) => {
    const antes = change.before.data();
    const despues = change.after.data();
    
    // Detectar cambio de estado a "recibida_usa"
    if (antes.estadoOC !== 'recibida_usa' && despues.estadoOC === 'recibida_usa') {
      const ocId = context.params.ocId;
      const oc = despues as OrdenCompra;
      
      // Generar unidades por cada item de la OC
      for (const item of oc.items) {
        const cantidadRecibida = item.cantidad - (oc.unidadesFaltantes || 0);
        
        for (let i = 0; i < cantidadRecibida; i++) {
          await crearUnidad({
            skuId: item.skuId,
            ocId: ocId,
            fechaOrigen: oc.fechaRecepcionReal || Timestamp.now(),
            costoUSA: item.precioUnitarioUSD,
            tcCompra: oc.tcCompra,
            tcPago: oc.tcPago,
            estado: 'recibida_usa',
            almacenActual: oc.almacenUSADestino,
            ctruInicial: 0, // Se calculará al llegar a Perú
            ctruDinamico: 0,
            historial: [{
              fecha: Timestamp.now(),
              accion: 'Unidad creada desde OC',
              usuario: 'system',
              estadoNuevo: 'recibida_usa',
              detalles: { ocId, ocNumero: oc.numeroOC }
            }],
            creadoPor: 'system',
            fechaCreacion: Timestamp.now()
          });
        }
      }
      
      // Actualizar stock del producto
      for (const item of oc.items) {
        await actualizarStockProducto(item.skuId);
      }
    }
  });
```

---

## 📅 PLAN DE IMPLEMENTACIÓN

### Semana 1-2: Setup & Módulo Productos
- [x] Configuración del proyecto (Vite + React + TypeScript)
- [ ] Setup Firebase (Auth, Firestore, Functions)
- [ ] Implementar autenticación
- [ ] Componentes comunes (Button, Input, Modal, etc.)
- [ ] Layout principal
- [ ] Módulo de Productos completo
  - [ ] CRUD de productos
  - [ ] Investigación de mercado
  - [ ] Sistema de variantes

### Semana 3-4: Módulo Inventario & Control Cambiario
- [ ] Módulo de Almacenes
- [ ] Gestión de Unidades
- [ ] Trazabilidad y estados
- [ ] Sistema FEFO
- [ ] Módulo de Tipo de Cambio
  - [ ] Registro diario
  - [ ] Integración con API
  - [ ] Historial

### Semana 5-6: Módulo Órdenes de Compra
- [ ] CRUD de Órdenes de Compra
- [ ] Registro de pago con TC
- [ ] Recepción en USA
- [ ] Generación automática de unidades
- [ ] Cálculo de diferencias cambiarias
- [ ] Cloud Functions para automatización

### Semana 7-8: Módulo Ventas & CTRU
- [ ] Sistema de Cotizaciones
- [ ] Registro de Ventas
- [ ] Asignación de unidades FEFO
- [ ] Cálculo de rentabilidad
- [ ] Implementación completa del CTRU dinámico
- [ ] Cloud Functions para recálculo CTRU

### Semana 9-10: Dashboard & Testing
- [ ] Dashboard ejecutivo
- [ ] Gráficos y métricas
- [ ] Sistema de alertas
- [ ] Testing integral
- [ ] Optimización de performance
- [ ] Documentación

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

1. ✅ **Revisar y aprobar arquitectura**
2. 🔄 **Inicializar proyecto React + TypeScript + Vite**
3. 🔄 **Configurar Firebase (proyecto, Firestore, Auth)**
4. 🔄 **Crear estructura de carpetas**
5. 🔄 **Implementar componentes base**
6. 🔄 **Comenzar con módulo de Productos**

---

## ❓ PREGUNTAS PENDIENTES

1. **Firebase Project:** ¿Ya tienes un proyecto de Firebase configurado o creamos uno nuevo?
2. **Autenticación:** ¿Roles? (Socio, Vendedor, Operativo)
3. **Dominio:** ¿Nombre del dominio para el deployment?
4. **API de TC:** ¿Prefieres alguna API específica para tipo de cambio?
5. **Hosting:** ¿Firebase Hosting o Vercel/Netlify?

---

**¿Listo para arrancar con el código? 🚀**
