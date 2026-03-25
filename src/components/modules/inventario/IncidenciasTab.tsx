import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  Package,
  Trash2,
  Heart,
  ExternalLink,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Card, Button, Badge } from '../../common';
import { bajaInventarioService } from '../../../services/bajaInventario.service';
import { useProductoStore } from '../../../store/productoStore';
import { useToastStore } from '../../../store/toastStore';
import { calcularDiasParaVencer } from '../../../utils/dateFormatters';
import { formatCurrency } from '../../../utils/format';
import type { Unidad } from '../../../types/unidad.types';

type FiltroIncidencia = 'todas' | 'vencidas' | 'danadas';

interface IncidenciasTabProps {
  onOpenVencidasModal: () => void;
  onOpenDanadasModal?: (transferenciaId: string) => void;
  onRefresh: () => void;
}

export const IncidenciasTab: React.FC<IncidenciasTabProps> = ({
  onOpenVencidasModal,
  onOpenDanadasModal,
  onRefresh,
}) => {
  const toast = useToastStore();
  const productos = useProductoStore(s => s.productos);
  const [filtro, setFiltro] = useState<FiltroIncidencia>('todas');
  const [danadas, setDanadas] = useState<Unidad[]>([]);
  const [vencidas, setVencidas] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIncidencias = async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([
        bajaInventarioService.getUnidadesDanadasPendientes(),
        bajaInventarioService.getUnidadesVencidasPendientes(),
      ]);
      setDanadas(d as Unidad[]);
      setVencidas(v as Unidad[]);
    } catch (e: any) {
      toast.error('Error cargando incidencias: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIncidencias(); }, []);

  const productoMap = useMemo(() => {
    const map = new Map<string, { marca: string; nombre: string; sku: string }>();
    productos.forEach(p => map.set(p.id, { marca: p.marca, nombre: p.nombreComercial, sku: p.sku }));
    return map;
  }, [productos]);

  const items = useMemo(() => {
    const all: (Unidad & { tipo: 'vencida' | 'danada' })[] = [
      ...vencidas.map(u => ({ ...u, tipo: 'vencida' as const })),
      ...danadas.map(u => ({ ...u, tipo: 'danada' as const })),
    ];

    // Sort: vencidas primero (más críticas), luego por fecha
    all.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'vencida' ? -1 : 1;
      const aTime = a.fechaVencimiento?.seconds || 0;
      const bTime = b.fechaVencimiento?.seconds || 0;
      return aTime - bTime;
    });

    if (filtro === 'vencidas') return all.filter(i => i.tipo === 'vencida');
    if (filtro === 'danadas') return all.filter(i => i.tipo === 'danada');
    return all;
  }, [vencidas, danadas, filtro]);

  const totalVencidas = vencidas.length;
  const totalDanadas = danadas.length;
  const totalIncidencias = totalVencidas + totalDanadas;

  const costoTotalRiesgo = useMemo(() => {
    return [...vencidas, ...danadas].reduce((sum, u) => sum + (u.ctruInicial || u.costoUnitarioUSD || 0), 0);
  }, [vencidas, danadas]);

  if (loading) {
    return (
      <Card padding="lg">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando incidencias...</span>
        </div>
      </Card>
    );
  }

  if (totalIncidencias === 0) {
    return (
      <Card padding="lg">
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-green-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-700">Sin incidencias pendientes</h3>
          <p className="text-sm text-gray-500 mt-1">No hay unidades dañadas ni vencidas por gestionar.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs de incidencias */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{totalIncidencias}</p>
            <p className="text-xs text-gray-500">Total pendientes</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{totalVencidas}</p>
            <p className="text-xs text-gray-500">Vencidas</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-500">{totalDanadas}</p>
            <p className="text-xs text-gray-500">Dañadas</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{formatCurrency(costoTotalRiesgo, 'USD')}</p>
            <p className="text-xs text-gray-500">Valor en riesgo</p>
          </div>
        </Card>
      </div>

      {/* Filtro rápido */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {(['todas', 'vencidas', 'danadas'] as FiltroIncidencia[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filtro === f
                ? f === 'vencidas' ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                : f === 'danadas' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                : 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'todas' ? `Todas (${totalIncidencias})` :
             f === 'vencidas' ? `Vencidas (${totalVencidas})` :
             `Dañadas (${totalDanadas})`}
          </button>
        ))}

        <button
          type="button"
          onClick={() => { loadIncidencias(); onRefresh(); }}
          className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          title="Refrescar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Lista de incidencias */}
      <div className="space-y-3">
        {items.map(item => {
          const prod = productoMap.get(item.productoId);
          const diasVencido = item.fechaVencimiento
            ? calcularDiasParaVencer(item.fechaVencimiento)
            : null;

          return (
            <Card key={item.id} padding="sm">
              <div className="flex items-start gap-3">
                {/* Icono tipo */}
                <div className={`p-2 rounded-lg shrink-0 ${
                  item.tipo === 'vencida' ? 'bg-red-100' : 'bg-amber-100'
                }`}>
                  {item.tipo === 'vencida'
                    ? <Clock className="h-4 w-4 text-red-600" />
                    : <AlertTriangle className="h-4 w-4 text-amber-600" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {prod?.marca || 'Sin marca'} — {prod?.nombre || 'Sin nombre'}
                    </span>
                    <Badge
                      variant={item.tipo === 'vencida' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {item.tipo === 'vencida' ? 'Vencida' : 'Dañada'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>SKU: {prod?.sku || item.productoSKU || '—'}</span>
                    {item.tipo === 'vencida' && diasVencido !== null && (
                      <span className="text-red-500">
                        Venció hace {Math.abs(diasVencido)} días
                      </span>
                    )}
                    {item.costoUnitarioUSD && (
                      <span>Costo: {formatCurrency(item.costoUnitarioUSD, 'USD')}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {totalVencidas > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={onOpenVencidasModal}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Gestionar vencidas ({totalVencidas})
          </Button>
        )}
        {totalDanadas > 0 && onOpenDanadasModal && (
          <Button
            variant="warning"
            size="sm"
            onClick={() => {
              // Navigate to transferencias — dañadas are managed there
              toast.info('Las unidades dañadas se gestionan desde Transferencias');
            }}
            className="flex-1"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Ver dañadas en Transferencias ({totalDanadas})
          </Button>
        )}
      </div>
    </div>
  );
};
