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

  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Cotización</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cotizaciones.map((item) => {
              const requiereStock = item.productos.some(p => p.requiereStock);
              return (
                <tr key={item.id} className={`hover:bg-gray-50 ${item.estado === 'rechazada' || item.estado === 'vencida' ? 'bg-red-50' : ''}`}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary-600">{item.numeroCotizacion}</span>
                      {requiereStock && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Sin stock</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-500">{item.productos.length} producto(s)</span>
                      <LineaNegocioBadge lineaNegocioId={item.lineaNegocioId} />
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="text-sm font-medium text-gray-900">{item.nombreCliente}</div>
                    {item.telefonoCliente && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {item.telefonoCliente}
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <Badge variant={
                        item.estado === 'nueva' ? 'default' :
                        item.estado === 'validada' ? 'info' :
                        item.estado === 'pendiente_adelanto' ? 'warning' :
                        item.estado === 'adelanto_pagado' ? 'success' :
                        item.estado === 'con_abono' ? 'success' :
                        item.estado === 'confirmada' ? 'success' :
                        item.estado === 'rechazada' ? 'danger' :
                        item.estado === 'vencida' ? 'warning' : 'default'
                      }>
                        {item.estado === 'nueva' ? 'Nueva' :
                         item.estado === 'validada' ? 'Validada (sin adelanto)' :
                         item.estado === 'pendiente_adelanto' ? 'Esperando Pago' :
                         item.estado === 'adelanto_pagado' ? 'Adelanto Pagado' :
                         item.estado === 'con_abono' ? 'Con Adelanto' :
                         item.estado === 'confirmada' ? 'Confirmada' :
                         item.estado === 'rechazada' ? 'Rechazada' :
                         item.estado === 'vencida' ? 'Vencida' : item.estado}
                      </Badge>
                      {(item.estado === 'adelanto_pagado' || item.estado === 'con_abono') && item.reservaStock && (
                        <Badge
                          variant={item.reservaStock.tipoReserva === 'fisica' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {item.reservaStock.tipoReserva === 'fisica' ? 'Stock Reservado' : 'Esperando Stock'}
                        </Badge>
                      )}
                      {item.estado === 'pendiente_adelanto' && item.adelantoComprometido && (
                        <span className="text-xs text-amber-600">
                          {item.adelantoComprometido.porcentaje}% comprometido
                        </span>
                      )}
                      {item.estado === 'rechazada' && item.rechazo?.motivo && (
                        <span className="text-xs text-red-600">
                          {MOTIVOS_RECHAZO.find(m => m.value === item.rechazo?.motivo)?.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(item.totalPEN)}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-900">{formatFecha(item.fechaCreacion)}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onVerDetalles(item)} className="p-1.5 text-gray-400 hover:text-primary-600" title="Ver">
                        <Eye className="h-4 w-4" />
                      </button>
                      {item.telefonoCliente && (
                        <button onClick={() => onWhatsApp(item)} className="p-1.5 text-gray-400 hover:text-green-600" title="WhatsApp">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      )}
                      {item.estado === 'nueva' && (
                        <>
                          <button onClick={() => onValidar(item)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Validar">
                            <UserCheck className="h-4 w-4" />
                          </button>
                          <button onClick={() => onRechazar(item)} className="p-1.5 text-gray-400 hover:text-red-600" title="Rechazar">
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {item.estado === 'validada' && (
                        <>
                          <button onClick={() => onConfirmar(item)} className="p-1.5 text-gray-400 hover:text-success-600" title="Confirmar Venta (sin adelanto)">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button onClick={() => onRegistrarAdelanto(item)} className="p-1.5 text-gray-400 hover:text-purple-600" title="Comprometer Adelanto">
                            <Lock className="h-4 w-4" />
                          </button>
                          <button onClick={() => onRevertirValidacion(item)} className="p-1.5 text-gray-400 hover:text-orange-600" title="Revertir">
                            <Undo2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => onRechazar(item)} className="p-1.5 text-gray-400 hover:text-red-600" title="Rechazar">
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {item.estado === 'pendiente_adelanto' && (
                        <>
                          <button onClick={() => onRegistrarAdelanto(item)} className="p-1.5 text-gray-400 hover:text-green-600" title="Registrar Pago">
                            <DollarSign className="h-4 w-4" />
                          </button>
                          <button onClick={() => onRechazar(item)} className="p-1.5 text-gray-400 hover:text-red-600" title="Rechazar">
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {(item.estado === 'adelanto_pagado' || item.estado === 'con_abono') && (
                        <button onClick={() => onConfirmar(item)} className="p-1.5 text-gray-400 hover:text-success-600" title="Confirmar Venta">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {(item.estado === 'nueva' || item.estado === 'rechazada') && (
                        <button onClick={() => onEliminar(item)} className="p-1.5 text-gray-400 hover:text-danger-600" title="Eliminar">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cotizaciones.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cotizaciones</h3>
          <div className="mt-6">
            <Button onClick={onNuevaCotizacion}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
