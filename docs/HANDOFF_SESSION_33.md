# HANDOFF — Sesion 33
# BusinessMN v2 — ERP Vita Skin Peru
# Fecha: 2026-04-11

---

## 1. RESUMEN EJECUTIVO

La Sesion 33 fue la sesion de mayor impacto tecnico del proyecto hasta la fecha.
Se ejecutaron dos bloques de trabajo fundamentalmente distintos pero complementarios:

### Bloque A — Reingenieria del modelo de datos (Fases 0-7)

La reingenieria fue acordada en S32 con 53 acuerdos firmados con el PO. Su objetivo
fue transformar el modelo de Compras-Envios-Inventario-Costos de un modelo legacy
(transferencias/almacenes/estados complejos) al modelo nuevo (envios/casillas/estados
simplificados). Esto fue trabajo de "plomeria": el usuario no ve cambios inmediatos
pero el backend quedo correcto para soportar el redeseno visual futuro.

Resultado: 12 commits, ~80 archivos modificados, ~7,000 lineas de codigo,
Deploy 102 + 103, 1,656 documentos transaccionales eliminados de Firestore (BD limpia).

### Bloque B — Design System (migrado en S33 post-reingenieria)

Se creo desde cero un design system propio en src/design-system/ con 13 componentes
base + tokens + utils. Se migraron las paginas principales al nuevo sistema.
Se eliminaron colores inconsistentes (gray, primary, indigo, danger, success, warning)
y se unificaron en: teal (marca), slate (neutrales), emerald/amber/red/sky (semanticos).

Commits del design system: 3c98007 (creation) + commits de migracion posteriores.

### Contexto critico para el siguiente agente

El PO Jose expreso explicitamente que "el sistema se sigue viendo y sintiendo calcado
del original" y que "pintaron la casa pero sigue con las mismas grietas". Esto es el
principal punto de atencion para la proxima sesion. La proxima sesion DEBE generar
cambios visuales que el PO pueda ver y tocar. No mas plomeria sin cara visible.

---

## 2. REINGENIERIA — ESTADO COMPLETO

### Fases ejecutadas

Fase 0 — Limpieza Firestore: script 00-limpieza-total.mjs eliminando 1,656 docs
transaccionales de colecciones legacy (transferencias, unidades con estados viejos).

Fase 1 — Tipos TypeScript nuevos: 7 archivos de tipos creados para el modelo nuevo.

Fase 1.5 — Split god-service: transferencia.service.ts (1,592 lineas) dividido antes
del renaming masivo para evitar conflictos.

Fase 2 — Servicios backend: 8 servicios nuevos creados con la logica del modelo nuevo.

Fase 3 — Stores Zustand: 4 stores actualizados o creados para los nuevos servicios.

Fase 4 — Cloud Functions: CF actualizadas para el nuevo modelo de unidades y estados.

Fase 5 — Firestore: rules, indices y seed data desplegados.

Fase 6 — Paginas UI: rutas, labels, stores conectados a las paginas existentes.
(Nota: las paginas conservan el HTML anterior — solo se conectaron los nuevos servicios
y se cambiaron los nombres de estados/labels. El redeseno visual es trabajo futuro.)

Fase 7 — Dashboard: widget de rentabilidad 3 niveles + reporte directo/indirecto.

### Servicios creados (8)

src/services/envio.service.ts
  — Gestor principal de Envios (ex-transferencias). CRUD + transiciones de estado.
  — Estados: borrador → confirmado → en_transito → recibido_parcial → recibido_completo

src/services/casilla.service.ts
  — Gestor de Casillas (ex-almacenes). CRUD + asignacion de unidades.
  — 12 casillas seed en Firestore: 6 Peru, 6 Miami/Origen.

src/services/unidad.service.ts
  — Gestor de Unidades individuales de producto (inventario atomico).
  — Estados NUEVO: pedida → en_transito → disponible → reservada → asignada_venta → vendida
  — Excepciones: danada | perdida | retenida_aduana

src/services/costoImportacion.service.ts
  — Modelo 3 cajas: costoProducto + costoEnvio + costoAduana
  — Prorrateo 3 metodos: proporcional (peso), proporcional (valor FOB), manual

src/services/colaborador.service.ts
  — 4 tipos: vendedor | proveedor_externo | agente_aduanas | transportista
  — 11 colaboradores seed en Firestore

src/services/categoriaGasto.service.ts
  — Categorias dinamicas (no hardcodeadas). 53 categorias seed en Firestore.
  — Antes: enum estatico CATEGORIAS_GASTO. Ahora: coleccion Firestore con CRUD.

src/services/redLogistica.service.ts
  — Vista de la red logistica: casillas + envios en trayecto + disponibilidad por ubicacion.
  — Read-only service que agrega datos de casillas, unidades y envios.

src/services/inventarioNuevo.service.ts
  — Inventario por casilla + por producto + KPIs logisticos.
  — Reemplaza gradualmente el inventario.service.ts legacy.

### Tipos creados (7)

src/types/envio.types.ts
  — EnvioBase, EnvioConItems, EstadoEnvio, ItemEnvio, FleteCosto

src/types/casilla.types.ts
  — Casilla, CasillaUbicacion, TipoCasilla (origen | transito | destino)

src/types/unidad.types.ts
  — Unidad, EstadoUnidad, MovimientoUnidad, TransicionUnidad

src/types/costoImportacion.types.ts
  — CostoImportacion, Caja3, MetodoProrrateo

src/types/colaborador.types.ts
  — Colaborador, TipoColaborador, PerfilColaborador

src/types/categoriaGasto.types.ts
  — CategoriaGasto (dinamica), SubcategoriaGasto

src/types/redLogistica.types.ts
  — NodoLogistico, AristaLogistica, EstadoRed

### Cloud Functions actualizadas

onOrdenCompraConfirmada (NUEVO trigger):
  — Antes: onOrdenCompraRecibida disparaba al recibir → creaba unidades al recibir
  — Ahora: onOrdenCompraConfirmada dispara al confirmar la OC → crea unidades con
    estado "pedida" inmediatamente al confirmar
  — Ubicacion: functions/src/triggers/ordenCompra.triggers.ts

ml.stock.ts actualizado:
  — disponible_peru → disponible (estado legacy eliminado)
  — disponible → unidades con estado "disponible" en casilla Peru

56 funciones totales desplegadas post-S33.

### Firestore — Colecciones, reglas e indices

Colecciones nuevas creadas:
  casillas/ — 12 documentos seed
  colaboradores/ — 11 documentos seed
  categoriasGasto/ — 53 documentos seed
  unidades/ — vacia, se llena al confirmar OC

Indices nuevos (firestore.indexes.json):
  unidades: casillaId + estado + fechaCreacion (composite)
  unidades: productoId + estado (composite)
  envios: estado + fechaEnvio (composite)
  colaboradores: tipo + activo (composite)

Reglas actualizadas (firestore.rules):
  — casillas: lectura publica (authenticated), escritura gerente+admin
  — colaboradores: lectura publica, escritura admin
  — categoriasGasto: lectura publica, escritura gerente+admin
  — unidades: lectura publica, escritura sistema (via CF) + admin

### Seed data en produccion (NO eliminar)

11 colaboradores en Firestore (coleccion: colaboradores):
  Tipos: 4 vendedores, 3 proveedores externos, 2 agentes aduanas, 2 transportistas

12 casillas en Firestore (coleccion: casillas):
  Peru (destino): Almacen Lima Central, Almacen Lima Norte, Pick-and-Pack, etc.
  Miami (origen): Almacen Miami 1, Almacen Miami 2, etc.

53 categorias de gasto en Firestore (coleccion: categoriasGasto):
  Reemplaza el enum CATEGORIAS_GASTO hardcodeado en gasto.types.ts.
  El enum legacy sigue en el codigo como fallback temporal.

---

## 3. DESIGN SYSTEM — ESTADO COMPLETO

Ubicacion: src/design-system/

Importar desde: import { ComponentName } from '../../design-system'

### Archivos base

src/design-system/tokens.ts
  — Fuente unica de tokens: colors, surface, text, spacing, elevation, radius,
    border, transition, statusColors.
  — semantic.brand = 'teal', semantic.neutral = 'slate'
  — Importar SIEMPRE desde aqui, nunca hardcodear clases de color.

src/design-system/utils.ts
  — Exporta cn() (classnames merger con tailwind-merge)

src/design-system/index.ts
  — Barrel export de TODOS los componentes del design system.
  — Importar siempre desde '../../design-system', nunca rutas directas.

### Componentes — Layout (6)

PageShell (src/design-system/components/PageShell.tsx)
  — Wrapper obligatorio para TODAS las paginas.
  — Aplica: bg-slate-50, padding lateral/vertical, space-y-6 entre secciones.
  — Consumidores actuales: ~30 paginas ya migradas.
  — Estado: COMPLETAMENTE INTEGRADO.

PageHeader (src/design-system/components/PageHeader.tsx)
  — Header limpio para todas las paginas. Sin gradientes.
  — Props: title, subtitle, icon (LucideIcon), actions, badge.
  — Icono en teal-50/teal-600. Titulo en text-slate-900.
  — Consumidores actuales: ~30 paginas ya migradas.
  — Estado: COMPLETAMENTE INTEGRADO.

Toolbar (src/design-system/components/Toolbar.tsx)
  — Barra debajo del header: busqueda + filtros + toggle tabla/cards + acciones.
  — search: { value, onChange, placeholder }
  — onFilterToggle + filterCount: muestra contador activo en teal.
  — viewMode + onViewModeChange: iconos List/LayoutGrid.
  — Consumidores actuales: ~14 paginas.
  — Estado: COMPLETAMENTE INTEGRADO. Pendiente: integrar LineaFilterInline aqui.

FilterDrawer (src/design-system/components/FilterDrawer.tsx)
  — Panel lateral derecho deslizable. Overlay oscuro. Cierra con Escape.
  — Ancho: 380px en desktop, full en mobile.
  — Footer con boton "Limpiar todo" y "Aplicar".
  — Consumidores actuales: ~5 paginas.
  — Estado: INTEGRADO en paginas principales. Pendiente: mas paginas.

FilterSection (src/design-system/components/FilterSection.tsx)
  — Seccion colapsable dentro del FilterDrawer.
  — Props: title, icon, defaultOpen, badge.
  — Animacion CSS grid-rows para expand/collapse.
  — Estado: INTEGRADO (se usa dentro de FilterDrawer).

ContentArea (src/design-system/components/ContentArea.tsx)
  — Toggle automatico tabla/cards + loading skeleton + empty state.
  — Requiere tableComponent y cardComponent como render props.
  — Estado: CREADO, pendiente integracion masiva. Solo 0 paginas lo usan.
  — PROXIMA PRIORIDAD de integracion.

### Componentes — Data Display (5)

DataTable (src/design-system/components/DataTable.tsx)
  — Tabla sortable unificada. Columnas con header, render, sortable, width, align.
  — onSort + sortBy + sortDirection para sorting controlado.
  — compact prop para tablas densas.
  — Consumidores actuales: ~2 tablas migradas.
  — Estado: CREADO. Pendiente integracion masiva (hay 20+ tablas legacy).

DataCard (src/design-system/components/DataCard.tsx)
  — Card unificada para items de listas (OC, venta, envio, etc.)
  — Props: title, subtitle, code, status, stats, badges, meta, actions, accentVariant.
  — accentVariant agrega borde izquierdo de color semantico.
  — stats: grid 2 columnas con bg-slate-50.
  — Estado: CREADO. Pendiente integracion. Las cards actuales (OrdenCompraCard,
    TransferenciaCard, etc.) siguen siendo los componentes custom.

StatCard (src/design-system/components/StatCard.tsx)
  — Stat card unificada. Reemplaza KPICard legacy y StatCard de ProfessionalUI.
  — Props: label, value, icon, trend, variant (StatusVariant), size, onClick, active.
  — active prop agrega borde izquierdo del color del variant.
  — Consumidores actuales: ~12 usos en paginas migradas.
  — Estado: INTEGRADO en paginas principales.

KPIBar (src/design-system/components/KPIBar.tsx)
  — Grid responsive de StatCards. columns: 2|3|4|5|6.
  — Estado: INTEGRADO donde se usa StatCard.

StatusBadge (src/design-system/components/StatusBadge.tsx)
  — Badge semantico con variantes: success|warning|danger|info|neutral|brand.
  — Props: dot (punto de color), icon (icono lucide), size sm|md.
  — Estado: INTEGRADO en DataCard. Pendiente reemplazar Badge legacy en mas lugares.

### Componentes — Forms (2)

FormModal (src/design-system/components/FormModal.tsx)
  — Wrapper de Modal para formularios. Footer con Cancelar/Guardar en teal.
  — Usa el Modal existente (bien construido) como base.
  — variant: 'create' | 'edit' | 'confirm' — cambia el label del boton.
  — Estado: CREADO. Pendiente integracion. Los modales actuales usan Modal directo.

FormField (src/design-system/components/FormField.tsx)
  — Wrapper de campo: label + input + error + hint.
  — horizontal prop para layout en linea.
  — Estado: CREADO. Pendiente integracion masiva en formularios.

---

## 4. COLORES — ESTADO FINAL

### Lo que existia antes (ELIMINADO)

- gray-* en Tailwind: reemplazado por slate-*
- text-primary-*, bg-primary-*: reemplazado por text-teal-*, bg-teal-*
- indigo-*: eliminado de la paleta (existia como color de marca anterior)
- bg-danger-*, text-danger-*: reemplazado por red-*
- bg-success-*, text-success-*: reemplazado por emerald-*
- bg-warning-*, text-warning-*: reemplazado por amber-*
- bg-gradient-to-*: eliminados (diseño plano)

### Lo que esta en uso ahora

teal — MARCA: botones primarios, iconos de header, acentos, focus rings, FilterDrawer
slate — NEUTRALES: texto, fondos de pagina, bordes, tabla headers
emerald — SUCCESS: pagos completados, stock disponible, estados positivos
amber — WARNING: alertas, vencimientos proximos, estados de atencion
red — DANGER: errores, vencidos, estados criticos, eliminaciones
sky — INFO: informacion contextual, tooltips, estados neutros informativos

### CSS Variables (src/index.css)

:root {
  --brand: 13 148 136;         teal-600 — botones, acentos
  --brand-hover: 15 118 110;   teal-700 — hover
  --brand-light: 240 253 250;  teal-50 — fondos tint
  --brand-text: 15 118 110;    teal-700 — texto sobre fondo claro
  --surface-page: 248 250 252; slate-50 — fondo pagina
  --surface-card: 255 255 255; white — fondo cards
  --text-primary: 15 23 42;    slate-900
  --text-secondary: 51 65 85;  slate-700
  --text-body: 71 85 105;      slate-600
  --text-caption: 100 116 139; slate-500
  --text-muted: 148 163 184;   slate-400
  --border-default: 226 232 240; slate-200
  --border-subtle: 241 245 249;  slate-100
}

PARA CAMBIAR EL COLOR DE MARCA DE TODA LA APP: solo modificar --brand-* en :root.

### tailwind.config.js — Estado final

LIMPIO. Solo 2 extensiones custom:
- brand: { DEFAULT, hover, light, text } — desde CSS variables
- surface: { page, card } — desde CSS variables

Todos los demas colores usan Tailwind nativo (teal, slate, emerald, amber, red, sky).
NO hay colores custom adicionales. NO hay primary, indigo, danger, success, warning.

---

## 5. ARCHIVOS ELIMINADOS

### ProfessionalUI.tsx — ELIMINADO

Ubicacion anterior: src/components/common/ProfessionalUI.tsx
Tamano: ~960 lineas
Razon: god-file con demasiada responsabilidad. Cada componente fue extraido.

Lo que contenia y donde fue a parar:
  TabNavigation → src/components/common/TabNavigation.tsx (archivo propio)
  SectionHeader → src/components/common/SectionHeader.tsx (archivo propio)
  EmptyState → src/components/common/EmptyStatePro.tsx (renombrado para evitar
    conflicto con EmptyStateAction que ya existia)
  StatCard → REEMPLAZADO por src/design-system/components/StatCard.tsx
  KPI layout components → REEMPLAZADOS por KPIBar + StatCard del design system

Los tres componentes extraidos fueron re-exportados desde el barrel:
  src/components/common/index.ts lineas 56-60:
    export { TabNavigation } from './TabNavigation';
    export { SectionHeader } from './SectionHeader';
    export { EmptyState } from './EmptyStatePro';

### KPICard.tsx — ARCHIVO EXISTENTE PERO MUERTO (deuda tecnica)

Ubicacion: src/components/common/KPICard.tsx
Estado: el archivo EXISTE fisicamente (960+ lineas con KPICard, KPIGrid, AlertCard,
        StatDistribution).
Problema: KPICard fue REMOVIDO del barrel src/components/common/index.ts.
El barrel solo exporta AlertCard y StatDistribution de ese archivo.
KPICard y KPIGrid ya no son accesibles publicamente — son dead code.

Razon del estado: AlertCard y StatDistribution siguen siendo necesarios
(se usan en Dashboard y otras paginas). Si se elimina el archivo completo
se rompen esos consumidores.

TODO para el proximo agente:
  1. Extraer AlertCard y StatDistribution a archivos propios.
  2. Eliminar KPICard.tsx completo.
  3. Reemplazar todos los usos de KPICard legacy por StatCard del design system.
  Buscar con: grep -r "KPICard" src/ (deberia dar 0 si ya se migro correctamente)

---

## 6. PROBLEMAS CONOCIDOS SIN RESOLVER

### Problema 1 — Worktrees git huerfanos (no critico)

Durante la sesion se crearon worktrees de git que no pudieron eliminarse debido
a permisos de Windows (el dev server apunta a uno de ellos y lo bloquea).

Impacto: 0 impacto en produccion. El codigo en main es el correcto.
Resolucion: cerrar todos los procesos node/vite y luego ejecutar:
  git worktree list
  git worktree remove --force [path]
No hacer esto mientras el dev server este activo.

### Problema 2 — OC: items hardcodeados + TC duplicado (registrado en memory)

Ver: .claude/projects/C--Users-josel-businessmn-v2/memory/project_oc_pendientes.md

En el Wizard de Ordenes de Compra:
  - Algunos valores estan hardcodeados en vez de ser dinamicos
  - tcCompra, tcReferencial y tcPago tienen logica solapada/duplicada

Impacto: confusion operativa + riesgo de inconsistencia de datos.
No bloquea operacion actual.
Resolucion: atender durante el Wizard OC con Sub-Ordenes (pendiente UI).

### Problema 3 — LineaFilterInline ocupa fila completa en 17 paginas

El filtro de linea de negocio (SUP/SKC) es un componente separado que ocupa
una fila completa debajo del PageHeader. Esto crea ruido visual y ocupa espacio.

Ver: .claude/projects/.../memory/project_filtro_linea_rework.md

El PO acepto el rework pero quiere evaluar las 3 opciones antes de decidir.
Las 3 opciones requieren mockup o prototipo antes de implementar.

### Problema 4 — Datos legacy coexisten con nuevo modelo

La reingenieria cambio el modelo conceptual pero los datos de Firestore fueron
migrados parcialmente. Hay documentos que usan el esquema nuevo y documentos
que usan el esquema legacy. Los servicios nuevos manejan esto con adaptadores,
pero es deuda tecnica que crecera si no se limpia.

Riesgo concreto: si se intenta usar ContentArea + DataCard en la pagina de Envios,
los datos de las transferencias legacy pueden no mapearse correctamente al
nuevo tipo EnvioConItems.

---

## 7. BUGS POTENCIALES

### Bug potencial 1 — sed title= → label= puede haber roto otros componentes

Durante la migracion de colores se usaron reemplazos masivos con sed para cambiar
props en componentes. El patron `title=` → `label=` fue aplicado para migrar
StatCards de las paginas de Inventario.

El StatCard del design system usa `label=` (no `title=`). El KPICard legacy
usa `title=`. Si el sed fue mas amplio de lo necesario, puede haber roto
componentes que usan `title=` para tooltips HTML (atributo nativo) o para
props de otros componentes.

Verificacion recomendada:
  grep -rn 'label=' src/pages/Inventario/ | head -20
  Navegar la pagina Inventario en browser y verificar que los StatCards muestran labels.

### Bug potencial 2 — EmptyState importaciones potencialmente rotas

EmptyState fue extraida de ProfessionalUI.tsx a EmptyStatePro.tsx y re-exportada
como EmptyState desde el barrel. Sin embargo, si algun archivo importaba
EmptyState directamente de ProfessionalUI (import { EmptyState } from '../ProfessionalUI')
en vez del barrel (import { EmptyState } from '../common'), esa importacion esta rota.

Verificacion:
  grep -rn "from.*ProfessionalUI" src/ | grep -v ".bak"
  Si hay resultados con EmptyState → es un import roto.

### Bug potencial 3 — CTRU sin GA/GO puede mostrar valores vacios

La reingenieria elimino GA (Gasto Administrativo) y GO (Gasto Operativo) del modelo
CTRU. Si algun componente del CTRU Dashboard accede a ctru.gastoAdministrativo o
ctru.gastoOperativo, va a recibir undefined en vez de un numero.

Verificacion:
  grep -rn "gastoAdministrativo\|gastoOperativo" src/ | grep -v ".bak"
  Si hay referencias activas → son bugs potenciales.

### Bug potencial 4 — Colores blue-* o green-* sobrevivientes

Los colores eliminados (danger, success, warning como custom Tailwind) fueron
reemplazados. Pero blue-* y green-* (Tailwind nativo que se usaba antes de la
estandarizacion) pueden sobrevivir en algunos archivos.

Impacto visual: badges o alertas con blue en vez de sky, green en vez de emerald.
No rompe nada pero es inconsistencia visual.

Busqueda: grep -rn "bg-blue-\|text-blue-\|bg-green-\|text-green-" src/pages/ | grep -v "node_modules"

---

## 8. UX DECISIONS PENDIENTES (requieren input del PO)

### Decision 1 — LineaFilterInline: ubicacion final

Situacion actual: fila completa debajo del header en 17 paginas. Inconsistente con
el nuevo PageHeader/Toolbar del design system.

Opciones a presentar al PO con mockup:
  Opcion A (Shopify style): Chip persistente en el Toolbar a la izquierda del buscador.
    Pros: siempre visible, 1 click para cambiar, no ocupa fila adicional.
    Contras: requiere modificar Toolbar para soportar prop de linea.
  Opcion B (Linear style): Selector dropdown en el PageHeader junto al titulo.
    Pros: jerarquicamente correcto (es un contexto global), muy limpio.
    Contras: mas complejo visualmente, el icono de linea debe estar en el header.
  Opcion C (Stripe style): Segmented control integrado en el header (SUP | SKC | Todos).
    Pros: muy claro, tabular, familiar.
    Contras: solo funciona bien si hay exactamente 2-3 opciones (hoy son 2: SUP/SKC).

Recomendacion del agente: Opcion C (segmented control en PageHeader) porque hay
exactamente 2 lineas y el PO quiere claridad maxima. Pero presentar las 3 al PO.

### Decision 2 — PipelineHeader: mantener, integrar o eliminar

PipelineHeader es un componente visual que muestra los estados de un proceso como
pipeline horizontal (Borrador → Confirmado → En Transito → Recibido).

Situacion actual: se usa en OrdenesCompra y Envios. Es visualmente distinto al
nuevo PageHeader.

Opciones:
  A: Mantener como esta — es un componente util aunque no esta en el design system.
  B: Integrarlo en FilterDrawer como indicador de estado activo del filtro.
  C: Convertirlo en una variante de filtro de chips horizontales dentro del Toolbar.

Recomendacion: Option A en el corto plazo. Mover al design system en una sesion dedicada.

### Decision 3 — Sidebar: tema oscuro vs. flat moderno

El sidebar actual tiene tema oscuro (bg-slate-800 o similar). El nuevo design system
es completamente flat y claro (bg-white, bg-slate-50).

Opciones:
  A: Mantener sidebar oscuro — contraste clasico navegacion/contenido.
  B: Cambiar a sidebar claro flat (bg-white, border-r) — estilo Linear/Vercel.
  C: Cambiar a sidebar muy sutil (bg-slate-50, border-r) — casi invisible.

El PO quiere "como top tech companies". Linear y Vercel usan sidebar claro.
Esta es una decision que el PO debe confirmar porque cambia el feeling completo.

### Decision 4 — Dashboard Executive Summary: gradiente vs. flat

La seccion ExecutiveSummarySection del Dashboard actualmente usa clases que pueden
incluir gradientes (bg-gradient-to-*).

El COLOR_GUIDE.md dice: "bg-gradient-to-* → no usar gradientes (diseño plano)".

Opciones:
  A: Eliminar todos los gradientes del ExecutiveSummary → fondo blanco simple.
  B: Reemplazar gradientes por un subtle color fill (bg-teal-50) en las KPI cards.
  C: Mantener gradiente solo en esta seccion como "accent" visual del dashboard.

Recomendacion: Opcion B. El hero del dashboard puede usar bg-teal-50 como fondo
de la fila de KPIs principales sin gradiente.

---

## 9. REDISENO PENDIENTE — PLAN DETALLADO

### a) Tablas — Integracion de DataTable

Que necesita cambiar: las 20+ tablas de la app usan HTML table directo con clases
inconsistentes. DataTable del design system tiene sorting, hover, compact, alineacion.

Archivos afectados principales:
  src/components/modules/ordenCompra/OrdenCompraTable.tsx
  src/pages/Envios/ (tabla interna de Transferencias)
  src/pages/Inventario/Inventario.tsx (tablas de unidades)
  src/pages/Tesoreria/ (tablas de movimientos)
  src/pages/Reportes/ (6 tabs con tablas)
  src/pages/Planilla/ (TabEmpleados, TabBoletas, TabAdelantos)
  src/pages/PagosMasivos/components/DocumentosPendientesTable.tsx

Esfuerzo: 1-2 sesiones. Cada tabla requiere crear el array columns[] y conectar.
Dependencias: ninguna — es refactoring puro.

### b) Cards — Integracion de DataCard

Que necesita cambiar: cada modulo tiene su propio card component (OrdenCompraCard,
TransferenciaCard, etc.) con HTML distinto. DataCard unifica la estructura.

Archivos a reemplazar:
  src/components/modules/ordenCompra/OrdenCompraCard.tsx
  src/pages/Envios/TransferenciaCard.tsx
  src/pages/Cotizaciones/CotizacionCard.tsx
  src/pages/Requerimientos/KanbanCard.tsx

Esfuerzo: 1 sesion por modulo (hay que mapear los campos de cada entidad a las props
de DataCard: title, subtitle, code, status, stats, meta).

Dependencias: ninguna — es refactoring paralelo.

### c) Toggle tabla/cards — ContentArea

Que necesita cambiar: el toggle tabla/cards esta implementado a mano en cada pagina
con useState('table' | 'card') y dos bloques JSX. ContentArea unifica esto.

Archivos que necesitan ContentArea:
  src/pages/OrdenesCompra/OrdenesCompra.tsx (ya tiene toggle manual)
  src/pages/Envios/Transferencias.tsx (ya tiene toggle manual)
  src/pages/Productos/Productos.tsx
  src/pages/Cotizaciones/Cotizaciones.tsx

Esfuerzo: 30 min por pagina una vez que DataTable y DataCard esten integrados.
Dependencias: REQUIERE que la pagina ya use DataTable y DataCard.

### d) Formularios — FormField + FormModal

Que necesita cambiar: los formularios usan labels sueltos, divs manuales, y errores
JSX propios. FormField unifica label + input + error + hint.

Archivos prioritarios:
  src/components/modules/ordenCompra/OrdenCompraForm.tsx
  src/pages/Gastos/GastoForm.tsx
  src/pages/Planilla/components/EmpleadoForm.tsx
  src/pages/Maestros/MaestrosModals.tsx

FormModal: reemplaza los modales con formulario que usan Modal + footer manual.
Esfuerzo: 2-3 horas por formulario complejo.
Dependencias: ninguna — es refactoring independiente.

### e) Modales de detalle

Que necesita cambiar: los modales de detalle (OrdenCompraDetailModal, etc.) son
componentes grandes (300-500 lineas) con layout propio y fondo de secciones
inconsistente.

Archivos afectados:
  src/components/modules/ordenCompra/OrdenCompraDetailModal.tsx (si existe)
  src/pages/Envios/TransferenciaDetailModal.tsx
  src/pages/Cotizaciones/CotizacionDetailModal.tsx
  src/pages/Requerimientos/RequerimientoDetailModal.tsx
  src/pages/Maestros/CanalesVentaAnalytics.tsx (detail views en Maestros)

Patron recomendado: Modal (existente, bien construido) + secciones con border-b
border-slate-100 + labels text.label + valores text.bodyStrong del design system.

Esfuerzo: 1-2 horas por modal de detalle.

### f) Dashboard — Secciones y gradientes

Archivos afectados:
  src/pages/Dashboard/sections/ExecutiveSummarySection.tsx
  src/pages/Dashboard/sections/CashLiquidezSection.tsx
  src/pages/Dashboard/sections/InsightsSection.tsx
  src/pages/Dashboard/sections/DeepAnalyticsSection.tsx

Que cambiar:
  - Eliminar cualquier bg-gradient-to-* → bg-teal-50 o bg-white
  - Asegurar que StatCard del design system se usa en todos los KPI slots
  - La cuadricula de secciones debe seguir el spacing del design system (space-y-6)

Esfuerzo: 1 sesion.

### g) Graficas — Alineacion de colores

Los graficos (Recharts) usan CHART_COLORS de src/components/common/Charts.tsx.
Esos colores pueden no estar alineados con la nueva paleta.

src/components/common/Charts.tsx exporta:
  CHART_COLORS: Record<string, string> — colores hex hardcodeados
  CHART_COLOR_PALETTE: string[] — array para graficos multi-series

Que cambiar: mapear los colores de charts a: teal (marca), emerald, amber, sky, red,
y variaciones de slate para datos neutros.

Archivos a revisar:
  src/components/common/Charts.tsx (actualizar CHART_COLORS y CHART_COLOR_PALETTE)
  src/pages/Reportes/ (graficos de barras y lineas)
  src/pages/CTRU/CTRUDashboard.tsx

Esfuerzo: 2 horas — solo cambiar los valores hex en CHART_COLORS.

### h) Estados Loading/Empty/Error — Unificacion

Situacion actual:
  Loading: mezcla de Skeleton (components/common/Skeleton.tsx), spinners inline,
  y ContentArea loading state.
  Empty: mezcla de EmptyState, EmptyStateAction, EmptyStateCompact, TableEmptyState,
  y EmptyStatePro, y texto inline "No hay datos".
  Error: no hay patron unificado. Algunos usan AlertCard, otros texto inline.

Que hacer:
  1. Inventario de todos los patrones de loading/empty/error por pagina.
  2. Decidir: ContentArea.loading o Skeleton components (no ambos).
  3. Crear ErrorState component en design system (similar a ContentArea empty).
  4. Reemplazar textos inline "No hay datos" por TableEmptyState o EmptyStateCompact.

Esfuerzo: 1 sesion de auditoria + 1-2 sesiones de migracion.

### i) Responsive / Mobile

Situacion actual: las paginas usan sm:, md:, lg: breakpoints de forma inconsistente.
PageShell y PageHeader ya tienen responsive correcto. Los interiores no.

Paginas con problemas conocidos de mobile:
  src/pages/OrdenesCompra/ — tabla muy ancha
  src/pages/Inventario/ — tabla densa
  src/pages/CTRU/ — layout de dos columnas se rompe
  Todos los modales de detalle — no estan optimizados para mobile

Esfuerzo: revision dedicada. Usar Chrome DevTools mobile emulator para auditar.

### j) Auth pages — Login/Register/PendingApproval

src/pages/Auth/Login.tsx
src/pages/Auth/Register.tsx
src/pages/Auth/PendingApproval.tsx
src/pages/Auth/AuthDecorations.tsx

Situacion: estas paginas fueron construidas antes del design system y usan estilos
propios. AuthDecorations.tsx tiene un componente de fondo decorativo que puede
incluir gradientes o colores custom.

Que cambiar: alinear con la paleta (slate, teal, white) y eliminar gradientes.
El Login debe sentirse premium pero sin exagerar. Inspiracion: Linear, Stripe login.

Esfuerzo: 1 sesion.

### k) Sidebar — Modernizacion

src/components/layout/Sidebar.tsx (o equivalente)

El sidebar es el componente mas visible de la app. Si sigue con tema oscuro
mientras el contenido es claro/flat, hay disonancia visual.

Pasos recomendados:
  1. Evaluar el archivo actual del sidebar (no leido en esta sesion).
  2. Decidir con el PO: oscuro vs. claro (ver Decision 3 en seccion 8).
  3. Si se cambia a claro: bg-white, border-r border-slate-200, hover bg-teal-50,
     item activo bg-teal-50 text-teal-700.

Esfuerzo: 1 sesion (es un archivo pero de alto impacto visual).
Dependencia: decision del PO primero.

---

## 10. ORDEN RECOMENDADO DE EJECUCION

Las siguientes sesiones estan ordenadas para maximizar impacto VISIBLE al PO
(feedback directo de S33: el PO quiere ver cambios, no solo plomeria).

### Sesion 34 — Quick wins visuales maximos (Dashboard + Sidebar)

Objetivo: que el PO entre y diga "esto si se ve diferente".

Paso 1: Auditar y actualizar src/pages/Dashboard/sections/ completo.
  - Eliminar todos los gradientes.
  - Asegurar StatCard del design system en todos los KPI slots.
  - Revisar colores de graficos (Charts.tsx CHART_COLORS).

Paso 2: Sidebar modernization.
  - Leer el archivo del sidebar actual.
  - Presentar opcion A/B/C al PO.
  - Implementar la decision.

Paso 3: Auth pages cleanup (30 min).

Commit + Deploy.

### Sesion 35 — OC y Envios: paginas core con redeseno completo

Objetivo: las 2 paginas mas usadas operativamente deben verse modernas.

Paso 1: OrdenesCompra.tsx — migrar a DataTable + DataCard + ContentArea.
  Incluir: limpiar OC items hardcodeados y TC duplicado (decision registrada).

Paso 2: Envios/Transferencias.tsx — migrar a DataTable + DataCard + ContentArea.

Commit + Deploy.

### Sesion 36 — Inventario + Red Logistica

Objetivo: mostrar el nuevo modelo de unidades/casillas con UI moderna.

Paso 1: Inventario.tsx — DataTable para unidades, StatCard para KPIs, FilterDrawer.
Paso 2: Crear pagina de Red Logistica (pendiente de reingenieria — solo existe el
  servicio redLogistica.service.ts pero no la pagina UI).

Commit + Deploy.

### Sesion 37 — Wizard OC con Sub-Ordenes

Objetivo: el PO identifico Sub-Ordenes como pendiente UI importante.
Este wizard debe usar el design system completo desde el inicio.

Usar: Stepper + FormModal + FormField + StatusBadge + DataCard.

Commit + Deploy.

### Sesion 38 — Formularios: FormField en los 5 formularios mas usados

Objetivo: inputs y labels consistentes en los formularios operativos.

Prioridad: GastoForm, OrdenCompraForm, EmpleadoForm, y los 2 modales de Maestros.

Commit + Deploy.

### Sesion 39 — LineaFilterInline rework

Objetivo: resolver la fila extra del filtro de linea con la decision del PO.

Paso 1: Presentar mockup de las 3 opciones (ver seccion 8, Decision 1).
Paso 2: Implementar la opcion elegida.
Paso 3: Eliminar el componente LineaFilterInline standalone de las 17 paginas.

Commit + Deploy.

### Sesion 40 — Reportes: TAREA-098 + DataTable en las 6 tabs

TAREA-098: agregar tabs CxC y CxP que aun faltan en Reportes.
Migracion de tablas de Reportes a DataTable.

Commit + Deploy.

### Sesion 41 — Deuda tecnica: KPICard, dead code, blue/green sobrevivientes

Paso 1: Extraer AlertCard + StatDistribution de KPICard.tsx a archivos propios.
Paso 2: Eliminar KPICard.tsx completo.
Paso 3: Buscar y eliminar colores blue-* y green-* legacy.
Paso 4: CuentaCajaForm.tsx deprecated — eliminar.

Commit + Deploy.

### Sesion 42 — Mobile/Responsive audit

Auditar las 10 paginas con mas uso en mobile.
Corregir breakpoints inconsistentes.

Commit + Deploy.

### Sesiones 43-44 — Detail modals y ContentArea en el resto de modulos

Migracion de modales de detalle al patron nuevo.
ContentArea en los modulos que aun no lo usan.

---

## 11. ARCHIVOS CLAVE PARA EL PROXIMO AGENTE

Leer en este orden para entender el sistema:

1. src/design-system/tokens.ts
   — Todos los tokens visuales. La ley del design system.

2. src/design-system/COLOR_GUIDE.md
   — Referencia rapida de colores. Que usar, que NO usar.

3. src/design-system/index.ts
   — Que componentes existen en el design system.

4. src/components/common/index.ts
   — Que componentes legacy siguen activos.

5. src/index.css
   — Variables CSS del tema. Para cambiar el color de marca.

6. tailwind.config.js
   — Solo brand + surface custom. Todo lo demas es Tailwind nativo.

7. src/pages/Dashboard/DashboardPage.tsx
   — Ejemplo de pagina completamente migrada al design system.
   — Patron a replicar: PageShell > PageHeader > [banners] > [LineaFilterInline] > secciones.

8. src/pages/Gastos/Gastos.tsx
   — Ejemplo de pagina con Toolbar + FilterDrawer integrados.
   — Patron: PageShell > PageHeader > Toolbar(search+filterToggle+actions) > FilterDrawer > lista.

9. src/pages/OrdenesCompra/OrdenesCompra.tsx
   — Pagina core con mayor complejidad. La proxima candidata a redeseno completo.

10. docs/ACUERDOS_REINGENIERIA_2026-04-10.md
    — Los 53 acuerdos cerrados con el PO. No re-deliberar ninguno.

11. .claude/projects/.../memory/feedback_ux_reingenieria.md
    — El feedback critico del PO. Releer antes de cada sesion.

---

## 12. REGLAS DEL PROYECTO

Las siguientes reglas son OBLIGATORIAS y no se negocian:

### Colores
- SIEMPRE usar teal para color de marca (botones, acentos, focus rings, headers de pagina)
- SIEMPRE usar slate para neutrales (texto, fondos, bordes)
- NUNCA escribir bg-gray-*, text-gray-*, border-gray-* → usar slate equivalente
- NUNCA escribir bg-primary-*, text-primary-* → ese sistema ya no existe
- NUNCA escribir indigo-* → no esta en la paleta activa
- NUNCA escribir bg-danger-*, text-danger-* → usar red-*
- NUNCA escribir bg-success-*, text-success-* → usar emerald-*
- NUNCA escribir bg-warning-*, text-warning-* → usar amber-*
- NUNCA escribir bg-gradient-to-* → diseño plano, sin gradientes

### Estructura de paginas
- SIEMPRE envolver paginas nuevas en PageShell (fondo slate-50, padding consistente)
- SIEMPRE usar PageHeader para el header de cada pagina (sin header custom)
- Patron minimo: <PageShell><PageHeader title="..." icon={Icon} /></PageShell>
- Patron completo: PageShell > PageHeader > Toolbar > [FilterDrawer] > ContentArea

### Importaciones del design system
- SIEMPRE importar desde '../../design-system' (barrel), nunca rutas internas
- Ejemplo correcto: import { PageShell, PageHeader, StatCard } from '../../design-system'
- Ejemplo incorrecto: import { PageShell } from '../../design-system/components/PageShell'

### Workflow de desarrollo
- SIEMPRE hacer commit y deploy despues de cada cambio funcional
- Commit message en ingles, imperativo
- deploy: firebase deploy (hosting + functions si hay cambios en functions/)
- Verificar en produccion antes de cerrar la sesion

### Experiencia de usuario
- El PO quiere cambios VISIBLES. Cada sesion debe tener al menos 1 cambio que el PO
  pueda ver y tocar en la app.
- Referencia visual: Linear.app, Vercel dashboard, Stripe dashboard
- No mas "solo plomeria" — siempre incluir la cara visible de cada feature

### Referencia de design system
- COLOR_GUIDE.md es la referencia maestra para colores
- tokens.ts es la fuente de verdad para valores de tokens
- Si un color no esta en tokens.ts → no deberia usarse

---

## APENDICE — Ubicaciones de archivos criticos

docs/ACUERDOS_REINGENIERIA_2026-04-10.md — 53 acuerdos S32 (NO re-deliberar)
docs/PLAN_REINGENIERIA_2026-04-10.md — Plan 7 fases (completado en S33)
docs/REGISTRO_IMPLEMENTACION.md — CAMBIO-001 al CAMBIO-311+ (historial completo)
docs/MAPA_CONTEXTO_2026-03-19.md — Analisis exhaustivo del sistema (S1)
.claude/projects/.../memory/MEMORY.md — Estado actualizado del proyecto
.claude/projects/.../memory/feedback_ux_reingenieria.md — Feedback PO critico
.claude/projects/.../memory/project_oc_pendientes.md — OC items hardcodeados
.claude/projects/.../memory/project_filtro_linea_rework.md — Linea filter 3 opciones
src/design-system/ — Todo el design system
src/services/ — 8 servicios nuevos de reingenieria (+ todos los legacy)
src/types/ — 7 tipos nuevos de reingenieria (+ todos los legacy)
functions/src/triggers/ — Cloud Functions triggers
