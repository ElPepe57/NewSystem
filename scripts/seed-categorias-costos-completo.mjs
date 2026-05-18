/**
 * ===============================================
 * SEED COMPLETO: categoriasCosto (canon 3 niveles · 16 padres + 45 subs)
 * ===============================================
 *
 * GATING chk5 · S3.6 M1.bis Cost Intelligence System
 *
 * Materializa en Firestore la totalidad de CATEGORIAS_SEED declarada en
 * src/types/categoriaCosto.types.ts. Crea:
 *   - 4 categorías padre del bloque 'producto' + Pérdidas (chk5.A10)  =  5 padres
 *   - 4 categorías padre del bloque 'venta'                           =  4 padres
 *   - 7 categorías padre del bloque 'periodo'                         =  7 padres
 *   - Subcategorías hijas de cada padre                               = 45 subs
 *
 * IMPORTANTE: este array es ESPEJO de CATEGORIAS_SEED. Si modificas el
 * seed del tipo TS, actualiza también este archivo (no hay import directo
 * porque .mjs no puede importar .ts sin transpilación).
 *
 * Es IDEMPOTENTE:
 *   - Verifica por (bloque + nombre + nivel) antes de crear
 *   - Re-ejecutable sin duplicar registros
 *   - Cada subcategoría se vincula a su padre vía categoriaPadreId real
 *
 * Uso:
 *   DRY RUN (default · solo simula):
 *     node scripts/seed-categorias-costos-completo.mjs
 *
 *   EJECUTAR:
 *     node scripts/seed-categorias-costos-completo.mjs --execute
 *
 * Pre-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS configurado o gcloud auth default
 *   - Permisos de escritura en colección categoriasCosto/* de proyecto businessmn-269c9
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
};

const SEED_USER_ID = 'system-seed';

// ─── ESPEJO de CATEGORIAS_SEED en src/types/categoriaCosto.types.ts ──────────
// Cualquier cambio en CATEGORIAS_SEED debe replicarse aquí (no hay import .ts → .mjs).
// Última sincronización: chk5.A10 (Pérdidas agregada + 3 subs)
const CATEGORIAS_SEED = {
  producto: [
    { nombre: 'Transporte',  icono: '🚚', subcategorias: [
      { nombre: 'Flete viajero',  icono: '✈️' },
      { nombre: 'Flete courier',  icono: '📦' },
      { nombre: 'Flete maritimo', icono: '🚢' },
    ]},
    { nombre: 'Aranceles',   icono: '🛃', subcategorias: [
      { nombre: 'Impuesto importacion', icono: '📋' },
      { nombre: 'Agente aduanero',      icono: '👨‍💼' },
    ]},
    { nombre: 'Seguros',     icono: '🛡️', subcategorias: [
      { nombre: 'Seguro de carga', icono: '🛡️' },
    ]},
    { nombre: 'Manipuleo',   icono: '📥', subcategorias: [
      { nombre: 'Recojo local',         icono: '🚛' },
      { nombre: 'Almacenaje temporal',  icono: '🏬' },
    ]},
    { nombre: 'Pérdidas',    icono: '📉', subcategorias: [
      { nombre: 'Merma transferencia',  icono: '📦' },
      { nombre: 'Merma vencimiento',    icono: '⏰' },
      { nombre: 'Desmedro',             icono: '💔' },
    ]},
  ],
  venta: [
    { nombre: 'Comisiones',         icono: '💰', subcategorias: [
      { nombre: 'Comision ML',         icono: '🛍️' },
      { nombre: 'Comision pasarela',   icono: '💳' },
      { nombre: 'Comision vendedor',   icono: '🤝' },
    ]},
    { nombre: 'Distribucion',       icono: '🚐', subcategorias: [
      { nombre: 'Delivery local',     icono: '🛵' },
      { nombre: 'Courier local',      icono: '📮' },
      { nombre: 'Envío provincial',   icono: '🚚' }, // chk5.A14b
    ]},
    { nombre: 'Empaque',            icono: '📦', subcategorias: [
      { nombre: 'Kit de empaque',  icono: '🎁' },
      { nombre: 'Material extra',  icono: '📎' },
    ]},
    { nombre: 'Marketing directo',  icono: '📣', subcategorias: [
      { nombre: 'Descuento por venta', icono: '🏷️' },
      { nombre: 'Promocion',           icono: '🎯' },
    ]},
  ],
  periodo: [
    { nombre: 'Personal',          icono: '👥', subcategorias: [
      { nombre: 'Sueldos',           icono: '💵' },
      { nombre: 'Comisiones fijas',  icono: '💰' },
      { nombre: 'Capacitacion',      icono: '📚' },
    ]},
    { nombre: 'Local',             icono: '🏢', subcategorias: [
      { nombre: 'Alquiler',                    icono: '🏠' },
      { nombre: 'Servicios (luz/agua/internet)', icono: '💧' },
      { nombre: 'Mantenimiento',               icono: '🔧' },
      { nombre: 'Limpieza',                    icono: '🧹' }, // chk5.A14b
      { nombre: 'Seguridad',                   icono: '🛡️' }, // chk5.A14b
    ]},
    { nombre: 'Profesionales',     icono: '⚖️', subcategorias: [
      { nombre: 'Contador',            icono: '🧮' },
      { nombre: 'Abogado',             icono: '⚖️' },
      { nombre: 'Consultorias',        icono: '💼' },
      { nombre: 'Servicios creativos', icono: '📸' }, // chk5.A14b
    ]},
    { nombre: 'Tecnologia',        icono: '💻', subcategorias: [
      { nombre: 'Software/SaaS', icono: '☁️' },
      { nombre: 'Hosting',       icono: '🖥️' },
      { nombre: 'Dominio',       icono: '🌐' },
    ]},
    { nombre: 'Operativos',        icono: '🔧', subcategorias: [
      { nombre: 'Movilidad',             icono: '🚗' },
      { nombre: 'Suministros oficina',   icono: '📎' },
      { nombre: 'Herramientas',          icono: '🛠️' },
      { nombre: 'Caja chica',            icono: '💵' }, // chk5.A14b
    ]},
    { nombre: 'Financieros',       icono: '🏦', subcategorias: [
      { nombre: 'Comisiones bancarias', icono: '💳' },
      { nombre: 'Intereses',            icono: '📈' },
      { nombre: 'ITF',                  icono: '🏛️' },
    ]},
    { nombre: 'Marketing general', icono: '📣', subcategorias: [
      { nombre: 'Publicidad online', icono: '📱' },
      { nombre: 'Material POP',      icono: '🪧' },
      { nombre: 'Eventos',           icono: '🎉' },
      { nombre: 'Influencers',       icono: '🤳' }, // chk5.A14b
      { nombre: 'Sampling',          icono: '🎁' }, // chk5.A14b
    ]},
  ],
};

const ORDEN_BASE_PADRE_POR_BLOQUE = { producto: 0, venta: 100, periodo: 200 };
const ORDEN_INCREMENTO = 10;

async function main() {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`${C.bold}  SEED COMPLETO: categoriasCosto (canon 3 niveles)${C.reset}`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN${C.reset}` : `${C.red}${C.bold}EJECUCIÓN REAL${C.reset}`}`);
  console.log(`  Proyecto: ${C.cyan}businessmn-269c9${C.reset}`);
  console.log(`${'='.repeat(72)}\n`);

  // ─── Fase 1 · Inspección de estado actual ───────────────────────────────
  console.log(`${C.cyan}▸ Fase 1 · Estado actual de categoriasCosto/*${C.reset}`);
  const existentesSnap = await db.collection('categoriasCostos').get();
  const existentes = existentesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  ${C.gray}Documentos existentes: ${existentes.length}${C.reset}`);

  // Index padres existentes por (bloque + nombre) y subcategorías por (padreId + nombre)
  const padresExistentes = new Map(); // key: `${bloque}::${nombre}` → doc
  const subsExistentesByPadreId = new Map(); // key: padreId → Map<nombre, doc>
  for (const cat of existentes) {
    if (cat.nivel === 0) {
      padresExistentes.set(`${cat.bloque}::${cat.nombre}`, cat);
    } else if (cat.nivel === 1 && cat.categoriaPadreId) {
      if (!subsExistentesByPadreId.has(cat.categoriaPadreId)) {
        subsExistentesByPadreId.set(cat.categoriaPadreId, new Map());
      }
      subsExistentesByPadreId.get(cat.categoriaPadreId).set(cat.nombre, cat);
    }
  }

  // ─── Fase 2 · Plan ──────────────────────────────────────────────────────
  console.log(`\n${C.cyan}▸ Fase 2 · Plan de inserts (idempotente)${C.reset}`);

  const planPadres = []; // [{ bloque, nombre, icono, orden, key }]
  const planSubs = []; // [{ bloque, padreNombre, padreKey, nombre, icono, orden }]
  let countPadresExisten = 0;
  let countSubsExisten = 0;

  for (const bloque of ['producto', 'venta', 'periodo']) {
    const padres = CATEGORIAS_SEED[bloque];
    let ordenPadre = ORDEN_BASE_PADRE_POR_BLOQUE[bloque] + ORDEN_INCREMENTO;

    for (const padre of padres) {
      const key = `${bloque}::${padre.nombre}`;
      const existe = padresExistentes.get(key);

      if (existe) {
        countPadresExisten++;
      } else {
        planPadres.push({
          bloque,
          nombre: padre.nombre,
          icono: padre.icono,
          orden: ordenPadre,
          key,
        });
      }
      ordenPadre += ORDEN_INCREMENTO;

      // Subcategorías
      let ordenSub = ORDEN_INCREMENTO;
      for (const sub of padre.subcategorias ?? []) {
        // Para padres existentes: chequear si la sub existe bajo ese padre
        // Para padres a crear: NO existen subs aún (todas a crear)
        const padreId = existe?.id;
        const subExiste = padreId ? subsExistentesByPadreId.get(padreId)?.get(sub.nombre) : null;

        if (subExiste) {
          countSubsExisten++;
        } else {
          planSubs.push({
            bloque,
            padreNombre: padre.nombre,
            padreKey: key,
            nombre: sub.nombre,
            icono: sub.icono,
            orden: ordenSub,
          });
        }
        ordenSub += ORDEN_INCREMENTO;
      }
    }
  }

  // Resumen plan
  const totalPadresSeed = Object.values(CATEGORIAS_SEED).reduce((s, arr) => s + arr.length, 0);
  const totalSubsSeed = Object.values(CATEGORIAS_SEED).reduce(
    (s, arr) => s + arr.reduce((ss, p) => ss + (p.subcategorias?.length ?? 0), 0),
    0,
  );

  console.log(`  ${C.gray}Total seed canon: ${totalPadresSeed} padres + ${totalSubsSeed} subs${C.reset}`);
  console.log(`  ${C.green}✓${C.reset} Padres ya existen: ${countPadresExisten}`);
  console.log(`  ${C.green}✓${C.reset} Subs ya existen:   ${countSubsExisten}`);
  console.log(`  ${C.yellow}+${C.reset} Padres por crear:  ${C.bold}${planPadres.length}${C.reset}`);
  console.log(`  ${C.yellow}+${C.reset} Subs por crear:    ${C.bold}${planSubs.length}${C.reset}`);

  if (planPadres.length === 0 && planSubs.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✓ Sistema ya tiene todo el seed · nada que hacer${C.reset}\n`);
    return;
  }

  // Mostrar detalle del plan
  if (planPadres.length > 0) {
    console.log(`\n  ${C.magenta}Padres a crear:${C.reset}`);
    for (const p of planPadres) {
      console.log(`    ${C.yellow}+${C.reset} [${p.bloque}] ${p.icono} ${p.nombre} (orden=${p.orden})`);
    }
  }
  if (planSubs.length > 0) {
    console.log(`\n  ${C.magenta}Subcategorías a crear:${C.reset}`);
    for (const s of planSubs) {
      console.log(`    ${C.yellow}+${C.reset} [${s.bloque}] ${s.padreNombre} > ${s.icono} ${s.nombre} (orden=${s.orden})`);
    }
  }

  // ─── Fase 3 · Ejecutar (o DRY RUN) ──────────────────────────────────────
  if (DRY_RUN) {
    console.log(`\n${C.cyan}▸ Fase 3 · DRY RUN · sin escrituras${C.reset}`);
    console.log(`  ${C.yellow}Para ejecutar realmente:${C.reset}`);
    console.log(`  ${C.bold}node scripts/seed-categorias-costos-completo.mjs --execute${C.reset}\n`);
    return;
  }

  console.log(`\n${C.cyan}▸ Fase 3 · Ejecutar inserts${C.reset}`);

  // Generador de código secuencial CC-NNN
  let codigoSeq = existentes.length;
  const nextCodigo = () => {
    codigoSeq++;
    return `CC-${String(codigoSeq).padStart(3, '0')}`;
  };

  // Map de padres recién creados para vincular sus subs
  const padresCreados = new Map(); // key (`bloque::nombre`) → id real

  // Paso 1: crear padres (necesitamos sus IDs reales para los hijos)
  console.log(`  ${C.gray}── Padres ──${C.reset}`);
  for (const p of planPadres) {
    const codigo = nextCodigo();
    const data = {
      codigo,
      nombre: p.nombre,
      icono: p.icono,
      bloque: p.bloque,
      nivel: 0,
      orden: p.orden,
      activa: true,
      creadoPor: SEED_USER_ID,
      fechaCreacion: Timestamp.now(),
    };
    const ref = await db.collection('categoriasCostos').add(data);
    padresCreados.set(p.key, ref.id);
    console.log(`  ${C.green}✓${C.reset} ${codigo} · [${p.bloque}] ${p.nombre} → ${ref.id}`);
  }

  // Paso 2: crear hijos (resolver padreId desde padresExistentes o padresCreados)
  console.log(`  ${C.gray}── Subcategorías ──${C.reset}`);
  for (const s of planSubs) {
    const padreId = padresCreados.get(s.padreKey) ?? padresExistentes.get(s.padreKey)?.id;
    if (!padreId) {
      console.log(`  ${C.red}✗${C.reset} No se pudo resolver padreId para "${s.padreKey}" · sub ${s.nombre} OMITIDA`);
      continue;
    }
    const codigo = nextCodigo();
    const data = {
      codigo,
      nombre: s.nombre,
      icono: s.icono,
      bloque: s.bloque,
      nivel: 1,
      orden: s.orden,
      categoriaPadreId: padreId,
      categoriaPadreNombre: s.padreNombre,
      activa: true,
      creadoPor: SEED_USER_ID,
      fechaCreacion: Timestamp.now(),
    };
    const ref = await db.collection('categoriasCostos').add(data);
    console.log(`  ${C.green}✓${C.reset} ${codigo} · [${s.bloque}] ${s.padreNombre} > ${s.nombre} → ${ref.id}`);
  }

  // ─── Fase 4 · Resumen ───────────────────────────────────────────────────
  console.log(`\n${'='.repeat(72)}`);
  console.log(`${C.bold}  RESUMEN${C.reset}`);
  console.log(`${'='.repeat(72)}`);
  console.log(`  Documentos existentes antes:  ${C.bold}${existentes.length}${C.reset}`);
  console.log(`  Padres creados:               ${C.green}${planPadres.length}${C.reset}`);
  console.log(`  Subcategorías creadas:        ${C.green}${planSubs.length}${C.reset}`);
  console.log(`  Total final estimado:         ${C.bold}${existentes.length + planPadres.length + planSubs.length}${C.reset}`);
  console.log(`\n  ${C.green}${C.bold}✓ Seed completo aplicado${C.reset}`);
  console.log(`  ${C.gray}Próximo paso · migración de gastos:${C.reset}`);
  console.log(`  ${C.bold}  node scripts/migrate-gastos-legacy-a-categoriaCostoId.mjs --execute${C.reset}\n`);
}

main().catch(err => {
  console.error(`\n${C.red}ERROR:${C.reset}`, err);
  process.exit(1);
});
