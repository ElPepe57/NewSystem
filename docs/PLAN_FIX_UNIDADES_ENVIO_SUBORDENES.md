# PLAN: Fix Vinculacion Unidades ↔ Envio + Sub-Ordenes

**Fecha:** 2026-04-13  
**Sesion:** S36  
**Prioridad:** CRITICA — Afecta integridad del ciclo de vida completo  
**Estado:** PLAN APROBADO — Pendiente implementacion

---

## PROBLEMA RAIZ

Al confirmar una OC, se crean N unidades (estado='pedida', casillaActualId='PROVEEDOR') y 1+ envios (estado='borrador'), pero **las unidades nunca se vinculan al envio**. Resultado:

1. `envio.unidades[]` siempre esta vacio
2. `enviar()` no transiciona unidades (guard `if (unidades.length > 0)`)
3. `registrarRecepcion()` opera sobre lista vacia
4. `recibirOrdenParcial()` crea NUEVAS unidades, duplicando las de confirmarOC

Las unidades quedan en limbo permanente con estado 'pedida'.

---

## 4 PROBLEMAS + 5 FIXES

### FIX 1: Agregar `envioId` al tipo Unidad
**Archivo:** `src/types/unidad.types.ts`

Agregar campos de trazabilidad de envio:
```typescript
// Trazabilidad Envio (nuevo)
envioId?: string;           // ID del envio al que pertenece
envioNumero?: string;       // Numero del envio (desnormalizado)
subOrdenId?: string;        // ID de la sub-orden (si aplica)
```

**Impacto:** Solo extiende la interfaz. No rompe nada existente (campos opcionales).

---

### FIX 2: Modificar `envio.crear()` para poblar `unidades[]`
**Archivo:** `src/services/envio.crud.service.ts` (lineas 69-118)

Actualmente `crear()` recibe `unidadesIds` pero lo ignora. Fix:

```typescript
// ANTES (linea 82-83):
unidades: [],
totalUnidades: 0,

// DESPUES: Construir EnvioUnidad[] desde los datos proporcionados
unidades: data.unidadesDetalle || [],   // nuevo campo con EnvioUnidad[]
totalUnidades: data.unidadesDetalle?.length || 0,
```

Agregar a `EnvioFormData` (envio.types.ts):
```typescript
unidadesDetalle?: EnvioUnidad[];  // Datos completos de unidades (no solo IDs)
```

**Por que `unidadesDetalle` en vez de `unidadesIds`:** El envio necesita `EnvioUnidad` (con sku, productoId, estadoEnvio), no solo IDs. `confirmarOC()` ya tiene toda esa info disponible.

---

### FIX 3: Reordenar `confirmarOC()` para vincular unidades ↔ envio
**Archivo:** `src/services/ordenCompra.crud.service.ts` (lineas 558-732)

Este es el fix mas critico. El flujo actual:
1. Crear unidades en batch → batch.commit()
2. Crear envio(s) con envioCrudService.crear() (unidades vacias)

Nuevo flujo:
1. Pre-generar IDs de unidades Y de envios
2. Crear unidades con `envioId` y `subOrdenId` incluidos
3. Crear envio(s) con `unidadesDetalle[]` poblado
4. Todo en el mismo batch (o batch + sets coordinados)

**Detalle para OC SIN sub-ordenes:**
```
1. envioRef = doc(collection(db, 'envios'))  // pre-generar envioId
2. Para cada producto, crear unidades con:
   - envioId: envioRef.id
   - envioNumero: generado previamente
3. Crear envio con:
   - unidadesDetalle: EnvioUnidad[] construido desde las unidades creadas
4. batch.commit()
```

**Detalle para OC CON sub-ordenes:**
```
1. Para cada sub-orden:
   a. envioRef = doc(collection(db, 'envios'))  // pre-generar envioId
   b. Crear unidades de ESA sub-orden con:
      - envioId: envioRef.id
      - subOrdenId: sub.id
   c. Construir EnvioUnidad[] para ese envio
2. Crear todos los envios con sus unidadesDetalle[]
3. batch.commit()
```

**Limite de batch:** Actualmente 450 ops. Con envios en el mismo batch, verificar que no exceda. Si hay 5 sub-ordenes con 100 productos cada una = 500 unidades + 5 envios + 1 OC = 506 > 500. Considerar split de batch si necesario.

---

### FIX 4: Guard anti-duplicacion en `recibirOrdenParcial()`
**Archivo:** `src/services/ordenCompra.recepcion.service.ts` (lineas 139-280)

Actualmente crea NUEVAS unidades en estado 'disponible'/'reservada'. Pero si `confirmarOC()` ya creo unidades en 'pedida', hay duplicacion.

**Dos estrategias posibles:**

**Estrategia A — Transicionar unidades existentes (RECOMENDADA):**
- Buscar unidades existentes de esta OC en estado 'pedida'
- Si existen, transicionarlas a 'disponible'/'reservada' (no crear nuevas)
- Actualizar su casillaActualId, costoLanded, CTRU, etc.
- Si NO existen (OC legacy sin unidades previas), crear como antes (backward compat)

**Estrategia B — Eliminar recibirOrdenParcial (largo plazo):**
- La recepcion deberia fluir por envio.recepcion.service.ts
- Pero requiere migrar TODO el flujo de recepcion OC → Envio
- No viable en esta sesion

**Implementar Estrategia A:**
```typescript
// Al inicio de recibirOrdenParcial():
const unidadesExistentes = await getUnidadesPorOC(ocId, 'pedida');

if (unidadesExistentes.length > 0) {
  // Transicionar unidades existentes
  return await transicionarUnidadesExistentes(
    unidadesExistentes, productosRecibidos, ...
  );
} else {
  // Legacy: crear nuevas (flujo actual)
  return await crearUnidadesNuevas(...);
}
```

---

### FIX 5: UI — Visibilidad de unidades "con proveedor"
**Archivos:** `src/pages/Unidades/Unidades.tsx`, `OrdenCompraTable.tsx`

**En pagina Unidades:**
- Agregar columna "Envio" que muestre `envioNumero` (si existe)
- Agregar filtro por envioId
- Las unidades 'pedida' con envioId se muestran como "Con Proveedor (ENV-XXXX)"

**En tabla OC (expandable):**
- Las sub-ordenes colapsables ya muestran envioNumero
- Agregar conteo de unidades por estado: "4u pedidas | 0u en transito | 0u recibidas"

---

## ORDEN DE EJECUCION

```
Paso 1: FIX 1 — Tipos (sin riesgo)
  └→ unidad.types.ts + envio.types.ts

Paso 2: FIX 2 — envio.crear() (riesgo bajo)
  └→ envio.crud.service.ts
  └→ Backward compatible (unidadesDetalle es opcional)

Paso 3: FIX 3 — confirmarOC() (RIESGO ALTO — zona documentada)
  └→ ordenCompra.crud.service.ts
  └→ Testing: OC simple, OC con 2 sub-ordenes, OC grande
  └→ Verificar limite batch 450

Paso 4: FIX 4 — recibirOrdenParcial() (riesgo medio)
  └→ ordenCompra.recepcion.service.ts
  └→ Guard anti-duplicacion + backward compat

Paso 5: FIX 5 — UI (sin riesgo)
  └→ Unidades.tsx, OrdenCompraTable.tsx
```

---

## VALIDACION POST-IMPLEMENTACION

### Escenario 1: OC simple (sin sub-ordenes)
1. Crear OC borrador con 3 productos (5 unidades total)
2. Confirmar OC → verificar:
   - 5 unidades creadas con envioId, estado 'pedida'
   - 1 envio creado con 5 EnvioUnidad en unidades[]
3. Enviar envio → verificar:
   - 5 unidades transicionan a 'en_transito'
4. Recibir → verificar:
   - Unidades transicionan a 'disponible' (no se crean nuevas)

### Escenario 2: OC con 2 sub-ordenes
1. Crear OC con 5 productos, dividir en 2 sub-ordenes
2. Confirmar OC → verificar:
   - Sub-orden 1: 3 unidades con envioId=ENV-A, subOrdenId=SUB-1
   - Sub-orden 2: 2 unidades con envioId=ENV-B, subOrdenId=SUB-2
   - ENV-A tiene 3 EnvioUnidad, ENV-B tiene 2
3. Enviar ENV-A → solo las 3 unidades de sub-orden 1 transicionan
4. Recibir ENV-A → solo esas 3 transicionan a 'disponible'
5. Sub-orden 1 estado → 'recibida', Sub-orden 2 → 'borrador'

### Escenario 3: OC legacy (sin unidades previas)
1. Tomar OC confirmada existente (sin unidades 'pedida')
2. Recibir → debe crear unidades nuevas (backward compat)

### Escenario 4: Limite de batch
1. OC con 5 sub-ordenes, 80 unidades cada una = 400 unidades
2. 400 unidades + 5 envios + 1 OC update = 406 ops → OK (< 450)

---

## DEPENDENCIAS Y RIESGOS

| Riesgo | Mitigacion |
|--------|-----------|
| confirmarOC es zona de riesgo documentada | Testing exhaustivo con 4 escenarios |
| CF onOrdenCompraRecibida puede duplicar | Ya tiene guard `inventarioGenerado: true` |
| Batch > 450 ops en OC muy grandes | Split en sub-batches si necesario |
| OC legacy sin unidades previas | Guard en recepcion: si no hay 'pedida', crear nuevas |
| enviar() ya tiene guard `unidades.length > 0` | Con FIX 2, este guard se cumple correctamente |

---

## ARCHIVOS AFECTADOS (RESUMEN)

| Archivo | Fix | Riesgo |
|---------|-----|--------|
| `src/types/unidad.types.ts` | FIX 1 | Bajo |
| `src/types/envio.types.ts` | FIX 2 | Bajo |
| `src/services/envio.crud.service.ts` | FIX 2 | Bajo |
| `src/services/ordenCompra.crud.service.ts` | FIX 3 | **ALTO** |
| `src/services/ordenCompra.recepcion.service.ts` | FIX 4 | Medio |
| `src/pages/Unidades/Unidades.tsx` | FIX 5 | Bajo |
| `src/components/modules/ordenCompra/OrdenCompraTable.tsx` | FIX 5 | Bajo |

---

## ESTIMACION

- FIX 1-2 (tipos + envio.crear): ~30 min
- FIX 3 (confirmarOC): ~60-90 min (incluye testing)
- FIX 4 (recepcion guard): ~45 min
- FIX 5 (UI): ~30 min
- **Total estimado: 1 sesion dedicada**
