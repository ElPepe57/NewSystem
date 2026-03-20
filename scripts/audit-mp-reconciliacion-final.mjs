/**
 * AUDITORÍA DEFINITIVA - Reconciliación MercadoPago
 *
 * Compara: saldo sistema vs movimientos vs realidad MercadoPago
 * Identifica: comisiones faltantes, envíos mal calculados, ajustes duplicados
 *
 * Ejecutar: node --experimental-vm-modules scripts/audit-mp-reconciliacion-final.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 1: SALDO DEL SISTEMA vs MOVIMIENTOS
// ═══════════════════════════════════════════════════════════════════
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  AUDITORÍA DEFINITIVA - RECONCILIACIÓN MERCADOPAGO      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
const saldoSistema = mpData.saldoActual;
const saldoInicial = mpData.saldoInicial || 0;

console.log(`Saldo sistema (saldoActual):  S/ ${saldoSistema.toFixed(2)}`);
console.log(`Saldo inicial configurado:    S/ ${saldoInicial.toFixed(2)}\n`);

// Obtener TODOS los movimientos de MP
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { doc: m, esOrigen: true, esDestino: false });
for (const m of movsD.docs) {
  if (allMovs.has(m.id)) allMovs.get(m.id).esDestino = true;
  else allMovs.set(m.id, { doc: m, esOrigen: false, esDestino: true });
}

// Calcular saldo desde movimientos (excluyendo anulados)
let totalIngresos = 0, totalEgresos = 0, totalTransfIn = 0, totalTransfOut = 0;
let countMovs = 0, countAnulados = 0;
const movsPorTipo = {};

for (const [id, { doc, esOrigen, esDestino }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') { countAnulados++; continue; }

  const monto = d.monto || 0;
  const tipo = d.tipo;
  countMovs++;

  if (!movsPorTipo[tipo]) movsPorTipo[tipo] = { count: 0, total: 0 };
  movsPorTipo[tipo].count++;
  movsPorTipo[tipo].total += monto;

  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) {
    totalIngresos += monto;
  } else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) {
    totalEgresos += monto;
  } else if (tipo === 'transferencia_interna') {
    if (esOrigen && !esDestino) totalTransfOut += monto;
    else if (esDestino && !esOrigen) totalTransfIn += monto;
  } else if (tipo === 'conversion_compra') {
    totalEgresos += monto;
  } else if (tipo === 'conversion_venta') {
    totalIngresos += monto;
  }
}

const saldoCalculado = saldoInicial + totalIngresos + totalTransfIn - totalEgresos - totalTransfOut;

console.log('── RESUMEN DE MOVIMIENTOS ──');
console.log(`Movimientos activos: ${countMovs} | Anulados: ${countAnulados}`);
console.log(`Total ingresos:      +S/ ${totalIngresos.toFixed(2)}`);
console.log(`Total transferencias: +S/ ${totalTransfIn.toFixed(2)} / -S/ ${totalTransfOut.toFixed(2)}`);
console.log(`Total egresos:       -S/ ${totalEgresos.toFixed(2)}`);
console.log(`Saldo calculado:      S/ ${saldoCalculado.toFixed(2)}`);
console.log(`Saldo sistema:        S/ ${saldoSistema.toFixed(2)}`);
console.log(`DRIFT (sistema-calc): S/ ${(saldoSistema - saldoCalculado).toFixed(2)}\n`);

console.log('Desglose por tipo:');
for (const [tipo, { count, total }] of Object.entries(movsPorTipo).sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${tipo.padEnd(25)} ${String(count).padStart(3)} movs  S/ ${total.toFixed(2)}`);
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 2: AUDITORÍA POR VENTA ML (webhook + manual)
// ═══════════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  SECCIÓN 2: AUDITORÍA POR VENTA ML                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Obtener todas las ventas de ML
const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
const syncMap = new Map();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.ventaId) syncMap.set(sd.ventaId, sd);
}

// Obtener todas las ventas canal ML
const ventasML1 = await db.collection('ventas').where('canal', '==', 'mercadolibre').get();
const ventasML2 = await db.collection('ventas').where('canal', '==', 'mercado_libre').get();
const allMLVentas = [...ventasML1.docs, ...ventasML2.docs];

console.log(`Ventas ML totales: ${allMLVentas.length}`);
console.log(`Con mlOrderSync: ${syncMap.size}`);
console.log(`Manuales (sin sync): ${allMLVentas.length - [...allMLVentas].filter(v => syncMap.has(v.id)).length}\n`);

// Para cada venta ML, comparar depósito esperado vs registrado
const problemas = [];
let totalDepositoEsperado = 0;
let totalNetoRegistrado = 0;
let totalDiferencia = 0;
let totalComisionEsperada = 0;
let totalComisionRegistrada = 0;
let totalEnvioFlex = 0;
let totalCargoUrbano = 0;

for (const ventaDoc of allMLVentas) {
  const vd = ventaDoc.data();
  const ventaId = ventaDoc.id;
  const numVenta = vd.numeroVenta || '?';

  // Datos de la venta
  const totalPEN = vd.totalPEN || 0;
  const costoEnvio = vd.costoEnvio || 0;
  const comisionML = vd.comisionML || 0;
  const metodoEnvio = vd.metodoEnvio || 'desconocido';
  const cargoEnvioML = vd.cargoEnvioML || 0;

  // Datos del sync (si existe)
  const sync = syncMap.get(ventaId);
  const syncTotalML = sync?.totalML || totalPEN - costoEnvio;
  const syncComision = sync?.comisionML || comisionML;
  const syncCostoEnvCli = sync?.costoEnvioCliente || costoEnvio;
  const syncCargoEnvML = sync?.cargoEnvioML || cargoEnvioML;
  const syncMetodo = sync?.metodoEnvio || metodoEnvio;

  // Calcular depósito esperado de ML
  let depositoEsperado;
  if (syncMetodo === 'urbano') {
    depositoEsperado = syncTotalML - syncComision - syncCargoEnvML;
    totalCargoUrbano += syncCargoEnvML;
  } else {
    // Flex o desconocido
    depositoEsperado = syncTotalML + syncCostoEnvCli - syncComision;
    if (syncMetodo === 'flex') totalEnvioFlex += syncCostoEnvCli;
  }
  totalDepositoEsperado += depositoEsperado;
  totalComisionEsperada += syncComision;

  // Movimientos registrados en tesorería para esta venta
  const mI = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId).where('tipo', '==', 'ingreso_venta').get();
  let ingMP = 0;
  const ingList = [];
  for (const m of mI.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaOrigen === mpId || md.cuentaDestino === mpId) {
      ingMP += md.monto || 0;
      ingList.push({ num: md.numeroMovimiento, monto: md.monto });
    }
  }

  // Gastos (comisión + envío)
  const mG = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId).where('tipo', '==', 'gasto_operativo').get();
  let gasComision = 0, gasEnvio = 0;
  const gasList = [];
  for (const m of mG.docs) {
    const md = m.data();
    if (md.estado === 'anulado') continue;
    if (md.cuentaOrigen === mpId) {
      const c = md.concepto || '';
      if (c.includes('envío') || c.includes('Entrega') || c.includes('Cargo envío') || c.includes('Urbano')) {
        gasEnvio += md.monto || 0;
        gasList.push({ tipo: 'ENV', num: md.numeroMovimiento, monto: md.monto });
      } else {
        gasComision += md.monto || 0;
        gasList.push({ tipo: 'COM', num: md.numeroMovimiento, monto: md.monto });
      }
    }
  }

  // También buscar gastos por tipo directamente
  const gastosComQ = await db.collection('gastos')
    .where('ventaId', '==', ventaId).where('tipo', '==', 'comision_ml').get();
  let gastoComRegistrado = 0;
  for (const g of gastosComQ.docs) {
    gastoComRegistrado += g.data().montoPEN || 0;
  }
  totalComisionRegistrada += gastoComRegistrado;

  const netoRegistrado = ingMP - gasComision - gasEnvio;
  const diff = netoRegistrado - depositoEsperado;
  totalNetoRegistrado += netoRegistrado;
  totalDiferencia += diff;

  // Detectar problemas
  const ventaProblemas = [];

  // 1. Comisión no registrada o diferente
  if (syncComision > 0 && Math.abs(gastoComRegistrado - syncComision) > 0.01) {
    ventaProblemas.push({
      tipo: 'COMISION_DIFF',
      desc: `Comisión esperada S/${syncComision.toFixed(2)} vs registrada S/${gastoComRegistrado.toFixed(2)}`,
      impacto: gastoComRegistrado - syncComision,
    });
  }

  // 2. Comisión sin movimiento de tesorería
  if (gastoComRegistrado > 0 && gasComision === 0 && gastoComRegistrado > 0) {
    ventaProblemas.push({
      tipo: 'COMISION_SIN_MOV_TESORERIA',
      desc: `Gasto comisión existe (S/${gastoComRegistrado.toFixed(2)}) pero sin movimiento de tesorería`,
      impacto: gastoComRegistrado,
    });
  }

  // 3. Urbano: cargo envío no registrado
  if (syncMetodo === 'urbano' && syncCargoEnvML > 0 && gasEnvio === 0) {
    ventaProblemas.push({
      tipo: 'CARGO_ENVIO_FALTANTE',
      desc: `Cargo envío Urbano S/${syncCargoEnvML.toFixed(2)} sin movimiento de tesorería`,
      impacto: syncCargoEnvML,
    });
  }

  // 4. Ingreso inflado (costoEnvio incluido para Urbano)
  if (syncMetodo === 'urbano' && ingMP > syncTotalML + 0.01) {
    ventaProblemas.push({
      tipo: 'INGRESO_INFLADO_URBANO',
      desc: `Ingreso S/${ingMP.toFixed(2)} > totalML S/${syncTotalML.toFixed(2)} (¿costoEnvio sumado?)`,
      impacto: ingMP - syncTotalML,
    });
  }

  // 5. Diferencia general
  if (Math.abs(diff) > 0.01 && ventaProblemas.length === 0) {
    ventaProblemas.push({
      tipo: 'DIFERENCIA_GENERAL',
      desc: `Neto registrado S/${netoRegistrado.toFixed(2)} vs esperado S/${depositoEsperado.toFixed(2)}`,
      impacto: diff,
    });
  }

  if (ventaProblemas.length > 0) {
    problemas.push({
      numVenta,
      metodo: syncMetodo,
      totalML: syncTotalML,
      comision: syncComision,
      envio: syncMetodo === 'flex' ? syncCostoEnvCli : syncCargoEnvML,
      depositoEsperado,
      ingMP,
      gasComision,
      gasEnvio,
      netoRegistrado,
      diff,
      problemas: ventaProblemas,
    });
  }
}

// Imprimir problemas
if (problemas.length > 0) {
  console.log(`\n❌ VENTAS CON DISCREPANCIAS: ${problemas.length}\n`);
  for (const p of problemas.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))) {
    console.log(`── ${p.numVenta} | ${p.metodo} | ML=S/${p.totalML.toFixed(2)} | depósito esperado=S/${p.depositoEsperado.toFixed(2)} ──`);
    console.log(`   Ingreso: S/${p.ingMP.toFixed(2)} | Gasto com: -S/${p.gasComision.toFixed(2)} | Gasto env: -S/${p.gasEnvio.toFixed(2)} | Neto: S/${p.netoRegistrado.toFixed(2)} | DIFF: ${p.diff >= 0 ? '+' : ''}S/${p.diff.toFixed(2)}`);
    for (const prob of p.problemas) {
      console.log(`   ⚠ ${prob.tipo}: ${prob.desc} (impacto: ${prob.impacto >= 0 ? '+' : ''}S/${prob.impacto.toFixed(2)})`);
    }
    console.log('');
  }
} else {
  console.log('\n✅ Todas las ventas ML cuadran correctamente\n');
}

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 3: AJUSTES MANUALES Y ARTIFICIALES
// ═══════════════════════════════════════════════════════════════════
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  SECCIÓN 3: AJUSTES MANUALES / ARTIFICIALES             ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const ajusteQ = await db.collection('movimientosTesoreria')
  .where('concepto', '>=', 'Ajuste')
  .where('concepto', '<=', 'Ajuste\uf8ff')
  .get();

let totalAjustes = 0;
for (const m of ajusteQ.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (d.cuentaOrigen === mpId || d.cuentaDestino === mpId) {
    const esIngreso = d.cuentaDestino === mpId;
    const signo = esIngreso ? '+' : '-';
    totalAjustes += esIngreso ? d.monto : -d.monto;
    console.log(`  ${d.numeroMovimiento} | ${d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10)} | ${signo}S/ ${d.monto} | ${d.concepto}`);
  }
}
console.log(`\nTotal ajustes manuales: S/ ${totalAjustes.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 4: INGRESOS NO-ML (adelantos cotización, etc.)
// ═══════════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  SECCIÓN 4: INGRESOS NO-ML EN MERCADOPAGO               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Buscar ingresos a MP que NO son de ventas ML
const mlVentaIds = new Set(allMLVentas.map(v => v.id));
let totalIngresosNoML = 0;
const ingresosNoML = [];

for (const [id, { doc }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  if (!['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(d.tipo)) continue;
  if (d.cuentaDestino !== mpId) continue;

  // Si tiene ventaId y es venta ML, skip
  if (d.ventaId && mlVentaIds.has(d.ventaId)) continue;

  totalIngresosNoML += d.monto || 0;
  ingresosNoML.push({
    num: d.numeroMovimiento,
    monto: d.monto || 0,
    concepto: (d.concepto || '').substring(0, 70),
    fecha: d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10),
    ventaId: d.ventaId || null,
    ventaNumero: d.ventaNumero || null,
  });
}

console.log(`Ingresos no-ML a MercadoPago: ${ingresosNoML.length}`);
for (const i of ingresosNoML) {
  console.log(`  ${i.num} | ${i.fecha} | S/ ${i.monto.toFixed(2)} | ${i.concepto}`);
  if (i.ventaNumero) console.log(`    → Venta: ${i.ventaNumero} (${i.ventaId})`);
}
console.log(`Total ingresos no-ML: S/ ${totalIngresosNoML.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 5: GASTOS URBANO/ENTREGAS
// ═══════════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  SECCIÓN 5: GASTOS DE ENTREGA (Urbano + otros)          ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Buscar gastos de entrega cargados a MP
let totalGastosEntrega = 0;
const gastosEntrega = [];

for (const [id, { doc }] of allMovs) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  if (d.cuentaOrigen !== mpId) continue;
  if (!['gasto_operativo', 'egreso', 'gasto'].includes(d.tipo)) continue;

  const concepto = d.concepto || '';
  if (concepto.includes('Entrega') || concepto.includes('Urbano') ||
      concepto.includes('envío') && !concepto.includes('Comisión')) {
    totalGastosEntrega += d.monto || 0;
    gastosEntrega.push({
      num: d.numeroMovimiento,
      monto: d.monto || 0,
      concepto: concepto.substring(0, 80),
      fecha: d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10),
      ventaNumero: d.ventaNumero || '',
    });
  }
}

console.log(`Gastos de entrega cargados a MP: ${gastosEntrega.length}`);
for (const g of gastosEntrega) {
  console.log(`  ${g.num} | ${g.fecha} | -S/ ${g.monto.toFixed(2)} | ${g.ventaNumero} | ${g.concepto}`);
}
console.log(`Total gastos entrega: S/ ${totalGastosEntrega.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════════
// SECCIÓN 6: RECONCILIACIÓN FINAL
// ═══════════════════════════════════════════════════════════════════
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  SECCIÓN 6: RECONCILIACIÓN FINAL                        ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Resumen
const totalProbImpacto = problemas.reduce((sum, p) => sum + p.diff, 0);

console.log('── TOTALES ML ──');
console.log(`Depósito esperado ML (todas ventas):     S/ ${totalDepositoEsperado.toFixed(2)}`);
console.log(`Neto registrado ML:                      S/ ${totalNetoRegistrado.toFixed(2)}`);
console.log(`Diferencia ML (exceso en sistema):        S/ ${totalDiferencia.toFixed(2)}`);
console.log(`Comisión esperada total:                  S/ ${totalComisionEsperada.toFixed(2)}`);
console.log(`Comisión registrada total:                S/ ${totalComisionRegistrada.toFixed(2)}`);
console.log(`Comisiones faltantes:                     S/ ${(totalComisionEsperada - totalComisionRegistrada).toFixed(2)}`);
console.log(`Envío Flex total:                        +S/ ${totalEnvioFlex.toFixed(2)}`);
console.log(`Cargo Urbano total:                      -S/ ${totalCargoUrbano.toFixed(2)}`);

console.log('\n── BALANCE ESPERADO EN MP ──');
const balanceEsperado = saldoInicial + totalDepositoEsperado + totalIngresosNoML + totalAjustes - totalGastosEntrega - totalTransfOut + totalTransfIn;
console.log(`Saldo inicial:                           S/ ${saldoInicial.toFixed(2)}`);
console.log(`+ Depósitos ML esperados:               +S/ ${totalDepositoEsperado.toFixed(2)}`);
console.log(`+ Ingresos no-ML:                       +S/ ${totalIngresosNoML.toFixed(2)}`);
console.log(`+ Ajustes manuales:                     +S/ ${totalAjustes.toFixed(2)}`);
console.log(`+ Transferencias entrantes:             +S/ ${totalTransfIn.toFixed(2)}`);
console.log(`- Gastos entrega (Urbano):              -S/ ${totalGastosEntrega.toFixed(2)}`);
console.log(`- Transferencias salientes:             -S/ ${totalTransfOut.toFixed(2)}`);
console.log(`= Balance esperado en MP:                S/ ${balanceEsperado.toFixed(2)}`);
console.log(`  Saldo sistema:                         S/ ${saldoSistema.toFixed(2)}`);
console.log(`  Diferencia (sistema - esperado):        S/ ${(saldoSistema - balanceEsperado).toFixed(2)}`);

console.log('\n── DIAGNÓSTICO ──');
console.log(`1. Drift saldo (sistema vs movimientos): S/ ${(saldoSistema - saldoCalculado).toFixed(2)}`);
console.log(`   → Si != 0, hay incrementos/decrementos sin movimiento correspondiente`);
console.log(`2. Exceso por ventas ML mal registradas:  S/ ${totalDiferencia.toFixed(2)}`);
console.log(`   → Comisiones/envíos no descontados = saldo inflado`);
console.log(`3. Ajuste artificial Flex:                S/ ${totalAjustes.toFixed(2)}`);
console.log(`   → Si las ventas ML ya cuadran, este ajuste está de MÁS`);

console.log('\n── ACCIONES SUGERIDAS ──');
if (Math.abs(saldoSistema - saldoCalculado) > 0.01) {
  console.log(`⚡ RECALCULAR saldoActual = S/ ${saldoCalculado.toFixed(2)} (basado en movimientos)`);
}
if (totalDiferencia > 0.01) {
  console.log(`⚡ CORREGIR ${problemas.length} ventas con discrepancias (total: S/ ${totalDiferencia.toFixed(2)})`);
}
if (totalAjustes > 0.01 && totalDiferencia < 0.01) {
  console.log(`⚡ ELIMINAR ajuste artificial S/ ${totalAjustes.toFixed(2)} (ventas ya cuadran)`);
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('FIN DE AUDITORÍA');
console.log('══════════════════════════════════════════════════════════\n');
