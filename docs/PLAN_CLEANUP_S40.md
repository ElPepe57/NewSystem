# Plan Cleanup S40 — Reset transaccional + limpieza código legacy

**Decisión tomada:** el ambiente actual es testing/staging. Se conservan productos, maestros y red logística; el resto (transaccional + logs + deprecated) se borra. Los contadores se reinician a 0 para que la primera entidad operativa tenga número -001.

**Firebase Storage (archivos):** NO se borra automáticamente. Las evidencias/fotos/PDFs históricos en Storage se conservan (costo despreciable, no bloquean operación). Si se requiere limpieza posterior, requiere script adicional que detecte huérfanos por cross-check contra IDs eliminados.

---

## Alcance

### ✅ SE CONSERVA

Productos: `productos`
Maestros comerciales: `marcas`, `categorias`, `tiposProducto`, `canalesVenta`, `etiquetas`, `competidores`
Maestros org: `lineasNegocio`, `paisesOrigen`
Red logística: `casillas`, `colaboradores`
Maestros relación: `clientes`, `proveedores`
Finanzas config: `cuentasCaja`, `categoriasCostos`, `insumos`, `kitsEmpaque`, `tarjetasCredito`, `tiposCambio`
Sistema: `configuracion`, `users`
ML maestro: `mlProductMap`, `mlConfig`

### 🗑️ SE BORRA

Ventas: `ventas`, `cotizaciones`, `entregas`, `entregas_parciales`
Compras: `requerimientos`, `ordenesCompra`
Inventario: `unidades`
Logística: `envios`, `transferencias` (deprecated), `reclamos`
Finanzas: `gastos`, `movimientosTesoreria`, `conversionesCambiarias`, `registrosTCTransaccion`, `aportesCapital`, `retirosCapital`
Planilla: `boletas`, `adelantosNomina`
Otros transaccionales: `lotePagos`, `cierresContables`, `devoluciones`
Logs/auditoría: `actividad`, `audit_logs`, `movimientos_transportista`, `historialRecalculoCTRU`, `scanHistory`, `conteosInventario`, `_errorLog`, `notificaciones`
Pool USD (deprecated): `poolUSDMovimientos`, `poolUSDSnapshots`
ML transaccional: `mlOrderSync`, `mlQuestions`, `mlWebhookLog`, `mlShipmentLog`
Colaboración: `chat_mensajes`, `chat_meta`, `llamadas`, `llamadasIntel`, `presencia`
Cacheadas: `estadisticas`
Archivos: detectadas automáticamente (patrones `*Anulados`, `*Archivo`, `*_archivo`, `*_historico`, `*Backup`)

### 🔄 SE RESETEA

- `contadores/*` → todos a 0 (próxima entidad será …-2026-001)
- Métricas incrementales en maestros conservados (ver sección "Campos reseteados por colección")

---

## Fases de ejecución

### Fase 0 — Pre-limpieza (responsabilidad del usuario)

```bash
# Tag git para recuperación de código
git tag pre-cleanup-s40
git push --tags

# Backup Firestore manual (GCS)
gcloud firestore export gs://businessmn-269c9-backups/pre-cleanup-s40-$(date +%Y%m%d)

# Autenticación del gcloud SDK para los scripts
gcloud auth application-default login
```

### Fase 1 — Inventario (NO destructivo)

```bash
node scripts/cleanup-s40/01-inventario.mjs
```

**Output:** `docs/ESTADO_BD_PRE_CLEANUP_S40.md`

**Qué verificar en el reporte:**
1. Totales por clasificación son razonables
2. **Colecciones NO CATALOGADAS** — requieren decisión manual; si aparecen, actualizar los Set en los scripts
3. Contadores actuales (para referencia post-reset)
4. Muestras de transaccionales (sanity check de que son data de testing)

### Fase 2 — Borrar transaccionales

```bash
# Dry-run (verifica conteos)
node scripts/cleanup-s40/02-borrar-transaccionales.mjs

# Ejecutar real
node scripts/cleanup-s40/02-borrar-transaccionales.mjs --execute
```

**Safety guard:** las colecciones maestro no pueden borrarse aunque estén en la lista por error. El script aborta ese delete específico.

### Fase 3 — Reset contadores

```bash
node scripts/cleanup-s40/03-reset-contadores.mjs           # dry-run
node scripts/cleanup-s40/03-reset-contadores.mjs --execute # real
```

### Fase 4 — Reset métricas en maestros

```bash
node scripts/cleanup-s40/04-limpiar-metricas.mjs           # dry-run
node scripts/cleanup-s40/04-limpiar-metricas.mjs --execute # real
```

### Fase 5 — Validación (NO destructivo)

```bash
node scripts/cleanup-s40/05-validar-integridad.mjs
```

**Exit code 0** = todo OK. **Exit code 1** = hay problemas bloqueantes.

### Fase 6 — Limpieza de código legacy (lo hago en sesión de código)

**Archivos a borrar:**
- `src/components/modules/ordenCompra/RecepcionParcialModal.tsx`

**Funciones/handlers a eliminar:**
- `recibirOrdenParcial()` en `ordenCompra.service.ts` o store relacionado
- `handleRecibirOrden()`, `handleRecibirSubOrden()`, `handleSubmitRecepcion()` en `OrdenesCompra.tsx`
- Props `onRecibirOrden`, `onRecibirSubOrden` en `OrdenCompraCard`
- Estado `isRecepcionModalOpen`, `subOrdenRecepcion` en `OrdenesCompra.tsx`
- Campos `recepcionesParciales[]`, `fechaPrimeraRecepcion` en tipo `OrdenCompra` (o marcar como `readonly` legacy)
- Botón "Recibir Productos" legacy en `OrdenCompraCard`
- Alias `Transferencia = Envio`, `useTransferenciaStore = useEnvioStore`
- Estados unidad legacy: `recibida_origen`, `en_transito_origen`, `en_transito_peru`, `disponible_peru`, `asignada_pedido`, `en_reclamo`
- Fallback `almacenId` en Unidad (consolidar a `casillaActualId`)
- `ClaseGasto` deprecated, `tipo: 'flete_usa_peru'` legacy
- Detección legacy aduana `'otro' + descripción "aduana"` (usar solo `tipo: 'aduana'`)
- Coexistencia v2+legacy en `ordenCompra.crud.service.ts` (campos `impuestoUSD` etc. ya eliminados en S39; verificar)

**Archivos a simplificar:**
- `src/components/modules/ordenCompra/EnviosDeOC.tsx` — quitar callback `onEnviosActivosChange` (ya no hace falta si borramos el botón legacy)
- `src/pages/Envios/LiberarAduanaModal.tsx` — quitar fallback legacy `tipo === 'otro'` en detector

---

## Campos reseteados por colección (Fase 4)

**productos** → stocks (USA/Peru/Transito/Reservado/Disponible/DisponiblePeru/PendienteML/EfectivoML), ctruPromedio, cantidadVentas, ingresoTotalUSD, ultimaVenta (eliminado), unidadesVendidas, unidadesEnTransito

**marcas / tiposProducto / categorias / competidores** → cantidadVentas, ingresoTotalUSD, ingresoTotalPEN, unidadesMovidas, ultimaVenta (eliminado). `cantidadProductos` y `lineaNegocioIds[]` se preservan.

**proveedores** → cantidadOrdenes, montoTotalCompradoUSD, montoTotalCompradoPEN, ultimaCompra (eliminado), saldoPendiente

**clientes** → cantidadVentas, montoTotalCompradoUSD, montoTotalCompradoPEN, ultimaCompra (eliminado), saldoPendiente

**colaboradores** → entregasCompletadas, unidadesEntregadas, ultimaEntrega (eliminado), montoPendienteUSD, montoPagadoUSD, viajesCompletados

**cuentasCaja** → saldoActual, saldoAnterior, saldoInicialSnapshot → 0; ultimoMovimiento (eliminado). Config de cuenta (nombre, moneda, banco, número, etc.) se preserva.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Backup insuficiente | Tag git + export GCS explícito ANTES de Fase 2 |
| Colección maestra borrada por error | Safety guard en `02-borrar-transaccionales.mjs` que bloquea maestros |
| Script interrumpido a mitad | Batches de 450 ops son atómicos; retomas desde la misma colección sin problema |
| Huérfanos en Storage | Documentados como "conservar" — no bloquean operación |
| Código legacy apunta a datos inexistentes | Fase 6 elimina el código; mientras tanto, los guards actuales (`enviosActivosCount === 0`) hacen el fallback robusto |
| Métricas reseteadas incorrectamente | Fase 4 afecta solo campos específicos con nombre conocido; no toca relaciones ni IDs |
| TypeScript roto post-Fase 6 | `tsc -b` + `vite build` al final; reconstrucción si algo falla |

---

## Bitácora de ejecución

> Llenar DURANTE la ejecución, commit al final.

| Fecha/hora | Fase | Modo | Conteo antes | Conteo después | Notas / Errores |
|------------|------|------|--------------|----------------|-----------------|
| — | Fase 0 (backup) | — | — | — | — |
| — | Fase 1 (inventario) | read-only | — | — | — |
| — | Fase 2 (borrado) | dry-run | — | — | — |
| — | Fase 2 (borrado) | execute | — | — | — |
| — | Fase 3 (contadores) | execute | — | 0 | — |
| — | Fase 4 (métricas) | execute | — | reset | — |
| — | Fase 5 (validación) | read-only | — | — | — |
| — | Fase 6 (código) | — | — | — | tsc+vite OK/errores |

---

## Post-cleanup: validación manual end-to-end

Una vez completadas las 6 fases, ejecutar este smoke test manual en la app:

1. **Abrir /ordenes-compra** → debe estar vacía, KPIs en 0
2. **Abrir /envios** → vacía en los 6 tabs
3. **Abrir /inventario** → sin unidades
4. **Abrir /ventas** → sin ventas
5. **Abrir /tesoreria** → cuentas en saldo 0, sin movimientos
6. **Crear una OC de prueba** end-to-end:
   - Número debe ser `OC-2026-001`
   - Confirmar → envío generado con número `ENV-2026-001`
   - Despachar con courier
   - Recibir con 1 unidad dañada + 1 en aduana
   - Abrir `GestionIncidenciasModal` → 3 tabs visibles (Dañadas/Perdidas/Aduana)
   - Liberar aduana → CostoLanded creado
   - Crear reclamo desde tab Perdidas (si aplica) → `REC-2026-001`
   - Verificar métricas Rendimiento reflejan la operación
7. **Revisar `/reportes/logistica`** (si existe) y dashboards

Si algo falla, revertir con el tag git + restore del export GCS.
