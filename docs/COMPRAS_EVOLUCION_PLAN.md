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

### FASE 1 · Cerrar el modelo de excepciones (surfacear lo atrapado · el pedido explícito del user)
- Habilitador: `incidenciaOC.service.listAll/subscribeAll` (~10 líneas · hoy solo `subscribeByOC`).
- **C5** · Tab "Excepciones / Riesgo" en el hub (incidencias cross-OC + atrasados + reclamos + plata en disputa, por impacto USD).
- **C3** · Radar de atrasados en vuelo (gravedad graduada por lead-time aprendido del proveedor · `diasEnVuelo = hoy − fechaSalida` · NO depende de ETA). ADD chico.
- **N1** · Capital en tránsito (Σ `totalUSD` de OCs en curso no recibidas · "USD en el aire"). ADD chico.
- **C2** · Setter `marcarEnvioPerdidoTotal` (el estado `perdida_total` existe sin verbo · dispara reclamo + libera reservas). ADD medio.
- **C4** · "Atrasado con señal" vs "mudo" (campo última-señal + regla · puente delay→pérdida). ADD medio.
- Tamaño: ADD chico/medio · alto valor. **Requiere mockear la tab Excepciones/Riesgo primero.**

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
- La tab **"Excepciones / Riesgo"** del hub (C5 + C3 + N1) — antes de la Fase 1.
- El **flujo de pérdida del efectivo** (C1) — antes de la Fase 4.

## Secuencia recomendada
**Fase 0 (bugs) → mockear tab Excepciones → Fase 1 (excepciones) → Fase 2 (detalle OC) → Fase 3 (hub dashboard) → Fase 4 (financieros, con sus deudas) → Fase 5 (nice-to-haves).**
Es un programa multi-sesión. Fase 0 es inmediata y barata. Las Fases 2-3 ya tienen su mockup validado. Las Fases 1 y 4 necesitan mockup primero. Cada fase: verificar (tsc + build) + desplegar + validación visual M4 del usuario.
