# VENTAS · BLUEPRINT DE RE-CONSTRUCCIÓN AL HUB KIT (2026-06-02)

> **Principio:** re-construir la capa de EXPERIENCIA desde el Design System / Hub Kit,
> cubriendo TODA la lógica de Ventas, preservando el MOTOR de negocio (6 servicios, store,
> estados, FEFO, rentabilidad, integraciones — intactos). El mockup nace del kit.

> **Color:** `blue` (grupo Comercial · heredado de grupoColor.ts). Inter · tokens · §A→§F ·
> canon de no-redundancia · cobertura total + mobile · empty con EmptyDashboardSkeleton.

> **Aprendizajes aplicados desde Compras:** (1) auditoría de color EXHAUSTIVA de todas las
> superficies (no solo el shell). (2) No-redundancia verificada contra el strip ANTES de
> construir. (3) Filtro por etapa UNIFICADO (sin Pipeline que clone KPIs). (4) Dashboards
> nacen con su preview (EmptyDashboardSkeleton). (5) Pago = PagoUnificadoForm compartido (invocado).

---

## 0 · LO QUE SE RE-CONSTRUYE vs LO QUE SE PRESERVA

| Se RE-CONSTRUYE (experiencia/UI) | Se PRESERVA INTACTO (motor) |
|---|---|
| Shell, navegación, listado, cards, filtros, KPIs | `venta.service` + pagos/entregas/reservas/recalculo/stats/socios |
| Detalle de venta, wizard, modales | Estados (12), flujo cotización→entregada, FEFO, rentabilidad |
| Cobranzas, Devoluciones, Analítica | Integración Clientes/Inventario/Finanzas-CC/Tesorería/Requerimientos/Envíos |
| Todo ensamblado con el kit (blue) | venta a socio · venta bajo costo · stockReservado · cotización |

---

## 1 · EL SHELL (HubShell + blocks · color blue)

```
HubShell
 ├─ HubTopBar    · "Inicio › Ventas" + chip rol (blue)
 ├─ HubHeader    · icono blue + "Ventas" + subtítulo · acciones 3-tier ([Nueva venta] primary)
 ├─ HubKpiStrip  · 5 KPIs semánticos
 ├─ HubTabs      · 5 tabs (blue)
 └─ HubBody      · cuerpo de la tab activa
```

**KPI strip (5 · semánticos · persistentes):**

| KPI | Tinte | Dato (campo real) |
|---|---|---|
| Vendido mes | amber (dinero) | SUM(totalPEN) del mes · no cancelada |
| Por cobrar | rose (urgencia) | resumenPagos.totalPorCobrar |
| En proceso | sky (proceso) | confirmada+asignada+en_entrega+despachada+parcial |
| Entregadas | emerald (positivo) | entregadas del mes |
| Utilidad / Margen | violet (capital) | utilidadTotalPEN · margenPromedio |

*(Canon de no-redundancia: el Resumen NO re-muestra estos 5.)*

---

## 2 · LAS TABS

### TAB 1 · RESUMEN — dashboard ejecutivo §A→§F (no clona el strip)
- **§A banner salud** — semáforo según por-cobrar vencidas + entregas demoradas + ventas bajo costo + cotizaciones por vencer.
- **§B visualización** — donut **ventas por canal** (ML/directo/otro) + barras **tendencia de ventas 6m**.
- **§C insights** (lo que el strip NO da): **ticket promedio** · **margen neto promedio** · **lead time** (creación→entrega) · **% cumplimiento de cobranza** (cobrado vs facturado).
- **§D acciones** — Nueva venta · Cobrar pendientes · Programar entregas.
- **§E cross-links 360** — Clientes (CRM) · Inventario (stock) · Finanzas (CxC) · Cotizaciones · Envíos.
- **§F alertas** — por cobrar vencidas · entregas demoradas · ventas bajo costo sin aprobar · stock faltante (cotizaciones).
- **Empty** → `EmptyDashboardSkeleton` (preview estructural de §A→§F).

### TAB 2 · VENTAS — la tab operativa (registros individuales)
- **Filtro por etapa UNIFICADO** (chips · canon Compras): Todas · Cotización · Confirmada · Asignada · En entrega · Entregada (counts pequeños · no clona el strip).
- **FiltrosBar** — rango fechas + canal + estado de pago + cliente + búsqueda.
- **Listado de HubCard** — cada venta: nº · cliente · canal (badge) · monto · barra de cobro · estado logístico + estado pago · acciones (Ver/Cobrar/Entregar). Reemplaza VentaCard/VentaTable.
- **Sub-entregas** → HubCard con sub-filas expandibles (entregas parciales).
- Click → **Detalle de venta** (overlay drill).

### TAB 3 · COBRANZAS — cartera por cobrar (foco CxC del lado ventas) ✨NUEVA
- **KPIs de cobranza** (header): total por cobrar · vencido · DSO (días prom. de cobro) · % al día.
- **Aging buckets** (chips clickeables que filtran): Por vencer · 1-30 · 31-60 · 61-90 · +90 días (monto + count cada uno · semáforo amber→rose).
- **Listado** — ventas con saldo: cliente · monto pendiente · días de antigüedad · barra cobrado/total · acción **Cobrar** (→ PagoUnificadoForm compartido).
- **Agrupable por cliente** (cuánto debe cada uno · toggle).
- **Cross-link** a Finanzas (CxC global · no se duplica el motor · esta tab es la VISTA de ventas).
- Reusa: datos de venta (montoPendiente, estadoPago, fechaCreacion) + PagoUnificadoForm. NO motor nuevo.

### TAB 4 · DEVOLUCIONES — la que ya existe, vestida al kit
- DevolucionesTab + DevolucionFormModal re-estilados al kit (blue). Solicitudes · gestión · reembolsos.

### TAB 5 · ANALÍTICA — rentabilidad agregada (lo que el strip no da)
- **Rentabilidad por canal** (margen ML vs directo vs otro) · **margen por producto** (top/bottom) ·
  **lead time** por etapa · **ranking de productos** (más vendidos por unidades/monto) ·
  **cumplimiento de expectativa** (margen real vs esperado de cotización).
- Charts semánticos del kit (el dato manda el tipo). Sube la lógica de VentasDashboard a vista de módulo.
- **Empty** → EmptyDashboardSkeleton.

---

## 3 · DRILL-DOWNS Y OVERLAYS (no son tabs · se re-construyen con el kit)

### DETALLE DE VENTA — drill full-page (canon F6-B)
Header banking-grade (blue) + KpiRow (Total · Margen · Cobrado · Entregado) + NextActionBanner
(CTA sensible al estado: Confirmar / Asignar / Programar entrega / Cobrar). Tabs internos:
- **Productos** — líneas con margen real por producto + estado de asignación (FEFO) + estado de entrega.
- **Cobros** — resumen + historial (fuente CC · `useCobrosVenta`).
- **Entregas** — historial de entregas parciales + programar.
- **Rentabilidad** — costo real vs expectativa de cotización (comparacionExpectativa).
- **Cliente** — datos + dirección + métricas + cross-link CRM.
- **Timeline** — cronología de la venta.

### WIZARD DE CREACIÓN — 4 pasos · al WizardShell del kit (accent="blue")
Productos · Cliente · Pago (adelanto opcional · PagoUnificadoForm) · Confirmación. Preview vivo lateral.
- **Borrador + Descartar** (canon de formularios).
- Soporta: cotización vs venta directa · pre-venta con reserva · venta a socio · venta bajo costo (aprobación).

### MODALES DE FLUJO
- **Registrar cobro** → `PagoUnificadoForm` COMPARTIDO (invocado · NO propio · igual que Compras).
- **Programar entrega** (PROPIO) — FormModalV2.
- **Corregir producto** / **Editar venta** (PROPIO) — FormModalV2.
- **Devolución** (PROPIO) — FormModalV2.
- **Asignar inventario** (feedback FEFO) — confirmación clara.

---

## 4 · LÓGICA TRANSVERSAL · cómo se expresa en el hub

| Lógica (se preserva) | Cómo se VE/opera en el hub |
|---|---|
| Estados duales (logístico + pago) | badge etapa + barra/badge de cobro · separados, siempre legibles |
| Asignación FEFO | estado de asignación por producto + feedback al asignar |
| Rentabilidad real (post-asignación) | tab Rentabilidad del detalle + KPI Margen + Analítica |
| Entregas parciales | sub-filas expandibles + tab Entregas |
| Cotización → Venta | filtro etapa "Cotización" + cross-link a módulo Cotizaciones |
| Pre-venta con reserva | badge "reservada" + vigencia · banner |
| Venta a socio / bajo costo | badge especial + flujo de aprobación preservado |
| Cobros (CC fuente de verdad) | tab Cobranzas + tab Cobros del detalle + KPI Por cobrar |

---

## 5 · COBERTURA DEL MOCKUP (canon · total + mobile + DS-aligned)

Mockup por fases (dado el tamaño):
- **A** · shell + las 5 tabs (vistas) + Resumen §A→§F + Ventas (operativa) + mobile.
- **B** · detalle de venta (drill · tabs internos) + wizard (4 pasos) + mobile.
- **C** · Cobranzas (aging) + Devoluciones + Analítica + modales (incl. invocación PagoUnificadoForm) + mobile.

Cada fase: cobertura total (cards, forms, modales, banners, empty/loading/error) + 375px.

---

## 6 · LO QUE NO SE TOCA (motor)

Servicios (6), tipos, 12 estados, FEFO, rentabilidad, integraciones cross-módulo. El rediseño es de
EXPERIENCIA. Cualquier cambio de lógica que surja se declara y se discute aparte.

---

**Siguiente:** producir el mockup Fase A (shell + Resumen + Ventas + mobile), que el usuario valida.
