# BMN System - Cloud Functions

## Descripción

Cloud Functions de Firebase para automatización del sistema BMN:

1. **onOrdenCompraRecibida**: Genera unidades de inventario automáticamente cuando una OC cambia a estado "recibida"
2. **obtenerTipoCambioDiario**: Función programada que obtiene el TC de la SBS diariamente a las 9 AM
3. **obtenerTipoCambioManual**: Función callable para obtener TC bajo demanda
4. **onGastoCreado**: Recalcula el CTRU de las unidades afectadas cuando se registra un gasto prorrateable
5. **limpiezaDiaria**: Tareas de mantenimiento diario

## Instalación

```bash
cd functions
npm install
```

## Desarrollo Local

```bash
# Compilar TypeScript
npm run build

# Ejecutar emulador
npm run serve

# Watch mode para desarrollo
npm run build:watch
```

## Despliegue

```bash
# Desplegar todas las funciones
npm run deploy

# Ver logs
npm run logs
```

## Estructura de Funciones

### 1. onOrdenCompraRecibida (Firestore Trigger)

**Trigger**: Actualización de documento en `ordenesCompra/{ordenId}`

**Comportamiento**:
- Se activa cuando el estado cambia a "recibida" y no se han generado unidades
- Crea una unidad por cada ítem en la OC
- Calcula CTRU base incluyendo gastos prorrateados
- Asigna código único: `{numeroOrden}-001, 002, ...`

**Campos generados en cada unidad**:
- `codigoUnidad`, `sku`, `productoId`
- `ordenCompraId`, `numeroOrden`, `proveedorId`
- `estado`: "disponible_peru"
- `costoUnitarioUSD`, `gastosProrrateadosUSD`, `costoTotalUSD`
- `tcCompra`, `costoTotalPEN`
- `ctruBase`, `ctruGastos`, `ctruDinamico`

### 2. obtenerTipoCambioDiario (Scheduled)

**Schedule**: 9:00 AM hora Lima, Lunes a Viernes

**Comportamiento**:
- Consulta API externa para obtener TC USD/PEN
- Guarda en `tiposCambio/{YYYY-MM-DD}`
- Incluye compra, venta, fuente y timestamp

### 3. onGastoCreado (Firestore Trigger)

**Trigger**: Creación de documento en `gastos/{gastoId}`

**Condiciones**:
- `esProrrateable === true`
- `impactaCTRU === true`

**Comportamiento**:
- Determina unidades afectadas según `prorrateoTipo`:
  - `"oc"`: Solo unidades de esa orden de compra
  - Otro: Unidades disponibles del período
- Calcula `montoPorUnidad = montoPEN / totalUnidades`
- Actualiza `ctruGastos` y `ctruDinamico` en cada unidad
- Registra en `historialRecalculoCTRU`

## Variables de Entorno

Para producción, configura las siguientes variables:

```bash
firebase functions:config:set api.tc_key="TU_API_KEY"
```

## Dependencias

- `firebase-admin`: SDK de administración de Firebase
- `firebase-functions`: SDK de Cloud Functions
- `axios`: Cliente HTTP para APIs externas

## Notas Importantes

1. **Límite de batch**: Firebase permite máximo 500 operaciones por batch. Si una OC tiene más de 500 unidades, se necesitaría dividir en múltiples batches.

2. **Concurrencia**: Las funciones Firestore pueden ejecutarse múltiples veces si hay actualizaciones rápidas. La lógica incluye verificación de `inventarioGenerado` para evitar duplicados.

3. **Zona horaria**: Todas las funciones programadas usan "America/Lima" para consistencia con horario Perú.

4. **Fallback TC**: Si la API de TC falla, la función programada no crea registro. Considerar implementar valor por defecto o notificación.
