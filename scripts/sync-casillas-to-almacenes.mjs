/**
 * Temporal: espeja casillas → almacenes para que el código legacy siga funcionando
 * mientras se ejecuta la migración proper en otra sesión.
 *
 * Mapeo de campos:
 *   casilla.tipo='casilla_viajero'   → almacen.tipo='viajero', esViajero=true
 *   casilla.tipo='almacen_propio'    → almacen.tipo='almacen_peru'/'almacen_origen', esViajero=false
 *   casilla.tipo='punto_courier'     → almacen.tipo='courier', esViajero=false
 *   casilla.estado='activa'          → almacen.estadoAlmacen='activo'
 *   casilla.estado='inactiva'        → almacen.estadoAlmacen='inactivo'
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const casSnap = await db.collection('casillas').get();
console.log(`Casillas a espejar: ${casSnap.size}\n`);

const batch = db.batch();
let count = 0;
for (const cdoc of casSnap.docs) {
  const c = cdoc.data();
  const esViajero = c.tipo === 'casilla_viajero';
  let tipoAlmacen;
  if (c.tipo === 'casilla_viajero') tipoAlmacen = 'viajero';
  else if (c.tipo === 'punto_courier') tipoAlmacen = 'courier';
  else if (c.pais === 'Peru') tipoAlmacen = 'almacen_peru';
  else tipoAlmacen = 'almacen_origen';

  const almacenData = {
    codigo: c.codigo,
    nombre: c.nombre,
    tipo: tipoAlmacen,
    pais: c.pais,
    esViajero,
    estadoAlmacen: c.estado === 'activa' ? 'activo' : 'inactivo',
    direccion: c.direccion || '',
    unidadesActuales: c.unidadesActuales || 0,
    valorInventarioUSD: c.valorInventarioUSD || 0,
    capacidadUnidades: c.capacidadUnidades || null,
    ciudad: c.ciudad || '',
    // Preservar id de casilla para fallback en lectores que usan casillaActualId||almacenId
    casillaOrigenId: cdoc.id,
    _syncedFromCasilla: true,
    fechaCreacion: c.fechaCreacion || new Date(),
  };
  // Usar mismo ID que la casilla para simplificar referencias
  const ref = db.collection('almacenes').doc(cdoc.id);
  batch.set(ref, almacenData, { merge: true });
  count++;
  console.log(`  ✓ ${c.codigo} ${c.nombre.padEnd(30)} → ${tipoAlmacen} ${esViajero ? '(viajero)' : ''}`);
}

await batch.commit();
console.log(`\n✅ ${count} almacenes restaurados desde casillas.`);

// Resync contador ALM al max
const almSnap = await db.collection('almacenes').get();
let maxAlm = 0;
almSnap.forEach(d => {
  const codigo = d.data().codigo || '';
  const m = codigo.match(/(\d+)$/);
  if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > maxAlm) maxAlm = n; }
});
if (maxAlm > 0) {
  await db.collection('contadores').doc('ALM').set({ current: maxAlm, updatedAt: new Date() }, { merge: true });
  console.log(`🔄 Contador ALM reseteado a ${maxAlm}`);
}
process.exit(0);
