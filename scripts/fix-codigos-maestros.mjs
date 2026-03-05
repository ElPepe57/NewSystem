/**
 * Corrige códigos de entidades maestras que usan timestamps en vez de secuenciales.
 * Busca códigos como MRC-1767498053271 y los reemplaza con MRC-033, MRC-034, etc.
 *
 * Uso: node scripts/fix-codigos-maestros.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// Definir entidades maestras con sus prefijos
const ENTIDADES = [
  { collection: 'marcas', prefix: 'MRC', campo: 'codigo' },
  { collection: 'categorias', prefix: 'CAT', campo: 'codigo' },
  { collection: 'proveedores', prefix: 'PRV', campo: 'codigo' },
  { collection: 'clientes', prefix: 'CLI', campo: 'codigo' },
  { collection: 'canalesVenta', prefix: 'CV', campo: 'codigo' },
  { collection: 'transportistas', prefix: 'TR', campo: 'codigo' },
];

async function fixCodigos() {
  console.log('🔧 Verificando códigos de entidades maestras...\n');

  let totalCorregidos = 0;

  for (const { collection: colName, prefix, campo } of ENTIDADES) {
    const snap = await db.collection(colName).get();
    if (snap.empty) continue;

    // Separar docs con código válido vs inválido
    const validos = [];
    const invalidos = [];

    for (const doc of snap.docs) {
      const codigo = doc.data()[campo];
      if (!codigo || !codigo.startsWith(prefix)) {
        invalidos.push({ doc, codigo, motivo: 'sin código o prefijo incorrecto' });
        continue;
      }

      const match = codigo.match(/-(\d+)$/);
      if (!match) {
        invalidos.push({ doc, codigo, motivo: 'formato inválido' });
        continue;
      }

      const num = parseInt(match[1], 10);
      // Si el número tiene más de 6 dígitos, es un timestamp
      if (num > 999999) {
        invalidos.push({ doc, codigo, motivo: 'timestamp detectado' });
      } else {
        validos.push({ doc, codigo, num });
      }
    }

    if (invalidos.length === 0) {
      console.log(`✅ ${colName} (${prefix}): ${snap.size} docs - todos OK`);
      continue;
    }

    // Encontrar el máximo número secuencial válido
    let maxNum = 0;
    for (const v of validos) {
      if (v.num > maxNum) maxNum = v.num;
    }

    // Corregir los inválidos
    console.log(`⚠️  ${colName} (${prefix}): ${invalidos.length} códigos a corregir (de ${snap.size} total)`);

    const batch = db.batch();
    for (const inv of invalidos) {
      maxNum++;
      const padding = prefix === 'BMN' ? 4 : 3;
      const nuevoCodigo = `${prefix}-${String(maxNum).padStart(padding, '0')}`;
      const nombre = inv.doc.data().nombre || inv.doc.id;

      console.log(`   ${nombre}: "${inv.codigo}" → "${nuevoCodigo}" (${inv.motivo})`);

      batch.update(inv.doc.ref, { [campo]: nuevoCodigo });
      totalCorregidos++;
    }

    await batch.commit();
  }

  if (totalCorregidos === 0) {
    console.log('\n✅ Todos los códigos son correctos, nada que corregir.');
  } else {
    console.log(`\n✅ ${totalCorregidos} código(s) corregido(s).`);
  }
}

fixCodigos().then(() => process.exit(0)).catch(e => { console.error('❌', e); process.exit(1); });
