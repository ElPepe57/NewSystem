# Modelo Requerimientos ↔ Orden de Compra ↔ Reservas (F4) · Spec consolidado · v2

> **Estado:** v4 · modelo cerrado con el usuario (2026-06-18). **2 orígenes** (Administrativo + Demanda comprometida ·
> Investigado=fase/gate) · gate de investigación BLOQUEANTE · ATP (reservar contra pipeline) · apuesta = decisión
> pensada (no riesgo alto) informada por margen+interés-cotizaciones+investigación · OCs/reqs nacen en borrador ·
> OCBuilder = sub-página del hub. **+ §15 expansión** (radar de apuestas · piso aprendido 1-3 · scorecard de desempeño)
> como capa de inteligencia post-core. Core listo para **Fase A** + verificación §13.
> **Propósito:** fuente única de verdad del re-modelo de la sección **Comercial** (demanda → requerimiento → compra)
> en F4. Consolida 3 análisis multi-agente + las decisiones firmes del usuario.
> **Alcance (point 10/11):** NO es solo Requerimientos — se reorganiza la sección **desde 0** y de forma
> **transversal**: Requerimientos · OCBuilder · **Cotizaciones · Ventas** · Productos · Inventario/Envíos · Reservas.
> Cualquier módulo relacionado o complementario entra si hay que adaptarlo.
> **Principio rector:** solución integral, nunca parche, 360. Antes de código: este spec se valida.

---

## 0 · Cómo leer este spec

- 🟢 **DECIDIDO** = decisión firme del usuario o regla técnica cerrada.
- 🟡 **ABIERTO** = decisión de negocio pendiente (§12).
- 🔧 **BUG VIVO** = defecto citado en código que este modelo obliga a corregir (§11).
- ⚠️ **VERIFICAR** = afirmación inferida de código, NO confirmada adversarialmente (gate · §13).
- ❓ **CONFIRMAR** = lectura mía de un comentario del usuario que necesito que ratifique.

---

## 1 · Principios del modelo (🟢)

1. **El requerimiento nace TARDE.** Una *consulta de precio* NO es un requerimiento (§2). El requerimiento nace
   al **comprometerse el cliente** (vía cotización) o al **decidir comprar** internamente.
2. **El desabasto NO genera requerimiento automático** (point 4). La falta de stock es una **señal/sugerencia**,
   nunca un requerimiento creado por el sistema. Todo requerimiento nace de una **decisión humana**.
3. **La cobertura es DERIVADA, no almacenada** (§4). "Cuánto pedí / cuánto falta" se recomputa desde las OCs
   firmes; nunca un escalar mutado a mano.
4. **La cobertura cuenta y se vuelve irreversible en el MISMO punto: el ENVÍO de la OC** (borrador→enviada ·
   decisión 12.9). Antes = no cuenta + retractable; después = cuenta + irreversible.
5. **No-desperdicio.** Lo ya comprado nunca se evapora: si cae la demanda, las unidades se reclasifican
   (reservada→libre), no se destruyen.
6. **El origen viaja con la unidad** (req → línea → unidad física): trazabilidad por unidad en OCs mixtas.
7. **Las reservas son un EJE TRANSVERSAL** (point 7 · §7): una sola fuente de verdad que cruza Cotizaciones,
   Requerimientos, Compras y Ventas.

### 1.1 · Relación Requerimiento ↔ Cotización (🟢 · point 1 + 12.1)
La **demanda comprometida** nace **de una cotización** (no de la venta directa). Match **bidireccional**:
`Cotizacion.requerimientosIds[]` ↔ `Requerimiento.cotizacionId`. El disparador del nacimiento es el
**compromiso del cliente sobre la cotización** (hoy = adelanto · §12.1 abre si hay compromiso firme sin dinero).
Una cotización con varios productos faltantes puede generar 1 requerimiento (multi-producto) ligado a ella.

---

## 2 · Taxonomía de ORIGEN (🟢 · reemplaza "Solicitante")

Un solo campo `origen` (discriminated union) + `subtipo`. Colapsa los 2 enums solapados actuales (con valores
muertos). `origen` es **etiqueta muerta downstream** (la aprobación decide por monto · 0 branching) → seguro.

| Origen | Definición | Subtipos | Destino del stock |
|---|---|---|---|
| **Administrativo** | La empresa decide comprar por su cuenta, sin cliente puntual. | `restock` (existente, por alerta) · `manual` (existente, deliberado) · `apuesta` (producto nuevo sin cliente) | **Libre** |
| **Demanda comprometida** | Cliente comprometido sobre una cotización, producto costeado. | — (`cotizacionId` + `clienteId`) | **Reservado → cotización** |

> 🟢 **2 orígenes (confirmado 2026-06-18).** "Investigado" NO es origen: es una **fase/gate** (estado del Producto
> candidato→investigado). No se compra sin investigar primero (§2.1).

### 2.1 · Gate de investigación BLOQUEANTE + "Investigado" = fase, no origen (🟢 confirmado)
🟢 **No se compra sin investigar primero (regla canon · 12.2):** no se puede emitir un requerimiento/OC de un
producto **no investigado/costeado**. La **investigación vive en Cotización → Producto** (estado candidato→investigado);
el requerimiento **no carga atributos de investigación** (es solo decisión de compra). Como TODA compra cruza ese
gate, "Investigado" no distingue nada → **no es un origen, es una fase upstream**. Quedan **2 orígenes**.

### 2.2 · Apuesta — definición + bucle de evaluación (🟢 confirmado 2026-06-18)
**Qué ES una apuesta:** una **decisión PENSADA** de traer un producto cuya demanda **aún no está probada por rotación**
— **NO** una jugada de riesgo alto/temeraria. La informan señales: **margen**, **interés en cotizaciones/consultas**
(varios clientes lo piden aunque nadie se comprometa = señal de interés) e **investigación**. Regla precisa:
- **Producto NUEVO + sin cliente comprometido = SIEMPRE apuesta.**
- **Producto NUEVO + cliente comprometido = demanda comprometida** (no apuesta).
- **Producto existente = restock** (por alerta) / **manual** (deliberado).
- **Quién la marca:** el comprador la declara · el **sistema la sugiere** (conoce los productos investigados-pero-no-
  probados). Híbrido. Sin umbral cuantitativo duro (el sistema **aprende**, no clasifica por número · 2.2). Exige **TESIS** (§8).

**Bucle de evaluación (el "sistema entiende qué funciona" · 2.2):** 1) **Declarar** (apuesta + tesis + criterio
opcional) → 2) **Ejecutar** (entra como stock libre) → 3) **Evaluar** (venta **orgánica** en el tiempo = curva de
recuperación CTRU) → 4) **Aprender** (acierto vs criterio → historial/scorecard de apuestas: tasa de acierto por
comprador/categoría → alimenta las sugerencias del paso 1).

**Medición del acierto (🟢 recom · 2.4):** por **recuperación de capital en un horizonte**, no por unidades sueltas.
Default: la curva CTRU recupera el 100% del capital dentro de un horizonte (ej. 90 días) · override por tesis ("vender
70% en 60 días"). El scorecard muestra % recuperadas en horizonte · tiempo promedio · tasa de acierto por comprador.

### 2.3 · Rotación ORGÁNICA vs cumplimiento comprometido (🟢 · regla anti-engaño)
Contar la venta de una unidad **reservada a un cliente** (demanda comprometida) como "rotación de mercado" es
**engañoso** (no prueba apetito de mercado · solo que un cliente la pidió). La **rotación de verdad** = ventas de
**stock LIBRE** a demanda general. La distinción **libre vs reservada** (§7) da el gancho gratis: el restock y la
evaluación de apuestas se calculan sobre rotación **orgánica**, no inflada por pedidos puntuales.
⚠️ VERIFICAR (cuando se construya la capa de evaluación/CTRU): si la rotación hoy ya separa libre/reservada o hay que
agregarlo · si la curva CTRU es filtrable por tipo de stock/origen (§13).

### 2.4 · Consulta de precio / lead → vive en COTIZACIONES (🟢 · point 2)
La consulta de un cliente por un producto que no tenemos/no costeamos **NO es un requerimiento**: es un **pedido
de cotización** y vive en **Cotizaciones**. Cumple dos funciones:
- **(a) Detectar productos nuevos a investigar** → marca el Producto como "candidato · por investigar"
  (la investigación luego vive en el Producto · TabInvestigacion).
- **(b) Inteligencia de precio:** si la cotización se **declina**, puede ser señal de que nuestro precio de
  mercado está alto → alimenta el análisis de precios (cluster [[intel-precios-360]]).

El requerimiento solo nace **después**: si tras investigar el cliente **compromete** (→ Demanda comprometida) o
**decidimos comprar** por cuenta propia (→ Administrativo: restock/manual/apuesta). 🟡 Granularidad del registro
del lead: §12.3.

---

## 3 · Ciclo de vida del requerimiento (🟢 · DERIVADO + atraviesa el OCBuilder)

`borrador → pendiente → (esperando firma) → aprobado → parcial → en_proceso → completado` (+ `cancelado`).

- **esperando firma** = doble firma >$1.000 (`UMBRAL_APROBACION_DUAL_USD`). Hoy invisible → etapa propia.
- Tras `aprobado`, el req **entra al OCBuilder** (point 3): aporta su `pendiente` al **pool**; el usuario asigna
  a grupos (OCs) y, al **enviar** la(s) OC(s), la cobertura cuenta. El estado de cobertura es **derivado** (§4):
  `0%→aprobado` · `0<x<100→parcial` · `≥100%→en_proceso` · recibido completo→`completado`.
- Un req que vuelve a `0%` (se retrajo su única OC en borrador) **REABRE** a `aprobado` y su producto reaparece
  en el pool. El ciclo del requerimiento y el del OCBuilder son **un solo flujo continuo**, no dos cosas separadas.

---

## 4 · Modelo de COBERTURA "pedido vs falta" (🟢)

**Verdad = lista `ordenCompraRefs[]` por (req × producto), cada ref con `estado`.** Derivado, no escalar mutado.

**Invariante maestro** (por tupla req × producto · ✅ CORREGIDO en Fase B):

```
cantidadSolicitada = enOC_vigente + pendienteCompra        (sin sobre-compra)
enOC_vigente       = cantidadSolicitada + sobrecompra      (con sobre-compra · pendiente=0)

enOC_vigente    = Σ ref.cantidad   WHERE  esFirme(OC.estado) (≥ enviada/confirmada · 12.9)  AND  ref.estado ≠ 'cancelada'
pendienteCompra = max(0, cantidadSolicitada − enOC_vigente)   ← los BORRADOR y CANCELADOS caen acá
sobrecompra     = max(0, enOC_vigente − cantidadSolicitada)   ← exceso VISIBLE (no clampeado a silencio)
recibido        = Σ ref.cantidadRecibida   (Fase C · ⊆ enOC_vigente · cumplida e inmutable)
```

> ⚠️ **Corrección de Fase B (07da8ee):** `cancelado` **NO es un término de partición** — los cancelados vuelven a
> `pendiente` (se re-compran). Es solo una métrica de **auditoría** derivable (`Σ ref cancelada`). El invariante de 3
> términos anterior doble-contaba. `esFirme()` usa un **set explícito** (EstadoOrden no es ordenable con `≥`).
> Implementado y testeado (12 tests) en `src/services/requerimiento.cobertura.ts`.

- 🟢 **Una OC en BORRADOR NO cuenta como cobertura** (12.9): su producto sigue `pendiente` y es libremente
  retractable. Solo cuenta desde **enviada**.
- Nivel REQ: `% = Σ min(enOC_vigente, solicitada) / Σ solicitada`.
- `cantidadEnOC`/`pendienteCompra` sobreviven como **cache derivado**, recalculado por `recomputarCobertura(reqId)`
  en TODA mutación.
- 🟢 **Sobre-compra permitida con alerta** (no el clamp `Math.max(0,…)` que la esconde · BUG-1).

### 4.1 · Qué pasa con la unidad al RETRAER (🟢 · point 6)
Retraer una línea de OC **en borrador** → su cantidad vuelve a `pendienteCompra`, el producto **reaparece en el
pool del OCBuilder**, el req **recomputa** (puede reabrir parcial→aprobado). **El requerimiento NO se cancela**:
solo se deshace esa cobertura. (Una OC **enviada** no se retrae · §6.)

---

## 5 · OCBuilder · compra masiva, mezcla y split (🟢 modelo · 🔧 fixes)

🟢 **Forma (point 5):** el OCBuilder es un **WizardShell** que vive como **sub-página del hub** de Requerimientos —
**mantiene el top-bar/breadcrumb** (`Inicio › Requerimientos › Generar OC Consolidada`) + chip de rol · **NO es un
modal flotante** (point del usuario · "siempre el contexto completo"). Se lanza desde la acción "OC Consolidada" del
header o "Enviar al OC Builder" de la tab Pendientes; "Salir" vuelve al hub (lo no confirmado queda en borrador).
Mejora UX: control de cobertura visible en cada paso + soporte de requerimientos parciales y aglomerados.

🟢 **Las OCs nacen en BORRADOR** (point del usuario): el builder crea OCs en estado `borrador`, no firmes. Una OC
borrador **no cuenta como cobertura y es retractable** (§4); **enviarla** (borrador→enviada · acción separada, desde
el detalle de la OC) es lo que la hace contar + irreversible. Igual que el requerimiento, que también puede estar en
borrador. La cobertura (§4) ya lo refleja: `enOC_vigente` cuenta solo OCs `≥ enviada`.

Toma N requerimientos → **POOL** (1 item por producto, con `origenes=[req:cantidad]`) → asigna a M grupos = M OCs.
Soporta: comprar **todo de una**, **mezclar** productos de varios reqs en 1 OC, **partir** un req en varias OCs/casillas.

- **Paso 1 · Asignar** — 🔧 BUG-3: `distributeOrigenes` sesga la atribución por req al partir un producto. **Fix:**
  **saldo descendente global** por (producto, origen-req); cada grupo consume del saldo. Invariante: `Σ por req =
  lo comprado para ese req`.
- **Prioridad del split (🟢 cliente primero, automático):** Demanda comprometida → Investigado → Apuesta.
- **Paso 2 · Control visible:** footer "Pedido X · Asignado a OCs Y · Quedará pendiente Z". Dejar unidades sin
  asignar = warning permitido (el remanente queda `pendiente>0` y reaparece en el pool).
- **Paso 3 · Crear** — 🔧 BUG-5/7: creación no atómica + writeback sin lock. **Fix:** creación atómica + writeback
  en `runTransaction` por req.
- 🔧 Propagar el **origen real** al chip del pool (hoy cae a "Administración").

### 5.1 · Subsume el modelo viejo de asignaciones/casillas (🟢 · 12.7 ❓CONFIRMAR)
El **split por casilla/viajero con auto-creación de OCs** del OCBuilder ES el modelo modernizado de las viejas
"asignaciones" (asignar productos de N reqs a M casillas en un *step*, sin crear una OC manual por casilla). Por
eso el OCBuilder **subsume y retira** el modelo paralelo `cantidadAsignada` — su cobertura ahora vive en
`ordenCompraRefs` (fuente única).

---

## 6 · Matriz de CANCELACIÓN (🟢 · irreversibilidad en el ENVÍO)

**Línea de irreversibilidad = el ENVÍO de la OC** (borrador→enviada · une cobertura + irreversibilidad · 12.9).
Una sola función `cancelarReferenciaOC(scope)`; SIEMPRE recomputa cobertura.

| Madurez de la cobertura | ¿Retrotraíble? | Qué pasa |
|---|---|---|
| **Pendiente** (sin OC) | Sí | Baja `solicitada`/`pendiente`. |
| **OC en Borrador** (no enviada · no cuenta como cobertura) | Sí | Retraer la línea → vuelve a `pendiente` · el producto reaparece en el pool (§4.1). |
| **OC enviada+** (firme) | **NO** | La compra **procede**. Los productos se mantienen en curso y entran a stock. |

**Cancelar un requerimiento** = cancelar lo pendiente + retraer sus OCs en borrador. Las OCs **enviadas
sobreviven como compra real** (el req se marca `cancelado`, pero la OC sigue su curso a stock).

Alcances de `cancelarReferenciaOC` (unidad atómica = ref = req×producto×OC):
- **OC completa** — 🔧 BUG-A: hoy el soft-cancel NO desvincula del req. **Fix:** rutearlo por el mismo punto que
  el borrado → marcar canceladas todas las refs → recomputar.
- **Req dentro de OC consolidada** — 🔧 BUG-B: hoy revierte la OC entera sobre todos los reqs. **Fix:** cancelar
  solo la(s) ref(s) de ese req; las demás intactas. OC con 0 refs vivas → `cancelada`.
- **Porción** (N de M unidades) — reduce `ref.cantidadPedida`; `pendiente` sube por N.
- **Sub-orden** (split por casilla · cada una = un Envío T1) — 🔧 necesita estado `cancelado` en `SubOrdenCompra`.

**Demanda comprometida cancelada (🟢 reclasificar a libre auto):** si el cliente cae con mercadería en camino,
las unidades se reclasifican **reservada→libre** (stock especulativo), se libera la reserva, la cobertura de ese
req baja a 0. El reembolso/NC del adelanto se **avisa a Ventas** (lo gobierna Ventas).

---

## 7 · RESERVAS · eje transversal del negocio (🟢 point 7 · 🔧 BUG crítico)

**Una unidad reservada es un eje que cruza TODO el negocio:** la **Cotización** (el adelanto la crea), el
**Requerimiento** (su cancelación la libera), la **Compra/OC** (la recepción la materializa) y la **Venta** (la
consume). Por eso DEBE tener **una sola fuente de verdad** (un schema · `unidad.reserva`) y **un solo punto de
liberación** (`liberarUnidades`), invocado por TODOS esos módulos + el cron.

🔧 BUG-RESERVA: hoy hay **dos schemas incompatibles** — plano `reservadaPara`/`fechaReserva` (lo que se escribe)
vs anidado `reserva.{vigenciaHasta,estadoPrevio}` (lo que LEE el cron `liberarReservasVencidas`). Nadie escribe el
anidado → **ninguna reserva se auto-libera jamás** → unidades huérfanas restan stock real para siempre.

- 🟢 **Vigencia 60 días por defecto, ajustable por el usuario** (12.6) → al reparar el cron se usa esta política.
- **Apuesta × comprometida en la misma OC:** al recibir, las líneas comprometidas nacen `reservada→cotizacionId`;
  las de apuesta nacen libres. Al cancelar físico una OC mixta: se sacrifican **primero las libres**, al final las
  reservadas (proteger al cliente).
- 🟢 **Apuesta → comprometida post-recepción** (12.8): si compraste libre (apuesta) y luego un cliente lo quiere,
  es una **reserva normal de stock libre** por una venta/cotización (libre→reservada). Nada especial — es el flujo
  estándar (lo que el viejo "Vincular OC retroactiva" intentaba forzar mal).

### 7.1 · Reservar contra el PIPELINE · available-to-promise (🟢 idea del usuario · 12.8-bis)
Una reserva no apunta solo a **stock físico libre**: también puede apuntar a **suministro EN CURSO** — unidades que
ya están en un requerimiento de reabastecimiento o en una OC. Cuando un cliente quiere un producto que no tenemos en
stock pero **ya está en compra**, la **Cotización automatiza** la reserva contra ese pipeline (*available-to-promise*):
ve "N en camino vía REQ-X / OC-Y · M ya reservadas · K disponibles a prometer" y reserva un **slot virtual**. Al
recibir la OC, esos slots se materializan como reservas físicas a los clientes. Esto convierte una **apuesta en
tránsito en comprometida** sin re-fabricar nada (resuelve limpio el caso del viejo "Vincular OC"). Hace a **Cotización
un consumidor de primera clase** del eje de reservas + del pipeline de compra. → la **reserva targetea** {físico
libre · pipeline (req/OC en curso)}.

---

## 8 · TESIS obligatoria de la apuesta (🟢 · triple candado)

Obligatoria SOLO para `subtipo='apuesta'`.
1. **Tipo** (compile-time): el branch `apuesta` lleva `tesis: string` requerido.
2. **Form** (UX): submit bloqueado mientras `apuesta && tesis` vacía.
3. **Servicio** (candado duro): `crearRequerimiento` lanza si `apuesta && !tesis` antes del `addDoc`.
- 🟢 **Formato (12.4):** **texto libre obligatorio con límite** · propuesto **~60 palabras / 400 caracteres**
  (ajustable). 🟢 **Aprobación (12.5):** el **mismo umbral de monto** que cualquier req (>$1.000 doble firma) ·
  **sin rol especial** para la apuesta.

---

## 9 · Los 2 parches + unificación de cotización (🟢 retirar · keystone)

Eran **maquinaria de reconciliación** de un modelo desincronizado, no features.
- **Cotizaciones con faltante** → retirar como bandeja. El req nace AUTO en el compromiso. La señal "demanda
  potencial no comprometida" sobrevive como **dato read-only** de análisis.
- **Vincular OC retroactiva** → retirar. La compra sin venta previa = **Apuesta** (stock libre); el cliente
  posterior reserva contra stock normal (§7).
- **Condición sine qua non:** **unificar el modelo de cotización** — apagar el camino legacy
  `Venta.estado='cotizacion'` + faltante; toda cotización con faltante nace en la colección `cotizaciones`
  (modelo B) + migración one-shot. 🟢 **Greenfield** (0 OCs/unidades en prod) → migración trivial.

---

## 10 · Alcance cross-módulo · sección Comercial desde 0 (🟢 point 10/11)

No es "recibir el cambio": se **reworkean** los módulos. Y de forma **transversal** — cualquier módulo relacionado
o complementario entra si hay que adaptarlo.

- **Cotizaciones (rework):** modelo unificado · faltante al ALTA (persistido) · **el lead/consulta vive acá** ·
  inteligencia de precio en la declinación · es el punto de nacimiento del req de demanda comprometida.
- **Ventas (rework):** consumir reserva al vender · limpiar triple-campo de enlace
  (`ventaRelacionadaId`/`cotizacionId`/`ventaId` → 1) · reembolso/NC cuando cae una demanda comprometida.
- **Productos:** estado "candidato · por investigar" (destino del lead) + la investigación.
- **Inventario:** posición como servicio (hoy inline en Requerimientos) · `stockMinimo` por producto · stock
  **libre** vs **reservado**.
- **Envíos:** sub-orden = Envío T1 · estado `cancelado` · liberación de reservas.
- **CTRU:** curva de recuperación filtrable por `subtipo='apuesta'`.
- **functions/ (cron):** reparar `liberarReservasVencidas` con la vigencia (60d ajustable).

### 10.1 · Sin rastro legacy (🟢 point 9 ❓CONFIRMAR · "organizar desde 0")
Greenfield → **se elimina lo legacy sin coexistencia transitoria**: dead enums de origen/solicitante,
triple-campo de enlace, camino legacy de cotización, modelo `cantidadAsignada` paralelo. No quedan rastros.

---

## 11 · BUGS vivos a corregir (⚠️ VERIFICAR antes de codear · §13)

| # | Bug | Ubicación (según recon) |
|---|---|---|
| BUG-1 | Cobertura escalar mutada + clamp `Math.max(0,…)` esconde sobre-compra | `requerimiento.service.ts:1006-1007` |
| BUG-A | Soft-cancel de OC no desvincula del req (solo `deleteOrden` lo hace) | `ordenCompra.crud.service.ts:507` vs `:568` |
| BUG-B | No se puede cancelar 1 req de una OC consolidada (revierte entera) | `requerimiento.service.ts:1095` |
| BUG-3 | `distributeOrigenes` sesga atribución por req al partir producto | `ocBuilderUtils.ts:319-339` (`:329`) |
| BUG-5/7 | Creación de OCs no atómica + writeback sin lock (carreras) | `OCBuilderStep3.tsx:144-164` |
| BUG-RESERVA | Dos schemas de reserva · cron lee uno que nadie escribe → nunca libera | `cotizacion.adelanto.service.ts:148` · `unidad.service.ts:1117` · `functions/index.ts:2166` |
| ✅ BUG-CANCEL-REQ | ~~Cancelar req es cosmético + re-trigger crea duplicado~~ **RESUELTO B4** (`5f102f3`): `cancelarRequerimiento` retrae OCs + recomputa cobertura · Modelo A `ventaRelacionadaId=null` cierra el re-trigger (`cotizacion.adelanto.service.ts:203`) sin tocar los 4 guardas | `Requerimientos.tsx` · `cotizacion.adelanto.service.ts:203` |
| BUG-SUBORDEN | `SubOrdenCompra` sin estado `cancelado` | `ordenCompra.types.ts:546` |

### 11.1 · Resultados de la VERIFICACIÓN (gate §13 · wf 2026-06-19 · 4 agentes adversariales)
- **CONFIRMADOS (bloquean B/C):** BUG-A · BUG-CANCEL-REQ · BUG-RESERVA · BUG-SUBORDEN · BUG-5/7 · BUG-1 (el clamp).
- **PARCIALES (matiz):**
  - **BUG-1:** "escalar **mutado in-place**" es INCORRECTO → `cantidadEnOC` se **recomputa** del array `ordenCompraRefs`
    (dedup EDGE-003 evita doble-conteo). REAL: el clamp `Math.max(0,…)` (:1007/:1025/:1111) borra el exceso de los campos
    DERIVADOS (pendiente+%); la sobre-compra se ve **completa/Check-verde sin señal de exceso** (el crudo 15/10 sí se ve
    en DetailModal:377). NO es "<100% cuando no lo está" (eso es sub-cobertura).
  - **BUG-B:** la línea `:1095` (`_revertirOCEnReq`) es **per-(req,OC) granular**, NO whole-OC. El whole-OC es el loop de
    `desvincularOCDeRequerimientos:1064`. Bug REAL = **capacidad ausente** (no hay op pública para revertir 1 req · solo
    vía `deleteOrden`).
  - **BUG-3:** skew de **atribución** (rounding · último origen absorbe el resto) pero **conserva totales** · guard si
    origenes≤1 · severidad MEDIA.
- **SORPRESAS (mejoran el plan de B/C):**
  1. **El motor de reversión granular YA EXISTE y es reusable** (`_revertirOCEnReq` · recomputa cobertura+estado) → Fase B
     REUSA (exponer + cablear al soft-cancel de OC y al cancel de req), no reescribe.
  2. **BUG-RESERVA peor:** los writers planos no escriben NINGÚN expiry en la unidad (vigencia vive en cotización/venta) →
     falta la **fuente de expiry en la unidad** (modelado · Fase C), no es rename de 1 línea.
  3. **Causa raíz compartida** BUG-A + BUG-CANCEL-REQ: ninguna cancelación libera vínculos/reservas · solo el DELETE de la
     OC → la corrección ataca AMBOS caminos.
- **🟢 FASE A · GO:** `origen`/`tipoSolicitante` = etiqueta muerta downstream (solo display + persistencia + `where('origen')`
  no-cableado = param muerto · 0 branching de negocio). Re-modelar SEGURO · único riesgo = migración legacy + write-sites.

---

## 12 · Decisiones · cerradas y abiertas

**🟢 Cerradas (usuario):**
- **Gate de investigación BLOQUEANTE** (12.2): no se compra sin investigar · la investigación vive en
  Cotización/Producto, NO en el req.
- Apuesta = subtipo Administrativo · **tesis obligatoria** (texto libre, **límite ~60 palabras** · 12.4) · aprobación
  por **umbral de monto** sin rol especial (12.5) · apuesta = riesgo sobre novedoso/tendencia/demanda>rotación.
- Consulta/lead = vive en **Cotizaciones** (no crea req) · doble función investigar / inteligencia de precio ·
  registro **granular** (quién consultó / cuántas veces · 12.3).
- **El req de demanda comprometida nace de la COTIZACIÓN** (12.1) · disparador = **adelanto O compromiso firme
  validado por el vendedor** (role-gated · el vendedor asume el riesgo · 12.1).
- Desabasto **no** genera req automático (point 4).
- Cobertura **derivada** · cuenta **desde 'enviada'** (12.9) · sobre-compra **permitida con alerta**.
- Irreversibilidad en el **ENVÍO** · borrador retractable (unidad vuelve a pendiente · point 6) · enviada sigue en curso.
- Cliente cae → **reservada→libre auto** · split → **cliente primero automático** · apuesta→comprometida = reserva normal (12.8).
- Reservas = **eje transversal** · fuente única + liberación única (point 7) · **vigencia 60d ajustable** (12.6) ·
  **reservar contra pipeline / ATP** (§7.1 · 12.8-bis).
- OCBuilder = **WizardShell lanzado desde el hub** (point 5) · **subsume** asignaciones/casillas (12.7 · retira `cantidadAsignada`).
- Alcance = cerrar el modelo + reworkear **Cotizaciones (central) + Ventas** + **sin rastro legacy, desde 0** (points 9/10/11 · #9 confirmado).
- Tablero = Lista operativa (sin Kanban) · hub 3 tabs.

**🟢 Cerradas (2ª ronda · 2026-06-18):**
- **2 orígenes** (Administrativo + Demanda comprometida · "Investigado" = fase/gate · §2.1).
- **Apuesta definida** (§2.2): producto nuevo sin cliente = siempre apuesta · declarada+sugerida · bucle de
  evaluación (declarar→ejecutar→evaluar→aprender) · acierto = recuperación de capital en horizonte (CTRU).
- **Rotación orgánica** (§2.3): el restock/evaluación se calculan sobre ventas de stock libre, no sobre cumplimiento
  de reservas (anti-engaño).
- OCBuilder = sub-página del hub + OCs nacen en borrador (§5) · ratificado con el mockup superficie 2.

**🟡 Abiertas (verificar al construir la capa de evaluación · §13):**
- ¿La rotación hoy ya separa stock libre/reservado en las ventas, o hay que agregarlo? (§2.3)
- ¿La curva CTRU es filtrable por tipo de stock/origen para el scorecard de apuestas? (§2.2)

---

## 13 · Verificación pendiente (gate antes de código)

El recon de **cobertura** (parallel[0]) **falló**; sus hallazgos llegaron por los otros agentes y están citados,
pero **no fueron confirmados adversarialmente por mí**. Antes de que cada pieza dirija código: confirmar en el
código real (línea exacta) cada **BUG VIVO** de §11, el invariante de cobertura, y el mismatch de schema de reserva
+ el camino del cron. Patrón [[compras-oc-audit-360]]: separar el **mapa** (este spec) de su **verificación**.

---

## 14 · Secuencia de implementación propuesta (faseada · dependencias)

| Fase | Contenido | Riesgo | Depende de |
|---|---|---|---|
| **A** ✅ HECHO | Re-modelo de origen (taxonomía **2 orígenes**+subtipo · form · chips · tesis triple-candado + límite) · **commit cfb9e90** · tsc-clean | Bajo (no ramifica) | — |
| **B** 🔣 en curso | Motor de cobertura derivada + invariante + `cancelarReferenciaOC` + regla del envío. **B0–B4 ✅** (`recomputarCoberturaProductos`+`esFirme`+sobrecompra · `aplicarCancelacionRef` 3 modos + `cancelarReferenciaOC` 3 alcances · **`cambiarEstado` sincroniza cobertura** vía `propagarEstadoOCaRequerimientos` (batch) → cierra **BUG-A/BUG-B** · **`cancelarRequerimiento` integral** (`aplicarCancelacionTotalReq` puro · retrae borrador/soft firme · 1 write atómico · `estado='cancelado'`) + **fix duplicado Modelo A** (`ventaRelacionadaId=null` → invisible a los 4 guardas anti-dup sin tocarlos · cierra el re-trigger de `cotizacion.adelanto.service.ts:203`) + `limpiarDatos` ruteado al cancel real → cierra **BUG-CANCEL-REQ** · 25 tests · `…`+`ab7010a`+`5f102f3`). Pendiente: **B5 UI** (badges sobre-compra en DetailModal/cards + modales de cancelación parcial/porción OC) | **Alto** | §13 ✅ |
| **C** | Reservas transversales: schema único + liberación única + reclasificación libre↔reservada + reparar cron (60d) | Alto | B |
| **D** | OCBuilder: WizardShell + atribución determinística + creación atómica + propagar origen + subsumir asignaciones | Medio | A, B |
| **E** | Unificar cotización + lead/consulta en Cotizaciones + borrar parches (keystone) · rework Ventas | Medio (greenfield) | B |
| **F** | Lead/Producto candidato + posición de inventario como servicio + limpieza legacy total | Medio | — |
| **G** | Capa de inteligencia (§15): radar de apuestas · piso aprendido · scorecard de desempeño del comprador | Medio-alto | C · D · chequeo 360 |

**Recom de arranque:** **Fase A** (visible, seguro, superficie ya validada) · en paralelo correr la
**verificación §13** que destraba B/C. El mockup del OCBuilder (superficie 2) se dibuja del §5 + §6 tras validar
este spec. La **Fase G** (inteligencia) va al final, tras el core.

---

## 15 · Expansión del módulo · capa de INTELIGENCIA (🟡 visión · post-core · pendiente chequeo 360)

Requerimientos resultó ser **el hub de toda la cadena demanda→compra**. Lectura del módulo: **3 fuentes de decisión +
2 lentes de gestión + Resumen**. Esta capa es **inteligencia que va DESPUÉS del core** (no en Fase A).

- **Fuentes de decisión (de dónde nace el req):** **Apuesta** (frontera · producto nuevo, demanda no probada ·
  decisión pensada, no temeraria) · **Reabastecimiento** (core probado · producto en rotación) · **Demanda
  comprometida** (viene de Cotizaciones · cross-link).
- **Lentes de gestión:** Tablero (lifecycle) · Pendientes (→ OCBuilder).
- **Arco del ciclo de vida:** `Investigado → APUESTA (nuevo·incierto) → si ROTA orgánicamente → producto probado →
  RESTOCK (rutina)`. El puente = rotación ORGÁNICA (§2.3); una apuesta que acierta se **gradúa** a producto de rotación.

### 15.1 · Radar de apuestas (sugerencias)
Tab Apuestas = **portafolio** (apuestas vivas + acierto vía CTRU) + **radar** (productos recién investigados de la
sección **Productos**, propuestos como apuesta, rankeados por **margen + interés en cotizaciones/consultas +
completitud de info**). Lee la investigación que YA vive en Productos · no duplica. El comprador revisa, declara
(tesis), nace el req.

### 15.2 · Reabastecimiento con piso APRENDIDO (no mínimo fijo)
NO hay `stockMinimo` manual. El sistema **aprende el piso** de cada producto desde su curva de rotación orgánica.
- **Arranque en frío** (producto sin historia · recién graduado de apuesta): piso **default 1–3 máximo** (bajo · para
  **no entrampar capital** en un producto no probado). Luego el sistema lo **ajusta** según la rotación real.
- Mata el `stockMinimo` estático (default=5, era deuda) → **punto de reorden dinámico aprendido**.

### 15.3 · Desempeño del comprador — el DATO vive aquí, la VISTA no (atribución + reconocimiento)
Toda compra que **nace de una persona** (apuesta/manual) queda **atribuida** a ella. Requerimientos **computa y expone**
la **rotación orgánica de sus requerimientos** (¿los productos que trajo se mueven?) = el dato del scorecard de acierto.
NO es una entidad "grupo de compras" — es **atribución + reconocimiento** de quién encuentra buenos productos.
🟢 **UBICACIÓN (decisión usuario · canon de ubicación):** el scorecard **NO es una tab de Requerimientos** — se muestra
como **métrica en Mi Perfil** (la propia persona ve su acierto · framing positivo, **celebra** su juicio) **y en
Usuarios** (admin/Equipo ve el del equipo · quién tiene mejor ojo para productos). Requerimientos **alimenta**; Mi
Perfil/Usuarios **presentan**. Conecta con [[perfiles-por-rol-plan]] (bloque tipo "ResumenComprador" en su perfil).
- **Foco:** el juicio se mide sobre todo en reqs de **producto nuevo/apuesta** (donde "encontrar buenos productos"
  importa) · el restock es rutina, mide poco juicio.

⚠️ Toda la §15: **pendiente chequeo 360** (no pisar Productos/Stock/CTRU/Intel) + grounding de data (¿existe margen /
completitud-de-info / rotación-libre / curva CTRU para alimentarla?).

---

*Fin del spec v4 (2026-06-18). Modelo §1-§10 + expansión §15 validados con el usuario. Core listo para Fase A +
verificación §13. La §15 (inteligencia) va al final, con chequeo 360 previo.*
