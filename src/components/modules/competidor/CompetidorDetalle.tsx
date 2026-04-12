import React, { useState, useLayoutEffect } from 'react';
import {
  X,
  Shield,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  ExternalLink,
  Package,
  DollarSign,
  BarChart3,
  Zap,
  CheckCircle,
  XCircle,
  Store,
  MapPin,
  Award,
  Percent,
  ShoppingCart,
  LineChart,
  Activity,
  Lightbulb
} from 'lucide-react';
import { Button, Card, Badge } from '../../common';
import { registerModalOpen, unregisterModalOpen, getModalCount } from '../../common/Modal';
import type { Competidor, PlataformaCompetidor, ReputacionCompetidor } from '../../../types/entidadesMaestras.types';

interface CompetidorDetalleProps {
  competidor: Competidor;
  onClose: () => void;
  onEdit: () => void;
}

type TabActiva = 'resumen' | 'productos' | 'analytics' | 'inteligencia';

const reputacionLabels: Record<ReputacionCompetidor, string> = {
  'excelente': 'Excelente',
  'buena': 'Buena',
  'regular': 'Regular',
  'mala': 'Mala',
  'desconocida': 'Desconocida'
};

const plataformaLabels: Record<PlataformaCompetidor, string> = {
  'mercado_libre': 'Mercado Libre',
  'web_propia': 'Web Propia',
  'inkafarma': 'InkaFarma',
  'mifarma': 'MiFarma',
  'amazon': 'Amazon',
  'falabella': 'Falabella',
  'otra': 'Otra'
};

export const CompetidorDetalle: React.FC<CompetidorDetalleProps> = ({
  competidor,
  onClose,
  onEdit
}) => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');

  // Registrar modal abierto
  useLayoutEffect(() => {
    registerModalOpen();
    document.body.setAttribute('data-modal-open', 'true');
    return () => {
      unregisterModalOpen();
      if (getModalCount() === 0) {
        document.body.removeAttribute('data-modal-open');
      }
    };
  }, []);

  // Calcular nivel de amenaza basado en metricas
  const getNivelAmenazaColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'bg-red-100 text-red-700 border-red-300';
      case 'medio': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'bajo': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getReputacionBadge = (reputacion: ReputacionCompetidor) => {
    switch (reputacion) {
      case 'excelente': return { variant: 'success' as const, icon: Award };
      case 'buena': return { variant: 'info' as const, icon: CheckCircle };
      case 'regular': return { variant: 'warning' as const, icon: AlertTriangle };
      case 'mala': return { variant: 'danger' as const, icon: XCircle };
      default: return { variant: 'default' as const, icon: Eye };
    }
  };

  const reputacionBadge = getReputacionBadge(competidor.reputacion);
  const ReputacionIcon = reputacionBadge.icon;

  // Calcular market share estimado (simulado)
  const marketShareEstimado = competidor.ventasEstimadas
    ? Math.min((competidor.ventasEstimadas / 10000) * 100, 100).toFixed(1)
    : '0.0';

  // Calcular score de competitividad (0-100)
  const scoreCompetitividad = () => {
    let score = 0;

    // Reputacion (30 puntos)
    const reputacionScore = {
      'excelente': 30,
      'buena': 22,
      'regular': 15,
      'mala': 5,
      'desconocida': 10
    };
    score += reputacionScore[competidor.reputacion] || 10;

    // Cantidad de productos (20 puntos)
    if (competidor.cantidadProductos) {
      score += Math.min((competidor.cantidadProductos / 100) * 20, 20);
    }

    // Ventas estimadas (30 puntos)
    if (competidor.ventasEstimadas) {
      score += Math.min((competidor.ventasEstimadas / 1000) * 30, 30);
    }

    // Lider en categoria (20 puntos)
    if (competidor.esLiderCategoria) {
      score += 20;
    }

    return Math.round(score);
  };

  const competitividadScore = scoreCompetitividad();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-red-50">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center">
              <Target className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{competidor.nombre}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-slate-500">{competidor.codigo}</span>
                <Badge variant={competidor.estado === 'activo' ? 'success' : competidor.estado === 'inactivo' ? 'warning' : 'danger'}>
                  {competidor.estado}
                </Badge>
                <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getNivelAmenazaColor(competidor.nivelAmenaza)}`}>
                  Amenaza: {competidor.nivelAmenaza.toUpperCase()}
                </span>
                {competidor.esLiderCategoria && (
                  <Badge variant="warning" size="sm">
                    <Award className="h-3 w-3 inline mr-1" />
                    Lider
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Editar
            </Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setTabActiva('resumen')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'resumen'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Shield className="h-4 w-4 inline mr-2" />
              Resumen
            </button>
            <button
              onClick={() => setTabActiva('productos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'productos'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Package className="h-4 w-4 inline mr-2" />
              Productos
              {competidor.cantidadProductos && (
                <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                  {competidor.cantidadProductos}
                </span>
              )}
            </button>
            <button
              onClick={() => setTabActiva('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'analytics'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              Analytics
            </button>
            <button
              onClick={() => setTabActiva('inteligencia')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabActiva === 'inteligencia'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Lightbulb className="h-4 w-4 inline mr-2" />
              Inteligencia
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab: Resumen */}
          {tabActiva === 'resumen' && (
            <div className="space-y-6">
              {/* KPIs principales */}
              <div className="grid grid-cols-4 gap-4">
                <Card padding="md" className="bg-purple-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-purple-600 font-medium">Productos</div>
                      <div className="text-2xl font-bold text-purple-700">
                        {competidor.cantidadProductos || 0}
                      </div>
                    </div>
                    <Package className="h-8 w-8 text-purple-400" />
                  </div>
                </Card>

                <Card padding="md" className="bg-sky-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-sky-600 font-medium">Ventas/Mes (Est.)</div>
                      <div className="text-2xl font-bold text-sky-700">
                        {competidor.ventasEstimadas || 0}
                      </div>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-sky-400" />
                  </div>
                </Card>

                <Card padding="md" className="bg-emerald-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-emerald-600 font-medium">Precio Promedio</div>
                      <div className="text-2xl font-bold text-emerald-700">
                        S/ {competidor.metricas?.precioPromedio?.toFixed(0) || 0}
                      </div>
                    </div>
                    <DollarSign className="h-8 w-8 text-emerald-400" />
                  </div>
                </Card>

                <Card padding="md" className={`${getNivelAmenazaColor(competidor.nivelAmenaza).replace('text', 'bg').replace('-700', '-50')}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-xs font-medium ${getNivelAmenazaColor(competidor.nivelAmenaza).split(' ')[1]}`}>
                        Nivel Amenaza
                      </div>
                      <div className={`text-2xl font-bold ${getNivelAmenazaColor(competidor.nivelAmenaza).split(' ')[1]}`}>
                        {competidor.nivelAmenaza.toUpperCase()}
                      </div>
                    </div>
                    <AlertTriangle className={`h-8 w-8 ${getNivelAmenazaColor(competidor.nivelAmenaza).split(' ')[1].replace('-700', '-400')}`} />
                  </div>
                </Card>
              </div>

              {/* Score de competitividad */}
              <Card padding="md">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-red-500" />
                  Score de Competitividad
                </h4>
                <div className="relative">
                  <div className="h-6 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        competitividadScore >= 70 ? 'bg-red-500' :
                        competitividadScore >= 40 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${competitividadScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-slate-600">
                    <span>{competitividadScore}/100 puntos</span>
                    <span>
                      {competitividadScore >= 70 ? 'Competidor Fuerte' :
                       competitividadScore >= 40 ? 'Competidor Moderado' :
                       'Competidor Debil'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Informacion del negocio */}
              <div className="grid grid-cols-2 gap-6">
                <Card padding="md">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <Store className="h-5 w-5 mr-2 text-slate-400" />
                    Informacion de Tienda
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-slate-500 block mb-1">Plataforma Principal:</span>
                      <Badge variant="info">{plataformaLabels[competidor.plataformaPrincipal || 'otra']}</Badge>
                    </div>

                    {/* Nuevo sistema: plataformasData */}
                    {competidor.plataformasData && competidor.plataformasData.length > 0 && (
                      <div>
                        <span className="text-slate-500 block mb-1">Plataformas:</span>
                        <div className="flex flex-wrap gap-1">
                          {competidor.plataformasData.map((plat) => (
                            <Badge key={plat.id} variant={plat.esPrincipal ? 'info' : 'default'} size="sm">
                              {plat.nombre}{plat.esPrincipal ? ' ⭐' : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback: legacy plataformas */}
                    {(!competidor.plataformasData || competidor.plataformasData.length === 0) && competidor.plataformas && competidor.plataformas.length > 1 && (
                      <div>
                        <span className="text-slate-500 block mb-1">Otras Plataformas:</span>
                        <div className="flex flex-wrap gap-1">
                          {competidor.plataformas
                            .filter(p => p !== competidor.plataformaPrincipal)
                            .map((plat, idx) => (
                              <Badge key={idx} variant="default" size="sm">
                                {plat ? plataformaLabels[plat] || plat : 'otra'}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}

                    {competidor.urlTienda && (
                      <div>
                        <span className="text-slate-500 block mb-1">URL Tienda:</span>
                        <a
                          href={competidor.urlTienda}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:text-sky-800 text-xs break-all flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                          {competidor.urlTienda}
                        </a>
                      </div>
                    )}

                    {competidor.urlMercadoLibre && (
                      <div>
                        <span className="text-slate-500 block mb-1">Perfil MercadoLibre:</span>
                        <a
                          href={competidor.urlMercadoLibre}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:text-sky-800 text-xs break-all flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                          {competidor.urlMercadoLibre}
                        </a>
                      </div>
                    )}

                    {(competidor.ciudad || competidor.departamento) && (
                      <div className="pt-2 border-t">
                        <MapPin className="h-4 w-4 text-slate-400 inline mr-2" />
                        <span className="text-slate-900">
                          {competidor.ciudad && competidor.ciudad}
                          {competidor.ciudad && competidor.departamento && ', '}
                          {competidor.departamento && competidor.departamento}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                <Card padding="md">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <Award className="h-5 w-5 mr-2 text-slate-400" />
                    Reputacion y Estrategia
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-slate-500 block mb-1">Reputacion:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={reputacionBadge.variant}>
                          <ReputacionIcon className="h-3 w-3 inline mr-1" />
                          {reputacionLabels[competidor.reputacion]}
                        </Badge>
                      </div>
                    </div>

                    {competidor.estrategiaPrecio && (
                      <div>
                        <span className="text-slate-500 block mb-1">Estrategia de Precio:</span>
                        <Badge
                          variant={
                            competidor.estrategiaPrecio === 'premium' ? 'info' :
                            competidor.estrategiaPrecio === 'bajo' ? 'success' :
                            'default'
                          }
                        >
                          <Percent className="h-3 w-3 inline mr-1" />
                          {competidor.estrategiaPrecio.charAt(0).toUpperCase() + competidor.estrategiaPrecio.slice(1)}
                        </Badge>
                      </div>
                    )}

                    {competidor.esLiderCategoria && competidor.categoriasLider && competidor.categoriasLider.length > 0 && (
                      <div>
                        <span className="text-slate-500 block mb-1">Lider en:</span>
                        <div className="flex flex-wrap gap-1">
                          {competidor.categoriasLider.map((cat, idx) => (
                            <Badge key={idx} variant="warning" size="sm">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {competidor.metricas?.productosAnalizados > 0 && (
                      <div className="pt-2 border-t">
                        <Eye className="h-4 w-4 text-slate-400 inline mr-2" />
                        <span className="text-slate-600">
                          {competidor.metricas.productosAnalizados} productos analizados
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Fortalezas y Debilidades */}
              <div className="grid grid-cols-2 gap-6">
                {competidor.fortalezas && (
                  <Card padding="md" className="bg-emerald-50 border-emerald-200">
                    <h3 className="text-lg font-semibold text-emerald-900 mb-3 flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-emerald-600" />
                      Fortalezas
                    </h3>
                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">{competidor.fortalezas}</p>
                  </Card>
                )}

                {competidor.debilidades && (
                  <Card padding="md" className="bg-red-50 border-red-200">
                    <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center">
                      <XCircle className="h-5 w-5 mr-2 text-red-600" />
                      Debilidades
                    </h3>
                    <p className="text-sm text-red-800 whitespace-pre-wrap">{competidor.debilidades}</p>
                  </Card>
                )}
              </div>

              {/* Notas */}
              {competidor.notas && (
                <Card padding="md">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Notas Internas</h3>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{competidor.notas}</p>
                </Card>
              )}
            </div>
          )}

          {/* Tab: Productos */}
          {tabActiva === 'productos' && (
            <div className="space-y-6">
              <Card padding="md" className="bg-sky-50 border-sky-200">
                <div className="flex items-center space-x-3">
                  <Package className="h-6 w-6 text-sky-600" />
                  <div>
                    <div className="font-semibold text-sky-900">Productos Monitoreados</div>
                    <div className="text-sm text-sky-700">
                      {competidor.metricas?.productosAnalizados || 0} productos bajo seguimiento para comparacion de precios
                    </div>
                  </div>
                </div>
              </Card>

              {/* Estadisticas de productos */}
              <div className="grid grid-cols-3 gap-4">
                <Card padding="md">
                  <div className="text-center">
                    <Package className="h-8 w-8 text-sky-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-slate-900">
                      {competidor.cantidadProductos || 0}
                    </div>
                    <div className="text-xs text-slate-600">Total Productos</div>
                  </div>
                </Card>

                <Card padding="md">
                  <div className="text-center">
                    <DollarSign className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-slate-900">
                      S/ {competidor.metricas?.precioPromedio?.toFixed(0) || 0}
                    </div>
                    <div className="text-xs text-slate-600">Precio Promedio</div>
                  </div>
                </Card>

                <Card padding="md">
                  <div className="text-center">
                    <Eye className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-slate-900">
                      {competidor.metricas?.productosAnalizados || 0}
                    </div>
                    <div className="text-xs text-slate-600">Analizados</div>
                  </div>
                </Card>
              </div>

              {/* Comparacion de precios */}
              <Card padding="md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-slate-400" />
                  Comparacion de Precios
                </h3>
                <div className="text-center py-8">
                  <LineChart className="h-16 w-16 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    Los datos de productos monitoreados se mostraran aqui
                  </p>
                  <p className="text-slate-400 text-xs mt-2">
                    Implementar integracion con modulo de Productos para comparacion automatica
                  </p>
                </div>
              </Card>

              {/* Diferencial de precio */}
              <Card padding="md" className="bg-amber-50 border-amber-200">
                <h3 className="text-lg font-semibold text-amber-900 mb-3 flex items-center">
                  <Percent className="h-5 w-5 mr-2 text-amber-600" />
                  Diferencial de Precio
                </h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-800">
                    {competidor.estrategiaPrecio === 'bajo' ? '-15%' :
                     competidor.estrategiaPrecio === 'premium' ? '+25%' :
                     competidor.estrategiaPrecio === 'competitivo' ? '±5%' :
                     'Variable'}
                  </div>
                  <div className="text-sm text-amber-700 mt-2">
                    {competidor.estrategiaPrecio === 'bajo' ? 'Precios mas bajos que nosotros' :
                     competidor.estrategiaPrecio === 'premium' ? 'Precios mas altos que nosotros' :
                     competidor.estrategiaPrecio === 'competitivo' ? 'Precios similares a los nuestros' :
                     'Estrategia de precios variable'}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tab: Analytics */}
          {tabActiva === 'analytics' && (
            <div className="space-y-6">
              {/* Market Share */}
              <Card padding="md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-slate-400" />
                  Market Share Estimado
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-slate-600">Participacion de mercado</span>
                      <span className="font-bold text-slate-900">{marketShareEstimado}%</span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all"
                        style={{ width: `${marketShareEstimado}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Basado en ventas mensuales estimadas de {competidor.ventasEstimadas || 0} unidades
                  </p>
                </div>
              </Card>

              {/* Tendencia de precios */}
              <Card padding="md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-slate-400" />
                  Tendencia de Precios
                </h3>
                <div className="text-center py-8">
                  <LineChart className="h-16 w-16 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    Grafico de tendencia de precios en el tiempo
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
                    {competidor.estrategiaPrecio === 'bajo' ? (
                      <>
                        <TrendingDown className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">Tendencia a la baja</span>
                      </>
                    ) : competidor.estrategiaPrecio === 'premium' ? (
                      <>
                        <TrendingUp className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium text-red-700">Precios premium estables</span>
                      </>
                    ) : (
                      <>
                        <Activity className="h-5 w-5 text-sky-600" />
                        <span className="text-sm font-medium text-sky-700">Precios competitivos</span>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Comparacion de reputacion */}
              <div className="grid grid-cols-2 gap-6">
                <Card padding="md">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <Award className="h-5 w-5 mr-2 text-slate-400" />
                    Analisis de Reputacion
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Nivel actual:</span>
                      <Badge variant={reputacionBadge.variant}>
                        {reputacionLabels[competidor.reputacion]}
                      </Badge>
                    </div>
                    <div className="pt-3 border-t">
                      <p className="text-xs text-slate-500">
                        {competidor.reputacion === 'excelente' ? 'Competidor con excelente reputacion. Alta confianza del mercado.' :
                         competidor.reputacion === 'buena' ? 'Competidor con buena reputacion. Confianza del mercado solida.' :
                         competidor.reputacion === 'regular' ? 'Competidor con reputacion regular. Oportunidad de diferenciacion.' :
                         competidor.reputacion === 'mala' ? 'Competidor con mala reputacion. Ventaja competitiva para nosotros.' :
                         'Reputacion desconocida. Requiere mayor investigacion.'}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card padding="md">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-slate-400" />
                    Velocidad de Ventas
                  </h3>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-sky-600">
                      {competidor.ventasEstimadas ? `${competidor.ventasEstimadas}/mes` : 'N/D'}
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Ventas mensuales estimadas</p>
                    {competidor.ventasEstimadas && (
                      <p className="text-xs text-slate-400 mt-1">
                        ~{Math.round(competidor.ventasEstimadas / 30)} ventas/dia
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Analisis FODA rapido */}
              <Card padding="md" className="bg-sky-50 border-sky-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-sky-600" />
                  Analisis Competitivo
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-emerald-800 mb-2 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Sus Fortalezas
                    </h4>
                    <p className="text-sm text-slate-700">
                      {competidor.fortalezas || 'No especificadas'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-800 mb-2 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      Sus Debilidades
                    </h4>
                    <p className="text-sm text-slate-700">
                      {competidor.debilidades || 'No especificadas'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tab: Inteligencia */}
          {tabActiva === 'inteligencia' && (
            <div className="space-y-6">
              {/* Alertas */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                  Alertas Competitivas
                </h3>
                <div className="space-y-3">
                  {competidor.nivelAmenaza === 'alto' && (
                    <Card padding="md" className="bg-red-50 border-red-200">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div>
                          <div className="font-semibold text-red-900">Competidor de Alta Amenaza</div>
                          <div className="text-sm text-red-700 mt-1">
                            Este competidor representa una amenaza significativa. Monitoreo constante requerido.
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {competidor.esLiderCategoria && (
                    <Card padding="md" className="bg-amber-50 border-amber-200">
                      <div className="flex items-start space-x-3">
                        <Award className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <div className="font-semibold text-amber-900">Lider de Categoria</div>
                          <div className="text-sm text-amber-700 mt-1">
                            Es lider en: {competidor.categoriasLider?.join(', ') || 'categorias especificas'}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {competidor.estrategiaPrecio === 'bajo' && (
                    <Card padding="md" className="bg-sky-50 border-sky-200">
                      <div className="flex items-start space-x-3">
                        <TrendingDown className="h-5 w-5 text-sky-600 mt-0.5" />
                        <div>
                          <div className="font-semibold text-sky-900">Estrategia de Precios Bajos</div>
                          <div className="text-sm text-sky-700 mt-1">
                            Competidor con estrategia agresiva de precios. Monitorear cambios constantemente.
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {!competidor.esLiderCategoria && competidor.nivelAmenaza === 'bajo' && (
                    <Card padding="md" className="text-center py-6">
                      <CheckCircle className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No hay alertas criticas para este competidor</p>
                    </Card>
                  )}
                </div>
              </div>

              {/* Oportunidades identificadas */}
              <Card padding="md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
                  Oportunidades Identificadas
                </h3>
                <div className="space-y-3">
                  {competidor.debilidades && (
                    <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-emerald-900">Explotar sus debilidades</div>
                        <div className="text-sm text-emerald-700 mt-1">
                          Aprovechar: {competidor.debilidades}
                        </div>
                      </div>
                    </div>
                  )}

                  {competidor.reputacion === 'mala' || competidor.reputacion === 'regular' && (
                    <div className="flex items-start space-x-3 p-3 bg-sky-50 rounded-lg">
                      <Award className="h-5 w-5 text-sky-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sky-900">Diferenciacion por reputacion</div>
                        <div className="text-sm text-sky-700 mt-1">
                          Su reputacion {reputacionLabels[competidor.reputacion].toLowerCase()} es una oportunidad para destacar nuestro servicio.
                        </div>
                      </div>
                    </div>
                  )}

                  {competidor.estrategiaPrecio === 'premium' && (
                    <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                      <DollarSign className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-purple-900">Oportunidad de precio</div>
                        <div className="text-sm text-purple-700 mt-1">
                          Sus precios premium permiten posicionamiento competitivo con mejor valor.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Recomendaciones de accion */}
              <Card padding="md" className="bg-teal-50 border-teal-200">
                <h3 className="text-lg font-semibold text-teal-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-teal-600" />
                  Recomendaciones de Accion
                </h3>
                <div className="space-y-2">
                  {competidor.nivelAmenaza === 'alto' && (
                    <div className="flex items-start space-x-2 text-sm">
                      <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mt-1.5"></div>
                      <p className="text-teal-900">Realizar monitoreo semanal de precios y nuevos productos</p>
                    </div>
                  )}

                  <div className="flex items-start space-x-2 text-sm">
                    <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mt-1.5"></div>
                    <p className="text-teal-900">Analizar productos mas vendidos para identificar oportunidades</p>
                  </div>

                  {competidor.fortalezas && (
                    <div className="flex items-start space-x-2 text-sm">
                      <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mt-1.5"></div>
                      <p className="text-teal-900">Estudiar sus fortalezas para mejorar nuestro servicio</p>
                    </div>
                  )}

                  <div className="flex items-start space-x-2 text-sm">
                    <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mt-1.5"></div>
                    <p className="text-teal-900">Mantener actualizados los datos de reputacion y metricas</p>
                  </div>

                  {competidor.estrategiaPrecio && (
                    <div className="flex items-start space-x-2 text-sm">
                      <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mt-1.5"></div>
                      <p className="text-teal-900">
                        Ajustar estrategia comercial considerando su posicionamiento {competidor.estrategiaPrecio}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Actualizacion */}
              {competidor.metricas?.ultimaActualizacion && (
                <Card padding="md" className="bg-slate-50">
                  <div className="text-sm text-slate-600 text-center">
                    <Activity className="h-4 w-4 inline mr-2" />
                    Ultima actualizacion: {competidor.metricas.ultimaActualizacion.toDate().toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
