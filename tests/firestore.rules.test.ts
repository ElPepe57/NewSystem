/**
 * firestore.rules · suite de seguridad (emulador) · proyecto defensa-server-side-egresos.
 *
 * Corre contra el emulador Firestore (`npm run test:rules` lo arranca). Bloques:
 *   1. BASELINE SEGURO · regresión (verde permanente).
 *   2. F1 · ENFORCE · el cliente NO puede forjar una aprobación (gastos/OC/requerimientos).
 *   3. 🟠 ABIERTO HASTA F3 · el pago (cash ledger) aún no está gateado · lo cierra F3.
 * Ver docs/DEFENSA_EGRESOS_SERVER_SIDE.md.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const __dirnameLocal = dirname(fileURLToPath(import.meta.url));
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: {
      rules: readFileSync(resolve(__dirnameLocal, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** Siembra el doc users/{uid} (bypass de reglas) para que los get(/users) de rol/permiso funcionen. */
async function seedUser(uid: string, roles: string[], permisos: string[] = []) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), { roles, activo: true, estado: 'activo', permisos });
  });
}

/** Siembra un doc cualquiera (bypass de reglas) para los tests de update. */
async function seed(col: string, id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), col, id), data);
  });
}

function db(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

describe('BASELINE SEGURO · regresión (verde permanente)', () => {
  it('usuario NO autenticado no puede leer gastos', async () => {
    const unauth = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauth, 'gastos', 'g1')));
  });

  it('usuario activo SIN rol de gasto (invitado) no puede crear un gasto', async () => {
    await seedUser('inv', ['invitado']);
    await assertFails(setDoc(doc(db('inv'), 'gastos', 'g1'), { montoPEN: 100, creadoPor: 'inv' }));
  });

  it('colección inexistente → denegada por deny-by-default', async () => {
    await seedUser('adm', ['admin']);
    await assertFails(setDoc(doc(db('adm'), 'coleccionFantasma', 'x'), { foo: 1 }));
  });

  it('un vendedor activo SÍ puede crear un gasto normal (no romper el flujo legítimo)', async () => {
    await seedUser('vend', ['vendedor']);
    await assertSucceeds(setDoc(doc(db('vend'), 'gastos', 'g1'), { montoPEN: 100, creadoPor: 'vend', estado: 'pendiente' }));
  });
});

describe('F1 · GASTOS · el cliente no forja aprobación', () => {
  it('create-safe: nace sin `autorizacion` → permitido', async () => {
    await seedUser('vend', ['vendedor']);
    await assertSucceeds(setDoc(doc(db('vend'), 'gastos', 'g1'), { montoPEN: 5000, creadoPor: 'vend', estado: 'pendiente' }));
  });

  it('🔒 FORJA A (create): crear un gasto YA aprobado → DENEGADO', async () => {
    await seedUser('vend', ['vendedor']);
    await assertFails(
      setDoc(doc(db('vend'), 'gastos', 'g1'), {
        montoPEN: 50000, creadoPor: 'vend', estado: 'pendiente',
        autorizacion: { estado: 'aprobado', firmas: [] },
      }),
    );
  });

  it('🔒 creador forjado (create con creadoPor ≠ quien escribe) → DENEGADO', async () => {
    await seedUser('vend', ['vendedor']);
    await assertFails(setDoc(doc(db('vend'), 'gastos', 'g1'), { montoPEN: 100, creadoPor: 'otro-socio', estado: 'pendiente' }));
  });

  it('🔒 origen `sistema_ml` desde cliente → DENEGADO', async () => {
    await seedUser('vend', ['vendedor']);
    await assertFails(setDoc(doc(db('vend'), 'gastos', 'g1'), { montoPEN: 100, creadoPor: 'vend', origen: 'sistema_ml', estado: 'pagado' }));
  });

  it('🔒 FORJA A/B (update): llevar `autorizacion`→aprobado con firma ajena → DENEGADO', async () => {
    await seedUser('vend', ['vendedor']);
    await seed('gastos', 'g2', { montoPEN: 50000, creadoPor: 'vend', estado: 'pendiente', autorizacion: { estado: 'pendiente', firmas: [] } });
    await assertFails(
      updateDoc(doc(db('vend'), 'gastos', 'g2'), { autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'socio-ajeno' }] } }),
    );
  });

  it('🔒 re-asignar `creadoPor` en update → DENEGADO', async () => {
    await seedUser('vend', ['vendedor']);
    await seed('gastos', 'g3', { montoPEN: 100, creadoPor: 'vend', estado: 'pendiente' });
    await assertFails(updateDoc(doc(db('vend'), 'gastos', 'g3'), { creadoPor: 'otro' }));
  });

  it('✅ edición legítima de campo no-monetario (sin tocar autorizacion/creadoPor) → permitido', async () => {
    await seedUser('vend', ['vendedor']);
    await seed('gastos', 'g4', { montoPEN: 100, creadoPor: 'vend', estado: 'pendiente', descripcion: 'a' });
    await assertSucceeds(updateDoc(doc(db('vend'), 'gastos', 'g4'), { descripcion: 'corregida' }));
  });

  it('✅ ADMIN escribe `autorizacion` directo (escape hatch · canon admin=root) → permitido', async () => {
    await seedUser('adm', ['admin']);
    await seed('gastos', 'g5', { montoPEN: 50000, creadoPor: 'otro', estado: 'pendiente', autorizacion: { estado: 'pendiente', firmas: [] } });
    await assertSucceeds(updateDoc(doc(db('adm'), 'gastos', 'g5'), { autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'adm' }] } }));
  });
});

describe('F1 · ORDENES DE COMPRA · el cliente no forja aprobación', () => {
  it('create-safe: nace sin autorizacion aprobada → permitido', async () => {
    await seedUser('comp', ['comprador']);
    await assertSucceeds(setDoc(doc(db('comp'), 'ordenesCompra', 'oc1'), { totalUSD: 5000, creadoPor: 'comp', estadoPago: 'pendiente' }));
  });

  it('🔒 FORJA (create): OC ya aprobada → DENEGADO', async () => {
    await seedUser('comp', ['comprador']);
    await assertFails(
      setDoc(doc(db('comp'), 'ordenesCompra', 'oc1'), { totalUSD: 50000, creadoPor: 'comp', autorizacion: { estado: 'aprobado', firmas: [] } }),
    );
  });

  it('🔒 FORJA (update): llevar OC `autorizacion`→aprobado → DENEGADO', async () => {
    await seedUser('comp', ['comprador']);
    await seed('ordenesCompra', 'oc2', { totalUSD: 50000, creadoPor: 'comp', autorizacion: { estado: 'pendiente', firmas: [] } });
    await assertFails(updateDoc(doc(db('comp'), 'ordenesCompra', 'oc2'), { autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'x' }] } }));
  });

  it('✅ editar totalUSD de una OC SIN firmas (armando) → permitido', async () => {
    await seedUser('comp', ['comprador']);
    await seed('ordenesCompra', 'oc3', { totalUSD: 1000, creadoPor: 'comp', autorizacion: { estado: 'pendiente', firmas: [] } });
    await assertSucceeds(updateDoc(doc(db('comp'), 'ordenesCompra', 'oc3'), { totalUSD: 3000 }));
  });

  it('🔒 F2 freeze: inflar totalUSD de una OC con firma (autorizando) → DENEGADO', async () => {
    await seedUser('comp', ['comprador']);
    await seed('ordenesCompra', 'oc4', { totalUSD: 3000, creadoPor: 'comp', autorizacion: { estado: 'pendiente', firmas: [{ usuarioId: 'A' }] } });
    await assertFails(updateDoc(doc(db('comp'), 'ordenesCompra', 'oc4'), { totalUSD: 5000 }));
  });

  it('🔒 F2 freeze: inflar totalUSD de una OC ya aprobada → DENEGADO', async () => {
    await seedUser('comp', ['comprador']);
    await seed('ordenesCompra', 'oc5', { totalUSD: 3000, creadoPor: 'comp', autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'A' }, { usuarioId: 'B' }] } });
    await assertFails(updateDoc(doc(db('comp'), 'ordenesCompra', 'oc5'), { totalUSD: 5000 }));
  });

  it('✅ editar un campo NO-total de una OC aprobada (sin tocar totalUSD) → permitido', async () => {
    await seedUser('comp', ['comprador']);
    await seed('ordenesCompra', 'oc6', { totalUSD: 3000, creadoPor: 'comp', notas: 'a', autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'A' }, { usuarioId: 'B' }] } });
    await assertSucceeds(updateDoc(doc(db('comp'), 'ordenesCompra', 'oc6'), { notas: 'actualizada' }));
  });
});

describe('F2 · REQUERIMIENTOS · estado→aprobado = autoridad de cargo (permiso + segregación)', () => {
  it('create-safe: nace sin estado=aprobado → permitido', async () => {
    await seedUser('vend', ['vendedor']);
    await assertSucceeds(setDoc(doc(db('vend'), 'requerimientos', 'r1'), { creadoPor: 'vend', estado: 'pendiente' }));
  });

  it('🔒 FORJA (create): requerimiento ya aprobado → DENEGADO', async () => {
    await seedUser('vend', ['vendedor']);
    await assertFails(setDoc(doc(db('vend'), 'requerimientos', 'r1'), { creadoPor: 'vend', estado: 'aprobado' }));
  });

  it('🔒 estado→aprobado SIN permiso APROBAR_REQUERIMIENTO → DENEGADO', async () => {
    await seedUser('vendsin', ['vendedor']); // rol sin el permiso
    await seed('requerimientos', 'r2', { creadoPor: 'otro', estado: 'pendiente_aprobacion' });
    await assertFails(updateDoc(doc(db('vendsin'), 'requerimientos', 'r2'), { estado: 'aprobado' }));
  });

  it('✅ estado→aprobado CON permiso (no creador) → permitido (autoridad de cargo)', async () => {
    await seedUser('compP', ['comprador'], ['aprobar_requerimiento']);
    await seed('requerimientos', 'r2b', { creadoPor: 'otro', estado: 'pendiente_aprobacion' });
    await assertSucceeds(updateDoc(doc(db('compP'), 'requerimientos', 'r2b'), { estado: 'aprobado', aprobadoPor: 'compP' }));
  });

  it('🔒 estado→aprobado CON permiso pero ES el creador → DENEGADO (segregación)', async () => {
    await seedUser('compP2', ['comprador'], ['aprobar_requerimiento']);
    await seed('requerimientos', 'r2c', { creadoPor: 'compP2', estado: 'pendiente_aprobacion' });
    await assertFails(updateDoc(doc(db('compP2'), 'requerimientos', 'r2c'), { estado: 'aprobado' }));
  });

  it('✅ lifecycle legítimo (estado→en_proceso al vincular OC) → permitido', async () => {
    await seedUser('comp', ['comprador']);
    await seed('requerimientos', 'r3', { creadoPor: 'comp', estado: 'pendiente' });
    await assertSucceeds(updateDoc(doc(db('comp'), 'requerimientos', 'r3'), { estado: 'en_proceso' }));
  });

  it('✅ lifecycle legítimo (cancelar) → permitido', async () => {
    await seedUser('vend', ['vendedor']);
    await seed('requerimientos', 'r4', { creadoPor: 'vend', estado: 'pendiente' });
    await assertSucceeds(updateDoc(doc(db('vend'), 'requerimientos', 'r4'), { estado: 'cancelado' }));
  });
});

describe('F3 · CASH LEDGER · el cliente no crea el cash de un egreso referenciado', () => {
  it('🔒 cliente NO crea movimientosFinancieros de pago de GASTO (refDocumentoTipo=gasto) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    await assertFails(setDoc(doc(db('fin'), 'movimientosFinancieros', 'm1'), { categoria: 'gasto_operativo', monto: 50000, refDocumentoTipo: 'gasto', refDocumentoId: 'g1', productoOrigenId: 'caja' }));
  });
  it('🔒 cliente NO crea cash de pago de OC (refDocumentoTipo=oc) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    await assertFails(setDoc(doc(db('fin'), 'movimientosFinancieros', 'm2'), { categoria: 'pago_orden_compra', monto: 30000, refDocumentoTipo: 'oc', refDocumentoId: 'oc1', productoOrigenId: 'caja' }));
  });
  it('🔒 cliente NO crea el cash MASIVO (categoría de egreso · SIN refDocumentoTipo) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    // pagoAbonoDistribuido crea UN movimiento agregado sin refDocumentoTipo · el gate por categoría lo atrapa.
    await assertFails(setDoc(doc(db('fin'), 'movimientosFinancieros', 'm2b'), { categoria: 'gasto_operativo', monto: 90000, productoOrigenId: 'caja' }));
  });
  it('✅ cliente SÍ crea un INGRESO (cobro · ref a venta, no a egreso) → permitido', async () => {
    await seedUser('fin', ['finanzas']);
    await assertSucceeds(setDoc(doc(db('fin'), 'movimientosFinancieros', 'm3'), { categoria: 'ingreso_venta', monto: 1000, refDocumentoTipo: 'venta', refDocumentoId: 'v1', productoDestinoId: 'caja' }));
  });
  it('✅ cliente SÍ crea una conversión/transferencia interna (sin ref a oc/gasto) → permitido', async () => {
    await seedUser('fin', ['finanzas']);
    await assertSucceeds(setDoc(doc(db('fin'), 'movimientosFinancieros', 'm4'), { categoria: 'conversion_salida', monto: 1000, productoOrigenId: 'caja-usd', productoDestinoId: 'caja-pen' }));
  });
});

describe('F3c · RETIRO DE SOCIO · gate sin-ref (movimientosTesoreria + retirosCapital)', () => {
  it('🔒 cliente NO crea el cash de un retiro (movimientosTesoreria tipo=retiro_socio) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    await assertFails(setDoc(doc(db('fin'), 'movimientosTesoreria', 'mt1'), { tipo: 'retiro_socio', monto: 5000, cuentaOrigen: 'caja', estado: 'ejecutado' }));
  });
  it('✅ cliente SÍ crea otros movimientos de tesorería (aporte/ingreso/conversión) → permitido', async () => {
    await seedUser('fin', ['finanzas']);
    await assertSucceeds(setDoc(doc(db('fin'), 'movimientosTesoreria', 'mt2'), { tipo: 'aporte_socio', monto: 5000, cuentaDestino: 'caja', estado: 'ejecutado' }));
  });
  it('🔒 defensa-en-profundidad · retiro_socio en movimientosFinancieros (no es su libro) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    await assertFails(setDoc(doc(db('fin'), 'movimientosFinancieros', 'mf-ret'), { categoria: 'retiro_socio', monto: 50000, productoOrigenId: 'caja' }));
  });
  it('✅ create-safe · cliente crea un retiro PENDIENTE (sin autorizacion=aprobado · creador pineado) → permitido', async () => {
    await seedUser('fin', ['finanzas']);
    await assertSucceeds(setDoc(doc(db('fin'), 'retirosCapital', 'r1'), { creadoPor: 'fin', monto: 5000, moneda: 'USD', tipoCambio: 3.7, estado: 'pendiente', autorizacion: { estado: 'pendiente', firmas: [] } }));
  });
  it('🔒 cliente NO crea un retiro ya APROBADO (forja del quórum) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    await assertFails(setDoc(doc(db('fin'), 'retirosCapital', 'r2'), { creadoPor: 'fin', monto: 5000, estado: 'pendiente', autorizacion: { estado: 'aprobado', firmas: [] } }));
  });
  it('🔒 cliente NO pinea otro creador en el retiro (segregación) → DENEGADO', async () => {
    await seedUser('fin', ['finanzas']);
    await assertFails(setDoc(doc(db('fin'), 'retirosCapital', 'r3'), { creadoPor: 'otro', monto: 5000, estado: 'pendiente' }));
  });
  it('🔒 cliente NO infla el monto del retiro con la autorización en proceso (USD landed congelado) → DENEGADO', async () => {
    await seed('retirosCapital', 'r4', { creadoPor: 'fin', monto: 999, moneda: 'USD', tipoCambio: 3.7, estado: 'pendiente', autorizacion: { estado: 'pendiente', firmas: [{ usuarioId: 's1' }] } });
    await seedUser('fin', ['finanzas']);
    await assertFails(updateDoc(doc(db('fin'), 'retirosCapital', 'r4'), { monto: 5000 }));
  });
  it('🔒 cliente NO forja la autorización del retiro en un update → DENEGADO', async () => {
    await seed('retirosCapital', 'r5', { creadoPor: 'fin', monto: 5000, estado: 'pendiente', autorizacion: { estado: 'pendiente', firmas: [] } });
    await seedUser('fin', ['finanzas']);
    await assertFails(updateDoc(doc(db('fin'), 'retirosCapital', 'r5'), { autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'fin' }] } }));
  });
});

describe('🟠 ABIERTO · sin-ref con flujo real en movimientosFinancieros (reembolso_cliente · pago_viajero/envío)', () => {
  it('reembolso_cliente · flujo real · hoy permitido · pendiente de gate de aprobación (migración aparte)', async () => {
    await seedUser('fin', ['finanzas']);
    await assertSucceeds(setDoc(doc(db('fin'), 'movimientosFinancieros', 'mf-reemb'), { categoria: 'reembolso_cliente', monto: 50000, productoOrigenId: 'caja' }));
  });
});
