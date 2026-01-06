# Reingenieria del Sistema de Categorizacion de Productos

## Resumen Ejecutivo

Este documento propone una reingenieria completa del sistema de categorizacion de productos para BusinessMN. El sistema actual de Grupo/Subgrupo presenta limitaciones criticas que impiden una gestion eficiente del catalogo de suplementos y vitaminas.

---

## 1. Problematica Actual

### 1.1 Sistema Actual: Grupo/Subgrupo

```
Producto: Mary Ruth's Zinc Ionico Organico
├── Grupo: "SISTEMA INMUNE" (texto libre)
└── Subgrupo: "SULFATO DE ZINC" (texto libre)
```

### 1.2 Limitaciones Identificadas

| Problema | Impacto |
|----------|---------|
| **Categoria unica** | Un producto solo puede pertenecer a UN grupo. Ej: Aceite de Oregano deberia estar en "Sistema Inmune" Y "Digestivo" Y "Antibacteriano" |
| **Confusion nombre vs composicion** | El subgrupo se usa incorrectamente para definir composicion ("Sulfato de Zinc") cuando deberia ser una subcategoria |
| **Sin estructura jerarquica** | No hay validacion de que subgrupos pertenecen a que grupos |
| **Texto libre sin normalizar** | "VITAMINAS", "vitaminas", "Vitaminas" son valores diferentes |
| **Sin metadatos** | No hay descripcion, iconos, o informacion adicional de categorias |
| **Busqueda web limitada** | Para e-commerce necesitas categorias navegables, no texto plano |
| **Sin SEO** | Imposible generar URLs amigables o meta-tags por categoria |

### 1.3 Ejemplo del Problema Real

```
Producto: NOW Foods Aceite de Oregano 90 caps
Grupo actual: "SISTEMA INMUNE"
Subgrupo actual: "ACEITE DE OREGANO"

Realidad:
- Este producto TAMBIEN es "DIGESTIVO"
- Este producto TAMBIEN es "ANTIBACTERIANO"
- "Aceite de Oregano" no es un subgrupo, es el TIPO DE PRODUCTO
- El cliente que busca "digestivo" NO encuentra este producto
```

---

## 2. Propuesta de Solucion

### 2.1 Nuevo Modelo Conceptual

Propongo separar en **tres conceptos distintos**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTO                                      │
├─────────────────────────────────────────────────────────────────┤
│ nombreComercial: "Mary Ruth's Zinc Ionico Organico"             │
│ marca: "Mary Ruth's"                                             │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ TIPO DE PRODUCTO (nuevo concepto)                           │ │
│ │ → "Sulfato de Zinc"                                         │ │
│ │ → Es la COMPOSICION o PRINCIPIO ACTIVO                      │ │
│ │ → Agrupa productos que son "lo mismo" de diferentes marcas  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ CATEGORIAS (multiple)                                       │ │
│ │ → ["Sistema Inmune", "Antioxidantes"]                       │ │
│ │ → Son los BENEFICIOS o AREAS DE SALUD                       │ │
│ │ → Un producto puede tener MULTIPLES categorias              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ETIQUETAS (tags flexibles)                                  │ │
│ │ → ["vegano", "sin-gluten", "organico", "best-seller"]       │ │
│ │ → Para filtrado rapido y marketing                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Los Tres Pilares del Nuevo Sistema

#### PILAR 1: Tipo de Producto (Entidad Maestra)

**Proposito**: Agrupar productos que son "la misma cosa" de diferentes marcas.

```typescript
// Ejemplo de tipos de producto
"Aceite de Oregano"
"Sulfato de Zinc"
"Omega 3 EPA/DHA"
"Vitamina D3"
"Colageno Hidrolizado"
"Probioticos 50 Billones"
```

**Beneficios**:
- Comparar precios del mismo tipo entre marcas
- Analisis de rentabilidad por tipo de producto
- Responder: "¿Cual Omega 3 se vende mas?"
- Agrupar para investigacion de mercado

#### PILAR 2: Categorias (Relacion Muchos a Muchos)

**Proposito**: Clasificar por area de beneficio/salud. Un producto puede tener MULTIPLES categorias.

```typescript
// Ejemplo: Aceite de Oregano tiene 3 categorias
categorias: ["Sistema Inmune", "Digestivo", "Antibacteriano"]

// Ejemplo: Omega 3 tiene 3 categorias
categorias: ["Cardiovascular", "Cerebro y Memoria", "Antiinflamatorio"]
```

**Estructura Jerarquica Propuesta**:
```
📁 Sistema Inmune
   ├── Vitaminas para Inmunidad
   ├── Antioxidantes
   └── Antibacterianos Naturales

📁 Digestivo
   ├── Probioticos
   ├── Enzimas Digestivas
   └── Fibra y Reguladores

📁 Cardiovascular
   ├── Omega 3 y Aceites
   ├── Control de Colesterol
   └── Circulacion

📁 Cerebro y Memoria
   ├── Noootropicos
   ├── Omega 3 para Cerebro
   └── Vitaminas B

📁 Energia y Vitalidad
   ├── Vitaminas B
   ├── Hierro
   └── Adaptogenos

📁 Belleza y Piel
   ├── Colageno
   ├── Biotina
   └── Antioxidantes

📁 Huesos y Articulaciones
   ├── Calcio y Vitamina D
   ├── Magnesio
   └── Colageno Tipo II

📁 Control de Peso
   ├── Quemadores
   ├── Inhibidores de Apetito
   └── Fibra

📁 Mujer
   ├── Prenatal
   ├── Menopausia
   └── Hierro

📁 Hombre
   ├── Prostata
   ├── Testosterona
   └── Rendimiento
```

#### PILAR 3: Etiquetas (Tags Libres)

**Proposito**: Atributos adicionales para filtrado y marketing.

```typescript
etiquetas: ["vegano", "sin-gluten", "organico", "kosher",
            "best-seller", "nuevo", "promocion", "importado-usa"]
```

---

## 3. Diseno Tecnico Detallado

### 3.1 Nueva Entidad: TipoProducto (Maestro)

```typescript
// src/types/tipoProducto.types.ts

export type EstadoTipoProducto = 'activo' | 'inactivo';

/**
 * Tipo de Producto - Agrupa productos por composicion/principio activo
 * Permite comparar "manzanas con manzanas" entre diferentes marcas
 */
export interface TipoProducto {
  id: string;
  codigo: string;                    // TPR-001, TPR-002, etc.

  // Identificacion
  nombre: string;                    // "Aceite de Oregano", "Sulfato de Zinc"
  nombreNormalizado: string;         // Para busqueda: "aceite-de-oregano"
  alias?: string[];                  // Variantes: ["Oregano Oil", "Aceite Oregano"]

  // Descripcion
  descripcion?: string;              // Descripcion general del tipo
  principioActivo?: string;          // Componente principal
  beneficiosPrincipales?: string[];  // Lista de beneficios

  // Relacion con Categorias Sugeridas
  categoriasSugeridas?: string[];    // IDs de categorias tipicas para este tipo

  // Visual (para web)
  iconoUrl?: string;
  imagenUrl?: string;

  // Estado
  estado: EstadoTipoProducto;

  // Metricas (desnormalizadas)
  metricas: {
    productosActivos: number;
    unidadesVendidas: number;
    ventasTotalPEN: number;
    margenPromedio: number;
  };

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

export interface TipoProductoSnapshot {
  tipoProductoId: string;
  codigo: string;
  nombre: string;
}
```

### 3.2 Nueva Entidad: Categoria (Maestro Jerarquico)

```typescript
// src/types/categoria.types.ts

export type EstadoCategoria = 'activa' | 'inactiva';
export type NivelCategoria = 1 | 2;  // 1 = padre, 2 = hijo

/**
 * Categoria de Producto - Clasificacion por beneficio/area de salud
 * Soporta jerarquia de 2 niveles (padre/hijo)
 * Un producto puede pertenecer a MULTIPLES categorias
 */
export interface Categoria {
  id: string;
  codigo: string;                    // CAT-001, CAT-002, etc.

  // Identificacion
  nombre: string;                    // "Sistema Inmune", "Digestivo"
  nombreNormalizado: string;         // Para busqueda y URLs: "sistema-inmune"
  slug: string;                      // Para URLs web: "sistema-inmune"

  // Jerarquia
  nivel: NivelCategoria;
  categoriaPadreId?: string;         // null si es nivel 1
  categoriaPadreNombre?: string;     // Snapshot para display rapido
  ordenDisplay: number;              // Para ordenar en navegacion

  // Descripcion
  descripcion?: string;
  metaDescription?: string;          // Para SEO web
  keywords?: string[];               // Para SEO y busqueda

  // Visual
  icono?: string;                    // Nombre de icono (ej: "shield", "heart")
  color?: string;                    // Color hex para UI
  imagenUrl?: string;                // Imagen para web
  imagenBannerUrl?: string;          // Banner para pagina de categoria

  // Estado
  estado: EstadoCategoria;
  mostrarEnWeb: boolean;             // Si aparece en navegacion web
  mostrarEnApp: boolean;             // Si aparece en app interna

  // Metricas (desnormalizadas)
  metricas: {
    productosActivos: number;
    subcategorias: number;           // Solo para nivel 1
  };

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

export interface CategoriaSnapshot {
  categoriaId: string;
  codigo: string;
  nombre: string;
  slug: string;
  nivel: NivelCategoria;
  categoriaPadreId?: string;
}

/**
 * Arbol de categorias para navegacion
 */
export interface CategoriaArbol extends Categoria {
  hijos: CategoriaArbol[];
}
```

### 3.3 Nueva Entidad: Etiqueta (Maestro Simple)

```typescript
// src/types/etiqueta.types.ts

export type TipoEtiqueta =
  | 'atributo'      // vegano, organico, sin-gluten
  | 'certificacion' // usda-organic, non-gmo, kosher
  | 'marketing'     // best-seller, nuevo, promocion
  | 'origen'        // importado-usa, nacional
  | 'presentacion'  // capsulas, polvo, liquido
  | 'otro';

export type EstadoEtiqueta = 'activa' | 'inactiva';

/**
 * Etiqueta - Tags flexibles para filtrado y marketing
 */
export interface Etiqueta {
  id: string;
  codigo: string;                    // ETQ-001, ETQ-002, etc.

  // Identificacion
  nombre: string;                    // "Vegano", "Sin Gluten"
  nombreNormalizado: string;         // "vegano", "sin-gluten"
  slug: string;                      // Para URLs

  // Clasificacion
  tipo: TipoEtiqueta;
  grupo?: string;                    // Agrupacion visual: "Dieta", "Certificaciones"

  // Visual
  icono?: string;
  color?: string;                    // Color del badge
  colorTexto?: string;               // Color del texto

  // Estado
  estado: EstadoEtiqueta;
  mostrarEnFiltros: boolean;         // Si aparece en filtros de busqueda

  // Metricas
  productosActivos: number;

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
}

export interface EtiquetaSnapshot {
  etiquetaId: string;
  nombre: string;
  slug: string;
  tipo: TipoEtiqueta;
  color?: string;
}
```

### 3.4 Producto Actualizado

```typescript
// Campos a AGREGAR en src/types/producto.types.ts

export interface Producto {
  // ... campos existentes ...

  // ======== NUEVA CLASIFICACION ========

  // Tipo de Producto (1:1 - obligatorio)
  tipoProductoId: string;
  tipoProducto: TipoProductoSnapshot;  // Snapshot desnormalizado

  // Categorias (N:N - al menos 1 obligatoria)
  categoriaIds: string[];              // Array de IDs
  categorias: CategoriaSnapshot[];     // Snapshots desnormalizados
  categoriaPrincipalId: string;        // Para display principal

  // Etiquetas (N:N - opcionales)
  etiquetaIds: string[];
  etiquetas: EtiquetaSnapshot[];

  // ======== CAMPOS A DEPRECAR ========
  // grupo: string;      // DEPRECADO - migrar a categorias
  // subgrupo: string;   // DEPRECADO - migrar a tipoProducto
}
```

---

## 4. Experiencia de Usuario (UI/UX)

### 4.1 Formulario de Producto - Tab Clasificacion Rediseñado

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 Editar Producto                                        [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Info Basica] [CLASIFICACION] [Datos Comerciales] [Inventario] │
│                ────────────────                                  │
│                                                                  │
│  ┌─ TIPO DE PRODUCTO ─────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  🔬 Tipo de Producto *                                      │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ 🔍 Buscar tipo... (ej: Omega 3, Colageno)           │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  Sugerencias rapidas:                                       │ │
│  │  [Omega 3] [Vitamina D3] [Colageno] [Probioticos] [+ Nuevo] │ │
│  │                                                             │ │
│  │  ℹ️ El tipo agrupa productos similares de diferentes marcas │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ CATEGORIAS ───────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  📁 Categorias * (selecciona todas las que apliquen)        │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ Sistema Inmune          [x]  ⭐ Principal            │   │ │
│  │  │   └─ Antioxidantes      [x]                          │   │ │
│  │  │ Cardiovascular          [ ]                          │   │ │
│  │  │ Energia y Vitalidad     [x]                          │   │ │
│  │  │ ...                                                  │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  Seleccionadas: Sistema Inmune > Antioxidantes,             │ │
│  │                 Energia y Vitalidad                          │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ ETIQUETAS ────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  🏷️ Etiquetas (opcional)                                    │ │
│  │                                                             │ │
│  │  [🌱 Vegano ×] [🌿 Organico ×] [🇺🇸 Importado USA ×]        │ │
│  │                                                             │ │
│  │  + Agregar etiqueta                                         │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ Atributos: [Sin Gluten] [Sin Lactosa] [Non-GMO]     │   │ │
│  │  │ Marketing: [Best Seller] [Nuevo] [Promocion]        │   │ │
│  │  │ Origen:    [Importado USA] [Nacional]               │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ VISTA PREVIA ─────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  Tipo: Sulfato de Zinc                                      │ │
│  │  Categorias: Sistema Inmune > Antioxidantes |               │ │
│  │              Energia y Vitalidad                            │ │
│  │  Etiquetas: 🌱 Vegano  🌿 Organico  🇺🇸 USA                 │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                              [Anterior]  [Cancelar]  [Siguiente] │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Vista de Tabla de Productos

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SKU      │ PRODUCTO                    │ TIPO         │ CATEGORIAS    │ ...  │
├──────────────────────────────────────────────────────────────────────────────┤
│ BMN-0126 │ MARY RUTH'S                 │ Sulfato de   │ 🛡️ Inmune    │      │
│          │ Zinc Ionico Organico        │ Zinc         │ ⚡ Energia    │      │
│          │ 3mg · 2oz                   │              │ +1 mas        │      │
│          │ 🌱 Vegano  🌿 Organico       │              │               │      │
├──────────────────────────────────────────────────────────────────────────────┤
│ BMN-0089 │ NOW FOODS                   │ Aceite de    │ 🛡️ Inmune    │      │
│          │ Aceite de Oregano           │ Oregano      │ 🍃 Digestivo │      │
│          │ 90 caps                     │              │ 💪 Antibact. │      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Filtros de Busqueda Mejorados

```
┌─ FILTROS ─────────────────────────────────┐
│                                            │
│  🔍 Buscar productos...                    │
│                                            │
│  Tipo de Producto          [Todos      ▼]  │
│  Categoria                 [Todas      ▼]  │
│  Subcategoria              [Todas      ▼]  │
│  Marca                     [Todas      ▼]  │
│  Estado                    [Todos      ▼]  │
│                                            │
│  Etiquetas:                                │
│  [🌱 Vegano] [🌿 Organico] [🇺🇸 USA]       │
│  [Sin Gluten] [Best Seller]                │
│                                            │
│  [Limpiar filtros]                         │
│                                            │
└────────────────────────────────────────────┘
```

### 4.4 Gestion de Maestros - Nueva Seccion

En la pagina de **Maestros**, agregar nuevas tarjetas:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ MAESTROS                                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Clientes]  [Marcas]  [Proveedores]  [Almacenes]  [Competidores]          │
│      7          30          7            9             15                   │
│                                                                             │
│  ┌─ CLASIFICACION DE PRODUCTOS ─────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  [🔬 Tipos de Producto]  [📁 Categorias]  [🏷️ Etiquetas]              │  │
│  │         45                    28              18                       │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [Transportistas]  [Canales de Venta]                                       │
│        4                  6                                                 │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Plan de Migracion

### 5.1 Estrategia de Migracion

```
FASE 1: Crear nuevas entidades (sin romper existente)
├── Crear colecciones: tiposProducto, categorias, etiquetas
├── Crear tipos TypeScript
├── Crear servicios CRUD
└── Crear UI de gestion de maestros

FASE 2: Mapeo automatico de datos existentes
├── Analizar valores unicos de grupo/subgrupo
├── Crear tipos de producto desde subgrupos unicos
├── Crear categorias desde grupos unicos
├── Generar script de migracion

FASE 3: Actualizar productos
├── Agregar campos nuevos (tipoProductoId, categoriaIds, etiquetaIds)
├── Ejecutar migracion de datos
├── Mantener campos antiguos temporalmente (backward compatibility)

FASE 4: Actualizar UI
├── Modificar ProductoForm con nuevo tab de clasificacion
├── Actualizar ProductoTable
├── Actualizar filtros
├── Actualizar reportes

FASE 5: Limpieza
├── Remover campos grupo/subgrupo del modelo
├── Actualizar queries
└── Documentar cambios
```

### 5.2 Mapeo Sugerido de Datos Existentes

Basado en el analisis del sistema actual:

| Grupo Actual | → Categoria Nueva | Nivel |
|--------------|-------------------|-------|
| SISTEMA INMUNE | Sistema Inmune | 1 |
| MULTIVITAMINICOS | Energia y Vitalidad | 1 |
| DIGESTIVO | Sistema Digestivo | 1 |
| ... | ... | ... |

| Subgrupo Actual | → Tipo de Producto |
|-----------------|-------------------|
| SULFATO DE ZINC | Sulfato de Zinc |
| ACEITE DE OREGANO | Aceite de Oregano |
| OMEGA 3 | Omega 3 EPA/DHA |
| ... | ... |

---

## 6. Beneficios del Nuevo Sistema

### 6.1 Para el Negocio

| Beneficio | Descripcion |
|-----------|-------------|
| **Analisis por tipo** | Comparar rentabilidad del mismo producto entre marcas |
| **Multi-categoria** | Un producto aparece en todas las busquedas relevantes |
| **Filtrado inteligente** | Clientes encuentran productos por necesidad de salud |
| **SEO ready** | URLs amigables y meta-tags por categoria |
| **Marketing** | Etiquetas para campañas (best-seller, nuevo, promo) |

### 6.2 Para el Usuario Final (Web)

```
Navegacion propuesta para e-commerce:
├── Por Categoria de Salud
│   ├── Sistema Inmune (45 productos)
│   ├── Digestivo (32 productos)
│   └── Energia (28 productos)
│
├── Por Tipo de Producto
│   ├── Omega 3 (12 productos, 5 marcas)
│   ├── Vitamina D3 (8 productos, 4 marcas)
│   └── Colageno (15 productos, 6 marcas)
│
└── Por Atributo
    ├── 🌱 Vegano (35 productos)
    ├── 🌿 Organico (22 productos)
    └── 🇺🇸 Importado USA (89 productos)
```

### 6.3 Para Reportes y Analytics

```typescript
// Nuevos reportes posibles:

// 1. Rentabilidad por Tipo de Producto
"¿Cual Omega 3 es mas rentable? NOW Foods vs Nordic Naturals vs Carlson"

// 2. Performance por Categoria
"¿Que categoria genera mas ventas? Sistema Inmune vs Digestivo"

// 3. Analisis de Etiquetas
"¿Los productos veganos se venden mas que los no-veganos?"

// 4. Comparativa de Marcas por Tipo
"En Colageno, ¿que marca tiene mejor margen?"
```

---

## 7. Consideraciones Tecnicas

### 7.1 Indices de Firestore Requeridos

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "productos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "categoriaIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "estado", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "productos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tipoProductoId", "order": "ASCENDING" },
        { "fieldPath": "estado", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "productos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "etiquetaIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "estado", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 7.2 Mantenimiento de Snapshots

Cuando se actualiza un maestro (tipo, categoria, etiqueta), se debe actualizar el snapshot en todos los productos relacionados. Se recomienda:

1. **Cloud Function** que escuche cambios en maestros
2. **Batch update** de productos afectados
3. **Queue** para evitar timeouts en grandes volumenes

### 7.3 Validaciones

```typescript
// Reglas de negocio a implementar:

// 1. Producto debe tener exactamente 1 tipo de producto
if (!formData.tipoProductoId) {
  errors.tipoProductoId = 'Debe seleccionar un tipo de producto';
}

// 2. Producto debe tener al menos 1 categoria
if (formData.categoriaIds.length === 0) {
  errors.categoriaIds = 'Debe seleccionar al menos una categoria';
}

// 3. Categoria principal debe estar en la lista de categorias
if (!formData.categoriaIds.includes(formData.categoriaPrincipalId)) {
  errors.categoriaPrincipalId = 'La categoria principal debe estar seleccionada';
}
```

---

## 8. Archivos a Crear/Modificar

### 8.1 Archivos Nuevos

```
src/types/
├── tipoProducto.types.ts        # Nueva entidad
├── categoria.types.ts           # Nueva entidad
└── etiqueta.types.ts            # Nueva entidad

src/services/
├── tipoProducto.service.ts      # CRUD + analytics
├── categoria.service.ts         # CRUD + arbol jerarquico
└── etiqueta.service.ts          # CRUD

src/store/
├── tipoProductoStore.ts         # Zustand store
├── categoriaStore.ts            # Zustand store
└── etiquetaStore.ts             # Zustand store

src/components/modules/clasificacion/
├── TipoProductoForm.tsx         # Formulario CRUD
├── TipoProductoList.tsx         # Lista con busqueda
├── CategoriaForm.tsx            # Formulario con jerarquia
├── CategoriaTree.tsx            # Vista de arbol
├── EtiquetaForm.tsx             # Formulario simple
├── EtiquetaList.tsx             # Lista con filtros por tipo
├── TipoProductoSelector.tsx     # Componente selector para ProductoForm
├── CategoriaSelector.tsx        # Componente multi-select con arbol
└── EtiquetaSelector.tsx         # Componente tags
```

### 8.2 Archivos a Modificar

```
src/types/producto.types.ts      # Agregar nuevos campos, deprecar grupo/subgrupo
src/services/producto.service.ts # Actualizar queries y validaciones
src/store/productoStore.ts       # Incluir relaciones
src/components/modules/productos/ProductoForm.tsx    # Nuevo tab clasificacion
src/components/modules/productos/ProductoTable.tsx   # Nuevas columnas
src/pages/Maestros/Maestros.tsx  # Agregar seccion clasificacion
```

---

## 9. Estimacion de Esfuerzo

| Fase | Componentes | Complejidad |
|------|-------------|-------------|
| 1. Entidades nuevas | 3 tipos + 3 servicios + 3 stores | Media |
| 2. UI de maestros | 9 componentes nuevos | Alta |
| 3. Script migracion | Analisis + script + validacion | Media |
| 4. Actualizar ProductoForm | Rediseño tab clasificacion | Alta |
| 5. Actualizar vistas | Tabla, filtros, reportes | Media |
| 6. Testing | Unitario + integracion | Media |

---

## 10. Preguntas para Decision

Antes de implementar, necesito tu confirmacion en:

### 10.1 Sobre Tipos de Producto

1. ¿Deseas poder crear tipos de producto "al vuelo" desde el formulario de producto, o solo desde el maestro?
2. ¿El tipo de producto debe ser obligatorio desde el inicio, o permitimos productos sin tipo temporalmente?

### 10.2 Sobre Categorias

1. ¿La jerarquia de 2 niveles (padre/hijo) es suficiente, o necesitas mas niveles?
2. ¿Deseas pre-cargar un catalogo inicial de categorias, o empezar desde cero?
3. ¿Cuantas categorias puede tener un producto como maximo? (sugerencia: 5)

### 10.3 Sobre Etiquetas

1. ¿Las etiquetas deben ser maestro controlado, o permitir crear nuevas libremente?
2. ¿Que tipos de etiqueta son prioritarios? (atributo, certificacion, marketing, origen)

### 10.4 Sobre Migracion

1. ¿Deseas que mapee automaticamente los grupos/subgrupos actuales, o prefieres empezar limpio?
2. ¿Hay algun grupo o subgrupo actual que NO deberia migrarse?

---

## 11. Proximos Pasos

Una vez aprobado este documento:

1. **Confirmar decisiones** de las preguntas anteriores
2. **Crear entidades** (tipos, servicios, stores)
3. **Desarrollar UI** de gestion de maestros
4. **Migrar datos** existentes
5. **Actualizar formulario** de productos
6. **Testing** integral
7. **Deploy** y monitoreo

---

*Documento creado: 2026-01-02*
*Autor: Claude (Asistente de Desarrollo)*
*Version: 1.0*
