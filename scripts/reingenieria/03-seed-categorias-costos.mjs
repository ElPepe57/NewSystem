/**
 * FASE 1 — Seed de Categorias de Costos
 *
 * Pre-pobla las categorias de costos dinamicas con la estructura de 3 bloques:
 * - Importacion (costos landed en envios)
 * - Venta (costos directos por venta)
 * - Periodo (gastos fijos del mes)
 *
 * Uso:
 *   DRY RUN:  node scripts/reingenieria/03-seed-categorias-costos.mjs --dry-run
 *   EJECUTAR: node scripts/reingenieria/03-seed-categorias-costos.mjs --execute
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

// Estructura del arbol de categorias (del CATEGORIAS_SEED en categoriaCosto.types.ts)
const ARBOL = {
  importacion: [
    { nombre: 'Transporte', subcategorias: ['Flete viajero', 'Flete courier', 'Flete mar\u00edtimo'] },
    { nombre: 'Aranceles', subcategorias: ['Impuesto importaci\u00f3n', 'Agente aduanero'] },
    { nombre: 'Seguros', subcategorias: ['Seguro de carga'] },
    { nombre: 'Manipuleo', subcategorias: ['Recojo local', 'Almacenaje temporal'] },
  ],
  venta: [
    { nombre: 'Comisiones', subcategorias: ['Comisi\u00f3n ML', 'Comisi\u00f3n pasarela', 'Comisi\u00f3n vendedor'] },
    { nombre: 'Distribuci\u00f3n', subcategorias: ['Delivery local', 'Courier local'] },
    { nombre: 'Empaque', subcategorias: ['Kit de empaque', 'Material extra'] },
    { nombre: 'Marketing directo', subcategorias: ['Descuento por venta', 'Promoci\u00f3n'] },
  ],
  periodo: [
    { nombre: 'Personal', subcategorias: ['Sueldos', 'Comisiones fijas', 'Capacitaci\u00f3n'] },
    { nombre: 'Local', subcategorias: ['Alquiler', 'Servicios (luz/agua/internet)', 'Mantenimiento'] },
    { nombre: 'Profesionales', subcategorias: ['Contador', 'Abogado', 'Consultor\u00edas'] },
    { nombre: 'Tecnolog\u00eda', subcategorias: ['Software/SaaS', 'Hosting', 'Dominio'] },
    { nombre: 'Operativos', subcategorias: ['Movilidad', 'Suministros oficina', 'Herramientas'] },
    { nombre: 'Financieros', subcategorias: ['Comisiones bancarias', 'Intereses', 'ITF'] },
    { nombre: 'Marketing general', subcategorias: ['Publicidad online', 'Material POP', 'Eventos'] },
  ],
};

async function main() {
  console.log(`\n${C.bold}═══ SEED: Categorias de Costos ═══${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  const categorias = [];
  let secuencial = 1;

  for (const [bloque, padres] of Object.entries(ARBOL)) {
    let ordenPadre = 1;

    for (const padre of padres) {
      const codigoPadre = `CC-${String(secuencial++).padStart(3, '0')}`;
      const padreObj = {
        codigo: codigoPadre,
        nombre: padre.nombre,
        bloque,
        nivel: 0,
        activa: true,
        orden: ordenPadre++,
        creadoPor: ADMIN_UID,
        fechaCreacion: NOW,
      };
      categorias.push(padreObj);

      if (padre.subcategorias) {
        let ordenHijo = 1;
        for (const sub of padre.subcategorias) {
          categorias.push({
            codigo: `CC-${String(secuencial++).padStart(3, '0')}`,
            nombre: sub,
            bloque,
            categoriaPadreNombre: padre.nombre,
            _padreIndex: categorias.length - padre.subcategorias.length + ordenHijo - 1 - 1,
            nivel: 1,
            activa: true,
            orden: ordenHijo++,
            creadoPor: ADMIN_UID,
            fechaCreacion: NOW,
          });
        }
      }
    }
  }

  // Mostrar
  const bloques = ['importacion', 'venta', 'periodo'];
  for (const bloque of bloques) {
    const cats = categorias.filter(c => c.bloque === bloque);
    const padres = cats.filter(c => c.nivel === 0);
    const hijos = cats.filter(c => c.nivel === 1);
    console.log(`${C.cyan}${bloque.toUpperCase()}${C.reset}: ${padres.length} padres, ${hijos.length} sub-categor\u00edas`);
    for (const cat of cats) {
      const indent = cat.nivel === 0 ? '' : '  \u2514 ';
      const prefix = DRY_RUN ? `${C.yellow}[DRY]` : `${C.green}  \u2714`;
      console.log(`  ${prefix} ${indent}${cat.codigo} ${cat.nombre}${C.reset}`);
    }
    console.log('');
  }

  console.log(`${C.bold}Total: ${categorias.length} categor\u00edas${C.reset}\n`);

  if (!DRY_RUN) {
    // Crear en 2 pasadas: primero padres (para obtener IDs), luego hijos
    const padreIds = {}; // padreIndex -> docId
    let batch = db.batch();
    let count = 0;

    // Pasada 1: padres
    for (let i = 0; i < categorias.length; i++) {
      const cat = categorias[i];
      if (cat.nivel !== 0) continue;

      const ref = db.collection('categoriasCostos').doc();
      padreIds[i] = ref.id;

      const cleanData = { ...cat };
      delete cleanData._padreIndex;
      batch.set(ref, cleanData);
      count++;

      if (count >= 450) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    // Pasada 2: hijos (con categoriaPadreId)
    for (let i = 0; i < categorias.length; i++) {
      const cat = categorias[i];
      if (cat.nivel !== 1) continue;

      // Encontrar el padre
      const padreNombre = cat.categoriaPadreNombre;
      const padreBloque = cat.bloque;
      const padreIndex = categorias.findIndex(c => c.nivel === 0 && c.nombre === padreNombre && c.bloque === padreBloque);
      const padreId = padreIds[padreIndex];

      const ref = db.collection('categoriasCostos').doc();
      const cleanData = { ...cat, categoriaPadreId: padreId || '' };
      delete cleanData._padreIndex;
      batch.set(ref, cleanData);
      count++;

      if (count >= 450) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log(`${C.green}\u2714 ${categorias.length} categor\u00edas de costos creadas${C.reset}`);

    // Crear contador
    await db.collection('contadores').doc('CC').set({
      current: secuencial - 1,
      initializedAt: NOW,
      updatedAt: NOW,
    });
    console.log(`${C.green}\u2714 Contador CC inicializado en ${secuencial - 1}${C.reset}`);
  }

  if (DRY_RUN) {
    console.log(`${C.yellow}[DRY-RUN] Para ejecutar: node scripts/reingenieria/03-seed-categorias-costos.mjs --execute${C.reset}`);
  }
  console.log('');
}

main().catch(err => {
  console.error(`${C.red}Error:${C.reset}`, err);
  process.exit(1);
});
