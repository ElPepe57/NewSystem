/**
 * Red Logistica — Gestion de Colaboradores y Casillas
 * Organizada en 2 secciones por proceso de negocio:
 *   - COMPRAS (origen → acopio): empresa, viajero, courier_externo
 *   - VENTAS (distribución local): transportista_local (interno/externo)
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Network, Plus, ChevronDown, ChevronRight, MapPin, Package,
  DollarSign, Star, Edit2, Plane, Truck, Building2, Users,
  Search, X, ShoppingCart, ShoppingBag, Briefcase,
  List, Map as MapIcon,
} from 'lucide-react';
import { PageShell, PageHeader, KPIBar, StatusBadge, StatCard } from '../../design-system';
import { Button } from '../../components/common/Button';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useAlmacenStore } from '../../store/casillaStore';
import type { Colaborador, TipoColaborador, SubtipoTransportistaLocal } from '../../types/colaborador.types';
import type { Casilla } from '../../types/casilla.types';
import { ColaboradorFormModal } from './ColaboradorFormModal';
import { CasillaFormModal } from './CasillaFormModal';
import { AsociarColaboradorModal } from './AsociarColaboradorModal';
import { RedLogisticaMapa } from './RedLogisticaMapa';
import { CasillaExpandible } from './vistas/CasillaExpandible';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/format';

// ── Helpers ──

const PAIS_EMOJI: Record<string, string> = {
  USA: '\u{1F1FA}\u{1F1F8}',
  Peru: '\u{1F1F5}\u{1F1EA}',
  China: '\u{1F1E8}\u{1F1F3}',
  Corea: '\u{1F1F0}\u{1F1F7}',
  Peru_local: '\u{1F1F5}\u{1F1EA}',
};

interface ColabConCasillas {
  colaborador: Colaborador;
  casillas: Casilla[];
}

// ── Main Component ──

export const RedLogistica: React.FC = () => {
  const { user } = useAuthStore();
  const { colaboradores, fetchColaboradores } = useColaboradorStore();
  const { casillas, fetchCasillas } = useAlmacenStore();

  const [busqueda, setBusqueda] = useState('');
  const [filtroPais, setFiltroPais] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // S42d — Toggle lista / mapa (MapKit)
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');

  // Modals
  const [colabFormOpen, setColabFormOpen] = useState(false);
  const [colabEditing, setColabEditing] = useState<Colaborador | null>(null);
  const [tipoPreseleccionado, setTipoPreseleccionado] = useState<TipoColaborador | undefined>();
  const [subtipoPreseleccionado, setSubtipoPreseleccionado] = useState<SubtipoTransportistaLocal | undefined>();

  const [casillaFormOpen, setCasillaFormOpen] = useState(false);
  const [casillaColabId, setCasillaColabId] = useState('');
  const [casillaEditing, setCasillaEditing] = useState<Casilla | null>(null);

  // S42h — Modal para asociar colaboradores a una casilla existente
  const [asociarCasilla, setAsociarCasilla] = useState<Casilla | null>(null);

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
    if (casillas.length === 0) fetchCasillas();
  }, []);

  // ── Derived data ──

  // S42g — Una casilla puede aparecer en varios colaboradores (principal + secundarios).
  // Para el principal se muestra tal cual; para secundarios se muestra con badge "Compartida".
  const casillasMap = useMemo(() => {
    const map = new Map<string, Casilla[]>();
    casillas.forEach(c => {
      // Dueño principal
      const arrPrincipal = map.get(c.colaboradorId) || [];
      arrPrincipal.push(c);
      map.set(c.colaboradorId, arrPrincipal);
      // Colaboradores secundarios (casilla compartida)
      c.colaboradoresSecundariosIds?.forEach((secId) => {
        const arrSec = map.get(secId) || [];
        arrSec.push(c);
        map.set(secId, arrSec);
      });
    });
    return map;
  }, [casillas]);

  const colaboradoresMap = useMemo(() => {
    const map = new Map<string, Colaborador>();
    colaboradores.forEach(c => map.set(c.id, c));
    return map;
  }, [colaboradores]);

  /** Aplica filtros de busqueda y pais a la lista completa */
  const colabsFiltrados = useMemo(() => {
    return colaboradores
      .filter(c => {
        if (filtroPais && c.pais !== filtroPais) return false;
        if (busqueda) {
          const term = busqueda.toLowerCase();
          const cas = casillasMap.get(c.id) || [];
          const matchCasilla = cas.some(cs => cs.nombre.toLowerCase().includes(term));
          return (
            c.nombre.toLowerCase().includes(term) ||
            c.codigo?.toLowerCase().includes(term) ||
            matchCasilla
          );
        }
        return true;
      })
      .map(c => ({
        colaborador: c,
        casillas: (casillasMap.get(c.id) || []).sort((a, b) =>
          (b.esPrincipal ? 1 : 0) - (a.esPrincipal ? 1 : 0)
        ),
      }));
  }, [colaboradores, casillas, casillasMap, filtroPais, busqueda]);

  /** Agrupa colaboradores por categoria de negocio */
  const grupos = useMemo(() => {
    return {
      misAlmacenes: colabsFiltrados.filter(c => c.colaborador.tipo === 'empresa'),
      viajeros: colabsFiltrados.filter(c => c.colaborador.tipo === 'viajero'),
      couriersIntl: colabsFiltrados.filter(c => c.colaborador.tipo === 'courier_externo'),
      internos: colabsFiltrados.filter(c =>
        c.colaborador.tipo === 'transportista_local' &&
        c.colaborador.subtipoTransportista === 'interno'
      ),
      externos: colabsFiltrados.filter(c =>
        c.colaborador.tipo === 'transportista_local' &&
        c.colaborador.subtipoTransportista === 'externo'
      ),
      sinCategoria: colabsFiltrados.filter(c =>
        c.colaborador.tipo === 'transportista_local' &&
        !c.colaborador.subtipoTransportista
      ),
    };
  }, [colabsFiltrados]);

  // ── KPIs globales ──

  const totalUnidades = casillas.reduce((s, c) => s + (c.unidadesActuales || 0), 0);
  const totalValorUSD = casillas.reduce((s, c) => s + (c.valorInventarioUSD || 0), 0);
  const totalCasillasActivas = casillas.filter(c => c.estado === 'activa').length;
  const totalTransportistas = grupos.internos.length + grupos.externos.length + grupos.sinCategoria.length;

  // ── Toggle expand ──

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(colaboradores.map(c => c.id)));
  const collapseAll = () => setExpandedIds(new Set());

  // ── Handlers ──

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

  // S42h — Handler para asociar colaboradores a casilla
  const handleAsociarColaborador = (casilla: Casilla) => {
    setAsociarCasilla(casilla);
  };

  const handleAsociarSaved = () => {
    setAsociarCasilla(null);
    fetchCasillas();
  };

  // ── Render ──

  return (
    <PageShell>
      <PageHeader
        title="Red Logística"
        subtitle={`${colaboradores.length} colaboradores, ${totalCasillasActivas} casillas activas`}
        icon={Network}
      />

      {/* KPIs globales */}
      <KPIBar columns={4}>
        <StatCard label="Colaboradores" value={colaboradores.length} icon={Users} />
        <StatCard label="Casillas activas" value={totalCasillasActivas} icon={MapPin} />
        <StatCard label="Unidades en red" value={totalUnidades} icon={Package} />
        <StatCard label="Valor inventario" value={formatCurrency(totalValorUSD, 'USD')} icon={DollarSign} />
      </KPIBar>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mt-4 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar colaborador o casilla..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        <select
          value={filtroPais}
          onChange={e => setFiltroPais(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Todos los países</option>
          <option value="USA">USA</option>
          <option value="Peru">Peru</option>
          <option value="China">China</option>
          <option value="Corea">Corea</option>
        </select>

        {/* S42d — Toggle Lista / Mapa */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('lista')}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              viewMode === 'lista' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Vista lista"
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mapa')}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              viewMode === 'mapa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Vista mapa"
          >
            <MapIcon className="w-3.5 h-3.5" />
            Mapa
          </button>
        </div>

        {viewMode === 'lista' && (
          <div className="flex gap-1 ml-auto">
            <button onClick={expandAll} className="text-xs text-teal-600 hover:text-teal-800 px-2 py-1">
              Expandir todo
            </button>
            <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
              Colapsar
            </button>
          </div>
        )}
      </div>

      {/* S42d — Vista Mapa */}
      {viewMode === 'mapa' && (
        <RedLogisticaMapa casillas={casillas} colaboradoresMap={colaboradoresMap} />
      )}

      {viewMode === 'lista' && (<>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN COMPRAS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <SeccionHeader
        icon={ShoppingCart}
        titulo="Compras"
        descripcion="Origen → Acopio · Recepción internacional de mercancía"
        color="teal"
      />

      <div className="space-y-4 mb-8">
        <Subgrupo
          titulo="Mis Almacenes"
          subtitulo="Puntos de acopio propios del negocio · Vista por ubicación física"
          icon={Building2}
          colorAccent="teal"
          items={grupos.misAlmacenes}
          onNuevo={() => handleNuevoColaborador('empresa')}
          nuevoLabel="Nueva empresa"
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEditar={handleEditarColaborador}
          onNuevaCasilla={handleNuevaCasilla}
          onEditarCasilla={handleEditarCasilla}
          emptyMsg="Sin almacenes propios. Agrega tu primer punto de acopio."
          layoutMode="por-casilla"
          onAsociarColaborador={handleAsociarColaborador}
          colaboradoresMap={colaboradoresMap}
        />

        <Subgrupo
          titulo="Viajeros"
          subtitulo="Casas de viajeros en países origen · Vista por ubicación física"
          icon={Plane}
          colorAccent="teal"
          items={grupos.viajeros}
          onNuevo={() => handleNuevoColaborador('viajero')}
          nuevoLabel="Nuevo viajero"
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEditar={handleEditarColaborador}
          onNuevaCasilla={handleNuevaCasilla}
          onEditarCasilla={handleEditarCasilla}
          emptyMsg="Sin viajeros. Agrega personas que trasladen productos."
          layoutMode="por-casilla"
          onAsociarColaborador={handleAsociarColaborador}
          colaboradoresMap={colaboradoresMap}
        />

        <Subgrupo
          titulo="Couriers Internacionales"
          subtitulo="Servicios de transporte internacional (DHL, FedEx, etc.)"
          icon={Truck}
          colorAccent="amber"
          items={grupos.couriersIntl}
          onNuevo={() => handleNuevoColaborador('courier_externo')}
          nuevoLabel="Nuevo courier"
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEditar={handleEditarColaborador}
          onNuevaCasilla={handleNuevaCasilla}
          onEditarCasilla={handleEditarCasilla}
          emptyMsg="Sin couriers internacionales. Agrega servicios como DHL o FedEx."
          mostrarCasillas={false}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN VENTAS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <SeccionHeader
        icon={ShoppingBag}
        titulo="Ventas"
        descripcion={`Distribución local · Entrega de pedidos a clientes (${totalTransportistas} transportistas)`}
        color="sky"
      />

      <div className="space-y-4">
        <Subgrupo
          titulo="Internos — Partners"
          subtitulo="Aliados estratégicos con acuerdos preferentes"
          icon={Briefcase}
          colorAccent="sky"
          items={grupos.internos}
          onNuevo={() => handleNuevoColaborador('transportista_local', 'interno')}
          nuevoLabel="Nuevo partner"
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEditar={handleEditarColaborador}
          onNuevaCasilla={handleNuevaCasilla}
          onEditarCasilla={handleEditarCasilla}
          emptyMsg="Sin partners internos. Agrega tus aliados estratégicos."
          mostrarCasillas={false}
        />

        <Subgrupo
          titulo="Externos — Terceros"
          subtitulo="Servicios tercerizados (Shalom, Urbano, Olva, etc.)"
          icon={Truck}
          colorAccent="slate"
          items={grupos.externos}
          onNuevo={() => handleNuevoColaborador('transportista_local', 'externo')}
          nuevoLabel="Nuevo servicio"
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEditar={handleEditarColaborador}
          onNuevaCasilla={handleNuevaCasilla}
          onEditarCasilla={handleEditarCasilla}
          emptyMsg="Sin servicios externos. Agrega couriers como Shalom o Urbano."
          mostrarCasillas={false}
        />

        {/* Transportistas sin categoría (migración incompleta) */}
        {grupos.sinCategoria.length > 0 && (
          <Subgrupo
            titulo="Sin categorizar"
            subtitulo="Transportistas sin subtipo asignado. Edítalos para clasificarlos."
            icon={Truck}
            colorAccent="amber"
            items={grupos.sinCategoria}
            onNuevo={() => handleNuevoColaborador('transportista_local')}
            nuevoLabel="Nuevo"
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            onEditar={handleEditarColaborador}
            onNuevaCasilla={handleNuevaCasilla}
            onEditarCasilla={handleEditarCasilla}
            emptyMsg=""
            mostrarCasillas={false}
          />
        )}
      </div>

      </>)}

      {/* Modals */}
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

      {/* S42h — Modal asociar colaboradores a una casilla existente */}
      <AsociarColaboradorModal
        isOpen={!!asociarCasilla}
        onClose={() => setAsociarCasilla(null)}
        casilla={asociarCasilla}
        onSaved={handleAsociarSaved}
      />
    </PageShell>
  );
};

// ══════════════════════════════════════════════════════════════════
// Subcomponentes
// ══════════════════════════════════════════════════════════════════

interface SeccionHeaderProps {
  icon: React.FC<any>;
  titulo: string;
  descripcion: string;
  color: 'teal' | 'sky' | 'amber' | 'slate';
}

const SeccionHeader: React.FC<SeccionHeaderProps> = ({ icon: Icon, titulo, descripcion, color }) => {
  const colorMap = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="flex items-center gap-3 mt-6 mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{descripcion}</p>
      </div>
    </div>
  );
};

interface SubgrupoProps {
  titulo: string;
  subtitulo: string;
  icon: React.FC<any>;
  colorAccent: 'teal' | 'sky' | 'amber' | 'slate';
  items: ColabConCasillas[];
  onNuevo: () => void;
  nuevoLabel: string;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onEditar: (c: Colaborador) => void;
  onNuevaCasilla: (colaboradorId: string) => void;
  onEditarCasilla: (casilla: Casilla) => void;
  emptyMsg: string;
  /** Si es false, no se muestra la expansion de casillas (solo el colaborador) */
  mostrarCasillas?: boolean;
  /** S42h — layoutMode: 'por-casilla' invierte la jerarquía (casilla como fila, colaboradores como dependientes) */
  layoutMode?: 'por-casilla' | 'por-colaborador';
  /** Solo aplica a layoutMode='por-casilla': handler para asociar otros colaboradores */
  onAsociarColaborador?: (casilla: Casilla) => void;
  /** Mapa id → colaborador para resolver principal y secundarios en vista por casilla */
  colaboradoresMap?: Map<string, Colaborador>;
  /** Label del botón "Nueva casilla" (para vista por casilla) */
  nuevaCasillaLabel?: string;
  /** Handler del botón "Nueva casilla" (para vista por casilla) */
  onNuevaCasillaGlobal?: () => void;
}

const Subgrupo: React.FC<SubgrupoProps> = ({
  titulo, subtitulo, icon: Icon, colorAccent, items, onNuevo, nuevoLabel,
  expandedIds, toggleExpand, onEditar, onNuevaCasilla, onEditarCasilla, emptyMsg,
  mostrarCasillas = true,
  layoutMode = 'por-colaborador',
  onAsociarColaborador,
  colaboradoresMap,
  nuevaCasillaLabel,
  onNuevaCasillaGlobal,
}) => {
  const accentMap = {
    teal: 'text-teal-600 bg-teal-50',
    sky: 'text-sky-600 bg-sky-50',
    amber: 'text-amber-600 bg-amber-50',
    slate: 'text-slate-600 bg-slate-50',
  };

  // S42h — Para layout por-casilla, aplanar casillas únicas con su principal + secundarios
  const casillasDelSubgrupo = React.useMemo(() => {
    if (layoutMode !== 'por-casilla') return [];
    const seen = new Set<string>();
    const out: Casilla[] = [];
    items.forEach((item) => {
      item.casillas.forEach((cas) => {
        // Solo contar la casilla una vez y solo si el colaborador es el principal
        // (evita duplicarla en la lista cuando aparece en un secundario)
        if (cas.colaboradorId === item.colaborador.id && !seen.has(cas.id)) {
          seen.add(cas.id);
          out.push(cas);
        }
      });
    });
    // Ordenar por esPrincipal desc, luego por nombre
    return out.sort((a, b) => {
      if (a.esPrincipal !== b.esPrincipal) return a.esPrincipal ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [items, layoutMode]);

  const countDisplay = layoutMode === 'por-casilla'
    ? `${casillasDelSubgrupo.length} ${casillasDelSubgrupo.length === 1 ? 'casilla' : 'casillas'} · ${items.length} ${items.length === 1 ? 'colaborador' : 'colaboradores'}`
    : `${items.length}`;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Header subgrupo */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[colorAccent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-500">{countDisplay}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitulo}</p>
        </div>
        {/* En por-casilla: botón adicional "Nueva casilla" si hay handler */}
        {layoutMode === 'por-casilla' && onNuevaCasillaGlobal && items.length > 0 && (
          <button
            onClick={onNuevaCasillaGlobal}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
          >
            <MapPin className="w-3 h-3" /> {nuevaCasillaLabel ?? 'Nueva casilla'}
          </button>
        )}
        <button
          onClick={onNuevo}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors"
        >
          <Plus className="w-3 h-3" /> {nuevoLabel}
        </button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400 italic">
          {emptyMsg}
        </div>
      ) : layoutMode === 'por-casilla' ? (
        // ═══ VISTA POR CASILLA ═══
        <PorCasillaLayout
          casillas={casillasDelSubgrupo}
          items={items}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEditarCasilla={onEditarCasilla}
          onEditarColaborador={onEditar}
          onAsociarColaborador={onAsociarColaborador}
          onNuevaCasillaGlobal={onNuevaCasillaGlobal}
          onNuevaCasillaParaColab={onNuevaCasilla}
          colaboradoresMap={colaboradoresMap}
        />
      ) : (
        // ═══ VISTA POR COLABORADOR (default) ═══
        <div className="divide-y divide-slate-100">
          {items.map(({ colaborador, casillas: cas }) => (
            <ColaboradorRow
              key={colaborador.id}
              colaborador={colaborador}
              casillas={cas}
              expanded={expandedIds.has(colaborador.id)}
              toggleExpand={toggleExpand}
              onEditar={onEditar}
              onNuevaCasilla={onNuevaCasilla}
              onEditarCasilla={onEditarCasilla}
              mostrarCasillas={mostrarCasillas}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ColaboradorRowProps {
  colaborador: Colaborador;
  casillas: Casilla[];
  expanded: boolean;
  toggleExpand: (id: string) => void;
  onEditar: (c: Colaborador) => void;
  onNuevaCasilla: (colaboradorId: string) => void;
  onEditarCasilla: (casilla: Casilla) => void;
  mostrarCasillas: boolean;
}

const ColaboradorRow: React.FC<ColaboradorRowProps> = ({
  colaborador, casillas, expanded, toggleExpand, onEditar, onNuevaCasilla, onEditarCasilla, mostrarCasillas,
}) => {
  const totalUds = casillas.reduce((s, c) => s + (c.unidadesActuales || 0), 0);
  const totalVal = casillas.reduce((s, c) => s + (c.valorInventarioUSD || 0), 0);

  return (
    <div>
      {/* Header colaborador */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${mostrarCasillas ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'}`}
        onClick={() => mostrarCasillas && toggleExpand(colaborador.id)}
      >
        {mostrarCasillas && (
          <button className="flex-shrink-0 text-slate-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {!mostrarCasillas && <div className="w-4" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-900 truncate">{colaborador.nombre}</span>
            <span className="text-[10px] font-mono text-slate-400">{colaborador.codigo}</span>
            <StatusBadge variant={colaborador.estado === 'activo' ? 'success' : 'neutral'} size="sm">
              {colaborador.estado}
            </StatusBadge>
            {casillas.length > 0 && mostrarCasillas && (
              <span className="text-[10px] text-slate-500">
                {casillas.length} casilla{casillas.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            <span>{PAIS_EMOJI[colaborador.pais] || ''} {colaborador.pais}</span>
            {colaborador.ciudad && <span>{colaborador.ciudad}</span>}
            {colaborador.telefono && <span>{colaborador.telefono}</span>}

            {/* S42l — Badges de tarifas/métricas retirados. Se eliminaron las secciones de
                 configuración detallada (S42j+k) por no tener uso en cálculos. El único
                 identificador estructural que queda es el subtipo del transportista local. */}
            {colaborador.tipo === 'transportista_local' && colaborador.subtipoTransportista && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                  colaborador.subtipoTransportista === 'interno'
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {colaborador.subtipoTransportista === 'interno' ? 'Partner interno' : 'Tercero'}
              </span>
            )}
          </div>
        </div>

        {/* Metricas resumen (solo si tiene casillas) */}
        {mostrarCasillas && casillas.length > 0 && (
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 flex-shrink-0">
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              {totalUds}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              {formatCurrency(totalVal, 'USD')}
            </span>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onEditar(colaborador)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            title="Editar"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {mostrarCasillas && (
            <button
              onClick={() => onNuevaCasilla(colaborador.id)}
              className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-500 hover:text-teal-700"
              title="Agregar casilla"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Casillas expandidas */}
      {mostrarCasillas && expanded && (
        <div className="bg-slate-50/50 border-t border-slate-100">
          {casillas.length === 0 ? (
            <div className="px-12 py-3 text-xs text-slate-400 italic">
              Sin casillas.{' '}
              <button
                onClick={() => onNuevaCasilla(colaborador.id)}
                className="text-teal-600 hover:text-teal-800 font-medium not-italic"
              >
                Agregar casilla
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {casillas.map(casilla => {
                // S42g — ¿Esta casilla se muestra porque es propia o porque comparte con el dueño?
                const esCompartidaConEste = casilla.colaboradorId !== colaborador.id;
                return (
                <div
                  key={casilla.id}
                  className="flex items-center gap-3 px-4 pl-12 py-2 hover:bg-white/60 transition-colors"
                >
                  <div className="flex-shrink-0 w-5">
                    {casilla.esPrincipal && !esCompartidaConEste && (
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    )}
                    {esCompartidaConEste && (
                      <Users className="w-3.5 h-3.5 text-purple-500" />
                    )}
                  </div>

                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 truncate">{casilla.nombre}</span>
                      <span className="text-[10px] font-mono text-slate-400">{casilla.codigo}</span>
                      <StatusBadge variant={casilla.estado === 'activa' ? 'success' : 'neutral'} size="sm">
                        {casilla.estado}
                      </StatusBadge>
                      {esCompartidaConEste && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-50 text-purple-700 border border-purple-200"
                          title={`Casilla principal de ${casilla.colaboradorNombre}`}
                        >
                          Compartida · {casilla.colaboradorNombre}
                        </span>
                      )}
                    </div>
                    {casilla.direccion && (
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {casilla.direccion}{casilla.ciudad ? `, ${casilla.ciudad}` : ''}
                      </div>
                    )}
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                    <span>{casilla.unidadesActuales || 0} uds</span>
                    <span>{formatCurrency(casilla.valorInventarioUSD || 0, 'USD')}</span>
                  </div>

                  <button
                    onClick={() => onEditarCasilla(casilla)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
                    title={esCompartidaConEste ? `Editar (administrada por ${casilla.colaboradorNombre})` : 'Editar casilla'}
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RedLogistica;

// ══════════════════════════════════════════════════════════════════
// S42h — Layout "por casilla": casillas arriba, colaboradores huérfanos abajo
// ══════════════════════════════════════════════════════════════════

interface PorCasillaLayoutProps {
  casillas: Casilla[];
  items: ColabConCasillas[];
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onEditarCasilla: (casilla: Casilla) => void;
  onEditarColaborador: (c: Colaborador) => void;
  onAsociarColaborador?: (casilla: Casilla) => void;
  onNuevaCasillaGlobal?: () => void;
  onNuevaCasillaParaColab: (colaboradorId: string) => void;
  colaboradoresMap?: Map<string, Colaborador>;
}

const PorCasillaLayout: React.FC<PorCasillaLayoutProps> = ({
  casillas, items, expandedIds, toggleExpand, onEditarCasilla, onEditarColaborador,
  onAsociarColaborador, onNuevaCasillaGlobal, onNuevaCasillaParaColab, colaboradoresMap,
}) => {
  // S42i fix — Colaboradores SIN ninguna casilla (ni propia ni compartida).
  // `cas` ya incluye casillas donde el colaborador es secundario (via casillasMap),
  // así que si el array está vacío, realmente no tiene dirección física asociada.
  const huerfanos = items.filter(({ casillas: cas }) => cas.length === 0);

  if (casillas.length === 0 && huerfanos.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-slate-400 italic">
        No hay casillas configuradas aún.
      </div>
    );
  }

  return (
    <>
      {/* Casillas */}
      {casillas.length > 0 && (
        <div className="divide-y divide-slate-100">
          {casillas.map((casilla) => {
            const principal = colaboradoresMap?.get(casilla.colaboradorId);
            const secundarios = (casilla.colaboradoresSecundariosIds ?? [])
              .map((id) => colaboradoresMap?.get(id))
              .filter((c): c is Colaborador => !!c);
            return (
              <CasillaExpandible
                key={casilla.id}
                casilla={casilla}
                colaboradorPrincipal={principal}
                colaboradoresSecundarios={secundarios}
                expanded={expandedIds.has(casilla.id)}
                onToggleExpand={() => toggleExpand(casilla.id)}
                onEditarCasilla={onEditarCasilla}
                onEditarColaborador={onEditarColaborador}
                onAsociarColaborador={(c) => onAsociarColaborador?.(c)}
              />
            );
          })}
        </div>
      )}

      {/* Colaboradores sin casilla */}
      {huerfanos.length > 0 && (
        <div className="border-t-2 border-slate-100 bg-amber-50/30">
          <div className="px-4 py-2 text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
            Sin casilla configurada
          </div>
          <div className="divide-y divide-slate-100">
            {huerfanos.map(({ colaborador }) => (
              <div
                key={colaborador.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/60 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                  {colaborador.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">{colaborador.nombre}</span>
                    <span className="text-[10px] font-mono text-slate-400">{colaborador.codigo}</span>
                    <StatusBadge variant={colaborador.estado === 'activo' ? 'success' : 'neutral'} size="sm">
                      {colaborador.estado}
                    </StatusBadge>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {PAIS_EMOJI[colaborador.pais] || ''} {colaborador.pais}
                    {colaborador.telefono && <> · {colaborador.telefono}</>}
                  </div>
                </div>
                <button
                  onClick={() => onNuevaCasillaParaColab(colaborador.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar casilla
                </button>
                <button
                  onClick={() => onEditarColaborador(colaborador)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  title="Editar colaborador"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
