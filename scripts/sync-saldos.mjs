/**
 * Sincroniza saldoActual con saldoUSD/saldoPEN según la moneda de la cuenta.
 * Hotfix — el modelo tiene campos duplicados que se desincronizan.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('cuentasCaja').get();
let fixed = 0;
for (const d of snap.docs) {
  const c = d.data();
  if (c.esBiMoneda) continue;
  const campoEsperado = c.moneda === 'USD' ? c.saldoUSD : c.saldoPEN;
  const esperado = campoEsperado ?? 0;
  if ((c.saldoActual ?? 0) !== esperado) {
    console.log(`  ${c.nombre}: saldoActual ${c.saldoActual} → ${esperado}`);
    await d.ref.update({ saldoActual: esperado });
    fixed++;
  }
}
console.log(`\n✅ ${fixed} cuentas sincronizadas`);
process.exit(0);
