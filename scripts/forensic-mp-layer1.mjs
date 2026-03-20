/**
 * FORENSIC AUDIT - LAYER 1: Every single SOL that enters MercadoPago
 * Traces ALL ingresos to the MP account and validates each one.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const MP_ACCOUNT_ID = 'geEs98tz955mVjYNct8M';

// Helper: convert Firestore timestamp to readable date
function fmtDate(ts) {
  if (!ts) return 'N/A';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function fmtMonto(n) {
  return typeof n === 'number' ? `S/ ${n.toFixed(2)}` : 'N/A';
}

// ── 1. Get ALL ingreso movements to MP ──────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  FORENSIC AUDIT — LAYER 1: Every SOL entering MercadoPago');
console.log('═══════════════════════════════════════════════════════════════\n');

const movSnap = await db.collection('movimientosTesoreria')
  .where('cuentaDestino', '==', MP_ACCOUNT_ID)
  .get();

// Filter out anulados and sort by fecha
let movements = [];
movSnap.forEach(doc => {
  const d = doc.data();
  if (d.estado !== 'anulado') {
    movements.push({ id: doc.id, ...d });
  }
});

movements.sort((a, b) => {
  const da = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
  const db2 = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
  return da - db2;
});

console.log(`Total non-anulado ingreso movements to MP: ${movements.length}\n`);

// ── 2. Process each movement ────────────────────────────────────────
const results = {
  matching: [],
  discrepancy: [],
  orphan: [],
  unlinked: [],
  errors: [],
};

for (let i = 0; i < movements.length; i++) {
  const mov = movements[i];
  const num = mov.numeroMovimiento || mov.id;
  const fecha = fmtDate(mov.fecha);
  const monto = mov.monto || 0;
  const tipo = mov.tipo || '?';
  const concepto = mov.concepto || '';
  const ventaId = mov.ventaId || null;
  const cotizacionId = mov.cotizacionId || null;
  const gastoId = mov.gastoId || null;

  console.log(`──── [${i + 1}/${movements.length}] ${num} ────`);
  console.log(`  Fecha: ${fecha}  |  Monto: ${fmtMonto(monto)}  |  Tipo: ${tipo}`);
  console.log(`  Concepto: ${concepto}`);
  console.log(`  VentaId: ${ventaId || '-'}  |  CotizacionId: ${cotizacionId || '-'}  |  GastoId: ${gastoId || '-'}`);

  // ── CASE A: Has ventaId ──
  if (ventaId) {
    try {
      const ventaDoc = await db.collection('ventas').doc(ventaId).get();
      if (!ventaDoc.exists) {
        console.log(`  ⚠ VENTA NOT FOUND: ${ventaId}`);
        results.discrepancy.push({ num, monto, expected: 0, diff: monto, reason: 'venta_not_found' });
        continue;
      }
      const venta = ventaDoc.data();
      console.log(`  Venta: ${venta.numeroVenta || ventaId}  |  Total: ${fmtMonto(venta.totalPEN)}  |  EstadoPago: ${venta.estadoPago}  |  MontoPagado: ${fmtMonto(venta.montoPagado)}`);

      // Check pagos array for mixed payment methods
      const pagos = venta.pagos || [];
      const pagosMPInVenta = pagos.filter(p => p.metodoPago === 'mercado_pago');
      const pagosOtros = pagos.filter(p => p.metodoPago !== 'mercado_pago');
      const totalMPPagos = pagosMPInVenta.reduce((s, p) => s + (p.monto || 0), 0);

      if (pagos.length > 0) {
        console.log(`  Pagos array: ${pagos.length} total (${pagosMPInVenta.length} MP = ${fmtMonto(totalMPPagos)}, ${pagosOtros.length} otros)`);
        if (pagosOtros.length > 0) {
          console.log(`  ⚡ MIXED PAYMENT: venta has non-MP payments too: ${pagosOtros.map(p => `${p.metodoPago}=${fmtMonto(p.monto)}`).join(', ')}`);
        }
      }

      // Look up mlOrderSync
      let mlSync = null;
      // Try by ventaId
      const mlSyncByVenta = await db.collection('mlOrderSync')
        .where('ventaId', '==', ventaId)
        .limit(1)
        .get();
      if (!mlSyncByVenta.empty) {
        mlSync = mlSyncByVenta.docs[0].data();
      } else if (venta.mercadoLibreId) {
        // Try by ML order ID
        const mlSyncById = await db.collection('mlOrderSync')
          .where('orderId', '==', Number(venta.mercadoLibreId))
          .limit(1)
          .get();
        if (!mlSyncById.empty) {
          mlSync = mlSyncById.docs[0].data();
        }
      }

      let expected = null;
      let expectedSource = '';

      if (mlSync && mlSync.estado === 'procesada') {
        const totalML = mlSync.totalML || 0;
        const costoEnvioCliente = mlSync.costoEnvioCliente || 0;
        const metodoEnvio = mlSync.metodoEnvio || mlSync.trackingMethod || '?';

        console.log(`  ML Sync: totalML=${fmtMonto(totalML)}, costoEnvioCliente=${fmtMonto(costoEnvioCliente)}, metodoEnvio=${metodoEnvio}, estado=${mlSync.estado}`);

        if (metodoEnvio === 'flex') {
          expected = totalML + costoEnvioCliente;
          expectedSource = `totalML(${totalML}) + envioCliente(${costoEnvioCliente}) [flex]`;
        } else {
          expected = totalML;
          expectedSource = `totalML(${totalML}) [${metodoEnvio}]`;
        }
      } else if (mlSync) {
        console.log(`  ML Sync found but estado=${mlSync.estado} (not procesada)`);
      }

      // If no ML sync or not procesada, use pagos array MP portion
      if (expected === null) {
        if (totalMPPagos > 0) {
          expected = totalMPPagos;
          expectedSource = `pagos array MP portion`;
        } else {
          // No ML sync, no pagos array — can't determine expected, just use venta total as reference
          expected = venta.totalPEN || monto;
          expectedSource = `venta.totalPEN (no ML sync, no pagos)`;
        }
      }

      // SPECIAL CHECK: if there are mixed payments, the movement should match only the MP portion
      if (pagosOtros.length > 0 && pagosMPInVenta.length > 0) {
        if (Math.abs(monto - (venta.totalPEN || 0)) < 0.02 && Math.abs(monto - totalMPPagos) > 1) {
          console.log(`  🚨 ALERT: Movement matches FULL venta total, not MP portion! Should be ${fmtMonto(totalMPPagos)}`);
        }
      }

      const diff = monto - expected;
      console.log(`  Expected: ${fmtMonto(expected)} (${expectedSource})`);
      console.log(`  Diff: ${fmtMonto(diff)}`);

      if (Math.abs(diff) < 0.02) {
        results.matching.push({ num, monto });
        console.log(`  ✅ MATCH`);
      } else {
        results.discrepancy.push({ num, monto, expected, diff, reason: expectedSource, ventaNum: venta.numeroVenta });
        console.log(`  ❌ DISCREPANCY: ${fmtMonto(diff)}`);
      }

    } catch (err) {
      console.log(`  ❌ ERROR processing venta: ${err.message}`);
      results.errors.push({ num, monto, error: err.message });
    }

  // ── CASE B: Has cotizacionId but no ventaId ──
  } else if (cotizacionId) {
    try {
      // Check if cotizacion became a venta
      const ventaFromCotSnap = await db.collection('ventas')
        .where('cotizacionId', '==', cotizacionId)
        .limit(1)
        .get();

      if (!ventaFromCotSnap.empty) {
        const ventaFromCot = ventaFromCotSnap.docs[0].data();
        console.log(`  ⚠ ORPHAN/MISLINKED: cotizacion ${cotizacionId} became venta ${ventaFromCot.numeroVenta || ventaFromCotSnap.docs[0].id} but movement not linked to venta`);
        results.orphan.push({ num, monto, cotizacionId, ventaId: ventaFromCotSnap.docs[0].id, ventaNum: ventaFromCot.numeroVenta });
      } else {
        // Check if cotizacion exists at all
        const cotDoc = await db.collection('cotizaciones').doc(cotizacionId).get();
        if (cotDoc.exists) {
          const cot = cotDoc.data();
          console.log(`  ⚠ ORPHAN: cotizacion exists (${cot.numeroCotizacion || cotizacionId}), estado=${cot.estado}, no venta created`);
        } else {
          // Try requerimientos collection (cotizaciones might be stored there)
          const reqDoc = await db.collection('requerimientos').doc(cotizacionId).get();
          if (reqDoc.exists) {
            const req = reqDoc.data();
            console.log(`  ⚠ ORPHAN: found in requerimientos (${req.numeroCotizacion || req.numero || cotizacionId}), estado=${req.estado}`);
          } else {
            console.log(`  ⚠ ORPHAN: cotizacion doc not found in cotizaciones or requerimientos`);
          }
        }
        results.orphan.push({ num, monto, cotizacionId });
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${err.message}`);
      results.errors.push({ num, monto, error: err.message });
    }

  // ── CASE C: Unlinked ──
  } else {
    console.log(`  ⚠ UNLINKED: no ventaId, no cotizacionId`);
    results.unlinked.push({ num, monto, concepto, gastoId });
  }

  console.log('');
}

// ── 3. SUMMARY ──────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

const totalIngresos = movements.reduce((s, m) => s + (m.monto || 0), 0);
const totalMatching = results.matching.reduce((s, m) => s + m.monto, 0);
const totalDiscrepancy = results.discrepancy.reduce((s, m) => s + m.monto, 0);
const totalOrphan = results.orphan.reduce((s, m) => s + m.monto, 0);
const totalUnlinked = results.unlinked.reduce((s, m) => s + m.monto, 0);
const totalExcess = results.discrepancy.reduce((s, m) => s + Math.max(0, m.diff), 0);

console.log(`Total ingresos to MP:         ${fmtMonto(totalIngresos)} (${movements.length} movements)`);
console.log(`Matching expected:             ${fmtMonto(totalMatching)} (${results.matching.length})`);
console.log(`With discrepancy:              ${fmtMonto(totalDiscrepancy)} (${results.discrepancy.length})`);
console.log(`Orphan/mislinked:              ${fmtMonto(totalOrphan)} (${results.orphan.length})`);
console.log(`Unlinked:                      ${fmtMonto(totalUnlinked)} (${results.unlinked.length})`);
console.log(`Errors:                        ${results.errors.length}`);
console.log(`TOTAL EXCESS (positive diffs): ${fmtMonto(totalExcess)}`);

if (results.discrepancy.length > 0) {
  console.log('\n── Discrepancies Detail ──');
  for (const d of results.discrepancy) {
    console.log(`  ${d.num} | Venta: ${d.ventaNum || '?'} | Monto: ${fmtMonto(d.monto)} | Expected: ${fmtMonto(d.expected)} | Diff: ${fmtMonto(d.diff)} | Reason: ${d.reason}`);
  }
}

if (results.orphan.length > 0) {
  console.log('\n── Orphan/Mislinked Detail ──');
  for (const o of results.orphan) {
    console.log(`  ${o.num} | Monto: ${fmtMonto(o.monto)} | CotizacionId: ${o.cotizacionId} | VentaId: ${o.ventaId || '-'} | VentaNum: ${o.ventaNum || '-'}`);
  }
}

if (results.unlinked.length > 0) {
  console.log('\n── Unlinked Detail ──');
  for (const u of results.unlinked) {
    console.log(`  ${u.num} | Monto: ${fmtMonto(u.monto)} | Concepto: ${u.concepto} | GastoId: ${u.gastoId || '-'}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  FORENSIC AUDIT LAYER 1 COMPLETE');
console.log('═══════════════════════════════════════════════════════════════');

process.exit(0);
