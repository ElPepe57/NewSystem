/**
 * READ-ONLY · Cuenta órdenes de compra y unidades en el Firestore vivo.
 * NO escribe ni borra nada. Uso: node scripts/check-oc-data.mjs
 * Requiere Application Default Credentials (igual que backup-firestore-full.mjs).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const LEGACY = ['impuestoCompraUSD', 'costoEnvioProveedorUSD', 'otrosGastosCompraUSD', 'descuentoUSD'];
const V2 = ['cargosOC', 'descuentosOC', 'impuestosOC'];

async function main() {
  console.log('\n=== ÓRDENES DE COMPRA (read-only) ===');
  const ocSnap = await db.collection('ordenesCompra').get();
  console.log(`ordenesCompra: ${ocSnap.size} docs`);
  if (ocSnap.size > 0) {
    const porEstado = {};
    let conLegacy = 0, conV2 = 0, conSub = 0;
    for (const d of ocSnap.docs) {
      const o = d.data();
      const est = o.estado || '(sin estado)';
      porEstado[est] = (porEstado[est] || 0) + 1;
      if (LEGACY.some((f) => (o[f] || 0) > 0)) conLegacy++;
      if (V2.some((f) => Array.isArray(o[f]) && o[f].length > 0)) conV2++;
      if (Array.isArray(o.subOrdenes) && o.subOrdenes.length > 0) conSub++;
    }
    console.log('  por estado:', JSON.stringify(porEstado));
    console.log(`  con costo legacy de cabecera (impuesto/envio/otros/descuento): ${conLegacy}`);
    console.log(`  con arrays v2 (cargosOC/descuentosOC/impuestosOC): ${conV2}`);
    console.log(`  con sub-órdenes: ${conSub}`);
    console.log('  IDs:', ocSnap.docs.map((d) => d.id).join(', '));
  }

  console.log('\n=== UNIDADES (read-only) ===');
  const uSnap = await db.collection('unidades').get();
  let conOC = 0, conComp = 0, conEscalar = 0;
  for (const d of uSnap.docs) {
    const u = d.data();
    if (u.ordenCompraId) conOC++;
    if (Array.isArray(u.componentesCosto) && u.componentesCosto.length > 0) conComp++;
    if ((u.ctruInicial || u.ctruContable || u.costosLandedPEN || 0) > 0) conEscalar++;
  }
  console.log(`unidades: ${uSnap.size} docs · con ordenCompraId: ${conOC} · con componentesCosto: ${conComp} · con costo escalar congelado: ${conEscalar}`);

  console.log('\n=== CONTEXTO (conteo) ===');
  for (const c of ['productos', 'ventas', 'envios', 'entregas', 'requerimientos', 'cotizaciones', 'movimientosCC']) {
    try {
      const s = await db.collection(c).count().get();
      console.log(`  ${c}: ${s.data().count}`);
    } catch (e) {
      console.log(`  ${c}: (error/no existe) ${e.message}`);
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
