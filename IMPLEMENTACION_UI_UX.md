# Plan de Implementación UI/UX - BusinessMN

## Resumen de Estado

| Fase | Descripción | Estado |
|------|-------------|--------|
| Fase 1 | Quick Wins | ✅ Completada |
| Fase 2 | Componentes Base | ✅ Completada |
| Fase 3 | Refactor de UX | ✅ Completada |
| Fase 4 | Polish y Accesibilidad | ✅ Completada |
| Fase 5 | Optimización de Rendimiento | ✅ Completada |
| Fase 6 | Dashboard y Reportes | ✅ Completada |
| Fase 7 | Notificaciones | ✅ Completada |
| Fase 8 | Navegación y Paginación | ✅ Completada |

---

## ✅ Fase 1: Quick Wins (COMPLETADA)

### 1.1 ConfirmDialog
**Archivo:** `src/components/common/ConfirmDialog.tsx`

**Características:**
- Diálogo modal para confirmaciones (reemplaza `window.confirm()`)
- Variantes: `danger`, `warning`, `info`, `success`
- Iconos contextuales por variante
- Soporte para estado de carga
- Hook `useConfirmDialog` para uso programático con promesas
- Componente global `GlobalConfirmDialog` (ya integrado en App.tsx)
- Hook global `useGlobalConfirmDialog` para uso desde cualquier componente

**Uso:**
```tsx
// Método 1: Con hook global (recomendado para uso sencillo)
const { confirm } = useGlobalConfirmDialog();

const handleDelete = async () => {
  const confirmed = await confirm({
    title: '¿Eliminar producto?',
    message: 'Esta acción no se puede deshacer.',
    variant: 'danger',
    confirmText: 'Eliminar'
  });

  if (confirmed) {
    // Proceder con eliminación
  }
};

// Método 2: Con hook local (más control)
const { dialogProps, confirm } = useConfirmDialog();

// En el JSX:
<ConfirmDialog {...dialogProps} />

// Método 3: Componente directo
<ConfirmDialog
  isOpen={showDialog}
  onClose={() => setShowDialog(false)}
  onConfirm={handleConfirm}
  title="Confirmar acción"
  message="¿Estás seguro?"
  variant="warning"
/>
```

**Pendiente de integrar en:**
- [ ] `src/pages/Ventas/Ventas.tsx` - línea con `window.confirm`
- [ ] `src/pages/OrdenesCompra/OrdenesCompra.tsx` - línea con `window.confirm`
- [ ] `src/pages/Productos/Productos.tsx` - línea con `window.confirm`
- [ ] `src/pages/Gastos/Gastos.tsx` - línea con `window.confirm`

---

## ✅ Fase 2: Componentes Base (COMPLETADA)

### 2.1 Pagination
**Archivo:** `src/components/common/Pagination.tsx`

**Características:**
- Navegación de páginas con números
- Botones primera/última página
- Selector de items por página
- Texto "Mostrando X a Y de Z registros"
- Hook `usePagination` para manejo de estado
- Diseño responsivo

**Uso:**
```tsx
const { currentPage, itemsPerPage, totalPages, setPage, setItemsPerPage } = usePagination({
  totalItems: productos.length,
  initialItemsPerPage: 20
});

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={productos.length}
  itemsPerPage={itemsPerPage}
  onPageChange={setPage}
  onItemsPerPageChange={setItemsPerPage}
/>
```

### 2.2 EmptyState
**Archivo:** `src/components/common/EmptyState.tsx`

**Características:**
- Estados vacíos consistentes con iconos
- Presets predefinidos: `no-data`, `no-results`, `error`, `no-products`, `no-orders`, `no-sales`, `no-customers`, `no-inventory`
- Soporte para acciones (botones)
- Tamaños: `sm`, `md`, `lg`
- Componentes helper: `EmptySearch`, `EmptyError`, `EmptyList`

**Uso:**
```tsx
// Con preset
<EmptyState
  type="no-products"
  actions={[
    { label: 'Agregar producto', onClick: () => setShowModal(true) }
  ]}
/>

// Personalizado
<EmptyState
  icon={<CustomIcon />}
  title="Sin resultados"
  description="No encontramos lo que buscas"
/>

// Helper para búsquedas
<EmptySearch searchTerm={query} onClear={() => setQuery('')} />
```

### 2.3 Stepper
**Archivo:** `src/components/common/Stepper.tsx`

**Características:**
- Indicador visual de progreso multi-paso
- Orientación horizontal y vertical
- Tamaños: `sm`, `md`, `lg`
- Click en pasos completados para navegar
- Hook `useStepper` para control de estado
- Componentes: `StepContent`, `StepNavigation`

**Uso:**
```tsx
const steps = [
  { id: 1, label: 'Datos básicos', description: 'Información del producto' },
  { id: 2, label: 'Precios', description: 'Configurar precios' },
  { id: 3, label: 'Inventario', description: 'Stock inicial' }
];

const { currentStep, nextStep, prevStep, isFirstStep, isLastStep } = useStepper({
  steps,
  onComplete: () => console.log('Completado!')
});

<Stepper steps={steps} currentStep={currentStep} />

<StepContent currentStep={currentStep}>
  <Step1Form />
  <Step2Form />
  <Step3Form />
</StepContent>

<StepNavigation
  onPrev={prevStep}
  onNext={nextStep}
  isFirstStep={isFirstStep}
  isLastStep={isLastStep}
/>
```

### 2.4 Tabs
**Archivo:** `src/components/common/Tabs.tsx`

**Características:**
- Sistema de tabs con contexto React
- Variantes: `default`, `pills`, `underline`, `bordered`
- Tamaños: `sm`, `md`, `lg`
- Soporte para iconos y badges
- Modo controlado y no controlado
- Hook `useTabs` para control programático

**Uso:**
```tsx
<Tabs defaultTab="general" variant="pills">
  <TabList>
    <TabTrigger value="general" icon={<Info />}>General</TabTrigger>
    <TabTrigger value="precios" icon={<DollarSign />}>Precios</TabTrigger>
    <TabTrigger value="stock" badge={5}>Stock</TabTrigger>
  </TabList>

  <TabContent value="general" className="mt-4">
    <GeneralForm />
  </TabContent>
  <TabContent value="precios" className="mt-4">
    <PreciosForm />
  </TabContent>
  <TabContent value="stock" className="mt-4">
    <StockForm />
  </TabContent>
</Tabs>
```

### 2.5 Skeleton
**Archivo:** `src/components/common/Skeleton.tsx`

**Características:**
- Loaders de esqueleto animados
- Variantes: `text`, `circular`, `rectangular`, `rounded`
- Animaciones: `pulse`, `wave`, `none`
- Componentes predefinidos para casos comunes

**Componentes disponibles:**
| Componente | Uso |
|------------|-----|
| `Skeleton` | Elemento básico |
| `TableRowSkeleton` | Fila de tabla |
| `KPISkeleton` | Card de KPI/estadística |
| `ListSkeleton` | Lista de items |
| `ProductCardSkeleton` | Card de producto |
| `FormSkeleton` | Formulario |
| `PageSkeleton` | Página completa |
| `DetailSkeleton` | Detalle de entidad |

**Uso:**
```tsx
// Básico
<Skeleton variant="text" width="200px" height="20px" />

// Tabla
{loading ? (
  <TableRowSkeleton rows={5} columns={6} />
) : (
  <ProductosTable data={productos} />
)}

// Página
{loading ? <PageSkeleton /> : <Dashboard />}
```

---

## ✅ Fase 5: Optimización de Rendimiento (COMPLETADA)

### 5.1 Lazy Loading de Rutas
**Archivo:** `src/App.tsx`

Todas las páginas se cargan bajo demanda con `React.lazy()`:
- Dashboard, Productos, Inventario
- Transferencias, Unidades, TipoCambio
- OrdenesCompra, Ventas, Cotizaciones, Gastos
- Reportes, CTRU, Configuracion
- Usuarios, Auditoria, Tesoreria
- Requerimientos, Expectativas, Maestros

### 5.2 PageLoader
**Archivo:** `src/components/common/PageLoader.tsx`

- Spinner de carga para rutas lazy
- Componente `PageError` para errores de carga

### 5.3 VirtualList
**Archivo:** `src/components/common/VirtualList.tsx`

- Lista virtualizada para grandes datasets
- Solo renderiza items visibles
- Hook `useVirtualTable` para tablas

**Uso:**
```tsx
<VirtualList
  items={productos}
  itemHeight={60}
  height={400}
  renderItem={(producto, index) => (
    <ProductoRow producto={producto} />
  )}
  onEndReached={loadMore}
/>
```

---

## ✅ Fase 6: Dashboard y Reportes (COMPLETADA)

### 6.1 Charts (Recharts)
**Archivo:** `src/components/common/Charts.tsx`

**Componentes de gráficos:**
| Componente | Descripción |
|------------|-------------|
| `SimpleLineChart` | Línea simple |
| `MultiLineChart` | Múltiples líneas |
| `SimpleAreaChart` | Área con gradiente |
| `SimpleBarChart` | Barras verticales/horizontales |
| `MultiBarChart` | Múltiples series de barras |
| `SimplePieChart` | Gráfico circular |
| `DonutChart` | Gráfico de dona |
| `SimpleComposedChart` | Combinación de tipos |
| `MiniChart` | Mini gráfico para KPIs |

**Utilidades:**
- `CHART_COLORS` - Paleta de colores
- `formatCurrency` - Formato moneda PEN
- `formatNumber` - Formato numérico
- `formatPercent` - Formato porcentaje

### 6.2 PDF Service
**Archivo:** `src/services/pdf.service.ts`

**Funcionalidades:**
- Generación de PDFs con jsPDF
- Cabecera corporativa automática
- Tablas con autoTable
- KPI cards
- Plantillas predefinidas:
  - `generateInventoryReport()`
  - `generateSalesReport()`
  - `generateExpenseReport()`

---

## ✅ Fase 7: Notificaciones (COMPLETADA)

### 7.1 Toast System
**Archivo:** `src/components/common/ToastContainer.tsx`

**Características:**
- Toasts efímeros (sistema existente)
- Múltiples variantes (success, error, warning, info)
- Auto-dismiss configurable

---

## ✅ Fase 8: Navegación y Paginación (COMPLETADA)

### 8.1 Breadcrumbs
**Archivo:** `src/components/common/Breadcrumbs.tsx`

**Características:**
- Navegación automática basada en la URL
- Mapeo de rutas a labels legibles
- Soporte para items personalizados
- Componente `SimpleBreadcrumbs` para uso manual
- Hook `useBreadcrumbs` para control programático
- Componente `PageHeaderWithBreadcrumbs` para headers de página

**Uso:**
```tsx
// Automático basado en URL
<Breadcrumbs showHome={true} />

// Con items personalizados
<Breadcrumbs items={[
  { label: 'Productos', href: '/productos' },
  { label: 'Editar', href: undefined }
]} />

// Header completo con breadcrumbs
<PageHeaderWithBreadcrumbs
  title="Editar Producto"
  subtitle="Modifica los datos del producto"
  actions={<Button>Guardar</Button>}
/>
```

### 8.2 Paginación Integrada en Tablas

**Componentes actualizados con paginación:**

| Componente | Archivo | Items por página |
|------------|---------|------------------|
| ClientesCRM | `src/components/Maestros/ClientesCRM.tsx` | 25 |
| MarcasAnalytics | `src/components/Maestros/MarcasAnalytics.tsx` | 25 |
| ProveedoresSRM | `src/components/Maestros/ProveedoresSRM.tsx` | 25 |
| CompetidoresIntel | `src/components/Maestros/CompetidoresIntel.tsx` | 25 |
| ProductosRentabilidadTable | `src/components/modules/reporte/ProductosRentabilidadTable.tsx` | 10 |
| InventarioValorizadoTable | `src/components/modules/reporte/InventarioValorizadoTable.tsx` | 10 |
| VentaTable | `src/components/modules/venta/VentaTable.tsx` | 15 |
| OrdenCompraTable | `src/components/modules/ordenCompra/OrdenCompraTable.tsx` | 15 |

**Características de la paginación:**
- Selector de items por página (10, 25, 50, 100)
- Navegación por números de página
- Indicador "Mostrando X de Y registros"
- Integración con hook `usePagination`

---

## ✅ Fase 3: Refactor de UX (COMPLETADA)

### 3.1 ~~Dividir InvestigacionModal en tabs~~
**Estado:** ✅ Completado
**Archivo:** `src/components/modules/productos/InvestigacionModal.tsx`

**Estructura de tabs implementada:**
| Tab | Nombre | Icono | Contenido |
|-----|--------|-------|-----------|
| 1 | Proveedores | DollarSign | ProveedorUSAList (lista dinámica), Logística estimada |
| 2 | Competencia | Users | CompetidorPeruList (lista dinámica), Nivel de competencia, Ventajas competitivas |
| 3 | Mercado | TrendingUp | Demanda estimada, Tendencia, Volumen de mercado |
| 4 | Decisión | Target | Recomendación (Importar/Investigar más/Descartar), Razonamiento, Notas |

**Características:**
- Header con info del producto siempre visible (SKU, marca, TC actual)
- Badge de vigencia de investigación existente
- Navegación entre tabs con botones "Anterior" / "Siguiente"
- Indicador visual de progreso (4 dots)
- Panel de Análisis Automático siempre visible (Puntuación, CTRU, ROI, Margen, Desglose costos)
- Sección de Punto de Equilibrio siempre visible
- Sección de Historial de Precios (si existe)
- Sección de Alertas (si existen)
- Footer con botones de acción siempre visible
- Variante `pills` con iconos para mejor visualización

### 3.2 ~~Dividir ProductoForm en tabs~~
**Estado:** ✅ Completado
**Archivo:** `src/components/modules/productos/ProductoForm.tsx`

**Estructura de tabs implementada:**
| Tab | Nombre | Icono | Contenido |
|-----|--------|-------|-----------|
| 1 | Información Básica | Tag | Marca, nombre comercial, presentación, dosaje, contenido, UPC |
| 2 | Clasificación | Layers | Grupo, subgrupo, vista previa |
| 3 | Datos Comerciales | DollarSign | Precios, márgenes, flete, CTRU |
| 4 | Inventario | Package | Stock mínimo/máximo, ciclo de recompra |
| 5 | Mercado Libre | ShoppingBag | Habilitado ML, restricciones |

**Características:**
- Sección de Pre-Investigación siempre visible (antes de los tabs)
- Navegación entre tabs con botones "Anterior" / "Siguiente"
- Solo se puede guardar desde el último tab
- Variante `pills` con iconos para mejor visualización
- Vista previa de clasificación en el tab correspondiente

### 3.3 ~~Agregar Stepper al flujo de ventas~~
**Estado:** ✅ Completado
**Archivo:** `src/components/modules/venta/VentaForm.tsx`

**Estructura de pasos implementada:**
| Paso | Nombre | Icono | Contenido |
|------|--------|-------|-----------|
| 1 | Productos | Package | Selección de productos, cantidades, precios, descuento, envío |
| 2 | Cliente | User | Autocomplete de cliente, historial, datos de contacto, canal de venta |
| 3 | Pago | CreditCard | Registro de adelanto (opcional), método de pago, cuenta destino, observaciones |
| 4 | Confirmar | CheckCircle | Resumen completo de productos, cliente, totales y confirmación |

**Características:**
- Stepper visual horizontal con iconos descriptivos
- Navegación con botones "Anterior" / "Siguiente"
- Click en pasos completados para volver atrás
- Validación por paso antes de avanzar:
  - Paso 1: Al menos un producto válido con cantidad y precio
  - Paso 2: Nombre del cliente requerido
  - Paso 3: Validación de monto de adelanto si está activo
- Resumen completo en paso final con todos los detalles
- Botones de acción solo en el último paso (Cotización / Confirmar Venta)
- Hook `useStepper` para control de estado del flujo

### 3.4 ~~Implementar Breadcrumbs~~
**Estado:** ✅ Completado (ver Fase 8.1)

### 3.5 ~~Scroll interno en modales con sticky footer~~
**Estado:** ✅ Completado

**Mejoras implementadas en Modal.tsx:**
- Header sticky con sombra dinámica al hacer scroll
- Footer sticky con sombra dinámica
- Indicador visual de scroll (gradiente)
- Bloqueo de scroll del body
- Soporte para tecla Escape
- Nuevo componente `ModalFooter` para alineación de botones
- Props adicionales: `disableBackdropClick`, `disableEscapeKey`, `contentPadding`, `showHeaderShadow`, `showScrollIndicator`

---

## ✅ Fase 4: Polish y Accesibilidad (COMPLETADA)

### 4.1 ARIA Labels
**Estado:** ✅ Completado

**Mejoras implementadas:**

| Componente | Atributos ARIA agregados |
|------------|-------------------------|
| `Modal` | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, focus trap |
| `Tabs` | `role="tablist"`, `aria-selected`, `aria-controls`, `tabIndex` dinámico |
| `TabPanel` | `role="tabpanel"`, `aria-labelledby`, `tabIndex` |
| `Stepper` | `<nav>` con `aria-label`, `<ol>` con `role="list"`, `aria-current="step"` |
| `StepNavigation` | `<nav>` con `aria-label`, `aria-busy` para loading |
| `Input` | `aria-invalid`, `aria-describedby`, `aria-required`, `htmlFor` |
| `Select` | `aria-invalid`, `aria-describedby`, `aria-required`, `htmlFor` |
| `Button` | `aria-busy`, `aria-disabled` |

**Características adicionales:**
- IDs automáticos con `useId()` para asociar labels con inputs
- Mensajes de error con `role="alert"`
- Focus trap en modales para navegación por teclado
- Restauración de foco al cerrar modal
- Soporte completo para navegación con teclado

### 4.2 Optimizar modales para móvil
**Estado:** ✅ Completado
**Archivo:** `src/components/common/Modal.tsx`

**Nuevas props:**
```tsx
interface ModalProps {
  // ... props existentes
  mobileMode?: 'fullscreen' | 'bottom-sheet' | 'default';
  swipeToClose?: boolean;
}
```

**Características:**
- **Modo fullscreen:** Modal ocupa toda la pantalla en móviles (`max-sm:h-full`)
- **Modo bottom-sheet:** Modal aparece desde abajo con bordes redondeados superiores
- **Swipe to close:** Indicador visual y gesto de deslizar hacia abajo para cerrar
- **Safe area:** Padding para dispositivos con notch (`env(safe-area-inset-bottom)`)
- **Touch optimizado:** Áreas de tap más grandes, botón de cerrar más accesible
- **Títulos truncados:** Evita overflow en pantallas pequeñas

**Uso:**
```tsx
// Full screen en móviles (default)
<Modal isOpen={open} onClose={close} title="Título" mobileMode="fullscreen">
  {content}
</Modal>

// Bottom sheet con swipe
<Modal isOpen={open} onClose={close} title="Título" mobileMode="bottom-sheet" swipeToClose>
  {content}
</Modal>
```

### 4.3 Animaciones de transición
**Estado:** ✅ Completado

**Componentes con animaciones:**

| Componente | Animación |
|------------|-----------|
| `Modal` | Fade in/out backdrop + scale/translate modal |
| `TabPanel` | Fade + slide up al cambiar tabs |
| `TabsWithContent` | Fade + slide up al cambiar contenido |
| `StepContent` | Fade + slide horizontal al cambiar pasos |

**Características:**
- Transiciones CSS con `transition-all duration-150/200 ease-out`
- Animaciones de entrada: opacity 0→1, translate-y/x→0, scale 0.95→1
- Animaciones de salida suaves con cleanup de estado
- Uso de `requestAnimationFrame` para transiciones fluidas
- Prop `animate={false}` para deshabilitar animaciones si es necesario

### 4.4 ~~Reemplazar spinners con Skeletons~~
**Estado:** ✅ Completado

**Páginas actualizadas:**
- [x] Dashboard - Usa `DashboardSkeleton`
- [x] Productos - Ya usa `TableRowSkeleton`
- [x] Ventas - `VentaTable` tiene skeleton interno
- [x] Órdenes de compra - `OrdenCompraTable` tiene skeleton interno
- [x] Reportes - Tablas con skeleton interno
- [x] Inventario - Usa `InventarioSkeleton` (Header + 6 KPIs + Filtros + Tabla)
- [x] Gastos - Usa `GastosSkeleton` (Header + 4 KPIs + Gráfico distribución + Filtros + Tabla)

**Skeletons disponibles:**
| Skeleton | Descripción |
|----------|-------------|
| `DashboardSkeleton` | Dashboard completo con KPIs, gráficos y widgets |
| `InventarioSkeleton` | Página Inventario: 6 KPIs, filtros y tabla de 7 columnas |
| `GastosSkeleton` | Página Gastos: 4 KPIs, gráfico de distribución, filtros y tabla |
| `PageSkeleton` | Página genérica con header, 4 KPIs y tabla |
| `DetailSkeleton` | Detalle de entidad con avatar, stats, tabs y contenido |
| `FormSkeleton` | Formulario con campos y botones |
| `TableRowSkeleton` | Filas de tabla (configurable columnas/filas) |
| `KPISkeleton` | Grid de KPI cards |
| `ListSkeleton` | Lista de items con avatar |
| `ProductCardSkeleton` | Grid de cards de producto |

---

## 📁 Estructura de Componentes Comunes

```
src/components/common/
├── Badge.tsx
├── Breadcrumbs.tsx     ✅ Nuevo (Fase 8)
├── Button.tsx
├── Card.tsx
├── Charts.tsx          ✅ Nuevo
├── ConfirmDialog.tsx   ✅ Actualizado (GlobalConfirmDialog)
├── Dropdown.tsx
├── EmptyState.tsx      ✅ En ProfessionalUI
├── EmptyStateAction.tsx
├── index.ts            ✅ Actualizado
├── Input.tsx
├── KPICard.tsx
├── ListSummary.tsx
├── Modal.tsx
├── PageLoader.tsx
├── Pagination.tsx      ✅ Integrado en tablas (Fase 8)
├── ProfessionalUI.tsx
├── QuickActions.tsx
├── SearchInput.tsx
├── Select.tsx
├── Skeleton.tsx
├── Stepper.tsx         ✅ Nuevo
├── Tabs.tsx
├── ToastContainer.tsx
├── Tooltip.tsx
└── VirtualList.tsx     ✅ Nuevo
```

---

## 📁 Hooks Disponibles

```
src/hooks/
├── index.ts
├── useAutoSave.ts      ✅ Nuevo - Autoguardado de borradores
└── useFormValidation.ts ✅ Nuevo - Validación con Zod
```

**useFormValidation:**
- Validación de formularios con Zod
- Schemas comunes: email, DNI, RUC, teléfono, montos, etc.

**useAutoSave:**
- Guarda borradores en localStorage
- Debounce configurable
- Detección de cambios sin guardar

---

## 📁 Servicios

```
src/services/
├── pdf.service.ts      ✅ Nuevo - Generación de PDFs
└── ... otros servicios existentes
```

---

## 🔧 Dependencias Agregadas

```json
{
  "recharts": "^2.x",      // Gráficos
  "jspdf": "^2.x",         // Generación de PDFs
  "jspdf-autotable": "^3.x", // Tablas en PDFs
  "zod": "^3.x"            // Validación de schemas
}
```

---

## 📋 Checklist de Integración

### Componentes globales (App.tsx)
- [x] GlobalConfirmDialog
- [x] ToastContainer
- [x] Lazy loading de rutas

### Por página - Actualizar con nuevos componentes

#### Dashboard
- [ ] Usar Charts para gráficos
- [ ] Usar Skeleton para loading

#### Productos
- [ ] Usar Pagination
- [ ] Usar EmptyState cuando no hay productos
- [ ] Usar Skeleton para loading
- [ ] Usar ConfirmDialog para eliminación
- [ ] Dividir ProductoForm en Tabs

#### Inventario
- [ ] Usar Pagination
- [ ] Usar EmptyState
- [ ] Usar Skeleton
- [ ] Usar VirtualList para listas largas

#### Ventas
- [x] Usar Stepper en el flujo de venta
- [ ] Usar ConfirmDialog para cancelaciones
- [ ] Usar EmptyState

#### Órdenes de Compra
- [ ] Usar ConfirmDialog
- [ ] Usar EmptyState
- [ ] Usar Pagination

#### Gastos
- [ ] Usar ConfirmDialog
- [ ] Usar EmptyState
- [ ] Usar Pagination

#### Reportes
- [ ] Integrar pdf.service para exportación
- [ ] Usar Charts para visualizaciones

---

## 🚀 Próximos Pasos Recomendados

1. **Integrar ConfirmDialog** en las 4 páginas que usan `window.confirm()`
2. **Agregar Skeletons** a las páginas principales durante carga
3. **Implementar Pagination** en tablas con muchos registros
4. **Dividir ProductoForm** en tabs para mejor UX
5. **Agregar Stepper** al flujo de ventas

---

*Última actualización: Diciembre 2024*
*Fase 4 completada: Diciembre 2024*
