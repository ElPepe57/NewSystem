/**
 * Simulación hipotética: ¿Cómo quedaría el cuadre si aplicamos todas las correcciones?
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';
const SALDO_REAL = 2677.51;

// ═══ Paso 1: Saldo actual desde movimientos activos ═══
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const all = new Map();
for (const m of movsO.docs) all.set(m.id, { doc: m, esO: true, esD: false });
for (const m of movsD.docs) {
  if (all.has(m.id)) all.get(m.id).esD = true;
  else all.set(m.id, { doc: m, esO: false, esD: true });
}

let saldoActivos = 0;
for (const [id, { doc, esO, esD }] of all) {
  const d = doc.data();
  if (d.estado === 'anulado') continue;
  const monto = d.monto || 0;
  const tipo = d.tipo;
  if (['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(tipo)) saldoActivos += monto;
  else if (['gasto_operativo', 'egreso', 'gasto'].includes(tipo)) saldoActivos -= monto;
  else if (tipo === 'transferencia_interna') {
    if (esO && !esD) saldoActivos -= monto;
    else if (esD && !esO) saldoActivos += monto;
  }
  else if (tipo === 'conversion_compra') saldoActivos -= monto;
  else if (tipo === 'conversion_venta') saldoActivos += monto;
}

const mpData = (await db.collection('cuentasCaja').doc(mpId).get()).data();
const saldoSistema = mpData.saldoActual;

console.log('═══════════════════════════════════════════════════════════');
console.log('       SIMULACIÓN DE CUADRE FINANCIERO');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('╔═══════════════════════════════════════════════╗');
console.log('║          ESTADO ACTUAL (ANTES)                ║');
console.log('╠═══════════════════════════════════════════════╣');
console.log(`║ saldoActual (sistema):     S/ ${saldoSistema.toFixed(2).padStart(10)}   ║`);
console.log(`║ Calculado (movimientos):   S/ ${saldoActivos.toFixed(2).padStart(10)}   ║`);
console.log(`║ Saldo real MercadoPago:    S/ ${SALDO_REAL.toFixed(2).padStart(10)}   ║`);
console.log('╠═══════════════════════════════════════════════╣');
console.log(`║ Drift (sistema vs movs):   S/ ${(saldoSistema - saldoActivos).toFixed(2).padStart(10)}   ║`);
console.log(`║ Error (sistema vs real):   S/ ${(saldoSistema - SALDO_REAL).toFixed(2).padStart(10)}   ║`);
console.log(`║ Error (movs vs real):      S/ ${(saldoActivos - SALDO_REAL).toFixed(2).padStart(10)}   ║`);
console.log('╚═══════════════════════════════════════════════╝\n');

// ═══ Paso 2: Calcular correcciones webhook (ya identificadas) ═══
console.log('─── CORRECCIONES WEBHOOK (12 ventas procesadas) ───\n');

const fix1 = -4.17;  // VT-2026-061 ingreso inflado
const fix2 = -20.10; // VT-2026-062a comisión faltante
console.log(`  1. VT-2026-061 ingreso 112.17→108:      ${fix1 >= 0 ? '+' : ''}S/ ${fix1.toFixed(2)}`);
console.log(`  2. VT-2026-062a comisión faltante:       ${fix2 >= 0 ? '+' : ''}S/ ${fix2.toFixed(2)}`);
const subtotalWebhook = fix1 + fix2;
console.log(`  Subtotal webhook:                        ${subtotalWebhook >= 0 ? '+' : ''}S/ ${subtotalWebhook.toFixed(2)}`);

// ═══ Paso 3: Correcciones ventas manuales ═══
console.log('\n─── CORRECCIONES VENTAS MANUALES (28 ventas) ───\n');

// Load ML syncs for manual venta matching
const mlSyncs = await db.collection('mlOrderSync').get();
const syncVentaIds = new Set();
for (const s of mlSyncs.docs) {
  const sd = s.data();
  if (sd.ventaId) syncVentaIds.add(sd.ventaId);
}

const pendientes = mlSyncs.docs
  .filter(d => d.data().estado === 'pendiente')
  .map(d => ({ id: d.id, ...d.data() }));

const ventas = await db.collection('ventas').get();
const manuales = [];
for (const v of ventas.docs) {
  if (syncVentaIds.has(v.id)) continue;
  const vd = v.data();
  const pagos = vd.pagos || [];
  if (pagos.some(p => p.metodoPago === 'mercado_pago')) {
    manuales.push({
      id: v.id,
      num: vd.numeroVenta,
      totalPEN: vd.totalPEN || 0,
      costoEnvio: vd.costoEnvio || 0,
      productoTotal: (vd.totalPEN || 0) - (vd.costoEnvio || 0),
    });
  }
}

// Match
const usedSync = new Set();
let totalCargoUrbanoManual = 0;
let totalFlexFaltante = 0;
let countUrbano = 0;
let countFlexSinEnvio = 0;
let countFlexConEnvio = 0;
const matchDetails = [];

for (const v of manuales) {
  let bestMatch = null;
  let bestScore = 0;

  for (const p of pendientes) {
    if (usedSync.has(p.id)) continue;
    const totalML = p.totalML || 0;
    if (Math.abs(v.productoTotal - totalML) < 0.01) {
      if (100 > bestScore) { bestScore = 100; bestMatch = p; }
    } else if (Math.abs(v.totalPEN - totalML) < 0.01) {
      if (90 > bestScore) { bestScore = 90; bestMatch = p; }
    } else if (Math.abs(v.totalPEN - (totalML + (p.costoEnvioCliente || 0))) < 0.01) {
      if (85 > bestScore) { bestScore = 85; bestMatch = p; }
    }
  }

  if (bestMatch) {
    usedSync.add(bestMatch.id);
    const met = bestMatch.metodoEnvio || '?';
    const cargoEnv = bestMatch.cargoEnvioML || 0;
    const costoEnvCli = bestMatch.costoEnvioCliente || 0;

    if (met === 'urbano' && cargoEnv > 0) {
      totalCargoUrbanoManual += cargoEnv;
      countUrbano++;
      matchDetails.push({ venta: v.num, tipo: 'urbano', ajuste: -cargoEnv, desc: `cargo envío Urbano -S/${cargoEnv}` });
    }
    if (met !== 'urbano' && costoEnvCli > 0 && v.costoEnvio === 0) {
      // Flex sin envío registrado
      totalFlexFaltante += costoEnvCli;
      countFlexSinEnvio++;
      matchDetails.push({ venta: v.num, tipo: 'flex_sin', ajuste: +costoEnvCli, desc: `Flex envío no registrado +S/${costoEnvCli}` });
    }
    if (met !== 'urbano' && costoEnvCli > 0 && v.costoEnvio > 0) {
      countFlexConEnvio++;
      // Check if the amounts match
      if (Math.abs(v.costoEnvio - costoEnvCli) > 0.01) {
        const diff = costoEnvCli - v.costoEnvio;
        if (Math.abs(diff) > 0.01) {
          matchDetails.push({ venta: v.num, tipo: 'flex_diff', ajuste: diff, desc: `Flex envío diff: ML=${costoEnvCli} vs reg=${v.costoEnvio}` });
        }
      }
    }
  }
}

console.log(`  Urbano (cargo envío no registrado): ${countUrbano} ventas`);
console.log(`    Total cargo Urbano faltante:          -S/ ${totalCargoUrbanoManual.toFixed(2)}`);
console.log(`  Flex sin envío en venta: ${countFlexSinEnvio} ventas`);
console.log(`    Total envío Flex faltante:            +S/ ${totalFlexFaltante.toFixed(2)}`);
console.log(`    Ajuste Flex manual existente:         -S/ 65.10 (ya registrado)`);
console.log(`    Neto Flex faltante:                   +S/ ${(totalFlexFaltante - 65.10).toFixed(2)}`);
console.log(`  Flex con envío correcto: ${countFlexConEnvio} ventas`);

// Check for individual differences in Flex envío
let totalFlexDiff = 0;
const flexDiffs = matchDetails.filter(d => d.tipo === 'flex_diff');
if (flexDiffs.length > 0) {
  console.log(`  Flex con envío diferente: ${flexDiffs.length} ventas`);
  for (const fd of flexDiffs) {
    totalFlexDiff += fd.ajuste;
    console.log(`    ${fd.venta}: ${fd.desc}`);
  }
  console.log(`    Total diferencias envío Flex:         ${totalFlexDiff >= 0 ? '+' : ''}S/ ${totalFlexDiff.toFixed(2)}`);
}

const subtotalManual = -totalCargoUrbanoManual + (totalFlexFaltante - 65.10) + totalFlexDiff;
console.log(`\n  Subtotal ventas manuales:              ${subtotalManual >= 0 ? '+' : ''}S/ ${subtotalManual.toFixed(2)}`);

// ═══ Paso 4: Resultado hipotético ═══
const totalCorrecciones = subtotalWebhook + subtotalManual;
const saldoCorregido = saldoActivos + totalCorrecciones;
const residual = saldoCorregido - SALDO_REAL;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('       RESULTADO HIPOTÉTICO (DESPUÉS)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log(`║ Saldo actual (movimientos):       S/ ${saldoActivos.toFixed(2).padStart(10)}            ║`);
console.log(`║                                                               ║`);
console.log(`║ Correcciones webhook:             ${subtotalWebhook >= 0 ? '+' : ''}S/ ${subtotalWebhook.toFixed(2).padStart(10)}            ║`);
console.log(`║   └ VT-2026-061 ingreso:          -S/       4.17            ║`);
console.log(`║   └ VT-2026-062a comisión:        -S/      20.10            ║`);
console.log(`║                                                               ║`);
console.log(`║ Correcciones manuales:            ${subtotalManual >= 0 ? '+' : ''}S/ ${subtotalManual.toFixed(2).padStart(10)}            ║`);
console.log(`║   └ Cargo envío Urbano (${countUrbano} ord):  -S/ ${totalCargoUrbanoManual.toFixed(2).padStart(10)}            ║`);
console.log(`║   └ Flex envío faltante:          +S/ ${totalFlexFaltante.toFixed(2).padStart(10)}            ║`);
console.log(`║   └ Ajuste Flex ya existente:     -S/      65.10            ║`);
if (Math.abs(totalFlexDiff) > 0.01) {
  console.log(`║   └ Diferencias envío Flex:       ${totalFlexDiff >= 0 ? '+' : '-'}S/ ${Math.abs(totalFlexDiff).toFixed(2).padStart(10)}            ║`);
}
console.log(`║                                   ────────────             ║`);
console.log(`║ SALDO CORREGIDO (movimientos):    S/ ${saldoCorregido.toFixed(2).padStart(10)}            ║`);
console.log(`║ Saldo real MercadoPago:           S/ ${SALDO_REAL.toFixed(2).padStart(10)}            ║`);
console.log(`║                                   ────────────             ║`);
console.log(`║ RESIDUAL:                         ${residual >= 0 ? '+' : ''}S/ ${residual.toFixed(2).padStart(10)}            ║`);
console.log(`║ (% del volumen total):            ${(Math.abs(residual) / saldoActivos * 100).toFixed(2)}%                     ║`);
console.log('╚═══════════════════════════════════════════════════════════════╝');

console.log('\n─── DESGLOSE DEL RESIDUAL ───\n');
console.log('  El residual puede venir de:');
console.log('  • Matching incorrecto (nombres/montos similares entre órdenes)');
console.log('  • Diferencias en montos de comisión registrados vs reales');
console.log('  • Gastos de courier vs cargo ML que difieren');
console.log('  • Otros movimientos no-ML que afectan la cuenta');
console.log(`\n  Con las correcciones, el error se reduce de:`);
console.log(`    S/ ${(saldoSistema - SALDO_REAL).toFixed(2)} (${((saldoSistema - SALDO_REAL) / SALDO_REAL * 100).toFixed(1)}% del saldo real)`);
console.log(`  a:`);
console.log(`    S/ ${residual.toFixed(2)} (${(Math.abs(residual) / SALDO_REAL * 100).toFixed(1)}% del saldo real)`);

// Resetear saldoActual
console.log('\n─── ACCIÓN FINAL ───\n');
console.log(`  1. Aplicar las correcciones de movimientos`);
console.log(`  2. Recalcular saldoActual desde movimientos → S/ ${saldoCorregido.toFixed(2)}`);
console.log(`  3. Crear movimiento de ajuste de conciliación por S/ ${residual.toFixed(2)}`);
console.log(`  4. saldoActual final = S/ ${SALDO_REAL.toFixed(2)} (cuadre perfecto)`);
