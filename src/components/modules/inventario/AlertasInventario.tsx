import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Package,
  Filter,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Megaphone,
  Calendar,
  DollarSign,
  Lightbulb,
  Percent
} from 'lucide-react';
import { Card, Badge, Button, Select, SearchInput, StatCard } from '../../common';
import type { Unidad } from '../../../types/unidad.types';
import type { Producto } from '../../../types/producto.types';

interface AlertasInventarioProps {
  unidades: Unidad[];
  productos: Producto[];
  onVerProducto?: (productoId: string) => void;
  onPromocionar?: (productoId: string) => void;
}

type TipoAlerta = 'vencimiento' | 'stock_critico' | 'sin_movimiento' | 'todos';
type PrioridadAlerta = 'alta' | 'media' | 'baja';

interface AlertaInventario {
  id: string;
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  tipo: 'vencimiento' | 'stock_critico' | 'sin_movimiento';
  prioridad: PrioridadAlerta;
  mensaje: string;
  detalle: string;
  unidadesAfectadas: number;
  valorAfectado: number;
  diasRestantes?: number;
  // Sugerencias de acción
  descuentoSugerido?: number;
  valorConDescuento?: number;
  sugerencia?: string;
}

// Calcular descuento sugerido basado en días restantes o tipo de alerta
const calcularDescuentoSugerido = (tipo: string, diasRestantes?: number): { descuento: number; sugerencia: string } => {
  if (tipo === 'vencimiento' && diasRestantes !== undefined) {
    if (diasRestantes <= 7) {
      return { descuento: 40, sugerencia: 'Venta urgente recomendada. Considerar bundle o promoción flash.' };
    } else if (diasRestantes <= 15) {
      return { descuento: 30, sugerencia: 'Promoción activa recomendada. Destacar en redes sociales.' };
    } else if (diasRestantes <= 30) {
      return { descuento: 20, sugerencia: 'Descuento preventivo. Incluir en ofertas semanales.' };
    } else {
      return { descuento: 10, sugerencia: 'Descuento suave para acelerar rotación.' };
    }
  } else if (tipo === 'sin_movimiento') {
    if (diasRestantes && diasRestantes > 180) {
      return { descuento: 40, sugerencia: 'Capital muy estancado. Liquidar para reinvertir.' };
    } else if (diasRestantes && diasRestantes > 120) {
      return { descuento: 30, sugerencia: 'Producto estancado. Promoción agresiva recomendada.' };
    } else {
      return { descuento: 20, sugerencia: 'Sin movimiento. Incluir en combos o bundles.' };
    }
  }
  return { descuento: 0, sugerencia: '' };
};

// Helper para calcular días hasta vencimiento
const calcularDiasParaVencer = (fecha: any): number | null => {
  if (!fecha || !fecha.toDate) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = fecha.toDate();
  vencimiento.setHours(0, 0, 0, 0);
  const diffTime = vencimiento.getTime() - hoy.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper para calcular días desde creación
const calcularDiasDesde = (fecha: any): number => {
  if (!fecha || !fecha.toDate) return 0;
  const hoy = new Date();
  const fechaDate = fecha.toDate();
  const diffTime = Math.abs(hoy.getTime() - fechaDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const alertaConfig = {
  vencimiento: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeVariant: 'warning' as const,
    label: 'Vencimiento'
  },
  stock_critico: {
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeVariant: 'danger' as const,
    label: 'Stock Crítico'
  },
  sin_movimiento: {
    icon: Package,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeVariant: 'default' as const,
    label: 'Sin Movimiento'
  }
};

const prioridadConfig = {
  alta: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'ALTA' },
  media: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'MEDIA' },
  baja: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'BAJA' }
};

export const AlertasInventario: React.FC<AlertasInventarioProps> = ({
  unidades,
  productos,
  onVerProducto,
  onPromocionar
}) => {
  const [filtroTipo, setFiltroTipo] = useState<TipoAlerta>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadAlerta | ''>('');
  const [busqueda, setBusqueda] = useState('');

  // Filtrar solo unidades activas
  const unidadesActivas = useMemo(() =>
    unidades.filter(u => u.estado !== 'vendida'),
    [unidades]
  );

  // Generar todas las alertas
  const alertas = useMemo((): AlertaInventario[] => {
    const resultado: AlertaInventario[] = [];
    const productosMap: Record<string, {
      unidades: Unidad[];
      producto?: Producto;
      valorTotal: number;
      diasMasAntiguo: number;
    }> = {};

    // Agrupar por producto
    unidadesActivas.forEach(u => {
      if (!productosMap[u.productoId]) {
        productosMap[u.productoId] = {
          unidades: [],
          producto: productos.find(p => p.id === u.productoId),
          valorTotal: 0,
          diasMasAntiguo: 0
        };
      }
      productosMap[u.productoId].unidades.push(u);
      productosMap[u.productoId].valorTotal += u.costoUnitarioUSD;

      const diasDesde = calcularDiasDesde(u.fechaCreacion);
      if (diasDesde > productosMap[u.productoId].diasMasAntiguo) {
        productosMap[u.productoId].diasMasAntiguo = diasDesde;
      }
    });

    // Generar alertas por producto
    Object.entries(productosMap).forEach(([productoId, data]) => {
      const { unidades: uds, producto, valorTotal, diasMasAntiguo } = data;
      const sku = uds[0]?.productoSKU || '';
      const nombre = uds[0]?.productoNombre || '';
      const marca = producto?.marca || '';

      // Alertas de vencimiento
      const unidadesPorVencer = uds.filter(u => {
        const dias = calcularDiasParaVencer(u.fechaVencimiento);
        return dias !== null && dias >= 0 && dias <= 60;
      });

      if (unidadesPorVencer.length > 0) {
        const menorDias = Math.min(
          ...unidadesPorVencer.map(u => calcularDiasParaVencer(u.fechaVencimiento) || 999)
        );
        const valorVencimiento = unidadesPorVencer.reduce((s, u) => s + u.costoUnitarioUSD, 0);
        const { descuento, sugerencia } = calcularDescuentoSugerido('vencimiento', menorDias);

        resultado.push({
          id: `venc-${productoId}`,
          productoId,
          sku,
          nombre,
          marca,
          tipo: 'vencimiento',
          prioridad: menorDias <= 7 ? 'alta' : menorDias <= 30 ? 'media' : 'baja',
          mensaje: menorDias <= 7
            ? `¡Vence en ${menorDias} días! Acción urgente requerida`
            : menorDias <= 30
              ? `Vencimiento próximo en ${menorDias} días`
              : `Vencimiento en ${menorDias} días`,
          detalle: `${unidadesPorVencer.length} unidad${unidadesPorVencer.length !== 1 ? 'es' : ''} por vencer`,
          unidadesAfectadas: unidadesPorVencer.length,
          valorAfectado: valorVencimiento,
          diasRestantes: menorDias,
          descuentoSugerido: descuento,
          valorConDescuento: valorVencimiento * (1 - descuento / 100),
          sugerencia
        });
      }

      // Alertas de stock crítico
      if (producto?.stockMinimo !== undefined && uds.length <= producto.stockMinimo) {
        resultado.push({
          id: `stock-${productoId}`,
          productoId,
          sku,
          nombre,
          marca,
          tipo: 'stock_critico',
          prioridad: uds.length === 0 ? 'alta' : 'media',
          mensaje: uds.length === 0
            ? 'Sin stock disponible. Reordenar urgente'
            : `Stock por debajo del mínimo (${producto.stockMinimo})`,
          detalle: `${uds.length} de ${producto.stockMinimo} unidades mínimas`,
          unidadesAfectadas: uds.length,
          valorAfectado: valorTotal
        });
      }

      // Alertas de sin movimiento (>90 días)
      if (diasMasAntiguo > 90) {
        const { descuento, sugerencia } = calcularDescuentoSugerido('sin_movimiento', diasMasAntiguo);

        resultado.push({
          id: `mov-${productoId}`,
          productoId,
          sku,
          nombre,
          marca,
          tipo: 'sin_movimiento',
          prioridad: diasMasAntiguo > 180 ? 'alta' : diasMasAntiguo > 120 ? 'media' : 'baja',
          mensaje: `${diasMasAntiguo} días sin movimiento`,
          detalle: 'Capital inmovilizado. Considerar liquidación',
          unidadesAfectadas: uds.length,
          valorAfectado: valorTotal,
          diasRestantes: diasMasAntiguo,
          descuentoSugerido: descuento,
          valorConDescuento: valorTotal * (1 - descuento / 100),
          sugerencia
        });
      }
    });

    // Ordenar por prioridad y tipo
    return resultado.sort((a, b) => {
      const prioridadOrder = { alta: 0, media: 1, baja: 2 };
      const diff = prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
      if (diff !== 0) return diff;
      const tipoOrder = { vencimiento: 0, stock_critico: 1, sin_movimiento: 2 };
      return tipoOrder[a.tipo] - tipoOrder[b.tipo];
    });
  }, [unidadesActivas, productos]);

  // Filtrar alertas
  const alertasFiltradas = useMemo(() => {
    let resultado = alertas;

    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(a => a.tipo === filtroTipo);
    }

    if (filtroPrioridad) {
      resultado = resultado.filter(a => a.prioridad === filtroPrioridad);
    }

    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(a => {
        const sku = (a.sku ?? '').toLowerCase();
        const nombre = (a.nombre ?? '').toLowerCase();
        const marca = (a.marca ?? '').toLowerCase();
        return sku.includes(termino) || nombre.includes(termino) || marca.includes(termino);
      });
    }

    return resultado;
  }, [alertas, filtroTipo, filtroPrioridad, busqueda]);

  // Contadores
  const contadores = useMemo(() => ({
    total: alertas.length,
    vencimiento: alertas.filter(a => a.tipo === 'vencimiento').length,
    stock_critico: alertas.filter(a => a.tipo === 'stock_critico').length,
    sin_movimiento: alertas.filter(a => a.tipo === 'sin_movimiento').length,
    alta: alertas.filter(a => a.prioridad === 'alta').length,
    media: alertas.filter(a => a.prioridad === 'media').length,
    baja: alertas.filter(a => a.prioridad === 'baja').length,
    valorTotal: alertas.reduce((s, a) => s + a.valorAfectado, 0)
  }), [alertas]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const limpiarFiltros = () => {
    setFiltroTipo('todos');
    setFiltroPrioridad('');
    setBusqueda('');
  };

  const hayFiltrosActivos = filtroTipo !== 'todos' || filtroPrioridad !== '' || busqueda.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Resumen de Alertas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Alertas Activas"
          value={contadores.total}
          icon={Bell}
          variant={contadores.alta > 0 ? 'red' : contadores.total > 0 ? 'amber' : 'default'}
        />
        <StatCard
          label="Prioridad Alta"
          value={contadores.alta}
          icon={AlertTriangle}
          variant={contadores.alta > 0 ? 'red' : 'default'}
          onClick={() => setFiltroPrioridad(filtroPrioridad === 'alta' ? '' : 'alta')}
          active={filtroPrioridad === 'alta'}
        />
        <StatCard
          label="Por Vencer"
          value={contadores.vencimiento}
          icon={Clock}
          variant={contadores.vencimiento > 0 ? 'amber' : 'default'}
          onClick={() => setFiltroTipo(filtroTipo === 'vencimiento' ? 'todos' : 'vencimiento')}
          active={filtroTipo === 'vencimiento'}
        />
        <StatCard
          label="Valor en Riesgo"
          value={formatCurrency(contadores.valorTotal)}
          icon={DollarSign}
          variant="default"
        />
      </div>

      {/* Filtros */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <Select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoAlerta)}
              options={[
                { value: 'todos', label: 'Todos los tipos' },
                { value: 'vencimiento', label: `Vencimiento (${contadores.vencimiento})` },
                { value: 'stock_critico', label: `Stock Crítico (${contadores.stock_critico})` },
                { value: 'sin_movimiento', label: `Sin Movimiento (${contadores.sin_movimiento})` }
              ]}
              className="w-48"
            />

            <Select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value as PrioridadAlerta | '')}
              options={[
                { value: '', label: 'Todas las prioridades' },
                { value: 'alta', label: `Alta (${contadores.alta})` },
                { value: 'media', label: `Media (${contadores.media})` },
                { value: 'baja', label: `Baja (${contadores.baja})` }
              ]}
              className="w-44"
            />

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar SKU, nombre..."
            className="w-64"
          />
        </div>
      </Card>

      {/* Lista de Alertas */}
      {alertasFiltradas.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {hayFiltrosActivos ? 'No hay alertas con esos criterios' : 'Todo en orden'}
            </h3>
            <p className="mt-2 text-gray-500">
              {hayFiltrosActivos
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No hay alertas prioritarias en este momento'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alertasFiltradas.map((alerta) => {
            const config = alertaConfig[alerta.tipo];
            const prioridad = prioridadConfig[alerta.prioridad];
            const Icon = config.icon;

            return (
              <Card
                key={alerta.id}
                padding="md"
                className={`${config.bgColor} ${config.borderColor} border-2 hover:shadow-lg transition-all`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-white/50`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <Badge variant={config.badgeVariant} size="sm">
                      {config.label}
                    </Badge>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${prioridad.bgColor} ${prioridad.color}`}>
                    {prioridad.label}
                  </span>
                </div>

                {/* Producto Info */}
                <div className="mb-3">
                  <div className="font-mono text-sm font-bold text-gray-900">
                    {alerta.sku}
                  </div>
                  <div className="text-sm text-gray-700 truncate">
                    {alerta.marca && `${alerta.marca} · `}{alerta.nombre}
                  </div>
                </div>

                {/* Mensaje de alerta */}
                <div className="mb-4 p-3 bg-white/70 rounded-lg">
                  <div className="text-sm font-medium text-gray-800">{alerta.mensaje}</div>
                  <div className="text-xs text-gray-600 mt-1">{alerta.detalle}</div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{alerta.unidadesAfectadas}</div>
                    <div className="text-xs text-gray-600">unidades</div>
                  </div>
                  <div className="bg-white/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(alerta.valorAfectado)}</div>
                    <div className="text-xs text-gray-600">valor en riesgo</div>
                  </div>
                </div>

                {/* Sugerencia de Acción - Solo para vencimiento y sin_movimiento */}
                {alerta.descuentoSugerido && alerta.descuentoSugerido > 0 && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs font-medium text-green-800">
                        Sugerencia: Aplicar <span className="font-bold text-green-700">{alerta.descuentoSugerido}% descuento</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="text-center bg-white/60 rounded p-1.5">
                        <div className="text-xs text-gray-500 line-through">{formatCurrency(alerta.valorAfectado)}</div>
                        <div className="text-sm font-bold text-green-700">{formatCurrency(alerta.valorConDescuento || 0)}</div>
                        <div className="text-xs text-green-600">recuperas</div>
                      </div>
                      <div className="text-center bg-white/60 rounded p-1.5">
                        <div className="text-sm font-bold text-amber-600">
                          -{alerta.descuentoSugerido}%
                        </div>
                        <div className="text-xs text-gray-600">descuento</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 italic">
                      {alerta.sugerencia}
                    </p>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex items-center gap-2">
                  {onVerProducto && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onVerProducto(alerta.productoId)}
                      className="flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                  )}
                  {alerta.tipo === 'vencimiento' && onPromocionar && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onPromocionar(alerta.productoId)}
                      className="flex-1"
                    >
                      <Megaphone className="h-3.5 w-3.5 mr-1" />
                      Promocionar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resumen al pie */}
      {alertasFiltradas.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Mostrando <span className="font-medium">{alertasFiltradas.length}</span> de{' '}
          <span className="font-medium">{alertas.length}</span> alertas
        </div>
      )}
    </div>
  );
};

export default AlertasInventario;
