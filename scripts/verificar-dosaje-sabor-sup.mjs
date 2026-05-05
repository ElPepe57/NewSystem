/**
 * Verificación rápida · 2026-05-04
 * READ-ONLY · sin escritura
 *
 * Revisa si los productos SUP tienen dosaje y sabor en:
 *   - p.dosaje (top-level legacy)
 *   - p.atributosSuplementos.dosaje (nuevo S3.2)
 *   - p.sabor (top-level legacy)
 *   - p.atributosSuplementos.sabor (nuevo S3.2)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('productos').get();
let supTotal = 0;
const stats = {
  dosajeTopLevel: 0,
  dosajeAtributos: 0,
  dosajeAmbos: 0,
  dosajeNinguno: 0,
  saborTopLevel: 0,
  saborAtributos: 0,
  saborAmbos: 0,
  saborNinguno: 0,
};
const ejemplosSinDosaje = [];

for (const d of snap.docs) {
  const p = d.data();
  const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
  if (!linea.includes('suplem') && !linea.includes('vitam')) continue;
  supTotal++;

  const dTop = !!(p.dosaje && p.dosaje.trim?.());
  const dAttr = !!(p.atributosSuplementos?.dosaje && p.atributosSuplementos.dosaje.trim?.());
  if (dTop && dAttr) stats.dosajeAmbos++;
  else if (dTop) stats.dosajeTopLevel++;
  else if (dAttr) stats.dosajeAtributos++;
  else {
    stats.dosajeNinguno++;
    if (ejemplosSinDosaje.length < 5) ejemplosSinDosaje.push(`${p.sku} · ${p.marca} · ${p.nombreComercial}`);
  }

  const sTop = !!(p.sabor && p.sabor.trim?.());
  const sAttr = !!(p.atributosSuplementos?.sabor && p.atributosSuplementos.sabor.trim?.());
  if (sTop && sAttr) stats.saborAmbos++;
  else if (sTop) stats.saborTopLevel++;
  else if (sAttr) stats.saborAtributos++;
  else stats.saborNinguno++;
}

console.log(`Total productos SUP: ${supTotal}\n`);
console.log(`═══ DOSAJE ═══`);
console.log(`  Top-level legacy (p.dosaje):    ${stats.dosajeTopLevel}`);
console.log(`  Nuevo (atributos.dosaje):       ${stats.dosajeAtributos}`);
console.log(`  Ambos campos:                   ${stats.dosajeAmbos}`);
console.log(`  NINGUNO:                        ${stats.dosajeNinguno}`);
console.log(`  Total con dosaje:               ${supTotal - stats.dosajeNinguno} (${Math.round((supTotal - stats.dosajeNinguno) / supTotal * 100)}%)`);
if (ejemplosSinDosaje.length > 0) {
  console.log(`  Ejemplos sin dosaje:`);
  ejemplosSinDosaje.forEach(e => console.log(`    - ${e}`));
}

console.log(`\n═══ SABOR ═══`);
console.log(`  Top-level legacy (p.sabor):     ${stats.saborTopLevel}`);
console.log(`  Nuevo (atributos.sabor):        ${stats.saborAtributos}`);
console.log(`  Ambos campos:                   ${stats.saborAmbos}`);
console.log(`  NINGUNO:                        ${stats.saborNinguno}`);
console.log(`  Total con sabor:                ${supTotal - stats.saborNinguno} (${Math.round((supTotal - stats.saborNinguno) / supTotal * 100)}%)`);

process.exit(0);
