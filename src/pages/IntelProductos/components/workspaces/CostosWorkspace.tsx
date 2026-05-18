/**
 * CostosWorkspace · workspace 2 · Cost Intelligence
 *
 * chk5.B9 (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-canon-productos.html · Sec 2`.
 *
 * Orquesta 3 paneles con lógica propia CI:
 *   1. EvolucionBloquesChart  · stacked bars 6 meses · gastos por bloque
 *   2. TCPAvsSBSChart          · líneas comparativas Pool USD vs TC SUNAT
 *   3. ComparativaLotesTable  · tabla de lotes del SKU foco (variance/driver)
 *
 * Cada panel maneja su propio empty state interno (siguiendo principio rector
 * de honestidad: no mostramos data inventada cuando no hay).
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowRight } from 'lucide-react';
import type { Gasto } from '../../../../types/gasto.types';
import type { Venta } from '../../../../types/venta.types';
import type { CategoriaCosto } from '../../../../types/categoriaCosto.types';
import type { PoolUSDSnapshot } from '../../../../types/rendimientoCambiario.types';
import type { SkuConCostos } from '../../utils/costIntelligence';
import {
  calcularEvolucionPorBloque,
  calcularTCPAvsSBS,
  seleccionarSkuFocoCostos,
  // chk5.C-FIX · DEUDA-CI-LEE-ALLOCATION CERRADA
  applyAllocationLens,
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_PERIOD_LABELS,
} from '../../utils/costIntelligence';
import { EvolucionBloquesChart } from './costos/EvolucionBloquesChart';
import { TCPAvsSBSChart } from './costos/TCPAvsSBSChart';
import { ComparativaLotesTable } from './costos/ComparativaLotesTable';

interface CostosWorkspaceProps {
  skus: SkuConCostos[];
  gastos: Gasto[];
  arbolCategorias: CategoriaCosto[];
  poolSnapshots: PoolUSDSnapshot[];
  /** Saldo USD actual del pool · para calcular ahorro real PEN en TCPAvsSBS */
  saldoUSDPool?: number;
  /** chk5.C-FIX · ventas para aplicar Allocation Lens canon (D-GR-7) */
  ventas?: Venta[];
}

const fmtPEN0 = (n: number): string =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);

export const CostosWorkspace: React.FC<CostosWorkspaceProps> = ({
  skus,
  gastos,
  arbolCategorias,
  poolSnapshots,
  saldoUSDPool,
  ventas = [],
}) => {
  const navigate = useNavigate();

  // chk5.C-FIX · DEUDA-CI-LEE-ALLOCATION CERRADA · lectura runtime de la política
  // canon definida en Gastos · AllocationEngineSettings (D-GR-7)
  const allocationLens = useMemo(
    () => applyAllocationLens(gastos, ventas, arbolCategorias),
    [gastos, ventas, arbolCategorias],
  );
  // SKU foco para Panel 3 · selección manual o auto (SKU con mayor variance)
  const [skuFocoIdManual, setSkuFocoIdManual] = useState<string | null>(null);

  const evolucion = useMemo(
    () => calcularEvolucionPorBloque(gastos, arbolCategorias, 6),
    [gastos, arbolCategorias]
  );

  const tcpaSerie = useMemo(
    () => calcularTCPAvsSBS(poolSnapshots, 6),
    [poolSnapshots]
  );

  const skuFoco = useMemo<SkuConCostos | null>(() => {
    if (skuFocoIdManual) {
      const encontrado = skus.find((s) => s.productoId === skuFocoIdManual);
      if (encontrado) return encontrado;
    }
    return seleccionarSkuFocoCostos(skus);
  }, [skus, skuFocoIdManual]);

  // Candidatos para el selector dropdown del Panel 3
  const candidatosLotes = useMemo(
    () => skus.filter((s) => s.lotes.length >= 2),
    [skus]
  );

  // Handler para seleccionar un SKU específico por productoId (dropdown selector)
  const handleSeleccionarSku = (productoId: string) => {
    setSkuFocoIdManual(productoId);
  };

  return (
    <div className="space-y-4">
      {/* chk5.C-FIX · Banner política Allocation Engine activa · cross-link a Gastos
          Lee `getAllocationConfig()` runtime · refleja D-GR-7 sin persistir data. */}
      <div className="bg-gradient-to-r from-teal-50/50 to-white border border-teal-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-700" />
            <span className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
              Política Allocation Engine activa
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-600">Método:</span>
            <span className="font-bold text-slate-900">{ALLOCATION_METHOD_LABELS[allocationLens.config.metodo]}</span>
          </div>
          <span className="text-slate-300">·</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-600">Período:</span>
            <span className="font-bold text-slate-900">{ALLOCATION_PERIOD_LABELS[allocationLens.config.periodo]}</span>
          </div>
          {allocationLens.hasData && (
            <>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-600">Ratio activo:</span>
                <span className="font-bold tabular-nums text-emerald-700">
                  {fmtPEN0(allocationLens.overheadPeriodoPEN)} / {fmtPEN0(allocationLens.ingresoPeriodoPEN)} = {allocationLens.ratioActivoPct.toFixed(2)}%
                </span>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/gastos')}
          className="flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800 transition-colors"
          title="Configurar política en Gastos · Política asignación"
        >
          Cambiar política
          <ArrowRight className="w-3 h-3" />
          <span className="text-[9px] text-slate-400 font-normal ml-0.5">en Gastos</span>
        </button>
      </div>

      {/* Fila 1 · 2 paneles arriba (responsive: 1 col mobile · 2 col desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EvolucionBloquesChart data={evolucion} />
        <TCPAvsSBSChart data={tcpaSerie} saldoUSDPool={saldoUSDPool} />
      </div>

      {/* Fila 2 · tabla de lotes del SKU foco · dropdown selector inline en el título */}
      <ComparativaLotesTable
        sku={skuFoco}
        candidatos={candidatosLotes}
        onSeleccionarSku={handleSeleccionarSku}
      />
    </div>
  );
};
