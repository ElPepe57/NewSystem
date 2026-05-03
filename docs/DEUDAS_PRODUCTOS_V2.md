# Deudas técnicas declaradas · Módulo Productos V2

**Última actualización:** 2026-05-03 · Fase H+ post implementación

Este documento centraliza las deudas pendientes del módulo Productos V2 que
quedan para resolver al cerrar toda la implementación. NO bloquean el uso
diario · son mejoras incrementales.

---

## DEUDA-PV2-CTA-NAVEGACION · Activar CTAs informativos

**Status:** declarada · pendiente de resolución al final de la implementación

**Contexto:** varios botones del módulo Productos V2 muestran texto informativo
sin acción real porque la navegación a otros módulos no está cableada todavía.

**Lugares donde aparece (sin acción por ahora):**

1. **TabHistorico.tsx** · empty state cuando no hay movimientos
   - "Empieza creando una OC"
   - "O recibe una orden existente"
   - **Activar:** `navigate('/compras/nueva?productoId=' + producto.id)` y similar

2. **TabPipeline.tsx** · banner amber cuando pipeline vacío pero hay investigación
   - "Crear OC →"
   - "Ver unidades →"
   - **Activar:**
     - `navigate('/compras/nueva?productoId=' + producto.id + '&proveedorId=' + mejorProv.id)`
     - `navigate('/unidades?productoId=' + producto.id)`

3. **WizardSimple.tsx** · banner detección de duplicados (DuplicadosBanner)
   - `onConvertirAVariante` actualmente solo muestra toast
   - **Activar:** abrir `WizardVarianteExistente` con el producto base pre-seleccionado

**Resolución sugerida:**
- Agregar prop `onNavigateToOC` y `onNavigateToUnidades` a los Tabs
- ProductoDetailModal recibe `useNavigate` y los pasa hacia abajo
- O usar `useNavigate` directo dentro de los Tabs (más simple)

---

## DEUDA-PV2-HISTORICO-CHART · Datos agregados para tendencia mensual

**Status:** declarada · requiere capa de agregación BI

**Contexto:** el chart de líneas en TabHistorico muestra esqueleto vacío con
mensaje *"Tendencia disponible cuando haya 2+ meses de movimientos"*. La data
real existe en `unidades.movimientos[]` pero requiere agregación por mes.

**Resolución sugerida:**
- Crear función `agregarVentasYStockPorMes(productoId, meses)` en
  `unidad.analytics.service.ts`
- Devuelve `{ mes: 'Apr 2026', ventas: 12, stockProm: 45 }[]`
- TabHistorico llama esa función y dibuja el chart real
- Performance: idealmente cachear resultado en colección `producto.snapshotsMensuales`
  (escrito por Cloud Function al cierre de cada mes)

**Sin esta deuda:** el TabHistorico funciona perfectamente para movimientos
recientes (lista). Solo el chart queda en skeleton.

---

## DEUDA-PV2-FILTROS-FACETS · Facets dinámicos en ChipGroups

**Status:** declarada en Fase H · diferida

**Contexto:** mockup #39 propone 4 chip groups dinámicos adicionales:
- Marca (top-N marcas más usadas con count)
- Tipo de producto (top-N)
- Categorías (top-N)
- Etiquetas (top-N)

Actualmente solo se implementó el chip group "Estado de investigación"
(Vigente/Vencida/Sin investigar) que era el más útil de los 5.

**Resolución sugerida:**
- Refactor de `CHIP_LABELS` (Record estático) a función que genere labels
  dinámicamente desde IDs
- Agregar 4 nuevos `chipGroups` al config con counts memoizados
- Actualizar el filtro `productosFiltered` para los 4 nuevos groups

---

## DEUDA-PV2-INVESTIGACION-LEGACY-CLEANUP · Service refactor adicional

**Status:** parcialmente resuelta en commit `2f74673` · queda residuo

**Contexto:** el `service.guardarInvestigacion` aún calcula internamente
`ctruEstimado`, `precioSugeridoCalculado`, `margenEstimado` y `precioEntrada`
para alimentar el `puntuacionViabilidad` que usa el sistema de alertas.
Aunque ya NO se persisten estos valores en el doc (se guarda 0), el cálculo
interno consume ciclos.

**Resolución sugerida:**
- Mover el cálculo de `puntuacionViabilidad` a `calcularInvestigacion` del
  helper compartido (devolverlo como un campo más del retorno)
- Eliminar las variables locales `ctruEstimado`, `precioSugeridoCalculado`,
  etc. del service
- Marcar los campos del tipo `InvestigacionMercado` como opcionales (`?`)
- Refactorizar los 25 errores de TypeScript en componentes V1 legacy
  (`ProductoCard.tsx`, `venta.service.ts`) que aún los referencian directos

**Bajo esfuerzo · alta limpieza · sin urgencia.**

---

## Deudas resueltas durante Fase H+

- ✅ Margen 30% genérico → fix con helper `calcularInvestigacion`
- ✅ Counts Skincare/Suplementos en 0 → fix `lineaNegocioNombre`
- ✅ Stale state al guardar proveedor → `useProductoFresco`
- ✅ Crash `e?.toLowerCase` al buscar → helper `safeLower`
- ✅ Loading state al guardar proveedor/competidor → spinner + disable
- ✅ KPI strip "sin datos" → estimación viva con `precioEfectivo`
- ✅ `precioSugeridoCalculado` legacy → eliminado de 7 archivos + cleanup BD
- ✅ TabHistorico mock → datos reales desde `unidades`
- ✅ TabPipeline TC hardcoded → `useTipoCambio` del sistema
