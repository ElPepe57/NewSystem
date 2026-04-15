import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

console.log('\n=== COLECCIÓN: almacenes (legacy) ===\n');
const almSnap = await db.collection('almacenes').get();
console.log(`Total: ${almSnap.size}\n`);
almSnap.forEach(d => {
  const a = d.data();
  console.log(`  ${d.id}`);
  console.log(`    nombre=${a.nombre || '-'}  tipo=${a.tipo || '-'}  pais=${a.pais || '-'}  estado=${a.estado || '-'}`);
  console.log(`    codigo=${a.codigo || '-'}  unidades=${a.unidadesActuales ?? a.totalUnidades ?? '-'}`);
});

console.log('\n=== COLECCIÓN: casillas (activa) ===\n');
const casSnap = await db.collection('casillas').get();
console.log(`Total: ${casSnap.size}\n`);
casSnap.forEach(d => {
  const c = d.data();
  console.log(`  ${d.id}`);
  console.log(`    nombre=${c.nombre || '-'}  tipo=${c.tipo || '-'}  pais=${c.pais || '-'}  estado=${c.estado || '-'}`);
  console.log(`    codigo=${c.codigo || '-'}  colaboradorId=${c.colaboradorId || '-'}  principal=${c.esPrincipal}`);
});

// Detectar pares: almacen con mismo nombre o código que una casilla
console.log('\n=== POSIBLES DUPLICADOS (mismo nombre o código) ===\n');
const casillasList = [];
casSnap.forEach(d => casillasList.push({ id: d.id, ...d.data() }));
almSnap.forEach(d => {
  const a = d.data();
  const matchNombre = casillasList.find(c => c.nombre && a.nombre && c.nombre.trim().toLowerCase() === a.nombre.trim().toLowerCase());
  const matchCodigo = casillasList.find(c => c.codigo && a.codigo && c.codigo === a.codigo);
  if (matchNombre || matchCodigo) {
    console.log(`  ⚠ almacenes/${d.id} (${a.nombre || a.codigo}) ≈ casillas/${(matchNombre || matchCodigo).id} (${(matchNombre || matchCodigo).nombre || (matchNombre || matchCodigo).codigo})`);
  } else {
    console.log(`  ✓ almacenes/${d.id} (${a.nombre || a.codigo || '-'}) sin equivalente en casillas`);
  }
});

// Buscar quién todavía escribe/lee de almacenes en runtime: colaboradores con almacenId?
console.log('\n=== Colaboradores que referencian almacenId ===\n');
const colSnap = await db.collection('colaboradores').get();
let colsConAlmacen = 0;
colSnap.forEach(d => {
  const c = d.data();
  if (c.almacenId) {
    colsConAlmacen++;
    console.log(`  colaboradores/${d.id} (${c.nombre}) → almacenId=${c.almacenId}`);
  }
});
if (colsConAlmacen === 0) console.log('  (ninguno)');

process.exit(0);
