/**
 * Onda 3 · Marketing IA masivo · 2026-05-05
 *
 * Genera descripcionMarketing (4 niveles · tagline + beneficios + descripción + keywordsSEO)
 * para los 211 productos sin marketing.
 *
 * Modos:
 *   --sample 5  → DRY-RUN · 5 productos random (3 SUP + 2 SKC), imprime resultados sin escribir
 *   --apply     → escribe en BD (rate-limit 1.2s entre llamadas)
 *   --limit N   → procesar máximo N
 *
 * Reglas defensivas:
 *   - Cero override: si producto ya tiene descripcionMarketing, skip
 *   - Solo procesa productos con datos básicos completos
 *   - Audit: fuente='ia', generadoEn=timestamp, generadoPor='onda3-script'
 *   - Filtrado de productos sin contexto suficiente (marca/nombre/línea/contenido)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const sampleArg = args.find(a => a.startsWith('--sample'));
const SAMPLE_SIZE = sampleArg ? parseInt(args[args.indexOf(sampleArg) + 1] || '5') : null;
const limitArg = args.find(a => a.startsWith('--limit'));
const LIMIT = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] || '0') : 0;

console.log(`═══ Onda 3 · Marketing IA · ${APPLY ? 'APPLY' : (SAMPLE_SIZE ? `DRY-RUN sample=${SAMPLE_SIZE}` : 'DRY-RUN')} ═══\n`);

let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  try {
    const env = readFileSync('functions/.env', 'utf-8');
    const m = env.match(/GEMINI_API_KEY=(.+)/);
    if (m) GEMINI_API_KEY = m[1].trim();
  } catch {}
}
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY no encontrado · setear en env o functions/.env');
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getLinea(p) {
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (linea.includes('skin')) return 'SKC';
  if (linea.includes('suplem') || linea.includes('vitam')) return 'SUP';
  return 'OTRA';
}

function tieneDatosMinimos(p, linea) {
  if (!p.marca?.trim() || !p.nombreComercial?.trim()) return false;
  if (linea === 'OTRA') return false;
  if (!p.contenidoNeto?.valor) return false;
  return true;
}

// ─── Cargar productos ───────────────────────────────────────────────────────
const productosSnap = await db.collection('productos').get();
const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const sinMarketing = productos.filter(p => {
  // Skip si ya tiene marketing completo
  const m = p.descripcionMarketing;
  if (m?.tagline?.texto && m?.descripcion?.texto && Array.isArray(m?.beneficios?.texto)) return false;
  const linea = getLinea(p);
  return tieneDatosMinimos(p, linea);
});

console.log(`Productos totales: ${productos.length}`);
console.log(`Sin marketing y con datos mínimos: ${sinMarketing.length}`);

// ─── Selección por modo ─────────────────────────────────────────────────────
let aProcesar = sinMarketing;
if (SAMPLE_SIZE) {
  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
  const sup = sinMarketing.filter(p => getLinea(p) === 'SUP');
  const skc = sinMarketing.filter(p => getLinea(p) === 'SKC');
  const halfSUP = Math.min(Math.ceil(SAMPLE_SIZE * 3 / 5), sup.length);
  const halfSKC = Math.min(SAMPLE_SIZE - halfSUP, skc.length);
  aProcesar = [...shuffle(sup).slice(0, halfSUP), ...shuffle(skc).slice(0, halfSKC)];
} else if (LIMIT > 0) {
  aProcesar = sinMarketing.slice(0, LIMIT);
}
console.log(`A procesar: ${aProcesar.length}\n`);

// ─── Llamada a Gemini · mismo prompt que la CF ──────────────────────────────
async function callGemini(input) {
  const prompt = buildPrompt(input);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
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

function buildPrompt(p) {
  const linea = getLinea(p);
  const esSUP = linea === 'SUP';
  const esSKC = linea === 'SKC';
  const lines = [
    `Marca: ${p.marca}`,
    `Nombre comercial: ${p.nombreComercial}`,
    `Línea: ${p.lineaNegocioNombre}`,
    `País origen: ${p.paisOrigen}`,
  ];
  if (p.contenidoNeto) lines.push(`Contenido del envase: ${p.contenidoNeto.valor} ${p.contenidoNeto.unidad}`);
  if (p.tipoProducto?.nombre) lines.push(`Tipo de producto: ${p.tipoProducto.nombre}`);

  if (esSUP) {
    const s = p.atributosSuplementos ?? {};
    if (s.dosaje) lines.push(`Dosaje/composición: ${s.dosaje}`);
    if (s.sabor) lines.push(`Sabor: ${s.sabor}`);
    if (s.momentoDia?.length) lines.push(`Momento del día: ${s.momentoDia.join(', ')}`);
    if (s.tomaConComida) lines.push(`Toma: ${s.tomaConComida}`);
    if (s.edadRecomendada) lines.push(`Edad recomendada: ${s.edadRecomendada}`);
    if (s.restricciones?.length) lines.push(`Restricciones: ${s.restricciones.join(', ')}`);
  }
  if (esSKC) {
    const s = p.atributosSkincare ?? {};
    if (s.tipoProductoSKC) lines.push(`Tipo SKC: ${s.tipoProductoSKC}`);
    if (s.ingredienteClave) lines.push(`Ingrediente clave: ${s.ingredienteClave}`);
    if (s.tipoPiel?.length) lines.push(`Tipo de piel: ${s.tipoPiel.join(', ')}`);
    if (s.preocupaciones?.length) lines.push(`Preocupaciones: ${s.preocupaciones.join(', ')}`);
    if (s.pasoRutina) lines.push(`Paso rutina: ${s.pasoRutina}`);
    if (s.textura) lines.push(`Textura: ${s.textura}`);
    if (s.zonaAplicacion?.length) lines.push(`Zona aplicación: ${s.zonaAplicacion.join(', ')}`);
  }

  return `Eres un copywriter SEO para eCommerce de bienestar peruano (Google Perú + Mercado Libre Perú). Tu copy vende honestamente Y posiciona orgánicamente.

═══ COMPLIANCE OBLIGATORIO ═══
- PROHIBIDO claims terapéuticos: "cura", "elimina enfermedad", "sana", "trata", "previene enfermedad", "remedio", "medicamento"
- PROHIBIDO comparativos absolutos sin sustento: "el mejor", "único en el mercado"
- SÍ permitido: hidrata, ilumina, suaviza, repara barrera, contribuye a, apoya, complementa
- Tono: cálido, profesional, español neutro Perú, 0 emojis
${esSUP ? `
- DISCLAIMER OBLIGATORIO: agregá al final de "descripcion" como punto y aparte:
  "Este producto no reemplaza una dieta balanceada · consulte a su médico antes de consumir."
` : ''}
═══ REGLAS SEO ORGÁNICO ═══
1. Keyword principal = problema/categoría + ingrediente clave
2. Long-tail (cómo busca el cliente): "vitamina D3 5000 UI cápsulas para huesos"
3. Densidad natural: 3-5 menciones de keyword principal entre tagline + 1 bullet + apertura/cierre descripción
4. LSI/sinónimos naturales (ej. D3 → colecalciferol, vitamina del sol, salud ósea)
5. Primer párrafo descripción: keyword principal en primeras 60 palabras
6. Tagline = meta-title SEO · 50-65 caracteres · arranca con marca/keyword
7. Beneficios = bullets escaneables · verbo de acción + beneficio + cómo

═══ DATOS DEL PRODUCTO ═══
${lines.join('\n')}

═══ OUTPUT (JSON estricto · 4 campos) ═══
- "tagline": 50-65 caracteres · arranca con marca o keyword principal
- "beneficios": array 4-5 strings · 60-100 chars c/u · verbo de acción
- "descripcion": 120-180 palabras · 2-3 párrafos · keyword principal en 1er párrafo + LSI · cierre con CTA suave${esSUP ? ' · TERMINA con disclaimer DIGEMID' : ''}
- "keywordsSEO": array 5-10 long-tail (3-7 palabras) · variadas (informacional, comercial, comparativo)

Usa SOLO los datos provistos. No inventes ingredientes. Solo JSON, sin markdown.`;
}

// ─── Procesar ───────────────────────────────────────────────────────────────
const resultados = [];
let i = 0;
for (const p of aProcesar) {
  i++;
  const linea = getLinea(p);
  process.stdout.write(`[${i}/${aProcesar.length}] ${p.sku} · ${(p.nombreComercial || '').substring(0, 40)}... `);
  try {
    const out = await callGemini(p);
    resultados.push({ producto: p, linea, marketing: out });
    process.stdout.write(`OK\n`);
  } catch (e) {
    process.stdout.write(`ERROR · ${(e.message || '').substring(0, 60)}\n`);
    resultados.push({ producto: p, linea, error: e.message });
  }
  if (i < aProcesar.length) await new Promise(r => setTimeout(r, 1200));
}

// ─── Mostrar muestras ───────────────────────────────────────────────────────
console.log(`\n═══ MUESTRAS ═══`);
for (const r of resultados.slice(0, 3)) {
  if (r.error) continue;
  const m = r.marketing;
  console.log(`\n──── ${r.producto.sku} · ${r.producto.marca} · ${r.producto.nombreComercial} (${r.linea}) ────`);
  console.log(`TAGLINE (${(m.tagline || '').length} chars):`);
  console.log(`  ${m.tagline}`);
  console.log(`BENEFICIOS (${(m.beneficios || []).length}):`);
  (m.beneficios || []).forEach(b => console.log(`  • ${b}`));
  console.log(`DESCRIPCIÓN (~${(m.descripcion || '').split(/\s+/).length} palabras):`);
  console.log((m.descripcion || '').split('\n').map(l => '  ' + l).join('\n'));
  console.log(`KEYWORDS SEO (${(m.keywordsSEO || []).length}):`);
  console.log(`  ${(m.keywordsSEO || []).join(' · ')}`);
}

// ─── APPLY ──────────────────────────────────────────────────────────────────
if (!APPLY) {
  console.log(`\n💡 DRY-RUN · NO se escribió nada en BD.\n`);
  process.exit(0);
}

console.log(`\n🚨 APPLY · escribiendo en BD...\n`);
const userId = 'onda3-script';
let written = 0, errors = 0;

for (const r of resultados) {
  if (r.error) { errors++; continue; }
  const p = r.producto;
  const m = r.marketing;
  if (!m.tagline || !Array.isArray(m.beneficios) || !m.descripcion) {
    console.error(`❌ ${p.sku}: respuesta IA incompleta · skip`);
    errors++;
    continue;
  }
  // Skip si en el ínterin ya tiene marketing (defensivo)
  const fresh = await db.doc(`productos/${p.id}`).get();
  if (fresh.data()?.descripcionMarketing?.tagline?.texto) {
    console.log(`⏭ ${p.sku}: ya tiene marketing · skip override`);
    continue;
  }

  const ahora = Timestamp.now();
  const audit = (texto) => ({ texto, fuente: 'ia', generadoEn: ahora, generadoPor: userId });
  const descripcionMarketing = {
    tagline: audit(m.tagline),
    beneficios: audit(m.beneficios),
    descripcion: audit(m.descripcion),
  };
  if (Array.isArray(m.keywordsSEO) && m.keywordsSEO.length > 0) {
    descripcionMarketing.keywordsSEO = audit(m.keywordsSEO);
  }

  try {
    await db.doc(`productos/${p.id}`).update({
      descripcionMarketing,
      ultimaEdicion: FieldValue.serverTimestamp(),
    });
    process.stdout.write(`✅ ${p.sku} guardado\n`);
    written++;
  } catch (e) {
    console.error(`❌ ${p.sku}: ${e.message}`);
    errors++;
  }
}

console.log(`\n═══ Resultado ═══`);
console.log(`  Escritos: ${written}`);
console.log(`  Errores:  ${errors}`);
process.exit(0);
