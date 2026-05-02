# AUDITORÍA MAESTRA DE MOCKUPS · Etapa 1

> **Fecha:** 2026-05-01
> **Propósito:** inventariar los 54 mockups producidos a lo largo de 6 eras de evolución del lenguaje visual, identificar inconsistencias entre ellos, y producir la lista de decisiones que necesitamos cerrar antes de implementar pixel-perfect.
> **Estado:** Etapa 1/4 del proceso de uniformización antes de implementación. Las Etapas 2-4 dependen de cerrar decisiones aquí.

---

## 1. Inventario completo · 54 mockups

### Mapa cronológico (en orden de creación · oldest → newest)

| # | Fecha | Archivo | Título | Tipo |
|---|-------|---------|--------|------|
| 01 | Apr 17 | `rework-maestro-s40.html` | Mockup Maestro — Rework OC + Envío + Detalle (S40) | Pantalla compleja |
| 02 | Apr 18 | `rework-subordenes-s41.html` | Mockup Sub-órdenes S41 — Validación de modelo | Modelo + UI |
| 03 | Apr 20 | `envios-transversal-s43.html` | S43 — Mockup Envíos Transversal | Modelo conceptual |
| 04 | Apr 20 | `wizard-t2-pixel-perfect.html` | S44 — Wizard T2 Pixel-Perfect | Wizard |
| 05 | Apr 20 | `wizard-j-pixel-perfect.html` | S47 — Wizard J (Casilla ↔ Casilla) | Wizard |
| 06 | Apr 21 | `producto-pack-skincare.html` | Mockup Producto Pack (Skincare) | Pantalla |
| 07 | Apr 22 | `wizard-envio-unificado-s52.html` | S52 · Wizard de Envíos Unificado v7 | Wizard |
| 08 | Apr 22 | `wizard-envio-unificado-s52-design.md` | Diseño Wizard Envíos Unificado | Spec |
| 09 | Apr 23 | `envio-card-v2-propuestas.html` | EnvioCard v2 · 3 Propuestas | Componente |
| 10 | Apr 23 | `oc-detail-ruta-s54.html` | OC Detail · Ruta estilizada · Propuestas S54 | Sub-componente |
| 11 | Apr 24 | `oc-detail-pipeline-s54.html` | OC Detail · Rediseño del pipeline · S54 | Sub-componente |
| 12 | Apr 24 | `oc-detail-tabs-s54.html` | OC Detail · Sistema de pestañas · S54 | Sub-componente |
| 13 | Apr 24 | `oc-tabs-scroll-s54.html` | OC · Barra de tabs con scroll · S54 | Sub-componente |
| 14 | Apr 24 | `envio-card-narrow-s54.html` | Envío Card · Narrow · Soluciones modernas · S54 | Componente |
| 15 | Apr 26 | `reclamos-procedural-s54.html` | Reclamos · Modelo procedural · S54 | Modelo + UI |
| 16 | Apr 27 | `finanzas-unificadas-s56.html` | Finanzas Unificadas · Mockup S56 | Pantalla |
| 17 | Apr 27 | `finanzas-overview-s57.html` | Finanzas Overview · Mockup S57 | Pantalla |
| 18 | Apr 27 | `pago-abono-distribuido-s58.html` | Pago con abono distribuido · S58b | Modal |
| 19 | Apr 27 | `modales-finanzas-s58.html` | Modales Finanzas v2 · S58 | Modales |
| 20 | Apr 28 | `arquitectura-finanzas-s58.md` | Arquitectura Finanzas v2 · Doc S58 | Spec |
| 21 | Apr 28 | `cuenta-bancaria-full-s58c.html` | Crear cuenta bancaria · Mockup S58c v2 | Modal/Wizard |
| 22 | Apr 28 | `tarjeta-credito-s58d.html` | Tarjeta de crédito · Mockup S58d v2 | Modal |
| 23 | Apr 29 | `tesoreria-pagos-masivos-s58e.html` | Tesorería · Pagos Masivos · S58e | Wizard |
| 24 | Apr 29 | `tesoreria-producto-detalle-s58e.html` | Tesorería · Detalle Producto · S58e | Modal |
| 25 | Apr 29 | `tesoreria-conversion-transferencia-s58e.html` | Tesorería · Conversión + Transferencia · S58e | Wizard |
| 26 | Apr 29 | `tesoreria-pipeline-s58e.html` | Tesorería · Pipeline Expandido · S58e | Pantalla |
| 27 | Apr 29 | `tesoreria-titular-drill-down-s58e.html` | Tesorería · Titular Drill-Down · S58e | Pantalla |
| 28 | Apr 29 | `tesoreria-movimientos-s58e.html` | Tesorería · Movimientos · Libro Mayor · S58e | Pantalla |
| 29 | Apr 29 | `tesoreria-productos-listado-s58e.html` | Tesorería · Productos · Listado · S58e | Pantalla |
| 30 | Apr 29 | `finanzas-saldos-s58e.html` | Finanzas · Saldos · Vista Ejecutiva · S58e | Pantalla |
| 31 | Apr 29 | `finanzas-cash-flow-s58e.html` | Finanzas · Cash Flow · S58e | Pantalla |
| 32 | Apr 29 | `finanzas-listado-s58e.html` | Finanzas · Listado CC · S58e | Pantalla |
| 33 | Apr 29 | `nav-shell-global-s58f.html` | Shell Global · Sidebar + Top Bar · S58f | Layout shell |
| 34 | Apr 29 | `manifesto-visual-s58f.html` | Manifesto Visual S58f · Sistema de diseño | Spec/manifesto |
| 35 | Apr 30 | `productos-rediseno-s58f.html` | Productos · Rediseño S58f | Pantalla |
| 36 | Apr 30 | `productos-intel-s58f.html` | Productos Intel · Rediseño S58f | Pantalla |
| 37 | Apr 30 | `stock-rediseno-s58f.html` | Stock · Rediseño S58f | Pantalla |
| 38 | Apr 30 | `tesoreria-layout-s58f.html` | Tesorería · Shell S58f | Layout shell |
| 39 | Apr 30 | `tesoreria-visualizaciones-s58f.html` | Tesorería · 6 visualizaciones propuestas · S58f | Pantalla |
| 40 | Apr 30 | `caja-agente-recaudador-s58f.html` | Caja Recaudadora · GK Xpress · S58f | Wizard |
| 41 | Apr 30 | `auditoria-pagounificadoform-s58f.html` | Auditoría · PagoUnificadoForm · S58f | Spec/auditoría |
| 42 | Apr 30 | `integracion-oc-tesoreria-s58f.html` | Integración OC ↔ Tesorería · S58f | Spec/integración |
| 43 | Apr 30 | `integracion-venta-tesoreria-s58f.html` | M-INT-VENTA-S58f · Detalle Venta · Panel Cobros | Spec/integración |
| 44 | Apr 30 | `integracion-envio-tesoreria-s58f.html` | M-INT-ENVIO-S58f · Detalle Envío · Panel Pago | Spec/integración |
| 45 | Apr 30 | `integracion-movimiento-docs-s58f.html` | M-INT-MOV-S58f · Detalle Movimiento · Docs origen | Spec/integración |
| 46 | Apr 30 | `mapa-calor-inventario-s58f.html` | M-MAPA-CALOR-S58f · Heatmap de inventario | Pantalla viz |
| 47 | Apr 30 | `pago-unificado-form-v3-s58f.html` | M-PAGOFORM-V3-S58f · PagoUnificadoForm v3 spec | Componente |
| 48 | May 01 | `proveedor-form-inline-s58f.html` | M-FORMS-INLINE-S58f · 4 casos reales | Modales inline |
| 49 | May 01 | `integracion-gasto-tesoreria-s58f.html` | M-INT-GASTO-S58f · Detalle Gasto · Panel Pago | Spec/integración |
| 50 | May 01 | `mapa-ventas-geografico-s58f.html` | M-MAPA-VENTAS-S58f · Análisis geo/temporal ventas | Pantalla viz |
| 51 | May 01 | `journey-consolidado-s58f.html` | M-JOURNEY-S58f · Day-in-life del operador | Spec/journey |
| 52 | May 01 | `ventas-design-canonico-s58f.html` | M-VENTAS-DESIGN-CANONICO-S58f · Style language | Spec/manifesto |
| 53 | May 01 | `gastoform-v2-3-niveles-s58f.html` | M-GASTOFORM-V2-S58f · Modelo 3 niveles | Form |
| 54 | May 01 | `gastos-page-completa-s58f.html` | M-GASTOS-PAGE-S58f · Página completa Gastos | Pantalla |

---

## 2. Clasificación por Era + Módulo + Tipo

### Era 1 · Pre-canónica (Apr 17-20)

| # | Mockup | Módulo | Tipo |
|---|--------|--------|------|
| 01 | `rework-maestro-s40` | Compras | Pantalla compleja |
| 02 | `rework-subordenes-s41` | Compras | Modelo + UI |
| 03 | `envios-transversal-s43` | Envíos | Modelo conceptual |
| 04 | `wizard-t2-pixel-perfect` | Envíos | Wizard |
| 05 | `wizard-j-pixel-perfect` | Envíos | Wizard |

### Era 2 · 6 Referencias canónicas (Apr 21-26)

| # | Mockup | Módulo | Tipo |
|---|--------|--------|------|
| 06 | `producto-pack-skincare` | Productos | Pantalla |
| 07 | `wizard-envio-unificado-s52` | Envíos | Wizard |
| 08 | `wizard-envio-unificado-s52-design.md` | Envíos | Spec |
| 09 | `envio-card-v2-propuestas` | Envíos | Componente |
| 10 | `oc-detail-ruta-s54` | Compras | Sub-componente |
| 11 | `oc-detail-pipeline-s54` | Compras | Sub-componente |
| 12 | `oc-detail-tabs-s54` | Compras | Sub-componente |
| 13 | `oc-tabs-scroll-s54` | Compras | Sub-componente |
| 14 | `envio-card-narrow-s54` | Envíos | Componente |
| 15 | `reclamos-procedural-s54` | Envíos/Reclamos | Modelo + UI |

### Era 3 · Producto Financiero + Finanzas pre-S58e (Apr 27-28)

| # | Mockup | Módulo | Tipo |
|---|--------|--------|------|
| 16 | `finanzas-unificadas-s56` | Finanzas | Pantalla (probablemente obsoleta) |
| 17 | `finanzas-overview-s57` | Finanzas | Pantalla |
| 18 | `pago-abono-distribuido-s58` | Finanzas/Pagos | Modal |
| 19 | `modales-finanzas-s58` | Finanzas | Modales |
| 20 | `arquitectura-finanzas-s58.md` | Finanzas | Spec |
| 21 | `cuenta-bancaria-full-s58c` | Tesorería/PF | Modal/Wizard |
| 22 | `tarjeta-credito-s58d` | Tesorería/PF | Modal |

### Era 4 · Banking-grade (Apr 29 · 11 mockups en 1 día)

| # | Mockup | Módulo | Tipo |
|---|--------|--------|------|
| 23 | `tesoreria-pagos-masivos-s58e` | Tesorería | Wizard |
| 24 | `tesoreria-producto-detalle-s58e` | Tesorería | Modal |
| 25 | `tesoreria-conversion-transferencia-s58e` | Tesorería | Wizard |
| 26 | `tesoreria-pipeline-s58e` | Tesorería | Pantalla |
| 27 | `tesoreria-titular-drill-down-s58e` | Tesorería | Pantalla |
| 28 | `tesoreria-movimientos-s58e` | Tesorería | Pantalla |
| 29 | `tesoreria-productos-listado-s58e` | Tesorería | Pantalla |
| 30 | `finanzas-saldos-s58e` | Finanzas | Pantalla |
| 31 | `finanzas-cash-flow-s58e` | Finanzas | Pantalla |
| 32 | `finanzas-listado-s58e` | Finanzas | Pantalla |

### Era 5 · Manifesto + Cards anchored + Integraciones (Apr 29 - May 01)

| # | Mockup | Módulo | Tipo |
|---|--------|--------|------|
| 33 | `nav-shell-global-s58f` | Layout | Shell |
| 34 | `manifesto-visual-s58f` | Sistema | Manifesto |
| 35 | `productos-rediseno-s58f` | Productos | Pantalla |
| 36 | `productos-intel-s58f` | Productos | Pantalla |
| 37 | `stock-rediseno-s58f` | Inventario | Pantalla |
| 38 | `tesoreria-layout-s58f` | Tesorería | Shell |
| 39 | `tesoreria-visualizaciones-s58f` | Tesorería | Pantalla viz |
| 40 | `caja-agente-recaudador-s58f` | Tesorería | Wizard |
| 41 | `auditoria-pagounificadoform-s58f` | PagoForm | Spec/auditoría |
| 42 | `integracion-oc-tesoreria-s58f` | OC↔Tesorería | Spec |
| 43 | `integracion-venta-tesoreria-s58f` | Venta↔Tesorería | Spec |
| 44 | `integracion-envio-tesoreria-s58f` | Envío↔Tesorería | Spec |
| 45 | `integracion-movimiento-docs-s58f` | Movimiento↔Docs | Spec |
| 46 | `mapa-calor-inventario-s58f` | Inventario | Viz |
| 47 | `pago-unificado-form-v3-s58f` | PagoForm | Componente |
| 48 | `proveedor-form-inline-s58f` | Forms | Modales inline |
| 49 | `integracion-gasto-tesoreria-s58f` | Gasto↔Tesorería | Spec |
| 50 | `mapa-ventas-geografico-s58f` | Ventas | Viz |
| 51 | `journey-consolidado-s58f` | Sistema | Spec/journey |
| 52 | `ventas-design-canonico-s58f` | Ventas | Manifesto |
| 53 | `gastoform-v2-3-niveles-s58f` | Gastos | Form |
| 54 | `gastos-page-completa-s58f` | Gastos | Pantalla |

---

## 3. Familias polimórficas · INCONSISTENCIAS DETECTADAS

Estos son los **componentes/conceptos que aparecen renderizados de forma DISTINTA en mockups distintos**. Son los puntos donde necesitamos decisión antes de implementar.

### F1 · Header de página (banking-grade) ⚠️

**Variantes encontradas:**

| Variante | Mockups que la usan | Características |
|----------|---------------------|-----------------|
| **A · Pre-canónica** | rework-maestro · rework-subordenes · producto-pack | h1 simple sin breadcrumb · acciones a la derecha |
| **B · S54 con breadcrumb** | wizard-envio-unificado-s52 · oc-detail-* · envio-card-narrow | breadcrumb con `·` separador · h1 con icon |
| **C · S58e banking-grade** | tesoreria-movimientos · finanzas-saldos · etc. (8+) | breadcrumb con icon ChevronRight + h1 + icon teal + acciones |
| **D · S58f canónico** | gastos-page · productos-rediseno · stock-rediseno · tesoreria-layout | C + subtítulo extendido (max-w-2xl) + acciones primary-soft |

**Decisión pendiente:** confirmar **variante D** como canónica final para todos los módulos.

---

### F2 · KPI strip ⚠️

**Variantes encontradas:**

| Variante | Mockups | Características |
|----------|---------|-----------------|
| **A · Cards individuales** | tesoreria-productos-listado · finanzas-saldos | grid 4 col · cada KPI es card aparte con shadow + hover |
| **B · Strip horizontal con dividers** | tesoreria-movimientos · gastos-page · stock-rediseno | 1 contenedor blanco con dividers verticales · 4-5 KPIs |
| **C · Strip horizontal con KPI especiales** | productos-rediseno | B + decimales atenuados + sparklines en algunos KPIs |
| **D · Cards expandibles con sparkline** | ventas-design-canonico (manifesto) | Stripe Radar pattern · cards individuales con tendencias |

**Decisión pendiente:** confirmar **variante B** como default + **variante C** cuando aplique sparkline + **variante D** como excepción declarada para dashboards ejecutivos.

---

### F3 · Filtros ⚠️ (la más conflictiva)

**Variantes encontradas:**

| Variante | Mockups | Características |
|----------|---------|-----------------|
| **A · Toolbar + drawer lateral** | gastos-page (originalmente) · finanzas-listado | Sidebar izquierdo con filtros expandibles |
| **B · Pipeline horizontal** | tesoreria-productos-listado · finanzas-saldos | Pipeline-style (componente PipelineHeader) |
| **C · 6ª referencia FiltrosFinanzasBar** | finanzas-saldos S58e (Imp-L11) | Date range + chips estado + chips tipo + búsqueda + orden + limpiar (2 filas) |
| **D · Chips multi en 2 filas** | productos-rediseno · stock-rediseno · gastos-page-actual | Chips por dimensión (Línea/Tipo/Estado) + búsqueda + orden |
| **E · Filtros canónicos por dominio (FiltrosMovimientosBar)** | tesoreria-movimientos | Date range dropdown + categoría + canal + doc + búsqueda |

**Decisión pendiente:** confirmar **variante C/D/E como una sola familia "FiltrosCanonicosBar"** con instancias por dominio (ya existe FiltrosFinanzasBar y FiltrosMovimientosBar y FiltrosGastosBar). Definir si todos heredan de un componente compositional o son siblings.

---

### F4 · Tablas/Listados ⚠️ (3 patrones distintos)

**Variantes encontradas:**

| Variante | Mockups | Características |
|----------|---------|-----------------|
| **A · DataTable simple** | tesoreria-movimientos · tesoreria-conversiones | Tabla densa · filas alternadas · chips · acciones inline |
| **B · Cards apiladas** | gastos-page · envio-card-narrow · finanzas-saldos | Cards con altura propia · más espaciadas · drill-down |
| **C · Linear/Stripe robust grid** | productos-rediseno · stock-rediseno | Grid con avatares apilados · sparkline · sku-avatar overlap |
| **D · Cards anchored al canvas** | ventas-design-canonico (manifesto) · mapa-ventas | Cards flotantes ancladas a coords del mapa/canvas |

**Decisión pendiente:** definir cuándo usar cada variante. Probable taxonomía:
- **Variante A**: ledger / libros mayores (Movimientos · Conversiones · Transferencias)
- **Variante B**: entidades con sub-info (Gastos · Envíos · Saldos por entidad · Compras)
- **Variante C**: catálogos densos con métricas comparativas (Productos · Stock)
- **Variante D**: dashboards visuales con coordenadas/canvas (Ventas geo · Stock heatmap)

---

### F5 · Wizards ⚠️ (4 patrones distintos)

| Variante | Mockups | Características |
|----------|---------|-----------------|
| **A · Sidebar vertical con pasos** | wizard-envio-unificado-s52 · wizard-t2 · wizard-j | Sidebar izquierdo numerado + contenido centro + sidebar derecho persistente |
| **B · Stepper horizontal** | tesoreria-conversion-transferencia | Pasos arriba con check + contenido + footer botones |
| **C · Steps secuenciales con sub-paneles** | tesoreria-pagos-masivos | Wizard pero más vertical · sub-tabs internas |
| **D · Modal-in-modal inline** | proveedor-form-inline · cuenta-bancaria-full | FormModalV2 con secciones colapsables |
| **E · Wizard guiado de creación** | producto-pack-skincare · ProductoCreacionWizard | Pasos secuenciales con preview |

**Decisión pendiente:** ratificar:
- **Variante A** como canónica para wizards de **proceso multi-step largo** (envíos · pagos masivos)
- **Variante B** como canónica para wizards de **3 pasos cortos** (conversión · transferencia · cobro distribuido)
- **Variante D** como canónica para **forms inline** (modales rápidos · creación de entidades pequeñas)

---

### F6 · Modales de detalle ⚠️

| Variante | Mockups | Características |
|----------|---------|-----------------|
| **A · HeaderHero + KpiRow + Tabs** | tesoreria-producto-detalle | Hero gradient + 4 KPIs + tabs (Resumen/Movimientos) |
| **B · Hero + acciones inline** | tesoreria-titular-drill-down | Hero similar pero con back + edit perfil + nuevo producto |
| **C · Card detail simple** | oc-detail-pipeline · oc-detail-tabs | Header sin gradient + tabs |
| **D · Drawer lateral** | EntidadCCDrawer (finanzas) · MovimientoTesoreriaDrawer | Slide-in lateral derecho |

**Decisión pendiente:** ratificar:
- **Variante A** como canónica para detalles de **entidades operativas** (productos PF · cuentas · etc.)
- **Variante D** como canónica para **drill-down rápido** desde listados (entidad CC · movimientos)
- **Variante C** queda como legacy para OC (ya implementada)

---

### F7 · Tabular-nums + decimales atenuados ⚠️ (regla de manifesto · no aplicada uniformemente)

**Inconsistencias:**
- Mockups S58e usan **clase `num-tab`** (custom CSS)
- Mockups S58f usan **clase `tabular-nums`** (Tailwind utility)
- Mockups pre-S58 **no usan** ninguna
- Decimales atenuados (`<span class="text-slate-400 text-sm">.50</span>`) aparecen en S58e/f pero **no consistentemente**

**Decisión pendiente:** ratificar **`tabular-nums` + decimales atenuados** como obligatorios para todo monto. Esto debería ser regla automática vía utility class global.

---

### F8 · Iconografía ⚠️

**Inconsistencias:**
- Algunos mockups usan **emojis** (📦 💰 ⚠️) → Era 1-2
- S58e usa **lucide-icons consistentemente** con colores semánticos
- S58f introduce **iconos a color teal** para headers y mantiene semántica para chips

**Decisión pendiente:** declarar **lucide-react obligatorio** y prohibir emojis en UI productiva. Definir paleta de colores teal/emerald/sky/amber/rose por contexto.

---

### F9 · Breadcrumb separator ⚠️

**Variantes:**
- `·` (puntomedio) → mockups S54
- `>` (chevron texto) → ninguno (descartado)
- `<ChevronRight icon>` → S58e/f mayoritariamente

**Decisión pendiente:** ratificar **`<ChevronRight className="w-3 h-3">`** como único separator canónico.

---

### F10 · Botones de acción en header ⚠️

**Variantes:**
- `Button variant="primary"` → pre-canónica
- `Button variant="primary-soft"` → S58e/f canónico
- `bg-teal-600 ... shadow-sm` (botón inline custom) → algunos mockups S58f

**Decisión pendiente:** ratificar **`Button variant="primary-soft"`** como botón principal del header + **botones blancos con border-slate** como secundarios.

---

### F11 · Mockups con propósitos solapados (probablemente obsoletos)

| Mockup viejo | Probablemente reemplazado por |
|--------------|------------------------------|
| `finanzas-unificadas-s56` | `finanzas-saldos-s58e` + `finanzas-cash-flow-s58e` (la unificación se hizo via tabs) |
| `finanzas-overview-s57` | ¿se mantiene como pantalla específica de overview? · revisar |
| `finanzas-listado-s58e` | ¿es lo mismo que finanzas-saldos-s58e? · revisar |
| `envio-card-v2-propuestas` | `envio-card-narrow-s54` (propuesta histórica · era 3 propuestas alternativas) |
| `cuenta-bancaria-full-s58c` | Reemplazado por `CuentaWizard` actual (S58c-PF) |

**Decisión pendiente:** marcar mockups obsoletos como tales y eliminar del backlog activo.

---

## 4. Decisiones que necesitamos cerrar (Etapa 2)

### Decisiones rápidas (~30 min)
- [ ] **D-F1:** confirmar variante D del header banking-grade como canónica final
- [ ] **D-F7:** ratificar `tabular-nums` + decimales atenuados como obligatorio
- [ ] **D-F8:** declarar lucide-react obligatorio · prohibir emojis
- [ ] **D-F9:** ratificar `<ChevronRight w-3 h-3>` como separator canónico
- [ ] **D-F10:** ratificar `Button variant="primary-soft"` como botón principal del header

### Decisiones de taxonomía (~1h)
- [ ] **D-F2:** definir cuándo usar variante A/B/C/D del KPI strip
- [ ] **D-F3:** definir si los `FiltrosCanonicosBar` por dominio comparten un componente compositional o son siblings
- [ ] **D-F4:** ratificar la taxonomía de tablas/listados (4 variantes con criterio de uso)
- [ ] **D-F5:** ratificar la taxonomía de wizards (5 variantes con criterio de uso)
- [ ] **D-F6:** ratificar la taxonomía de modales (4 variantes con criterio de uso)

### Decisiones de obsolescencia (~30 min)
- [ ] **D-F11:** marcar mockups obsoletos · finanzas-unificadas, envio-card-v2-propuestas, cuenta-bancaria-full · y posiblemente finanzas-overview/listado si se confirma redundancia

### Decisiones de implementación (~30 min)
- [ ] **D-IMPL-1:** confirmar el orden de implementación por módulo (Productos > Stock > Ventas > Conversion > Pagos masivos > Finanzas extendido > Layout)
- [ ] **D-IMPL-2:** confirmar el protocolo nuevo de validación previa para cambios grandes (header + tabla compleja → consultar)
- [ ] **D-IMPL-3:** decidir si actualizamos los mockups de Era 1-3 al estándar canónico final, o si los dejamos como están y solo aplicamos el estándar a la implementación

---

## 5. Estado actual de implementación vs. mockups (resumen)

| Categoría | Count | Mockups |
|-----------|-------|---------|
| 🟢 Pixel-perfect 100% | 18 | Wizards envíos · OC details · Tesorería movimientos · etc. |
| 🟡 Parcial 60-80% | 3 | PAGOFORM v3 (falta Fase 3) · tesoreria-productos-listado · reclamos-procedural |
| 🟠 Parcial 20-40% (parchados sin autorizar) | 6 | productos-rediseno · stock-rediseno · ventas-canonico · conversion-transferencia · pagos-masivos · finanzas-cash-flow |
| 🔴 No implementados | 12 | caja-agente · cuenta-bancaria · finanzas-overview · finanzas-listado · finanzas-unificadas · modales-finanzas · pago-abono-distribuido · tarjeta-credito · tesoreria-layout · tesoreria-visualizaciones · envio-card-v2 · finanzas-overview |
| 🚫 Diferidos pragmáticos | 3 | mapa-calor · mapa-ventas · productos-intel |
| ⚪ Decisión: preservar actual | 1 | nav-shell-global |
| 📄 Specs/Docs (no UI) | 11 | manifesto · journey · 5 integraciones · 2 .md · auditoria · arquitectura · ventas-canonico (es manifesto) |
| **TOTAL** | **54** | |

---

## 6. Próximos pasos · Etapa 2

Este documento es el insumo para Etapa 2 (decisión del estándar canónico final). Antes de implementar nada más:

1. **Revisar este documento juntos** y tomar las decisiones D-F1 a D-F11 + D-IMPL-1 a D-IMPL-3
2. Producir `docs/DESIGN_CANONICO_FINAL.md` con la decisión cerrada por familia
3. Etapa 3 (opcional · si decidimos actualizar los mockups viejos): editar HTMLs de Era 1-3 al estándar nuevo
4. Etapa 4: implementar pixel-perfect en orden definido, validando previamente cada caso grande/riesgoso

**Nada de código nuevo hasta cerrar Etapa 2.**
