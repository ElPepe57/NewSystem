/**
 * firestore.rules · suite de seguridad (emulador) · F0b del proyecto defensa-server-side-egresos.
 *
 * Corre contra el emulador Firestore (`npm run test:rules` lo arranca). Dos bloques:
 *   1. BASELINE SEGURO · comportamiento que YA se cumple (regresión · verde permanente).
 *   2. VULNERABILIDAD ACTUAL · prueba EN VIVO que hoy un cliente forja una aprobación de egreso.
 *      Estos usan assertSucceeds AHORA (documentan la realidad) · F1 los INVIERTE a assertFails
 *      cuando las reglas congelen el campo `autorizacion`. Ver docs/DEFENSA_EGRESOS_SERVER_SIDE.md.
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

/** Siembra el doc users/{uid} (bypass de reglas) para que los get(/users) de rol funcionen. */
async function seedUser(uid: string, roles: string[]) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), { roles, activo: true, estado: 'activo' });
  });
}

/** Siembra un gasto cualquiera (bypass de reglas) para los tests de update. */
async function seedGasto(id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'gastos', id), data);
  });
}

function db(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

describe('BASELINE SEGURO · comportamiento que YA se cumple (regresión)', () => {
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

describe('🔴 VULNERABILIDAD ACTUAL · hoy un cliente forja la aprobación (F1 invierte a assertFails)', () => {
  it('FORJA A · un vendedor crea un gasto YA aprobado, con firmas vacías', async () => {
    await seedUser('vend', ['vendedor']);
    // 🔴 Hoy PASA · F1 (regla create-safe + congelar autorizacion) lo debe volver assertFails.
    await assertSucceeds(
      setDoc(doc(db('vend'), 'gastos', 'g1'), {
        montoPEN: 50000, creadoPor: 'vend', estado: 'pendiente',
        autorizacion: { estado: 'aprobado', firmas: [] },
      }),
    );
  });

  it('FORJA B · un vendedor lleva autorizacion→aprobado con una firma de socio que NO es suya', async () => {
    await seedUser('vend', ['vendedor']);
    await seedGasto('g2', { montoPEN: 50000, creadoPor: 'vend', estado: 'pendiente', autorizacion: { estado: 'pendiente', firmas: [] } });
    // 🔴 Hoy PASA · el usuarioId de la firma lo pone el cliente · F1 lo congela.
    await assertSucceeds(
      updateDoc(doc(db('vend'), 'gastos', 'g2'), {
        autorizacion: { estado: 'aprobado', firmas: [{ usuarioId: 'socio-ajeno' }] },
      }),
    );
  });

  it('FORJA C · un vendedor marca un gasto como pagado directamente', async () => {
    await seedUser('vend', ['vendedor']);
    await seedGasto('g3', { montoPEN: 50000, creadoPor: 'vend', estado: 'pendiente' });
    // 🔴 Hoy PASA · F3 (gatear cash ledger) + F1 lo cierran.
    await assertSucceeds(
      updateDoc(doc(db('vend'), 'gastos', 'g3'), { estado: 'pagado', pagos: [{ monto: 50000 }] }),
    );
  });
});
