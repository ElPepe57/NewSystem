import React from 'react';
import { Truck, UserCheck, Send, ShoppingBag } from 'lucide-react';
import { DeliveryOptionCard } from './DeliveryOptionCard';
import type { ModoEntregaDetallado } from '../../../../types/ordenCompra.types';

interface WizardStepEntregaProps {
  value: ModoEntregaDetallado | null;
  onChange: (modo: ModoEntregaDetallado) => void;
}

const OPTIONS: Array<{
  value: ModoEntregaDetallado;
  icon: typeof Truck;
  title: string;
  subtitle: string;
}> = [
  {
    value: 'ddp_directo',
    icon: Truck,
    title: 'Me lo traen directamente',
    subtitle: 'El proveedor entrega en mi puerta (DDP). Sin intermediarios.',
  },
  {
    value: 'via_viajero',
    icon: UserCheck,
    title: 'Lo recoge un viajero',
    subtitle: 'Un viajero recoge el pedido y lo trae en su equipaje.',
  },
  {
    value: 'via_courier',
    icon: Send,
    title: 'Lo envían por courier',
    subtitle: 'Un courier externo (DHL, FedEx, etc.) hace la entrega.',
  },
  {
    value: 'recojo_propio',
    icon: ShoppingBag,
    title: 'Lo recojo yo',
    subtitle: 'Yo organizo el recojo desde la fábrica o almacén.',
  },
];

export const WizardStepEntrega: React.FC<WizardStepEntregaProps> = ({ value, onChange }) => (
  <div className="space-y-6">
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-900">¿Cómo te llega el pedido?</h2>
      <p className="text-sm text-slate-500 mt-1">Esto determina cómo se configura el envío automáticamente</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
      {OPTIONS.map(opt => (
        <DeliveryOptionCard
          key={opt.value}
          icon={opt.icon}
          title={opt.title}
          subtitle={opt.subtitle}
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  </div>
);
