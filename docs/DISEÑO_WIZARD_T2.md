# Diseño Wizard T2 — Casilla Internacional a Almacén Perú

Documento de auditoría y diseño previo a la implementación.
Fecha: 2026-04-20
Referencia de mockup: `docs/mockups/envios-transversal-s43.html` tab "3 · Wizard T2 completo"
Referencia de implementación: `src/components/modules/ordenCompra/OCWizardV3/`

---

## Sección 1 — Auditoría de componentes del design system

### WizardShell
`src/design-system/components/WizardShell.tsx`

Contenedor multi-paso completo: header con título y botón cerrar, stepper horizontal clickable, grid body con panel lateral de preview opcional (320px fijo en lg), footer con botones Cancelar / Anterior / Siguiente / Confirmar, estado loading con spinner, hint bajo el botón primario, variante `page` o `modal`.

**Uso en T2: directo, sin modificar.** Es el contenedor raíz del wizard. Se instancia exactamente igual que en OCWizardV3. El panel `previewPanel` recibe un componente `EnvioT2WizardPreview` nuevo. La prop `confirmLabel` cambia a "Crear envío". Los 5 pasos se definen como array `WizardStep[]`.

---

### EntityPicker
`src/design-system/components/EntityPicker.tsx`

Selector genérico con búsqueda interna, agrupación por categorías, variante `list` o `grid`, botón crear nuevo, estados loading y vacío. Selección controlada via `selected` + `onSelect`. Renderizado de cada item delegado a `renderCard`.

**Uso en T2: directo en paso 1 (Origen) y paso 3 (Transporte).**

- Paso 1: `EntityPicker<Casilla>` con `variant="grid"` para seleccionar casilla internacional. `renderCard` muestra bandera del país + nombre + ciudad + badges de estado + contador de unidades disponibles. Si hay solo 1-2 casillas activas se puede omitir el buscador (`showSearch={false}`).
- Paso 3: `EntityPicker<Colaborador>` con `groups` para separar viajeros y couriers. `renderCard` muestra avatar con color temático + nombre + tipo + tarifa configurada.

El patrón colapsable (seleccionada visible + botón "Cambiar" para reexpandir) que usa StepRuta de OCWizardV3 **no está en EntityPicker** — está implementado inline en StepRuta. Para T2 conviene replicar ese mismo patrón encima del EntityPicker.

---

### RouteVisual
`src/design-system/components/RouteVisual.tsx`

Visualizador de ruta logística A→B→C con nodos tipados (proveedor, casilla, destino, almacen), banderas, etiquetas de segmento, estados semánticos (pending / active / done / empty), orientación horizontal o vertical, tamaños sm / md / lg.

**Uso en T2: directo en paso 5 (Confirmar), extensión para variante grande.**

- Paso 5: se usa `size="lg"` con 2 nodos (casilla origen + almacén Perú) y 1 segmento (viajero/courier). Es la misma construcción que `buildPreviewNodes()` en OCWizardPreview pero con el nodo destino siendo `tipo='almacen'` y `flag='🇵🇪'`.
- El mockup muestra nodos de 4rem con flag de 2.5rem — eso corresponde a `size="lg"` (w-20 h-20, text-3xl). Encaja sin cambios.
- El panel de preview lateral usa `size="sm"` igual que OCWizardPreview.

---

### DynamicChargesSection
`src/design-system/components/DynamicChargesSection.tsx`

Lista dinámica de cargos / descuentos / impuestos con pills de tipo, input de concepto con autocomplete, toggle %/$ para impuestos, total al pie, estado readonly. Colores por kind: cargos=sky, descuentos=emerald, impuestos=purple.

**Uso en T2: parcial en paso 4 (Costos landed), como complemento de los fees adicionales.**

Los "costos adicionales" (fee recepción destino, fee casilla, otros gastos) del mockup son cargos landed de estructura idéntica a `DynamicChargeItem`. Se puede usar `DynamicChargesSection kind="cargo"` con `conceptosSugeridos={['Recepción aeropuerto', 'Fee casilla', 'Seguro', 'Aduana pre-pagada']}`. Sin embargo, la sección de tarifa principal (por peso / estándar / monto total / variable) es distinta y requiere un componente nuevo (ver Sección 2).

---

### FormField
`src/design-system/components/FormField.tsx`

Wrapper label + input + error + hint. Soporta layout vertical (default) y horizontal. Acepta cualquier children como control.

**Uso en T2: directo en todos los pasos.**

- Paso 1: `FormField label="Fecha estimada de salida"` y `FormField label="Fecha estimada de llegada"` con `<input type="date">`.
- Paso 3: `FormField label="Número de tracking (opcional)"` y `FormField label="Almacén de llegada"` con `<select>`.
- Paso 4: `FormField label="Tarifa por libra"` y `FormField label="Tipo de cambio"` con inputs numéricos.

---

### StatCard
`src/design-system/components/StatCard.tsx`

Tarjeta de una métrica con label, valor, icono, trend opcional, variante semántica que controla el color del borde izquierdo y el fondo del icono. Tamaños sm y md. Clickable con prop `onClick`.

**Uso en T2: directo en paso 1 (preview contenido casilla) y paso 5 (resumen columnas).**

- Paso 1: grid de 4 StatCards (unidades disponibles, productos, OCs distintas, pre-vendidas). La cuarta usa `variant="success"` para destacar el conteo de pre-vendidas con fondo emerald-50.
- Paso 5: 3 StatCards en fila (Contenido, Valor productos, Costos landed). La de costos usa `variant="brand"` con valor en teal.

---

### KPIBar
`src/design-system/components/KPIBar.tsx`

Grid responsive de StatCards. Solo provee la cuadrícula, no los contenidos.

**Uso en T2: directo en paso 1 y paso 5** para envolver los StatCards del preview de casilla y el resumen final. `columns={4}` para paso 1, `columns={3}` para paso 5.

---

### StatusBadge
`src/design-system/components/StatusBadge.tsx`

Badge semántico con variantes, dot opcional, icono. Versiones sm (default) y md.

**Uso en T2: directo en múltiples lugares.**

- En la card de casilla seleccionada: badge "Activa" variant="success".
- En cada UnidadPickerItem: badge "Reservada · COT-145" variant="success" con dot para unidades pre-vendidas, sin badge para unidades normales.
- En el card del colaborador seleccionado: badge "Disponible" variant="success".
- En el resumen paso 5: badge "4 pre-vendidas" variant="success".

---

### ProductoDisplay
`src/design-system/components/ProductoDisplay.tsx`

Visualización estandarizada de producto en 4 variantes (card, row, inline, compact). Usa `getDescripcionProducto()` internamente. Soporta slot `trailing`.

**Uso en T2: directo en paso 2 (Picking) como header de cada grupo de producto.**

Variante `row` en el header de cada `ProductoGroup` (el bloque que agrupa las unidades de un mismo producto). El slot `trailing` muestra el stepper de cantidad + ratio "N/M seleccionadas". Esta es la misma composición que usa `StepProductos` de OCWizardV3 y `EnvioStepProductos` del wizard V2.

---

### DraftBanner
`src/design-system/components/DraftBanner.tsx`

Banner amber para borrador detectado con botones Continuar / Descartar. Ya incluye helper `formatFechaRelativa`.

**Uso en T2: directo.** El wizard T2 tendrá autoguardado con `useWizardAutosave` igual que OCWizardV3. El DraftBanner se renderiza encima del WizardShell con la misma estructura de `OCWizardV3.tsx` líneas 409-420.

---

### DataCard
`src/design-system/components/DataCard.tsx`

Card para items de lista: title, subtitle, code, status badge, stats grid (bg-slate-50 2 columnas), badges row, meta con iconos. Borde izquierdo de acento.

**Uso en T2: no directo.** Las cards del Paso 3 (selector de colaborador) tienen una estructura de avatar + nombre + tarifa + disponibilidad que es más rica que lo que DataCard soporta. Se usará una renderCard personalizada dentro del EntityPicker, no DataCard directamente. Sin embargo DataCard podría usarse en el resumen de la casilla seleccionada si se decide no construir un componente nuevo.

---

### DataTable
`src/design-system/components/DataTable.tsx`

Tabla con sorting, filas expandibles, filas seleccionables con checkbox, skeleton loading, sticky header, ocultar columnas en mobile.

**Uso en T2: no.** La tabla del paso 4 (Preview CTRU landed) es una tabla estática de 5 columnas sin sorting ni selección. Se construye con HTML semántico directo para evitar overhead. Ver componente nuevo `CTRULandedPreview` en Sección 2.

---

### ContentArea
`src/design-system/components/ContentArea.tsx`

Wrapper para toggle tabla/cards con loading skeleton y empty state. Requiere dos componentes: tableComponent y cardComponent.

**Uso en T2: no.** No hay toggle tabla/cards en el wizard. Es un patrón de vistas de listado, no de wizards.

---

### FilterDrawer
`src/design-system/components/FilterDrawer.tsx`

Panel lateral con overlay, botón cerrar con Escape, contador de filtros activos, footer limpiar/aplicar.

**Uso en T2: no.** No hay filtros en el wizard T2.

---

### FilterSection
`src/design-system/components/FilterSection.tsx`

Sección colapsable para usar dentro de FilterDrawer.

**Uso en T2: no.** Mismo razonamiento que FilterDrawer.

---

### FormModal
`src/design-system/components/FormModal.tsx`

Wrapper de Modal para formularios con footer estandarizado Cancelar/Confirmar. Tres variantes: create, edit, confirm.

**Uso en T2: no en el wizard.** Posiblemente se use si en el paso 3 se abre un modal inline para crear un colaborador nuevo (el EntityPicker tiene `onCreateNew`).

---

### PageShell
`src/design-system/components/PageShell.tsx`

Wrapper de página con padding y spacing estándar.

**Uso en T2: no.** El wizard tiene su propio wrapper con `fixed inset-0` igual que OCWizardV3.

---

### PageHeader
`src/design-system/components/PageHeader.tsx`

Header de página con título, subtítulo, icono, acciones, badge.

**Uso en T2: no.** El WizardShell ya provee su propio header.

---

### Toolbar
`src/design-system/components/Toolbar.tsx`

Barra de herramientas con búsqueda y acciones — no auditada en detalle porque no aplica a wizards.

**Uso en T2: no.**

---

## Sección 2 — Gaps identificados: componentes nuevos

### 2.1 UnidadPickerItem

**Nombre:** `UnidadPickerItem`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/UnidadPickerItem.tsx`
**Razón:** No existe ningún componente que represente una fila de unidad individual con checkbox de selección, badge de prioridad (pre-vendida), referencia a cotización y fecha de recepción. El `EnvioStepProductos` del wizard V2 trabaja con cantidades agregadas por producto (FIFO implícito), pero el Wizard T2 necesita selección explícita de unidades individuales porque la priorización requiere mostrar cuáles están reservadas y permitir al usuario confirmar o modificar la selección.

```typescript
interface UnidadPickerItemProps {
  unidadId: string;
  codigo: string;               // "UN-8823"
  fechaRecepcion?: string;      // "29-mar"
  esPrioritaria: boolean;       // true si tiene cotizacion con adelanto pagado
  cotizacionRef?: string;       // "COT-145" — solo si esPrioritaria
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}
```

El componente renderiza una fila `px-4 py-2 flex items-center justify-between`. Cuando `esPrioritaria=true`: fondo `bg-emerald-50/50` + animación `prio-pulse` (definida en mockup, 2s infinite) + badge `StatusBadge variant="success"` con texto "Reservada · {cotizacionRef}". Cuando `esPrioritaria=false`: sin fondo especial, sin badge. La fecha aparece a la derecha como `text-xs text-slate-500`.

---

### 2.2 ProductoPickingGroup

**Nombre:** `ProductoPickingGroup`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/ProductoPickingGroup.tsx`
**Razón:** Es el agrupador colapsable que contiene todas las unidades de un mismo producto. Tiene un header con `ProductoDisplay variant="row"` + stepper de cantidad total + contador "Disponibles: N", y un body con lista de `UnidadPickerItem`. El stepper del header controla cuántas unidades del grupo están seleccionadas (atajo para no marcar una por una). No hay componente equivalente en el design system ni en los wizards existentes — `EnvioStepProductos` usa solo el stepper agregado sin mostrar las unidades individuales.

```typescript
interface ProductoPickingGroupProps {
  producto: ProductoDisplayData;  // del design-system
  sku?: string;
  procedenciaLabel?: string;       // "OC-2026-001 (Amazon)"
  unidades: Array<{
    id: string;
    codigo: string;
    fechaRecepcion?: string;
    esPrioritaria: boolean;
    cotizacionRef?: string;
  }>;
  seleccionadas: Set<string>;       // IDs de unidades seleccionadas
  onToggle: (id: string) => void;
  onSetCantidad: (n: number) => void; // Atajo stepper: selecciona primeras N (priorizadas primero)
}
```

La lógica de `onSetCantidad` selecciona primero las unidades con `esPrioritaria=true` y completa con FIFO por fecha de recepción si N supera el total de prioritarias.

---

### 2.3 BannerPriorizacion

**Nombre:** `BannerPriorizacion`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/BannerPriorizacion.tsx`
**Razón:** Banner contextual específico de la lógica de pre-ventas que aparece en el paso 2. No es reutilizable más allá del contexto de picking de envíos, por eso va en `pages/Envios/` y no en el design system. No se puede hacer con DraftBanner (que es amber y tiene semántica de borrador) ni con un div inline (la lógica del checkbox "Incluir todas" y el conteo requieren estado propio).

```typescript
interface BannerPriorizacionProps {
  cantidadPrioritarias: number;       // "4 unidades están pre-vendidas"
  incluirTodasChecked: boolean;
  onToggleIncluirTodas: (v: boolean) => void;
  className?: string;
}
```

Fondo `bg-emerald-50 border-emerald-200`, icono target (Lucide: `Target`), texto descriptivo, checkbox inline "Incluir todas las prioritarias automáticamente".

---

### 2.4 TarifaPresetSelector

**Nombre:** `TarifaPresetSelector`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/TarifaPresetSelector.tsx`
**Razón:** Las 4 cards de método de tarifa (Por peso, Estándar, Monto total, Variable) son un selector de radio visual con semántica propia de costos de transporte. No existe nada equivalente en el design system. El `EntityPicker` podría usarse pero sería sobredimensionado para 4 opciones fijas con descripciones cortas. Las cards no representan entidades de datos sino opciones de configuración.

```typescript
type MetodoTarifa = 'por_peso' | 'estandar' | 'monto_total' | 'variable';

interface TarifaPreset {
  id: MetodoTarifa;
  label: string;           // "Por peso"
  sublabel: string;        // "$X/libra"
  descripcion?: string;    // descripción adicional opcional
}

interface TarifaPresetSelectorProps {
  value: MetodoTarifa | null;
  onChange: (v: MetodoTarifa) => void;
  presets?: TarifaPreset[];   // Si no se pasa, usa los 4 defaults
  preloaded?: Partial<Record<MetodoTarifa, number>>; // valores pre-llenados desde colaborador
}
```

Grid de 4 columnas (2 en móvil). Card seleccionada: `border-2 border-teal-500 bg-teal-50`. Card no seleccionada: `border border-slate-200 hover:border-slate-300`. Cuando `preloaded` tiene valor para el preset, muestra el valor pre-llenado en el sublabel (ej: "$8.00/libra" en vez de "$X/libra").

---

### 2.5 CTRULandedPreview

**Nombre:** `CTRULandedPreview`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/CTRULandedPreview.tsx`
**Razón:** Tabla de 5 columnas (Producto, Uds, CTRU base, + Landed prorateado, CTRU final) con fila de totales en negrita. No usa DataTable porque no hay sorting, selección ni expansión — es una tabla puramente informativa y de preview. La columna de delta de landed usa `text-teal-700` para destacar el incremento. La tabla necesita calcular el prorrateo dinámicamente a medida que el usuario cambia la tarifa.

```typescript
interface CTRULandedFilaData {
  productoNombre: string;
  cantidadUnidades: number;
  ctruBaseUSD: number;       // CTRU original de cada unidad (promedio del lote)
  landedDeltaUSD: number;    // porción de costos landed asignada a este grupo
  ctruFinalUSD: number;      // ctruBase + landedDelta
}

interface CTRULandedPreviewProps {
  filas: CTRULandedFilaData[];
  loading?: boolean;         // true mientras recalcula al cambiar tarifa
  className?: string;
}
```

El contenedor tiene fondo `bg-slate-50 border-slate-200 rounded-lg p-4`. Header de tabla con `text-xs text-slate-600`. Fila de totales con `border-t-2 border-slate-300 font-bold`. Si `loading=true` muestra un overlay semi-transparente con spinner teal para no hacer parpadear la tabla entera.

---

### 2.6 EnvioT2WizardPreview (panel lateral)

**Nombre:** `EnvioT2WizardPreview`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/EnvioT2WizardPreview.tsx`
**Razón:** Panel lateral del WizardShell con resumen en vivo del wizard T2. Análogo a `OCWizardPreview` para OC. Misma estructura de `PreviewSection` internos con iconos + estado vacío iterativo. No va en design system porque es específico del dominio del wizard T2.

```typescript
interface EnvioT2WizardPreviewProps {
  casillaOrigen?: { nombre: string; pais: string; flag: string };
  almacenDestino?: { nombre: string };
  colaborador?: { nombre: string; tipoLabel: string };
  unidadesSeleccionadas: number;
  productosCount: number;
  prioritariasIncluidas: number;
  costoFlete: number;
  costoFees: number;
  costoTotal: number;
  tcHoy?: number;
}
```

Secciones: Ruta (RouteVisual size="sm" + colaborador), Contenido (unidades + productos + prioritarias), Costos (flete + fees + total). El gran total usa el mismo bloque `bg-teal-50 border-teal-200` de OCWizardPreview con conversión PEN cuando `tcHoy` está disponible.

---

### 2.7 ColaboradorTransporteCard (renderCard para EntityPicker)

**Nombre:** `ColaboradorTransporteCard`
**Ubicación:** `src/pages/Envios/EnvioWizardT2/ColaboradorTransporteCard.tsx`
**Razón:** El `renderCard` del EntityPicker en paso 3 muestra: avatar con inicial y color temático por tipo de colaborador (viajero=sky, courier=amber), nombre, tipo descriptivo, tarifa pre-configurada y badge de disponibilidad. Es la misma información que en `ColaboradorRow` de `DespacharEnvioModal` pero adaptada al layout de EntityPicker (no tiene botón de acción propio). Conviene extraerlo como componente para no mezclar lógica de presentación dentro del JSX del paso.

```typescript
interface ColaboradorTransporteCa rdProps {
  colaborador: Colaborador;
  isSelected: boolean;
}
```

---

## Sección 3 — Composición del Wizard

```
WizardT2Page (src/pages/Envios/EnvioWizardT2/WizardT2Page.tsx)
├── DraftBanner (existente)                      ← solo si hay borrador detectado
└── WizardShell (existente)
    │  title="Nuevo envío — Casilla Internacional a Perú"
    │  subtitle="Tipo C · {casillaOrigen?.nombre ?? 'Origen no definido'}"
    │  steps=[Origen, Picking, Transporte, Costos, Confirmar]
    │  previewPanel=<EnvioT2WizardPreview .../>   ← nuevo
    │
    ├── PASO 0 — Origen
    │   ├── EntityPicker<Casilla> variant="grid"  ← existente
    │   │   └── renderCard → CasillaOrigenCard    ← inline (bandera + nombre + ciudad + unidades)
    │   ├── KPIBar columns={4}                    ← existente (solo si casilla seleccionada)
    │   │   ├── StatCard label="Unidades disp." variant="neutral"
    │   │   ├── StatCard label="Productos"       variant="neutral"
    │   │   ├── StatCard label="OCs distintas"   variant="neutral"
    │   │   └── StatCard label="Pre-vendidas"    variant="success"  ← emerald
    │   ├── FormField label="Fecha estimada de salida"   ← existente
    │   │   └── <input type="date">
    │   └── FormField label="Fecha estimada de llegada"  ← existente
    │       └── <input type="date">
    │
    ├── PASO 1 — Picking
    │   ├── BannerPriorizacion                   ← nuevo
    │   ├── div.space-y-3 (lista de grupos)
    │   │   └── ProductoPickingGroup[]           ← nuevo (uno por producto en casilla)
    │   │       └── UnidadPickerItem[]           ← nuevo (una por unidad del producto)
    │   └── div.bg-teal-50 (barra resumen sticky al fondo)
    │       └── "N unidades · M productos · K prioritarias ✓"
    │
    ├── PASO 2 — Transporte
    │   ├── TipoTransporteSelector               ← inline (2 cards radio: viajero / courier)
    │   │   NOTA: no se crea como componente separado — son 2 cards con radio
    │   │   visual análogas a StepRuta de OCWizardV3 sección "¿Cómo llega?"
    │   ├── EntityPicker<Colaborador> groups=[viajeros, couriers]  ← existente
    │   │   └── renderCard → ColaboradorTransporteCard             ← nuevo
    │   ├── FormField label="Número de tracking (opcional)"        ← existente
    │   ├── FormField label="Almacén de llegada"                   ← existente
    │   └── div.bg-sky-50 (info tarifa del colaborador seleccionado — condicional)
    │
    ├── PASO 3 — Costos
    │   ├── TarifaPresetSelector                 ← nuevo
    │   ├── div.grid.grid-cols-2 (inputs dinámicos según preset)
    │   │   ├── FormField label="Tarifa {unit}"  ← existente (varía: /libra, /unidad, total)
    │   │   └── FormField label="Tipo de cambio" ← existente
    │   ├── DynamicChargesSection kind="cargo"   ← existente (fees adicionales)
    │   │   conceptosSugeridos={['Recepción aeropuerto', 'Fee casilla', 'Seguro', ...]}
    │   └── CTRULandedPreview                    ← nuevo
    │
    └── PASO 4 — Confirmar
        ├── RouteVisual size="lg" orientation="horizontal"  ← existente (ruta grande)
        ├── KPIBar columns={3}                              ← existente
        │   ├── StatCard label="Contenido"          variant="neutral"
        │   ├── StatCard label="Valor productos"    variant="neutral"
        │   └── StatCard label="Costos landed"      variant="brand"   ← teal
        ├── div.bg-sky-50 (lista de efectos al confirmar)  ← inline, no componente
        ├── div.bg-slate-50 (responsable de reclamos)      ← inline
        └── div.flex.justify-end (botones finales — manejados por WizardShell.footer)
```

---

## Sección 4 — Tokens y semántica

### Mapeo de estados semánticos para T2

**Estado "confirmado" del envío:**
El tipo `Envio` maneja estados como `borrador`, `confirmado`, `en_transito`, `recibido`. El estado `confirmado` en el contexto del paso 5 ("Al confirmar desde /envios: estado borrador → confirmado") usa `statusColors.info` (sky-50 / sky-700). Esto es consistente con el uso en `EnvioDetailModal` donde el estado en tránsito usa sky y el state info del mockup usa `bg-blue-50 text-blue-800`.

Referencia concreta: `src/pages/Envios/EnvioCard.tsx` y `src/pages/Envios/EnvioDetailModal.tsx` usan badges de estado del envío.

**Priorización de unidades pre-vendidas (fondo emerald):**
El banner de priorización y el fondo de `UnidadPickerItem` con `esPrioritaria=true` usan `semantic.success = 'emerald'`. En `tokens.ts`: `statusColors.success = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' }`.

El mockup usa `bg-emerald-50/50` (50% opacidad) para el fondo de fila + `bg-emerald-200 text-emerald-900` para el badge de "Reservada". Esto es ligeramente más saturado que `statusColors.success.bg` (que es `bg-emerald-50` sin opacidad). Para el badge se puede usar `StatusBadge variant="success"` directamente. Para el fondo de fila se aplica `bg-emerald-50/50` directamente (Tailwind admite la opacidad).

**Headers de tarjeta teal:**
El color teal (`semantic.brand = 'teal'`) se usa como color de acción primario en todo el ERP. Los headers de sección activa en WizardShell usan `bg-teal-600`. El gran total en OCWizardPreview usa `bg-teal-50 border-teal-200`. Los botones primarios usan `bg-teal-600 hover:bg-teal-700`.

Ejemplos de uso real de teal en pages/:
1. `src/pages/Envios/EnvioDetailModal.tsx` — header hero usa gradiente `from-teal-600 to-teal-800` para el estado activo del envío.
2. `src/pages/Envios/EnvioCard.tsx` — borde `border-2 border-teal-200 hover:border-teal-400` para el envío tipo C destacado en el mockup.
3. `src/components/modules/ordenCompra/OCWizardV3/OCWizardPreview.tsx` línea 128 — bloque `bg-teal-50 border-teal-200` para gran total. Replicar exactamente para `EnvioT2WizardPreview`.

**Confirmación de selección / "X prioritarias incluidas":**
En el resumen de picking se usa emerald: `text-emerald-700` con check. En tokens: no hay token específico para "confirmado" — se usa `semantic.success` = emerald directamente en clases Tailwind.

---

## Sección 5 — Referencias visuales del ERP actual

### Referencia principal: OCWizardV3

Los archivos más relevantes para copiar patterns son:

**`src/components/modules/ordenCompra/OCWizardV3/OCWizardV3.tsx`**
- Copiar: estructura del `fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 md:p-8 flex flex-col` para el wrapper del wizard T2.
- Copiar: DraftBanner encima del WizardShell con `mb-3 flex-shrink-0`.
- Copiar: `w-full max-w-7xl mx-auto flex-1 min-h-0` + `className="h-full"` en WizardShell.
- Copiar: función `isStepValid(stepIndex, state)` — implementar equivalente para T2.
- Copiar: patrón `useWizardAutosave` con `buildResumen` y `buildMonto`.
- NO copiar: auto-sync de shipping a cargos (lógica específica de OC). En T2 los costos landed son propios del wizard.

**`src/components/modules/ordenCompra/OCWizardV3/StepRuta.tsx`**
- Copiar: patrón colapsable (selectedOverride + botón "Cambiar"). Se replica en paso 1 para la casilla y en paso 3 para el colaborador. Código en StepRuta alrededor de las líneas 95-120 (estados `proveedorExpandedOverride`, etc.).
- Copiar: secciones `ProveedorCard` / `TipoCard` como referencia para las 2 cards radio de tipo de transporte (viajero vs courier) en paso 3.
- NO copiar: secciones Tramo 2 y Tramo 3 — en T2 solo hay 1 tramo (la elección del transportista).
- NO copiar: lógica de deudor alternativo — no aplica a envíos.

**`src/components/modules/ordenCompra/OCWizardV3/StepProductos.tsx`**
- Copiar: pattern de emoji gradient (cuadrado de color con emoji) para el header de cada ProductoPickingGroup. Usa `getEmojiPorProducto()` de `productoEmoji.ts`.
- Copiar: stepper +/- con botones `w-6 h-6 bg-slate-200 rounded hover:bg-slate-300` y span central `w-10 text-center font-bold`.
- NO copiar: `ProductoAutocomplete` — en T2 no se agrega productos al catálogo, solo se seleccionan unidades ya existentes en la casilla.

**`src/pages/Envios/EnvioWizardV2/EnvioStepProductos.tsx`**
- Copiar: patrón de carga asíncrona de unidades disponibles en `useEffect` con `unidadService.getDisponiblesPorAlmacen(casillaId)`. T2 usa el mismo servicio.
- Copiar: dispatch `SET_UNIDADES_DISPONIBLES` como acción del reducer.
- NO copiar: lógica de selección FIFO agregada por cantidad — en T2 la selección es explícita por unidad individual, aunque el stepper del header aplica FIFO automáticamente.

**`src/components/modules/ordenCompra/OCWizardV3/OCWizardPreview.tsx`**
- Copiar: componente interno `PreviewSection` con icono + título + estado `isEmpty` con borde dashed. Mover como helper a `EnvioT2WizardPreview`.
- Copiar: componente interno `EmptyHint` (`text-xs text-slate-400 italic`).
- Copiar: bloque gran total `bg-teal-50 border-teal-200 rounded-xl p-3` con conversión PEN.

### Antipatrones a no repetir

- **Alert() como placeholder**: `StepRuta.tsx` tiene un `alert('Panel viajero absorbe — TODO')` en la opción "Viajero absorbe". El wizard T2 no debe tener ningún placeholder funcional de este tipo. Si una rama no está implementada, se deshabilita la opción con tooltip descriptivo.
- **Tramos sin implementar con código muerto**: el sistema de Tramo 2 y Tramo 3 fue declarado en `configLogistica.ts` antes de que se decidiera moverlos a /envios. T2 no debe pre-declarar campos que no se van a usar en este sprint.
- **Selección de tipo de transporte sin efecto en validación**: en `EnvioStepRuta.tsx` la validación de paso no distingue viajero de courier para los campos requeridos. En T2 la validación del paso 3 debe diferir según el tipo: viajero requiere colaborador, courier requiere tracking (opcional pero recomendado).

---

## Sección 6 — Recomendación de enfoque

### Conteo de componentes nuevos necesarios

| Componente | Tipo | Complejidad |
|---|---|---|
| `UnidadPickerItem` | Atómico | Baja — solo presentación + checkbox |
| `ProductoPickingGroup` | Compuesto | Media — stepper + lógica FIFO + lista de UnidadPickerItems |
| `BannerPriorizacion` | Atómico | Baja — banner con checkbox de estado local |
| `TarifaPresetSelector` | Semi-atómico | Baja — 4 cards radio con valor pre-llenado |
| `CTRULandedPreview` | Presentacional | Media — tabla dinámica con recálculo |
| `EnvioT2WizardPreview` | Compuesto | Media — resumen en vivo del estado del wizard |
| `ColaboradorTransporteCard` | Atómico | Baja — renderCard para EntityPicker |

**Total: 7 componentes nuevos.** Los 5 existentes (WizardShell, EntityPicker, RouteVisual, DraftBanner, FormField) se usan sin modificar. StatCard, KPIBar, StatusBadge, ProductoDisplay y DynamicChargesSection se usan sin modificar en sus variantes actuales.

### Orden de construcción recomendado

**Fase 1 — Átomos (sin dependencias):**
1. `UnidadPickerItem` — no depende de nada nuevo
2. `BannerPriorizacion` — no depende de nada nuevo
3. `TarifaPresetSelector` — no depende de nada nuevo
4. `ColaboradorTransporteCard` — depende solo del tipo `Colaborador` ya existente
5. `CTRULandedPreview` — depende solo del type `CTRULandedFilaData` nuevo

**Fase 2 — Compuestos (dependen de átomos):**
6. `ProductoPickingGroup` — compone `ProductoDisplay` (existente) + `UnidadPickerItem` (fase 1)
7. `EnvioT2WizardPreview` — compone `RouteVisual` (existente) + varios StatCards

**Fase 3 — Reducer y state shape:**
Definir `EnvioT2WizardState` y `envioT2WizardReducer` siguiendo el patrón de `ocWizardTypes.ts` + `ocWizardReducer.ts`.

**Fase 4 — Pasos del wizard (en orden):**
8. `StepOrigen` — depende de EntityPicker + KPIBar + FormField
9. `StepPicking` — depende de ProductoPickingGroup + BannerPriorizacion
10. `StepTransporte` — depende de EntityPicker + ColaboradorTransporteCard + FormField
11. `StepCostos` — depende de TarifaPresetSelector + DynamicChargesSection + CTRULandedPreview
12. `StepConfirmar` — depende de RouteVisual + KPIBar

**Fase 5 — Ensamblado:**
13. `WizardT2Page` — ensambla WizardShell + todos los pasos + preview + autoguardado

### Tiempo estimado para el HTML pixel-perfect

Con los 5 pasos del mockup ya especificados y el design system auditado, el HTML de maqueta debería tomar:

- Estructura base del wizard (WizardShell HTML + stepper): 30 min (existe referencia exacta)
- Paso 1 Origen: 45 min (casilla card + 4 stats + 2 date inputs)
- Paso 2 Picking: 90 min (banner + grupos producto + unidades con animación prio-pulse)
- Paso 3 Transporte: 60 min (2 cards radio + EntityPicker colaborador + 2 inputs)
- Paso 4 Costos: 75 min (4 preset cards + inputs dinámicos + fees + tabla CTRU)
- Paso 5 Confirmar: 60 min (ruta grande + 3 stats + efectos lista + botones)
- Panel preview lateral: 45 min (análogo a OCWizardPreview)

**Estimado total: 7 horas para el HTML pixel-perfect completo.**

La fase más crítica para validar con el usuario antes de convertir a React es el **Paso 2 (Picking)**: la interacción entre el stepper del grupo, los checkboxes individuales, la animación de prioridad y el banner requieren ser validados visualmente antes de comprometerse con el modelo de estado.

### Decisiones de diseño pendientes antes de escribir HTML

Las siguientes preguntas deben responderse con el usuario antes de producir el mockup HTML final:

1. **Selección de casilla en paso 1**: si el usuario solo tiene 1-2 casillas activas, mostrar directamente la casilla sin EntityPicker (pre-selección automática con opción de cambiar). Confirmar umbral.
2. **Picking vs stepper agregado**: el wizard V2 actual usa solo stepper agregado (FIFO implícito). El mockup T2 muestra unidades individuales. Confirmar si se mantiene el modelo por unidad individual o si el stepper agregado con FIFO automático es suficiente para el caso T2.
3. **Almacén de llegada en paso 3**: el selector de almacén destino, ¿debería estar en Paso 1 (Origen) junto con la casilla de salida, para establecer la ruta completa antes del picking? O se mantiene en Paso 3 (Transporte) como en el mockup.
4. **Cálculo del CTRU base en tabla**: el `ctruBaseUSD` por unidad viene de `Unidad.ctruDinamico` (calculado en tiempo real por el módulo CTRU). Confirmar si el wizard puede leer ese valor directamente o necesita un helper de estimación.
