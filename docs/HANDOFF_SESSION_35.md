# HANDOFF — Sesion 35
# BusinessMN v2 — ERP Vita Skin Peru
# Fecha: 2026-04-13

---

## 1. RESUMEN EJECUTIVO

Sesión más larga y productiva del proyecto: 193 deploys, ~50 commits.
Se construyó desde cero el **OCWizardV2** — nuevo flujo guiado de creación de OC
con inteligencia comercial, sub-órdenes con costos individuales, y ciclo de vida
independiente por sub-orden.

---

## 2. LO QUE SE CONSTRUYÓ

### OCWizardV2 — Wizard de creación de OC (10 archivos nuevos)
- `OCWizardV2.tsx` — orquestador principal
- `WizardStepEntrega.tsx` — formulario inteligente de ruta logística (5 preguntas)
- `WizardStepInteligencia.tsx` — score engine + análisis de precios/márgenes
- `WizardStepCargos.tsx` — cargos/descuentos/impuestos estilo Amazon
- `WizardStepConfirm.tsx` — resumen y confirmación
- `DeliveryOptionCard.tsx` — tarjeta de opción reutilizable
- `ocWizardTypes.ts` — tipos + ConfigLogistica + deriveDeliveryConfig
- `ocWizardReducer.ts` — reducer con 24+ acciones
- `ConfirmarOCModal.tsx` — modal de confirmación (deprecated, funcionalidad movida inline)

### ConfigLogistica — Formulario inteligente de ruta
5 preguntas condicionales que configuran automáticamente el envío:
1. Proveedor (ProveedorAutocomplete)
2. ¿Cómo sale del proveedor? (envía / recogen en origen)
3. ¿Shipping incluido? + tipo (local/intl) + monto
4. ¿Cómo llega a Perú? (DDP / viajero / courier / local)
5. ¿Última milla? (domicilio / recojo)
+ ¿Quién paga al proveedor? (yo / recogedor → CxP)
+ Selector de viajero/courier desde colaboradorStore

### Inteligencia Comercial — Score Engine
Score 0-100 por producto con 4 dimensiones:
- Precio vs mejor proveedor (40%)
- Margen real con cargos (30%)
- Carga de costos adicionales (20%)
- Viabilidad investigación (10%)
Métricas: precio, mejor proveedor, histórico promedio, CTRU estimado, utilidad, margen %.
Incluye datos de investigación de mercado del catálogo.

### Sub-órdenes
- Asignación parcial de cantidades (distribución por producto por sub-orden)
- Costos individuales: descuento, shipping, tax por sub-orden
- Toggle %/$ para impuestos
- Validador: suma de costos vs OC original con ✓/✗
- Ciclo de vida independiente: borrador → en_tránsito → recibida
- Estado OC derivado automáticamente de sub-órdenes

### Otros cambios
- DataTable: 23 archivos migrados (total 70)
- Toggle tabla/cards en OC y Envíos
- Pipeline con estados reingeniería
- Desglose financiero: Subtotal→Desc→Base imponible→Tax→Total
- Pills/tags por atributo de producto
- Autocomplete real en cargos (no datalist)
- TC auto-fill desde tipoCambioStore
- Optimistic update en tabla OC
- Script cleanup-test-oc.mjs
- Firestore rules para ordenesCompraArchivo

---

## 3. PENDIENTES PRIORITARIOS (próxima sesión)

### A. Sub-órdenes operativas completas
1. Badges de sub-órdenes en la tabla de OC (vista lista)
2. Pagos parciales por sub-orden via PagoUnificadoForm
3. Recepción parcial por sub-orden con escaneo UPC
4. Productos dañados/perdidos por sub-orden
5. Estado derivado granular visible en tabla y dashboard

### B. Otros pendientes
- Persistir snapshot de inteligencia comercial en la OC
- Responsive audit (tabla de productos, detalle OC, wizard en mobile)
- Gastos: migrar de GV/GD/GA/GO a modelo 3 cajas
- Deuda recojo origen: CxP proveedor vs colaborador (campo registrado)

---

## 4. ARCHIVOS CLAVE

```
src/components/modules/ordenCompra/OCWizardV2/
  ├── OCWizardV2.tsx          — Orquestador
  ├── WizardStepEntrega.tsx   — Ruta logística + productos
  ├── WizardStepInteligencia.tsx — Score + análisis
  ├── WizardStepCargos.tsx    — Cargos/desc/impuestos
  ├── WizardStepConfirm.tsx   — Resumen
  ├── DeliveryOptionCard.tsx  — Tarjeta opción
  ├── ocWizardTypes.ts        — Tipos + ConfigLogistica
  └── ocWizardReducer.ts      — Reducer

src/components/modules/ordenCompra/
  ├── OrdenCompraCard.tsx     — Detalle con ciclo vida sub-órdenes
  ├── OrdenCompraTable.tsx    — Tabla con estados reingeniería
  └── ConfirmarOCModal.tsx    — (deprecated)

src/pages/OrdenesCompra/OrdenesCompra.tsx — Página principal
src/types/ordenCompra.types.ts — Tipos extendidos
src/services/ordenCompra.crud.service.ts — confirmarOC con sub-órdenes
src/store/ordenCompraStore.ts — Optimistic updates
scripts/cleanup-test-oc.mjs — Limpieza de pruebas
```

---

## 5. DECISIONES TOMADAS

- Wizard V2 reemplaza el formulario legacy para creaciones nuevas
- Formulario legacy se mantiene para edición y flujos multi-viajero
- Sub-órdenes se configuran al CONFIRMAR (no al crear)
- Costos individuales por sub-orden (no proporcionales)
- Tax se calcula sobre base imponible (subtotal - descuento)
- Score ponderado: precio 40%, margen 30%, cargos 20%, viabilidad 10%
- Ciclo de vida por sub-orden dentro del detalle de OC (no módulo Envíos separado)
- CxP puede ser con proveedor O colaborador (campo quienPagaProveedor)
