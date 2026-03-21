import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Phone,
  MessageCircle,
  Download,
  Eye,
  DollarSign,
  Lock,
  CheckCircle,
  UserCheck,
  Undo2,
  ThumbsDown,
  Clock,
  Truck,
  Package
} from 'lucide-react';
import { formatCurrencyPEN } from '../../utils/format';
import { Badge, LineaNegocioBadge } from '../../components/common';
import type { Cotizacion } from '../../types/cotizacion.types';

export interface KanbanCardProps {
  cotizacion: Cotizacion;
  onView: () => void;
  onWhatsApp: () => void;
  onDownloadPdf?: () => void;
  onValidar?: () => void;
  onRegistrarAdelanto?: () => void;
  onConfirmar?: () => void;
  onRevertir?: () => void;
  onRechazar?: () => void;
  onActualizarDiasEntrega?: (dias: number) => void;
  onActualizarDiasValidez?: (dias: number) => void;
  onActualizarTiempoImportacion?: (dias: number) => void;
  showValidar?: boolean;
  showAdelanto?: boolean;
  showConfirmar?: boolean;
  showRevertir?: boolean;
  showRechazar?: boolean;
  showDiasEntrega?: boolean;
  showDiasValidez?: boolean;
  showTiempoImportacion?: boolean;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  cotizacion,
  onView,
  onWhatsApp,
  onDownloadPdf,
  onValidar,
  onRegistrarAdelanto,
  onConfirmar,
  onRevertir,
  onRechazar,
  onActualizarDiasEntrega,
  onActualizarDiasValidez,
  onActualizarTiempoImportacion,
  showValidar = false,
  showAdelanto = false,
  showConfirmar = false,
  showRevertir = false,
  showRechazar = false,
  showDiasEntrega = false,
  showDiasValidez = false,
  showTiempoImportacion = false
}) => {
  const [diasEntregaLocal, setDiasEntregaLocal] = useState(cotizacion.diasCompromisoEntrega || 15);
  const [diasValidezLocal, setDiasValidezLocal] = useState(cotizacion.diasVigencia || 7);
  const [tiempoImportacionLocal, setTiempoImportacionLocal] = useState(cotizacion.tiempoEstimadoImportacion || 10);

  useEffect(() => {
    setDiasEntregaLocal(cotizacion.diasCompromisoEntrega || 15);
  }, [cotizacion.diasCompromisoEntrega]);

  useEffect(() => {
    setDiasValidezLocal(cotizacion.diasVigencia || 7);
  }, [cotizacion.diasVigencia]);

  useEffect(() => {
    setTiempoImportacionLocal(cotizacion.tiempoEstimadoImportacion || 10);
  }, [cotizacion.tiempoEstimadoImportacion]);

  const formatCurrency = (amount: number) => formatCurrencyPEN(amount);

  const getDiasAntiguedad = (timestamp: any): number => {
    if (!timestamp?.toDate) return 0;
    const fecha = timestamp.toDate();
    const hoy = new Date();
    return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  };

  const dias = getDiasAntiguedad(cotizacion.fechaCreacion);
  const requiereStock = cotizacion.productos.some(p => p.requiereStock);

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-primary-600">{cotizacion.numeroCotizacion}</span>
          {requiereStock && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
              <AlertTriangle className="h-3 w-3 mr-0.5" />
              Sin stock
            </span>
          )}
        </div>
        <Badge variant={dias > 7 ? 'warning' : dias > 3 ? 'info' : 'success'} size="sm">
          {dias === 0 ? 'Hoy' : `${dias}d`}
        </Badge>
      </div>

      <div className="mb-2">
        <p className="text-sm font-medium text-gray-900 truncate">{cotizacion.nombreCliente}</p>
        {cotizacion.telefonoCliente && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {cotizacion.telefonoCliente}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold text-gray-900">{formatCurrency(cotizacion.totalPEN)}</span>
        <span className="text-xs text-gray-500">{cotizacion.productos.length} prod.</span>
      </div>
      <div className="mb-3">
        <LineaNegocioBadge lineaNegocioId={cotizacion.lineaNegocioId} />
      </div>

      {showDiasEntrega && onActualizarDiasEntrega && (
        <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700">Entrega en</span>
            <input
              type="number"
              min="1"
              max="90"
              value={diasEntregaLocal}
              onChange={(e) => setDiasEntregaLocal(Number(e.target.value))}
              onBlur={() => {
                if (diasEntregaLocal !== cotizacion.diasCompromisoEntrega) {
                  onActualizarDiasEntrega(diasEntregaLocal);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 px-1 py-0.5 text-center text-sm font-semibold border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-700">días hábiles</span>
          </div>
          <p className="text-[10px] text-amber-600 mt-1 ml-6">tras pago del adelanto</p>
        </div>
      )}

      {showDiasValidez && onActualizarDiasValidez && (
        <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs text-blue-700">Validez:</span>
            <input
              type="number"
              min="1"
              max="90"
              value={diasValidezLocal}
              onChange={(e) => setDiasValidezLocal(Number(e.target.value))}
              onBlur={() => {
                if (diasValidezLocal !== cotizacion.diasVigencia) {
                  onActualizarDiasValidez(diasValidezLocal);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 px-1 py-0.5 text-center text-sm font-semibold border border-blue-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-blue-700">días</span>
          </div>
        </div>
      )}

      {showTiempoImportacion && onActualizarTiempoImportacion && requiereStock && (
        <div className="mb-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-600 flex-shrink-0" />
            <span className="text-xs text-orange-700">Importación:</span>
            <input
              type="number"
              min="5"
              max="60"
              value={tiempoImportacionLocal}
              onChange={(e) => setTiempoImportacionLocal(Number(e.target.value))}
              onBlur={() => {
                if (tiempoImportacionLocal !== cotizacion.tiempoEstimadoImportacion) {
                  onActualizarTiempoImportacion(tiempoImportacionLocal);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 px-1 py-0.5 text-center text-sm font-semibold border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <span className="text-xs text-orange-700">-{tiempoImportacionLocal + 5} días</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 pt-2 border-t">
        <button
          onClick={onView}
          className="flex-1 p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
          title="Ver detalles"
        >
          <Eye className="h-4 w-4 mx-auto" />
        </button>
        {onDownloadPdf && (
          <button
            onClick={onDownloadPdf}
            className="flex-1 p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
            title="Descargar PDF"
          >
            <Download className="h-4 w-4 mx-auto" />
          </button>
        )}
        {cotizacion.telefonoCliente && (
          <button
            onClick={onWhatsApp}
            className="flex-1 p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showValidar && onValidar && (
          <button
            onClick={onValidar}
            className="flex-1 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Validar (cliente confirmó)"
          >
            <UserCheck className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showRevertir && onRevertir && (
          <button
            onClick={onRevertir}
            className="flex-1 p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
            title="Revertir validación"
          >
            <Undo2 className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showAdelanto && onRegistrarAdelanto && (
          <button
            onClick={onRegistrarAdelanto}
            className={`flex-1 p-1.5 text-gray-500 rounded transition-colors ${
              cotizacion.estado === 'pendiente_adelanto'
                ? 'hover:text-green-600 hover:bg-green-50'
                : 'hover:text-purple-600 hover:bg-purple-50'
            }`}
            title={cotizacion.estado === 'pendiente_adelanto' ? 'Registrar Pago' : 'Comprometer Adelanto'}
          >
            {cotizacion.estado === 'pendiente_adelanto' ? (
              <DollarSign className="h-4 w-4 mx-auto" />
            ) : (
              <Lock className="h-4 w-4 mx-auto" />
            )}
          </button>
        )}
        {showConfirmar && onConfirmar && (
          <button
            onClick={onConfirmar}
            className="flex-1 p-1.5 text-gray-500 hover:text-success-600 hover:bg-success-50 rounded transition-colors"
            title="Confirmar venta"
          >
            <CheckCircle className="h-4 w-4 mx-auto" />
          </button>
        )}
        {showRechazar && onRechazar && (
          <button
            onClick={onRechazar}
            className="flex-1 p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Rechazar cotización"
          >
            <ThumbsDown className="h-4 w-4 mx-auto" />
          </button>
        )}
      </div>
    </div>
  );
};
