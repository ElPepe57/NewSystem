/**
 * ========================================================================
 * CLEANUP S40 — FASE 1: INVENTARIO (NO DESTRUCTIVO)
 * ========================================================================
 *
 * Lee TODA la BD Firestore y genera un reporte en
 * `docs/ESTADO_BD_PRE_CLEANUP_S40.md` con:
 *   - Total de colecciones raíz detectadas
 *   - Conteo de docs por colección
 *   - Clasificación: CONSERVAR / BORRAR / NO CATALOGADA
 *   - Detección automática de subcolecciones de archivo (*Archivo, *Anulados)
 *   - Top 5 más recientes de cada colección transaccional a borrar
 *   - Detección de huérfanos básicos (pagos sin OC, unidades sin envío, etc.)
 *
 * Uso:
 *   node scripts/cleanup-s40/01-inventario.mjs
 *
 * Este script es 100% READ-ONLY. No modifica nada en Firestore.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

// ─── Clasificación de colecciones ────────────────────────────────────────

const COLLECTIONS_KEEP = new Set([
  // Productos y maestros
  'productos',
  // Maestros comerciales
  'marcas', 'categorias', 'tiposProducto', 'canalesVenta', 'etiquetas', 'competidores',
  // Maestros org
  'lineasNegocio', 'paisesOrigen',
  // Red logística
  'casillas', 'colaboradores',
  // Maestros relación
  'clientes', 'proveedores',
  // Finanzas config
  'cuentasCaja', 'categoriasCostos', 'insumos', 'kitsEmpaque', 'tarjetasCredito', 'tiposCambio',
  // Sistema
  'configuracion', 'users',
  // ML maestro
  'mlProductMap', 'mlConfig',
]);

const COLLECTIONS_DELETE = new Set([
  // Ventas
  'ventas', 'cotizaciones', 'entregas', 'entregas_parciales',
  // Compras
  'requerimientos', 'ordenesCompra',
  // Inventario
  'unidades',
  // S40: 'almacenes' legacy — consolidado a 'casillas' en Fase 0B
  'almacenes',
  // Logística
  'envios', 'transferencias', 'reclamos',
  // Finanzas
  'gastos', 'movimientosTesoreria', 'conversionesCambiarias', 'registrosTCTransaccion',
  'aportesCapital', 'retirosCapital',
  // Planilla
  'boletas', 'adelantosNomina',
  // Otros transaccionales
  'lotePagos', 'cierresContables', 'devoluciones',
  // Logs
  'actividad', 'audit_logs', 'movimientos_transportista', 'historialRecalculoCTRU',
  'scanHistory', 'conteosInventario', '_errorLog', 'notificaciones',
  // Pool USD deprecated
  'poolUSDMovimientos', 'poolUSDSnapshots',
  // ML transaccional
  'mlOrderSync', 'mlQuestions', 'mlWebhookLog', 'mlShipmentLog',
  // Colaboración
  'chat_mensajes', 'chat_meta', 'llamadas', 'llamadasIntel', 'presencia',
  // Cacheadas
  'estadisticas',
]);

const COLLECTIONS_RESET = new Set([
  'contadores',
]);

// Patrones para detectar archivos/anulados automáticamente
const ARCHIVE_PATTERNS = [
  /Anulados$/i, /Archivo$/i, /_archivo$/i, /_historico$/i, /Backup$/i,
];

function clasificar(id) {
  if (COLLECTIONS_KEEP.has(id)) return 'CONSERVAR';
  if (COLLECTIONS_DELETE.has(id)) return 'BORRAR';
  if (COLLECTIONS_RESET.has(id)) return 'RESETEAR';
  if (ARCHIVE_PATTERNS.some(p => p.test(id))) return 'BORRAR (archivo)';
  return 'NO CATALOGADA';
}

// ─── Helper para fecha ───────────────────────────────────────────────────

function fmtFecha(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().substring(0, 19).replace('T', ' ');
  } catch {
    return '—';
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 1: INVENTARIO (READ-ONLY)${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}\n`);

  const start = Date.now();
  const cols = await db.listCollections();
  console.log(`${C.dim}Detectadas ${cols.length} colecciones raíz en Firestore${C.reset}\n`);

  // ──── Contar por colección ────
  const inventario = [];
  for (const c of cols) {
    try {
      const snap = await c.count().get();
      const count = snap.data().count;
      const clasif = clasificar(c.id);
      inventario.push({ id: c.id, count, clasif });
    } catch (err) {
      inventario.push({ id: c.id, count: -1, clasif: 'ERROR', error: err.message });
    }
  }

  // Ordenar: BORRAR primero, luego CONSERVAR, luego RESETEAR, luego NO CATALOGADA
  const order = { 'BORRAR': 1, 'BORRAR (archivo)': 2, 'RESETEAR': 3, 'CONSERVAR': 4, 'NO CATALOGADA': 5, 'ERROR': 6 };
  inventario.sort((a, b) => {
    const oa = order[a.clasif] || 9;
    const ob = order[b.clasif] || 9;
    if (oa !== ob) return oa - ob;
    return b.count - a.count;
  });

  // ──── Totales ────
  const totales = {
    conservar: inventario.filter(i => i.clasif === 'CONSERVAR').reduce((s, i) => s + Math.max(i.count, 0), 0),
    borrar: inventario.filter(i => i.clasif === 'BORRAR' || i.clasif === 'BORRAR (archivo)').reduce((s, i) => s + Math.max(i.count, 0), 0),
    resetear: inventario.filter(i => i.clasif === 'RESETEAR').reduce((s, i) => s + Math.max(i.count, 0), 0),
    noCatalogada: inventario.filter(i => i.clasif === 'NO CATALOGADA').reduce((s, i) => s + Math.max(i.count, 0), 0),
  };

  // ──── Imprimir resumen ────
  console.log(`${C.bold}📊 RESUMEN POR CLASIFICACIÓN${C.reset}`);
  console.log(`  ${C.green}✓ CONSERVAR       ${C.reset} ${totales.conservar.toString().padStart(6)} docs`);
  console.log(`  ${C.red}✗ BORRAR          ${C.reset} ${totales.borrar.toString().padStart(6)} docs`);
  console.log(`  ${C.yellow}↻ RESETEAR        ${C.reset} ${totales.resetear.toString().padStart(6)} docs`);
  console.log(`  ${C.yellow}? NO CATALOGADA   ${C.reset} ${totales.noCatalogada.toString().padStart(6)} docs\n`);

  // ──── Muestras de transaccionales a borrar ────
  console.log(`${C.bold}📋 MUESTRAS (últimos 5 docs por colección a borrar)${C.reset}`);
  const muestras = {};
  for (const inv of inventario) {
    if ((inv.clasif !== 'BORRAR' && inv.clasif !== 'BORRAR (archivo)') || inv.count === 0) continue;
    try {
      // Intenta ordenar por fechaCreacion desc; si no existe, toma cualquiera
      let q = db.collection(inv.id).limit(5);
      try {
        q = db.collection(inv.id).orderBy('fechaCreacion', 'desc').limit(5);
      } catch { /* no tiene ese campo, fallback */ }

      const snap = await q.get();
      muestras[inv.id] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          numero: data.numeroOrden || data.numeroEnvio || data.numeroVenta || data.numeroMovimiento || data.numeroReclamo || data.numeroGasto || data.numero || '—',
          fecha: fmtFecha(data.fechaCreacion || data.fecha),
          extracto: JSON.stringify({
            estado: data.estado,
            monto: data.montoUSD || data.totalUSD || data.montoPEN || data.monto,
            ref: data.numeroOrden || data.ordenCompraNumero || data.envioNumero,
          }).slice(0, 120),
        };
      });
    } catch (err) {
      muestras[inv.id] = [{ id: 'ERROR', numero: '—', fecha: '—', extracto: err.message }];
    }
  }

  // ──── Huérfanos básicos ────
  console.log(`\n${C.bold}🔍 DETECCIÓN DE HUÉRFANOS${C.reset}`);
  const huerfanos = [];

  // Unidades sin OC ni envío
  try {
    const unidadesSnap = await db.collection('unidades').limit(2000).get();
    const sinVinculo = unidadesSnap.docs.filter(d => {
      const x = d.data();
      return !x.ordenCompraId && !x.envioId;
    }).length;
    huerfanos.push({ tipo: 'unidades sin OC ni envío', count: sinVinculo, total: unidadesSnap.size });
    console.log(`  Unidades sin OC ni envío: ${sinVinculo} / ${unidadesSnap.size}`);
  } catch (e) { console.log(`  Unidades: no pude leer (${e.message})`); }

  // Envíos sin OC (legítimo en interna_origen; reportar para info)
  try {
    const snap = await db.collection('envios').limit(500).get();
    const sinOC = snap.docs.filter(d => !d.data().ordenCompraId).length;
    huerfanos.push({ tipo: 'envíos sin ordenCompraId', count: sinOC, total: snap.size, nota: 'legítimo en interna_origen' });
    console.log(`  Envíos sin ordenCompraId: ${sinOC} / ${snap.size} (ok si son interna_origen)`);
  } catch (e) { console.log(`  Envíos: no pude leer`); }

  // Reclamos sin envío
  try {
    const snap = await db.collection('reclamos').limit(500).get();
    const sinEnv = snap.docs.filter(d => !d.data().envioId).length;
    huerfanos.push({ tipo: 'reclamos sin envioId', count: sinEnv, total: snap.size });
    console.log(`  Reclamos sin envioId: ${sinEnv} / ${snap.size}`);
  } catch (e) { console.log(`  Reclamos: no pude leer`); }

  // Movimientos tesorería sin referencia
  try {
    const snap = await db.collection('movimientosTesoreria').limit(1000).get();
    const sinRef = snap.docs.filter(d => {
      const x = d.data();
      return !x.ordenCompraId && !x.ventaId && !x.gastoId && !x.cotizacionId && !x.transferenciaId;
    }).length;
    huerfanos.push({ tipo: 'movimientos tesorería sin ref a entidad', count: sinRef, total: snap.size, nota: 'ok si son aportes/retiros/conversiones' });
    console.log(`  Movimientos sin ref: ${sinRef} / ${snap.size} (ok si son aportes/retiros)`);
  } catch (e) { console.log(`  Movimientos: no pude leer`); }

  // Contadores actuales
  console.log(`\n${C.bold}🔢 CONTADORES ACTUALES${C.reset}`);
  const contadores = [];
  try {
    const snap = await db.collection('contadores').get();
    snap.docs.forEach(d => {
      const data = d.data();
      contadores.push({ id: d.id, current: data.current || 0 });
      console.log(`  ${d.id.padEnd(20)} → ${data.current || 0}`);
    });
  } catch (e) { console.log(`  No pude leer contadores: ${e.message}`); }

  // ──── Generar reporte markdown ────
  const reportePath = resolve(process.cwd(), 'docs/ESTADO_BD_PRE_CLEANUP_S40.md');
  let md = `# Estado BD pre-cleanup S40\n\n`;
  md += `**Generado:** ${new Date().toISOString()}\n`;
  md += `**Proyecto:** businessmn-269c9\n`;
  md += `**Total colecciones raíz detectadas:** ${cols.length}\n`;
  md += `**Duración inventario:** ${((Date.now() - start) / 1000).toFixed(1)}s\n\n`;

  md += `## Resumen por clasificación\n\n`;
  md += `| Clasificación | Docs totales | Colecciones |\n`;
  md += `|---|---|---|\n`;
  md += `| ✅ CONSERVAR | ${totales.conservar} | ${inventario.filter(i => i.clasif === 'CONSERVAR').length} |\n`;
  md += `| 🗑️ BORRAR | ${totales.borrar} | ${inventario.filter(i => i.clasif === 'BORRAR' || i.clasif === 'BORRAR (archivo)').length} |\n`;
  md += `| 🔄 RESETEAR | ${totales.resetear} | ${inventario.filter(i => i.clasif === 'RESETEAR').length} |\n`;
  md += `| ❓ NO CATALOGADA | ${totales.noCatalogada} | ${inventario.filter(i => i.clasif === 'NO CATALOGADA').length} |\n\n`;

  md += `## Inventario completo\n\n`;
  md += `| Colección | Clasificación | Docs |\n`;
  md += `|---|---|---:|\n`;
  for (const inv of inventario) {
    const icon = inv.clasif === 'CONSERVAR' ? '✅' : inv.clasif === 'BORRAR' || inv.clasif === 'BORRAR (archivo)' ? '🗑️' : inv.clasif === 'RESETEAR' ? '🔄' : inv.clasif === 'NO CATALOGADA' ? '❓' : '⚠️';
    md += `| \`${inv.id}\` | ${icon} ${inv.clasif} | ${inv.count} |\n`;
  }

  // No catalogadas — ACCIÓN REQUERIDA
  const noCatalogadas = inventario.filter(i => i.clasif === 'NO CATALOGADA');
  if (noCatalogadas.length > 0) {
    md += `\n## ⚠️ Colecciones NO CATALOGADAS\n\n`;
    md += `Estas colecciones existen en Firestore pero no están en las listas de CONSERVAR ni BORRAR del script. `;
    md += `**Requieren decisión manual antes de ejecutar la Fase 2.**\n\n`;
    md += `| Colección | Docs |\n|---|---:|\n`;
    for (const nc of noCatalogadas) md += `| \`${nc.id}\` | ${nc.count} |\n`;
  }

  md += `\n## Contadores actuales\n\n`;
  md += `| Contador | Valor actual |\n|---|---:|\n`;
  for (const c of contadores) md += `| \`${c.id}\` | ${c.current} |\n`;
  md += `\n> Todos se reiniciarán a 0 en la Fase 3 (próxima entidad será …-2026-001).\n`;

  md += `\n## Muestras (últimos 5 docs por colección a borrar)\n\n`;
  for (const [colId, samples] of Object.entries(muestras)) {
    md += `### \`${colId}\`\n\n`;
    md += `| ID | Número | Fecha | Extracto |\n|---|---|---|---|\n`;
    for (const s of samples) {
      md += `| \`${s.id}\` | ${s.numero} | ${s.fecha} | \`${s.extracto.replace(/\|/g, '\\|')}\` |\n`;
    }
    md += `\n`;
  }

  md += `\n## Detección de huérfanos\n\n`;
  md += `| Tipo | Huérfanos | Total analizado | Nota |\n|---|---:|---:|---|\n`;
  for (const h of huerfanos) {
    md += `| ${h.tipo} | ${h.count} | ${h.total} | ${h.nota || '—'} |\n`;
  }

  md += `\n## 📌 Nota sobre Firebase Storage\n\n`;
  md += `Los archivos subidos a Storage (evidencias de incidencias, fotos, PDFs, comprobantes) `;
  md += `**NO se borran automáticamente**. Conservar es seguro: no afectan la operación y su costo es despreciable. `;
  md += `Si se desea limpieza total de Storage, requiere script adicional que detecte huérfanos.\n\n`;

  md += `## Siguientes pasos\n\n`;
  md += `1. Revisar las colecciones NO CATALOGADAS (si hay) y decidir CONSERVAR o BORRAR\n`;
  md += `2. Actualizar los Set \`COLLECTIONS_KEEP\` / \`COLLECTIONS_DELETE\` en \`scripts/cleanup-s40/*.mjs\` si es necesario\n`;
  md += `3. Crear tag git \`pre-cleanup-s40\` y export de Firestore\n`;
  md += `4. Ejecutar \`02-borrar-transaccionales.mjs --execute\`\n`;
  md += `5. Ejecutar \`03-reset-contadores.mjs --execute\`\n`;
  md += `6. Ejecutar \`04-limpiar-metricas.mjs --execute\`\n`;
  md += `7. Ejecutar \`05-validar-integridad.mjs\` (read-only)\n`;

  writeFileSync(reportePath, md, 'utf-8');
  console.log(`\n${C.green}${C.bold}✓ Reporte generado en:${C.reset} docs/ESTADO_BD_PRE_CLEANUP_S40.md\n`);

  // ──── Alertas al final ────
  if (noCatalogadas.length > 0) {
    console.log(`${C.bold}${C.yellow}⚠️  ${noCatalogadas.length} COLECCIÓN(ES) NO CATALOGADA(S) — revisar reporte${C.reset}`);
    for (const nc of noCatalogadas) {
      console.log(`   ${C.yellow}• ${nc.id} (${nc.count} docs)${C.reset}`);
    }
    console.log('');
  }

  console.log(`${C.dim}Duración: ${((Date.now() - start) / 1000).toFixed(1)}s${C.reset}`);
  process.exit(0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error fatal:${C.reset}`, err);
  process.exit(1);
});
