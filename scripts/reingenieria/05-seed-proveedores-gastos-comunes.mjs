/**
 * TAREA-PROVEEDOR-GASTOS F5 · Seed de proveedores frecuentes de gastos
 *
 * Pre-pobla la coleccion `proveedores` con los proveedores mas comunes
 * de gastos operativos de Vita Skin Peru:
 *   - Servicios basicos (Movistar · Sedapal · Edelnor · Calidda)
 *   - Couriers locales (Olva · Shalom · DHL Peru)
 *   - SaaS y tecnologia (Google · Microsoft · Mercado Libre)
 *
 * El script es idempotente · proveedores con el mismo RUC se omiten
 * (asumiendo unicidad por RUC en Peru).
 *
 * Uso:
 *   DRY RUN:  node scripts/reingenieria/05-seed-proveedores-gastos-comunes.mjs --dry-run
 *   EJECUTAR: node scripts/reingenieria/05-seed-proveedores-gastos-comunes.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const NOW = Timestamp.now();
const ADMIN_UID = 'admin-seed-gastos';

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

// Top 10 proveedores frecuentes de gastos · Peru
// tipo se usa como categoria del proveedor (no del gasto · son cosas distintas)
const PROVEEDORES_SEED = [
  // ── Servicios basicos · bloque Periodo > Local ──
  {
    nombre: 'Movistar',
    razonSocial: 'Telefonica del Peru S.A.A.',
    ruc: '20100017491',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.movistar.com.pe',
    contacto: 'Atencion al cliente',
    telefono: '104',
    notasInternas: 'Internet/telefono/celular oficina · gasto recurrente mensual',
  },
  {
    nombre: 'Sedapal',
    razonSocial: 'Servicio de Agua Potable y Alcantarillado de Lima S.A.',
    ruc: '20100152356',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.sedapal.com.pe',
    contacto: 'Atencion al cliente',
    telefono: '317-3000',
    notasInternas: 'Agua potable oficina · gasto recurrente mensual',
  },
  {
    nombre: 'Enel Distribucion (Edelnor)',
    razonSocial: 'Enel Distribucion Peru S.A.A.',
    ruc: '20269985900',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.enel.pe',
    contacto: 'Atencion al cliente',
    telefono: '517-1717',
    notasInternas: 'Electricidad oficina · gasto recurrente mensual',
  },
  {
    nombre: 'Calidda',
    razonSocial: 'Gas Natural de Lima y Callao S.A.',
    ruc: '20109072177',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.calidda.com.pe',
    contacto: 'Atencion al cliente',
    telefono: '614-9000',
    notasInternas: 'Gas natural · gasto recurrente mensual',
  },

  // ── Couriers locales · bloque Venta > Distribucion ──
  {
    nombre: 'Olva Courier',
    razonSocial: 'Olva Courier S.A.C.',
    ruc: '20392943020',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.olvacourier.com',
    contacto: 'Servicio empresarial',
    telefono: '714-7800',
    notasInternas: 'Courier para envios nacionales · facturacion semanal',
  },
  {
    nombre: 'Shalom Empresarial',
    razonSocial: 'Shalom Empresarial S.A.C.',
    ruc: '20100100923',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.shalom.com.pe',
    contacto: 'Cuenta empresarial',
    telefono: '01-2031400',
    notasInternas: 'Courier alternativo · envios provincias',
  },
  {
    nombre: 'DHL Peru',
    razonSocial: 'DHL Express Peru S.A.C.',
    ruc: '20100024342',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.dhl.com/pe',
    contacto: 'Atencion empresarial',
    telefono: '0-800-50880',
    notasInternas: 'Courier internacional · envios urgentes USA/Asia',
  },

  // ── SaaS / Tecnologia · bloque Periodo > Tecnologia ──
  {
    nombre: 'Google (Workspace + Cloud)',
    razonSocial: 'Google LLC',
    ruc: '0', // proveedor extranjero · no aplica RUC peruano
    tipo: 'distribuidor',
    pais: 'USA',
    url: 'https://workspace.google.com',
    contacto: 'Billing',
    notasInternas: 'Google Workspace + Firebase · cobro USD mensual',
  },
  {
    nombre: 'Microsoft 365',
    razonSocial: 'Microsoft Corporation',
    ruc: '0',
    tipo: 'distribuidor',
    pais: 'USA',
    url: 'https://www.microsoft.com/es-pe',
    contacto: 'Billing',
    notasInternas: 'Office 365 + Azure (si aplica) · cobro USD mensual',
  },

  // ── Plataformas de venta · bloque Venta > Comisiones ──
  {
    nombre: 'Mercado Libre Peru',
    razonSocial: 'Mercadolibre Peru S.R.L.',
    ruc: '20507793017',
    tipo: 'distribuidor',
    pais: 'Peru',
    url: 'https://www.mercadolibre.com.pe',
    contacto: 'Cuenta vendedor',
    notasInternas: 'Comision por venta · auto-detectable via webhook',
  },
];

async function main() {
  console.log(`\n${C.bold}=== TAREA-PROVEEDOR-GASTOS F5 · Seed proveedores frecuentes ===${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  // 1. Cargar proveedores existentes para detectar duplicados
  console.log(`${C.cyan}Cargando proveedores existentes...${C.reset}`);
  const existentesSnap = await db.collection('proveedores').get();
  const existentes = existentesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  ${existentes.length} proveedores ya en Firestore\n`);

  // Indice por RUC y por nombre normalizado
  const rucsExistentes = new Set(existentes.filter(p => p.ruc).map(p => p.ruc));
  const nombresNormalizados = new Set(
    existentes.map(p => p.nombre?.toLowerCase().trim()).filter(Boolean)
  );

  // 2. Procesar cada proveedor del seed
  const stats = { creados: 0, omitidos_ruc: 0, omitidos_nombre: 0 };
  let batch = db.batch();
  let pending = 0;

  for (const prov of PROVEEDORES_SEED) {
    const yaExisteRUC = prov.ruc && prov.ruc !== '0' && rucsExistentes.has(prov.ruc);
    const yaExisteNombre = nombresNormalizados.has(prov.nombre.toLowerCase().trim());

    if (yaExisteRUC) {
      console.log(`${C.yellow}↷ omitido (RUC duplicado):${C.reset} ${prov.nombre} (${prov.ruc})`);
      stats.omitidos_ruc++;
      continue;
    }
    if (yaExisteNombre) {
      console.log(`${C.yellow}↷ omitido (nombre duplicado):${C.reset} ${prov.nombre}`);
      stats.omitidos_nombre++;
      continue;
    }

    const prefix = DRY_RUN ? `${C.yellow}[DRY]` : `${C.green}  ✔`;
    console.log(`${prefix}${C.reset} ${prov.nombre} (${prov.pais}${prov.ruc !== '0' ? ` · RUC ${prov.ruc}` : ''})`);

    if (!DRY_RUN) {
      const ref = db.collection('proveedores').doc();
      // Generar codigo simple basado en orden
      const codigo = `PROV-GS-${String(stats.creados + 1).padStart(3, '0')}`;
      batch.set(ref, {
        nombre: prov.nombre,
        codigo,
        tipo: prov.tipo,
        url: prov.url,
        pais: prov.pais,
        contacto: prov.contacto || '',
        email: prov.email || '',
        telefono: prov.telefono || '',
        direccion: prov.direccion || '',
        notasInternas: prov.notasInternas || '',
        // Metadata SUNAT (campos que el sistema puede tener)
        razonSocial: prov.razonSocial,
        ruc: prov.ruc !== '0' ? prov.ruc : null,
        // Estado y auditoria
        activo: true,
        fechaCreacion: NOW,
        creadoPor: ADMIN_UID,
      });
      pending++;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    stats.creados++;
  }

  if (!DRY_RUN && pending > 0) {
    await batch.commit();
  }

  // 3. Resumen
  console.log(`\n${C.bold}=== Resumen ===${C.reset}`);
  console.log(`  ${C.green}✔ Creados:${C.reset}            ${stats.creados}`);
  console.log(`  ${C.yellow}↷ Omitidos por RUC:${C.reset}   ${stats.omitidos_ruc}`);
  console.log(`  ${C.yellow}↷ Omitidos por nombre:${C.reset} ${stats.omitidos_nombre}`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}⓵ Modo DRY-RUN · no se persistio nada.${C.reset}`);
    console.log(`   Para ejecutar: node scripts/reingenieria/05-seed-proveedores-gastos-comunes.mjs --execute\n`);
  } else {
    console.log(`\n${C.green}✓ Seed completado · ${stats.creados} proveedores listos para vincular a gastos.${C.reset}\n`);
  }
}

main().catch(err => {
  console.error(`${C.red}✗ Error:${C.reset}`, err);
  process.exit(1);
});
