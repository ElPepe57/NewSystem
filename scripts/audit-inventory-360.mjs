/**
 * ===============================================
 * AUDIT 360°: Cruce completo de inventario
 * ===============================================
 *
 * Cruza TODAS las fuentes de datos para encontrar discrepancias:
 *   - Unidades en Firestore (estado, pais, almacen)
 *   - OCs recibidas (cuántas unidades deberían existir)
 *   - Transferencias completadas (qué debería estar en Perú)
 *   - Ventas registradas (qué debería estar vendida)
 *   - ML ventas (ventas de MercadoLibre que podrían no estar sincronizadas)
 *
 * Uso: node scripts/audit-inventory-360.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

async function main() {
  console.log(`\n${C.bold}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║   AUDITORÍA 360° — Cruce de Inventario       ║${C.reset}`);
  console.log(`${C.bold}╚══════════════════════════════════════════════╝${C.reset}\n`);

  // ========== 1. CARGAR TODOS LOS DATOS ==========
  console.log('📥 Cargando datos de Firestore...');

  const [unidadesSnap, productosSnap, ventasSnap, ocSnap, transferenciasSnap, almacenesSnap] = await Promise.all([
    db.collection('unidades').get(),
    db.collection('productos').get(),
    db.collection('ventas').get(),
    db.collection('ordenesCompra').get(),
    db.collection('transferencias').get(),
    db.collection('almacenes').get(),
  ]);

  const unidades = unidadesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ventas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ocs = ocSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const transferencias = transferenciasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const almacenes = almacenesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`  Unidades: ${unidades.length}, Productos: ${productos.length}, Ventas: ${ventas.length}`);
  console.log(`  OCs: ${ocs.length}, Transferencias: ${transferencias.length}, Almacenes: ${almacenes.length}\n`);

  // ========== 2. CLASIFICAR UNIDADES POR ESTADO ==========
  console.log(`${C.bold}═══ DISTRIBUCIÓN DE UNIDADES POR ESTADO ═══${C.reset}\n`);

  const porEstado = {};
  for (const u of unidades) {
    const e = u.estado || 'SIN_ESTADO';
    porEstado[e] = (porEstado[e] || 0) + 1;
  }

  const estadosOrdenados = Object.entries(porEstado).sort((a, b) => b[1] - a[1]);
  for (const [estado, count] of estadosOrdenados) {
    const isActive = !['vendida', 'vencida', 'danada'].includes(estado);
    const color = isActive ? C.green : C.dim;
    console.log(`  ${color}${estado.padEnd(25)} ${String(count).padStart(4)}${C.reset}${isActive ? ' ← activa' : ''}`);
  }

  const activas = unidades.filter(u => !['vendida', 'vencida', 'danada'].includes(u.estado));
  const vendidas = unidades.filter(u => u.estado === 'vendida');
  console.log(`\n  ${C.bold}Total activas: ${activas.length}${C.reset} (las que deben coincidir con físico)`);
  console.log(`  ${C.dim}Total vendidas: ${vendidas.length}${C.reset}`);

  // ========== 3. DESGLOSE POR PAÍS (solo activas) ==========
  console.log(`\n${C.bold}═══ ACTIVAS POR PAÍS ═══${C.reset}\n`);

  const porPais = {};
  for (const u of activas) {
    const p = u.pais || 'SIN_PAIS';
    porPais[p] = (porPais[p] || 0) + 1;
  }
  for (const [pais, count] of Object.entries(porPais)) {
    console.log(`  ${pais.padEnd(15)} ${count}`);
  }

  // ========== 4. DESGLOSE POR PRODUCTO (activas) ==========
  console.log(`\n${C.bold}═══ INVENTARIO POR PRODUCTO (solo activas, para comparar con conteo físico) ═══${C.reset}\n`);

  const porProducto = {};
  for (const u of activas) {
    const key = u.productoId;
    if (!porProducto[key]) {
      porProducto[key] = { sku: u.productoSKU, nombre: u.productoNombre, usa: 0, peru: 0, transito: 0, reservada: 0, total: 0, unidades: [] };
    }
    const p = porProducto[key];
    p.total++;
    p.unidades.push(u);

    if (['recibida_origen', 'recibida_usa'].includes(u.estado)) p.usa++;
    else if (u.estado === 'disponible_peru') p.peru++;
    else if (u.estado?.includes('transito')) p.transito++;
    else if (u.estado === 'reservada' || u.estado === 'asignada_pedido') p.reservada++;
  }

  // Sort by SKU
  const productosSorted = Object.entries(porProducto).sort((a, b) => (a[1].sku || '').localeCompare(b[1].sku || ''));

  console.log(`  ${'SKU'.padEnd(12)} ${'Producto'.padEnd(30)} ${'USA'.padStart(4)} ${'Perú'.padStart(5)} ${'Trán'.padStart(5)} ${'Res'.padStart(4)} ${'TOTAL'.padStart(6)}`);
  console.log(`  ${'-'.repeat(75)}`);

  let grandTotal = 0;
  for (const [, info] of productosSorted) {
    console.log(`  ${(info.sku || '???').padEnd(12)} ${(info.nombre || '???').substring(0, 28).padEnd(30)} ${String(info.usa).padStart(4)} ${String(info.peru).padStart(5)} ${String(info.transito).padStart(5)} ${String(info.reservada).padStart(4)} ${C.bold}${String(info.total).padStart(6)}${C.reset}`);
    grandTotal += info.total;
  }
  console.log(`  ${'-'.repeat(75)}`);
  console.log(`  ${''.padEnd(42)} ${C.bold}TOTAL: ${grandTotal}${C.reset}`);

  // ========== 5. CRUCE CON VENTAS — buscar unidades que debieron marcarse vendida ==========
  console.log(`\n${C.bold}═══ CRUCE: VENTAS vs UNIDADES ═══${C.reset}\n`);

  const ventasCompletadas = ventas.filter(v =>
    v.estado === 'entregada' || v.estado === 'despachada' || v.estado === 'completada'
  );
  const ventasConUnidades = ventas.filter(v => v.unidadesAsignadas?.length > 0 || v.productosConUnidades?.length > 0);

  console.log(`  Ventas totales: ${ventas.length}`);
  console.log(`  Ventas entregadas/completadas: ${ventasCompletadas.length}`);
  console.log(`  Ventas con unidades asignadas: ${ventasConUnidades.length}`);

  // Recopilar unidadIds que están en ventas entregadas
  const unidadesEnVentasEntregadas = new Set();
  for (const v of ventasCompletadas) {
    // Check different structures where unit IDs might be stored
    if (v.unidadesAsignadas) {
      for (const uid of v.unidadesAsignadas) {
        unidadesEnVentasEntregadas.add(typeof uid === 'string' ? uid : uid.unidadId);
      }
    }
    if (v.productosConUnidades) {
      for (const p of v.productosConUnidades) {
        if (p.unidadesAsignadas) {
          for (const uid of p.unidadesAsignadas) {
            unidadesEnVentasEntregadas.add(typeof uid === 'string' ? uid : uid.unidadId);
          }
        }
      }
    }
  }

  // Check: units in completed sales that are NOT marked as vendida
  let fantasmasVenta = 0;
  const fantasmasVentaDetalle = [];
  for (const uid of unidadesEnVentasEntregadas) {
    const unidad = unidades.find(u => u.id === uid);
    if (unidad && unidad.estado !== 'vendida') {
      fantasmasVenta++;
      fantasmasVentaDetalle.push({
        id: uid.slice(0, 8),
        sku: unidad.productoSKU,
        estado: unidad.estado,
      });
    }
  }

  if (fantasmasVenta > 0) {
    console.log(`\n  ${C.red}⚠ ${fantasmasVenta} unidades en ventas entregadas que NO están marcadas como 'vendida':${C.reset}`);
    for (const f of fantasmasVentaDetalle.slice(0, 10)) {
      console.log(`    ${f.sku} [${f.id}...] estado actual: "${f.estado}"`);
    }
    if (fantasmasVentaDetalle.length > 10) console.log(`    ... y ${fantasmasVentaDetalle.length - 10} más`);
  } else {
    console.log(`  ${C.green}✅ Todas las unidades en ventas entregadas están marcadas como vendida${C.reset}`);
  }

  // ========== 6. CRUCE CON ML — ventas de MercadoLibre ==========
  console.log(`\n${C.bold}═══ CRUCE: MERCADOLIBRE ═══${C.reset}\n`);

  const ventasML = ventas.filter(v => v.origenML || v.mercadoLibreId || v.mlOrderId);
  const ventasMLEntregadas = ventasML.filter(v =>
    v.estado === 'entregada' || v.estado === 'despachada' || v.estado === 'completada'
  );
  const ventasMLSinUnidades = ventasML.filter(v =>
    !v.unidadesAsignadas?.length && !v.productosConUnidades?.length &&
    v.estado !== 'cancelada' && v.estado !== 'cotizacion'
  );

  console.log(`  Ventas ML total: ${ventasML.length}`);
  console.log(`  Ventas ML entregadas: ${ventasMLEntregadas.length}`);
  console.log(`  ${C.yellow}Ventas ML sin unidades asignadas (activas): ${ventasMLSinUnidades.length}${C.reset}`);

  if (ventasMLSinUnidades.length > 0) {
    console.log(`\n  Detalle ventas ML sin unidades:`);
    for (const v of ventasMLSinUnidades.slice(0, 10)) {
      const num = v.numeroVenta || v.numero || '???';
      const mlId = v.mercadoLibreId || v.mlOrderId || '???';
      console.log(`    ${num} | ML: ${mlId} | estado: ${v.estado} | productos: ${v.productos?.length || 0}`);
    }
  }

  // ========== 7. CRUCE CON OCs — unidades recibidas vs creadas ==========
  console.log(`\n${C.bold}═══ CRUCE: OCs RECIBIDAS vs UNIDADES CREADAS ═══${C.reset}\n`);

  const ocsRecibidas = ocs.filter(o =>
    o.estado === 'recibida' || o.estado === 'recibida_parcial' || o.estado === 'completada'
  );

  let totalUnidadesEsperadasOC = 0;
  for (const oc of ocsRecibidas) {
    if (oc.productos) {
      for (const p of oc.productos) {
        totalUnidadesEsperadasOC += (p.cantidadRecibida || p.cantidad || 0);
      }
    }
  }

  // Count units that reference these OCs
  const unidadesConLoteOC = unidades.filter(u => u.lote?.startsWith('OC-'));
  console.log(`  OCs recibidas: ${ocsRecibidas.length}`);
  console.log(`  Unidades esperadas (sum cantidadRecibida): ${totalUnidadesEsperadasOC}`);
  console.log(`  Unidades en Firestore con lote OC-*: ${unidadesConLoteOC.length}`);

  if (Math.abs(totalUnidadesEsperadasOC - unidadesConLoteOC.length) > 0) {
    console.log(`  ${C.yellow}⚠ Diferencia: ${totalUnidadesEsperadasOC - unidadesConLoteOC.length} unidades${C.reset}`);
  }

  // ========== 8. CRUCE CON TRANSFERENCIAS — unidades en Perú vs transferidas ==========
  console.log(`\n${C.bold}═══ CRUCE: TRANSFERENCIAS COMPLETADAS vs UNIDADES EN PERÚ ═══${C.reset}\n`);

  const transferenciasCompletadas = transferencias.filter(t =>
    (t.tipo === 'usa_peru' || t.tipo === 'internacional_peru') &&
    (t.estado === 'recibida_completa' || t.estado === 'recibida_parcial')
  );

  let totalTransferidoAPeru = 0;
  for (const t of transferenciasCompletadas) {
    const recibidas = (t.unidades || []).filter(u => u.estadoTransferencia === 'recibida');
    totalTransferidoAPeru += recibidas.length;
  }

  const unidadesConPaisPeru = unidades.filter(u => u.pais === 'Peru');
  const unidadesActivasPeru = unidadesConPaisPeru.filter(u => !['vencida', 'danada'].includes(u.estado));

  console.log(`  Transferencias internacionales completadas: ${transferenciasCompletadas.length}`);
  console.log(`  Total unidades transferidas a Perú (recibidas): ${totalTransferidoAPeru}`);
  console.log(`  Unidades con pais=Peru en Firestore: ${unidadesConPaisPeru.length}`);
  console.log(`  Unidades activas+vendidas en Peru: ${unidadesActivasPeru.length}`);

  // ========== 9. ALMACENES — distribución real ==========
  console.log(`\n${C.bold}═══ DISTRIBUCIÓN POR ALMACÉN (solo activas) ═══${C.reset}\n`);

  const porAlmacen = {};
  for (const u of activas) {
    const key = u.almacenId || 'SIN_ALMACEN';
    if (!porAlmacen[key]) {
      porAlmacen[key] = { nombre: u.almacenNombre || '???', count: 0 };
    }
    porAlmacen[key].count++;
  }

  for (const [id, info] of Object.entries(porAlmacen)) {
    const almacen = almacenes.find(a => a.id === id);
    const codigo = almacen?.codigo || '???';
    console.log(`  ${codigo.padEnd(15)} ${info.nombre.padEnd(30)} ${info.count} unidades`);
  }

  // ========== 10. RESUMEN FINAL ==========
  console.log(`\n${C.bold}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║            RESUMEN FINAL                     ║${C.reset}`);
  console.log(`${C.bold}╚══════════════════════════════════════════════╝${C.reset}\n`);

  console.log(`  Total unidades en Firestore:     ${unidades.length}`);
  console.log(`  ${C.green}Activas (inventario):             ${activas.length}${C.reset}  ← comparar con conteo físico (38)`);
  console.log(`  Vendidas:                         ${vendidas.length}`);
  console.log(`  Dañadas/vencidas:                 ${unidades.length - activas.length - vendidas.length}`);
  console.log(`  ${C.red}Diferencia vs físico:             ${activas.length - 38} unidades fantasma${C.reset}`);
  console.log(`  Fantasmas en ventas entregadas:   ${fantasmasVenta}`);
  console.log(`  Ventas ML sin unidades asignadas: ${ventasMLSinUnidades.length}`);
  console.log();

  // ========== 11. UNIDADES SOSPECHOSAS — activas pero sin almacen Perú ni en tránsito ==========
  console.log(`${C.bold}═══ UNIDADES ACTIVAS EN PERÚ — detalle para reconciliar ═══${C.reset}\n`);

  const activasPeru = activas.filter(u => u.pais === 'Peru');
  const activasUSA = activas.filter(u => u.pais === 'USA' || u.pais === undefined);

  console.log(`  En Perú: ${activasPeru.length}`);
  console.log(`  En USA/Origen: ${activasUSA.length}`);
  console.log(`  En tránsito: ${activas.filter(u => u.estado?.includes('transito')).length}`);

  console.log(`\n  ${C.cyan}Las ${activasPeru.length} unidades en Perú son tu inventario local.${C.reset}`);
  console.log(`  ${C.cyan}Las ${activasUSA.length} unidades en USA están pendientes de transferir.${C.reset}`);
  console.log(`  ${C.cyan}Tu conteo físico de 38 debería coincidir con las de Perú disponibles + reservadas.${C.reset}`);

  const peruDisponibles = activasPeru.filter(u => u.estado === 'disponible_peru').length;
  const peruReservadas = activasPeru.filter(u => u.estado === 'reservada' || u.estado === 'asignada_pedido').length;
  console.log(`\n  Perú disponibles: ${peruDisponibles}`);
  console.log(`  Perú reservadas:  ${peruReservadas}`);
  console.log(`  ${C.bold}Perú total activas: ${peruDisponibles + peruReservadas}${C.reset}  ← vs 38 físico = ${C.red}diferencia ${peruDisponibles + peruReservadas - 38}${C.reset}`);

  console.log();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
