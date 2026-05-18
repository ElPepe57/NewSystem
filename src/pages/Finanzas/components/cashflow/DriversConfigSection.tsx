/**
 * DriversConfigSection — chk5.D-S3.quater · SF5
 *
 * Sección informativa canon MOCK 9 §2 · explica los 6 drivers de proyección
 * subyacentes con su lógica heurística actual.
 *
 * Mientras `DEUDA-DRIVERS-CONFIG` no esté implementada (chk5.D-S4) · esta
 * sección es read-only. En S4 cada card debe volverse editable (% · frecuencia).
 *
 * 6 drivers:
 *   1. Ingresos por venta (emerald)
 *   2. Sueldos + alquiler (rose)
 *   3. TC ciclo cerrado (amber)
 *   4. Compras OC programadas (blue)
 *   5. Liquidación recaudador (purple)
 *   6. Settles Stripe (sky)
 */

import React from 'react';
import {
  TrendingUp,
  Building,
  CreditCard,
  Package,
  Truck,
  Smartphone,
  Info,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface DriverConfigInfo {
  /** ID estable del driver */
  id: string;
  /** Color tinte del card */
  color: 'emerald' | 'rose' | 'amber' | 'blue' | 'purple' | 'sky';
  /** Icon lucide */
  icon: React.ComponentType<{ className?: string }>;
  /** Label corto · ej "Ingresos por venta" */
  label: string;
  /** Descripción larga · explica heurística */
  descripcion: string;
}

export interface DriversConfigSectionProps {
  /** Override de drivers · si no se pasa · usa defaults canon */
  drivers?: DriverConfigInfo[];
  /** Click "Configurar" en card individual · pendiente S4 */
  onConfigurarDriver?: (driver: DriverConfigInfo) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// DRIVERS DEFAULT · canon MOCK 9 §2
// ═════════════════════════════════════════════════════════════════════════

const DRIVERS_DEFAULT: DriverConfigInfo[] = [
  {
    id: 'ingresos_venta',
    color: 'emerald',
    icon: TrendingUp,
    label: 'Ingresos por venta',
    descripcion:
      'Promedio últimos 90d · ajustable por estacionalidad · escenario base usa media móvil 6 sem',
  },
  {
    id: 'sueldos_alquiler',
    color: 'rose',
    icon: Building,
    label: 'Sueldos + alquiler',
    descripcion:
      'Fijo mensual estimado · pago día 28 · alquiler día 1 · NO ajustable sin reestructuración',
  },
  {
    id: 'tc_ciclo',
    color: 'amber',
    icon: CreditCard,
    label: 'TC ciclo cerrado',
    descripcion:
      'Promedio últimos 3 ciclos · vence día configurado por TC · marketing variable + SaaS fijos',
  },
  {
    id: 'oc_programadas',
    color: 'blue',
    icon: Package,
    label: 'Compras OC programadas',
    descripcion:
      'OCs abiertas con saldo + estimación reposición · vencimientos según contra-entrega',
  },
  {
    id: 'recaudador',
    color: 'purple',
    icon: Truck,
    label: 'Liquidación recaudador',
    descripcion:
      'Quincenal · cobros − servicios descontados − liquidaciones efectuadas',
  },
  {
    id: 'stripe_settles',
    color: 'sky',
    icon: Smartphone,
    label: 'Settles wallet (Stripe)',
    descripcion: 'Diario auto · estimado post-comisión 4.5% + S/0.60 fijo por txn',
  },
];

// ═════════════════════════════════════════════════════════════════════════
// MAPS de color
// ═════════════════════════════════════════════════════════════════════════

const CARD_BG: Record<DriverConfigInfo['color'], string> = {
  emerald: 'bg-emerald-50 ring-emerald-200/50',
  rose: 'bg-rose-50 ring-rose-200/50',
  amber: 'bg-amber-50 ring-amber-200/50',
  blue: 'bg-blue-50 ring-blue-200/50',
  purple: 'bg-purple-50 ring-purple-200/50',
  sky: 'bg-sky-50 ring-sky-200/50',
};

const CARD_LABEL: Record<DriverConfigInfo['color'], string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  blue: 'text-blue-700',
  purple: 'text-purple-700',
  sky: 'text-sky-700',
};

const CARD_TEXT: Record<DriverConfigInfo['color'], string> = {
  emerald: 'text-emerald-900',
  rose: 'text-rose-900',
  amber: 'text-amber-900',
  blue: 'text-blue-900',
  purple: 'text-purple-900',
  sky: 'text-sky-900',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const DriversConfigSection: React.FC<DriversConfigSectionProps> = ({
  drivers = DRIVERS_DEFAULT,
  onConfigurarDriver,
}) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700">
          § 2 · Drivers de proyección · modelo subyacente
        </span>
        <div className="flex-1 h-px bg-indigo-200" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <p className="text-[11px] text-slate-500 mb-4">
          El cash flow se construye con drivers configurables · cada categoría tiene su propia regla
          de proyección. <strong>Próximamente</strong> podrás ajustar % o frecuencia por driver
          directamente desde esta vista.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drivers.map((d) => (
            <DriverCard key={d.id} driver={d} onClick={onConfigurarDriver} />
          ))}
        </div>
        <div className="bg-slate-100 ring-1 ring-slate-200 rounded-xl p-3 mt-3 flex items-start gap-2 text-[11px]">
          <Info className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
          <div className="text-slate-800">
            <strong>Configurar drivers:</strong> cada driver se podrá editar individualmente cuando
            esté disponible (estacionalidad · campañas · nuevos contratos). Hasta entonces · la
            proyección usa heurísticas razonables desde data histórica real.
          </div>
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE DRIVER CARD
// ═════════════════════════════════════════════════════════════════════════

interface DriverCardProps {
  driver: DriverConfigInfo;
  onClick?: (d: DriverConfigInfo) => void;
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, onClick }) => {
  const Icon = driver.icon;
  const interactivo = !!onClick;
  return (
    <div
      className={`ring-1 rounded-xl p-3 ${CARD_BG[driver.color]} ${
        interactivo ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''
      }`}
      onClick={() => onClick?.(driver)}
      role={interactivo ? 'button' : undefined}
      tabIndex={interactivo ? 0 : undefined}
    >
      <div
        className={`text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5 ${CARD_LABEL[driver.color]}`}
      >
        <Icon className="w-3 h-3" />
        {driver.label}
      </div>
      <div className={`text-[11px] ${CARD_TEXT[driver.color]}`}>{driver.descripcion}</div>
    </div>
  );
};
