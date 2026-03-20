/**
 * Auditoria detallada: buscar duplicados y anomalias
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// 1. Buscar movimientos duplicados por ventaId + tipo
const movsOrigen = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsDestino = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

const allMovs = new Map();
for (const m of movsOrigen.docs) allMovs.set(m.id, m.data());
for (const m of movsDestino.docs) if (!allMovs.has(m.id)) allMovs.set(m.id, m.data());

// Agrupar por ventaId + tipo
const porVenta = {};
for (const [id, d] of allMovs) {
  const key = `${d.ventaId || d.ventaNumero || 'sin-venta'}`;
  if (!porVenta[key]) porVenta[key] = [];
  porVenta[key].push({ id, ...d });
}

console.log('=== VENTAS CON MULTIPLES MOVIMIENTOS DE INGRESO ===');
for (const [key, movs] of Object.entries(porVenta)) {
  const ingresos = movs.filter(m => m.tipo === 'ingreso_venta' || m.tipo === 'ingreso_anticipo');
  if (ingresos.length > 1) {
    console.log(`\n${key}: ${ingresos.length} ingresos`);
    for (const m of ingresos) {
      console.log(`  ${m.numeroMovimiento} | S/ ${m.monto} | ${m.tipo} | ${m.concepto?.substring(0, 60)}`);
    }
  }
}

// 2. Buscar numero de movimiento duplicado
const numeros = {};
for (const [id, d] of allMovs) {
  const num = d.numeroMovimiento;
  if (!numeros[num]) numeros[num] = [];
  numeros[num].push({ id, ...d });
}

console.log('\n\n=== NUMEROS DE MOVIMIENTO DUPLICADOS ===');
for (const [num, movs] of Object.entries(numeros)) {
  if (movs.length > 1) {
    console.log(`\n${num}: ${movs.length} movimientos`);
    for (const m of movs) {
      console.log(`  ${m.id} | ${m.tipo} | S/ ${m.monto} | ${m.ventaNumero || ''} | ${m.concepto?.substring(0, 50)}`);
    }
  }
}

// 3. Verificar VT-2026-056 especificamente (aparece con 2 ingresos)
console.log('\n\n=== DETALLE VT-2026-056 ===');
const movs056 = await db.collection('movimientosTesoreria').where('ventaNumero', '==', 'VT-2026-056').get();
for (const m of movs056.docs) {
  const d = m.data();
  console.log(`${m.id} | ${d.numeroMovimiento} | ${d.tipo} | S/ ${d.monto} | cuenta: origen=${d.cuentaOrigen} destino=${d.cuentaDestino} | ${d.concepto?.substring(0, 60)}`);
}

// 4. Verificar pagos de VT-2026-056
const venta056Q = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-056').limit(1).get();
if (!venta056Q.empty) {
  const v = venta056Q.docs[0].data();
  console.log(`\nVenta: ${v.numeroVenta} | total: S/ ${v.totalPEN} | pagado: S/ ${v.montoPagado} | estado: ${v.estadoPago}`);
  console.log(`Pagos: ${(v.pagos || []).length}`);
  for (const p of (v.pagos || [])) {
    console.log(`  ${p.id || '?'} | S/ ${p.montoPEN || p.monto} | ${p.metodoPago} | ${p.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?'}`);
  }
}

// 5. Check for any ventas from fix scripts that might still have orphaned movements
console.log('\n\n=== MOVIMIENTOS DE FIX-SCRIPTS (sin ventaId valida) ===');
for (const [id, d] of allMovs) {
  if (d.numeroMovimiento?.includes('fix') || d.creadoPor === 'fix-script') {
    console.log(`${d.numeroMovimiento} | ${d.tipo} | S/ ${d.monto} | ventaId=${d.ventaId} | ventaNum=${d.ventaNumero}`);
  }
}
