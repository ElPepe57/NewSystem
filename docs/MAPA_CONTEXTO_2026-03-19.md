# MAPA DE CONTEXTO DEL SISTEMA

**Sistema analizado:** BusinessMN v2 - ERP de Importación y Venta de Suplementos y Skincare
**Fecha de análisis:** 2026-03-19
**Hosting:** Firebase Hosting en `vitaskinperu`

---

## 1. INVENTARIO TECNOLÓGICO

### Stack Principal (Frontend)

| Tecnología | Versión | Propósito |
|---|---|---|
| React | 19.2.0 | UI framework |
| TypeScript | ~5.9.3 | Tipado estático |
| Vite | 7.2.4 | Build tool / dev server |
| Tailwind CSS | 3.4.1 | Estilos utilitarios |
| Zustand | 5.0.9 | State management (35 stores) |
| React Router DOM | 7.10.1 | Routing SPA |
| React Query (TanStack) | 5.90.12 | Cache de queries (staleTime 5min) |
| React Hook Form | 7.68.0 | Formularios |
| Zod | 4.1.13 | Validación de schemas |
| Recharts | 3.5.1 | Gráficos y visualizaciones |
| Lucide React | 0.556.0 | Iconografía |
| date-fns | 4.1.0 | Manipulación de fechas |
| jsPDF + jspdf-autotable | 3.0.4 / 5.0.2 | Generación de PDFs |
| xlsx | 0.18.5 | Exportación Excel |
| html5-qrcode | 2.3.8 | Escáner de códigos de barras/QR |
| qrcode | 1.5.4 | Generación de QR |
| @daily-co/daily-js | 0.87.0 | Videollamadas (experimental) |

### Stack Backend (Cloud Functions)

| Tecnología | Versión | Propósito |
|---|---|---|
| Node.js | 20 | Runtime |
| firebase-admin | 11.11.0 | Admin SDK |
| firebase-functions | 4.5.0 | Framework Cloud Functions |
| axios | 1.6.2 | HTTP client (API MercadoLibre) |
| TypeScript | 5.3.2 | Tipado (funciones) |

### Firebase (BaaS)

| Servicio | Uso |
|---|---|
| Authentication | Login con roles (admin, gerente, vendedor, comprador, almacenero, finanzas, supervisor, invitado) |
| Firestore | BD principal - 35+ colecciones |
| Cloud Functions | 60+ funciones (ML, WhatsApp, triggers) |
| Hosting | SPA en `vitaskinperu.web.app` |
| Storage | Comprobantes, documentos |
| Emuladores | Auth(:9099), Firestore(:8080), Storage(:9199), Functions(:5001), UI(:4000) |

---

## 2. MAPA DE MÓDULOS DE NEGOCIO

### 2.1 COMPRAS / ABASTECIMIENTO — Estado: ESTABLE

| Componente | Archivo | Función |
|---|---|---|
| Requerimientos | `src/pages/Requerimientos/Requerimientos.tsx` (~2200 líneas) | Pipeline Kanban |
| Órdenes de Compra | `src/pages/OrdenesCompra/OrdenesCompra.tsx` | Gestión OCs multi-requerimiento |
| Servicio Expectativa | `src/services/expectativa.service.ts` | Escribe en colección `requerimientos` |
| Servicio OC | `src/services/ordenCompra.service.ts` | CRUD OCs, recepción parcial, pagos |

**Notas:** OC soporta multi-requerimiento (`requerimientoIds[]`, `productosOrigen[]`). Recepción parcial y pagos parciales implementados. SRM con evaluación 0-100. `ExpectativaService` escribe en `requerimientos` usando `ventaRelacionadaId` para cotizacionId (CONVENCIÓN NO OBVIA).

### 2.2 INVENTARIO / LOGÍSTICA — Estado: ESTABLE

| Componente | Archivo |
|---|---|
| Productos | `src/services/producto.service.ts` |
| Unidades | `src/services/unidad.service.ts` |
| Almacenes | `src/services/almacen.service.ts` |
| Transferencias | `src/services/transferencia.service.ts` |
| Inventario | `src/services/inventario.service.ts` |
| Stock Disponibilidad | `src/services/stockDisponibilidad.service.ts` |
| Escáner | `src/pages/Escaner/Escaner.tsx` |

**Flujo de estados de Unidad:**
```
recibida_origen → en_transito_origen → en_transito_peru → disponible_peru → reservada → asignada_pedido → vendida
                                                                                    ↘ vencida / dañada
```

**Multi-origen:** Estados legacy (`recibida_usa`, `en_transito_usa`) coexisten con genéricos. Arrays de compatibilidad para queries.

### 2.3 VENTAS / COMERCIAL — Estado: ESTABLE

| Componente | Archivo |
|---|---|
| Cotizaciones | `src/services/cotizacion.service.ts` |
| Ventas | `src/services/venta.service.ts` (clase estática) |
| Entregas | `src/services/entrega.service.ts` |
| PDFs | `src/services/entrega-pdf.service.ts`, `cotizacionPdf.service.ts` |

### 2.4 FINANZAS — Estado: ESTABLE

| Componente | Archivo |
|---|---|
| Gastos | `src/services/gasto.service.ts` (4 categorías: GV, GD, GA, GO) |
| Tesorería | `src/services/tesoreria.service.ts` (bimoneda USD/PEN) |
| CTRU | `src/services/ctru.service.ts` (recálculo dinámico) |
| Contabilidad | `src/services/contabilidad.service.ts` |
| Tipo de Cambio | `src/services/tipoCambio.service.ts` |

**CTRU:** `CTRU_Inicial = CostoUSD × TC + FleteProrrateado` (inmutable). `CTRU_Dinámico = CTRU_Inicial + GAGO_Prorrateado` (variable). GA/GO solo a vendidas, proporcional al costo base.

### 2.5 INTELIGENCIA — Estado: PARCIAL

Servicios: `productoIntel.service.ts`, `priceIntelligence.service.ts`, analytics de competidores, marcas, clasificación.

### 2.6 INTEGRACIONES — ML: ESTABLE | WhatsApp: EN DESARROLLO

### 2.7 MAESTROS — Estado: ESTABLE

Marcas, Categorías, Tipos Producto, Etiquetas, Canales Venta, Competidores, Transportistas, Líneas Negocio, Países Origen, Configuración.

---

## 3. FLUJOS DE DATOS COMPLETOS

### 3.1 O2C (Order to Cash)
```
1. COTIZACIÓN → colección 'cotizaciones'
   - Calcula stock disponible, guarda expectativa financiera
   - Si adelanto: reserva stock. Si sin stock: genera requerimiento automático

2. CONVERSIÓN A VENTA → colección 'ventas'

3. ASIGNACIÓN STOCK → unidad.service.ts
   - Selección FEFO, unidades → 'asignada_pedido'

4. ENTREGA → colección 'entregas'
   - Transportista, gasto delivery automático (GD)
   - Unidades → 'vendida'

5. COBRO → venta.service.ts + tesoreria.service.ts
   - Pago registrado, movimiento tesorería creado
```

### 3.2 P2P (Procure to Pay)
```
1. REQUERIMIENTO → colección 'requerimientos'
2. ORDEN DE COMPRA → colección 'ordenesCompra' (multi-requerimiento)
3. RECEPCIÓN → Cloud Function onOrdenCompraRecibida → genera unidades
4. TRANSFERENCIA → colección 'transferencias'
5. PAGO OC → tesoreria.service.ts
```

### 3.3 CTRU
```
1. Recepción OC → ctru.service.ts.calcularCTRUInicial()
2. Gasto GA/GO → ctru.service.ts.recalcularCTRUDinamico()
3. Venta confirmada → trigger recálculo
```

### 3.4 MercadoLibre
```
1. OAuth2 → tokens guardados
2. Sync: items, stock, precios, buy box
3. Webhook → orden → pack consolidation → auto-create venta
4. Q&A: preguntas y respuestas
```

---

## 4. MODELO DE DATOS (Colecciones Firestore)

### 4.1 Colecciones Transaccionales

| Colección | Campos Clave | Relaciones |
|---|---|---|
| `ventas` | numeroVenta, estado, estadoPago, productos[], pagos[] | → unidades, → cotizaciones |
| `cotizaciones` | numeroCotizacion, estado, productos[], reservaStock | → ventas, → requerimientos |
| `requerimientos` | numeroRequerimiento, estado, productos[] | → cotizaciones (ventaRelacionadaId), → OCs |
| `ordenesCompra` | numeroOrden, estado, estadoPago, historialPagos[] | → proveedores, → requerimientos, → unidades |
| `unidades` | estado, productoId, almacenId, costoUnitarioUSD, ctruInicial, ctruDinamico | → productos, → almacenes, → OCs, → ventas |
| `productos` | sku, marca, stockPeru, stockUSA, ctruPromedio | → marcas, → categorias, → tipos |
| `almacenes` | codigo, pais, tipo | → unidades |
| `transferencias` | tipo, estado, almacenOrigen, almacenDestino, unidades[] | → almacenes, → unidades |
| `gastos` | categoria, tipo, montoPEN, mes, anio, impactaCTRU | → OCs?, → ventas? |
| `movimientosTesoreria` | tipo, moneda, monto, cuentaId | → ventas?, → OCs?, → gastos? |
| `entregas` | codigo, ventaId, estado, transportistaId | → ventas, → transportistas |

### 4.2 Colecciones Maestras
`marcas`, `categorias`, `tiposProducto`, `etiquetas`, `canalesVenta`, `competidores`, `transportistas`, `lineasNegocio`, `paisesOrigen`, `tiposCambio`, `cuentasCaja`

### 4.3 Colecciones de Sistema
`users`, `audit_logs`, `notificaciones`, `historialRecalculoCTRU`, `scanHistory`, `conteosInventario`, `presencia`, `actividad`, `chat_mensajes`, `chat_meta`, `llamadas`, `llamadasIntel`

### 4.4 Patrón de Desnormalización
Desnormalización agresiva: Unidad tiene `productoSKU`, `productoNombre`, `almacenNombre`; Venta tiene `nombreCliente`; OC tiene `nombreProveedor`, `requerimientoNumeros[]`.

---

## 5. INTEGRACIONES EXTERNAS

### 5.1 MercadoLibre — ESTABLE (37 Cloud Functions)
- Auth OAuth2, Webhook para órdenes, Stock sync ERP→ML, Pack orders, Buy Box, Q&A
- Archivos: `functions/src/mercadolibre/`, `src/services/mercadoLibre.service.ts`
- Colecciones: `mlConfig`, `mlProductMaps`, `mlOrderSync`

### 5.2 WhatsApp — EN DESARROLLO (3 Cloud Functions)
- `wawebhook`, `wasetconfig`, `wasendmessage`
- Archivos: `functions/src/whatsapp/`

### 5.3 SUNAT / Facturación — INEXISTENTE
No hay integración. Campos `dniRuc` solo como texto informativo.

---

## 6. ESTADO DE MADUREZ

| Módulo | Madurez | Deuda Técnica |
|---|---|---|
| Productos + Clasificación | ESTABLE | Campos legacy `grupo`/`subgrupo` coexisten |
| Unidades + Inventario | ESTABLE | Estados legacy coexisten con genéricos |
| Órdenes de Compra | ESTABLE | `requerimientoId` (singular) legacy + `requerimientoIds[]` nuevo |
| Ventas | ESTABLE | VentaService es clase estática (única excepción) |
| Cotizaciones | ESTABLE | ReservaStock deprecated + MultiAlmacen nuevo |
| Requerimientos | ESTABLE | Dos sistemas de tipos coexisten |
| Entregas | ESTABLE | — |
| Gastos | ESTABLE | `claseGasto` deprecated |
| Tesorería | ESTABLE | — |
| CTRU | ESTABLE | Lógica distribuida entre 3 archivos |
| Contabilidad | PARCIAL | Balance General básico |
| ML Integration | ESTABLE | ~15 funciones de reparación |
| WhatsApp | EN DESARROLLO | Sin evidencia de uso en producción |
| Inteligencia Producto | PARCIAL | Requiere calibración |
| Escáner | ESTABLE | — |

---

## 7. CONVENCIONES Y PATRONES

### Servicios
- **Dominante:** Singletons `const serviceName = { ... }`
- **Excepciones:** `VentaService`, `OrdenCompraService`, `ProductoService`, `CotizacionService`, `ExpectativaService` son clases con métodos estáticos
- Todos importan `db` desde `../lib/firebase` y `COLLECTIONS` desde `../config/collections`

### Tipos
- Un `.types.ts` por entidad en `src/types/`
- `Timestamp` de Firestore (no `Date`). FormData usa `Date` nativo
- Campos deprecated marcados con `@deprecated` JSDoc

### Stores (Zustand)
- 35 stores, patrón `useXxxStore`, sin middleware

### Nomenclatura
- Colecciones: camelCase. Números: `VT-2024-001`, `OC-2024-001`, etc.
- Monedas: `USD` y `PEN` como strings
- TC: múltiples por operación (`tcCompra`, `tcPago`, `tcVenta`, `tcCobro`)
- Batch limit: 450 ops (margen seguridad sobre 500)

---

## 8. PUNTOS DE RIESGO

### 🔴 ROJO — NO TOCAR sin pruebas extensivas
1. **ctru.service.ts + ctruStore.ts** — Error corrompe costos de TODA la BD
2. **onOrdenCompraRecibida (Cloud Function)** — Bug crea unidades fantasma
3. **venta.service.ts (asignación FEFO + pago)** — Efectos cascada
4. **ml.orderProcessor.ts + ml.sync.ts** — Bug duplica ventas
5. **firestore.rules** — Cambios incorrectos bloquean toda la app

### 🟡 AMARILLO — Con cuidado
1. Coexistencia tipos legacy/nuevo — usar arrays de compatibilidad
2. Desnormalización agresiva — actualizar N documentos dependientes
3. expectativa.service.ts — `ventaRelacionadaId` = cotizacionId
4. Recálculos CTRU automáticos — carga inesperada

### 🟢 VERDE — Seguro
1. Componentes UI display | 2. Servicios analytics | 3. PDFs | 4. Maestros | 5. Config/perfil

---

## 9. MAPA DE DEPENDENCIAS ENTRE SERVICIOS

```
venta.service.ts
  ├→ unidad.service.ts, producto.service.ts, inventario.service.ts
  ├→ tipoCambio.service.ts, tesoreria.service.ts
  ├→ entrega.service.ts, gasto.service.ts, metricas.service.ts
  └→ notification.service.ts, actividad.service.ts

ordenCompra.service.ts
  ├→ producto.service.ts, inventario.service.ts, unidad.service.ts
  ├→ almacen.service.ts, expectativa.service.ts
  ├→ tesoreria.service.ts, ctru.service.ts
  └→ actividad.service.ts

cotizacion.service.ts
  ├→ producto.service.ts, inventario.service.ts, unidad.service.ts
  ├→ venta.service.ts, tesoreria.service.ts, tipoCambio.service.ts
  ├→ stockDisponibilidad.service.ts, expectativa.service.ts
  └→ actividad.service.ts

entrega.service.ts
  ├→ transportista.service.ts, movimiento-transportista.service.ts
  ├→ gasto.service.ts, unidad.service.ts, tesoreria.service.ts
  ├→ auditoria.service.ts, inventario.service.ts
  └→ actividad.service.ts

ctru.service.ts
  ├→ unidad.service.ts, gasto.service.ts
  ├→ producto.service.ts, ctruLock.service.ts

transferencia.service.ts
  ├→ almacen.service.ts, producto.service.ts
  ├→ tesoreria.service.ts, inventario.service.ts
```

**Hubs más conectados:** `unidad.service.ts`, `producto.service.ts`, `tesoreria.service.ts`

---

*Generado por system-context-reader (Agente 24) — 2026-03-19*
