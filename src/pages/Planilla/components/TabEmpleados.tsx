/**
 * TabEmpleados.tsx — Lista de usuarios con estado de perfil laboral.
 */
import React, { useEffect, useState } from 'react';
import { UserPlus, Settings, Search, User, Briefcase, TrendingUp } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import { usePlanillaStore } from '../../../store/planillaStore';
import { TIPO_EMPLEADO_LABELS } from '../../../types/planilla.types';
import { formatCurrency } from '../../../utils/format';
import { EmpleadoForm } from './EmpleadoForm';
import type { EmpleadoConPerfil } from '../../../types/planilla.types';

export const TabEmpleados: React.FC = () => {
  const { empleados, loadingEmpleados, fetchEmpleados } = usePlanillaStore();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'con_perfil' | 'sin_perfil'>('todos');
  const [empleadoEditando, setEmpleadoEditando] = useState<EmpleadoConPerfil | null>(null);

  useEffect(() => { fetchEmpleados(); }, []);

  const filtrados = empleados.filter(e => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!e.displayName.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
    }
    if (filtro === 'con_perfil') return !!e.perfilLaboral;
    if (filtro === 'sin_perfil') return !e.perfilLaboral;
    return true;
  });

  const conPerfil = empleados.filter(e => e.perfilLaboral).length;

  if (loadingEmpleados) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-3" />
        Cargando usuarios...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs text-slate-500">Total usuarios</div>
          <div className="text-2xl font-bold">{empleados.length}</div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
          <div className="text-xs text-teal-600">Con perfil laboral</div>
          <div className="text-2xl font-bold text-teal-700">{conPerfil}</div>
        </div>
        <div className="bg-slate-50 border rounded-lg p-3">
          <div className="text-xs text-slate-500">Sin perfil</div>
          <div className="text-2xl font-bold text-slate-400">{empleados.length - conPerfil}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as any)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="todos">Todos</option>
          <option value="con_perfil">Con perfil laboral</option>
          <option value="sin_perfil">Sin perfil laboral</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.map(emp => {
          const p = emp.perfilLaboral;
          return (
            <div
              key={emp.uid}
              className={`border rounded-lg p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                p ? 'border-teal-200 bg-teal-50/30' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${p ? 'bg-teal-100' : 'bg-slate-100'}`}>
                  <User size={20} className={p ? 'text-teal-600' : 'text-slate-400'} />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{emp.displayName}</div>
                  <div className="text-xs text-slate-500">{emp.email} — {emp.cargo || emp.role}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {p ? (
                  <>
                    <Badge variant="info">{TIPO_EMPLEADO_LABELS[p.tipo]}</Badge>
                    {p.salarioBase != null && p.salarioBase > 0 && (
                      <span className="text-sm font-mono text-slate-700 flex items-center gap-1">
                        <Briefcase size={14} />
                        {formatCurrency(p.salarioBase, p.monedaSalario)}
                      </span>
                    )}
                    {p.esquemaComision && (
                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <TrendingUp size={14} />
                        {p.esquemaComision.tipo === 'porcentaje_venta'
                          ? `${p.esquemaComision.porcentaje}%`
                          : `S/ ${p.esquemaComision.montoFijo}/venta`}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Sin perfil laboral</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmpleadoEditando(emp)}
                >
                  <Settings size={16} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <EmpleadoForm
        empleado={empleadoEditando}
        open={!!empleadoEditando}
        onClose={() => setEmpleadoEditando(null)}
      />
    </div>
  );
};
