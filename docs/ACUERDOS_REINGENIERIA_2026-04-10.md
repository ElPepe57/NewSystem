# ACUERDOS DE REINGENIERÍA — Sesión 32
# BusinessMN v2 — Vitaskin Perú
# Fecha del debate: 2026-04-10
# Participantes: Product Owner (Jose) + Orquestador + 8 agentes de análisis
# Estado: CERRADO — 53 acuerdos + 4 decisiones de agentes

---

## ÍNDICE

1. [Contexto del debate](#1-contexto-del-debate)
2. [Perfil del usuario y del negocio](#2-perfil-del-usuario-y-del-negocio)
3. [Los 53 acuerdos](#3-los-53-acuerdos)
4. [Las 4 decisiones de agentes](#4-las-4-decisiones-de-agentes)
5. [Modelo de 3 cajas de costos](#5-modelo-de-3-cajas-de-costos)
6. [Categorías dinámicas pre-pobladas](#6-categorías-dinámicas-pre-pobladas)
7. [Los 4 flujos de negocio reales](#7-los-4-flujos-de-negocio-reales)
8. [Auditoría 360 de páginas](#8-auditoría-360-de-páginas)
9. [Resumen de los 8 reportes de agentes](#9-resumen-de-los-8-reportes-de-agentes)
10. [Plan ejecutable por fases](#10-plan-ejecutable-por-fases)
11. [Reglas inamovibles post-debate](#11-reglas-inamovibles-post-debate)

---

## 1. CONTEXTO DEL DEBATE

### Por qué se hace esta reingeniería

El sistema actual tiene un modelo de Compras-Transferencias-Inventario que fue diseñado de manera incremental, sesión a sesión, y acumuló deuda conceptual que ya no es sostenible. Los problemas específicos que motivaron el debate son:

**Problema 1 — modoEntrega es un modelo pobre**
El campo `modoEntrega` en OrdenCompra solo tiene 2 valores: `viajero` y `directo`. Esto mezcla conceptos completamente diferentes: quién transporta, cómo se paga el envío, si hay un almacén intermedio, si hay un courier externo. El viajero Angie Price y un courier DHL son tratados igual por el sistema, pero operativamente son radicalmente distintos.

**Problema 2 — Almacenes y Viajeros son la misma cosa modelados por separado**
Un viajero tiene una casilla de almacenamiento temporal. Un almacén físico en Perú pertenece a la empresa. Un courier externo también tiene una ubicación virtual. Todos deberían ser una sola entidad "Colaborador" con sus "Casillas". Actualmente son módulos separados con lógica duplicada.

**Problema 3 — GA/GO se prorratean al CTRU incorrectamente**
Los gastos administrativos y operativos del período (planilla, alquiler, servicios) se distribuyen al costo unitario de cada producto, lo que contamina el CTRU con costos que no son atribuibles directamente. Esto viola el principio de causalidad contable y hace que el CTRU sea una mezcla de "costo real de importar" más "costo de existir como empresa". Los 3 niveles de rentabilidad (Bruto, Contribución, Operativo) no pueden calcularse correctamente con este modelo.

**Problema 4 — Pool USD es una entidad separada redundante**
El Pool USD tiene sus propias colecciones (`poolUSDMovimientos`, `poolUSDSnapshots`) que replican información que ya existe en Tesorería. El TCPA (Tipo de Cambio Promedio Ajustado) debería calcularse directamente desde los movimientos de las cuentas USD en Tesorería. Mantener dos sistemas paralelos genera inconsistencias y doble trabajo.

**Problema 5 — Unidades nacen al recibir, no al pedir**
En el flujo actual, las unidades solo existen en el sistema cuando físicamente se reciben. Esto impide dar trazabilidad desde el momento en que se hace el pedido, no permite reservar stock que está en camino, y no refleja la realidad operativa del negocio.

**Problema 6 — Costos de importación viven en Gastos, no en el Envío**
Actualmente, el flete de un viajero se registra como un "Gasto" con tipo `flete_internacional`, y luego el sistema intenta prorratear ese gasto al CTRU de los productos. Esta es una cadena rota: el gasto no sabe a qué productos afecta, el prorrateo es manual o aproximado, y los tipos de gasto (`GV`, `GD`, `GA`, `GO`) son una nomenclatura interna sin correspondencia con la realidad del negocio.

### La solución acordada

Hacer una reingeniería incremental por capas (NO Big Bang) que:
- Reemplaza `almacen` por `casilla` y `transferencia` por `envio` en todo el sistema
- Crea el concepto de `Colaborador` (empresa, viajero, courier externo, transportista local)
- Mueve los costos de importación al `Envío`, donde naturalmente pertenecen
- Elimina GA/GD/GV/GO como nomenclatura, reemplazando con 3 cajas de costos
- Fusiona Pool USD como vista agregada dentro de Tesorería
- Hace que las unidades nazcan al confirmar la OC (estado `pedida`)
- Implementa categorías de costos/gastos dinámicas editables desde UI

---

## 2. PERFIL DEL USUARIO Y DEL NEGOCIO

Este contexto es crítico para entender POR QUÉ se tomaron ciertas decisiones. No es un ERP genérico — es un sistema para este negocio específico.

**Jose — Product Owner y Dueño del negocio**
- Dueño de microempresa importadora: Vitaskin Perú
- No tiene formación contable profunda — necesita lenguaje simple y directo
- Opera de manera informal (sin incoterms, sin contratos formales de transporte)
- Trabaja solo (equipo de 1 en el ERP)
- Toma decisiones con velocidad: el sistema debe reflejar eso

**Modelo de negocio**
- Importa suplementos (SUP) y skincare (SKC) desde USA y China
- Vende principalmente en Mercado Libre + venta directa
- Delivery con Olva, Shalom, motorizados
- 2 líneas de negocio activas: SUP y SKC

**Cómo compra**
- Amazon USA (Subscribe & Save, cobra flete por separado en algunos casos)
- Asian Beauty (China, DDP = entrega en puerta, sin cargos adicionales)
- Paga con tarjetas de crédito de alto límite en USD
- Siempre paga 100% al cierre de la tarjeta (sin saldos mínimos ni pagos parciales)
- El diferencial cambiario surge entre el día que se carga la compra y el día que paga al banco

**Cómo transporta**
- Angie Price: viajera en California que recibe los pedidos de Amazon y los lleva físicamente a Perú. Cobra por llevar los productos (flete variable por paquete/peso). A veces no hay Angie — los productos quedan en California hasta el próximo viaje.
- DHL y couriers similares: para pedidos DDP de China (Asian Beauty), el proveedor paga el envío y DHL entrega directamente en Lima. No hay costo de flete para Jose.
- Hay casos donde Amazon cobra envío (no Subscribe & Save) o donde hay costos de importación en Perú (agente aduanero, impuestos).

**Almacén**
- ALM-PE-001: almacén principal en Lima (Vitaskin Perú)
- Angie tiene su casilla en California como almacén temporal

**Qué no usa / no le aplica**
- Incoterms (EXW, CIF, FOB): conceptos demasiado formales para su operación
- Contratos de transporte: opera por acuerdo verbal con Angie
- SUNAT / Facturación electrónica: gap regulatorio critico, fuera del alcance actual
- EsSalud / CTS / AFP: planilla informal

---

## 3. LOS 53 ACUERDOS

### BLOQUE A — MODELO DE DATOS (Acuerdos 1-11)

---

**Acuerdo 1 — TC referencial en OC + TCPA real al pagar desde Pool USD**

Descripcion: Las órdenes de compra se crean con un `tcReferencial` (el tipo de cambio del día que se hace la orden). Este valor sirve para estimar costos en soles al momento de crear la OC. Cuando Jose paga la tarjeta de crédito al banco (días o semanas después), el pago real usa el TCPA vigente en ese momento. El diferencial entre `tcReferencial` y el TC del día del pago es la ganancia o pérdida cambiaria registrada en el sistema.

Alternativas descartadas:
- Usar solo un TC por OC (perdería el diferencial cambiario real)
- No registrar el diferencial (invisibiliza un costo/beneficio real del negocio)

Impacto en el sistema:
- Campo `tcReferencial` nuevo en `OrdenCompra`
- El diferencial cambiario se calcula en el módulo de pagos al registrar el pago al banco
- Visible en Dashboard como "Impacto FX del mes" (Acuerdo 33/47)

---

**Acuerdo 2 — Toda OC pasa obligatoriamente por N envíos**

Descripcion: No existe recepción directa de productos sin un Envío de por medio. Toda OC debe tener al menos un Envío (anteriormente "Transferencia") que registre el movimiento físico de los productos. Cuando se confirma una OC, el sistema crea automáticamente el primer Envío (T1) en estado `borrador`. El usuario puede agregar más envíos si los productos viajan por etapas (ej. Amazon → Angie → Lima = 2 envíos).

Alternativas descartadas:
- Recepción directa en OC sin Envío intermedio: descartado porque no hay manera de registrar costos de transporte sin un Envío
- Envíos opcionales: descartado porque genera flujos inconsistentes donde algunos productos tienen costos de transporte y otros no

Impacto en el sistema:
- `ordenCompra.crud.service.ts`: al confirmar OC, crea automáticamente Envío T1 en estado `borrador`
- `ordenCompra.recepcion.service.ts`: deprecado completamente (ya no hay recepción directa en OC)
- UI: el flujo de OC guía al usuario al Envío automáticamente

---

**Acuerdo 3 — Costos de importación viven en el Envío, NO en la OC ni en Gastos**

Descripcion: Todo costo relacionado con llevar un producto desde el proveedor hasta el almacén (flete viajero, flete courier, impuestos de importación, agente aduanero, seguros, manipuleo) se registra en el Envío como `costosLanded[]`. Estos costos se prorratean al CTRU de los productos de ESE envío. Los gastos del período (planilla, alquiler) se registran en una colección separada `gastosPeriodo` y nunca tocan el CTRU.

Alternativas descartadas:
- Costos en la OC: la OC representa el precio de los productos, no el costo de transportarlos
- Costos como "Gasto" con flags `impactaCTRU`: genera prorrateo manual, roto, y difícil de auditar
- Costos como colección separada `costosImportacion`: redundante, ya el Envío es el contenedor natural

Impacto en el sistema:
- `Envio` tiene campo `costosLanded: CostoLanded[]`
- `ctru.service.ts`: simplificado, solo lee precio de OC + costos landed del Envío
- `gasto.service.ts`: eliminados tipos de importación (`flete_internacional`, `recojo_local`, etc.)

---

**Acuerdo 4 — Estados de OC: borrador → confirmada → en_proceso → despachada → completada → cancelada**

Descripcion: El ciclo de vida de la OC ahora tiene 6 estados bien definidos:
- `borrador`: OC en creación, no ha generado unidades ni envíos
- `confirmada`: OC aprobada, se crean unidades en estado `pedida` y se crea Envío T1 automáticamente
- `en_proceso`: al menos una unidad ya salió del estado `pedida` (está en tránsito)
- `despachada`: todas las unidades salieron del proveedor
- `completada`: todas las unidades llegaron a su casilla destino
- `cancelada`: OC cancelada antes de completarse

Alternativas descartadas:
- Estados anteriores (pendiente, procesando, recibida, etc.): no reflejan el flujo real
- Menos estados (3-4): pierden granularidad para el seguimiento

Impacto en el sistema:
- `ordenCompra.types.ts`: `EstadoOrden` actualizado
- Dashboard y Reportes muestran OCs por estado nuevo

---

**Acuerdo 5 — OC con Sub-Órdenes: 1 OC matriz → N sub-órdenes**

Descripcion: Cuando Jose compra en Amazon, puede hacer varios pedidos en el mismo "lote de compra" que tienen diferentes referencias de proveedor, totales distintos, y productos distintos. En lugar de crear N OCs separadas (que pierde la visión de compra del mismo período), se crea 1 OC matriz y N sub-órdenes. Cada sub-orden tiene: su propia referencia del proveedor, su propio total en USD, sus propios productos, y genera su propio Envío T1 automáticamente.

Alternativas descartadas:
- N OCs separadas por pedido: pierde el contexto de que todo vino del mismo batch de compra
- Solo 1 OC sin sub-órdenes: no puede manejar múltiples referencias de factura del proveedor

Impacto en el sistema:
- `SubOrdenCompra` nueva interface con `referenciaProveedor`, `totalUSD`, `productos[]`
- `OC.subOrdenes[]` array opcional
- Al crear sub-órdenes, cada una genera su Envío T1 automáticamente
- `subOrden.service.ts` nuevo

---

**Acuerdo 6 — Unidades nacen al confirmar OC en estado "pedida"**

Descripcion: Actualmente las unidades nacen cuando se reciben físicamente. En el nuevo modelo, las unidades nacen en el momento en que se confirma la OC, en estado `pedida`. Esto permite: (a) trazabilidad completa desde el pedido, (b) reservar stock "en camino", (c) ver en cualquier momento cuántos productos están pedidos pero aún no recibidos. La `casillaActualId` de una unidad `pedida` apunta a la "ubicación virtual" del proveedor (Acuerdo 15).

Alternativas descartadas:
- Unidades al recibir (modelo actual): no permite trazabilidad pre-llegada ni reservas tempranas
- Unidades al despachar el proveedor: difícil de implementar sin integración con el proveedor

Impacto en el sistema:
- `ordenCompra.crud.service.ts`: al confirmar OC, crear N unidades con estado `pedida`
- `unidad.types.ts`: `EstadoUnidad` incluye `pedida` como primer estado
- Cloud Function `onOrdenCompraRecibida`: trigger cambia de `recibida` a `confirmada`

---

**Acuerdo 7 — Estados de unidad rediseñados con 3 estados de excepción**

Descripcion: El flujo normal de una unidad es: `pedida` → `en_transito` → `disponible` → `reservada` → `asignada_venta` → `vendida`. Adicionalmente existen 3 estados de excepción que pueden ocurrir en cualquier momento del flujo:
- `danada`: unidad físicamente dañada, no vendible
- `perdida`: unidad extraviada o decomisada definitivamente
- `retenida_aduana`: unidad bajo retención aduanera, podría liberarse o decomisarse

Los estados anteriores (`recibida_origen`, `en_transito_origen`, `en_transito_peru`, `disponible_peru`, `asignada_pedido`) son eliminados.

Alternativas descartadas:
- Mantener estados actuales con aliases: genera confusión y código duplicado
- Estado único `en_proceso` para todo el tránsito: pierde granularidad

Impacto en el sistema:
- `unidad.types.ts`: enum `EstadoUnidad` completo reemplazado
- `ctru.service.ts`: `ACTIVE_STATES` actualizado a `['disponible', 'reservada', 'asignada_venta']`
- `ml.stock.ts` CF: `disponible_peru` → `disponible`
- Pipeline visual en Inventario y Unidades rediseñado

---

**Acuerdo 8 — Reserva y asignación son estados separados, NO flags booleanos**

Descripcion: En el modelo actual existe confusión entre `reservada` (intención de compra) y `asignada_pedido` (comprometida a una venta específica). En el nuevo modelo son estados explícitos y distintos del enum `EstadoUnidad`. No hay campos booleanos como `estaReservada: boolean` — el estado del enum es la única fuente de verdad.

Alternativas descartadas:
- Flag `reservada: boolean` adicional al estado: genera inconsistencias (estado=disponible pero reservada=true)
- Un solo estado `reservada` que mezcla ambos conceptos: no permite distinguir en reportes

Impacto en el sistema:
- `unidad.types.ts`: `EstadoUnidad` = `pedida | en_transito | disponible | reservada | asignada_venta | vendida | danada | perdida | retenida_aduana`
- Servicios de cotización y requerimiento actualizados para escribir el estado correcto

---

**Acuerdo 9 — Reserva puede existir desde Requerimiento antes de que exista la OC**

Descripcion: El flujo de negocios en Vitaskin contempla que un cliente puede hacer un adelanto sobre un producto que no existe aún en stock. Hay 3 tipos de reserva:
- Tipo A (intención): cliente pide pero no paga adelanto → unidad marcada como `reservada` si existe en stock
- Tipo B (adelanto): cliente paga adelanto → unidad `reservada` con referencia al pago
- Tipo C (sobre unidad existente): venta directa sobre unidad ya `disponible`

La reserva puede existir como "intención" en el Requerimiento aunque aún no haya OC creada.

Alternativas descartadas:
- Solo permitir reservas sobre stock existente: no refleja el negocio real donde hay adelantos sobre pedidos futuros

Impacto en el sistema:
- `Requerimiento` tiene campo `reservado: boolean` + `tipoReserva: 'intencion' | 'adelanto' | 'existente'`
- Lógica en `requerimiento.service.ts` para gestionar los 3 tipos

---

**Acuerdo 10 — Traspaso de reserva: del Requerimiento a las unidades al crear la OC**

Descripcion: Cuando existe un Requerimiento con `reservado: true` y el usuario crea la OC correspondiente, las unidades que nacen en estado `pedida` deben nacer directamente en estado `reservada`. Este es el "traspaso de reserva": el sistema reconoce que esas unidades ya tienen dueño antes de llegar. Se identifica el requerimiento por `productoId` + `varianteId` (si aplica).

Alternativas descartadas:
- Traspaso manual (el usuario asigna reserva después de recibir): genera el problema de que lleguen los productos y el usuario olvide asignarlos

Impacto en el sistema:
- `ordenCompra.crud.service.ts`: al crear unidades, busca requerimientos `reservados` del mismo producto y crea las unidades en `reservada` directamente

---

**Acuerdo 11 — Recepción parcial distribuida en el tiempo**

Descripcion: Es posible recibir un pedido en múltiples entregas a lo largo del tiempo. Una OC de 20 unidades puede recibir 5 unidades hoy y 15 unidades en 3 semanas. Las unidades `pedida` no caducan ni se pierden automáticamente. La OC alcanza estado `completada` cuando TODAS las unidades salen del estado `pedida`. El usuario puede recibir parcialmente sin forzar el cierre de la OC.

Alternativas descartadas:
- Forzar recepción total en un solo envío: no refleja la realidad operativa (Amazon a veces divide envíos)
- Cancelar automáticamente unidades `pedida` después de X días: genera pérdida de trazabilidad

Impacto en el sistema:
- `envio.recepcion.service.ts`: permite recepción parcial, OC se completa cuando count(pedida) = 0
- OC estado `recibida_parcial` se detecta cuando hay mezcla de unidades `pedida` y `disponible`

---

### BLOQUE B — RED LOGÍSTICA (Acuerdos 12-19)

---

**Acuerdo 12 — 4 tipos de colaborador**

Descripcion: La "Red Logística" de Vitaskin tiene 4 tipos de actores que manejan físicamente los productos:

1. `empresa`: la propia Vitaskin Perú como entidad corporativa, dueña del almacén principal
2. `viajero`: persona física (como Angie Price) que transporta productos en sus maletas y tiene una casilla temporal donde los almacena
3. `courier_externo`: empresa de mensajería internacional (DHL, FedEx, etc.) que mueve paquetes sin almacenarlos personalmente
4. `transportista_local`: empresa o persona que hace delivery local en Perú (Olva, Shalom, motorizados)

Todos comparten la entidad `Colaborador`. Lo que los diferencia es su tipo y sus tarifas.

Alternativas descartadas:
- Mantener Viajeros y Almacenes como módulos separados: duplica lógica y pantallas
- Solo 2 tipos (interno/externo): pierde granularidad para métricas por tipo

Impacto en el sistema:
- Nueva colección `colaboradores` con campo `tipo: 'empresa' | 'viajero' | 'courier_externo' | 'transportista_local'`
- `colaborador.types.ts` nuevo
- Módulo "Red Logística" en Maestros reemplaza Viajeros + Almacenes

---

**Acuerdo 13 — Vitaskin Perú como entidad corporativa dueña del almacén principal**

Descripcion: ALM-PE-001 (el almacén principal en Lima) pertenece a la entidad "Vitaskin Perú" que es un Colaborador de tipo `empresa`. Este colaborador empresa es el único que tiene `esPropietario: true`. Las casillas de la empresa son las únicas que se pueden marcar como `esPrincipal: true`.

Impacto en el sistema:
- Seed de datos: crear Colaborador "Vitaskin Perú" tipo empresa al inicializar
- `Casilla.colaboradorId` apunta a este colaborador para ALM-PE-001

---

**Acuerdo 14 — Casillas con stock real, cada una pertenece a un colaborador (N:1)**

Descripcion: Una "Casilla" (anteriormente "Almacén") es el lugar físico o virtual donde están los productos en un momento dado. Cada casilla pertenece a exactamente 1 colaborador. Un colaborador puede tener N casillas (Angie podría tener casilla en CA y en NY si fuera el caso). Las casillas registran el stock real en cada punto de la red.

Impacto en el sistema:
- `Casilla.colaboradorId` es obligatorio (referencia a Colaborador)
- UI Red Logística: casillas anidadas bajo cada colaborador

---

**Acuerdo 15 — Proveedores tienen ubicación virtual auto-generada para unidades "pedida"**

Descripcion: Los proveedores (Amazon, Asian Beauty, etc.) NO son Colaboradores. Son una entidad separada. Sin embargo, cuando nacen las unidades en estado `pedida`, necesitan una `casillaActualId`. Para esto, el sistema auto-genera una "casilla virtual" para cada proveedor al momento de crear la primera OC con ese proveedor. Esta casilla virtual no aparece en la Red Logística ni tiene stock físico real — es solo un marcador de ubicación para las unidades `pedida`.

Alternativas descartadas:
- Null para `casillaActualId` de unidades pedida: rompe queries que filtran por casilla
- Proveedores como Colaboradores: conceptualmente incorrecto (un proveedor no forma parte de la red logística)

Impacto en el sistema:
- `Proveedor` gana campo `casillaVirtualId` que se crea automáticamente
- Las casillas virtuales tienen un flag `esVirtual: true` para excluirlas de pantallas de Red Logística

---

**Acuerdo 16 — Courier externo mide tiempos y eficiencia**

Descripcion: Los couriers externos (DHL, FedEx) son Colaboradores de tipo `courier_externo`. Al modelarlos así, el sistema puede medir: tiempo promedio de entrega por courier, tasa de daños, costo promedio por kg. Esto habilita comparar couriers en el futuro.

Impacto en el sistema:
- `MetricasColaborador` incluye: `tiempoPromedioEntrega`, `tasaDanos`, `costoPorKg`
- Estas métricas se actualizan al cerrar cada Envío

---

**Acuerdo 17 — Transportistas locales son el 4to tipo de colaborador**

Descripcion: Olva, Shalom y los motorizados que hacen delivery a clientes en Lima son Colaboradores de tipo `transportista_local`. Al registrarlos como colaboradores, el costo de delivery puede vincularse a la venta como "Costo por Venta" con categoría "Distribución" (ver Bloque C).

Impacto en el sistema:
- Los costos de delivery de ventas referencian `colaboradorId` del transportista local
- `costosVenta[]` en la venta incluye el costo de delivery con `colaboradorId`

---

**Acuerdo 18 — "Red Logística" unificada reemplaza Viajeros + Almacenes en Maestros**

Descripcion: La pantalla actual en Maestros tiene dos secciones separadas: "Viajeros" y "Almacenes". Estas se unifican en una sola pantalla "Red Logística" con 4 subsecciones (Empresa, Viajeros, Couriers Externos, Transportistas Locales). Cada sección muestra sus casillas anidadas.

Alternativas descartadas:
- Mantener pantallas separadas: confunde al usuario que necesita ver toda la red en un vistazo
- Una sola lista plana sin agrupar: pierde la jerarquía visual

Impacto en el sistema:
- `pages/Maestros/RedLogistica.tsx` nuevo (reemplaza `ViajerosList.tsx` + `AlmacenesList.tsx`)
- Sidebar: "Viajeros" y "Almacenes" desaparecen, aparece "Red Logística"

---

**Acuerdo 19 — Renombrar "Transferencia" → "Envío" en todo el sistema**

Descripcion: El término "Transferencia" es técnico y ambiguo (puede confundirse con transferencia bancaria). "Envío" refleja mejor el concepto: el movimiento físico de productos de un punto A a un punto B. El cambio es en todo el sistema: colecciones, tipos, servicios, stores, páginas, componentes, labels de UI, prefijos de secuencia. Prefijo de secuencia: `TRF-` pasa a ser `ENV-`. Prefijos de casilla: `ALM-` pasa a `CAS-`. Prefijos de colaborador: `VIA-` pasa a `COL-`.

Alternativas descartadas:
- Renombrar solo en UI pero mantener nombres internos: genera confusión en el código
- Mantener "Transferencia": no comunica el concepto correcto al usuario

Impacto en el sistema: ~3,000 ocurrencias en ~160 archivos (Fase 2 del plan)

---

### BLOQUE C — COSTOS Y CONTABILIDAD (Acuerdos 20-28)

---

**Acuerdo 20 — 3 cajas de costos que NUNCA se mezclan**

Descripcion: El núcleo del modelo contable nuevo. Existen exactamente 3 cajas de costos completamente separadas:

**Caja 1 — CTRU / Costo de Importación (por unidad de producto)**
- Qué incluye: precio del producto en la OC + costos landed del Envío (flete, aduana, seguros)
- Quién lo lleva: cada unidad individual
- Cuándo se congela: cuando la unidad llega a estado `disponible`
- Nivel de rentabilidad: Margen Bruto

**Caja 2 — Costos por Venta (por transacción de venta)**
- Qué incluye: comisión ML, delivery (Olva/Shalom/motorizado), empaque del kit
- Quién lo lleva: cada venta individual
- Cuándo se registra: al confirmar la venta/despacho
- Nivel de rentabilidad: Margen Contribución

**Caja 3 — Gastos Fijos del Período (por mes)**
- Qué incluye: planilla, alquiler, servicios, software, contador, movilidad
- Quién lo lleva: el período (mes)
- Cuándo se registra: cuando ocurre el gasto
- Nivel de rentabilidad: Resultado Operativo

La regla de oro: ningún monto de Caja 3 puede entrar a Caja 1 ni a Caja 2. El cruce solo ocurre en el P&L final.

Impacto en el sistema: ver Sección 5 del documento para las fórmulas exactas.

---

**Acuerdo 21 — GA/GO dejan de prorratearse al CTRU — ELIMINACIÓN TOTAL 360°**

Descripcion: Los conceptos `GA` (Gasto Administrativo), `GO` (Gasto Operativo), `GV` (Gasto de Venta), `GD` (Gasto de Distribución) y sus combinaciones (`GAO`, `GVD`) se eliminan completamente del sistema. No existen como categorías, no existen como flags, no existen como etiquetas en la UI. Ninguna pantalla, ningún reporte, ningún campo, ningún comentario en código usa esta nomenclatura.

El prorrateo de gastos del período al CTRU se elimina. Esta es la decisión más impactante de toda la reingeniería.

Alternativas descartadas:
- Mantener GA/GO como aliases temporales: confunde al usuario con lenguaje contradictorio
- Prorratear pero de forma diferente: el principio es incorrecto, no la fórmula

Impacto en el sistema:
- `ctru.service.ts`: eliminar `calcularGAGOProporcional()`, `costoGAGOAsignado`
- `unidad.types.ts`: eliminar campos `costoGAGOAsignado`, `costoGAAsignado`, `costoGOAsignado`
- `gasto.types.ts`: eliminar `CategoriaGasto`, `ClaseGasto`, enum GA/GO/GV/GD
- Contabilidad, Proyección, Reportes: eliminar labels hardcodeados con GA/GO
- ~3,000 ocurrencias de renaming identificadas por code-quality-refactor-specialist

---

**Acuerdo 22 — Costos de un envío SOLO afectan productos de ESE envío**

Descripcion: La regla atributiva de costos: si un flete cuesta $50 y transporta 3 productos A, B y C, ese costo de $50 se distribuye SOLO entre A, B y C. No puede afectar productos que llegaron por otro envío, aunque hayan llegado el mismo día. Cada envío es un silo de costos.

Alternativas descartadas:
- Prorratear costos a todos los productos en inventario en ese momento: incorrectos conceptualmente (un producto que llegó hace 3 meses no tiene por qué absorber el flete de hoy)

Impacto en el sistema:
- `envio.crud.service.ts`: `costosLanded[]` solo referencia unidades de ese envío
- `ctru.service.ts`: busca costos landed filtrando por `envioId`

---

**Acuerdo 23 — Prorrateo flexible: 3 métodos por costo**

Descripcion: Para distribuir un costo del Envío entre los productos de ese envío, hay 3 métodos disponibles y cada costo elige el suyo:

1. `fijo_por_unidad`: el viajero cobra $X por cada unidad sin importar el producto (ej. "$5 por bulto")
2. `variado_por_producto`: el viajero cobra diferente por cada producto (ej. proteína $8/unidad, vitamina $3/unidad) — se captura en tabla
3. `total_por_peso_o_valor`: se ingresa el monto total y el sistema lo prorratea automáticamente según peso (para flete) o valor (para impuestos y aranceles)

El método se define por `CostoLanded.metodoProrrateo`.

Alternativas descartadas:
- Solo prorrateo por cantidad (dividir igual entre todos): no refleja que una proteína pesa más que una vitamina
- Solo prorrateo manual sin métodos: demasiado trabajo para el usuario

Impacto en el sistema:
- `CostoLanded.metodoProrrateo: 'fijo_por_unidad' | 'variado_por_producto' | 'total_por_peso' | 'total_por_valor'`
- `envio.crud.service.ts`: lógica de prorrateo para los 3 métodos

---

**Acuerdo 24 — Flete prorratea por PESO. Aduana/impuestos prorratea por VALOR**

Descripcion: Regla estándar de decisión para el prorrateo:
- Costos de transporte físico (flete viajero, flete courier): prorratear por PESO en libras (`pesoLibras` del producto). Una proteína de 5 lbs que ocupa más espacio absorbe más flete.
- Costos regulatorios/financieros (aduana, impuesto de importación, cargo del proveedor): prorratear por VALOR del producto (precio USD). Un producto más caro absorbe más de los impuestos proporcionales.

Regla especial: flete local (recojo aeropuerto) prorratea por VALOR, no por peso (ver Acuerdo 46).

Impacto en el sistema:
- `CostoLanded` distingue categoría para sugerir el método de prorrateo por defecto
- UI: al agregar un costo de tipo "Transporte", el método sugerido es `total_por_peso`; para "Aranceles", sugerido es `total_por_valor`

---

**Acuerdo 25 — Cargos de OC se heredan automáticamente al Envío T1**

Descripcion: Cuando se crea una OC con cargos del proveedor (por ejemplo, Amazon cobra $15 de envío en el pedido), esos cargos se heredan automáticamente al Envío T1 que se crea al confirmar la OC. El usuario puede editarlos en el Envío antes de cerrarlo. La herencia es automática pero no obligatoria — el usuario puede borrar o modificar los cargos heredados.

Impacto en el sistema:
- `ordenCompra.crud.service.ts`: al crear Envío T1, copiar `cargosOC[]` como `costosLanded[]` iniciales
- El usuario ve estos costos pre-cargados en el modal de edición del Envío

---

**Acuerdo 26 — Costos editables hasta cerrar el envío**

Descripcion: Mientras el Envío no esté en estado `recibida_completa` o `recibida_parcial`, los costosLanded[] son editables. El usuario puede agregar, modificar o eliminar costos en cualquier momento del proceso (mientras el envío esté `en_transito` o `confirmado`). Una vez que se registra la recepción y el Envío cierra, los costos se congelan junto con el CTRU.

Impacto en el sistema:
- `envio.crud.service.ts`: validación que bloquea edición de costos en estados cerrados
- UI: el botón de editar costos está activo hasta que el envío cierra

---

**Acuerdo 27 — Gastos históricos de GA/GO se limpian con el reset de BD**

Descripcion: La BD transaccional se limpia como parte de la Fase 0 de la reingeniería (ver Plan Ejecutable). Esto incluye todos los documentos en la colección `gastos` que tengan los tipos de importación o con flags de `impactaCTRU`. El reset de BD es la oportunidad para partir con datos limpios sin necesidad de migración de gastos históricos.

Impacto en el sistema:
- `scripts/reingenieria/00-limpieza-total.mjs`: incluye eliminación de gastos tipo importación

---

**Acuerdo 28 — Tipos de gasto obsoletos se eliminan definitivamente**

Descripcion: Los siguientes tipos de gasto se eliminan permanentemente del sistema, sin aliases ni backwards compatibility:
- `flete_internacional`
- `recojo_local`
- `almacenaje`
- `internacion`
- `GA`, `GO`, `GV`, `GD` (y sus combinaciones)

Estos conceptos pasan a vivir en el catálogo dinámico de `categoriasCostos` bajo el bloque "importacion" o "venta" según corresponda.

---

### BLOQUE D — PAGOS Y FINANZAS (Acuerdos 29-33)

---

**Acuerdo 29 — Tarjetas de crédito modeladas como pasivos**

Descripcion: Jose paga con tarjetas de crédito de alto límite en USD. El sistema modela estas tarjetas como pasivos (deudas) con los siguientes campos:
- `banco`: nombre del banco emisor
- `limite`: límite de crédito en USD
- `saldoActual`: deuda acumulada actual
- `fechaCorte`: día del mes en que cierra el estado de cuenta
- `fechaPago`: día del mes en que Jose paga

Cada compra cargada a la tarjeta crea un pasivo. Jose siempre paga 100% al cierre — el sistema registra el pago total al banco y calcula el diferencial cambiario en ese momento.

Alternativas descartadas:
- Modelar como cuenta corriente bancaria: las tarjetas son pasivos, no activos
- Registrar el gasto solo cuando se paga el banco: pierde la fecha real de la compra y el diferencial cambiario

Impacto en el sistema:
- Nueva colección `tarjetasCredito`
- `tarjetaCredito.service.ts` nuevo
- Módulo de Tesorería: sección "Tarjetas de Crédito" con saldo/límite visible

---

**Acuerdo 30 — Pool USD pasa a ser vista agregada sobre cuentas USD de Tesorería**

Descripcion: Las colecciones `poolUSDMovimientos` y `poolUSDSnapshots` se deprecan. El TCPA (Tipo de Cambio Promedio Ajustado) se calcula en tiempo real desde los movimientos de las cuentas en USD dentro de Tesorería (usando promedio ponderado de las entradas de USD). La pantalla de "Rendimiento Cambiario" sigue existiendo pero ahora lee de Tesorería en lugar de colecciones propias.

Alternativas descartadas:
- Mantener Pool USD como entidad independiente: datos duplicados, inconsistencias posibles
- Eliminar el concepto de Pool USD y TCPA: el diferencial cambiario es información financiera valiosa para Jose

Impacto en el sistema:
- `poolUSD.service.ts`: refactorizado para ser un "view service" que agrega datos de Tesorería
- `poolUSDStore.ts`: fusionado con `tesoreriaStore.ts`
- Colecciones: `poolUSDMovimientos` y `poolUSDSnapshots` archivadas/eliminadas en Fase 7

---

**Acuerdo 31 — Módulo unificado de pagos: única salida de caja**

Descripcion: Todo movimiento de salida de caja debe estar vinculado a exactamente un documento de origen: una OC, un Envío, una Venta (nota de crédito/devolución), un Gasto de Período, o la Planilla. No pueden existir salidas "sueltas" sin referencia. El módulo de pagos masivos (TAREA-101) ya implementa este principio y se extiende para cubrir los nuevos tipos de origen.

Impacto en el sistema:
- `pagoUnificado.service.ts`: agregar tipos de origen `envio`, `tarjetaCredito`
- Validación: un movimiento sin `origenId` y `origenTipo` es rechazado

---

**Acuerdo 32 — Diferencial cambiario en compras con tarjeta**

Descripcion: El ciclo completo de una compra con tarjeta:
1. Día de compra: Jose compra en Amazon a TC del día → registro con `tcReferencial`
2. Días después: tarjeta cierra → saldo en USD confirmado
3. Día de pago al banco: Jose paga 100% del saldo → TC del día del pago (`tcPago`)
4. Diferencial = (tcPago - tcReferencial) × montoUSD → positivo = ganancia, negativo = pérdida

El diferencial se registra como un movimiento de Tesorería tipo `diferencial_cambiario` vinculado a la tarjeta.

Impacto en el sistema:
- `tarjetaCredito.service.ts`: función `registrarPagoAlBanco()` que calcula y registra el diferencial
- Dashboard: "Impacto FX del mes" suma todos los diferenciales del período

---

**Acuerdo 33 — Diferencial cambiario 360° integrado**

Descripcion: El diferencial cambiario aparece en 4 puntos del sistema:
1. OC: TC referencial vs TC del día que se confirma el pago
2. Envío: costos en USD con TCPA del día del pago
3. Venta: margen calculado con CTRU real (TCPA) vs nominal (TC del día de la venta)
4. Cierre mensual: revaluación de saldos en USD al TC del cierre

Esto habilita el reporte "¿Cuánto ganó o perdió el negocio por el tipo de cambio este mes?"

---

### BLOQUE E — RECEPCIÓN Y CALIDAD (Acuerdos 34-39)

---

**Acuerdo 34 — Escáner opcional en recepción final**

Descripcion: Al recibir el Envío final (el que llega al almacén ALM-PE-001 en Lima), el escáner de UPC es una herramienta opcional pero recomendada. En el flujo de recepción, el usuario puede:
- Escanear el UPC de cada unidad para confirmar que es el producto correcto
- Ingresar la fecha de vencimiento manualmente o por lectura del código
- Marcar unidades como dañadas o perdidas durante la revisión

El escáner NO es obligatorio — si Jose no lo usa, puede confirmar la recepción manualmente.

---

**Acuerdo 35 — Fechas de vencimiento solo en el envío final**

Descripcion: La fecha de vencimiento de un producto solo se captura en el Envío final (el que llega al almacén de destino, ALM-PE-001). No se captura en envíos intermedios (ej. el envío Amazon → Angie). Esto porque en los envíos intermedios el producto aún está empacado y no siempre hay acceso para leer la fecha de vencimiento.

Impacto en el sistema:
- `envio.recepcion.service.ts`: campo `fechaVencimiento` solo en recepción final
- `Unidad.fechaVencimiento` se establece al cerrar el envío final

---

**Acuerdo 36 — Pérdida = gasto extraordinario, no distorsiona el CTRU de las sobrevivientes**

Descripcion: Si durante el tránsito se pierde una unidad (se rompe, se extravía, se decomisa), esa unidad pasa a estado `perdida`. El costo de esa unidad no se redistribuye entre las unidades que sí llegaron. En cambio, se registra como "Gasto Extraordinario" en la Caja 3 (Gastos del Período) con sub-categoría específica.

Sub-categorías de recuperación:
- `perdida_sin_recuperacion`: sin seguro, sin reclamo posible
- `perdida_con_seguro_pendiente`: hay reclamo de seguro en proceso
- `perdida_con_recuperacion_parcial`: se recibió compensación parcial del seguro/courier
- `perdida_con_recuperacion_total`: se recibió compensación completa

Alternativas descartadas:
- Redistribuir el costo de la unidad perdida entre las sobrevivientes: distorsiona el CTRU y viola el principio de causalidad

Impacto en el sistema:
- `envio.recepcion.service.ts`: al marcar unidad como `perdida`, crear Gasto Extraordinario automáticamente
- `categoriaCostos`: sub-categoría "Pérdidas Extraordinarias" con las 4 sub-categorías de recuperación

---

**Acuerdo 37 — Aduana retiene ANTES de la entrega**

Descripcion: El estado `retenida_aduana` puede ocurrir cuando el Envío está en estado `en_transito`. Esto detiene el progreso de las unidades. Hay 2 desenlaces posibles:
- Liberación: se paga la deuda aduanera → las unidades se agregan como `CostoLanded` en el Envío → las unidades pasan a `disponible`
- Decomiso permanente: la aduana retiene definitivamente → las unidades pasan a `perdida`

Impacto en el sistema:
- `envio.crud.service.ts`: función `registrarRetencionAduana()` y `liberarDeAduana()`
- El pago aduanero se registra como `CostoLanded` con categoría "Aranceles > Aduana retención"

---

**Acuerdo 38 — Daño intermedio: decisión manual caso por caso**

Descripcion: Si una unidad se daña durante el tránsito (en un envío intermedio, no en la recepción final), el usuario decide manualmente:
- Marcar como `danada` (no se puede vender, se registra como pérdida)
- Intentar devolución al proveedor (se inicia proceso de devolución)

No hay regla automática. El usuario usa su criterio según el valor del producto y el costo de la gestión.

---

**Acuerdo 39 — Confirmación manual de recepción. Tracking automático como fase futura.**

Descripcion: La recepción se confirma siempre manualmente por el usuario (Jose u otro miembro del equipo). La integración con sistemas de tracking automático (APIs de DHL, FedEx, etc.) es una funcionalidad futura fuera del alcance de esta reingeniería.

---

### BLOQUE F — UI Y NAMING (Acuerdos 40-42)

---

**Acuerdo 40 — UX wizard 2 preguntas para crear OC**

Descripcion: El flujo de creación de OC en la UI usa un wizard de 5 pasos, pero las 2 primeras preguntas determinan el tipo de operación:
1. "¿Cómo te llega?" — opciones en lenguaje simple (NO incoterms):
   - "Me lo traen directamente" (DDP/directo)
   - "Lo recoge un viajero" (via viajero)
   - "Lo envían por courier" (via courier externo)
   - "Lo recojo yo" (recojo propio)
2. "¿Quién paga el envío?" — opciones:
   - "El proveedor lo incluye en el precio"
   - "Yo pago el flete por separado"
   - "El viajero cobra por llevarlo"

Con estas 2 respuestas, el sistema configura automáticamente el Envío T1 y los campos requeridos.

Alternativas descartadas:
- Usar terminología de incoterms: Jose no conoce EXW, CIF, FOB, DDP
- No usar wizard: el usuario no sabe qué campos llenar sin guía contextual

---

**Acuerdo 41 — Cargos + descuentos + impuestos capturables en wizard de OC**

Descripcion: Al igual que una factura de Amazon, el wizard de OC permite capturar:
- Cargos adicionales del proveedor (ej. "Amazon Shipping & Handling: $15")
- Descuentos aplicados (ej. "Subscribe & Save discount: -$8")
- Impuestos del proveedor (ej. "Sales Tax CA: $12")
Estos campos se mapean a `cargosOC[]` y `descuentosOC[]` en la OC y se heredan al Envío T1 (Acuerdo 25).

---

**Acuerdo 42 — Empaques: Kit + Pool de Insumos con reglas por peso**

Descripcion: Los materiales de empaque (cajas, bolsas, cinta, relleno) se gestionan como un "Pool de Insumos". Al despachar una venta, el sistema sugiere automáticamente un "Kit de Empaque" basado en el peso total del pedido. Reglas:
- Pedido hasta 0.5 kg → Kit básico (bolsa + etiqueta)
- 0.5 - 2 kg → Kit estándar (caja chica + relleno + etiqueta)
- 2+ kg → Kit grande (caja grande + relleno + refuerzo + etiqueta)
El costo del kit se registra como "Costo por Venta" en Caja 2.

---

### BLOQUE G — ACUERDOS NUEVOS DE RONDAS FINALES (Acuerdos 43-53)

---

**Acuerdo 43 — GA/GO eliminación 360° confirmada**

Descripcion: Confirmación final del Acuerdo 21. Ningún gasto del período se prorratea nunca a ningún producto. La Caja 3 (Gastos Fijos del Período) es completamente independiente y solo aparece en el P&L en el nivel de Resultado Operativo.

---

**Acuerdo 44 — ML histórico: migrar estados de unidades, no mantener dual modelo**

Descripcion: Los estados de unidades de MercadoLibre (stocks sync) deben migrarse directamente al nuevo modelo de estados. No se mantiene un "dual modelo" donde ML usa estados viejos y el ERP usa estados nuevos. La Cloud Function `ml.stock.ts` se actualiza en Fase 4 para usar el estado `disponible` en lugar de `disponible_peru`.

---

**Acuerdo 45 — Prorrateo 3 métodos sin redundancia**

Descripcion: El método `por_cantidad` (dividir el costo total entre el número de unidades sin importar diferencias entre productos) fue considerado pero descartado por ser un caso especial de `fijo_por_unidad`. Si el costo es $100 y hay 10 unidades, "por cantidad" = $10/unidad = "fijo $10 por unidad". Son lo mismo. Solo se mantienen 3 métodos: `fijo_por_unidad`, `variado_por_producto`, y `total_por_peso_o_valor`.

---

**Acuerdo 46 — Flete local (recojo aeropuerto) prorratea por VALOR**

Descripcion: El flete local (ej. Jose va al aeropuerto a buscar a Angie, paga $20 de taxi) prorratea por VALOR del producto, no por peso. La razón: en el recojo local el peso no es limitante (es un auto, no una maleta de aerolínea). Lo que importa es la proporción del valor de lo que se está recogiendo.

Regla actualizada:
- Flete internacional (viajero/courier): por PESO
- Flete local (recojo en aeropuerto, moto de despacho a cliente): por VALOR
- Aranceles e impuestos: por VALOR

---

**Acuerdo 47 — Dashboard: 5 componentes de rentabilidad**

Descripcion: El Dashboard (y el módulo de Reportes) tendrá 5 visualizaciones de rentabilidad:
1. Cascada (waterfall): Venta → -CTRU → -Costos por Venta → -Gastos del Período → Resultado Operativo
2. Tabla semáforo por SKU: Margen Bruto %, Margen Contribución %, Utilidad/unidad (verde/amarillo/rojo)
3. Matriz 2x2 "Portafolio": Rotación (eje X) × Margen Contribución (eje Y) → cuadrantes estrella/vaca/dilema/perro
4. Comparativo por canal: ML vs Venta Directa con Margen Contribución (incluye comisión ML en Costos Venta)
5. Break-even mensual: gauge de ventas acumuladas vs punto de equilibrio calculado (Gastos Fijos ÷ Margen Contribución promedio)

---

**Acuerdo 48 — Estrategia INCREMENTAL POR CAPAS**

Descripcion: La reingeniería NO es un Big Bang. Se implementa por fases donde cada fase entrega valor independiente y tiene su propio Go/No-Go. El sistema es funcional (aunque con funcionalidades reducidas) al final de cada fase. Ver el Plan Ejecutable en `docs/PLAN_REINGENIERIA_2026-04-10.md` para el detalle completo de 7 fases.

La estrategia garantiza:
- Si algo sale mal en una fase, se puede hacer rollback sin afectar las anteriores
- El PO puede ver progreso real en cada milestone (4 demos)
- El riesgo de perder funcionalidades completas se minimiza

---

**Acuerdo 49 — Categorías de costos/gastos DINÁMICAS con catálogo maestro**

Descripcion: Ninguna categoría de costos o gastos está hardcodeada en el código. Todo se gestiona a través del catálogo `categoriasCostos` en Firestore, editable desde la UI en Maestros → Categorías de Costos. La estructura es árbol de 2 niveles:
- Categoría padre: "Transporte" (bloque: importación)
- Sub-categoría: "Flete viajero", "Flete courier", "Flete local"

Los 3 bloques (`importacion`, `venta`, `periodo`) son fijos (no editables), pero las categorías y sub-categorías dentro de cada bloque son completamente dinámicas. El sistema viene pre-poblado con las categorías descritas en la Sección 6 de este documento.

Alternativas descartadas:
- Enum hardcodeado en TypeScript: requiere deploy cada vez que Jose quiere agregar una categoría
- Sin estructura jerárquica (lista plana): difícil de navegar con muchas categorías

Impacto en el sistema:
- Nueva colección `categoriasCostos` con `bloque`, `nombre`, `categoriaPadreId?`
- `categoriaCosto.service.ts` nuevo
- UI en Maestros: arbol editable de categorías

---

**Acuerdo 50 — Eliminación total de GA/GD/GV/GO: reemplazo por 2 conceptos únicos**

Descripcion: Los 4 conceptos GA/GD/GV/GO se reemplazan en el lenguaje del usuario por 2 conceptos simples:
- "Costo por Venta" = todo lo que cuesta individualmente hacer y entregar una venta (Caja 2)
- "Gasto Fijo del Mes" = todo lo que cuesta que la empresa exista en el período (Caja 3)

Estos son los únicos términos permitidos en la UI. El usuario nunca ve "GA" ni "GO" en ninguna pantalla.

---

**Acuerdo 51 — Prorrateo flexible para viajeros: 3 métodos distintos por costo**

Descripcion: Angie Price (viajera) puede cobrar de maneras distintas para distintos artículos:
- "$5 fijo por cada unidad de proteína que llevo" → método `fijo_por_unidad`
- "$8 por la proteína de 5 lbs, $3 por las vitaminas pequeñas" → método `variado_por_producto`
- "Te cobro $80 por todo el paquete" → método `total_por_peso_o_valor` (el sistema distribuye)

El usuario selecciona el método al agregar el CostoLanded al Envío.

---

**Acuerdo 52 — Reporte de análisis directo/indirecto**

Descripcion: Un nuevo tab en Reportes muestra el análisis directo/indirecto:
- Costos DIRECTOS: atribuibles a un producto específico (CTRU + Costos por Venta)
- Costos INDIRECTOS: del período, no atribuibles (Gastos Fijos del Mes)
- Ratio directo/indirecto por mes (benchmark: una microempresa saludable tiene <40% indirecto)

Este reporte ayuda a Jose a entender si sus gastos fijos están creciendo desproporcionalmente.

---

**Acuerdo 53 — Reestructuración 360° de toda la información embebida**

Descripcion: Todos los campos, labels, comentarios de código, y datos en Firestore que usen nomenclatura anterior (GA/GO/GV/GD, almacen, transferencia, estados viejos de unidades) deben actualizarse. No queda ningún rastro de la nomenclatura anterior en el sistema activo. Los datos históricos archivados (colecciones archivo) se marcan como `legacy: true` pero no se eliminan por trazabilidad.

---

## 4. LAS 4 DECISIONES DE AGENTES

Estas decisiones las tomó el squad técnico de agentes, no el PO. Se documenta el razonamiento para no re-deliberarlas.

---

**Decisión de Agente D-1 — No repository layer (BD parte limpia)**

Tomada por: system-architect
Contexto: Se evaluó si implementar un Repository Pattern para abstraer Firestore y facilitar testing. En un proyecto con 38+ colecciones y Zustand stores bien establecidos, agregar esta capa de abstracción aumentaría la complejidad sin beneficio práctico inmediato.
Decisión: NO se implementa repository layer en esta reingeniería.
Razón: El codebase ya tiene un patrón claro (servicios singleton + stores Zustand). Agregar repos ahora rompe consistencia. Se puede reconsiderar si el equipo crece a 3+ desarrolladores.
Revisable: cuando el equipo supere 3 personas o cuando se implemente testing automatizado extensivo.

---

**Decisión de Agente D-2 — Eliminación directa de estados legacy**

Tomada por: code-logic-analyst
Contexto: Se evaluó mantener los estados viejos de unidades (`recibida_origen`, `en_transito_origen`, etc.) como aliases temporales para no romper el sistema durante la migración.
Decisión: Eliminación directa, sin aliases. La BD se limpia antes (Fase 0), por lo que no habrá documentos con estados viejos en producción.
Razón: Si la BD está limpia de datos transaccionales, no hay documentos que leer con estados viejos. Los aliases temporales solo agregarían código de transición que después debe eliminarse de todas formas.
Prerequisito obligatorio: La Fase 0 (limpieza de BD) DEBE completarse ANTES de Fase 1. Esto es innegociable.

---

**Decisión de Agente D-3 — Prorrateo flexible con reglas por categoría**

Tomada por: erp-business-architect
Contexto: Había múltiples opciones para el mecanismo de prorrateo (manual total, automático fijo, tablas de distribución).
Decisión: 3 métodos de prorrateo flexible, con el método sugerido determinado automáticamente por la categoría del costo (Transporte → por peso, Aranceles → por valor, resto → opción del usuario).
Razón: Refleja la realidad operativa del negocio. Angie cobra de formas distintas. DHL cobra por peso. La aduana cobra por valor. El sistema debe adaptarse, no forzar un único método.

---

**Decisión de Agente D-4 — Split de god-service transferencia.service.ts ANTES del renaming**

Tomada por: code-quality-refactor-specialist
Contexto: `transferencia.service.ts` tiene 1,592 líneas. Si se renombra primero y se divide después, el historial de git se fragmenta y es difícil rastrear cambios.
Decisión: Primero dividir en 3 servicios (`crud`, `recepcion`, `pagos`) con barrel file de compatibilidad. Luego renombrar el barrel y los 3 sub-servicios juntos.
Razón: Un archivo de 1,592 líneas es imposible de mantener. El split debe ocurrir en Fase 1.5 (su propia fase en el plan), antes de Fase 2 (renaming masivo). Así el renaming opera sobre archivos ya divididos y manejables.

---

## 5. MODELO DE 3 CAJAS DE COSTOS

### Fórmulas exactas

```
PRECIO DE VENTA (en soles, PEN)
 └── - Caja 1: CTRU real (precio OC × TCPA + costos landed prorrateados × TC del costo)
     = MARGEN BRUTO (PEN)
     
 └── - Caja 2: Costos por Venta (comisión ML + delivery + kit empaque)
     = MARGEN CONTRIBUCIÓN (PEN)
     
 └── - Caja 3: Gastos Fijos del Período ÷ unidades vendidas en el período
     = RESULTADO OPERATIVO (PEN)
```

### Caja 1 — CTRU / Costo de Importación

**Componentes:**
- `precioProducto`: precio unitario en USD × TCPA vigente al momento de confirmar la OC
- `costosLanded`: suma de costos del Envío prorrateados a esta unidad específica
  - Flete viajero: prorrateado por peso (`pesoLibras`)
  - Flete courier: prorrateado por peso (`pesoLibras`)
  - Aduana / impuesto importación: prorrateado por valor (precio USD del producto)
  - Cargo proveedor (shipping Amazon): prorrateado por valor
  - Seguro: prorrateado por valor
  - Manipuleo: prorrateado por valor

**Cuándo se congela:** cuando la unidad llega a estado `disponible`
**Quién lo calcula:** `ctru.service.ts` refactorizado
**Fórmula simplificada:**
```
CTRU = precioProductoUSD × TCPA + sumaCostosLandedPEN_prorrateados
```

### Caja 2 — Costos por Venta

**Componentes (por transacción de venta):**
- Comisión ML: % de la venta cobrado por Mercado Libre (varía por categoría)
- Comisión pasarela de pago: para ventas directas con tarjeta
- Delivery: costo del servicio de envío al cliente (Olva, Shalom, motorizado)
- Kit de empaque: costo del material de empaque según peso del pedido
- Comisión vendedor (si aplica): comisión del vendedor interno

**Cuándo se registra:** al confirmar la venta o al confirmar el despacho
**Estructura de datos:**
```typescript
costosVenta: Array<{
  categoriaCostoId: string  // referencia al catálogo dinámico
  monto: number             // monto en moneda original
  moneda: 'PEN' | 'USD'
  montoPEN: number          // siempre en soles para el P&L
  colaboradorId?: string    // si el costo es a un transportista colaborador
}>
```

### Caja 3 — Gastos Fijos del Período

**Componentes (por mes):**
- Personal: planilla + bonos + comisiones (registrados en Planilla module)
- Local: alquiler + luz + agua + internet
- Profesionales: contador + asesoría legal
- Tecnología: software ERP + hosting + apps
- Operativos: movilidad + suministros de oficina
- Financieros: comisiones bancarias + ITF + intereses
- Marketing general: publicidad no directamente atribuible a una venta

**Cuándo se registra:** cuando ocurre el gasto
**Cuándo impacta el P&L:** en el nivel Resultado Operativo, dividido entre unidades vendidas en el período para el reporte por unidad

### Los 3 niveles de rentabilidad en el Dashboard

```
Nivel 1 — Por unidad (SKU individual):
  Precio venta PEN
  - CTRU (Caja 1)
  = Margen Bruto PEN y %

Nivel 2 — Por venta (transacción):
  Margen Bruto
  - Costos por Venta (Caja 2)
  = Margen Contribución PEN y %

Nivel 3 — Por período (mes):
  Σ Margen Contribución (todas las ventas del mes)
  - Total Gastos Fijos del Período (Caja 3)
  = Resultado Operativo PEN y %
```

---

## 6. CATEGORÍAS DINÁMICAS PRE-POBLADAS

Estas son las categorías que se cargan en la colección `categoriasCostos` en el seed de Fase 1 (script `03-seed-categorias-costos.mjs`). El usuario puede editar, agregar o eliminar después.

### Bloque: Importación (Caja 1 — CTRU)

```
Transporte
  ├── Flete viajero                [prorrateo: por_peso]
  ├── Flete courier internacional  [prorrateo: por_peso]
  └── Flete local (recojo)         [prorrateo: por_valor]

Aranceles
  ├── Impuesto de importación      [prorrateo: por_valor]
  ├── Agente aduanero              [prorrateo: por_valor]
  └── Aduana retención             [prorrateo: por_valor]

Seguros
  └── Seguro de transporte         [prorrateo: por_valor]

Manipuleo
  ├── Empaque y reempaque          [prorrateo: por_valor]
  └── Almacenaje temporal          [prorrateo: por_valor]
```

### Bloque: Venta (Caja 2 — Costos por Venta)

```
Comisiones
  ├── Comisión Mercado Libre
  ├── Comisión pasarela de pago
  └── Comisión vendedor

Distribución
  ├── Olva Courier
  ├── Shalom Empresarial
  ├── Motorizado Lima
  └── Otro courier local

Empaque
  ├── Kit básico (< 0.5 kg)
  ├── Kit estándar (0.5 - 2 kg)
  └── Kit grande (> 2 kg)

Marketing Directo
  ├── Descuento sobre precio
  └── Publicidad en MercadoLibre
```

### Bloque: Período (Caja 3 — Gastos Fijos del Mes)

```
Personal
  ├── Planilla (link a módulo Planilla)
  ├── Bonos
  └── Comisiones administrativas

Local
  ├── Alquiler almacén
  ├── Electricidad
  ├── Agua
  └── Internet / Teléfono

Profesionales
  ├── Contador / asesoría contable
  └── Asesoría legal

Tecnología
  ├── Software ERP (BusinessMN)
  ├── Hosting / Firebase
  └── Otras aplicaciones

Operativos
  ├── Movilidad y combustible
  ├── Suministros de oficina
  └── Mantenimiento

Financieros
  ├── Comisiones bancarias
  ├── ITF (Impuesto a Transacciones Financieras)
  └── Intereses y cargos financieros

Marketing General
  ├── Publicidad en redes sociales
  ├── Influencers / colaboraciones
  └── Material promocional

Pérdidas Extraordinarias
  ├── Pérdida sin recuperación
  ├── Pérdida con seguro pendiente
  ├── Pérdida con recuperación parcial
  └── Pérdida con recuperación total
```

---

## 7. LOS 4 FLUJOS DE NEGOCIO REALES

Estos son los casos reales del negocio de Vitaskin que el sistema debe poder manejar perfectamente.

### Caso 1 — Amazon → Angie → Jose → ALM-PE-001 (suplementos via viajero, 2 envíos)

**Contexto:** Jose compra proteínas en Amazon USA (Subscribe & Save). Amazon entrega en casa de Angie en California. Angie las lleva en su próximo viaje a Perú. Jose las recoge en el aeropuerto.

**Paso a paso:**
1. Jose crea OC en estado `borrador`. Proveedor: Amazon USA. Productos: 10 unidades de Proteína X.
2. En el wizard: "¿Cómo llega?" → "Lo recoge un viajero". "¿Quién paga el envío?" → "El viajero cobra por llevarlo".
3. Jose confirma la OC → 10 unidades nacen en estado `pedida`, `casillaActualId` = casilla virtual de Amazon. Sistema crea Envío T1 automáticamente en estado `borrador` (origen: Amazon → destino: casilla de Angie, transportador: Angie Price).
4. Jose informa a Angie. Angie confirma que recibió los paquetes → Jose actualiza Envío T1 a estado `confirmado`. Las 10 unidades pasan a estado `en_transito`.
5. Angie viaja a Perú → Jose marca Envío T1 como completado, agrega costo: "Flete viajero $80 fijo total → por peso". Sistema prorratea $80 entre las 10 unidades según peso. CTRU actualiza con el costo del flete. Las 10 unidades pasan de `en_transito` a la casilla de Angie (casilla en Lima, temporal).
6. Jose crea Envío T2 manualmente: origen casilla Angie, destino ALM-PE-001. Transportador: ninguno (Jose lo lleva en su auto). Costo: "Flete local recojo aeropuerto $20 → por valor".
7. Jose llega al aeropuerto, recoge. Confirma Envío T2 como recibido. Escanea UPCs, ingresa fechas de vencimiento. Las 10 unidades pasan a estado `disponible` en ALM-PE-001. CTRU se congela incluyendo flete Angie + flete recojo.
8. OC pasa a estado `completada`.

**Resultado:** CTRU = precio Amazon ÷ TCPA + (flete Angie prorrateado por peso) + (flete recojo prorrateado por valor).

---

### Caso 2 — Asian Beauty DDP → courier DHL → ALM-PE-001 (skincare, directo, 1 envío)

**Contexto:** Jose compra serums en Asian Beauty (China). El proveedor envía DDP (Delivered Duty Paid) — DHL entrega en Lima sin cargo adicional para Jose.

**Paso a paso:**
1. Jose crea OC. Proveedor: Asian Beauty. Productos: 20 serums SKC-0010.
2. Wizard: "¿Cómo llega?" → "Me lo traen directamente". "¿Quién paga el envío?" → "El proveedor lo incluye en el precio".
3. Jose confirma OC → 20 unidades en estado `pedida`, casilla virtual de Asian Beauty. Envío T1 creado automáticamente (origen: Asian Beauty → destino: ALM-PE-001, transportador: DHL, sin costos adicionales).
4. Jose recibe tracking de DHL. Actualiza Envío T1 a `en_transito`.
5. DHL entrega en almacén → Jose abre la app, va a Envío T1, marca como recibido. Escanea UPCs, ingresa fechas de vencimiento. 20 unidades → estado `disponible` en ALM-PE-001.
6. CTRU = solo precio Asian Beauty × TCPA (sin costos de flete adicionales).

**Resultado:** CTRU simple, sin costos de transporte. OC completada con 1 solo envío.

---

### Caso 3 — Amazon cobra envío + Angie cobra flete (2 costos de importación)

**Contexto:** Jose compra en Amazon pero NO es Subscribe & Save — Amazon cobra $15 de shipping. Además Angie cobra $60 por llevar el pedido a Perú.

**Paso a paso:**
1. Jose crea OC. Proveedor: Amazon USA.
2. En el wizard, Paso 3 (Cargos): Jose agrega "Amazon Shipping: $15 USD → prorratear por valor".
3. Wizard: "¿Cómo llega?" → "Lo recoge un viajero".
4. Confirmar OC → unidades en `pedida`. Envío T1 creado con costo heredado: "Amazon Shipping $15 por valor".
5. Al editar Envío T1 (cuando Angie va a viajar), Jose agrega segundo costo: "Flete Angie $60 → por peso".
6. Angie viaja, entrega en Lima. Jose confirma recepción final.
7. CTRU = precio Amazon × TCPA + ($15 Amazon Shipping prorrateado por valor) + ($60 flete Angie prorrateado por peso).

---

### Caso 4 — EXW futuro (proveedor no incluye transporte, N envíos)

**Contexto (futuro, no activo hoy):** Un proveedor nuevo vende en modalidad EXW — Jose debe organizar el recojo en la fábrica. Múltiples etapas de transporte.

**Flujo esperado:**
1. OC creada. Wizard: "¿Cómo llega?" → "Lo recojo yo" (EXW).
2. Envío T1: fábrica → agente de carga en origen (courier externo 1).
3. Envío T2: agente de carga → aeropuerto Lima (courier externo 2).
4. Envío T3: aduana Lima → ALM-PE-001 (agente aduanero).
5. Cada envío tiene sus propios costosLanded. Todos se acumulan en el CTRU final.

**Nota:** Este caso no es operativo hoy en Vitaskin pero el modelo debe soportarlo.

---

## 8. AUDITORÍA 360° DE PÁGINAS

Tabla de impacto de la reingeniería sobre todas las páginas del sistema. Impacto definido como:
- REDISEÑO: la página cambia fundamentalmente (nueva lógica, nueva UI)
- ALTO: cambios significativos de nomenclatura + lógica
- MEDIO: principalmente cambios de nomenclatura y labels
- BAJO: mínimos ajustes de labels
- SIN IMPACTO: no requiere cambios

| Página / Módulo | Impacto | Qué cambia |
|-----------------|---------|------------|
| **OrdenesCompra** | REDISEÑO | Wizard 5 pasos, Sub-Órdenes, cargos/descuentos, nuevo ciclo de estados, envío automático al confirmar |
| **Transferencias → Envíos** | REDISEÑO | Renombramiento completo, costosLanded[], tipos de origen polimórfico, recepción con escáner |
| **Inventario** | ALTO | Pipeline stages rediseñados (nuevos estados), `casillaId` en lugar de `almacenId`, filtros actualizados |
| **Unidades** | ALTO | Pipeline stages rediseñados, estados nuevos (pedida/danada/perdida/retenida_aduana), filtros actualizados |
| **Red Logística (nuevo)** | REDISEÑO | Página nueva que reemplaza Viajeros + Almacenes. 4 secciones, casillas anidadas bajo colaborador |
| **Viajeros (deprecado)** | ELIMINADO | Reemplazado por Red Logística |
| **Almacenes (deprecado)** | ELIMINADO | Reemplazado por Red Logística |
| **Tesorería** | ALTO | Pool USD como widget/resumen, Tarjetas de Crédito nueva sección, `pago_viajero` → `pago_colaborador` |
| **Gastos → Gastos Fijos** | ALTO | Renombrado en Sidebar, categorías dinámicas en lugar de hardcodeadas, eliminación de tipos importación |
| **CTRU** | MEDIO | Sin cambios de UI significativos, pero la lógica interna cambia (sin GA/GO). Labels actualizados. |
| **Reportes** | ALTO | Tab directo/indirecto nuevo, P&L 3 niveles, eliminar labels GA/GO hardcodeados, tab Logística actualizado |
| **Proyección** | MEDIO | Eliminar labels GA/GO/GV/GD hardcodeados, usar categorías dinámicas del catálogo |
| **Contabilidad** | MEDIO | Actualizar labels `GV + GD` y `GA + GO` en StatDistribution |
| **Dashboard** | ALTO | 3 niveles de rentabilidad, cascada waterfall, tabla semáforo, matriz 2x2, comparativo canal, break-even. Widget FX diferencial. `almacenNombre` → `casillaNombre` |
| **Cotizaciones** | MEDIO | `almacenId` → `casillaId` en disponibilidad de stock |
| **Ventas** | MEDIO | `costosVenta[]` nuevo campo, `useRentabilidadVentas` hook actualizado |
| **Escáner** | MEDIO | Tab "Transferencia" → "Envío", subtítulo actualizado, `ModoTransferencia` → `ModoEnvio` |
| **Maestros — Categorías de Costos (nuevo)** | REDISEÑO | Árbol editable de 3 bloques con categorías padre/hijo |
| **Maestros — Insumos de Empaque (nuevo)** | REDISEÑO | Catálogo de insumos + Kits por peso |
| **MercadoLibre** | MEDIO | CF `ml.stock.ts`: `disponible_peru` → `disponible`. Sin cambios de UI. |
| **Planilla** | SIN IMPACTO | Los gastos de planilla se integran a Gastos Fijos pero el módulo no cambia internamente |
| **CxC (Cuentas por Cobrar)** | BAJO | Labels menores, integración en Reportes (TAREA-098) |
| **CxP (Cuentas por Pagar)** | BAJO | Labels menores, integración en Reportes (TAREA-098) |
| **Entregas** | BAJO | Actualizar referencias a `casillaId` si las hay |
| **Sidebar** | ALTO | "Transferencias" → "Envíos", "Viajeros"/"Almacenes" → "Red Logística", "Gastos" → "Gastos Fijos", "Pool USD" se mantiene pero como sub-sección de Tesorería |
| **App.tsx (rutas)** | MEDIO | `/transferencias` → `/envios`, nuevas rutas para Red Logística, Insumos, Tarjetas |
| **Mapa de Calor** | SIN IMPACTO | No depende de los módulos refactorizados |
| **Proyección /proyeccion** | BAJO | Eliminar referencias a GA/GO en labels y cálculos |
| **Analytics** | BAJO | Actualizar labels si usa terminología GA/GO |
| **Productos / Catálogo** | SIN IMPACTO | `pesoLibras` ya está implementado, no hay cambios adicionales |
| **Requerimientos** | MEDIO | Campo `reservado: boolean` nuevo, `tipoReserva` nuevo, UI de reserva mejorada |

---

## 9. RESUMEN DE LOS 8 REPORTES DE AGENTES

### Agente 1 — system-architect

**7 Feature Flags recomendados para transición gradual:**
1. `FF_ENVIOS_ENABLED`: activa el nuevo módulo de Envíos (desactiva Transferencias legacy)
2. `FF_COLABORADORES_ENABLED`: activa Red Logística (desactiva Viajeros/Almacenes legacy)
3. `FF_UNIDADES_PEDIDA`: activa creación de unidades al confirmar OC
4. `FF_CTRU_SIN_GAGO`: activa CTRU simplificado sin GA/GO
5. `FF_POOL_USD_COMO_VISTA`: activa Pool USD como vista de Tesorería
6. `FF_CATEGORIAS_DINAMICAS`: activa catálogo de categorías (desactiva tipos hardcodeados)
7. `FF_3_NIVELES_RENTABILIDAD`: activa el dashboard de rentabilidad nuevo

**Orden de refactor recomendado:**
Fase 0 (limpieza) → Fase 1 (tipos/colecciones) → Fase 1.5 (split god-services) → Fase 2 (renaming) → Fase 3 (servicios) → Fase 4 (CFs) → Fase 5 (UI) → Fase 6 (finanzas/dashboard) → Fase 7 (smoke test)

**5 problemas críticos identificados:**
1. CF `onOrdenCompraRecibida` crea unidades fantasma si no se desactiva antes de activar creación frontend
2. `ml.stock.ts` usa `disponible_peru` — si no se actualiza en Fase 4, el stock de ML queda en 0
3. `ctru.service.ts` tiene `ACTIVE_STATES` con estados viejos — CTRU = 0 si no se actualiza
4. Batch limit 450: algunas operaciones de renaming masivo pueden acercarse al límite
5. Firestore rules deben desplegarse ANTES de agregar documentos a nuevas colecciones

---

### Agente 2 — code-logic-analyst

**20 puntos de ruptura identificados:**
1. `ctru.service.ts` — `ACTIVE_STATES`: referencia estados eliminados
2. `ctru.utils.ts` — `calcularGAGOProporcional()`: función a eliminar
3. `ordenCompra.recepcion.service.ts`: lógica de creación de unidades a deprecar
4. `transferencia.service.ts` (1,592 líneas): god-service a dividir
5. `almacenStore.ts` — queries que usan `almacenActualId`
6. `venta.service.ts` — no tiene `costosVenta[]`
7. `useRentabilidadVentas` hook — estructura GA/GO embebida
8. `Contabilidad/StatDistribution` — labels hardcodeados GA/GO
9. `Proyeccion/` — labels hardcodeados GV/GD
10. `ml.stock.ts` CF — `disponible_peru`
11. `poolUSD.service.ts` — colecciones propias a deprecar
12. `gasto.types.ts` — enums GA/GO a eliminar
13. `unidad.types.ts` — estados viejos a eliminar
14. `multiOrigen.helpers.ts` — referencias a almacenId
15. `CotizacionForm` — disponibilidad por almacenId
16. `InvestigacionModal` en `ProveedorUSAList` → mover a `ProveedorOrigenList`
17. `CuentaCajaForm.tsx` — deprecated, eliminar
18. `RequerimientoDetailModal` — estados `en_almacen_usa`/`en_almacen_origen`
19. `firestore.rules` — sin reglas para colecciones nuevas
20. Contadores de secuencia: TRF- y ALM- a actualizar

**Top 10 archivos más riesgosos (no tocar sin pruebas extensivas):**
1. `ctru.service.ts` (lógica de costos crítica)
2. `venta.service.ts` (efectos cascada)
3. `transferencia.service.ts` (god-service 1,592 líneas)
4. `ml.orderProcessor.ts` (bug duplica ventas)
5. `tesoreria.service.ts` (loop propagación)
6. `poolUSD.service.ts` (TCPA se corrompe)
7. `onOrdenCompraRecibida` CF (unidades fantasma)
8. `firestore.rules` (bloquea todo)
9. `multiOrigen.helpers.ts` (usado en muchos lugares)
10. `ordenCompra.crud.service.ts` (lógica de estados)

---

### Agente 3 — database-administrator

**Esquema final: 13 colecciones modificadas/nuevas**

Colecciones NUEVAS:
1. `colaboradores` — entidad colaborador con tipo y métricas
2. `casillas` — ex-almacenes, con colaboradorId obligatorio
3. `envios` — ex-transferencias, con costosLanded[]
4. `categoriasCostos` — catálogo dinámico de 3 bloques
5. `insumos` — pool de materiales de empaque
6. `kitsEmpaque` — kits por peso con reglas automáticas
7. `tarjetasCredito` — pasivos financieros

Colecciones MODIFICADAS:
8. `ordenesCompra` — tcReferencial, subOrdenes[], cargosOC[]
9. `unidades` — estados nuevos, casillaActualId, sin costoGAGOAsignado
10. `ventas` — costosVenta[] nuevo campo
11. `requerimientos` — reservado: boolean, tipoReserva
12. `gastos` → `gastosPeriodo` — sin tipos de importación, con categoriaCostoId

Colecciones DEPRECADAS:
13. `almacenes` → archivada en Fase 7
14. `transferencias` → archivada en Fase 7
15. `poolUSDMovimientos` → archivada en Fase 7
16. `poolUSDSnapshots` → archivada en Fase 7

**Plan migración 8 fases** (ver PLAN_REINGENIERIA_2026-04-10.md para detalle)

**4 riesgos DBA:**
1. Batch 450 ops — crear 100+ unidades en una OC grande puede exceder el límite: dividir en lotes
2. Índices — colecciones nuevas sin índices causan full collection scans: desplegar índices en Fase 1
3. TTL de PITR — 7 días: si la Fase 0 deja la BD en estado corrupto, hay 7 días para revertir
4. Datos sin migrar — documentos en colecciones deprecadas con referencias a campos eliminados: archivar antes de eliminar, mantener 90 días

---

### Agente 4 — frontend-design-specialist

**175 archivos afectados por el renaming y rediseño**

Distribución:
- `src/types/`: 12 archivos (tipos a actualizar)
- `src/services/`: 18 archivos (servicios a refactorizar/renombrar)
- `src/stores/`: 9 archivos (stores a actualizar)
- `src/pages/`: 28 archivos (páginas a actualizar)
- `src/components/modules/`: 85 archivos (componentes con referencias)
- `src/components/ui/`: 8 archivos (componentes base con labels)
- `src/utils/`: 6 archivos
- `src/hooks/`: 9 archivos

**Estructura de carpetas post-refactor (cambios principales):**
```
src/pages/
  Envios/              ← ex-Transferencias/
  RedLogistica/        ← nuevo (reemplaza Viajeros/ + Almacenes/)
  Maestros/
    CategoriaCostos/   ← nuevo
    Insumos/           ← nuevo
  Tesoreria/
    TarjetasCredito/   ← nuevo

src/components/modules/
  envio/               ← ex-almacen/ + transferencia/ unificados
  colaborador/         ← nuevo
  categoriaCosto/      ← nuevo
  insumo/              ← nuevo
```

---

### Agente 5 — project-manager-erp

**Plan: 7 fases, 14-19 sesiones, 88-130 horas**

| Fase | Nombre | Sesiones | Horas |
|------|--------|----------|-------|
| 0 | Limpieza y Preparación | 1 | 4-6h |
| 1 | Modelo de Datos | 2-3 | 12-20h |
| 1.5 | Split God-Services | 1 | 6-8h |
| 2 | Renaming Masivo | 2 | 10-16h |
| 3 | Servicios y Lógica | 3-4 | 20-28h |
| 4 | Cloud Functions | 1-2 | 8-12h |
| 5 | UI y Navegación | 2-3 | 14-20h |
| 6 | Finanzas y Dashboard | 2 | 12-16h |
| 7 | Integración y Smoke Test | 1-2 | 8-12h |

**10 riesgos identificados:**
1. R1-ALTO: Renaming incompleto — referencias viejas en runtime
2. R2-CRÍTICO: ML stock = 0 por estados no actualizados
3. R3-CRÍTICO: Doble creación de unidades (CF + frontend)
4. R4-ALTO: CTRU = 0 por filtro de estados viejos
5. R5-CRÍTICO: Firestore rules bloquean colecciones nuevas
6. R6-MEDIO: Context-switching entre fases (1 dev, 1 sesión = 1 fase)
7. R7-MEDIO: Scope creep durante implementación
8. R8-ALTO: Pool USD + Tesorería fusión rompe pagos
9. R9-MEDIO: Batch limit 450 en operaciones masivas
10. R10-BAJO: Dependencias entre fases que obligan a retroceder

**4 milestones con demo al PO:**
- M1: Cimientos — Deploy 102-103 (app con nueva nomenclatura visible)
- M2: Motor — Deploy 104-105 (OC funcional con nuevo modelo)
- M3: Cara visible — Deploy 106-107 (UI completa + dashboard 3 niveles)
- M4: Sistema integrado — Deploy 108 (flujo E2E completo, PO opera solo)

---

### Agente 6 — backend-cloud-engineer

**14 servicios a refactorizar + 6 servicios nuevos**

Servicios a refactorizar:
1. `ctru.service.ts` — eliminar GA/GO, simplificar
2. `ctru.utils.ts` — eliminar `calcularGAGOProporcional()`
3. `ordenCompra.crud.service.ts` — sub-órdenes, crear unidades al confirmar
4. `ordenCompra.recepcion.service.ts` — deprecar
5. `transferencia.crud.service.ts` → `envio.crud.service.ts`
6. `transferencia.recepcion.service.ts` → `envio.recepcion.service.ts`
7. `transferencia.pagos.service.ts` → `envio.pagos.service.ts`
8. `almacen.service.ts` → `casilla.service.ts`
9. `poolUSD.service.ts` — refactorizar como view service
10. `gasto.service.ts` — eliminar tipos importación
11. `venta.service.ts` — agregar costosVenta[]
12. `venta.pagos.service.ts` — sin cambios estructurales
13. `tesoreria.service.ts` — integrar cálculo TCPA
14. `metricas.service.ts` — actualizar triggers para nuevas colecciones

Servicios nuevos:
1. `colaborador.service.ts`
2. `categoriaCosto.service.ts`
3. `insumo.service.ts`
4. `kitEmpaque.service.ts`
5. `tarjetaCredito.service.ts`
6. `subOrden.service.ts`

**4 Cloud Functions críticas:**
1. `onOrdenCompraRecibida` — MUST desactivar antes de activar creación frontend (R3)
2. `ml.stock.ts` — MUST actualizar en Fase 4 antes de cualquier venta
3. `poolUSDSnapshotMensual` — deprecar
4. `geocodificaCoordenadasVenta` — sin cambios (no afectada)

**Riesgo batch 450:** crear 100 unidades al confirmar OC = 100 escrituras. Si hay más datos embebidos, puede acercarse al límite. Implementar con lotes de máximo 200 unidades por batch.

---

### Agente 7 — erp-business-architect

**4 gaps funcionales identificados:**
1. No hay trazabilidad de reservas desde Requerimiento hasta unidad en stock — cubierto por Acuerdos 9 y 10
2. No hay modelo de tarjetas de crédito — cubierto por Acuerdo 29
3. No hay gestión de insumos/empaques — cubierto por Acuerdo 42
4. No hay visión de red logística unificada — cubierto por Acuerdos 12-18

**7 edge cases verificados y cubiertos por los acuerdos:**
1. Viajero cancela viaje → OC queda abierta, unidades en `pedida`, crear nuevo envío T2 con otro viajero
2. OC parcialmente recibida → unidades mezclan `disponible` y `pedida`, OC en `en_proceso`
3. Aduana retiene y luego libera → unidades `retenida_aduana` → `disponible`, costo aduanero agregado al envío
4. Producto dañado → estado `danada`, gasto extraordinario creado, sin redistribución de costo a otras unidades
5. Reserva de cliente con adelanto antes de comprar → Requerimiento tipo B, unidades nacen como `reservada`
6. Sub-orden con productos diferentes → cada sub-orden con su propio envío T1, costos independientes
7. Mismo producto en 2 envíos del mismo día → CTRU distinto por envío (regla atributiva del Acuerdo 22)

---

### Agente 8 — code-quality-refactor-specialist

**3,000 ocurrencias de renaming identificadas en ~160 archivos**

Breakdown del renaming:
- `almacen` / `Almacen` / `almacenId` / `almacenActualId`: ~850 ocurrencias
- `transferencia` / `Transferencia` / `transferenciaId`: ~1,100 ocurrencias
- `GA` / `GO` / `GV` / `GD` / `GAGO` / `CategoriaGasto` / `ClaseGasto`: ~400 ocurrencias
- Estados viejos de unidades (`recibida_origen`, `en_transito_origen`, etc.): ~250 ocurrencias
- `viajero` / `Viajero` (en contexto logístico, no en planilla): ~400 ocurrencias

**4 archivos de código muerto a eliminar:**
1. `CuentaCajaForm.tsx` — deprecated desde S30, no se usa en ninguna ruta activa
2. Funciones deprecated en `ctru.service.ts` (comentadas con `@deprecated`)
3. `ProveedorUSAList` — tiene `InvestigacionModal` que debe migrar a `ProveedorOrigenList`
4. Helpers de `transferencia` relacionados con `modoEntrega` (enum a deprecar)

**1,211 casts `any` identificados** — no son un bloqueador para la reingeniería pero representan deuda técnica a reducir en sesiones post-reingeniería.

**Estrategia de renaming:** usar search & replace controlado por lotes pequeños (1 módulo a la vez), compilar después de cada lote, no hacer todo en un solo commit masivo.

---

## 10. PLAN EJECUTABLE POR FASES

El plan completo y ejecutable está en:
`C:\Users\josel\businessmn-v2\docs\PLAN_REINGENIERIA_2026-04-10.md`

**Resumen de fases:**

| Fase | Contenido | Sessión estimada |
|------|-----------|------------------|
| 0 | Limpieza BD transaccional, backup verificado, reseteo contadores | S32 inicio |
| 1 | Tipos TypeScript nuevos, colecciones Firestore, rules, índices, seeds | S32-S33 |
| 1.5 | Split transferencia.service.ts, eliminar código muerto | S33 |
| 2 | Renaming masivo almacen→casilla, transferencia→envio (~3,000 ocurrencias) | S33-S34 |
| 3 | Servicios y lógica de negocio: CTRU, OC, Envíos, Pool USD, costos | S34-S37 |
| 4 | Cloud Functions: triggers, ML stock, Pool USD snapshot | S37-S38 |
| 5 | UI y navegación: páginas nuevas, páginas actualizadas, stores | S38-S40 |
| 6 | Finanzas avanzadas: tarjetas crédito, dashboard 3 niveles, empaques, FX | S40-S41 |
| 7 | Smoke test E2E, limpieza final, deploy producción | S41-S42 |

**REGLA CRÍTICA: No se avanza de fase sin aprobar el Go/No-Go de la fase anterior.**

**Prerrequisito absoluto:** La Fase 0 (limpieza de BD) DEBE ejecutarse antes de cualquier cambio de código. Si la BD tiene datos transaccionales con estados y campos viejos, los cambios de código romperán la aplicación.

---

## 11. REGLAS INAMOVIBLES POST-DEBATE

Estas decisiones están CERRADAS. No se re-deliberan en sesiones futuras. Si surge una nueva perspectiva que las cuestione, se evalúa en el backlog post-reingeniería.

1. GA/GO/GV/GD eliminados del sistema para siempre. No hay aliases ni backwards compatibility.
2. Toda OC DEBE tener al menos 1 Envío. No hay recepción directa.
3. Las unidades nacen al CONFIRMAR la OC, no al recibirlas.
4. Los costos de importación viven en el Envío, nunca en la colección de Gastos.
5. Pool USD es una vista de Tesorería, no una entidad independiente.
6. La BD se limpia PRIMERO (Fase 0). Sin datos transaccionales, los aliases temporales no son necesarios.
7. Las categorías de costos son dinámicas y editables desde UI, no hardcodeadas en código.
8. El renaming es total y definitivo: almacen→casilla, transferencia→envio en TODO el sistema.
9. Los 53 acuerdos con el PO están cerrados. Nuevas ideas van al backlog post-reingeniería, no se incorporan durante la implementación.
10. La estrategia es incremental por capas. Cada fase tiene su Go/No-Go. No se mezclan fases.

---

*Documento generado: 2026-04-10*
*Sesión 32 — Debate de reingeniería Compras-Envíos-Inventario-Costos*
*Próxima sesión: comenzar por Fase 0 — Limpieza de BD*
*Referencia plan ejecutable: docs/PLAN_REINGENIERIA_2026-04-10.md*
