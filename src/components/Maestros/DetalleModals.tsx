/**
 * Modales de Detalle para Entidades Maestras
 * Muestran información consolidada de cada entidad
 */
import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShoppingCart,
  DollarSign,
  Tag,
  TrendingUp,
  Package,
  Truck,
  ExternalLink,
  Globe,
  Warehouse,
  Plane,
  Clock,
  AlertTriangle,
  Shield,
  Crown,
  BarChart3,
  Hash,
  Building2
} from 'lucide-react';
import { Badge, Card, KPICard, KPIGrid } from '../common';
import type { Cliente } from '../../types/entidadesMaestras.types';
import type { Marca } from '../../types/entidadesMaestras.types';
import type { Proveedor } from '../../types/ordenCompra.types';
import type { Almacen } from '../../types/almacen.types';
import type { Competidor } from '../../types/entidadesMaestras.types';

// ============================================
// COMPONENTE BASE PARA MODALES DE DETALLE
// ============================================

interface DetailModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: { text: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' };
  children: React.ReactNode;
}

const DetailModalBase: React.FC<DetailModalBaseProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                {badge && (
                  <Badge variant={badge.variant}>{badge.text}</Badge>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content with scroll */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MODAL DE DETALLE DE CLIENTE
// ============================================

interface ClienteDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onEdit?: () => void;
  onViewHistory?: () => void;  // Ver historial financiero del cliente
}

export const ClienteDetalleModal: React.FC<ClienteDetalleModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onEdit,
  onViewHistory
}) => {
  if (!cliente) return null;

  const formatFecha = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const diasDesdeUltimaCompra = () => {
    if (!cliente.metricas?.ultimaCompra) return null;
    const ultima = cliente.metricas.ultimaCompra.toDate?.() || new Date(cliente.metricas.ultimaCompra);
    const dias = Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
    return dias;
  };

  const dias = diasDesdeUltimaCompra();

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={cliente.nombre}
      subtitle={`${cliente.codigo} · Cliente desde ${formatFecha(cliente.fechaCreacion)}`}
      badge={{
        text: cliente.estado,
        variant: cliente.estado === 'activo' ? 'success' : cliente.estado === 'potencial' ? 'info' : 'default'
      }}
    >
      <div className="space-y-6">
        {/* KPIs principales */}
        <div className="flex items-center justify-between">
          <KPIGrid columns={4}>
            <KPICard
              title="Total Compras"
              value={cliente.metricas?.totalCompras || 0}
              icon={ShoppingCart}
              variant="info"
              size="sm"
            />
            <KPICard
              title="Monto Total"
              value={`S/ ${(cliente.metricas?.montoTotalPEN || 0).toLocaleString()}`}
              icon={DollarSign}
              variant="success"
              size="sm"
            />
            <KPICard
              title="Ticket Promedio"
              value={`S/ ${(cliente.metricas?.ticketPromedio || 0).toFixed(0)}`}
              icon={TrendingUp}
              variant="default"
              size="sm"
            />
            <KPICard
              title="Última Compra"
              value={dias !== null ? `${dias} días` : 'Sin compras'}
              subtitle={dias !== null ? formatFecha(cliente.metricas?.ultimaCompra) : undefined}
              icon={Calendar}
              variant={dias !== null && dias > 60 ? 'warning' : 'default'}
              size="sm"
            />
          </KPIGrid>
        </div>

        {/* Botón de historial financiero */}
        {onViewHistory && (
          <div className="flex justify-end">
            <button
              onClick={onViewHistory}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
            >
              <DollarSign className="h-4 w-4" />
              Ver Historial Financiero Completo
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información de contacto */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              Información de Contacto
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm">
                  {cliente.telefono || 'Sin teléfono'}
                  {cliente.telefonoAlt && ` / ${cliente.telefonoAlt}`}
                </span>
              </div>
              {cliente.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{cliente.email}</span>
                </div>
              )}
              {cliente.dniRuc && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {cliente.dniRuc.length === 11 ? 'RUC' : 'DNI'}: {cliente.dniRuc}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm capitalize">
                  {cliente.tipoCliente === 'persona' ? 'Persona Natural' : 'Empresa'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-gray-400" />
                <span className="text-sm">
                  Canal: <span className="capitalize">{cliente.canalOrigen.replace('_', ' ')}</span>
                </span>
              </div>
            </div>
          </Card>

          {/* Etiquetas y notas */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-gray-500" />
              Segmentación
            </h4>
            {cliente.etiquetas && cliente.etiquetas.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {cliente.etiquetas.map((etiqueta, idx) => (
                  <Badge key={idx} variant="info">{etiqueta}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">Sin etiquetas asignadas</p>
            )}

            {cliente.notas && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Notas:</p>
                <p className="text-sm text-gray-700">{cliente.notas}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Direcciones */}
        {cliente.direcciones && cliente.direcciones.length > 0 && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              Direcciones de Entrega
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cliente.direcciones.map((dir) => (
                <div
                  key={dir.id}
                  className={`p-3 rounded-lg border ${dir.esPrincipal ? 'border-primary-300 bg-primary-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{dir.etiqueta}</span>
                    {dir.esPrincipal && <Badge variant="info" size="sm">Principal</Badge>}
                  </div>
                  <p className="text-sm text-gray-600">{dir.direccion}</p>
                  {dir.distrito && (
                    <p className="text-xs text-gray-500">{dir.distrito}, {dir.ciudad}</p>
                  )}
                  {dir.referencia && (
                    <p className="text-xs text-gray-400 mt-1">Ref: {dir.referencia}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Productos favoritos placeholder */}
        {cliente.metricas?.productosFavoritos && cliente.metricas.productosFavoritos.length > 0 && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Productos Favoritos
            </h4>
            <p className="text-sm text-gray-500">
              {cliente.metricas.productosFavoritos.length} productos identificados como favoritos
            </p>
          </Card>
        )}
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE ALMACÉN/VIAJERO
// ============================================

interface AlmacenDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  almacen: Almacen | null;
  inventarioData?: {
    unidadesActuales: number;
    valorUSD: number;
    capacidadUsada: number;
  };
  onEdit?: () => void;
  onViewHistory?: () => void;  // Ver historial financiero del viajero
}

export const AlmacenDetalleModal: React.FC<AlmacenDetalleModalProps> = ({
  isOpen,
  onClose,
  almacen,
  inventarioData,
  onEdit,
  onViewHistory
}) => {
  if (!almacen) return null;

  const formatFecha = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const proximoViajeDias = () => {
    if (!almacen.proximoViaje) return null;
    const fecha = almacen.proximoViaje.toDate?.() || new Date(almacen.proximoViaje);
    const dias = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return dias;
  };

  const diasViaje = proximoViajeDias();
  const unidades = inventarioData?.unidadesActuales ?? almacen.unidadesActuales ?? 0;
  const valorUSD = inventarioData?.valorUSD ?? almacen.valorInventarioUSD ?? 0;
  const capacidadUsada = inventarioData?.capacidadUsada ??
    (almacen.capacidadUnidades ? (unidades / almacen.capacidadUnidades) * 100 : 0);

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={almacen.nombre}
      subtitle={`${almacen.codigo} · ${almacen.esViajero ? 'Viajero' : 'Almacén'} · ${almacen.pais}`}
      badge={{
        text: almacen.estadoAlmacen,
        variant: almacen.estadoAlmacen === 'activo' ? 'success' : 'default'
      }}
    >
      <div className="space-y-6">
        {/* KPIs principales */}
        <KPIGrid columns={4}>
          <KPICard
            title="Unidades Actuales"
            value={unidades.toLocaleString()}
            subtitle={almacen.capacidadUnidades ? `de ${almacen.capacidadUnidades} máx` : undefined}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Valor Inventario"
            value={`$${valorUSD.toLocaleString()}`}
            subtitle="USD"
            icon={DollarSign}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Capacidad Usada"
            value={`${capacidadUsada.toFixed(0)}%`}
            icon={BarChart3}
            variant={capacidadUsada >= 90 ? 'danger' : capacidadUsada >= 70 ? 'warning' : 'success'}
            size="sm"
          />
          {almacen.esViajero && (
            <KPICard
              title="Próximo Viaje"
              value={diasViaje !== null && diasViaje >= 0 ? `${diasViaje} días` : 'Sin programar'}
              subtitle={diasViaje !== null ? formatFecha(almacen.proximoViaje) : undefined}
              icon={Plane}
              variant={diasViaje !== null && diasViaje <= 7 ? 'warning' : 'default'}
              size="sm"
            />
          )}
        </KPIGrid>

        {/* Barra de capacidad visual */}
        {almacen.capacidadUnidades && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-3">Capacidad del Almacén</h4>
            <div className="relative">
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    capacidadUsada >= 90 ? 'bg-red-500' :
                    capacidadUsada >= 70 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(capacidadUsada, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>{unidades} unidades</span>
                <span>{almacen.capacidadUnidades} máximo</span>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ubicación */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              Ubicación
            </h4>
            <div className="space-y-2">
              <p className="text-sm">{almacen.direccion}</p>
              <p className="text-sm text-gray-600">
                {almacen.ciudad}{almacen.estado ? `, ${almacen.estado}` : ''} - {almacen.pais}
              </p>
              {almacen.codigoPostal && (
                <p className="text-xs text-gray-500">CP: {almacen.codigoPostal}</p>
              )}
            </div>
          </Card>

          {/* Contacto */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              Contacto
            </h4>
            <div className="space-y-3">
              {almacen.contacto && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{almacen.contacto}</span>
                </div>
              )}
              {almacen.telefono && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{almacen.telefono}</span>
                </div>
              )}
              {almacen.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{almacen.email}</span>
                </div>
              )}
              {almacen.whatsapp && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-green-500" />
                  <span className="text-sm">WhatsApp: {almacen.whatsapp}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Info específica de viajero */}
        {almacen.esViajero && (
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Plane className="h-5 w-5 text-purple-500" />
                Informacion del Viajero
              </h4>
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <DollarSign className="h-4 w-4" />
                  Ver Historial Financiero
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Frecuencia de Viaje</p>
                <p className="text-sm font-medium capitalize">{almacen.frecuenciaViaje || 'Variable'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Costo Promedio Flete</p>
                <p className="text-sm font-medium">
                  ${almacen.costoPromedioFlete?.toFixed(2) || '0.00'} USD/unidad
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Unidades Recibidas (Total)</p>
                <p className="text-sm font-medium">{almacen.totalUnidadesRecibidas?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Unidades Enviadas (Total)</p>
                <p className="text-sm font-medium">{almacen.totalUnidadesEnviadas?.toLocaleString() || 0}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Métricas históricas */}
        <Card padding="md">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            Métricas Históricas
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Tiempo Promedio Almacenamiento</p>
              <p className="text-sm font-medium">{almacen.tiempoPromedioAlmacenamiento || 0} días</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha de Registro</p>
              <p className="text-sm font-medium">{formatFecha(almacen.fechaCreacion)}</p>
            </div>
            {almacen.fechaActualizacion && (
              <div>
                <p className="text-xs text-gray-500">Última Actualización</p>
                <p className="text-sm font-medium">{formatFecha(almacen.fechaActualizacion)}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Notas */}
        {almacen.notas && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-2">Notas</h4>
            <p className="text-sm text-gray-700">{almacen.notas}</p>
          </Card>
        )}
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE MARCA
// ============================================

interface MarcaDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  marca: Marca | null;
  onEdit?: () => void;
}

export const MarcaDetalleModal: React.FC<MarcaDetalleModalProps> = ({
  isOpen,
  onClose,
  marca,
  onEdit
}) => {
  if (!marca) return null;

  const formatFecha = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={marca.nombre}
      subtitle={`${marca.codigo} · ${marca.tipoMarca}`}
      badge={{
        text: marca.estado,
        variant: marca.estado === 'activa' ? 'success' : marca.estado === 'inactiva' ? 'warning' : 'danger'
      }}
    >
      <div className="space-y-6">
        {/* KPIs principales */}
        <KPIGrid columns={3}>
          <KPICard
            title="Productos Activos"
            value={marca.metricas?.productosActivos || 0}
            subtitle={`de ${marca.metricas?.totalProductos || 0} totales`}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Unidades Vendidas"
            value={(marca.metricas?.unidadesVendidas || 0).toLocaleString()}
            icon={ShoppingCart}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Ingresos Generados"
            value={`S/ ${(marca.metricas?.ingresosTotalesPEN || 0).toLocaleString()}`}
            icon={DollarSign}
            variant="success"
            size="sm"
          />
        </KPIGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información general */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-gray-500" />
              Información de la Marca
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Tipo de Marca</p>
                <p className="text-sm font-medium capitalize">{marca.tipoMarca}</p>
              </div>
              {marca.paisOrigen && (
                <div>
                  <p className="text-xs text-gray-500">País de Origen</p>
                  <p className="text-sm font-medium">{marca.paisOrigen}</p>
                </div>
              )}
              {marca.sitioWeb && (
                <div>
                  <p className="text-xs text-gray-500">Sitio Web</p>
                  <a
                    href={marca.sitioWeb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    {marca.sitioWeb}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Alias */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4">Nombres Alternativos (Alias)</h4>
            {marca.alias && marca.alias.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {marca.alias.map((alias, idx) => (
                  <Badge key={idx} variant="default">{alias}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin alias registrados</p>
            )}
            <p className="text-xs text-gray-400 mt-3">
              Los alias permiten identificar la marca aunque el nombre esté mal escrito
            </p>
          </Card>
        </div>

        {/* Descripción y notas */}
        {(marca.descripcion || marca.notas) && (
          <Card padding="md">
            {marca.descripcion && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Descripción</h4>
                <p className="text-sm text-gray-700">{marca.descripcion}</p>
              </div>
            )}
            {marca.notas && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Notas</h4>
                <p className="text-sm text-gray-700">{marca.notas}</p>
              </div>
            )}
          </Card>
        )}

        {/* Fechas */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>Creada: {formatFecha(marca.fechaCreacion)}</span>
          {marca.fechaActualizacion && (
            <span>Última actualización: {formatFecha(marca.fechaActualizacion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE PROVEEDOR
// ============================================

interface ProveedorDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  proveedor: Proveedor | null;
  onEdit?: () => void;
}

export const ProveedorDetalleModal: React.FC<ProveedorDetalleModalProps> = ({
  isOpen,
  onClose,
  proveedor,
  onEdit
}) => {
  if (!proveedor) return null;

  const formatFecha = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={proveedor.nombre}
      subtitle={`${proveedor.codigo} · ${proveedor.tipo} · ${proveedor.pais}`}
      badge={{
        text: proveedor.activo ? 'Activo' : 'Inactivo',
        variant: proveedor.activo ? 'success' : 'default'
      }}
    >
      <div className="space-y-6">
        {/* KPIs principales */}
        <KPIGrid columns={4}>
          <KPICard
            title="Productos Analizados"
            value={proveedor.metricas?.productosAnalizados || 0}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Órdenes de Compra"
            value={proveedor.metricas?.ordenesCompra?.total || 0}
            icon={ShoppingCart}
            variant="default"
            size="sm"
          />
          <KPICard
            title="Monto Comprado"
            value={`$${(proveedor.metricas?.montoTotalUSD || 0).toLocaleString()}`}
            subtitle="USD"
            icon={DollarSign}
            variant="success"
            size="sm"
          />
          <KPICard
            title="Precio Promedio"
            value={`$${(proveedor.metricas?.precioPromedio || 0).toFixed(2)}`}
            icon={TrendingUp}
            variant="default"
            size="sm"
          />
        </KPIGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información del proveedor */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-gray-500" />
              Información del Proveedor
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Tipo</p>
                <p className="text-sm font-medium capitalize">{proveedor.tipo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">País</p>
                <p className="text-sm font-medium">{proveedor.pais}</p>
              </div>
              {proveedor.url && (
                <div>
                  <p className="text-xs text-gray-500">URL</p>
                  <a
                    href={proveedor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1 break-all"
                  >
                    {proveedor.url}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Métricas de órdenes */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Desempeño
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Órdenes Completadas</span>
                <span className="text-sm font-medium">{proveedor.metricas?.ordenesCompra?.completadas || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Órdenes Pendientes</span>
                <span className="text-sm font-medium">{proveedor.metricas?.ordenesCompra?.pendientes || 0}</span>
              </div>
              {proveedor.metricas?.ultimaCompra && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Última Compra</span>
                  <span className="text-sm font-medium">{formatFecha(proveedor.metricas.ultimaCompra)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Notas */}
        {proveedor.notas && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-2">Notas</h4>
            <p className="text-sm text-gray-700">{proveedor.notas}</p>
          </Card>
        )}

        {/* Fechas */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>Registrado: {formatFecha(proveedor.fechaCreacion)}</span>
          {proveedor.fechaActualizacion && (
            <span>Última actualización: {formatFecha(proveedor.fechaActualizacion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE COMPETIDOR
// ============================================

interface CompetidorDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  competidor: Competidor | null;
  onEdit?: () => void;
}

export const CompetidorDetalleModal: React.FC<CompetidorDetalleModalProps> = ({
  isOpen,
  onClose,
  competidor,
  onEdit
}) => {
  if (!competidor) return null;

  const formatFecha = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getNivelAmenazaColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'danger';
      case 'medio': return 'warning';
      case 'bajo': return 'success';
      default: return 'default';
    }
  };

  const getReputacionColor = (rep: string) => {
    switch (rep) {
      case 'excelente': return 'success';
      case 'buena': return 'info';
      case 'regular': return 'warning';
      case 'mala': return 'danger';
      default: return 'default';
    }
  };

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={competidor.nombre}
      subtitle={`${competidor.codigo} · ${competidor.plataformaPrincipal.replace('_', ' ')}`}
      badge={{
        text: competidor.estado,
        variant: competidor.estado === 'activo' ? 'success' : 'default'
      }}
    >
      <div className="space-y-6">
        {/* KPIs principales */}
        <KPIGrid columns={4}>
          <KPICard
            title="Nivel de Amenaza"
            value={competidor.nivelAmenaza.toUpperCase()}
            icon={Shield}
            variant={getNivelAmenazaColor(competidor.nivelAmenaza) as any}
            size="sm"
          />
          <KPICard
            title="Productos Analizados"
            value={competidor.metricas?.productosAnalizados || 0}
            icon={Package}
            variant="info"
            size="sm"
          />
          <KPICard
            title="Precio Promedio"
            value={`S/ ${(competidor.metricas?.precioPromedio || 0).toFixed(2)}`}
            icon={DollarSign}
            variant="default"
            size="sm"
          />
          <KPICard
            title="Reputación"
            value={competidor.reputacion}
            icon={Crown}
            variant={getReputacionColor(competidor.reputacion) as any}
            size="sm"
          />
        </KPIGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información del competidor */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              Información del Competidor
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Plataforma Principal</p>
                <p className="text-sm font-medium capitalize">{competidor.plataformaPrincipal.replace('_', ' ')}</p>
              </div>
              {competidor.urlTienda && (
                <div>
                  <p className="text-xs text-gray-500">URL de Tienda</p>
                  <a
                    href={competidor.urlTienda}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1 break-all"
                  >
                    {competidor.urlTienda}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
              {competidor.esLiderCategoria && (
                <div className="flex items-center gap-2 mt-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700">Líder de Categoría</span>
                </div>
              )}
            </div>
          </Card>

          {/* Alias */}
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-4">Nombres Alternativos (Alias)</h4>
            {competidor.alias && competidor.alias.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {competidor.alias.map((alias, idx) => (
                  <Badge key={idx} variant="default">{alias}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin alias registrados</p>
            )}
          </Card>
        </div>

        {/* Análisis de amenaza */}
        <Card padding="md">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Análisis de Amenaza
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Nivel</p>
              <Badge variant={getNivelAmenazaColor(competidor.nivelAmenaza) as any}>
                {competidor.nivelAmenaza.toUpperCase()}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reputación</p>
              <Badge variant={getReputacionColor(competidor.reputacion) as any}>
                {competidor.reputacion}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Último Análisis</p>
              <p className="text-sm font-medium">{formatFecha(competidor.metricas?.ultimoAnalisis)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Categorías Coincidentes</p>
              <p className="text-sm font-medium">{competidor.categoriasCoincidentes?.length || 0}</p>
            </div>
          </div>
        </Card>

        {/* Categorías */}
        {competidor.categoriasCoincidentes && competidor.categoriasCoincidentes.length > 0 && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-3">Categorías en las que Compite</h4>
            <div className="flex flex-wrap gap-2">
              {competidor.categoriasCoincidentes.map((cat, idx) => (
                <Badge key={idx} variant="info">{cat}</Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Notas */}
        {competidor.notas && (
          <Card padding="md">
            <h4 className="font-semibold text-gray-900 mb-2">Notas</h4>
            <p className="text-sm text-gray-700">{competidor.notas}</p>
          </Card>
        )}

        {/* Fechas */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>Registrado: {formatFecha(competidor.fechaCreacion)}</span>
          {competidor.fechaActualizacion && (
            <span>Última actualización: {formatFecha(competidor.fechaActualizacion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};
