/**
 * FASE 1 — Seed de Colaboradores
 *
 * Crea los colaboradores iniciales de la red logistica:
 * - Vitaskin Peru (empresa)
 * - Viajeros existentes migrados desde almacenes
 * - Couriers conocidos
 *
 * Uso:
 *   DRY RUN:  node scripts/reingenieria/01-seed-colaboradores.mjs --dry-run
 *   EJECUTAR: node scripts/reingenieria/01-seed-colaboradores.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const NOW = Timestamp.now();
const ADMIN_UID = 'admin';

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

async function main() {
  console.log(`\n${C.bold}═══ SEED: Colaboradores ═══${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  // 1. Leer almacenes existentes para migrar viajeros
  const almacenesSnap = await db.collection('almacenes').get();
  const almacenes = almacenesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const viajeros = almacenes.filter(a => a.esViajero === true || a.tipo === 'viajero');
  const couriers = almacenes.filter(a => a.tipo === 'courier');

  console.log(`  Almacenes encontrados: ${almacenes.length}`);
  console.log(`  Viajeros a migrar: ${viajeros.length}`);
  console.log(`  Couriers a migrar: ${couriers.length}\n`);

  const colaboradores = [];
  let secuencial = 1;

  // Empresa: Vitaskin Peru
  colaboradores.push({
    codigo: `COL-${String(secuencial++).padStart(3, '0')}`,
    nombre: 'Vitaskin Per\u00fa',
    tipo: 'empresa',
    estado: 'activo',
    pais: 'Peru',
    ciudad: 'Lima',
    metricas: { enviosRealizados: 0, enviosCompletados: 0, enviosConIncidencia: 0, tasaIncidencias: 0, unidadesTransportadas: 0, tiempoPromedioEntregaDias: 0 },
    creadoPor: ADMIN_UID,
    fechaCreacion: NOW,
  });

  // Viajeros
  for (const v of viajeros) {
    colaboradores.push({
      codigo: `COL-${String(secuencial++).padStart(3, '0')}`,
      nombre: v.nombre,
      tipo: 'viajero',
      estado: v.estadoAlmacen === 'activo' ? 'activo' : 'inactivo',
      pais: v.pais || 'USA',
      ciudad: v.ciudad || '',
      direccion: v.direccion || '',
      telefono: v.telefono || '',
      email: v.email || '',
      whatsapp: v.whatsapp || '',
      tarifas: {
        tarifaPorLibraUSD: v.tarifaPorLibraUSD || v.costoPromedioFlete || undefined,
      },
      frecuenciaViaje: v.frecuenciaViaje || 'variable',
      proximoViaje: v.proximoViaje || undefined,
      metricas: { enviosRealizados: 0, enviosCompletados: 0, enviosConIncidencia: 0, tasaIncidencias: 0, unidadesTransportadas: 0, tiempoPromedioEntregaDias: 0 },
      notas: `Migrado desde almacen ${v.codigo} (${v.id})`,
      _almacenOrigenId: v.id,  // Para vincular casillas despues
      creadoPor: ADMIN_UID,
      fechaCreacion: NOW,
    });
  }

  // Couriers
  for (const c of couriers) {
    colaboradores.push({
      codigo: `COL-${String(secuencial++).padStart(3, '0')}`,
      nombre: c.nombre,
      tipo: 'courier_externo',
      estado: c.estadoAlmacen === 'activo' ? 'activo' : 'inactivo',
      pais: c.pais || 'USA',
      metricas: { enviosRealizados: 0, enviosCompletados: 0, enviosConIncidencia: 0, tasaIncidencias: 0, unidadesTransportadas: 0, tiempoPromedioEntregaDias: 0 },
      notas: `Migrado desde almacen ${c.codigo} (${c.id})`,
      _almacenOrigenId: c.id,
      creadoPor: ADMIN_UID,
      fechaCreacion: NOW,
    });
  }

  // Agregar DHL si no existe
  const tieneDHL = colaboradores.some(c => c.nombre.toLowerCase().includes('dhl'));
  if (!tieneDHL) {
    colaboradores.push({
      codigo: `COL-${String(secuencial++).padStart(3, '0')}`,
      nombre: 'DHL Express',
      tipo: 'courier_externo',
      estado: 'activo',
      pais: 'USA',
      metricas: { enviosRealizados: 0, enviosCompletados: 0, enviosConIncidencia: 0, tasaIncidencias: 0, unidadesTransportadas: 0, tiempoPromedioEntregaDias: 0 },
      creadoPor: ADMIN_UID,
      fechaCreacion: NOW,
    });
  }

  // Mostrar y guardar
  console.log(`${C.bold}Colaboradores a crear: ${colaboradores.length}${C.reset}\n`);
  for (const col of colaboradores) {
    const extraInfo = col._almacenOrigenId ? ` (migrado de ${col._almacenOrigenId})` : '';
    console.log(`  ${DRY_RUN ? C.yellow + '[DRY]' : C.green + '  \u2714'} ${col.codigo} ${col.nombre} [${col.tipo}]${extraInfo}${C.reset}`);
  }

  if (!DRY_RUN) {
    const batch = db.batch();
    const mapeo = {}; // almacenId -> colaboradorId (para script de casillas)

    for (const col of colaboradores) {
      const almacenOrigenId = col._almacenOrigenId;
      delete col._almacenOrigenId;

      const ref = db.collection('colaboradores').doc();
      // Limpiar undefined
      const cleanData = JSON.parse(JSON.stringify(col));
      batch.set(ref, cleanData);

      if (almacenOrigenId) {
        mapeo[almacenOrigenId] = ref.id;
      }
    }

    await batch.commit();
    console.log(`\n${C.green}\u2714 ${colaboradores.length} colaboradores creados${C.reset}`);

    // Guardar mapeo para uso en script de casillas
    console.log(`\n${C.cyan}Mapeo almacen -> colaborador:${C.reset}`);
    for (const [almId, colId] of Object.entries(mapeo)) {
      console.log(`  ${almId} -> ${colId}`);
    }

    // Crear contador
    await db.collection('contadores').doc('COL').set({
      current: secuencial - 1,
      initializedAt: NOW,
      updatedAt: NOW,
    });
    console.log(`${C.green}\u2714 Contador COL inicializado en ${secuencial - 1}${C.reset}`);
  }

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para ejecutar: node scripts/reingenieria/01-seed-colaboradores.mjs --execute${C.reset}`);
  }
  console.log('');
}

main().catch(err => {
  console.error(`${C.red}Error:${C.reset}`, err);
  process.exit(1);
});
