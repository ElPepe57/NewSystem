# ENVÍOS · HUB BLUEPRINT (rework al Hub Kit · 2026-06-02)

> **Origen:** durante el diseño de Ventas se decidió la unificación logística (Charter S58f ·
> decisión S43-S52): **Envíos = hub transversal de logística**. Los módulos comerciales DISPARAN
> (Compras, Ventas, Devoluciones) y el hub OPERA. Esto cierra **T-F** (despacho de venta) y deprecia
> la entidad paralela `Entrega` (su última milla se absorbe en el Envío Caso F).
>
> **Decisión del usuario (2026-06-02):** reworkear Envíos COMPLETO primero (es donde vive el despacho),
> con cobertura TOTAL por fases. 6 tabs aprobadas. Arranca Fase 1.

---

## 1 · UBICACIÓN Y COLOR (canon DS)

- **Grupo sidebar:** Inventario → color **orange** (heredado de `grupoColor.ts` · NO se elige).
- **Chrome** (orange): chip de rol · icono header · tab activa · primary CTA · focus rings.
- **Semántico** (fijo · NO usa orange): sky=tránsito/proceso · amber=espera/pendiente · rose=urgencia/incidencia ·
  emerald=recibido/positivo · teal=valor landed · violet=capital. El color del módulo nunca pisa al semántico.

---

## 2 · ANATOMÍA HUB (canon · reemplaza el PageShell legacy)

Shell → top-bar (breadcrumb S9.D1 + chip rol contextual orange) → header banking-grade (icono tonal +
h1 "Envíos" + subtítulo "Hub logístico · todo lo que entra, sale o se traslada" + acciones 3-tier) →
KPI strip → **TABS de sub-sección** → body.

### Tabs (6 · aprobadas 2026-06-02 · Resumen primero)
| Tab | Tipo | Contenido |
|---|---|---|
| **Resumen** | dashboard | §A→§F · salud logística (NUEVO · hoy no existe) |
| **Operaciones** | operativa | listado de envíos + filtro por tipo de ruta A-J |
| **Incidencias** | operativa | gestión de incidencias (faltante/dañada/aduana/diferente) |
| **Reclamos** | operativa | reclamos a proveedor/courier/seguro |
| **Costos** | análisis | costos landed por envío + CTRU |
| **Rendimiento** | análisis | KPIs operativos (Fill Rate · On-Time · Damage · Loss) + rankings |

---

## 3 · KPI STRIP (5 · semántico · canon no-redundancia)

| KPI | Color | Mide |
|---|---|---|
| **Activos** | orange (módulo) | envíos en curso |
| **En tránsito** | sky | en camino |
| **Pendientes recepción** | amber | esperando recepción |
| **Incidencias** | rose | sin resolver |
| **Valor landed** | teal | costo importación prorrateado (PEN) |

Mini-stats footer (no clonan el strip): **En reclamo** (S/ en disputa) · **COD x cobrar** (despachos de
venta · NUEVO) · **próxima aduana**. El Resumen NO re-renderiza estos KPIs (canon no-redundancia · ELEVA).

---

## 4 · LAYOUT

- **Operaciones:** Layout A (`grid main(2)+aside(1)`) · main = listado · aside = **contexto logístico
  persistente** (urgencias: aduana retenida · COD por cobrar · recepciones demoradas + widget couriers).
- **Resumen / Incidencias / Reclamos / Costos / Rendimiento:** Layout B (full-width · tablas/dashboards).
- `max-w-6xl` unificado · body dentro del shell · `bg-slate-50/30`.

---

## 5 · TAB RESUMEN (§A→§F · dashboard ejecutivo · NUEVO)

- **§A banner salud** — semáforo: incidencias abiertas + aduana retenida + recepciones demoradas + COD vencido.
- **§B visualización** — distribución por tipo de ruta (A-J · donut) + tendencia de envíos/mes (sparkline).
- **§C insights** (lo que el strip NO da) — **lead time** promedio (despacho→recepción) · **fill rate** ·
  **on-time %** · **costo flete promedio/lb** · **damage rate**.
- **§D acciones** — Nuevo envío · Registrar recepción pendiente · Gestionar incidencias · Liberar aduana.
- **§E cross-links 360** — Compras (OCs que disparan envíos) · Ventas (despachos F) · Devoluciones (G) ·
  Red Logística (couriers/viajeros) · Tesorería (pagos de flete).
- **§F alertas** — aduana retenida · incidencias sin resolver · recepciones demoradas · COD por cobrar ·
  reclamos en disputa.

---

## 6 · TAB OPERACIONES (el listado · referencia EnvioCardSimple canónica)

- **Filtro por tipo de ruta A-J** (chips · scroll-x mobile · cada uno con su color/icono · count).
- **Pills:** Todas · Activas · Con incidencias · Tramo 1·Proveedor.
- **Dropdown couriers** + Toolbar (search) + FilterDrawer (Vista/Tipo/Estado).
- **Listado** de cards (EnvioCard migrada al kit · layout dual narrow/wide · container queries).
- **Paginación** "Cargar más" (+12).
- **aside** (Layout A): urgencias logísticas + widget couriers.
- **Estados:** empty (contextual + CTA) · loading (skeleton) · **error (NUEVO · hoy solo toast)**.

---

## 7 · DETALLE ADAPTATIVO POR TIPO (pieza clave del rework)

Header (EntityHeader) + RouteCardV2 (ruta) + NextActionBanner (CTA por estado) + KpiRow (5) + **tabs internos
que se ADAPTAN al tipo de envío**:

| Perfil | Tabs internos | Estados |
|---|---|---|
| **Importación** (A·B·C·D·J) | Productos · Recepciones · Costos landed · Pagos · Incidencias · **Tandas** · Documentos · Inteligencia · Timeline | borrador→confirmado→en_transito→retenida_aduana→recibida_parcial/completa |
| **Despacho venta** (F) | Productos · **Cobro COD** · **Reparto** · Incidencias · Documentos · Timeline | + estados de última milla: programada→en_camino→entregada/**fallida**/**reprogramada** |
| **Devolución** (G) | Productos · Revisión · Incidencias · Documentos · Timeline | cliente→almacén · motivo de rechazo |
| **Traslado/Terceros** (E·I) | Productos · Recepciones · Costos landed · Incidencias · Documentos · Timeline | interno · stock bloqueado (I) |

El detalle es **uno solo** · muestra/oculta tabs y acciones según `tipoRutaLogistica`.

---

## 8 · DESPACHO F ENRIQUECIDO · ABSORCIÓN DE `Entrega` · DISPARO DESDE VENTAS

**Capacidades de última milla que el Caso F ABSORBE de `Entrega` (que hoy NO tiene):**
- **COD** (cobro contra entrega · `cobroPendiente`/`montoRecaudado`/`metodoPagoRecibido`) → caja chica del courier.
- **Entregas parciales** (`numeroEntrega`/`totalEntregas`).
- **Foto/firma** de entrega · **motivo de fallo** (no_encontrado/ausente/rechazo/dañado/pago_rechazado).
- **Estados de reparto:** programada → en_camino → entregada / fallida / reprogramada.
- **Reprogramación** (`fechaProgramada`/`horaProgramada`).

**Disparo desde Ventas (patrón `confirmarOC()` replicado):** botón "Despachar" en el detalle de venta →
`despacharVenta()` crea el Envío Caso F en 'borrador' (desnormaliza cliente/dirección/unidades) → Ventas
REFLEJA el estado (espejo). Modal de disparo ágil (almacén + courier + flete auto + COD toggle), NO el wizard pesado.

**`Entrega` se deprecia:** su lógica de última milla migra al Caso F. Cero sistemas paralelos.

---

## 9 · MODALES (11 · cobertura total · Fase 3)

Despachar · Recepción (unidad×unidad · lotes/vencimiento · aduana) · Gestión Incidencias (3 sub-tabs:
Dañadas/Perdidas/Aduana) · Liberar Aduana · Edit Flete · Agregar Costo Landed · Finalizar Costos ·
Agregar Tanda · Resolver Reclamo (reembolso/reemplazo/merma) · **Despachar-desde-Venta** (NUEVO · el disparo) ·
ConfirmarSalidaWizard. Todos a FormModalV2 · mobile = bottom-sheet.

---

## 10 · WIZARDS (3 · cobertura total · Fase 5)

- **Nuevo envío unificado** (4 pasos · tipo inferido de origen+destino · borrador 2 capas).
- **Despacho venta F** (4 pasos: Venta · Picking · Detalles · Confirmar) — o reemplazado por el modal ágil del disparo.
- **Devolución G** (4 pasos).
Todos: WizardShell del kit (accent orange) + Borrador+Descartar (canon).

---

## 11 · LO QUE NO SE TOCA (motor)

Servicios (envio.crud, recepción, costos landed, sub-tandas, reclamos), tipos, estados, taxonomía A-J
(`deriveTipoRutaLogistica`), incidencias, reclamos, costos landed scope, tandas T1, feature flags. El
rework es de EXPERIENCIA (migración al Hub Kit + detalle adaptativo + absorción de última milla). Cualquier
cambio de lógica (absorción de `Entrega`, disparo desde Ventas) se declara e implementa con su propio diseño.

---

## 12 · PLAN DE MOCKUP · 5 FASES (cobertura total + mobile · DS-aligned orange)

| Fase | Cubre |
|---|---|
| **1** | Shell + **Resumen** (§A→§F) + **Operaciones** (listado A-J · cards · aside · empty/loading/error) + mobile |
| **2** | **Detalle adaptativo** · 9 tabs en sus perfiles (importación + despacho venta F + devolución G) + mobile |
| **3** | **11 modales** completos (incl. el disparo Despachar-desde-Venta) + mobile bottom-sheets |
| **4** | Tabs de gestión: **Incidencias · Reclamos · Costos · Rendimiento** (tabla+KPIs+filtros c/u) + mobile |
| **5** | **3 wizards** (unificado · F · G) paso por paso + borrador + mobile |

**Estado:** Fase 1 EN PRODUCCIÓN. Cada fase se valida antes de pasar a la siguiente (canon pixel-perfect).
