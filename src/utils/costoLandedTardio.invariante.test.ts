/**
 * Invariante de PLATA del costo landed tardío (F1 · 2026-06-17)
 * ------------------------------------------------------------------
 * Prueba la regla de oro:  landed_OC == Σ getCTRU(de sus unidades)
 *
 * Para cada CostoLanded scope='envio' (denominador estable = TODAS las unidades del
 * envío), la suma de las cuotas materializadas en las unidades congeladas + las que se
 * materializan al recibirse las restantes == montoPEN del costo.
 *
 * Se usan FUNCIONES PURAS donde existen:
 *   - prorratearLandedAComponentes (builder real · decide universo + denominador)
 *   - construirComponentesUnidad / getCTRU (suma real de componentes congelados)
 * y una réplica EXACTA del backfill de `materializarCostoConfirmado`
 * (`aplicarBackfillConfirmado` abajo) — mismo guard de idempotencia (landedCostoId) y
 * misma partición por estadoEnvio ∈ {recibida, danada}. No se importa el service para
 * evitar la inicialización de Firebase; la lógica de plata vive en las funciones puras +
 * el guard, que aquí se reproducen 1:1.
 */
import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { CostoLanded, EnvioUnidad } from '../types/envio.types';
import type { ComponenteCostoUnidad } from '../types/ctru.types';
import {
  buildUnidadesPorTanda,
  prorratearLandedAComponentes,
  construirComponentesUnidad,
} from './costoComponentes.builder';
import { getCTRU, sumarComponentesCosto } from './ctru.utils';

const TS = { seconds: 0, nanoseconds: 0 } as unknown as Timestamp;

// Estados de EnvioUnidad ya congelados (mismo conjunto que ESTADOS_UNIDAD_CONGELADA del service).
const CONGELADA: ReadonlyArray<EnvioUnidad['estadoEnvio']> = ['recibida', 'danada'];

/** Modelo en memoria de una unidad: su EnvioUnidad (estado) + sus componentesCosto[] congelados. */
interface UnidadSim {
  envio: EnvioUnidad;
  componentesCosto: ComponenteCostoUnidad[]; // doc Unidad
  costoUnitarioUSD: number;
  tcPago: number;
}

function mkUnidad(id: string, opts?: Partial<{ productoId: string; costoUSD: number; tc: number; estado: EnvioUnidad['estadoEnvio'] }>): UnidadSim {
  return {
    envio: {
      unidadId: id,
      productoId: opts?.productoId ?? 'P1',
      sku: 'SKU',
      codigoUnidad: id,
      estadoEnvio: opts?.estado ?? 'pendiente',
    },
    componentesCosto: [],
    costoUnitarioUSD: opts?.costoUSD ?? 0,
    tcPago: opts?.tc ?? 3.7,
  };
}

function costoLanded(over: Partial<CostoLanded>): CostoLanded {
  return {
    id: 'CL-1', categoriaCostoId: 'flete', categoriaCostoNombre: 'Flete',
    monto: 0, moneda: 'PEN', montoPEN: 0, metodoProrrateo: 'fijo_por_unidad',
    pagado: false, creadoPor: 'test', fechaCreacion: TS, estado: 'confirmado', ...over,
  };
}

/**
 * Réplica EXACTA del backfill de `materializarCostoConfirmado`:
 *  - prorratea el costo con el builder real (denominador estable),
 *  - solo CONGELADAS (estadoEnvio ∈ {recibida,danada}) reciben el componente,
 *  - APPEND-ONLY + IDEMPOTENTE por landedCostoId.
 * Muta `unidades` (como haría el batch.update sobre el doc Unidad).
 */
function aplicarBackfillConfirmado(unidades: UnidadSim[], costo: CostoLanded): void {
  const todasEnvio = unidades.map(u => u.envio);
  const porTanda = buildUnidadesPorTanda(undefined, todasEnvio);
  const compsPorUnidad = prorratearLandedAComponentes([costo], todasEnvio, porTanda, new Map(), TS);
  const byId = new Map(unidades.map(u => [u.envio.unidadId, u]));
  for (const [uid, comps] of compsPorUnidad) {
    const u = byId.get(uid);
    if (!u) continue;
    if (!CONGELADA.includes(u.envio.estadoEnvio)) continue; // omitida → la recogerá al recibirse
    const comp = comps[0];
    if (!comp) continue;
    if (u.componentesCosto.some(c => c.landedCostoId === costo.id)) continue; // idempotencia
    u.componentesCosto = [...u.componentesCosto, comp]; // append puro
  }
}

/**
 * Réplica del congelamiento en `registrarRecepcion`: una unidad que se recibe congela
 * su producto + su cuota de TODOS los costos CONFIRMADOS (Cambio 3) vía el builder real.
 */
function recibirUnidad(u: UnidadSim, todasEnvio: EnvioUnidad[], costosConfirmados: CostoLanded[]): void {
  u.envio.estadoEnvio = 'recibida';
  const porTanda = buildUnidadesPorTanda(undefined, todasEnvio);
  const landed = prorratearLandedAComponentes(costosConfirmados, todasEnvio, porTanda, new Map(), TS)
    .get(u.envio.unidadId) || [];
  u.componentesCosto = construirComponentesUnidad(
    { costoUnitarioUSD: u.costoUnitarioUSD, tcPago: u.tcPago },
    landed,
    TS,
  );
}

/** Σ getCTRU sobre el doc Unidad (componentesCosto[]). */
function sumaCTRU(unidades: UnidadSim[]): number {
  return unidades.reduce((s, u) => s + getCTRU({
    componentesCosto: u.componentesCosto,
    costoUnitarioUSD: u.costoUnitarioUSD,
    tcPago: u.tcPago,
  } as any), 0);
}

/** Σ de SOLO los componentes que provienen de un costo landed (excluye producto). */
function sumaLandedDe(unidades: UnidadSim[], costoId: string): number {
  return unidades.reduce((s, u) =>
    s + sumarComponentesCosto(u.componentesCosto.filter(c => c.landedCostoId === costoId)), 0);
}

describe('Invariante landed_OC == Σ getCTRU · costo landed tardío', () => {
  // ── Escenario 1 · confirmado tras recibir TODAS las unidades ────────────────
  it('1) scope=envio confirmado tras recibir TODAS → cada unidad recibe montoPEN/N · Σ = montoPEN', () => {
    const N = 10;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);
    // Recibir todas SIN costos landed aún (solo producto).
    for (const u of unidades) recibirUnidad(u, todasEnvio, []);

    // Llega y se confirma el flete TARDE (todas ya congeladas).
    const flete = costoLanded({ id: 'CL-FLETE', categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    aplicarBackfillConfirmado(unidades, flete);

    // Cada unidad: 200/10 = 20 de flete.
    for (const u of unidades) {
      expect(sumarComponentesCosto(u.componentesCosto.filter(c => c.landedCostoId === 'CL-FLETE'))).toBeCloseTo(20);
    }
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(200); // INVARIANTE
    // CTRU total = producto(148×10) + flete(200) = 1680
    expect(sumaCTRU(unidades)).toBeCloseTo(148 * N + 200);
  });

  // ── Escenario 2 · recepción PARCIAL (6 de 10) ──────────────────────────────
  it('2) confirmado con recepción PARCIAL → 6 por backfill + 4 al recibirse · Σ final = montoPEN', () => {
    const N = 10;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);

    // Recepción 1: se reciben 6, SIN costos confirmados todavía.
    for (let i = 0; i < 6; i++) recibirUnidad(unidades[i], todasEnvio, []);

    // Se confirma el flete con 6 congeladas → backfill solo a esas 6 (denominador estable = 10).
    const flete = costoLanded({ id: 'CL-FLETE', categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    aplicarBackfillConfirmado(unidades, flete);

    // Las 6 congeladas: 20 c/u = 120. Las 4 restantes: 0 (aún no recibidas).
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(120);

    // Recepción 2: se reciben las 4 restantes RE-LEYENDO los costos confirmados (Cambio 3).
    const confirmados = [flete];
    for (let i = 6; i < 10; i++) recibirUnidad(unidades[i], todasEnvio, confirmados);

    // Ahora SÍ Σ = 200 (las 4 trajeron su cuota de 20 al recibirse).
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(200); // INVARIANTE
    for (const u of unidades) {
      expect(sumarComponentesCosto(u.componentesCosto.filter(c => c.landedCostoId === 'CL-FLETE'))).toBeCloseTo(20);
    }
  });

  // ── Escenario 3 · idempotencia ─────────────────────────────────────────────
  it('3) confirmar el mismo costo dos veces (reabrir+re-confirmar) NO duplica el componente', () => {
    const N = 4;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);
    for (const u of unidades) recibirUnidad(u, todasEnvio, []);

    const flete = costoLanded({ id: 'CL-FLETE', categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    aplicarBackfillConfirmado(unidades, flete);
    const sumaTras1 = sumaLandedDe(unidades, 'CL-FLETE');

    // Segundo backfill del MISMO costo (mismo id): guard idempotencia → no-op.
    aplicarBackfillConfirmado(unidades, flete);
    aplicarBackfillConfirmado(unidades, { ...flete }); // misma id, objeto distinto

    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(sumaTras1);
    // Cada unidad tiene EXACTAMENTE un componente de este costo.
    for (const u of unidades) {
      expect(u.componentesCosto.filter(c => c.landedCostoId === 'CL-FLETE')).toHaveLength(1);
    }
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(200);
  });

  // Idempotencia CRUZADA: recepción + confirmación NO doblan (el caso crítico de plata).
  it('3b) si la recepción ya congeló el costo confirmado, el backfill NO lo duplica', () => {
    const N = 4;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);

    // El flete se confirma ANTES de recibir → la recepción lo congela (Cambio 3).
    const flete = costoLanded({ id: 'CL-FLETE', categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    for (const u of unidades) recibirUnidad(u, todasEnvio, [flete]);
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(200);

    // Si ADEMÁS corre el backfill (p.ej. re-confirmación), el guard impide doblar.
    aplicarBackfillConfirmado(unidades, flete);
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(200); // sigue 200, no 400
  });

  // ── Escenario 4 · estimado NO materializa ──────────────────────────────────
  it('4) un costo estimado NO aparece en componentesCosto de ninguna unidad', () => {
    const N = 5;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);

    // Replica Cambio 3: la recepción SOLO congela los CONFIRMADOS.
    const todosCostos = [costoLanded({ id: 'CL-EST', montoPEN: 200, estado: 'estimado' })];
    const confirmados = todosCostos.filter(c => (c.estado ?? 'estimado') === 'confirmado');
    for (const u of unidades) recibirUnidad(u, todasEnvio, confirmados);

    // El estimado no se congeló en nadie.
    expect(sumaLandedDe(unidades, 'CL-EST')).toBe(0);
    for (const u of unidades) {
      expect(u.componentesCosto.some(c => c.landedCostoId === 'CL-EST')).toBe(false);
    }

    // Al confirmarse, el backfill lo materializa al monto firme.
    const confirmado = costoLanded({ id: 'CL-EST', montoPEN: 200, estado: 'confirmado' });
    aplicarBackfillConfirmado(unidades, confirmado);
    expect(sumaLandedDe(unidades, 'CL-EST')).toBeCloseTo(200);
  });

  // Estimado que cambia de monto al confirmar: como NUNCA se congeló, NO hay sub-conteo del delta.
  it('4b) estimado→confirmado con monto distinto: la unidad materializa el monto CONFIRMADO (sin delta)', () => {
    const N = 4;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);
    // Recepción con estimado de 200 → NO se congela (Cambio 3).
    for (const u of unidades) recibirUnidad(u, todasEnvio, []);
    expect(sumaLandedDe(unidades, 'CL-X')).toBe(0);
    // Se confirma a 240 (la factura vino más cara). Backfill al monto FIRME 240.
    const confirmado = costoLanded({ id: 'CL-X', montoPEN: 240, estado: 'confirmado' });
    aplicarBackfillConfirmado(unidades, confirmado);
    expect(sumaLandedDe(unidades, 'CL-X')).toBeCloseTo(240); // firme, no 200 ni 200+40
    for (const u of unidades) {
      expect(sumarComponentesCosto(u.componentesCosto.filter(c => c.landedCostoId === 'CL-X'))).toBeCloseTo(60);
    }
  });

  // ── Escenario 5 · carga negativa (nota de crédito) ─────────────────────────
  it('5) NC con montoPEN<0 baja el CTRU netamente', () => {
    const N = 4;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    const todasEnvio = unidades.map(u => u.envio);
    for (const u of unidades) recibirUnidad(u, todasEnvio, []);
    const ctruAntes = sumaCTRU(unidades); // 148×4 = 592

    // Nota de crédito tardía: −80 prorrateado entre 4 → −20 c/u (categoria descuento).
    const nc = costoLanded({ id: 'CL-NC', categoriaCostoNombre: 'Nota de crédito', montoPEN: -80 });
    aplicarBackfillConfirmado(unidades, nc);

    expect(sumaLandedDe(unidades, 'CL-NC')).toBeCloseTo(-80); // INVARIANTE (negativo)
    for (const u of unidades) {
      const compNC = u.componentesCosto.filter(c => c.landedCostoId === 'CL-NC');
      expect(sumarComponentesCosto(compNC)).toBeCloseTo(-20);
      expect(compNC[0].categoria).toBe('descuento'); // builder mapea montoPEN<0 → descuento
    }
    expect(sumaCTRU(unidades)).toBeCloseTo(ctruAntes - 80); // bajó neto
  });

  // ── Escenario 6 · unidad perdida → su cuota NO se reparte (MERMA) ──────────
  it('6) unidad perdida: su cuota NO se reparte a las buenas (denominador estable)', () => {
    const N = 10;
    const unidades = Array.from({ length: N }, (_, i) => mkUnidad(`u${i + 1}`, { costoUSD: 40, tc: 3.7 }));
    // 9 recibidas, 1 perdida (u10).
    unidades[9].envio.estadoEnvio = 'perdida';
    const todasEnvio = unidades.map(u => u.envio); // denominador estable = 10 (incluye la perdida)
    for (let i = 0; i < 9; i++) recibirUnidad(unidades[i], todasEnvio, []);

    const flete = costoLanded({ id: 'CL-FLETE', categoriaCostoNombre: 'Flete remesa', montoPEN: 200 });
    aplicarBackfillConfirmado(unidades, flete);

    // Cada BUENA mantiene su cuota ORIGINAL = 200/10 = 20 (NO 200/9 = 22.2).
    for (let i = 0; i < 9; i++) {
      expect(sumarComponentesCosto(unidades[i].componentesCosto.filter(c => c.landedCostoId === 'CL-FLETE'))).toBeCloseTo(20);
    }
    // La perdida NO recibe componente.
    expect(unidades[9].componentesCosto.some(c => c.landedCostoId === 'CL-FLETE')).toBe(false);

    // Σ landed materializado = 9×20 = 180 ; la fracción de 20 de la perdida es MERMA del P&L
    // (NO se redistribuyó a las buenas · CTRU de las sanas intacto).
    expect(sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(180);
    expect(200 - sumaLandedDe(unidades, 'CL-FLETE')).toBeCloseTo(20); // merma = 20
  });
});
