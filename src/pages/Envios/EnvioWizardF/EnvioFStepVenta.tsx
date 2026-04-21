/**
 * EnvioFStepVenta — Paso 1 del Wizard F (Seleccionar venta a despachar).
 *
 * Muestra ventas en estados relevantes para despacho (confirmada, reservada,
 * parcial, asignada) y permite buscar por número/cliente. Al seleccionar una,
 * el state del wizard se hidrata con la venta completa como snapshot.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { User, MapPin, Package } from 'lucide-react';
import { useVentaStore } from '../../../store/ventaStore';
import type { Venta, EstadoVenta } from '../../../types/venta.types';
import { cn } from '../../../design-system';
import type { EnvioWizardFState, EnvioWizardFAction } from './envioWizardFTypes';

export interface EnvioFStepVentaProps {
  state: EnvioWizardFState;
  dispatch: (action: EnvioWizardFAction) => void;
}

// Ventas despachables: confirmada, reservada, parcial, asignada, en_entrega
const ESTADOS_DESPACHABLES: EstadoVenta[] = [
  'confirmada',
  'reservada',
  'parcial',
  'asignada',
  'en_entrega',
];

export const EnvioFStepVenta: React.FC<EnvioFStepVentaProps> = ({ state, dispatch }) => {
  const ventas = useVentaStore((s) => s.ventas);
  const fetchVentas = useVentaStore((s) => s.fetchVentas);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (ventas.length === 0) fetchVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ventasDespachables = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ventas
      .filter((v) => ESTADOS_DESPACHABLES.includes(v.estado))
      .filter((v) => {
        if (!q) return true;
        return (
          v.numeroVenta.toLowerCase().includes(q) ||
          v.nombreCliente.toLowerCase().includes(q) ||
          v.direccionEntrega?.toLowerCase().includes(q)
        );
      });
  }, [ventas, busqueda]);

  const ventaSeleccionada: Venta | undefined = useMemo(
    () => ventas.find((v) => v.id === state.ventaId),
    [ventas, state.ventaId]
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Selecciona la venta a despachar
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Caso F despacha una venta existente desde un almacén Perú al cliente final.
          El cliente y dirección se leen automáticamente de la venta.
        </p>
      </div>

      {/* Chip venta seleccionada */}
      {ventaSeleccionada ? (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-teal-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 font-mono">
                {ventaSeleccionada.numeroVenta}
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                {ventaSeleccionada.estado}
              </span>
              <span className="text-xs text-slate-500">
                · S/ {ventaSeleccionada.totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-700 mt-1">
              <User className="w-3 h-3" />
              <span className="font-medium">{ventaSeleccionada.nombreCliente}</span>
              {ventaSeleccionada.telefonoCliente && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{ventaSeleccionada.telefonoCliente}</span>
                </>
              )}
            </div>
            {ventaSeleccionada.direccionEntrega && (
              <div className="flex items-start gap-1 text-xs text-slate-600 mt-0.5">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  {ventaSeleccionada.direccionEntrega}
                  {ventaSeleccionada.distrito && ` · ${ventaSeleccionada.distrito}`}
                </span>
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1">
              {ventaSeleccionada.productos.length} producto
              {ventaSeleccionada.productos.length !== 1 ? 's' : ''} en la venta
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              dispatch({
                type: 'SET_VENTA',
                venta: { ...ventaSeleccionada, id: '' } as Venta,
              });
            }}
            className="text-[11px] text-teal-700 hover:text-teal-800 font-medium"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por N° venta, cliente o dirección..."
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          {ventasDespachables.length === 0 ? (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-center text-xs text-amber-900">
              No hay ventas despachables. Ventas en estado:
              <span className="ml-1 font-mono">{ESTADOS_DESPACHABLES.join(', ')}</span>.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-96 overflow-y-auto bg-white">
              {ventasDespachables.slice(0, 50).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_VENTA', venta: v })}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-slate-500 group-hover:text-teal-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 font-mono">
                          {v.numeroVenta}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded',
                            v.estado === 'confirmada' && 'bg-sky-100 text-sky-800',
                            v.estado === 'reservada' && 'bg-purple-100 text-purple-800',
                            v.estado === 'asignada' && 'bg-emerald-100 text-emerald-800',
                            v.estado === 'parcial' && 'bg-amber-100 text-amber-800',
                            v.estado === 'en_entrega' && 'bg-teal-100 text-teal-800'
                          )}
                        >
                          {v.estado}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          S/ {v.totalPEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        {v.nombreCliente}
                        {v.distrito && <span className="text-slate-400"> · {v.distrito}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {v.productos.length} producto{v.productos.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {ventasDespachables.length > 50 && (
                <div className="p-2 text-[11px] text-slate-400 text-center italic">
                  Mostrando primeras 50 de {ventasDespachables.length}. Refina la búsqueda.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
