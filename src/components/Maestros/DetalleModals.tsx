/**
 * Modales de Detalle para Entidades Maestras - VERSIÓN PROFESIONAL
 * Dashboard mini con KPIs accionables, insights y diseño enterprise
 */
import React, { useEffect, useState } from 'react';
import { formatFecha } from '../../utils/dateFormatters';
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
import { registerModalOpen, unregisterModalOpen, getModalCount } from '../common/Modal';
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
import type { Competidor } from '../../types/entidadesMaestras.types';
import { useCanalVentaStore } from '../../store/canalVentaStore';

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
  headerColor = 'bg-slate-700',
  children,
  actions
}) => {
  // Registrar/desregistrar en el sistema global de modales
  useEffect(() => {
    if (isOpen) {
      registerModalOpen();
      document.body.setAttribute('data-modal-open', 'true');
    }
    return () => {
      if (isOpen) {
        unregisterModalOpen();
        if (getModalCount() === 0) {
          document.body.removeAttribute('data-modal-open');
        }
      }
    };
  }, [isOpen]);

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
          {/* Header */}
          <div className={`${headerColor} px-6 py-5`}>
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
                      badge.variant === 'success' ? 'bg-emerald-400/20 text-emerald-100' :
                      badge.variant === 'warning' ? 'bg-yellow-400/20 text-yellow-100' :
                      badge.variant === 'danger' ? 'bg-red-400/20 text-red-100' :
                      badge.variant === 'info' ? 'bg-sky-400/20 text-sky-100' :
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
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] bg-slate-50">
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
  const { canales } = useCanalVentaStore();

  const resolverNombreCanal = (canalOrigen: string) => {
    const canal = canales.find(c => c.id === canalOrigen || c.codigo === canalOrigen || c.nombre.toLowerCase() === canalOrigen.toLowerCase());
    return canal?.nombre || canalOrigen.replace('_', ' ');
  };

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
      headerColor="bg-teal-700"
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
                score >= 70 ? 'bg-emerald-100 text-emerald-700' :
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
                iconColor="text-sky-500"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-3 py-2 border-b border-slate-100">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{cliente.telefono || 'Sin teléfono'}</p>
                    {cliente.telefonoAlt && (
                      <p className="text-xs text-slate-500">Alt: {cliente.telefonoAlt}</p>
                    )}
                  </div>
                </div>
                {cliente.email && (
                  <div className="flex items-center gap-3 py-2 border-b border-slate-100">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <p className="text-sm">{cliente.email}</p>
                  </div>
                )}
                {cliente.dniRuc && (
                  <div className="flex items-center gap-3 py-2 border-b border-slate-100">
                    <Hash className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">{cliente.dniRuc.length === 11 ? 'RUC' : 'DNI'}</p>
                      <p className="text-sm font-medium">{cliente.dniRuc}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 py-2 border-b border-slate-100">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Tipo</p>
                    <p className="text-sm font-medium capitalize">
                      {cliente.tipoCliente === 'persona' ? 'Persona Natural' : 'Empresa'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Canal de Origen</p>
                    <p className="text-sm font-medium capitalize">{resolverNombreCanal(cliente.canalOrigen)}</p>
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
                <p className="text-sm text-slate-500 mb-4">Sin etiquetas asignadas</p>
              )}

              {cliente.notas && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Notas</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{cliente.notas}</p>
                </div>
              )}

              {/* Productos favoritos */}
              {cliente.metricas?.productosFavoritos && cliente.metricas.productosFavoritos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <p className="text-xs font-medium text-slate-700">Productos Favoritos</p>
                  </div>
                  <p className="text-sm text-slate-600">
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
              iconColor="text-emerald-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cliente.direcciones.map((dir) => (
                <div
                  key={dir.id}
                  className={`p-3 rounded-lg border-2 ${dir.esPrincipal ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{dir.etiqueta}</span>
                    {dir.esPrincipal && (
                      <span className="px-1.5 py-0.5 bg-sky-500 text-white text-xs rounded">Principal</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{dir.direccion}</p>
                  {dir.distrito && (
                    <p className="text-xs text-slate-500">{dir.distrito}, {dir.ciudad}</p>
                  )}
                  {dir.referencia && (
                    <p className="text-xs text-slate-400 mt-1 italic">Ref: {dir.referencia}</p>
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
      headerColor="bg-emerald-700"
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
                score >= 70 ? 'bg-emerald-100 text-emerald-700' :
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
                iconColor="text-emerald-500"
              />
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Tipo de Marca</span>
                  <span className="text-sm font-medium capitalize">{marca.tipoMarca}</span>
                </div>
                {marca.paisOrigen && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">País de Origen</span>
                    <span className="text-sm font-medium">{marca.paisOrigen}</span>
                  </div>
                )}
                {marca.metricas?.ultimaVenta && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Última Venta</span>
                    <span className="text-sm font-medium">{formatFecha(marca.metricas.ultimaVenta)}</span>
                  </div>
                )}
                {marca.sitioWeb && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 mb-1">Sitio Web</p>
                    <a
                      href={marca.sitioWeb.startsWith('http') ? marca.sitioWeb : `https://${marca.sitioWeb}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-600 hover:underline flex items-center gap-1"
                    >
                      {marca.sitioWeb}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Alias */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-2">Nombres Alternativos (Alias)</p>
                {marca.alias && marca.alias.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {marca.alias.map((alias, idx) => (
                      <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                        {alias}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Sin alias registrados</p>
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
                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium">{prov.nombreProveedor}</span>
                      {prov.esPrincipal && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sin proveedores preferidos configurados</p>
              )}

              {/* Notas */}
              {(marca.descripcion || marca.notas) && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  {marca.descripcion && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-slate-700 mb-1">Descripción</p>
                      <p className="text-sm text-slate-600">{marca.descripcion}</p>
                    </div>
                  )}
                  {marca.notas && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Notas</p>
                      <p className="text-sm text-slate-600 bg-yellow-50 p-2 rounded">{marca.notas}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          }
        />

        {/* Footer con fechas */}
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
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
      headerColor="bg-purple-700"
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
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Tipo</span>
                  <span className="text-sm font-medium capitalize">{proveedor.tipo}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">País</span>
                  <span className="text-sm font-medium">{proveedor.pais}</span>
                </div>
                {proveedor.contacto && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Contacto</span>
                    <span className="text-sm font-medium">{proveedor.contacto}</span>
                  </div>
                )}
                {proveedor.email && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Email</span>
                    <a href={`mailto:${proveedor.email}`} className="text-sm text-sky-600 hover:underline">
                      {proveedor.email}
                    </a>
                  </div>
                )}
                {proveedor.telefono && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Teléfono</span>
                    <span className="text-sm font-medium">{proveedor.telefono}</span>
                  </div>
                )}
                {proveedor.url && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 mb-1">URL</p>
                    <a
                      href={proveedor.url.startsWith('http') ? proveedor.url : `https://${proveedor.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-600 hover:underline flex items-center gap-1"
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
                iconColor="text-sky-500"
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
                  <div className="flex justify-between py-2 border-t border-slate-100">
                    <span className="text-sm text-slate-600">Última Compra</span>
                    <span className="text-sm font-medium">{formatFecha(proveedor.metricas.ultimaCompra)}</span>
                  </div>
                )}
              </div>

              {/* Productos comprados */}
              {proveedor.metricas?.productosComprados && proveedor.metricas.productosComprados.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    SKUs Comprados ({proveedor.metricas.productosComprados.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {proveedor.metricas.productosComprados.slice(0, 8).map((sku: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                        {sku}
                      </span>
                    ))}
                    {proveedor.metricas.productosComprados.length > 8 && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs">
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
            <SectionHeader title="Notas Internas" icon={FileText} iconColor="text-slate-500" />
            <p className="text-sm text-slate-700 bg-yellow-50 p-3 rounded-lg">{proveedor.notasInternas}</p>
          </Card>
        )}

        {/* Footer */}
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
          <span>Registrado: {formatFecha(proveedor.fechaCreacion)}</span>
          {proveedor.ultimaEdicion && (
            <span>Actualizado: {formatFecha(proveedor.ultimaEdicion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};

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
      case 'alto': return { color: 'bg-red-700', badge: 'danger', label: 'ALTO RIESGO', score: 85 };
      case 'medio': return { color: 'bg-amber-700', badge: 'warning', label: 'MEDIO', score: 50 };
      case 'bajo': return { color: 'bg-emerald-700', badge: 'success', label: 'BAJO', score: 25 };
      default: return { color: 'bg-slate-700', badge: 'default', label: 'DESCONOCIDO', score: 50 };
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
      subtitle={`${(competidor.plataformaPrincipal || 'otra').replace('_', ' ')} · ${competidor.ciudad || 'Ubicación no especificada'}`}
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
                'bg-emerald-100'
              }`}>
                <Shield className={`h-10 w-10 ${
                  competidor.nivelAmenaza === 'alto' ? 'text-red-600' :
                  competidor.nivelAmenaza === 'medio' ? 'text-yellow-600' :
                  'text-emerald-600'
                }`} />
              </div>
              <span className={`text-xs font-bold mt-2 px-3 py-1 rounded-full ${
                competidor.nivelAmenaza === 'alto' ? 'bg-red-100 text-red-700' :
                competidor.nivelAmenaza === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                'bg-emerald-100 text-emerald-700'
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
                  <p className="text-xs text-slate-500">Plataforma Principal</p>
                  <p className="text-sm font-medium capitalize">{(competidor.plataformaPrincipal || 'otra').replace('_', ' ')}</p>
                </div>

                {/* Mostrar plataformasData si existe (nuevo sistema) */}
                {competidor.plataformasData && competidor.plataformasData.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Plataformas</p>
                    <div className="flex flex-wrap gap-1">
                      {competidor.plataformasData.map((p) => (
                        <span
                          key={p.id}
                          className={`px-2 py-0.5 text-xs rounded ${p.esPrincipal ? 'bg-teal-100 text-teal-700 font-medium' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {p.nombre}{p.esPrincipal ? ' ⭐' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback: mostrar plataformas legacy si no hay plataformasData */}
                {(!competidor.plataformasData || competidor.plataformasData.length === 0) && competidor.plataformas && competidor.plataformas.length > 1 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Otras Plataformas</p>
                    <div className="flex flex-wrap gap-1">
                      {competidor.plataformas
                        .filter(p => p !== competidor.plataformaPrincipal)
                        .map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded">
                            {p?.replace('_', ' ')}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {competidor.urlTienda && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">URL de Tienda</p>
                    <a
                      href={competidor.urlTienda}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-600 hover:underline flex items-center gap-1 break-all"
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
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-2">Nombres Alternativos</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${
                  competidor.nivelAmenaza === 'alto' ? 'bg-red-50' :
                  competidor.nivelAmenaza === 'medio' ? 'bg-yellow-50' :
                  'bg-emerald-50'
                }`}>
                  <p className="text-xs text-slate-600">Nivel Amenaza</p>
                  <p className="text-sm font-bold capitalize">{competidor.nivelAmenaza}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  competidor.reputacion === 'excelente' || competidor.reputacion === 'buena' ? 'bg-emerald-50' :
                  competidor.reputacion === 'regular' ? 'bg-yellow-50' :
                  competidor.reputacion === 'mala' ? 'bg-red-50' :
                  'bg-slate-50'
                }`}>
                  <p className="text-xs text-slate-600">Reputación</p>
                  <p className="text-sm font-bold capitalize">{competidor.reputacion}</p>
                </div>
                <div className="p-3 rounded-lg bg-sky-50">
                  <p className="text-xs text-slate-600">Estrategia Precio</p>
                  <p className="text-sm font-bold capitalize">{competidor.estrategiaPrecio || 'N/A'}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50">
                  <p className="text-xs text-slate-600">Último Análisis</p>
                  <p className="text-sm font-bold">{formatFecha(competidor.metricas?.ultimaActualizacion)}</p>
                </div>
              </div>

              {/* Fortalezas y Debilidades */}
              {(competidor.fortalezas || competidor.debilidades) && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  {competidor.fortalezas && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <p className="text-xs font-medium text-emerald-700">Fortalezas</p>
                      </div>
                      <p className="text-sm text-slate-700 bg-emerald-50 p-2 rounded">{competidor.fortalezas}</p>
                    </div>
                  )}
                  {competidor.debilidades && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <p className="text-xs font-medium text-red-700">Debilidades</p>
                      </div>
                      <p className="text-sm text-slate-700 bg-red-50 p-2 rounded">{competidor.debilidades}</p>
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
            <SectionHeader title="Notas" icon={FileText} iconColor="text-slate-500" />
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{competidor.notas}</p>
          </Card>
        )}

        {/* Footer */}
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
          <span>Registrado: {formatFecha(competidor.fechaCreacion)}</span>
          {competidor.fechaActualizacion && (
            <span>Actualizado: {formatFecha(competidor.fechaActualizacion)}</span>
          )}
        </div>
      </div>
    </DetailModalBase>
  );
};
