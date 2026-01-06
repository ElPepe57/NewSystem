import React, { useEffect, useState } from 'react';
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Printer,
  MapPin,
  Phone,
  Calendar,
  PlayCircle
} from 'lucide-react';
import { Button, Badge } from '../../common';
import { useEntregaStore } from '../../../store/entregaStore';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { pdfService } from '../../../services/pdf.service';
import { invalidarCacheGastos } from '../../../hooks/useRentabilidadVentas';
import type { Entrega, EstadoEntrega } from '../../../types/entrega.types';
import type { Venta } from '../../../types/venta.types';

interface EntregasVentaProps {
  ventaId: string;
  venta: Venta;
  /** Callback cuando se completa una entrega - para refrescar rentabilidad en el padre */
  onEntregaCompletada?: () => void;
}

const estadoConfig: Record<EstadoEntrega, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; icon: React.ReactNode }> = {
  programada: { label: 'Programada', variant: 'info', icon: <Clock className="h-4 w-4" /> },
  en_camino: { label: 'En Camino', variant: 'warning', icon: <Truck className="h-4 w-4" /> },
  entregada: { label: 'Entregada', variant: 'success', icon: <CheckCircle className="h-4 w-4" /> },
  fallida: { label: 'Fallida', variant: 'danger', icon: <XCircle className="h-4 w-4" /> },
  reprogramada: { label: 'Reprogramada', variant: 'warning', icon: <Calendar className="h-4 w-4" /> },
  cancelada: { label: 'Cancelada', variant: 'danger', icon: <XCircle className="h-4 w-4" /> }
};

const courierLabels: Record<string, string> = {
  olva: 'Olva',
  mercado_envios: 'M. Envíos',
  urbano: 'Urbano',
  shalom: 'Shalom',
  otro: 'Otro'
};

export const EntregasVenta: React.FC<EntregasVentaProps> = ({ ventaId, venta, onEntregaCompletada }) => {
  const { fetchByVenta, fetchResumenVenta, resumenVenta, marcarEnCamino, registrarResultado } = useEntregaStore();
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const entregasVenta = await fetchByVenta(ventaId);
        setEntregas(entregasVenta);
        await fetchResumenVenta(ventaId);
      } catch (error) {
        console.error('Error cargando entregas:', error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [ventaId, fetchByVenta, fetchResumenVenta]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handlePrintGuia = async (entrega: Entrega) => {
    try {
      await pdfService.downloadGuiaTransportista(entrega);
    } catch (error) {
      console.error('Error generando guía:', error);
      alert('Error al generar la guía de transportista');
    }
  };

  const handlePrintCargo = async (entrega: Entrega) => {
    try {
      await pdfService.downloadCargoCliente(entrega);
    } catch (error) {
      console.error('Error generando cargo:', error);
      alert('Error al generar el cargo de cliente');
    }
  };

  // Marcar entrega como "en camino"
  const handleMarcarEnCamino = async (entrega: Entrega) => {
    if (!user) return;
    setProcesando(entrega.id);
    try {
      await marcarEnCamino(entrega.id, user.uid);
      // Recargar entregas
      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      toast.success(`Entrega ${entrega.codigo} marcada como en camino`);
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar entrega');
    } finally {
      setProcesando(null);
    }
  };

  // Marcar entrega como completada (exitosa)
  const handleCompletarEntrega = async (entrega: Entrega) => {
    if (!user) return;

    const confirmar = window.confirm(
      `¿Confirmar que la entrega ${entrega.codigo} fue exitosa?\n\n` +
      `Esto creará automáticamente el gasto GD de S/ ${(entrega.costoTransportista || 0).toFixed(2)}.`
    );
    if (!confirmar) return;

    setProcesando(entrega.id);
    try {
      await registrarResultado({
        entregaId: entrega.id,
        exitosa: true,
        notasEntrega: 'Entrega completada desde panel de ventas'
      }, user.uid);

      // Recargar entregas y resumen
      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      await fetchResumenVenta(ventaId);

      toast.success(
        `Entrega ${entrega.codigo} completada. GD de S/ ${(entrega.costoTransportista || 0).toFixed(2)} registrado.`,
        'Entrega Exitosa'
      );

      // Invalidar cache y notificar al padre para que refresque la rentabilidad
      // Esperar un momento para que Firestore sincronice
      setTimeout(() => {
        invalidarCacheGastos();
        if (onEntregaCompletada) {
          onEntregaCompletada();
        }
      }, 500);
    } catch (error: any) {
      toast.error(error.message || 'Error al completar entrega');
    } finally {
      setProcesando(null);
    }
  };

  // Marcar entrega como fallida
  const handleMarcarFallida = async (entrega: Entrega) => {
    if (!user) return;

    const motivo = window.prompt('Ingresa el motivo de la entrega fallida:');
    if (!motivo) return;

    setProcesando(entrega.id);
    try {
      await registrarResultado({
        entregaId: entrega.id,
        exitosa: false,
        motivoFallo: motivo,
        notasEntrega: `Fallida: ${motivo}`
      }, user.uid);

      // Recargar entregas
      const entregasActualizadas = await fetchByVenta(ventaId);
      setEntregas(entregasActualizadas);
      await fetchResumenVenta(ventaId);

      toast.warning(`Entrega ${entrega.codigo} marcada como fallida`);
    } catch (error: any) {
      toast.error(error.message || 'Error al marcar entrega como fallida');
    } finally {
      setProcesando(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (entregas.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Truck className="h-10 w-10 mx-auto mb-2 text-gray-400" />
        <p>No hay entregas programadas para esta venta</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {resumenVenta && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-medium text-gray-900">Resumen de Entregas</span>
            </div>
            <Badge variant={resumenVenta.entregaCompleta ? 'success' : 'warning'}>
              {resumenVenta.entregaCompleta ? 'Entrega Completa' : 'Entrega Parcial'}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
            <div>
              <span className="text-gray-500">Productos Entregados</span>
              <p className="font-semibold text-gray-900">
                {resumenVenta.productosEntregados} / {resumenVenta.totalProductos}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Entregas</span>
              <p className="font-semibold text-gray-900">{resumenVenta.entregas.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Costo Distribución</span>
              <p className="font-semibold text-amber-600">
                S/ {resumenVenta.costoTotalDistribucion.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de entregas */}
      <div className="space-y-3">
        {entregas.map((entrega) => {
          const estadoInfo = estadoConfig[entrega.estado];

          return (
            <div
              key={entrega.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    entrega.tipoTransportista === 'interno' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    <Truck className={`h-5 w-5 ${
                      entrega.tipoTransportista === 'interno' ? 'text-blue-600' : 'text-purple-600'
                    }`} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{entrega.codigo}</div>
                    <div className="text-sm text-gray-500">
                      Entrega {entrega.numeroEntrega}{entrega.totalEntregas ? ` de ${entrega.totalEntregas}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={estadoInfo.variant}>
                    <span className="flex items-center gap-1">
                      {estadoInfo.icon}
                      {estadoInfo.label}
                    </span>
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <div className="flex items-center text-gray-500 mb-1">
                    <Truck className="h-4 w-4 mr-1" />
                    Transportista
                  </div>
                  <div className="font-medium text-gray-900">
                    {entrega.nombreTransportista}
                    {entrega.courierExterno && (
                      <span className="text-gray-500 ml-1">
                        ({courierLabels[entrega.courierExterno]})
                      </span>
                    )}
                  </div>
                  {entrega.telefonoTransportista && (
                    <div className="text-gray-500 flex items-center mt-1">
                      <Phone className="h-3 w-3 mr-1" />
                      {entrega.telefonoTransportista}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center text-gray-500 mb-1">
                    <Calendar className="h-4 w-4 mr-1" />
                    Programada
                  </div>
                  <div className="font-medium text-gray-900">
                    {formatDate(entrega.fechaProgramada)}
                  </div>
                  {entrega.horaProgramada && (
                    <div className="text-gray-500">{entrega.horaProgramada}</div>
                  )}
                </div>
              </div>

              <div className="flex items-start text-sm text-gray-600 mb-3">
                <MapPin className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0 text-gray-400" />
                <span>
                  {entrega.direccionEntrega}
                  {entrega.distrito && ` - ${entrega.distrito}`}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    <Package className="h-4 w-4 inline mr-1" />
                    {entrega.cantidadItems} items
                  </span>
                  {entrega.cobroPendiente && entrega.montoPorCobrar && (
                    <span className="text-amber-600 font-medium">
                      Cobrar: S/ {entrega.montoPorCobrar.toFixed(2)}
                    </span>
                  )}
                  <span className="text-gray-500">
                    GD: S/ {(entrega.costoTransportista || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePrintGuia(entrega)}
                    title="Guía para transportista"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Guía
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePrintCargo(entrega)}
                    title="Cargo para cliente"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Cargo
                  </Button>
                </div>
              </div>

              {/* Botones de acción según estado */}
              {(entrega.estado === 'programada' || entrega.estado === 'en_camino' || entrega.estado === 'reprogramada') && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t mt-3">
                  {entrega.estado === 'programada' && (
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => handleMarcarEnCamino(entrega)}
                      disabled={procesando === entrega.id}
                    >
                      <PlayCircle className="h-4 w-4 mr-1" />
                      {procesando === entrega.id ? 'Procesando...' : 'Iniciar Entrega'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleCompletarEntrega(entrega)}
                    disabled={procesando === entrega.id}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {procesando === entrega.id ? 'Procesando...' : 'Completar Entrega'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleMarcarFallida(entrega)}
                    disabled={procesando === entrega.id}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Fallida
                  </Button>
                </div>
              )}

              {entrega.numeroTracking && (
                <div className="mt-2 pt-2 border-t text-sm">
                  <span className="text-gray-500">Tracking:</span>
                  <span className="font-mono ml-2 text-gray-900">{entrega.numeroTracking}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
