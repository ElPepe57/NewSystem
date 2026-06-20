/**
 * READ-ONLY · C0 de Fase C (reservas · BUG-RESERVA).
 *
 * Dimensiona el BACKLOG de unidades stuck en estado 'reservada' que el cron roto
 * (liberarReservasVencidas · functions/src/index.ts:2177 lee `reserva.vigenciaHasta`
 * anidado que nadie escribe) nunca liberó. NO escribe ni borra NADA.
 *
 * Clasifica cada unidad reservada por su vínculo y proyecta el impacto en stock.
 * Uso: node scripts/diagnose-reservas-stuck.mjs
 * Requiere Application Default Credentials (igual que check-oc-data.mjs).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const NOW = Date.now();
const CANCELADO_VENTA = new Set(['cancelada', 'anulada', 'devuelta']);
const CANCELADO_COT = new Set(['rechazada', 'cancelada', 'vencida', 'anulada']);

const ms = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : (ts?._seconds ? ts._seconds * 1000 : null));

async function main() {
  console.log('\n══════════ C0 · DIAGNÓSTICO DE RESERVAS STUCK (read-only) ══════════');

  const uSnap = await db.collection('unidades').where('estado', '==', 'reservada').get();
  console.log(`\nUnidades en estado 'reservada': ${uSnap.size}`);
  if (uSnap.size === 0) { console.log('Sin reservas. Nada que dimensionar.'); process.exit(0); }

  // Confirmar el schema fantasma + mapear campos planos
  let conReservaAnidado = 0, conVigenciaPlana = 0, conReservadoParaVariante = 0, conRequerimientoId = 0, sinVinculo = 0;
  const ownerIds = new Set();
  const units = [];
  for (const d of uSnap.docs) {
    const u = d.data();
    const para = u.reservadaPara || u.reservadoPara || null;
    if (u.reserva && typeof u.reserva === 'object') conReservaAnidado++;
    if (u.reservaVigenciaHasta) conVigenciaPlana++;
    if (!u.reservadaPara && u.reservadoPara) conReservadoParaVariante++;
    if (u.requerimientoId) conRequerimientoId++;
    if (!para) sinVinculo++;
    if (para) ownerIds.add(para);
    units.push({ id: d.id, para, productoId: u.productoId || '(sin producto)', pais: u.pais || u.paisOrigen || '?', requerimientoId: u.requerimientoId || null, vigenciaPlana: ms(u.reservaVigenciaHasta), fechaReserva: ms(u.fechaReserva) });
  }

  console.log(`  · con sub-objeto 'reserva' anidado (lo que el cron LEE): ${conReservaAnidado}  ${conReservaAnidado === 0 ? '← 0 = confirma schema FANTASMA' : '← ⚠ inesperado'}`);
  console.log(`  · con 'reservaVigenciaHasta' plano (solo req-automático): ${conVigenciaPlana}`);
  console.log(`  · usan la variante de naming 'reservadoPara': ${conReservadoParaVariante}`);
  console.log(`  · demanda comprometida (requerimientoId): ${conRequerimientoId}  ← NO expiran por tiempo (decisión)`);
  console.log(`  · sin vínculo (sin reservadaPara/reservadoPara): ${sinVinculo}`);

  // Resolver dueños (venta o cotización) · cache
  console.log(`\nResolviendo ${ownerIds.size} dueños (ventas/cotizaciones)…`);
  const owners = new Map();
  for (const oid of ownerIds) {
    let kind = null, estado = null;
    const vd = await db.collection('ventas').doc(oid).get();
    if (vd.exists) { kind = 'venta'; estado = vd.data().estado || '(sin estado)'; }
    else {
      const cd = await db.collection('cotizaciones').doc(oid).get();
      if (cd.exists) { kind = 'cotizacion'; estado = cd.data().estado || '(sin estado)'; }
    }
    owners.set(oid, { kind, estado });
  }

  // Clasificar
  const clas = { demanda_comprometida: 0, dueno_inexistente: 0, dueno_cancelado: 0, dueno_vivo: 0, sin_vinculo: 0, vigencia_plana_vencida: 0 };
  const porProducto = {};
  for (const u of units) {
    porProducto[u.productoId] = (porProducto[u.productoId] || 0) + 1;
    if (u.requerimientoId) { clas.demanda_comprometida++; continue; }
    if (!u.para) { clas.sin_vinculo++; continue; }
    const o = owners.get(u.para);
    if (!o || !o.kind) { clas.dueno_inexistente++; continue; }
    const cancelSet = o.kind === 'venta' ? CANCELADO_VENTA : CANCELADO_COT;
    if (cancelSet.has(o.estado)) { clas.dueno_cancelado++; continue; }
    clas.dueno_vivo++;
    if (u.vigenciaPlana && u.vigenciaPlana <= NOW) clas.vigencia_plana_vencida++;
  }

  console.log('\n── CLASIFICACIÓN del backlog ──');
  console.log(`  🟢 dueño VIVO (reserva legítima · NO liberar): ${clas.dueno_vivo}`);
  console.log(`  🔴 dueño CANCELADO (venta/cotización muerta · LIBERAR): ${clas.dueno_cancelado}`);
  console.log(`  🔴 dueño INEXISTENTE (doc borrado · huérfana · LIBERAR): ${clas.dueno_inexistente}`);
  console.log(`  🔴 SIN vínculo (reservada sin dueño · LIBERAR): ${clas.sin_vinculo}`);
  console.log(`  🔵 demanda comprometida (requerimientoId · solo al cancelar req/OC): ${clas.demanda_comprometida}`);
  console.log(`  ⏰ con vigencia plana YA vencida (req-automático 30d): ${clas.vigencia_plana_vencida}`);

  const liberables = clas.dueno_cancelado + clas.dueno_inexistente + clas.sin_vinculo;
  console.log(`\n── IMPACTO de la "ola" del primer run ──`);
  console.log(`  Unidades que volverían a stock disponible (ola): ~${liberables}`);
  const productosAfectados = Object.entries(porProducto).sort((a, b) => b[1] - a[1]);
  console.log(`  Productos con unidades stuck: ${productosAfectados.length}`);
  console.log(`  Top 10 productos por unidades reservadas:`);
  for (const [pid, n] of productosAfectados.slice(0, 10)) console.log(`     ${pid}: ${n} ud`);

  console.log('\n── LECTURA ──');
  console.log(`  El cron roto nunca liberó NADA → ${uSnap.size} unidades stuck.`);
  console.log(`  De esas, ~${liberables} son backlog MUERTO (dueño cancelado/inexistente/sin-vínculo) que la ola del primer run soltaría.`);
  console.log(`  ${clas.dueno_vivo} tienen dueño vivo (reserva legítima · no se tocan).`);
  console.log(`  ${clas.demanda_comprometida} son demanda comprometida (se liberan al cancelar req/OC · C6, no por cron).`);
  process.exit(0);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
