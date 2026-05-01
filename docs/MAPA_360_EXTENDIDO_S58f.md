# MAPA 360 EXTENDIDO · BusinessMN v2

> **Origen:** sesión S58f. El usuario me corrigió:
> *"no sé si estás viendo 360 el sistema, porque los sidebar tienen más responsabilidades, y en general también hay muchos que tienen formularios o componentes internos. Tendrías que ponerte a mapear cada link o componente derivado."*
>
> **Propósito:** mapeo exhaustivo de TODAS las páginas, sub-páginas, wizards,
> modales, drawers, formularios y componentes derivados del sistema.
> Sin esto, cualquier reorganización deja cosas en el camino.

---

## 0 · Hallazgos críticos que mi Charter NO cubría

Después del mapeo profundo, encuentro que mi Charter (`CHARTER_MODULOS_S58f.md`) tenía 4 fallas serias:

### Falla 1 · Asumí 14 páginas, son 35
El sistema tiene **35 carpetas en `src/pages/`**, no las 14 que listé en el Charter.

### Falla 2 · El sidebar real tiene 6 secciones, no 4
El sidebar actual agrupa por: **Comercial · Inventario · Finanzas y Contabilidad · Análisis · Equipo · Administración**. Mi propuesta de 4 (Operación / Finanzas / Personas / Sistema) no es errónea, pero subestima la complejidad. Hay módulos analíticos pesados (CTRU, Rendimiento FX, Productos Intel, Proyección, Mapa Calor, Reportes) que merecen su lugar.

### Falla 3 · NO existe sección "Personas" en el sidebar real
**Clientes y Proveedores no están en el sidebar como ítems propios.** Viven dentro de **Maestros** (en Administración). Esto cambia mi propuesta — o mantenemos la lógica actual y enriquecemos Maestros, o creamos Personas como sección nueva.

### Falla 4 · Hay módulos completos que ni mencioné
- **CTRU Dashboard** (cálculo Costo Total Real Unitario)
- **Rendimiento Cambiario** (analítica FX)
- **Productos Intel** (inteligencia de catálogo)
- **Proyección** (forecast)
- **Mapa Calor** (geografía de ventas)
- **Reportes** (con 9 tabs)
- **Cotizaciones** (con Kanban + Lista)
- **Requerimientos** (con Kanban + IA)
- **Mercado Libre** (5 tabs)
- **Notas IA**
- **PagosMasivos** (página propia, redirige a Tesorería)
- **Líneas de Negocio** (configuración multi-empresa)
- **Maestros** (catálogos)
- **Auditoría**
- **Escáner** (UX de campo)
- **Unidades** (gestión de unidades de medida o unidades de inventario)
- **TestPDF**

---

## 1 · Inventario completo · 35 módulos

### 1.1 · Sidebar actual (real, según `Sidebar.tsx`)

```
┌─ COMERCIAL ──────────────────────────────────────┐
│   🛒  Compras                                    │
│   🛍️  Ventas                                     │
│   📄  Cotizaciones                               │
│   📋  Requerimientos                             │
│   💧  Mercado Libre                              │
└──────────────────────────────────────────────────┘
┌─ INVENTARIO ─────────────────────────────────────┐
│   📦  Productos                                  │
│   🏪  Stock (Inventario)                         │
│   📦  Unidades                                   │
│   ↔️  Envíos                                     │
│   🌐  Red Logística                              │
│   📷  Escáner                                    │
└──────────────────────────────────────────────────┘
┌─ FINANZAS Y CONTABILIDAD ────────────────────────┐
│   💰  Finanzas                                   │
│   💱  Tipo de Cambio                             │
│   🧾  Gastos Fijos                               │
│   📖  Contabilidad                               │
│   💵  Planilla                                   │
│   ❌  (Tesorería NO está)                        │
└──────────────────────────────────────────────────┘
┌─ ANÁLISIS ───────────────────────────────────────┐
│   📈  Reportes                                   │
│   🧮  Costos CTRU                                │
│   ⚡  Inteligencia Productos                     │
│   📊  Rendimiento FX                             │
│   🎯  Proyección                                 │
│   📍  Mapa Ventas                                │
└──────────────────────────────────────────────────┘
┌─ EQUIPO ─────────────────────────────────────────┐
│   🧠  Notas IA                                   │
└──────────────────────────────────────────────────┘
┌─ ADMINISTRACIÓN ─────────────────────────────────┐
│   🎨  Líneas de Negocio                          │
│   🗃️  Maestros (clientes, proveedores, etc.)    │
│   👤  Usuarios                                   │
│   📊  Auditoría                                  │
│   ⚙️  Configuración                              │
└──────────────────────────────────────────────────┘
```

**Total visible: 28 ítems** (sin Dashboard, sin Tesorería).

---

## 2 · Mapa exhaustivo · módulo por módulo

Para cada uno: ruta, archivo principal, sub-componentes/modales/wizards, propósito **expandido** (no 1 línea — el usuario pidió detalle).

---

### 2.1 · 📊 Dashboard (`/dashboard`)

- **Archivo:** `Dashboard/DashboardPage.tsx` (+ subcarpeta `sections/`)
- **Sub-componentes:** múltiples sections (cards, alertas, KPIs)
- **Modales/wizards propios:** ninguno (es solo lectura)
- **Propósito:** portada del sistema. Sintetiza el día y muestra alertas operativas.
- **Estado:** funciona. Probable necesidad de revisar qué alertas muestra.

---

### 2.2 · 🛒 Compras / Órdenes de Compra (`/compras`)

- **Archivo principal:** `OrdenesCompra/OrdenesCompra.tsx`
- **Mundo interno (en `src/components/modules/ordenCompra/`):**
  - `BorradorOCBanner.tsx` — banner de borrador en proceso
  - `CompraCard.tsx` — vista de listado (referencia canónica #2)
  - `OrdenCompraCard.tsx` — vista detalle (referencia canónica #3)
  - `SubOrdenCard.tsx` + `SubOrdenDetailModal.tsx` — sub-órdenes
  - `PipelineCompras.tsx` — pipeline (referencia canónica #5)
  - `ConfirmarOCModal.tsx` — confirmación
  - `DespacharOCModal.tsx` — despacho
  - `EnviosDeOC.tsx` — envíos vinculados
  - `IncidenciasOCPanel.tsx` — incidencias
  - `InteligenciaOCPanel.tsx` — IA
  - `PendientesCompraPanel.tsx` — pendientes
  - `TimelineOCPanel.tsx` — timeline
  - `OCBuilder/` (subcarpeta) — builder
  - `OCWizardV3/` (subcarpeta) — wizard de creación con sidebar vertical
  - `PriceAdvisor.tsx` + `PriceAdvisorModal.tsx` + `PriceHistoryChart.tsx` — asesor de precios
  - `ProveedorForm.tsx` — formulario de proveedor (¿debería estar en Personas?)
- **Hallazgos:**
  - El módulo es **muy maduro** (tiene 4 referencias canónicas).
  - `ProveedorForm.tsx` está acá pero el dueño de proveedores debería ser Maestros/Personas. **Posible duplicación.**
  - Aún no tiene panel embebido "Pagos y Tesorería" (gap del Charter D-CH-6).
- **Propósito expandido:** ciclo completo de compra desde detección de necesidad → cotización → OC → confirmación → despacho → recepción → cierre. La parte financiera (pagos, cargos a TC) la dispara, pero la opera Tesorería.

---

### 2.3 · 🛍️ Ventas (`/ventas`)

- **Archivo:** `Ventas/Ventas.tsx`
- **Sub-páginas/tabs internos:**
  - `DevolucionesTab.tsx`
  - `DevolucionDetailModal.tsx`
  - `DevolucionFormModal.tsx`
- **Mundo interno (en `src/components/modules/venta/`):**
  - `VentaCard.tsx` — listado
  - `VentaTable.tsx` — vista tabla
  - `VentaForm.tsx` — formulario
  - `VentaDashboard.tsx` — overview
  - `EditarVentaModal.tsx`
  - `CorregirProductoModal.tsx`
  - `EntregasVenta.tsx` — entregas asociadas
  - `ProgramarEntregaModal.tsx`
  - `GastosVentaForm.tsx` — gastos asociados a la venta
- **Hallazgos:**
  - Devoluciones está como tab interno de Ventas. **¿Debería ser su módulo propio?** El usuario mencionó T-G (retorno devolución) en el wizard de Envíos como pendiente.
  - `EntregasVenta.tsx` toca Envíos. Validar que use el wizard T-F unificado.
  - No tiene panel embebido "Cobros y Tesorería" todavía (gap).
- **Propósito expandido:** ciclo de venta → cotización (a veces) → confirmación → despacho/entrega → cobro → cierre. Devoluciones también son ventas (en negativo).

---

### 2.4 · 📄 Cotizaciones (`/cotizaciones`)

- **Archivo:** `Cotizaciones/Cotizaciones.tsx`
- **Mundo interno (todo en `src/pages/Cotizaciones/`):**
  - `CotizacionCard.tsx` — listado
  - `CotizacionDetailModal.tsx` — detalle
  - `CotizacionForm.tsx` — formulario
  - `KanbanCard.tsx` + `KanbanView.tsx` — vista Kanban (excepción legítima)
  - `ListaView.tsx` — vista lista
  - `CotizacionesAlertas.tsx` — alertas
  - `CotizacionesFiltros.tsx` — filtros
  - `CotizacionesMetricas.tsx` — métricas
  - `AdelantoModal.tsx` — modal de adelanto
  - `RechazoModal.tsx` — modal de rechazo
  - `SeccionColapsable.tsx` — sección colapsable
- **Hallazgos:**
  - Tiene su propio sistema de filtros (`CotizacionesFiltros.tsx`). **Candidato a migrar a la 6ª referencia canónica `FiltrosFinanzasBar`.**
  - Es Kanban (excepción legítima, no migra al patrón OC).
  - `AdelantoModal.tsx` toca tesorería. Validar integración.
- **Propósito expandido:** flujo previo a la venta. Una cotización puede convertirse en venta o rechazarse. Adelantos (parciales) generan movimiento de tesorería.

---

### 2.5 · 📋 Requerimientos (`/requerimientos`)

- **Archivo:** `Requerimientos/Requerimientos.tsx`
- **Mundo interno:**
  - `RequerimientosListView.tsx`
  - `KanbanBoard.tsx` + `KanbanCard.tsx` — Kanban
  - `RequerimientoDetailModal.tsx`
  - `RequerimientoFormModal.tsx`
  - `RequerimientosKPIGrid.tsx`
  - `IntelligencePanel.tsx` — panel de IA
  - `SugerenciasStockModal.tsx`
  - `CotizacionesFaltanteModal.tsx`
  - `SelectionFloatingBar.tsx`
- **Hallazgos:**
  - Otro Kanban (excepción legítima).
  - Tiene Inteligencia (panel IA) que sugiere stock o cotizaciones faltantes.
  - Es el "embudo" antes de cotizar/comprar. ¿Cómo se relaciona con Cotizaciones?
- **Propósito expandido:** detección de necesidades del negocio. Un requerimiento puede generar cotización (interna) o pedido a proveedor (OC).

---

### 2.6 · 💧 Mercado Libre (`/mercado-libre`)

- **Archivo:** `MercadoLibre/MercadoLibre.tsx`
- **Mundo interno:**
  - `TabResumen.tsx`
  - `TabProductos.tsx`
  - `TabOrdenes.tsx`
  - `TabPreguntas.tsx`
  - `TabConfiguracion.tsx`
  - `BuyBoxBadge.tsx`
  - `OrderRow.tsx`
- **Hallazgos:**
  - Es **integración externa** (excepción legítima).
  - 5 tabs sólidos. Es un mundo aparte.
- **Propósito expandido:** sincronizar catálogo, gestionar órdenes y preguntas de Mercado Libre. Las órdenes pueden generar ventas en el sistema.

---

### 2.7 · 📦 Productos (`/productos`)

- **Archivo:** `Productos/Productos.tsx`
- **Mundo interno (en `src/components/modules/productos/`):**
  - `BuscadorGrupoProducto.tsx`
  - `DashboardCatalogo.tsx`
  - `FilterChip.tsx` + `FiltrosRapidos.tsx` + `FiltrosDrawerMobile.tsx` — sistema de filtros propio (candidato a migración a referencia #6)
  - `FormVarianteReducida.tsx` — variantes
  - `ComponentesPackSection.tsx` — packs
  - `HistorialPreciosChart.tsx`
  - `InvestigacionModal.tsx` — modal de investigación
  - `AlertasInvestigacion.tsx`
  - `CompetidorPeruList.tsx`
  - `PapeleraModal.tsx` — papelera
- **Hallazgos:**
  - Sistema complejo. Catálogo + variantes + packs + investigación + competidores.
  - Los filtros propios son candidatos a la 6ª referencia canónica.
  - `InvestigacionModal` y `CompetidorPeruList` parecen herramientas de inteligencia comercial.
- **Propósito expandido:** maestro de productos, variantes (SKC), packs, inteligencia comercial (precios competencia, investigación). NO toca stock directamente — eso es Inventario.

---

### 2.8 · 🏪 Inventario / Stock (`/inventario`)

- **Archivo:** `Inventario/Inventario.tsx` + `GestionVencidasModal.tsx`
- **Mundo interno (en `src/components/modules/inventario/`):**
  - `ProductoInventarioTable.tsx`
  - `StockProductoCard.tsx`
  - `UnidadCard.tsx` + `UnidadTable.tsx` + `UnidadDetailsModal.tsx`
  - `UnidadesDesglose.tsx`
  - `RecepcionForm.tsx` — recepción de mercancía
  - `EditarVencimientoModal.tsx`
  - `PromocionModal.tsx`
  - `IncidenciasTab.tsx`
  - `AlertasInventario.tsx` + `AlertasPrioritarias.tsx`
  - `InventarioAnalytics.tsx` + `InventarioPipeline.tsx`
- **Hallazgos:**
  - Es el dueño operativo de stock.
  - Tiene su propio Pipeline + Analytics + Alertas.
  - `RecepcionForm.tsx` se invoca al recibir OC.
- **Propósito expandido:** dueño operacional del stock. Recibe entradas de Compras (vía recepción) y salidas de Ventas (vía despacho). Maneja lotes, vencimientos, ajustes, conteos.

---

### 2.9 · 📦 Unidades (`/unidades`)

- **Archivo:** `Unidades/Unidades.tsx`
- **Hallazgo:** carpeta minimalista con un solo componente. **¿Qué hace exactamente?** Probablemente vista detallada de cada unidad física (lote+vencimiento+ubicación).
- **Posible solapamiento con Inventario.**

---

### 2.10 · 🚚 Envíos (`/envios`)

- **Archivo:** `Envios/Envios.tsx`
- **Mundo interno (todo en `src/pages/Envios/`):**
  - `EnvioCard.tsx` + `EnvioCardSimple.tsx` (referencia canónica #1) — listado
  - `EnvioDetailModal.tsx` (referencia canónica #4) — detalle
  - `EnvioFilters.tsx` — filtros propios
  - `NuevoEnvioMenu.tsx` — menú de nuevo
  - **Wizards (carpetas):**
    - `EnvioWizard/` — wizard unificado (4 tipos C/J/E/I) — S53
    - `EnvioWizardF/` — despacho venta (pendiente migrar a Ventas)
    - `EnvioWizardG/` — devolución (pendiente migrar a Devoluciones)
  - **Sub-mundos:**
    - `SubEnviosT1/` — sub-envíos de tipo T1 (caso Amazon)
    - `CostosLandedScope/` — costos landed con scope (S46)
    - `legacy-shared/` — componentes compartidos legacy (T-F y T-G aún los usan)
  - **Modales:**
    - `DespacharEnvioModal.tsx`
    - `EditFleteModal.tsx`
    - `GestionIncidenciasModal.tsx`
    - `LiberarAduanaModal.tsx`
    - `RecepcionModal.tsx`
  - **Tabs en detalle:**
    - `TabCostosLanded.tsx`
    - `TabIncidencias.tsx`
    - `TabReclamos.tsx`
    - `TabRendimiento.tsx`
- **Hallazgos:**
  - Módulo más complejo del sistema (junto a Tesorería).
  - 4 wizards distintos, 5 modales, 4 tabs internas.
  - Tiene su propio sistema de filtros.
  - Hay deudas declaradas (T-F migrar a Ventas, T-G migrar a Devoluciones, eliminar legacy-shared).
- **Propósito expandido:** hub transversal logístico. Cualquier movimiento físico de mercancía pasa por aquí (T1/T2 desde OC, T-F desde venta futuro, T-G devolución futuro, J entre casillas, E PE→PE, I PE→tercero).

---

### 2.11 · 🌐 Red Logística (`/red-logistica`)

- **Archivo:** `RedLogistica/RedLogistica.tsx`
- **Mundo interno:**
  - `RedLogisticaMapa.tsx` — vista mapa
  - `ColaboradorFormModal.tsx` — alta/edit colaboradores
  - `CasillaFormModal.tsx` — alta/edit casillas
  - `AsociarColaboradorModal.tsx` — asociar colaborador a casilla
  - **Sub-carpetas:**
    - `vistas/` (CasillaExpandible.tsx, layouts especializados S42h)
    - `shared/` (TramosPesoSection, etc.)
- **Hallazgos:**
  - Maneja colaboradores (viajeros, courier intl, transportistas locales) + casillas internacionales.
  - 4 secciones especializadas (Mis Almacenes, Viajeros, Couriers Intl, Transportistas Locales) con 2 vistas (por casilla / por colaborador).
  - Tarifas por tramos de peso integradas.
- **Propósito expandido:** maestro de la red de personas y lugares que mueven mercancía. **No es genérico de "personas" — es específico de logística.**

---

### 2.12 · 📷 Escáner (`/escaner`)

- **Archivo:** `Escaner/Escaner.tsx`
- **Hallazgo:** UX de campo (escaneo de códigos). **Excepción legítima** (full-screen, móvil-first).
- **Propósito:** escanear códigos para recepción rápida o picking.

---

### 2.13 · 💰 Finanzas (`/finanzas`)

- **Archivos:**
  - `FinanzasLayout.tsx` — shell con sub-rutas
  - `Finanzas.tsx` — overview ejecutivo (`/finanzas`)
  - `FinanzasSaldos.tsx` — CC por entidad (`/finanzas/saldos`)
  - `FinanzasCashFlow.tsx` — cash flow (`/finanzas/cash-flow`)
  - `FinanzasKPIBar.tsx`
- **Mundo interno (en `Finanzas/components/`):**
  - `PatrimonioHero.tsx` — hero ejecutivo
  - `FiltrosFinanzasBar.tsx` (referencia canónica #6) — barra de filtros
  - `PipelineCC.tsx` + `PipelineFinanzas.tsx` — pipelines
  - `EntidadCCCard.tsx` + `EntidadCCDetailModal.tsx` + `EntidadCCDrawer.tsx` — CC por entidad
  - `MovimientoTesoreriaDrawer.tsx` — drawer de movimiento (lectura desde Finanzas)
  - `AccionesRecomendadasSidebar.tsx`
  - `CashFlowExecutivePanel.tsx`
  - `PagoAbonoWizard/` — wizard de pago abono distribuido (4 pasos)
- **Mundo interno (`Finanzas/Overview/`):**
  - `KPIsCombinados.tsx`
  - `TendenciaChart.tsx`
  - `TopEntidades.tsx`
  - `AlertasFinanzas.tsx`
- **Estado:** rediseñado a fondo en S58e (Imp-L1 a Imp-L11). Es el módulo más pulido del sistema.

---

### 2.14 · 💼 Tesorería (`/tesoreria`) ⚠️ NO está en sidebar

- **Archivo:** `Tesoreria/Tesoreria.tsx` (1108 líneas)
- **Tabs internas (legacy, a reemplazar):**
  - `TabMovimientos.tsx`
  - `TabConversiones.tsx`
  - `TabTransferencias.tsx`
  - `TabCuentas.tsx`
  - `TabTarjetasCredito.tsx`
  - `TabPagosMasivos.tsx`
  - `TabPipeline.tsx`
  - `TabPendientes.tsx` ← ¿qué hace exactamente?
- **Sub-mundos (carpetas):**
  - `CuentaWizard/` — wizard de creación de cuenta
  - `ConversionTransferenciaWizard/` — wizard de conversión/transferencia (S58 F5)
  - `PagosMasivosWizard/` — wizard de pagos masivos (M5)
  - `ProductoDetalleModal/` — detalle de producto (M2)
  - `TarjetasCreditoV2/` — todo el mundo de TC (S58d)
    - `TarjetaCard.tsx`
    - `TarjetaDetailModal.tsx`
    - `TarjetaFormModal.tsx`
    - `CargarTarjetaWizard/`
    - `PagarEstadoCuentaWizard/`
  - `VistaPorTitular/` — vista por titular (parte de M1)
  - `components/` — atómicos (BankLogo, BankSubheader, ProductCard, PipelineTesoreria, etc.)
- **Componente individual:** `TitularDrilldownView.tsx` — drill-down (M4)
- **Estado:** **el más complejo del sistema y el menos integrado**. Refactor PF cerrado a nivel datos, shell pendiente.

---

### 2.15 · 🧾 Gastos (`/gastos`)

- **Archivos:** `Gastos.tsx` + `GastoForm.tsx`
- **Hallazgo:** mínimo. Solo página + formulario.
- **Propósito:** registro de gastos eventuales y fijos.

---

### 2.16 · 💱 Tipo de Cambio (`/tipo-cambio`)

- **Archivo:** `TipoCambio/TipoCambio.tsx`
- **Servicio:** `tipoCambio.service.ts` (fuente de verdad TC).
- **Propósito:** maestro del TC. Histórico + edición.

---

### 2.17 · 📖 Contabilidad (`/contabilidad`)

- **Archivo:** `Contabilidad/Contabilidad.tsx`
- **Componentes:** carpeta `src/components/modules/contabilidad/`.
- **Estado:** existe pero el usuario confirmó que **no es prioridad** (no usan NIIF/NIF al 100%).

---

### 2.18 · 💵 Planilla (`/planilla`)

- **Archivo:** `Planilla/Planilla.tsx` + carpeta `components/`.
- **Estado:** el usuario confirmó **refactor propio pendiente. No tocar en Fase A.**

---

### 2.19 · 📈 Reportes (`/reportes`)

- **Archivo:** `Reportes/Reportes.tsx`
- **9 tabs:**
  - `TabAuditorias.tsx`
  - `TabClientes.tsx`
  - `TabCompras.tsx`
  - `TabCuentasCorrientes.tsx`
  - `TabCxC.tsx`
  - `TabCxP.tsx`
  - `TabGeografico.tsx`
  - `TabLogistica.tsx`
- **Hallazgo:** módulo robusto. Probable solapamiento con Mapa Calor (Geográfico) y Finanzas (CC, CxC, CxP).
- **Propósito:** reportes operativos transversales por área.

---

### 2.20 · 🧮 CTRU (`/ctru`)

- **Archivo:** `CTRU/CTRUDashboard.tsx`
- **Componentes:** `src/components/modules/ctru/`
- **Servicios:** múltiples (CTRU es un dominio de cálculo complejo).
- **Propósito:** Costo Total Real Unitario. Dashboard del costo verdadero por SKU considerando todos los cargos landed.

---

### 2.21 · ⚡ Productos Intel (`/productos-intel`)

- **Archivo:** `ProductosIntel/ProductosIntel.tsx`
- **Componentes (en `src/components/modules/productoIntel/`):**
  - `ProductoIntelCard.tsx`
  - `ProductoIntelTable.tsx`
  - `LeadTimeCard.tsx`
  - `FlujoCajaCard.tsx`
  - `ScoreLiquidezBadge.tsx`
  - `ResumenCajaCard.tsx`
  - `SugerenciasReposicionCard.tsx`
  - `HistorialVentasChart.tsx`
- **Propósito:** inteligencia analítica del catálogo. Lead time, score de liquidez, sugerencias de reposición.

---

### 2.22 · 📊 Rendimiento Cambiario (`/rendimiento-cambiario`)

- **Archivo:** `RendimientoCambiario/RendimientoCambiario.tsx`
- **Componentes:** `src/components/modules/rendimientoCambiario/`
- **Propósito:** rendimiento del Pool USD TCPA. Cuánto ganaste/perdiste en diferencial cambiario.

---

### 2.23 · 🎯 Proyección (`/proyeccion`)

- **Archivo:** `Proyeccion/Proyeccion.tsx`
- **Propósito:** forecast (FP&A — agente 21).

---

### 2.24 · 📍 Mapa Ventas (`/mapa-ventas`)

- **Archivo:** `MapaCalor/MapaCalor.tsx`
- **Sub-componentes:**
  - `MapaCalorMapa.tsx`
  - `MapaCalorFiltros.tsx`
  - `MapaCalorKPIs.tsx`
  - `MapaCalorPanelZona.tsx`
- **Propósito:** geografía de ventas (mapa de calor por zona).

---

### 2.25 · 🧠 Notas IA (`/notas-ia`)

- **Archivo:** `NotasIA/NotasIA.tsx`
- **Hallazgo:** ¿qué hace? Probable módulo de IA para notas internas / recomendaciones.

---

### 2.26 · 🎨 Líneas de Negocio (`/lineas-negocio`)

- **Archivo:** `LineaNegocio/LineaNegocio.tsx`
- **Componentes:** `src/components/modules/lineaNegocio/`
- **Propósito:** configuración de múltiples líneas de negocio (supone que pueden compartir backend pero separar reportes).

---

### 2.27 · 🗃️ Maestros (`/maestros`)

- **Archivos:**
  - `Maestros.tsx`
  - `MaestrosModals.tsx`
  - `TabClasificacion.tsx`
  - `TabResumen.tsx`
- **Hallazgo CRÍTICO:** acá están **Clientes, Proveedores, Empleados** según veo en los `entidades/` autocompletes. **No están en el sidebar como ítems propios.**
- **Propósito:** catálogos maestros. Pero su nombre es genérico — no comunica que ahí están los clientes/proveedores.

---

### 2.28 · 👤 Usuarios (`/usuarios`)

- **Archivo:** `Usuarios/Usuarios.tsx`
- **Propósito:** usuarios del sistema (login + permisos).

---

### 2.29 · 📊 Auditoría (`/auditoria`)

- **Archivo:** `Auditoria/Auditoria.tsx`
- **Propósito:** auditoría interna del sistema (agente 22).

---

### 2.30 · ⚙️ Configuración (`/configuracion`)

- **Archivos:**
  - `Configuracion.tsx`
  - `BorradoresWizardPanel.tsx` (`/configuracion/borradores`)
- **Propósito:** ajustes generales del sistema.

---

### 2.31 · 👤 Mi Perfil (`/perfil`)

- **Archivo:** `Perfil/MiPerfil.tsx`
- **Propósito:** perfil del usuario logueado.

---

### 2.32 · 💲 PagosMasivos (`/pagos-masivos`)

- **Archivo:** `PagosMasivos/PagosMasivos.tsx` + carpeta `components/`
- **Hallazgo:** la ruta redirige a `/tesoreria` (Navigate replace). Es un **alias legacy**. Pero el archivo existe.
- **Sospecha:** probable página vieja que ya está absorbida por Tesorería. Eliminar tras Fase A.

---

### 2.33 · 🧪 TestPDF (`/test-pdf`)

- **Archivo:** `TestPDF/TestPDF.tsx`
- **Hallazgo:** debug/dev. **No debe estar en producción.** Eliminar o ocultar.

---

### 2.34 · 🚧 Expectativas (`src/pages/Expectativas/`)

- **Hallazgo:** carpeta vacía o casi vacía. **¿Qué se planeaba aquí?** Limpiar.

---

### 2.35 · 🔐 Auth (login/registro)

- **Archivos:** `Login.tsx`, `Register.tsx`, `PendingApproval.tsx`, `AuthDecorations.tsx`
- **Rutas:** `/login`, `/register`, `/pending-approval`
- **Propósito:** autenticación. Fuera del shell autenticado.

---

## 3 · Hallazgos cruzados (problemas detectados al hacer este mapeo)

### 3.1 · Solapamientos / duplicaciones

| Concepto | Aparece en | Quién es dueño | Problema |
|---|---|---|---|
| **Clientes** | Maestros, Ventas (autocompletes), Cotizaciones, Finanzas (CC) | Maestros (datos), Ventas (operación), Finanzas (saldo) | OK pero falta visibilidad — nadie ve "Clientes" en el sidebar |
| **Proveedores** | Maestros, OrdenesCompra (`ProveedorForm.tsx`), Gastos | Maestros (datos), OC (operación) | `ProveedorForm.tsx` en OC duplica capacidad de Maestros |
| **Empleados** | Maestros, Planilla, Tesorería (anticipos) | Maestros (datos), Planilla (operación pendiente refactor) | Bien |
| **Filtros** | Cada módulo tiene los suyos (Cotizaciones, Productos, Inventario, Envíos) | — | Patrón canónico #6 (FiltrosFinanzasBar) debe migrarse |
| **Devoluciones** | Tab interno de Ventas | Ventas (hoy), Envíos (T-G futuro) | Migración pendiente |
| **CTRU** | Productos (consume), CTRU dashboard, Compras (en costos), Envíos (costos landed) | CTRU (cálculo), Productos (visualización por SKU) | OK |
| **Adelantos / aportes / retiros** | Tesorería (movimientos) | Tesorería | OK pero sin UI dedicada |
| **PagosMasivos** | Página propia + dentro de Tesorería | Tesorería | Página /pagos-masivos es alias legacy a eliminar |
| **Reportes vs Mapa Calor** | Reportes tiene TabGeografico, Mapa Calor es página propia | — | ¿Duplicado? |
| **Reportes CC vs Finanzas Saldos** | Reportes tiene TabCuentasCorrientes/TabCxC/TabCxP, Finanzas/saldos es la vista principal | Finanzas (vista canónica) | Tabs de Reportes pueden ser obsoletos o complementarios |

### 3.2 · Páginas con propósito poco claro (necesitan validación tuya)

| Página | Pregunta |
|---|---|
| `/notas-ia` | ¿Qué hace exactamente? |
| `/expectativas` | ¿Qué se planeaba aquí? Está vacío |
| `/test-pdf` | ¿Sigue siendo necesario? |
| `/unidades` | ¿Qué hace que no haga `/inventario`? |
| `/lineas-negocio` | ¿Es multi-tenant? ¿Multi-empresa? |
| `/auditoria` | ¿Qué muestra? Logs, hallazgos, configuración |

### 3.3 · Páginas con potencial de fusión

- `/inventario` + `/unidades` → ¿son la misma cosa con vistas diferentes?
- `/reportes` + `/mapa-ventas` → ¿el mapa puede ser un tab de Reportes?
- `/reportes` + `/finanzas/saldos` → tabs CC/CxC/CxP duplican

### 3.4 · Módulos pendientes de migrar al patrón canónico (referencia #6 filtros)

Cada uno tiene su propio sistema de filtros que debería migrar a `FiltrosFinanzasBar`:

- Cotizaciones (`CotizacionesFiltros.tsx`)
- Productos (`FiltrosRapidos.tsx` + `FiltrosDrawerMobile.tsx`)
- Inventario (filtros internos)
- Envíos (`EnvioFilters.tsx`)
- MapaCalor (`MapaCalorFiltros.tsx`)
- Compras (filtros propios)
- Reportes (filtros por tab)

**Total: 7 módulos.** Esa es la "TAREA-FILTROS-GLOBAL" declarada como deuda.

### 3.5 · Wizards y modales globales que el shell debería conocer

- OCWizardV3 (compras)
- EnvioWizard / WizardF / WizardG (envíos)
- CuentaWizard (tesorería)
- ConversionTransferenciaWizard (tesorería)
- PagosMasivosWizard (tesorería)
- CargarTarjetaWizard (tesorería)
- PagarEstadoCuentaWizard (tesorería)
- PagoAbonoWizard (finanzas)
- BorradoresWizardPanel (configuración)
- VentaForm (ventas)
- CotizacionForm (cotizaciones)
- RequerimientoFormModal (requerimientos)
- DevolucionFormModal (ventas)
- ColaboradorFormModal + CasillaFormModal + AsociarColaboradorModal (red logística)
- GastoForm (gastos)
- ProveedorForm (compras — duplicación)
- VarianteForm (productos)
- InvestigacionModal (productos)
- + ~30 modales de detalle

**Total: ~50+ formularios/wizards.** Todos deberían usar `FormModalV2` (D-S58-3) — auditar cuáles ya migran.

---

## 4 · Sidebar reorganizado v2 (basado en hallazgos)

```
┌─ OPERACIÓN COMERCIAL ──────────────────────────────┐
│   📊  Dashboard                                    │
│   📋  Requerimientos      (detección de necesidad) │
│   📄  Cotizaciones        (oferta al cliente)      │
│   🛒  Compras             (a proveedor)            │
│   🛍️  Ventas              (a cliente)              │
│   💧  Mercado Libre       (canal externo)          │
└────────────────────────────────────────────────────┘
┌─ OPERACIÓN LOGÍSTICA ──────────────────────────────┐
│   📦  Productos           (catálogo)               │
│   🏪  Stock               (inventario operativo)   │
│   ↔️  Envíos              (movimientos físicos)    │
│   📷  Escáner             (UX campo)               │
└────────────────────────────────────────────────────┘
┌─ FINANZAS Y CONTABILIDAD ──────────────────────────┐
│   💰  Finanzas            (visión ejecutiva)       │
│   💼  Tesorería           (operación dinero) ⭐NEW │
│   🧾  Gastos              (egresos no-OC)          │
│   💱  Tipo de Cambio                               │
│   📖  Contabilidad        (stand-by mayoritario)   │
│   💵  Planilla            (refactor propio)        │
└────────────────────────────────────────────────────┘
┌─ PERSONAS Y SOCIOS ────────────────────────────────┐
│   👥  Clientes            (extraído de Maestros)   │
│   🏢  Proveedores         (extraído de Maestros)   │
│   🌐  Red Logística                                │
│   🪪  Empleados                                    │
└────────────────────────────────────────────────────┘
┌─ ANÁLISIS Y DECISIONES ────────────────────────────┐
│   📈  Reportes                                     │
│   📍  Mapa Ventas         (¿absorber a Reportes?)  │
│   🎯  Proyección          (FP&A)                   │
│   🧮  CTRU                (costos)                 │
│   ⚡  Productos Intel                              │
│   📊  Rendimiento FX                               │
│   🧠  Notas IA            (validar utilidad)       │
└────────────────────────────────────────────────────┘
┌─ ADMINISTRACIÓN ───────────────────────────────────┐
│   🎨  Líneas de Negocio                            │
│   🗃️  Maestros            (catálogos NO personas)  │
│   👤  Usuarios                                     │
│   📊  Auditoría                                    │
│   ⚙️  Configuración                                │
└────────────────────────────────────────────────────┘
```

**Cambios respecto al sidebar actual:**

| Cambio | Razón |
|---|---|
| Sección "Comercial" → "Operación Comercial" | Más explícito |
| Sección "Inventario" → "Operación Logística" | Refleja que toca todo flujo físico |
| Tesorería entra al sidebar bajo Finanzas | Resuelve "huérfana" |
| Nueva sección "Personas y Socios" | Clientes/Proveedores salen de Maestros |
| Maestros pasa a ser solo catálogos no-personas | Su nombre coincide con su función real |
| "Análisis" → "Análisis y Decisiones" | Refleja propósito |
| "Equipo" eliminado, Notas IA va a Análisis | Notas IA es analítica, no equipo |
| Dashboard primero (era único de "Operación") | Es portada, va arriba |

**Total: 6 secciones, ~28 ítems** (similar al actual pero mejor agrupado).

---

## 5 · Plan de implementación revisado

Basado en este mapeo extendido, el plan de Fase A original sigue siendo válido pero con ajustes:

### Lo que sigue igual
- Sidebar accesible (Tesorería visible)
- TesoreriaLayout con VistaPorTitular como home
- Banner promoción `datosBancarios` (CRÍTICO por GK Xpress 90%)
- Vista de Caja Recaudadora
- Entry points de wizards desde detalles

### Lo que se agrega tras este mapeo
- **Decisión sobre "Personas" en sidebar** (extraer de Maestros sí/no)
- **Limpieza de páginas con propósito poco claro** (Expectativas, TestPDF, Notas IA validar)
- **Decisión sobre fusiones** (Inventario+Unidades, Reportes+Mapa)
- **Auditoría de duplicaciones** (`ProveedorForm` en OC, /pagos-masivos legacy)
- **Migración de filtros propios** a referencia canónica #6 (7 módulos pendientes)

### Lo que NO entra en Fase A
- Refactor de Planilla (tiene su propio plan)
- Contabilidad NIIF/NIF (stand-by)
- S58e Trazabilidad TC (stand-by)
- Mercado Libre y Escáner (excepciones legítimas)

---

## 6 · Preguntas concretas para validar

Antes de seguir produciendo cualquier mockup, necesito que valides estas decisiones de organización:

### V-MAP-1 · ¿Confirmas el sidebar reorganizado v2 (sección 4)?
O prefieres mantener las 6 secciones actuales (Comercial / Inventario / Finanzas / Análisis / Equipo / Administración).

### V-MAP-2 · ¿"Personas y Socios" como sección propia, o mantenemos a Clientes/Proveedores dentro de Maestros?
Pro de extraer: claridad. Contra: cambio mayor.

### V-MAP-3 · ¿Qué hacemos con páginas de propósito poco claro?
- `/notas-ia` — ¿qué hace?
- `/expectativas` — ¿se elimina?
- `/test-pdf` — ¿se elimina?
- `/unidades` — ¿se fusiona con Inventario?
- `/lineas-negocio` — ¿multi-tenant o multi-línea?

### V-MAP-4 · ¿Fusionamos algunas páginas?
- Reportes + Mapa Ventas
- Inventario + Unidades

### V-MAP-5 · ¿Cuáles solapamientos resolvemos primero?
- `ProveedorForm.tsx` en Compras (debería ser solo lectura, edit en Maestros)
- `/pagos-masivos` legacy (eliminar)
- Devoluciones tab en Ventas → ¿migrar a /devoluciones propio?

---

## 7 · Lo que NO voy a hacer hasta que valides este mapa

1. ❌ No produzco más mockups visuales.
2. ❌ No toco código.
3. ❌ No propongo "más entrelazado".

## 8 · Lo que sí haré cuando valides

1. ✅ Actualizar el Charter (`CHARTER_MODULOS_S58f.md`) con tus decisiones.
2. ✅ Producir mockups por LOTE y por SECCIÓN, no aleatoriamente.
3. ✅ Cada mockup mostrará el módulo + sus integraciones + sus modales/wizards principales.

---

> **Última actualización:** 2026-04-29 · sesión S58f
> **Estado:** mapeo profundo completo, esperando validación V-MAP-1 a V-MAP-5
> **Siguiente paso (post-validación):** actualizar Charter + producir mockups por sección
