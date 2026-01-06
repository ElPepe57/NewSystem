import React, { useEffect, useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, Filter, Download, PieChart, CreditCard, Wallet } from 'lucide-react';
import { Card, Badge, Button, Select, useConfirmDialog, ConfirmDialog, ListSummary, EmptyStateAction, TableRowSkeleton, GastosSkeleton } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { ctruService } from '../../services/ctru.service';
import { GastoForm } from './GastoForm';
import { PagoGastoForm } from './PagoGastoForm';
import { exportService } from '../../services/export.service';
import { CATEGORIAS_GASTO, type Gasto, type TipoGasto, type CategoriaGasto, type EstadoGasto, type ClaseGasto } from '../../types/gasto.types';

export const Gastos: React.FC = () => {
  const { user } = useAuthStore();
  const { gastos, stats, loading, fetchGastosMesActual, fetchStats } = useGastoStore();

  const [showModal, setShowModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [gastoParaPago, setGastoParaPago] = useState<Gasto | null>(null);
  const [filtros, setFiltros] = useState({
    claseGasto: '' as ClaseGasto | '',
    tipo: '' as TipoGasto | '',
    categoria: '' as CategoriaGasto | '',
    estado: '' as EstadoGasto | '',
    esProrrateable: '' as 'true' | 'false' | ''
  });

  // Hook para dialogo de confirmacion
  const { dialogProps, confirm } = useConfirmDialog();
  const toast = useToastStore();

  useEffect(() => {
    fetchGastosMesActual();
    fetchStats();
  }, [fetchGastosMesActual, fetchStats]);

  // Filtrar gastos
  const gastosFiltrados = React.useMemo(() => {
    let resultado = gastos;

    if (filtros.claseGasto) {
      resultado = resultado.filter(g => g.claseGasto === filtros.claseGasto);
    }
    if (filtros.tipo) {
      resultado = resultado.filter(g => g.tipo === filtros.tipo);
    }
    if (filtros.categoria) {
      resultado = resultado.filter(g => g.categoria === filtros.categoria);
    }
    if (filtros.estado) {
      resultado = resultado.filter(g => g.estado === filtros.estado);
    }
    if (filtros.esProrrateable) {
      resultado = resultado.filter(g => g.esProrrateable === (filtros.esProrrateable === 'true'));
    }

    return resultado;
  }, [gastos, filtros]);

  // Calcular resumen por tipo de gasto
  const resumenPorTipo = useMemo(() => {
    const resumen: Record<string, { tipo: string; cantidad: number; total: number; porcentaje: number }> = {};
    const totalGeneral = gastosFiltrados.reduce((sum, g) => sum + g.montoPEN, 0);

    gastosFiltrados.forEach(gasto => {
      const tipo = gasto.tipo;
      if (!resumen[tipo]) {
        resumen[tipo] = { tipo, cantidad: 0, total: 0, porcentaje: 0 };
      }
      resumen[tipo].cantidad += 1;
      resumen[tipo].total += gasto.montoPEN;
    });

    // Calcular porcentajes y ordenar por total descendente
    const resultado = Object.values(resumen)
      .map(item => ({
        ...item,
        porcentaje: totalGeneral > 0 ? (item.total / totalGeneral) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return { items: resultado, totalGeneral };
  }, [gastosFiltrados]);

  // Obtener lista única de tipos para el filtro dinámico
  const tiposUnicos = useMemo(() => {
    const tipos = new Set(gastos.map(g => g.tipo));
    return Array.from(tipos).sort();
  }, [gastos]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatFecha = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) {
      return '-';
    }
    return timestamp.toDate().toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEstadoBadge = (estado: EstadoGasto) => {
    const badges = {
      'pendiente': { variant: 'warning' as const, label: 'Pendiente' },
      'pagado': { variant: 'success' as const, label: 'Pagado' },
      'cancelado': { variant: 'danger' as const, label: 'Cancelado' }
    };
    return badges[estado] || { variant: 'default' as const, label: 'Desconocido' };
  };

  const getTipoBadge = (tipo: TipoGasto) => {
    // Para tipos personalizados, mostrar el tipo directamente
    // Ya no usamos el mapeo predefinido ya que ahora los tipos son strings descriptivos
    return { variant: 'default' as const, label: tipo };
  };

  // Colores para las categorías
  const getCategoriaColor = (cat: CategoriaGasto | undefined): string => {
    if (!cat) return 'bg-gray-100 text-gray-700';
    const colors: Record<CategoriaGasto, string> = {
      GV: 'bg-purple-100 text-purple-700',
      GD: 'bg-blue-100 text-blue-700',
      GA: 'bg-amber-100 text-amber-700',
      GO: 'bg-green-100 text-green-700'
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  const handleRecalcularCTRU = async () => {
    const confirmed = await confirm({
      title: 'Recalcular CTRU Dinamico',
      message: '¿Desea recalcular el CTRU dinamico con los gastos pendientes? Esto actualizara el costo de todas las unidades disponibles.',
      confirmText: 'Recalcular',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      const resultado = await ctruService.recalcularCTRUDinamico();
      toast.success(
        `${resultado.unidadesActualizadas} unidades actualizadas, ${resultado.gastosAplicados} gastos aplicados. Impacto: ${formatCurrency(resultado.impactoPorUnidad)}/unidad`,
        'CTRU Recalculado'
      );

      // Recargar datos
      await fetchGastosMesActual();
      await fetchStats();
    } catch (error: any) {
      toast.error(error.message, 'Error al recalcular CTRU');
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      claseGasto: '',
      tipo: '',
      categoria: '',
      estado: '',
      esProrrateable: ''
    });
  };

  // Obtener badge para clase de gasto
  const getClaseBadge = (clase: ClaseGasto | undefined) => {
    if (!clase) {
      // Para gastos antiguos sin clase, mostrar como GAO
      return { label: 'GAO', color: 'bg-gray-100 text-gray-700' };
    }
    if (clase === 'GVD') {
      return { label: 'GVD', color: 'bg-purple-100 text-purple-700' };
    }
    return { label: 'GAO', color: 'bg-blue-100 text-blue-700' };
  };

  // Mostrar skeleton durante carga inicial
  if (loading && gastos.length === 0) {
    return <GastosSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gastos</h1>
          <p className="text-gray-600 mt-1">
            Gestión de gastos operativos y cálculo CTRU dinámico
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportService.exportGastos(gastosFiltrados)}
            disabled={gastosFiltrados.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button
            variant="secondary"
            onClick={handleRecalcularCTRU}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Recalcular CTRU
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Métricas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Mes Actual</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.totalMesActual)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.cantidadGastosMesActual} gastos
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Gastos Prorrateables</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">
                  {formatCurrency(stats.gastosProrrateablesMesActual)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Impactan CTRU
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-primary-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Pendientes de Pago</div>
                <div className="text-2xl font-bold text-warning-600 mt-1">
                  {formatCurrency(stats.totalPendientePago)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.cantidadPendientePago} gastos
                </div>
              </div>
              <AlertCircle className="h-8 w-8 text-warning-400" />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Variación vs Mes Anterior</div>
                <div className={`text-2xl font-bold mt-1 ${
                  stats.variacionVsMesAnterior >= 0 ? 'text-danger-600' : 'text-success-600'
                }`}>
                  {stats.variacionVsMesAnterior >= 0 ? '+' : ''}
                  {stats.variacionVsMesAnterior.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Promedio anual: {formatCurrency(stats.promedioMensualAnioActual)}
                </div>
              </div>
              {stats.variacionVsMesAnterior >= 0 ? (
                <TrendingUp className="h-8 w-8 text-danger-400" />
              ) : (
                <TrendingDown className="h-8 w-8 text-success-400" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Resumen por Tipo de Gasto */}
      {resumenPorTipo.items.length > 0 && (
        <Card padding="md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary-500" />
                <span className="font-medium text-gray-900">Distribución por Tipo de Gasto</span>
              </div>
              <span className="text-sm text-gray-500">
                Total: {formatCurrency(resumenPorTipo.totalGeneral)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {resumenPorTipo.items.map((item, index) => {
                // Colores para las barras de progreso
                const colores = [
                  'bg-primary-500',
                  'bg-success-500',
                  'bg-warning-500',
                  'bg-info-500',
                  'bg-purple-500',
                  'bg-pink-500',
                  'bg-orange-500',
                  'bg-teal-500'
                ];
                const colorBarra = colores[index % colores.length];

                return (
                  <div
                    key={item.tipo}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-primary-200 transition-colors cursor-pointer"
                    onClick={() => setFiltros({ ...filtros, tipo: item.tipo as TipoGasto })}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 truncate" title={item.tipo}>
                        {item.tipo}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {item.cantidad} {item.cantidad === 1 ? 'gasto' : 'gastos'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        {item.porcentaje.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${colorBarra} h-2 rounded-full transition-all`}
                        style={{ width: `${Math.min(item.porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card padding="md">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-700">Filtros</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select
              label="Clase"
              value={filtros.claseGasto}
              onChange={(e) => setFiltros({ ...filtros, claseGasto: e.target.value as ClaseGasto | '' })}
              options={[
                { value: '', label: 'Todas' },
                { value: 'GVD', label: 'GVD - Venta y Distribución' },
                { value: 'GAO', label: 'GAO - Admin. y Operativo' }
              ]}
            />

            <Select
              label="Tipo"
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value as TipoGasto | '' })}
              options={[
                { value: '', label: 'Todos' },
                ...tiposUnicos.map(tipo => ({ value: tipo, label: tipo }))
              ]}
            />

            <Select
              label="Categoría"
              value={filtros.categoria}
              onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value as CategoriaGasto | '' })}
              options={[
                { value: '', label: 'Todas' },
                { value: 'GV', label: 'GV - Venta' },
                { value: 'GD', label: 'GD - Distribución' },
                { value: 'GA', label: 'GA - Administrativo' },
                { value: 'GO', label: 'GO - Operativo' }
              ]}
            />

            <Select
              label="Estado"
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as EstadoGasto | '' })}
              options={[
                { value: '', label: 'Todos' },
                { value: 'pendiente', label: 'Pendiente' },
                { value: 'pagado', label: 'Pagado' },
                { value: 'cancelado', label: 'Cancelado' }
              ]}
            />

            <Select
              label="Prorrateable"
              value={filtros.esProrrateable}
              onChange={(e) => setFiltros({ ...filtros, esProrrateable: e.target.value as 'true' | 'false' | '' })}
              options={[
                { value: '', label: 'Todos' },
                { value: 'true', label: 'Sí (CTRU)' },
                { value: 'false', label: 'No' }
              ]}
            />
          </div>

          {(filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado || filtros.esProrrateable) && (
            <button
              onClick={limpiarFiltros}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Tabla de Gastos */}
      <Card padding="md">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <TableRowSkeleton columns={6} rows={8} />
              </tbody>
            </table>
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <EmptyStateAction
            title={filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado
              ? 'No se encontraron gastos'
              : 'No hay gastos registrados'}
            description={filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado
              ? 'Prueba con otros filtros o limpia los filtros actuales'
              : 'Comienza registrando un nuevo gasto operativo'}
            variant={filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado ? 'no-results' : 'no-data'}
            icon={filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado ? 'search' : 'file'}
            actionLabel={filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado ? 'Limpiar Filtros' : 'Nuevo Gasto'}
            onAction={filtros.claseGasto || filtros.tipo || filtros.categoria || filtros.estado ? limpiarFiltros : () => setShowModal(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo / Categoría
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    CTRU
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {gastosFiltrados.map((gasto) => {
                  const estadoBadge = getEstadoBadge(gasto.estado);
                  const tipoBadge = getTipoBadge(gasto.tipo);
                  const claseBadge = getClaseBadge(gasto.claseGasto);

                  return (
                    <tr key={gasto.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${claseBadge.color}`}>
                            {claseBadge.label}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {gasto.numeroGasto}
                          </span>
                        </div>
                        {gasto.ventaId && (
                          <div className="text-xs text-purple-600 mt-0.5">
                            → Venta vinculada
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{gasto.descripcion}</div>
                        {gasto.proveedor && (
                          <div className="text-xs text-gray-500">{gasto.proveedor}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">{gasto.tipo}</div>
                          <div className="flex items-center gap-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getCategoriaColor(gasto.categoria)}`}>
                              {gasto.categoria}
                            </span>
                            <span className="text-xs text-gray-500">
                              {CATEGORIAS_GASTO[gasto.categoria]?.nombre || gasto.categoria}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(gasto.montoPEN)}
                        </div>
                        {gasto.moneda === 'USD' && (
                          <div className="text-xs text-gray-500">
                            ${gasto.montoOriginal.toFixed(2)} USD
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {formatFecha(gasto.fecha)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Badge variant={estadoBadge.variant}>{estadoBadge.label}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {gasto.esProrrateable ? (
                          <Badge variant={gasto.ctruRecalculado ? 'success' : 'warning'}>
                            {gasto.ctruRecalculado ? 'Aplicado' : 'Pendiente'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {gasto.estado === 'pendiente' && (
                          <button
                            onClick={() => {
                              setGastoParaPago(gasto);
                              setShowPagoModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                            title="Registrar pago"
                          >
                            <CreditCard className="h-4 w-4" />
                            Pagar
                          </button>
                        )}
                        {gasto.estado === 'pagado' && (
                          <span className="text-xs text-gray-400">
                            {gasto.metodoPago || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && gastosFiltrados.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <ListSummary
              filteredCount={gastosFiltrados.length}
              totalCount={gastos.length}
              itemLabel="gastos"
              summaryItems={[
                {
                  label: 'Total',
                  value: formatCurrency(resumenPorTipo.totalGeneral),
                  icon: 'money',
                  variant: 'default'
                },
                {
                  label: 'Pendientes',
                  value: gastosFiltrados.filter(g => g.estado === 'pendiente').length,
                  icon: 'file',
                  variant: 'warning'
                }
              ]}
            />
          </div>
        )}
      </Card>

      {/* Modal Formulario Nuevo Gasto */}
      {showModal && <GastoForm onClose={() => setShowModal(false)} />}

      {/* Modal Formulario Pago de Gasto */}
      {showPagoModal && gastoParaPago && (
        <PagoGastoForm
          gasto={gastoParaPago}
          onClose={() => {
            setShowPagoModal(false);
            setGastoParaPago(null);
          }}
          onSuccess={() => {
            setShowPagoModal(false);
            setGastoParaPago(null);
            fetchGastosMesActual();
            fetchStats();
          }}
        />
      )}

      {/* Dialogo de Confirmacion */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
