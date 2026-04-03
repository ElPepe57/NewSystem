/**
 * Inferir lineaNegocioIds para maestros (marcas, proveedores) desde productos
 *
 * Recorre productos, detecta qué línea de negocio tienen, y asigna
 * esas líneas a las marcas y proveedores vinculados.
 *
 * Uso: node scripts/inferir-lineas-maestros.mjs [--dry-run]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function main() {
  console.log('=== Inferencia de Líneas de Negocio para Maestros ===\n');
  if (DRY_RUN) console.log('🔍 MODO DRY-RUN\n');

  const [prodSnap, marcasSnap, provSnap] = await Promise.all([
    db.collection('productos').get(),
    db.collection('marcas').get(),
    db.collection('proveedores').get(),
  ]);

  // Build: marcaId → Set of lineaNegocioIds from products
  const marcaLineas = new Map();
  const provLineas = new Map();

  prodSnap.docs.forEach(d => {
    const p = d.data();
    const lineaId = p.lineaNegocioId;
    if (!lineaId) return;

    // Marca
    if (p.marcaId) {
      if (!marcaLineas.has(p.marcaId)) marcaLineas.set(p.marcaId, new Set());
      marcaLineas.get(p.marcaId).add(lineaId);
    }

    // Proveedores from investigacion
    const provs = p.investigacion?.proveedoresUSA || [];
    provs.forEach(prov => {
      if (prov.proveedorId) {
        if (!provLineas.has(prov.proveedorId)) provLineas.set(prov.proveedorId, new Set());
        provLineas.get(prov.proveedorId).add(lineaId);
      }
    });
  });

  // Update marcas
  let batch = db.batch();
  let batchCount = 0;
  let marcasUpdated = 0;

  console.log('--- MARCAS ---');
  for (const docSnap of marcasSnap.docs) {
    const marca = docSnap.data();
    const inferidas = marcaLineas.get(docSnap.id);
    if (!inferidas) continue;

    const lineasActuales = new Set(marca.lineaNegocioIds || []);
    const lineasNuevas = [...inferidas].filter(id => !lineasActuales.has(id));

    if (lineasNuevas.length > 0) {
      const merged = [...new Set([...lineasActuales, ...inferidas])];
      console.log(`  ${marca.nombre}: ${[...lineasActuales].join(',') || '(vacío)'} → ${merged.join(',')}`);
      if (!DRY_RUN) {
        batch.update(docSnap.ref, { lineaNegocioIds: merged });
        batchCount++;
        if (batchCount >= 450) { await batch.commit(); batch = db.batch(); batchCount = 0; }
      }
      marcasUpdated++;
    }
  }

  // Update proveedores
  let provsUpdated = 0;
  console.log('\n--- PROVEEDORES ---');
  for (const docSnap of provSnap.docs) {
    const prov = docSnap.data();
    const inferidas = provLineas.get(docSnap.id);
    if (!inferidas) continue;

    const lineasActuales = new Set(prov.lineaNegocioIds || []);
    const lineasNuevas = [...inferidas].filter(id => !lineasActuales.has(id));

    if (lineasNuevas.length > 0) {
      const merged = [...new Set([...lineasActuales, ...inferidas])];
      const nombre = prov.nombre || prov.nombreEmpresa;
      console.log(`  ${nombre}: ${[...lineasActuales].join(',') || '(vacío)'} → ${merged.join(',')}`);
      if (!DRY_RUN) {
        batch.update(docSnap.ref, { lineaNegocioIds: merged });
        batchCount++;
        if (batchCount >= 450) { await batch.commit(); batch = db.batch(); batchCount = 0; }
      }
      provsUpdated++;
    }
  }

  if (!DRY_RUN && batchCount > 0) await batch.commit();

  console.log(`\n✅ Marcas actualizadas: ${marcasUpdated}`);
  console.log(`✅ Proveedores actualizados: ${provsUpdated}`);
  if (DRY_RUN) console.log('\n🔍 DRY-RUN. Ejecuta sin --dry-run para aplicar.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
