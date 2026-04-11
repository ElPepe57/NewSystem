/**
 * FASE 1 — Seed de Casillas
 *
 * Migra almacenes existentes a casillas vinculadas a colaboradores.
 * PREREQUISITO: Ejecutar 01-seed-colaboradores.mjs primero.
 *
 * Uso:
 *   DRY RUN:  node scripts/reingenieria/02-seed-casillas.mjs --dry-run
 *   EJECUTAR: node scripts/reingenieria/02-seed-casillas.mjs --execute
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

function getTipoCasilla(almacen) {
  if (almacen.tipo === 'almacen_peru') return 'almacen_propio';
  if (almacen.esViajero || almacen.tipo === 'viajero') return 'casilla_viajero';
  if (almacen.tipo === 'courier') return 'punto_courier';
  if (almacen.tipo === 'almacen_origen') return 'casilla_viajero'; // almacen origen -> casilla
  return 'almacen_propio';
}

async function main() {
  console.log(`\n${C.bold}═══ SEED: Casillas ═══${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  // 1. Leer colaboradores existentes
  const colSnap = await db.collection('colaboradores').get();
  if (colSnap.empty) {
    console.log(`${C.red}ERROR: No hay colaboradores. Ejecutar 01-seed-colaboradores.mjs primero.${C.reset}`);
    process.exit(1);
  }

  const colaboradores = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  Colaboradores encontrados: ${colaboradores.length}`);

  // Buscar la empresa (Vitaskin Peru)
  const empresa = colaboradores.find(c => c.tipo === 'empresa');
  if (!empresa) {
    console.log(`${C.red}ERROR: No se encontro colaborador tipo 'empresa'.${C.reset}`);
    process.exit(1);
  }

  // Mapeo: almacenOrigenId -> colaboradorId (desde las notas del colaborador)
  const mapeo = {};
  for (const col of colaboradores) {
    if (col.notas && col.notas.includes('Migrado desde almacen')) {
      const match = col.notas.match(/\(([^)]+)\)$/);
      if (match) {
        mapeo[match[1]] = col.id;
      }
    }
  }

  // 2. Leer almacenes existentes
  const almSnap = await db.collection('almacenes').get();
  const almacenes = almSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  Almacenes a migrar: ${almacenes.length}\n`);

  const casillas = [];
  let secuencial = 1;

  for (const alm of almacenes) {
    // Determinar el colaborador dueno
    let colaboradorId = mapeo[alm.id];
    let colaboradorNombre = '';

    if (colaboradorId) {
      const col = colaboradores.find(c => c.id === colaboradorId);
      colaboradorNombre = col?.nombre || '';
    } else {
      // Almacenes de Peru pertenecen a la empresa
      if (alm.pais === 'Peru' || alm.pais === 'Peru_local' || alm.tipo === 'almacen_peru') {
        colaboradorId = empresa.id;
        colaboradorNombre = empresa.nombre;
      } else {
        // Si no tiene mapeo, asignar a empresa por defecto
        colaboradorId = empresa.id;
        colaboradorNombre = empresa.nombre;
        console.log(`  ${C.yellow}WARN: ${alm.codigo} sin mapeo, asignado a empresa${C.reset}`);
      }
    }

    const esPrincipal = alm.codigo === 'ALM-PE-001';
    const tipoCasilla = getTipoCasilla(alm);

    casillas.push({
      codigo: `CAS-${String(secuencial++).padStart(3, '0')}`,
      nombre: alm.nombre,
      tipo: tipoCasilla,
      estado: alm.estadoAlmacen === 'activo' ? 'activa' : 'inactiva',
      pais: alm.pais || 'Peru',
      colaboradorId,
      colaboradorNombre,
      esPrincipal,
      direccion: alm.direccion || '',
      ciudad: alm.ciudad || '',
      codigoPostal: alm.codigoPostal || '',
      capacidadUnidades: alm.capacidadUnidades || 0,
      unidadesActuales: 0,
      totalUnidadesRecibidas: 0,
      totalUnidadesEnviadas: 0,
      valorInventarioUSD: 0,
      notas: `Migrado desde almacen ${alm.codigo} (${alm.id})`,
      _almacenOrigenId: alm.id,
      creadoPor: ADMIN_UID,
      fechaCreacion: NOW,
    });
  }

  // Mostrar
  console.log(`${C.bold}Casillas a crear: ${casillas.length}${C.reset}\n`);
  for (const cas of casillas) {
    const principal = cas.esPrincipal ? ' [PRINCIPAL]' : '';
    console.log(`  ${DRY_RUN ? C.yellow + '[DRY]' : C.green + '  \u2714'} ${cas.codigo} ${cas.nombre} [${cas.tipo}] -> ${cas.colaboradorNombre}${principal}${C.reset}`);
  }

  if (!DRY_RUN) {
    const batch = db.batch();

    for (const cas of casillas) {
      delete cas._almacenOrigenId;
      const ref = db.collection('casillas').doc();
      const cleanData = JSON.parse(JSON.stringify(cas));
      batch.set(ref, cleanData);
    }

    await batch.commit();
    console.log(`\n${C.green}\u2714 ${casillas.length} casillas creadas${C.reset}`);

    // Crear contador
    await db.collection('contadores').doc('CAS').set({
      current: secuencial - 1,
      initializedAt: NOW,
      updatedAt: NOW,
    });
    console.log(`${C.green}\u2714 Contador CAS inicializado en ${secuencial - 1}${C.reset}`);
  }

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para ejecutar: node scripts/reingenieria/02-seed-casillas.mjs --execute${C.reset}`);
  }
  console.log('');
}

main().catch(err => {
  console.error(`${C.red}Error:${C.reset}`, err);
  process.exit(1);
});
