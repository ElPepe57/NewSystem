/**
 * Deep audit: check all ventas that have movements pointing to MP
 * to find any with wrong payment totals
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const mpId = 'geEs98tz955mVjYNct8M';

// Get all movements for MP
const movsO = await db.collection('movimientosTesoreria').where('cuentaOrigen', '==', mpId).get();
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

const allMovs = new Map();
for (const m of movsO.docs) allMovs.set(m.id, { id: m.id, ...m.data() });
for (const m of movsD.docs) if (!allMovs.has(m.id)) allMovs.set(m.id, { id: m.id, ...m.data() });

// Group ingreso movements by ventaNumero
const ingresosPorVenta = {};
for (const [id, d] of allMovs) {
  if ((d.tipo === 'ingreso_venta' || d.tipo === 'ingreso_anticipo') && d.ventaNumero) {
    if (!ingresosPorVenta[d.ventaNumero]) ingresosPorVenta[d.ventaNumero] = [];
    ingresosPorVenta[d.ventaNumero].push(d);
  }
}

// For each venta with ingreso movements, verify against the venta's pagos
console.log('=== VERIFICACION DE PAGOS POR VENTA ===\n');
let totalDiscrepancia = 0;

for (const [ventaNum, movs] of Object.entries(ingresosPorVenta)) {
  const totalMovIngresos = movs.reduce((s, m) => s + (m.monto || 0), 0);
  
  // Get the actual venta
  const ventaQ = await db.collection('ventas').where('numeroVenta', '==', ventaNum).limit(1).get();
  if (ventaQ.empty) {
    console.log(`${ventaNum}: VENTA NO EXISTE pero hay ${movs.length} movs de ingreso por S/ ${totalMovIngresos.toFixed(2)}`);
    totalDiscrepancia += totalMovIngresos;
    for (const m of movs) {
      console.log(`  ${m.id} | ${m.numeroMovimiento} | S/ ${m.monto}`);
    }
    continue;
  }
  
  const venta = ventaQ.docs[0].data();
  const montoPagado = venta.montoPagado || 0;
  
  if (Math.abs(totalMovIngresos - montoPagado) > 0.01) {
    const diff = totalMovIngresos - montoPagado;
    console.log(`${ventaNum}: movs_ingreso=S/ ${totalMovIngresos.toFixed(2)} vs pagado=S/ ${montoPagado.toFixed(2)} | DIFF=S/ ${diff.toFixed(2)} | ${movs.length} movs`);
    for (const m of movs) {
      console.log(`  ${m.id} | ${m.numeroMovimiento} | S/ ${m.monto} | ${(m.concepto || '').substring(0, 50)}`);
    }
    totalDiscrepancia += diff;
  }
}

console.log(`\nTotal discrepancia en ingresos: S/ ${totalDiscrepancia.toFixed(2)}`);

// Also check: ventas ML que podrían tener pagos manuales adicionales
console.log('\n\n=== VENTAS ML CON PAGOS MANUALES ADICIONALES ===');
const ventasML = await db.collection('ventas').where('canal', '==', 'mercado_libre').get();
if (ventasML.empty) {
  // Try by canalNombre
  const ventasML2 = await db.collection('ventas').where('canalNombre', '==', 'Mercado Libre').get();
  for (const v of ventasML2.docs) {
    const d = v.data();
    const pagos = d.pagos || [];
    if (pagos.length > 1) {
      console.log(`${d.numeroVenta}: ${pagos.length} pagos | total=S/ ${d.totalPEN} | pagado=S/ ${d.montoPagado}`);
      for (const p of pagos) {
        console.log(`  ${p.id || '?'} | S/ ${p.montoPEN || p.monto} | ${p.metodoPago} | ${p.registradoPor || '?'}`);
      }
    }
  }
}
