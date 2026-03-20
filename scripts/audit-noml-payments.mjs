/**
 * Verificar pagos no-ML registrados en MercadoPago
 * Buscar si el método de pago coincide con la cuenta destino
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Get all mlOrderSync ventaIds
const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
const mlVentaIds = new Set();
for (const s of mlSyncs.docs) {
  if (s.data().ventaId) mlVentaIds.add(s.data().ventaId);
}

// Get all ingreso movements to MP
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();
const noMLIngresos = [];

for (const m of movsD.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (!['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(d.tipo)) continue;
  if (mlVentaIds.has(d.ventaId || '')) continue;

  // Get the venta to check payment details
  let ventaInfo = null;
  if (d.ventaId) {
    const vDoc = await db.collection('ventas').doc(d.ventaId).get();
    if (vDoc.exists) {
      const vd = vDoc.data();
      ventaInfo = {
        numero: vd.numeroVenta,
        canal: vd.canalNombre || 'N/A',
        estadoPago: vd.estadoPago,
        montoPagado: vd.montoPagado,
        totalPEN: vd.totalPEN,
        pagos: vd.pagos || [],
      };
    }
  }

  noMLIngresos.push({
    movId: m.id,
    numMov: d.numeroMovimiento,
    monto: d.monto,
    concepto: (d.concepto || '').substring(0, 80),
    metodo: d.metodo || d.metodoPago || 'N/A',
    ventaId: d.ventaId || 'N/A',
    ventaInfo,
  });
}

// Sort by monto desc
noMLIngresos.sort((a, b) => b.monto - a.monto);

console.log('═══ INGRESOS NO-ML EN MERCADOPAGO ═══\n');

let total = 0;
const suspicious = [];

for (const ing of noMLIngresos) {
  total += ing.monto;
  const vi = ing.ventaInfo;

  let flag = '';
  let pagosStr = '';

  if (vi && Array.isArray(vi.pagos) && vi.pagos.length > 0) {
    for (const p of vi.pagos) {
      pagosStr += `[${p.metodoPago} S/${p.monto}] `;
      // Check if payment method doesn't match MP
      if (p.metodoPago && !['mercado_pago', 'mercadopago'].includes(p.metodoPago)) {
        flag = `⚠ PAGO VIA ${p.metodoPago.toUpperCase()} (no MP!)`;
        suspicious.push({ ...ing, pagoMetodo: p.metodoPago, pagoMonto: p.monto });
      }
    }
  }

  console.log(`${ing.numMov} | S/${ing.monto} | ${ing.concepto}`);
  if (vi) {
    console.log(`  Venta: ${vi.numero} | canal: ${vi.canal} | pagos: ${pagosStr} ${flag}`);
  }
}

console.log(`\nTotal ingresos no-ML en MP: S/ ${total.toFixed(2)}`);
console.log(`Cantidad: ${noMLIngresos.length}`);

if (suspicious.length > 0) {
  console.log('\n═══ SOSPECHOSOS: Ingreso en MP pero pago NO es MercadoPago ═══');
  let totalSospechoso = 0;
  for (const s of suspicious) {
    console.log(`  ${s.numMov} | S/${s.monto} | pago via ${s.pagoMetodo} | ${s.concepto}`);
    totalSospechoso += s.monto;
  }
  console.log(`\nTotal sospechoso: S/ ${totalSospechoso.toFixed(2)}`);
  console.log(`Residual a explicar: S/ 98.74`);
  console.log(`Coincidencia: ${Math.abs(totalSospechoso - 98.74) < 1 ? 'SÍ!' : 'NO - parcial'}`);
}

// Also check: movimientos where metodo is NOT mercado_pago but cuentaDestino is MP
console.log('\n═══ MOVIMIENTOS CON METODO != MP PERO DESTINO = MP ═══');
for (const m of movsD.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  const metodo = d.metodo || d.metodoPago || '';
  if (metodo && !['mercado_pago', 'mercadopago', ''].includes(metodo)) {
    console.log(`  ${d.numeroMovimiento} | S/${d.monto} | metodo: ${metodo} | ${(d.concepto || '').substring(0, 60)}`);
  }
}
