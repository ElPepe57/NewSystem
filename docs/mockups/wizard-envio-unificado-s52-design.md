# 🧙 Wizard de Envíos Unificado — Diseño S52

> **Versión 6.0 · 2026-04-22 · Fase 5.0 (Diseño) · APROBADO**
>
> Este documento define el diseño UX + arquitectura del wizard unificado de envíos que reemplazará a los 4 wizards separados actuales (C/E/J/I). F y G se integran en sus módulos naturales (Ventas / Devoluciones).
>
> **Cambio clave v6:** Paso 1 rediseñado estilo OCWizardV3. 3 secciones numeradas colapsables (Origen / Destino / Unidades), cada una con buscador + lista apilada cuando está expandida, y botón "Cambiar" cuando está colapsada.
>
> **Audiencia:** dueño del producto (no-técnico) + agentes técnicos que implementarán después.

---

## 🎯 Problema que resuelve

Hoy el módulo de Envíos tiene **6 wizards separados** (T2/J/E/F/I/G) creados orgánicamente durante S44-S51. Cada uno tiene su propia carpeta, su propio reducer, sus propios pasos. Resultado:

- **~1,200 líneas duplicadas** entre los 6 (80% copy-paste según auditoría de agentes)
- **6 botones en el menú "+ Nuevo envío"** que piden al usuario aprender siglas técnicas (T2, J, E, F, I, G)
- **Cada nuevo tipo futuro** requiere crear otro wizard desde cero
- **Inconsistencia visual** entre ellos (distinto número de pasos: 3, 4, 4, 4, 5, 5)

## 💡 Solución: wizard inteligente que infiere el tipo

Inspirado en cómo funciona `OCWizardV3` (el estándar aprobado por el usuario):

> **En OC, el Paso 1 no pregunta "¿qué tipo de OC querés crear?"**
> Pregunta por decisiones concretas (proveedor + método de entrega), y el sistema infiere internamente si es DDP directo, Vía casilla o Recojo directo. El resto del wizard se adapta.

Aplicando el mismo principio a Envíos:

### ❌ Modelo descartado (v1 del diseño)

```
Paso 1: "Elige el tipo"
  [ T2 ]  [ J ]  [ E ]  [ F ]  [ I ]  [ G ]
```

El usuario debe aprender 6 códigos técnicos antes de avanzar.

### ✅ Modelo aprobado (v3 — inteligente + ruta vertical en sidebar)

```
Paso 1: "¿Desde dónde y hacia dónde?"

  ┌─ ORIGEN ──────┐   ┌─ DESTINO ─────┐   │ 🏷️ Envío internacional  │
  │ ○ Casilla     │   │ ○ Casilla     │   │    Casilla → Perú       │
  │ ○ Almacén PE  │   │ ○ Almacén PE  │   ├─────────────────────────┤
  │               │   │ ○ Tercero     │   │ 📦 ORIGEN           ✓  │
  └───────────────┘   └───────────────┘   │    Casilla intl. 🌎     │
                                           │         ↓                │
  (Sin banner de detección; el tipo        │ ✈️ TRÁNSITO         [ ] │
   vive permanentemente en el chip         │    (por elegir)          │
   del sidebar derecho.)                   │         ↓                │
                                           │ 🏠 DESTINO          ✓  │
                                           │    Almacén Perú 🇵🇪      │
                                           └─────────────────────────┘
                                             Sidebar persistente
```

El usuario **nunca ve "T2"** — ve lenguaje de negocio. La **ruta vertical del sidebar** le muestra visualmente hacia dónde va conforme avanza por los pasos.

---

## 📋 Tipos soportados en el wizard unificado

El wizard **solo maneja 4 tipos** — los que nacen "desde cero" sin documento vinculado:

| Origen | Destino | Tipo técnico | Nombre visible al usuario |
|---|---|---|---|
| Casilla intl. | Almacén Perú | **C (T2)** | Envío internacional (Casilla → Perú) |
| Casilla intl. | Casilla intl. | **J** | Movimiento internacional entre casillas |
| Almacén Perú | Almacén Perú | **E** | Traslado interno en Perú |
| Almacén Perú | Almacén tercero | **I** | Envío a tercero (stock bloqueado) |

### Tipos FUERA del wizard unificado

Los casos que requieren un documento vinculado obligatoriamente (`ventaId` o `devolucionId`) **NO viven en este wizard**. Se automatizan desde sus módulos naturales:

| Caso | Dónde vive | Trigger |
|---|---|---|
| **F (Despacho venta)** | Módulo Ventas | Botón "Despachar" en detalle de Venta → crea envío F automáticamente |
| **G (Retorno devolución)** | Módulo Devoluciones | Botón "Procesar retorno" en detalle de Devolución → crea envío G automáticamente |
| **A / B / D (Wizard OC)** | Módulo Compras | Ya están automatizados desde `OCWizardV3` al confirmar OC |

**Razón:** estos tipos nacen **siempre vinculados** a otro documento (venta, devolución, OC). Pedirle al usuario navegar a `/envios` y luego buscar la venta/devolución es una doble navegación innecesaria. Que nazca desde el documento origen es el flujo natural.

Ver sección **"Tareas derivadas"** al final para el trabajo pendiente en esos módulos.

---

## 🗺️ Sidebar de ruta vertical (novedad v3)

**El sidebar derecho del wizard es persistente a lo largo de los 5 pasos** y contiene 3 elementos:

1. **Chip de tipo inferido** (arriba) — siempre visible, cambia de color según tipo detectado
2. **Ruta vertical 3-bloques** — ORIGEN → TRÁNSITO → DESTINO, con conectores verticales punteados
3. **Panel de resumen** (abajo) — KPIs que se actualizan (unidades, CTRU, flete, gran total)

### R1 — Llenado progresivo en 2 niveles

| Paso | ORIGEN | TRÁNSITO | DESTINO |
|---|---|---|---|
| Entrada (Paso 1) | *(por elegir)* | *(por elegir)* | *(por elegir)* |
| Paso 1 completo (categorías) | **Casilla intl. 🌎** ✓ | *(por elegir)* | **Almacén Perú 🇵🇪** ✓ |
| Paso 2 (refina origen) | **Felicita · Miami 🇺🇸** ✓ | *(por elegir)* | Almacén Perú 🇵🇪 ✓ |
| Paso 3 (refina destino) | Felicita · Miami 🇺🇸 ✓ | *(por elegir)* | **Almacén Lima Centro 🇵🇪** ✓ |
| Paso 4 (llena tránsito) | Felicita · Miami 🇺🇸 ✓ | **Juan Pérez ✈️ ($280)** ✓ | Almacén Lima Centro 🇵🇪 ✓ |

### R2 — 3 estados visuales por bloque

- **Pendiente** → fondo `slate-50`, borde punteado `slate-200`, texto *italic "(por elegir)"*, badge gris con número del paso donde se definirá
- **Actual** (este paso lo refina) → fondo `blue-50`, borde `blue-500` con animación pulsante, badge azul ⟳, texto "Seleccionando…"
- **Completo** → fondo `green-50`, borde `green-500` sólido, badge verde ✓, cursor pointer, tooltip "Click para editar"
- **Completo categoría** (intermedio, tras Paso 1) → fondo `emerald-50`, borde `emerald-500`, badge ✓, texto "Por refinar en Paso X"

### R3 — Chip de tipo inferido arriba del sidebar

Aparece tan pronto como Paso 1 tiene origen + destino seleccionados:

| Tipo | Color chip | Texto |
|---|---|---|
| C | Teal | Envío internacional · Casilla → Perú |
| J | Sky | Movimiento internacional · Casilla → Casilla |
| E | Amber | Traslado interno · Perú → Perú |
| I | Violet | Envío a tercero · Almacén → Fulfillment |

Reemplaza el banner "DETECTADO AUTOMÁTICAMENTE" del v2 (que era intrusivo en Paso 1).

### R4 — Click en bloque completo = jump-back

Los bloques en estado *completo* son clickeables. Llevan al usuario al paso donde se definieron (efectivamente un breadcrumb visual alternativo al stepper horizontal). Tooltip: "Click para editar (Paso X)".

### R5 — Icono fijo por rol + tránsito dinámico por modo

- 📦 **ORIGEN** — fijo siempre
- 🏠 **DESTINO** — fijo siempre
- ✈️ / 🚢 / 🚚 **TRÁNSITO** — cambia según el modo de transporte elegido en Paso 4 (aéreo / marítimo / terrestre)

El label del bloque tránsito también cambia: "Tránsito · Aéreo" / "Tránsito · Marítimo" / "Tránsito · Terrestre".

---

## 🗺️ Flujo de 4 pasos (v5 · con Paso 1 integrado)

Novedad v5: el Paso 1 y el Paso 2 del v4 se integran en un solo paso con progressive disclosure. El Paso 2 del v5 es condicional (solo tipos E e I). Wizard pasa de 5 → 4 pasos.

### Paso 1 — Origen + destino + unidades (estilo OCWizardV3)

Paso 1 se estructura en **3 secciones numeradas colapsables** estilo OC:

| Sección | Contenido expandido | Contenido colapsado |
|---|---|---|
| **[1] Origen** | Radios de categoría (Casilla intl / Almacén Perú) + buscador + lista apilada de ubicaciones específicas | Resumen: icono + nombre + metadata + chip categoría + ✓ + link "Cambiar" |
| **[2] Destino** | Radios de categoría (Casilla intl / Almacén Perú / Almacén tercero) + buscador + lista apilada de destinos específicos | Resumen: icono + nombre + metadata + chip categoría + ✓ + link "Cambiar" |
| **[3] Unidades** | Buscador + banner pre-vendidas (si aplica) + lista apilada de productos con stepper +/- | No se colapsa (multi-selección, la cantidad en el título lo resume) |

**Patrón interactivo:**
- Al ingresar al paso, la sección [1] está EXPANDED con buscador + cards apiladas. [2] y [3] están desactivadas hasta completar [1].
- Al seleccionar una opción en [1], la sección colapsa automáticamente mostrando solo la selección + link "Cambiar" a la derecha, y [2] se activa y expande.
- Click en "Cambiar" de cualquier sección colapsada → re-expande para editar.
- Cuando [1] y [2] están completas, [3] Unidades se expande con buscador + lista.

**El feedback del tipo vive en el sidebar derecho** (chip de tipo + ruta vertical con nombres específicos al completar este paso):

```
┌────── Paso 1 · Formulario 65% ───────────┐ ┌── Sidebar 35% ──┐
│                                           │ │ 🏷️ Envío intl.   │
│ ─── 📦 Origen ──────────────              │ │    Casilla → PE  │
│ ◉ 🌎 Casilla internacional                │ ├──────────────────┤
│ ○ 🇵🇪 Almacén Perú                         │ │ 📦 ORIGEN    ✓  │
│                                           │ │    Felicita      │
│   ┌ Casillas disponibles ────┐           │ │    🇺🇸 · 14 uds    │
│   │ ◉ 🇺🇸 Felicita Miami ⭐   │           │ │        ↓          │
│   │ ○ 🇨🇳 Angie Guangzhou     │           │ │ ✈️ TRÁNSITO [3] │
│   └──────────────────────────┘           │ │    (por elegir)  │
│                                           │ │        ↓          │
│ ─── 🏠 Destino ──────────────             │ │ 🏠 DESTINO   ✓  │
│ ○ 🌎 Casilla  ◉ 🇵🇪 PE  ○ 🏭 3ro         │ │    Almacén Lima  │
│                                           │ └──────────────────┘
│   ┌ Almacenes disponibles ──┐            │
│   │ ◉ Lima Centro ⭐         │            │
│   │ ○ Arequipa Sur          │            │
│   └─────────────────────────┘            │
│                                           │
│ ─── 📦 Unidades (14 / 47) ────            │
│ 🎯 4 pre-vendidas · incluir auto         │
│ 💊 Ashwagandha     [- 8 +] / 12          │
│ 🧴 Soothing Cream  [- 6 +] / 15          │
│ 💧 DHA Bebés       [- 0 +] / 20          │
└───────────────────────────────────────────┘
```

**Proporción 65/35** (formulario ancho, sidebar compacto). **Progressive disclosure**: cada sub-sección solo aparece cuando la anterior está completa. Al terminar Paso 1, la ruta del sidebar queda al 95% llena (falta solo TRÁNSITO que se define en Paso 3).

**Si el usuario elige una combinación NO soportada** (ej. Cliente → Cliente, o Casilla intl → Almacén tercero), el sidebar muestra un chip rojo "Combinación no estándar" y en el contenido aparece el mensaje "Requiere coordinación con el administrador". El botón "Siguiente" queda deshabilitado.

### Paso 2 — Destino detalles (CONDICIONAL)

Este paso **solo aparece para tipos E e I**. Para tipos C y J se salta automáticamente (del Paso 1 se va directo a Paso 3 Logística). Banner informativo al inicio del paso aclara esta condición al usuario.

Campos según tipo:

- **Tipo E (Perú → Perú):** motivo obligatorio (Consolidación / Capacidad / Costo menor / Viaje próximo / Otro) + campo libre "detalle"
- **Tipo I (Perú → Tercero):** referencia obligatoria (FBA-XYZ, Consig-001, etc.) + tipo de relación (Fulfillment / Consignación / Distribución / Otro) + banner de bloqueo de stock

### Paso 3 — Logística

Universal para los 4 tipos:

- Transportador (opcional — colaborador tipo viajero/courier/transportista_local según aplique al tipo)
- Número de tracking (opcional)
- Costos del envío — la **moneda se infiere del tipo**:
  - C / J: USD con tipo de cambio
  - E: PEN puro (sin TC)
  - I: USD o PEN por línea (multi-moneda, cross-border + local)

### Paso 4 — Confirmar

Resumen universal con:
- Header con tipo detectado en lenguaje humano (sin siglas)
- Ruta visual origen → destino
- KPIs: unidades, productos, valor CTRU, costos landed totales
- Efectos al confirmar (qué va a pasar cuando se cree el envío)
- Banner de alertas específicas del tipo (ej. para tipo I: "🔒 Stock bloqueado hasta retorno o liquidación")
- Botón con label dinámico:
  - "Crear y despachar" (tipo C)
  - "Crear envío entre casillas" (tipo J)
  - "Crear traslado interno" (tipo E)
  - "Crear envío a tercero" (tipo I)

---

## 🏗️ Arquitectura técnica propuesta

Basada en el reporte del `system-context-reader`: **registry de configuración por tipo**, NO mega-reducer monolítico.

```
src/pages/Envios/EnvioWizard/                    (reemplaza 4 carpetas)
├── EnvioWizardPage.tsx                          (shell común, ~300 líneas)
├── envioWizardTypes.ts                          (state + reducer genérico)
├── registry/                                     (configuración por tipo)
│   ├── index.ts                                 (union + dispatch)
│   ├── tipoC.config.ts                          (~40 líneas por tipo)
│   ├── tipoJ.config.ts
│   ├── tipoE.config.ts
│   └── tipoI.config.ts
├── steps/                                        (pasos reutilizables)
│   ├── StepOrigenDestino.tsx                    (Paso 1 — inferencia)
│   ├── StepOrigenUbicacion.tsx                  (Paso 2 — casilla/almacén)
│   ├── StepDestinoUbicacion.tsx                 (Paso 3 — destino + campos)
│   ├── StepLogistica.tsx                        (Paso 4 — transporte + costos)
│   └── StepConfirmar.tsx                        (Paso 5 — resumen + submit)
├── shared/                                       (átomos compartidos)
│   ├── ProductoPickingGroup.tsx                 (ya existe en T2)
│   ├── BannerPriorizacion.tsx                   (ya existe en T2)
│   ├── TarifaPresetSelector.tsx                 (ya existe en T2)
│   ├── CTRULandedPreview.tsx                    (ya existe en T2)
│   ├── EnvioWizardPreview.tsx                   (panel lateral universal)
│   └── TipoDetectadoBanner.tsx                  (NUEVO — banner del Paso 1)
└── hooks/
    ├── useEnvioWizardState.ts                   (state + reducer centralizado)
    └── useTipoInferido.ts                       (lógica de inferencia Paso 1)
```

**State shape (única fuente de verdad):**

```ts
interface EnvioWizardState {
  // Paso 1 — decisiones tempranas (inferencia del tipo)
  origenTipo: 'casilla_intl' | 'almacen_peru' | null;
  destinoTipo: 'casilla_intl' | 'almacen_peru' | 'almacen_tercero' | null;
  tipoInferido: 'C' | 'J' | 'E' | 'I' | null;  // derivado, no se setea manualmente

  // Paso 2 — ubicación origen
  ubicacionOrigenId: string;
  unidadesIdsSeleccionadas: string[];

  // Paso 3 — ubicación destino + campos específicos según tipo
  ubicacionDestinoId: string;
  motivo?: MotivoEnvioInterno;             // solo E
  motivoDetalle?: string;                  // solo E
  referenciaTercero?: string;              // solo I
  tipoRelacion?: TipoRelacionTercero;      // solo I
  advertenciaCambioPais?: boolean;         // solo J (derivado)

  // Paso 4 — logística universal
  colaboradorTransporteId: string;
  numeroTracking: string;
  costos: CostoUnificado[];                // moneda se determina por tipo

  // Paso 5
  notas: string;

  // Metadata
  pasoActual: number;
  ultimoPasoValidado: number;
}
```

**Registry por tipo** (ejemplo):

```ts
// tipoC.config.ts
export const tipoCConfig: EnvioTipoConfig = {
  tipo: 'C',
  nombre: 'Envío internacional (Casilla → Perú)',
  descripcion: 'Consolidación de unidades...',
  moneda: 'USD',
  pipelineHorizontal: [...],  // nodos del EntityPipeline
  camposObligatorios: [],     // ningún extra vs el base
  buildPayload: (state) => ({ /* arma CrearEnvioT2Payload */ }),
  crear: envioCrudService.crearEnvioT2,
};
```

Cada `tipoX.config.ts` tiene ~40 líneas, el shell común tiene ~300 líneas, y los 5 steps tienen ~1,200 líneas totales. **Ahorro neto estimado: ~1,200 líneas vs. la situación actual.**

---

## 🚫 Anti-patrones evitados en este diseño

1. ❌ **No hay "mega-reducer"** — cada tipo tiene su config independiente en `registry/`
2. ❌ **No hay modal sobre modal** — el wizard vive en su propia ruta `/envios/nuevo`
3. ❌ **No hay jerga técnica para el usuario** — "T2" jamás aparece en la UI, solo nombres en lenguaje humano
4. ❌ **No hay pasos fijos forzados** — los 5 pasos tienen sentido para los 4 tipos (validado paso a paso)
5. ❌ **No se mezclan F/G en el wizard** — esos casos viven en sus módulos naturales (Ventas/Devoluciones)

---

## ✅ Decisiones del usuario — todas cerradas en v3

### D-1 · Cambio de tipo a mitad del flujo
**Política:** no se permite. Si por alguna razón queda un borrador incompleto en el sistema, **se elimina automáticamente** (background cleanup de borradores con `fechaActualizacion` antigua, política por definir).

### D-2 · Sistema inteligente con inferencia
**Decisión:** el tipo se infiere automáticamente desde el Paso 1 (origen + destino). El usuario nunca ve siglas técnicas ("T2", "C", "J", "E", "I"). El tipo inferido vive en el chip del sidebar.

### D-3 · Tipos auto-creados — NO se muestran en Paso 1
**Decisión:** la sección colapsable "Otros tipos que nacen automáticamente" del diseño v2 **se elimina**. La ruta vertical del sidebar + el chip de tipo inferido ya dan suficiente contexto visual al usuario. Si el usuario intenta una combinación que correspondería a un tipo auto-creado (ej. almacén Perú → cliente), el banner de "coordinación con admin" los orienta.

### D-4 · Reemplazo directo — sin feature flag
**Decisión:** Opción B. Al mergear Fase 5.3 se eliminan los 4 wizards C/J/E/I en el mismo commit. **No se usa `WIZARD_UNIFICADO` flag.** Justificación del usuario: simplifica el delivery, evita deuda técnica de mantener 2 implementaciones. Mitigación de riesgo: UAT funcional riguroso antes del merge + posibilidad de revert de commit si aparece regresión crítica.

### D-5 · Labels del stepper — genéricos fijos
**Decisión:** los labels del stepper permanecen genéricos para los 4 tipos:
1. Origen/destino
2. Ubicación
3. Destino
4. Logística
5. Confirmar

**Justificación:** el chip de tipo inferido + la ruta vertical del sidebar ya comunican el contexto específico. Duplicarlo en el stepper sería redundante.

### D-A · Casos F y G fuera del wizard
**Decisión:** **No van en el wizard unificado.** Se integran directamente en:
- Módulo **Ventas** → botón "Despachar venta" en detalle que crea envío F automáticamente
- Módulo **Devoluciones** → botón "Procesar retorno" en detalle que crea envío G automáticamente

**Justificación:** ambos casos requieren siempre un documento vinculado (venta o devolución). El flujo natural es nacer desde ese documento, no desde `/envios`.

### D-B · Combinaciones no válidas
**Decisión:** el Paso 1 muestra un banner con el mensaje **"Esta combinación requiere coordinación con el administrador. Contactá al admin para habilitarlo."** y el botón "Siguiente" queda deshabilitado. Se listan abajo las combinaciones disponibles como guía.

### D-R · Sidebar de ruta vertical persistente (novedad v3)
**Decisión:** se agrega un sidebar derecho persistente durante todo el wizard con 3 bloques verticales (Origen / Tránsito / Destino) que se van llenando progresivamente en 2 niveles (categoría primero, nombre específico después). Aplica los 5 refinamientos R1-R5 descritos en la sección correspondiente.

### D-6 · Integración Paso 1 + Paso 2 del v4 (novedad v5)
**Decisión:** combinación en un solo paso con progressive disclosure. Wizard pasa de 5 → 4 pasos. El Paso 1 nuevo se llama "Origen + destino + unidades" y contiene 5 sub-secciones que aparecen secuencialmente: categoría origen → casillas disponibles → categoría destino → ubicación destino → unidades.

**Justificación del usuario:** "me gustan ambas interfaces" (la selección de categoría del Paso 1 anterior + el picker del Paso 2 anterior). Integrarlas reduce saltos innecesarios y permite ver todas las decisiones geográficas + el picker en un solo scroll.

### D-7 · Campos específicos del destino en paso separado (novedad v5)
**Decisión:** los campos obligatorios de tipo E (motivo) y tipo I (referencia + tipo de relación) viven en un Paso 2 dedicado y **condicional** — solo aparece cuando el tipo lo requiere. Para tipos C y J el wizard salta directo de Paso 1 a Paso 3.

**Justificación:** mantener el Paso 1 manejable. Los campos del destino son decisiones legales/operativas que merecen foco propio. Para los tipos C/J que no los requieren, el wizard efectivo son 3 pasos (Paso 1 + Paso 3 + Paso 4), sin overhead visible.

### D-8 · Paso 1 con secciones colapsables estilo OCWizardV3 (novedad v6)
**Decisión:** el Paso 1 se estructura en 3 secciones numeradas [1] [2] [3] con 2 estados cada una (EXPANDED / COLLAPSED), replicando el patrón de `OCWizardV3` paso "Ruta".

**Elementos del patrón:**
- **Header numerado:** badge circular con número ([1] [2] [3]) + título + link "Cambiar" a la derecha cuando está colapsada.
- **Buscador siempre presente en estado expandido:** input con icono 🔍 y placeholder descriptivo (ej. "Buscar casilla por nombre, ciudad, país…").
- **Cards apiladas verticales** (no grid 2×2). Cada card ocupa ancho completo: icono + nombre + metadata + checkmark a la derecha cuando seleccionado.
- **Colapso automático al seleccionar:** muestra solo la opción elegida + link "Cambiar" para re-expandir.

**Justificación del usuario:** "en la medida de lo posible que exista un buscador y se apilen asi como en esta version… que cuando lo escojas el desplegable se centre solo en ese, y que cuando le vuelvas a dar click a la misma seccion se vuelva abrir, asi como en Nueva Orden de Compra". Aplica también para el buscador de unidades.

### D-9 · Costos del envío — modalidad "Variable" con tabla inline (Paso 3)

**Contexto:** el Paso 3 "Logística" ofrece 3 modalidades de costos del envío: `Monto total` / `Por unidad` / `Variable`. El mockup v6 muestra las 3 opciones pero no detalla la UX de "Variable".

**Decisión:** al seleccionar "Variable", se despliega una **tabla inline** debajo del selector de modalidad con una fila por cada producto elegido en el Paso 1 Unidades:

```
┌──────────────────────────────────────────────────────────────────┐
│  Producto                  │ Cant  │ Costo unit.  │ Subtotal     │
├──────────────────────────────────────────────────────────────────┤
│  💊 Ashwagandha KSM-66     │  8    │  [$ 12.00 ]  │  $ 96.00     │
│  🧴 Soothing Cream         │  6    │  [$ 25.00 ]  │  $ 150.00    │
│  💧 DHA para Bebés         │  0    │  [$ 18.00 ]  │  $ 0.00      │
├──────────────────────────────────────────────────────────────────┤
│                                      TOTAL FLETE:  $ 246.00      │
└──────────────────────────────────────────────────────────────────┘
```

**Reglas:**
- Solo el campo "Costo unit." es editable, el subtotal es derivado (`cant × costo`).
- El total reemplaza el valor del campo "Monto total del flete" global.
- Si el usuario vuelve al Paso 1 Unidades y cambia cantidades, la tabla se re-renderiza (keep los costos unitarios ya ingresados).
- Si agrega un producto nuevo en Paso 1, aparece nueva fila con costo vacío.

**Justificación:** los productos tienen peso/volumen heterogéneo (una crema vs una cápsula). El modo "Variable" permite calibrar el costo real por SKU cuando el prorrateo por unidad o por peso no refleja la realidad.

### D-10 · Tipo de cambio auto-poblado desde la sección TC del sistema (Paso 3)

**Contexto:** el mockup v6 muestra el TC como un input editable. Esto contradice la política del sistema: el TC vive en una sección dedicada (`tiposDeCambio`) que todos los módulos consumen como fuente única de verdad.

**Decisión:** el campo "Tipo de cambio (PEN/USD)" del Paso 3 **no es un input editable por defecto**. Es un **chip read-only** auto-poblado con la tasa activa del día, con opción de override manual explícito (con warning).

**Comportamiento correcto:**

```
┌────────────────────────────────────────────────────────┐
│  💱 Tipo de cambio: 3.780 PEN/USD                      │
│     Tasa del día · SBS · actualizada 22-abr-2026 08:00 │
│     [Editar manualmente ↗]                             │
└────────────────────────────────────────────────────────┘
```

**Reglas:**
- Al entrar al Paso 3, se lee la tasa activa desde `tiposDeCambio` del sistema.
- Chip muestra: TC + fuente (SBS / Google / manual) + timestamp.
- Link "Editar manualmente" abre modal de confirmación con texto: "Estás reemplazando el TC oficial del día. Se registrará en auditoría quién y cuándo lo hizo."
- Si el usuario overridea, el chip cambia a color amber: "TC manual · editado por [usuario] · [fecha/hora]".
- El TC override se persiste en el envío pero NO actualiza la tabla `tiposDeCambio` global.

**Aplica también a:**
- OCWizardV3 (ya usa TC del sistema — verificar consistencia)
- Cualquier otro módulo con operaciones en USD (ventas internacionales, CxP proveedor USD, etc.)

**Justificación del usuario:** "el sistema ya maneja un tipo de cambio establecido que viene desde la seccion TC, asi que la referencia de la compra se toma de ahi". Evita inconsistencias entre módulos y cumple con la política de fuente única de verdad para variables financieras.

---

## 📦 Tareas derivadas (fuera del alcance de Fase 5)

Como F y G salen del wizard unificado, estas quedan como tareas pendientes:

### Tarea T-F · Integrar creación de envío F en módulo Ventas

**Ubicación:** `src/pages/Ventas/` → `VentaCard.tsx` o `VentaDetailModal.tsx` (el que corresponda)

**Qué hacer:**
- Agregar botón **"Despachar venta"** en el detalle de una Venta en estado `confirmada / reservada / parcial / asignada / en_entrega`
- Al clicarlo, abrir un **flujo embedded** (siguiendo el patrón S52 de OC: `useEmbeddableView`) con los pasos: Elegir almacén origen → Picking → Detalles → Confirmar
- Al confirmar, llamar a `envioCrudService.crearEnvioF()` con la venta ya vinculada
- La venta transita a `despachada` al confirmar

**Estimación:** 1 sesión (~400 líneas en total, incluyendo cambios en `VentaCard`)

### Tarea T-G · Integrar creación de envío G en módulo Devoluciones

**Ubicación:** `src/pages/Ventas/DevolucionesTab.tsx` o `DevolucionFormModal.tsx`

**Qué hacer:**
- Agregar botón **"Procesar retorno físico"** en el detalle de una Devolución en estado `aprobada`
- Al clicarlo, abrir flujo embedded con: Confirmar unidades devueltas → Elegir almacén receptor → Detalles → Confirmar
- Al confirmar, llamar a `envioCrudService.crearEnvioG()` con la devolución ya vinculada
- La devolución queda lista para transitar a `ejecutada` cuando se reciba físicamente

**Estimación:** 1 sesión (~300 líneas, flujo más simple que F)

### Tarea T-Cleanup · Eliminar wizards F y G actuales

Una vez que T-F y T-G estén implementadas y validadas, se pueden eliminar:
- `src/pages/Envios/EnvioWizardF/` (completa)
- `src/pages/Envios/EnvioWizardG/` (completa)
- Botones "Despachar venta" y "Retorno devolución" del `NuevoEnvioMenu`
- Rutas `/envios/nuevo-f` y `/envios/nuevo-g` en `App.tsx`
- Flags `WIZARD_F` y `WIZARD_G` en `config/features.ts`

---

## 📅 Cronograma estimado

| Fase | Alcance | Sesión estimada |
|---|---|---|
| 5.0 — Diseño | Documento v5 + mockup v5 (este) | ✅ completada |
| **5.1 — Fundaciones** | Shell + **sidebar ruta vertical** + registry + Paso 1 integrado + Paso 4 confirmar | Próxima sesión |
| **5.2 — Pasos adaptativos** | Paso 2 condicional (E/I) + Paso 3 logística con variantes de moneda | Tercera sesión |
| **5.3 — Migración + delete** | Reemplazo directo (D-4) — se eliminan los 4 wizards C/J/E/I en el mismo commit | Cuarta sesión |
| T-F (derivada) | Integrar F en Ventas | Sesión aparte |
| T-G (derivada) | Integrar G en Devoluciones | Sesión aparte |
| T-Cleanup | Eliminar legacy F/G + rutas | Mini-sesión al final |

**Total Fase 5 estimado:** 4 sesiones para el wizard unificado + 2 sesiones derivadas + 1 cleanup = **7 sesiones** para cerrar todo el alcance.

---

## 📚 Glosario para no-desarrolladores

- **Wizard:** formulario en varios pasos (vos elegís cosas, vas avanzando con "Siguiente")
- **Registry de configuración:** un archivo por tipo donde dice "para tipo X, el Paso 2 muestra esto, el Paso 3 muestra aquello, el servicio a llamar es Y"
- **Shell común:** la estructura visual compartida (navegación, botones, panel lateral) que no cambia entre tipos
- **Inferencia:** el sistema deduce algo a partir de lo que elegiste (ej. elegiste Casilla + Perú → deduce que es tipo C, vos nunca viste "C")
- **Embedded:** un formulario que se muestra "dentro" de otra pantalla, en vez de abrir otra ventana encima (evita modal sobre modal)
- **Feature flag:** interruptor para encender/apagar funcionalidad sin desplegar nuevo código

---

## ✍️ Versiones

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-04-21 | 1.0 | Versión inicial — 5 pasos con selector de tipo explícito (descartada) |
| 2026-04-21 | 2.0 | Rediseño con inferencia automática del tipo · F/G movidos a sus módulos · 4 tipos soportados (C/J/E/I) · combinaciones inválidas con mensaje de coordinación |
| 2026-04-22 | 3.0 | Sidebar con ruta vertical persistente (chip tipo + 3 bloques Origen/Tránsito/Destino + KPIs). 5 refinamientos R1-R5 (llenado progresivo 2 niveles, 3 estados visuales, chip tipo, jump-back en bloque completo, iconos por rol). D-3 cerrada (no se muestran tipos auto-creados). D-4 cerrada (reemplazo directo sin flag). D-5 cerrada (labels genéricos fijos). Banner "DETECTADO AUTOMÁTICAMENTE" del Paso 1 eliminado. |
| 2026-04-22 | 4.0 | Paso 1 con formulario apilado vertical en columna izquierda (ORIGEN arriba, DESTINO abajo, cada uno con sus opciones una debajo de la otra). Proporción 65/35 formulario/sidebar. Colapsable "Ejemplo combinación no estándar" eliminado (chip + mensaje admin cuando aplique ya cubren el caso). |
| 2026-04-22 | 5.0 | Wizard de 5 → 4 pasos. Paso 1 integrado con progressive disclosure (categoría origen → casillas disponibles → categoría destino → ubicación destino → unidades). Paso 2 condicional (solo E e I). D-6 y D-7 cerradas. El Paso 1 del v4 + el Paso 2 del v4 se integran en el Paso 1 del v5 según pedido del usuario ("me gustan ambas interfaces"). |
| 2026-04-22 | 6.0 | Paso 1 rediseñado estilo OCWizardV3. 3 secciones numeradas [1] [2] [3] colapsables (Origen / Destino / Unidades). Cada sección: buscador 🔍 + cards apiladas verticales en estado EXPANDED; resumen + link "Cambiar" en estado COLLAPSED. D-8 cerrada. Buscador también en Unidades según pedido del usuario. |
| 2026-04-22 | **6.1** | Decisiones D-9 y D-10 añadidas para la implementación del Paso 3 Logística (no se modifica mockup). D-9: la modalidad "Variable" de costos despliega tabla inline con una fila por producto (costo unit. editable, subtotal derivado, total reemplaza el campo global). D-10: el TC se auto-puebla desde la sección `tiposDeCambio` del sistema (read-only por defecto, override manual explícito con modal de confirmación y auditoría). |
