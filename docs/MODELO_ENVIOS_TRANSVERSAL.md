# MODELO ENVIOS TRANSVERSAL — Especificacion Funcional S43

**Fecha:** 2026-04-20
**Sesion:** S43 (solo spec + mockups, sin codigo)
**Status:** Borrador para validacion del usuario antes de S44
**Autor:** implementation-controller + system-architect (deliberacion con usuario)
**Habilita:** S44 (core inbound), S45 (Casilla-Casilla), S46 (Transferencias), S47 (Ventas logistica), S48 (Almacenes terceros)

---

## Indice

1. [Proposito y alcance](#1-proposito-y-alcance)
2. [Los 9 flujos logisticos canonicos](#2-los-9-flujos-logisticos-canonicos)
3. [Las 14 decisiones cerradas (no re-deliberables)](#3-las-14-decisiones-cerradas-no-re-deliberables)
4. [Modelo de datos propuesto](#4-modelo-de-datos-propuesto)
5. [Flujos por caso](#5-flujos-por-caso)
6. [Wizard de Envio T2 (Casilla Intl -> Peru)](#6-wizard-de-envio-t2-casilla-intl---peru)
7. [Sub-envios dentro del T1](#7-sub-envios-dentro-del-t1)
8. [Reglas de negocio por tipo de envio](#8-reglas-de-negocio-por-tipo-de-envio)
9. [Responsabilidad de reclamos](#9-responsabilidad-de-reclamos)
10. [Costos landed: catalogo, calculo, prorrateo](#10-costos-landed-catalogo-calculo-prorrateo)
11. [Estrategia de migracion de datos existentes](#11-estrategia-de-migracion-de-datos-existentes)
12. [Modulos absorbidos y su rework](#12-modulos-absorbidos-y-su-rework)
13. [Efectos contables y financieros](#13-efectos-contables-y-financieros)
14. [Plan de implementacion por fases (S44-S48)](#14-plan-de-implementacion-por-fases-s44-s48)
15. [Pendientes / Riesgos / Validaciones previas a S44](#15-pendientes--riesgos--validaciones-previas-a-s44)

---

## 1. Proposito y alcance

### 1.1 Problema que resuelve

Hoy el ERP tiene un modelo implicito **OC -> Envio 1:1** (o 1:N por sub-orden) que choca con la realidad operativa:

- **El proveedor despacha en tandas:** una sub-orden de Amazon puede llegar en 3 paquetes en 3 fechas distintas (caso documentado en imagen Amazon del pedido 113-7465331-5293821).
- **El colaborador de la casilla internacional consolida a su criterio:** las unidades de N OCs distintas se pueden juntar en un solo envio Casilla -> Peru.
- **Los movimientos logisticos no se limitan a compras:** hay traslados entre almacenes propios, despachos a clientes, devoluciones, muestras a terceros, movimientos casilla -> casilla.

Seguir forzando el modelo actual genera tres problemas:
1. UX confusa (preguntar "como viaja a Peru" cuando el envio solo va proveedor -> casilla USA)
2. Imposibilidad de consolidar operaciones logisticas reales
3. Duplicacion de modulos (Transferencias, Ventas logistica, Devoluciones) que deberian ser el mismo hub

### 1.2 Solucion propuesta

**Envios se convierte en el hub logistico transversal del negocio.** Todo movimiento fisico de unidades pasa por este modulo con:
- UN solo modelo de datos (`Envio`)
- UNA UI consistente (cards, detalle, wizard)
- N tipos de flujo (A, B, C, D, E, F, G, I, J — descritos abajo)
- Derivacion automatica de responsabilidades (quien mueve, quien paga, quien reclama)
- Trazabilidad completa de la unidad a traves de multiples envios en cadena

### 1.3 Lo que NO es alcance

- **No reemplaza Compras (OC):** la OC sigue siendo el documento de negociacion con el proveedor. Envios solo absorbe el lado logistico.
- **No reemplaza Ventas (VT):** la venta sigue siendo el documento comercial con el cliente. Envios absorbe el despacho logistico (tipo F) y el retorno (tipo G).
- **No reemplaza Tesoreria / CxP / CxC:** los movimientos financieros se siguen registrando en sus modulos. Envios solo reporta los *costos landed* para prorrateo CTRU.
- **No aplica al caso H (RMA a proveedor):** descartado por el usuario.

---

## 2. Los 9 flujos logisticos canonicos

### Tabla maestra

| Tipo | Nombre | Origen | Destino | Dispara | Se auto-crea? | Costo tipico |
|---|---|---|---|---|---|---|
| **A** | Proveedor -> Casilla Intl | Proveedor | Casilla colaborador (ej. USA) | OC confirmada (no DDP) | Si, 1 envio T1 | 0 o ya en factura del proveedor |
| **B** | Proveedor -> Almacen Peru (DDP) | Proveedor | Almacen en Peru | OC confirmada (DDP) | Si, 1 envio T1 | Flete en factura del proveedor |
| **C** | Casilla Intl -> Almacen Peru | Casilla intl | Almacen en Peru | Manual desde /envios | **No** | Flete variable + fee de recepcion |
| **D** | Compra directa colaborador | Proveedor | Casilla del colaborador comprador | OC con `recojoEnOrigen=true` | Si, 1 envio "instantaneo" (recibida_completa) | El colaborador paga flete / proveedor absorbe |
| **E** | Almacen -> Almacen interno | Almacen propio (Peru) | Almacen propio (Peru) | Manual desde /envios | No | Gasto operativo del traslado |
| **F** | Almacen -> Cliente | Almacen propio | Direccion del cliente | Venta confirmada | Si, 1 envio F | Flete de despacho (courier local) |
| **G** | Cliente -> Almacen (devolucion) | Cliente | Almacen propio | Devolucion abierta | Si, 1 envio G vinculado a la venta original | Flete de retorno (politica) |
| **I** | Almacen -> Almacen de terceros | Almacen propio | Almacen "tercero" (marketing, influencer, agente) | Manual desde /envios | No | Flete + bloqueo de stock vendible |
| **J** | Casilla Intl -> Casilla Intl | Casilla intl | Casilla intl (mismo colaborador u otro) | Manual desde /envios | No | Flete entre casillas, **preferente intra-pais** |

**Caso H (RMA a proveedor):** descartado, no aplica al negocio.

### Notas por caso

- **A y B se disparan desde `confirmarOC()`** segun `modoEntregaDetallado` de la OC (`via_casilla` / `via_viajero` / `via_courier` = A; `ddp_directo` = B; `recojo_propio` = D).
- **C es el caso mas complejo** porque consolida unidades de N OCs distintas mediante picking manual en la casilla origen. Es donde el Wizard T2 (seccion 6) cobra sentido.
- **F y G son rework de modulos existentes** (Ventas y Devoluciones) — se absorbe solo el lado logistico.
- **I y J son nuevos casos operativos** que el usuario confirmo como aplicables.

---

## 3. Las 14 decisiones cerradas (no re-deliberables)

Estas decisiones fueron discutidas y cerradas en la deliberacion S42bl -> S43 con el usuario. Son **input inmutable para S44+**.

| # | Decision | Justificacion |
|---|---|---|
| D-1 | Envios = modulo transversal hub logistico | Absorbe E, F, G, I, J para consistencia UX y medicion unificada |
| D-2 | OC genera SOLO el tramo T1 propio (proveedor->casilla o DDP proveedor->Peru) | La OC no controla "toda la ruta a Peru" — eso es competencia del modulo Envios |
| D-3 | Sub-envios dentro del T1 cuando el proveedor despacha en N tandas | Realidad operativa (caso Amazon con 3 fechas de entrega) |
| D-4 | T2 consolida unidades de N OCs con picking manual por casilla | El colaborador arma envios segun su criterio, no por OC |
| D-5 | Priorizacion de pre-ventas en picking T2 via `Unidad.reservadaPara` | Campo existente; las cotizaciones con adelanto pagado reservan stock |
| D-6 | Caso D tiene 2 variantes: D1 (deudor=colaborador) y D2 (deudor=proveedor) | Logisticamente iguales, financieramente distintos |
| D-7 | Caso G (devolucion) entra en estado `devuelto_pendiente_revision` | QA antes de re-vender |
| D-8 | Casos I y J unificados como "Envios entre nodos" con `destinoTipo` distinto | Estructuralmente similares, diferencian por tipo de nodo destino |
| D-9 | Caso J preferentemente intra-pais | Los cruces internacionales complican aduanas |
| D-10 | Caso I bloquea stock: unidades no visibles en listados vendibles | Opcion B: no aparecen en stock vendible hasta regresar a almacen propio |
| D-11 | Responsabilidad de reclamos se deriva del tipo de envio (ver seccion 9) | En DDP el responsable es el courier del proveedor, etc. |
| D-12 | Fee de recepcion es un `costoLanded` del envio, NO envio separado | Simplicidad del modelo logistico |
| D-13 | Wizard T2: 5 pasos (Origen / Picking / Transporte / Costos / Confirmar) | UX alineada con Wizard OC V3 ya existente |
| D-14 | Se reutiliza `Unidad.reservadaPara` existente (no crear campo nuevo) | Ya implementado para cotizaciones con adelanto pagado |

---

## 4. Modelo de datos propuesto

### 4.1 Cambios al tipo `Envio`

```typescript
// src/types/envio.types.ts — VERSION PROPUESTA

export type TipoRutaLogistica =
  | 'A_proveedor_casilla'       // Proveedor -> Casilla Intl
  | 'B_proveedor_almacen_ddp'   // Proveedor -> Almacen Peru (DDP)
  | 'C_casilla_almacen'         // Casilla Intl -> Almacen Peru (T2)
  | 'D_compra_directa'          // Proveedor -> Casilla colaborador comprador
  | 'E_interno_almacen'         // Almacen -> Almacen interno
  | 'F_almacen_cliente'         // Almacen -> Cliente (despacho venta)
  | 'G_devolucion_cliente'      // Cliente -> Almacen (retorno)
  | 'I_almacen_tercero'         // Almacen -> Almacen de terceros
  | 'J_entre_casillas';         // Casilla Intl -> Casilla Intl

export type TipoNodo =
  | 'proveedor'
  | 'casilla_colaborador'       // Casilla intl de un colaborador
  | 'almacen_propio'            // Almacen nuestro (Peru tipicamente)
  | 'almacen_tercero'           // Almacen externo (marketing, influencer, agente)
  | 'cliente'                   // Direccion de cliente final
  | 'proveedor_rma';            // Reservado — no aplica hoy

export interface Envio {
  id: string;
  numeroEnvio: string;          // ENV-2026-XXX

  // NUEVO: tipo canonico de ruta (antes era heuristico)
  tipoRutaLogistica: TipoRutaLogistica;

  // NUEVO: nodos tipados
  origenTipo: TipoNodo;
  origenId: string;             // ID del nodo origen (proveedorId, casillaId, almacenId, etc.)
  origenNombre: string;         // Desnormalizado
  origenPais?: string;          // Desnormalizado

  destinoTipo: TipoNodo;
  destinoId: string;
  destinoNombre: string;
  destinoPais?: string;

  // Vinculos con otros modulos (opcionales segun tipo)
  ordenCompraId?: string;       // Solo A, B, D
  subOrdenId?: string;          // Solo A, B, D (cuando la OC tiene sub-ordenes)
  ventaId?: string;             // Solo F, G
  devolucionId?: string;        // Solo G
  envioOrigenId?: string;       // Solo G (referencia al envio F original)

  // NUEVO: sub-envios dentro del T1 (caso Amazon)
  subEnvios?: SubEnvioT1[];     // Solo A, B, D cuando el proveedor despacha en N tandas

  // Unidades del envio (picking manual en C; automatico en A, B, D, F)
  unidades: EnvioUnidad[];

  // Estados
  estado: EstadoEnvio;
  colaboradorId?: string;       // Transportador (viajero, courier)
  colaboradorNombre?: string;
  courier?: string;             // Nombre del courier externo si aplica
  numeroTracking?: string;

  // Fechas
  fechaCreacion: Timestamp;
  fechaSalida?: Timestamp;
  fechaEstimadaLlegada?: Timestamp;

  // Recepciones parciales (historial)
  recepciones: RecepcionEnvio[];

  // Costos landed (prorrateados al CTRU de cada unidad al recibir)
  costosLanded: CostoLanded[];

  // Reclamo (si aplica)
  reclamo?: ReclamoEnvio;

  // Responsable default de reclamo (derivado del tipo)
  reclamoResponsableDefault: 'proveedor' | 'courier_proveedor' | 'viajero' | 'courier_interno' | 'colaborador' | 'nosotros' | 'cliente';

  // Totales desnormalizados (para listados sin calcular)
  totalUnidades: number;
  totalUnidadesRecibidas: number;
  valorUnidadesUSD?: number;
  costoLandedTotalUSD?: number;

  // Auditoria
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;

  // Flags especiales
  esDDP?: boolean;              // Legacy — derivable de tipoRutaLogistica === 'B_proveedor_almacen_ddp'
  recojoEnOrigen?: boolean;     // Legacy — se mantiene por compat
  bloqueoVendible?: boolean;    // NUEVO: true si las unidades no se pueden vender mientras estan en el envio (caso I)
}
```

### 4.2 Nuevo: `SubEnvioT1`

```typescript
/**
 * Sub-envio dentro de un envio T1 (A, B, D).
 * Representa una tanda de despacho cuando el proveedor envia la OC en N paquetes.
 * Ejemplo: sub-orden Amazon con 3 fechas de entrega = 3 SubEnvioT1.
 */
export interface SubEnvioT1 {
  id: string;                   // SE-{envioId}-{N}
  secuencia: number;            // 1, 2, 3...
  unidadesIds: string[];        // Subset de unidades del envio padre
  fechaDespachoProveedor?: Timestamp;
  fechaEntrega?: Timestamp;     // Cuando llego a la casilla
  numeroTrackingProveedor?: string; // Tracking opcional del courier del proveedor (USPS, UPS, etc.)
  estado: 'pendiente' | 'en_transito' | 'entregado';
  notas?: string;
}
```

### 4.3 Cambios al tipo `Unidad`

Agregar campos para trazabilidad multi-envio:

```typescript
export interface Unidad {
  // ... campos existentes

  // NUEVO: historial de envios por los que paso la unidad
  historialEnvios?: Array<{
    envioId: string;
    envioNumero: string;
    tipoRutaLogistica: TipoRutaLogistica;
    fechaSalida?: Timestamp;
    fechaRecepcion?: Timestamp;
  }>;

  // Existente: reservadaPara — se usa para picking prioritario
  reservadaPara?: string;       // cotizacionId o ventaId

  // NUEVO: bloqueo temporal por caso I
  bloqueadaPorEnvioId?: string; // Si esta en un envio I activo
}
```

### 4.4 Cambios a `SubOrdenCompra`

**Deprecar** los campos 1:1 envio-suborden; agregar lista:

```typescript
export interface SubOrdenCompra {
  id: string;
  // ... campos existentes

  // DEPRECADOS (mantener por compat con OCs pre-S44):
  envioId?: string;
  envioNumero?: string;

  // NUEVOS:
  enviosIds?: string[];         // N envios T1 pueden salir de una sub-orden (uno por tanda del proveedor, aunque normalmente es 1 con sub-envios internos)
  unidadesDespachadas?: number; // Agregado: suma de unidades en sub-envios
  unidadesRecibidas?: number;
}
```

---

## 5. Flujos por caso

### 5.1 Caso A — Proveedor -> Casilla Intl

**Disparador:** `confirmarOC()` cuando `orden.modoEntregaDetallado in ['via_viajero', 'via_courier']` y destino es casilla internacional.

**Comportamiento:**
1. OC confirma (estado `confirmada`)
2. Crea N unidades en estado `pedida`
3. **Auto-crea 1 envio tipo A en estado `borrador`** por cada sub-orden (o 1 envio si no hay sub-ordenes)
4. El envio tiene `origenTipo='proveedor'`, `destinoTipo='casilla_colaborador'`
5. Hereda cargos de la OC/sub-orden como costos landed del envio

**Sub-envios dentro del T1:**
- Al despachar (transicion `borrador -> en_transito`), el usuario puede:
  - Despachar el envio completo (1 sub-envio implicito)
  - Crear N sub-envios con subsets de unidades + tracking + fecha estimada de cada tanda
- Las recepciones parciales en la casilla se registran por sub-envio

**Recepcion:**
- Cuando el colaborador de la casilla recibe, marca unidades como `recibida_usa` (o `recibida_cn`, etc.)
- El envio A queda en `recibida_completa` cuando todas sus unidades estan recibidas

### 5.2 Caso B — Proveedor -> Almacen Peru (DDP)

**Disparador:** `confirmarOC()` cuando `orden.modoEntregaDetallado === 'ddp_directo'`.

**Comportamiento:**
- Identico a A, pero con `destinoTipo='almacen_propio'` (almacen en Peru)
- `tipoRutaLogistica = 'B_proveedor_almacen_ddp'`
- El proveedor gestiona todo el flete internacional hasta Peru
- El **courier del proveedor** es responsable de reclamos (daños, perdidas, aduana)

**Recepcion:**
- Al recibir en Peru, las unidades saltan directo a `disponible_peru` (no pasan por `recibida_usa`)

### 5.3 Caso C — Casilla Intl -> Almacen Peru (T2)

**Disparador:** **MANUAL** desde `/envios` con el Wizard T2 (seccion 6).

**Comportamiento:**
1. Usuario abre el wizard en /envios
2. Elige casilla origen (ej. Felicita-USA)
3. Sistema muestra unidades disponibles en esa casilla (estado `recibida_usa` o equivalente) **agrupadas por producto**, con priorizacion visual:
   - 🟢 Pre-vendidas (con `reservadaPara`) — prioridad alta
   - 🟡 Stock normal
4. Picking manual: el usuario elige cuantas unidades de cada producto incluir (stepper +/-)
5. Asigna colaborador transportador (viajero o courier intl)
6. Define costos landed segun la tarifa del colaborador (ver seccion 10.3)
7. Confirma: se crea envio C en estado `borrador`
8. Al despachar: transita a `en_transito`
9. Al recibir en Peru: unidades pasan a `disponible_peru` y se prorratean costos landed al CTRU

**Clave:** el envio C puede contener unidades de **N OCs distintas** — se identifican individualmente por `unidadId`.

### 5.4 Caso D — Compra directa colaborador

**Disparador:** `confirmarOC()` cuando `orden.recojoEnOrigen === true`.

**Sub-variantes (mismo flujo logistico, distinto financiero):**

| Variante | `deudorTipo` de la OC | Quien paga al proveedor | Financiero |
|---|---|---|---|
| D1 | `colaborador` | El colaborador con su plata | CxP al colaborador (yo le reembolso) |
| D2 | `proveedor` | Yo directo al proveedor | CxP al proveedor como OC normal |

**Comportamiento logistico (identico en D1 y D2):**
1. OC confirma
2. Unidades nacen directamente en estado `disponible` en la casilla del colaborador (no pasan por `pedida`)
3. Se crea 1 envio tipo D en estado `recibida_completa` al instante
4. `origenTipo='proveedor'`, `destinoTipo='casilla_colaborador'`, `recojoEnOrigen=true`

**UX en el Wizard OC:**
- Paso "Ruta" tiene una seccion "Modo de entrega"
- Si el usuario elige "Compra directa del colaborador":
  - Pregunta clara: "¿Quien paga al proveedor?"
    - [ ] El colaborador con su dinero (yo le reembolso) -> D1
    - [ ] Yo directo al proveedor, el colaborador solo recoge -> D2
  - El `deudorTipo` se setea segun la respuesta

**Validacion pendiente (SGSU-D2):** confirmar que el flujo CxP funciona end-to-end cuando `deudorTipo='colaborador'` (Bloque 5 de S41 lo implemento; falta UAT).

### 5.5 Caso E — Almacen -> Almacen interno (Peru)

**Disparador:** MANUAL desde /envios.

**Comportamiento:**
- `origenTipo='almacen_propio'`, `destinoTipo='almacen_propio'`
- Unidades transitan entre almacenes sin cambiar de pais
- Costo operativo: flete local (opcional, puede ser 0)
- **Efecto contable:** gasto operativo del traslado (categoria gastoOperativo)

**Rework asociado:** absorbe el modulo `/transferencias` actual. Migrar UX y conservar historico de transferencias pre-S46 como envios tipo E retroactivos.

### 5.6 Caso F — Almacen -> Cliente (despacho venta)

**Disparador:** Venta confirmada (desde modulo Ventas).

**Comportamiento:**
1. Al confirmar venta, se crea envio F en estado `borrador`
2. Vinculado a la venta por `ventaId`
3. Unidades pasan de `disponible_peru` a `en_transito_cliente`
4. Courier local (colaborador tipo courier_local o manual)
5. Al entregarse: unidades pasan a `vendida`
6. **El documento de venta sigue viviendo en /ventas** (factura, cobro, cliente) — solo el lado logistico se maneja aqui

**Rework asociado:** absorbe el componente de despacho del modulo Ventas actual (S47).

### 5.7 Caso G — Cliente -> Almacen (devolucion)

**Disparador:** Devolucion abierta (desde modulo Ventas o desde /envios si es post-venta indirecta).

**Comportamiento:**
1. Crear envio G vinculado a venta original (`ventaId`) y opcionalmente al envio F (`envioOrigenId`)
2. `origenTipo='cliente'`, `destinoTipo='almacen_propio'`
3. Flete de retorno: puede ser 0 (cliente lo paga) o costo para nosotros (politica generosa)
4. Al recibir: **unidades entran en estado `devuelto_pendiente_revision`** (no vuelven a `disponible` automaticamente)
5. Un paso de QA posterior (modulo Calidad o manual) decide:
   - -> `disponible_peru` (apto para re-venta)
   - -> `devuelto_merma` (descarte contable)
   - -> `devuelto_regalo` (se muestra como samples en I)

**Rework asociado:** absorbe el componente de devolucion de Ventas (S47).

### 5.8 Caso I — Almacen -> Almacen de terceros

**Disparador:** MANUAL desde /envios.

**Comportamiento:**
1. `destinoTipo='almacen_tercero'`
2. El almacen tercero se crea como entidad tipo `tipoAlmacen='tercero'` o `tipoCasilla='tercero'` (decision tecnica en S48)
3. Se asocia a un colaborador tipo Marketing, Agente, etc.
4. **Bloqueo (D-10, Opcion B):** mientras las unidades estan en un envio I activo (estado != `devuelto_al_almacen_propio`), **NO aparecen en listados de stock vendible**
5. Las unidades pueden:
   - Regresar como envio I inverso (-> estado `disponible_peru`)
   - Convertirse en gasto de marketing al cierre (modulo Contabilidad)

### 5.9 Caso J — Casilla Intl -> Casilla Intl

**Disparador:** MANUAL desde /envios.

**Comportamiento:**
1. `origenTipo='casilla_colaborador'`, `destinoTipo='casilla_colaborador'`
2. **Preferente intra-pais (D-9):** la UI ofrece por defecto casillas del mismo pais como destino; cambiar a otro pais requiere confirmacion explicita
3. Dos sub-casos soportados:
   - **J1:** Entre casillas del **mismo colaborador** (ej. Felicita Miami -> Felicita Orlando)
   - **J2:** Entre casillas de **colaboradores distintos** (ej. Felicita USA -> Wendy USA)
4. Costo: flete del movimiento (configurable)

---

## 6. Wizard de Envio T2 (Casilla Intl -> Peru)

El caso C es el mas complejo operativamente. Requiere un wizard dedicado.

### 6.1 Entrada

- Trigger: boton "Nuevo envio" -> opcion "Casilla a Peru" en /envios
- Trigger alternativo: desde el detalle de una casilla, boton "Enviar a Peru"

### 6.2 Pasos del wizard

**Paso 1 — Origen**
- Selecciona casilla intl (dropdown con colaboradores tipo casilla_colaborador)
- Muestra: "Esta casilla tiene **47 unidades disponibles** de 5 OCs distintas"
- Fecha estimada de salida (opcional en este paso)

**Paso 2 — Picking (con priorizacion pre-ventas)**
- Listado de unidades disponibles agrupadas por producto
- Ordenamiento:
  - **Prioridad 1:** unidades con `reservadaPara` (cotizacion con adelanto pagado) — **resaltadas visualmente (icono, fondo verde)**
  - **Prioridad 2:** unidades mas antiguas (FIFO por `fechaRecepcion`)
- Stepper por producto: "+/- N unidades"
- Checkbox "Incluir todas las prioritarias automaticamente"
- Resumen: "Has seleccionado X unidades de Y productos (Z prioritarias)"

**Paso 3 — Transporte**
- Tipo: viajero / courier internacional
- Colaborador: dropdown filtrado por tipo
- Tracking (opcional)
- Fecha estimada de llegada a Peru

**Paso 4 — Costos landed**
- Preset de tarifa del colaborador (ver seccion 10.3):
  - [ ] Estandar: $X por unidad
  - [ ] Por peso: $X por libra
  - [ ] Monto total: $X fijo, prorrateado por peso
  - [ ] Variable por producto: (tabla producto-tarifa)
- Fee de recepcion (opcional, $X o $X por unidad)
- Fee colaborador casilla (si aplica, opcional)
- Preview: CTRU landed estimado por producto

**Paso 5 — Confirmar**
- Preview visual completo
- Boton "Confirmar envio" -> crea envio en estado `borrador`
- Opcion "Despachar inmediatamente" -> crea en `en_transito` directo

### 6.3 Validaciones del wizard

- No permitir continuar al paso 2 sin origen
- No permitir continuar al paso 3 sin al menos 1 unidad en picking
- Advertencia al paso 3 si hay pre-vendidas disponibles y el usuario no las seleccionó
- Validacion matematica del paso 4: suma de costos landed > 0

### 6.4 Recomendacion de pre-ventas (D-5 detallado)

El sistema **no bloquea** al usuario si decide no incluir las pre-vendidas, pero:
- Muestra banner de advertencia: "⚠️ Hay 5 unidades pre-vendidas no incluidas en este envio (cotizaciones COT-123, COT-145, COT-178 tienen adelanto pagado)"
- El usuario puede proceder con override explicito (boton "Entiendo, continuar sin ellas")

---

## 7. Sub-envios dentro del T1

### 7.1 Cuando aplica

Solo en envios tipo A, B, D donde el proveedor despacha la misma sub-orden en N tandas.

**Ejemplo real (imagen del pedido Amazon 113-7465331-5293821):**
- Sub-orden de 7 productos, 3 fechas de entrega:
  - 30 marzo: NOW Ashwagandha (1)
  - 29 marzo: Longjack, NAD+, Myo-Inositol, CoQ10 (200mg), CoQ10 Ubiquinol (5)
  - 1 abril: Micro Ingredients Myo-Inositol (1)

En el modelo:
```
Envio T1 "ENV-2026-123" (ordenCompraId=OC-2026-001)
  subEnvios:
    - SE-ENV-123-1 (secuencia 1)
        unidadesIds: [u1]                      // NOW Ashwagandha
        fechaEntrega: 2026-03-30
        numeroTrackingProveedor: "TBA12345"
    - SE-ENV-123-2 (secuencia 2)
        unidadesIds: [u2, u3, u4, u5, u6]
        fechaEntrega: 2026-03-29
        numeroTrackingProveedor: "TBA67890"
    - SE-ENV-123-3 (secuencia 3)
        unidadesIds: [u7]
        fechaEntrega: 2026-04-01
        numeroTrackingProveedor: "TBA11111"
```

### 7.2 UI asociada

En el detalle del envio T1, seccion "Tandas del proveedor":
- Timeline visual con las fechas
- Cada tanda: icono + fecha + N unidades + tracking opcional + estado
- Boton "Agregar tanda" si el envio aun tiene unidades sin asignar
- Al expandir una tanda: lista de productos

### 7.3 Logica de creacion

- Al **confirmar OC** (A/B): se crea el envio T1 SIN sub-envios (todas las unidades directamente en `envio.unidades`)
- Al **recibir la primera tanda**: el usuario puede marcar N unidades como "recibidas en esta tanda" y el sistema crea automaticamente el primer sub-envio retroactivamente
- Alternativa: modo "Planificacion" donde el usuario crea sub-envios prospectivamente al ver el email del proveedor con fechas estimadas

---

## 8. Reglas de negocio por tipo de envio

### 8.1 Estados validos por tipo

| Tipo | borrador | confirmado | en_transito | recibida_parcial | recibida_completa | retenida_aduana | perdida_total | cancelada |
|---|---|---|---|---|---|---|---|---|
| A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| B | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| C | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D | (skip) | (skip) | (skip) | (skip) | ✓ (auto) | - | - | ✓ |
| E | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | ✓ |
| F | ✓ | ✓ | ✓ | - | ✓ | - | - | ✓ |
| G | ✓ | ✓ | ✓ | - | ✓ (-> pendiente_revision) | - | - | ✓ |
| I | ✓ | ✓ | ✓ | - | ✓ | - | - | ✓ |
| J | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | ✓ |

### 8.2 Quien puede crear cada tipo

| Tipo | Disparador | Modulo origen |
|---|---|---|
| A, B, D | Automatico en `confirmarOC()` | Compras |
| C | Manual con Wizard T2 | Envios |
| E | Manual | Envios (absorbe Transferencias) |
| F | Automatico en venta confirmada | Ventas (absorbe componente logistico) |
| G | Manual o automatico al abrir devolucion | Ventas (absorbe componente logistico) |
| I | Manual | Envios |
| J | Manual | Envios |

### 8.3 Transiciones de estado prohibidas

- D no puede ir a `borrador` (nace en `recibida_completa`)
- F, G, I no pueden ser `recibida_parcial` (son atomicos)
- Ningun envio puede ir de `recibida_completa` a otro estado (excepto `cancelada` con auditoria especial)

---

## 9. Responsabilidad de reclamos

Derivado automaticamente al crear el envio, guardado en `reclamoResponsableDefault`:

| Tipo | Responsable default |
|---|---|
| A | `proveedor` (el proveedor gestiono la logistica a la casilla) |
| B (DDP) | `courier_proveedor` (el courier del proveedor es responsable hasta Peru, incluye aduana) |
| C | `viajero` o `courier_interno` (segun tipo de colaborador) |
| D | `colaborador` (el colaborador recogio, es responsable si hubo daño) |
| E | `nosotros` (traslado interno) |
| F | `courier_interno` o nosotros (despacho local) |
| G | `cliente` (si devolvio daños) o `nosotros` (si politica absorbe) — requiere eleccion explicita |
| I | `nosotros` o `courier_interno` |
| J | `viajero` o `courier_interno` |

**El usuario puede override** el responsable al abrir un reclamo; el campo `reclamoResponsableDefault` es solo sugerencia.

---

## 10. Costos landed: catalogo, calculo, prorrateo

### 10.1 Categorias de costo landed

| Categoria | Aplica a | Metodo prorrateo default |
|---|---|---|
| Cargos del proveedor (shipping factura) | A, B, D | total_por_valor |
| Descuentos del proveedor | A, B, D | total_por_valor (negativo) |
| Impuestos del proveedor | A, B, D | total_por_valor |
| Flete internacional | C | total_por_peso |
| Fee de recepcion en destino | C | fijo_por_unidad o total_por_valor |
| Fee colaborador casilla | C | fijo_por_unidad |
| Flete despacho local | F | fijo_por_envio (no prorratea a unidad — es costo comercial) |
| Flete retorno | G | fijo_por_envio |
| Gasto operativo traslado | E | fijo_por_envio |
| Costo logistico casilla-casilla | J | total_por_valor |
| Costo muestra/marketing | I | fijo_por_envio (al salir); al regresar es 0 |

### 10.2 Calculo del CTRU landed

Al recibir el envio, cada unidad actualiza su `costoLandedAcumuladoUSD`:

```
ctruLandedUnidad = costoUnitarioUSD           // Base: precio pagado al proveedor
                 + cargosProporcionados_OC    // De cargos heredados de la OC/sub-orden
                 + costoLandedProporcional_T2 // De costos landed del envio T2 (si aplica)
                 + costoLandedProporcional_EnviosSiguientes // Si pasa por mas envios
```

**Principio:** cada envio AGREGA costo, nunca resta (excepto descuentos explicitos). El CTRU es monotono creciente (excepto reversos controlados por cancelaciones).

### 10.3 UX de las 3 variantes de tarifa del Caso C

**Variante 1 — Tarifa estandar ($X por unidad):**
- Input: `monto_por_unidad`
- Calculo: `monto_total = monto_por_unidad * total_unidades`
- Prorrateo: `fijo_por_unidad` (cada unidad absorbe identico)

**Variante 2 — Por peso ($X por libra):**
- Input: `monto_por_libra`
- Calculo: `monto_total = monto_por_libra * sum(pesoLibras)`
- Prorrateo: `total_por_peso`

**Variante 3 — Monto total (ej. $150 entre 20 productos):**
- Input: `monto_total_fijo`
- Calculo directo
- Prorrateo: `total_por_peso` (default) o `total_por_valor` (si no hay peso)

**Variante 4 — Variable por producto (A=$5, B=$4, C=$3):**
- Tabla producto-tarifa
- Calculo por producto: `tarifa_producto * unidades_producto`
- Prorrateo interno: `fijo_por_unidad` dentro de cada producto

---

## 11. Estrategia de migracion de datos existentes

### 11.1 Inventario de datos

| Coleccion | Docs aprox | Impacto del cambio |
|---|---|---|
| `envios` | ~100-500 post-S40 cleanup | Agregar `tipoRutaLogistica`, `origenTipo`, `destinoTipo` (derivables) |
| `unidades` | ~2000 | Agregar `historialEnvios[]` opcional (vacio por default) |
| `ordenesCompra` | ~60 | Agregar `enviosIds[]` en sub-ordenes (derivable de envios existentes) |
| `transferencias` | X docs (legacy pre-S46) | Migrar a `envios` tipo E o mantener como vista legacy |

### 11.2 Algoritmo de derivacion

Para cada envio existente:
```
tipoRutaLogistica =
  if (envio.esDDP) -> 'B_proveedor_almacen_ddp'
  else if (envio.origenTipo === 'proveedor' && envio.destinoCasillaPais !== 'Peru') -> 'A_proveedor_casilla'
  else if (envio.origenTipo === 'casilla' && envio.destinoCasillaPais === 'Peru') -> 'C_casilla_almacen'
  else if (envio.recojoEnOrigen) -> 'D_compra_directa'
  else -> null // flagear para revision manual

origenTipo / destinoTipo = derivados similar
```

### 11.3 Plan de migracion S44

1. Script `01-derivar-tipo-ruta-logistica.mjs`: recorre envios existentes y llena `tipoRutaLogistica`
2. Script `02-normalizar-origen-destino-tipo.mjs`: llena `origenTipo` y `destinoTipo`
3. Script `03-validar-consistencia.mjs`: verifica que no haya envios con `tipoRutaLogistica = null`
4. Script `04-migrar-transferencias-a-envios-E.mjs` (S46): migra historico de `/transferencias` a `envios` tipo E

**Backup obligatorio antes:** tag git + export GCS de Firestore.

---

## 12. Modulos absorbidos y su rework

| Modulo actual | Sesion de absorbcion | Estrategia |
|---|---|---|
| `/transferencias` | S46 | Absorber en /envios tipo E; mantener ruta legacy 30 dias con redirect |
| `/ventas` (lado logistico: despacho) | S47 | Agregar envio tipo F al confirmar venta; historico de despachos pre-S47 se visualiza desde venta |
| `/ventas-devoluciones` (lado logistico: retorno) | S47 | Agregar envio tipo G al abrir devolucion; historico igual |
| `/almacenes-terceros` (no existe hoy) | S48 | Crear nueva entidad `tipoAlmacen='tercero'` vinculada a colaborador tipo Marketing/Agente |

### 12.1 Impacto UI en modulos absorbidos

**Ventas (S47):**
- Al confirmar venta, ademas de crear el documento de venta, se crea envio F
- En el detalle de la venta, seccion "Logistica" muestra el envio F vinculado (read-only desde ahi; gestion desde /envios)
- Dashboard de ventas pierde widget de "despachos pendientes" (migra a /envios tipo F pendientes)

**Transferencias (S46):**
- Listado actual de transferencias se convierte en filtro "tipo E" de /envios
- Modal de crear transferencia se convierte en modal de crear envio tipo E
- KPIs de /transferencias se migran a /envios con filtro aplicado

---

## 13. Efectos contables y financieros

### 13.1 Tabla maestra de efectos

| Tipo | Genera asiento contable | Categoria | Momento |
|---|---|---|---|
| A | No (costos ya en factura de OC) | - | - |
| B | No (costos ya en factura de OC) | - | - |
| C | **Si** | Costo logistico (costoLogistico) | Al recibir en Peru |
| D (logistico) | No | - | - |
| D (financiero, variante D1) | **Si** (en OC) | CxP al colaborador | Al confirmar OC |
| D (financiero, variante D2) | **Si** (en OC) | CxP al proveedor | Al confirmar OC |
| E | **Si** | Gasto operativo traslado | Al despachar |
| F (flete) | **Si** | Costo comercial venta | Al entregar |
| G (flete retorno, si nosotros pagamos) | **Si** | Gasto operativo devolucion | Al recibir |
| I | **Si** | Gasto marketing (al cierre) | Al no regresar antes del cierre contable |
| J | **Si** | Gasto operativo logistico | Al despachar |

### 13.2 Tesoreria

Los envios que generan pagos a colaboradores (C, E, G, I, J) deben:
- Crear CxP automatico al colaborador transportador
- Link desde el envio al registro de pago (`envio.pagoId`)
- Permitir marcar "pagado" desde el detalle del envio

---

## 14. Plan de implementacion por fases (S44-S48)

### S44 — Core inbound (A, B, C, D) + desacoplar sub-orden-envio

**Objetivo:** refactor del tramo OC -> Envio para soportar sub-envios T1 + Wizard T2 + caso D con dos variantes.

**Entregables:**
- Tipo `Envio` actualizado con `tipoRutaLogistica`, `origenTipo`, `destinoTipo`, `subEnvios[]`
- Migracion de envios existentes via scripts
- `confirmarOC()` crea envio T1 sin sub-envios (nacimiento simple)
- UI para crear sub-envios al recibir tandas parciales (timeline visual)
- Wizard T2 completo (5 pasos)
- Picking con priorizacion pre-ventas
- `DespacharEnvioModal` actualizado con labels dinamicos (ya esta en S42bl)
- Validacion UI/UX del caso D2 (deudor=proveedor con recojoEnOrigen)
- UAT con usuario antes de cerrar

**Archivos impactados (estimado):**
- `src/types/envio.types.ts`
- `src/types/unidad.types.ts`
- `src/types/ordenCompra.types.ts`
- `src/services/envio.crud.service.ts`
- `src/services/ordenCompra.crud.service.ts` (funcion `confirmarOC`)
- `src/pages/Envios/WizardT2/*` (NUEVO)
- `src/pages/Envios/SubEnviosTimeline.tsx` (NUEVO)
- `src/components/modules/ordenCompra/OCWizardV3/StepRuta.tsx` (D1 vs D2)
- `scripts/migracion-s44/*` (NUEVO)

### S45 — Caso J (Casilla-Casilla)

**Objetivo:** agregar tipo J con preferencia intra-pais.

**Entregables:**
- Wizard de envio J (4 pasos: Origen / Destino / Picking / Costos)
- Validacion "preferente mismo pais" con warning si cambia pais
- Filtros en /envios para tipo J

### S46 — Absorber Transferencias (Caso E)

**Objetivo:** mover `/transferencias` al hub Envios.

**Entregables:**
- Migracion de transferencias historicas a `envios` tipo E
- Redirect de `/transferencias` a `/envios?tipo=E`
- Documentacion de cambio para usuarios

### S47 — Absorber Ventas logistica (F + G)

**Objetivo:** unificar despacho y devolucion de ventas en Envios.

**Entregables:**
- Al confirmar venta, auto-crear envio F
- Al abrir devolucion, auto-crear envio G
- Seccion "Logistica" en detalle de venta (read-only, link a /envios)
- Estado `devuelto_pendiente_revision` implementado con flujo QA

### S48 — Almacenes de terceros (Caso I)

**Objetivo:** crear tipo de nodo "almacen tercero" con bloqueo de stock vendible.

**Entregables:**
- Nuevo tipo `tipoAlmacen='tercero'` con vinculo a colaborador Marketing/Agente
- Flag `bloqueoVendible` en envio
- Filtro en listados de stock: unidades con `bloqueadaPorEnvioId` no aparecen
- Reporte "Stock en terceros" con posibilidad de convertir a gasto de marketing

---

## 15. Pendientes / Riesgos / Validaciones previas a S44

### 15.1 Validaciones requeridas del usuario antes de codear S44

- [ ] Lectura completa del spec (todas las 15 secciones)
- [ ] Validacion del modelo de datos (seccion 4) — especialmente los nuevos campos en `Envio`
- [ ] Validacion de las tarifas Caso C (seccion 10.3) — que las 4 variantes cubren todos sus casos reales
- [ ] Validacion del flujo D1 vs D2 (seccion 5.4) — UX de la pregunta "¿quien paga al proveedor?"
- [ ] Revision de mockups HTML (archivo `docs/mockups/envios-transversal-s43.html`)
- [ ] Decision sobre momento de migracion (big-bang en S44 o gradual)

### 15.2 Riesgos tecnicos

1. **Compatibilidad con OCs pre-S44:** OCs existentes tienen `subOrden.envioId` singular. El codigo nuevo debe leer `enviosIds[]` con fallback a `[envioId]` durante al menos 90 dias.
2. **`getCargosEfectivosOC()` casos edge:** descuento a nivel OC combinado con descuento a nivel sub-orden aun no probado. Incluir tests.
3. **Recojo en origen sin reversion automatica:** si el colaborador no recoge, no hay mecanismo para rollback. Usuario debe cancelar OC manual. **No se cambia en S44, se documenta como limitacion.**
4. **Consolidacion T2 con costos landed no uniformes:** si el envio C tiene unidades de 5 OCs distintas con tarifas de colaborador heterogeneas, el prorrateo por peso puede generar distorsiones en el CTRU de unidades de OCs pequeñas. Mitigacion: documentar en UAT.
5. **Bloqueo de stock vendible (caso I):** requiere filtros globales en todos los listados de stock. Alto riesgo de missing refs si algun listado queda sin el filtro.

### 15.3 Deudas pre-existentes que deben resolverse antes o durante S44

| ID | Descripcion | Bloquea S44? |
|---|---|---|
| DEUDA-CTRU-001 | Revision completa del CTRU post-mockups (declarada al final de S42) | Recomendable antes |
| CTRU-002 | Estado 'pedida' en RELEVANT_STATES del ctruStore | Recomendable antes |
| PAG-LEGACY | Pagos pre-S35 sin `subOrdenId` | No bloquea |
| UX-D2 | Validar CxP deudor=colaborador funciona end-to-end | **Bloquea S44** (incluir como primer paso) |

### 15.4 Pendientes arquitecturales declarados pero no cerrados

- **Trazabilidad cruzada de la unidad (P7):** el spec define el campo `Unidad.historialEnvios[]`, pero falta diseñar la UI de drill-down "ver toda la historia de esta unidad" (probablemente S48 o post-go-live).
- **Reportes/Dashboards transversales:** post-S48, `bi-analyst` tendra que rehacer los dashboards logisticos (KPIs por tipo de envio, ranking de colaboradores, rentabilidad por ruta, etc.) — fuera del alcance S44-S48.
- **Alertas automaticas:** Cloud Function scaffold creado en S40 Bloque F (no deployada) debera reactivarse con los nuevos tipos de ruta.

---

## Anexo A — Ejemplo end-to-end (caso Amazon)

**Contexto:** Compra a proveedor Amazon, sub-orden con 3 fechas de entrega, consolidada posteriormente con otras 2 OCs en un envio T2 a Peru.

### Paso 1 — Creacion de OC

- OC-2026-001 con proveedor Amazon
- 1 sub-orden con 7 productos, referencia `113-7465331-5293821`
- Total USD 309.92
- `modoEntregaDetallado = 'via_courier'` (la casilla Felicita-USA recibe)
- Se confirma OC

### Paso 2 — Envio T1 auto-creado

- `ENV-2026-123` tipo `A_proveedor_casilla`
- Origen: proveedor Amazon (USA)
- Destino: casilla Felicita (Florida, USA)
- 7 unidades en `envio.unidades`
- Estado: `borrador`
- Costos landed: heredados de la sub-orden (shipping, descuento, tax si aplican)

### Paso 3 — Proveedor despacha en 3 tandas

Al recibir el primer aviso de Amazon ("tu paquete se envio el 28 marzo, entrega estimada 30 marzo"), el usuario crea sub-envios:

```
ENV-2026-123
  subEnvios:
    SE-123-1: 1 unidad (NOW Ashwagandha), fechaEntrega 30-mar, tracking TBA12345
    SE-123-2: 5 unidades, fechaEntrega 29-mar, tracking TBA67890
    SE-123-3: 1 unidad, fechaEntrega 01-abr, tracking TBA11111
```

### Paso 4 — Recepcion en casilla Felicita

- Felicita recibe SE-123-2 el 29-mar -> marca 5 unidades como `recibida_usa`
- Felicita recibe SE-123-1 el 30-mar -> marca 1 unidad como `recibida_usa`
- Felicita recibe SE-123-3 el 01-abr -> marca 1 unidad como `recibida_usa`
- Envio T1 pasa a `recibida_completa` (7/7 recibidas)

### Paso 5 — Tiempo despues: consolidacion T2

Felicita acumula:
- 7 unidades de OC-2026-001 (Amazon)
- 3 unidades de OC-2026-002 (iHerb, caso similar)
- 12 unidades de OC-2026-003 (Vitacost)
- Total: 22 unidades de 3 OCs distintas en casilla Felicita

De las 22, 4 tienen `reservadaPara` (cotizaciones con adelanto).

### Paso 6 — Wizard T2

- Usuario abre wizard en /envios -> "Casilla a Peru"
- Paso 1: selecciona casilla Felicita-USA -> sistema muestra "22 unidades disponibles de 3 OCs"
- Paso 2: checkbox "Incluir todas las prioritarias" (4 unidades resaltadas verde) + stepper agrega 10 mas -> total 14 unidades
- Paso 3: colaborador viajero "Juan Perez", fecha estimada llegada: 25-abr
- Paso 4: preset "Por peso" $8/libra, fee recepcion $15 total
- Paso 5: confirma -> crea `ENV-2026-200` tipo `C_casilla_almacen`, estado `borrador`

### Paso 7 — Despacho y recepcion

- Al viajero despegar: estado `en_transito`
- Al recibir en almacen Lima: 14 unidades pasan a `disponible_peru`
- Costos landed prorrateados al CTRU de cada unidad (por peso)
- CTRU de cada unidad se actualiza: base OC + cargos OC proporcionales + costo landed T2 proporcional

### Paso 8 — Trazabilidad

Cada unidad tiene su `historialEnvios`:
```
u1 (NOW Ashwagandha):
  historialEnvios: [
    { envioId: ENV-2026-123, tipoRutaLogistica: A, fechaRecepcion: 2026-03-30 },
    { envioId: ENV-2026-200, tipoRutaLogistica: C, fechaRecepcion: 2026-04-25 }
  ]
```

---

**Fin del spec.**

Proxima accion: validacion del usuario (seccion 15.1) + creacion de mockups HTML (`docs/mockups/envios-transversal-s43.html`).
