/**
 * TabProveedores · Sub-vista del Modal Investigación Completo
 *
 * Mockup canónico: docs/mockups/productos/25-investigacion-tab-proveedores.html
 *
 * Lista de proveedores con ranking, costo, lead time, score histórico.
 * El #1 (Top Elección) viene expandido por default con detalle (min orden, forma pago,
 * CTRU estimado, margen proyectado, notas, acciones).
 * Los demás vienen colapsados — click expande/contrae.
 */

import React, { useState } from 'react';
import {
  Plus,
  Award,
  Building,
  Star,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import type { ProveedorInvestigacion } from './types';

interface TabProveedoresProps {
  proveedores: ProveedorInvestigacion[];
  onAgregarProveedor?: () => void;
  onCrearOC?: (proveedorId: string) => void;
  onVerHistorico?: (proveedorId: string) => void;
  /** Click en el card abre el modal de edición */
  onEditarProveedor?: (proveedorId: string) => void;
}

function StarsRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3 h-3 ${
            n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
          }`}
        />
      ))}
      <span className="text-[11px] font-bold text-slate-700 ml-1 tabular-nums">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

export function TabProveedores({
  proveedores,
  onAgregarProveedor,
  onCrearOC,
  onVerHistorico,
  onEditarProveedor,
}: TabProveedoresProps) {
  const [expandidoId, setExpandidoId] = useState<string | null>(
    proveedores.find((p) => p.esTopEleccion)?.id ?? proveedores[0]?.id ?? null,
  );

  const toggle = (id: string) => setExpandidoId((curr) => (curr === id ? null : id));

  return (
    <div className="space-y-4">
      {/* Header tab */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {proveedores.length} proveedor{proveedores.length === 1 ? '' : 'es'} analizado
            {proveedores.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranking por costo + lead time + score histórico
          </p>
        </div>
        <button
          onClick={onAgregarProveedor}
          className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-colors flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar proveedor
        </button>
      </div>

      {/* Lista de proveedores */}
      <div className="space-y-3">
        {proveedores.map((prov) => {
          const expandido = expandidoId === prov.id;
          const top = prov.esTopEleccion;

          return (
            <div
              key={prov.id}
              className={`rounded-xl overflow-hidden transition-colors ${
                top
                  ? 'bg-emerald-50 border-2 border-emerald-300'
                  : 'bg-white border border-slate-200'
              }`}
            >
              {/* Cabecera clickable */}
              <div
                onClick={() => toggle(prov.id)}
                className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  !top && 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    top ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {prov.ranking}
                </span>
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    top ? 'bg-emerald-100' : 'bg-slate-100'
                  }`}
                >
                  {top ? (
                    <Award className="w-5 h-5 text-emerald-700" />
                  ) : (
                    <Building className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold ${top ? 'text-slate-900' : 'text-slate-900'}`}>
                      {prov.nombre}
                    </span>
                    {top && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                        TOP ELECCIÓN
                      </span>
                    )}
                    {prov.sinStock && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Sin stock
                      </span>
                    )}
                    {prov.rating !== undefined && top ? (
                      <StarsRow rating={prov.rating} />
                    ) : prov.rating !== undefined ? (
                      <span className="text-[11px] text-slate-500">★ {prov.rating.toFixed(1)}</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                    {prov.ocsHistoricas !== undefined && (
                      <>{prov.ocsHistoricas} OCs históricas</>
                    )}
                    {prov.ultimaOC && (
                      <>
                        {' '}
                        · Última: {prov.ultimaOC}
                      </>
                    )}
                    {prov.notas && top && <> · {prov.notas.slice(0, 30)}</>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    $ {prov.costoUnidadUSD.toFixed(2)}
                    <span className="text-slate-400 text-xs">/u</span>
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      top ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    Lead {prov.leadTimeDias} días
                  </div>
                </div>
                {expandido ? (
                  <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
              </div>

              {/* Detalle expandido */}
              {expandido && (
                <div
                  className={`border-t bg-white px-4 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs ${
                    top ? 'border-emerald-200' : 'border-slate-200'
                  }`}
                >
                  {prov.minOrdenUSD !== undefined && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        Min. orden
                      </div>
                      <div className="text-sm font-bold tabular-nums">
                        $ {prov.minOrdenUSD.toLocaleString('es-PE')}
                      </div>
                    </div>
                  )}
                  {prov.formaPago && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        Forma pago
                      </div>
                      <div className="text-sm font-medium">{prov.formaPago}</div>
                    </div>
                  )}
                  {prov.ctruEstimadoPEN !== undefined && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        CTRU estimado
                      </div>
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          top ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        S/ {prov.ctruEstimadoPEN.toFixed(0)}
                      </div>
                    </div>
                  )}
                  {prov.margenProyectadoPct !== undefined && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        Margen proyectado
                      </div>
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          top ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {prov.margenProyectadoPct.toFixed(0)}%
                      </div>
                    </div>
                  )}
                  {prov.notas && (
                    <div className="col-span-2 lg:col-span-4 pt-2 border-t border-slate-100">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                        Notas
                      </div>
                      <div className="text-[11px] text-slate-700">{prov.notas}</div>
                    </div>
                  )}
                  <div className="col-span-2 lg:col-span-4 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCrearOC?.(prov.id);
                      }}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                        top
                          ? 'text-white bg-emerald-600 hover:bg-emerald-700'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Crear OC con este proveedor
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerHistorico?.(prov.id);
                      }}
                      className="px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Ver histórico OCs
                    </button>
                    {onEditarProveedor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditarProveedor(prov.id);
                        }}
                        className="px-3 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-lg transition-colors ml-auto"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
