import React from 'react';
import { Badge } from '../../common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import type { TipoCambio } from '../../../types/tipoCambio.types';

interface TipoCambioTableProps {
  tiposCambio: TipoCambio[];
}

const getFuenteBadge = (fuente: string) => {
  switch (fuente) {
    case 'sunat': return <Badge variant="success">SUNAT</Badge>;
    case 'bcrp': return <Badge variant="info">BCRP</Badge>;
    case 'paralelo': return <Badge variant="info">Paralelo</Badge>;
    case 'exchangerate-api': return <Badge variant="warning">API Backup</Badge>;
    case 'manual': return <Badge variant="default">Manual</Badge>;
    default: return <Badge variant="default">{fuente}</Badge>;
  }
};

const columns: DataTableColumn<TipoCambio>[] = [
  {
    key: 'fecha', header: 'Fecha',
    render: tc => {
      const fecha = tc.fecha?.toDate?.()?.toLocaleDateString('es-PE', {
        year: 'numeric', month: 'short', day: 'numeric'
      }) || '-';
      return <span className="font-medium text-slate-900">{fecha}</span>;
    },
  },
  {
    key: 'compra', header: 'TC Compra', align: 'right',
    render: tc => <span className="font-semibold text-slate-900">S/ {tc.compra.toFixed(3)}</span>,
  },
  {
    key: 'venta', header: 'TC Venta', align: 'right',
    render: tc => <span className="font-semibold text-slate-900">S/ {tc.venta.toFixed(3)}</span>,
  },
  {
    key: 'promedio', header: 'Promedio', align: 'right',
    render: tc => <span className="font-semibold text-teal-600">S/ {((tc.compra + tc.venta) / 2).toFixed(3)}</span>,
  },
  {
    key: 'fuente', header: 'Fuente',
    render: tc => getFuenteBadge(tc.fuente),
  },
];

export const TipoCambioTable: React.FC<TipoCambioTableProps> = ({ tiposCambio }) => (
  <DataTable<TipoCambio>
    columns={columns}
    data={tiposCambio}
    keyExtractor={tc => tc.id}
    emptyMessage="No hay tipos de cambio registrados"
  />
);
