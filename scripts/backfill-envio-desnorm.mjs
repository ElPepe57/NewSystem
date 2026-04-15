/**
 * Backfill: rellena origenProveedorNombre/Pais, colaboradorNombre, destinoCasillaPais
 * en envíos existentes (S38-014 desnormalización completa).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const apply = process.argv.includes('--apply');

const snap = await db.collection('envios').get();
const fixes = [];

for (const d of snap.docs) {
  const e = d.data();
  const updates = {};

  // Origen proveedor
  if (e.origenTipo === 'proveedor' && e.origenProveedorId && !e.origenProveedorNombre) {
    const p = await db.collection('proveedores').doc(e.origenProveedorId).get();
    if (p.exists) {
      const pd = p.data();
      updates.origenProveedorNombre = pd.nombre;
      if (pd.pais) updates.origenProveedorPais = pd.pais;
    }
  }
  // Origen casilla
  if (e.origenTipo === 'casilla' && e.origenCasillaId && !e.origenCasillaNombre) {
    const c = await db.collection('casillas').doc(e.origenCasillaId).get();
    if (c.exists) updates.origenCasillaNombre = c.data().nombre;
  }
  // Colaborador (courier)
  if (e.colaboradorId && !e.colaboradorNombre) {
    const col = await db.collection('colaboradores').doc(e.colaboradorId).get();
    if (col.exists) updates.colaboradorNombre = col.data().nombre;
  }
  // Destino casilla pais
  if (e.destinoCasillaId && !e.destinoCasillaPais) {
    const dc = await db.collection('casillas').doc(e.destinoCasillaId).get();
    if (dc.exists && dc.data().pais) updates.destinoCasillaPais = dc.data().pais;
  }

  if (Object.keys(updates).length > 0) {
    fixes.push({ id: d.id, num: e.numeroEnvio, updates });
    console.log(`  ${e.numeroEnvio}: ${JSON.stringify(updates)}`);
  }
}

if (fixes.length === 0) { console.log('Nada que backfillear'); process.exit(0); }
if (!apply) { console.log('\n🔍 DRY RUN — agrega --apply'); process.exit(0); }

const batch = db.batch();
fixes.forEach(f => batch.update(db.collection('envios').doc(f.id), f.updates));
await batch.commit();
console.log(`✅ ${fixes.length} envios backfilled`);
process.exit(0);
