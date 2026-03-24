import React, { useMemo, useState } from 'react';
import {
  Pencil,
  Trash2,
  Copy,
  GitBranch,
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingDown,
  Minus,
  Tag,
  FolderTree,
  FlaskConical,
  Star,
  ChevronDown,
  ChevronUp,
  Calculator,
  Globe,
  Users,
  Zap,
  Target,
  BarChart3,
  History,
  Info,
  Check,
  Box
} from 'lucide-react';
import { Button } from '../../common';
import { ProductoService } from '../../../services/producto.service';
import { useUserName } from '../../../hooks/useUserNames';
import { PuntoEquilibrioCard } from './PuntoEquilibrioCard';
import type { Producto } from '../../../types/producto.types';
import { TIPO_PRODUCTO_SKC_LABELS, PASO_RUTINA_LABELS } from '../../../types/producto.types';

interface ProductoCardProps {
  producto: Producto;
  onEdit: () => void;
  onDelete: () => void;
  onInvestigar?: () => void;
  onReactivar?: () => void;
  onCreateVariante?: () => void;
  variantes?: Producto[];
  onViewVariante?: (producto: Producto) => void;
}

// Componente para secciones colapsables
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
}> = ({ title, icon, defaultOpen = false, badge, children, iconBgColor = 'bg-gray-100', iconColor }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          <span className="font-medium text-gray-800">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

// Componente de Calculadora de Rentabilidad
const CalculadoraRentabilidad: React.FC<{
  ctruBase: number;
  precioSugerido: number;
}> = ({ ctruBase, precioSugerido }) => {
  const [costoInput, setCostoInput] = useState(ctruBase.toString());
  const [precioInput, setPrecioInput] = useState(precioSugerido.toString());

  const costo = parseFloat(costoInput) || 0;
  const precio = parseFloat(precioInput) || 0;

  const ganancia = precio - costo;
  const margen = precio > 0 ? ((ganancia / precio) * 100) : 0;
  const roi = costo > 0 ? ((ganancia / costo) * 100) : 0;
  const multiplicador = costo > 0 ? (precio / costo) : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
          <Calculator className="h-4 w-4 text-primary-600" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm sm:text-base">Calculadora de Rentabilidad</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">
            Costo (CTRU) S/
          </label>
          <input
            type="number"
            value={costoInput}
            onChange={(e) => setCostoInput(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">
            Precio Venta S/
          </label>
          <input
            type="number"
            value={precioInput}
            onChange={(e) => setPrecioInput(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Ganancia</p>
          <p className={`text-sm sm:text-base font-bold ${ganancia >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            S/ {ganancia.toFixed(2)}
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Margen</p>
          <p className={`text-sm sm:text-base font-bold ${margen >= 30 ? 'text-success-600' : margen >= 20 ? 'text-warning-600' : 'text-danger-600'}`}>
            {margen.toFixed(1)}%
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">ROI</p>
          <p className={`text-sm sm:text-base font-bold ${roi >= 50 ? 'text-success-600' : roi >= 25 ? 'text-warning-600' : 'text-danger-600'}`}>
            {roi.toFixed(1)}%
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Multiplicador</p>
          <p className={`text-sm sm:text-base font-bold ${multiplicador >= 2 ? 'text-success-600' : multiplicador >= 1.5 ? 'text-warning-600' : 'text-danger-600'}`}>
            {multiplicador.toFixed(2)}x
          </p>
        </div>
      </div>
    </div>
  );
};

// Componente KPI Card
const KPICard: React.FC<{
  label: string;
  value: string | number;
  subtext?: string;
  bgColor: string;
  textColor?: string;
}> = ({ label, value, subtext, bgColor, textColor = 'text-white' }) => (
  <div className={`${bgColor} rounded-lg p-4 shadow-sm`}>
    <p className={`text-xs font-medium ${textColor} opacity-90 uppercase tracking-wide`}>{label}</p>
    <p className={`text-2xl font-bold ${textColor} mt-1`}>{value}</p>
    {subtext && <p className={`text-xs ${textColor} opacity-80 mt-1`}>{subtext}</p>}
  </div>
);

export const ProductoCard: React.FC<ProductoCardProps> = ({ producto, onEdit, onDelete, onInvestigar, onReactivar, onCreateVariante, variantes, onViewVariante }) => {
  const [copiedSku, setCopiedSku] = useState(false);
  const stockCritico = producto.stockPeru <= producto.stockMinimo;

  // Resumen de investigación
  const invResumen = useMemo(() => ProductoService.getResumenInvestigacion(producto), [producto]);
  const inv = producto.investigacion;

  // Resolver nombres de usuario
  const creadoPorNombre = useUserName(producto.creadoPor);
  const investigadoPorNombre = useUserName(inv?.realizadoPor);

  // Calcular métricas de ROI si hay investigación
  const metricsROI = useMemo(() => {
    if (!inv || inv.ctruEstimado <= 0) return null;
    const precioVenta = inv.precioEntrada || inv.precioPERUPromedio;
    if (precioVenta <= 0) return null;

    const ganancia = precioVenta - inv.ctruEstimado;
    const roi = (ganancia / inv.ctruEstimado) * 100;
    const multiplicador = precioVenta / inv.ctruEstimado;

    return { ganancia, roi, multiplicador, precioVenta };
  }, [inv]);

  const copySku = () => {
    navigator.clipboard.writeText(producto.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* ============ HEADER ============ */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-4 sm:p-5 shadow-md">
        {/* Marca y nombre */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-white">{producto.marca}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                producto.estado === 'activo'
                  ? 'bg-success-500 text-white'
                  : producto.estado === 'inactivo'
                  ? 'bg-gray-500 text-white'
                  : 'bg-danger-500 text-white'
              }`}>
                {producto.estado === 'activo' ? 'Activo' : producto.estado === 'inactivo' ? 'Inactivo' : 'Descontinuado'}
              </span>
            </div>
            <p className="text-base sm:text-lg text-gray-300 mt-1">{producto.nombreComercial}</p>
          </div>

          {/* Acciones - iconos en móvil */}
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            {onInvestigar && (
              <button
                onClick={onInvestigar}
                className="p-2 bg-transparent border border-gray-500 text-gray-200 hover:bg-gray-600/50 rounded-lg transition-colors"
                title="Investigar"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            {onCreateVariante && (
              <button
                onClick={onCreateVariante}
                className="p-2 bg-transparent border border-gray-500 text-gray-200 hover:bg-gray-600/50 rounded-lg transition-colors"
                title="Crear variante"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 bg-transparent border border-gray-500 text-gray-200 hover:bg-gray-600/50 rounded-lg transition-colors"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {producto.estado === 'inactivo' && onReactivar ? (
              <button
                onClick={onReactivar}
                className="p-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors shadow-sm"
                title="Reactivar producto"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={onDelete}
                className="p-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors shadow-sm"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Detalles del producto */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
          {producto.atributosSkincare ? (
            <>
              <span className="bg-pink-500/30 text-pink-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">
                {TIPO_PRODUCTO_SKC_LABELS[producto.atributosSkincare.tipoProductoSKC] || producto.atributosSkincare.tipoProductoSKC}
              </span>
              {producto.atributosSkincare.volumen && <span className="bg-gray-600/50 text-gray-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.atributosSkincare.volumen}</span>}
              {producto.atributosSkincare.ingredienteClave && <span className="bg-green-500/30 text-green-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.atributosSkincare.ingredienteClave}</span>}
              {producto.atributosSkincare.spf && <span className="bg-amber-500/30 text-amber-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">SPF{producto.atributosSkincare.spf} {producto.atributosSkincare.pa || ''}</span>}
              {producto.atributosSkincare.pasoRutina && <span className="bg-blue-500/30 text-blue-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{PASO_RUTINA_LABELS[producto.atributosSkincare.pasoRutina]}</span>}
            </>
          ) : (
            <>
              <span className="bg-gray-600/50 text-gray-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.presentacion}</span>
              {producto.dosaje && <span className="bg-gray-600/50 text-gray-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.dosaje}</span>}
              {producto.contenido && <span className="bg-gray-600/50 text-gray-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.contenido}</span>}
              {producto.sabor && <span className="bg-gray-600/50 text-gray-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.sabor}</span>}
            </>
          )}
        </div>

        {/* SKU y Ver Proveedor */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={copySku}
            className="flex items-center gap-2 bg-gray-600/50 hover:bg-gray-600 text-gray-100 px-2.5 py-1 rounded-md transition-colors text-xs sm:text-sm"
          >
            <span className="font-mono">{producto.sku}</span>
            {copiedSku ? (
              <Check className="h-3.5 w-3.5 text-success-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {/* ============ FICHA DESCRIPTIVA ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 px-1">
        {producto.presentacion && (
          <span><span className="text-gray-400">Presentación:</span> {producto.presentacion}</span>
        )}
        {producto.dosaje && (
          <span><span className="text-gray-400">Dosaje:</span> {producto.dosaje}</span>
        )}
        {producto.contenido && (
          <span><span className="text-gray-400">Contenido:</span> {producto.contenido}</span>
        )}
        {producto.sabor && (
          <span><span className="text-gray-400">Sabor:</span> {producto.sabor}</span>
        )}
        {producto.varianteLabel && (
          <span className="text-blue-600 font-medium">Variante: {producto.varianteLabel}</span>
        )}
      </div>

      {/* ============ MÉTRICAS KPI ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KPICard
          label="Stock Perú"
          value={producto.stockPeru}
          subtext={stockCritico ? '⚠️ Crítico' : `Mín: ${producto.stockMinimo}`}
          bgColor={stockCritico ? 'bg-danger-500' : 'bg-success-500'}
        />
        <KPICard
          label="Stock USA"
          value={producto.stockUSA}
          subtext="unidades"
          bgColor="bg-primary-500"
        />
        <KPICard
          label="CTRU Promedio"
          value={`S/ ${(producto.ctruPromedio || 0).toFixed(2)}`}
          subtext="costo unitario"
          bgColor="bg-gray-600"
        />
        <KPICard
          label="Rotación"
          value={`${producto.rotacionPromedio || 0}`}
          subtext="unidades/mes"
          bgColor="bg-warning-500"
          textColor="text-warning-900"
        />
      </div>

      {/* ============ INVESTIGACIÓN DE MERCADO ============ */}
      {invResumen.tieneInvestigacion && inv ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {/* Header de investigación */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-3 sm:px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 bg-primary-500 rounded-lg flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-white text-sm sm:text-base">Investigación de Mercado</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 truncate">
                    {inv.fechaInvestigacion?.toDate?.().toLocaleDateString('es-PE')} por {investigadoPorNombre}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                {invResumen.estaVigente ? (
                  <span className="bg-success-500 text-white text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1">
                    <Clock className="h-3 w-3 hidden sm:block" />
                    Vigente ({invResumen.diasRestantes}d)
                  </span>
                ) : (
                  <span className="bg-danger-500 text-white text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 hidden sm:block" />
                    Vencida
                  </span>
                )}
                <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1 ${
                  inv.recomendacion === 'importar' ? 'bg-success-500 text-white' :
                  inv.recomendacion === 'descartar' ? 'bg-danger-500 text-white' : 'bg-warning-500 text-warning-900'
                }`}>
                  {inv.recomendacion === 'importar' && <CheckCircle className="h-3 w-3" />}
                  {inv.recomendacion === 'descartar' && <XCircle className="h-3 w-3" />}
                  {inv.recomendacion === 'investigar_mas' && <RefreshCw className="h-3 w-3" />}
                  <span className="hidden sm:inline">{inv.recomendacion === 'importar' ? 'IMPORTAR' : inv.recomendacion === 'descartar' ? 'DESCARTAR' : 'INVESTIGAR'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Desglose de Costo - Fórmula CTRU */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-gray-500" />
                Desglose del Costo (CTRU)
              </h4>
              {/* Mobile: Grid layout */}
              <div className="grid grid-cols-3 gap-2 sm:hidden">
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-0.5">Precio USA</p>
                  <p className="text-sm font-bold text-primary-600">
                    ${(inv.precioUSAMin || inv.precioUSAPromedio).toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-0.5">Flete</p>
                  <p className="text-sm font-bold text-gray-600">
                    ${(inv.logisticaEstimada || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total USD</p>
                  <p className="text-sm font-bold text-gray-700">
                    ${((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0)).toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-0.5">TC</p>
                  <p className="text-sm font-bold text-warning-600">
                    {inv.ctruEstimado > 0 && (inv.precioUSAMin || inv.precioUSAPromedio) > 0
                      ? (inv.ctruEstimado / ((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0))).toFixed(2)
                      : '?'}
                  </p>
                </div>
                <div className="col-span-2 text-center p-2 bg-primary-100 rounded-lg border border-primary-200">
                  <p className="text-[10px] text-primary-600 mb-0.5 font-medium">CTRU Final</p>
                  <p className="text-base font-bold text-primary-700">
                    S/ {inv.ctruEstimado.toFixed(2)}
                  </p>
                </div>
              </div>
              {/* Desktop: Horizontal formula layout */}
              <div className="hidden sm:flex items-center justify-between gap-2 text-sm">
                {/* Precio USA */}
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500 mb-1">Precio USA</p>
                  <p className="text-lg font-bold text-primary-600">
                    ${(inv.precioUSAMin || inv.precioUSAPromedio).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-400">con impuesto</p>
                </div>

                <span className="text-gray-400 font-bold text-lg">+</span>

                {/* Flete */}
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500 mb-1">Flete</p>
                  <p className="text-lg font-bold text-gray-600">
                    ${(inv.logisticaEstimada || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-400">USD/unidad</p>
                </div>

                <span className="text-gray-400 font-bold text-lg">=</span>

                {/* Total USD */}
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500 mb-1">Total USD</p>
                  <p className="text-lg font-bold text-gray-700">
                    ${((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0)).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-400">costo unitario</p>
                </div>

                <span className="text-gray-400 font-bold text-lg">×</span>

                {/* TC */}
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500 mb-1">TC</p>
                  <p className="text-lg font-bold text-warning-600">
                    {inv.ctruEstimado > 0 && (inv.precioUSAMin || inv.precioUSAPromedio) > 0
                      ? (inv.ctruEstimado / ((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0))).toFixed(2)
                      : '?'}
                  </p>
                  <p className="text-[10px] text-gray-400">fecha inv.</p>
                </div>

                <span className="text-gray-400 font-bold text-lg">=</span>

                {/* CTRU */}
                <div className="text-center flex-1 bg-primary-100 rounded-lg p-2 -m-1">
                  <p className="text-xs text-primary-600 mb-1 font-medium">CTRU</p>
                  <p className="text-xl font-bold text-primary-700">
                    S/ {inv.ctruEstimado.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-primary-500">tu inversión</p>
                </div>
              </div>
            </div>

            {/* Grid de precios de mercado y margen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between sm:flex-col sm:items-start">
                  <div className="flex items-center gap-2 sm:mb-2">
                    <div className="p-1.5 bg-success-100 rounded-md">
                      <Target className="h-3.5 w-3.5 text-success-600" />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Precio Perú</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-lg sm:text-xl font-bold text-success-600">
                      S/ {(inv.precioEntrada || inv.precioPERUPromedio).toFixed(2)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {inv.precioEntrada ? 'Entrada (-5%)' : 'Promedio ML'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between sm:flex-col sm:items-start">
                  <div className="flex items-center gap-2 sm:mb-2">
                    <div className={`p-1.5 rounded-md ${
                      inv.margenEstimado >= 30 ? 'bg-success-100' :
                      inv.margenEstimado >= 20 ? 'bg-warning-100' : 'bg-danger-100'
                    }`}>
                      <TrendingUp className={`h-3.5 w-3.5 ${
                        inv.margenEstimado >= 30 ? 'text-success-600' :
                        inv.margenEstimado >= 20 ? 'text-warning-600' : 'text-danger-600'
                      }`} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Margen Est.</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className={`text-lg sm:text-xl font-bold ${
                      inv.margenEstimado >= 30 ? 'text-success-600' :
                      inv.margenEstimado >= 20 ? 'text-warning-600' : 'text-danger-600'
                    }`}>
                      {inv.margenEstimado.toFixed(1)}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {inv.margenEstimado >= 30 ? 'Excelente' : inv.margenEstimado >= 20 ? 'Aceptable' : 'Bajo'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between sm:flex-col sm:items-start">
                  <div className="flex items-center gap-2 sm:mb-2">
                    <div className="p-1.5 bg-primary-100 rounded-md">
                      <DollarSign className="h-3.5 w-3.5 text-primary-600" />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Ganancia/Unidad</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className={`text-lg sm:text-xl font-bold ${
                      ((inv.precioEntrada || inv.precioPERUPromedio) - inv.ctruEstimado) > 0
                        ? 'text-success-600'
                        : 'text-danger-600'
                    }`}>
                      S/ {((inv.precioEntrada || inv.precioPERUPromedio) - inv.ctruEstimado).toFixed(2)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400">precio - CTRU</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas ROI */}
            {metricsROI && (
              <div className="bg-success-500 rounded-lg p-3 sm:p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-white" />
                  <span className="font-medium text-white text-sm sm:text-base">Rendimiento de Inversión</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-success-100 mb-0.5 sm:mb-1">Ganancia/Unidad</p>
                    <p className="text-base sm:text-lg font-bold text-white">S/ {metricsROI.ganancia.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-success-100 mb-0.5 sm:mb-1">ROI</p>
                    <p className="text-base sm:text-lg font-bold text-white">{metricsROI.roi.toFixed(1)}%</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-success-100 mb-0.5 sm:mb-1">Multiplicador</p>
                    <p className="text-base sm:text-lg font-bold text-white">{metricsROI.multiplicador.toFixed(2)}x</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-success-100 mb-0.5 sm:mb-1">Precio Venta</p>
                    <p className="text-base sm:text-lg font-bold text-white">S/ {metricsROI.precioVenta.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Análisis de mercado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-gray-200 rounded-md">
                    <Users className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">Competencia</span>
                </div>
                <div className="flex sm:flex-col gap-3 sm:gap-2 text-sm">
                  <div className="flex justify-between items-center flex-1">
                    <span className="text-gray-500 text-xs sm:text-sm">Vendedores ML</span>
                    <span className="font-medium text-gray-800">
                      {inv.presenciaML ? `${inv.numeroCompetidores || '?'}` : 'Sin datos'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center flex-1">
                    <span className="text-gray-500 text-xs sm:text-sm">Nivel</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                      inv.nivelCompetencia === 'baja' ? 'bg-success-100 text-success-700' :
                      inv.nivelCompetencia === 'media' ? 'bg-warning-100 text-warning-700' :
                      inv.nivelCompetencia === 'alta' ? 'bg-danger-100 text-danger-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {inv.nivelCompetencia}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-gray-200 rounded-md">
                    <TrendingUp className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">Demanda</span>
                </div>
                <div className="flex sm:flex-col gap-3 sm:gap-2 text-sm">
                  <div className="flex justify-between items-center flex-1">
                    <span className="text-gray-500 text-xs sm:text-sm">Estimada</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                      inv.demandaEstimada === 'alta' ? 'bg-success-100 text-success-700' :
                      inv.demandaEstimada === 'media' ? 'bg-warning-100 text-warning-700' : 'bg-danger-100 text-danger-700'
                    }`}>
                      {inv.demandaEstimada}
                    </span>
                  </div>
                  <div className="flex justify-between items-center flex-1">
                    <span className="text-gray-500 text-xs sm:text-sm">Tendencia</span>
                    <span className="flex items-center gap-1 font-medium text-gray-800">
                      {inv.tendencia === 'subiendo' && <TrendingUp className="h-3.5 w-3.5 text-success-500" />}
                      {inv.tendencia === 'bajando' && <TrendingDown className="h-3.5 w-3.5 text-danger-500" />}
                      {inv.tendencia === 'estable' && <Minus className="h-3.5 w-3.5 text-gray-500" />}
                      <span className="capitalize text-xs">{inv.tendencia}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-gray-200 rounded-md">
                    <Info className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">Datos Adicionales</span>
                </div>
                <div className="flex sm:flex-col gap-3 sm:gap-2 text-sm">
                  {inv.volumenMercadoEstimado && (
                    <div className="flex justify-between items-center flex-1">
                      <span className="text-gray-500 text-xs sm:text-sm">Vol/mes</span>
                      <span className="font-medium text-gray-800">{inv.volumenMercadoEstimado} uds</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center flex-1">
                    <span className="text-gray-500 text-xs sm:text-sm">Logística est.</span>
                    <span className="font-medium text-gray-800">S/ {(inv.logisticaEstimada || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Razonamiento */}
            {inv.razonamiento && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Análisis y Razonamiento</p>
                <p className="text-sm text-gray-700">{inv.razonamiento}</p>
              </div>
            )}

            {/* Punto de Equilibrio - Solo si hay CTRU estimado */}
            {inv.ctruEstimado > 0 && (
              <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-lg p-4 border border-primary-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-primary-500 rounded-lg">
                    <Calculator className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800">Análisis de Punto de Equilibrio</h4>
                </div>
                <PuntoEquilibrioCard
                  ctruEstimado={inv.ctruEstimado}
                  precioVentaSugerido={inv.precioEntrada || inv.precioPERUPromedio * 0.95}
                  precioPERUMin={inv.precioPERUMin || inv.precioPERUPromedio}
                  demandaEstimada={inv.demandaEstimada || 'media'}
                  volumenMercadoEstimado={inv.volumenMercadoEstimado}
                  precioEntrada={inv.precioEntrada}
                />
              </div>
            )}

            {/* Calculadora simple - Fallback si no hay datos completos */}
            {(!inv.ctruEstimado || inv.ctruEstimado <= 0) && (
              <CalculadoraRentabilidad
                ctruBase={producto.ctruPromedio || 0}
                precioSugerido={inv.precioEntrada || inv.precioPERUPromedio || 0}
              />
            )}
          </div>
        </div>
      ) : (
        /* Sin investigación */
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 text-center shadow-sm">
          <div className="inline-flex p-3 bg-gray-100 rounded-full mb-3">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="font-medium text-gray-700 mb-1">
            Sin Investigación de Mercado
          </h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Este producto no tiene análisis de mercado. Realiza una investigación para conocer precios y competencia.
          </p>
          {onInvestigar && (
            <Button onClick={onInvestigar} variant="primary">
              <Search className="h-4 w-4 mr-2" />
              Realizar Investigación
            </Button>
          )}

          {/* Calculadora básica */}
          <div className="mt-4">
            <CalculadoraRentabilidad
              ctruBase={producto.ctruPromedio || 0}
              precioSugerido={0}
            />
          </div>
        </div>
      )}

      {/* ============ SECCIONES COLAPSABLES ============ */}
      <div className="space-y-2">
        {/* Información del Producto */}
        <CollapsibleSection
          title="Información del Producto"
          icon={<Package className="h-4 w-4" />}
          iconBgColor="bg-gray-100"
          iconColor="text-gray-600"
        >
          <div className="grid grid-cols-2 gap-4 mt-3">
            {producto.tipoProducto ? (
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <FlaskConical className="h-3 w-3" /> Tipo de Producto
                </span>
                <span className="inline-block bg-primary-100 text-primary-700 text-sm px-2 py-0.5 rounded">
                  {producto.tipoProducto.nombre}
                </span>
              </div>
            ) : producto.subgrupo && (
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Subgrupo</span>
                <p className="font-medium text-gray-800">{producto.subgrupo}</p>
              </div>
            )}

            {producto.categorias && producto.categorias.length > 0 ? (
              <div>
                <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <FolderTree className="h-3 w-3" /> Categorías
                </span>
                <div className="flex flex-wrap gap-1">
                  {producto.categorias.map(cat => (
                    <span
                      key={cat.categoriaId}
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded ${
                        cat.categoriaId === producto.categoriaPrincipalId
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {cat.categoriaId === producto.categoriaPrincipalId && (
                        <Star className="h-3 w-3 mr-1 text-warning-500 fill-warning-500" />
                      )}
                      {cat.nombre}
                    </span>
                  ))}
                </div>
              </div>
            ) : producto.grupo && (
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Grupo</span>
                <p className="font-medium text-gray-800">{producto.grupo}</p>
              </div>
            )}

            {producto.codigoUPC && (
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Código UPC</span>
                <p className="font-mono text-sm text-gray-800">{producto.codigoUPC}</p>
              </div>
            )}

            {producto.cicloRecompraDias && (
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Ciclo de Recompra</span>
                <p className="font-medium text-gray-800">{producto.cicloRecompraDias} días</p>
              </div>
            )}

            {producto.etiquetasData && producto.etiquetasData.length > 0 && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <Tag className="h-3 w-3" /> Etiquetas
                </span>
                <div className="flex flex-wrap gap-1">
                  {producto.etiquetasData.map(etq => (
                    <span
                      key={etq.etiquetaId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: etq.colorFondo || '#F3F4F6',
                        color: etq.colorTexto || '#4B5563',
                        border: `1px solid ${etq.colorBorde || '#D1D5DB'}`
                      }}
                    >
                      {etq.icono && <span>{etq.icono}</span>}
                      {etq.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Inventario */}
        <CollapsibleSection
          title="Inventario"
          icon={<Box className="h-4 w-4" />}
          iconBgColor={stockCritico ? 'bg-danger-100' : 'bg-success-100'}
          iconColor={stockCritico ? 'text-danger-600' : 'text-success-600'}
          badge={stockCritico ? <AlertTriangle className="h-4 w-4 text-danger-500 ml-2" /> : undefined}
          defaultOpen={stockCritico}
        >
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className={`rounded-lg p-2 sm:p-3 text-center ${stockCritico ? 'bg-danger-50 border border-danger-100' : 'bg-success-50 border border-success-100'}`}>
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Perú</p>
                <p className={`text-lg sm:text-xl font-bold ${stockCritico ? 'text-danger-600' : 'text-success-600'}`}>
                  {producto.stockPeru}
                </p>
              </div>
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">USA</p>
                <p className="text-lg sm:text-xl font-bold text-primary-600">{producto.stockUSA}</p>
              </div>
              <div className="bg-warning-50 border border-warning-100 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Tránsito</p>
                <p className="text-lg sm:text-xl font-bold text-warning-600">{producto.stockTransito}</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Disponible</p>
                <p className="text-lg sm:text-xl font-bold text-gray-700">{producto.stockDisponible}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
              <div className="flex justify-between bg-gray-50 p-2 sm:p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-500 text-xs sm:text-sm">Stock Mínimo</span>
                <span className="font-medium text-gray-800">{producto.stockMinimo}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2 sm:p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-500 text-xs sm:text-sm">Stock Máximo</span>
                <span className="font-medium text-gray-800">{producto.stockMaximo}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2 sm:p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-500 text-xs sm:text-sm">Reservado</span>
                <span className="font-medium text-gray-800">{producto.stockReservado}</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Datos Comerciales */}
        <CollapsibleSection
          title="Datos Comerciales"
          icon={<DollarSign className="h-4 w-4" />}
          iconBgColor="bg-primary-100"
          iconColor="text-primary-600"
        >
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-500 block mb-1">CTRU Promedio</span>
              <p className="text-xl font-bold text-gray-800">S/ {(producto.ctruPromedio || 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-500 block mb-1">Margen Mínimo (Categoría)</span>
              <p className="text-lg font-bold text-gray-700">{(producto.categorias?.find((c: any) => c.id === producto.categoriaPrincipalId) || producto.categorias?.[0])?.margenMinimo ?? 20}%</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-500 block mb-1">Margen Objetivo (Categoría)</span>
              <p className="text-lg font-bold text-success-600">{(producto.categorias?.find((c: any) => c.id === producto.categoriaPrincipalId) || producto.categorias?.[0])?.margenObjetivo ?? 35}%</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Métricas de Rendimiento */}
        {(producto.rotacionPromedio > 0 || producto.diasParaQuiebre > 0) && (
          <CollapsibleSection
            title="Métricas de Rendimiento"
            icon={<TrendingUp className="h-4 w-4" />}
            iconBgColor="bg-warning-100"
            iconColor="text-warning-600"
          >
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-gray-50 p-2 sm:p-3 rounded-lg text-center border border-gray-100">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Rotación/Mes</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{producto.rotacionPromedio || 0}</p>
              </div>
              <div className="bg-gray-50 p-2 sm:p-3 rounded-lg text-center border border-gray-100">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Días Quiebre</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{producto.diasParaQuiebre || 0}</p>
              </div>
              <div className="bg-gray-50 p-2 sm:p-3 rounded-lg text-center border border-gray-100">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Recompra</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800">{producto.cicloRecompraDias || '-'}d</p>
              </div>
            </div>
          </CollapsibleSection>
        )}


        {/* Historial placeholder */}
        <CollapsibleSection
          title="Historial"
          icon={<History className="h-4 w-4" />}
          iconBgColor="bg-gray-100"
          iconColor="text-gray-500"
        >
          <div className="mt-3 text-center py-6 text-gray-500">
            <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Historial de compras y ventas próximamente</p>
          </div>
        </CollapsibleSection>
      </div>

      {/* ============ VARIANTES ============ */}
      {producto.esVariante && producto.parentId && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
          <GitBranch className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-blue-700">Variante{producto.varianteLabel ? `: ${producto.varianteLabel}` : ''}</span>
        </div>
      )}

      {producto.esPadre && variantes && variantes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <GitBranch className="h-4 w-4" style={{ color: '#4d7c0f' }} />
            Variantes del grupo ({variantes.length})
          </h4>
          <div className="space-y-1">
            {variantes.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => onViewVariante?.(v)}
                className="w-full flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{v.sku}</span>
                  <span className="text-xs text-gray-700">{v.varianteLabel || v.contenido || v.presentacion}</span>
                </div>
                <span className="text-xs text-gray-400">Stock: {v.stockPeru || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ FOOTER ============ */}
      <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-200">
        <span>Creado por: <span className="font-medium text-gray-700">{creadoPorNombre}</span></span>
        <span>
          {producto.fechaCreacion?.toDate?.().toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }) || '-'}
        </span>
      </div>
    </div>
  );
};
