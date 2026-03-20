/**
 * AUDITORÍA COMPLETA DE TODAS LAS VENTAS CON IMPACTO EN MERCADOPAGO
 * Para cada venta: verificar ML linkage, ingreso, comisión, cargo envío, delivery
 * y comparar con lo que ML realmente depositó/cobró.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Get ALL ventas
const ventasSnap = await db.collection('ventas').orderBy('numeroVenta').get();
const ventas = [];
for (const v of ventasSnap.docs) {
  ventas.push({ id: v.id, ...v.data() });
}
ventas.sort((a, b) => (a.numeroVenta || '').localeCompare(b.numeroVenta || ''));

// Get ALL mlOrderSync
const syncsSnap = await db.collection('mlOrderSync').get();
const syncByVenta = new Map();
const syncByMLId = new Map();
for (const s of syncsSnap.docs) {
  const sd = s.data();
  if (sd.ventaId) {
    if (!syncByVenta.has(sd.ventaId)) syncByVenta.set(sd.ventaId, []);
    syncByVenta.get(sd.ventaId).push({ id: s.id, ...sd });
  }
  if (sd.mlOrderId) syncByMLId.set(String(sd.mlOrderId), { id: s.id, ...sd });
}

// Get ALL movements from/to MP (group by ventaId and gastoId)
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

// Ingreso movements by ventaId
const ingresosByVenta = new Map();
for (const m of movsD.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (d.ventaId) {
    if (!ingresosByVenta.has(d.ventaId)) ingresosByVenta.set(d.ventaId, []);
    ingresosByVenta.get(d.ventaId).push({ id: m.id, ...d });
  }
}

// Egreso movements by gastoId
const egresosByGasto = new Map();
for (const m of movsO.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (d.gastoId) {
    if (!egresosByGasto.has(d.gastoId)) egresosByGasto.set(d.gastoId, []);
    egresosByGasto.get(d.gastoId).push({ id: m.id, ...d });
  }
}

// Get ALL gastos by ventaId
const gastosSnap = await db.collection('gastos').get();
const gastosByVenta = new Map();
for (const g of gastosSnap.docs) {
  const gd = g.data();
  if (gd.ventaId && gd.estado !== 'anulado') {
    if (!gastosByVenta.has(gd.ventaId)) gastosByVenta.set(gd.ventaId, []);
    gastosByVenta.get(gd.ventaId).push({ id: g.id, ...gd });
  }
}

// Get entregas by ventaId
const entregasSnap = await db.collection('entregas').get();
const entregasByVenta = new Map();
for (const e of entregasSnap.docs) {
  const ed = e.data();
  if (ed.ventaId) {
    if (!entregasByVenta.has(ed.ventaId)) entregasByVenta.set(ed.ventaId, []);
    entregasByVenta.get(ed.ventaId).push({ id: e.id, ...ed });
  }
}

console.log('═══════════════════════════════════════════════════════════════════════════════════');
console.log('AUDITORÍA COMPLETA: TODAS LAS VENTAS CON IMPACTO EN MERCADOPAGO');
console.log('═══════════════════════════════════════════════════════════════════════════════════\n');

let saldoVentas = 0;
const issues = [];

for (const v of ventas) {
  const ingresos = ingresosByVenta.get(v.id) || [];
  if (ingresos.length === 0) continue;

  const gastos = gastosByVenta.get(v.id) || [];
  const entregas = entregasByVenta.get(v.id) || [];
  let syncs = syncByVenta.get(v.id) || [];
  if (syncs.length === 0 && v.mercadoLibreId) {
    const s = syncByMLId.get(String(v.mercadoLibreId));
    if (s) syncs = [s];
  }

  const ingresoTotal = ingresos.reduce((s, m) => s + (m.monto || 0), 0);

  // Egresos from MP for this venta's gastos
  let comisionMP = 0, cargoMP = 0, deliveryMP = 0;
  for (const g of gastos) {
    const gMovs = egresosByGasto.get(g.id) || [];
    const mpEgreso = gMovs.reduce((s, m) => s + (m.monto || 0), 0);
    const tipo = g.tipo || '';
    if (tipo === 'comision_ml' || tipo.includes('omisi')) comisionMP += mpEgreso;
    else if (tipo === 'cargo_envio_ml') cargoMP += mpEgreso;
    else if (tipo === 'delivery') deliveryMP += mpEgreso;
  }

  // Also check entregas for delivery gastos from MP
  for (const e of entregas) {
    if (e.gastoEnvioId) {
      const gMovs = egresosByGasto.get(e.gastoEnvioId) || [];
      const mpEgreso = gMovs.reduce((s, m) => s + (m.monto || 0), 0);
      if (mpEgreso > 0 && deliveryMP === 0) deliveryMP += mpEgreso;
    }
  }

  const egresoTotal = comisionMP + cargoMP + deliveryMP;
  const netSistema = ingresoTotal - egresoTotal;

  // Sync data
  const sync = syncs.find(s => s.estado === 'procesada') || syncs[0];
  const totalML = sync?.totalML || 0;
  const comisionML = sync?.comisionML || 0;
  const cargoEnvioML = sync?.cargoEnvioML || 0;
  const metodoEnvio = sync?.metodoEnvio || v.metodoEnvio || '?';
  const syncEstado = sync?.estado || 'sin_sync';

  // Expected net from ML: totalML - comision - cargo
  // But if delivery already covers cargo, expected = totalML - comision - delivery
  let netEsperado;
  if (totalML > 0) {
    // Use actual egreso data for cargo: prefer cargo_envio, fallback to delivery
    const cargoReal = cargoMP > 0 ? cargoMP : deliveryMP;
    netEsperado = totalML - comisionML - cargoEnvioML;
  } else {
    netEsperado = netSistema; // Can't verify without sync
  }

  const discrepancia = totalML > 0 ? netSistema - netEsperado : 0;
  saldoVentas += netSistema;

  const hasIssue = Math.abs(discrepancia) > 0.50 || (v.mercadoLibreId && totalML === 0);

  if (hasIssue) {
    issues.push({
      num: v.numeroVenta, discrepancia, ingresoTotal, comisionMP, cargoMP, deliveryMP,
      totalML, comisionML, cargoEnvioML, metodoEnvio, syncEstado,
      mercadoLibreId: v.mercadoLibreId, netSistema, netEsperado,
    });
  }

  const flag = hasIssue ? '⚠' : '✓';
  console.log(`${flag} ${v.numeroVenta?.padEnd(13)} | ${metodoEnvio.padEnd(7)} | ing:${ingresoTotal.toFixed(2).padStart(8)} | com:${comisionMP.toFixed(2).padStart(6)} | cargo:${cargoMP.toFixed(2).padStart(5)} | deliv:${deliveryMP.toFixed(2).padStart(5)} | tML:${totalML.toFixed(2).padStart(8)} | net_s:${netSistema.toFixed(2).padStart(8)} | net_e:${netEsperado.toFixed(2).padStart(8)} | disc:${discrepancia.toFixed(2).padStart(7)} | ${syncEstado}`);
}

console.log('\n═══════════════════════════════════════════════════════════════════════════════════');
console.log(`VENTAS CON DISCREPANCIAS (${issues.length})`);
console.log('═══════════════════════════════════════════════════════════════════════════════════\n');

let discTotal = 0;
for (const d of issues) {
  discTotal += d.discrepancia;
  console.log(`${d.num} (${d.metodoEnvio}, ${d.syncEstado})`);
  console.log(`  Ingreso:    S/ ${d.ingresoTotal.toFixed(2)} ${d.totalML > 0 && Math.abs(d.ingresoTotal - d.totalML) > 0.5 ? `(ML dice totalML=${d.totalML.toFixed(2)}, diff=${(d.ingresoTotal - d.totalML).toFixed(2)})` : ''}`);
  console.log(`  Comisión:   pagada S/${d.comisionMP.toFixed(2)} ${d.comisionML > 0 ? `| ML dice S/${d.comisionML.toFixed(2)}` : '| sin sync'} ${Math.abs(d.comisionMP - d.comisionML) > 0.5 ? `⚠ diff=${(d.comisionMP - d.comisionML).toFixed(2)}` : ''}`);
  console.log(`  CargoEnvío: pagado S/${d.cargoMP.toFixed(2)} | ML dice S/${d.cargoEnvioML.toFixed(2)}`);
  console.log(`  Delivery:   pagado S/${d.deliveryMP.toFixed(2)}`);
  console.log(`  Net sistema:   S/ ${d.netSistema.toFixed(2)}`);
  console.log(`  Net esperado:  S/ ${d.netEsperado.toFixed(2)}`);
  console.log(`  DISCREPANCIA:  S/ ${d.discrepancia.toFixed(2)}`);
  if (d.mercadoLibreId && d.totalML === 0) console.log(`  ➡ ML Order ID: ${d.mercadoLibreId} (NECESITA VINCULACIÓN)`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════════════════════════');
console.log('RESUMEN');
console.log('═══════════════════════════════════════════════════════════════════════════════════\n');
console.log(`Total discrepancia identificada:  S/ ${discTotal.toFixed(2)}`);
console.log(`Gap total (sistema - real):        S/ 321.50`);

const conSync = issues.filter(d => d.totalML > 0);
const sinSync = issues.filter(d => d.totalML === 0 && d.mercadoLibreId);
console.log(`\nCon sync (verificable):       ${conSync.length} ventas → disc S/ ${conSync.reduce((s, d) => s + d.discrepancia, 0).toFixed(2)}`);
console.log(`Sin sync (necesitan vincular): ${sinSync.length} ventas → necesitan revisión`);

if (sinSync.length > 0) {
  console.log(`\n── VENTAS QUE NECESITAN VINCULACIÓN ML ──`);
  for (const d of sinSync) {
    console.log(`  ${d.num} | mlOrderId: ${d.mercadoLibreId} | ingreso: S/${d.ingresoTotal.toFixed(2)} | ${d.metodoEnvio}`);
  }
}
