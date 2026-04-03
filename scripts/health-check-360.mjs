/**
 * Health Check 360° del sistema
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function main() {
  const [prodSnap, marcasSnap, provSnap, compSnap, almSnap, cuentasSnap,
         tiposSnap, catsSnap, etiqSnap, lineasSnap, canalesSnap] = await Promise.all([
    db.collection('productos').get(),
    db.collection('marcas').get(),
    db.collection('proveedores').get(),
    db.collection('competidores').get(),
    db.collection('almacenes').get(),
    db.collection('cuentasCaja').get(),
    db.collection('tiposProducto').get(),
    db.collection('categorias').get(),
    db.collection('etiquetas').get(),
    db.collection('lineasNegocio').get(),
    db.collection('canalesVenta').get(),
  ]);

  console.log('=== ESTADO 360 DEL SISTEMA ===\n');

  console.log('--- DATOS MAESTROS ---');
  console.log(`  Productos: ${prodSnap.size}`);
  console.log(`  Marcas: ${marcasSnap.size} | Proveedores: ${provSnap.size} | Competidores: ${compSnap.size}`);
  console.log(`  Almacenes: ${almSnap.size} | Cuentas: ${cuentasSnap.size} | Canales: ${canalesSnap.size}`);
  console.log(`  Tipos: ${tiposSnap.size} | Categorias: ${catsSnap.size} | Etiquetas: ${etiqSnap.size} | Lineas: ${lineasSnap.size}`);

  // Operational
  console.log('\n--- DATOS OPERATIVOS (deben estar vacíos) ---');
  const opCols = ['ventas', 'ordenesCompra', 'unidades', 'gastos', 'movimientosTesoreria',
                  'transferencias', 'clientes', 'entregas', 'cotizaciones', 'requerimientos', 'poolUSD'];
  for (const col of opCols) {
    const s = await db.collection(col).get();
    const status = s.size === 0 ? 'OK' : 'TIENE DATOS';
    console.log(`  ${col}: ${s.size} ${status}`);
  }

  // FK integrity
  console.log('\n--- INTEGRIDAD REFERENCIAL ---');
  const ids = {
    marca: new Set(marcasSnap.docs.map(d => d.id)),
    prov: new Set(provSnap.docs.map(d => d.id)),
    comp: new Set(compSnap.docs.map(d => d.id)),
    tipo: new Set(tiposSnap.docs.map(d => d.id)),
    cat: new Set(catsSnap.docs.map(d => d.id)),
    etiq: new Set(etiqSnap.docs.map(d => d.id)),
    linea: new Set(lineasSnap.docs.map(d => d.id)),
  };

  let fkIssues = 0;
  prodSnap.docs.forEach(d => {
    const p = d.data();
    if (p.marcaId && !ids.marca.has(p.marcaId)) fkIssues++;
    if (p.tipoProductoId && !ids.tipo.has(p.tipoProductoId)) fkIssues++;
    if (p.lineaNegocioId && !ids.linea.has(p.lineaNegocioId)) fkIssues++;
    (p.categoriaIds || []).forEach(id => { if (!ids.cat.has(id)) fkIssues++; });
    (p.etiquetaIds || []).forEach(id => { if (!ids.etiq.has(id)) fkIssues++; });
  });
  console.log(`  Productos→Maestros FK rotas: ${fkIssues} ${fkIssues === 0 ? 'OK' : 'ROTO'}`);

  let compFkOk = 0, compFkBad = 0, provFkOk = 0, provFkBad = 0;
  prodSnap.docs.forEach(d => {
    const inv = d.data().investigacion;
    if (!inv) return;
    (inv.competidoresPeru || []).forEach(c => {
      if (c.competidorId) { ids.comp.has(c.competidorId) ? compFkOk++ : compFkBad++; }
    });
    (inv.proveedoresUSA || []).forEach(p => {
      if (p.proveedorId) { ids.prov.has(p.proveedorId) ? provFkOk++ : provFkBad++; }
    });
  });
  console.log(`  Investigacion→Competidores: ${compFkOk} OK, ${compFkBad} rotas ${compFkBad === 0 ? 'OK' : 'ROTO'}`);
  console.log(`  Investigacion→Proveedores: ${provFkOk} OK, ${provFkBad} rotas ${provFkBad === 0 ? 'OK' : 'ROTO'}`);

  // Metrics sync
  console.log('\n--- METRICAS ---');
  const prodPorMarca = new Map();
  prodSnap.docs.forEach(d => {
    if (d.data().marcaId) prodPorMarca.set(d.data().marcaId, (prodPorMarca.get(d.data().marcaId) || 0) + 1);
  });
  let marcaSync = 0, marcaDesync = 0;
  marcasSnap.docs.forEach(d => {
    const real = prodPorMarca.get(d.id) || 0;
    const cached = d.data().metricas?.productosActivos || 0;
    real === cached ? marcaSync++ : marcaDesync++;
  });
  console.log(`  Marcas productosActivos: ${marcaSync} sync, ${marcaDesync} desync ${marcaDesync === 0 ? 'OK' : 'ROTO'}`);

  let ventasInflated = marcasSnap.docs.filter(d => (d.data().metricas?.ventasTotalPEN || 0) > 0).length;
  let ocInflated = provSnap.docs.filter(d => (d.data().metricas?.ordenesCompra || 0) > 0).length;
  let ctruInflated = prodSnap.docs.filter(d => (d.data().ctruPromedio || 0) > 0).length;
  console.log(`  Marcas ventas infladas: ${ventasInflated} ${ventasInflated === 0 ? 'OK' : 'ROTO'}`);
  console.log(`  Proveedores OC infladas: ${ocInflated} ${ocInflated === 0 ? 'OK' : 'ROTO'}`);
  console.log(`  Productos ctruPromedio inflado: ${ctruInflated} ${ctruInflated === 0 ? 'OK' : 'ROTO'}`);

  // Variantes
  console.log('\n--- VARIANTES ---');
  const grupos = new Map();
  prodSnap.docs.forEach(d => {
    const p = d.data();
    if (p.grupoVarianteId) {
      if (!grupos.has(p.grupoVarianteId)) grupos.set(p.grupoVarianteId, []);
      grupos.get(p.grupoVarianteId).push({ id: d.id, ...p });
    }
  });
  let varIssues = 0;
  grupos.forEach((members, gid) => {
    const principals = members.filter(m => m.esPrincipalGrupo);
    if (principals.length !== 1) varIssues++;
    if (principals[0]) {
      members.filter(m => !m.esPrincipalGrupo).forEach(m => {
        if (m.parentId !== principals[0].id) varIssues++;
      });
    }
  });
  console.log(`  Grupos: ${grupos.size} | Variantes totales: ${[...grupos.values()].reduce((s, g) => s + g.length, 0)}`);
  console.log(`  Integridad: ${varIssues === 0 ? 'OK' : varIssues + ' problemas'}`);

  // Data quality
  console.log('\n--- CALIDAD DE DATOS ---');
  console.log(`  Sin marcaId: ${prodSnap.docs.filter(d => !d.data().marcaId && d.data().marca).length}`);
  console.log(`  Sin categorias: ${prodSnap.docs.filter(d => !d.data().categoriaIds?.length).length}`);
  console.log(`  Sin lineaNegocioId: ${prodSnap.docs.filter(d => !d.data().lineaNegocioId).length}`);
  console.log(`  tipoProducto string: ${prodSnap.docs.filter(d => typeof d.data().tipoProducto === 'string').length}`);
  console.log(`  tipoProducto snapshot: ${prodSnap.docs.filter(d => d.data().tipoProducto && typeof d.data().tipoProducto === 'object').length}`);

  // Linea de negocio
  console.log('\n--- LINEA NEGOCIO ---');
  console.log(`  Marcas con linea: ${marcasSnap.docs.filter(d => d.data().lineaNegocioIds?.length > 0).length}/${marcasSnap.size}`);
  console.log(`  Proveedores con linea: ${provSnap.docs.filter(d => d.data().lineaNegocioIds?.length > 0).length}/${provSnap.size}`);
  console.log(`  Competidores con linea: ${compSnap.docs.filter(d => d.data().lineaNegocioIds?.length > 0).length}/${compSnap.size}`);

  // Contadores
  console.log('\n--- CONTADORES ---');
  const contSnap = await db.collection('contadores').get();
  contSnap.docs.sort((a, b) => a.id.localeCompare(b.id)).forEach(d => {
    console.log(`  ${d.id}: ${d.data().current}`);
  });

  // Summary
  const total = fkIssues + compFkBad + provFkBad + marcaDesync + ventasInflated + ocInflated + ctruInflated + varIssues;
  console.log(`\n=== RESULTADO: ${total === 0 ? 'SISTEMA LIMPIO — 0 problemas' : total + ' problemas encontrados'} ===`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
