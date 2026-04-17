# Especificación Rework S40 — UX/UI Módulos Compras + Envíos

> **Documento de handoff entre sesiones.**
> Al retomar, leer este documento COMPLETO antes de cualquier ejecución de código.
> Consolida todas las decisiones, contexto, pendientes y arquitectura acordada.

**Fecha creación**: 2026-04-17
**Sesión de origen**: S40 (continuación post-cleanup)
**Mockup maestro**: `docs/mockups/rework-maestro-s40.html`
**Estado**: ⏸️ **Pre-implementación** — esperando resolución de pendientes antes de codear

---

## 📋 Índice

1. [Objetivo y alcance del rework](#1-objetivo-y-alcance-del-rework)
2. [Los 5 entregables](#2-los-5-entregables)
3. [Decisiones cerradas](#3-decisiones-cerradas)
4. [Arquitectura crítica — 2 capas de cargos](#4-arquitectura-crítica--2-capas-de-cargos)
5. [Pipeline OC vs Envío (regla de derivación)](#5-pipeline-oc-vs-envío)
6. [Los 3 tramos de ruta](#6-los-3-tramos-de-ruta)
7. [Deudor alternativo (Tramo 1) y CxP Tramo 3](#7-deudor-alternativo-y-cxp-tramo-3)
8. [Sub-órdenes — ciclo completo](#8-sub-órdenes)
9. [KPIs y cálculos](#9-kpis-y-cálculos)
10. [Autoguardado del wizard](#10-autoguardado)
11. [Edge cases y validaciones](#11-edge-cases)
12. [Puntos pendientes por cerrar](#12-pendientes)
13. [Tipos TypeScript a modificar](#13-tipos-typescript)
14. [Plan de implementación](#14-plan-de-implementación)
15. [Referencias al código existente](#15-referencias)

---

## 1. Objetivo y alcance del rework

### 1.1 Contexto

Durante S40 se completó el Plan Logística Enterprise (Bloques A-F) + cleanup de datos. Sin embargo, los **flujos de creación y las vistas principales** (`/compras`, `/envios`) no fueron modernizados a nivel UX/UI. La app actual tiene:

- Wizards de creación con UI anticuada (stepper plano, dropdowns ciegos, sin preview panel)
- Vista `/compras` con pipeline que mezcla estados comerciales y logísticos
- Vista `/envios` sin consistencia visual con el resto del sistema
- Modales de detalle densos sin jerarquía clara
- Terminología legacy persistente ("viajero" en vez de "colaborador", etc.)

### 1.2 Objetivo

**Modernizar la experiencia UX/UI completa del circuito OC ↔ Envío** con:
- Wizards con stepper moderno + preview panel lateral + EntityPicker rico
- Vistas principales con KPIs enriquecidos + pipelines coherentes + cards modernas
- Terminología alineada a la taxonomía S37/S40 (colaborador, casilla, etc.)
- Consistencia visual transversal (descripción rica de productos, badges, iconografía)
- Separación clara entre plano comercial (OC) y plano logístico (Envío)

### 1.3 NO alcance de este rework

- Lógica de recepción (ya rediseñada en Bloques A-C)
- Gestión de incidencias (Bloque C)
- Reclamos (Bloque B)
- Tabs internos `/envios` (Operaciones/Incidencias/Reclamos/Costos/Rendimiento — Bloque D)
- Alertas operativas (Bloque F)
- `PagoUnificadoForm` adaptaciones (reservado para después)
- Responsive mobile/tablet (pulido posterior)

---

## 2. Los 5 entregables

| # | Entregable | Ruta / Componente | Estado mockup |
|---|---|---|---|
| 1 | Vista Compras modernizada | `/compras` → `Compras.tsx` | ✅ en mockup |
| 2 | Wizard Nueva OC | `OCFormWizard` (5 pasos) | ✅ en mockup |
| 3 | Vista Envíos modernizada | `/envios` → `Envios.tsx` | ✅ en mockup |
| 4 | Wizard Nuevo Envío | `CreateEnvioModal` (3 pasos, Opción A) | ✅ en mockup |
| 5 | Detalle Envío modernizado | `EnvioDetailModal` | ✅ en mockup |

**Infraestructura reutilizable a crear** (Ola 0):
- `src/design-system/components/WizardShell.tsx` — stepper + preview panel + footer
- `src/design-system/components/EntityPicker.tsx` — selector rico con search + cards
- `src/design-system/components/RouteVisual.tsx` — visualización A→B→C
- `src/design-system/components/DynamicChargesSection.tsx` — cargos/descuentos/impuestos agregables
- `src/design-system/components/ProductoDisplay.tsx` — card de producto con descripción rica vía `getDescripcionProducto()`

**Herramienta adicional solicitada**:
- Cleanup de borradores wizard (sección administrativa) — ver §10.3

---

## 3. Decisiones cerradas

Todas confirmadas explícitamente por el usuario durante la sesión.

### 3.1 Envíos manuales — Opción A

Cuando el usuario aprieta "+ Nuevo Envío" en `/envios`, **solo puede crear**:
- Entre casillas origen (ej. Angie → Jose en USA)
- Casilla USA/CN → Perú

**NO** puede crear manualmente:
- Proveedor → Casilla (siempre nace automático al confirmar OC)
- Proveedor → DDP (siempre nace automático al confirmar OC)

### 3.2 Sin datos que no existen al despachar

**NO capturar** en el momento de crear el envío:
- Lote
- Vencimiento
- Peso (solo se muestra si el producto lo tiene pre-registrado)
- Fechas de salida/llegada estimadas

**Sí capturar después en la recepción en Perú**:
- Lote (formato mes/año)
- Vencimiento (formato mes/año)
- Gastos aduana
- Dañadas/perdidas/retenidas

### 3.3 Colaborador es opcional, sin fechas de viaje

- Al crear envío, el colaborador es **opcional** ("sin asignar, decidir después")
- No se pide fecha de viaje (los colaboradores no anuncian fechas — avisan cuando llegan)
- Dropdown agrupado: `─── Couriers externos ───` / `─── Viajeros ───`
- Métrica mostrada: `Angie Price — 47 envíos previos` (no fechas)

**Excepción**: confirmar OC sin colaborador asignado al envío → **no se permite** (ver §11)

### 3.4 Descripción rica de productos (consistente)

Usar `getDescripcionProducto(producto)` de `src/utils/producto.helpers.ts` en **toda aparición de producto**:
- Wizard OC paso 2
- Wizard Envío paso 2
- Wizard Envío paso 3 (resumen)
- Detalle Envío (tabla productos)
- Cards OC con resumen de productos

Formato:
- SUP: `Softgels · 1200 mg · 120 und · Neutral`
- SKC: `50 ml · Centella Asiática · Gel · SPF50 ++++`

**Excepción**: en preview panels laterales muy compactos se puede omitir (espacio limitado).

### 3.5 Sin sugerencias automáticas

Eliminadas las recomendaciones tipo *"Amazon suele despachar a CAS-004"*. El usuario elige directamente sin ruido.

### 3.6 Alertas operativas aplican igual

Las alertas del Bloque F (aduana >10d, incidencias >14d, reclamos >21d, fill rate <70%) aplican **igual** a envíos manuales y automáticos. El sistema no distingue por origen.

### 3.7 Ordenamiento default de cards

**Por fecha de creación descendente** (más reciente primero) en:
- Cards OC en Vista Compras
- Cards Envío en Vista Envíos
- Listados en modales

---

## 4. Arquitectura crítica — 2 capas de cargos

> ⚠️ Punto más crítico del rework. Corrige una confusión detectada durante la sesión.

Los "cargos" existen en **2 planos distintos** que **NO deben mezclarse**:

### 4.1 Capa 1 — Cargos comerciales (plano OC / sub-orden)

**Quién los cobra**: el proveedor que te vende el producto (Amazon, Asian Beauty Wholesale, etc.)

**Dónde viven**: en la OC (si no hay sub-órdenes) o en cada sub-orden (si las hay).

**Ejemplos**:
- Shipping que el proveedor te cobra por despachar
- Handling fee
- Tax / sales tax (USA)
- Insurance (si contrataste)
- Descuentos: Subscribe & Save, cupón, rebate
- Impuestos (porcentaje o monto fijo)

**Estructura**:
- Si OC sin sub-órdenes → campos `cargosOC[] + descuentosOC[] + impuestosOC[]` en OC
- Si OC con sub-órdenes → cada sub-orden tiene sus propios `cargos + descuentos + impuestos`
- Los campos a nivel OC **se bloquean** cuando hay sub-órdenes (no se mezclan)

**Ejemplo real** (clarificación del usuario):
```
Sub-orden A (de una OC global):
  Productos: Omega 3 $10 x2 · Resveratrol $10 x2 · B12 $5 x4 = $60
  Cargos adicionales:
    - Envío internacional: $6
  Descuentos:
    - Suscripción: $5
  Impuestos: 3% ($1.80)
  TOTAL sub-orden A = $62.80
```

Cada sub-orden es una **mini-OC completa**, con productos + cargos + descuentos + impuestos propios.

### 4.2 Capa 2 — Costos landed (plano Envío)

**Quién los cobra**: terceros en el tránsito logístico (viajero, courier, agencia, taxi local).

**Dónde viven**: en el `Envio`, campo `costosLanded[]`.

**Ejemplos**:
- Flete internacional que cobra el viajero/courier
- Gastos de aduana / liberación / brokerage
- Recojo local en Perú (Luis te trae del almacén de la agencia)
- Almacenaje temporal en casilla

**Ya existe** en el modelo actual (`Envio.costosLanded: CostoLanded[]`).

### 4.3 Cómo se suman al CTRU de cada unidad

```
CTRU unidad = costoProducto (USD → PEN)
            + cargos comerciales prorrateados (de OC o sub-orden)
            - descuentos comerciales prorrateados
            + impuestos comerciales prorrateados
            + costos landed del envío prorrateados
```

Las 2 capas **se suman**, pero se calculan y se guardan separadas para:
1. Reportes (ver qué proporción es costo del proveedor vs costo logístico)
2. Contabilidad (cuentas contables distintas)
3. Auditoría (quién cobró qué, cuándo)

### 4.4 ⚠️ Bug potencial detectado en código actual

La función `heredarCargos()` en `ordenCompra.crud.service.ts:759-774` actualmente **duplica** los `cargosOC[]` en cada envío cuando la OC tiene sub-órdenes. Esto infla el CTRU incorrectamente.

**Plan**:
- En el rework, los `cargosOC[]` se bloquean cuando hay sub-órdenes
- Cada sub-orden define sus propios cargos
- La función `heredarCargos` se deprecia o se refactoriza
- Los costos landed del envío (capa 2) quedan independientes

**⚠️ Pendiente de auditar**: migrar data histórica que pudiera estar afectada por el bug.

---

## 5. Pipeline OC vs Envío

### 5.1 Pipeline OC (4 estados — Opción B)

```
Borrador → Confirmada → En Despacho → Completada
```

### 5.2 Pipeline Envío (4 estados)

```
Borrador → Confirmado → En Tránsito → Recibida (parcial/completa)
```

### 5.3 Regla de derivación OC ↔ Envío

"En Despacho" en OC es un **estado derivado** basado en sus envíos:

| Estado OC | Condición |
|---|---|
| **Borrador** | OC no confirmada aún |
| **Confirmada** | OC confirmada, pero aún sin envíos o todos en borrador |
| **En Despacho** | Al menos 1 envío asociado está en `confirmado`, `en_transito` o `recibida_parcial` |
| **Completada** | TODOS los envíos asociados están en `recibida_completa` (o cancelada) |

**Sub-órdenes afectan la derivación**:
- OC con 3 sub-órdenes → 3 envíos
- Si 1 envío está en tránsito y los otros 2 en borrador → OC está "En Despacho"
- Si 3 envíos están recibida_completa → OC está "Completada"

### 5.4 Términos distintos, modelos distintos

- OC "En Despacho" = tiene actividad logística en curso (plano comercial)
- Envío "En Tránsito" = mercadería moviéndose físicamente (plano logístico)

El usuario ve el pipeline OC simplificado + badges laterales con detalle de envíos.

---

## 6. Los 3 tramos de ruta

Cada OC (o sub-orden) define una ruta logística en 3 tramos. Esta estructura ya existe parcialmente en `WizardStepEntrega.tsx` pero se moderniza UX.

### 6.1 Tramo 1 — Salida del proveedor

| Opción | Descripción |
|---|---|
| **Proveedor envía** | El proveedor despacha a la casilla (o directo a Perú si DDP) |
| **Recojo en origen** | Un colaborador va por la mercadería al proveedor |

**Si es "Proveedor envía"**:
- Tipo shipping: `internacional` (hasta casilla USA) o `local` (ya está en USA)
- ¿Costo incluido?: `Ya incluido en precio` o `Se paga aparte (va a Cargos)`

**Si es "Recojo en origen"** → activa patrón de **deudor alternativo** (ver §7)

### 6.2 Tramo 2 — Cruce a Perú

| Opción | Descripción |
|---|---|
| **Vía viajero** | Colaborador transporta la mercadería |
| **Courier internacional** | FedEx, DHL, UPS, etc. |
| **DDP directo** | Sin casilla intermedia — proveedor entrega directo a Perú |

Colaborador/courier **opcional** al crear. Se puede dejar "Sin asignar, decidir después".

**Sin patrón de deudor alternativo** en este tramo. El pago al viajero siempre es directo al colaborador (solo varía el momento, no el destinatario).

### 6.3 Tramo 3 — Última milla en Perú

| Opción | Realidad | Efecto contable |
|---|---|---|
| **Yo recojo** | Voy personalmente, pago taxi/pasajes | Gasto directo de movilidad |
| **Colaborador local** | Proveedor registrado de la red logística (Luis Torres, etc.) | CxP con él (patrón deudor) |
| **Viajero absorbe** | El viajero internacional entrega puerta a puerta | Sin gasto adicional (ya pagado en Tramo 2) — **depende del viajero** |

**Si es "Colaborador local"** → activa patrón **CxP con colaborador** (ver §7.2)

---

## 7. Deudor alternativo y CxP Tramo 3

### 7.1 Tramo 1 — Cuando colaborador recoge y paga al proveedor

**Escenario**: Angie recoge el paquete en el almacén de Amazon y paga ella de su bolsillo ($195). Luego, la deuda es contigo, no con Amazon.

**Pregunta visible en el wizard**: *"¿Quién paga los productos al proveedor?"*

| Opción | Efecto |
|---|---|
| **Yo pago al proveedor** | Flujo normal. `OC.deudorId = proveedorId` |
| **Angie paga (le debo)** | `OC.deudorId = colaboradorId`, `OC.deudorTipo = 'colaborador'` |

**Efectos completos confirmados por el usuario**:
- `PagoUnificadoForm` cambia destinatario visible a "Pagar a Angie" (no a Amazon)
- Reporte de CxP muestra la deuda bajo el nombre de Angie
- **NO involucra tesorería directamente** — es una "incidencia externa" que se asienta sin movimiento de caja (Costco/Amazon ya fue pagado, pero no por ti; fue por Angie)
- Al pagar a Angie, se liquida la CxP con ella (PagoUnificadoForm destino=colaborador)

### 7.2 Tramo 3 — Cuando colaborador local adelanta pago de última milla

**Escenario**: Luis va a la agencia en Lima, paga S/ 87 (agencia + taxi + propina), trae la mercadería a tu almacén.

**Pregunta visible en el wizard**: *"¿Quién paga el transporte local?"*

| Opción | Efecto |
|---|---|
| **Yo pago al recoger** | Gasto directo cuando llega la mercadería |
| **Luis adelanta (CxP)** | Al recibir físicamente, se crea CxP con Luis |

**Flujo confirmado por el usuario**:
1. Al crear OC/Envío marcas "Luis adelanta" con estimado S/ 80
2. Cuando Luis llega → registras recepción → confirmas monto real (ej. S/ 87)
3. Al momento de recibir: se crea la CxP con Luis por S/ 87
4. **Se registra también como `CostoLanded` tipo "Recojo local Perú"** en el envío (capa 2 landed)
5. Se prorratea entre las N unidades del envío → se suma al CTRU de cada unidad
6. Liquidación: pago normal a colaborador vía `PagoUnificadoForm` (destino=colaborador)

---

## 8. Sub-órdenes

### 8.1 Cuándo se crean

**Post-confirmación de OC regular**. Razón: plataformas como Amazon, Asian Beauty Wholesale separan el carrito de compra en tandas independientes (por disponibilidad de stock, fechas de envío, origen del inventario). Esto **solo se sabe después** de confirmar la compra en el proveedor.

### 8.2 Estructura (ya existe en código)

Cada sub-orden es una **mini-OC completa** con:
- Su propio subset de productos del carrito original
- Sus propios cargos comerciales (shipping, tax, descuento, impuesto)
- Su propio ciclo de vida (estado, estadoPago)
- Su propia referencia de proveedor
- Su propio envío T1 (`envioId`, `envioNumero`)
- Su propio tracking/courier

**Interface en `src/types/ordenCompra.types.ts:498-518`**:
```ts
export interface SubOrdenCompra {
  id: string;                          // SUB-{ocId}-{secuencial}
  referenciaProveedor: string;
  productos: ProductoOrden[];
  totalUSD: number;
  descuentoUSD?: number;
  shippingUSD?: number;
  impuestoUSD?: number;
  subtotalProductosUSD?: number;
  estado?: 'borrador' | 'en_transito' | 'recibida';
  estadoPago?: 'pendiente' | 'parcial' | 'pagado';
  numeroTracking?: string;
  courier?: string;
  fechaEnvio?: any;
  fechaRecepcion?: any;
  fechaPago?: any;
  envioId?: string;
  envioNumero?: string;
}
```

### 8.3 Entrega parcial

Cada sub-orden puede recibirse por separado (puede ser entrega completa, parcial, con incidencias). El modelo de recepción actual (RecepcionModal) ya lo soporta.

### 8.4 Ciclo de pago

Cada sub-orden tiene `estadoPago` propio (pendiente/parcial/pagado). Los pagos pueden hacerse por sub-orden específica o por la OC completa (decisión del usuario al momento del pago).

**Pendiente posterior**: el usuario mencionó que *"estas compras las pago con la TC, pero esa es una lógica que quiero trabajar posterior a terminar todas las secciones"*. Se deja fuera de alcance de este rework.

### 8.5 Regla crítica de cargos en sub-órdenes

Cuando la OC tiene sub-órdenes:
- Los cargos/descuentos/impuestos se definen **a nivel sub-orden**, no a nivel OC
- Los `cargosOC[]`, `descuentosOC[]`, `impuestosOC[]` de la OC padre **se deshabilitan** en el wizard
- Cada sub-orden es una mini-OC con sus propios cargos comerciales

**⚠️ Requiere refactor de código actual** — la función `heredarCargos()` hoy duplica cargos OC en cada envío. En el rework esa función se elimina o cambia.

---

## 9. KPIs y cálculos

### 9.1 Score Viabilidad (Paso 4 del wizard OC)

**Fórmula actual** en `WizardStepInteligencia.tsx:80-139` función `computeScore`:

| Peso | Componente | Umbrales |
|---|---|---|
| **40%** | Precio vs mejor proveedor o histórico | ≤-5% = 95 · 0% = 85 · +2% = 65 · +5% = 45 · +10% = 25 |
| **30%** | Margen con cargos (CTRU + costos adic.) | ≥60% = 90 · 45% = 75 · 30% = 60 · 15% = 35 |
| **20%** | Carga de cargos sobre costo unitario | 0% = 70 · ≤5% = 65 · ≤10% = 55 · ≤20% = 40 · >20% = 25 |
| **10%** | `puntuacionViabilidad` de investigación comercial | valor directo |

**Semáforo**:
- ≥70 "Compra favorable" (verde)
- 45-69 "Con observaciones" (ámbar)
- <45 "Revisar antes de continuar" (rojo)

**Decisión del usuario**: *"Lo resolvemos posterior, porque es mucha información"*. El rework mantiene la fórmula actual. La revisión conceptual queda **pendiente** (ver §12).

### 9.2 Valor Landed (KPI Vista Envíos)

Toggle con 3 variantes:

| Variante | Cálculo | Default |
|---|---|---|
| **Mes actual** | Suma `costoLandedTotalPEN` de envíos del mes actual | ✅ |
| **Últimos 3 meses** | Suma de los últimos 3 meses | |
| **Acumulado histórico** | Todos los envíos | |

### 9.3 Fill Rate (Vista Envíos)

Mostrar **2 valores**:
- **Mes actual**: `unidadesRecibidas_mes / unidadesEsperadas_mes × 100`
- **Histórico global**: `unidadesRecibidas_todas / unidadesEsperadas_todas × 100`

Semáforo: ≥80% verde · 60-79% ámbar · <60% rojo

### 9.4 Tiempo promedio en tránsito

Solo envíos `recibida_completa`:
```
promedio ( fechaLlegadaReal - fechaSalida )
```
Expresado en días.

### 9.5 Margen proyectado (Paso 4 OC)

Base: el `precioPERUMin` investigado en la investigación de mercado del producto.
- `margenReal = (precioVenta - CTRU con cargos) / precioVenta × 100`

### 9.6 CTRU estimado (Paso 4 OC)

Proyección previa a la recepción real:
- Base: `costoProducto + flete estimado` según investigación de mercado
- Usa `precioUSAMin` del proveedor de investigación como referencia de flete

---

## 10. Autoguardado

### 10.1 Capa 1 — localStorage (inmediato)

- Cada cambio en el wizard se guarda en `localStorage` del browser
- Key: `wizard_draft_{tipo}_{userId}` (ej: `wizard_draft_oc_abc123`)
- Al abrir `/compras` o `/envios`: si hay draft → banner *"Tienes una OC/envío sin terminar. ¿Continuar?"*
- Ventaja: instant
- Desventaja: se pierde si cambias de equipo

### 10.2 Capa 2 — Firestore (cross-device)

- Colección: `borradoresWizard/{userId}_{wizardId}`
- Guardado automático cada **30 segundos** mientras hay cambios
- Al abrir la app desde otro equipo: mismo banner de "continuar"
- Costo: 1 write cada 30s (despreciable)

### 10.3 Herramienta de cleanup administrativa

Solicitada explícitamente por el usuario.

**Ruta**: `/configuracion/borradores` (o sección dentro de /configuracion)

**Funcionalidad**:
- Lista todos los borradores wizard activos del sistema
- Columnas: Tipo wizard (OC/Envío) · Usuario · Fecha último cambio · Paso actual · Monto estimado · Acción
- Filtros: Por usuario · Por tipo · Por antigüedad
- Acciones:
  - Borrar individual
  - Borrar masivo (selección múltiple)
  - Expirar automáticamente borradores > 30 días (job manual o programado)
- Permisos: solo admin (por definir en §12)

### 10.4 Cleanup al completar wizard

Cuando el usuario confirma (crea la OC o el envío), se borra **ambos** localStorage + Firestore para no dejar basura.

---

## 11. Edge cases

### 11.1 Casilla sin unidades disponibles (wizard Envío)

Si el usuario intenta crear un envío Casilla→Perú pero la casilla origen no tiene unidades:
- **No se permite avanzar**
- Mensaje: *"Esta casilla no tiene unidades disponibles. Elige otra casilla o verifica el inventario."*
- Botón "Ver inventario de {casilla}" que navega a `/inventario` filtrado por esa casilla

### 11.2 OC sin colaborador asignado al envío

**No se permite** confirmar una OC cuyo envío requiere colaborador (Tramo 2 vía viajero/courier) si no hay uno asignado.

**Validación**:
- Si tipo envío = `internacional_peru` Y `llegadaPeru` ∈ {`viajero`, `courier_internacional`}: colaborador requerido
- Si tipo envío = `DDP directo`: no requiere colaborador
- Mensaje: *"Debes asignar un colaborador antes de confirmar. Puedes asignarlo ahora o dejarlo sin asignar y confirmar después cuando lo decidas."*

### 11.3 Cambio de ruta en OC ya confirmada

**Se permite**, pero requiere validación explícita.

**Flujo**:
1. Usuario abre detalle OC confirmada
2. Edita ruta (ej: cambia casilla destino USA)
3. Modal de confirmación: *"Estás cambiando la ruta de una OC ya confirmada. Esto requiere trasladar los items de CAS-004 a CAS-008. ¿Estás seguro?"*
4. Si confirma:
   - Se ejecuta un traslado automático
   - Si hay envío asociado en borrador: se actualiza su casilla destino
   - Si hay envío asociado en tránsito: **no se permite** (mercadería ya en camino)
   - Si hay envío recibida_parcial/completa: **no se permite** (mercadería ya llegó)

### 11.4 Proveedor activo se desactiva

Caso raro según el usuario, pero posible.

**Validación**:
- Si el proveedor de una OC en curso se marca como inactivo:
- Las OCs existentes **no se bloquean** (continúan su ciclo normal)
- Al crear OC nueva: el proveedor inactivo no aparece en el selector
- Al editar OC con proveedor ahora inactivo: muestra warning *"Este proveedor está inactivo. Confirma que quieres mantener la compra con él."*

### 11.5 Confirmar OC con sub-órdenes

La OC pasa a "Confirmada" solo cuando se elige si es con o sin sub-órdenes.

**Flujo confirmado por el usuario**: existe un paso de confirmación donde se decide esto. Ya existía en código (pre-rework), hay que integrarlo al wizard moderno.

---

## 12. Puntos pendientes por cerrar

> Estos puntos **DEBEN resolverse antes de la implementación**.

### 12.1 Auditoría `PagoUnificadoForm` con deudor colaborador

**Duda**: ¿El `PagoUnificadoForm` actual ya soporta tener como destinatario un colaborador en lugar del proveedor cuando la OC tiene `deudorTipo = 'colaborador'`?

**Plan**: revisar `PagoUnificadoForm.tsx` y servicios relacionados. Si no lo soporta, agregar adaptación.

**Bloqueante?**: No. Se puede codear el rework de wizards/vistas antes, y la adaptación del `PagoUnificadoForm` va después como ajuste.

### 12.2 Reportes CxP con deudor alternativo

**Duda**: el reporte actual `/reportes/cxp` asume que el deudor es siempre el proveedor. Con el rework, hay que adaptar el reporte para que lea `OC.deudorId` y `OC.deudorTipo`, no el `proveedorId` fijo.

**Plan**: auditar `TabCxP.tsx` y ajustar la query/render.

**Bloqueante?**: No, pero deja reportes incorrectos hasta ajustar.

### 12.3 Score Viabilidad — revisión conceptual

**Estado**: fórmula actual documentada (§9.1). El usuario pidió posponer revisión. El rework mantiene la fórmula tal cual.

### 12.4 Responsive mobile/tablet

**Plan**: dejar optimizado para desktop en esta ola. Pulir responsive después. Cuando se pula:
- Preview panel lateral → se apila arriba en mobile (o se oculta con botón "Ver resumen")
- Cards 5-columnas → colapsan a 2 filas (info principal arriba, detalles abajo)
- Tablas → horizontal scroll o card view

### 12.5 Permisos y roles

**Pendiente**: ¿todos los usuarios pueden crear OCs/Envíos? ¿Quién puede editar OC confirmada? ¿Quién puede ver la herramienta de cleanup de borradores?

**Probable**:
- Crear OC/Envío: cualquier usuario autenticado
- Editar OC confirmada: solo admin
- Cleanup borradores: solo admin
- Ver reportes: según perfil

**Acción**: validar con el usuario antes de codear roles.

### 12.6 Persistencia de estado wizard — detalle técnico

**Pendiente técnico**:
- ¿El draft en Firestore se guarda completo en un solo doc o por paso?
- ¿Qué tamaño máximo aceptamos? (Firestore: 1 MB por doc)
- ¿Qué pasa si el wizard tiene 50 productos? (seguro cabe)
- Manejo de conflicto: si dos tabs editan el mismo draft → el último en guardar gana (sin resolución de merge)

**Decisión propuesta**: 1 doc por wizard activo, último write gana, tamaño monitoreado.

### 12.7 Migración de data histórica por bug de cargos

**Problema**: la función `heredarCargos()` actual duplica cargos de OC en cada envío de sub-ordenes.

**Plan**:
- Identificar OCs históricas con sub-órdenes + cargos
- Calcular el CTRU erróneo actual vs el correcto
- Decidir: ¿recalcular CTRU histórico? ¿Dejar como está y corregir hacia adelante?

**Post-cleanup S40**: BD limpia. Por ahora no hay data histórica con este problema. Se corrige el código y listo.

### 12.8 Integración `SubOrdenCard` existente vs rework

**Estado**: hoy existe `SubOrdenCard.tsx` con modo compact/full. En el mockup del rework, las sub-órdenes aparecen como expansión de la OC en Vista Compras, pero el diseño visual específico **no fue completado en el mockup** (sólo un badge informativo en paso 2 del wizard OC).

**Plan**: extender el mockup con UI específica de sub-órdenes (creación post-OC, cards de sub-orden modernas, wizard de sub-orden).

### 12.9 Auto-generación de números de envío cuando OC tiene sub-órdenes

**Flujo**: al confirmar una OC con 3 sub-órdenes → se crean 3 envíos automáticos. ¿Qué números reciben?

**Propuesta**:
- Secuencial global: `ENV-2026-001`, `ENV-2026-002`, `ENV-2026-003` (correlativos simples)
- Alternativa: `ENV-2026-001-A`, `ENV-2026-001-B` (con sufijo de sub-orden)

**Decisión sugerida**: secuencial global (más simple, consistente con contador actual).

---

## 13. Tipos TypeScript

### 13.1 Campos nuevos en `OrdenCompra`

```ts
interface OrdenCompra {
  // ... campos actuales ...

  // S40 Rework — deudor alternativo
  deudorId?: string;                    // proveedorId o colaboradorId según deudorTipo
  deudorTipo?: 'proveedor' | 'colaborador';  // default: 'proveedor'
  // Si deudorTipo === 'colaborador' → deudorId apunta a un colaborador

  // S40 Rework — modo entrega detallado (ya existe parcialmente)
  modoEntrega?: {
    tramo1: 'proveedor_envia' | 'recojo_en_origen';
    tramo1PagoProductos?: 'yo' | 'colaborador';  // si recojo_en_origen
    tramo2: 'viajero' | 'courier_internacional' | 'ddp_directo';
    tramo3: 'yo_recojo' | 'colaborador_local' | 'viajero_absorbe';
    tramo3Pagador?: 'yo_al_recoger' | 'colaborador_adelanta';  // si colaborador_local
    tramo3ColaboradorId?: string;       // si colaborador_local
    tramo3GastoMovilidadPEN?: number;   // si yo_recojo
  };
}
```

### 13.2 Campos nuevos en `SubOrdenCompra` (mínimos)

La estructura actual ya es buena. Agregar solo:

```ts
interface SubOrdenCompra {
  // ... campos actuales ...

  // Cargos comerciales propios (ya existen descuentoUSD, shippingUSD, impuestoUSD — ampliar)
  cargosSubOrden?: CargoOC[];          // Análogo a OC.cargosOC pero por sub-orden
  descuentosSubOrden?: DescuentoOC[];
  impuestosSubOrden?: ImpuestoOC[];
}
```

### 13.3 Nuevo tipo `BorradorWizard`

```ts
interface BorradorWizard {
  id: string;
  tipo: 'oc' | 'envio';
  userId: string;
  pasoActual: number;
  estado: Record<string, any>;         // snapshot completo del estado del wizard
  fechaCreacion: Timestamp;
  fechaActualizacion: Timestamp;
  expiraEn?: Timestamp;                // 30 días desde última edición
}
```

### 13.4 Colección Firestore nueva

```
borradoresWizard/{userId}_{wizardId}
```

Con estructura del tipo `BorradorWizard`.

### 13.5 Campos derivados (no almacenados)

Se calculan en runtime, no se persisten:

- `OC.estadoDerivado: 'borrador' | 'confirmada' | 'en_despacho' | 'completada'`
- `Envio.progresoPorcentual: number`  (unidadesRecibidas / unidadesEsperadas × 100)
- `Reporte.valorLandedMes: number`  (suma filtrada por mes actual)

---

## 14. Plan de implementación

### 14.1 Precondiciones antes de arrancar

- [x] Cleanup datos S40 ejecutado (BD limpia post-S40)
- [x] Mockup maestro validado por usuario (`docs/mockups/rework-maestro-s40.html`)
- [x] Doc de especificación creado (este archivo)
- [ ] Pendientes §12 resueltos (principalmente 12.5, 12.6, 12.8, 12.9)
- [ ] Confirmación explícita del usuario para arrancar código

### 14.2 Bloque 0 — Infraestructura reutilizable (~2h)

Crear en `src/design-system/components/`:

1. **`WizardShell.tsx`**
   - Props: `steps[]`, `currentStep`, `onStepChange`, `children`, `previewPanel`, `onCancel`, `onNext`, `onPrev`
   - Responsabilidades: stepper moderno + panel 2-columnas + footer con botones + transiciones fade-in

2. **`EntityPicker.tsx` <T>**
   - Props: `items`, `selected`, `onSelect`, `renderCard`, `searchKey`, `onCreateNew`, `placeholder`
   - Responsabilidades: search + cards ricos + quick-add inline + loading/empty states

3. **`RouteVisual.tsx`**
   - Props: `nodes: { tipo, pais, nombre, codigo, icon }[]`, `orientation: 'vertical' | 'horizontal'`
   - Responsabilidades: render A→B→C con banderas + separadores + estados

4. **`DynamicChargesSection.tsx`**
   - Props: `tipo: 'cargos' | 'descuentos' | 'impuestos'`, `items`, `onChange`, `conceptosSugeridos[]`
   - Responsabilidades: lista agregable + autocomplete de conceptos + total parcial

5. **`ProductoDisplay.tsx`**
   - Props: `producto: Producto`, `variant: 'card' | 'row' | 'inline'`, `showMetadata: boolean`
   - Responsabilidades: icono/emoji temático + nombre + SKU + marca badge + descripción rica (`getDescripcionProducto`)

### 14.3 Bloque 1 — Wizards (~6h)

**Wizard Nueva OC (5 pasos)**:
1. Reescribir `OCFormWizard` (o crear `OCFormWizardV3`) usando `WizardShell + EntityPicker + RouteVisual + DynamicChargesSection`
2. Paso 1: Proveedor + 3 tramos de ruta + deudor alternativo Tramo 1
3. Paso 2: Productos con `ProductoDisplay`
4. Paso 3: Cargos comerciales (NO incluir landed, esos son del envío)
5. Paso 4: Inteligencia (mantener fórmula actual)
6. Paso 5: Confirmar con secciones editables
7. Integrar autoguardado (localStorage + Firestore)

**Wizard Nuevo Envío (3 pasos, Opción A)**:
1. Reescribir `CreateEnvioModal` usando misma infra
2. Paso 1: Ruta (solo tipos entre casillas + casilla→Perú)
3. Paso 2: Productos disponibles en origen
4. Paso 3: Confirmar (tracking/courier opcional, sin fechas)

### 14.4 Bloque 2 — Vistas principales (~4h)

**Vista Compras (`/compras`)**:
1. Modernizar `Compras.tsx` con:
   - Header con search global
   - 6 KPIs enriquecidos
   - Pipeline Opción B (con conteos clickables que filtran)
   - Filtros pill + dropdowns
   - Cards OC modernizadas (5 columnas con envíos asociados)

**Vista Envíos (`/envios`)**:
1. Modernizar `Envios.tsx` con:
   - Header consistente
   - Tabs internos (Operaciones default + otros de Bloque D)
   - 6 KPIs logísticos
   - Dashboard 2 columnas (breakdown por tipo + pipeline)
   - Filtros + cards modernizadas con ruta visual + progress bar + alertas

### 14.5 Bloque 3 — Detalle Envío (~2h)

Modernizar `EnvioDetailModal`:
- Header enriquecido con ruta horizontal
- 5 KPIs rápidos
- Tabs internos (Productos · Recepciones · Costos · Incidencias · Timeline)
- Sidebar contextual con info clave + acciones rápidas

### 14.6 Bloque 4 — Herramienta cleanup borradores (~1h)

Ruta: `/configuracion/borradores`
- Tabla con drafts activos
- Filtros y búsqueda
- Acciones borrar individual/masivo
- Proteger con permiso admin

### 14.7 Bloque 5 — Adaptaciones a módulos dependientes (~3h)

- **`PagoUnificadoForm`**: soportar destinatario=colaborador cuando `OC.deudorTipo === 'colaborador'`
- **Reportes CxP**: leer `OC.deudorId + deudorTipo` en vez de `proveedorId` fijo
- **Tesorería**: registrar "incidencia externa" cuando Angie pagó al proveedor (sin movimiento de caja, solo asiento informativo)

### 14.8 Bloque 6 — Build + testing (~1h)

- `tsc -b` limpio
- `vite build` exitoso
- Smoke test end-to-end: crear OC → confirmar → envío automático → editar → recepción → pago
- Documentar en `REGISTRO_IMPLEMENTACION.md`

**Total estimado**: ~19 horas (puede dividirse en 3-4 sesiones)

---

## 15. Referencias

### 15.1 Mockup maestro

`docs/mockups/rework-maestro-s40.html` — HTML standalone con 5 flujos navegables:
- Vista Compras
- Wizard Nueva OC (5 pasos)
- Vista Envíos
- Wizard Nuevo Envío (3 pasos)
- Detalle Envío

### 15.2 Código existente clave

| Ubicación | Qué contiene |
|---|---|
| `src/utils/producto.helpers.ts:13-42` | `getDescripcionProducto()` (descripción rica SUP/SKC) |
| `src/types/ordenCompra.types.ts` | OC, SubOrdenCompra, CargoOC, DescuentoOC, ImpuestoOC |
| `src/types/envio.types.ts` | Envio, CostoLanded, IncidenciaEnvio |
| `src/components/modules/ordenCompra/OCWizardV2/` | Wizard OC actual (base para el rework) |
| `src/components/modules/ordenCompra/OCWizardV2/WizardStepEntrega.tsx` | Lógica 3 tramos (salida/cruce/última milla) |
| `src/components/modules/ordenCompra/OCWizardV2/WizardStepCargos.tsx:201-394` | Cargos dinámicos actuales |
| `src/components/modules/ordenCompra/OCWizardV2/WizardStepInteligencia.tsx:80-139` | `computeScore()` viabilidad |
| `src/components/modules/ordenCompra/SubOrdenCard.tsx:157-349` | Card sub-orden actual |
| `src/services/ordenCompra.crud.service.ts:759-850` | `heredarCargos()` + lógica `confirmarOC` con sub-órdenes |
| `src/pages/Envios/CreateEnvioModal.tsx` | Modal creación envío actual (a reescribir) |
| `src/pages/Envios/EnvioDetailModal.tsx` | Detalle envío actual (a modernizar) |
| `src/pages/OrdenesCompra/OrdenesCompra.tsx` | Vista /compras actual (a modernizar) |
| `src/pages/Envios/Envios.tsx` | Vista /envios actual (a modernizar) |

### 15.3 Documentos de contexto

| Archivo | Relevancia |
|---|---|
| `docs/ACUERDOS_REINGENIERIA_2026-04-10.md` | 53 acuerdos S32 (reingeniería integral) |
| `C:/Users/josel/.claude/projects/C--Users-josel-businessmn-v2/memory/project_deuda_recojo_origen.md` | Escenario deudor alternativo Tramo 1 (origen S35) |
| `C:/Users/josel/.claude/projects/C--Users-josel-businessmn-v2/memory/MEMORY.md` | Estado general del proyecto |
| `docs/PLAN_CLEANUP_S40.md` | Cleanup de datos ejecutado pre-rework |

### 15.4 Terminología clave del sistema (post-S40)

- **Casilla** (no "Almacén USA"): punto de tránsito
- **Colaborador** (no "Viajero"): transportista interno/externo
- **Sub-orden**: grupo de productos de una OC que se separa por el proveedor post-compra
- **Costo landed**: costo logístico de traer la mercadería (flete, aduana, recojo)
- **Cargo comercial**: costo cobrado por el proveedor (shipping, handling, tax)
- **Deudor alternativo**: cuando un colaborador paga al proveedor, la deuda cambia al colaborador
- **CTRU**: Costo Total Real Unitario (producto + cargos + landed prorrateados)

---

## Checklist para retomar sesión futura

- [ ] Leer este documento completo
- [ ] Abrir mockup maestro `docs/mockups/rework-maestro-s40.html` para referencia visual
- [ ] Revisar `MEMORY.md` para estado general post-S40
- [ ] Validar pendientes §12 con usuario (principalmente 12.5 permisos, 12.8 sub-órdenes UI, 12.9 numeración)
- [ ] Confirmar alcance y orden de bloques (§14)
- [ ] Arrancar Bloque 0 (infra reutilizable) como fundación
- [ ] Build check tras cada bloque (`tsc -b` + `vite build`)
- [ ] Actualizar `REGISTRO_IMPLEMENTACION.md` al cierre de cada bloque
- [ ] Actualizar `MEMORY.md` al cierre total

---

**Fin del documento.**

Cualquier duda sobre lo aquí expuesto debe consultarse al usuario antes de codear. No asumir — preguntar.
