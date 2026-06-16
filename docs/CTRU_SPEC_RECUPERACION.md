# CTRU · Especificación integral del rework (Recuperación / Amortización)

> **Estado:** DRAFT para validación del usuario · 2026-06-16
> **Origen:** sesión de diagnóstico + co-diseño (ver memoria `ctru-vision-recuperacion.md`).
> **Regla:** esta spec precede al mockup, que precede al código (canon de mockups + pixel-perfect).
> **Bloqueo de validación numérica:** no hay data real de CTRU en dev/prod ("Sin datos de productos") → la verificación de números se difiere a cuando haya productos/gastos cargados.

---

## 0 · Identidad de CTRU (definida por el usuario)

CTRU **no es un catálogo de costo estático**. Es una herramienta de decisión con **3 patas que son UNA historia** — el ciclo de vida costo→precio→recuperación del producto:

1. **COSTO** — *"¿cuánto me cuesta de verdad este producto?"*
2. **PRECIO MÍNIMO** — *"¿a cuánto debería venderlo como mínimo?"* (deriva del costo)
3. **RECUPERACIÓN** — *"¿cuánto de lo invertido ya recuperé vendiendo, en el tiempo?"* (el **alma**)

Las 3 se ligan por la **contribución**: el precio fija la contribución por venta, y la contribución acumulada amortiza la base de costo.

**Distinción canónica vs los vecinos del clúster Análisis** (evita solape):
- **CTRU** = *"¿cuánto me costó y cuánto he recuperado?"* — lente temporal de amortización (eje = ventas acumuladas).
- **Cost Intelligence** = *"¿el costo está bien/mal y dónde está atrapado mi capital?"* — variance / TCPA / capital / forecast (eje = lote/etapa).
- **Reportes** = *"¿qué margen dio el período?"* — snapshot P&L.

---

## 1 · PATA COSTO — modelo adaptativo de componentes

### 1.1 · Principio raíz: CTRU AGREGA, no calcula
CTRU **no calcula** costos de traída — los **consume**. Cada fuente (Compras, Envíos, cada viajero con su lógica propia) entrega **componentes de costo ya resueltos** (monto + método de prorrateo). CTRU los **agrega de forma adaptativa**. La complejidad de *"cómo cobra cada quién"* vive en su dominio (Compras / Envíos / la tarifa del viajero), **no en CTRU**.

### 1.2 · El contrato `ComponenteCostoUnidad`
Reemplaza los 4 escalares fijos actuales (`costoUnitarioUSD`, `costoFleteUSD`, `costosLandedPEN`, `costoRecojoPEN`) y la interfaz rígida de 12 campos (`UnitCostLayers`). La unidad guarda una **lista extensible**:

```ts
interface ComponenteCostoUnidad {
  id: string;
  categoriaCostoId: string;       // → maestro dinámico CategoriaCosto (ya existe, editable en UI)
  categoriaCostoNombre: string;   // snapshot del nombre al momento
  origen: 'compra' | 'envio' | 'recojo';
  bloque: 'producto';             // todos son bloque producto (afectan CTRU)
  montoPEN: number;               // YA prorrateado a ESTA unidad (congelado)
  metodoProrrateo: MetodoProrrateo; // con qué método se repartió (trazabilidad)
}
```

- **`getCTRU(unidad)` = `Σ componentesCosto.montoPEN`** → firma intacta para los 10+ servicios que dependen de `getCTRU` (transversal · NO se toca su contrato; internamente suma una lista en vez de campos nombrados).
- Composición y reportes hacen **group-by `categoriaCostoId`** → se **auto-extienden** cuando aparece una categoría nueva, sin nuevos campos en el código.

### 1.3 · Catálogo de componentes (el build-up universal)
```
CTRU = Precio − Descuentos + Impuestos + Cargos compra + Σ Fletes + Aduana + Recojo/Consolidación
       (cada término prorrateado a la unidad por SU método)
```
| # | Componente | Origen | Método natural |
|---|---|---|---|
| 1 | Precio del producto | Compra | directo/unidad |
| 2 | Descuentos | Compra | a confirmar (hoy: solo por bloque, por valor) |
| 3 | Impuestos (sales tax por estado) | Compra | por valor |
| 4 | Cargos de compra (handling proveedor) | Compra | por unidad / peso |
| 5 | Flete proveedor → casilla | Envío | por peso (o incluido en precio) |
| 6 | Consolidación en casilla | Envío | fijo/unidad |
| 7 | Flete casilla → Lima (internacional) | Envío | tarifa del viajero (ver 1.5) |
| 8 | Aduana / internación | Envío/propio | **CONDICIONAL** · puede o no aplicar · responsabilidad del comprador |
| 9 | Recojo local (Lima) | Recojo | fijo/unidad **o** proporcional al peso (flexible) |

### 1.4 · Route-aware: la ruta siembra los componentes
El **tipo de ruta es el perfil** que determina QUÉ componentes existen y su método por defecto. Flags ya modelados: `modoEntregaDetallado` (`ddp_directo`/`via_viajero`/`via_courier`/`recojo_propio`), `quienPagaFlete`, `fleteIncluidoEnPrecio`/`esDDP`, `recojoEnOrigen`, `TipoEnvio` (`interna_origen`/`internacional_peru`).

- **Directo/postal** (lo que se nombró "DDP" informalmente): proveedor → Lima. El flete viene en el precio. **La aduana NUNCA viene incluida** — es del comprador y condicional. → componentes: precio (all-in) + aduana(cond.) + recojo.
- **Casilla intermedia** (viajero/courier): varios tramos. El flete casilla→Lima es un componente propio que se resuelve con la **tarifa del viajero**. → componentes 1–9 según aplique.

### 1.5 · La tarifa del viajero (cada uno con su lógica) — YA existe
Cada **colaborador/viajero** tiene su tarifa configurada (`TarifasColaborador.tarifaPorTramos: TramoPeso[]` · S52·D-11), incluido el **escalonado por tramos de peso** (cada tramo define `costoUnitario` USD según el peso del producto). El wizard de envíos la **auto-carga**. Modalidades de cobro: `flete_total`, `tarifa_unidad`, `por_producto`, `por_tramos` (escalonado).
- **CTRU es agnóstico a esta lógica**: el viajero/Envíos resuelve el monto; CTRU recibe el componente ya calculado con su método.
- Si un viajero tiene una lógica nueva que las 4 modalidades no cubren, **eso se mejora en Envíos**, no en CTRU.

### 1.6 · INMUTABILIDAD (regla de oro)
**Todo componente de costo se CONGELA en la unidad al momento de la transacción** (monto + método resueltos). La tarifa del viajero y los cargos de la OC son **plantillas de cálculo, no referencias vivas**. Cambiar una tarifa/cargo afecta **solo lo futuro** — el CTRU de una unidad histórica **nunca se recalcula** desde config mutable.
- Estado actual: ✅ el flete del viajero ya se congela (`costosLandedPEN` al recibir) · ⚠️ los **cargos de la OC NO se congelan** — se re-derivan de la OC en cada `fetchAll` (`ocCostBreakdownMap`) → **riesgo de que cambiar una OC vieja altere costos históricos**. El rework debe congelar TODO componente en la unidad.
- Opcional (auditoría, no integridad): versionar la tarifa del viajero con fechas de vigencia para responder *"¿qué tarifa aplicó a este envío?"*.

### 1.7 · Bugs a cerrar en el rework (descubiertos en la auditoría)
1. **Descuento de OC perdido**: se captura pero `ctruStore` nunca lee `efectivos.descuentos` → no baja el CTRU.
2. **`costoRecojoPEN` no cableado**: se captura en el modal de recepción pero `registrarRecepcion` lo ignora end-to-end.
3. **Dos CTRU divergentes**: `getCTRU` (snapshot) vs `getUnitCostLayers` (re-derivado) → unificar en UNA fuente (el snapshot de componentes).
4. **Prorrateo de Compras hardcodeado a "por valor"**: ignora el `metodoProrrateo` declarado → activarlo (que respete el método de cada cargo).
5. **`getCTRU` no suma `costoRecojoPEN`** pero `getCostoBasePEN` sí → alinear.

### 1.8 · Dos ejes de "¿qué valor, cuándo?" — lote + TC
El costo de un producto NO es un número único: varía por **(a) lote/origen** (qué viajero/casilla lo trajo · cada lote guarda su costo) y **(b) tipo de cambio** (el costo en PEN depende del TC: `tcCompra` / `tcPago` / **TCPA** del pool USD / TC de venta). Ambos ejes se **congelan** en la unidad. El catálogo muestra el **promedio ponderado**; el detalle muestra la variación por origen.
- **Convención de consumo al vender** (DECISIÓN): FIFO / promedio ponderado / lote específico — define qué costo aplica a cada venta (afecta el piso de precio y la curva de recuperación).
- **Convención de TC** (DECISIÓN): qué TC define el costo en PEN. Implicación FX: comprar a TC 3.70 y vender a 3.90 = ganancia/pérdida cambiaria (revaluación · dominio multi-moneda). El CTRU viejo ya tenía `tcCompra`/`tcPago` + `getCTRU_Real` (TCPA).

---

## 2 · PATA PRECIO MÍNIMO — pisos por canal y margen

Deriva del CTRU (pata 1). Ya existe parcialmente (`PricingProducto.precioMinimo10/20/30`). El rework lo hace **transparente y consciente del canal**:
- **Piso absoluto** (no perder en la unidad): `precio ≥ CTRU + costo de venta del canal`. Por debajo → se sangra en cada venta.
- **Piso con margen objetivo** (10/20/30%): precio que deja ese margen sobre el costo.
- **Consciente del canal**: vender en Mercado Libre (comisión ~13%) sube el piso vs venta directa — el costo de venta (bloque 'venta') cambia por canal. Reutiliza el `gvgdUnitario`/contribución de `useRentabilidadVentas`.

---

## 3 · PATA RECUPERACIÓN / AMORTIZACIÓN — el alma

### 3.1 · El modelo
Por producto, en el tiempo:
- **Base invertida** = Σ CTRU (pata 1) de las unidades del producto/lote.
- **Contribución por venta** = `precio − CTRU − costo de venta del canal` (reusar `useRentabilidadVentas` · NO crear un 3er motor de margen).
- **Curva de recuperación** = contribución **acumulada** (ordenada por fecha de venta) vs la base invertida.
- **% recuperado** = acumulado / base · **break-even** = fecha/unidad donde la curva cruza la base (de ahí en más, ganancia).

### 3.2 · Qué es computable HOY vs qué necesita decisión
- ✅ **La curva POR PRODUCTO es 100% computable hoy** sin dato nuevo (ventas fechadas + CTRU + costo de venta ya existen · `ventasDetalle`).
- ⚠️ **El overhead de periodo (gasto fijo del mes) por-producto NO es un dato, es una DECISIÓN** (regla de prorrateo). **MVP honesto** = mostrar el overhead como **línea agregada del negocio**, no atribuido por producto, hasta acordar una regla (por % de contribución / por unidades / etc.).
- Caveats: ventana de 6 meses (ampliable) · solo estados de venta activos (excluye canceladas/devueltas) · `fechaVenta` cae a `fechaCreacion` si falta.

### 3.3 · La utilidad REAL sale de las 3 cajas (no solo CTRU)
CTRU es la **caja 1 (producto)**. La utilidad real del negocio = **Ingresos − CTRU − Gastos de venta (caja venta) − Gasto fijo del mes (caja periodo)**.

> **CHANNEL-AWARE (no promediar):** la utilidad real por producto se abre **POR CANAL** (ML / directo / tienda), porque los gastos de venta son **canal-específicos** (comisión ML 13% vs comisión vendedor 5% vs 0). Promediar oculta que un producto puede **perder en ML y ganar en tienda**. Cada venta ya guarda su canal + comisión → group-by canal. Mismo principio para el **desglose de costos ocultos por producto** (no solo del negocio): se abre por categoría Y por canal.
 La Recuperación **ya usa las 3** (la contribución descuenta la caja venta · el overhead de periodo es la base a recuperar) — el final de la curva *es* la utilidad real. La **Resumen muestra el bottom-line de 3 cajas** ("Utilidad real del período": ingresos → margen bruto → margen contribución → utilidad operativa) como contexto, **sin duplicar** el P&L formal (que vive en Contabilidad/Reportes · canon no-redundancia). ⚠️ Depende de la capa analítica de gastos por bloque (hoy incompleta · bug gastos=0 · modelo muerto) → se completa en la **fundación** (Fase 2 de la secuencia).

---

## 4 · Reglas duras del rework

- ✅ **Reusar** (NO reinventar): `ctru.utils.getCTRU` (transversal · contrato intacto), `useRentabilidadVentas` (contribución), el maestro `CategoriaCosto` (extensible en UI), los conceptos de Envíos (`tarifaPorTramos`, modalidades, `costosLanded`, `prorratearCosto`), `prorratearCargosOC`.
- ❌ **NO reintroducir** la capa 6 GA/GO (Acuerdo 3 · `calcularGAGOProporcional`→0 a propósito). El overhead vive como caja periodo separada, jamás prorrateado al CTRU unitario.
- ❌ **NO crear un 3er motor de margen** (ya hay `getCTRU` + `useRentabilidadVentas`).
- ❌ **NO re-derivar** costo desde config mutable (inmutabilidad · §1.6).
- ✅ Todo sobre el modelo de **3 cajas** (producto/venta/periodo · `categoriaCosto.types`), NO sobre GA/GO/GV/GD (taxonomía muerta).
- ✅ Anatomía **Hub Kit** + color **indigo** (grupo Análisis). Hoy CTRU usa `PageShell` legacy.

---

## 5 · DECISIONES PENDIENTES (del usuario, antes del mockup)

1. **🏠 Arquitectura / hogar** (la grande): ¿CTRU **sobrevive como módulo propio** (re-concebido como Recuperación, mi recomendación) **o se funde en Cost Intelligence** como workspace (plan previo `vision-s3.6`)? Define la anatomía del módulo. *(El user eligió "mapear el clúster" → mapa entregado; falta el veredicto final.)*
2. ✅ **Overhead de periodo** (RESUELTO): se **prorratea por % de ventas** para la **Utilidad real por producto** (tab dedicada, lente de absorción) · se mantiene **agregado** para la base de Recuperación. **NO toca el CTRU** (que queda limpio para pricing · Acuerdo 3). → 5ª tab "Utilidad real" en el hub.
3. **Métodos por defecto** de los componentes de costo (§1.3): confirmar/ajustar. Sobre todo: ¿descuento por SKU individual (hoy solo por bloque)?
4. **Granularidad de la recuperación**: ¿por producto, por lote/OC, por línea de negocio, o global?
5. **Base a recuperar**: ¿solo unidades activas (capital aún atrapado) o todo el lote comprado (incluye vendidas)?
6. **Escenarios de ruta faltantes**: courier vs viajero, importación marítima/aérea, compra local en Perú (sin flete internacional).
7. **"Por vitamina"**: confirmar si es `tarifa_unidad` (por ítem) u otra lógica de viajero.
8. ✅ **Consumo del costo al vender** (recomendación adoptada): **FIFO** (la unidad más vieja primero · calza con el flujo físico y hace la curva de recuperación precisa por lote).
9. ✅ **Convención de TC** (recomendación adoptada): costo histórico = **TC pagado** (`tcPago`) congelado · vista real/gerencial = **TCPA** · la diferencia entre ambos = ganancia/pérdida cambiaria (FX).

> **Estructura final del hub (HÍBRIDO "por decisión" · v2 · elegido 2026-06-16):** tabs re-encuadradas por la DECISIÓN que resuelven, no por tipo de dato:
> - **Resumen · "¿Qué decido hoy?"** — cola de atención (productos que requieren acción) + utilidad real 3 cajas + tabla comparativa por producto.
> - **"¿A cuánto vendo?"** — precio mínimo (pisos por canal/margen).
> - **"¿Qué repongo / corto?"** — utilidad real + recuperación fusionadas (veredicto keep-kill) + comparación por canal.
> - **"¿Dónde se va la plata?"** — costo (componentes adaptativos) + costos ocultos desglosados + variación por origen.
>
> Click en producto → **MINI-DOSSIER**: signos vitales sticky (CTRU/piso/utilidad real/recuperado/mejor canal) + secciones colapsables ordenadas por decisión, **cada una cierra en una acción sugerida** (copiloto, no tablero). Mockup: `docs/mockups/ctru-recuperacion-hub-v2.html`. (Modelo D triage descartado por catálogo chico + umbrales sin acordar; su cola-de-atención se rescató en el Resumen.)

---

## 6 · Secuencia de implementación (post-validación)

1. **Fundación · modelo de costo adaptativo**: contrato `ComponenteCostoUnidad` + congelar componentes en la unidad + `getCTRU` suma lista + unificar write-paths + cerrar los 5 bugs (§1.7). *(Toca `getCTRU` transversal · alto cuidado · validar con data real.)*
2. **Capa analítica 3 cajas**: historial de gastos por bloque (no GA/GO/GV/GD) — comparte raíz con el rework de Proyección.
3. **Pata Precio mínimo**: pisos por canal/margen sobre el CTRU nuevo.
4. **Pata Recuperación**: curva por producto (MVP) + overhead agregado.
5. **Visual**: mockup Hub Kit (indigo) de las 3 patas → implementación pixel-perfect.

> Ya ejecutado: Fase 1 del fix del motor (pasar el árbol de categorías · commit `ee1ef82`).

---

## 7 · Anexo · estado actual a descartar/preservar

- **Preservar** (base del tracker): capas 1-5 landed (`getUnitCostLayers`), `ventasDetalle` por producto, inventario, lotes por OC, pricing floors, `getCTRU` limpio.
- **Descartar**: capa 6 GA/GO (neutralizada a 0), toggle Contable/Gerencial (no-op), `costoTotalRealProm` (promedio estático), `processHistorialGastos` GA/GO/GV/GD, labels "Capas 1-6/1-7".

---

## 8 · Implementación de la fundación (ejecutada 2026-06-16 · rama `envios-absorcion-entrega`)

La **Fase 1 (Fundación · modelo de costo adaptativo)** del §6 se implementó en 9 pasos, todos con gate `tsc 0` + tests (`vitest`):

| Pasos | Qué | Commit |
|---|---|---|
| 1-2 | `ctru.types.ts` (`ComponenteCostoUnidad` + ámbito `'envio'\|'etapa'`) · campo `componentesCosto?` en `Unidad` · `getCTRU/getCostoBasePEN/getCTRU_Real` suman la lista con **fallback** a escalares · invariante de paridad `getCTRU===getCostoBasePEN` | `85e8f39` |
| 3 | builder `costoComponentes.builder.ts` · congelar componentes en `registrarRecepcion` con prorrateo **por ámbito** (scope='envio'→todas con denominador estable · scope='tanda'→solo esa tanda) · guard `costosLanded>0` eliminado | `92bef1f` |
| 4-6 | `aplicarRecojoEnOrigen` reusa el builder (2ª copia divergente eliminada) · `costoRecojoPEN` como componente de etapa (BUG-2) · `recalcularCTRUDinamico` compara contra `getCTRU` (NEW-1) | `35edbe5` |
| 7-8 | `getUnitCostLayers` deriva total de `getCTRU` + capas de componentes, deja de re-derivar de la OC viva (BUG-1+BUG-3 · §1.6 inmutabilidad) · `heredarCargos` propaga el `metodoProrrateo` real (BUG-4) | _(pendiente commit)_ |

### Regla de **corte / backfill** (protege el fallback · NO remover sin esto)

`getCTRU` (y `getCostoBasePEN`/`getCTRU_Real`) tienen una **rama de fallback a escalares** (`ctruInicial`/`ctruDinamico`/`costoUnitarioUSD*tc`/`costosLandedPEN`) que se ejecuta cuando la unidad **no** tiene `componentesCosto[]`. Esta rama es **OBLIGATORIA de transición**:

- Ningún doc histórico en Firestore tiene `componentesCosto[]` todavía → un `getCTRU = Σ componentes` puro devolvería **0** para todo el inventario existente.
- Las unidades **nuevas** (recibidas/recojo post-fundación) sí nacen con `componentesCosto[]` y usan la rama Prioridad-0.
- Los escalares `ctruInicial/ctruDinamico/ctruContable/ctruGerencial` quedan como **legacy-de-lectura** (se siguen escribiendo en paralelo = doble escritura transicional, coherentes con Σ componentes).

**No se elimina la rama escalar de `getCTRU` hasta** que un script de backfill (futuro · fuera de esta fundación) pueble `componentesCosto[]` en los docs históricos y se confirme que el 100% de las unidades activas lo tienen. Hasta entonces, el fallback es la red que evita romper el inventario existente. Sin data real hoy (dev/prod = "Sin datos de productos") el backfill no corre — solo queda el contrato documentado.
