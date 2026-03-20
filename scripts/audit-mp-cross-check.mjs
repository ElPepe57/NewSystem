/**
 * Cross-check: entregas vs cargo_envio_ml para ver si hay doble conteo
 * Y verificar VT-2026-062 pack, duplicados mlOrderSync
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// ═══════════════════════════════════════════════
// 1. DUPLICADOS EN MLORDERSYNC
// ═══════════════════════════════════════════════
console.log('══════════════════════════════════════════');
console.log('1. DUPLICADOS EN MLORDERSYNC');
console.log('══════════════════════════════════════════\n');

const allSync = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
const ventaIdMap = {};
for (const s of allSync.docs) {
  const sd = s.data();
  const vid = sd.ventaId;
  if (!ventaIdMap[vid]) ventaIdMap[vid] = [];
  ventaIdMap[vid].push({
    id: s.id,
    mlOrderId: sd.mlOrderId,
    totalML: sd.totalML,
    comisionML: sd.comisionML,
    cargoEnvioML: sd.cargoEnvioML || 0,
    costoEnvioCliente: sd.costoEnvioCliente || 0,
    metodoEnvio: sd.metodoEnvio,
    packId: sd.packId || null,
    numeroVenta: sd.numeroVenta,
  });
}

for (const [vid, syncs] of Object.entries(ventaIdMap)) {
  if (syncs.length > 1) {
    console.log(`❌ DUPLICADO ventaId=${vid}:`);
    for (const s of syncs) {
      console.log(`   doc ${s.id} | ML#${s.mlOrderId} | ${s.numeroVenta} | totalML=${s.totalML} | com=${s.comisionML} | env=${s.metodoEnvio} | cargoEnv=${s.cargoEnvioML} | pack=${s.packId}`);
    }
    console.log('');
  }
}

// ═══════════════════════════════════════════════
// 2. VT-2026-062 PACK DETAIL
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log('2. VT-2026-062 PACK DETAIL');
console.log('══════════════════════════════════════════\n');

const vt062 = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-062').get();
for (const v of vt062.docs) {
  const vd = v.data();
  console.log(`Venta ${v.id}:`);
  console.log(`  totalPEN: ${vd.totalPEN} | subtotalPEN: ${vd.subtotalPEN} | costoEnvio: ${vd.costoEnvio}`);
  console.log(`  comisionML: ${vd.comisionML} | cargoEnvioML: ${vd.cargoEnvioML || 0}`);
  console.log(`  metodoEnvio: ${vd.metodoEnvio} | packId: ${vd.packId || 'N/A'}`);
  console.log(`  productos: ${vd.productos?.length || 0}`);
  if (vd.productos) {
    for (const p of vd.productos) {
      console.log(`    - ${p.nombreComercial?.substring(0, 40)} | qty=${p.cantidad} | precio=${p.precioUnitario} | sub=${p.subtotal}`);
    }
  }
  console.log(`  mercadoLibreId: ${vd.mercadoLibreId || 'N/A'}`);
  console.log(`  subOrderIds: ${JSON.stringify(vd.subOrderIds || [])}`);
}

// Syncs for 062
const sync062 = await db.collection('mlOrderSync').where('ventaId', '==', 'oT62lh9MR8RWM7dg9DCc').get();
console.log(`\nmlOrderSync entries for VT-2026-062:`);
for (const s of sync062.docs) {
  const sd = s.data();
  console.log(`  ${s.id} | ML#${sd.mlOrderId} | totalML=${sd.totalML} | com=${sd.comisionML} | envCli=${sd.costoEnvioCliente || 0} | cargoEnv=${sd.cargoEnvioML || 0} | met=${sd.metodoEnvio}`);
  console.log(`  pack: ${sd.packId} | subOrders: ${JSON.stringify(sd.subOrderIds || [])}`);
}

// ═══════════════════════════════════════════════
// 3. CROSS-CHECK: ENTREGAS vs ML CARGO_ENVIO
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log('3. CROSS-CHECK: ENTREGAS URBANO vs CARGO_ENVIO_ML');
console.log('══════════════════════════════════════════\n');

// For each venta ML con metodo Urbano, buscar:
// a) cargo_envio_ml gasto
// b) entrega gasto cargada a MP
const ventasConSync = new Map();
for (const s of allSync.docs) {
  const sd = s.data();
  if (sd.metodoEnvio === 'urbano' && sd.ventaId) {
    if (!ventasConSync.has(sd.ventaId)) {
      ventasConSync.set(sd.ventaId, sd);
    }
  }
}

let totalCargoEnvio = 0;
let totalEntregaGasto = 0;
let countConCargoEnvio = 0;
let countConEntrega = 0;
let countConAmbos = 0;

for (const [ventaId, sync] of ventasConSync) {
  const numVenta = sync.numeroVenta;
  const cargoEnvML = sync.cargoEnvioML || 0;

  // Buscar cargo_envio_ml gasto
  const cargoQ = await db.collection('gastos').where('ventaId', '==', ventaId).where('tipo', '==', 'cargo_envio_ml').get();
  let tieneCargoEnvio = !cargoQ.empty;
  let montoCargoEnvio = 0;
  for (const g of cargoQ.docs) montoCargoEnvio += g.data().montoPEN || 0;

  // Buscar entregas de esta venta
  const entregaQ = await db.collection('entregas').where('ventaId', '==', ventaId).get();
  let tieneEntrega = false;
  let montoEntrega = 0;
  let entregaGastoIds = [];

  for (const e of entregaQ.docs) {
    const ed = e.data();
    // Buscar gasto asociado a esta entrega que esté cargado a MP
    if (ed.gastoEnvioId) {
      const gastoDoc = await db.collection('gastos').doc(ed.gastoEnvioId).get();
      if (gastoDoc.exists) {
        const gd = gastoDoc.data();
        // Verificar si tiene pago desde MP
        if (Array.isArray(gd.pagos)) {
          for (const p of gd.pagos) {
            if (p.cuentaOrigenId === mpId || p.metodoPago === 'mercado_pago') {
              tieneEntrega = true;
              montoEntrega += p.montoPEN || p.montoOriginal || gd.montoPEN || 0;
              entregaGastoIds.push(gd.numeroGasto);
            }
          }
        }
      }
    }
  }

  if (cargoEnvML > 0) {
    totalCargoEnvio += cargoEnvML;
    if (tieneCargoEnvio) countConCargoEnvio++;
    if (tieneEntrega) countConEntrega++;
    if (tieneCargoEnvio && tieneEntrega) countConAmbos++;
    totalEntregaGasto += montoEntrega;

    const flag = tieneCargoEnvio && tieneEntrega ? '⚠ DOBLE' : (tieneCargoEnvio ? 'cargo_envio_ml' : (tieneEntrega ? 'entrega_gasto' : '❌ SIN GASTO'));
    console.log(`${numVenta} | ML#${sync.mlOrderId} | cargoEnvML=S/${cargoEnvML} | cargoGasto=${tieneCargoEnvio ? `S/${montoCargoEnvio}` : '-'} | entregaGasto=${tieneEntrega ? `S/${montoEntrega}` : '-'} | ${flag}`);
    if (entregaGastoIds.length > 0) console.log(`    Entregas: ${entregaGastoIds.join(', ')}`);
  }
}

console.log(`\nResumen Urbano:`);
console.log(`  Ventas Urbano con cargoEnvioML > 0: ${ventasConSync.size}`);
console.log(`  Con cargo_envio_ml gasto: ${countConCargoEnvio}`);
console.log(`  Con entrega gasto MP: ${countConEntrega}`);
console.log(`  Con AMBOS (doble conteo): ${countConAmbos}`);
console.log(`  Total cargoEnvioML (según ML): S/ ${totalCargoEnvio.toFixed(2)}`);
console.log(`  Total entrega gastos (MP): S/ ${totalEntregaGasto.toFixed(2)}`);

// ═══════════════════════════════════════════════
// 4. URBANO ORDERS: INGRESO INFLADO DETALLE
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log('4. INGRESOS INFLADOS (costoEnvio en Urbano)');
console.log('══════════════════════════════════════════\n');

let totalInflado = 0;
for (const [ventaId, sync] of ventasConSync) {
  const mI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId).where('tipo', '==', 'ingreso_venta').get();
  let ingMP = 0;
  for (const m of mI.docs) {
    const md = m.data();
    if (md.estado !== 'anulado' && md.cuentaDestino === mpId) ingMP += md.monto || 0;
  }

  const totalML = sync.totalML || 0;
  const excess = ingMP - totalML;
  if (excess > 0.01) {
    totalInflado += excess;
    console.log(`  ${sync.numeroVenta}: ingreso=S/${ingMP.toFixed(2)} > totalML=S/${totalML} → exceso=+S/${excess.toFixed(2)} (cargoEnvioML=${sync.cargoEnvioML})`);
  }
}
console.log(`\nTotal ingresos inflados: S/ ${totalInflado.toFixed(2)}`);

// ═══════════════════════════════════════════════
// 5. RESUMEN CUADRE
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log('5. RESUMEN DE CUADRE');
console.log('══════════════════════════════════════════\n');

const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

let saldoCalc = 0;
for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  const tipo = d.tipo;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) saldoCalc += monto;
  else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) saldoCalc -= monto;
  else if (tipo === 'transferencia_interna') {
    if (esOrigen && !esDestino) saldoCalc -= monto;
    else if (esDestino && !esOrigen) saldoCalc += monto;
  }
}

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
const SALDO_REAL = 1816.15;

console.log(`Saldo sistema (campo):     S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`Saldo movimientos:         S/ ${saldoCalc.toFixed(2)}`);
console.log(`Saldo real MercadoPago:    S/ ${SALDO_REAL.toFixed(2)}`);
console.log('');
console.log(`Drift campo:               S/ ${(mpData.saldoActual - saldoCalc).toFixed(2)}`);
console.log(`Ajuste Flex artificial:     S/ 65.10`);
console.log(`Ingresos Urbano inflados:  S/ ${totalInflado.toFixed(2)}`);
console.log('');
const saldoCorregido = saldoCalc - 65.10 - totalInflado;
console.log(`Saldo tras correcciones:   S/ ${saldoCorregido.toFixed(2)}`);
console.log(`vs Real:                   S/ ${SALDO_REAL.toFixed(2)}`);
console.log(`Diferencia residual:       S/ ${(saldoCorregido - SALDO_REAL).toFixed(2)}`);
