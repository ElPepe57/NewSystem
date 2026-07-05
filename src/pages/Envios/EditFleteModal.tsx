import React, { useState, useMemo } from "react";
import { DollarSign, Banknote, Check, AlertTriangle } from "lucide-react";
import { FormModalV2 } from "../../design-system";
import { useProductoStore } from "../../store/productoStore";
import type { Envio } from "../../types/envio.types";

interface EditFleteModalProps {
  transferencia: Envio;
  onClose: () => void;
  onConfirm: (costoFletePorProducto: Record<string, number>) => Promise<void>;
}

export const EditFleteModal: React.FC<EditFleteModalProps> = ({
  transferencia,
  onClose,
  onConfirm,
}) => {
  const { productos } = useProductoStore();
  const productosMap = useMemo(() => {
    const map = new Map<string, typeof productos[0]>();
    productos.forEach(p => map.set(p.id, p));
    return map;
  }, [productos]);

  const [submitting, setSubmitting] = useState(false);
  // Input: flete POR UNIDAD — el total se calcula automáticamente
  const [fletePorUnidadMap, setFletePorUnidadMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const producto of transferencia.productosSummary) {
      const unidadesProducto = transferencia.unidades.filter(u => u.productoId === producto.productoId);
      const fleteTotal = unidadesProducto.reduce((sum, u) => sum + (u.costoFleteUSD || 0), 0);
      const cantidad = producto.cantidad || 1;
      if (fleteTotal > 0) {
        initial[producto.productoId] = fleteTotal / cantidad;
      }
    }
    return initial;
  });

  // Calcular totales por producto para pasar al onConfirm
  const fletesPorProducto: Record<string, number> = {};
  for (const producto of transferencia.productosSummary) {
    const porUnidad = fletePorUnidadMap[producto.productoId] || 0;
    fletesPorProducto[producto.productoId] = porUnidad * (producto.cantidad || 1);
  }

  const totalFlete = Object.values(fletesPorProducto).reduce((sum, v) => sum + (v || 0), 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(fletesPorProducto);
    } catch {
      setSubmitting(false);
    }
  };

  const yaRecibida =
    transferencia.estado === 'recibida_completa' || transferencia.estado === 'recibida_parcial';

  return (
    <FormModalV2
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Editar flete"
      subtitle={`${transferencia.numeroEnvio} · por unidad · total auto`}
      icon={Banknote}
      iconTone="orange"
      color="orange"
      size="lg"
      submitLabel="Guardar flete"
      submitIcon={Check}
      loading={submitting}
      disabled={submitting}
    >
      <div className="space-y-4">
        {/* Info del envío */}
        <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <span className="text-slate-500">Destino:</span>{' '}
            <span className="font-medium text-slate-800">{transferencia.destinoCasillaNombre}</span>
          </div>
          <div>
            <span className="text-slate-500">Unidades:</span>{' '}
            <span className="font-medium text-slate-800 tabular-nums">{transferencia.totalUnidades}</span>
          </div>
          {transferencia.colaboradorNombre && (
            <div>
              <span className="text-slate-500">Viajero:</span>{' '}
              <span className="font-medium text-slate-800">{transferencia.colaboradorNombre}</span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Flete actual:</span>{' '}
            <span className="font-medium text-slate-800 tabular-nums">
              {transferencia.costoFleteTotal && transferencia.costoFleteTotal > 0
                ? `$${transferencia.costoFleteTotal.toFixed(2)}`
                : 'Sin flete'}
            </span>
          </div>
        </div>

        {/* Flete por producto · filas compactas con input por unidad */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto">
          {transferencia.productosSummary.map((producto) => {
            const cantidad = producto.cantidad || 1;
            const fletePorUnidad = fletePorUnidadMap[producto.productoId] || 0;
            const productoFull = productosMap.get(producto.productoId);
            const usdLb =
              productoFull?.pesoLibras && fletePorUnidad > 0
                ? fletePorUnidad / productoFull.pesoLibras
                : 0;

            return (
              <div
                key={producto.productoId}
                className="flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-slate-800 truncate">
                    {productoFull?.nombreComercial || producto.nombre}
                    <span className="text-slate-400"> · {producto.sku}</span>
                  </div>
                  {usdLb > 0 && (
                    <div className="text-[10px] text-slate-400 tabular-nums">${usdLb.toFixed(2)} USD/lb</div>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">×{cantidad}</span>
                <div className="relative w-28 flex-shrink-0">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="number"
                    value={fletePorUnidadMap[producto.productoId] || ''}
                    onChange={(e) => {
                      const valor = parseFloat(e.target.value) || 0;
                      setFletePorUnidadMap(prev => ({ ...prev, [producto.productoId]: valor }));
                    }}
                    className="w-full pl-6 pr-2 py-1.5 text-[13px] tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">/u</span>
              </div>
            );
          })}
        </div>

        {/* Total flete · amber (dinero · semántico) */}
        <div className="flex items-center justify-between bg-amber-50 ring-1 ring-amber-200/60 rounded-lg px-3.5 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold">Total flete</span>
          <span className="text-[15px] font-bold tabular-nums text-amber-900">${totalFlete.toFixed(2)}</span>
        </div>

        {/* Aviso: envío ya recibido → recalcula CTRU */}
        {yaRecibida && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700">
              Este envío ya fue recibido. Al actualizar el flete se recalculará el CTRU de las unidades afectadas.
            </p>
          </div>
        )}
      </div>
    </FormModalV2>
  );
};
