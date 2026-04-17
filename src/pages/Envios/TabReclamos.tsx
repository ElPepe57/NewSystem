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
      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total reclamos"
            value={resumen.totalReclamos}
            icon={FileText}
            variant="neutral"
          />
          <StatCard
            label="Reclamado"
            value={formatCurrency(resumen.totalReclamadoPEN, 'PEN')}
            icon={DollarSign}
            variant="info"
          />
          <StatCard
            label="Cobrado"
            value={formatCurrency(resumen.totalCobradoPEN, 'PEN')}
            icon={TrendingUp}
            variant="success"
            subtitle={`${resumen.reclamosCobrados} reclamo${resumen.reclamosCobrados !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="Perdido"
            value={formatCurrency(resumen.totalPerdidoPEN, 'PEN')}
            icon={AlertOctagon}
            variant="danger"
            subtitle={`${resumen.reclamosRechazados} rechazado${resumen.reclamosRechazados !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="Tasa recuperación"
            value={`${resumen.tasaRecuperacion.toFixed(1)}%`}
            icon={Percent}
            variant={resumen.tasaRecuperacion >= 70 ? 'success' : resumen.tasaRecuperacion >= 40 ? 'warning' : 'danger'}
            subtitle={`${resumen.reclamosPendientes} pendiente${resumen.reclamosPendientes !== 1 ? 's' : ''}`}
          />
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
