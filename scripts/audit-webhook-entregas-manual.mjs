/**
 * Find manual entrega movements that correspond to webhook Urbano ventas
 * These are the movements the user created manually (without ventaId)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Webhook ventas Urbano with their ENT numbers
const webhookUrbano = [
  { venta: 'VT-2026-054', ventaId: 'Bfizilptt9WWcGSVwe6B', ent: 'ENT-2026-052', cargoML: 6.95 },
  { venta: 'VT-2026-056', ventaId: '7OxiwOcppctdEtI6injO', ent: 'ENT-2026-054', cargoML: 4.17 },
  { venta: 'VT-2026-057', ventaId: 'ittZOBs6ewmHA4mxXqwg', ent: 'ENT-2026-055', cargoML: 4.17 },
  { venta: 'VT-2026-061', ventaId: 'pFDmZ4Y0gZ2Swfz62qdB', ent: 'ENT-2026-059', cargoML: 4.17 },
];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   ENTREGAS URBANO WEBHOOK: Cargo ML vs Gasto Manual Registrado');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Get ALL gasto_operativo movements from MP without ventaId that mention "Entrega"
const movsO = await db.collection('movimientosTesoreria')
  .where('cuentaOrigen', '==', mpId)
  .get();

const entregaMovs = [];
for (const m of movsO.docs) {
  const md = m.data();
  if (md.estado === 'anulado') continue;
  if (md.tipo !== 'gasto_operativo') continue;
  const concepto = md.concepto || '';
  if (!concepto.includes('Entrega ENT-')) continue;
  entregaMovs.push({ id: m.id, ...md });
}

console.log(`Total movimientos "Entrega" desde MP: ${entregaMovs.length}\n`);

// Also get ALL gastos linked to these ventas
const gastosSnap = await db.collection('gastos').get();
const gastosByVenta = {};
for (const g of gastosSnap.docs) {
  const gd = g.data();
  if (!gd.ventaId) continue;
  if (!gastosByVenta[gd.ventaId]) gastosByVenta[gd.ventaId] = [];
  gastosByVenta[gd.ventaId].push({ id: g.id, ...gd });
}

let totalCargoML = 0;
let totalRegistrado = 0;
let totalFaltante = 0;

for (const wu of webhookUrbano) {
  console.log(`── ${wu.venta} (${wu.ent}) ──`);
  console.log(`   Cargo ML real: S/ ${wu.cargoML}`);

  // Find manual movement by ENT number
  const manualMov = entregaMovs.find(m =>
    (m.concepto || '').includes(wu.ent)
  );

  if (manualMov) {
    const registrado = manualMov.monto || 0;
    const diff = wu.cargoML - registrado;
    totalRegistrado += registrado;
    console.log(`   Movimiento manual: ${manualMov.numeroMovimiento} | S/ ${registrado.toFixed(2)} | ${manualMov.concepto?.substring(0, 60)}`);
    console.log(`   ventaId en movimiento: ${manualMov.ventaId || 'NONE'}`);
    if (Math.abs(diff) > 0.01) {
      console.log(`   ⚠ DIFERENCIA: cargo ML S/${wu.cargoML} - registrado S/${registrado} = S/ ${diff.toFixed(2)}`);
      totalFaltante += diff;
    } else {
      console.log(`   ✅ Monto correcto`);
    }
  } else {
    console.log(`   ❌ NO encontrado movimiento manual para ${wu.ent}`);
    totalFaltante += wu.cargoML;
  }

  // Also check gastos linked to this venta for delivery
  const ventaGastos = gastosByVenta[wu.ventaId] || [];
  const deliveryGastos = ventaGastos.filter(g =>
    (g.tipo === 'delivery' || (g.concepto || '').toLowerCase().includes('entrega'))
  );

  if (deliveryGastos.length > 0) {
    for (const dg of deliveryGastos) {
      console.log(`   Gasto vinculado: ${dg.numero || dg.id} | S/ ${(dg.monto || 0).toFixed(2)} | ${dg.concepto?.substring(0, 50)} | movId: ${dg.movimientoId || 'N/A'}`);
    }
  }

  totalCargoML += wu.cargoML;
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   RESUMEN');
console.log('═══════════════════════════════════════════════════════════════════\n');
console.log(`  Total cargo ML (4 ventas Urbano webhook): S/ ${totalCargoML.toFixed(2)}`);
console.log(`  Total registrado manualmente:             S/ ${totalRegistrado.toFixed(2)}`);
console.log(`  Total faltante:                           S/ ${totalFaltante.toFixed(2)}`);

// VT-2026-061 has additional issue: ingreso inflated
console.log('\n── VT-2026-061: Ingreso inflado ──');
console.log('   Ingreso registrado: S/ 112.17');
console.log('   totalML real:       S/ 108.00');
console.log('   Exceso:             S/ 4.17 (costoEnvio incluido en ingreso)');

// VT-2026-062: missing comisión
console.log('\n── VT-2026-062 (oT62lh9MR8RWM7dg9DCc): Comisión faltante ──');
console.log('   Comisión ML: S/ 20.10');
console.log('   Registrada:  S/ 0.00');
console.log('   Faltante:    S/ 20.10');

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('   CORRECCIÓN TOTAL NECESARIA (ajustada)');
console.log('═══════════════════════════════════════════════════════════════════\n');

const totalCorreccion = totalFaltante + 4.17 + 20.10; // cargo faltante + ingreso inflado + comisión faltante
console.log(`  Cargo envío faltante:    S/ ${totalFaltante.toFixed(2)}`);
console.log(`  Ingreso inflado 061:     S/ 4.17`);
console.log(`  Comisión faltante 062:   S/ 20.10`);
console.log(`  ─────────────────────────────`);
console.log(`  TOTAL CORRECCIÓN:        S/ ${totalCorreccion.toFixed(2)}`);

const saldoMovimientos = 2724.37; // from previous audit
console.log(`\n  Saldo movimientos actual:   S/ ${saldoMovimientos.toFixed(2)}`);
console.log(`  - Corrección:              -S/ ${totalCorreccion.toFixed(2)}`);
console.log(`  = Saldo corregido:          S/ ${(saldoMovimientos - totalCorreccion).toFixed(2)}`);
console.log(`  Saldo real:                 S/ 2677.51`);
console.log(`  Residual:                   S/ ${(saldoMovimientos - totalCorreccion - 2677.51).toFixed(2)}`);
