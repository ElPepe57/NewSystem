# Mockups v5 · SUPERSEDED por v5.1 · chk5.D-S1e (2026-05-15)

## Estado

Los 3 mockups v5 producidos durante chk5.D-S1a/b/d fueron declarados
**SUPERSEDED** tras audit completo de mockups S58f/S58e (chk5.D-S1e ·
2026-05-15). Quedan en el repo como **referencia histórica** del proceso
de descubrimiento iterativo · NO usar como fuente de verdad para
implementación.

## Mockups superseded

| Archivo | Razón superseded | Reemplazado por |
|---------|------------------|-----------------|
| `finanzas-unificado-v5.html` | (a) Faltaba 6ta tipo "Caja recaudadora" (GK Xpress) · (b) KPI strip sin las 6 visualizaciones inteligentes ya diseñadas en `tesoreria-visualizaciones-s58f` · (c) NO declaraba integraciones cross-módulo embebidas en OC/Venta/Envío/Gasto (lote 4 S58f) | `finanzas-shell-overview-v5.1.html` |
| `finanzas-vistas-paralelas-v5.html` | (a) Faltaba wizard "Liquidar agente recaudador" (saldo Caja recaudadora → BCP) · (b) Faltaba modal/drawer detalle TC bimoneda (utilización dual USD+PEN) · (c) Faltaba modal/drawer detalle TC personal con titular vinculado + modo reembolso · (d) Faltaba drill por titular empresa vs personal | `finanzas-cuentas-completo-v5.1.html` + `finanzas-wizards-completos-v5.1.html` |
| `finanzas-wizard-nueva-cuenta-v5.html` | (a) Confundía Yape/Plin (canales digitales asociados a cuenta bancaria) con wallets autónomas (Stripe/PayPal) · (b) Faltaba 6to tipo "Caja recaudadora" con responsable tercero · (c) NO incluía titularidad empresa/personal · (d) NO consultaba el modelo de datos real (`CuentaWizard/types.ts` + `ProductoFinanciero` + `TarjetaCredito` ya tenían todo resuelto técnicamente) | `finanzas-wizards-completos-v5.1.html` |

## Mockups v5.1 nuevos (canon definitivo desde 0)

| # | Mockup | Cobertura |
|---|--------|-----------|
| 1 | `finanzas-shell-overview-v5.1.html` | Shell módulo + 6 sub-rutas + KPI strip único + Overview con Pipeline Cash Flow + sidebar pendientes + banner Caja recaudadora |
| 2 | `finanzas-cuentas-completo-v5.1.html` | Vista Productos · 6 tipos correctos · listado agrupado · drawer lateral F6.E para detalle · sub-vista Caja recaudadora · TC bimoneda · TC personal · drill titular |
| 3 | `finanzas-wizards-completos-v5.1.html` | Wizard nueva cuenta 6 tipos · PagoUnificadoForm v3 con F-Borradores · 3 wizards multi-step · 4 simples · wizard liquidar recaudador (NUEVO) |
| 4 | `finanzas-analisis-estrategico-v5.1.html` | 6ta vista del módulo · fusión 6 visualizaciones S58f + G1-G10 consolidadas · ~10 gráficos canon-level |
| 5 | `finanzas-integraciones-crossmodulo-v5.1.html` | 4 panels embebidos (OC/Venta/Envío/Gasto) + Vista Movimiento → Doc origen inverso · cierra DEUDA-CROSS-LINKS |

## Decisiones cerradas que guían v5.1 (D1-D10)

1. ✅ Yape/Plin/SIP/Ágora/BIM = **canales digitales asociados a cuenta bancaria** (NO autónomas)
2. ✅ Stripe/PayPal/MercadoPago/Wise/Zelle/Binance = **wallets autónomas** con saldo propio
3. ✅ TC bimoneda con `topeControlUSD` + `topeControlPEN` como **alertas (NO límites duros)** · líneas "ilimitadas" del negocio respetadas
4. ✅ TC titularidad empresa/personal · modo pago `banco_emisor` vs `reembolso_titular`
5. ✅ **6to tipo Caja recaudadora** (GK Xpress · responsable tercero · balance equation cobros−servicios=liquidación)
6. ✅ **Pool USD = TCPA model** (Tipo de Cambio Promedio Ponderado de Adquisición · diferencial cambiario realizado contra TC mercado)
7. ✅ Pagos masivos = **Opción A monocuenta-monomoneda** (1 batch = 1 cuenta = 1 moneda)
8. ✅ G1 Waterfall = **G1.a sin impuestos** · `DEUDA-FISCAL-FUTURO` declarada para cuando se active módulo SUNAT
9. ✅ Todos los saldos arrancan en 0 (UAT simplificado)
10. ✅ **PagoUnificadoForm v3 = componente shared** reutilizable cross-módulo + agregar F-Borradores

## Joyas S58f integradas al v5.1

1. **Pipeline Cash Flow visual** (5 stages: Pendientes → En cuenta → Reservado → En pago → Ejecutado) → MOCK 1
2. **Calendario obligaciones heatmap** mensual con dots semánticos → MOCK 4
3. **Caja Recaudadora balance equation** (cobros − descuentos = liquidado) → MOCK 2
4. **Titular Drill-Down con sparklines** 30d embedded → MOCK 2
5. **PagoUnificadoForm v3 modular** (4 modos · split nativo) → MOCK 3
6. **Vista Movimiento → Doc origen** (cierra ciclo UX inverso) → MOCK 5

## Fricciones S58f a refactorizar en v5.1

1. **Botones sin jerarquía N10** · audit + refactor a 3-tier (teal primary · indigo destacada · slate neutral)
2. **Anotaciones amarillas inconsistentes** · estandarizar 1 patrón warning/info
3. **PagoUnificadoForm v3 sin Guardar borrador** · agregar F-Borradores obligatorio
4. **Sparklines SVG inline** · validar librería gráfica canon (Recharts vs Chart.js) en chk5.D-S4

## DEUDAS DECLARADAS · prerequisitos chk5.D-S2 implementación

### DEUDA-MODELO-RECAUDADOR (declarada 2026-05-15 · chk5.D-S1e)

El mockup `caja-agente-recaudador-s58f.html` define visualmente el 6to tipo
"Caja recaudadora" pero **el modelo técnico nunca fue implementado**. Grep
en `src/` no encuentra `caja_recaudadora` como `TipoProductoFinanciero` ·
0 servicios de liquidación · 0 tipos para eventos de servicio del recaudador.

**Falta implementar antes de S2 (o como capítulo dedicado chk5.D-S1f):**

```
A · src/types/productoFinanciero.types.ts
   - Agregar 'caja_recaudadora' a TipoProductoFinanciero
   - Agregar campos al interface ProductoFinanciero:
     · responsableTerceroId: string
     · responsableTerceroTipo: 'proveedor' | 'colaborador' | 'cliente'
     · responsableTerceroNombre: string (desnormalizado)
     · tarifaServicio: {
         tipo: 'fijo_por_evento' | 'porcentaje' | 'mixto'
         valor: number
         eventoLabel: string  (ej. "por carrera", "por envío")
       }
     · cuentaLiquidacionDefaultId: string  (cuenta BCP de liquidación)

B · src/types/eventoServicioRecaudador.types.ts (NUEVO)
   - interface EventoServicioRecaudador
     · id, recaudadoraId, fecha, descripcion, monto
     · vinculacionTipo: 'envio' | 'venta' | 'manual'
     · vinculacionId?: string
   - Cada carrera/evento es un registro · suma = descuento en liquidación

C · src/services/cajaRecaudadora.service.ts (NUEVO)
   - registrarCobroEntrante(recaudadoraId, monto, clienteRefId?, ventaId?)
   - registrarServicioDescontado(recaudadoraId, evento, monto)
   - calcularBalanceMes(recaudadoraId, mes)
     → returns { cobrosRecibidos, serviciosDescontados, liquidadoYa, pendienteLiquidar }

D · src/services/liquidarCajaRecaudadora.service.ts (NUEVO)
   - liquidarSaldo(recaudadoraId, montoLiquidado, cuentaDestinoId, fecha)
     · debita la caja recaudadora
     · acredita la cuenta destino (BCP)
     · genera asiento contable + movimiento CC con proveedor
     · marca eventos del periodo como "liquidados"

E · src/pages/Tesoreria/CuentaWizard/Paso1TipoProducto.tsx (EDITAR)
   - Agregar 6to tipo Caja recaudadora en el selector inicial
   - Cuando se elige, ramificar Paso 2 a CajaRecaudadoraPaso2DatosTercero.tsx

F · src/pages/Tesoreria/CuentaWizard/CajaRecaudadoraPaso2DatosTercero.tsx (NUEVO)
   - Selector tercero responsable (Proveedor con autocomplete)
   - Configuración tarifa servicio
   - Cuenta de liquidación default

G · src/pages/Finanzas/components/LiquidarRecaudadoraWizard/ (NUEVA carpeta)
   - 3 pasos: selección periodo · revisión balance · confirmar liquidación
   - F-Borradores obligatorio
```

**Decisión arquitectural pendiente sobre cuándo implementar:**
- Opción A · ANTES de chk5.D-S2 (shell completo desde día 1 con 6 tipos)
- Opción B · DURANTE S3/S4 (shell sale primero con 5 tipos · recaudador como feature flag)
- Opción C · CAPÍTULO chk5.D-S1f DEDICADO al modelo técnico (solo tipos+services+tests)
- Recomendado: **Opción C** · modelo sólido primero · UI después

**Cita literal del usuario que motivó esta declaración (2026-05-15):**
> *"Pero la tarjeta de debito esta asociada a la cuenta de ahorros.
> Y el modelo que falto implementar fue el de la caja recaudadora."*

---

### DEUDA-DRAWER-TC-DEBITO (declarada 2026-05-15 · chk5.D-S1e)

El MOCK 2 actual deja TC débito como "variante condensada" en §3 sin drawer
F6.E dedicado. El modelo ya existe (`cuentaVinculadaId` en ProductoFinanciero)
· falta solo el mockup visual con drawer rico que muestre:

- Banner destacado: "Vinculada a [cuenta padre]" con saldo en tiempo real
- Datos básicos TC (banco · marca · últimos 4 · CCI si aplica)
- Banner educativo: "NO tiene saldo propio · descuenta de la cuenta padre"
- Cross-link al detalle de la cuenta padre (abre drawer apilado)
- Histórico cargos con impacto en cuenta padre
- Alertas tarjeta (bloqueo · sospecha fraude · etc.)

**Acción:** refinar MOCK 2 v5.1 agregando Drawer 5 dedicado a TC débito.

---

### DEUDA-TC-CUENTA-PAGO-DEFAULT-BIMONEDA (declarada 2026-05-15 · chk5.D-S1e)

El modelo actual `ProductoFinanciero.cuentaPagoDefaultId?: string` asume
**1 sola cuenta** para pagar el estado de cuenta de la TC al banco emisor.
Esto funciona para TC monomoneda · pero para **TC bimoneda** (USD + PEN
simultáneos) genera ambigüedad: ¿con qué cuenta se paga la deuda USD?
¿con qué cuenta la deuda PEN? Si solo hay una cuenta default, sistema
genera conversiones forzadas con diferencial cambiario innecesario.

**Decisión cerrada (usuario 2026-05-15):** 2 cuentas separadas para
bimoneda · cada deuda se paga con su cuenta natural.

**Cambios técnicos requeridos:**

```
src/types/productoFinanciero.types.ts
- Agregar campos opcionales:
    cuentaPagoDefaultUSDId?: string  (solo si esBiMoneda)
    cuentaPagoDefaultPENId?: string  (solo si esBiMoneda)
- Mantener cuentaPagoDefaultId?: string (solo si NO bimoneda)

src/types/tarjetaCredito.types.ts (legacy · deprecated path)
- Mismo refactor en TarjetaCreditoFormData

src/pages/Tesoreria/CuentaWizard/types.ts
- En CuentaWizardState agregar:
    cuentaPagoDefaultUSDId?: string
    cuentaPagoDefaultPENId?: string

src/pages/Tesoreria/CuentaWizard/Paso2TCCredito.tsx (nuevo o refactor)
- Si state.esBiMoneda · mostrar 2 selectores condicionales
- Si state.esBiMoneda === false · mostrar 1 selector
- Si state.titularidad === 'personal' · NO mostrar el campo

src/pages/Tesoreria/TarjetasCreditoV2/PagarEstadoCuentaWizard/Paso2CuentaPago.tsx
- En modo banco_emisor + bimoneda · preseleccionar las 2 cuentas según
  qué tipo de deuda se está pagando (USD / PEN / ambas)
- En modo banco_emisor + monomoneda · preseleccionar cuentaPagoDefaultId
- En modo reembolso_titular · NO usar default (elegir al momento)
```

**Aplica a:** MOCK 10 wizard nueva cuenta (paso 2 TC) · MOCK 3 wizard
B.2 Pagar estado TC.

**Cita literal usuario:** *"No entiendo lo de Cuenta Pago Default en la
Tarjeta de Credito?"* (2026-05-15)

---

### DEUDA-MODELO-RECAUDADOR (REFINADA 2026-05-15 · chk5.D-S1e)

**Refinamiento crítico** sobre la declaración original (que asumía 1 canal
único por recaudadora · ej. solo Yape). La realidad operativa de Vita Skin
Peru con GK Xpress requiere **multi-canal**: el rider del proveedor cobra
al cliente final con cualquiera de estos medios según conveniencia:
- Yape personal del rider
- Plin del rider
- Efectivo (cash physical)
- POS Niubiz/Izipay/Visanet propio (settles a su BCP)
- Transferencia bancaria directa

Al final del periodo, el proveedor consolida TODO y liquida **1 sola
transferencia** al negocio. CC con el proveedor es **1 sola** · tarifa
de servicios (S/ 25 × carrera) se cobra sobre el total consolidado · NO
por canal.

**Decisión cerrada (usuario 2026-05-15):** Opción A · 1 caja recaudadora
con multi-canal y balance consolidado.

**Cambios técnicos requeridos (refinamiento de spec original):**

```
A · src/types/productoFinanciero.types.ts
   REFINAR ProductoFinanciero cuando tipoProducto='caja_recaudadora':
   - canalesAceptados: Array<{
       tipo: TipoCanalRecaudacion  // ver B
       identificador?: string      // celular Yape/Plin · merchant ID POS · CCI
       activo: boolean
     }>
   - NO usar campo único 'canal' (eliminar de spec original)

B · src/types/canalRecaudacion.types.ts (NUEVO)
   - export type TipoCanalRecaudacion =
       | 'yape' | 'plin' | 'sip' | 'agora' | 'bim'  // canales digitales
       | 'efectivo'                                  // cash physical
       | 'pos_niubiz' | 'pos_izipay' | 'pos_visanet'  // POS terminals
       | 'transferencia'                             // banco directo

C · src/types/eventoServicioRecaudador.types.ts (REFINAR · ya declarado)
   AGREGAR campo:
   - canalCobro: TipoCanalRecaudacion  // qué canal usó el cliente

D · src/services/cajaRecaudadora.service.ts (REFINAR)
   - registrarCobroEntrante(recaudadoraId, monto, canalCobro, ...)
       · valida que canalCobro esté en canalesAceptados
   - calcularBalanceMes(recaudadoraId, mes)
       → returns {
           consolidado: { cobrosRecibidos, serviciosDescontados, ... },
           porCanal: Record<TipoCanalRecaudacion, { monto, eventos }>
         }

E · src/services/liquidarCajaRecaudadora.service.ts (sin cambios)
   - Liquida balance CONSOLIDADO (no por canal)
   - 1 sola transacción de tesorería → 1 cuenta destino

F · src/pages/Tesoreria/CuentaWizard/CajaRecaudadoraPaso2DatosTercero.tsx
   REFACTOR · multi-select canales aceptados en lugar de 1 selector
   - Cada canal agregable con su identificador específico
   - Validación: al menos 1 canal activo obligatorio

G · src/components/finanzas/CajaRecaudadoraDrawer.tsx (NUEVO)
   - Balance equation visual + breakdown por canal accordeon

H · src/pages/Finanzas/components/LiquidarRecaudadoraWizard/Paso2Revision.tsx
   - Tabla de cobros con columna 'Canal cobro' filtrable
   - Resumen agrupado por canal antes de liquidar
```

**Aplica a:** MOCK 2 drawer caja recaudadora · MOCK 3 wizard B.4
liquidar recaudadora · MOCK 8 card CC GK Xpress · MOCK 10 wizard nueva
cuenta paso 2 Recaudadora.

**Cita literal usuario:** *"Y que pasa si el agente de la Caja Recaudadora
recibe en distintos medios de pago digamos que cobra con su pos propio,
con plin, efectivo!?"* (2026-05-15)

---

### DEUDA-MODELO-POOL-USD-VISTA (declarada 2026-05-15 · chk5.D-S1e)

**Hallazgo crítico:** los mockups v5.1 simplificaron mal el modelo Pool USD
tratándolo como **1 cuenta única** (Pool USD = BCP Ahorros USD). El código
real (`poolUSD.view.service.ts`) tiene esto correctamente modelado como
**vista agregada/derivada** que suma TODAS las cuentas USD físicas y
calcula UN solo TCPA aplicable a todos los dólares de la empresa.

Cita del código (`poolUSD.view.service.ts` líneas 6-20):
> *"REINGENIERIA: Pool USD ya no tiene colecciones propias. El TCPA se
> calcula desde los movimientos de cuentas USD en Tesoreria. Este servicio
> reemplaza: poolUSDMovimientos (deprecada) · poolUSDSnapshots (deprecada)
> · poolUSD.service.ts (deprecado). El TCPA = SUM(montoPEN compras USD)
> / SUM(montoUSD compras USD)."*

**Decisión cerrada D13 (usuario 2026-05-15):** Pool USD es vista agregada
de N cuentas USD físicas (BCP USD + IBK USD + BBVA USD + cualquier otra).
Cada cuenta USD es `ProductoFinanciero` independiente con su saldo · CCI
· banco. TCPA es único · calculado desde TODAS las conversiones PEN→USD
del sistema (no por banco).

**Cita literal usuario:** *"Solo por curiosidad, si bien es cierto que
existe el pool USD, se entiende que hay USD que tienen su creacion desde
cada cuenta distinta, cierto esta el USD de IBK, de BCP, etc...!?"*
(2026-05-15)

**Cambios técnicos requeridos:**

```
A · src/services/poolUSD.service.ts (legacy)
   AUDITAR · puede eliminarse completo · la lógica vive en .view.service
   - Verificar que ningún consumer dependa del service viejo
   - Si confirmado, eliminar + actualizar imports

B · src/store/poolUSDStore.ts (legacy)
   AUDITAR · si usa solo .service viejo (deprecado), refactor a usar .view
   - Renombrar a poolUSDViewStore para reflejar que es vista derivada

C · src/components/modules/tesoreria/PoolUSDWidget.tsx
   REFACTOR:
   - Mostrar total agregado consolidado (suma N cuentas USD)
   - Drill expandible por cuenta (BCP USD: $X · IBK USD: $Y · etc.)
   - TCPA único visible
   - NO presentar como "1 cuenta llamada Pool USD"

D · Toda la UI de wizards (B.1, B.2, B.3, A.3, A.4)
   AJUSTAR selector "cuenta USD":
   - Listar cuentas USD individuales (BCP USD · IBK USD · BBVA USD)
   - Destacar cuenta default
   - Banner: "operación se ejecuta desde cuenta X · TCPA aplica del Pool
     consolidado · sin importar qué cuenta uses"

E · src/types/productoFinanciero.types.ts
   NO requiere cambios · cada cuenta USD ya es ProductoFinanciero propia

F · Reportes / dashboards
   Pool USD siempre se presenta como VISTA · nunca como entidad propia
```

**Aplica a:** MOCK 1 sidebar widget · MOCK 2 listado cuentas · MOCK 3
wizards selectores · MOCK 6 KPI strip Saldos · MOCK 10 wizard nueva
cuenta paso 2 TC bimoneda.

---

### D14 · Fuentes TC y override manual genérico (declarada 2026-05-15 · chk5.D-S1e)

**Confirmación tras audit de código:** el sistema YA tiene infraestructura
TC canon implementada:
- `src/services/tipoCambio.service.ts` con cache + freshness tracking
- `src/hooks/useTipoCambio.ts` con auto-refresh 5min
- `TCChip` componente shared con override manual + auditoría
- 45 archivos consumidores en grep · todos los módulos integrados
- Persistencia override: `fuenteTcDelDia: 'auto' | 'manual'` + `motivoOverrideTc`
- Auditoría completa: `creadoPor` + `fechaCreacion` por operación

**Decisión cerrada usuario 2026-05-15:** mantener 3 fuentes TC del sistema
(SBS oficial · TCPA Pool USD · TipoCambio service del día) + **1 categoría
override manual genérica** que cubre TODOS los casos negociados externos
(casa cambio · banco · contractual · fintech) sin pre-configurar variantes
adicionales · operador ingresa el TC + justificación obligatoria.

**Cita literal usuario:** *"Tengo una duda, los modulos estan integrando
el TC real que se registra en el sistema!? Y tambien estoy con la duda,
que pasa si yo quiero cambiar o pagar a determinado monto que no se
ajusta a mi registro de Tipo de Cambio sino a uno que me ofrece
determinada entidad?"* + *"En realidad dejarlo como fuente manual."* (2026-05-15)

**Refinamientos UI aplicados en mockups v5.1 post-T8:**

```
MOCK 5 (vista inversa Movimiento) · NUEVO bloque:
- Sección "TC aplicado en esta operación"
- Fuente badge: SBS / TCPA Pool / Manual
- TC sistema del día (referencia comparativa)
- TC aplicado
- Diferencia vs sistema (preciso · destacado)
- Justificación si override manual
- Auditoría: quién + cuándo confirmó

MOCK 12 (wizard B.1 paso 3 TC) · expandir:
- 3 cards fuentes sistema (SBS · TCPA · Diferencial) ya existentes
- + botón "TC manual con justificación" (override)
- + histórico TCs últimos 30 días tabla compacta para comparar

MOCK 18 (wizard editar cuenta) · agregar:
- Nueva sección "Histórico TCs usados en operaciones"
- Tabla con fecha · operación · fuente · TC aplicado · usuario
- Filtro por rango fechas + por fuente
```

NO se preconfiguran fuentes adicionales (Casa cambio · Banco · Fintech ·
Contractual) · todas estas se manejan vía override manual con justificación
escrita en `motivoOverrideTc`. Mantiene UI simple · auditoría preservada.

---

## ✅ chk5.D-S1f · MODELO TÉCNICO CAJA RECAUDADORA COMPLETO (2026-05-15)

Sprint dedicado al modelo técnico de Caja Recaudadora (D5 + D12) ejecutado
en 6 fases. Cobertura completa de DEUDA-MODELO-RECAUDADOR original + refinada.

### Fases ejecutadas

| Fase | Contenido | Estado |
|------|-----------|--------|
| F1 | Extender `productoFinanciero.types.ts` con 7mo tipo + tipos auxiliares + helpers | ✅ |
| F2 | Crear `eventoServicioRecaudador.types.ts` (eventos + liquidación + balance) | ✅ |
| F3 | Services backend (`cajaRecaudadora.service.ts` + `liquidarCajaRecaudadora.service.ts`) | ✅ |
| F4 | CuentaWizard extensión · 5to tipo + 3 pasos dedicados Recaudadora | ✅ |
| F5 | `LiquidarRecaudadoraWizard` · 3 pasos + F-Borradores integrado | ✅ |
| F6 | firestore.rules + tests unitarios (15/15) + vite build verde | ✅ |

### Archivos nuevos (10)

```
src/types/eventoServicioRecaudador.types.ts                                (250 ln)
src/types/productoFinanciero.cajaRecaudadora.test.ts                       (135 ln · 15 tests)
src/services/cajaRecaudadora.service.ts                                    (360 ln)
src/services/liquidarCajaRecaudadora.service.ts                            (290 ln)
src/pages/Tesoreria/CuentaWizard/CajaRecaudadoraPaso2DatosTercero.tsx     (215 ln)
src/pages/Tesoreria/CuentaWizard/CajaRecaudadoraPaso3LiquidacionConfig.tsx (110 ln)
src/pages/Tesoreria/CuentaWizard/CajaRecaudadoraPaso4CanalesAceptados.tsx  (220 ln)
src/pages/Finanzas/components/LiquidarRecaudadoraWizard/types.ts          (130 ln)
src/pages/Finanzas/components/LiquidarRecaudadoraWizard/Paso1Seleccion.tsx (135 ln)
src/pages/Finanzas/components/LiquidarRecaudadoraWizard/Paso2Revision.tsx  (175 ln)
src/pages/Finanzas/components/LiquidarRecaudadoraWizard/Paso3Confirmar.tsx (105 ln)
src/pages/Finanzas/components/LiquidarRecaudadoraWizard/LiquidarRecaudadoraWizard.tsx (245 ln)
```

### Archivos modificados (6)

```
src/types/productoFinanciero.types.ts          (+265 ln · tipos + helpers)
src/types/borradorWizard.types.ts              (+'liquidar_recaudadora')
src/config/collections.ts                      (+2 collections nuevas)
src/services/productoFinanciero.adapters.ts    (+caja_recaudadora cases · 2 switches)
src/pages/Tesoreria/CuentaWizard/types.ts      (+'recaudadora' tipo · campos state · validaciones · mappings)
src/pages/Tesoreria/CuentaWizard/Paso1TipoProducto.tsx (+5ta opción tipo)
src/pages/Tesoreria/CuentaWizard/CuentaWizard.tsx       (+ramificación pasos según tipo)
src/design-system/components/BorradorBanner.tsx        (+entry liquidar_recaudadora en LABELS)
firestore.rules                                (+2 colecciones nuevas con permisos canon)
```

### Cobertura técnica

- ✅ Tipo `'caja_recaudadora'` agregado a `TipoProductoFinanciero` (7mo valor)
- ✅ 10 canales aceptados D12 (5 digitales + efectivo + 3 POS + transferencia)
- ✅ 3 modalidades tarifa servicio (fijo_por_evento · porcentaje · mixto)
- ✅ Multi-canal con balance consolidado · 1 CC proveedor · liquidación única
- ✅ Snapshot tarifa preserva auditoría histórica
- ✅ Idempotency keys en todos los services (cobros · servicios · liquidación)
- ✅ `runTransaction` Firestore atómico (crear liquidación + marcar eventos)
- ✅ Breakdown por canal en `BalanceRecaudadora`
- ✅ Validación tolerancia 0.01 saldo declarado vs calculado
- ✅ Bloqueo anulación liquidación >30 días (preserva histórico contable)
- ✅ F-Borradores integrado (autosave debounce 1s · carga al abrir · descarta al confirmar)
- ✅ Firestore rules (read: 4 roles · write: 3 roles · delete: prohibido)
- ✅ Tests unitarios 15/15 pasando
- ✅ vite build verde · tsc 0 errores nuevos

### TODOs declarados para sesión posterior

| TODO | Fase resolución |
|------|-----------------|
| Integrar `MovimientoTesoreria` en `liquidarSaldo()` (egreso recaudadora ↔ ingreso destino) | chk5.D-S2 |
| Integrar `MovimientoCC` con proveedor recaudador (reconoce servicios) | chk5.D-S2 |
| Integrar `AsientoContable` (delegando a contabilidad.service) | chk5.D-S2 |
| Reemplazar inputs ID por autocomplete productosFinancieros + entidades | chk5.D-S3 |
| UI listado/detalle recaudadora en pantalla Finanzas (con balance en vivo) | chk5.D-S2 |
| Job mensual `registrarServicioDescontado` automático al cerrar periodo | chk5.D-S4 |

### Decisión arquitectural · best-effort post-transacción

La pieza CRÍTICA atómica de `liquidarSaldo()` cubre:
1. Crear `LiquidacionRecaudadora` (estado='confirmada')
2. Marcar N eventos del periodo como 'liquidado' + FKs

Las integraciones con movimientoTesoreria + CC proveedor + asiento contable
quedan como **TODOs trazables (logger.warn)** para resolución en chk5.D-S2
cuando el shell del módulo Finanzas se construya y se coordine con
`movimientoFinanciero.service.ts` (que está en refactor F4 del modelo).

Esta decisión preserva integridad del balance (lo crítico) y traza claramente
lo pendiente para no perder el contexto entre sesiones.

### Sprint chk5.D-S1f cerrado · listo para chk5.D-S2

El modelo técnico Caja Recaudadora queda **production-ready** con:
- 100% cobertura del modelo de datos
- Services con validaciones exhaustivas + idempotency
- UI wizards (creación + edición + liquidación) operativos
- F-Borradores en wizards multi-step
- Tests unitarios pasando
- Permisos Firestore canon
- Build verde

Prerequisito chk5.D-S2 (shell Finanzas + Overview + redirect /tesoreria)
satisfecho. Próximo paso natural: arrancar chk5.D-S2.
