import React, { useMemo, useState } from 'react';
import { KPIBar as DSKPIBar, StatCard as DSStatCard } from '../../../design-system';
import {
  Pencil,
  Trash2,
  Copy,
  GitBranch,
  Gift,
  Package,
  DollarSign,
  Link2,
  FileText,
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
import { useProductoStore } from '../../../store/productoStore';
import { useUserName } from '../../../hooks/useUserNames';
import { PuntoEquilibrioCard } from './PuntoEquilibrioCard';
import type { Producto, TexturaSKC } from '../../../types/producto.types';
import { TIPO_PRODUCTO_SKC_LABELS, PASO_RUTINA_LABELS, TEXTURA_LABELS } from '../../../types/producto.types';

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
  title?: string;
  label?: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
}> = ({ title, label, icon, defaultOpen = false, badge, children, iconBgColor = 'bg-slate-100', iconColor }) => {
  const displayTitle = title || label || '';
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          <span className="font-medium text-slate-800">{displayTitle}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-slate-100">
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
    <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-teal-100 rounded-lg">
          <Calculator className="h-4 w-4 text-teal-600" />
        </div>
        <h4 className="font-medium text-slate-800 text-sm sm:text-base">Calculadora de Rentabilidad</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-slate-500 mb-1">
            Costo (CTRU) S/
          </label>
          <input
            type="number"
            value={costoInput}
            onChange={(e) => setCostoInput(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label className="block text-[10px] sm:text-xs font-medium text-slate-500 mb-1">
            Precio Venta S/
          </label>
          <input
            type="number"
            value={precioInput}
            onChange={(e) => setPrecioInput(e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Ganancia</p>
          <p className={`text-sm sm:text-base font-bold ${ganancia >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            S/ {ganancia.toFixed(2)}
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Margen</p>
          <p className={`text-sm sm:text-base font-bold ${margen >= 30 ? 'text-emerald-600' : margen >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
            {margen.toFixed(1)}%
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">ROI</p>
          <p className={`text-sm sm:text-base font-bold ${roi >= 50 ? 'text-emerald-600' : roi >= 25 ? 'text-amber-600' : 'text-red-600'}`}>
            {roi.toFixed(1)}%
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Multiplicador</p>
          <p className={`text-sm sm:text-base font-bold ${multiplicador >= 2 ? 'text-emerald-600' : multiplicador >= 1.5 ? 'text-amber-600' : 'text-red-600'}`}>
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
  const productosCatalogo = useProductoStore(s => s.productos);

  // Resumen de investigación
  const invResumen = useMemo(() => ProductoService.getResumenInvestigacion(producto), [producto]);
  const inv = producto.investigacion;
  const esUSA = producto.lineaNegocioId === 'Z50CnuaBdD5x0w7XGRv8';

  // Valorización del pack (TAREA-105): suma de precios de componentes vinculados
  // vs. precio del pack. Sirve para ver el "ahorro" al comprarlo armado.
  const valorizacionPack = useMemo(() => {
    if (!producto.esPack || !producto.componentesPack?.length) return null;
    const precioPack = producto.investigacion?.precioEntrada
      || producto.investigacion?.precioSugeridoCalculado
      || 0;
    let sumaComponentes = 0;
    let componentesValorizados = 0;
    let componentesSinPrecio = 0;
    for (const c of producto.componentesPack) {
      if (!c.productoId) { componentesSinPrecio++; continue; }
      const p = productosCatalogo.find(x => x.id === c.productoId);
      const precioComp = p?.investigacion?.precioEntrada
        || p?.investigacion?.precioSugeridoCalculado
        || 0;
      if (precioComp > 0) {
        sumaComponentes += precioComp * c.cantidad;
        componentesValorizados++;
      } else {
        componentesSinPrecio++;
      }
    }
    const diferencia = sumaComponentes - precioPack;
    const ahorroPct = sumaComponentes > 0 ? (diferencia / sumaComponentes) * 100 : 0;
    return { precioPack, sumaComponentes, diferencia, ahorroPct, componentesValorizados, componentesSinPrecio };
  }, [producto, productosCatalogo]);
  const labelPrecioOrigen = esUSA ? 'Precio USA' : 'Precio Proveedor';
  const labelSubPrecio = esUSA ? 'con impuesto' : 'precio unitario';

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
      <div className="bg-slate-800 rounded-lg p-4 sm:p-5 shadow-md">
        {/* Marca y nombre */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-white">{producto.marca}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                producto.estado === 'activo'
                  ? 'bg-emerald-500 text-white'
                  : producto.estado === 'inactivo'
                  ? 'bg-slate-500 text-white'
                  : 'bg-red-500 text-white'
              }`}>
                {producto.estado === 'activo' ? 'Activo' : producto.estado === 'inactivo' ? 'Inactivo' : 'Descontinuado'}
              </span>
              {producto.esPack && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2 py-0.5 rounded-full shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
                >
                  <Gift className="h-3 w-3" />
                  Pack
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg text-slate-300 mt-1">{producto.nombreComercial}</p>
          </div>

          {/* Acciones - iconos en móvil */}
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            {onInvestigar && (
              <button
                onClick={onInvestigar}
                className="p-2 bg-transparent border border-slate-500 text-slate-200 hover:bg-slate-600/50 rounded-lg transition-colors"
                aria-label="Investigar"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            {onCreateVariante && (
              <button
                onClick={onCreateVariante}
                className="p-2 bg-transparent border border-slate-500 text-slate-200 hover:bg-slate-600/50 rounded-lg transition-colors"
                aria-label="Crear variante"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 bg-transparent border border-slate-500 text-slate-200 hover:bg-slate-600/50 rounded-lg transition-colors"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {producto.estado === 'inactivo' && onReactivar ? (
              <button
                onClick={onReactivar}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                aria-label="Reactivar producto"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={onDelete}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
                aria-label="Eliminar"
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
              {producto.atributosSkincare.volumen && <span className="bg-slate-600/50 text-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.atributosSkincare.volumen}</span>}
              {producto.atributosSkincare.ingredienteClave && <span className="bg-emerald-500/30 text-emerald-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.atributosSkincare.ingredienteClave}</span>}
              {producto.atributosSkincare.spf && <span className="bg-amber-500/30 text-amber-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">SPF{producto.atributosSkincare.spf} {producto.atributosSkincare.pa || ''}</span>}
              {producto.atributosSkincare.pasoRutina && <span className="bg-sky-500/30 text-sky-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{PASO_RUTINA_LABELS[producto.atributosSkincare.pasoRutina]}</span>}
            </>
          ) : (
            <>
              <span className="bg-slate-600/50 text-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.presentacion}</span>
              {producto.dosaje && <span className="bg-slate-600/50 text-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.dosaje}</span>}
              {producto.contenido && <span className="bg-slate-600/50 text-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.contenido}</span>}
              {producto.sabor && <span className="bg-slate-600/50 text-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">{producto.sabor}</span>}
            </>
          )}
        </div>

        {/* SKU y Ver Proveedor */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={copySku}
            className="flex items-center gap-2 bg-slate-600/50 hover:bg-slate-600 text-slate-100 px-2.5 py-1 rounded-md transition-colors text-xs sm:text-sm"
          >
            <span className="font-mono">{producto.sku}</span>
            {copiedSku ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-300" />
            )}
          </button>
        </div>
      </div>

      {/* ============ FICHA DESCRIPTIVA ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 px-1">
        {producto.atributosSkincare ? (
          <>
            <span><span className="text-slate-400">Volumen:</span> {producto.atributosSkincare.volumen || producto.contenido}</span>
            {producto.atributosSkincare.ingredienteClave && (
              <span><span className="text-slate-400">Ingrediente:</span> {producto.atributosSkincare.ingredienteClave}</span>
            )}
            {producto.atributosSkincare.textura && (
              <span><span className="text-slate-400">Textura:</span> {TEXTURA_LABELS[producto.atributosSkincare.textura as TexturaSKC] || producto.atributosSkincare.textura}</span>
            )}
            {producto.atributosSkincare.spf && (
              <span><span className="text-slate-400">SPF:</span> {producto.atributosSkincare.spf} {producto.atributosSkincare.pa || ''}</span>
            )}
          </>
        ) : (
          <>
            {producto.presentacion && (
              <span><span className="text-slate-400">Presentación:</span> {producto.presentacion}</span>
            )}
            {producto.dosaje && (
              <span><span className="text-slate-400">Dosaje:</span> {producto.dosaje}</span>
            )}
            {producto.contenido && (
              <span><span className="text-slate-400">Contenido:</span> {producto.contenido}</span>
            )}
            {producto.sabor && (
              <span><span className="text-slate-400">Sabor:</span> {producto.sabor}</span>
            )}
          </>
        )}
        {producto.varianteLabel && (
          <span className="text-sky-600 font-medium">Variante: {producto.varianteLabel}</span>
        )}
      </div>

      {/* ============ ESTE PACK CONTIENE (TAREA-105) ============ */}
      {producto.esPack && producto.componentesPack && producto.componentesPack.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Este pack contiene</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-purple-700 border border-purple-200">
                {producto.componentesPack.length} componente{producto.componentesPack.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          {/* Tabla alineada estilo line-items (Stripe/Notion/Shopify) */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="text-left px-3 py-2 font-semibold">Producto</th>
                  <th className="text-left px-2 py-2 font-semibold hidden sm:table-cell">Volumen</th>
                  <th className="text-left px-2 py-2 font-semibold hidden sm:table-cell">Tipo</th>
                  <th className="text-center px-2 py-2 font-semibold w-14">Cant.</th>
                  <th className="text-center px-2 py-2 font-semibold w-20">Tipo ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {producto.componentesPack.map((c, i) => {
                  const vinculado = !!c.productoId;
                  const skc = c.atributosSkincare;
                  const volumen = skc?.volumen || c.contenido || '';
                  const tipoRaw = skc?.tipoProductoSKC as string | undefined;
                  const tipoLabel = tipoRaw
                    ? ((TIPO_PRODUCTO_SKC_LABELS as Record<string, string>)[tipoRaw] || tipoRaw)
                    : (c.presentacion || '');
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-medium text-slate-800 text-sm leading-tight truncate">{c.nombre}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-tight truncate">
                          {c.marca && <span className="font-medium">{c.marca}</span>}
                          {c.sku && <span className="text-slate-400 ml-1 font-mono">{c.sku}</span>}
                          {c.notas && <span className="text-slate-400"> · {c.notas}</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 align-top text-slate-700 text-[12px] hidden sm:table-cell whitespace-nowrap">
                        {volumen || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 align-top text-slate-700 text-[12px] hidden sm:table-cell capitalize">
                        {tipoLabel || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 align-top text-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[12px] font-semibold">
                          {c.cantidad}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 align-top text-center">
                        {vinculado ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200"
                            title="Vinculado al catálogo — entra en reporting cruzado"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            Vinc.
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200"
                            title="Exclusivo del pack — solo existe dentro del kit"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            Excl.
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Valorización: pack vs. suma de componentes */}
          {valorizacionPack && (valorizacionPack.precioPack > 0 || valorizacionPack.sumaComponentes > 0) && (
            <div className="mt-3 pt-3 border-t border-purple-100">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Valorización</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-500 mb-0.5">Precio pack</div>
                  <div className="text-base font-bold text-slate-800">
                    {valorizacionPack.precioPack > 0 ? `S/ ${valorizacionPack.precioPack.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">al cliente</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-500 mb-0.5">Suma sueltos</div>
                  <div className="text-base font-bold text-slate-800">
                    {valorizacionPack.sumaComponentes > 0 ? `S/ ${valorizacionPack.sumaComponentes.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {valorizacionPack.componentesValorizados} vinc.
                    {valorizacionPack.componentesSinPrecio > 0 && `, ${valorizacionPack.componentesSinPrecio} s/precio`}
                  </div>
                </div>
                <div className={`rounded-lg p-2.5 border ${
                  valorizacionPack.diferencia > 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : valorizacionPack.diferencia < 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-[10px] text-slate-500 mb-0.5">
                    {valorizacionPack.diferencia >= 0 ? 'Ahorro cliente' : 'Sobreprecio'}
                  </div>
                  <div className={`text-base font-bold ${
                    valorizacionPack.diferencia > 0
                      ? 'text-emerald-700'
                      : valorizacionPack.diferencia < 0
                        ? 'text-red-700'
                        : 'text-slate-700'
                  }`}>
                    {valorizacionPack.precioPack > 0 && valorizacionPack.sumaComponentes > 0
                      ? `S/ ${Math.abs(valorizacionPack.diferencia).toFixed(2)}`
                      : '—'}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {valorizacionPack.precioPack > 0 && valorizacionPack.sumaComponentes > 0
                      ? `${Math.abs(valorizacionPack.ahorroPct).toFixed(0)}% vs. sueltos`
                      : 'Falta precio'}
                  </div>
                </div>
              </div>
              {valorizacionPack.componentesSinPrecio > 0 && (
                <p className="text-[10px] text-slate-400 mt-2">
                  <Info className="h-3 w-3 inline mr-1" />
                  {valorizacionPack.componentesSinPrecio} componente{valorizacionPack.componentesSinPrecio === 1 ? '' : 's'} sin investigación de precio (exclusivos o vinculados sin investigar).
                </p>
              )}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-purple-100 text-[11px] text-slate-600 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
            <span>
              Vender este pack <b>no descuenta</b> stock de los componentes vinculados
              (son unidades físicas distintas). El reporting cruzado se calcula aparte.
            </span>
          </div>
        </div>
      )}

      {/* ============ MÉTRICAS KPI ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <DSStatCard
          label="Stock Perú"
          value={producto.stockPeru}
          subtext={stockCritico ? '⚠️ Crítico' : `Mín: ${producto.stockMinimo}`}
          bgColor={stockCritico ? 'bg-red-500' : 'bg-emerald-500'}
        />
        <DSStatCard
          label="Stock USA"
          value={producto.stockUSA}
          subtext="unidades"
          bgColor="bg-teal-500"
        />
        <DSStatCard
          label="CTRU Promedio"
          value={`S/ ${(producto.ctruPromedio || 0).toFixed(2)}`}
          subtext="costo unitario"
          bgColor="bg-slate-600"
        />
        <DSStatCard
          label="Rotación"
          value={`${producto.rotacionPromedio || 0}`}
          subtext="unidades/mes"
          bgColor="bg-amber-500"
          textColor="text-amber-900"
        />
      </div>

      {/* ============ INVESTIGACIÓN DE MERCADO ============ */}
      {invResumen.tieneInvestigacion && inv ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          {/* Header de investigación */}
          <div className="bg-slate-800 px-3 sm:px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 bg-teal-500 rounded-lg flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-white text-sm sm:text-base">Investigación de Mercado</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                    {inv.fechaInvestigacion?.toDate?.().toLocaleDateString('es-PE')} por {investigadoPorNombre}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                {invResumen.estaVigente ? (
                  <span className="bg-emerald-500 text-white text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1">
                    <Clock className="h-3 w-3 hidden sm:block" />
                    Vigente ({invResumen.diasRestantes}d)
                  </span>
                ) : (
                  <span className="bg-red-500 text-white text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 hidden sm:block" />
                    Vencida
                  </span>
                )}
                <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1 ${
                  inv.recomendacion === 'importar' ? 'bg-emerald-500 text-white' :
                  inv.recomendacion === 'descartar' ? 'bg-red-500 text-white' : 'bg-amber-500 text-amber-900'
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
            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-slate-500" />
                Desglose del Costo (CTRU)
              </h4>
              {/* Mobile: Grid layout */}
              <div className="grid grid-cols-3 gap-2 sm:hidden">
                <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-500 mb-0.5">{labelPrecioOrigen}</p>
                  <p className="text-sm font-bold text-teal-600">
                    ${(inv.precioUSAMin || inv.precioUSAPromedio).toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-500 mb-0.5">Flete</p>
                  <p className="text-sm font-bold text-slate-600">
                    ${(inv.logisticaEstimada || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-500 mb-0.5">Total USD</p>
                  <p className="text-sm font-bold text-slate-700">
                    ${((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0)).toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-500 mb-0.5">TC</p>
                  <p className="text-sm font-bold text-amber-600">
                    {inv.ctruEstimado > 0 && (inv.precioUSAMin || inv.precioUSAPromedio) > 0
                      ? (inv.ctruEstimado / ((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0))).toFixed(2)
                      : '?'}
                  </p>
                </div>
                <div className="col-span-2 text-center p-2 bg-teal-100 rounded-lg border border-teal-200">
                  <p className="text-[10px] text-teal-600 mb-0.5 font-medium">CTRU Final</p>
                  <p className="text-base font-bold text-teal-700">
                    S/ {inv.ctruEstimado.toFixed(2)}
                  </p>
                </div>
              </div>
              {/* Desktop: Horizontal formula layout */}
              <div className="hidden sm:flex items-center justify-between gap-2 text-sm">
                {/* Precio USA */}
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-1">{labelPrecioOrigen}</p>
                  <p className="text-lg font-bold text-teal-600">
                    ${(inv.precioUSAMin || inv.precioUSAPromedio).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">{labelSubPrecio}</p>
                </div>

                <span className="text-slate-400 font-bold text-lg">+</span>

                {/* Flete */}
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-1">Flete</p>
                  <p className="text-lg font-bold text-slate-600">
                    ${(inv.logisticaEstimada || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">USD/unidad</p>
                </div>

                <span className="text-slate-400 font-bold text-lg">=</span>

                {/* Total USD */}
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-1">Total USD</p>
                  <p className="text-lg font-bold text-slate-700">
                    ${((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0)).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">costo unitario</p>
                </div>

                <span className="text-slate-400 font-bold text-lg">×</span>

                {/* TC */}
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-500 mb-1">TC</p>
                  <p className="text-lg font-bold text-amber-600">
                    {inv.ctruEstimado > 0 && (inv.precioUSAMin || inv.precioUSAPromedio) > 0
                      ? (inv.ctruEstimado / ((inv.precioUSAMin || inv.precioUSAPromedio) + (inv.logisticaEstimada || 0))).toFixed(2)
                      : '?'}
                  </p>
                  <p className="text-[10px] text-slate-400">fecha inv.</p>
                </div>

                <span className="text-slate-400 font-bold text-lg">=</span>

                {/* CTRU */}
                <div className="text-center flex-1 bg-teal-100 rounded-lg p-2 -m-1">
                  <p className="text-xs text-teal-600 mb-1 font-medium">CTRU</p>
                  <p className="text-xl font-bold text-teal-700">
                    S/ {inv.ctruEstimado.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-teal-500">tu inversión</p>
                </div>
              </div>
            </div>

            {/* Grid de precios de mercado y margen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex items-center justify-between sm:flex-col sm:items-start">
                  <div className="flex items-center gap-2 sm:mb-2">
                    <div className="p-1.5 bg-emerald-100 rounded-md">
                      <Target className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Precio Perú</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-lg sm:text-xl font-bold text-emerald-600">
                      S/ {(inv.precioEntrada || inv.precioPERUPromedio).toFixed(2)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      {inv.precioEntrada ? 'Entrada (-5%)' : 'Promedio ML'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex items-center justify-between sm:flex-col sm:items-start">
                  <div className="flex items-center gap-2 sm:mb-2">
                    <div className={`p-1.5 rounded-md ${
                      inv.margenEstimado >= 30 ? 'bg-emerald-100' :
                      inv.margenEstimado >= 20 ? 'bg-amber-100' : 'bg-red-100'
                    }`}>
                      <TrendingUp className={`h-3.5 w-3.5 ${
                        inv.margenEstimado >= 30 ? 'text-emerald-600' :
                        inv.margenEstimado >= 20 ? 'text-amber-600' : 'text-red-600'
                      }`} />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Margen Est.</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className={`text-lg sm:text-xl font-bold ${
                      inv.margenEstimado >= 30 ? 'text-emerald-600' :
                      inv.margenEstimado >= 20 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {inv.margenEstimado.toFixed(1)}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      {inv.margenEstimado >= 30 ? 'Excelente' : inv.margenEstimado >= 20 ? 'Aceptable' : 'Bajo'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex items-center justify-between sm:flex-col sm:items-start">
                  <div className="flex items-center gap-2 sm:mb-2">
                    <div className="p-1.5 bg-teal-100 rounded-md">
                      <DollarSign className="h-3.5 w-3.5 text-teal-600" />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Ganancia/Unidad</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className={`text-lg sm:text-xl font-bold ${
                      ((inv.precioEntrada || inv.precioPERUPromedio) - inv.ctruEstimado) > 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}>
                      S/ {((inv.precioEntrada || inv.precioPERUPromedio) - inv.ctruEstimado).toFixed(2)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400">precio - CTRU</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas ROI */}
            {metricsROI && (
              <div className="bg-emerald-500 rounded-lg p-3 sm:p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-white" />
                  <span className="font-medium text-white text-sm sm:text-base">Rendimiento de Inversión</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-emerald-100 mb-0.5 sm:mb-1">Ganancia/Unidad</p>
                    <p className="text-base sm:text-lg font-bold text-white">S/ {metricsROI.ganancia.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-emerald-100 mb-0.5 sm:mb-1">ROI</p>
                    <p className="text-base sm:text-lg font-bold text-white">{metricsROI.roi.toFixed(1)}%</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-emerald-100 mb-0.5 sm:mb-1">Multiplicador</p>
                    <p className="text-base sm:text-lg font-bold text-white">{metricsROI.multiplicador.toFixed(2)}x</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-emerald-100 mb-0.5 sm:mb-1">Precio Venta</p>
                    <p className="text-base sm:text-lg font-bold text-white">S/ {metricsROI.precioVenta.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}


            {/* Razonamiento */}
            {inv.razonamiento && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1">Análisis y Razonamiento</p>
                <p className="text-sm text-slate-700">{inv.razonamiento}</p>
              </div>
            )}

            {/* Punto de Equilibrio - Solo si hay CTRU estimado */}
            {inv.ctruEstimado > 0 && (
              <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-teal-500 rounded-lg">
                    <Calculator className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-semibold text-slate-800">Análisis de Punto de Equilibrio</h4>
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
        <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-6 text-center shadow-sm">
          <div className="inline-flex p-3 bg-slate-100 rounded-full mb-3">
            <Search className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="font-medium text-slate-700 mb-1">
            Sin Investigación de Mercado
          </h3>
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
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
          label="Información del Producto"
          icon={<Package className="h-4 w-4" />}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-600"
        >
          <div className="grid grid-cols-2 gap-4 mt-3">
            {producto.tipoProducto ? (
              <div>
                <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <FlaskConical className="h-3 w-3" /> Tipo de Producto
                </span>
                <span className="inline-block bg-teal-100 text-teal-700 text-sm px-2 py-0.5 rounded">
                  {typeof producto.tipoProducto === 'string' ? producto.tipoProducto : producto.tipoProducto.nombre}
                </span>
              </div>
            ) : producto.subgrupo && (
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Subgrupo</span>
                <p className="font-medium text-slate-800">{producto.subgrupo}</p>
              </div>
            )}

            {producto.categorias && producto.categorias.length > 0 ? (
              <div>
                <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <FolderTree className="h-3 w-3" /> Categorías
                </span>
                <div className="flex flex-wrap gap-1">
                  {producto.categorias.map(cat => (
                    <span
                      key={cat.categoriaId}
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded ${
                        cat.categoriaId === producto.categoriaPrincipalId
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {cat.categoriaId === producto.categoriaPrincipalId && (
                        <Star className="h-3 w-3 mr-1 text-amber-500 fill-amber-500" />
                      )}
                      {cat.nombre}
                    </span>
                  ))}
                </div>
              </div>
            ) : producto.grupo && (
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Grupo</span>
                <p className="font-medium text-slate-800">{producto.grupo}</p>
              </div>
            )}

            {/* Atributos Skincare */}
            {!esUSA && producto.atributosSkincare && (
              <div className="col-span-2 bg-purple-50/50 rounded-lg p-3 border border-purple-100">
                <span className="text-xs font-medium text-purple-700 mb-2 block">Atributos Skincare</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(producto.atributosSkincare.tipoPiel?.length ?? 0) > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Tipo de Piel</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {producto.atributosSkincare.tipoPiel!.map((t: string) => (
                          <span key={t} className="text-[11px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(producto.atributosSkincare.preocupaciones?.length ?? 0) > 0 && (
                    <div className="col-span-2 sm:col-span-2">
                      <span className="text-[10px] text-slate-500 block">Preocupaciones</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {producto.atributosSkincare.preocupaciones!.map((p: string) => (
                          <span key={p} className="text-[11px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {producto.atributosSkincare.ingredienteClave && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Ingrediente Clave</span>
                      <p className="text-sm font-medium text-slate-800">{producto.atributosSkincare.ingredienteClave}</p>
                    </div>
                  )}
                  {(producto.atributosSkincare.spf || producto.atributosSkincare.pa) && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Protección</span>
                      <p className="text-sm font-medium text-slate-800">
                        {producto.atributosSkincare.spf ? `SPF ${producto.atributosSkincare.spf}` : ''}
                        {producto.atributosSkincare.spf && producto.atributosSkincare.pa ? ' · ' : ''}
                        {producto.atributosSkincare.pa || ''}
                      </p>
                    </div>
                  )}
                  {producto.atributosSkincare.volumen && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Volumen</span>
                      <p className="text-sm font-medium text-slate-800">{producto.atributosSkincare.volumen}</p>
                    </div>
                  )}
                  {producto.atributosSkincare.pasoRutina && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Paso Rutina</span>
                      <p className="text-sm font-medium text-slate-800">{PASO_RUTINA_LABELS[producto.atributosSkincare.pasoRutina] || producto.atributosSkincare.pasoRutina}</p>
                    </div>
                  )}
                  {producto.atributosSkincare.pao && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">PAO</span>
                      <p className="text-sm font-medium text-slate-800">{producto.atributosSkincare.pao} meses</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {producto.codigoUPC && (
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Código UPC</span>
                <p className="font-mono text-sm text-slate-800">{producto.codigoUPC}</p>
              </div>
            )}

            {producto.cicloRecompraDias && (
              <div>
                <span className="text-xs text-slate-500 mb-1 block">Ciclo de Recompra</span>
                <p className="font-medium text-slate-800">{producto.cicloRecompraDias} días</p>
              </div>
            )}

            {producto.etiquetasData && producto.etiquetasData.length > 0 && (
              <div className="col-span-2">
                <span className="text-xs text-slate-500 flex items-center gap-1 mb-1">
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
          label="Inventario"
          icon={<Box className="h-4 w-4" />}
          iconBgColor={stockCritico ? 'bg-red-100' : 'bg-emerald-100'}
          iconColor={stockCritico ? 'text-red-600' : 'text-emerald-600'}
          badge={stockCritico ? <AlertTriangle className="h-4 w-4 text-red-500 ml-2" /> : undefined}
          defaultOpen={stockCritico}
        >
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className={`rounded-lg p-2 sm:p-3 text-center ${stockCritico ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Perú</p>
                <p className={`text-lg sm:text-xl font-bold ${stockCritico ? 'text-red-600' : 'text-emerald-600'}`}>
                  {producto.stockPeru}
                </p>
              </div>
              <div className="bg-teal-50 border border-teal-100 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">USA</p>
                <p className="text-lg sm:text-xl font-bold text-teal-600">{producto.stockUSA}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Tránsito</p>
                <p className="text-lg sm:text-xl font-bold text-amber-600">{producto.stockTransito}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Disponible</p>
                <p className="text-lg sm:text-xl font-bold text-slate-700">{producto.stockDisponible}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
              <div className="flex justify-between bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 text-xs sm:text-sm">Stock Mínimo</span>
                <span className="font-medium text-slate-800">{producto.stockMinimo}</span>
              </div>
              <div className="flex justify-between bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 text-xs sm:text-sm">Stock Máximo</span>
                <span className="font-medium text-slate-800">{producto.stockMaximo}</span>
              </div>
              <div className="flex justify-between bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 text-xs sm:text-sm">Reservado</span>
                <span className="font-medium text-slate-800">{producto.stockReservado}</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Datos Comerciales */}
        <CollapsibleSection
          label="Datos Comerciales"
          icon={<DollarSign className="h-4 w-4" />}
          iconBgColor="bg-teal-100"
          iconColor="text-teal-600"
        >
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">CTRU Promedio</span>
              <p className="text-xl font-bold text-slate-800">S/ {(producto.ctruPromedio || 0).toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Margen Mínimo (Categoría)</span>
              <p className="text-lg font-bold text-slate-700">{(producto.categorias?.find((c: any) => c.id === producto.categoriaPrincipalId) || producto.categorias?.[0])?.margenMinimo ?? 20}%</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Margen Objetivo (Categoría)</span>
              <p className="text-lg font-bold text-emerald-600">{(producto.categorias?.find((c: any) => c.id === producto.categoriaPrincipalId) || producto.categorias?.[0])?.margenObjetivo ?? 35}%</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Métricas de Rendimiento */}
        {(producto.rotacionPromedio > 0 || producto.diasParaQuiebre > 0) && (
          <CollapsibleSection
            label="Métricas de Rendimiento"
            icon={<TrendingUp className="h-4 w-4" />}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-600"
          >
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-slate-50 p-2 sm:p-3 rounded-lg text-center border border-slate-100">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Rotación/Mes</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{producto.rotacionPromedio || 0}</p>
              </div>
              <div className="bg-slate-50 p-2 sm:p-3 rounded-lg text-center border border-slate-100">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Días Quiebre</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{producto.diasParaQuiebre || 0}</p>
              </div>
              <div className="bg-slate-50 p-2 sm:p-3 rounded-lg text-center border border-slate-100">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Recompra</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{producto.cicloRecompraDias || '-'}d</p>
              </div>
            </div>
          </CollapsibleSection>
        )}


        {/* Historial placeholder */}
        <CollapsibleSection
          label="Historial"
          icon={<History className="h-4 w-4" />}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-500"
        >
          <div className="mt-3 text-center py-6 text-slate-500">
            <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Historial de compras y ventas próximamente</p>
          </div>
        </CollapsibleSection>
      </div>

      {/* ============ VARIANTES ============ */}
      {producto.esVariante && producto.parentId && (
        <div className="flex items-center gap-2 p-2 bg-sky-50 border border-sky-200 rounded-lg text-xs">
          <GitBranch className="h-3.5 w-3.5 text-sky-500" />
          <span className="text-sky-700">Variante{producto.varianteLabel ? `: ${producto.varianteLabel}` : ''}</span>
        </div>
      )}

      {producto.esPadre && variantes && variantes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <GitBranch className="h-4 w-4" style={{ color: '#4d7c0f' }} />
            Variantes del grupo ({variantes.length})
          </h4>
          <div className="space-y-1">
            {variantes.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => onViewVariante?.(v)}
                className="w-full flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{v.sku}</span>
                  <span className="text-xs text-slate-700">{v.varianteLabel || v.contenido || v.presentacion}</span>
                </div>
                <span className="text-xs text-slate-400">Stock: {v.stockPeru || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ FOOTER ============ */}
      <div className="flex justify-between items-center text-xs text-slate-500 pt-3 border-t border-slate-200">
        <span>Creado por: <span className="font-medium text-slate-700">{creadoPorNombre}</span></span>
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
