import React from 'react';
import { BadgeDollarSign, Wallet, UserCheck } from 'lucide-react';
import { DeliveryOptionCard } from './DeliveryOptionCard';
import type { ModoEntregaDetallado, QuienPagaFlete } from '../../../../types/ordenCompra.types';

interface WizardStepFleteProps {
  value: QuienPagaFlete | null;
  onChange: (quien: QuienPagaFlete) => void;
  modoEntrega: ModoEntregaDetallado | null;
}

export const WizardStepFlete: React.FC<WizardStepFleteProps> = ({ value, onChange, modoEntrega }) => {
  const showViajeroOption = modoEntrega === 'via_viajero';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">¿Quién paga el envío?</h2>
        <p className="text-sm text-slate-500 mt-1">Esto determina si hay costos de flete adicionales</p>
      </div>
      <div className={`grid grid-cols-1 ${showViajeroOption ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 max-w-2xl mx-auto`}>
        <DeliveryOptionCard
          icon={BadgeDollarSign}
          title="El proveedor lo incluye"
          subtitle="El flete ya está incluido en el precio del producto"
          selected={value === 'proveedor'}
          onClick={() => onChange('proveedor')}
        />
        <DeliveryOptionCard
          icon={Wallet}
          title="Yo pago el flete"
          subtitle="Pago el flete por separado al courier o transportista"
          selected={value === 'comprador'}
          onClick={() => onChange('comprador')}
        />
        {showViajeroOption && (
          <DeliveryOptionCard
            icon={UserCheck}
            title="El viajero cobra"
            subtitle="El viajero cobra una tarifa por llevar el pedido"
            selected={value === 'viajero'}
            onClick={() => onChange('viajero')}
          />
        )}
      </div>
    </div>
  );
};
