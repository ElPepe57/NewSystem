/**
 * AUDITORÍA DRIFT - ¿Por qué saldoActual != suma de movimientos?
 * Y ¿por qué movimientos != saldo real MercadoPago?
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

const SALDO_REAL_MP = 1816.15; // 686.68 disponible + 1129.47 a liberar

// ═══════════════════════════════════════════════════════════════
// 1. CALCULAR SALDO REAL DESDE MOVIMIENTOS
// ═══════════════════════════════════════════════════════════════
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

let saldoCalculado = 0;
let saldoConAnulados = 0;

for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  const monto = d.monto || 0;
  const tipo = d.tipo;
  const esAnulado = d.estado === 'anulado';

  let efecto = 0;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) efecto = +monto;
  else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) efecto = -monto;
  else if (tipo === 'transferencia_interna') {
    if (esOrigen && !esDestino) efecto = -monto;
    else if (esDestino && !esOrigen) efecto = +monto;
  }
  else if (tipo === 'conversion_compra') efecto = -monto;
  else if (tipo === 'conversion_venta') efecto = +monto;

  saldoConAnulados += efecto;
  if (!esAnulado) saldoCalculado += efecto;
}

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
const saldoSistema = mpData.saldoActual;
const drift = saldoSistema - saldoCalculado;

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  ANÁLISIS DE DISCREPANCIA MERCADOPAGO                   ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`A) saldoActual en sistema:        S/ ${saldoSistema.toFixed(2)}`);
console.log(`B) Suma de movimientos activos:    S/ ${saldoCalculado.toFixed(2)}`);
console.log(`C) Saldo real MercadoPago:         S/ ${SALDO_REAL_MP.toFixed(2)}`);
console.log('');
console.log(`DRIFT (A-B):                       S/ ${drift.toFixed(2)}`);
console.log(`EXCESO movimientos vs real (B-C):  S/ ${(saldoCalculado - SALDO_REAL_MP).toFixed(2)}`);
console.log(`EXCESO total sistema vs real (A-C): S/ ${(saldoSistema - SALDO_REAL_MP).toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════
// 2. ANÁLISIS DEL DRIFT: buscar incrementos sin movimiento
// ═══════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('ANÁLISIS DE MOVIMIENTOS ANULADOS');
console.log('══════════════════════════════════════════════════\n');

const anulados = [];
for (const [id, { doc }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') {
    const tipo = d.tipo;
    let efecto;
    if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) efecto = +d.monto;
    else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) efecto = -d.monto;
    else efecto = 0;

    anulados.push({
      id,
      num: d.numeroMovimiento,
      tipo,
      monto: d.monto || 0,
      concepto: (d.concepto || '').substring(0, 70),
      efecto,
      fecha: d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 16),
    });
  }
}

console.log(`Movimientos anulados: ${anulados.length}`);
let totalEfectoAnulados = 0;
for (const a of anulados) {
  totalEfectoAnulados += a.efecto;
  console.log(`  ${a.num} | ${a.tipo} | S/ ${a.monto} | efecto original: ${a.efecto >= 0 ? '+' : ''}${a.efecto.toFixed(2)}`);
  console.log(`    ${a.concepto}`);
}
console.log(`\nSi anulaciones se revirtieron correctamente en saldoActual,`);
console.log(`saldoActual debería = saldoConAnulados + reversiones`);
console.log(`saldoConAnulados (todos los movs): S/ ${saldoConAnulados.toFixed(2)}`);
console.log(`Efecto de anulados: ${totalEfectoAnulados >= 0 ? '+' : ''}S/ ${totalEfectoAnulados.toFixed(2)}`);
console.log(`Si se revirtieron: ${saldoConAnulados.toFixed(2)} - (${totalEfectoAnulados.toFixed(2)}) = S/ ${(saldoConAnulados - totalEfectoAnulados).toFixed(2)}`);
console.log(`saldoActual real: S/ ${saldoSistema.toFixed(2)}`);
console.log(`Drift no explicado por anulaciones: S/ ${(saldoSistema - (saldoConAnulados - totalEfectoAnulados)).toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════
// 3. BUSCAR GASTOS CON PAGOS QUE DECREMENTAN CUENTA SIN MOVIMIENTO
// ═══════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('GASTOS PAGADOS DESDE MP SIN MOVIMIENTO DE TESORERÍA');
console.log('══════════════════════════════════════════════════\n');

// Get all gastos pagados que tienen pago desde MP
const gastosPagados = await db.collection('gastos')
  .where('estado', '==', 'pagado')
  .get();

let gastosConMPSinMov = 0;
let countGastosSinMov = 0;

for (const g of gastosPagados.docs) {
  const gd = g.data();
  const pagos = gd.pagos || [];
  if (!Array.isArray(pagos)) continue;

  for (const pago of pagos) {
    if (pago.cuentaOrigenId === mpId || pago.metodoPago === 'mercado_pago') {
      // Buscar movimiento correspondiente
      const movQ = await db.collection('movimientosTesoreria')
        .where('gastoId', '==', g.id)
        .get();

      let tieneMovActivo = false;
      for (const m of movQ.docs) {
        if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) {
          tieneMovActivo = true;
          break;
        }
      }

      // También buscar por gastoNumero
      if (!tieneMovActivo) {
        const movQ2 = await db.collection('movimientosTesoreria')
          .where('gastoNumero', '==', gd.numeroGasto)
          .get();
        for (const m of movQ2.docs) {
          if (m.data().estado !== 'anulado' && m.data().cuentaOrigen === mpId) {
            tieneMovActivo = true;
            break;
          }
        }
      }

      if (!tieneMovActivo) {
        const montoP = pago.montoPEN || pago.montoOriginal || gd.montoPEN || 0;
        gastosConMPSinMov += montoP;
        countGastosSinMov++;
        console.log(`  ❌ ${gd.numeroGasto} | S/ ${montoP.toFixed(2)} | ${(gd.descripcion || '').substring(0, 60)}`);
        console.log(`     ventaId: ${gd.ventaId || 'N/A'} | ventaNum: ${gd.ventaNumero || 'N/A'}`);
      }
    }
  }
}

if (countGastosSinMov === 0) {
  console.log('✅ Todos los gastos pagados desde MP tienen movimiento de tesorería');
} else {
  console.log(`\n${countGastosSinMov} gastos pagados desde MP SIN movimiento: S/ ${gastosConMPSinMov.toFixed(2)}`);
  console.log('→ Estos gastos decrementaron saldoActual pero no crearon movimiento');
  console.log('  (el gasto.pagos[].cuentaOrigenId=MP llama a increment(-monto) sin movimiento?)');
}

// ═══════════════════════════════════════════════════════════════
// 4. VENTAS ML: COMPARAR CON MLORDERSYNC
// ═══════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('VENTAS ML: DETALLE POR ORDEN');
console.log('══════════════════════════════════════════════════\n');

const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
let totalMLDiff = 0;
let totalComisionesFaltantes = 0;
let totalEnviosFaltantes = 0;

for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (!sd.ventaId) continue;

  const ventaDoc = await db.collection('ventas').doc(sd.ventaId).get();
  if (!ventaDoc.exists) { console.log(`  ⚠ ${sd.numeroVenta}: venta ${sd.ventaId} no existe`); continue; }
  const vd = ventaDoc.data();

  const totalML = sd.totalML || 0;
  const comML = sd.comisionML || 0;
  const costoEnvCli = sd.costoEnvioCliente || 0;
  const cargoEnvML = sd.cargoEnvioML || 0;
  const met = sd.metodoEnvio || '?';

  // Depósito esperado de ML
  let depositoML;
  if (met === 'urbano') {
    depositoML = totalML - comML - cargoEnvML;
  } else {
    depositoML = totalML + costoEnvCli - comML;
  }

  // Ingreso registrado
  const mI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', sd.ventaId).where('tipo', '==', 'ingreso_venta').get();
  let ingMP = 0;
  for (const m of mI.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaDestino === mpId) ingMP += md.monto || 0;
  }

  // Gastos registrados en movimientos
  const mG = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', sd.ventaId).where('tipo', '==', 'gasto_operativo').get();
  let gasComMov = 0, gasEnvMov = 0;
  for (const m of mG.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaOrigen === mpId) {
      const c = md.concepto || '';
      if (c.includes('envío') || c.includes('Entrega') || c.includes('Cargo envío') || c.includes('Urbano')) {
        gasEnvMov += md.monto || 0;
      } else {
        gasComMov += md.monto || 0;
      }
    }
  }

  // Gastos registrados en colección gastos
  const gastoCom = await db.collection('gastos').where('ventaId', '==', sd.ventaId).where('tipo', '==', 'comision_ml').get();
  let gasComGasto = 0;
  for (const g of gastoCom.docs) gasComGasto += g.data().montoPEN || 0;

  const gastoEnv = await db.collection('gastos').where('ventaId', '==', sd.ventaId).where('tipo', '==', 'cargo_envio_ml').get();
  let gasEnvGasto = 0;
  for (const g of gastoEnv.docs) gasEnvGasto += g.data().montoPEN || 0;

  const netoMov = ingMP - gasComMov - gasEnvMov;
  const diff = netoMov - depositoML;
  totalMLDiff += diff;

  // Comisión faltante (gasto existe pero no movimiento)
  const comFaltaMov = gasComGasto > 0 && gasComMov === 0;
  if (comFaltaMov) totalComisionesFaltantes += gasComGasto;

  // Envío faltante (gasto existe pero no movimiento para Urbano)
  const envFaltaMov = gasEnvGasto > 0 && gasEnvMov === 0 && met === 'urbano';
  if (envFaltaMov) totalEnviosFaltantes += gasEnvGasto;

  // Comisión de sync vs gasto registrado
  const comDiff = Math.abs(comML - gasComGasto) > 0.01;

  if (Math.abs(diff) > 0.01 || comFaltaMov || envFaltaMov || comDiff) {
    console.log(`❌ ${sd.numeroVenta} | ML #${sd.mlOrderId} | ${met}`);
    console.log(`   ML: producto=S/${totalML} com=S/${comML} envío=${met === 'urbano' ? `cargoML=-S/${cargoEnvML}` : `flex=+S/${costoEnvCli}`}`);
    console.log(`   Depósito esperado ML: S/ ${depositoML.toFixed(2)}`);
    console.log(`   Mov ingreso: +S/${ingMP.toFixed(2)} | Mov gasto com: -S/${gasComMov.toFixed(2)} | Mov gasto env: -S/${gasEnvMov.toFixed(2)} | Neto: S/${netoMov.toFixed(2)}`);
    console.log(`   Gasto comisión (doc): S/${gasComGasto.toFixed(2)} | Gasto envío (doc): S/${gasEnvGasto.toFixed(2)}`);
    if (comFaltaMov) console.log(`   ⚠ COMISIÓN SIN MOVIMIENTO: gasto existe S/${gasComGasto.toFixed(2)} pero sin egreso en tesorería`);
    if (envFaltaMov) console.log(`   ⚠ CARGO ENVÍO SIN MOVIMIENTO: gasto existe S/${gasEnvGasto.toFixed(2)} pero sin egreso en tesorería`);
    if (comDiff) console.log(`   ⚠ COMISIÓN DIFF: sync=${comML.toFixed(2)} vs gasto=${gasComGasto.toFixed(2)}`);
    console.log(`   DIFF vs depósito: ${diff >= 0 ? '+' : ''}S/${diff.toFixed(2)}\n`);
  }
}

console.log(`Total diferencia ML (movimientos vs depósito esperado): S/ ${totalMLDiff.toFixed(2)}`);
console.log(`Comisiones con gasto pero sin movimiento tesorería: S/ ${totalComisionesFaltantes.toFixed(2)}`);
console.log(`Envíos con gasto pero sin movimiento tesorería: S/ ${totalEnviosFaltantes.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════
// 5. RESUMEN FINAL
// ═══════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  RESUMEN FINAL DE DISCREPANCIAS                         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(`DISCREPANCIA TOTAL (sistema vs real): S/ ${(saldoSistema - SALDO_REAL_MP).toFixed(2)}`);
console.log('');
console.log('Desglose:');
console.log(`  1. DRIFT saldoActual (campo vs movimientos):      +S/ ${drift.toFixed(2)}`);
console.log(`  2. Ajuste artificial Flex (MOV-2026-0088):        +S/ 65.10`);
console.log(`  3. Diferencia ML (movs vs depósito esperado):     +S/ ${totalMLDiff.toFixed(2)}`);
console.log(`  4. Comisiones sin mov tesorería:                  +S/ ${totalComisionesFaltantes.toFixed(2)}`);
console.log(`     (inflaron saldo porque gasto decrementó campo`);
console.log(`      pero sin movimiento → movs no lo reflejan)`);
console.log('');
const totalExplicado = drift + 65.10 + totalMLDiff;
const sinExplicar = (saldoSistema - SALDO_REAL_MP) - totalExplicado;
console.log(`Total explicado: S/ ${totalExplicado.toFixed(2)}`);
console.log(`Sin explicar:    S/ ${sinExplicar.toFixed(2)}`);
console.log('');
console.log('ACCIONES CORRECTIVAS:');
console.log(`  1. Recalcular saldoActual = S/ ${saldoCalculado.toFixed(2)} (basado en movimientos)`);
console.log(`  2. Eliminar/anular MOV-2026-0088 (ajuste Flex S/ 65.10)`);
console.log(`     → Nuevo saldo movimientos: S/ ${(saldoCalculado - 65.10).toFixed(2)}`);
if (totalComisionesFaltantes > 0) {
  console.log(`  3. Crear movimientos de tesorería para comisiones faltantes (-S/ ${totalComisionesFaltantes.toFixed(2)})`);
  console.log(`     → Nuevo saldo: S/ ${(saldoCalculado - 65.10 - totalComisionesFaltantes).toFixed(2)}`);
}
if (totalMLDiff > 0.01) {
  console.log(`  4. Corregir ingresos/egresos ML con discrepancias (-S/ ${totalMLDiff.toFixed(2)})`);
}
const saldoCorregido = saldoCalculado - 65.10 - totalComisionesFaltantes - totalMLDiff;
console.log(`\nSaldo corregido estimado: S/ ${saldoCorregido.toFixed(2)}`);
console.log(`Saldo real MercadoPago:   S/ ${SALDO_REAL_MP.toFixed(2)}`);
console.log(`Diferencia residual:      S/ ${(saldoCorregido - SALDO_REAL_MP).toFixed(2)}`);
