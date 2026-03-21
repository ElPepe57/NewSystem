import React from 'react';
import { AlertTriangle, Package, Clock } from 'lucide-react';
import { Button } from '../../components/common';
import { SeccionColapsable } from './SeccionColapsable';
import type { Cotizacion } from '../../types/cotizacion.types';

interface CotizacionesAlertasProps {
  reservasPorVencer: Cotizacion[];
  conFaltanteStock: Cotizacion[];
  reservasVirtuales: Cotizacion[];
  onVerDetalles: (cotizacion: Cotizacion) => void;
}

export const CotizacionesAlertas: React.FC<CotizacionesAlertasProps> = ({
  reservasPorVencer,
  conFaltanteStock,
  reservasVirtuales,
  onVerDetalles
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SeccionColapsable
        titulo="Reservas por Vencer"
        icono={<AlertTriangle className="h-5 w-5" />}
        cantidad={reservasPorVencer.length}
        variant="danger"
        defaultOpen={reservasPorVencer.length > 0}
      >
        {reservasPorVencer.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No hay reservas próximas a vencer</p>
        ) : (
          <div className="space-y-2 pt-2">
            {reservasPorVencer.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                <div>
                  <span className="font-medium text-sm">{r.numeroVenta}</span>
                  <span className="text-xs text-gray-500 ml-2">{r.nombreCliente}</span>
                </div>
                <Button size="sm" variant="danger" onClick={() => onVerDetalles(r)}>
                  Ver
                </Button>
              </div>
            ))}
          </div>
        )}
      </SeccionColapsable>

      <SeccionColapsable
        titulo="Sin Stock Disponible"
        icono={<Package className="h-5 w-5" />}
        cantidad={conFaltanteStock.length}
        variant="warning"
        defaultOpen={conFaltanteStock.length > 0}
      >
        {conFaltanteStock.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Todas las cotizaciones tienen stock</p>
        ) : (
          <div className="space-y-2 pt-2">
            {conFaltanteStock.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-amber-50 rounded">
                <div>
                  <span className="font-medium text-sm">{c.numeroVenta}</span>
                  <span className="text-xs text-gray-500 ml-2">{c.nombreCliente}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => onVerDetalles(c)}>
                  Ver
                </Button>
              </div>
            ))}
            {conFaltanteStock.length > 5 && (
              <p className="text-xs text-gray-500 text-center">+{conFaltanteStock.length - 5} más</p>
            )}
          </div>
        )}
      </SeccionColapsable>

      <SeccionColapsable
        titulo="Reservas Virtuales"
        icono={<Clock className="h-5 w-5" />}
        cantidad={reservasVirtuales.length}
        variant="info"
        defaultOpen={reservasVirtuales.length > 0}
      >
        {reservasVirtuales.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No hay reservas virtuales pendientes</p>
        ) : (
          <div className="space-y-2 pt-2">
            {reservasVirtuales.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div>
                  <span className="font-medium text-sm">{r.numeroVenta}</span>
                  <span className="text-xs text-gray-500 ml-2">Esperando stock</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => onVerDetalles(r)}>
                  Ver
                </Button>
              </div>
            ))}
          </div>
        )}
      </SeccionColapsable>
    </div>
  );
};
