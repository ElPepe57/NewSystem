import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  BarChart3,
  Zap,
  History,
  Bell,
  Calculator
} from 'lucide-react';
import { Button, Badge } from '../../common';
import { ProveedorUSAList } from './ProveedorUSAList';
import { CompetidorPeruList } from './CompetidorPeruList';
import { HistorialPreciosChart } from './HistorialPreciosChart';
import { AlertasInvestigacion } from './AlertasInvestigacion';
import { PuntoEquilibrioCard } from './PuntoEquilibrioCard';
import { ProductoService } from '../../../services/producto.service';
import type {
  Producto,
  InvestigacionFormData,
  ProveedorUSAFormData,
  CompetidorPeruFormData
} from '../../../types/producto.types';

interface InvestigacionModalProps {
  producto: Producto;
  tipoCambio: number;
  onSave: (data: InvestigacionFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export const InvestigacionModal: React.FC<InvestigacionModalProps> = ({
  producto,
  tipoCambio,
  onSave,
  onDelete,
  onClose,
  loading = false
}) => {
  const existeInvestigacion = !!producto.investigacion;
  const inv = producto.investigacion;

  // Convertir datos existentes al nuevo formato
  const getProveedoresIniciales = (): ProveedorUSAFormData[] => {
    if (inv?.proveedoresUSA && inv.proveedoresUSA.length > 0) {
      return inv.proveedoresUSA.map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        impuesto: p.impuesto,  // Sales tax del estado USA
        url: p.url,
        disponibilidad: p.disponibilidad,
        envioEstimado: p.envioEstimado,
        notas: p.notas
      }));
    }
    // Migrar datos legacy si existen
    if (inv?.fuenteUSA && inv?.precioUSAPromedio) {
      return [{
        id: 'legacy-1',
        nombre: inv.fuenteUSA,
        precio: inv.precioUSAPromedio,
        disponibilidad: 'desconocido'
      }];
    }
    return [];
  };

  const getCompetidoresIniciales = (): CompetidorPeruFormData[] => {
    if (inv?.competidoresPeru && inv.competidoresPeru.length > 0) {
      return inv.competidoresPeru.map(c => ({
        id: c.id,
        nombre: c.nombre,
        plataforma: c.plataforma,
        precio: c.precio,
        url: c.url,
        ventas: c.ventas,
        reputacion: c.reputacion,
        esLiderCategoria: c.esLiderCategoria,
        notas: c.notas
      }));
    }
    // Migrar datos legacy si existen
    if (inv?.vendedorPrincipal && inv?.precioPERUPromedio) {
      return [{
        id: 'legacy-1',
        nombre: inv.vendedorPrincipal,
        plataforma: 'mercado_libre',
        precio: inv.precioPERUPromedio,
        reputacion: 'desconocida'
      }];
    }
    return [];
  };

  // Form state
  const [proveedoresUSA, setProveedoresUSA] = useState<ProveedorUSAFormData[]>(getProveedoresIniciales);
  const [competidoresPeru, setCompetidoresPeru] = useState<CompetidorPeruFormData[]>(getCompetidoresIniciales);

  // Sugerencias dinámicas de la base de datos
  const [sugerenciasProveedores, setSugerenciasProveedores] = useState<string[]>([]);
  const [sugerenciasCompetidores, setSugerenciasCompetidores] = useState<string[]>([]);

  // Cargar sugerencias al montar el componente
  useEffect(() => {
    const cargarSugerencias = async () => {
      try {
        const valores = await ProductoService.getUniqueInvestigacionValues();
        setSugerenciasProveedores(valores.proveedoresUSA);
        setSugerenciasCompetidores(valores.competidoresPeru);
      } catch (error) {
        console.error('Error al cargar sugerencias:', error);
      }
    };
    cargarSugerencias();
  }, []);

  const [formData, setFormData] = useState({
    presenciaML: inv?.presenciaML ?? false,
    nivelCompetencia: inv?.nivelCompetencia || 'media' as const,
    ventajasCompetitivas: inv?.ventajasCompetitivas || '',
    logisticaEstimada: inv?.logisticaEstimada || producto.costoFleteUSAPeru || 5,
    demandaEstimada: inv?.demandaEstimada || 'media' as const,
    tendencia: inv?.tendencia || 'estable' as const,
    volumenMercadoEstimado: inv?.volumenMercadoEstimado || 0,
    recomendacion: inv?.recomendacion || 'investigar_mas' as const,
    razonamiento: inv?.razonamiento || '',
    notas: inv?.notas || ''
  });

  // Calcular precios desde proveedores (incluyendo impuesto)
  const preciosUSA = useMemo(() => {
    // Calcular precio con impuesto para cada proveedor
    const proveedoresConTotal = proveedoresUSA.map(p => {
      const impuestoDecimal = (p.impuesto || 0) / 100;
      const precioConImpuesto = p.precio * (1 + impuestoDecimal);
      return { ...p, precioConImpuesto };
    });

    const precios = proveedoresConTotal.map(p => p.precioConImpuesto).filter(p => p > 0);
    if (precios.length === 0) return {
      min: 0,
      max: 0,
      promedio: 0,
      mejor: null as (ProveedorUSAFormData & { precioConImpuesto: number }) | null,
      impuestoPromedio: 0
    };

    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    const mejor = proveedoresConTotal.find(p => p.precioConImpuesto === min && p.precioConImpuesto > 0) || null;

    // Calcular impuesto promedio
    const impuestos = proveedoresUSA.map(p => p.impuesto || 0);
    const impuestoPromedio = impuestos.length > 0 ? impuestos.reduce((a, b) => a + b, 0) / impuestos.length : 0;

    return { min, max, promedio, mejor, impuestoPromedio };
  }, [proveedoresUSA]);

  // Calcular precios desde competidores
  const preciosPeru = useMemo(() => {
    const precios = competidoresPeru.map(c => c.precio).filter(p => p > 0);
    if (precios.length === 0) return { min: 0, max: 0, promedio: 0, lider: null as CompetidorPeruFormData | null };

    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

    // El líder es el que tiene más ventas o el que está marcado como líder
    const lider = competidoresPeru.find(c => c.esLiderCategoria) ||
                  competidoresPeru.sort((a, b) => (b.ventas || 0) - (a.ventas || 0))[0] || null;

    return { min, max, promedio, lider };
  }, [competidoresPeru]);

  // Detectar automáticamente presencia ML
  const hayCompetenciaML = useMemo(() => {
    return competidoresPeru.some(c => c.plataforma === 'mercado_libre');
  }, [competidoresPeru]);

  // Cálculos automáticos
  const calculos = useMemo(() => {
    // Usar precio con impuesto incluido
    const mejorPrecioUSAConImpuesto = preciosUSA.mejor?.precioConImpuesto || preciosUSA.promedio;
    const mejorPrecioUSASinImpuesto = preciosUSA.mejor?.precio || (preciosUSA.promedio / (1 + (preciosUSA.impuestoPromedio / 100)));
    const impuestoMejorProveedor = preciosUSA.mejor?.impuesto || preciosUSA.impuestoPromedio;

    const costoTotalUSD = mejorPrecioUSAConImpuesto + (formData.logisticaEstimada || 0);
    const ctruEstimado = costoTotalUSD * tipoCambio;

    // Calcular el monto del impuesto en USD
    const montoImpuestoUSA = mejorPrecioUSASinImpuesto * (impuestoMejorProveedor / 100);

    // Precio sugerido con margen objetivo
    const margenObjetivo = producto.margenObjetivo || 30;
    const precioSugeridoCalculado = ctruEstimado > 0
      ? ctruEstimado / (1 - margenObjetivo / 100)
      : 0;

    // Margen basado en precio Perú promedio
    const margenEstimado = preciosPeru.promedio > 0 && ctruEstimado > 0
      ? ((preciosPeru.promedio - ctruEstimado) / preciosPeru.promedio) * 100
      : 0;

    // Precio de entrada (competitivo)
    const precioEntrada = preciosPeru.min > 0 ? preciosPeru.min * 0.95 : precioSugeridoCalculado;

    // Determinar si es rentable
    const esRentable = margenEstimado >= (producto.margenMinimo || 15);

    // Métricas de inversión
    const gananciaUnidad = preciosPeru.promedio > 0 && ctruEstimado > 0
      ? preciosPeru.promedio - ctruEstimado
      : 0;

    const roi = ctruEstimado > 0 && gananciaUnidad > 0
      ? (gananciaUnidad / ctruEstimado) * 100
      : 0;

    const multiplicador = ctruEstimado > 0 && preciosPeru.promedio > 0
      ? preciosPeru.promedio / ctruEstimado
      : 0;

    // Puntuación de viabilidad (0-100)
    let puntuacion = 0;
    if (margenEstimado >= 30) puntuacion += 30;
    else if (margenEstimado >= 20) puntuacion += 20;
    else if (margenEstimado >= 15) puntuacion += 10;

    if (formData.demandaEstimada === 'alta') puntuacion += 25;
    else if (formData.demandaEstimada === 'media') puntuacion += 15;
    else puntuacion += 5;

    if (formData.tendencia === 'subiendo') puntuacion += 20;
    else if (formData.tendencia === 'estable') puntuacion += 10;

    if (formData.nivelCompetencia === 'baja') puntuacion += 25;
    else if (formData.nivelCompetencia === 'media') puntuacion += 15;
    else if (formData.nivelCompetencia === 'alta') puntuacion += 5;

    return {
      mejorPrecioUSASinImpuesto,
      mejorPrecioUSAConImpuesto,
      impuestoMejorProveedor,
      montoImpuestoUSA,
      costoTotalUSD,
      ctruEstimado,
      precioSugeridoCalculado,
      precioEntrada,
      margenEstimado,
      esRentable,
      gananciaUnidad,
      roi,
      multiplicador,
      puntuacion: Math.min(100, puntuacion)
    };
  }, [preciosUSA, preciosPeru, formData, tipoCambio, producto]);

  // Información de vigencia existente
  const vigenciaInfo = useMemo(() => {
    if (!inv) return null;
    const ahora = new Date();
    const vigenciaHasta = inv.vigenciaHasta?.toDate?.() || new Date();
    const diasRestantes = Math.ceil((vigenciaHasta.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
    const estaVigente = diasRestantes > 0;
    return { diasRestantes, estaVigente, vigenciaHasta };
  }, [inv]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSave: InvestigacionFormData = {
      proveedoresUSA,
      competidoresPeru,
      precioUSAMin: preciosUSA.min,
      precioUSAMax: preciosUSA.max,
      precioUSAPromedio: preciosUSA.promedio,
      precioPERUMin: preciosPeru.min,
      precioPERUMax: preciosPeru.max,
      precioPERUPromedio: preciosPeru.promedio,
      presenciaML: hayCompetenciaML || formData.presenciaML,
      nivelCompetencia: formData.nivelCompetencia,
      ventajasCompetitivas: formData.ventajasCompetitivas,
      logisticaEstimada: formData.logisticaEstimada,
      demandaEstimada: formData.demandaEstimada,
      tendencia: formData.tendencia,
      volumenMercadoEstimado: formData.volumenMercadoEstimado,
      recomendacion: formData.recomendacion,
      razonamiento: formData.razonamiento,
      notas: formData.notas
    };

    await onSave(dataToSave);
  };

  const getPuntuacionColor = (puntuacion: number) => {
    if (puntuacion >= 70) return 'text-green-600';
    if (puntuacion >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPuntuacionLabel = (puntuacion: number) => {
    if (puntuacion >= 80) return 'Excelente oportunidad';
    if (puntuacion >= 60) return 'Buena oportunidad';
    if (puntuacion >= 40) return 'Oportunidad moderada';
    return 'Oportunidad baja';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header con info del producto */}
      <div className="bg-gray-50 -mx-6 -mt-6 px-6 py-4 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              {producto.marca} - {producto.nombreComercial}
            </h3>
            <p className="text-sm text-gray-600">
              {producto.sku} | {producto.grupo}
              {producto.subgrupo && ` > ${producto.subgrupo}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">TC Actual</p>
            <p className="font-bold text-primary-600">S/ {tipoCambio.toFixed(2)}</p>
          </div>
        </div>

        {existeInvestigacion && vigenciaInfo && (
          <div className="mt-3 flex items-center gap-2">
            {vigenciaInfo.estaVigente ? (
              <Badge variant="success">
                <Clock className="h-3 w-3 mr-1" />
                Vigente ({vigenciaInfo.diasRestantes} días)
              </Badge>
            ) : (
              <Badge variant="danger">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Vencida
              </Badge>
            )}
            <span className="text-xs text-gray-500">
              Última investigación: {inv?.fechaInvestigacion?.toDate?.().toLocaleDateString('es-PE')}
            </span>
          </div>
        )}
      </div>

      {/* Sección de Proveedores USA */}
      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
        <ProveedorUSAList
          proveedores={proveedoresUSA}
          onChange={setProveedoresUSA}
          disabled={loading}
          sugerenciasProveedores={sugerenciasProveedores}
        />
      </div>

      {/* Sección de Competidores Perú */}
      <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
        <CompetidorPeruList
          competidores={competidoresPeru}
          onChange={setCompetidoresPeru}
          disabled={loading}
          sugerenciasCompetidores={sugerenciasCompetidores}
        />
      </div>

      {/* Grid de Análisis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logística */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <DollarSign className="h-4 w-4 mr-2 text-gray-600" />
            Logística Estimada
          </h4>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Costo flete USD/unidad</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.logisticaEstimada || ''}
                onChange={(e) => handleChange('logisticaEstimada', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="5.00"
                disabled={loading}
              />
            </div>
            {producto.costoFleteUSAPeru > 0 && (
              <div className="text-xs text-gray-500 mt-4">
                Producto: ${producto.costoFleteUSAPeru}
              </div>
            )}
          </div>
        </div>

        {/* Nivel de Competencia */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <Users className="h-4 w-4 mr-2 text-purple-600" />
            Análisis de Competencia
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nivel de competencia</label>
              <select
                value={formData.nivelCompetencia}
                onChange={(e) => handleChange('nivelCompetencia', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                disabled={loading}
              >
                <option value="baja">Baja (pocos competidores)</option>
                <option value="media">Media (competencia normal)</option>
                <option value="alta">Alta (muchos competidores)</option>
                <option value="saturada">Saturada (muy difícil entrar)</option>
              </select>
            </div>
            {hayCompetenciaML && (
              <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                Hay {competidoresPeru.filter(c => c.plataforma === 'mercado_libre').length} competidores en ML
              </div>
            )}
          </div>
        </div>

        {/* Demanda y Tendencia */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
            Demanda y Tendencia
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Demanda estimada</label>
              <select
                value={formData.demandaEstimada}
                onChange={(e) => handleChange('demandaEstimada', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                disabled={loading}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tendencia</label>
              <select
                value={formData.tendencia}
                onChange={(e) => handleChange('tendencia', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                disabled={loading}
              >
                <option value="subiendo">Subiendo</option>
                <option value="estable">Estable</option>
                <option value="bajando">Bajando</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">Volumen de mercado (unid/mes)</label>
            <input
              type="number"
              min="0"
              value={formData.volumenMercadoEstimado || ''}
              onChange={(e) => handleChange('volumenMercadoEstimado', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="ej: 100"
              disabled={loading}
            />
          </div>
        </div>

        {/* Ventajas Competitivas */}
        <div className="bg-indigo-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <Zap className="h-4 w-4 mr-2 text-indigo-600" />
            Ventajas Competitivas
          </h4>
          <textarea
            value={formData.ventajasCompetitivas || ''}
            onChange={(e) => handleChange('ventajasCompetitivas', e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            rows={3}
            placeholder="¿Qué ventajas tendríamos? (precio, calidad, servicio, etc.)"
            disabled={loading}
          />
        </div>
      </div>

      {/* Recomendación */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
          <Target className="h-4 w-4 mr-2" />
          Recomendación
        </h4>

        <div className="space-y-3">
          <div className="flex gap-2">
            {(['importar', 'investigar_mas', 'descartar'] as const).map((rec) => (
              <button
                key={rec}
                type="button"
                onClick={() => handleChange('recomendacion', rec)}
                disabled={loading}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  formData.recomendacion === rec
                    ? rec === 'importar'
                      ? 'bg-green-600 text-white'
                      : rec === 'descartar'
                      ? 'bg-red-600 text-white'
                      : 'bg-yellow-500 text-white'
                    : 'bg-white border hover:bg-gray-50'
                }`}
              >
                {rec === 'importar' && <CheckCircle className="h-4 w-4 inline mr-1" />}
                {rec === 'investigar_mas' && <RefreshCw className="h-4 w-4 inline mr-1" />}
                {rec === 'descartar' && <XCircle className="h-4 w-4 inline mr-1" />}
                {rec === 'importar' ? 'Importar' : rec === 'investigar_mas' ? 'Investigar más' : 'Descartar'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Razonamiento</label>
            <textarea
              value={formData.razonamiento || ''}
              onChange={(e) => handleChange('razonamiento', e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              rows={2}
              placeholder="¿Por qué esta recomendación?"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Notas adicionales */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Notas adicionales</label>
        <textarea
          value={formData.notas || ''}
          onChange={(e) => handleChange('notas', e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          rows={2}
          placeholder="Observaciones generales..."
          disabled={loading}
        />
      </div>

      {/* Panel de Análisis Automático */}
      {(proveedoresUSA.length > 0 || competidoresPeru.length > 0) && (
        <div className={`p-4 rounded-lg ${calculos.esRentable ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Análisis Automático
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Puntuación:</span>
              <span className={`text-2xl font-bold ${getPuntuacionColor(calculos.puntuacion)}`}>
                {calculos.puntuacion}
              </span>
              <span className="text-xs text-gray-500">/100</span>
            </div>
          </div>

          <p className={`text-sm mb-4 ${getPuntuacionColor(calculos.puntuacion)}`}>
            {getPuntuacionLabel(calculos.puntuacion)}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white bg-opacity-60 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Mejor Precio USA</p>
              <p className="text-lg font-bold">${calculos.mejorPrecioUSAConImpuesto.toFixed(2)}</p>
              {preciosUSA.mejor && (
                <p className="text-xs text-gray-500">{preciosUSA.mejor.nombre}</p>
              )}
              {calculos.impuestoMejorProveedor > 0 && (
                <p className="text-xs text-amber-600">
                  (${calculos.mejorPrecioUSASinImpuesto.toFixed(2)} + {calculos.impuestoMejorProveedor}% tax)
                </p>
              )}
            </div>
            <div className="bg-white bg-opacity-60 p-3 rounded-lg">
              <p className="text-xs text-gray-600">CTRU Estimado</p>
              <p className="text-lg font-bold">S/ {calculos.ctruEstimado.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Tu inversión</p>
            </div>
            <div className="bg-white bg-opacity-60 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Precio Sugerido</p>
              <p className="text-lg font-bold text-primary-600">S/ {calculos.precioSugeridoCalculado.toFixed(2)}</p>
              <p className="text-xs text-gray-500">con {producto.margenObjetivo || 30}% margen</p>
            </div>
            <div className="bg-white bg-opacity-60 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Margen Estimado</p>
              <p className={`text-lg font-bold ${calculos.esRentable ? 'text-green-600' : 'text-red-600'}`}>
                {calculos.margenEstimado.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {calculos.esRentable ? 'Rentable' : `Mínimo: ${producto.margenMinimo || 15}%`}
              </p>
            </div>
          </div>

          {/* Desglose de costos USA */}
          {calculos.impuestoMejorProveedor > 0 && (
            <div className="mt-3 p-3 bg-white bg-opacity-60 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Desglose Costo USA:</p>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Producto:</span>
                  <span className="ml-1 font-medium">${calculos.mejorPrecioUSASinImpuesto.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-amber-600">+ Tax ({calculos.impuestoMejorProveedor}%):</span>
                  <span className="ml-1 font-medium text-amber-600">${calculos.montoImpuestoUSA.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">+ Flete:</span>
                  <span className="ml-1 font-medium">${(formData.logisticaEstimada || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-700 font-medium">= Total:</span>
                  <span className="ml-1 font-bold text-gray-900">${calculos.costoTotalUSD.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Métricas de ROI */}
          {preciosPeru.promedio > 0 && calculos.ctruEstimado > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <h5 className="font-semibold text-gray-700 mb-3 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Rendimiento de Inversión
              </h5>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white bg-opacity-60 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-600 mb-1">Ganancia/Unidad</p>
                  <p className={`text-xl font-bold ${calculos.gananciaUnidad > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    S/ {calculos.gananciaUnidad.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white bg-opacity-60 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-600 mb-1">ROI</p>
                  <p className={`text-xl font-bold ${calculos.roi > 50 ? 'text-green-600' : calculos.roi > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {calculos.roi.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white bg-opacity-60 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-600 mb-1">Multiplicador</p>
                  <p className={`text-xl font-bold ${calculos.multiplicador >= 2 ? 'text-green-600' : calculos.multiplicador >= 1.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {calculos.multiplicador.toFixed(2)}x
                  </p>
                </div>
              </div>

              {/* Precio de entrada */}
              {preciosPeru.min > 0 && (
                <div className="mt-3 p-3 bg-white bg-opacity-60 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Precio de entrada competitivo:</span>{' '}
                    <span className="text-primary-600 font-bold">S/ {calculos.precioEntrada.toFixed(2)}</span>
                    <span className="text-xs text-gray-500 ml-2">(5% menos que el competidor más bajo)</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {!calculos.esRentable && preciosPeru.promedio > 0 && (
            <div className="mt-3 p-2 bg-red-200 rounded text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              El margen estimado está por debajo del mínimo requerido ({producto.margenMinimo || 15}%)
            </div>
          )}
        </div>
      )}

      {/* Sección de Alertas (solo si hay alertas) */}
      {inv?.alertas && inv.alertas.length > 0 && (
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <Bell className="h-4 w-4 mr-2 text-amber-600" />
            Alertas del Producto
          </h4>
          <AlertasInvestigacion
            alertas={inv.alertas}
            onMarcarLeida={async (alertaId) => {
              await ProductoService.marcarAlertasLeidas(producto.id, [alertaId]);
            }}
            onMarcarTodasLeidas={async () => {
              await ProductoService.marcarAlertasLeidas(producto.id);
            }}
          />
        </div>
      )}

      {/* Sección de Punto de Equilibrio */}
      {calculos.ctruEstimado > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <Calculator className="h-4 w-4 mr-2 text-indigo-600" />
            Análisis de Punto de Equilibrio
          </h4>
          <PuntoEquilibrioCard
            ctruEstimado={calculos.ctruEstimado}
            precioVentaSugerido={calculos.precioSugeridoCalculado}
            precioPERUMin={preciosPeru.min}
            demandaEstimada={formData.demandaEstimada}
            volumenMercadoEstimado={formData.volumenMercadoEstimado}
            costoTotalUSD={calculos.costoTotalUSD}
            precioEntrada={calculos.precioEntrada}
          />
        </div>
      )}

      {/* Sección de Historial de Precios (solo si existe) */}
      {inv?.historialPrecios && inv.historialPrecios.length > 0 && (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-4 rounded-lg border border-cyan-200">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
            <History className="h-4 w-4 mr-2 text-cyan-600" />
            Historial de Precios
            <span className="ml-2 text-xs text-gray-500 font-normal">
              ({inv.historialPrecios.length} registros)
            </span>
          </h4>
          <HistorialPreciosChart
            historial={inv.historialPrecios}
            tipoCambioActual={tipoCambio}
          />
        </div>
      )}

      {/* Footer con acciones */}
      <div className="flex justify-between items-center pt-4 border-t sticky bottom-0 bg-white -mx-6 px-6 pb-2">
        <div>
          {existeInvestigacion && onDelete && (
            <Button
              type="button"
              variant="danger"
              onClick={onDelete}
              disabled={loading}
            >
              Eliminar investigación
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Guardando...' : existeInvestigacion ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  );
};
