# Auditoría Rework S41 vs Mockup Maestro

**Fecha**: 2026-04-18
**Mockups de referencia**:
- `docs/mockups/rework-maestro-s40.html` (5 flujos: Vista Compras, Wizard OC, Vista Envíos, Wizard Envío, Detalle Envío) — validado por usuario
- `docs/mockups/rework-subordenes-s41.html` (4 flujos: Vista Compras accordion, ConfirmarOCModal, Detalle sub-orden, Modal Despachar Envío) — validado por usuario en S41

**Alcance**: todas las pantallas de los 2 mockups del rework — **9 flujos validados en total**.

---

## Resumen ejecutivo

**Conclusión global**: el rework implementado tiene **deuda visual y estructural significativa** respecto al mockup validado. No es cuestión cosmética — hay diferencias estructurales (orden de secciones, tipo de UI — dropdowns vs cards, secciones completas ausentes).

### Mockup S40 maestro

| Pantalla | Estado | Gravedad |
|---|---|---|
| Vista Compras | Alineada parcialmente (cards + pipeline OK; búsqueda global, orden de KPIs y subtítulos divergen) | **Medio** |
| Wizard OC — Paso 1 Ruta | Muy divergente (orden secciones, UI selectores, panel morado ausente, falta sección "¿Cómo llega?") | **Crítico** |
| Wizard OC — Paso 2 Productos | Divergente (falta emoji, stepper ±, botón Escanear, chip marca, header subtotal) | **Alto** |
| Wizard OC — Paso 3 Cargos | Divergente (falta header subtotal de contexto, presentación items más densa, datalist) | **Medio** |
| Wizard OC — Paso 4 Inteligencia | Parcialmente divergente (cards de 4 KPIs grandes vs ScoreRing SVG + Delta; tabla comparativa ausente) | **Alto** |
| Wizard OC — Paso 5 Confirmar | Estructuralmente similar pero sin botones "Editar" por sección | **Medio** |
| Vista Envíos | Diverge (tabs internos OK, falta layout dashboard 2-col con breakdown/pipeline, cards distintas) | **Alto** |
| Wizard Envío — 3 pasos | Muy divergente (falta nota aclaratoria Opción A, selectores casillas como cards, stepper ± en productos) | **Crítico** |
| Detalle Envío | Divergente (falta header con ruta horizontal grande + 5 KPIs + tabs internos + sidebar sticky) | **Alto** |

### Mockup S41 sub-órdenes

| Flujo | Estado | Gravedad |
|---|---|---|
| 10.1 Vista Compras accordion sub-órdenes | **Ausente** — CompraCard solo muestra chip contador, sin accordion ni mini-pipeline dots | **Crítico** |
| 10.2 ConfirmarOCModal matriz + validación + distribución cargos | **Existe legacy pre-S41** pero sin tabla matriz, sin validación por fila, sin distribución de cargos | **Crítico** |
| 10.3 Detalle sub-orden standalone | **Completamente ausente** — no hay componente ni ruta/modal | **Crítico** |
| 10.4 Modal Despachar Envío V2 | **Existe legacy** (DespacharOCModal.tsx) pero sin layout 2-col, sin avatares con métricas, sin preview cambio estado | **Crítico** |

---

## Causa raíz del desalineamiento

Al inicio del rework leí el mockup para extraer los componentes del DS (WizardShell, EntityPicker, RouteVisual, DynamicChargesSection, ProductoDisplay) pero **después nunca volví a abrirlo mientras escribía el código de cada pantalla**. Me guié por:
- La estructura lógica del V2 existente (por "lo probado")
- Convenciones del DS que construí
- Sin diffear contra el mockup real al final

Es un error sistemático de disciplina ejecutiva, no una limitación técnica.

---

## Metodología

Para cada pantalla, comparé **sección por sección** el HTML del mockup contra el archivo TSX implementado. Marqué cada divergencia con gravedad:

- 🔴 **Crítico**: estructura/layout ausente o fundamentalmente distinto. UX percibido notoriamente diferente.
- 🟠 **Alto**: sección presente pero con UI distinta (dropdown vs cards, orden de campos, falta feedback visual).
- 🟡 **Medio**: detalles de estilo, iconos, copy, estados vacíos.
- 🟢 **Bajo**: ajustes mínimos, colores o microcopy.

---

## 1. Vista Compras (`pane-compras` → `OrdenesCompra.tsx`)

### Estructura general

| Elemento | Mockup | Implementación | Gap | Gravedad |
|---|---|---|---|---|
| Header icono + título + subtítulo | ✅ icono sky rounded + título + subtítulo "Órdenes de compra y proveedores" | ✅ PageHeader con icono Package | Icono distinto | 🟡 Medio |
| Search global en header | ✅ input con placeholder "Buscar OC, proveedor, número..." | ❌ No existe | Falta search global | 🟠 Alto |
| Botones acción | ✅ Exportar (outline) + Nueva OC (teal) | ✅ Exportar + Nueva OC | OK | 🟢 Bajo |

### KPIs

| # | Mockup | Implementación | Gap |
|---|---|---|---|
| 1 | **Total OCs** — 12 este mes (bg-slate-50) | Total OCs — stats.totalOrdenes (neutral) | Falta "este mes" subtítulo. Icono distinto |
| 2 | **Valor total** — $2,847 USD (bg-sky-50 + icono $) | Valor Total USD (brand, al final) | Posición distinta (mockup: 2ª; imp: 6ª) |
| 3 | **Borradores** — 2 sin confirmar | Borradores (con onClick filtro) ✅ | Subtítulo distinto. Mockup no tiene click-to-filter |
| 4 | **En curso** — 5, "3 envíos activos" (bg-amber-50) | En Despacho — cuenta agregada (warning) | Copy diferente. Mockup tiene "3 envíos activos" |
| 5 | **Por pagar** — 3, "$612.30 pendiente" (bg-red-50) | ❌ No existe como KPI separado | Falta KPI de pagos pendientes |
| 6 | **Completadas** — 5, "$1,843.20" (bg-emerald-50) | Completadas — stats.recibidas | Falta monto acumulado de completadas |
| (extra) | — | "Con sub-órdenes" (info) | KPI inventado por mí, no está en mockup |

**Gravedad**: 🟠 Alto. Falta search global, KPI "Por pagar", y los subtítulos/copy están desviados.

### Pipeline Opción B (4 etapas)

| Aspecto | Mockup | Implementación | Gap |
|---|---|---|---|
| Título | "Pipeline de compras" + conteo "12 OCs · ciclo comercial/financiero" | "Pipeline de compras" ✅ | OK pero sin subtítulo "ciclo comercial/financiero" |
| Etapas | Borrador (slate) → Confirmada (sky) → En despacho (amber) → Completada (emerald) | Implementado igual ✅ | OK |
| Subtítulo etapa | "Pendientes de confirmar", "Envíos generados, pago pendiente", etc | ✅ Presente en PipelineCompras | OK |
| Separador flechas | `<i>` chevron right entre etapas | ✅ ChevronRight | OK |

**Gravedad**: 🟢 Bajo. Alineado.

### Filtros rápidos + toolbar

| Aspecto | Mockup | Implementación | Gap |
|---|---|---|---|
| Pills filtro | "Todas (12)", "Activas (7)", "Completadas (5)" con contador inline | ❌ No existe | Falta |
| Separador + dropdowns | Divider + 3 selects (Proveedor, Estado pago, Línea) | ❌ No existe | Faltan filtros dropdown |
| Toggle tabla/cards | Grupo right con icono grilla y lista | ✅ Toolbar con viewMode | OK |

**Gravedad**: 🟠 Alto. Falta pills filtros rápidos + dropdowns adicionales.

### Cards OC (5 columnas según mockup)

| Columna | Mockup | Implementación CompraCard | Gap |
|---|---|---|---|
| 1. Número + estado + fecha | OC-2026-XXX font-mono bold + badge estado con dot + "hace X días" | ✅ Implementado similar | OK |
| 2. Proveedor + productos + mini-ruta | Flag + nombre + PRV-XXX + "3 productos · 27 unidades · Suplementos" + mini-ruta con flags | ✅ Similar pero mini-ruta tiene solo 3 nodos fijos | Mini-ruta OK |
| 3. Envíos asociados (w-48) | Lista compacta de ENV-XXX con badge estado + bg color por estado | ✅ Implementado con bg-color | OK |
| 4. Monto + pago (w-32 right) | "$195.00" + "Total USD" + badge pago parcial + "$97.50 pendiente" | ✅ Implementado | OK |
| 5. Acciones (flex-col gap-1) | 3 iconos: Ver (teal), Registrar pago (emerald), Ver envíos (sky) | ✅ 3 iconos con tooltips | OK |

**Gravedad**: 🟢 Bajo. Cards bien alineadas. El mockup tiene opacidad 80% en "Completada" — no implementado.

### Footer "Cargar más"

| Aspecto | Mockup | Implementación | Gap |
|---|---|---|---|
| "+ 9 OCs más · Cargar más" (texto + botón) | ❌ No existe | Falta paginación visual |

**Gravedad**: 🟡 Medio. Falta paginación/cargar-más.

---

## 2. Wizard OC — Paso 1 Ruta (`pane-oc-1` → `StepRuta.tsx`)

### Estructura fundamental

El mockup tiene **3 secciones en orden específico**:

1. **Proveedor** (con cards ricas: logo + nombre + flag + PRV-XXX + badge "Distribuidor" + categoría + "X OCs previas")
2. **"¿Cómo llega la mercadería?"** (2 cards grandes tipo-card: Vía casilla de tránsito / DDP) + selector **Casilla de tránsito** (grid 2-col cards con avatar iniciales + flag + "X envíos") + selector **Almacén destino final** (grid 3-col cards con icono + flag)
3. **Tramo 1 Salida del proveedor** (con panel morado contextual para "Recojo en origen") + **Tramo 2 Cruce a Perú** (3 cards: viajero/courier/DDP) + **Tramo 3 Última milla** (3 cards: yo recojo/colaborador local/viajero absorbe) con paneles contextuales por opción

**Mi implementación** tiene las secciones en orden **Proveedor → Tramo 1 → Tramo 2 → Tramo 3** sin la sección "¿Cómo llega la mercadería?" ni los selectores visuales de casilla/destino como cards. Usa dropdowns.

### Divergencias específicas

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Sección **Proveedor** | Cards ricas (logo + país + badge Distribuidor + categoría + "13 OCs previas") | `ProveedorAutocomplete` input con feedback simple teal | 🟠 Alto |
| Botón "Crear nuevo proveedor" | Border dashed inline bajo la lista | ❌ No existe (Autocomplete tiene su propio flujo) | 🟡 Medio |
| **"¿Cómo llega la mercadería?"** (sección 2 completa) | 2 cards grandes "Vía casilla" / "DDP" + selectores casilla y almacén destino | ❌ **Sección completa ausente** | 🔴 Crítico |
| Selector de **Casilla de tránsito** como cards | Grid 2-col cards con avatar (iniciales) + flag + "Casilla viajero · 47 envíos" | Solo dropdown (en Tramo 2) | 🔴 Crítico |
| Selector de **Almacén destino final** como cards | Grid 3-col cards con icono + flag | Solo dropdown DDP | 🔴 Crítico |
| **Tramo 1** opciones | 2 `tipo-card` con check circle superior derecho (teal-600 con white check) | Componente `OptionCard` propio sin check mark superior | 🟡 Medio |
| **Panel morado** "Recojo en origen" | Bloque completo purple-50 con: aclaración + dropdown colaborador + pregunta "¿Quién paga al proveedor?" (2 cards) + aclaración contable final | Panel teal/pequeño sin la misma estructura | 🔴 Crítico |
| **Tramo 2** opciones | 3 `tipo-card` text-center con icono block arriba (vía viajero/courier/DDP) | 3 OptionCard con icono izquierda | 🟠 Alto |
| **Tramo 3** opciones | 3 `tipo-card` center (yo recojo/colaborador local/viajero absorbe) + 3 paneles contextuales (emerald/sky/purple) | 2 OptionCard sin el 3er "viajero absorbe" + un panel simple de warning | 🔴 Crítico |
| Panel **"Luis adelanta (CxP)"** en Tramo 3 | Panel sky con selector colaborador + selector "quién paga" + input costo estimado | ❌ No implementado | 🔴 Crítico |
| Panel **"Viajero absorbe"** | Panel purple aclaratorio | ❌ No implementado | 🔴 Crítico |
| Feedback casilla auto-resuelta | No aparece en mockup (porque se elige explícitamente) | Mensaje "Angie no tiene casilla" aparece como side effect | 🟠 Alto (desviación de flujo) |

**Gravedad global**: 🔴 Crítico. Diferencias estructurales mayores: falta sección completa "¿Cómo llega la mercadería?", selectores de casillas como cards, paneles contextuales Tramo 3, opción "Viajero absorbe".

---

## 3. Wizard OC — Paso 2 Productos (`pane-oc-2` → `StepProductos.tsx`)

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Header | "¿Qué productos comprar?" + subtítulo | "Productos de la orden" + subtítulo | 🟡 Medio (copy diferente) |
| Search + botón Escanear inline | 2 elementos: input search (flex-1) + botón "Escanear" con icono | Botón "Agregar producto" que abre panel expandible | 🟠 Alto |
| Header de lista productos | "3 productos agregados · Subtotal: $186.50" en bg-slate-50 | Tabla con header "Producto / Cantidad / Costo / Subtotal / acción" | 🟠 Alto (presentación distinta) |
| Fila producto | Emoji grande + nombre + SKU + **chip marca bg-sky-50** + descripción en bold + **stepper ±** + input precio + subtotal teal + trash | ProductoDisplay + inputs number plain + subtotal + trash | 🔴 Crítico |
| Emoji por producto | `🫐 🌿 🍇` (gradient bg + emoji) | ❌ No existe (solo icono pill/sparkles) | 🟠 Alto |
| Stepper de cantidad ± | Botones -/+ con input central | Input number plain | 🟠 Alto |
| Botón "Agregar otro producto" al pie | Border dashed interno en la tabla | Botón externo "Agregar producto" | 🟡 Medio |
| **Toggle sub-órdenes** | Aviso ámbar al final "Si esta OC llega en tandas..." + botón "Configurar sub-órdenes →" | ❌ No existe en el wizard | 🔴 Crítico |

**Gravedad global**: 🔴 Crítico. Falta emoji, chip marca visible, stepper ±, botón escanear, y toggle sub-órdenes completo.

---

## 4. Wizard OC — Paso 3 Cargos (`pane-oc-3` → `StepCargos.tsx`)

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Header | "Cargos, descuentos e impuestos" + subtítulo "Cada uno con su concepto, monto y método de prorrateo. El total se recalcula en vivo." | "Cargos comerciales" + subtítulo | 🟡 Medio |
| **Subtotal contextual** arriba | Banner bg-slate-50 con "Subtotal de productos — $186.50" | ❌ No existe | 🟠 Alto |
| **3 secciones** con header bg-slate-50 | Cargos/Descuentos/Impuestos, cada una con "· suman al total" o "· restan al total" | DynamicChargesSection 3× del DS | 🟢 Bajo (estructura OK) |
| Layout fila | Input concepto + input $ + **dropdown prorrateo** + trash | DynamicChargesSection tiene dropdown SÓLO para impuestos % | 🟠 Alto (falta dropdown prorrateo en cargos/desc) |
| **Datalist autocomplete** concepto | `<datalist>` con conceptos sugeridos | ✅ Implementado via `conceptosSugeridos` | OK |
| Botón "Agregar cargo/descuento/impuesto" | Border-t dashed en el fondo de cada sección | DynamicChargesSection tiene su propio botón | 🟡 Medio |
| Estado vacío impuestos | "Este proveedor no cobra impuesto (Amazon no cobra sales tax...)" italic gris | Texto genérico "Sin impuestos agregados" | 🟡 Medio |
| **Total dinámico panel** | Gradient teal-50→emerald-50 con: Subtotal / +Cargos / −Descuentos / Impuestos / Total a pagar al proveedor | ✅ Implementado similar | 🟢 Bajo |

**Gravedad global**: 🟠 Alto. Falta subtotal contextual inicial + falta dropdown de método de prorrateo visible en cada item (actualmente se usa 'por_valor' fijo hardcoded).

---

## 5. Wizard OC — Paso 4 Inteligencia (`pane-oc-4` → `StepInteligencia.tsx` + `WizardStepInteligencia.tsx`)

**Importante**: el mockup muestra un paso 4 mucho más compacto y visual que el V2 heredado.

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Header | "Inteligencia comercial" + subtítulo + **botón "Saltar paso →"** top-right | Header sin botón saltar | 🟠 Alto (falta skip) |
| Texto "Paso opcional" | "Paso opcional" en amber destacado | ❌ No se marca como opcional | 🟡 Medio |
| **Grid 4 KPIs** | Score de viabilidad (bg-emerald-50, número 87 grande) + Precio vs histórico + Margen proyectado + CTRU estimado | ScoreRing SVG + cards detalladas por producto con 6 métricas | 🔴 Crítico (presentación fundamentalmente distinta) |
| **Tabla comparativa por producto** | Tabla con columnas: Producto / Precio actual / Mejor histórico / Diferencia / Margen esperado | Cards extensas por producto con ScoreRing individual | 🔴 Crítico (estructura distinta) |

**Gravedad global**: 🔴 Crítico. El mockup tiene una presentación **mucho más ejecutiva** (4 KPIs grandes + tabla simple) mientras lo implementado es una **dashboard detallada por producto** (heredada del V2). Son paradigmas distintos.

---

## 6. Wizard OC — Paso 5 Confirmar (`pane-oc-5` → `StepConfirm.tsx`)

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Header | "Confirmar orden de compra" + "Revisa todo antes de crear la OC." | Similar | 🟢 Bajo |
| **Secciones colapsables con botón "Editar"** | Cada sección tiene header con título + botón "✏ Editar" (text-xs teal) que navega al paso | ❌ No existe botón Editar por sección | 🟠 Alto |
| Sección "Proveedor y ruta" | Flag + nombre + mini-ruta inline + tags | RouteVisual grande + datos en grid 2-col | 🟡 Medio |
| Sección productos | Tabla compacta | ProductoDisplay rows con trailing values | 🟡 Medio |
| Resumen financiero | `Row` label/valor | ✅ Implementado | 🟢 Bajo |
| TC editable | Input number dentro de la sección | Input similar con validación | 🟢 Bajo |
| Observaciones | Textarea | ✅ Textarea | 🟢 Bajo |

**Gravedad global**: 🟠 Alto. Falta principalmente botones "Editar" por sección (navegación rápida desde confirmar).

---

## 7. Vista Envíos (`pane-envios` → `Envios.tsx` + `EnvioCard.tsx`)

### Estructura general

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Header ícono teal + título + subtítulo "Logística y operaciones · módulo ejecutivo" | ✅ Header similar | ✅ Implementado | 🟢 Bajo |
| Search global en header | ✅ "Buscar envío, tracking, OC..." | ❌ No existe | 🟠 Alto |
| Botón Exportar + Nuevo Envío | ✅ | ✅ | 🟢 Bajo |
| **Tabs internos** (Operaciones/Incidencias/Reclamos/Costos/Rendimiento) | ✅ Con badge numerado en incidencias/reclamos | ✅ Implementado desde Bloque D S40 | 🟢 Bajo |

### KPIs (6 columnas)

| # | Mockup | Implementación | Gap |
|---|---|---|---|
| 1 | Total — 18 envíos activos (slate) | Total (neutral) | OK pero subtítulo distinto |
| 2 | En tránsito — 5, "138 unidades" (sky, clickable) | En Tránsito ✅ | OK |
| 3 | Pendientes — 3, "recepción parcial" (amber) | Pendientes ✅ | OK |
| 4 | Incidencias — 2, "sin resolver" (red) | Incidencias ✅ | OK |
| 5 | En reclamo — 1, "$45 pendiente" (purple) | En reclamo ✅ | OK |
| 6 | Valor landed — S/ 8,450, "total prorrateado" (emerald) | Valor USD (brand) | Unidad distinta (PEN vs USD) |

**Gravedad global**: 🟡 Medio. Los 6 KPIs están pero subtítulos y unidades divergen.

### Dashboard 2 columnas (breakdown + pipeline)

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| **Breakdown por tipo** | Grid de progress bars con porcentajes: Proveedor→Casilla, Casilla→Perú, Entre casillas origen, DDP directo | ❌ No existe como dashboard separado | 🔴 Crítico |
| **Pipeline logístico** | 4 etapas horizontal (Borrador/Confirmado/En tránsito/Recibida) con íconos + conteos + tiempo prom + fill rate | Presente (StatDistribution) | 🟠 Alto |

**Gravedad global**: 🔴 Crítico. Falta el breakdown por tipo como dashboard visible.

### Filtros + cards envío

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Pills filtro | "Todas (18)", "Activas (10)", "Con incidencias (2)" + dropdowns tipos/couriers | ❌ No existen pills | 🟠 Alto |
| **Card envío con banner incidencia** | Border rojo si tiene incidencia + banner red interno con "1 incidencia abierta" | EnvioCard tiene lógica similar | 🟢 Bajo |
| Cards envío | Border-color por estado + layout 4-5 columnas | EnvioCard tiene ruta con RouteVisual (post quirúrgico) | 🟡 Medio (estructura similar) |
| Footer "Cargar más" | Presente | ❌ No existe | 🟡 Medio |

**Gravedad global**: 🟠 Alto por falta de pills filtro + dashboard breakdown. Cards OK tras edición quirúrgica.

---

## 8. Wizard Envío 3 pasos (`pane-envio` → `EnvioWizardV2/`)

### Encabezado y nota contextual

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Título "Nuevo envío" + "Próximo número: ENV-2026-001" | ✅ Similar | Falta próximo número | 🟡 Medio |
| **Nota aclaratoria Opción A** (sky-50) | Banner "Los envíos desde proveedor nacen automáticos al confirmar OC. Desde aquí creas envíos manuales" | ❌ No existe como banner | 🟠 Alto |
| Contenido 2 columnas (principal + preview sticky) | ✅ | ✅ Implementado via WizardShell previewPanel | 🟢 Bajo |

### Paso 1 Ruta

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| **Tipo de envío** (2 cards grandes) | "Entre casillas origen" / "Casilla → Perú" | ✅ `TipoRutaCard` similar | 🟢 Bajo |
| **Casilla origen** (grid 2-col cards) | Cards con avatar iniciales + flag + CAS-XXX + "18 unidades disponibles" | EntityPicker dropdown | 🔴 Crítico |
| **Casilla destino** (grid 2-col cards) | Cards similar + subtexto contextual ("Consolidar con carga existente", "Viaja próximamente") | EntityPicker dropdown | 🔴 Crítico |
| **Colaborador** opcional | Select con grupos (Couriers externos/Viajeros) + botón + nuevo | EntityPicker con sentinel "Sin asignar" | 🟠 Alto (UI distinta) |
| **Motivo** | Select con opciones predefinidas | ❌ No implementado como select separado | 🟠 Alto |

### Paso 2 Productos

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Header "Productos a mover" + subtítulo contextual con nombres de casillas origen/destino | Similar | 🟢 Bajo |
| Search + botón Escanear | ✅ 2 controles | ❌ Solo carga automática de unidades | 🟠 Alto |
| **Resumen selección** (teal-50) | "12 de 18 unidades seleccionadas · 3 productos" + peso + botones "Limpiar" / "Todas" | Solo resumen visual sin acciones | 🟠 Alto |
| Fila producto | Emoji + nombre + SKU + chip marca + descripción + "10 disponibles en Angie" + **stepper ±** + ratio "8/10" | ProductoDisplay grouped con checkboxes | 🔴 Crítico (presentación distinta) |
| Emoji por producto | 🫐 🌿 🍇 | ❌ No existe | 🟠 Alto |
| Stepper cantidad ± | ✅ -/+ con input | Checkbox toggle individual | 🔴 Crítico (modelo distinto: mockup selecciona CANTIDAD, implementación selecciona UNIDADES individuales) |

### Paso 3 Confirmar

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| Secciones con botón "Editar" | ✅ Cada sección | ❌ No existe | 🟠 Alto |
| Sección ruta | Flag + Angie → Flag + Elsa inline | ✅ RouteVisual | 🟢 Bajo |
| Sección productos | Lista con emoji + nombre + SKU + desc rica + cantidad | Grid de 3 KPIs (Unidades/Productos/Costo) | 🟠 Alto |
| **Info despacho** (tracking/courier/notas opcionales) | Grid 2-col + textarea | ✅ Implementado | 🟢 Bajo |
| Banner **"Sin fechas estimadas"** | Aviso en bg-slate-50 | ❌ No existe el aviso específico | 🟡 Medio |
| Confirmación final | Gradient teal/emerald "Al confirmar: se crea ENV-XXX en borrador" | ✅ Similar | 🟢 Bajo |

**Gravedad global**: 🔴 Crítico. Selectores de casillas como dropdowns en vez de cards, falta emoji + stepper cantidad en productos, modelo de selección de unidades diferente al mockup.

---

## 9. Detalle Envío (`pane-detalle` → `EnvioDetailModal.tsx`)

| Aspecto | Mockup | Implementación | Gravedad |
|---|---|---|---|
| **Header enriquecido** (gradient slate-50→slate-100) | Icono sky + número + estado badge + subtítulo "Internacional → Perú · creado hace 5 días · vinculado a OC-XXX" + botones Imprimir / Registrar recepción / cerrar | Header estándar | 🔴 Crítico (hero ausente) |
| **Ruta horizontal grande** (3 nodos) | Card blanca con 3 columnas: proveedor + casilla + destino, cada una con flag + nombre + badge estado individual + subtexto | RouteVisual size="md" con 2 nodos horizontal | 🟠 Alto (implementado tras cambio quirúrgico pero con 2 nodos en vez de 3) |
| **5 KPIs rápidos** | Grid 5: Unidades / Recibidas / Pendientes / Incidencias (bg-red-50) / Progreso con barra | KPIs existen pero en otra zona | 🟠 Alto |
| **Tabs internos** | Productos / Recepciones / Costos landed / Incidencias / Timeline (con badges numerados) | No existen tabs internos así | 🔴 Crítico |
| **Contenido 2 cols** (tabla principal + sidebar) | Grid `[1fr_320px]` con sidebar sticky | Layout single column | 🔴 Crítico |
| Tabla productos | Con emoji + SKU + chip marca + desc + cantidades enviadas/recibidas/incidencias + progress bar | Lista simple | 🟠 Alto |
| Historial recepciones | Cards con iconos de estado + resumen | No renderizado igual | 🟡 Medio |
| Costos landed resumen | Lista con monto + total prorrateado | Existe en tabla costos | 🟡 Medio |
| **Sidebar contextual** (courier/colaborador/OC vinculada/fecha/acciones rápidas) | Derecha sticky con info clave | No existe sidebar dedicado | 🔴 Crítico |

**Gravedad global**: 🔴 Crítico. Hero, 5 KPIs, tabs internos, y sidebar son elementos estructurales importantes del mockup que no están implementados.

---

## 10. Mockup sub-órdenes S41 (`rework-subordenes-s41.html`)

Mockup secundario creado y validado durante S41. Contiene 4 flujos detallados que complementan al mockup maestro.

---

### 10.1 Flujo 1 — Vista Compras con sub-órdenes accordion (`pane-vista`)

**Alcance**: cómo se renderizan OCs con/sin sub-órdenes en `/compras`. OC con sub-órdenes se expande mostrando cards anidadas colapsables con mini-pipeline siempre visible.

| Aspecto | Mockup S41 | Implementación en `CompraCard.tsx` | Gravedad |
|---|---|---|---|
| OC sin sub-órdenes — layout 5 columnas (Proveedor / Productos / Pipeline dots / Envío / Fecha) | Card con grid 5-col + pipeline de 4 dots | CompraCard 5-col pero sin pipeline-dots inline | 🟠 Alto |
| **Pipeline 4-dots visual** (4 dots con conectores en card) | `pipeline-dots` con 4 estados: Borrador/Confirmada/EnTránsito/Recibida con colores emerald/teal/slate | ❌ No existe — CompraCard solo muestra badge de estado | 🔴 Crítico |
| OC con sub-órdenes — header de OC padre | Pills "En Despacho" + "Pago Parcial" + "3 sub-órdenes" + grid 5-col (Proveedor/Productos/Ruta/Deudor/Fecha) | CompraCard tiene layout distinto sin bloque "Deudor" visible | 🟠 Alto |
| **Chip "3 sub-órdenes"** al lado de pills de estado | Pill teal destacada | CompraCard tiene chip similar pero en columna aparte | 🟡 Medio |
| **Sección "DESGLOSE DEL PROVEEDOR"** con sub-órdenes anidadas | Bloque bg-slate-50 con header "DESGLOSE DEL PROVEEDOR (X SUB-ÓRDENES)" + lista de cards expandibles | ❌ **No existe en absoluto** — CompraCard solo muestra conteo | 🔴 Crítico |
| Sub-orden card header (colapsada) | Fila con: icono expansion + SUB-XXX-A + flecha + ENV-XXX + mini-pipeline 3-dots + pills Estado+Pago + productos resumen + Total | ❌ No renderizada | 🔴 Crítico |
| Sub-orden card expandida | Border teal-300 + grid 2-col (Productos tabla / Cargos del proveedor) + Total con ajuste + Tracking (courier+tracking+despachado) + botones acción | ❌ No implementada | 🔴 Crítico |
| **Mini-pipeline 3-dots por sub-orden** | 3 dots (Confirmada / EnTránsito / Recibida) con estados done/active/pending | ❌ No existe | 🔴 Crítico |
| Botones "Ver timeline completo" + "Registrar pago OC completa" en footer de OC padre | Footer con acciones globales | CompraCard no tiene footer de acciones globales | 🟠 Alto |
| Ayuda contextual "Cada sub-orden tiene su ciclo de vida independiente" | Texto gris al pie del bloque desglose | ❌ No existe | 🟡 Medio |

**Gravedad global**: 🔴 Crítico. `CompraCard.tsx` no tiene nada del accordion de sub-órdenes. El usuario solo ve un chip "3 sub-órdenes" pero no puede expandir ni ver los detalles de cada una.

---

### 10.2 Flujo 2 — ConfirmarOCModal con asignación + distribución de cargos (`pane-modal`)

**Alcance**: modal que aparece al confirmar una OC regular. Pregunta si dividir en sub-órdenes; si el usuario elige dividir, muestra 2 secciones con tablas matriz: (1) asignación de productos a sub-órdenes + (2) distribución de cargos entre sub-órdenes.

**Archivo existente**: `ConfirmarOCModal.tsx` (430 líneas, creado pre-S41 en S36).

| Aspecto | Mockup S41 | Implementación actual | Gravedad |
|---|---|---|---|
| Header modal — breadcrumb + total OC visible | "Confirmar orden" + "OC-XXX · Amazon · $340" | Implementación legacy tiene título distinto | 🟠 Alto |
| **Toggle "¿Dividir en sub-órdenes?"** | 2 botones: "No, mantener como OC única" / "Sí, dividir en 3 sub-órdenes" | Implementación tiene toggle pero distinto | 🟠 Alto |
| **Sección 1 — Tabla matriz asignación productos** | Columnas: Producto / OC original / SUB-A / SUB-B / SUB-C (inputs number) / Asignado / ✓ | Implementación actual tiene asignación pero sin validación visual por fila | 🔴 Crítico |
| **Fila en rojo cuando no cuadra** | bg-red-50 en fila de B12 cuando suma ≠ total | ❌ No hay validación visual por fila | 🔴 Crítico |
| **Icono check/alerta por fila** | Columna ✓ con icono emerald (check) o red (alerta) | ❌ No existe | 🔴 Crítico |
| **Banner error** "Faltan asignar 2 unidades de B12" | Alert rojo con mensaje específico si hay faltante | ❌ No existe | 🔴 Crítico |
| **Sección 2 — Distribución de cargos entre sub-órdenes** | Tabla matriz: Concepto (con pill Cargo/Desc/Imp) / OC original / SUB-A/B/C (inputs) / Distribuido / ✓ | ❌ **Sección completa ausente** — implementación actual NO distribuye cargos | 🔴 Crítico |
| **Pills por tipo de cargo** | Cargo (sky) / Desc (emerald) / Imp (purple) | ❌ No existe | 🔴 Crítico |
| **Totales por sub-orden** (panel final) | Grid 3-col con cálculo explícito "$60 + $4 − $2.70 + $3 = $64.30" por sub-orden | ❌ No existe | 🔴 Crítico |
| **Suma sub-órdenes vs total OC** (reconciliación) | Banner teal "SUMA SUB-ÓRDENES: $332.00 de $340.00 OC" al pie | ❌ No existe | 🔴 Crítico |
| **Botón + Agregar sub-orden** inline | Botón teal outline al lado del título de sección | ❌ No existe | 🟠 Alto |
| Footer — botón "Confirmar OC" disabled cuando hay errores | "Resolver validaciones para confirmar" + botón disabled gris | Botón habilitado siempre | 🟠 Alto |

**Gravedad global**: 🔴 Crítico. La lógica central del mockup (tabla matriz + validación visual por fila + distribución de cargos + reconciliación de sumas) **no está implementada**. Es el gap más grande del mockup S41.

---

### 10.3 Flujo 3 — Detalle sub-orden standalone (`pane-detalle`)

**Alcance**: vista dedicada para una sub-orden específica cuando el usuario hace click "Ver detalle" desde una card expandida. Misma estructura que Detalle OC pero con alcance acotado.

**Implementación actual**: ❌ No existe. No hay componente `SubOrdenDetail` ni ruta/modal dedicada.

| Aspecto | Mockup S41 | Implementación | Gravedad |
|---|---|---|---|
| Header con breadcrumb `OC-XXX › SUB-XXX-B` | Breadcrumb + título "Sub-orden SUB-XXX-B" + pills Estado/Pago | ❌ Vista inexistente | 🔴 Crítico |
| **Pipeline horizontal grande 3 estados** | 3 nodos: Confirmada (done emerald) → En Tránsito (active teal ring-4) → Recibida (pending slate) con fechas debajo | ❌ No existe | 🔴 Crítico |
| **4 KPIs** (Total sub-orden / Productos / Envío vinculado / Pagos) | Grid 4-col con números grandes | ❌ No existe | 🔴 Crítico |
| Tabla productos de la sub-orden | SKU / Producto (nombre + descripción rica) / Cantidad / Precio / Subtotal | ❌ No existe | 🔴 Crítico |
| Cargos comerciales de la sub-orden — panel con desglose completo | Subtotal + shipping + descuento + impuestos + Total sub-orden + Ajuste + Cobrado | ❌ No existe | 🔴 Crítico |
| Envío vinculado card | Card teal con ENV-XXX + estado + ruta + courier + tracking + despachado + botón "Ver envío →" | ❌ No existe | 🔴 Crítico |
| Sección pagos | Panel ámbar "Sin pagos · Saldo pendiente: $145 · Deudor: Amazon" + botón "Registrar pago" | ❌ No existe | 🔴 Crítico |
| Footer acciones | "← Volver a OC-XXX" + "Editar cargos" + "Marcar recibida" | ❌ No existe | 🔴 Crítico |

**Gravedad global**: 🔴 Crítico. Vista completamente ausente. Sin ella, no hay manera de ver el detalle contable de una sub-orden específica más allá del accordion inline de Flujo 1.

---

### 10.4 Flujo 4 — Modal Despachar Envío (Momento 3 — asignación colaborador) (`pane-despachar`)

**Alcance**: modal que aparece cuando el usuario decide despachar un envío que está en estado `Confirmado`. Obliga a capturar colaborador + tracking + fecha. Al confirmar, envío pasa a `En Tránsito`.

**Archivo existente**: `DespacharOCModal.tsx` (343 líneas, creado en S38).

| Aspecto | Mockup S41 | Implementación en `DespacharOCModal.tsx` | Gravedad |
|---|---|---|---|
| **Header con breadcrumb completo** `OC-XXX › SUB-XXX-A › ENV-XXX` | Breadcrumb + título "Despachar envío" | Implementación actual sin breadcrumb | 🟠 Alto |
| **Grid 2 columnas 40/60** (resumen / formulario) | col-span-2 contexto + col-span-3 formulario | Implementación de una sola columna | 🔴 Crítico |
| **Columna izquierda — Resumen del envío** | bg-slate-50 con 3 cards: Ruta visual (flag+nombre+flag) / Productos (2 SKUs · 14 unidades) / Info adicional (OC origen, sub-orden, proveedor, valor declarado, peso, recibido en casilla) | ❌ No existe columna lateral | 🔴 Crítico |
| **Tipo de transporte — 3 cards grandes** | ✈️ Viajero / 📦 Courier internacional / 🏢 Courier externo con border teal para selección | Selector simple distinto | 🔴 Crítico |
| **Selector de colaborador con avatares + métricas** | Lista con avatar circular (iniciales) + nombre + pill "Activa" + "47 envíos previos · 100% entregas a tiempo" | Dropdown simple o autocomplete | 🔴 Crítico |
| Grupos separados (Viajeros internos / Couriers internacionales) con dividers | `─── VIAJEROS INTERNOS ───` como divider gris | Implementación no distingue claramente | 🟠 Alto |
| **Selección visual destacada** (bg-teal-50 + border-l-4 + check derecho) | Border izquierda teal + check icon a la derecha | Implementación distinta | 🟠 Alto |
| Botón "Crear nuevo colaborador inline" | Border dashed teal al final de la lista | ❌ No existe | 🟠 Alto |
| Campo tracking con texto adaptativo | "Opcional para viajeros, recomendado para courier" + placeholder "No aplica para viajeros" + hint "Los viajeros normalmente no tienen tracking" | Implementación tiene campo pero sin adaptatividad visual | 🟠 Alto |
| Campo fecha de despacho con hint contextual | Date picker + "Cuando Angie/el courier efectivamente toma la mercadería" | Similar implementado | 🟢 Bajo |
| Campo nota opcional | Textarea | ✅ Implementado | 🟢 Bajo |
| **Preview del cambio de estado** (al pie) | Banner bg-slate-50 "EFECTO AL DESPACHAR" con pills Confirmado → En Tránsito + aclaración sobre alertas | ❌ No existe | 🟠 Alto |
| Footer con validación visible | "Datos completos, listo para despachar" (emerald) / Resolver validaciones (red) + botón "Despachar envío" | Implementación simplificada | 🟡 Medio |
| **Variante courier** — comparativa visual al pie | Sección secundaria "Datos específicos si eliges Courier internacional" con lista de couriers (DHL/FedEx/UPS) + tarifas + tracking obligatorio | ❌ No existe ni como comparativa | 🟠 Alto (es más explicativo que funcional) |

**Gravedad global**: 🔴 Crítico. La implementación actual de `DespacharOCModal.tsx` tiene el espíritu correcto pero el layout (2 cols), los cards de tipo transporte, los avatares de colaboradores con métricas, y el preview de cambio de estado están muy lejos del mockup.

---

### Resumen global del S41

| Flujo | Gravedad | Estado |
|---|---|---|
| 10.1 Vista Compras con sub-órdenes accordion | 🔴 Crítico | Card sin accordion — **completamente ausente** |
| 10.2 ConfirmarOCModal con validación + distribución | 🔴 Crítico | Existe modal legacy sin lógica central del mockup |
| 10.3 Detalle sub-orden standalone | 🔴 Crítico | **Vista inexistente** |
| 10.4 Modal Despachar Envío | 🔴 Crítico | Existe modal legacy sin layout 2-col ni selección visual rica |

**Conclusión S41**: Los 4 flujos del mockup S41 que validamos juntos están **todos con gap crítico**. Ninguno está alineado al mockup. Lo que existe son versiones legacy pre-S41 que cumplen función técnica pero no la UX validada.

---

## Resumen priorizado (qué hacer primero)

### Nivel 1 — Crítico (bloquea el cumplimiento del rework)

**De S40 maestro:**
1. **Wizard OC Paso 1 Ruta completo** — reescribir con orden correcto (Proveedor → ¿Cómo llega? → Tramos) + selectores de casilla/destino como cards + paneles contextuales morado/sky/emerald/purple para Tramo 1/3
2. **Wizard OC Paso 2 Productos** — agregar emoji, stepper ±, botón Escanear, chip marca, toggle sub-órdenes
3. **Wizard Envío Paso 1 Ruta** — selectores casilla como cards con avatares
4. **Wizard Envío Paso 2 Productos** — modelo stepper cantidad + emoji + chip marca
5. **Detalle Envío completo** — header hero + 5 KPIs + tabs internos + sidebar contextual
6. **Vista Envíos — dashboard breakdown por tipo**

**De S41 sub-órdenes (todo crítico):**
7. **Vista Compras accordion de sub-órdenes** — expansión inline con sub-órdenes anidadas, mini-pipeline 3-dots siempre visible, cards expandibles con productos + cargos + tracking
8. **ConfirmarOCModal reescrito** — toggle dividir, tabla matriz asignación productos con validación visual por fila, tabla matriz distribución cargos, totales por sub-orden, reconciliación suma vs total OC
9. **Detalle sub-orden standalone** — pipeline horizontal grande, 4 KPIs, tabla productos, cargos desglose con ajuste, envío vinculado card, pagos
10. **Modal Despachar Envío V2** — breadcrumb completo, layout 2-col (resumen + formulario), tipo transporte 3 cards, selector colaborador con avatares+métricas+grupos, variante courier adaptativa, preview cambio de estado

### Nivel 2 — Alto (degrada UX percibida)

1. **Vista Compras** — search global, pills filtro, dropdowns adicionales, KPI "Por pagar"
2. **Wizard OC Paso 4 Inteligencia** — rediseño a 4 KPIs + tabla comparativa (paradigma ejecutivo)
3. **Wizard OC Paso 3 Cargos** — subtotal contextual arriba + dropdown prorrateo visible
4. **Paso 5 Confirmar OC** — botones "Editar" por sección

### Nivel 3 — Medio (pulido)

1. Copy de subtítulos y emojis en KPIs
2. Footer "Cargar más" en listas
3. Estados vacíos con copy contextual
4. Nota aclaratoria Opción A en Wizard Envío

### Nivel 4 — Bajo

1. Colores exactos de iconos
2. Microcopy
3. Animaciones `fade-in`

---

## Plan de ejecución sugerido (con S41 incluido)

### Opción A — Alineación crítica (~16-20h, incluye S41)
Solo Nivel 1 de ambos mockups. Obtener S40 maestro + S41 sub-órdenes alineados.

### Opción B — Alineación crítica + alto (~22-26h)
Niveles 1 y 2. Cierra la mayoría del gap visible UX.

### Opción C — Alineación completa (~28-32h)
Niveles 1-4. Pixel-perfect a ambos mockups.

### Recomendación — orden por dependencias

**Tanda 1 — Wizards OC** (S40 maestro, base visual)
1. **Wizard OC Paso 1 Ruta** (establece patrón de secciones visuales, cards de entidades, paneles contextuales)
2. **Wizard OC Paso 2 Productos** (establece patrón emoji + stepper ± + chip marca que se reutilizará)

**Tanda 2 — Wizards Envío** (reutiliza patrones de tanda 1)
3. **Wizard Envío Pasos 1-2** (casillas como cards + productos con stepper)

**Tanda 3 — Sub-órdenes S41** (depende de patrones establecidos)
4. **Vista Compras accordion sub-órdenes** (Flujo 1 S41)
5. **ConfirmarOCModal matriz + validación** (Flujo 2 S41) — más complejo, reescritura significativa
6. **Detalle sub-orden standalone** (Flujo 3 S41) — nueva vista
7. **Modal Despachar Envío V2** (Flujo 4 S41) — reescritura del existente

**Tanda 4 — Vistas principales y detalle**
8. **Detalle Envío** (S40) — header hero + tabs + sidebar
9. **Vista Envíos dashboard breakdown**
10. **Vista Compras — search global + pills filtro + KPI "Por pagar"**

Después de esto, evaluar Nivel 2 y 3 según feedback.

---

## Conclusión del auditor (yo)

Esta auditoría deja en blanco y negro lo que ya había reconocido verbalmente: **el rework S41 tiene deuda visual y estructural sistemática** respecto al mockup validado. El código funciona y compila, los componentes del DS están bien construidos, pero las pantallas que los usan no reflejan el mockup.

La corrección requiere ~10-12h para Nivel 1 (crítico), y es responsable hacerlo antes de considerar el rework "completo". El usuario decide el alcance — yo aporto el inventario honesto.

---

**Auditor**: Claude (yo mismo)
**Método**: lectura sistemática del mockup HTML vs archivos TSX implementados
**Sin escribir código de corrección — solo reporte**
