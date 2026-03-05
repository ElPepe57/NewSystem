import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function debug() {
  // Find Fabricio Omar Rios in clientes
  const clientesSnap = await db.collection('clientes').get();
  const fabricio = clientesSnap.docs.find(d => d.data().nombre?.includes('Fabricio'));

  if (fabricio) {
    const data = fabricio.data();
    console.log(`\n👤 Cliente encontrado:`);
    console.log(`   ID: ${fabricio.id}`);
    console.log(`   Nombre: ${data.nombre}`);
    console.log(`   Métricas actuales:`, JSON.stringify(data.metricas, null, 2));
  }

  // Find all ventas for Fabricio
  const ventasSnap = await db.collection('ventas').get();
  const ventasFabr = ventasSnap.docs.filter(d => {
    const v = d.data();
    return v.nombreCliente?.includes('Fabricio') || v.clienteId === fabricio?.id;
  });

  console.log(`\n📦 Ventas que mencionan "Fabricio" o tienen clienteId=${fabricio?.id}:`);
  for (const doc of ventasFabr) {
    const v = doc.data();
    console.log(`   ${v.numeroVenta} | clienteId: "${v.clienteId || 'NULL'}" | nombre: "${v.nombreCliente}" | total: S/${v.totalPEN} | estado: ${v.estado}`);
  }

  // Check how many ventas have clienteId vs not
  let conClienteId = 0;
  let sinClienteId = 0;
  for (const doc of ventasSnap.docs) {
    const v = doc.data();
    if (v.clienteId) conClienteId++;
    else sinClienteId++;
  }
  console.log(`\n📊 Ventas con clienteId: ${conClienteId}, sin clienteId: ${sinClienteId} (total: ${ventasSnap.size})`);

  // Check a few ventas without clienteId
  const sinId = ventasSnap.docs.filter(d => !d.data().clienteId).slice(0, 5);
  if (sinId.length > 0) {
    console.log(`\n🔍 Ejemplo ventas SIN clienteId:`);
    for (const doc of sinId) {
      const v = doc.data();
      console.log(`   ${v.numeroVenta} | nombre: "${v.nombreCliente}" | total: S/${v.totalPEN} | estado: ${v.estado}`);
    }
  }

  // Check marcaId in productos
  let productosConMarca = 0;
  let productosSinMarca = 0;
  for (const doc of ventasSnap.docs) {
    const v = doc.data();
    if (v.productos) {
      for (const p of v.productos) {
        if (p.marcaId) productosConMarca++;
        else productosSinMarca++;
      }
    }
  }
  console.log(`\n🏷️  Productos en ventas con marcaId: ${productosConMarca}, sin marcaId: ${productosSinMarca}`);
}

debug().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
