# 🎨 Guía de Diseño — BusinessMN v2 ERP

> **Versión 1.0 · S52 · 2026-04-21**
>
> Esta guía define **cómo se ven y funcionan las pantallas** del ERP. Su objetivo es que todas las secciones sigan un mismo norte visual y UX, y que construir nuevas pantallas sea cuestión de **ensamblar piezas existentes**, no de inventar desde cero.
>
> **Audiencia:** cualquier persona que vaya a pedir una pantalla nueva o revisar una existente. No requiere conocimiento técnico profundo.

---

## 📐 Cómo está organizado el diseño

El sistema tiene **3 capas de piezas**, ordenadas de más chica a más grande. Cuando construimos una pantalla nueva, **siempre partimos de la capa más alta disponible** y solo bajamos si falta algo.

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 — Plantillas de pantalla                                 │
│  "Cómo se ve un detalle de entidad", "Cómo se ve una lista"      │
│  Ej: EntityDetailShell, ModuleListPage                           │
└─────────────────────────────────────────────────────────────────┘
                            ↑ se arma con
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 — Patrones de composición                                │
│  Piezas medianas: barra de KPIs, pipeline, banner CTA, toolbar   │
│  Ej: KpiRow, EntityPipeline, NextActionBanner                    │
└─────────────────────────────────────────────────────────────────┘
                            ↑ se arma con
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — Piezas básicas                                         │
│  Lo más atómico: botón, input, badge, modal, card                │
│  Ej: Button, Modal, Badge, Input                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Regla de oro:** si necesitás una pieza que no existe en la capa que necesitás, **se crea primero la pieza** en el lugar correcto y después se usa. **Nunca se copia-pega código de otra pantalla.**

---

## 🏛️ El estándar: "Patrón OC"

Las pantallas del ERP siguen el patrón establecido en el módulo **Órdenes de Compra**. Cuando diseñamos algo nuevo, preguntamos: **"¿cómo lo hizo OC?"** — y seguimos ese camino.

### Anatomía de un detalle de entidad (el patrón a replicar)

```
┌─────────────────────────────────────────────────────────────────┐
│  Modal full-screen                                          [X] │
│                                                                 │
│  ┌─── ZONA FIJA (nunca cambia mientras estás dentro) ────────┐ │
│  │                                                            │ │
│  │  OC-2026-001                        [Pendiente] [No pagada]│ │ ← Header
│  │  Amazon · USA                                              │ │
│  │                                                            │ │
│  │  ●─────────○─────────○─────────○─────────○                 │ │ ← Pipeline
│  │ Borrador Confirmada Despacho Recibida Completa             │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ 🔷 Próximo paso: Confirmar esta OC        [Confirmar]│ │ │ ← Banner CTA
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌──────┬──────┬──────────┬──────────┐                    │ │ ← KPIs fila
│  │  │Total │ SKUs │Sub-órdenes│  Pagado  │                    │ │
│  │  │$1,250│  12  │    3      │ $500/1250│                    │ │
│  │  └──────┴──────┴──────────┴──────────┘                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── ZONA DINÁMICA (cambia según la acción en curso) ───────┐ │
│  │                                                            │ │
│  │  Modo "Detalle":                                           │ │
│  │   productos + cargos + envío + ...                         │ │
│  │                                                            │ │
│  │  Modo "Confirmando":                                       │ │
│  │   formulario de confirmación INLINE (no abre otro modal)   │ │
│  │                                                            │ │
│  │  Modo "Editando X":                                        │ │
│  │   formulario de edición INLINE (no abre otro modal)        │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Los 5 elementos clave que siempre debe tener un detalle de entidad:**

1. **Header** con número + título + badges de estado alineados a la derecha
2. **Pipeline grande** con los estados por los que pasa la entidad (ej. Borrador → Confirmada → ...)
3. **Banner CTA de próxima acción** que le dice al usuario qué hacer ahora
4. **Fila de KPIs** con 3-5 métricas clave consolidadas en fondo suave
5. **Zona dinámica** que cambia de contenido sin abrir modales encima

---

## 🧩 Los 5 patrones canónicos

Estos son los patrones que vienen del estándar OC y que deben usarse en TODAS las pantallas de detalle del ERP.

### 1. `EntityHeader` — Encabezado de la entidad

**Qué es:** el bloque superior con número, título y badges.

**Cuándo usarlo:** siempre que muestres el detalle de una OC, Envío, Venta, Devolución, Cotización, etc.

**Qué nunca hacer:**
- ❌ Escribir el header a mano con `<div>` y clases Tailwind sueltas
- ❌ Usar colores distintos en cada módulo ("el header de Ventas en azul, el de Envíos con gradient, el de OC blanco")
- ❌ Poner el número en un tamaño distinto por módulo

**Qué siempre hacer:**
- ✅ Usar `<EntityHeader>` con los mismos props: `titulo`, `subtitulo`, `badges`, `breadcrumb`

### 2. `EntityPipeline` — Pipeline de estados

**Qué es:** la línea horizontal con los estados por los que pasa la entidad.

**Cuándo usarlo:** cuando la entidad tiene un ciclo de vida con 3+ estados (OC, Envío, Reclamo, Venta, Devolución).

**Qué nunca hacer:**
- ❌ Escribir el pipeline a mano con círculos y líneas Tailwind
- ❌ Inventar un "tipo" de pipeline distinto por módulo (OC usa círculos grandes, Envíos usa cards, Reclamos usa timeline vertical)
- ❌ Mezclar el pipeline de **estados** con el de **ubicaciones** (la ruta US → PE es distinta a los estados "Borrador → Confirmado")

**Qué siempre hacer:**
- ✅ Usar `<EntityPipeline steps={[...]}>` con cada paso como `{id, label, fecha, status}`
- ✅ Si la entidad tiene ruta geográfica, usar `<RouteVisual>` (pieza separada)

### 3. `KpiRow` — Fila de KPIs del detalle

**Qué es:** la fila horizontal de 3-5 métricas clave con fondo `slate-50`.

**Cuándo usarlo:** dentro del detalle de una entidad, arriba (debajo del banner CTA).

**Qué nunca hacer:**
- ❌ Armar 5 cards pastel separadas si es el KPI de un detalle individual (eso es para la vista de lista)
- ❌ Poner íconos grandes a la derecha de cada KPI
- ❌ Repetir el patrón a mano en cada módulo

**Qué siempre hacer:**
- ✅ Usar `<KpiRow items={[...]}>` con cada KPI como `{label, value, subtitle, tone}`
- ✅ Máximo 5 KPIs por fila (si necesitás más, repensar qué es crítico)

### 4. `NextActionBanner` — Banner de próxima acción

**Qué es:** el cuadro teal-50 que le dice al usuario **qué hacer ahora** con un botón.

**Cuándo usarlo:** en todo detalle de entidad donde el usuario puede ejecutar acciones según el estado.

**Qué nunca hacer:**
- ❌ Poner 7 botones en el header ("Confirmar", "Despachar", "Recibir", "Cancelar", "Pagar", "Editar flete", "Liberar aduana"). Abruma al usuario.
- ❌ Hacer que el usuario adivine cuál es la próxima acción entre varias opciones
- ❌ Ocultar el banner cuando no hay acción siguiente — mostrar "✓ No hay acciones pendientes" es mejor

**Qué siempre hacer:**
- ✅ Usar `<NextActionBanner>` con `label` + `description` + `buttonText` + `onClick`
- ✅ Calcular la próxima acción con un helper `useEntityNextAction(estado, reglas)` que devuelva un solo objeto
- ✅ Si hay múltiples acciones posibles, elegir la **más frecuente** como principal y poner el resto en un menú secundario

### 5. `useEmbeddableView` — Vista interna intercambiable

**Qué es:** el patrón donde el mismo modal/pantalla **cambia su contenido inferior** según lo que el usuario está haciendo, sin abrir modales encima.

**Cuándo usarlo:** cuando una acción necesita un formulario completo (ej. confirmar OC con sub-órdenes, registrar recepción, agregar costo) pero no quieres apilar modales.

**Qué nunca hacer:**
- ❌ Abrir un modal encima de otro modal ("modal sobre modal")
- ❌ Navegar a una página distinta solo para una confirmación
- ❌ Mostrar un drawer lateral que tape la lista detrás

**Qué siempre hacer:**
- ✅ Usar `useEmbeddableView<'detalle' | 'confirmando' | 'editando' | ...>()` para controlar qué vista se renderiza
- ✅ El header (número, pipeline, KPIs, banner CTA) **siempre queda visible** mientras cambia la zona de abajo
- ✅ Los "modales" de acción tienen prop `embedded=true` que los renderiza sin su wrapper modal

---

## 🚫 Anti-patrones (lo que NO hacer)

### Anti-patrón 1: Modal sobre modal
```
❌ Usuario clic card → Modal detalle → Modal "Registrar recepción" → Modal "Confirmar acción"
                                    (3 modales apilados, pierde contexto)

✅ Usuario clic card → Modal detalle → Vista interna cambia a "Registrando recepción"
                                    (1 solo modal, header fijo sigue visible)
```

### Anti-patrón 2: Reinventar KPIs
```
❌ OC usa "KpiCell" (slate-50 fila), Envíos usa "KpiRapido" (6 cards pastel),
   Ventas usa "VentaDashboardCard" (otra variante)
   → 3 componentes para el mismo concepto

✅ Un solo <KpiRow> con prop `variant='default' | 'pastel'` cubre los 3 casos
```

### Anti-patrón 3: Botones apilados en el header
```
❌ Header del detalle: [Exportar] [Confirmar] [Despachar] [Cancelar] [Editar flete] [Pagar]

✅ Header: solo 2 botones (cerrar + acción principal)
   La acción principal la dice el NextActionBanner debajo del pipeline
   Otras acciones van en un menú "..." si son secundarias
```

### Anti-patrón 4: Cada módulo con su propio look
```
❌ OC detail: fondo blanco, bordes slate
   Envíos detail: header gradient sky, tabs internos
   Ventas detail: card expandible sin modal

✅ Todos usan EntityDetailShell con los mismos slots
```

### Anti-patrón 5: Colores hardcodeados
```
❌ En el código: <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">

✅ Los colores vienen de tokens.ts:
   <div className={cn(tokens.banner.primary, tokens.rounded.xl, tokens.padding.md)}>
```

### Anti-patrón 6: 1 wizard por tipo de entidad
```
❌ EnvioWizardT2/, EnvioWizardJ/, EnvioWizardE/, EnvioWizardF/, EnvioWizardI/, EnvioWizardG/
   (6 wizards separados, 80% código duplicado)

✅ EnvioWizard/ único que detecta el tipo al inicio y adapta sus pasos
   (como OCWizardV3 hace con DDP vs. Vía casilla vs. Recojo directo)
```

---

## ✅ Checklist para pantallas nuevas

El checklist está dividido en **dos partes**. La primera es tuya (dueño del producto, no requiere saber código). La segunda la valida Claude o un agente técnico.

### 📝 Parte A — Checklist del dueño del producto (5 preguntas)

**Responde estas ANTES de pedirle a Claude que construya una pantalla nueva.**

Si no sabés alguna, está bien — Claude asume un default razonable y vos validás después viendo la pantalla. Esto es una guía, no un bloqueo.

1. **¿Qué tarea concreta quiere completar el usuario en esta pantalla?**
   *Responder en 1 oración.* Ejemplo: "Crear un envío nuevo desde una casilla internacional a Perú".

2. **¿Cuáles son las 2-3 acciones más frecuentes?**
   *Lista corta ordenada por frecuencia.* Ejemplo: "1) Consultar envíos activos · 2) Crear envío nuevo · 3) Registrar recepción".

3. **¿Con qué otras pantallas se conecta esta?**
   *¿A dónde va el usuario desde acá y de dónde viene?* Ejemplo: "Se entra desde el menú principal · Al clic en un envío se abre el detalle · Al terminar recepción vuelve a la lista".

4. **¿Hay un mockup HTML en `docs/mockups/`?**
   - ✅ Sí → perfecto, arrancamos directo.
   - ❌ No → no pasa nada. Claude puede hacer una propuesta visual basada en patrones existentes (OC, Envíos), vos la revisás y iteramos. O podés pedir un mockup antes de codear.

5. **¿Cuántos estados puede tener la entidad?**
   *Ejemplo para envío: `Borrador → Confirmado → En tránsito → Recibido → Completado`.*
   *Ejemplo para venta: `Cotización → Reservada → Confirmada → Despachada → Entregada`.*
   Si ya está documentado en otro lado (ej. spec técnica, briefing de sesión), solo apuntá el archivo.

**Regla de oro:** si respondés las 5, Claude tiene todo lo que necesita para construir la primera versión. Si alguna queda abierta, Claude pregunta puntualmente o asume un default y lo marca.

---

### 🔧 Parte B — Checklist técnico (lo valida Claude o un agente)

No es para que el dueño del producto responda. Es un recordatorio de las cosas que Claude debe verificar antes de entregar código. Si ves que algo falta, podés pedirlo.

1. ¿Usa `<PageShell>` + `<PageHeader>` en la lista?
2. ¿Usa `<EntityDetailShell>` + sus slots en el detalle?
3. ¿Usa `<KpiRow>` o `<KPIBar>` según corresponda (detalle vs. lista)?
4. ¿Usa `<EntityPipeline>` si hay estados?
5. ¿Usa `<NextActionBanner>` para la próxima acción?
6. ¿Los formularios de acción son `embedded` con `useEmbeddableView` (no modal sobre modal)?
7. ¿Los colores vienen de `tokens.ts` (no hardcodeados)?
8. ¿Hay estado vacío y estado de carga diseñados?
9. ¿Se ve bien en mobile (320px de ancho)?
10. ¿Pasan `tsc -b` y `vite build` sin errores?
11. ¿Los imports vienen de la capa más alta disponible?
12. ¿No hay duplicación de bloques JSX que ya existen en otro archivo?

---

### 🆘 Si no sabés responder alguna pregunta de la Parte A

**No te bloquea.** Opciones:

- **Decir "no sé, proponé vos"** → Claude propone una opción, vos la revisás y aprobás o ajustás.
- **Decir "como en OC"** → Claude replica el patrón de Órdenes de Compra (que ya aprobaste como estándar).
- **Decir "como en el mockup"** → Claude busca el mockup más cercano y lo adapta.

---

## 🗺️ Mapa de archivos

Cuando busques una pieza, sabés dónde encontrarla:

| Ubicación | Qué hay | Cuándo importar desde aquí |
|---|---|---|
| `src/components/common/` | Piezas básicas (Capa 1) | Rara vez — solo para piezas atómicas como Button |
| `src/design-system/components/` | Patrones medios (Capa 2) | Cuando necesitás KPIBar, Toolbar, Modal, FilterDrawer, WizardShell |
| `src/design-system/templates/` | Plantillas completas (Capa 3) | **Siempre que construyas un detalle o una lista** |
| `src/design-system/hooks/` | Hooks reutilizables | useEmbeddableView, useEntityNextAction |

**Regla:** importá siempre de la capa más alta posible. Si vas a escribir un detalle, partí de `EntityDetailShell` — no ensambles a mano desde Capa 1.

---

## 🎯 Checklist de code review

Cuando revises código nuevo (o Claude lo escribe), validá:

- [ ] ¿La pantalla usa `PageShell` + `PageHeader` en la vista de lista?
- [ ] ¿La pantalla usa `EntityDetailShell` en el detalle?
- [ ] ¿Los KPIs usan `<KpiRow>` o `<KPIBar>` (según si es detalle o lista)?
- [ ] ¿Hay algún bloque `<div className="bg-[color]-50 border ...">` copiado de otro archivo? Eso es señal de patrón no formalizado.
- [ ] ¿Hay "modal sobre modal"? Marcar para refactor.
- [ ] ¿El pipeline es `<EntityPipeline>` o JSX manual con círculos y líneas?
- [ ] ¿La próxima acción del usuario está clara? ¿Usa `<NextActionBanner>`?
- [ ] ¿Los 7 botones del header son 7 distintos o se pueden reducir?

---

## 📋 Glosario rápido (para no-desarrolladores)

| Término | Qué significa en lenguaje humano |
|---|---|
| **Componente** | Pieza de pantalla reutilizable (ej. el botón "Guardar") |
| **Props** | Los datos que le pasás a un componente (ej. `<Button texto="Guardar" />`) |
| **Modal** | Ventana emergente que se superpone encima de la pantalla |
| **Drawer** | Ventana lateral que se desliza desde el borde |
| **Patrón** | Una forma estándar de resolver un problema de diseño (ej. "banner CTA") |
| **Plantilla** | Pantalla casi completa con huecos configurables (ej. "detalle de cualquier entidad") |
| **Capa** | Nivel de abstracción de las piezas (1 = átomo, 2 = pieza, 3 = pantalla) |
| **Embedded** | Renderizar algo inline dentro de otra cosa en vez de encima |
| **Token** | Variable que define un valor de diseño (color, espaciado, tipografía) |
| **Refactor** | Cambiar la estructura del código sin cambiar lo que hace |

---

## 🔄 Gobernanza: cómo evitar que esto se rompa

### Quién aprueba nuevos patrones
Un patrón se vuelve "canónico" y entra a esta guía cuando:
1. Se usa en **al menos 2 módulos** (no es caso único)
2. Se escribe su API en `src/design-system/templates/` o `src/design-system/components/`
3. Se documenta aquí con ejemplos

### Cuándo pedir ayuda de un agente
- **system-architect**: antes de crear una nueva Capa 3
- **frontend-design-specialist**: antes de decidir visualmente entre 2 opciones
- **code-quality-refactor-specialist**: cada vez que detectes 3+ pantallas haciendo algo similar

### Cuándo actualizar esta guía
- Al agregar un patrón nuevo a Capa 3
- Al detectar un anti-patrón repetido en 2+ lugares
- Al completar un refactor mayor (ej. migrar Envíos al estándar)

---

## 📅 Historial

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-04-21 | 1.0 | Versión inicial · 5 patrones canónicos · derivados del estándar OC · S52 |
| 2026-04-21 | 1.1 | Checklist dividido en 2 partes (dueño del producto 5 preguntas, técnico 12 preguntas). Sección "si no sabés responder, ¿qué hacer?" añadida para no bloquear. |

---

**Fin del documento.** Si algo no está claro o encontrás un patrón repetido que no está documentado aquí, levantá la mano — esto es un documento vivo.
