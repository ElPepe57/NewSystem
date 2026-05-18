# AUDIT FINAL · chk5.D-S1e · Mockups Finanzas v5.1

**Fecha cierre:** 2026-05-15
**Sprint:** chk5.D-S1e (Mockups v5.1 canon definitivo Tesorería/Finanzas)
**Cobertura REAL:** 20 mockups + SUPERSEDED.md + AUDIT-FINAL.md = **100% real auditado**

## ⚠️ Nota de transparencia · sprint extendido

Esta versión actualizada (post-Turno 8) corrige el AUDIT-FINAL inicial que
declaraba 100% prematuramente sin auditar categorías individuales. Tras
observación del usuario, se ejecutó audit honesto que reveló cobertura
real ~82% en cierre Turno 7. Turno 8 cerró los 4 gaps reales:

- **MOCK 18** · Wizard Editar Cuenta (gap wizards 69% → 100%)
- **MOCK 19** · Sub-vistas alternativas (gaps drawers CC sub-tabs +
  toggles Saldos + timeline + calendario + grid · 30% → 100%)
- **MOCK 20** · 4 modales detalle + 6 estados permisos + 3 estados
  avanzados (modales 70% → 100% · estados avanzados 30% → 100%)

**Lección aplicada · canon "sin atajos" reafirmado:** declarar cobertura
real con audit categórico antes de cerrar, NO checklist superficial.

---

## 1 · Mapa completo mockup → ruta/componente para implementación

Tabla de referencia para chk5.D-S2 (shell + Overview) · chk5.D-S3 (vistas operativas) · chk5.D-S4 (wizards + cleanup). Cada mockup mapea a archivos concretos del código.

| Mockup | Cobertura | Ruta/Componente afectado |
|--------|-----------|--------------------------|
| **MOCK 1** · shell-overview | Header banking + KPI strip + tabs 6 sub-rutas + Overview default + sidebar persistente + dropdown +Nuevo movimiento | `src/pages/Finanzas/Finanzas.tsx` (reescribir) · `src/pages/Finanzas/FinanzasLayout.tsx` (refactor shell) · `src/pages/Finanzas/Overview/` (carpeta nueva) · `KpiStripFinanzas.tsx` (nuevo) · `DropdownNuevoMovimiento.tsx` (nuevo) |
| **MOCK 2** · cuentas-completo | Vista Productos + listado agrupado por titular + 5 drawers F6.E (Recaudadora · TC bimoneda · TC personal · Bancaria+canales · TC débito vinculada) + drill titular | `src/pages/Finanzas/FinanzasSaldos.tsx` (refactor) · `src/components/finanzas/CuentaCard.tsx` (nuevo) · `src/components/finanzas/CuentaDrawer.tsx` (nuevo · F6.E) · variantes drawer por tipo |
| **MOCK 3** · wizards-completos | Matriz 8 wizards + ZOOM Conversión USD/PEN + PagoAbono distribuido + Liquidar Caja Recaudadora + PagoUnificadoForm v3 con F-Borradores | `src/pages/Finanzas/components/PagoAbonoWizard/` (refactor) · `src/pages/Tesoreria/TarjetasCreditoV2/PagarEstadoCuentaWizard/` (refactor) · `src/pages/Tesoreria/PagosMasivosWizard/` (refactor) · `src/pages/Finanzas/components/LiquidarRecaudadoraWizard/` (NUEVO) |
| **MOCK 4** · analisis-estrategico | 10 gráficas canon-level en 3 tiers (Pulso · Waterfall · Burn · Working Capital · EBITDA Bridge · Calendario · Sankey · Cohort · ROI · Cash flow escenarios) | `src/pages/Finanzas/Analisis/` (NUEVO) · 10 componentes gráfica · `src/services/finanzas.analisis.service.ts` (NUEVO) · DEUDA-LIBRERIA-GRAFICA decisión Recharts vs Visx |
| **MOCK 5** · integraciones-crossmodulo | 4 panels embebidos (OC + Venta resumen + Envío resumen + Gasto resumen) + Vista inversa Movimiento → Doc origen | `src/pages/Finanzas/MovimientoDetalle.tsx` (NUEVO ruta /finanzas/movimientos/:id) · `src/components/finanzas/PanelOCEmbebido.tsx` etc. |
| **MOCK 6** · vista-saldos | Vista Saldos completa con KPI + listado USD agregado Pool + drawers Wallet + Caja efectivo + estados vacío/loading/error + mobile | `src/pages/Finanzas/FinanzasSaldos.tsx` (refactor) · `KpiStripSaldos.tsx` · `WalletDrawer.tsx` · `CajaEfectivoDrawer.tsx` · `EstadosCuentas.tsx` |
| **MOCK 7** · vista-movimientos | Vista Movimientos ledger + FiltrosBar canon + agrupado por día + sub-vistas timeline/calendario + estados | `src/pages/Finanzas/FinanzasMovimientos.tsx` (NUEVO · separar de Tesoreria/TabMovimientos legacy) · `FiltrosMovimientosBar.tsx` (refactor canon) · `MovimientoTimelineView.tsx` |
| **MOCK 8** · vista-cc-entidades | Vista CC + KPI + listado agrupado por tipo entidad + drawer CC con 4 sub-tabs (Resumen · Movs · Docs · Análisis 12m) + estados | `src/pages/Finanzas/FinanzasCC.tsx` (NUEVO) · `CCEntidadDrawer.tsx` · sub-tabs componentes · auditar `src/services/cuentaCorriente.adaptadores.ts` |
| **MOCK 9** · vista-cashflow | Vista Cash flow proyectado + KPI + 3 escenarios (optimista/base/pesimista) + drivers + gráfico bandas + estados | `src/pages/Finanzas/FinanzasCashFlow.tsx` (NUEVO) · `src/services/finanzas.cashflow.service.ts` (NUEVO) · DEUDA-DRIVERS-CONFIG |
| **MOCK 10** · wizard-nueva-cuenta | 19 pantallas pixel-perfect (selector + 6 tipos × 4 pasos) · canales digitales vs wallets · TC bimoneda con 2 cuentas pago default · 6to tipo Caja Recaudadora multi-canal | `src/pages/Tesoreria/CuentaWizard/` (refactor + agregar Paso2 variantes por tipo · agregar tipo `caja_recaudadora`) · ver DEUDA-MODELO-RECAUDADOR + DEUDA-TC-CUENTA-PAGO-DEFAULT-BIMONEDA |
| **MOCK 11** · wizards-simples | 3 modales 1-paso pixel-perfect (A.1 Ingreso emerald · A.2 Egreso rose + cross-link Gastos · A.4 Transferencia indigo) | `src/components/finanzas/IngresoSimpleModal.tsx` (NUEVO) · `EgresoSimpleModal.tsx` (NUEVO) · `TransferenciaModal.tsx` (NUEVO) |
| **MOCK 12** · wizards-multistep | B.1 PagoAbono 4 pasos completos + B.2 Pagar TC 3 pasos + B.3 Pagos masivos 4 pasos Opción A monocuenta-monomoneda | refactor B.1 (preservar lógica adaptadores) · refactor B.2 paso 1 ciclo selección · refactor B.3 paso 1 enforcing monocuenta |
| **MOCK 13** · pago-unificado-form-4modos | PagoUnificadoForm v3 · 4 modos (Cobro · Pago simple · Pago proveedor · Pago colaborador) · F-Borradores integrado · 9 bloques modulares | `src/components/modules/pagos/PagoUnificadoForm.tsx` (refactor MAYOR · agregar F-Borradores · agregar modos · cross-link Caja Recaudadora en Pago colaborador) |
| **MOCK 14** · integraciones-detalladas | 3 panels embebidos pixel-perfect (Venta fuchsia · Envío indigo con Caja Recaudadora · Gasto amber 3 stages) | `src/components/modules/venta/VentaTesoreriaPanel.tsx` (NUEVO) · `src/components/modules/envio/EnvioPagoColabPanel.tsx` (NUEVO) · `src/components/modules/gastos/GastoPagoPanel.tsx` (NUEVO) |
| **MOCK 15** · modales-secundarios | 9 modales pixel-perfect (Configurar TC · Archivar · Eliminar · Arqueo · TC override · Settings · Conciliación · Exportar · Moneda funcional) | `src/components/finanzas/modales/` (carpeta NUEVA) · 9 componentes modales · prioridad implementación: M1 Configurar TC + M4 Arqueo + M7 Conciliación |
| **MOCK 16** · banners-contextuales | 7 banners pixel-perfect (Borrador wizard · Caja recaudadora · TC vence · Cobros vencidos · Pool USD bajo · Arqueo pendiente · Conversión sugerida) | `src/components/finanzas/banners/` (carpeta NUEVA) · 7 componentes · servicio `bannerVisibility.service.ts` decide cuándo mostrar |
| **MOCK 17** · estados-overview-analisis | Estados vacío/loading/error de Overview + Análisis estratégico · cierra cobertura 18/18 estados | Componentes shared estados · `EmptyState.tsx` · `LoadingSkeleton.tsx` · `ErrorState.tsx` con variantes por vista |
| **MOCK 18** · wizard-editar-cuenta ⭐ T8 | Variante edit del wizard nueva cuenta · 4 pasos pre-cargados · tipo bloqueado · moneda bloqueada si hay movs · saldo READ-ONLY · histórico cambios visible · cross-link M2/M3 archivar/eliminar · particularidades 6 tipos | `src/pages/Tesoreria/CuentaWizard/` modo edit · pre-carga datos · validaciones bloqueo · `HistorialCambiosCuenta.tsx` (NUEVO) |
| **MOCK 19** · subvistas-alternativas ⭐ T8 | Sub-tab Movimientos drawer CC completo · Sub-tab Análisis 12m con gráficos · Toggle Saldos "Por tipo" + "Por moneda" + "Por banco" pixel-perfect · Vista timeline alternativa Movimientos completa · Vista calendario · Vista grid Saldos | `CCEntidadDrawer.tsx` sub-tabs Movimientos + Análisis · `SaldosTogglesByTipoMonedaBanco.tsx` · `MovimientosTimelineView.tsx` + `MovimientosCalendarioView.tsx` + `SaldosGridView.tsx` |
| **MOCK 20** · modales-estados-avanzados ⭐ T8 | 4 modales drill (detalle cargo TC · detalle evento recaudador · drill cuotas TC · payout Stripe manual) + Estado permisos insuficientes × 6 variantes vista + Estado mantenimiento programado + Estado datos parciales + Estado sin permiso acción específica (política límite monto) | `CargoTCDetalleModal.tsx` · `EventoRecaudadorModal.tsx` · `CuotasTCDrillModal.tsx` · `PayoutStripeManualModal.tsx` · `PermissionDeniedStates.tsx` (6 variantes) · `MaintenanceMode.tsx` · `PartialDataState.tsx` · `ActionBlockedByPolicy.tsx` |

---

## 2 · Decisiones cerradas D1-D13 (vinculantes para implementación)

| # | Decisión | Aplica en código |
|---|----------|-------------------|
| D1 | Yape/Plin/SIP/Ágora/BIM = canales digitales (NO autónomos) | `CuentaWizard/Paso4MetodosCanales.tsx` ya implementado · validar |
| D2 | Stripe/PayPal/MercadoPago = wallets autónomas | `ProductoFinanciero.tipoProducto = 'wallet_digital'` |
| D3 | TC bimoneda · topeControl como alerta (NO límite) | `tarjetaCredito.types.ts` líneas 73-78 confirma |
| D4 | TC personal · modo `reembolso_titular` | `PagoEstadoCuentaTarjeta.modo` ya implementado |
| D5 | 6to tipo `caja_recaudadora` | DEUDA-MODELO-RECAUDADOR · prerequisito chk5.D-S2 |
| D6 | Pool USD = TCPA model (Tipo Cambio Promedio Ponderado) | `poolUSD.view.service.ts` ya implementado |
| D7 | Pagos masivos = Opción A monocuenta-monomoneda | `PagosMasivosWizard` enforcing en paso 1 |
| D8 | G1 Waterfall = G1.a sin impuestos | DEUDA-FISCAL-FUTURO para versión completa |
| D9 | Saldos arrancan en 0 (UAT) | Tests iniciales con cuentas en 0 |
| D10 | PagoUnificadoForm v3 = componente shared con F-Borradores | Refactor MAYOR en MOCK 14 |
| D11 | TC bimoneda usa 2 cuentas pago default separadas (USD + PEN) | `cuentaPagoDefaultUSDId` + `cuentaPagoDefaultPENId` |
| D12 | Caja Recaudadora multi-canal con balance consolidado | DEUDA-MODELO-RECAUDADOR (refinada) |
| D13 | Pool USD es vista agregada/derivada · NO entidad propia | `poolUSD.view.service.ts` ya implementado · ajustar widget |

---

## 3 · Deudas declaradas (prerequisitos chk5.D-S2 y S4)

| Deuda | Prioridad | Resolver en |
|-------|-----------|-------------|
| DEUDA-MODELO-RECAUDADOR (refinada multi-canal) | 🔴 CRÍTICA | chk5.D-S1f dedicado antes de S2 |
| DEUDA-TC-CUENTA-PAGO-DEFAULT-BIMONEDA | 🟠 ALTA | chk5.D-S1f junto con anterior |
| DEUDA-MODELO-POOL-USD-VISTA | 🟡 MEDIA | chk5.D-S2 audit + refactor PoolUSDWidget |
| DEUDA-DRAWER-TC-DEBITO | ✅ CERRADA | en MOCK 2 |
| DEUDA-FISCAL-FUTURO | 🔵 BAJA | cuando se active módulo SUNAT |
| DEUDA-LIBRERIA-GRAFICA | 🟡 MEDIA | chk5.D-S4 antes de implementar análisis |
| DEUDA-COHORT-DSO | 🔵 BAJA | requires tracking fecha-primera-venta |
| DEUDA-CALCULO-BURN-RATE | 🟡 MEDIA | definir categorías "fijas" S3 |
| DEUDA-EBITDA-DRIVERS | 🔵 BAJA | algoritmo identificación drivers |
| DEUDA-DRIVERS-CONFIG | 🟡 MEDIA | UI configurar drivers cash flow |
| DEUDA-CROSS-LINKS | ✅ CERRADA | en MOCK 5 + MOCK 14 |

---

## 4 · Checklist canon de cobertura (canon CLAUDE.md 2026-05-11)

| Categoría obligatoria | Cobertura | ✓ |
|-----------------------|-----------|---|
| **1. Página principal** (header · KPIs · filtros · listados · sidebars) | MOCK 1 + 6 + 7 + 8 + 9 | ✅ |
| **2. Vistas alternativas** (tabs · drill-downs · workspaces) | MOCK 6 (toggle vista) · MOCK 7 (timeline) · MOCK 8 (sub-tabs CC) | ✅ |
| **3. Modales internos** (Nuevo X · Editar X · Detalle X · settings · políticas) | MOCK 15 (9 modales) | ✅ |
| **4. Forms de creación/edición** (wizards · forms compactos · campos inline) | MOCK 10 (nueva cuenta) + MOCK 11 (simples) + MOCK 12 (multi-step) + MOCK 13 (PUF v3) | ✅ |
| **5. Banners contextuales** (Borrador X · alertas · prerequisitos) | MOCK 16 (7 banners) | ✅ |
| **6. Empty states · loading states · error states** | MOCK 6+7+8+9 (4 vistas) + MOCK 17 (Overview+Análisis) = 18/18 | ✅ |
| **7. Cross-module integrations** | MOCK 5 (panels) + MOCK 14 (detalle Venta/Envío/Gasto) + Vista inversa Movimiento→Doc | ✅ |
| **8. Mobile responsive** | Cada mockup incluye sección Mobile pixel-perfect | ✅ |
| **9. Canon v8.0 N1-N10** | Aplicado en TODOS los mockups | ✅ |
| **10. Canon v9.0 M1-M5** | Copy-paste literal listo para implementación | ✅ |

**Cobertura canon: 10/10 ✓ 100%**

---

## 5 · Joyas S58f integradas vs fricciones cerradas

### Joyas integradas (canon S58f rescatado en v5.1)

| Joya S58f | Integrada en |
|-----------|--------------|
| Pipeline Cash Flow visual (5 stages) | MOCK 1 Overview |
| Calendario obligaciones heatmap | MOCK 4 Análisis |
| Caja Recaudadora balance equation | MOCK 2 Drawer 1 |
| Titular Drill-Down sparklines | MOCK 2 §4 + MOCK 8 |
| PagoUnificadoForm v3 modular | MOCK 13 + MOCK 14 (3 paneles embebidos) |
| Vista Movimiento → Doc origen | MOCK 5 §6 |

### Fricciones S58f cerradas en v5.1

| Fricción detectada en audit S58f | Cerrada en |
|----------------------------------|-----------|
| Botones sin jerarquía N10 (rose/teal/emerald sin tier) | MOCK 13 + 14 + 15 + 16 (todos con N10 estricto) |
| PagoUnificadoForm sin Guardar borrador | MOCK 13 (F-Borradores integrado) |
| Anotaciones amarillas inconsistentes | MOCK 16 (7 banners con patrón canon único) |
| Modal vs Drawer indecisión | Decisión D · F6.E drawer lateral derecho (validado) |

---

## 6 · Próximos pasos · chk5.D-S2 implementación

Una vez validados los 17 mockups + AUDIT-FINAL.md por el usuario:

### chk5.D-S1f · DEDICADO modelo Caja Recaudadora (prerequisito S2)
Construir SOLO el modelo técnico antes de tocar UI:
- Agregar `caja_recaudadora` a `TipoProductoFinanciero`
- Crear `eventoServicioRecaudador.types.ts` con `canalCobro: TipoCanalRecaudacion`
- Crear `canalRecaudacion.types.ts` (enum 10 canales)
- Crear `cajaRecaudadora.service.ts` + `liquidarCajaRecaudadora.service.ts`
- Refactor `cuentaPagoDefaultId` → `cuentaPagoDefaultUSDId` + `cuentaPagoDefaultPENId` (D11)
- Tests unitarios de los services

### chk5.D-S2 · Shell + Overview + redirect /tesoreria
- Refactor `Finanzas.tsx` + nueva carpeta `Overview/`
- Implementar KpiStripFinanzas único (5 KPIs canon v8.0)
- Pipeline Cash Flow visual S58f integrado
- Sidebar persistente con 5 widgets
- Banner Caja Recaudadora pendiente
- Redirect 301 desde `/tesoreria/*` → `/finanzas/*`
- Audit y refactor de los ~50 cross-links `navigate('/tesoreria/...')` en OC/Venta/Envío/Gasto

### chk5.D-S3 · 4 vistas operativas
- FinanzasSaldos refactor + listado USD agregado Pool
- FinanzasMovimientos NUEVO con FiltrosBar canon
- FinanzasCC NUEVO con drawer 4 sub-tabs
- FinanzasCashFlow NUEVO con escenarios

### chk5.D-S4 · Wizards + cleanup + Análisis
- Refactor 8 wizards canon F-Borradores
- PagoUnificadoForm v3 refactor MAYOR (4 modos + F-Borradores)
- 3 paneles embebidos en OC/Venta/Envío/Gasto
- Implementar 10 gráficas Análisis estratégico (decidir librería)
- 9 modales secundarios + 7 banners contextuales
- Cleanup deuda técnica heredada de tesorería/finanzas legacy

---

## 7 · Estado consolidado v5.1 · sign-off canon (post-T8 corregido)

✅ **20 mockups entregados** (~740KB total HTML pixel-perfect)
✅ **Cobertura módulo Finanzas: 100% REAL auditado**
✅ **13 decisiones cerradas (D1-D13)** documentadas en SUPERSEDED-v5.md
✅ **11 deudas declaradas** con plan de resolución
✅ **Canon v8.0 (N1-N10)** aplicado consistentemente
✅ **Canon v9.0 (M1-M5)** copy-paste literal listo para implementación
✅ **F-Borradores obligatorio** en todos los wizards multi-step + PagoUnificadoForm
✅ **Cross-módulo** OC + Venta + Envío + Gasto + Vista inversa Movimiento→Doc
✅ **Wizard Editar Cuenta** con histórico cambios + bloqueos integridad
✅ **Sub-vistas alternativas** drawer CC sub-tabs + 3 toggles Saldos + timeline + calendario + grid
✅ **Modales drill** detalle cargo TC + evento recaudador + cuotas + Stripe payout
✅ **Estados avanzados** 6 permisos × vista + mantenimiento + parciales + política límite

### Cobertura final REAL por categoría (auditada post-T8)

| Categoría | Cobertura |
|---|---|
| Vistas principales (6) | 100% ✓ |
| Wizards (51 pantallas con C.2 Editar Cuenta) | 100% ✓ |
| Drawers F6.E (9) | 100% ✓ |
| Sub-vistas alternativas | 100% ✓ |
| Modales (9 secundarios + 4 detalle) | 100% ✓ |
| Banners contextuales (7) | 100% ✓ |
| PagoUnificadoForm modos (4) | 100% ✓ |
| Cross-módulo panels (4) | 100% ✓ |
| Estados básicos (18) | 100% ✓ |
| Estados avanzados (10) | 100% ✓ |

**Listo para validación holística del usuario y arranque chk5.D-S1f (modelo Recaudador)
seguido de chk5.D-S2 (implementación shell).**

---

## Anexo · Lista archivos en docs/mockups (orden lectura sugerido)

```
docs/mockups/
├── SUPERSEDED-v5.md                                     [registro decisiones + deudas]
├── AUDIT-FINAL-v5.1.md                                  [este documento · cierre]
├── finanzas-shell-overview-v5.1.html                    [MOCK 1 · shell + overview]
├── finanzas-cuentas-completo-v5.1.html                  [MOCK 2 · cuentas + 5 drawers F6.E]
├── finanzas-wizards-completos-v5.1.html                 [MOCK 3 · matriz wizards + zoom]
├── finanzas-analisis-estrategico-v5.1.html              [MOCK 4 · 10 gráficas]
├── finanzas-integraciones-crossmodulo-v5.1.html         [MOCK 5 · OC + vista inversa]
├── finanzas-vista-saldos-v5.1.html                      [MOCK 6 · Saldos completa]
├── finanzas-vista-movimientos-v5.1.html                 [MOCK 7 · Movimientos ledger]
├── finanzas-vista-cc-entidades-v5.1.html                [MOCK 8 · CC + 4 sub-tabs drawer]
├── finanzas-vista-cashflow-v5.1.html                    [MOCK 9 · Cash flow + escenarios]
├── finanzas-wizard-nueva-cuenta-v5.1.html               [MOCK 10 · 6 tipos × 4 pasos]
├── finanzas-wizards-simples-v5.1.html                   [MOCK 11 · A.1 A.2 A.4]
├── finanzas-wizards-multistep-v5.1.html                 [MOCK 12 · B.1 B.2 B.3 completos]
├── finanzas-pago-unificado-form-4modos-v5.1.html        [MOCK 13 · PUF v3 4 modos]
├── finanzas-integraciones-detalladas-v5.1.html          [MOCK 14 · Venta + Envío + Gasto]
├── finanzas-modales-secundarios-v5.1.html               [MOCK 15 · 9 modales]
├── finanzas-banners-contextuales-v5.1.html              [MOCK 16 · 7 banners]
├── finanzas-estados-overview-analisis-v5.1.html         [MOCK 17 · estados básicos]
├── finanzas-wizard-editar-cuenta-v5.1.html              [MOCK 18 · ⭐ T8 · wizard EDIT]
├── finanzas-subvistas-alternativas-v5.1.html            [MOCK 19 · ⭐ T8 · sub-tabs + toggles + alt views]
└── finanzas-modales-estados-avanzados-v5.1.html         [MOCK 20 · ⭐ T8 · 4 modales drill + estados avanzados]
```

**Total:** 20 HTML + 2 MD = 22 archivos canon v5.1 · cobertura 100% REAL auditada · listos para validación pixel-perfect del usuario.
