/**
 * Detalle completo de los 13 adelantos de cotización registrados en MP
 * con método de pago transferencia/yape
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

// Get all cuentas for name resolution
const cuentasSnap = await db.collection('cuentasCaja').get();
const cuentasMap = {};
for (const c of cuentasSnap.docs) {
  cuentasMap[c.id] = c.data().nombre || c.data().banco || c.id;
}

// Get all mlOrderSync ventaIds
const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
const mlVentaIds = new Set();
for (const s of mlSyncs.docs) {
  if (s.data().ventaId) mlVentaIds.add(s.data().ventaId);
}

// Get all ingreso movements to MP that are NOT from ML
const movsD = await db.collection('movimientosTesoreria').where('cuentaDestino', '==', mpId).get();

console.log('═══════════════════════════════════════════════════════════════');
console.log('DETALLE DE ADELANTOS/PAGOS EN CUENTA MP CON MÉTODO NO-MP');
console.log('═══════════════════════════════════════════════════════════════\n');

const suspicious = [];

for (const m of movsD.docs) {
  const d = m.data();
  if (d.estado === 'anulado') continue;
  if (!['ingreso_venta', 'ingreso', 'ingreso_anticipo'].includes(d.tipo)) continue;

  const metodo = d.metodo || d.metodoPago || '';
  // Only show non-MP payment methods
  if (['mercado_pago', 'mercadopago', ''].includes(metodo)) continue;

  suspicious.push({ id: m.id, ...d });
}

// Sort by date
suspicious.sort((a, b) => {
  const fa = a.fecha?.toDate?.() || new Date(0);
  const fb = b.fecha?.toDate?.() || new Date(0);
  return fa - fb;
});

let totalSospechoso = 0;

for (const d of suspicious) {
  totalSospechoso += d.monto || 0;
  const fecha = d.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?';

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 ${d.numeroMovimiento} | ${fecha}`);
  console.log(`   Concepto:     ${d.concepto}`);
  console.log(`   Monto:        S/ ${(d.monto || 0).toFixed(2)}`);
  console.log(`   Tipo:         ${d.tipo}`);
  console.log(`   Método pago:  ${d.metodo || d.metodoPago || 'N/A'}`);
  console.log(`   Cuenta dest:  ${cuentasMap[d.cuentaDestino] || d.cuentaDestino} (${d.cuentaDestino})`);
  console.log(`   Cuenta orig:  ${d.cuentaOrigen ? (cuentasMap[d.cuentaOrigen] || d.cuentaOrigen) : 'N/A'}`);

  // Get venta details
  if (d.ventaId) {
    const vDoc = await db.collection('ventas').doc(d.ventaId).get();
    if (vDoc.exists) {
      const vd = vDoc.data();
      console.log(`   ── Venta ──`);
      console.log(`   Número:       ${vd.numeroVenta}`);
      console.log(`   Cliente:      ${vd.clienteNombre || 'N/A'}`);
      console.log(`   Canal:        ${vd.canalNombre || 'N/A'}`);
      console.log(`   Total:        S/ ${vd.totalPEN}`);
      console.log(`   Estado pago:  ${vd.estadoPago}`);
      console.log(`   MercadoLibre: ${vd.mercadoLibreId || 'NO'}`);

      // Show ALL pagos of this venta
      const pagos = vd.pagos || [];
      if (Array.isArray(pagos) && pagos.length > 0) {
        console.log(`   ── Pagos registrados ──`);
        for (const p of pagos) {
          const pFecha = p.fecha?.toDate?.()?.toISOString?.()?.substring(0, 10) || '?';
          const cuentaDest = p.cuentaDestinoId ? (cuentasMap[p.cuentaDestinoId] || p.cuentaDestinoId) : 'N/A';
          console.log(`   • ${p.id || '?'} | S/${p.monto} | ${p.metodoPago} | cuenta: ${cuentaDest} | ${pFecha} | ref: ${p.referencia || '-'}`);
        }
      }

      // Check if there's a cotización linked
      if (vd.cotizacionId) {
        console.log(`   Cotización:   ${vd.cotizacionId}`);
      }
    }
  }

  // Show ALL movements for this ventaId
  if (d.ventaId) {
    const allMovs = await db.collection('movimientosTesoreria').where('ventaId', '==', d.ventaId).get();
    if (allMovs.size > 1) {
      console.log(`   ── Otros movimientos de esta venta ──`);
      for (const om of allMovs.docs) {
        if (om.id === d.id) continue; // Skip current one
        const omd = om.data();
        const destName = omd.cuentaDestino ? (cuentasMap[omd.cuentaDestino] || omd.cuentaDestino) : '-';
        const origName = omd.cuentaOrigen ? (cuentasMap[omd.cuentaOrigen] || omd.cuentaOrigen) : '-';
        console.log(`   • ${omd.numeroMovimiento} | ${omd.tipo} | S/${omd.monto} | estado:${omd.estado} | dest:${destName} | orig:${origName}`);
      }
    }
  }
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📊 RESUMEN:`);
console.log(`   Cantidad de movimientos sospechosos: ${suspicious.length}`);
console.log(`   Total registrado en MP:              S/ ${totalSospechoso.toFixed(2)}`);
console.log(`   Residual a explicar:                 S/ 98.74`);
console.log(`\n💡 PREGUNTA CLAVE:`);
console.log(`   Si alguno de estos pagos fue por transferencia bancaria directa`);
console.log(`   (no por link de MercadoPago), el monto debería estar en la`);
console.log(`   cuenta bancaria, NO en MercadoPago.`);
console.log(`   Cada monto mal asignado contribuye al descuadre de S/ 98.74.`);
