# Cleanup S40 — Reset Transaccional

Scripts para resetear la BD transaccional y dejar un ambiente limpio para go-live.

## Decisiones de alcance (confirmadas S40)

### ✅ SE CONSERVA — maestros, productos, red logística, config

Colecciones intactas:
- `productos`
- Maestros comerciales: `marcas`, `categorias`, `tiposProducto`, `canalesVenta`, `etiquetas`, `competidores`
- Maestros org: `lineasNegocio`, `paisesOrigen`
- Red logística: `casillas`, `colaboradores`
- Maestros relación: `clientes`, `proveedores`
- Finanzas config: `cuentasCaja`, `categoriasCostos`, `insumos`, `kitsEmpaque`, `tarjetasCredito`, `tiposCambio`
- Sistema: `configuracion`, `users`
- ML maestro: `mlProductMap`, `mlConfig`

### 🗑️ SE BORRA — transaccional + logs + deprecated

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
Archivos: detectadas automáticamente (patrones `*Anulados`, `*Archivo`, `*_archivo`)

### 🔄 SE RESETEA

- `contadores/*` → todos a 0
- Métricas incrementales en maestros conservados (marcas, proveedores, clientes, tiposProducto)
  - Campos de ventas/compras → 0
  - `cantidadProductos`, `lineaNegocioIds[]` → se preservan

### 📁 Firebase Storage (archivos)

**NO se borra automáticamente.** Conserva evidencias, fotos y PDFs históricos que puedan existir. No bloquean operación y el costo es despreciable. Si quieres limpieza de Storage, requiere script adicional que detecte huérfanos.

---

## Uso

### Orden de ejecución

```bash
# 1. Inventario (NO destructivo) — genera reporte
node scripts/cleanup-s40/01-inventario.mjs

# 2. Reset contadores (DRY RUN por default, --execute para aplicar)
node scripts/cleanup-s40/03-reset-contadores.mjs           # dry-run
node scripts/cleanup-s40/03-reset-contadores.mjs --execute # real

# 3. Borrado transaccional (DRY RUN por default)
node scripts/cleanup-s40/02-borrar-transaccionales.mjs           # dry-run
node scripts/cleanup-s40/02-borrar-transaccionales.mjs --execute # real

# 4. Reset métricas en maestros conservados
node scripts/cleanup-s40/04-limpiar-metricas.mjs           # dry-run
node scripts/cleanup-s40/04-limpiar-metricas.mjs --execute # real

# 5. Validación post-cleanup
node scripts/cleanup-s40/05-validar-integridad.mjs
```

### Regla de oro

**TODOS los scripts destructivos requieren `--execute` explícito.** Sin ese flag operan en modo dry-run mostrando qué harían sin tocar nada.

---

## Pre-requisitos

1. Autenticación con gcloud:
   ```bash
   gcloud auth application-default login
   ```
2. Tag git `pre-cleanup-s40` creado (recuperación de código):
   ```bash
   git tag pre-cleanup-s40 && git push --tags
   ```
3. Backup Firestore manual (recuperación de datos):
   ```bash
   gcloud firestore export gs://businessmn-269c9-backups/pre-cleanup-s40-$(date +%Y%m%d)
   ```

---

## Bitácora

Mantener registro de ejecuciones en `docs/REGISTRO_IMPLEMENTACION.md` con:
- Fecha/hora de ejecución de cada script
- Conteos antes/después por colección
- Cualquier error o desviación encontrada
