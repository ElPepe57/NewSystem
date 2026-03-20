/**
 * Modal de detalle de pricing para un producto ML (agrupado).
 * Muestra cascada de costos CTRU, simulador de margen, y análisis Buy Box.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Trophy,
  RefreshCw,
  Check,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useMercadoLibreStore } from '../../../store/mercadoLibreStore';
import { useCTRUStore, type CTRUProductoDetalle } from '../../../store/ctruStore';
import type { PricingIntelRow } from './pricingIntel.utils';
import { calcMargin, calcMinPrice, fmtPEN, fmtPct, getMarginColor, getMarginBg } from './pricingIntel.utils';

interface PricingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: PricingIntelRow | null;
}

// ---- CASCADA DE COSTOS ----
const CostWaterfall: React.FC<{ ctru: CTRUProductoDetalle }> = ({ ctru }) => {
  const layers = [
    { label: 'Compra', value: ctru.costoCompraPENProm, pct: ctru.pctCompra, color: 'bg-blue-500' },
    { label: 'Impuesto', value: ctru.costoImpuestoPENProm, pct: ctru.pctImpuesto, color: 'bg-blue-400' },
    { label: 'Envio OC', value: ctru.costoEnvioPENProm, pct: ctru.pctEnvio, color: 'bg-cyan-500' },
    { label: 'Otros OC', value: ctru.costoOtrosPENProm, pct: ctru.pctOtros, color: 'bg-cyan-400' },
    { label: 'Flete Intl', value: ctru.costoFleteIntlPENProm, pct: ctru.pctFleteIntl, color: 'bg-teal-500' },
    { label: 'GA/GO', value: ctru.gastoGAGOProm || ctru.gastoGAGOEstimado, pct: ctru.pctGAGO, color: 'bg-amber-500' },
    { label: 'GV/GD', value: ctru.gastoGVGDProm, pct: ctru.pctGVGD, color: 'bg-red-400' },
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase">Cascada de Costos (Prom.)</h4>
      <div className="space-y-1.5">
        {layers.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${l.color} shrink-0`} />
            <span className="text-xs text-gray-600 w-20 shrink-0">{l.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className={`h-full ${l.color} rounded-full`} style={{ width: `${Math.min(l.pct, 100)}%` }} />
            </div>
            <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmtPEN(l.value)}</span>
            <span className="text-[10px] text-gray-400 w-10 text-right">{l.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="border-t border-gray-200 pt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Costo Inventario (1-5)</span>
          <span className="font-medium">{fmtPEN(ctru.costoInventarioProm)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">CTRU (1-6)</span>
          <span className="font-medium">{fmtPEN(ctru.ctruPromedio)}</span>
        </div>
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-gray-700">Costo Total Real (1-7)</span>
          <span>{fmtPEN(ctru.costoTotalRealProm)}</span>
        </div>
      </div>
    </div>
  );
};

// ---- SIMULADOR DE MARGEN ----
const MarginSimulator: React.FC<{
  row: PricingIntelRow;
  ctru: CTRUProductoDetalle | null;
}> = ({ row, ctru }) => {
  const { updatePrice } = useMercadoLibreStore();
  const [simPrice, setSimPrice] = useState(String(row.mlPrice));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSimPrice(String(row.mlPrice));
    setSaved(false);
  }, [row.mlPrice]);

  const simPriceNum = parseFloat(simPrice) || 0;
  const costoRef = row.costoTotal ?? row.ctru ?? row.costoInventario;

  const simMargen = costoRef != null ? calcMargin(simPriceNum, costoRef) : null;
  const simGanancia = costoRef != null ? simPriceNum - costoRef : null;
  const changed = simPriceNum !== row.mlPrice && simPriceNum > 0;

  const handleApply = async () => {
    if (!changed) return;
    setSaving(true);
    try {
      // Update ALL listings in the group
      for (const listingId of row.listingIds) {
        await updatePrice(listingId, simPriceNum);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error in store
    } finally {
      setSaving(false);
    }
  };

  const suggestedPrices = useMemo(() => {
    if (costoRef == null) return [];
    return [
      { label: '10%', price: calcMinPrice(costoRef, 10) },
      { label: '20%', price: calcMinPrice(costoRef, 20) },
      { label: '30%', price: calcMinPrice(costoRef, 30) },
    ];
  }, [costoRef]);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-gray-500 uppercase">Simulador de Precio</h4>

      {/* Input de precio */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Precio simulado</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">S/</span>
          <input
            type="number"
            value={simPrice}
            onChange={(e) => { setSimPrice(e.target.value); setSaved(false); }}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            step="0.01"
            min="0.01"
          />
        </div>
      </div>

      {/* Resultado del simulador */}
      {costoRef != null && (
        <div className={`rounded-lg p-3 ${getMarginBg(simMargen)}`}>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Margen estimado</span>
            <span className={`text-lg font-bold ${getMarginColor(simMargen)}`}>
              {fmtPct(simMargen)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-600">Ganancia por unidad</span>
            <span className={`text-sm font-medium ${simGanancia != null && simGanancia < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {simGanancia != null ? fmtPEN(simGanancia) : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Precios sugeridos */}
      {suggestedPrices.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1.5">Precios sugeridos por margen</label>
          <div className="flex gap-2">
            {suggestedPrices.map((sp) => (
              <button
                key={sp.label}
                onClick={() => setSimPrice(sp.price.toFixed(2))}
                className="flex-1 text-center px-2 py-2 border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors"
              >
                <p className="text-[10px] text-gray-400">Margen {sp.label}</p>
                <p className="text-sm font-semibold text-gray-900">{fmtPEN(sp.price)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buy Box price */}
      {row.buyBoxPriceToWin != null && (
        <button
          onClick={() => setSimPrice(row.buyBoxPriceToWin!.toFixed(2))}
          className="w-full flex items-center justify-between px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-800">Precio para ganar Buy Box</span>
          </div>
          <span className="text-sm font-bold text-amber-900">{fmtPEN(row.buyBoxPriceToWin)}</span>
        </button>
      )}

      {/* Botón aplicar */}
      <button
        onClick={handleApply}
        disabled={!changed || saving}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {saving ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Actualizando{row.listings.length > 1 ? ` ${row.listings.length} pub.` : ''} en ML...</>
        ) : saved ? (
          <><Check className="w-4 h-4" /> Precio actualizado</>
        ) : (
          <><DollarSign className="w-4 h-4" /> Actualizar precio en ML{row.listings.length > 1 ? ` (${row.listings.length} pub.)` : ''}</>
        )}
      </button>
    </div>
  );
};

// ---- BUY BOX ANALYSIS ----
const BuyBoxAnalysis: React.FC<{ row: PricingIntelRow }> = ({ row }) => {
  if (!row.hasCatalogo) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-400">Buy Box solo disponible para publicaciones de catálogo</p>
      </div>
    );
  }

  if (!row.buyBoxStatus) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-400">Sin datos de Buy Box. Sincroniza primero.</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    winning: 'Ganando Buy Box',
    competing: 'Perdiendo Buy Box',
    sharing_first_place: 'Compartiendo Buy Box',
    listed: 'Sin competencia',
  };

  const statusColor: Record<string, string> = {
    winning: 'text-green-700 bg-green-50 border-green-200',
    competing: 'text-red-700 bg-red-50 border-red-200',
    sharing_first_place: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    listed: 'text-gray-500 bg-gray-50 border-gray-200',
  };

  const visitShareLabel: Record<string, string> = {
    maximum: 'Máximo',
    medium: 'Medio',
    minimum: 'Mínimo',
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-gray-500 uppercase">Análisis Buy Box</h4>

      {/* Status card */}
      <div className={`rounded-lg border p-3 ${statusColor[row.buyBoxStatus] || statusColor.listed}`}>
        <p className="text-sm font-semibold">{statusLabel[row.buyBoxStatus] || row.buyBoxStatus}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase">Tu precio</p>
          <p className="text-sm font-semibold">{fmtPEN(row.mlPrice)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase">Precio ganador</p>
          <p className="text-sm font-semibold">{fmtPEN(row.buyBoxWinnerPrice)}</p>
        </div>
        {row.buyBoxPriceToWin != null && (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-[10px] text-amber-600 uppercase">Precio para ganar</p>
            <p className="text-sm font-bold text-amber-800">{fmtPEN(row.buyBoxPriceToWin)}</p>
          </div>
        )}
        {row.buyBoxVisitShare && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase">Tráfico</p>
            <p className="text-sm font-semibold">{visitShareLabel[row.buyBoxVisitShare] || row.buyBoxVisitShare}</p>
          </div>
        )}
      </div>

      {/* Margin at buy box price */}
      {row.margenAtBuyBoxPrice != null && (
        <div className={`rounded-lg p-3 ${getMarginBg(row.margenAtBuyBoxPrice)}`}>
          <div className="flex items-center gap-2">
            {row.margenAtBuyBoxPrice < 0 && <AlertTriangle className="w-4 h-4 text-red-500" />}
            <div>
              <p className="text-xs text-gray-500">Margen si igualo Buy Box</p>
              <p className={`text-lg font-bold ${getMarginColor(row.margenAtBuyBoxPrice)}`}>
                {fmtPct(row.margenAtBuyBoxPrice)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- MODAL PRINCIPAL ----
export const PricingDetailModal: React.FC<PricingDetailModalProps> = ({ isOpen, onClose, row }) => {
  const { productosDetalle } = useCTRUStore();

  const ctru = useMemo(() => {
    if (!row?.productoId) return null;
    return productosDetalle.find((p) => p.productoId === row.productoId) ?? null;
  }, [row?.productoId, productosDetalle]);

  if (!row) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pricing Intelligence"
      subtitle={row.mlTitle}
      size="lg"
    >
      <div className="space-y-6">
        {/* Product header */}
        <div className="flex items-center gap-3">
          {row.mlThumbnail && (
            <img src={row.mlThumbnail} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{row.mlTitle}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {row.hasCatalogo && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Catálogo</span>
              )}
              {row.hasClasica && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Clásica</span>
              )}
              <span className="text-xs text-gray-400">{row.productoSku || row.mlSku}</span>
              {row.listings.length > 1 && (
                <span className="text-xs text-gray-400">· {row.listings.length} publicaciones</span>
              )}
              <a
                href={row.mlPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
              >
                Ver en ML <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Current state summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase">Precio ML</p>
            <p className="text-base font-bold text-gray-900">{fmtPEN(row.mlPrice)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase">Costo Total</p>
            <p className="text-base font-bold text-gray-600">{row.costoTotal != null ? fmtPEN(row.costoTotal) : '—'}</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${getMarginBg(row.margenNeto)}`}>
            <p className="text-[10px] text-gray-400 uppercase">Margen Neto</p>
            <p className={`text-base font-bold ${getMarginColor(row.margenNeto)}`}>{fmtPct(row.margenNeto)}</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${getMarginBg(row.margenBruto)}`}>
            <p className="text-[10px] text-gray-400 uppercase">Margen Bruto</p>
            <p className={`text-base font-bold ${getMarginColor(row.margenBruto)}`}>{fmtPct(row.margenBruto)}</p>
          </div>
        </div>

        {/* Two columns on desktop: Cost waterfall + Simulator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Cost waterfall */}
          <div>
            {ctru ? (
              <CostWaterfall ctru={ctru} />
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {row.vinculado ? 'Sin datos CTRU disponibles' : 'Producto no vinculado al ERP'}
                </p>
              </div>
            )}
          </div>

          {/* Right: Margin simulator */}
          <div>
            <MarginSimulator row={row} ctru={ctru} />
          </div>
        </div>

        {/* Buy Box analysis */}
        <BuyBoxAnalysis row={row} />
      </div>
    </Modal>
  );
};
