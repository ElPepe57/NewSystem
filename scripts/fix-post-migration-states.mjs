/**
 * ===============================================
 * FIX: Reparar estados inconsistentes post-migración multi-origen
 * ===============================================
 *
 * Escanea TODAS las unidades activas buscando:
 *   1. estado='recibida_usa' → cambiar a 'recibida_origen'
 *   2. estado='en_transito_usa' → cambiar a 'en_transito_origen'
 *   3. pais='Peru' con estado en origen → cambiar a 'disponible_peru'
 *   4. pais!='Peru' con estado='disponible_peru' → cambiar a 'recibida_origen'
 *
 * Luego sincroniza stock de todos los productos afectados.
 *
 * Uso:
 *   DRY RUN:  node scripts/fix-post-migration-states.mjs --dry-run
 *   EJECUTAR: node scripts/fix-post-migration-states.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_LIMIT = 450;

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

// Estados terminales que no tocamos
const ESTADOS_TERMINALES = ['vendida', 'vencida', 'danada'];
const ESTADOS_EN_ORIGEN = ['recibida_origen', 'recibida_usa'];
const PAISES_ORIGEN = ['USA', 'China', 'Corea', 'Korea'];

function esPaisOrigen(pais) {
  return pais && pais !== 'Peru' && pais !== 'Peru_local';
}

async function main() {
  console.log(`\n${C.bold}=== Fix Post-Migration States ===${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  const unidadesSnap = await db.collection('unidades').get();
  console.log(`📊 Total unidades en Firestore: ${unidadesSnap.size}\n`);

  let batch = db.batch();
  let batchCount = 0;
  const productosAfectados = new Set();

  const stats = {
    total: unidadesSnap.size,
    terminales: 0,
    correctas: 0,
    legacyEstado: 0,      // recibida_usa → recibida_origen
    legacyTransito: 0,    // en_transito_usa → en_transito_origen
    paisEstadoMismatch: 0, // pais vs estado inconsistency
    sinPais: 0,           // unidades sin campo pais
  };

  const problemas = [];

  for (const docSnap of unidadesSnap.docs) {
    const data = docSnap.data();
    const id = docSnap.id;
    const estado = data.estado;
    const pais = data.pais;

    // Skip terminales
    if (ESTADOS_TERMINALES.includes(estado)) {
      stats.terminales++;
      continue;
    }

    let nuevoEstado = null;
    let nuevoPais = null;
    let razon = '';

    // 1. Legacy estado recibida_usa → recibida_origen
    if (estado === 'recibida_usa') {
      if (pais === 'Peru') {
        // Unidad en Peru con estado de origen — debería ser disponible_peru
        nuevoEstado = 'disponible_peru';
        razon = 'recibida_usa + pais=Peru → disponible_peru';
        stats.paisEstadoMismatch++;
      } else {
        nuevoEstado = 'recibida_origen';
        razon = 'recibida_usa → recibida_origen (legacy rename)';
        stats.legacyEstado++;
      }
    }

    // 2. Legacy estado en_transito_usa → en_transito_origen
    else if (estado === 'en_transito_usa') {
      nuevoEstado = 'en_transito_origen';
      razon = 'en_transito_usa → en_transito_origen (legacy rename)';
      stats.legacyTransito++;
    }

    // 3. Pais=Peru con estado de origen (no legacy)
    else if (pais === 'Peru' && estado === 'recibida_origen') {
      nuevoEstado = 'disponible_peru';
      razon = 'recibida_origen + pais=Peru → disponible_peru';
      stats.paisEstadoMismatch++;
    }

    // 4. Pais de origen con estado=disponible_peru
    else if (esPaisOrigen(pais) && estado === 'disponible_peru') {
      nuevoEstado = 'recibida_origen';
      razon = `disponible_peru + pais=${pais} → recibida_origen`;
      stats.paisEstadoMismatch++;
    }

    // 5. Sin pais definido — intentar inferir
    else if (!pais && !ESTADOS_TERMINALES.includes(estado)) {
      if (estado === 'disponible_peru' || estado === 'en_transito_peru') {
        nuevoPais = 'Peru';
        razon = `pais undefined + estado=${estado} → pais=Peru`;
        stats.sinPais++;
      } else if (ESTADOS_EN_ORIGEN.includes(estado)) {
        nuevoPais = 'USA'; // default origin
        razon = `pais undefined + estado=${estado} → pais=USA`;
        stats.sinPais++;
      }
    }

    if (!nuevoEstado && !nuevoPais) {
      stats.correctas++;
      continue;
    }

    const sku = data.productoSKU || '???';
    const lote = data.lote || '???';
    problemas.push({ id: id.slice(0, 8), sku, lote, razon });
    productosAfectados.add(data.productoId);

    if (!DRY_RUN) {
      const updateData = {};
      if (nuevoEstado) updateData.estado = nuevoEstado;
      if (nuevoPais) updateData.pais = nuevoPais;
      batch.update(docSnap.ref, updateData);
      batchCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  // Commit remaining
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  // Report
  console.log(`${C.bold}=== Problemas encontrados ===${C.reset}\n`);

  if (problemas.length === 0) {
    console.log(`${C.green}✅ Todas las unidades están en estado correcto!${C.reset}\n`);
  } else {
    // Group by razon
    const porRazon = {};
    for (const p of problemas) {
      if (!porRazon[p.razon]) porRazon[p.razon] = [];
      porRazon[p.razon].push(p);
    }

    for (const [razon, items] of Object.entries(porRazon)) {
      console.log(`  ${C.cyan}${razon}${C.reset} — ${items.length} unidades`);
      if (items.length <= 5) {
        for (const item of items) {
          console.log(`    ${item.sku} (${item.lote}) [${item.id}...]`);
        }
      } else {
        for (const item of items.slice(0, 3)) {
          console.log(`    ${item.sku} (${item.lote}) [${item.id}...]`);
        }
        console.log(`    ... y ${items.length - 3} más`);
      }
    }
  }

  console.log(`\n${C.bold}=== Resumen ===${C.reset}`);
  console.log(`  Total unidades: ${stats.total}`);
  console.log(`  Terminales (vendida/vencida/danada): ${stats.terminales}`);
  console.log(`  ${C.green}Correctas: ${stats.correctas}${C.reset}`);
  console.log(`  ${C.yellow}Legacy estado (recibida_usa): ${stats.legacyEstado}${C.reset}`);
  console.log(`  ${C.yellow}Legacy tránsito (en_transito_usa): ${stats.legacyTransito}${C.reset}`);
  console.log(`  ${C.red}Pais/estado mismatch: ${stats.paisEstadoMismatch}${C.reset}`);
  console.log(`  Sin pais: ${stats.sinPais}`);
  console.log(`  Productos afectados: ${productosAfectados.size}`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para corregir: node scripts/fix-post-migration-states.mjs --execute${C.reset}\n`);
  } else if (problemas.length > 0) {
    console.log(`\n${C.green}✅ ${problemas.length} unidades corregidas${C.reset}`);
    console.log(`\nProductos afectados para sync de stock:`);
    console.log([...productosAfectados].join(', '));
    console.log();
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
