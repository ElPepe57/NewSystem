/**
 * TabIncidencias — S40 Bloque D
 *
 * Vista maestra de TODAS las incidencias de envíos (no solo un envío abierto).
 * Permite auditar el backlog operativo completo desde un solo lugar.
 *
 * Filtros: tipo (dañada/perdida/aduana/otro), estado (abierta/resuelta), envío, período.
 * Click en una fila → abre EnvioDetailModal o GestionIncidenciasModal del envío respectivo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Package,
  XCircle,
  ShieldAlert,
  HelpCircle,
  Filter as FilterIcon,
} from 'lucide-react';
import { DataTable, StatCard } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { Badge, Button, SearchInput } from '../../components/common';
import { useEnvioStore } from '../../store/envioStore';
import { useProductoStore } from '../../store/productoStore';
import type { Envio, IncidenciaEnvio } from '../../types/envio.types';
import { GestionIncidenciasModal } from './GestionIncidenciasModal';

type FiltroTipo = 'todos' | 'danada' | 'faltante' | 'aduana' | 'otro';
type FiltroEstadoInc = 'abiertas' | 'resueltas' | 'todas';

interface IncidenciaRow {
  envio: Envio;
  incidencia: IncidenciaEnvio;
  // Campo derivado para facilitar filtrado/visualización
  tipoEfectivo: 'danada' | 'faltante' | 'aduana' | 'otro';
}

const TIPO_CONFIG: Record<'danada' | 'faltante' | 'aduana' | 'otro', { label: string; icon: React.ElementType; color: string; variant: 'warning' | 'danger' | 'info' | 'default' }> = {
  danada: { label: 'Dañada', icon: AlertTriangle, color: 'text-amber-600', variant: 'warning' },
  faltante: { label: 'Faltante/Perdida', icon: XCircle, color: 'text-red-600', variant: 'danger' },
  aduana: { label: 'Aduana', icon: ShieldAlert, color: 'text-orange-600', variant: 'info' },
  otro: { label: 'Otro', icon: HelpCircle, color: 'text-slate-500', variant: 'default' },
};

/**
 * Clasifica la incidencia en una categoría canónica.
 * Maneja legacy donde aduana iba como tipo='otro' con descripción "aduana".
 */
function clasificarIncidencia(inc: IncidenciaEnvio): IncidenciaRow['tipoEfectivo'] {
  // S40: simplificado — post-cleanup todas las incidencias usan tipos canónicos (sin fallback legacy)
  if (inc.tipo === 'aduana') return 'aduana';
  if (inc.tipo === 'danada') return 'danada';
  if (inc.tipo === 'faltante') return 'faltante';
  return 'otro';
}

export const TabIncidencias: React.FC = () => {
  const { envios, fetchEnvios } = useEnvioStore();
  const { productos, fetchProductos } = useProductoStore();

  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoInc>('abiertas');
  const [envioSeleccionado, setEnvioSeleccionado] = useState<Envio | null>(null);

  useEffect(() => {
    if (envios.length === 0) fetchEnvios();
    if (productos.length === 0) fetchProductos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const productosMap = useMemo(
    () => new Map(productos.map(p => [p.id, p])),
    [productos]
  );

  // Flatten: incidencias de todos los envíos
  const todasIncidencias = useMemo<IncidenciaRow[]>(() => {
    const rows: IncidenciaRow[] = [];
    for (const envio of envios) {
      for (const inc of (envio.incidencias || [])) {
        rows.push({
          envio,
          incidencia: inc,
          tipoEfectivo: clasificarIncidencia(inc),
        });
      }
    }
    // Orden default: abiertas primero, luego por fecha descendente
    return rows.sort((a, b) => {
      if (a.incidencia.resuelta !== b.incidencia.resuelta) {
        return a.incidencia.resuelta ? 1 : -1;
      }
      return b.incidencia.fechaRegistro.toMillis() - a.incidencia.fechaRegistro.toMillis();
    });
  }, [envios]);

  // KPIs
  const resumen = useMemo(() => {
    const todas = todasIncidencias;
    const abiertas = todas.filter(r => !r.incidencia.resuelta);
    const porTipo = {
      danada: abiertas.filter(r => r.tipoEfectivo === 'danada').length,
      faltante: abiertas.filter(r => r.tipoEfectivo === 'faltante').length,
      aduana: abiertas.filter(r => r.tipoEfectivo === 'aduana').length,
      otro: abiertas.filter(r => r.tipoEfectivo === 'otro').length,
    };
    return {
      totalAbiertas: abiertas.length,
      totalResueltas: todas.length - abiertas.length,
      ...porTipo,
    };
  }, [todasIncidencias]);

  // Filtrado
  const filtradas = useMemo(() => {
    let list = todasIncidencias;

    if (filtroEstado === 'abiertas') list = list.filter(r => !r.incidencia.resuelta);
    else if (filtroEstado === 'resueltas') list = list.filter(r => r.incidencia.resuelta);

    if (filtroTipo !== 'todos') list = list.filter(r => r.tipoEfectivo === filtroTipo);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.envio.numeroEnvio.toLowerCase().includes(q)
        || (r.incidencia.sku || '').toLowerCase().includes(q)
        || (r.incidencia.productoNombre || '').toLowerCase().includes(q)
        || (r.incidencia.descripcion || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [todasIncidencias, filtroEstado, filtroTipo, search]);

  const columnas: DataTableColumn<IncidenciaRow>[] = [
    {
      key: 'envio',
      header: 'Envío',
      width: '14%',
      render: r => (
        <div>
          <div className="font-medium text-slate-900 text-sm">{r.envio.numeroEnvio}</div>
          <div className="text-xs text-slate-500">
            {r.incidencia.fechaRegistro.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '12%',
      render: r => {
        const cfg = TIPO_CONFIG[r.tipoEfectivo];
        const Icon = cfg.icon;
        return (
          <div className="flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
            <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
          </div>
        );
      },
    },
    {
      key: 'producto',
      header: 'Producto',
      width: '28%',
      hideOnMobile: true,
      render: r => {
        const pFull = r.incidencia.productoId ? productosMap.get(r.incidencia.productoId) : undefined;
        return (
          <div className="text-sm">
            <div className="text-slate-800 truncate">
              {pFull?.nombreComercial || r.incidencia.productoNombre || r.incidencia.sku || '—'}
            </div>
            {r.incidencia.sku && (
              <div className="text-xs text-slate-500">{r.incidencia.sku}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      width: '22%',
      hideOnMobile: true,
      render: r => (
        <div className="text-xs text-slate-600 line-clamp-2">
          {r.incidencia.descripcion || '—'}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '12%',
      render: r => {
        const reclamo = r.incidencia.estadoReclamo;
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={r.incidencia.resuelta ? 'success' : 'warning'} size="sm">
              {r.incidencia.resuelta ? 'Resuelta' : 'Abierta'}
            </Badge>
            {reclamo && (
              <Badge variant={reclamo === 'cobrado' ? 'success' : reclamo === 'rechazado' ? 'danger' : 'default'} size="sm">
                Reclamo: {reclamo}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'accion',
      header: '',
      width: '12%',
      align: 'right',
      render: r => (
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setEnvioSeleccionado(r.envio); }}>
          Gestionar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
        <StatCard
          label="Abiertas"
          value={resumen.totalAbiertas}
          icon={AlertTriangle}
          variant={resumen.totalAbiertas > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Dañadas"
          value={resumen.danada}
          icon={AlertTriangle}
          variant={resumen.danada > 0 ? 'warning' : 'neutral'}
          onClick={() => { setFiltroTipo('danada'); setFiltroEstado('abiertas'); }}
        />
        <StatCard
          label="Perdidas"
          value={resumen.faltante}
          icon={XCircle}
          variant={resumen.faltante > 0 ? 'danger' : 'neutral'}
          onClick={() => { setFiltroTipo('faltante'); setFiltroEstado('abiertas'); }}
        />
        <StatCard
          label="Aduana"
          value={resumen.aduana}
          icon={ShieldAlert}
          variant={resumen.aduana > 0 ? 'info' : 'neutral'}
          onClick={() => { setFiltroTipo('aduana'); setFiltroEstado('abiertas'); }}
        />
        <StatCard
          label="Resueltas"
          value={resumen.totalResueltas}
          icon={Package}
          variant="success"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar envío, SKU, producto, descripción..."
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterIcon className="w-4 h-4 text-slate-400" />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="todos">Todos los tipos</option>
            <option value="danada">Dañadas</option>
            <option value="faltante">Perdidas</option>
            <option value="aduana">Aduana</option>
            <option value="otro">Otro</option>
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstadoInc)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="abiertas">Abiertas</option>
            <option value="resueltas">Resueltas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <DataTable<IncidenciaRow>
        data={filtradas}
        columns={columnas}
        keyExtractor={r => `${r.envio.id}-${r.incidencia.id}`}
        onRowClick={(r) => setEnvioSeleccionado(r.envio)}
        emptyMessage={
          search || filtroTipo !== 'todos'
            ? 'No hay incidencias que coincidan con los filtros.'
            : filtroEstado === 'abiertas'
              ? '✨ Sin incidencias abiertas. Buen trabajo.'
              : 'No hay incidencias registradas.'
        }
      />

      {/* Modal gestión unificada */}
      {envioSeleccionado && (
        <GestionIncidenciasModal
          transferencia={envioSeleccionado}
          productosMap={productosMap}
          onClose={() => setEnvioSeleccionado(null)}
          onSuccess={() => {
            setEnvioSeleccionado(null);
            fetchEnvios();
          }}
        />
      )}
    </div>
  );
};
