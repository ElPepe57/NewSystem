/**
 * Editor masivo de precios para MercadoLibre.
 * Barra flotante inferior que aparece cuando hay productos seleccionados.
 * Actualiza todas las publicaciones de cada grupo al cambiar precio.
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  DollarSign,
  Trophy,
  Percent,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useMercadoLibreStore } from '../../../store/mercadoLibreStore';
import type { PricingIntelRow } from './pricingIntel.utils';
import { calcMargin, calcMinPrice, fmtPEN, fmtPct, getMarginColor } from './pricingIntel.utils';

type BulkStrategy = 'margen' | 'buybox' | 'porcentaje';

interface BulkPriceEditorProps {
  selectedRows: PricingIntelRow[];
  onClearSelection: () => void;
}

interface PreviewRow {
  row: PricingIntelRow;
  newPrice: number;
  oldMargin: number | null;
  newMargin: number | null;
}

export const BulkPriceEditor: React.FC<BulkPriceEditorProps> = ({
  selectedRows,
  onClearSelection,
}) => {
  const { updatePrice } = useMercadoLibreStore();

  const [strategy, setStrategy] = useState<BulkStrategy>('margen');
  const [targetMargin, setTargetMargin] = useState('20');
  const [pctAdjust, setPctAdjust] = useState('0');
  const [showPreview, setShowPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  // Compute preview rows based on strategy
  const previewRows = useMemo((): PreviewRow[] => {
    return selectedRows
      .map((row) => {
        const costoRef = row.costoTotal ?? row.ctru ?? row.costoInventario;
        let newPrice = row.mlPrice;

        switch (strategy) {
          case 'margen': {
            if (costoRef == null) return null;
            const margin = parseFloat(targetMargin) || 20;
            newPrice = calcMinPrice(costoRef, margin);
            break;
          }
          case 'buybox': {
            if (row.buyBoxPriceToWin == null) return null;
            newPrice = row.buyBoxPriceToWin;
            break;
          }
          case 'porcentaje': {
            const adj = parseFloat(pctAdjust) || 0;
            newPrice = row.mlPrice * (1 + adj / 100);
            break;
          }
        }

        newPrice = Math.round(newPrice * 100) / 100;
        if (newPrice <= 0 || newPrice === row.mlPrice) return null;

        const newMargin = costoRef != null ? calcMargin(newPrice, costoRef) : null;

        return {
          row,
          newPrice,
          oldMargin: row.margenNeto,
          newMargin,
        };
      })
      .filter((r): r is PreviewRow => r !== null);
  }, [selectedRows, strategy, targetMargin, pctAdjust]);

  const handleApply = async () => {
    if (previewRows.length === 0) return;
    setApplying(true);
    setProgress(0);
    setDone(false);

    for (let i = 0; i < previewRows.length; i++) {
      const { row, newPrice } = previewRows[i];
      try {
        // Update ALL listings in the group
        for (const listingId of row.listingIds) {
          await updatePrice(listingId, newPrice);
        }
      } catch {
        // continue with next
      }
      setProgress(i + 1);
    }

    setApplying(false);
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setShowPreview(false);
      onClearSelection();
    }, 1500);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Preview panel */}
      {showPreview && (
        <div className="bg-white border-t border-gray-200 shadow-2xl max-h-[50vh] overflow-auto mx-4 md:mx-auto md:max-w-4xl rounded-t-xl">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Preview: {previewRows.length} cambio{previewRows.length !== 1 ? 's' : ''}
            </h3>
            <button onClick={() => setShowPreview(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {previewRows.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <AlertTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {strategy === 'margen' && 'Ningún producto seleccionado tiene datos de costo'}
                {strategy === 'buybox' && 'Ningún producto seleccionado tiene precio Buy Box'}
                {strategy === 'porcentaje' && 'No hay cambios de precio (ajuste = 0%)'}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500">Producto</th>
                  <th className="text-right px-4 py-2 text-gray-500">Precio Actual</th>
                  <th className="text-right px-4 py-2 text-gray-500">Nuevo Precio</th>
                  <th className="text-right px-4 py-2 text-gray-500">Margen Actual</th>
                  <th className="text-right px-4 py-2 text-gray-500">Nuevo Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {previewRows.map((pr) => (
                  <tr key={pr.row.groupKey}>
                    <td className="px-4 py-2 truncate max-w-[200px]">
                      {pr.row.mlTitle}
                      {pr.row.listings.length > 1 && (
                        <span className="ml-1 text-gray-400">({pr.row.listings.length} pub.)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmtPEN(pr.row.mlPrice)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtPEN(pr.newPrice)}</td>
                    <td className={`px-4 py-2 text-right ${getMarginColor(pr.oldMargin)}`}>{fmtPct(pr.oldMargin)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${getMarginColor(pr.newMargin)}`}>{fmtPct(pr.newMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="bg-gray-900 text-white px-4 py-3 shadow-2xl">
        <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
          {/* Count */}
          <span className="text-sm font-medium shrink-0">
            {selectedRows.length} seleccionado{selectedRows.length !== 1 ? 's' : ''}
          </span>

          {/* Strategy selector */}
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {/* Strategy buttons */}
            <div className="flex bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setStrategy('margen')}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                  strategy === 'margen' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3 h-3" />
                <span className="hidden sm:inline">Margen</span>
              </button>
              <button
                onClick={() => setStrategy('buybox')}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                  strategy === 'buybox' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3 h-3" />
                <span className="hidden sm:inline">Buy Box</span>
              </button>
              <button
                onClick={() => setStrategy('porcentaje')}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                  strategy === 'porcentaje' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Percent className="w-3 h-3" />
                <span className="hidden sm:inline">% Ajuste</span>
              </button>
            </div>

            {/* Strategy input */}
            {strategy === 'margen' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Margen:</span>
                <input
                  type="number"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(e.target.value)}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:ring-amber-500 focus:border-amber-500"
                  step="1"
                  min="1"
                  max="99"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            )}
            {strategy === 'porcentaje' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Ajuste:</span>
                <input
                  type="number"
                  value={pctAdjust}
                  onChange={(e) => setPctAdjust(e.target.value)}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:ring-amber-500 focus:border-amber-500"
                  step="1"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            )}
            {strategy === 'buybox' && (
              <span className="text-xs text-gray-400">Igualar precio para ganar Buy Box</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors"
            >
              {showPreview ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              Preview
            </button>

            <button
              onClick={handleApply}
              disabled={applying || previewRows.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                done
                  ? 'bg-green-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-white'
              }`}
            >
              {applying ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> {progress}/{previewRows.length}</>
              ) : done ? (
                <><Check className="w-3 h-3" /> Listo</>
              ) : (
                <>Aplicar ({previewRows.length})</>
              )}
            </button>

            <button
              onClick={onClearSelection}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Deseleccionar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
