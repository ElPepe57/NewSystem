/**
 * ===============================================
 * SEED: Categoría "Pérdidas" (categoriasCosto · bloque 'producto')
 * ===============================================
 *
 * chk5.A10 (S3.6 M1.bis · Cost Intelligence)
 *
 * Crea la categoría padre "Pérdidas" + 3 subcategorías ("Merma transferencia",
 * "Merma vencimiento", "Desmedro") en el bloque 'producto'. Necesario para que
 * la migración `migrate-gastos-legacy-a-categoriaCostoId.mjs` resuelva
 * correctamente los tipos `merma_transferencia`, `merma_vencimiento` y
 * `desmedro` (antes de chk5.A10 caían a "Manipuleo > Almacenaje temporal" como
 * proxy histórico).
 *
 * Es IDEMPOTENTE:
 *   - Verifica por (bloque + nombre + nivel) antes de crear
 *   - Safe re-run: las ejecuciones siguientes no duplican
 *
 * Uso:
 *   DRY RUN (default · solo simula):
 *     node scripts/seed-categoria-perdidas.mjs
 *
 *   EJECUTAR:
 *     node scripts/seed-categoria-perdidas.mjs --execute
 *
 * Pre-requisitos:
 *   - Colección `categoriasCosto` debe existir (creada por seed inicial chk5.A4
 *     o cuando el usuario crea la primera categoría desde Maestros)
 *   - GOOGLE_APPLICATION_CREDENTIALS configurado o ambiente con default creds
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};

const SEED_USER_ID = 'system-seed';

// Definición canon · espejo de CATEGORIAS_SEED.producto["Pérdidas"]
// en src/types/categoriaCosto.types.ts (chk5.A10)
const PERDIDAS = {
  padre: { nombre: 'Pérdidas', icono: '📉', orden: 50 },
  subcategorias: [
    { nombre: 'Merma transferencia', icono: '📦', orden: 10 },
    { nombre: 'Merma vencimiento',   icono: '⏰', orden: 20 },
    { nombre: 'Desmedro',            icono: '💔', orden: 30 },
  ],
};

async function getNextCodigoCC(existingCount) {
  // Convención: CC-NNN secuencial por orden de creación
  const next = existingCount + 1;
  return `CC-${String(next).padStart(3, '0')}`;
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${C.bold}  SEED: Categoría "Pérdidas" (bloque 'producto')${C.reset}`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN${C.reset}` : `${C.red}${C.bold}EJECUCIÓN REAL${C.reset}`}`);
  console.log(`${'='.repeat(70)}\n`);

  // ─── Fase 1 · Verificar estado actual ──────────────────────────────────
  console.log(`${C.cyan}▸ Fase 1 · Inspección de estado actual${C.reset}`);
  const todasSnap = await db.collection('categoriasCosto').get();

  if (todasSnap.empty) {
    console.log(`  ${C.yellow}⚠ La colección categoriasCosto está vacía.${C.reset}`);
    console.log(`  ${C.gray}Es seguro ejecutar este seed pero recomendamos primero correr el seed inicial${C.reset}`);
    console.log(`  ${C.gray}(o crear al menos una categoría desde Maestros) para verificar conectividad.${C.reset}\n`);
  }

  const existentes = todasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const existentePerdidas = existentes.find(c =>
    c.bloque === 'producto' && c.nivel === 0 && c.nombre === PERDIDAS.padre.nombre
  );

  if (existentePerdidas) {
    console.log(`  ${C.green}✓${C.reset} Categoría padre "Pérdidas" YA existe · id=${existentePerdidas.id}`);
  } else {
    console.log(`  ${C.yellow}▸${C.reset} Categoría padre "Pérdidas" NO existe · será creada`);
  }

  const subsExistentes = existentePerdidas
    ? existentes.filter(c => c.categoriaPadreId === existentePerdidas.id && c.nivel === 1)
    : [];

  const subsACrear = PERDIDAS.subcategorias.filter(seed =>
    !subsExistentes.find(e => e.nombre === seed.nombre)
  );

  console.log(`  ${C.gray}Subcategorías existentes bajo "Pérdidas": ${subsExistentes.length}${C.reset}`);
  console.log(`  ${C.gray}Subcategorías por crear: ${subsACrear.length}${C.reset}`);
  subsACrear.forEach(s => console.log(`    ${C.gray}- ${s.nombre}${C.reset}`));

  if (existentePerdidas && subsACrear.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✓ Sistema ya tiene Pérdidas + 3 subcategorías · nada que hacer${C.reset}\n`);
    return;
  }

  // ─── Fase 2 · Plan de creación ─────────────────────────────────────────
  console.log(`\n${C.cyan}▸ Fase 2 · Plan${C.reset}`);

  let codigoSeq = existentes.length;
  const plan = [];

  // Padre
  let padreId = existentePerdidas?.id;
  if (!existentePerdidas) {
    codigoSeq++;
    const codigo = `CC-${String(codigoSeq).padStart(3, '0')}`;
    plan.push({
      tipo: 'padre',
      codigo,
      nombre: PERDIDAS.padre.nombre,
      icono: PERDIDAS.padre.icono,
      bloque: 'producto',
      nivel: 0,
      orden: PERDIDAS.padre.orden,
    });
    padreId = `__pending_${codigo}__`; // placeholder, se reemplaza al ejecutar
    console.log(`  ${C.yellow}+${C.reset} Crear padre · ${codigo} · "${PERDIDAS.padre.nombre}" (bloque producto)`);
  }

  // Hijos
  for (const sub of subsACrear) {
    codigoSeq++;
    const codigo = `CC-${String(codigoSeq).padStart(3, '0')}`;
    plan.push({
      tipo: 'hijo',
      codigo,
      nombre: sub.nombre,
      icono: sub.icono,
      bloque: 'producto',
      nivel: 1,
      orden: sub.orden,
      padreNombre: PERDIDAS.padre.nombre, // se resuelve a id al persistir
    });
    console.log(`  ${C.yellow}+${C.reset} Crear hijo · ${codigo} · "${sub.nombre}" (bajo "Pérdidas")`);
  }

  // ─── Fase 3 · Ejecutar (o solo simular) ────────────────────────────────
  if (DRY_RUN) {
    console.log(`\n${C.cyan}▸ Fase 3 · DRY RUN · sin escrituras${C.reset}`);
    console.log(`  ${C.yellow}Para ejecutar realmente:${C.reset}`);
    console.log(`  ${C.bold}node scripts/seed-categoria-perdidas.mjs --execute${C.reset}\n`);
    return;
  }

  console.log(`\n${C.cyan}▸ Fase 3 · Ejecutar inserts${C.reset}`);

  // Crear padre primero (necesitamos su id real para los hijos)
  if (!existentePerdidas) {
    const padreItem = plan.find(p => p.tipo === 'padre');
    const padreData = {
      codigo: padreItem.codigo,
      nombre: padreItem.nombre,
      icono: padreItem.icono,
      bloque: padreItem.bloque,
      nivel: padreItem.nivel,
      orden: padreItem.orden,
      activa: true,
      creadoPor: SEED_USER_ID,
      fechaCreacion: Timestamp.now(),
    };
    const padreRef = await db.collection('categoriasCosto').add(padreData);
    padreId = padreRef.id;
    console.log(`  ${C.green}✓${C.reset} Padre creado · id=${padreRef.id}`);
  }

  // Crear hijos
  for (const item of plan.filter(p => p.tipo === 'hijo')) {
    const hijoData = {
      codigo: item.codigo,
      nombre: item.nombre,
      icono: item.icono,
      bloque: item.bloque,
      nivel: item.nivel,
      orden: item.orden,
      categoriaPadreId: padreId,
      categoriaPadreNombre: PERDIDAS.padre.nombre,
      activa: true,
      creadoPor: SEED_USER_ID,
      fechaCreacion: Timestamp.now(),
    };
    const hijoRef = await db.collection('categoriasCosto').add(hijoData);
    console.log(`  ${C.green}✓${C.reset} Hijo creado · "${item.nombre}" · id=${hijoRef.id}`);
  }

  // ─── Fase 4 · Resumen ──────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${C.bold}  RESUMEN${C.reset}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Categorías existentes antes:  ${C.bold}${existentes.length}${C.reset}`);
  console.log(`  Padre "Pérdidas" creado:      ${existentePerdidas ? `${C.gray}ya existía${C.reset}` : `${C.green}sí${C.reset}`}`);
  console.log(`  Subcategorías creadas:        ${C.green}${subsACrear.length}${C.reset}`);
  console.log(`\n  ${C.green}${C.bold}✓ Seed completado${C.reset}`);
  console.log(`  ${C.gray}Próximo paso recomendado: re-ejecutar la migración para que los gastos${C.reset}`);
  console.log(`  ${C.gray}de tipo merma/desmedro caigan a sus subcategorías correctas:${C.reset}`);
  console.log(`  ${C.bold}  node scripts/migrate-gastos-legacy-a-categoriaCostoId.mjs --execute${C.reset}\n`);
}

main().catch(err => {
  console.error(`\n${C.red}ERROR:${C.reset}`, err);
  process.exit(1);
});
