import React, { useMemo, useState } from 'react';
import { formatFecha, calcularDiasParaVencer as calcularDiasParaVencerUtil } from '../../../../utils/dateFormatters';
import { formatCurrency } from '../../../../utils/format';
import { Package, MapPin, Eye } from 'lucide-react';
import { Badge } from '../../../../components/common';
import { DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import type { Unidad, EstadoUnidad } from '../../../../types/unidad.types';
import { getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen, getPaisEmoji } from '../../../../utils/multiOrigen.helpers';

interface UnidadesDesgloseProps {
  unidades: Unidad[];
  productoNombre: string;
  onUnidadClick?: (unidad: Unidad) => void;
}

const getEstadoConfig = (estado: EstadoUnidad, pais?: string): { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'default'; color: string } => {
  const label = getLabelEstadoUnidad(estado, pais);
  if (esEstadoEnOrigen(estado)) return { label, variant: 'info', color: 'bg-sky-100 text-sky-800' };
  if (esEstadoEnTransitoOrigen(estado)) return { label, variant: 'warning', color: 'bg-amber-100 text-amber-800' };
  switch (estado) {
    case 'en_transito_peru': return { label, variant: 'warning', color: 'bg-amber-100 text-amber-800' };
    case 'disponible_peru': return { label, variant: 'success', color: 'bg-emerald-100 text-emerald-800' };
    case 'reservada': return { label, variant: 'default', color: 'bg-purple-100 text-purple-800' };
    case 'asignada_pedido': return { label, variant: 'warning', color: 'bg-teal-100 text-teal-800' };
    case 'vendida': return { label, variant: 'default', color: 'bg-slate-100 text-slate-800' };
    case 'vencida': return { label, variant: 'danger', color: 'bg-red-100 text-red-800' };
    case 'danada': return { label, variant: 'danger', color: 'bg-red-100 text-red-800' };
    default: return { label, variant: 'default', color: 'bg-slate-100 text-slate-800' };
  }
};

export const UnidadesDesglose: React.FC<UnidadesDesgloseProps> = ({
  unidades,
  productoNombre,
  onUnidadClick
}) => {
  const [vistaAgrupada, setVistaAgrupada] = useState(true);

  // Agrupar unidades por estado y almacén
  const unidadesAgrupadas = useMemo(() => {
    const grupos: Record<string, {
      estado: EstadoUnidad;
      almacenId: string;
      almacenNombre: string;
      pais: string;
      unidades: Unidad[];
      valorTotal: number;
    }> = {};

    unidades.forEach(unidad => {
      const key = `${unidad.estado}-${unidad.almacenId}`;
      if (!grupos[key]) {
        grupos[key] = {
          estado: unidad.estado,
          almacenId: unidad.almacenId || '',
          almacenNombre: unidad.almacenNombre || '',
          pais: unidad.pais,
          unidades: [],
          valorTotal: 0
        };
      }
      grupos[key].unidades.push(unidad);
      grupos[key].valorTotal += unidad.costoUnitarioUSD;
    });

    // Ordenar por estado (primero disponibles)
    const ordenEstados: EstadoUnidad[] = [
      'disponible_peru', 'recibida_usa', 'en_transito_peru', 'en_transito_usa',
      'reservada', 'vendida', 'vencida', 'danada'
    ];

    return Object.values(grupos).sort((a, b) => {
      return ordenEstados.indexOf(a.estado) - ordenEstados.indexOf(b.estado);
    });
  }, [unidades]);

  const getColorVencimiento = (dias: number): string => {
    if (dias < 0) return 'text-red-600 bg-red-50';
    if (dias <= 30) return 'text-amber-600 bg-amber-50';
    if (dias <= 90) return 'text-yellow-600 bg-yellow-50';
    return 'text-slate-600 bg-slate-50';
  };


  // formatCurrency importado de utils/format (USD por defecto)

  if (unidades.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-slate-500">
        <Package className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">No hay unidades que mostrar para este filtro</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {/* Header del desglose */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {unidades.length} unidades de {productoNombre}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVistaAgrupada(true)}
            className={`text-xs px-2 py-1 rounded ${
              vistaAgrupada
                ? 'bg-teal-100 text-teal-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Agrupada
          </button>
          <button
            onClick={() => setVistaAgrupada(false)}
            className={`text-xs px-2 py-1 rounded ${
              !vistaAgrupada
                ? 'bg-teal-100 text-teal-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Detallada
          </button>
        </div>
      </div>

      {vistaAgrupada ? (
        /* Vista agrupada por estado/almacén */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {unidadesAgrupadas.map((grupo) => {
            const config = getEstadoConfig(grupo.estado, grupo.unidades[0]?.paisOrigen || grupo.pais);

            return (
              <div
                key={`${grupo.estado}-${grupo.almacenId}`}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={config.variant} size="sm">
                    {config.label}
                  </Badge>
                  <span className="text-lg font-bold text-slate-900">
                    {grupo.unidades.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  <span>{getPaisEmoji(grupo.pais)} {grupo.almacenNombre}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Valor total:</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(grupo.valorTotal)}
                  </span>
                </div>

                {/* Mini lista de lotes */}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">Lotes:</div>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(grupo.unidades.map(u => u.lote))].slice(0, 3).map(lote => (
                      <span
                        key={lote}
                        className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                      >
                        {lote}
                      </span>
                    ))}
                    {[...new Set(grupo.unidades.map(u => u.lote))].length > 3 && (
                      <span className="text-xs text-slate-400">
                        +{[...new Set(grupo.unidades.map(u => u.lote))].length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista detallada - tabla de unidades individuales */
        (() => {
          const unidadesOrdenadas = [...unidades].sort((a, b) => {
            const fechaA = a.fechaVencimiento?.toDate?.()?.getTime() || Infinity;
            const fechaB = b.fechaVencimiento?.toDate?.()?.getTime() || Infinity;
            return fechaA - fechaB;
          });

          const columnasDetalle: DataTableColumn<Unidad>[] = [
            {
              key: 'lote',
              header: 'Lote',
              render: (unidad) => {
                const idx = unidadesOrdenadas.indexOf(unidad);
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">#{idx + 1}</span>
                    <span className="text-sm font-mono text-slate-900">{unidad.lote}</span>
                  </div>
                );
              },
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (unidad) => {
                const config = getEstadoConfig(unidad.estado, unidad.paisOrigen || unidad.pais);
                return (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.color}`}>
                    {config.label}
                  </span>
                );
              },
            },
            {
              key: 'almacen',
              header: 'Almacén',
              render: (unidad) => (
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <span>{getPaisEmoji(unidad.pais)}</span>
                  <span className="truncate max-w-[100px]">{unidad.almacenNombre}</span>
                </div>
              ),
            },
            {
              key: 'vencimiento',
              header: 'Vencimiento',
              render: (unidad) => {
                const diasVencer = calcularDiasParaVencerUtil(unidad.fechaVencimiento) ?? 999;
                const colorVencimiento = getColorVencimiento(diasVencer);
                return (
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-900">
                      {formatFecha(unidad.fechaVencimiento)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${colorVencimiento}`}>
                      {diasVencer < 0
                        ? `Vencido hace ${Math.abs(diasVencer)}d`
                        : diasVencer === 0
                          ? 'Vence hoy'
                          : `${diasVencer}d restantes`
                      }
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'costoUSD',
              header: 'Costo USD',
              align: 'right',
              render: (unidad) => (
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(unidad.costoUnitarioUSD)}
                </span>
              ),
            },
            ...(onUnidadClick ? [{
              key: 'accion',
              header: 'Acción',
              align: 'right' as const,
              render: (unidad: Unidad) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnidadClick(unidad);
                  }}
                  className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded"
                >
                  <Eye className="h-4 w-4" />
                </button>
              ),
            }] : []),
          ];

          return (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <DataTable
                  columns={columnasDetalle}
                  data={unidadesOrdenadas}
                  keyExtractor={u => u.id}
                  onRowClick={onUnidadClick}
                  compact
                  stickyHeader
                />
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
