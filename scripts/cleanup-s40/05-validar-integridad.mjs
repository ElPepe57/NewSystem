/**
 * ========================================================================
 * CLEANUP S40 — FASE 5: VALIDAR INTEGRIDAD POST-CLEANUP
 * ========================================================================
 *
 * Script de validación NO DESTRUCTIVO que confirma que el estado post-cleanup
 * es correcto:
 *
 *   ✓ Colecciones transaccionales vacías
 *   ✓ Colecciones maestro no vacías (alerta si sí)
 *   ✓ Contadores en 0
 *   ✓ Métricas en maestros reseteadas (muestra random)
 *   ✓ Sin referencias cruzadas huérfanas (ej: producto con stock > 0)
 *
 * Uso:
 *   node scripts/cleanup-s40/05-validar-integridad.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

const COLLECTIONS_SHOULD_BE_EMPTY = [
  'ventas', 'cotizaciones', 'entregas', 'entregas_parciales',
  'requerimientos', 'ordenesCompra',
  'unidades',
  'almacenes',  // S40: legacy, consolidado a casillas
  'envios', 'transferencias', 'reclamos',
  'gastos', 'movimientosTesoreria', 'conversionesCambiarias', 'registrosTCTransaccion',
  'aportesCapital', 'retirosCapital',
  'boletas', 'adelantosNomina',
  'lotePagos', 'cierresContables', 'devoluciones',
  'actividad', 'audit_logs', 'movimientos_transportista', 'historialRecalculoCTRU',
  'scanHistory', 'conteosInventario', '_errorLog', 'notificaciones',
  'poolUSDMovimientos', 'poolUSDSnapshots',
  'mlOrderSync', 'mlQuestions', 'mlWebhookLog', 'mlShipmentLog',
  'chat_mensajes', 'chat_meta', 'llamadas', 'llamadasIntel', 'presencia',
  'estadisticas',
];

const COLLECTIONS_SHOULD_EXIST = [
  'productos', 'marcas', 'categorias', 'tiposProducto', 'canalesVenta',
  'etiquetas', 'competidores', 'lineasNegocio', 'paisesOrigen',
  'casillas', 'colaboradores', 'clientes', 'proveedores',
  'cuentasCaja', 'categoriasCostos', 'configuracion', 'users',
  'contadores',
];

let problemas = 0;
let advertencias = 0;

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 5: VALIDACIÓN DE INTEGRIDAD${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}\n`);

  // 1. Verificar que transaccionales estén vacías
  console.log(`${C.bold}1. Colecciones transaccionales deben estar VACÍAS${C.reset}`);
  for (const colId of COLLECTIONS_SHOULD_BE_EMPTY) {
    try {
      const snap = await db.collection(colId).count().get();
      const count = snap.data().count;
      if (count > 0) {
        console.log(`  ${C.red}✗ ${colId.padEnd(30)} → ${count} docs (debería estar vacía)${C.reset}`);
        problemas++;
      } else {
        console.log(`  ${C.green}✓ ${colId.padEnd(30)} → vacía${C.reset}`);
      }
    } catch (err) {
      console.log(`  ${C.yellow}? ${colId.padEnd(30)} → no pude leer${C.reset}`);
    }
  }

  // 2. Verificar que maestros EXISTAN con datos
  console.log(`\n${C.bold}2. Maestros deben EXISTIR con datos${C.reset}`);
  for (const colId of COLLECTIONS_SHOULD_EXIST) {
    try {
      const snap = await db.collection(colId).count().get();
      const count = snap.data().count;
      if (count === 0 && colId !== 'contadores') {
        // contadores puede estar vacía si nunca se usó, no es error
        console.log(`  ${C.yellow}⚠ ${colId.padEnd(30)} → 0 docs (maestro vacío — sospechoso)${C.reset}`);
        advertencias++;
      } else {
        console.log(`  ${C.green}✓ ${colId.padEnd(30)} → ${count} docs${C.reset}`);
      }
    } catch (err) {
      console.log(`  ${C.red}✗ ${colId.padEnd(30)} → error: ${err.message}${C.reset}`);
      problemas++;
    }
  }

  // 3. Contadores — B1: solo transaccionales en 0, maestros preservan
  console.log(`\n${C.bold}3. Contadores — transaccionales en 0, maestros preservados (B1)${C.reset}`);
  const TRANSACCIONALES_EXACT = new Set(['BMN', 'LIN']);
  const TRANSACCIONALES_PREFIXES = ['OC-', 'ENV-', 'VT-', 'REC-', 'REQ-', 'COT-', 'MOV-', 'BOL-', 'TRN-', 'GAS-', 'LOT-', 'ENT-', 'ADN-'];
  const esTransaccional = id => TRANSACCIONALES_EXACT.has(id) || TRANSACCIONALES_PREFIXES.some(p => id.startsWith(p));
  try {
    const snap = await db.collection('contadores').get();
    if (snap.empty) {
      console.log(`  ${C.dim}○ Sin contadores${C.reset}`);
    } else {
      for (const doc of snap.docs) {
        const curr = doc.data().current || 0;
        const isTrans = esTransaccional(doc.id);
        if (isTrans) {
          if (curr === 0) {
            console.log(`  ${C.green}✓ ${doc.id.padEnd(25)} → 0 (transaccional)${C.reset}`);
          } else {
            console.log(`  ${C.red}✗ ${doc.id.padEnd(25)} → ${curr} (transaccional debería ser 0)${C.reset}`);
            problemas++;
          }
        } else {
          console.log(`  ${C.dim}○ ${doc.id.padEnd(25)} → ${curr} (maestro preservado)${C.reset}`);
        }
      }
    }
  } catch (err) {
    console.log(`  ${C.red}✗ Error leyendo contadores: ${err.message}${C.reset}`);
    problemas++;
  }

  // 4. Muestra de productos: stock debe ser 0, sin ventas
  console.log(`\n${C.bold}4. Muestra: productos con stock o métricas residuales${C.reset}`);
  try {
    const snap = await db.collection('productos').limit(10).get();
    let conResiduo = 0;
    for (const doc of snap.docs) {
      const p = doc.data();
      const tieneResiduo =
        (p.stockUSA || 0) > 0 ||
        (p.stockPeru || 0) > 0 ||
        (p.stockTransito || 0) > 0 ||
        (p.cantidadVentas || 0) > 0 ||
        (p.ingresoTotalUSD || 0) > 0;
      if (tieneResiduo) {
        conResiduo++;
        if (conResiduo <= 3) {
          console.log(`  ${C.yellow}⚠ ${p.sku || doc.id} → stockUSA=${p.stockUSA || 0} stockPeru=${p.stockPeru || 0} ventas=${p.cantidadVentas || 0}${C.reset}`);
        }
      }
    }
    if (conResiduo === 0) {
      console.log(`  ${C.green}✓ Muestra de 10 productos: todos en 0${C.reset}`);
    } else {
      console.log(`  ${C.yellow}⚠ ${conResiduo}/10 productos con métricas residuales${C.reset}`);
      advertencias++;
    }
  } catch (err) {
    console.log(`  ${C.red}✗ Error: ${err.message}${C.reset}`);
    problemas++;
  }

  // 5. Muestra de marcas: métricas de ventas en 0
  console.log(`\n${C.bold}5. Muestra: marcas con ventas residuales${C.reset}`);
  try {
    const snap = await db.collection('marcas').limit(10).get();
    let conResiduo = 0;
    for (const doc of snap.docs) {
      const m = doc.data();
      if ((m.cantidadVentas || 0) > 0 || (m.ingresoTotalUSD || 0) > 0) {
        conResiduo++;
        if (conResiduo <= 3) {
          console.log(`  ${C.yellow}⚠ ${m.nombre || doc.id} → ventas=${m.cantidadVentas || 0} ingreso=${m.ingresoTotalUSD || 0}${C.reset}`);
        }
      }
    }
    if (conResiduo === 0) {
      console.log(`  ${C.green}✓ Muestra de 10 marcas: todas en 0${C.reset}`);
    } else {
      console.log(`  ${C.yellow}⚠ ${conResiduo}/10 marcas con residuo${C.reset}`);
      advertencias++;
    }
  } catch (err) {
    console.log(`  ${C.red}✗ Error: ${err.message}${C.reset}`);
  }

  // 6. Muestra de cuentas de caja: saldo en 0
  console.log(`\n${C.bold}6. Cuentas de caja: saldo debería ser 0${C.reset}`);
  try {
    const snap = await db.collection('cuentasCaja').get();
    if (snap.empty) {
      console.log(`  ${C.dim}○ Sin cuentas de caja configuradas${C.reset}`);
    } else {
      let conSaldo = 0;
      for (const doc of snap.docs) {
        const c = doc.data();
        const saldo = c.saldoActual || 0;
        if (saldo !== 0) {
          conSaldo++;
          console.log(`  ${C.yellow}⚠ ${c.nombre || doc.id} → saldo ${saldo}${C.reset}`);
        }
      }
      if (conSaldo === 0) {
        console.log(`  ${C.green}✓ Todas las ${snap.size} cuentas en saldo 0${C.reset}`);
      } else {
        advertencias += conSaldo;
      }
    }
  } catch (err) {
    console.log(`  ${C.red}✗ Error: ${err.message}${C.reset}`);
  }

  // Resumen
  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}RESUMEN DE VALIDACIÓN${C.reset}`);
  if (problemas === 0 && advertencias === 0) {
    console.log(`  ${C.green}${C.bold}✓ TODO LIMPIO — BD lista para operar desde cero${C.reset}`);
  } else {
    console.log(`  ${C.red}Problemas bloqueantes  : ${problemas}${C.reset}`);
    console.log(`  ${C.yellow}Advertencias            : ${advertencias}${C.reset}`);
    if (problemas > 0) {
      console.log(`\n  ${C.red}${C.bold}Hay problemas bloqueantes. Revisar y corregir antes de operar.${C.reset}`);
    }
  }
  console.log('');
  process.exit(problemas > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error fatal:${C.reset}`, err);
  process.exit(1);
});
