# AUDITORÍA 360 — Integración Módulo Compras con el Sistema
**Fecha:** 2026-04-13 | **Sesión:** S36 | **Agentes:** 4 en paralelo

---

## CRÍTICOS (bloquean integridad de datos)

### BUG-005: Pago sub-orden bypass completo del servicio financiero
**Archivo:** `OrdenCompraCard.tsx:88-90`
`handleSubOrdenAction('pagado')` hace updateDoc directo en Firestore. NO pasa por registrarPago, NO crea movimiento en Tesorería, NO registra en Pool USD, NO añade a historialPagos.
**Fix:** Eliminar case 'pagado' de handleSubOrdenAction. Ya existe onPagarSubOrden que abre el modal correcto.

### REC-001: Guard anti-dup consume unidades de OTRAS sub-órdenes
**Archivo:** `ordenCompra.recepcion.service.ts:157-169`
Query busca `where('ordenCompraId', '==', id)` sin filtrar por subOrdenId. Al recibir sub-orden A, puede consumir unidades de sub-orden B.
**Fix:** Agregar `where('subOrdenId', '==', subOrdenId)` cuando subOrdenId está definido.

### BUG-004-ENV: Unidades faltantes pasan a 'disponible' (stock fantasma)
**Archivo:** `envio.recepcion.service.ts:225`
`ur.recibida === false && ur.perdida === false` → estado `'disponible'`. Debería ser `'en_transito'` (faltante, puede llegar después).
**Fix:** Cambiar a `const estadoNuevo = ur.perdida ? 'perdida' : 'en_transito';`

### ~~P1: Doble vía de recepción~~ RECLASIFICADO — NO ES BUG
Son dos recepciones diferentes para dos tramos diferentes:
- `recibirOrdenParcial()` = proveedor entregó en casilla (recepción OC)
- `registrarRecepcion()` = productos llegaron de casilla a Perú (recepción envío)
No hay conflicto. La arquitectura es correcta.

---

## MEDIOS (deberían corregirse pronto)

### BUG-002-PAG: estadoPago OC calculado dos veces con lógicas distintas
**Archivo:** `ordenCompra.pagos.service.ts:97-134`
Primera derivación: totalUSD vs historial. Segunda: desde sub-órdenes. Pueden contradecirse.
**Fix:** Con sub-órdenes, usar SOLO derivación desde sub-órdenes.

### BUG-004-PAG: Sub-orden sin estado 'parcial' en pago
**Archivo:** `ordenCompra.types.ts:504`
Solo acepta `'pendiente' | 'pagado'`. Si se paga $50 de $100, queda como 'pendiente'.
**Fix:** Ampliar a `'pendiente' | 'parcial' | 'pagado'`.

### BUG-001-PAG: subOrdenId no está en tipo PagoOrdenCompra
**Archivo:** `ordenCompra.pagos.service.ts:94`
Se agrega con cast `as any`. Filtros en UI también usan cast.
**Fix:** Agregar `subOrdenId?: string` al tipo PagoOrdenCompra.

### DATA-001: Modal pago OC completa excluye pagos de sub-órdenes
**Archivo:** `OrdenesCompra.tsx:995-999`
Filtro `!(p as any).subOrdenId` excluye pagos ya hechos por sub-orden. Pendiente inflado.
**Fix:** Para pago OC completa, no filtrar por subOrdenId.

### REC-002: Transición pedida→reservada pierde requerimientoId
**Archivo:** `ordenCompra.recepcion.service.ts:229-243`
El batch update no escribe requerimientoId. El fallback crearLote sí lo hace.
**Fix:** Agregar `requerimientoId: reserva.requerimientoId` al update.

### BUG-001-CTRU: calcularCTRULote incluye unidades dañadas/perdidas
**Archivo:** `ordenCompra.recepcion.service.ts:377`
`unidadesGeneradas` mezcla OK + dañadas + perdidas. CTRU se escribe en todas.
**Fix:** Pasar solo `unidadesDisponibles` (+ reservadas) a calcularCTRULote.

### P2-P3: Filtros pipeline Unidades.tsx incompletos
**Archivo:** `Unidades.tsx:217,220,229`
No capturan estados nuevos 'en_transito', 'disponible', 'perdida'.
**Fix:** Agregar estados a cada filtro (1 línea cada uno).

---

## MENORES (corregir cuando convenga)

- **BUG-003-PAG:** Diferencia cambiaria usa solo TC del último pago, no ponderado
- **EDGE-001-INV:** Columna "Problemas" en Inventario.tsx omite 'perdida' y 'retenida_aduana'
- **REC-003:** cotizacionVinculada solo se persiste en OC al estado final
- **P4:** Envío requiere paso borrador→confirmado no garantizado en UI
- **P6:** esEstadoActivo() no incluye 'en_transito' nuevo
- **DATA-002:** Race condition en segunda escritura de historialPagos (usar arrayUnion)
- **Dashboard:** Sin KPI de unidades dañadas/perdidas

---

## VERIFICADO COMO CORRECTO ✅

- confirmarOC: unidades + envíos + vinculación
- enviar(): transiciona unidades correctamente (fix S36)
- CTRU promedio producto: excluye dañadas/perdidas
- MercadoLibre sync: excluye dañadas/perdidas
- Pool USD: funciona con pagos sub-orden
- Stock sincronización: excluye estados terminales
- esEstadoEnOrigen: incluye 'pedida'
- Guard anti-dup: previene creación duplicada (excepto REC-001)

---

## ORDEN DE EJECUCIÓN RECOMENDADO (S37)

### Ronda 1 — Fixes rápidos sin riesgo
- P2+P3+P5: filtros Unidades.tsx (3 líneas)
- BUG-001-PAG: agregar subOrdenId al tipo PagoOrdenCompra
- BUG-004-PAG: ampliar estadoPago sub-orden a 'parcial'
- EDGE-001-INV: columna Problemas incluir 'perdida'

### Ronda 2 — Fixes de lógica de negocio
- BUG-005: eliminar case 'pagado' de handleSubOrdenAction
- REC-001: filtrar guard por subOrdenId
- DATA-001: no filtrar pagos sub-orden en modal OC completa
- BUG-002-PAG: unificar derivación estadoPago
- REC-002: escribir requerimientoId en transición
- BUG-001-CTRU: excluir dañadas de calcularCTRULote

### Ronda 3 — Fixes de integridad profunda
- BUG-004-ENV: faltantes a 'en_transito' no 'disponible'
- P1: definir vía canónica de recepción (decisión arquitectónica)
