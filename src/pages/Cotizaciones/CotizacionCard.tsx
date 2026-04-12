import React from 'react';
import { formatFecha } from '../../utils/dateFormatters';
import { formatCurrencyPEN } from '../../utils/format';
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  Package,
  MessageCircle,
  CheckCircle,
  XCircle,
  Trash2,
  FileText,
  Copy,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Button, Badge } from '../../components/common';
import { DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import type { Venta } from '../../types/venta.types';

interface CotizacionCardProps {
  cotizacion: Venta;
  onConfirmar: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
  onWhatsApp: () => void;
  onRegistrarAdelanto?: () => void;
}

export const CotizacionCard: React.FC<CotizacionCardProps> = ({
  cotizacion,
  onConfirmar,
  onCancelar,
  onEliminar,
  onWhatsApp,
  onRegistrarAdelanto
}) => {
  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);


  const getCanalBadge = (canal: string) => {
    const badges: Record<string, { variant: 'default' | 'info' | 'success', label: string }> = {
      'mercado_libre': { variant: 'info', label: 'Mercado Libre' },
      'directo': { variant: 'success', label: 'Venta Directa' },
      'otro': { variant: 'default', label: 'Otro' }
    };
    return badges[canal] || { variant: 'default', label: canal };
  };

  const handleCopiarResumen = () => {
    const productos = cotizacion.productos.map(p =>
      `• ${p.cantidad}x ${p.marca} ${p.nombreComercial} - ${formatCurrency(p.subtotal)}`
    ).join('\n');

    const texto = `COTIZACIÓN ${cotizacion.numeroVenta}\n` +
      `Cliente: ${cotizacion.nombreCliente}\n` +
      `Fecha: ${formatFecha(cotizacion.fechaCreacion)}\n\n` +
      `PRODUCTOS:\n${productos}\n\n` +
      `TOTAL: ${formatCurrency(cotizacion.totalPEN)}`;

    navigator.clipboard.writeText(texto);
    alert('Resumen copiado al portapapeles');
  };

  const canalBadge = getCanalBadge(cotizacion.canal);

  return (
    <div className="space-y-6">
      {/* Header con número y estado */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <FileText className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {cotizacion.numeroVenta}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="warning">Cotización</Badge>
              <Badge variant={canalBadge.variant}>{canalBadge.label}</Badge>
              {cotizacion.requiereStock && (
                <Badge variant="danger">Requiere Stock</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-teal-600">
            {formatCurrency(cotizacion.totalPEN)}
          </div>
          <div className="text-xs text-slate-500">
            {cotizacion.productos.length} producto(s)
          </div>
        </div>
      </div>

      {/* Alerta de stock requerido */}
      {cotizacion.requiereStock && cotizacion.productosConFaltante && cotizacion.productosConFaltante.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-800">
                Esta cotización requiere conseguir stock
              </div>
              <div className="text-sm text-amber-700 mt-2 space-y-1">
                {cotizacion.productosConFaltante.map((p, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{p.nombre}</span>
                    <span className="font-medium">
                      Disponible: {p.disponibles} / Solicitado: {p.solicitados}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-amber-600 mt-3">
                Debes conseguir el stock faltante antes de confirmar esta cotización como venta.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información del Cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Datos del Cliente
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-slate-400" />
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {cotizacion.nombreCliente}
                </div>
                {cotizacion.dniRuc && (
                  <div className="text-xs text-slate-500">
                    DNI/RUC: {cotizacion.dniRuc}
                  </div>
                )}
              </div>
            </div>

            {cotizacion.telefonoCliente && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-slate-400" />
                <a
                  href={`tel:${cotizacion.telefonoCliente}`}
                  className="text-sm text-teal-600 hover:underline"
                >
                  {cotizacion.telefonoCliente}
                </a>
              </div>
            )}

            {cotizacion.emailCliente && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <a
                  href={`mailto:${cotizacion.emailCliente}`}
                  className="text-sm text-teal-600 hover:underline"
                >
                  {cotizacion.emailCliente}
                </a>
              </div>
            )}

            {cotizacion.direccionEntrega && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                <div className="text-sm text-slate-700">
                  {cotizacion.direccionEntrega}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Información
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-slate-400" />
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Fecha de Creación
                </div>
                <div className="text-xs text-slate-500">
                  {formatFecha(cotizacion.fechaCreacion)}
                </div>
              </div>
            </div>

            {cotizacion.observaciones && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Observaciones
                </div>
                <div className="text-sm text-slate-700">
                  {cotizacion.observaciones}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Productos Cotizados
        </h3>

        {(() => {
          type ProductoCotizacion = typeof cotizacion.productos[number];
          const productoColumns: DataTableColumn<ProductoCotizacion>[] = [
            {
              key: 'producto',
              header: 'Producto',
              render: (p) => (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.sku}</div>
                    <div className="text-xs text-slate-500">{p.marca} - {p.nombreComercial}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'cantidad',
              header: 'Cantidad',
              align: 'center',
              render: (p) => <span className="text-sm font-medium">{p.cantidad}</span>,
            },
            {
              key: 'precioUnitario',
              header: 'Precio Unit.',
              align: 'right',
              render: (p) => <span className="text-sm">{formatCurrency(p.precioUnitario)}</span>,
            },
            {
              key: 'subtotal',
              header: 'Subtotal',
              align: 'right',
              render: (p) => <span className="text-sm font-medium">{formatCurrency(p.subtotal)}</span>,
            },
          ];
          return (
            <DataTable
              columns={productoColumns}
              data={cotizacion.productos}
              keyExtractor={(p) => p.productoId}
              compact
            />
          );
        })()}

        {/* Totales */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span>{formatCurrency(cotizacion.subtotalPEN)}</span>
            </div>
            {cotizacion.descuento && cotizacion.descuento > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Descuento:</span>
                <span className="text-red-600">
                  -{formatCurrency(cotizacion.descuento)}
                </span>
              </div>
            )}
            {!cotizacion.incluyeEnvio && cotizacion.costoEnvio && cotizacion.costoEnvio > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Envío:</span>
                <span>{formatCurrency(cotizacion.costoEnvio)}</span>
              </div>
            )}
            {cotizacion.incluyeEnvio && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Envío:</span>
                <span className="text-emerald-600">Gratis</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold">Total:</span>
              <span className="text-lg font-bold text-teal-600">
                {formatCurrency(cotizacion.totalPEN)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 pt-4 border-t">
        {onRegistrarAdelanto && (
          <Button
            onClick={onRegistrarAdelanto}
            variant="ghost"
            className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
          >
            <Lock className="h-4 w-4 mr-2" />
            Registrar Adelanto
          </Button>
        )}

        <Button onClick={onConfirmar} variant="primary">
          <CheckCircle className="h-4 w-4 mr-2" />
          Confirmar como Venta
        </Button>

        {cotizacion.telefonoCliente && (
          <Button onClick={onWhatsApp} variant="secondary">
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar WhatsApp
          </Button>
        )}

        <Button onClick={handleCopiarResumen} variant="outline">
          <Copy className="h-4 w-4 mr-2" />
          Copiar Resumen
        </Button>

        <div className="flex-1" />

        <Button onClick={onCancelar} variant="ghost">
          <XCircle className="h-4 w-4 mr-2" />
          Cancelar
        </Button>

        <Button onClick={onEliminar} variant="danger">
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </Button>
      </div>
    </div>
  );
};
