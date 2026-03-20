/**
 * AUDITORÍA DE FANTASMAS - Buscar movimientos huérfanos, duplicados,
 * transacciones erróneas, y el origen del drift de S/ 191.94
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  CAZA DE FANTASMAS - AUDITORÍA EXHAUSTIVA               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// ═══════════════════════════════════════════════
// 0. SALDO ACTUAL
// ═══════════════════════════════════════════════
const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
console.log(`saldoActual: S/ ${mpData.saldoActual.toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 1. TODOS LOS MOVIMIENTOS - ORDENADOS POR FECHA
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('1. TODOS LOS MOVIMIENTOS (cronológico)');
console.log('══════════════════════════════════════════\n');

const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

// Convertir a array y ordenar
const movArray = [];
for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  const tipo = d.tipo;
  let efecto = 0;
  if (d.estado !== 'anulado') {
    if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) efecto = +(d.monto || 0);
    else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) efecto = -(d.monto || 0);
    else if (tipo === 'transferencia_interna') {
      if (esOrigen && !esDestino) efecto = -(d.monto || 0);
      else if (esDestino && !esOrigen) efecto = +(d.monto || 0);
    }
  }

  movArray.push({
    id,
    num: d.numeroMovimiento || '?',
    tipo,
    monto: d.monto || 0,
    efecto,
    estado: d.estado || 'ejecutado',
    concepto: (d.concepto || '').substring(0, 65),
    fecha: d.fecha?.toDate?.() || d.fechaCreacion?.toDate?.() || new Date(0),
    ventaId: d.ventaId || null,
    ventaNumero: d.ventaNumero || '',
    gastoId: d.gastoId || null,
    gastoNumero: d.gastoNumero || '',
    esOrigen,
    esDestino,
  });
}

movArray.sort((a, b) => a.fecha - b.fecha);

// Reconstruir saldo cronológico
let saldoRunning = 0;
for (const m of movArray) {
  saldoRunning += m.efecto;
  const fechaStr = m.fecha.toISOString().substring(0, 10);
  const signo = m.efecto >= 0 ? '+' : '';
  const estadoTag = m.estado === 'anulado' ? ' [ANULADO]' : '';
  console.log(`${fechaStr} | ${m.num.padEnd(28)} | ${m.tipo.padEnd(22)} | ${signo}${m.efecto.toFixed(2).padStart(9)} | saldo=${saldoRunning.toFixed(2).padStart(9)} | ${m.concepto}${estadoTag}`);
}
console.log(`\nSaldo final calculado: S/ ${saldoRunning.toFixed(2)}`);
console.log(`saldoActual campo:     S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`DRIFT:                 S/ ${(mpData.saldoActual - saldoRunning).toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 2. BUSCAR FANTASMAS: movimientos sin venta/gasto válido
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('2. FANTASMAS: movimientos sin respaldo');
console.log('══════════════════════════════════════════\n');

let fantasmaCount = 0;
let fantasmaTotal = 0;

for (const m of movArray) {
  if (m.estado === 'anulado') continue;

  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(m.tipo)) {
    // Verificar que existe la venta
    if (m.ventaId) {
      const ventaDoc = await db.collection('ventas').doc(m.ventaId).get();
      if (!ventaDoc.exists) {
        fantasmaCount++;
        fantasmaTotal += m.efecto;
        console.log(`👻 FANTASMA INGRESO: ${m.num} | S/ ${m.monto} | ventaId=${m.ventaId} NO EXISTE`);
        console.log(`   ${m.concepto}`);
      }
    } else if (!m.concepto.includes('Ajuste') && !m.concepto.includes('Adelanto cotización')) {
      // Ingreso sin ventaId y no es ajuste ni adelanto
      fantasmaCount++;
      fantasmaTotal += m.efecto;
      console.log(`👻 FANTASMA INGRESO SIN VENTA: ${m.num} | S/ ${m.monto}`);
      console.log(`   ${m.concepto}`);
    }
  }

  if (['gasto_operativo', 'egreso', 'gasto'].includes(m.tipo)) {
    // Verificar que existe el gasto
    if (m.gastoId) {
      const gastoDoc = await db.collection('gastos').doc(m.gastoId).get();
      if (!gastoDoc.exists) {
        fantasmaCount++;
        fantasmaTotal += m.efecto;
        console.log(`👻 FANTASMA GASTO: ${m.num} | -S/ ${m.monto} | gastoId=${m.gastoId} NO EXISTE`);
        console.log(`   ${m.concepto}`);
      }
    }
  }
}

if (fantasmaCount === 0) console.log('✅ No se encontraron movimientos fantasma\n');
else console.log(`\n⚠ ${fantasmaCount} fantasmas encontrados, efecto total: S/ ${fantasmaTotal.toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 3. BUSCAR DUPLICADOS: misma venta, mismo tipo, múltiples movimientos
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('3. DUPLICADOS: misma venta, mismo tipo');
console.log('══════════════════════════════════════════\n');

const ventaTipoMap = {};
for (const m of movArray) {
  if (m.estado === 'anulado') continue;
  if (!m.ventaId) continue;
  const key = `${m.ventaId}|${m.tipo}`;
  if (!ventaTipoMap[key]) ventaTipoMap[key] = [];
  ventaTipoMap[key].push(m);
}

let dupCount = 0;
let dupTotal = 0;
for (const [key, movs] of Object.entries(ventaTipoMap)) {
  if (movs.length > 1) {
    dupCount++;
    const total = movs.reduce((s, m) => s + m.efecto, 0);
    const excess = total - movs[0].efecto; // el primer movimiento es "correcto", el resto es exceso
    dupTotal += excess;
    console.log(`🔁 DUPLICADO: ${movs[0].ventaNumero || movs[0].ventaId} | ${movs[0].tipo} | ${movs.length} movimientos`);
    for (const m of movs) {
      console.log(`   ${m.num} | ${m.fecha.toISOString().substring(0, 16)} | ${m.efecto >= 0 ? '+' : ''}S/${m.efecto.toFixed(2)} | ${m.concepto}`);
    }
    console.log(`   Exceso: S/ ${excess.toFixed(2)}\n`);
  }
}

if (dupCount === 0) console.log('✅ No se encontraron duplicados\n');
else console.log(`⚠ ${dupCount} grupos duplicados, exceso total: S/ ${dupTotal.toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 4. VENTAS CON PAGO A MP: cruzar monto venta vs monto ingreso
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('4. MONTOS ERRÓNEOS: ingreso != totalPEN venta');
console.log('══════════════════════════════════════════\n');

let errorCount = 0;
let errorTotal = 0;

// Agrupar ingresos activos por ventaId
const ingresosPorVenta = {};
for (const m of movArray) {
  if (m.estado === 'anulado') continue;
  if (!m.ventaId) continue;
  if (!['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(m.tipo)) continue;
  if (!ingresosPorVenta[m.ventaId]) ingresosPorVenta[m.ventaId] = { total: 0, movs: [] };
  ingresosPorVenta[m.ventaId].total += m.monto;
  ingresosPorVenta[m.ventaId].movs.push(m);
}

for (const [ventaId, data] of Object.entries(ingresosPorVenta)) {
  const ventaDoc = await db.collection('ventas').doc(ventaId).get();
  if (!ventaDoc.exists) continue;
  const vd = ventaDoc.data();
  const totalPEN = vd.totalPEN || 0;
  const montoPagado = vd.montoPagado || 0;

  // Comparar ingreso registrado en MP vs lo que debería ser
  const diff = data.total - montoPagado;
  if (Math.abs(diff) > 0.01 && data.total > 0) {
    errorCount++;
    errorTotal += diff;
    const isML = (vd.canal || '').includes('mercado') || vd.mercadoLibreId;
    console.log(`⚠ ${vd.numeroVenta} | canal=${isML ? 'ML' : vd.canal || '?'} | totalPEN=${totalPEN} | montoPagado=${montoPagado} | ingresoMP=${data.total.toFixed(2)} | diff=${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`);
    if (data.movs.length > 1) {
      for (const m of data.movs) {
        console.log(`   ${m.num} | S/ ${m.monto} | ${m.concepto}`);
      }
    }
  }
}

if (errorCount === 0) console.log('✅ Todos los ingresos coinciden con montoPagado\n');
else console.log(`\n⚠ ${errorCount} ventas con diferencia, total: S/ ${errorTotal.toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 5. VENTAS PAGADAS SIN MOVIMIENTO EN MP
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('5. VENTAS PAGADAS POR MP SIN MOVIMIENTO');
console.log('══════════════════════════════════════════\n');

// Buscar ventas con estadoPago=pagado y metodoPago=mercado_pago que NO tienen movimiento
const ventasPagadas = await db.collection('ventas').where('estadoPago', '==', 'pagado').get();
let sinMov = 0;
let sinMovTotal = 0;

for (const v of ventasPagadas.docs) {
  const vd = v.data();
  const pagos = vd.pagos || [];
  if (!Array.isArray(pagos)) continue;

  const tieneMP = pagos.some(p => p.metodoPago === 'mercado_pago' || p.metodoPago === 'mercadopago');
  if (!tieneMP) continue;

  // Buscar movimiento ingreso para esta venta en MP
  const movQ = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', v.id)
    .get();

  let tieneMovIngreso = false;
  for (const m of movQ.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(md.tipo) && md.cuentaDestino === mpId) {
      tieneMovIngreso = true;
      break;
    }
  }

  if (!tieneMovIngreso) {
    sinMov++;
    sinMovTotal += vd.montoPagado || vd.totalPEN || 0;
    console.log(`❌ ${vd.numeroVenta} (${v.id}) | totalPEN=${vd.totalPEN} | pagado=${vd.montoPagado} | SIN MOVIMIENTO INGRESO EN MP`);
    console.log(`   Esto significa: saldoActual fue incrementado (via pago) pero no hay movimiento`);
  }
}

if (sinMov === 0) console.log('✅ Todas las ventas pagadas por MP tienen movimiento\n');
else console.log(`\n🔴 ${sinMov} ventas pagadas por MP sin movimiento → explica DRIFT de S/ ${sinMovTotal.toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 6. GASTOS PAGADOS DESDE MP SIN MOVIMIENTO
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('6. GASTOS PAGADOS DESDE MP SIN MOVIMIENTO');
console.log('══════════════════════════════════════════\n');

const gastosPagados = await db.collection('gastos').where('estado', '==', 'pagado').get();
let gastosSinMov = 0;
let gastosSinMovTotal = 0;

for (const g of gastosPagados.docs) {
  const gd = g.data();
  const pagos = gd.pagos;
  if (!Array.isArray(pagos)) continue;

  for (const pago of pagos) {
    if (pago.cuentaOrigenId === mpId) {
      // Buscar movimiento
      const movQ = await db.collection('movimientosTesoreria')
        .where('gastoId', '==', g.id)
        .get();

      let tieneMovGasto = false;
      for (const m of movQ.docs) {
        if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) {
          tieneMovGasto = true;
          break;
        }
      }

      if (!tieneMovGasto) {
        // Buscar por gastoNumero también
        const movQ2 = await db.collection('movimientosTesoreria')
          .where('gastoNumero', '==', gd.numeroGasto)
          .get();
        for (const m of movQ2.docs) {
          if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) {
            tieneMovGasto = true;
            break;
          }
        }
      }

      // Buscar por concepto que contenga el numeroGasto
      if (!tieneMovGasto) {
        const movQ3 = await db.collection('movimientosTesoreria')
          .where('concepto', '>=', `Pago ${gd.numeroGasto}`)
          .where('concepto', '<=', `Pago ${gd.numeroGasto}\uf8ff`)
          .get();
        for (const m of movQ3.docs) {
          if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) {
            tieneMovGasto = true;
            break;
          }
        }
      }

      if (!tieneMovGasto) {
        gastosSinMov++;
        const montoP = pago.montoPEN || pago.montoOriginal || gd.montoPEN || 0;
        gastosSinMovTotal += montoP;
        console.log(`❌ ${gd.numeroGasto} | S/ ${montoP.toFixed(2)} | ${(gd.descripcion || '').substring(0, 55)}`);
        console.log(`   ventaId: ${gd.ventaId || 'N/A'} | cuentaOrigen: ${pago.cuentaOrigenId}`);
        console.log(`   → saldoActual decrementado pero sin movimiento (fantasma negativo)`);
      }
    }
  }
}

if (gastosSinMov === 0) console.log('✅ Todos los gastos pagados desde MP tienen movimiento\n');
else console.log(`\n🔴 ${gastosSinMov} gastos pagados desde MP sin movimiento → DRIFT negativo S/ -${gastosSinMovTotal.toFixed(2)}\n`);

// ═══════════════════════════════════════════════
// 7. RESUMEN FINAL
// ═══════════════════════════════════════════════
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  RESUMEN DE FANTASMAS                                   ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`saldoActual:     S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`Movimientos sum: S/ ${saldoRunning.toFixed(2)}`);
console.log(`DRIFT:           S/ ${(mpData.saldoActual - saldoRunning).toFixed(2)}`);
console.log('');
console.log('Posibles causas del drift:');
console.log(`  Fantasmas (movs sin respaldo):    ${fantasmaCount > 0 ? `S/ ${fantasmaTotal.toFixed(2)}` : 'Ninguno'}`);
console.log(`  Duplicados (exceso):              ${dupCount > 0 ? `S/ ${dupTotal.toFixed(2)}` : 'Ninguno'}`);
console.log(`  Ventas pagadas sin movimiento:    ${sinMov > 0 ? `+S/ ${sinMovTotal.toFixed(2)} (incrementó saldo)` : 'Ninguno'}`);
console.log(`  Gastos pagados sin movimiento:    ${gastosSinMov > 0 ? `-S/ ${gastosSinMovTotal.toFixed(2)} (decrementó saldo)` : 'Ninguno'}`);
const driftExplicado = (sinMovTotal - gastosSinMovTotal) + fantasmaTotal + dupTotal;
console.log(`  DRIFT explicado:                  S/ ${driftExplicado.toFixed(2)}`);
console.log(`  DRIFT sin explicar:               S/ ${((mpData.saldoActual - saldoRunning) - driftExplicado).toFixed(2)}`);
