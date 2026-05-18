# DEUDA-CROSS-LINKS-S2 · cross-links a /tesoreria pendientes de migrar a /finanzas

**Declarada:** chk5.D-S2 · SF6 (2026-05-15)
**Cerrará:** chk5.D-S3 / S4 (tras canonización de wizards Finanzas)
**Decisión rectora:** Opción A · "Preservar Tesorería actual + redirect al final"

---

## Contexto

El sprint chk5.D-S2 unificó el shell Finanzas bajo `/finanzas` con tabs canon
v8.0 (Overview · Saldos · Movimientos · CC · Cash flow · Análisis). Sin embargo,
los wizards operativos (Nuevo movimiento · Conversión USD/PEN · Transferencia
interna · Pagos masivos · Pagar TC · Liquidar recaudadora) siguen viviendo en
`/tesoreria` con look-and-feel legacy.

**Decisión del usuario S2:** preservar `/tesoreria` funcional + diferir el
redirect 301 hasta que los wizards se canonicen (chk5.D-S3/S4). Esto evita
romper flujos operativos en producción mientras se construye el reemplazo.

---

## Cross-links activos `/tesoreria` · auditoría 360

Estos son los puntos del código fuente que actualmente navegan a `/tesoreria`.
Cuando los wizards correspondientes se canonicen bajo `/finanzas`, estos
links deben migrarse en la misma sesión (cero rutas huérfanas · cero
inconsistencia).

### A · Wireup del dropdown "+ Nuevo movimiento" — ✅ CERRADO chk5.D-S4.a (2026-05-16)

Las 8 acciones del dropdown ahora invocan directamente el wizard/modal correspondiente
como overlay sobre el shell. Cero salidas a `/tesoreria`.

| Acción dropdown | Wire-up final |
|------------------|---------------|
| `ingreso_simple` | ✅ `IngresoSimpleModal` (nuevo · canon SF1 · FormModalV2 emerald) |
| `egreso_simple` | ✅ `EgresoSimpleModal` (nuevo · canon SF2 · FormModalV2 rose + cross-link a Gastos) |
| `conversion_usd_pen` | ✅ `ConversionTransferenciaWizard` modo modal `varianteInicial='conversion'` (SF3 · refactor a invocable) |
| `transferencia_interna` | ✅ `ConversionTransferenciaWizard` modo modal `varianteInicial='transferencia'` (SF3) |
| `cobrar_distribuido` | ✅ `PagoAbonoWizard` (ya tenía props `isOpen/onClose` · wire-up directo) |
| `pagar_tc` | ✅ `PagarEstadoCuentaWizard` (ya tenía props) |
| `pagos_masivos` | ✅ `PagosMasivosWizard` modo modal (SF4 · refactor a invocable) |
| `liquidar_recaudadora` | ✅ `LiquidarRecaudadoraWizard` (canon S1f · wire-up directo) |

**Estrategia de refactor:** Conversion + PagosMasivos eran `React.FC` page standalone.
Se agregaron props `isOpen?/onClose?/onSuccess?` opcionales con modo dual:
- Si `isOpen` undefined → comportamiento page standalone (legacy /tesoreria preservado)
- Si `isOpen=true` → wrapper modal con backdrop overlay

✅ **Refactor visual canon al MOCK 3 · chk5.D-S4.b CERRADO 2026-05-16**

Componentes shells canon creados (reutilizables cross-wizards):
- `src/pages/Finanzas/components/wizards/shells/WizardShellSidebar.tsx` (SF1)
  · canon MOCK 3 §3 · sidebar vertical 4 pasos + contexto + footer canon
  · 6 tonos disponibles (purple · indigo · teal · amber · emerald · rose)
- `src/pages/Finanzas/components/wizards/shells/WizardShellStepper.tsx` (SF4)
  · canon MOCK 3 §4 · stepper horizontal 3 pasos · 7 tonos · 3 sizes

Migraciones canon:
- ✅ B.1 `PagoAbonoWizard` → `WizardShellSidebar` purple (SF2) · stepper horizontal interno eliminado
- ✅ B.3 `PagosMasivosWizard` → `WizardShellSidebar` indigo (SF3) · modo dual preservado · sidebar canon en modo modal · StepsSidebar interno preservado en modo page legacy
- ✅ B.2 `PagarEstadoCuentaWizard` → `WizardShellStepper` amber/sky dual (SF4) · stepper interno legacy eliminado

### B · Cross-links desde otras vistas Finanzas — ✅ CERRADO chk5.D-S3.SF5

`src/pages/Finanzas/FinanzasCashFlow.tsx:51`
- ✅ Migrado a `to="/finanzas/movimientos"` · label "Ver ledger"
  (S3.SF6 · 2026-05-15).

`src/pages/Finanzas/Finanzas.tsx:338` (Overview SF5)
- ✅ Card "Movimientos hoy" migrada a `navigate('/finanzas/movimientos')`
  (S3.SF5 · 2026-05-15). Cross-link directo al ledger canon.

### C · Cross-links desde módulos externos a Finanzas — ✅ CERRADO chk5.D-S3.SF6

`src/pages/IntelProductos/components/workspaces/costos/TCPAvsSBSChart.tsx:97`
- ✅ Migrado a `to="/finanzas/saldos"` · label "Ir a Finanzas → Pool USD"
  (S3.SF6 · 2026-05-15). El Pool USD detallado vive en /finanzas/saldos
  hasta que se cree sub-vista dedicada (chk5.D-S4 opcional).

`src/pages/IntelProductos/components/workspaces/EmptyStateGlobal.tsx:133`
- ✅ Migrado a `to="/finanzas"` (Overview · entrada del módulo)
  (S3.SF6 · 2026-05-15).

### D · Routing legacy preservado

`src/App.tsx:213`
- `<Route path="pagos-masivos" element={<Navigate to="/tesoreria" replace />} />`
- Cuando el wizard pagos-masivos se canonice · cambiar a
  `<Navigate to="/finanzas/wizards/pagos-masivos" replace />`.

---

## Plan de cierre por sprint

### chk5.D-S3 · Movimientos + CC + Saldos + Cash flow + Análisis sub-vistas canon
- ✅ Implementar `/finanzas/movimientos` (ledger transaccional unificado) · SF1-SF6 cerradas 2026-05-15
- ✅ Implementar `/finanzas/cc` (vista relacional por entidad) · SF1-SF6 cerradas 2026-05-15 · DrawerCCEntidadCanonico con 4 sub-tabs
- ✅ Implementar `/finanzas/saldos` (productos financieros físicos) · SF1-SF6 cerradas 2026-05-16 · 6 variantes producto + DrawerProductoFinanciero multi-variante
- ✅ Implementar `/finanzas/cash-flow` (proyección 30/60/90d) · SF1-SF6 cerradas 2026-05-16 · ProyeccionChartSVG + 3 escenarios + drivers heurísticos + banner punto tensión
- ✅ Implementar `/finanzas/analisis` (10 gráficas G1-G10) · SF1-SF7 cerradas 2026-05-16 · Pulso + Waterfall + Burn/Runway + WCC + EBITDA Bridge + Calendario + Sankey + Cohort + ROI scatter + Cash flow escenarios
- ✅ Migrar cross-links B (Finanzas.tsx + FinanzasCashFlow.tsx) a las nuevas sub-vistas
- ✅ Migrar cross-links C (módulos externos) a las nuevas rutas

### DEUDAS ANALYTICS declaradas chk5.D-S3.quinto · 2026-05-16
Cálculos del Análisis estratégico actualmente heurísticos · upgrade a real en chk5.D-S4:

| ID | Componente | Descripción |
|---|---|---|
| `DEUDA-LIBRERIA-GRAFICA` | G9 Sankey · Cohort · Bridge | Decidir Recharts vs Chart.js vs Visx. Hoy SVG inline simplificado |
| `DEUDA-FISCAL-FUTURO` | G1.a Waterfall | Activar G1.c con provisión IR 29.5% cuando módulo SUNAT |
| `DEUDA-CALCULO-BURN-RATE` | G3 Burn/Runway | Definir qué categorías cuentan como fijos (sueldos · alquiler · SaaS) |
| `DEUDA-COHORT-DSO` | G5 Cohort | Requiere tracking fecha-primera-venta por cliente |
| `DEUDA-EBITDA-DRIVERS` | G7 Bridge | Descomposición real volumen vs precio vs mix vs FX |
| `DEUDA-COGS-REAL` | G1.a Waterfall · G10 Pulso | COGS estimado 40% · real requiere conexión Cost Intelligence |
| `DEUDA-DIO-REAL` | G2 WCC | DIO fijo 70d · requiere integración inventario |
| `DEUDA-PLANILLA-INTEGRACION` | Calendario | Nómina y alquiler placeholders · requiere conexión Planilla |

### DEUDA-DRIVERS-CONFIG (nueva · declarada chk5.D-S3.quater · 2026-05-16)
Los drivers de proyección de cash flow son actualmente **heurísticos** (calculados
desde data real: CxC due dates + TC ciclos + saldos recaudadora + burn rate
promedio últimos 90d). El mockup MOCK 9 §2 declara que cada driver debe ser
**configurable** por el usuario (% · frecuencia · estacionalidad).

**Plan para chk5.D-S4:**
- Modelo de BD: colección `cashFlowDrivers` con shape `{ id, tipo, parametros,
  activo, userId }`. Tipos: `ingresos_venta` · `sueldos_alquiler` · `tc_ciclo` ·
  `oc_programadas` · `recaudador` · `wallet_settles` · `custom`.
- UI: cards en `DriversConfigSection` (ya pixel-perfect canon) se vuelven
  clickables · abren modal de edición con %/frecuencia/notas.
- Lógica: `extraerDriversProyectados` lee la config y reemplaza la heurística
  default por la del usuario donde aplique.
- Migración: si NO hay config · sigue heurística actual (fallback seguro).

### chk5.D-S4 · Wizards canon Finanzas — ✅ CERRADO 2026-05-16

**S4.a focused · Wire-up directo dropdown** · cerrada 2026-05-16
- ✅ `IngresoSimpleModal` + `EgresoSimpleModal` canon nuevos
- ✅ `ConversionTransferenciaWizard` + `PagosMasivosWizard` refactor a invocables (modo dual)
- ✅ Wire-up 8 acciones del dropdown desde `FinanzasLayout` · cero `/tesoreria` navigate

**S4.b · Refactor visual wizards multi-step al canon MOCK 3** · cerrada 2026-05-16
- ✅ `WizardShellSidebar.tsx` shared (MOCK 3 §3 · 4-pasos · 6 tonos · 12-col grid)
- ✅ `WizardShellStepper.tsx` shared (MOCK 3 §4 · 3-pasos · 7 tonos · 3 sizes)
- ✅ B.1 `PagoAbonoWizard` migrado a `WizardShellSidebar` purple
- ✅ B.2 `PagarEstadoCuentaWizard` migrado a `WizardShellStepper` amber/sky dual
- ✅ B.3 `PagosMasivosWizard` migrado a `WizardShellSidebar` indigo (modo dual preservado)

**S4.c · Redirect /tesoreria efectivo (banner deprecated suave)** · cerrada 2026-05-16
- ✅ `DeprecatedTesoreriaBanner` agregado al top de `Tesoreria.tsx`
- ✅ Cross-links directos del banner a `/finanzas` · `/finanzas/movimientos` · `/finanzas/saldos` · `/finanzas/cc`
- ✅ Alias legacy `/pagos-masivos` ahora redirige directo a `/finanzas` (saltó alias intermedio)
- ⏳ Eliminación física de `Tesoreria.tsx` + sub-componentes legacy difiere a sprint cleanup deep futuro · esperar confirmación 0 uso real durante 30 días post-deploy

### chk5.D-S5 · Cleanup deep — ✅ CERRADO 2026-05-16
**10 archivos @deprecated eliminados** tras verificación 0 refs externas:
- ✅ `src/pages/Finanzas/FinanzasKPIBar.tsx`
- ✅ `src/pages/Finanzas/Overview/KPIsCombinados.tsx`
- ✅ `src/pages/Finanzas/Overview/TendenciaChart.tsx`
- ✅ `src/pages/Finanzas/Overview/AlertasFinanzas.tsx`
- ✅ `src/pages/Finanzas/Overview/TopEntidades.tsx`
- ✅ `src/pages/Finanzas/components/PipelineFinanzas.tsx`
- ✅ `src/pages/Finanzas/components/PipelineCC.tsx`
- ✅ `src/pages/Finanzas/components/AccionesRecomendadasSidebar.tsx`
- ✅ `src/pages/Finanzas/components/EntidadCCCard.tsx` (S3.bis @deprecated)
- ✅ `src/pages/Finanzas/components/PatrimonioHero.tsx` (S3.ter @deprecated)
- ✅ Directorio `src/pages/Finanzas/Overview/` eliminado (vacío post-cleanup)
- ✅ Docstrings de canon limpiados (KpiStripFinanzas + EntidadCCCardCanonico)

Pendiente · `Tesoreria.tsx` y sub-componentes legacy de /tesoreria difieren a
sprint cleanup deep futuro · esperar 30 días post-deploy de S4.c para confirmar
que ningún usuario ni bookmark depende de `/tesoreria` antes de eliminación
física. Banner deprecated ya implementado en S4.c · usuarios son guiados al
shell `/finanzas` con cross-links directos.

---

## Estado actual al cierre de chk5.D-S2

✅ Shell `/finanzas` canon pixel-perfect (header banking-grade · KPI strip 5
   semánticos · tabs 6 sub-rutas)
✅ Overview pixel-perfect (banner caja recaudadora · pipeline cash flow 5
   stages · grid 4 cards · sidebar persistente 5 widgets)
✅ Dropdown "+ Nuevo movimiento" funcional (8 acciones · cross-links placeholder
   a `/tesoreria` documentados en esta deuda)
✅ Tabs Movimientos · CC · Análisis quedan disabled con tooltip "próx" · chk5.D-S3
✅ Sub-vistas Saldos y Cash flow siguen funcionales (legacy preservado)
✅ /tesoreria sigue funcional · sin redirect (decisión rectora Opción A)
✅ 7 componentes legacy del Overview marcados @deprecated (sin eliminar)

⏳ Wizards canon Finanzas · diferidos a chk5.D-S4
⏳ Redirect `/tesoreria → /finanzas` · diferido a chk5.D-S4 (post-wizards canon)
⏳ Sub-vistas Movimientos · CC · Análisis · diferidas a chk5.D-S3

---

## Principio rector aplicado

> "Solución integral y limpia. Nunca parche. Siempre visión 360 del sistema completo."

Esta deuda NO es un parche · es un **diferimiento planificado y registrado**:
- El alcance original de chk5.D-S2 era el shell + Overview (declarado).
- Los wizards eran S4 desde el principio.
- Esta deuda existe únicamente para garantizar que en S4 NO se olvide migrar
  los cross-links · cero rutas huérfanas al cierre del rework Finanzas completo.
