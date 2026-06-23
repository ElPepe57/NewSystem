# Defensa server-side de egresos · Plan integral 360 (v2 corregido)

> **Estado:** plan LOCKEADO · ejecución fasada · NO codeado aún (salvo Fase 0).
> **Origen:** workflow `wf_22f98a29` (7 agentes · recon 4/4 + 2 escépticos adversariales) · 2026-06-22.
> **Precedencia:** principio rector (plan integral antes de tocar prod) + canon "admin ve todo".

---

## 0 · Decisiones tomadas por el usuario (2026-06-22)

1. **Admin puede aprobar solo.** Para egresos > umbral ($1k), un único admin basta (no requiere 2º
   socio). Respeta el canon ADMIN-VE-TODO. El control financiero acepta a ese único actor como
   excepción declarada. Implementación: `isAdmin()` sigue siendo escritor válido del campo de
   aprobación en rules; la lógica de firma (`evaluarFirmaSocio` / CF) da **short-circuit** al admin
   (1 firma de admin → `completa`).
2. **Arrancar el proyecto completo, fasado.** Se construye la defensa real (no solo congelar el
   campo) en fases a lo largo de varias sesiones, con emulador y rollback fail-closed.
3. **Modelo de autorización >umbral = QUÓRUM PONDERADO POR EQUITY (no "2 firmas").** Las firmas de
   socios deben sumar **> 50% del equity elegible** (mayoría simple fija). El **creador queda excluido**:
   su % no cuenta · la mayoría se mide sobre el equity de los *demás* socios. Un **delegado** carga el
   % del socio que lo delegó (varios socios pueden delegar en la misma persona · acumula · sin
   doble-conteo). **Admin** sigue como override root (aprueba solo). Fuente del equity:
   `datosSocio.porcentajeParticipacion`. ✅ Implementado puro + 18 tests: `evaluarAprobacionEgreso` +
   `sociosRepresentados` en `autorizacionEgreso.helper.ts` (la count-based `evaluarFirmaSocio` queda
   `@deprecated` hasta el cableado de F2).

---

## 1 · Amenaza (verificada en código real)

El gate de doble firma vive **100% en el bundle JS del cliente** (`evaluarFirmaSocio` es puro,
`gasto.service.ts:310` lanza un `throw` JS). Un actor con el SDK y rol de escritura sobre la
colección lo saltea llamando a Firestore directo. Tres forjas + un agujero estructural:

| # | Forja | Write que la habilita | Regla que hoy lo permite |
|---|-------|----------------------|--------------------------|
| A | Auto-aprobar sin firma | `updateDoc(gastos/id, {autorizacion:{estado:'aprobado',firmas:[]}})` | `gastos` write a 4 roles (`firestore.rules:236-239`) |
| B | Forjar firma de otro socio | appendear `{usuarioId:<uid ajeno>}` a `autorizacion.firmas` (el `usuarioId` lo pone el cliente) | misma regla · rules no atan la firma a `request.auth.uid` |
| C | Saltar umbral / sub-reportar monto | el monto/tramo se computa en cliente → escribir `totalUSD` bajo evade el umbral | `ordenesCompra` write a 5 roles (`:211-215`) |

### 🔴 El agujero MÁS profundo (estructural)

**La plata NO se mueve con `autorizacion.estado='aprobado'`.** Se mueve al **CREAR** un doc en
`movimientosFinancieros` / `movimientosCC` (el cash ledger real). Y ese create **no está gateado**
contra la aprobación: finanzas/gerente/admin pueden `addDoc(movimientosFinancieros, {monto:50000})`
directo, **sin tocar `autorizacion`, sin firma, sin tocar ningún gasto/OC**. Toda la maquinaria de
doble firma defiende un campo que **no es el dinero**. (`movimientosCC` es inmutable post-create —
`update/delete:false`, `:680-685` — pero el CREATE no verifica aprobación.)

**Conclusión:** el cierre real **gatea la creación del cash ledger**, no solo el campo de aprobación.

---

## 2 · Arquitectura objetivo (corregida)

Modelo **híbrido en 3 capas**, cada una defensa-en-profundidad de la siguiente:

1. **`firestore.rules` (congelan campos sensibles).** El cliente NO puede llevar `autorizacion`→
   aprobado, ni appendear firmas, ni mutar el monto post-aprobación, ni crear cash de egreso. Esos
   campos solo los escribe el admin SDK (vía CF). Las rules son **gates de campo**, no motor de cómputo.
2. **CF callable `autorizarEgreso` (única escritora del campo de aprobación).** Corre con admin SDK,
   identidad criptográfica del invocador (`context.auth.uid`), recomputa el monto USD **server-side**
   por colección (fail-closed), aplica `evaluarFirmaSocio` (segregación + doble firma + admin
   short-circuit), y escribe `autorizacion` en transacción. Reusa el helper PURO ya testeado.
3. **CF que gatea el CASH LEDGER.** El create de `movimientosFinancieros`/`movimientosCC` de
   categorías de egreso pasa por una callable/transacción que **lee el egreso referenciado**
   (`refDocumentoTipo`/`refDocumentoId`) y exige `autorizacion.estado==='aprobado'` (o tramo directo
   ≤ umbral con autoridad de cargo). El cliente pierde el create directo del cash de egreso.

> **Por qué callable y NO trigger onUpdate:** un trigger no tiene `context.auth` → no sabe quién
> firma sin confiar en un campo spoofeable. El callable tiene identidad del invocador. (Recon §3:
> CF 1ª Gen, Node 22, us-central1, `functions` ya es deploy target · evaluarFirmaSocio es puro/testeado.)

---

## 3 · Correcciones de la pasada adversarial (hallazgo → fix → fase)

| # | Hallazgo (verificado) | Severidad | Fix | Fase |
|---|----------------------|-----------|-----|------|
| 1 | **Create rompe-prod:** gastos/OC nacen SIN campo `autorizacion` (`gasto.service.ts:90-135`) → `request.resource.data.autorizacion.estado` desreferencia mapa ausente → **niega TODO create** | 🔴 P0 | regla create: `!('autorizacion' in request.resource.data) \|\| request.resource.data.autorizacion.estado != 'aprobado'` | F1 |
| 2 | **Req rompe-prod:** congelar `estado` top-level del requerimiento mata sus transiciones legítimas (cancelado/en_proceso/parcial · comprador vincula OC, `requerimiento.service.ts:489,1094,1162`) | 🔴 P0 | unificar req al sub-objeto `autorizacion` (decisión §5) **o** gatear solo `estado→'aprobado'` (no congelar todo el campo) | F1 |
| 3 | **Cash ledger nunca gateado** (§1) — el dinero se mueve sin tocar aprobación | 🔴 crítico | gatear el create de `movimientosFinancieros`/`movimientosCC` de egreso vía CF en transacción contra el egreso referenciado | F3 |
| 4 | **CF lee `totalUSD` que gastos NO tienen** (gasto tiene `montoUSD`) → `undefined→0→directo→sin firma` · aprobaría $50k como sub-umbral | 🔴 crítico | CF computa monto per-colección: `montoUSDDeGasto(g, tcServer)` / `orden.totalUSD` / `montoEstimadoUSD` · **fail-CLOSED** si da 0 con monto>0 | F2 |
| 5 | **Delegación colapsa doble firma a 1 persona** — el conteo de 2 uids no garantiza 2 socios reales | 🔴 crítico | **RESUELTO por modelo de equity (§0.3):** el quórum se mide en % de equity, no en nº de firmas · un delegado solo carga el % real del socio que lo delegó · el creador no cuenta · imposible "fabricar" mayoría con cuentas vacías | F2 (✅ helper hecho) |
| 6 | **`creadoPor` forjable al crear** → atacante pone a otro como creador y firma su propio egreso | 🟠 alto | regla create: `request.resource.data.creadoPor == request.auth.uid` + freeze de `creadoPor` en update | F1 |
| 7 | **Admin = bypass de actor único** | — | **RESUELTO por decisión §0.1** (admin solo basta · excepción declarada · canon admin=root) | — |
| 8 | **Umbral troceable** — 6×$900 = $5k, cada uno "directo", cero firmas · el gateo por-doc no ve el agregado | 🟠 alto | control de velocidad/agregación server-side (suma por proveedor/período) **o** riesgo residual declarado (decisión §5) | F4 |
| 9 | **`origen:'sistema_ml'` exención mal planteada** — ml.orderProcessor escribe gastos vía admin SDK → rules NO aplican · keyear la exención en un campo client-writable = bypass universal | 🟠 medio | **NO** exceptuar en rules por `origen` · ML ya pasa por admin SDK · si hace falta marcador, lo pone el admin SDK y las rules PROHÍBEN que el cliente escriba `origen:'sistema_ml'` | F1 |
| 10 | **`coleccion` elegida por atacante en callable** — confused-deputy | 🟠 medio | hard-whitelist `coleccion in ['gastos','ordenesCompra','requerimientos']` + validar shape · la CF re-implementa TODO guard de las rules (admin SDK las saltea) | F2 |
| 11 | **Rechazo sin camino CF** — la CF solo aprueba · tras congelar, rechazar solo sobrevive por grieta que contradice "CF única escritora" | 🟠 alto | agregar callable `rechazarEgreso` junto a `autorizarEgreso` | F2 |
| 12 | **Anulación de `movimientosFinancieros` sin bound** — toggle anular/des-anular desincroniza saldos | 🟡 medio | transición one-way `activo→anulado` + `anuladoPor==auth.uid` + anulación de egreso por el mismo camino socio/CF | F4 |
| 13 | **Rollback fail-OPEN** — el fallback documentado ("cliente escribe directo") ES el estado vulnerable | 🟡 medio | fail-CLOSED: el fallback es "aprobaciones bloqueadas hasta arreglar la CF", nunca "cliente escribe directo" · CI guard que falle el deploy si las rules dejan a un cliente no-admin escribir `autorizacion` | F1+ |
| 14 | **`movimientosFinancieros` update `hasOnly` puede negar updates legítimos** (reconciliación/denormalización post-create) | 🟡 medio | **prerequisito F4:** enumerar TODO `updateDoc`/`set(merge)` a movimientosFinancieros antes de endurecer | F4 |

---

## 4 · Modelo de dato `socio` (confirmado)

`socio` es `UserRole` válido (`auth.types.ts:16`), asignable vía `userService.agregarRol` →
`users.roles[]`. NO hay custom claims en todo el repo → el rol se resuelve siempre con
`get(/users/$(uid)).roles` (helpers `userHasRole`/`hasAnyRole` ya existen · 1 read/eval cacheado).
**Único pendiente cosmético:** el comentario del header `firestore.rules:9` no lista `'socio'`
(no afecta las reglas · actualizar al pasar por F1).

---

## 5 · Decisiones PENDIENTES (destraban fases · NO se codean sin respuesta)

1. ~~**Slots de delegación**~~ ✅ **RESUELTO (§0.3 · modelo de equity).** No hay "slots": el quórum se
   mide en % de equity. Un delegado solo carga el % real del socio que lo delegó · varios socios
   pueden delegar en la misma persona (potestad plena · acumula su equity real, sin doble-conteo). El
   creador no cuenta. La firma persiste `representaSocios: string[]` (los socios cuyo equity carga).
2. **Unificar requerimientos al sub-objeto `autorizacion`** (vs proteger `estado`/`aprobaciones` por
   separado). Unificar = una sola regla protege los 3 tipos de egreso · recomendado.
3. **¿Mover el umbral ($1000) a config server** (leído por la CF) para que un cliente comprometido no
   lo ignore? Recomendado, no bloqueante.
4. **Troceo del umbral** (#8): ¿control de velocidad/agregación server-side, o riesgo residual declarado?
5. **`movimientosFinancieros` update** (#14): ¿endurecer a solo-anulación? Prerequisito: enumerar
   todos los updates legítimos antes.

---

## 6 · Plan fasado (done + rollback fail-closed por fase)

### Fase 0 — Cimientos seguros (no toca enforce · riesgo ~cero) ✅ HECHA
- 0a. ✅ Fix cosmético del comentario `firestore.rules:9` (+`socio`).
- 0b. ✅ Harness de emulador (`@firebase/rules-unit-testing` · `npm run test:rules`) + tests que prueban
  EN VIVO las forjas A/B/C (assertSucceeds hoy · commit `44efe59`).
- 0c. ✅ Decisiones §5 resueltas (modelo de equity §0.3 · admin §0.1).
- **Done:** ✅ harness corre, vulnerabilidad probada, decisiones tomadas, núcleo de equity implementado+18 tests.

### Fase 1 — Rules defensivas (create-safe) · enforce de CAMPO ✅ HECHA (escrita + emulador-verificada · NO deployada)
- ✅ Rules corregidas (gastos/ordenesCompra/requerimientos): create-safe (#1), pin `creadoPor` (#6),
  req sin congelar `estado` (#2 · solo bloquea →'aprobado'), prohibir `origen:'sistema_ml'` del cliente
  (#9), congelar `autorizacion`/`aprobaciones` para el cliente no-admin. Admin conserva escritura (§0.1).
- ✅ **21 tests emulador verdes**: baseline + forja A/B (create+update) DENIEGAN · creadoPor-forge DENIEGA ·
  origen-ml DENIEGA · edición no-monetaria PASA · lifecycle req (en_proceso/cancelar) PASA · admin escape PASA.
- ✅ **Pre-deploy verificado:** TODOS los caminos de create de cliente (gasto :141/:1349 · OC :253 · req
  :335/:702) setean `creadoPor: userId` → el pin no rompe creates. ML va por admin SDK (ignora reglas).
- ⚠️ **NO DEPLOYADA · acoplada a F2:** al congelar el campo, el socio no-admin no puede aprobar por `updateDoc`
  → debe ir por la CF (F2). Solo el admin puede aprobar directo (escape hatch) hasta que F2 exista.
- 🟠 Forja C (marcar pagado) sigue abierta · la cierra F3 (cash ledger), no F1.
- **Rollback:** `firebase deploy --only firestore:rules` con el archivo previo (1 archivo versionado).

### Fase 2 — CF `autorizarEgreso` + `rechazarEgreso` (únicas escritoras del campo)
- ✅ **F2a · núcleo de equity portado** a `functions/src/egresos/autorizacionEgreso.helper.ts` (mirror · tsc-clean).
- ✅ **F2b-server · callables construidos** (`functions/src/egresos/autorizarEgreso.ts` · tsc-clean · exportados):
  whitelist de colección (#10) · monto server-side per-colección recomputado fail-closed (#4 · `montoUSDDeGasto`
  para gastos) · `evaluarAprobacionEgreso` quórum por equity (#5 · admin short-circuit §0.1) · segregación contra
  `creadoPor` persistido (#6) · `rechazarEgreso` (#11) · resolver socios (users rol socio + `users/{uid}/private/
  datosSocio.porcentajeParticipacion`) + delegaciones vigentes · transacción sobre el doc.
- ⬜ **F2c · migrar cliente:** `gasto.autorizarGasto`/`ordenCompra.autorizarOC`/`requerimiento.aprobar` (+ rechazos)
  a invocar la callable (`httpsCallable`) en vez de `updateDoc`. AQUÍ cambia el comportamiento del cliente.
- ✅ **GATE pre-deploy CUMPLIDO:** refactor a core+wrapper (`autorizarEgresoCore`/`rechazarEgresoCore` testeables) +
  `functions/scripts/test-autorizarEgreso.cjs` contra el emulador Firestore (`npm run test:egresos`) · **16/16 verdes**:
  segregación · no-socio bloqueado · quórum equity (50% no · 80% sí · 2 firmas persistidas→aprobado) · ya-aprobado ·
  doble-firma · admin override · ≤umbral · monto fail-closed · delegación (carga % del socio) · rechazo · OC + req.
- 🔵 **F2c · migrar cliente (EN CURSO):**
  - ✅ **gasto + OC** (`autorizarGasto`/`autorizarOC` + rechazos) migrados a `httpsCallable('autorizarEgreso'/'rechazarEgreso')`.
    Imports muertos quitados (evaluarFirmaSocio/delegacion) · notificación a socios preservada · toast equity-aware · build+44 tests+preview OK.
  - ✅ **requerimiento = AUTORIDAD DE CARGO** (decisión user: el control de socio vive en la OC sobre el total CONSOLIDADO, no en el
    req suelto · la OC puede crecer / incluir compras sin req). NO va por la CF: se enforza por **firestore.rules** (`hasPermiso('aprobar_requerimiento')`
    + segregación creador≠writer · admin root). `requerimiento.aprobar` simplificado a cargo (sin quórum/firmas) · req sacado del whitelist
    de la CF + de la bandeja de socio (es cargo, se aprueba en su módulo). rules emulator +3 tests (sin permiso DENY · con permiso+no-creador
    ALLOW · creador DENY). Split principista: permiso simple→reglas · quórum equity→CF.
  - ⬜ **display de equity en la bandeja** PENDIENTE · `egresosPendientesSocio.helper` aún determina estado por nº-de-firmas
    (latente-impreciso bajo equity · sin data que lo dispare aún) → keyear estado en el `estado` persistido (CF-autoritativo) +
    barra de progreso por % equity (el hook cargaría socios+%).
- **Done:** ✅ CF emulador-verificada · ⬜ cliente migrado + bandeja adaptada al modelo de equity.
- **Rollback fail-CLOSED:** si la CF falla, las aprobaciones quedan **bloqueadas** (no se reabre el
  write directo del cliente). F1+F2 se despliegan **acopladas**.

### Fase 3 — Gatear el CASH LEDGER (el dinero real · #3)
- El create de `movimientosFinancieros`/`movimientosCC` de categorías de egreso pasa por CF que lee
  el egreso referenciado en transacción y exige aprobación. Rules: create de esas categorías → `if false`
  para el cliente (solo admin SDK).
- **Done:** un cliente no puede crear cash de egreso sin un egreso aprobado referenciado · el flujo
  legítimo de pago sigue funcionando vía la CF.
- **Rollback:** rollback de rules + la CF deja de exigirse (degradado, pero el cliente NO recupera el
  create directo si se mantiene `if false` — se prefiere bloquear pagos a reabrir el hueco).

### Fase 4 — Controles agregados + endurecimientos
- Velocidad/agregación anti-troceo (#8), inmutabilidad del monto post-aprobación (#4/§1-C),
  transiciones de anulación bounded (#12), `movimientosFinancieros` update solo-anulación (#14, tras
  enumerar updates legítimos).

> **Orden no negociable:** F1 (enforce de campo) y F2 (CF) se despliegan **acopladas** o se rompe la
> aprobación en prod. F0 es seguro por separado. F3 es el cierre real del dinero. F4 endurece.

---

## 7 · Snippets corregidos (referencia · se afinan en cada fase)

### Helper de socio + congelado de campo (rules)
```javascript
function esSocio() { return isActiveUser() && userHasRole('socio'); }
function autorizacionIntacta() {
  return !('autorizacion' in request.resource.data.diff(resource.data).affectedKeys());
}
```

### GASTOS (create-safe + pin creadoPor + admin conserva campo)
```javascript
match /gastos/{docId} {
  allow read: if isActiveUser();
  allow create: if hasAnyRole(['admin','gerente','finanzas','vendedor'])
                && request.resource.data.creadoPor == request.auth.uid      // #6
                && (!('autorizacion' in request.resource.data)               // #1 create-safe
                    || request.resource.data.autorizacion.estado != 'aprobado')
                && request.resource.data.get('origen','') != 'sistema_ml';   // #9
  allow update: if isAdmin()                                                 // §0.1 admin conserva
                || ( hasAnyRole(['admin','gerente','finanzas','vendedor'])
                     && autorizacionIntacta()
                     && request.resource.data.creadoPor == resource.data.creadoPor );  // freeze creadoPor
  // NOTA: el write de aprobación legítimo va por la CF (admin SDK), no por el cliente.
  allow delete: if isAdmin();
}
```
*(OC y requerimientos: mismo patrón · req NO congela `estado` top-level, solo gatea `→'aprobado'` o
se unifica al sub-objeto `autorizacion` según decisión §5.2.)*

### CF callable (esqueleto corregido)
```typescript
export const autorizarEgreso = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '...');
  const COLS = ['gastos','ordenesCompra','requerimientos'];
  if (!COLS.includes(data.coleccion)) throw httpsError('invalid-argument');   // #10 whitelist
  const actor = (await db.collection('users').doc(context.auth.uid).get()).data();
  const roles = actor?.roles ?? (actor?.role ? [actor.role] : []);
  const esAdmin = roles.includes('admin');
  const esSocio = roles.includes('socio'); // + delegación (portar delegacionAutorizacion.helper)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.collection(data.coleccion).doc(data.docId));
    if (!snap.exists) throw httpsError('not-found');
    const e = snap.data();
    // #4 monto server-side per-colección · fail-CLOSED
    const montoUSD = montoUSDServer(data.coleccion, e);   // gasto→montoUSDDeGasto(tcServer); OC→totalUSD; req→montoEstimadoUSD
    if (montoUSD == null) throw httpsError('failed-precondition', 'monto no resoluble · fail-closed');
    const r = evaluarFirmaSocio({ montoUSD, firmas: e.autorizacion?.firmas ?? [],
                                  userId: context.auth.uid, esSocio, esAdmin,   // #5 + §0.1
                                  creadorId: e.creadoPor });
    if (!r.ok) throw httpsError('permission-denied', r.error);
    tx.update(snap.ref, { autorizacion: { estado: r.completa ? 'aprobado' : 'pendiente',
                                          firmas: [...firmas, { usuarioId: context.auth.uid, fecha: now }] } });
  });
});
```

---

## 8 · Test plan (emulador + CF unit)

**Rules (emulador · INCLUYE create tests · F0/F1):**
1. create de gasto/OC SIN `autorizacion` → **ALLOW** (no rompe prod · #1).
2. create con `creadoPor != auth.uid` → **DENY** (#6).
3. create con `origen:'sistema_ml'` desde cliente → **DENY** (#9).
4. cliente forja `autorizacion.estado='aprobado'` → **DENY** (forja A).
5. req: comprador vincula OC (`estado→en_proceso`) y cancelar (`→cancelado`) → **ALLOW** (#2).
6. edición de campo no-monetario sin tocar `autorizacion` → **ALLOW**.
7. create de `movimientosFinancieros` de egreso por cliente (F3) → **DENY**.

**CF unit (reusa tests del helper puro · F2):**
8. socio aprueba >umbral (1ª firma→pendiente · 2ª de otro socio→aprobado).
9. creador invoca → `permission-denied`.
10. no-socio → `permission-denied`.
11. **admin solo → aprobado** (§0.1 short-circuit).
12. sub-reporte de monto del cliente ignorado (CF lee del doc/recomputa).
13. delegación según decisión §5.1.

---

## 9 · Archivos load-bearing
- `firestore.rules` — helpers `:11-57`; gastos `:236-239`; ordenesCompra `:211-215`; requerimientos
  `:128-131`; delegaciones `:135-138`; movimientosFinancieros `:705-710`; movimientosCC `:680-685`;
  deny-by-default `:847-851`; comentario rol `:9`.
- `src/services/autorizacionEgreso.helper.ts` — lógica pura a endurecer + portar a la CF (`evaluarFirmaSocio` `:82-114`, umbral `:20`).
- `src/services/gasto.service.ts` — create sin `autorizacion` (`:90-135`), forja A/B (`:314-320`), gate cliente (`:310`), `montoUSDDeGasto` (`:47`), pago (`:1201-1216`).
- `src/services/ordenCompra.pagos.service.ts` — autorizarOC (`:357-364`), pago OC (`:248-283`).
- `src/services/requerimiento.service.ts` — `aprobaciones.firmas[]` (`:585-592`), transiciones de `estado` (`:489,1094,1162`).
- `src/services/pagoAbonoDistribuido.service.ts` — segunda ruta de egreso (`:865-867,920-925`).
- `functions/src/index.ts` — entry CF, trigger OC existente (`:118-205`), patrón rol server-side (`:767-769`), MIRROR permisos (`:808-858`).
- `functions/src/mercadolibre/ml.orderProcessor.ts` — escritor sistémico de gastos (admin SDK · rules NO aplican).
- Nuevos: `functions/src/egresos/autorizarEgreso.ts`, `.../rechazarEgreso.ts`, `.../gatearCashLedger.ts`.

---

## 10 · Fuente
Output completo del workflow: `wf_22f98a29` (recon 4/4 + adversarial). Memoria: `aprobaciones-erp.md`.
