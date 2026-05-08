# PLAN DE IMPLEMENTACIÓN MÓDULO POR MÓDULO · S3.6 (v3 · auditoría 360 completa + 6 decisiones cerradas)

**Declarado:** 2026-05-07
**Owner:** Usuario · Decisiones cerradas firmadas
**Status:** Plan integral final · ejecución por módulo en sesiones dedicadas
**Versión:** 3 · corrige el v2 eliminando el tier de "consolidación dedicada" (era parche)

---

## Tabla de contenido

1. [Decisión foundacional · Productos es el canon](#decisión-foundacional)
2. [Las 8 dimensiones del canon Productos](#las-8-dimensiones-del-canon-productos)
3. [Auditoría 360 completa · 34 páginas categorizadas](#auditoría-360-completa)
4. [Las 6 decisiones cerradas](#las-6-decisiones-cerradas)
5. [Mapa de duplicaciones · checklist natural](#mapa-de-duplicaciones)
6. [Tier 0 · Limpieza estructural previa](#tier-0--limpieza)
7. [Tier 1 · Refactor canónico transaccional](#tier-1--refactor-canónico-transaccional)
8. [Tier 2 · Dashboards y BI · canon adaptado](#tier-2--dashboards-y-bi)
9. [Tier 3 · Operaciones específicas y administración](#tier-3--operaciones-y-admin)
10. [Tier 4 · Sistema · sin canon comercial](#tier-4--sistema)
11. [Receta de ejecución por módulo · 7 pasos canónicos](#receta-de-ejecución)
12. [Cronograma global y orden de ejecución](#cronograma-global)
13. [Tracking · estado vivo](#tracking)

---

## Decisión foundacional

> **"Productos es el canon visual y arquitectónico del ERP."**
> Cita literal del usuario · 2026-05-07
> *"para mi el estilo y diseño de Productos para mi es el que es la base de todo tiene lo que nosotros buscamos."*

### Qué significa esto operativamente

Productos no es solo "un módulo más" — es la **fuente de verdad** para:
- Estructura de carpetas por responsabilidad
- Patrón de componentes auto-contenidos
- UX de wizards / editores / detail modals
- Sistema de filtros componibles
- Maestros con creación inline
- Banner de borrador + ExitConfirm
- Diseño visual (cards apiladas, dropdowns portaleados, lucide-icons únicos)

### El canon es page-scoped, NO library-scoped

**Productos no depende prácticamente de `design-system/` ni de `components/common/`.** Solo importa 2 utilidades cross-cutting (`formatFechaRelativa` + `ConfirmarSalidaWizardModal`).

Esto resuelve la pregunta foundacional: cada módulo refactoreado tendrá su propia carpeta `src/pages/<Módulo>/components/` autónoma. `design-system/` y `components/common/` quedan reservados para utilidades genuinamente **cross-cutting**.

---

## Las 8 dimensiones del canon Productos

Cada módulo refactoreado debe alinear estas 8 dimensiones contra Productos:

- **D1** Estructura de carpetas (shell/cards/filters/detail/edit/wizards/maestros/sections/shared/modals/tools)
- **D2** Page shell V2 (HeaderV2 con regla F1.1 + KpiStripV2 con tabular-nums + EmptyStates independientes + LoadingState)
- **D3** Cards apiladas (F4 default v7.0 — sin tablas grid)
- **D4** FiltrosBar componible (FiltrosBar + ChipsActivos + PillsRapidos + Drawer mobile + Ordenamiento + Paginación + BulkActions)
- **D5** DetailModal con tabs sticky (TabResumen + N específicas)
- **D6** Wizards y Editores V2 (Selector + WizardV2 + EditModalV2 + BorradorBanner + ConfirmarSalidaWizardModal + useWizardAutosave)
- **D7** Maestros vinculados (MaestroSelect + MaestroChipsMulti + FloatingDropdown portaleado)
- **D8** Cleanup `@deprecated` específicos integrales (con triage de complejidad · ver Decisión 6)

---

## Auditoría 360 completa

### Las 34 páginas del sistema · medidas reales

| # | Página | tsx | ts | dirs | main.tsx | Tier asignado |
|---|--------|----:|---:|-----:|---------:|----|
| 1 | **Productos** | 62 | 16 | 15 | 16 (wrapper) | **0 · CANON** ✅ |
| 2 | Dashboard | 5 | 2 | 1 | 104 | 2 · Dashboard/BI |
| 3 | Auth | 4 | 0 | 0 | — | 4 · Sistema |
| 4 | Perfil | 1 | 0 | 0 | — | 4 · Sistema |
| 5 | Configuracion | 2 | 0 | 0 | 449 | 3 · Admin |
| 6 | Auditoria | 1 | 0 | 0 | 420 | 3 · Admin |
| 7 | LineaNegocio | 1 | 0 | 0 | 357 | 3 · Admin |
| 8 | Usuarios | 1 | 0 | 0 | 1223 | 3 · Admin (god-file 🔴) |
| 9 | TipoCambio | 1 | 0 | 0 | 211 | 3 · Admin |
| 10 | NotasIA | 1 | 0 | 0 | 810 | 3 · Admin (god-file 🔴) |
| 11 | MercadoLibre | 8 | 0 | 0 | 321 | 3 · Admin |
| 12 | Inventario | 2 | 0 | 0 | 1081 | 1 · Transaccional (god-file 🔴) |
| 13 | Unidades | 1 | 0 | 0 | 782 | 1 · ¿FUSIONAR con Inventario? · default sí |
| 14 | Ventas | 4 | 0 | 0 | 1390 | 1 · Transaccional (god-file 🔴) |
| 15 | Cotizaciones | 13 | 1 | 0 | 714 | 1 · Transaccional |
| 16 | Requerimientos | 11 | 1 | 0 | 858 | 1 · Transaccional |
| 17 | OrdenesCompra | 1 | 0 | 0 | 1300 | 1 · Transaccional (god-file 🔴) |
| 18 | Envios | 49 | 17 | 11 | 1211 | 1 · Cercano canon (god-file ⚠️) |
| 19 | Tesoreria | 46 | 14 | 9 | 1107 | 1 · Cercano canon (god-file ⚠️) |
| 20 | Gastos | 9 | 1 | 1 | **1685** | 1 · Transaccional (god-file 🔴 mayor) |
| 21 | Maestros | 4 | 0 | 0 | 812 | 1 · Transaccional (consolida fragmentación) |
| 22 | Finanzas | 24 | 2 | 3 | 271 | 2 · Dashboard/BI |
| 23 | Contabilidad | 1 | 0 | 0 | 978 | 2 · Dashboard/BI (god-file 🔴) |
| 24 | Reportes | 9 | 0 | 0 | 897 | 2 · Dashboard/BI (god-file 🔴) |
| 25 | ProductosIntel | 1 | 1 | 0 | 501 | 2 · Dashboard/BI · separado · deep linking |
| 26 | Proyeccion | 1 | 0 | 0 | 691 | 2 · Dashboard/BI (god-file 🔴) |
| 27 | MapaCalor | 5 | 0 | 0 | 180 | 2 · Dashboard/BI |
| 28 | RendimientoCambiario | 1 | 0 | 0 | **1625** | 2 · Dashboard/BI (god-file 🔴 segundo más grande) |
| 29 | RedLogistica | 7 | 0 | 2 | 1016 | 1 · Operaciones (god-file 🔴) |
| 30 | Planilla | 7 | 0 | 1 | 61 | 3 · Admin operativo |
| 31 | Escaner | 1 | 0 | 0 | 154 | 1 · Operaciones |
| 32 | CTRU | 1 | 0 | 0 | — | 2 · Dashboard/BI |
| 33 | **Expectativas** | 0 | 0 | 0 | — | **0 · CLEANUP · vacía** 🗑️ |
| 34 | **TestPDF** | 1 | 0 | 0 | 131 | **0 · CLEANUP · dev artifact** 🗑️ |
| 35 | **PagosMasivos** | 6 | 0 | 1 | 173 | **0 · CLEANUP · ruta redirige a Tesorería** 🗑️ |

### Inventory de `/components/modules/`

28 directorios. Cada uno migra a `/pages/<Módulo>/components/` cuando se refactoriza ese módulo (migración incremental, no en sesión dedicada). Hallazgos especiales:

- `casilla/` — directorio **VACÍO** · cleanup en Tier 0
- `reporte/` (6 archivos) vs `reportes/` (3 archivos) — **duplicación de naming** · consolidar en Tier 0

---

## Las 6 decisiones cerradas

Decisiones tomadas el 2026-05-07 que orientan toda la ejecución:

### Decisión 1 · Hogar de los componentes canónicos cross-cutting

**Destino: `src/design-system/`** (ya existe y aloja cross-cutting probado).

**Criterio: decisión por componente · no bulk-migrate.**

Cuando llegue M1 Inventario y necesite componentes que Productos también tiene:

| Componente | Veredicto | Por qué |
|------------|-----------|---------|
| `BorradorBanner` (genérico con props `tipo` + `totalPasos`) | ✅ Promover a `design-system/` | 3 implementaciones idénticas demuestran cross-cutting |
| `MaestroSelect` / `MaestroChipsMulti` / `FloatingDropdown` | ✅ Promover a `design-system/` | UI universal de "vincular entidad a maestro" |
| `SeccionColapsable` (parametrizable por tema/color) | ✅ Promover a `design-system/` | 3 duplicados confirman cross-cutting |
| `EmptyStateBd` / `EmptyStateBusqueda` | 🟡 Auditar en M1 | Pueden absorber `EmptyStatePro` del common |
| `FiltrosBar` componible (sub-componentes) | ✅ Promover a `design-system/components/filters/` | Canon F3 ya lo declaró compositional · 7 implementaciones paralelas |
| `ProductoSearch` con `contexto` prop | ✅ Consolidar en `design-system/` o `pages/Maestros/` | 3 duplicados (Cotizaciones · Requerimientos · Ventas) |
| `ProductoCard` / `KpiStripV2` / `HeaderV2` específicos | ❌ Quedan page-scoped | Específicos del dominio del módulo |

**Deuda derivada:** después de N módulos refactoreados, los componentes existentes en `design-system/` que NADIE usa (porque Productos no los usó) se evalúan para borrado en cleanup separado. No es trabajo del refactor.

### Decisión 2 · ProductosIntel separado con deep linking

ProductosIntel se mantiene como **página separada** (`/productos-intel`).

Razones:
- Tiene complejidad BI legítima (FlujoCajaCard, LeadTimeCard, SugerenciasReposicionCard)
- Modelo mental claro: catálogo CRUD vs analytics
- Mejora optimización independiente

**Acción:** TabResumen del Detail Modal de Productos agregará link "Ver más en Inteligencia →" filtrado por ese producto. ProductosIntel también linkea de vuelta.

### Decisión 3 · Auditar BI overlap en sesión M1.bis ProductosIntel

Cuando se ataque ProductosIntel (paroado con Productos cierre · M1.bis), se hace una **sub-auditoría** de qué KPIs aparecen en cuántos lugares (Dashboard, ProductosIntel, Reportes, MapaCalor).

Lo que se decida ahí define el **canon BI** del sistema. Reportes/Dashboard se alinean a ese canon en sus turnos.

NO auditar antes — sería trabajo sin contexto.

### Decisión 4 · Sub-decisiones por módulo · defaults declarados

| Sesión | Sub-decisión | Default |
|--------|-------------|---------|
| M1 Inventario | Fusión con Unidades como tabs internos | ✅ Sí |
| M1.bis ProductosIntel | Separado de Productos | ✅ Sí |
| M2 Ventas | Devoluciones como tab | ✅ Sí |
| M9 Compras | Migrar `/components/modules/ordenCompra/` (30 archivos) | ✅ Sí |
| M11 Envíos | Reclamos como tab | ✅ Sí |
| M14 Maestros | Una página con tabs por entidad | ✅ Sí |

Defaults se confirman al arrancar cada sesión · usuario puede revertir cualquiera.

### Decisión 5 · Orden de ejecución conservador

Inventario → ProductosIntel → Ventas → MapaCalor → Gastos → Tesorería+Finanzas/Proyeccion/RendimientoCambiario → Contabilidad → Compras → Envíos → Cotizaciones → Requerimientos → Maestros → Reportes → RedLogistica+Escaner → Admin → Dashboard final.

Razón: Inventario+Ventas validan el proceso en módulos críticos antes de atacar el más grande (Gastos 1685 ln). Wins acumulados antes del riesgo mayor.

### Decisión 6 · Triage de `@deprecated` por complejidad

| Tipo | Acción |
|------|--------|
| Simples (1-3 consumidores · sin BD migration) | Cleanup en la misma sesión del módulo |
| Complejos (5+ consumidores · requiere script BD migration) | Defer a sesión dedicada post-módulo · trackeado como "deuda del módulo" |

Razón: forzar BD migrations dentro de la sesión de refactor visual mezcla scope (UI + datos) y aumenta riesgo. Mantenerlas separadas hace cada commit más auditable.

---

## Mapa de duplicaciones

**No requieren tier dedicado** — mueren naturalmente cuando cada módulo se refactoriza al canon. Esta tabla es un checklist que se va cerrando solo:

| Duplicado | Estado actual | Muere en sesión... |
|-----------|---------------|---------------------|
| `BorradorOCBanner` / `BorradorEnvioBanner` / `BorradorProductoBanner` | 3 archivos casi idénticos | M1 Inventario promueve a `design-system/` · M9 Compras y M11 Envíos eliminan los suyos al refactorizar |
| `SeccionColapsable` (Cotizaciones · Envíos · Productos) | 3 archivos | M1 Inventario promueve · M11 Envíos y M14 Cotizaciones eliminan |
| `ProductoSearchCotizaciones/Requerimientos/Ventas` | 3 archivos paralelos | M2 Ventas absorbe el primero · M14 Cotizaciones y M15 Requerimientos siguen |
| `FiltrosBar` (7 implementaciones) | Productos · Finanzas · Gastos · Tesorería · Cotizaciones · Envíos · MapaCalor | Cada módulo (M1-M16) elimina el propio al refactorizar |
| `EmptyStateAction` / `EmptyStatePro` / `EmptyStateBd` / `EmptyStateBusqueda` | 4 archivos | Auditoría en M1 decide canon · módulos absorben |
| Maestros fragmentados (`/Maestros/`, `/components/Maestros/`, `/components/modules/entidades/`) | 3 ubicaciones | M14 Maestros consolida todo |
| `ProductosIntel` vs `Productos/TabResumen` (KPIs) | Posible solapamiento | Decisión en M1.bis ProductosIntel |
| `Reportes` vs `Dashboard` vs `ProductosIntel` (KPIs duplicados) | Auditoría dedicada en sesión Reportes (M16) | Después de tener todos los datos refactoreados |
| `reporte/` vs `reportes/` (modules) | Duplicación de naming | Tier 0 cleanup |
| `casilla/` (modules) | Directorio vacío | Tier 0 cleanup |

---

## Tier 0 · Limpieza

**Objetivo:** dejar la estructura limpia ANTES de empezar el refactor canónico.

### Sesión Cleanup-A (1 sesión · ~1h)

**T0.1 · Eliminar páginas muertas/dev**
- `src/pages/Expectativas/` — directorio vacío (0 archivos), no tiene routing
- `src/pages/TestPDF/` — artefacto de desarrollo · borrar archivo + ruta + import en `App.tsx`
- `src/pages/PagosMasivos/` — 6 archivos pero ruta redirige a `/tesoreria` desde el principio · deprecada · borrar archivos + verificar redirect

**T0.2 · Eliminar componentes muertos**
- `src/components/modules/casilla/` — directorio vacío

**T0.3 · Consolidar duplicación reporte/reportes**
- Auditar usos de `reporte/*` (6 archivos) vs `reportes/*` (3 archivos)
- Consolidar todo bajo un solo nombre (probablemente `reporte/` singular)
- Actualizar imports en `Reportes.tsx`

**Verificación:** `tsc -b` + `vite build` verdes · commit consolidado.

---

## Tier 1 · Refactor canónico transaccional

Módulos con **operaciones transaccionales** (CRUD de entidades de negocio). Aplican las 8 dimensiones D1-D8 al estilo Productos.

### M1 · Inventario / Stock (PRIMER refactor)

**Especial:** esta sesión TAMBIÉN toma la **Decisión foundacional cross-cutting** (Decisión 1) — qué componentes de Productos se promueven a `design-system/` para ser reutilizados por Inventario y los siguientes módulos.

**Estado:**
- 1 god-file: `Inventario.tsx` (1081 líneas) + `GestionVencidasModal.tsx`
- + 14 archivos en `/components/modules/inventario/`

**Tareas:**
1. Diagnóstico 360 de Inventario.tsx + dependencias
2. Validación visual contra mockups vigentes (`stock-rediseno-s58f.html`, `mapa-calor-inventario-s58f.html`)
3. **Decisión cross-cutting:** promover a `design-system/` los componentes que Productos validó (BorradorBanner genérico, SeccionColapsable, MaestroSelect/ChipsMulti/FloatingDropdown, FiltrosBar componible)
4. Crear estructura `src/pages/Inventario/components/` con 8 subcarpetas canónicas
5. Refactor shell · `HeaderV2`, `KpiStripV2`, EmptyStates, `InventarioPageV2`
6. Refactor listado · `UnidadRowCard` + filtros + bulk actions
7. Refactor detail · `UnidadDetailModal` con tabs (Resumen, Movimientos, Histórico, Vencidas)
8. Modales acción (`AjustarStockModal`, `TransferirModal`)
9. **Fusión con Unidades** como tabs internos (default Decisión 4)
10. Cleanup `@deprecated` simples · verificar build · UAT visual

**Estimación:** 3-4 sesiones (~10-12h trabajo neto + UAT del usuario).

### M2 · Ventas (god-file 1390 ln)

**Estado:**
- `Ventas.tsx` 1390 ln + DevolucionDetailModal/FormModal/Tab + `/components/modules/venta/`

**Específico:**
- VentaForm/Wizard de nueva venta debe tener borrador (`tipo: 'venta'`)
- DevolucionFormModal también necesita borrador (`tipo: 'devolucion'`)
- DEUDA-PACK-VENTAS-01 declarada en S3.1: `ProductoSearchVentas` debe mostrar badge "Pack" + tooltip de componentes
- Devoluciones queda como tab (default Decisión 4)

**Estimación:** 4-5 sesiones (módulo más grande).

### M3 · Gastos (god-file 1685 ln · el mayor del sistema)

**Específico:**
- Form compuesto largo · borrador gasto crítico
- Pareo con Tesorería y Contabilidad por datos compartidos

**Estimación:** 3-4 sesiones.

### M4 · Tesorería (46 tsx + 9 dirs · god-file 1107 ln)

**Estado:** componentes ya extraídos en subdirs · refinamiento estructural del orquestador.

**Estimación:** 2 sesiones.

### M5 · Compras / OrdenesCompra (god-file 1300 ln)

**Específico:**
- 30 archivos en `/components/modules/ordenCompra/` migran a `/pages/OrdenesCompra/components/` (default Decisión 4)
- Borrador OC ya implementado (S53.20-21)

**Estimación:** 2-3 sesiones.

### M6 · Envíos (49 tsx + 11 dirs · god-file 1211 ln)

**Específico:**
- Componentes ya extraídos · refinamiento + decisión Reclamos como tab (default Decisión 4)

**Estimación:** 2 sesiones.

### M7 · Cotizaciones (form 1288 ln)

**Específico:**
- CotizacionForm es el form más largo del sistema · borrador cotización crítico

**Estimación:** 3 sesiones.

### M8 · Requerimientos (form 529 ln)

**Específico:**
- Multi-paso · borrador requerimiento

**Estimación:** 2-3 sesiones.

### M9 · Maestros (god-file 812 ln + fragmentación)

**Específico:**
- Consolida fragmentación: `/pages/Maestros/` + `/components/Maestros/` + `/components/modules/entidades/`
- Una página con tabs por entidad (Cliente · Proveedor · Marca · Categoría · Etiqueta · TipoProducto)

**Estimación:** 3 sesiones.

### M10 · RedLogistica (god-file 1016 ln)

**Específico:**
- 7 archivos + 2 subdirs existentes · extraer + alinear

**Estimación:** 2 sesiones.

### M11 · Escaner (154 ln + 12 archivos en modules)

**Estimación:** 1 sesión.

---

## Tier 2 · Dashboards y BI

Páginas read-mostly con widgets, charts, KPIs. Canon **adaptado** — D1 (estructura) y D2 (shell) sí · D5/D6 (forms) no aplican.

**Estrategia:** atacar **emparejado con su área de negocio transaccional**.

### M1.bis · ProductosIntel + CTRU (después de M1 Inventario)

**Especial:** primer módulo BI · define el **canon BI adaptado** del sistema.
**Sub-auditoría:** mapear KPIs duplicados entre ProductosIntel · Reportes · Dashboard (Decisión 3).

**Estimación:** 2 sesiones.

### M2.bis · MapaCalor (después de M2 Ventas)

**Estimación:** 1 sesión.

### M4.bis · Finanzas + Proyeccion + RendimientoCambiario (junto con M4 Tesorería)

**Específico:**
- RendimientoCambiario es el segundo god-file más grande (1625 ln)

**Estimación:** 4-6 sesiones.

### M5.bis · Contabilidad (después de M3 Gastos + M4 Tesorería)

**Estimación:** 2 sesiones.

### M14 · Reportes (consolidación final BI)

**Específico:**
- Después de tener todos los datos refactoreados
- Consolida `reporte/`+`reportes/` (Tier 0 ya hecho)

**Estimación:** 2 sesiones.

### M15 · Dashboard (refinamiento final)

**Específico:**
- Ya está parcialmente estructurado (104 ln main + sections + hook)
- Agregar widgets de los módulos refactoreados

**Estimación:** 1 sesión.

---

## Tier 3 · Operaciones y Admin

| Orden | Módulo | tamaño | Sesiones |
|-------|--------|--------|---------:|
| Tier 3.A · Críticos |
| 1 | Usuarios | 1223 ln 🔴 | 2-3 |
| 2 | NotasIA | 810 ln 🔴 | 2 |
| 3 | MercadoLibre | 321 ln + 8 archivos | 2 |
| Tier 3.B · Medianos |
| 4 | Auditoria | 420 ln | 1 |
| 5 | Configuracion | 449 ln | 1-2 |
| 6 | LineaNegocio | 357 ln | 1 |
| 7 | TipoCambio | 211 ln | 0.5 |
| Tier 3.C · Operativo |
| 8 | Planilla | 7 archivos · 1 dir | 1-2 |

**Subtotal Tier 3:** ~10-12 sesiones.

---

## Tier 4 · Sistema

| Módulo | Acción |
|--------|--------|
| Auth (4 archivos · Login/Register/PendingApproval) | Mantener · refinamiento solo si surge gap |
| Perfil (1 archivo · MiPerfil) | Mantener |

**Subtotal Tier 4:** 0 sesiones programadas.

---

## Receta de ejecución

Cada sesión que aborda un módulo sigue este checklist:

### Paso 1 · Diagnóstico 360 inicial (~30 min)
- Mapear archivos del módulo + sus consumidores
- Listar componentes externos que importa
- Identificar campos `@deprecated` (triage por complejidad · Decisión 6)
- Listar wizards/forms que necesitan borrador
- Identificar god-components a fragmentar

### Paso 2 · Validación visual contra canon (~30 min · si aplica)
- Revisar mockups vigentes en `docs/mockups/`
- Comparar contra patrón Productos
- Mockups actualizados + validación del usuario si hay disonancia

### Paso 3 · Estructura de carpetas (~15 min)
- Crear `src/pages/<Módulo>/components/` con subcarpetas canónicas
- Mover archivos existentes según responsabilidad
- Migrar componentes desde `/components/modules/<Módulo>/`

### Paso 4 · Refactor del shell (~1 sesión)
- Extraer `HeaderV2`, `KpiStripV2`, `EmptyStates`, `LoadingState`
- Crear `<Módulo>PageV2.tsx` orquestador
- Wrapper `<Módulo>.tsx` con 1 línea

### Paso 5 · Listado · cards + filtros (~1 sesión)
- `<Módulo>RowCard` apilado
- `<FiltrosBar>` componible (importado del canónico)
- `BulkActionsToolbar` si aplica
- Pagination + ordering

### Paso 6 · Detail + Edit + Wizard V2 (~1-2 sesiones)
- `<Módulo>DetailModal` con tabs
- `<Módulo>EditModalV2` espejando wizard
- `Wizard<Módulo>V2` con secciones acordeón
- `BorradorBanner` genérico (importado del canónico) + `ConfirmarSalidaWizardModal`
- `useWizardAutosave` con `tipo: '<modulo>'` (extender `TipoBorradorWizard`)

### Paso 7 · Cleanup integral (~30 min)
- Eliminar `@deprecated` simples del módulo
- Trackear `@deprecated` complejos como deuda separada (Decisión 6)
- Borrar god-file viejo
- Migrar restantes desde `/components/modules/<Módulo>/`
- Verificar tsc + vite build verdes
- UAT visual del usuario contra preview live
- Commit consolidado

---

## Cronograma global

### Orden completo de ejecución (Decisión 5)

| Fase | Módulos | Sesiones | Acumulado |
|------|---------|---------:|----------:|
| **0 · Limpieza** | Cleanup-A (Expectativas + TestPDF + PagosMasivos + casilla + reporte/reportes) | 1 | 1 |
| **1 · Inventario** | Inventario + Unidades + decisión cross-cutting M1 | 3-4 | 4-5 |
| **1.bis · ProductosIntel + CTRU** | Pareo BI · auditoría KPIs duplicados | 2 | 6-7 |
| **2 · Ventas + Devoluciones** | Ventas + DevolucionesTab · DEUDA-PACK-VENTAS-01 | 4-5 | 10-12 |
| **2.bis · MapaCalor** | Pareo geográfico de Ventas | 1 | 11-13 |
| **3 · Gastos** | God-file mayor 1685 ln | 3-4 | 14-17 |
| **4 · Tesorería + Finanzas/Proyeccion/RendimientoCambiario** | Pareo financiero | 6-8 | 20-25 |
| **5 · Contabilidad** | Después de Gastos + Tesorería | 2 | 22-27 |
| **6 · Compras / OC** | Migrar `/components/modules/ordenCompra/` | 2-3 | 24-30 |
| **7 · Envíos + Reclamos** | Refinamiento + Reclamos como tab | 2 | 26-32 |
| **8 · Cotizaciones** | Form más largo del sistema | 3 | 29-35 |
| **9 · Requerimientos** | Multi-paso | 2-3 | 31-38 |
| **10 · Maestros** | Consolida fragmentación | 3 | 34-41 |
| **11 · Reportes** | Auditoría BI overlap final | 2 | 36-43 |
| **12 · RedLogística + Escaner** | Operaciones | 3 | 39-46 |
| **13 · Admin (8 módulos)** | Usuarios · NotasIA · MercadoLibre · Auditoria · Configuracion · LineaNegocio · TipoCambio · Planilla | 10-12 | 49-58 |
| **14 · Dashboard final** | Refinamiento + widgets consolidados | 1 | 50-59 |

**Total estimado:** ~50-60 sesiones · ~150-180h de trabajo neto + UAT iterativo del usuario.

### Hitos sugeridos

- **Hito M1 · Limpieza + Inventario cerrado** (5 sesiones) → primera validación del proceso completo
- **Hito M2 · Top 5 transaccionales cerrados** (Inventario + Ventas + Gastos + Tesorería + Compras) (~16-22 sesiones) → corazón comercial del ERP refactoreado
- **Hito M3 · Tier 1 + Tier 2 completos** (~36-43 sesiones) → operación + BI 100% canónica
- **Hito M4 · Sistema completo** (~50-60 sesiones) → todo el ERP alineado

---

## Tracking

### Estado vivo

| # | Tier | Módulo | Estado | Sesión | Commits |
|---|------|--------|--------|--------|---------|
| 1 | 0 | Productos | ✅ CANON CERRADO | S3.5 | 835a4eb · e2562bb · 7ebdaa6 |
| 2 | 0 | Cleanup-A (vacíos + dev + dup) | ⏳ Próximo | — | — |
| 3 | 1 | Inventario + Unidades | ⏳ Cola · M1 | — | — |
| 4 | 2 | ProductosIntel + CTRU | ⏳ Cola · M1.bis | — | — |
| ... | ... | ... | ... | ... | ... |

### Reglas operativas durante la ejecución

1. **Una sesión = un slice de un módulo** · no abrir trabajo en módulos diferentes simultáneamente.
2. **Antes de tocar código del módulo:** diagnóstico 360 + validación de mockups + plan integral aprobado por el usuario (principio rector 2026-05-07).
3. **Borrador canónico obligatorio** en cualquier wizard/form de creación nuevo o refactoreado (canon 2026-05-07).
4. **Pixel-perfect contra Productos** · si hay duda visual, abrir el componente equivalente de Productos y replicar.
5. **`@deprecated` triage** · simples en sesión · complejos defer (Decisión 6).
6. **Verificación obligatoria pre-commit:** `tsc -b` + `vite build` + UAT visual en preview live.
7. **Migración estructural incremental:** cuando se ataca un módulo, sus componentes en `/components/modules/<Módulo>/` migran a `/pages/<Módulo>/components/` en la misma sesión.
8. **Componentes cross-cutting promovidos a `design-system/`** se actualizan en este documento (sección Decisión 1).

---

## Apéndice · Componentes canónicos disponibles HOY

### En `/pages/Productos/components/` (base actual · candidatos a promoción)
- `maestros/MaestroSelect.tsx` · `MaestroChipsMulti.tsx` · `FloatingDropdown.tsx` (✅ promover en M1)
- `wizards/SeccionColapsable.tsx` · `BorradorProductoBanner.tsx` (✅ promover genérico en M1)
- `filters/FiltrosBar.tsx` (✅ promover componible en M1)
- `shell/HeaderV2.tsx` · `KpiStripV2.tsx` · `EmptyStateBd.tsx` · `EmptyStateBusqueda.tsx` (decidir en M1)

### En `/design-system/` (cross-cutting ya disponible)
- `formatFechaRelativa` (en `DraftBanner.tsx`)
- `ConfirmarSalidaWizardModal`
- `WizardShell`

### En `/hooks/`
- `useWizardAutosave`

### En `/services/`
- `borradorWizardService`

### En `/types/`
- `BorradorWizard` + `TipoBorradorWizard` (extender union al sumar módulos)

---

**Fin del plan v3.** Este documento se actualiza por sesión: estado vivo + decisiones tomadas + commits ejecutados.
