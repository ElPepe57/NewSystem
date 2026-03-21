import React from 'react';
import { Clock, Lock, ShoppingCart, Eye, ExternalLink, Archive } from 'lucide-react';
import { formatCurrencyPEN } from '../../utils/format';
import { Badge } from '../../components/common';
import { KanbanCard } from './KanbanCard';
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

interface KanbanViewProps {
  nuevas: Cotizacion[];
  pendienteAdelanto: Cotizacion[];
  listasParaConfirmar: Cotizacion[];
  sinAdelanto: Cotizacion[];
  conAdelantoPagado: Cotizacion[];
  confirmadas: Cotizacion[];
  rechazadas: Cotizacion[];
  userId: string | undefined;
  onVerDetalles: (cotizacion: Cotizacion) => void;
  onWhatsApp: (cotizacion: Cotizacion) => void;
  onDescargarPdf: (cotizacion: Cotizacion) => void;
  onValidar: (cotizacion: Cotizacion) => void;
  onComprometerAdelanto: (cotizacion: Cotizacion) => void;
  onRegistrarPagoAdelanto: (cotizacion: Cotizacion) => void;
  onConfirmar: (cotizacion: Cotizacion) => void;
  onRechazar: (cotizacion: Cotizacion) => void;
  onEliminar: (cotizacion: Cotizacion) => void;
  onActualizarDiasValidez: (id: string, dias: number, uid: string) => Promise<void>;
  onActualizarTiempoImportacion: (id: string, dias: number, uid: string) => Promise<void>;
  onActualizarDiasEntrega: (id: string, dias: number, uid: string) => Promise<void>;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  nuevas,
  pendienteAdelanto,
  listasParaConfirmar,
  sinAdelanto,
  conAdelantoPagado,
  confirmadas,
  rechazadas,
  userId,
  onVerDetalles,
  onWhatsApp,
  onDescargarPdf,
  onValidar,
  onComprometerAdelanto,
  onRegistrarPagoAdelanto,
  onConfirmar,
  onRechazar,
  onEliminar,
  onActualizarDiasValidez,
  onActualizarTiempoImportacion,
  onActualizarDiasEntrega
}) => {
  const formatCurrency = (amount: number) => formatCurrencyPEN(amount);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Columna 1: SEGUIMIENTO */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-gray-500"></div>
          <h3 className="font-semibold text-gray-700">Seguimiento</h3>
          <Badge variant="default" size="sm">{nuevas.length}</Badge>
        </div>
        <p className="text-xs text-gray-500 mb-3">Cotizaciones sin respuesta del cliente</p>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {nuevas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Sin cotizaciones nuevas</p>
          ) : (
            nuevas.map(c => (
              <KanbanCard
                key={c.id}
                cotizacion={c}
                onView={() => onVerDetalles(c)}
                onWhatsApp={() => onWhatsApp(c)}
                onDownloadPdf={() => onDescargarPdf(c)}
                onValidar={() => onValidar(c)}
                onRegistrarAdelanto={() => onComprometerAdelanto(c)}
                onRechazar={() => onRechazar(c)}
                onActualizarDiasValidez={async (dias) => {
                  if (!userId) return;
                  try {
                    await onActualizarDiasValidez(c.id, dias, userId);
                  } catch (error) {
                    console.error('Error actualizando días de validez:', error);
                  }
                }}
                onActualizarTiempoImportacion={async (dias) => {
                  if (!userId) return;
                  try {
                    await onActualizarTiempoImportacion(c.id, dias, userId);
                  } catch (error) {
                    console.error('Error actualizando tiempo de importación:', error);
                  }
                }}
                showValidar={true}
                showAdelanto={true}
                showRechazar={true}
                showDiasValidez={true}
                showTiempoImportacion={true}
              />
            ))
          )}
        </div>
      </div>

      {/* Columna 2: ESPERANDO PAGO */}
      <div className="bg-amber-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <h3 className="font-semibold text-gray-700">Esperando Pago</h3>
          <Badge variant="warning" size="sm">{pendienteAdelanto.length}</Badge>
        </div>
        <p className="text-xs text-gray-500 mb-3">Comprometieron adelanto, pendiente de pago</p>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {pendienteAdelanto.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Sin pagos pendientes</p>
          ) : (
            pendienteAdelanto.map(c => (
              <KanbanCard
                key={c.id}
                cotizacion={c}
                onView={() => onVerDetalles(c)}
                onWhatsApp={() => onWhatsApp(c)}
                onDownloadPdf={() => onDescargarPdf(c)}
                onRegistrarAdelanto={() => onRegistrarPagoAdelanto(c)}
                onRechazar={() => onRechazar(c)}
                onActualizarDiasEntrega={async (dias) => {
                  if (!userId) return;
                  try {
                    await onActualizarDiasEntrega(c.id, dias, userId);
                  } catch (error) {
                    console.error('Error actualizando días de entrega:', error);
                  }
                }}
                showAdelanto={true}
                showRechazar={true}
                showDiasEntrega={true}
              />
            ))
          )}
        </div>
      </div>

      {/* Columna 3: LISTAS PARA CONFIRMAR */}
      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <h3 className="font-semibold text-gray-700">Listas</h3>
          <Badge variant="success" size="sm">{listasParaConfirmar.length}</Badge>
        </div>
        <p className="text-xs text-gray-500 mb-3">Pueden confirmarse como venta</p>

        {sinAdelanto.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Sin adelanto ({sinAdelanto.length}) - 7 días
            </div>
            <div className="space-y-2">
              {sinAdelanto.map(c => (
                <KanbanCard
                  key={c.id}
                  cotizacion={c}
                  onView={() => onVerDetalles(c)}
                  onWhatsApp={() => onWhatsApp(c)}
                  onDownloadPdf={() => onDescargarPdf(c)}
                  onRegistrarAdelanto={() => onComprometerAdelanto(c)}
                  onConfirmar={() => onConfirmar(c)}
                  onRechazar={() => onRechazar(c)}
                  showAdelanto={true}
                  showConfirmar={true}
                  showRechazar={true}
                />
              ))}
            </div>
          </div>
        )}

        {conAdelantoPagado.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Con adelanto ({conAdelantoPagado.length}) - Stock reservado
            </div>
            <div className="space-y-2">
              {conAdelantoPagado.map(c => (
                <KanbanCard
                  key={c.id}
                  cotizacion={c}
                  onView={() => onVerDetalles(c)}
                  onWhatsApp={() => onWhatsApp(c)}
                  onDownloadPdf={() => onDescargarPdf(c)}
                  onConfirmar={() => onConfirmar(c)}
                  showConfirmar={true}
                />
              ))}
            </div>
          </div>
        )}

        {listasParaConfirmar.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">Sin cotizaciones listas</p>
        )}
      </div>

      {/* Columna 4: ARCHIVO */}
      <div className="space-y-4">
        {/* Sección: CONFIRMADAS */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <h3 className="font-semibold text-gray-700">Confirmadas</h3>
            <Badge variant="info" size="sm">{confirmadas.length}</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-3">Convertidas en venta</p>
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {confirmadas.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Sin confirmadas</p>
            ) : (
              confirmadas.map(c => (
                <div key={c.id} className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-600">{c.numeroCotizacion}</span>
                    {c.numeroVenta && (
                      <a
                        href={`/ventas?id=${c.ventaId}`}
                        className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1 hover:bg-green-200 transition-colors"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {c.numeroVenta}
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 truncate">{c.nombreCliente}</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(c.totalPEN)}</p>
                  {c.fechaConfirmacion && (
                    <p className="text-xs text-gray-500 mt-1">
                      Confirmada: {c.fechaConfirmacion.toDate?.().toLocaleDateString('es-PE')}
                    </p>
                  )}
                  <div className="flex gap-1 mt-2 pt-2 border-t">
                    <button
                      onClick={() => onVerDetalles(c)}
                      className="flex-1 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4 mx-auto" />
                    </button>
                    {c.ventaId && (
                      <a
                        href={`/ventas?id=${c.ventaId}`}
                        className="flex-1 p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Ir a la venta"
                      >
                        <ExternalLink className="h-4 w-4 mx-auto" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sección: RECHAZADAS */}
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <h3 className="font-semibold text-gray-700">Archivo</h3>
            <Badge variant="danger" size="sm">{rechazadas.length}</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-3">Rechazadas y vencidas (análisis)</p>
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {rechazadas.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Sin rechazos</p>
            ) : (
              rechazadas.map(c => (
                <div key={c.id} className="bg-white border border-red-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-semibold text-red-600">{c.numeroCotizacion}</span>
                    {c.rechazo?.motivo && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                        {MOTIVOS_RECHAZO.find(m => m.value === c.rechazo?.motivo)?.label || c.rechazo.motivo}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 truncate">{c.nombreCliente}</p>
                  <p className="text-lg font-bold text-gray-500 line-through">{formatCurrency(c.totalPEN)}</p>
                  <div className="flex gap-1 mt-2 pt-2 border-t">
                    <button
                      onClick={() => onVerDetalles(c)}
                      className="flex-1 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    >
                      <Eye className="h-4 w-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => onEliminar(c)}
                      className="flex-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Archive className="h-4 w-4 mx-auto" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
