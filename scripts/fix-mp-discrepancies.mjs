/**
 * Fix MP account discrepancies - identified root causes:
 * 1. VT-2026-056: Delete duplicate manual movement (MOV-2026-0001) → -S/ 108
 * 2. VT-2026-061: Fix ingreso amount 112.17→108 → -S/ 4.17
 * 3. VT-2026-062a: Register missing comisión ML → -S/ 20.10
 * 4. Urbano cargo envío: Register missing gastos for 054, 056, 057, 061
 *    → -S/ 6.95, -S/ 4.17, -S/ 4.17, -S/ 4.17 = -S/ 19.46
 * Total expected correction: -S/ 151.73
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const DRY_RUN = process.argv.includes('--apply') ? false : true;

if (DRY_RUN) console.log('=== DRY RUN (use --apply to execute) ===\n');
else console.log('=== APPLYING FIXES ===\n');

let totalCorrection = 0;

// ─── Fix 1: Delete VT-2026-056 duplicate movement ───
console.log('Fix 1: VT-2026-056 duplicate movement');
const dupMovId = 'xNPbEFCS3DGb5gnmvSO9'; // MOV-2026-0001
const dupMov = await db.collection('movimientosTesoreria').doc(dupMovId).get();
if (dupMov.exists) {
  const dd = dupMov.data();
  console.log(`  Found: ${dd.numeroMovimiento} | ${dd.tipo} | S/ ${dd.monto} | ${dd.concepto}`);
  console.log(`  Action: DELETE this duplicate movement, decrement MP saldo by S/ ${dd.monto}`);
  totalCorrection -= dd.monto;
  if (!DRY_RUN) {
    await db.collection('movimientosTesoreria').doc(dupMovId).delete();
    await db.collection('cuentasCaja').doc(mpId).update({
      saldoActual: FieldValue.increment(-dd.monto)
    });
    console.log('  ✓ Done');
  }
} else {
  console.log('  Already fixed or not found');
}

// ─── Fix 2: VT-2026-061 ingreso amount ───
console.log('\nFix 2: VT-2026-061 ingreso amount 112.17→108');
const mov061Id = 'ujsQCHU3RLpNgjbLuDxA'; // MOV-ml-1772933039323
const mov061 = await db.collection('movimientosTesoreria').doc(mov061Id).get();
if (mov061.exists) {
  const md = mov061.data();
  console.log(`  Found: ${md.numeroMovimiento} | S/ ${md.monto}`);
  if (Math.abs(md.monto - 112.17) < 0.01) {
    const diff = 112.17 - 108;
    console.log(`  Action: Change monto from ${md.monto} to 108, decrement saldo by ${diff.toFixed(2)}`);
    totalCorrection -= diff;
    if (!DRY_RUN) {
      await db.collection('movimientosTesoreria').doc(mov061Id).update({ monto: 108 });
      await db.collection('cuentasCaja').doc(mpId).update({
        saldoActual: FieldValue.increment(-diff)
      });
      // Also fix the venta's totalPEN
      const syncQ = await db.collection('mlOrderSync').where('numeroVenta','==','VT-2026-061').get();
      if (!syncQ.empty) {
        const ventaId = syncQ.docs[0].data().ventaId;
        const venta = await db.collection('ventas').doc(ventaId).get();
        if (venta.exists && Math.abs((venta.data().totalPEN || 0) - 112.17) < 0.01) {
          await db.collection('ventas').doc(ventaId).update({
            totalPEN: 108,
            montoPendiente: 0,
            costoEnvio: 0 // Urbano: client doesn't pay shipping
          });
          console.log('  ✓ Also fixed venta totalPEN 112.17→108, costoEnvio→0');
        }
      }
      console.log('  ✓ Done');
    }
  } else {
    console.log(`  Already fixed (current monto: ${md.monto})`);
  }
}

// ─── Fix 3: VT-2026-062a missing comisión ───
console.log('\nFix 3: VT-2026-062a missing comisión ML S/ 20.10');
const venta062aId = 'oT62lh9MR8RWM7dg9DCc';
// Check if comisión gasto already exists
const existingGas062 = await db.collection('movimientosTesoreria')
  .where('ventaId','==', venta062aId)
  .where('tipo','==','gasto_operativo')
  .get();
if (existingGas062.empty) {
  console.log('  No comisión gasto found → creating');
  const comision = 20.10;
  totalCorrection -= comision;
  if (!DRY_RUN) {
    const now = Timestamp.now();
    const fecha = now.toDate();
    // Create gasto
    const gastoRef = await db.collection('gastos').add({
      numeroGasto: `GAS-fix-062a-${Date.now()}`,
      tipo: 'comision_ml',
      categoria: 'GV',
      claseGasto: 'GVD',
      descripcion: 'Comisión ML - VT-2026-062 - Orden #2000015447990598 (fix retroactivo)',
      moneda: 'PEN',
      montoOriginal: comision,
      montoPEN: comision,
      tipoCambio: 3.70,
      esProrrateable: false,
      ventaId: venta062aId,
      ventaNumero: 'VT-2026-062',
      mes: fecha.getMonth() + 1,
      anio: fecha.getFullYear(),
      fecha: now,
      estado: 'pagado',
      impactaCTRU: false,
      ctruRecalculado: true,
      montoPagado: comision,
      montoPendiente: 0,
      creadoPor: 'fix-script',
      fechaCreacion: now,
    });
    // Create movement
    await db.collection('movimientosTesoreria').add({
      numeroMovimiento: `MOV-fix-com062a-${Date.now()}`,
      tipo: 'gasto_operativo',
      estado: 'ejecutado',
      moneda: 'PEN',
      monto: comision,
      tipoCambio: 3.70,
      metodo: 'mercado_pago',
      concepto: 'Comisión ML - VT-2026-062 - Orden #2000015447990598 (fix retroactivo)',
      gastoId: gastoRef.id,
      ventaId: venta062aId,
      ventaNumero: 'VT-2026-062',
      cuentaOrigen: mpId,
      fecha: now,
      creadoPor: 'fix-script',
      fechaCreacion: now,
    });
    await db.collection('cuentasCaja').doc(mpId).update({
      saldoActual: FieldValue.increment(-comision)
    });
    console.log('  ✓ Done');
  }
} else {
  console.log('  Comisión already exists, skipping');
}

// ─── Fix 4: Urbano cargo envío (missing egreso for 4 orders) ───
const urbanoOrders = [
  { sync: 'ml-2000015390729088', venta: 'VT-2026-054', cargo: 6.95, mlOrder: '2000015390729088' },
  { sync: 'ml-2000015432846842', venta: 'VT-2026-056', cargo: 4.17, mlOrder: '2000015432846842' },
  { sync: 'ml-2000015449299780', venta: 'VT-2026-057', cargo: 4.17, mlOrder: '2000015449299780' },
  { sync: 'ml-2000015447257680', venta: 'VT-2026-061', cargo: 4.17, mlOrder: '2000015447257680' },
];

for (const uo of urbanoOrders) {
  console.log(`\nFix 4: ${uo.venta} Urbano cargo envío S/ ${uo.cargo}`);

  // Get ventaId from sync
  const syncDoc = await db.collection('mlOrderSync').doc(uo.sync).get();
  if (!syncDoc.exists) { console.log('  Sync doc not found, skipping'); continue; }
  const ventaId = syncDoc.data().ventaId;

  // Check if already has a cargo envío gasto
  const existingEnv = await db.collection('movimientosTesoreria')
    .where('ventaId','==', ventaId)
    .where('tipo','==','gasto_operativo')
    .get();

  const hasCargoEnvio = existingEnv.docs.some(d => {
    const c = d.data().concepto || '';
    return c.includes('Cargo envío') || c.includes('cargo_envio');
  });

  if (hasCargoEnvio) {
    console.log('  Cargo envío already registered, skipping');
    continue;
  }

  console.log(`  Action: Create gasto + movement S/ ${uo.cargo}, decrement saldo`);
  totalCorrection -= uo.cargo;

  if (!DRY_RUN) {
    const now = Timestamp.now();
    const fecha = now.toDate();
    const gastoRef = await db.collection('gastos').add({
      numeroGasto: `GAS-fix-env-${uo.venta}-${Date.now()}`,
      tipo: 'cargo_envio_ml',
      categoria: 'GV',
      claseGasto: 'GVD',
      descripcion: `Cargo envío ML (Urbano) - Orden #${uo.mlOrder} - ${uo.venta} (fix retroactivo)`,
      moneda: 'PEN',
      montoOriginal: uo.cargo,
      montoPEN: uo.cargo,
      tipoCambio: 3.70,
      esProrrateable: false,
      ventaId,
      ventaNumero: uo.venta,
      mes: fecha.getMonth() + 1,
      anio: fecha.getFullYear(),
      fecha: now,
      estado: 'pagado',
      impactaCTRU: false,
      ctruRecalculado: true,
      montoPagado: uo.cargo,
      montoPendiente: 0,
      creadoPor: 'fix-script',
      fechaCreacion: now,
    });
    await db.collection('movimientosTesoreria').add({
      numeroMovimiento: `MOV-fix-env-${uo.venta}-${Date.now()}`,
      tipo: 'gasto_operativo',
      estado: 'ejecutado',
      moneda: 'PEN',
      monto: uo.cargo,
      tipoCambio: 3.70,
      metodo: 'mercado_pago',
      concepto: `Cargo envío ML (Urbano) - ${uo.venta} - Orden #${uo.mlOrder} (fix retroactivo)`,
      gastoId: gastoRef.id,
      ventaId,
      ventaNumero: uo.venta,
      cuentaOrigen: mpId,
      fecha: now,
      creadoPor: 'fix-script',
      fechaCreacion: now,
    });
    await db.collection('cuentasCaja').doc(mpId).update({
      saldoActual: FieldValue.increment(-uo.cargo)
    });
    await db.collection('ventas').doc(ventaId).update({
      cargoEnvioMLRegistrado: true,
      gastosVentaPEN: FieldValue.increment(uo.cargo),
    });
    console.log('  ✓ Done');
  }
}

// ─── Summary ───
const mpAfter = await db.collection('cuentasCaja').doc(mpId).get();
console.log('\n===== SUMMARY =====');
console.log(`Total correction: S/ ${totalCorrection.toFixed(2)}`);
console.log(`Saldo before: S/ ${mpAfter.data().saldoActual.toFixed(2)}`);
if (DRY_RUN) {
  console.log(`Saldo after (projected): S/ ${(mpAfter.data().saldoActual + totalCorrection).toFixed(2)}`);
  console.log('\nRun with --apply to execute these fixes');
} else {
  console.log(`Saldo after: S/ ${mpAfter.data().saldoActual.toFixed(2)}`);
}
