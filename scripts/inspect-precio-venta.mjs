/**
 * Inspección · ¿De dónde sale el campo `precioVenta` de los productos?
 *
 * Solicitado por usuario · 2026-05-03
 *   Reporta que el TabInvestigación de Zinc (SUP-0155) muestra
 *   "Tu precio actual S/ 77.82" cuando él dice no haber seteado nada.
 *
 * Este script:
 *   1. Cuenta cuántos productos tienen precioVenta > 0
 *   2. Muestra el caso específico SUP-0155
 *   3. Distribución por línea de negocio
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

console.log('═══════════════════════════════════════════════════════════');
console.log('Inspección · campo precioVenta en productos');
console.log('═══════════════════════════════════════════════════════════\n');

const productosSnap = await db.collection('productos').get();
console.log(`Total productos: ${productosSnap.size}\n`);

let conPrecio = 0;
let sinPrecio = 0;
let conPrecioCero = 0;
const porLinea = {};
const muestra = [];

for (const doc of productosSnap.docs) {
  const data = doc.data();
  const pv = data.precioVenta;
  const linea = data.lineaNegocioNombre ?? 'sin línea';

  if (!porLinea[linea]) porLinea[linea] = { conPrecio: 0, sinPrecio: 0, total: 0 };
  porLinea[linea].total++;

  if (pv === undefined || pv === null) {
    sinPrecio++;
    porLinea[linea].sinPrecio++;
  } else if (pv === 0) {
    conPrecioCero++;
    porLinea[linea].sinPrecio++;
  } else if (pv > 0) {
    conPrecio++;
    porLinea[linea].conPrecio++;
    if (muestra.length < 8) {
      muestra.push({
        sku: data.sku,
        nombre: data.nombreComercial,
        precioVenta: pv,
        linea: data.lineaNegocioNombre,
        ctruPromedio: data.ctruPromedio,
        creadoPor: data.creadoPor,
      });
    }
  }

  // Caso específico SUP-0155
  if (data.sku === 'SUP-0155') {
    console.log('🎯 CASO ESPECÍFICO · SUP-0155 (Zinc)');
    console.log('────────────────────────────────────');
    console.log(`  precioVenta:        ${data.precioVenta}`);
    console.log(`  ctruPromedio:       ${data.ctruPromedio}`);
    console.log(`  costoFleteIntl:     ${data.costoFleteInternacional}`);
    console.log(`  marca:              ${data.marca}`);
    console.log(`  lineaNegocioNombre: ${data.lineaNegocioNombre}`);
    console.log(`  creadoPor:          ${data.creadoPor}`);
    console.log(`  fechaCreacion:      ${data.fechaCreacion?.toDate?.()?.toISOString?.() ?? 'N/A'}`);
    console.log(`  ultimaEdicion:      ${data.ultimaEdicion?.toDate?.()?.toISOString?.() ?? 'N/A'}`);
    if (data.investigacion) {
      console.log(`  inv.precioSugCalc:  ${data.investigacion.precioSugeridoCalculado}`);
      console.log(`  inv.precioEntrada:  ${data.investigacion.precioEntrada}`);
      console.log(`  inv.ctruEstimado:   ${data.investigacion.ctruEstimado}`);
      console.log(`  inv.fechaInvest:    ${data.investigacion.fechaInvestigacion?.toDate?.()?.toISOString?.() ?? 'N/A'}`);
    }
    // Listar TODAS las claves para detectar campos legacy raros
    console.log(`  Todas las keys:     ${Object.keys(data).sort().join(', ')}`);
    console.log('────────────────────────────────────\n');
  }
}

console.log('Resumen general:');
console.log(`  Con precioVenta > 0:   ${conPrecio}`);
console.log(`  Con precioVenta = 0:   ${conPrecioCero}`);
console.log(`  Sin campo precioVenta: ${sinPrecio}`);
console.log();

console.log('Distribución por línea:');
for (const [linea, stats] of Object.entries(porLinea)) {
  console.log(`  ${linea.padEnd(30)} · ${String(stats.conPrecio).padStart(3)} con precio · ${String(stats.sinPrecio).padStart(3)} sin precio · ${stats.total} total`);
}
console.log();

console.log('Muestra de 8 productos con precioVenta > 0:');
for (const m of muestra) {
  console.log(`  ${m.sku} · ${m.nombre.slice(0, 40).padEnd(40)} · S/ ${String(m.precioVenta).padStart(7)} · ctruP: ${m.ctruPromedio}`);
}

process.exit(0);
