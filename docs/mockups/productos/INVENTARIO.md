# INVENTARIO MÓDULO PRODUCTOS · Sub-fase B · Pixel-perfect milimétrico

> **Fecha:** 2026-05-02 (act. 2026-05-01 cierre Sesión 3)
> **Módulo:** Productos (catálogo maestro)
> **Estado:** ✅ **40/40 mockups producidos** · ⏳ Sub-fase C validación holística pendiente del usuario
> **Documentos referencia:** `docs/DESIGN_CANONICO_FINAL.md` + `docs/mockups/CANONICO_MASTER.html`

---

## ✅ COMPLETADO · Sub-fase B (3 sesiones)

| Sesión | Grupos | Mockups producidos |
|--------|--------|---------------------|
| **Sesión 1** | A · B · I | 12 mockups (01-09 + 33-35) |
| **Sesión 2** | C · D | 11 mockups (10-15 + 15b · post-gaps aplicados) |
| **Sesión 3** | E · F · G · H | 17 mockups (16-32) |
| **TOTAL** | 9 grupos | **40 mockups pixel-perfect** ✅ |

**Documentos auxiliares producidos:**
- `FLUJO_NAVEGACION.html` — grafo visual con los 40 nodos clickables
- `COMPARATIVA_GAPS.html` — decision board de 7 gaps detectados (todos resueltos)
- `GAPS_DETECTADOS.md` — auditoría honesta vs mockups históricos

**Próxima fase:** Sub-fase C · Revisión holística por el usuario antes de Etapa 4 (implementación pixel-perfect en código).

---

## 0. Inspección del código vivo · resumen

**Página principal:** `src/pages/Productos/Productos.tsx` (1,438 líneas)

**Componentes embebidos** (`src/components/modules/productos/` · 20 archivos · 11,062 líneas):

| Componente | Líneas | Tipo |
|------------|--------|------|
| `Productos.tsx` (page) | 1,438 | Pantalla principal |
| `ProductoForm.tsx` | 1,723 | Form gigante con 6 tabs (Origen/Básico/Clasificación/Inventario/Variantes/Componentes) |
| `ProductoCard.tsx` | 1,217 | Card mobile listado |
| `ProductoTable.tsx` | 1,009 | Tabla desktop listado |
| `ComponentesPackSection.tsx` | 882 | Sección packs (dentro ProductoForm) |
| `InvestigacionModal.tsx` | 836 | Modal grande inteligencia (3 tabs: Proveedores/Competencia/Decisión) |
| `ProveedorOrigenList.tsx` | 647 | Lista proveedores en Investigación |
| `CompetidorPeruList.tsx` | 590 | Lista competidores Perú en Investigación |
| `PuntoEquilibrioCard.tsx` | 497 | Calculadora financiera embebida |
| `FiltrosDrawerMobile.tsx` | 289 | Drawer móvil de filtros |
| `FormVarianteReducida.tsx` | 275 | Modal form variante reducida |
| `DashboardCatalogo.tsx` | 255 | Modal/Vista intel/dashboard catálogo |
| `VariantesTable.tsx` | 254 | Tabla variantes (en ProductoForm) |
| `AlertasInvestigacion.tsx` | 233 | Banner alertas dentro de InvestigacionModal |
| `HistorialPreciosChart.tsx` | 209 | Gráfico precios histórico |
| `PapeleraModal.tsx` | 163 | Modal archivo/papelera |
| `ProductoCreacionWizard.tsx` | 151 | Selector inicial tipo creación (4 opciones) |
| `SugerenciaVarianteBanner.tsx` | 135 | Banner sugerencia variantes |
| `BuscadorGrupoProducto.tsx` | 127 | Modal buscador para crear variante de existente |
| `FiltrosRapidos.tsx` | 109 | Pills rápidos de filtro |
| `FilterChip.tsx` | 23 | Átomo chip de filtro activo |

---

## 1. Inventario exhaustivo de mockups requeridos

### 🟦 GRUPO A · Página principal y estados (5 mockups)

| # | Archivo | Trigger | Familia | Estados/Notas |
|---|---------|---------|---------|---------------|
| **A01** | `01-page-listado.html` | Default `/productos` | F1+F2+F3+F4(C) | Vista normal con productos · header banking-grade + KPI strip + FiltrosBar + tabla robust grid |
| **A02** | `02-page-listado-vacio-bd.html` | Cero productos en BD | Empty state | Mensaje onboarding + CTA "Crear primer producto" |
| **A03** | `03-page-listado-vacio-busqueda.html` | Búsqueda sin resultados | Empty state | "No encontramos productos con esos filtros" + sugerencia limpiar |
| **A04** | `04-page-listado-loading.html` | Loading inicial | Skeleton state | Skeleton de header + KPIs + 5 filas de tabla skeleton |
| **A05** | `05-page-listado-mobile.html` | Vista mobile (responsive) | F4(B) cards | Cards apiladas en lugar de tabla · header colapsado |

---

### 🟧 GRUPO B · Filtros y bulk actions (4 mockups)

| # | Archivo | Trigger | Familia | Notas |
|---|---------|---------|---------|-------|
| **B01** | `06-filtros-bar-default.html` | Default | F3 | FiltrosBar con chips por línea/tipo/estado · sin filtros activos |
| **B02** | `07-filtros-bar-activos.html` | Con filtros activos | F3 | Chips activos + count "23 de 142" + botón "limpiar" visible |
| **B03** | `08-filtros-drawer-mobile.html` | Click filtros en mobile | F3 mobile | Drawer lateral con todos los filtros expandidos |
| **B04** | `09-bulk-actions-toolbar.html` | Selección múltiple ≥1 producto | Toolbar sticky | "5 seleccionados" + Acciones masivas (Cambiar estado / Etiquetar / Archivar / Exportar / Limpiar) |

---

### 🟨 GRUPO C · Card de producto (estados granulares · 6 mockups)

| # | Archivo | Trigger | Familia | Estados |
|---|---------|---------|---------|---------|
| **C01** | `10-card-row-normal.html` | Default | F4(C) | Avatares apilados SKU + sparkline margen + acciones inline |
| **C02** | `10b-card-row-hover.html` | Mouse hover | F4(C) | Acciones se hacen visibles · row highlight |
| **C03** | `10c-card-row-stock-critico.html` | Stock < mínimo | F4(C) + alerta | Badge rojo "Stock crítico" + sparkline rojo |
| **C04** | `10d-card-row-investigacion-vencida.html` | Investigación expira | F4(C) + alerta | Badge ámbar "Re-investigar" |
| **C05** | `10e-card-row-pack.html` | Tipo pack | F4(C) | Badge violeta "Pack/Kit" + breakdown componentes |
| **C06** | `10f-card-row-archivado.html` | Estado archivado | F4(C) | Opacity reducida + badge slate "Archivado" + acción "Restaurar" |

---

### 🟩 GRUPO D · Modal detalle producto (vista expandida · 6 mockups · v2 con gaps aplicados)

> **Patrón:** F6 variante A · header gradient SUTIL canónico (F6.1) · layout 3 columnas en tab Resumen (F6.2)

| # | Archivo | Trigger | Familia | Notas |
|---|---------|---------|---------|-------|
| **D01** | `11-modal-detalle-info.html` | Click "Ver detalle" en card · ojo | F6(A) | Tab RESUMEN (renombrado de Info) · layout 3 col con sidebar derecho · 3 cards insights (Precio sugerido · Punto equilibrio · Competencia) · Sección "Proveedores recomendados" |
| **D02** | `12-modal-detalle-variantes.html` | Tab "Variantes" | F6(A) | Tabla VariantesTable + sugerencias |
| **D03** | `13-modal-detalle-investigacion.html` | Tab "Investigación" | F6(A) | Badge "X nuevos" en tab + resumen + chart + decisión |
| **D04** | `14-modal-detalle-componentes-pack.html` | Tab "Componentes" (solo packs · D-PROD-2 condicional) | F6(A) | Header SUTIL · avatar purple semántico · tabla line-items + valorización |
| **D05** | `15-modal-detalle-stock.html` | Tab "Stock" (separado de Histórico · Gap #6) | F6(A) | Solo distribución por almacén + por variante + banner reorden |
| **D06** | `15b-modal-detalle-historico.html` | Tab "Histórico" (separado · Gap #6) | F6(A) | Chart 6 meses ventas+stock + lista movimientos + KPIs ejecutivos 12m |

**Header canónico aplicado a TODOS:** `from-slate-50 to-white` border sutil · color semántico vive en avatar (amber=skincare, indigo=suplemento, purple=pack) · acciones `[Editar] [...] [X]`

---

### 🟪 GRUPO E · Wizards de creación (5 mockups)

> **Patrón:** F5 según pasos

| # | Archivo | Trigger | Familia | Pasos |
|---|---------|---------|---------|-------|
| **E01** | `16-wizard-creacion-selector.html` | Click "Nuevo producto" | Selector pre-wizard | 4 opciones: Producto único · Con variantes · Variante existente · Pack/Kit |
| **E02** | `17-wizard-crear-simple.html` | Selección "Producto único" | F5(D) Modal 1 paso | Modal con 4 tabs colapsables (Origen/Básico/Clasificación/Inventario) |
| **E03** | `18-wizard-crear-con-variantes.html` | Selección "Con variantes" | F5(A) Sidebar 4+ pasos | Datos comunes → Configurar variantes → Tabla variantes → Confirmar batch |
| **E04** | `19-wizard-crear-variante-existente.html` | Selección "Variante existente" | F5(D) Modal con buscador | BuscadorGrupoProducto + FormVarianteReducida embebido |
| **E05** | `20-wizard-crear-pack.html` | Selección "Pack/Kit" | F5(D) Modal con sección packs | Datos comunes + ComponentesPackSection (vinculado/exclusivo) |

---

### 🟦 GRUPO F · Modales secundarios (4 mockups)

| # | Archivo | Trigger | Familia | Notas |
|---|---------|---------|---------|-------|
| **F01** | `21-modal-buscador-grupo.html` | Crear variante de existente | F5(D) Modal | Buscador autocomplete + lista resultados con avatares · selección |
| **F02** | `22-modal-form-variante-reducida.html` | Tras seleccionar grupo | F5(D) Modal | Form solo de campos variantes (contenido/sabor/dosaje/volumen) |
| **F03** | `23-modal-archivo-papelera.html` | Click "Archivo" en header | F6(A) Modal | Lista de productos archivados + acción "Restaurar" + búsqueda |
| **F04** | `24-modal-investigacion-completo.html` | Click "Investigar" en card | F6(A) Modal grande | 3 tabs (Proveedores/Competencia/Decisión) + sub-componentes |

---

### 🟫 GRUPO G · Sub-componentes de Investigación (5 mockups)

> **Triggers internos del modal Investigación**

| # | Archivo | Trigger | Familia | Notas |
|---|---------|---------|---------|-------|
| **G01** | `25-investigacion-tab-proveedores.html` | Tab "Proveedores" | Sub-vista | Lista proveedores USA con expandibles · costos + CTRU estimado |
| **G02** | `26-investigacion-tab-competencia.html` | Tab "Competencia" | Sub-vista | Lista competidores Perú con autocomplete + precios + market share |
| **G03** | `27-investigacion-tab-decision.html` | Tab "Decisión" | Sub-vista | Recomendación inteligente + AlertasInvestigacion + acciones (Importar/Descartar) |
| **G04** | `28-investigacion-historial-precios.html` | Sección histórico | F2(D) chart card | HistorialPreciosChart con líneas mi-precio vs competencia |
| **G05** | `29-investigacion-alertas-banner.html` | Top de tabs | Banner alerta | Alertas amarillas/rojas según diferencia precio · markup bajo · etc. |

---

### 🟥 GRUPO H · Herramientas embebidas (3 mockups)

| # | Archivo | Trigger | Familia | Notas |
|---|---------|---------|---------|-------|
| **H01** | `30-tool-dashboard-catalogo.html` | Click "Calculadora" en header | F6(A) Modal grande | Dashboard intel: top productos · análisis por línea · matriz precio/margen · etc. |
| **H02** | `31-tool-punto-equilibrio.html` | Embedded en modal detalle | Card herramienta | Calculadora punto de equilibrio (PEC) con sliders interactivos |
| **H03** | `32-tool-sugerencia-variantes-banner.html` | En ProductoForm cuando detecta similar | Banner sugerencia | "Detectamos 3 productos similares · ¿quieres agruparlos como variantes?" + CTAs |

---

### 🟦 GRUPO I · Filtros rápidos y micro-componentes (3 mockups)

| # | Archivo | Trigger | Familia | Notas |
|---|---------|---------|---------|-------|
| **I01** | `33-filtros-rapidos-pills.html` | Siempre visible bajo header | F3 sub-componente | Pills rápidos: Todos · Activos · Stock crítico · Sin investigar · Packs |
| **I02** | `34-chips-filtros-activos.html` | Cuando hay filtros activos | F3 sub-componente | Lista chips removibles ("Estado: activo X" · "Marca: SkinCeuticals X") + count "23 de 142" |
| **I03** | `35-tooltips-popovers.html` | Hover en métricas y chips | Micro-interacción | Ejemplos de tooltips para: margen · sparkline · stock crítico · investigación vencida |

---

## 2. Resumen del alcance Productos

| Grupo | Cantidad | Foco |
|-------|----------|------|
| A · Página principal y estados | 5 | Pantalla base + estados (vacío, loading, mobile) |
| B · Filtros y bulk actions | 4 | FiltrosBar + drawer mobile + bulk toolbar |
| C · Card de producto granular | 6 | 6 estados visuales del row |
| D · Modal detalle producto | 5 | 5 tabs del modal F6(A) |
| E · Wizards de creación | 5 | Selector + 4 tipos de wizard |
| F · Modales secundarios | 4 | Buscador, variante reducida, papelera, investigación |
| G · Sub-componentes Investigación | 5 | Tabs internos + sub-vistas + banners |
| H · Herramientas embebidas | 3 | Dashboard intel, punto equilibrio, banner sugerencia |
| I · Filtros rápidos y micro-componentes | 3 | Pills + chips activos + tooltips |
| **TOTAL** | **40 mockups** | |

**Nota:** estimaba ~20 mockups iniciales · la inspección milimétrica reveló **40 mockups reales**. Esto es lo que significa "pixel-perfect milimétrico por sección".

---

## 3. Patrón de nomenclatura propuesto

```
docs/mockups/productos/
├── INVENTARIO.md                            ← este documento
├── 01-page-listado.html                     ← GRUPO A
├── 02-page-listado-vacio-bd.html
├── 03-page-listado-vacio-busqueda.html
├── 04-page-listado-loading.html
├── 05-page-listado-mobile.html
├── 06-filtros-bar-default.html              ← GRUPO B
├── 07-filtros-bar-activos.html
├── 08-filtros-drawer-mobile.html
├── 09-bulk-actions-toolbar.html
├── 10-card-row-normal.html                  ← GRUPO C
├── 10b-card-row-hover.html
├── 10c-card-row-stock-critico.html
├── 10d-card-row-investigacion-vencida.html
├── 10e-card-row-pack.html
├── 10f-card-row-archivado.html
├── 11-modal-detalle-info.html               ← GRUPO D
├── 12-modal-detalle-variantes.html
├── 13-modal-detalle-investigacion.html
├── 14-modal-detalle-componentes-pack.html
├── 15-modal-detalle-stock-historico.html
├── 16-wizard-creacion-selector.html         ← GRUPO E
├── 17-wizard-crear-simple.html
├── 18-wizard-crear-con-variantes.html
├── 19-wizard-crear-variante-existente.html
├── 20-wizard-crear-pack.html
├── 21-modal-buscador-grupo.html             ← GRUPO F
├── 22-modal-form-variante-reducida.html
├── 23-modal-archivo-papelera.html
├── 24-modal-investigacion-completo.html
├── 25-investigacion-tab-proveedores.html    ← GRUPO G
├── 26-investigacion-tab-competencia.html
├── 27-investigacion-tab-decision.html
├── 28-investigacion-historial-precios.html
├── 29-investigacion-alertas-banner.html
├── 30-tool-dashboard-catalogo.html          ← GRUPO H
├── 31-tool-punto-equilibrio.html
├── 32-tool-sugerencia-variantes-banner.html
├── 33-filtros-rapidos-pills.html            ← GRUPO I
├── 34-chips-filtros-activos.html
└── 35-tooltips-popovers.html
```

---

## 4. Estimación de tiempo realista

**Sub-fase B · Producción de los 40 mockups:**
- ~15-20 mockups por sesión = **~3 sesiones** de producción
- Sesión 1: Grupos A + B + I (12 mockups) · estructura página completa
- Sesión 2: Grupos C + D (11 mockups) · cards + modal detalle
- Sesión 3: Grupos E + F + G + H (17 mockups) · wizards + modales secundarios + tools

**Sub-fase C · Validación holística:** 1 sesión de revisión consolidada con vos.

**Total Productos:** ~4 sesiones para tener TODO el módulo mockeado pixel-perfect.

---

## 5. Decisiones que necesitamos cerrar ANTES de Sub-fase B

### D-PROD-1 · Wizard "con variantes" · ¿4 pasos o 3?
El wizard actual usa pasos secuenciales. Según F5: 3 pasos = stepper horizontal · 4+ = sidebar vertical. **Opciones:**
- **A)** Mantener flujo actual (Datos comunes → Configurar variantes → Tabla → Confirmar = 4 pasos · sidebar vertical)
- **B)** Comprimir a 3 pasos (Datos+Variantes → Tabla → Confirmar · stepper horizontal)

**Mi recomendación:** A · 4 pasos con sidebar vertical · cada paso tiene contenido sustancial.

### D-PROD-2 · Modal de detalle · ¿5 tabs todos visibles o algunos condicionales?
El tab "Componentes" solo aplica a packs. **Opciones:**
- **A)** Mostrar siempre los 5 tabs (algunos vacíos para no-packs)
- **B)** Tabs dinámicos (3 base + 2 condicionales según tipo)

**Mi recomendación:** B · tabs dinámicos · más limpio.

### D-PROD-3 · Bulk actions toolbar · ¿sticky en top o bottom?
**Mi recomendación:** sticky en TOP · siempre visible al hacer scroll · patrón Linear.

### D-PROD-4 · Card de producto · ¿1 row o card expandible con sub-info?
La tabla actual tiene 1 row por producto. Variantes se ven en modal detalle. **Opciones:**
- **A)** 1 row · click expande modal detalle (actual)
- **B)** Row + chevron expandible inline · muestra variantes sin abrir modal (más Linear-style)

**Mi recomendación:** A · más limpio · evita duplicar funcionalidad del modal.

### D-PROD-5 · Estado "Archivado" · ¿en listado normal con filtro o en modal Papelera?
**Opciones:**
- **A)** Solo en modal Papelera (actual)
- **B)** En listado normal con chip "Archivado" + filtro estado opcional

**Mi recomendación:** A · mantener separación clara entre "operativo" y "papelera".

---

## 6. Próximos pasos

**Lo que necesito de vos AHORA:**

1. ✅ **Validar el inventario** (los 40 mockups listados arriba están completos? ¿falta alguno?)
2. ✅ **Cerrar las 5 decisiones D-PROD-1 a D-PROD-5**
3. ✅ **Confirmar nomenclatura** y orden de archivos

**Una vez cerrado lo anterior**, arranco Sub-fase B en sesión siguiente:
- Sesión 1 dedicada: **producir Grupos A + B + I (12 mockups)**
- Te entrego todos juntos para validación visual del lote
- Iteramos hasta aprobación
- Pasamos a Sesión 2 (Grupos C + D)

**Nada se implementa en código hasta que TODO el módulo Productos esté mockeado y validado.**

---

## 7. Recordatorio de política

> **PIXEL-PERFECT no es negociable. Nada de parches. Validación visual previa OBLIGATORIA.**

Cualquier discrepancia con el canónico que detecte mientras produzca → consulto antes de inventar.
