/**
 * Verificar los PAGOS reales de gastos (comisión + envío)
 * de las ventas con adelanto de cotización.
 * Solo nos importa lo que sale de MercadoPago.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Get all cuentas for name resolution
const cuentasSnap = await db.collection('cuentasCaja').get();
const cuentasMap = {};
for (const c of cuentasSnap.docs) {
  cuentasMap[c.id] = c.data().nombre || c.data().banco || c.id;
}

const ventaNums = [
  'VT-2026-016', 'VT-2026-017', 'VT-2026-018', 'VT-2026-019',
  'VT-2026-021', 'VT-2026-023', 'VT-2026-024', 'VT-2026-025',
  'VT-2026-028', 'VT-2026-029', 'VT-2026-030', 'VT-2026-048',
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('PAGOS REALES DE GASTOS ML (ADELANTOS CON ML ORDER)');
console.log('Solo nos importa lo que sale de MercadoPago');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalDesdeMP = 0;
let totalDesdeBanco = 0;
let totalSinPago = 0;
const detalleMP = [];

for (const num of ventaNums) {
  const vq = await db.collection('ventas').where('numeroVenta', '==', num).limit(1).get();
  if (vq.empty) continue;
  const v = vq.docs[0];
  const vd = v.data();
  const metodoEnvio = vd.metodoEnvio || 'N/A';

  // Get sync data
  const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', v.id).get();
  let syncData = null;
  for (const s of syncQ.docs) { syncData = s.data(); }
  if (!syncData && vd.mercadoLibreId) {
    const syncById = await db.collection('mlOrderSync').doc(`ml-${vd.mercadoLibreId}`).get();
    if (syncById.exists) syncData = syncById.data();
  }

  console.log(`━━━ ${num} (${metodoEnvio}) ━━━`);

  // Get ALL gastos for this venta
  const gastosQ = await db.collection('gastos').where('ventaId', '==', v.id).get();

  for (const g of gastosQ.docs) {
    const gd = g.data();
    if (gd.estado === 'anulado') continue;

    const tipo = gd.tipo || gd.categoria || 'otro';
    const pagos = gd.pagos || [];

    console.log(`  ${gd.numeroGasto} | ${tipo} | S/${(gd.montoPEN || 0).toFixed(2)} | estado: ${gd.estado}`);

    if (Array.isArray(pagos) && pagos.length > 0) {
      for (const p of pagos) {
        const cuentaOrig = p.cuentaOrigenId || 'N/A';
        const cuentaNombre = cuentasMap[cuentaOrig] || cuentaOrig;
        const esMP = cuentaOrig === mpId;
        const monto = p.montoPEN || p.montoOriginal || p.monto || 0;
        const pFecha = p.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?';

        console.log(`    💰 Pago: S/${monto} | desde: ${cuentaNombre} | ${pFecha} | ${esMP ? '🔴 MERCADOPAGO' : '🟢 Banco/Otro'}`);

        if (esMP) {
          totalDesdeMP += monto;
          detalleMP.push({ venta: num, gasto: gd.numeroGasto, tipo, monto, metodoEnvio });
        } else {
          totalDesdeBanco += monto;
        }
      }
    } else {
      console.log(`    ❌ SIN PAGOS REGISTRADOS`);
      totalSinPago += gd.montoPEN || 0;
    }

    // Check if there's a tesorería movement for this gasto
    const movQ = await db.collection('movimientosTesoreria')
      .where('gastoId', '==', g.id)
      .get();

    let movMP = false;
    for (const m of movQ.docs) {
      const md = m.data();
      if (md.estado !== 'anulado' && md.cuentaOrigen === mpId) {
        movMP = true;
        console.log(`    📄 Mov tesorería: ${md.numeroMovimiento} | S/${md.monto} | desde MP ✓`);
      }
    }
    if (!movMP && pagos.length > 0) {
      // Check by gastoNumero
      const movQ2 = await db.collection('movimientosTesoreria')
        .where('gastoNumero', '==', gd.numeroGasto)
        .get();
      for (const m of movQ2.docs) {
        const md = m.data();
        if (md.estado !== 'anulado' && md.cuentaOrigen === mpId) {
          movMP = true;
          console.log(`    📄 Mov tesorería (by num): ${md.numeroMovimiento} | S/${md.monto} | desde MP ✓`);
        }
      }
    }
    if (!movMP) {
      const pagosMP = (Array.isArray(pagos) ? pagos : []).filter(p => p.cuentaOrigenId === mpId);
      if (pagosMP.length > 0) {
        console.log(`    ⚠ PAGO DESDE MP PERO SIN MOV TESORERÍA`);
      }
    }
  }
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('RESUMEN');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Pagos de gastos DESDE MercadoPago:  S/ ${totalDesdeMP.toFixed(2)}`);
console.log(`Pagos de gastos DESDE Banco/Otro:   S/ ${totalDesdeBanco.toFixed(2)}`);
console.log(`Gastos SIN pago registrado:         S/ ${totalSinPago.toFixed(2)}`);
console.log(`\nResidual a explicar:                S/ 98.74`);

if (detalleMP.length > 0) {
  console.log(`\n── Detalle pagos desde MercadoPago ──`);
  for (const d of detalleMP) {
    console.log(`  ${d.venta} | ${d.gasto} | ${d.tipo} | S/${d.monto} | ${d.metodoEnvio}`);
  }
  console.log(`\n¿Estos pagos tienen movimiento en tesorería descontando de MP?`);
  console.log(`Si NO lo tienen → son la causa del residual S/ 98.74`);
}
