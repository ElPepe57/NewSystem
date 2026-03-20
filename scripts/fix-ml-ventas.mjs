/**
 * Fix ML Ventas:
 * 1. VT-2026-059: Obtener comisión real de ML API y crear gasto faltante
 * 2. VT-2026-060/061: Eliminar venta duplicada, reasignar mlOrderSync a la que se mantiene
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');
const VENTA_059_ID = 'y18Dr8ZxhwBo7gXrY0xS';
const VENTA_060_ID = '4IGiSIqrtIonA7rMhaFu';
const VENTA_061_ID = 'OYO67S4MlPWb0x4OjbbH';

// ============================================================
// ML API
// ============================================================

async function getMLAccessToken() {
  const tokenDoc = await db.collection('mlConfig').doc('tokens').get();
  if (!tokenDoc.exists) throw new Error('No ML tokens found');
  const tokens = tokenDoc.data();
  return tokens.accessToken;
}

async function fetchMLOrder(orderId) {
  const token = await getMLAccessToken();
  const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ML API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ============================================================
// HELPERS
// ============================================================

async function buscarCuentaMP() {
  const q = await db.collection('cuentasCaja')
    .where('metodoPagoAsociado', '==', 'mercado_pago')
    .where('activa', '==', true)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].id;
}

async function obtenerTipoCambio() {
  const today = new Date().toISOString().split('T')[0];
  const q = await db.collection('tiposCambio')
    .where('fecha', '==', today)
    .limit(1)
    .get();
  if (!q.empty) return q.docs[0].data().venta || 3.70;
  const recent = await db.collection('tiposCambio')
    .orderBy('fecha', 'desc')
    .limit(1)
    .get();
  return recent.empty ? 3.70 : (recent.docs[0].data().venta || 3.70);
}

async function generarNumeroGasto() {
  const prefix = 'GAS-';
  const last = await db.collection('gastos')
    .where('numeroGasto', '>=', prefix)
    .where('numeroGasto', '<=', prefix + '\uf8ff')
    .orderBy('numeroGasto', 'desc')
    .limit(1)
    .get();
  let next = 1;
  if (!last.empty) {
    const num = parseInt(last.docs[0].data().numeroGasto.replace(prefix, ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// ============================================================
// PASO 1: Fix VT-2026-059 - Crear gasto de comisión ML
// ============================================================

async function fixVenta059() {
  console.log('\n========== FIX VT-2026-059 ==========\n');

  // Buscar mlOrderSync
  const syncQ = await db.collection('mlOrderSync')
    .where('ventaId', '==', VENTA_059_ID)
    .limit(1)
    .get();

  if (syncQ.empty) {
    console.log('❌ No mlOrderSync found for VT-2026-059');
    return;
  }

  const syncData = syncQ.docs[0].data();
  const syncRef = syncQ.docs[0].ref;
  const mlOrderId = syncData.mlOrderId;
  console.log(`mlOrderSync: ${syncQ.docs[0].id} | mlOrderId=${mlOrderId} | comisionML=${syncData.comisionML}`);

  // Obtener comisión real desde ML API
  console.log(`\nConsultando API de ML para orden ${mlOrderId}...`);
  const mlOrder = await fetchMLOrder(mlOrderId);

  let comisionML = 0;
  for (const item of mlOrder.order_items) {
    const fee = (item.sale_fee || 0) * (item.quantity || 1);
    comisionML += fee;
    console.log(`  Item: ${item.item.title} | sale_fee=${item.sale_fee} × qty=${item.quantity} = ${fee}`);
  }

  if (comisionML <= 0) {
    console.log('❌ ML API aún reporta sale_fee=0. La comisión aún no está disponible.');
    return;
  }

  console.log(`\n✓ Comisión real de ML: S/ ${comisionML}`);

  // Verificar que no exista ya un gasto de comisión
  const existingGasto = await db.collection('gastos')
    .where('ventaId', '==', VENTA_059_ID)
    .where('tipo', '==', 'comision_ml')
    .limit(1)
    .get();

  if (!existingGasto.empty) {
    console.log(`⚠️ Ya existe gasto de comisión ML: ${existingGasto.docs[0].data().numeroGasto}`);
    return;
  }

  // Crear gasto
  const cuentaMPId = await buscarCuentaMP();
  if (!cuentaMPId) { console.log('❌ No cuenta MP'); return; }

  const tc = await obtenerTipoCambio();
  const now = Timestamp.now();
  const fecha = now.toDate();
  const numeroGasto = await generarNumeroGasto();

  console.log(`\n→ Creando gasto ${numeroGasto}: comisión ML S/ ${comisionML}`);

  if (DRY_RUN) {
    console.log('[DRY RUN] No se crean documentos');
    return;
  }

  const pagoGasto = {
    id: `PAG-GAS-${Date.now()}-fix`,
    fecha: now,
    monedaPago: 'PEN',
    montoOriginal: comisionML,
    montoPEN: comisionML,
    tipoCambio: tc,
    metodoPago: 'mercado_pago',
    cuentaOrigenId: cuentaMPId,
    registradoPor: 'fix-script',
  };

  const gastoRef = await db.collection('gastos').add({
    numeroGasto,
    tipo: 'comision_ml',
    categoria: 'GV',
    claseGasto: 'GVD',
    descripcion: `Comisión ML - Orden #${mlOrderId} - VT-2026-059`,
    moneda: 'PEN',
    montoOriginal: comisionML,
    montoPEN: comisionML,
    tipoCambio: tc,
    esProrrateable: false,
    ventaId: VENTA_059_ID,
    ventaNumero: 'VT-2026-059',
    mes: fecha.getMonth() + 1,
    anio: fecha.getFullYear(),
    fecha: now,
    esRecurrente: false,
    frecuencia: 'unico',
    estado: 'pagado',
    impactaCTRU: false,
    ctruRecalculado: true,
    pagos: [pagoGasto],
    montoPagado: comisionML,
    montoPendiente: 0,
    creadoPor: 'fix-script',
    fechaCreacion: now,
  });
  console.log(`  ✓ Gasto creado: ${numeroGasto} (${gastoRef.id})`);

  await db.collection('movimientosTesoreria').add({
    numeroMovimiento: `MOV-mlgas-fix-${Date.now()}`,
    tipo: 'gasto_operativo',
    estado: 'ejecutado',
    moneda: 'PEN',
    monto: comisionML,
    tipoCambio: tc,
    metodo: 'mercado_pago',
    concepto: `Comisión ML - VT-2026-059 - Orden #${mlOrderId}`,
    gastoId: gastoRef.id,
    gastoNumero: numeroGasto,
    ventaId: VENTA_059_ID,
    ventaNumero: 'VT-2026-059',
    cuentaOrigen: cuentaMPId,
    fecha: now,
    creadoPor: 'fix-script',
    fechaCreacion: now,
  });
  console.log(`  ✓ Movimiento tesorería creado`);

  await db.collection('cuentasCaja').doc(cuentaMPId).update({
    saldoActual: FieldValue.increment(-comisionML),
  });
  console.log(`  ✓ Saldo cuenta MP: -S/ ${comisionML}`);

  // Actualizar venta
  const ventaDoc = await db.collection('ventas').doc(VENTA_059_ID).get();
  const ventaData = ventaDoc.data();
  const totalPEN = ventaData.totalPEN || 0;
  await db.collection('ventas').doc(VENTA_059_ID).update({
    comisionML,
    comisionMLPorcentaje: totalPEN > 0 ? (comisionML / totalPEN) * 100 : 0,
    gastosVentaPEN: comisionML + (ventaData.costoEnvioNegocio || 0) + (ventaData.otrosGastosVenta || 0),
  });
  console.log(`  ✓ Venta actualizada: comisionML=S/ ${comisionML}`);

  // Actualizar mlOrderSync
  await syncRef.update({ comisionML });
  console.log(`  ✓ mlOrderSync actualizado`);

  console.log('\n✅ VT-2026-059 corregida');
}

// ============================================================
// PASO 2: Fix duplicado VT-2026-060/061
// ============================================================

async function fixDuplicado() {
  console.log('\n========== FIX DUPLICADO VT-2026-060/061 ==========\n');

  // 061 tiene mlOrderSync, 060 no tiene
  // Mantener 060 (número menor), eliminar 061, reasignar mlOrderSync a 060
  const MANTENER_ID = VENTA_060_ID;
  const MANTENER_NUM = 'VT-2026-060';
  const ELIMINAR_ID = VENTA_061_ID;
  const ELIMINAR_NUM = 'VT-2026-061';

  // Obtener mlOrderSync de 061
  const sync061Q = await db.collection('mlOrderSync')
    .where('ventaId', '==', ELIMINAR_ID)
    .limit(1)
    .get();

  if (sync061Q.empty) {
    console.log('⚠️ No mlOrderSync para 061');
    return;
  }

  const syncRef = sync061Q.docs[0].ref;
  const syncData = sync061Q.docs[0].data();
  console.log(`mlOrderSync: ${sync061Q.docs[0].id} → mlOrderId=${syncData.mlOrderId}`);
  console.log(`Manteniendo ${MANTENER_NUM}, eliminando ${ELIMINAR_NUM}\n`);

  // Recopilar datos de la venta a eliminar ANTES de eliminarla
  const eliminarDoc = await db.collection('ventas').doc(ELIMINAR_ID).get();
  const eliminarData = eliminarDoc.data();
  const totalVenta = eliminarData?.totalPEN || 226.95;
  const comision = eliminarData?.comisionML || 32.70;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Eliminaría ${ELIMINAR_NUM} y sus datos asociados`);
    console.log(`[DRY RUN] Reasignaría mlOrderSync a ${MANTENER_NUM}`);

    // Mostrar qué se eliminaría
    const gastos = await db.collection('gastos').where('ventaId', '==', ELIMINAR_ID).get();
    console.log(`  Gastos: ${gastos.size}`);
    const movs = await db.collection('movimientosTesoreria').where('ventaId', '==', ELIMINAR_ID).get();
    console.log(`  Movimientos: ${movs.size}`);
    const unidades = await db.collection('unidades').where('ventaId', '==', ELIMINAR_ID).get();
    console.log(`  Unidades: ${unidades.size}`);
    const entregas = await db.collection('entregas').where('ventaId', '==', ELIMINAR_ID).get();
    console.log(`  Entregas: ${entregas.size}`);
    return;
  }

  // 1. Eliminar gastos
  const gastos = await db.collection('gastos').where('ventaId', '==', ELIMINAR_ID).get();
  for (const g of gastos.docs) {
    const gd = g.data();
    console.log(`  Eliminando gasto: ${gd.numeroGasto} | ${gd.tipo} | S/ ${gd.montoPEN}`);
    await g.ref.delete();
  }

  // 2. Eliminar movimientos de tesorería
  const movs = await db.collection('movimientosTesoreria').where('ventaId', '==', ELIMINAR_ID).get();
  for (const m of movs.docs) {
    const md = m.data();
    console.log(`  Eliminando mov: ${md.numeroMovimiento} | ${md.tipo} | S/ ${md.monto}`);
    await m.ref.delete();
  }

  // 3. Eliminar pagos
  const pagos = await db.collection('pagosVenta').where('ventaId', '==', ELIMINAR_ID).get();
  for (const p of pagos.docs) {
    console.log(`  Eliminando pago: ${p.id}`);
    await p.ref.delete();
  }

  // 4. Liberar unidades
  const unidades = await db.collection('unidades').where('ventaId', '==', ELIMINAR_ID).get();
  for (const u of unidades.docs) {
    console.log(`  Liberando unidad: ${u.id} → disponible_peru`);
    await u.ref.update({
      estado: 'disponible_peru',
      ventaId: FieldValue.delete(),
      ventaNumero: FieldValue.delete(),
      clienteId: FieldValue.delete(),
      fechaVenta: FieldValue.delete(),
    });
  }

  // 5. Eliminar entregas
  const entregas = await db.collection('entregas').where('ventaId', '==', ELIMINAR_ID).get();
  for (const e of entregas.docs) {
    console.log(`  Eliminando entrega: ${e.id}`);
    await e.ref.delete();
  }

  // 6. Eliminar la venta duplicada
  console.log(`  Eliminando venta: ${ELIMINAR_NUM}`);
  await db.collection('ventas').doc(ELIMINAR_ID).delete();

  // 7. Reasignar mlOrderSync a la venta que se mantiene
  console.log(`  Reasignando mlOrderSync → ${MANTENER_NUM} (${MANTENER_ID})`);
  await syncRef.update({
    ventaId: MANTENER_ID,
    numeroVenta: MANTENER_NUM,
  });

  // 8. Ajustar saldo cuenta MP
  // Duplicado generó: +226.95 (ingreso) y -32.70 (comisión) = +194.25 neto extra
  // Revertir: -194.25
  const cuentaMPId = await buscarCuentaMP();
  if (cuentaMPId) {
    const ajuste = -(totalVenta - comision); // -(226.95 - 32.70) = -194.25
    console.log(`  Ajustando saldo cuenta MP: S/ ${ajuste.toFixed(2)}`);
    await db.collection('cuentasCaja').doc(cuentaMPId).update({
      saldoActual: FieldValue.increment(ajuste),
    });
  }

  console.log(`\n✅ ${ELIMINAR_NUM} eliminada, mlOrderSync reasignado a ${MANTENER_NUM}`);
}

// ============================================================
// EJECUTAR
// ============================================================

console.log(DRY_RUN ? '🔍 DRY RUN' : '🔧 EJECUTANDO CAMBIOS');

try {
  await fixVenta059();
} catch (err) {
  console.error('Error en fixVenta059:', err.message);
}

try {
  await fixDuplicado();
} catch (err) {
  console.error('Error en fixDuplicado:', err.message);
}

console.log('\n========== FIN ==========');
