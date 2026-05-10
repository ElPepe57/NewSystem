# DISEÑO TECNICO DEFINITIVO — MIGRACION BIG BANG MODULO PRODUCTOS

> DBA Agent | Fecha: 2026-05-07
> Version: FINAL · incorpora todas las decisiones cerradas + 10 contradicciones Apendice D
> Motor: Cloud Firestore (NoSQL · modo nativo) · Proyecto: businessmn-269c9

---

## 0. DECISIONES POLITICAS BLOQUEADAS (no-negociables)

| Campo / Area | Decision |
|---|---|
| `stockUSA` | FUERA de scope · pertenece a proyecto separado · no se toca |
| `grupo` / `subgrupo` | Borrar SOLO donde exista `tipoProductoId` valido · resto va a CSV backlog |
| `paisOrigen` | NO se toca · ya funciona correctamente |
| Snapshots en ventas / OC / envios | NO se tocan · datos historicos inmutables |
| `investigacion.ctruEstimado` / `precioSugeridoCalculado` / `margenEstimado` / `precioEntrada` | INCLUIDOS en migracion · se borran en Fase 2 cleanup |
| `investigacion.fuenteUSA` / `vendedorPrincipal` | INCLUIDOS · se borran en esta migracion |
| Conversion producto unico a grupo | Politica A · permitido · UUID nuevo · SKU original intacto |
| Enfoque | BIG BANG · una sola pasada · sin shapes en paralelo |

---

## 1. ESTRUCTURA DE BACKUP MULTI-CAPA

### Nivel A · Export oficial de Firestore (gcloud)

Comando exacto (ejecutar desde PowerShell con gcloud autenticado):

```powershell
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm"
$BUCKET = "gs://businessmn-269c9.appspot.com/backups/migracion-productos-$TIMESTAMP"

gcloud firestore export $BUCKET `
  --collection-ids=productos,tiposProducto,categorias,etiquetas,lineasNegocio,marcas `
  --project=businessmn-269c9
```

Validacion de exito:

```powershell
# Esperar a que el export termine (puede tomar 2-5 minutos para 212 documentos)
gcloud firestore operations list --project=businessmn-269c9
# Verificar que la operacion mas reciente tenga state: DONE (no RUNNING)
# Si state=DONE y sin error: continuar. Si error: DETENERSE y revisar.
```

Estimacion de costo y tiempo:
- 212 productos: aprox. 1-2 minutos de export
- Maestros (tiposProducto, categorias, etc.): < 100 documentos combinados
- Costo: fraccion de centavo (Firestore export cobra por GB leido · estimado < 1 MB total)
- El export queda en GCS y puede restaurarse via `gcloud firestore import`

### Nivel B · Backup JSON local por coleccion (control directo)

Script: `scripts/backup-pre-migracion.mjs`

Estructura de salida:
```
backups/
  migracion-productos-YYYY-MM-DD_HH-MM/
    productos.ndjson          <- un documento JSON por linea
    tiposProducto.ndjson
    categorias.ndjson
    etiquetas.ndjson
    lineasNegocio.ndjson
    marcas.ndjson
    MANIFEST.json             <- conteos + checksums sha256 de cada archivo
```

Estructura del MANIFEST.json:
```json
{
  "timestamp": "2026-05-07T10:00:00.000Z",
  "proyecto": "businessmn-269c9",
  "colecciones": {
    "productos": { "count": 212, "sha256": "abc123..." },
    "tiposProducto": { "count": 45, "sha256": "def456..." },
    "categorias": { "count": 23, "sha256": "..." },
    "etiquetas": { "count": 67, "sha256": "..." },
    "lineasNegocio": { "count": 4, "sha256": "..." },
    "marcas": { "count": 38, "sha256": "..." }
  }
}
```

Pseudocodigo del script:

```javascript
// backup-pre-migracion.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

const COLECCIONES = [
  'productos', 'tiposProducto', 'categorias',
  'etiquetas', 'lineasNegocio', 'marcas'
];

async function serializar(data) {
  // Convertir Timestamps de Firestore a ISO 8601 para portabilidad
  // { _seconds: N, _nanoseconds: N } → "2026-01-15T10:30:00.000Z"
  return JSON.stringify(convertirTimestamps(data));
}

async function backupColeccion(db, nombre, dirSalida) {
  const snap = await db.collection(nombre).get();
  const archivo = path.join(dirSalida, `${nombre}.ndjson`);
  const hash = createHash('sha256');
  const stream = createWriteStream(archivo);
  
  for (const doc of snap.docs) {
    const linea = await serializar({ _id: doc.id, ...doc.data() }) + '\n';
    stream.write(linea);
    hash.update(linea);
  }
  
  await new Promise(resolve => stream.end(resolve));
  return { count: snap.size, sha256: hash.digest('hex') };
}
```

### Nivel C · Snapshot individual por documento

Antes de transformar cada producto, el script principal guarda una copia en:
```
backups/migracion-productos-YYYY-MM-DD_HH-MM/
  productos-individuales/
    SUP-0001.json
    SUP-0002.json
    ...
    SKC-0001.json
```

El nombre del archivo usa el SKU (no el docId) para permitir busqueda humana rapida. Si el producto no tiene SKU, usar el docId. Este nivel permite restaurar UN solo producto corrupto sin ejecutar el rollback completo.

---

## 2. LOGICA DE DETECCION DE GENERACION

Antes de transformar cualquier documento, el script clasifica el producto en una de tres generaciones:

```
GEN-1 PURO: tiene contenido (string) PERO NO tiene contenidoNeto estructurado
            Campos tipicos: dosaje (top-level), presentacion (top-level), sabor (top-level)
            Indicador adicional: esPadre/esVariante/parentId en lugar de grupoVarianteId

GEN-2 MIXTO: tiene contenidoNeto Y tiene campos legacy sin limpiar
             Caso tipico: producto creado con WizardProductoV2 pero que aun tiene
             dosaje top-level, o investigacion con fuenteUSA sin borrar

GEN-3 PURO V2: tiene contenidoNeto, no tiene campos legacy top-level,
               grupoVarianteId es UUID (no doc ID)
               Estos no requieren transformacion · solo validacion
```

Funcion de deteccion:

```javascript
function detectarGeneracion(doc) {
  const tieneContenidoNeto = !!doc.contenidoNeto?.valor;
  const tieneCamposLegacy = !!(
    doc.presentacion ||      // top-level (no en atributosSuplementos)
    doc.dosaje ||            // top-level
    doc.contenido ||         // string legacy
    doc.costoFleteInternacional ||
    doc.esPadre !== undefined ||
    doc.parentId ||
    doc.grupoId ||
    doc.stockMinimo !== undefined || // en maestro de producto (legacy)
    doc.stockMaximo !== undefined
  );
  
  const tieneGrupoContaminado =
    doc.grupoVarianteId && doc.grupoVarianteId === doc.id;
  
  if (!tieneContenidoNeto && tieneCamposLegacy) return 'GEN-1';
  if (tieneContenidoNeto && tieneCamposLegacy) return 'GEN-2';
  if (tieneContenidoNeto && !tieneCamposLegacy && !tieneGrupoContaminado) return 'GEN-3';
  return 'GEN-1'; // fallback conservador
}
```

---

## 3. EDGE CASES · POLITICA DEFINITIVA PARA CADA UNO

### EC-01 · Producto sin `lineaNegocioId`

- Deteccion: `!doc.lineaNegocioId || doc.lineaNegocioId.trim() === ''`
- Politica: WARN_SIN_LINEA · no migrar atributos de linea (no crear `atributosSkincare` ni `atributosSuplementos` estructurados) · preservar todo tal cual · listar en seccion "revision manual" del log
- Camposs borrados igualmente: los campos legacy genericos (presentacion top-level, dosaje top-level, etc.) SI se borran porque no dependen de la linea · solo se omite la migracion de atributos especificos de linea
- Razon: no sabemos si es SKC o SUP, por lo que no podemos saber si `capsulas` en `presentacion` debe ir a `atributosSuplementos` o ignorarse

### EC-02 · Producto sin `tipoProductoId`

- Deteccion: `!doc.tipoProductoId`
- Politica: WARN_CLASIFICACION_PENDIENTE · preservar `grupo` y `subgrupo` tal cual · NO borrarlos · emitir entrada en `backlog-clasificacion.csv` con columnas: docId, sku, nombreComercial, grupo, subgrupo, lineaNegocioId
- El CSV se genera al finalizar el dry-run y el apply
- Razon: `grupo`/`subgrupo` son el unico indicador de tipo para estos productos · borrarlos sin `tipoProductoId` es perdida irreversible de informacion

### EC-03 · `contenido` string vacio, null, o "indefinido"

- Deteccion: `!doc.contenido || doc.contenido.trim() === '' || doc.contenido.toLowerCase() === 'indefinido'`
- Politica: WARN_CONTENIDO_NO_PARSEABLE · NO crear `contenidoNeto` · borrar el campo `contenido` del documento de todas formas (es basura) · listar en revision manual
- Razon: crear un `contenidoNeto` con valor inventado seria peor que no tenerlo

### EC-04 · `contenido` con formato raro

Formatos conocidos a intentar parsear, en orden de prioridad:

```
"90 capsulas"      → { valor: 90, unidad: 'capsulas' }
"60Caps"           → { valor: 60, unidad: 'capsulas' }    (regex sin espacio)
"250 g"            → { valor: 250, unidad: 'g' }
"50ml"             → { valor: 50, unidad: 'ml' }
"1.5 lb"           → { valor: 1.5, unidad: 'lb' }
"60-90 caps"       → WARN · no parseable · rango ambiguo
"60ml/2oz"         → intentar primer numero: { valor: 60, unidad: 'ml' } · WARN por dual
"1 unidad"         → { valor: 1, unidad: 'unidades' }
"30 sobres"        → { valor: 30, unidad: 'sobres' }
```

Regex de parseo (en orden, primer match gana):

```javascript
const PATTERNS = [
  // Numerico + unidad con posible espacio
  /^(\d+(?:[.,]\d+)?)\s*(capsulas?|caps?|tabletas?|tabs?|gomitas?|gummies?|sobres?|sticks?|scoops?|ml|mL|g|gr|gramos?|kg|lb|libras?|oz|onzas?|unidades?|pares?|fl\s*oz)/i,
];

const UNIT_MAP = {
  'capsula': 'capsulas', 'cap': 'capsulas', 'caps': 'capsulas', 'capsulas': 'capsulas',
  'tableta': 'tabletas', 'tab': 'tabletas', 'tabs': 'tabletas', 'tabletas': 'tabletas',
  'gomita': 'gomitas', 'gummie': 'gomitas', 'gomitas': 'gomitas',
  'sobre': 'sobres', 'sobres': 'sobres',
  'stick': 'sticks', 'sticks': 'sticks',
  'scoop': 'scoops', 'scoops': 'scoops',
  'ml': 'ml', 'g': 'g', 'gr': 'g', 'gramo': 'g',
  'kg': 'kg', 'lb': 'lb', 'libra': 'lb',
  'oz': 'oz', 'onza': 'oz',
  'unidad': 'unidades', 'unidades': 'unidades',
  'par': 'pares', 'pares': 'pares',
};
```

Si el regex falla: WARN_CONTENIDO_NO_PARSEABLE · el campo `contenido` string se PRESERVA (no se borra) para no perder la informacion · `contenidoNeto` no se crea.

Si el regex da un resultado con rango (ej. "60-90"): usar el primer numero, emitir WARN_CONTENIDO_RANGO.

### EC-05 · Producto SUP sin presentacion ni unidad

- Deteccion: linea=SUP AND `!doc.atributosSuplementos?.presentacion` AND `!doc.presentacion` AND `!doc.contenidoNeto`
- Politica: WARN_SUP_SIN_UNIDAD · NO inferir la unidad · no crear `contenidoNeto` · listar en revision manual
- Razon: inferir "capsulas" por defecto para todos los SUP sin presentacion seria incorrecto para los de polvo, liquido, etc.

### EC-06 · Producto Gen-1 puro sin ningun atributo

- Deteccion: `!doc.atributosSkincare && !doc.atributosSuplementos && !doc.contenidoNeto`
- Politica: si tiene `lineaNegocioId`, crear shape de atributos vacio `{}` del tipo correspondiente (permite que el editor V2 lo complete) · si NO tiene `lineaNegocioId`, WARN_SIN_DATOS y no crear shape
- Razon: un shape vacio es distinguible de "nunca tuvo datos" y habilita el editor V2 sin crash

### EC-07 · Productos `esPack=true`

- Deteccion: `doc.esPack === true`
- Politica: NO tocar `componentesPack[]` · migrar todos los campos top-level normalmente · solo limpiar los campos legacy que apliquen · log PACK para tracking
- Razon: los snapshots en `componentesPack[]` son datos historicos · la regla "vender pack no descuenta stock" se preserva

### EC-08 · Productos con `investigacion`

Campos a borrar en la migracion:
- `investigacion.fuenteUSA`
- `investigacion.vendedorPrincipal`

Campos que se incluyen en Fase 2 cleanup (NO se borran ahora, se documenta para proxima sesion):
- `investigacion.ctruEstimado`
- `investigacion.precioSugeridoCalculado`
- `investigacion.margenEstimado`
- `investigacion.precioEntrada`

Razon para diferir Fase 2: estos campos tienen codigo que los lee en el frontend V1 legacy. Borrarlos requiere confirmar que el frontend V2 ya esta 100% desplegado y el codigo legacy eliminado.

### EC-09 · Productos con `estado='eliminado'`

- Politica: MIGRAR igualmente con las mismas transformaciones que los activos · log separado con prefijo ELIMINADO
- Razon: los datos eliminados son parte del historial auditado · el DBA no puede discriminar si un producto "eliminado" sera restaurado en el futuro

### EC-10 · Padre con `esPadre=true` sin hijos (huerfano)

- Deteccion: `doc.esPadre === true` AND no existe ningun documento con `parentId === doc.id`
- Politica: WARN_PADRE_HUERFANO · remover `esPadre=true` · remover `grupoVarianteId` si era igual al doc ID (contaminacion C-1) · dejar el producto como producto unico sin grupo · log
- Razon: un padre sin hijos no tiene sentido funcional · seria un grupo de 1

### EC-11 · Hijo con `parentId` apuntando a SKU inexistente

- Deteccion: `doc.parentId` AND NOT EXISTS `productos/{doc.parentId}`
- Politica: WARN_PARENTID_ROTO · remover `parentId`, `esVariante`, `grupoVarianteId` (si era igual al parentId) · dejar el producto como independiente · log con el parentId original para arqueologia
- Razon: es mejor un producto independiente que uno con referencias rotas que crashean el servicio

### EC-12 · Variantes inconsistentes (mismo grupoVarianteId, distinta linea o marca)

- Deteccion: para cada grupoVarianteId, verificar que todos los hermanos tengan el mismo `lineaNegocioId` y el mismo `marcaId`
- Politica: WARN_GRUPO_INCONSISTENTE · NO migrar el grupo automaticamente · listar en seccion especial del log con todos los SKUs del grupo para revision manual · el usuario decide cuales son realmente hermanos
- Razon: esta inconsistencia indica un error de datos (ej. dos productos distintos con el mismo grupoVarianteId por accidente) · automatizar la resolucion seria riesgoso

### EC-13 · Contaminacion C-1 (`grupoVarianteId === doc.id`)

Este es el problema documentado en Apendice D del documento funcional, linea 169 del wizard legacy: `productoBase.grupoVarianteId ?? productoBase.id`.

- Deteccion: `doc.grupoVarianteId && doc.grupoVarianteId === doc.id`
- Politica: NORMALIZAR
  1. Identificar todos los hermanos del grupo (productos con `parentId === doc.id` o `grupoVarianteId === doc.id`)
  2. Generar un UUID nuevo con `crypto.randomUUID()`
  3. Actualizar el producto padre: `grupoVarianteId = uuid_nuevo`
  4. Actualizar todos los hermanos: `grupoVarianteId = uuid_nuevo`
  5. Log: FIXED_C1 con el uuid_nuevo generado y lista de docIds afectados
- Importante: este fix se procesa ANTES que las transformaciones por producto · primero se resuelven todos los grupos contaminados, luego se migra campo por campo

### EC-14 · `atributosSkincare.unidadMedida` contradice parse de `volumen`

- Deteccion: `doc.atributosSkincare?.volumen` es parseable a una unidad Y `doc.atributosSkincare?.unidadMedida` existe Y son distintas
- Ejemplo: volumen="50 ml" y unidadMedida="g"
- Politica: priorizar `unidadMedida` (es el campo mas explicito y reciente) · log WARN_UNIDAD_CONTRADICTORIA con ambos valores para que el usuario revise
- Si no existe `unidadMedida`, fallback al parse de `volumen`

### EC-15 · `presentacion` top-level con valor fuera del enum `Presentacion`

- El enum es: tabletas | gomitas | capsulas | capsulas_blandas | polvo | liquido
- Deteccion: `doc.presentacion` AND NOT IN enum
- Politica: WARN_PRESENTACION_INVALIDA · borrar el campo de todas formas (estaba en la lista de campos a eliminar) · log con el valor original
- Razon: el campo se borra independientemente · el warning es solo para trazabilidad

### EC-16 · `dosaje` top-level con texto no parseable como dosaje real

- Deteccion: `doc.dosaje` AND (contiene caracteres que no parecen una dosis, ej. texto libre largo)
- Politica: mover tal cual a `atributosSuplementos.dosaje` (si es producto SUP) · para SKC y otros, borrar `dosaje` top-level y emitir WARN_DOSAJE_SKC con el valor original
- Razon: el contenido del campo es responsabilidad del usuario revisarlo · mejor moverlo que perderlo

### EC-17 · Campo legacy con `null` (no `undefined`)

- Deteccion: campo existe en el documento con valor `null`
- Politica: tratar exactamente como si no existiera para efectos de borrado · si el campo esta en la lista de campos a borrar, borrarlo con `FieldValue.delete()` independientemente de si su valor es `null` o un valor real
- Razon: en Firestore, `null` y `undefined` tienen comportamientos distintos · el `deleteField()` funciona correctamente para ambos casos

---

## 4. LOGICA DE TRANSFORMACION · PSEUDOCODIGO POR BLOQUE

### Bloque A · Pre-proceso: resolver grupos contaminados C-1

```javascript
async function preProcesarGruposContaminados(db) {
  // 1. Leer todos los productos
  const snap = await db.collection('productos').get();
  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // 2. Identificar padres con grupoVarianteId === id
  const padresContaminados = todos.filter(p =>
    p.grupoVarianteId && p.grupoVarianteId === p.id
  );
  
  // 3. Para cada padre contaminado, resolver el grupo
  for (const padre of padresContaminados) {
    const hermanos = todos.filter(p =>
      p.parentId === padre.id || (p.grupoVarianteId === padre.id && p.id !== padre.id)
    );
    
    if (hermanos.length === 0) {
      // Padre huerfano: EC-10
      log('WARN_PADRE_HUERFANO', padre.id, padre.sku);
      // Se normaliza en el bloque principal
      continue;
    }
    
    const nuevoUUID = crypto.randomUUID();
    log('FIXED_C1', { padre: padre.id, hermanos: hermanos.map(h => h.id), uuid: nuevoUUID });
    
    // Guardar el mapeo para el bloque principal
    grupoCorrectedMap.set(padre.id, nuevoUUID);
    for (const h of hermanos) {
      grupoCorrectedMap.set(h.id, nuevoUUID);
    }
  }
}
```

### Bloque B · Migracion de `contenido` string a `contenidoNeto`

```javascript
function migrarContenido(doc) {
  // Si ya tiene contenidoNeto, no sobreescribir
  if (doc.contenidoNeto?.valor > 0) {
    return { operacion: 'SKIP_CONTENIDO_NETO_YA_EXISTE' };
  }
  
  const contenido = (doc.contenido || '').trim();
  if (!contenido || contenido.toLowerCase() === 'indefinido') {
    return { operacion: 'WARN_CONTENIDO_NO_PARSEABLE', valor: contenido };
  }
  
  // Intentar parse con la regex del bloque 3 EC-04
  const resultado = parsearContenido(contenido);
  if (!resultado) {
    return { operacion: 'WARN_CONTENIDO_NO_PARSEABLE', valor: contenido };
  }
  
  return {
    operacion: 'SET_CONTENIDO_NETO',
    contenidoNeto: { valor: resultado.valor, unidad: resultado.unidad }
  };
}
```

### Bloque C · Migracion de atributos SUP top-level

```javascript
function migrarAtributosSUP(doc) {
  if (!esLinea(doc, 'SUP')) return;
  
  const existentes = doc.atributosSuplementos || {};
  const nuevo = { ...existentes };
  
  // presentacion top-level → inferir de contenidoNeto.unidad (campo ya migrado)
  // El campo presentacion top-level se BORRA en el bloque de limpieza
  // Si atributosSuplementos.presentacion existe (legacy), se preserva para compat lectura
  
  // dosaje top-level → mover a atributosSuplementos.dosaje (si no existe ya)
  if (doc.dosaje && !existentes.dosaje) {
    nuevo.dosaje = doc.dosaje;
    log('MOVED_DOSAJE_TO_ATRIBUTOS', doc.id, doc.dosaje);
  }
  
  // sabor top-level → mover a atributosSuplementos.sabor (si no existe ya)
  if (doc.sabor && !existentes.sabor) {
    nuevo.sabor = doc.sabor;
    log('MOVED_SABOR_TO_ATRIBUTOS', doc.id, doc.sabor);
  }
  
  return { operacion: 'UPDATE_ATRIBUTOS_SUP', atributosSuplementos: nuevo };
}
```

### Bloque D · Migracion de atributos SKC (volumen a contenidoNeto)

```javascript
function migrarAtributosSKC(doc) {
  if (!esLinea(doc, 'SKC')) return;
  if (doc.contenidoNeto?.valor > 0) {
    return { operacion: 'SKIP_CONTENIDO_NETO_YA_EXISTE' };
  }
  
  const attrs = doc.atributosSkincare || {};
  
  // Intentar derivar contenidoNeto desde atributosSkincare.volumen
  // con prioridad a unidadMedida si existe (EC-14)
  let valor = null;
  let unidad = null;
  
  if (attrs.volumen) {
    const parseado = parsearContenido(attrs.volumen);
    if (parseado) {
      valor = parseado.valor;
      unidad = parseado.unidad;
    }
  }
  
  if (attrs.unidadMedida) {
    // Priorizar unidadMedida sobre el parse de volumen
    // (puede sobreescribir la unidad del parse)
    unidad = attrs.unidadMedida;
    if (!valor && attrs.volumen) {
      // Extraer solo el numero de volumen
      const m = (attrs.volumen || '').match(/^(\d+(?:[.,]\d+)?)/);
      if (m) valor = parseFloat(m[1]);
    }
  }
  
  if (valor && unidad) {
    return {
      operacion: 'SET_CONTENIDO_NETO_FROM_SKC',
      contenidoNeto: { valor, unidad }
    };
  }
  
  return { operacion: 'WARN_SKC_SIN_VOLUMEN', volumen: attrs.volumen };
}
```

### Bloque E · Normalizacion de variantes

```javascript
function normalizarVariantes(doc, grupoCorrectedMap) {
  const updates = {};
  
  // Aplicar fix C-1 si corresponde
  if (grupoCorrectedMap.has(doc.id)) {
    updates.grupoVarianteId = grupoCorrectedMap.get(doc.id);
    log('APPLIED_C1_FIX', doc.id, updates.grupoVarianteId);
  }
  
  // Resolver esPrincipalGrupo desde legacy esPadre
  if (doc.esPadre === true && doc.esPrincipalGrupo === undefined) {
    updates.esPrincipalGrupo = true;
  }
  
  // Generar varianteLabel si el producto pertenece a un grupo y no tiene label
  if ((doc.grupoVarianteId || grupoCorrectedMap.has(doc.id)) && !doc.varianteLabel) {
    const label = generarVarianteLabel(doc);
    if (label) {
      updates.varianteLabel = label;
      log('GENERATED_VARIANTE_LABEL', doc.id, label);
    }
  }
  
  return updates;
}

function generarVarianteLabel(doc) {
  // Intentar desde contenidoNeto (V2)
  if (doc.contenidoNeto?.valor && doc.contenidoNeto?.unidad) {
    const label = `${doc.contenidoNeto.valor} ${doc.contenidoNeto.unidad}`;
    if (doc.sabor) return `${label} · ${doc.sabor}`;
    return label;
  }
  // Intentar desde contenido string (legacy)
  if (doc.contenido) return doc.contenido;
  return null;
}
```

### Bloque F · Borrado masivo de campos legacy

```javascript
// Campos a borrar SIEMPRE (independientemente de linea o generacion)
const CAMPOS_A_BORRAR_SIEMPRE = [
  'presentacion',          // top-level · reemplazado por contenidoNeto.unidad
  'costoFleteInternacional', // deprecado S3.2 · vive en envios/OC
  'esPadre',               // legacy · reemplazado por esPrincipalGrupo
  'esAgrupador',           // legacy
  'parentId',              // legacy · reemplazado por grupoVarianteId
  'grupoId',               // legacy · reemplazado por grupoVarianteId
  'esVariante',            // legacy
];

// Campos de investigacion a borrar en esta migracion
const CAMPOS_INVESTIGACION_BORRAR = [
  'investigacion.fuenteUSA',
  'investigacion.vendedorPrincipal',
];

// Campos a borrar SOLO si tipoProductoId existe (EC-02)
const CAMPOS_CLASIFICACION_CONDICIONAL = ['grupo', 'subgrupo'];

// Campos que NO se borran ahora (Fase 2 cleanup)
const CAMPOS_FASE_2 = [
  'investigacion.ctruEstimado',
  'investigacion.precioSugeridoCalculado',
  'investigacion.margenEstimado',
  'investigacion.precioEntrada',
];

// Campo que NO se toca (decision politica)
const CAMPOS_INTOCABLES = ['stockUSA', 'paisOrigen'];
```

### Bloque G · Borrado de dosaje y sabor top-level post-migracion

```javascript
// IMPORTANTE: solo borrar dosaje/sabor top-level DESPUES de haberlos movido a atributos
// Este bloque corre DESPUES del Bloque C (migracion SUP)
const CAMPOS_POST_MIGRACION = {
  SUP: ['dosaje', 'sabor'],    // ya movidos a atributosSuplementos en bloque C
  SKC: ['dosaje', 'sabor'],    // no aplican a SKC (dosaje es de SUP)
  DEFAULT: ['dosaje', 'sabor'] // borrar de todos los que los tengan
};
```

---

## 5. SCRIPT `migrate-productos-gen3.mjs` · ESTRUCTURA CANONICA

### Flags y modos de ejecucion

```
node scripts/migrate-productos-gen3.mjs --dry-run
  -> Solo lee y calcula · NO escribe en Firestore · genera dry-run.json

node scripts/migrate-productos-gen3.mjs --apply
  -> Pide confirmacion interactiva "Escribir CONFIRMAR para ejecutar en produccion:"
  -> Solo continua si el input es exactamente "CONFIRMAR"

node scripts/migrate-productos-gen3.mjs --apply --single SUP-0042
  -> Aplica solo al producto con ese SKU

node scripts/migrate-productos-gen3.mjs --apply --limit 10
  -> Aplica solo a los primeros 10 productos (para testing parcial)

node scripts/migrate-productos-gen3.mjs --apply --resume productos/ABC123
  -> Salta todos los productos hasta ese docId · util para reanudar si fallo
```

### Estructura del log de salida

El log se escribe en tiempo real a un archivo NDJSON:
```
logs/migracion-YYYY-MM-DD_HH-MM/
  dry-run.json    (o apply.json)
  failed.json     <- solo documentos que fallaron
  backlog-clasificacion.csv  <- productos sin tipoProductoId
```

Cada entrada del log:
```json
{
  "timestamp": "2026-05-07T10:05:32.000Z",
  "docId": "abc123",
  "sku": "SUP-0042",
  "nombreComercial": "Vitamina C 1000mg",
  "generacion": "GEN-1",
  "status": "MIGRADO",
  "transformaciones": [
    "SET_CONTENIDO_NETO: { valor: 60, unidad: 'capsulas' }",
    "MOVED_DOSAJE_TO_ATRIBUTOS: '500mg por capsula'",
    "DELETED: presentacion, costoFleteInternacional, esPadre"
  ],
  "warnings": [],
  "duracionMs": 45
}
```

Status posibles: MIGRADO | MIGRADO_CON_WARNINGS | ERROR | SKIP_GEN3 | SKIP_LIMITE

### Ejecucion por lotes (batching)

```javascript
const LOTE_SIZE = 50;  // 50 productos por batch
const PAUSA_ENTRE_LOTES_MS = 1000;  // 1 segundo entre lotes

// Calculo de ops por producto (peor caso):
// 1 update (campos nuevos) + varios deleteField = una sola operacion update en Firestore
// Los deleteField son parte del mismo updateDoc, NO son operaciones separadas en el batch
// Por lo tanto: 1 op por producto en el batch · limite 500 · con 50 productos = 50 ops

// Para grupos con fix C-1: N+1 ops (1 por cada hermano)
// Con maxima 12 variantes: hasta 12 ops adicionales por grupo
// Calculo conservador: LOTE_SIZE=50 garantiza estar muy por debajo de 500 ops

async function ejecutarLote(batch, lote, modo) {
  if (modo === 'dry-run') {
    // No ejecutar · solo loguear
    for (const item of lote) {
      logItem({ ...item, status: 'DRY_RUN' });
    }
    return;
  }
  
  try {
    await batch.commit();
    for (const item of lote) {
      logItem({ ...item, status: 'MIGRADO' });
    }
  } catch (error) {
    // Si el batch falla, registrar TODOS los del lote como fallidos
    for (const item of lote) {
      logFailed({ ...item, error: error.message });
    }
    // Continuar con el siguiente lote (no abortar todo)
    console.error(`BATCH FALLIDO: ${lote.length} productos no migrados. Ver failed.json`);
  }
  
  // Pausa para no saturar el rate limit
  await new Promise(resolve => setTimeout(resolve, PAUSA_ENTRE_LOTES_MS));
}
```

---

## 6. SCRIPT `validate-migracion.mjs` · ESTRUCTURA CON ALLOWLIST

### Politica POLITICA_MIGRACION_V1

```javascript
const POLITICA_MIGRACION_V1 = {
  // Campos que DEBEN estar ausentes en V2 puro
  must_be_absent: [
    'presentacion',
    'costoFleteInternacional',
    'esPadre',
    'esAgrupador',
    'parentId',
    'grupoId',
    'esVariante',
    'investigacion.fuenteUSA',
    'investigacion.vendedorPrincipal',
    // dosaje y sabor se verifican condicionalmente (ver conditional)
  ],
  
  // Paths con condicion: ausente solo en ciertos casos
  conditional: [
    {
      path: 'dosaje',
      condicion: (doc) => !doc.lineaNegocioNombre?.includes('SUP'),
      mensaje: 'dosaje top-level solo permitido para SUP legacy durante transicion'
    },
    {
      path: 'grupo',
      condicion: (doc) => !!doc.tipoProductoId,
      mensaje: 'grupo solo permitido si NO tiene tipoProductoId'
    },
    {
      path: 'subgrupo',
      condicion: (doc) => !!doc.tipoProductoId,
      mensaje: 'subgrupo solo permitido si NO tiene tipoProductoId'
    },
  ],
  
  // Paths que se preservan intencionalmente (no reportar como error)
  allowlist: [
    'stockUSA',       // fuera de scope · proyecto separado
    'paisOrigen',     // no se toca · ya funciona
    'investigacion.ctruEstimado',         // Fase 2 cleanup
    'investigacion.precioSugeridoCalculado', // Fase 2 cleanup
    'investigacion.margenEstimado',       // Fase 2 cleanup
    'investigacion.precioEntrada',        // Fase 2 cleanup
    'atributosSuplementos.presentacion',  // compat lectura legacy
    'contenido',                          // preservado si parse fallo (WARN_CONTENIDO_NO_PARSEABLE)
    'stockMinimo',    // campo en maestro producto (legacy · baja prioridad)
    'stockMaximo',    // campo en maestro producto (legacy · baja prioridad)
  ],
  
  // Campos que DEBEN estar presentes (con excepciones por warnings)
  must_be_present: [
    {
      path: 'contenidoNeto',
      excepciones: ['WARN_CONTENIDO_NO_PARSEABLE', 'WARN_SUP_SIN_UNIDAD', 'WARN_SKC_SIN_VOLUMEN'],
      mensaje: 'contenidoNeto es obligatorio en V2'
    },
    {
      path: 'lineaNegocioId',
      excepciones: ['WARN_SIN_LINEA'],
      mensaje: 'lineaNegocioId es obligatorio'
    },
  ]
};
```

### Output del validador

```
REPORTE DE VALIDACION POST-MIGRACION
=====================================

PASS: 195 productos cumplen todas las reglas de POLITICA_MIGRACION_V1
WARN: 12 productos con advertencias esperadas (en allowlist o con warnings documentados)
FAIL: 0 productos con violaciones

DETALLE POR CATEGORIA:
  must_be_absent · 'presentacion':    0 violaciones
  must_be_absent · 'esPadre':         0 violaciones
  must_be_absent · 'costoFlete...':   0 violaciones
  conditional · 'grupo':              5 preservados (sin tipoProductoId)
  allowlist · 'stockUSA':             212 tienen el campo (esperado)
  must_be_present · 'contenidoNeto':  195 presentes · 12 con warnings aceptados

Exit code: 0 (todo PASS o WARN esperado)
```

---

## 7. SCRIPT `restore-productos.mjs` · TRES MODOS

### Modo `--mode full`

```javascript
// Lee todos los archivos .ndjson del backup
// Para cada documento: db.doc(path).set(data, { merge: false })
// SOBREESCRIBE el shape completo · restaura campos borrados
// Timestamp restoration: convertir ISO 8601 → Firestore Timestamp

function convertirTimestampsDeBackup(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  // Detectar si el objeto es un Timestamp serializado
  if (obj.__type === 'timestamp' || (obj._seconds !== undefined && obj._nanoseconds !== undefined)) {
    return Timestamp.fromMillis(obj._seconds * 1000 + Math.floor(obj._nanoseconds / 1e6));
  }
  // Detectar ISO string
  if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(obj)) {
    return Timestamp.fromDate(new Date(obj));
  }
  // Recursivo
  const resultado = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    resultado[k] = convertirTimestampsDeBackup(v);
  }
  return resultado;
}
```

### Modo `--mode batch DOC_IDS`

```
node scripts/restore-productos.mjs --mode batch --ids "abc123,def456,ghi789" --backup backups/migracion-productos-2026-05-07_10-00
```

### Modo `--mode single DOC_ID`

```
node scripts/restore-productos.mjs --mode single --id "abc123" --backup backups/migracion-productos-2026-05-07_10-00
```

Para restauracion individual: buscar el archivo `productos-individuales/SKU.json` primero · si no existe, buscar en el NDJSON de la coleccion completa.

---

## 8. PLAN DE EJECUCION CUTOVER · MINUTO A MINUTO

```
T-1 dia:
  Ejecutar todo el flujo completo en un clon de la BD en staging (si existe)
  o en modo --dry-run contra produccion y revisar el output

T-30 min:
  Ejecutar backup Nivel A (gcloud firestore export)
  Ejecutar backup Nivel B (backup-pre-migracion.mjs)
  Verificar MANIFEST.json: conteos y checksums correctos

T-20 min:
  Backup Nivel C (snap individuales por SKU)
  Verificar que el directorio productos-individuales/ tenga 212 archivos

T-15 min:
  Pausar webhooks ML: en Firebase Console → Functions → processMLWebhook
    Opcion A (mejor): en mlConfig, setear mlConfig.webhooksActivos = false
    (la CF debe respetar esta flag antes de procesar)
    Opcion B (nuclear): suspender la CF temporalmente desde Firebase Console
  Verificar que no haya webhooks en proceso: revisar mlWebhookLog
    No debe haber documentos con estado='procesando' creados en los ultimos 2 min

T-10 min:
  Verificar 0 actividad de usuarios:
    En Firebase Console → Firestore → productos → actividad reciente
    Confirmar que no hay writes en los ultimos 5 min (si los hay, esperar)

T+0 (inicio del cutover):
  node scripts/migrate-productos-gen3.mjs --dry-run
  Revisar el output: contar PASS, WARN, FAIL esperados
  Si hay FAILs inesperados: NO proceder · diagnosticar

T+5:
  Apply de 9 productos representativos (1 de cada caso):
    node scripts/migrate-productos-gen3.mjs --apply --single SUP-0001
    node scripts/migrate-productos-gen3.mjs --apply --single SUP-0042
    node scripts/migrate-productos-gen3.mjs --apply --single SKC-0001
    node scripts/migrate-productos-gen3.mjs --apply --single SKC-0020
    ... (elegir productos que cubran: GEN-1/GEN-2/GEN-3, SUP/SKC, con grupo/sin grupo)

T+15:
  Verificar manualmente en Firebase Console los 9 productos:
    - contenidoNeto existe y tiene valor correcto
    - Campos legacy borrados
    - grupoVarianteId es UUID (no doc ID)
    - investigacion.fuenteUSA y vendedorPrincipal borrados
  Si algo esta mal: ROLLBACK de los 9 via restore-productos.mjs --mode batch

T+25:
  Apply masivo:
    node scripts/migrate-productos-gen3.mjs --apply
    (aprox. 3 minutos para 212 productos en lotes de 50)

T+30:
  node scripts/validate-migracion.mjs
  Debe retornar exit code 0 (todo PASS o WARN esperado)
  Si hay FAILs: iniciar ROLLBACK COMPLETO antes de continuar

T+35:
  Deploy frontend + functions:
    npx vite build && firebase deploy --only hosting
    firebase deploy --only functions (si hubo cambios en CF)

T+40:
  Reactivar webhooks ML:
    Revertir la suspension de la CF o actualizar mlConfig.webhooksActivos = true
    Los webhooks acumulados durante la pausa se procesaran en orden
    (ver seccion de riesgos: Riesgo-4)

T+45:
  Smoke test manual:
    1. Crear un producto nuevo via wizard V2 (flag activado)
    2. Editarlo via editor V2
    3. Buscar el producto en la vista de listado
    4. Verificar que la cotizacion lo encuentra
    5. Verificar que el ChipDuracionEnvase calcula correctamente para el nuevo producto

T+55:
  Si hay integracion ML activa:
    Crear una orden ML de prueba con un producto migrado
    Verificar que el sync procesa correctamente

T+65:
  CIERRE FORMAL DEL CUTOVER
  Monitoreo activo durante 7 dias:
    - Revisar logs de errores en Firebase Console
    - Verificar que no hay CFs disparando con datos corruptos
    - Confirmar que el pipeline de CTRU sigue calculando correctamente
```

---

## 9. INDICES DE FIRESTORE · IMPACTO POST-MIGRACION

### Indices existentes que NO requieren cambios

Los indices actuales en `firestore.indexes.json` no usan campos que se estan borrando:
- `productos: estado + marca` → SAFE
- `productos: estado + grupo` → IMPACTO LEVE (ver abajo)
- Todos los indices de `unidades`, `envios`, `ventas`, etc. → SAFE

### Indice `productos: estado + grupo` · analisis

Este indice se usa para queries del tipo:
```javascript
query(col, where('estado', '==', 'activo'), where('grupo', '==', 'Suplementos'))
```

Despues de la migracion, el campo `grupo` se borra para productos con `tipoProductoId`. Los productos sin `tipoProductoId` conservan `grupo`. El indice sigue siendo valido para los productos que conservan el campo. Las queries que usan este indice sobre productos sin `grupo` simplemente no retornan esos productos, lo cual es el comportamiento correcto.

Accion requerida: verificar si hay queries activas usando `where('grupo', ...)` en el codigo y reemplazarlas con `where('tipoProductoId', ...)` antes del cutover. No requiere rebuild del indice.

### Indices NUEVOS recomendados post-migracion

Agregar a `firestore.indexes.json` antes del deploy:

```json
{
  "collectionGroup": "productos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "grupoVarianteId", "order": "ASCENDING" },
    { "fieldPath": "estado", "order": "ASCENDING" }
  ]
}
```

Este indice es necesario para el query `getVariantes()` que busca hermanos por `grupoVarianteId` + filtro de estado.

---

## 10. RIESGOS CRITICOS Y MITIGACIONES

### Riesgo-1 · Concurrencia de usuarios durante el cutover

- Probabilidad: MEDIA (equipo pequeno pero hay horarios no controlados)
- Impacto: ALTO · un write concurrente puede dejar un producto en estado hibrido (campos legacy recien eliminados + campos nuevos escritos por el usuario encima)
- Mitigacion: ejecutar el cutover en horario de baja actividad (ej. 2am-4am hora Peru) · verificar logs de presencia antes de iniciar · el script detecta si un producto fue modificado despues del inicio del backup (comparando `ultimaEdicion` timestamp) · si fue modificado, emitir WARN_CONCURRENCIA y saltar ese documento para revision manual

### Riesgo-2 · Webhooks ML acumulados en queue durante la pausa

- Probabilidad: MEDIA (ML genera webhooks frecuentes en horario comercial)
- Impacto: BAJO · los webhooks de ML son eventos de stock y venta, no de catalogo de productos · cuando se reactivan, se procesaran en orden cronologico · el peor caso es un delay de 25-30 minutos en procesar ordenes ML recibidas durante la ventana de mantenimiento
- Mitigacion: ejecutar el cutover en horario donde ML tenga minima actividad (noche de dia laboral o domingo) · verificar que la CF de webhook tiene idempotencia (misma orden procesada dos veces no duplica stock) · si hay ordenes urgentes durante la pausa, procesarlas manualmente en Firebase Console

### Riesgo-3 · Service account del Admin SDK sin permisos correctos

- Probabilidad: BAJA (los scripts S3.4 ya funcionaron con la misma SA)
- Impacto: ALTO · el script falla silenciosamente o con error de permisos en produccion
- Mitigacion: el primer paso del script es un health check: leer 1 documento de `productos` y verificar que la respuesta es correcta · si falla, abortar antes de modificar nada · verificar que `GOOGLE_APPLICATION_CREDENTIALS` apunta al archivo correcto de la service account con rol `Cloud Datastore User` o `Firebase Admin`

### Riesgo-4 · Contadores de SKU desincronizados si el script genera SKUs durante la migracion

- Probabilidad: BAJA (la migracion no genera SKUs · solo transforma documentos existentes)
- Impacto: N/A
- Nota: los unicos scripts que modifican contadores son los de fix (fix-sku-counters, cerrar-gap). `migrate-productos-gen3.mjs` NO toca los contadores.

### Riesgo-5 · Cloud Functions reactivas que disparen cascadas

- Probabilidad: MEDIA · hay CFs que escuchan a `productos` (ej. ML sync, auditoria)
- Impacto: ALTO · si una CF de auditoria escribe en `audit_logs` por cada update del script, se generarian 212 entradas de audit durante la migracion · si una CF de ML sync detecta cambios en productos y los pushea a ML, podria interrumpir listings
- Mitigacion: revisar `functions/src/index.ts` y `functions/src/triggers/` antes del cutover · identificar que CFs tienen triggers en `productos` · considerar suspenderlas temporalmente durante el script · el Admin SDK bypasea las reglas de Firestore pero NO bypasea los triggers · los triggers se disparan independientemente de si la escritura viene del Admin SDK o del cliente

### Riesgo-6 · Fallo parcial del batch

- Probabilidad: BAJA (Firestore batches son atomicos)
- Impacto: MEDIO · si un batch de 50 productos falla, se pierden 50 transformaciones
- Mitigacion: el script registra en `failed.json` todos los productos del lote fallido · el modo `--resume DOC_ID` permite reanudar desde el punto de fallo · el rollback selectivo via `restore-productos.mjs --mode batch` puede restaurar exactamente los documentos del lote fallido

### Riesgo-7 · Parse incorrecto de `contenido` string

- Probabilidad: MEDIA · el campo `contenido` es un string libre con formatos no estandarizados
- Impacto: MEDIO · un parse incorrecto crea un `contenidoNeto` con valor o unidad incorrectos
- Mitigacion: el dry-run lista todos los parseos con los valores originales y los derivados · el usuario puede revisar los casos de WARN antes del apply · post-apply, el validator cruza los `contenidoNeto` generados contra los `contenido` originales (preservados en el backup) · cualquier discrepancia se puede corregir con el editor V2

### Riesgo-8 · `investigacion` con estructura inesperada

- Probabilidad: BAJA · la estructura de investigacion esta tipada y es consistente
- Impacto: BAJO · si `investigacion` es `null` o no tiene el sub-campo `fuenteUSA`, el `deleteField()` simplemente no hace nada (Firestore no lanza error al borrar un campo que no existe)
- Mitigacion: el script verifica si `doc.investigacion?.fuenteUSA` existe antes de intentar borrarlo · si `doc.investigacion` es `null`, no se toca

### Riesgo-9 · Degradacion de rendimiento del frontend durante la ventana

- Probabilidad: MUY BAJA (no hay usuarios activos en el cutover)
- Impacto: BAJO · durante el apply masivo, hay 212 writes en ~3 minutos · Firestore puede tener latencia momentanea en reads durante ese periodo
- Mitigacion: el cutover se ejecuta cuando hay 0 usuarios activos · los lotes de 50 con pausa de 1s distribuyen la carga

### Riesgo-10 · Backup incompleto o corrupto

- Probabilidad: MUY BAJA
- Impacto: CATASTROFICO · sin backup valido, el rollback es imposible
- Mitigacion: el script de backup verifica checksums SHA256 antes de iniciar el apply · si el MANIFEST.json no existe o los checksums no coinciden, el apply se bloquea con mensaje "BACKUP INVALIDO: no se puede continuar sin backup verificado" · el Nivel A (gcloud export) es una segunda red de seguridad independiente del Nivel B

---

## 11. DEFINICION DE CAMPOS BORRADOS · REFERENCIA COMPLETA

### Siempre borrar (en todos los productos):

| Campo | Razon |
|---|---|
| `presentacion` (top-level) | Reemplazado por `contenidoNeto.unidad` |
| `costoFleteInternacional` | Deprecado S3.2 · vive en envios/OC |
| `esPadre` | Legacy · reemplazado por `esPrincipalGrupo` |
| `esAgrupador` | Legacy |
| `parentId` | Legacy · reemplazado por `grupoVarianteId` |
| `grupoId` | Legacy · reemplazado por `grupoVarianteId` |
| `esVariante` | Legacy |
| `investigacion.fuenteUSA` | Deprecado · reemplazado por `proveedoresUSA[]` |
| `investigacion.vendedorPrincipal` | Deprecado · reemplazado por `competidorPrincipal` |

### Borrar condicionalmente:

| Campo | Condicion para borrar |
|---|---|
| `grupo` | Solo si existe `tipoProductoId` |
| `subgrupo` | Solo si existe `tipoProductoId` |
| `dosaje` (top-level) | Solo DESPUES de moverlo a `atributosSuplementos.dosaje` |
| `sabor` (top-level) | Solo DESPUES de moverlo a `atributosSuplementos.sabor` |
| `contenido` (string) | Solo si se creo `contenidoNeto` exitosamente |

### Borrar en Fase 2 (proxima sesion):

| Campo | Dependencia |
|---|---|
| `investigacion.ctruEstimado` | Frontend V1 legacy debe estar eliminado |
| `investigacion.precioSugeridoCalculado` | Idem |
| `investigacion.margenEstimado` | Idem |
| `investigacion.precioEntrada` | Idem |

### No tocar (politica):

| Campo | Razon |
|---|---|
| `stockUSA` | Proyecto separado |
| `paisOrigen` | Ya funciona |
| `stockMinimo` / `stockMaximo` | Baja prioridad · no interfieren con V2 |
| `componentesPack[]` | Datos historicos de packs |
| `atributosSuplementos.presentacion` | Compat lectura legacy |

---

## 12. LISTA DE VERIFICACION PRE-CUTOVER

- [ ] Backup Nivel A verificado (gcloud operation state=DONE)
- [ ] Backup Nivel B verificado (checksums SHA256 correctos)
- [ ] Backup Nivel C verificado (212 archivos individuales)
- [ ] dry-run ejecutado y revisado (0 FAILs inesperados)
- [ ] CFs con triggers en `productos` identificadas y suspendidas si es necesario
- [ ] 0 usuarios activos en el momento de iniciar el apply
- [ ] Webhooks ML pausados
- [ ] Indices nuevos (`grupoVarianteId + estado`) agregados a `firestore.indexes.json` y desplegados
- [ ] Build de frontend exitoso (npx vite build, 0 errores)
- [ ] Service account verificada (health check en 1 documento)
- [ ] Horario confirmado con el equipo
