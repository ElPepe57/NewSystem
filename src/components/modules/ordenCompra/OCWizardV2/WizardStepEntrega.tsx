import React, { useMemo } from 'react';
import {
  Truck, UserCheck, Send, ShoppingBag, Package, MapPin,
  DollarSign, Home, Building2, AlertCircle, Zap, ChevronRight,
  Plane, Car,
} from 'lucide-react';
import { cn } from '../../../../design-system';
import type { QuienPagaFlete } from '../../../../types/ordenCompra.types';

// ─── Types ────────────────────────────────────────────────────────

/** Tramo 1: Cómo sale del proveedor */
export type SalidaProveedor = 'proveedor_envia' | 'recojo_en_origen';

/** Tramo 2: Cómo llega a Perú */
export type LlegadaPeru = 'ddp_directo' | 'viajero' | 'courier_internacional' | 'ya_en_peru';

/** Tramo 3: Cómo llega a tu almacén */
export type UltimaMilla = 'entrega_domicilio' | 'yo_recojo';

export interface ConfigLogistica {
  // Tramo 1: Salida del proveedor
  salidaProveedor: SalidaProveedor | null;
  fleteProveedorIncluido: boolean | null; // ¿El shipping del proveedor está incluido?

  // Tramo 2: Llegada a Perú
  llegadaPeru: LlegadaPeru | null;
  // Si viajero o courier: quién es
  colaboradorNombre: string;

  // Tramo 3: Última milla
  ultimaMilla: UltimaMilla | null;
}

export const emptyConfig: ConfigLogistica = {
  salidaProveedor: null,
  fleteProveedorIncluido: null,
  llegadaPeru: null,
  colaboradorNombre: '',
  ultimaMilla: null,
};

interface WizardStepEntregaProps {
  config: ConfigLogistica;
  onChange: (config: ConfigLogistica) => void;
}

// ─── Derive legacy types for downstream compatibility ─────────────

export function deriveModoFromConfig(config: ConfigLogistica): {
  modoEntregaDetallado: 'ddp_directo' | 'via_viajero' | 'via_courier' | 'recojo_propio' | null;
  quienPagaFlete: QuienPagaFlete | null;
} {
  if (!config.llegadaPeru) return { modoEntregaDetallado: null, quienPagaFlete: null };

  const modoMap: Record<LlegadaPeru, 'ddp_directo' | 'via_viajero' | 'via_courier' | 'recojo_propio'> = {
    ddp_directo: 'ddp_directo',
    viajero: 'via_viajero',
    courier_internacional: 'via_courier',
    ya_en_peru: 'recojo_propio',
  };

  let flete: QuienPagaFlete | null = null;
  if (config.llegadaPeru === 'ddp_directo') flete = 'proveedor';
  else if (config.llegadaPeru === 'viajero') flete = 'viajero';
  else flete = 'comprador';

  return {
    modoEntregaDetallado: modoMap[config.llegadaPeru],
    quienPagaFlete: flete,
  };
}

/** Get summary of consequences */
export function getConsequences(config: ConfigLogistica): string[] {
  const items: string[] = [];

  // Tramo 1
  if (config.salidaProveedor === 'proveedor_envia') {
    if (config.fleteProveedorIncluido === true) {
      items.push('Shipping del proveedor incluido en el precio');
    } else if (config.fleteProveedorIncluido === false) {
      items.push('El proveedor cobra shipping — registrar como cargo de la OC');
    }
  } else if (config.salidaProveedor === 'recojo_en_origen') {
    items.push('Alguien recoge en el almacén del proveedor');
  }

  // Tramo 2
  if (config.llegadaPeru === 'ddp_directo') {
    items.push('El proveedor envía directo a Perú (DDP) — flete internacional incluido');
    items.push('Al confirmar: se crea envío automático (Proveedor → Almacén)');
  } else if (config.llegadaPeru === 'viajero') {
    items.push(`Viajero${config.colaboradorNombre ? ` (${config.colaboradorNombre})` : ''} trae el pedido a Perú`);
    items.push('Al confirmar: se crea envío automático (Proveedor → Viajero)');
    items.push('Costo del viajero se registra al recibir el envío');
  } else if (config.llegadaPeru === 'courier_internacional') {
    items.push('Courier internacional trae a Perú — tú pagas el flete');
    items.push('Al confirmar: se crea envío automático con el courier');
  } else if (config.llegadaPeru === 'ya_en_peru') {
    items.push('Proveedor local o mercadería ya en Perú');
    items.push('No se crea envío internacional — solo logística local');
  }

  // Tramo 3
  if (config.ultimaMilla === 'yo_recojo') {
    items.push('Al recibir: se exigirá registrar costo de recojo local');
  } else if (config.ultimaMilla === 'entrega_domicilio') {
    items.push('Entrega directa en almacén — sin costo de recojo');
  }

  return items;
}

// ─── Option Button ────────────────────────────────────────────────

interface OptionProps {
  icon: typeof Truck;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}

const Option: React.FC<OptionProps> = ({ icon: Icon, label, hint, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left w-full',
      selected
        ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
    )}
  >
    <div className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
      selected ? 'bg-teal-100' : 'bg-slate-100',
    )}>
      <Icon className={cn('w-4 h-4', selected ? 'text-teal-600' : 'text-slate-500')} />
    </div>
    <div className="min-w-0">
      <span className={cn('text-sm font-medium', selected ? 'text-teal-900' : 'text-slate-900')}>
        {label}
      </span>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  </button>
);

// ─── Question Section ─────────────────────────────────────────────

interface QuestionProps {
  number: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  visible: boolean;
  answered: boolean;
}

const Question: React.FC<QuestionProps> = ({ number, title, subtitle, children, visible, answered }) => {
  if (!visible) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
          answered ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600',
        )}>
          {number}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="pl-8 space-y-2">
        {children}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

export const WizardStepEntrega: React.FC<WizardStepEntregaProps> = ({ config, onChange }) => {
  const consequences = useMemo(() => getConsequences(config), [config]);

  // Visibility logic
  const show = {
    salidaProveedor: true,
    fleteProveedor: config.salidaProveedor === 'proveedor_envia',
    llegadaPeru: config.salidaProveedor !== null && (config.salidaProveedor !== 'proveedor_envia' || config.fleteProveedorIncluido !== null),
    ultimaMilla: config.llegadaPeru !== null && config.llegadaPeru !== 'ddp_directo',
  };

  const update = (partial: Partial<ConfigLogistica>) => {
    const next = { ...config, ...partial };
    // Reset downstream when upstream changes
    if ('salidaProveedor' in partial) {
      next.fleteProveedorIncluido = null;
      next.llegadaPeru = null;
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
    }
    if ('fleteProveedorIncluido' in partial) {
      next.llegadaPeru = null;
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
    }
    if ('llegadaPeru' in partial) {
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
      // DDP = entrega a domicilio implícita
      if (partial.llegadaPeru === 'ddp_directo') {
        next.ultimaMilla = 'entrega_domicilio';
      }
    }
    onChange(next);
  };

  // Count answered for step label
  const questionsAnswered = [
    config.salidaProveedor,
    config.llegadaPeru,
    config.ultimaMilla,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Ruta de la mercadería</h2>
        <p className="text-sm text-slate-500 mt-1">Define cómo llega el pedido desde el proveedor hasta tu almacén</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">

        {/* TRAMO 1: Salida del proveedor */}
        <Question
          number={1}
          title="¿Cómo sale del proveedor?"
          subtitle="Tramo 1: Del almacén del proveedor al punto de salida"
          visible={show.salidaProveedor}
          answered={!!config.salidaProveedor}
        >
          <Option icon={Truck} label="El proveedor lo envía" hint="El proveedor despacha desde su almacén (Amazon, Asian Beauty, etc.)" selected={config.salidaProveedor === 'proveedor_envia'} onClick={() => update({ salidaProveedor: 'proveedor_envia' })} />
          <Option icon={MapPin} label="Alguien lo recoge en origen" hint="Un viajero, agente o yo recogemos en el almacén/fábrica del proveedor" selected={config.salidaProveedor === 'recojo_en_origen'} onClick={() => update({ salidaProveedor: 'recojo_en_origen' })} />
        </Question>

        {/* TRAMO 1.5: ¿El shipping del proveedor está incluido? */}
        {show.fleteProveedor && (
          <Question
            number={2}
            title="¿El shipping del proveedor está incluido?"
            subtitle="Ej: Amazon cobra Shipping & Handling, pero con Subscribe & Save es gratis"
            visible={show.fleteProveedor}
            answered={config.fleteProveedorIncluido !== null}
          >
            <Option icon={DollarSign} label="Sí, el shipping está incluido" hint="No hay cargo adicional por el envío del proveedor (ej: Subscribe & Save)" selected={config.fleteProveedorIncluido === true} onClick={() => update({ fleteProveedorIncluido: true })} />
            <Option icon={AlertCircle} label="No, el proveedor cobra shipping" hint="Hay un cargo de shipping que se debe registrar (ej: Amazon Shipping $15)" selected={config.fleteProveedorIncluido === false} onClick={() => update({ fleteProveedorIncluido: false })} />
          </Question>
        )}

        {/* TRAMO 2: ¿Cómo llega a Perú? */}
        <Question
          number={show.fleteProveedor ? 3 : 2}
          title="¿Cómo llega a Perú?"
          subtitle="Tramo 2: Transporte internacional"
          visible={show.llegadaPeru}
          answered={!!config.llegadaPeru}
        >
          <Option icon={Truck} label="El proveedor envía directo a Perú (DDP)" hint="El proveedor incluye el flete internacional. Llega a tu puerta sin costo extra." selected={config.llegadaPeru === 'ddp_directo'} onClick={() => update({ llegadaPeru: 'ddp_directo' })} />
          <Option icon={UserCheck} label="Un viajero lo trae" hint="Una persona que viaja lo trae en su equipaje o carga" selected={config.llegadaPeru === 'viajero'} onClick={() => update({ llegadaPeru: 'viajero' })} />
          <Option icon={Plane} label="Courier internacional (yo contrato)" hint="Yo contrato DHL, FedEx, etc. para traerlo a Perú" selected={config.llegadaPeru === 'courier_internacional'} onClick={() => update({ llegadaPeru: 'courier_internacional' })} />
          <Option icon={Building2} label="Ya está en Perú" hint="Proveedor local o la mercadería ya se encuentra en el país" selected={config.llegadaPeru === 'ya_en_peru'} onClick={() => update({ llegadaPeru: 'ya_en_peru' })} />
        </Question>

        {/* Viajero/Courier name input */}
        {(config.llegadaPeru === 'viajero' || config.llegadaPeru === 'courier_internacional') && (
          <div className="pl-8">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {config.llegadaPeru === 'viajero' ? '¿Quién es el viajero?' : '¿Qué courier?'}
            </label>
            <input
              type="text"
              value={config.colaboradorNombre}
              onChange={(e) => onChange({ ...config, colaboradorNombre: e.target.value })}
              placeholder={config.llegadaPeru === 'viajero' ? 'Ej: Angie Price' : 'Ej: DHL, FedEx'}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}

        {/* TRAMO 3: Última milla */}
        <Question
          number={show.fleteProveedor ? 4 : 3}
          title="¿Cómo llega a tu almacén?"
          subtitle="Tramo 3: Última milla en Perú"
          visible={show.ultimaMilla}
          answered={!!config.ultimaMilla}
        >
          <Option icon={Home} label="Me lo entregan en mi almacén" hint="El transportista/viajero entrega en la puerta de mi almacén" selected={config.ultimaMilla === 'entrega_domicilio'} onClick={() => update({ ultimaMilla: 'entrega_domicilio' })} />
          <Option icon={Car} label="Yo lo recojo" hint="Voy a recoger al aeropuerto, terminal, casilla del viajero, etc." selected={config.ultimaMilla === 'yo_recojo'} onClick={() => update({ ultimaMilla: 'yo_recojo' })} />
        </Question>

        {/* Consequences panel */}
        {consequences.length > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Lo que va a pasar</span>
            </div>
            {consequences.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-teal-800">{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
