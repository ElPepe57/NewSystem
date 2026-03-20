/**
 * Verificar si los delivery egresos de MP ya cubren el cargo_envio_ml
 * para las ventas Urbano que están en Fix 3
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Fix 3 targets: procesada Urbano orders missing cargo_envio_ml gasto
const fix3Ventas = [
  'VT-2026-054', 'VT-2026-057', 'VT-2026-061', 'VT-2026-066',
  'VT-2026-067', 'VT-2026-068', 'VT-2026-073', 'VT-2026-075',
  'VT-2026-077', 'VT-2026-056',
];

// Also check pendiente Urbano
const pendienteUrbano = ['VT-2026-016', 'VT-2026-017', 'VT-2026-021', 'VT-2026-025'];

console.log('═══════════════════════════════════════════════════════════════');
console.log('DELIVERY vs CARGO_ENVIO - ¿Doble conteo?');
console.log('═══════════════════════════════════════════════════════════════\n');

const allVentas = [...fix3Ventas, ...pendienteUrbano];
let totalDeliveryDesdeMP = 0;
let totalCargoEnvioML = 0;
let totalDobleConteo = 0;
let ventasSinDeliveryMP = [];
let ventasConDeliveryMP = [];

for (const num of allVentas) {
  const vq = await db.collection('ventas').where('numeroVenta', '==', num).limit(1).get();
  if (vq.empty) continue;
  const v = vq.docs[0];
  const vd = v.data();

  // Get sync
  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  let cargoEnvioML = 0;
  for (const s of syncQ.docs) {
    cargoEnvioML = Math.max(cargoEnvioML, s.data().cargoEnvioML || 0);
  }
  if (cargoEnvioML === 0 && vd.mercadoLibreId) {
    const syncById = await db.collection('mlOrderSync').doc(`ml-${vd.mercadoLibreId}`).get();
    if (syncById.exists) cargoEnvioML = syncById.data().cargoEnvioML || 0;
  }
  totalCargoEnvioML += cargoEnvioML;

  // Get entregas for this venta
  const entregaQ = await db.collection('entregas').where('ventaId', '==', v.id).get();

  let deliveryFromMP = 0;
  let deliveryGastoNum = '';
  let deliveryMovNum = '';

  for (const e of entregaQ.docs) {
    const ed = e.data();
    if (ed.gastoEnvioId) {
      const gastoDoc = await db.collection('gastos').doc(ed.gastoEnvioId).get();
      if (gastoDoc.exists) {
        const gd = gastoDoc.data();
        if (gd.estado === 'anulado') continue;
        const pagos = gd.pagos || [];
        if (Array.isArray(pagos)) {
          for (const p of pagos) {
            if (p.cuentaOrigenId === mpId) {
              deliveryFromMP += p.montoPEN || p.montoOriginal || gd.montoPEN || 0;
              deliveryGastoNum = gd.numeroGasto;
            }
          }
        }
        // Also check movements
        const movQ = await db.collection('movimientosTesoreria').where('gastoId', '==', gastoDoc.id).get();
        for (const m of movQ.docs) {
          const md = m.data();
          if (md.estado !== 'anulado' && md.cuentaOrigen === mpId) {
            deliveryMovNum = md.numeroMovimiento;
          }
        }
        if (!deliveryMovNum) {
          const movQ2 = await db.collection('movimientosTesoreria').where('gastoNumero', '==', gd.numeroGasto).get();
          for (const m of movQ2.docs) {
            const md = m.data();
            if (md.estado !== 'anulado' && md.cuentaOrigen === mpId) {
              deliveryFromMP = md.monto;
              deliveryMovNum = md.numeroMovimiento;
            }
          }
        }
      }
    }
  }

  totalDeliveryDesdeMP += deliveryFromMP;
  const isPendiente = pendienteUrbano.includes(num);
  const isInFix3 = fix3Ventas.includes(num);

  const tieneDelivery = deliveryFromMP > 0;
  const esDoble = tieneDelivery && cargoEnvioML > 0;

  if (esDoble) {
    totalDobleConteo += cargoEnvioML; // This amount would be double-counted if Fix 3 adds cargo_envio
    ventasConDeliveryMP.push({ num, deliveryFromMP, cargoEnvioML, deliveryGastoNum, deliveryMovNum, isPendiente });
  } else if (cargoEnvioML > 0) {
    ventasSinDeliveryMP.push({ num, cargoEnvioML, isPendiente });
  }

  const flag = esDoble ? '⚠ DOBLE CONTEO si Fix 3' : (tieneDelivery ? '✓ Solo delivery' : (cargoEnvioML > 0 ? '➡ Necesita cargo_envio' : '✓ OK'));
  console.log(`${num} ${isPendiente ? '(pendiente)' : '(procesada)'} | cargoEnvioML: S/${cargoEnvioML} | delivery MP: S/${deliveryFromMP} | ${deliveryGastoNum} ${deliveryMovNum} | ${flag}`);
}

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`IMPACTO EN RECONCILIACIÓN`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

console.log(`Total cargoEnvioML (sync):          S/ ${totalCargoEnvioML.toFixed(2)}`);
console.log(`Total delivery desde MP:            S/ ${totalDeliveryDesdeMP.toFixed(2)}`);
console.log(`Doble conteo si Fix 3 se aplica:    S/ ${totalDobleConteo.toFixed(2)}`);

console.log(`\nVentas CON delivery MP (Fix 3 sería doble):`);
for (const v of ventasConDeliveryMP) {
  console.log(`  ${v.num} | delivery: S/${v.deliveryFromMP} | cargo: S/${v.cargoEnvioML} | ${v.deliveryGastoNum} ${v.deliveryMovNum}`);
}

console.log(`\nVentas SIN delivery MP (Fix 3 es correcto):`);
for (const v of ventasSinDeliveryMP) {
  console.log(`  ${v.num} | cargo: S/${v.cargoEnvioML}`);
}

// Recalculate residual without double-counting
console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`RECÁLCULO SIN DOBLE CONTEO`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

const saldoActual = 2137.65;
const fix1 = 65.10;
const fix2 = 55.21;
const fix3Original = 70.50;
const fix3Corregido = fix3Original - totalDobleConteo;
const fix4 = 31.95;

console.log(`Fix 1 (ajuste Flex):              -S/ ${fix1.toFixed(2)}`);
console.log(`Fix 2 (ingresos inflados):        -S/ ${fix2.toFixed(2)}`);
console.log(`Fix 3 ORIGINAL (cargo_envio):     -S/ ${fix3Original.toFixed(2)}`);
console.log(`Fix 3 CORREGIDO (sin doble):      -S/ ${fix3Corregido.toFixed(2)}`);
console.log(`Fix 4 (comisión VT-062):          -S/ ${fix4.toFixed(2)}`);

const totalFixCorregido = fix1 + fix2 + fix3Corregido + fix4;
const postFixCorregido = saldoActual - totalFixCorregido;
const residualCorregido = postFixCorregido - 1816.15;

console.log(`\nTotal fix corregido:              -S/ ${totalFixCorregido.toFixed(2)}`);
console.log(`Saldo post-fix corregido:          S/ ${postFixCorregido.toFixed(2)}`);
console.log(`Saldo real:                        S/ ${1816.15.toFixed(2)}`);
console.log(`Residual corregido:                S/ ${residualCorregido.toFixed(2)}`);
