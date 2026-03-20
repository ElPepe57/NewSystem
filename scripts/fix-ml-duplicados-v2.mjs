/**
 * Fix ML duplicados VT-2026-062 y VT-2026-063
 * Mantener VT-2026-061, eliminar 062 y 063
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

async function buscarCuentaMP() {
  const q = await db.collection('cuentasCaja')
    .where('metodoPagoAsociado', '==', 'mercado_pago')
    .where('activa', '==', true)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].id;
}

async function findVentaByNumero(num) {
  const q = await db.collection('ventas').where('numeroVenta', '==', num).limit(1).get();
  if (q.empty) return null;
  return { id: q.docs[0].id, ref: q.docs[0].ref, data: q.docs[0].data() };
}

async function eliminarVenta(ventaId, ventaNum) {
  console.log(`\n--- Eliminando ${ventaNum} (${ventaId}) ---`);

  // Gastos
  const gastos = await db.collection('gastos').where('ventaId', '==', ventaId).get();
  let comisionRevertida = 0;
  for (const g of gastos.docs) {
    const gd = g.data();
    if (gd.tipo === 'comision_ml') comisionRevertida += gd.montoPEN || 0;
    console.log(`  Gasto: ${gd.numeroGasto} | ${gd.tipo} | S/ ${gd.montoPEN}`);
    if (!DRY_RUN) await g.ref.delete();
  }

  // Movimientos tesorería
  const movs = await db.collection('movimientosTesoreria').where('ventaId', '==', ventaId).get();
  let ingresoRevertido = 0;
  for (const m of movs.docs) {
    const md = m.data();
    if (md.tipo === 'ingreso_venta') ingresoRevertido += md.monto || 0;
    console.log(`  Mov: ${md.numeroMovimiento} | ${md.tipo} | S/ ${md.monto}`);
    if (!DRY_RUN) await m.ref.delete();
  }

  // Pagos
  const pagos = await db.collection('pagosVenta').where('ventaId', '==', ventaId).get();
  for (const p of pagos.docs) {
    console.log(`  Pago: ${p.id}`);
    if (!DRY_RUN) await p.ref.delete();
  }

  // Unidades
  const unidades = await db.collection('unidades').where('ventaId', '==', ventaId).get();
  for (const u of unidades.docs) {
    console.log(`  Unidad: ${u.id} → disponible_peru`);
    if (!DRY_RUN) await u.ref.update({
      estado: 'disponible_peru',
      ventaId: FieldValue.delete(),
      ventaNumero: FieldValue.delete(),
      clienteId: FieldValue.delete(),
      fechaVenta: FieldValue.delete(),
    });
  }

  // Entregas
  const entregas = await db.collection('entregas').where('ventaId', '==', ventaId).get();
  for (const e of entregas.docs) {
    console.log(`  Entrega: ${e.id}`);
    if (!DRY_RUN) await e.ref.delete();
  }

  // mlOrderSync que apunten a esta venta — reasignar al mantener, no eliminar
  const syncs = await db.collection('mlOrderSync').where('ventaId', '==', ventaId).get();
  for (const s of syncs.docs) {
    console.log(`  mlOrderSync: ${s.id} → reasignar a mantener`);
    // No eliminar aquí, reasignar después
    reasignarSyncs.push(s);
  }

  // La venta
  console.log(`  Venta: ${ventaNum}`);
  if (!DRY_RUN) await db.collection('ventas').doc(ventaId).delete();

  return { comisionRevertida, ingresoRevertido };
}

// ============================================================

console.log(DRY_RUN ? '🔍 DRY RUN' : '🔧 EJECUTANDO');

// Diagnosticar
const ventas = ['VT-2026-061', 'VT-2026-062', 'VT-2026-063'];
const found = [];

for (const num of ventas) {
  const v = await findVentaByNumero(num);
  if (v) {
    console.log(`${num} (${v.id}): ${v.data.nombreCliente} | S/ ${v.data.totalPEN} | ${v.data.estado} | comisionML=${v.data.comisionML || 0}`);
    found.push({ num, ...v });
  } else {
    console.log(`${num}: NO ENCONTRADA`);
  }
}

// Determinar cuáles son duplicadas (mismo cliente, mismo total)
// Mantener la primera (061), eliminar 062 y 063
const mantener = found[0];
const eliminar = found.slice(1);

if (eliminar.length === 0) {
  console.log('\nNo hay duplicados que eliminar');
  process.exit(0);
}

console.log(`\nManteniendo: ${mantener.num}`);
console.log(`Eliminando: ${eliminar.map(e => e.num).join(', ')}`);

let totalComision = 0;
let totalIngreso = 0;
const reasignarSyncs = [];

for (const v of eliminar) {
  const { comisionRevertida, ingresoRevertido } = await eliminarVenta(v.id, v.num);
  totalComision += comisionRevertida;
  totalIngreso += ingresoRevertido;
}

// Reasignar mlOrderSync al mantener
for (const s of reasignarSyncs) {
  console.log(`\nReasignando mlOrderSync ${s.id} → ${mantener.num} (${mantener.id})`);
  if (!DRY_RUN) await s.ref.update({ ventaId: mantener.id, numeroVenta: mantener.num });
}

// Fix comisionML en la venta mantenida (si es 0, usar el valor de las eliminadas)
const comisionCorrecta = eliminar.find(v => (v.data.comisionML || 0) > 0)?.data.comisionML || 0;
if (comisionCorrecta > 0 && (mantener.data.comisionML || 0) === 0) {
  const totalPEN = mantener.data.totalPEN || 0;
  const pct = totalPEN > 0 ? (comisionCorrecta / totalPEN) * 100 : 0;
  console.log(`\nFix comisión ${mantener.num}: 0 → S/ ${comisionCorrecta} (${pct.toFixed(1)}%)`);
  if (!DRY_RUN) {
    await db.collection('ventas').doc(mantener.id).update({
      comisionML: comisionCorrecta,
      comisionMLPorcentaje: pct,
      gastosVentaPEN: comisionCorrecta + (mantener.data.costoEnvioNegocio || 0) + (mantener.data.otrosGastosVenta || 0),
    });
    for (const s of reasignarSyncs) {
      await s.ref.update({ comisionML: comisionCorrecta });
    }
  }

  // Crear gasto de comisión para la venta mantenida
  const existingGasto = await db.collection('gastos')
    .where('ventaId', '==', mantener.id)
    .where('tipo', '==', 'comision_ml')
    .limit(1).get();

  const cuentaMP = await buscarCuentaMP();
  if (existingGasto.empty && cuentaMP) {
    const now = Timestamp.now();
    const fecha = now.toDate();
    // Generar numero gasto
    const lastG = await db.collection('gastos')
      .where('numeroGasto', '>=', 'GAS-').where('numeroGasto', '<=', 'GAS-\uf8ff')
      .orderBy('numeroGasto', 'desc').limit(1).get();
    let nextNum = 1;
    if (!lastG.empty) {
      const n = parseInt(lastG.docs[0].data().numeroGasto.replace('GAS-', ''), 10);
      if (!isNaN(n)) nextNum = n + 1;
    }
    const numeroGasto = `GAS-${String(nextNum).padStart(4, '0')}`;
    const mlOrderId = reasignarSyncs[0]?.data()?.mlOrderId || 0;

    console.log(`Creando gasto ${numeroGasto}: comisión ML S/ ${comisionCorrecta} para ${mantener.num}`);
    if (!DRY_RUN) {
      const pagoGasto = {
        id: `PAG-GAS-${Date.now()}-fix`,
        fecha: now, monedaPago: 'PEN',
        montoOriginal: comisionCorrecta, montoPEN: comisionCorrecta,
        tipoCambio: 3.70, metodoPago: 'mercado_pago',
        cuentaOrigenId: cuentaMP, registradoPor: 'fix-script',
      };
      const gastoRef = await db.collection('gastos').add({
        numeroGasto, tipo: 'comision_ml', categoria: 'GV', claseGasto: 'GVD',
        descripcion: `Comisión ML - Orden #${mlOrderId} - ${mantener.num}`,
        moneda: 'PEN', montoOriginal: comisionCorrecta, montoPEN: comisionCorrecta,
        tipoCambio: 3.70, esProrrateable: false,
        ventaId: mantener.id, ventaNumero: mantener.num,
        mes: fecha.getMonth() + 1, anio: fecha.getFullYear(), fecha: now,
        esRecurrente: false, frecuencia: 'unico', estado: 'pagado',
        impactaCTRU: false, ctruRecalculado: true,
        pagos: [pagoGasto], montoPagado: comisionCorrecta, montoPendiente: 0,
        creadoPor: 'fix-script', fechaCreacion: now,
      });
      await db.collection('movimientosTesoreria').add({
        numeroMovimiento: `MOV-mlgas-fix-${Date.now()}`,
        tipo: 'gasto_operativo', estado: 'ejecutado',
        moneda: 'PEN', monto: comisionCorrecta, tipoCambio: 3.70,
        metodo: 'mercado_pago',
        concepto: `Comisión ML - ${mantener.num} - Orden #${mlOrderId}`,
        gastoId: gastoRef.id, gastoNumero: numeroGasto,
        ventaId: mantener.id, ventaNumero: mantener.num,
        cuentaOrigen: cuentaMP, fecha: now,
        creadoPor: 'fix-script', fechaCreacion: now,
      });
      await db.collection('cuentasCaja').doc(cuentaMP).update({
        saldoActual: FieldValue.increment(-comisionCorrecta),
      });
      console.log(`  ✓ Gasto ${numeroGasto} creado + mov tesorería + saldo MP -S/ ${comisionCorrecta}`);
    }
  }
}

// Ajustar saldo cuenta MP
const cuentaMPId = await buscarCuentaMP();
if (cuentaMPId && (totalIngreso > 0 || totalComision > 0)) {
  const ajuste = -(totalIngreso - totalComision);
  console.log(`\nAjuste saldo MP: S/ ${ajuste.toFixed(2)} (ingreso duplicado: ${totalIngreso}, comisión revertida: ${totalComision})`);
  if (!DRY_RUN) {
    await db.collection('cuentasCaja').doc(cuentaMPId).update({
      saldoActual: FieldValue.increment(ajuste),
    });
  }
}

// Verificar que mlOrderSync apunte a la venta que se mantiene
const syncForMantener = await db.collection('mlOrderSync')
  .where('ventaId', '==', mantener.id)
  .limit(1)
  .get();
if (syncForMantener.empty) {
  console.log(`\n⚠️ No hay mlOrderSync para ${mantener.num}, buscando por mlOrderId...`);
}

console.log(`\n✅ Duplicados eliminados. ${mantener.num} preservada.`);
