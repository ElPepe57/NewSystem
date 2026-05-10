# IMPACTO EN PROCESOS DE NEGOCIO — CUTOVER BIG BANG MODULO PRODUCTOS

> Agente: `erp-business-architect` | Fecha: 2026-05-07
> Scope: 212 productos migrados en ~30 min de ventana de mantenimiento
> Motor: Cloud Firestore | Proyecto: businessmn-269c9

---

## 1. PROCESOS DE NEGOCIO IMPACTADOS — MATRIZ

### 1.1 Order-to-Cash: Cotizacion

| Aspecto | Detalle |
|---------|---------|
| Que hace | Vendedor busca producto, agrega a cotizacion, genera PDF, envia al cliente |
| Como lee productos | `ProductoService.getById()` + `buildProductoSnapshot()` en `cotizacion.crud.service.ts` |
| Snapshot persiste | `presentacion`, `contenido`, `dosaje`, `sabor`, `atributosSkincare` via `buildProductoSnapshot` |
| PDF usa | `producto.presentacion`, `producto.contenido`, `producto.dosaje` para linea de info tecnica (cotizacionPdf.service.ts:242-244) |
| Durante ventana | BLOQUEADO: si el vendedor busca un producto a medio migrar, puede leer un doc con `presentacion` borrada y `contenidoNeto` aun no escrito. No se deben crear cotizaciones. |
| Post-cutover | `buildProductoSnapshot` sigue leyendo `presentacion` del producto. Post-migracion, `presentacion` top-level desaparece de los 212 productos. El snapshot escribira `presentacion: ""`. La info tecnica del PDF quedara incompleta hasta que `buildProductoSnapshot` se actualice para derivar desde `contenidoNeto`. |
| Accion requerida | **CRITICA**: actualizar `buildProductoSnapshot` en `src/utils/producto.helpers.ts` para derivar `presentacion` desde `contenidoNeto.unidad` + `contenidoNeto.valor` cuando `producto.presentacion` no exista. Deploy simultaneo con la migracion. |

### 1.2 Order-to-Cash: Venta directa

| Aspecto | Detalle |
|---------|---------|
| Que hace | Vendedor crea venta, busca producto, registra items, cobra |
| Como lee productos | `VentaService.getProductosDisponibles()` lee todos los productos activos con `ProductoService.getAll()` + `buildProductoSnapshot` |
| Campos propagados a venta | `varianteLabel`, `grupoVarianteId`, `esPrincipalGrupo`, `esPack` ya se propagan (lineas 282-288 de venta.service.ts) |
| Durante ventana | BLOQUEADO: misma razon que cotizacion. No crear ventas. |
| Post-cutover | La busqueda de productos funciona porque filtra por `estado='activo'` y `nombreComercial` + `marca` que no cambian. Pero el snapshot persistido tendra `presentacion: ""` para todos los productos migrados. Snapshots historicos NO se tocan (politica del diseno de migracion). |
| Accion requerida | Misma que cotizacion: actualizar `buildProductoSnapshot`. Las ventas nuevas post-deploy llevaran el nuevo formato. Las ventas historicas conservan sus snapshots legacy intactos. |

### 1.3 Order-to-Cash: Venta ML (webhook automatico)

| Aspecto | Detalle |
|---------|---------|
| Que hace | CF `processMLWebhook` recibe orden ML, crea venta automatica, ajusta stock |
| Como lee productos | `ml.orderProcessor.ts:491` lee directamente de Firestore: `prodData.presentacion` |
| Snapshot de venta ML | Persiste `presentacion`, `sku`, `nombreComercial`, `marca` |
| Durante ventana | SUSPENDIDO: los webhooks ML se pausan a T-15 (plan de cutover seccion 8). Los webhooks acumulados se procesan despues. |
| Post-cutover | **GAP CRITICO**: `ml.orderProcessor.ts:497` lee `prodData.presentacion` directamente del documento. Post-migracion ese campo no existe. La venta ML se creara con `presentacion: ""`. No causa error (fallback a string vacio) pero pierde info en el snapshot de la venta. |
| Accion requerida | **ALTA**: actualizar `ml.orderProcessor.ts` para derivar presentacion desde `contenidoNeto` cuando `presentacion` no exista. Deploy de functions simultaneo. |

### 1.4 Procure-to-Pay: Orden de Compra

| Aspecto | Detalle |
|---------|---------|
| Que hace | Comprador crea OC con productos, registra costos, envia a proveedor |
| Como lee productos | `ordenCompra.crud.service.ts:118-124` usa `ProductoService.getById()` + `buildProductoSnapshot` |
| Snapshot persiste | Mismos campos que cotizacion via `buildProductoSnapshot` |
| Durante ventana | BLOQUEADO: no crear OCs. |
| Post-cutover | Impacto identico a cotizacion. El snapshot de OC tendra `presentacion: ""`. |
| Accion requerida | Misma correccion de `buildProductoSnapshot`. |

### 1.5 Procure-to-Pay: Recepcion de envios

| Aspecto | Detalle |
|---------|---------|
| Que hace | Almacenero recibe producto, genera unidades, ajusta stock |
| Como lee productos | `envio.crud.service.ts:96-134` usa `ProductoService.getById()` + `buildProductoSnapshot` para `productosSummary` |
| Snapshot en envio | Persiste `presentacion`, `contenido`, `dosaje`, `sabor`, `pesoLibras`, `atributosSkincare`, `lineaNegocioId` |
| Durante ventana | BLOQUEADO: no crear envios. |
| Post-cutover | El `productosSummary` del envio pierde `presentacion` en las entidades nuevas. Envios historicos conservan sus snapshots. |
| Accion requerida | `buildProductoSnapshot` corregido + el bloque de `envio.crud.service.ts:129` que lee `snap.presentacion` y `snap.contenido` directamente del snapshot necesita fallback a `contenidoNeto`. |

### 1.6 Stock: Inventario y movimientos

| Aspecto | Detalle |
|---------|---------|
| Que hace | Consolida unidades por producto/almacen, calcula disponibilidad |
| Como lee productos | `inventarioService.getInventarioAgregado()` lee `ProductoService.getAll()` y mapea por `producto.id` |
| Campos afectados | `producto.grupo` y `producto.subgrupo` se usan en lineas 116-117 para `productoGrupo` y `productoSubgrupo`. Filtros en lineas 155-160 dependen de estos campos. |
| Campos criticos NO afectados | `producto.stockMinimo`, `producto.stockMaximo` NO se borran (politica de migracion). Stock real vive en la coleccion `unidades`, no en `productos`. |
| Durante ventana | Lectura degradada: el inventario mostrara datos inconsistentes si se abre durante el apply. |
| Post-cutover | `productoGrupo` sera `undefined` para ~80% de productos (los que tienen `tipoProductoId` y perdieron `grupo`). Los filtros de inventario por grupo dejaran de funcionar para esos productos. |
| Accion requerida | **MEDIA**: actualizar `inventarioService` para derivar grupo desde `tipoProductoId` o `tipoProducto.snapshot.nombre` en lugar de `producto.grupo`. |

### 1.7 WhatsApp ERP

| Aspecto | Detalle |
|---------|---------|
| Que hace | Bot WhatsApp consulta stock/precio en tiempo real |
| Como lee productos | `whatsapp.erp.ts:144-155` lee directamente de Firestore y busca por `marca`, `nombre`, `presentacion`, `sku` |
| Formateo | `formatProductName()` (linea 1483) lee `p.presentacion`, `p.contenido`, `p.dosaje`, `p.sabor` |
| Durante ventana | DEGRADADO: el bot sigue funcionando (no se suspende), pero los productos a mitad de migracion pueden mostrar info incompleta. |
| Post-cutover | **GAP CRITICO**: la busqueda usa `presentacion` como parte del fullText para matching. Post-migracion, buscar "capsulas" no encontrara productos SUP porque `presentacion` fue borrada. `formatProductName` mostrara nombres sin variantes ("Omega 3" en lugar de "Omega 3 (capsulas 60 capsulas 500mg)"). |
| Accion requerida | **ALTA**: actualizar `whatsapp.erp.ts` para: (a) incluir `contenidoNeto.valor` + `contenidoNeto.unidad` en `fullText` de busqueda, (b) actualizar `formatProductName` para derivar variantes desde `contenidoNeto` + `atributosSuplementos`. Deploy simultaneo de functions. |

### 1.8 Reporting: Analytics de marca/cliente/competidor

| Aspecto | Detalle |
|---------|---------|
| Que hace | Calcula KPIs por marca, dashboards de cliente, analisis competitivo |
| Campos afectados | `marca.analytics.service.ts:410-415` lee `producto.dosaje`, `producto.contenido`, `producto.presentacion`, `producto.grupo`, `producto.subgrupo`. `competidor.analytics.service.ts:508` lee `producto.grupo`. |
| Durante ventana | No generar reportes. |
| Post-cutover | 5 columnas quedan vacias o en string vacio para productos migrados: `presentacion`, `dosaje`, `contenido`, `grupo`, `subgrupo`. Los analytics historizados en snapshots de ventas NO se ven afectados. Solo los reportes que leen en vivo desde la coleccion `productos`. |
| Accion requerida | **MEDIA**: actualizar analytics services para derivar campos desde la estructura V2 (`contenidoNeto`, `atributosSuplementos`, `tipoProducto`). No es urgente pero degrada reportes. |

---

## 2. GAP ANALYSIS — BRECHAS PRE Y POST CUTOVER

### 2.1 Brechas que ya existen HOY (pre-cutover)

| Brecha | Detalle |
|--------|---------|
| 3 generaciones coexistentes | GEN-1 (legacy puro), GEN-2 (mixto wizard V2), GEN-3 (V2 puro). `buildProductoSnapshot` lee `presentacion` top-level que existe en GEN-1/GEN-2 pero no en GEN-3. Los ~5 productos GEN-3 YA tienen snapshots con `presentacion: ""` en ventas/OCs nuevas. |
| Contaminacion C-1 en grupos | `grupoVarianteId === docId` en algunos productos legacy. `getVariantes()` en producto.service.ts:688 ya maneja esto con fallback pero es fragil. |
| WhatsApp busqueda parcial | Productos GEN-3 sin `presentacion` ya no matchean busquedas por tipo de presentacion en WhatsApp. |

### 2.2 Brechas que el cutover ELIMINA (mejoras)

| Mejora | Detalle |
|--------|---------|
| Shape unificado | 212 productos con estructura consistente. Se elimina la logica de 3 generaciones. |
| `contenidoNeto` estructurado | Permite calculos automaticos (duracion envase, comparacion entre variantes, filtros por tipo de unidad). |
| `grupoVarianteId` normalizado | Todos los grupos con UUID real, no docId. Queries de variantes sin fallback. |
| Campos fantasma eliminados | `costoFleteInternacional`, `esPadre`, `parentId`, etc. ya no confunden a desarrolladores ni a queries. |
| `varianteLabel` generado | Cada variante tiene un label display ("90 capsulas", "50 ml") util para selectores de venta. |

### 2.3 Brechas que el cutover puede DEGRADAR temporalmente

| Degradacion | Duracion | Severidad |
|-------------|----------|-----------|
| Snapshots de venta/OC/cotizacion con `presentacion: ""` | Hasta deploy de `buildProductoSnapshot` actualizado | ALTA si no se deploya simultaneamente |
| WhatsApp sin match por presentacion | Hasta deploy de functions actualizado | MEDIA |
| Analytics de marca con campos vacios | Hasta actualizar analytics services | BAJA (no bloquea operacion) |
| Inventario sin filtro por grupo | Hasta actualizar inventario service | BAJA |
| PDF cotizacion sin info tecnica | Hasta deploy de `buildProductoSnapshot` | MEDIA (afecta percepcion del cliente final) |

---

## 3. PLAN DE COMUNICACION AL CLIENTE

### T-3 dias: Aviso anticipado

**Canal:** WhatsApp grupo operaciones + email
**A quien:** Todo el equipo operativo (vendedores, comprador, almacenero, admin)
**Mensaje:**

> Equipo: el [FECHA] entre [HORA INICIO] y [HORA FIN] realizaremos una actualizacion mayor del modulo de Productos del ERP. La actualizacion mejora la estructura de datos de los 212 productos del catalogo, habilita el sistema de variantes (ej. mismo producto en 90, 180 y 360 capsulas) y prepara el terreno para el nuevo wizard de creacion de productos.
>
> Durante la ventana de ~45 minutos NO se podra: crear productos, crear ventas, crear cotizaciones, crear OCs ni crear envios. Las consultas de lectura pueden mostrar datos temporalmente incompletos.
>
> Mercado Libre seguira operando normalmente; las ordenes recibidas durante la ventana se procesaran automaticamente al reactivar el sistema.
>
> Si tienen preguntas, contactenme antes del [FECHA-1].

### T-1 dia: Recordatorio

**Canal:** WhatsApp grupo operaciones
**Mensaje:**

> Recordatorio: manana [FECHA] a las [HORA] inicia la ventana de mantenimiento del modulo Productos (~45 min).
>
> QUE NO HACER durante la ventana:
> - No crear/editar productos
> - No crear ventas, cotizaciones ni ordenes de compra
> - No registrar recepciones de envios
> - El bot de WhatsApp puede dar respuestas incompletas temporalmente
>
> QUE SI PUEDEN HACER:
> - Consultar ventas existentes, ver historial, revisar pagos registrados
> - Responder consultas de clientes que no requieran el ERP
>
> Les aviso cuando termine.

### T-30 min: Inicio inminente

**Canal:** WhatsApp grupo operaciones
**Mensaje:**

> Iniciando mantenimiento en 30 minutos. Si tienen algo urgente que crear en el ERP, haganlo ahora. A partir de las [HORA] el sistema entra en modo lectura.

### Durante ventana: Status updates cada 15 min

**Canal:** WhatsApp grupo operaciones

- **T+0:** "Mantenimiento iniciado. No operar el ERP. Estimado: 45 min."
- **T+15:** "Progreso: backup completado, validacion en curso. Todo normal."
- **T+30:** "Progreso: migracion completada, verificando integridad. Quedan ~15 min."

### T+65 min: Confirmacion de exito

**Canal:** WhatsApp grupo operaciones + email
**Mensaje:**

> Mantenimiento completado exitosamente. El ERP esta operativo.
>
> QUE CAMBIO:
> 1. Los productos ahora tienen una estructura de datos mejorada
> 2. La informacion de presentacion (capsulas, ml, tabletas) se muestra de forma estandarizada
> 3. El wizard de variantes estara disponible proximamente (les avisare cuando)
> 4. Las ventas, cotizaciones y OCs funcionan exactamente igual
>
> Si notan algo raro (producto sin nombre, dato faltante, error al buscar), envienme un screenshot al privado con el nombre del producto. Tenemos respaldo completo para corregir cualquier caso.

### Plan B: Mensaje de rollback

**Canal:** WhatsApp grupo operaciones
**Mensaje:**

> La actualizacion presento un problema. Estamos restaurando la version anterior del catalogo. El ERP estara disponible en ~15 minutos adicionales. Les aviso cuando este listo. Disculpen el inconveniente.

---

## 4. UX IMPACT DURANTE LA VENTANA POR ROL

### Vendedor

| Accion | Estado durante ventana |
|--------|----------------------|
| Buscar producto para venta | DEGRADADO: puede mostrar datos incompletos a mitad de migracion |
| Crear venta | BLOQUEADO: snapshot puede persistir datos corruptos |
| Crear cotizacion | BLOQUEADO: misma razon |
| Consultar ventas existentes | OK: los datos historicos no cambian |
| Ver historial de pagos | OK: modulo independiente |

**Recomendacion:** no usar el ERP durante la ventana. Tiempo real de bloqueo: ~45 min.

### Comprador

| Accion | Estado durante ventana |
|--------|----------------------|
| Crear orden de compra | BLOQUEADO: snapshot degradado |
| Consultar OCs existentes | OK: datos historicos intactos |
| Ver pipeline de compras | OK: lee de coleccion `ordenesCompra`, no de `productos` |

### Almacenero

| Accion | Estado durante ventana |
|--------|----------------------|
| Recibir envio / generar unidades | BLOQUEADO: el envio leeria productos a mitad de migracion |
| Consultar inventario | DEGRADADO: puede mostrar `productoGrupo` vacio temporalmente |
| Escanear codigo de barras | OK si solo lee: `getByCodigoUPC()` busca por UPC que no cambia |

### Admin

| Accion | Estado durante ventana |
|--------|----------------------|
| Editar producto | BLOQUEADO: conflicto con la migracion |
| Ver listado de productos | DEGRADADO: datos inconsistentes durante el apply |
| Dashboards / analytics | DEGRADADO: metricas temporalmente incorrectas |

### Cliente final ML

| Accion | Estado durante ventana |
|--------|----------------------|
| Comprar en Mercado Libre | OK: la compra se registra en ML. El webhook queda en cola. |
| Recibir confirmacion de compra | DELAY: el webhook se procesa cuando se reactiva (~T+40). Retraso maximo: 45 min en la confirmacion interna. ML envia su propia confirmacion al comprador de forma independiente. |

---

## 5. PROCESOS QUE REQUIEREN AJUSTE POST-CUTOVER

### 5.1 `buildProductoSnapshot` — Fuente unica de snapshots

**Cambio:** debe derivar `presentacion` desde `contenidoNeto` cuando el campo top-level no exista.
**Logica propuesta:** `presentacion = producto.presentacion || (producto.contenidoNeto ? \`${producto.contenidoNeto.valor} ${producto.contenidoNeto.unidad}\` : '')`.
**Impacto:** afecta TODA la cadena O2C y P2P. Es el cambio mas critico.
**Capacitacion:** ninguna (transparente para el usuario).
**Documentacion:** actualizar comentario del helper.

### 5.2 `getDescripcionProducto` — Descripcion inline de producto

**Cambio:** la funcion lee `p.presentacion`, `p.dosaje`, `p.contenido`, `p.sabor`. Post-migracion, para SUP estos campos top-level desaparecen. Debe leer desde `p.contenidoNeto`, `p.atributosSuplementos.dosaje`, `p.atributosSuplementos.sabor`.
**Impacto:** cards de producto, tablas, buscadores.
**Capacitacion:** ninguna.

### 5.3 `formatProductName` en WhatsApp ERP

**Cambio:** `whatsapp.erp.ts:1483-1496` debe derivar variantes desde `contenidoNeto` + `atributosSuplementos`.
**Impacto:** respuestas de stock/precio del bot.
**Capacitacion:** ninguna (backend change).
**Deploy:** simultaneo con la migracion (functions).

### 5.4 ML Order Processor

**Cambio:** `ml.orderProcessor.ts:497` lee `prodData.presentacion`. Debe incluir fallback a `contenidoNeto`.
**Deploy:** simultaneo con la migracion (functions).

### 5.5 PDF de cotizacion — Info tecnica

**Cambio:** `cotizacionPdf.service.ts:242-244` lee `producto.presentacion`, `producto.contenido`, `producto.dosaje` del snapshot de la cotizacion. Cotizaciones NUEVAS post-cutover llevaran el nuevo formato via `buildProductoSnapshot` corregido. Cotizaciones EXISTENTES conservan sus snapshots originales y no se ven afectadas.
**Capacitacion:** ninguna.

### 5.6 Analytics services

**Cambio:** `marca.analytics.service.ts` y `competidor.analytics.service.ts` leen `producto.grupo`, `producto.subgrupo`, `producto.presentacion`, etc. Necesitan migrarse a V2.
**Urgencia:** baja. Pueden funcionar con datos degradados (string vacio, undefined) sin crashear.

### 5.7 Inventario — Filtros por grupo

**Cambio:** `inventarioService` usa `producto.grupo` para `productoGrupo`. Reemplazar con derivacion desde `tipoProductoId`.
**Urgencia:** media. El filtro deja de funcionar pero el inventario base sigue correcto.

### 5.8 Busqueda en WhatsApp — fullText

**Cambio:** `whatsapp.erp.ts:153` concatena `presentacion` en el texto de busqueda. Debe concatenar `contenidoNeto.valor` + `contenidoNeto.unidad`.
**Urgencia:** alta (afecta busquedas del usuario final).

---

## 6. KPIs DE NEGOCIO A MONITOREAR POST-CUTOVER (7 DIAS)

| KPI | Baseline esperado | Senal de alerta | Como medir |
|-----|-------------------|-----------------|------------|
| Tasa de creacion de productos/dia | ~1-2/dia (historico) | 0 productos en 3 dias (indica bloqueo UX) | Query `productos` por `creadoEn > cutover_date` |
| Errores en wizard V2 | 0 (ideal) | >3 errores/dia por validacion inesperada | Logs de browser + feedback del equipo |
| Tiempo promedio de creacion | ~3-5 min (estimado con wizard V2) | >10 min consistentemente | Diferencia entre `creadoEn` y timestamp de inicio de sesion |
| Uso del wizard de variantes | 0 inicialmente (es nuevo) | N/A primera semana | Contar productos con `grupoVarianteId` creados post-cutover |
| Productos sin `contenidoNeto` | 12-17 (WARN del dry-run) | >20 (indica parse fallido no detectado) | Query `productos where contenidoNeto == null` |
| Ventas ML procesadas correctamente | 100% | <95% (indica problema en el processor) | Comparar ordenes ML vs ventas creadas |
| Respuestas WhatsApp con info completa | 100% | Reportes de usuario sobre "producto sin datos" | Revision manual de logs del bot |

---

## 7. RIESGOS DE NEGOCIO IDENTIFICADOS

### RN-001: Snapshots de transacciones con presentacion vacia

- **Probabilidad:** ALTA si no se actualiza `buildProductoSnapshot` antes del deploy
- **Impacto:** ALTO. Toda venta, cotizacion y OC creada post-cutover tendra `presentacion: ""`. Los PDFs de cotizacion no mostraran info tecnica. Los snapshots son inmutables.
- **Mitigacion:** actualizar `buildProductoSnapshot` y desplegarlo como parte del cutover. Es la accion mas critica de todo el plan.

### RN-002: WhatsApp bot con respuestas degradadas

- **Probabilidad:** ALTA si no se actualiza `whatsapp.erp.ts` simultaneamente
- **Impacto:** MEDIO. El cliente final recibe respuestas como "Omega 3" en lugar de "Omega 3 (capsulas 60 capsulas 500mg)". No pierde funcionalidad pero pierde contexto.
- **Mitigacion:** deploy de functions simultaneo con la migracion.

### RN-003: Ventas ML con snapshot incompleto

- **Probabilidad:** ALTA si no se actualiza `ml.orderProcessor.ts`
- **Impacto:** MEDIO. Las ventas automaticas se crean pero con `presentacion: ""`. Afecta trazabilidad y reportes de venta.
- **Mitigacion:** deploy de functions simultaneo.

### RN-004: Perdida de continuidad operativa durante ventana

- **Probabilidad:** BAJA (45 min en horario bajo)
- **Impacto:** BAJO. No hay pedidos urgentes a las 2am.
- **Mitigacion:** horario de cutover en baja actividad (madrugada o domingo).

### RN-005: Resistencia al cambio del equipo

- **Probabilidad:** BAJA (cambios son mayormente transparentes)
- **Impacto:** BAJO. El unico cambio visible es que `varianteLabel` aparece en selectores. El wizard de variantes es NUEVO (no reemplaza nada conocido).
- **Mitigacion:** comunicacion clara T-3 y T+65. El equipo no necesita reentrenarse: el flujo de venta/cotizacion es identico.

### RN-006: Reportes historicos no comparables

- **Probabilidad:** MEDIA
- **Impacto:** BAJO. Los dashboards de analytics por `grupo`/`subgrupo` dejan de funcionar para productos que perdieron esos campos. Pero los snapshots en ventas historicas conservan los datos originales.
- **Mitigacion:** mantener `grupo`/`subgrupo` en allowlist de la migracion (solo se borran si existe `tipoProductoId`). Actualizar analytics services en sprint siguiente.

### RN-007: Producto critico para venta queda sin contenidoNeto

- **Probabilidad:** BAJA (el dry-run identifica los ~12-17 productos con WARN)
- **Impacto:** MEDIO. Un producto best-seller sin `contenidoNeto` aparece como "Omega 3" sin presentacion en ventas.
- **Mitigacion:** revisar la lista de WARN del dry-run. Priorizar correccion manual (via editor V2) de los 5 productos mas vendidos que caigan en WARN.

---

## 8. RESUMEN DE ACCIONES CRITICAS PRE-DEPLOY

| Prioridad | Accion | Archivo | Bloquea cutover |
|-----------|--------|---------|-----------------|
| P0 | Actualizar `buildProductoSnapshot` con fallback a `contenidoNeto` | `src/utils/producto.helpers.ts` | SI |
| P0 | Actualizar `getDescripcionProducto` con fallback V2 | `src/utils/producto.helpers.ts` | SI |
| P0 | Actualizar `getSearchableProductText` con fallback V2 | `src/utils/producto.helpers.ts` | SI |
| P0 | Actualizar `ml.orderProcessor.ts` presentacion fallback | `functions/src/mercadolibre/ml.orderProcessor.ts` | SI |
| P0 | Actualizar `whatsapp.erp.ts` busqueda + formatProductName | `functions/src/whatsapp/whatsapp.erp.ts` | SI |
| P1 | Actualizar `cotizacionPdf.service.ts` info tecnica | `src/services/cotizacionPdf.service.ts` | No (degrada PDF) |
| P1 | Actualizar `inventarioService` grupo → tipoProducto | `src/services/inventario.service.ts` | No (degrada filtro) |
| P2 | Actualizar `marca.analytics.service.ts` campos V2 | `src/services/marca.analytics.service.ts` | No (degrada reporte) |
| P2 | Actualizar `competidor.analytics.service.ts` grupo | `src/services/competidor.analytics.service.ts` | No (degrada reporte) |
