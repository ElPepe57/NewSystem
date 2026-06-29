# Plan integral · Evolución del módulo COMPRAS (Fase C)

> Declarado 2026-06-28 · disparado por: "abarca todo lo que sea necesario para trabajar la sección".
> Objetivo: subir el módulo Compras COMPLETO (hub + detalle de OC + capa de excepciones/riesgo)
> al nivel de inteligencia y claridad del sistema actual — surfaceando lo que el sistema ya sabe,
> cerrando el loop de lo que está construido-pero-atrapado, y agregando las capacidades de una
> función de compras madura que faltan. **Honestidad: nunca inventar data; rotular EXISTE/PARCIAL/FALTA.**

## Estado del discovery (HECHO)

4 análisis 360 (workflows · verificados en código):
1. Detalle de OC · data + presentación → mejoras A1-A9 / B1-B7.
2. Hub · data + presentación → mejoras A1-A10 / B1-B6 (+ 2 bugs de honestidad).
3. Hub · capacidades faltantes (unhappy path) → C1-C6 + N1-N11.

2 mockups de especificación (pendiente validación visual M4 del usuario):
- `docs/mockups/detalle-oc-fase-c-v1.html` — detalle de OC evolucionado (drill full-page · 7 tabs · Vista general · Plan-vs-Real · etc.).
- `docs/mockups/compras-hub-evolucion-v1.html` — dashboard del hub evolucionado (2 bugs corregidos · pipeline de abastecimiento · calendario de caja · cola de firmas · etc.).

## Los 3 hallazgos de fondo (el porqué del rework)

1. **El detalle de OC era un fósil** — construido cuando era "referencia canónica S54.x" (abr), hoy DEROGADO. El sistema creció (origen/demanda, medición, cobertura, CTRU) y el DS maduró (Hub Kit, §A-F). Sabe MENOS y muestra PEOR de lo que el sistema ya puede.
2. **El hub está casi bien** (estructura DS lista · dashboard §A-F sólido) pero tiene **2 bugs de honestidad** + inteligencia de sección sin agregar.
3. **El modelo de excepciones EXISTE pero está atrapado** en el detalle de UNA OC, es retrospectivo, no cierra el loop financiero, y tiene un **scoring que MIENTE** (riesgo de proveedor hardcoded 0/10). La mayor parte del valor del unhappy-path NO es greenfield: es cerrar el loop de algo ya construido.

## Plan por fases (sizing honesto · dependencias)

### FASE 0 · Bugs de honestidad (el ERP miente · código · sin mockup · URGENTE)
- **Hub A1** · "Comprado mes" suma TODO el histórico (no el mes) → usar `tendencia.actual` (valor Y conteo). `ordenCompra.stats.service.ts:14-52`.
- **Hub A2** · el strip ignora el filtro de Línea de Negocio (las tabs lo respetan) → recomputar sobre `ordenesLN`.
- **C6** · `calcularIncidencias()` devuelve `[]` siempre + `riesgoIncidencia` hardcoded a `10` → el riesgo de proveedor muestra 0 falso. Conectar a `incidenciasOC` real. `proveedor.analytics.service.ts:592,650`.
- Tamaño: ADD chico. Sin dependencias. **Hacer primero** (rompe la confianza del dashboard).

### FASE 1 · Tab "Llegadas" (torre de control logística de la OC) — ⚠️ CORREGIDO 2026-06-29 (análisis de IA del hub)
> **Corrección clave:** la propuesta original "tab Excepciones/Riesgo" CLONABA Envíos (incidencias/reclamos/capital/pérdidas YA tienen dueño ahí · viola no-redundancia + fronteras de funcionalidad). El análisis de IA lo descartó. La 6ª tab correcta es **"Llegadas"**: el seguimiento logístico de la OC (verbo del user: *vigilar/empujar mi pedido*) — lo único genuinamente nuevo de Compras. Lo demás se **CROSS-LINKEA, no se clona**. El user pidió ver el cross-link en mockup (`compras-llegadas-v1.html`, REEMPLAZA a `compras-excepciones-riesgo-v1.html` que queda superado).
- Habilitador: `incidenciaOC.service.listAll` (~10 líneas · hoy solo `subscribeByOC`) — para los COUNTS del teaser + el scoring C6.
- **C3** · Radar de atrasados en vuelo OPERABLE (gravedad graduada · `diasEnVuelo = hoy − fechaSalida` vs lead-time · última señal con/mudo · acción "empujar proveedor"). Eleva lo enterrado en Resumen §F. *Es lo propio de Compras.* ADD chico/medio.
- **N1** · Capital en tránsito + **Unidades por llegar** (LECTURA · cross-link a Envíos/Finanzas y a Stock).
- **Teaser read-only** "N incidencias · N reclamos $X" → cross-link a Envíos (NO clona el CRUD).
- **C6** · arreglar el scoring de proveedor que miente (usa la agregación de incidencias · vive en la tab Proveedores).
- **Términos de proveedor** (lead-time · plazo de pago · MOQ) = CAMPOS en la ficha Proveedor (no tab).
- **Cross-link, NO clonar:** incidencias/reclamos/pérdidas/recepción + el setter `marcarEnvioPerdidoTotal` (C2) + el campo última-señal (C4) → todo Envíos · pagos → Tesorería. Llegadas SURFACEA y LINKEA, Envíos OPERA.
- Tamaño: ADD chico/medio · alto valor.

### FASE 2 · Rework del detalle de OC (la hoja · mockup ya validado)
- Drill full-page (sale del Modal v1) + 7 tabs + tab "Vista general" (ex "Resumen" · renombrada por el choque de nombres con el Resumen de sección) + data evolucionada (A1 origen · A2 Plan-vs-Real · A3 recepción real por-SKU · etc.) + modales internos → FormModalV2 + Confirmar-con-sub-órdenes como step del drill.
- Tamaño: BUILD grande (el centerpiece). Algunos datos requieren cableado (A2 escribir expectativa en el wizard · A3 agregación de envíos · B3 precio de venta).

### FASE 3 · Evolución del dashboard del hub (la raíz · mockup ya validado)
- Pipeline de abastecimiento (B2) · calendario de caja (A4) · cola de firmas de socio (A3) · donut clickable (B1) · concentración×riesgo (A7) · scorecard SLA (A5) · incidencias agregadas (A6) · cross-links con cifras · tendencia a línea.
- Tamaño: ADD medio (la estructura ya está · es contenido). A4/A5/A6 comparten el cableado de la Fase 1.

### FASE 4 · Builds financieros (acoplados a deudas declaradas · el escalón profundo)
- **C1** · Pérdida del EFECTIVO ya pagado (estado `perdida` ≠ `cancelada` + tipo de gasto `merma_compra` + write-off del monto pagado). **Acoplado a la deuda F3b de tesorería** (reversa de pago al cancelar OC paga). NO hacer aislado.
- **N3** · Re-prorrateo del costo perdido sobre los survivors (las unidades buenas absorben el flete de las perdidas → CTRU subvaluado). **Acoplado al seam ③ de CTRU** (audit 360). Hacer con el rework de costo.
- Tamaño: BUILD grande · financiero. Requiere diseño del flujo de pérdida (mockup) + cerrar las deudas acopladas.

### FASE 5 · Nice-to-haves de valor (incremental)
- N4 tope de gasto mensual con semáforo · N5 auto-scorecard de proveedor (SRM desde datos vivos) · N7 comparador de cotizaciones pre-compra (RFQ) · N9 SLA lead-time + términos de pago en el maestro de Proveedor (habilitador de C3/N5) · N6 retención de pago transaccional (que bloquee el pago real) · N8 alerta proactiva precio/FX · N2 cloud function de escalamiento (push, no pull).

## Deudas acopladas (de MEMORY · no parchear alrededor)
- **F3b** (reversa de pago al cancelar OC paga) ← bloquea C1.
- **Seam ③ de CTRU** (`heredarCargos` congela leyendo solo arrays v2 · OCBuilder genera legacy) ← bloquea N3 + el landed agregado.
- **Unificar cotización** (cotizaciones en colección aparte) ← la deuda reservas-venta de Requerimientos.

## Falta mockear (especificación)
- La tab **"Llegadas"** del hub (C3 radar operable + capital/unidades cross-link + teaser read-only → Envíos) — EN PROGRESO (`compras-llegadas-v1.html` · REEMPLAZA `compras-excepciones-riesgo-v1.html`, superado por clonar Envíos).
- El **flujo de pérdida del efectivo** (C1) — antes de la Fase 4.

## Secuencia recomendada
**Fase 0 (bugs · ✅ A1/A2 desplegado · C6→F1) → mockear tab Llegadas (en progreso) → Fase 1 (Llegadas + C6 + campos de proveedor) → Fase 2 (detalle OC) → Fase 3 (hub dashboard) → Fase 4 (financieros, con sus deudas) → Fase 5 (nice-to-haves).**
Es un programa multi-sesión. Fase 0 es inmediata y barata. Las Fases 2-3 ya tienen su mockup validado. Las Fases 1 y 4 necesitan mockup primero. Cada fase: verificar (tsc + build) + desplegar + validación visual M4 del usuario.

---

## Sub-programa · SCORECARD DE PROVEEDOR/VIAJERO (Fase 1 ampliada · redefinido 2026-06-29)

El user redefinió "términos de proveedor": NO campos fijos (plazo de pago / MOQ son variables · no encasillan) sino **MÉTRICAS medidas**. Lo que importa: las **2 piernas de entrega** (proveedor + viajero · dueños distintos), el **impacto en caja** (matiz privado: todo con tarjeta → el cash sale en el ciclo, no en la compra), la **responsabilidad por pérdidas**, + otras.

**Hallazgo estructural (4 análisis 360 + grounding en Envíos):** el documento dueño de la responsabilidad por pierna es el **ENVÍO**, no la OC → agregar por `origenProveedorId` (pierna A) + `colaboradorId` (pierna B). `ReclamosDeEntidadTab` es el **embrión** del scorecard (ya pullea por `destinatarioId`).

**3 hallazgos que mandan:**
1. La **fecha-bisagra ya existe** (`SubEnvioT1.fechaEntrega`) pero **T1 y T2 son 2 `Envio` SIN FK que los una** (`crearEnvioT2` no guarda `ordenCompraId`) → cadena end-to-end NO reconstruible hasta cerrar ese seam. Nunca asumir 1 OC = 1 envío (`getByOrdenCompra`, jamás `[0]`).
2. **BUG doble-fuente-de-tiempo** (mismo patrón que el Seam ③ de CTRU): `proveedor.analytics` calcula lead-time a nivel OC (`fechaRecibida−fechaEnviada` · ignora sub-órdenes/tandas) mientras el radar usa fechas del Envío → el scorecard DEBE consolidar sobre Envíos y DEPRECAR el OC-level.
3. **No hay política/SLA** — solo histórico (el "2-8 semanas" es texto hardcoded). La capa de política es greenfield.

**OLAS (derivable-primero · principio: cerrar el DATO antes que la PRESENTACIÓN):**
- ✅ **Ola 0 DESPLEGADA (`97544ba`):** tasa de recuperación (cobrado/reclamado · color de calidad) + distribución resolución (reembolso/reemplazo/merma) por entidad en `ReclamosDeEntidadTab` · cero schema · surfacea por proveedor + viajero.
- **Ola 1:** Pierna B (viajero) puntualidad + lead-time por `colaboradorId` (`diasEnTransito` ya existe · `TabRendimiento` agrupa por nombre no id → cambiar la clave). Derivable.
- **Ola 2:** Pierna A (proveedor) lead-time ponderado por unidades (`SubEnvioT1.fechaEntrega`) · consolidar en Envíos · DEPRECAR el OC-level de `proveedor.analytics`. Derivable c/tandas.
- **Ola 3 (cerrar 3 seams de DATO):** (3a) FK T1↔T2 en `crearEnvioT2` · (3b) `responsable` en captura de incidencia (hoy sesgado a `sin_responsable`) · (3c) `destinatario` derivado del `responsable` (extraer `mapResponsableToDestinatario` de `ReclamoPanel.tsx:96` a un helper de dominio).
- **Ola 4:** integridad por pierna (faltantes/dañadas proveedor vs viajero · depende de 3b) + **política declarada** (`Proveedor.responsabilidadPerdidas` · contraste declarado-vs-real). 🔴 dato nuevo.
- **Ola 5:** end-to-end OC→Perú (depende de 3a) + **impacto en caja con tarjeta** (wiring OC→`CargoTarjeta` · el modelo de diferimiento existe pero desconectado · bifurcación UX "¿caja hoy o tarjeta?"). 🔴 toca el flujo de pago.

**Solo 3 datos nuevos en todo el sub-programa:** fecha-bisagra (Ola 3a · ya existe en sub-envíos) · `Proveedor.responsabilidadPerdidas` (Ola 4) · re-flete del reemplazo (diferido). Todo lo demás es plomería. Dónde surfacea: ficha Proveedor (scorecard) · ficha Viajero · radar Llegadas (dual baseline) · detalle OC.
