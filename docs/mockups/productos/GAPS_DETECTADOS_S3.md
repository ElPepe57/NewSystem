# GAPS DETECTADOS · Sub-fase B Sesión 3 (mockups 16-32)

> **Fecha de auditoría:** 2026-05-02 (post Sesión 3 cierre)
> **Trigger:** pregunta crítica del usuario "¿has encontrado gaps relacionados a mockups antiguos?"
> **Honestidad:** **NO** revisé los mockups históricos antes de producir 16-32. Esta auditoría se hizo después por requerimiento.
> **Documento visual asociado:** `COMPARATIVA_GAPS_S3.html`

---

## Mockups históricos relevantes que NO consideré antes

| Archivo | Líneas | Vistas/flujos |
|---------|--------|----------------|
| `docs/mockups/productos-intel-s58f.html` | 1,095 | 4 vistas (listado intel · pipeline ⭐ · sugerencias del día · antes/después) |
| `docs/mockups/producto-pack-skincare.html` | 745 | 5 flujos (wizard tipo · componentes · detalle · búsqueda venta) |

---

## 6 Gaps detectados

### 🔴 GAP 1 · Score Liquidez + Acciones de inventario (CRÍTICO)
- **Mi mockup #30** Dashboard catálogo: KPIs genéricos (productos activos · margen prom · valor inventario · sin movimiento) + top 5 + donut + matriz Boston
- **Histórico tiene:** 5 KPIs específicos del negocio (Valor stock · Capital invertido · Margen potencial · Capital atrapado · Stock lento) + Score Liquidez por SKU con barra segmentada de 5 puntos + Acciones (Reponer/Vigilar/Liquidar)
- **Recomendación:** REEMPLAZAR #30 por versión que adopte el modelo histórico

### 🔴 GAP 2 · Pipeline de valorización por ubicación (CRÍTICO)
- **Mi mockup #15** Stock: solo distribución por almacén (cantidades)
- **Histórico tiene "la pieza estrella":** Pipeline 6 etapas (Proveedor → Casillas → Aduana → Almacén → Drivers → Vendido) con costo unitario que crece + 4 KPIs por SKU (Capital invertido · atrapado · si vendieras todo · ingresos del mes)
- **Cita usuario en histórico:** "me interesaba mucho la ciencia de inteligencia de productos para entender el valor de los productos y saber el valor de los mismos en cada punto en el que se encontrara para poder valorizar mi stock en todo momento"
- **Recomendación:** AGREGAR mockup #15c (sub-vista del modal detalle, junto a #15 Stock e #15b Histórico)

### 🟡 GAP 3 · "Sugerencias del día" centro de decisiones (MEDIO)
- **Mi mockup #32** Sugerencia variantes: solo cubre detección de variantes agrupables
- **Histórico tiene:** Centro de decisiones con 3 columnas (Urgente · Vigilar · Oportunidades) · 15 acciones priorizadas · "revisión 30s" · cada card clickable
- **Recomendación:** AGREGAR mockup #36 Sugerencias del día (modal/drawer separado · trigger desde header listado)

### 🟡 GAP 4 · Pack · Regla "no descuenta stock vinculado" (MEDIO)
- **Mis mockups #14/#20:** mencionan "vinculado/exclusivo" sin enfatizar la regla
- **Histórico tiene:** Banner ámbar explícito *"Vender este pack no descuenta stock de los componentes vinculados (son unidades físicas distintas). El reporting cruzado se calcula aparte."*
- **Recomendación:** REFINAR #14 y #20 agregando el banner

### 🟡 GAP 5 · Pack · Stock suelto inline por componente vinculado (MEDIO)
- **Mis mockups #14/#20:** no muestran disponibilidad del SKU vinculado
- **Histórico tiene:** "Stock suelto: 48" en verde junto a cada componente vinculado + SKU como link clickable que abre detalle del componente base
- **Recomendación:** REFINAR #14 y #20 agregando "Stock suelto: X uds" + link al detalle

### 🟢 GAP 6 · Pack badge + tooltip en búsqueda Ventas (BAJO · cross-módulo)
- **Mi inventario actual:** no captura (excede módulo Productos)
- **Histórico tiene:** Pattern documentado en módulo Ventas · `ProductoSearchVentas` con badge Pack + tooltip on-hover con componentes
- **Recomendación:** Opción A (deuda DEUDA-PACK-VENTAS-01) o C (reservar para sesión Ventas)

---

## Impacto en el conteo total de mockups

| Acción | Δ mockups |
|--------|-----------|
| Reemplazar #30 (Dashboard catálogo) | 0 (sustitución) |
| Agregar #15c (Pipeline Valorización) | +1 |
| Agregar #36 (Sugerencias del día) | +1 |
| Refinar #14 (banner + stock suelto) | 0 (in-place) |
| Refinar #20 (banner + stock suelto) | 0 (in-place) |
| Deuda Pack-Ventas (Opción A) | 0 (deuda declarada) |
| **TOTAL** | **40 → 42 mockups** |

---

## Próximo paso

1. ⏳ Usuario revisa `COMPARATIVA_GAPS_S3.html` y decide gap por gap
2. ⏳ Yo aplico las decisiones aceptadas en una sesión adicional (Sesión 3.1 · post-gaps)
3. ⏳ Recién entonces se cierra Sub-fase B definitivamente y arranca Sub-fase C (validación holística)

---

## Política reafirmada

> **PIXEL-PERFECT no es negociable. Nada de parches sin autorización explícita.**

Esta auditoría es la prueba de que cuando el usuario pregunta, hay que admitir lo que falló y poner las cartas sobre la mesa antes de tocar nada. Ya pasó en Sesión 2 (gaps vs `productos-rediseno-s58f`) y volvió a pasar en Sesión 3 (gaps vs `productos-intel-s58f` + `producto-pack-skincare`). Lección: **antes de cada nueva sesión productiva, BARRER mockups históricos de la carpeta `docs/mockups/` que matcheen el módulo objetivo.**
