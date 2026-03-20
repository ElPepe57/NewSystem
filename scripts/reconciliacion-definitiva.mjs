/**
 * RECONCILIACIÓN DEFINITIVA - Desde cero
 * Fuente de verdad: mlOrderSync
 * Para cada venta: calcular ingreso correcto, verificar egresos, proponer ajustes
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const REAL_SALDO = 1816.15;

// 1. Load ALL data
const syncsSnap = await db.collection('mlOrderSync').get();
const syncs = [];
for (const s of syncsSnap.docs) {
  const sd = s.data();
  if (sd.estado === 'ignorada' || sd.estado === 'duplicada') continue;
  syncs.push({ id: s.id, ...sd });
}

// Movements from/to MP
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();

const ingresosByVenta = new Map();
const egresosByGasto = new Map();

for (const m of movsD.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (d.ventaId) {
    if (!ingresosByVenta.has(d.ventaId)) ingresosByVenta.set(d.ventaId, []);
    ingresosByVenta.get(d.ventaId).push({ id: m.id, ...d });
  }
}
for (const m of movsO.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (d.gastoId) {
    if (!egresosByGasto.has(d.gastoId)) egresosByGasto.set(d.gastoId, []);
    egresosByGasto.get(d.gastoId).push({ id: m.id, ...d });
  }
}

// Gastos by ventaId
const gastosSnap = await db.collection('gastos').get();
const gastosByVenta = new Map();
for (const g of gastosSnap.docs) {
  const gd = g.data();
  if (gd.ventaId && gd.estado !== 'anulado') {
    if (!gastosByVenta.has(gd.ventaId)) gastosByVenta.set(gd.ventaId, []);
    gastosByVenta.get(gd.ventaId).push({ id: g.id, ...gd });
  }
}

// Ventas
const ventasSnap = await db.collection('ventas').get();
const ventasById = new Map();
for (const v of ventasSnap.docs) ventasById.set(v.id, { id: v.id, ...v.data() });

// Group syncs by ventaId
const syncsByVenta = new Map();
for (const s of syncs) {
  if (!s.ventaId) continue;
  if (!syncsByVenta.has(s.ventaId)) syncsByVenta.set(s.ventaId, []);
  syncsByVenta.get(s.ventaId).push(s);
}

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('RECONCILIACIÓN DEFINITIVA - VENTA POR VENTA');
console.log(`Fuente de verdad: mlOrderSync | Saldo real MP: S/ ${REAL_SALDO}`);
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

const adjustments = [];
let totalAjusteIngreso = 0;
let totalAjusteComision = 0;
let totalAjusteCargo = 0;

for (const [ventaId, ventaSyncs] of syncsByVenta) {
  const venta = ventasById.get(ventaId);
  if (!venta) continue;
  const num = venta.numeroVenta;

  // Primary sync
  const sync = ventaSyncs.find(s => !s.packId) || ventaSyncs[0];
  const metodo = sync.metodoEnvio || venta.metodoEnvio || '?';
  const totalML = sync.totalML || 0;
  const comisionML = sync.comisionML || 0;
  const cargoEnvioML = sync.cargoEnvioML || 0;
  const costoEnvioCliente = sync.costoEnvioCliente || 0;

  // For packs: sum commissions
  let totalComisionML = ventaSyncs.reduce((s, sy) => s + (sy.comisionML || 0), 0);

  // CORRECT ingreso = what ML deposits before deductions
  // Flex: totalML + costoEnvioCliente (ML deposits product + bonificación)
  // Urbano: totalML (ML deposits product price, deducts cargo separately)
  let ingresoCorrect;
  if (metodo === 'flex') {
    ingresoCorrect = totalML + costoEnvioCliente;
  } else {
    ingresoCorrect = totalML;
  }

  // Current movements
  const ingresos = ingresosByVenta.get(ventaId) || [];
  const ingresoActual = ingresos.reduce((s, m) => s + (m.monto || 0), 0);

  const gastos = gastosByVenta.get(ventaId) || [];
  let comActual = 0, cargoActual = 0, deliveryActual = 0;
  for (const g of gastos) {
    const gMovs = egresosByGasto.get(g.id) || [];
    const mpTotal = gMovs.reduce((s, m) => s + (m.monto || 0), 0);
    if (g.tipo === 'comision_ml') comActual += mpTotal;
    else if (g.tipo === 'cargo_envio_ml') cargoActual += mpTotal;
    else if (g.tipo === 'delivery') deliveryActual += mpTotal;
  }

  // For Urbano: delivery covers cargo_envio if amounts are close
  const cargoEfectivo = cargoActual + deliveryActual;

  // Discrepancies
  const diffIngreso = Math.round((ingresoActual - ingresoCorrect) * 100) / 100;
  const diffComision = Math.round((comActual - totalComisionML) * 100) / 100;

  // For Urbano: check if cargo is covered
  let cargoFaltante = 0;
  if (metodo === 'urbano' && cargoEnvioML > 0) {
    cargoFaltante = Math.round((cargoEnvioML - cargoEfectivo) * 100) / 100;
    if (cargoFaltante < 0.50) cargoFaltante = 0;
  }

  const hasIssue = Math.abs(diffIngreso) > 0.50 || Math.abs(diffComision) > 0.50 || cargoFaltante > 0.50;

  if (hasIssue) {
    const adj = { num, ventaId, metodo, fixes: [] };

    if (Math.abs(diffIngreso) > 0.50) {
      adj.fixes.push({
        tipo: 'ingreso',
        actual: ingresoActual,
        correcto: ingresoCorrect,
        diff: diffIngreso,
        movId: ingresos[0]?.id,
      });
      totalAjusteIngreso += diffIngreso;
    }

    if (Math.abs(diffComision) > 0.50) {
      adj.fixes.push({
        tipo: 'comision',
        actual: comActual,
        correcto: totalComisionML,
        diff: diffComision,
        faltante: totalComisionML - comActual,
      });
      totalAjusteComision += (totalComisionML - comActual);
    }

    if (cargoFaltante > 0.50) {
      adj.fixes.push({
        tipo: 'cargo_envio',
        actual: cargoEfectivo,
        correcto: cargoEnvioML,
        faltante: cargoFaltante,
      });
      totalAjusteCargo += cargoFaltante;
    }

    adjustments.push(adj);
    console.log(`⚠ ${num} (${metodo}) | sync costoEnvio=${costoEnvioCliente}`);
    for (const f of adj.fixes) {
      if (f.tipo === 'ingreso') {
        const dir = f.diff > 0 ? '↓ reducir' : '↑ aumentar';
        console.log(`  Ingreso: S/${f.actual.toFixed(2)} → S/${f.correcto.toFixed(2)} (${dir} S/${Math.abs(f.diff).toFixed(2)})`);
      } else if (f.tipo === 'comision') {
        console.log(`  Comisión: S/${f.actual.toFixed(2)} → S/${f.correcto.toFixed(2)} (falta S/${f.faltante.toFixed(2)})`);
      } else if (f.tipo === 'cargo_envio') {
        console.log(`  Cargo envío: S/${f.actual.toFixed(2)} → S/${f.correcto.toFixed(2)} (falta S/${f.faltante.toFixed(2)})`);
      }
    }
  } else {
    console.log(`✓ ${num} (${metodo}) | ing:${ingresoActual.toFixed(2)} com:${comActual.toFixed(2)} cargo/del:${cargoEfectivo.toFixed(2)}`);
  }
}

// Ajuste Flex MOV-2026-0088
console.log('\n── Ajuste Flex artificial ──');
const ajusteQ = await db.collection('movimientosTesoreria')
  .where('numeroMovimiento', '==', 'MOV-2026-0088').get();
let ajusteMonto = 0;
for (const m of ajusteQ.docs) {
  const d = m.data();
  if (d.estado !== 'anulado' && d.cuentaDestino === mpId) {
    ajusteMonto = d.monto;
    console.log(`  ${d.numeroMovimiento}: +S/${d.monto} | ${d.concepto} | ANULAR`);
  }
}

// Summary
console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log('RESUMEN DE CORRECCIONES');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`Ventas a corregir: ${adjustments.length}`);

// By type
const byType = { ingreso: [], comision: [], cargo_envio: [] };
for (const adj of adjustments) {
  for (const f of adj.fixes) byType[f.tipo].push({ num: adj.num, metodo: adj.metodo, ...f });
}

if (byType.ingreso.length > 0) {
  console.log(`\n── Ingresos (${byType.ingreso.length}) ──`);
  for (const f of byType.ingreso) {
    const dir = f.diff > 0 ? '↓' : '↑';
    console.log(`  ${f.num} (${f.metodo}): S/${f.actual.toFixed(2)} → S/${f.correcto.toFixed(2)} ${dir}S/${Math.abs(f.diff).toFixed(2)}`);
  }
  console.log(`  Subtotal: ${totalAjusteIngreso > 0 ? '-' : '+'}S/ ${Math.abs(totalAjusteIngreso).toFixed(2)}`);
}

if (byType.comision.length > 0) {
  console.log(`\n── Comisiones faltantes (${byType.comision.length}) ──`);
  for (const f of byType.comision) {
    console.log(`  ${f.num}: falta S/${f.faltante.toFixed(2)}`);
  }
  console.log(`  Subtotal: -S/ ${totalAjusteComision.toFixed(2)}`);
}

if (byType.cargo_envio.length > 0) {
  console.log(`\n── Cargo envío faltante (${byType.cargo_envio.length}) ──`);
  for (const f of byType.cargo_envio) {
    console.log(`  ${f.num}: falta S/${f.faltante.toFixed(2)}`);
  }
  console.log(`  Subtotal: -S/ ${totalAjusteCargo.toFixed(2)}`);
}

// Projection
const saldoActual = 2137.65;
const totalFix = totalAjusteIngreso + totalAjusteComision + totalAjusteCargo + ajusteMonto;
const saldoPostFix = saldoActual - totalFix;

console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log('PROYECCIÓN FINAL');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`Saldo actual (movimientos):     S/ ${saldoActual.toFixed(2)}`);
console.log(`(-) Reducir ingresos inflados:  -S/ ${totalAjusteIngreso.toFixed(2)}`);
console.log(`(-) Comisiones faltantes:       -S/ ${totalAjusteComision.toFixed(2)}`);
console.log(`(-) Cargo envío faltante:       -S/ ${totalAjusteCargo.toFixed(2)}`);
console.log(`(-) Anular ajuste Flex:         -S/ ${ajusteMonto.toFixed(2)}`);
console.log(`────────────────────────────────────────`);
console.log(`Total corrección:               -S/ ${totalFix.toFixed(2)}`);
console.log(`Saldo proyectado:                S/ ${saldoPostFix.toFixed(2)}`);
console.log(`Saldo real MP:                   S/ ${REAL_SALDO.toFixed(2)}`);
console.log(`Diferencia residual:             S/ ${(saldoPostFix - REAL_SALDO).toFixed(2)}`);

if (Math.abs(saldoPostFix - REAL_SALDO) < 5) {
  console.log(`\n✅ ¡CUADRE LOGRADO! Diferencia < S/ 5 (redondeos)`);
} else {
  console.log(`\n⚠ Residual de S/ ${(saldoPostFix - REAL_SALDO).toFixed(2)} por investigar`);
  console.log(`Posibles causas:`);
  console.log(`  - Ventas Flex tempranas sin costoEnvioCliente en sync (bonificación no registrada)`);
  console.log(`  - VT-2026-037 (pago mixto banco+MP)`);
  console.log(`  - Diferencias entre delivery registrado y cargoEnvioML real`);
}

// Early Flex without bonification
console.log(`\n── Ventas Flex con costoEnvioCliente=0 en sync ──`);
let countMissingBonif = 0;
for (const [ventaId, ventaSyncs] of syncsByVenta) {
  const venta = ventasById.get(ventaId);
  if (!venta) continue;
  const sync = ventaSyncs[0];
  const metodo = sync.metodoEnvio || venta.metodoEnvio || '?';
  if (metodo !== 'flex') continue;
  if ((sync.costoEnvioCliente || 0) === 0) {
    const ingresos = ingresosByVenta.get(ventaId) || [];
    const ingreso = ingresos.reduce((s, m) => s + (m.monto || 0), 0);
    console.log(`  ${venta.numeroVenta}: ingreso=S/${ingreso} totalML=S/${sync.totalML} costoEnvio=0 | ML depositó más?`);
    countMissingBonif++;
  }
}
console.log(`  Total: ${countMissingBonif} ventas sin bonificación en sync`);
