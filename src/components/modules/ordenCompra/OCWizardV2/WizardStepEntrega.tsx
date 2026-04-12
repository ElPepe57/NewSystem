import React from 'react';
import {
  Truck, UserCheck, Send, ShoppingBag,
  Zap, DollarSign, Route, Package, AlertCircle, Users
} from 'lucide-react';
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
  example: string;
  consequences: Array<{
    icon: typeof Zap;
    text: string;
    type: 'auto' | 'required' | 'info';
  }>;
}> = [
  {
    value: 'ddp_directo',
    icon: Truck,
    title: 'Me lo traen directamente',
    subtitle: 'El proveedor envía hasta mi almacén. Flete incluido en el precio.',
    example: 'Asian Beauty envía DDP via DHL a Lima',
    consequences: [
      { icon: Zap, text: 'Al confirmar: se crea envío automático (Proveedor → Almacén)', type: 'auto' },
      { icon: DollarSign, text: 'Sin costo de flete adicional (incluido en precio)', type: 'info' },
      { icon: Route, text: '1 solo envío, recepción directa en almacén', type: 'info' },
    ],
  },
  {
    value: 'via_viajero',
    icon: UserCheck,
    title: 'Lo recoge un viajero',
    subtitle: 'Un viajero recoge el pedido y lo trae en su próximo viaje.',
    example: 'Amazon → Angie (California) → Lima',
    consequences: [
      { icon: Users, text: 'Deberás seleccionar el viajero en el siguiente paso', type: 'required' },
      { icon: Zap, text: 'Al confirmar: se crea envío automático (Proveedor → Viajero)', type: 'auto' },
      { icon: DollarSign, text: 'El viajero cobra flete por separado al entregar', type: 'required' },
      { icon: Route, text: 'Puede requerir 2+ envíos (viajero → almacén)', type: 'info' },
    ],
  },
  {
    value: 'via_courier',
    icon: Send,
    title: 'Lo envían por courier',
    subtitle: 'Un courier internacional (DHL, FedEx, etc.) trae el pedido.',
    example: 'Proveedor despacha via FedEx a Lima',
    consequences: [
      { icon: Users, text: 'Deberás especificar el courier en el siguiente paso', type: 'required' },
      { icon: Zap, text: 'Al confirmar: se crea envío automático con el courier', type: 'auto' },
      { icon: DollarSign, text: 'Flete internacional se paga por separado', type: 'required' },
      { icon: Route, text: '1 envío directo a almacén', type: 'info' },
    ],
  },
  {
    value: 'recojo_propio',
    icon: ShoppingBag,
    title: 'Lo recojo yo',
    subtitle: 'Yo organizo cómo traer la mercadería. Múltiples etapas posibles.',
    example: 'Compra EXW: recojo en fábrica → agente → aduana → almacén',
    consequences: [
      { icon: AlertCircle, text: 'No se crea envío automático — tú creas los envíos manualmente', type: 'required' },
      { icon: DollarSign, text: 'Tú gestionas todos los costos de transporte', type: 'required' },
      { icon: Route, text: 'Puede requerir múltiples envíos con distintos transportistas', type: 'info' },
    ],
  },
];

export const WizardStepEntrega: React.FC<WizardStepEntregaProps> = ({ value, onChange }) => (
  <div className="space-y-6">
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-900">¿Cómo te llega el pedido?</h2>
      <p className="text-sm text-slate-500 mt-1">Cada opción configura automáticamente el flujo de envío y costos</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
      {OPTIONS.map(opt => (
        <DeliveryOptionCard
          key={opt.value}
          icon={opt.icon}
          title={opt.title}
          subtitle={opt.subtitle}
          example={opt.example}
          consequences={opt.consequences}
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  </div>
);
