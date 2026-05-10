# WizardConVariantes V2 -- Diseno Funcional Completo

> Agente: `erp-business-architect` | Fecha: 2026-05-06
> Corre en paralelo con `frontend-design-specialist` (mockup HTML).
> Donde haya cruce UX/logica, se marca `[VISUAL-DECISION-N]`.

---

## 1. Modelo de datos del grupo de variantes

### 1.1 Identificador del grupo

`grupoVarianteId` es un UUID independiente generado con `crypto.randomUUID()` al momento de la creacion del grupo. NO es el ID de ningun producto. Todos los hermanos del grupo comparten el mismo valor. Esto ya funciona asi en el servicio actual (`producto.service.ts:823`) y se mantiene.

### 1.2 Producto principal del grupo

- Solo UN producto del grupo tiene `esPrincipalGrupo=true` en todo momento.
- Al crear, la primera variante de la lista es la principal por defecto. El usuario puede cambiar cual es la principal durante el wizard (antes del submit) o despues desde la card del grupo.
- Cambio de principal post-creacion: operacion liviana que solo toca dos documentos (el principal actual pasa a `false`, el nuevo pasa a `true`). No afecta datos, solo display en listados.

### 1.3 Eliminacion del principal

Si el principal se archiva (`estado='eliminado'`), el sistema auto-promueve al siguiente hermano activo con SKU mas bajo como nuevo principal. Si no quedan hermanos activos, el grupo queda "sin principal" (estado degradado). El frontend muestra un banner de advertencia invitando a reactivar o disolver.

### 1.4 Coexistencia de estados

Si. Las variantes de un grupo pueden tener estados independientes (`activo`, `inactivo`, `descontinuado`, `eliminado`). El grupo se considera "activo" si al menos una variante tiene `estado='activo'`.

### 1.5 Misma linea de negocio obligatoria

Todas las variantes de un grupo DEBEN compartir la misma `lineaNegocioId`. No se permite mezclar SKC y SUP en un mismo grupo. Validacion hard: el wizard lo fuerza por diseno (la linea se define una vez a nivel grupo).

### 1.6 Documento Firestore

Cada variante es un documento independiente en la coleccion `productos`. No existe un documento "padre" o "grupo" separado. El campo `grupoVarianteId` es el vinculo logico. Esto mantiene la arquitectura plana actual y permite que cada variante funcione como un producto completo para Stock, Ventas, ML, etc.

---

## 2. Atributos COMUNES vs POR VARIANTE

### 2.1 SIEMPRE COMUNES (definidos una vez, heredados a todas las variantes)

| Campo | Justificacion |
|-------|---------------|
| `marca` / `marcaId` | El grupo es un solo producto de una marca |
| `nombreComercial` | Nombre base identico (la diferenciacion viene del `varianteLabel`) |
| `paisOrigen` | Mismo producto, mismo origen |
| `lineaNegocioId` / `lineaNegocioNombre` | Restriccion dura: grupo = una linea |
| `atributosSkincare` (todos) | La formulacion es la misma entre tamanos |
| `atributosSuplementos` (parcial: `momentoDia`, `tomaConComida`, `edadRecomendada`, `restricciones`, `advertencias`) | Propiedades de la formula, no del envase |
| `tipoProductoId` / `categoriaIds` / `etiquetaIds` | Clasificacion identica |

### 2.2 SIEMPRE POR VARIANTE

| Campo | Justificacion |
|-------|---------------|
| `id` (doc ID) | Cada variante es un documento Firestore separado |
| `sku` | Autogenerado, secuencial, distinto por variante |
| `contenidoNeto: { valor, unidad }` | Eje primario de variacion |
| `varianteLabel` | Display: "90 capsulas", "180 capsulas - Limon" |
| `codigoUPC` | Cada presentacion tiene su propio codigo de barras GS1 |
| `estado` | Activo/inactivo independiente |
| `stockUSA` / `stockPeru` / `stockTransito` / `stockReservado` / `stockDisponible` | Inventario propio |
| `ctruPromedio` | Costo unitario propio (distintos tamanos = distintos costos) |
| `investigacion` | Precios USA/Peru varian por tamano |
| `esPrincipalGrupo` | Solo una es `true` |
| `pesoLibras` | OPCIONAL al crear. Proporcional al contenido. Se confirma al recibir el producto en destino (Peru). El usuario puede dejarlo vacio o ingresar una estimacion inicial; el peso real se actualiza desde el modulo Stock al recibir la unidad. NO bloquea la creacion ni la activacion de la variante. |

### 2.3 POLITICA PARA CAMPOS OPCIONALES

**Sabor:**
- POLITICA DEFAULT: si todas las variantes tienen el mismo sabor, se define en los atributos comunes (SUP: `atributosSuplementos.sabor`).
- Si el sabor es eje de variacion (ej. Limon, Fresa, Sin sabor), entonces sabor se define POR VARIANTE en la fila de la matriz y se copia a `producto.sabor` y `atributosSuplementos.sabor` de cada documento individual.
- El wizard detecta esto automaticamente: si el usuario elige "sabor" como segundo eje, el campo sabor desaparece de los datos comunes y aparece como columna en la matriz.

**Dosaje (`atributosSuplementos.dosaje`):**
- POLITICA DEFAULT: es COMUN. La gran mayoria de variantes del mismo producto tienen identico dosaje por porcion.
- Excepcion rara (variante "concentrada"): se resuelve como grupo separado, no como variante. Si 90 caps x 500mg y 90 caps x 1000mg son productos distintos (distinta formulacion), se crean como dos productos unicos o dos grupos distintos. NO como variantes del mismo grupo.
- Justificacion: mantener la invariante de que "variantes = mismo producto, distinto envase".

**Marketing (`descripcionMarketing`):**
- DECISION: opcion B (denormalizado). Cada variante almacena su propia copia del marketing.
- Al crear el grupo, la generacion de IA se ejecuta una vez y el resultado se copia a todas las variantes.
- Edicion post-creacion: el usuario puede regenerar para todo el grupo desde cualquier variante (boton "Regenerar para las N variantes"). Tambien puede editar una variante individual sin afectar a las hermanas.
- El prompt de IA recibe como contexto "disponible en N presentaciones: 90/180/360 capsulas" para que la descripcion sea generica y aplique a cualquier tamano.

---

## 3. Ejes de variacion y matriz combinatoria

### 3.1 Ejes permitidos

| Eje | Tipo | Obligatorio |
|-----|------|-------------|
| Contenido/Tamano | Primario | SI, siempre presente |
| Sabor | Secundario | Opcional, el usuario lo activa |

Maximo 2 ejes simultaneos. Un tercer eje (ej: "concentracion") no se soporta en el wizard para mantener la UX manejable. Si el negocio requiere un tercer eje, se resuelve como grupos separados.

### 3.2 Eje primario: Contenido/Tamano

Siempre presente. El usuario agrega filas con `{ contenidoNeto.valor, contenidoNeto.unidad }`. Ejemplo: 90 capsulas, 180 capsulas, 360 capsulas.

La unidad es la misma para todas las filas (forzado por el wizard: se hereda de la unidad default de la linea o la que el usuario elija una vez). Si un producto tiene variantes en ml y en g, son grupos distintos.

### 3.3 Eje secundario: Sabor

Cuando el usuario activa sabor como segundo eje, la UI pasa de una lista de filas a una matriz visual:

```
              | Sin sabor | Limon | Fresa
90 capsulas   |    [x]    |  [x]  |  [x]
180 capsulas  |    [x]    |  [x]  |  [ ]
360 capsulas  |    [x]    |  [ ]  |  [ ]
```

### 3.4 Huecos en la matriz

SI se permiten. No es obligatorio crear todas las combinaciones. El usuario marca con checkbox cuales existen. Esto refleja la realidad del negocio: no todas las combinaciones existen fisicamente.

### 3.5 Validacion de duplicados

Dos filas con el mismo par `(contenidoNeto.valor + sabor)` son duplicado. El wizard lo detecta en tiempo real y marca la fila con error, bloqueando el avance.

### 3.6 Limites

- Minimo: 2 variantes (si es 1, usar wizard de producto unico).
- Maximo: 12 variantes. Limite pragmatico para UX y para que el batch write de Firestore sea eficiente.
- Maximo eje contenido: 6 filas.
- Maximo eje sabor: 6 columnas.

---

## 4. Generacion de SKU

### 4.1 Regla fundamental

Cada variante recibe un SKU distinto y secuencial. Si el prefijo es SUP y el proximo numero es 171, crear 5 variantes genera SUP-0171 a SUP-0175.

### 4.2 Asignacion manual

NO permitida. Siempre autogenerado via `getNextSequenceNumber(prefix, 4)` para consistencia con la defensa anti-duplicados de S3.4.

### 4.3 Preview de SKU antes del submit

El wizard llama a `peekNextSequenceNumber(prefix)` al cargar el paso de confirmacion. Muestra SKUs tentativos: "SUP-0171 (tentativo) ... SUP-0175 (tentativo)". Un aviso explica que los numeros finales pueden diferir si otro usuario crea productos concurrentemente.

### 4.4 Consumo atomico

En el submit, el servicio `createConVariantes` llama `generateSKU(prefix)` secuencialmente N veces (una por variante). Cada llamada usa `runTransaction` para incrementar el contador. Los documentos se persisten con `writeBatch.commit()` para atomicidad.

### 4.5 Rollback

Si el batch commit falla, los contadores ya fueron incrementados (las transacciones de contador son independientes del batch). Esto genera huecos en la secuencia SKU. Es aceptable: un hueco es preferible a un duplicado. No se intenta rollback de contadores.

---

## 5. Marketing IA a nivel grupo

### 5.1 Una generacion para todo el grupo

La Cloud Function `generarDescripcionProducto` recibe los datos comunes + la lista de variantes como contexto. El prompt incluye: "Este producto esta disponible en las siguientes presentaciones: [lista]". La descripcion resultante es generica respecto al tamano.

### 5.2 Tagline y beneficios

Aplican a la marca + ingrediente/formula, no al tamano. Son identicos para todas las variantes del grupo.

### 5.3 Storage

Opcion B: denormalizado. Cada documento de variante almacena una copia de `descripcionMarketing`. Esto permite:
- Lectura sin joins (cada variante es self-contained).
- Edicion independiente posterior si se necesita.
- El campo `keywordsSEO` es compartido (mismas keywords para todo el grupo).

### 5.4 Regeneracion

Desde cualquier variante, el usuario puede ejecutar "Regenerar marketing para todo el grupo". Esto:
1. Llama a la CF con datos actualizados.
2. Escribe el nuevo `descripcionMarketing` en TODAS las variantes del grupo via batch update.
3. Los campos de audit (`fuente`, `generadoEn`, `generadoPor`) se actualizan en todas.

Si el usuario edita el marketing de UNA variante sin regenerar, esa variante diverge (su `fuente` pasa a `manual` o `mixto`). Las hermanas no se tocan.

### 5.5 En el wizard de creacion

Marketing IA es OPCIONAL para crear el grupo (igual que en WizardProductoV2). El boton "Generar con IA" se habilita cuando los datos comunes y al menos 2 variantes estan completas. Si el usuario no genera, las variantes se crean sin `descripcionMarketing` y se puede generar despues desde el editor.

---

## 6. Validaciones del wizard

### 6.1 Validaciones de datos comunes (Paso 1)

| Check | Condicion | Bloquea |
|-------|-----------|---------|
| Linea de negocio | `lineaNegocioId` no vacio | Si |
| Marca | `marca.trim().length > 0` Y `marcaId` definido | Si |
| Nombre comercial | `nombreComercial.trim().length > 0` | Si |
| Pais origen | Valor valido de la lista | Si |
| Atributos minimos SKC | Si es SKC: `atributosSkincare.tipoProductoSKC` definido | Si |
| Atributos minimos SUP | Si es SUP: `servingsDia > 0` | Si |

### 6.2 Validaciones de la matriz de variantes (Paso 2)

| Check | Condicion | Bloquea |
|-------|-----------|---------|
| Minimo 2 variantes | `variantes.length >= 2` | Si |
| Maximo 12 variantes | `variantes.length <= 12` | Si |
| Contenido neto > 0 | Cada variante: `contenidoNeto.valor > 0` | Si |
| Unidad valida | Cada variante: unidad incluida en `UNIDADES_{linea}` | Si |
| Sin duplicados | No hay dos variantes con mismo `(valor + sabor)` | Si |
| Una principal | Exactamente una variante tiene `esPrincipalGrupo=true` | Si |
| varianteLabel | Autogenerado y unico. Si el usuario lo edita manualmente, se valida unicidad | Si |
| UPC unico | Si se ingresa UPC: no repetir entre variantes del grupo | Warning, no bloquea |

### 6.3 Validaciones de logistica (Paso 3 - opcional)

| Check | Condicion | Bloquea |
|-------|-----------|---------|
| Peso > 0 si presente | `pesoLibras > 0 || vacio` | Si (no acepta 0 o negativo) |

### 6.4 Validacion pre-submit global

```
canSubmit = datosComunes_OK
         && variantes.length >= 2
         && variantes.every(v => v.contenidoNeto.valor > 0)
         && sinDuplicados
         && exactamente_un_principal
         && !submitting
```

---

## 7. Operaciones post-creacion

### 7.1 Agregar variante a grupo existente

SI soportado. Entry point: boton "Agregar variante" visible en la card de grupo o en el detalle de cualquier variante.

Flujo:
1. Abre un mini-wizard de 2 pasos: (a) definir contenidoNeto + sabor + UPC + peso, (b) confirmar.
2. Los datos comunes se heredan del grupo existente (se leen del principal).
3. Se genera un nuevo SKU via `getNextSequenceNumber`.
4. Se crea un unico documento con `grupoVarianteId` del grupo y `esPrincipalGrupo=false`.
5. Si el grupo tiene `descripcionMarketing`, se copia al nuevo documento.

### 7.2 Editar atributos comunes desde una variante

SI soportado. El editor muestra una seccion "Atributos de grupo" con un banner: "Cambiar estos campos afectara las N variantes del grupo".

Al guardar, se ejecuta un batch update que toca todos los documentos del grupo (query por `grupoVarianteId`). Los campos afectados: marca, nombreComercial, paisOrigen, atributosSkincare, atributosSuplementos, tipoProductoId, categoriaIds, etiquetaIds.

Los campos POR VARIANTE (contenidoNeto, sabor, peso, UPC, stock, costos) NO se propagan.

### 7.3 Eliminar una variante

Soft-delete: `estado='eliminado'` + `fechaEliminacion` + `eliminadoPor`. No afecta a las hermanas. Si era la principal, se auto-promueve otra (ver 1.3).

Si despues de eliminar queda solo 1 variante activa, esa variante se "desagrupa" automaticamente: su `grupoVarianteId` se limpia y pasa a ser producto unico. Justificacion: un grupo de 1 no tiene sentido funcional.

### 7.4 Disolver el grupo

Operacion rara pero disponible. Todas las variantes pierden `grupoVarianteId`, `esPrincipalGrupo`, y `varianteLabel`. Quedan como productos independientes con sus SKUs originales intactos.

Requiere confirmacion explicita: "Esto separara las N variantes en productos independientes. Los datos de cada variante se conservan."

### 7.5 Cambiar el principal

Transferencia de `esPrincipalGrupo=true`. Solo afecta display (cual aparece primero en listados, cual es el "representante" del grupo). No mueve datos. Dos updates atomicos (el actual a false, el nuevo a true).

---

## 8. Casos de uso -- escenarios reales

### Caso 1: SUP simple -- 3 tamanos, mismo sabor

**Contexto:** Omega 3 EPA/DHA de Now Foods. 90/180/360 softgels. Sin sabor.

**En el wizard:**
- Paso 1 (Datos comunes): Linea=SUP, Marca=Now Foods, Nombre="Omega 3 EPA/DHA", Pais=USA. Atributos SUP: servings/dia=1, momento=Cualquiera, toma=con_comida. Clasificacion: Tipo="Omega 3 EPA/DHA", Categorias=["Cardiovascular","Antiinflamatorio"].
- Paso 2 (Variantes): Eje=Contenido. 3 filas: 90 softgels, 180 softgels, 360 softgels. Principal=90 softgels. Sin segundo eje.
- Paso 3 (Logistica): Peso por variante: 0.25 lb, 0.42 lb, 0.78 lb.
- Paso 4 (Marketing IA): Generar con IA. Output: tagline + beneficios + descripcion mencionando "disponible en 3 presentaciones".
- Paso 5 (Confirmar): Preview de 3 SKUs tentativos (SUP-0171, SUP-0172, SUP-0173).

**Documentos Firestore creados:** 3 documentos en `productos`, todos con `grupoVarianteId=<uuid>`. El de 90 softgels tiene `esPrincipalGrupo=true`.

### Caso 2: SUP con matriz -- 2 tamanos x 3 sabores

**Contexto:** Proteina Whey de Optimum Nutrition. 2 lb y 5 lb. Chocolate, Vainilla, Fresa.

**En el wizard:**
- Paso 1: Datos comunes sin sabor (porque varia).
- Paso 2: Eje primario=Contenido (2 filas: 2 lb, 5 lb). Eje secundario=Sabor activado (3 columnas: Chocolate, Vainilla, Fresa). Matriz 2x3=6 celdas. El usuario desmarca "5 lb - Fresa" porque no existe. Total: 5 variantes.
- Principal: 5 lb Chocolate (el mas vendido).

**Documentos Firestore:** 5 documentos. Cada uno tiene su `sabor` y `contenidoNeto` propios. El campo `atributosSuplementos.sabor` de cada documento refleja su sabor individual.

### Caso 3: SKC simple -- mismo producto en 30ml y 50ml

**Contexto:** Madeca Cream de Centellian24. 50ml y 70ml.

**En el wizard:**
- Paso 1: Linea=SKC, atributos Skincare completos (tipo=crema, ingrediente clave=Centella Asiatica TECA, etc.). Sin eje sabor.
- Paso 2: 2 filas: 50 ml, 70 ml. Unidad forzada=ml (linea SKC).
- Sin Marketing IA (se genera despues).

**Documentos Firestore:** 2 documentos. Ambos comparten `atributosSkincare`. Cada uno tiene su `contenidoNeto` propio.

### Caso 4: Variante "concentrada" -- distinto dosaje

**Contexto:** Vitamina D3 1000 IU vs Vitamina D3 5000 IU, ambas 60 capsulas.

**Decision de negocio:** Esto NO es un grupo de variantes. Son dos productos distintos (distinta formulacion). Se crean como dos productos unicos via WizardProductoV2. La invariante "mismo producto, distinto envase" no se cumple.

Si el usuario intenta meterlos como variantes con mismo contenido (60 capsulas x2), la validacion de duplicados lo bloquea (mismo valor + mismo sabor = duplicado). Esto es el comportamiento correcto por diseno.

### Caso 5: Agregar variante a grupo existente

**Contexto:** El grupo Omega 3 (Caso 1) ya existe con 3 variantes. Llega una presentacion nueva de 500 softgels.

**Flujo:**
1. Desde la card del grupo o detalle de cualquier variante, click "Agregar variante".
2. Mini-wizard: contenido=500 softgels, UPC=nuevo, peso=1.2 lb.
3. Submit: crea documento con `grupoVarianteId` del grupo, SKU=SUP-0174, `esPrincipalGrupo=false`.
4. Si el grupo tenia `descripcionMarketing`, se copia al nuevo documento. Banner: "Recomendado regenerar marketing para incluir la nueva presentacion".

### Caso 6: Producto unico que se convierte en variante

**Contexto:** Existia "Vitamina C 500mg - 60 caps" como producto unico. Ahora llega "Vitamina C 500mg - 120 caps".

**Flujo:**
1. Desde la card del producto unico, click "Crear grupo de variantes".
2. El sistema genera un `grupoVarianteId` nuevo.
3. Actualiza el producto existente: agrega `grupoVarianteId`, `esPrincipalGrupo=true`, `varianteLabel="60 capsulas"`.
4. Abre el mini-wizard de agregar variante para crear la nueva (120 caps).
5. Resultado: grupo de 2 variantes con SKUs distintos (el original mantiene su SKU).

### Caso 7: Pack que contiene variante especifica

**Contexto:** Pack "Inmunidad Total" contiene Vitamina C 60 caps (variante de un grupo) + Zinc 60 tabs (producto unico).

**Regla:** Los packs referencian un `productoId` especifico. Si el componente es una variante, se vincula al ID de ESA variante concreta (no al grupo). En el selector de componentes del pack, las variantes de un grupo aparecen como opciones individuales con su `varianteLabel` para desambiguar: "Vitamina C 500mg -- 60 capsulas (SUP-0171)" vs "Vitamina C 500mg -- 120 capsulas (SUP-0172)".

---

## 9. Conexion con WizardProductoV2

### 9.1 Conversion en linea

NO soportada. Si el usuario empieza un producto unico y despues necesita variantes, debe cerrar el wizard unico y abrir el wizard de variantes. Los datos no se transfieren automaticamente (distinta estructura de estado).

Justificacion: la complejidad de migrar estado entre wizards no justifica el edge case. El wizard de variantes tiene un paso extra (la matriz) y un modelo de datos distinto.

### 9.2 Entry point alternativo

Desde la card de un producto unico existente: boton "Crear grupo de variantes" (ver Caso 6). Esto NO abre el wizard completo sino un flujo simplificado que:
1. Convierte el producto actual en principal del grupo.
2. Pide los datos de la nueva variante (contenido + UPC + peso).
3. Crea el nuevo documento.

### 9.3 Dos wizards, una seccion comun

Los pasos de datos comunes (identidad + atributos por linea + clasificacion) son identicos entre WizardProductoV2 y WizardConVariantesV2. Ambos reutilizan los componentes compartidos:
- `<AtributosPorLineaSection>`
- `<MarketingComercialSection>`
- `<MaestroSelect>` / `<MaestroChipsMulti>`
- `<ChipDuracionEnvase>` (aparece por cada variante SUP en la tabla, no como pieza global)

---

## 10. Riesgos funcionales identificados

### RIESGO-001: Stock multi-variante en cotizaciones

**Problema:** Cuando un cliente pide "Omega 3", cual variante se ofrece?
**Mitigacion:** En el modulo de ventas, la busqueda de productos muestra las variantes de un grupo como items individuales con su `varianteLabel` y stock disponible. El vendedor elige la variante especifica. No se vende "el grupo" sino una variante concreta.
**Probabilidad:** Baja (ya es asi en el sistema actual).

### RIESGO-002: ML mapping por variante

**Problema:** Cada variante necesita su propio listing en Mercado Libre. No se pueden mergear.
**Mitigacion:** El modulo ML ya mapea por `productoId`. Cada variante tiene su propio ID, por lo que el mapeo natural funciona. El pipeline de sync publica/actualiza cada variante como listing independiente. La agrupacion de variantes en ML se maneja con el atributo `PARENT_SKU` de la API de ML (futuro).
**Probabilidad:** Media. Requiere verificar que el sync no intente agrupar variantes.

### RIESGO-003: Analisis de rentabilidad

**Problema:** Reportar por grupo o por variante?
**Mitigacion:** Por variante con totales de grupo. El BI calcula margen, CTRU, y rotacion por variante (cada una tiene su propia `investigacion` y `ctruPromedio`). Los dashboards muestran opcionalmente una fila resumen del grupo (suma de stock, promedio ponderado de CTRU, etc.).
**Probabilidad:** Baja.

### RIESGO-004: Cambios masivos en cascada

**Problema:** Cambiar el tipoProducto o las categorias del grupo afecta todas las variantes.
**Mitigacion:** El batch update es atomico (Firestore batch). Se muestra un dialogo de confirmacion antes: "Este cambio afectara N variantes". Si el batch falla, ninguna variante se actualiza. Con 12 variantes max, el batch esta muy lejos del limite de 500 ops de Firestore.
**Probabilidad:** Baja.

### RIESGO-005: Concurrencia en creacion de SKUs

**Problema:** Si dos usuarios crean variantes simultaneamente, los SKUs del preview pueden no coincidir con los finales.
**Mitigacion:** Ya cubierto por diseno. El preview dice "(tentativo)" y los SKUs reales se asignan al momento del submit via transacciones atomicas. El peor caso es un desface estetico en la pantalla de confirmacion.
**Probabilidad:** Muy baja (un solo operador crea productos).

### RIESGO-006: Producto unico convertido a grupo pierde consistencia

**Problema:** Al convertir un producto unico en grupo, su `varianteLabel` no existia antes. Otros modulos que renderizan ese producto no esperan ese campo.
**Mitigacion:** El `varianteLabel` es opcional en toda la UI existente (los productos unicos no lo tienen y se renderizan con `contenido` o `nombreComercial` directo). Al agregar el campo, la UI existente lo ignora o lo muestra como contexto adicional. No es breaking.
**Probabilidad:** Baja.

---

## Apendice A: Estructura del wizard (pasos)

El wizard usa el patron F5 del canonico: 4+ pasos = Sidebar vertical (desktop) / stepper horizontal (mobile).

| Paso | Titulo | Contenido |
|------|--------|-----------|
| 1 | Datos comunes | Identidad + Atributos por linea + Clasificacion |
| 2 | Variantes | Eje primario (contenido) + eje secundario opcional (sabor) + matriz + principal |
| 3 | Por variante | UPC + peso + preview SKU tentativo por cada variante (tabla editable) |
| 4 | Marketing IA | Generacion opcional para el grupo (reutiliza MarketingComercialSection) |
| 5 | Confirmar | Resumen completo + SKUs tentativos + boton "Crear N variantes" |

[VISUAL-DECISION-1] El paso 2 necesita una UI de matriz cuando el segundo eje esta activo. El frontend-design-specialist define el layout exacto (tabla editable vs lista de cards).

[VISUAL-DECISION-2] El paso 3 (por variante) puede ser tabla inline o accordion. Depende del espacio. Frontend-design-specialist decide.

---

## Apendice B: Calculo de duracion (ChipDuracionEnvase) por variante

Para SUP, el chip de duracion del envase se calcula individualmente por variante usando la formula de `calcularDuracionEnvase`:

```
duracionDias = contenidoNeto.valor / servingsPerDay
```

`servingsPerDay` se define a nivel grupo (es un dato de la formula, no del envase). `contenidoNeto.valor` varia por variante. Resultado: la variante de 90 capsulas con 1 serving/dia = 90 dias, la de 180 = 180 dias.

El chip aparece en el paso 3 del wizard al lado de cada fila de variante (solo para SUP).

---

## Apendice C: Diferencias con el wizard legacy (WizardConVariantes.tsx actual)

| Aspecto | Legacy (actual) | V2 (este diseno) |
|---------|----------------|-------------------|
| Estructura | 4 pasos: datos + config + stock + confirmar | 5 pasos: datos + variantes + por-variante + marketing + confirmar |
| Contenido neto | String libre (`cantidad` + `unidad` texto) | Estructurado: `ContenidoNeto { valor: number, unidad: UnidadContenido }` |
| Eje de variacion | 4 opciones fijas (volumen/contenido/sabor/otro) | 2 ejes: contenido (obligatorio) + sabor (opcional, activable) |
| Sabor | Campo libre en etiqueta | Eje de matriz cuando esta activo |
| Marketing IA | No existe | Integrado, opcional, reutiliza MarketingComercialSection |
| Atributos por linea | Inline con 20+ props | Reutiliza AtributosPorLineaSection compartido |
| SKU preview | Derivado del nombre | Real via peekNextSequenceNumber |
| Stock inicial | Paso 3 dedicado | Se elimina: stock arranca en 0, se ajusta desde modulo Stock |
| Precio venta | Input en paso 3 | Se elimina: vive en Investigacion de mercado |
| Costo flete | Input en paso 1 | Eliminado (vive en envios/OC segun ruta+peso) |
| Stock min/max | Input en paso 1 | Eliminado (vive en modulo Stock con sugerencias auto) |
| UPC | No incluido | Por variante en paso 3 |
| Peso | Campo comun | Por variante en paso 3 |
| Duracion envase | No existe | Chip calculado en vivo por variante (solo SUP) |
| Segundo eje | No soportado | Sabor como segundo eje con matriz visual |

---

## 11. Lifecycle de la variante en el negocio

### 11.1 Modelo de datos en Firestore

Cada variante es un **documento independiente** en la coleccion `productos`. No existe una coleccion o documento "grupo" separado. El campo `grupoVarianteId` (UUID compartido) es el unico vinculo logico entre hermanas. Un solo documento del grupo tiene `esPrincipalGrupo: true`.

**Por que este modelo y no un unico documento padre con array de variantes:**

1. **Firestore no soporta queries dentro de arrays anidados.** Un array de variantes dentro de un doc padre obligaria a leer el documento completo para filtrar por stock, estado, precio o SKU de una variante especifica. Con documentos separados, cada variante es indexable y queryable de forma independiente.

2. **Mercado Libre requiere listings separados.** Cada variante necesita su propio `mlProductMap` entry, su propio `mlItemId`, su propio push de stock. Un array dentro de un doc padre forzaria a descomponer y recomponer en cada sync -- complejidad innecesaria y fuente de bugs.

3. **Stock y costos son por variante.** Cada presentacion tiene su propio `stockUSA`, `stockPeru`, `stockTransito`, `stockReservado`, `ctruPromedio`. Un array anidado haria las operaciones de stock (reservar, transferir, ajustar) mucho mas costosas en escritura y propensas a colisiones de concurrencia.

4. **El CTRU (costo total real unitario) se calcula por SKU.** Un envase de 90 capsulas tiene distinto costo de flete, internacion y handling que uno de 360. Documentos separados permiten que el pipeline de costeo opere sin modificaciones.

5. **Reportes y BI usan queries planas.** Agrupar por `grupoVarianteId` para totales de grupo es trivial con un `where` o `GROUP BY`. Desanidar un array para obtener metricas por variante seria costoso y forzaria ETL adicional.

**Modelo legacy coexistente:** El sistema actual mantiene campos legacy (`parentId`, `esPadre`, `esVariante`) junto con el modelo V2 (`grupoVarianteId`, `esPrincipalGrupo`). La funcion `vincularComoVariante` en `producto.service.ts:714` escribe ambos modelos simultaneamente. La funcion `getVariantes` (linea 688) busca primero por `grupoVarianteId` y hace fallback a `parentId`. El wizard V2 solo escribe el modelo nuevo; el legacy se mantiene para compatibilidad con datos pre-existentes.

**Problema critico del legacy:** `vincularComoVariante` usa el `parentId` (doc ID del producto padre) como `grupoVarianteId`. Esto viola la regla del modelo V2 donde `grupoVarianteId` debe ser un UUID independiente (ver seccion 1.1). En `createConVariantes` (linea 823) se genera correctamente con `crypto.randomUUID()`. Hay una inconsistencia entre los dos flujos de creacion que la V2 debe resolver: al migrar, todos los grupos legacy deben recibir un UUID unico y limpiar la contaminacion `grupoVarianteId === parentId`.

### 11.2 Atributos heredados vs propios -- detalle operativo

La seccion 2 de este documento define QUE es comun y que es por variante. Esta seccion explica COMO se maneja operativamente.

**Denormalizacion al crear (clonado en escritura):**

Al crear un grupo via `createConVariantes`, los datos comunes se clonan literalmente en cada documento de variante. Cada variante recibe su propia copia de `marca`, `marcaId`, `nombreComercial`, `paisOrigen`, `lineaNegocioId`, `tipoProductoId`, `categoriaIds`, `etiquetaIds`, `atributosSkincare`, `atributosSuplementos`, etc. No hay referencia a un documento central -- cada variante es self-contained.

**Propagacion al editar (batch update con confirmacion):**

Cuando el usuario edita un atributo comun desde cualquier variante del grupo:

1. La UI detecta que el campo es comun (pertenece a la tabla 2.1).
2. Muestra un dialogo de confirmacion: "Este cambio afectara las N variantes del grupo".
3. Si confirma, ejecuta un batch update: query por `grupoVarianteId`, actualiza el campo en todos los docs.
4. Los campos por variante (tabla 2.2) se guardan solo en el documento editado, sin propagacion.

**Costo de la denormalizacion:**

| Operacion | Costo | Frecuencia |
|-----------|-------|------------|
| Lectura de variante individual | 1 read (self-contained, sin join) | Muy alta |
| Creacion del grupo | N writes (una por variante) | Baja |
| Edicion de atributo comun | N writes (propagacion) | Baja |
| Edicion de atributo por variante | 1 write | Media |

La denormalizacion optimiza las lecturas (que son ordenes de magnitud mas frecuentes que las escrituras) a costa de complejidad en la propagacion de cambios comunes. Con un maximo de 12 variantes por grupo, el batch de propagacion esta muy lejos del limite de 500 ops de Firestore.

**Riesgo de desincronizacion:**

Si un batch update de propagacion falla parcialmente (Firestore batches son atomicos, asi que esto no ocurre con batch nativo), las variantes podrian diverger en datos comunes. Mitigation: el batch es atomico. Si falla, ninguna variante se actualiza. Ademas, se puede implementar un job de reconciliacion que compara `marca`, `nombreComercial`, etc. entre hermanas y alerta si detecta divergencia.

**Tabla exhaustiva de herencia:**

| Campo | Comun/Variante | Al crear | Al editar comun | Al editar variante |
|-------|----------------|----------|-----------------|-------------------|
| `marca` / `marcaId` | Comun | Clonado | Propagado a N | N/A (no editable por variante) |
| `nombreComercial` | Comun | Clonado | Propagado a N | N/A |
| `paisOrigen` | Comun | Clonado | Propagado a N | N/A |
| `lineaNegocioId` / `lineaNegocioNombre` | Comun | Clonado | Inmutable post-creacion | N/A |
| `tipoProductoId` / `tipoProducto` | Comun | Clonado | Propagado a N | N/A |
| `categoriaIds` / `categorias` | Comun | Clonado | Propagado a N | N/A |
| `etiquetaIds` / `etiquetasData` | Comun | Clonado | Propagado a N | N/A |
| `atributosSkincare` (todos) | Comun | Clonado | Propagado a N | N/A |
| `atributosSuplementos` (formula) | Comun | Clonado | Propagado a N | N/A |
| `descripcionMarketing` | Comun (denorm) | Clonado | "Regenerar para N" (opcional) | Edicion individual OK |
| `sku` | Variante | Autogenerado unico | N/A | Inmutable |
| `contenidoNeto` | Variante | Definido por variante | N/A | Solo ese doc |
| `varianteLabel` | Variante | Autogenerado | N/A | Solo ese doc |
| `codigoUPC` | Variante | Definido por variante | N/A | Solo ese doc |
| `pesoLibras` | Variante | Definido por variante | N/A | Solo ese doc |
| `sabor` (cuando es eje) | Variante | Definido por variante | N/A | Solo ese doc |
| `estado` | Variante | `activo` default | N/A | Solo ese doc |
| `stockUSA/Peru/Transito/Reservado` | Variante | 0 | N/A | Solo ese doc |
| `ctruPromedio` | Variante | 0 | N/A | Calculado por pipeline |
| `investigacion` | Variante | Vacio | N/A | Solo ese doc |
| `esPrincipalGrupo` | Variante | true para 1 | N/A | Transferencia entre 2 docs |

### 11.3 Comportamiento por modulo

**COMPRAS (Ordenes de Compra):**

- Una OC puede mezclar multiples variantes del mismo producto (ej: 100 unidades de Omega3 90caps + 50 de Omega3 180caps) siempre que compartan proveedor.
- Cada linea de la OC referencia un SKU especifico (no el grupo). El campo `productoId` en `LineaOrdenCompra` apunta al documento de la variante concreta.
- En consolidacion USA (pre-despacho a Peru), las variantes se mezclan fisicamente en el mismo envio. El envio contiene N lineas, cada una con su SKU.
- El costo de flete se proratea por peso (`pesoLibras` de cada variante) y se imputa al CTRU de cada SKU.

**STOCK / INVENTARIO:**

- Cada variante tiene contadores independientes: `stockUSA`, `stockPeru`, `stockTransito`, `stockReservado`, `stockDisponible`.
- Los movimientos de stock (entrada, salida, transferencia, ajuste) operan sobre un `productoId` especifico = una variante concreta.
- El reorden inteligente se basa en demanda historica POR VARIANTE. La variante de 90 caps puede tener reorden en 50 unidades y la de 360 caps en 20 unidades.
- `stockEfectivoML` (stock empujado a Mercado Libre) se calcula por variante individual.
- La vista de stock del grupo muestra un resumen agregado (sum por almacen) con drill-down a cada variante.

**VENTAS Y COTIZACIONES:**

- `ProductoSearchVentas` muestra TODAS las variantes de un grupo como items individuales. El vendedor ve: "Omega 3 EPA/DHA -- 90 softgels (SUP-0171) | Stock: 45" y "Omega 3 EPA/DHA -- 180 softgels (SUP-0172) | Stock: 12" como opciones separadas.
- El filtro `extraFilter` en `ProductoSearchVentas` (linea 93) ya excluye padres sin `varianteLabel` para evitar seleccionar el "grupo abstracto".
- La venta se registra con el SKU especifico de la variante. El campo `productoId` en `LineaVenta` apunta al documento de la variante.
- `venta.service.ts` (linea 283) propaga `grupoVarianteId` y `varianteLabel` al snapshot de la linea de venta para facilitar reportes.
- Si una variante esta sin stock, se muestra con stock=0 pero el sistema ofrece las hermanas con stock disponible como alternativa visual (chips de hermanas).

**MERCADO LIBRE:**

- Cada variante = listing independiente en ML. ML rechaza SKU duplicado dentro de la misma cuenta, lo que refuerza la necesidad de documentos separados.
- `mlProductMap` (coleccion) mapea `productoId` (variante) a `mlItemId` (listing ML). No existe concepto de "grupo" en ML.
- `mlOrderSync` asocia ventas ML al `productoId` correcto via el `mlItemId` del listing.
- El stock se empuja por variante: `inventario.service.ts` calcula `stockEfectivoML` por producto y lo sincroniza individualmente.
- Nota para futuro: la API de ML soporta `PARENT_SKU` para agrupar variantes visualmente en un listing padre. Esto es una integracion futura que no afecta el modelo de datos del ERP (solo agrega un atributo al publicar).

**REPORTES Y BI:**

- KPIs primarios son POR VARIANTE: unidades vendidas, margen bruto, margen porcentual, rotacion de inventario, dias para quiebre.
- Totales de grupo se obtienen por agregacion: `SELECT ... FROM ventas WHERE grupoVarianteId = ? GROUP BY grupoVarianteId`.
- Drill-down: el dashboard muestra primero la fila del grupo (agregada) y al expandir muestra cada variante con sus metricas individuales.
- `ProductoRowCard` ya muestra variantes como avatars apilados (`VariantesApiladas`) con sparkline de ventas por grupo.
- El CTRU promedio del grupo se calcula como promedio ponderado por stock: `sum(ctru_i * stock_i) / sum(stock_i)`.

**PACKS:**

- Un pack contiene variantes especificas como componentes. El campo `componentes[]` del pack almacena `productoId` que apunta al documento de una variante concreta.
- Ejemplo: "Pack Cold & Flu" contiene SUP-0171 (Omega 3 90 caps) especificamente. No "cualquier Omega 3 del grupo".
- En el selector de componentes del pack (`ProductoAutocomplete`, linea 103), la agrupacion visual usa `grupoVarianteId` pero la seleccion es por variante individual.
- Regla ya implementada: "vender pack NO descuenta stock de variantes vinculadas" (banner ambar en mockups #14 y #20).

**ENTREGAS Y ENVIOS:**

- Cada linea de envio referencia un SKU de variante especifica.
- El peso total del envio se calcula sumando `pesoLibras` de cada variante por su cantidad.
- Al recibir en Peru, el stock se incrementa en la variante especifica.

### 11.4 Reglas criticas (permitido / prohibido)

**PERMITIDO:**

| Operacion | Condiciones |
|-----------|-------------|
| Variantes que comparten linea, marca, formulacion | Invariante fundamental del grupo |
| Diferir en tamano (contenidoNeto) | Eje primario, siempre presente |
| Diferir en sabor | Eje secundario, cuando esta activo |
| Diferir en UPC, stock, costos, precios, investigacion, peso | Campos por variante por definicion |
| Editar atributos comunes desde cualquier variante | Con dialogo de confirmacion + batch propagation |
| Agregar nuevas variantes a grupo existente | Via WizardVarianteExistenteV2 |
| Eliminar una variante (soft-delete) | Sin afectar hermanas; auto-promocion de principal si aplica |
| Auto-promocion de principal | Si el principal se elimina, la hermana activa con SKU mas bajo toma el rol |
| Desagrupar (grupo de 1 se disuelve) | Si queda 1 sola variante activa, pierde `grupoVarianteId` automaticamente |
| Disolver grupo completo | Todas las variantes pasan a ser productos independientes (operacion rara, con confirmacion) |
| Marketing individual divergente | Una variante puede editar su marketing sin afectar a las hermanas |
| Regenerar marketing para todo el grupo | Desde cualquier variante, batch update a todas |

**PROHIBIDO:**

| Operacion | Razon |
|-----------|-------|
| Mezclar lineas de negocio (SUP + SKC en mismo grupo) | Invariante dura. La linea define atributos, unidades, clasificacion |
| Mezclar marcas dentro del grupo | Un grupo = un producto de una marca. Distinta marca = distinto producto |
| Variantes con dosaje muy distinto (500mg vs 1000mg) | Distinto dosaje = distinta formulacion = distinto producto. Se crean como grupos separados |
| Asignar SKU manualmente a una variante | Siempre autogenerado para evitar duplicados |
| Mover una variante de un grupo a otro | No soportado. Si es necesario, eliminar y recrear en el grupo destino |
| Crear grupo de 1 variante | Minimo 2. Si es 1, usar wizard de producto unico |
| Superar 12 variantes por grupo | Limite UX + batch efficiency. Si se necesitan mas, plantear como grupos separados |

**CASO LIMITE -- Convertir producto unico existente en variante de un grupo:**

DECISION: **Politica A -- Permitido.** El sistema crea `grupoVarianteId` UUID nuevo, asigna al producto existente como `esPrincipalGrupo: true`, agrega `varianteLabel` derivado de su `contenidoNeto`, y abre el wizard para definir las variantes adicionales. El SKU original se preserva intacto. Justificacion completa en seccion 12.4.

### 11.5 Por que ESTE modelo es el correcto

Cinco razones arquitectonicas por las que cada variante es un documento separado con `grupoVarianteId` compartido:

**1. Stock independiente para el pipeline de Mercado Libre.**

ML requiere push de stock por listing. Cada listing = un `mlItemId` = un `productoId`. Si las variantes fueran sub-documentos de un padre, el servicio de sync tendria que extraer el stock de cada posicion del array, mapearlo al `mlItemId` correcto, y manejar actualizaciones parciales del array. Con documentos separados, el pipeline opera sin modificaciones: lee `stockEfectivoML` del documento de la variante y lo empuja a ML.

**2. Listings ML separados por restriccion de la plataforma.**

ML rechaza SKU duplicado. Cada variante NECESITA su propio SKU para existir como listing. El modelo de documentos separados con SKU propio satisface esto nativamente. Un modelo de array obligaria a generar SKUs "virtuales" para ML, creando una capa de mapping adicional.

**3. Costos reales por variante (CTRU es por SKU).**

El pipeline de costeo (base + flete + internacion + almacen + handling + GA + GO = CTRU) opera por SKU. Un envase de 90 caps pesa distinto, ocupa distinto espacio, y tiene distinto costo unitario de flete que uno de 360 caps. Con documentos separados, el CTRU se calcula directamente sobre el documento de la variante. Con array, habria que indexar dentro del array para imputar costos -- fragil y propenso a errores.

**4. Investigacion de mercado por variante.**

Los precios de mercado (Amazon USA, Peru, ML competencia) varian por tamano/presentacion. La variante de 90 caps se investiga independientemente de la de 360 caps. Documentos separados permiten que cada variante tenga su propio bloque `investigacion` sin colisiones.

**5. Reportes drill-down sin agrupaciones costosas.**

Con documentos planos, un query `WHERE grupoVarianteId = X` devuelve todas las variantes del grupo. Agregar con `SUM`, `AVG ponderado`, etc. es trivial. Con array anidado, los reportes requeririan `UNNEST` o ETL para descomponer, agregando complejidad y latencia al pipeline de BI.

---

## 12. WizardVarianteExistenteV2

### 12.1 Cuando se invoca

**Entry point principal:** Desde la card o detalle de un producto que YA pertenece a un grupo de variantes (`grupoVarianteId` presente). Boton "Agregar variante". El wizard recibe el `grupoVarianteId` y los datos del principal como contexto.

**Entry point secundario:** Desde la card de un producto unico (sin `grupoVarianteId`). Boton "Crear grupo / Agregar variante". Esto activa el flujo de conversion (seccion 12.4) antes de abrir el wizard.

**Diferencia con WizardConVariantesV2:** El wizard de grupo nuevo (seccion Apendice A) crea N variantes desde cero con datos comunes editables. El WizardVarianteExistenteV2 agrega M variantes nuevas a un grupo que ya existe con datos comunes ya definidos.

### 12.2 Estructura del wizard

3 secciones acordeon (patron F5 simplificado: <4 pasos = stepper horizontal o acordeon):

**Sec. 1 -- Resumen del grupo existente (read-only)**

Muestra los datos comunes del grupo heredados del producto principal:
- Marca + Linea de negocio + Pais origen (chips read-only)
- Atributos por linea: resumen de los atributos SKC o SUP del grupo
- Marketing actual: tagline (si existe) como preview colapsado
- Variantes existentes: lista compacta de chips con `varianteLabel` + badge de estado de cada hermana
- Total: "Grupo con N variantes activas"

Esta seccion NO es editable. Si el usuario necesita cambiar datos comunes, lo hace desde el editor del producto, no desde este wizard. Esto evita la complejidad de propagar cambios comunes durante la creacion de una variante nueva.

**Sec. 2 -- Variantes nuevas a agregar (unica seccion editable)**

Reutiliza los mismos componentes del WizardConVariantesV2:
- `<MatrizVariantes1Eje>` cuando solo se agrega por contenido/tamano.
- `<MatrizVariantes2Ejes>` cuando se agregan combinaciones de contenido + sabor.
- `<TablaVariantesInline>` / `<FilaVarianteEditor>` para editar UPC, peso y preview de SKU tentativo por cada variante nueva.

Diferencias respecto al wizard de grupo nuevo:
- La unidad de contenido esta PRE-FIJADA a la unidad del grupo existente (no se puede cambiar).
- Los sabores existentes aparecen como chips read-only en la cabecera de la matriz. Solo se pueden agregar sabores NUEVOS.
- La validacion de duplicados compara contra las variantes existentes del grupo (no solo entre las nuevas).
- El `esPrincipalGrupo` no se ofrece (las nuevas variantes siempre son `false`).

**Sec. 3 -- Confirmacion**

- Lista de SKUs tentativos a generar (via `peekNextSequenceNumber`).
- Resumen: "Se crearan M variantes nuevas en el grupo [nombreComercial] (total: N+M variantes)".
- Si el grupo tiene `descripcionMarketing`, checkbox: "Copiar marketing existente a las nuevas variantes" (checked por default) + banner: "Recomendado regenerar marketing despues para incluir las nuevas presentaciones".
- Boton submit: "Agregar M variantes al grupo".

### 12.3 Validaciones especificas

**Pre-wizard (antes de abrir):**
- El producto base debe existir y no estar eliminado.
- El producto base debe tener `lineaNegocioId` definido.

**Sec. 2 -- Matriz:**

| Check | Condicion | Bloquea |
|-------|-----------|---------|
| Minimo 1 variante nueva | `variantesNuevas.length >= 1` | Si |
| Maximo 12 variantes TOTALES en el grupo | `existentes.length + nuevas.length <= 12` | Si |
| Contenido neto > 0 | Cada variante nueva: `contenidoNeto.valor > 0` | Si |
| Unidad coincide con grupo | Cada variante nueva: unidad === unidad del grupo | Si (forzado por UI) |
| Sin duplicados vs existentes | Ninguna variante nueva repite `(valor + sabor)` de una existente | Si |
| Sin duplicados entre nuevas | Ninguna variante nueva repite `(valor + sabor)` de otra nueva | Si |
| UPC unico | Si se ingresa UPC: no repetir entre nuevas ni vs existentes | Warning, no bloquea |

**Sec. 3 -- Pre-submit:**

```
canSubmit = variantesNuevas.length >= 1
         && totalGrupo <= 12
         && variantesNuevas.every(v => v.contenidoNeto.valor > 0)
         && sinDuplicadosVsExistentes
         && sinDuplicadosEntreNuevas
         && !submitting
```

**Herencia automatica al submit:**

Los siguientes campos se copian del producto principal del grupo a cada nueva variante:

| Campo heredado | Fuente |
|----------------|--------|
| `marca` / `marcaId` | Principal |
| `nombreComercial` | Principal |
| `paisOrigen` | Principal |
| `lineaNegocioId` / `lineaNegocioNombre` | Principal |
| `tipoProductoId` / `tipoProducto` (snapshot) | Principal |
| `categoriaIds` / `categorias` (snapshots) | Principal |
| `etiquetaIds` / `etiquetasData` (snapshots) | Principal |
| `atributosSkincare` | Principal |
| `atributosSuplementos` | Principal |
| `descripcionMarketing` | Principal (si existe y checkbox activo) |
| `grupoVarianteId` | Del grupo existente |
| `esPrincipalGrupo` | `false` (siempre) |

**Campos que el usuario define por variante nueva:**

| Campo | Obligatorio |
|-------|-------------|
| `contenidoNeto.valor` | Si |
| `contenidoNeto.unidad` | Pre-fijada del grupo |
| `sabor` (si es eje activo) | Si |
| `codigoUPC` | No (opcional) |
| `pesoLibras` | No (opcional) |

**Override de atributos comunes:**

NO soportado en este wizard. Si el usuario necesita cambiar atributos comunes (ej: actualizar la marca, agregar una categoria), lo hace ANTES desde el editor del producto (que propaga a las N hermanas) y luego agrega variantes nuevas con los datos comunes ya actualizados. Esto simplifica el wizard y evita el caso confuso de "estoy creando una variante pero tambien cambiando datos de las 5 existentes".

### 12.4 Caso limite: convertir producto unico en grupo

**DECISION: Politica A -- Permitido.**

**Flujo:**

1. El usuario esta en la card/detalle de un producto unico (sin `grupoVarianteId`). Click en "Crear grupo / Agregar variante".
2. El sistema ejecuta una actualizacion atomica sobre el producto existente:
   - Genera `grupoVarianteId` = `crypto.randomUUID()` (UUID nuevo, NO el ID del documento).
   - Asigna `esPrincipalGrupo = true`.
   - Genera `varianteLabel` derivado de su `contenidoNeto` existente (ej: "90 capsulas") o de su `contenido` legacy (con parsing).
   - NO cambia el SKU. El producto conserva su SKU original intacto.
3. Se abre el WizardVarianteExistenteV2 con ese producto como principal del grupo recien creado.
4. El usuario define las variantes nuevas normalmente (sec. 2 y 3 del wizard).
5. Submit: crea M documentos nuevos con el `grupoVarianteId` del paso 2.

**Por que Politica A y no Politica B (bloquear):**

| Argumento | Politica A (permitir) | Politica B (bloquear) |
|-----------|----------------------|----------------------|
| Historial del SKU | Se preserva. Ventas, ML mappings, OCs historicas siguen apuntando al mismo `productoId` | Se pierde si el usuario recrea desde cero. Tendria que "migrar manualmente" lo que implica crear nuevo y soft-delete viejo |
| Experiencia ML | El listing de ML sigue funcionando sin interrupcion. Solo se agregan listings nuevos para las variantes nuevas | El listing original deja de existir si se soft-delete el producto viejo. Requiere republicar |
| Complejidad UX | 1 click + wizard de agregar | Multi-paso manual: crear grupo nuevo, copiar datos, soft-delete viejo, reasignar ML, reasignar ventas |
| Riesgo de datos huerfanos | Bajo (1 update atomico al producto existente) | Alto (multiples operaciones manuales, cualquiera puede fallar) |
| Clientes existentes | Ven el mismo producto con el mismo SKU | Ven un producto "nuevo" y pierden continuidad |

**Validacion adicional para la conversion:**

- El producto debe tener `estado = 'activo'`.
- El producto NO debe ser un pack (`esPack !== true`).
- El producto NO debe pertenecer ya a un grupo (`grupoVarianteId` debe ser `undefined` o vacío).
- Se muestra un dialogo de confirmacion: "Vas a convertir [nombreComercial] en el producto principal de un nuevo grupo de variantes. Su SKU ([sku]) se mantiene. Podras agregar nuevas presentaciones a continuacion."

### 12.5 Componentes compartidos entre los 3 wizards

```
COMPONENTES COMPARTIDOS (capa comun)
  src/pages/Productos/components/sections/
    <AtributosPorLineaSection>     -- atributos SKC (8) o SUP (7) condicionales
    <MarketingComercialSection>    -- IA + audit + 3 niveles + compliance
    <ChipDuracionEnvase>           -- duracion calculada en vivo (solo SUP)

  src/pages/Productos/components/variantes/ (NUEVOS del WizardConVariantesV2)
    <MatrizVariantes1Eje>          -- lista de filas por contenido/tamano
    <MatrizVariantes2Ejes>         -- grid contenido x sabor con checkboxes
    <TablaVariantesInline>         -- tabla editable UPC + peso + SKU preview
    <FilaVarianteEditor>           -- fila individual de la tabla anterior

  src/components/modules/maestros/
    <MaestroSelect>                -- select de tipos/marcas/lineas
    <MaestroChipsMulti>            -- chips multi-select para categorias/etiquetas

SHELLS (3 wizards distintos, mismos componentes internos)

  WizardProductoV2                 -- producto unico
    Color: teal
    Patron: 6 secciones acordeon
    Reutiliza: AtributosPorLineaSection, MarketingComercialSection,
               ChipDuracionEnvase, MaestroSelect, MaestroChipsMulti

  WizardConVariantesV2             -- grupo nuevo desde cero
    Color: violet
    Patron: 5 pasos sidebar vertical (F5: 4+ pasos)
    Reutiliza: AtributosPorLineaSection, MarketingComercialSection,
               ChipDuracionEnvase, MaestroSelect, MaestroChipsMulti,
               MatrizVariantes1Eje, MatrizVariantes2Ejes,
               TablaVariantesInline, FilaVarianteEditor

  WizardVarianteExistenteV2        -- agregar a grupo existente
    Color: violet
    Patron: 3 secciones acordeon (F5: <4 pasos)
    Reutiliza: MatrizVariantes1Eje, MatrizVariantes2Ejes,
               TablaVariantesInline, FilaVarianteEditor,
               ChipDuracionEnvase
    NO reutiliza: AtributosPorLineaSection (datos comunes read-only),
                  MarketingComercialSection (marketing se copia post-submit),
                  MaestroSelect/MaestroChipsMulti (clasificacion heredada)
```

**Componente nuevo especifico del WizardVarianteExistenteV2:**

| Componente | Funcion |
|------------|---------|
| `<ResumenGrupoReadOnly>` | Sec. 1 del wizard. Muestra marca, linea, atributos, marketing y hermanas existentes como chips. Read-only. No existe en los otros 2 wizards porque ahi los datos comunes son editables. |

### 12.6 Riesgos de no alinear los 3 wizards

**RIESGO-A: Divergencia visual confunde al usuario.**

Si WizardProductoV2 usa un acordeon teal con `AtributosPorLineaSection` y WizardVarianteExistenteV2 usa un layout distinto con inputs inline ad-hoc, el usuario percibe "dos sistemas distintos" dentro del mismo ERP. Esto reduce la confianza y aumenta la curva de aprendizaje. Los 3 wizards deben compartir la misma paleta de componentes aunque el shell (layout y color) difiera.

**RIESGO-B: Divergencia de shape de datos re-contamina la BD post-migracion.**

El wizard legacy (`WizardVarianteExistente.tsx` actual) escribe:
- `contenido` como string concatenado (`"50 ml"`)
- `dosaje` copiado condicionalmente segun unidad (linea 148)
- `grupoVarianteId` como `productoBase.grupoVarianteId ?? productoBase.id` (linea 169) -- usa el doc ID como grupo ID si no existe UUID
- `costoFleteInternacional` heredado (linea 164) -- campo deprecado
- `stockMinimo` / `stockMaximo` heredados (lineas 166-167) -- campos que ya no viven en el maestro

El wizard V2 debe escribir:
- `contenidoNeto: { valor: number, unidad: UnidadContenido }` (estructurado)
- `grupoVarianteId` siempre como UUID (nunca doc ID)
- Sin `costoFleteInternacional` (deprecado)
- Sin `stockMinimo` / `stockMaximo` (viven en modulo Stock)
- Con `varianteLabel` autogenerado desde `contenidoNeto` + `sabor`

Si ambos wizards coexisten, los documentos creados tendran shapes distintos y el pipeline de lectura tendra que manejar ambos formatos indefinidamente. La V2 debe reemplazar completamente al legacy (detras de feature flag durante transicion).

**RIESGO-C: Mantenimiento triple.**

Un bug en la validacion de duplicados (ej: no detecta combinacion repetida) tendria que fixearse en 3 lugares si cada wizard tiene su propia implementacion. Con componentes compartidos (`MatrizVariantes1Eje`, etc.), el fix se aplica una vez.

**RIESGO-D: Tests duplicados.**

Si cada wizard tiene su propia logica de generacion de `varianteLabel`, de validacion de contenido, de preview de SKU, los tests unitarios se triplican sin ganar cobertura real. Los componentes compartidos permiten testar la logica una vez y verificar que cada wizard la integra correctamente.

---

## Apendice D: Contradicciones detectadas entre wizard legacy y modelo V2

Este apendice documenta las inconsistencias encontradas entre `WizardVarianteExistente.tsx` (legacy) y el diseno V2 de este documento. Son las que debe resolver la implementacion del WizardVarianteExistenteV2.

| # | Contradiccion | Legacy | V2 |
|---|---------------|--------|-----|
| C-1 | `grupoVarianteId` puede ser doc ID | Linea 169: `productoBase.grupoVarianteId ?? productoBase.id` | Siempre UUID via `crypto.randomUUID()` |
| C-2 | `contenido` es string libre | Linea 139: `"50 ml"` concatenado | `ContenidoNeto { valor: number, unidad: UnidadContenido }` estructurado |
| C-3 | SKU preview es derivacion artesanal | Linea 122-126: regex sobre SKU base | `peekNextSequenceNumber` real via contadores atomicos |
| C-4 | Campos deprecados heredados | Lineas 164-167: `costoFleteInternacional`, `stockMinimo`, `stockMaximo` | Eliminados del maestro de producto. Viven en envios y modulo Stock |
| C-5 | Stock inicial en wizard | Zona 3 completa (lineas 360-385): input de stock inicial | Eliminado. Stock arranca en 0 y se ajusta desde modulo Stock |
| C-6 | `dosaje` sobreescrito condicionalmente | Linea 148: si unidad es caps/tabs, dosaje = cantidad | `dosaje` es atributo comun (formula), no se sobreescribe por contenido |
| C-7 | Sin validacion de duplicados vs hermanas | No valida si la combinacion ya existe en el grupo | Validacion obligatoria: la nueva variante no puede duplicar `(valor + sabor)` existente |
| C-8 | Unidades hardcodeadas | Lineas 44-51: array fijo de 6 unidades | Constantes tipadas `UNIDADES_SUP`, `UNIDADES_SKC`, etc. filtradas por linea |
| C-9 | Sin `contenidoNeto` estructurado | No existe el campo | Campo obligatorio en cada variante |
| C-10 | Sin `descripcionMarketing` | No existe referencia al marketing IA | Se copia del principal si existe y checkbox activo |
