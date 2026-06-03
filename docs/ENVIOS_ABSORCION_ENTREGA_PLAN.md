# ENVÍOS · ABSORCIÓN DE `Entrega` EN `Envio` (Camino A · absorción profunda)

> **Decisión del usuario (2026-06-03):** unificar el modelo logístico en UN solo modelo.
> La entidad `Entrega` (motor de última milla) se **absorbe** dentro de `Envio` (Caso F).
> Envíos pasa a ser el dueño absoluto de la logística; Ventas solo **dispara + refleja**.
>
> El usuario eligió la absorción profunda conscientemente, entendiendo el costo/riesgo
> (vs el Camino C "hub que muestra ambas"), por la pulcritud del modelo único.

---

## 1 · DIAGNÓSTICO TÉCNICO (4 frentes · 2026-06-03)

### `Entrega` NO es un sistema viejo simple — es el MOTOR de última milla
- **`entrega.service.ts` · 1464 líneas.** Hace TODO lo de la última milla:
  sincroniza estado de Venta (`en_entrega→despachada→entregada`), genera el **Gasto de
  Distribución (GD)**, registra el **COD → pago en Venta + tesorería**, actualiza
  **métricas del transportista**, reclasifica anticipos, recalcula CTRU, maneja
  **parciales/fallidas/reprogramadas**, genera PDFs (guía/cargo), realtime.
- **Consumidores:** Ventas.tsx · VentaCard · EntregasVenta · ProgramarEntregaModal ·
  **DespachoML (Mercado Libre)** · pdf.service · movimiento-transportista.service ·
  venta.recalculo.service · entregaStore · venta.entregas.service.
- **~1000+ documentos** en colección `entregas` (producción).

### `Envio` Caso F es simple y le FALTA casi todo
`crearEnvioF()` crea el envío en `'borrador'` y vincula unidades. **Gaps vs Entrega:**
1. ❌ NO sincroniza el estado de la Venta.
2. ❌ NO genera Gasto de Distribución (tiene `costosPEN[]` pero no crea GD).
3. ❌ NO soporta cobro COD en destino.
4. ❌ NO soporta estados de última milla (programada/en_camino/entregada/fallida/reprogramada).
5. ❌ NO actualiza métricas del transportista.
6. ❌ NO reclasifica anticipos ni recalcula CTRU al entregar.

### La caja recaudadora SÍ está implementada (buena noticia)
`ProductoFinanciero` tipo `caja_recaudadora` + `cajaRecaudadora.service` + eventos
(`EventoServicioRecaudador`) existen y funcionan. **Falta solo el cable:** cuando el COD
lo recauda un courier-recaudador, disparar `cajaRecaudadoraService.registrarCobroEntrante()`.
(La liquidación tiene TODOs de tesorería/CC/asiento — F6/S2, aparte.)

### El patrón de disparo (a replicar)
`confirmarOC()` (Compras) crea unidades + Envío `'borrador'` automáticamente (WriteBatch),
desnormaliza datos, hereda cargos. `despacharVenta()` replica esta forma con datos de la Venta.

---

## 2 · GAP DE MODELO · campos de última milla a sumar a `Envio` (del diagnóstico)

**Estados** — extender `EstadoEnvio` (enum unión · Opción A): + `programada` · `en_camino` ·
`entregada` · `fallida` · `reprogramada` (ya existe `cancelada`). ⚠️ Auditar todos los
`switch`/match sobre `EstadoEnvio` antes (riesgo de casos sin manejar).

**Campos** (todos opcionales · retrocompatibles):
- **Parciales:** `numeroEntrega?` · `totalEntregas?`
- **Cobro COD:** `cobroPendiente?` · `montoPorCobrar?` · `metodoPagoEsperado?` ·
  `cobroRealizado?` · `montoRecaudado?` · `metodoPagoRecibido?` · `referenciaCobroId?`
- **Fallo:** `motivoFallo?` · `descripcionFallo?`
- **Programación:** `horaProgramada?` · `tiempoEntregaMinutos?`
- **Cliente extra:** `destinoClienteEmail?` · `destinoClienteProvincia?` ·
  `destinoClienteCodigoPostal?` · `destinoClienteReferencia?` · `destinoCoordenadas?`
- **Confirmaciones:** `fotoEntrega?` · `firmaCliente?` · `notasEntregaDetalles?`
- **Documentos:** `pdfGuiaTransportista?` · `pdfCargoCliente?`
- **Delivery:** `gastoDeliveryId?` · `costoDeliveryPEN?`
  ⚠️ **GD legacy eliminado (chk5.A15 · confirmado por el usuario 2026-06-03):** el flete del
  despacho NO es un "Gasto de Distribución / gasto_distribucion" (categoría borrada). Se registra
  como **`Gasto` tipo `'delivery'`** (bloque venta · `categoriaCostoId` "Distribución/Delivery
  local" del árbol · `impactaCTRU:false` · vinculado a `ventaId` · reduce `gastosVentaPEN`). En A2
  el servicio crea un gasto tipo `delivery`, NO replica GD. (La función `crearGastoDistribucion()`
  conserva el nombre legacy pero ya hace esto — renombrarla es limpieza opcional de A2.)
- **Transportista (tipado):** `tipoTransportista?` · `courierExterno?` · `telefonoTransportista?`

**Ya existen en Envio (sirven al Caso F):** `destinoClienteNombre/Direccion/Distrito/Telefono`,
`ventaId/ventaNumero`, `colaboradorId/Nombre/Tipo`, `numeroTracking`, `courier`,
`fechaSalida/LlegadaEstimada/LlegadaReal`, `costoFleteTotal`, `incidencias`, `notas`.

---

## 3 · PLAN DE FASES (orden seguro · de menor a mayor riesgo)

| Fase | Qué | Riesgo |
|---|---|---|
| **A0 · Auditoría EstadoEnvio** | Mapear TODOS los switch/match sobre `EstadoEnvio` (para extender el enum sin romper la UI). | 🟢 read-only |
| **A1 · Modelo/tipos** | Sumar los campos de última milla a `envio.types.ts` + extender `EstadoEnvio` + manejar nuevos casos en los switches auditados. `tsc` verde. | 🟢 bajo (campos opcionales) |
| **A2 · Servicio de despacho** | Portar la lógica de `entrega.service` a `envio.despacho.service`: `despacharVenta()` (crea F + sincroniza venta) · `marcarEnCaminoEnvio()` (+GD) · `registrarEntregaEnvio()` (entregada/fallida/reprogramada + COD + GD + métricas + anticipos + CTRU) · cancelar/corregir · **cable COD→cajaRecaudadora**. | 🔴 alto (corazón financiero) |
| **A3 · Migración de datos** | Script idempotente `entregas → envios` (destinoTipo=cliente · mapeo completo) + verificación de integridad. Coexistencia durante transición. | 🔴 alto (datos reales) |
| **A4 · UI Ventas (disparo + espejo)** | Quitar `ProgramarEntregaModal` de Ventas → botón "Despachar" dispara a Envíos. `EntregasVenta` lee de envios (espejo). `DespachoML` (Mercado Libre) usa el nuevo flujo. | 🟠 medio |
| **A5 · Rework visual Envíos** | Las 5 fases de mockups sobre el modelo unificado (shell+Resumen+Operaciones · detalle adaptativo perfil F lee Envio · modales · tabs · wizards). | 🟠 medio |
| **A6 · Deprecar `Entrega`** | Tras migrar + verificar: deprecar `entrega.service` · `entregaStore` · `venta.entregas.service` · `entrega.types`. | 🟠 medio |

---

## 4 · RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|---|---|
| Reescribir lógica financiera crítica (cobros/GD/tesorería) | Portar 1:1 verificando contra el original · tests · revisión code-logic-analyst + accounting-manager |
| Extender `EstadoEnvio` rompe switches existentes | Auditoría A0 previa · manejar cada caso nuevo · `tsc` exhaustivo |
| Migración pierde/duplica datos | Script idempotente · dry-run · verificación de conteos · backup |
| DespachoML (Mercado Libre) se rompe | Migrar su flujo explícitamente en A4 · probar el escaneo |
| Coexistencia durante transición | Mantener `Entrega` viva hasta A6 · feature flag si hace falta |

---

## 5 · ESTADO

- ✅ Diagnóstico técnico (4 frentes) · decisión Camino A.
- ✅ Mockups visuales (5 fases · cobertura total) — guía del rework visual (A5).
- ⏳ **EN CURSO:** A0 (auditoría EstadoEnvio) → A1 (modelo/tipos).

Los mockups de las 5 fases siguen siendo la guía visual; lo que A1-A4 hacen es preparar
el MODELO sobre el que A5 (rework visual) opera. La experiencia final es la de los mockups.
