# AUDITORÍA 360 · Sistema Financiero — Sesión S58f

> **Propósito:** parar el ciclo de "diseñar → implementar parcial → encontrar gap → diseñar más".
> Producir una lectura honesta del estado real antes de proponer una sola línea más.
>
> **Pregunta del usuario que detonó esta auditoría:**
> *"Estamos creando tantas cosas… ¿realmente estás entendiendo Finanzas a nivel 360, viendo lo que necesitamos integrar y cómo, y que los módulos también sigan la experiencia que estructuramos en los mockups?"*
>
> **Respuesta honesta antes de la auditoría:** No. He estado reaccionando al gap inmediato sin mapear el sistema completo.

---

## 0 · Lo que NO veía hasta hoy

Sintetizo errores de mi lectura previa para que queden documentados:

1. **Confundí "refactor PF cerrado" con "sistema financiero implementado".**
   El refactor S58c-PF (ProductoFinanciero unificado) sí cerró el modelo de datos.
   Pero el plan original `arquitectura-finanzas-s58.md` tenía **14 fases** (S58 F1-F5, S58c, F-DatosBanc, S58b F1-F3, S58d F1-F4) — no he validado cuáles realmente están cerradas y cuáles quedaron a medias.

2. **Traté Tesorería como "una página suelta" cuando es un módulo operativo central.**
   Tesorería es donde el negocio toca dinero todos los días. Cualquier flujo (P2P, O2C, gastos, envíos, planilla) acaba aquí. Mientras esté huérfana en el sidebar, todo el flujo está roto.

3. **No mapeé los flujos del negocio reales que pasan por dinero.**
   Propuse "cross-link panels en OC" sin haber listado los **11 flujos** que tocan tesorería ni cuáles de ellos están integrados hoy.

4. **Propuse mockups nuevos (N1-N6) sin validar si los M1-M7 existentes están aprovechados.**
   Hay 7 mockups de tesorería de S58e. Algunos componentes existen pero el shell no los ensambla. Antes de hacer N1-N6, había que cerrar el ensamblaje de M1-M7.

---

## 1 · Inventario de mockups existentes

### 1.1 Mockups de Finanzas/Tesorería (en `docs/mockups/`)

| ID | Archivo | Sesión | Cubre |
|---|---|---|---|
| **DOC-S58** | `arquitectura-finanzas-s58.md` | S58 | Plan maestro · 14 fases · 22 decisiones |
| **MOD-S58** | `modales-finanzas-s58.html` | S58 F1-F4 | FormModal v2 + MoneyField + ToggleGroup + smart defaults |
| **PAD-S58b** | `pago-abono-distribuido-s58.html` | S58b | Wizard "1 desembolso → N deudas misma entidad" |
| **CTA-S58c** | `cuenta-bancaria-full-s58c.html` | S58c | Wizard cuenta · billeteras 2 categorías · titular extendido |
| **TC-S58d** | `tarjeta-credito-s58d.html` | S58d | TC entidad rica · saldo = deuda · banco/reembolso · bi-moneda |
| **OV-S57** | `finanzas-overview-s57.html` | S57 | Hub Finanzas (overview ejecutivo) |
| **UNI-S56** | `finanzas-unificadas-s56.html` | S56 | Vista unificada anterior (legacy) |
| **M1** | `tesoreria-productos-listado-s58e.html` | S58e | Listado por banco con cards estilo banking |
| **M2** | `tesoreria-producto-detalle-s58e.html` | S58e | Detalle producto (cuenta o tarjeta) con HeaderHero + KPIs + tabs |
| **M3** | `tesoreria-pipeline-s58e.html` | S58e | Pipeline expandido (etapas de tesorería) |
| **M4** | `tesoreria-titular-drill-down-s58e.html` | S58e | Drill-down por titular (todos sus productos) |
| **M5** | `tesoreria-pagos-masivos-s58e.html` | S58e | Wizard de pagos masivos 4 pasos |
| **M6** | `tesoreria-movimientos-s58e.html` | S58e | Libro mayor unificado con filtros canónicos |
| **M7** | `tesoreria-conversion-transferencia-s58e.html` | S58e | Wizard conversión/transferencia banking-grade |
| **M8** | `finanzas-saldos-s58e.html` | S58e | CC por entidad · vista ejecutiva |
| **M9** | `finanzas-cash-flow-s58e.html` | S58e | Cash flow ejecutivo |
| **M10** | `finanzas-listado-s58e.html` | S58e | Listado de entidades CC con detail modal |

**Total: 17 mockups de finanzas/tesorería entre 2024 y 2026-04.**

---

## 2 · Estado real del plan S58 (las 14 fases originales)

Validación contra `arquitectura-finanzas-s58.md` sección 5:

| # | Fase | Componente esperado | Estado real | Evidencia |
|---|---|---|:-:|---|
| 1 | S58 F1 | FormModal v2 shell | ✅ | `src/design-system/components/FormModalV2.tsx` |
| 2 | S58 F2 | TextField, MoneyField, DateField, Combobox, ToggleGroup | ✅ | `src/design-system/components/forms/MoneyField.tsx`, `ToggleGroup.tsx` (validado) |
| 3 | S58 F3 | Smart defaults + optimistic submit + toast undo + TC automático | ⚠️ | `useOptimisticSubmit` hook existe; integración parcial en Tesoreria.tsx |
| 4 | S58 F4 | Auto-save de borradores | ✅ | `useDraft` hook; integrado en modal Movimiento |
| 5 | S58c | Wizard cuenta + billeteras 2 categorías + titular extendido | ✅ | `CuentaWizard/` carpeta; refactor ProductoFinanciero cerró esto |
| 6 | F-DatosBanc | `datosBancarios[]` en fichas + UI promoción | ⚠️ | Tipos definidos en `colaborador.types.ts`, `entidadesMaestras.types.ts`, `ordenCompra.types.ts`, `planilla.types.ts`. **NO hay UI de promoción a CuentaCaja**. |
| 7 | S58b F1 | Service `pagoAbonoDistribuido.ejecutar()` | ✅ | `src/services/pagoAbonoDistribuido.service.ts` |
| 8 | S58b F2 | Wizard "abono distribuido" 4 pasos | ✅ | `src/pages/Finanzas/components/PagoAbonoWizard/` (Paso1Entidad, Paso2Abono, Paso3Distribucion, Paso4Confirmar) |
| 9 | S58b F3 | Entry points | ⚠️ | Wizard se llama desde `/finanzas` y `/finanzas/saldos`. **No verifiqué si hay entry points en /compras, /ventas, /gastos** |
| 10 | S58d F1 | Service `cargoTarjeta.ejecutar()` (TX-1) | ✅ | `src/services/cargoTarjeta.service.ts` |
| 11 | S58d F2 | Service `pagoEstadoCuentaTarjeta.ejecutar()` (TX-2) con 2 modos | ✅ | `src/services/pagoEstadoCuentaTarjeta.service.ts` |
| 12 | S58d F3 | UI: lista TC + detalle + cargar OC + pagar | ✅ | `TarjetasCreditoV2/` con TarjetaCard, TarjetaDetailModal, CargarTarjetaWizard, PagarEstadoCuentaWizard |
| 13 | S58d F4 | Vista CC de tarjeta + integración con Saldos | ✅ | TipoEntidadCC='tarjeta_credito' en saldos; CC espejo de cada tarjeta |
| 14 | S58 F5 | Migrar Conversión y Transferencia a FormModal v2 | ✅ | `ConversionTransferenciaWizard/` cerrado en Imp-L11 |

**Conclusión:** del plan original 14 fases, **11 están cerradas (✅), 3 están parciales (⚠️)**.

Las 3 parciales son:
- **F3 TC automático** — `useTipoCambio` existe pero no validé que TODOS los modales lo usen como D-S58-16 exigía.
- **F-DatosBanc UI promoción** — tipos sí, UI no. Mockup `cuenta-bancaria-full-s58c.html` describe el banner "Promover a CuentaCaja" — **falta implementarlo**.
- **S58b F3 entry points** — wizard existe, pero no validé si está accesible desde el flujo natural (detalle de OC, detalle de venta, detalle de gasto).

---

## 3 · Estado real de mockups S58e M1-M10

| # | Mockup | Componente(s) | Shell que los usa | Estado |
|---|---|---|---|---|
| M1 | Productos listado | `ProductCard`, `BankSubheader`, `BankLogo` | `Tesoreria.tsx`/`TabCuentas` legacy | ❌ Componentes existen pero shell sigue siendo tabs viejas |
| M2 | Producto detalle | `ProductoDetalleModal/` | Llamado desde varios lados | ⚠️ Modal existe, no validé si el shell lo invoca correctamente |
| M3 | Pipeline expandido | `PipelineTesoreria`, `TabPipeline` | `Tesoreria.tsx` tab "pipeline" | ⚠️ Está como una tab pero no como vista principal |
| M4 | Titular drill-down | `TitularDrilldownView` | Sin entry point claro | ❌ Componente existe huérfano |
| M5 | Pagos masivos | `PagosMasivosWizard/` | `TabPagosMasivos` | ⚠️ Existe pero accesible solo vía tab vieja |
| M6 | Movimientos libro mayor | `MovimientosKpiRow`, `MovimientosBreakdown`, `TabMovimientos` | `TabMovimientos` legacy | ⚠️ Componentes nuevos pero embebidos en tab vieja |
| M7 | Conversión/Transferencia | `ConversionTransferenciaWizard/` | `Tesoreria.tsx` tabs Conv/Trans | ✅ Bien integrado en Imp-L11 |
| M8 | Saldos ejecutivos | `FinanzasSaldos.tsx` | `/finanzas/saldos` | ✅ Cerrado en Imp-L11.b/c/d/e |
| M9 | Cash flow ejecutivo | `FinanzasCashFlow.tsx`, `CashFlowExecutivePanel` | `/finanzas/cash-flow` | ✅ Cerrado |
| M10 | Listado CC | `FinanzasSaldos.tsx` (mismo componente que M8) | `/finanzas/saldos` | ✅ Fusionado con M8 |

**Conclusión:**
- M7, M8, M9, M10 están **cerrados** (4/10).
- M2, M3, M5, M6 están **a medias** (componentes existen pero el shell no los expone bien).
- M1, M4 están **huérfanos** (componentes sin shell que los presente).

---

## 4 · Mapa de flujos del negocio que tocan dinero

Inventario de flujos. Para cada uno: ¿cómo se conecta con tesorería hoy? ¿está roto?

### 4.1 Procure-to-Pay (P2P) · Compras → Pago a proveedor

```
1. Crear OC          → CC proveedor: −monto (deuda)
2. Confirmar OC      → estadoPago: 'pendiente'
3. Recibir productos → inventario, costos landed
4. Pagar OC          → CC proveedor: +monto · MovimientoTesoreria
   ├─ Pago directo (OC.pagos service)
   ├─ Pago con TC (cargoTarjeta service · TX-1)
   ├─ Pago abono distribuido (1 desembolso → N OCs · pagoAbonoDistribuido)
   └─ Pago masivo (N pagos → varios proveedores · pagoMasivo)
```

| Componente | Estado |
|---|:-:|
| Crear OC con proveedor | ✅ existe |
| CC proveedor automática | ✅ existe |
| Pago directo desde detalle OC | ✅ existe |
| Pago con TC desde detalle OC | ⚠️ existe en `TarjetasCreditoV2`; **no validé entry point desde /compras** |
| Pago abono distribuido | ⚠️ wizard existe, accesible desde /finanzas; **no validé entry point desde /compras** |
| Pago masivo | ⚠️ existe en TabPagosMasivos pero accesible solo desde tab |
| Visualización movimientos en detalle OC | ❓ no verificado |

### 4.2 Order-to-Cash (O2C) · Ventas → Cobro de cliente

```
1. Crear cotización → ?
2. Confirmar venta  → CC cliente: −monto (deuda)
3. Despachar        → Envío T-F
4. Cobrar venta     → CC cliente: +monto · MovimientoTesoreria
   └─ Cobro distribuido (1 cobro → N ventas · ¿existe?)
```

| Componente | Estado |
|---|:-:|
| Crear venta con cliente | ✅ existe |
| CC cliente automática | ✅ existe |
| Cobro directo desde detalle venta | ✅ probable (servicio `venta.pagos.service.ts`) |
| Cobro abono distribuido | ⚠️ wizard `PagoAbonoWizard` es genérico (sirve para cobros y pagos); entry point desde /ventas ❓ |
| Visualización movimientos en detalle venta | ❓ no verificado |

### 4.3 Gastos operativos

```
1. Crear gasto      → CC proveedor (si tiene): −monto
2. Pagar gasto      → CC proveedor: +monto · MovimientoTesoreria
   └─ Cargar a TC (CargoTarjeta · TX-1)
```

| Componente | Estado |
|---|:-:|
| Crear gasto | ✅ existe (`gasto.service.ts`) |
| Pago directo gasto | ✅ probable |
| Cargar gasto a TC | ⚠️ servicio existe, entry point desde /gastos ❓ |
| Gasto sin proveedor formal (S58f stand-by) | ❌ no implementado |

### 4.4 Logística · Envíos → Pago de flete

```
1. Crear envío         → CC colaborador: −fleteCalculado
2. Pagar flete envío   → CC colaborador: +monto
3. Reembolsos viajeros → MovimientoTesoreria + CC colaborador
```

| Componente | Estado |
|---|:-:|
| `envio.pagos.service.ts` | ✅ existe |
| Pago desde detalle envío | ❓ no verificado |
| Movimientos del envío visibles en detalle | ❓ no verificado |

### 4.5 Conversiones FX · PEN ↔ USD

```
Conversión interna entre 2 cuentas propias del negocio.
Genera RegistroTCTransaccion para Pool USD TCPA.
```

| Componente | Estado |
|---|:-:|
| Servicio `tesoreria.conversiones.service.ts` | ✅ existe |
| Wizard banking-grade | ✅ `ConversionTransferenciaWizard` |
| Pool USD TCPA | ✅ `PoolUSDWidget` |
| Diferencial cambiario en P&L | ⚠️ S58e (trazabilidad TC end-to-end) marcado stand-by |

### 4.6 Transferencias internas

```
Entre 2 cuentas propias (mismo negocio, misma moneda o conversión).
```

| Componente | Estado |
|---|:-:|
| Servicio | ✅ |
| Wizard | ✅ (mismo `ConversionTransferenciaWizard`) |

### 4.7 Capital · Aportes y retiros de socios

```
Socio aporta dinero → ingreso al negocio + CC socio
Socio retira       → egreso + CC socio
```

| Componente | Estado |
|---|:-:|
| `tesoreria.capital.service.ts` | ✅ existe |
| Tipos `aporte_capital`, `retiro_socio` | ✅ existen en `MovimientoTesoreria` |
| UI dedicada | ❌ no validé si hay vista propia |

### 4.8 Anticipos a colaboradores y empleados

```
Adelanto de viajero (logística): efectivo USD/PEN al colaborador
Adelanto de empleado (planilla): a cuenta de sueldo del mes
```

| Componente | Estado |
|---|:-:|
| Tipos `pago_viajero`, `adelanto_empleado` | ✅ existen |
| `MovimientoTesoreria` con estos tipos | ✅ |
| UI dedicada en /tesoreria o módulos | ❌ no validé |

### 4.9 Tarjeta de crédito · Cargar y pagar estado de cuenta

```
TX-1: Cargar OC/gasto/envío a TC → CC entidad: +monto · CC tarjeta: −monto
TX-2: Pagar estado de cuenta:
   modo banco_emisor    → cuenta empresa paga al banco emisor
   modo reembolso_titular → cuenta empresa paga al dueño que prestó la TC personal
```

| Componente | Estado |
|---|:-:|
| Servicios TX-1, TX-2 | ✅ |
| `TarjetasCreditoV2/` con UI completa | ✅ |
| Vista CC tarjeta integrada con Saldos | ✅ |
| Acceso desde /finanzas/saldos al detalle TC | ✅ |
| Soporte bi-moneda (D-S58-23) | ❓ no verificado |

### 4.10 Pagos masivos · Lote N a N

```
Subir archivo CSV con N filas → procesar como N MovimientosTesoreria
```

| Componente | Estado |
|---|:-:|
| `pagoMasivo.service.ts` | ✅ |
| `PagosMasivosWizard/` | ✅ |
| Acceso desde sidebar/menú principal | ❌ Solo desde tab vieja |

### 4.11 Cobranza directa · Yape/Plin a cuenta empresa

```
Cliente paga al Yape de cuenta BCP empresa → ingreso directo a BCP
(canal Yape resuelve a cuenta destino)
```

| Componente | Estado |
|---|:-:|
| `canalesDigitales[]` en `CuentaCaja` banco | ✅ tipos definidos |
| UI selector "método: Yape" → resolución automática | ❓ no verificado |

---

## 5 · Gaps reales identificados

### 5.1 Gaps estructurales (alto impacto)

| Gap | Síntoma | Impacto |
|-----|---------|---------|
| **/tesoreria huérfana del sidebar** | Captura del usuario muestra tesorería accesible solo por buttons en /finanzas | El operador no encuentra su herramienta diaria |
| **Shell de Tesoreria.tsx no se rediseñó** | 1108 líneas con tabs viejas + componentes nuevos sueltos por dentro | Visualmente "mezclado", no se parece a M1-M7 |
| **M1 (Productos por banco) no es la vista principal de /tesoreria** | El componente `ProductCard` existe pero no se muestra como entrada del módulo | El mockup más importante quedó sin shell |
| **M4 (Drill-down titular) huérfano** | `TitularDrilldownView` existe sin entry point | Funcionalidad invisible para el usuario |
| **Entry points de wizards desde detalle de documentos** | Pagos abono distribuido, cargar TC, pago masivo: existen como wizards aislados | El usuario tiene que ir a /tesoreria a invocar acciones que deberían estar en el contexto del documento |

### 5.2 Gaps de visibilidad (medio impacto)

| Gap | Síntoma |
|-----|---------|
| **No hay panel "Pagos y Tesorería" en detalle de OC** | Al abrir una OC, no se ven los movimientos de tesorería vinculados |
| **No hay panel similar en detalle de venta** | Mismo problema |
| **No hay panel similar en detalle de gasto** | Mismo problema |
| **No hay panel similar en detalle de envío** | Mismo problema |
| **Movimientos de tesorería no muestran sus documentos vinculados** | Al ver un movimiento, no se navega de vuelta a la OC/venta/gasto que lo originó |

### 5.3 Gaps de promoción y datos pasivos

| Gap | Síntoma |
|-----|---------|
| **`datosBancarios[]` sin UI de promoción** | Los tipos están definidos pero el banner "Promover a CuentaCaja" del mockup S58c no existe |
| **Caso GK Xpress (agente recaudador) sin entry point obvio** | El flujo está documentado en arquitectura-finanzas-s58.md Caso B pero la UI no guía al usuario por él |

### 5.4 Gaps cosméticos vs funcionales

| Gap | Tipo |
|-----|------|
| Sidebar sin badges de actividad | Cosmético / mejora |
| Sin command palette Cmd+K | Mejora |
| Sin top action bar persistente | Mejora |
| Sin activity stream | Mejora |
| Sin smart deep-links | Mejora |

**Importante:** los 5.4 son **mejoras**, NO son gaps que rompen el sistema. Si proponemos solo eso, no resolvemos el problema central que es **5.1 + 5.2**.

---

## 6 · Mi comprensión 360° (validar contigo)

### Lo que entiendo del negocio

**Vita Skin Peru SAC** es una empresa que importa y vende productos de skincare/suplementos. Los flujos de dinero que veo:

- **Entradas:** ventas a clientes (PEN local, ocasional USD), aportes de socios.
- **Salidas:** compras a proveedores extranjeros (USD), pagos de envíos/colaboradores, gastos operativos, planilla, salidas de socios.
- **Activos financieros:** cuentas bancarias PEN/USD, billeteras digitales (Yape/Plin/MercadoPago/PayPal), tarjetas de crédito (algunas personales del dueño usadas para la empresa), caja efectivo.
- **Multi-moneda:** PEN funcional, USD para compras internacionales. TC importante todos los días.
- **Patrón especial:** "agentes recaudadores" (proveedores que reciben cobros y descuentan sus servicios — caso GK Xpress).

### Lo que entiendo del sistema

- **Tesorería** = donde el negocio toca dinero (operación diaria).
- **Finanzas** = visión ejecutiva (reportes, saldos por contraparte, cash flow).
- **Cuentas Corrientes (CC)** = libro mayor por contraparte (qué te debe X cliente, qué le debes a Y proveedor).
- **MovimientosFinancieros** (post-refactor PF) = libro mayor unificado de tesorería.
- **TX-1, TX-2** = transacciones atómicas que mueven varios registros consistentes.

### Lo que NO sé hasta que lo valides conmigo

1. ¿Las CC de socios (aportes/retiros) ya tienen UI dedicada o están solo en `MovimientoTesoreria`?
2. ¿La planilla mensual (sueldos a empleados) pasa por tesorería operativa o tiene módulo propio?
3. ¿Hay flujos de "préstamo a tercero" o "recibimos préstamo bancario"?
4. ¿La trazabilidad TC end-to-end (S58e stand-by) es necesaria YA o sigue stand-by?
5. ¿El caso GK Xpress (agente recaudador) ocurre con frecuencia o es excepcional?
6. ¿Hay reportes contables que se generen desde el sistema (NIIF/NIF para Perú) o eso lo hace el contador externo?

---

## 7 · Plan honesto que propongo

### Fase A · Cerrar lo que está a medias (PRIORIDAD)

**Antes de agregar UNA cosa nueva, terminar:**

1. **Sidebar accesible** — agregar `/tesoreria` al sidebar como ítem propio (1h).
2. **TesoreriaLayout** — crear shell con sub-tabs estilo `FinanzasLayout`, vista principal = M1 (Productos por banco) (1 sesión).
3. **Migrar M2, M3, M4, M5, M6** dentro del nuevo shell — los componentes ya existen, solo hay que ensamblarlos bien (3-4 sesiones).
4. **Banner promoción `datosBancarios` → CuentaCaja** del mockup S58c (0.5 sesión).
5. **Validar D-S58-16 (TC automático en TODOS los modales)** — auditar y completar lo que falte (0.5 sesión).
6. **Entry points de wizards** desde detalle OC, venta, gasto, envío (1 sesión por entidad = 3-4 sesiones).

**Total Fase A: ~9 sesiones para tener Tesorería COMPLETA según el plan original.**

### Fase B · Decidir sobre entrelazado (DESPUÉS de Fase A)

Una vez Tesorería está visualmente completa y accesible, recién decidir si:
- **B1.** Cross-link panels en detalles de documentos (5.2 gaps).
- **B2.** Command Palette Cmd+K.
- **B3.** Top action bar.
- **B4.** Sidebar badges.
- **B5.** Activity stream.

**Pero primero medir si el usuario realmente necesita estas mejoras o si la Fase A ya resuelve el problema.**

### Fase C · Stand-by S58e/S58f (FUTURO)

- S58e — Trazabilidad TC end-to-end (P&L cambiario detallado).
- S58f — Gastos con proveedores formales.

---

## 8 · Pregunta concreta para ti

Antes de avanzar, valida estos 4 puntos:

### V-1 · ¿Mi comprensión 360 está completa?

Las preguntas de la sección 6 ("Lo que NO sé hasta que lo valides"):
- CC socios, planilla, préstamos, S58e, GK Xpress frecuencia, reportes contables.

¿Hay flujos de dinero que NO mencioné y que son críticos?

### V-2 · ¿La auditoría de mockups M1-M10 es correcta?

¿Algún componente que marqué como "huérfano" en realidad sí tiene entry point?
¿Algún componente que marqué como "cerrado" en realidad no se está usando?

### V-3 · ¿La Fase A (cerrar lo pendiente) es la prioridad correcta?

¿O hay algún flujo del negocio que está roto HOY y que no aparece en mi mapa?

### V-4 · ¿Hay alguna decisión D-S58-1 a D-S58-23 que ya NO sea válida?

El plan se hizo en S58 hace ~3 semanas. Algunas decisiones pueden haberse modificado en sesiones intermedias y yo no las refleje aquí.

---

## 9 · Lo que NO voy a hacer hasta que valides

1. ❌ **No voy a crear los mockups N1-N6** que propuse antes.
2. ❌ **No voy a tocar código** ni de Tesorería ni de Finanzas.
3. ❌ **No voy a proponer "más entrelazado"** hasta que cierres Fase A.

## 10 · Lo que SÍ voy a hacer cuando valides

1. ✅ Registrar esta auditoría como decisión arquitectónica oficial en `REGISTRO_IMPLEMENTACION.md`.
2. ✅ Dejar este documento como **fuente de verdad** del estado real para que cualquier sesión futura lo consulte primero.
3. ✅ Arrancar Fase A en el orden que confirmes.

---

> **Última actualización:** 2026-04-29 — sesión S58f apertura
> **Autor honesto:** Claude (auditoría tras pregunta legítima del usuario)
> **Estado:** esperando validación de las 4 preguntas V-1 a V-4

---

## ACTUALIZACIÓN POST-VALIDACIÓN (sección 11)

> Tras la respuesta del usuario y verificación adicional del código,
> la auditoría se corrige y el plan se refina.

### 11.1 · Correcciones a la sección 3 (mockups M1-M10)

**Mi auditoría inicial estaba parcialmente equivocada.** Verificación en código:

| # | Mockup | Estado anterior | Estado real verificado |
|---|---|---|---|
| M1 | Productos listado | ❌ huérfano | ⚠️ **NO huérfano** — `ProductCard` se usa en TabCuentas, TabPipeline y TitularDrilldownView. `BankSubheader` se usa en TitularDrilldownView. Existe `VistaPorTitular` que ensambla M1 elements y se invoca desde `TabCuentas:527`. |
| M4 | Drill-down titular | ❌ huérfano | ⚠️ **NO huérfano** — `TitularDrilldownView` se invoca desde `TabCuentas:345` |

**Implicación:** los componentes existen y están conectados. El problema **no** es que estén huérfanos. El problema es que **están atrapados dentro del shell viejo de Tesoreria.tsx** (con tabs Movimientos/Conversiones/Transferencias/Cuentas/Tarjetas/Pagos masivos/Pipeline) en lugar de ser la **vista principal**.

### 11.2 · Hallazgo nuevo · CC de socios

- Tipos `aporte_capital` y `retiro_socio` **sí existen** en `MovimientoTesoreria`.
- Aparecen en `CashFlowExecutivePanel` (líneas 56, 65, 304, 310, 331, 340) y `MovimientoTesoreriaDrawer`.
- **NO tienen UI dedicada de "Socios"** — viven como tipo de movimiento genérico.
- **Decisión:** mantener así. Si surge la necesidad de panel de socios, se hace después. Para 1-3 socios no se justifica módulo aparte.

### 11.3 · Hallazgo nuevo · Capacidad para agentes recaudadores (90% del flujo)

**Este es el cambio más importante de la auditoría.**

Tu confirmación de que **GK Xpress gestiona el 90% de los envíos** convierte el "caso B agente recaudador" en flujo operativo central, no excepcional.

**Estado real verificado:**

✅ **Lo que existe a nivel de modelo:**
- `titularEntidadTipo: 'proveedor'` permite cajas con titular proveedor
- `datosBancarios[]` definidos en `proveedor.types`, `cliente.types`, `colaborador.types`, `empleado.types`
- `cuentaCajaAsociadaId` en `DatoBancarioPasivo` para vínculo

❌ **Lo que NO existe (gap crítico):**
- **UI de promoción** `datosBancarios → CuentaCaja` (banner del mockup S58c)
- **Vista de "agente recaudador"** que muestre: cobros recibidos / pagos descontados / saldo pendiente con el agente
- **Workflow guiado** para el caso GK Xpress (los 5 eventos del Caso B en `arquitectura-finanzas-s58.md`)

**Implicación:** si el 90% de tus envíos pasa por GK Xpress, **el banner de promoción + la vista de agente recaudador deben ser PRIORIDAD MÁS ALTA que cualquier otro entry point.**

### 11.4 · Hallazgo · Planilla y reportes contables

- **Planilla:** confirmaste que tiene su propio refactor pendiente. **La saco completamente del scope de Fase A.** No tocar planilla en esta línea de trabajo.
- **Reportes NIIF/NIF:** confirmaste que no es prioridad operativa. **Deprioriza S58e (trazabilidad TC end-to-end exhaustiva)** definitivamente. Lo que ya hay en `RegistroTCTransaccion` es suficiente para la auditoría eventual que mencionaste.
- **Préstamos:** confirmaste que solo existe "adelanto a proveedor" — ya cubierto por flujo P2P normal. No hay flujo nuevo a diseñar.

### 11.5 · Cruce de decisiones D-S58-1 a D-S58-23 con realidad

Las 23 decisiones del plan original **fueron parcialmente subsumidas** por el refactor S58c-PF (Producto Financiero unificado, 14 commits).

**Vigentes y respetadas:**
- D-S58-16 (TC automático en todos los modales) — falta auditar 100%
- D-S58-17 (billeteras 2 categorías) — implementada en wizard
- D-S58-18 (saldo "del negocio") — implementada
- D-S58-19 (TC sin tope, saldo = deuda) — implementada en TarjetasCreditoV2
- D-S58-20 (titularidad 4 tipos) — implementada
- D-S58-21 (`datosBancarios[]` en fichas) — tipos sí, **UI promoción NO**
- D-S58-22 (TX-3 eliminada, agente recaudador con módulos existentes) — vigente
- D-S58-23 (TC bi-moneda) — implementada

**Subsumidas por refactor PF (cambian forma pero no fondo):**
- `CuentaCaja` → `ProductoFinanciero` con discriminator
- `TarjetaCredito` → `ProductoFinanciero` con `tipoProducto: 'tarjeta_credito'`
- `MovimientoTesoreria` → `MovimientoFinanciero` (libro mayor único)

**Stand-by confirmado:**
- S58e (trazabilidad TC end-to-end) — **definitivamente stand-by** dado V-1.5 (no NIIF/NIF prioridad)
- S58f (gastos con proveedores formales) — pendiente, sin urgencia

---

## 12 · Plan refinado · Fase A (revisado tras hallazgos)

**Cambios respecto a la propuesta original:**

| Antes | Después | Razón |
|---|---|---|
| 9 sesiones | **6-7 sesiones** | Componentes M1/M4 no estaban huérfanos, solo necesitan reorganización |
| Banner promoción `datosBancarios` puesto al medio | **Banner promoción ALTA prioridad (paso 3)** | GK Xpress 90% lo justifica |
| Entry points de wizards igual peso | **Priorizar entry point en /envios** primero | Por GK Xpress |
| Sin "vista de agente recaudador" | **Agregar vista dedicada de caja recaudadora** | Operación central, no excepcional |

### Fase A refinada (orden propuesto)

**Paso 1 — Sidebar accesible** (1h, riesgo nulo)
- Agregar entrada `/tesoreria` al sidebar bajo "Finanzas y Contabilidad"
- No requiere mockup, es trivial

**Paso 2 — `TesoreriaLayout` shell con `VistaPorTitular` como home** (1 sesión)
- Crear `TesoreriaLayout` paralelo a `FinanzasLayout`
- Mover `VistaPorTitular` (que ya ensambla M1+M4) a vista principal `/tesoreria`
- Sub-rutas: `/tesoreria/movimientos`, `/tesoreria/conversiones`, `/tesoreria/pagos-masivos`, `/tesoreria/pipeline`
- Las 7 tabs viejas se reemplazan por sub-rutas con sus componentes ya existentes
- **No se reescribe nada nuevo** — es ensamblaje correcto de lo que existe

**Paso 3 — Banner promoción `datosBancarios → CuentaCaja`** (CRÍTICO · 1 sesión)
- Implementar el banner del mockup S58c
- Cuando se detecte primer movimiento a un `DatoBancarioPasivo` no promovido, ofrecer "Promover a CuentaCaja recaudadora"
- Crítico para que GK Xpress y similares se registren con 1 click

**Paso 4 — Vista dedicada de "Caja recaudadora"** (1 sesión)
- Cuando se abre detalle de una `ProductoFinanciero` con `titularEntidadTipo: 'proveedor'`, mostrar vista enriquecida:
  - Cobros recibidos (entradas)
  - Servicios descontados (CC del agente como contraparte)
  - Saldo pendiente con el agente
- Link directo a CC del agente desde la caja

**Paso 5 — Entry point pago abono distribuido en /envios** (1 sesión)
- Botón "Pagar a colaborador" en detalle de envío que abra `PagoAbonoWizard` precargado con CC del colaborador
- Por GK Xpress 90%, esto cierra el flujo del agente recaudador

**Paso 6 — Entry points pago abono distribuido en /compras y /ventas** (2 sesiones · 1 cada uno)
- "Pagar OC" en detalle de compra
- "Cobrar venta" en detalle de venta

**Paso 7 — Validar TC automático en todos los modales** (0.5 sesión)
- Auditar D-S58-16
- Migrar lo que falte

**Total Fase A refinada: 6.5 sesiones**

### Fuera de Fase A (futuro)

- **Fase B (entrelazado):** Cross-link panels, Command Palette, badges, top action bar — solo si después de Fase A todavía se sienten necesarios
- **Fase C (stand-by):** S58e trazabilidad TC, S58f gastos formales
- **Refactor planilla:** scope propio, no se mezcla con Tesorería

---

## 13 · Mi recomendación concreta

Dado que dijiste *"sigamos tus prioridades, yo te sigo a ti"*:

**Recomiendo arrancar AHORA con Paso 1 + Paso 2** en una sola sesión corta (1.5h):

1. **Agregar `/tesoreria` al sidebar** (15 min)
2. **Crear `TesoreriaLayout`** con `VistaPorTitular` como vista principal y sub-rutas para las otras tabs (1h)

**Por qué arrancar con esto:**
- Cero riesgo (solo reorganización de componentes que ya existen)
- Cero código nuevo (solo routing + layout shell)
- Resuelve el dolor visible inmediato ("no está accesible", "se ve mezclado")
- Te permite validar la dirección antes de comprometernos con Pasos 3-7
- Si después de verlo decimos "no, hay que rediseñar más", lo hacemos antes de meter más profundidad

**Después de Paso 1+2 deployed**, te muestro el resultado, validas, y decidimos si seguir con Paso 3 (banner GK Xpress) que ya sí toca código nuevo.

---

> **Última actualización (post-validación):** 2026-04-29
> **Estado:** plan refinado, esperando go/no-go para arrancar Paso 1+2
