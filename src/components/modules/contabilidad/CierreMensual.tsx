/**
 * CierreMensual — Tab de cierre contable mensual
 *
 * Permite ejecutar validaciones pre-cierre, cerrar periodos,
 * ver historial de cierres y reabrir periodos cerrados.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button, ConfirmDialog, Badge } from '../../common';
import { cierreContableService } from '../../../services/cierreContable.service';
import { useAuthStore } from '../../../store/authStore';
import { formatCurrencyPEN, formatPercent } from '../../../utils/format';
import { logger } from '../../../lib/logger';
import type {
  CierreContable,
  ResultadoValidacion,
  ValidacionPreCierre,
} from '../../../types/cierreContable.types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface CierreMensualProps {
  mes: number;
  anio: number;
}

export default function CierreMensual({ mes, anio }: CierreMensualProps) {
  const userProfile = useAuthStore(s => s.userProfile);
  const isAdmin = userProfile?.role === 'admin';

  // Estado
  const [validacionResult, setValidacionResult] = useState<ResultadoValidacion | null>(null);
  const [cierreActual, setCierreActual] = useState<CierreContable | null>(null);
  const [historial, setHistorial] = useState<CierreContable[]>([]);
  const [loading, setLoading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [showConfirmCierre, setShowConfirmCierre] = useState(false);
  const [showConfirmReapertura, setShowConfirmReapertura] = useState(false);
  const [motivoReapertura, setMotivoReapertura] = useState('');
  const [detalleExpandido, setDetalleExpandido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar cierre actual e historial
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cierre, hist] = await Promise.all([
        cierreContableService.getCierre(mes, anio),
        cierreContableService.getHistorial(),
      ]);
      setCierreActual(cierre);
      setHistorial(hist);
    } catch (err) {
      logger.error('Error cargando datos de cierre:', err);
      setError('Error al cargar datos del cierre contable');
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    cargarDatos();
    // Limpiar validacion al cambiar periodo
    setValidacionResult(null);
  }, [cargarDatos]);

  // Ejecutar validaciones
  const ejecutarValidacion = async () => {
    setValidando(true);
    setError(null);
    try {
      const result = await cierreContableService.validarPreCierre(mes, anio);
      setValidacionResult(result);
    } catch (err) {
      logger.error('Error en validacion pre-cierre:', err);
      setError('Error al ejecutar las validaciones');
    } finally {
      setValidando(false);
    }
  };

  // Ejecutar cierre
  const ejecutarCierre = async () => {
    if (!userProfile?.uid) return;
    setCerrando(true);
    setError(null);
    try {
      const cierre = await cierreContableService.ejecutarCierre(mes, anio, userProfile.uid);
      setCierreActual(cierre);
      setValidacionResult(null);
      await cargarDatos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al cerrar';
      setError(msg);
      logger.error('Error ejecutando cierre:', err);
    } finally {
      setCerrando(false);
      setShowConfirmCierre(false);
    }
  };

  // Reabrir cierre
  const ejecutarReapertura = async () => {
    if (!cierreActual?.id || !userProfile?.uid || !motivoReapertura.trim()) return;
    setError(null);
    try {
      await cierreContableService.reabrir(cierreActual.id, motivoReapertura.trim(), userProfile.uid);
      setMotivoReapertura('');
      await cargarDatos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reabrir';
      setError(msg);
      logger.error('Error reabriendo cierre:', err);
    } finally {
      setShowConfirmReapertura(false);
    }
  };

  // Helpers de render
  const getValidacionIcon = (v: ValidacionPreCierre) => {
    if (v.resultado === 'aprobada') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (v.resultado === 'rechazada') return <XCircle className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  };

  const getValidacionBg = (v: ValidacionPreCierre) => {
    if (v.resultado === 'aprobada') return 'bg-green-50 border-green-200';
    if (v.resultado === 'rechazada') return 'bg-red-50 border-red-200';
    return 'bg-amber-50 border-amber-200';
  };

  const periodoCerrado = cierreActual?.estado === 'cerrado';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error global */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Estado del periodo */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {periodoCerrado ? (
              <div className="p-2 bg-green-100 rounded-lg">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
            ) : (
              <div className="p-2 bg-amber-100 rounded-lg">
                <Unlock className="w-6 h-6 text-amber-600" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Cierre Contable - {MESES[mes - 1]} {anio}
              </h3>
              <p className="text-sm text-gray-500">
                {periodoCerrado
                  ? `Cerrado el ${cierreActual?.fechaCierre instanceof Date ? cierreActual.fechaCierre.toLocaleDateString('es-PE') : '-'}`
                  : cierreActual?.estado === 'reabierto'
                    ? 'Periodo reabierto - puede cerrarse nuevamente'
                    : 'Periodo abierto - pendiente de cierre'}
              </p>
            </div>
          </div>
          <Badge
            variant={periodoCerrado ? 'success' : cierreActual?.estado === 'reabierto' ? 'warning' : 'default'}
          >
            {periodoCerrado ? 'Cerrado' : cierreActual?.estado === 'reabierto' ? 'Reabierto' : 'Abierto'}
          </Badge>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-3">
          {!periodoCerrado && (
            <>
              <Button
                onClick={ejecutarValidacion}
                disabled={validando}
                variant="secondary"
              >
                {validando ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Ejecutar Validacion
              </Button>
              {validacionResult?.puedesCerrar && isAdmin && (
                <Button
                  onClick={() => setShowConfirmCierre(true)}
                  disabled={cerrando}
                  variant="danger"
                >
                  {cerrando ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Ejecutar Cierre
                </Button>
              )}
              {validacionResult && !validacionResult.puedesCerrar && (
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  Hay validaciones criticas que impiden el cierre
                </span>
              )}
            </>
          )}
          {periodoCerrado && isAdmin && (
            <Button
              onClick={() => setShowConfirmReapertura(true)}
              variant="secondary"
            >
              <Unlock className="w-4 h-4 mr-2" />
              Reabrir Periodo
            </Button>
          )}
          {!isAdmin && periodoCerrado && (
            <span className="text-sm text-gray-500">Solo administradores pueden reabrir periodos</span>
          )}
        </div>
      </div>

      {/* Snapshot del cierre (si esta cerrado) */}
      {periodoCerrado && cierreActual?.snapshot && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            Snapshot del Cierre
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Ventas Netas</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrencyPEN(cierreActual.snapshot.totalVentas)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Compras</div>
              <div className="text-lg font-bold text-orange-600">
                {formatCurrencyPEN(cierreActual.snapshot.totalCompras)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Gastos Operativos</div>
              <div className="text-lg font-bold text-gray-600">
                {formatCurrencyPEN(cierreActual.snapshot.totalGastos)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Utilidad Neta</div>
              <div className={`text-lg font-bold ${
                cierreActual.snapshot.estadoResultados.utilidadNeta >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatCurrencyPEN(cierreActual.snapshot.estadoResultados.utilidadNeta)}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Unidades Vendidas</div>
              <div className="text-lg font-bold text-gray-900">
                {cierreActual.snapshot.unidadesVendidas}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Margen Neto</div>
              <div className="text-lg font-bold text-indigo-600">
                {formatPercent(cierreActual.snapshot.estadoResultados.utilidadNetaPorcentaje)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">TC al Cierre</div>
              <div className="text-lg font-bold text-gray-900">
                {cierreActual.snapshot.tipoCambioAlCierre.toFixed(4)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Total Activos</div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrencyPEN(cierreActual.snapshot.balanceGeneral.activos.totalActivos)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validaciones pre-cierre */}
      {validacionResult && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Validaciones Pre-Cierre
            </h4>
            <div className="flex gap-2">
              {validacionResult.criticas > 0 && (
                <Badge variant="danger">{validacionResult.criticas} critica(s)</Badge>
              )}
              {validacionResult.advertencias > 0 && (
                <Badge variant="warning">{validacionResult.advertencias} advertencia(s)</Badge>
              )}
              {validacionResult.puedesCerrar && validacionResult.criticas === 0 && (
                <Badge variant="success">Listo para cerrar</Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {validacionResult.validaciones.map((v) => (
              <div
                key={v.id}
                className={`rounded-lg border p-3 ${getValidacionBg(v)}`}
              >
                <div className="flex items-center gap-3">
                  {getValidacionIcon(v)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{v.nombre}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        v.severidad === 'critica'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {v.severidad}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{v.detalle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de cierres */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            Historial de Cierres
          </h4>
        </div>

        {historial.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No se han realizado cierres contables aun
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {historial.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {MESES[c.mes - 1]} {c.anio}
                    </span>
                    <Badge variant={c.estado === 'cerrado' ? 'success' : 'warning'}>
                      {c.estado === 'cerrado' ? 'Cerrado' : 'Reabierto'}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {c.fechaCierre instanceof Date ? c.fechaCierre.toLocaleDateString('es-PE') : '-'}
                    </div>
                    <div>Por: {c.cerradoPor}</div>
                  </div>
                  {c.snapshot && (
                    <button
                      onClick={() =>
                        setDetalleExpandido(detalleExpandido === c.id ? null : c.id ?? null)
                      }
                      className="mt-2 text-xs text-indigo-600 flex items-center gap-1"
                    >
                      {detalleExpandido === c.id ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Ocultar detalle
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> Ver detalle
                        </>
                      )}
                    </button>
                  )}
                  {detalleExpandido === c.id && c.snapshot && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Ventas:</span>{' '}
                        {formatCurrencyPEN(c.snapshot.totalVentas)}
                      </div>
                      <div>
                        <span className="text-gray-500">U. Neta:</span>{' '}
                        <span className={c.snapshot.estadoResultados.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrencyPEN(c.snapshot.estadoResultados.utilidadNeta)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: Tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Cierre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cerrado por</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ventas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad Neta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historial.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {MESES[c.mes - 1]} {c.anio}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={c.estado === 'cerrado' ? 'success' : 'warning'} size="sm">
                          {c.estado === 'cerrado' ? 'Cerrado' : 'Reabierto'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.fechaCierre instanceof Date ? c.fechaCierre.toLocaleDateString('es-PE') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.cerradoPor}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {c.snapshot ? formatCurrencyPEN(c.snapshot.totalVentas) : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-medium ${
                        c.snapshot && c.snapshot.estadoResultados.utilidadNeta >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {c.snapshot ? formatCurrencyPEN(c.snapshot.estadoResultados.utilidadNeta) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialog de confirmacion de cierre */}
      <ConfirmDialog
        isOpen={showConfirmCierre}
        onClose={() => setShowConfirmCierre(false)}
        onConfirm={ejecutarCierre}
        title="Confirmar Cierre Contable"
        message={
          <div className="space-y-2">
            <p>
              Se cerrara el periodo <strong>{MESES[mes - 1]} {anio}</strong>.
            </p>
            <p className="text-sm text-gray-500">
              Se generara un snapshot de los estados financieros. No se podran registrar
              movimientos en este periodo hasta que se reabra.
            </p>
            {validacionResult && validacionResult.advertencias > 0 && (
              <p className="text-sm text-amber-600">
                Nota: Hay {validacionResult.advertencias} advertencia(s) pendiente(s).
              </p>
            )}
          </div>
        }
        confirmText="Cerrar Periodo"
        variant="danger"
        loading={cerrando}
        icon={<Lock className="h-6 w-6" />}
      />

      {/* Dialog de confirmacion de reapertura */}
      <ConfirmDialog
        isOpen={showConfirmReapertura}
        onClose={() => {
          setShowConfirmReapertura(false);
          setMotivoReapertura('');
        }}
        onConfirm={ejecutarReapertura}
        title="Reabrir Periodo Contable"
        message={
          <div className="space-y-3">
            <p>
              Se reabrira el periodo <strong>{MESES[mes - 1]} {anio}</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo de reapertura (obligatorio)
              </label>
              <textarea
                value={motivoReapertura}
                onChange={(e) => setMotivoReapertura(e.target.value)}
                placeholder="Describa el motivo por el cual se reabre este periodo..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
              />
            </div>
          </div>
        }
        confirmText={motivoReapertura.trim() ? 'Reabrir Periodo' : 'Ingrese un motivo'}
        variant="warning"
      />
    </div>
  );
}
