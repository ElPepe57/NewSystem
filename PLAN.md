# Plan: ML Agrupación Clásica/Catálogo + Sync Stock + Edición de Precios

## Contexto
En Mercado Libre, un mismo producto puede tener 2 publicaciones (clásica y catálogo) que comparten el mismo stock real. Actualmente el sistema trata cada publicación como un item independiente en `mlProductMap`, lo que causa duplicación en contabilidad y métricas.

Además, faltan 2 funcionalidades clave:
1. **Sync bidireccional de stock** — el stock del ERP debe reflejarse en ML
2. **Edición de precios** — poder cambiar precios de ML desde el ERP

---

## Parte 1: Agrupación Clásica/Catálogo (evitar duplicación)

### Problema
- `syncAllItems()` crea un doc en `mlProductMap` POR CADA `MLItem` de ML
- Si hay 2 items con mismo SKU (uno clásico, uno catálogo), se crean 2 docs
- Al vincular ambos al mismo producto ERP, las órdenes se contarían doble

### Solución: Campo `catalog_product_id` + agrupación visual

ML ya nos da `catalog_product_id` en cada item. Si es `null`, es publicación clásica. Si tiene valor, es publicación de catálogo. Dos items con mismo `catalog_product_id` O mismo `mlSku` son el mismo producto real.

**Enfoque: NO fusionar los docs en Firestore**, sino agruparlos visualmente y en lógica de negocio:

#### 1.1 — Backend: Guardar `catalog_product_id` en el sync

**Archivo: `functions/src/mercadolibre/ml.types.ts`**
- Agregar a `MLProductMap`:
  ```typescript
  mlCatalogProductId: string | null;  // catalog_product_id de ML
  mlListingType: 'clasica' | 'catalogo'; // derivado de catalog_product_id
  ```

**Archivo: `functions/src/mercadolibre/ml.sync.ts`** (`syncAllItems`)
- Al guardar cada item, incluir:
  ```typescript
  mlCatalogProductId: item.catalog_product_id || null,
  mlListingType: item.catalog_product_id ? 'catalogo' : 'clasica',
  ```

#### 1.2 — Frontend: Agrupar visualmente en la tabla

**Archivo: `src/types/mercadoLibre.types.ts`**
- Agregar los mismos campos a `MLProductMap`

**Archivo: `src/pages/MercadoLibre/MercadoLibre.tsx`** (ProductosTab)
- Agrupar `productMaps` por `productoId` (si vinculado) o por `mlSku` (si mismo SKU)
- Mostrar filas agrupadas con indicador visual: "2 publicaciones" con sub-filas colapsables
- Badge "Clásica" / "Catálogo" en cada sub-fila

#### 1.3 — Lógica de negocio: Vincular en grupo

**Archivo: `src/pages/MercadoLibre/MercadoLibre.tsx`** (VincularProductoModal)
- Cuando el usuario vincula un item a un producto ERP, detectar si hay otros items con el mismo `mlSku`
- Preguntar: "Encontramos otra publicación con el mismo SKU. ¿Vincular ambas?"
- Si acepta, vincular todos los items del grupo al mismo `productoId`

#### 1.4 — Contabilidad: Evitar doble conteo en órdenes

**Archivo: `functions/src/mercadolibre/ml.sync.ts`** (processOrderNotification)
- Ya funciona correctamente porque cada orden tiene UN item_id específico
- No hay riesgo de doble conteo en órdenes (cada orden referencia un item concreto)
- La agrupación es solo visual para la tabla de mapeo

---

## Parte 2: Sync de Stock ERP → ML

### Problema
El stock actual en ML es independiente del stock real del ERP. Si vendes una unidad fuera de ML, el stock de ML no se actualiza.

### Solución: Push de stock disponible al actualizar inventario

#### 2.1 — Backend: Función para actualizar stock en ML

**Archivo: `functions/src/mercadolibre/ml.api.ts`**
- Agregar función `updateItemStock(itemId, quantity)`:
  ```typescript
  export async function updateItemStock(itemId: string, quantity: number): Promise<void> {
    const accessToken = await getValidAccessToken();
    await axios.put(`${ML_API_BASE}/items/${itemId}`,
      { available_quantity: quantity },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  }
  ```

#### 2.2 — Backend: Función callable para sync de stock

**Archivo: `functions/src/mercadolibre/ml.functions.ts`**
- Agregar `mlsyncstock` Cloud Function callable:
  - Recibe `productoId` (opcional, si no se pasa, sync todos)
  - Lee `stockDisponible` del producto en ERP (campo `stockDisponible` en doc `productos/{id}`)
  - Busca todos los `mlProductMap` vinculados a ese productoId
  - Llama `updateItemStock()` para CADA item vinculado (clásica y catálogo)
  - Retorna resultado

#### 2.3 — Backend: Export de la nueva function

**Archivo: `functions/src/mercadolibre/index.ts`**
- Exportar `mlsyncstock`

**Archivo: `functions/src/index.ts`**
- Agregar `mlsyncstock` al export de ML

#### 2.4 — Frontend: Botón de sync stock

**Archivo: `src/services/mercadoLibre.service.ts`**
- Agregar método `syncStock(productoId?)` que llama la Cloud Function

**Archivo: `src/store/mercadoLibreStore.ts`**
- Agregar action `syncStock`

**Archivo: `src/pages/MercadoLibre/MercadoLibre.tsx`**
- En la toolbar de ProductosTab, agregar botón "Sincronizar Stock"
- En cada fila vinculada, mostrar comparación: Stock ERP vs Stock ML
- Si difieren, indicador visual (badge rojo)

---

## Parte 3: Edición de Precios desde el ERP

### Solución: PUT a /items/{id} con nuevo precio

#### 3.1 — Backend: Función para actualizar precio

**Archivo: `functions/src/mercadolibre/ml.api.ts`**
- Agregar `updateItemPrice(itemId, price)`:
  ```typescript
  export async function updateItemPrice(itemId: string, price: number): Promise<void> {
    const accessToken = await getValidAccessToken();
    await axios.put(`${ML_API_BASE}/items/${itemId}`,
      { price },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  }
  ```

#### 3.2 — Backend: Función callable

**Archivo: `functions/src/mercadolibre/ml.functions.ts`**
- Agregar `mlupdateprice` Cloud Function callable:
  - Recibe `{ mlProductMapId, newPrice }`
  - Lee el `mlItemId` del doc
  - Llama `updateItemPrice()`
  - Actualiza `mlPrice` en el doc de `mlProductMap`
  - Retorna éxito

#### 3.3 — Backend: Exports

**Archivo: `functions/src/mercadolibre/index.ts`** y **`functions/src/index.ts`**
- Exportar `mlupdateprice`

#### 3.4 — Frontend: Edición inline de precio

**Archivo: `src/services/mercadoLibre.service.ts`**
- Agregar método `updatePrice(mlProductMapId, newPrice)`

**Archivo: `src/store/mercadoLibreStore.ts`**
- Agregar action `updatePrice`

**Archivo: `src/pages/MercadoLibre/MercadoLibre.tsx`** (ProductMapRow)
- Hacer el campo de precio editable (click para editar inline)
- Al confirmar, llama al store que llama la Cloud Function
- Muestra indicador de "guardando..." mientras se actualiza

---

## Orden de Implementación

1. **Parte 1** — Agrupación (cambios de sync + UI agrupada + vinculación en grupo)
2. **Parte 2** — Sync Stock (API update + Cloud Function + botón)
3. **Parte 3** — Edición de Precios (API update + Cloud Function + edición inline)

## Archivos Afectados (resumen)

| Archivo | Cambio |
|---------|--------|
| `functions/src/mercadolibre/ml.types.ts` | +2 campos en MLProductMap |
| `functions/src/mercadolibre/ml.api.ts` | +updateItemStock, +updateItemPrice |
| `functions/src/mercadolibre/ml.sync.ts` | Guardar catalog_product_id en sync |
| `functions/src/mercadolibre/ml.functions.ts` | +mlsyncstock, +mlupdateprice |
| `functions/src/mercadolibre/index.ts` | +exports |
| `functions/src/index.ts` | +exports |
| `src/types/mercadoLibre.types.ts` | +2 campos frontend |
| `src/services/mercadoLibre.service.ts` | +syncStock, +updatePrice |
| `src/store/mercadoLibreStore.ts` | +syncStock, +updatePrice actions |
| `src/pages/MercadoLibre/MercadoLibre.tsx` | Agrupación visual, sync stock btn, precio editable |
