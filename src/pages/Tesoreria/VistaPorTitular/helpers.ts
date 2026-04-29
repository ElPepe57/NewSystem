/**
 * helpers.ts — VistaPorTitular · S58c parte 2
 *
 * Lógica de agrupación de cuentas y tarjetas por titular según el mockup
 * S58c sección 7. La idea es ver el ecosistema financiero de cada persona/
 * entidad: empleado dueño tiene 4 cuentas + 1 TC, GK Xpress tiene 1 caja, etc.
 */

import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';
import type { EntidadOption } from '../../../hooks/useEntidadesPorTipo';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type TipoTitular =
  | 'empresa'
  | 'empleado'
  | 'colaborador'
  | 'proveedor'
  | 'cliente';

/**
 * Item normalizado de un grupo de titular.
 * Puede ser una CuentaCaja o una TarjetaCredito · el componente UI decide cómo
 * renderizar según `kind`.
 */
export type TitularItem =
  | { kind: 'cuenta'; cuenta: CuentaCaja }
  | { kind: 'tarjeta'; tarjeta: TarjetaCredito };

/**
 * Grupo de items por titular.
 */
export interface GrupoTitular {
  /** ID único del titular dentro del grupo. */
  key: string;
  /** Tipo de titular. */
  tipo: TipoTitular;
  /** Nombre display del titular. */
  nombre: string;
  /** Subtítulo descriptivo. */
  subtitulo: string;
  /** ID de la entidad CC (si tipo !== 'empresa'). */
  entidadId?: string;
  /** Items del grupo. */
  items: TitularItem[];
}

// ═════════════════════════════════════════════════════════════════════════
// AGRUPAR
// ═════════════════════════════════════════════════════════════════════════

const NOMBRE_EMPRESA_DEFAULT = 'Vita Skin Peru SAC';

/**
 * Agrupa cuentas y tarjetas por titular.
 *
 * Reglas:
 *  - Si titularidad='empresa' o no presente → grupo "Empresa"
 *  - Si titularidad='personal' con titularEntidadId → resuelve nombre via
 *    `entidadesPorTipo` lookup (debería estar pre-cargado por el caller)
 *  - Si no resuelve, usa `titularNombre` o `titular` como fallback
 *
 * Orden:
 *  1. Empresa primero
 *  2. Después los demás tipos en orden: empleado · colaborador · proveedor · cliente
 *  3. Dentro de cada grupo, alfabético por nombre del titular
 */
export function agruparPorTitular(
  cuentas: CuentaCaja[],
  tarjetas: TarjetaCredito[],
  resolverNombre: (
    tipo: TipoTitular,
    entidadId: string | undefined,
  ) => string | undefined,
): GrupoTitular[] {
  const grupos = new Map<string, GrupoTitular>();

  const getKey = (
    tipo: TipoTitular,
    entidadId: string | undefined,
  ): string => {
    if (tipo === 'empresa') return 'empresa';
    return `${tipo}_${entidadId ?? 'sin_id'}`;
  };

  const ensureGrupo = (
    key: string,
    tipo: TipoTitular,
    entidadId: string | undefined,
    fallbackNombre?: string,
  ): GrupoTitular => {
    const existente = grupos.get(key);
    if (existente) return existente;

    let nombre: string;
    let subtitulo: string;
    if (tipo === 'empresa') {
      nombre = NOMBRE_EMPRESA_DEFAULT;
      subtitulo = 'Empresa';
    } else {
      const resolvedNombre = resolverNombre(tipo, entidadId);
      nombre = resolvedNombre || fallbackNombre || `(${tipo} sin nombre)`;
      const tipoLabel: Record<TipoTitular, string> = {
        empresa: 'Empresa',
        empleado: 'Empleado',
        colaborador: 'Colaborador',
        proveedor: 'Proveedor',
        cliente: 'Cliente',
      };
      subtitulo = tipoLabel[tipo];
    }

    const grupo: GrupoTitular = {
      key,
      tipo,
      nombre,
      subtitulo,
      entidadId: tipo === 'empresa' ? undefined : entidadId,
      items: [],
    };
    grupos.set(key, grupo);
    return grupo;
  };

  // ── Cuentas ──
  for (const cuenta of cuentas) {
    const titularidad = cuenta.titularidad ?? 'empresa';
    if (titularidad === 'empresa') {
      const g = ensureGrupo('empresa', 'empresa', undefined);
      g.items.push({ kind: 'cuenta', cuenta });
    } else {
      const tipo = (cuenta.titularEntidadTipo ?? 'empleado') as TipoTitular;
      const entidadId = cuenta.titularEntidadId;
      const key = getKey(tipo, entidadId);
      const g = ensureGrupo(
        key,
        tipo,
        entidadId,
        cuenta.titularNombre || cuenta.titular,
      );
      g.items.push({ kind: 'cuenta', cuenta });
    }
  }

  // ── Tarjetas ──
  for (const tarjeta of tarjetas) {
    const titularidad = tarjeta.titularidad ?? 'empresa';
    if (titularidad === 'empresa') {
      const g = ensureGrupo('empresa', 'empresa', undefined);
      g.items.push({ kind: 'tarjeta', tarjeta });
    } else {
      const tipo = (tarjeta.titularEntidadTipo ?? 'empleado') as TipoTitular;
      const entidadId = tarjeta.titularEntidadId;
      const key = getKey(tipo, entidadId);
      const g = ensureGrupo(key, tipo, entidadId, tarjeta.titularNombre);
      g.items.push({ kind: 'tarjeta', tarjeta });
    }
  }

  // Ordenar
  const result = Array.from(grupos.values());
  const ordenTipo: Record<TipoTitular, number> = {
    empresa: 0,
    empleado: 1,
    colaborador: 2,
    proveedor: 3,
    cliente: 4,
  };
  result.sort((a, b) => {
    const dt = ordenTipo[a.tipo] - ordenTipo[b.tipo];
    if (dt !== 0) return dt;
    return a.nombre.localeCompare(b.nombre, 'es-PE', { sensitivity: 'base' });
  });

  // Sub-orden dentro de cada grupo: cuentas primero (banco/digital/efectivo),
  // tarjetas al final, alfabético por nombre
  for (const grupo of result) {
    grupo.items.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'cuenta' ? -1 : 1;
      }
      const nameA =
        a.kind === 'cuenta' ? a.cuenta.nombre : a.tarjeta.nombre;
      const nameB =
        b.kind === 'cuenta' ? b.cuenta.nombre : b.tarjeta.nombre;
      return nameA.localeCompare(nameB, 'es-PE', { sensitivity: 'base' });
    });
  }

  return result;
}

/**
 * Calcula el saldo agregado de un grupo de titular en PEN y USD.
 * Suma los saldos de las cuentas (esBiMoneda → ambos · mono → la moneda de la cuenta).
 *
 * Para tarjetas, el saldo NO se suma aquí porque vive en CC y se debe leer
 * con `useSaldoCCTarjeta`. Lo dejamos pendiente para que el componente UI
 * lo enriquezca con datos de CC.
 */
export function calcularSaldosCuentasGrupo(grupo: GrupoTitular): {
  totalPEN: number;
  totalUSD: number;
} {
  let totalPEN = 0;
  let totalUSD = 0;

  for (const item of grupo.items) {
    if (item.kind !== 'cuenta') continue;
    const c = item.cuenta;
    if (c.esBiMoneda) {
      totalUSD += c.saldoUSD ?? 0;
      totalPEN += c.saldoPEN ?? 0;
    } else if (c.moneda === 'USD') {
      totalUSD += c.saldoActual;
    } else {
      totalPEN += c.saldoActual;
    }
  }

  return { totalPEN, totalUSD };
}

/**
 * Helper para construir el resolver de nombres a partir de los hooks de
 * entidades. El caller le pasa las listas y este construye el lookup.
 */
export function buildResolverNombre(opts: {
  empleados: EntidadOption[];
  colaboradores: EntidadOption[];
  proveedores: EntidadOption[];
  clientes: EntidadOption[];
}): (tipo: TipoTitular, entidadId: string | undefined) => string | undefined {
  return (tipo, entidadId) => {
    if (!entidadId || tipo === 'empresa') return undefined;
    const fuente =
      tipo === 'empleado'
        ? opts.empleados
        : tipo === 'colaborador'
          ? opts.colaboradores
          : tipo === 'proveedor'
            ? opts.proveedores
            : opts.clientes;
    return fuente.find((e) => e.id === entidadId)?.nombre;
  };
}
