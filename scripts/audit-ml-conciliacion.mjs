import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

const mlSyncs = await db.collection('mlOrderSync').where('estado', '==', 'procesada').get();
console.log("Ventas ML procesadas: " + mlSyncs.size + "\n");

let totMLBruto=0, totEnvFlex=0, totEnvUrbano=0, totComision=0, totDepEsperado=0;
let totIngReg=0, totGasComReg=0, totGasEnvReg=0;
const rows=[];

for (const s of mlSyncs.docs) {
  const sd = s.data();
  const ventaDoc = await db.collection('ventas').doc(sd.ventaId).get();
  if (!ventaDoc.exists) continue;
  const vd = ventaDoc.data();
  
  const totalML = sd.totalML||0, comML = sd.comisionML||0;
  const costoEnvCli = sd.costoEnvioCliente||0, cargoEnvML = sd.cargoEnvioML||0;
  const met = sd.metodoEnvio||'?';
  
  // Deposito esperado
  const depEsp = met==='urbano' ? totalML - comML - cargoEnvML : totalML + costoEnvCli - comML;
  
  // Movimientos ingreso
  const mI = await db.collection('movimientosTesoreria').where('ventaId','==',sd.ventaId).where('tipo','==','ingreso_venta').get();
  let ingMP=0; const ingList=[];
  for (const m of mI.docs) { const md=m.data(); if(md.cuentaOrigen===mpId||md.cuentaDestino===mpId){ingMP+=md.monto||0;ingList.push(md.numeroMovimiento+":S/"+md.monto);}}
  
  // Movimientos gasto
  const mG = await db.collection('movimientosTesoreria').where('ventaId','==',sd.ventaId).where('tipo','==','gasto_operativo').get();
  let gasCom=0, gasEnv=0;
  for (const m of mG.docs) { const md=m.data(); if(md.cuentaOrigen===mpId){if(md.concepto&&md.concepto.includes('Entrega')){gasEnv+=md.monto||0;}else{gasCom+=md.monto||0;}}}
  
  const netoReg = ingMP - gasCom - gasEnv;
  const diff = netoReg - depEsp;
  
  totMLBruto+=totalML; totComision+=comML; totDepEsperado+=depEsp; totIngReg+=ingMP; totGasComReg+=gasCom; totGasEnvReg+=gasEnv;
  if(met==='flex')totEnvFlex+=costoEnvCli; if(met==='urbano')totEnvUrbano+=cargoEnvML;
  
  rows.push({vn:sd.numeroVenta,met,totalML,envio:met==='flex'?costoEnvCli:-cargoEnvML,comML,depEsp,ingMP,gasCom,gasEnv,netoReg,diff,dup:ingList.length>1,ingList});
}

// Print
for (const r of rows) {
  const flag = Math.abs(r.diff)>0.01 ? (r.dup ? " DUP!" : " !!") : " ok";
  console.log(r.vn + " | " + r.met.padEnd(7) + " | ML=" + r.totalML.toFixed(2).padStart(7) + " | env=" + r.envio.toFixed(2).padStart(6) + " | com=" + r.comML.toFixed(2).padStart(6) + " | depEsp=" + r.depEsp.toFixed(2).padStart(7) + " | ingReg=" + r.ingMP.toFixed(2).padStart(7) + " | gasCom=" + r.gasCom.toFixed(2).padStart(6) + " | neto=" + r.netoReg.toFixed(2).padStart(7) + " | diff=" + r.diff.toFixed(2).padStart(7) + flag);
  if (r.dup) console.log("  -> DUPLICADO: " + r.ingList.join(", "));
}

const totNetoReg = totIngReg - totGasComReg - totGasEnvReg;
console.log("\n===== TOTALES ML =====");
console.log("Total ML bruto (productos):  S/ " + totMLBruto.toFixed(2));
console.log("+ Envio Flex (ingreso):     +S/ " + totEnvFlex.toFixed(2));
console.log("- Envio Urbano (retenido):  -S/ " + totEnvUrbano.toFixed(2));
console.log("- Comision ML:              -S/ " + totComision.toFixed(2));
console.log("= Deposito esperado a MP:    S/ " + totDepEsperado.toFixed(2));
console.log("---");
console.log("Ingreso registrado:         +S/ " + totIngReg.toFixed(2));
console.log("Gasto comision registrado:  -S/ " + totGasComReg.toFixed(2));
console.log("Gasto envio registrado:     -S/ " + totGasEnvReg.toFixed(2));
console.log("= Neto registrado:           S/ " + totNetoReg.toFixed(2));
console.log("---");
console.log("DIFERENCIA neto vs esperado: S/ " + (totNetoReg - totDepEsperado).toFixed(2));

// Ajuste manual envios
console.log("\n===== AJUSTES MANUALES =====");
const ajQ = await db.collection('movimientosTesoreria').where('concepto','>=','Ajuste por ingreso').where('concepto','<=','Ajuste por ingreso\uf8ff').get();
let totAj=0;
for (const m of ajQ.docs) { const d=m.data(); if(d.cuentaOrigen===mpId||d.cuentaDestino===mpId){totAj+=d.monto||0;console.log("  "+d.numeroMovimiento+" | "+d.fecha?.toDate?.()?.toISOString?.()?.substring(0,10)+" | S/ "+d.monto+" | "+d.concepto);}}
console.log("Total ajustes manuales: S/ " + totAj.toFixed(2));

console.log("\n===== RESULTADO FINAL ML =====");
console.log("Deposito esperado ML:    S/ " + totDepEsperado.toFixed(2));
console.log("+ Ajuste manual envios: +S/ " + totAj.toFixed(2));
console.log("= Total real esperado:   S/ " + (totDepEsperado+totAj).toFixed(2));
console.log("Neto registrado:         S/ " + totNetoReg.toFixed(2));
console.log("Diferencia final:        S/ " + (totNetoReg - totDepEsperado - totAj).toFixed(2));
