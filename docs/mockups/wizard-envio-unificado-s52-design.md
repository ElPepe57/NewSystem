# 🧙 Wizard de Envíos Unificado — Diseño S52

> **Versión 3.0 · 2026-04-22 · Fase 5.0 (Diseño) · APROBADO**
>
> Este documento define el diseño UX + arquitectura del wizard unificado de envíos que reemplazará a los 4 wizards separados actuales (C/E/J/I). F y G se integran en sus módulos naturales (Ventas / Devoluciones).
>
> **Cambio clave v3:** ruta vertical persistente en sidebar + 5 refinamientos visuales + D-3/D-4/D-5 cerradas.
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

## 🗺️ Flujo de 5 pasos (idéntico para todos los tipos)

### Paso 1 — Origen y destino

Formulario apilado vertical en columna izquierda (primero ORIGEN con sus 2 opciones una debajo de la otra, después DESTINO con sus 3 opciones una debajo de la otra). **El feedback del tipo vive en el sidebar derecho** (chip de tipo + ruta vertical):

```
┌──── Formulario (2/3 ancho) ────┐  ┌── Sidebar (1/3) ──┐
│ ¿Desde dónde y hacia dónde?     │  │ 🏷️ Envío intl.     │
│                                 │  │    Casilla → Perú  │
│ ─── ORIGEN ────────             │  ├────────────────────┤
│ ┌─────────────────────────────┐ │  │ 📦 ORIGEN      ✓  │
│ │ ◉ 🌎 Casilla internacional  │ │  │    Casilla 🌎       │
│ └─────────────────────────────┘ │  │         ↓           │
│ ┌─────────────────────────────┐ │  │ ✈️ TRÁNSITO   [4] │
│ │ ○ 🇵🇪 Almacén Perú           │ │  │    (por elegir)    │
│ └─────────────────────────────┘ │  │         ↓           │
│                                 │  │ 🏠 DESTINO     ✓  │
│ ─── DESTINO ───────             │  │    Perú 🇵🇪         │
│ ┌─────────────────────────────┐ │  └────────────────────┘
│ │ ○ 🌎 Casilla internacional  │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ◉ 🇵🇪 Almacén Perú           │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ○ 🏭 Almacén tercero        │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Proporción 65/35** (formulario ancho, sidebar compacto). El colapsable "Ejemplo: ¿qué pasa si elijo una combinación no estándar?" del v3 **se elimina** — el chip del sidebar + el mensaje de admin (cuando aplique) ya cubren ese caso.

**Si el usuario elige una combinación NO soportada** (ej. Cliente → Cliente, o Casilla intl → Almacén tercero), el banner cambia a:

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚠ Combinación no estándar                                          │
│                                                                     │
│  Este tipo de movimiento requiere coordinación con el               │
│  administrador. Contactá al admin para habilitarlo.                 │
│                                                                     │
│  Combinaciones disponibles:                                         │
│  • Casilla intl → Almacén Perú                                      │
│  • Casilla intl → Casilla intl                                      │
│  • Almacén Perú → Almacén Perú                                      │
│  • Almacén Perú → Almacén tercero                                   │
└────────────────────────────────────────────────────────────────────┘
```

El botón "Siguiente" queda deshabilitado.

### Paso 2 — Ubicación de origen + picking

El contenido cambia según lo elegido en Paso 1:

- **Si origen = Casilla intl:** grid de casillas internacionales activas
- **Si origen = Almacén Perú:** grid de almacenes tipo `almacen_propio` en Perú

En ambos casos, al seleccionar la ubicación aparece el **picker de unidades disponibles** (reutiliza `ProductoPickingGroup` actual con priorización de pre-vendidas cuando aplica).

### Paso 3 — Ubicación de destino + campos específicos

El contenido cambia según lo elegido en Paso 1:

- **Destino = Almacén Perú (tipo C):** selector de almacén Perú destino
- **Destino = Almacén Perú (tipo E):** selector de almacén Perú destino + **motivo obligatorio** (Consolidación / Capacidad / Costo menor / Viaje próximo / Otro)
- **Destino = Casilla intl (tipo J):** selector de casilla intl + indicador J1/J2 + warning D-9 si cambia país
- **Destino = Almacén tercero (tipo I):** selector de casillas tipo `almacen_tercero` + **referencia obligatoria** (FBA-XYZ, Consig-001, etc.) + tipo de relación (Fulfillment / Consignación / Distribución / Otro)

### Paso 4 — Logística

Universal para los 4 tipos:

- Transportador (opcional — colaborador tipo viajero/courier/transportista_local según aplique al tipo)
- Número de tracking (opcional)
- Costos del envío — la **moneda se infiere del tipo**:
  - C / J: USD con tipo de cambio
  - E: PEN puro (sin TC)
  - I: USD o PEN por línea (multi-moneda, cross-border + local)

### Paso 5 — Confirmar

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
| 5.0 — Diseño | Documento v3 + mockup v3 (este) | ✅ completada |
| **5.1 — Fundaciones** | Shell + **sidebar ruta vertical** + registry + Paso 1 + Paso 5 | Próxima sesión |
| **5.2 — Pasos adaptativos** | Paso 2 + Paso 3 + Paso 4 con variantes por tipo | Tercera sesión |
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
| 2026-04-22 | **4.0** | **APROBADO.** Paso 1 con formulario apilado vertical en columna izquierda (ORIGEN arriba, DESTINO abajo, cada uno con sus opciones una debajo de la otra). Proporción 65/35 formulario/sidebar. Colapsable "Ejemplo combinación no estándar" eliminado (chip + mensaje admin cuando aplique ya cubren el caso). |
