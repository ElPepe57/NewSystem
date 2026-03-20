# PLAN DE REMEDIACION INTEGRAL — BusinessMN v2

**Fecha:** 2026-03-19
**Basado en:** Rondas 1 y 2 completas (System Architect + Security Guardian + Frontend Design + Backend Cloud + Code Quality)
**Alcance:** Hallazgos tecnicos y de seguridad (Legal Compliance excluido por decision del negocio)
**Ultima actualizacion:** 2026-03-19 — Sesion 2 completada

---

## ESTADO DE REMEDIACION

| Categoria | Total | Criticos | Resueltos |
|-----------|-------|----------|-----------|
| Seguridad (Ronda 1) | 15 | 3 | **11** (SEC-001 a SEC-011) |
| Arquitectura (Ronda 1) | 16 | 5 | **3** (ARCH-001, 002, 003) |
| Backend/Cloud (Ronda 2) | 28 | 3 | **3** (R2-001, R2-012, R2-018) |
| Code Quality (Ronda 2) | 20 | 5 | **2** (R2-010, calcularDiasParaVencer) |
| Frontend Design (Ronda 2) | 18 | 4 | **0** |
| **TOTAL** | **97** | **20** | **19** |

---

## SESION 1 — COMPLETADA (2026-03-19)

### SEC-001 — Secrets centralizados
- **Estado:** Completado
- **Antes:** `process.env.SECRET` directo en 6 archivos
- **Despues:** `secrets.ts` centraliza acceso, 0 `process.env` directo en produccion
- **Archivos:** `secrets.ts` (nuevo), `ml.api.ts`, `ml.functions.ts`, `whatsapp.meta.ts`, `whatsapp.ai.ts`, `whatsapp.classifier.ts`, `index.ts`
- **Pendiente manual:** Rotar secrets en consolas externas (ML, Google, Anthropic, Meta, Daily)

### SEC-002 — Auth en mlrepairmetodoenvio
- **Estado:** Completado
- **Antes:** `onCall(async () => {})` sin verificar `context.auth`
- **Despues:** `onCall(async (_data, context) => { if (!context.auth) throw... })`
- **Archivo:** `ml.functions.ts:4416`

### SEC-003 — Validacion webhook ML
- **Estado:** Completado
- **Antes:** Acepta cualquier POST sin validar origen
- **Despues:** Valida `application_id` contra `ML_CLIENT_ID` + `user_id` contra `mlConfig/settings`
- **Archivo:** `ml.functions.ts:152-190`

### SEC-004 — WhatsApp webhook HMAC validation
- **Estado:** Completado
- **Antes:** Webhook acepta cualquier POST sin validar firma Meta
- **Despues:** Valida `X-Hub-Signature-256` con `crypto.createHmac('sha256', appSecret)` + `timingSafeEqual`
- **Archivo:** `functions/src/whatsapp/index.ts`
- **Pendiente manual:** Configurar `WHATSAPP_APP_SECRET` en `functions/.env` (obtener de Meta Business Suite)

### SEC-005 — Storage rules restrictivas
- **Estado:** Completado
- **Antes:** `/{allPaths=**} allow read, write: if request.auth != null`
- **Despues:** Solo 3 paths permitidos, catch-all `allow: false`
- **Archivo:** `storage.rules`

### SEC-006 — Colecciones sin reglas Firestore
- **Estado:** Completado
- **Antes:** 5 colecciones sin reglas (denegadas por defecto)
- **Despues:** Reglas explicitas para `scanHistory`, `conteosInventario`, `whatsapp_sessions`, `whatsapp_config`, `mlWebhookLog`
- **Archivo:** `firestore.rules`

### SEC-007 — Google Maps API Key restriccion de dominio
- **Estado:** Completado (accion manual)
- **Despues:** Restriccion a `vitaskinperu.web.app` y `vitaskinperu.firebaseapp.com`

### SEC-008 — Funciones callable ML con verificacion de rol
- **Estado:** Completado
- **Antes:** 17 funciones admin/repair solo verificaban `context.auth`
- **Despues:** `requireAdminRole()` verifica rol `admin` o `gerente`
- **Archivo:** `functions/src/mercadolibre/ml.functions.ts`

### SEC-009 — OAuth callback parameter injection
- **Estado:** Completado
- **Antes:** Parametro `error` de ML OAuth sin sanitizar
- **Despues:** `encodeURIComponent(String(error).substring(0, 100))`
- **Archivo:** `functions/src/mercadolibre/ml.functions.ts`

### SEC-010 — Security headers
- **Estado:** Completado
- **Despues:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`
- **Archivo:** `firebase.json`

### SEC-011 — XSS prevention en entrega-pdf
- **Estado:** Completado
- **Antes:** `document.write()` con datos dinamicos sin sanitizar
- **Despues:** `escapeHtml()` en todas las interpolaciones dinamicas
- **Archivo:** `src/services/entrega-pdf.service.ts`

### ARCH-001 — Schema mismatch Cloud Functions vs Frontend
- **Estado:** Completado
- **Antes:** `onOrdenCompraRecibida` escribia campos con nombres incorrectos
- **Despues:** Campos alineados con `unidad.types.ts`
- **Archivo:** `functions/src/index.ts:150-210`

### ARCH-002 — Batch chunking implementado
- **Estado:** Completado
- **Antes:** Un solo `db.batch()` para todas las unidades (>166 = fallo silencioso)
- **Despues:** Chunks de 450 ops con `MAX_OPS_PER_BATCH = 450`
- **Archivo:** `functions/src/index.ts`

### ARCH-003 — COLLECTIONS constante para Cloud Functions
- **Estado:** Completado
- **Antes:** Strings hardcodeados en `index.ts`
- **Despues:** `functions/src/collections.ts` (nuevo) mirror del frontend
- **Archivos:** `functions/src/collections.ts` (nuevo), `functions/src/index.ts` (~25 reemplazos)

---

## SESION 2 — COMPLETADA (2026-03-19)

### R2-001 — generateNumeroVenta leia TODA la coleccion ventas
- **Estado:** Completado (incluido en CAMBIO-002)
- **Antes:** Query sin filtros a `ventas` para buscar numero maximo — race condition garantizada
- **Despues:** `getNextSequenceNumber()` con transaccion atomica Firestore
- **Modulo:** `venta.service.ts`

### R2-010 — formatFecha duplicado ~30 veces
- **Estado:** Completado (CAMBIO-001)
- **Antes:** Copia local de `const formatFecha = (timestamp: any) => ...` en cada archivo
- **Despues:** 41 archivos importan de `src/utils/dateFormatters.ts`

### R2-012 — Race condition en generateNumero*
- **Estado:** Completado (incluido en CAMBIO-002)
- **Despues:** 21 generadores de numeros secuenciales migrados a atomic counter
- **Archivos afectados:** todos los servicios que generan IDs secuenciales (venta, gasto, cotizacion, OC, expectativa, requerimiento x2, tesoreria x2, cliente, proveedor, marca, almacen, transportista, categoria, etiqueta, tipoProducto, canalVenta, entrega, transferencia, producto, competidor)

### R2-018 — whatsapp_messages sin regla en firestore.rules
- **Estado:** Completado (CAMBIO-004)
- **Despues:** read: admin/gerente, write: false (Cloud Functions only)

### calcularDiasParaVencer — duplicado 6+ veces
- **Estado:** Completado (incluido en CAMBIO-001)
- **Despues:** centralizado en `src/utils/dateFormatters.ts`

### limpiezaDiaria — scheduled no-op
- **Estado:** Completado (CAMBIO-005)
- **Despues:** deshabilitada hasta que tenga implementacion real

### ML webhook fail-closed
- **Estado:** Completado (CAMBIO-003)
- **Despues:** rechaza con 503 si `ML_CLIENT_ID` no esta configurado

---

## PENDIENTE — Alta prioridad

### TAREA-001 — Node.js 20 a 22 + firebase-functions v4 a v5
- **Severidad:** CRITICA — deadline duro
- **Deadline:** 2026-04-30 (fin de soporte Node.js 20 en Firebase)
- **Modulo:** Cloud Functions (todas, 60+)
- **Estimado:** 4-8 horas (upgrade + testing + deploy)
- **Estado:** pendiente

### TAREA-002 — N+1 query en seleccionarFEFO
- **Severidad:** alta
- **Modulo:** `venta.service.ts` — funcion `seleccionarFEFO`
- **Problema:** query individual por cada unidad candidata en Firestore
- **Fix:** query batch con `in` o pre-cargar unidades disponibles por producto
- **Estado:** pendiente

### TAREA-003 — Missing composite indexes en Firestore
- **Severidad:** alta (queries pueden fallar o ser lentas en produccion)
- **Colecciones:** unidades, ventas, gastos, mlOrderSync
- **Fix:** crear en Firebase Console o agregar a `firestore.indexes.json`
- **Estado:** pendiente

### TAREA-004 — Race condition residual en gasto.service.ts:756-763
- **Severidad:** alta
- **Problema:** usa `padStart` manual despues de `getNextSequenceNumber()` — inconsistencia
- **Fix:** usar el numero retornado directamente sin reformatear
- **Estado:** pendiente

### TAREA-005 — sincronizacion.service reads masivos desde browser
- **Severidad:** alta
- **Problema:** lee 10+ colecciones completas desde el cliente
- **Fix:** migrar a Cloud Function con Admin SDK
- **Estado:** pendiente

### TAREA-006 — inventario.service full collection reads para reservas
- **Severidad:** alta
- **Modulo:** `inventario.service.ts`
- **Fix:** usar campos de estado en unidades directamente o index compuesto
- **Estado:** pendiente

### TAREA-007 — ML webhook rechaza notificaciones sin application_id
- **Severidad:** alta
- **Problema:** algunas notificaciones ML validas no incluyen `application_id` — check actual las rechaza
- **Fix:** permitir notificaciones sin `application_id` o verificar tipo de recurso antes
- **Estado:** pendiente

### code-logic-analyst — faltante de Ronda 2
- **Prioridad:** alta (completa la ronda actual antes de continuar)
- **Scope:** revisar logica en las 5 zonas rojas
- **Estado:** pendiente

---

## PENDIENTE — Media prioridad

### R2-005 — Zero React.memo()
- Ningun componente tiene React.memo(), useMemo() o useCallback()
- Fix: empezar por componentes en listas y tablas
- Estado: pendiente

### R2-009 — sincronizacion.service
- Ver TAREA-005
- Estado: pendiente

### R2-016 — Sequential await en loop ML siblings
- Fix: `Promise.all()` para updates paralelos de sub-ordenes
- Estado: pendiente

### R2-017 — mlsyncstock timeout risk
- Fix: paginacion + rate limiting
- Estado: pendiente

### R2-029 — WhatsApp webhook AI chain antes de 200
- Fix: responder 200 inmediatamente, procesar async (Pub/Sub o Task Queue)
- Nota: WhatsApp aun no en produccion — urgencia real baja
- Estado: pendiente

### R2-011 — 50 console.log FEFO en venta.service.ts
- Fix: eliminar o condicionar con flag de debug
- Estado: pendiente

### R2-025 — 618 console.log en servicios
- Logger existe pero no se usa
- Fix: adoptar logger en servicios criticos
- Estado: pendiente

### Ronda 3 — database-administrator, erp-integration-engineer, bi-analyst
- Estado: pendiente

### Ronda 4 — devops-qa-engineer, performance-monitoring-specialist
- Estado: pendiente

---

## PENDIENTE — Baja prioridad / Backlog

### ARCH-004 — 3 patrones diferentes de servicios
- Singleton objects es el patron oficial (ADR-002)
- Migrar gradualmente: `VentaService`, `OrdenCompraService`, `ProductoService`, `CotizacionService`, `ExpectativaService`
- Estimado: 4-6 horas (no urgente)
- Estado: pendiente

### ARCH-005 — God files (>3000 lineas)
- Top 6: Tesoreria (3798), Transferencias (3216), MercadoLibre (3142), Maestros (2578), Cotizaciones (2540), Requerimientos (2461)
- Estimado: 8-12 horas por archivo
- Estado: pendiente (refactoring mayor)

### ARCH-006 — Campos legacy coexisten con nuevos
- `requerimientoId` + `requerimientoIds[]`, `grupo`/`subgrupo` + `categoria`/`tipo`, estados USA + genericos
- Fix: migration scripts + deprecation gradual
- Estado: pendiente

### ARCH-007 — CTRU logica distribuida en 3 archivos
- `ctru.service.ts`, `ctruStore.ts`, `ctru.utils.ts` con logica superpuesta
- Estado: pendiente (ZONA ROJA — testing extensivo requerido)

### R2-002 — Zero tests automatizados
- 180k+ lineas sin un solo test
- Fix: configurar Vitest + tests en zonas rojas
- Estado: pendiente

### R2-004 — 63+ archivos >500 lineas
- Ver ARCH-005 para casos criticos
- Estado: pendiente

### R2-006 — 3 notification stores redundantes
- `toastStore`, `notificationStore`, `systemNotificationStore`
- Fix: consolidar en 1
- Estado: pendiente

### R2-007 — 875 `: any` + 166 `as any`
- Reduccion gradual, prioritizar zonas rojas
- Estado: pendiente

### Dead code — useAutoSave, useFormValidation, migration utils post-fresh-start
- Estado: pendiente

### react-hook-form + zod — instalados pero sin adopcion
- Estado: pendiente

### VirtualList — construido pero sin uso
- Estado: pendiente

### SEC-012-015 — Mejoras de seguridad menores
- Rate limiting, logging de seguridad, session timeout, dependencies audit
- Estado: pendiente

### Ronda 5 — quality-uat-director, logistics, erp-business-architect
- Estado: pendiente

### Ronda 6 — business-docs-manager, project-manager-erp
- Estado: pendiente

---

## CRONOGRAMA ACTUALIZADO

| Fase | Contenido | Estado |
|------|-----------|--------|
| Fase 1 SEC+ARCH (Sesion 1) | SEC-001/002/003 + ARCH-001/002/003 | Completado |
| Fase 2 SEC (Sesion 1) | SEC-004 a SEC-008 | Completado |
| Fase 3 SEC (Sesion 1) | SEC-009/010/011 | Completado |
| Fase 4 Code (Sesion 2) | R2-001, R2-010, R2-012, R2-018, limpiezaDiaria, ML fail-closed | Completado |
| Proxima sesion | code-logic-analyst + Node.js upgrade + TAREA-002/003/004 | Pendiente |
| Ronda 3 | database-administrator, erp-integration-engineer, bi-analyst | Pendiente |
| Ronda 4 | devops-qa-engineer, performance-monitoring-specialist | Pendiente |
| Ronda 5 | quality-uat-director, logistics, erp-business-architect | Pendiente |
| Ronda 6 + cierre | business-docs-manager, project-manager-erp | Pendiente |
| Backlog | ARCH-004 a ARCH-007, testing, refactoring god files | Sin fecha |

---

## PROTOCOLO DE REVISION — Estado actualizado

| Ronda | Agentes | Estado |
|-------|---------|--------|
| Ronda 1 | system-architect + security-guardian + (legal excluido) | Completada |
| Ronda 2 | frontend-design + backend-cloud + code-quality + **code-logic-analyst** | 3/4 — falta code-logic-analyst |
| Ronda 3 | database-admin + erp-integration + bi-analyst | Pendiente |
| Ronda 4 | devops-qa + performance-monitoring | Pendiente |
| Ronda 5 | quality-uat + logistics + erp-business-architect | Pendiente |
| Ronda 6 | business-docs-manager + project-manager-erp | Pendiente |

---

*Actualizado 2026-03-19 — Sesion 1: SEC-001 a SEC-011 + ARCH-001/002/003 completados (3 deploys)*
*Sesion 2: R2-001, R2-010, R2-012, R2-018, limpiezaDiaria, ML fail-closed completados*
*Para contexto completo del proyecto ver: docs/REGISTRO_IMPLEMENTACION.md*
