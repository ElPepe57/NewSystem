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
import type { Gasto } from '../../../../types/gasto.types';
import type { CategoriaCosto } from '../../../../types/categoriaCosto.types';
import type { PoolUSDSnapshot } from '../../../../types/rendimientoCambiario.types';
import type { SkuConCostos } from '../../utils/costIntelligence';
import {
  calcularEvolucionPorBloque,
  calcularTCPAvsSBS,
  seleccionarSkuFocoCostos,
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
}

export const CostosWorkspace: React.FC<CostosWorkspaceProps> = ({
  skus,
  gastos,
  arbolCategorias,
  poolSnapshots,
  saldoUSDPool,
}) => {
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

  // Handler para botón "Cambiar SKU" · ciclar entre SKUs con ≥2 lotes
  const handleCambiarSku = () => {
    const candidatos = skus.filter((s) => s.lotes.length >= 2);
    if (candidatos.length <= 1) return;
    const currentIdx = skuFoco
      ? candidatos.findIndex((c) => c.productoId === skuFoco.productoId)
      : -1;
    const nextIdx = (currentIdx + 1) % candidatos.length;
    setSkuFocoIdManual(candidatos[nextIdx].productoId);
  };

  return (
    <div className="space-y-4">
      {/* Fila 1 · 2 paneles arriba (responsive: 1 col mobile · 2 col desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EvolucionBloquesChart data={evolucion} />
        <TCPAvsSBSChart data={tcpaSerie} saldoUSDPool={saldoUSDPool} />
      </div>

      {/* Fila 2 · tabla de lotes del SKU foco */}
      <ComparativaLotesTable
        sku={skuFoco}
        onCambiarSku={
          skus.filter((s) => s.lotes.length >= 2).length > 1
            ? handleCambiarSku
            : undefined
        }
      />
    </div>
  );
};
