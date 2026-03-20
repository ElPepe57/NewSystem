import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// ── Step 1: Build maps of every movement touching MP ──
const movSnap = await db.collection('movimientosTesoreria').get();
const ingresosByVenta = {};   // ventaId → sum of montos INTO MP
const egresosByGasto = {};    // gastoId → sum of montos OUT OF MP
const orphanIngresos = [];
const orphanEgresos = [];
const cotizacionMovements = []; // movements with cotizacionId but no ventaId

for (const doc of movSnap.docs) {
  const m = doc.data();
  if (m.estado === 'anulado') continue;

  // Ingresos to MP
  if (m.cuentaDestino === mpId) {
    const monto = Number(m.monto) || 0;
    if (m.ventaId) {
      ingresosByVenta[m.ventaId] = (ingresosByVenta[m.ventaId] || 0) + monto;
    } else if (m.cotizacionId) {
      cotizacionMovements.push({ tipo: 'ingreso', cotizacionId: m.cotizacionId, monto, docId: doc.id });
    } else {
      orphanIngresos.push({ docId: doc.id, monto, concepto: m.concepto || '' });
    }
  }

  // Egresos from MP
  if (m.cuentaOrigen === mpId) {
    const monto = Number(m.monto) || 0;
    if (m.gastoId) {
      egresosByGasto[m.gastoId] = (egresosByGasto[m.gastoId] || 0) + monto;
    } else if (m.ventaId) {
      // Direct egreso linked to venta (rare but possible)
      if (!ingresosByVenta[m.ventaId]) ingresosByVenta[m.ventaId] = 0; // ensure key exists
      // We'll track egresos by venta separately
    } else if (m.cotizacionId) {
      cotizacionMovements.push({ tipo: 'egreso', cotizacionId: m.cotizacionId, monto, docId: doc.id });
    } else {
      orphanEgresos.push({ docId: doc.id, monto, concepto: m.concepto || '' });
    }
  }
}

// Also build direct egresos-by-venta from movements (cuentaOrigen=mpId with ventaId but no gastoId)
const egresosByVentaDirect = {};
for (const doc of movSnap.docs) {
  const m = doc.data();
  if (m.estado === 'anulado') continue;
  if (m.cuentaOrigen === mpId && m.ventaId && !m.gastoId) {
    const monto = Number(m.monto) || 0;
    egresosByVentaDirect[m.ventaId] = (egresosByVentaDirect[m.ventaId] || 0) + monto;
  }
}

// Resolve cotizacion movements → ventaId
const uniqueCotIds = [...new Set(cotizacionMovements.map(c => c.cotizacionId))];
const cotVentaMap = {};
for (const cotId of uniqueCotIds) {
  const cotDoc = await db.collection('cotizaciones').doc(cotId).get();
  if (cotDoc.exists) {
    const data = cotDoc.data();
    if (data.ventaId) cotVentaMap[cotId] = data.ventaId;
  }
}

for (const cm of cotizacionMovements) {
  const ventaId = cotVentaMap[cm.cotizacionId];
  if (ventaId) {
    if (cm.tipo === 'ingreso') {
      ingresosByVenta[ventaId] = (ingresosByVenta[ventaId] || 0) + cm.monto;
    } else {
      egresosByVentaDirect[ventaId] = (egresosByVentaDirect[ventaId] || 0) + cm.monto;
    }
  } else {
    if (cm.tipo === 'ingreso') {
      orphanIngresos.push({ docId: cm.docId, monto: cm.monto, concepto: `cotizacion:${cm.cotizacionId} (no ventaId)` });
    } else {
      orphanEgresos.push({ docId: cm.docId, monto: cm.monto, concepto: `cotizacion:${cm.cotizacionId} (no ventaId)` });
    }
  }
}

// ── Step 2: Build egresos per venta via gastos ──
const gastosSnap = await db.collection('gastos').get();
const gastosByVenta = {}; // ventaId → [gastoId, ...]
const gastoVentaMap = {}; // gastoId → ventaId

for (const doc of gastosSnap.docs) {
  const g = doc.data();
  if (g.ventaId) {
    if (!gastosByVenta[g.ventaId]) gastosByVenta[g.ventaId] = [];
    gastosByVenta[g.ventaId].push(doc.id);
    gastoVentaMap[doc.id] = g.ventaId;
  }
}

// Also check entregas → gastoEnvioId
const entregasSnap = await db.collection('entregas').get();
for (const doc of entregasSnap.docs) {
  const e = doc.data();
  if (e.gastoEnvioId && e.ventaId) {
    if (!gastosByVenta[e.ventaId]) gastosByVenta[e.ventaId] = [];
    if (!gastosByVenta[e.ventaId].includes(e.gastoEnvioId)) {
      gastosByVenta[e.ventaId].push(e.gastoEnvioId);
    }
    gastoVentaMap[e.gastoEnvioId] = e.ventaId;
  }
}

// Now sum MP egresos per venta
const egresosByVentaViaGasto = {};
for (const [ventaId, gastoIds] of Object.entries(gastosByVenta)) {
  let total = 0;
  for (const gid of gastoIds) {
    total += egresosByGasto[gid] || 0;
  }
  if (total > 0) egresosByVentaViaGasto[ventaId] = total;
}

// ── Step 3: For each venta with ANY MP movement ──
// Collect all ventaIds that touch MP
const allVentaIds = new Set([
  ...Object.keys(ingresosByVenta),
  ...Object.keys(egresosByVentaDirect),
  ...Object.keys(egresosByVentaViaGasto),
]);

// Get ventas
const ventasSnap = await db.collection('ventas').get();
const ventasMap = {};
for (const doc of ventasSnap.docs) {
  ventasMap[doc.id] = { id: doc.id, ...doc.data() };
}

// Get mlOrderSync docs
const mlSyncSnap = await db.collection('mlOrderSync').get();
const mlSyncs = mlSyncSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// Build mlSync lookup by ventaId
const mlSyncByVenta = {};
for (const sync of mlSyncs) {
  if (sync.ventaId) {
    if (!mlSyncByVenta[sync.ventaId]) mlSyncByVenta[sync.ventaId] = [];
    mlSyncByVenta[sync.ventaId].push(sync);
  }
}

// Process each venta
const results = [];

for (const ventaId of allVentaIds) {
  const venta = ventasMap[ventaId];
  const numero = venta?.numero || ventaId;

  const sysIN = ingresosByVenta[ventaId] || 0;
  const sysOUT = (egresosByVentaDirect[ventaId] || 0) + (egresosByVentaViaGasto[ventaId] || 0);
  const sysNET = sysIN - sysOUT;

  // Get ML sync data
  const syncs = mlSyncByVenta[ventaId] || [];

  let mlDEP = 0;
  let mlCHG = 0;
  let metodo = 'n/a';

  if (syncs.length > 0) {
    // Find the "main" sync: prefer procesada, highest totalML, prefer non-pack
    const procesadas = syncs.filter(s => s.estado === 'procesada');
    const candidates = procesadas.length > 0 ? procesadas : syncs;

    // Separate pack syncs from regular
    const packSyncs = candidates.filter(s => s.id.startsWith('ml-pack-'));
    const regularSyncs = candidates.filter(s => !s.id.startsWith('ml-pack-'));

    // Main sync = regular with highest totalML, fallback to pack
    let mainSync;
    if (regularSyncs.length > 0) {
      mainSync = regularSyncs.sort((a, b) => (b.totalML || 0) - (a.totalML || 0))[0];
    } else {
      mainSync = packSyncs.sort((a, b) => (b.totalML || 0) - (a.totalML || 0))[0];
    }

    const totalML = mainSync.totalML || 0;
    metodo = mainSync.metodoEnvio || mainSync.shippingMethod || 'unknown';
    const costoEnvioCliente = mainSync.costoEnvioCliente || 0;
    const cargoEnvioML = Math.max(...syncs.map(s => s.cargoEnvioML || 0), 0);

    // ML_DEPOSIT
    if (metodo === 'flex' || (metodo && metodo.toLowerCase().includes('flex'))) {
      mlDEP = totalML + costoEnvioCliente;
    } else {
      mlDEP = totalML;
    }

    // Commissions: sum unique mlOrderId commissions
    const seenOrderIds = new Set();
    let totalComision = 0;
    for (const sync of syncs) {
      // Check subOrders
      if (sync.subOrders && Array.isArray(sync.subOrders)) {
        for (const sub of sync.subOrders) {
          const oid = sub.mlOrderId || sub.orderId;
          if (oid && !seenOrderIds.has(oid)) {
            seenOrderIds.add(oid);
            totalComision += sub.comisionML || 0;
          }
        }
      }
      // Also check the sync itself
      const syncOrderId = sync.mlOrderId;
      if (syncOrderId && !seenOrderIds.has(syncOrderId)) {
        seenOrderIds.add(syncOrderId);
        totalComision += sync.comisionML || 0;
      }
    }

    mlCHG = totalComision + cargoEnvioML;
  }

  const mlNET = mlDEP - mlCHG;
  const disc = sysNET - mlNET;

  results.push({
    numero,
    ventaId,
    metodo,
    sysIN: round2(sysIN),
    sysOUT: round2(sysOUT),
    sysNET: round2(sysNET),
    mlDEP: round2(mlDEP),
    mlCHG: round2(mlCHG),
    mlNET: round2(mlNET),
    disc: round2(disc),
  });
}

function round2(n) { return Math.round(n * 100) / 100; }

// Sort by absolute disc descending
results.sort((a, b) => Math.abs(b.disc) - Math.abs(a.disc));

// Print results
console.log('');
console.log('VENTA          | METODO    | sysIN      | sysOUT     | sysNET     | mlDEP      | mlCHG      | mlNET      | DISC');
console.log('-'.repeat(130));

for (const r of results) {
  const fmt = (v) => v.toFixed(2).padStart(10);
  console.log(
    `${r.numero.padEnd(15)}| ${(r.metodo || '').padEnd(10)}| ${fmt(r.sysIN)} | ${fmt(r.sysOUT)} | ${fmt(r.sysNET)} | ${fmt(r.mlDEP)} | ${fmt(r.mlCHG)} | ${fmt(r.mlNET)} | ${fmt(r.disc)}`
  );
}

// Summary
const sumPositiveDisc = round2(results.filter(r => r.disc > 0.005).reduce((s, r) => s + r.disc, 0));
const sumNegativeDisc = round2(results.filter(r => r.disc < -0.005).reduce((s, r) => s + r.disc, 0));
const totalOrphanIn = round2(orphanIngresos.reduce((s, o) => s + o.monto, 0));
const totalOrphanOut = round2(orphanEgresos.reduce((s, o) => s + o.monto, 0));
// Orphan egresos are typically bank transfers OUT of MP (not sales-related), so they don't affect the saldo gap
// The gap is: sum of DISC across ventas + orphan ingresos (which inflate saldo with no ML backing)
const totalOverstatement = round2(sumPositiveDisc + sumNegativeDisc + totalOrphanIn);

console.log('\n' + '='.repeat(80));
console.log(`Sum of positive DISC (inflating):   S/ ${sumPositiveDisc.toFixed(2)}`);
console.log(`Sum of negative DISC (deflating):   S/ ${sumNegativeDisc.toFixed(2)}`);
console.log(`Orphan ingresos:                    S/ ${totalOrphanIn.toFixed(2)}`);
if (orphanIngresos.length > 0) {
  for (const o of orphanIngresos) {
    console.log(`  - ${o.docId}: S/ ${o.monto.toFixed(2)} (${o.concepto})`);
  }
}
console.log(`Orphan egresos:                     S/ ${totalOrphanOut.toFixed(2)}`);
if (orphanEgresos.length > 0) {
  for (const o of orphanEgresos) {
    console.log(`  - ${o.docId}: S/ ${o.monto.toFixed(2)} (${o.concepto})`);
  }
}
console.log(`TOTAL OVER-STATEMENT:               S/ ${totalOverstatement.toFixed(2)}`);
console.log(`GAP (system - real):                S/ 321.50`);
console.log(`MATCH:                              ${(100 * totalOverstatement / 321.50).toFixed(1)}%`);
console.log('');

process.exit(0);
