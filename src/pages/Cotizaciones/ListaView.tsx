import React from 'react';
import {
  FileText,
  Plus,
  Phone,
  MessageCircle,
  Eye,
  CheckCircle,
  XCircle,
  DollarSign,
  Lock,
  UserCheck,
  Undo2,
  ThumbsDown
} from 'lucide-react';
import { formatFecha } from '../../utils/dateFormatters';
import { formatCurrencyPEN } from '../../utils/format';
import { Card, Badge, Button, LineaNegocioBadge } from '../../components/common';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import type { Cotizacion, MotivoRechazo } from '../../types/cotizacion.types';

const MOTIVOS_RECHAZO: { value: MotivoRechazo; label: string }[] = [
  { value: 'precio_alto', label: 'Precio muy alto' },
  { value: 'encontro_mejor_opcion', label: 'Encontró mejor opción' },
  { value: 'sin_presupuesto', label: 'Sin presupuesto' },
  { value: 'producto_diferente', label: 'Quería otro producto' },
  { value: 'demora_entrega', label: 'Demora en entrega' },
  { value: 'cambio_necesidad', label: 'Ya no necesita' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'otro', label: 'Otro motivo' }
];

interface ListaViewProps {
  cotizaciones: Cotizacion[];
  onVerDetalles: (cotizacion: Cotizacion) => void;
  onWhatsApp: (cotizacion: Cotizacion) => void;
  onValidar: (cotizacion: Cotizacion) => void;
  onConfirmar: (cotizacion: Cotizacion) => void;
  onRegistrarAdelanto: (cotizacion: Cotizacion) => void;
  onRevertirValidacion: (cotizacion: Cotizacion) => void;
  onRechazar: (cotizacion: Cotizacion) => void;
  onEliminar: (cotizacion: Cotizacion) => void;
  onNuevaCotizacion: () => void;
}

export const ListaView: React.FC<ListaViewProps> = ({
  cotizaciones,
  onVerDetalles,
  onWhatsApp,
  onValidar,
  onConfirmar,
  onRegistrarAdelanto,
  onRevertirValidacion,
  onRechazar,
  onEliminar,
  onNuevaCotizacion
}) => {
  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      nueva: 'Nueva', validada: 'Validada (sin adelanto)', pendiente_adelanto: 'Esperando Pago',
      adelanto_pagado: 'Adelanto Pagado', con_abono: 'Con Adelanto', confirmada: 'Confirmada',
      rechazada: 'Rechazada', vencida: 'Vencida',
    };
    return labels[estado] || estado;
  };

  const getEstadoVariant = (estado: string) => {
    const variants: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
      nueva: 'default', validada: 'info', pendiente_adelanto: 'warning',
      adelanto_pagado: 'success', con_abono: 'success', confirmada: 'success',
      rechazada: 'danger', vencida: 'warning',
    };
    return variants[estado] || 'default';
  };

  const columns: DataTableColumn<Cotizacion>[] = [
    {
      key: 'cotizacion', header: 'Cotización',
      render: item => {
        const requiereStock = item.productos.some(p => p.requiereStock);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-teal-600">{item.numeroCotizacion}</span>
              {requiereStock && <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Sin stock</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-500">{item.productos.length} producto(s)</span>
              <LineaNegocioBadge lineaNegocioId={item.lineaNegocioId} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'cliente', header: 'Cliente', hideOnMobile: true,
      render: item => (
        <div>
          <div className="text-sm font-medium text-slate-900">{item.nombreCliente}</div>
          {item.telefonoCliente && (
            <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{item.telefonoCliente}</div>
          )}
        </div>
      ),
    },
    {
      key: 'estado', header: 'Estado',
      render: item => (
        <div className="flex flex-col gap-1">
          <Badge variant={getEstadoVariant(item.estado)}>{getEstadoLabel(item.estado)}</Badge>
          {(item.estado === 'adelanto_pagado' || item.estado === 'con_abono') && item.reservaStock && (
            <Badge variant={item.reservaStock.tipoReserva === 'fisica' ? 'success' : 'warning'} size="sm">
              {item.reservaStock.tipoReserva === 'fisica' ? 'Stock Reservado' : 'Esperando Stock'}
            </Badge>
          )}
          {item.estado === 'pendiente_adelanto' && item.adelantoComprometido && (
            <span className="text-xs text-amber-600">{item.adelantoComprometido.porcentaje}% comprometido</span>
          )}
          {item.estado === 'rechazada' && item.rechazo?.motivo && (
            <span className="text-xs text-red-600">{MOTIVOS_RECHAZO.find(m => m.value === item.rechazo?.motivo)?.label}</span>
          )}
        </div>
      ),
    },
    {
      key: 'total', header: 'Total', align: 'right', hideOnMobile: true,
      render: item => <span className="font-medium">{formatCurrency(item.totalPEN)}</span>,
    },
    {
      key: 'fecha', header: 'Fecha', align: 'center', hideOnMobile: true,
      render: item => <span>{formatFecha(item.fechaCreacion)}</span>,
    },
    {
      key: 'acciones', header: 'Acciones', align: 'center',
      render: item => (
        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onVerDetalles(item)} className="p-1.5 text-slate-400 hover:text-teal-600" title="Ver"><Eye className="h-4 w-4" /></button>
          {item.telefonoCliente && (
            <button onClick={() => onWhatsApp(item)} className="p-1.5 text-slate-400 hover:text-emerald-600" title="WhatsApp"><MessageCircle className="h-4 w-4" /></button>
          )}
          {item.estado === 'nueva' && (
            <>
              <button onClick={() => onValidar(item)} className="p-1.5 text-slate-400 hover:text-sky-600" title="Validar"><UserCheck className="h-4 w-4" /></button>
              <button onClick={() => onRechazar(item)} className="p-1.5 text-slate-400 hover:text-red-600" title="Rechazar"><ThumbsDown className="h-4 w-4" /></button>
            </>
          )}
          {item.estado === 'validada' && (
            <>
              <button onClick={() => onConfirmar(item)} className="p-1.5 text-slate-400 hover:text-emerald-600" title="Confirmar"><CheckCircle className="h-4 w-4" /></button>
              <button onClick={() => onRegistrarAdelanto(item)} className="p-1.5 text-slate-400 hover:text-purple-600" title="Adelanto"><Lock className="h-4 w-4" /></button>
              <button onClick={() => onRevertirValidacion(item)} className="p-1.5 text-slate-400 hover:text-orange-600" title="Revertir"><Undo2 className="h-4 w-4" /></button>
              <button onClick={() => onRechazar(item)} className="p-1.5 text-slate-400 hover:text-red-600" title="Rechazar"><ThumbsDown className="h-4 w-4" /></button>
            </>
          )}
          {item.estado === 'pendiente_adelanto' && (
            <>
              <button onClick={() => onRegistrarAdelanto(item)} className="p-1.5 text-slate-400 hover:text-emerald-600" title="Pago"><DollarSign className="h-4 w-4" /></button>
              <button onClick={() => onRechazar(item)} className="p-1.5 text-slate-400 hover:text-red-600" title="Rechazar"><ThumbsDown className="h-4 w-4" /></button>
            </>
          )}
          {(item.estado === 'adelanto_pagado' || item.estado === 'con_abono') && (
            <button onClick={() => onConfirmar(item)} className="p-1.5 text-slate-400 hover:text-emerald-600" title="Confirmar"><CheckCircle className="h-4 w-4" /></button>
          )}
          {(item.estado === 'nueva' || item.estado === 'rechazada') && (
            <button onClick={() => onEliminar(item)} className="p-1.5 text-slate-400 hover:text-red-600" title="Eliminar"><XCircle className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card padding="none">
      <DataTable<Cotizacion>
        columns={columns}
        data={cotizaciones}
        keyExtractor={item => item.id}
        onRowClick={onVerDetalles}
        emptyState={
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No hay cotizaciones</h3>
            <div className="mt-6">
              <Button onClick={onNuevaCotizacion}><Plus className="h-4 w-4 mr-2" />Nueva Cotización</Button>
            </div>
          </div>
        }
      />
    </Card>
  );
};
