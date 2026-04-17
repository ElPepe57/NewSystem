import React, { useMemo, useState } from "react";
import { ShieldAlert, CheckCircle, Package, FileText } from "lucide-react";
import { Modal, Button, Badge } from "../../components/common";
import type { Envio, IncidenciaEnvio } from "../../types/envio.types";
import type { Producto } from "../../types/producto.types";
import { getDescripcionProducto } from "../../utils/producto.helpers";

interface LiberarAduanaModalProps {
  envio: Envio;
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onConfirm: (data: {
    unidadIds: string[];
    gastosLiberacionPEN: number;
    documentoLiberacion?: string;
    descripcion?: string;
  }) => Promise<void>;
}

/**
 * S40 — Modal para liberar unidades retenidas en aduana.
 *
 * Se abre desde `EnvioDetailModal` cuando el envío tiene incidencias de tipo 'aduana'
 * (o legacy 'otro' con descripción que indica aduana) sin resolver.
 *
 * Acciones:
 *  - Selecciona qué unidades retenidas se liberaron (checkbox)
 *  - Ingresa los gastos de liberación en PEN (tasas, aranceles, brokerage, etc.)
 *  - Registra una descripción y opcionalmente un documento de evidencia (DUA, constancia)
 *  - Al confirmar: resuelve las incidencias, crea CostoLanded categoría Aduana,
 *    y reactiva las unidades para que puedan recibirse en la siguiente recepción.
 */
export const LiberarAduanaModal: React.FC<LiberarAduanaModalProps> = ({
  envio,
  productosMap,
  onClose,
  onConfirm,
}) => {
  // Incidencias de aduana sin resolver (tipo 'aduana' nuevo o legacy 'otro')
  const incidenciasAduana = useMemo<IncidenciaEnvio[]>(() => {
    // S40: detección simplificada — post-cleanup todas las incidencias aduana usan tipo='aduana'
    return (envio.incidencias || []).filter(inc => !inc.resuelta && inc.tipo === 'aduana');
  }, [envio.incidencias]);

  // Selección por unidad — default: todas seleccionadas
  const [seleccionadas, setSeleccionadas] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const inc of incidenciasAduana) {
      if (inc.unidadId) init[inc.unidadId] = true;
    }
    return init;
  });

  const [gastosPEN, setGastosPEN] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
  const [documentoURL, setDocumentoURL] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const unidadIdsSeleccionadas = Object.entries(seleccionadas)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const gastosParsed = gastosPEN ? parseFloat(gastosPEN.replace(',', '.')) : 0;
  const gastosValidos = !gastosPEN || (!isNaN(gastosParsed) && gastosParsed >= 0);
  const puedeConfirmar = unidadIdsSeleccionadas.length > 0 && gastosValidos && !submitting;

  const toggleUnidad = (unidadId: string) => {
    setSeleccionadas(prev => ({ ...prev, [unidadId]: !prev[unidadId] }));
  };

  const toggleTodas = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const inc of incidenciasAduana) {
      if (inc.unidadId) next[inc.unidadId] = checked;
    }
    setSeleccionadas(next);
  };

  const handleConfirm = async () => {
    if (!puedeConfirmar) return;
    setSubmitting(true);
    try {
      await onConfirm({
        unidadIds: unidadIdsSeleccionadas,
        gastosLiberacionPEN: gastosParsed,
        documentoLiberacion: documentoURL.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Agrupar incidencias por producto para visualización
  const incidenciasPorProducto = useMemo(() => {
    const map = new Map<string, IncidenciaEnvio[]>();
    for (const inc of incidenciasAduana) {
      const key = inc.productoId || 'sin_producto';
      const arr = map.get(key) || [];
      arr.push(inc);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [incidenciasAduana]);

  const totalSeleccionadas = unidadIdsSeleccionadas.length;
  const totalIncidencias = incidenciasAduana.length;

  if (incidenciasAduana.length === 0) {
    return (
      <Modal isOpen onClose={onClose} title="Liberar aduana" size="md">
        <div className="p-4 text-center text-sm text-slate-500">
          No hay unidades retenidas en aduana pendientes de liberación.
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={`Liberar unidades retenidas — ${envio.numeroEnvio}`} size="lg">
      <div className="space-y-4">
        {/* Banner explicativo */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-amber-900">
              {totalIncidencias} unidad{totalIncidencias !== 1 ? 'es' : ''} retenida{totalIncidencias !== 1 ? 's' : ''} en aduana
            </div>
            <div className="text-xs text-amber-700 mt-0.5">
              Selecciona cuáles se liberaron y registra los gastos pagados.
              Las unidades quedarán pendientes de recepción física en la próxima recepción del envío.
            </div>
          </div>
        </div>

        {/* Selección de unidades */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-800">Unidades a liberar</h4>
            <button
              type="button"
              onClick={() => toggleTodas(totalSeleccionadas !== totalIncidencias)}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium"
            >
              {totalSeleccionadas === totalIncidencias ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2">
            {incidenciasPorProducto.map(([productoId, incs]) => {
              const pFull = productosMap.get(productoId);
              const nombre = pFull?.nombreComercial || incs[0].productoNombre || incs[0].sku || 'Producto';
              const descripcionProd = pFull ? getDescripcionProducto(pFull) : undefined;
              return (
                <div key={productoId} className="border border-slate-100 rounded-lg bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-medium text-slate-800">{nombre}</span>
                      {descripcionProd && (
                        <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{descripcionProd}</span>
                      )}
                      <Badge variant="warning" size="sm">{incs.length} retenida{incs.length !== 1 ? 's' : ''}</Badge>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {incs.map(inc => {
                      const unidadId = inc.unidadId || inc.id;
                      const checked = !!seleccionadas[unidadId];
                      const unidadEnvio = inc.unidadId
                        ? envio.unidades.find(u => u.unidadId === inc.unidadId)
                        : undefined;
                      return (
                        <label
                          key={inc.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-amber-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => inc.unidadId && toggleUnidad(inc.unidadId)}
                            disabled={!inc.unidadId}
                            className="h-4 w-4 text-teal-600 rounded"
                          />
                          <div className="flex-1 min-w-0 text-xs text-slate-600">
                            {unidadEnvio?.codigoUnidad && (
                              <span className="font-mono text-slate-700">{unidadEnvio.codigoUnidad}</span>
                            )}
                            {inc.sku && (
                              <span className="ml-2 text-slate-400">{inc.sku}</span>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Retenida: {inc.fechaRetencion
                                ? inc.fechaRetencion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
                                : inc.fechaRegistro.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gastos de liberación */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Gastos de liberación (S/) <span className="text-slate-400">— opcional</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={gastosPEN}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*[.,]?\d*$/.test(v)) setGastosPEN(v);
              }}
              className="w-40 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              placeholder="Ej: 85.00"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tasas, aranceles, brokerage. Se registra como <strong>Costo Landed categoría Aduana</strong> y se prorratea.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descripción del cargo <span className="text-slate-400">— opcional</span>
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              placeholder="Ej: DUA simplificada, agente de aduanas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              URL de documento de liberación <span className="text-slate-400 font-normal">— opcional</span>
            </label>
            <input
              type="url"
              value={documentoURL}
              onChange={(e) => setDocumentoURL(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              placeholder="https://..."
            />
            <p className="text-xs text-slate-500 mt-1">
              DUA, constancia de liberación u otro documento probatorio.
            </p>
          </div>
        </div>

        {/* Preview por unidad */}
        {gastosParsed > 0 && totalSeleccionadas > 0 && envio.totalUnidades > 0 && (
          <div className="text-xs text-slate-600 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
            Prorrateo estimado: S/ {(gastosParsed / envio.totalUnidades).toFixed(2)} por unidad del envío
            <span className="text-slate-500"> (sobre las {envio.totalUnidades} unidades totales, no solo las liberadas)</span>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!puedeConfirmar}>
            {submitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Procesando...
              </span>
            ) : (
              <span className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Liberar {totalSeleccionadas} unidad{totalSeleccionadas !== 1 ? 'es' : ''}
                {gastosParsed > 0 && <span className="ml-1">· S/ {gastosParsed.toFixed(2)}</span>}
              </span>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
