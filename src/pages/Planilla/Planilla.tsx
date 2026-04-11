/**
 * Planilla.tsx — Pagina principal del modulo de Planilla.
 * 3 tabs: Empleados, Boletas, Adelantos.
 */
import React, { useState } from 'react';
import { Users, FileText, ArrowDownCircle } from 'lucide-react';
import { PageShell, PageHeader, Toolbar } from '../../design-system';
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
    <PageShell>
      <PageHeader
        title="Planilla"
        subtitle="Control de nomina, comisiones y adelantos"
        icon={Users}
      />

      <Toolbar />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8">
          {tabs.map(({ key, label, labelSm, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabActiva(key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                tabActiva === key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
    </PageShell>
  );
};
