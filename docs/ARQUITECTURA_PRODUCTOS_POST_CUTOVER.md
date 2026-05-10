# ARQUITECTURA PRODUCTOS POST-CUTOVER

> Agente: `system-architect` | Fecha: 2026-05-07
> Alcance: Validacion de coherencia entre capas, patrones, inconsistencias y ADRs para el cutover BIG BANG de 212 productos.

---

## 1. DIAGRAMA DE ARQUITECTURA OBJETIVO POST-CUTOVER

```
CAPA PRESENTACION (Frontend React)
===================================
  Wizards (CREACION)
    WizardProductoV2.tsx ......... producto unico · 6 secciones acordeon · teal
    WizardConVariantesV2.tsx ..... grupo nuevo · 5 pasos sidebar vertical · violet
    WizardVarianteExistenteV2.tsx  agregar a grupo · 3 secciones acordeon · violet

  Editores (ACTUALIZACION)
    ProductoEditModalV2.tsx ...... editor 6 secciones · lazy migration compat lectura

  Lectores (DISPLAY)
    ProductoSearchVentas.tsx ..... buscador con filtro extraFilter (excluye padres)
    ProductoSearchCotizaciones.tsx
    ProductoSearchRequerimientos.tsx
    ProductoAutocomplete.tsx ..... selector en packs, OCs, etc.
    ProductoRowCard.tsx .......... card listado con VariantesApiladas
    TabResumen/TabVariantes ...... tabs detalle con atributos V2

  Componentes compartidos
    AtributosPorLineaSection.tsx . atributos SKC (8) / SUP (7) controlados
    MarketingComercialSection.tsx  IA + audit + 3 niveles + compliance
    ChipDuracionEnvase.tsx ....... duracion calculada en vivo (solo SUP)
    MatrizVariantes1Eje.tsx ...... lista contenido/tamano
    MatrizVariantes2Ejes.tsx ..... grid contenido x sabor
    TablaVariantesInline.tsx ..... tabla editable UPC + peso + SKU preview
    ResumenGrupoReadOnly.tsx ..... solo WizardVarianteExistenteV2

  Helpers (logica pura)
    producto.helpers.ts .......... buildProductoSnapshot + getDescripcionProducto
    duracionEnvase.ts ............ calcularDuracionEnvase + evaluarDuracionAtipica

CAPA SERVICIO (Zustand + Singleton Services)
=============================================
  productoStore.ts .......... state + actions delegadas a ProductoService
  producto.service.ts ....... CRUD + createConVariantes + getVariantes
                              + vincularComoVariante + normalizeProductoVariantes
  productoMarketingIA.service.ts  wrapper CF generarDescripcionProducto
  sequenceGenerator.ts ...... getNextSequenceNumber + peekNextSequenceNumber

CAPA DATOS (Firestore)
======================
  productos ............. shape Gen-3 puro (212 docs)
  contadores/{prefix} ... SKU atomicos (SUP=170, SKC=42, etc.)
  tiposProducto ......... maestro composicion/principio activo
  categorias ............ maestro areas salud/beneficio
  etiquetas ............. maestro tags flexibles
  lineasNegocio ......... maestro lineas (SKC, SUP, APPAREL, ALIM)
  marcas ................ maestro marcas
  audit_logs ............ trazabilidad
  INDICES: grupoVarianteId+estado (NUEVO), estado+marca, estado+grupo (legacy)

CAPA CLOUD FUNCTIONS (Node.js 20, 1st Gen)
===========================================
  generarDescripcionProducto .... callable · Gemini Flash 2.5 · marketing IA
  ml.orderProcessor.ts ......... webhook ML -> venta ERP · lee prodData
  ml.sync.ts ................... sync items ML -> mlProductMap · lee sku
  whatsapp.erp.ts .............. consulta productos · DEUDA-INT-001
  (triggers en productos) ...... revisar pre-cutover · posible auditoria

SNAPSHOTS HISTORICOS (INMUTABLES)
=================================
  ventas.productos[] ........... shape del momento de venta (Presentacion string legacy OK)
  ordenesCompra.productos[] .... shape del momento de OC
  envios.productosSummary ...... shape del momento de envio
  cotizaciones.productos[] ..... shape del momento de cotizacion
  entregasParciales ............ shape del momento de entrega
```

---

## 2. COHERENCIA ENTRE CAPAS

### 2.1 Tipos <-> Service

**Estado actual (pre-cutover):**
- `ProductoFormData` declara `presentacion: Presentacion` como REQUERIDO (linea 880). El service `create()` lo escribe como `data.presentacion || ''` (linea 307). El WizardProductoV2 no envia `presentacion` porque lo elimino en S3.2. Resultado: el campo siempre llega como string vacio `''` desde el wizard V2, pero el tipo lo declara obligatorio.
- `ProductoFormData` declara `dosaje: string` como REQUERIDO (linea 883). Los productos creados por V2 no lo llenan; el service escribe `data.dosaje || ''`.
- `ProductoFormData` declara `contenido: string` como REQUERIDO (linea 884). Mismo caso.
- `ProductoFormData` declara `grupo: string` y `subgrupo: string` como REQUERIDOS (lineas 886-889). El wizard V2 no los llena.
- Los campos `contenidoNeto` y `descripcionMarketing` se leen en el service via `(data as any)` (lineas 406-411, 602-607), es decir, con casteo forzado porque `ProductoFormData` no los tipa correctamente como campos de primera clase (son opcionales en el type pero el service los lee con any-cast).

**Estado objetivo (post-cutover):**
- `ProductoFormData` debe eliminar `presentacion`, `dosaje`, `contenido`, `grupo`, `subgrupo` como campos requeridos. Deben ser opcionales o ausentes.
- `contenidoNeto` y `descripcionMarketing` deben declararse como campos opcionales tipados (sin any-cast).

**GAP:** Refactorizar `ProductoFormData` para eliminar campos legacy requeridos y tipar los V2 correctamente. Esto es prerequisito del cutover.

### 2.2 Service <-> Frontend (Wizards)

**Estado actual:**
- El service `create()` ejecuta "sync legacy" cuando recibe `atributosSkincare`: sobreescribe `presentacion`, `contenido`, `dosaje`, `sabor` top-level desde los atributos SKC (lineas 391-396). Este sync RE-CONTAMINA el shape: cada vez que se crea o edita un producto SKC, se re-escriben campos que el cutover esta eliminando.
- Lo mismo en `update()` (lineas 584-593): si se actualizan `atributosSkincare`, se re-syncea `presentacion=tipoProductoSKC`, `contenido=volumen`, `dosaje=ingredienteClave`.
- `createConVariantes()` tambien hace el sync legacy (lineas 898-901).

**Estado objetivo:**
- El sync legacy debe eliminarse completamente del service. Los campos top-level (`presentacion`, `dosaje`, `contenido`, `sabor`) no deben escribirse desde los atributos de linea.

**[ARQUITECT-GAP-1]** El service re-contamina el shape con sync legacy en 3 metodos (`create`, `update`, `createConVariantes`). Si el cutover borra los campos pero el service los re-escribe al siguiente create/edit, la migracion se deshace parcialmente. **El sync legacy debe eliminarse ANTES o DURANTE el cutover, no despues.**

### 2.3 Service <-> Cloud Functions

**Estado actual:**
- `ml.orderProcessor.ts` linea 497: lee `prodData.presentacion` directamente del documento del producto y lo escribe en el snapshot de la venta ML. Post-cutover, `presentacion` sera `undefined` (campo borrado). El snapshot de la venta tendra `presentacion: ""` (fallback).
- `ml.sync.ts` linea 82-84: lee `sku` via `item.seller_custom_field` y busca en `productos` por `where('sku', '==', sku)`. Este flujo NO depende de campos legacy; funciona con V2 puro.
- Ningun CF escribe campos legacy de vuelta a `productos`, asi que no hay re-contaminacion desde backend.

**Estado objetivo:**
- `ml.orderProcessor.ts` debe leer campos V2 (`contenidoNeto`, atributos por linea) en lugar de `presentacion` para el snapshot de la venta ML.

**[ARQUITECT-GAP-2]** `ml.orderProcessor.ts:497` lee `presentacion` del producto para el snapshot de venta. Post-cutover el campo sera vacio. Las ventas ML creadas despues del cutover tendran snapshots con `presentacion: ""` a menos que se refactorice la CF para usar `contenidoNeto` o `atributosSkincare.tipoProductoSKC`.

### 2.4 Frontend <-> Frontend (entre componentes)

**Estado actual:**
- `buildProductoSnapshot()` en `producto.helpers.ts` linea 109: escribe `presentacion: producto.presentacion || ''` en TODOS los snapshots. Los 5 servicios consumidores (venta, cotizacion, OC, envio) usan este helper. Post-cutover, `producto.presentacion` sera `undefined`, asi que el snapshot siempre tendra `presentacion: ''`.
- `getDescripcionProducto()` linea 20-34: para productos SKC, lee `skc.volumen` (que es `@deprecated`). Post-cutover, SKC migrados tendran `contenidoNeto` pero `volumen` puede seguir existiendo como campo legacy no borrado (es campo dentro del objeto `atributosSkincare`, no top-level).
- `getSearchableProductText()` linea 48-66: concatena `presentacion`, `dosaje`, `contenido` para busqueda full-text. Post-cutover estos campos estaran vacios, empobreciendo la busqueda.

**[ARQUITECT-GAP-3]** `buildProductoSnapshot`, `getDescripcionProducto` y `getSearchableProductText` en `producto.helpers.ts` dependen de campos legacy (`presentacion`, `volumen`, `dosaje`, `contenido`, `sabor`). Post-cutover produciran strings vacios. Deben refactorizarse para usar `contenidoNeto`, `atributosSuplementos`, y `atributosSkincare` correctamente.

### 2.5 BD <-> Indices

**Estado actual:**
- Indice `productos: estado + grupo` existe. Post-cutover, `grupo` se borra condicionalmente (solo donde hay `tipoProductoId`). Los productos sin `tipoProductoId` lo conservan. El indice sigue siendo valido pero cada vez mas inutil a medida que se complete la clasificacion.
- Falta indice `productos: grupoVarianteId + estado` que es necesario para `getVariantes()` (linea 689-693). Actualmente funciona como "single-field index" auto-generado por Firestore, pero un composite index mejora rendimiento.

**Estado objetivo:**
- Agregar indice `grupoVarianteId + estado` (ya documentado en MIGRACION_BD_DISENO_FINAL.md seccion 9).
- El indice `estado + grupo` puede mantenerse hasta que se complete la migracion de clasificacion.

### 2.6 Tipos <-> Snapshots Historicos

**Estado actual:**
- NO existe un tipo separado `ProductoSnapshot`. El tipo `Producto` se usa tanto para el producto vivo como para los snapshots en ventas/OC/envios. Esto genera confusion: un snapshot historico tiene `presentacion: 'capsulas'` (campo real al momento de la venta) pero el tipo `Producto` marcara ese campo como eliminado.

**[ARQUITECT-GAP-4]** No existe un tipo `ProductoSnapshot` separado del tipo `Producto`. Post-cutover, los snapshots historicos mantendran campos legacy (`presentacion`, `dosaje`, `contenido`) que ya no existen en el tipo vivo. Deberia crearse un tipo `ProductoSnapshot` con los campos que persisten en documentos historicos, para evitar que futuros refactors rompan la lectura de snapshots.

---

## 3. PATRONES ARQUITECTONICOS CLAVE

### 3.1 Patron Snapshot Historico

Los documentos de ventas, OCs, envios y cotizaciones contienen arrays `productos[]` con copias punto-en-el-tiempo del producto. Estos snapshots son INMUTABLES: nunca se migran, nunca se actualizan cuando el producto maestro cambia.

Generacion: `buildProductoSnapshot()` en `producto.helpers.ts` produce el snapshot al momento de crear el documento transaccional. El snapshot incluye: `productoId`, `sku`, `marca`, `nombreComercial`, `presentacion`, `contenido`, `dosaje`, `sabor`, `pesoLibras`, `atributosSkincare`.

Lectura: los componentes de display (VentaTable, OrdenCompraCard, EnvioDetailModal) leen directamente del snapshot embebido. No hacen lookup al producto maestro.

Post-cutover: los snapshots existentes conservan campos legacy. Los nuevos snapshots tendran `presentacion: ''` y `contenido` ausente. El helper debe evolucionar para incluir `contenidoNeto` y `varianteLabel` en snapshots futuros.

### 3.2 Patron Denormalizacion por Variantes

Cada variante es un documento independiente en `productos`. Los atributos comunes (marca, nombre, atributos de linea, clasificacion) se CLONAN en cada documento al crear el grupo. La propagacion al editar se hace via batch update a todos los hermanos (query por `grupoVarianteId`).

Costo: N writes al crear, N writes al editar un atributo comun. Beneficio: 0 joins en lectura (cada variante es self-contained), compatible con Firestore plano sin subcollections.

### 3.3 Patron Generacion Atomica de SKU

`getNextSequenceNumber(prefix, padLength)` en `sequenceGenerator.ts` usa `runTransaction` contra el documento `contadores/{prefix}` para incrementar atomicamente. Defensa anti-reset (S3.4): si el documento del contador no existe y el prefijo es de productos, escanea la coleccion y arranca desde max+1.

Post-cutover: sin cambios. La migracion NO toca contadores.

### 3.4 Patron Multi-origen en Stock

`paisOrigen` es un campo del producto maestro (donde se fabrica). `stockUSA` / `stockPeru` / `stockTransito` son contadores por ubicacion logistica. El modelo futuro (TAREA-MULTIORIGEN-COMPLETION) reemplazara `stockUSA` por un mapa `stockOrigen: { USA: N, China: N }` para multi-bodega. Post-cutover: `stockUSA` queda intocado (decision politica). `paisOrigen` tambien queda intocado.

---

## 4. INCONSISTENCIAS ARQUITECTONICAS A RESOLVER

### C-1: Contaminacion `grupoVarianteId === productoId`

- **Causa:** `vincularComoVariante()` (linea 723-724) escribe `grupoVarianteId: parentId` donde `parentId` es el doc ID del producto padre. `createConVariantes()` (linea 823) usa correctamente `crypto.randomUUID()`. Dos flujos, dos shapes distintos.
- **Impacto:** Queries por `grupoVarianteId` pueden colisionar con doc IDs. El fix C-1 de la migracion debe generar UUIDs nuevos para todos los grupos contaminados.
- **Fix:** El script de migracion (Bloque A) resuelve esto. Ademas, `vincularComoVariante()` debe refactorizarse para usar UUIDs, no doc IDs.

### C-2: Sync legacy en service re-contamina post-cutover

- **Causa:** `create()`, `update()`, `createConVariantes()` syncan `presentacion=tipoProductoSKC`, `contenido=volumen`, etc. al escribir atributos SKC.
- **Impacto:** Cada producto SKC creado o editado post-cutover re-introduce campos borrados por la migracion.
- **Fix:** Eliminar el bloque de sync legacy de los 3 metodos ANTES del cutover. Es prerequisito critico.

### C-3: `createConVariantes()` escribe campos legacy

- **Causa:** Lineas 844-854 escriben `presentacion`, `grupo`, `subgrupo`, `esPadre`, `parentId`, `esVariante`, `stockMinimo`, `stockMaximo` como campos explicitos.
- **Impacto:** Las variantes creadas por el wizard legacy post-cutover re-introducen shape legacy.
- **Fix:** El wizard V2 debe reemplazar al legacy. `createConVariantes()` debe limpiarse en paralelo con el refactor del wizard.

### C-4: `buildProductoSnapshot` no incluye campos V2

- **Causa:** El helper solo captura `presentacion`, `contenido`, `dosaje`, `sabor`, `atributosSkincare`. No captura `contenidoNeto`, `varianteLabel`, `grupoVarianteId`, `lineaNegocioId`.
- **Impacto:** Los snapshots en ventas/OC/envios post-cutover pierden informacion descriptiva.
- **Fix:** Extender `buildProductoSnapshot` para incluir `contenidoNeto`, `varianteLabel`, `lineaNegocioId`, `lineaNegocioNombre`. Los campos legacy pueden quedar como fallback.

### C-5: `ml.orderProcessor` lee `presentacion` del producto

- **Causa:** Linea 497 lee `prodData.presentacion` para el snapshot de venta ML.
- **Impacto:** Ventas ML post-cutover tendran `presentacion: ""` en sus snapshots.
- **Fix:** Refactorizar la CF para construir una descripcion desde campos V2. Esto coincide con DEUDA-INT-001 (WhatsApp) que tambien necesita leer V2.

---

## 5. DECISIONES ARQUITECTONICAS (ADRs)

### ADR-001: BIG BANG vs Migracion Gradual

**Decision:** BIG BANG (una sola pasada, sin shapes en paralelo).
**Contexto:** 212 productos, equipo de 1-2 personas, no hay staging environment.
**Razon:** Una migracion gradual requiere mantener readers con fallback para 2-3 shapes durante semanas. Con 212 documentos, el risk window del BIG BANG es ~30 minutos. El costo de mantener fallbacks en 6+ servicios supera ampliamente el riesgo de un cutover de 30 min con backup triple.
**Trade-off aceptado:** Ventana de indisponibilidad de ~30 minutos. Mitigacion: horario de baja actividad + backup triple.

### ADR-002: Sin Capa de Accessors con Fallback

**Decision:** No crear una capa de abstraccion que normalice reads Gen-1/Gen-2/Gen-3 en runtime.
**Razon:** La capa de fallback (`contenidoNeto ?? parseContenido(contenido)`) tendria que mantenerse indefinidamente. Con BIG BANG, post-cutover todos los documentos son Gen-3 puros y los fallbacks no tienen razon de existir. El unico "accessor" que se mantiene es `normalizeProductoVariantes` para el periodo de transicion de variantes (pre/post UUID).

### ADR-003: Snapshots Historicos Inmutables

**Decision:** No migrar snapshots en ventas, OCs, envios, cotizaciones.
**Razon:** Son datos de auditoria. Modificarlos viola la trazabilidad contable. Los snapshots reflejan el estado del producto AL MOMENTO de la transaccion. Si una venta de 2025 dice `presentacion: 'capsulas'`, eso es correcto: en ese momento el producto tenia ese campo. Los componentes de display deben ser tolerantes a shapes historicos.

### ADR-004: `grupoVarianteId` como UUID v4 (no doc ID)

**Decision:** Usar `crypto.randomUUID()` como identificador de grupo.
**Razon:** Si `grupoVarianteId === docId` de algun producto, una query `where('grupoVarianteId', '==', id)` puede confundirse con un lookup por doc ID. El UUID garantiza que el namespace de grupos es independiente del namespace de documentos. Ademas, permite que se cree el grupo ANTES de que existan los documentos individuales (pre-asignacion).

### ADR-005: Politica Conservadora `grupo`/`subgrupo`

**Decision:** Borrar `grupo` y `subgrupo` SOLO donde exista `tipoProductoId` valido. El resto va a CSV backlog.
**Razon:** Para productos sin clasificacion nueva, `grupo`/`subgrupo` son la UNICA referencia de tipo. Borrarlos sin reemplazo es perdida irreversible de informacion. El CSV permite completar la clasificacion sin prisa.

### ADR-006: TAREA-MULTIORIGEN-COMPLETION Diferida

**Decision:** `stockUSA` queda fuera de scope del cutover.
**Razon:** El rediseno de stock multi-bodega (USA, China, Korea, Peru) es un proyecto estructural que afecta unidades, transferencias, envios, recepcion, y el pipeline de CTRU. Mezclarlo con la limpieza de shape de productos crea un scope inmanejable. El campo `stockUSA` no interfiere con el shape V2.

### ADR-007: TAREA-ANALYTICS-REWORK Diferida

**Decision:** Los dashboards que lean campos legacy (`grupo` para agrupacion, `presentacion` para filtros) no se refactorizan en esta fase.
**Razon:** El impacto es cosmetico (dashboards muestran "Sin grupo" para productos migrados) y no funcional. Se aborda en una sesion posterior con el BI analyst.

### ADR-008: `investigacion.*Estimado` Dentro de Scope Fase 2

**Decision:** `ctruEstimado`, `precioSugeridoCalculado`, `margenEstimado`, `precioEntrada` se borran en una segunda pasada.
**Razon:** El frontend V1 legacy (ProductoCard antiguo, venta.service) aun lee estos campos. Borrarlos sin verificar que el V2 esta 100% desplegado causa regresion. La Fase 2 se ejecuta despues de confirmar que el feature flag `WIZARD_PRODUCTO_V2` esta globally enabled y el codigo legacy eliminado.

### ADR-009: Politica A para "Convertir Unico en Grupo"

**Decision:** Permitido. El producto existente recibe `grupoVarianteId` UUID nuevo + `esPrincipalGrupo: true` + `varianteLabel` derivado. SKU original intacto.
**Razon:** La alternativa (bloquear y forzar recreacion) pierde historial de ventas, ML mappings, OCs, y genera datos huerfanos. El SKU es inmutable y las referencias externas (`productoId` en ventas, `mlProductMap`, etc.) siguen apuntando al mismo documento.

---

## 6. RIESGOS ARQUITECTONICOS POST-CUTOVER

### R-1: Re-escritura de campos eliminados por sync legacy

**Probabilidad:** ALTA (ocurre en cada create/update de SKC).
**Impacto:** CRITICO. La migracion se deshace parcialmente con cada operacion.
**Mitigacion obligatoria:** Eliminar sync legacy de `create()`, `update()`, `createConVariantes()` ANTES del cutover. Ver [ARQUITECT-GAP-1].

### R-2: Snapshots empobrecidos post-cutover

**Probabilidad:** ALTA (ocurre en cada nueva venta/OC/envio/cotizacion).
**Impacto:** MEDIO. La descripcion del producto en documentos transaccionales sera `''` para `presentacion`.
**Mitigacion:** Refactorizar `buildProductoSnapshot()` para incluir campos V2. Ver [ARQUITECT-GAP-3].

### R-3: Busqueda full-text degradada

**Probabilidad:** ALTA. `getSearchableProductText()` concatena campos que estaran vacios.
**Impacto:** MEDIO. Los productos no se encontraran por terminos como "capsulas", "500mg" en buscadores de ventas/cotizaciones.
**Mitigacion:** Refactorizar `getSearchableProductText()` para leer `contenidoNeto`, `atributosSuplementos.dosaje`, `atributosSkincare.ingredienteClave`.

### R-4: Falta de tipo guard para shape legacy

**Probabilidad:** BAJA post-cutover (solo si algo falla en la migracion).
**Impacto:** BAJO. Sin un guard, codigo futuro podria asumir Gen-3 puro cuando un documento no migrado tiene shape mixto.
**Mitigacion recomendada:** Agregar una funcion `isGen3Pure(producto: Producto): boolean` que verifique ausencia de campos legacy. Usar en assertions durante desarrollo.

### R-5: Indices sin actualizar

**Probabilidad:** BAJA.
**Impacto:** BAJO. `getVariantes()` funciona sin composite index (Firestore auto-genera single-field), pero con rendimiento sub-optimo para grupos grandes.
**Mitigacion:** Desplegar el indice `grupoVarianteId + estado` antes del cutover.

### R-6: `normalizeProductoVariantes` sigue derivando `grupoVarianteId` desde legacy

**Probabilidad:** MEDIA. El normalizer (linea 51-54) hace `grupoVarianteId ?? grupoId ?? parentId ?? (esPadre ? id : undefined)`. Post-cutover, `parentId`, `grupoId`, `esPadre` se borran, asi que el fallback legacy es inerte. Pero si un producto no fue migrado correctamente (fallo parcial), el normalizer podria re-introducir contaminacion.
**Mitigacion:** Post-cutover, simplificar `normalizeProductoVariantes` para que solo lea `grupoVarianteId` y `esPrincipalGrupo` sin fallbacks legacy.

---

## RESUMEN DE GAPS ARQUITECTONICOS

| ID | Descripcion | Severidad | Cuando resolver |
|----|-------------|-----------|-----------------|
| ARQUITECT-GAP-1 | Sync legacy en service re-contamina shape | CRITICA | ANTES del cutover |
| ARQUITECT-GAP-2 | ml.orderProcessor lee `presentacion` | MEDIA | ANTES o DURANTE cutover |
| ARQUITECT-GAP-3 | producto.helpers.ts usa campos legacy | MEDIA | DURANTE cutover |
| ARQUITECT-GAP-4 | Falta tipo `ProductoSnapshot` separado | BAJA | Post-cutover (deuda tecnica) |

**Orden de ejecucion recomendado:**
1. ARQUITECT-GAP-1 (sync legacy) -- porque bloquea toda la migracion
2. ARQUITECT-GAP-3 (helpers) -- porque afecta experiencia diaria post-cutover
3. ARQUITECT-GAP-2 (ml.orderProcessor) -- porque afecta ventas ML automaticas
4. ARQUITECT-GAP-4 (tipo snapshot) -- porque es deuda tecnica, no blocker
