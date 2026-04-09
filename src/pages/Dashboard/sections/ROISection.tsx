import React from 'react';
import { Target, TrendingUp, CheckCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Badge } from '../../../components/common';
import { formatCurrencyPEN } from '../../../utils/format';

interface ROISectionProps {
  metricsROI: {
    productosConInvestigacion: number;
    roiPromedio: number;
    multiplicadorPromedio: number;
    topMejorROI: any[];
    oportunidadesInversion: any[];
    productosSinInvestigar: number;
  };
}

const fmt = (v: number) => formatCurrencyPEN(v);

export const ROISection: React.FC<ROISectionProps> = ({ metricsROI }) => {
  const { roiPromedio, multiplicadorPromedio, productosConInvestigacion, productosSinInvestigar, topMejorROI, oportunidadesInversion } = metricsROI;

  return (
    <div className="hidden sm:block space-y-4 lg:space-y-6">
      {/* Gradient cards ROI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* ROI Promedio */}
        <Link to="/productos">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 lg:p-5 border border-emerald-100 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-emerald-700 truncate">ROI Promedio</p>
                <p className={`text-2xl lg:text-4xl font-bold mt-1 leading-tight ${
                  roiPromedio > 50 ? 'text-emerald-700' :
                  roiPromedio > 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {roiPromedio.toFixed(0)}%
                </p>
                <p className="text-xs text-emerald-600 mt-2">{productosConInvestigacion} productos analizados</p>
              </div>
              <Target className="h-10 w-10 lg:h-12 lg:w-12 text-emerald-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>

        {/* Multiplicador Promedio */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 lg:p-5 border border-blue-100 h-full">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-blue-700 truncate">Multiplicador Promedio</p>
              <p className={`text-2xl lg:text-4xl font-bold mt-1 leading-tight ${
                multiplicadorPromedio >= 2 ? 'text-emerald-700' :
                multiplicadorPromedio >= 1.5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {multiplicadorPromedio.toFixed(2)}x
              </p>
              <p className="text-xs text-blue-600 mt-2">Por cada S/ 1 invertido</p>
            </div>
            <TrendingUp className="h-10 w-10 lg:h-12 lg:w-12 text-blue-300 flex-shrink-0 opacity-60" />
          </div>
        </div>

        {/* Oportunidades */}
        <Link to="/productos">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 lg:p-5 border border-green-100 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-green-700 truncate">Oportunidades</p>
                <p className="text-2xl lg:text-4xl font-bold text-green-700 mt-1 leading-tight">
                  {oportunidadesInversion.length}
                </p>
                <p className="text-xs text-green-600 mt-2">Productos recomendados importar</p>
              </div>
              <CheckCircle className="h-10 w-10 lg:h-12 lg:w-12 text-green-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>

        {/* Sin Investigar */}
        <Link to="/productos">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 lg:p-5 border border-orange-100 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-orange-700 truncate">Sin Investigar</p>
                <p className="text-2xl lg:text-4xl font-bold text-orange-700 mt-1 leading-tight">
                  {productosSinInvestigar}
                </p>
                <p className="text-xs text-orange-600 mt-2">Productos activos pendientes</p>
              </div>
              <Search className="h-10 w-10 lg:h-12 lg:w-12 text-orange-300 flex-shrink-0 opacity-60" />
            </div>
          </div>
        </Link>
      </div>

      {/* Listas: Top ROI + Oportunidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Top 5 Mejor ROI */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Top 5 Mejor ROI
            </h3>
            <Link to="/productos" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo
            </Link>
          </div>

          {topMejorROI.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay productos con investigacion de mercado</p>
              <Link to="/productos" className="text-xs text-primary-600 hover:underline mt-2 block">
                Realizar investigacion
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {topMejorROI.map((producto, index) => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {producto.marca} {producto.nombreComercial}
                      </div>
                      <div className="text-xs text-gray-500">
                        {producto.sku} · Ganancia: {fmt(producto.gananciaCalculada)}/ud
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <div className={`text-base font-bold ${
                      producto.roiCalculado > 100 ? 'text-emerald-600' :
                      producto.roiCalculado > 50 ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {producto.roiCalculado.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">{producto.multiplicadorCalculado.toFixed(2)}x</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Oportunidades de Inversión */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Oportunidades de Inversion
            </h3>
            <Link to="/productos" className="text-sm text-primary-600 hover:text-primary-700">
              Ver todo
            </Link>
          </div>

          {oportunidadesInversion.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay productos recomendados para importar</p>
              <p className="text-xs text-gray-400 mt-1">Investiga productos y marca "Importar"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {oportunidadesInversion.slice(0, 5).map(producto => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {producto.marca} {producto.nombreComercial}
                    </div>
                    <div className="text-xs text-gray-500">
                      {producto.sku} · CTRU: {fmt(producto.investigacion?.ctruEstimado || 0)}
                    </div>
                    {producto.investigacion?.demandaEstimada && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Demanda: <span className={`font-medium ${
                          producto.investigacion.demandaEstimada === 'alta' ? 'text-green-600' :
                          producto.investigacion.demandaEstimada === 'media' ? 'text-yellow-600' : 'text-red-600'
                        }`}>{producto.investigacion.demandaEstimada}</span>
                        {producto.investigacion?.presenciaML && ` · ${producto.investigacion.numeroCompetidores || '?'} comp. ML`}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <Badge variant="success">ROI {producto.roiCalculado.toFixed(0)}%</Badge>
                    <div className="text-xs text-gray-500 mt-1">+{fmt(producto.gananciaCalculada)}/ud</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
