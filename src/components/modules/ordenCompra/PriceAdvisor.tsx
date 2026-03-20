/**
 * PRICE ADVISOR COMPONENT
 * Panel inteligente de asesoría de precios para órdenes de compra
 *
 * Muestra:
 * - Evaluación del precio ingresado
 * - Gráfico de histórico de precios
 * - Comparativa de proveedores
 * - Proyección de rentabilidad
 * - Alertas y recomendaciones
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Lightbulb,
  History,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  BarChart3,
  Zap
} from 'lucide-react';
import { PriceIntelligenceService } from '../../../services/priceIntelligence.service';
import { PriceHistoryChart } from './PriceHistoryChart';
import { usePaisOrigenStore } from '../../../store/paisOrigenStore';
import type { PriceIntelligenceResult, PriceIntelligenceConfig } from '../../../types/priceIntelligence.types';
import type { Producto } from '../../../types/producto.types';

interface PriceAdvisorProps {
  producto: Producto;
  precioIngresado: number;
  tipoCambio: number;
  proveedorActual?: string;
  onUsarPrecioSugerido?: (precio: number) => void;
  compact?: boolean;
}

export const PriceAdvisor: React.FC<PriceAdvisorProps> = ({
  producto,
  precioIngresado,
  tipoCambio,
  proveedorActual,
  onUsarPrecioSugerido,
  compact = false
}) => {
  const [analysis, setAnalysis] = useState<PriceIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [activeSection, setActiveSection] = useState<'overview' | 'history' | 'providers' | 'profitability'>('overview');

  // Márgenes desde categoría principal
  const categoriaPrincipal = producto.categorias?.find(c => c.categoriaId === producto.categoriaPrincipalId) || producto.categorias?.[0];
  const margenObjetivoCategoria = categoriaPrincipal?.margenObjetivo ?? 35;
  const margenMinimoCategoria = categoriaPrincipal?.margenMinimo ?? 15;

  // Flete desde ruta (paisOrigen)
  const getFleteEstimado = usePaisOrigenStore(s => s.getFleteEstimado);
  const fleteRuta = getFleteEstimado?.(producto.paisOrigen || 'US') ?? 0;

  // Debounce del precio para evitar muchas llamadas
  const [debouncedPrecio, setDebouncedPrecio] = useState(precioIngresado);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrecio(precioIngresado);
    }, 500);
    return () => clearTimeout(timer);
  }, [precioIngresado]);

  // Configuración del análisis
  const config: PriceIntelligenceConfig = useMemo(() => ({
    tipoCambio,
    margenObjetivo: margenObjetivoCategoria,
    margenMinimo: margenMinimoCategoria,
    costoFleteInternacional: fleteRuta,
    proveedorActual
  }), [tipoCambio, producto, proveedorActual]);

  // Cargar análisis cuando cambia el precio
  useEffect(() => {
    if (!producto.id || debouncedPrecio <= 0) {
      setAnalysis(null);
      return;
    }

    const loadAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await PriceIntelligenceService.analizarPrecio({
          productoId: producto.id,
          precioCompra: debouncedPrecio,
          config
        });
        setAnalysis(result);
      } catch (err: any) {
        console.error('Error en análisis de precio:', err);
        setError(err.message || 'Error al analizar precio');
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [producto.id, debouncedPrecio, config]);

  // Colores según nivel de evaluación
  const getEvaluacionStyles = (color: string) => {
    switch (color) {
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: 'text-green-500',
          progress: 'bg-green-500'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          icon: 'text-yellow-500',
          progress: 'bg-yellow-500'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          icon: 'text-orange-500',
          progress: 'bg-orange-500'
        };
      case 'red':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-500',
          progress: 'bg-red-500'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          icon: 'text-gray-500',
          progress: 'bg-gray-500'
        };
    }
  };

  // Icono de tendencia
  const TendenciaIcon = ({ tendencia }: { tendencia: string }) => {
    switch (tendencia) {
      case 'subiendo':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'bajando':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  // Si no hay precio o producto, no mostrar nada
  if (!producto.id || precioIngresado <= 0) {
    return null;
  }

  // Estado de carga
  if (loading && !analysis) {
    return (
      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary-500 mr-2" />
        <span className="text-sm text-gray-600">Analizando precio...</span>
      </div>
    );
  }

  // Error
  if (error && !analysis) {
    return (
      <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center">
        <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
    );
  }

  // Sin análisis
  if (!analysis) {
    return null;
  }

  const styles = getEvaluacionStyles(analysis.evaluacion.color);

  // Vista compacta
  if (compact && !expanded) {
    return (
      <div
        className={`mt-2 p-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${styles.bg} ${styles.border}`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className={`h-4 w-4 ${styles.icon}`} />
            <span className={`text-sm font-medium ${styles.text}`}>
              {analysis.evaluacion.mensaje}
            </span>
            {analysis.evaluacion.vsPromedioHistorico !== 0 && (
              <span className="text-xs text-gray-500">
                ({analysis.evaluacion.vsPromedioHistorico > 0 ? '+' : ''}{analysis.evaluacion.vsPromedioHistorico.toFixed(1)}% vs promedio)
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    );
  }

  // Vista expandida completa
  return (
    <div className={`mt-3 rounded-lg border ${styles.border} overflow-hidden`}>
      {/* Header */}
      <div
        className={`px-4 py-3 ${styles.bg} flex items-center justify-between cursor-pointer`}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-white shadow-sm`}>
            <Lightbulb className={`h-5 w-5 ${styles.icon}`} />
          </div>
          <div>
            <h4 className={`font-semibold ${styles.text}`}>
              Asesor de Precios
            </h4>
            <p className="text-xs text-gray-500">
              {producto.marca} - {producto.nombreComercial}
            </p>
          </div>
        </div>
        {compact && (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Evaluación Principal */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${styles.text}`}>
              {analysis.evaluacion.mensaje}
            </span>
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${styles.bg} ${styles.text}`}>
            {Math.round(analysis.evaluacion.puntuacion)}/100
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full h-2 bg-gray-100 rounded-full mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${styles.progress}`}
            style={{ width: `${analysis.evaluacion.puntuacion}%` }}
          />
        </div>

        <p className="text-sm text-gray-600">
          {analysis.evaluacion.descripcion}
        </p>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {analysis.tieneHistorico && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">vs Promedio</div>
              <div className={`text-sm font-semibold ${
                analysis.evaluacion.vsPromedioHistorico > 5 ? 'text-red-600' :
                analysis.evaluacion.vsPromedioHistorico < -5 ? 'text-green-600' : 'text-gray-700'
              }`}>
                {analysis.evaluacion.vsPromedioHistorico > 0 ? '+' : ''}
                {analysis.evaluacion.vsPromedioHistorico.toFixed(1)}%
              </div>
            </div>
          )}

          {analysis.evaluacion.vsInvestigacion !== null && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">vs Investigación</div>
              <div className={`text-sm font-semibold ${
                analysis.evaluacion.vsInvestigacion > 5 ? 'text-red-600' :
                analysis.evaluacion.vsInvestigacion < -5 ? 'text-green-600' : 'text-gray-700'
              }`}>
                {analysis.evaluacion.vsInvestigacion > 0 ? '+' : ''}
                {analysis.evaluacion.vsInvestigacion.toFixed(1)}%
              </div>
            </div>
          )}

          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Margen Est.</div>
            <div className={`text-sm font-semibold ${
              analysis.proyeccionRentabilidad.margenEstimado < 15 ? 'text-red-600' :
              analysis.proyeccionRentabilidad.margenEstimado < 25 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {analysis.proyeccionRentabilidad.margenEstimado.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de secciones */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { id: 'overview', label: 'Resumen', icon: Zap },
          { id: 'history', label: 'Histórico', icon: History },
          { id: 'providers', label: 'Proveedores', icon: Users },
          { id: 'profitability', label: 'Rentabilidad', icon: Target }
        ].map(tab => (
          <button
            type="button"
            key={tab.id}
            className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
              activeSection === tab.id
                ? 'text-primary-600 border-b-2 border-primary-500 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setActiveSection(tab.id as any)}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de secciones */}
      <div className="p-4 bg-white">
        {/* Resumen / Alertas */}
        {activeSection === 'overview' && (
          <div className="space-y-3">
            {analysis.alertas.map((alerta, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg flex items-start gap-3 ${
                  alerta.tipo === 'success' ? 'bg-green-50 border border-green-200' :
                  alerta.tipo === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                  alerta.tipo === 'danger' ? 'bg-red-50 border border-red-200' :
                  'bg-blue-50 border border-blue-200'
                }`}
              >
                {alerta.tipo === 'success' && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                {alerta.tipo === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                {alerta.tipo === 'danger' && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                {alerta.tipo === 'info' && <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    alerta.tipo === 'success' ? 'text-green-800' :
                    alerta.tipo === 'warning' ? 'text-yellow-800' :
                    alerta.tipo === 'danger' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {alerta.titulo}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{alerta.mensaje}</p>
                  {alerta.accion && (
                    <p className="text-xs font-medium mt-1 text-gray-700">{alerta.accion}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Ahorro potencial */}
            {analysis.analisisAhorro && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">
                    Oportunidad de ahorro
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  {analysis.analisisAhorro.mensaje}
                </p>
                {onUsarPrecioSugerido && (
                  <button
                    type="button"
                    onClick={() => {
                      const mejorProveedor = analysis.comparativaProveedores.find(p => p.esRecomendado);
                      if (mejorProveedor) {
                        onUsarPrecioSugerido(mejorProveedor.precioConImpuesto);
                      }
                    }}
                    className="mt-2 text-xs font-medium text-green-700 hover:text-green-800 underline"
                  >
                    Usar precio sugerido
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Histórico de precios */}
        {activeSection === 'history' && (
          <div>
            {analysis.tieneHistorico ? (
              <>
                {/* Estadísticas */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Mínimo</div>
                    <div className="text-sm font-semibold text-green-600">
                      ${analysis.estadisticasHistorico.minimo.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Promedio</div>
                    <div className="text-sm font-semibold text-gray-700">
                      ${analysis.estadisticasHistorico.promedio.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Máximo</div>
                    <div className="text-sm font-semibold text-red-600">
                      ${analysis.estadisticasHistorico.maximo.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Tendencia</div>
                    <div className="flex items-center justify-center gap-1">
                      <TendenciaIcon tendencia={analysis.estadisticasHistorico.tendencia} />
                      <span className="text-sm font-medium capitalize">
                        {analysis.estadisticasHistorico.tendencia}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gráfico */}
                <PriceHistoryChart
                  puntos={analysis.puntosHistorico}
                  precioActual={precioIngresado}
                  promedioHistorico={analysis.estadisticasHistorico.promedio}
                />

                <p className="text-xs text-gray-500 mt-3 text-center">
                  {analysis.estadisticasHistorico.totalCompras} compras registradas
                  {analysis.estadisticasHistorico.ultimaCompra && (
                    <> · Última: {analysis.estadisticasHistorico.ultimaCompra.toLocaleDateString()}</>
                  )}
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin historial de compras</p>
                <p className="text-xs mt-1">Esta será la primera compra registrada para este producto</p>
              </div>
            )}
          </div>
        )}

        {/* Comparativa de proveedores */}
        {activeSection === 'providers' && (
          <div>
            {analysis.comparativaProveedores.length > 0 ? (
              <div className="space-y-2">
                {analysis.comparativaProveedores.map((prov, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      prov.esRecomendado
                        ? 'bg-green-50 border-green-200'
                        : prov.esActual
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          prov.esRecomendado ? 'text-green-700' :
                          prov.esActual ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          {prov.nombre}
                        </span>
                        {prov.esRecomendado && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            Recomendado
                          </span>
                        )}
                        {prov.esActual && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            Actual
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          ${prov.precioConImpuesto.toFixed(2)}
                        </div>
                        {prov.porcentajeVsMejor > 0 && (
                          <div className="text-xs text-red-600">
                            +{prov.porcentajeVsMejor.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Base: ${prov.precioBase.toFixed(2)}</span>
                      {prov.impuesto > 0 && <span>Tax: {prov.impuesto}%</span>}
                      {prov.envioEstimado > 0 && <span>Envío: ${prov.envioEstimado.toFixed(2)}</span>}
                      <span className={`px-1.5 py-0.5 rounded ${
                        prov.disponibilidad === 'en_stock' ? 'bg-green-100 text-green-700' :
                        prov.disponibilidad === 'bajo_stock' ? 'bg-yellow-100 text-yellow-700' :
                        prov.disponibilidad === 'sin_stock' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {prov.disponibilidad === 'en_stock' ? 'En stock' :
                         prov.disponibilidad === 'bajo_stock' ? 'Bajo stock' :
                         prov.disponibilidad === 'sin_stock' ? 'Sin stock' : 'N/D'}
                      </span>
                    </div>
                    {prov.url && (
                      <a
                        href={prov.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-primary-600 hover:text-primary-800"
                      >
                        Ver producto <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin datos de proveedores</p>
                <p className="text-xs mt-1">Realiza una investigación de mercado para comparar</p>
              </div>
            )}

            {/* Info de investigación */}
            {analysis.tieneInvestigacion && (
              <div className={`mt-3 p-2 rounded text-xs ${
                analysis.investigacionVigente ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              }`}>
                {analysis.investigacionVigente
                  ? `Investigación vigente (${analysis.diasDesdeInvestigacion} días)`
                  : `Investigación desactualizada (${analysis.diasDesdeInvestigacion} días)`}
              </div>
            )}
          </div>
        )}

        {/* Rentabilidad */}
        {activeSection === 'profitability' && (
          <div className="space-y-4">
            {/* Proyección de costos */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Proyección de Costos
              </h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Costo compra (USD):</span>
                  <span className="font-medium">${(precioIngresado || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">+ Flete Internacional:</span>
                  <span className="font-medium">${(fleteRuta || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">= Costo Total USD:</span>
                  <span className="font-medium">${(analysis.proyeccionRentabilidad?.ctruProyectadoUSD || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-primary-600">
                  <span>CTRU (TC {(tipoCambio || 0).toFixed(3)}):</span>
                  <span className="font-semibold">S/ {(analysis.proyeccionRentabilidad?.ctruProyectado || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Proyección de venta */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <h5 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Proyección de Venta
              </h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio venta sugerido:</span>
                  <span className="font-medium">S/ {(analysis.proyeccionRentabilidad?.precioVentaSugerido || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ganancia por unidad:</span>
                  <span className={`font-medium ${
                    (analysis.proyeccionRentabilidad?.gananciaPorUnidad || 0) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    S/ {(analysis.proyeccionRentabilidad?.gananciaPorUnidad || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Margen estimado:</span>
                  <span className={`font-semibold ${
                    (analysis.proyeccionRentabilidad?.margenEstimado || 0) >= 25 ? 'text-green-600' :
                    (analysis.proyeccionRentabilidad?.margenEstimado || 0) >= 15 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {(analysis.proyeccionRentabilidad?.margenEstimado || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Comparación con competencia */}
            {analysis.proyeccionRentabilidad?.vsCompetenciaPeru && (
              <div className={`p-3 rounded-lg ${
                analysis.proyeccionRentabilidad.vsCompetenciaPeru.posicion === 'mas_barato'
                  ? 'bg-green-50'
                  : analysis.proyeccionRentabilidad.vsCompetenciaPeru.posicion === 'mas_caro'
                  ? 'bg-red-50'
                  : 'bg-gray-50'
              }`}>
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  vs Competencia Perú
                </h5>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Promedio competencia: S/ {(analysis.proyeccionRentabilidad.vsCompetenciaPeru.precioPromedio || 0).toFixed(2)}
                  </span>
                  <span className={`text-sm font-medium ${
                    analysis.proyeccionRentabilidad.vsCompetenciaPeru.posicion === 'mas_barato' ? 'text-green-600' :
                    analysis.proyeccionRentabilidad.vsCompetenciaPeru.posicion === 'mas_caro' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {(analysis.proyeccionRentabilidad.vsCompetenciaPeru.porcentaje || 0) > 0 ? '+' : ''}
                    {(analysis.proyeccionRentabilidad.vsCompetenciaPeru.porcentaje || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
