/**
 * Exhaustive MP audit — trace every single discrepancy
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// ═══════════════════════════════════════════════
// PART 1: Reconstruct saldoActual drift history
// ═══════════════════════════════════════════════
console.log('═══════════════════════════════════════════════');
console.log('PART 1: ANÁLISIS DE MOVIMIENTOS ANULADOS');
console.log('═══════════════════════════════════════════════\n');

const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const all = new Map();
for (const m of movsO.docs) all.set(m.id, { doc: m, esO: true, esD: false });
for (const m of movsD.docs) {
  if (all.has(m.id)) all.get(m.id).esD = true;
  else all.set(m.id, { doc: m, esO: false, esD: true });
}

const anulados = [];
for (const [id, { doc }] of all) {
  const d = doc.data();
  if (d.estado === 'anulado') {
    anulados.push({
      id,
      num: d.numeroMovimiento,
      tipo: d.tipo,
      monto: d.monto || 0,
      concepto: d.concepto || '',
      ventaNumero: d.ventaNumero || '',
      fecha: d.fecha?.toDate?.(),
      fechaAnulacion: d.fechaAnulacion?.toDate?.(),
      anuladoPor: d.anuladoPor || '?',
    });
  }
}

console.log(`Movimientos anulados encontrados: ${anulados.length}\n`);
for (const a of anulados) {
  console.log(`  ${a.num}`);
  console.log(`    Tipo: ${a.tipo} | Monto: S/ ${a.monto}`);
  console.log(`    Concepto: ${a.concepto}`);
  console.log(`    Venta: ${a.ventaNumero}`);
  console.log(`    Fecha original: ${a.fecha?.toISOString?.()?.substring(0, 16)}`);
  console.log(`    Fecha anulación: ${a.fechaAnulacion?.toISOString?.()?.substring(0, 16)}`);
  console.log(`    Anulado por: ${a.anuladoPor}`);
  console.log('');
}

// When eliminarMovimiento runs, it:
// 1. Calls actualizarSaldoCuenta with reversal
// 2. Marks as anulado
// So for each anulado ingreso, saldo was decremented by monto
// For each anulado egreso, saldo was incremented by monto
let saldoRevertido = 0;
for (const a of anulados) {
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(a.tipo)) {
    saldoRevertido -= a.monto; // eliminarMovimiento decrements for ingreso
  } else if (['gasto_operativo', 'egreso'].includes(a.tipo)) {
    saldoRevertido += a.monto;
  }
}
console.log(`Total saldo revertido por anulaciones: S/ ${saldoRevertido.toFixed(2)}`);

// ═══════════════════════════════════════════════
// PART 2: ML Webhook Orders — detailed reconciliation
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('PART 2: RECONCILIACIÓN ML DETALLADA');
console.log('═══════════════════════════════════════════════\n');

const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
let mlExceso = 0;

for (const s of mlSyncs.docs) {
  const sd = s.data();
  const ventaDoc = await db.collection('ventas').doc(sd.ventaId).get();
  if (!ventaDoc.exists) continue;
  const vd = ventaDoc.data();

  const totalML = sd.totalML || 0;
  const comML = sd.comisionML || 0;
  const costoEnvCli = sd.costoEnvioCliente || 0;
  const cargoEnvML = sd.cargoEnvioML || 0;
  const met = sd.metodoEnvio || 'desconocido';

  // What ML deposits to the seller account
  let depositoML;
  if (met === 'urbano') {
    depositoML = totalML - comML - cargoEnvML;
  } else if (met === 'flex') {
    depositoML = totalML + costoEnvCli - comML;
  } else {
    // Unknown method — assume ML deposits totalML + costoEnvCli - comML
    depositoML = totalML + costoEnvCli - comML;
  }

  // What system registered as movements (active only)
  const mI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', sd.ventaId).where('tipo', '==', 'ingreso_venta').get();
  let ingMP = 0;
  const ingList = [];
  for (const m of mI.docs) {
    const md = m.data();
    if (md.estado === 'anulado') {
      ingList.push(`${md.numeroMovimiento}:S/${md.monto} [ANULADO]`);
      continue;
    }
    if (md.cuentaOrigen === mpId || md.cuentaDestino === mpId) {
      ingMP += md.monto || 0;
      ingList.push(`${md.numeroMovimiento}:S/${md.monto}`);
    }
  }

  const mG = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', sd.ventaId).where('tipo', '==', 'gasto_operativo').get();
  let gasCom = 0, gasEnv = 0;
  const gasList = [];
  for (const m of mG.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaOrigen === mpId) {
      const c = md.concepto || '';
      if (c.includes('Entrega') || c.includes('envío') || c.includes('Cargo envío')) {
        gasEnv += md.monto || 0;
        gasList.push(`ENV:${md.numeroMovimiento}:S/${md.monto}`);
      } else {
        gasCom += md.monto || 0;
        gasList.push(`COM:${md.numeroMovimiento}:S/${md.monto}`);
      }
    }
  }

  const netoReg = ingMP - gasCom - gasEnv;
  const diff = netoReg - depositoML;

  if (Math.abs(diff) > 0.01) {
    mlExceso += diff;
    console.log(`❌ ${sd.numeroVenta} | ML #${sd.mlOrderId} | met=${met}`);
    console.log(`   ML: producto=S/${totalML} | comisión=S/${comML} | envío=${met === 'urbano' ? `-S/${cargoEnvML} (ML retiene)` : `+S/${costoEnvCli} (Flex)`}`);
    console.log(`   Depósito esperado: S/ ${depositoML.toFixed(2)}`);
    console.log(`   Ingresos reg: ${ingList.join(', ')} = S/ ${ingMP.toFixed(2)}`);
    console.log(`   Gastos reg: ${gasList.join(', ')} = -S/ ${(gasCom + gasEnv).toFixed(2)}`);
    console.log(`   Neto registrado: S/ ${netoReg.toFixed(2)}`);
    console.log(`   DIFERENCIA: +S/ ${diff.toFixed(2)} (sistema tiene de más)\n`);
  }
}

console.log(`Total exceso ML: S/ ${mlExceso.toFixed(2)}`);

// ═══════════════════════════════════════════════
// PART 3: Check the manual Flex adjustment
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('PART 3: AJUSTE MANUAL FLEX S/ 65.10');
console.log('═══════════════════════════════════════════════\n');

const ajQ = await db.collection('movimientosTesoreria')
  .where('concepto', '>=', 'Ajuste')
  .where('concepto', '<=', 'Ajuste\uf8ff')
  .get();
for (const m of ajQ.docs) {
  const d = m.data();
  if (d.cuentaOrigen === mpId || d.cuentaDestino === mpId) {
    console.log(`Ajuste: ${d.numeroMovimiento} | ${d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 16)}`);
    console.log(`  Tipo: ${d.tipo} | Monto: S/ ${d.monto} | Estado: ${d.estado}`);
    console.log(`  Concepto: ${d.concepto}`);
    console.log(`  Este movimiento suma S/ ${d.monto} al saldo MP`);
    console.log('');

    // Check: were the Flex shipping credits already included in ML webhook ingresos?
    // If all Flex orders have diff=0, then this adjustment is double-counting
    console.log('  ¿Los envíos Flex ya están incluidos en los ingresos ML?');
    console.log('  (Si diff=0 para todas las ventas Flex, este ajuste es duplicado)');
  }
}

// ═══════════════════════════════════════════════
// PART 4: Pre-webhook ML ventas — check if any had shipping issues
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('PART 4: VENTAS PRE-WEBHOOK CON MERCADOPAGO');
console.log('(ventas manuales anteriores al webhook ML)');
console.log('═══════════════════════════════════════════════\n');

// Get all ventas that have canal='mercadolibre' but are NOT in mlOrderSync
const ventasML = await db.collection('ventas').where('canal', '==', 'mercadolibre').get();
const ventasMLManual = await db.collection('ventas').where('canal', '==', 'mercado_libre').get();
const allMLVentas = [...ventasML.docs, ...ventasMLManual.docs];

const syncVentaIds = new Set();
for (const s of mlSyncs.docs) syncVentaIds.add(s.data().ventaId);

console.log(`Total ventas canal ML: ${allMLVentas.length}`);
console.log(`Ventas vía webhook (mlOrderSync): ${syncVentaIds.size}`);
console.log(`Ventas manuales (pre-webhook): ${allMLVentas.length - [...allMLVentas].filter(v => syncVentaIds.has(v.id)).length}\n`);

// ═══════════════════════════════════════════════
// PART 5: Check all ingreso movements vs ventas
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('PART 5: VERIFICACIÓN INGRESO → VENTA (activos)');
console.log('═══════════════════════════════════════════════\n');

// Get all active ingreso movements to MP
const ingresosActivos = [];
for (const [id, { doc, esD }] of all) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(d.tipo)) {
    ingresosActivos.push({
      id,
      num: d.numeroMovimiento,
      monto: d.monto || 0,
      ventaId: d.ventaId || null,
      ventaNumero: d.ventaNumero || '',
      concepto: (d.concepto || '').substring(0, 60),
      fecha: d.fecha?.toDate?.(),
    });
  }
}

// Check each ingreso has a valid venta with matching amount
let totalIngresosHuerfanos = 0;
for (const ing of ingresosActivos) {
  if (!ing.ventaId) {
    // Check if this is an adjustment or cotización adelanto (these may not have ventaId)
    if (ing.concepto.includes('Ajuste') || ing.concepto.includes('Adelanto cotización')) {
      continue; // valid
    }
    console.log(`⚠️  Ingreso sin ventaId: ${ing.num} | S/ ${ing.monto} | ${ing.concepto}`);
    totalIngresosHuerfanos += ing.monto;
  }
}

// ═══════════════════════════════════════════════
// PART 6: Check for duplicate numeroMovimiento
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('PART 6: NÚMEROS DE MOVIMIENTO DUPLICADOS');
console.log('═══════════════════════════════════════════════\n');

const numMap = {};
for (const [id, { doc }] of all) {
  const d = doc.data();
  const num = d.numeroMovimiento;
  if (!numMap[num]) numMap[num] = [];
  numMap[num].push({ id, tipo: d.tipo, monto: d.monto, estado: d.estado, concepto: (d.concepto || '').substring(0, 50) });
}
let hasDups = false;
for (const [num, entries] of Object.entries(numMap)) {
  if (entries.length > 1) {
    hasDups = true;
    console.log(`DUPLICADO: ${num} (${entries.length} movimientos)`);
    for (const e of entries) {
      console.log(`  ${e.id} | ${e.tipo} | S/ ${e.monto} | ${e.estado} | ${e.concepto}`);
    }
    console.log('');
  }
}
if (!hasDups) console.log('No se encontraron duplicados.\n');

// ═══════════════════════════════════════════════
// PART 7: FINAL RECONCILIATION
// ═══════════════════════════════════════════════
console.log('═══════════════════════════════════════════════');
console.log('PART 7: RECONCILIACIÓN FINAL');
console.log('═══════════════════════════════════════════════\n');

let saldoFromMovs = 0;
for (const [id, { doc, esO, esD }] of all) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  const tipo = d.tipo;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) saldoFromMovs += monto;
  else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) saldoFromMovs -= monto;
  else if (tipo === 'transferencia_interna') {
    if (esO && !esD) saldoFromMovs -= monto;
    else if (esD && !esO) saldoFromMovs += monto;
  }
  else if (tipo === 'conversion_compra') saldoFromMovs -= monto;
  else if (tipo === 'conversion_venta') saldoFromMovs += monto;
}

const mpActual = (await db.collection('cuentasCaja').doc(mpId).get()).data();
const saldoSistema = mpActual.saldoActual;
const saldoReal = 2677.51;

console.log('A) Saldo calculado desde movimientos activos: S/ ' + saldoFromMovs.toFixed(2));
console.log('B) saldoActual en documento:                  S/ ' + saldoSistema.toFixed(2));
console.log('C) Saldo real en MercadoPago:                 S/ ' + saldoReal.toFixed(2));
console.log('');
console.log('Discrepancia B-A (drift del campo saldo):     S/ ' + (saldoSistema - saldoFromMovs).toFixed(2));
console.log('Discrepancia A-C (movimientos vs realidad):   S/ ' + (saldoFromMovs - saldoReal).toFixed(2));
console.log('Discrepancia B-C (sistema vs realidad):       S/ ' + (saldoSistema - saldoReal).toFixed(2));
console.log('');

// Breakdown of A-C
console.log('─── Desglose de A-C (S/ ' + (saldoFromMovs - saldoReal).toFixed(2) + ') ───');
console.log('');
console.log('Causas identificadas:');
console.log('  1. VT-2026-061 ingreso 112.17→108 (Urbano costoEnvio sumado):   +S/ 4.17');
console.log('  2. VT-2026-062a comisión ML S/ 20.10 no registrada:             +S/ 20.10');
const totalIdentificado = 4.17 + 20.10;
const sinIdentificar = (saldoFromMovs - saldoReal) - totalIdentificado;
console.log('  Subtotal identificado:                                           +S/ ' + totalIdentificado.toFixed(2));
console.log('  Sin identificar:                                                 +S/ ' + sinIdentificar.toFixed(2));
console.log('');
console.log('Posible causa del restante S/ ' + sinIdentificar.toFixed(2) + ':');
console.log('  - Ajuste manual Flex S/ 65.10 podría estar parcialmente duplicado');
console.log('  - Verificar si los envíos Flex de ventas pre-webhook ya fueron');
console.log('    incluidos en los pagos manuales originales');

// ─── Breakdown of B-A
console.log('');
console.log('─── Desglose de B-A (drift S/ ' + (saldoSistema - saldoFromMovs).toFixed(2) + ') ───');
console.log('');
console.log('  saldoActual se mantiene con FieldValue.increment().');
console.log('  Cuando se anuló un movimiento, eliminarMovimiento() revierte el saldo');
console.log('  PERO el movimiento anulado sigue en la colección.');
console.log('  Si el saldo se calculara INCLUYENDO anulados, daría:');

let saldoConAnulados = 0;
for (const [id, { doc, esO, esD }] of all) {
  const d = doc.data();
  const monto = d.monto || 0;
  const tipo = d.tipo;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) saldoConAnulados += monto;
  else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) saldoConAnulados -= monto;
  else if (tipo === 'transferencia_interna') {
    if (esO && !esD) saldoConAnulados -= monto;
    else if (esD && !esO) saldoConAnulados += monto;
  }
  else if (tipo === 'conversion_compra') saldoConAnulados -= monto;
  else if (tipo === 'conversion_venta') saldoConAnulados += monto;
}

console.log('  Saldo con anulados: S/ ' + saldoConAnulados.toFixed(2));
console.log('  Saldo sin anulados: S/ ' + saldoFromMovs.toFixed(2));
console.log('  Diferencia (= efecto de anulados): S/ ' + (saldoConAnulados - saldoFromMovs).toFixed(2));
console.log('');
console.log('  saldoActual actual: S/ ' + saldoSistema.toFixed(2));
console.log('  Si anulaciones revirtieron correctamente, saldo debería ser: S/ ' + saldoFromMovs.toFixed(2));
console.log('  Pero es: S/ ' + saldoSistema.toFixed(2));
console.log('  Exceso no revertido: S/ ' + (saldoSistema - saldoFromMovs).toFixed(2));
console.log('');

// Check: maybe some increments happened without movements
// Let's check if anulados were properly reverted
console.log('  Anulados individuales:');
for (const a of anulados) {
  let esperadoReversion;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(a.tipo)) {
    esperadoReversion = -a.monto;
    console.log(`    ${a.num}: era ingreso S/ ${a.monto} → debió revertir S/ ${esperadoReversion.toFixed(2)} al saldo`);
  } else if (['gasto_operativo', 'egreso'].includes(a.tipo)) {
    esperadoReversion = +a.monto;
    console.log(`    ${a.num}: era egreso S/ ${a.monto} → debió revertir +S/ ${esperadoReversion.toFixed(2)} al saldo`);
  }
}
console.log(`  Total que debió revertirse: S/ ${saldoRevertido.toFixed(2)}`);
console.log(`  Si empezamos con saldo_all = S/ ${saldoConAnulados.toFixed(2)}`);
console.log(`  Y restamos reversiones: ${saldoConAnulados.toFixed(2)} + (${saldoRevertido.toFixed(2)}) = S/ ${(saldoConAnulados + saldoRevertido).toFixed(2)}`);
console.log(`  Pero saldoActual es: S/ ${saldoSistema.toFixed(2)}`);
console.log(`  Diferencia: S/ ${(saldoSistema - (saldoConAnulados + saldoRevertido)).toFixed(2)}`);
console.log('  (Si = 0, las anulaciones se aplicaron correctamente y el drift viene de OTRO lugar)');
