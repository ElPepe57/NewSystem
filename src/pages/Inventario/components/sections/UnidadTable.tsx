import React from 'react';
import { formatFecha as formatDate } from '../../../../utils/dateFormatters';
import { Package, TrendingUp, MapPin, Calendar, Clock } from 'lucide-react';
import { Badge } from '../../../../components/common';
import { DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import type { Unidad, EstadoUnidad } from '../../../../types/unidad.types';
import { getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen } from '../../../../utils/multiOrigen.helpers';

interface UnidadTableProps {
  unidades: Unidad[];
  onViewDetails: (unidad: Unidad) => void;
  loading?: boolean;
}

const getEstadoVariant = (estado: EstadoUnidad): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (esEstadoEnOrigen(estado)) return 'info';
  if (esEstadoEnTransitoOrigen(estado)) return 'warning';
  switch (estado) {
    case 'en_transito_peru': return 'warning';
    case 'disponible_peru': return 'success';
    case 'reservada': return 'warning';
    case 'asignada_pedido': return 'warning';
    case 'vendida': return 'default';
    case 'vencida': return 'danger';
    case 'danada': return 'danger';
    default: return 'default';
  }
};

export const UnidadTable: React.FC<UnidadTableProps> = ({
  unidades,
  onViewDetails,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (unidades.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">No hay unidades</h3>
        <p className="mt-1 text-sm text-slate-500">Comienza recibiendo inventario</p>
      </div>
    );
  }


  const columns: DataTableColumn<Unidad>[] = [
    {
      key: 'sku',
      header: 'ID / SKU',
      render: (unidad) => (
        <div className="flex items-center">
          <Package className="h-4 w-4 text-slate-400 mr-2" />
          <div>
            <span className="text-sm font-mono font-medium text-slate-900">
              {unidad.productoSKU}
            </span>
            <div className="text-xs text-slate-500">{unidad.id.slice(0, 8)}...</div>
          </div>
        </div>
      ),
    },
    {
      key: 'lote',
      header: 'Lote',
      render: (unidad) => <div className="text-sm text-slate-900">{unidad.lote}</div>,
    },
    {
      key: 'almacen',
      header: 'Almacén',
      render: (unidad) => (
        <div className="flex items-center">
          <MapPin className="h-4 w-4 text-slate-400 mr-1" />
          <div>
            <span className="text-sm text-slate-900">{unidad.almacenNombre}</span>
            <div className="text-xs text-slate-500">{unidad.pais}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (unidad) => (
        <Badge variant={getEstadoVariant(unidad.estado)}>
          {getLabelEstadoUnidad(unidad.estado, unidad.paisOrigen || unidad.pais)}
        </Badge>
      ),
    },
    {
      key: 'ctru',
      header: 'CTRU',
      render: (unidad) => (
        <div className="flex items-center">
          <TrendingUp className="h-4 w-4 text-slate-400 mr-1" />
          <div>
            <div className="text-sm font-medium text-slate-900">
              S/ {(unidad.ctruDinamico || unidad.ctruInicial || 0).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              ${unidad.costoUnitarioUSD.toFixed(2)}{unidad.tcPago ? ` × ${unidad.tcPago.toFixed(3)}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'fechaRecepcion',
      header: 'Fecha Recepción',
      render: (unidad) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-slate-400 mr-1" />
          <span className="text-sm text-slate-900">{formatDate(unidad.fechaRecepcion)}</span>
        </div>
      ),
    },
    {
      key: 'vencimiento',
      header: 'Vencimiento',
      render: (unidad) =>
        unidad.fechaVencimiento ? (
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-slate-400 mr-1" />
            <span className="text-sm text-slate-900">{formatDate(unidad.fechaVencimiento)}</span>
          </div>
        ) : (
          <span className="text-sm text-slate-400">-</span>
        ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (unidad) => (
        <button
          onClick={() => onViewDetails(unidad)}
          className="text-orange-600 hover:text-orange-900"
        >
          Ver Detalles
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={unidades}
      keyExtractor={u => u.id}
    />
  );
};
