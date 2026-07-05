import React, { useMemo, useState } from "react";
import { Stamp, Package, FileText, Link, AlertTriangle, Check } from "lucide-react";
import { FormModalV2 } from "../../design-system";
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
 *
 * Migrado a FormModalV2 (chrome orange · operativo).
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

  const totalSeleccionadas = unidadIdsSeleccionadas.length;
  const totalIncidencias = incidenciasAduana.length;

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

  // Estado vacío: sin incidencias de aduana pendientes
  if (incidenciasAduana.length === 0) {
    return (
      <FormModalV2
        isOpen={true}
        onClose={onClose}
        onSubmit={onClose}
        title="Liberar aduana"
        subtitle="Sin unidades retenidas"
        icon={Stamp}
        iconTone="orange"
        color="orange"
        size="md"
        submitLabel="Cerrar"
        submitIcon={Check}
      >
        <p className="text-[12px] text-slate-500 text-center py-4">
          No hay unidades retenidas en aduana pendientes de liberación.
        </p>
      </FormModalV2>
    );
  }

  const todasSeleccionadas = totalSeleccionadas === totalIncidencias;

  return (
    <FormModalV2
      isOpen={true}
      onClose={onClose}
      onSubmit={handleConfirm}
      title="Liberar aduana"
      subtitle={`${envio.numeroEnvio} · ${totalIncidencias} ud${totalIncidencias !== 1 ? 's' : ''} retenida${totalIncidencias !== 1 ? 's' : ''}`}
      icon={Stamp}
      iconTone="orange"
      color="orange"
      size="lg"
      submitLabel={`Liberar ${totalSeleccionadas} unidad${totalSeleccionadas !== 1 ? 'es' : ''}${gastosParsed > 0 ? ` · S/ ${gastosParsed.toFixed(2)}` : ''}`}
      submitIcon={Stamp}
      loading={submitting}
      disabled={!puedeConfirmar}
    >
      <div className="space-y-3">
        {/* Banner explicativo · amber (retención = alerta operativa de negocio, no chrome) */}
        <div className="flex items-start gap-3 bg-amber-50 ring-1 ring-amber-200/60 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold text-amber-900">
              {totalIncidencias} unidad{totalIncidencias !== 1 ? 'es' : ''} retenida{totalIncidencias !== 1 ? 's' : ''} en aduana
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5 leading-snug">
              Selecciona cuáles se liberaron y registra los gastos pagados.
              Las unidades quedarán pendientes de recepción física.
            </div>
          </div>
        </div>

        {/* Selección de unidades */}
        <div>
          {/* Fila seleccionar todas — estilo mockup M1 */}
          <button
            type="button"
            onClick={() => toggleTodas(!todasSeleccionadas)}
            className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50/50 hover:bg-slate-100/60 transition-colors mb-2"
          >
            <span className="flex items-center gap-2.5">
              <span
                className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                  todasSeleccionadas
                    ? 'bg-orange-600'
                    : 'border border-slate-300 bg-white'
                }`}
              >
                {todasSeleccionadas && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="text-[12px] text-slate-700">
                {todasSeleccionadas ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </span>
            </span>
            <span className="text-[12px] font-bold tabular-nums text-slate-900">
              {totalSeleccionadas} / {totalIncidencias}
            </span>
          </button>

          {/* Lista de unidades por producto */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {incidenciasPorProducto.map(([productoId, incs]) => {
              const pFull = productosMap.get(productoId);
              const nombre = pFull?.nombreComercial || incs[0].productoNombre || incs[0].sku || 'Producto';
              const descripcionProd = pFull ? getDescripcionProducto(pFull) : undefined;
              return (
                <div key={productoId} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                  {/* Cabecera del producto */}
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-slate-800 truncate">{nombre}</span>
                    {descripcionProd && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">{descripcionProd}</span>
                    )}
                    <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-500 flex-shrink-0">
                      {incs.length} retenida{incs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Filas de unidad */}
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
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => inc.unidadId && toggleUnidad(inc.unidadId)}
                            disabled={!inc.unidadId}
                            className="h-4 w-4 text-orange-600 rounded focus:ring-orange-500 focus:ring-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[11px] text-slate-600">
                              {unidadEnvio?.codigoUnidad && (
                                <span className="font-mono text-slate-700">{unidadEnvio.codigoUnidad}</span>
                              )}
                              {inc.sku && (
                                <span className="text-slate-400">{inc.sku}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 tabular-nums">
                              Retenida:{' '}
                              {inc.fechaRetencion
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

        {/* Gastos de liberación · mockup M1: stcap label + input */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Gastos de liberación (S/) <span className="font-normal normal-case text-slate-400">— opcional</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={gastosPEN}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^\d*[.,]?\d*$/.test(v)) setGastosPEN(v);
            }}
            className="mt-1 w-40 px-3 py-2 border border-slate-200 rounded-lg text-[12px] tabular-nums bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: 85.00"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Tasas, aranceles, brokerage. Se registra como <strong className="text-slate-500">Costo Landed · Aduana</strong> y se prorratea.
          </p>
        </div>

        {/* Descripción del cargo */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Descripción del cargo <span className="font-normal normal-case text-slate-400">— opcional</span>
          </span>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-[12px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ej: DUA simplificada, agente de aduanas"
          />
        </div>

        {/* Documento (DUA) · mockup M1 */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Documento (DUA) <span className="font-normal normal-case text-slate-400">— opcional</span>
          </span>
          <div className="mt-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:ring-1 focus-within:ring-orange-500 focus-within:border-orange-500">
            <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="url"
              value={documentoURL}
              onChange={(e) => setDocumentoURL(e.target.value)}
              className="flex-1 min-w-0 text-[12px] bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-400"
              placeholder="URL del documento…"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            DUA, constancia de liberación u otro documento probatorio.
          </p>
        </div>

        {/* Prorrateo estimado · amber (dinero · semántico) — mockup M1 */}
        {gastosParsed > 0 && totalSeleccionadas > 0 && envio.totalUnidades > 0 && (
          <div>
            <div className="flex items-center justify-between bg-amber-50 ring-1 ring-amber-200/60 rounded-lg px-3 py-2">
              <span className="text-[11px] text-amber-700 font-medium">Prorrateo estimado</span>
              <span className="text-[13px] font-bold tabular-nums text-amber-900">
                S/ {(gastosParsed / envio.totalUnidades).toFixed(2)}/u
              </span>
            </div>
            <p className="text-[10px] text-amber-600 mt-1">
              Sobre las {envio.totalUnidades} unidades totales del envío, no solo las liberadas.
            </p>
          </div>
        )}
      </div>
    </FormModalV2>
  );
};
