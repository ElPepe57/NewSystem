/**
 * ccHelpers — chk5.D-S3.bis · SF1
 *
 * Helpers puros para la sub-vista CC Entidades (`/finanzas/cc`).
 * Centraliza lógica de agrupación, aging y KPIs canon MOCK 8.
 *
 * Sin Firestore · sin React · testeable aisladamente.
 */

import { Timestamp } from 'firebase/firestore';
import type { CuentaCorriente, TipoEntidadCC } from '../../../../types/cuentaCorriente.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO
// ═════════════════════════════════════════════════════════════════════════

/** Bucket de aging por antigüedad de saldo · canon MOCK 8 §1 aging bars */
export interface AgingBuckets {
  /** % saldo 0-30 días (verde · sano) */
  pct0a30: number;
  /** % saldo 31-60 días (amarillo · alerta) */
  pct31a60: number;
  /** % saldo +60 días (rojo · crítico) */
  pct60plus: number;
  /** Monto absoluto 0-30 días · misma moneda del saldo principal */
  monto0a30: number;
  /** Monto absoluto 31-60 días */
  monto31a60: number;
  /** Monto absoluto +60 días */
  monto60plus: number;
}

export interface CCAgrupadasPorTipo {
  clientes: CuentaCorriente[];
  proveedores: CuentaCorriente[];
  colaboradores: CuentaCorriente[];
  empleados: CuentaCorriente[];
  tarjetasCredito: CuentaCorriente[];
}

export interface SubtotalGrupo {
  /** CC del grupo */
  ccs: CuentaCorriente[];
  /** Suma absoluta PEN del grupo */
  totalPEN: number;
  /** Suma absoluta USD del grupo */
  totalUSD: number;
  /** Cantidad de CC con saldo > 0 */
  count: number;
  /** Suma equivalente PEN aproximada (usando tcpa) */
  totalEquivPEN: number;
}

export interface KPIsCC {
  /** Total por cobrar PEN (CxC · suma de saldoPEN > 0 de clientes) */
  cxcTotalPEN: number;
  /** Total por cobrar USD (CxC · saldoUSD > 0 de clientes) */
  cxcTotalUSD: number;
  /** Cantidad de clientes con saldo > 0 */
  cxcClientesCount: number;
  /** DSO ponderado · días promedio cobro */
  dsoDias: number;

  /** Total por pagar PEN (CxP · |saldoPEN| < 0 de proveedores) */
  cxpTotalPEN: number;
  /** Total por pagar USD (CxP) */
  cxpTotalUSD: number;
  /** Cantidad de proveedores con saldo < 0 */
  cxpProveedoresCount: number;
  /** DPO ponderado */
  dpoDias: number;

  /** Saldo neto = CxC - CxP (PEN equivalente) */
  saldoNetoPEN: number;

  /** CC con +60 días sin movimiento (aging crítico) */
  agingCriticoCount: number;
  /** Monto total PEN equivalente de aging crítico */
  agingCriticoMonto: number;

  /** Top deudor (mayor saldoPEN positivo) */
  topDeudor: CuentaCorriente | null;
  /** % del top deudor sobre CxC total */
  topDeudorPctCxC: number;
}

// ═════════════════════════════════════════════════════════════════════════
// AGRUPACIÓN POR TIPO
// ═════════════════════════════════════════════════════════════════════════

/**
 * Agrupa CC por tipo de entidad · ignora CC con saldo 0 si soloConSaldo=true.
 */
export function agruparPorTipoEntidad(
  ccs: CuentaCorriente[],
  soloConSaldo = false,
): CCAgrupadasPorTipo {
  const grupos: CCAgrupadasPorTipo = {
    clientes: [],
    proveedores: [],
    colaboradores: [],
    empleados: [],
    tarjetasCredito: [],
  };

  for (const cc of ccs) {
    if (soloConSaldo && tieneSaldoCero(cc)) continue;
    switch (cc.tipo) {
      case 'cliente':
        grupos.clientes.push(cc);
        break;
      case 'proveedor':
        grupos.proveedores.push(cc);
        break;
      case 'colaborador':
        grupos.colaboradores.push(cc);
        break;
      case 'empleado':
        grupos.empleados.push(cc);
        break;
      case 'tarjeta_credito':
        grupos.tarjetasCredito.push(cc);
        break;
    }
  }

  // Ordenar cada grupo por magnitud absoluta del saldo descendente
  const ordenador = (a: CuentaCorriente, b: CuentaCorriente) =>
    magnitudAbsoluta(b) - magnitudAbsoluta(a);
  grupos.clientes.sort(ordenador);
  grupos.proveedores.sort(ordenador);
  grupos.colaboradores.sort(ordenador);
  grupos.empleados.sort(ordenador);
  grupos.tarjetasCredito.sort(ordenador);

  return grupos;
}

/**
 * Calcula subtotales por grupo (ej. todo el CxC clientes en PEN+USD).
 */
export function calcularSubtotalGrupo(
  ccs: CuentaCorriente[],
  tcpaActual = 0,
): SubtotalGrupo {
  let totalPEN = 0;
  let totalUSD = 0;
  let count = 0;
  for (const cc of ccs) {
    const pen = Math.abs(cc.saldoPEN || 0);
    const usd = Math.abs(cc.saldoUSD || 0);
    if (pen < 0.01 && usd < 0.01) continue;
    totalPEN += pen;
    totalUSD += usd;
    count++;
  }
  const totalEquivPEN = totalPEN + totalUSD * (tcpaActual || 0);
  return { ccs, totalPEN, totalUSD, count, totalEquivPEN };
}

// ═════════════════════════════════════════════════════════════════════════
// AGING
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula aging buckets para una CC basado SÓLO en fechaUltimoMovimiento
 * (heurística simple · no requiere docs detallados).
 *
 * NOTA · chk5.D-S3.bis: el aging real (por factura) requiere lookup en
 * `cuentasPendientes.service` por entidad. Esta heurística es un fallback
 * razonable cuando no se tienen los docs detallados. Para drill exacto
 * el drawer (SF5) hará lookup real por factura abierta.
 */
export function calcularAgingHeuristico(cc: CuentaCorriente): AgingBuckets {
  const saldo = Math.abs(cc.saldoPEN || 0) + Math.abs(cc.saldoUSD || 0);
  if (saldo < 0.01) {
    return {
      pct0a30: 0,
      pct31a60: 0,
      pct60plus: 0,
      monto0a30: 0,
      monto31a60: 0,
      monto60plus: 0,
    };
  }

  const dias = diasDesde(cc.fechaUltimoMovimiento);
  // Heurística: todo el saldo cae en el bucket correspondiente a la
  // antigüedad del último movimiento. No es perfecto pero da una señal.
  if (dias <= 30) {
    return {
      pct0a30: 100,
      pct31a60: 0,
      pct60plus: 0,
      monto0a30: saldo,
      monto31a60: 0,
      monto60plus: 0,
    };
  }
  if (dias <= 60) {
    return {
      pct0a30: 0,
      pct31a60: 100,
      pct60plus: 0,
      monto0a30: 0,
      monto31a60: saldo,
      monto60plus: 0,
    };
  }
  return {
    pct0a30: 0,
    pct31a60: 0,
    pct60plus: 100,
    monto0a30: 0,
    monto31a60: 0,
    monto60plus: saldo,
  };
}

/**
 * Calcula aging buckets desde una lista de facturas abiertas (más preciso).
 * Cada factura aporta su saldo al bucket según `diasAntiguedad`.
 */
export function calcularAgingDesdeFacturas(
  facturas: Array<{ saldoPEN: number; fechaEmision: Date | Timestamp }>,
): AgingBuckets {
  let monto0a30 = 0;
  let monto31a60 = 0;
  let monto60plus = 0;

  const hoy = new Date();
  for (const f of facturas) {
    const fechaEmision = f.fechaEmision instanceof Timestamp ? f.fechaEmision.toDate() : f.fechaEmision;
    const diasAnt = Math.floor((hoy.getTime() - fechaEmision.getTime()) / (1000 * 60 * 60 * 24));
    const saldo = Math.abs(f.saldoPEN || 0);
    if (diasAnt <= 30) monto0a30 += saldo;
    else if (diasAnt <= 60) monto31a60 += saldo;
    else monto60plus += saldo;
  }

  const total = monto0a30 + monto31a60 + monto60plus;
  if (total < 0.01) {
    return {
      pct0a30: 0,
      pct31a60: 0,
      pct60plus: 0,
      monto0a30: 0,
      monto31a60: 0,
      monto60plus: 0,
    };
  }

  return {
    pct0a30: Math.round((monto0a30 / total) * 100),
    pct31a60: Math.round((monto31a60 / total) * 100),
    pct60plus: Math.round((monto60plus / total) * 100),
    monto0a30,
    monto31a60,
    monto60plus,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// KPIs · CC CANON MOCK 8 (5 KPIs)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula los 5 KPIs canon del header de la sub-vista CC Entidades.
 * (CxC · CxP · Saldo neto · Aging crítico · Top deudor)
 */
export function calcularKPIsCC(ccs: CuentaCorriente[], tcpaActual = 0): KPIsCC {
  const clientes = ccs.filter((cc) => cc.tipo === 'cliente');
  const proveedores = ccs.filter((cc) => cc.tipo === 'proveedor');

  // CxC · saldoPEN > 0 (nos deben)
  let cxcTotalPEN = 0;
  let cxcTotalUSD = 0;
  let cxcClientesCount = 0;
  let topDeudor: CuentaCorriente | null = null;
  let topDeudorSaldo = 0;
  let dsoSumaPonderada = 0;
  let dsoSumaPesos = 0;

  for (const cc of clientes) {
    if (cc.saldoPEN > 0.01 || cc.saldoUSD > 0.01) {
      cxcClientesCount++;
      const pen = Math.max(0, cc.saldoPEN || 0);
      const usd = Math.max(0, cc.saldoUSD || 0);
      cxcTotalPEN += pen;
      cxcTotalUSD += usd;
      const equiv = pen + usd * (tcpaActual || 0);
      if (equiv > topDeudorSaldo) {
        topDeudorSaldo = equiv;
        topDeudor = cc;
      }
      // DSO ponderado por monto
      const dias = diasDesde(cc.fechaUltimoMovimiento);
      dsoSumaPonderada += equiv * dias;
      dsoSumaPesos += equiv;
    }
  }
  const dsoDias = dsoSumaPesos > 0 ? Math.round(dsoSumaPonderada / dsoSumaPesos) : 0;

  // CxP · saldoPEN < 0 (les debemos)
  let cxpTotalPEN = 0;
  let cxpTotalUSD = 0;
  let cxpProveedoresCount = 0;
  let dpoSumaPonderada = 0;
  let dpoSumaPesos = 0;

  for (const cc of proveedores) {
    if (cc.saldoPEN < -0.01 || cc.saldoUSD < -0.01) {
      cxpProveedoresCount++;
      const pen = Math.abs(Math.min(0, cc.saldoPEN || 0));
      const usd = Math.abs(Math.min(0, cc.saldoUSD || 0));
      cxpTotalPEN += pen;
      cxpTotalUSD += usd;
      const equiv = pen + usd * (tcpaActual || 0);
      const dias = diasDesde(cc.fechaUltimoMovimiento);
      dpoSumaPonderada += equiv * dias;
      dpoSumaPesos += equiv;
    }
  }
  const dpoDias = dpoSumaPesos > 0 ? Math.round(dpoSumaPonderada / dpoSumaPesos) : 0;

  // Saldo neto = CxC - CxP (PEN equivalente)
  const saldoNetoPEN =
    cxcTotalPEN + cxcTotalUSD * (tcpaActual || 0) - (cxpTotalPEN + cxpTotalUSD * (tcpaActual || 0));

  // Aging crítico · CC sin movimiento > 60 días con saldo > 0
  let agingCriticoCount = 0;
  let agingCriticoMonto = 0;
  for (const cc of ccs) {
    if (tieneSaldoCero(cc)) continue;
    const dias = diasDesde(cc.fechaUltimoMovimiento);
    if (dias > 60) {
      agingCriticoCount++;
      agingCriticoMonto +=
        Math.abs(cc.saldoPEN || 0) + Math.abs(cc.saldoUSD || 0) * (tcpaActual || 0);
    }
  }

  const topDeudorPctCxC =
    cxcTotalPEN + cxcTotalUSD * (tcpaActual || 0) > 0
      ? Math.round(
          (topDeudorSaldo / (cxcTotalPEN + cxcTotalUSD * (tcpaActual || 0))) * 100,
        )
      : 0;

  return {
    cxcTotalPEN,
    cxcTotalUSD,
    cxcClientesCount,
    dsoDias,
    cxpTotalPEN,
    cxpTotalUSD,
    cxpProveedoresCount,
    dpoDias,
    saldoNetoPEN,
    agingCriticoCount,
    agingCriticoMonto,
    topDeudor,
    topDeudorPctCxC,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS UTILITARIOS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Genera iniciales del nombre · max 2 caracteres en mayúscula.
 * "Premium SA" → "PS" · "Tech Solutions LLC" → "TS" · "GK Xpress" → "GK"
 * "Carlos" → "CA" · "" → "??".
 */
export function obtenerIniciales(nombre: string | undefined | null): string {
  if (!nombre || nombre.trim() === '') return '??';
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(de|del|la|los|las|el|y|sa|sac|sl|llc|inc|ltd|srl|eirl)$/i.test(p));
  if (palabras.length === 0) return nombre.trim().slice(0, 2).toUpperCase();
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

/**
 * Días transcurridos desde una fecha Timestamp · 0 si null/undefined.
 */
export function diasDesde(fecha: Timestamp | undefined | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - fecha.toMillis()) / (1000 * 60 * 60 * 24));
}

/**
 * True si la CC tiene saldo efectivamente cero (PEN + USD < 0.01).
 */
export function tieneSaldoCero(cc: CuentaCorriente): boolean {
  return Math.abs(cc.saldoPEN || 0) < 0.01 && Math.abs(cc.saldoUSD || 0) < 0.01;
}

/**
 * Magnitud absoluta total (PEN + USD) · usada para ordenamiento.
 */
export function magnitudAbsoluta(cc: CuentaCorriente): number {
  return Math.abs(cc.saldoPEN || 0) + Math.abs(cc.saldoUSD || 0);
}

/**
 * Determina si la CC es "favorable" según su tipo:
 *   - cliente con saldo > 0 → favorable (nos deben)
 *   - proveedor con saldo < 0 → favorable también (nos endeudaron pero es normal)
 *   - cliente con saldo < 0 → anormal (adelanto · saldo a favor del cliente)
 *
 * Devuelve label semántico para badge UI.
 */
export function clasificarSaldoSemantico(
  cc: CuentaCorriente,
): 'al_dia' | 'cobrar' | 'pagar' | 'saldo_a_favor' | 'vacio' {
  if (tieneSaldoCero(cc)) return 'al_dia';
  const pen = cc.saldoPEN || 0;
  const usd = cc.saldoUSD || 0;
  const positivo = pen > 0.01 || usd > 0.01;
  const negativo = pen < -0.01 || usd < -0.01;

  switch (cc.tipo) {
    case 'cliente':
      if (positivo) return 'cobrar';
      if (negativo) return 'saldo_a_favor'; // anticipo del cliente
      return 'al_dia';
    case 'proveedor':
      if (negativo) return 'pagar';
      if (positivo) return 'saldo_a_favor'; // anticipo al proveedor
      return 'al_dia';
    case 'colaborador':
    case 'empleado':
      if (negativo) return 'pagar'; // les debemos
      if (positivo) return 'cobrar'; // nos deben (adelantos)
      return 'al_dia';
    case 'tarjeta_credito':
      return positivo ? 'cobrar' : 'pagar';
    default:
      return 'vacio';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS · canon MOCK 8
// ═════════════════════════════════════════════════════════════════════════

export const TIPO_ENTIDAD_LABEL: Record<TipoEntidadCC, string> = {
  cliente: 'Clientes',
  proveedor: 'Proveedores',
  colaborador: 'Colaboradores',
  empleado: 'Empleados',
  tarjeta_credito: 'Tarjetas de Crédito',
};

/** Color semántico por tipo · canon N4 cross-módulo */
export const TIPO_ENTIDAD_COLOR: Record<
  TipoEntidadCC,
  'emerald' | 'rose' | 'purple' | 'indigo' | 'amber'
> = {
  cliente: 'emerald',
  proveedor: 'rose',
  colaborador: 'purple',
  empleado: 'indigo',
  tarjeta_credito: 'amber',
};

/** Badge "CxC" o "CxP" según naturaleza dominante del tipo */
export const TIPO_ENTIDAD_BADGE: Record<TipoEntidadCC, 'CxC' | 'CxP' | 'CC' | null> = {
  cliente: 'CxC',
  proveedor: 'CxP',
  colaborador: null,
  empleado: null,
  tarjeta_credito: null,
};

/** Icon name para lucide (mapeo) · canon mockup */
export const TIPO_ENTIDAD_ICON: Record<TipoEntidadCC, 'user-check' | 'truck' | 'users' | 'user' | 'credit-card'> = {
  cliente: 'user-check',
  proveedor: 'truck',
  colaborador: 'users',
  empleado: 'user',
  tarjeta_credito: 'credit-card',
};
