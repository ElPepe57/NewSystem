/**
 * Full MP account trace - chronological with running balance
 * Identifies exactly where drift happens
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
console.log(`Cuenta: ${mpData.nombre}`);
console.log(`Saldo registrado: S/ ${mpData.saldoActual}`);
console.log(`Saldo inicial: S/ ${mpData.saldoInicial || 0}`);
console.log(`Saldo real (usuario): S/ 2677.51`);
console.log(`Diferencia: S/ ${(mpData.saldoActual - 2677.51).toFixed(2)}\n`);

// Get ALL movements (including anulados)
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

const all = new Map();
for (const m of movsO.docs) all.set(m.id, { doc: m, esO: true, esD: false });
for (const m of movsD.docs) {
  if (all.has(m.id)) all.get(m.id).esD = true;
  else all.set(m.id, { doc: m, esO: false, esD: true });
}

const movimientos = [];
for (const [id, { doc, esO, esD }] of all) {
  const d = doc.data();
  const monto = d.monto || 0;
  const tipo = d.tipo;
  const estado = d.estado || 'ejecutado';
  let efecto = 0;

  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) {
    efecto = +monto;
  } else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) {
    efecto = -monto;
  } else if (tipo === 'transferencia_interna') {
    if (esO && !esD) efecto = -monto;
    else if (esD && !esO) efecto = +monto;
  } else if (tipo === 'conversion_compra') {
    efecto = -monto;
  } else if (tipo === 'conversion_venta') {
    efecto = +monto;
  }

  const fecha = d.fecha?.toDate?.() || d.fechaCreacion?.toDate?.() || new Date(0);

  movimientos.push({
    id,
    num: d.numeroMovimiento || '?',
    tipo,
    estado,
    monto,
    efecto,
    concepto: (d.concepto || '').substring(0, 55),
    fecha,
    fechaStr: fecha.toISOString().substring(0, 16),
    ventaNumero: d.ventaNumero || d.gastoNumero || '',
    esO, esD,
    anulado: estado === 'anulado',
  });
}

movimientos.sort((a, b) => a.fecha - b.fecha);

// Show ALL movements chronologically
console.log('=== TODOS LOS MOVIMIENTOS (cronológico) ===');
console.log('Estado: [A]=anulado, [ ]=activo\n');

let saldoAcum = mpData.saldoInicial || 0;
let saldoSinAnulados = mpData.saldoInicial || 0;
let countAnulados = 0;
let montoAnulados = 0;

for (const m of movimientos) {
  const flag = m.anulado ? '[A]' : '[ ]';
  const signo = m.efecto >= 0 ? '+' : '';

  if (!m.anulado) {
    saldoSinAnulados += m.efecto;
  } else {
    countAnulados++;
    montoAnulados += m.efecto;
  }
  saldoAcum += m.efecto;

  console.log(
    `${flag} ${m.fechaStr} | ${signo}${m.efecto.toFixed(2).padStart(8)} | acum=${saldoAcum.toFixed(2).padStart(9)} | sinAnul=${saldoSinAnulados.toFixed(2).padStart(9)} | ${m.tipo.padEnd(22)} | ${m.num.padEnd(28)} | ${m.ventaNumero.padEnd(12)} | ${m.concepto}`
  );
}

console.log('\n=== RESUMEN ===');
console.log(`Movimientos totales: ${movimientos.length}`);
console.log(`Movimientos anulados: ${countAnulados} (efecto neto: S/ ${montoAnulados.toFixed(2)})`);
console.log(`Saldo calculado (todos): S/ ${saldoAcum.toFixed(2)}`);
console.log(`Saldo calculado (sin anulados): S/ ${saldoSinAnulados.toFixed(2)}`);
console.log(`Saldo registrado (sistema): S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`Saldo real (usuario): S/ 2677.51`);
console.log(`\nDiferencia sistema vs real: S/ ${(mpData.saldoActual - 2677.51).toFixed(2)}`);
console.log(`Diferencia calc(sin anulados) vs real: S/ ${(saldoSinAnulados - 2677.51).toFixed(2)}`);
console.log(`Diferencia calc(todos) vs registrado: S/ ${(saldoAcum - mpData.saldoActual).toFixed(2)}`);

// Group by tipo
console.log('\n=== POR TIPO (solo activos) ===');
const porTipo = {};
for (const m of movimientos) {
  if (m.anulado) continue;
  if (!porTipo[m.tipo]) porTipo[m.tipo] = { count: 0, total: 0 };
  porTipo[m.tipo].count++;
  porTipo[m.tipo].total += m.efecto;
}
for (const [tipo, data] of Object.entries(porTipo).sort((a,b) => b[1].total - a[1].total)) {
  const s = data.total >= 0 ? '+' : '';
  console.log(`  ${tipo.padEnd(25)} | ${data.count.toString().padStart(3)} movs | ${s}S/ ${data.total.toFixed(2)}`);
}
