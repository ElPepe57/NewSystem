# Arquitectura Finanzas v2 · Doc consolidado S58 (v2 final)

> Documento de referencia que une los 4 mockups de la sesión S58. Mapa para la
> implementación progresiva (Camino 2 aprobado).
>
> **v2 final** incorpora todos los ajustes posteriores: TC automático, billeteras
> en 2 categorías, saldo concepto "del negocio", titular extendido a 4 tipos,
> agentes recaudadores vía módulos existentes (sin TX-3).

## Índice

- [1. Mockups entregados](#1-mockups-entregados)
- [2. Modelos de datos finales](#2-modelos-de-datos-finales)
- [3. Las 2 transacciones atómicas críticas](#3-las-2-transacciones-atómicas-críticas)
- [4. Casos canónicos · cómo se modela cada flujo real](#4-casos-canónicos--cómo-se-modela-cada-flujo-real)
- [5. Plan de implementación · Camino 2](#5-plan-de-implementación--camino-2)
- [6. Stand-by · S58e y S58f](#6-stand-by--s58e-y-s58f)
- [7. Decisiones cerradas (22)](#7-decisiones-cerradas-22)

---

## 1. Mockups entregados

| Mockup | Archivo | Cubre |
|---|---|---|
| **S58** | `modales-finanzas-s58.html` | Sistema FormModal v2 + inputs avanzados + UX patterns |
| **S58b** | `pago-abono-distribuido-s58.html` | "1 desembolso → N deudas de la misma entidad" |
| **S58c** | `cuenta-bancaria-full-s58c.html` (v2) | Wizard cuenta · billeteras 2 categorías · titular extendido · saldo concepto |
| **S58d** | `tarjeta-credito-s58d.html` (v2) | TC sin tope · saldo negativo = deuda con titular · modo banco/reembolso |

**Stand-by** (planificados, no implementados aún):
- **S58e** — Trazabilidad TC end-to-end (los 6 momentos de diferencial cambiario)
- **S58f** — Gastos con proveedores formales (extensión modelo Gasto)

---

## 2. Modelos de datos finales

### 2.1 `TipoEntidadCC` extendido

```ts
export type TipoEntidadCC =
  | 'cliente'
  | 'proveedor'
  | 'colaborador'
  | 'empleado'
  | 'tarjeta_credito';   // ⭐ S58d: cada tarjeta tiene CC espejo
```

### 2.2 `CuentaCaja` extendido

```ts
interface CuentaCaja {
  id: string;
  nombre: string;
  tipo: 'banco' | 'digital' | 'efectivo' | 'credito';

  // ─── Productos válidos según tipo ───
  // banco        → cuenta_ahorros, cuenta_corriente
  // digital      → mercadopago, paypal, zelle, wise (INDEPENDIENTES, con saldo)
  // efectivo     → caja
  // credito      → tarjeta_debito (vinculada a ahorros)
  productoFinanciero?: 'cuenta_ahorros' | 'cuenta_corriente'
                     | 'mercadopago' | 'paypal' | 'zelle' | 'wise' | 'binance'
                     | 'caja'
                     | 'tarjeta_debito';

  // ─── Bi-moneda (solo banco y caja) ───
  esBiMoneda: boolean;
  moneda: 'PEN' | 'USD';
  saldoActual: number;        // mono-moneda
  saldoUSD?: number;          // bi-moneda
  saldoPEN?: number;          // bi-moneda
  saldoMinimo?: number;
  saldoMinimoUSD?: number;
  saldoMinimoPEN?: number;

  // ─── Datos bancarios (banco · digital) ───
  banco?: string;
  bancoNombreCompleto?: string;
  numeroCuenta?: string;
  cci?: string;

  // ─── Vinculación tarjeta débito → ahorros ───
  cuentaVinculadaId?: string;

  // ─── ⭐ NUEVO: Titularidad ───
  titularidad: 'empresa' | 'personal';
  titularEntidadId?: string;            // ref a entidad CC si es 'personal'
  titularEntidadTipo?: 'empleado' | 'colaborador' | 'proveedor' | 'cliente';
  titularNombre: string;                // siempre presente (desnormalizado)

  // ─── Canales digitales (solo tipo='banco') ───
  // Yape, Plin, SIP, Ágora, BIM viven aquí, NO como CuentaCaja propia.
  // Son métodos de acceso a esta cuenta bancaria.
  canalesDigitales?: Array<{
    tipo: 'yape' | 'plin' | 'sip' | 'agora' | 'bim';
    identificador: string;              // teléfono o alias
  }>;

  // ─── Métodos de pago aceptados ───
  metodosDisponibles?: string[];        // ej: ['transferencia', 'yape', 'plin']

  // Otros
  activa: boolean;
  esCuentaPorDefecto?: boolean;
  creadoPor: string;
  fechaCreacion: Timestamp;
}
```

**Productos descartados respecto a v1:**
- `tarjeta_credito` → ya NO es un producto de CuentaCaja, vive en su propia colección `TarjetaCredito`
- `billetera_digital` genérica → desaparece. Yape/Plin son `canalesDigitales` de cuenta banco; MercadoPago/PayPal son productos propios de tipo `digital`

### 2.3 `DatosBancarios[]` en ficha de entidades CC

Cuentas de TERCEROS sin saldo trackeado (datos pasivos para hacer pagos/cobros).

```ts
interface DatoBancario {
  id: string;
  banco: string;
  numeroCuenta: string;
  cci?: string;
  moneda: 'PEN' | 'USD';
  tipo: 'ahorros' | 'corriente';
  esPrincipal: boolean;
  notas?: string;

  // ⭐ Si se promueve a CuentaCaja (agente recaudador)
  cuentaCajaAsociadaId?: string;
}

// Se agrega como campo nuevo en:
interface Proveedor    { /* ... */ datosBancarios?: DatoBancario[]; }
interface Cliente      { /* ... */ datosBancarios?: DatoBancario[]; }
interface Colaborador  { /* ... */ datosBancarios?: DatoBancario[]; }
interface Empleado     { /* ... */ datosBancarios?: DatoBancario[]; }
```

**Promoción a CuentaCaja:**
Cuando el sistema detecta el primer movimiento que apunta a un `DatoBancario` (ej: cobro al yape de GK Xpress), aparece banner:
> "Detectamos un movimiento al yape de GK Xpress. ¿Convertirlo en Caja recaudadora para trackear saldo?"
>
> [Promover] [No, registrar sin trackeo]

Click en "Promover" → crea `CuentaCaja` con `titularEntidadTipo: 'proveedor'` y se enlaza al `DatoBancario` original.

### 2.4 `TarjetaCredito` (entidad rica · soporta bi-moneda)

```ts
interface TarjetaCredito {
  id: string;
  codigo: string;                      // TC-001
  nombre: string;
  banco: string;
  marca: 'visa' | 'mastercard' | 'amex' | 'otra';
  ultimosDigitos: string;

  // ⭐ Bi-moneda support
  esBiMoneda: boolean;                 // true = acumula deuda en USD y PEN simultáneamente
  moneda: 'USD' | 'PEN';               // mono: la moneda · bi: principal/display

  // Ciclo
  diaCorte: number;                    // 1-28
  diaPago: number;                     // 1-28
  tasaInteresAnual?: number;           // referencial

  // ⭐ SIN saldo inicial · SIN línea de crédito como tope
  // El saldo se calcula dinámicamente:
  //   utilizadoUSD = Σ(cargosPendientes.monto WHERE moneda='USD')
  //   utilizadoPEN = Σ(cargosPendientes.monto WHERE moneda='PEN')
  // No hay barrera de "límite excedido" porque la tarjeta tiene disponibilidad real
  // (el sistema solo trackea cargos del negocio, no gastos personales mezclados)
  topeControlUSD?: number;             // opcional · alerta cargos USD
  topeControlPEN?: number;             // opcional · alerta cargos PEN

  // ⭐ Titularidad (CRÍTICO para workflow de pago)
  titularidad: 'empresa' | 'personal';
  titularEntidadId?: string;           // ref a empleado/colaborador
  titularEntidadTipo?: 'empleado' | 'colaborador';
  titularNombre: string;

  // Estado
  activa: boolean;

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
}
```

**Notas sobre bi-moneda en TC:**
- 2 saldos negativos coexisten (`utilizadoUSD` y `utilizadoPEN`) — calculados dinámico, no persistidos
- Cada `CargoTarjeta` tiene su propia `moneda` — afecta solo el sub-saldo correspondiente
- Workflow "Pagar estado" permite saldar por moneda independiente (sin diferencial) o consolidado (con diferencial)
- En vista por titular del cash flow, una TC bi-moneda muestra ambas deudas: `−US$ 5,400 / −S/ 8,200`

**Concepto del saldo:**
- `utilizado = Σ(cargosPendientes.monto)` (calculado dinámicamente)
- Si `titularidad === 'personal'`: utilizado = "lo que el negocio le debe al titular por compartir su TC"
- Si `titularidad === 'empresa'`: utilizado = "lo que el negocio le debe al banco emisor"

### 2.5 `CargoTarjeta` extendido ⭐

```ts
interface CargoTarjeta {
  id: string;
  tarjetaCreditoId: string;
  fecha: Timestamp;

  // Monto del cargo
  moneda: 'USD' | 'PEN';
  monto: number;
  tcDelDia: number;                    // ⭐ AUTO desde tipoCambio.service · NO editable
  montoEquivalentePEN: number;
  montoEquivalenteUSD: number;
  descripcion: string;

  // ⭐ Documentos cancelados (polimórfico, plural)
  documentosCancelados: Array<{
    tipo: 'oc' | 'envio' | 'gasto' | 'devolucion' | 'boleta';
    documentoId: string;
    documentoNumero: string;
    entidadId: string;
    entidadTipo: TipoEntidadCC;
    entidadNombre: string;
    montoCancelado: number;
    monedaDocumento: 'USD' | 'PEN';
    montoEquivalenteEnCargo: number;
  }>;

  // Estado y pagos parciales
  estado: 'pendiente' | 'parcial' | 'pagado';
  montoPagado: number;
  montoPendiente: number;
  pagos: Array<{
    pagoEstadoCuentaId: string;
    fecha: Timestamp;
    montoPagado: number;
    tcPago: number;
    diferencialCambiarioPEN: number;
  }>;

  creadoPor: string;
  fechaCreacion: Timestamp;
  idempotencyKey?: string;
}
```

### 2.6 `PagoEstadoCuentaTarjeta` (con modo)

```ts
interface PagoEstadoCuentaTarjeta {
  id: string;
  tarjetaCreditoId: string;
  fecha: Timestamp;

  // ⭐ Modo del pago (depende de titularidad de la tarjeta)
  modo: 'banco_emisor' | 'reembolso_titular';

  // Origen del pago
  cuentaPagoId: string;
  cuentaPagoNombre: string;

  // Monto
  moneda: 'USD' | 'PEN';
  monto: number;
  tcPago: number;                      // ⭐ AUTO desde tipoCambio.service o TCPA Pool USD

  // Cargos cubiertos
  cargosPagados: Array<{
    cargoTarjetaId: string;
    montoAplicado: number;
    diferencialCambiarioPEN: number;
  }>;

  diferencialCambiarioTotalPEN: number;

  // Vínculos
  movimientoTesoreriaId: string;
  movimientosCCBancoEmisorIds?: string[];     // si modo='banco_emisor'
  movimientosCCTitularIds?: string[];         // si modo='reembolso_titular'

  creadoPor: string;
  fechaCreacion: Timestamp;
}
```

---

## 3. Las 2 transacciones atómicas críticas

> **TX-3 ELIMINADA.** El flujo de "agente recaudador" se cubre con módulos existentes
> (Transferencias entre cuentas + Pagos a CC + Movimientos). No requiere transacción nueva.

### TX-1: Cargar documento(s) a la tarjeta

```
INPUT: { tarjetaId, documentos: [{tipo, id, monto, entidadId}], descripcion }
       (TC del día se obtiene automático desde tipoCambio.service)

EJECUTA EN runTransaction:
  1. Crea CargoTarjeta { documentosCancelados: [...], tcDelDia: AUTO }
  2. Por cada documento cancelado:
     2a. MovimientoCC crédito en CC entidad original (saldo se reduce hacia 0)
     2b. Update documento origen: estadoPago='pagado_con_tc', cargoTarjetaId
  3. MovimientoCC débito en CC tarjeta (entidadTipo='tarjeta_credito')
  4. NOTA: TarjetaCredito.utilizado se calcula dinámico, no se persiste

INVARIANTES:
  - Σ(documentosCancelados.montoEquivalenteEnCargo) = CargoTarjeta.monto
  - documentosCancelados.entidadId todos diferentes O todos iguales
```

### TX-2: Pagar estado de cuenta

```
INPUT: {
  tarjetaId,
  cuentaPagoId,
  cargosAPagar: [{cargoId, monto}],
  modo: 'banco_emisor' | 'reembolso_titular'  // ⭐ inferido de tarjeta.titularidad
}
       (TC del pago se obtiene automático: TCPA Pool USD si paga en USD desde Pool,
        o TC del día si convierte)

EJECUTA EN runTransaction:
  1. Crea PagoEstadoCuentaTarjeta { modo, ... }
  2. MovimientoTesoreria egreso desde cuentaPagoId
  3. Por cada cargo pagado:
     3a. Calcula Δ = (cargo.tcDelDia - tcPago) × montoAplicado
     3b. Update CargoTarjeta:
         - montoPagado += montoAplicado
         - estado = (montoPagado === monto) ? 'pagado' : 'parcial'
         - pagos.push({...})
  4. MovimientoCC crédito en CC tarjeta (saldo se reduce)
  5. Si modo='reembolso_titular':
     5a. MovimientoCC débito en CC del titular (empleado/colaborador)
         (el negocio le debe al titular como contraparte del crédito anterior)
     5b. NOTA: en reembolso NO hay diferencial cambiario real (el titular ya lo asumió)
  6. Si Σ(diferenciales) ≠ 0 (solo modo banco_emisor):
     6a. Registra en RegistroTCTransaccion para Rendimiento Cambiario

INVARIANTES:
  - Σ(cargosPagados.montoAplicado) = PagoEstadoCuentaTarjeta.monto
  - Para cada cargo: montoAplicado ≤ cargo.montoPendiente
```

---

## 4. Casos canónicos · cómo se modela cada flujo real

### Caso A — Compra con tarjeta de crédito personal del dueño

```
1. Negocio confirma OC al proveedor X por US$ 5,000
   → CC proveedor X: −5,000 (le debes)
   
2. Cargo tarjeta: dueño paga con su BBVA Visa personal
   TX-1 ejecuta:
   → CargoTarjeta { documentosCancelados: [OC-X · US$ 5,000], tcDelDia: 3.703 }
   → CC proveedor X: +5,000 (saldó)
   → CC tarjeta BBVA Visa: −5,000 (el negocio le debe al dueño)

3. Mes después, dueño paga al banco emisor con su tarjeta
   (PERO con plata mixta personal/empresa, el sistema solo se entera del REEMBOLSO)
   
4. Negocio reembolsa US$ 5,000 al dueño desde BCP Soles
   TX-2 modo='reembolso_titular' ejecuta:
   → MovimientoTesoreria: egreso de BCP Soles · US$ 5,000 (al TC del día actual)
   → CargoTarjeta.estado: 'pagado'
   → CC tarjeta BBVA Visa: +5,000 (saldó)
   → CC dueño (empleado/colaborador): −X PEN (el negocio le debe en PEN)... 
     o se cancela directo si la transferencia llega al titular

CIERRE: nadie debe a nadie.
```

### Caso B — GK Xpress · agente recaudador

```
SETUP:
- GK Xpress (Proveedor de transporte) tiene CC: −S/ 250 (le debes 10 carreras × 25)
- Cliente Y tiene CC: −S/ 800 (te debe venta contraentrega)
- Caja Yape GK Xpress (CuentaCaja, titularEntidadTipo='proveedor'): S/ 0

EVENTO 1 · Cliente paga al yape de GK (cobro al agente)
  Módulo Cobros (existente):
  → cuenta destino del cobro: Caja Yape GK Xpress
  → CC Cliente Y: +800 (saldó · 0)
  → Caja Yape GK Xpress: +800

EVENTO 2 · GK descuenta 4 carreras (S/ 100) de la recaudación
  Módulo Pagos a CC (existente):
  → cuenta origen: Caja Yape GK Xpress
  → beneficiario: GK Xpress (su CC como proveedor)
  → Caja Yape GK Xpress: −100 (queda 700)
  → CC GK Xpress: +100 (deuda parcial saldada · −150)

EVENTO 3 · GK transfiere S/ 600 al negocio (parcial, queda con 100 más)
  Módulo Transferencias entre cuentas (existente):
  → origen: Caja Yape GK Xpress
  → destino: BCP Soles Empresa
  → Caja Yape GK Xpress: −600 (queda 100)
  → BCP Soles Empresa: +600

EVENTO 4 · Otro día, GK descuenta 6 carreras más (S/ 150)
  Módulo Pagos a CC:
  → Caja Yape GK Xpress: −100 (queda 0... espera, falta 50)
  → CC GK Xpress: +100 (queda −50)
  → ⚠ CC del agente queda en −50 (negocio aún le debe S/ 50 por carrera n°10)

EVENTO 5 · Pago directo de S/ 50 a GK (cierre)
  Módulo Pagos a CC:
  → cuenta origen: BCP Soles Empresa
  → CC GK Xpress: +50 (saldó · 0)

CIERRE: todo conciliado. Cada peso trazado.
```

### Caso C — Cliente paga su factura por Yape vinculado al BCP del negocio

```
- BCP Soles Empresa tiene canal Yape vinculado al teléfono X
- Cliente paga su deuda al Yape X
  Módulo Cobros:
  → método: Yape (resuelve a cuenta destino: BCP Soles Empresa)
  → BCP Soles Empresa: +monto
  → CC Cliente: saldó

Yape no es una cuenta separada, es solo un canal. El dinero entra directo al banco.
```

---

## 5. Plan de implementación · Camino 2

### Orden recomendado (sin cambios respecto a v1)

| # | Fase | Cubre | Sesiones | Depende de |
|---|---|---|---|---|
| 1 | **S58 F1** | FormModal v2 shell + atajos teclado + skeleton | 1 | — |
| 2 | **S58 F2** | TextField, MoneyField, DateField, Combobox, ToggleGroup + react-hook-form + zod | 1 | F1 |
| 3 | **S58 F3** | Smart defaults + optimistic submit + toast undo + **TC automático** | 1 | F2 |
| 4 | **S58 F4** | Auto-save de borradores | 0.5 | F1 |
| 5 | **S58c** | Wizard cuenta + billeteras 2 categorías + titular extendido | 1 | F1+F2 |
| 6 | **F-DatosBanc** | `datosBancarios[]` en fichas + UI promoción a CuentaCaja | 0.5 | S58c |
| 7 | **S58b F1** | Service `pagoAbonoDistribuido.ejecutar()` | 1 | — |
| 8 | **S58b F2** | Wizard "abono distribuido" 4 pasos | 1 | F1+F2 + S58b F1 |
| 9 | **S58b F3** | Entry points | 0.5 | S58b F2 |
| 10 | **S58d F1** | Service `cargoTarjeta.ejecutar()` (TX-1) | 1 | — |
| 11 | **S58d F2** | Service `pagoEstadoCuentaTarjeta.ejecutar()` (TX-2) con 2 modos | 1 | F10 |
| 12 | **S58d F3** | UI: lista tarjetas + detalle + cargar OC + pagar (banco/reembolso) | 1.5 | F1+F2 + F10+F11 |
| 13 | **S58d F4** | Vista CC de tarjeta + integración con Saldos | 0.5 | F12 |
| 14 | **S58 F5** | Migrar a FormModal v2: Conversión, Transferencia | 1 | F1+F2+F3 |

**Total: ~12-13 sesiones**

---

## 6. Stand-by · S58e y S58f

(sin cambios respecto a v1)

### S58e — Trazabilidad TC end-to-end (6 momentos)
2-3 sesiones cuando se aborde.

### S58f — Gastos con proveedores formales
1-2 sesiones cuando se aborde.

---

## 7. Decisiones cerradas (22)

1. **D-S58-1**: Referente visual — Mercury / Stripe Atlas (banking-grade)
2. **D-S58-2**: Stack — `react-hook-form` + `zod` (~20KB)
3. **D-S58-3**: Piloto FormModal v2 — Nuevo Movimiento de Tesorería
4. **D-S58-4**: Modales fuera de Cash flow → migran después en sesiones separadas
5. **D-S58-5**: PagosMasivos actual NO se toca (caso "N pagos a N entidades")
6. **D-S58-6**: Pago con abono distribuido = NUEVO flujo complementario
7. **D-S58-7**: Tarjeta de crédito = entidad rica `TarjetaCredito` + `CargoTarjeta`
8. **D-S58-8**: Nuevo `TipoEntidadCC = 'tarjeta_credito'`
9. **D-S58-9**: No mezclar monedas en un solo cargo
10. **D-S58-10**: Sí soportar pagos parciales de cargos
11. **D-S58-11**: Cargos sin OC vinculan a Gasto Fijo (existente o nuevo desde flujo)
12. **D-S58-12**: Diferencial cambiario integrado con Pool USD (TCPA) y RegistroTCTransaccion
13. **D-S58-13**: USD del Pool se considera "consumido" al pagar estado de cuenta
14. **D-S58-14**: Camino 2 (focalizado, S58 + S58b + S58d primero)
15. **D-S58-15**: Mockups antes de código (design-driven)
16. **D-S58-16** ⭐ NUEVA: TC automático en TODOS los modales (auto + override con motivo). El sistema usa tipoCambio.service / Pool USD TCPA / RegistroTCTransaccion histórico.
17. **D-S58-17** ⭐ NUEVA: Billeteras digitales en 2 categorías:
   - **Vinculadas a banco** (Yape, Plin, SIP, Ágora, BIM) → `canalesDigitales[]` en CuentaCaja banco
   - **Independientes** (MercadoPago, PayPal, Zelle) → CuentaCaja propia tipo='digital'
18. **D-S58-18** ⭐ NUEVA: Saldo de CuentaCaja = "saldo del negocio en esta cuenta", NO el saldo del banco. Default 0. Permite uso mixto personal/empresa sin auditar contra banco directo.
19. **D-S58-19** ⭐ NUEVA: TarjetaCredito SIN saldo inicial, SIN línea de crédito como tope (solo tope opcional informativo). Saldo negativo = "deuda del negocio con el titular".
20. **D-S58-20** ⭐ NUEVA: Titularidad extendida a 4 tipos. `CuentaCaja.titularEntidadTipo: 'empleado' | 'colaborador' | 'proveedor' | 'cliente'`. Permite cajas de proveedores recaudadores y de colaboradores.
21. **D-S58-21** ⭐ NUEVA: `datosBancarios[]` en ficha de Proveedor/Cliente/Colaborador/Empleado para datos pasivos (sin saldo). Promovibles a CuentaCaja con confirmación cuando se detecta primer movimiento.
22. **D-S58-22** ⭐ NUEVA: **TX-3 ELIMINADA.** Agentes recaudadores usan módulos existentes (Transferencias + Pagos a CC + Movimientos). Sin workflow nuevo.
23. **D-S58-23** ⭐ NUEVA: **`TarjetaCredito` soporta bi-moneda** vía `esBiMoneda: boolean`. Cuando es bi-moneda, acumula 2 saldos negativos (USD y PEN) simultáneamente. Workflow de pago permite saldar por moneda (sin diferencial) o consolidado (con diferencial). Caso típico: cuentas corrientes empresariales BCP/IBK/BBVA.

---

> **Última actualización:** 2026-04-28 (v2 final)
> **Próxima acción:** arrancar **S58 Fase 1** (FormModal v2 shell).
