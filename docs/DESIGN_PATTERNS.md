# 🎨 Guía de Diseño — BusinessMN v2 ERP

> **Versión 1.0 · S52 · 2026-04-21**
>
> Esta guía define **cómo se ven y funcionan las pantallas** del ERP. Su objetivo es que todas las secciones sigan un mismo norte visual y UX, y que construir nuevas pantallas sea cuestión de **ensamblar piezas existentes**, no de inventar desde cero.
>
> **Audiencia:** cualquier persona que vaya a pedir una pantalla nueva o revisar una existente. No requiere conocimiento técnico profundo.

---

## Referencias de Diseño Canónicas (S54.x)

> Decisión tomada en sesión S54.x — 2026-04-25.
> Estas referencias son la FUENTE DE VERDAD visual del sistema. No se modifican sin
> autorización explícita del usuario. Todo lo demás se alinea a ellas.

Las páginas /compras y /envios (estado S54.x) son los patrones vivos del sistema.
Antes de construir o refactorizar cualquier card, modal, pipeline o listado, abrir primero
la referencia que aplica y replicar su estructura.

### Referencia 1 — Vista de lista de entidades

**Archivo:** `src/pages/Envios/EnvioCardSimple.tsx`

**Qué hace:** card de una fila en un listado scrolleable de entidades simples (un envío,
una venta, un gasto). Sin sub-entidades colapsables.

**Cuándo usarla:** cuando la página muestra una lista de entidades del mismo tipo, cada una
con sus métricas clave visibles sin expandir.

**Cuándo NO usarla:** cuando cada entidad tiene sub-entidades anidadas expandibles (usar
Referencia 2). Cuando la vista es un Kanban o tabla de datos (excepciones declaradas).

**Características clave:**
- `@container` con dual layout: narrow (<640 px, stack vertical 3 filas) / wide (>=640 px,
  5 columnas con dividers verticales `w-px bg-border/50`).
- Fila 1 narrow / col 1 wide: ícono de estado redondeado (`rounded-full`) + número de
  entidad + fecha relativa (`formatFechaRelativa()`).
- Fila 2 narrow / col 2 wide: sticker semántico (color según estado) + descripción corta.
- Fila 3 narrow / col 3 wide: avatares de productos coloreados por hash (`paletteForId()`),
  apilados con offset negativo (`-space-x-1`).
- Col 4 wide: métricas numéricas (unidades) con barra de progreso.
- Col 5 wide / acción: botón de acción iconico (ojo, flecha).
- Helpers utilizados: `paletteForId()`, `inicial()`, `formatFechaRelativa()`, `getFlag()`.

### Referencia 2 — Vista de lista con sub-entidades

**Archivo:** `src/components/modules/ordenCompra/CompraCard.tsx`

**Qué hace:** card de una fila en un listado donde cada entidad padre tiene sub-entidades
(sub-órdenes, tandas, líneas) que se expanden inline dentro de la misma card.

**Cuándo usarla:** cuando existe una relación 1:N visible en el listado y el usuario necesita
ver las sub-entidades sin abrir un modal completo.

**Cuándo NO usarla:** cuando no hay sub-entidades (usar Referencia 1). Cuando la sub-entidad
requiere un detalle completo (abrir Referencia 3 desde el card, no expandir inline).

**Características clave:**
- Mismo dual layout `@container` que Referencia 1 para la fila padre.
- Expansión inline con `ChevronDown/Right` + animación `transition-all`.
- Sub-entidades como filas anidadas con indentación visual (`pl-4 border-l-2`).
- Estado visual diferenciado por sub-entidad (badge de estado por sub-orden).
- Botón "Ver detalle" lleva al modal completo (Referencia 3), no expande más.

### Referencia 3 — Detalle de entidad

**Archivo:** `src/components/modules/ordenCompra/OrdenCompraCard.tsx`

**Qué hace:** modal de detalle completo de una entidad. La "vista principal" de un registro.

**Cuándo usarla:** cada vez que se necesita mostrar el detalle completo de cualquier entidad
del sistema (venta, cotización, cliente, proveedor, envío, gasto, etc.).

**Cuándo NO usarla:** cuando el contenido es solo un formulario de edición (usar un form
modal dedicado). Cuando el detalle tiene tantísimos tabs que el scroll se vuelve problemático
(ver Referencia 4 para esos casos).

**Características clave:**
- `EntityHeader` (nombre, estado, badges, acción primaria) — zona fija superior.
- `RouteCardV2` — pipeline o ruta visual de la entidad.
- `NextActionBanner` — acción contextual destacada según estado.
- `KpiRow` — 4 KPIs en una fila horizontal.
- Tabs sticky `top-0` con `z-10` para que el header de tabs no desaparezca al scrollear.
- El contenido de cada tab scrollea; el shell del modal y el header NO scrollean.
- NO usar `h-full + overflow-hidden` anidados (introduce double-scroll).

### Referencia 4 — Detalle con scroll y muchos tabs

**Archivo:** `src/pages/Envios/EnvioDetailModal.tsx`

**Qué hace:** variante del detalle para entidades con muchos tabs o contenido extenso.
Resuelve el problema de scroll en modales con 5+ tabs (Costos, Incidencias, Reclamos,
Rendimiento, Timeline, etc.).

**Cuándo usarla:** cuando una entidad tiene 5 o más tabs, o cuando el contenido de algún
tab es una tabla larga o timeline extenso que requiere scroll independiente.

**Cuándo NO usarla:** cuando la entidad tiene 4 tabs o menos (Referencia 3 es suficiente).

**Características clave:**
- Header compacto (no hero completo) para maximizar espacio de contenido.
- Tabs sticky con scroll horizontal en mobile (`overflow-x-auto scrollbar-hide`).
- Cada tab panel tiene su propio `overflow-y-auto` sin conflicto con el modal.
- Mismo conjunto de componentes base (EntityHeader, KpiRow) pero en disposición más compacta.

### Referencia 5 — Pipeline de listado

**Archivo:** `src/components/modules/ordenCompra/PipelineCompras.tsx`

**Qué hace:** barra de pipeline horizontal clickable que aparece encima de un listado,
mostrando el conteo de entidades por estado y permitiendo filtrar al hacer clic.

**Cuándo usarla:** encima de cualquier listado con estados secuenciales (borrador,
confirmado, en despacho, completado) donde el usuario quiere ver el embudo de un vistazo.

**Cuándo NO usarla:** cuando los estados no son secuenciales o lineales (Kanban ya tiene
su propia visualización). Cuando hay menos de 3 estados.

**Características clave:**
- Grid 2x2 en mobile, flex horizontal con chevrones (`ChevronRight`) en `lg:`.
- Cada etapa: ícono + label + badge de conteo + indicador activo (borde inferior o fondo).
- Al hacer clic en una etapa, emite el estado seleccionado al padre (`onFilterChange`).
- Etapa activa con fondo destacado; inactivas neutras con hover sutil.

### Referencia 6 — Barra de filtros sobre listados (S58e)

**Archivo:** `src/pages/Finanzas/components/FiltrosFinanzasBar.tsx`

> Decisión tomada en sesión S58e (Imp-L11.b–e) — 2026-04-29.
> El usuario validó este patrón como modelo a replicar en TODOS los listados
> filtrables del sistema. Cita: *"te quedó perfecto, podemos usar ese tipo de
> filtros como modelo para todo el negocio en general"*.

**Qué hace:** barra de filtros completa sobre un listado de entidades, integrando
en una sola card todos los controles de búsqueda y filtrado: rango de fechas con
calendar inline, chips toggle por categoría/tipo, búsqueda por texto, ordenamiento
y limpieza global.

**Cuándo usarla:** sobre cualquier listado scrolleable de entidades del sistema
(OCs, envíos, ventas, clientes, proveedores, productos, movimientos, gastos,
incidencias, etc.). Reemplaza el patrón anterior de toolbars fragmentados +
filtros laterales + chips sueltos.

**Cuándo NO usarla:** dashboards puramente analíticos (la página /reportes y
similares tienen sus propios filtros de cubo OLAP). Vistas Kanban (que filtran
por columna). Páginas con un solo control simple (tabla con search inline).

**Anatomía visual — 2 filas separadas por divider sutil:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FILA 1 — Filtros multi-toggle (chips)                                   │
│  [📅 Rango ▾] · ESTADO: [chips x N] · TIPO/CATEGORÍA: [chips x M]       │
│  ────────────────────────────────────────────────────────────────────    │
│  FILA 2 — Búsqueda + ordenamiento + acción destructiva                   │
│  🔍 Buscar por…  ✕         [Ordenar: ▾]      [× Limpiar filtros]         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Características clave:**

1. **Mini-calendar inline para rango de fechas:**
   - Dropdown con presets: Todo / Últ. 7d / 30d / 90d / 6m / Este año / Personalizado.
   - "Personalizado…" abre un calendar visual con grid 7 columnas (L M X J V S D).
   - Selección por clicks: 1°=desde, 2°=hasta (auto-swap), 3°=reinicia.
   - Highlight visual del rango con fondo `bg-teal-50` entre extremos +
     círculos `bg-teal-600` sólidos en desde/hasta.
   - Preview con hover antes de fijar el fin.
   - Día de hoy marcado con `ring-1 ring-teal-300`.
   - Días del mes vecino visibles en gris claro (no clickables) para
     mantener la grilla completa.
   - Botón del dropdown cambia de slate-50 a teal-50 cuando hay rango activo.

2. **Chips toggle (rounded-full pill) con icon + count:**
   - Cada chip muestra ícono + label + count en `tabular-nums` con opacidad 60%.
   - Estado activo: `bg-{color}-600 text-white shadow-sm`.
   - Estado inactivo: `bg-{color}-50 text-{color}-700 border` con hover.
   - Toggle pattern: click sobre chip activo lo desactiva (vuelve a "todos").
   - Etiqueta "Estado:" / "Tipo:" en uppercase tracking-wider antes del grupo.
   - Divider vertical `h-5 w-px bg-slate-200` entre grupos de chips.

3. **Input de búsqueda prominente:**
   - `flex-1 min-w-[260px]` ocupa el ancho disponible en la fila 2.
   - Ícono `Search` a la izquierda, botón `×` a la derecha cuando hay texto.
   - Placeholder descriptivo guía al usuario sobre qué tipo de búsqueda hacer.
   - El botón `×` solo limpia el texto, NO los demás filtros.
   - Focus ring `ring-2 ring-teal-500`.

4. **Sort dropdown con etiqueta semántica:**
   - Etiqueta "Ordenar:" en gris antes del valor activo.
   - Cambia a `bg-teal-50` cuando el orden no es el default.
   - Lista compacta con item activo destacado en teal.

5. **Botón "× Limpiar filtros":**
   - Aparece SOLO cuando hay al menos un filtro distinto al default.
   - Resetea TODO: estado, tipo, fecha, búsqueda, orden.
   - Estilo `text-teal-600 hover:bg-teal-50` (no destructivo, no rojo).

6. **Comportamiento general:**
   - Click outside cierra cualquier dropdown abierto.
   - `space-y-3` entre las 2 filas, divider `border-t border-slate-100`.
   - Dropdowns con `rounded-xl shadow-xl` (más prominentes que los chips).
   - Todo el componente se monta en una sola `Card padding="md"`.

**Plan de adopción declarado (tarea pendiente — sesiones futuras):**

Esta es la **6ª referencia canónica** del sistema. Sumada a las 5 de S54.x,
forma el set definitivo de patrones visuales. Toda página que tenga un listado
filtrable debe migrar a este patrón.

Módulos prioritarios para adoptar el filtro (no se migran solos — cada uno
requiere su sesión dedicada porque la lógica de filtrado es específica):

| Prioridad | Módulo | Filtros típicos a soportar |
|-----------|--------|----------------------------|
| Alta | `/compras` | Estado · Proveedor · Fecha emisión · Tipo OC · Búsqueda |
| Alta | `/envios` | Tipo (C/J/E/I/F/G) · Modo transporte · Colaborador · Fecha · Búsqueda |
| Alta | `/productos` | Categoría · Marca · Stock · Tipo SKU · Búsqueda |
| Media | `/ventas` | Estado · Canal · Cliente · Fecha · Búsqueda |
| Media | `/tesoreria/movimientos` | Categoría · Canal · Documento · Fecha · Búsqueda |
| Media | `/clientes` y `/proveedores` | Tipo · País · Estado activo · Búsqueda |
| Baja | `/red-logistica` | Tipo colaborador · País · Activo · Búsqueda |

**Patrón futuro de extracción:** cuando llegue el momento de la primera adopción
en otro módulo, los 6 sub-componentes (`MiniCalendarRange`, chips toggle, search,
sort, etc.) se mueven a `src/components/common/filters/` con compositional API
estilo Radix:

```tsx
<FilterBar>
  <FilterBar.Row>
    <DateRangeFilter ... />
    <FilterBar.Divider />
    <FilterChipGroup label="Estado" ... />
    <FilterBar.Divider />
    <FilterChipGroup label="Tipo" ... />
  </FilterBar.Row>
  <FilterBar.Separator />
  <FilterBar.Row>
    <SearchFilter ... />
    <SortDropdown ... />
    <ClearFiltersButton ... />
  </FilterBar.Row>
</FilterBar>
```

Hasta entonces, **`FiltrosFinanzasBar.tsx` es la fuente de verdad**: cualquier
nueva implementación de filtros debe abrir ese archivo, copiar la estructura
y ajustar solo los catálogos (chips de estado y tipo) a los del dominio.

### Excepciones Legítimas (no siguen el patrón OC)

Estas páginas tienen casos de uso distintos y NO se migran al patrón de lista/detalle OC:

| Página | Patrón propio | Razón |
|--------|--------------|-------|
| /cotizaciones (Kanban) | Kanban tiles | Flujo visual de pipeline de ventas |
| /requerimientos (Kanban) | Kanban tiles | Misma razón |
| /contabilidad | Dashboard financiero | Estados financieros, no entidades operativas |
| /reportes | Dashboard + alertas | Vistas agregadas, no registros individuales |
| /escaner | Cards de escaneo | UX de campo, pantalla completa, sin listado |
| /mercadolibre | Editor bulk de precios | Integración externa con UX propia |

---

## 📐 Cómo está organizado el diseño

El sistema tiene **3 capas de piezas**, ordenadas de más chica a más grande. Cuando construimos una pantalla nueva, **siempre partimos de la capa más alta disponible** y solo bajamos si falta algo.

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 — Plantillas de pantalla                                 │
│  "Cómo se ve un detalle de entidad", "Cómo se ve una lista"      │
│  Ej: EntityDetailShell, ModuleListPage                           │
└─────────────────────────────────────────────────────────────────┘
                            ↑ se arma con
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 — Patrones de composición                                │
│  Piezas medianas: barra de KPIs, pipeline, banner CTA, toolbar   │
│  Ej: KpiRow, EntityPipeline, NextActionBanner                    │
└─────────────────────────────────────────────────────────────────┘
                            ↑ se arma con
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — Piezas básicas                                         │
│  Lo más atómico: botón, input, badge, modal, card                │
│  Ej: Button, Modal, Badge, Input                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Regla de oro:** si necesitás una pieza que no existe en la capa que necesitás, **se crea primero la pieza** en el lugar correcto y después se usa. **Nunca se copia-pega código de otra pantalla.**

---

## 🏛️ El estándar: "Patrón OC"

Las pantallas del ERP siguen el patrón establecido en el módulo **Órdenes de Compra**. Cuando diseñamos algo nuevo, preguntamos: **"¿cómo lo hizo OC?"** — y seguimos ese camino.

### Anatomía de un detalle de entidad (el patrón a replicar)

```
┌─────────────────────────────────────────────────────────────────┐
│  Modal full-screen                                          [X] │
│                                                                 │
│  ┌─── ZONA FIJA (nunca cambia mientras estás dentro) ────────┐ │
│  │                                                            │ │
│  │  OC-2026-001                        [Pendiente] [No pagada]│ │ ← Header
│  │  Amazon · USA                                              │ │
│  │                                                            │ │
│  │  ●─────────○─────────○─────────○─────────○                 │ │ ← Pipeline
│  │ Borrador Confirmada Despacho Recibida Completa             │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ 🔷 Próximo paso: Confirmar esta OC        [Confirmar]│ │ │ ← Banner CTA
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌──────┬──────┬──────────┬──────────┐                    │ │ ← KPIs fila
│  │  │Total │ SKUs │Sub-órdenes│  Pagado  │                    │ │
│  │  │$1,250│  12  │    3      │ $500/1250│                    │ │
│  │  └──────┴──────┴──────────┴──────────┘                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── ZONA DINÁMICA (cambia según la acción en curso) ───────┐ │
│  │                                                            │ │
│  │  Modo "Detalle":                                           │ │
│  │   productos + cargos + envío + ...                         │ │
│  │                                                            │ │
│  │  Modo "Confirmando":                                       │ │
│  │   formulario de confirmación INLINE (no abre otro modal)   │ │
│  │                                                            │ │
│  │  Modo "Editando X":                                        │ │
│  │   formulario de edición INLINE (no abre otro modal)        │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Los 5 elementos clave que siempre debe tener un detalle de entidad:**

1. **Header** con número + título + badges de estado alineados a la derecha
2. **Pipeline grande** con los estados por los que pasa la entidad (ej. Borrador → Confirmada → ...)
3. **Banner CTA de próxima acción** que le dice al usuario qué hacer ahora
4. **Fila de KPIs** con 3-5 métricas clave consolidadas en fondo suave
5. **Zona dinámica** que cambia de contenido sin abrir modales encima

---

## 🧩 Los 5 patrones canónicos

Estos son los patrones que vienen del estándar OC y que deben usarse en TODAS las pantallas de detalle del ERP.

### 1. `EntityHeader` — Encabezado de la entidad

**Qué es:** el bloque superior con número, título y badges.

**Cuándo usarlo:** siempre que muestres el detalle de una OC, Envío, Venta, Devolución, Cotización, etc.

**Qué nunca hacer:**
- ❌ Escribir el header a mano con `<div>` y clases Tailwind sueltas
- ❌ Usar colores distintos en cada módulo ("el header de Ventas en azul, el de Envíos con gradient, el de OC blanco")
- ❌ Poner el número en un tamaño distinto por módulo

**Qué siempre hacer:**
- ✅ Usar `<EntityHeader>` con los mismos props: `titulo`, `subtitulo`, `badges`, `breadcrumb`

### 2. `EntityPipeline` — Pipeline de estados

**Qué es:** la línea horizontal con los estados por los que pasa la entidad.

**Cuándo usarlo:** cuando la entidad tiene un ciclo de vida con 3+ estados (OC, Envío, Reclamo, Venta, Devolución).

**Qué nunca hacer:**
- ❌ Escribir el pipeline a mano con círculos y líneas Tailwind
- ❌ Inventar un "tipo" de pipeline distinto por módulo (OC usa círculos grandes, Envíos usa cards, Reclamos usa timeline vertical)
- ❌ Mezclar el pipeline de **estados** con el de **ubicaciones** (la ruta US → PE es distinta a los estados "Borrador → Confirmado")

**Qué siempre hacer:**
- ✅ Usar `<EntityPipeline steps={[...]}>` con cada paso como `{id, label, fecha, status}`
- ✅ Si la entidad tiene ruta geográfica, usar `<RouteVisual>` (pieza separada)

### 3. `KpiRow` — Fila de KPIs del detalle

**Qué es:** la fila horizontal de 3-5 métricas clave con fondo `slate-50`.

**Cuándo usarlo:** dentro del detalle de una entidad, arriba (debajo del banner CTA).

**Qué nunca hacer:**
- ❌ Armar 5 cards pastel separadas si es el KPI de un detalle individual (eso es para la vista de lista)
- ❌ Poner íconos grandes a la derecha de cada KPI
- ❌ Repetir el patrón a mano en cada módulo

**Qué siempre hacer:**
- ✅ Usar `<KpiRow items={[...]}>` con cada KPI como `{label, value, subtitle, tone}`
- ✅ Máximo 5 KPIs por fila (si necesitás más, repensar qué es crítico)

### 4. `NextActionBanner` — Banner de próxima acción

**Qué es:** el cuadro teal-50 que le dice al usuario **qué hacer ahora** con un botón.

**Cuándo usarlo:** en todo detalle de entidad donde el usuario puede ejecutar acciones según el estado.

**Qué nunca hacer:**
- ❌ Poner 7 botones en el header ("Confirmar", "Despachar", "Recibir", "Cancelar", "Pagar", "Editar flete", "Liberar aduana"). Abruma al usuario.
- ❌ Hacer que el usuario adivine cuál es la próxima acción entre varias opciones
- ❌ Ocultar el banner cuando no hay acción siguiente — mostrar "✓ No hay acciones pendientes" es mejor

**Qué siempre hacer:**
- ✅ Usar `<NextActionBanner>` con `label` + `description` + `buttonText` + `onClick`
- ✅ Calcular la próxima acción con un helper `useEntityNextAction(estado, reglas)` que devuelva un solo objeto
- ✅ Si hay múltiples acciones posibles, elegir la **más frecuente** como principal y poner el resto en un menú secundario

### 5. `useEmbeddableView` — Vista interna intercambiable

**Qué es:** el patrón donde el mismo modal/pantalla **cambia su contenido inferior** según lo que el usuario está haciendo, sin abrir modales encima.

**Cuándo usarlo:** cuando una acción necesita un formulario completo (ej. confirmar OC con sub-órdenes, registrar recepción, agregar costo) pero no quieres apilar modales.

**Qué nunca hacer:**
- ❌ Abrir un modal encima de otro modal ("modal sobre modal")
- ❌ Navegar a una página distinta solo para una confirmación
- ❌ Mostrar un drawer lateral que tape la lista detrás

**Qué siempre hacer:**
- ✅ Usar `useEmbeddableView<'detalle' | 'confirmando' | 'editando' | ...>()` para controlar qué vista se renderiza
- ✅ El header (número, pipeline, KPIs, banner CTA) **siempre queda visible** mientras cambia la zona de abajo
- ✅ Los "modales" de acción tienen prop `embedded=true` que los renderiza sin su wrapper modal

---

## 🚫 Anti-patrones (lo que NO hacer)

### Anti-patrón 1: Modal sobre modal
```
❌ Usuario clic card → Modal detalle → Modal "Registrar recepción" → Modal "Confirmar acción"
                                    (3 modales apilados, pierde contexto)

✅ Usuario clic card → Modal detalle → Vista interna cambia a "Registrando recepción"
                                    (1 solo modal, header fijo sigue visible)
```

### Anti-patrón 2: Reinventar KPIs
```
❌ OC usa "KpiCell" (slate-50 fila), Envíos usa "KpiRapido" (6 cards pastel),
   Ventas usa "VentaDashboardCard" (otra variante)
   → 3 componentes para el mismo concepto

✅ Un solo <KpiRow> con prop `variant='default' | 'pastel'` cubre los 3 casos
```

### Anti-patrón 3: Botones apilados en el header
```
❌ Header del detalle: [Exportar] [Confirmar] [Despachar] [Cancelar] [Editar flete] [Pagar]

✅ Header: solo 2 botones (cerrar + acción principal)
   La acción principal la dice el NextActionBanner debajo del pipeline
   Otras acciones van en un menú "..." si son secundarias
```

### Anti-patrón 4: Cada módulo con su propio look
```
❌ OC detail: fondo blanco, bordes slate
   Envíos detail: header gradient sky, tabs internos
   Ventas detail: card expandible sin modal

✅ Todos usan EntityDetailShell con los mismos slots
```

### Anti-patrón 5: Colores hardcodeados
```
❌ En el código: <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">

✅ Los colores vienen de tokens.ts:
   <div className={cn(tokens.banner.primary, tokens.rounded.xl, tokens.padding.md)}>
```

### Anti-patrón 6: 1 wizard por tipo de entidad
```
❌ EnvioWizardT2/, EnvioWizardJ/, EnvioWizardE/, EnvioWizardF/, EnvioWizardI/, EnvioWizardG/
   (6 wizards separados, 80% código duplicado)

✅ EnvioWizard/ único que detecta el tipo al inicio y adapta sus pasos
   (como OCWizardV3 hace con DDP vs. Vía casilla vs. Recojo directo)
```

---

## ✅ Checklist para pantallas nuevas

El checklist está dividido en **dos partes**. La primera es tuya (dueño del producto, no requiere saber código). La segunda la valida Claude o un agente técnico.

### 📝 Parte A — Checklist del dueño del producto (5 preguntas)

**Responde estas ANTES de pedirle a Claude que construya una pantalla nueva.**

Si no sabés alguna, está bien — Claude asume un default razonable y vos validás después viendo la pantalla. Esto es una guía, no un bloqueo.

1. **¿Qué tarea concreta quiere completar el usuario en esta pantalla?**
   *Responder en 1 oración.* Ejemplo: "Crear un envío nuevo desde una casilla internacional a Perú".

2. **¿Cuáles son las 2-3 acciones más frecuentes?**
   *Lista corta ordenada por frecuencia.* Ejemplo: "1) Consultar envíos activos · 2) Crear envío nuevo · 3) Registrar recepción".

3. **¿Con qué otras pantallas se conecta esta?**
   *¿A dónde va el usuario desde acá y de dónde viene?* Ejemplo: "Se entra desde el menú principal · Al clic en un envío se abre el detalle · Al terminar recepción vuelve a la lista".

4. **¿Hay un mockup HTML en `docs/mockups/`?**
   - ✅ Sí → perfecto, arrancamos directo.
   - ❌ No → no pasa nada. Claude puede hacer una propuesta visual basada en patrones existentes (OC, Envíos), vos la revisás y iteramos. O podés pedir un mockup antes de codear.

5. **¿Cuántos estados puede tener la entidad?**
   *Ejemplo para envío: `Borrador → Confirmado → En tránsito → Recibido → Completado`.*
   *Ejemplo para venta: `Cotización → Reservada → Confirmada → Despachada → Entregada`.*
   Si ya está documentado en otro lado (ej. spec técnica, briefing de sesión), solo apuntá el archivo.

**Regla de oro:** si respondés las 5, Claude tiene todo lo que necesita para construir la primera versión. Si alguna queda abierta, Claude pregunta puntualmente o asume un default y lo marca.

---

### 🔧 Parte B — Checklist técnico (lo valida Claude o un agente)

No es para que el dueño del producto responda. Es un recordatorio de las cosas que Claude debe verificar antes de entregar código. Si ves que algo falta, podés pedirlo.

1. ¿Usa `<PageShell>` + `<PageHeader>` en la lista?
2. ¿Usa `<EntityDetailShell>` + sus slots en el detalle?
3. ¿Usa `<KpiRow>` o `<KPIBar>` según corresponda (detalle vs. lista)?
4. ¿Usa `<EntityPipeline>` si hay estados?
5. ¿Usa `<NextActionBanner>` para la próxima acción?
6. ¿Los formularios de acción son `embedded` con `useEmbeddableView` (no modal sobre modal)?
7. ¿Los colores vienen de `tokens.ts` (no hardcodeados)?
8. ¿Hay estado vacío y estado de carga diseñados?
9. ¿Se ve bien en mobile (320px de ancho)?
10. ¿Pasan `tsc -b` y `vite build` sin errores?
11. ¿Los imports vienen de la capa más alta disponible?
12. ¿No hay duplicación de bloques JSX que ya existen en otro archivo?

---

### 🆘 Si no sabés responder alguna pregunta de la Parte A

**No te bloquea.** Opciones:

- **Decir "no sé, proponé vos"** → Claude propone una opción, vos la revisás y aprobás o ajustás.
- **Decir "como en OC"** → Claude replica el patrón de Órdenes de Compra (que ya aprobaste como estándar).
- **Decir "como en el mockup"** → Claude busca el mockup más cercano y lo adapta.

---

## 🗺️ Mapa de archivos

Cuando busques una pieza, sabés dónde encontrarla:

| Ubicación | Qué hay | Cuándo importar desde aquí |
|---|---|---|
| `src/components/common/` | Piezas básicas (Capa 1) | Rara vez — solo para piezas atómicas como Button |
| `src/design-system/components/` | Patrones medios (Capa 2) | Cuando necesitás KPIBar, Toolbar, Modal, FilterDrawer, WizardShell |
| `src/design-system/templates/` | Plantillas completas (Capa 3) | **Siempre que construyas un detalle o una lista** |
| `src/design-system/hooks/` | Hooks reutilizables | useEmbeddableView, useEntityNextAction |

**Regla:** importá siempre de la capa más alta posible. Si vas a escribir un detalle, partí de `EntityDetailShell` — no ensambles a mano desde Capa 1.

---

## 🎯 Checklist de code review

Cuando revises código nuevo (o Claude lo escribe), validá:

- [ ] ¿La pantalla usa `PageShell` + `PageHeader` en la vista de lista?
- [ ] ¿La pantalla usa `EntityDetailShell` en el detalle?
- [ ] ¿Los KPIs usan `<KpiRow>` o `<KPIBar>` (según si es detalle o lista)?
- [ ] ¿Hay algún bloque `<div className="bg-[color]-50 border ...">` copiado de otro archivo? Eso es señal de patrón no formalizado.
- [ ] ¿Hay "modal sobre modal"? Marcar para refactor.
- [ ] ¿El pipeline es `<EntityPipeline>` o JSX manual con círculos y líneas?
- [ ] ¿La próxima acción del usuario está clara? ¿Usa `<NextActionBanner>`?
- [ ] ¿Los 7 botones del header son 7 distintos o se pueden reducir?

---

## 📋 Glosario rápido (para no-desarrolladores)

| Término | Qué significa en lenguaje humano |
|---|---|
| **Componente** | Pieza de pantalla reutilizable (ej. el botón "Guardar") |
| **Props** | Los datos que le pasás a un componente (ej. `<Button texto="Guardar" />`) |
| **Modal** | Ventana emergente que se superpone encima de la pantalla |
| **Drawer** | Ventana lateral que se desliza desde el borde |
| **Patrón** | Una forma estándar de resolver un problema de diseño (ej. "banner CTA") |
| **Plantilla** | Pantalla casi completa con huecos configurables (ej. "detalle de cualquier entidad") |
| **Capa** | Nivel de abstracción de las piezas (1 = átomo, 2 = pieza, 3 = pantalla) |
| **Embedded** | Renderizar algo inline dentro de otra cosa en vez de encima |
| **Token** | Variable que define un valor de diseño (color, espaciado, tipografía) |
| **Refactor** | Cambiar la estructura del código sin cambiar lo que hace |

---

## 🔄 Gobernanza: cómo evitar que esto se rompa

### Quién aprueba nuevos patrones
Un patrón se vuelve "canónico" y entra a esta guía cuando:
1. Se usa en **al menos 2 módulos** (no es caso único)
2. Se escribe su API en `src/design-system/templates/` o `src/design-system/components/`
3. Se documenta aquí con ejemplos

### Cuándo pedir ayuda de un agente
- **system-architect**: antes de crear una nueva Capa 3
- **frontend-design-specialist**: antes de decidir visualmente entre 2 opciones
- **code-quality-refactor-specialist**: cada vez que detectes 3+ pantallas haciendo algo similar

### Cuándo actualizar esta guía
- Al agregar un patrón nuevo a Capa 3
- Al detectar un anti-patrón repetido en 2+ lugares
- Al completar un refactor mayor (ej. migrar Envíos al estándar)

---

## 📅 Historial

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-04-21 | 1.0 | Versión inicial · 5 patrones canónicos · derivados del estándar OC · S52 |
| 2026-04-21 | 1.1 | Checklist dividido en 2 partes (dueño del producto 5 preguntas, técnico 12 preguntas). Sección "si no sabés responder, ¿qué hacer?" añadida para no bloquear. |

---

**Fin del documento.** Si algo no está claro o encontrás un patrón repetido que no está documentado aquí, levantá la mano — esto es un documento vivo.
