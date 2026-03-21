/**
 * Componente Estado de Resultados
 * Vista contable basada en flujo de actividad del negocio
 *
 * CRITERIO: Las compras (OCs recibidas) son el costo principal,
 * no el CMV calculado desde ventas individuales.
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  Download,
  RefreshCw,
  ShoppingCart,
  Package,
  Truck,
  Building2,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { contabilidadService } from '../../../services/contabilidad.service';
import type { EstadoResultados as EstadoResultadosType } from '../../../types/contabilidad.types';
import { formatCurrencyPEN, formatPercent } from '../../../utils/format';

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

// Delegados a utilidad central
const formatCurrency = (value: number): string => formatCurrencyPEN(value);

// Componente para línea del estado de resultados
interface LineaResultadoProps {
  label: string;
  valor: number;
  porcentaje?: number;
  esSubtotal?: boolean;
  esTotal?: boolean;
  esNegativo?: boolean;
  indent?: number;
  tooltip?: string;
  colorValor?: 'default' | 'success' | 'danger' | 'warning';
}

function LineaResultado({
  label,
  valor,
  porcentaje,
  esSubtotal,
  esTotal,
  esNegativo,
  indent = 0,
  tooltip,
  colorValor = 'default',
}: LineaResultadoProps) {
  const paddingLeft = indent * 20;

  const getColorClass = () => {
    switch (colorValor) {
      case 'success':
        return 'text-green-600';
      case 'danger':
        return 'text-red-600';
      case 'warning':
        return 'text-amber-600';
      default:
        return esNegativo ? 'text-red-600' : '';
    }
  };

  return (
    <div
      className={`flex justify-between items-center py-2 px-4 ${
        esTotal
          ? 'bg-gray-100 font-bold text-lg border-t-2 border-gray-300'
          : esSubtotal
          ? 'bg-gray-50 font-semibold border-t border-gray-200'
          : 'hover:bg-gray-50'
      }`}
      style={{ paddingLeft: `${16 + paddingLeft}px` }}
    >
      <div className="flex items-center gap-2">
        <span className={esTotal ? 'text-gray-900' : esSubtotal ? 'text-gray-800' : 'text-gray-700'}>
          {esNegativo && !esSubtotal && !esTotal && '(-) '}
          {label}
        </span>
        {tooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 max-w-xs">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className={`font-mono ${getColorClass()}`}>
          {esNegativo && valor > 0 ? '- ' : ''}
          {formatCurrency(Math.abs(valor))}
        </span>
        {porcentaje !== undefined && (
          <span className="text-gray-500 text-sm w-16 text-right">
            {formatPercent(porcentaje)}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente para sección colapsable
interface SeccionColapsableProps {
  titulo: string;
  subtitulo?: string;
  total: number;
  porcentaje?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colorHeader?: string;
  icon?: React.ReactNode;
}

function SeccionColapsable({
  titulo,
  subtitulo,
  total,
  porcentaje,
  children,
  defaultOpen = true,
  colorHeader = 'bg-gray-100',
  icon,
}: SeccionColapsableProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center py-3 px-4 ${colorHeader} hover:bg-opacity-80 transition-colors`}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
          {icon}
          <div className="text-left">
            <span className="font-semibold text-gray-800">{titulo}</span>
            {subtitulo && (
              <span className="text-xs text-gray-500 block">{subtitulo}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono font-semibold">{formatCurrency(total)}</span>
          {porcentaje !== undefined && (
            <span className="text-gray-500 text-sm w-16 text-right">
              {formatPercent(porcentaje)}
            </span>
          )}
        </div>
      </button>
      {isOpen && <div className="bg-white">{children}</div>}
    </div>
  );
}

// Componente principal
export default function EstadoResultados() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [estado, setEstado] = useState<EstadoResultadosType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contabilidadService.generarEstadoResultados(mes, anio);
      setEstado(data);
    } catch (err) {
      setError('Error al cargar el Estado de Resultados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [mes, anio]);

  // Años disponibles (desde 2024)
  const aniosDisponibles = [];
  const anioActual = new Date().getFullYear();
  for (let a = 2024; a <= anioActual; a++) {
    aniosDisponibles.push(a);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !estado) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error || 'No se pudo cargar el Estado de Resultados'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Estado de Resultados</h1>
          <p className="text-sm text-gray-500">Contabilidad de Negocio - Flujo de Actividad</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Selector de período */}
          <div className="flex items-center gap-1 sm:gap-2 bg-white border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
            <Calendar className="w-4 h-4 text-gray-400 hidden sm:block" />
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="border-none bg-transparent focus:ring-0 text-xs sm:text-sm"
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="border-none bg-transparent focus:ring-0 text-xs sm:text-sm"
            >
              {aniosDisponibles.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          {/* Botón refrescar */}
          <button
            onClick={cargarDatos}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
          {/* Botón exportar */}
          <button
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            title="Exportar"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Ventas Netas</div>
          <div className="text-lg sm:text-2xl font-bold">{formatCurrency(estado.ventasNetas)}</div>
          <div className="text-xs text-gray-400">{estado.metricas.transacciones} transacciones</div>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Utilidad Bruta</div>
          <div className={`text-lg sm:text-2xl font-bold ${estado.utilidadBruta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatPercent(estado.utilidadBrutaPorcentaje)}
          </div>
          <div className="text-xs text-gray-400">{formatCurrency(estado.utilidadBruta)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Utilidad Operativa</div>
          <div className={`text-lg sm:text-2xl font-bold ${estado.utilidadOperativa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(estado.utilidadOperativa)}
          </div>
          <div className="text-xs text-gray-400">{formatPercent(estado.utilidadOperativaPorcentaje)}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500">Punto de Equilibrio</div>
          <div className="text-lg sm:text-2xl font-bold text-amber-600">
            {formatCurrency(estado.indicadores.puntoEquilibrioSoles)}
          </div>
          <div className="text-xs text-gray-400">
            Margen seg.: {formatPercent(estado.indicadores.margenSeguridad)}
          </div>
        </div>
      </div>

      {/* Estado de Resultados principal */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {/* Título del reporte */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <h2 className="text-xl font-bold">ESTADO DE RESULTADOS</h2>
          <p className="text-blue-100">
            {estado.periodo.nombreMes} {estado.periodo.anio} - Flujo de Actividad del Negocio
          </p>
        </div>

        {/* INGRESOS */}
        <div className="border-b-2 border-blue-200">
          <div className="bg-blue-50 px-4 py-2 font-bold text-blue-800">INGRESOS</div>
          <LineaResultado label="Ventas Brutas" valor={estado.ventasBrutas} />
          {estado.descuentos > 0 && (
            <LineaResultado label="Descuentos" valor={estado.descuentos} esNegativo />
          )}
          {estado.devoluciones > 0 && (
            <LineaResultado label="Devoluciones" valor={estado.devoluciones} esNegativo />
          )}
          <LineaResultado
            label="VENTAS NETAS"
            valor={estado.ventasNetas}
            porcentaje={100}
            esSubtotal
          />
          {/* Nota de Anticipos */}
          {estado.anticiposPendientes > 0 && (
            <div className="bg-purple-50 border-l-4 border-purple-400 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-purple-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Incluye <strong>{formatCurrency(estado.anticiposPendientes)}</strong> en anticipos
                  <span className="hidden sm:inline"> (ventas reservadas no entregadas)</span>
                </span>
              </div>
              <div className="text-xs sm:text-sm text-purple-600 font-mono pl-6 sm:pl-0">
                Ingreso realizado: {formatCurrency(estado.ventasNetasRealizadas)}
              </div>
            </div>
          )}
        </div>

        {/* COMPRAS DEL PERÍODO (COSTO DE MERCADERÍA) */}
        <SeccionColapsable
          titulo="COMPRAS DEL PERÍODO"
          subtitulo="Costo de Mercadería - OCs recibidas en el período"
          total={estado.compras.total}
          porcentaje={estado.compras.porcentajeVentas}
          colorHeader="bg-orange-50"
          icon={<ShoppingCart className="w-5 h-5 text-orange-600" />}
        >
          <div className="border-l-4 border-orange-300 ml-4">
            <LineaResultado
              label="Costo de Productos"
              valor={estado.compras.costoProductos}
              esNegativo
              indent={1}
              tooltip="Subtotal de las órdenes de compra (precio × cantidad)"
            />
            {estado.compras.impuestos > 0 && (
              <LineaResultado
                label="Impuestos (Sales Tax USA)"
                valor={estado.compras.impuestos}
                esNegativo
                indent={1}
                tooltip="Impuesto de venta en Estados Unidos"
              />
            )}
            {estado.compras.fleteInternacional > 0 && (
              <LineaResultado
                label="Flete Internacional (USA-PERU)"
                valor={estado.compras.fleteInternacional}
                esNegativo
                indent={1}
                tooltip={`Costo de transporte de transferencias USA-Perú${estado.compras.transferenciasRecibidas ? ` (${estado.compras.transferenciasRecibidas} envíos)` : ''}`}
              />
            )}
            {estado.compras.otrosGastosImportacion > 0 && (
              <LineaResultado
                label="Otros Gastos de Importación"
                valor={estado.compras.otrosGastosImportacion}
                esNegativo
                indent={1}
                tooltip="Gastos de envío interno USA + otros gastos de las OCs"
              />
            )}
          </div>
          <div className="bg-orange-50 px-4 py-2 text-sm text-orange-700 flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>
              {estado.compras.ordenesRecibidas} órdenes recibidas •{' '}
              {estado.compras.unidadesCompradas} unidades compradas
              {(estado.compras.transferenciasRecibidas || 0) > 0 && (
                <> • {estado.compras.transferenciasRecibidas} envíos USA-Perú</>
              )}
            </span>
          </div>
        </SeccionColapsable>

        {/* UTILIDAD BRUTA */}
        <LineaResultado
          label="UTILIDAD BRUTA"
          valor={estado.utilidadBruta}
          porcentaje={estado.utilidadBrutaPorcentaje}
          esTotal
          colorValor={estado.utilidadBruta >= 0 ? 'success' : 'danger'}
        />

        {/* COSTOS VARIABLES (GV + GD) */}
        <SeccionColapsable
          titulo="COSTOS VARIABLES"
          subtitulo="Gastos de Venta (GV) + Gastos de Distribución (GD)"
          total={estado.costosVariables.total}
          porcentaje={estado.costosVariables.porcentajeVentas}
          colorHeader="bg-purple-50"
          icon={<Truck className="w-5 h-5 text-purple-600" />}
        >
          {/* GV */}
          <div className="border-l-4 border-purple-300 ml-4">
            <LineaResultado
              label="Gastos de Venta (GV)"
              valor={estado.costosVariables.gv.total}
              esNegativo
              indent={1}
              tooltip="Varían con el volumen de ventas"
            />
            {estado.costosVariables.gv.comisionesPlataformas > 0 && (
              <LineaResultado
                label="Comisiones plataformas (ML, pasarelas)"
                valor={estado.costosVariables.gv.comisionesPlataformas}
                indent={2}
              />
            )}
            {estado.costosVariables.gv.marketingPublicidad > 0 && (
              <LineaResultado
                label="Marketing y publicidad"
                valor={estado.costosVariables.gv.marketingPublicidad}
                indent={2}
              />
            )}
            {estado.costosVariables.gv.otros > 0 && (
              <LineaResultado
                label="Otros gastos de venta"
                valor={estado.costosVariables.gv.otros}
                indent={2}
              />
            )}
          </div>

          {/* GD */}
          <div className="border-l-4 border-blue-300 ml-4 mt-2">
            <LineaResultado
              label="Gastos de Distribución (GD)"
              valor={estado.costosVariables.gd.total}
              esNegativo
              indent={1}
              tooltip="Varían con el número de entregas"
            />
            {estado.costosVariables.gd.delivery > 0 && (
              <LineaResultado
                label="Delivery y última milla"
                valor={estado.costosVariables.gd.delivery}
                indent={2}
              />
            )}
            {estado.costosVariables.gd.empaque > 0 && (
              <LineaResultado
                label="Empaque y materiales"
                valor={estado.costosVariables.gd.empaque}
                indent={2}
              />
            )}
            {estado.costosVariables.gd.fleteLocal > 0 && (
              <LineaResultado
                label="Flete local"
                valor={estado.costosVariables.gd.fleteLocal}
                indent={2}
              />
            )}
            {estado.costosVariables.gd.otros > 0 && (
              <LineaResultado
                label="Otros gastos de distribución"
                valor={estado.costosVariables.gd.otros}
                indent={2}
              />
            )}
          </div>
        </SeccionColapsable>

        {/* COSTOS FIJOS (GA + GO) */}
        <SeccionColapsable
          titulo="COSTOS FIJOS"
          subtitulo="Gastos Administrativos (GA) + Gastos Operativos (GO)"
          total={estado.costosFijos.total}
          porcentaje={estado.costosFijos.porcentajeVentas}
          colorHeader="bg-amber-50"
          icon={<Building2 className="w-5 h-5 text-amber-600" />}
        >
          {/* GA */}
          <div className="border-l-4 border-amber-300 ml-4">
            <LineaResultado
              label="Gastos Administrativos (GA)"
              valor={estado.costosFijos.ga.total}
              esNegativo
              indent={1}
              tooltip="Fijos del período, independientes del volumen"
            />
            {estado.costosFijos.ga.planilla > 0 && (
              <LineaResultado
                label="Planilla y honorarios"
                valor={estado.costosFijos.ga.planilla}
                indent={2}
              />
            )}
            {estado.costosFijos.ga.servicios > 0 && (
              <LineaResultado
                label="Servicios (luz, agua, internet)"
                valor={estado.costosFijos.ga.servicios}
                indent={2}
              />
            )}
            {estado.costosFijos.ga.alquiler > 0 && (
              <LineaResultado
                label="Alquiler de oficina/almacén"
                valor={estado.costosFijos.ga.alquiler}
                indent={2}
              />
            )}
            {estado.costosFijos.ga.contabilidad > 0 && (
              <LineaResultado
                label="Contabilidad y asesoría"
                valor={estado.costosFijos.ga.contabilidad}
                indent={2}
              />
            )}
            {estado.costosFijos.ga.otros > 0 && (
              <LineaResultado
                label="Otros gastos administrativos"
                valor={estado.costosFijos.ga.otros}
                indent={2}
              />
            )}
          </div>

          {/* GO */}
          <div className="border-l-4 border-green-300 ml-4 mt-2">
            <LineaResultado
              label="Gastos Operativos (GO)"
              valor={estado.costosFijos.go.total}
              esNegativo
              indent={1}
              tooltip="Gastos de operación del negocio"
            />
            {estado.costosFijos.go.movilidad > 0 && (
              <LineaResultado
                label="Movilidad y transporte"
                valor={estado.costosFijos.go.movilidad}
                indent={2}
              />
            )}
            {estado.costosFijos.go.suministros > 0 && (
              <LineaResultado
                label="Suministros de oficina"
                valor={estado.costosFijos.go.suministros}
                indent={2}
              />
            )}
            {estado.costosFijos.go.mantenimiento > 0 && (
              <LineaResultado
                label="Mantenimiento y reparaciones"
                valor={estado.costosFijos.go.mantenimiento}
                indent={2}
              />
            )}
            {estado.costosFijos.go.otros > 0 && (
              <LineaResultado
                label="Otros gastos operativos"
                valor={estado.costosFijos.go.otros}
                indent={2}
              />
            )}
          </div>
        </SeccionColapsable>

        {/* Total Gastos Operativos */}
        <LineaResultado
          label="TOTAL GASTOS OPERATIVOS"
          valor={estado.totalGastosOperativos}
          porcentaje={estado.totalGastosOperativosPorcentaje}
          esSubtotal
          esNegativo
        />

        {/* UTILIDAD OPERATIVA (EBIT) */}
        <LineaResultado
          label="UTILIDAD OPERATIVA (EBIT)"
          valor={estado.utilidadOperativa}
          porcentaje={estado.utilidadOperativaPorcentaje}
          esTotal
          colorValor={estado.utilidadOperativa >= 0 ? 'success' : 'danger'}
        />

        {/* OTROS INGRESOS/GASTOS */}
        {(estado.otrosIngresosGastos.diferenciaCambiariaNeta !== 0 ||
          estado.otrosIngresosGastos.gastosFinancieros > 0 ||
          estado.otrosIngresosGastos.otrosIngresos > 0 ||
          estado.otrosIngresosGastos.otrosGastos > 0) && (
          <SeccionColapsable
            titulo="OTROS INGRESOS / GASTOS"
            subtitulo="No operativos"
            total={estado.otrosIngresosGastos.total}
            colorHeader="bg-gray-100"
            defaultOpen={false}
            icon={<Settings className="w-5 h-5 text-gray-600" />}
          >
            {estado.otrosIngresosGastos.gananciaCambiariaVentas > 0 && (
              <LineaResultado
                label="Ganancia cambiaria (ventas)"
                valor={estado.otrosIngresosGastos.gananciaCambiariaVentas}
                colorValor="success"
                indent={1}
              />
            )}
            {estado.otrosIngresosGastos.perdidaCambiariaVentas > 0 && (
              <LineaResultado
                label="Pérdida cambiaria (ventas)"
                valor={estado.otrosIngresosGastos.perdidaCambiariaVentas}
                esNegativo
                indent={1}
              />
            )}
            {estado.otrosIngresosGastos.gananciaCambiariaCompras > 0 && (
              <LineaResultado
                label="Ganancia cambiaria (compras)"
                valor={estado.otrosIngresosGastos.gananciaCambiariaCompras}
                colorValor="success"
                indent={1}
              />
            )}
            {estado.otrosIngresosGastos.perdidaCambiariaCompras > 0 && (
              <LineaResultado
                label="Pérdida cambiaria (compras)"
                valor={estado.otrosIngresosGastos.perdidaCambiariaCompras}
                esNegativo
                indent={1}
              />
            )}
            {estado.otrosIngresosGastos.gastosFinancieros > 0 && (
              <LineaResultado
                label="Gastos financieros"
                valor={estado.otrosIngresosGastos.gastosFinancieros}
                esNegativo
                indent={1}
              />
            )}
            {estado.otrosIngresosGastos.otrosIngresos > 0 && (
              <LineaResultado
                label="Otros ingresos"
                valor={estado.otrosIngresosGastos.otrosIngresos}
                colorValor="success"
                indent={1}
              />
            )}
            {estado.otrosIngresosGastos.otrosGastos > 0 && (
              <LineaResultado
                label="Otros gastos"
                valor={estado.otrosIngresosGastos.otrosGastos}
                esNegativo
                indent={1}
              />
            )}
            <LineaResultado
              label="Diferencia Cambiaria Neta"
              valor={estado.otrosIngresosGastos.diferenciaCambiariaNeta}
              esSubtotal
              colorValor={estado.otrosIngresosGastos.diferenciaCambiariaNeta >= 0 ? 'success' : 'danger'}
            />
          </SeccionColapsable>
        )}

        {/* UTILIDAD NETA */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4 px-4 sm:px-6 gap-1 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              {estado.utilidadNeta >= 0 ? (
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              )}
              <span className="text-sm sm:text-lg font-bold">UTILIDAD NETA ANTES DE IMPUESTOS</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-6 pl-7 sm:pl-0">
              <span className={`text-xl sm:text-2xl font-bold ${estado.utilidadNeta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(estado.utilidadNeta)}
              </span>
              <span className="text-gray-300 text-sm sm:text-lg">
                {formatPercent(estado.utilidadNetaPorcentaje)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores Clave */}
      <div className="bg-white rounded-lg border p-4 sm:p-6">
        <h3 className="font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Indicadores Clave
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {/* Márgenes */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-600 border-b pb-1">Márgenes</div>
            <div>
              <div className="text-sm text-gray-500">Margen Bruto</div>
              <div className={`text-xl font-semibold ${estado.indicadores.margenBruto >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatPercent(estado.indicadores.margenBruto)}
              </div>
              <div className="text-xs text-gray-400">(Ventas - Compras) / Ventas</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Margen Operativo</div>
              <div className={`text-xl font-semibold ${estado.indicadores.margenOperativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(estado.indicadores.margenOperativo)}
              </div>
              <div className="text-xs text-gray-400">EBIT / Ventas</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Margen Neto</div>
              <div className={`text-xl font-semibold ${estado.indicadores.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(estado.indicadores.margenNeto)}
              </div>
              <div className="text-xs text-gray-400">Utilidad Neta / Ventas</div>
            </div>
          </div>

          {/* Ratios */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-600 border-b pb-1">Ratios de Estructura</div>
            <div>
              <div className="text-sm text-gray-500">Ratio de Inversión</div>
              <div className="text-xl font-semibold text-orange-600">
                {formatPercent(estado.indicadores.ratioInversion)}
              </div>
              <div className="text-xs text-gray-400">Compras / Ventas</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Ratio Gastos Variables</div>
              <div className="text-xl font-semibold text-purple-600">
                {formatPercent(estado.indicadores.ratioGastosVariables)}
              </div>
              <div className="text-xs text-gray-400">(GV + GD) / Ventas</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Ratio Gastos Fijos</div>
              <div className="text-xl font-semibold text-amber-600">
                {formatPercent(estado.indicadores.ratioGastosFijos)}
              </div>
              <div className="text-xs text-gray-400">(GA + GO) / Ventas</div>
            </div>
          </div>

          {/* Punto de Equilibrio */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-600 border-b pb-1">Punto de Equilibrio</div>
            <div>
              <div className="text-sm text-gray-500">PE en Soles</div>
              <div className="text-xl font-semibold text-amber-600">
                {formatCurrency(estado.indicadores.puntoEquilibrioSoles)}
              </div>
              <div className="text-xs text-gray-400">Costos Fijos / Margen Contribución %</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">PE en Unidades</div>
              <div className="text-xl font-semibold text-amber-600">
                ~{estado.indicadores.puntoEquilibrioUnidades.toLocaleString()} uds
              </div>
              <div className="text-xs text-gray-400">A precio promedio actual</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Margen de Seguridad</div>
              <div className={`text-xl font-semibold ${estado.indicadores.margenSeguridad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(estado.indicadores.margenSeguridad)}
              </div>
              <div className="text-xs text-gray-400">(Ventas - PE) / Ventas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Operativas */}
      <div className="bg-white rounded-lg border p-4 sm:p-6">
        <h3 className="font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-green-600" />
          Métricas Operativas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-500">Transacciones</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {estado.metricas.transacciones}
            </div>
            <div className="text-xs text-gray-400">ventas del período</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-500">Ticket Promedio</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {formatCurrency(estado.metricas.ticketPromedio)}
            </div>
            <div className="text-xs text-gray-400">por transacción</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-500">Unidades Vendidas</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {estado.metricas.unidadesVendidas.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              {formatCurrency(estado.metricas.precioPromedioUnidad)} / ud
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-500">Rotación Implícita</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {estado.metricas.rotacionImplicita.toFixed(2)}x
            </div>
            <div className="text-xs text-gray-400">Ventas / Compras</div>
          </div>
        </div>
      </div>

      {/* Notas Contables */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 sm:p-6">
        <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2 text-sm sm:text-base">
          <AlertTriangle className="w-5 h-5" />
          Notas Contables
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm text-blue-800">
          <div>
            <div className="font-semibold mb-2">Criterio de Reconocimiento:</div>
            <ul className="space-y-1 text-blue-700">
              <li><strong>Ventas:</strong> Cuando se registra la venta (no cotización)</li>
              <li><strong>Compras:</strong> Cuando la mercadería es RECIBIDA en almacén</li>
              <li><strong>Gastos:</strong> Cuando corresponden al mes/año del período</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Moneda y Conversión:</div>
            <ul className="space-y-1 text-blue-700">
              <li><strong>Moneda funcional:</strong> Soles (PEN)</li>
              <li><strong>Compras USD:</strong> Convertidas al TC de pago o compra</li>
              <li><strong>Diferencia cambiaria:</strong> Registrada en Otros Ingresos/Gastos</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="font-semibold mb-2 text-blue-800">Limitaciones:</div>
          <ul className="text-blue-700 text-xs sm:text-sm space-y-1">
            <li>• Este reporte es para uso interno de gestión, no es un Estado Financiero auditado</li>
            <li>• Las compras reflejan la inversión en inventario del período, no el CMV tradicional</li>
            <li>• El punto de equilibrio es aproximado, basado en el margen de contribución actual</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
