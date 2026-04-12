import { X, MapPin, DollarSign, Users, Package, ShoppingCart } from 'lucide-react';
import { useMapaCalorStore } from '../../store/mapaCalorStore';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import type { ZonaResumen, VentaGeo } from '../../types/mapaCalor.types';

export function MapaCalorPanelZona() {
  const { zonaSeleccionada, ventaSeleccionada, setZonaSeleccionada, setVentaSeleccionada } = useMapaCalorStore();
  const { lineasActivas } = useLineaNegocioStore();

  const getLineaNombre = (id: string) => lineasActivas.find(l => l.id === id)?.nombre || id;

  if (ventaSeleccionada) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-teal-500" />
            {ventaSeleccionada.codigo}
          </h3>
          <button type="button" onClick={() => setVentaSeleccionada(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-xs text-slate-500">Total</span>
            <p className="font-bold text-emerald-600">S/ {ventaSeleccionada.totalPEN.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Cliente</span>
            <p className="font-medium text-slate-800 truncate">{ventaSeleccionada.clienteNombre || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Distrito</span>
            <p className="text-slate-800">{ventaSeleccionada.distrito || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Provincia</span>
            <p className="text-slate-800">{ventaSeleccionada.provincia || '—'}</p>
          </div>
        </div>

        {ventaSeleccionada.productos.length > 0 && (
          <div>
            <span className="text-xs text-slate-500 block mb-1">Productos</span>
            <div className="space-y-1">
              {ventaSeleccionada.productos.slice(0, 5).map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700 truncate">{p.nombre}</span>
                  <span className="text-slate-500 ml-2">x{p.cantidad}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!zonaSeleccionada) return null;

  const zona = zonaSeleccionada;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-sky-500" />
          {zona.distrito}
        </h3>
        <button type="button" onClick={() => setZonaSeleccionada(null)} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500">{zona.provincia}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-sky-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <ShoppingCart className="h-3 w-3 text-sky-600" />
            <span className="text-[10px] text-sky-600">Ventas</span>
          </div>
          <p className="text-lg font-bold text-sky-700">{zona.totalVentas}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <DollarSign className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px] text-emerald-600">Volumen</span>
          </div>
          <p className="text-lg font-bold text-emerald-700">S/ {zona.volumenPEN.toFixed(0)}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <DollarSign className="h-3 w-3 text-orange-600" />
            <span className="text-[10px] text-orange-600">Ticket Prom.</span>
          </div>
          <p className="text-lg font-bold text-orange-700">S/ {zona.ticketPromedio.toFixed(0)}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Users className="h-3 w-3 text-purple-600" />
            <span className="text-[10px] text-purple-600">Clientes</span>
          </div>
          <p className="text-lg font-bold text-purple-700">{zona.clientesUnicos}</p>
        </div>
      </div>

      {/* Top productos */}
      {zona.productosTop.length > 0 && (
        <div>
          <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
            <Package className="h-3 w-3" /> Top Productos
          </span>
          <div className="space-y-1">
            {zona.productosTop.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-700 truncate">{i + 1}. {p.nombre}</span>
                <span className="text-slate-500 ml-2">{p.cantidad} uds</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribución por línea */}
      {zona.distribucionLinea.length > 0 && (
        <div>
          <span className="text-xs text-slate-500 mb-1 block">Por Línea</span>
          <div className="flex gap-2">
            {zona.distribucionLinea.map(d => (
              <span key={d.lineaNegocioId} className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-700">
                {getLineaNombre(d.lineaNegocioId)} {d.porcentaje}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
