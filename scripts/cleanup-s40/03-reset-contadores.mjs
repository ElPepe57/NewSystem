/**
 * ========================================================================
 * CLEANUP S40 — FASE 3: RESET CONTADORES (B1 — solo transaccionales)
 * ========================================================================
 *
 * Resetea SOLO los contadores transaccionales (OC, ENV, VT, REC, MOV, BOL,
 * TRN, LIN, BMN) a 0. Los contadores de MAESTROS (ALM, CAS, COL, MRC, SUP,
 * SKC, CAT, CMP, ETQ, TIP, TP, TPR, CC, PRV) se PRESERVAN con su valor
 * actual para evitar colisiones de código con productos/maestros existentes.
 *
 * Ejemplos post-reset:
 *   - Primera OC nueva       → OC-2026-001
 *   - Primer envío nuevo     → ENV-2026-001
 *   - Primer reclamo nuevo   → REC-2026-001
 *   - Pero: próximo producto SUP conserva su secuencia actual (→ SUP-0170)
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-s40/03-reset-contadores.mjs
 *   EJECUTAR: node scripts/cleanup-s40/03-reset-contadores.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

// ─── Contadores TRANSACCIONALES (se resetean a 0) ───────────────────────
// Patrones y IDs conocidos de contadores que se reinician con el cleanup.
const TRANSACCIONALES_EXACT = new Set([
  'BMN',   // BusinessMN (no se usa claramente, se resetea por seguridad)
  'LIN',   // Línea de negocio (transaccional — ver si realmente es maestro)
]);
const TRANSACCIONALES_PREFIXES = [
  'OC-',       // OC-2026, OC-2027, etc.
  'ENV-',      // ENV-2026
  'VT-',       // VT-2026 (ventas)
  'REC-',      // REC-2026 (reclamos)
  'REQ-',      // REQ-2026 (requerimientos)
  'COT-',      // COT-2026 (cotizaciones)
  'MOV-',      // MOV-2026 (movimientos tesorería)
  'BOL-',      // BOL-2026-04 (boletas planilla)
  'TRN-',      // TRN-2026 (transferencias legacy)
  'GAS-',      // GAS-2026 (gastos)
  'LOT-',      // LOT-2026 (lotes pagos)
  'ENT-',      // ENT-2026 (entregas)
  'ADN-',      // ADN-2026 (adelantos nómina)
];

// Contadores de MAESTROS (NO se resetean — evitan colisiones con códigos existentes)
// Documentados aquí para transparencia:
//   ALM (almacenes legacy, se borra en Fase 2)
//   CAS (casillas)
//   COL (colaboradores)
//   MRC (marcas)
//   SUP / SKC (productos)
//   CAT (categorías)
//   CMP (competidores)
//   ETQ (etiquetas)
//   TIP / TP / TPR (tipos producto, canales venta, etc.)
//   CC (categorías costos)
//   PRV (proveedores)

function esTransaccional(id) {
  if (TRANSACCIONALES_EXACT.has(id)) return true;
  return TRANSACCIONALES_PREFIXES.some(p => id.startsWith(p));
}

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 3: RESET CONTADORES${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(DRY_RUN
    ? `${C.yellow}${C.bold}MODO DRY-RUN. Usa --execute para ejecutar.${C.reset}\n`
    : `${C.red}${C.bold}⚠️  MODO EJECUCIÓN REAL${C.reset}\n`);

  const snap = await db.collection('contadores').get();

  if (snap.empty) {
    console.log(`${C.dim}No hay contadores en Firestore (ya está vacío).${C.reset}`);
    process.exit(0);
  }

  console.log(`${C.bold}Contadores detectados: ${snap.size}${C.reset}\n`);

  // Clasificar y mostrar
  const data = snap.docs.map(d => ({
    id: d.id,
    current: d.data().current || 0,
    ref: d.ref,
    transaccional: esTransaccional(d.id),
  }));
  data.sort((a, b) => {
    if (a.transaccional !== b.transaccional) return a.transaccional ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const resetear = data.filter(c => c.transaccional);
  const preservar = data.filter(c => !c.transaccional);

  console.log(`${C.bold}${C.red}A RESETEAR → 0 (transaccionales, ${resetear.length}):${C.reset}`);
  for (const c of resetear) {
    console.log(`  ${c.id.padEnd(25)} → ${c.current} ${C.red}→ 0${C.reset}`);
  }

  console.log(`\n${C.bold}${C.green}A PRESERVAR (maestros, ${preservar.length}):${C.reset}`);
  for (const c of preservar) {
    console.log(`  ${c.id.padEnd(25)} → ${c.current} ${C.dim}(sin cambios)${C.reset}`);
  }

  if (resetear.length === 0) {
    console.log(`\n${C.dim}No hay contadores transaccionales para resetear.${C.reset}`);
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log(`\n${C.yellow}${C.bold}Para ejecutar:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/03-reset-contadores.mjs --execute\n`);
    process.exit(0);
  }

  // Reset real — solo transaccionales
  console.log(`\n${C.red}${C.bold}Reseteando ${resetear.length} contadores transaccionales en 3 segundos...${C.reset}`);
  await new Promise(r => setTimeout(r, 3000));

  const batch = db.batch();
  const now = new Date();
  for (const c of resetear) {
    batch.set(c.ref, { current: 0, resetAt: now, resetBy: 'cleanup-s40' }, { merge: true });
  }
  await batch.commit();

  console.log(`\n${C.green}${C.bold}✓ ${resetear.length} contadores transaccionales reseteados a 0${C.reset}`);
  console.log(`${C.green}${C.bold}✓ ${preservar.length} contadores de maestros preservados${C.reset}`);
  console.log(`\n${C.green}Próximos números transaccionales: OC-2026-001, ENV-2026-001, etc.${C.reset}`);
  console.log(`\n${C.green}${C.bold}Continuar con:${C.reset}`);
  console.log(`  node scripts/cleanup-s40/04-limpiar-metricas.mjs --execute\n`);

  process.exit(0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error fatal:${C.reset}`, err);
  process.exit(1);
});
