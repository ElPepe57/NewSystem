/**
 * Onda 2 · Sugerir atributos faltantes con IA + review · 2026-05-05
 *
 * Modos:
 *   --sample 5    → DRY-RUN: genera 5 muestras (3 SUP + 2 SKC random) e imprime
 *                    sin escribir · usado para validar calidad
 *   --apply       → escribe en BD (rate-limit 1.2s entre llamadas)
 *   --limit N     → procesar máximo N productos (default: todos los faltantes)
 *
 * Reglas:
 *   - Cero override de campos con valor existente
 *   - Etiquetas filtradas contra maestro · NO crea nuevas
 *   - Audit `fuente: 'ia'` por timestamp de generación
 *   - Skip productos con datos básicos incompletos (marca/nombre/línea/contenidoNeto)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

// El backend usa la misma API key que la CF · pero acá llamamos al CF callable, no directo a Gemini
// El CF lo conoce como callable. Para llamar callable desde un script Node, necesitamos hacer HTTP POST al endpoint.
// URL del CF: https://us-central1-businessmn-269c9.cloudfunctions.net/generarDescripcionProducto

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const sampleArg = args.find(a => a.startsWith('--sample'));
const SAMPLE_SIZE = sampleArg ? parseInt(args[args.indexOf(sampleArg) + 1] || '5') : null;
const limitArg = args.find(a => a.startsWith('--limit'));
const LIMIT = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] || '0') : 0;

console.log(`═══ Onda 2 · Sugerir atributos · ${APPLY ? 'APPLY' : (SAMPLE_SIZE ? `DRY-RUN sample=${SAMPLE_SIZE}` : 'DRY-RUN preview')} ═══\n`);

// ─── Llamar CF como HTTP (el callable acepta POST con shape {data: ...}) ────
// La CF callable interna requiere autenticación · usamos la URL HTTP equivalente.
// Para este script de admin, llamamos directamente a Gemini API (mismo flujo que la CF) pero acá no tenemos acceso al secret.
// SOLUCIÓN: leer la API key de la misma manera que el firebase functions config.

let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  // Intentar leer del .env de functions/
  try {
    const envContent = readFileSync('functions/.env', 'utf-8');
    const m = envContent.match(/GEMINI_API_KEY=(.+)/);
    if (m) GEMINI_API_KEY = m[1].trim();
  } catch {}
}
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY no encontrado · setear en env o functions/.env');
  process.exit(1);
}

// ─── Cargar productos + etiquetas catalogo ──────────────────────────────────
const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const etiquetasSnap = await db.collection('etiquetas').get();
const etiquetasCatalogo = etiquetasSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(e => e.estado !== 'archivada' && (e.activo !== false))
  .map(e => ({ id: e.id, nombre: e.nombre, tipo: e.tipo || 'sin' }));

// Cargar categorías por línea (Onda 2 extendida)
const lineasSnap = await db.collection('lineasNegocio').get();
const lineasIdToCodigo = {};
lineasSnap.docs.forEach(d => lineasIdToCodigo[d.id] = d.data().codigo);
const categoriasSnap = await db.collection('categorias').get();
const categoriasCatalogo = categoriasSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(c => c.estado !== 'archivada' && (c.activo !== false))
  .map(c => ({
    id: c.id,
    nombre: c.nombre,
    linea: (c.lineaNegocioIds || []).map(id => lineasIdToCodigo[id]).filter(Boolean)[0] || '',
  }));

console.log(`Productos cargados: ${productos.length}`);
console.log(`Etiquetas catálogo (activas): ${etiquetasCatalogo.length}`);
console.log(`Categorías catálogo (activas): ${categoriasCatalogo.length}`);

// ─── Helpers ────────────────────────────────────────────────────────────────
function getLinea(p) {
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (linea.includes('skin')) return 'SKC';
  if (linea.includes('suplem') || linea.includes('vitam')) return 'SUP';
  return 'OTRA';
}

function tieneAtributosBasicos(p, linea) {
  if (!p.marca || !p.nombreComercial || !linea) return false;
  if (!p.contenidoNeto?.valor) return false;
  return true;
}

function necesitaSugerencia(p, linea) {
  // Si tiene pocas etiquetas o pocas categorías, también es candidato
  const pocasEtiquetas = (p.etiquetaIds || []).length < 3;
  const pocasCategorias = (p.categoriaIds || []).length === 0;
  if (linea === 'SUP') {
    const sup = p.atributosSuplementos ?? {};
    return !sup.momentoDia?.length || !sup.tomaConComida || !sup.edadRecomendada
      || !sup.restricciones?.length || pocasEtiquetas || pocasCategorias;
  }
  if (linea === 'SKC') {
    const skc = p.atributosSkincare ?? {};
    return !skc.zonaAplicacion?.length || !skc.pasoRutina
      || !skc.ingredienteClave || !skc.textura || !skc.preocupaciones?.length
      || pocasEtiquetas || pocasCategorias;
  }
  return false;
}

// Productos candidatos: línea válida + datos básicos completos + necesitan sugerencia
const candidatos = productos.filter(p => {
  const linea = getLinea(p);
  if (linea === 'OTRA') return false;
  if (!tieneAtributosBasicos(p, linea)) return false;
  return necesitaSugerencia(p, linea);
});

console.log(`Productos candidatos para sugerencia: ${candidatos.length}`);
const pSUP = candidatos.filter(p => getLinea(p) === 'SUP');
const pSKC = candidatos.filter(p => getLinea(p) === 'SKC');
console.log(`  SUP: ${pSUP.length} · SKC: ${pSKC.length}`);

// ─── Selección por modo ─────────────────────────────────────────────────────
let aProcesar = candidatos;
if (SAMPLE_SIZE) {
  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
  // Sample inteligente: incluir al menos 1 producto infantil + 1 SUP normal + 1 SKC normal + 1 SKC universal
  const esInfantil = (p) => /kid|niñ|child|junior|bebé|baby|infant|teen|adolescen/i.test(p.nombreComercial || '');
  const esSKCUniversal = (p) => getLinea(p) === 'SKC' &&
    /niacinamida|niacinamide|hialurónico|hyaluronic|vitamin c|vitamina c/i.test(
      `${p.nombreComercial} ${p.atributosSkincare?.ingredienteClave || ''}`);
  const infantiles = candidatos.filter(esInfantil);
  const skcUniversales = candidatos.filter(esSKCUniversal);
  const seleccion = [];
  if (infantiles.length > 0) seleccion.push(shuffle(infantiles)[0]);
  if (skcUniversales.length > 0) seleccion.push(shuffle(skcUniversales)[0]);
  // Completar con random
  const yaIds = new Set(seleccion.map(x => x.id));
  const resto = shuffle(candidatos.filter(x => !yaIds.has(x.id)));
  while (seleccion.length < SAMPLE_SIZE && resto.length > 0) seleccion.push(resto.shift());
  aProcesar = seleccion;
} else if (LIMIT > 0) {
  aProcesar = candidatos.slice(0, LIMIT);
}
console.log(`A procesar: ${aProcesar.length}\n`);

// ─── Llamada a Gemini directa (mismo formato que la CF) ─────────────────────
async function callGemini(input) {
  const prompt = await buildPrompt(input);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
}

async function buildPrompt(input) {
  const linea = getLinea(input);
  const esSUP = linea === 'SUP';
  const esSKC = linea === 'SKC';
  const lines = [
    `Marca: ${input.marca}`,
    `Nombre comercial: ${input.nombreComercial}`,
    `Línea: ${input.lineaNegocioNombre}`,
    `País: ${input.paisOrigen}`,
  ];
  if (input.contenidoNeto) lines.push(`Contenido: ${input.contenidoNeto.valor} ${input.contenidoNeto.unidad}`);
  if (input.tipoProducto?.nombre) lines.push(`Tipo: ${input.tipoProducto.nombre}`);
  if (esSUP) {
    const s = input.atributosSuplementos ?? {};
    if (s.dosaje) lines.push(`Dosaje: ${s.dosaje}`);
    if (s.sabor) lines.push(`Sabor: ${s.sabor}`);
  }
  if (esSKC) {
    const s = input.atributosSkincare ?? {};
    if (s.tipoProductoSKC) lines.push(`Tipo SKC: ${s.tipoProductoSKC}`);
    if (s.ingredienteClave) lines.push(`Ingrediente clave actual: ${s.ingredienteClave}`);
  }

  const tiposPermitidos = ['descriptiva', 'restriccion', 'certificacion', 'ingrediente', 'performance'];
  const cat = etiquetasCatalogo.filter(e => tiposPermitidos.includes(e.tipo));
  const porTipo = {};
  for (const e of cat) {
    porTipo[e.tipo] = porTipo[e.tipo] || [];
    porTipo[e.tipo].push(e);
  }
  let listaEtiquetas = '';
  for (const [tipo, lista] of Object.entries(porTipo)) {
    listaEtiquetas += `\n  ${tipo.toUpperCase()}: ${lista.map(e => `"${e.nombre}"`).join(' · ')}`;
  }

  // Categorías filtradas por línea · agrupadas por temas SKC para evitar solapamiento
  let listaCategorias = '';
  let reglasCategorias = '';
  if (esSUP) {
    const supCats = categoriasCatalogo.filter(c => c.linea === 'SUP');
    listaCategorias = supCats.map(c => `"${c.nombre}"`).join(' · ');
  } else if (esSKC) {
    const skcCats = categoriasCatalogo.filter(c => c.linea === 'SKC');
    listaCategorias = skcCats.map(c => `"${c.nombre}"`).join(' · ');
    reglasCategorias = `
   GRUPOS SKC excluyentes (elegí MÁXIMO 1 por grupo · la MÁS específica):
     * Grupo Limpieza: ["Limpiador en Espuma", "Limpiador en Gel", "Limpieza", "Aceite Limpiador"] → solo 1
     * Grupo Hidratación: ["Hidratación", "Crema Hidratante", "Gel Hidratante"] → solo 1
     * Grupo Tónico: ["Tonificación", "Tónico"] → solo 1
     * Grupo Ojos: ["Cuidado de Ojos y Labios", "Contorno de Ojos", "Parches de Ojos"] → solo 1
     * Grupo Mascarillas: ["Mascarillas", "Sheet Mask", "Sleeping Pack", "Wash-Off Mask"] → solo 1
     * Grupo Protección Solar: ["Protección Solar", "Protector Solar Corporal", "Protector Solar Facial"] → solo 1
   Si el producto encaja en 2 grupos distintos (ej. Sérum para ojos), podés sumar 1 categoría de cada grupo.`;
  }

  return `Sos clasificador experto de productos de bienestar para mercado peruano. Devolvé SOLO JSON con atributos sugeridos.

REGLAS GENERALES (críticas):
1. CONFIANZA ALTA o VACÍO. Si dudás, dejá el campo vacío. Es mejor que el humano lo complete que vos inventes.
2. NO uses defaults genéricos como "Adultos (18+)" sin evidencia. Si el producto no tiene marcador claro de público, dejá edadRecomendada vacío.
3. Cero invención de etiquetas/categorías: solo IDs del listado provisto.

DATOS DEL PRODUCTO:
${lines.join('\n')}

ATRIBUTOS A SUGERIR (todos opcionales · si dudás vacío):
${esSUP ? `
SUP-only:
- "momentoDia": array de "Mañana", "Tarde", "Noche", "Pre-entreno", "Post-entreno", "Cualquiera"
- "tomaConComida": "Con", "En ayunas", "Indiferente", "Antes de dormir"

- "edadRecomendada": REGLA · primero detectar marcadores específicos · luego fallback a Adultos.
   PRIORIDAD 1 (marcador específico · USAR SI HAY):
     * Nombre/marca contiene "Kids", "Children", "Niños", "Junior", "For Children", "Kid's", "Kids'", "Bebé", "Baby", "Infant" → "Niños (3-12)"
     * Marca explícitamente infantil (Centrum Kids, Natrol Kids, NuBest Tall Kids, Lil Critters, etc.) → "Niños (3-12)"
     * Nombre contiene "Adolescentes", "Teen", "+10 años" → "Adolescentes (13-17)"
     * Nombre contiene "+50", "+60", "Senior", "Mature", "Adultos mayores" → "Adultos mayores (60+)"
   PRIORIDAD 2 (default si no hay marcador específico):
     * Suplemento sin indicio infantil/adolescente/senior → "Adultos (18+)" (default razonable · suplementos son típicamente adultos)

- "restricciones": array · solo si HAY EVIDENCIA explícita en nombre/marca/dosaje. Sino vacío.
` : ''}${esSKC ? `
SKC-only:
- "zonaAplicacion": array de "Rostro", "Cuello", "Manos", "Cuerpo", "Ojos", "Labios"
- "pasoRutina": "Limpiador", "Tónico", "Esencia", "Sérum", "Crema", "Protector solar", "Mascarilla", "Exfoliante", "Aceite"

- "ingredienteClave": string libre · LECTURA del nombre comercial (NO inventes ingredientes nuevos)
   Ejemplos:
     * "Niacinamide 10% TXA 4% Serum" → "Niacinamida 10% + Ácido Tranexámico 4%"
     * "Vitamin C 23% Serum" → "Vitamina C 23%"
     * "Madagascar Centella Toning Toner" → "Centella Asiática (TECA)"
     * "Birch Juice Moisturizing Sunscreen" → "Jugo de Abedul"
   Si el nombre no menciona ingredientes claros → vacío "".

- "textura": una de "gel", "crema", "aceite", "espuma", "stick", "parche", "polvo", "agua", "balsamo", "locion"
   Reglas:
     * "Cream" / "Crema" → "crema"
     * "Toner" / "Tónico" → "agua"
     * "Foam" / "Espuma" → "espuma"
     * "Oil" / "Aceite" → "aceite"
     * "Gel" → "gel"
     * "Lotion" → "locion"
     * "Balm" / "Bálsamo" → "balsamo"
     * "Stick" → "stick"
     * "Parche" / "Patch" → "parche"
     * "Polvo" / "Powder" → "polvo"
     * Si dudás → vacío.

- "preocupaciones": array de strings · vocabulario CERRADO (usá EXACTAMENTE estos términos):
   Acné · Puntos negros · Poros · Textura irregular · Oleosidad · Piel áspera ·
   Manchas · Hiperpigmentación · Marcas post-acné · Tono desigual · Piel opaca ·
   Arrugas · Líneas finas · Flacidez · Firmeza · Pérdida de elasticidad ·
   Deshidratación · Hidratación · Piel seca · Barrera dañada · Descamación ·
   Rojeces · Rosácea · Irritación · Piel reactiva · Eczema · Dermatitis ·
   Ojeras · Bolsas
   Reglas (derivar del ingrediente):
     * Niacinamida → ["Manchas", "Poros"]
     * Vitamina C → ["Manchas", "Tono desigual"]
     * Retinol → ["Líneas finas", "Arrugas"]
     * Centella / TECA → ["Rojeces", "Irritación"]
     * BHA / Salicílico → ["Acné", "Poros", "Oleosidad"]
     * Hialurónico → ["Hidratación", "Deshidratación"]
     * Ceramidas → ["Barrera dañada", "Piel seca"]
   Si no hay ingrediente claro → vacío [].
` : ''}
- "etiquetaNombres": array de NOMBRES (string exacto del catálogo) · MÁXIMO 5 · solo alta confianza.
- "categoriaNombres": array de NOMBRES (string exacto del catálogo) · 1-3 categorías que mejor describan el producto.
   Reglas:
     * Elegí la categoría MÁS ESPECÍFICA cuando hay opciones (ej. "Limpiador en Espuma" antes que "Limpieza" general)
     * Podés elegir 1-3 categorías que se complementen temáticamente
     * NO inventes categorías nuevas
${reglasCategorias}

REGLAS DE ETIQUETADO ESTRICTAS:
A. Etiqueta "Para Adultos" se PUEDE usar incluso si edadRecomendada="Adultos (18+)" — son metadatos complementarios, no duplicados.
   Etiqueta "Para Hombres" o "Para Mujeres" se AGREGA cuando el producto se diferencia por género (Tongkat Ali → "Para Adultos" + "Para Hombres").
${esSKC ? `
B. Etiquetas de tipo de piel SKC son EXCLUYENTES (elegí SOLO UNA, NUNCA varias):
   - Ingrediente UNIVERSAL (niacinamida, hialurónico, vitamina C, retinol suave) → "Todo tipo de piel"
   - Específico para piel grasa (BHA, salicílico, productos anti-acné) → "Piel Grasa"
   - Para piel seca (ceramidas, oclusivos, hidratación intensa) → "Piel Seca"
   - Para piel sensible (centella, calmante, sin fragancia) → "Piel Sensible"
   - PROHIBIDO 2 o 3 tipos de piel simultáneamente.
` : ''}
C. Restricciones: solo si dato concreto. Cero invención.

CATÁLOGO DE ETIQUETAS DISPONIBLES:${listaEtiquetas}

CATÁLOGO DE CATEGORÍAS DISPONIBLES (línea ${linea}):
  ${listaCategorias}

JSON output:
{
  "atributosSugeridos": {
    ${esSUP ? '"momentoDia": [], "tomaConComida": "", "edadRecomendada": "", "restricciones": [],' : ''}
    ${esSKC ? '"zonaAplicacion": [], "pasoRutina": "", "ingredienteClave": "", "textura": "", "preocupaciones": [],' : ''}
    "etiquetaNombres": [],
    "categoriaNombres": []
  }
}`;
}

// ─── Helper · normalizar nombre para fuzzy matching ─────────────────────────
function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remueve tildes
    .replace(/[^a-z0-9]/g, '')          // remueve no-alfanumérico
    .trim();
}

// ─── Mapper · nombre IA → ID maestro ────────────────────────────────────────
function nombreAId(nombre, catalogo) {
  if (!nombre) return null;
  const n = normalizar(nombre);
  if (!n) return null;
  // Match exacto normalizado
  const exact = catalogo.find(c => normalizar(c.nombre) === n);
  if (exact) return exact.id;
  // Match por inclusión (partial)
  const partial = catalogo.find(c => {
    const cn = normalizar(c.nombre);
    return cn.includes(n) || n.includes(cn);
  });
  if (partial) return partial.id;
  return null;
}

// ─── Procesar productos ─────────────────────────────────────────────────────
const resultados = [];
let i = 0;
for (const p of aProcesar) {
  i++;
  const linea = getLinea(p);
  process.stdout.write(`[${i}/${aProcesar.length}] ${p.sku} · ${(p.nombreComercial || '').substring(0, 40)}... `);
  try {
    const out = await callGemini(p);
    const sug = out.atributosSugeridos || {};
    resultados.push({ producto: p, linea, sugerencias: sug });
    process.stdout.write(`OK\n`);
  } catch (e) {
    process.stdout.write(`ERROR · ${e.message?.substring(0, 60)}\n`);
    resultados.push({ producto: p, linea, error: e.message });
  }
  // Rate limit
  if (APPLY && i < aProcesar.length) await new Promise(r => setTimeout(r, 1200));
}

// ─── Mostrar resultados ─────────────────────────────────────────────────────
console.log(`\n═══ RESULTADOS ═══`);
const idsToNombre = Object.fromEntries(etiquetasCatalogo.map(e => [e.id, e.nombre]));
const catIdsToNombre = Object.fromEntries(categoriasCatalogo.map(c => [c.id, c.nombre]));

for (const r of resultados) {
  if (r.error) {
    console.log(`\n❌ ${r.producto.sku}: ${r.error?.substring(0, 80)}`);
    continue;
  }
  const p = r.producto;
  const s = r.sugerencias;
  console.log(`\n──── ${p.sku} · ${p.marca} · ${p.nombreComercial} (${r.linea}) ────`);
  if (r.linea === 'SUP') {
    if (s.momentoDia?.length) console.log(`  momentoDia:      ${s.momentoDia.join(', ')}`);
    if (s.tomaConComida)      console.log(`  tomaConComida:   ${s.tomaConComida}`);
    if (s.edadRecomendada)    console.log(`  edadRecomendada: ${s.edadRecomendada}`);
    if (s.restricciones?.length) console.log(`  restricciones:   ${s.restricciones.join(', ')}`);
  }
  if (r.linea === 'SKC') {
    if (s.zonaAplicacion?.length) console.log(`  zonaAplicacion:  ${s.zonaAplicacion.join(', ')}`);
    if (s.pasoRutina)             console.log(`  pasoRutina:      ${s.pasoRutina}`);
    if (s.ingredienteClave)       console.log(`  ingredienteClave: ${s.ingredienteClave}`);
    if (s.textura)                console.log(`  textura:         ${s.textura}`);
    if (s.preocupaciones?.length) console.log(`  preocupaciones:  ${s.preocupaciones.join(', ')}`);
  }
  // Etiquetas: la IA devuelve nombres · resolvemos a IDs con fuzzy match
  if (s.etiquetaNombres?.length) {
    const resolvedIds = s.etiquetaNombres.map(n => ({ nombre: n, id: nombreAId(n, etiquetasCatalogo) }));
    const valid = resolvedIds.filter(x => x.id);
    const invalid = resolvedIds.filter(x => !x.id);
    if (valid.length) console.log(`  etiquetas:       ${valid.map(x => x.nombre).join(', ')}`);
    if (invalid.length) console.log(`  etiquetas (no resuelto): ${invalid.map(x => x.nombre).join(', ')}`);
    // Guardar IDs resueltos en el resultado para usar en apply
    s._etiquetaIds = valid.map(x => x.id);
  }
  if (s.categoriaNombres?.length) {
    const resolvedIds = s.categoriaNombres.map(n => ({ nombre: n, id: nombreAId(n, categoriasCatalogo) }));
    const valid = resolvedIds.filter(x => x.id);
    const invalid = resolvedIds.filter(x => !x.id);
    if (valid.length) console.log(`  categorías:      ${valid.map(x => x.nombre).join(', ')}`);
    if (invalid.length) console.log(`  categorías (no resuelto): ${invalid.map(x => x.nombre).join(', ')}`);
    s._categoriaIds = valid.map(x => x.id);
  }
}

// ─── APPLY ──────────────────────────────────────────────────────────────────
if (!APPLY) {
  console.log(`\n💡 DRY-RUN · NO se escribió nada en BD.\n`);
  process.exit(0);
}

console.log(`\n🚨 APPLY · escribiendo cambios... \n`);
const ahora = FieldValue.serverTimestamp();
let written = 0, errors = 0;

for (const r of resultados) {
  if (r.error) continue;
  const p = r.producto;
  const s = r.sugerencias || {};
  const update = { ultimaEdicion: ahora };

  // Defensiva: cero override
  if (r.linea === 'SUP') {
    const supActual = p.atributosSuplementos || {};
    const newSup = { ...supActual };
    if (!supActual.momentoDia?.length && s.momentoDia?.length) newSup.momentoDia = s.momentoDia;
    if (!supActual.tomaConComida && s.tomaConComida) newSup.tomaConComida = s.tomaConComida;
    if (!supActual.edadRecomendada && s.edadRecomendada) newSup.edadRecomendada = s.edadRecomendada;
    if (!supActual.restricciones?.length && s.restricciones?.length) newSup.restricciones = s.restricciones;
    update.atributosSuplementos = newSup;
  }
  if (r.linea === 'SKC') {
    const skcActual = p.atributosSkincare || {};
    const newSkc = { ...skcActual };
    if (!skcActual.zonaAplicacion?.length && s.zonaAplicacion?.length) newSkc.zonaAplicacion = s.zonaAplicacion;
    if (!skcActual.pasoRutina && s.pasoRutina) newSkc.pasoRutina = s.pasoRutina;
    // Nuevos S3.5 · solo si vacíos
    if (!skcActual.ingredienteClave && s.ingredienteClave) newSkc.ingredienteClave = s.ingredienteClave;
    if (!skcActual.textura && s.textura) newSkc.textura = s.textura;
    if (!skcActual.preocupaciones?.length && s.preocupaciones?.length) newSkc.preocupaciones = s.preocupaciones;
    update.atributosSkincare = newSkc;
  }

  // Etiquetas: usar los IDs resueltos por fuzzy match
  const etiqIdsResueltos = s._etiquetaIds || [];
  if (etiqIdsResueltos.length) {
    const actuales = p.etiquetaIds || [];
    const nuevos = etiqIdsResueltos.filter(id => !actuales.includes(id));
    if (nuevos.length > 0) {
      update.etiquetaIds = [...actuales, ...nuevos];
      const actualesData = p.etiquetasData || [];
      const nuevosData = nuevos.map(id => {
        const e = etiquetasCatalogo.find(x => x.id === id);
        return { etiquetaId: id, nombre: e.nombre, tipo: e.tipo, codigo: '' };
      });
      update.etiquetasData = [...actualesData, ...nuevosData];
    }
  }

  // Categorías: usar los IDs resueltos por fuzzy match
  const catIdsResueltos = s._categoriaIds || [];
  if (catIdsResueltos.length) {
    const actuales = p.categoriaIds || [];
    const nuevos = catIdsResueltos.filter(id => !actuales.includes(id));
    if (nuevos.length > 0) {
      update.categoriaIds = [...actuales, ...nuevos];
      const actualesData = p.categorias || [];
      const nuevosData = nuevos.map(id => {
        const c = categoriasCatalogo.find(x => x.id === id);
        return { categoriaId: id, nombre: c.nombre };
      });
      update.categorias = [...actualesData, ...nuevosData];
    }
  }

  // Audit
  update.atributosIASugeridosEn = ahora;
  update.atributosIASugeridosVersion = 'onda2-2026-05-05';

  try {
    await db.doc(`productos/${p.id}`).update(update);
    written++;
    process.stdout.write(`✅ ${p.sku} actualizado\n`);
  } catch (e) {
    errors++;
    console.error(`❌ ${p.sku}: ${e.message}`);
  }
}

console.log(`\n═══ Resultado ═══`);
console.log(`  Escritos: ${written}`);
console.log(`  Errores:  ${errors}`);
process.exit(0);
