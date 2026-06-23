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

describe('🟠 ABIERTO HASTA F3 · el pago (cash ledger) aún no está gateado', () => {
  it('un vendedor marca un gasto como pagado (denormalizado) · F1 no lo cierra · lo cierra F3', async () => {
    await seedUser('vend', ['vendedor']);
    await seed('gastos', 'g6', { montoPEN: 50000, creadoPor: 'vend', estado: 'pendiente' });
    // F1 congela `autorizacion`, no el flag de pago · el dinero real (movimientosFinancieros) lo gatea F3.
    await assertSucceeds(updateDoc(doc(db('vend'), 'gastos', 'g6'), { estado: 'pagado', pagos: [{ monto: 50000 }] }));
  });
});
