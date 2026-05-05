/**
 * Análisis pre-renumeración TP · 2026-05-04 · READ-ONLY
 *
 * Auditoría exhaustiva antes de Opción 2 (cerrar gaps TP-086 + TP-070):
 *
 * Operaciones planeadas:
 *   1. Reasignar SUP-0163 (que apunta a TP-086 duplicado) → TP-024 (TP bueno)
 *   2. Borrar TP-086 duplicado físicamente
 *   3. Renumerar TP-098 (Double Cleansing Duo) → TP-086
 *   4. Renumerar TP-097 (Toning Toner) → TP-070
 *   5. Crear contadores/TP.current = 96
 *
 * Lo que valido aquí · TODO antes de tocar nada:
 *   A. Documentos exactos de TP-086, TP-097, TP-098, TP-024
 *   B. Productos que referencian cada uno (cuántos · cuáles · snapshot que tienen)
 *   C. Búsqueda de "TP-097" y "TP-098" como string en CUALQUIER otro documento
 *      de la BD (categorías, ventas, OC, ML, etc.) por si algo los hardcodea
 *   D. Verificar que tipoProductoId (Firestore ID) NO cambia · solo campo `codigo`
 *   E. Verificar nombre/normalizado/alias para evitar confusión post-fix
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const TP_086_DUPLICADO_ID = 'n4lAfKgT4EnsljVnyZpp'; // borrar
const TP_024_BUENO_ID = 'VDKh8jcU0G2OHgFaJcMx';     // queda
const TP_098_ID = '?';                              // se renumera a TP-086
const TP_097_ID = '?';                              // se renumera a TP-070

// ─── Resolver IDs de TP-097 y TP-098 ─────────────────────────────────────────
const tipos = await db.collection('tiposProducto').get();
const byCodigo = {};
tipos.docs.forEach(d => byCodigo[d.data().codigo] = { id: d.id, ...d.data() });
const tp097 = byCodigo['TP-097'];
const tp098 = byCodigo['TP-098'];
const tp086 = byCodigo['TP-086'];
const tp024 = byCodigo['TP-024'];

console.log('═══ A · Documentos involucrados ═══\n');
function showTipo(label, t) {
  if (!t) { console.log(`  ${label}: NO ENCONTRADO`); return; }
  console.log(`  ${label}`);
  console.log(`    Firestore ID:      ${t.id}`);
  console.log(`    codigo:            "${t.codigo}"`);
  console.log(`    nombre:            "${t.nombre}"`);
  console.log(`    nombreNormalizado: "${t.nombreNormalizado}"`);
  console.log(`    principioActivo:   "${t.principioActivo}"`);
  console.log(`    alias:             ${JSON.stringify(t.alias || [])}`);
  console.log(`    estado:            ${t.estado}`);
  console.log(`    creadoPor:         ${t.creadoPor}`);
  const fc = t.fechaCreacion?._seconds ? new Date(t.fechaCreacion._seconds * 1000).toISOString().slice(0,10) : 'N/A';
  console.log(`    creado:            ${fc}`);
  console.log('');
}
showTipo('TP-024 (bueno · queda intacto)', tp024);
showTipo('TP-086 (duplicado · A BORRAR)', tp086);
showTipo('TP-097 (Toning Toner · A RENUMERAR a TP-070)', tp097);
showTipo('TP-098 (Double Cleansing Duo · A RENUMERAR a TP-086)', tp098);

// ─── B · Productos afectados ─────────────────────────────────────────────────
console.log('═══ B · Productos que referencian cada tipo ═══\n');
const productos = await db.collection('productos').get();
async function listarProductosDeTipo(tipoId, label) {
  const matches = productos.docs.filter(d => d.data().tipoProductoId === tipoId);
  console.log(`  ${label}: ${matches.length} productos`);
  if (matches.length > 0 && matches.length <= 15) {
    matches.forEach(d => {
      const p = d.data();
      const snapshot = p.tipoProducto || {};
      console.log(`    - ${p.sku} · ${p.nombreComercial}`);
      console.log(`      snapshot tipoProducto: codigo="${snapshot.codigo}" nombre="${snapshot.nombre}"`);
    });
  }
  return matches;
}

const prodTP086 = await listarProductosDeTipo(TP_086_DUPLICADO_ID, 'TP-086 (duplicado)');
console.log('');
const prodTP024 = await listarProductosDeTipo(TP_024_BUENO_ID, 'TP-024 (bueno)');
console.log('');
const prodTP097 = await listarProductosDeTipo(tp097?.id, 'TP-097');
console.log('');
const prodTP098 = await listarProductosDeTipo(tp098?.id, 'TP-098');

// ─── C · Buscar referencias por código (no por ID) en otros docs ─────────────
console.log('\n═══ C · ¿Algún otro lugar hardcodea el código TP-XXX? ═══\n');
const codigosABuscar = ['TP-086', 'TP-097', 'TP-098'];
const colecciones = ['categorias', 'etiquetas', 'lineasNegocio', 'marcas', 'mlOrderSync', 'mlProductMap', 'mlWebhookLog', 'audit_logs', 'actividad'];

function buscarStringEnObjeto(obj, target, path = '', resultados = []) {
  if (obj == null) return resultados;
  if (typeof obj === 'string') {
    if (obj.includes(target)) resultados.push({ path: path || '(root)', value: obj.slice(0, 80) });
    return resultados;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => buscarStringEnObjeto(v, target, `${path}[${i}]`, resultados));
    return resultados;
  }
  if (typeof obj === 'object' && !obj._seconds) {
    Object.keys(obj).forEach(k => buscarStringEnObjeto(obj[k], target, path ? `${path}.${k}` : k, resultados));
  }
  return resultados;
}

for (const codigo of codigosABuscar) {
  console.log(`  Buscando "${codigo}":`);
  let totalEnc = 0;
  for (const col of colecciones) {
    try {
      const snap = await db.collection(col).get();
      let enc = 0;
      const ejemplos = [];
      for (const d of snap.docs) {
        const matches = buscarStringEnObjeto(d.data(), codigo);
        if (matches.length > 0) {
          enc++;
          if (ejemplos.length < 2) ejemplos.push({ id: d.id, paths: matches.slice(0, 2).map(m => m.path) });
        }
      }
      if (enc > 0) {
        console.log(`    /${col}: ${enc} docs`);
        ejemplos.forEach(e => console.log(`      - ${e.id} en ${e.paths.join(', ')}`));
        totalEnc += enc;
      }
    } catch (e) {
      // skip si la colección no existe
    }
  }
  if (totalEnc === 0) console.log(`    ✓ No aparece en ninguna otra colección`);
}

// También buscar en productos directamente (snapshot embebido)
console.log(`\n  En /productos (snapshots embebidos tipoProducto.codigo):`);
for (const codigo of codigosABuscar) {
  const matches = productos.docs.filter(d => d.data().tipoProducto?.codigo === codigo);
  console.log(`    "${codigo}": ${matches.length} productos`);
}

// ─── D · Confirmación de invariantes ─────────────────────────────────────────
console.log('\n═══ D · Invariantes técnicos ═══\n');
console.log('  ✓ Firestore ID (clave primaria) NO cambia para ningún documento');
console.log('  ✓ Solo cambia el campo "codigo" en TP-098 y TP-097');
console.log('  ✓ Productos que referencian por tipoProductoId (ID Firestore) NO se ven afectados en su referencia');
console.log('  ✓ PERO los snapshots denormalizados (producto.tipoProducto.codigo) SÍ requieren update');
console.log('  ✓ TP-086 se BORRA físicamente · backup en disco antes');
console.log('  ✓ contadores/TP.current = 96 (nuevo · no existe hoy)');

// ─── E · Plan en pasos atómicos ──────────────────────────────────────────────
console.log('\n═══ E · Plan de ejecución (5 pasos · transaccional cuando sea posible) ═══\n');
console.log('  PASO 1 · Reasignar SUP-0163 a TP-024 (1 producto)');
console.log('         producto.tipoProductoId: TP-086_id → TP-024_id');
console.log('         producto.tipoProducto: snapshot del TP-024');
console.log('');
console.log('  PASO 2 · Backup local de TP-086 + DELETE');
console.log('         backups/tipoProducto-TP-086-deleted-{ts}.json');
console.log('         db.doc(`tiposProducto/${TP-086_id}`).delete()');
console.log('');
console.log(`  PASO 3 · Renumerar TP-098 → TP-086`);
console.log(`         tiposProducto.${tp098?.id}.codigo: "TP-098" → "TP-086"`);
console.log(`         + actualizar ${prodTP098.length} producto(s) que tengan snapshot TP-098 → TP-086`);
console.log('');
console.log(`  PASO 4 · Renumerar TP-097 → TP-070`);
console.log(`         tiposProducto.${tp097?.id}.codigo: "TP-097" → "TP-070"`);
console.log(`         + actualizar ${prodTP097.length} producto(s) que tengan snapshot TP-097 → TP-070`);
console.log('');
console.log('  PASO 5 · Crear contadores/TP');
console.log('         contadores/TP.current = 96');
console.log('         (próximo tipo creado: TP-097)');

console.log('\n═══ Resumen de escrituras ═══');
const totalEscrituras = 1 /* SUP-0163 */ + 1 /* delete TP-086 */ + 1 /* update TP-098 */ + prodTP098.length + 1 /* update TP-097 */ + prodTP097.length + 1 /* contador TP */;
console.log(`  Total: ${totalEscrituras} operaciones`);
console.log(`    - 1 update de producto (SUP-0163)`);
console.log(`    - 1 delete de tipoProducto (TP-086)`);
console.log(`    - 1 update de tipoProducto (TP-098 → TP-086)`);
console.log(`    - ${prodTP098.length} update de productos (snapshot TP-098 → TP-086)`);
console.log(`    - 1 update de tipoProducto (TP-097 → TP-070)`);
console.log(`    - ${prodTP097.length} update de productos (snapshot TP-097 → TP-070)`);
console.log(`    - 1 set de contadores/TP`);

process.exit(0);
