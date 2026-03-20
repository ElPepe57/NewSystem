/**
 * AUDITORÍA RESIDUAL S/ 98.74
 *
 * Contexto:
 *   - Después de correcciones planeadas, saldo movimientos = S/ 1,914.89
 *   - Saldo real MercadoPago = S/ 1,816.15
 *   - GAP RESIDUAL = S/ 98.74 (sistema tiene de MÁS)
 *
 * Objetivo: identificar exactamente qué genera ese exceso de S/ 98.74
 *
 * Ejecutar: GOOGLE_APPLICATION_CREDENTIALS=... node scripts/audit-residual-98.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;
const SALDO_MOVIMIENTOS_ESPERADO = 1914.89; // después de correcciones planeadas

function hr(title) {
  console.log('\n' + '═'.repeat(70));
  console.log('  ' + title);
  console.log('═'.repeat(70));
}

function fmt(n) { return (n >= 0 ? '+' : '') + n.toFixed(2); }
function fmtS(n) { return 'S/ ' + n.toFixed(2); }

hr('PASO 0: ESTADO ACTUAL DEL SISTEMA');

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
console.log(`saldoActual (campo):  ${fmtS(mpData.saldoActual)}`);
console.log(`saldoInicial:         ${fmtS(mpData.saldoInicial || 0)}`);

// ═══════════════════════════════════════════════════════════════════════════
// PASO 1: TODOS LOS MOVIMIENTOS — ingresos, egresos, transferencias
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 1: INVENTARIO COMPLETO DE MOVIMIENTOS');

const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esO: true, esD: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esD = true;
  else allMovs.set(m.id, { doc: m, esO: false, esD: true });
}

const tipoTotals = {};
let totalIngresos = 0, totalEgresos = 0, totalTransfIn = 0, totalTransfOut = 0;
let countActivos = 0, countAnulados = 0;

const ingresosDetail = [];
const egresosDetail = [];
const transferenciasDetail = [];

for (const [id, { doc, esO, esD }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') { countAnulados++; continue; }
  countActivos++;

  const monto = d.monto || 0;
  const tipo = d.tipo || 'desconocido';
  const concepto = (d.concepto || '').substring(0, 60);
  const num = d.numeroMovimiento || id.substring(0, 8);
  const fecha = d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '????-??-??';

  if (!tipoTotals[tipo]) tipoTotals[tipo] = { count: 0, total: 0, ingreso: 0, egreso: 0 };
  tipoTotals[tipo].count++;
  tipoTotals[tipo].total += monto;

  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo', 'conversion_venta'].includes(tipo)) {
    totalIngresos += monto;
    tipoTotals[tipo].ingreso += monto;
    ingresosDetail.push({ num, fecha, monto, tipo, concepto, ventaId: d.ventaId || null, ventaNum: d.ventaNumero || d.ventaId || null });
  } else if (['gasto_operativo', 'egreso', 'gasto', 'conversion_compra'].includes(tipo)) {
    totalEgresos += monto;
    tipoTotals[tipo].egreso += monto;
    egresosDetail.push({ num, fecha, monto, tipo, concepto, ventaId: d.ventaId || null });
  } else if (tipo === 'transferencia_interna') {
    if (esO && !esD) { totalTransfOut += monto; transferenciasDetail.push({ num, fecha, monto, dir: 'OUT', concepto }); }
    else if (esD && !esO) { totalTransfIn += monto; transferenciasDetail.push({ num, fecha, monto, dir: 'IN', concepto }); }
    else { /* same-account transferencia, ignore */ }
  } else {
    console.log(`  ⚠ TIPO DESCONOCIDO: ${tipo} | ${num} | S/${monto} | ${concepto}`);
  }
}

const saldoInicial = mpData.saldoInicial || 0;
const saldoCalculado = saldoInicial + totalIngresos + totalTransfIn - totalEgresos - totalTransfOut;

console.log(`\nMovimientos activos: ${countActivos} | Anulados: ${countAnulados}`);
console.log(`\nSaldo inicial:           ${fmtS(saldoInicial)}`);
console.log(`Total ingresos (+):      ${fmtS(totalIngresos)}`);
console.log(`Total transf. IN (+):    ${fmtS(totalTransfIn)}`);
console.log(`Total egresos (-):       ${fmtS(totalEgresos)}`);
console.log(`Total transf. OUT (-):   ${fmtS(totalTransfOut)}`);
console.log(`── Saldo calculado:      ${fmtS(saldoCalculado)}`);
console.log(`── saldoActual sistema:  ${fmtS(mpData.saldoActual)}`);
console.log(`── DRIFT campo vs calc:  ${fmtS(mpData.saldoActual - saldoCalculado)}`);
console.log(`\nComparando vs objetivo post-correcciones:`);
console.log(`   Calculado ahora:      ${fmtS(saldoCalculado)}`);
console.log(`   Esperado post-fix:    ${fmtS(SALDO_MOVIMIENTOS_ESPERADO)}`);
console.log(`   Diff (extra en calc): ${fmtS(saldoCalculado - SALDO_MOVIMIENTOS_ESPERADO)}`);
console.log(`\nGAP vs real:            ${fmtS(saldoCalculado - SALDO_REAL)}`);

console.log('\n── DESGLOSE POR TIPO ──');
for (const [tipo, { count, total }] of Object.entries(tipoTotals).sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${tipo.padEnd(25)} ${String(count).padStart(3)} movs  ${fmtS(total)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 2: INGRESOS — listado completo con clasificación
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 2: TODOS LOS INGRESOS A MP');

// Load ML venta IDs — only 'procesada' syncs for auditing comisions/envio
// NOTE: Multiple sync docs can map to same ventaId (e.g. old ml-pack docs + newer ones).
// Prefer the sync with HIGHEST totalML to avoid using outdated/partial pack docs.
const mlSyncsAll = await db.collection('mlOrderSync').get();
const mlVentaIds = new Set();
const syncByVentaId = {};
for (const s of mlSyncsAll.docs) {
  const sd = s.data();
  if (sd.ventaId) mlVentaIds.add(sd.ventaId); // all syncs for classification
  if (sd.ventaId && sd.estado === 'procesada') {
    // Keep the sync with the highest totalML for each ventaId (avoids stale ml-pack docs)
    const existing = syncByVentaId[sd.ventaId];
    if (!existing || (sd.totalML || 0) > (existing.totalML || 0)) {
      syncByVentaId[sd.ventaId] = sd;
    }
  }
}
const mlSyncs = mlSyncsAll; // keep for other uses

// Classify ingresos
let totalIngML = 0, totalIngAnticipo = 0, totalIngOtros = 0;
const ingresosML = [], ingresosAnticipo = [], ingresosOtros = [];

for (const i of ingresosDetail) {
  if (i.ventaId && mlVentaIds.has(i.ventaId)) {
    totalIngML += i.monto;
    ingresosML.push(i);
  } else if (i.tipo === 'ingreso_anticipo') {
    totalIngAnticipo += i.monto;
    ingresosAnticipo.push(i);
  } else {
    totalIngOtros += i.monto;
    ingresosOtros.push(i);
  }
}

console.log(`\nIngresos ML (ventas procesadas):  ${fmtS(totalIngML)} (${ingresosML.length} movs)`);
console.log(`Ingresos anticipo/cotización:     ${fmtS(totalIngAnticipo)} (${ingresosAnticipo.length} movs)`);
console.log(`Ingresos otros (non-ML, non-ant): ${fmtS(totalIngOtros)} (${ingresosOtros.length} movs)`);

if (ingresosAnticipo.length > 0) {
  console.log('\n── ANTICIPOS (¿llegó el dinero a MP?) ──');
  for (const i of ingresosAnticipo) {
    console.log(`  ${i.num} | ${i.fecha} | ${fmtS(i.monto)} | ${i.concepto}`);
    if (i.ventaNum) console.log(`    → Venta/Cotización: ${i.ventaNum}`);
  }
}

if (ingresosOtros.length > 0) {
  console.log('\n── OTROS INGRESOS NON-ML ──');
  for (const i of ingresosOtros) {
    console.log(`  ${i.num} | ${i.fecha} | ${fmtS(i.monto)} | ${i.tipo} | ${i.concepto}`);
    if (i.ventaNum) console.log(`    → Venta: ${i.ventaNum}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 3: EGRESOS — listado completo
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 3: TODOS LOS EGRESOS DESDE MP');

console.log(`\nTotal egresos: ${fmtS(totalEgresos)} en ${egresosDetail.length} movimientos\n`);
for (const e of egresosDetail.sort((a, b) => b.monto - a.monto)) {
  const mlTag = e.ventaId && mlVentaIds.has(e.ventaId) ? ' [ML]' : '';
  console.log(`  ${e.num} | ${e.fecha} | -${fmtS(e.monto)} | ${e.tipo}${mlTag} | ${e.concepto}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 4: TRANSFERENCIAS
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 4: TRANSFERENCIAS INTERNAS');

console.log(`\nTransferencias IN:  +${fmtS(totalTransfIn)}`);
console.log(`Transferencias OUT: -${fmtS(totalTransfOut)}\n`);
for (const t of transferenciasDetail) {
  const signo = t.dir === 'IN' ? '+' : '-';
  console.log(`  ${t.num} | ${t.fecha} | ${signo}${fmtS(t.monto)} | ${t.concepto}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 5: AUDITORÍA ML — comisiones y envíos
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 5: AUDITORÍA COMISIONES Y ENVÍOS ML');

// Load all ML ventas — canal field stores canalVentaId (not a string 'mercadolibre')
// ML canal ID = 'dDmpSMch8PU6sTwFYftZ' (CV-002 Mercado Libre)
const ML_CANAL_ID = 'dDmpSMch8PU6sTwFYftZ';
const ventasMLSnap = await db.collection('ventas').where('canal', '==', ML_CANAL_ID).get();
const mlVentas = ventasMLSnap.docs;

// Load movimientos grouped by ventaId
const movsByVentaId = {};
for (const [id, { doc, esO, esD }] of allMovs) {
  const d = doc.data();
  const vid = d.ventaId;
  if (!vid) continue;
  if (!movsByVentaId[vid]) movsByVentaId[vid] = [];
  if (!movsByVentaId[vid].some(x => x.id === id)) {
    movsByVentaId[vid].push({ id, esO, esD, ...d });
  }
}

let totalComisionEsperada = 0;
let totalComisionMovimiento = 0;
let totalComisionGasto = 0;
let totalCargoEnvioEsperado = 0;
let totalCargoEnvioMovimiento = 0;
let totalDepositoEsperado = 0;
let totalNetoMovimientos = 0;
let problemasML = [];

for (const ventaDoc of mlVentas) {
  const vd = ventaDoc.data();
  const ventaId = ventaDoc.id;
  const numVenta = vd.numeroVenta || '?';

  // Sync data
  const sync = syncByVentaId[ventaId];
  if (!sync) continue; // solo auditar ventas con sync

  const totalML = sync.totalML || vd.totalPEN || 0;
  const comML = sync.comisionML || vd.comisionML || 0;
  const costoEnvCli = sync.costoEnvioCliente || vd.costoEnvio || 0;
  const cargoEnvML = sync.cargoEnvioML || vd.cargoEnvioML || 0;
  const met = sync.metodoEnvio || vd.metodoEnvio || '?';

  // Depósito esperado de ML
  let depositoML;
  if (met === 'urbano') {
    depositoML = totalML - comML - cargoEnvML;
  } else {
    depositoML = totalML + costoEnvCli - comML;
  }
  totalDepositoEsperado += depositoML;
  totalComisionEsperada += comML;
  if (met === 'urbano') totalCargoEnvioEsperado += cargoEnvML;

  // Movimientos registrados
  const movs = movsByVentaId[ventaId] || [];
  let ingMP = 0, gasComMov = 0, gasEnvMov = 0;
  for (const mov of movs) {
    if (mov.estado === 'anulado') continue;
    const c = mov.concepto || '';
    if (mov.tipo === 'ingreso_venta' && mov.cuentaDestino === mpId) {
      ingMP += mov.monto || 0;
    }
    if (mov.tipo === 'gasto_operativo' && mov.esO && !mov.esD) {
      if (c.includes('Entrega') || c.includes('envío') || c.includes('Cargo envío') || c.includes('Urbano')) {
        gasEnvMov += mov.monto || 0;
      } else {
        gasComMov += mov.monto || 0;
      }
    }
  }

  // Gastos en colección gastos
  const gastoComSnap = await db.collection('gastos').where('ventaId', '==', ventaId).where('tipo', '==', 'comision_ml').get();
  let gasComGasto = 0;
  for (const g of gastoComSnap.docs) { if (g.data().estado !== 'anulado') gasComGasto += g.data().montoPEN || 0; }

  const gastoEnvSnap = await db.collection('gastos').where('ventaId', '==', ventaId).where('tipo', '==', 'cargo_envio_ml').get();
  let gasEnvGasto = 0;
  for (const g of gastoEnvSnap.docs) { if (g.data().estado !== 'anulado') gasEnvGasto += g.data().montoPEN || 0; }

  totalComisionMovimiento += gasComMov;
  totalComisionGasto += gasComGasto;
  totalCargoEnvioMovimiento += gasEnvMov;

  const netoMov = ingMP - gasComMov - gasEnvMov;
  totalNetoMovimientos += netoMov;

  const diff = netoMov - depositoML;
  const issues = [];

  // Issue 1: comisión esperada pero sin gasto registrado
  if (comML > 0 && gasComGasto === 0) issues.push(`COM_NO_REGISTRADA: ML=${comML.toFixed(2)}`);

  // Issue 2: comisión registrada en gasto pero sin movimiento de tesorería
  if (gasComGasto > 0 && gasComMov === 0) issues.push(`COM_SIN_MOV_TESORERIA: gasto=${gasComGasto.toFixed(2)}`);

  // Issue 3: comisión difiere entre sync y gasto
  if (gasComGasto > 0 && Math.abs(comML - gasComGasto) > 0.02) {
    issues.push(`COM_DIFF: sync=${comML.toFixed(2)} gasto=${gasComGasto.toFixed(2)} diff=${fmt(gasComGasto - comML)}`);
  }

  // Issue 4: cargo envío Urbano sin movimiento
  if (met === 'urbano' && cargoEnvML > 0 && gasEnvMov === 0) {
    issues.push(`CARGO_ENVIO_SIN_MOV: cargoML=${cargoEnvML.toFixed(2)} gastoDoc=${gasEnvGasto.toFixed(2)}`);
  }

  // Issue 5: ingreso inflado (incluye costoEnvio en Urbano)
  if (met === 'urbano' && ingMP > totalML + 0.01) {
    issues.push(`INGRESO_INFLADO: ingMP=${ingMP.toFixed(2)} totalML=${totalML.toFixed(2)} exceso=${fmt(ingMP - totalML)}`);
  }

  // Issue 6: Flex - ingreso debería incluir costoEnvio del cliente
  if (met === 'flex' && ingMP > 0) {
    const expectedFlex = totalML + costoEnvCli;
    if (Math.abs(ingMP - expectedFlex) > 0.01) {
      issues.push(`FLEX_INGRESO_DIFF: ingMP=${ingMP.toFixed(2)} esperado=${expectedFlex.toFixed(2)} diff=${fmt(ingMP - expectedFlex)}`);
    }
  }

  // Issue 7: diferencia general no explicada
  if (Math.abs(diff) > 0.02 && issues.length === 0) {
    issues.push(`DIFF_GENERAL: neto=${netoMov.toFixed(2)} depósito=${depositoML.toFixed(2)} diff=${fmt(diff)}`);
  }

  if (issues.length > 0 || Math.abs(diff) > 0.02) {
    problemasML.push({
      numVenta, ventaId, met, totalML, comML, costoEnvCli, cargoEnvML,
      depositoML, ingMP, gasComMov, gasEnvMov, gasComGasto, gasEnvGasto,
      netoMov, diff, issues,
    });
  }
}

console.log(`\nVentas ML con sync: ${Object.keys(syncByVentaId).length}`);
console.log(`Ventas ML analizadas: ${mlVentas.length}`);
console.log(`\nTotales ML esperados:`);
console.log(`  Depósito esperado total:  ${fmtS(totalDepositoEsperado)}`);
console.log(`  Neto en movimientos:      ${fmtS(totalNetoMovimientos)}`);
console.log(`  DIFF (movs - esperado):   ${fmtS(totalNetoMovimientos - totalDepositoEsperado)}`);
console.log(`\nComisiones:`);
console.log(`  Esperada (sync):          ${fmtS(totalComisionEsperada)}`);
console.log(`  Registrada (gastos doc):  ${fmtS(totalComisionGasto)}`);
console.log(`  En movimientos tesorería: ${fmtS(totalComisionMovimiento)}`);
console.log(`  FALTANTE (esperada-gasto): ${fmtS(totalComisionEsperada - totalComisionGasto)}`);
console.log(`  FALTANTE (gasto-mov):      ${fmtS(totalComisionGasto - totalComisionMovimiento)}`);
console.log(`\nCargo Envío Urbano:`);
console.log(`  Esperado (sync):          ${fmtS(totalCargoEnvioEsperado)}`);
console.log(`  En movimientos:           ${fmtS(totalCargoEnvioMovimiento)}`);
console.log(`  FALTANTE:                 ${fmtS(totalCargoEnvioEsperado - totalCargoEnvioMovimiento)}`);

if (problemasML.length > 0) {
  console.log(`\n── VENTAS ML CON DISCREPANCIAS (${problemasML.length}) ──`);
  for (const p of problemasML.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))) {
    console.log(`\n  ${p.numVenta} | ${p.met} | ML=${fmtS(p.totalML)} | com=${fmtS(p.comML)}`);
    if (p.met === 'urbano') {
      console.log(`    cargoEnvML=${fmtS(p.cargoEnvML)} | depósito esperado=${fmtS(p.depositoML)}`);
    } else {
      console.log(`    envCli=${fmtS(p.costoEnvCli)} | depósito esperado=${fmtS(p.depositoML)}`);
    }
    console.log(`    Movimientos: ing=${fmtS(p.ingMP)} gastosCom=-${fmtS(p.gasComMov)} gastosEnv=-${fmtS(p.gasEnvMov)} neto=${fmtS(p.netoMov)}`);
    console.log(`    Gastos docs: com=${fmtS(p.gasComGasto)} env=${fmtS(p.gasEnvGasto)}`);
    console.log(`    DIFF vs depósito: ${fmt(p.diff)}`);
    for (const issue of p.issues) {
      console.log(`    ⚠ ${issue}`);
    }
  }
} else {
  console.log('\n✅ Todas las ventas ML con sync cuadran correctamente');
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 6: VENTAS ML SIN SYNC — ¿hay comisiones no capturadas?
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 6: VENTAS ML SIN mlOrderSync');

let ventasSinSync = [];
for (const ventaDoc of mlVentas) {
  const vd = ventaDoc.data();
  const ventaId = ventaDoc.id;
  if (mlVentaIds.has(ventaId)) continue; // tiene sync

  const movs = movsByVentaId[ventaId] || [];
  let ingMP = 0;
  for (const mov of movs) {
    if (mov.estado !== 'anulado' && mov.tipo === 'ingreso_venta' && mov.cuentaDestino === mpId) {
      ingMP += mov.monto || 0;
    }
  }

  ventasSinSync.push({
    num: vd.numeroVenta,
    totalPEN: vd.totalPEN || 0,
    comisionML: vd.comisionML || 0,
    cargoEnvioML: vd.cargoEnvioML || 0,
    metodoEnvio: vd.metodoEnvio || '?',
    ingMP,
    estadoPago: vd.estadoPago,
  });
}

console.log(`\nVentas ML sin sync: ${ventasSinSync.length}`);
let totalComSinSync = 0;
for (const v of ventasSinSync) {
  totalComSinSync += v.comisionML || 0;
  console.log(`  ${v.num} | ${v.metodoEnvio} | totalPEN=${fmtS(v.totalPEN)} | comML=${fmtS(v.comisionML)} | cargoEnv=${fmtS(v.cargoEnvioML)} | ingMP=${fmtS(v.ingMP)}`);
}
console.log(`\nComisiones en ventas sin sync: ${fmtS(totalComSinSync)}`);

// ═══════════════════════════════════════════════════════════════════════════
// PASO 7: ANTICIPOS / COTIZACIONES — ¿llegó el dinero?
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 7: ANTICIPOS EN MP — ¿dinero realmente ingresado?');

console.log(`\nAnticios registrados en movimientos MP: ${ingresosAnticipo.length}`);
let totalAnticiposRiesgo = 0;
for (const i of ingresosAnticipo) {
  console.log(`  ${i.num} | ${i.fecha} | ${fmtS(i.monto)} | ${i.concepto}`);
  // Check if linked to a cotizacion/requerimiento
  if (i.ventaNum) console.log(`    → ${i.ventaNum}`);
  totalAnticiposRiesgo += i.monto;
}
if (ingresosAnticipo.length === 0) {
  console.log('  (ninguno)');
}
console.log(`\nTotal anticipos: ${fmtS(totalAnticiposRiesgo)}`);
console.log('→ Si algún anticipo fue registrado pero el dinero no llegó realmente a MP,');
console.log('  eso explicaría parte del gap.');

// ═══════════════════════════════════════════════════════════════════════════
// PASO 8: GASTOS PAGADOS DESDE MP SIN MOVIMIENTO DE TESORERÍA
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 8: GASTOS PAGADOS DESDE MP SIN MOVIMIENTO (saldo decrementado sin registro)');

// Load all paid gastos with MP payments
const gastosPagadosSnap = await db.collection('gastos').where('estado', '==', 'pagado').get();
let gastosSinMov = [];
let totalGastosSinMov = 0;

// Build set of gastoIds that have active movements from MP
const movGastoIds = new Set();
for (const [id, { doc, esO }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  if (!esO) continue;
  if (d.gastoId) movGastoIds.add(d.gastoId);
  if (d.gastoNumero) movGastoIds.add(d.gastoNumero);
}

for (const g of gastosPagadosSnap.docs) {
  const gd = g.data();
  const pagos = gd.pagos || [];
  if (!Array.isArray(pagos)) continue;

  let mpPago = 0;
  for (const p of pagos) {
    if (p.cuentaOrigenId === mpId || p.metodoPago === 'mercado_pago') {
      mpPago += p.montoPEN || p.montoOriginal || gd.montoPEN || 0;
    }
  }
  if (mpPago === 0) continue;

  // Check if there's a movement for this gasto
  if (movGastoIds.has(g.id) || movGastoIds.has(gd.numeroGasto)) continue;

  // Also search by gastoId directly
  const movQ = await db.collection('movimientosTesoreria').where('gastoId', '==', g.id).get();
  let tieneMovActivo = false;
  for (const m of movQ.docs) {
    if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) { tieneMovActivo = true; break; }
  }
  if (!tieneMovActivo && gd.numeroGasto) {
    const movQ2 = await db.collection('movimientosTesoreria').where('gastoNumero', '==', gd.numeroGasto).get();
    for (const m of movQ2.docs) {
      if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) { tieneMovActivo = true; break; }
    }
  }
  if (tieneMovActivo) continue;

  totalGastosSinMov += mpPago;
  gastosSinMov.push({
    id: g.id,
    num: gd.numeroGasto || '?',
    monto: mpPago,
    desc: (gd.descripcion || gd.concepto || '').substring(0, 60),
    ventaId: gd.ventaId || null,
    ventaNum: gd.ventaNumero || null,
    tipo: gd.tipo || '?',
  });
}

console.log(`\nGastos pagados desde MP SIN movimiento de tesorería: ${gastosSinMov.length}`);
if (gastosSinMov.length > 0) {
  for (const g of gastosSinMov.sort((a, b) => b.monto - a.monto)) {
    console.log(`  ${g.num} | ${g.tipo} | -${fmtS(g.monto)} | ${g.desc}`);
    if (g.ventaNum) console.log(`    → Venta: ${g.ventaNum}`);
  }
  console.log(`\n  Total gastos sin mov: -${fmtS(totalGastosSinMov)}`);
  console.log('  → Estos decrementaron saldoActual vía gasto.pagos pero NO tienen movimiento');
  console.log('    de tesorería → movimientos-based saldo está INFLADO por este monto');
} else {
  console.log('  ✅ Todos los gastos pagados desde MP tienen movimiento de tesorería');
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 9: INGRESOS CON MONTOS INCORRECTOS
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 9: VERIFICAR MONTOS DE INGRESOS ML (posibles inflados)');

let totalIngresosInflados = 0;
let countInflados = 0;

for (const ventaDoc of mlVentas) {
  const vd = ventaDoc.data();
  const ventaId = ventaDoc.id;
  const sync = syncByVentaId[ventaId];
  if (!sync) continue;

  const totalML = sync.totalML || 0;
  const met = sync.metodoEnvio || '?';
  const costoEnvCli = sync.costoEnvioCliente || 0;
  const cargoEnvML = sync.cargoEnvioML || 0;

  // Expected ingreso amount
  let ingresoEsperado;
  if (met === 'urbano') {
    ingresoEsperado = totalML; // Para urbano, ingreso = totalML (sin costo envio del cliente)
  } else {
    ingresoEsperado = totalML + costoEnvCli; // Para flex, ingreso incluye costo envío
  }

  const movs = movsByVentaId[ventaId] || [];
  let ingMP = 0;
  for (const mov of movs) {
    if (mov.estado !== 'anulado' && mov.tipo === 'ingreso_venta' && mov.cuentaDestino === mpId) {
      ingMP += mov.monto || 0;
    }
  }

  if (ingMP === 0) continue; // sin ingreso registrado

  const excess = ingMP - ingresoEsperado;
  if (excess > 0.02) {
    totalIngresosInflados += excess;
    countInflados++;
    console.log(`  ${vd.numeroVenta} | ${met} | ingMP=${fmtS(ingMP)} esperado=${fmtS(ingresoEsperado)} EXCESO=+${fmtS(excess)}`);
    console.log(`    (ML: totalML=${totalML} costoEnvCli=${costoEnvCli} cargoEnvML=${cargoEnvML})`);
  }
}

if (countInflados === 0) {
  console.log('  ✅ No se detectaron ingresos ML inflados');
} else {
  console.log(`\n  Total ingresos inflados: +${fmtS(totalIngresosInflados)} en ${countInflados} ventas`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 10: MOVIMIENTOS SIN VENTAID (gastos sueltos de MP)
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 10: MOVIMIENTOS-EGRESO DE MP SIN ventaId');

let totalEgresosSinVenta = 0;
for (const e of egresosDetail) {
  if (!e.ventaId) {
    totalEgresosSinVenta += e.monto;
    console.log(`  ${e.num} | ${e.fecha} | -${fmtS(e.monto)} | ${e.tipo} | ${e.concepto}`);
  }
}
if (totalEgresosSinVenta === 0) {
  console.log('  (ninguno)');
}
console.log(`\nTotal egresos sin ventaId: ${fmtS(totalEgresosSinVenta)}`);

// ═══════════════════════════════════════════════════════════════════════════
// PASO 11: TODAS LAS VENTAS NON-ML CON PAGO MP — ¿ingresos válidos?
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 11: VENTAS NON-ML PAGADAS POR MP — ¿son ingreso real?');

// All ventas that have payments to MP but are NOT ML canal
const allVentasSnap = await db.collection('ventas').get();
let ingresosNonML = [];

for (const ventaDoc of allVentasSnap.docs) {
  const vd = ventaDoc.data();
  const ventaId = ventaDoc.id;
  const canal = vd.canal || '';

  // Skip ML ventas (canal stores canalVentaId, ML canal = ML_CANAL_ID)
  if (canal === ML_CANAL_ID) continue;

  // Check if has pagos with MP
  const pagos = vd.pagos || [];
  const mpPagos = pagos.filter(p => p.metodoPago === 'mercado_pago' || p.cuentaId === mpId);
  if (mpPagos.length === 0) continue;

  const totalMPPago = mpPagos.reduce((s, p) => s + (p.monto || p.montoPEN || 0), 0);

  // Check movements
  const movs = movsByVentaId[ventaId] || [];
  let ingMovMp = 0;
  for (const mov of movs) {
    if (mov.estado !== 'anulado' && mov.tipo === 'ingreso_venta' && mov.cuentaDestino === mpId) {
      ingMovMp += mov.monto || 0;
    }
  }

  ingresosNonML.push({
    num: vd.numeroVenta,
    canal,
    totalPEN: vd.totalPEN || 0,
    mpPago: totalMPPago,
    ingMovMp,
    estadoPago: vd.estadoPago,
  });
}

console.log(`\nVentas non-ML con pago MP: ${ingresosNonML.length}`);
for (const v of ingresosNonML) {
  const diffTag = Math.abs(v.mpPago - v.ingMovMp) > 0.01 ? ` ← DIFF mov=${fmtS(v.ingMovMp)}` : '';
  console.log(`  ${v.num} | ${v.canal || 'manual'} | totalPEN=${fmtS(v.totalPEN)} | mpPago=${fmtS(v.mpPago)} | est=${v.estadoPago}${diffTag}`);
}
if (ingresosNonML.length === 0) {
  console.log('  (ninguna)');
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 12: VT-2026-062 PACK — comisión sub-order 2 faltante
// ═══════════════════════════════════════════════════════════════════════════
hr('PASO 12: VT-2026-062 PACK — ¿comisión sub-order 2 registrada?');

const sync062snap = await db.collection('mlOrderSync').where('ventaId', '==', 'oT62lh9MR8RWM7dg9DCc').get();
let com062sub1 = 0, com062sub2 = 0;
let sub2Estado = '';
for (const s of sync062snap.docs) {
  const sd = s.data();
  if (sd.mlOrderId === '2000015447990598') {
    com062sub1 = sd.comisionML || 0;
    console.log(`  Sub-order 1 (${sd.mlOrderId}): totalML=${sd.totalML} com=${sd.comisionML} estado=${sd.estado}`);
  } else if (sd.mlOrderId === '2000015447992492') {
    com062sub2 = sd.comisionML || 0;
    sub2Estado = sd.estado;
    console.log(`  Sub-order 2 (${sd.mlOrderId}): totalML=${sd.totalML} com=${sd.comisionML} estado=${sd.estado}`);
    console.log(`    → estado=ignorada means sub-order merged but its comisión (${sd.comisionML}) may not be registered`);
  }
}
const gastoCom062Snap = await db.collection('gastos').where('ventaId', '==', 'oT62lh9MR8RWM7dg9DCc').where('tipo', '==', 'comision_ml').get();
let gasCom062 = 0;
for (const g of gastoCom062Snap.docs) { if (g.data().estado !== 'anulado') gasCom062 += g.data().montoPEN || 0; }
console.log(`\n  Total comisión ML registrada en gastos: ${fmtS(gasCom062)}`);
console.log(`  Sub-order 1 com: ${fmtS(com062sub1)}`);
console.log(`  Sub-order 2 com: ${fmtS(com062sub2)} (${sub2Estado} — ¿se registró?)`);
console.log(`  TOTAL DEBERÍA SER: ${fmtS(com062sub1 + com062sub2)}`);
const com062Faltante = (com062sub1 + com062sub2) - gasCom062;
if (com062Faltante > 0.01) {
  console.log(`  ⚠ COMISION FALTANTE VT-2026-062: ${fmtS(com062Faltante)} (sub-order 2 no registrada)`);
} else {
  console.log(`  ✅ Comisión VT-2026-062 registrada correctamente`);
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN FINAL — RECONCILIACIÓN COMPLETA
// ═══════════════════════════════════════════════════════════════════════════
hr('RESUMEN FINAL — RECONCILIACIÓN COMPLETA');

const gapTotal = saldoCalculado - SALDO_REAL;
console.log(`\nESTADO ACTUAL:`);
console.log(`  Movimientos → saldo:     ${fmtS(saldoCalculado)}`);
console.log(`  saldoActual (campo):     ${fmtS(mpData.saldoActual)}`);
console.log(`  Saldo real MercadoPago:  ${fmtS(SALDO_REAL)}`);
console.log(`  DRIFT campo vs movs:     ${fmtS(mpData.saldoActual - saldoCalculado)}`);
console.log(`  GAP movs vs real:        ${fmtS(gapTotal)}`);

console.log(`\nCORRECCIONES PLANEADAS (llevan movimientos a ${fmtS(SALDO_MOVIMIENTOS_ESPERADO)}):`);
const corrPlaneadas = saldoCalculado - SALDO_MOVIMIENTOS_ESPERADO;
console.log(`  Total a remover: ${fmtS(corrPlaneadas)}`);
console.log(`  Conocidas: MOV-2026-0088 ajuste flex -65.10`);
console.log(`  Resto (${fmtS(corrPlaneadas - 65.10)}): ver análisis de problemas ML debajo`);

console.log(`\n── PROBLEMAS ML ENCONTRADOS ──`);
console.log(`(Estos son los que conforman las correcciones planeadas + el residual S/98.74)`);

// A. Urbano ventas infladas (ingreso registrado = totalML + cargoEnvML en lugar de solo totalML)
// The excess per venta = (ingreso alto) + (falta egreso) = 2 × cargoEnvML
let totalUrbanInfol = 0;
const ventasInfladas = problemasML.filter(p => p.issues.some(i => i.startsWith('INGRESO_INFLADO')));
console.log(`\n  A) Urbano con INGRESO INFLADO (ingMP = totalML + cargoEnvML, debería = totalML):`);
console.log(`     El exceso neto por venta = 2 × cargoEnvML (ingreso alto + falta egreso)`);
for (const p of ventasInfladas) {
  const exceso = 2 * p.cargoEnvML;
  totalUrbanInfol += exceso;
  console.log(`     ${p.numVenta}: cargoEnvML=${fmtS(p.cargoEnvML)} → exceso en sistema: +${fmtS(exceso)}`);
}
console.log(`     SUBTOTAL A: +${fmtS(totalUrbanInfol)}`);

// B. Urbano ventas con ingreso correcto pero falta egreso cargo_envio
let totalUrbanFaltaEgr = 0;
const ventasFaltaEgr = problemasML.filter(p => p.issues.some(i => i.startsWith('CARGO_ENVIO_SIN_MOV')) && !p.issues.some(i => i.startsWith('INGRESO_INFLADO')));
console.log(`\n  B) Urbano con ingreso CORRECTO (ingMP = totalML) pero FALTA egreso cargoEnvio:`);
for (const p of ventasFaltaEgr) {
  totalUrbanFaltaEgr += p.cargoEnvML;
  console.log(`     ${p.numVenta}: falta egreso -${fmtS(p.cargoEnvML)}`);
}
console.log(`     SUBTOTAL B: +${fmtS(totalUrbanFaltaEgr)} (sistema más alto por egresos faltantes)`);

// C. VT-2026-062 comision sub-order 2
console.log(`\n  C) VT-2026-062 Pack: comisión sub-order 2 faltante:`);
console.log(`     +${fmtS(com062Faltante)} (comision ML sub-order 2000015447992492 no registrada)`);

// D. Ajuste Flex artificial
console.log(`\n  D) MOV-2026-0088 Ajuste Flex artificial: +S/65.10`);

const totalUrbanAll = totalUrbanInfol + totalUrbanFaltaEgr;
const totalTodoProblemas = totalUrbanAll + com062Faltante + 65.10;
console.log(`\n── SUMA DE TODOS LOS PROBLEMAS ENCONTRADOS ──`);
console.log(`  A) Urbano inflados:       +${fmtS(totalUrbanInfol)}`);
console.log(`  B) Urbano falta egreso:   +${fmtS(totalUrbanFaltaEgr)}`);
console.log(`  C) VT-2026-062 com sub2:  +${fmtS(com062Faltante)}`);
console.log(`  D) Ajuste Flex artificial: +S/65.10`);
console.log(`  ─────────────────────────────────────`);
console.log(`  TOTAL:                    +${fmtS(totalTodoProblemas)}`);
console.log(`  GAP real (movs vs MP):    +${fmtS(gapTotal)}`);
console.log(`  SIN EXPLICAR:             ${fmtS(gapTotal - totalTodoProblemas)}`);

console.log(`\n── DISTRIBUCIÓN ENTRE CORRECCIONES PLANEADAS Y RESIDUAL ──`);
console.log(`  Correcciones planeadas (llegan a 1914.89): -${fmtS(corrPlaneadas)}`);
console.log(`  Residual S/98.74 = A + B + C = ${fmtS(totalUrbanAll + com062Faltante)}`);
console.log(`  (D) Ajuste Flex ya en planeadas: -65.10`);

console.log(`\n── ACCIONES CORRECTIVAS PARA EL RESIDUAL ──`);
console.log(`  1. URBANO INFLADOS (${ventasInfladas.length} ventas): Corregir ingreso bajando a totalML (reducir por cargoEnvML)`);
console.log(`     Y crear egreso cargo_envio_ml para cada una`);
console.log(`     Impacto total: -${fmtS(totalUrbanInfol)} (reducción ingreso + nuevo egreso)`);
console.log(`     Ventas: ` + ventasInfladas.map(p => p.numVenta).join(', '));
console.log(`\n  2. URBANO SIN EGRESO (${ventasFaltaEgr.length} ventas): Crear egreso cargo_envio_ml faltante`);
console.log(`     Total egresos a crear: -${fmtS(totalUrbanFaltaEgr)}`);
console.log(`     Ventas: ` + ventasFaltaEgr.map(p => p.numVenta).join(', '));
if (com062Faltante > 0.01) {
  console.log(`\n  3. VT-2026-062: Crear gasto comisión sub-order 2 por -${fmtS(com062Faltante)}`);
  console.log(`     (ML order 2000015447992492, com=${fmtS(com062Faltante)})`);
}

console.log('\n' + '═'.repeat(70));
console.log('FIN DE AUDITORÍA RESIDUAL');
console.log('═'.repeat(70) + '\n');
