/**
 * Planilla.tsx — Página principal del módulo de Planilla.
 * 3 tabs: Empleados, Boletas, Adelantos.
 */
import React, { useState } from 'react';
import { Users, FileText, ArrowDownCircle } from 'lucide-react';
import { TabEmpleados } from './components/TabEmpleados';
import { TabBoletas } from './components/TabBoletas';
import { TabAdelantos } from './components/TabAdelantos';

type TabActiva = 'empleados' | 'boletas' | 'adelantos';

export const Planilla: React.FC = () => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('boletas');

  const tabs: { key: TabActiva; label: string; labelSm: string; icon: React.ReactNode }[] = [
    { key: 'empleados', label: 'Empleados', labelSm: 'Emp.', icon: <Users size={18} /> },
    { key: 'boletas', label: 'Boletas', labelSm: 'Bol.', icon: <FileText size={18} /> },
    { key: 'adelantos', label: 'Adelantos', labelSm: 'Adel.', icon: <ArrowDownCircle size={18} /> },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users size={24} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Planilla</h1>
            <p className="text-sm text-gray-500">Control de nomina, comisiones y adelantos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-4 sm:space-x-8">
          {tabs.map(({ key, label, labelSm, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabActiva(key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                tabActiva === key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{labelSm}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tabActiva === 'empleados' && <TabEmpleados />}
      {tabActiva === 'boletas' && <TabBoletas />}
      {tabActiva === 'adelantos' && <TabAdelantos />}
    </div>
  );
};
