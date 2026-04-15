# Pendientes de discusión — Sesión 38

**Fecha:** 2026-04-15
**Estado:** Por analizar/priorizar, NO ejecutar hasta acordar alcance

---

## TAREA-S38-001: Validación de cantidad máxima en recepción

**Observado en:** Recepción parcial de sub-orden (modal de Detalles de Orden)
**Ubicación:** Input numérico de cantidades recibidas por producto dentro de la sub-orden

**Problema:**
El input permite ingresar cualquier número sin límite superior. Ejemplo visto:
- Producto "Omega 3" tiene `3 /1` → el usuario puede escribir 3 cuando el máximo pedido era 1
- Esto puede generar inconsistencias: cantidadRecibida > cantidadPedida

**Comportamiento esperado:**
- `max` attribute en el input = cantidad pedida restante (cantidad - yaRecibido)
- Si el usuario intenta ingresar más, auto-corregir al máximo o mostrar error
- Considerar también: si hay cantDanada + cantPerdida + cantRecibida > cantPedida, bloquear

**Archivos involucrados (a confirmar):**
- `src/pages/OrdenesCompra/OrdenCompraDetalle.tsx` o `RecepcionParcialForm.tsx`
- El componente `<InputNumber>` usado en la tabla de productos de sub-orden

**Complejidad estimada:** Baja (1 archivo, ~10 líneas)

---

## TAREA-S38-002: Rework del sistema Stock / Inventario

**Observado en:** `/inventario` (pantalla con KPIs: Total unidades, En Origen, En Tránsito, En Perú, etc.)

**Problema reportado:**
El usuario ve "**2 en Perú**" pero no entiende por qué. Después de confirmar una OC con 11 unidades total y recibir todas, el desglose muestra:
- Total unidades: 11
- En Origen: 9 (82%)
- En Tránsito: 0
- En Perú: 2 (18%) ← ¿por qué?
- Reserv. Origen: 0
- Reserv. Perú: 0
- Vendidas: 0

**Hipótesis a investigar:**
1. ¿Las 2 unidades en Perú son de la recepción previa (antes del cleanup)? Revisar residuo de datos.
2. ¿El modelo de "En Perú" vs "En Origen" está bien definido? Una unidad debe estar en uno solo de los 5 estados.
3. ¿Qué estado tienen esas 2 unidades? (`disponible` con `pais=Peru`?)
4. Documentar formalmente el mapping: estado de unidad → bucket de KPI

**Pregunta de fondo:** ¿El pipeline visual de Unidades tiene que repensarse? Modelo actual:
- pedida → en_transito → disponible → reservada → asignada_venta → vendida
- Estados paralelos: danada, perdida, retenida_aduana

**Complejidad estimada:** Alta — puede requerir:
- Auditoría de cada unidad en BD (estado, pais, casillaActualId)
- Rediseño de KPIs del dashboard de Inventario
- Revisión del pipeline visual por producto (estilo "control tower")
- Consolidación de nomenclatura (Origen/Tránsito/Perú vs casilla.pais)

**Relacionado con:** PENDIENTE ya registrado en MEMORY.md → "Rediseno modulo Stock — pipeline visual por producto (estilo control tower moderno)"

---

## TAREA-S38-003: Rediseño UI/UX del registro de recepción (empresa moderna)

**Observado en:** Modal "Detalles de Orden" > recepción de sub-órdenes
**Estado actual:** Funcional pero visualmente básico — filas de inputs

**Pedido del usuario:**
> "Mejorar el sistema de registro de recepción algo más de empresa moderna, que cumpla con mejoras sustanciales en experiencia UI/UX."

**Ejes a explorar en el rediseño:**

1. **Flujo guiado vs editor plano**
   - Wizard paso a paso (escanear/seleccionar → confirmar cantidades → dañadas/perdidas → resumen)
   - vs. vista unificada con feedback visual

2. **Feedback visual inmediato**
   - Barra de progreso de recepción (X/Y unidades) — ya existe, mejorar
   - Badges de estado por producto (pendiente / parcial / completo / excedido)
   - Animaciones al recibir (check verde, confeti sutil al completar)

3. **Scanner integrado**
   - Si el negocio tiene escáner físico/móvil, permitir scan del código de barras que auto-incrementa el contador
   - Modal grande con cámara (usar `ModoRecepcion.tsx` existente)

4. **Gestión de excepciones (dañadas/perdidas)**
   - Más visual: iconos claros, motivo obligatorio, foto opcional
   - Aprobación con rol (solo gerente puede marcar >X% perdidas)

5. **Vista móvil-first**
   - La recepción suele hacerse en almacén con tablet/móvil
   - Inputs grandes, botones "pulgar-friendly", no dropdowns pequeños

6. **Historial visible en el mismo contexto**
   - Ya existe "Historial de recepciones" — hacerlo colapsado por defecto, expandible
   - Timeline visual con íconos por tipo de recepción

**Referencias de inspiración:**
- Cin7 / Zoho Inventory / Linnworks — apps ERP modernas
- Shopify POS — por su fluidez en transacciones rápidas

**Complejidad estimada:** Alta — puede ser su propia sesión de diseño
- Involucra a `frontend-design-specialist` + `erp-business-architect`
- Posible prototipo en Figma antes de codear

---

---

## TAREA-S38-004: Deuda arquitectural — doble fuente de verdad en saldos de cuenta

**Descubierto:** durante el testeo de pagos de OC — el dashboard de Tesorería mostraba saldo USD -$3,509 mientras las cuentas individuales en la misma página mostraban $0.

**Causa raíz:**
El modelo `CuentaCaja` mantiene **dos campos de saldo en paralelo**:
- `saldoActual: number` — usado por cuentas mono-moneda (lectura en `tesoreria.stats.service.ts` línea 276/278)
- `saldoUSD: number` / `saldoPEN: number` — usados por cuentas biMoneda + algunas vistas

La lógica de lectura bifurca:
```typescript
if (c.esBiMoneda) { total += c.saldoUSD }
else if (c.moneda === 'USD') { total += c.saldoActual }
```

Si una actualización toca solo uno de los campos (ej: `{ saldoUSD: X }` sin tocar `saldoActual`), los campos divergen y el sistema muestra saldos inconsistentes.

**Impacto:**
- KPIs del dashboard de Tesorería mienten
- Reportes financieros dan cifras contradictorias
- Scripts de mantenimiento o integraciones pueden corromper el estado

**Fix propuesto (refactor mayor):**

Opción A — campo único:
- Eliminar `saldoUSD` / `saldoPEN` del modelo
- Usar solo `saldoActual: number` + `moneda: 'USD' | 'PEN'`
- Para cuentas biMoneda: dos documentos separados (uno por moneda)

Opción B — denormalización con invariante:
- Mantener ambos campos
- Agregar computed setter/validator: al actualizar `saldoActual`, auto-sincronizar `saldoUSD`/`saldoPEN` en el mismo batch
- Implementar trigger Cloud Function que valide `saldoActual === saldoUSD || saldoPEN`
- Script `audit-saldos-consistencia.mjs` en CI/testing

Opción C (recomendada) — getter computed:
- Eliminar `saldoActual` como campo persistido
- Crear getter derivado: `get saldoActual() { return this.moneda === 'USD' ? this.saldoUSD : this.saldoPEN }`
- Toda escritura va a `saldoUSD`/`saldoPEN`
- Reemplaza ~N lugares donde se lee `saldoActual` por el getter

**Archivos afectados:**
- `src/types/tesoreria.types.ts` (modelo)
- `src/services/tesoreria.stats.service.ts` (lectores)
- `src/services/tesoreria.movimientos.service.ts` (escrituras)
- `src/services/cuentasCaja.service.ts`
- `src/store/cuentasCajaStore.ts`
- Cualquier UI que muestre saldo

**Complejidad estimada:** Media-Alta. Requiere:
- Migración de datos (si alguna cuenta tiene valores divergentes actuales)
- Test exhaustivo de movimientos de tesorería con cuentas biMoneda
- Posible refactor del modelo biMoneda (split en dos docs)

**Script diagnóstico ya disponible:** `scripts/sync-saldos.mjs` sincroniza ambos campos como hotfix.

**Relacionado con:** el bug secundario encontrado en el service al actualizar el saldo tras un pago (fix temporal con `sync-saldos.mjs`).

---

---

## TAREA-S38-005: Bug input decimales en PagoUnificadoForm

**Observado:** El input del monto no permite escribir ni punto ni coma manualmente.

**Causa raíz** (ya diagnosticada):
`PagoUnificadoForm.tsx:515` — el input es controlado con `number`:
```jsx
<input type="text" inputMode="decimal"
  value={montoOriginal || ''}
  onChange={e => setMontoOriginal(parseFloat(e.target.value) || 0)}
```

Al escribir `"80."`, `parseFloat` devuelve `80` (ignora el punto final). React re-renderiza con `value=80`, borrando el punto recién tecleado. Usuario queda bloqueado sin poder escribir decimales.

Mismo problema con coma: `parseFloat("80,")` = `80` → punto descartado.

**Comportamiento actual:** solo funciona si el valor llega pre-rellenado desde otro componente (ej: `setMontoOriginal(65.09)` programático, como el caso del auto-llenado del total de sub-orden).

**Fix propuesto:**
Separar estado string (para el input) del estado number (para cálculos):

```jsx
const [montoOriginalStr, setMontoOriginalStr] = useState('');
const montoOriginal = parseFloat(montoOriginalStr.replace(',', '.')) || 0;

<input type="text" inputMode="decimal"
  value={montoOriginalStr}
  onChange={e => {
    const v = e.target.value;
    if (/^\d*[.,]?\d*$/.test(v)) setMontoOriginalStr(v);
  }}
  onBlur={() => setMontoOriginalStr(montoOriginal.toString())} />
```

- Regex valida que solo contenga dígitos y un separador decimal (. o ,)
- Normaliza coma → punto para parseFloat
- Formatea en onBlur para limpiar visualmente

**Afecta a:** todos los modales de pago (ventas, compras, gastos, boletas, envíos) porque todos usan `PagoUnificadoForm`.

**Complejidad:** Baja — 1 archivo, ~15 líneas. **Urgente**, porque bloquea workflows reales de pago.

---

## TAREA-S38-006: Manejo de sobre-pago (overpayment) — adelanto / extorno

**Contexto:** Decisión del usuario (anotada en sesión):
> "Dependiendo del caso, puede ser crédito a favor, o en contra. Entendiendo que esto aplica a las ventas y a las compras."

**Estado actual:** No hay validación. Si pagas $80 por $65 pendientes:
- El pago se registra **completo: $80**
- Sub-orden marcada como `'pagado'`
- El $15 extra desaparece silenciosamente
- Tesorería descuenta $80, pero solo $65 estaban asignados a esta sub-orden

**Diseño propuesto:**

### Concepto: Cuenta Corriente por contraparte
Cada proveedor (compras) y cada cliente (ventas) tiene saldo en cuenta corriente:
- **Saldo a favor (adelanto)** → el usuario pagó/recibió de más, queda como crédito
- **Saldo en contra (por devolver/extornar)** → el usuario recibió/pagó de menos o hay un excedente reclamable

### Flujo al detectar sobre-pago

Al registrar pago de $80 cuando pendiente es $65:
1. Sistema detecta excedente ($15)
2. Modal contextual pregunta:
   - "El pago excede el pendiente en **$15**. ¿Cómo registrar el excedente?"
   - Opción A: **Crédito a favor del proveedor** (adelanto para próximas OCs). Crea movimiento en cuenta corriente.
   - Opción B: **Error de cálculo — re-editar monto**. Vuelve al form.
   - Opción C: **Extorno pendiente** (registrar reclamo de devolución al proveedor). Crea item en CxP negativo / reclamo de crédito.
3. Usuario elige → se registra con trazabilidad clara

### Aplicación simétrica Ventas ↔ Compras

| Caso | Compras (pago a proveedor) | Ventas (cobro de cliente) |
|------|----------------------------|---------------------------|
| Pago > pendiente | Adelanto a proveedor (crédito a favor) | Adelanto de cliente (crédito a favor) |
| Pago < pendiente | CxP (saldo pendiente) | CxC (saldo por cobrar) |
| Error de registro | Revertir | Revertir |
| Devolución negociada | Extorno (proveedor nos devuelve) | Extorno (le devolvemos al cliente) |

### Modelo de datos propuesto
```typescript
interface CuentaCorriente {
  id: string;
  contraparteId: string;          // proveedorId o clienteId
  contraparteTipo: 'proveedor' | 'cliente';
  saldoUSD: number;               // positivo = a favor nuestro, negativo = a favor de ellos
  saldoPEN: number;
  movimientos: MovimientoCC[];    // historial
}

interface MovimientoCC {
  id: string;
  fecha: Timestamp;
  tipo: 'adelanto' | 'aplicacion' | 'extorno_registrado' | 'extorno_ejecutado';
  monto: number;
  moneda: 'USD' | 'PEN';
  origenId: string;               // pagoId / ventaId / ocId que generó esto
  aplicadoAId?: string;           // si ya se aplicó a una OC/venta
}
```

### UI impacto
- Módulo nuevo: **Cuentas Corrientes** en el sidebar
- Dashboard por proveedor/cliente: saldo actual + historial de adelantos/extornos
- Al crear nueva OC/venta: si proveedor/cliente tiene saldo a favor, ofrecer aplicarlo
- Alertas en Dashboard: "Tienes $X en adelantos sin aplicar con proveedor Y"

**Complejidad estimada:** Alta — requiere:
- Modelo nuevo (`cuentaCorriente`)
- Integración con flujos de pago existentes
- UI de gestión de cuenta corriente
- Reportes (aging de adelantos)
- Posible integración con contabilidad (cuenta "Anticipos a proveedores" / "Anticipos de clientes")

**Complejidad estimada:** Alta — sesión dedicada.

**Relacionado con:** `financial-credit-manager` agent (crédito y cobranza), `accounting-manager` (asientos de adelantos).

---

---

## TAREA-S38-007: Doble timestamp visible en historial de pagos (real + registro)

**Observado:** Los pagos en el historial aparecen en orden arbitrario (orden de inserción al array). No se ve cuándo se creó el registro vs. cuándo fue el pago real.

**Decisión del usuario:**
> "Debería crear la estampa de cuando se creó, y también si por A o B se registra retroactivamente."

Esto es el estándar contable: **ambas fechas son auditables**.

### Estado actual del modelo
El tipo `PagoOrdenCompra` ya tiene ambos campos:
```typescript
fecha: Timestamp;           // Fecha real del pago (elegible, puede ser retroactiva)
fechaRegistro: Timestamp;   // Cuándo se registró en el sistema (automático)
```

Igual estructura en `Pago` de ventas/gastos/envíos.

### Problema actual en UI
`PagoUnificadoForm.tsx:332` renderiza `pagosAnteriores.map(...)` **sin sort** y **solo muestra `p.fecha`**. No se ve `fechaRegistro` en ningún lado.

### Diseño propuesto

#### 1. Render de cada pago en el historial
```
┌─────────────────────────────────────────────────────┐
│ 12/abr    Transferencia   Cta Personal USD   $65.09 │
│ 🕐 Registrado: 15/abr 14:32   por Josselin Gambini  │
└─────────────────────────────────────────────────────┘
```

- Primera línea: fecha real + método + cuenta + monto
- Segunda línea (más chica/gris): fecha de registro + usuario
- **Badge 'Retroactivo'** si `fechaRegistro - fecha > 24h`:
  ```
  12/abr   [RETROACTIVO]  Transferencia   $65.09
  Registrado: 15/abr por Josselin — 3 días después
  ```

#### 2. Ordenamiento
Default: por `fecha` (real) descendente — orden contable estándar.
Permitir toggle:
- "Por fecha real" (por defecto)
- "Por fecha de registro" (útil para auditoría: ¿qué se capturó últimamente?)

#### 3. Alertas de auditoría
- Si hay pagos retroactivos sin nota explicativa → warning en el detalle
- Si hay gap grande entre `fecha` y `fechaRegistro` → pedir motivo al registrar
- Reporte: "Pagos registrados con más de N días de retraso" para control interno

### Aplicación simétrica
Este patrón aplica a TODAS las entidades con timestamps duales:
- Pagos de OC (`ordenCompra.pagos.service`)
- Pagos de ventas (`venta.pagos.service`)
- Pagos de gastos
- Pagos de envíos a colaboradores
- Movimientos de tesorería
- Conversiones cambiarias
- Boletas, adelantos

Idealmente crear un componente reutilizable `TimestampDoble` que renderice el patrón y se use en todos los lugares.

### Modelo de datos adicional (opcional, para auditoría avanzada)
```typescript
interface PagoOrdenCompra {
  fecha: Timestamp;                  // Ya existe — fecha real
  fechaRegistro: Timestamp;          // Ya existe — fecha de creación

  // Nuevos (opcionales) — para registros retroactivos
  esRetroactivo?: boolean;           // derivado: fechaRegistro - fecha > umbral
  motivoRetroactivo?: string;        // "error de sistema", "captura atrasada", etc.
  registradoPor: string;             // ya existe — userId que lo registró
  editadoPor?: string;               // si se edita después de crearlo
  fechaEdicion?: Timestamp;
  historialEdiciones?: Array<{       // si el pago se modifica: auditoría completa
    fecha: Timestamp;
    usuario: string;
    camposCambiados: Record<string, { antes: any; despues: any }>;
  }>;
}
```

**Complejidad estimada:** Media
- Refactor del render en PagoUnificadoForm (y similares)
- Nuevo componente `TimestampDoble`
- Modal opcional para motivo al registrar retroactivamente
- Badge visual `RETROACTIVO`
- Sort con toggle
- Reportes de auditoría (sesión aparte)

**Relacionado con:** `accounting-manager`, `system-auditor`, `legal-compliance-consultant` (trazabilidad regulatoria).

---

---

## TAREA-S38-008: Bug CRÍTICO — `cargosOC[]` no se suma al total al crear OC

**Severidad:** 🔴 Crítico — impacta totales persistidos, CTRU, pagos, contabilidad

**Observado:** Al crear OC SKC DDP con shipping $24:
- Wizard muestra total $109.80 ($85.80 + $24)
- OC guardada muestra total $85.80 (sin shipping)

**Causa raíz:**
`src/services/ordenCompra.crud.service.ts:157`:
```typescript
const totalUSD = subtotalUSD + impuesto + gastosEnvio + otrosGastos - descuento;
```

- **Solo usa campos legacy:** `impuestoCompraUSD`, `gastosEnvioUSD`, `otrosGastosUSD`, `descuentoUSD`
- **Ignora `cargosOC[]`**, `descuentosOC[]`, `impuestosOC[]` (estructura nueva de S35)
- El wizard V2 envía cargos como array, el service los descarta del cálculo

**Impacto en cadena:**
- El CTRU se calcula con un total incorrecto → costo por unidad subestimado
- El pago al proveedor se dimensiona con total bajo → pagas menos de lo debido
- Reportes financieros incorrectos
- Diferencias cambiarias mal calculadas

**Fix:**
```typescript
// Sumar cargos/descuentos/impuestos estructurados (v2) SI existen
const totalCargos = (data.cargosOC || []).reduce((s, c) => s + (c.montoUSD || 0), 0);
const totalDescuentosOC = (data.descuentosOC || []).reduce((s, d) => s + (d.montoUSD || 0), 0);
const totalImpuestosOC = (data.impuestosOC || []).reduce((s, i) => s + (i.montoUSD || 0), 0);

// Legacy fallback (retrocompat)
const impuestoLegacy = data.impuestoCompraUSD ?? data.impuestoUSD ?? 0;
const gastosEnvioLegacy = data.costoEnvioProveedorUSD ?? data.gastosEnvioUSD ?? 0;
const otrosGastosLegacy = data.otrosGastosCompraUSD ?? data.otrosGastosUSD ?? 0;
const descuentoLegacy = data.descuentoUSD || 0;

// Total: usar v2 si hay, legacy si no
const totalUSD = subtotalUSD
  + Math.max(totalCargos, gastosEnvioLegacy + otrosGastosLegacy)
  + Math.max(totalImpuestosOC, impuestoLegacy)
  - Math.max(totalDescuentosOC, descuentoLegacy);
```

O mejor: aceptar el `totalUSD` calculado del wizard y persistirlo tal cual (confiar en el cliente si viene correcto).

**También revisar:**
- Función `update()` línea 349-377 tiene el mismo bug
- `confirmarOC()` — puede heredar el total mal calculado al crear el Envío T1

**Complejidad:** Baja-Media — 2 funciones (create, update), cuidado con backward-compat si alguna OC guardada usa solo legacy.

**Bloquea:** pruebas de CTRU, pagos completos, cualquier OC con cargos/shipping.

---

## TAREA-S38-009: DDP directo sin casilla (ya conocido, escalar a prioritario)

**Ya documentado en MEMORY.md** como "PENDIENTE: Envio DDP Directo". Escalando a discusión formal.

**Observado:** Al crear OC SKC con `modoEntregaDetallado='ddp_directo'` y confirmar:
> Error: "Esta OC no tiene casilla destino asignada. Edita la OC y selecciona un viajero/courier."

**Por qué es un bug:** En DDP (Delivered Duty Paid), el proveedor entrega directo a Perú. **No hay casilla intermedia en país origen** — el envío sale de proveedor y llega a destino final.

**Flujo esperado en DDP:**
1. OC en `borrador` sin `casillaDestinoId`
2. Al confirmar:
   - **NO** pedir casilla
   - Crear Envío directo: origen=proveedor, destino=Perú (cliente/almacén local)
   - `tipoEnvio='internacional_peru'` (no hay T1+T2, es único)
   - `courier='externo'` con el proveedor como responsable
   - Nace en `borrador` (el proveedor debe confirmar despacho después)

**Código a modificar:**

1. **Wizard OCWizardV2.tsx** — al armar formData, si `modoEntregaDetallado === 'ddp_directo'`:
   ```typescript
   almacenDestino: config.modoEntregaDetallado === 'ddp_directo'
     ? 'PERU_DIRECTO'   // sentinel especial
     : state.configLogistica.casillaDestinoId || '',
   ```

2. **ordenCompra.recepcion.service.ts** — reconocer sentinel `PERU_DIRECTO`:
   ```typescript
   if (orden.almacenDestino === 'PERU_DIRECTO') {
     almacenInfo = { nombre: 'Entrega directa a Perú (DDP)', pais: 'Peru' };
   } else {
     // casilla / almacén lookup...
   }
   ```

3. **confirmarOC** — crear Envío con la forma DDP:
   ```typescript
   const envioData = {
     tipoEnvio: 'internacional_peru',
     paisOrigen: oc.paisOrigen,
     paisDestino: 'Peru',
     origenCasillaId: null,          // no hay origen casilla, sale de proveedor
     destinoCasillaId: null,          // destino es cliente/almacén perú
     destinoCasillaNombre: 'Entrega directa a Perú',
     courierType: 'externo',
     responsable: 'proveedor',
     estado: 'borrador',
     esDDP: true,                     // flag para lógica especial
     ...
   };
   ```

4. **OrdenCompraCard.tsx** — pipeline mostrar estado DDP diferente (sin casilla en transit):
   - Pipeline: Pedida → En tránsito (proveedor→Perú) → Recibida
   - Sin la fase "En casilla" intermedia

**Complejidad:** Media
- Lógica del Envío especial (rama DDP vs consolidación)
- UI del pipeline para mostrar fases correctas
- Tests de todos los modos: ddp_directo, via_viajero, via_courier, recojo_propio

**Bloquea:** cualquier OC de skincare (o cualquier categoría) que use modelo DDP.

---

---

## TAREA-S38-012: Rediseño módulo /envios con gestión completa de incidencias

**Visión del usuario:**
> "En este módulo de envíos declaro si hubo problemas con aduanas, gastos extra, o si la mercadería entra a pérdida, o llega alguna dañada"

**Estado actual:**
- El modelo `Envio` ya tiene `incidencias[]` y `costoLanded[]`
- La UI no expone esos campos con la fluidez que necesita

**Diseño propuesto (módulo dedicado):**

### Vista principal de un envío
```
┌─────────────────────────────────────────────┐
│ ENV-2026-003 — En Tránsito                  │
│ Origen: Asian Beauty Wholesale → Lima       │
│ Courier: DHL · Tracking: 1Z999...           │
│ Sale: 15/abr · Llegada estimada: 28/abr     │
├─────────────────────────────────────────────┤
│ [Línea de tiempo visual del envío]          │
│   ✓ Despachado    [Aduanas]    [Recibido]   │
├─────────────────────────────────────────────┤
│ ▼ Productos (16 unidades)                   │
│   • Cica Sun Stick × 8  ← marcar problema   │
│   • Cotton Sun Stick × 8                    │
├─────────────────────────────────────────────┤
│ ▼ Costos landed                             │
│   • Shipping (de OC) ........... $25.00     │
│   • Aduanas .................... + agregar  │
│   • Almacenaje ................. + agregar  │
├─────────────────────────────────────────────┤
│ ▼ Incidencias                               │
│   (vacío) + Reportar problema               │
└─────────────────────────────────────────────┘
```

### Acciones del envío
1. **"Reportar incidencia"** — modal con:
   - Tipo: aduanas / daño / pérdida / robo / retraso / otro
   - Productos afectados (multi-select)
   - Cantidad afectada
   - Descripción
   - Foto (opcional, Storage)
   - Costo asociado (opcional)

2. **"Agregar costo landed"** — modal con:
   - Categoría: aduanas / almacenaje / handling / seguro / impuestos / otro
   - Monto USD/PEN
   - Método prorrateo: por valor / por peso / por cantidad
   - Pagado por: nosotros / proveedor

3. **"Recibir parcial"** — modal con:
   - Cantidad recibida por producto
   - Cantidad dañada / perdida / faltante
   - Casilla destino (puede diferir si DDP llegó a otra)
   - Fotos (opcional)
   - Triggerea: actualización de unidades + cálculo CTRU + sync OC a recibida_parcial/recibida

### KPIs del módulo
- Envíos en tránsito (con días desde despacho)
- Envíos retrasados (días estimados vs reales)
- Tasa de incidencias por courier
- Tasa de mermas por proveedor
- Costo promedio landed por kg / unidad

### Integración con módulos
- Al marcar dañada → unidad pasa a estado `danada` + posible asiento contable de pérdida
- Al cerrar costos landed → recálculo automático CTRU del lote
- Al recibir → triggerea OC a `recibida` (cierre del ciclo)

### Estilo UI/UX
- Inspirado en Cin7/Linnworks/Zoho Inventory
- Vista timeline + tabs para detalles
- Mobile-first (almacén suele usar tablet)
- Notificaciones push cuando llega tracking update (futuro)

**Complejidad:** Alta — Sesión dedicada (4-6h)
- Rediseño de Envio detail view
- Modales nuevos para incidencias y costos
- Integración con storage para fotos
- Recálculo automático CTRU al cambiar costos
- Tests de cierre ciclo Envío → OC

**Relacionado con:** S38-002 (rework Stock), S38-003 (UX recepción), `erp-business-architect`, `frontend-design-specialist`.

---

---

## TAREA-S38-013: 🚨 CRÍTICA — Limpieza TypeScript + activación de gates

**Severidad:** Crítica (causa raíz de todos los bugs runtime tipo "n.indexOf is not a function")

**Estado actual:**
- `npx tsc -b` arroja **223 errores TypeScript** pre-existentes
- El build de producción usa `vite build` directo (no chequea tipos a profundidad)
- **TypeScript dejó de funcionar como red de seguridad** — los devs no distinguen errores nuevos de los pre-existentes
- Sin pre-commit hook ni CI gate

**Consecuencia documentada esta sesión:**

Bugs que TypeScript debió haber atrapado en compile-time pero llegaron a runtime:

| Bug | Origen | TypeScript debió flagear |
|---|---|---|
| S38-005 (decimales) | parseFloat sobre input de tipo number controlado | mismatch number vs string |
| S38-008 (cargosOC no se suma) | service usa modelo viejo, wizard usa nuevo | mismatch de shape |
| S38-009 (DDP sin casilla) | wizard envía '', service esperaba ID válido | sentinel no tipado |
| S38-011 (n.indexOf is not a function) | caller pasa objeto, service espera string | TS2345 clásico |

**Diagnóstico de la causa raíz:**
S37 fue un refactor de 82 archivos. Se cambiaron firmas de servicios, shapes de datos, nombres de campos. Los callers no se actualizaron consistentemente. TypeScript flageó los errores pero quedaron mezclados con los 223 pre-existentes → invisibles → llegaron a runtime.

**Plan de remediación (sesión dedicada, 4-6h):**

### Fase 1 — Triaje de los 223 errores
```
npx tsc -b 2>&1 | grep "error TS" | sort | uniq -c | sort -rn
```
Categorizar:
- **Bugs reales** (firmas rotas, mismatches) — ~30%
- **Falsos positivos** (legacy fields que existen en runtime pero no en tipo) — ~50%
- **TypeScript estricto innecesario** (any pasado donde se necesita) — ~20%

### Fase 2 — Limpieza por archivo
Priorizar por impacto:
1. Servicios (afectan toda la app)
2. Stores (afectan UI global)
3. Pages activas (UI principal)
4. Componentes legacy (menor prioridad)

Por cada error:
- Si es bug real → arreglar el código (ej: actualizar caller)
- Si es legacy field → agregar opcional o `as any` con comentario `// LEGACY`
- Si es restricción innecesaria → suavizar tipo

### Fase 3 — Gates automáticos
- Pre-commit hook con `husky` + `lint-staged`:
  ```json
  "lint-staged": {
    "*.{ts,tsx}": ["bash -c 'npx tsc --noEmit -p .'"]
  }
  ```
- CI: GitHub Action que corre `npx tsc -b` en cada PR y bloquea merge si falla
- Documentar en CLAUDE.md: "TypeScript es autoridad. 0 errores. Si hay duda, no hay duda."

### Fase 4 — Auditoría retroactiva post-S37
Ya con TS confiable, buscar más mismatches latentes:
- Servicios cuya firma cambió en S33-S37
- Callers que no se actualizaron
- Tests E2E mínimos para flujos críticos (crear OC → confirmar → recibir → pagar)

**Bloqueante para producción:** SÍ. No se puede hacer go-live con 223 errores TypeScript activos. Es un riesgo legal/operativo (cualquier deploy puede meter un bug runtime que toque dinero).

**Complejidad:** Alta — 4-6h focalizadas

**Relacionado con:** todos los bugs S38-005 al S38-011, sesión S37, ronda 2 auditoría S36

---

## Esperando más tareas

El usuario mencionó: *"mientras que te voy subiendo en otro chat mas tareas"*
Este documento se extenderá con nuevos items a medida que lleguen.
