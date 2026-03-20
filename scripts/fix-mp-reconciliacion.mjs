/**
 * CORRECCIÓN MERCADOPAGO - Script de reconciliación
 *
 * EJECUTAR EN MODO DRY-RUN PRIMERO:
 *   node --experimental-vm-modules scripts/fix-mp-reconciliacion.mjs
 *
 * EJECUTAR EN MODO REAL:
 *   APPLY=1 node --experimental-vm-modules scripts/fix-mp-reconciliacion.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const APPLY = process.env.APPLY === '1';

console.log(`\n🔧 MODO: ${APPLY ? '⚡ APLICAR CAMBIOS' : '👁️  DRY-RUN (solo muestra)'}\n`);

let totalCorreccion = 0;

// ═══════════════════════════════════════════════
// FIX 1: ANULAR AJUSTE ARTIFICIAL FLEX (S/ 65.10)
// ═══════════════════════════════════════════════
console.log('── FIX 1: Anular ajuste artificial Flex ──');

const ajQ = await db.collection('movimientosTesoreria')
  .where('concepto', '>=', 'Ajuste por ingreso')
  .where('concepto', '<=', 'Ajuste por ingreso\uf8ff')
  .get();

for (const m of ajQ.docs) {
  const d = m.data();
  if (d.cuentaDestino === mpId && d.estado !== 'anulado') {
    console.log(`  Anular: ${d.numeroMovimiento} | S/ ${d.monto} | ${d.concepto}`);
    totalCorreccion -= d.monto;
    if (APPLY) {
      await m.ref.update({
        estado: 'anulado',
        fechaAnulacion: Timestamp.now(),
        anuladoPor: 'fix-reconciliacion',
        motivoAnulacion: 'Ajuste artificial duplicado - envíos Flex ya incluidos en ingresos',
      });
    }
  }
}

// ═══════════════════════════════════════════════
// FIX 2: CORREGIR INGRESOS URBANO INFLADOS
// ═══════════════════════════════════════════════
console.log('\n── FIX 2: Corregir ingresos Urbano inflados ──');

const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
// Dedup por ventaId
const syncByVenta = new Map();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (!sd.ventaId || sd.metodoEnvio !== 'urbano') continue;
  // Preferir el sync con totalML mayor (pack consolidado)
  if (!syncByVenta.has(sd.ventaId) || sd.totalML > syncByVenta.get(sd.ventaId).totalML) {
    syncByVenta.set(sd.ventaId, sd);
  }
}

for (const [ventaId, sync] of syncByVenta) {
  const totalML = sync.totalML || 0;
  const cargoEnvML = sync.cargoEnvioML || 0;
  if (cargoEnvML <= 0) continue;

  // Buscar movimiento ingreso
  const mI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'ingreso_venta')
    .get();

  for (const m of mI.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaDestino !== mpId) continue;

    const ingresoActual = md.monto || 0;
    if (ingresoActual > totalML + 0.01) {
      const exceso = ingresoActual - totalML;
      console.log(`  ${sync.numeroVenta}: ingreso S/${ingresoActual} → S/${totalML} (reducir S/${exceso.toFixed(2)})`);
      totalCorreccion -= exceso;
      if (APPLY) {
        await m.ref.update({
          monto: totalML,
          montoEquivalentePEN: totalML,
          concepto: `${md.concepto} [corregido: costoEnvio removido de ingreso Urbano]`,
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════
// FIX 3: CREAR CARGO_ENVIO_ML EGRESOS FALTANTES
// ═══════════════════════════════════════════════
console.log('\n── FIX 3: Crear gastos cargo_envio_ml faltantes ──');

for (const [ventaId, sync] of syncByVenta) {
  const cargoEnvML = sync.cargoEnvioML || 0;
  if (cargoEnvML <= 0) continue;

  // Verificar si ya existe el gasto
  const existQ = await db.collection('gastos')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'cargo_envio_ml')
    .limit(1)
    .get();
  if (!existQ.empty) continue;

  // Verificar si ya existe un movimiento de cargo envío
  const existMov = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('tipo', '==', 'gasto_operativo')
    .get();
  let yaExisteEnvio = false;
  for (const m of existMov.docs) {
    if (m.data().estado !== 'anulado' && (m.data().concepto || '').includes('Cargo envío')) {
      yaExisteEnvio = true;
      break;
    }
  }
  if (yaExisteEnvio) continue;

  console.log(`  ${sync.numeroVenta}: crear cargo_envio_ml S/${cargoEnvML} + movimiento egreso`);
  totalCorreccion -= cargoEnvML;

  if (APPLY) {
    const now = Timestamp.now();
    const fecha = now.toDate();

    // Generar número de gasto
    const contQ = await db.collection('contadores').doc('gastos').get();
    const cont = contQ.exists ? (contQ.data().ultimo || 0) + 1 : 1;
    await db.collection('contadores').doc('gastos').set({ ultimo: cont }, { merge: true });
    const numGasto = `GAS-${String(cont).padStart(4, '0')}`;

    const gastoData = {
      numeroGasto: numGasto,
      tipo: 'cargo_envio_ml',
      categoria: 'GV',
      claseGasto: 'GVD',
      descripcion: `Cargo envío ML (Urbano) - Orden #${sync.mlOrderId} - ${sync.numeroVenta}`,
      moneda: 'PEN',
      montoOriginal: cargoEnvML,
      montoPEN: cargoEnvML,
      tipoCambio: 3.70,
      esProrrateable: false,
      ventaId,
      ventaNumero: sync.numeroVenta,
      mes: fecha.getMonth() + 1,
      anio: fecha.getFullYear(),
      fecha: now,
      esRecurrente: false,
      frecuencia: 'unico',
      estado: 'pagado',
      impactaCTRU: false,
      ctruRecalculado: true,
      montoPagado: cargoEnvML,
      montoPendiente: 0,
      creadoPor: 'fix-reconciliacion',
      fechaCreacion: now,
      pagos: [{
        id: `PAG-FIX-${Date.now()}`,
        fecha: now,
        monedaPago: 'PEN',
        montoOriginal: cargoEnvML,
        montoPEN: cargoEnvML,
        tipoCambio: 3.70,
        metodoPago: 'mercado_pago',
        cuentaOrigenId: mpId,
        registradoPor: 'fix-reconciliacion',
      }],
    };

    const gastoRef = await db.collection('gastos').add(gastoData);

    await db.collection('movimientosTesoreria').add({
      numeroMovimiento: `MOV-fix-envio-${Date.now()}`,
      tipo: 'gasto_operativo',
      estado: 'ejecutado',
      moneda: 'PEN',
      monto: cargoEnvML,
      tipoCambio: 3.70,
      metodo: 'mercado_pago',
      concepto: `Cargo envío ML (Urbano) - ${sync.numeroVenta} - Orden #${sync.mlOrderId} [fix-reconciliacion]`,
      gastoId: gastoRef.id,
      gastoNumero: numGasto,
      ventaId,
      ventaNumero: sync.numeroVenta,
      cuentaOrigen: mpId,
      fecha: now,
      creadoPor: 'fix-reconciliacion',
      fechaCreacion: now,
    });

    // Actualizar gastosVentaPEN en la venta
    await db.collection('ventas').doc(ventaId).update({
      cargoEnvioMLRegistrado: true,
      gastosVentaPEN: FieldValue.increment(cargoEnvML),
    });
  }
}

// ═══════════════════════════════════════════════
// FIX 4: VT-2026-062 COMISIÓN INCOMPLETA
// ═══════════════════════════════════════════════
console.log('\n── FIX 4: Corregir comisión VT-2026-062 (pack) ──');

// VT-2026-062 tiene comisionML=20.10 pero falta S/ 31.95 del segundo sub-order
const sync062 = await db.collection('mlOrderSync').doc('ml-2000015447992492').get();
if (sync062.exists) {
  const sd = sync062.data();
  const comFaltante = sd.comisionML || 31.95;

  // Verificar si ya existe gasto para este sub-order
  const existComQ = await db.collection('movimientosTesoreria')
    .where('concepto', '>=', 'Comisión ML - VT-2026-062')
    .where('concepto', '<=', 'Comisión ML - VT-2026-062\uf8ff')
    .get();

  let comRegistrada = 0;
  for (const m of existComQ.docs) {
    if (m.data().estado !== 'anulado') comRegistrada += m.data().monto || 0;
  }

  // Si solo hay una comisión (20.10), agregar la faltante
  if (comRegistrada < 52 && comRegistrada > 0) {
    const faltante = 52.05 - comRegistrada;
    if (faltante > 0.01) {
      console.log(`  VT-2026-062: comisión registrada S/${comRegistrada}, total debería ser S/52.05, faltante S/${faltante.toFixed(2)}`);
      totalCorreccion -= faltante;

      if (APPLY) {
        const now = Timestamp.now();
        // Buscar el ventaId
        const venta062 = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-062').limit(1).get();
        const ventaId062 = venta062.empty ? 'oT62lh9MR8RWM7dg9DCc' : venta062.docs[0].id;

        // Generar número de gasto
        const contQ = await db.collection('contadores').doc('gastos').get();
        const cont = contQ.exists ? (contQ.data().ultimo || 0) + 1 : 1;
        await db.collection('contadores').doc('gastos').set({ ultimo: cont }, { merge: true });
        const numGasto = `GAS-${String(cont).padStart(4, '0')}`;

        const gastoRef = await db.collection('gastos').add({
          numeroGasto: numGasto,
          tipo: 'comision_ml',
          categoria: 'GV',
          claseGasto: 'GVD',
          descripcion: `Comisión ML - Pack sub-orden #2000015447992492 - VT-2026-062 [fix-reconciliacion]`,
          moneda: 'PEN',
          montoOriginal: faltante,
          montoPEN: faltante,
          tipoCambio: 3.70,
          ventaId: ventaId062,
          ventaNumero: 'VT-2026-062',
          mes: 3, anio: 2026,
          fecha: now,
          estado: 'pagado',
          impactaCTRU: false,
          ctruRecalculado: true,
          montoPagado: faltante,
          montoPendiente: 0,
          creadoPor: 'fix-reconciliacion',
          fechaCreacion: now,
          pagos: [{
            id: `PAG-FIX-${Date.now()}`,
            fecha: now,
            monedaPago: 'PEN',
            montoOriginal: faltante,
            montoPEN: faltante,
            tipoCambio: 3.70,
            metodoPago: 'mercado_pago',
            cuentaOrigenId: mpId,
            registradoPor: 'fix-reconciliacion',
          }],
        });

        await db.collection('movimientosTesoreria').add({
          numeroMovimiento: `MOV-fix-com062-${Date.now()}`,
          tipo: 'gasto_operativo',
          estado: 'ejecutado',
          moneda: 'PEN',
          monto: faltante,
          tipoCambio: 3.70,
          metodo: 'mercado_pago',
          concepto: `Comisión ML - VT-2026-062 - Pack sub-orden #2000015447992492 [fix-reconciliacion]`,
          gastoId: gastoRef.id,
          gastoNumero: numGasto,
          ventaId: ventaId062,
          ventaNumero: 'VT-2026-062',
          cuentaOrigen: mpId,
          fecha: now,
          creadoPor: 'fix-reconciliacion',
          fechaCreacion: now,
        });

        // Actualizar comisionML en la venta
        await db.collection('ventas').doc(ventaId062).update({
          comisionML: 52.05,
          gastosVentaPEN: FieldValue.increment(faltante),
        });
      }
    }
  } else {
    console.log(`  VT-2026-062: comisión total ya registrada S/${comRegistrada} - skip`);
  }
}

// ═══════════════════════════════════════════════
// FIX 5: LIMPIAR MLORDERSYNC DUPLICADOS
// ═══════════════════════════════════════════════
console.log('\n── FIX 5: Limpiar mlOrderSync duplicados ──');

const allSync = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
const ventaMap = {};
for (const s of allSync.docs) {
  const sd = s.data();
  if (!sd.ventaId) continue;
  if (!ventaMap[sd.ventaId]) ventaMap[sd.ventaId] = [];
  ventaMap[sd.ventaId].push({ id: s.id, data: sd });
}

for (const [vid, syncs] of Object.entries(ventaMap)) {
  if (syncs.length <= 1) continue;

  // Mantener el que tiene mayor totalML (pack consolidado)
  syncs.sort((a, b) => (b.data.totalML || 0) - (a.data.totalML || 0));
  const keep = syncs[0];
  const remove = syncs.slice(1);

  for (const r of remove) {
    // Solo marcar como ignorada si es un duplicado exacto (mismo mlOrderId)
    if (r.data.mlOrderId === keep.data.mlOrderId) {
      console.log(`  ${keep.data.numeroVenta}: marcar ${r.id} como ignorada (dup de ${keep.id})`);
      if (APPLY) {
        await db.collection('mlOrderSync').doc(r.id).update({
          estado: 'ignorada',
          errorDetalle: `Duplicado consolidado en ${keep.id}`,
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  RESUMEN DE CORRECCIONES                                ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Recalcular saldo actual desde movimientos
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
console.log(`Corrección total aplicada a movimientos: S/ ${totalCorreccion.toFixed(2)}`);
console.log(`Saldo actual en sistema:                 S/ ${mpData.saldoActual.toFixed(2)}`);
console.log(`Saldo calculado desde movimientos:       S/ ${saldoCalc.toFixed(2)}`);
console.log(`Drift restante (sistema-calc):           S/ ${(mpData.saldoActual - saldoCalc).toFixed(2)}`);
console.log('');

if (!APPLY) {
  console.log('⚠ DRY-RUN: No se aplicaron cambios. Ejecuta con APPLY=1 para aplicar.');
  console.log('');
  console.log('Después de aplicar:');
  console.log('  1. Ejecuta este script con APPLY=1');
  console.log('  2. Ve a Tesorería → Cuentas → MercadoPago → click "Recalcular"');
  console.log('     (esto fijará el saldoActual al valor correcto basado en movimientos)');
  console.log('  3. Verifica que el saldo coincida con MercadoPago real');
} else {
  console.log('✅ Cambios aplicados. Ahora ve a Tesorería y haz click en "Recalcular".');
}
