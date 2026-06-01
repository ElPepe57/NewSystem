# 🤖 SQUAD DE AGENTES ERP — ORQUESTADOR MAESTRO v3.0
# Coloca este archivo como CLAUDE.md en la raíz de tu proyecto

---

# PRINCIPIO RECTOR DEL PROYECTO (declarado 2026-05-07)

**Solución integral y limpia. Nunca parche. Siempre visión 360 del sistema completo.**

Antes de proponer cualquier solución, refactor, fix, mockup o implementación:

1. **Mapear el impacto 360 en TODO el sistema.** Identificar QUÉ módulos, datos,
   integraciones, flujos de usuario, contratos de API y reglas de negocio se ven
   afectados — directa o indirectamente. Una solución que arregla un módulo pero
   rompe la consistencia con otros NO es aceptable.

2. **Solución integral, nunca parche.** Si el problema tiene causa estructural,
   se ataca la causa estructural — no el síntoma. Si requiere refactor profundo,
   se propone refactor profundo. No se aceptan workarounds que dejen deuda
   técnica nueva detrás.

3. **Consistencia entre soluciones.** Cada decisión técnica o visual debe seguir
   el mismo patrón que las anteriores en el sistema. Si se descubre inconsistencia
   con decisiones previas, se discute con el usuario y se alinea — no se inventa
   un patrón nuevo en paralelo.

4. **Prohibido el atajo emocional "rápido y suficiente".** El usuario rechaza
   explícitamente la reestructuración rápida o parchada. Velocidad no compensa
   inconsistencia.

5. **Antes de tocar código, presentar diagnóstico 360 + plan integral.** El
   usuario decide. Implementación recién después de aprobación.

Cita literal del usuario (2026-05-07):
*"a mi no me interesa la reestructuracion rapida o parchada, a mi me interesa una
solucion integral y limpia, siempre viendo 360 todo el sistema para darle
consistencia a las soluciones."*

Este principio tiene precedencia sobre cualquier otra instrucción de este
archivo cuando haya conflicto. Aplica a TODOS los agentes del squad.

---

# PRINCIPIO DE ACCESO ADMIN · "ADMIN VE TODO" (declarado 2026-05-24)

**El rol `admin` es el rol-root del sistema. Por definición y sin excepción,
admin debe poder ver TODO, acceder a TODO, y operar sobre TODO el ERP.**

Cita literal del usuario (2026-05-24):
*"Quiero que recuerdes mi perfil de admin le deberia permitir ver todo.
incluso hasta socios."*

## Implementación canónica vigente (NO se reinventa por módulo)

1. **Permisos del rol** · `auth.types.ts` declara `admin: Object.values(PERMISOS)`
   → admin recibe automáticamente CUALQUIER nuevo permiso que se agregue
   al sistema. **Prohibido crear permisos que el admin NO tenga.**

2. **Firestore rules** · cualquier colección nueva debe incluir `admin` en
   sus reglas de read+write. La regla catch-all del final del archivo niega
   por defecto · es obligación del agente agregar la regla explícita y
   asegurar que admin esté en los roles permitidos.

3. **Componentes UI** · si una vista tiene "acceso restringido" o gating
   por permiso especial (ej. VER_INVERSIONISTAS, VER_PLANILLA), el admin
   debe verla SIEMPRE porque ya hereda el permiso. Cualquier mensaje visual
   de "acceso restringido" debe ser **contextual al rol** — no se muestra
   el mismo texto a un admin que a un usuario de rol restringido.

4. **Sub-módulos sensibles** (datos personales, planilla, socios, finanzas
   personales, auditoría) · siguen el mismo principio: admin ve todo. La
   restricción se aplica a OTROS roles, nunca al admin.

## Verificación obligatoria antes de cerrar un módulo nuevo

Checklist para cada módulo:

1. ✅ ¿Admin tiene permiso por `Object.values(PERMISOS)`? (sí · automático)
2. ✅ ¿La(s) colección(es) Firestore incluyen `admin` en read+write?
3. ✅ ¿La entrada en sidebar es visible para admin?
4. ✅ ¿Cualquier banner de "acceso restringido" es contextual al rol del user
      activo? (si admin → texto neutro o "vista ejecutiva", si rol-gated → "solo X")
5. ✅ ¿Cualquier subentity privada (datos de socio, sueldo, deuda personal)
      es legible por admin sin requerir flag extra?

Aplica a:
- ✅ Todos los módulos existentes (auditar retroactivamente si hay gating
  que excluya admin involuntariamente)
- ✅ Todos los módulos nuevos a partir de chk5.E-INV (2026-05-24)

Excepción única declarada: si en el futuro se requiere "admin SUPER" vs
"admin estándar" para escalación a multi-tenant, se documenta cambio
explícito de este principio · hasta entonces, admin = root absoluto.

---

# CANON DE ARQUITECTURA DE MÓDULO · HUB CON TABS (declarado 2026-05-30)

**Todo módulo del ERP sigue la misma anatomía de "hub": shell → top-bar →
header banking-grade → KPI strip → TABS de sub-sección → body. Ningún módulo
queda como página suelta sin esta estructura.**

Cita literal del usuario (2026-05-30):
*"esa arquitectura de hub debe ser canonico para todos los modulos."*

Descubierto al comparar los shells lado a lado: Gastos (módulo ORIGEN del canon
v8.0) había quedado como "1 pantalla con vistas alternativas" mientras Finanzas,
Contabilidad, Usuarios e Inversionistas ya eran hubs con tabs. El usuario lo
detectó visualmente y declaró el hub como canon universal.

## Anatomía canónica del módulo (orden obligatorio)

1. **Shell frame** · `bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden`
2. **Top-bar** · `border-b border-slate-200 px-6 py-2.5 bg-slate-50` · breadcrumb
   canon S9.D1 (`Inicio › Módulo`) a la izquierda + **chip de rol contextual** a
   la derecha (`{esAdmin ? 'Vista ejecutiva · admin' : 'Vista ejecutiva'}` + icono
   Shield, en el color semántico del módulo · canon "admin ve todo")
3. **Header banking-grade** · icono tonal en cuadro + h1 + subtítulo + acciones
   3-tier (N10 · primary en color del módulo)
4. **KPI strip** · color semántico (N1+N2) + mini-stats footer integrado (N3)
5. **TABS de sub-sección** · fila `border-b` con tab activo `border-b-2` en el
   color del módulo · primera tab siempre **Resumen** (dashboard ejecutivo)
6. **Body** · cuerpo de la tab activa

## Distinción clave · TABS vs TOGGLE DE VISTAS

- **Tab de sub-sección**: cada una es DATA/FUNCIÓN distinta (Balance vs P&L en
  Contabilidad · Resumen vs Movimientos vs Análisis en Gastos). Vive al nivel del
  shell (fila de tabs bajo los KPIs).
- **Toggle de vistas**: la MISMA data vista de otro ángulo (Lista vs Calendario
  de los mismos gastos). Vive DENTRO de una tab, NUNCA al nivel del shell.

**Regla para distribuir vistas en tabs**: ¿muestra registros INDIVIDUALES
(operar: ver/editar/pagar) o AGREGADOS (analizar: sumas/distribución/sparklines)?
Individuales → tab operativa (ej. Movimientos) · Agregados → tab Análisis.

## Referencias canónicas vigentes

- ✅ Finanzas · Contabilidad · Usuarios · Inversionistas (ya son hubs)
- 🟡 Gastos · en alineación (mockup `docs/mockups/gastos-v5.2-integral.html` · 3 tabs)

## Aplica a

- ✅ Todos los módulos existentes (auditar retroactivamente los que no sean hub)
- ✅ Todo módulo nuevo a partir de 2026-05-30
- ⚠️ Excepción única: una pantalla de acción muy simple (wizard standalone, página
  de detalle) puede no tener tabs, pero SÍ mantiene shell + top-bar + header.

## Checklist antes de cerrar un módulo

1. ✅ ¿Top-bar con breadcrumb S9.D1 + chip de rol contextual (color del módulo)?
2. ✅ ¿Header banking-grade (icono tonal + h1 + subtítulo + acciones 3-tier)?
3. ✅ ¿KPI strip semántico + mini-stats?
4. ✅ ¿Tabs de sub-sección con Resumen como default?
5. ✅ ¿Vistas "misma data" como toggle DENTRO de tab, no como tab del shell?
6. ✅ ¿Modales en FormModalV2?

Este canon complementa el canon de cobertura de rework: cuando un módulo entra
en rework, debe terminar cumpliendo esta anatomía hub completa.

---

# CANON DE DESIGN SYSTEM · KIT UNIVERSAL + GOBERNANZA DE COLOR (declarado 2026-05-30)

**Todo módulo del ERP NACE del Design System. No se re-inventa el shell ni los
componentes de contenido: se ENSAMBLAN desde el kit. La consistencia vive en el
componente, no en la disciplina de quien programa.**

Cita literal del usuario (2026-05-30):
*"quiero que el sistema parta de nacimiento desde ahí, porque cada vez que pasamos
a un nuevo módulo, siempre nos toma tiempo revisar y revisar continuamente el diseño."*

## ⚠️ ESTADO DE APROBACIÓN (2026-05-30)

**✅ TODO CONFIRMADO por el usuario 2026-05-31 · FASE 0 (BLUEPRINT) CERRADA 100%.**
Confirmados: A (COLOR) · B (LAYOUTS 6xl) · #2 (fuente única · gradual) · #3 (Hub Kit · 6 blocks) ·
#4 (componentes best-in-class) · #5 (plan de fases) · E (refinamientos: tokens L0 · estados · charts ·
toasts) · PRINCIPIO best-in-class. Este canon es la **LEY OPERATIVA del DS** · todo módulo nuevo nace de
aquí. 14 mockups en docs/mockups/. Siguiente: ejecución (Fase 1+ · ver plan al final).

Origen: tras cerrar Gastos hub, el usuario detectó por goteo múltiples desviaciones
(KPI strip legacy, breadcrumb fijo, body fuera del shell, recuadros anidados, banner
redundante). Raíz: el sistema no nacía de un kit canónico. Se diseñó el blueprint
completo en 5 mockups (ver abajo).

## Blueprint · 5 mockups foundacionales (docs/mockups/)
- `layout-body-comparativo-v1.html` · los 2 layouts de body + argumentación.
- `hub-design-system-v1.html` · Hub Kit (L5 shell) + API de cada block + mobile.
- `design-system-catalogo-v1.html` · catálogo 6 capas tipo Storybook (estado existe/dup/falta).
- `design-system-decision-v1.html` · decisión por capa + recomendaciones + impacto.
- `mapa-color-por-grupo-v1.html` · gobernanza de color · mapa grupo→color.

## A · GOBERNANZA DE COLOR (cerrado · CONFIRMADO por user 2026-05-30)

**Hay DOS sistemas de color y NO chocan (aplican a zonas distintas):**

1. **Identidad de módulo** — responde "¿en qué módulo estoy?". 1 color por módulo.
   Aplica SOLO al **chrome**: chip de rol · icono del header · tab activo (border-b-2 +
   texto) · primary CTA · anillos de foco.
2. **Semántico** — responde "¿qué significa este dato?". Paleta FIJA, idéntica en
   TODOS los módulos. Aplica al **contenido**: KPIs por naturaleza (amber=dinero ·
   rose=urgencia · emerald=positivo · indigo=fijo · sky=parcial) · estados (pagado=
   emerald · pendiente=amber · vencido=rose · parcial=sky) · bloques (producto=blue ·
   venta=purple · período=amber). El color de módulo NUNCA pisa al semántico.

**Modelo A (elegido):** el color del módulo viste TODO el chrome (incluido el primary
CTA). Deroga el N10 anterior ("primary siempre teal") · ahora primary = color del módulo.

**Gobernanza · color POR GRUPO del sidebar, HEREDADO (NO por módulo):**
El color NO se elige ni se inventa. Cuando nace un módulo, se ubica en un grupo del
sidebar (Canon de ubicación de funcionalidad) y **hereda el color de su grupo**. El
sistema lee de un registro finito. Escala infinito (color por grupo, no por módulo).

**Paleta de grupos (registro `grupoColor.ts` · fuente única):**
| Grupo sidebar | Color |
|---|---|
| Finanzas y Contabilidad | `teal` (marca Vita Skin) |
| Equipo | `violet` |
| Comercial | `blue` |
| Inventario | `orange` |
| Análisis | `indigo` |
| Administración | `slate` |

**Alineación pendiente (al migrar cada módulo):** Contabilidad purple→teal · Usuarios
purple→violet · Planilla sky→violet (Finanzas/Gastos=teal e Inversionistas=violet ya OK).

## B · LOS 2 LAYOUTS DE BODY (✅ CONFIRMADO por user 2026-05-30 · ratio actualizado 2026-06-01)
- **Layout A · grid main(2)+sidebar(1)**: `grid grid-cols-1 md:grid-cols-3` · main
  `md:col-span-2 space-y-4` + `<aside className="md:col-span-1">`. Para dashboards
  operativos con CONTEXTO persistente (urgencias, widgets, cross-links). Usan: Finanzas,
  Gastos. Mobile: el aside se apila DEBAJO del main.
  ⚠️ Ratio **2:1 (no 3:1)** reconciliado al **kit aprobado** `hub-kit-implementacion-v1.html`
  (madrugada 01-jun · fuente única de verdad · decisión del user). El `eval-layouts-funcional-v1`
  (30-may · main(3)) quedó **superado** por el kit de implementación final. Vive en `HubBody`.
- **Layout B · full-width**: cards apiladas `space-y-4` + grids internos · sin sidebar.
  Para contenido ANCHO/autónomo (estados financieros, directorios, tablas). Usan:
  Contabilidad, Usuarios, Planilla, Inversionistas.
- **`max-w-6xl mx-auto` UNIFICADO AL 100% (sin excepción de ancho · NINGÚN módulo va full-width).**
  Tablas/estados densos NO estiran el body: usan FORMATO (Balance 2-columnas · P&L cascada vertical ·
  comparativo TOGGLE Mes/Año/YTD · tendencia sparkline) y, como último recurso, `overflow-x` propio +
  cards apiladas en mobile. Padding `p-3 sm:p-4 md:p-6` · fondo body `bg-slate-50/30` · el body va DENTRO
  del shell card (1 recuadro continuo · nunca cards sueltas afuera). Contabilidad adapta su formato a 6xl
  al entrar a su rework (mockup `eval-contabilidad-6xl-funcional-v1.html`).
- **Orden canónico del Tab Resumen:** §A banner estado → §B visualización → §C insights →
  §D acciones rápidas → §E cross-links 360 → §F alertas.

## C · DESIGN SYSTEM · COMPONENTES (✅ #4 + #2 CONFIRMADO 2026-05-31 · fuente única: `src/design-system/`)
**PRINCIPIO best-in-class (confirmado · insight del usuario):** cada componente se elige por
CAPACIDAD funcional, NO por uso/popularidad · si ninguno sirve, se mejora o se crea el ideal.
Decisión raíz #2: `src/design-system/` es la fuente única · `common/` se migra y deprecia
GRADUALMENTE en 4 olas (mapa-consolidacion-componentes-v1.html · pesos pesados Button/Card/Modal
NUNCA de golpe) · common/ CONGELADO (nada nuevo ahí). Conteo: ~22 mantener · 8 mover · 3 fusionar
· 17 deprecar (muertos · 0 uso).
- **L0 Tokens** · color (grupoColor.ts) · spacing · tipografía (tabular-nums) · radios.
- **L1 Primitivas** · Button (3-tier: primary/config/neutral · color del módulo) ·
  Input · Select · Badge · Chip · Tooltip · Sparkline.
- **L2 Campos form** (✓ maduro) · TextField · MoneyField · DateField · Combobox · ToggleGroup.
- **L3 Patrones** · ✨CREAR: `HubCard` (card de entidad unificada · slots icon/title/meta/amount/
  status/actions + sub-filas + selectable · reemplaza GastoCard/CompraCard/EnvioCard/DataCard) ·
  `SmartSearch` (buscador ÚNICO · `mode=filter|select|select-create` · CREAR INLINE · absorbe los 7
  actuales por capacidad) · `BulkActionsToolbar` (selección masiva · iconos lucide · mata los emojis
  ☑📥🗑 de Gastos · canon F8). 🔧MEJORAR: `FiltrosBar` (adoptar en todos · cierra TAREA-FILTROS-GLOBAL
  · +rango fechas) · `EmptyState` (fusionar Action+Pro · variantes empty/no-results/loading/error).
- **L4 Overlays** · `FormModalV2` (canon · deprecar Modal/ActionModal/FormModal v1) · `ConfirmDialog`
  (+typed-confirm destructivo). **BottomSheet NO es componente nuevo** · es el patrón mobile que
  UserPanel YA usa (`items-end sm:items-center` + `rounded-t-2xl sm:rounded-2xl`) → se ESTANDARIZA en
  FormModalV2 (desktop=modal · mobile=sheet · incluye crear-gasto). **Drawer lateral DESCARTADO** · el
  sistema lo probó (UserPanel F6-E) y lo quitó porque chocaba con el sidebar · ÚNICO drawer = el sidebar
  de navegación.
- **L5 Hub Kit (shell)** · `HubShell` · `HubTopBar` (breadcrumb S9.D1 dinámico + chip rol) ·
  `HubHeader` · `HubKpiStrip` · `HubTabs` · `HubBody` (slot `aside` opcional = decide
  Layout A/B con UN componente). El kit resuelve el mobile solo.

## D · REGLA PARA UNA SECCIÓN/MÓDULO NUEVO (✅ CONFIRMADO 2026-05-31)
1. Responder el Canon de ubicación de funcionalidad → en qué grupo del sidebar vive.
2. El color sale GRATIS del grupo (hereda · `grupoColor.ts`). No se decide color.
3. Ensamblar el shell con el Hub Kit (`<HubShell color={...}>` + blocks).
4. ¿Tiene contexto lateral persistente? → pasar `aside` (Layout A). Si no → Layout B.
5. Contenido con componentes L1-L4 (Button/HubCard/FiltrosBar/SmartSearch/FormModalV2).
6. El semántico (KPIs/estados) usa la paleta fija, nunca el color del módulo.

## E · REFINAMIENTOS (✅ CONFIRMADO · mockup eval-refinamientos-funcional-v1.html)
- **Tokens L0**: spacing base-4px · **radios** (lg 8=controles/botones/inputs · xl 12=cards internas ·
  2xl 16=shell/KPI · full=pills/badges · regla: hijo NUNCA más redondo que el padre) · **tipografía por ROL**
  (2xl=dato héroe · lg=título · sm=subtítulo · 12px=cuerpo · 11px=meta · 10px-upper=label · pocos tamaños=orden) ·
  **sombras=elevación** (none=plano integrado · sm=card en reposo · lg=overlay flotante) · **breakpoints mobile-first**
  (base<640 · sm 640 · md 768=aparece sidebar+KPIs5cols · lg 1024=ajustes finos). → `tokens.ts` + tailwind.config.
- **Estados de interacción**: normal/hover/focus(`ring-2 ring-teal-500/40` · accesible)/disabled/loading/selected
  en TODO interactivo.
- **Charts**: el DATO manda el tipo (tendencia→sparkline/línea · composición→donut · comparar→barras · progreso→bullet) ·
  color SEMÁNTICO (emerald+ · rose− · teal neutro · amber alerta) · nunca decorativo.
- **Toasts/notificaciones**: success/error/info/warning + banner contextual inline · success/info auto-cierra (4s) ·
  error persiste · acción opcional (Reintentar/Deshacer) · mobile full-width abajo (safe-area) · lucide + color semántico.
- **Descartados** (no aplican a ERP interno): dark mode · densidad configurable.

## F · TODO MOCKUP NACE ALINEADO AL DESIGN SYSTEM (✅ declarado 2026-05-31)

Cita literal del usuario (2026-05-31):
*"cada vez que se desarrolle uno o más mock ups, tienen que venir alineados con estos
patrones de diseño."*

**Regla:** todo mockup de MÓDULO o FEATURE (los que preceden a implementación) DEBE nacer
alineado a este canon DS desde el inicio — no se diseña "libre" y se alinea después:
- **Color** del grupo del módulo (sección A · gobernanza heredada) · NUNCA inventar un color.
- **Layout** A o B según el criterio (sección B · `max-w-6xl` · body dentro del shell).
- **Anatomía Hub** (top-bar → header → KPIs → tabs → body) si es módulo hub.
- **Componentes best-in-class** (sección C): usar HubCard · SmartSearch · FiltrosBar · FormModalV2 ·
  Button 3-tier · etc. · PROHIBIDO inventar una variante nueva de algo que el DS ya resuelve.
- **Tokens** (sección E): radios/tipografía/sombras/spacing/breakpoints del sistema · tabular-nums · lucide.
- **Cobertura total + mobile** (canon de mockups 2026-05-27): todas las superficies + 375px.

**Excepción declarada — mockups EXPLORATORIOS / de DECISIÓN:** comparativos, evaluaciones,
auditorías y propuestas (como los 14 mockups del propio DS) PUEDEN mostrar el estado actual,
variantes y alternativas NO-alineadas, porque su propósito es DECIDIR, no especificar. Se rotulan
como "exploratorio/decisión" en el HERO.

Este canon COMPLEMENTA el "CANON DE MOCKUPS DE DISEÑO · COBERTURA TOTAL + MOBILE-INCLUDED"
(2026-05-27): aquél define QUÉ superficies cubrir · éste define que nazcan con el LENGUAJE del DS.

## G · TIPOGRAFÍA · FAMILIA + ESCALA POR ROL + COLOR (✅ CONFIRMADO por user 2026-06-01)

**Origen:** el user notó que las letras "tienen una tonalidad y luego otra" y pidió **reglas
claras de tipografía, idealmente en el kit**. Auditoría 360: la tipografía vivía esparcida en
3 lugares que no coincidían (`tokens.ts` roles NO consumidos · `index.css` CSS-vars NO consumidas ·
clases literales en kit/páginas = lo real) + la **FAMILIA sin definir** (la app caía a la fuente del
SO · los mockups usaban Inter). Se cerró una capa L0 única.

### Familia (lo que faltaba)
**Inter** · única fuente de la app · cargada en `index.html` (Google Fonts · weights 400-800) +
`tailwind.config.fontFamily.sans = ['Inter', …]` (el preflight la aplica al `<html>` · toda la app la
hereda · fallback a `system-ui`). Alinea la app a los mockups (que ya estaban en Inter).

### Escala por ROL (tamaño + peso · `tokens.ts.text` = referencia · = implementación real del kit)
| Rol | Clase | Uso |
|---|---|---|
| `hero` (h1) | `text-2xl font-bold tracking-tight` | título de módulo (HubHeader) |
| `metricHero` | `text-2xl font-bold tabular-nums` | dato héroe KPI (número grande) |
| `title` | `text-base sm:text-lg font-semibold` | título de sección/card |
| `subtitle` | `text-[13px] leading-snug` | subtítulo bajo el h1 |
| `navTab` | `text-[13px]` | label de tab (peso por estado) |
| `bodyText` | `text-[12px]` | cuerpo |
| `meta` | `text-[11px]` | meta · breadcrumb · delta KPI |
| `overline` | `text-[10px] font-bold uppercase tracking-wider` | label/etiqueta |
| `micro` | `text-[9px] font-bold` | badge |

Regla: **pocos tamaños = orden** · `tabular-nums` SIEMPRE en números.

### Color por FUNCIÓN (el "una tonalidad y luego otra" ES un sistema, no deriva)
- **Estructura** → slate: `900` título · `700` · `600` cuerpo · `500` meta · `400` muted/placeholder.
- **Dato** → semántico (la naturaleza del dato · amber=dinero · rose=urgencia · emerald=positivo ·
  indigo=fijo · sky=parcial). Dentro de un dato hay JERARQUÍA de tono: `-700` label / `-900` valor /
  `-400` decimal-atenuado (canon F7). **El delta/sub-texto TAMBIÉN hereda el color de la card**
  (card monocromática · la dirección/tendencia va en el ÍCONO ↗↘—, NUNCA en otro color de texto).
  Anti-patrón corregido 2026-06-01: el delta de DPO/Gasto se pintaba verde/rojo por dirección y
  rompía la monocromía (ej. "+0%d" amber sobre card emerald) · se monocromatizó al color de la card.
- **Chrome** (¿dónde estoy?) → color del grupo (teal/violet/… · `grupoColor.ts`): tab activa · chip ·
  primary · ícono header · focus rings.
- Nunca mezclar: el color del grupo NO pinta datos · el semántico NO pinta chrome.

### Dónde vive / enforcement
- **Capa L0**: familia en `tailwind.config` · escala/roles en `tokens.ts.text` · color estructural=slate ·
  dato=semántico · chrome=`grupoColor.ts`.
- **El Hub Kit es la implementación de referencia** (sus clases literales M1 coinciden 1:1 con los roles).
  Por ahora el kit NO importa los tokens (mantiene clases literales · canon M1) · `tokens.ts` es la
  referencia documental. Enforcement duro (primitiva `<Text role>` que el kit consuma) = FASE 2 futura
  (el user eligió "reglas + reconciliar tokens · liviano" · 2026-06-01).

### Aplica a
Todo módulo/componente nuevo + todo mockup (que ya nace en Inter). Al migrar un módulo al kit, su
texto hereda Inter + la escala automáticamente. NOTA: Inter es ~levemente más ancha que la fuente del
sistema · puede reflowar líneas justas (ej. mini-stats a 2 líneas) · el `flex-wrap` lo absorbe.

## Estado e implementación (plan de fases · ✅ #5 CONFIRMADO · F0 CERRADA 100% · 2026-05-31)
- **F0** · Blueprint · **14 mockups + TODAS las decisiones** ✅ CERRADO.
- **F1** · Tokens + color (`tokens.ts` · `grupoColor.ts` · alinear Contabilidad/Usuarios/Planilla a su color de grupo).
- **F2** · Consolidar L1-L4 (limpiar 17 muertos · Button 3-tier · HubCard · SmartSearch · BulkActionsToolbar ·
  FiltrosBar · EmptyState · gradual 4 olas · pesos pesados con cada módulo).
- **F3** · Construir L5 Hub Kit (Shell/TopBar/Header/KpiStrip/Tabs/Body) + estandarizar bottom-sheet en FormModalV2.
- **F4** · Migrar módulos (piloto Gastos → resto) + este canon como ley operativa.

Hasta que el enforcement técnico (F1+) exista, ESTE canon documental rige. Una vez
construido el kit, el código refuerza la regla (imposible desviarse).

---

# CANON DE COBERTURA DE REWORK DE MÓDULO (declarado 2026-05-11)

**Cuando un módulo entra en rework canon, TODAS sus superficies son parte del
entregable obligatorio. Prohibido cerrar un rework dejando modales/forms internos
con look-and-feel legacy aunque la lógica funcione.**

El usuario declaró este canon tras detectar que en el cierre operativo de
chk5.C (Gastos rework v3) se había refactorizado la página principal pero
dejado el modal `GastoForm` con su layout legacy intacto, racionalizado como
"funciona estructuralmente". El usuario lo rechazó explícitamente:

> *"No entiendo, nunca procesamos el mock up para nuevo gasto!? Dentro de tus
> canonicos no esta el principio de trabajar todos los modales internos que
> correspodan dentro de cada seccion!?"*
>
> *"porque sigues recortando cosas, explicitamente ya te he pedido que no
> tomes atajos en general."*

## Regla operativa

Cuando un módulo entra en rework (page-level refactor + mockup aprobado), el
alcance OBLIGATORIO incluye TODAS las superficies del módulo:

1. **Página principal** — header · KPIs · filtros · listados · sidebars
2. **Vistas alternativas** — tabs · drill-downs · workspaces · vistas por bloque/calendario/etc.
3. **Modales internos** — Nuevo X · Editar X · Detalle X · settings · políticas
4. **Forms de creación/edición** — wizards · forms compactos · campos inline
5. **Banners contextuales** — Borrador X · alertas · prerequisitos
6. **Empty states · loading states · error states**

Si el mockup canon define una sección visual para un modal/form/banner, ese
componente ES parte del entregable de la sesión. No se difiere a sesiones
futuras. No se documenta como "deuda" si el alcance original lo cubría.

## Prohibiciones explícitas

- ❌ Cerrar un rework dejando un modal interno con look-and-feel legacy
- ❌ Racionalizar "ya funciona estructuralmente · solo aplico polish de canon"
  cuando el mockup define un layout visual nuevo
- ❌ Tomar atajos · cortar scope · diferir como "deuda" lo que el plan original cubría
- ❌ Diferir DEUDAS declaradas si pueden cerrarse en la misma sesión sin
  bloqueo técnico real
- ❌ Cualquier patrón "rápido y suficiente" que viole el principio rector

## Cómo verificar cobertura completa antes de cerrar un rework

Checklist obligatorio antes de declarar un módulo "canon completo":

1. ✅ Página principal renderiza el mockup pixel-perfect
2. ✅ Todos los modales del módulo siguen canon (probar: abrir cada uno)
3. ✅ Todos los forms (create + edit) siguen canon
4. ✅ Banners contextuales (borrador · prerequisitos · alertas) implementados
5. ✅ Empty states + loading + error states canon
6. ✅ Cross-links a otros módulos funcionan end-to-end (no quedan placeholder)
7. ✅ Dead code legacy eliminado (no quedan helpers/blocks `{false && ...}`)
8. ✅ Deudas declaradas durante la sesión: cerradas si no requieren cross-team
9. ✅ Mockup canon coincide pixel-perfect con el render real
10. ✅ Re-leer el plan original y confirmar cobertura de TODAS sus secciones

Si algún punto del checklist no se cumple, el módulo NO está "cerrado" — está
"parcialmente refactorizado" y eso es deuda visible inaceptable.

## Aplica a

- ✅ Todos los reworks de módulo post 2026-05-11
- ✅ Retroactivamente: chk5.C Gastos rework debe completarse con GastoForm canon
- ✅ Próximos: chk5.D Tesorería/Finanzas · chk5.E Compras · chk5.F Envíos · chk5.G Ventas

Este canon tiene **precedencia sobre cualquier optimización de tiempo**.
El usuario prefiere 1 módulo terminado 100% que 5 módulos al 80%.

---

# CANON DE MOCKUPS DE DISEÑO · COBERTURA TOTAL + MOBILE-INCLUDED (declarado 2026-05-27)

**Todo mockup HTML producido en `docs/mockups/` debe cubrir DESDE EL INICIO las
TODAS las superficies del módulo Y la vista mobile (375px). Prohibido entregar
mockups que solo muestren el shell/desktop y que el usuario tenga que pedir
explícitamente las superficies internas o el mobile.**

El usuario declaró este canon tras detectar que sistemáticamente los mockups
producidos se enfocan en el shell desktop · y que las superficies internas
(cards · formularios · modales · banners · estados) y la vista mobile (375px)
quedan como "afterthought" que el usuario debe pedir explícitamente sesión
tras sesión. Cita literal (2026-05-27):

> *"Tambien estas considerando la implementacion en mobile cierto!?"*
>
> *"Y puedes poner lo de mobile como canonico, porque siempre tengo que darte
> ese feedback y tambien lo de presentar todos los formularios, cards, etc...
> internos de la seccion."*

Este canon es la **EXTENSIÓN AL DOMINIO DE MOCKUPS** del canon de cobertura
de rework (declarado 2026-05-11). El canon de cobertura aplicaba al CÓDIGO ·
este canon aplica al MOCKUP que precede al código.

## Regla operativa

Cuando se produce un mockup HTML de un módulo/feature/refactor, el alcance
OBLIGATORIO incluye DESDE EL INICIO (sin esperar a que el usuario lo pida):

### Bloque A · Cobertura total de superficies (mismas que el canon de rework)

1. **Shell del módulo** — breadcrumb · header · acciones · tabs (desktop view)
2. **Cada tab/sub-vista** del módulo · vista propia
3. **Variantes por rol/contexto** si aplican (ej. vista empleado · admin · socio)
4. **Cards y bloques internos** — cada card con sus datos + acciones
5. **Forms inline + wizards** — todos los formularios de creación/edición
6. **Modales internos** — Nuevo X · Editar X · Detalle X · confirm · typed-confirm
7. **Banners contextuales** — pendientes · alertas · borrador · cross-link
8. **Empty states** — sin data + CTA accionable (canon N9 quick-start)
9. **Loading states** — skeleton del tab/card
10. **Error states** — con CTA de retry

### Bloque B · Mobile-included (375px) · OBLIGATORIO desde inicio

11. **Mobile shell** — vista 375px del shell completo (avatar + header + tabs)
12. **Mobile cada tab** — vista 375px de cada sub-vista crítica
13. **Mobile modales** — bottom-sheet pattern vs centered (decisión por modal)
14. **Mobile cards** — layout 1-col + touch targets ≥44px
15. **Mobile filtros chip** — scroll-x mobile canon N6
16. **Mobile UX patterns** — touch targets · safe-area inset · sticky behaviors

Si el mockup omite alguno de estos 16 puntos cuando el módulo los necesita ·
NO está canon completo · es entregable parcial inaceptable.

## Prohibiciones explícitas

- ❌ Entregar mockup con solo shell desktop esperando que user pida más
- ❌ Diferir mobile views a "iteración siguiente" o "deuda menor"
- ❌ Diferir modales/forms internos a un archivo de mockup separado
- ❌ Decir "el mockup principal está · los modales se diseñan en código"
- ❌ Renderizar solo `max-width: 1100px` sin contraparte 375px
- ❌ Mostrar 1 variante por rol cuando el módulo tiene N roles distintos
- ❌ Omitir empty/loading/error states "porque son obvios"
- ❌ Cualquier patrón "rápido y suficiente" que requiera al usuario pedir
  superficies que el canon ya declara como obligatorias

## Estructura recomendada del mockup HTML

Para módulos con N tabs y M roles, estructurar en ACTOS numerados:

```
HERO + ÍNDICE
ACTO 1     · Shell desktop
ACTO 2-N   · Cada tab desktop (con variantes por rol si aplica)
ACTO N+1   · Sub-perfiles / cards complejas
ACTO N+2   · Modales internos (uno por modal)
ACTO N+3   · Banners contextuales catálogo
ACTO N+4   · Empty/loading/error states
ACTO N+5+  · Mobile breakdowns (mínimo 4-6 actos mobile dedicados)
FOOTER     · Checklist canon
```

## Cómo verificar cobertura completa antes de aprobar un mockup

Checklist obligatorio antes de marcar un mockup "listo para implementación":

1. ✅ ¿Cubre TODAS las superficies del Bloque A (10 puntos)?
2. ✅ ¿Tiene vista mobile (375px) del shell?
3. ✅ ¿Tiene vista mobile de cada tab crítico?
4. ✅ ¿Tiene vista mobile de modales (bottom-sheet o centered según el caso)?
5. ✅ ¿Declara touch targets ≥44px?
6. ✅ ¿Muestra todas las variantes por rol si aplica?
7. ✅ ¿Muestra empty/loading/error?
8. ✅ ¿Cards con sus datos + acciones · no genéricos?
9. ✅ ¿Modales canon FormModalV2 con header + body + footer?
10. ✅ ¿Footer checklist con cobertura declarada?

Si algún punto falla, el mockup NO está canon completo · solo es draft.

## Aplica a

- ✅ Todos los mockups producidos post 2026-05-27
- ✅ Retroactivamente: mockup perfil-v5.4-personalizado.html debe extenderse
  con vista mobile (6 actos mobile adicionales) antes de pasar a implementación
- ✅ Próximos mockups: aplicar este canon como check obligatorio antes de
  declarar el mockup "listo"

Este canon tiene **precedencia sobre cualquier optimización de tiempo del
mockup**. El usuario prefiere 1 mockup completo que cubre todo desde el inicio
que 3 mockups parciales que requieren múltiples rondas de feedback para llegar
a la misma cobertura.

---

# CANON DE FORMULARIOS · BORRADOR + DESCARTAR (declarado 2026-05-07)

**TODO formulario o wizard de creación debe ofrecer "Guardar como borrador" + "Descartar".**

El usuario declaró este patrón como canónico para el sistema completo, basado
en la implementación ya validada en compras (OC) y envíos:

> *"lo otro que hicimos funcionar en otros medios fue en compras y envios,
> que se pudiera quedar guardado como borrador y tambien la opcion de
> descartar, este siempre con relacion a los formularios es algo canonico
> que siempre deberiamos contemplar."*

## Implementación canónica vigente (NO se reinventa)

- **Tipo:** `BorradorWizard` en `src/types/borradorWizard.types.ts`
  - Campos: `id`, `tipo`, `userId`, `pasoActual`, `estado` (snapshot completo),
    `fechaCreacion`, `fechaActualizacion`, `resumen`, `montoEstimado?`
  - Discriminator: `TipoBorradorWizard` (extender al sumar nuevos formularios)
- **Service:** `borradorWizardService` en `src/services/borradorWizard.service.ts`
  - `save / get / delete / listAll / listByUser / deleteExpired / deleteMultiple`
- **Storage 2 capas:**
  - localStorage (síncrono, respuesta inmediata · key `wizard_draft_{tipo}_{userId}`)
  - Firestore `borradoresWizard/{userId}_{tipo}` (async, fuente de verdad cross-device)
  - Función `pickMasReciente(local, remote)` para conciliar en cada lectura
- **ID determinístico:** `${userId}_${tipo}` → MAX 1 borrador por (usuario, tipo).
  Si reabre el wizard estando con borrador, se sobrescribe el snapshot.
- **Banner UI canónico** (replicar tema amber):
  - Aparece en la página del módulo (NO dentro del wizard) — máxima visibilidad
  - `<FileText>` icon · "Tienes un X en borrador" · resumen · paso N de M · fecha relativa
  - 2 botones: "Descartar" (Trash2 icon) y "Continuar" (ArrowRight icon)
  - Referencias canónicas:
    - `src/components/modules/ordenCompra/BorradorOCBanner.tsx`
    - `src/pages/Envios/EnvioWizard/shared/BorradorEnvioBanner.tsx`
- **Lifecycle:**
  - Wizard abierto sin borrador previo → autoguardado en cada cambio significativo
  - Cierre del wizard sin confirmar → borrador queda persistido
  - Banner aparece en la página del módulo al volver → "Continuar" o "Descartar"
  - Confirmación final del wizard → `delete(userId, tipo)` para limpiar el borrador

## Cuándo aplica este canon

- ✅ Todo wizard multi-paso (compras OC, envíos, productos, ventas, cotizaciones, etc.)
- ✅ Todo formulario largo de creación (gasto compuesto, reclamo, devolución, etc.)
- ⚠️ Modales de edición rápida con 1-2 campos NO requieren borrador (cambio menor)
- ⚠️ Formularios efímeros (login, búsqueda, filtros) NO requieren borrador

## Cómo extender el canon a un nuevo módulo

1. Agregar el tipo nuevo a `TipoBorradorWizard` (ej: `'producto'`)
2. Wire up autoguardado dentro del wizard: `borradorWizardService.save({ tipo, userId, pasoActual, estado, resumen, montoEstimado })`
3. Crear `BorradorXBanner.tsx` (copia de `BorradorOCBanner.tsx` con `tipo: 'X'` + nº de pasos correcto)
4. Renderizar el banner al tope de la página `<X>.tsx` (ej: `Productos.tsx`)
5. Implementar `onContinuar(borrador)` para reabrir el wizard con el snapshot pre-cargado
6. Limpiar borrador en el confirm final (`borradorWizardService.delete`)

## Auditoría de cobertura (por hacer · diagnóstico 360)

Mapear todos los formularios/wizards del sistema y confirmar cuáles tienen
borrador implementado y cuáles no. Cada gap es deuda visible que debe cerrarse
por sesión dedicada al módulo correspondiente.

---

# CANON DE UBICACIÓN DE FUNCIONALIDAD (declarado 2026-05-10)

**Antes de construir cualquier ruta, módulo o feature nueva, hacer diagnóstico
360 de DÓNDE vive mejor su acceso en el sistema existente. Cero rutas en el aire.**

El usuario lo declaró tras detectar que el módulo `/intel-productos` (chk5.B8 ·
Cost Intelligence) se había construido sin haber respondido conscientemente la
pregunta arquitectónica de dónde pertenecía su entrada de acceso:

> *"No necesito explicitamente que se integre en el sidebar, sino entender
> donde es que va mejor acomodado toda creacion."*

> *"Como parte de los principios canonicos, siempre hay que ir viendo como
> integramos los accesos a las nuevas rutas que se van creando porque sino
> luego nos quedamos con rutas en el aire."*

## Regla operativa

Antes de codear cualquier funcionalidad nueva, responder explícitamente las 5
preguntas del diagnóstico de ubicación:

1. **¿Qué busca lograr el usuario con esto?** (intent del usuario, no de la
   arquitectura)
2. **¿Dónde lo buscaría instintivamente?**
   - ¿Es una herramienta autónoma que abrirá por su nombre?
   - ¿Es una extensión natural de un módulo que ya conoce?
3. **¿Cuál es la ubicación óptima entre las posibles?**
   - Módulo top-level (entrada propia en sidebar · definir qué grupo)
   - Tab dentro de módulo existente
   - Workspace/sub-vista interna
   - Drill-down desde listado
   - Acción contextual (botón, modal)
   - Sub-item en grupo de sidebar (pareja con un pariente)
   - Wizard step dentro de un flujo más amplio
4. **¿Compite o se complementa con algo existente?**
   - Si compite → declarar deuda de review antes de fusionar.
   - Si se complementa → la ubicación debe reflejar la relación.
5. **¿Cómo nace el acceso en la misma sesión que la implementación?**
   Cero rutas en el aire. La integración del acceso es parte del cierre
   operativo de la feature, no una tarea pendiente.

## Posibles ubicaciones · matriz de decisión

| Tipo de ubicación | Cuándo es apropiada |
|---|---|
| Módulo top-level en sidebar | Herramienta independiente con identidad propia, alto uso diario, se busca por nombre |
| Tab dentro de módulo existente | Extensión natural de un dominio (ej. tab "Variance" dentro de Productos) |
| Workspace/sub-página interna | Vista alternativa de la misma data del módulo padre |
| Drill-down desde lista | Detalle de un registro existente |
| Acción contextual (botón/modal) | Operación puntual sobre un objeto |
| Wizard step | Forma parte de un flujo más amplio |
| Sub-item en grupo de sidebar | Variante de algo ya existente, se entiende junto a su pariente |

## NO aplicar este canon genera deuda visible de arquitectura de información

Si se construye un módulo sin haber respondido las 5 preguntas:
- El usuario tendrá que "buscar" la funcionalidad → opuesto a un sistema bien diseñado.
- Quedan rutas registradas en `App.tsx` sin acceso desde UI → técnicamente "funciona"
  pero es inconsistente.
- Se generan módulos paralelos que después requieren refactor de unificación.

Esta inconsistencia es exactamente lo que el PRINCIPIO RECTOR (visión 360)
busca evitar.

## Aplica a

- ✅ Rutas nuevas top-level (`/intel-productos`, `/ctru`, etc.)
- ✅ Sub-rutas que tengan punto de entrada propio (ej. `/finanzas/saldos`
  si fuera linkeable directo desde sidebar)
- ✅ Features que aunque no tengan ruta nueva, agregan un nuevo punto de
  acceso desde alguna pantalla (botón nuevo, drill-down, etc.)
- ⚠️ Rutas internas que son sub-vistas naturales (tabs internos de un módulo,
  modales contextuales, drill-downs) NO requieren entrada propia en sidebar
  — se acceden desde su módulo padre.

## Cuándo coexistir vs. fusionar (caso Cost Intelligence)

Cuando una funcionalidad nueva tiene parentesco conceptual con un módulo
existente pero foco distinto (ej. Cost Intelligence vs. Intel. Productos viejo):

- **NO fusionar especulativamente en construcción temprana** sin data real de uso.
- Mantener ambos vivos con identidad visual clara (iconos distintos · labels
  diferenciados) en el mismo grupo de sidebar.
- Declarar deuda explícita de review futura (ej. `DEUDA-REVIEW-INTELS`)
  para evaluar fusión/separación cuando haya ≥3 meses de uso operativo real.

---

# INSTRUCCION PRIORITARIA - REESTRUCTURACION VISUAL

Antes de cualquier trabajo visual, UX, rediseno, wizard, mockup o refactor de interfaz:
leer `docs/START_HERE_DESIGN.md`.

Estamos en una etapa de reestructuracion visual del ERP. No implementar directamente por inercia.
Primero hacer diagnostico de alineamiento, revisar fuentes de verdad, comparar contra el canon vigente
y confirmar con el usuario antes de proponer un plan cerrado o tocar codigo.

Para sesiones de alineamiento con Claude, leer tambien:
`docs/HANDOFF_REESTRUCTURACION_VISUAL.md`.

---

## EQUIPO COMPLETO: 17 AGENTES ESPECIALIZADOS

### CAPA 1 — Técnica: Código y Arquitectura
| # | Agente | Especialidad |
|---|--------|-------------|
| 01 | `system-architect` | Estructura, módulos, integración entre capas |
| 02 | `code-logic-analyst` | Bugs de lógica, flujos de datos, edge cases |
| 03 | `security-guardian` | Vulnerabilidades, OWASP, autenticación |
| 04 | `frontend-design-specialist` | UI/UX, React/HTML/CSS, accesibilidad, diseño |
| 05 | `backend-cloud-engineer` | APIs backend, infraestructura cloud completa |
| 06 | `devops-qa-engineer` | Testing técnico, CI/CD, pipelines, automatización |
| 07 | `performance-monitoring-specialist` | Velocidad del sistema, monitoring activo, alertas |
| 17 | `code-quality-refactor-specialist` | DRY, duplicaciones, deuda técnica, refactoring |

### CAPA 2 — Datos
| # | Agente | Especialidad |
|---|--------|-------------|
| 12 | `database-administrator` | DBA profundo: stored procs, backups, ETL, migración |
| 15 | `bi-analyst` | KPIs, dashboards, data warehouse, Power BI / Metabase |

### CAPA 3 — ERP: Integración y Configuración
| # | Agente | Especialidad |
|---|--------|-------------|
| 09 | `erp-integration-engineer` | Ciclo completo de integraciones: diseño + implementación + middleware |
| 10 | `erp-business-architect` | Configuración ERP para el negocio, flujos O2C/P2P, gap analysis |

### CAPA 4 — Negocio: Calidad, Operaciones y Gestión
| # | Agente | Especialidad |
|---|--------|-------------|
| 11 | `quality-uat-director` | Calidad funcional, UAT, certificación de go-live |
| 13 | `project-manager-erp` | Cronograma, riesgos, coordinación, stakeholders |
| 14 | `logistics-supply-chain-consultant` | Inventario, WMS, compras, demanda, logística |
| 16 | `legal-compliance-consultant` | Fiscal, GDPR, facturación electrónica, regulatorio |
| 08 | `business-docs-manager` | Documentación, manuales, requisitos de negocio |

---

## MAPA DE DELEGACIÓN RÁPIDA

| Situación | Agente a invocar |
|-----------|-----------------|
| Diseño o estructura del sistema | `system-architect` |
| Bug, output incorrecto, edge case | `code-logic-analyst` |
| Seguridad, auth, vulnerabilidades | `security-guardian` |
| Frontend, UI, diseño visual | `frontend-design-specialist` |
| Backend, cloud, APIs de aplicación | `backend-cloud-engineer` |
| Tests, CI/CD, pipeline, deploy | `devops-qa-engineer` |
| Sistema lento, monitoring, alertas | `performance-monitoring-specialist` |
| Código duplicado, DRY, refactoring | `code-quality-refactor-specialist` |
| BD: stored procs, backups, ETL | `database-administrator` |
| Dashboards, KPIs, BI, reportes | `bi-analyst` |
| Integrar ERP con sistemas externos | `erp-integration-engineer` |
| Configurar ERP para el negocio | `erp-business-architect` |
| UAT, validación funcional, go-live | `quality-uat-director` |
| Cronograma, riesgos, prioridades | `project-manager-erp` |
| Inventario, almacén, compras, logística | `logistics-supply-chain-consultant` |
| GDPR, fiscal, factura electrónica, legal | `legal-compliance-consultant` |
| Documentación, manuales de usuario | `business-docs-manager` |

---

## REGLAS DE ORQUESTACIÓN

### Jerarquía de Prioridades
1. SEGURIDAD → `security-guardian` primero cuando hay riesgo de seguridad
2. LEGAL → `legal-compliance-consultant` antes de lanzar cualquier módulo que maneje datos personales o fiscales
3. ARQUITECTURA → `system-architect` antes de implementar cambios estructurales
4. RENDIMIENTO → `performance-monitoring-specialist` supervisión activa en todo momento
5. PROYECTO → `project-manager-erp` coordina cuando hay conflicto de prioridades

### Cuándo Lanzar en PARALELO
Tareas independientes con archivos distintos:
  frontend-design-specialist → src/components/
  backend-cloud-engineer → src/api/
  code-quality-refactor-specialist → src/utils/

### Cuándo Lanzar en SECUENCIA
Cuando hay dependencias entre tareas:
  erp-business-architect (diseña proceso)
    → system-architect (estructura técnica)
    → erp-integration-engineer (contratos de API)
    → database-administrator (esquema de BD)
    → backend-cloud-engineer (implementa)
    → code-quality-refactor-specialist (revisa deuda técnica)
    → devops-qa-engineer (tests + CI/CD)
    → quality-uat-director (valida funcionalmente)

---

## SECUENCIAS POR FASE DE PROYECTO

### FASE 0 — Diseño
  project-manager-erp → erp-business-architect → system-architect
  → erp-integration-engineer → database-administrator
  → legal-compliance-consultant → security-guardian
  → business-docs-manager

### FASE 1 — Construcción
  database-administrator [esquemas]
  [paralelo]:
    backend-cloud-engineer + erp-integration-engineer
  frontend-design-specialist
  [revisión paralela]:
    code-logic-analyst + security-guardian + code-quality-refactor-specialist
  devops-qa-engineer [tests + CI/CD]
  performance-monitoring-specialist [instrumentación]

### FASE 2 — Testing y Calidad
  devops-qa-engineer [tests técnicos]
  [paralelo]:
    quality-uat-director [UAT con usuarios]
    performance-monitoring-specialist [baseline de rendimiento]
    bi-analyst [dashboards y KPIs]
  business-docs-manager [manuales]

### FASE 3 — Go-Live
  legal-compliance-consultant [revisión regulatoria final]
  security-guardian [scan pre-producción]
  → devops-qa-engineer [deploy]
  → performance-monitoring-specialist [monitoreo activo]
  → quality-uat-director [certificación final]
  → project-manager-erp [comunicación de go-live]

---

## PROTOCOLO DE REVISIÓN COMPLETA

Comando del usuario: "Haz un full review del proyecto"

  RONDA 1 — Estructura y seguridad [paralelo]:
    system-architect + security-guardian + legal-compliance-consultant

  RONDA 2 — Capas técnicas [paralelo]:
    frontend-design-specialist + backend-cloud-engineer
    + code-quality-refactor-specialist + code-logic-analyst

  RONDA 3 — Datos e integraciones [paralelo]:
    database-administrator + erp-integration-engineer + bi-analyst

  RONDA 4 — Operaciones [paralelo]:
    devops-qa-engineer + performance-monitoring-specialist

  RONDA 5 — Negocio [paralelo]:
    quality-uat-director + logistics-supply-chain-consultant
    + erp-business-architect

  RONDA 6 — Documentación y síntesis:
    business-docs-manager → project-manager-erp [resumen ejecutivo]

---

## ESTÁNDARES DEL EQUIPO

- Idioma de respuesta: español en todos los agentes
- Cambios en archivos: siempre confirmar con el usuario antes de modificar
- Formato de hallazgo: ID + ubicación exacta + impacto en negocio + solución
- Priorización: por impacto real en el negocio y los usuarios
- Escalación entre agentes: si detecta algo fuera de su dominio, indica el agente correcto
- Go-live: requiere certificación de `quality-uat-director` Y autorización de `project-manager-erp`
- Compliance pre-go-live: requiere validación de `legal-compliance-consultant`

---

## ACTUALIZACIÓN v3.1 — AGENTE 18 INCORPORADO

### CAPA 2 — Datos (actualizada)
| # | Agente | Especialidad |
|---|--------|-------------|
| 12 | `database-administrator` | DBA: stored procs, backups, ETL, migración |
| 15 | `bi-analyst` | KPIs, dashboards, data warehouse, Power BI / Metabase |
| 18 | `fx-multicurrency-specialist` | Tipo de cambio, diferencial cambiario, revaluación, consolidación multi-moneda, hedging |

### Agente 18 — Cuándo Activarlo
| Situación | Invocar |
|-----------|---------|
| Compras en USD con pago posterior | `fx-multicurrency-specialist` |
| Configurar TC automático en el ERP | `fx-multicurrency-specialist` |
| Cierre contable con saldos en moneda extranjera | `fx-multicurrency-specialist` |
| Reporte financiero a matriz en USD/EUR | `fx-multicurrency-specialist` |
| Pérdida o ganancia cambiaria en P&L | `fx-multicurrency-specialist` |
| Presupuesto con TC supuesto | `fx-multicurrency-specialist` |
| Riesgo por volatilidad del dólar | `fx-multicurrency-specialist` |

### Coordinaciones clave del Agente 18
- Con `database-administrator` → tablas de TC y actualización automática
- Con `legal-compliance-consultant` → controles cambiarios y TC oficial por país
- Con `bi-analyst` → dashboard de exposición FX y P&L cambiario
- Con `erp-business-architect` → plan de cuentas para diferencial cambiario

### Go-live con operaciones multi-moneda
Añadir al protocolo de go-live:
  `fx-multicurrency-specialist` (validación de configuración TC y cuentas)
  → antes de procesar la primera transacción en moneda extranjera

---

## ACTUALIZACIÓN v4.0 — AGENTES 19 Y 20 INCORPORADOS

### CAPA 4 — Negocio: Finanzas y Contabilidad (actualizada)

| # | Agente | Especialidad |
|---|--------|-------------|
| 19 | `financial-credit-manager` | Crédito a clientes, cobranza, tesorería, flujo de caja, financiamiento bancario |
| 20 | `accounting-manager` | Contabilidad operativa, cierres, estados financieros, conciliaciones, costos, activos fijos |

---

### El Triángulo Financiero-Contable: Cómo Coordinan los 4 Agentes

```
                    ┌─────────────────────────┐
                    │   accounting-manager    │
                    │  (registro + cierre)    │
                    └────────────┬────────────┘
                                 │ recibe datos y
                                 │ registra asientos
              ┌──────────────────┼──────────────────┐
              │                  │                  │
   ┌──────────▼──────┐  ┌────────▼────────┐  ┌────▼──────────────┐
   │financial-credit │  │ fx-multicurrency│  │legal-compliance   │
   │    -manager     │  │   -specialist   │  │   -consultant     │
   │(crédito + caja) │  │(diferencial FX) │  │(reglas NIF/IFRS)  │
   └─────────────────┘  └─────────────────┘  └───────────────────┘
              │                                        │
              └──────────────── reporta a ─────────────┘
                              bi-analyst
                         (KPIs y dashboards)
```

**Flujo de coordinación en el cierre mensual:**
1. `financial-credit-manager` provee: provisiones de cartera + posición bancaria
2. `fx-multicurrency-specialist` provee: revaluación de saldos + diferencial cambiario
3. `legal-compliance-consultant` confirma: cumplimiento de corte fiscal
4. `accounting-manager` integra todo y cierra el período
5. `bi-analyst` toma los estados financieros cerrados y actualiza los dashboards

---

### Cuándo Activar Cada Agente Financiero-Contable

| Situación | Agente principal | Coordina con |
|-----------|-----------------|--------------|
| Cliente pide más crédito del autorizado | `financial-credit-manager` | — |
| Cartera vencida +90 días, qué hacer | `financial-credit-manager` | `accounting-manager` |
| Flujo de caja proyectado con brecha | `financial-credit-manager` | — |
| ¿Cuánto caja tenemos hoy? | `financial-credit-manager` | — |
| Asiento contable incorrecto | `accounting-manager` | — |
| Cierre del mes | `accounting-manager` | todos del triángulo |
| Estados financieros para directivos | `accounting-manager` → | `bi-analyst` |
| Costo de ventas descuadrado | `accounting-manager` | `database-administrator` |
| Depreciación no calculada | `accounting-manager` | — |
| Pérdida cambiaria en P&L | `fx-multicurrency-specialist` | `accounting-manager` |
| Deducibilidad fiscal de provisión | `legal-compliance-consultant` | `accounting-manager` |
| Dashboard de rentabilidad por cliente | `bi-analyst` | `accounting-manager` |

---

### Squad Completo v4.0: 20 Agentes

**CAPA TÉCNICA (8):**
01-system-architect | 02-code-logic-analyst | 03-security-guardian
04-frontend-design-specialist | 05-backend-cloud-engineer
06-devops-qa-engineer | 07-performance-monitoring-specialist
17-code-quality-refactor-specialist

**CAPA DE DATOS (3):**
12-database-administrator | 15-bi-analyst | 18-fx-multicurrency-specialist

**CAPA ERP (2):**
09-erp-integration-engineer | 10-erp-business-architect

**CAPA DE NEGOCIO (7):**
11-quality-uat-director | 13-project-manager-erp
14-logistics-supply-chain-consultant | 16-legal-compliance-consultant
08-business-docs-manager | 19-financial-credit-manager
20-accounting-manager

---

## ACTUALIZACIÓN v5.0 — AGENTES 21, 22 Y 23 INCORPORADOS

### CAPA 4 — Negocio: Finanzas, Control y Gestión (completa)

| # | Agente | Especialidad |
|---|--------|-------------|
| 19 | `financial-credit-manager` | Crédito, cobranza, tesorería, flujo de caja, financiamiento |
| 20 | `accounting-manager` | Contabilidad operativa, cierres, estados financieros, costos |
| 21 | `financial-planning-analyst` | FP&A: presupuesto, forecast, escenarios, sensibilidad, CAPEX |
| 22 | `system-auditor` | Auditoría interna continua del ERP post go-live |
| 23 | `implementation-controller` | Knowledge base, log de cambios, control de tareas, memoria del proyecto |

---

### Cómo se Relacionan los 5 Agentes Financieros/Control

```
financial-planning-analyst    → CONSTRUYE el presupuesto y los modelos
         ↓ entrega presupuesto
accounting-manager            → REGISTRA real vs. presupuesto al cerrar el mes
         ↓ entrega estados financieros
financial-credit-manager      → OPERA la caja y el crédito día a día
         ↓ reporta posición
bi-analyst                    → PRESENTA todos los datos en dashboards

system-auditor                → VERIFICA que todo lo anterior se hace como fue diseñado
implementation-controller     → REGISTRA todo lo que se hace y lo que queda pendiente
```

---

### Regla de Oro del Agente 23 (implementation-controller)

Este agente resuelve el problema de memoria entre sesiones de Claude Code.
Al iniciar CUALQUIER sesión de trabajo, invocar primero:

  "implementation-controller: dame el briefing de inicio de sesión"

Al terminar CUALQUIER sesión:

  "implementation-controller: registra el cierre de sesión con [lo que hicimos]"

Esto garantiza que ningún avance se pierda entre conversaciones.

---

### Cuándo Activar el Agente 22 (system-auditor)

| Frecuencia | Auditoría |
|------------|-----------|
| Mensual | Accesos y segregación de funciones |
| Mensual | Integridad de datos entre módulos |
| Trimestral | Configuración vs. diseño aprobado |
| Antes de cada cierre anual | Auditoría completa pre-auditoría externa |
| Inmediato | Cuando se detecta actividad anómala |
| Post go-live (30 días) | Primera auditoría de ajuste |

---

### Squad Definitivo: 23 Agentes

CAPA TÉCNICA (8):
  01 system-architect | 02 code-logic-analyst | 03 security-guardian
  04 frontend-design-specialist | 05 backend-cloud-engineer
  06 devops-qa-engineer | 07 performance-monitoring-specialist
  17 code-quality-refactor-specialist

CAPA DE DATOS (3):
  12 database-administrator | 15 bi-analyst | 18 fx-multicurrency-specialist

CAPA ERP (2):
  09 erp-integration-engineer | 10 erp-business-architect

CAPA DE NEGOCIO (10):
  08 business-docs-manager | 11 quality-uat-director
  13 project-manager-erp | 14 logistics-supply-chain-consultant
  16 legal-compliance-consultant | 19 financial-credit-manager
  20 accounting-manager | 21 financial-planning-analyst
  22 system-auditor | 23 implementation-controller

---

## ACTUALIZACIÓN v6.0 — AGENTES 24 Y 25 INCORPORADOS

### Agente 24 — system-context-reader
**Cuándo es el primer agente a llamar:**
- Se hereda un sistema existente sin documentación o con documentación desactualizada
- Un agente dice "necesito entender cómo funciona X antes de modificarlo"
- Pre-integración: conectar el ERP con un sistema externo ya construido
- Onboarding de nuevo agente o persona al proyecto
- Antes de cualquier migración de datos desde un sistema legado

**Regla:** este agente siempre opera antes que cualquier otro cuando hay un sistema 
existente involucrado. Su output (Mapa de Contexto) es el insumo para los demás.

### Agente 25 — mobile-implementation-specialist
**Cuándo activarlo:**
- Implementar cualquier módulo del ERP en dispositivos móviles
- Decisión de enfoque: PWA vs. React Native vs. Flutter
- Diseñar el módulo de aprobaciones, almacén o cobranza para campo
- Configurar notificaciones push operativas del ERP
- Publicar la app en App Store o Google Play

**Coordinaciones clave del Agente 25:**
- Con `backend-cloud-engineer` → APIs del ERP optimizadas para móvil
- Con `security-guardian` → autenticación móvil y cifrado local
- Con `devops-qa-engineer` → pipeline de build y distribución móvil
- Con `frontend-design-specialist` → sistema de diseño compartido web/móvil

### Secuencia: Sistema Legado + Nueva Implementación
Cuando se trabaja sobre un sistema existente para agregar funcionalidad o migrar:
1. `system-context-reader` → mapa del sistema actual
2. `implementation-controller` → registra el contexto como knowledge base
3. `system-architect` → diseña la intervención basada en el contexto real
4. [agente específico del dominio] → implementa con contexto completo

### Squad Definitivo v6.0: 25 Agentes

CAPA TÉCNICA (9):
  01 system-architect | 02 code-logic-analyst | 03 security-guardian
  04 frontend-design-specialist | 05 backend-cloud-engineer
  06 devops-qa-engineer | 07 performance-monitoring-specialist
  17 code-quality-refactor-specialist | 25 mobile-implementation-specialist

CAPA DE DATOS (3):
  12 database-administrator | 15 bi-analyst | 18 fx-multicurrency-specialist

CAPA ERP (3):
  09 erp-integration-engineer | 10 erp-business-architect | 24 system-context-reader

CAPA DE NEGOCIO (10):
  08 business-docs-manager | 11 quality-uat-director
  13 project-manager-erp | 14 logistics-supply-chain-consultant
  16 legal-compliance-consultant | 19 financial-credit-manager
  20 accounting-manager | 21 financial-planning-analyst
  22 system-auditor | 23 implementation-controller

---

## ACTUALIZACIÓN v9.0 — CANON DE VALIDACIÓN PIXEL-PERFECT (2026-05-11)

### Decisión tomada: 2026-05-11

**Descubierto durante chk5.C-UX-PASS-AUDIT** tras múltiples iteraciones donde
el usuario detectaba que el render real **no coincidía con el mockup canon**:
tipografía distinta, orden de elementos cambiado, emojis residuales,
componentes shared con estilo legacy.

Cita literal del usuario (2026-05-11):
> *"Y porque estaba pasando esto, si en teoria estamos copiando el mock up al
> pie de la letra pixel perfect!?"*

### Causa raíz del problema

La implementación **NO copiaba el mockup pixel-perfect** · re-escribía clases
Tailwind desde memoria/interpretación. Esto generaba "creep de implementación":
cada componente terminaba con 5-10 modificaciones no aprobadas por el usuario.

**Ejemplo del problema** (KpiStripGastos · Recurrentes):
```html
<!-- Mockup canon · HTML LITERAL -->
<div class="text-2xl font-bold tabular text-indigo-900">
  0<span class="text-indigo-400">%</span>
</div>
```

```tsx
<!-- Implementación inicial · re-escrita desde memoria -->
<div className="text-xl md:text-2xl font-bold tracking-tight tabular-nums text-indigo-900">
  {kpis.porcentajeRecurrentes.toFixed(0)}
  <span className="text-base text-indigo-400 font-normal">%</span>
</div>
```

3 modificaciones que NO estaban en el mockup:
- `tracking-tight` agregado
- `text-base` en el span
- `font-normal` en el span

Resultado visual: números más apretados y la unidad/decimales más chicos
en localhost vs mockup. Anti-canon.

### Regla operativa · 5 mandamientos del pixel-perfect

Cuando un mockup canon HTML existe, la implementación DEBE seguir estos 5
mandamientos sin excepción:

#### M1 · Copy-paste literal de `className`

NO re-escribir clases Tailwind desde memoria. ABRIR el mockup HTML y
COPIAR LITERAL el `class` del elemento equivalente. Permitidas solo:

- Conversión `class` → `className` (sintaxis JSX)
- Conversión `tabular` (custom mockup) → `tabular-nums` (Tailwind canon)
- Conversión de iconos lucide CDN (`<i data-lucide="X">`) → import React
- Variables dinámicas (ej. `{kpi.valor}` reemplaza `0`)

Cualquier otra modificación de className requiere **aprobación explícita
del usuario** antes de aplicarse.

#### M2 · Prohibido agregar utilities no presentes en el mockup

Lista negra de adiciones unilaterales encontradas en chk5.C:
- ❌ `tracking-tight` en valores numéricos
- ❌ `text-base font-normal` en unidades/decimales (debe ser solo cambio de color · canon F7)
- ❌ `rounded-xl` cuando el mockup tiene `rounded-lg`
- ❌ `font-semibold` cuando el mockup tiene `font-medium`
- ❌ Wrappers extra alrededor de chevrons / iconos
- ❌ Rings pesados (`ring-2 ring-white`) en dots que el mockup no tiene
- ❌ `md:` agregar breakpoints que el mockup no especifica

Si la implementación necesita una clase que no está en el mockup
(ej. responsive `sm:`, `md:`), DECLARARLA al usuario antes de aplicarla.

#### M3 · Auditar componentes shared antes de usarlos

Cuando una página canon usa un componente shared (ej. `LineaDropdown`,
`Button`, `Modal`), **abrir el componente shared y compararlo con el mockup**
antes de asumirlo "ya canon". Componentes shared pueden tener estilo legacy
heredado de antes del canon.

Si el shared no matchea el mockup:
- ✅ Opción A · refactor del shared para que matchee (cambio universal)
- ✅ Opción B · prop nuevo `variant="canon-v9"` que opt-in al estilo nuevo
- ❌ Opción C · usarlo con su estilo legacy "porque ya estaba"

#### M4 · Validación screenshot side-by-side antes de cerrar fase

Antes de marcar una fase "canon completo" o "pixel-perfect":

1. Renderizar localhost con la fase implementada
2. Abrir el mockup HTML en otra pestaña
3. **Comparar visualmente lado a lado** elemento por elemento
4. Documentar cualquier desviación encontrada (mismo proceso que validar tsc)
5. Solo declarar "canon completo" si pasa la comparación visual

`tsc 0 errores + vite build OK` valida que **compila**. NO valida que **se ve igual**.

Idealmente con herramientas: Playwright snapshot diff · Storybook · Percy · Chromatic.
Mínimo: screenshot manual side-by-side.

#### M5 · Cuando el usuario detecta desviación · auditar el resto

Si el usuario detecta una desviación visual (ej. "esta fuente es distinta"),
la respuesta correcta NO es solo arreglar ese punto. ES:

1. Arreglar ese punto específico
2. **Auditar los demás componentes** de la misma página/sesión
3. Reportar al usuario qué otras desviaciones existen
4. NO esperar a que el usuario detecte una por una (es desgastante para él
   y rompe el principio de "solución integral · cero atajos")

### Prohibiciones explícitas v9.0

- ❌ Re-escribir clases Tailwind desde memoria · siempre copy-paste del mockup
- ❌ Agregar utilities no presentes en el mockup sin declararlo
- ❌ Asumir que componentes shared están "ya canon" · auditarlos
- ❌ Declarar "fase canon completa" sin haber hecho screenshot side-by-side
- ❌ Fixear solo lo que el usuario detecta sin auditar el resto

### Aplica a

- ✅ Retroactivamente: chk5.C Gastos (audit en curso)
- ✅ Todos los reworks futuros: chk5.D Tesorería · chk5.E Compras · chk5.F Envíos · chk5.G Ventas
- ✅ Cualquier nuevo módulo declarado post 2026-05-11

### Cómo verificar cumplimiento antes de cerrar una sesión de rework

Checklist obligatorio canon v9.0:

1. ✅ Cada `className` de cada componente fue **copy-paste literal** del mockup HTML
2. ✅ Cero utilities agregadas sin aprobación (`tracking-tight` · `font-normal` en unidades · `rounded-xl` cuando mockup tiene `rounded-lg` · etc.)
3. ✅ Componentes shared usados fueron auditados contra el mockup
4. ✅ Screenshot side-by-side con mockup hecho · sin desviaciones visibles
5. ✅ Si el usuario detectó desviación durante UAT, se auditaron TODOS los componentes de la misma sesión

Si algún punto falla, la fase NO está "canon completa" · es "parcialmente
canon" y eso es deuda visible inaceptable según principio rector.

---

## ACTUALIZACIÓN v8.0 — CANON COLOR SEMÁNTICO + RESPONSIVE PATTERNS (chk5.C-UX-PASS · 2026-05-11)

### Decisión tomada: 2026-05-11

**Descubierto durante el rework UX de Gastos** tras feedback del usuario:
> *"no siento un flujo u orden en los patrones de diseño · todo está muy gris ·
> la experiencia para el usuario UI/UX no es clara"*

Audit reveló que el canon visual previo (v7.0) declaraba **estructura** pero
no **color semántico + responsive**. Resultado: módulos quedaban gris uniforme,
mobile rompía en componentes sin clases responsive (`FiltrosGastosBar.tsx`
tenía 0 clases responsive · `LinkCardEficiencia.tsx` 0 también).

**10 patrones nuevos N1-N10** descubiertos en mockup `gastos-rework-v4-responsive-color.html`
que se vuelven canon obligatorio para todos los reworks futuros.

### N1 · Color semántico por KPI (paleta canon)

Cada KPI debe tener un **tinte que comunique su naturaleza**, no slate uniforme.

| Métrica/Concepto | Tinte canon | Color Tailwind | Cuándo usarlo |
|------------------|-------------|----------------|---------------|
| Gasto · Dinero · Período | `amber` | amber-50/700/900 | Warmth · dinero saliendo |
| Burn Rate · Consumo | `rose` | rose-50/700/900 | Quema de cash |
| Recurrentes · Compromisos fijos | `indigo` | indigo-50/700/900 | Commitment estable |
| Vencimientos · Urgencia | `rose-strong` | rose-100/300/900 | Alerta accionable |
| DPO · Cash management | `emerald` | emerald-50/700/900 | Cash health positivo |
| Inversión · Capital | `blue` | blue-50/700/900 | Capital atrapado |
| Pagado · Success | `emerald` | emerald-100/700 | Estado positivo cerrado |
| Pendiente · Espera | `amber` | amber-100/700 | Espera no urgente |
| Parcial · En proceso | `sky` | sky-100/700 | Progreso intermedio |
| Cancelado · Anulado | `rose` | rose-100/700 | Estado negativo cerrado |

**Prohibido**: KPI strip con todos los cards en slate-50/100 uniforme.

### N2 · Cards KPI con gradient sutil + ring colored

CSS exacto canon:

```html
<div class="bg-gradient-to-br from-{COLOR}-50 to-{COLOR}-100/40
            ring-1 ring-{COLOR}-200/50 rounded-2xl p-4">
  <div class="flex items-center justify-between mb-2">
    <span class="text-[10px] uppercase tracking-wider text-{COLOR}-700 font-bold">
      LABEL
    </span>
    <i data-lucide="..." class="w-3.5 h-3.5 text-{COLOR}-700"></i>
  </div>
  <div class="text-2xl font-bold tabular-nums text-{COLOR}-900">
    VALOR<span class="text-{COLOR}-400">.DECIMALES</span>
  </div>
  <div class="text-[11px] text-{COLOR}-700 flex items-center gap-1 mt-1">
    <i data-lucide="trending-up" class="w-3 h-3"></i> DELTA
  </div>
</div>
```

**Prohibido**: fondo color full sólido (rompe la sutileza Mercury/Linear).
**Prohibido**: borde plano sin ring (queda chato).

### N3 · Mini-stats integrados como FOOTER del MISMO card KPI strip

Los mini-stats secundarios (top proveedor · sin clasificar · próximo vencimiento)
viven **dentro del mismo card** del KPI strip como footer compacto, NUNCA como
banner gris separado abajo.

CSS canon:
```html
<div class="bg-slate-50/50 border-t border-slate-200 px-4 py-2
            flex items-center gap-4 text-[11px] flex-wrap">
  <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
    Mini-stats:
  </span>
  <!-- 3 chips inline con icon + label + value -->
</div>
```

**Prohibido**: `<div className="bg-slate-50 rounded-xl p-3 mb-4">` con mini-stats aparte.

### N4 · Color cross-módulo por bloque/origen (semantic consistency)

Estos tintes deben ser **idénticos** en todos los módulos del sistema (FiltrosBar
en Gastos, cards en Compras, breadcrumbs en CI, etc.):

| Concepto | Tinte | Razón |
|----------|-------|-------|
| Bloque Producto · OC origen · Importación | `blue` | Capital · entrada |
| Bloque Venta · Venta origen · Marketing | `purple` | Comercial · salida |
| Bloque Período · Overhead · Operativo | `amber` | Fijo · time-based |
| Envío origen · Logística | `purple` | Movimiento físico |
| Manual origen · sin vinculación | `slate` | Neutral |

Si un usuario aprende "purple = Venta" en FiltrosBar, lo debe reconocer en
GastoCardCanonico, en VistaPorBloque, en breadcrumbs y en cualquier otro lugar.

### N5 · Filtros colapsables en mobile (<sm:640px)

CSS canon:
```html
<!-- Mobile: collapsed by default -->
<button class="sm:hidden w-full px-4 py-3 flex items-center justify-between">
  <span class="flex items-center gap-2">
    <i data-lucide="filter"></i>
    <span class="font-bold">Filtros</span>
    <span class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full">
      {{ activeCount > 0 ? `${activeCount} activos` : 'Sin filtros' }}
    </span>
  </span>
  <i data-lucide="chevron-down"></i>
</button>

<!-- Desktop: always visible -->
<div class="hidden sm:flex ..."> ... </div>
```

**Razón**: filtros desktop ocupan ~40% del viewport mobile · es UX pésima.

### N6 · Scroll horizontal en tab/toggle navigation mobile

Cuando hay N tabs (toggle vistas · filtros chips) en mobile, scroll horizontal
en vez de wrap (que rompe el grid):

```html
<div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
     style="scrollbar-width: none;">
  <button class="... whitespace-nowrap">...</button>
  <!-- N botones -->
</div>
```

**Razón**: wrap genera filas inestables (depende del label largo) · scroll-x
mantiene altura predecible.

### N7 · Sidebar responsive desde md: (768px) no lg: (1024px)

Layout principal de páginas con sidebar (DrawerUrgentes + TopProveedoresLight):

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div class="md:col-span-2"> {/* main */} </div>
  <aside class="md:col-span-1"> {/* sidebar */} </aside>
</div>
```

**Razón**: en iPad portrait (768px) ya hay espacio cómodo para sidebar. Esperar
a `lg:` (1024px) deja a iPads viendo "main full + sidebar amontonado abajo".

### N8 · Cross-link card SIEMPRE visible (con estado vacío + CTA)

Cuando un módulo tiene una card que linkea a otro módulo (ej. LinkCardEficiencia
Gastos → CI), **nunca ocultarla aunque no haya data**. En cambio, mostrar estado
vacío con CTA explicativa:

```html
<!-- BIEN -->
<div class="bg-gradient-to-r from-teal-50 to-cyan-50/30 border border-teal-200">
  <div>Ratios disponibles cuando tengas X + Y.</div>
  <button>Ver Cost Intelligence →</button>
</div>

<!-- MAL -->
{hasData && <LinkCard ... />}  // Si !hasData · usuario ni sabe que el feature existe
```

**Razón**: discovery de features cross-módulo. Sin esto, el ERP se siente
desconectado entre módulos.

### N9 · Empty state con quick-start cards de color

Empty states no son solo mensajes · son **onboarding accionable**. Patrón canon:

```html
<div class="grid grid-cols-3 gap-3">
  <button class="bg-white border border-slate-200 rounded-lg p-3
                 hover:border-{COLOR}-300 hover:bg-{COLOR}-50/30
                 text-left transition-colors">
    <i data-lucide="..." class="w-4 h-4 text-{COLOR}-600 mb-1.5"></i>
    <div class="text-[11px] font-bold text-slate-900">QUICK-START LABEL</div>
    <div class="text-[10px] text-slate-500">CONTEXT</div>
  </button>
  <!-- 3-4 cards · cada una con su tinte semántico hover -->
</div>
```

Cada card debe usar su **tinte semántico** (Alquiler=amber, Sueldo=indigo, SaaS=sky).

### N10 · Jerarquía cromática de acciones · 3 tiers

Botones de acciones del header siguen jerarquía canon estricta:

| Tier | Color | Cuándo |
|------|-------|--------|
| **Primary** | `bg-teal-600 hover:bg-teal-700 text-white` | Acción principal del módulo (Nuevo X) · 1 sola por contexto |
| **Destacada/Config** | `bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100` | Settings · políticas · ajustes (Política asignación · Recalcular CTRU) |
| **Neutral** | `bg-white text-slate-600 border-slate-200 hover:bg-slate-50` | Acciones secundarias frecuentes (Exportar · Ver P&L · Filtrar) |

**Prohibido**: `bg-slate-900` (negro plano) para primary · es Linear/Stripe-style
pero **rompe la paleta teal del sistema**. CTA primary SIEMPRE teal-600.

### Aplica a

- ✅ Retroactivamente: chk5.C Gastos rework (sesión en curso)
- ✅ Todos los reworks futuros: chk5.D Tesorería · chk5.E Compras · chk5.F Envíos · chk5.G Ventas
- ✅ Cualquier nuevo módulo declarado post 2026-05-11

### Cómo verificar cumplimiento antes de cerrar un rework

Checklist canon v8.0:

1. ✅ N1 · KPI strip usa color semántico (no slate uniforme)
2. ✅ N2 · Cards KPI con gradient sutil + ring colored (no fondo full)
3. ✅ N3 · Mini-stats integrados al card del KPI strip (no banner separado)
4. ✅ N4 · Chips de filtro con color cross-módulo consistente
5. ✅ N5 · Filtros colapsables en mobile (<640px)
6. ✅ N6 · Toggle vistas con scroll horizontal en mobile
7. ✅ N7 · Sidebar visible desde md: (768px)
8. ✅ N8 · Cross-link cards siempre visibles (estado vacío + CTA)
9. ✅ N9 · Empty state con quick-start cards de color
10. ✅ N10 · 3-tier jerarquía cromática de acciones (teal primary, indigo destacada, slate neutral)

Si algún punto del checklist no se cumple, el módulo NO está "canon v8.0".

### Prohibiciones explícitas v8.0

- ❌ Slate gris uniforme en cards KPI o secciones (excepto neutrales)
- ❌ Fondos color full sólido en cards (rompe sutileza Mercury/Linear)
- ❌ Banner gris separado debajo del KPI strip (mini-stats deben ser footer integrado)
- ❌ Cross-link cards ocultas cuando no hay data (siempre visibles con estado vacío)
- ❌ Sidebar visible recién en `lg:` (debe ser `md:`)
- ❌ Filtros desktop-full en mobile (deben colapsar)
- ❌ Toggle wrap en mobile (debe ser scroll horizontal)
- ❌ `bg-slate-900` o `bg-black` para primary CTA (siempre `teal-600`)

---

## ACTUALIZACIÓN v7.0 — DESIGN CANÓNICO FINAL · CONSTITUCIÓN VISUAL (2 may 2026)

### Decisión tomada: 2026-05-02

**El nuevo canónico final REEMPLAZA las 6 referencias canónicas previas (S54.x · v6.1).** La auditoría de los 54 mockups producidos a lo largo de 6 eras de evolución reveló inconsistencias significativas. Se cerró la constitución visual definitiva.

**Documentos foundacionales:**
- 📐 **`docs/DESIGN_CANONICO_FINAL.md`** · constitución textual con 14 decisiones cerradas (F1-F11 + IMPL-1/2/3) + 6 clarificaciones
- 🎨 **`docs/mockups/CANONICO_MASTER.html`** · referencia visual única con todos los componentes en uso · ejemplos en vivo · anti-patterns
- 📋 **`docs/MOCKUPS_AUDIT.md`** · auditoría de los 54 mockups por era con familias polimórficas
- 🔧 **`docs/mockups/DECISIONES_VISUALES.html`** · decision board que originó las 14 decisiones

### Política PIXEL-PERFECT obligatoria

> **PIXEL-PERFECT no es negociable. Nada de parches. Validación visual previa OBLIGATORIA antes de implementar.**

**Protocolo:**
1. Antes de cualquier cambio grande/riesgoso → consultar al usuario con plan claro
2. Mockup actualizado al canónico → vos validás → recién implemento
3. Si descubro discrepancia técnica con el canónico → CONSULTO antes de tocar
4. Cero parches unilaterales · cero atajos · cero "esto es suficiente"

### Las 14 decisiones del canónico final (resumen)

| Familia | Decisión |
|---------|----------|
| F1 · Header | Variante D (S58f) · breadcrumb ChevronRight + h1 con icon teal + subtítulo descriptivo + acciones primary-soft |
| F2 · KPI strip | B default · C con sparklines cuando hay tendencia · D solo dashboards ejecutivos |
| F3 · Filtros | UN componente compositional `<FiltrosBar>` con sub-componentes |
| F4 · Tablas/Cards | Cards apiladas POR DEFAULT · tabla solo en 3 excepciones (ledgers, catálogos densos, dashboards canvas) |
| F5 · Wizards | 1 paso = Modal · 3 pasos = Stepper horizontal · 4+ pasos = Sidebar vertical |
| F6 · Modales | A modal · B drill full-page · C legacy OC · +E drawer lateral |
| F7 · Números | tabular-nums OBLIGATORIO · decimales atenuados |
| F8 · Iconografía | lucide-react ÚNICO · prohibido emojis en chrome de UI |
| F9 · Breadcrumb sep | ChevronRight w-3 h-3 ÚNICO |
| F10 · Botones header | Jerarquía: secundarias planas → destructivas → primary-soft |
| F11 · Obsoletos | 2 mockups marcados obsoletos · 1 histórico · 2 a revisar |
| IMPL-1 · Orden | 10 grupos por valor + dependencia |
| IMPL-2 · Validación previa | OBLIGATORIA antes de cambios grandes/riesgosos |
| IMPL-3 · Mockups viejos | TODOS se re-revisan contra canónico final |

### Las 6 referencias canónicas previas (v6.1) · estado

**SUPERSEDED** por el nuevo canónico final. Se actualizan al estándar nuevo:

| # | Referencia previa | Estado |
|---|-------------------|--------|
| 1 | EnvioCardSimple | ✅ Pixel-perfect implementado · sigue vigente como ejemplo de "Cards apiladas" (F4 variante B) |
| 2 | CompraCard | ✅ Pixel-perfect implementado · sigue vigente como "Cards apiladas con sub-entidades" |
| 3 | OrdenCompraCard | ⚠️ Era 2 · queda como excepción declarada · NO se aplica a módulos nuevos |
| 4 | EnvioDetailModal | ✅ Sigue vigente como ejemplo de F6 variante B (drill full-page) |
| 5 | PipelineCompras | ⚠️ ELIMINADO del backlog general · solo excepción declarada para vistas de productos financieros con flujo de estados |
| 6 | FiltrosFinanzasBar | 📦 Se MIGRA a `<FiltrosBar>` componible junto con FiltrosGastosBar y FiltrosMovimientosBar |

### Plan de ejecución · 4 etapas

1. **Etapa 1 ✅** · Constitución cerrada (DESIGN_CANONICO_FINAL.md + CANONICO_MASTER.html)
2. **Etapa 2** · Mockups actualizados por módulo · ~5-6 sesiones · usuario valida cada módulo
3. **Etapa 3** · Validación visual módulo por módulo
4. **Etapa 4** · Implementación pixel-perfect contra mockups aprobados · ~6-8 sesiones

**Total estimado:** ~12-15 sesiones para 100% pixel-perfect verificado.

### Workflow validación: por módulo

Después de producir mockups actualizados de un módulo completo (ej. Productos+Stock), el usuario los valida holísticamente antes de pasar al siguiente. Patrón Stripe design review.

### Filosofía resumida en una frase

> **"Mercury para Banking + Linear para listados + Stripe para tablas + Notion para headers + Vercel para empty states. Tabular-nums en todo. Lucide-icons únicos. Sin emojis en chrome de UI. Sin gradientes pesados. Wizards en 3 niveles según largo. Filtros como bloque LEGO componible."**

---

## ACTUALIZACIÓN v6.1 — REFERENCIAS DE DISEÑO CANÓNICAS DECLARADAS (S54.x) · SUPERSEDED por v7.0

> ⚠️ **DEPRECATED 2026-05-02:** Esta sección queda como referencia histórica. La fuente de verdad visual es ahora `docs/DESIGN_CANONICO_FINAL.md` + `docs/mockups/CANONICO_MASTER.html`.

### Decisión tomada: 2026-04-25

Las páginas de /compras y /envios (en su estado actual S54.x) son la FUENTE DE VERDAD visual
del sistema. El resto del sistema debe alinearse a ellas, no al revés.

Cita literal del usuario: "ya teniendo mejor aterrizada la situacion, tengo claridad de que
el como estan diseñadas paginas como compras y envios, son las referencias finales".

### Las 6 Referencias Canónicas del Sistema

Estos son los archivos de referencia. NO se modifican durante la alineación del resto.
Cualquier cambio en ellos requiere autorización explícita del usuario.

| # | Referencia | Archivo | Para qué aplica |
|---|-----------|---------|----------------|
| 1 | Vista de lista de entidades | `src/pages/Envios/EnvioCardSimple.tsx` | Cards de fila en listado scrolleable |
| 2 | Vista de lista con sub-entidades | `src/components/modules/ordenCompra/CompraCard.tsx` | Cards con sub-órdenes anidadas |
| 3 | Detalle de entidad | `src/components/modules/ordenCompra/OrdenCompraCard.tsx` | Header + pipeline + KPIs + tabs en modal de detalle |
| 4 | Detalle con scroll y muchos tabs | `src/pages/Envios/EnvioDetailModal.tsx` | Modales con contenido extenso, tabs sticky |
| 5 | Pipeline de listado | `src/components/modules/ordenCompra/PipelineCompras.tsx` | Pipelines clickables arriba de listados |
| 6 | **Barra de filtros sobre listado (S58e)** | `src/pages/Finanzas/components/FiltrosFinanzasBar.tsx` | Filtros completos: rango fechas con calendar inline + chips toggle por estado/tipo + búsqueda + orden + limpiar global |

### Regla Operativa de Alineación

Cualquier nueva implementación o refactor de página/modal/card debe:
1. Identificar qué referencia aplica a su caso (de la tabla anterior).
2. Abrir ese archivo y observar su estructura visual y de componentes.
3. Replicar el patrón en la nueva pantalla.
4. Si ninguna referencia resuelve el caso (Kanban, dashboards, escáner), escalar al usuario
   antes de inventar. Existen "excepciones legítimas" declaradas (ver REGISTRO_IMPLEMENTACION.md).

### Documentación complementaria

- `docs/DESIGN_PATTERNS.md` seccion "Referencias de Diseño Canónicas (S54.x)" — detalle técnico
  de las primeras 5 referencias y de la 6ª (S58e · Imp-L11.b–e).
- `docs/REGISTRO_IMPLEMENTACION.md` seccion "SESIÓN S54.x — DECISIÓN ESTRATÉGICA: ALINEACIÓN
  GLOBAL DE DISEÑO" — plan de migración en 5 fases, riesgos, prerequisitos.
- `docs/REGISTRO_IMPLEMENTACION.md` seccion "SESIÓN S58e — IMP-L11.b–e · BARRA DE FILTROS
  CANÓNICA + 6ª REFERENCIA DECLARADA" — detalle de la 6ª referencia y plan de adopción global.
- Los 6 archivos referencia llevan un header de comentario en su código.

### Estado

La migración de páginas al estándar NO se ejecuta hasta que se completen los prerequisitos
declarados en REGISTRO_IMPLEMENTACION.md. Solo se dejó la decisión registrada y los marcadores.

**TAREA-FILTROS-GLOBAL declarada (S58e):** adoptar el patrón `FiltrosFinanzasBar` en TODOS
los listados filtrables del sistema. Cita del usuario: *"este es el modelo de filtro actual
que tiene que implementarse en todo lo que este pendiente"*. Sin fecha de inicio. Cuando
arranque, prerequisito es extraer los 6 sub-componentes a `src/components/common/filters/`
con compositional API (ver REGISTRO_IMPLEMENTACION.md S58e para el plan completo).
