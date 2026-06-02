# COMPRAS · BLUEPRINT DE RE-CONSTRUCCIÓN AL HUB KIT (2026-06-02)

> **Principio:** NO es reajustar las superficies actuales metiéndolas en tabs. Es
> **re-construir la capa de experiencia desde el Design System / Hub Kit**, cubriendo
> **toda la lógica** de Compras, preservando el MOTOR de negocio (servicios, estados,
> cálculos, CTRU, CC, integraciones — intactos). El mockup nace del kit, no reúsa los
> componentes legacy (CompraCard, PipelineCompras, OCWizardV3-shell, modales legacy).

> **Color:** `blue` (grupo Comercial · heredado de grupoColor.ts). Inter · tokens · §A→§F ·
> canon de no-redundancia · cobertura total + mobile.

---

## 0 · LA CAPA QUE SE RE-CONSTRUYE vs LA QUE SE PRESERVA

| Se RE-CONSTRUYE (experiencia/UI) | Se PRESERVA INTACTO (motor) |
|---|---|
| Shell, navegación, listado, cards, filtros, búsqueda | `ordenCompra.crud/pagos/proveedores/recepcion.service` |
| Pipeline, detalle de OC, wizard, modales | Estados (8 + cancelada), transiciones, `confirmarOC` |
| Inteligencia, incidencias, timeline, pendientes | Sub-órdenes, CTRU prorrateado, CC, tcCompra/tcPago |
| Todo ensamblado con componentes del kit | Integración Envíos/Inventario/Finanzas/Requerimientos/Contabilidad |

El mockup **refleja toda la lógica** (cero pérdida de funcionalidad) pero la **viste con el kit**.

---

## 1 · EL SHELL (persistente · HubShell + blocks)

```
HubShell
 ├─ HubTopBar      · "Inicio › Compras" + chip rol (blue)
 ├─ HubHeader      · icono blue ShoppingCart + "Compras" + subtítulo
 │                   acciones 3-tier: [Nueva OC] primary-blue · [Exportar] neutral · [Configurar] config
 ├─ HubKpiStrip    · 5 KPIs semánticos (abajo)
 ├─ HubTabs        · 5 tabs (color blue heredado)
 └─ HubBody        · cuerpo de la tab activa
```

**KPI strip (5 · semánticos · persistentes en todas las tabs):**

| KPI | Tinte | Dato |
|---|---|---|
| Comprado mes | amber (dinero) | USD comprado del período |
| Borradores | slate (neutro) | OCs sin confirmar |
| En curso | sky (proceso) | OCs en tránsito + envíos activos |
| Por pagar | rose (urgencia) | monto pendiente a proveedores |
| Completadas | emerald (positivo) | OCs recibidas del período |

*(El canon de no-redundancia rige: el Resumen NO vuelve a mostrar estos 5.)*

---

## 2 · LAS TABS · toda la lógica distribuida y re-construida

### TAB 1 · RESUMEN — dashboard ejecutivo §A→§F (lo nuevo · no clona el strip)
- **§A banner salud** — semáforo de compras (verde/amber/rojo) según OCs por pagar vencidas + por recibir demoradas + borradores estancados.
- **§B visualización** — donut **gasto por proveedor** (concentración) + barras **tendencia de compras 6m**.
- **§C insights** (lo que el strip NO da): **lead time promedio** (días proveedor→recepción) · **concentración top-3 proveedores** (%) · **% cumplimiento de pago** · **variación FX acumulada** (tcCompra vs hoy en PEN).
- **§D acciones rápidas** — Nueva OC · Ver pendientes · Despachar próximos.
- **§E cross-links 360** — → Envíos (en tránsito) · → Inventario (unidades por llegar) · → Finanzas (por pagar) · → Requerimientos (pendientes).
- **§F alertas** — borradores sin confirmar · por pagar vencidas · por recibir demoradas · incidencias abiertas.

### TAB 2 · ÓRDENES — la tab operativa (registros individuales)
Toda la lógica de la página actual, re-construida con el kit:
- **Pipeline 4 etapas** (Borrador → Confirmada → En Despacho → Completada) → fila de **chips/cards clickables** del kit que filtran el listado (reemplaza PipelineCompras legacy). Mapea a los 8 estados internos.
- **FiltrosBar** del kit — rango fechas + chips estado + chips estado-pago + proveedor + línea de negocio (reemplaza los 3 dropdowns + pills actuales).
- **SmartSearch** del kit — OC / proveedor / tracking (reemplaza el search actual).
- **Listado de HubCard** — cada OC como HubCard: ícono-estado · número · proveedor+ruta (banderas) · monto USD · **barra de pago** · acciones (Ver/Pagar/Envíos). Reemplaza CompraCardSimple.
- **Sub-órdenes** → HubCard con **sub-filas expandibles** (el kit lo soporta nativo): la OC madre + el desglose por sub-orden con su mini-pipeline y pago. Reemplaza CompraCardConSubOrdenes + SubOrdenCard.
- **BulkActionsToolbar** — selección múltiple (exportar, pagar lote) con iconos lucide.
- Click en card → **Detalle de OC** (overlay drill).

### TAB 3 · PENDIENTES — requerimientos → OC (operativo)
- Productos pendientes de comprar (desde requerimientos aprobados) como **HubCard** + **BulkActionsToolbar** (seleccionar N → "Crear OC consolidada" → abre el wizard pre-cargado). Re-construye PendientesCompraPanel.

### TAB 4 · PROVEEDORES — evaluación SRM (agregado)
- Directorio con métricas por proveedor (**lead time · ratio incidencias · gasto acumulado · evaluación** aprobado/condicional) como HubCard. Sube la lógica de InteligenciaOCPanel (hoy por-OC) a nivel módulo. CRUD de proveedor → cross-link a Maestros (no se duplica).

### TAB 5 · INTELIGENCIA — análisis a nivel módulo (agregado)
- **Precio vs histórico** (todos los SKU) · **ranking de rentabilidad** (margen proyectado por SKU) · **impacto FX agregado** · **concentración de gasto**. Charts semánticos del kit (el DATO manda el tipo). Sube PriceAdvisor/InteligenciaOC a vista de módulo.

---

## 3 · LOS DRILL-DOWNS Y OVERLAYS (no son tabs del shell · se re-construyen con el kit)

### DETALLE DE OC — drill full-page (canon F6-B) · re-construido
Es donde vive toda la lógica de UNA orden. Se preserva la riqueza pero vestida del kit:
- Header banking-grade (blue) + **RouteCard** (origen→destino + modalidad) + **KpiRow** (Total · Productos · Sub-órdenes · Pagos).
- **NextActionBanner** — CTA sensible al estado (Confirmar / Despachar / Registrar pago).
- **Tabs internos (9)** preservados como sub-navegación del drill: Productos · Cargos & Totales · Pagos · Sub-órdenes · Envíos · Incidencias · Documentos · Inteligencia · Timeline. Cada uno re-construido (tablas/cards del kit).
  - **Pagos** — resumen 4-col + historial (fuente CC · `usePagosOC`).
  - **Sub-órdenes** — lista expandible con pipeline 3-etapas + pago por sub-orden.
  - **Incidencias** — gestión realtime (filtros tipo/estado + nueva).
  - **Inteligencia** — los 4 widgets (SLA · precio · FX · rentabilidad) de ESA OC.
  - **Timeline** — cronología + comentarios internos.

### WIZARD DE CREACIÓN — 5 pasos · re-construido con WizardShell del kit (canon F5: 4+ pasos = sidebar vertical)
- Ruta · Productos · Cargos · Inteligencia · Confirmar. **Preview vivo** lateral (totales en tiempo real).
- **Borrador + Descartar** (canon de formularios · usa borradorWizardService).
- **PriceAdvisor** → drawer/panel del kit dentro del step Productos.
- Soporta: edición de borrador · pre-carga desde requerimiento(s) · multi-viajero (N OCs secuenciales).

### MODALES DE FLUJO — FormModalV2 (canon L4)
- **Confirmar / dividir sub-órdenes** — matriz de asignación productos + distribución de cargos + reconciliación. FormModalV2 grande.
- **Despachar** — courier (SmartSearch select-create) + tracking + fecha.
- **Pago** — PagoUnificado (USD/PEN + TC + método + deudor alternativo).
- **SubOrden detalle** — drill secundario.

---

## 4 · LÓGICA TRANSVERSAL · cómo se expresa en el hub

| Lógica de negocio (se preserva) | Cómo se VE/opera en el hub re-construido |
|---|---|
| **Estados duales** (logístico + financiero) | Badge semántico de estado (pipeline) + barra/badge de pago · separados y siempre legibles |
| **Sub-órdenes** (ciclo autónomo + envío 1:1) | HubCard con sub-filas expandibles · cada una su mini-pipeline + pago |
| **Confirmación** (genera unidades + envíos + CC) | Modal Confirmar → feedback claro ("N unidades pedidas + envíos creados") |
| **Recepción** (desde Envío · CTRU prorrateado) | Estado se sincroniza · cross-link a Envíos · CTRU visible en tab Productos |
| **Pagos** (CC · parciales · deudor alternativo) | Tab Pagos del detalle + barra de pago en card + KPI "Por pagar" |
| **Inteligencia de precios** (histórico/FX/rentabilidad) | Tab Inteligencia (módulo) + widgets en detalle OC + PriceAdvisor en wizard |
| **CTRU** (costo real unitario) | Visible en tab Productos del detalle (badge ~ si varía entre bloques) |
| **Vínculo Requerimientos→OC** | Tab Pendientes + pre-carga del wizard + cross-link |

---

## 5 · COBERTURA DEL MOCKUP (canon de mockups · total + mobile)

El mockup cubrirá, desde el inicio:
1. **Shell** desktop + las **5 tabs**.
2. **Resumen** §A→§F completo.
3. **Órdenes**: pipeline + FiltrosBar + SmartSearch + HubCard (simple + con sub-órdenes) + BulkActions + empty/loading/error.
4. **Detalle de OC**: drill con los 9 tabs internos (al menos Productos/Pagos/Sub-órdenes/Inteligencia/Timeline detallados).
5. **Wizard**: los 5 pasos + preview + PriceAdvisor drawer.
6. **Modales**: Confirmar/dividir · Despachar · Pago.
7. **Pendientes · Proveedores · Inteligencia** (las 3 tabs restantes).
8. **Mobile 375px** de todas las superficies críticas (shell · tabs · card · detalle · wizard · modales como bottom-sheet).

---

## 6 · LO QUE NO SE TOCA (motor de negocio)

Servicios, tipos, estados, transiciones, CTRU, CC, integraciones cross-módulo. El rediseño es de
EXPERIENCIA. Cualquier cambio de lógica de negocio que surja se declara y se discute aparte.

---

**Siguiente paso tras validar este blueprint:** producir el mockup (por fases, dado el tamaño:
A=shell+Resumen+Órdenes · B=detalle OC+wizard · C=Pendientes/Proveedores/Inteligencia+modales · mobile en cada una).
