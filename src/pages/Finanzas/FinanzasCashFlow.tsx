/**
 * FinanzasCashFlow — Imp-L11 · página dedicada al cash flow ejecutivo
 *
 * Reemplaza la asignación previa de /finanzas/cash-flow → Tesoreria
 * (que renderizaba TODOS los tabs de tesorería). Ahora la ruta muestra
 * únicamente el dashboard ejecutivo M9.
 *
 * Para acceder a movimientos/conversiones/transferencias se navega a
 * /tesoreria (la página propia). Esta página queda para análisis
 * ejecutivo de flujo de caja.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Wallet } from 'lucide-react';
import { useTesoreriaStore } from '../../store/tesoreriaStore';
import { CashFlowExecutivePanel } from './components/CashFlowExecutivePanel';

const FinanzasCashFlow: React.FC = () => {
  const fetchAll = useTesoreriaStore((s) => s.fetchAll);
  const cuentasLength = useTesoreriaStore((s) => s.cuentas.length);
  const movimientosLength = useTesoreriaStore((s) => s.movimientos.length);

  useEffect(() => {
    if (cuentasLength === 0 || movimientosLength === 0) {
      void fetchAll();
    }
  }, [cuentasLength, movimientosLength, fetchAll]);

  return (
    <>
      {/* Panel ejecutivo · Imp-L9 */}
      <CashFlowExecutivePanel />

      {/* Footer con link a Tesorería */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              ¿Necesitas operar movimientos?
            </div>
            <div className="text-xs text-slate-500">
              Para ver detalle de movimientos, registrar conversiones, transferencias o pagos masivos, ir al módulo Tesorería.
            </div>
          </div>
        </div>
        <Link
          to="/tesoreria"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-all shadow-sm"
        >
          Ir a Tesorería
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </>
  );
};

export default FinanzasCashFlow;
