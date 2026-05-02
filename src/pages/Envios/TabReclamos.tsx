/**
 * TabReclamos — S40 Bloque B
 *
 * Vista maestra de reclamos. Filtros + KPIs + tabla con acciones inline.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertOctagon,
  Percent,
  Filter as FilterIcon,
  Plus,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { DataTable, StatCard } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { Badge, Button, SearchInput } from '../../components/common';
import { useReclamoStore } from '../../store/reclamoStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/format';
import type {
  Reclamo,
  EstadoReclamo,
  TipoReclamo,
  DestinatarioReclamo,
} from '../../types/reclamo.types';
import { ReclamoPanel } from '../../components/modules/envio/ReclamoPanel';

const ESTADO_LABELS: Record<EstadoReclamo, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'info' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'info' },
  en_disputa: { label: 'En disputa', variant: 'warning' },
  aceptado: { label: 'Aceptado', variant: 'warning' },
  cobrado: { label: 'Cobrado', variant: 'success' },
  rechazado: { label: 'Rechazado', variant: 'danger' },
  cerrado_sin_cobrar: { label: 'Cerrado', variant: 'danger' },
};

const TIPO_LABELS: Record<TipoReclamo, string> = {
  danada: 'Dañada',
  perdida: 'Perdida',
  aduana_timeout: 'Aduana',
  otro: 'Otro',
};

const DESTINATARIO_LABELS: Record<DestinatarioReclamo, string> = {
  proveedor: 'Proveedor',
  courier: 'Courier',
  seguro: 'Seguro',
  otro: 'Otro',
};

type FiltroEstado = 'todos' | 'activos' | 'cerrados' | EstadoReclamo;

export const TabReclamos: React.FC = () => {
  const { user } = useAuthStore();
  const { reclamos, resumen, loading, fetchReclamos, fetchResumen } = useReclamoStore();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('activos');
  const [filtroDestinatario, setFiltroDestinatario] = useState<DestinatarioReclamo | 'todos'>('todos');
  const [reclamoSeleccionado, setReclamoSeleccionado] = useState<Reclamo | null>(null);

  useEffect(() => {
    fetchReclamos();
    fetchResumen();
  }, [fetchReclamos, fetchResumen]);

  const reclamosFiltrados = useMemo(() => {
    let list = reclamos;

    if (filtroEstado === 'activos') {
      list = list.filter(r =>
        r.estado === 'borrador' || r.estado === 'enviado' || r.estado === 'en_disputa' || r.estado === 'aceptado'
      );
    } else if (filtroEstado === 'cerrados') {
      list = list.filter(r =>
        r.estado === 'cobrado' || r.estado === 'rechazado' || r.estado === 'cerrado_sin_cobrar'
      );
    } else if (filtroEstado !== 'todos') {
      list = list.filter(r => r.estado === filtroEstado);
    }

    if (filtroDestinatario !== 'todos') {
      list = list.filter(r => r.destinatario === filtroDestinatario);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.numeroReclamo.toLowerCase().includes(q)
        || r.envioNumero?.toLowerCase().includes(q)
        || r.ordenCompraNumero?.toLowerCase().includes(q)
        || r.destinatarioNombre?.toLowerCase().includes(q)
        || r.notas?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [reclamos, filtroEstado, filtroDestinatario, search]);

  const columnas: DataTableColumn<Reclamo>[] = [
    {
      key: 'numero',
      header: 'Reclamo',
      width: '14%',
      render: r => (
        <div>
          <div className="font-medium text-slate-900">{r.numeroReclamo}</div>
          <div className="text-xs text-slate-500">
            {r.fechaCreacion.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      ),
    },
    {
      key: 'contexto',
      header: 'Envío / OC',
      width: '14%',
      hideOnMobile: true,
      render: r => (
        <div className="text-xs">
          <div className="text-slate-700">{r.envioNumero}</div>
          {r.ordenCompraNumero && <div className="text-slate-500">OC: {r.ordenCompraNumero}</div>}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '10%',
      render: r => (
        <Badge variant="default" size="sm">{TIPO_LABELS[r.tipo]}</Badge>
      ),
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      width: '18%',
      render: r => (
        <div className="text-sm">
          <div className="text-slate-700">{r.destinatarioNombre}</div>
          <div className="text-xs text-slate-500">{DESTINATARIO_LABELS[r.destinatario]} · {r.cantidadUnidades}u</div>
        </div>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      width: '16%',
      align: 'right',
      render: r => (
        <div className="text-sm">
          <div className="font-semibold text-slate-900">{formatCurrency(r.montoReclamadoPEN, 'PEN')}</div>
          {r.montoCobradoPEN !== undefined && (
            <div className="text-xs text-emerald-700">Cobrado: {formatCurrency(r.montoCobradoPEN, 'PEN')}</div>
          )}
          {r.montoAcordadoPEN !== undefined && r.montoCobradoPEN === undefined && (
            <div className="text-xs text-amber-700">Acordado: {formatCurrency(r.montoAcordadoPEN, 'PEN')}</div>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '12%',
      render: r => (
        <Badge variant={ESTADO_LABELS[r.estado].variant} size="sm">
          {ESTADO_LABELS[r.estado].label}
        </Badge>
      ),
    },
    {
      key: 'accion',
      header: '',
      width: '16%',
      align: 'right',
      render: r => (
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setReclamoSeleccionado(r); }}>
          Ver / Avanzar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header banking-grade S58e · pixel-perfect mockup reclamos-procedural-s54 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="hover:text-teal-600 transition-colors cursor-pointer">Logística</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600 font-medium">Reclamos · Recuperación de incidencias</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-teal-600" />
            Reclamos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
            Recupera valor de incidencias · daños, pérdidas y aduana · pista de cobranza a proveedores, couriers y seguros.
          </p>
        </div>
        {resumen && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">
              {resumen.reclamosPendientes > 0 ? (
                <span className="font-semibold text-amber-700 tabular-nums">
                  {resumen.reclamosPendientes} {resumen.reclamosPendientes === 1 ? 'pendiente' : 'pendientes'}
                </span>
              ) : (
                'Sin reclamos pendientes'
              )}
            </span>
          </div>
        )}
      </div>

      {/* KPI strip horizontal con dividers · pixel-perfect S58e */}
      {resumen && (
        <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Total reclamos
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              {resumen.totalReclamos.toLocaleString('es-PE')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
              {resumen.reclamosPendientes} en curso
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider mb-1.5">
              Reclamado
            </div>
            <div className="text-2xl font-bold text-sky-700 tabular-nums tracking-tight">
              {formatCurrency(resumen.totalReclamadoPEN, 'PEN')}
            </div>
            <div className="text-[11px] text-sky-700 mt-1.5 tabular-nums">
              Monto exigido
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">
              Cobrado
            </div>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums tracking-tight">
              {formatCurrency(resumen.totalCobradoPEN, 'PEN')}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1.5 tabular-nums flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {resumen.reclamosCobrados} {resumen.reclamosCobrados === 1 ? 'cobrado' : 'cobrados'}
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider mb-1.5">
              Perdido
            </div>
            <div className="text-2xl font-bold text-rose-600 tabular-nums tracking-tight">
              {formatCurrency(resumen.totalPerdidoPEN, 'PEN')}
            </div>
            <div className="text-[11px] text-rose-600 mt-1.5 tabular-nums flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" />
              {resumen.reclamosRechazados} rechazados
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
              Tasa recuperación
            </div>
            <div
              className={`text-2xl font-bold tabular-nums tracking-tight ${
                resumen.tasaRecuperacion >= 70
                  ? 'text-emerald-600'
                  : resumen.tasaRecuperacion >= 40
                    ? 'text-amber-600'
                    : 'text-rose-600'
              }`}
            >
              {resumen.tasaRecuperacion.toFixed(1)}
              <span className="text-base text-slate-300 font-normal">%</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-1.5 tabular-nums flex items-center gap-1">
              <Percent className="w-3 h-3" />
              Cobrado / reclamado
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar reclamo, envío, destinatario..."
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterIcon className="w-4 h-4 text-slate-400" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="activos">Activos</option>
            <option value="cerrados">Cerrados</option>
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="enviado">Enviado</option>
            <option value="en_disputa">En disputa</option>
            <option value="aceptado">Aceptado</option>
            <option value="cobrado">Cobrado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cerrado_sin_cobrar">Cerrado sin cobrar</option>
          </select>

          <select
            value={filtroDestinatario}
            onChange={(e) => setFiltroDestinatario(e.target.value as any)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="todos">Todos los destinatarios</option>
            <option value="proveedor">Proveedor</option>
            <option value="courier">Courier</option>
            <option value="seguro">Seguro</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <DataTable<Reclamo>
        data={reclamosFiltrados}
        columns={columnas}
        keyExtractor={r => r.id}
        loading={loading}
        onRowClick={(r) => setReclamoSeleccionado(r)}
        emptyMessage={
          search || filtroEstado !== 'activos' || filtroDestinatario !== 'todos'
            ? 'No hay reclamos que coincidan con los filtros.'
            : 'No hay reclamos activos. Se crean desde un envío con incidencias.'
        }
      />

      {/* Modal detalle */}
      {reclamoSeleccionado && user && (
        <ReclamoPanel
          reclamo={reclamoSeleccionado}
          userId={user.uid}
          onClose={() => setReclamoSeleccionado(null)}
          onSuccess={() => {
            fetchReclamos();
            fetchResumen();
          }}
        />
      )}
    </div>
  );
};
