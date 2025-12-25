import React, { useMemo } from 'react';
import {
  Pencil,
  Trash2,
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  ShoppingCart,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Button, Badge } from '../../common';
import { ProductoService } from '../../../services/producto.service';
import type { Producto } from '../../../types/producto.types';

interface ProductoCardProps {
  producto: Producto;
  onEdit: () => void;
  onDelete: () => void;
  onInvestigar?: () => void;
}

export const ProductoCard: React.FC<ProductoCardProps> = ({ producto, onEdit, onDelete, onInvestigar }) => {
  const stockCritico = producto.stockPeru <= producto.stockMinimo;

  // Resumen de investigación
  const invResumen = useMemo(() => ProductoService.getResumenInvestigacion(producto), [producto]);
  const inv = producto.investigacion;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {producto.marca}
          </h2>
          <p className="text-xl text-gray-700 mt-1">{producto.nombreComercial}</p>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <span>{producto.presentacion}</span>
            {producto.dosaje && <span>• {producto.dosaje}</span>}
            {producto.contenido && <span>• {producto.contenido}</span>}
          </div>
          <div className="flex items-center space-x-2 mt-3">
            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{producto.sku}</span>
            <Badge variant={producto.estado === 'activo' ? 'success' : producto.estado === 'inactivo' ? 'default' : 'danger'}>
              {producto.estado === 'activo' ? 'Activo' : producto.estado === 'inactivo' ? 'Inactivo' : 'Descontinuado'}
            </Badge>
            {producto.habilitadoML && (
              <Badge variant="info">Mercado Libre</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onInvestigar && (
            <Button variant="outline" size="sm" onClick={onInvestigar}>
              <Search className="h-4 w-4 mr-1" />
              Investigar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Grid de Información */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clasificación */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Clasificación</h3>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-gray-500">Grupo</span>
              <p className="font-medium text-gray-900">{producto.grupo}</p>
            </div>
            {producto.subgrupo && (
              <div>
                <span className="text-xs text-gray-500">Subgrupo</span>
                <p className="font-medium text-gray-900">{producto.subgrupo}</p>
              </div>
            )}
            {producto.codigoUPC && (
              <div>
                <span className="text-xs text-gray-500">Código UPC</span>
                <p className="font-mono text-sm text-gray-900">{producto.codigoUPC}</p>
              </div>
            )}
          </div>
        </div>

        {/* Datos Comerciales */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
            Datos Comerciales
          </h3>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-gray-500">CTRU Promedio</span>
              <p className="text-lg font-bold text-gray-900">S/ {(producto.ctruPromedio || 0).toFixed(2)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Precio Sugerido</span>
              <p className="text-lg font-bold text-primary-600">S/ {(producto.precioSugerido || 0).toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-gray-500">Margen Mínimo</span>
                <p className="font-semibold text-gray-900">{producto.margenMinimo}%</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Margen Objetivo</span>
                <p className="font-semibold text-success-600">{producto.margenObjetivo}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Inventario */}
        <div className={`p-4 rounded-lg ${stockCritico ? 'bg-red-50' : 'bg-green-50'}`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <Package className="h-4 w-4 mr-1" />
            Inventario
            {stockCritico && <AlertTriangle className="h-4 w-4 ml-2 text-red-500" />}
          </h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-xs text-gray-500">Perú</span>
                <p className={`text-xl font-bold ${stockCritico ? 'text-red-600' : 'text-gray-900'}`}>
                  {producto.stockPeru}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">USA</span>
                <p className="text-xl font-bold text-gray-900">{producto.stockUSA}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Tránsito</span>
                <p className="text-xl font-bold text-blue-600">{producto.stockTransito}</p>
              </div>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-gray-500">Stock Mínimo</span>
                  <p className="font-medium text-gray-900">{producto.stockMinimo}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Stock Máximo</span>
                  <p className="font-medium text-gray-900">{producto.stockMaximo}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-gray-500">Disponible para venta</span>
                <p className="font-medium text-gray-900">{producto.stockDisponible}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            Métricas
          </h3>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-gray-500">Rotación Promedio (mes)</span>
              <p className="text-lg font-bold text-gray-900">{producto.rotacionPromedio || 0}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Días para Quiebre</span>
              <p className="text-lg font-bold text-gray-900">{producto.diasParaQuiebre || 0}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Stock Reservado</span>
              <p className="font-medium text-orange-600">{producto.stockReservado}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Investigación de Mercado */}
      {invResumen.tieneInvestigacion && inv && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center">
              <Search className="h-4 w-4 mr-2" />
              Investigación de Mercado
            </h3>
            <div className="flex items-center gap-2">
              {invResumen.estaVigente ? (
                <Badge variant="success">
                  <Clock className="h-3 w-3 mr-1" />
                  Vigente ({invResumen.diasRestantes} días)
                </Badge>
              ) : (
                <Badge variant="danger">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Vencida
                </Badge>
              )}
              <Badge variant={
                inv.recomendacion === 'importar' ? 'success' :
                inv.recomendacion === 'descartar' ? 'danger' : 'warning'
              }>
                {inv.recomendacion === 'importar' && <CheckCircle className="h-3 w-3 mr-1" />}
                {inv.recomendacion === 'descartar' && <XCircle className="h-3 w-3 mr-1" />}
                {inv.recomendacion === 'investigar_mas' && <RefreshCw className="h-3 w-3 mr-1" />}
                {inv.recomendacion === 'importar' ? 'Importar' :
                 inv.recomendacion === 'descartar' ? 'Descartar' : 'Investigar más'}
              </Badge>
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Precio USA</p>
                <p className="text-lg font-bold text-blue-600">${inv.precioUSAPromedio.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{inv.fuenteUSA || 'Sin fuente'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Precio Perú</p>
                <p className="text-lg font-bold text-green-600">S/ {(inv.precioEntrada || inv.precioPERUPromedio).toFixed(2)}</p>
                <p className="text-xs text-gray-400">{inv.precioEntrada ? 'Precio entrada (-5%)' : (inv.fuentePeru || 'Sin fuente')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CTRU Estimado</p>
                <p className="text-lg font-bold text-gray-900">S/ {inv.ctruEstimado.toFixed(2)}</p>
                <p className="text-xs text-gray-400">Tu inversión</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Margen Estimado</p>
                <p className={`text-lg font-bold ${inv.margenEstimado >= (producto.margenMinimo || 15) ? 'text-green-600' : 'text-red-600'}`}>
                  {inv.margenEstimado.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Métricas de Inversión (ROI) */}
            {inv.ctruEstimado > 0 && (inv.precioEntrada || inv.precioPERUPromedio) > 0 && (() => {
              const precioVenta = inv.precioEntrada || inv.precioPERUPromedio;
              const gananciaUnidad = precioVenta - inv.ctruEstimado;
              const roi = (gananciaUnidad / inv.ctruEstimado) * 100;
              const multiplicador = precioVenta / inv.ctruEstimado;

              return (
                <div className="mt-3 pt-3 border-t border-indigo-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Rendimiento de Inversión
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white bg-opacity-60 p-2 rounded text-center">
                      <p className="text-xs text-gray-500">Ganancia/Unidad</p>
                      <p className={`text-base font-bold ${gananciaUnidad > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        S/ {gananciaUnidad.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-60 p-2 rounded text-center">
                      <p className="text-xs text-gray-500">ROI</p>
                      <p className={`text-base font-bold ${roi > 50 ? 'text-green-600' : roi > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {roi.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-60 p-2 rounded text-center">
                      <p className="text-xs text-gray-500">Multiplicador</p>
                      <p className={`text-base font-bold ${multiplicador >= 2 ? 'text-green-600' : multiplicador >= 1.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {multiplicador.toFixed(2)}x
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-3 pt-3 border-t border-indigo-100 grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Demanda:</span>
                <Badge variant={
                  inv.demandaEstimada === 'alta' ? 'success' :
                  inv.demandaEstimada === 'baja' ? 'danger' : 'warning'
                }>
                  {inv.demandaEstimada}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Tendencia:</span>
                <span className="flex items-center text-sm">
                  {inv.tendencia === 'subiendo' && <TrendingUp className="h-4 w-4 text-green-500 mr-1" />}
                  {inv.tendencia === 'bajando' && <TrendingDown className="h-4 w-4 text-red-500 mr-1" />}
                  {inv.tendencia === 'estable' && <Minus className="h-4 w-4 text-gray-500 mr-1" />}
                  {inv.tendencia}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Competencia ML:</span>
                <span className="text-sm">
                  {inv.presenciaML ? `${inv.numeroCompetidores || '?'} vendedores` : 'Sin competencia'}
                </span>
              </div>
            </div>

            {inv.razonamiento && (
              <div className="mt-3 pt-3 border-t border-indigo-100">
                <p className="text-xs text-gray-500">Razonamiento:</p>
                <p className="text-sm text-gray-700">{inv.razonamiento}</p>
              </div>
            )}

            <div className="mt-3 text-xs text-gray-400 text-right">
              Investigado: {inv.fechaInvestigacion?.toDate?.().toLocaleDateString('es-PE')} por {inv.realizadoPor}
            </div>
          </div>
        </div>
      )}

      {/* Sin investigación */}
      {!invResumen.tieneInvestigacion && onInvestigar && (
        <div className="border-t pt-4">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-3">Este producto no tiene investigación de mercado</p>
            <Button variant="outline" size="sm" onClick={onInvestigar}>
              <Search className="h-4 w-4 mr-1" />
              Realizar investigación
            </Button>
          </div>
        </div>
      )}

      {/* Enlaces y Mercado Libre */}
      {(producto.enlaceProveedor || producto.habilitadoML) && (
        <div className="border-t pt-4 space-y-3">
          {producto.enlaceProveedor && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Enlace Proveedor</span>
              <a
                href={producto.enlaceProveedor}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver en sitio del proveedor
              </a>
            </div>
          )}
          {producto.habilitadoML && (
            <div className="bg-yellow-50 p-3 rounded">
              <div className="flex items-center text-sm font-medium text-gray-900 mb-1">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Habilitado para Mercado Libre
              </div>
              {producto.restriccionML && (
                <p className="text-xs text-gray-600 mt-1">
                  <strong>Nota:</strong> {producto.restriccionML}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t pt-4 flex justify-between text-sm text-gray-600">
        <div>
          <span className="text-xs text-gray-500">Creado por:</span> {producto.creadoPor}
        </div>
        <div>
          <span className="text-xs text-gray-500">Fecha:</span>{' '}
          {producto.fechaCreacion?.toDate?.().toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) || '-'}
        </div>
      </div>
    </div>
  );
};