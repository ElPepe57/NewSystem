import { useState, useEffect } from 'react';
import {
  Users, Globe, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  BarChart3, Target, Shield, ShieldAlert, ShieldCheck, Eye, X,
  RefreshCw, ExternalLink, Package, Star, AlertCircle, Zap,
  ThumbsUp, ThumbsDown, Activity, Award, ChevronRight
} from 'lucide-react';
import type { Competidor } from '../../types/entidadesMaestras.types';
import {
  competidorAnalyticsService,
  type CompetidorAnalytics,
  type AnalisisPrecio,
  type FortalezaDebilidad,
  type AlertaCompetencia,
  type RecomendacionEstrategica
} from '../../services/competidor.analytics.service';

type DetailTab = 'resumen' | 'precios' | 'historial' | 'analisis' | 'comparativa';

interface CompetidorDetailViewProps {
  competidor: Competidor;
  onClose: () => void;
  onEdit?: () => void;
}

export function CompetidorDetailView({ competidor, onClose, onEdit }: CompetidorDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [analytics, setAnalytics] = useState<CompetidorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [competidor.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await competidorAnalyticsService.getCompetidorAnalytics(competidor.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getNivelAmenazaColor = (nivel?: string) => {
    switch (nivel) {
      case 'alto': return 'bg-red-100 text-red-800 border-red-300';
      case 'medio': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'bajo': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getNivelAmenazaIcon = (nivel?: string) => {
    switch (nivel) {
      case 'alto': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'medio': return <Shield className="w-5 h-5 text-yellow-500" />;
      case 'bajo': return <ShieldCheck className="w-5 h-5 text-green-500" />;
      default: return <Shield className="w-5 h-5 text-gray-500" />;
    }
  };

  const getVentajaColor = (ventaja: string) => {
    switch (ventaja) {
      case 'nosotros': return 'text-green-600 bg-green-100';
      case 'competidor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertaIcon = (severidad: string) => {
    switch (severidad) {
      case 'danger': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  // Renderizar pestaña Resumen
  const renderResumen = () => (
    <div className="space-y-6">
      {/* Info del competidor */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold ${
            analytics?.nivelAmenaza === 'alto' ? 'bg-red-100 text-red-600' :
            analytics?.nivelAmenaza === 'medio' ? 'bg-yellow-100 text-yellow-600' :
            'bg-green-100 text-green-600'
          }`}>
            {getNivelAmenazaIcon(analytics?.nivelAmenaza)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{competidor.nombre}</h2>
              {analytics && (
                <span className={`px-2 py-1 text-sm font-bold rounded-full border ${getNivelAmenazaColor(analytics.nivelAmenaza)}`}>
                  Amenaza {analytics.nivelAmenaza}
                </span>
              )}
            </div>
            <p className="text-gray-500">{competidor.codigo}</p>

            <div className="flex flex-wrap gap-4 mt-3">
              {competidor.plataforma && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Globe className="w-4 h-4" />
                  {competidor.plataforma}
                </div>
              )}
              {competidor.url && (
                <a
                  href={competidor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver perfil
                </a>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-full ${
                competidor.estado === 'activo' ? 'bg-green-100 text-green-800' :
                competidor.estado === 'inactivo' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {competidor.estado}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Package className="w-4 h-4" />
              Productos Analizados
            </div>
            <div className="text-2xl font-bold text-gray-900">{analytics.productosAnalizados}</div>
            <div className="text-xs text-gray-500">
              {analytics.diasSinAnalisis} días desde último análisis
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <DollarSign className="w-4 h-4" />
              Diferencia Promedio
            </div>
            <div className={`text-2xl font-bold ${
              analytics.diferenciaPromedioGlobal > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {analytics.diferenciaPromedioGlobal > 0 ? '+' : ''}{formatPercent(analytics.diferenciaPromedioGlobal)}
            </div>
            <div className="text-xs text-gray-500">
              vs nuestros precios
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ThumbsUp className="w-4 h-4" />
              Nosotros + Baratos
            </div>
            <div className="text-2xl font-bold text-green-600">{analytics.productosMasCaros}</div>
            <div className="text-xs text-gray-500">
              productos con ventaja
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ThumbsDown className="w-4 h-4" />
              Ellos + Baratos
            </div>
            <div className="text-2xl font-bold text-red-600">{analytics.productosMasBaratos}</div>
            <div className="text-xs text-gray-500">
              productos con desventaja
            </div>
          </div>
        </div>
      )}

      {/* Gauge de amenaza */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nivel de Amenaza</h3>
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={
                    analytics.nivelAmenazaScore >= 70 ? '#ef4444' :
                    analytics.nivelAmenazaScore >= 40 ? '#f59e0b' :
                    '#22c55e'
                  }
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(analytics.nivelAmenazaScore / 100) * 352} 352`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold">{analytics.nivelAmenazaScore}</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Precio Competitivo</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${analytics.factoresAmenaza.precioCompetitivo}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.factoresAmenaza.precioCompetitivo}%</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Reputación</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500"
                      style={{ width: `${analytics.factoresAmenaza.reputacion}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.factoresAmenaza.reputacion}%</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Variedad</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${analytics.factoresAmenaza.variedadProductos}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.factoresAmenaza.variedadProductos}%</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Actividad</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${analytics.factoresAmenaza.actividadReciente}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.factoresAmenaza.actividadReciente}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas */}
      {analytics && analytics.alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas ({analytics.alertasActivas})
          </h3>
          <div className="space-y-3">
            {analytics.alertas.slice(0, 5).map((alerta, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alerta.severidad === 'danger' ? 'bg-red-50 border-red-200' :
                  alerta.severidad === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {getAlertaIcon(alerta.severidad)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{alerta.mensaje}</div>
                    {alerta.detalle && (
                      <div className="text-sm text-gray-600 mt-1">{alerta.detalle}</div>
                    )}
                    {alerta.accionRecomendada && (
                      <div className="text-sm text-blue-600 mt-1">
                        → {alerta.accionRecomendada}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Precios
  const renderPrecios = () => (
    <div className="space-y-6">
      {/* Resumen de precios */}
      {analytics && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <ThumbsUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">{analytics.productosMasCaros}</div>
            <div className="text-sm text-gray-600">Nosotros más baratos</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <span className="text-2xl">≈</span>
            <div className="text-2xl font-bold text-gray-600">{analytics.productosIgualPrecio}</div>
            <div className="text-sm text-gray-600">Precios similares</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <ThumbsDown className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-600">{analytics.productosMasBaratos}</div>
            <div className="text-sm text-gray-600">Ellos más baratos</div>
          </div>
        </div>
      )}

      {/* Tabla de precios */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Comparación de Precios ({analytics.analisisPreciosActual.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">SKU</th>
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-right py-2 px-2">Nuestro Precio</th>
                  <th className="text-right py-2 px-2">Su Precio</th>
                  <th className="text-right py-2 px-2">Diferencia</th>
                  <th className="text-center py-2 px-2">Ventaja</th>
                </tr>
              </thead>
              <tbody>
                {analytics.analisisPreciosActual.slice(0, 20).map((precio, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-mono text-xs">{precio.sku}</td>
                    <td className="py-2 px-2">{precio.nombreProducto}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(precio.nuestroPrecio)}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(precio.precioCompetidor)}</td>
                    <td className={`py-2 px-2 text-right font-medium ${
                      precio.diferenciaPorcentaje > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {precio.diferenciaPorcentaje > 0 ? '+' : ''}{formatPercent(precio.diferenciaPorcentaje)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getVentajaColor(precio.ventajaCompetitiva)}`}>
                        {precio.ventajaCompetitiva === 'nosotros' ? 'Nosotros' :
                         precio.ventajaCompetitiva === 'competidor' ? 'Ellos' : 'Igual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Productos clave */}
      {analytics && analytics.productosClave.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Productos Clave
          </h3>
          <div className="space-y-3">
            {analytics.productosClave.slice(0, 5).map((prod, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{prod.sku}</div>
                  <div className="text-sm text-gray-500">{prod.nombre}</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    prod.diferencia > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {prod.diferencia > 0 ? '+' : ''}{formatPercent(prod.diferencia)}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    prod.importanciaEstrategica === 'alta' ? 'bg-red-100 text-red-700' :
                    prod.importanciaEstrategica === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {prod.importanciaEstrategica}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Recomendación:</div>
                  <div className="text-sm text-blue-600">{prod.recomendacion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Historial
  const renderHistorial = () => (
    <div className="space-y-6">
      {/* Tendencias de precios */}
      {analytics && analytics.tendenciasPrecios.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencias de Precios</h3>
          <div className="space-y-4">
            {analytics.tendenciasPrecios.slice(0, 10).map((tend, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{tend.sku}</div>
                  <div className="text-sm text-gray-500">{tend.nombreProducto}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Rango</div>
                  <div className="text-sm">
                    {formatCurrency(tend.precioMinimo)} - {formatCurrency(tend.precioMaximo)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Actual</div>
                  <div className="font-medium">{formatCurrency(tend.precioActual)}</div>
                </div>
                <div className="text-center">
                  <div className={`flex items-center gap-1 ${
                    tend.tendencia === 'subiendo' ? 'text-red-600' :
                    tend.tendencia === 'bajando' ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                    {tend.tendencia === 'subiendo' ? <TrendingUp className="w-4 h-4" /> :
                     tend.tendencia === 'bajando' ? <TrendingDown className="w-4 h-4" /> :
                     <span>→</span>}
                    <span className="text-sm">{tend.tendencia}</span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    tend.volatilidad === 'alta' ? 'bg-red-100 text-red-700' :
                    tend.volatilidad === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    volatilidad {tend.volatilidad}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actividad reciente */}
      {analytics && analytics.actividadReciente.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {analytics.actividadReciente.map((act, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <Activity className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <div className="font-medium">{act.descripcion}</div>
                  <div className="text-sm text-gray-500">{act.tipo}</div>
                </div>
                <div className="text-sm text-gray-500">{formatDate(act.fecha)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Análisis
  const renderAnalisis = () => (
    <div className="space-y-6">
      {/* Fortalezas y debilidades */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nuestras fortalezas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5" />
              Nuestras Fortalezas ({analytics.fortalezas.length})
            </h3>
            <div className="space-y-3">
              {analytics.fortalezas.map((f, idx) => (
                <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      f.impacto === 'alto' ? 'bg-green-200 text-green-800' :
                      f.impacto === 'medio' ? 'bg-green-100 text-green-700' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {f.impacto}
                    </span>
                    <span className="font-medium text-gray-900">{f.titulo}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{f.descripcion}</div>
                </div>
              ))}
              {analytics.fortalezas.length === 0 && (
                <div className="text-gray-500 text-center py-4">No hay fortalezas detectadas</div>
              )}
            </div>
          </div>

          {/* Sus fortalezas (nuestras debilidades) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
              <ThumbsDown className="w-5 h-5" />
              Sus Fortalezas ({analytics.debilidades.length})
            </h3>
            <div className="space-y-3">
              {analytics.debilidades.map((d, idx) => (
                <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      d.impacto === 'alto' ? 'bg-red-200 text-red-800' :
                      d.impacto === 'medio' ? 'bg-red-100 text-red-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {d.impacto}
                    </span>
                    <span className="font-medium text-gray-900">{d.titulo}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{d.descripcion}</div>
                </div>
              ))}
              {analytics.debilidades.length === 0 && (
                <div className="text-gray-500 text-center py-4">No hay debilidades detectadas</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      {analytics && analytics.recomendaciones.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Recomendaciones Estratégicas
          </h3>
          <div className="space-y-4">
            {analytics.recomendaciones.map((rec, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    rec.prioridad === 'alta' ? 'bg-red-100 text-red-700' :
                    rec.prioridad === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {rec.prioridad}
                  </span>
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                    {rec.tipo}
                  </span>
                </div>
                <h4 className="font-medium text-gray-900">{rec.titulo}</h4>
                <p className="text-sm text-gray-600 mt-1">{rec.descripcion}</p>
                {rec.accionesConcretas.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700">Acciones:</div>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                      {rec.accionesConcretas.map((accion, i) => (
                        <li key={i}>{accion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score competitivo */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Competitivo</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{analytics.scoreCompetitivoNuestro}</div>
              <div className="text-sm text-gray-500">Nosotros</div>
            </div>
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-4 bg-green-200 rounded-l-full" style={{ width: `${analytics.scoreCompetitivoNuestro}%` }} />
              <div className="flex-1 h-4 bg-red-200 rounded-r-full" style={{ width: `${analytics.scoreCompetitivoSuyo}%` }} />
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{analytics.scoreCompetitivoSuyo}</div>
              <div className="text-sm text-gray-500">{competidor.nombre}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizar pestaña Comparativa
  const renderComparativa = () => (
    <div className="space-y-6">
      {/* Ranking */}
      {analytics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ranking de Competidores</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-red-600">#{analytics.rankingAmenaza}</div>
              <div className="text-sm text-gray-500">de {analytics.totalCompetidores}</div>
            </div>
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${analytics.percentilAmenaza}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Percentil {analytics.percentilAmenaza}% de amenaza
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparativa */}
      {analytics && analytics.comparativaCompetidores.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativa con Otros Competidores</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Competidor</th>
                  <th className="text-center py-2 px-2">Amenaza</th>
                  <th className="text-right py-2 px-2">Productos</th>
                  <th className="text-right py-2 px-2">Dif. Precio</th>
                  <th className="text-right py-2 px-2">Reputación</th>
                </tr>
              </thead>
              <tbody>
                {analytics.comparativaCompetidores.slice(0, 10).map((comp, idx) => (
                  <tr
                    key={idx}
                    className={`border-b ${comp.competidorId === competidor.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2 px-2 font-bold">{comp.ranking}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{comp.nombre}</div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getNivelAmenazaColor(comp.nivelAmenaza)}`}>
                        {comp.nivelAmenaza}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{comp.productosEnComun}</td>
                    <td className={`py-2 px-2 text-right ${
                      comp.precioPromedioVsNosotros > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {comp.precioPromedioVsNosotros > 0 ? '+' : ''}{formatPercent(comp.precioPromedioVsNosotros)}
                    </td>
                    <td className="py-2 px-2 text-right">{comp.reputacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'precios', label: 'Precios', icon: DollarSign },
    { id: 'historial', label: 'Historial', icon: Activity },
    { id: 'analisis', label: 'Análisis', icon: Target },
    { id: 'comparativa', label: 'Comparativa', icon: Users }
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getNivelAmenazaIcon(analytics?.nivelAmenaza)}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{competidor.nombre}</h2>
              <p className="text-sm text-gray-500">{competidor.codigo} - {competidor.plataforma}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {activeTab === 'resumen' && renderResumen()}
              {activeTab === 'precios' && renderPrecios()}
              {activeTab === 'historial' && renderHistorial()}
              {activeTab === 'analisis' && renderAnalisis()}
              {activeTab === 'comparativa' && renderComparativa()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
