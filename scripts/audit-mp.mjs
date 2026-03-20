/**
 * Auditoria cuenta Mercado Pago - Calcular saldo real vs registrado
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const cuentasQ = await db.collection('cuentasCaja')
  .where('metodoPagoAsociado', '==', 'mercado_pago')
  .where('activa', '==', true)
  .limit(1)
  .get();

if (cuentasQ.empty) { console.log('No cuenta MP'); process.exit(1); }

const cuentaMP = cuentasQ.docs[0];
const cuentaData = cuentaMP.data();
const mpId = cuentaMP.id;
console.log(`\nCuenta: ${cuentaData.nombre} (${mpId})`);
console.log(`Saldo registrado: S/ ${cuentaData.saldoActual}`);
console.log(`Saldo inicial: S/ ${cuentaData.saldoInicial || 0}`);

const movsOrigen = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsDestino = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

const allMovs = new Map();
for (const m of movsOrigen.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsDestino.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

console.log(`Movimientos unicos: ${allMovs.size}`);

let totalIngresos = 0;
let totalEgresos = 0;
const movimientos = [];

for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  const monto = d.monto || 0;
  const tipo = d.tipo;
  let efecto = 0;

  if (tipo === 'ingreso_venta' || tipo === 'ingreso' || tipo === 'ingreso_anticipo') {
    efecto = +monto;
  } else if (tipo === 'gasto_operativo' || tipo === 'egreso' || tipo === 'gasto') {
    efecto = -monto;
  } else if (tipo === 'transferencia_interna') {
    if (esOrigen && !esDestino) efecto = -monto;
    else if (esDestino && !esOrigen) efecto = +monto;
  } else if (tipo === 'conversion_compra') {
    efecto = -monto;
  } else if (tipo === 'conversion_venta') {
    efecto = +monto;
  } else {
    console.log(`  ?? ${tipo} | ${d.numeroMovimiento} | S/ ${monto}`);
  }

  if (efecto > 0) totalIngresos += efecto;
  if (efecto < 0) totalEgresos += Math.abs(efecto);

  movimientos.push({
    num: d.numeroMovimiento || '?',
    tipo, monto, efecto,
    concepto: (d.concepto || '').substring(0, 60),
    fecha: d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?',
    esOrigen, esDestino,
  });
}

const saldoCalculado = (cuentaData.saldoInicial || 0) + totalIngresos - totalEgresos;
const diferencia = cuentaData.saldoActual - saldoCalculado;

console.log(`\n========== RESUMEN ==========`);
console.log(`Saldo inicial:    S/ ${(cuentaData.saldoInicial || 0).toFixed(2)}`);
console.log(`Total ingresos:  +S/ ${totalIngresos.toFixed(2)}`);
console.log(`Total egresos:   -S/ ${totalEgresos.toFixed(2)}`);
console.log(`Saldo calculado:  S/ ${saldoCalculado.toFixed(2)}`);
console.log(`Saldo registrado: S/ ${cuentaData.saldoActual.toFixed(2)}`);
console.log(`DIFERENCIA:       S/ ${diferencia.toFixed(2)}`);

if (Math.abs(diferencia) > 0.01) {
  console.log(`\n--- Por tipo ---`);
  const porTipo = {};
  for (const m of movimientos) {
    if (!porTipo[m.tipo]) porTipo[m.tipo] = { count: 0, total: 0 };
    porTipo[m.tipo].count++;
    porTipo[m.tipo].total += m.efecto;
  }
  for (const [tipo, data] of Object.entries(porTipo)) {
    console.log(`  ${tipo}: ${data.count} movs | neto: S/ ${data.total.toFixed(2)}`);
  }

  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  console.log(`\n--- Cronologico ---`);
  let saldoAcum = cuentaData.saldoInicial || 0;
  for (const m of movimientos) {
    saldoAcum += m.efecto;
    const s = m.efecto >= 0 ? '+' : '';
    console.log(`  ${m.fecha} | ${s}${m.efecto.toFixed(2)} | acum=${saldoAcum.toFixed(2)} | ${m.tipo} | ${m.num} | ${m.concepto}`);
  }
}
