import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
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
  CreditCard,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { Button, Badge } from '../../common';
import { useToastStore } from '../../../store/toastStore';
import { envioCrudService } from '../../../services/envio.crud.service';
import { pdfService, type DespachoPDFData } from '../../../services/pdf.service';
import type { Envio } from '../../../types/envio.types';
import type { Venta } from '../../../types/venta.types';

interface EntregasVentaProps {
  ventaId: string;
  venta: Venta;
  /** Compat con VentaCard · el panel es solo-lectura (las acciones viven en Envíos). */
  onEntregaCompletada?: () => void;
}

const estadoConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; icon: React.ReactNode }> = {
  programada: { label: 'Programada', variant: 'info', icon: <Clock className="h-4 w-4" /> },
  en_camino: { label: 'En Camino', variant: 'warning', icon: <Truck className="h-4 w-4" /> },
  entregada: { label: 'Entregada', variant: 'success', icon: <CheckCircle className="h-4 w-4" /> },
  fallida: { label: 'Fallida', variant: 'danger', icon: <XCircle className="h-4 w-4" /> },
  reprogramada: { label: 'Reprogramada', variant: 'warning', icon: <Calendar className="h-4 w-4" /> },
  cancelada: { label: 'Cancelada', variant: 'danger', icon: <XCircle className="h-4 w-4" /> },
};

/**
 * Construye el DTO de PDF de despacho combinando el Envío F (logística/courier/COD)
 * con la Venta (productos y precios · el envío F no guarda precios).
 */
function toDespachoPDFData(envio: Envio, venta: Venta): DespachoPDFData {
  const productos = (envio.productosSummary || []).map((s) => {
    const vp = venta.productos.find((p) => p.productoId === s.productoId);
    const precioUnitario = vp?.precioUnitario || 0;
    return {
      marca: s.marca || vp?.marca || '',
      nombreComercial: s.nombre,
      cantidad: s.cantidad,
      precioUnitario,
      subtotal: precioUnitario * s.cantidad,
    };
  });
  const subtotalPEN = productos.reduce((sum, p) => sum + p.subtotal, 0);

  return {
    codigo: envio.numeroEnvio,
    numeroVenta: envio.ventaNumero || venta.numeroVenta,
    numeroEntrega: envio.numeroEntrega ?? 1,
    totalEntregas: envio.totalEntregas,
    nombreTransportista: envio.colaboradorNombre || '—',
    nombreCliente: envio.destinoClienteNombre || venta.nombreCliente || '—',
    telefonoCliente: envio.destinoClienteTelefono,
    direccionEntrega: envio.destinoClienteDireccion || venta.direccionEntrega || '—',
    distrito: envio.destinoClienteDistrito || venta.distrito,
    provincia: envio.destinoClienteProvincia || venta.provincia,
    codigoPostal: envio.destinoClienteCodigoPostal || venta.codigoPostal,
    referencia: envio.destinoClienteReferencia || venta.referencia,
    coordenadas: envio.destinoCoordenadas || venta.coordenadas || undefined,
    productos,
    cantidadItems: envio.totalUnidades,
    subtotalPEN,
    cobroPendiente: envio.cobroPendiente ?? false,
    montoPorCobrar: envio.montoPorCobrar,
    metodoPagoEsperado: envio.metodoPagoEsperado,
    fechaProgramada: envio.fechaLlegadaEstimada,
    horaProgramada: envio.horaProgramada,
  };
}

/**
 * Panel de despachos dentro del detalle de la Venta.
 *
 * MODELO ÚNICO (Envío · Caso F): este panel es SOLO LECTURA — muestra el estado de
 * los despachos F de la venta + imprime guía/cargo + cross-link a Envíos, donde se
 * OPERAN (despachar/cobrar/reprogramar). No re-implementa el ciclo (canon no-redundancia).
 */
export const EntregasVenta: React.FC<EntregasVentaProps> = ({ ventaId, venta }) => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [despachos, setDespachos] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const cargar = async () => {
      try {
        const envios = await envioCrudService.getByVenta(ventaId);
        // Excluye borradores (drafts no operativos): no deben contar en el resumen ni
        // habilitar impresión de guía/cargo sin fecha programada.
        if (alive) setDespachos(envios.filter((e) => e.estado !== 'borrador'));
      } catch (error) {
        console.error('Error cargando despachos:', error);
      } finally {
        if (alive) setLoading(false);
      }
    };
    cargar();
    return () => { alive = false; };
  }, [ventaId]);

  const handlePrintGuia = async (envio: Envio) => {
    try {
      await pdfService.downloadGuiaTransportista(toDespachoPDFData(envio, venta));
    } catch (error) {
      console.error('Error generando guia:', error);
      toast.error('Error al generar la guia de transportista');
    }
  };

  const handlePrintCargo = async (envio: Envio) => {
    try {
      await pdfService.downloadCargoCliente(toDespachoPDFData(envio, venta));
    } catch (error) {
      console.error('Error generando cargo:', error);
      toast.error('Error al generar el cargo de cliente');
    }
  };

  const verEnEnvios = (envio: Envio) => {
    navigate(`/envios?envioId=${envio.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (despachos.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500">
        <Truck className="h-10 w-10 mx-auto mb-2 text-slate-400" />
        <p>No hay despachos registrados para esta venta</p>
        <p className="text-xs text-slate-400 mt-1">El despacho se gestiona desde el módulo Envíos.</p>
      </div>
    );
  }

  const entregados = despachos.filter((e) => e.estado === 'entregada').length;
  const fleteTotal = despachos.reduce((sum, e) => sum + (e.costoDeliveryPEN || 0), 0);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="bg-sky-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-sky-600 mr-2" />
            <span className="font-medium text-slate-900">Despachos de la Venta</span>
          </div>
          <Badge variant={entregados === despachos.length ? 'success' : 'warning'}>
            {entregados} / {despachos.length} entregado(s)
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 text-sm">
          <div>
            <span className="text-slate-500 text-xs sm:text-sm">Despachos</span>
            <p className="font-semibold text-slate-900 tabular-nums">{despachos.length}</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs sm:text-sm">Entregados</span>
            <p className="font-semibold text-slate-900 tabular-nums">{entregados}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-500 text-xs sm:text-sm">Flete total</span>
            <p className="font-semibold text-amber-600 tabular-nums">S/ {fleteTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Lista de despachos (solo lectura) */}
      <div className="space-y-3">
        {despachos.map((envio) => {
          const estadoInfo = estadoConfig[envio.estado] || { label: envio.estado, variant: 'default' as const, icon: <Package className="h-4 w-4" /> };

          return (
            <div
              key={envio.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    envio.tipoTransportista === 'interno' ? 'bg-sky-100' : 'bg-purple-100'
                  }`}>
                    <Truck className={`h-5 w-5 ${
                      envio.tipoTransportista === 'interno' ? 'text-sky-600' : 'text-purple-600'
                    }`} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{envio.numeroEnvio}</div>
                    {envio.numeroEntrega != null && (
                      <div className="text-sm text-slate-500">
                        Entrega {envio.numeroEntrega}{envio.totalEntregas ? ` de ${envio.totalEntregas}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={estadoInfo.variant}>
                  <span className="flex items-center gap-1">
                    {estadoInfo.icon}
                    {estadoInfo.label}
                  </span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm mb-3">
                <div>
                  <div className="flex items-center text-slate-500 mb-1">
                    <Truck className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Transportista</span>
                  </div>
                  <div className="font-medium text-slate-900">{envio.colaboradorNombre || '—'}</div>
                  {envio.telefonoTransportista && (
                    <a href={`tel:${envio.telefonoTransportista}`} className="text-slate-500 flex items-center mt-1 hover:text-sky-600">
                      <Phone className="h-3 w-3 mr-1" />
                      {envio.telefonoTransportista}
                    </a>
                  )}
                </div>
                <div>
                  <div className="flex items-center text-slate-500 mb-1">
                    <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Programada</span>
                  </div>
                  <div className="font-medium text-slate-900">
                    {envio.fechaLlegadaEstimada ? formatDate(envio.fechaLlegadaEstimada) : '—'}
                  </div>
                  {envio.horaProgramada && (
                    <div className="text-slate-500">{envio.horaProgramada}</div>
                  )}
                </div>
              </div>

              {(envio.destinoClienteDireccion || venta.direccionEntrega) && (
                <div className="flex items-start text-sm text-slate-600 mb-3">
                  <MapPin className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>
                    {envio.destinoClienteDireccion || venta.direccionEntrega}
                    {(envio.destinoClienteDistrito || venta.distrito) && ` - ${envio.destinoClienteDistrito || venta.distrito}`}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                  <span className="text-slate-500">
                    <Package className="h-4 w-4 inline mr-1" />
                    {envio.totalUnidades} items
                  </span>
                  {envio.cobroPendiente && envio.montoPorCobrar != null && !envio.cobroRealizado && (
                    <span className="text-amber-600 font-medium">
                      <CreditCard className="h-3.5 w-3.5 inline mr-1" />
                      Cobrar: S/ {envio.montoPorCobrar.toFixed(2)}
                    </span>
                  )}
                  {envio.cobroRealizado && envio.montoRecaudado != null && (
                    <Badge variant="success" className="text-xs">
                      Cobrado: S/ {envio.montoRecaudado.toFixed(2)}
                    </Badge>
                  )}
                  <span className={`font-medium ${(envio.costoDeliveryPEN || 0) > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                    <DollarSign className="h-3.5 w-3.5 inline mr-0.5" />
                    Flete: S/ {(envio.costoDeliveryPEN || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handlePrintGuia(envio)} title="Guia para transportista">
                    <FileText className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Guia</span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handlePrintCargo(envio)} title="Cargo para cliente">
                    <Printer className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Cargo</span>
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => verEnEnvios(envio)} title="Operar en el módulo Envíos">
                    <ExternalLink className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Ver en Envíos</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
