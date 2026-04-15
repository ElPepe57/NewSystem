/**
 * HistorialLotes.tsx — Tabla de lotes de pago ejecutados.
 */
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import { formatCurrency } from '../../../utils/format';
import { usePagoMasivoStore } from '../../../store/pagoMasivoStore';
import type { LotePago } from '../../../types/pagoMasivo.types';

const loteColumns = (setLoteDetalle: (lote: LotePago) => void): DataTableColumn<LotePago>[] => [
  {
    key: 'id', header: 'Lote',
    render: l => <span className="font-mono text-xs font-medium">{l.id}</span>,
  },
  {
    key: 'tipo', header: 'Tipo',
    render: l => (
      <Badge variant={l.tipo === 'egreso' ? 'warning' : 'success'}>
        {l.tipo === 'egreso' ? 'Egreso' : 'Ingreso'}
      </Badge>
    ),
  },
  {
    key: 'fecha', header: 'Fecha', hideOnMobile: true,
    render: l => {
      const fecha = l.fechaEjecucion?.toDate?.()
        ? l.fechaEjecucion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      return <span className="text-slate-600">{fecha}</span>;
    },
  },
  {
    key: 'items', header: 'Items', align: 'center', hideOnMobile: true,
    render: l => (
      <span className="flex items-center justify-center gap-1">
        <CheckCircle size={14} className="text-emerald-500" />
        <span>{l.itemsExitosos}</span>
        {l.itemsConError > 0 && (
          <>
            <XCircle size={14} className="text-red-500 ml-1" />
            <span>{l.itemsConError}</span>
          </>
        )}
      </span>
    ),
  },
  {
    key: 'monto', header: 'Monto', align: 'right',
    render: l => (
      <div className="font-mono">
        {l.montoTotalPEN > 0 && <div>{formatCurrency(l.montoTotalPEN, 'PEN')}</div>}
        {l.montoTotalUSD > 0 && <div>{formatCurrency(l.montoTotalUSD, 'USD')}</div>}
      </div>
    ),
  },
  {
    key: 'estado', header: 'Estado', align: 'center',
    render: l => l.itemsConError > 0
      ? <Badge variant="warning">Parcial</Badge>
      : <Badge variant="success">Completo</Badge>,
  },
  {
    key: 'acciones', header: 'Acciones', align: 'center',
    render: l => (
      <Button variant="ghost" size="sm" onClick={() => setLoteDetalle(l)}>
        <Eye size={14} />
      </Button>
    ),
  },
];

export const HistorialLotes: React.FC = () => {
  const { historial, loadingHistorial, fetchHistorial, setLoteDetalle } = usePagoMasivoStore();

  useEffect(() => { fetchHistorial(); }, []);

  return (
    <div className="border rounded-lg overflow-hidden">
      <DataTable<LotePago>
        columns={loteColumns(setLoteDetalle)}
        data={historial}
        keyExtractor={l => l.id}
        loading={loadingHistorial}
        emptyState={
          <div className="text-center py-12 text-slate-500">
            <Clock size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No hay lotes ejecutados</p>
            <p className="text-sm">Los lotes procesados apareceran aqui.</p>
          </div>
        }
      />
    </div>
  );
};
