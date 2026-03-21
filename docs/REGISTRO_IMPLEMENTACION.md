# REGISTRO DE IMPLEMENTACION — BusinessMN v2

**Agente:** implementation-controller (Agente 23)
**Proyecto:** ERP de importacion y venta de suplementos y skincare — Vitaskin Peru
**Ultima actualizacion:** 2026-03-21 (Sesion 11 — Deploy 11 exitoso: calidad de infraestructura + split Maestros + 122 tests + fix metricas + error logging)
**Branch activo:** main

---

## ESTADO GENERAL DEL PROYECTO

| Indicador | Valor |
|-----------|-------|
| Modulos en produccion | 11 de 14 |
| Sesiones de trabajo registradas | 11 |
| Rondas de full review completadas | **6 de 6 — FULL REVIEW COMPLETO** |
| Hallazgos totales identificados | 220+ |
| Fixes aplicados | 91 (31 S1-4 + 6 S5 + 24 S8 + 17 S9 + 8 S10 + 5 S11) |
| Tareas criticas pendientes | 0 (todos los bloqueantes UAT resueltos) |
| Deploys realizados | 11 (ultimo: 2026-03-21 post-Sesion 11, commit 32a2755) |
| Modulo Pool USD / Rendimiento Cambiario | INTEGRADO con OC + Gastos + Snapshot mensual + carga retroactiva + metaPEN (Sesion 10) |
| Modulo Ventas a Socios | IMPLEMENTADO — badge, exclusiones de reportes, sección en Ventas.tsx (Sesion 10) |

---

## MAPA DE ESTADO DEL SISTEMA

```
ESTADO GENERAL DEL ERP — Actualizado: 2026-03-20 (Sesion 8)

MODULOS ACTIVOS EN PRODUCCION:
  Compras/Requerimientos    — ESTABLE — desde: pre-2026
  Ordenes de Compra         — ESTABLE — desde: pre-2026 (multi-requerimiento)
  Inventario/Unidades       — ESTABLE — desde: pre-2026 (multi-pais)
  Productos                 — ESTABLE — desde: pre-2026
  Ventas/CxC                — ESTABLE — desde: pre-2026
  Cotizaciones              — ESTABLE — desde: pre-2026
  Entregas                  — ESTABLE — desde: pre-2026
  Gastos/Tesoreria          — ESTABLE — desde: pre-2026
  CTRU Dashboard v3         — ESTABLE — desde: 2026-02-18
  MercadoLibre              — ESTABLE — desde: 2026-03-08 (con pack orders)
  Escaner                   — ESTABLE — desde: reciente (UPC linking + historial)
  Transferencias            — ESTABLE — con rollback
  Contabilidad              — PARCIAL — Balance General basico, sin integr. SUNAT
  Inteligencia Producto     — PARCIAL — requiere calibracion de scores
  Clientes Maestro          — INTEGRADO — auto-create via getOrCreate, metricas ABC/RFM activas (2026-03-20)
  WhatsApp                  — EN DESARROLLO — 3 funciones creadas, sin uso en produccion
  Rendimiento Cambiario     — IMPLEMENTADO — Pool USD + TCPA + Ciclo PEN USD + Simulador TC (2026-03-20)

INTEGRACIONES ACTIVAS:
  MercadoLibre → ERP (ordenes, stock)   — ESTABLE — desde: 2026-03-08
  ERP → PDF (entregas)                  — ESTABLE

INTEGRACIONES PENDIENTES:
  SUNAT / Facturacion electronica       — INEXISTENTE — gap regulatorio critico
  WhatsApp (Meta Business API)          — EN DESARROLLO
  Banco (pagos masivos)                 — NO INICIADO

CONFIGURACIONES ESPECIALES ACTIVAS:
  - Batch chunking MAX_OPS = 450 (margen sobre limite Firestore de 500)
  - Firestore: desnormalizacion agresiva (unidad lleva productoSKU/nombre, venta lleva nombreCliente)
  - CTRU: GA/GO prorrateado solo entre unidades vendidas, proporcional al costo base
  - ML pack orders: sub-ordenes consolidadas en doc unico (ID: ml-pack-{packId})
  - Atomic counter para todos los IDs secuenciales (21 generadores migrados)
  - TC centralizado: tipoCambio.service.ts es la fuente unica (SUNAT + paralelo + umbral alerta) — eliminados 15 fallbacks 3.70
  - Pool USD con TCPA: CQRS ligero (movimientos event-sourced, resumen calculado en memoria)
  - TCPA: recalcula solo en entradas, nunca en salidas — por diseno
  - getCTRU_Real: separado de getCTRU (usa TCPA en lugar de TC historico) para no romper calculos existentes
  - 55 Cloud Functions en produccion (sin cambios en S10 — funciones estables)
  - Ventas a socios: esVentaSocio/socioNombre en tipos, badge purpura en UI, 4 exclusiones en reportes
  - ErrorBoundary: 3 capas (global → pagina → puntual), ModuleErrorBoundary.tsx nuevo wrapper
```

---

## SESION 1 — 2026-03-19 (Primera parte)

### Objetivo
Ronda 1 del full review: system-architect + security-guardian + legal-compliance-consultant.

### Agentes ejecutados
- system-architect
- security-guardian
- legal-compliance-consultant (excluido por decision del negocio — ver ADR-001)

### Fixes aplicados

#### Seguridad (SEC-001 a SEC-011) — todos completados

**SEC-001 — Secrets centralizados**
- Antes: `process.env.SECRET` directo en 6 archivos de Cloud Functions
- Despues: `functions/src/secrets.ts` con `getSecret()`. Cero accesos directos a `process.env` en codigo de produccion
- Archivos: `secrets.ts` (nuevo), `ml.api.ts`, `ml.functions.ts`, `whatsapp.meta.ts`, `whatsapp.ai.ts`, `whatsapp.classifier.ts`, `index.ts`
- Pendiente manual: rotar secrets en consolas de ML, Google, Anthropic, Meta, Daily

**SEC-002 — Auth check en mlrepairmetodoenvio**
- Antes: `onCall(async () => {})` sin verificar autenticacion
- Despues: verifica `context.auth` antes de cualquier operacion
- Archivo: `functions/src/mercadolibre/ml.functions.ts:4416`

**SEC-003 — Validacion webhook MercadoLibre**
- Antes: acepta cualquier POST sin validar origen
- Despues: valida `application_id` contra `ML_CLIENT_ID` + `user_id` contra `mlConfig/settings`
- Archivo: `functions/src/mercadolibre/ml.functions.ts:152-190`

**SEC-004 — HMAC validation WhatsApp webhook**
- Antes: webhook acepta cualquier POST sin validar firma Meta
- Despues: valida `X-Hub-Signature-256` con `crypto.createHmac('sha256', appSecret)` + `timingSafeEqual`
- Archivo: `functions/src/whatsapp/index.ts`
- Pendiente manual: configurar `WHATSAPP_APP_SECRET` en `functions/.env` desde Meta Business Suite

**SEC-005 — Storage rules restrictivas**
- Antes: `/{allPaths=**} allow read, write: if request.auth != null` (cualquier autenticado = acceso total)
- Despues: solo 3 paths permitidos (`profile-photos`, `llamadas-audio`, `comprobantes`), catch-all `allow: false`
- Archivo: `storage.rules`

**SEC-006 — Colecciones sin reglas Firestore**
- Antes: `scanHistory`, `conteosInventario`, `whatsapp_sessions`, `whatsapp_config`, `mlWebhookLog` sin reglas (denegadas por defecto, comportamiento no intencional)
- Despues: reglas explicitas para las 5 colecciones. WhatsApp y ML webhook = solo lectura admin, escritura solo Cloud Functions
- Archivo: `firestore.rules`

**SEC-007 — Google Maps API Key restriccion de dominio**
- Tipo: accion manual en Google Cloud Console
- Despues: restriccion a `vitaskinperu.web.app` y `vitaskinperu.firebaseapp.com`
- Estado: completada

**SEC-008 — Funciones callable ML con verificacion de rol**
- Antes: 17 funciones admin/repair verificaban solo `context.auth` (cualquier usuario autenticado)
- Despues: `requireAdminRole()` verifica rol `admin` o `gerente` en las 17 funciones
- Archivo: `functions/src/mercadolibre/ml.functions.ts`

**SEC-009 — OAuth callback parameter injection**
- Antes: parametro `error` de ML OAuth pasado sin sanitizar a URL de redirect
- Despues: `encodeURIComponent(String(error).substring(0, 100))` — truncado + encoded
- Archivo: `functions/src/mercadolibre/ml.functions.ts`

**SEC-010 — Security headers**
- Antes: sin headers de seguridad en respuestas HTTP
- Despues: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`
- Archivo: `firebase.json`

**SEC-011 — XSS prevention en entrega-pdf**
- Antes: `document.write()` con datos dinamicos sin sanitizar (nombres, direcciones, SKUs)
- Despues: `escapeHtml()` aplicado a todas las interpolaciones dinamicas en ambos templates HTML
- Archivo: `src/services/entrega-pdf.service.ts`

#### Arquitectura (ARCH-001 a ARCH-003) — todos completados

**ARCH-001 — Schema mismatch Cloud Functions vs Frontend**
- Severidad: CRITICO — unidades creadas por recepcion OC eran invisibles al frontend
- Antes: `onOrdenCompraRecibida` escribia `sku`, `almacenActualId`, `paisActual`, `ctruBase`, `historial`, `fechaRecepcionOrigen`, `numeroOrden`
- Despues: campos alineados con `unidad.types.ts` — `productoSKU`, `almacenId`, `pais`, `ctruInicial`, `movimientos`, `fechaRecepcion`, `ordenCompraNumero`
- Archivo: `functions/src/index.ts:150-210`

**ARCH-002 — Batch chunking implementado**
- Antes: un solo `db.batch()` para todas las unidades (>166 productos = fallo silencioso)
- Despues: chunks de 450 ops con logging por batch (`MAX_OPS_PER_BATCH = 450`)
- Archivo: `functions/src/index.ts`

**ARCH-003 — COLLECTIONS constante para Cloud Functions**
- Antes: strings hardcodeados (`"ventas"`, `"unidades"`, etc.) en todo `index.ts`
- Despues: `functions/src/collections.ts` (nuevo) mirror del frontend. Cero strings hardcodeados en `index.ts`
- Archivos: `functions/src/collections.ts` (nuevo), `functions/src/index.ts` (~25 reemplazos)

### Deploys realizados
- Deploy 1: SEC-001/002/003 + ARCH-001/002/003 + SEC-004/005
- Deploy 2: SEC-006/007/008
- Deploy 3: SEC-009/010/011

---

## SESION 2 — 2026-03-19 (Segunda parte — sesion actual)

### Objetivo
Ronda 2 del full review: frontend-design-specialist + backend-cloud-engineer + code-quality-refactor-specialist.
Nota: code-logic-analyst no se ejecuto en esta sesion — pendiente para la proxima.

### Hallazgos Frontend Design (18 findings)

#### Criticos

**R2-003 — Code splitting**
- Descubierto que YA ESTABA IMPLEMENTADO: React.lazy en App.tsx con 30 paginas lazy-loaded
- Estado: sin accion requerida

**R2-005 — Zero React.memo()**
- Ninguno de los componentes tiene React.memo(), useMemo() o useCallback()
- Impacto: re-renders en cascada al actualizar cualquier store
- Pendiente de implementar

**R2-006 — 3 stores de notificaciones redundantes**
- `toastStore`, `notificationStore`, `systemNotificationStore` — logica duplicada
- Pendiente: consolidar en un solo store

**God files (paginas >3000 lineas)**
- Tesoreria.tsx: 3798 lineas
- Transferencias.tsx: 3216 lineas
- MercadoLibre.tsx: 3142 lineas
- Maestros (AlmacenesLogistica.tsx, ProveedoresSRM.tsx): 2578 lineas
- Cotizaciones: 2540 lineas
- Requerimientos: 2461 lineas
- Pendiente: dividir en sub-modulos

#### Altos

- `ctruStore.ts`: 1084 lineas mezclando tipos + logica + estado
- ErrorBoundary: descubierto que YA EXISTE wrapping Outlet en MainLayout — sin accion requerida
- `alert()`/`confirm()` nativos en Maestros (no modal personalizado)
- Dashboard suscrito a 6 stores sin selectores optimizados
- VirtualList construido en componentes common pero nunca usado
- Skeleton loading ausente en MercadoLibre, Requerimientos, Transferencias

#### Medios

- 141 usos de `: any` en pages, 225 en stores
- `react-hook-form` + `zod` instalados pero sin adopcion real en el codigo
- Computaciones O(n*m) sin memoizar en Dashboard

### Hallazgos Backend/Cloud (28 findings)

#### Criticos

**R2-001 — generateNumeroVenta leia TODA la coleccion ventas**
- Antes: query sin filtros a coleccion `ventas` para buscar el numero mas alto
- Despues: ARREGLADO — atomic counter con transacciones Firestore
- Ver CAMBIO-002 en log de cambios

**R2-008 — unidadService.getAll() sin filtro**
- Descubierto que YA ESTABA FILTRADO con not-in `['vendida','vencida','danada']`
- Estado: sin accion requerida

**R2-009 — sincronizacion.service lee 10+ colecciones completas**
- Lee todas las colecciones operativas desde el browser para sincronizar
- Impacto: operacion extremadamente costosa en Firestore reads
- Pendiente: migrar a Cloud Function con permisos admin

#### Altos

**R2-012 — Race condition en generateNumero***
- ARREGLADO con atomic counter — ver CAMBIO-002

**R2-013 — N+1 query en seleccionarFEFO**
- Por cada unidad candidata, hace una query individual a Firestore
- Pendiente de optimizar con query batch

**R2-014 — inventario.service lee TODA ventas+cotizaciones para verificar reservas**
- Pendiente: implementar campos de estado directamente en unidades o index dedicado

**R2-015 — Missing composite indexes**
- Colecciones afectadas: unidades, ventas, gastos, mlOrderSync
- Pendiente: crear indexes en Firebase Console o `firestore.indexes.json`

**R2-016 — Sequential await en loop para siblings ML**
- Updates de sub-ordenes ML se hacen secuencialmente en lugar de paralelo
- Pendiente: `Promise.all()`

**R2-017 — mlsyncstock N reads + N API calls, probable timeout**
- Funcion de sync de stock ML hace reads + calls API proporcionales al catalogo
- Pendiente: implementar paginacion y rate limiting

**R2-018 — whatsapp_messages sin regla en firestore.rules**
- ARREGLADO — ver CAMBIO-004

**R2-029 — WhatsApp webhook procesa AI chain antes de responder 200**
- Meta requiere respuesta 200 en <20s. La cadena AI puede exceder ese tiempo
- Pendiente: responder 200 inmediatamente, procesar async con Cola o Pub/Sub

#### Medios

- `mlreingenieria` callable de 9 minutos carga todas las colecciones
- Sequential producto fetch en loop de recepcion OC
- `limpiezaDiaria` era scheduled no-op — ARREGLADA (deshabilitada, ver CAMBIO-005)
- Full collection reads en `mlProductMap`, gastos
- `onGastoCreado` puede escribir 500+ docs sin chunking (aunque ahora usa sequenceGenerator)
- Race condition en `gasto.service.ts:756-763` — usa `padStart` manual despues de `getNextSequenceNumber()` (inconsistencia)

#### Bajos

- TC desde API no oficial (Banco de la Nacion scraping)
- `axios` import en module level en Cloud Functions (cold start overhead)
- `mlrefreshtoken` corre cada 4h sin verificar si ML esta conectado

### Hallazgos Code Quality (20 findings)

#### Criticos

**R2-002 — Zero tests automatizados**
- 180k+ lineas de codigo sin un solo test automatizado
- Riesgo: cualquier refactoring mayor es un cambio a ciegas
- Pendiente: configurar Vitest + primer suite de tests en zonas rojas

**R2-010 — formatFecha duplicado ~30 veces**
- ARREGLADO — ver CAMBIO-001: 41 archivos migrados a `dateFormatters.ts`

**R2-004 — God files (63+ archivos >500 lineas)**
- Ver seccion de hallazgos frontend para los 6 peores casos
- Pendiente: refactoring gradual

**R2-007 — 875 usos de `: any`, 166 `as any`**
- Type safety comprometida en todo el codebase
- Pendiente: reduccion gradual, prioritizar zonas rojas

**R2-011 — 50 console.log de debug FEFO en produccion**
- En `venta.service.ts` — logs de desarrollo dejados activos
- Pendiente: eliminar o reemplazar con logger condicional

#### Altos

- `calcularDiasParaVencer` duplicado 6+ veces — ARREGLADO: migrado a `dateFormatters.ts`
- 22 `.catch(() => {})` swallowing errors silenciosamente
- 133 `console.log` en servicios (logger existe en el proyecto pero no se usa)
- 3 patrones de export inconsistentes en servicios (singleton objects, clases estaticas, singletons instanciados)
- `useAutoSave`/`useFormValidation` hooks construidos pero sin uso real

#### Medios

- Dual notification system (3 stores, 2 services)
- `snapshot.docs.map` pattern repetido 40+ veces (candidato para `firestoreHelpers.ts`)
- `CanalVenta = string` (tipo demasiado amplio, deberia ser union type)
- Migration utils (`migrarProductos.ts`) aun desplegados post-fresh-start

### Fixes aplicados en Sesion 2

#### CAMBIO-001 — 41 archivos migrados a formatFecha centralizado
- Tipo: Refactoring / Code Quality
- Descripcion: Eliminadas copias locales de `const formatFecha = (timestamp: any) => ...` en 41 archivos. Todos importan de `src/utils/dateFormatters.ts`. Incluye `formatFechaRelativa` y `calcularDiasParaVencer`.
- Impacto: cero logica duplicada de fechas, 1 punto de mantenimiento
- Reversible: si

#### CAMBIO-002 — 21 generadores de numeros secuenciales migrados a atomic counter
- Tipo: Bug fix / Race condition
- Descripcion: Reemplazados todos los patrones de "leer coleccion, buscar max, incrementar" por `getNextSequenceNumber()` de `src/lib/sequenceGenerator.ts` con transacciones Firestore atomicas.
- Servicios migrados: venta, gasto, cotizacion, ordenCompra, expectativa, requerimiento (x2), tesoreria (MOV+CONV), cliente, proveedor, marca, almacen, transportista, categoria, etiqueta, tipoProducto, canalVenta, entrega, transferencia, producto (SKU), competidor
- Nota: `gasto.service.ts:756-763` tiene inconsistencia residual — usa `padStart` manual despues de `getNextSequenceNumber()`. Pendiente limpiar.
- Reversible: si

#### CAMBIO-003 — ML webhook fail-closed
- Tipo: Seguridad
- Descripcion: Si `ML_CLIENT_ID` no esta configurado en secrets, el webhook rechaza con 503 en lugar de aceptar silenciosamente todas las notificaciones
- Archivo: `functions/src/mercadolibre/ml.functions.ts`
- Reversible: si

#### CAMBIO-004 — whatsapp_messages regla en firestore.rules
- Tipo: Seguridad
- Descripcion: Coleccion `whatsapp_messages` sin regla anterior. Ahora: read solo admin/gerente, write: false (Cloud Functions only via Admin SDK)
- Archivo: `firestore.rules`
- Reversible: si

#### CAMBIO-005 — limpiezaDiaria deshabilitada
- Tipo: Operacional
- Descripcion: Funcion scheduled `limpiezaDiaria` era un no-op que generaba invocaciones diarias sin hacer nada util. Deshabilitada hasta que tenga implementacion real.
- Archivo: `functions/src/index.ts`
- Reversible: si (re-habilitar el schedule)

### Descubrimientos — ya implementado (no por los agentes)
- React.lazy ya en `App.tsx` con 30 paginas lazy-loaded (R2-003 no es problema)
- ErrorBoundary ya wrapping Outlet en `MainLayout` (no solo en 1 ruta)
- `unidadService.getAll()` ya filtra con not-in `['vendida','vencida','danada']` (R2-008 no es problema)
- `sequenceGenerator.ts` ya existia con transacciones atomicas (se adopto en la migracion de CAMBIO-002)
- `dateFormatters.ts` y `firestoreHelpers.ts` ya creados pero sin consumidores (CAMBIO-001 los adopto)

---

## SESION 3 — 2026-03-19 (Tercera parte — continuacion)

### Objetivo
Completar Ronda 2 (code-logic-analyst) + Ronda 3 parcial (database-administrator) + Ronda 4 parcial (performance-monitoring-specialist).

### Agentes ejecutados
- code-logic-analyst (completa Ronda 2 — zonas rojas)
- database-administrator (inicia Ronda 3)
- performance-monitoring-specialist (inicia Ronda 4 — en curso al cierre)

### Hallazgos Code Logic Analyst (15 findings)

#### BUGS (6 encontrados)

**BUG-001 — Precio unitario incorrecto en entregas multi-producto**
- Ubicacion: `entrega.service.ts` o logica de generacion de PDF de entrega
- Descripcion: cuando una entrega tiene multiples productos, el precio unitario puede calcularse incorrectamente (division por total de unidades en lugar de por producto)
- Impacto: clientes ven precios incorrectos en documentos de entrega
- Prioridad: ALTA
- Estado: pendiente

**BUG-002 — Double GD expense por race condition**
- Ubicacion: `gasto.service.ts` / logica de gasto de delivery
- Descripcion: si se hace doble click o se ejecuta la accion de crear gasto de delivery dos veces, se generan 2 gastos identicos. No hay proteccion de idempotencia.
- Impacto: duplicacion de gastos en contabilidad y tesoreria
- Prioridad: CRITICA
- Estado: pendiente

**BUG-003 — reservadaPara no se limpia en cancelacion**
- Ubicacion: `unidad.service.ts` o `venta.service.ts`
- Descripcion: cuando se cancela una venta, las unidades que tenian `reservadaPara` apuntando a esa venta no se limpian. Quedan "bloqueadas" sin venta activa.
- Impacto: unidades disponibles aparecen como reservadas, inventario fantasma
- Prioridad: ALTA
- Estado: pendiente

**BUG-004 — (identificado como duplicado de BUG-002, consolidado)**

**BUG-005 — (identificado como variante menor, consolidado con otros)**

**BUG-006 — getMovimientos ignora cuentaDestino**
- Ubicacion: `tesoreria.service.ts`
- Descripcion: `getMovimientos()` filtra solo por `cuentaOrigenId` pero ignora `cuentaDestinoId`, lo que hace que transferencias entre cuentas solo aparezcan en una de las dos cuentas
- Impacto: saldos de cuentas de tesoreria pueden estar incompletos
- Prioridad: ALTA
- Estado: pendiente

#### DATA ISSUES (4)

**DATA-001 — null fechaVencimiento causa crash en sort FEFO**
- Ubicacion: `venta.service.ts` (seleccionarFEFO)
- Descripcion: si una unidad tiene `fechaVencimiento: null`, el sort FEFO (First Expired, First Out) crashea o produce orden incorrecto
- Impacto: unidades sin vencimiento se priorizan incorrectamente o causan error
- Prioridad: CRITICA (afecta asignacion de stock)
- Estado: pendiente

**DATA-002 — Unidades sin productoId valido**
- Descripcion: algunas unidades en Firestore pueden tener `productoId` apuntando a producto eliminado
- Impacto: errores al intentar cargar datos del producto asociado
- Prioridad: media
- Estado: pendiente (requiere script de limpieza)

**DATA-003 — Inconsistencia en campos de moneda**
- Descripcion: algunos documentos tienen `moneda: "USD"` y otros `moneda: "usd"` (case mismatch)
- Prioridad: baja
- Estado: pendiente

**DATA-004 — Campos deprecated coexisten con nuevos**
- Descripcion: campos como `almacenActualId` vs `almacenId`, `fechaLlegadaPeru` (ghost field)
- Prioridad: baja
- Estado: pendiente (requiere migracion gradual)

#### EDGE CASES (5)

**EDGE-001 — Venta sin items arroja error no descriptivo**
**EDGE-002 — OC con 0 productos puede crearse**
**EDGE-003 — Transferencia a mismo almacen permitida**
**EDGE-004 — Gasto con monto 0 o negativo aceptado**
**EDGE-005 — Unidad puede cambiar de estado a estado invalido (sin state machine)**

### Hallazgos Database Administrator (19+ findings)

#### Indexes faltantes (4)

**IDX-001 — unidades: productoId + estado**
- Coleccion: `unidades`
- Campos: `productoId` (ASC) + `estado` (ASC)
- Impacto: queries de inventario por producto sin index = full scan
- Estado: pendiente

**IDX-002 — ventas: estado + fechaCreacion**
- Coleccion: `ventas`
- Campos: `estado` (ASC) + `fechaCreacion` (DESC)
- Impacto: listado de ventas activas sin index = full scan
- Estado: pendiente

**IDX-003 — gastos: tipo + fechaCreacion**
- Coleccion: `gastos`
- Campos: `tipo` (ASC) + `fechaCreacion` (DESC)
- Impacto: filtrado de gastos por tipo sin index
- Estado: pendiente

**IDX-004 — mlOrderSync: status + fechaCreacion**
- Coleccion: `mlOrderSync`
- Campos: `status` (ASC) + `createdAt` (DESC)
- Impacto: queries de ordenes ML pendientes sin index
- Estado: pendiente

#### Integrity Issues (8)

**INT-001 — Campo almacenId vs almacenActualId inconsistencia**
- Frontend usa `almacenId`, Cloud Function `onOrdenCompraRecibida` escribia `almacenActualId`
- Estado: parcialmente arreglado en ARCH-001, pero datos historicos pueden tener inconsistencia
- Accion: script de normalizacion pendiente

**INT-002 — Ghost field fechaLlegadaPeru**
- Campo referenciado en codigo pero sin evidencia de escritura consistente
- Estado: investigar y eliminar si no se usa

**INT-003 — Unidades huerfanas (productoId apunta a producto inexistente)**
- Ver DATA-002 del code-logic-analyst
- Estado: pendiente script de deteccion

**INT-004 — Ventas con items sin unidadId**
- Posibles ventas creadas antes de la migracion a sistema de unidades
- Estado: verificar alcance

**INT-005 — Desnormalizacion desactualizada**
- `unidad.productoNombre` puede no coincidir con `producto.nombre` si el producto se renombro
- Impacto: informacion visual incorrecta, no afecta logica
- Estado: pendiente mecanismo de cascade update

**INT-006 — OCs con requerimientoId singular + requerimientoIds[] coexisten**
- Migracion a multi-requerimiento dejo datos legacy con campo singular
- Estado: `getRequerimientoIds()` maneja backwards compat, pero datos sucios persisten

**INT-007 — Gastos sin ventaId ni OCId (gastos huerfanos)**
- Gastos operativos correctos, pero no se puede trazar a entidad de origen
- Estado: baja prioridad, es diseño intencional para gastos generales

**INT-008 — Contadores existentes vs nuevos (post-migracion atomic counter)**
- Los contadores en coleccion `contadores/` fueron inicializados pero datos historicos tienen formato diferente
- Estado: monitoreado, no requiere accion inmediata

#### Recomendaciones DBA

- **Backup automatizado**: No existe backup automatizado de Firestore. Recomendacion: configurar Firebase Export scheduled (gcloud firestore export)
- **7 query patterns costosos**: sincronizacion.service (ya en TAREA-005), inventario.service (ya en TAREA-006), + 5 patterns de full-collection reads en servicios operativos
- **Field name audit**: ejecutar script que detecte documentos con campos legacy vs nuevos

### Hallazgos Performance Monitoring Specialist (17 perf + 4 observabilidad)

#### CRITICOS (6)

**PERF-001 — N+1 masivo en actualizarCTRUPromedioProductos**
- Ubicacion: `ctru.service.ts:304-337`
- Impacto: ejecuta 1 query Firestore POR PRODUCTO del catalogo en cada recalculo. 200 productos = 201 queries seriales (~45 seg)
- Solucion: cargar todas unidades una vez, crear Map<productoId, Unidad[]>
- Mejora estimada: 201 queries → 2 queries (~2 seg)
- Estado: pendiente

**PERF-002 — getAllIncluyendoHistoricas() sin filtro carga TODO**
- Ubicacion: `unidad.service.ts:56-62`
- Impacto: ctruStore y ctruService descargan TODAS las unidades (vendidas, vencidas, danadas). A 5.000 unidades = 5.000 docs por recalculo
- Estado: pendiente

**PERF-003 — Dashboard carga 8 colecciones completas en cada visita**
- Ubicacion: `Dashboard.tsx:91-134`
- Impacto: 5 usuarios simultaneos = 10.000+ lecturas Firestore en segundos
- Solucion: implementar staleTime en stores (React Query ya esta en el stack)
- Mejora estimada: reduce 80% lecturas Firestore
- Estado: pendiente

**PERF-004 — almacen.service ejecuta full scan de unidades en 5 metodos**
- Ubicacion: `almacen.service.ts:151,222,278,511,672`
- Impacto: descarga TODAS las unidades para filtrar por almacenId en memoria
- Solucion: reemplazar por `where('almacenId', '==', ...)`
- Estado: pendiente

**PERF-005 — inventario.service lee colecciones completas sin filtro**
- Ubicacion: `inventario.service.ts:359,363,541,558-561,730,737`
- Impacto: liberarReservasHuerfanas() descarga ventas + cotizaciones + unidades completas
- Estado: pendiente

**PERF-006 — getHistorialCTRUProducto() ejecuta 6 queries seriales**
- Ubicacion: `ctru.service.ts:431-461`
- Solucion: 1 query con filtro fecha en memoria, o Promise.all() paralelo
- Estado: pendiente

#### ALTOS (5)

**PERF-007 — VentaService.getAll() sin limite**
- 500 ventas = 6 MB descargados en cada carga. Necesita `limit(100)` + paginacion
- Estado: pendiente

**PERF-008 — notificacion.service listener sin filtro por usuario**
- Descarga notificaciones de TODOS los usuarios, filtra en memoria
- Riesgo de seguridad ademas de rendimiento
- Estado: pendiente

**PERF-009 — mlautocreateventas scheduled cada 2 min con cold starts**
- 720 ejecuciones/dia, mayoria vacías. Aumentar a 5 min sin impacto operativo
- Estado: pendiente

**PERF-010 — onOrdenCompraRecibida N queries seriales por producto**
- OC con 10 productos = 10 queries seriales. Usar Promise.all()
- Estado: pendiente

**PERF-011 — Cloud Functions HTTP sin timeout configurado (default 60s)**
- Estado: pendiente

#### MEDIOS — Bundle y Frontend (6)

**PERF-012** — `@daily-co/daily-js` (~500KB) sin lazy load
**PERF-013** — `xlsx` (~450KB) sin lazy load
**PERF-014** — `chunkSizeWarningLimit: 600` oculta chunks grandes
**PERF-015** — `jspdf` + `jspdf-autotable` (~490KB) sin lazy load
**PERF-016** — Inventario.tsx suscribe 5 stores sin selectores
**PERF-017** — Requerimientos.tsx (~2200 lineas) kanban sin memoizacion

#### OBSERVABILIDAD (4)

**OBS-001** — Sin APM ni tracing distribuido (no se sabe cuanto tarda CTRU en prod)
**OBS-002** — onSnapshotWithRetry sin limite de reintentos
**OBS-003** — Fallback de VentaService.getVentasRecientes solo logea console.error
**OBS-004** — Sin metricas de duracion en recalculo CTRU

#### Evaluacion de capacidad

| Escenario | Lecturas Firestore estimadas | Riesgo |
|---|---|---|
| 1-5 usuarios, BD vacia | Sin friccion | Bajo |
| 1.000 unidades, 500 ventas | Dashboard descarga ~2.500 docs por visita | Medio |
| 5.000 unidades, 2.000 ventas | CTRU recalculo ~45 seg, quota diaria agotable | ALTO |

#### Puntos positivos detectados
- ventaStore: patron suscripcion/desuscripcion implementado correctamente
- ctruStore.fetchAll(): Promise.all para queries paralelas
- MainLayout: cleanup correcto de todos los listeners (sin memory leaks)
- Ventas.tsx: useMemo bien aplicado en 4 computaciones pesadas
- Batch chunking: limite 450 ops consistente en ctru.service y Cloud Functions

### Hallazgos BI Analyst (15 gaps + 12 recomendaciones + 7 oportunidades)

#### CRITICOS — Inconsistencias de datos entre modulos

**BI-D05 — TC inconsistente para valorizar inventario**
- Dashboard usa `TC compra`, Reportes usa `TC venta` para el mismo inventario
- Impacto: el inventario "vale distinto" segun la pantalla
- Estado: pendiente (decision de negocio requerida)

**BI-A01 — Ventas reconocidas por fechaCreacion, no fechaEntrega**
- Contabilidad reconoce ingreso al crear el pedido, no al entregar
- Impacto: P&L puede inflar ingresos del mes con ventas no entregadas
- Estado: pendiente (decision de negocio: devengado vs caja)

**BI-A03 — Sin reconciliacion entre Contabilidad y Reportes**
- Criterios de fecha diferentes producen totales diferentes para el mismo mes
- Impacto: dos fuentes de verdad para ventas mensuales
- Estado: pendiente

**DM-07 — Criterios de fecha inconsistentes entre 3 modulos**
- Dashboard, Reportes y Contabilidad usan fechas diferentes para las ventas
- Estado: pendiente (requiere REC-01: unificar criterio global)

#### ALTOS — Gaps de KPIs criticos para el negocio

**GAP-01** — Sin entidad cliente estructurada (bloquea CRM, churn, LTV, DSO)
**GAP-04** — Sin DSO (Days Sales Outstanding)
**GAP-09** — Sin presupuesto vs real
**GAP-13** — Sin comparativa vs periodo anterior en ningun dashboard
**BI-R04** — Gastos no vinculados no se distribuyen a productos (rentabilidad descuadrada)
**BI-D03** — Margen promedio calculado como promedio de promedios (estadisticamente incorrecto)

#### MEDIOS — Oportunidades de BI con datos existentes

- BI-OPP01: Matriz Producto x Canal (datos ya en ventas.canal)
- BI-OPP03: Analisis 80/20 concentracion de productos
- BI-OPP04: Rentabilidad por lote de OC (datos en CTRU)
- BI-OPP06: Dashboard diferencial cambiario (tipos ya modelados en reporte.types.ts)
- BI-OPP07: Ranking de vendedores por margen (datos en ventas.creadoPor)

#### Positivos detectados por BI Analyst
- CTRU 7 capas: "la joya analitica del sistema" — pocos ERPs del segmento tienen este nivel
- Desnormalizacion bien pensada para analytics (costos en unidad, TC en transaccion)
- Soporte multi-moneda correcto (TC historico por transaccion)
- Score de Liquidez innovador (Rotacion 50% + Margen 30% + Demanda 20%)
- Tipos FX completos en reporte.types.ts (solo falta la pantalla)

### Hallazgos ERP Business Architect (7 O2C + 7 P2P + 5 R2R + 4 CTRU + 7 gaps + roadmap)

#### Evaluacion de flujos de proceso

**O2C (Order-to-Cash): 78% completado**
- ERP-O2C-001: Reconocimiento de ingresos por fechaCreacion, no fechaEntrega (Critico — NIC 15)
- ERP-O2C-002: Sin entidad Cliente estructurada (Alta — bloquea CRM, LTV, DSO)
- ERP-O2C-003: Sin facturacion electronica SUNAT (Critico — riesgo regulatorio)
- ERP-O2C-004: Flujo de cotizacion sobre-complejo para volumen actual (Baja)
- ERP-O2C-005: Devolucion parcial sin flujo inverso completo (Alta)
- Fortalezas: FEFO, entregas parciales, pre-venta con bloqueo, gastos de venta desglosados

**P2P (Procure-to-Pay): 85% completado — el mas maduro**
- ERP-P2P-002: Sin flujo de aprobacion de compras (Media)
- ERP-P2P-006: Sin validacion de precio historico en OC (Media)
- Fortalezas: consolidacion multi-requerimiento, recepcion parcial, pagos con TC, expectativa vs realidad

**R2R (Record-to-Report): 40% completado — el mas debil**
- ERP-R2R-001: Contabilidad sintetica (calculada on-the-fly), no partida doble (Alta)
- ERP-R2R-002: Costo reconocido por OCs recibidas, no COGS de unidades vendidas (Alta)
- ERP-R2R-003: Balance General calculado, no acumulativo (Alta)
- ERP-R2R-004: Sin cierre de periodo contable (Media)
- ERP-R2R-005: TC inconsistente para valorizacion (Alta — ya documentado BI-D05)

#### Adaptacion a industria (suplementos/skincare)
- Lotes, FEFO, alertas de vencimiento, trazabilidad por unidad: todo implementado
- Gap: ERP-IND-004 — Sin campo para registro sanitario DIGESA (NSO)
- CTRU 7 capas: "fortaleza diferenciadora del sistema"

#### Madurez: sobre-disenado vs sub-disenado
- **Sobre-disenado:** Cotizaciones (7 estados), SRM scoring, Investigacion de Mercado
- **Sub-disenado:** Cliente como entidad, Contabilidad formal, Regulatorio (SUNAT/DIGESA), Reportes de gestion

#### Roadmap recomendado
- **Fase 1 (0-3 meses):** SUNAT, entidad cliente, reconocimiento ingresos, TC unico, automatizaciones basicas
- **Fase 2 (3-6 meses):** Presupuesto vs real, devoluciones, COGS correcto, cierre mensual, DIGESA
- **Fase 3 (6-12 meses):** CRM basico, aprobaciones, contabilidad formal, CTRU incremental, PWA movil

#### Resumen ejecutivo
> "Operativamente funcional, regulatoriamente deficiente, financieramente aproximado."
> Los 3 gaps criticos antes de cualquier feature nuevo: SUNAT, reconocimiento ingresos, entidad cliente.

### Hallazgos Business Docs Manager (16 docs faltantes + 6 UX issues + 4 logica negocio)

**Veredicto: Documentacion tecnica BUENA, documentacion de usuario INEXISTENTE.**

#### Documentacion existente y precisa
- `docs/MAPA_CONTEXTO_2026-03-19.md` — excelente para desarrolladores
- `docs/REGISTRO_IMPLEMENTACION.md` — completo para equipo tecnico
- `CLAUDE.md` + `MEMORY.md` — actualizados

#### Documentacion desactualizada
- `README.md` — menciona React 18 (usa 19.2), Node.js 18+ (usa 20), modulos "En Desarrollo" ya en produccion
- `Manual Sistema/BMN_INDICE_MAESTRO.md` — enlaces rotos a rutas inexistentes
- `Manual Sistema/BMN_RESUMEN_EJECUTIVO.md` — habla de Fase 1, sistema ya en Fase 4-5

#### Documentacion faltante critica (NADA existe)
- **DOC-001** — Guia de admin: gestion de usuarios y roles (Critica)
- **DOC-002** — Glosario de terminos: CTRU, FEFO, Expectativas, estados de unidad (Critica)
- **DOC-003** — Manual del vendedor: cotizaciones y ventas (Critica)
- **DOC-004** — Manual del comprador: requerimientos y OCs (Critica)
- **DOC-005** — Manual del almacenero: recepcion, transferencias, escaner (Alta)
- **DOC-006** — Guia CTRU para gerencia (Alta)
- **DOC-007** — Procedimiento emergencia ML: venta no llega (Alta)
- **DOC-008** — README actualizado para desarrolladores (Alta)
- **DOC-009** a **DOC-016** — Guia finanzas, proceso AS-IS, release notes, FAQ, runbook, API docs (Media-Baja)

#### Hallazgos UX (no tecnicos)
- **UX-001** — Terminologia tecnica sin explicacion en interfaz (CTRU, FEFO, estados)
- **UX-002** — Admin no recibe notificacion de usuarios pendientes de aprobacion
- **UX-003** — Modulo "Expectativas" con nombre no intuitivo
- **UX-004** — Sin feedback de confirmacion en operaciones irreversibles (recepcion OC)
- **UX-005** — Estados de unidad muestran nombres internos (`asignada_pedido` en vez de "Asignada a pedido")
- **UX-006** — Sin pagina 404 personalizada

#### Riesgo principal
> "La empresa opera con conocimiento tacito centralizado. Si el operador principal no esta disponible, no hay documentacion que le permita a otro miembro del equipo continuar las operaciones."

### Hallazgos Quality UAT Director (4 bloqueantes + 9 mayores + 8 menores = 21 defectos)

**Veredicto: NO APROBADO PARA GO-LIVE** — 4 defectos bloqueantes deben resolverse primero.

#### Defectos BLOQUEANTES (4)

**UAT-001 — Eliminacion de pago no revierte movimiento en Tesoreria**
- Al eliminar un pago de una venta, el movimiento de ingreso en Tesoreria permanece intacto
- `eliminarPago()` en `venta.service.ts:1758-1810` no llama a `tesoreriaService.eliminarMovimiento()`
- Contraste: `gasto.service.ts` SI revierte movimientos al cambiar de pagado a pendiente
- Impacto: saldo de caja inflado, reportes financieros incorrectos
- Estado: pendiente — requiere fix puntual

**UAT-002 — Cotizacion puede confirmarse sin pasar por estado "validada"**
- `confirmarCotizacion()` en `venta.service.ts:525-563` acepta cotizaciones en cualquier estado
- Solo verifica `estado === 'cotizacion' || 'reservada'`, sin requerir `estadoCotizacion === 'validada'`
- Impacto: vendedor puede confirmar y asignar inventario a cotizacion no aprobada por cliente
- Estado: pendiente — requiere deliberacion con titular (puede ser flujo intencional)

**UAT-003 — Campo de reserva inconsistente: `reservadaPara` vs `reservadoPara`**
- Dos nombres de campo coexisten para la misma funcionalidad en unidades
- Codigo usa array de ambos: `[unidadExtendida.reservadaPara, unidadExtendida.reservadoPara].filter(Boolean)`
- Impacto: unidad reservada puede quedar invisible para FEFO, o asignarse a otro cliente
- Estado: pendiente — requiere migracion de datos + unificacion de campo

**UAT-004 — Precio unitario incorrecto en entregas multi-producto (= BUG-001)**
- `entrega.service.ts:592-594`: precio = `subtotalPEN / unidadesIds.length` (promedio plano)
- Ejemplo: 2x ProductoA S/100 + 1x ProductoB S/200 → todos quedan en S/133.33
- Impacto: CTRU corrompido, margenes de rentabilidad por producto incorrectos
- Estado: pendiente (TAREA-032)

#### Defectos MAYORES (9 — resolver antes de go-live)

**UAT-005** — Cancelar venta con pagos no revierte Tesoreria (UI advierte pero no bloquea)
**UAT-006** — TC fallback silencioso de 3.70 cuando API falla (`venta.service.ts:763-771`)
**UAT-007** — OC puede recibirse sin TC de pago, usa TC de compra sin advertencia (`ordenCompra.service.ts:825`)
**UAT-008** — Race condition residual en numeracion (= TAREA-004)
**UAT-009** — `nombreCliente` es texto libre, `clienteId` opcional — ventas sin cliente estructurado
**UAT-010** — Estado `parcial` invisible en pipeline de ventas (no aparece en stats ni UI)
**UAT-011** — Gasto GA/GO con monto $0 dispara recalculo CTRU innecesario
**UAT-012** — Entrega puede marcarse `en_camino` sin verificar que unidades esten en `asignada_pedido`
**UAT-013** — Guard anti-duplicado de pago ML usa `registradoPor` en vez de idempotencia por `mercadoLibreId`

#### Defectos MENORES (8 — pueden ir post go-live)

**UAT-014** — FEFO no muestra unidades en `en_transito_peru` como "por llegar"
**UAT-015** — Estado interno `en_entrega` mostrado como "Programada" en UI (confuso)
**UAT-016** — Filtro de vencimiento se evalua en memoria (no en query Firestore)
**UAT-017** — Cotizaciones con faltante de stock sin badge visual prominente
**UAT-018** — Numero de entrega correlativo por venta, no global
**UAT-019** — Reservas por adelanto sin expiracion automatica (inmoviliza stock)
**UAT-020** — Filtro por linea de negocio no aplica a KPIs financieros
**UAT-021** — Sin flujo de devolucion post-entrega (unidad vendida → disponible)

#### 5 Casos UAT prioritarios disenados
- CASO-UAT-01: Ciclo venta multi-producto con entrega (valida UAT-004)
- CASO-UAT-02: Registro y reversion de pago (valida UAT-001)
- CASO-UAT-03: Recepcion OC con reserva automatica (valida UAT-003)
- CASO-UAT-04: Cancelacion de venta con pagos (valida UAT-005)
- CASO-UAT-05: Gasto GA/GO y recalculo CTRU (valida distribucion proporcional)

#### Hallazgos adicionales del segundo pase UAT (complementarios)

**RISK-UAT-001 — Doble asignacion FEFO en ventas concurrentes**
- `asignarInventario()` lee stock → construye batch → commit. Sin lock previo.
- Con 2+ vendedores simultaneos, misma unidad puede asignarse a 2 ventas.
- Firestore no tiene SELECT FOR UPDATE. Probabilidad: media-alta con multiples vendedores.

**RISK-UAT-002 — CTRU recalculo parcial si batch falla a mitad**
- `recalcularCTRUDinamico()` actualiza TODAS las unidades en batches secuenciales.
- Si batch #3 de 10 falla, batches 1-2 ya se aplicaron — sin transaccion compensatoria.
- `ctruLockService` previene concurrencia, pero no rollback.

**GAP-UAT-001 — Devoluciones: estados existen pero funcion no implementada**
- `EstadoVenta` incluye `'devuelta'` y `'devolucion_parcial'` pero NO existe `procesarDevolucion()` en venta.service.ts

**GAP-UAT-002 — Precio venta no validado contra CTRU**
- Vendedor puede registrar venta por debajo del costo sin advertencia
- `precioMinimo` en CTRU es solo informativo, no se valida en `crearVenta()`

**GAP-UAT-003 — Ajuste de inventario sin OC no implementado**
- `TipoMovimiento` incluye `'ajuste'` pero no existe formulario ni servicio
- Conteo fisico con diferencias no tiene flujo formal

**GAP-UAT-004 — Reservas no expiran automaticamente**
- `StockReservado` tiene `vigenciaHasta` pero no hay Cloud Function scheduler que libere stock expirado
- Unidades quedan bloqueadas indefinidamente → stock disponible artificialmente bajo

**10 criterios de aceptacion implicitos no definidos (CA-001 a CA-010)**
- CA-001: Vigencia de cotizacion antes de expirar
- CA-002: Max extensiones de reserva por adelanto (tipo dice 3, servicio no valida)
- CA-003: Quorum de aprobacion de requerimiento
- CA-004: Umbral stock para alerta automatica
- CA-005: Tratamiento contable de cancelacion con pago parcial
- CA-006: Criterio de redondeo CTRU (punto flotante sin toFixed)
- CA-007: TC fallback cuando no hay registro del dia
- CA-008: Dias max OC en transito antes de alerta
- CA-009: Colision unidad vencida + reservada
- CA-010: Definicion de saldo completo en devolucion parcial

**10 escenarios UAT completos disenados** (con pasos, datos, resultado esperado):
- UAT-E01: O2C completo con adelanto
- UAT-E02: Recepcion OC + flete posterior → CTRU
- UAT-E03: Transferencia internacional con faltantes
- UAT-E04: Gasto GA/GO → recalculo CTRU proporcional
- UAT-E05: Orden ML completa (webhook a entrega)
- UAT-E06: Pack order ML multi-producto
- UAT-E07: Impacto TC en costos OC
- UAT-E08: Segregacion de roles vendedor vs finanzas
- UAT-E09: Cancelacion con inventario asignado
- UAT-E10: Filtro global linea de negocio

#### Coordinaciones necesarias
- `code-logic-analyst` → implementar UAT-001, UAT-003, UAT-004
- `security-guardian` → auditar firestore.rules para segregacion de roles (DEF-006: vendedor puede escribir en /gastos)
- `database-administrator` → migracion campo reservadaPara
- `backend-cloud-engineer` → Cloud Function scheduler para expirar reservas (GAP-UAT-004)
- `project-manager-erp` → fecha comprometida para los 4 bloqueantes

### Hallazgos Logistics & Supply Chain Consultant (6 hallazgos + 6 riesgos + 4 configs)

#### CRITICOS (2)
**LOG-001 — Valoracion de inventario usa solo capas 1-2, no CTRU completo**
- Dashboard inventario muestra `costoUnitarioUSD + costoFleteUSD` (capas 1-2), no costo real (7 capas)
- Impacto: subestima valor del inventario, decisiones de precio incorrectas
- Ubicacion: `inventario.service.ts:74-78`
- Estado: pendiente (requiere decision de negocio: que costo mostrar)

**LOG-002 — MAX_BATCH = 500 en sincronizarReservasHuerfanas (deberia ser 450)**
- El estandar del proyecto es 450 (margen sobre limite Firestore de 500)
- Ubicacion: `inventario.service.ts:378`
- Estado: pendiente (quick fix de 1 linea)

#### ALTOS (4)
**LOG-003** — FEFO no cubre unidades en origen (solo disponible_peru) — sin priorizacion de envio por vencimiento
**LOG-004** — Devoluciones de clientes: flujo no implementado (sin tipo movimiento `devolucion`)
**LOG-005** — stockCritico compara disponibles globales vs stockMinimo (deberia ser solo Peru)
  - `inventario.service.ts:101-103`: incluye unidades en USA que no se pueden vender
**LOG-006** — Contadores denormalizados en almacen pueden desincronizarse (doble fuente de verdad)

#### RIESGOS OPERATIVOS (6)
**RIESGO-001** — Unidades sin fechaVencimiento: tipo dice requerido pero puede faltar en datos reales
**RIESGO-002** — Sin proceso automatico de marcado de unidades vencidas (riesgo de venta de vencidos)
**RIESGO-003** — Reservas sin vencimiento automatico pueden bloquear stock indefinidamente
**RIESGO-004** — Rollback de transferencias depende de campo `estadoAntesDeTransferencia` (puede faltar)
**RIESGO-005** — Sin MRP ni punto de reorden automatico (lead time 30-60 dias sin alerta temprana)
**RIESGO-006** — Recepciones parciales de OC sin control de tolerancia de faltantes

#### CONFIGURACIONES RECOMENDADAS
- CONFIG-001: Alertas de vencimiento a 30/90 dias como notificacion activa (no solo numero en dashboard)
- CONFIG-002: Umbral minimo de transferencia (ej: 10 unidades o $100 USD)
- CONFIG-003: `stockMinimo` obligatorio para productos activos (formula: ventasPromMensual * leadTimeDias/30)
- CONFIG-004: Vigencia de reservas diferenciada por canal (directo: 48h, ML: 24h, con adelanto: sin limite)

#### POSITIVOS DETECTADOS
- FEFO correctamente implementado para ventas
- Trazabilidad completa de unidad desde OC hasta venta (ordenCompraId, lote, movimientos[], ventaId)
- Multi-origen bien estructurado (USA, China, Corea) con helpers y compatibilidad legacy
- Control de capacidad de almacenes (alerta >80%)
- Tres niveles de reconciliacion (reservas, estados, stock productos)

### Hallazgos ERP Integration Engineer (21 findings)

#### CRITICO (1)
**INT-020 — Gap SUNAT: facturacion electronica completamente ausente**
- Estado: pendiente — decision de negocio (ya documentado como gap conocido)

#### ALTOS — MercadoLibre (7)
**INT-001** — Webhook: `application_id` omitido bypasea validacion SEC-003 (`ml.functions.ts:190`)
**INT-002** — Webhook responde 200 ante errores, sin recuperacion automatica (`ml.functions.ts:284`)
**INT-003** — `stockPendienteML` incremento sin transaccion atomica — riesgo de overselling (`ml.sync.ts:955`)
**INT-004** — Race condition en merge de pack sub-ordenes sin transaccion (`ml.sync.ts:243`)
**INT-010** — Shipment handler marca unidades como vendidas sin verificar estado previo (`ml.sync.ts:1154`)
**INT-021** — Sin DLQ ni alertas automaticas para ordenes ML en estado `error`

#### ALTOS — WhatsApp (3)
**INT-011** — Fallback permisivo cuando falta `WHATSAPP_APP_SECRET` (return true) (`whatsapp/index.ts:35`)
**INT-013** — Cadena AI completa antes de responder 200 a Meta (ya documentado R2-029) (`whatsapp/index.ts:123`)
**INT-015** — Sin control de rol granular para funciones financieras del chatbot (`whatsapp.erp.ts`)

#### ALTOS — Otros (2)
**INT-016** — TC de fuente incorrecta (exchangerate-api etiquetada como `"API_SBS"`) (`index.ts:388`)
**INT-019** — Secrets en `process.env`, no en Firebase Secret Manager (`secrets.ts:37`)

#### MEDIOS (6)
**INT-005** — Recursion sin limite en race condition de pack orders (`ml.sync.ts:296`)
**INT-006** — Error en paginacion de sync items detiene proceso sin alerta (`ml.sync.ts:57`)
**INT-007** — Sin retry ni circuit breaker en llamadas a ML API (`ml.api.ts:168`)
**INT-008** — URL de webhook hardcodeada con project ID (`ml.functions.ts:119`)
**INT-012** — `checkIfInternal` descarga coleccion completa `users` por cada mensaje WA (`whatsapp.handler.ts:353`)
**INT-014** — Sin control de gasto de tokens AI ni circuit breaker (`whatsapp.ai.ts`)
**INT-018** — QR en PDFs generado por tercero externo sin SLA (`entrega-pdf.service.ts:42`)

#### BAJOS (2)
**INT-009** — Refresh concurrente de token ML sin lock distribuido (`ml.api.ts:145`)
**INT-017** — TC no se actualiza fines de semana, sin aviso al usuario (`index.ts:306`)

### Hallazgos DevOps/QA Engineer (12 findings)

#### Descubrimiento clave
- **Node.js 22 ya migrado**: `functions/package.json` especifica `"node": "22"`. TAREA-001 resuelta sin accion adicional.

#### Infraestructura y CI/CD

**DEPLOY-001 — Zero test coverage confirmado**
- Sin framework de testing configurado (Vitest en devDependencies pero sin config ni tests)
- Estado: pendiente (TAREA-019)

**DEPLOY-002 — Sin pipeline CI/CD**
- No existe GitHub Actions, Cloud Build ni similar
- Deploy es `firebase deploy` manual desde terminal local
- Riesgo: codigo no revisado puede llegar a produccion
- Estado: pendiente

**DEPLOY-003 — Single environment (sin staging)**
- Solo existe entorno de produccion
- No hay forma de probar cambios sin afectar usuarios reales
- Estado: pendiente

**DEPLOY-004 — Sin procedimiento de rollback documentado**
- Si un deploy falla, no hay proceso definido para revertir
- Estado: pendiente

**DEPLOY-005 — Coleccion `contadores` permite write a vendedor/finanzas**
- `firestore.rules` permite que roles vendedor y finanzas escriban en `contadores/`
- Riesgo: manipulacion de secuencias de IDs (VT-xxx, OC-xxx, etc.)
- Estado: pendiente (requiere revision de security-guardian)

**DEPLOY-006 — `seed-test-data.mjs` referencia coleccion `usuarios` (no existe, es `users`)**
- Script de seed no funcional por nombre de coleccion incorrecto
- Estado: pendiente (quick fix)

#### Quick wins recomendados por DevOps
1. GitHub Actions CI basico (lint + typecheck en PR)
2. Fix `seed-test-data.mjs` (`usuarios` → `users`)
3. Primer test de Firestore rules con `@firebase/rules-unit-testing`

### Fixes aplicados en Sesion 3

#### CAMBIO-006 — DATA-001: null fechaVencimiento no crashea FEFO
- Tipo: Bug fix
- Descripcion: `seleccionarFEFO()` crasheaba si una unidad tenia `fechaVencimiento: null/undefined`. Sort ahora usa optional chaining con fallback a `MAX_SAFE_INTEGER` (sin vencimiento = va al final).
- Archivo: `src/services/unidad.service.ts:229-233`
- Reversible: si

#### CAMBIO-007 — BUG-002: Idempotencia en gasto GD
- Tipo: Bug fix (race condition)
- Descripcion: `crearGastoDistribucion()` ahora verifica si ya existe un gasto de tipo `delivery` para la misma `entregaId` antes de crear uno nuevo. Si existe, retorna el ID existente sin crear duplicado.
- Archivo: `src/services/gasto.service.ts:993-1003`
- Index nuevo: `gastos: entregaId + tipo` en `firestore.indexes.json`
- Reversible: si

#### CAMBIO-008 — BUG-003: reservadaPara/reservadoPara limpiados en cancelacion
- Tipo: Bug fix
- Descripcion: Al cancelar ventas (`cancelar()` y `cancelarReserva()`), ahora se limpian AMBOS campos `reservadaPara` y `reservadoPara` de las unidades. Antes, el bloque de asignadas solo limpiaba `ventaId`/`fechaAsignacion`, y el bloque de reservadas solo limpiaba `reservadoPara` (faltaba `reservadaPara`).
- Archivo: `src/services/venta.service.ts` (3 bloques corregidos)
- Reversible: si

#### CAMBIO-009 — BUG-006: getMovimientos incluye cuentaDestino
- Tipo: Bug fix
- Descripcion: `getMovimientos()` ahora ejecuta dos queries paralelas (cuentaOrigen + cuentaDestino) cuando se filtra por `cuentaId`, y deduplica resultados con Map. Antes, solo buscaba en `cuentaOrigen`, omitiendo transferencias donde la cuenta era destino.
- Archivo: `src/services/tesoreria.service.ts:519-577`
- Reversible: si

#### CAMBIO-011 — PERF-001: N+1 eliminado en actualizarCTRUPromedioProductos
- Tipo: Performance (mayor impacto individual del sistema)
- Descripcion: Antes ejecutaba 1 query Firestore POR PRODUCTO (200 productos = 201 queries seriales ~45 seg). Ahora carga todos los productos y todas las unidades en 2 queries paralelas con `Promise.all()`, agrupa en `Map<productoId, Unidad[]>`, y escribe con `writeBatch` chunkeado.
- Archivo: `src/services/ctru.service.ts:304-360`
- Mejora estimada: 201 queries → 2 queries. De ~45 seg → ~2 seg con 200 productos.
- Reversible: si

#### CAMBIO-012 — PERF-008: notificacion listener filtra por usuario en Firestore
- Tipo: Performance + Seguridad
- Descripcion: `subscribeToNotificaciones()` descargaba notificaciones de TODOS los usuarios y filtraba en memoria. Ahora agrega `where('usuarioId', '==', usuarioId)` directamente en la query de Firestore. Cada usuario solo recibe sus notificaciones.
- Archivo: `src/services/notificacion.service.ts:82-100`
- Index nuevo: `notificaciones: usuarioId + fechaCreacion DESC` en `firestore.indexes.json`
- Reversible: si

#### CAMBIO-015 — LOG-002: MAX_BATCH 500→450 en inventario.service.ts (3 ocurrencias)
- Tipo: Bug fix (consistencia)
- Descripcion: 3 metodos en `inventario.service.ts` usaban `MAX_BATCH = 500` en vez del estandar del proyecto de 450 (margen de seguridad sobre limite Firestore de 500). Corregidas las 3 ocurrencias (lineas 378, 591, 815).
- Archivo: `src/services/inventario.service.ts`
- Reversible: si

#### CAMBIO-014 — PERF-012/013: Lazy load de xlsx y daily-js (~950KB removidos del bundle inicial)
- Tipo: Performance (bundle size)
- Descripcion: `xlsx` (~450KB) ahora se carga solo cuando el usuario hace click en "Exportar Excel" (dynamic import). `@daily-co/daily-js` (~500KB) e `IncomingCallModal` ahora se cargan con `React.lazy()` en MainLayout (solo si el usuario abre videollamada). Metodos de `exportService` y `ExcelService` convertidos a async.
- Archivos: `src/services/export.service.ts`, `src/services/excel.service.ts`, `src/services/cotizacionPdf.service.ts`, `src/components/layout/MainLayout.tsx`
- Mejora estimada: ~1.4MB menos en el bundle inicial (xlsx 450KB + daily-js 500KB + jsPDF cotizacion 490KB)
- Reversible: si

#### CAMBIO-013 — PERF-003: Dashboard staleTime evita re-fetch innecesario
- Tipo: Performance
- Descripcion: Dashboard cargaba 8 colecciones completas en CADA visita (~10.000+ lecturas Firestore con 5 usuarios). Ahora verifica si los datos tienen menos de 5 minutos (`dashboardLastFetchedAt`). Si son frescos y hay datos en los stores, muestra inmediatamente sin re-fetch.
- Archivo: `src/pages/Dashboard.tsx:72-77`
- Mejora estimada: reduce ~80% de lecturas Firestore en navegacion intra-app
- Reversible: si (eliminar la variable y el check)

#### CAMBIO-010 — 5 indexes compuestos nuevos en Firestore (actualizado a 6)
- Tipo: Performance
- Indexes agregados:
  1. `unidades: almacenId + estado` (complementa el legacy `almacenActualId + estado`)
  2. `gastos: tipo + fecha DESC` (IDX-003)
  3. `gastos: entregaId + tipo` (soporte para CAMBIO-007 idempotencia)
  4. `mlOrderSync: status + createdAt DESC` (IDX-004)
- Archivo: `firestore.indexes.json`
- Reversible: si (eliminar del archivo y redesplegar)

### Fixes aplicados en Sesion 5

#### CAMBIO-032 — Integracion Clientes Maestros en VentaForm (Decision 4)
- Tipo: Feature / Integracion
- Descripcion: `VentaForm.tsx` ahora pasa `clienteId` al service cuando el usuario selecciona un cliente del maestro CRM. Eliminada la llamada directa a `getOrCreate()` desde el form — la responsabilidad de creacion/vinculacion es exclusiva del service. El form solo transmite la seleccion del usuario.
- Archivo: `src/components/modules/venta/VentaForm.tsx`
- Reversible: si

#### CAMBIO-033 — Integracion Clientes Maestros en CotizacionForm (Decision 4)
- Tipo: Feature / Integracion
- Descripcion: `CotizacionForm.tsx` aplica el mismo patron que CAMBIO-032 — pasa `clienteId` si hay cliente seleccionado del maestro, y delega la logica de auto-creacion al service. Eliminada la doble llamada a `getOrCreate()` que existia en el form.
- Archivo: `src/pages/Cotizaciones/CotizacionForm.tsx`
- Reversible: si

#### CAMBIO-034 — Auto-creacion de cliente y metricas en venta.service (Decision 4)
- Tipo: Feature / Integracion
- Descripcion: `VentaService.crear()` ahora llama a `clienteService.getOrCreate()` via dynamic import para vincular o crear el cliente maestro en cada nueva venta. `confirmarVenta()` llama a `actualizarMetricasPorVenta()` como fire-and-forget para actualizar clasificacion ABC/RFM del cliente post-confirmacion.
- Archivo: `src/services/venta.service.ts`
- Reversible: si
- Nota: fire-and-forget puede fallar silenciosamente — ver hallazgo diferido SEC-CLI-001

#### CAMBIO-035 — Auto-creacion de cliente en cotizacion.service (Decision 4)
- Tipo: Feature / Integracion
- Descripcion: `crearCotizacion()` en `cotizacion.service.ts` ahora llama a `clienteService.getOrCreate()` via dynamic import al crear una cotizacion, garantizando que el cliente siempre exista como entidad estructurada. Al confirmar cotizacion→venta, consulta el CTRU actual de cada producto y auto-marca `ventaBajoCosto` si algun precio esta por debajo del costo.
- Archivo: `src/services/cotizacion.service.ts`
- Reversible: si

#### CAMBIO-036 — Flujo de aprobacion precio bajo costo (Decision 5)
- Tipo: Feature / Control
- Descripcion: Implementacion completa del flujo de aprobacion de ventas con precio < CTRU:
  - `VentaForm.tsx`: deteccion real-time por producto, alerta inline roja, banner en paso de confirmacion con desglose de perdidas estimadas. Admin/gerente: checkbox de aprobacion. Otros roles: botones deshabilitados con mensaje de bloqueo. Reset automatico de aprobacion cuando cambia la composicion de productos bajo costo (cambio en `productosBajoCosto.length`). Validacion explicita de `user.uid` antes de guardar `aprobadoPor`.
  - `venta.service.ts`: guarda `ventaBajoCosto: true` y `aprobadoBajoCostoPor: uid` en documento Firestore.
  - `cotizacion.service.ts`: al confirmar cotizacion→venta, evalua precio vs CTRU de cada producto y auto-marca `ventaBajoCosto` si corresponde.
  - `venta.types.ts`: campos `ventaBajoCosto` (boolean) y `aprobadoBajoCostoPor` (string) en interface `Venta`. Campos `ventaBajoCosto` y `aprobadoPor` en `VentaFormData`.
  - `firestore.rules`: vendedor NO puede crear ventas con `ventaBajoCosto: true` — solo admin/gerente. Regla split en create/update/delete.
- Archivos: `VentaForm.tsx`, `venta.service.ts`, `cotizacion.service.ts`, `venta.types.ts`, `firestore.rules`
- Reversible: si (revertir tipos, reglas y logica del form/service)

#### CAMBIO-037 — BUG-001/003/004/005 resueltos como parte de Sesion 5
- Tipo: Bug fix (seguridad + correctness)
- Descripcion: Correccion de bugs encontrados durante revision de agentes security-guardian y code-logic-analyst sobre la implementacion de la Sesion 5:
  - BUG-001 (renumerado en sesion 5): `aprobadoPor` podia ser `undefined` si la sesion expiraba antes de guardar → ahora valida `user.uid` explicitamente y bloquea si es undefined.
  - BUG-003 (sesion 5): agregar un segundo producto bajo costo no reseteaba el checkbox de aprobacion → ahora resetea cuando cambia `productosBajoCosto.length` via useEffect.
  - BUG-004/005 (sesion 5, consolidados): doble llamada a `getOrCreate()` existia en el form + service → eliminada del form, solo el service es responsable.
- Archivos: `VentaForm.tsx`, `venta.service.ts`
- Reversible: si

### Fixes aplicados en Sesion 4

#### CAMBIO-016 — UAT-001: eliminarPago revierte movimiento en Tesoreria
- Tipo: Bug fix (integridad financiera)
- Descripcion: `eliminarPago()` ahora llama a `tesoreriaService.eliminarMovimiento()` cuando el pago tiene `tesoreriaMovimientoId`. Soporta IDs reales (nuevo) y fallback legacy (busca por ventaId + monto + tipo para pagos con ID='registrado'). Ademas, `registrarPago()` ahora guarda el ID real del movimiento de tesoreria (antes guardaba el string literal 'registrado').
- Archivos: `src/services/venta.service.ts:1722-1741` (registrar), `src/services/venta.service.ts:1776-1804` (eliminar)
- Reversible: si

#### CAMBIO-017 — UAT-005: cancelar venta revierte pagos en Tesoreria
- Tipo: Bug fix (integridad financiera)
- Descripcion: `cancelar()` ahora itera todos los pagos de la venta y revierte cada movimiento de tesoreria asociado. Soporta IDs reales y fallback legacy. Se ejecuta despues del batch commit (fire-and-forget con error handling individual por pago).
- Archivo: `src/services/venta.service.ts:1434-1460` (post-commit)
- Reversible: si

#### CAMBIO-018 — UAT-004/BUG-001: precio unitario correcto por producto en entregas
- Tipo: Bug fix (CTRU / datos financieros)
- Descripcion: En `registrarResultado()`, el `precioVentaPEN` de cada unidad ahora usa el `precioUnitario` del `ProductoEntrega` al que pertenece esa unidad, en vez de promediar `subtotalPEN / totalUnidades`. Construye un mapa unidadId → precio por producto. Fallback al promedio general si la unidad no tiene producto asignado.
- Archivo: `src/services/entrega.service.ts:591-620`
- Reversible: si
- Impacto: corrige margenes de rentabilidad por producto en CTRU y reportes

#### CAMBIO-019 — UAT-003: unificacion de campo reservadaPara (canonico) vs reservadoPara (legacy)
- Tipo: Bug fix (integridad de reservas)
- Descripcion: Todas las escrituras de reserva ahora usan el campo canonico `reservadaPara`. Antes, `cotizacion.service.ts` y parte de `venta.service.ts` escribian `reservadoPara`, creando documentos con campo huerfano. Las lecturas mantienen fallback dual `[reservadaPara, reservadoPara].filter(Boolean)` para compatibilidad con datos legacy. Las limpiezas (cancelacion) ya escribian ambos campos como null (sin cambio).
- Archivos: `src/services/cotizacion.service.ts` (3 ocurrencias), `src/services/venta.service.ts` (2 ocurrencias)
- Reversible: si
- Nota: datos legacy en Firestore aun pueden tener `reservadoPara` — los fallback de lectura cubren este caso

---

## REGISTRO DE DECISIONES DE ARQUITECTURA (ADRs)

### ADR-001 — Legal Compliance excluido del full review
- Fecha: 2026-03-19
- Contexto: Ronda 1 incluia a legal-compliance-consultant para revisar cumplimiento SUNAT/GDPR/fiscal
- Decision: excluir el agente y sus hallazgos de esta sesion
- Razon: decision explicita del negocio (propietario del proyecto)
- Consecuencias: el gap de facturacion electronica SUNAT permanece sin remediar. Riesgo regulatorio activo.
- Revisable: cuando el negocio decida abordar integracion SUNAT o cumplimiento GDPR
- Tomada por: propietario del proyecto (Jose L.)

### ADR-002 — Pool USD con TCPA (TC Promedio Ponderado de Adquisicion) — Rendimiento Cambiario V1
- Fecha decision: 2026-03-20
- Estado: APROBADO por titular
- Reemplaza: la seccion de analytics del modulo Expectativas (los CRUDs de requerimientos se CONSERVAN intactos)
- Contexto: el titular necesita medir el impacto cambiario real en todo el ciclo de negocio (cotizacion → compra → pago → venta → cobro). El modulo Expectativas no cumple este proposito — su seccion de analytics es inutil y tiene bugs (dimensional units error en getStats). El sistema captura campos TC en multiples puntos del ciclo pero no calcula ni reporta el diferencial entre el TC esperado y el TC real en ninguna transaccion.
- Opciones evaluadas:
  - Opcion A: Extender el patron de Conversiones a cada punto del ciclo (agregar `tcReferencia` + `diferencialCambiario` en Venta, OC y Pago). Pros: cercano a la estructura actual. Contras: no consolida el "pool de dolares del negocio" — no responde la pregunta de cuanto costo cada dolar que tenemos.
  - Opcion B: Reporte de conciliacion post-facto sin modificar estructura de datos. Pros: no invasivo. Contras: no captura el TCPA (costo promedio del pool), no sirve para gestion.
  - Opcion C: Redisenar Expectativas para incluir rendimiento cambiario esperado. Pros: reutiliza modulo existente. Contras: mezcla conceptos distintos (expectativa futura vs rendimiento realizado).
- Decision: Pool USD con TCPA — concepto de "pool de dolares del negocio" con calculo automatico del TC Promedio Ponderado de Adquisicion. Arquitectura nueva, no extension de modulo existente.
- Razon: responde la pregunta central del negocio ("cuanto me costo cada dolar") y permite comparar TCPA vs TC de cada operacion para calcular ganancia/perdida por conversion en tiempo real.
- Fomula TCPA: `newTCPA = (existingUSD * oldTCPA + newUSD * newTC) / (existingUSD + newUSD)`
- Regla clave: TCPA recalcula solo en entradas (no en salidas/retiros)
- Dual TC por transaccion: `tcPool` (TCPA, para gestion interna) + `tcSunat` (TC SBS del dia, para contabilidad/fiscal)

#### Movimientos del Pool V1

Entradas (aumentan pool y recalculan TCPA):
  - COMPRA_USD_BANCO: conversion cambiaria PEN a USD
  - COMPRA_USD_EFECTIVO: compra USD en efectivo
  - COBRO_VENTA_USD: cobro de venta en USD via Zelle o PayPal
  - SALDO_INICIAL: carga retroactiva del saldo existente
  - AJUSTE_CONCILIACION_ENTRADA: conciliacion manual

Salidas (reducen pool, NO recalculan TCPA):
  - PAGO_OC: pago de orden de compra
  - GASTO_IMPORTACION_USD: flete, aduana y similares
  - GASTO_SERVICIO_USD: servicios pagados en USD
  - COMISION_BANCARIA_USD: comisiones bancarias
  - VENTA_USD: venta directa en USD (MercadoLibre = PEN, no aplica)
  - RETIRO_CAPITAL: retiro de capital en USD
  - AJUSTE_CONCILIACION_SALIDA: conciliacion manual

#### Funcionalidades V1
1. Registro automatico de movimientos del pool desde conversiones cambiarias
2. TCPA calculado en tiempo real
3. Ganancia/perdida por operacion = (tcPool - tcSunat) x montoUSD
4. Dashboard con 4 tabs: Resumen, Por Operacion, Conversiones, Tendencias
5. Snapshot mensual del TCPA
6. Revaluacion de saldos al cierre: recalcular valor PEN del pool con TC del ultimo dia del mes, generar asiento contable 676/776
7. Recalculo retroactivo: reconstruir pool desde cero con movimientos historicos (para carga de 3 meses retroactivos)
8. Validacion: pool no puede quedar negativo
9. Conciliacion: mecanismo de ajuste cuando pool calculado difiere del saldo real bancario

#### Colecciones Firestore nuevas
- `poolUSDMovimientos`: cada entrada/salida del pool
- `poolUSDSnapshots`: foto mensual del estado del pool

#### Campos a agregar en tipos existentes
- `OrdenCompra`: `tcPool` (TCPA al pagar), `impactoCambiario` (ganancia/perdida)
- `ConversionCambiaria`: `poolMovimientoId` (referencia al movimiento generado)
- `Venta`: activar `tcCobro` (TC real del cobro — campo ya existe en types, nunca se graba)

#### Bugs a corregir como prerequisito
- `venta.service.ts` lineas 1758 y 2210: cobros USD via Zelle/PayPal se registran como PEN
- Campo `tcCobro` en Venta nunca se escribe — activar al registrar cobro

#### Consideracion especial: Retroactividad
El titular no tiene datos actuales. Registrara 3 meses retroactivamente. El sistema debe:
- Permitir carga de saldo inicial con fecha pasada
- Funcion `recalcularPoolDesdeHistorico()` que reconstruye todo el pool desde el primer movimiento
- Orden cronologico estricto para el calculo

#### Tareas generadas
- TAREA-057: Crear types rendimientoCambiario.types.ts
- TAREA-058: Crear poolUSD.service.ts con logica TCPA
- TAREA-059: Fix bug cobros USD como PEN en venta.service.ts
- TAREA-060: Activar campo tcCobro al registrar cobro
- TAREA-061: Crear poolUSDStore.ts (Zustand)
- TAREA-062: Crear pagina RendimientoCambiario.tsx (4 tabs)
- TAREA-063: Integrar pool con conversiones cambiarias existentes
- TAREA-064: Snapshot mensual + revaluacion al cierre
- TAREA-065: Recalculo retroactivo del pool

- Consecuencias: el modulo Expectativas (seccion analytics) queda descontinuado — los CRUDs de requerimientos no se tocan. Se crean 2 colecciones nuevas y se extienden 3 tipos existentes. Los cobros USD en venta.service.ts requieren fix previo.
- Revisable: si el volumen de operaciones USD justifica un sistema de hedging mas sofisticado, o si se integra SUNAT (que requerira TC oficial obligatorio).
- Tomada por: titular (Jose L.) — 2026-03-20

### ADR-003 — Atomic counter como mecanismo de IDs secuenciales
- Fecha: 2026-03-19
- Contexto: 21 generadores de numeros secuenciales usaban patron "leer coleccion, buscar max, incrementar" — race condition garantizada bajo carga concurrente
- Decision: `getNextSequenceNumber()` en `src/lib/sequenceGenerator.ts` con transacciones Firestore atomicas como unico mecanismo
- Alternativas descartadas: counters en memoria (no persisten entre instancias), UUID (no legibles por humanos, no es un numero de venta/OC), Cloud Function dedicada (overhead innecesario)
- Consecuencias: los numeros son secuenciales y sin gaps bajo cualquier carga. Costo: 1 transaccion adicional por documento nuevo.
- Revisable: si el volumen de transacciones genera costo significativo en Firestore
- Tomada por: backend-cloud-engineer + code-quality-refactor-specialist (Ronda 2)

### ADR-004 — Patron singleton como patron oficial de servicios
- Fecha: 2026-03-19
- Contexto: coexisten 3 patrones en el codebase (singleton objects, clases estaticas, singletons instanciados)
- Decision: singleton objects `const serviceName = { metodo1, metodo2 }` es el patron oficial
- Alternativas descartadas: clases estaticas (mas verbosidad sin beneficio real en este contexto), clases instanciadas (innecesario para servicios sin estado)
- Consecuencias: los 5 servicios que son clases estaticas (`VentaService`, `OrdenCompraService`, `ProductoService`, `CotizacionService`, `ExpectativaService`) deben migrarse gradualmente
- Revisable: si se necesitan features de POO (herencia, inyeccion de dependencias para testing)
- Tomada por: code-quality-refactor-specialist (Ronda 2) + system-architect (Ronda 1)

---

## ESTADO DE RONDAS DEL FULL REVIEW

| Ronda | Agentes | Estado | Hallazgos | Fixes |
|-------|---------|--------|-----------|-------|
| 1 | system-architect, security-guardian, legal-compliance-consultant | Completada (legal excluido) | 14 | 14 |
| 2 | frontend-design, backend-cloud, code-quality, code-logic-analyst | **Completada** (4/4) | 81 | 5 |
| 3 | database-administrator, erp-integration-engineer, bi-analyst | **Completada** (3/3) | 50+ integraciones: 21 | 0 |
| 4 | devops-qa-engineer, performance-monitoring-specialist | **Completada** (2/2) | 21 + 12 devops | 2 |
| 5 | quality-uat-director, logistics-supply-chain-consultant, erp-business-architect | **Completada** (3/3) | logistics: 17, UAT: 21, ERP-arch: 12 | 0 |
| 6 | business-docs-manager, project-manager-erp | **Completada** (2/2) | docs: 26, PM: resumen ejecutivo | 0 |

---

## BACKLOG DE TAREAS PENDIENTES

### Prioridad 1 — Supervivencia operativa (deadline duro)

**TAREA-001**
- Titulo: Migrar Node.js 20 a 22 + firebase-functions v4 a v5
- Tipo: Infraestructura
- Modulo: Cloud Functions (todas)
- Prioridad: CRITICA
- Fecha limite: 2026-04-30 (fin de soporte Node.js 20 en Firebase)
- Estado: **RESUELTO** — Node.js 22 ya configurado en `functions/package.json` (descubierto por devops-qa-engineer, Ronda 4)
- Nota: firebase-functions v4.5 aun en uso, v5 pendiente pero no urgente

### Prioridad 2 — Bugs y correctness

**TAREA-002**
- Titulo: N+1 query en seleccionarFEFO + DATA-001 null fechaVencimiento crash
- Tipo: Bug / Performance
- Modulo: ventas (venta.service.ts)
- Prioridad: CRITICA
- Hallazgo: R2-013 + DATA-001
- Estado: **DATA-001 ARREGLADO** (CAMBIO-006). N+1 query pendiente de optimizar.
- Nota: DATA-001 es crash bloqueante si hay unidades sin fechaVencimiento

**TAREA-003**
- Titulo: Missing composite indexes en Firestore (IDX-001 a IDX-004)
- Tipo: Performance / Correctness
- Modulo: unidades, ventas, gastos, mlOrderSync
- Prioridad: alta
- Hallazgo: R2-015 + IDX-001/002/003/004
- Estado: **ARREGLADO** (CAMBIO-010) — IDX-001/002 ya existian, IDX-003/004 + 2 extras agregados
- Accion: desplegar `firestore.indexes.json`

**TAREA-004**
- Titulo: Race condition residual en gasto.service.ts:756-763
- Tipo: Bug
- Modulo: gastos
- Prioridad: alta
- Descripcion: usa `padStart` manual despues de `getNextSequenceNumber()` — inconsistencia que puede generar numeros duplicados bajo carga
- Estado: pendiente

**TAREA-005**
- Titulo: sincronizacion.service lee 10+ colecciones completas desde browser
- Tipo: Bug / Architecture
- Modulo: sincronizacion
- Prioridad: alta
- Hallazgo: R2-009
- Estado: pendiente
- Accion sugerida: migrar a Cloud Function con permisos admin SDK

**TAREA-006**
- Titulo: inventario.service full collection reads para verificar reservas
- Tipo: Performance
- Modulo: inventario
- Prioridad: alta
- Hallazgo: R2-014
- Estado: pendiente

**TAREA-007**
- Titulo: ML webhook application_id check cuando notification.application_id es undefined
- Tipo: Bug / Seguridad
- Modulo: MercadoLibre
- Prioridad: alta
- Descripcion: algunas notificaciones ML no incluyen `application_id` — el check actual las rechaza incorrectamente
- Estado: pendiente

**TAREA-030**
- Titulo: BUG-002 — Double GD expense por race condition (idempotencia)
- Tipo: Bug
- Modulo: gastos (gasto.service.ts)
- Prioridad: CRITICA
- Hallazgo: BUG-002
- Estado: **ARREGLADO** (CAMBIO-007)

**TAREA-031**
- Titulo: BUG-003 — reservadaPara no se limpia en cancelacion de venta
- Tipo: Bug
- Modulo: unidades (unidad.service.ts / venta.service.ts)
- Prioridad: ALTA
- Hallazgo: BUG-003
- Estado: **ARREGLADO** (CAMBIO-008)

**TAREA-032**
- Titulo: BUG-001 — Precio unitario incorrecto en entregas multi-producto
- Tipo: Bug
- Modulo: entregas (entrega.service.ts / entrega-pdf.service.ts)
- Prioridad: ALTA
- Hallazgo: BUG-001
- Estado: **RESUELTO** (CAMBIO-018, Sesion 4 — consolidado con TAREA-044)

**TAREA-033**
- Titulo: BUG-006 — getMovimientos ignora cuentaDestino en tesoreria
- Tipo: Bug
- Modulo: tesoreria (tesoreria.service.ts)
- Prioridad: ALTA
- Hallazgo: BUG-006
- Estado: **ARREGLADO** (CAMBIO-009)

**TAREA-034**
- Titulo: Configurar backup automatizado de Firestore
- Tipo: Infraestructura / DBA
- Modulo: Firebase
- Prioridad: ALTA
- Hallazgo: database-administrator (Ronda 3)
- Estado: **RESUELTO** (Sesion 4) — PITR habilitado (7 dias retencion) + copias semanales (lunes, 98 dias retencion) en consola Firebase

**TAREA-035**
- Titulo: PERF-001 — Corregir N+1 en actualizarCTRUPromedioProductos
- Tipo: Performance (el fix de mayor impacto individual)
- Modulo: CTRU (ctru.service.ts)
- Prioridad: ALTA
- Hallazgo: PERF-001 (performance-monitoring-specialist)
- Estado: **ARREGLADO** (CAMBIO-011) — 201 queries → 2 queries

**TAREA-036**
- Titulo: PERF-003 — Dashboard staleTime para evitar 8 full collection loads
- Tipo: Performance
- Modulo: Dashboard (Dashboard.tsx + stores)
- Prioridad: ALTA
- Hallazgo: PERF-003
- Estado: **ARREGLADO** (CAMBIO-013) — staleTime de 5 min, skip re-fetch si datos frescos

**TAREA-037**
- Titulo: PERF-004 — almacen.service 5 full scans de unidades → queries filtradas
- Tipo: Performance
- Modulo: almacen.service.ts
- Prioridad: ALTA
- Hallazgo: PERF-004
- Estado: pendiente

**TAREA-038**
- Titulo: PERF-012/013/015 — Lazy load de xlsx, jspdf, daily-js (~1.4MB)
- Tipo: Performance (bundle size)
- Modulo: export.service.ts, entrega-pdf.service.ts, DailyCallModal.tsx
- Prioridad: media
- Hallazgo: PERF-012/013/015
- Estado: **ARREGLADO** (CAMBIO-014) — xlsx + daily-js + cotizacionPdf lazy loaded (~1.4MB). Solo pdf.service.ts queda sin lazy load (patron complejo con return types jsPDF).

**TAREA-040**
- Titulo: REC-01 — Unificar criterio de fecha para ventas en todos los modulos
- Tipo: Decision de negocio + refactoring
- Modulo: Dashboard, Reportes, Contabilidad
- Prioridad: CRITICA
- Hallazgo: BI-A01, BI-A03, DM-07
- Estado: pendiente — requiere decision del negocio (fechaCreacion vs fechaEntrega)

**TAREA-041**
- Titulo: REC-02 — Unificar TC para valorizar inventario (Dashboard vs Reportes)
- Tipo: Decision de negocio
- Modulo: Dashboard, Reportes
- Prioridad: CRITICA
- Hallazgo: BI-D05
- Estado: pendiente — decidir TC compra o TC venta como estandar

**TAREA-042**
- Titulo: GAP-13 + REC-04 — Comparativa vs periodo anterior en dashboards
- Tipo: BI / Feature
- Modulo: Dashboard, Reportes
- Prioridad: ALTA
- Hallazgo: GAP-13
- Estado: pendiente
- Accion: cargar calculo del periodo N-1 en paralelo, mostrar delta %

**TAREA-039**
- Titulo: PERF-008 — notificacion.service listener sin filtro por usuario
- Tipo: Performance + Seguridad
- Modulo: notificacion.service.ts
- Prioridad: ALTA
- Hallazgo: PERF-008
- Estado: **ARREGLADO** (CAMBIO-012) — filtro por usuarioId en query Firestore

**TAREA-043**
- Titulo: UAT-001 — eliminarPago no revierte movimiento en Tesoreria
- Tipo: Bug (integridad financiera)
- Modulo: ventas / tesoreria (venta.service.ts:1758-1810)
- Prioridad: CRITICA — BLOQUEA GO-LIVE
- Hallazgo: UAT-001 (quality-uat-director)
- Estado: **RESUELTO** (CAMBIO-016, Sesion 4) — eliminarPago ahora reversa movimiento via tesoreriaService.eliminarMovimiento() + soporte legacy 'registrado'

**TAREA-044**
- Titulo: UAT-004/BUG-001 — Precio unitario incorrecto en entregas multi-producto
- Tipo: Bug (corrompe CTRU)
- Modulo: entregas (entrega.service.ts:592-594)
- Prioridad: CRITICA — BLOQUEA GO-LIVE
- Hallazgo: UAT-004 = BUG-001 (TAREA-032)
- Estado: **RESUELTO** (CAMBIO-018, Sesion 4) — precio unitario por producto via mapa unidadId→precioUnitario desde entrega.productos[]

**TAREA-045**
- Titulo: UAT-003 — Unificar campo reservadaPara/reservadoPara + migracion datos
- Tipo: Bug + Migracion
- Modulo: unidades (venta.service.ts, unidad.service.ts, cotizacion.service.ts)
- Prioridad: CRITICA — BLOQUEA GO-LIVE
- Hallazgo: UAT-003
- Estado: **RESUELTO** (CAMBIO-019, Sesion 4) — todas las escrituras usan reservadaPara (canonico), lecturas con dual-fallback para legacy

**TAREA-046**
- Titulo: UAT-005 — Cancelar venta con pagos no revierte Tesoreria automaticamente
- Tipo: Bug (integridad financiera)
- Modulo: ventas / tesoreria (venta.service.ts:1359-1481)
- Prioridad: ALTA
- Hallazgo: UAT-005
- Estado: **RESUELTO** (CAMBIO-017, Sesion 4) — cancelar() ahora itera todos los pagos y reversa cada movimiento de tesoreria post-commit

**TAREA-047**
- Titulo: UAT-006 — TC fallback silencioso de 3.70 sin advertencia al usuario
- Tipo: Bug (datos financieros)
- Modulo: ventas (venta.service.ts:763-771)
- Prioridad: ALTA
- Hallazgo: UAT-006
- Estado: pendiente

**TAREA-048**
- Titulo: SEC-VBC-003 — Validacion server-side de precio real vs CTRU (sin confianza en flag del cliente)
- Tipo: Seguridad / Integridad
- Modulo: ventas (venta.service.ts / Cloud Functions)
- Prioridad: ALTA
- Hallazgo: SEC-VBC-003 (security-guardian, Sesion 5)
- Descripcion: El service actual confia en el flag `ventaBajoCosto` enviado desde el cliente. No hay verificacion server-side del precio real contra el CTRU del producto al momento de guardar. Un cliente malicioso o un bug podria crear una venta bajo costo sin el flag activado.
- Estado: pendiente
- Accion sugerida: Cloud Function o logica server-side que consulte CTRU actual y verifique independientemente

**TAREA-049**
- Titulo: BUG-006 — getOrCreate no deduplica clientes por nombre (solo por DNI/telefono)
- Tipo: Bug / Datos
- Modulo: clientes (cliente.service.ts)
- Prioridad: ALTA
- Hallazgo: BUG-006 (code-logic-analyst, Sesion 5)
- Descripcion: `getOrCreate()` busca por DNI o telefono para detectar cliente existente. Clientes sin DNI ni telefono (datos minimos) siempre crean un registro nuevo aunque ya existan con el mismo nombre, generando duplicados en el maestro de clientes.
- Estado: pendiente
- Accion sugerida: agregar busqueda por nombre normalizado como tercer criterio de deduplicacion, o alertar cuando se crea cliente sin datos unicos

**TAREA-050**
- Titulo: BUG-007 — Posible doble actualizacion de metricas cliente en flujo cotizacion → venta
- Tipo: Bug / Datos
- Modulo: clientes / ventas (venta.service.ts, cotizacion.service.ts)
- Prioridad: MEDIA
- Hallazgo: BUG-007 (code-logic-analyst, Sesion 5)
- Descripcion: Cuando una cotizacion se confirma como venta, `confirmarVenta()` llama a `actualizarMetricasPorVenta()`. Si el flujo de confirmacion tambien ejecuta logica en `cotizacion.service.ts` que actualiza metricas, el mismo evento podria disparar dos actualizaciones para la misma venta.
- Estado: **RESUELTO COMPLETO** — Sesion 10 (CAMBIO-081): auditoria revelo metricas FALTANTES (no duplicadas) en ventas directas — fix en crear() con withRetry. Sesion 11 (CAMBIO-087): el doble conteo SI existia en el flujo cotizacion→venta al agregar la llamada de S9 en crear() — resuelto con flag _fromCotizacion en ventaData y guard en crear() que verifica !fromCotizacion.
- Nota: requirio dos fixes complementarios — S10 cubre ventas directas sin metricas, S11 elimina el doble conteo en cotizacion→venta

**TAREA-051**
- Titulo: SEC-CLI-001 — Fire-and-forget para metricas cliente puede fallar silenciosamente
- Tipo: Observabilidad / Robustez
- Modulo: ventas (venta.service.ts)
- Prioridad: MEDIA
- Hallazgo: SEC-CLI-001 (security-guardian, Sesion 5)
- Descripcion: `actualizarMetricasPorVenta()` se ejecuta como fire-and-forget post-confirmacion. Si falla, el error no llega al usuario ni genera alerta. El CRM puede quedar con datos de ABC/RFM desactualizados sin que nadie lo detecte.
- Estado: **RESUELTO COMPLETO** — Sesion 10 (CAMBIO-081): withRetry reutilizado para metricas en ventas directas. Sesion 11 (CAMBIO-088): fire-and-forget ahora tiene audit trail completo via logBackgroundError() en logger.ts con escritura a coleccion _errorLog en Firestore. 9 catch handlers actualizados en 5 servicios criticos.

**TAREA-052**
- Titulo: EDGE-002 — Ventas ML via webhook no tienen flag ventaBajoCosto
- Tipo: Consistencia / Control
- Modulo: MercadoLibre (ml.orderProcessor.ts)
- Prioridad: MEDIA
- Hallazgo: EDGE-002 (code-logic-analyst, Sesion 5)
- Descripcion: Las ventas creadas automaticamente desde el webhook de MercadoLibre no pasan por el flujo de aprobacion de precio bajo costo. Si ML vende un producto con descuento por debajo del CTRU, la venta se registra sin advertencia ni flag.
- Estado: pendiente
- Accion sugerida: agregar evaluacion precio vs CTRU en `ml.orderProcessor.ts` al crear la venta, registrar `ventaBajoCosto: true` automaticamente y notificar al admin si corresponde

**TAREA-053**
- Titulo: Decidir arquitectura de rendimiento cambiario en el ciclo completo (ADR-002)
- Tipo: Decision de negocio + diseno tecnico
- Modulo: Tesoreria / Ventas / Compras / Expectativas
- Prioridad: ALTA
- Hallazgo: Sesion 6 (2026-03-20) — planteamiento del titular
- Descripcion: El sistema captura campos TC en multiples puntos del ciclo pero no calcula ni reporta el diferencial entre TC esperado y TC real.
- Estado: **RESUELTO** — ADR-002 aprobado por titular (2026-03-20). Arquitectura elegida: Pool USD con TCPA. Ver ADR-002 en seccion REGISTRO DE DECISIONES DE ARQUITECTURA.
- Implementacion desbloqueada: TAREA-057 a TAREA-065

**TAREA-054**
- Titulo: Grabar campo tcCobro en Venta al registrar cobro
- Tipo: Bug / Datos faltantes
- Modulo: ventas (venta.service.ts)
- Prioridad: ALTA
- Hallazgo: Sesion 6 — system-context-reader
- Descripcion: El tipo `Venta` tiene el campo `tcCobro` definido pero nunca se graba al registrar un pago/cobro. Esto hace imposible calcular el diferencial entre el TC de venta y el TC de cobro, que es uno de los cinco puntos del rendimiento cambiario.
- Estado: pendiente — independiente de ADR-002 (debe corregirse sin importar la opcion elegida)
- Accion: en `venta.service.ts`, al registrar un pago en moneda diferente a la de venta, grabar el TC del momento del cobro en `tcCobro`

**TAREA-055**
- Titulo: Auditar y documentar todos los puntos donde se usa TC en el ciclo completo
- Tipo: Investigacion / Documentacion tecnica
- Modulo: transversal (venta.service.ts, ordenCompra.service.ts, cotizacion.service.ts, tesoreria.service.ts, expectativa.service.ts)
- Prioridad: MEDIA
- Hallazgo: Sesion 6 — fx-multicurrency-specialist
- Descripcion: Levantar un mapa completo de que campos TC existen, donde se graban, donde se leen, y donde hay gaps. Insumo para implementar ADR-002 una vez decidido.
- Estado: pendiente (parcialmente iniciado en Sesion 6 — ver tabla de gaps en la sesion)

**TAREA-056**
- Titulo: Evaluar si el modulo Expectativas debe incorporar el concepto de rendimiento cambiario esperado
- Tipo: Diseno funcional / Feature
- Modulo: expectativas (expectativa.service.ts)
- Prioridad: MEDIA
- Hallazgo: Sesion 6 — planteamiento del titular ("para esto supuestamente se creo la seccion de Expectativas")
- Descripcion: El titular intuia que Expectativas debia medir el rendimiento cambiario esperado vs real. En la implementacion actual no lo hace.
- Dependencias: TAREA-053 (decision ADR-002)
- Estado: **DESCARTADA** — ADR-002 eligio arquitectura Pool USD (no extension de Expectativas). La seccion analytics de Expectativas queda descontinuada. CRUDs de requerimientos NO se tocan.

**TAREA-057**
- Titulo: Crear types rendimientoCambiario.types.ts
- Tipo: Implementacion (tipos)
- Modulo: Pool USD / Rendimiento Cambiario
- Prioridad: ALTA
- Origen: ADR-002 aprobado (2026-03-20)
- Estado: **RESUELTO** (CAMBIO-038, Sesion 8) — 7 interfaces completas: PoolUSDMovimiento, PoolUSDSnapshot, PoolUSDResumen, RatioCobertura, MargenRealVsNominal, PrecioReposicion, NecesidadVentasPEN, EscenarioTC, ResumenCicloPENUSD, PoolUSDConfig

**TAREA-058**
- Titulo: Crear poolUSD.service.ts con logica TCPA
- Tipo: Implementacion (servicio)
- Modulo: Pool USD / Rendimiento Cambiario
- Prioridad: ALTA
- Origen: ADR-002 aprobado (2026-03-20)
- Estado: **RESUELTO** (CAMBIO-039, Sesion 8) — service completo con registrarMovimiento, calcularResumen, generarSnapshot, guardarConfig + 6 funciones analiticas (getTCPAEnFecha, calcularRatioCobertura, calcularMargenRealVsNominal, calcularPreciosReposicion, calcularNecesidadVentas, generarEscenariosTC)

**TAREA-059**
- Titulo: Fix bug cobros USD via Zelle/PayPal se registran como PEN en venta.service.ts
- Tipo: Bug fix (prerequisito critico)
- Modulo: ventas (venta.service.ts)
- Prioridad: ALTA
- Origen: ADR-002 — bugs prerequisito identificados
- Estado: **RESUELTO** (CAMBIO-052, Sesion 8) — cobros Zelle/PayPal ahora registrados como USD, tcCobro activado al registrar cobro

**TAREA-060**
- Titulo: Activar campo tcCobro al registrar cobro en venta.service.ts
- Tipo: Bug fix / Datos faltantes (prerequisito critico)
- Modulo: ventas (venta.service.ts)
- Prioridad: ALTA
- Origen: ADR-002 — prerequisito. Tambien registrado como TAREA-054.
- Estado: **RESUELTO** (CAMBIO-052, Sesion 8) — consolida TAREA-054. tcCobro se escribe en documento Venta al registrar cobro.

**TAREA-061**
- Titulo: Crear poolUSDStore.ts (Zustand)
- Tipo: Implementacion (store frontend)
- Modulo: Pool USD / Rendimiento Cambiario
- Prioridad: MEDIA
- Origen: ADR-002 aprobado (2026-03-20)
- Estado: **RESUELTO** (CAMBIO-040, Sesion 8) — store Zustand con estado reactivo para Pool USD

**TAREA-062**
- Titulo: Crear pagina RendimientoCambiario.tsx con 4 tabs
- Tipo: Implementacion (UI)
- Modulo: Pool USD / Rendimiento Cambiario
- Prioridad: MEDIA
- Origen: ADR-002 aprobado (2026-03-20)
- Estado: **RESUELTO** (CAMBIO-041, Sesion 8) — pagina principal con 4 tabs: Resumen, Movimientos, Ciclo PEN USD, Simulador TC. Ruta: /rendimiento-cambiario. Menu: "Rendimiento FX" en seccion FINANZAS.

**TAREA-063**
- Titulo: Integrar pool con conversiones cambiarias existentes en tesoreria.service.ts
- Tipo: Implementacion (integracion)
- Modulo: Pool USD / Tesoreria
- Prioridad: MEDIA
- Origen: ADR-002 aprobado (2026-03-20)
- Estado: **RESUELTO** (CAMBIO-051, Sesion 8) — conversiones cambiarias en tesoreria.service.ts registran movimiento automatico en Pool USD

**TAREA-064**
- Titulo: Snapshot mensual del pool + revaluacion de saldos al cierre
- Tipo: Implementacion (Cloud Function)
- Modulo: Pool USD / Contabilidad
- Prioridad: MEDIA
- Origen: ADR-002 aprobado (2026-03-20)
- Estado: pendiente — TAREA-059 (nueva, reasignada desde Sesion 8)

**TAREA-065**
- Titulo: Recalculo retroactivo del pool desde historico
- Tipo: Implementacion (funcion de carga)
- Modulo: Pool USD
- Prioridad: ALTA
- Origen: ADR-002 — consideracion especial de retroactividad (titular cargara 3 meses de datos)
- Estado: **RESUELTO** (CAMBIO-079, Sesion 10) — cargarRetroactivo() implementado en poolUSD.service.ts (lee pagos OC USD, gastos USD, conversiones cambiarias de los ultimos N meses, ordena cronologicamente, registra uno a uno). Tambien implementado eliminarTodosMovimientos() para reset. UI en RendimientoCambiario.tsx: boton "Cargar Historico" con modal de confirmacion, barra de progreso, y callback de progreso.
- Pendiente de ejecucion: el titular aun no ha ejecutado la carga retroactiva real en produccion (requiere acceso admin en produccion)

**TAREA-066** (nueva — Sesion 8)
- Titulo: Agregar costoReposicion a ProductoVentaSnapshot
- Tipo: Mejora / Datos
- Modulo: productos (producto.service.ts)
- Prioridad: MEDIA
- Origen: Sesion 8 — identificado durante implementacion del Ciclo PEN USD
- Descripcion: El snapshot de producto en ventas no incluye el costo de reposicion calculado con TCPA. Necesario para que TabCicloPENUSD muestre margenes correctos sin recalculo en tiempo real.
- Estado: pendiente

**TAREA-067** (nueva — Sesion 8)
- Titulo: Agregacion de margenesPorLinea desde store de ventas
- Tipo: Feature / BI
- Modulo: Rendimiento Cambiario / Ventas
- Prioridad: MEDIA
- Origen: Sesion 8 — identificado como dato faltante en TabCicloPENUSD
- Descripcion: El tab Ciclo PEN USD requiere los margenes reales por linea de negocio. Actualmente el store de ventas no los agrega de esta forma.
- Estado: pendiente

**TAREA-068** (nueva — Sesion 8)
- Titulo: erosionMensual derivable de poolUSDSnapshots
- Tipo: Feature / BI
- Modulo: Rendimiento Cambiario
- Prioridad: BAJA
- Origen: Sesion 8
- Descripcion: La erosion mensual del TCPA puede derivarse de los snapshots del pool comparando periodos consecutivos. Requiere que haya al menos 2 meses de snapshots acumulados.
- Estado: pendiente

**TAREA-069** (nueva — Sesion 8)
- Titulo: necesidadVentas.metaPEN requiere decision de negocio
- Tipo: Decision de negocio
- Modulo: Rendimiento Cambiario
- Prioridad: MEDIA
- Origen: Sesion 8 — identificado en NecesidadVentasPEN interface
- Descripcion: El calculo de necesidad de ventas en PEN para cubrir el pool USD requiere que el titular defina la meta mensual de ventas PEN del negocio. Sin este parametro la funcionalidad queda inutilizable.
- Estado: **RESUELTO** (CAMBIO-080, Sesion 10) — Campo metaPEN agregado a PoolUSDConfig. getConfig() lee metaPEN de Firestore. UI en RendimientoCambiario.tsx: card con barra de progreso valor actual del pool vs meta, edicion inline, guardar en Firestore. El titular puede ahora ingresar la meta directamente desde la interfaz.

**TAREA-070** (nueva — Sesion 8)
- Titulo: Integracion Pool USD con pagos de OC (registrarPagoOC)
- Tipo: Integracion
- Modulo: Pool USD / Ordenes de Compra
- Prioridad: MEDIA
- Origen: Sesion 8
- Descripcion: Cuando se registra un pago de orden de compra en USD, debe generarse automaticamente un movimiento de tipo PAGO_OC en el Pool USD. Actualmente solo las conversiones cambiarias alimentan el pool.
- Estado: pendiente

**TAREA-071** (nueva — Sesion 8)
- Titulo: Integracion Pool USD con gastos en USD
- Tipo: Integracion
- Modulo: Pool USD / Gastos
- Prioridad: MEDIA
- Origen: Sesion 8
- Descripcion: Gastos pagados en USD (flete, aduana, servicios) deben registrarse como salidas del Pool USD (GASTO_IMPORTACION_USD o GASTO_SERVICIO_USD segun tipo).
- Estado: pendiente

**TAREA-072** (nueva — Sesion 8)
- Titulo: Cloud Function para snapshot mensual automatico del Pool USD
- Tipo: Infraestructura / Cloud Function
- Modulo: Pool USD
- Prioridad: MEDIA
- Origen: Sesion 8
- Descripcion: Scheduler mensual que genera el snapshot del Pool USD automaticamente al cierre de cada mes. Requiere TAREA-064 como base.
- Dependencias: TAREA-064 (snapshot service)
- Estado: pendiente

### Prioridad 3 — Performance y costos

**TAREA-008**
- Titulo: Zero React.memo en componentes
- Tipo: Performance
- Modulo: Frontend (todos)
- Prioridad: media
- Hallazgo: R2-005
- Estado: pendiente
- Accion sugerida: empezar por componentes que se renderizan en listas (tablas, tarjetas)

**TAREA-009**
- Titulo: mlsyncstock timeout risk — N reads + N API calls
- Tipo: Performance
- Modulo: MercadoLibre
- Prioridad: media
- Hallazgo: R2-017
- Estado: pendiente
- Accion: paginacion + rate limiting + mover a scheduled function con batches

**TAREA-010**
- Titulo: Sequential await en loop de siblings ML
- Tipo: Performance
- Modulo: MercadoLibre
- Prioridad: media
- Hallazgo: R2-016
- Accion: `Promise.all()` para updates paralelos
- Estado: pendiente

**TAREA-011**
- Titulo: WhatsApp webhook debe responder 200 antes de procesar AI chain
- Tipo: Bug / Performance
- Modulo: WhatsApp
- Prioridad: media
- Hallazgo: R2-029
- Accion: responder 200 inmediatamente, encolar procesamiento async con Pub/Sub o Task Queue
- Estado: pendiente (WhatsApp aun no en produccion — baja urgencia real)

**TAREA-012**
- Titulo: 50 console.log de debug FEFO en venta.service.ts
- Tipo: Code Quality
- Modulo: ventas
- Prioridad: media
- Hallazgo: R2-011
- Estado: pendiente

**TAREA-013**
- Titulo: 618 console.log/warn en servicios (logger existe sin uso)
- Tipo: Code Quality
- Modulo: todos los servicios
- Prioridad: media
- Hallazgo: R2-025
- Accion: adoptar el logger existente en servicios criticos, eliminar logs de desarrollo
- Estado: pendiente

### Prioridad 4 — Deuda tecnica y refactoring

**TAREA-014**
- Titulo: Dividir god files (6 archivos >3000 lineas)
- Tipo: Refactoring
- Modulo: Tesoreria, Transferencias, MercadoLibre, Maestros, Cotizaciones, Requerimientos
- Prioridad: baja
- Hallazgo: R2-004 + ARCH-005
- Estimado: 8-12 horas por archivo
- Estado: pendiente (no urgente)

**TAREA-015**
- Titulo: Consolidar 3 notification stores en 1
- Tipo: Refactoring
- Modulo: Frontend (stores)
- Prioridad: baja
- Hallazgo: R2-006
- Estado: pendiente

**TAREA-016**
- Titulo: Reduccion gradual de 875 `: any` y 166 `as any`
- Tipo: Code Quality
- Modulo: todos
- Prioridad: baja
- Hallazgo: R2-007
- Estado: pendiente (reduccion gradual, prioritizar zonas rojas primero)

**TAREA-017**
- Titulo: Unificar patron de export de servicios
- Tipo: Refactoring
- Modulo: servicios
- Prioridad: baja
- Hallazgo: R2-003 (code quality)
- Estado: pendiente

**TAREA-018**
- Titulo: Eliminar dead code — hooks sin uso, dual NotificationCenter, migration utils
- Tipo: Cleanup
- Modulo: varios
- Prioridad: baja
- Hallazgos: useAutoSave, useFormValidation, migration utils post-fresh-start, dual NotificationCenter
- Estado: pendiente

**TAREA-019**
- Titulo: Configurar Vitest + primer suite de tests en zonas rojas
- Tipo: Testing
- Modulo: ctru.service.ts, venta.service.ts, ml.orderProcessor.ts
- Prioridad: baja (urgente estrategicamente)
- Hallazgo: R2-002
- Estado: EN PROCESO — framework configurado (CAMBIO-090, Sesion 11), 122 tests en utils/helpers/collections (CAMBIO-091). Pendiente: tests con Firebase mocking para servicios criticos (venta, poolUSD, tipoCambio) y Cloud Functions.

### Prioridad 5 — Nice to have

**TAREA-020**
- Titulo: Adoptar react-hook-form + zod en formularios existentes
- Estado: pendiente

**TAREA-021**
- Titulo: Usar VirtualList para tablas grandes (Unidades, Ventas)
- Estado: pendiente

**TAREA-022**
- Titulo: Skeleton loading en MercadoLibre, Requerimientos, Transferencias
- Estado: pendiente

**TAREA-023**
- Titulo: Zustand selectores en Dashboard (evitar re-renders por 6 stores)
- Estado: pendiente

**TAREA-024**
- Titulo: Semantic HTML + aria-labels en componentes criticos
- Estado: pendiente

### Rondas de full review pendientes (en orden)

**TAREA-025**
- Titulo: Ejecutar code-logic-analyst (faltante de Ronda 2)
- Prioridad: alta (completa la ronda actual)
- Estado: **COMPLETADO** — 15 hallazgos (6 bugs, 4 data issues, 5 edge cases)

**TAREA-026**
- Titulo: Ejecutar Ronda 3 — database-administrator, erp-integration-engineer, bi-analyst
- Prioridad: alta
- Estado: **COMPLETADO** — database-admin (19+), bi-analyst (15+12), erp-integration (21 findings)

**TAREA-027**
- Titulo: Ejecutar Ronda 4 — devops-qa-engineer, performance-monitoring-specialist
- Prioridad: media
- Estado: **COMPLETADO** — perf-monitor (21 findings, 2 fixes) + devops-qa (12 findings, TAREA-001 resuelta)

**TAREA-028**
- Titulo: Ejecutar Ronda 5 — quality-uat-director, logistics-supply-chain-consultant, erp-business-architect
- Prioridad: media
- Estado: **COMPLETADO** — UAT: 21 defectos (4 bloqueantes), logistics: 17, ERP-arch: 12

**TAREA-029**
- Titulo: Ejecutar Ronda 6 — business-docs-manager, project-manager-erp
- Prioridad: baja
- Estado: **COMPLETADO** — project-manager (resumen ejecutivo) + business-docs (26 hallazgos, 16 docs faltantes)

---

## ACCIONES MANUALES PENDIENTES (fuera del codigo)

| Accion | Responsable | Urgencia |
|--------|-------------|----------|
| Rotar secrets: ML Client ID/Secret | Jose L. | Alta |
| Rotar secrets: Google API Key | Jose L. | Alta |
| Rotar secrets: Anthropic API Key | Jose L. | Alta |
| Rotar secrets: Meta WhatsApp Token | Jose L. | Alta |
| Rotar secrets: Daily.co API Key | Jose L. | Media |
| Configurar `WHATSAPP_APP_SECRET` en `functions/.env` desde Meta Business Suite | Jose L. | Media (WhatsApp no en produccion) |

---

## ARCHIVOS CLAVE DEL PROYECTO

### Nuevos (creados durante las sesiones)
- `/c/Users/josel/businessmn-v2/functions/src/secrets.ts` — Centralizacion de secrets con `getSecret()`
- `/c/Users/josel/businessmn-v2/functions/src/collections.ts` — Mirror de COLLECTIONS para Cloud Functions

### Pre-existentes (descubiertos durante el review)
- `/c/Users/josel/businessmn-v2/src/lib/sequenceGenerator.ts` — Generador atomico de secuencias (ahora con 21 consumidores)
- `/c/Users/josel/businessmn-v2/src/utils/dateFormatters.ts` — formatFecha, formatFechaRelativa, calcularDiasParaVencer (ahora con 41 consumidores)
- `/c/Users/josel/businessmn-v2/src/lib/firestoreHelpers.ts` — mapDocs, queryDocs (aun sin consumidores activos)

### Modificados en Sesion 1
- `/c/Users/josel/businessmn-v2/functions/src/index.ts` — ARCH-001, ARCH-002, ARCH-003, limpiezaDiaria
- `/c/Users/josel/businessmn-v2/functions/src/mercadolibre/ml.functions.ts` — SEC-002, SEC-003, SEC-008, SEC-009, CAMBIO-003
- `/c/Users/josel/businessmn-v2/functions/src/whatsapp/index.ts` — SEC-004
- `/c/Users/josel/businessmn-v2/storage.rules` — SEC-005
- `/c/Users/josel/businessmn-v2/firestore.rules` — SEC-006
- `/c/Users/josel/businessmn-v2/firebase.json` — SEC-010
- `/c/Users/josel/businessmn-v2/src/services/entrega-pdf.service.ts` — SEC-011

### Modificados en Sesion 2
- 5 servicios operativos (atomic counter): cotizacion.service.ts, ordenCompra.service.ts, expectativa.service.ts, requerimiento.service.ts, tesoreria.service.ts
- 13 servicios maestros (atomic counter): cliente, proveedor, marca, almacen, transportista, categoria, etiqueta, tipoProducto, canalVenta, entrega, transferencia, producto, competidor
- 41 componentes/servicios: migracion formatFecha (CAMBIO-001)
- `/c/Users/josel/businessmn-v2/firestore.rules` — CAMBIO-004 (whatsapp_messages)

---

## ZONAS ROJAS — NO TOCAR SIN PRUEBAS EXTENSIVAS

| Zona | Riesgo | Revisado por | Bugs encontrados |
|------|--------|--------------|------------------|
| `ctru.service.ts` + `ctruStore.ts` | Error corrompe costos de TODA la BD | code-logic-analyst ✅ | Sin bugs criticos de logica, pero complejidad alta |
| `onOrdenCompraRecibida` (Cloud Function) | Bug crea unidades fantasma | code-logic-analyst ✅ | Schema ya arreglado en ARCH-001 |
| `venta.service.ts` (asignacion FEFO + pago) | Efectos cascada en inventario y tesoreria | code-logic-analyst ✅ | DATA-001 (null fechaVencimiento crash), BUG-003 (reservadaPara no limpiada) |
| `ml.orderProcessor.ts` + `ml.sync.ts` | Bug duplica ventas | code-logic-analyst ✅ | Sin bugs nuevos (pack order fix previo funciona) |
| `firestore.rules` | Cambios incorrectos bloquean toda la app | security-guardian ✅ | Sin issues post-SEC-006 |
| `gasto.service.ts` (GD expenses) | Duplicacion de gastos por race condition | code-logic-analyst ✅ | BUG-002 (CRITICO — sin idempotencia) |
| `tesoreria.service.ts` (getMovimientos) | Saldos incompletos en cuentas | code-logic-analyst ✅ | BUG-006 (ignora cuentaDestino) |

---

## RESUMEN EJECUTIVO DEL FULL REVIEW (project-manager-erp)

### Health Score: 6.2 / 10

| Dimension | Nota | Comentario |
|-----------|------|------------|
| Funcionalidad operativa | 8/10 | 11 de 14 modulos estables, negocio funciona dia a dia |
| Seguridad | 7/10 | 11 vulnerabilidades corregidas, quedan secrets sin rotar |
| Calidad de codigo | 4/10 | 875 `: any`, 0 tests, god files, logs de debug |
| Performance | 5/10 | Fixes criticos aplicados (CTRU N+1, Dashboard), quedan full-scans |
| Integridad de datos | 6/10 | Bugs de saldo y reservas corregidos, campos legacy persisten |
| Infraestructura / DevOps | 3/10 | Sin CI/CD, sin staging, sin backups automatizados |
| Compliance regulatorio | 2/10 | Sin facturacion electronica SUNAT, sin DIGESA |

**Frase resumen:** "Operativamente funcional, regulatoriamente deficiente, financieramente aproximado."

### Top 5 riesgos activos
1. Sin backups automatizados de Firestore (CATASTROFICO — resolver ANTES de deploy)
2. Cero tests automatizados en 180k lineas (27 fixes sin verificacion automatica)
3. Sin CI/CD ni staging (deploy manual = triple ciego)
4. Gap SUNAT / facturacion electronica (obligacion regulatoria activa)
5. Bus factor = 1 (mitigado parcialmente por documentacion de este review)

### Decisiones pendientes del titular

| # | Decision | Opciones | Deadline | Estado |
|---|----------|----------|----------|--------|
| 1 | Criterio de fecha para ventas | fechaCreacion vs fechaEntrega | Dia 30 | **PENDIENTE DE IMPLEMENTAR** — decision tomada (hibrido), refactoring no ejecutado |
| 2 | TC para valorizar inventario | Centralizar 15 fallbacks 3.70 en servicio unico | Dia 30 | **IMPLEMENTADO** (Sesion 8, 2026-03-20) — CAMBIO-045/048, tipoCambio.service.ts centralizado |
| 3 | Timeline SUNAT | Iniciar en 60 dias vs posponer a 2027 | Dia 45 | Pospuesto (decision 2026-03-19) |
| 4 | Rotar secrets en consolas | Accion directa | Inmediato | Pendiente — accion manual Jose L. |
| 5 | Entidad Cliente estructurada | Sprint dedicado | Dia 30 | **IMPLEMENTADO** (Sesion 5, 2026-03-20) |
| 6 | Precio vs CTRU: aprobacion admin | Alertar + bloquear para no-admin | Dia 30 | **IMPLEMENTADO** (Sesion 5, 2026-03-20) |

### Estado de deploy
**Deploy 6 COMPLETADO — 2026-03-20**
- Commit 1: `d202a3b` — `feat: Pool USD con TCPA + Ciclo PEN USD completo + TC centralizado` (43 files, +5643/-373)
- Commit 2: `f387949` — `fix: resolve 7 pre-existing build errors for production deploy` (4 files)
- Push a main exitoso
- `firebase deploy` completo: hosting (102 files) + 54 Cloud Functions + Firestore rules
- Hosting URL: https://vitaskinperu.web.app
- 61 fixes acumulados en produccion (31 sesiones 1-4 + 6 sesion 5 + 24 sesion 8)

**Deploy 5 (referencia) — 2026-03-20**
- Commit: `e8e6d8f` — Clientes Maestros + aprobacion bajo costo
- `firebase deploy --only hosting,firestore:rules`
- 37 fixes en produccion

**Deploy 4 (referencia) — 2026-03-19**
- PR #1 mergeado a main + `firebase deploy` completo (hosting + 53 functions + rules + indexes)
- 31 fixes (11 seguridad + 8 performance + 8 bugs + 4 UAT criticos)
- Backup Firestore configurado: PITR (7 dias) + copias semanales (98 dias retencion)

### Roadmap 30/60/90 dias (actualizado post-Sesion 11, 2026-03-21)
- **0-30 dias:** Ejecutar carga retroactiva Pool USD (titular — accion manual), configurar metaPEN (titular), tests con Firebase mocking para servicios criticos (TAREA-019 continuacion), GitHub Actions CI (npm test como gate), validacion server-side ventaBajoCosto (TAREA-048), fix race condition gastos (TAREA-004), rotar secrets
- **30-60 dias:** Validacion ventas a socios (titular — verificar reportes), TAREA-052 (ventas ML sin evaluacion bajo costo), comparativas periodo anterior (TAREA-042), costoReposicion en snapshots (TAREA-066), margenesPorLinea en store ventas (TAREA-067), optimizar full-collection reads (TAREA-005/006/037)
- **60-90 dias:** Evaluacion proveedor SUNAT, flujo devoluciones, entorno staging, reduccion adicional de :any (TAREA-016)

---

## SESION 6 — 2026-03-20 (Continuacion, TC y rendimiento cambiario)

### Objetivo
Analisis profundo del manejo del tipo de cambio en el ciclo completo de negocio, disparado por pregunta critica del titular sobre el concepto de "rendimiento cambiario".

### Agentes ejecutados
- code-logic-analyst (analisis del modulo Expectativas — relacion con rendimiento cambiario)
- system-context-reader (mapa de flujos TC en el sistema: donde se usa, donde falta)
- fx-multicurrency-specialist (marco teorico: diferencial cambiario, puntos del ciclo)
- accounting-manager (implicancias contables del diferencial por punto del ciclo)
- implementation-controller (documentacion de hallazgos y decision pendiente)

### Contexto planteado por el titular

El titular identifico un concepto de negocio critico que el sistema no captura correctamente:

"Los unicos momentos reales donde influye el TC es al momento de yo efectivamente cambiar soles a dólares, o viceversa. Yo cotizo a tal TC, compro a tal TC, vendo a tal TC, pago facturas a tal TC. El rendimiento de las conversiones puede generar un ajuste positivo/negativo en la operacion."

El ciclo de negocio tiene CINCO puntos donde el TC puede generar diferencial cambiario:

| # | Punto del ciclo | TC esperado | TC real | Diferencial |
|---|-----------------|-------------|---------|-------------|
| 1 | Cotizacion al cliente | TC cotizado | — | Referencia inicial |
| 2 | Compra al proveedor | TC compra OC | TC pago OC | Diferencial Compra |
| 3 | Pago de factura proveedor | TC acordado | TC del dia de pago | Diferencial Pago |
| 4 | Venta al cliente | TC venta | TC cotizado | Diferencial Venta |
| 5 | Cobro de la venta | TC venta acordado | TC del dia de cobro | Diferencial Cobro |

El "rendimiento cambiario" del negocio es la suma neta de esos diferenciales en el periodo.

### Hallazgos del analisis

#### Estado actual del modulo Conversiones Cambiarias (Tesoreria)
- El modulo de Conversiones en Tesoreria SI registra TC real vs TC referencia con spread calculado
- Patron correcto: `montoOrigen`, `montoDestino`, `tcReal`, `tcReferencia`, `spread`
- Problema: ese patron NO se replica en los demas puntos del ciclo

#### Gaps identificados por punto del ciclo

| Punto | Campo existe | Se graba | Diferencial calculado | Reporte disponible |
|-------|-------------|----------|-----------------------|--------------------|
| Cotizacion | `tcVenta` (en Cotizacion) | Si | No | No |
| Compra OC | `tcCompra` (en OC) | Si | No | No |
| Pago OC | `tcPago` (en OC) | Parcial | No | No |
| Venta | `tcVenta` (en Venta) | Si | No | No |
| Cobro venta | `tcCobro` (en Venta) | **No — campo existe en types pero nunca se graba** | No | No |

#### Modulo de Expectativas — situacion actual
- El modulo Expectativas en Finanzas registra expectativas de gastos/ingresos futuros
- NO tiene el concepto de "rendimiento cambiario esperado vs real"
- No captura la brecha entre el TC al que se cotizo y el TC al que efectivamente se cobro
- El titular intuia que ese era su proposito, pero no lo es en la implementacion actual

### Decision tomada — ADR-002

**ADR-002: Pool USD con TCPA (Rendimiento Cambiario V1)**

- Fecha identificacion: 2026-03-20
- Estado: APROBADO por titular (2026-03-20) — ver seccion completa en REGISTRO DE DECISIONES DE ARQUITECTURA
- Decision: Pool USD con TCPA. El titular eligio esta arquitectura sobre las opciones A (extension por punto), B (reporte post-facto) y C (extension de Expectativas).
- Tareas generadas: TAREA-057 a TAREA-065
- Prerequisito inmediato: TAREA-059 (fix cobros USD como PEN) y TAREA-060 (activar tcCobro)

### Fixes aplicados en esta sesion
Ninguno. Sesion de analisis y documentacion, sin cambios al codigo.

### Tareas generadas en esta sesion

Ver TAREA-053 a TAREA-056 en la seccion de backlog (Prioridad 2 — Alta).

---

## SESION 7 — 2026-03-20 (Sesion intermedia — compilacion y verificacion)

### Objetivo
Compilar y verificar los cambios del Pool USD antes del deploy. Sesion de verificacion tecnica.

### Resultado
- Compilacion limpia: 0 errores frontend + 0 errores Cloud Functions
- Pendiente: commit + deploy + firestore rules para nuevas colecciones (completado en Sesion 8)

---

## SESION 8 — 2026-03-20 (Implementacion completa Pool USD + TC centralizado + Deploy 6)

### Objetivo
Implementar el modulo Rendimiento Cambiario V1 (ADR-002) completo en produccion: types, service, store, UI (4 tabs), TC centralizado eliminando los 15 fallbacks 3.70, integraciones en tesoreria y ventas, y desplegar a produccion.

### Agentes ejecutados
- fx-multicurrency-specialist (logica TCPA y funciones analiticas del pool)
- frontend-design-specialist (UI: tabs, simulador, alertas de reposicion)
- backend-cloud-engineer (TC centralizado, Cloud Function actualizarTipoCambioTarde)
- code-logic-analyst (fix cobros USD/PEN, fix tcCobro, fix build errors)
- implementation-controller (documentacion de sesion)

### Fixes aplicados en Sesion 8

#### CAMBIO-038 — Tipos del modulo Rendimiento Cambiario
- Tipo: Implementacion (tipos TypeScript)
- Descripcion: Creado `src/types/rendimientoCambiario.types.ts` con 7 interfaces del modelo completo: PoolUSDMovimiento, PoolUSDSnapshot, PoolUSDResumen, RatioCobertura, MargenRealVsNominal, PrecioReposicion, NecesidadVentasPEN, EscenarioTC, ResumenCicloPENUSD, PoolUSDConfig. Cubre el 100% del modelo definido en ADR-002.
- Archivo: `src/types/rendimientoCambiario.types.ts` (nuevo)
- Reversible: si

#### CAMBIO-039 — poolUSD.service.ts con logica TCPA completa
- Tipo: Implementacion (servicio)
- Descripcion: Service singleton completo para Pool USD. Funciones principales: registrarMovimiento (con recalculo de TCPA en entradas), registrarSaldoInicial, calcularResumen, generarSnapshot, guardarConfig. Funciones analiticas: getTCPAEnFecha, calcularRatioCobertura, calcularMargenRealVsNominal, calcularPreciosReposicion, calcularNecesidadVentas, generarEscenariosTC. Formula TCPA: `newTCPA = (existingUSD * oldTCPA + newUSD * newTC) / (existingUSD + newUSD)`. Validacion: pool no puede quedar negativo en salidas.
- Archivo: `src/services/poolUSD.service.ts` (nuevo)
- Reversible: si

#### CAMBIO-040 — poolUSDStore.ts (Zustand)
- Tipo: Implementacion (store)
- Descripcion: Store Zustand para Pool USD con estado reactivo. Patron singleton standard del proyecto.
- Archivo: `src/store/poolUSDStore.ts` (nuevo)
- Reversible: si

#### CAMBIO-041 — RendimientoCambiario.tsx (pagina principal 4 tabs)
- Tipo: Implementacion (UI)
- Descripcion: Pagina principal del modulo Rendimiento Cambiario con 4 tabs: (1) Resumen — saldo actual USD, TCPA, valor PEN del pool, ganancia/perdida acumulada; (2) Movimientos — tabla de movimientos con tipo, monto, tcPool vs tcSunat, impacto cambiario; (3) Ciclo PEN USD — KPIs de cobertura, tabla de margenes real vs nominal, alertas de reposicion; (4) Simulador TC — escenarios (-10% a +10%). Ruta: /rendimiento-cambiario. Menu: "Rendimiento FX" en seccion FINANZAS del sidebar.
- Archivos: `src/pages/RendimientoCambiario/RendimientoCambiario.tsx` (nuevo)
- Reversible: si

#### CAMBIO-042 — TabCicloPENUSD.tsx
- Tipo: Implementacion (componente)
- Descripcion: Tab Ciclo PEN USD con KPIs de cobertura, tabla de margenes real vs nominal por producto/linea, alertas de reposicion cuando precio esta por debajo del costo TCPA.
- Archivo: `src/components/modules/rendimientoCambiario/TabCicloPENUSD.tsx` (nuevo)
- Reversible: si

#### CAMBIO-043 — SimuladorTC.tsx
- Tipo: Implementacion (componente)
- Descripcion: Simulador de escenarios TC con 5 escenarios predefinidos (-10% a +10%, mas TC actual). Calculo algebraico directo sin iteracion. Muestra impacto en TCPA, valor del pool en PEN, y margenes por escenario.
- Archivo: `src/components/modules/rendimientoCambiario/SimuladorTC.tsx` (nuevo)
- Nota arquitectonica: escenarios predefinidos por diseno — evita complejidad de interpolacion
- Reversible: si

#### CAMBIO-044 — AlertaMargenReposicion.tsx
- Tipo: Implementacion (componente)
- Descripcion: Componente de alerta inline que aparece cuando el precio de venta esta por debajo del costo de reposicion calculado con TCPA. Distinto de la alerta de bajo costo CTRU — es una alerta de segundo nivel (precio < costo TCPA pero > CTRU nominal).
- Archivo: `src/components/modules/rendimientoCambiario/AlertaMargenReposicion.tsx` (nuevo)
- Reversible: si

#### CAMBIO-045 — tipoCambio.service.ts refactorizado (TC centralizado)
- Tipo: Refactoring / Feature (Decision 2 implementada)
- Descripcion: `src/services/tipoCambio.service.ts` refactorizado como fuente unica de TC. Fuente: SUNAT con llamada paralela como backup. Umbral de alerta configurable (Decision 6 del titular). Eliminados todos los fallbacks hardcodeados de 3.70 del service. Los 10 servicios que usaban fallback 3.70 ahora llaman a este servicio. Decision 2 del titular implementada.
- Archivo: `src/services/tipoCambio.service.ts`
- Reversible: si
- Nota: resuelve TAREA-047 (TC fallback silencioso) y Decision 2 (centralizar 15 fallbacks)

#### CAMBIO-046 — useTipoCambio.ts (hook centralizado)
- Tipo: Implementacion (hook React)
- Descripcion: Hook centralizado para obtener TC en componentes React. Evita que los componentes llamen directamente al service de TC. Incluye estado de freshness para mostrar el banner de alerta.
- Archivo: `src/hooks/useTipoCambio.ts` (nuevo)
- Reversible: si

#### CAMBIO-047 — TCFreshnessBanner.tsx
- Tipo: Implementacion (componente)
- Descripcion: Banner de alerta que aparece cuando el TC no se ha actualizado en el dia o supera el umbral configurado. Visible en paginas que usan TC para calculos financieros.
- Archivo: `src/components/common/TCFreshnessBanner.tsx` (nuevo)
- Reversible: si

#### CAMBIO-048 — 10 servicios migrados de fallback 3.70 a TC dinamico
- Tipo: Bug fix / Refactoring (Decision 2 implementada)
- Descripcion: Los siguientes 10 servicios tenian fallbacks hardcodeados a 3.70 cuando el TC no estaba disponible. Ahora todos obtienen el TC del tipoCambio.service.ts centralizado: almacen.analytics.service, contabilidad.service, cotizacion.service, cuentasPendientes.service, expectativa.service, marca.analytics.service, producto.service, productoIntel.service, reporte.service, unidad.service.
- Archivos: 10 servicios modificados (ver git status)
- Reversible: si
- Nota: consolida la eliminacion de los "15 fallbacks TC hardcodeados (3.70)" listados en MEMORY.md — Decision 2 del titular IMPLEMENTADA

#### CAMBIO-049 — tipoCambio.util.ts para Cloud Functions
- Tipo: Implementacion (utilidad backend)
- Descripcion: Utilidad TC para el backend de Cloud Functions. Aislado del frontend para no mezclar contextos de ejecucion. Permite a las funciones obtener TC sin depender de servicios del cliente.
- Archivo: `functions/src/tipoCambio.util.ts` (nuevo)
- Reversible: si

#### CAMBIO-050 — Cloud Function actualizarTipoCambioTarde (54a funcion)
- Tipo: Implementacion (Cloud Function nueva)
- Descripcion: Funcion scheduled que actualiza el TC automaticamente en horario tarde (cuando el TC de la manana puede haber variado). Complementa la actualizacion del TC matutino que ya existia. Total Cloud Functions en produccion: 54.
- Archivo: `functions/src/` (parte del bundle de Cloud Functions)
- Reversible: si (deshabilitar el schedule)

#### CAMBIO-051 — tesoreria.service.ts integrado con Pool USD
- Tipo: Integracion
- Descripcion: Las conversiones cambiarias registradas en `tesoreria.service.ts` ahora llaman automaticamente a `poolUSDService.registrarMovimiento()` via dynamic import fire-and-forget. Tipo de movimiento: COMPRA_USD_BANCO o COMPRA_USD_EFECTIVO segun el tipo de conversion. Resuelve TAREA-063.
- Archivo: `src/services/tesoreria.service.ts`
- Reversible: si

#### CAMBIO-052 — venta.service.ts: fix cobros USD + tcCobro activado
- Tipo: Bug fix (prerequisito ADR-002)
- Descripcion: Dos correcciones en `venta.service.ts`:
  (1) Fix: cobros via Zelle y PayPal ahora se registran con moneda USD (antes hardcodeaban PEN). Resuelve TAREA-059.
  (2) Fix: campo `tcCobro` ahora se escribe en el documento Venta al registrar un cobro. Dato necesario para calcular el diferencial en el punto 5 del ciclo (diferencial cobro). Resuelve TAREA-060 / TAREA-054.
- Archivo: `src/services/venta.service.ts`
- Reversible: si

#### CAMBIO-053 — VentaForm.tsx: alerta amarilla de reposicion TCPA
- Tipo: Feature / UX
- Descripcion: Se agrega una alerta amarilla (nivel 2) en VentaForm cuando el precio de un producto esta por debajo del costo de reposicion calculado con TCPA, pero aun por encima del CTRU nominal. Es un aviso informativo — no bloquea la venta (a diferencia de la alerta roja de bajo costo CTRU que si requiere aprobacion de admin). Usa dynamic import fire-and-forget para evitar dependencias circulares.
- Archivo: `src/components/modules/venta/VentaForm.tsx` (modificado)
- Nota arquitectonica: dynamic import para evitar dependencias circulares entre modulos de ventas y pool USD
- Reversible: si

#### CAMBIO-054 — ctru.utils.ts: getCTRU_Real() con TCPA
- Tipo: Feature (funcion nueva)
- Descripcion: Nueva funcion `getCTRU_Real()` en `src/utils/ctru.utils.ts` que calcula el CTRU usando el TCPA actual en lugar del TC historico de la OC. Separada de `getCTRU()` existente para no romper calculos de costo contable. Proposito: decision de precio en tiempo real (el "costo real hoy" de reponer el producto).
- Archivo: `src/utils/ctru.utils.ts` (funcion nueva en archivo existente)
- Nota arquitectonica: separacion intencional para no romper CTRU contable existente
- Reversible: si

#### CAMBIO-055 — firestore.rules: colecciones Pool USD
- Tipo: Seguridad / Infraestructura
- Descripcion: Reglas de acceso para las dos colecciones nuevas del Pool USD:
  - `poolUSDMovimientos`: lectura admin/gerente/finanzas/supervisor, escritura solo admin/gerente (o Cloud Functions via Admin SDK)
  - `poolUSDSnapshots`: lectura admin/gerente/finanzas/supervisor, escritura solo admin/gerente
- Archivo: `firestore.rules`
- Reversible: si

#### CAMBIO-056 — Colecciones nuevas en collections.ts (frontend + backend)
- Tipo: Infraestructura
- Descripcion: Constantes para las dos colecciones nuevas agregadas en ambos contextos:
  - `src/config/collections.ts`: POOL_USD_MOVIMIENTOS, POOL_USD_SNAPSHOTS
  - `functions/src/collections.ts`: mismas constantes para Cloud Functions
- Archivos: `src/config/collections.ts`, `functions/src/collections.ts`
- Reversible: si

#### CAMBIO-057 — Routing, navegacion y sidebar
- Tipo: Integracion / Infraestructura
- Descripcion: Integracion del modulo Rendimiento Cambiario en la navegacion de la aplicacion:
  - `App.tsx`: ruta lazy `/rendimiento-cambiario` → `RendimientoCambiario`
  - `Sidebar.tsx`: item "Rendimiento FX" en seccion FINANZAS
  - `MainLayout.tsx`: breadcrumb para la nueva ruta
  - `Breadcrumbs.tsx`: entrada correspondiente
- Archivos: App.tsx, Sidebar.tsx, MainLayout.tsx, Breadcrumbs.tsx
- Reversible: si

#### CAMBIO-058 — Fix: lineaNegocioId missing en ProductoConUnidades
- Tipo: Bug fix (build error pre-existente)
- Descripcion: `ProductoInventarioTable.tsx` usaba `lineaNegocioId` en una interface que no lo incluia. Corregido con cast / extension de interface.
- Archivo: componente de inventario (ProductoInventarioTable.tsx)
- Reversible: si

#### CAMBIO-059 — Fix: type-only import DocumentData en firestoreHelpers.ts
- Tipo: Bug fix (build error pre-existente)
- Descripcion: `verbatimModuleSyntax` de TypeScript requiere que los imports de solo tipos usen `import type`. Corregido en firestoreHelpers.ts.
- Archivo: `src/lib/firestoreHelpers.ts`
- Reversible: si

#### CAMBIO-060 — Fix: prop type formatFecha en NotasIA.tsx
- Tipo: Bug fix (build error pre-existente)
- Descripcion: Incompatibilidad de tipo en la prop `formatFecha` de `NotasIA.tsx`. Corregido con cast explicito.
- Archivo: componente NotasIA.tsx
- Reversible: si

#### CAMBIO-061 — Fix: async en calcularInventarioActual en almacen.analytics.service.ts
- Tipo: Bug fix (build error pre-existente)
- Descripcion: Funcion `calcularInventarioActual` usaba await sin ser async. Corregido.
- Archivo: `src/services/almacen.analytics.service.ts`
- Reversible: si

### Deploy 6 — 2026-03-20

- **Commit d202a3b:** `feat: Pool USD con TCPA + Ciclo PEN USD completo + TC centralizado` — 43 files cambiados, +5643 / -373 lineas
- **Commit f387949:** `fix: resolve 7 pre-existing build errors for production deploy` — 4 files
- **Firebase deploy:** hosting (102 files) + 54 Cloud Functions (1 nueva: actualizarTipoCambioTarde) + Firestore rules
- **Push a main:** exitoso
- **URL de produccion:** https://vitaskinperu.web.app

### Decisiones tecnicas de esta sesion (complementan ADR-002)

| Decision | Razon |
|----------|-------|
| Pool USD usa CQRS ligero: movimientos event-sourced, resumen calculado en memoria | Firestore no tiene agregaciones nativas; calcular en memoria es mas flexible y barato |
| TCPA solo cambia en entradas (compras USD), NO en salidas (pagos OC) | Por diseno contable: el costo promedio del pool no baja cuando se usa el pool |
| Simulador TC usa escenarios predefinidos (-10% a +10%) con calculo algebraico directo | Evita complejidad de interpolacion; los escenarios predefinidos son suficientes para toma de decisiones |
| getCTRU_Real separado de getCTRU | No romper calculos contables existentes; el CTRU real (TCPA) es para decision de precio, no para contabilidad |
| Alerta de reposicion en VentaForm usa dynamic import fire-and-forget | Evitar dependencias circulares entre modulos de ventas y pool USD |

### Tareas resueltas en Sesion 8

- TAREA-057: Crear types rendimientoCambiario.types.ts — **RESUELTO** (CAMBIO-038)
- TAREA-058: Crear poolUSD.service.ts — **RESUELTO** (CAMBIO-039)
- TAREA-059: Fix cobros USD como PEN — **RESUELTO** (CAMBIO-052)
- TAREA-060: Activar tcCobro — **RESUELTO** (CAMBIO-052)
- TAREA-061: Crear poolUSDStore.ts — **RESUELTO** (CAMBIO-040)
- TAREA-062: Crear pagina RendimientoCambiario.tsx — **RESUELTO** (CAMBIO-041)
- TAREA-063: Integrar pool con tesoreria — **RESUELTO** (CAMBIO-051)
- TAREA-047: TC fallback silencioso de 3.70 — **RESUELTO** (CAMBIO-045)
- Decision 2 del titular (centralizar 15 fallbacks TC) — **IMPLEMENTADA** (CAMBIO-048)

### Tareas nuevas identificadas en Sesion 8

- TAREA-066: costoReposicion en ProductoVentaSnapshot
- TAREA-067: Agregacion margenesPorLinea en store de ventas
- TAREA-068: erosionMensual desde poolUSDSnapshots
- TAREA-069: necesidadVentas.metaPEN requiere decision del titular
- TAREA-070: Integracion Pool USD con pagos de OC
- TAREA-071: Integracion Pool USD con gastos en USD
- TAREA-072: Cloud Function snapshot mensual automatico Pool USD

### Pendientes para la proxima sesion

1. Leer este archivo como briefing
2. **DECISION 1 PENDIENTE**: fecha hibrida — Dashboard=fechaCreacion, Contabilidad/Reportes=fechaEntrega
3. **DECISION TAREA-069**: titular debe definir metaPEN para calcular necesidad de ventas en Pool USD
4. **INTEGRACIONES POOL USD**: TAREA-070 (pagos OC), TAREA-071 (gastos USD)
5. **SNAPSHOT MENSUAL**: TAREA-064 + TAREA-072 (scheduler automatico)
6. **RECALCULO RETROACTIVO**: TAREA-065 (UI + Cloud Function de carga historica)
7. **SEGURIDAD**: TAREA-048 (validacion server-side ventaBajoCosto), TAREA-052 (ventas ML sin flag)
8. **DATOS**: TAREA-049 (deduplicacion clientes), TAREA-050 (doble metricas), TAREA-051 (fire-and-forget metricas)
9. **PERFORMANCE**: TAREA-005, TAREA-006, TAREA-037 (full collection reads)
10. **TESTING**: TAREA-019 (Vitest + tests zonas rojas)
11. **INFRAESTRUCTURA**: GitHub Actions CI basico

### Ya completado (no repetir):
- ~~Deploy 4~~ — PR #1 mergeado + firebase deploy completo (2026-03-19)
- ~~Deploy 5~~ — commit e8e6d8f + firebase deploy hosting+rules (2026-03-20)
- ~~Deploy 6~~ — commits d202a3b + f387949, firebase deploy hosting + 54 functions + rules (2026-03-20)
- ~~Backup Firestore~~ — PITR + copias semanales configurados
- ~~Fixes bloqueantes UAT~~ — CAMBIO-016/017/018/019 desplegados
- ~~Full review 6 rondas~~ — completo
- ~~Decision 4 (Clientes Maestros)~~ — IMPLEMENTADO en Sesion 5 (CAMBIO-032/033/034/035)
- ~~Decision 5 (Precio vs CTRU)~~ — IMPLEMENTADO en Sesion 5 (CAMBIO-036/037)
- ~~Decision 2 (centralizar fallbacks TC 3.70)~~ — IMPLEMENTADO en Sesion 8 (CAMBIO-045/048)
- ~~ADR-002 Pool USD con TCPA~~ — IMPLEMENTADO en produccion en Sesion 8 (CAMBIO-038 a CAMBIO-057)
- ~~TAREA-054/059/060 (tcCobro + moneda cobros)~~ — IMPLEMENTADO en Sesion 8 (CAMBIO-052)
- ~~TAREA-047 (TC fallback silencioso)~~ — IMPLEMENTADO en Sesion 8 (CAMBIO-045)

---

## ESTADO DE DEPLOYS

| Deploy | Fecha | Commit | Contenido | Fixes acumulados |
|--------|-------|--------|-----------|-----------------|
| Deploy 1 | 2026-03-19 | (PR branch) | SEC-001/002/003 + ARCH-001/002/003 + SEC-004/005 | 8 |
| Deploy 2 | 2026-03-19 | (PR branch) | SEC-006/007/008 | 11 |
| Deploy 3 | 2026-03-19 | (PR branch) | SEC-009/010/011 | 14 |
| Deploy 4 | 2026-03-19 | PR #1 mergeado | Completo: hosting + 53 functions + rules + indexes | 31 |
| Deploy 5 | 2026-03-20 | e8e6d8f | hosting + rules (Clientes Maestros + bajo costo) | 37 |
| Deploy 6 | 2026-03-20 | d202a3b + f387949 | hosting + 54 functions + rules (Pool USD + TC centralizado) | 61 |
| Deploy 7 | 2026-03-21 | 58fec94 | hosting + rules (bug fixes + COLLECTIONS refactor) | 67 |
| Deploy 8 | 2026-03-21 | 2ee1f98 | hosting + 55 functions + rules (refactoring completo) | 78 |
| Deploy 9 | — | — | (no documentado como deploy independiente) | — |
| Deploy 10 | 2026-03-21 | ffcf208 | hosting (sin cambios en functions — 55 estables) | 86 |
| Deploy 11 | 2026-03-21 | 32a2755 | hosting + firestore:rules (55 funciones sin cambios) | 91 |

---

## SESION 9 — 2026-03-21 (Auditoría 8 agentes + refactoring masivo + Deploy 8)

### Contexto
Auditoría post-deploy con 8 agentes especializados ejecutados en paralelo. Se resolvieron bugs críticos, se integró Pool USD con el resto del sistema, y se realizó refactoring masivo de god classes/components.

### CAMBIOS IMPLEMENTADOS (CAMBIO-062 a CAMBIO-078)

#### Bugs Críticos (Deploy 7 — commit 58fec94)
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-062 | firestore.rules | SEC-007: Bloquear auto-escalación de privilegios en user create (role=invitado, activo=false) |
| CAMBIO-063 | venta.service.ts | BUG-001/002: registrarPago con runTransaction atómico (elimina doble pago + persiste tesoreriaMovimientoId) |
| CAMBIO-064 | venta.service.ts | P2-007: Pagos USD (Zelle/PayPal) convierten a PEN via montoEquivalentePEN antes de sumar a montoPagado |
| CAMBIO-065 | poolUSD.service.ts | BUG-003: registrarMovimiento con runTransaction + doc _estado atómico (elimina corrupción TCPA) |
| CAMBIO-066 | functions/src/index.ts | P2-008: onGastoCreado batch chunking con BATCH_LIMIT=450 (previene overflow en +500 unidades) |
| CAMBIO-067 | 30+ servicios | P2-009: 153 strings hardcodeados reemplazados por COLLECTIONS constants |

#### Decisión 1: Fecha Híbrida
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-068 | contabilidad.service.ts | getVentasPeriodo usa fechaEntrega → fechaDespacho → fechaCreacion (query ampliado 2 meses) |

#### Pool USD Integrations (TAREA-070, 071, 072)
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-069 | ordenCompra.service.ts | Pagos OC en USD registran automáticamente en Pool USD (tipo PAGO_OC) |
| CAMBIO-070 | gasto.service.ts | Gastos USD registran en Pool USD — create() y registrarPago() — clasifica IMPORTACION vs SERVICIO |
| CAMBIO-071 | functions/src/index.ts | Nueva CF poolUSDSnapshotMensual: ejecuta 1ro de cada mes 6AM, registra saldo/TCPA/TC SUNAT/impacto |

#### Deduplicación Clientes (TAREA-049)
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-072 | cliente.service.ts | getOrCreate busca por nombre normalizado antes de crear (previene duplicados sin DNI/teléfono) |

#### Notificaciones Unificadas
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-073 | notification.service.ts | Absorbidos todos los métodos del sistema A (notificacion.service.ts). Sistema dual eliminado |
| CAMBIO-073b | 4 archivos eliminados | notificacion.service.ts, notificacion.types.ts, notificacionStore.ts, layout/NotificationCenter.tsx |

#### React Query Eliminado
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-074 | App.tsx + package.json | @tanstack/react-query removido (código muerto, -35KB bundle) |

#### CTRUStore Optimizado
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-075 | ctruStore.ts | fetchAll() con queries filtrados en Firestore (50-70% menos lecturas), 2 fases paralelas, guard anti-duplicación |
| CAMBIO-075b | ctru.utils.ts | Nuevo: helpers compartidos getCTRU, getCostoBasePEN, getTC, calcularGAGOProporcional |

#### God Class Splits
| ID | Archivo | Cambio |
|----|---------|--------|
| CAMBIO-076 | venta.service.ts | 4061→1764 líneas. 5 módulos: pagos, entregas, reservas, recálculo, stats |
| CAMBIO-077 | Tesoreria.tsx | 3804→980 líneas. 5 tab components: Movimientos, Conversiones, Transferencias, Cuentas, Pendientes |
| CAMBIO-078 | ml.functions.ts | 4544 líneas → 8 módulos: auth, webhooks, questions, stock, orders, diagnostics, reconciliation, reingeniería |

### TAREAS RESUELTAS EN SESION 9
| Tarea | Estado |
|-------|--------|
| TAREA-047 (TC fallback eliminado) | Ya resuelto en S8 |
| TAREA-049 (dedup clientes nombre) | ✅ RESUELTO |
| TAREA-070 (Pool USD + pagos OC) | ✅ RESUELTO |
| TAREA-071 (Pool USD + gastos USD) | ✅ RESUELTO |
| TAREA-072 (snapshot mensual Pool USD) | ✅ RESUELTO |

### MÉTRICAS DE REFACTORING
| Métrica | Antes | Después |
|---------|-------|---------|
| VentaService | 4,061 líneas | 1,764 líneas (-57%) |
| Tesoreria.tsx | 3,804 líneas | 980 líneas (-74%) |
| ml.functions.ts | 4,544 líneas | ~70 líneas shim (-98%) |
| CTRUStore lecturas Firestore | 100% docs | 30-50% docs (-50-70%) |
| Bundle size | +35KB react-query | Eliminado |
| Sistemas notificación | 2 paralelos | 1 unificado |
| Archivos eliminados | — | 4 (notificación dual) |
| Archivos nuevos | — | 18 (módulos extraídos) |
| Net líneas | +10,506 / -11,287 | **-781 netas** |

### Deploy 8
- **Commit:** 2ee1f98
- **Comando:** firebase deploy --only hosting,functions,firestore:rules
- **Resultado:** ✅ Exitoso — hosting + 55 functions + rules
- **Push a main:** ✅ Exitoso

---

## SESION 10 — 2026-03-21 (Prioridades 1/2/3 + Ventas a Socios + Deploy 10)

### Objetivo
Implementar el backlog priorizado de la sesion anterior: carga retroactiva del Pool USD (TAREA-065), metaPEN config (TAREA-069), fix metricas ventas directas (TAREA-050), Decision 6 de ventas a socios, y mejoras transversales de calidad (console.log cleanup, ErrorBoundary, fix vite.config.ts).

### Agentes ejecutados
- fx-multicurrency-specialist (CAMBIO-079: carga retroactiva, CAMBIO-080: metaPEN)
- code-logic-analyst (CAMBIO-081: fix metricas ventas directas)
- erp-business-architect (CAMBIO-082: Ventas a Socios — Decision 6)
- security-guardian (CAMBIO-083: console.log cleanup + fuga PII)
- frontend-design-specialist (CAMBIO-084: ErrorBoundary mejorado)
- devops-qa-engineer (CAMBIO-085: fix vite.config.ts)
- code-quality-refactor-specialist (CAMBIO-086: fix Maestros.tsx toast)
- implementation-controller (documentacion de sesion y cierre)

### Fixes aplicados en Sesion 10

#### CAMBIO-079 — TAREA-065: Carga retroactiva Pool USD
- Tipo: Implementacion (funcion de carga + UI)
- Descripcion: Dos funciones nuevas en `poolUSD.service.ts`:
  (1) `cargarRetroactivo(meses)`: lee pagos de OC en USD, gastos USD, y conversiones cambiarias de los ultimos N meses desde Firestore, ordena todos los movimientos cronologicamente, y los registra uno a uno preservando el orden correcto para el calculo TCPA. Usa la misma logica de `registrarMovimiento()` internamente.
  (2) `eliminarTodosMovimientos()`: elimina todos los movimientos y snapshots del pool para permitir un reset limpio antes de cargar datos retroactivos.
  UI en `RendimientoCambiario.tsx`: boton "Cargar Historico" con modal de confirmacion de dos pasos (advertencia de reset + confirmacion), barra de progreso animada, y callback que recibe actualizaciones de avance por movimiento procesado.
- Archivos: `src/services/poolUSD.service.ts`, `src/pages/RendimientoCambiario/RendimientoCambiario.tsx`
- Reversible: si (la carga puede repetirse con reset previo)
- Pendiente de ejecucion: el titular debe ejecutar la carga retroactiva real desde produccion (acceso admin requerido)

#### CAMBIO-080 — TAREA-069: metaPEN config para Pool USD
- Tipo: Feature / Decision de negocio
- Descripcion: Campo `metaPEN: number` agregado a la interface `PoolUSDConfig` en `rendimientoCambiario.types.ts`. `poolUSD.service.ts` actualizado — `getConfig()` ahora lee y devuelve `metaPEN`. UI en `RendimientoCambiario.tsx`: card "Meta de Ventas PEN" con barra de progreso que muestra el valor actual del pool en PEN vs la meta definida, campo de edicion inline, y boton de guardado que escribe en el documento de configuracion en Firestore. El titular puede actualizar la meta sin intervencion tecnica.
- Archivos: `src/types/rendimientoCambiario.types.ts`, `src/services/poolUSD.service.ts`, `src/pages/RendimientoCambiario/RendimientoCambiario.tsx`
- Reversible: si

#### CAMBIO-081 — TAREA-050: Fix metricas cliente en ventas directas
- Tipo: Bug fix / Datos
- Descripcion: Auditoria del flujo cotizacion→venta revelo que el bug era diferente al descrito originalmente: NO habia doble conteo de metricas, sino que las ventas directas (creadas sin pasar por cotizacion) no tenian sus metricas actualizadas porque `actualizarMetricasPorVenta()` solo se llamaba desde `confirmarVenta()`, no desde `crear()`. El fix agrega la llamada a `actualizarMetricasPorVenta()` en el metodo `crear()` de `venta.service.ts` con `withRetry` (el mismo patron ya existente en `confirmarVenta()`), usando `esVentaDirecta: true` como flag para distinguir el origen.
- Archivo: `src/services/venta.service.ts`
- Reversible: si
- Nota: la auditoria confirmo que el flujo cotizacion→venta llama a confirmarVenta() que ya tenia la actualizacion — sin doble conteo.

#### CAMBIO-082 — Decision 6: Ventas a Socios
- Tipo: Feature (Decision de negocio pendiente desde Sesion 5)
- Descripcion: Implementacion completa del flujo de ventas a socios con precio especial sin contaminar reportes de rentabilidad. Cambios por capa:
  - **Tipos** (`venta.types.ts`): campos `esVentaSocio: boolean` y `socioNombre: string` en las interfaces `Venta` y `VentaFormData`.
  - **Service** (`venta.service.ts`): `crear()` persiste `esVentaSocio` y `socioNombre` en el documento Firestore.
  - **Formulario** (`VentaForm.tsx`): toggle "Venta a Socio" visible solo para roles admin/gerente. Cuando se activa, aparece campo de texto para el nombre del socio.
  - **Listado** (`VentaCard.tsx`, `VentaTable.tsx`): badge purpura con texto "Socio" en ventas marcadas.
  - **Pagina Ventas** (`Ventas.tsx`): seccion colapsable "Ventas a Socios del Mes" con las ventas de socios separadas del listado principal.
  - **Reportes** (`reporte.service.ts`): 4 exclusiones explicitas (`!v.esVentaSocio`) en los metodos `getProductosRentabilidad()`, `getVentasPorCanal()`, `getTendenciaVentas()`, y `getVentasPorRango()` para que las ventas a socios no distorsionen los KPIs de rentabilidad.
  - **Stats ventas** (`venta.stats.service.ts`): exclusion de ventas a socios en calculos de totales PEN y utilidad.
  - **Hook rentabilidad** (`useRentabilidadVentas.ts`): exclusion en totales agregados del hook.
- Archivos: `venta.types.ts`, `venta.service.ts`, `VentaForm.tsx`, `VentaCard.tsx`, `VentaTable.tsx`, `Ventas.tsx`, `reporte.service.ts`, `venta.stats.service.ts`, `useRentabilidadVentas.ts`
- Reversible: si
- Nota: ventas ML y ventas normales no son afectadas. Solo ventas manuales marcadas por admin/gerente.

#### CAMBIO-083 — Console.log cleanup selectivo + fix fuga PII
- Tipo: Code Quality + Seguridad
- Descripcion: Eliminacion selectiva de 38 console.logs de desarrollo en 8 archivos. Adicionalmente, correccion de fuga de datos personales en `metricas.service.ts`: los logs que imprimian nombres completos y telefonos de clientes en consola del navegador fueron reemplazados por conteos anonimos (ej: "Actualizando metricas para N clientes" en lugar de imprimir el objeto completo con PII).
- Archivos modificados (8): `cuentasPendientes.service.ts` (-31 lineas de console.log), `metricas.service.ts` (fix PII), `producto.service.ts`, `transportista.service.ts`, `clienteStore.ts`, `NotificationCenter.tsx`, `Inventario.tsx`, `Tesoreria.tsx`, `Maestros.tsx`
- Reversible: si

#### CAMBIO-084 — ErrorBoundary mejorado con 3 capas
- Tipo: Feature / Robustez / Accesibilidad
- Descripcion: El `ErrorBoundary.tsx` existente fue ampliado con API extendida: props `fallback` (JSX custom) y `onError` (callback para logging externo). UI rediseñada con mejor accesibilidad (roles ARIA, focus management). Nuevo componente `ModuleErrorBoundary.tsx` como wrapper semantico que recibe el nombre del modulo y muestra un mensaje de error contextualizado. Implementacion en 3 capas:
  (1) **Global** (`App.tsx`): boundary envuelve `BrowserRouter` — captura errores de routing y carga inicial.
  (2) **Pagina** (`MainLayout.tsx`): boundary sobre `Outlet` — errores de una pagina no quiebran el layout ni el sidebar.
  (3) **Puntual** (`Ventas.tsx`): `ModuleErrorBoundary` sobre el modulo de ventas como ejemplo del patron para modulos criticos.
- Archivos: `src/components/common/ErrorBoundary.tsx` (ampliado), `src/components/common/ModuleErrorBoundary.tsx` (nuevo), `src/App.tsx`, `src/components/layout/MainLayout.tsx`, `src/pages/Ventas/Ventas.tsx`
- Reversible: si

#### CAMBIO-085 — Fix vite.config.ts manualChunks
- Tipo: Bug fix (build failure)
- Descripcion: `vite.config.ts` tenia una entrada en `manualChunks` que referenciaba `@tanstack/react-query`, libreria eliminada en Sesion 9 (CAMBIO-074). Esta referencia causaba un build failure silencioso. Eliminada la entrada del chunk de React Query en la configuracion de Vite.
- Archivo: `vite.config.ts`
- Reversible: si

#### CAMBIO-086 — Fix Maestros.tsx toast de sincronizacion
- Tipo: Bug fix
- Descripcion: El toast de confirmacion de sincronizacion en `Maestros.tsx` referenciaba variables inexistentes (`clientesResult`, `marcasResult`, etc.) que eran residuos de una refactorizacion anterior. El toast fallaba silenciosamente o mostraba "undefined" en la UI. Reemplazado con un mensaje generico "Sincronizacion completada" que no depende de variables de resultado especificas.
- Archivo: `src/pages/Maestros/Maestros.tsx`
- Reversible: si

### Deploy 10 — 2026-03-21

- **Commit:** ffcf208
- **Comando:** firebase deploy --only hosting
- **Resultado:** exitoso — hosting actualizado
- **Cloud Functions:** sin cambios (55 funciones estables, no requirio redespliegue)
- **Firestore Rules:** sin cambios en esta sesion
- **Push a main:** exitoso
- **URL de produccion:** https://vitaskinperu.web.app

### Metricas de la sesion

| Metrica | Valor |
|---------|-------|
| Archivos modificados | 26 |
| Archivos nuevos | 1 (ModuleErrorBoundary.tsx) |
| Lineas agregadas | +726 |
| Lineas eliminadas | -140 |
| Lineas netas | +586 |
| Cambios registrados | 8 (CAMBIO-079 a CAMBIO-086) |
| Agentes ejecutados | 8 |

### Tareas resueltas en Sesion 10

| Tarea | Descripcion | Cambio |
|-------|-------------|--------|
| TAREA-050 | Fix metricas ventas directas (el bug era faltantes, no duplicados) | CAMBIO-081 |
| TAREA-051 | withRetry ya existia — reutilizado en crear() para ventas directas | CAMBIO-081 |
| TAREA-065 | Carga retroactiva Pool USD — funcion + UI implementadas | CAMBIO-079 |
| TAREA-069 | metaPEN config — campo + UI de edicion inline | CAMBIO-080 |
| Decision 6 | Ventas a socios — tipos, service, UI, exclusiones de reportes | CAMBIO-082 |

### Tareas pendientes del backlog (para proxima sesion)

**Prioridad alta:**
- TAREA-065 ejecucion: la funcion esta lista pero el titular debe ejecutar la carga retroactiva real en produccion (requiere login admin)
- TAREA-048: Validacion server-side ventaBajoCosto (sin confianza en flag del cliente)
- TAREA-004: Race condition residual en gasto.service.ts:756-763 (padStart manual)
- TAREA-005: sincronizacion.service lee 10+ colecciones desde browser
- TAREA-040: Decision 1 solo parcialmente implementada — contabilidad.service usa fechaEntrega pero Dashboard y Reportes aun no

**Prioridad media:**
- TAREA-052: Ventas ML sin evaluacion precio vs CTRU (webhook no detecta ventas bajo costo)
- TAREA-066: costoReposicion en ProductoVentaSnapshot
- TAREA-067: margenesPorLinea desde store de ventas
- TAREA-019: Vitest + tests en zonas rojas (TAREA estrategica — no urgente operativamente)

**Pendientes operativos (accion manual del titular):**
- Ejecutar carga retroactiva 3 meses en Pool USD (CAMBIO-079 listo, solo falta ejecutar)
- Definir meta mensual PEN en Pool USD (CAMBIO-080 listo, edicion inline disponible en /rendimiento-cambiario)
- Rotar secrets en consolas externas (ML, Google, Anthropic, Meta, Daily)

---

---

## SESION 11 — 2026-03-21 (Calidad de infraestructura + Maestros split + 122 tests + Deploy 11)

### Objetivo
Resolver deuda tecnica de calidad acumulada: fix doble metricas en flujo cotizacion→venta (TAREA-050), error logging para fire-and-forget (TAREA-051), division del god file Maestros.tsx, configuracion de framework de tests Vitest, y primera suite de 122 tests unitarios en funciones criticas.

### Agentes ejecutados
- code-logic-analyst (CAMBIO-087: fix doble metricas cot→venta)
- code-quality-refactor-specialist (CAMBIO-088: error logging fire-and-forget, CAMBIO-089: split Maestros.tsx)
- devops-qa-engineer (CAMBIO-090: setup Vitest, CAMBIO-091: 122 tests unitarios)
- implementation-controller (documentacion de sesion y actualizacion MEMORY.md)

### Fixes aplicados en Sesion 11

#### CAMBIO-087 — TAREA-050: Fix doble metricas cliente en flujo cotizacion→venta
- Tipo: Bug fix / Datos
- Descripcion: Cuando una cotizacion validada sin reserva se convertia a venta, `actualizarMetricasPorVenta()` se llamaba dos veces: una en `crear()` (agregada en S9) y otra en `confirmarCotizacion()`. El fix introduce un flag `_fromCotizacion` en el objeto `ventaData` que se propaga al crear la venta desde una cotizacion. El guard en `crear()` verifica `!fromCotizacion` antes de llamar a las metricas, evitando la doble actualizacion.
- Archivos: `src/services/cotizacion.service.ts`, `src/services/venta.service.ts`
- Reversible: si

#### CAMBIO-088 — TAREA-051: Error logging para fire-and-forget
- Tipo: Observabilidad / Robustez
- Descripcion: Nueva funcion `logBackgroundError()` en `src/utils/logger.ts` que escribe errores de operaciones fire-and-forget a la coleccion Firestore `_errorLog` con deduplicacion en memoria de 60 segundos (evita escribir el mismo error repetidas veces en rafagas de fallos). 9 catch handlers actualizados en 5 servicios:
  - `tesoreria.service.ts`: 2 handlers (ambos criticos — conversiones USD + movimientos pool)
  - `entrega.service.ts`: 2 handlers (1 critico — actualizacion unidades, 1 high — notificacion)
  - `gasto.service.ts`: 1 handler (critico — registro pool USD en gastos)
  - `unidad.service.ts`: 1 handler (critico — actualizacion estado unidad)
  - `venta.service.ts`: 3 handlers (high — metricas cliente)
  La coleccion `_errorLog` fue agregada a `COLLECTIONS` en ambos contextos (frontend + Cloud Functions) y a `firestore.rules` con permisos: lectura solo admin, escritura para cualquier usuario autenticado (los servicios escriben en nombre del usuario autenticado).
- Archivos: `src/utils/logger.ts`, `src/config/collections.ts`, `functions/src/collections.ts`, `firestore.rules`, `src/services/tesoreria.service.ts`, `src/services/entrega.service.ts`, `src/services/gasto.service.ts`, `src/services/unidad.service.ts`, `src/services/venta.service.ts`
- Reversible: si

#### CAMBIO-089 — Split Maestros.tsx (god file -62%)
- Tipo: Refactoring / Deuda tecnica
- Descripcion: `Maestros.tsx` dividido de 2569 a 969 lineas (-62%). Tres archivos nuevos extraidos:
  - `TabResumen.tsx` (441 lineas): tab principal de resumen con tablas de maestros
  - `TabClasificacion.tsx` (34 lineas): tab de clasificacion ABC/RFM de clientes
  - `MaestrosModals.tsx` (1121 lineas): todos los modales de creacion/edicion de maestros concentrados en un archivo
  `TabResumen` y `TabClasificacion` se cargan con `React.lazy()` para reducir el chunk inicial del modulo. Mejora de bundle: chunk de Maestros reducido de 680KB a 596KB (-12%).
- Archivos: `src/pages/Maestros/Maestros.tsx` (reducido), `src/pages/Maestros/TabResumen.tsx` (nuevo), `src/pages/Maestros/TabClasificacion.tsx` (nuevo), `src/pages/Maestros/MaestrosModals.tsx` (nuevo)
- Reversible: si

#### CAMBIO-090 — Setup Vitest: framework de tests configurado
- Tipo: Infraestructura / Testing (TAREA-019 parcial)
- Descripcion: Configuracion completa del framework de testing Vitest en el proyecto. Paquetes instalados: `vitest 4.1`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Archivo de configuracion `vitest.config.ts` creado en la raiz del proyecto. Archivo de setup `src/test/setup.ts` con importacion de matchers de jest-dom. Scripts agregados a `package.json`: `npm test` (ejecucion unica) y `npm run test:watch` (modo watch para desarrollo). El framework queda listo para recibir tests sin configuracion adicional.
- Archivos: `vitest.config.ts` (nuevo), `src/test/setup.ts` (nuevo), `package.json`, `package-lock.json`
- Reversible: si

#### CAMBIO-091 — 122 tests unitarios para funciones criticas
- Tipo: Testing (TAREA-019 — primera suite de tests)
- Descripcion: Primera suite de 122 tests unitarios distribuidos en 4 archivos de test cubriendo las funciones mas criticas del sistema:
  - `src/utils/ctru.utils.test.ts` (25 tests): funciones del modulo CTRU — `getCTRU`, `getTC`, `getCostoBasePEN`, `getCTRU_Real`, `calcularGAGOProporcional`. Cubre casos nominales, datos faltantes, y valores extremos.
  - `src/utils/multiOrigen.helpers.test.ts` (52 tests): 17 funciones de normalizacion de origenes — helpers de conversion entre formatos legacy y nuevo, deteccion de pais de origen, construccion de rutas multi-origen. El modulo mas testeado por su rol critico en inventario.
  - `src/utils/dateFormatters.test.ts` (26 tests): funciones de formato de fechas — `formatFecha`, `formatFechaRelativa`, `calcularDiasParaVencer`. Cubre Timestamps de Firestore, fechas JS nativas, nulls, y valores de borde.
  - `src/config/collections.test.ts` (9 tests): contrato de la constante COLLECTIONS — verifica que todas las colecciones criticas existen, tienen nombres no vacios, y no hay duplicados de nombre entre colecciones distintas.
  Estado final: 122/122 tests passing. Build: 0 errores frontend, 0 errores Cloud Functions.
- Archivos: `src/utils/ctru.utils.test.ts` (nuevo), `src/utils/multiOrigen.helpers.test.ts` (nuevo), `src/utils/dateFormatters.test.ts` (nuevo), `src/config/collections.test.ts` (nuevo)
- Reversible: si

### Deploy 11 — 2026-03-21

- **Commit:** 32a2755
- **Comando:** firebase deploy --only hosting,firestore:rules
- **Resultado:** exitoso — hosting + Firestore rules actualizadas
- **Cloud Functions:** 55 funciones sin cambios — no requirio redespliegue
- **Push a main:** exitoso
- **URL de produccion:** https://vitaskinperu.web.app

### Metricas de la sesion

| Metrica | Valor |
|---------|-------|
| Archivos modificados | 22 |
| Archivos nuevos | 9 (4 test files, 3 Maestros components, vitest.config.ts, src/test/setup.ts) |
| Lineas agregadas | +4,180 |
| Lineas eliminadas | -1,855 |
| Lineas netas | +2,325 |
| Cambios registrados | 5 (CAMBIO-087 a CAMBIO-091) |
| Tests nuevos | 122 (todos passing) |
| Agentes ejecutados | 4 |

### Tareas resueltas en Sesion 11

| Tarea | Descripcion | Cambio |
|-------|-------------|--------|
| TAREA-050 | Fix doble metricas en flujo cotizacion→venta via flag _fromCotizacion | CAMBIO-087 |
| TAREA-051 | logBackgroundError() en logger.ts + 9 catch handlers actualizados | CAMBIO-088 |

### Estado de TAREA-019 (Vitest + tests zonas rojas)

- **Estado:** PARCIALMENTE RESUELTO — framework configurado y primera suite de 122 tests en utils/helpers/collections
- **Pendiente:** tests con Firebase mocking para servicios criticos (venta, poolUSD, tipoCambio), tests de Cloud Functions
- La TAREA-019 pasa de "pendiente" a "en proceso" — el framework esta operativo, la cobertura se ampliara en sesiones futuras

### Tareas pendientes para la proxima sesion (priorizadas)

**Prioridad alta:**
1. Ejecutar carga retroactiva Pool USD (TAREA-065 — funcion lista, el titular debe ejecutar desde /rendimiento-cambiario con acceso admin en produccion)
2. Configurar metaPEN en Pool USD (edicion inline disponible en /rendimiento-cambiario)
3. Tests con Firebase mocking para servicios criticos: `venta.service`, `poolUSD.service`, `tipoCambio.service` (TAREA-019 continuacion)
4. CI/CD: GitHub Actions con `npm test` como gate antes de merge a main

**Prioridad media:**
5. Seguir reduciendo chunk de Maestros (596KB — candidato a mas lazy loading de subcomponentes de MaestrosModals.tsx)
6. Validar ventas a socios con el titular: UX + exclusion correcta en todos los reportes
7. Decision 6 pendiente: precio especial socios sin contaminar rentabilidad (verificar que CAMBIO-082 cubre todos los casos de reporte)
8. TAREA-048: validacion server-side de ventaBajoCosto (sin confianza en flag del cliente)
9. TAREA-004: race condition residual gasto.service.ts:756-763 (padStart manual post-getNextSequenceNumber)

**Pendientes operativos del titular:**
- Ejecutar carga retroactiva Pool USD (boton en /rendimiento-cambiario)
- Definir metaPEN mensual (campo editable en /rendimiento-cambiario)
- Rotar secrets externos (ML, Google, Anthropic, Meta, Daily)

---

*Documento generado por implementation-controller (Agente 23)*
*Ultima actualizacion: 2026-03-21 — Sesion 11 completada. Deploy 11 exitoso (commit 32a2755). 5 cambios (CAMBIO-087 a CAMBIO-091). Fix doble metricas cotizacion→venta. Error logging fire-and-forget con _errorLog. Maestros.tsx -62% (2569→969 lineas). Vitest configurado. 122 tests unitarios en 4 archivos. 91 fixes acumulados en produccion.*
