# 📋 AUDITORÍA EXHAUSTIVA · Productos V2 vs Legacy V1

**Fecha:** 2026-05-02
**Alcance:** Módulo Productos completo (V2) y comparación con implementación legacy V1
**Total de gaps detectados:** 42
**Distribución:** 14 🔴 Bloqueantes · 19 🟡 Importantes · 9 🟢 Nice-to-have

---

## 📑 Índice

- [Convenciones](#convenciones)
- [Bloque 1 · Listado](#bloque-1--listado) (10 gaps)
- [Bloque 2 · Modal Detalle](#bloque-2--modal-detalle) (7 gaps)
- [Bloque 3 · Creación / Wizards](#bloque-3--creación--wizards) (10 gaps)
- [Bloque 4 · Edición](#bloque-4--edición) (2 gaps)
- [Bloque 5 · Investigación](#bloque-5--investigación) (8 gaps)
- [Bloque 6 · Papelera / Archivo](#bloque-6--papelera--archivo) (4 gaps)
- [Bloque 7 · Tools](#bloque-7--tools) (4 gaps)
- [Bloque 8 · Persistencia / Sync](#bloque-8--persistencia--sync) (7 gaps)
- [Resumen Ejecutivo](#resumen-ejecutivo)
- [Lista de Mockups Requeridos](#lista-de-mockups-requeridos)

---

## Convenciones

| Símbolo | Significado |
|---|---|
| 🔴 | **Bloqueante** · No podés usar el módulo sin esto |
| 🟡 | **Importante** · Funciona con workaround pero rompe UX |
| 🟢 | **Nice-to-have** · Mejora pero no bloquea |

| Esfuerzo | Tiempo |
|---|---|
| **S** | ≤30 min |
| **M** | 1-2 h |
| **L** | sesión completa (4h+) |

---

## BLOQUE 1 · LISTADO

### GAP-001 · 🔴 · Filtro "Línea" V2 está roto (no filtra)
| | |
|---|---|
| **v1 hace** | `useLineaFilter` global + filtro local por `lineaNegocioId` |
| **v2 hace** | Hace match por nombre `(p.linea ?? p.lineaNegocio)` pero el campo real es `lineaNegocioNombre`/`lineaNegocioId` |
| **Bloquea UAT** | sí |
| **Esfuerzo** | M |
| **Necesita mockup** | no |
| **Sugerencia** | Refactor `useProductosFilters` + comparar contra `lineaNegocioId` real, mapear "skincare" → lineaId |

### GAP-002 · 🔴 · No respeta el filtro GLOBAL de línea del header
| | |
|---|---|
| **v1 hace** | `useLineaFilter(productos, p => p.lineaNegocioId)` ANTES de filtros locales |
| **v2 hace** | Usa lista cruda del store. Cambiar línea en el header global no impacta `/productos` V2 |
| **Bloquea UAT** | sí (rompe consistencia con el resto del ERP) |
| **Esfuerzo** | S |
| **Necesita mockup** | no |
| **Sugerencia** | Agregar `const productosPorLinea = useLineaFilter(lista, p => p.lineaNegocioId)` |

### GAP-003 · 🔴 · Búsqueda por nombre no encuentra (campo equivocado)
| | |
|---|---|
| **v1 hace** | Busca en 8 campos: sku · marca · nombreComercial · grupo · subgrupo · tipoProducto · categorías · etiquetas |
| **v2 hace** | Busca en `p.nombre` (no existe), `p.marca`, `p.sku`. La búsqueda nunca encuentra por nombre del producto |
| **Bloquea UAT** | sí |
| **Esfuerzo** | S |
| **Necesita mockup** | no |
| **Sugerencia** | Cambiar `p.nombre` → `p.nombreComercial` y agregar grupo/categorías/etiquetas |

### GAP-004 · 🟡 · Filtros legacy desaparecidos
| | |
|---|---|
| **v1 hace** | 8 filtros: estado · grupo · marca · stockStatus · investigacion · tipoProductoId · categoriaId · etiquetaId |
| **v2 hace** | Solo 3 chip groups (linea/tipo/estado) + búsqueda + dateRange. Faltan: marca, grupo, tipoProducto, categoría, etiqueta, estado de investigación |
| **Bloquea UAT** | parcial |
| **Esfuerzo** | M |
| **Necesita mockup** | sí (vista completa filtros bar ampliado) |
| **Sugerencia** | Sumar chip groups dinámicos cargando maestros |

### GAP-005 · 🟡 · No hay paginación
| | |
|---|---|
| **v1 hace** | itemsPerPage=20, navegación 5 botones, scroll-to-top |
| **v2 hace** | Renderiza TODO el array filtrado |
| **Bloquea UAT** | no si <50 productos · sí cuando crezca a >100 |
| **Esfuerzo** | M |
| **Necesita mockup** | sí (estilo paginación canónica V2) |
| **Sugerencia** | Paginación virtual o paginar `productosFiltered` con state local |

### GAP-006 · 🟡 · Ordenamiento limitado y con bug
| | |
|---|---|
| **v1 hace** | 10+ keys: SKU, marca, nombre, ctru, stock, estado, precios, ROI, margen, multiplicador. Multiorden con Ctrl+click |
| **v2 hace** | 5 opciones fijas. `calcMargen` lee `investigacion?.[0]` como array (es objeto) → siempre da resultados incorrectos |
| **Bloquea UAT** | parcial |
| **Esfuerzo** | S |
| **Necesita mockup** | no |
| **Sugerencia** | Corregir bug `.[0]` → directo + sumar opciones SKU/marca/CTRU/ROI |

### GAP-007 · 🔴 · KPI "margen promedio" siempre da 0 (mismo bug `.[0]`)
| | |
|---|---|
| **v1 hace** | Lee `producto.investigacion` como objeto |
| **v2 hace** | Lee `p.investigacion?.[0]` → siempre undefined → margen = 0 para todos los productos |
| **Bloquea UAT** | sí (KPIs muestran datos falsos) |
| **Esfuerzo** | S |
| **Necesita mockup** | no |
| **Sugerencia** | `p.investigacion?.[0]` → `p.investigacion` en líneas 358-371 + `calcMargen` |

### GAP-008 · 🟡 · BulkActions toolbar muestra acciones que no existen
| | |
|---|---|
| **v1 hace** | No tiene bulk actions |
| **v2 hace** | 5 acciones (Estado, Etiquetar, Línea, Exportar, Archivar) → todas `toast.info("pendiente")`. Promete capacidad inexistente |
| **Bloquea UAT** | no (es nueva V2) |
| **Esfuerzo** | L (cada una es un mini-flow) |
| **Necesita mockup** | sí (cada acción debe diseñarse) |
| **Sugerencia** | Esconder hasta tener al menos 1 implementada (Archivar es la más fácil) |

### GAP-009 · 🟡 · Importar / Exportar header sin implementar
| | |
|---|---|
| **v1 hace** | Igual que V2: `console.warn('[TODO]')` |
| **v2 hace** | `toast.info('pendiente')` |
| **Bloquea UAT** | no (no es regresión vs legacy) |
| **Esfuerzo** | L |
| **Necesita mockup** | sí (modal importar CSV/Excel + flujo confirm + preview) |
| **Sugerencia** | Documentar como feature pendiente, no es regresión |

### GAP-010 · 🟢 · Pill "Packs" duplica funcionalidad del chip "Tipo: Pack"
| | |
|---|---|
| **v2 hace** | Pill rápido "Packs" + chip "Tipo: Pack" filtran lo mismo. Estado de uno no sincroniza con el otro |
| **Bloquea UAT** | no |
| **Esfuerzo** | S |
| **Sugerencia** | Sincronizar estados o eliminar uno |

---

## BLOQUE 2 · MODAL DETALLE

### GAP-020 · 🔴 · Botón "Editar" no edita (solo `toast.info`)
| | |
|---|---|
| **v1 hace** | Abre `ProductoForm` (1,723 ln) precargado con todos los campos |
| **v2 hace** | `onEdit={p => toast.info('Disponible en Fase 7')}`. Cero capacidad de editar |
| **Bloquea UAT** | sí · CRÍTICO · es la operación más usada después de crear |
| **Esfuerzo** | L |
| **Necesita mockup** | sí (no existe diseño canónico de "wizard edición") |
| **Sugerencia** | **Opción A (puente):** abrir `ProductoForm` legacy en modal cuando flag V2 activo. **Opción B (largo plazo):** diseñar mockup nuevo de edición canónico V2 |

### GAP-021 · 🔴 · Botón "Investigar ahora" en TabInvestigacion no funciona
| | |
|---|---|
| **v1 hace** | Botón "Realizar investigación" abre `InvestigacionModal` |
| **v2 hace** | `TabInvestigacion` recibe prop `onReInvestigar` pero `ProductoDetailModal` NO LO PASA. Botón en empty state no aparece |
| **Bloquea UAT** | sí (modal #24 existe pero el usuario no puede llegar a él desde el detalle) |
| **Esfuerzo** | S |
| **Necesita mockup** | no |
| **Sugerencia** | Pasar `onReInvestigar={onAbrirInvestigacion}` desde ProductosPageV2 → ProductoDetailModal → TabInvestigacion |

### GAP-022 · 🟡 · "Ver investigación completa" no abre el modal #24
| | |
|---|---|
| **v1 hace** | N/A (no había modal #24 separado) |
| **v2 hace** | TabInvestigacion tiene CTA `onVerCompleto` pero ProductoDetailModal no lo pasa |
| **Bloquea UAT** | parcial |
| **Esfuerzo** | S |
| **Sugerencia** | Mismo wiring que GAP-021 |

### GAP-023 · 🟡 · Acciones del kebab "..." sin implementar (3 de 4)
| | |
|---|---|
| **v2 hace** | Editar (toast), Nueva variante (toast), Duplicar (toast), Archivar (sí funciona) |
| **Bloquea UAT** | sí parcial |
| **Esfuerzo** | M |
| **Necesita mockup** | parcial (solo Duplicar requiere flujo nuevo) |
| **Sugerencia** | Conectar Nueva variante → `setWizardActivo('variante_existente')`. Duplicar = clonar producto + nuevo SKU. Editar = GAP-020 |

### GAP-024 · 🟢 · Tab Histórico es placeholder
| | |
|---|---|
| **v1 hace** | También placeholder ("próximamente") |
| **v2 hace** | Tab habilitado pero sin contenido real |
| **Bloquea UAT** | no |
| **Sugerencia** | Marcar como disabled con badge "próximamente" hasta implementar |

### GAP-025 · 🟢 · Tab Pipeline placeholder (mismo caso GAP-024) |

### GAP-026 · 🟢 · Componentes vinculados no abren detalle del componente
| | |
|---|---|
| **v2 hace** | TabComponentes tiene click handler `onClick?.(fila)` pero el shell no lo implementa |
| **Bloquea UAT** | no |
| **Sugerencia** | En ProductoDetailModal aceptar `onClickComponente` y navegar al detalle del producto vinculado |

---

## BLOQUE 3 · CREACIÓN / WIZARDS

### GAP-040 · 🔴 · Wizards no integran maestros (marca, categoría, tipo, etiqueta)
| | |
|---|---|
| **v1 hace** | `MarcaAutocomplete`, `TipoProductoSelector`, `CategoriaSelector`, `EtiquetaSelector` con búsqueda en Firestore + crear inline |
| **v2 hace** | `<input type="text">` libres para marca. Sin selectors para tipo/categoría/etiqueta. Productos creados sin `marcaId`/`tipoProductoId`/`categoriaIds`/`etiquetaIds` |
| **Bloquea UAT** | sí (productos V2 quedan huérfanos del sistema de clasificación) |
| **Esfuerzo** | L |
| **Necesita mockup** | parcial (los selectors se reusan de los mockups #18-19, pero hay que decidir UX dentro del wizard) |
| **Sugerencia** | Agregar sección "Clasificación" con los 4 selectors en WizardSimple/ConVariantes/Pack |

### GAP-041 · 🔴 · Wizards no soportan atributos Skincare
| | |
|---|---|
| **v1 hace** | Rama condicional SUP/SKC: si SKC pide tipoProductoSKC, volumen, ingredienteClave, lineaProducto, tipoPiel, preocupaciones, textura, SPF, PA, PAO |
| **v2 hace** | Ningún wizard captura `atributosSkincare`. Productos SKC quedan inutilizables para filtros y reporting Skincare |
| **Bloquea UAT** | sí (rompe el módulo Skincare) |
| **Esfuerzo** | L |
| **Necesita mockup** | sí (sección Skincare condicional en wizards) |
| **Sugerencia** | WizardSimple/ConVariantes detectan línea seleccionada y muestran campos condicionales |

### GAP-042 · 🟡 · Wizard Simple no genera SKU preview
| | |
|---|---|
| **v1 hace** | `ProductoService.getProximoSKU(lineaCodigo)` reactivo + bloque emerald "SKU: SUP-0042" |
| **v2 hace** | No muestra preview (solo WizardVarianteExistente lo hace) |
| **Bloquea UAT** | no (SKU se genera al guardar) |
| **Esfuerzo** | S |
| **Sugerencia** | Sumar `useEffect → getProximoSKU` al elegir línea |

### GAP-043 · 🟡 · Wizard sin detección de duplicados al crear
| | |
|---|---|
| **v1 hace** | `detectarDuplicados()` compara marca + nombre + dosaje. `window.confirm` con lista |
| **v2 hace** | No hay detección. "Vitamin C 1000mg" se puede crear 3 veces sin warning |
| **Bloquea UAT** | no |
| **Esfuerzo** | M |
| **Necesita mockup** | sí (modal/banner warning de duplicados) |
| **Sugerencia** | En `handleCrearSimple`, antes de createProducto, ejecutar lógica similar |

### GAP-044 · 🟡 · Wizard sin sugerencias inteligentes de variantes
| | |
|---|---|
| **v1 hace** | `useDetectarVarianteCandidatos` + `SugerenciaVarianteBanner`: si encuentra similar, sugiere "¿Es variante de X?" con CTA |
| **v2 hace** | WizardSimple muestra banner amarillo genérico pero no detecta de verdad |
| **Bloquea UAT** | no |
| **Esfuerzo** | M |
| **Sugerencia** | Agregar `useDetectarVarianteCandidatos` + CTA real para reabrir WizardVarianteExistente |

### GAP-045 · 🟡 · Países hardcoded sin CRUD
| | |
|---|---|
| **v1 hace** | Tab "Origen" con CRUD inline desde paisOrigenStore (agregar/editar/eliminar) |
| **v2 hace** | `PAISES` hardcoded como const con 5 países |
| **Bloquea UAT** | no si los 5 cubren · sí cuando se agregue Japón/India |
| **Esfuerzo** | S |
| **Sugerencia** | Reemplazar const por `usePaisOrigenStore` |

### GAP-046 · 🟡 · Wizards sin "ciclo de recompra"
| | |
|---|---|
| **v1 hace** | Campo `servingsPerDay` + cálculo automático `cicloRecompraDias = contenido / servingsPerDay` |
| **v2 hace** | No captura → `cicloRecompraDias` siempre undefined |
| **Bloquea UAT** | no |
| **Esfuerzo** | S |
| **Sugerencia** | Agregar campo en sección Inventario solo cuando línea = suplementos |

### GAP-047 · 🟢 · Wizards no muestran métricas de marca al seleccionarla
| | |
|---|---|
| **v1 hace** | Card purple "Estadísticas de Marca X" con productos activos, ventas, margen promedio |
| **v2 hace** | No hay enriquecimiento |
| **Bloquea UAT** | no |
| **Sugerencia** | Cubierto cuando se resuelva GAP-040 |

### GAP-048 · 🟡 · WizardConVariantes no soporta SKC adecuadamente
| | |
|---|---|
| **v1 hace** | Si línea = SKC + modoVariantes, redirige a tab Variantes que sí maneja volumen/dosaje SKC |
| **v2 hace** | Solo soporta ejes "volumen/contenido/sabor/otro" en ml/caps. Variantes SKC se crean con `presentacion='líquido'` y sin `atributosSkincare` base |
| **Bloquea UAT** | sí para SKC |
| **Esfuerzo** | M |
| **Necesita mockup** | parcial |
| **Sugerencia** | Ramificar wizard según línea + paso "atributos comunes SKC" |

### GAP-049 · 🟢 · WizardPack no detecta duplicado de componente
| | |
|---|---|
| **v2 hace** | Permite agregar 2 veces el mismo componente exclusivo por nombre |
| **Bloquea UAT** | no |
| **Sugerencia** | Validar nombre único en exclusivos antes de submit |

---

## BLOQUE 4 · EDICIÓN

### GAP-060 · 🔴 · No existe ningún flujo de edición en V2
| | |
|---|---|
| **v1 hace** | Edición completa con `ProductoForm` (mismos campos que crear, precargados) + flujo de duplicados al editar |
| **v2 hace** | Cero. Sin esto, todo cambio post-creación obliga a desactivar el flag y volver al legacy |
| **Bloquea UAT** | sí · CRÍTICO |
| **Esfuerzo** | L |
| **Necesita mockup** | sí · NO existe diseño canónico |
| **Sugerencia** | **OPCIÓN PUENTE URGENTE:** abrir ProductoForm legacy en modal cuando V2 activo. Largo plazo: diseñar nativo |

### GAP-061 · 🟡 · Pack snapshots no se rehidratan al editar
| | |
|---|---|
| **v1 hace** | Mismo problema (DEUDA-PACK-001) |
| **v2 hace** | Sin edición · gap heredado |
| **Sugerencia** | Pendiente Cloud Function (DEUDA-PACK-001 vigente) |

---

## BLOQUE 5 · INVESTIGACIÓN

### GAP-080 · 🔴 · Sin botón "Investigar" en cada fila del listado
| | |
|---|---|
| **v1 hace** | Acción "Investigar" en kebab de cada fila → abre InvestigacionModal directo |
| **v2 hace** | `onReInvestigar` solo se invoca desde el banner "investigación vencida". No hay forma de iniciar investigación nueva desde el listado |
| **Bloquea UAT** | sí |
| **Esfuerzo** | S |
| **Sugerencia** | Agregar acción "Investigar" en menú kebab del row card |

### GAP-081 · 🔴 · Modal detalle no expone "Investigar ahora" (= GAP-021)
Ver GAP-021. Combinado con GAP-080, el único entry-point a investigación nueva es el banner amber del row card.

### GAP-082 · 🔴 · No hay form de captura de investigación completa en V2
| | |
|---|---|
| **v1 hace** | InvestigacionModal (836 ln) form completo: ProveedorOrigenList + CompetidorPeruList + cálculo CTRU/margen/ROI/multiplicador/puntuacionViabilidad + recomendación + razonamiento + notas + alertas |
| **v2 hace** | InvestigacionCompletaModal #24 SOLO MUESTRA datos · sub-modales solo capturan items individuales · NO hay form para `logisticaEstimada`, `demandaEstimada`, `tendencia`, `nivelCompetencia`, `recomendacion`, `razonamiento`, `notas` |
| **Bloquea UAT** | sí · CRÍTICO |
| **Esfuerzo** | L |
| **Necesita mockup** | sí · NO existe diseño canónico |
| **Sugerencia** | **OPCIÓN PUENTE:** abrir InvestigacionModal legacy en modal cuando V2 activo. Largo plazo: diseñar mockup nativo |

### GAP-083 · 🟡 · Cálculos derivados no se recalculan al editar items individuales
| | |
|---|---|
| **v1 hace** | Al guardar, persiste ctruEstimado, precioSugeridoCalculado, margenEstimado, gananciaUnidad, roi, multiplicador, puntuacionViabilidad, vigenciaHasta (90 días). Todo precalculado |
| **v2 hace** | Sub-modales solo guardan items. No hay recálculo cuando cambia un proveedor → KPIs/decisiones quedan stale |
| **Bloquea UAT** | sí (cálculos quedan desactualizados) |
| **Esfuerzo** | M |
| **Sugerencia** | En `handleGuardarProveedorInv`/`handleGuardarCompetidorInv`, recalcular derivados con lógica del legacy |

### GAP-084 · 🟡 · "Marcar como vista" no actualiza nada
| | |
|---|---|
| **v2 hace** | Solo cierra modal + toast. No persiste `fechaUltimaVista` |
| **Bloquea UAT** | no |
| **Esfuerzo** | S |
| **Sugerencia** | Agregar `producto.investigacion.fechaUltimaVista` + filtro "no vistas" |

### GAP-085 · 🟡 · "Re-investigar" no abre el form
| | |
|---|---|
| **v2 hace** | Botón Re-investigar lanza `toast.info('pendiente Fase 9')` |
| **Bloquea UAT** | sí |
| **Esfuerzo** | M |
| **Sugerencia** | Resolver junto con GAP-082 |

### GAP-086 · 🟡 · "Importar" / "Descartar" oportunidad no persisten decisión
| | |
|---|---|
| **v2 hace** | `toast.warning('pendiente captura de motivo')` |
| **Esfuerzo** | S |
| **Sugerencia** | `ProductoService.update` con `investigacion.recomendacion` + `fechaDecision` |

### GAP-087 · 🟢 · Falta opción "Eliminar investigación"
| | |
|---|---|
| **v1 hace** | InvestigacionModal tiene `onDelete` que limpia el subdoc |
| **v2 hace** | No expuesta (kebab "..." vacío) |
| **Sugerencia** | Agregar opción en kebab del modal #24 |

---

## BLOQUE 6 · PAPELERA / ARCHIVO

### GAP-100 · 🔴 · "Eliminar definitivo" promete pero no ejecuta
| | |
|---|---|
| **v1 hace** | NO tiene eliminar definitivo. Política legacy = "se conservan permanentemente para trazabilidad" |
| **v2 hace** | UI muestra "Eliminar definitivamente" + "Vaciar papelera" → solo `toast.warning`. Promete acción inexistente |
| **Bloquea UAT** | sí (UI miente) |
| **Esfuerzo** | M |
| **Necesita mockup** | no |
| **Sugerencia** | **Opción A:** esconder botones hasta tener CF. **Opción B:** implementar `hardDelete` + Cloud Function de cleanup |

### GAP-101 · 🟡 · Política de retención inconsistente
| | |
|---|---|
| **v1 hace** | "Conservar permanentemente" |
| **v2 hace** | "90 días antes de eliminación automática". No hay CF que lo ejecute |
| **Sugerencia** | Decisión de negocio: implementar CF con scheduler O ajustar copy a "permanente" |

### GAP-102 · 🟢 · Selección múltiple no usa acciones masivas
| | |
|---|---|
| **v2 hace** | Checkboxes funcionan pero no hay botón "Restaurar/Eliminar seleccionados" |
| **Sugerencia** | Action bar inferior cuando `seleccionados.size > 0` |

### GAP-103 · 🟢 · No muestra tipo de producto archivado
| | |
|---|---|
| **v1 hace** | Muestra presentacion + dosaje |
| **v2 hace** | Solo SKU + marca + nombre. No indica si era Pack/SKC |
| **Sugerencia** | Agregar chip de línea/tipo |

---

## BLOQUE 7 · TOOLS

### GAP-120 · 🟢 · Intel Dashboard usa datos sintéticos cuando faltan métricas
| | |
|---|---|
| **v1 hace** | DashboardCatalogo muestra agregados reales (255 ln) |
| **v2 hace** | `Math.floor(Math.random() * 100)` para `scoreLiquidez` cuando no hay datos. Velocidad mes es heurística |
| **Bloquea UAT** | no si se considera demo · sí si se presenta como real |
| **Esfuerzo** | M |
| **Sugerencia** | Eliminar `Math.random` + filtrar productos sin métricas o etiquetar "sin datos" |

### GAP-121 · 🟡 · PuntoEquilibrio no persiste escenarios
| | |
|---|---|
| **v1 hace** | Card embebida con cálculos en vivo · no persiste |
| **v2 hace** | Modal recibe `onGuardarEscenario` pero shell solo `toast.success` |
| **Bloquea UAT** | no (mismo estado que legacy) |
| **Sugerencia** | Si se quiere persistir, agregar `producto.escenariosPE[]` |

### GAP-122 · 🟡 · Sugerencias variantes sin handler de aplicación
| | |
|---|---|
| **v2 hace** | `onAplicar` y `onAplicarTodos` lanzan `toast("pendiente persistencia")` |
| **Esfuerzo** | M |
| **Sugerencia** | Cuando se cierre GAP-040, ejecutar `createConVariantes` desde aquí |

### GAP-123 · 🟡 · Sugerencias del día sin handler real
| | |
|---|---|
| **v2 hace** | Cada sugerencia hace `toast.info("pendiente flujo dedicado")`. "Liquidar X" no abre flujo · "Reponer Y" no abre OC |
| **Bloquea UAT** | no (es feature nueva) |
| **Esfuerzo** | L |
| **Sugerencia** | Priorizar: "Reponer" → abrir OC con producto preseleccionado |

---

## BLOQUE 8 · PERSISTENCIA / SYNC

### GAP-140 · 🔴 · Productos V2 sin marcaId/tipoProductoId/categoriaIds (consecuencia GAP-040)
| | |
|---|---|
| **v1 hace** | ProductoForm captura los IDs + snapshots desnormalizados |
| **v2 hace** | Wizards V2 crean productos sin esos IDs. Módulos consumidores (Ventas/Cotizaciones/Requerimientos) que filtran por IDs no encuentran productos V2 |
| **Bloquea UAT** | sí (consecuencia directa de GAP-040) |
| **Esfuerzo** | cubierto por GAP-040 |

### GAP-141 · 🟡 · Productos SKC V2 sin atributosSkincare (consecuencia GAP-041)
Similar a GAP-140 para SKC. Cubierto por GAP-041.

### GAP-142 · 🟡 · ProductoSearchVentas debería seguir funcionando
| | |
|---|---|
| **v1 hace** | Busca por marca/nombre/SKU |
| **v2 hace** | OK · campos básicos se persisten igual. Pero badge "Pack" + tooltip de componentes (DEUDA-PACK-VENTAS-01) sigue pendiente |
| **Bloquea UAT** | no |
| **Sugerencia** | DEUDA-PACK-VENTAS-01 sigue vigente para sesión Ventas |

### GAP-143 · 🔴 · WizardSimple guarda paisOrigen con nombre completo en vez de código
| | |
|---|---|
| **v1 hace** | `paisOrigen='USA'` (código de 3 letras) desde `paisOrigenStore` |
| **v2 hace** | `paisOrigen='Estados Unidos'`. Filtros + reportes que comparan `paisOrigen='USA'` no matchean |
| **Bloquea UAT** | sí (filtros por país inconsistentes con productos legacy) |
| **Esfuerzo** | S |
| **Sugerencia** | Cambiar `PAISES` a `[{value:'USA', label:'Estados Unidos'}]` y guardar `value` |

### GAP-144 · 🔴 · WizardPack hardcodea presentación y contenido
| | |
|---|---|
| **v1 hace** | Pack guarda `presentacion=''` (vacío) |
| **v2 hace** | `presentacion: 'capsulas'` y `contenido: '${componentes.length} componentes'`. Filtros por presentación incluyen packs como "cápsulas" |
| **Bloquea UAT** | sí parcial |
| **Esfuerzo** | S |
| **Sugerencia** | Guardar `presentacion=''` igual que legacy |

### GAP-145 · 🟡 · Sin sugerencias inteligentes de stock min/max
| | |
|---|---|
| **v1 hace** | Si hay investigación con `demandaEstimada`, calcula stockMinimo/Máximo sugeridos + botón aplicar |
| **v2 hace** | Stock siempre default 5/100 |
| **Bloquea UAT** | no |
| **Sugerencia** | Cuando WizardSimple integre investigación previa |

### GAP-146 · 🟢 · Detección automática de duplicados por SKU
OK · `getProximoSKU` se usa correctamente en todos los wizards.

---

## RESUMEN EJECUTIVO

### Distribución por severidad

| | Bloqueante 🔴 | Importante 🟡 | Nice-to-have 🟢 | **Total** |
|---|---|---|---|---|
| Listado | 4 | 5 | 1 | 10 |
| Detalle | 2 | 2 | 3 | 7 |
| Creación | 2 | 5 | 3 | 10 |
| Edición | 1 | 1 | 0 | 2 |
| Investigación | 3 | 4 | 1 | 8 |
| Papelera | 1 | 1 | 2 | 4 |
| Tools | 0 | 3 | 1 | 4 |
| Persistencia | 3 | 4 | 0 | 7 |
| **TOTAL** | **14** | **19** | **9** | **42** |

### Top-7 Bloqueantes a resolver YA

| # | Gap | Esfuerzo | Bloque |
|---|---|---|---|
| 1 | **GAP-001/002** Filtros de línea no funcionan + no respeta global | M+S | Listado |
| 2 | **GAP-003/007** Búsqueda y KPIs rotos por bug `investigacion?.[0]` | S | Listado |
| 3 | **GAP-020/060** Botón Editar no edita | L | Detalle/Edición |
| 4 | **GAP-021/080/081** "Investigar ahora" desconectado | S | Detalle/Investigación |
| 5 | **GAP-040/041** Wizards sin maestros ni atributos SKC | L+L | Creación |
| 6 | **GAP-082** Sin form de captura de investigación V2 | L | Investigación |
| 7 | **GAP-100** "Eliminar definitivo" miente | M | Papelera |
| 8 | **GAP-143/144** Bugs persistencia (país, presentación pack) | S+S | Persistencia |

### Decisión estratégica recomendada · Opción Puente

Para gaps **L (Edición + Form Investigación)**, recomiendo aplicar la **OPCIÓN PUENTE**:

**Reusar componentes legacy** (`ProductoForm`, `InvestigacionModal`) **abriéndolos en modal cuando V2 está activo**, con un wrapper mínimo. Esto:

- ✅ Desbloquea UAT inmediato (~2 sesiones de trabajo en lugar de 6)
- ✅ Permite iterar al diseño nativo V2 después de validar UAT
- ⚠️ Diluye temporalmente la consistencia visual canónica
- ⚠️ Mantiene la deuda técnica de los 1,723 + 836 ln legacy

**Sin opción puente:** ~6-8 sesiones para diseñar mockups + implementar nativo V2 antes de poder hacer UAT.

### Plan propuesto en fases

**Fase C · "Quick wins" bloqueantes** (~1 sesión)
- GAP-001/002 (filtros línea + global)
- GAP-003 (búsqueda nombre)
- GAP-007 (bug `.[0]` en KPI)
- GAP-021 (wiring "Investigar ahora")
- GAP-143/144 (bugs persistencia)
- GAP-080 (entry-point investigación en row)

**Fase D · Opción Puente edición + investigación** (~1.5 sesiones)
- GAP-020/060 (wrapper para ProductoForm legacy en modal V2)
- GAP-082 (wrapper para InvestigacionModal legacy en modal V2)
- GAP-085 (Re-investigar abre wrapper)

**Fase E · Wizards completos** (~2 sesiones)
- GAP-040 (maestros)
- GAP-041 (atributos SKC)
- GAP-048 (variantes SKC)
- GAP-042/043/044 (SKU preview, duplicados, sugerencias)

**Fase F · Investigación nativa V2** (~2 sesiones)
- GAP-082 (reemplazar puente por mockup nativo)
- GAP-083 (recálculo derivados)
- GAP-084/086 (marcar vista, persistir decisión)

**Fase G · Listado completo** (~1 sesión)
- GAP-004 (filtros adicionales)
- GAP-005 (paginación)
- GAP-006 (ordenamiento ampliado)
- GAP-008 (bulk actions reales)

**Fase H · Detalle + Tools mejoras** (~1 sesión)
- GAP-022/023 (kebab menu)
- GAP-024/025 (placeholder tabs)
- GAP-100 (papelera política)
- GAP-120/121/122/123 (tools persistencia)

**Total estimado:** ~8-9 sesiones para cerrar todos los bloqueantes + importantes.

---

## Lista de Mockups Requeridos

Según los gaps que necesitan diseño visual, propongo producir los siguientes mockups (en formato HTML pixel-perfect siguiendo la constitución V2):

### Mockups de Vista Completa (cambios sistémicos)

| # | Título | Cubre gaps | Prioridad |
|---|---|---|---|
| **#39** | FiltrosBar V2 ampliado + Pills sincronizadas | GAP-004, GAP-010 | Alta |
| **#40** | Modal Editar Producto (vs reutilizar legacy) | GAP-020, GAP-060 | Alta · decisión estratégica |
| **#41** | Wizard Crear con Maestros + Skincare condicional | GAP-040, GAP-041, GAP-048 | Alta |
| **#42** | Form Investigación Completa V2 (vs reutilizar legacy) | GAP-082 | Alta · decisión estratégica |
| **#43** | Listado V2 con paginación + ordenamiento ampliado | GAP-005, GAP-006 | Media |

### Mockups de Gap Individual (cambios puntuales)

| # | Título | Cubre gaps | Prioridad |
|---|---|---|---|
| **#44** | BulkActions toolbar con acciones reales | GAP-008 | Media |
| **#45** | Banner duplicados detectados (al crear) | GAP-043 | Media |
| **#46** | Modal Importar productos CSV/Excel | GAP-009 | Baja |

**Total mockups propuestos:** 8 archivos HTML

### Para 2 mockups críticos (Editar + Form Investigación) tu decisión estratégica define el approach:

- **Si elegís OPCIÓN PUENTE:** mockups #40 y #42 NO se necesitan (se reusa legacy con wrapper). Total = **6 mockups**
- **Si elegís diseño nativo V2:** mockups #40 y #42 son obligatorios. Total = **8 mockups**

---

**Documento generado:** 2026-05-02
**Autor:** Auditoría Squad ERP
**Próximo paso:** Validación del usuario + decisión sobre Opción Puente
