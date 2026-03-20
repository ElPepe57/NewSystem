/**
 * Auditoria exhaustiva: encontrar exactamente de donde viene la diferencia
 * Saldo real: S/ 2,375.31
 * Saldo sistema: S/ 2,606.22
 * Diferencia: +S/ 230.91
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 2375.31;

// 1. Obtener TODAS las ventas ML procesadas y verificar sus montos vs movimientos
console.log('=== VENTAS ML: PAGO REAL vs MOVIMIENTO ===\n');

const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
let totalPagosML = 0;
let totalMovsML = 0;
const anomalias = [];

for (const s of mlSyncs.docs) {
  const sd = s.data();
  const ventaId = sd.ventaId;
  const ventaNum = sd.numeroVenta;
  const mlOrderId = sd.mlOrderId;
  const totalML = sd.totalML || 0;
  const comisionML = sd.comisionML || 0;
  const costoEnvio = sd.costoEnvioML || sd.cargoEnvioML || 0;
  
  // Lo que realmente llega a MP = totalML - comisionML - costoEnvioML (para urbano)
  // Para Flex: totalML - comisionML (envio lo cobra el vendedor)
  
  // Buscar movimiento de ingreso para esta venta
  const movsVenta = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'ingreso_venta')
    .get();
  
  let totalMovIngreso = 0;
  const movIds = [];
  for (const m of movsVenta.docs) {
    const md = m.data();
    // Solo contar los que van a MP
    if (md.cuentaOrigen === mpId || md.cuentaDestino === mpId) {
      totalMovIngreso += md.monto || 0;
      movIds.push(`${md.numeroMovimiento}:S/${md.monto}`);
    }
  }
  
  // Buscar movimiento de gasto (comision)
  const movsGasto = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'gasto_operativo')
    .get();
  
  let totalMovGasto = 0;
  for (const m of movsGasto.docs) {
    const md = m.data();
    if (md.cuentaOrigen === mpId) {
      totalMovGasto += md.monto || 0;
    }
  }
  
  const netoMov = totalMovIngreso - totalMovGasto;
  
  console.log(`${ventaNum} | ML#${mlOrderId} | totalML=S/${totalML} comision=S/${comisionML} | movIngreso=S/${totalMovIngreso} movGasto=S/${totalMovGasto} neto=S/${netoMov.toFixed(2)} | ${movIds.join(', ')}`);
  
  totalPagosML += totalML;
  totalMovsML += totalMovIngreso;
}

console.log(`\nTotal pagos ML (totalML): S/ ${totalPagosML.toFixed(2)}`);
console.log(`Total movimientos ingreso ML: S/ ${totalMovsML.toFixed(2)}`);

// 2. Verificar ventas NO-ML que pagaron a MP
console.log('\n\n=== VENTAS NO-ML CON PAGO A MP ===\n');

const movsIngresoMP = await db.collection('movimientosTesoreria')
  .where('tipo', '==', 'ingreso_venta')
  .get();

const movsAnticipoMP = await db.collection('movimientosTesoreria')
  .where('tipo', '==', 'ingreso_anticipo')
  .get();

let totalIngresoNoML = 0;
let totalIngresoML = 0;

for (const m of [...movsIngresoMP.docs, ...movsAnticipoMP.docs]) {
  const d = m.data();
  if (d.cuentaOrigen !== mpId && d.cuentaDestino !== mpId) continue;
  
  const isML = d.numeroMovimiento?.startsWith('MOV-ml');
  if (!isML) {
    totalIngresoNoML += d.monto || 0;
  } else {
    totalIngresoML += d.monto || 0;
  }
}

console.log(`Ingresos ML (MOV-ml-*): S/ ${totalIngresoML.toFixed(2)}`);
console.log(`Ingresos No-ML (manuales): S/ ${totalIngresoNoML.toFixed(2)}`);

// 3. Verificar transferencias
console.log('\n\n=== TRANSFERENCIAS DESDE MP ===');
const movsTransf = await db.collection('movimientosTesoreria')
  .where('tipo', '==', 'transferencia_interna')
  .where('cuentaOrigen', '==', mpId)
  .get();

let totalTransf = 0;
for (const m of movsTransf.docs) {
  const d = m.data();
  totalTransf += d.monto || 0;
  console.log(`  ${d.numeroMovimiento} | S/ ${d.monto} | ${d.concepto?.substring(0, 60)} | ${d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10)}`);
}
console.log(`Total transferencias salida: S/ ${totalTransf.toFixed(2)}`);

// 4. Resumen final
console.log('\n\n=== RECONCILIACION ===');
const totalGastosMP = await db.collection('movimientosTesoreria')
  .where('tipo', '==', 'gasto_operativo')
  .where('cuentaOrigen', '==', mpId)
  .get();

let totalGastos = 0;
for (const g of totalGastosMP.docs) {
  totalGastos += g.data().monto || 0;
}

console.log(`Ingresos ML:         +S/ ${totalIngresoML.toFixed(2)}`);
console.log(`Ingresos manuales:   +S/ ${totalIngresoNoML.toFixed(2)}`);
console.log(`Gastos operativos:   -S/ ${totalGastos.toFixed(2)}`);
console.log(`Transferencias:      -S/ ${totalTransf.toFixed(2)}`);
const saldoReconciliado = totalIngresoML + totalIngresoNoML - totalGastos - totalTransf;
console.log(`Saldo reconciliado:   S/ ${saldoReconciliado.toFixed(2)}`);
console.log(`Saldo sistema:        S/ 2606.22`);
console.log(`Saldo REAL:           S/ ${SALDO_REAL}`);
console.log(`Exceso sistema:       S/ ${(2606.22 - SALDO_REAL).toFixed(2)}`);
console.log(`Exceso movimientos:   S/ ${(saldoReconciliado - SALDO_REAL).toFixed(2)}`);

// 5. Desglosar ingresos manuales NO-ML
console.log('\n\n=== DETALLE INGRESOS MANUALES (no ML) ===');
for (const m of [...movsIngresoMP.docs, ...movsAnticipoMP.docs]) {
  const d = m.data();
  if (d.cuentaOrigen !== mpId && d.cuentaDestino !== mpId) continue;
  const isML = d.numeroMovimiento?.startsWith('MOV-ml');
  if (!isML) {
    console.log(`  ${d.numeroMovimiento} | ${d.tipo} | S/ ${d.monto} | ${d.ventaNumero || d.concepto?.substring(0, 50)} | ${d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10)}`);
  }
}
