import React, { useMemo } from 'react';
import {
  Truck, UserCheck, Send, ShoppingBag, Package, MapPin,
  DollarSign, Home, Building2, AlertCircle, Zap, ChevronRight,
} from 'lucide-react';
import { cn } from '../../../../design-system';
import type { ModoEntregaDetallado, QuienPagaFlete } from '../../../../types/ordenCompra.types';

// ─── Types ────────────────────────────────────────────────────────

export type QuienEnvia = 'proveedor' | 'yo_organizo';
export type DestinoEntrega = 'almacen_directo' | 'casilla_intermedia' | 'recojo_punto';
export type QuienTransporta = 'courier' | 'viajero' | 'yo_mismo' | 'proveedor_incluye';
export type EntregaDomicilio = 'si' | 'no_recoger';

export interface ConfigLogistica {
  quienEnvia: QuienEnvia | null;
  destinoEntrega: DestinoEntrega | null;
  quienTransporta: QuienTransporta | null;
  quienPagaFlete: QuienPagaFlete | null;
  entregaDomicilio: EntregaDomicilio | null;
}

interface WizardStepEntregaProps {
  config: ConfigLogistica;
  onChange: (config: ConfigLogistica) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Derive which questions to show based on current answers */
function getVisibleQuestions(config: ConfigLogistica) {
  const show = {
    quienEnvia: true,
    destinoEntrega: !!config.quienEnvia,
    quienTransporta: !!config.destinoEntrega,
    quienPagaFlete: !!config.quienTransporta && config.quienTransporta !== 'proveedor_incluye',
    entregaDomicilio: !!config.quienTransporta && config.destinoEntrega !== 'recojo_punto',
  };
  return show;
}

/** Map the smart form answers to the legacy ModoEntregaDetallado + QuienPagaFlete */
export function deriveModoFromConfig(config: ConfigLogistica): {
  modoEntregaDetallado: ModoEntregaDetallado | null;
  quienPagaFlete: QuienPagaFlete | null;
} {
  if (!config.quienTransporta) return { modoEntregaDetallado: null, quienPagaFlete: null };

  const modoMap: Record<QuienTransporta, ModoEntregaDetallado> = {
    proveedor_incluye: 'ddp_directo',
    viajero: 'via_viajero',
    courier: 'via_courier',
    yo_mismo: 'recojo_propio',
  };

  let flete: QuienPagaFlete | null = config.quienPagaFlete;
  if (config.quienTransporta === 'proveedor_incluye') flete = 'proveedor';

  return {
    modoEntregaDetallado: modoMap[config.quienTransporta],
    quienPagaFlete: flete,
  };
}

/** Get summary of what will happen */
export function getConsequences(config: ConfigLogistica): string[] {
  const items: string[] = [];

  if (config.quienTransporta === 'proveedor_incluye') {
    items.push('Al confirmar se crea envío automático (Proveedor → Almacén)');
    items.push('Sin costo de flete adicional');
  } else if (config.quienTransporta === 'viajero') {
    items.push('Al confirmar se crea envío automático (Proveedor → Viajero)');
    items.push('Deberás seleccionar el viajero en productos');
    items.push('Se registrará costo de flete del viajero');
  } else if (config.quienTransporta === 'courier') {
    items.push('Al confirmar se crea envío automático con el courier');
    items.push('Se registrará costo de flete internacional');
  } else if (config.quienTransporta === 'yo_mismo') {
    items.push('No se crea envío automático — tú creas los envíos');
    items.push('Tú gestionas todos los costos de transporte');
  }

  if (config.entregaDomicilio === 'no_recoger') {
    items.push('Al recibir: se exigirá registrar costo de recojo');
  }

  if (config.destinoEntrega === 'casilla_intermedia') {
    items.push('Puede requerir un 2do envío (casilla → almacén)');
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
  children: React.ReactNode;
  visible: boolean;
  answered: boolean;
}

const Question: React.FC<QuestionProps> = ({ number, title, children, visible, answered }) => {
  if (!visible) return null;
  return (
    <div className={cn(
      'transition-all duration-300',
      answered ? 'opacity-100' : 'opacity-100',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
          answered ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600',
        )}>
          {number}
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="pl-8 space-y-2">
        {children}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

export const WizardStepEntrega: React.FC<WizardStepEntregaProps> = ({ config, onChange }) => {
  const visible = useMemo(() => getVisibleQuestions(config), [config]);
  const consequences = useMemo(() => getConsequences(config), [config]);

  const update = (partial: Partial<ConfigLogistica>) => {
    const next = { ...config, ...partial };
    // Reset downstream answers when upstream changes
    if ('quienEnvia' in partial) {
      next.destinoEntrega = null;
      next.quienTransporta = null;
      next.quienPagaFlete = null;
      next.entregaDomicilio = null;
    }
    if ('destinoEntrega' in partial) {
      next.quienTransporta = null;
      next.quienPagaFlete = null;
      next.entregaDomicilio = null;
    }
    if ('quienTransporta' in partial) {
      next.quienPagaFlete = partial.quienTransporta === 'proveedor_incluye' ? 'proveedor' : null;
      next.entregaDomicilio = null;
    }
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Configuración de Entrega</h2>
        <p className="text-sm text-slate-500 mt-1">Responde las preguntas para configurar el envío automáticamente</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Q1: ¿Quién envía? */}
        <Question number={1} title="¿Quién envía el pedido?" visible={visible.quienEnvia} answered={!!config.quienEnvia}>
          <Option icon={Truck} label="El proveedor lo envía" hint="El proveedor despacha desde su almacén" selected={config.quienEnvia === 'proveedor'} onClick={() => update({ quienEnvia: 'proveedor' })} />
          <Option icon={ShoppingBag} label="Yo organizo el envío" hint="Yo coordino cómo traer la mercadería" selected={config.quienEnvia === 'yo_organizo'} onClick={() => update({ quienEnvia: 'yo_organizo' })} />
        </Question>

        {/* Q2: ¿A dónde llega? */}
        <Question number={2} title="¿A dónde llega el pedido?" visible={visible.destinoEntrega} answered={!!config.destinoEntrega}>
          <Option icon={Home} label="Directo a mi almacén" hint="Llega directamente a mi almacén en Lima" selected={config.destinoEntrega === 'almacen_directo'} onClick={() => update({ destinoEntrega: 'almacen_directo' })} />
          <Option icon={Building2} label="A una casilla o punto intermedio" hint="Llega a una casilla de un viajero, agente o almacén temporal" selected={config.destinoEntrega === 'casilla_intermedia'} onClick={() => update({ destinoEntrega: 'casilla_intermedia' })} />
          <Option icon={MapPin} label="Lo recojo en otro punto" hint="Yo voy a recogerlo a un aeropuerto, almacén del proveedor, etc." selected={config.destinoEntrega === 'recojo_punto'} onClick={() => update({ destinoEntrega: 'recojo_punto' })} />
        </Question>

        {/* Q3: ¿Quién gestiona el transporte? */}
        <Question number={3} title="¿Quién gestiona el transporte?" visible={visible.quienTransporta} answered={!!config.quienTransporta}>
          <Option icon={Package} label="El proveedor se encarga de todo" hint="El proveedor contrata y paga el courier. El flete está incluido en el precio (DDP)." selected={config.quienTransporta === 'proveedor_incluye'} onClick={() => update({ quienTransporta: 'proveedor_incluye' })} />
          <Option icon={UserCheck} label="Un viajero lo trae" hint="Una persona que viaja recoge el pedido y lo trae en su equipaje" selected={config.quienTransporta === 'viajero'} onClick={() => update({ quienTransporta: 'viajero' })} />
          <Option icon={Send} label="Yo contrato un courier" hint="Yo contrato y pago DHL, FedEx u otro courier para que lo traigan" selected={config.quienTransporta === 'courier'} onClick={() => update({ quienTransporta: 'courier' })} />
          <Option icon={ShoppingBag} label="Yo lo recojo personalmente" hint="Yo voy a buscar la mercadería y la transporto" selected={config.quienTransporta === 'yo_mismo'} onClick={() => update({ quienTransporta: 'yo_mismo' })} />
        </Question>

        {/* Q4: ¿Quién paga el flete? */}
        <Question number={4} title="¿Quién paga el flete?" visible={visible.quienPagaFlete} answered={!!config.quienPagaFlete}>
          <Option icon={DollarSign} label="Yo pago el flete" hint="El costo de transporte corre por mi cuenta" selected={config.quienPagaFlete === 'comprador'} onClick={() => update({ quienPagaFlete: 'comprador' })} />
          {config.quienTransporta === 'viajero' && (
            <Option icon={UserCheck} label="El viajero cobra por separado" hint="El viajero cobra una tarifa por traer el pedido" selected={config.quienPagaFlete === 'viajero'} onClick={() => update({ quienPagaFlete: 'viajero' })} />
          )}
        </Question>

        {/* Q5: ¿Es entrega a domicilio? */}
        <Question number={5} title="¿El pedido llega hasta tu almacén?" visible={visible.entregaDomicilio} answered={!!config.entregaDomicilio}>
          <Option icon={Home} label="Sí, llega directo" hint="Me lo entregan en la puerta de mi almacén" selected={config.entregaDomicilio === 'si'} onClick={() => update({ entregaDomicilio: 'si' })} />
          <Option icon={MapPin} label="No, hay que ir a recogerlo" hint="Debo ir a recoger al aeropuerto, terminal, casilla, etc." selected={config.entregaDomicilio === 'no_recoger'} onClick={() => update({ entregaDomicilio: 'no_recoger' })} />
        </Question>

        {/* Consequences summary */}
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
