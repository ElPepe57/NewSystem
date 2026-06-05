# Migración Almacenes → Casillas · Blueprint (Fases 2-4)

> **✅ COMPLETADA (2026-06-05).** Todas las fases cerradas · tsc -b + vite build verdes ·
> el modelo legacy `Almacen` eliminado al 100% del código vivo (grep → 0, solo 2 comentarios
> históricos). Commits en rama `envios-absorcion-entrega`:
> - Fase 1 · conteo en vivo (75d814e)
> - Fase 2 + 3A-services · casillas fuente única
> - Fase 3B · matar feature de viaje muerto (Cotizaciones/Requerimientos/Compras)
> - Fase 3A-UI · consumidores mecánicos a casillas (3 subagentes + reconciliación)
> - Fase 4 · BORRAR almacen.types + casilla.service (almacenService) + casilla.analytics
>   (muerto) + casillaStore legacy + 2da vía de configuración + casillaToAlmacen
>
> **Resultado:** única fuente de verdad = colección `casillas` (tipo `Casilla`). Un almacén
> de la empresa = casilla tipo `almacen_propio`. Quedan solo nombres cosméticos (hook
> `useAlmacenStore` ya 100% casillas · tipos `AlmacenSnapshot`/`DisponibilidadAlmacen` ·
> campos de BD `almacenId`/`almacenDestino`) · rename opcional pendiente (no perturba operación).
>
> **Decisión de UX registrada:** el filtro "Todas las ubicaciones" de Inventario ahora agrupa
> por tipo de casilla (Almacenes propios/Viajeros/Couriers/Ubicaciones proveedor/Terceros) en
> vez de "Almacenes Perú / en origen" (la distinción por país ahora vive en el campo `pais`).
>
> ---
> **Estado original (histórico):** Fase 1 ✅ cerrada (conteo en vivo en ambos paths · fantasma
> muerto en todas las superficies · riesgo operativo CERRADO). Fases 2-4 = limpieza estructural
> (eliminar la duplicación). Declarado como esfuerzo dedicado por su profundidad real.
>
> **Decisión del usuario:** `casillas`/`Casilla` = única fuente de verdad. `Almacen`,
> `almacenService`, `store.almacenes/almacenesUSA/almacenesPeru`, `fetchAlmacenes*`,
> `casillaToAlmacen` → **se eliminan por completo**. Sin legacy que perturbe la operación.

## El hallazgo que define el alcance (no es un rename)

El tipo `Almacen` es un modelo **FUSIONADO** que mezcla 3 cosas:
1. **Ubicación** (casilla): id, nombre, pais, capacidadUnidades, unidadesActuales, valorInventarioUSD…
2. **Datos del viajero**: `esViajero`, `proximoViaje`, `frecuenciaViaje`, `tarifaPorLibraUSD`, `costoPromedioFlete`.
3. **Campos renombrados**: `estadoAlmacen` (vs `estado` en Casilla), `tipo:TipoAlmacen` (vs `tipo:TipoCasilla`).

### El MODELO DE DOMINIO correcto (ya aterrizado en Red Logística) separa 2 entidades
- **Casilla** = la UBICACIÓN física de acopio (la casa de Anghely en California ·
  `tipo: 'casilla_viajero'`). Tiene `colaboradorId` que apunta a su dueño.
- **Colaborador** (`tipo: 'viajero'`) = la PERSONA que transporta (Anghely). El viajero ES
  un Colaborador. Relación 1-a-N: `ColabConCasillas { colaborador; casillas[] }` en RedLogistica.tsx.

El gap del legacy es que `Almacen` FUSIONÓ ubicación + datos de viajero en un solo doc,
duplicando/contradiciendo el modelo separado.

### IMPORTANTE · los campos de viaje están DEPRECADOS hasta en el Colaborador (S42j)
`Colaborador.proximoViaje` y `Colaborador.frecuenciaViaje` están `@deprecated S42j` —
"sin uso real en el negocio (no participa en cálculos ni decisiones operativas)". El feature
"próximo viaje programado" fue ABANDONADO. Por eso los consumidores que leen `almacen.proximoViaje`
muestran data de un feature muerto.

### Estrategia de viajero (corrige el plan · NO replicar la fusión)
- ❌ **NO** agregar campos de viaje a `Casilla`. Queda como UBICACIÓN pura + `colaboradorId`.
- ✅ `esViajero` → se DERIVA de `casilla.tipo === 'casilla_viajero'` (o del Colaborador). Info viva.
- ✅ `proximoViaje`/`frecuenciaViaje`/`tarifaPorLibraUSD` → feature muerto · los consumidores que
  lo pintan se LIMPIAN (no se migra dato que el negocio ya deprecó). Declarar cada caso al usuario.

### TRAMPA de nombres (cuidado en la reconciliación)
- `Almacen.estado?: string` = **región geográfica** (Florida, California) — ¡NO es el status!
- `Almacen.estadoAlmacen: EstadoAlmacen` = **status** ('activo'|'inactivo'|'suspendido').
- `Casilla.estado: EstadoCasilla` = **status** ('activa'|'inactiva').
- Mapear `estadoAlmacen`→`estado` colisiona con el `estado`-región. Reconciliar con cuidado.
- Enums: `EstadoAlmacen` tiene `suspendido` (sin equiv. en Casilla → `inactiva`). `TipoAlmacen`
  (`viajero|courier|almacen_origen|almacen_peru`) ≠ `TipoCasilla` (`almacen_propio|casilla_viajero|
  punto_courier|ubicacion_proveedor|almacen_tercero`) → tabla de mapeo explícita.
- `PaisAlmacen` === `PaisCasilla` (idénticos · sin problema).

## Inventario del alcance (medido en código)

### Métodos de `almacenService` EN USO (13 · ~25 sitios)
`getAll`(7) · `getById`(6) · `getViajeros`(3) · `update`(1) · `seedDefaultAlmacenes`(1) ·
`incrementarUnidadesRecibidas`(1) · `getViajerosConProximoViaje`(1) · `getStats`(1) ·
`getResumenAlmacenesUSA`(1) · `getByPais`(1) · `getAlmacenesUSA`(1) · `getAlmacenesPeru`(1) ·
`create`(1). (Los otros ~14 métodos están MUERTOS → se borran directo.)

### Consumidores del store (`almacenes/USA/Peru`) · 2
- `Envios.tsx` — `todosAlmacenes` es solo **fallback legacy** (el primario ya es casillas vía
  `casillaToAlmacen`). Migración: quitar el fallback, usar solo casillas.
- `InventarioPageV2.tsx` — usa `a.tipo` (con fallback) + `almacen.nombre`. Migración: enum tipo.

### Archivos que importan el tipo `Almacen` (~15)
AlmacenAutocomplete · ModoAuditoria · ModoTransferencia · OCBuilderStep1 ·
AsignacionResponsableForm · AnalyticsTab · MapaTab · casilla.analytics.service ·
configuracion.service · logistica.reporte.service · stockDisponibilidad.service ·
configuracionStore · stockDisponibilidad.types · (+ casillaStore, casilla.types).

### Acoplamiento del VIAJERO (disperso · 8 archivos · el punto delicado)
AlmacenAutocomplete · ProductoSearchCotizaciones · AsignacionResponsableForm ·
casilla.analytics.service · colaborador.service · logistica.reporte.service ·
requerimiento.service · stockDisponibilidad.service.
→ Estos leen `proximoViaje`/`esViajero`/`frecuenciaViaje`/`tarifaPorLibraUSD`. Deben
   obtener esos datos del **Colaborador** (no de la casilla).

## Plan por fases (cada fase: tsc + build verde · validación del usuario)

### Fase 2 · Fundación: servicio de casillas completo
- Asegurar que `casillaCrudService` (o `casillaQueryService`) provea, devolviendo `Casilla[]`,
  equivalentes a los métodos vivos: `getByPais` (USA/Peru · `where estado=='activa'`),
  `getViajeros` (`where tipo=='casilla_viajero'`), `getStats`, `getResumenUSA`. Conteo en vivo
  vía `contarDisponiblesPorCasilla` (ya existe). **Sin join de viaje** (feature muerto).
- `Casilla` NO recibe campos de viaje. Donde un consumidor necesite "es viajero" → derivar de
  `tipo === 'casilla_viajero'`. Si necesita el Colaborador completo, lo pide por `colaboradorId`.

### Fase 3 · Migrar consumidores (uno por uno · verificado)
- **Grupo A (sin viajero · fácil):** InventarioPageV2, Envios (quitar fallback), ModoAuditoria,
  ModoTransferencia, OCBuilderStep1 → de `Almacen`/`almacenService` a `Casilla`/casilla-service.
  Mapear: `estadoAlmacen`→`estado` ('activo'→'activa') · `tipo` (tabla de mapeo) · `esViajero`→`tipo==='casilla_viajero'`.
- **Grupo B (tocan campos de viaje · LIMPIAR):** AlmacenAutocomplete, AsignacionResponsableForm,
  ProductoSearchCotizaciones, services (logistica.reporte, requerimiento, stockDisponibilidad,
  casilla.analytics) → quitar la lectura/pintado de `proximoViaje`/`frecuenciaViaje` (feature muerto S42j);
  `esViajero` derivado del tipo. Declarar al usuario cada UI que se limpia.
- Eliminar cada `casillaToAlmacen` a medida que su consumidor migra.

### Fase 4 · Consolidar + borrar legacy
- Mover los métodos vivos de `almacenService` al servicio de casillas (renombrados, devolviendo
  Casilla / CasillaConViajero). Borrar los ~14 métodos muertos.
- **Eliminar:** `almacenService` (casilla.service.ts pasa a `casillaQueryService`/analytics) ·
  `store.almacenes/almacenesUSA/almacenesPeru` + `fetchAlmacenes*` · el tipo `Almacen` (+ enums
  PaisAlmacen/TipoAlmacen/EstadoAlmacen si quedan sin uso) · `casillaToAlmacen`.
- Verificación final: `grep Almacen` → 0 en código vivo (solo el test de colección, que se ajusta).

## Riesgos
- **Viajero/Red Logística:** el join Colaborador para `proximoViaje` debe ser correcto · si se
  rompe, afecta listados de viajeros y próximos viajes. Validar Red Logística post-migración.
- **Enums tipo/estado:** `TipoAlmacen`↔`TipoCasilla` no son idénticos · revisar cada mapeo.
- **Services compartidos** (configuracion, logistica.reporte, stockDisponibilidad): los usa más
  de un módulo · cambios ahí tienen blast radius amplio · migrar con cuidado + tsc por archivo.

## Por qué es esfuerzo dedicado y no rush
El riesgo operativo YA está cerrado (Fase 1: el dato es correcto en todas las superficies).
Lo que queda es des-fusionar un modelo y mover lógica de viajero en ~15 archivos incl. services
compartidos. Hacerlo a medias deja un estado híbrido (algunos consumidores en Casilla, otros en
Almacen, el tipo todavía vivo) — peor que terminado o no-empezado. Merece una sesión enfocada.
