# PLAN EJECUTABLE — Reingenieria Compras-Envios-Inventario-Costos
# BusinessMN v2 — Vitaskin Peru

**Fecha:** 2026-04-10
**Autor:** Squad de 8 agentes + Orquestador
**Aprobacion requerida de:** Product Owner (Jose)
**Estrategia:** Incremental por capas (NO Big Bang)
**Estimacion total:** 14-19 sesiones / 88-130 horas
**Prerequisito:** BD limpia (sin datos transaccionales, solo maestros)

---

## RESUMEN DE LA REINGENIERIA

### Que cambia
- 7 colecciones Firestore modificadas + 6 colecciones nuevas + 2 deprecadas
- Renaming masivo: almacen->casilla, transferencia->envio (~3,000 ocurrencias en ~160 archivos)
- Eliminacion de GA/GD/GV/GO como nomenclatura -> 2 conceptos: "Costo por Venta" + "Gasto Fijo del Mes"
- CTRU simplificado: solo precio producto + costos de importacion (sin prorrateo de gastos del periodo)
- Pool USD fusionado con Tesoreria (vista agregada, no entidad separada)
- OC con Sub-Ordenes + cargos/descuentos del proveedor
- Envios obligatorios para toda OC (no hay recepcion directa)
- Unidades nacen al confirmar OC (estado `pedida`)
- Red Logistica unificada (Colaboradores + Casillas)
- Tarjetas de credito como pasivos
- Pool de Insumos de empaque + Kits por peso
- 3 niveles de rentabilidad (Margen Bruto / Contribucion / Operativo)
- Categorias de costos/gastos dinamicas (maestro editable)
- Prorrateo flexible (3 metodos: fijo/variado/total por peso o valor)

### 53 acuerdos tomados con el Product Owner (debate cerrado)
### 4 decisiones de agentes (todas cerradas)
### 8 reportes de agentes procesados

---

## FASE 0 — LIMPIEZA Y PREPARACION (1 sesion, 4-6h)

### Objetivo
Dejar la BD limpia de datos transaccionales para que el refactor parta de cero.

### Checklist

- [ ] 0.1 Verificar backup PITR activo (7 dias) + backup semanal
- [ ] 0.2 Crear script `scripts/reingenieria/00-limpieza-total.mjs`:
  - Eliminar TODAS las ordenes de compra
  - Eliminar TODAS las transferencias
  - Eliminar TODAS las unidades
  - Eliminar TODOS los gastos tipo importacion (flete_internacional, recojo_local, almacenaje, internacion)
  - Eliminar TODOS los movimientos de Pool USD
  - Eliminar TODOS los movimientos de tesoreria vinculados a OC/transferencias
  - Eliminar almacen virtual ALM-CN-001 Asian Beauty
  - Resetear contadores secuenciales (OC, TRF/ENV, unidades)
  - Resetear metricas de proveedores, marcas, categorias a 0
  - Resetear saldos de cuentas de caja a 0
- [ ] 0.3 Ejecutar script en produccion
- [ ] 0.4 Verificar BD limpia: solo quedan productos, clientes, proveedores, marcas, categorias, config, usuarios
- [ ] 0.5 Verificar que la app navega sin errores tras la limpieza

### Go/No-Go
- BD limpia confirmada
- App navega sin crash
- Backup PITR verificado

---

## FASE 1 — MODELO DE DATOS: TIPOS + COLECCIONES + RULES (2-3 sesiones, 12-20h)

### Objetivo
Crear la estructura de datos nueva (tipos TypeScript, colecciones Firestore, reglas de seguridad, indices).

### Checklist — Tipos nuevos

- [ ] 1.1 Crear `src/types/casilla.types.ts` (reemplaza almacen.types.ts)
  - Interface `Casilla` con `colaboradorId`, `esPrincipal`, sin `esViajero`
  - Eliminar `TipoAlmacen`, crear `TipoCasilla`
  - Mantener `PaisAlmacen` como `PaisCasilla`
  - Mantener `PAISES_CONFIG`
- [ ] 1.2 Crear `src/types/colaborador.types.ts`
  - Interface `Colaborador` con `tipo: 'empresa' | 'viajero' | 'courier_externo' | 'transportista_local'`
  - Interface `MetricasColaborador`
  - Interface `TarifasColaborador`
- [ ] 1.3 Crear `src/types/envio.types.ts` (reemplaza transferencia.types.ts)
  - Interface `Envio` con `origenTipo`, `origenProveedorId`, `transportadorId`, `costosLanded[]`
  - Interface `CostoLanded` con `tipo`, `monto`, `moneda`, `metodoProrrateo`
  - Type `EstadoEnvio`: borrador, confirmado, en_transito, retenida_aduana, recibida_parcial, recibida_completa, perdida_total, cancelada
  - Type `MetodoProrrateo`: 'fijo_por_unidad' | 'variado_por_producto' | 'total_por_peso' | 'total_por_valor'
- [ ] 1.4 Actualizar `src/types/ordenCompra.types.ts`
  - Agregar `SubOrdenCompra`, `CargoOC`, `DescuentoOC`
  - Agregar `tcReferencial`
  - Agregar `EstadoOrden` nuevos: confirmada, en_proceso, despachada, completada
  - Eliminar `modoEntrega`, `fleteIncluidoEnPrecio`
- [ ] 1.5 Actualizar `src/types/unidad.types.ts`
  - Nuevo `EstadoUnidad`: pedida, en_transito, disponible, reservada, asignada_venta, vendida + danada, perdida, retenida_aduana
  - Eliminar: recibida_origen, en_transito_origen, en_transito_peru, disponible_peru
  - Renombrar `almacenActualId` -> `casillaActualId`
  - Eliminar `costoGAGOAsignado`, `costoGAAsignado`, `costoGOAsignado`
- [ ] 1.6 Crear `src/types/categoriaCosto.types.ts`
  - Interface `CategoriaCosto` con `bloque: 'importacion' | 'venta' | 'periodo'`, `categoriaPadreId?`
- [ ] 1.7 Crear `src/types/insumo.types.ts` + `kitEmpaque.types.ts`
- [ ] 1.8 Crear `src/types/tarjetaCredito.types.ts`
- [ ] 1.9 Actualizar `src/types/gasto.types.ts`
  - Eliminar `CategoriaGasto` (GV/GD/GA/GO)
  - Eliminar `ClaseGasto` (GVD/GAO)
  - Eliminar `impactaCTRU`, `esProrrateable`, `tipoCosto`, `asignacion`
  - Reemplazar `TipoGasto` por referencia a `categoriaCostoId` (dinamico)
  - Renombrar conceptualmente a `GastoPeriodo`
- [ ] 1.10 Actualizar `src/types/venta.types.ts`
  - Agregar `costosVenta: CostoVenta[]`
  - Interface `CostoVenta` con `categoriaCostoId`, `monto`, `montoPEN`

### Checklist — Colecciones Firestore

- [ ] 1.11 Actualizar `src/config/collections.ts`:
  - Agregar: CASILLAS, COLABORADORES, ENVIOS, CATEGORIAS_COSTOS, INSUMOS, KITS_EMPAQUE, TARJETAS_CREDITO
  - Deprecar: ALMACENES, TRANSFERENCIAS, POOL_USD_MOVIMIENTOS, POOL_USD_SNAPSHOTS
- [ ] 1.12 Actualizar `firestore.rules`:
  - Agregar reglas para 7 colecciones nuevas
  - Mantener reglas de colecciones deprecadas temporalmente
- [ ] 1.13 Actualizar `firestore.indexes.json`:
  - Agregar indices para casillas, envios, colaboradores, unidades (casillaActualId+estado)
  - Eliminar indice almacenActualId+estado

### Checklist — Seed de datos maestros

- [ ] 1.14 Script `scripts/reingenieria/01-seed-colaboradores.mjs`:
  - Crear Vitaskin Peru (tipo: empresa)
  - Migrar viajeros existentes a colaboradores
  - Crear couriers externos conocidos (DHL, etc.)
  - Migrar transportistas locales a colaboradores
- [ ] 1.15 Script `scripts/reingenieria/02-seed-casillas.mjs`:
  - Migrar almacenes existentes a casillas con colaboradorId
  - Eliminar ALM-CN-001
  - Asignar esPrincipal a ALM-PE-001
- [ ] 1.16 Script `scripts/reingenieria/03-seed-categorias-costos.mjs`:
  - Pre-poblar categorias de importacion (Transporte, Aranceles, Seguros, Manipuleo)
  - Pre-poblar categorias de venta (Comisiones, Distribucion, Empaque, Marketing directo)
  - Pre-poblar categorias de periodo (Personal, Local, Profesionales, Tecnologia, Operativos, Financieros, Marketing general)
  - Con sub-categorias detalladas

### Checklist — Verificacion

- [ ] 1.17 `tsc --noEmit` pasa sin errores
- [ ] 1.18 Colecciones nuevas accesibles desde consola Firebase
- [ ] 1.19 Datos seed correctos en Firestore

### Go/No-Go
- Compilacion limpia
- Todas las colecciones nuevas con reglas y datos seed
- Indices desplegados

---

## FASE 1.5 — SPLIT DE GOD-SERVICES (1 sesion, 6-8h)

### Objetivo
Dividir servicios grandes ANTES del renaming para facilitar el refactor.

### Checklist

- [ ] 1.5.1 Split `transferencia.service.ts` (1,592 lineas) en 3:
  - `transferencia.crud.service.ts` (CRUD basico)
  - `transferencia.recepcion.service.ts` (logica de recepcion)
  - `transferencia.pagos.service.ts` (pagos a viajero)
  - Barrel `transferencia.service.ts` que re-exporta todo (backward compat temporal)
- [ ] 1.5.2 Verificar que todos los importadores siguen funcionando
- [ ] 1.5.3 Eliminar codigo muerto:
  - `CuentaCajaForm.tsx`
  - Funciones deprecated en ctru.service.ts
  - Migrar `InvestigacionModal.tsx` de `ProveedorUSAList` -> `ProveedorOrigenList`
- [ ] 1.5.4 Centralizar magic strings de estados de unidad (usar constantes existentes)

### Go/No-Go
- Compilacion limpia
- App navega sin errores

---

## FASE 2 — RENAMING MASIVO (2 sesiones, 10-16h)

### Objetivo
Renombrar almacen->casilla y transferencia->envio en todo el codigo.

### Checklist

- [ ] 2.1 Renombrar archivos de tipos: `almacen.types.ts` -> `casilla.types.ts`, `transferencia.types.ts` -> `envio.types.ts`
- [ ] 2.2 Renombrar archivos de servicios: `almacen.service.ts` -> `casilla.service.ts`, `transferencia.*.service.ts` -> `envio.*.service.ts`
- [ ] 2.3 Renombrar archivos de stores: `almacenStore.ts` -> `casillaStore.ts`, `transferenciaStore.ts` -> `envioStore.ts`
- [ ] 2.4 Renombrar carpetas de paginas: `pages/Transferencias/` -> `pages/Envios/`
- [ ] 2.5 Renombrar carpetas de componentes: `components/modules/almacen/` -> `components/modules/casilla/`
- [ ] 2.6 Actualizar TODOS los imports en ~160 archivos (search & replace controlado)
- [ ] 2.7 Actualizar `multiOrigen.helpers.ts` y su test
- [ ] 2.8 Actualizar prefijos de secuencia: TRF- -> ENV-, ALM- -> CAS-, VIA- -> COL-
- [ ] 2.9 Actualizar rutas en `App.tsx` y `Sidebar.tsx`: /transferencias -> /envios
- [ ] 2.10 Limpiar 247 console.log -> usar logger.ts
- [ ] 2.11 Renombrar estados de asignacion en RequerimientoDetailModal: `en_almacen_usa` / `en_almacen_origen` -> nuevos nombres
- [ ] 2.12 Verificacion: `grep -r "almacen\|Almacen\|transferencia\|Transferencia" src/` devuelve 0 (excepto comentarios de migracion)
- [ ] 2.13 Verificacion: `grep -r "GA\|GO\|GV\|GD\|CategoriaGasto\|ClaseGasto" src/` identificar TODAS las ocurrencias para Fase 3

### Go/No-Go
- `tsc --noEmit` pasa
- App compila y navega sin crash
- Grep confirma 0 referencias viejas

---

## FASE 3 — SERVICIOS Y LOGICA DE NEGOCIO (3-4 sesiones, 20-28h)

### Objetivo
Implementar la logica nueva en servicios: CTRU, OC, Envios, Pool USD, costos.

### Checklist — CTRU

- [ ] 3.1 Refactorizar `ctru.utils.ts`:
  - Eliminar `calcularGAGOProporcional()`
  - Simplificar `getCTRU()`: precio + costos landed (sin GA/GO)
  - Simplificar `getCostoBasePEN()`: sin costoGAGOAsignado
  - Mantener `getCTRU_Real()` con TCPA
- [ ] 3.2 Refactorizar `ctru.service.ts`:
  - Eliminar lectura de gastos GA/GO
  - Eliminar prorrateo de gastos al CTRU
  - CTRU = precio producto (de OC) + costos landed (de Envio) prorrateados
  - Actualizar `ACTIVE_STATES` con nuevos estados

### Checklist — Ordenes de Compra

- [ ] 3.3 Refactorizar `ordenCompra.crud.service.ts`:
  - Al confirmar OC: crear N unidades en estado `pedida` con `casillaActualId` = ubicacion virtual del proveedor
  - Al confirmar OC: crear Envio T1 automaticamente en estado `borrador`
  - Soporte para SubOrdenes: cada sub-orden genera su propio Envio T1
  - Soporte para cargosOC[] y descuentosOC[] con prorrateo por valor
  - Nuevos estados: borrador -> confirmada -> en_proceso -> despachada -> completada
- [ ] 3.4 Deprecar `ordenCompra.recepcion.service.ts` completamente

### Checklist — Envios

- [ ] 3.5 Crear `envio.crud.service.ts`:
  - CRUD basico de envios con origen polimorfico (proveedor | casilla)
  - Soporte para costosLanded[] con categorias dinamicas
  - Prorrateo flexible: 3 metodos (fijo/variado/total por peso o valor)
  - Al recibir envio: actualizar CTRU de unidades con costos prorrateados
  - Al recibir envio: mover unidades a `disponible` en casilla destino
  - Estados: borrador -> confirmado -> en_transito -> retenida_aduana -> recibida_completa/parcial
- [ ] 3.6 Crear `envio.recepcion.service.ts`:
  - Recepcion con escaner opcional + fechas vencimiento
  - Validacion estado (OK/danada/perdida)
  - Gestion de unidades retenidas en aduana
- [ ] 3.7 Crear `envio.pagos.service.ts`:
  - Pago a viajero/courier vinculado al envio
  - Integracion con modulo unificado de pagos

### Checklist — Pool USD -> Tesoreria

- [ ] 3.8 Refactorizar Pool USD como vista agregada:
  - TCPA se calcula desde movimientos de cuentas USD en Tesoreria
  - Eliminar colecciones poolUSDMovimientos y poolUSDSnapshots (archivar)
  - Pantalla de Rendimiento Cambiario lee de Tesoreria
  - Diferencial cambiario 360: OC, Envio, Venta, cierre mensual

### Checklist — Gastos del Periodo

- [ ] 3.9 Refactorizar `gasto.service.ts`:
  - Eliminar tipos de importacion (flete_internacional, recojo_local, etc.)
  - Eliminar flags impactaCTRU, esProrrateable
  - Todos los gastos son "Gasto Fijo del Mes" con categoriaCostoId
  - Coleccion renombrada conceptualmente a gastosPeriodo

### Checklist — Costos por Venta

- [ ] 3.10 Agregar costosVenta[] a `venta.service.ts`:
  - Comision ML, delivery, empaque via kit
  - Cada costo referencia categoriaCostoId

### Checklist — Hooks compartidos (hallazgo auditoria)

- [ ] 3.10b Refactorizar `useRentabilidadVentas` hook:
  - Eliminar estructura GA/GO
  - Adaptar a categorias dinamicas
  - Verificar impacto en Ventas.tsx y Reportes.tsx

### Checklist — Servicios nuevos

- [ ] 3.11 Crear `colaborador.service.ts` (CRUD + metricas)
- [ ] 3.12 Crear `categoriaCosto.service.ts` (CRUD + arbol padre/hijo)
- [ ] 3.13 Crear `insumo.service.ts` (pool de insumos, entradas/salidas, stock)
- [ ] 3.14 Crear `kitEmpaque.service.ts` (seleccion por peso, consumo de insumos)
- [ ] 3.15 Crear `tarjetaCredito.service.ts` (pasivos, estados de cuenta, pago al banco)
- [ ] 3.16 Crear `subOrden.service.ts` (division de OC en sub-ordenes)

### Checklist — Integracion TAREA-099 (trazabilidad ubicacion)

- [ ] 3.17 Campo `casillaActualId` en unidades siempre actualizado
- [ ] 3.18 `movimientos[]` en unidad registra cada transicion con casilla/estado/fecha

### Go/No-Go
- Flujo OC completo funciona con nuevo modelo
- CTRU calcula correctamente sin GA/GO
- Pool USD opera desde Tesoreria
- Envio obligatorio funciona end-to-end

---

## FASE 4 — CLOUD FUNCTIONS (1-2 sesiones, 8-12h)

### Objetivo
Actualizar triggers y funciones serverless al nuevo modelo.

### Checklist

- [ ] 4.1 Reescribir `onOrdenCompraRecibida`:
  - Cambiar trigger a `estado === 'confirmada'`
  - Crear unidades en estado `pedida` (si no se hizo desde frontend)
  - O deprecar completamente si la creacion se hace 100% desde frontend
- [ ] 4.2 Deprecar `poolUSDSnapshotMensual` (Pool USD ya no tiene coleccion propia)
- [ ] 4.3 Actualizar queries ML:
  - `ml.stock.ts`: cambiar `disponible_peru` -> `disponible`
  - `ml.orderProcessor.ts`: actualizar switch de estados
- [ ] 4.4 Actualizar triggers de metricas: almacenId -> casillaId
- [ ] 4.5 Agregar reglas Firestore para colecciones nuevas (si no se hizo en Fase 1)
- [ ] 4.6 `firebase deploy --only functions` exitoso
- [ ] 4.7 Verificar triggers con test manual

### Go/No-Go
- Deploy functions exitoso
- ML stock sincroniza correctamente
- Triggers disparan sin errores

---

## FASE 5 — UI Y NAVEGACION (2-3 sesiones, 14-20h)

### Objetivo
Implementar las paginas nuevas y actualizar las existentes.

### Checklist — Paginas nuevas/rediseñadas

- [ ] 5.1 Red Logistica en Maestros (reemplaza Viajeros + Almacenes)
  - 4 secciones: Empresa, Viajeros, Couriers Externos, Transportistas Locales
  - Casillas agrupadas bajo cada colaborador
  - Boton "+ Agregar" con opciones por tipo
- [ ] 5.2 Pagina Envios (reemplaza Transferencias)
  - Tabla con iconos de tipo origen (proveedor/casilla/almacen propio)
  - Filtros: Desde Proveedor / Desde Casilla / Internas / Por recibir / Recibidas
  - Tarjeta de detalle con costosLanded
- [ ] 5.3 Wizard OC con Sub-Ordenes + cargos/descuentos
  - Paso 1: Proveedor + linea de negocio
  - Paso 2: Productos
  - Paso 3: Cargos y descuentos del proveedor
  - Paso 4: Como llega + division en Sub-Ordenes (si aplica)
  - Paso 5: Confirmacion
- [ ] 5.4 RecepcionEnvioModal con escaner + fechas vencimiento
- [ ] 5.5 Insumos de Empaque en Maestros (catalogo + kits por peso)
- [ ] 5.6 Tarjetas de Credito en Tesoreria (pasivos con saldo/limite)
- [ ] 5.7 Categorias de Costos en Maestros (arbol dinamico editable)

### Checklist — Paginas actualizadas

- [ ] 5.8 Dashboard: integrar 3 niveles de rentabilidad, renombrar `almacenNombre` -> `casillaNombre` en StockCriticoItem
- [ ] 5.9 Tesoreria: Pool USD como widget/resumen (no tab separado), `pago_viajero` -> `pago_colaborador`
- [ ] 5.10 Reportes: tab directo/indirecto + P&L 3 niveles, eliminar labels GA/GO hardcodeados
- [ ] 5.11 Integrar TAREA-098 (contenido tabs CxC/CxP)
- [ ] 5.12 Proyeccion: redisenar graficos — eliminar labels GA/GO/GV/GD hardcodeados, usar categorias dinamicas
- [ ] 5.13 Contabilidad: actualizar labels `GV + GD` y `GA + GO` en StatDistribution
- [ ] 5.14 CotizacionForm: actualizar logica multi-almacen (`almacenId` -> `casillaId` en disponibilidad)
- [ ] 5.15 OrdenesCompra: refactorizar flujo multi-viajero -> multi-colaborador (~270 lineas de estado local)
- [ ] 5.16 Inventario: redisenar pipeline stages (eliminar estados viejos, nuevos estados)
- [ ] 5.17 Unidades: redisenar pipeline stages y filtros (misma logica que Inventario)
- [ ] 5.18 Escaner: tab "Transferencia" -> "Envio", subtitle "entre almacenes" -> "entre casillas", ModoTransferencia -> ModoEnvio
- [ ] 5.19 Sidebar reestructurado:
  - "Envios" en vez de "Transferencias"
  - "Gastos Fijos" en vez de "Gastos"
  - Verificar navegacion completa

### Checklist — Stores nuevos

- [ ] 5.13 Crear `colaboradorStore.ts`
- [ ] 5.14 Crear `insumoStore.ts`
- [ ] 5.15 Crear `tarjetaCreditoStore.ts`
- [ ] 5.16 Crear `categoriaCostoStore.ts`
- [ ] 5.17 Actualizar `envioStore.ts` (ex-transferenciaStore)
- [ ] 5.18 Actualizar `casillaStore.ts` (ex-almacenStore)
- [ ] 5.19 Fusionar `poolUSDStore` en `tesoreriaStore`

### Go/No-Go
- Todas las paginas navegan sin error
- Sidebar muestra nueva estructura
- Formularios crean/editan/eliminan correctamente

---

## FASE 6 — FINANZAS, EMPAQUES Y DASHBOARD (2 sesiones, 12-16h)

### Objetivo
Implementar modulos financieros avanzados y dashboard de rentabilidad.

### Checklist

- [ ] 6.1 Tarjeta de credito operativa:
  - Crear tarjeta, registrar compra como pasivo, pagar al banco desde Pool USD
  - Diferencial cambiario entre dia de compra y dia de pago
- [ ] 6.2 Dashboard 3 niveles de rentabilidad:
  - Cascada (waterfall): Venta -> -CTRU -> -Costos Venta -> -Gastos Fijos -> Resultado
  - Tabla semaforo por SKU: Margen Bruto %, Contribucion %, Utilidad/unidad
  - Matriz 2x2: rotacion x margen contribucion (estrella/vaca/dilema/perro)
  - Comparativo canal: ML vs venta directa con margen contribucion
  - Break-even mensual: gauge de ventas acumuladas vs punto equilibrio
- [ ] 6.3 Reporte directo/indirecto:
  - Costos directos (importacion + venta) vs indirectos (periodo)
  - Ratio directo/indirecto por mes
- [ ] 6.4 Pool de insumos operativo:
  - Registro de compra de insumos -> entrada al pool
  - Kits por peso con seleccion automatica al despachar
  - Consumo automatico de insumos al confirmar despacho
  - Costo de kit como "Costo por Venta" en la venta
- [ ] 6.5 Diferencial cambiario 360:
  - Widget "Impacto FX del mes" en Dashboard
  - TC referencial vs TC real en cada OC
  - Impacto por envio
  - Revaluacion mensual integrada

### Go/No-Go
- Tarjeta de credito registrable y pagable
- 3 niveles de rentabilidad visibles
- Kit de empaque consume insumos correctamente
- Diferencial cambiario visible en OC/Envio/Venta

---

## FASE 7 — INTEGRACION Y SMOKE TEST (1-2 sesiones, 8-12h)

### Objetivo
Verificar que todo funciona end-to-end y corregir cualquier issue.

### Checklist — Flujos E2E

- [ ] 7.1 Flujo Amazon viajero completo:
  OC borrador -> confirmar -> unidades pedida -> T1 Amazon->Angie auto -> confirmar T1 -> Angie recibe -> T2 manual Angie->Lima -> Jose viaja -> recepcion con escaner -> CTRU congelado -> venta con 3 margenes
- [ ] 7.2 Flujo DDP courier completo:
  OC borrador -> confirmar -> T1 auto con courier DHL -> en transito -> recepcion directa en ALM-PE-001 -> CTRU congelado
- [ ] 7.3 Flujo con aduana:
  Envio en transito -> retenida aduana -> pago impuesto (costo landed) -> liberacion -> recepcion
- [ ] 7.4 Flujo con perdida:
  Envio en transito -> perdida total -> gasto extraordinario -> unidades `perdida`
- [ ] 7.5 Flujo con Sub-Ordenes:
  OC 20 productos -> dividir en 3 sub-ordenes -> 3 envios independientes -> recepciones separadas
- [ ] 7.6 Flujo reserva desde requerimiento:
  Cotizacion con adelanto -> requerimiento reservado -> OC -> unidades nacen como `reservada`
- [ ] 7.7 Flujo tarjeta de credito:
  Compra con tarjeta -> pasivo -> pago al banco -> diferencial cambiario
- [ ] 7.8 Flujo empaques:
  Compra insumos -> venta con despacho -> kit por peso -> consumo automatico -> costo en venta

### Checklist — Verificaciones transversales

- [ ] 7.9 MercadoLibre: stock sincroniza correctamente con nuevos estados
- [ ] 7.10 CTRU: verificar con 3+ productos que numeros son correctos
- [ ] 7.11 Dashboard: 3 niveles de rentabilidad muestran datos coherentes
- [ ] 7.12 Reportes: P&L 3 niveles + directo/indirecto
- [ ] 7.13 Pool USD: TCPA calcula desde cuentas USD de Tesoreria
- [ ] 7.14 Sidebar: toda la navegacion funciona
- [ ] 7.15 Escaner: funciona con nuevo modelo de envios

### Checklist — Limpieza final

- [ ] 7.16 Eliminar colecciones deprecadas (almacenes, transferencias, poolUSDMovimientos)
- [ ] 7.17 Eliminar archivos de codigo muerto restantes
- [ ] 7.18 Actualizar MEMORY.md con estado post-reingenieria
- [ ] 7.19 Actualizar REGISTRO_IMPLEMENTACION.md
- [ ] 7.20 Deploy final a produccion

### Go/No-Go
- TODOS los flujos E2E funcionan sin intervencion manual en BD
- PO hace demo walkthrough y aprueba
- 0 errores en consola
- Deploy exitoso

---

## RIESGOS Y MITIGACIONES

| # | Riesgo | Prob | Impacto | Mitigacion |
|---|--------|------|---------|------------|
| R1 | Renaming incompleto (refs viejas en runtime) | ALTA | ALTO | Script grep post-renaming + prueba de cada coleccion |
| R2 | ML stock = 0 por estados no actualizados | MEDIA | CRITICO | Actualizar CF ML en Fase 4 antes de cualquier venta |
| R3 | Doble creacion de unidades (CF + frontend) | MEDIA | CRITICO | Desactivar CF antes de activar creacion en frontend |
| R4 | CTRU = 0 por filtro de estados viejos | MEDIA | ALTO | Actualizar ACTIVE_STATES en Fase 3 antes de probar CTRU |
| R5 | Firestore rules bloquean colecciones nuevas | BAJA | CRITICO | Desplegar rules en Fase 1 como primer paso |
| R6 | Context-switching entre fases (1 dev) | ALTA | MEDIO | 1 sesion = 1 fase. No mezclar. |
| R7 | Alcance se expande durante implementacion | ALTA | MEDIO | Congelar los 53 acuerdos. Nuevas ideas van a backlog post-reingenieria. |
| R8 | Pool USD + Tesoreria fusion rompe pagos | MEDIA | ALTO | Tests manuales de flujo completo en Fase 3 |

---

## TAREAS DEL BACKLOG

| Tarea | Decision | Fase |
|-------|----------|------|
| TAREA-098 (Tabs Reportes CxC/CxP) | Integrar | Fase 5 |
| TAREA-099 (Trazabilidad ubicacion) | Integrar | Fase 3 |
| TAREA-097 F2 (Proyecciones) | Posponer | Post-reingenieria |
| Fix gastos parciales | Integrar | Fase 3 |
| Script pesos masivo | Posponer | Post-reingenieria |

---

## MILESTONES Y DEMOS AL PO

| Milestone | Fases | Que mostrar | Deploy |
|-----------|-------|-------------|--------|
| M1: Cimientos | 0+1+1.5+2 | App con nueva nomenclatura, Red Logistica visible | Deploy 102-103 |
| M2: Motor | 3+4 | Crear OC con Sub-Ordenes, CTRU sin GA/GO, ML funcional | Deploy 104-105 |
| M3: Cara visible | 5+6 | UI completa, dashboard 3 niveles, tarjetas credito | Deploy 106-107 |
| M4: Sistema integrado | 7 | Flujo E2E completo, PO opera el mismo | Deploy 108 |

---

## NOTA FINAL

Este plan asume que la BD esta limpia y el sistema parte de cero en datos transaccionales.
Los maestros (productos, clientes, proveedores, marcas, categorias) se conservan intactos.
Cada fase tiene su propio Go/No-Go. No se avanza sin cumplirlo.
El PO recibe demo en cada milestone (4 demos total).
Estimacion total: 14-19 sesiones de trabajo.
