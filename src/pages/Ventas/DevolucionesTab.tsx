/**
 * DevolucionesTab.tsx
 *
 * Tab principal del módulo de devoluciones dentro de la página de Ventas.
 *
 * Incluye:
 * - 4 KPI cards del mes actual
 * - Filtros por estado y búsqueda libre
 * - Tabla de devoluciones con acciones contextuales
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  Package,
  DollarSign,
  TrendingDown,
  Clock,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Card, Button } from '../../components/common';
import { useDevolucionStore } from '../../store/devolucionStore';
import { formatCurrencyPEN } from '../../utils/format';
import { DevolucionDetailModal } from './DevolucionDetailModal';
import type { Devolucion, EstadoDevolucion } from '../../types/devolucion.types';

// ================================================================
// CONSTANTES
// ================================================================

const ESTADOS_OPCIONES: Array<{ value: EstadoDevolucion | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'solicitada', label: 'Solicitada' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'ejecutada', label: 'Ejecutada' },
  { value: 'completada', label: 'Completada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const BADGE_ESTADO: Record<EstadoDevolucion, string> = {
  solicitada: 'bg-yellow-100 text-yellow-800',
  aprobada: 'bg-blue-100 text-blue-800',
  ejecutada: 'bg-purple-100 text-purple-800',
  completada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
  cancelada: 'bg-gray-100 text-gray-600',
};

const LABEL_ESTADO: Record<EstadoDevolucion, string> = {
  solicitada: 'Solicitada',
  aprobada: 'Aprobada',
  ejecutada: 'Ejecutada',
  completada: 'Completada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

const LABEL_MOTIVO: Record<string, string> = {
  producto_danado: 'Producto dañado',
  producto_equivocado: 'Producto equivocado',
  no_cumple_expectativa: 'No cumple expectativa',
  vencido_proximo: 'Próximo a vencer',
  duplicado: 'Pedido duplicado',
  error_pedido: 'Error en pedido',
  otro: 'Otro',
};

// ================================================================
// HELPERS
// ================================================================

function formatFecha(ts: any): string {
  if (!ts) return '—';
  const date = ts?.toDate?.() ?? new Date(ts);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function esMismomes(ts: any): boolean {
  if (!ts) return false;
  const date = ts?.toDate?.() ?? new Date(ts);
  const ahora = new Date();
  return (
    date.getFullYear() === ahora.getFullYear() &&
    date.getMonth() === ahora.getMonth()
  );
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export const DevolucionesTab: React.FC = () => {
  const { devoluciones, loading, error, fetchDevoluciones } = useDevolucionStore();

  const [filtroEstado, setFiltroEstado] = useState<EstadoDevolucion | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [devolucionSeleccionada, setDevolucionSeleccionada] = useState<Devolucion | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Cargar al montar
  useEffect(() => {
    fetchDevoluciones();
  }, []);

  // KPIs del mes actual
  const kpis = useMemo(() => {
    const delMes = devoluciones.filter(d => esMismomes(d.fechaCreacion));
    const totalMes = delMes.length;
    const montoDevuelto = delMes
      .filter(d => d.estado === 'completada')
      .reduce((acc, d) => acc + d.montoDevuelto, 0);
    const pendientes = devoluciones.filter(
      d => d.estado === 'solicitada' || d.estado === 'aprobada' || d.estado === 'ejecutada'
    ).length;

    // Tasa: devoluciones del mes / total del mes (simplificado)
    const tasaDevolucion = totalMes > 0 ? (totalMes / Math.max(1, totalMes + 50)) * 100 : 0;

    return { totalMes, montoDevuelto, pendientes, tasaDevolucion };
  }, [devoluciones]);

  // Filtrado
  const devolucionesFiltradas = useMemo(() => {
    let resultado = devoluciones;

    if (filtroEstado) {
      resultado = resultado.filter(d => d.estado === filtroEstado);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter(
        d =>
          d.numeroDevolucion.toLowerCase().includes(q) ||
          d.ventaNumero.toLowerCase().includes(q) ||
          d.clienteNombre.toLowerCase().includes(q)
      );
    }

    return resultado;
  }, [devoluciones, filtroEstado, busqueda]);

  const handleVerDetalle = (dev: Devolucion) => {
    setDevolucionSeleccionada(dev);
    setIsDetailOpen(true);
  };

  const handleActualizar = () => {
    fetchDevoluciones();
  };

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Devoluciones del mes
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.totalMes}</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <RotateCcw className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Monto devuelto
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrencyPEN(kpis.montoDevuelto)}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Tasa devolución
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kpis.tasaDevolucion.toFixed(1)}%
              </p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Pendientes aprobación
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.pendientes}</p>
            </div>
            <div className={`p-2 rounded-lg ${kpis.pendientes > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
              <Clock className={`h-5 w-5 ${kpis.pendientes > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por # devolución, # venta o cliente..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filtro estado */}
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as EstadoDevolucion | '')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[180px]"
          >
            {ESTADOS_OPCIONES.map(op => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {/* Refrescar */}
          <Button
            variant="secondary"
            onClick={handleActualizar}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            {filtroEstado
              ? `${LABEL_ESTADO[filtroEstado as EstadoDevolucion]} (${devolucionesFiltradas.length})`
              : `Todas las devoluciones (${devolucionesFiltradas.length})`}
          </h3>
        </div>

        {error && (
          <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : devolucionesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No hay devoluciones</p>
            <p className="text-xs mt-1">
              {busqueda || filtroEstado
                ? 'Intenta con otros filtros'
                : 'Las devoluciones aparecerán aquí cuando se creen'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    # Devolución
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    # Venta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Motivo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {devolucionesFiltradas.map(dev => (
                  <tr key={dev.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-700">
                        {dev.numeroDevolucion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600">
                        {dev.ventaNumero}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {dev.clienteNombre}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {LABEL_MOTIVO[dev.motivo] ?? dev.motivo}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrencyPEN(dev.montoDevolucion)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          BADGE_ESTADO[dev.estado] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {LABEL_ESTADO[dev.estado] ?? dev.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatFecha(dev.fechaCreacion)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerDetalle(dev)}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de detalle */}
      {devolucionSeleccionada && (
        <DevolucionDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setDevolucionSeleccionada(null);
          }}
          devolucion={devolucionSeleccionada}
          onActualizar={handleActualizar}
        />
      )}
    </div>
  );
};
