# ATERRIZAJE · 5 temas críticos antes de mockups

> **Origen:** sesión S58f. El usuario pidió: *"Antes de continuar quiero aterrizar eso primero."*
>
> **Propósito:** dejar zanjado conceptualmente cada uno de los 5 temas antes de
> producir mockups o tocar código. Si no aterrizamos esto, los mockups van a
> reflejar la confusión actual.

---

## Tema 1 · Inventario / Productos / Unidades · 3 iteraciones que se solapan

### 1.1 · Lo que dijiste textualmente

> *"tengo 3 iteraciones respecto a productos... Una es la sección productos, la otra
> la sección de stock, y la otra la sección de unidades... este modelo tiene diversos
> objetivos y puntos de vista, pero ninguno da información concreta, que creo es
> justamente lo que necesitamos aterrizar."*

### 1.2 · Estado actual verificado en código

| Página | Líneas | Subtítulo actual | Problema |
|---|---|---|---|
| **Productos** (`/productos`) | 1331 | "Gestión de productos · Administra tu catálogo, precios e investigaciones de mercado" | Tiene un "apartado para definir inventario" (subjetivo, criterio del usuario) que NO debería estar |
| **Inventario** (`/inventario`) | 1005 | "Vista consolidada del stock calculada desde las unidades físicas" | Tabs: lista / analytics / alertas / incidencias. Muchos clicks. Reservas no se ven con claridad. Analytics financiero "no corresponde con el entorno" |
| **Unidades** (`/unidades`) | 782 | "Fuente única de verdad - Trazabilidad FEFO (First Expired, First Out)" | Filtros por producto/ubicación/estado. Es la fuente de verdad real pero no expone ciclo de vida ni procedencia bien |

### 1.3 · Misión real de cada uno (según tú)

#### **Productos** — Maestro del catálogo
- **Misión:** ser fuente de verdad para creación y configuración de productos.
  - Descripción específica
  - Asociaciones necesarias
  - Sub-módulo: **captura de info de proveedores y competencia** → métricas de precios Perú (precio mínimo − 5%) → recomendación de proveedores
  - **Calculadora**: punto de equilibrio de la traída + cuánto se puede ganar
- **Lo que sobra:** el "apartado para definir inventario" es subjetivo, no debe estar acá.

#### **Stock** (hoy /inventario) — ¿Dónde está cada producto, en qué estado?
- **Misión declarada:** mostrar dónde está cada producto en X momento + estado + reservas USA/Perú.
- **Problemas actuales:**
  - El contexto gráfico no es bueno
  - Muchos clicks para visualizar
  - Reservas no se ven con certeza (cuenta "20 productos en X casilla" pero no su status)
  - Analytics es información financiera **que no corresponde con este entorno**
  - Alertas + incidencias suman complejidad sin claridad

#### **Unidades** — Trazabilidad detallada por unidad física
- **Misión declarada:** trackear estado de cada unidad individual.
- **Datos por unidad:**
  - Ciclo de vida (fecha vencimiento)
  - Etiqueta por **lote y procedencia**
  - Estado: dañado / pérdida
  - Vínculo con OC de referencia
  - Procesos: en aduanas, en tránsito con X colaborador, almacén principal, con driver para entrega
- **Riesgo:** "es mucho... debe ser información precisa y puntual sin saturar".

### 1.4 · Y un cuarto módulo relacionado

> *"aunque no está en inventario, me interesaba mucho la ciencia de inteligencia
> de productos para entender el valor de los productos y saber el valor en cada
> punto donde se encontrara para poder valorizar mi stock en todo momento."*

**Productos Intel** (`/productos-intel`) ya existe con: Lead time, Score liquidez, Sugerencias reposición, Flujo caja por producto. **Pero la "valorización por punto" es lo que pides aterrizar:** ¿cuánto vale el stock que está en aduanas? ¿en tránsito? ¿en almacén? ¿con un driver?

### 1.5 · Propuesta de aterrizaje

Después de leer 3 veces lo que escribiste, **el modelo correcto es 3 capas con nombres y propósitos distintos**, NO una fusión:

```
┌─────────────────────────────────────────────────────────┐
│  📦  PRODUCTOS                                          │
│  Maestro de catálogo · "qué es y cuánto cuesta"         │
│                                                         │
│  • Crear / editar producto + variantes + packs         │
│  • Investigación de mercado y competencia               │
│  • Punto de equilibrio + ganancia estimada              │
│  • Recomendaciones de proveedor                         │
│  • Sin gestión de stock (eliminar el apartado)          │
└─────────────────────────────────────────────────────────┘
            ↓ (alimenta)
┌─────────────────────────────────────────────────────────┐
│  🏪  STOCK (renombrado, antes Inventario)               │
│  Vista de existencias · "qué tengo y dónde"             │
│                                                         │
│  • Vista por SKU + ubicación + cantidad                 │
│  • Estado: libre / reservado USA / reservado Perú       │
│  • Vencimientos próximos (lectura, no operación)        │
│  • Alertas operativas (stock bajo, vence pronto)        │
│  • SIN analytics financiero (eso va a Productos Intel)  │
└─────────────────────────────────────────────────────────┘
            ↓ (cada SKU + ubicación es un agregado de unidades)
┌─────────────────────────────────────────────────────────┐
│  🔬  UNIDADES (vista detallada — antes módulo propio)   │
│  Trazabilidad física · "cada unidad concreta"           │
│                                                         │
│  • Una fila por unidad física                           │
│  • Lote, vencimiento, procedencia, OC origen            │
│  • Estado fino: en aduana / tránsito / almacén /        │
│   driver / dañado / merma                              │
│  • Filtros por producto/ubicación/estado/fecha          │
└─────────────────────────────────────────────────────────┘
            ↓ (la valorización por punto es transversal)
┌─────────────────────────────────────────────────────────┐
│  💡 PRODUCTOS INTEL (existe ya, ampliar)                │
│  Inteligencia analítica del catálogo                    │
│                                                         │
│  • Lead time / Score liquidez / Sugerencias reposición  │
│  • ⭐ NUEVO: VALORIZACIÓN POR PUNTO                     │
│   (en aduana / tránsito / almacén / driver = $X)       │
│  • Histórico de ventas por SKU                          │
└─────────────────────────────────────────────────────────┘
```

### 1.6 · Decisiones que cierra este aterrizaje

| ID | Decisión |
|---|---|
| **D-INV-1** | Productos elimina su sección "definir inventario" |
| **D-INV-2** | Inventario se renombra a **Stock** |
| **D-INV-3** | Stock se concentra en lectura: "qué tengo, dónde, en qué estado" |
| **D-INV-4** | Stock NO tiene analytics financiero (se mueve a Productos Intel) |
| **D-INV-5** | Unidades sigue existiendo como vista detallada (puede ser ítem de sidebar separado o sub-vista de Stock — TÚ DECIDES) |
| **D-INV-6** | Productos Intel agrega "valorización por punto" como nueva vista |

### 1.7 · Pregunta abierta

¿**Unidades** sigue siendo ítem de sidebar separado o se vuelve sub-vista dentro de Stock (con una pestaña "Vista por unidad" cuando expandes un SKU)?

- **Opción A:** sidebar muestra "Productos / Stock / Unidades" — 3 ítems separados.
- **Opción B:** sidebar muestra "Productos / Stock" — y desde Stock haces drill-down a Unidades.

Me inclino por **B** porque las unidades son detalle del stock, no entidad paralela. Pero tú decides.

---

## Tema 2 · Devoluciones · transversal, no solo de Ventas

### 2.1 · Lo que dijiste textualmente

> *"se puede implementar, pero conceptualmente no es solo un módulo de ventas, sino
> algo más transversal... cada sección, compras, envíos y ventas la iba tener, pero
> al final no hemos llegado a ningún acuerdo, porque también es cierto que tiene
> que ser práctico su manejo."*

> *"quien devuelve, por qué devuelve, a quién le tiene que devolver, y si existe
> alguna contrapartida al respecto."*

### 2.2 · Estado actual

- Existe `devolucion.service.ts`
- Existe tipo `Devolucion` en `devolucion.types.ts`
- Existe `DevolucionDetailModal.tsx` y `DevolucionFormModal.tsx` en `Ventas/`
- Tab "Devoluciones" dentro de Ventas
- **Acciones soportadas hoy:** aprobar, rechazar, ejecutar (recibir físicamente), devolver dinero
- **Solo cubre el caso:** cliente devuelve a la empresa

### 2.3 · Mapa de devoluciones reales del negocio

Una devolución tiene 4 dimensiones:

| Dimensión | Posibles valores |
|---|---|
| **Quien devuelve** | Cliente / Proveedor (revertido) / Almacén interno (merma) |
| **Por qué** | Defectuoso · Vencido · Cambio de modelo · No conforme · Daño en tránsito · Rechazo aduanal |
| **A quién** | Empresa (de cliente) · Proveedor original · Baja sin destino |
| **Contrapartida** | Reembolso $ · Reemplazo físico · Nota de crédito · Cambio por otro SKU · Sin compensación (merma) |

### 2.4 · Casos típicos del negocio

| # | Caso | Origen | Quien dispara | Contrapartida |
|---|---|---|---|---|
| 1 | Cliente recibió producto vencido | Venta | Ventas | Reemplazo o reembolso |
| 2 | Cliente cambió de opinión | Venta | Ventas | Reembolso (con condiciones) o cambio |
| 3 | Proveedor mandó SKU equivocado | Compra | Compras | Reemplazo de proveedor |
| 4 | Producto llegó dañado en aduana | Envío | Envíos | Reclamo a courier o pérdida |
| 5 | Producto vencido en almacén | Stock | Stock | Merma (sin contrapartida) |
| 6 | Robo / pérdida | Stock | Stock | Merma + ajuste contable |

### 2.5 · Propuesta de aterrizaje

Crear módulo **propio** `/devoluciones` con vista unificada de todos los casos.
Cada caso conserva su origen (no rompemos los flujos), pero la vista consolidada vive aquí.

```
┌─ DEVOLUCIONES ──────────────────────────────────────┐
│  Vista lista filtrable por:                         │
│  • Origen (venta / compra / envío / stock)          │
│  • Quien devuelve (cliente / proveedor / interno)   │
│  • Razón                                            │
│  • Estado (pendiente / aprobada / ejecutada / cerrada) │
│  • Contrapartida (reembolso / reemplazo / merma)    │
│                                                     │
│  Wizard nueva devolución de 4 pasos:                │
│  1. Origen (qué documento se devuelve)              │
│  2. Detalle (productos/unidades + razón)            │
│  3. Contrapartida (qué se hace después)             │
│  4. Confirmar                                       │
└─────────────────────────────────────────────────────┘

Las páginas de Ventas, Compras, Envíos y Stock muestran su propio
sub-set de devoluciones como TAB SECUNDARIA pero el módulo dueño es /devoluciones.
```

### 2.6 · Decisiones a cerrar

| ID | Decisión propuesta |
|---|---|
| **D-DEV-1** | Crear módulo propio `/devoluciones` con sidebar |
| **D-DEV-2** | Las páginas Ventas/Compras/Envíos/Stock muestran su sub-set como tab (lectura + acción rápida) |
| **D-DEV-3** | Tipo unificado `Devolucion` con discriminator `origen: 'venta' \| 'compra' \| 'envio' \| 'stock'` |
| **D-DEV-4** | Wizard único de 4 pasos para crear cualquier tipo |
| **D-DEV-5** | Contrapartida estandarizada: reembolso (Tesorería) / reemplazo (Stock+Envíos) / merma (Stock) / cambio (Ventas) |

### 2.7 · Pregunta abierta

¿La sección Devoluciones va en **OPERACIÓN COMERCIAL** (junto a Ventas/Compras) o en **OPERACIÓN LOGÍSTICA** (junto a Stock/Envíos)?

Me inclino por **OPERACIÓN COMERCIAL** porque la mayoría de devoluciones son cliente↔ empresa. Pero las de stock interno (mermas) son logísticas. Tú decides.

---

## Tema 3 · Reportes + Mapa Calor · clarificar

### 3.1 · Lo que dijiste textualmente

> *"el mapa de calor es una nueva herramienta que deseaba implementar para segmentar
> y delimitar dónde se ofrecen y mueven determinados productos. En general el mapa
> de ventas de calor que se creó ya tenía una estructura y lógica interesante que
> respondía varias de mis preguntas, sería cuestión de analizarlo en comparativa
> con los reportes."*

### 3.2 · Estado actual

**Reportes** (`/reportes`) tiene 9 tabs:
- TabAuditorias, TabClientes, TabCompras, TabCuentasCorrientes, TabCxC, TabCxP, TabGeografico, TabLogistica
- Es un módulo robusto con vistas tabulares y métricas

**Mapa Calor** (`/mapa-ventas`) tiene 4 sub-componentes:
- MapaCalorMapa.tsx, MapaCalorFiltros.tsx, MapaCalorKPIs.tsx, MapaCalorPanelZona.tsx
- Es un módulo geoespacial con visualización propia

**Solapamiento:** Reportes tiene TabGeografico que probablemente **duplica** parcialmente lo que hace Mapa Calor.

### 3.3 · Propuesta de aterrizaje

Dos opciones, no me decido sin más info tuya:

**Opción A — Mapa Calor como tab de Reportes**
- Pro: simplifica sidebar, elimina duplicación
- Contra: si Mapa Calor tiene UX especializada (zoom, filtros geográficos finos), encajarlo en tabs de Reportes lo limita

**Opción B — Mantener separados pero eliminar TabGeografico de Reportes**
- Pro: cada uno con su propósito propio
- Contra: 2 ítems para cosas relacionadas

### 3.4 · Pregunta abierta para decidir

1. ¿Usas el Mapa de Calor con frecuencia o es esporádico?
2. ¿Necesitas zoom y filtros finos sobre el mapa, o un overview es suficiente?
3. ¿Tab Geográfico de Reportes muestra lo mismo que Mapa Calor o cosas distintas?

---

## Tema 4 · ProveedorForm.tsx duplicado · quién es el dueño

### 4.1 · Lo que dijiste textualmente

> *"hay que aterrizar cuál es verdaderamente el módulo real de ejecución."*

### 4.2 · Estado actual

- Existe `src/components/modules/ordenCompra/ProveedorForm.tsx` — formulario de proveedor dentro del módulo de OC
- Existe módulo Maestros con tabs (donde viven Proveedores/Clientes)
- Existe `src/components/modules/entidades/ProveedorAutocomplete.tsx` — autocomplete reusable

### 4.3 · Caso de uso ambiguo

Cuando el usuario está creando una OC y el proveedor no existe:
- **Opción A:** Crea el proveedor inline desde la OC (con `ProveedorForm` ahí)
- **Opción B:** El sistema obliga a crear el proveedor primero en Maestros, luego volver a la OC
- **Opción C:** La OC tiene "Crear proveedor rápido" que abre un modal con campos mínimos, y después se completa en Personas → Proveedores

### 4.4 · Propuesta de aterrizaje

Una vez **Personas** (V-MAP-2 confirmado) sea sección propia con Clientes/Proveedores como ítems del sidebar:

- **Dueño operativo de Proveedor:** Personas → Proveedores
- **`ProveedorForm` queda como modal compartido** invocable desde:
  - Personas → Proveedores (creación / edición full)
  - OC Wizard → "Crear proveedor rápido" (campos mínimos, después se completa)
  - Gastos (mismo patrón)
- **Validación:** una sola fuente de verdad del componente, parametrizable (`mode: 'full' | 'quick'`)

### 4.5 · Pregunta abierta

¿Cuando creas una OC y el proveedor no existe, prefieres:
- **A.** Crear inline rápido y completar después en Personas
- **B.** Forzar a ir a Personas primero
- **C.** Otra cosa (cuéntame)

---

## Tema 5 · PagoUnificadoForm · ¿necesita upgrade?

### 5.1 · Lo que dijiste textualmente

> *"el módulo de pago único que es transversal en todo el negocio, quizás habría
> que afinarlo también si es que es necesario mejorar el card de pago."*

### 5.2 · Estado actual verificado

`src/components/modules/pagos/PagoUnificadoForm.tsx` (v2) — **es el componente más reusado del sistema**.

**Reemplaza explícitamente:**
- PagoForm (OC)
- PagoGastoForm
- PagoViajeroModal
- VentaForm paso pago

**Soporta 7 orígenes:**
- venta · orden_compra · gasto · viajero · nomina · adelanto · otro

**Usado en 8 módulos:**
- Ventas
- VentaForm
- OrdenesCompra
- Cotizaciones (adelantos)
- Envios (pago a viajero)
- Gastos
- GastoForm
- Planilla → BoletaDetalle

**Capacidades v2:**
- Selector de cuenta agrupado por banco
- Canales Yape/Plin con identificador
- Derivación unificada de métodos
- Línea de crédito con impacto en TC
- Mobile optimized
- Soporta destinatario alternativo (S41 Bloque 5 — colaborador adelantó pago al proveedor)

### 5.3 · Diagnóstico

`PagoUnificadoForm` es **una de las piezas mejor diseñadas del sistema**. Cumple lo que su nombre dice: un solo formulario para todo pago/cobro.

### 5.4 · Posibles upgrades a evaluar

| # | Upgrade potencial | Beneficio | Costo |
|---|---|---|---|
| **U-1** | Integración con `ProductoFinanciero` post-refactor (S58c-PF cerrado) | Saldo cacheado real-time | Bajo |
| **U-2** | Soporte UX para "abono distribuido" (1 desembolso → N deudas) inline | Flujo más fluido vs abrir wizard separado | Medio |
| **U-3** | Sugerencias inteligentes de cuenta de origen (cuál tiene saldo, cuál usa habitualmente) | Reduce decisión cognitiva | Bajo |
| **U-4** | Vista compacta vs expandida según contexto (drawer vs modal completo) | UX más fluida | Medio |
| **U-5** | Estilo visual alineado a S58e (chips, banking-grade, calendar inline) | Coherencia con resto del sistema | Bajo |
| **U-6** | TC automático D-S58-16 confirmado | Cero error manual | Bajo |

### 5.5 · Recomendación

**No re-diseñar el componente.** Su lógica está sólida.

Pero **sí auditar visualmente** que esté al nivel S58e (banking-grade) que aplicamos en Finanzas. Si hay desviaciones cosméticas, alinear sin romper la lógica.

**Mockup necesario:** **M-PAGO-S58f** — auditar `PagoUnificadoForm` y proponer ajustes visuales (no funcionales) para que se sienta como las piezas de S58e.

### 5.6 · Pregunta abierta

¿Tienes algún caso de uso concreto donde sientes que `PagoUnificadoForm` NO funciona bien? (Ejemplos: te toma muchos clicks, no encuentras la cuenta, el cálculo TC es confuso, etc.)

Tu feedback orienta si es solo cosmético o si hay un upgrade funcional pendiente.

---

## Resumen · Decisiones por cerrar antes de mockups

### Bloque A · Inventario / Productos / Unidades / Intel

- **D-INV-1** Productos elimina apartado de inventario
- **D-INV-2** Inventario se renombra a **Stock**
- **D-INV-3** Stock = lectura "qué tengo, dónde, en qué estado"
- **D-INV-4** Sin analytics financiero en Stock
- **D-INV-5** ¿Unidades sidebar separado (A) o drill-down de Stock (B)? **PREGUNTA ABIERTA**
- **D-INV-6** Productos Intel agrega "valorización por punto"

### Bloque B · Devoluciones

- **D-DEV-1** Módulo propio `/devoluciones` con sidebar
- **D-DEV-2** Páginas Ventas/Compras/Envíos/Stock muestran su sub-set como tab
- **D-DEV-3** Tipo unificado con `origen` discriminator
- **D-DEV-4** Wizard único 4 pasos
- **D-DEV-5** Contrapartida estandarizada
- **¿Sección sidebar?** Comercial vs Logística — **PREGUNTA ABIERTA**

### Bloque C · Reportes + Mapa

- **3 preguntas abiertas** sobre frecuencia uso y duplicación de TabGeografico

### Bloque D · ProveedorForm

- Dueño operativo: Personas → Proveedores
- `ProveedorForm` queda como modal compartido `mode: 'full' | 'quick'`
- **¿Inline en OC o forzar Maestros primero?** — **PREGUNTA ABIERTA**

### Bloque E · PagoUnificadoForm

- No re-diseñar lógica
- Auditoría visual S58e (M-PAGO-S58f)
- **¿Hay caso de uso donde no funciona?** — **PREGUNTA ABIERTA**

---

## Total · 6 preguntas abiertas para cerrar antes de mockups

1. **Unidades** sidebar separado o drill-down de Stock (Bloque A · D-INV-5)
2. **Devoluciones** sección Comercial o Logística (Bloque B)
3. **Mapa Calor** ¿frecuencia? ¿zoom? ¿duplica TabGeografico? (Bloque C, 3 preguntas)
4. **Crear Proveedor desde OC** ¿inline o forzar Maestros? (Bloque D)
5. **PagoUnificadoForm** ¿caso de uso problemático? (Bloque E)

---

> **Última actualización:** 2026-04-29 · sesión S58f
> **Estado:** esperando respuestas a las 6 preguntas abiertas
> **Después de validar:** procederé a producir mockups por bloque (1 mockup por bloque grande)
