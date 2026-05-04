import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const TARGET = 'SUP-0168';

function encontrarEnObjeto(obj, target, path = '', resultado = []) {
  if (obj == null) return resultado;
  if (typeof obj === 'string') {
    if (obj === target || obj.includes(target)) {
      resultado.push({ path: path || '(root)', value: obj.substring(0, 200) });
    }
    return resultado;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      encontrarEnObjeto(obj[i], target, `${path}[${i}]`, resultado);
      if (resultado.length >= 10) break;
    }
    return resultado;
  }
  if (typeof obj === 'object' && !obj._seconds) { // skip Timestamps
    for (const k of Object.keys(obj)) {
      encontrarEnObjeto(obj[k], target, path ? `${path}.${k}` : k, resultado);
      if (resultado.length >= 10) break;
    }
  }
  return resultado;
}

const colecciones = ['audit_logs', 'actividad', 'mlWebhookLog', 'mlOrderSync', 'mlProductMap', 'mlShipmentLog'];

for (const colName of colecciones) {
  const snap = await db.collection(colName).get();
  console.log(`\n📂 /${colName}: ${snap.size} docs`);
  let huellas = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const found = encontrarEnObjeto(data, TARGET);
    if (found.length > 0) {
      huellas++;
      const ts = data.timestamp?.toDate?.() || data.fecha?.toDate?.() || data.creadoEn?.toDate?.() || data.fechaCreacion?.toDate?.() || 'N/A';
      const accion = data.accion || data.action || data.tipo || data.evento || '?';
      const usuario = data.usuario || data.user || data.userId || data.userEmail || data.uid || '?';
      console.log(`  ✓ ${d.id} · ${accion} · ${usuario} · ${ts}`);
      found.slice(0, 2).forEach(f => console.log(`     ${f.path}: ${f.value}`));
    }
  }
  if (huellas === 0) console.log(`  · sin huellas`);
}

process.exit(0);
