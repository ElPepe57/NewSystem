/**
 * Corrección completa de productos SKC:
 * - tipoProducto "[object Object]" -> nombre real
 * - ingredienteClave: normalizar, completar, corregir
 * - spf + pa: protectores solares
 * - textura: categorías generales
 * - preocupaciones: basadas en investigación real
 * - nombreComercial: SKC-0004, SKC-0006
 * - SKC-0007: quitar marca duplicada en nombre
 * - SKC-0012: migrar campos residuales
 * - SKC-0013: tipoPiel Manchas -> Todo tipo, ingredienteClave completar
 * - SKC-0015: ingredienteClave corregir
 *
 * Uso: node scripts/fix-skc-completo.mjs [--dry-run]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

// Correcciones por SKU
const CORRECCIONES = {
  'SKC-0001': {
    ingredienteClave: 'Centella Asiática',
    spf: 50,
    pa: '++++',
    textura: 'Bálsamo',
    preocupaciones: ['rojeces', 'irritación', 'protección solar'],
  },
  'SKC-0002': {
    ingredienteClave: 'Extracto de Algodón',
    spf: 50,
    pa: '++++',
    textura: 'Bálsamo',
    preocupaciones: ['exceso de sebo', 'protección solar'],
  },
  'SKC-0003': {
    ingredienteClave: 'Centella Asiática',
    textura: 'Espuma',
    preocupaciones: ['limpieza', 'poros', 'irritación'],
  },
  'SKC-0004': {
    nombreComercial: 'Madagascar Centella Ampoule',
    ingredienteClave: 'Centella Asiática',
    textura: 'Líquida',
    preocupaciones: ['rojeces', 'irritación', 'barrera cutánea'],
  },
  'SKC-0005': {
    ingredienteClave: 'Centella Asiática',
    spf: 50,
    pa: '++++',
    textura: 'Crema',
    preocupaciones: ['protección solar', 'irritación'],
  },
  'SKC-0006': {
    nombreComercial: 'Hyalu-Cica Water-Fit Sun Serum',
    ingredienteClave: 'Centella Asiática',
    spf: 50,
    pa: '++++',
    textura: 'Serum',
    preocupaciones: ['protección solar', 'hidratación'],
  },
  'SKC-0007': {
    nombreComercial: 'Birch Juice Moisturizing Sunscreen',
    ingredienteClave: 'Extracto de Abedul',
    spf: 50,
    pa: '++++',
    textura: 'Crema',
    preocupaciones: ['hidratación', 'protección solar'],
  },
  'SKC-0008': {
    textura: 'Crema',
    preocupaciones: ['acné', 'granitos', 'sebo'],
  },
  'SKC-0009': {
    textura: 'Serum',
    preocupaciones: ['rojeces', 'textura irregular', 'acné'],
  },
  'SKC-0010': {
    textura: 'Serum',
    preocupaciones: ['manchas', 'tono desigual', 'opacidad'],
  },
  'SKC-0011': {
    textura: 'Crema',
    preocupaciones: ['opacidad', 'tono desigual', 'arrugas finas'],
  },
  'SKC-0012': {
    ingredienteClave: 'PDRN',
    tipoPiel: 'Todo tipo',
    textura: 'Crema',
    preocupaciones: ['hidratación', 'firmeza', 'tono desigual'],
    // Limpiar campos residuales
    _limpiar: ['sabor', 'dosaje'],
  },
  'SKC-0013': {
    ingredienteClave: 'TXA + Niacinamida',
    tipoPiel: 'Todo tipo',
    textura: 'Crema',
    preocupaciones: ['manchas', 'hiperpigmentación', 'tono desigual'],
  },
  'SKC-0014': {
    ingredienteClave: 'Centella Asiática',
    textura: 'Arcilla',
    preocupaciones: ['poros', 'exceso de sebo', 'textura irregular'],
  },
  'SKC-0015': {
    ingredienteClave: 'Pantenol',
    textura: 'Crema',
    preocupaciones: ['sequedad', 'barrera cutánea', 'irritación'],
  },
  'SKC-0016': {
    textura: 'Serum',
    preocupaciones: ['arrugas', 'firmeza', 'manchas', 'textura irregular'],
  },
};

async function main() {
  console.log('========================================');
  console.log(DRY_RUN ? '  MODO DRY RUN' : '  MODO PRODUCCION');
  console.log('========================================\n');

  // Cargar tipos de producto para fix del [object Object]
  const tipos = await db.collection('tiposProducto').get();
  const tipoMap = {};
  tipos.docs.forEach(d => { tipoMap[d.id] = d.data().nombre; });

  // Leer todos los SKC
  const snap = await db.collection('productos')
    .where('sku', '>=', 'SKC-0001')
    .where('sku', '<=', 'SKC-9999')
    .get();

  let totalFixes = 0;

  for (const doc of snap.docs) {
    const p = doc.data();
    const sku = p.sku;
    const corr = CORRECCIONES[sku];

    if (!corr) {
      console.log(`${sku}: Sin correcciones definidas, SKIP`);
      continue;
    }

    const updates = {};
    const cambios = [];

    // 1. tipoProducto [object Object]
    if (p.tipoProducto === '[object Object]' && p.tipoProductoId && tipoMap[p.tipoProductoId]) {
      updates.tipoProducto = tipoMap[p.tipoProductoId];
      cambios.push(`tipoProducto: "${tipoMap[p.tipoProductoId]}"`);
    }

    // 2. Aplicar correcciones del mapa
    for (const [campo, valor] of Object.entries(corr)) {
      if (campo === '_limpiar') continue;

      const actual = p[campo];
      // Solo actualizar si es diferente o vacío
      if (actual !== valor) {
        // Para arrays, comparar contenido
        if (Array.isArray(valor) && Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(valor)) continue;

        updates[campo] = valor;
        if (Array.isArray(valor)) {
          cambios.push(`${campo}: [${valor.join(', ')}]`);
        } else {
          cambios.push(`${campo}: "${actual || '(vacío)'}" -> "${valor}"`);
        }
      }
    }

    // 3. Limpiar campos residuales
    if (corr._limpiar) {
      for (const campo of corr._limpiar) {
        if (p[campo] !== undefined) {
          updates[campo] = FieldValue.delete();
          cambios.push(`${campo}: "${p[campo]}" -> ELIMINADO`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log(`${sku} | ${p.marca} ${p.nombreComercial || '???'}:`);
      cambios.forEach(c => console.log(`  - ${c}`));
      console.log('');

      if (!DRY_RUN) {
        await doc.ref.update(updates);
      }
      totalFixes++;
    } else {
      console.log(`${sku}: Todo OK ✅`);
    }
  }

  console.log('\n========================================');
  console.log(`  COMPLETADO: ${totalFixes} productos corregidos`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
