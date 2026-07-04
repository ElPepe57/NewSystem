# Modelo de Cancelación de OC · spec (2026-06-25)

> Ítem #3 de la pila de rework de Requerimientos. Disparado por el escenario del usuario
> ("¿qué pasa si el proveedor cancela mi OC?"). AS-IS verificado en código (workflows ww2dpga0j + wgh2o2fz3).
> Estado: **modelo cerrado con el usuario · listo para implementar en fases.**

---

## 1 · El modelo

**Cancelar una OC = (MOTIVO) × (ALCANCE) × (ESTADO de la OC) → reconciliación ATÓMICA de 6 capas,
con todas las consecuencias visibles en un `ConfirmDialog` antes de confirmar.**

### Ejes
- **MOTIVO** (estructurado · NO existe hoy · alimenta un futuro scorecard de PROVEEDOR):
  - *Proveedor no cumple:* sin stock · sin capacidad logística · el pago no le entró · otro.
  - *Tu lado:* error/confusión · urgencia · cambio de decisión.
- **ALCANCE:** total (toda la OC) · **porción** (N de M unidades · proveedor cumple parte · el residual sobrevive y se re-sourcea) · req-en-OC-consolidada.
- **ESTADO de la OC:** borrador (retrae al pool) · firme/no-recibida (reversa total) · recibida (NO es cancelación → devolución).

### El corte clave (refinado con el ejemplo del proveedor): **"¿la mercadería va a llegar?"**
- **NO va a llegar** (cancelado antes/durante tránsito · el proveedor la retira por falta de stock/logística/pago) → **CANCELACIÓN** = reversa total de lo que no se va a materializar.
- **YA llegó** (recibida) → **DEVOLUCIÓN** (otro evento, otro flujo · fuera de este spec).

---

## 2 · AS-IS por capa (verificado · wf wgh2o2fz3)

| Capa | ¿Reversa al cancelar OC? | Mecanismo que existe | Qué falta |
|---|---|---|---|
| **Cobertura req↔OC** | ✅ **SÍ** (3 alcances incl. parcial) | `cancelarReferenciaOC({scope})` · cableado en `cambiarEstado('cancelada')` · UI `CancelarCoberturaModal` | (solo el guard, ver abajo) |
| **Guard de estado** | 🔴 **BUG VIVO** | — | `_revertirOCEnReq` (service:1150-1155) escribe `estado=estadoSugerido` SIN `esRequerimientoElegibleParaOC` → revive reqs `completado`/`cancelado`. El guard correcto YA existe en `propagarEstadoOCaRequerimientos:1263` → replicarlo. |
| **Motivo** | 🔴 **NO existe** | — | Campo `motivo` en `OrdenCompraRef` (types:124) + en la OC al cancelar + pedirlo en el modal. Hoy toda cancelación es anónima. |
| **Reservas** | 🔴 **NO** (cableado a cancelar-REQ, no a cancelar-OC) | `liberarUnidades` (unidad.service:876 · completo, restaura `reserva.estadoPrevio`) | Cablear en `cambiarEstado('cancelada')`: query unidades por `ordenCompraId` con reserva activa → `liberarUnidades`. |
| **Unidades** | 🔴 **NO** (quedan HUÉRFANAS) | `revertirRecepciones` existe (batch.delete) pero gateado a recibida_* + deja la OC en_transito · no cableado | Borrar/anular las unidades `'pedida'` que `confirmarOC` creó (crearLote · :682). Hoy quedan vivas apuntando a una OC cancelada (no inflan stock vendible pero ensucian CTRU/históricos/conteos). |
| **Envío T1** | 🟡 **PARCIAL** (existe, no cableado) | `envioCrudService.cancelar(envioId,motivo,userId)` (envio.crud:1553 · solo borrador/confirmado) | Cablear: buscar envíos por `ordenCompraId` → cancelar. Decidir envíos ya `en_transito`. |
| **Deuda (debito_oc)** | 🔴 **NO** | `ajusteManual` (genérico) | `confirmarOC` crea `debito_oc` en la CC del proveedor (crud:759 · "le debés el total"). Falta emitir la reversa (crédito) con `idempotencyKey: cancelar_oc_{ocId}`. Sin esto = **deuda fantasma**. |
| **Pago** | 🟡 **PARCIAL + roto** | reversa de cash existe pero apunta a campo MUERTO | Si la OC tenía pagos (`credito_pago_oc` + cash): falta `anularPago` que (a) revierta el cash (`eliminarMovimientoTesoreriaCashFn`), (b) emita el crédito inverso en CC, (c) **migre la propagación de `tesoreria.movimientos:361-378` del campo muerto `historialPagos[]` a la CC** (bug latente · S55 Fase 2 movió el pago a CC `credito_pago_oc` pero la reversa de cash sigue leyendo `historialPagos`). `registrarPago` ya BLOQUEA pagar una OC cancelada (pagos:60), pero NO hay camino inverso. |

**Resumen del AS-IS:** la cobertura (incl. parcial) está hecha · el resto —reservas, unidades, envío, deuda, pago— **NO está cableado a la cancelación de OC**. Los mecanismos existen sueltos pero desconectados. La cancelación hoy deja el sistema mintiendo en mercadería Y plata.

---

## 3 · TO-BE · el punto único de reconciliación

Hoy `cambiarEstado(oc,'cancelada')` (crud:457) solo escribe el estado + recompone cobertura. El TO-BE:
**`cambiarEstado('cancelada')` orquesta una reconciliación ATÓMICA de las 6 capas**, aplicando la regla `esFirme` (borrador→retrae/borra · firme→reversa con rastro) también al plano físico y financiero (hoy solo aplica a cobertura). Recibe el `motivo` y el `userId`.

Reversa atómica (por capa):
1. **Cobertura** → `cancelarReferenciaOC` (ya existe · + el guard fix).
2. **Reservas** → liberar por `ordenCompraId` (`liberarUnidades`).
3. **Unidades** → borrar las `'pedida'` no recibidas.
4. **Envío** → `envioCrudService.cancelar` los vinculados.
5. **Deuda** → reversa del `debito_oc` (crédito idempotente).
6. **Pago** (si hubo) → `anularPago` (cash + CC + migrar historialPagos→CC).

---

## 4 · Fases de implementación (orden propuesto)

- **F0 · Guard fix** (chico · correctitud pura): replicar el guard `esRequerimientoElegibleParaOC` en `_revertirOCEnReq`. Cierra el bug que revive reqs completados/cancelados. *Se puede hacer ya, aislado.*
- **F1 · Motivo:** campo `motivo` (OrdenCompraRef + OC + modal) + estructurar las categorías. Base para el scorecard de proveedor.
- **F2 · Físico:** cablear reservas (`liberarUnidades` por ordenCompraId) + borrar unidades `'pedida'` en `cambiarEstado('cancelada')`.
- **F3 · Financiero:** reversa del `debito_oc` (idempotente) + `anularPago` (+ fix del bug historialPagos→CC).
- **F4 · Envío:** cablear `envioCrudService.cancelar`.
- **F5 · Atomicidad + UX:** envolver F2-F4 en una transacción/secuencia atómica (hoy la cancelación de OC es no-atómica con errores tragados · espejo del BUG-5/7) + `ConfirmDialog` danger con las consecuencias COMPUTADAS como cuerpo + typed-confirm para OC firme.

---

## 5 · Decisiones abiertas (con recomendación)

1. **Destino de las unidades `'pedida'` al cancelar:** ¿hard-delete o marcar `'anulada'` (estado nuevo)? → *Rec: hard-delete* — una unidad `'pedida'` no es inventario real (nunca llegó) · el rastro vive en la OC cancelada + su motivo. (No existe estado `'anulada'` hoy.)
2. **Reversa del `debito_oc`:** ¿`tipoMovimiento` dedicado `reversa_debito_oc` o `ajuste_manual` crédito? → *Rec: dedicado* (trazable + idempotente · `cancelar_oc_{ocId}`).
3. **Envío ya `en_transito` al cancelar:** ¿se cancela igual? → *Rec:* si el proveedor lo retira (no llega) = cancelación (cancelar el envío). Si ya se RECIBIÓ = bloquear cancelación, derivar a devolución. El typed-confirm cubre el caso límite.
4. **typed-confirm:** ¿en qué cancelaciones? → *Rec:* OC firme (impacto físico+financiero) = typed-confirm · borrador = confirm simple.

---

## 6 · UX

`ConfirmDialog` (variant danger · ya existe · `message` acepta ReactNode) con las **consecuencias computadas** como cuerpo:
> *Esto va a → liberar N reservas · borrar M unidades pedidas · cancelar el envío T1 · revertir la deuda de $X con el proveedor · devolver Y unidades al pool. (si firme) Escribí CANCELAR para confirmar.*

El typed-confirm NO está en el `ConfirmDialog` actual (es target del DS) → adición chica en F5.
