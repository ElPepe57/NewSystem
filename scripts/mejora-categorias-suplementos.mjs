/**
 * ===============================================
 * MEJORA INTEGRAL: Categorías de Suplementos
 * ===============================================
 *
 * Ejecuta 4 mejoras:
 * 1. Asigna lineaNegocioIds a categorías de suplementos
 * 2. Crea subcategorías (nivel 2) para suplementos
 * 3. Corrige asignación de categorías en productos
 * 4. Corrige asignación de etiquetas en productos
 *
 * Uso:
 *   DRY RUN:  node scripts/mejora-categorias-suplementos.mjs --dry-run
 *   EJECUTAR: node scripts/mejora-categorias-suplementos.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const SUPL_LINEA = 'Z50CnuaBdD5x0w7XGRv8';
const SKC_LINEA = 'mrwyh6hvHEAPMzLOzgFS';
const USER_ID = 'system-migration';

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m'
};

// ============================================================
// DISEÑO DE SUBCATEGORÍAS PARA SUPLEMENTOS
// ============================================================
// Estructura: { nombrePadre: [subcategorías] }
const SUBCATEGORIAS = {
  'Sistema Inmune': [
    'Antibacteriano Natural',     // aceite orégano, allisure
    'Minerales Inmunológicos',    // zinc, selenio
    'Vitamina C y Antioxidantes', // vitamina C, espirulina
  ],
  'Salud Digestiva': [
    'Probióticos y Prebióticos',  // probióticos, prebióticos
    'Enzimas Digestivas',         // enzimas
    'Protección Gástrica',        // PepZin GI, zinc carnosine
  ],
  'Salud Cardiovascular': [
    'Omega 3 y Aceites',          // omega 3, krill oil
    'Coenzima Q10',               // CoQ10
    'Minerales Cardíacos',        // magnesio complex
  ],
  'Salud Cerebral': [
    'Nootrópicos',                // melena de león, citicolina, ginkgo biloba
    'Omega DHA',                  // DHA específico
    'Magnesio Cerebral',          // magnesio L-treonato (Magtein, Neuromag)
  ],
  'Sueño y Relajación': [
    'Melatonina',                 // todas las melatoninas
    'Magnesio Relajante',         // glicinato de magnesio
    'Aminoácidos del Sueño',      // L-teanina, 5-HTP, GABA
  ],
  'Energía y Vitalidad': [
    'Complejo B',                 // complejo B, B12
    'Adaptógenos',                // ashwagandha, shilajit
    'Vitamina C Energética',      // vitamina C liposomal
  ],
  'Salud Ósea': [
    'Colágeno',                   // colágeno tipos I, II, III
    'Vitamina D + K2',            // D3+K2, D3 sola
    'Minerales Óseos',            // calcio, glucosamina, boro
  ],
  'Antioxidantes y Metabolismo': [
    'Anti-Aging Celular',         // NAD+, resveratrol
    'Regulador Metabólico',       // berberina, ALA
    'Antioxidantes Potentes',     // astaxantina, vitamina E
  ],
  'Multivitamínicos': [
    'Para Hombre',
    'Para Mujer',
    'Para Niño',
    'Para Adulto General',
  ],
  'Salud Hormonal': [
    'Hormonal Femenino',          // myo inositol
    'Hormonal Masculino',         // tongkat ali
  ],
};

// ============================================================
// REGLAS DE ASIGNACIÓN DE CATEGORÍAS POR PRODUCTO
// ============================================================
// Mapeo: tipoProducto/nombreComercial → [categorías padre, subcategoría]
// Esto corrige asignaciones incorrectas y agrega subcategorías

function determinarCategorias(producto) {
  const tipo = (typeof producto.tipoProducto === 'string' ? producto.tipoProducto : '').toLowerCase();
  const nombre = (producto.nombreComercial || '').toLowerCase();
  const marca = (producto.marca || '').toLowerCase();

  const cats = [];

  // === ASHWAGANDHA (antes de omega para evitar falso match en fórmulas combinadas) ===
  if ((tipo.includes('ashwagandha') || tipo.includes('ksm-66') || nombre.includes('ashwagandha')) &&
      !tipo.includes('magnesio')) {
    cats.push('Energía y Vitalidad', 'Adaptógenos');
    cats.push('Manejo del Estrés');
    return [...new Set(cats)];
  }

  // === OMEGA 3 / DHA / KRILL ===
  if (tipo.includes('omega') || tipo.includes('krill') || tipo.includes('dha') ||
      nombre.includes('omega') || nombre.includes('krill') || nombre.includes('dha')) {
    cats.push('Salud Cardiovascular', 'Omega 3 y Aceites');
    cats.push('Salud Cerebral', 'Omega DHA');
    // Niños específico
    if (nombre.includes('niño') || nombre.includes('junior') || nombre.includes('bebé') || nombre.includes('teen') || nombre.includes('bebe')) {
      // ya cubierto por público etiqueta
    }
  }

  // === MELATONINA ===
  else if (tipo.includes('melatonina') || nombre.includes('melatonina')) {
    cats.push('Sueño y Relajación', 'Melatonina');
    if (tipo.includes('l-teanina')) {
      cats.push('Sueño y Relajación', 'Aminoácidos del Sueño');
    }
  }

  // === MAGNESIO ===
  else if (tipo.includes('magnesio') || tipo.includes('glicinato de magnesio') || tipo.includes('magnesium') || tipo.includes('magtein') || nombre.includes('magnesio') || nombre.includes('magtein') || nombre.includes('neuromag')) {
    if (tipo.includes('l-treonato') || nombre.includes('magtein') || nombre.includes('neuromag')) {
      cats.push('Salud Cerebral', 'Magnesio Cerebral');
    } else if (tipo.includes('complex') || tipo.includes('citrato')) {
      cats.push('Sueño y Relajación', 'Magnesio Relajante');
      cats.push('Salud Cardiovascular', 'Minerales Cardíacos');
      cats.push('Salud Digestiva');
    } else {
      // Glicinato default
      cats.push('Sueño y Relajación', 'Magnesio Relajante');
    }
    if (tipo.includes('ashwagandha') || nombre.includes('ashwagandha')) {
      cats.push('Energía y Vitalidad', 'Adaptógenos');
      cats.push('Manejo del Estrés');
    }
  }

  // === PROBIÓTICOS / ENZIMAS ===
  else if (tipo.includes('probiótico') || tipo.includes('prebiótico') || tipo.includes('probiotic') || nombre.includes('probiotic')) {
    cats.push('Salud Digestiva', 'Probióticos y Prebióticos');
  }
  else if (tipo.includes('enzima') || nombre.includes('enzima') || nombre.includes('super enzima')) {
    cats.push('Salud Digestiva', 'Enzimas Digestivas');
  }
  else if (tipo.includes('pepzin') || tipo.includes('zinc carnosine') || nombre.includes('pepzin')) {
    cats.push('Salud Digestiva', 'Protección Gástrica');
  }

  // === COLÁGENO ===
  else if (tipo.includes('colágeno') || nombre.includes('colágeno') || nombre.includes('collagen')) {
    cats.push('Salud Ósea', 'Colágeno');
    cats.push('Piel y Articulaciones');
  }

  // === D3 + K2 / D3 ===
  else if (tipo.includes('d3 + k2') || tipo.includes('d3') || nombre.includes('d3')) {
    cats.push('Salud Ósea', 'Vitamina D + K2');
    if (!tipo.includes('k2')) {
      cats.push('Sistema Inmune');
    } else {
      cats.push('Salud Cardiovascular');
    }
  }

  // === GLUCOSAMINA ===
  else if (tipo.includes('glucosamina') || nombre.includes('glucosamina')) {
    cats.push('Salud Ósea', 'Minerales Óseos');
    cats.push('Piel y Articulaciones');
  }

  // === CALCIO ===
  else if (tipo.includes('calcio') || nombre.includes('calcium')) {
    cats.push('Salud Ósea', 'Minerales Óseos');
  }

  // === ACEITE DE ORÉGANO ===
  else if (tipo.includes('orégano') || nombre.includes('orégano')) {
    cats.push('Sistema Inmune', 'Antibacteriano Natural');
  }

  // === ALLISURE (AJO) ===
  else if (tipo.includes('allisure') || nombre.includes('allisure')) {
    cats.push('Sistema Inmune', 'Antibacteriano Natural');
  }

  // === ZINC ===
  else if (tipo.includes('zinc') || nombre.includes('zinc')) {
    cats.push('Sistema Inmune', 'Minerales Inmunológicos');
    cats.push('Salud Digestiva');
  }

  // === SELENIO ===
  else if (tipo.includes('selenio') || nombre.includes('selenio')) {
    cats.push('Sistema Inmune', 'Minerales Inmunológicos');
  }

  // === VITAMINA C ===
  else if (tipo.includes('vitamina c') || nombre.includes('vitamina c')) {
    cats.push('Sistema Inmune', 'Vitamina C y Antioxidantes');
    cats.push('Energía y Vitalidad', 'Vitamina C Energética');
  }

  // === ESPIRULINA / CHLORELLA ===
  else if (tipo.includes('espirulina') || nombre.includes('espirulina') || nombre.includes('chlorella')) {
    cats.push('Sistema Inmune', 'Vitamina C y Antioxidantes');
    cats.push('Antioxidantes y Metabolismo', 'Antioxidantes Potentes');
  }

  // === CÁNDIDA ===
  else if (tipo.includes('cándida') || nombre.includes('cándida')) {
    cats.push('Sistema Inmune', 'Antibacteriano Natural');
    cats.push('Salud Digestiva');
  }

  // === BERBERINA ===
  else if (tipo.includes('berberina') || nombre.includes('berberina')) {
    cats.push('Antioxidantes y Metabolismo', 'Regulador Metabólico');
    cats.push('Salud Hepática');
  }

  // === NAD+ / RESVERATROL ===
  else if (tipo.includes('nad') || tipo.includes('resveratrol') || nombre.includes('nad') || nombre.includes('resveratrol')) {
    cats.push('Antioxidantes y Metabolismo', 'Anti-Aging Celular');
  }

  // === ALA (Alpha Lipoic Acid) ===
  else if (tipo.includes('lipoico') || tipo.includes('alpha lipoic') || tipo.includes('ácido alfa') || nombre.includes('alpha lipoic') || nombre.includes('lipoic')) {
    cats.push('Antioxidantes y Metabolismo', 'Regulador Metabólico');
  }

  // === ASTAXANTINA ===
  else if (tipo.includes('astaxantina') || nombre.includes('astaxantina')) {
    cats.push('Antioxidantes y Metabolismo', 'Antioxidantes Potentes');
  }

  // === VITAMINA E ===
  else if (tipo.includes('vitamina e') || nombre.includes('vitamina e')) {
    cats.push('Antioxidantes y Metabolismo', 'Antioxidantes Potentes');
  }

  // === SHILAJIT ===
  else if (tipo.includes('shilajit') || nombre.includes('shilajit')) {
    cats.push('Energía y Vitalidad', 'Adaptógenos');
    cats.push('Antioxidantes y Metabolismo');
  }

  // === CoQ10 ===
  else if (tipo.includes('coq10') || nombre.includes('coq10')) {
    cats.push('Salud Cardiovascular', 'Coenzima Q10');
    cats.push('Energía y Vitalidad');
  }

  // === COMPLEJO B / B12 ===
  else if (tipo.includes('complejo b') || tipo.includes('vitamina b12') || nombre.includes('complejo b') || nombre.includes('b12')) {
    cats.push('Energía y Vitalidad', 'Complejo B');
  }

  // === 5-HTP ===
  else if (tipo.includes('5-htp') || nombre.includes('5-htp')) {
    cats.push('Sueño y Relajación', 'Aminoácidos del Sueño');
  }

  // === L-TEANINA ===
  else if (tipo.includes('l-teanina') || nombre.includes('l-teanina')) {
    cats.push('Sueño y Relajación', 'Aminoácidos del Sueño');
  }

  // === MELENA DE LEÓN ===
  else if (tipo.includes('melena de león') || nombre.includes('melena de león')) {
    cats.push('Salud Cerebral', 'Nootrópicos');
  }

  // === GINKGO BILOBA ===
  else if (tipo.includes('ginkgo') || nombre.includes('ginkgo') || nombre.includes('genius') || nombre.includes('lingo leap')) {
    cats.push('Salud Cerebral', 'Nootrópicos');
  }

  // === CITICOLINA ===
  else if (tipo.includes('citicolina') || nombre.includes('citicolina') || nombre.includes('citicoline')) {
    cats.push('Salud Cerebral', 'Nootrópicos');
  }

  // === 5-MTHF / FOLATO ===
  else if (tipo.includes('5-mthf') || nombre.includes('folato')) {
    cats.push('Salud Celular');
  }

  // === MULTIVITAMÍNICOS ===
  else if (tipo.includes('multivitamínico') || tipo.includes('multivitaminico') || nombre.includes('multivitamínic') || nombre.includes('multivitaminic')) {
    cats.push('Multivitamínicos');
    if (tipo.includes('hombre') || nombre.includes('hombre')) {
      cats.push('Multivitamínicos', 'Para Hombre');
    } else if (tipo.includes('mujer') || nombre.includes('mujer')) {
      cats.push('Multivitamínicos', 'Para Mujer');
    } else if (tipo.includes('niño') || nombre.includes('niño')) {
      cats.push('Multivitamínicos', 'Para Niño');
    } else if (nombre.includes('crecimiento') || nombre.includes('growth')) {
      cats.push('Multivitamínicos', 'Para Niño');
    } else {
      cats.push('Multivitamínicos', 'Para Adulto General');
    }
  }

  // === MYO INOSITOL ===
  else if (tipo.includes('myo inositol') || nombre.includes('myo inositol')) {
    cats.push('Salud Hormonal', 'Hormonal Femenino');
  }

  // === TONGKAT ALI ===
  else if (tipo.includes('tongkat') || nombre.includes('tongkat')) {
    cats.push('Salud Hormonal', 'Hormonal Masculino');
  }

  // === BORO ===
  else if (tipo.includes('boro') || nombre.includes('boro')) {
    cats.push('Salud Ósea', 'Minerales Óseos');
    cats.push('Salud Hormonal');
  }

  // === ACEITE DE SEMILLA DE CALABAZA ===
  else if (tipo.includes('calabaza') || nombre.includes('calabaza')) {
    cats.push('Salud Hormonal', 'Hormonal Masculino');
  }

  // === CARDO MARIANO ===
  else if (tipo.includes('cardo mariano') || nombre.includes('cardo mariano')) {
    cats.push('Salud Hepática');
  }

  // === LUTEÍNA ===
  else if (tipo.includes('luteína') || nombre.includes('luteína')) {
    cats.push('Salud Visual');
  }

  // === ICY HOT / USO TÓPICO ===
  else if (tipo.includes('icy hot') || nombre.includes('icy hot')) {
    cats.push('Uso Tópico');
  }

  // === VINAGRE DE MANZANA ===
  else if (tipo.includes('vinagre') || nombre.includes('vinagre')) {
    cats.push('Salud Digestiva');
    cats.push('Antioxidantes y Metabolismo');
  }

  // === EXTRACTO HÚMICO (Digestive Drops) ===
  else if (tipo.includes('húmico') || nombre.includes('digestive drops')) {
    cats.push('Salud Digestiva');
    cats.push('Sistema Inmune');
  }

  // === D + B12 (JoySpring Detoxzee) ===
  else if (nombre.includes('detoxzee')) {
    cats.push('Energía y Vitalidad', 'Complejo B');
    cats.push('Sistema Inmune');
  }

  // === FRUIT & VEGGIES ===
  else if (nombre.includes('fruit') || nombre.includes('veggies')) {
    cats.push('Salud Digestiva');
    cats.push('Antioxidantes y Metabolismo');
  }

  // === PARA PATROL (antiparasitario) ===
  else if (nombre.includes('para patrol')) {
    cats.push('Salud Digestiva');
    cats.push('Sistema Inmune', 'Antibacteriano Natural');
  }

  // Deduplicar
  return [...new Set(cats)];
}

// ============================================================
// REGLAS DE ETIQUETAS POR PRODUCTO
// ============================================================
function determinarEtiquetas(producto, etiquetasMap) {
  const tipo = (typeof producto.tipoProducto === 'string' ? producto.tipoProducto : '').toLowerCase();
  const nombre = (producto.nombreComercial || '').toLowerCase();
  const marca = (producto.marca || '').toLowerCase();
  const presentacion = (producto.presentacion || '').toLowerCase();
  const sabor = (producto.sabor || '').toLowerCase();

  const etiquetas = [];

  // === PÚBLICO ===
  if (nombre.includes('niño') || nombre.includes('junior') || nombre.includes('kids') || tipo.includes('niño')) {
    etiquetas.push('Para Niños');
  } else if (nombre.includes('bebé') || nombre.includes('bebe') || nombre.includes('bebés')) {
    etiquetas.push('Para Bebés');
  } else if (nombre.includes('teen') || nombre.includes('adolescente')) {
    etiquetas.push('Para Adolescentes');
  } else if (nombre.includes('adulto') || tipo.includes('adulto')) {
    etiquetas.push('Para Adultos');
  } else if (tipo.includes('hombre') || nombre.includes('hombre')) {
    etiquetas.push('Para Hombres');
  } else if (tipo.includes('mujer') || nombre.includes('mujer')) {
    etiquetas.push('Para Mujeres');
  }

  // === PRESENTACIÓN ===
  if (presentacion.includes('gomit') || tipo.includes('gomit') || nombre.includes('gomita')) {
    etiquetas.push('Formato Gomitas');
  }
  if (presentacion.includes('líquid') || tipo.includes('líquid') || nombre.includes('líquid') || nombre.includes('liquid') || nombre.includes('gotas') || nombre.includes('drops')) {
    etiquetas.push('Formato Líquido');
  }
  if (presentacion.includes('polvo') || tipo.includes('polvo') || nombre.includes('polvo') || nombre.includes('powder')) {
    etiquetas.push('Formato Polvo');
  }

  // === SABOR ===
  if (sabor && sabor !== 'neutral' && sabor !== 'sin sabor' && sabor !== '' && sabor !== 'undefined') {
    etiquetas.push('Con Sabor');
  } else if (!sabor || sabor === 'neutral' || sabor === 'sin sabor') {
    etiquetas.push('Sin Sabor');
  }

  // === MARCA PREMIUM vs VALOR ===
  const marcasPremium = ['nordic naturals', 'life extension', 'pure encapsulations', 'thorne', 'double wood', 'sports research', 'doctor\'s best'];
  const marcasValor = ['carlyle', 'horbaach', 'kirkland signature', 'natrol', 'piping rock', 'pipping rock'];
  if (marcasPremium.some(m => marca.includes(m))) {
    etiquetas.push('Marca Premium');
  } else if (marcasValor.some(m => marca.includes(m))) {
    etiquetas.push('Marca Valor');
  }

  // === ORIGEN ===
  etiquetas.push('Importado USA');

  // === FÓRMULA COMBINADA ===
  if (tipo.includes('+') || tipo.includes('complex') || nombre.includes('+') || tipo.includes('combo')) {
    etiquetas.push('Fórmula Combinada');
  }

  return etiquetas;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n${C.bold}========================================${C.reset}`);
  console.log(`${C.bold} MEJORA CATEGORÍAS SUPLEMENTOS ${DRY_RUN ? C.yellow + '(DRY RUN)' : C.green + '(EJECUTANDO)'}${C.reset}`);
  console.log(`${C.bold}========================================${C.reset}\n`);

  // 1. Cargar datos
  const [catSnap, prodSnap, etqSnap, counterSnap] = await Promise.all([
    db.collection('categorias').get(),
    db.collection('productos').where('lineaNegocioId', '==', SUPL_LINEA).get(),
    db.collection('etiquetas').get(),
    db.collection('contadores').doc('CAT').get()
  ]);

  const categorias = {};
  catSnap.docs.forEach(d => { categorias[d.id] = { id: d.id, ...d.data() }; });

  const etiquetas = {};
  etqSnap.docs.forEach(d => { etiquetas[d.id] = { id: d.id, ...d.data() }; });

  // Index por nombre
  const catByName = {};
  Object.values(categorias).forEach(c => { catByName[c.nombre] = c; });

  const etqByName = {};
  Object.values(etiquetas).forEach(e => { etqByName[e.nombre] = e; });

  let counterCurrent = counterSnap.exists ? counterSnap.data().current : 36;
  const productos = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`${C.cyan}Datos cargados:${C.reset} ${Object.keys(categorias).length} categorías, ${productos.length} productos, ${Object.keys(etiquetas).length} etiquetas\n`);

  // ============================================================
  // PASO 1: Asignar lineaNegocioIds a categorías de suplementos
  // ============================================================
  console.log(`${C.bold}--- PASO 1: Asignar línea a categorías de suplementos ---${C.reset}`);

  const catsSuplSinLinea = Object.values(categorias).filter(c =>
    (!c.lineaNegocioIds || c.lineaNegocioIds.length === 0) &&
    c.nombre !== 'Piel y Articulaciones' && // Esta aplica a ambas
    c.nombre !== 'Uso Tópico' // Esta también podría aplicar a ambas
  );

  const catsParaAsignarLinea = catsSuplSinLinea.filter(c => {
    // Solo las que son usadas por suplementos
    const usadaPorSupl = productos.some(p =>
      (p.categorias || []).some(pc => pc.id === c.id) ||
      (p.categoriaIds || []).includes(c.id)
    );
    return usadaPorSupl;
  });

  let paso1Count = 0;
  for (const cat of catsParaAsignarLinea) {
    console.log(`  ${C.green}+${C.reset} ${cat.codigo} ${cat.nombre} → lineaNegocioIds: [${SUPL_LINEA}]`);
    if (!DRY_RUN) {
      await db.collection('categorias').doc(cat.id).update({
        lineaNegocioIds: [SUPL_LINEA]
      });
    }
    paso1Count++;
  }
  console.log(`${C.dim}  Total: ${paso1Count} categorías actualizadas${C.reset}\n`);

  // ============================================================
  // PASO 2: Crear subcategorías
  // ============================================================
  console.log(`${C.bold}--- PASO 2: Crear subcategorías para suplementos ---${C.reset}`);

  const nuevasSubcats = {}; // nombre → {id, ...}
  let paso2Count = 0;

  for (const [nombrePadre, hijos] of Object.entries(SUBCATEGORIAS)) {
    const padre = catByName[nombrePadre];
    if (!padre) {
      console.log(`  ${C.red}✗${C.reset} Padre "${nombrePadre}" no encontrado, saltando`);
      continue;
    }

    for (const nombreHijo of hijos) {
      // Verificar si ya existe
      const existente = Object.values(categorias).find(c =>
        c.nombre === nombreHijo && c.nivel === 2 && c.categoriaPadreId === padre.id
      );
      if (existente) {
        console.log(`  ${C.dim}= ${nombreHijo} (bajo ${nombrePadre}) ya existe${C.reset}`);
        nuevasSubcats[nombreHijo] = existente;
        continue;
      }

      counterCurrent++;
      const codigo = `CAT-${String(counterCurrent).padStart(3, '0')}`;
      const slug = nombreHijo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const nombreNorm = nombreHijo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const nuevaSubcat = {
        codigo,
        nombre: nombreHijo,
        nombreNormalizado: nombreNorm,
        slug,
        nivel: 2,
        categoriaPadreId: padre.id,
        categoriaPadreNombre: padre.nombre,
        ordenDisplay: paso2Count + 1,
        descripcion: '',
        metaDescription: '',
        keywords: [],
        icono: padre.icono || undefined,
        color: padre.color || '#3B82F6',
        imagenUrl: '',
        imagenBannerUrl: '',
        lineaNegocioIds: [SUPL_LINEA],
        margenMinimo: 20,
        margenObjetivo: 35,
        margenMaximo: 60,
        estado: 'activa',
        mostrarEnWeb: true,
        mostrarEnApp: true,
        metricas: { productosActivos: 0, subcategorias: 0 },
        creadoPor: USER_ID,
        fechaCreacion: Timestamp.now()
      };

      console.log(`  ${C.green}+${C.reset} ${codigo} ${nombreHijo} (bajo ${nombrePadre})`);

      if (!DRY_RUN) {
        const ref = await db.collection('categorias').doc().create(nuevaSubcat);
        nuevasSubcats[nombreHijo] = { id: ref.id || ref._path?.segments?.[1], ...nuevaSubcat };
      } else {
        nuevasSubcats[nombreHijo] = { id: `new-${codigo}`, ...nuevaSubcat };
      }
      paso2Count++;
    }
  }

  // Actualizar contador
  if (!DRY_RUN && paso2Count > 0) {
    await db.collection('contadores').doc('CAT').update({
      current: counterCurrent,
      updatedAt: Timestamp.now()
    });
  }
  console.log(`${C.dim}  Total: ${paso2Count} subcategorías creadas${C.reset}\n`);

  // Refresh catByName con nuevas subcats
  if (!DRY_RUN) {
    const refreshCats = await db.collection('categorias').get();
    refreshCats.docs.forEach(d => {
      const data = { id: d.id, ...d.data() };
      categorias[d.id] = data;
      catByName[data.nombre] = data;
    });
  } else {
    Object.values(nuevasSubcats).forEach(sc => { catByName[sc.nombre] = sc; });
  }

  // ============================================================
  // PASO 3: Corregir categorías en productos
  // ============================================================
  console.log(`${C.bold}--- PASO 3: Corregir categorías en productos ---${C.reset}`);

  let paso3Count = 0;
  let paso3Unchanged = 0;

  for (const prod of productos) {
    const catNombres = determinarCategorias(prod);
    if (catNombres.length === 0) {
      console.log(`  ${C.yellow}?${C.reset} ${prod.sku} ${prod.nombreComercial} → sin regla de asignación`);
      continue;
    }

    // Resolver nombres a IDs (max 5 categorías)
    const nuevasCats = [];
    const nuevasCatIds = [];
    let principalId = null;

    // Deduplicar y limitar
    const nombresUnicos = [...new Set(catNombres)].slice(0, 5);

    for (const nombre of nombresUnicos) {
      const cat = catByName[nombre];
      if (!cat) continue;
      if (nuevasCatIds.includes(cat.id)) continue;

      nuevasCats.push({
        id: cat.id,
        codigo: cat.codigo,
        nombre: cat.nombre,
        color: cat.color || '#6B7280'
      });
      nuevasCatIds.push(cat.id);

      // La primera categoría padre es la principal
      if (!principalId && cat.nivel === 1) {
        principalId = cat.id;
      }
    }

    if (nuevasCatIds.length === 0) continue;
    if (!principalId) principalId = nuevasCatIds[0];

    // Comparar con actual
    const actualIds = (prod.categoriaIds || []).sort().join(',');
    const nuevosIds = nuevasCatIds.sort().join(',');

    if (actualIds === nuevosIds) {
      paso3Unchanged++;
      continue;
    }

    const catNombresCambio = nuevasCats.map(c => c.nombre).join(', ');
    console.log(`  ${C.green}→${C.reset} ${prod.sku} ${prod.nombreComercial}: ${catNombresCambio}`);

    if (!DRY_RUN) {
      await db.collection('productos').doc(prod.id).update({
        categorias: nuevasCats,
        categoriaIds: nuevasCatIds,
        categoriaPrincipalId: principalId
      });
    }
    paso3Count++;
  }
  console.log(`${C.dim}  Actualizados: ${paso3Count}, Sin cambio: ${paso3Unchanged}${C.reset}\n`);

  // ============================================================
  // PASO 4: Corregir etiquetas en productos
  // ============================================================
  console.log(`${C.bold}--- PASO 4: Corregir etiquetas en productos ---${C.reset}`);

  let paso4Count = 0;
  let paso4Unchanged = 0;

  for (const prod of productos) {
    const etqNombres = determinarEtiquetas(prod, etqByName);
    if (etqNombres.length === 0) continue;

    // Resolver nombres a IDs
    const nuevasEtqs = [];
    const nuevasEtqIds = [];

    // Mantener etiquetas existentes que no son auto-asignables
    // (certificaciones y calidad las dejamos como están)
    const etiquetasExistentes = prod.etiquetas || [];
    const etqIdsExistentes = prod.etiquetaIds || [];
    const tiposAutoAsignables = ['publico', 'presentacion', 'calidad', 'origen'];

    // Preservar etiquetas manuales (certificaciones, dieta, etc.)
    for (let i = 0; i < etqIdsExistentes.length; i++) {
      const etqExistente = etiquetas[etqIdsExistentes[i]];
      if (etqExistente && !tiposAutoAsignables.includes(etqExistente.tipo)) {
        if (!nuevasEtqIds.includes(etqExistente.id)) {
          nuevasEtqs.push(etiquetasExistentes[i] || {
            id: etqExistente.id,
            codigo: etqExistente.codigo,
            nombre: etqExistente.nombre,
            tipo: etqExistente.tipo
          });
          nuevasEtqIds.push(etqExistente.id);
        }
      }
    }

    // Agregar auto-asignadas
    for (const nombre of etqNombres) {
      const etq = etqByName[nombre];
      if (!etq) continue;
      if (nuevasEtqIds.includes(etq.id)) continue;
      nuevasEtqs.push({
        id: etq.id,
        codigo: etq.codigo,
        nombre: etq.nombre,
        tipo: etq.tipo
      });
      nuevasEtqIds.push(etq.id);
    }

    // Comparar
    const actualEtqIds = (prod.etiquetaIds || []).sort().join(',');
    const nuevosEtqIds = nuevasEtqIds.sort().join(',');

    if (actualEtqIds === nuevosEtqIds) {
      paso4Unchanged++;
      continue;
    }

    const etqNombresCambio = nuevasEtqs.map(e => e.nombre).join(', ');
    console.log(`  ${C.green}→${C.reset} ${prod.sku}: ${etqNombresCambio}`);

    if (!DRY_RUN) {
      await db.collection('productos').doc(prod.id).update({
        etiquetas: nuevasEtqs,
        etiquetaIds: nuevasEtqIds
      });
    }
    paso4Count++;
  }
  console.log(`${C.dim}  Actualizados: ${paso4Count}, Sin cambio: ${paso4Unchanged}${C.reset}\n`);

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log(`${C.bold}========================================${C.reset}`);
  console.log(`${C.bold} RESUMEN ${DRY_RUN ? C.yellow + '(DRY RUN)' : C.green + '(EJECUTADO)'}${C.reset}`);
  console.log(`${C.bold}========================================${C.reset}`);
  console.log(`  Paso 1 - Líneas asignadas:     ${paso1Count} categorías`);
  console.log(`  Paso 2 - Subcategorías creadas: ${paso2Count}`);
  console.log(`  Paso 3 - Productos recategorizados: ${paso3Count}`);
  console.log(`  Paso 4 - Etiquetas corregidas:  ${paso4Count}`);
  console.log(`${C.dim}  Contador CAT final: ${counterCurrent}${C.reset}\n`);

  if (DRY_RUN) {
    console.log(`${C.yellow}⚠ Esto fue un DRY RUN. Ejecuta con --execute para aplicar cambios.${C.reset}\n`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
