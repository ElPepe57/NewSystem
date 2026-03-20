/**
 * GAP Exacto: Two independent calculations of what MP saldo SHOULD be
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// ============================================================
// CALCULATION A: From movements (what the system says)
// ============================================================
const [movsDestinoSnap, movsOrigenSnap] = await Promise.all([
  db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get(),
  db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get(),
]);

const allMovs = new Map();
for (const d of movsDestinoSnap.docs) {
  const data = d.data();
  if (data.estado === 'anulado') continue;
  allMovs.set(d.id, { id: d.id, ...data, isIngreso: true, isEgreso: false });
}
for (const d of movsOrigenSnap.docs) {
  const data = d.data();
  if (data.estado === 'anulado') continue;
  if (allMovs.has(d.id)) {
    allMovs.get(d.id).isEgreso = true;
  } else {
    allMovs.set(d.id, { id: d.id, ...data, isIngreso: false, isEgreso: true });
  }
}

let totalIn = 0, totalOut = 0;
for (const [, m] of allMovs) {
  if (m.isIngreso) totalIn += (m.monto || 0);
  if (m.isEgreso) totalOut += (m.monto || 0);
}
const saldoSystem = totalIn - totalOut;

// ============================================================
// CALCULATION B: From ML reality
// ============================================================

// Get all mlOrderSync
const syncsSnap = await db.collection('mlOrderSync').get();
const allSyncs = syncsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// Group syncs by ventaId
const syncsByVenta = new Map();
for (const s of allSyncs) {
  if (!s.ventaId) continue;
  if (!syncsByVenta.has(s.ventaId)) syncsByVenta.set(s.ventaId, []);
  syncsByVenta.get(s.ventaId).push(s);
}

// For each venta, calculate ML reality
const ventaDetails = [];
let totalMLDeposit = 0, totalMLCommission = 0, totalMLCargo = 0;

for (const [ventaId, syncs] of syncsByVenta) {
  // Find canonical sync: pack sync or the main procesada one
  const packSync = syncs.find(s => s.id.startsWith('ml-pack-'));
  const mainSync = packSync || syncs.find(s => s.estado === 'procesada') || syncs[0];

  // Deposit from main/pack sync
  const totalML = mainSync.totalML || 0;
  const costoEnvioCliente = mainSync.costoEnvioCliente || 0;
  // For flex shipping, costoEnvioCliente is added to deposit
  const deposit = totalML + costoEnvioCliente;

  // Commission = sum across ALL syncs (including ignorada, because commission is real)
  const commission = syncs.reduce((sum, s) => sum + (s.comisionML || 0), 0);

  // Cargo envio = max across syncs (per-shipment)
  const cargo = Math.max(...syncs.map(s => s.cargoEnvioML || 0));

  const mlNet = deposit - commission - cargo;

  totalMLDeposit += deposit;
  totalMLCommission += commission;
  totalMLCargo += cargo;

  ventaDetails.push({ ventaId, syncs, deposit, commission, cargo, mlNet, mainSync });
}

const totalMLNet = totalMLDeposit - totalMLCommission - totalMLCargo;

// ============================================================
// Non-ML movements: movements NOT linked to synced ventas
// ============================================================

// Collect all ventaIds that have syncs
const syncedVentaIds = new Set(syncsByVenta.keys());

// Also collect gastoIds from synced ventas (commissions, cargos registered as gastos)
// We need to find movements linked to ventas
// Ingresos linked to synced ventas = movimientos where concepto references a synced venta
// We'll check by matching ventaId in movement references

// Build map of system movements per ventaId
const movsByVenta = new Map(); // ventaId -> { ingresos, egresos }
const nonMLIngresos = [];
const nonMLEgresos = [];

for (const [, m] of allMovs) {
  const ref = m.ventaId || m.referenciaId || '';
  const concepto = (m.concepto || '').toLowerCase();

  // Try to link to a venta
  let linkedVentaId = null;

  if (m.ventaId && syncedVentaIds.has(m.ventaId)) {
    linkedVentaId = m.ventaId;
  } else if (ref && syncedVentaIds.has(ref)) {
    linkedVentaId = ref;
  } else {
    // Try to find ventaId in concepto (e.g., "Venta VT-062")
    const vtMatch = concepto.match(/vt-?\d+/i);
    if (vtMatch) {
      // Look up VT number in our synced ventas
      for (const vid of syncedVentaIds) {
        if (vid.toLowerCase().includes(vtMatch[0].toLowerCase()) ||
            concepto.includes(vid.toLowerCase())) {
          linkedVentaId = vid;
          break;
        }
      }
    }
  }

  if (linkedVentaId) {
    if (!movsByVenta.has(linkedVentaId)) movsByVenta.set(linkedVentaId, { ingresos: 0, egresos: 0, movs: [] });
    const entry = movsByVenta.get(linkedVentaId);
    if (m.isIngreso) entry.ingresos += (m.monto || 0);
    if (m.isEgreso) entry.egresos += (m.monto || 0);
    entry.movs.push(m);
  } else {
    if (m.isIngreso) nonMLIngresos.push(m);
    if (m.isEgreso) nonMLEgresos.push(m);
  }
}

const nonMLIngresosTotal = nonMLIngresos.reduce((s, m) => s + (m.monto || 0), 0);
const nonMLEgresosTotal = nonMLEgresos.reduce((s, m) => s + (m.monto || 0), 0);
const nonMLNet = nonMLIngresosTotal - nonMLEgresosTotal;

const expectedSaldo = totalMLNet + nonMLNet;
const realSaldo = 1816.15;

// ============================================================
// OUTPUT
// ============================================================

const fmt = (n) => n.toFixed(2);

console.log(`\n${'='.repeat(60)}`);
console.log(`  WHAT THE SYSTEM SAYS (Calculation A)`);
console.log(`${'='.repeat(60)}`);
console.log(`Total ingresos a MP:    S/ ${fmt(totalIn)}`);
console.log(`Total egresos de MP:    S/ ${fmt(totalOut)}`);
console.log(`SALDO SISTEMA:          S/ ${fmt(saldoSystem)}`);

console.log(`\n${'='.repeat(60)}`);
console.log(`  WHAT SHOULD BE IN MP (Calculation B - ML reality)`);
console.log(`${'='.repeat(60)}`);
console.log(`Total ML deposits:      S/ ${fmt(totalMLDeposit)}  (${syncsByVenta.size} ventas)`);
console.log(`Total ML commissions:   S/ ${fmt(totalMLCommission)}`);
console.log(`Total ML cargo envio:   S/ ${fmt(totalMLCargo)}`);
console.log(`TOTAL ML NET:           S/ ${fmt(totalMLNet)}`);

console.log(`\nNon-ML ingresos:        S/ ${fmt(nonMLIngresosTotal)}  (${nonMLIngresos.length} movements)`);
for (const m of nonMLIngresos) {
  console.log(`  + S/ ${fmt(m.monto || 0)} - ${m.concepto || m.tipo || 'sin concepto'} [${m.id}]`);
}

console.log(`Non-ML egresos:         S/ ${fmt(nonMLEgresosTotal)}  (${nonMLEgresos.length} movements)`);
for (const m of nonMLEgresos) {
  console.log(`  - S/ ${fmt(m.monto || 0)} - ${m.concepto || m.tipo || 'sin concepto'} [${m.id}]`);
}

console.log(`NON-ML NET:             S/ ${fmt(nonMLNet)}`);
console.log(`\nEXPECTED SALDO:         S/ ${fmt(expectedSaldo)}`);

console.log(`\n${'='.repeat(60)}`);
console.log(`  RECONCILIATION`);
console.log(`${'='.repeat(60)}`);
console.log(`SALDO SISTEMA:          S/ ${fmt(saldoSystem)}`);
console.log(`EXPECTED SALDO:         S/ ${fmt(expectedSaldo)}`);
console.log(`OVER-STATEMENT:         S/ ${fmt(saldoSystem - expectedSaldo)}  (this is what we need to fix)`);
console.log(``);
console.log(`REAL SALDO MP:          S/ ${fmt(realSaldo)}`);
console.log(`EXPECTED vs REAL:       S/ ${fmt(expectedSaldo - realSaldo)}  (residual after fixing system)`);

// ============================================================
// Per-venta discrepancies
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`  PER-VENTA DISCREPANCIES (system NET != ML NET, diff > S/0.50)`);
console.log(`${'='.repeat(60)}`);

let discrepancyCount = 0;
for (const v of ventaDetails) {
  const systemEntry = movsByVenta.get(v.ventaId);
  const systemNet = systemEntry ? (systemEntry.ingresos - systemEntry.egresos) : 0;
  const diff = systemNet - v.mlNet;

  if (Math.abs(diff) > 0.50) {
    discrepancyCount++;
    console.log(`\n${v.ventaId}:`);
    console.log(`  ML: deposit=${fmt(v.deposit)} commission=${fmt(v.commission)} cargo=${fmt(v.cargo)} → NET=${fmt(v.mlNet)}`);
    console.log(`  System: ingresos=${fmt(systemEntry?.ingresos || 0)} egresos=${fmt(systemEntry?.egresos || 0)} → NET=${fmt(systemNet)}`);
    console.log(`  DIFF: S/ ${fmt(diff)}`);
    console.log(`  Syncs: ${v.syncs.map(s => `${s.id} (estado=${s.estado}, totalML=${s.totalML}, comision=${s.comisionML || 0})`).join(', ')}`);
    if (systemEntry) {
      for (const m of systemEntry.movs) {
        const dir = m.isIngreso ? 'IN' : 'OUT';
        console.log(`  Mov ${dir}: S/ ${fmt(m.monto || 0)} - ${m.concepto || m.tipo || ''} [${m.id}]`);
      }
    } else {
      console.log(`  NO system movements found for this venta`);
    }
  }
}

if (discrepancyCount === 0) {
  console.log('No discrepancies > S/0.50 found.');
}

console.log(`\nTotal discrepancies: ${discrepancyCount}`);
console.log(`\nDone.`);
