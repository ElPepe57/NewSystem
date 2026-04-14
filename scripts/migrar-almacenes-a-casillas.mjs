/**
 * Migración: Almacenes existentes → Casillas vinculadas a Colaboradores
 *
 * Lee almacenes y colaboradores, crea casillas con colaboradorId.
 * Mapeo:
 *   - almacen tipo 'viajero'      → casilla tipo 'casilla_viajero'  (match por nombre)
 *   - almacen tipo 'almacen_peru' → casilla tipo 'almacen_propio'   (colaborador empresa)
 *   - almacen tipo 'courier'      → casilla tipo 'punto_courier'    (match por nombre)
 *   - almacen tipo 'almacen_origen' → casilla tipo 'almacen_propio' (sin colaborador directo)
 *
 * Uso:
 *   node scripts/migrar-almacenes-a-casillas.mjs --dry-run   # Solo muestra
 *   node scripts/migrar-almacenes-a-casillas.mjs             # Crea casillas
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  MIGRACIÓN: Almacenes → Casillas');
  console.log('═══════════════════════════════════════════');
  console.log(`Modo: ${dryRun ? '🔍 DRY RUN' : '✏️  CREACIÓN REAL'}\n`);

  // 1. Leer almacenes existentes
  const almacenesSnap = await db.collection('almacenes').get();
  const almacenes = almacenesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`📦 Almacenes encontrados: ${almacenes.length}`);

  // 2. Leer colaboradores
  const colabSnap = await db.collection('colaboradores').get();
  const colaboradores = colabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`👤 Colaboradores encontrados: ${colaboradores.length}`);

  // 3. Verificar casillas existentes
  const casillasSnap = await db.collection('casillas').get();
  console.log(`📍 Casillas existentes: ${casillasSnap.size}\n`);

  if (casillasSnap.size > 0) {
    console.log('⚠️  Ya existen casillas. Mostrando existentes:');
    casillasSnap.docs.forEach(d => {
      const c = d.data();
      console.log(`  - ${c.codigo}: ${c.nombre} (${c.tipo}, colab: ${c.colaboradorNombre || '?'})`);
    });
    console.log('');
  }

  // 4. Mapear almacenes → casillas
  const casillasACrear = [];
  const sinMatch = [];

  // Encontrar empresa
  const empresa = colaboradores.find(c => c.tipo === 'empresa');

  for (const alm of almacenes) {
    let colaboradorId = null;
    let colaboradorNombre = null;
    let tipoCasilla = 'almacen_propio';

    if (alm.tipo === 'viajero' || alm.esViajero) {
      // Match viajero por nombre
      const match = colaboradores.find(c =>
        c.tipo === 'viajero' &&
        c.nombre.toLowerCase().trim() === alm.nombre.toLowerCase().trim()
      );
      if (match) {
        colaboradorId = match.id;
        colaboradorNombre = match.nombre;
        tipoCasilla = 'casilla_viajero';
      } else {
        sinMatch.push({ almacen: alm.nombre, tipo: alm.tipo, razon: 'No match viajero' });
        continue;
      }
    } else if (alm.tipo === 'courier') {
      const match = colaboradores.find(c =>
        c.tipo === 'courier_externo' &&
        c.nombre.toLowerCase().trim() === alm.nombre.toLowerCase().trim()
      );
      if (match) {
        colaboradorId = match.id;
        colaboradorNombre = match.nombre;
        tipoCasilla = 'punto_courier';
      } else {
        sinMatch.push({ almacen: alm.nombre, tipo: alm.tipo, razon: 'No match courier' });
        continue;
      }
    } else if (alm.tipo === 'almacen_peru') {
      if (empresa) {
        colaboradorId = empresa.id;
        colaboradorNombre = empresa.nombre;
      }
      tipoCasilla = 'almacen_propio';
    } else if (alm.tipo === 'almacen_origen') {
      if (empresa) {
        colaboradorId = empresa.id;
        colaboradorNombre = empresa.nombre;
      }
      tipoCasilla = 'almacen_propio';
    }

    if (!colaboradorId) {
      sinMatch.push({ almacen: alm.nombre, tipo: alm.tipo, razon: 'Sin colaborador asignable' });
      continue;
    }

    casillasACrear.push({
      almacenOriginal: alm,
      casilla: {
        codigo: alm.codigo?.replace('VIA-', 'CAS-').replace('ALM-', 'CAS-').replace('COU-', 'CAS-') || `CAS-${String(casillasACrear.length + 1).padStart(3, '0')}`,
        nombre: alm.nombre,
        tipo: tipoCasilla,
        estado: alm.estadoAlmacen === 'activo' ? 'activa' : 'inactiva',
        pais: alm.pais || 'USA',
        colaboradorId,
        colaboradorNombre,
        esPrincipal: true,
        direccion: alm.direccion || '',
        ciudad: alm.ciudad || '',
        codigoPostal: alm.codigoPostal || '',
        capacidadUnidades: alm.capacidadUnidades || 0,
        unidadesActuales: alm.unidadesActuales || 0,
        totalUnidadesRecibidas: alm.totalUnidadesRecibidas || 0,
        totalUnidadesEnviadas: alm.totalUnidadesEnviadas || 0,
        valorInventarioUSD: alm.valorInventarioUSD || 0,
        creadoPor: 'migration-script',
        fechaCreacion: Timestamp.now(),
      }
    });
  }

  // 5. Mostrar resumen
  console.log('📋 Casillas a crear:\n');
  console.log('  Código       | Nombre                    | Tipo              | Colaborador');
  console.log('  -------------|---------------------------|-------------------|---------------------------');
  for (const { casilla } of casillasACrear) {
    const cod = casilla.codigo.padEnd(12);
    const nom = casilla.nombre.substring(0, 25).padEnd(25);
    const tip = casilla.tipo.padEnd(17);
    console.log(`  ${cod} | ${nom} | ${tip} | ${casilla.colaboradorNombre}`);
  }

  if (sinMatch.length > 0) {
    console.log(`\n⚠️  Almacenes sin match (${sinMatch.length}):`);
    for (const s of sinMatch) {
      console.log(`  - ${s.almacen} (${s.tipo}): ${s.razon}`);
    }
  }

  console.log(`\n📊 Total: ${casillasACrear.length} casillas a crear, ${sinMatch.length} sin match`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN — no se creó nada. Ejecuta sin --dry-run para crear.');
    process.exit(0);
  }

  // 6. Crear casillas
  console.log('\n✏️  Creando casillas...\n');
  let creadas = 0;

  for (const { casilla } of casillasACrear) {
    const ref = await db.collection('casillas').add(casilla);
    console.log(`  ✓ ${casilla.codigo}: ${casilla.nombre} → ${ref.id}`);
    creadas++;
  }

  console.log(`\n✅ Migración completada: ${creadas} casillas creadas.`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
