/**
 * Glosario contable · canon v5.2 chk5.E-A
 *
 * Diccionario de términos técnicos del módulo Contabilidad explicados en lenguaje
 * coloquial · para alimentar tooltips pedagógicos y modal Glosario.
 *
 * Cobertura: ~25 términos · expandible al sumar indicadores nuevos.
 */

export type GlosarioCategoria =
  | 'rentabilidad'
  | 'liquidez'
  | 'eficiencia'
  | 'balance'
  | 'otros';

export interface TerminoGlosario {
  /** ID único · usado para lookup desde tooltips */
  id: string;
  /** Nombre del término (display) */
  titulo: string;
  /** Sinónimos / nombre largo si aplica · ej. "ROE · Return on Equity" */
  sinonimo?: string;
  /** Categoría para filtrado */
  categoria: GlosarioCategoria;
  /** Definición coloquial · 1-2 frases */
  definicion: string;
  /** Fórmula o método de cálculo · opcional */
  calculo?: string;
  /** Ejemplo del negocio · opcional */
  ejemplo?: string;
  /** Qué significa "saludable" · opcional */
  saludable?: string;
  /** Si es término clave destacado en el glosario · ★ */
  esClave?: boolean;
}

export const GLOSARIO_CATEGORIAS: Record<GlosarioCategoria, { label: string; color: string }> = {
  rentabilidad: { label: 'Rentabilidad', color: 'emerald' },
  liquidez: { label: 'Liquidez', color: 'sky' },
  eficiencia: { label: 'Eficiencia', color: 'amber' },
  balance: { label: 'Balance', color: 'rose' },
  otros: { label: 'Otros', color: 'slate' },
};

/**
 * Catálogo completo · ordenado alfabéticamente por título
 */
export const GLOSARIO_CONTABLE: TerminoGlosario[] = [
  // A
  {
    id: 'activo-corriente',
    titulo: 'Activo Corriente',
    categoria: 'balance',
    definicion:
      'Todo lo que tu empresa POSEE y va a usar o convertir en plata en menos de 1 año: efectivo en caja y bancos, lo que te deben los clientes (CxC), e inventario.',
    calculo: 'Efectivo + CxC neto + Inventarios',
  },
  {
    id: 'activo-no-corriente',
    titulo: 'Activo No Corriente',
    categoria: 'balance',
    definicion:
      'Lo que tu empresa POSEE y va a usar a largo plazo (más de 1 año): equipos, vehículos, inmuebles. En PyME ecommerce típicamente bajo.',
  },
  {
    id: 'anticipos-clientes',
    titulo: 'Anticipos de Clientes',
    categoria: 'balance',
    definicion:
      'Plata que clientes te pagaron por adelantado por productos que aún NO entregaste. Aunque "ya tenés la plata", contablemente es DEUDA: si no entregás, hay que devolver.',
    ejemplo: 'Cliente pagó S/300 por kit que enviás la próxima semana → S/300 anticipo.',
  },

  // C
  {
    id: 'capital-social',
    titulo: 'Capital Social',
    categoria: 'balance',
    definicion:
      'Plata que los socios pusieron al iniciar la empresa. Es el "aporte fundador". No cambia salvo que entren/salgan socios o se aumente capital con nuevos aportes.',
  },
  {
    id: 'cogs',
    titulo: 'COGS',
    sinonimo: 'COGS · Costo de Venta · Cost of Goods Sold',
    categoria: 'rentabilidad',
    definicion:
      'Cuánto te costó comprar/producir lo que vendiste. Es la materia prima del negocio.',
    calculo: 'Compras recibidas + Flete internacional + Impuestos importación',
    saludable: 'entre 40-55% de las ventas',
    esClave: true,
  },
  {
    id: 'cxc',
    titulo: 'CxC',
    sinonimo: 'CxC · Cuentas por Cobrar',
    categoria: 'balance',
    definicion:
      'Plata que TE DEBEN tus clientes por ventas que ya hiciste pero aún no te pagaron.',
    saludable:
      'que no crezca más rápido que las ventas. Si crece mucho, tu cobranza está lenta.',
  },
  {
    id: 'cxp',
    titulo: 'CxP',
    sinonimo: 'CxP · Cuentas por Pagar',
    categoria: 'balance',
    definicion:
      'Plata que TÚ DEBÉS a proveedores por OCs recibidas pendientes de pago.',
  },

  // D
  {
    id: 'diferencial-cambiario',
    titulo: 'Diferencial Cambiario',
    categoria: 'otros',
    definicion:
      'Ganancia o pérdida por variación del tipo de cambio entre el momento que registrás una compra/venta en USD y el momento que pagás/cobrás.',
    ejemplo:
      'Comprás US$100 a TC 3.75 → S/375. Pagás cuando TC subió a 3.80 → te cuesta S/380. Pérdida cambiaria S/5.',
  },
  {
    id: 'dpo',
    titulo: 'DPO',
    sinonimo: 'DPO · Days Payable Outstanding · Días de Pago',
    categoria: 'eficiencia',
    definicion:
      'Cuántos días en promedio tardás en pagar a tus proveedores después de recibir mercadería.',
    calculo: '(CxP ÷ Compras del período) × 30',
    saludable:
      'más alto = mejor para tu caja · pero relaciones con proveedores se tensan si te pasás.',
  },
  {
    id: 'dso',
    titulo: 'DSO',
    sinonimo: 'DSO · Days Sales Outstanding · Días de Cobro',
    categoria: 'eficiencia',
    definicion:
      'Cuántos días en promedio tardás en cobrar a tus clientes después de vender.',
    calculo: '(CxC ÷ Ventas Netas) × 30',
    saludable: '≤30 días para ecommerce. Si es mayor, tu cobranza está lenta.',
    esClave: true,
  },

  // E
  {
    id: 'ebitda',
    titulo: 'EBITDA',
    sinonimo: 'EBITDA · Earnings Before Interest, Taxes, Depreciation and Amortization',
    categoria: 'rentabilidad',
    definicion:
      'Ganancia OPERATIVA real del negocio. Sin contar diferencias cambiarias, intereses ni impuestos. Mide qué tan rentable es el corazón del negocio puro.',
    calculo: 'Margen Bruto − Gastos Operativos',
    saludable: '≥15% sobre las ventas para PyME',
    esClave: true,
  },

  // L
  {
    id: 'liquidez-acida',
    titulo: 'Liquidez Ácida',
    sinonimo: 'Liquidez Ácida · Quick Ratio',
    categoria: 'liquidez',
    definicion:
      'Versión más estricta de liquidez: ignora el inventario (puede no convertirse en plata rápido). Mide si podés pagar deudas con efectivo + cobranzas.',
    calculo: '(Activo Corriente − Inventarios) ÷ Pasivo Corriente',
    saludable: '≥1.0x',
  },
  {
    id: 'liquidez-corriente',
    titulo: 'Liquidez Corriente',
    sinonimo: 'Liquidez Corriente · Current Ratio',
    categoria: 'liquidez',
    definicion:
      '¿Tenés activos a corto plazo suficientes para pagar tus deudas a corto plazo?',
    calculo: 'Activo Corriente ÷ Pasivo Corriente',
    saludable: '≥1.5x · convención contable internacional',
    esClave: true,
  },

  // M
  {
    id: 'margen-bruto',
    titulo: 'Margen Bruto',
    categoria: 'rentabilidad',
    definicion:
      'Cuánto te queda de cada venta DESPUÉS de pagar lo que costó el producto. Antes de gastos operativos.',
    calculo: 'Ventas Netas − COGS',
    saludable: '≥40% en retail/ecommerce',
    esClave: true,
  },
  {
    id: 'margen-neto',
    titulo: 'Margen Neto',
    categoria: 'rentabilidad',
    definicion:
      'Lo que REALMENTE te queda limpio después de TODOS los gastos. Es la rentabilidad final del negocio.',
    calculo: 'Utilidad Neta ÷ Ventas Netas × 100',
    saludable: '≥10% para PyME ecommerce sustentable',
  },
  {
    id: 'margen-seguridad',
    titulo: 'Margen de Seguridad',
    categoria: 'rentabilidad',
    definicion:
      'Cuánto pueden caer las ventas sin que entres en pérdida. Mide tu colchón de seguridad operativo.',
    calculo: '(Ventas − Punto Equilibrio) ÷ Ventas × 100',
    saludable: '≥20% · mayor margen = más resiliente ante shock',
  },

  // P
  {
    id: 'pasivo-corriente',
    titulo: 'Pasivo Corriente',
    categoria: 'balance',
    definicion:
      'Todo lo que tu empresa DEBE pagar en menos de 1 año: CxP a proveedores, anticipos a entregar, deudas con bancos (TC, líneas).',
  },
  {
    id: 'patrimonio',
    titulo: 'Patrimonio',
    sinonimo: 'Patrimonio · Equity',
    categoria: 'balance',
    definicion:
      'Lo que REALMENTE es de los socios. La parte de la empresa que NO se le debe a nadie.',
    calculo: 'Capital aportado + Utilidades acumuladas + Utilidad del período',
    saludable: 'que crezca por utilidades retenidas · es el "patrimonio real" de los dueños',
  },
  {
    id: 'provision-incobrables',
    titulo: 'Provisión Incobrables',
    categoria: 'balance',
    definicion:
      'Ajuste contable que reconoce que parte de las CxC probablemente NO se cobrarán. Es prudencia contable.',
    calculo: 'CxC × % configurado (3% por defecto · ajustable)',
  },
  {
    id: 'punto-equilibrio',
    titulo: 'Punto de Equilibrio',
    sinonimo: 'Punto de Equilibrio · Break-Even Point',
    categoria: 'rentabilidad',
    definicion:
      'Venta mínima del mes para cubrir TODOS los costos. Si vendés más, ganás. Si vendés menos, perdés.',
    calculo: 'Costos Fijos ÷ Margen de Contribución %',
  },

  // R
  {
    id: 'ratio-endeudamiento',
    titulo: 'Ratio de Endeudamiento',
    categoria: 'balance',
    definicion: 'De cada S/100 que tenés en activos, cuántos representan deuda.',
    calculo: 'Pasivos Totales ÷ Activos Totales × 100',
    saludable: '≤50% · arriba de eso significa que la mitad o más de tu empresa es deuda',
  },
  {
    id: 'reserva-legal',
    titulo: 'Reserva Legal',
    categoria: 'balance',
    definicion:
      'Porcentaje de las utilidades que se "reserva" obligatoriamente (típicamente 10% del capital social). Es un colchón para la empresa. No se reparte como dividendo.',
  },
  {
    id: 'roe',
    titulo: 'ROE',
    sinonimo: 'ROE · Return on Equity · Retorno sobre Patrimonio',
    categoria: 'rentabilidad',
    definicion:
      'Por cada S/100 que los socios tienen invertido en la empresa, ¿cuánto generan al año?',
    calculo: '(Utilidad Neta × 12 ÷ Patrimonio) × 100',
    saludable: '≥15% anualizado · comparar contra "qué pasaría si esa plata estuviera en un plazo fijo"',
  },
  {
    id: 'rotacion-inventario',
    titulo: 'Rotación de Inventario',
    sinonimo: 'Rotación de Inventario · Inventory Turnover',
    categoria: 'eficiencia',
    definicion:
      'Cuántas veces al año "vendés todo tu inventario y lo reponés". Mide qué tan rápido convertís stock en ventas.',
    calculo: 'COGS anual ÷ Inventario promedio',
    saludable: '≥6x para retail · bajo = stock muerto o exceso de compras',
  },

  // U
  {
    id: 'utilidad-neta',
    titulo: 'Utilidad Neta',
    categoria: 'rentabilidad',
    definicion:
      'Lo que te quedó LIMPIO al final del mes, después de pagar TODO (compras, gastos, comisiones, diferencias cambiarias, etc).',
    calculo: 'Ventas − COGS − Gastos Operativos − Otros',
    saludable: '>10% sobre las ventas para PyME ecommerce. Si es <0% perdiste plata el mes.',
    esClave: true,
  },

  // V
  {
    id: 'ventas-netas',
    titulo: 'Ventas Netas',
    categoria: 'rentabilidad',
    definicion:
      'Plata que entró por ventas, después de restar devoluciones y descuentos. Es el verdadero ingreso del mes.',
    calculo: 'Ventas Brutas − Devoluciones − Descuentos',
    saludable: 'que crezca mes a mes · si baja, revisar canal o producto',
  },
];

/**
 * Lookup rápido por ID
 */
export const GLOSARIO_BY_ID: Record<string, TerminoGlosario> = GLOSARIO_CONTABLE.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<string, TerminoGlosario>,
);

/**
 * Helper: obtener término por ID con fallback seguro
 */
export function getTermino(id: string): TerminoGlosario | undefined {
  return GLOSARIO_BY_ID[id];
}

/**
 * Helper: obtener todos los términos de una categoría
 */
export function getTerminosCategoria(categoria: GlosarioCategoria): TerminoGlosario[] {
  return GLOSARIO_CONTABLE.filter((t) => t.categoria === categoria);
}
