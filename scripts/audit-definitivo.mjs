/**
 * RECONCILIACIÓN DEFINITIVA - Movimiento por movimiento
 * Encontrar exactamente de dónde vienen los S/ 98.74
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 1816.15;

// Get ALL movements
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

// Get ML sync data for reference
const mlSyncs = await db.collection('mlOrderSync').get();
const syncByVenta = new Map();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.ventaId) {
    if (!syncByVenta.has(sd.ventaId)) syncByVenta.set(sd.ventaId, []);
    syncByVenta.get(sd.ventaId).push(sd);
  }
}

// Categorize ALL movements
const categories = {
  ingreso_ml_auto: { items: [], total: 0, label: 'Ingresos ML (auto-procesados)' },
  ingreso_adelanto: { items: [], total: 0, label: 'Ingresos adelantos/pagos manuales' },
  ingreso_ajuste: { items: [], total: 0, label: 'Ingresos ajuste' },
  egreso_comision: { items: [], total: 0, label: 'Egresos comisión ML' },
  egreso_cargo_envio: { items: [], total: 0, label: 'Egresos cargo envío ML' },
  egreso_delivery: { items: [], total: 0, label: 'Egresos delivery' },
  egreso_otro: { items: [], total: 0, label: 'Egresos otros gastos' },
  transferencia_out: { items: [], total: 0, label: 'Transferencias salientes' },
  transferencia_in: { items: [], total: 0, label: 'Transferencias entrantes' },
  otro: { items: [], total: 0, label: 'Otros' },
};

let saldoCalc = 0;

// Sort by date
const movList = [];
for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  movList.push({ id, d, esOrigen, esDestino });
}
movList.sort((a, b) => {
  const fa = a.d.fecha?.toDate?.() || new Date(0);
  const fb = b.d.fecha?.toDate?.() || new Date(0);
  return fa - fb;
});

for (const { id, d, esOrigen, esDestino } of movList) {
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  const tipo = d.tipo;
  const concepto = d.concepto || '';
  const ventaId = d.ventaId || '';
  const hasSyncProcesada = syncByVenta.has(ventaId) && syncByVenta.get(ventaId).some(s => s.estado === 'procesada');
  const hasSyncPendiente = syncByVenta.has(ventaId) && syncByVenta.get(ventaId).some(s => s.estado === 'pendiente');

  let cat = 'otro';
  let efecto = 0;

  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo) && esDestino) {
    efecto = +monto;
    if (concepto.includes('Ajuste')) cat = 'ingreso_ajuste';
    else if (hasSyncProcesada) cat = 'ingreso_ml_auto';
    else cat = 'ingreso_adelanto';
  } else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo) && esOrigen) {
    efecto = -monto;
    if (concepto.toLowerCase().includes('omisi')) cat = 'egreso_comision';
    else if (concepto.toLowerCase().includes('argo env')) cat = 'egreso_cargo_envio';
    else if (concepto.toLowerCase().includes('elivery') || concepto.toLowerCase().includes('entrega') || concepto.toLowerCase().includes('nv')) cat = 'egreso_delivery';
    else cat = 'egreso_otro';
  } else if (tipo === 'transferencia_interna') {
    if (esOrigen && !esDestino) { efecto = -monto; cat = 'transferencia_out'; }
    else if (esDestino && !esOrigen) { efecto = +monto; cat = 'transferencia_in'; }
  } else {
    // Fallback
    if (esDestino && !esOrigen) efecto = +monto;
    else if (esOrigen && !esDestino) efecto = -monto;
  }

  saldoCalc += efecto;
  categories[cat].items.push({ num: d.numeroMovimiento, monto, efecto, concepto: concepto.substring(0, 70) });
  categories[cat].total += efecto;
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('RECONCILIACIÓN DEFINITIVA MERCADOPAGO');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const [key, cat] of Object.entries(categories)) {
  if (cat.items.length === 0) continue;
  console.log(`── ${cat.label} (${cat.items.length} movimientos) ──`);
  for (const item of cat.items) {
    const sign = item.efecto >= 0 ? '+' : '';
    console.log(`  ${item.num} | ${sign}S/${item.efecto.toFixed(2)} | ${item.concepto}`);
  }
  const sign = cat.total >= 0 ? '+' : '';
  console.log(`  SUBTOTAL: ${sign}S/ ${cat.total.toFixed(2)}\n`);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('CUADRE GENERAL');
console.log('═══════════════════════════════════════════════════════════════\n');

let runningTotal = 0;
for (const [key, cat] of Object.entries(categories)) {
  if (cat.items.length === 0) continue;
  runningTotal += cat.total;
  const sign = cat.total >= 0 ? '+' : '';
  console.log(`${cat.label.padEnd(45)} ${sign}S/ ${cat.total.toFixed(2)}`);
}

console.log(`${'─'.repeat(60)}`);
console.log(`${'SALDO CALCULADO'.padEnd(45)} S/ ${saldoCalc.toFixed(2)}`);
console.log(`${'SALDO REAL MP'.padEnd(45)} S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`${'DIFERENCIA (sistema - real)'.padEnd(45)} S/ ${(saldoCalc - SALDO_REAL).toFixed(2)}`);

// Now simulate fixes
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('SIMULACIÓN POST-FIX');
console.log('═══════════════════════════════════════════════════════════════\n');

// Fix 1: Remove ajuste
const fix1 = categories.ingreso_ajuste.total; // Should be +65.10
console.log(`Fix 1 (anular ajuste Flex):           -S/ ${fix1.toFixed(2)}`);

// Fix 2+3: Already calculated
const fix2 = 55.21; // Inflated ingresos
const fix3 = 70.50; // Missing cargo_envio
const fix4 = 31.95; // VT-062 commission
console.log(`Fix 2 (reducir ingresos inflados):    -S/ ${fix2.toFixed(2)}`);
console.log(`Fix 3 (crear cargo_envio faltantes):   -S/ ${fix3.toFixed(2)}`);
console.log(`Fix 4 (comisión VT-062 pack):          -S/ ${fix4.toFixed(2)}`);

const totalFix = fix1 + fix2 + fix3 + fix4;
const postFix = saldoCalc - totalFix;
console.log(`\nSaldo post-fix:                        S/ ${postFix.toFixed(2)}`);
console.log(`Saldo real:                            S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`Residual:                              S/ ${(postFix - SALDO_REAL).toFixed(2)}`);

// Try to find what matches the residual
const residual = postFix - SALDO_REAL;
console.log(`\n── Buscando combinaciones que sumen ~S/ ${residual.toFixed(2)} ──`);

// Check: missing cargo_envio for pendiente Urbano orders
// VT-016: 6.95, VT-017: 7.45, VT-021: 4.17, VT-025: 4.17 = 22.74
console.log(`Missing cargo_envio pendiente Urbano: S/ 22.74`);
console.log(`Residual - 22.74 = S/ ${(residual - 22.74).toFixed(2)}`);

// Check: are there any Flex ventas where costoEnvioCliente was included in ingreso but ML didn't deposit it?
// For Flex adelanto ventas, the customer paid full amount including shipping
// But if costoEnvio is in totalPEN, the ingreso matches. ML doesn't deposit for these (already paid by customer)
// So no issue there.

// Check: COT-2026-014 (S/165.25) - has no ventaId, might be orphaned
console.log(`\nCOT-2026-014 sin ventaId: S/ 165.25 - verificar si esta cotización resultó en venta`);
