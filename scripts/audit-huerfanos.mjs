/**
 * Audita datos huérfanos en Firestore: docs que referencian otros docs inexistentes.
 * Solo lectura. No modifica nada.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// Cache de existencia
const existsCache = {};
async function exists(col, id) {
  if (!id) return true; // sin ref = no huérfano
  const key = `${col}/${id}`;
  if (existsCache[key] !== undefined) return existsCache[key];
  const d = await db.collection(col).doc(id).get();
  return (existsCache[key] = d.exists);
}

async function scan(col, refFields) {
  const snap = await db.collection(col).get();
  const orphans = [];
  for (const d of snap.docs) {
    const data = d.data();
    const bad = [];
    for (const { field, target } of refFields) {
      const v = data[field];
      if (!v) continue;
      if (Array.isArray(v)) {
        for (const id of v) {
          if (id && !(await exists(target, id))) bad.push(`${field}[]=${id}→${target}`);
        }
      } else if (typeof v === 'string') {
        if (!(await exists(target, v))) bad.push(`${field}=${v}→${target}`);
      }
    }
    if (bad.length > 0) orphans.push({ id: d.id, numero: data.numeroOrden || data.numeroVenta || data.numeroEnvio || data.numero || data.codigo, bad });
  }
  return { total: snap.size, orphans };
}

const scans = [
  { col: 'envios',          refs: [{ field: 'ordenCompraId', target: 'ordenesCompra' }, { field: 'casillaDestinoId', target: 'casillas' }, { field: 'colaboradorId', target: 'colaboradores' }] },
  { col: 'unidades',        refs: [{ field: 'ordenCompraId', target: 'ordenesCompra' }, { field: 'envioId', target: 'envios' }, { field: 'ventaId', target: 'ventas' }, { field: 'casillaActualId', target: 'casillas' }, { field: 'productoId', target: 'productos' }] },
  { col: 'ventas',          refs: [{ field: 'clienteId', target: 'clientes' }, { field: 'canalVentaId', target: 'canalesVenta' }, { field: 'cotizacionId', target: 'cotizaciones' }] },
  { col: 'cotizaciones',    refs: [{ field: 'clienteId', target: 'clientes' }] },
  { col: 'requerimientos',  refs: [{ field: 'cotizacionId', target: 'cotizaciones' }] },
  { col: 'entregas',        refs: [{ field: 'ventaId', target: 'ventas' }, { field: 'colaboradorId', target: 'colaboradores' }, { field: 'transportistaId', target: 'colaboradores' }] },
  { col: 'pagos',           refs: [{ field: 'ventaId', target: 'ventas' }, { field: 'cuentaOrigenId', target: 'cuentasCaja' }] },
  { col: 'movimientosTesoreria', refs: [{ field: 'cuentaId', target: 'cuentasCaja' }, { field: 'ordenCompraId', target: 'ordenesCompra' }, { field: 'ventaId', target: 'ventas' }, { field: 'gastoId', target: 'gastos' }] },
  { col: 'gastos',          refs: [{ field: 'categoriaId', target: 'categoriasCosto' }, { field: 'cuentaOrigenId', target: 'cuentasCaja' }] },
  { col: 'casillas',        refs: [{ field: 'colaboradorId', target: 'colaboradores' }] },
  { col: 'productos',       refs: [{ field: 'marcaId', target: 'marcas' }, { field: 'categoriaId', target: 'categorias' }, { field: 'tipoProductoId', target: 'tiposProducto' }, { field: 'lineaNegocioId', target: 'lineasNegocio' }] },
  { col: 'boletas',         refs: [{ field: 'empleadoId', target: 'empleados' }] },
  { col: 'adelantosNomina', refs: [{ field: 'empleadoId', target: 'empleados' }] },
];

let totalOrphans = 0;
for (const s of scans) {
  try {
    const r = await scan(s.col, s.refs);
    if (r.orphans.length === 0) {
      console.log(`✓ ${s.col.padEnd(25)} ${r.total} docs, 0 huérfanos`);
    } else {
      console.log(`⚠ ${s.col.padEnd(25)} ${r.total} docs, ${r.orphans.length} HUÉRFANOS:`);
      r.orphans.slice(0, 10).forEach(o => {
        console.log(`    ${(o.numero || o.id).padEnd(24)} | ${o.bad.join(' | ')}`);
      });
      if (r.orphans.length > 10) console.log(`    ... y ${r.orphans.length - 10} más`);
      totalOrphans += r.orphans.length;
    }
  } catch (e) {
    console.log(`✗ ${s.col.padEnd(25)} error: ${e.message}`);
  }
}

console.log(`\n=== TOTAL HUÉRFANOS: ${totalOrphans} ===\n`);

// Colecciones deprecated que deberían estar vacías
console.log('Colecciones legacy (deberían estar vacías):');
for (const col of ['transferencias', 'almacenes', 'transportistas']) {
  try {
    const s = await db.collection(col).get();
    const mark = s.size === 0 ? '✓' : '⚠';
    console.log(`  ${mark} ${col.padEnd(20)} ${s.size} docs`);
  } catch {}
}

process.exit(0);
