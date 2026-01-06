/**
 * Modales de Detalle para Entidades Maestras - VERSIÓN PROFESIONAL
 * Dashboard mini con KPIs accionables, insights y diseño enterprise
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
  TrendingDown,
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
  Building2,
  Target,
  Percent,
  CreditCard,
  Star,
  Activity,
  Boxes,
  Eye,
  Zap,
  Award,
  Users,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Badge, Card } from '../common';
import {
  HealthScore,
  ProgressBar,
  InsightCard,
  MetricComparison,
  StatTile,
  SectionHeader,
  DataTableMini,
  QuickInsightBadge,
  TwoColumnLayout
} from './AdvancedKPIs';
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
  code?: string;
  badge?: { text: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' };
  headerColor?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const DetailModalBase: React.FC<DetailModalBaseProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  code,
  badge,
  headerColor = 'from-slate-600 to-slate-800',
  children,
  actions
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header con gradiente */}
          <div className={`bg-gradient-to-r ${headerColor} px-6 py-5`}>
            <div className="flex items-start justify-between">
              <div className="text-white">
                {code && (
                  <span className="inline-block px-2 py-0.5 bg-white/20 rounded text-xs font-mono mb-2">
                    {code}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">{title}</h3>
                  {badge && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      badge.variant === 'success' ? 'bg-green-400/20 text-green-100' :
                      badge.variant === 'warning' ? 'bg-yellow-400/20 text-yellow-100' :
                      badge.variant === 'danger' ? 'bg-red-400/20 text-red-100' :
                      badge.variant === 'info' ? 'bg-blue-400/20 text-blue-100' :
                      'bg-white/20 text-white'
                    }`}>
                      {badge.text}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-white/70 text-sm mt-1">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content with scroll */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// UTILIDADES
// ============================================

const formatFecha = (timestamp: any) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatMoney = (amount: number, currency: string = 'S/') => {
  return `${currency} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const diasDesde = (timestamp: any): number | null => {
  if (!timestamp) return null;
  const date = timestamp.toDate?.() || new Date(timestamp);
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================
// MODAL DE DETALLE DE CLIENTE - PROFESIONAL
// ============================================

interface ClienteDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onEdit?: () => void;
  onViewHistory?: () => void;
}

export const ClienteDetalleModal: React.FC<ClienteDetalleModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onEdit,
  onViewHistory
}) => {
  if (!cliente) return null;

  const dias = diasDesde(cliente.metricas?.ultimaCompra);
  const totalCompras = cliente.metricas?.totalCompras || 0;
  const montoTotal = cliente.metricas?.montoTotalPEN || 0;
  const ticketPromedio = cliente.metricas?.ticketPromedio || 0;

  // Calcular score de cliente (0-100)
  const calcularScore = (): number => {
    let score = 0;
    // Por compras (max 40 puntos)
    if (totalCompras >= 10) score += 40;
    else if (totalCompras >= 5) score += 30;
    else if (totalCompras >= 2) score += 20;
    else if (totalCompras >= 1) score += 10;

    // Por monto (max 30 puntos)
    if (montoTotal >= 5000) score += 30;
    else if (montoTotal >= 2000) score += 20;
    else if (montoTotal >= 500) score += 10;

    // Por recencia (max 30 puntos)
    if (dias === null) score += 0;
    else if (dias <= 30) score += 30;
    else if (dias <= 60) score += 20;
    else if (dias <= 90) score += 10;

    return score;
  };

  const score = calcularScore();

  // Determinar insights del cliente
  const getInsights = () => {
    const insights: { type: 'positive' | 'negative' | 'warning' | 'neutral'; title: string; description: string; metric?: string }[] = [];

    if (totalCompras >= 5 && dias !== null && dias <= 30) {
      insights.push({
        type: 'positive',
        title: 'Cliente Recurrente',
        description: 'Compra con frecuencia y recientemente',
        metric: `${totalCompras} compras`
      });
    }

    if (dias !== null && dias > 60 && totalCompras > 0) {
      insights.push({
        type: 'warning',
        title: 'En Riesgo de Inactividad',
        description: `Han pasado ${dias} días sin comprar`,
        metric: formatFecha(cliente.metricas?.ultimaCompra)
      });
    }

    if (ticketPromedio > 200) {
      insights.push({
        type: 'positive',
        title: 'Alto Ticket Promedio',
        description: 'Cliente de alto valor por transacción',
        metric: formatMoney(ticketPromedio)
      });
    }

    if (totalCompras === 0) {
      insights.push({
        type: 'neutral',
        title: 'Cliente Nuevo',
        description: 'Aún no ha realizado su primera compra'
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={cliente.nombre}
      code={cliente.codigo}
      subtitle={`Cliente desde ${formatFecha(cliente.fechaCreacion)}`}
      headerColor="from-blue-600 to-indigo-700"
      badge={{
        text: cliente.estado.toUpperCase(),
        variant: cliente.estado === 'activo' ? 'success' : cliente.estado === 'potencial' ? 'info' : 'default'
      }}
      actions={
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg text-sm"
            >
              Editar
            </button>
          )}
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="text-white bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              Ver Historial
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Dashboard Header - Score y KPIs principales */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Health Score */}
            <div className="flex flex-col items-center justify-center lg:border-r lg:pr-6">
              <HealthScore score={score} label="Score Cliente" size="lg" />
              <span className={`text-xs font-medium mt-2 px-2 py-0.5 rounded-full ${
                score >= 70 ? 'bg-green-100 text-green-700' :
                score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {score >= 70 ? 'PREMIUM' : score >= 40 ? 'REGULAR' : 'NUEVO/INACTIVO'}
              </span>
            </div>

            {/* KPIs Grid */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Total Compras"
                value={totalCompras}
                icon={ShoppingCart}
                variant="primary"
              />
              <StatTile
                label="Monto Total"
                value={formatMoney(montoTotal)}
                icon={DollarSign}
                variant="success"
              />
              <StatTile
                label="Ticket Promedio"
                value={formatMoney(ticketPromedio)}
                icon={Target}
                variant="default"
              />
              <StatTile
                label="Última Compra"
                value={dias !== null ? `${dias}d` : 'Sin compras'}
                icon={Calendar}
                variant={dias !== null && dias > 60 ? 'warning' : 'default'}
              />
            </div>
          </div>
        </div>

        {/* Insights automáticos */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight, idx) => (
              <InsightCard key={idx} {...insight} />
            ))}
          </div>
        )}

        {/* Contenido en 2 columnas */}
        <TwoColumnLayout
          left={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Información de Contacto"
                icon={User}
                iconColor="text-blue-500"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">{cliente.telefono || 'Sin teléfono'}</p>
                    {cliente.telefonoAlt && (
                      <p className="text-xs text-gray-500">Alt: {cliente.telefonoAlt}</p>
                    )}
                  </div>
                </div>
                {cliente.email && (
                  <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <p className="text-sm">{cliente.email}</p>
                  </div>
                )}
                {cliente.dniRuc && (
                  <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">{cliente.dniRuc.length === 11 ? 'RUC' : 'DNI'}</p>
                      <p className="text-sm font-medium">{cliente.dniRuc}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Tipo</p>
                    <p className="text-sm font-medium capitalize">
                      {cliente.tipoCliente === 'persona' ? 'Persona Natural' : 'Empresa'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Canal de Origen</p>
                    <p className="text-sm font-medium capitalize">{cliente.canalOrigen.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </Card>
          }
          right={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Segmentación y Etiquetas"
                icon={Tag}
                iconColor="text-purple-500"
              />
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
                  <p className="text-xs text-gray-500 mb-1">Notas</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{cliente.notas}</p>
                </div>
              )}

              {/* Productos favoritos */}
              {cliente.metricas?.productosFavoritos && cliente.metricas.productosFavoritos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <p className="text-xs font-medium text-gray-700">Productos Favoritos</p>
                  </div>
                  <p className="text-sm text-gray-600">
                    {cliente.metricas.productosFavoritos.length} productos identificados
                  </p>
                </div>
              )}
            </Card>
          }
        />

        {/* Direcciones */}
        {cliente.direcciones && cliente.direcciones.length > 0 && (
          <Card padding="md">
            <SectionHeader
              title="Direcciones de Entrega"
              subtitle={`${cliente.direcciones.length} direcciones registradas`}
              icon={MapPin}
              iconColor="text-green-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cliente.direcciones.map((dir) => (
                <div
                  key={dir.id}
                  className={`p-3 rounded-lg border-2 ${dir.esPrincipal ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{dir.etiqueta}</span>
                    {dir.esPrincipal && (
                      <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded">Principal</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{dir.direccion}</p>
                  {dir.distrito && (
                    <p className="text-xs text-gray-500">{dir.distrito}, {dir.ciudad}</p>
                  )}
                  {dir.referencia && (
                    <p className="text-xs text-gray-400 mt-1 italic">Ref: {dir.referencia}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE MARCA - PROFESIONAL
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

  const productosActivos = marca.metricas?.productosActivos || 0;
  const unidadesVendidas = marca.metricas?.unidadesVendidas || 0;
  const ventasTotal = marca.metricas?.ventasTotalPEN || 0;
  const margenPromedio = marca.metricas?.margenPromedio || 0;

  // Calcular score de marca
  const calcularScore = (): number => {
    let score = 0;
    // Por productos (max 25)
    if (productosActivos >= 10) score += 25;
    else if (productosActivos >= 5) score += 15;
    else if (productosActivos >= 1) score += 5;

    // Por ventas (max 35)
    if (ventasTotal >= 10000) score += 35;
    else if (ventasTotal >= 5000) score += 25;
    else if (ventasTotal >= 1000) score += 15;
    else if (ventasTotal > 0) score += 5;

    // Por margen (max 40)
    if (margenPromedio >= 40) score += 40;
    else if (margenPromedio >= 30) score += 30;
    else if (margenPromedio >= 20) score += 20;
    else if (margenPromedio > 0) score += 10;

    return score;
  };

  const score = calcularScore();

  // Insights de la marca
  const getInsights = () => {
    const insights: { type: 'positive' | 'negative' | 'warning' | 'neutral'; title: string; description: string; metric?: string }[] = [];

    if (margenPromedio >= 35) {
      insights.push({
        type: 'positive',
        title: 'Alta Rentabilidad',
        description: 'Margen superior al promedio del mercado',
        metric: `${margenPromedio.toFixed(1)}%`
      });
    } else if (margenPromedio < 20 && margenPromedio > 0) {
      insights.push({
        type: 'warning',
        title: 'Margen Bajo',
        description: 'Revisar precios o costos de esta marca',
        metric: `${margenPromedio.toFixed(1)}%`
      });
    }

    if (unidadesVendidas >= 100) {
      insights.push({
        type: 'positive',
        title: 'Alto Volumen',
        description: 'Marca con buena rotación de inventario',
        metric: `${unidadesVendidas} uds`
      });
    }

    if (productosActivos === 0) {
      insights.push({
        type: 'negative',
        title: 'Sin Productos',
        description: 'Esta marca no tiene productos activos en catálogo'
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={marca.nombre}
      code={marca.codigo}
      subtitle={`${marca.tipoMarca} · ${marca.paisOrigen || 'Origen no especificado'}`}
      headerColor="from-green-600 to-emerald-700"
      badge={{
        text: marca.estado.toUpperCase(),
        variant: marca.estado === 'activa' ? 'success' : marca.estado === 'inactiva' ? 'warning' : 'danger'
      }}
      actions={onEdit && (
        <button
          onClick={onEdit}
          className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg text-sm"
        >
          Editar
        </button>
      )}
    >
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Score */}
            <div className="flex flex-col items-center justify-center lg:border-r lg:pr-6">
              <HealthScore score={score} label="Score Marca" size="lg" />
              <span className={`text-xs font-medium mt-2 px-2 py-0.5 rounded-full ${
                score >= 70 ? 'bg-green-100 text-green-700' :
                score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {score >= 70 ? 'ESTRELLA' : score >= 40 ? 'REGULAR' : 'BAJA PERFORMANCE'}
              </span>
            </div>

            {/* KPIs */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Productos Activos"
                value={productosActivos}
                icon={Package}
                variant="primary"
              />
              <StatTile
                label="Unidades Vendidas"
                value={unidadesVendidas.toLocaleString()}
                icon={ShoppingCart}
                variant="default"
              />
              <StatTile
                label="Ventas Totales"
                value={formatMoney(ventasTotal)}
                icon={DollarSign}
                variant="success"
              />
              <StatTile
                label="Margen Promedio"
                value={`${margenPromedio.toFixed(1)}%`}
                icon={Percent}
                variant={margenPromedio >= 30 ? 'success' : margenPromedio >= 20 ? 'warning' : 'danger'}
              />
            </div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight, idx) => (
              <InsightCard key={idx} {...insight} />
            ))}
          </div>
        )}

        {/* Contenido */}
        <TwoColumnLayout
          left={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Información de la Marca"
                icon={Tag}
                iconColor="text-green-500"
              />
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Tipo de Marca</span>
                  <span className="text-sm font-medium capitalize">{marca.tipoMarca}</span>
                </div>
                {marca.paisOrigen && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">País de Origen</span>
                    <span className="text-sm font-medium">{marca.paisOrigen}</span>
                  </div>
                )}
                {marca.metricas?.ultimaVenta && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Última Venta</span>
                    <span className="text-sm font-medium">{formatFecha(marca.metricas.ultimaVenta)}</span>
                  </div>
                )}
                {marca.sitioWeb && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-1">Sitio Web</p>
                    <a
                      href={marca.sitioWeb.startsWith('http') ? marca.sitioWeb : `https://${marca.sitioWeb}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {marca.sitioWeb}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Alias */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Nombres Alternativos (Alias)</p>
                {marca.alias && marca.alias.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {marca.alias.map((alias, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {alias}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin alias registrados</p>
                )}
              </div>
            </Card>
          }
          right={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Proveedores Preferidos"
                icon={Truck}
                iconColor="text-purple-500"
              />
              {marca.proveedoresPreferidos && marca.proveedoresPreferidos.length > 0 ? (
                <div className="space-y-2">
                  {marca.proveedoresPreferidos.map((prov, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{prov.nombreProveedor}</span>
                      {prov.esPrincipal && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Sin proveedores preferidos configurados</p>
              )}

              {/* Notas */}
              {(marca.descripcion || marca.notas) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {marca.descripcion && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">Descripción</p>
                      <p className="text-sm text-gray-600">{marca.descripcion}</p>
                    </div>
                  )}
                  {marca.notas && (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Notas</p>
                      <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">{marca.notas}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          }
        />

        {/* Footer con fechas */}
        <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
          <span>Creada: {formatFecha(marca.fechaCreacion)}</span>
          {marca.fechaActualizacion && (
            <span>Actualizada: {formatFecha(marca.fechaActualizacion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE PROVEEDOR - PROFESIONAL
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

  const ordenesCompra = proveedor.metricas?.ordenesCompra || 0;
  const ordenesCompletadas = proveedor.metricas?.ordenesCompletadas || 0;
  const montoTotal = proveedor.metricas?.montoTotalUSD || 0;
  const productosAnalizados = proveedor.metricas?.productosAnalizados || 0;
  const precioPromedio = proveedor.metricas?.precioPromedio || 0;

  // Tasa de cumplimiento
  const tasaCumplimiento = ordenesCompra > 0 ? (ordenesCompletadas / ordenesCompra) * 100 : 0;

  // Score del proveedor
  const calcularScore = (): number => {
    let score = 0;
    // Por órdenes (max 30)
    if (ordenesCompra >= 10) score += 30;
    else if (ordenesCompra >= 5) score += 20;
    else if (ordenesCompra >= 1) score += 10;

    // Por cumplimiento (max 40)
    if (tasaCumplimiento >= 90) score += 40;
    else if (tasaCumplimiento >= 70) score += 25;
    else if (tasaCumplimiento >= 50) score += 10;

    // Por monto (max 30)
    if (montoTotal >= 10000) score += 30;
    else if (montoTotal >= 5000) score += 20;
    else if (montoTotal >= 1000) score += 10;

    return score;
  };

  const score = calcularScore();

  // Insights
  const getInsights = () => {
    const insights: { type: 'positive' | 'negative' | 'warning' | 'neutral'; title: string; description: string; metric?: string }[] = [];

    if (tasaCumplimiento >= 90) {
      insights.push({
        type: 'positive',
        title: 'Excelente Cumplimiento',
        description: 'Proveedor muy confiable',
        metric: `${tasaCumplimiento.toFixed(0)}%`
      });
    } else if (tasaCumplimiento < 70 && ordenesCompra > 0) {
      insights.push({
        type: 'warning',
        title: 'Cumplimiento Bajo',
        description: 'Revisar performance del proveedor',
        metric: `${tasaCumplimiento.toFixed(0)}%`
      });
    }

    if (ordenesCompra - ordenesCompletadas > 2) {
      insights.push({
        type: 'warning',
        title: 'Órdenes Pendientes',
        description: `${ordenesCompra - ordenesCompletadas} órdenes sin completar`
      });
    }

    if (productosAnalizados > 10) {
      insights.push({
        type: 'positive',
        title: 'Amplio Catálogo',
        description: 'Proveedor con variedad de productos analizados',
        metric: `${productosAnalizados} productos`
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={proveedor.nombre}
      code={proveedor.codigo}
      subtitle={`${proveedor.tipo} · ${proveedor.pais}`}
      headerColor="from-purple-600 to-violet-700"
      badge={{
        text: proveedor.activo ? 'ACTIVO' : 'INACTIVO',
        variant: proveedor.activo ? 'success' : 'default'
      }}
      actions={onEdit && (
        <button
          onClick={onEdit}
          className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg text-sm"
        >
          Editar
        </button>
      )}
    >
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Score y Cumplimiento */}
            <div className="flex flex-col items-center justify-center lg:border-r lg:pr-6">
              <HealthScore score={score} label="Score Proveedor" size="lg" />
              <div className="mt-3 text-center">
                <ProgressBar
                  value={ordenesCompletadas}
                  max={ordenesCompra}
                  label="Tasa de Cumplimiento"
                  size="sm"
                />
              </div>
            </div>

            {/* KPIs */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Órdenes Compra"
                value={ordenesCompra}
                icon={ShoppingCart}
                variant="primary"
              />
              <StatTile
                label="Completadas"
                value={ordenesCompletadas}
                icon={CheckCircle}
                variant="success"
              />
              <StatTile
                label="Monto Total"
                value={`$${montoTotal.toLocaleString()}`}
                icon={DollarSign}
                variant="success"
              />
              <StatTile
                label="Productos Investigados"
                value={productosAnalizados}
                icon={Eye}
                variant="default"
              />
            </div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight, idx) => (
              <InsightCard key={idx} {...insight} />
            ))}
          </div>
        )}

        {/* Contenido */}
        <TwoColumnLayout
          left={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Información del Proveedor"
                icon={Truck}
                iconColor="text-purple-500"
              />
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Tipo</span>
                  <span className="text-sm font-medium capitalize">{proveedor.tipo}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">País</span>
                  <span className="text-sm font-medium">{proveedor.pais}</span>
                </div>
                {proveedor.contacto && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Contacto</span>
                    <span className="text-sm font-medium">{proveedor.contacto}</span>
                  </div>
                )}
                {proveedor.email && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Email</span>
                    <a href={`mailto:${proveedor.email}`} className="text-sm text-blue-600 hover:underline">
                      {proveedor.email}
                    </a>
                  </div>
                )}
                {proveedor.telefono && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Teléfono</span>
                    <span className="text-sm font-medium">{proveedor.telefono}</span>
                  </div>
                )}
                {proveedor.url && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-1">URL</p>
                    <a
                      href={proveedor.url.startsWith('http') ? proveedor.url : `https://${proveedor.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {proveedor.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </Card>
          }
          right={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Desempeño en Compras"
                icon={BarChart3}
                iconColor="text-blue-500"
              />
              <div className="space-y-3">
                <MetricComparison
                  title="Órdenes Completadas"
                  current={ordenesCompletadas}
                  previous={ordenesCompra}
                  format="number"
                />
                <MetricComparison
                  title="Pendientes"
                  current={ordenesCompra - ordenesCompletadas}
                  previous={ordenesCompra}
                  format="number"
                  invertColors
                />
                {proveedor.metricas?.ultimaCompra && (
                  <div className="flex justify-between py-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Última Compra</span>
                    <span className="text-sm font-medium">{formatFecha(proveedor.metricas.ultimaCompra)}</span>
                  </div>
                )}
              </div>

              {/* Productos comprados */}
              {proveedor.metricas?.productosComprados && proveedor.metricas.productosComprados.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    SKUs Comprados ({proveedor.metricas.productosComprados.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {proveedor.metricas.productosComprados.slice(0, 8).map((sku: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {sku}
                      </span>
                    ))}
                    {proveedor.metricas.productosComprados.length > 8 && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                        +{proveedor.metricas.productosComprados.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          }
        />

        {/* Notas */}
        {proveedor.notasInternas && (
          <Card padding="md">
            <SectionHeader title="Notas Internas" icon={FileText} iconColor="text-gray-500" />
            <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">{proveedor.notasInternas}</p>
          </Card>
        )}

        {/* Footer */}
        <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
          <span>Registrado: {formatFecha(proveedor.fechaCreacion)}</span>
          {proveedor.ultimaEdicion && (
            <span>Actualizado: {formatFecha(proveedor.ultimaEdicion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE ALMACÉN/VIAJERO - PROFESIONAL
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
  onViewHistory?: () => void;
}

// Interfaz para métricas calculadas en tiempo real
interface MetricasAlmacenCalculadas {
  unidadesActuales: number;
  valorInventarioUSD: number;
  totalUnidadesRecibidas: number;
  totalUnidadesEnviadas: number;
  tiempoPromedioAlmacenamiento: number;
  loading: boolean;
}

export const AlmacenDetalleModal: React.FC<AlmacenDetalleModalProps> = ({
  isOpen,
  onClose,
  almacen,
  inventarioData,
  onEdit,
  onViewHistory
}) => {
  // Estado para métricas calculadas en tiempo real
  const [metricas, setMetricas] = useState<MetricasAlmacenCalculadas>({
    unidadesActuales: 0,
    valorInventarioUSD: 0,
    totalUnidadesRecibidas: 0,
    totalUnidadesEnviadas: 0,
    tiempoPromedioAlmacenamiento: 0,
    loading: true
  });

  // Calcular métricas reales desde Firebase cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !almacen) return;

    const calcularMetricasReales = async () => {
      setMetricas(prev => ({ ...prev, loading: true }));

      try {
        // Importar Firebase dinámicamente
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');

        // Obtener todas las unidades de este almacén
        const unidadesQuery = query(
          collection(db, 'unidades'),
          where('almacenId', '==', almacen.id)
        );
        const unidadesSnapshot = await getDocs(unidadesQuery);

        // Filtrar unidades disponibles (excluir estados terminales)
        const estadosExcluidos = ['vendida', 'vencida', 'danada', 'en_transito_peru'];
        let unidadesDisponibles = 0;
        let valorTotal = 0;
        let sumaDiasAlmacenamiento = 0;
        let unidadesConFecha = 0;
        const ahora = Date.now();

        unidadesSnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (!estadosExcluidos.includes(data.estado)) {
            unidadesDisponibles++;
            valorTotal += data.costoUnitarioUSD || 0;

            // Calcular días de almacenamiento basado en fecha de recepción
            // Prioridad: fechaRecepcion > fechaCreacion
            const fechaCampo = data.fechaRecepcion || data.fechaCreacion;
            if (fechaCampo) {
              const fechaIngreso = fechaCampo.toDate?.()
                ? fechaCampo.toDate().getTime()
                : new Date(fechaCampo).getTime();
              const diasEnAlmacen = Math.floor((ahora - fechaIngreso) / (1000 * 60 * 60 * 24));
              if (diasEnAlmacen >= 0) {
                sumaDiasAlmacenamiento += diasEnAlmacen;
                unidadesConFecha++;
              }
            }
          }
        });

        const tiempoPromedio = unidadesConFecha > 0
          ? Math.round(sumaDiasAlmacenamiento / unidadesConFecha)
          : 0;

        // Obtener transferencias para calcular totales históricos
        // Recibidas: transferencias donde este almacén es destino
        const transferenciasRecibidasQuery = query(
          collection(db, 'transferencias'),
          where('almacenDestinoId', '==', almacen.id)
        );
        const transferenciasRecibidas = await getDocs(transferenciasRecibidasQuery);

        let totalRecibidas = 0;
        transferenciasRecibidas.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.estado === 'completada' || data.estado === 'recibida') {
            totalRecibidas += data.cantidadUnidades || data.unidadesIds?.length || 0;
          }
        });

        // Enviadas: transferencias donde este almacén es origen
        const transferenciasEnviadasQuery = query(
          collection(db, 'transferencias'),
          where('almacenOrigenId', '==', almacen.id)
        );
        const transferenciasEnviadas = await getDocs(transferenciasEnviadasQuery);

        let totalEnviadas = 0;
        transferenciasEnviadas.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.estado === 'completada' || data.estado === 'en_transito' || data.estado === 'recibida') {
            totalEnviadas += data.cantidadUnidades || data.unidadesIds?.length || 0;
          }
        });

        setMetricas({
          unidadesActuales: unidadesDisponibles,
          valorInventarioUSD: valorTotal,
          totalUnidadesRecibidas: totalRecibidas || almacen.totalUnidadesRecibidas || 0,
          totalUnidadesEnviadas: totalEnviadas || almacen.totalUnidadesEnviadas || 0,
          tiempoPromedioAlmacenamiento: tiempoPromedio,
          loading: false
        });
      } catch (error) {
        console.error('Error calculando métricas del almacén:', error);
        // Fallback a datos del documento
        setMetricas({
          unidadesActuales: almacen.unidadesActuales || 0,
          valorInventarioUSD: almacen.valorInventarioUSD || 0,
          totalUnidadesRecibidas: almacen.totalUnidadesRecibidas || 0,
          totalUnidadesEnviadas: almacen.totalUnidadesEnviadas || 0,
          tiempoPromedioAlmacenamiento: almacen.tiempoPromedioAlmacenamiento || 0,
          loading: false
        });
      }
    };

    calcularMetricasReales();
  }, [isOpen, almacen]);

  if (!almacen) return null;

  // Usar métricas calculadas en tiempo real o props si se proporcionan
  const unidades = inventarioData?.unidadesActuales ?? metricas.unidadesActuales;
  const valorUSD = inventarioData?.valorUSD ?? metricas.valorInventarioUSD;
  const capacidadMax = almacen.capacidadUnidades || 0;
  const capacidadUsada = capacidadMax > 0 ? (unidades / capacidadMax) * 100 : 0;

  // Próximo viaje
  const proximoViajeDias = (): number | null => {
    if (!almacen.proximoViaje) return null;
    const fecha = almacen.proximoViaje.toDate ? almacen.proximoViaje.toDate() : new Date();
    return Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const diasViaje = proximoViajeDias();

  // Score del almacén
  const calcularScore = (): number => {
    let score = 50; // Base

    // Capacidad óptima (max +30)
    if (capacidadUsada >= 30 && capacidadUsada <= 70) score += 30;
    else if (capacidadUsada >= 20 && capacidadUsada <= 80) score += 20;
    else if (capacidadUsada < 20 || capacidadUsada > 90) score -= 10;

    // Si es viajero, próximo viaje programado (+20)
    if (almacen.esViajero && diasViaje !== null && diasViaje > 0 && diasViaje <= 30) {
      score += 20;
    }

    return Math.min(100, Math.max(0, score));
  };

  const score = calcularScore();

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={almacen.nombre}
      code={almacen.codigo}
      subtitle={`${almacen.esViajero ? 'Viajero' : 'Almacén'} · ${almacen.ciudad || ''} ${almacen.pais}`}
      headerColor={almacen.esViajero ? 'from-violet-600 to-purple-700' : 'from-amber-600 to-orange-700'}
      badge={{
        text: almacen.estadoAlmacen.toUpperCase(),
        variant: almacen.estadoAlmacen === 'activo' ? 'success' : 'default'
      }}
      actions={
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg text-sm"
            >
              Editar
            </button>
          )}
          {onViewHistory && almacen.esViajero && (
            <button
              onClick={onViewHistory}
              className="text-white bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              Historial
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Score y Capacidad */}
            <div className="flex flex-col items-center justify-center lg:border-r lg:pr-6">
              <HealthScore score={score} label="Estado" size="lg" />
              {capacidadMax > 0 && (
                <div className="mt-3 w-32">
                  <ProgressBar
                    value={unidades}
                    max={capacidadMax}
                    size="sm"
                    showValues={false}
                  />
                  <p className="text-xs text-center text-gray-500 mt-1">
                    {capacidadUsada.toFixed(0)}% capacidad
                  </p>
                </div>
              )}
            </div>

            {/* KPIs */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Unidades"
                value={unidades.toLocaleString()}
                icon={Package}
                variant="primary"
              />
              <StatTile
                label="Valor Inventario"
                value={`$${valorUSD.toLocaleString()}`}
                icon={DollarSign}
                variant="success"
              />
              {almacen.esViajero && (
                <StatTile
                  label="Próximo Viaje"
                  value={diasViaje !== null && diasViaje >= 0 ? `${diasViaje}d` : 'Sin programar'}
                  icon={Plane}
                  variant={diasViaje !== null && diasViaje <= 7 ? 'warning' : 'default'}
                />
              )}
              <StatTile
                label="Capacidad Máx"
                value={capacidadMax > 0 ? capacidadMax.toLocaleString() : 'N/A'}
                icon={Boxes}
                variant="default"
              />
            </div>
          </div>
        </div>

        {/* Barra de capacidad visual */}
        {capacidadMax > 0 && (
          <Card padding="md">
            <SectionHeader
              title="Capacidad del Almacén"
              subtitle={`${unidades.toLocaleString()} de ${capacidadMax.toLocaleString()} unidades`}
              icon={BarChart3}
              iconColor="text-amber-500"
            />
            <div className="relative mt-3">
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    capacidadUsada >= 90 ? 'bg-gradient-to-r from-red-400 to-red-600' :
                    capacidadUsada >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                    'bg-gradient-to-r from-green-400 to-green-600'
                  }`}
                  style={{ width: `${Math.min(capacidadUsada, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>{capacidadUsada.toFixed(0)}% usado</span>
                <span>{(100 - capacidadUsada).toFixed(0)}% disponible</span>
              </div>
            </div>
          </Card>
        )}

        {/* Contenido */}
        <TwoColumnLayout
          left={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Ubicación"
                icon={MapPin}
                iconColor="text-green-500"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">{almacen.direccion}</p>
                <p className="text-sm text-gray-600">
                  {almacen.ciudad}{almacen.estado ? `, ${almacen.estado}` : ''} - {almacen.pais}
                </p>
                {almacen.codigoPostal && (
                  <p className="text-xs text-gray-500">CP: {almacen.codigoPostal}</p>
                )}
              </div>

              {/* Contacto */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Contacto</p>
                <div className="space-y-2">
                  {almacen.contacto && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{almacen.contacto}</span>
                    </div>
                  )}
                  {almacen.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{almacen.telefono}</span>
                    </div>
                  )}
                  {almacen.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{almacen.email}</span>
                    </div>
                  )}
                  {almacen.whatsapp && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-green-500" />
                      <span className="text-sm">WhatsApp: {almacen.whatsapp}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          }
          right={
            almacen.esViajero ? (
              <Card padding="md" className="h-full">
                <SectionHeader
                  title="Información del Viajero"
                  icon={Plane}
                  iconColor="text-purple-500"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-xs text-purple-600">Frecuencia de Viaje</p>
                    <p className="text-sm font-bold capitalize">{almacen.frecuenciaViaje || 'Variable'}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600">Costo Flete/Unidad</p>
                    <p className="text-sm font-bold">${almacen.costoPromedioFlete?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-600">Total Recibidas</p>
                    <p className="text-sm font-bold">
                      {metricas.loading ? '...' : metricas.totalUnidadesRecibidas.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg">
                    <p className="text-xs text-amber-600">Total Enviadas</p>
                    <p className="text-sm font-bold">
                      {metricas.loading ? '...' : metricas.totalUnidadesEnviadas.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                    <p className="text-xs text-gray-600">Días Promedio en Almacén</p>
                    <p className="text-sm font-bold">
                      {metricas.loading ? '...' : `${metricas.tiempoPromedioAlmacenamiento} días`}
                    </p>
                  </div>
                </div>

                {diasViaje !== null && diasViaje >= 0 && (
                  <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Plane className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-bold text-purple-800">
                          Próximo viaje en {diasViaje} días
                        </p>
                        <p className="text-xs text-purple-600">
                          {formatFecha(almacen.proximoViaje)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card padding="md" className="h-full">
                <SectionHeader
                  title="Métricas Históricas"
                  icon={BarChart3}
                  iconColor="text-blue-500"
                />
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Tiempo Prom. Almacenamiento</span>
                    <span className="text-sm font-medium">
                      {metricas.loading ? '...' : `${metricas.tiempoPromedioAlmacenamiento} días`}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Fecha de Registro</span>
                    <span className="text-sm font-medium">{formatFecha(almacen.fechaCreacion)}</span>
                  </div>
                  {almacen.fechaActualizacion && (
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-600">Última Actualización</span>
                      <span className="text-sm font-medium">{formatFecha(almacen.fechaActualizacion)}</span>
                    </div>
                  )}
                </div>
              </Card>
            )
          }
        />

        {/* Notas */}
        {almacen.notas && (
          <Card padding="md">
            <SectionHeader title="Notas" icon={FileText} iconColor="text-gray-500" />
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{almacen.notas}</p>
          </Card>
        )}
      </div>
    </DetailModalBase>
  );
};

// ============================================
// MODAL DE DETALLE DE COMPETIDOR - PROFESIONAL
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

  const productosAnalizados = competidor.metricas?.productosAnalizados || 0;
  const precioPromedio = competidor.metricas?.precioPromedio || 0;

  const getNivelAmenazaConfig = (nivel: string) => {
    switch (nivel) {
      case 'alto': return { color: 'from-red-600 to-rose-700', badge: 'danger', label: 'ALTO RIESGO', score: 85 };
      case 'medio': return { color: 'from-yellow-600 to-amber-700', badge: 'warning', label: 'MEDIO', score: 50 };
      case 'bajo': return { color: 'from-green-600 to-emerald-700', badge: 'success', label: 'BAJO', score: 25 };
      default: return { color: 'from-gray-600 to-slate-700', badge: 'default', label: 'DESCONOCIDO', score: 50 };
    }
  };

  const getReputacionConfig = (rep: string) => {
    switch (rep) {
      case 'excelente': return { variant: 'success' as const, icon: Star };
      case 'buena': return { variant: 'primary' as const, icon: CheckCircle };
      case 'regular': return { variant: 'warning' as const, icon: AlertTriangle };
      case 'mala': return { variant: 'danger' as const, icon: XCircle };
      default: return { variant: 'default' as const, icon: Activity };
    }
  };

  const amenazaConfig = getNivelAmenazaConfig(competidor.nivelAmenaza);
  const reputacionConfig = getReputacionConfig(competidor.reputacion);

  // Insights del competidor
  const getInsights = () => {
    const insights: { type: 'positive' | 'negative' | 'warning' | 'neutral'; title: string; description: string; metric?: string }[] = [];

    if (competidor.nivelAmenaza === 'alto') {
      insights.push({
        type: 'negative',
        title: 'Competidor de Alto Riesgo',
        description: 'Monitorear de cerca sus movimientos de precios'
      });
    }

    if (competidor.esLiderCategoria) {
      insights.push({
        type: 'warning',
        title: 'Líder de Categoría',
        description: `Domina: ${competidor.categoriasLider?.join(', ') || 'No especificado'}`
      });
    }

    if (productosAnalizados >= 20) {
      insights.push({
        type: 'neutral',
        title: 'Amplio Análisis',
        description: 'Se ha investigado extensamente este competidor',
        metric: `${productosAnalizados} productos`
      });
    }

    if (competidor.reputacion === 'excelente') {
      insights.push({
        type: 'warning',
        title: 'Alta Reputación',
        description: 'Competidor con excelente imagen de marca'
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <DetailModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={competidor.nombre}
      code={competidor.codigo}
      subtitle={`${competidor.plataformaPrincipal.replace('_', ' ')} · ${competidor.ciudad || 'Ubicación no especificada'}`}
      headerColor={amenazaConfig.color}
      badge={{
        text: competidor.estado.toUpperCase(),
        variant: competidor.estado === 'activo' ? 'success' : 'default'
      }}
      actions={onEdit && (
        <button
          onClick={onEdit}
          className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg text-sm"
        >
          Editar
        </button>
      )}
    >
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Nivel de Amenaza */}
            <div className="flex flex-col items-center justify-center lg:border-r lg:pr-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                competidor.nivelAmenaza === 'alto' ? 'bg-red-100' :
                competidor.nivelAmenaza === 'medio' ? 'bg-yellow-100' :
                'bg-green-100'
              }`}>
                <Shield className={`h-10 w-10 ${
                  competidor.nivelAmenaza === 'alto' ? 'text-red-600' :
                  competidor.nivelAmenaza === 'medio' ? 'text-yellow-600' :
                  'text-green-600'
                }`} />
              </div>
              <span className={`text-xs font-bold mt-2 px-3 py-1 rounded-full ${
                competidor.nivelAmenaza === 'alto' ? 'bg-red-100 text-red-700' :
                competidor.nivelAmenaza === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {amenazaConfig.label}
              </span>
            </div>

            {/* KPIs */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Nivel Amenaza"
                value={competidor.nivelAmenaza.toUpperCase()}
                icon={Shield}
                variant={competidor.nivelAmenaza === 'alto' ? 'danger' : competidor.nivelAmenaza === 'medio' ? 'warning' : 'success'}
              />
              <StatTile
                label="Productos Analizados"
                value={productosAnalizados}
                icon={Package}
                variant="primary"
              />
              <StatTile
                label="Precio Promedio"
                value={formatMoney(precioPromedio)}
                icon={DollarSign}
                variant="default"
              />
              <StatTile
                label="Reputación"
                value={competidor.reputacion.toUpperCase()}
                icon={reputacionConfig.icon}
                variant={reputacionConfig.variant}
              />
            </div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight, idx) => (
              <InsightCard key={idx} {...insight} />
            ))}
          </div>
        )}

        {/* Contenido */}
        <TwoColumnLayout
          left={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Información del Competidor"
                icon={Shield}
                iconColor="text-red-500"
              />
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Plataforma Principal</p>
                  <p className="text-sm font-medium capitalize">{competidor.plataformaPrincipal.replace('_', ' ')}</p>
                </div>

                {competidor.plataformas && competidor.plataformas.length > 1 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Otras Plataformas</p>
                    <div className="flex flex-wrap gap-1">
                      {competidor.plataformas
                        .filter(p => p !== competidor.plataformaPrincipal)
                        .map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            {p.replace('_', ' ')}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {competidor.urlTienda && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">URL de Tienda</p>
                    <a
                      href={competidor.urlTienda}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                    >
                      {competidor.urlTienda.substring(0, 40)}...
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                )}

                {competidor.esLiderCategoria && (
                  <div className="flex items-center gap-2 mt-3 p-2 bg-yellow-50 rounded-lg">
                    <Crown className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Líder de Categoría</span>
                  </div>
                )}
              </div>

              {/* Alias */}
              {competidor.alias && competidor.alias.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Nombres Alternativos</p>
                  <div className="flex flex-wrap gap-2">
                    {competidor.alias.map((alias, idx) => (
                      <Badge key={idx} variant="default">{alias}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          }
          right={
            <Card padding="md" className="h-full">
              <SectionHeader
                title="Análisis Competitivo"
                icon={Target}
                iconColor="text-amber-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${
                  competidor.nivelAmenaza === 'alto' ? 'bg-red-50' :
                  competidor.nivelAmenaza === 'medio' ? 'bg-yellow-50' :
                  'bg-green-50'
                }`}>
                  <p className="text-xs text-gray-600">Nivel Amenaza</p>
                  <p className="text-sm font-bold capitalize">{competidor.nivelAmenaza}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  competidor.reputacion === 'excelente' || competidor.reputacion === 'buena' ? 'bg-green-50' :
                  competidor.reputacion === 'regular' ? 'bg-yellow-50' :
                  competidor.reputacion === 'mala' ? 'bg-red-50' :
                  'bg-gray-50'
                }`}>
                  <p className="text-xs text-gray-600">Reputación</p>
                  <p className="text-sm font-bold capitalize">{competidor.reputacion}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50">
                  <p className="text-xs text-gray-600">Estrategia Precio</p>
                  <p className="text-sm font-bold capitalize">{competidor.estrategiaPrecio || 'N/A'}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50">
                  <p className="text-xs text-gray-600">Último Análisis</p>
                  <p className="text-sm font-bold">{formatFecha(competidor.metricas?.ultimaActualizacion)}</p>
                </div>
              </div>

              {/* Fortalezas y Debilidades */}
              {(competidor.fortalezas || competidor.debilidades) && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  {competidor.fortalezas && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <p className="text-xs font-medium text-green-700">Fortalezas</p>
                      </div>
                      <p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{competidor.fortalezas}</p>
                    </div>
                  )}
                  {competidor.debilidades && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <p className="text-xs font-medium text-red-700">Debilidades</p>
                      </div>
                      <p className="text-sm text-gray-700 bg-red-50 p-2 rounded">{competidor.debilidades}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          }
        />

        {/* Categorías donde compite */}
        {competidor.categoriasLider && competidor.categoriasLider.length > 0 && (
          <Card padding="md">
            <SectionHeader
              title="Categorías en las que Lidera"
              icon={Crown}
              iconColor="text-yellow-500"
            />
            <div className="flex flex-wrap gap-2">
              {competidor.categoriasLider.map((cat, idx) => (
                <Badge key={idx} variant="info">{cat}</Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Notas */}
        {competidor.notas && (
          <Card padding="md">
            <SectionHeader title="Notas" icon={FileText} iconColor="text-gray-500" />
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{competidor.notas}</p>
          </Card>
        )}

        {/* Footer */}
        <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
          <span>Registrado: {formatFecha(competidor.fechaCreacion)}</span>
          {competidor.fechaActualizacion && (
            <span>Actualizado: {formatFecha(competidor.fechaActualizacion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};
