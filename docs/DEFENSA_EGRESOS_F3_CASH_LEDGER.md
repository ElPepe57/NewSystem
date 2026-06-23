# F3 · Gatear el cash ledger (egreso solo si está autorizado)

> **Estado:** plan LOCKEADO · build multi-sesión (2-3+ sesiones · la pieza MÁS invasiva · toca el camino del dinero).
> **Fuente:** workflow `wf_9238db1d` (recon 4/4 + diseño) + decisiones usuario 2026-06-23.
> **Precede:** complementa `DEFENSA_EGRESOS_SERVER_SIDE.md` (F1/F2 ya construidas + verificadas en emulador, sin deployar).
> **Deploy:** F3 se deploya ACOPLADA con F1+F2 (decisión usuario: "F3 primero, deploy todo junto").

---

## 0 · Decisiones del usuario (2026-06-23)

- **D2 · EgresoSimpleModal (caja free-text):** ≤$1k directo (caja chica ágil) · **>$1k OBLIGA referenciar un egreso aprobado**.
- **D1 · Egresos SIN doc de referencia** (retiro_socio, pago_nomina, adelanto_empleado, reembolso_cliente, ajuste_negativo):
  **GATEARLOS TODOS** (la versión más completa · cada uno con autorización).
- D5 ✅ (default tomado): la CF valida que `Σ pagos ≤ total aprobado` (cierra "aprobar chico, pagar grande").
- D6 (default): el blindaje del increment de saldo client-side se difiere a F3.5 (F3 ya garantiza que el único egreso que mueve saldo pasa por la CF).
- Idempotencia obligatoria (anti doble-desembolso por reintento).

---

## 1 · Modelo unificador · "gatear TODO egreso" sin 5 flujos bespoke

**Principio:** ningún cash de EGRESO sale sin autorización. La CF `registrarEgresoCash` (admin SDK · ÚNICA escritora del
cash de egreso) determina la autorización por una sola regla, con 3 caminos según el tipo:

| Tipo de egreso | Autorización |
|---|---|
| **Referenciado** (`refDocumentoTipo ∈ {oc,gasto,envio}`) | el doc referenciado tiene `autorizacion.estado==='aprobado'` (F1/F2 · ya construido). ≤$1k directo. |
| **Sin referencia · ≤$1k** (retiro chico, caja, ajuste menor) | DIRECTO por autoridad de cargo · el actor necesita el permiso de la categoría (ej. `RETIRAR_SOCIO`, `PAGAR_NOMINA`). |
| **Sin referencia · >$1k** (retiro socio grande, nómina grande, etc.) | requiere una **autorización STANDALONE** que pasa por el **mismo quórum de socios** (equity · `evaluarAprobacionEgreso`) y la **misma bandeja**. NO es un modelo nuevo por categoría — reusa F2. |

**La pieza nueva que habilita "gatear todo":** una **autorización standalone de egreso** — un doc liviano (`egresosStandalone` o el propio movimiento en estado `pendiente_autorizacion`) que: nace al intentar un egreso sin-ref >$1k · aparece en la bandeja de socio · se aprueba por el quórum de equity (CF `autorizarEgreso` extendida para aceptar este tipo) · y recién aprobado, la CF `registrarEgresoCash` libera el cash. Así retiro_socio/nómina/adelanto/reembolso/ajuste >$1k **todos** caen bajo el quórum existente, sin UI bespoke por categoría (el ≤$1k directo sí distingue permiso por categoría).

> Excepción declarada a revisar (D3/D4): nómina podría referenciar una **planilla aprobada** en vez del quórum genérico
> (su propio gate aguas arriba) · se evalúa al llegar a esa categoría. Default hasta entonces: quórum de socios >$1k.

---

## 2 · Alcance EXACTO (qué se gatea, qué NO)

**SE GATEA** (colección `movimientosFinancieros` · categorías `esEgreso()`):
- Referenciadas: `pago_orden_compra`(oc · `ordenCompra.pagos.service.ts:130`) · `gasto_operativo`(gasto · `gasto.service.ts:197/477/552/1126`) · `pago_viajero`(envio · `envio.pagos.service.ts:133/234`).
- Sin-ref (D1 · gatear todas): `retiro_socio` · `pago_nomina` · `adelanto_empleado` · `reembolso_cliente` · `ajuste_negativo`.
- `pagoAbonoDistribuido.service.ts:991` (lote): la CF valida la aprobación de CADA ref del lote (modo `lote`).

**NO se gatea** (queda escribible por el cliente):
- **Ingresos** (cobros): `ingreso_venta`, `ingreso_anticipo`, `aporte_capital`, `reembolso_recibido`, etc.
- **Internos entre cuentas propias**: `conversion_salida`/`conversion_entrada`, `transferencia_interna`, `pago_estado_cuenta_tc`
  (regla: `esEgreso(cat)` PERO `productoDestinoId` poblado → intra-tesorería → no es egreso a tercero · conserva su rule de rol).
- **`movimientosCC`**: NO es cash (sub-libro de deuda por proveedor · muta `cuentasCorrientes.saldo`, nunca caja). No se gatea.
- **`movimientosTesoreria` legacy**: VIVO pero ningún flujo de pago gasto/OC lo escribe ya · el único egreso por ahí es
  `EgresoSimpleModal.tsx:209` → se migra (D2). Los otros 3 caminos (pagoEstadoCuentaTarjeta, venta.reservas=ingreso, conversiones) quedan.

**Chokepoint ÚNICO de creación de cash:** `registrarMovimientoFinanciero` (`movimientoFinanciero.service.ts:112` · único `addDoc`
a la colección `:181` · única mutación de saldo `:188-221` → `productoFinanciero.service.ts:369`). Corre en el CLIENTE → evadible.

---

## 3 · La CF `registrarEgresoCash` (molde de `autorizarEgresoCore`)

Core testeable + wrapper `onCall` · `runTransaction` · admin SDK · fail-closed. Recibe `{refDocumentoTipo?, refDocumentoId?,
categoria, productoOrigenId, moneda, monto, tipoCambio, concepto, ..., idempotencyKey (OBLIGATORIO), lote?}`.

**Valida (server-side, fail-closed):** auth · relee el doc referenciado (o la autorización standalone) en la tx · recomputa
`montoUSD` con `montoDelEgreso()` (no confía en el input) · **gate**: ≤$1k directo (permiso de cargo) / >$1k exige
`autorizacion.estado==='aprobado'` (referenciado o standalone) · `Σ(pagos previos + este) ≤ montoUSD aprobado` (D5) · no
cancelado/anulado · **idempotencia** (misma key → devuelve el id existente) · **modo lote**: valida cada ref antes de escribir.

**Escribe (MISMA tx):** `addDoc` del movimiento (`ejecutado`) + `update` del saldo del `ProductoFinanciero` (origen `-monto`) +
(mejora colateral) denormaliza el pago en el doc-egreso (`pagos[]`, `montoPendiente`) atómico. Devuelve `{movimientoId, saldoNuevo}`.

El helper `requiereAutorizacionSocio`/`montoUSDDeGasto`/`evaluarAprobacionEgreso` ya está portado a `functions/` (F2) · se reusa.

---

## 4 · Las rules

```js
match /movimientosFinancieros/{docId} {
  allow read: if hasAnyRole(['admin','gerente','finanzas','supervisor']);
  // F3 · el cliente NO crea egresos (los crea la CF · admin SDK ignora rules). Sí crea ingresos / internos.
  allow create: if hasAnyRole(['admin','gerente','finanzas']) && esCreateNoEgreso();
  allow update: if hasAnyRole(['admin','gerente','finanzas']); // anulación (F4: bound a one-way)
  allow delete: if false;
}
// esCreateNoEgreso(): NO (esCategoriaEgreso(d.categoria) && d.get('productoDestinoId','')=='') — egreso a tercero bloqueado · ingresos/internos OK.
```
`movimientosTesoreria`: NO `create:if false` aún (rompería caminos vivos) · se cierra la fuga en `EgresoSimpleModal` (§5).

---

## 5 · Migración (~6 call-sites → `httpsCallable('registrarEgresoCash')`)

`ordenCompra.pagos.service.ts:121-151` · `gasto.service.ts:1122-1146`(registrarPago) + `:191-235`(create-pagado) +
`:468-503/524-581`(update CASO A/C · HOY sin gate) · `envio.pagos.service.ts:127-151`(HOY sin gate de socio) ·
`pagoAbonoDistribuido.service.ts:986-1023`(modo lote). Los `throw` JS locales quedan como UX rápida, ya no como defensa.
`EgresoSimpleModal.tsx:209`: ≤$1k directo · >$1k ref obligatoria (D2).

**Nueva pieza (D1):** las 5 categorías sin-ref >$1k necesitan la **autorización standalone** + su entrada en la bandeja +
el permiso de cargo para ≤$1k (`RETIRAR_SOCIO`/`PAGAR_NOMINA`/etc. · ¿existen? · si no, crear).

---

## 6 · Build fasado (dentro de F3)

- **F3a · CORE referenciado:** CF `registrarEgresoCash` (core+wrapper · valida referenciado + ≤$1k directo + amount + idempotencia +
  saldo tx) + rules `movimientosFinancieros` + test emulador (el bloque `🟠 ABIERTO HASTA F3` de `tests/firestore.rules.test.ts:223`
  pasa a verde) + migrar los 3 flujos referenciados (gasto/OC/envío) + el modo lote.
- **F3b · EgresoSimpleModal** (D2): ≤$1k directo · >$1k ref obligatoria (cierra el agujero legacy más grande).
- **F3c · Sin-ref gateados** (D1): la autorización standalone >$1k (quórum equity + bandeja) + permisos de cargo ≤$1k para
  retiro_socio/pago_nomina/adelanto_empleado/reembolso_cliente/ajuste_negativo. (nómina: evaluar ref a planilla aprobada · D3/D4.)
- **F3.5 (diferido · D6):** blindar el increment de saldo client-side (`cuentasCaja`/`ProductoFinanciero`) · mover toda mutación de saldo a CF.

**Test plan:** rules emulador (cliente NO crea egreso-ref · SÍ ingreso/conversión · egreso disfrazado de ingreso DENY) +
CF emulador `test-registrarEgresoCash.cjs` (>$1k sin aprobar→deny · ≤$1k directo→OK+saldo · aprobado→escribe+saldo+idempotencia ·
parcial excede→deny · lote 1-no-aprobado→todo deny · conversión no exige auth). **Rollout:** deploy CF → migrar call-sites →
endurecer rules (orden · fail-closed). Gate: `npm run test:rules` + `test:egresos` verdes.

## 7 · Decisiones que quedan (al llegar a F3c)
- D3: `pagoEstadoCuentaTarjeta` (pago a banco emisor) · ¿gatear o ya cubierto aguas arriba?
- D4: `reembolso_cliente`/`devolucion_cash` · ¿egreso a gatear o ajuste exento?
- nómina: ¿referencia una planilla aprobada (su gate) o cae al quórum genérico >$1k?

**Archivos clave:** chokepoint `src/services/movimientoFinanciero.service.ts:112,181,188`; patrón CF `functions/src/egresos/autorizarEgreso.ts:145-236`;
helper ya portado `functions/src/egresos/autorizacionEgreso.helper.ts`; rules `firestore.rules:777-782`; test `tests/firestore.rules.test.ts:223` + nuevo `functions/scripts/test-registrarEgresoCash.cjs`.
