/**
 * Audit: For each webhook venta with discrepancy,
 * find ALL gastos and movements linked to it (both by ventaId and by concepto/entrega)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Load mlOrderSync procesadas
const mlSyncs = await db.collection('mlOrderSync').get();
const procesadas = mlSyncs.docs
  .filter(d => d.data().estado === 'procesada')
  .map(d => ({ id: d.id, ...d.data() }));

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   DETALLE COMPLETO: Gastos y Movimientos por Venta Webhook');
console.log('═══════════════════════════════════════════════════════════════════\n');

for (const s of procesadas) {
  const vid = s.ventaId;
  if (!vid) continue;

  const met = s.metodoEnvio || '?';
  const com = s.comisionML || 0;
  const cargo = s.cargoEnvioML || 0;
  const envCli = s.costoEnvioCliente || 0;

  let dep;
  if (met === 'urbano') dep = s.totalML - com - cargo;
  else dep = s.totalML + envCli - com;

  console.log(`── ${s.numeroVenta} (${vid}) ──`);
  console.log(`   ML: total=${s.totalML} com=${com} ${met === 'urbano' ? 'cargo=' + cargo : 'envCli=' + envCli} met=${met}`);
  console.log(`   Depósito esperado: S/ ${dep.toFixed(2)}`);

  // Find ALL gastos linked to this venta
  const gastosSnap = await db.collection('gastos').where('ventaId', '==', vid).get();
  let totalGastosCom = 0;
  let totalGastosEnv = 0;
  let totalGastosOtro = 0;

  if (gastosSnap.empty) {
    console.log('   Gastos: NINGUNO vinculado');
  } else {
    console.log(`   Gastos vinculados (${gastosSnap.size}):`);
    for (const g of gastosSnap.docs) {
      const gd = g.data();
      const tipo = gd.tipo || gd.categoria || '?';
      const concepto = gd.concepto || gd.descripcion || '?';
      const monto = gd.monto || 0;
      const estado = gd.estado || 'activo';

      const isComision = concepto.toLowerCase().includes('comisi') || tipo === 'comision_ml';
      const isEnvio = concepto.toLowerCase().includes('entrega') || concepto.toLowerCase().includes('envío') || tipo === 'delivery';

      if (isComision) totalGastosCom += monto;
      else if (isEnvio) totalGastosEnv += monto;
      else totalGastosOtro += monto;

      console.log(`     ${g.id} | ${gd.numero || '?'} | ${concepto.substring(0, 60)} | S/${monto.toFixed(2)} | tipo:${tipo} | ${estado}`);
      console.log(`       cuentaCajaId: ${gd.cuentaCajaId || 'N/A'} | movimientoId: ${gd.movimientoId || 'N/A'}`);
    }
  }

  // Find ALL movimientos linked to this venta
  const movsSnap = await db.collection('movimientosTesoreria').where('ventaId', '==', vid).get();
  let totalMovIngreso = 0;
  let totalMovGastoCom = 0;
  let totalMovGastoEnv = 0;

  if (movsSnap.empty) {
    console.log('   Movimientos por ventaId: NINGUNO');
  } else {
    console.log(`   Movimientos por ventaId (${movsSnap.size}):`);
    for (const m of movsSnap.docs) {
      const md = m.data();
      const monto = md.monto || 0;
      const estado = md.estado || 'activo';
      const concepto = md.concepto || '?';
      const tipo = md.tipo || '?';

      if (tipo === 'ingreso_venta') totalMovIngreso += (estado !== 'anulado' ? monto : 0);
      if (['gasto_operativo', 'gasto'].includes(tipo) && md.cuentaOrigen === mpId && estado !== 'anulado') {
        if (concepto.toLowerCase().includes('comisi')) totalMovGastoCom += monto;
        else if (concepto.toLowerCase().includes('entrega') || concepto.toLowerCase().includes('envío')) totalMovGastoEnv += monto;
      }

      console.log(`     ${m.id} | ${md.numeroMovimiento || '?'} | ${tipo} | ${concepto.substring(0, 50)} | S/${monto.toFixed(2)} | ${estado}`);
    }
  }

  // Also find movements by gastoId
  for (const g of gastosSnap.docs) {
    const gd = g.data();
    if (gd.movimientoId) {
      const movDoc = await db.doc(`movimientosTesoreria/${gd.movimientoId}`).get();
      if (movDoc.exists) {
        const md = movDoc.data();
        const hasVentaId = md.ventaId === vid;
        if (!hasVentaId) {
          console.log(`   ⚠ Movimiento del gasto ${gd.numero} (${gd.movimientoId}) NO tiene ventaId!`);
          console.log(`     ${md.numeroMovimiento} | ${md.tipo} | ${md.concepto?.substring(0, 50)} | S/${md.monto} | ventaId: ${md.ventaId || 'NONE'}`);
        }
      }
    }
  }

  // Summary for this venta
  const netoMov = totalMovIngreso - totalMovGastoCom - totalMovGastoEnv;
  const diff = netoMov - dep;

  console.log('   ────────────────────────────────');
  console.log(`   Ingreso mov: S/${totalMovIngreso.toFixed(2)} | Gasto com mov: S/${totalMovGastoCom.toFixed(2)} | Gasto env mov: S/${totalMovGastoEnv.toFixed(2)}`);
  console.log(`   Gastos com: S/${totalGastosCom.toFixed(2)} | Gastos env: S/${totalGastosEnv.toFixed(2)}`);
  console.log(`   Neto (movimientos): S/${netoMov.toFixed(2)} vs Depósito ML: S/${dep.toFixed(2)} → diff: ${diff >= 0 ? '+' : ''}S/${diff.toFixed(2)}`);

  if (Math.abs(diff) > 0.5) {
    console.log(`   ❌ DISCREPANCIA: S/${diff.toFixed(2)}`);
    if (met === 'urbano' && cargo > 0) {
      console.log(`      ML cargo envío: S/${cargo} | Gasto envío registrado: S/${totalGastosEnv.toFixed(2)} | Mov envío: S/${totalMovGastoEnv.toFixed(2)}`);
      console.log(`      Faltante cargo: S/${(cargo - totalMovGastoEnv).toFixed(2)}`);
    }
    if (com > 0 && totalMovGastoCom < 0.01) {
      console.log(`      Comisión ML: S/${com} | NO registrada en movimientos`);
    }
  } else {
    console.log(`   ✅ OK`);
  }
  console.log('');
}

// Also show the recent manually-created delivery gastos (March 8)
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('   GASTOS DE ENTREGA RECIENTES (creados manualmente)');
console.log('═══════════════════════════════════════════════════════════════════\n');

const gastosRecientes = await db.collection('gastos')
  .where('cuentaCajaId', '==', mpId)
  .get();

for (const g of gastosRecientes.docs) {
  const gd = g.data();
  const concepto = (gd.concepto || gd.descripcion || '').toLowerCase();
  if (!concepto.includes('entrega')) continue;

  const fecha = gd.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) ||
                gd.fechaCreacion?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?';

  // Only show recent ones (March)
  if (!fecha.startsWith('2026-03')) continue;

  console.log(`  ${gd.numero || g.id} | ${gd.concepto || gd.descripcion || '?'} | S/${(gd.monto || 0).toFixed(2)} | ${fecha} | ventaId: ${gd.ventaId || 'NONE'}`);
}
