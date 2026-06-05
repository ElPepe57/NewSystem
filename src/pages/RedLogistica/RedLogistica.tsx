/**
 * Red Logística — Hub Kit (orange · grupo Inventario)
 *
 * Migrado del shell legacy (PageShell + KPIBar) al Hub Kit canónico.
 * Modelo: Colaborador (quien transporta) ↔ Casilla (ubicación) · N-a-N.
 * Directorio agrupado por PAÍS → Casillas → Colaboradores asociados.
 * 3 tabs: Resumen · Directorio · Mapa (Mapa como tab · consistente con Inventario).
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network, UserPlus, MapPin, Package, DollarSign, Users, Gauge, Plane,
  Search, RefreshCw, Warehouse, Truck, Bike, AlertTriangle,
  CheckCircle, Lightbulb, UserX, ArrowUpRight, ArrowRightLeft,
  BarChart3, Pencil,
} from 'lucide-react';
import { HubShell, HubTopBar, HubHeader, HubKpiStrip, HubTabs, HubBody, type HubKpi, type HubTab } from '../../design-system';
import { useConfirmDialog, ConfirmDialog } from '../../components/common';
import { useToastStore } from '../../store/toastStore';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useAlmacenStore } from '../../store/casillaStore';
import { useAuthStore } from '../../store/authStore';
import { hasRole } from '../../types/auth.types';
import type { Colaborador, TipoColaborador, SubtipoTransportistaLocal } from '../../types/colaborador.types';
import type { Casilla } from '../../types/casilla.types';
import { ColaboradorFormModal } from './ColaboradorFormModal';
import { CasillaFormModal } from './CasillaFormModal';
import { AsociarColaboradorModal } from './AsociarColaboradorModal';
import { RedLogisticaMapa } from './RedLogisticaMapa';
import { CasillaExpandible } from './vistas/CasillaExpandible';
import { formatCurrency } from '../../utils/format';

// ── Helpers ──

const PAIS_INFO: Record<string, { codigo: string; nombre: string; orden: number }> = {
  USA: { codigo: 'US', nombre: 'Estados Unidos', orden: 1 },
  China: { codigo: 'CN', nombre: 'China', orden: 2 },
  Corea: { codigo: 'KR', nombre: 'Corea', orden: 3 },
  Peru: { codigo: 'PE', nombre: 'Perú', orden: 4 },
  Peru_local: { codigo: 'PE', nombre: 'Perú (local)', orden: 5 },
};
const paisCodigo = (p?: string) => PAIS_INFO[p ?? '']?.codigo ?? (p ?? '—');
const paisNombre = (p?: string) => PAIS_INFO[p ?? '']?.nombre ?? (p ?? 'Sin país');

const TIPOS_CASILLA: { value: string; label: string }[] = [
  { value: 'casilla_viajero', label: 'Casillas viajero' },
  { value: 'almacen_propio', label: 'Almacenes propios' },
  { value: 'punto_courier', label: 'Puntos courier' },
  { value: 'ubicacion_proveedor', label: 'Proveedores' },
  { value: 'almacen_tercero', label: 'Terceros' },
];

type TabRed = 'resumen' | 'directorio' | 'mapa';

interface PaisGrupo {
  pais: string;
  casillas: Casilla[];
  reparto: Colaborador[];
}

// ══════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════

export const RedLogistica: React.FC = () => {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const esAdmin = hasRole(userProfile, 'admin');
  const { colaboradores, fetchColaboradores, eliminarColaborador } = useColaboradorStore();
  const { casillas, fetchCasillas } = useAlmacenStore();
  const toast = useToastStore();
  const { confirm, dialogProps } = useConfirmDialog();

  const [tab, setTab] = useState<TabRed>('resumen');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modales
  const [colabFormOpen, setColabFormOpen] = useState(false);
  const [colabEditing, setColabEditing] = useState<Colaborador | null>(null);
  const [tipoPreseleccionado, setTipoPreseleccionado] = useState<TipoColaborador | undefined>();
  const [subtipoPreseleccionado, setSubtipoPreseleccionado] = useState<SubtipoTransportistaLocal | undefined>();
  const [casillaFormOpen, setCasillaFormOpen] = useState(false);
  const [casillaColabId, setCasillaColabId] = useState('');
  const [casillaEditing, setCasillaEditing] = useState<Casilla | null>(null);
  const [asociarCasilla, setAsociarCasilla] = useState<Casilla | null>(null);

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
    if (casillas.length === 0) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ──

  const colaboradoresMap = useMemo(() => {
    const m = new Map<string, Colaborador>();
    colaboradores.forEach(c => m.set(c.id, c));
    return m;
  }, [colaboradores]);

  const casillasActivas = useMemo(() => casillas.filter(c => c.estado === 'activa'), [casillas]);

  // KPIs
  const totalColaboradoresActivos = useMemo(() => colaboradores.filter(c => c.estado === 'activo').length, [colaboradores]);
  const totalCasillasActivas = casillasActivas.length;
  const totalUnidades = casillasActivas.reduce((s, c) => s + (c.unidadesActuales || 0), 0);
  const totalValorUSD = casillasActivas.reduce((s, c) => s + (c.valorInventarioUSD || 0), 0);
  const capacidadTotal = casillasActivas.reduce((s, c) => s + (c.capacidadUnidades || 0), 0);
  const capacidadUsada = capacidadTotal > 0 ? Math.round((totalUnidades / capacidadTotal) * 100) : 0;

  // Composición por tipo (Resumen §B)
  const composicion = useMemo(() => {
    const act = colaboradores.filter(c => c.estado === 'activo');
    return {
      empresa: act.filter(c => c.tipo === 'empresa').length,
      viajero: act.filter(c => c.tipo === 'viajero').length,
      courier: act.filter(c => c.tipo === 'courier_externo').length,
      transportista: act.filter(c => c.tipo === 'transportista_local').length,
    };
  }, [colaboradores]);

  // Casillas por país (Resumen §B.2)
  const casillasPorPais = useMemo(() => {
    const m = new Map<string, number>();
    casillasActivas.forEach(c => m.set(c.pais, (m.get(c.pais) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => (PAIS_INFO[a[0]]?.orden ?? 99) - (PAIS_INFO[b[0]]?.orden ?? 99));
  }, [casillasActivas]);

  const paisesCubiertos = casillasPorPais.length;
  const casillasSinColaborador = useMemo(
    () => casillasActivas.filter(c => !colaboradoresMap.get(c.colaboradorId)).length,
    [casillasActivas, colaboradoresMap]
  );
  const totalViajeros = composicion.viajero;

  // Directorio: País → Casillas → Colaboradores + reparto local
  const directorioPorPais = useMemo<PaisGrupo[]>(() => {
    const term = busqueda.toLowerCase();
    const casFiltradas = casillasActivas.filter(c => {
      if (filtroTipo && c.tipo !== filtroTipo) return false;
      if (term) {
        const matchCol = colaboradoresMap.get(c.colaboradorId)?.nombre.toLowerCase().includes(term);
        return c.nombre.toLowerCase().includes(term) || c.codigo.toLowerCase().includes(term) || !!matchCol;
      }
      return true;
    });
    const conCasilla = new Set<string>();
    casillasActivas.forEach(c => { conCasilla.add(c.colaboradorId); c.colaboradoresSecundariosIds?.forEach(id => conCasilla.add(id)); });
    const sinCasilla = filtroTipo ? [] : colaboradores.filter(c =>
      c.estado === 'activo' && !conCasilla.has(c.id) &&
      (!term || c.nombre.toLowerCase().includes(term) || (c.codigo?.toLowerCase().includes(term) ?? false))
    );

    const map = new Map<string, PaisGrupo>();
    const ensure = (pais: string) => {
      if (!map.has(pais)) map.set(pais, { pais, casillas: [], reparto: [] });
      return map.get(pais)!;
    };
    casFiltradas.forEach(c => ensure(c.pais).casillas.push(c));
    sinCasilla.forEach(c => ensure(c.pais).reparto.push(c));
    map.forEach(g => g.casillas.sort((a, b) => (b.esPrincipal ? 1 : 0) - (a.esPrincipal ? 1 : 0)));
    return Array.from(map.values())
      .filter(g => g.casillas.length > 0 || g.reparto.length > 0)
      .sort((a, b) => (PAIS_INFO[a.pais]?.orden ?? 99) - (PAIS_INFO[b.pais]?.orden ?? 99));
  }, [casillasActivas, colaboradores, colaboradoresMap, busqueda, filtroTipo]);

  // ── Handlers ──

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNuevoColaborador = (tipo?: TipoColaborador, subtipo?: SubtipoTransportistaLocal) => {
    setColabEditing(null);
    setTipoPreseleccionado(tipo);
    setSubtipoPreseleccionado(subtipo);
    setColabFormOpen(true);
  };

  const handleEditarColaborador = (c: Colaborador) => {
    setColabEditing(c);
    setTipoPreseleccionado(undefined);
    setSubtipoPreseleccionado(undefined);
    setColabFormOpen(true);
  };

  const handleEliminarColaborador = async (c: Colaborador) => {
    const ok = await confirm({
      title: 'Eliminar colaborador',
      message: `¿Seguro que quieres eliminar a "${c.nombre}" (${c.codigo})? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await eliminarColaborador(c.id);
      toast.success(`"${c.nombre}" eliminado`);
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar', 'No se pudo eliminar');
    }
  };

  const handleNuevaCasilla = (colaboradorId: string) => {
    setCasillaColabId(colaboradorId);
    setCasillaEditing(null);
    setCasillaFormOpen(true);
  };

  const handleEditarCasilla = (casilla: Casilla) => {
    setCasillaColabId(casilla.colaboradorId);
    setCasillaEditing(casilla);
    setCasillaFormOpen(true);
  };

  const handleColabSaved = () => {
    setColabFormOpen(false);
    setColabEditing(null);
    setTipoPreseleccionado(undefined);
    setSubtipoPreseleccionado(undefined);
    fetchColaboradores();
  };

  const handleCasillaSaved = () => {
    setCasillaFormOpen(false);
    setCasillaEditing(null);
    fetchCasillas();
  };

  const handleAsociarSaved = () => {
    setAsociarCasilla(null);
    fetchCasillas();
  };

  const refrescar = () => { fetchColaboradores(); fetchCasillas(); };

  // ── KPIs / Tabs Hub ──

  const kpis: HubKpi[] = [
    { label: 'Colaboradores', valor: String(totalColaboradoresActivos), tono: 'slate', icon: Users, delta: 'activos en la red' },
    { label: 'Casillas activas', valor: String(totalCasillasActivas), tono: 'emerald', icon: MapPin, delta: 'ubicaciones' },
    { label: 'Unidades en red', valor: totalUnidades.toLocaleString('en-US'), tono: 'sky', icon: Package, delta: 'en circulación' },
    { label: 'Valor en red', valor: formatCurrency(totalValorUSD, 'USD'), tono: 'indigo', icon: DollarSign, delta: 'capital acopiado' },
    { label: 'Capacidad', valor: String(capacidadUsada), sufijo: '%', tono: 'amber', icon: Gauge, delta: 'ocupación media' },
  ];

  const tabs: HubTab[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'directorio', label: 'Directorio', badge: totalCasillasActivas, badgeTono: 'slate' },
    { id: 'mapa', label: 'Mapa', icon: MapPin },
  ];

  const leaf = tab === 'resumen' ? 'Resumen' : tab === 'directorio' ? 'Directorio' : 'Mapa';

  // ── Render ──

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <HubShell>
        <HubTopBar
          grupo="inventario"
          modulo="Red Logística"
          leaf={leaf}
          esAdmin={esAdmin}
          onInicio={() => navigate('/')}
          onModulo={() => setTab('resumen')}
        />
        <HubHeader
          grupo="inventario"
          icon={Network}
          titulo="Red Logística"
          subtitulo="Quiénes transportan y dónde se acopia · colaboradores y casillas de la red"
          extraActions={
            <button
              type="button"
              onClick={refrescar}
              title="Actualizar"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          }
          acciones={[
            { label: 'Nueva casilla', icon: MapPin, onClick: () => handleNuevaCasilla(''), tier: 'neutral' },
            { label: 'Nuevo colaborador', icon: UserPlus, onClick: () => handleNuevoColaborador(), tier: 'primary' },
          ]}
        />
        <HubKpiStrip
          cols={5}
          kpis={kpis}
          miniStats={[
            { label: <span><strong className="tabular-nums font-semibold text-slate-700">{totalViajeros}</strong> viajeros</span>, icon: Plane },
            { label: <span>Cobertura <strong className="font-semibold text-slate-700">{paisesCubiertos} {paisesCubiertos === 1 ? 'país' : 'países'}</strong></span>, icon: Network },
            { label: <span><strong className={`tabular-nums font-semibold ${casillasSinColaborador > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{casillasSinColaborador}</strong> casilla sin colaborador</span>, icon: UserX },
          ]}
        />
        <HubTabs grupo="inventario" tabs={tabs} activa={tab} onChange={(id) => setTab(id as TabRed)} />

        <HubBody flush>
          {tab === 'resumen' && (
            <div className="p-4 sm:p-6">
              <TabResumenRed
                totalColaboradores={totalColaboradoresActivos}
                paisesCubiertos={paisesCubiertos}
                capacidadUsada={capacidadUsada}
                composicion={composicion}
                casillasPorPais={casillasPorPais}
                casillasSinColaborador={casillasSinColaborador}
                onNuevoColaborador={handleNuevoColaborador}
                onNuevaCasilla={() => handleNuevaCasilla('')}
                onIrDirectorio={() => setTab('directorio')}
                onIr={(ruta) => navigate(ruta)}
              />
            </div>
          )}

          {tab === 'directorio' && (
            <div className="p-4 sm:p-6 space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar casilla o colaborador…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => setFiltroTipo('')}
                    className={`whitespace-nowrap px-2.5 py-1.5 text-[11px] rounded-lg font-semibold ${filtroTipo === '' ? 'bg-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                  >Todas</button>
                  {TIPOS_CASILLA.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setFiltroTipo(t.value)}
                      className={`whitespace-nowrap px-2.5 py-1.5 text-[11px] rounded-lg ${filtroTipo === t.value ? 'bg-orange-600 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-600'}`}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 px-1 -mt-1">
                Agrupado por <strong>país</strong> → <strong>casillas</strong> (ubicación) → <strong>colaboradores</strong> asociados (dueño + compartida).
              </p>

              {directorioPorPais.length === 0 ? (
                <EmptyDirectorio onNuevoColaborador={handleNuevoColaborador} />
              ) : (
                directorioPorPais.map(grupo => (
                  <PaisGrupoView
                    key={grupo.pais}
                    grupo={grupo}
                    expandedIds={expandedIds}
                    colaboradoresMap={colaboradoresMap}
                    onToggle={toggleExpand}
                    onEditarCasilla={handleEditarCasilla}
                    onEditarColaborador={handleEditarColaborador}
                    onAsociar={(c) => setAsociarCasilla(c)}
                    onNuevaCasillaParaColab={handleNuevaCasilla}
                  />
                ))
              )}
            </div>
          )}

          {tab === 'mapa' && (
            <div className="p-4 sm:p-6">
              <RedLogisticaMapa casillas={casillasActivas} colaboradoresMap={colaboradoresMap} />
            </div>
          )}
        </HubBody>
      </HubShell>

      {/* ═══ Modales · fuera del HubShell ═══ */}
      <ColaboradorFormModal
        isOpen={colabFormOpen}
        onClose={() => { setColabFormOpen(false); setColabEditing(null); setTipoPreseleccionado(undefined); setSubtipoPreseleccionado(undefined); }}
        onSaved={handleColabSaved}
        colaborador={colabEditing}
        tipoPreseleccionado={tipoPreseleccionado}
        subtipoPreseleccionado={subtipoPreseleccionado}
      />
      <CasillaFormModal
        isOpen={casillaFormOpen}
        onClose={() => { setCasillaFormOpen(false); setCasillaEditing(null); }}
        onSaved={handleCasillaSaved}
        casilla={casillaEditing}
        colaboradorId={casillaColabId}
      />
      <AsociarColaboradorModal
        isOpen={!!asociarCasilla}
        onClose={() => setAsociarCasilla(null)}
        casilla={asociarCasilla}
        onSaved={handleAsociarSaved}
      />
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default RedLogistica;

// ══════════════════════════════════════════════════════════════════
// Directorio · grupo por país
// ══════════════════════════════════════════════════════════════════

interface PaisGrupoViewProps {
  grupo: PaisGrupo;
  expandedIds: Set<string>;
  colaboradoresMap: Map<string, Colaborador>;
  onToggle: (id: string) => void;
  onEditarCasilla: (c: Casilla) => void;
  onEditarColaborador: (c: Colaborador) => void;
  onAsociar: (c: Casilla) => void;
  onNuevaCasillaParaColab: (colaboradorId: string) => void;
}

const PaisGrupoView: React.FC<PaisGrupoViewProps> = ({
  grupo, expandedIds, colaboradoresMap, onToggle, onEditarCasilla, onEditarColaborador, onAsociar, onNuevaCasillaParaColab,
}) => {
  const nColabs = new Set<string>();
  grupo.casillas.forEach(c => { nColabs.add(c.colaboradorId); c.colaboradoresSecundariosIds?.forEach(id => nColabs.add(id)); });
  grupo.reparto.forEach(c => nColabs.add(c.id));

  return (
    <div className="space-y-2">
      {/* Header país */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] font-bold text-slate-600 tabular-nums bg-slate-100 px-2 py-0.5 rounded">{paisCodigo(grupo.pais)}</span>
        <span className="text-[13px] font-bold text-slate-800">{paisNombre(grupo.pais)}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {grupo.casillas.length} {grupo.casillas.length === 1 ? 'casilla' : 'casillas'} · {nColabs.size} {nColabs.size === 1 ? 'colaborador' : 'colaboradores'}
        </span>
        <div className="flex-1 border-t border-slate-200 ml-1" />
      </div>

      {/* Casillas (con colaboradores asociados dentro) */}
      <div className="space-y-2">
        {grupo.casillas.map(casilla => {
          const principal = colaboradoresMap.get(casilla.colaboradorId);
          const secundarios = (casilla.colaboradoresSecundariosIds ?? [])
            .map(id => colaboradoresMap.get(id))
            .filter((c): c is Colaborador => !!c);
          return (
            <CasillaExpandible
              key={casilla.id}
              casilla={casilla}
              colaboradorPrincipal={principal}
              colaboradoresSecundarios={secundarios}
              expanded={expandedIds.has(casilla.id)}
              onToggleExpand={() => onToggle(casilla.id)}
              onEditarCasilla={onEditarCasilla}
              onEditarColaborador={onEditarColaborador}
              onAsociarColaborador={onAsociar}
            />
          );
        })}
      </div>

      {/* Reparto local · colaboradores sin casilla */}
      {grupo.reparto.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-amber-500" /> Reparto local · sin casilla de acopio
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {grupo.reparto.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-lg flex items-center gap-2.5 p-2.5">
                <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  {c.nombre.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                    {c.nombre}
                    {c.tipo === 'transportista_local' && c.subtipoTransportista && (
                      <span className={`text-[9px] px-1 rounded font-bold ${c.subtipoTransportista === 'interno' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {c.subtipoTransportista}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">{c.ciudad || paisNombre(c.pais)}</div>
                </div>
                <button onClick={() => onNuevaCasillaParaColab(c.id)} className="p-1 rounded hover:bg-slate-100 text-slate-400" title="Agregar casilla">
                  <MapPin className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onEditarColaborador(c)} className="p-1 rounded hover:bg-slate-100 text-slate-400" title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyDirectorio: React.FC<{ onNuevoColaborador: (t?: TipoColaborador) => void }> = ({ onNuevoColaborador }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3">
      <Network className="w-6 h-6 text-orange-500" />
    </div>
    <div className="text-[14px] font-semibold text-slate-900 mb-1">Aún no hay colaboradores ni casillas</div>
    <div className="text-[12px] text-slate-500 mb-4">Empezá agregando un viajero o tu primer almacén propio.</div>
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => onNuevoColaborador('viajero')} className="bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-violet-300 hover:bg-violet-50/30 text-left inline-flex items-center gap-2">
        <Plane className="w-4 h-4 text-violet-600" /><span className="text-[12px] font-bold text-slate-900">Nuevo viajero</span>
      </button>
      <button onClick={() => onNuevoColaborador('empresa')} className="bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50/30 text-left inline-flex items-center gap-2">
        <Warehouse className="w-4 h-4 text-indigo-600" /><span className="text-[12px] font-bold text-slate-900">Almacén propio</span>
      </button>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════
// Tab Resumen · §A→§F
// ══════════════════════════════════════════════════════════════════

interface TabResumenRedProps {
  totalColaboradores: number;
  paisesCubiertos: number;
  capacidadUsada: number;
  composicion: { empresa: number; viajero: number; courier: number; transportista: number };
  casillasPorPais: [string, number][];
  casillasSinColaborador: number;
  onNuevoColaborador: (t?: TipoColaborador) => void;
  onNuevaCasilla: () => void;
  onIrDirectorio: () => void;
  onIr: (ruta: string) => void;
}

const TabResumenRed: React.FC<TabResumenRedProps> = ({
  totalColaboradores, paisesCubiertos, capacidadUsada, composicion, casillasPorPais,
  casillasSinColaborador, onNuevoColaborador, onNuevaCasilla, onIrDirectorio, onIr,
}) => {
  const totalComp = composicion.empresa + composicion.viajero + composicion.courier + composicion.transportista || 1;
  const compRows = [
    { label: 'Mis almacenes', value: composicion.empresa, color: 'bg-indigo-500' },
    { label: 'Viajeros', value: composicion.viajero, color: 'bg-violet-500' },
    { label: 'Couriers intl.', value: composicion.courier, color: 'bg-sky-500' },
    { label: 'Transportistas locales', value: composicion.transportista, color: 'bg-amber-500' },
  ];
  const maxPais = Math.max(1, ...casillasPorPais.map(([, n]) => n));
  const paisColor = (p: string) => p.startsWith('Peru') ? 'bg-emerald-500' : p === 'USA' ? 'bg-sky-500' : 'bg-amber-500';

  return (
    <div className="space-y-4">
      {/* §A · banner estado */}
      <div className={`rounded-2xl p-4 flex items-start gap-3 border ${casillasSinColaborador > 0 ? 'bg-gradient-to-r from-amber-50 to-amber-100/30 border-amber-200' : 'bg-gradient-to-r from-emerald-50 to-emerald-100/30 border-emerald-200'}`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${casillasSinColaborador > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          {casillasSinColaborador > 0
            ? <AlertTriangle className="w-5 h-5 text-amber-700" />
            : <CheckCircle className="w-5 h-5 text-emerald-700" />}
        </div>
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold ${casillasSinColaborador > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
            Red operativa · {totalColaboradores} colaboradores cubren {paisesCubiertos} {paisesCubiertos === 1 ? 'país' : 'países'}
          </div>
          <div className={`text-[12px] leading-snug mt-0.5 ${casillasSinColaborador > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {casillasSinColaborador > 0
              ? `${casillasSinColaborador} ${casillasSinColaborador === 1 ? 'casilla quedó' : 'casillas quedaron'} sin colaborador asignado. Acopio al ${capacidadUsada}% de ocupación media.`
              : `Sin casillas sin asignar. Acopio sano: ${capacidadUsada}% de ocupación media.`}
          </div>
        </div>
      </div>

      {/* §B · visualización */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-900">Composición de la red por tipo</div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">colaboradores</span>
          </div>
          <div className="space-y-2.5">
            {compRows.map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-slate-600">{r.label}</span>
                  <strong className="tabular-nums text-slate-900">{r.value}</strong>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full`} style={{ width: `${(r.value / totalComp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-slate-900 mb-3">Casillas por país</div>
          {casillasPorPais.length === 0 ? (
            <div className="text-[12px] text-slate-400 italic">Sin casillas aún.</div>
          ) : (
            <div className="space-y-2.5 text-[12px]">
              {casillasPorPais.map(([pais, n]) => (
                <div key={pais}>
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-slate-500 text-[10px] tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">{paisCodigo(pais)}</span>
                    <strong className="tabular-nums">{n}</strong>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${paisColor(pais)} rounded-full`} style={{ width: `${(n / maxPais) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* §C insights + §D acciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Insights</div>
          <div className="space-y-2 text-[12px] text-slate-600">
            <div className="flex items-start gap-2"><Network className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" /> <span>La red cubre <strong className="text-slate-900">{paisesCubiertos} {paisesCubiertos === 1 ? 'país' : 'países'}</strong> con <strong className="text-slate-900">{totalColaboradores}</strong> colaboradores activos.</span></div>
            <div className="flex items-start gap-2"><Gauge className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" /> <span>Ocupación media de acopio en <strong className="text-slate-900">{capacidadUsada}%</strong>.</span></div>
            {casillasSinColaborador > 0 && (
              <div className="flex items-start gap-2"><UserX className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" /> <span><strong className="text-slate-900">{casillasSinColaborador}</strong> {casillasSinColaborador === 1 ? 'casilla' : 'casillas'} sin colaborador asignado.</span></div>
            )}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-slate-900 mb-3">Acciones rápidas</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onNuevoColaborador('viajero')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-violet-300 hover:bg-violet-50/30 text-left transition-colors"><Plane className="w-4 h-4 text-violet-600 mb-1.5" /><div className="text-[11px] font-bold text-slate-900">Nuevo viajero</div></button>
            <button onClick={() => onNuevoColaborador('empresa')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-colors"><Warehouse className="w-4 h-4 text-indigo-600 mb-1.5" /><div className="text-[11px] font-bold text-slate-900">Almacén propio</div></button>
            <button onClick={() => onNuevoColaborador('courier_externo')} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-sky-300 hover:bg-sky-50/30 text-left transition-colors"><Truck className="w-4 h-4 text-sky-600 mb-1.5" /><div className="text-[11px] font-bold text-slate-900">Courier intl.</div></button>
            <button onClick={onNuevaCasilla} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-colors"><MapPin className="w-4 h-4 text-emerald-600 mb-1.5" /><div className="text-[11px] font-bold text-slate-900">Nueva casilla</div></button>
          </div>
        </div>
      </div>

      {/* §E cross-links 360 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => onIr('/envios')} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-orange-300 hover:bg-orange-50/20 transition-colors"><span className="text-[12px] font-medium text-slate-700 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-orange-500" /> Envíos</span><ArrowUpRight className="w-3.5 h-3.5 text-slate-400" /></button>
        <button onClick={() => onIr('/inventario')} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-orange-300 hover:bg-orange-50/20 transition-colors"><span className="text-[12px] font-medium text-slate-700 flex items-center gap-2"><Warehouse className="w-4 h-4 text-orange-500" /> Stock / Existencias</span><ArrowUpRight className="w-3.5 h-3.5 text-slate-400" /></button>
        <button onClick={() => onIr('/reportes')} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-orange-300 hover:bg-orange-50/20 transition-colors"><span className="text-[12px] font-medium text-slate-700 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-orange-500" /> Reportes · Logística</span><ArrowUpRight className="w-3.5 h-3.5 text-slate-400" /></button>
      </div>

      {/* §F alertas */}
      {casillasSinColaborador > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-[12px] text-amber-800">
            {casillasSinColaborador} {casillasSinColaborador === 1 ? 'casilla' : 'casillas'} sin colaborador asignado.{' '}
            <button onClick={onIrDirectorio} className="font-semibold underline">Revisar en Directorio →</button>
          </span>
        </div>
      )}
    </div>
  );
};
