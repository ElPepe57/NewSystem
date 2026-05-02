# DESIGN CANÓNICO FINAL · BusinessMN v2

> **Estado:** Constitución visual del sistema · ratificada
> **Fecha:** 2026-05-02
> **Reemplaza:** referencias canónicas declaradas en `CLAUDE.md` (S54.x) y manifesto S58f
> **Documento maestro visual:** `docs/mockups/CANONICO_MASTER.html`
> **Política:** PIXEL-PERFECT no es negociable. Nada de parches. Validación visual previa OBLIGATORIA antes de implementar.

---

## 0. Filosofía de diseño

> **"Mercury para Banking + Linear para listados + Stripe para tablas + Notion para headers + Vercel para empty states. Tabular-nums en todo. Lucide-icons únicos. Sin emojis en chrome de UI. Sin gradientes pesados. Wizards en 3 niveles según largo. Filtros como bloque LEGO componible."**

Las empresas de referencia (Stripe, Linear, Mercury, Notion, Vercel) comparten 5 principios:

1. **Densidad informativa controlada** — no apabullar pero no diluir
2. **Tabular-nums obsesivo** — todo número en banking-grade
3. **Una acción primaria por contexto** — jerarquía visual clara
4. **Sin decoración gratuita** — gradientes, sombras y emojis solo cuando agregan información
5. **Validación visual antes de implementar** — design review siempre

---

## 1. Las 15 Decisiones Ratificadas (F1-F12 + IMPL-1/2/3)

### F1 · Header banking-grade

**REGLA:** Variante D (S58f) como ÚNICO header canónico para todas las páginas.

**Estructura obligatoria:**
```jsx
<div className="flex items-start justify-between gap-4 flex-wrap mb-5">
  <div>
    {/* Breadcrumb · ChevronRight separator · w-3 h-3 */}
    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
      <span className="hover:text-teal-600 transition-colors cursor-pointer">{Modulo}</span>
      <ChevronRight className="w-3 h-3" />
      <span className="text-slate-600 font-medium">{Pagina} · {Subtitulo}</span>
    </div>
    {/* h1 con icon teal · siempre con gap-2.5 */}
    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
      <{Icon} className="w-6 h-6 text-teal-600" />
      {Titulo}
    </h1>
    {/* Subtítulo descriptivo · max-w-2xl · obligatorio */}
    <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
      {Subtitulo descriptivo · 1 línea que aterriza el propósito al usuario no técnico}
    </p>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
    {/* Acciones secundarias (blanco con border) · luego primary-soft */}
    {AccionesSecundarias}
    <Button variant="primary-soft">{AccionPrimaria}</Button>
  </div>
</div>
```

**Razón:** Notion y Vercel abren cada página con h1 limpio + subtítulo de 1 línea que aterriza el propósito. Sin gradientes pesados.

**Anti-pattern:** PageHeader legacy con gradient.

---

### F2 · KPI strip

**REGLA:** Strip horizontal con dividers verticales como default. 3 variantes con criterio:

| Variante | Cuándo usar | Características |
|----------|-------------|-----------------|
| **B (default obligatorio)** | 95% de pantallas | 1 contenedor blanco · dividers verticales · 4-5 KPIs |
| **C (con sparklines)** | Cuando hay tendencia temporal real | B + sparklines internas en KPIs con tendencia |
| **D (cards anchored)** | SOLO Dashboard ejecutivo principal y mapas | Cards individuales con tendencias internas estilo Stripe Radar |

**Estructura B (default):**
```jsx
<div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
  <div className="p-4">
    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {Label uppercase}
    </div>
    <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
      {Valor entero}<span className="text-base text-slate-400 font-normal">.{Decimales}</span>
    </div>
    <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
      {Sub-info contextual}
    </div>
  </div>
  {/* ...más KPIs con divisor vertical entre ellos... */}
</div>
```

**Razón:** Mercury y Brex usan strip horizontal con dividers porque maximiza información en mínimo espacio vertical.

**Anti-pattern:** Cards individuales con shadow para 4 KPIs (ocupa 3x más espacio sin agregar info).

---

### F3 · Filtros · UN componente compositional

**REGLA:** Existe UN solo componente `<FiltrosBar>` con sub-componentes que cada dominio combina.

**Estructura:**
```jsx
<FiltrosBar>
  <FiltrosBar.DateRange presets={['7d','30d','90d','6m','año','todo']} />
  <FiltrosBar.Divider />
  <FiltrosBar.ChipGroup label="Estado" options={...} multi />
  <FiltrosBar.ChipGroup label="Canal" options={...} multi />
  <FiltrosBar.Divider />
  <FiltrosBar.Search placeholder="Buscar..." />
  <FiltrosBar.Sort options={...} />
  <FiltrosBar.ClearAll visible={hayFiltrosActivos} />
</FiltrosBar>
```

**Sub-componentes obligatorios a producir en `src/components/common/filters/`:**
- `FiltrosBar.tsx` (contenedor)
- `DateRangeDropdown.tsx`
- `ChipGroup.tsx` (toggleable, multi-select, con counts)
- `SearchInput.tsx`
- `SortDropdown.tsx`
- `ClearAllButton.tsx`

**Migración obligatoria:** los 3 componentes actuales (`FiltrosFinanzasBar`, `FiltrosGastosBar`, `FiltrosMovimientosBar`) se migran a `<FiltrosBar>` componible.

**Razón:** Linear y Stripe Dashboard usan este patrón. Hoy tenemos 3 archivos casi idénticos · es deuda técnica clara.

**Anti-pattern:** Componente Pipeline horizontal genérico para filtros (queda solo como excepción declarada para vistas de productos financieros con flujo de estados).

---

### F4 · Tablas vs Cards · CARDS POR DEFAULT

**REGLA #1:** Cards por default. Tabla solo en 3 casos justificados.

| Caso | Variante | Cuándo |
|------|----------|--------|
| **Default** | **B · Cards apiladas** | Cualquier listado de entidades (Gastos, Envíos, Saldos, Compras OC, Reclamos, Devoluciones, Cotizaciones, Requerimientos, Clientes, Proveedores, Empleados) |
| Excepción 1 | A · DataTable simple | **Ledgers contables**: Movimientos tesorería, Conversiones, Transferencias, Pagos masivos · usuario escanea verticalmente, ve saldo corrido |
| Excepción 2 | C · Robust grid con avatares | **Catálogos densos comparativos**: Productos (387 SKUs), Stock (2,847 unidades) · usuario compara métricas lado a lado |
| Excepción 3 | D · Cards anchored al canvas | **Dashboards visuales con coordenadas**: Mapa Ventas, Heatmap Stock, Dashboard ejecutivo |

**Implicación:** ~70% pantallas usan B (cards). ~20% A o C. ~10% D.

**Razón:** Linear, Notion, Stripe usan cards por default. La tabla es excepción justificada.

**Anti-pattern:** Tabla cruda con 8 columnas para listar gastos del mes.

---

### F5 · Wizards · El número de pasos decide el patrón

**REGLA:** El largo del flujo dicta el patrón. Sin excepciones.

| Pasos | Variante | Patrón visual | Inspiración |
|-------|----------|---------------|-------------|
| **1 paso** | **D · Modal inline** | FormModalV2 con secciones colapsables | Linear quick-create |
| **3 pasos** | **B · Stepper horizontal** | Pasos arriba con check + contenido + footer | Stripe Checkout |
| **4+ pasos** | **A · Sidebar vertical** | Sidebar izq numerado + contenido + sidebar derecho persistente | Stripe Connect onboarding |

**Variante C (steps secuenciales con sub-tabs)** → ELIMINADA del backlog. Es A mal aplicado.

**Ejemplos:**

**1 paso (D):** Nuevo proveedor · Nuevo gasto · Nueva categoría · Editar perfil

**3 pasos (B):** Conversión USD↔PEN (Origen → Monto+TC → Confirmar) · Transferencia entre cuentas · Cobro distribuido · Pagar TC

**4+ pasos (A):** Crear envío unificado (4 pasos · cada uno con secciones) · Pagos masivos (5 pasos) · Crear OC (5+ pasos) · Crear cuenta bancaria · Crear pack/kit

**Razón:** Stripe Connect onboarding usa sidebar (es 6+ pasos) · Stripe Checkout usa stepper (3 pasos) · Linear quick-create usa modal (1 paso).

**Anti-pattern:** Sidebar vertical para wizard de 3 pasos (overhead visual). Stepper horizontal para wizard de 8 pasos (no caben).

---

### F6 · Modales de detalle

**REGLA:** Taxonomía cerrada de 4 variantes con criterio:

| Variante | Cuándo usar |
|----------|-------------|
| **A · HeaderHero + KpiRow + Tabs** | Modales operativos de entidades en MODAL (productos PF, cuentas, cuentas corrientes, tarjetas) |
| **B · Hero full-page + acciones** | Drill-down completo full-page (titular drill-down, vista expandida pipeline) |
| **C · Card detail simple** | Legacy OC (referencia canónica histórica · NO se aplica a módulos nuevos) |
| **+E · Drawer lateral derecho** | Drill-down RÁPIDO desde listados sin perder contexto (entidad CC, movimiento detalle) · Inspiración Stripe lateral panel |

**Razón:** cada patrón resuelve un caso UX distinto. Modal centrado para entidades operativas. Drawer lateral para drill-down sin perder contexto del listado.

#### F6.1 · Header de modal de detalle · DECISIÓN CANÓNICA GLOBAL (2026-05-02)

**REGLA OBLIGATORIA para variante A (modales centrados de detalle):**

```jsx
<div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 px-6 py-4">
  <div className="flex items-start justify-between gap-4">
    <div className="flex items-start gap-3">
      {/* Avatar con color SEMÁNTICO por dominio */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-{dominio}-100 to-{dominio}-200 flex items-center justify-center flex-shrink-0">
        <{Icon} className="w-6 h-6 text-{dominio}-700" />
      </div>
      <div>
        {/* Meta info inline */}
        <div className="text-[11px] text-slate-500 flex items-center gap-2 mb-0.5">
          <span className="font-mono">{ID}</span>
          <span>·</span>
          <span>{Marca/Empresa}</span>
          <span>·</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
            {Estado}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">{Nombre}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{Categorías separadas por ·}</p>
      </div>
    </div>
    {/* Acciones · jerarquía: secundaria → primaria → menu → cerrar */}
    <div className="flex items-center gap-1.5">
      <button className="...secondary">Editar</button>  {/* Acción primaria */}
      <button className="...icon-btn"><MoreHorizontal /></button>  {/* Menú "..." con acciones secundarias */}
      <button className="...close-btn"><X /></button>
    </div>
  </div>
</div>
```

**Reglas duras:**
1. **Background:** `bg-gradient-to-br from-slate-50 to-white` SIEMPRE (sutil neutro)
2. **PROHIBIDO:** gradients agresivos de color saturado (`from-violet-600 to-fuchsia-600`, `from-purple-600 to-pink-600`, etc.) en el background del header
3. **Color semántico vive en el AVATAR:** amber=skincare, indigo=suplemento, purple=pack, sky=cuenta bancaria, teal=cuenta corriente, rose=alerta, etc.
4. **Border bottom:** `border-b border-slate-200`
5. **Acciones del header:** patrón `[Acción primaria] [Menú "..."] [X cerrar]` · acción primaria es 1 sola (Editar/Confirmar/etc.) · resto van en menú "..."

**Razón canónica:** Mercury · Linear · Stripe · Notion usan el mismo patrón. El **contenido es protagonista** · el header es chrome · no decoración. El gradient pesado cansa la vista en uso recurrente.

**Aplica a:** TODOS los modales de detalle del sistema (productos, cuentas PF, cuentas corrientes, tarjetas crédito, OC detalle, gastos, etc.)

#### F6.2 · Layout interno del modal · 3 columnas para tab principal (Resumen)

**REGLA RECOMENDADA para tab "Resumen" del modal:**

```
┌──────────────────────────────────────────────────────┐
│ COLUMNA IZQUIERDA (col-span-2)  │ SIDEBAR (col-span-1)│
│                                  │                     │
│ • Datos básicos                  │ • Card insight 1    │
│ • Atributos del dominio          │ • Card insight 2    │
│ • Origen / Procedencia           │ • Card insight 3    │
│ • Sub-secciones contextuales     │                     │
└──────────────────────────────────┴─────────────────────┘
```

Sidebar derecho con 3 cards de **insights ejecutivos** (precio sugerido, punto equilibrio, métrica relevante) usando gradients suaves de color (`from-emerald-50`, `from-indigo-50`, `from-violet-50`).

---

### F7 · Tabular-nums + decimales atenuados

**REGLA:** OBLIGATORIO en todo monto, métrica, fecha, ID, porcentaje, conteo.

**Implementación:**
```jsx
{/* Monto con decimales atenuados */}
<span className="tabular-nums tracking-tight">
  S/ 14,250
  <span className="text-slate-400 text-sm font-normal">.80</span>
</span>

{/* Conteo */}
<span className="tabular-nums">{count.toLocaleString('es-PE')}</span>

{/* Porcentaje */}
<span className="tabular-nums">+38<span className="text-slate-400">%</span></span>
```

**Utility class global:** declarar `font-variant-numeric: tabular-nums` como regla en cards y headers.

**Razón:** Stripe lo aplica en TODO el dashboard. Es lo que distingue UI profesional de amateur.

**Anti-pattern:** Texto con números proporcional · números sin decimales atenuados en cards/KPIs.

---

### F8 · Iconografía · lucide-react ÚNICO

**REGLA:** `lucide-react` como única fuente de iconografía. Prohibido emojis en chrome de UI.

**Permitido:**
- ✅ Lucide icons en todo (chips de estado, headers, breadcrumbs, botones, navegación)
- ✅ Emojis en EMPTY STATES (👋 "Hola, todavía no hay datos")
- ✅ Emojis en TOOLTIPS contextuales

**Prohibido:**
- ❌ Emojis en chips de estado (`💰` `⚠️` `📦`)
- ❌ Emojis en columnas de tablas
- ❌ Emojis en headers de página
- ❌ Emojis en badges

**Razón:** Linear, Vercel, Notion, Mercury · NINGUNO usa emojis en chrome de UI. Lucide tiene ~1500 iconos · cobertura total.

---

### F9 · Breadcrumb separator

**REGLA:** `<ChevronRight className="w-3 h-3 text-slate-400" />` como ÚNICO separador.

**Prohibidos:** `·` puntomedio · `>` chevron texto · cualquier otro separator.

```jsx
<div className="flex items-center gap-2 text-xs text-slate-400">
  <span className="hover:text-teal-600 cursor-pointer">{Modulo}</span>
  <ChevronRight className="w-3 h-3" />
  <span className="text-slate-600 font-medium">{Pagina}</span>
</div>
```

---

### F10 · Botones de acción en header

**REGLA:** Jerarquía estricta de 3 niveles.

```jsx
{/* Acción primaria · UNA por página · al final de la fila */}
<Button variant="primary-soft">
  <Plus className="h-4 w-4 mr-1" /> Nuevo X
</Button>

{/* Acciones secundarias · botón blanco con border · text-slate-600 */}
<button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
  <Download className="w-3.5 h-3.5" />
  Exportar
</button>

{/* Acciones destructivas · text-rose-600 · hover bg-rose-50 */}
<button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-all">
  <Trash2 className="w-3.5 h-3.5" />
  Eliminar
</button>
```

**Razón:** Linear usa exactamente esta jerarquía · 1 acción primaria por contexto, resto secundarias planas.

---

### F11 · Mockups con propósitos solapados

**Decisiones cerradas:**

| Mockup | Decisión |
|--------|----------|
| `finanzas-unificadas-s56` | ❌ MARCAR OBSOLETO (reemplazado por finanzas-saldos + cash-flow vía tabs) |
| `envio-card-v2-propuestas` | ❌ MARCAR OBSOLETO (eran 3 propuestas alternativas históricas) |
| `cuenta-bancaria-full-s58c` | 📦 MARCAR HISTÓRICO (ya implementado vía CuentaWizard) |
| `finanzas-overview-s57` | 🔍 REVISAR (probablemente sigue válido como dashboard ejecutivo) |
| `finanzas-listado-s58e` | 🔍 REVISAR (sospecho redundante con saldos) |

---

### F12 · Responsive Hybrid · Tabla → Cards apiladas (NUEVO 2026-05-02)

**Filosofía:** "Mobile-first NO significa todo igual con texto chico. Significa REPENSAR la interfaz."
Lo hacen Stripe · Linear · Notion · Mercury · Shopify · Vercel · Airtable · todos los líderes de UX moderna en SaaS/Banking.

**Regla canónica:**

```
≥ 1024px (lg)  → TABLA densa grid-cols-12 (densidad máxima · mouse-friendly)
< 1024px       → CARDS apiladas verticales (touch-friendly · 1-handed scroll)
```

**Por qué NO progressive disclosure (esconder columnas):**
- Pierde información crítica en mobile (un usuario en mobile NO debería ver MENOS, debería ver lo MISMO en otro formato)
- Touch targets muy chicos · checkboxes y acciones diminutas
- No respeta el modo de uso real (scroll vertical 1 mano)
- Genera "tabla apretada" que se ve mal · pierde estética banking-grade
- Ninguna gran empresa lo hace

**Anatomía del card apilado mobile (3 zonas claras):**

```
┌──────────────────────────────────────────────┐
│  ☐  ┌──┐  Vitamin C Brightening Serum        │ ← ZONA 1 · IDENTIDAD
│     │🧪│  SKU-PROD-0042 · SkinCeuticals      │   (avatar + nombre + sub-id + chips)
│     └──┘  [Skincare] [Activo] [⚠ Crítico]    │
├──────────────────────────────────────────────┤
│   STOCK              PRECIO         MARGEN   │ ← ZONA 2 · MÉTRICAS (3 cols compactas)
│   87 uds             S/ 285         52% ▲    │   (todas las métricas críticas en 1 línea)
│   4 variantes        desde S/95     ▁▃▅▇     │
├──────────────────────────────────────────────┤
│   ⚠ Reordenar ahora · cubre ~5 días          │ ← BANNER CONTEXTUAL (si aplica)
│                                  [+ Crear OC]│
├──────────────────────────────────────────────┤
│              [Ver detalle ▶]                  │ ← ZONA 3 · ACCIÓN PRIMARIA
└──────────────────────────────────────────────┘   (touch target ~44px altura)
```

**Tabla de transformación canónica · aplicable a TODOS los listados del sistema:**

| Componente | ≥1024px (desktop) | <1024px (tablet+mobile) |
|-----------|-------------------|-------------------------|
| **Listado de entidades** | Tabla grid-cols-12 | **Cards apiladas verticales** ⭐ |
| KPI strip | 4 cols horizontal | 2 cols (sm) o 1 stacked (xs) |
| Filtros | inline horizontal + chip groups | **Drawer slide-up** (botón "Filtros" con badge) |
| Bulk actions toolbar | inline acciones | Acciones primarias visibles + "Más" dropdown |
| Modales | Modal centrado max-w-2xl/4xl | **Bottom sheet** que ocupa 90vh con drag handle |
| Wizards | Sidebar vertical (4+ pasos) | Stepper compacto top + content fullscreen |
| Header acciones | flex-wrap horizontal todas visibles | Primary CTA visible + "Más acciones" dropdown |
| Sub-tabs (modal) | inline horizontal | Tabs scroll horizontal o select dropdown |

**Touch targets mínimos:**
- Botones de acción: altura ≥44px en mobile (Apple HIG / Material 3)
- Checkboxes: w-4 h-4 mínimo (16px)
- Espacio entre interactivos: ≥8px

**Scrollbars · OCULTAR en mobile (regla obligatoria):**
Los scrollbars nativos del navegador rompen el look banking-grade. En cualquier elemento con `overflow-x-auto` (pills rápidos, tabs scroll, KPIs en strip horizontal, etc.) aplicar la utility `scrollbar-hide`:

```css
/* Definir en globals.css o tailwind plugin */
.scrollbar-hide {
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;      /* IE/Edge */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;                 /* Chrome/Safari/Opera */
}
```

Aplicar a: pills rápidos · tabs scroll · KPI strip horizontal en mobile · sub-tabs · cualquier `overflow-x-auto`. La funcionalidad de scroll se mantiene · solo se oculta el chrome visual.

**Implementación técnica:**
- Usar Tailwind responsive prefixes nativos (`hidden lg:block` · `lg:hidden` · `lg:grid-cols-4` · etc.)
- NO usar JavaScript para detectar viewport · todo via CSS responsive
- Componente `RowAdaptive` que renderiza `<TableRow>` o `<StackedCard>` según breakpoint

**Aplica a:** Productos · Stock · Compras · Ventas · Cotizaciones · Requerimientos · Mercado Libre · Envíos · Red Logística · Escáner · Tesorería · Finanzas · Contabilidad · Reclamos · Devoluciones · TODOS los futuros módulos.

**Mockup gemelo obligatorio:** cada mockup de listado/modal/dashboard tiene un gemelo `-mobile.html` que muestra la versión <1024px. Ejemplos producidos para Productos:
- `01m-page-listado-mobile.html`
- `10m-card-row-mobile.html`
- `11m-modal-detalle-mobile.html`
- `24m-modal-investigacion-mobile.html`
- `30m-tool-productos-intel-mobile.html`

Los demás mockups (filtros · wizards · estados granulares) derivan su versión mobile de estos 5 patrones.

---

### IMPL-1 · Orden de implementación · 9 grupos por valor + dependencia

```
GRUPO 1 · Productos · tabla canónica robust grid (variante C) · ~1.5h
GRUPO 2 · Stock · listado canónico robust grid (variante C) · ~1.5h
GRUPO 3 · Reclamos · timeline procedural completo · ~1h
GRUPO 4 · Ventas · cards apiladas (variante B) + Mapa geo (D) · ~2h
GRUPO 5 · Conversion + Transferencia · wizards 3 pasos (B) · ~1.5h
GRUPO 6 · Pagos masivos · wizard sidebar vertical (A) · ~2h
GRUPO 7 · Tarjeta crédito + Caja recaudadora · ~2h
GRUPO 8 · Finanzas overview + cash-flow + modales · ~2h
GRUPO 9 · Tesorería layout + visualizaciones · ~2h
GRUPO 10 · Re-revisión wizards envíos T2/J/Unificado al canónico · ~3h
```

Total: **~18-20h** repartidas en **6-8 sesiones** de 2-3h.

---

### IMPL-2 · Protocolo de validación previa OBLIGATORIO

**Antes de tocar cualquier mockup grande/riesgoso:**

1. Te muestro el plan: "Mockup X requiere ~Yh para pixel-perfect porque [razones]. Opciones: A) hacerlo completo, B) parchar Y, C) postergar"
2. Vos decidís
3. Yo ejecuto solo lo aprobado

**Regla absoluta:** Cero parches unilaterales. Cero atajos. Cero "esto es suficiente".

---

### IMPL-3 · Mockups viejos: estrategia

**Decisión:** TODOS los mockups (54) se re-revisan contra este canónico final.

**Workflow por módulo (Opción C):**
1. Produzco mockups actualizados de TODO un módulo (ej. Productos completo)
2. Vos validás el módulo entero
3. Una vez aprobado el módulo, recién implemento pixel-perfect contra esos mockups
4. Pasamos al siguiente módulo

**Política con código ya implementado:**
- Escenario A (mockup viejo coincide 100% con canónico): sin cambios
- Escenario B (difiere en detalles menores trivials): actualizo mockup. Si trivial → en el mismo turno de la próxima implementación. Si estructural → consulto antes
- Escenario C (difiere significativamente): consulto SIEMPRE antes de tocar nada

---

## 2. Las 6 Clarificaciones Ratificadas

| Clarif | Decisión |
|--------|----------|
| C1 · Alcance | TODOS los 54 mockups se re-revisan contra el canónico final |
| C2 · Excepciones CLAUDE.md | Nuevo canónico GANA · CLAUDE.md se actualiza después |
| C3 · Wizards ya implementados | SÍ se re-revisan · al final del backlog (Grupo 10) |
| C4 · Workflow validación | **Por módulo (Opción C)** · validación holística por dominio |
| C5 · CANONICO_MASTER.html | SÍ producirlo · con ejemplos concretos |
| C6 · Política código vivo | Acepto protocolo Escenarios A/B/C |

---

## 3. Plan de Ejecución · 4 Etapas

### Etapa 1 · Cierre Constitución (HOY)
- ✅ `docs/MOCKUPS_AUDIT.md` · auditoría 54 mockups
- ✅ `docs/mockups/DECISIONES_VISUALES.html` · decision board
- ✅ `docs/DESIGN_CANONICO_FINAL.md` · este documento
- 🟡 `docs/mockups/CANONICO_MASTER.html` · referencia visual única
- 🟡 Actualizar `CLAUDE.md` con referencia al nuevo canónico

### Etapa 2 · Mockups actualizados por módulo (~5-6 ses)
- Sesión 1: GRUPO 1+2 · Productos + Stock (mismo patrón robust grid)
- Sesión 2: GRUPO 3+4 · Reclamos + Ventas
- Sesión 3: GRUPO 5+6 · Wizards Conversion/Transf + Pagos masivos
- Sesión 4: GRUPO 7+8 · Tarjeta crédito + Caja + Finanzas extendido
- Sesión 5: GRUPO 9 · Tesorería layout + visualizaciones
- Sesión 6: GRUPO 10 · Wizards envíos T2/J/Unificado al canónico

### Etapa 3 · Validación visual por módulo
Después de cada sesión de Etapa 2 → vos validás los mockups del módulo → ajustes → aprobación

### Etapa 4 · Implementación pixel-perfect (~6-8 ses)
- Implementación contra mockup aprobado · módulo por módulo
- Validación visual previa para cada cambio grande/riesgoso
- UAT visual al cierre de cada módulo

**Total estimado:** ~12-15 sesiones para llegar a 100% pixel-perfect verificado.

---

## 4. Referencia visual única

Para validar cualquier mockup nuevo o pantalla implementada, comparar contra:

📐 **`docs/mockups/CANONICO_MASTER.html`**

Este HTML muestra TODOS los componentes canónicos en uso con:
- Ejemplos visuales en vivo (no iframes · render directo)
- Variantes con criterio de uso
- Snippets de código de referencia
- Anti-patterns explícitos (qué NO hacer)

---

## 5. Cómo usar este documento

**Para diseñar un nuevo mockup:**
1. Identificar qué familias del manifesto aplican (F1-F10)
2. Aplicar las reglas pixel-perfect
3. Comparar el mockup contra `CANONICO_MASTER.html`
4. Validar con el usuario antes de implementar

**Para implementar pixel-perfect:**
1. Tener mockup aprobado (o pantalla viva alineada)
2. Verificar cada elemento contra las reglas F1-F10
3. Si descubro discrepancia técnica con el canónico → CONSULTAR antes de tocar
4. Cero parches · pixel-perfect siempre

**Para auditar pantallas existentes:**
1. Recorrer F1-F10 verificando cada elemento
2. Documentar discrepancias
3. Plan de migración con validación previa

---

> **Última palabra:** este documento es la constitución. Si en cualquier momento detecto necesidad de cambio en el canónico final, se valida con el usuario y se actualiza ESTE documento PRIMERO. Después se actualizan mockups. Después se actualiza código. Nunca al revés.
