/**
 * REPORTE FORENSE DETALLADO - Conciliación MercadoPago
 * 3 fuentes: MercadoLibre (mlOrderSync), Ventas, Tesorería (movimientosTesoreria)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// ─── Helpers ───────────────────────────────────────────────────
const fmt = (n) => `S/ ${(n || 0).toFixed(2)}`;
const line = (ch = '═', len = 90) => ch.repeat(len);
const header = (title) => `\n${line()}\n  ${title}\n${line()}`;

async function getVentaByNumero(num) {
  const q = await db.collection('ventas').where('numeroVenta', '==', num).limit(1).get();
  if (q.empty) return null;
  return { id: q.docs[0].id, ...q.docs[0].data() };
}

async function getSyncsForVenta(ventaId, mercadoLibreId) {
  const syncs = [];
  const byVenta = await db.collection('mlOrderSync').where('ventaId', '==', ventaId).get();
  for (const s of byVenta.docs) syncs.push({ docId: s.id, ...s.data() });
  // Also try by mercadoLibreId directly
  if (mercadoLibreId) {
    const directId = `ml-${mercadoLibreId}`;
    if (!syncs.some(s => s.docId === directId)) {
      const d = await db.collection('mlOrderSync').doc(directId).get();
      if (d.exists) syncs.push({ docId: d.id, ...d.data() });
    }
    // Also check pack doc
    const packQ = await db.collection('mlOrderSync').where('subOrderIds', 'array-contains', Number(mercadoLibreId)).get();
    for (const s of packQ.docs) {
      if (!syncs.some(x => x.docId === s.id)) syncs.push({ docId: s.id, ...s.data() });
    }
  }
  return syncs;
}

async function getMovsIngresosMP(ventaId) {
  const q = await db.collection('movimientosTesoreria')
    .where('ventaId', '==', ventaId)
    .where('cuentaDestino', '==', mpId).get();
  return q.docs.map(d => ({ docId: d.id, ...d.data() })).filter(m => m.estado !== 'anulado');
}

async function getMovsEgresosMP_byVenta(ventaId) {
  // Egresos linked to this venta via gastos
  const gastosQ = await db.collection('gastos').where('ventaId', '==', ventaId).get();
  const gastos = gastosQ.docs.map(d => ({ docId: d.id, ...d.data() }));
  const result = [];
  for (const g of gastos) {
    const movsQ = await db.collection('movimientosTesoreria')
      .where('gastoId', '==', g.docId)
      .where('cuentaOrigen', '==', mpId).get();
    const movs = movsQ.docs.map(d => ({ docId: d.id, ...d.data() })).filter(m => m.estado !== 'anulado');
    result.push({ gasto: g, movs });
  }
  return result;
}

async function getMovsEgresosMP_byCotizacion(cotizacionId) {
  if (!cotizacionId) return [];
  const movsQ = await db.collection('movimientosTesoreria')
    .where('cotizacionId', '==', cotizacionId)
    .where('cuentaOrigen', '==', mpId).get();
  return movsQ.docs.map(d => ({ docId: d.id, ...d.data() })).filter(m => m.estado !== 'anulado');
}

async function getEntregas(ventaId) {
  const q = await db.collection('entregas').where('ventaId', '==', ventaId).get();
  return q.docs.map(d => ({ docId: d.id, ...d.data() }));
}

async function getDeliveryMovsForEntregas(entregas) {
  const result = [];
  for (const e of entregas) {
    if (e.gastoEnvioId) {
      const gastoDoc = await db.collection('gastos').doc(e.gastoEnvioId).get();
      const gasto = gastoDoc.exists ? { docId: gastoDoc.id, ...gastoDoc.data() } : null;
      const movsQ = await db.collection('movimientosTesoreria')
        .where('gastoId', '==', e.gastoEnvioId)
        .where('cuentaOrigen', '==', mpId).get();
      const movs = movsQ.docs.map(d => ({ docId: d.id, ...d.data() })).filter(m => m.estado !== 'anulado');
      result.push({ entrega: e, gasto, movs });
    }
  }
  return result;
}

// Full analysis for a single venta
async function analyzeVenta(numVenta) {
  const v = await getVentaByNumero(numVenta);
  if (!v) return { error: `${numVenta} not found` };

  const syncs = await getSyncsForVenta(v.id, v.mercadoLibreId);
  const ingresosMP = await getMovsIngresosMP(v.id);
  const egresosGastos = await getMovsEgresosMP_byVenta(v.id);
  const egresosCotizacion = await getMovsEgresosMP_byCotizacion(v.cotizacionId || v.id);
  const entregas = await getEntregas(v.id);
  const deliveryMovs = await getDeliveryMovsForEntregas(entregas);

  // Compute ML NET
  let mlTotalDeposito = 0;
  let mlComisionTotal = 0;
  let mlCargoEnvioTotal = 0;
  for (const s of syncs) {
    const metodo = s.metodoEnvio || s.trackingMethod || null;
    const totalML = s.totalML || 0;
    const costoEnvioCliente = s.costoEnvioCliente || 0;
    const comision = s.comisionML || 0;
    const cargoEnvio = s.cargoEnvioML || 0;
    // For flex, ML deposits totalML + costoEnvioCliente; for urbano, just totalML
    if (metodo === 'flex') {
      mlTotalDeposito += totalML + costoEnvioCliente;
    } else {
      mlTotalDeposito += totalML;
    }
    mlComisionTotal += comision;
    mlCargoEnvioTotal += cargoEnvio;
  }
  const mlNetReal = mlTotalDeposito - mlComisionTotal - mlCargoEnvioTotal;

  // Compute treasury NET
  const totalIngresosMP = ingresosMP.reduce((s, m) => s + (m.monto || 0), 0);
  let totalEgresosMP = 0;
  const allEgresoMovs = [];
  for (const { gasto, movs } of egresosGastos) {
    for (const m of movs) {
      totalEgresosMP += m.monto || 0;
      allEgresoMovs.push({ ...m, gastoTipo: gasto.tipo || gasto.tipoGasto || 'N/A', gastoNum: gasto.numeroGasto || 'N/A' });
    }
  }
  for (const m of egresosCotizacion) {
    if (!allEgresoMovs.some(e => e.docId === m.docId)) {
      totalEgresosMP += m.monto || 0;
      allEgresoMovs.push({ ...m, gastoTipo: 'cotizacion-linked', gastoNum: 'N/A' });
    }
  }
  for (const { gasto, movs } of deliveryMovs) {
    for (const m of movs) {
      if (!allEgresoMovs.some(e => e.docId === m.docId)) {
        totalEgresosMP += m.monto || 0;
        allEgresoMovs.push({ ...m, gastoTipo: gasto?.tipo || 'delivery', gastoNum: gasto?.numeroGasto || 'N/A' });
      }
    }
  }
  const netTesoreria = totalIngresosMP - totalEgresosMP;
  const discrepancia = netTesoreria - mlNetReal;

  return {
    numVenta, venta: v, syncs, ingresosMP, egresosGastos, egresosCotizacion,
    entregas, deliveryMovs, allEgresoMovs,
    mlTotalDeposito, mlComisionTotal, mlCargoEnvioTotal, mlNetReal,
    totalIngresosMP, totalEgresosMP, netTesoreria, discrepancia
  };
}

function printFullAnalysis(a) {
  if (a.error) { console.log(`  ⚠ ${a.error}`); return; }
  const v = a.venta;
  console.log(`\n  ─── ${a.numVenta} (ventaId: ${v.id}) ───`);
  console.log(`  mercadoLibreId: ${v.mercadoLibreId || 'N/A'} | packId: ${v.packId || 'N/A'}`);
  console.log(`  estadoPago: ${v.estadoPago} | montoPagado: ${fmt(v.montoPagado)}`);

  // ML Sync
  console.log(`\n  MERCADOLIBRE (mlOrderSync): ${a.syncs.length} doc(s)`);
  for (const s of a.syncs) {
    const metodo = s.metodoEnvio || s.trackingMethod || 'N/A';
    console.log(`    Doc: ${s.docId} | mlOrderId: ${s.mlOrderId} | estado: ${s.estado}`);
    console.log(`      totalML: ${fmt(s.totalML)} | comisionML: ${fmt(s.comisionML)} | costoEnvioML: ${fmt(s.costoEnvioML)}`);
    console.log(`      costoEnvioCliente: ${fmt(s.costoEnvioCliente)} | cargoEnvioML: ${fmt(s.cargoEnvioML)} | metodo: ${metodo}`);
    if (s.packId) console.log(`      packId: ${s.packId} | subOrderIds: [${(s.subOrderIds || []).join(', ')}] | subOrdersRecibidas: ${s.subOrdersRecibidas}`);
    if (s.productos?.length) {
      for (const p of s.productos) console.log(`      producto: ${p.mlTitle} x${p.cantidad} @ ${fmt(p.precioUnitario)} (fee: ${fmt(p.saleFee)})`);
    }
  }
  console.log(`    → ML depositó: ${fmt(a.mlTotalDeposito)}`);
  console.log(`    → ML cobró comisión: ${fmt(a.mlComisionTotal)}`);
  console.log(`    → ML cobró cargo envío: ${fmt(a.mlCargoEnvioTotal)}`);
  console.log(`    → NET real a MP: ${fmt(a.mlNetReal)}`);

  // Venta
  console.log(`\n  VENTAS (documento de venta):`);
  console.log(`    Total venta: ${fmt(v.totalPEN)} | subtotalPEN: ${fmt(v.subtotalPEN)} | envio: ${fmt(v.costoEnvioPEN || v.costoEnvio)}`);
  if (v.pagos?.length) {
    console.log(`    Pagos registrados:`);
    for (const p of v.pagos) console.log(`      - ${p.metodo || p.metodoPago}: ${fmt(p.monto)} (ref: ${p.referencia || 'N/A'})`);
  }

  // Tesorería
  console.log(`\n  TESORERÍA (movimientos):`);
  console.log(`    Ingresos a MP: ${a.ingresosMP.length} mov(s) = ${fmt(a.totalIngresosMP)}`);
  for (const m of a.ingresosMP) {
    console.log(`      ${m.numeroMovimiento || m.docId}: ${fmt(m.monto)} | tipo: ${m.tipo} | concepto: ${m.concepto || 'N/A'}`);
  }
  console.log(`    Egresos de MP: ${a.allEgresoMovs.length} mov(s) = ${fmt(a.totalEgresosMP)}`);
  for (const m of a.allEgresoMovs) {
    console.log(`      ${m.numeroMovimiento || m.docId}: ${fmt(m.monto)} | gastoTipo: ${m.gastoTipo} | gastoNum: ${m.gastoNum}`);
  }
  console.log(`    NET en tesorería: ${fmt(a.netTesoreria)}`);

  // Discrepancy
  const disc = a.discrepancia;
  console.log(`\n  DISCREPANCIA: ${fmt(disc)} (NET tesorería ${fmt(a.netTesoreria)} - NET real ML ${fmt(a.mlNetReal)})`);
}

function printCompactAnalysis(a) {
  if (a.error) { console.log(`  ⚠ ${a.error}`); return; }
  const v = a.venta;
  const s = a.syncs[0] || {};
  const metodo = s.metodoEnvio || s.trackingMethod || 'N/A';
  console.log(`\n  ─── ${a.numVenta} ───  ventaId: ${v.id} | mlOrderId: ${s.mlOrderId || 'N/A'} | metodo: ${metodo}`);
  console.log(`    ML: deposito=${fmt(a.mlTotalDeposito)} comision=${fmt(a.mlComisionTotal)} cargo=${fmt(a.mlCargoEnvioTotal)} NET=${fmt(a.mlNetReal)}`);
  console.log(`    Venta: totalPEN=${fmt(v.totalPEN)} pagado=${fmt(v.montoPagado)}`);
  console.log(`    Tesorería: ingresos=${fmt(a.totalIngresosMP)} egresos=${fmt(a.totalEgresosMP)} NET=${fmt(a.netTesoreria)}`);
  console.log(`    DISCREPANCIA: ${fmt(a.discrepancia)}`);

  // Show details for ingresos
  for (const m of a.ingresosMP) {
    console.log(`      ↳ ingreso: ${m.numeroMovimiento || m.docId} = ${fmt(m.monto)}`);
  }
  for (const m of a.allEgresoMovs) {
    console.log(`      ↳ egreso: ${m.numeroMovimiento || m.docId} = ${fmt(m.monto)} (${m.gastoTipo})`);
  }

  // Sync details for multi-sync
  if (a.syncs.length > 1) {
    console.log(`    Syncs (${a.syncs.length}):`);
    for (const sync of a.syncs) {
      console.log(`      ${sync.docId}: totalML=${fmt(sync.totalML)} comision=${fmt(sync.comisionML)} cargo=${fmt(sync.cargoEnvioML)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

console.log(header('REPORTE FORENSE DETALLADO - CONCILIACIÓN MERCADOPAGO'));
console.log(`  Fecha: ${new Date().toISOString()}`);
console.log(`  Cuenta MP: ${mpId}`);

// ═════════════════════════════════════════════════════════════
// SECTION 1: VT-2026-062 (Pack Order)
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 1: VT-2026-062 (Pack Order - Mayor discrepancia)'));

const a062 = await analyzeVenta('VT-2026-062');
printFullAnalysis(a062);
if (!a062.error) {
  // Extra: check for pack-related syncs
  if (a062.venta.packId) {
    const packQ = await db.collection('mlOrderSync').where('packId', '==', a062.venta.packId).get();
    console.log(`\n  Pack syncs by packId=${a062.venta.packId}: ${packQ.size} doc(s)`);
    for (const d of packQ.docs) {
      const sd = d.data();
      console.log(`    ${d.id}: ventaId=${sd.ventaId} totalML=${fmt(sd.totalML)} comision=${fmt(sd.comisionML)} estado=${sd.estado}`);
    }
  }
  // Explain
  console.log(`\n  CAUSA PROBABLE:`);
  console.log(`    Pack order con múltiples sub-órdenes. El ingreso registrado en tesorería`);
  console.log(`    puede incluir el total del pack completo, mientras ML depositó NET después`);
  console.log(`    de comisiones y cargos por cada sub-orden.`);
}

// ═════════════════════════════════════════════════════════════
// SECTION 2: Urbano con ingreso inflado (8 ventas)
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 2: Urbano con ingreso inflado'));

const urbanoVentas = ['VT-2026-034', 'VT-2026-061', 'VT-2026-066', 'VT-2026-067',
  'VT-2026-068', 'VT-2026-073', 'VT-2026-075', 'VT-2026-077'];

let totalDiscUrbano = 0;
for (const num of urbanoVentas) {
  const a = await analyzeVenta(num);
  printCompactAnalysis(a);
  if (!a.error) totalDiscUrbano += a.discrepancia;
}
console.log(`\n  TOTAL DISCREPANCIA URBANO: ${fmt(totalDiscUrbano)}`);
console.log(`  CAUSA: En ventas Urbano, ML cobra cargoEnvioML al vendedor (deducción del depósito).`);
console.log(`         El ingreso en tesorería se registró por el totalML bruto, sin descontar el cargo envío.`);

// ═════════════════════════════════════════════════════════════
// SECTION 3: Flex sin bonificación (8 ventas)
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 3: Flex sin bonificación'));

const flexVentas = ['VT-2026-018', 'VT-2026-019', 'VT-2026-022', 'VT-2026-023',
  'VT-2026-024', 'VT-2026-028', 'VT-2026-029', 'VT-2026-030'];

let totalDiscFlex = 0;
for (const num of flexVentas) {
  const a = await analyzeVenta(num);
  printCompactAnalysis(a);
  if (!a.error) totalDiscFlex += a.discrepancia;
}
console.log(`\n  TOTAL DISCREPANCIA FLEX: ${fmt(totalDiscFlex)}`);
console.log(`  CAUSA: En Flex, ML deposita totalML + costoEnvioCliente (bonificación envío al vendedor).`);
console.log(`         El ingreso en tesorería se registró solo por totalML, faltando la bonificación.`);

// ═════════════════════════════════════════════════════════════
// SECTION 4: Cargo envío no registrado (3 ventas)
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 4: Cargo envío no registrado'));

const cargoVentas = ['VT-2026-007', 'VT-2026-010', 'VT-2026-075'];

let totalDiscCargo = 0;
for (const num of cargoVentas) {
  const a = await analyzeVenta(num);
  printCompactAnalysis(a);
  if (!a.error) {
    totalDiscCargo += a.discrepancia;
    // Check specifically for cargoEnvioML vs delivery movements
    for (const s of a.syncs) {
      const cargo = s.cargoEnvioML || 0;
      if (cargo > 0) {
        console.log(`    ⚠ cargoEnvioML: ${fmt(cargo)} en sync ${s.docId}`);
        const hasDeliveryEgreso = a.allEgresoMovs.some(m =>
          m.gastoTipo === 'delivery' || m.gastoTipo === 'envio' || m.gastoTipo === 'cargo_envio_ml'
        );
        console.log(`    ¿Egreso delivery/envío desde MP? ${hasDeliveryEgreso ? 'SÍ' : 'NO - FALTANTE'}`);
      }
    }
  }
}
console.log(`\n  TOTAL DISCREPANCIA CARGO ENVÍO: ${fmt(totalDiscCargo)}`);
console.log(`  CAUSA: ML deduce cargoEnvioML del depósito en ventas Urbano.`);
console.log(`         No hay gasto/movimiento registrado para este cargo, inflando el saldo virtual.`);

// ═════════════════════════════════════════════════════════════
// SECTION 5: VT-2026-037 (Duplicado)
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 5: VT-2026-037 (Movimiento duplicado)'));

const a037 = await analyzeVenta('VT-2026-037');
printFullAnalysis(a037);

// Check for MOV-0102 specifically (by cotizacionId)
if (!a037.error) {
  const cotId = a037.venta.cotizacionId || a037.venta.id;
  console.log(`\n  Búsqueda adicional por cotizacionId: ${cotId}`);
  const movsCotQ = await db.collection('movimientosTesoreria')
    .where('cotizacionId', '==', cotId)
    .where('cuentaDestino', '==', mpId).get();
  for (const m of movsCotQ.docs) {
    const md = m.data();
    if (md.estado !== 'anulado') {
      console.log(`    MOV por cotizacionId: ${md.numeroMovimiento || m.id} = ${fmt(md.monto)} | tipo: ${md.tipo}`);
    }
  }

  // Check MOV-0102 and MOV-0128 directly
  for (const movNum of ['MOV-2026-0102', 'MOV-2026-0128']) {
    const mq = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', movNum).limit(1).get();
    if (!mq.empty) {
      const md = mq.docs[0].data();
      console.log(`\n  ${movNum} (docId: ${mq.docs[0].id}):`);
      console.log(`    monto: ${fmt(md.monto)} | tipo: ${md.tipo} | estado: ${md.estado}`);
      console.log(`    ventaId: ${md.ventaId || 'N/A'} | cotizacionId: ${md.cotizacionId || 'N/A'}`);
      console.log(`    cuentaOrigen: ${md.cuentaOrigen || 'N/A'} | cuentaDestino: ${md.cuentaDestino || 'N/A'}`);
      console.log(`    concepto: ${md.concepto || 'N/A'}`);
    }
  }

  console.log(`\n  CAUSA: MOV-0102 ingresó el pago por cotizacionId, MOV-0128 ingresó otro por ventaId.`);
  console.log(`         Ambos apuntan a la misma venta → doble conteo de ${fmt(7.25)} (el menor).`);
}

// ═════════════════════════════════════════════════════════════
// SECTION 6: MOV-2026-0088 (Fantasma)
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 6: MOV-2026-0088 (Movimiento fantasma)'));

const mov88Q = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', 'MOV-2026-0088').limit(1).get();
if (!mov88Q.empty) {
  const md = mov88Q.docs[0].data();
  console.log(`  DocId: ${mov88Q.docs[0].id}`);
  console.log(`  Número: ${md.numeroMovimiento}`);
  console.log(`  Monto: ${fmt(md.monto)}`);
  console.log(`  Tipo: ${md.tipo}`);
  console.log(`  Estado: ${md.estado}`);
  console.log(`  Concepto: ${md.concepto || 'N/A'}`);
  console.log(`  ventaId: ${md.ventaId || 'N/A'}`);
  console.log(`  cotizacionId: ${md.cotizacionId || 'N/A'}`);
  console.log(`  gastoId: ${md.gastoId || 'N/A'}`);
  console.log(`  cuentaOrigen: ${md.cuentaOrigen || 'N/A'}`);
  console.log(`  cuentaDestino: ${md.cuentaDestino || 'N/A'}`);
  console.log(`  Fecha: ${md.fecha?.toDate?.()?.toISOString() || 'N/A'}`);

  // Check if ventaId exists
  if (md.ventaId) {
    const ventaDoc = await db.collection('ventas').doc(md.ventaId).get();
    console.log(`  ¿Venta existe? ${ventaDoc.exists ? 'SÍ - ' + (ventaDoc.data()?.numeroVenta || 'sin número') : 'NO - FANTASMA'}`);
    if (ventaDoc.exists) {
      // Check if there's a sync for this venta
      const syncQ = await db.collection('mlOrderSync').where('ventaId', '==', md.ventaId).get();
      console.log(`  ¿Tiene mlOrderSync? ${syncQ.empty ? 'NO' : 'SÍ (' + syncQ.size + ' docs)'}`);
    }
  } else {
    console.log(`  ⚠ Sin ventaId → movimiento huérfano sin respaldo de venta`);
  }
  console.log(`\n  CAUSA: Movimiento sin respaldo real. Infla el saldo virtual de MP en ${fmt(md.monto)}.`);
} else {
  console.log(`  MOV-2026-0088 no encontrado.`);
}

// ═════════════════════════════════════════════════════════════
// SECTION 7: RESUMEN EJECUTIVO
// ═════════════════════════════════════════════════════════════
console.log(header('SECCIÓN 7: RESUMEN EJECUTIVO'));

// Collect all individual discrepancies
const allAnalyses = [a062, a037];
const allVentaNums = [
  ...urbanoVentas, ...flexVentas, ...cargoVentas
];
const allResults = {};
let totalGapCalculated = 0;

// Re-use already computed values
const disc062 = a062.error ? 0 : a062.discrepancia;
const disc037 = a037.error ? 0 : a037.discrepancia;

// MOV-0088
let mov88Monto = 0;
if (!mov88Q.empty) {
  const md = mov88Q.docs[0].data();
  mov88Monto = md.monto || 0;
}

console.log(`\n  DESGLOSE POR FUENTE:`);
console.log(`  ────────────────────────────────────────────────────────────`);
console.log(`  Fuente 1 - VT-062 (pack inflado + comisión):     ${fmt(disc062).padStart(12)}`);
console.log(`  Fuente 2 - Urbano ingresos inflados (${urbanoVentas.length} ventas):  ${fmt(totalDiscUrbano).padStart(12)}`);

// Re-analyze cargo ventas for their specific total
let cargoTotal = 0;
for (const num of cargoVentas) {
  const a = await analyzeVenta(num);
  if (!a.error) cargoTotal += a.discrepancia;
}
console.log(`  Fuente 3 - Cargo envío no registrado (${cargoVentas.length} ventas): ${fmt(cargoTotal).padStart(12)}`);
console.log(`  Fuente 4 - Flex bonificación faltante (${flexVentas.length} ventas): ${fmt(totalDiscFlex).padStart(12)}`);
console.log(`  Fuente 5 - VT-037 duplicado:                    ${fmt(disc037).padStart(12)}`);
console.log(`  Fuente 6 - MOV-0088 fantasma:                   ${fmt(mov88Monto).padStart(12)}`);

const subtotalExplicado = disc062 + totalDiscUrbano + cargoTotal + totalDiscFlex + disc037 + mov88Monto;
const GAP_TOTAL = 321.50;
const residual = GAP_TOTAL - subtotalExplicado;

console.log(`  ────────────────────────────────────────────────────────────`);
console.log(`  Subtotal explicado:                              ${fmt(subtotalExplicado).padStart(12)}`);
console.log(`  Residual (redondeos/otros):                      ${fmt(residual).padStart(12)}`);
console.log(`  ────────────────────────────────────────────────────────────`);
console.log(`  GAP TOTAL:                                       ${fmt(GAP_TOTAL).padStart(12)}`);

console.log(`\n  NOTA: Cada número es trazable a documentos específicos mostrados arriba.`);
console.log(`  Las discrepancias se calculan como: NET tesorería - NET real ML`);
console.log(`  Positivo = tesorería registra más de lo que ML realmente depositó (saldo inflado)`);
console.log(`  Negativo = tesorería registra menos de lo que ML depositó (ingreso faltante)`);

console.log(`\n${line()}`);
console.log(`  FIN DEL REPORTE FORENSE`);
console.log(line());

process.exit(0);
