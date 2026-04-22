# 🧙 Wizard de Envíos Unificado — Diseño S52

> **Versión 2.0 · 2026-04-21 · Fase 5.0 (Diseño)**
>
> Este documento define el diseño UX + arquitectura del wizard unificado de envíos que reemplazará a los 4 wizards separados actuales (C/E/J/I). F y G se integran en sus módulos naturales (Ventas / Devoluciones).
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

### ✅ Modelo aprobado (v2 — inteligente)

```
Paso 1: "¿Desde dónde y hacia dónde?"

  ┌─── ORIGEN ──────────┐      ┌─── DESTINO ─────────┐
  │ ○ Casilla intl.     │      │ ○ Casilla intl.     │
  │ ○ Almacén Perú      │  →   │ ○ Almacén Perú      │
  │                     │      │ ○ Almacén tercero   │
  └─────────────────────┘      └─────────────────────┘

  ✨ Detectado: Envío internacional (Casilla → Perú)
     Consolidación de unidades desde casilla USA/CN/KR hacia Perú
```

El usuario **nunca ve "T2"** — ve lenguaje de negocio.

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

## 🗺️ Flujo de 5 pasos (idéntico para todos los tipos)

### Paso 1 — Origen y destino

Dos selectores lado a lado + banner inteligente que se actualiza en vivo:

```
┌────────────────────────────────────────────────────────────────────┐
│  ¿Desde dónde y hacia dónde?                                        │
│                                                                     │
│  ┌─ Origen ──────────────┐      ┌─ Destino ─────────────┐          │
│  │ ◉ 🌎 Casilla intl.     │      │ ○ 🌎 Casilla intl.     │          │
│  │ ○ 🇵🇪 Almacén Perú     │      │ ◉ 🇵🇪 Almacén Perú     │          │
│  │                       │      │ ○ 🏭 Almacén tercero   │          │
│  └───────────────────────┘      └───────────────────────┘          │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ✨ Detectado: Envío internacional (Casilla → Perú)         │    │
│  │    Consolidás unidades de tu casilla en USA/CN/KR para     │    │
│  │    enviarlas al almacén de Perú.                           │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

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

## ✅ Decisiones del usuario (ya aprobadas)

### D-1 · Cambio de tipo a mitad del flujo
**Política:** no se permite. Si por alguna razón queda un borrador incompleto en el sistema, **se elimina automáticamente** (background cleanup de borradores con `fechaActualizacion` antigua, política por definir).

### D-A · Casos F y G (NUEVA DECISIÓN CLAVE)
**Decisión:** **No van en el wizard unificado.** Se integran directamente en:
- Módulo **Ventas** → botón "Despachar venta" en detalle que crea envío F automáticamente
- Módulo **Devoluciones** → botón "Procesar retorno" en detalle que crea envío G automáticamente

**Justificación:** ambos casos requieren siempre un documento vinculado (venta o devolución). El flujo natural es nacer desde ese documento, no desde `/envios`.

### D-B · Combinaciones no válidas
**Decisión:** el Paso 1 muestra un banner con el mensaje **"Esta combinación requiere coordinación con el administrador. Contactá al admin para habilitarlo."** y el botón "Siguiente" queda deshabilitado. Se lista abajo las combinaciones disponibles como guía.

---

## ❓ Decisiones que quedan pendientes (3)

### D-3 · ¿Se muestran los tipos del wizard de OC (A/B/D) como informativos en el Paso 1?

Los tipos A, B, D nacen automáticamente desde la OC (nunca desde este wizard). La pregunta es si aparecen en el Paso 1 como **tarjetas informativas deshabilitadas** para documentación visual.

- **A** — No aparecen. El Paso 1 solo muestra las 4 combinaciones soportadas.
- **B** — Aparecen como sección "Otros tipos (nacen automáticamente)" con tooltip educativo.

**Recomendación:** B. El usuario novato ve el mapa completo y entiende que esos tipos existen pero se crean desde otro flujo.

### D-4 · ¿Convivencia con los 4 wizards actuales durante migración?

- **A** — Feature flag `WIZARD_UNIFICADO` activa el nuevo, los 4 viejos (T2/J/E/I) siguen vivos como fallback hasta validación.
- **B** — Reemplazo total desde el primer commit.

**Recomendación:** A. Consistente con el patrón de rollout que usamos en S44-S51. Permite rollback rápido si algo falla en UAT.

### D-5 · Label dinámico del stepper

Los labels del stepper (Paso 2 "Origen", Paso 3 "Destino", etc.) son genéricos. ¿Querés que sean **específicos según el tipo** detectado?

- **A** — Genérico fijo: Paso 2 = "Origen", Paso 3 = "Destino" (siempre)
- **B** — Dinámico: Paso 2 = "Casilla origen" (tipo C) / "Almacén origen" (tipo E) / etc.

**Recomendación:** A. Simpleza. El breadcrumb ya dice qué tipo es, los labels del stepper pueden ser genéricos.

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
| 5.0 — Diseño | Documento + mockup (este) | ✅ completada |
| **5.1 — Fundaciones** | Shell + registry + Paso 1 + Paso 5 (el "esqueleto") | Próxima sesión |
| **5.2 — Pasos adaptativos** | Paso 2 + Paso 3 + Paso 4 con variantes por tipo | Tercera sesión |
| **5.3 — Migración** | Reemplazar los 4 wizards C/J/E/I por el unificado tras flag UAT | Cuarta sesión |
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
