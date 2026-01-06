# Correcciones de Errores TypeScript - 2026-01-01

## Resumen

Se corrigieron aproximadamente 47 errores de TypeScript para lograr un build exitoso del proyecto. Los errores estaban relacionados principalmente con:

- Tipos incompatibles entre interfaces
- Propiedades faltantes o incorrectas
- Variantes de botones no válidas
- Estados de entidades incorrectos
- Variables declaradas pero no utilizadas

---

## Componentes Corregidos

### AlmacenForm.tsx
**Ubicación:** `src/components/modules/configuracion/AlmacenForm.tsx`

| Cambio | Antes | Después |
|--------|-------|---------|
| TipoAlmacen por defecto | `'principal'` | `'viajero'` |
| Opciones de tipo | `'principal', 'temporal', 'transito'` | `'viajero', 'almacen_usa', 'almacen_peru'` |
| Campo de capacidad | `capacidadM3` | `capacidadUnidades` |
| Campo adicional | - | `esViajero: initialData?.esViajero ?? true` |

### RecepcionForm.tsx
**Ubicación:** `src/components/modules/inventario/RecepcionForm.tsx`

- Removido import no usado de `Almacen` de `almacen.types.ts`
- Cambiado tipo de `almacenOptions` de `Array<{ value: Almacen; label: string }>` a `Array<{ value: string; label: string }>`
- Añadidas propiedades opcionales al componente:
  - `ordenCompraId?: string`
  - `numeroOrden?: string`
- Añadidos campos al estado inicial de `formData`:
  - `ordenCompraId`
  - `numeroOrden`

### UnidadDetailsModal.tsx
**Ubicación:** `src/components/modules/inventario/UnidadDetailsModal.tsx`

- Removido import no usado `Truck` de lucide-react
- Cambiado tipo de `almacenLabels` de `Record<Almacen, string>` a `Record<string, string>`

### UnidadTable.tsx
**Ubicación:** `src/components/modules/inventario/UnidadTable.tsx`

| Cambio | Antes | Después |
|--------|-------|---------|
| Import de tipos | `producto.types` | `unidad.types` |
| Estados en Record | `asignada_pedido, en_despacho, entregada, devuelta` | `reservada, vendida` |
| Referencia a código | `unidad.codigoUnidad` | `unidad.id.slice(0, 8).toUpperCase()` |
| Referencia a almacén | `unidad.almacenActualNombre`, `unidad.almacenActualId` | `unidad.almacenNombre`, `unidad.almacenId` |
| CTRU dinámico | `unidad.ctruDinamico.toFixed(2)` | `(unidad.ctruDinamico \|\| unidad.costoUnitarioUSD * (unidad.tcPago \|\| 3.70)).toFixed(2)` |
| TC Pago | `unidad.tcPago.toFixed(3)` | `(unidad.tcPago \|\| 3.70).toFixed(3)` |

### OrdenCompraCard.tsx
**Ubicación:** `src/components/modules/ordenCompra/OrdenCompraCard.tsx`

| Cambio | Antes | Después |
|--------|-------|---------|
| Fecha de pago | `orden.fechaPagada` | `orden.fechaPago` |
| Botón recibir orden | `variant="success"` | `variant="primary"` |

### OrdenCompraTable.tsx
**Ubicación:** `src/components/modules/ordenCompra/OrdenCompraTable.tsx`

- Removido estado `'pagada'` del Record de `estadoLabels` (no existe en `EstadoOrden`)

### VentaCard.tsx
**Ubicación:** `src/components/modules/venta/VentaCard.tsx`

| Cambio | Antes | Después |
|--------|-------|---------|
| Conversión de fecha | `v.fechaCreacion?.toDate?.() \|\| new Date(v.fechaCreacion)` | `v.fechaCreacion?.toDate ? v.fechaCreacion.toDate() : new Date()` |
| Botón registrar pago | `variant="success"` | `variant="primary"` |
| Botón marcar entregada | `variant="success"` | `variant="primary"` |

### VentaForm.tsx
**Ubicación:** `src/components/modules/venta/VentaForm.tsx`

- Removida función no usada `getProductoNombre`
- Cambiado botón "Guardar como Cotización" de `variant="default"` a `variant="secondary"`

### PagoVentaForm.tsx
**Ubicación:** `src/components/modules/venta/PagoVentaForm.tsx`

- Cambiado botón submit de `variant="success"` a `variant="primary"`

### ProductoForm.tsx
**Ubicación:** `src/components/modules/productos/ProductoForm.tsx`

- Añadido campo `costoFleteUSAPeru: initialData?.costoFleteUSAPeru || 0` al estado inicial

---

## Servicios Corregidos

### inventario.service.ts
**Ubicación:** `src/services/inventario.service.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Import de Unidad | `producto.types` | `unidad.types` |
| Estado reservadas | `'asignada_pedido'` | `'reservada'` |
| Estado vendidas | `'entregada'` | `'vendida'` |
| Verificación fechaVencimiento | Sin verificación | Añadido `u.fechaVencimiento &&` antes de acceder |

### ordenCompra.service.ts
**Ubicación:** `src/services/ordenCompra.service.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| Condición de estado | `nuevoEstado === 'pagada'` | `nuevoEstado === 'recibida'` |
| Campo de fecha | `fechaPagada` | `fechaPago` |
| Conteo de pagadas | `orden.estado === 'pagada'` | `orden.estadoPago === 'pagada'` |

### ctru.service.ts
**Ubicación:** `src/services/ctru.service.ts`

| Cambio | Antes | Después |
|--------|-------|---------|
| TC aplicable | `unidad.tcPago \|\| unidad.tcCompra` | `unidad.tcPago \|\| unidad.tcCompra \|\| 3.70` |
| Parámetro no usado | `unidadId` | `_unidadId` |

### transferencia.service.ts
**Ubicación:** `src/services/transferencia.service.ts`

- Marcadas variables no usadas con `void`:
  - `diasEnTransito` → `void (transferencia.fechaSalida ? ... : 0)`
  - `almacenDestino` → `void almacenService.getById(...)`

### unidad.service.ts
**Ubicación:** `src/services/unidad.service.ts`

- Marcado parámetro no usado: `observaciones` → `_observaciones`

---

## Páginas Corregidas

### Configuracion.tsx
**Ubicación:** `src/pages/Configuracion/Configuracion.tsx`

| Cambio | Antes | Después |
|--------|-------|---------|
| Variable loading | `const loading = ...` | `void (configLoading \|\| almacenesLoading)` |
| Comparación tipo | `almacen.tipo === 'principal'` | `almacen.tipo === 'viajero'` |
| Comparación tipo | `almacen.tipo === 'temporal'` | `almacen.tipo === 'almacen_usa'` |
| Labels de tipo | `almacen.tipo.charAt(0).toUpperCase() + almacen.tipo.slice(1)` | Labels específicos por tipo |
| Conversión Timestamp | `selectedAlmacen` directo | `{ ...selectedAlmacen, proximoViaje: selectedAlmacen.proximoViaje?.toDate?.() ?? undefined }` |

### Gastos.tsx
**Ubicación:** `src/pages/Gastos/Gastos.tsx`

- Marcado `user` como no usado: `const { user } = useAuthStore()` → `const { user: _user } = useAuthStore()`

### OrdenesCompra.tsx
**Ubicación:** `src/pages/OrdenesCompra/OrdenesCompra.tsx`

- Marcado `setSelectedOrden` como no usado: → `setSelectedOrden: _setSelectedOrden`

### Productos.tsx
**Ubicación:** `src/pages/Productos/Productos.tsx`

- Marcado `setSortConfig` como no usado: `[sortConfig, setSortConfig]` → `[sortConfig, _setSortConfig]`

### Reportes.tsx
**Ubicación:** `src/pages/Reportes/Reportes.tsx`

- Corregida conversión de Timestamp: `v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion)` → `v.fechaCreacion?.toDate ? v.fechaCreacion.toDate() : new Date()`

### Ventas.tsx
**Ubicación:** `src/pages/Ventas/Ventas.tsx`

| Cambio | Antes | Después |
|--------|-------|---------|
| Propiedad de fecha | `g.fechaGasto` | `g.fecha` |
| Conversión Timestamp gastos | `g.fechaGasto?.toDate?.() \|\| new Date(g.fechaGasto)` | `g.fecha?.toDate ? g.fecha.toDate() : new Date()` |
| Conversión Timestamp ventas | `v.fechaCreacion?.toDate?.() \|\| new Date(v.fechaCreacion)` | `v.fechaCreacion?.toDate ? v.fechaCreacion.toDate() : new Date()` |

---

## Stores Corregidos

### inventarioStore.ts
**Ubicación:** `src/store/inventarioStore.ts`

- Marcado parámetro `get` como no usado: `(set, get)` → `(set, _get)`

---

## Tipos de Referencia

### EstadoUnidad (unidad.types.ts)
```typescript
type EstadoUnidad =
  | 'recibida_usa'
  | 'en_transito_usa'
  | 'en_transito_peru'
  | 'disponible_peru'
  | 'reservada'
  | 'vendida'
  | 'vencida'
  | 'danada';
```

### TipoAlmacen (almacen.types.ts)
```typescript
type TipoAlmacen = 'viajero' | 'almacen_usa' | 'almacen_peru';
```

### EstadoOrden (ordenCompra.types.ts)
```typescript
type EstadoOrden = 'borrador' | 'enviada' | 'en_transito' | 'recibida' | 'cancelada';
```

### Variantes de Button válidas
```typescript
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
// NO válidos: 'success', 'default'
```

---

## Resultado Final

```
✓ 2469 modules transformed
✓ built in 7.71s
```

El build se completó exitosamente sin errores de TypeScript.
