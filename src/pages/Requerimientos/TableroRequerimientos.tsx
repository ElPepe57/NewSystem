/**
 * TableroRequerimientos · Tab "Tablero" del hub (F4 · HUB-3).
 *
 * Reemplaza al Kanban (retirado · D4 decisión del usuario). Dos vistas de la MISMA data
 * (toggle DENTRO de la tab · canon hub): Lista operativa (HubCards con acción-gatillo por
 * etapa) ⇄ Por etapa (acordeón). Color del módulo = blue (grupo Comercial). El badge de
 * sobre-compra (B5 · amber) expone `ocCoverage.tieneSobrecompra` del motor de cobertura.
 *
 * Spec: docs/mockups/compras-f4-requerimientos-hub-target-v1.html (Acto 2 · Acto 3).
 */
import React, { useMemo, useState } from 'react';
import {
  Search, ArrowUpDown, List, LayoutList, ChevronDown, ChevronRight,
  Clock, PenLine, CheckCircle, Target, Truck, CheckCircle2, Building2,
  Package, Eye, Check, ShoppingCart, AlertTriangle, XCircle, Sparkles, Layers,
  type LucideIcon,
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { usePermissions } from '../../hooks/usePermissions';
import { getOrigenLabel } from '../../types/requerimiento.types';
import type { Requerimiento, EstadoRequerimiento } from '../../types/requerimiento.types';

interface Props {
  requerimientos: Requerimiento[];
  loading: boolean;
  selectionMode: boolean;
  selectedReqIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onOpenDetail: (req: Requerimiento) => void;
  onAprobar: (req: Requerimiento) => void;
  onCancelar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
  onGenerarOCConsolidada: () => void;
}

type Etapa = 'pendiente' | 'pendiente_aprobacion' | 'aprobado' | 'parcial' | 'en_proceso' | 'completado';
const ETAPA_ORDER: Etapa[] = ['pendiente', 'pendiente_aprobacion', 'aprobado', 'parcial', 'en_proceso', 'completado'];

interface EtapaCfg {
  label: string;
  dot: string;       // bg-x-500 (punto del acordeón / filtro)
  icon: LucideIcon;
  iconBox: string;   // bg-x-50 text-x-600 (cuadro del icono de la card)
  badge: string;     // bg-x-100 text-x-700 (badge de estado)
  count: string;     // text-x-600 (número del chip de etapa)
}

const ETAPA_CFG: Record<Etapa, EtapaCfg> = {
  pendiente:            { label: 'Pendientes',      dot: 'bg-amber-500',  icon: Clock,        iconBox: 'bg-amber-50 text-amber-600',     badge: 'bg-amber-100 text-amber-700',     count: 'text-amber-600' },
  pendiente_aprobacion: { label: 'Esperando firma', dot: 'bg-violet-500', icon: PenLine,      iconBox: 'bg-violet-50 text-violet-600',   badge: 'bg-violet-100 text-violet-700',   count: 'text-violet-600' },
  aprobado:             { label: 'Aprobados',       dot: 'bg-emerald-500', icon: CheckCircle, iconBox: 'bg-emerald-50 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', count: 'text-emerald-600' },
  parcial:              { label: 'OC Parcial',      dot: 'bg-sky-500',    icon: Target,       iconBox: 'bg-sky-50 text-sky-600',         badge: 'bg-sky-100 text-sky-700',         count: 'text-sky-600' },
  en_proceso:           { label: 'En proceso',      dot: 'bg-blue-500',   icon: Truck,        iconBox: 'bg-blue-50 text-blue-600',       badge: 'bg-blue-100 text-blue-700',       count: 'text-blue-600' },
  completado:           { label: 'Completados',     dot: 'bg-slate-300',  icon: CheckCircle2, iconBox: 'bg-slate-100 text-slate-400',    badge: 'bg-slate-100 text-slate-500',     count: 'text-slate-500' },
};

function etapaDe(estado: EstadoRequerimiento): Etapa | null {
  switch (estado) {
    case 'pendiente':
    case 'borrador': return 'pendiente';
    case 'pendiente_aprobacion': return 'pendiente_aprobacion';
    case 'aprobado': return 'aprobado';
    case 'parcial': return 'parcial';
    case 'en_proceso': return 'en_proceso';
    case 'completado': return 'completado';
    case 'cancelado': return null; // los cancelados no aparecen en el tablero operativo
    default: return null;
  }
}

const PRIORIDAD_RANK: Record<string, number> = { urgente: 0, alta: 1, media: 2, normal: 2, baja: 3 };

export const TableroRequerimientos: React.FC<Props> = ({
  requerimientos, loading, selectionMode, selectedReqIds, onToggleSelection,
  onOpenDetail, onAprobar, onCancelar, onGenerarOC, onGenerarOCConsolidada,
}) => {
  const [vista, setVista] = useState<'lista' | 'etapa'>('lista');
  const [filtroEtapa, setFiltroEtapa] = useState<Etapa | 'todas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [porUrgencia, setPorUrgencia] = useState(true);
  const [colapsadas, setColapsadas] = useState<Set<Etapa>>(new Set(['en_proceso', 'completado']));

  // Operativos = no cancelados (con su etapa derivada)
  const operativos = useMemo(
    () => requerimientos
      .map(r => ({ req: r, etapa: etapaDe(r.estado) }))
      .filter((x): x is { req: Requerimiento; etapa: Etapa } => x.etapa !== null),
    [requerimientos]
  );

  const conteoPorEtapa = useMemo(() => {
    const m = {} as Record<Etapa, number>;
    for (const e of ETAPA_ORDER) m[e] = 0;
    for (const { etapa } of operativos) m[etapa]++;
    return m;
  }, [operativos]);

  const aprobadosListos = conteoPorEtapa.aprobado;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let arr = operativos.filter(({ req, etapa }) => {
      if (filtroEtapa !== 'todas' && etapa !== filtroEtapa) return false;
      if (!q) return true;
      const hay = [
        req.numeroRequerimiento,
        getOrigenLabel(req),
        req.nombreClienteSolicitante || '',
        ...req.productos.map(p => p.nombreComercial || ''),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (porUrgencia) {
      arr = [...arr].sort((a, b) =>
        (PRIORIDAD_RANK[a.req.prioridad] ?? 9) - (PRIORIDAD_RANK[b.req.prioridad] ?? 9)
      );
    }
    return arr;
  }, [operativos, filtroEtapa, busqueda, porUrgencia]);

  const toggleColapso = (e: Etapa) =>
    setColapsadas(prev => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e); else next.add(e);
      return next;
    });

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* ZONA 1 · toolbar (chips de etapa + buscador + orden) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Etapa:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFiltroEtapa('todas')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                filtroEtapa === 'todas' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todas <span className="tabular-nums">{operativos.length}</span>
            </button>
            {ETAPA_ORDER.map(e => {
              const cfg = ETAPA_CFG[e];
              const active = filtroEtapa === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setFiltroEtapa(active ? 'todas' : e)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                    active ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cfg.label} <span className={`tabular-nums ${active ? '' : cfg.count}`}>{conteoPorEtapa[e]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-slate-100" />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar requerimiento, producto, solicitante…"
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setPorUrgencia(v => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-3 py-2 border ${
              porUrgencia ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" /> Más urgente
          </button>
        </div>
      </div>

      {/* ZONA 2 · banner acción-gatillo de lote (N aprobados listos) */}
      {aprobadosListos > 0 && !selectionMode && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100/30 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span><b className="text-slate-900">{aprobadosListos} aprobado{aprobadosListos > 1 ? 's' : ''}</b> listo{aprobadosListos > 1 ? 's' : ''} para comprar · agrúpalos por viajero y emite en una pasada.</span>
          </div>
          <button
            type="button"
            onClick={onGenerarOCConsolidada}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 flex-shrink-0"
          >
            <Layers className="w-4 h-4" /> Generar OC Consolidada
          </button>
        </div>
      )}

      {/* ZONA 3 · toggle de vistas (misma data) */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-slate-700">{filtrados.length} requerimiento{filtrados.length === 1 ? '' : 's'}</span>
        <div className="bg-slate-100 rounded-lg p-1 flex">
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 ${vista === 'lista' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List className="w-3.5 h-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setVista('etapa')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 ${vista === 'etapa' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <LayoutList className="w-3.5 h-3.5" /> Por etapa
          </button>
        </div>
      </div>

      {/* ZONA 4 · contenido */}
      {loading && requerimientos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-12 flex flex-col items-center justify-center text-slate-400">
          <span className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2" />
          <p className="text-[13px]">Cargando requerimientos…</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-12 flex flex-col items-center justify-center text-slate-400">
          <Package className="w-8 h-8 mb-2" />
          <p className="text-[13px]">No hay requerimientos en esta vista</p>
        </div>
      ) : vista === 'lista' ? (
        <div className="space-y-2.5">
          {filtrados.map(({ req, etapa }) => (
            <CardOperativa
              key={req.id}
              req={req}
              etapa={etapa}
              selectionMode={selectionMode}
              selected={selectedReqIds.has(req.id!)}
              onToggleSelection={onToggleSelection}
              onOpenDetail={onOpenDetail}
              onAprobar={onAprobar}
              onCancelar={onCancelar}
              onGenerarOC={onGenerarOC}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {ETAPA_ORDER.filter(e => conteoPorEtapa[e] > 0).map(e => {
            const cfg = ETAPA_CFG[e];
            const items = filtrados.filter(x => x.etapa === e);
            if (items.length === 0) return null;
            const abierta = !colapsadas.has(e);
            return (
              <div key={e}>
                <button
                  type="button"
                  onClick={() => toggleColapso(e)}
                  className="w-full flex items-center justify-between px-5 py-2.5 bg-slate-50/60 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                    <span className={`text-[10px] ${cfg.badge} px-1.5 rounded-full font-bold tabular-nums`}>{items.length}</span>
                  </span>
                  {abierta ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {abierta && (
                  <div className="p-3 space-y-2.5 bg-slate-50/30">
                    {items.map(({ req }) => (
                      <FilaAcordeon
                        key={req.id}
                        req={req}
                        etapa={e}
                        onOpenDetail={onOpenDetail}
                        onAprobar={onAprobar}
                        onGenerarOC={onGenerarOC}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Card de la vista Lista (HubCard con acción-gatillo por etapa) ───────────────
const CardOperativa: React.FC<{
  req: Requerimiento;
  etapa: Etapa;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  onOpenDetail: (req: Requerimiento) => void;
  onAprobar: (req: Requerimiento) => void;
  onCancelar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
}> = ({ req, etapa, selectionMode, selected, onToggleSelection, onOpenDetail, onAprobar, onCancelar, onGenerarOC }) => {
  const cfg = ETAPA_CFG[etapa];
  const Icono = cfg.icon;
  const sobreCompra = req.ocCoverage?.tieneSobrecompra === true;
  const seleccionable = selectionMode && etapa === 'aprobado';
  const ring = etapa === 'pendiente_aprobacion' ? 'border-violet-200 ring-1 ring-violet-100' : sobreCompra ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200';

  const handleCardClick = () => {
    if (seleccionable) onToggleSelection(req.id!);
    else onOpenDetail(req);
  };

  return (
    <div className={`bg-white border ${ring} ${selected ? 'bg-blue-50/40 border-blue-300' : 'hover:border-blue-300'} rounded-xl transition-colors`}>
      <div className="p-3.5 flex items-center gap-3">
        {seleccionable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelection(req.id!)}
            onClick={e => e.stopPropagation()}
            className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
          />
        )}
        <button type="button" onClick={handleCardClick} className={`w-10 h-10 rounded-lg ${cfg.iconBox} flex items-center justify-center flex-shrink-0`}>
          <Icono className="w-5 h-5" />
        </button>
        <button type="button" onClick={handleCardClick} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5 text-[13px]">
            <span className="font-semibold text-slate-900">{req.numeroRequerimiento}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600 truncate flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-amber-500" /> {getOrigenLabel(req)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
            {(req.prioridad === 'alta' || req.prioridad === 'urgente') && (
              <span className="inline-flex items-center gap-0.5 bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase">
                <AlertTriangle className="w-2.5 h-2.5" /> {req.prioridad}
              </span>
            )}
            <span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {req.productos.length} prod</span>
            {etapa === 'parcial' && req.ocCoverage && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-24 bg-slate-100 rounded-full h-1.5"><span className="block bg-sky-500 h-1.5 rounded-full" style={{ width: `${req.ocCoverage.porcentaje}%` }} /></span>
                <span className="text-[10px] text-slate-400">{req.ocCoverage.porcentaje}% · {req.ocCoverage.productosPendientes} pend.</span>
              </span>
            )}
            {etapa === 'pendiente_aprobacion' && (
              <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                <PenLine className="w-3 h-3" /> Falta firma
              </span>
            )}
            {sobreCompra && (
              <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase">
                <AlertTriangle className="w-2.5 h-2.5" /> Sobre-compra
              </span>
            )}
            {etapa === 'en_proceso' && req.ordenCompraNumeros && req.ordenCompraNumeros.length > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-600"><ShoppingCart className="w-3 h-3" /> {req.ordenCompraNumeros.join(', ')}</span>
            )}
          </div>
        </button>
        <div className="text-right flex-shrink-0">
          <div className="text-[14px] font-bold tabular-nums text-blue-700">{formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}</div>
          <span className={`text-[10px] font-medium ${cfg.badge} px-2 py-0.5 rounded-full`}>{cfg.label.replace(/s$/, '')}</span>
        </div>
        <AccionGatillo req={req} etapa={etapa} onAprobar={onAprobar} onGenerarOC={onGenerarOC} onOpenDetail={onOpenDetail} />
        {(etapa === 'pendiente' || etapa === 'pendiente_aprobacion' || etapa === 'aprobado' || etapa === 'parcial') && (
          <button type="button" onClick={() => onCancelar(req)} title="Cancelar requerimiento" className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1.5 flex-shrink-0">
            <XCircle className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={() => onOpenDetail(req)} className="text-blue-600 hover:bg-blue-50 rounded-lg p-1.5 flex-shrink-0"><Eye className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// Acción de avance única por etapa (el payload lo maneja el handler del flujo)
const AccionGatillo: React.FC<{
  req: Requerimiento;
  etapa: Etapa;
  onAprobar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
  onOpenDetail: (req: Requerimiento) => void;
}> = ({ req, etapa, onAprobar, onGenerarOC }) => {
  const { canApproveEgresoDe } = usePermissions(); // F4 · gating amount-aware (≤$1k cargo · >$1k socio)
  const puedeAutorizar = canApproveEgresoDe(req.montoEstimadoUSD || 0);
  if (etapa === 'pendiente') {
    if (!puedeAutorizar) {
      return <span className="text-[11px] text-slate-400 italic px-2 flex-shrink-0">Pendiente de aprobación</span>;
    }
    return (
      <button type="button" onClick={() => onAprobar(req)} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 flex-shrink-0">
        <Check className="w-4 h-4" /> Aprobar
      </button>
    );
  }
  if (etapa === 'pendiente_aprobacion') {
    if (!puedeAutorizar) {
      return <span className="text-[11px] text-violet-400 italic px-2 flex-shrink-0">Esperando firma</span>;
    }
    return (
      <button type="button" onClick={() => onAprobar(req)} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg px-3 py-2 flex-shrink-0">
        <PenLine className="w-4 h-4" /> Firmar
      </button>
    );
  }
  if (etapa === 'aprobado') {
    return (
      <button type="button" onClick={() => onGenerarOC(req)} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 flex-shrink-0">
        <ShoppingCart className="w-4 h-4" /> Generar OC
      </button>
    );
  }
  if (etapa === 'parcial') {
    return (
      <button type="button" onClick={() => onGenerarOC(req)} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 flex-shrink-0">
        <ShoppingCart className="w-4 h-4" /> Continuar OC
      </button>
    );
  }
  return null;
};

// ─── Fila compacta de la vista Por etapa (acordeón) ──────────────────────────────
const FilaAcordeon: React.FC<{
  req: Requerimiento;
  etapa: Etapa;
  onOpenDetail: (req: Requerimiento) => void;
  onAprobar: (req: Requerimiento) => void;
  onGenerarOC: (req: Requerimiento) => void;
}> = ({ req, etapa, onOpenDetail, onAprobar, onGenerarOC }) => {
  const cfg = ETAPA_CFG[etapa];
  const Icono = cfg.icon;
  const ring = etapa === 'pendiente_aprobacion' ? 'border-violet-200' : 'border-slate-200';
  return (
    <div className={`bg-white border ${ring} rounded-xl p-3 flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-lg ${cfg.iconBox} flex items-center justify-center flex-shrink-0`}><Icono className="w-4 h-4" /></div>
      <button type="button" onClick={() => onOpenDetail(req)} className="min-w-0 flex-1 text-left">
        <div className="text-[13px]"><span className="font-semibold text-slate-900">{req.numeroRequerimiento}</span> <span className="text-slate-300">·</span> <span className="text-slate-600">{getOrigenLabel(req)}</span></div>
        <div className="text-[11px] text-slate-500 mt-0.5">{req.productos.length} prod · {formatCurrency(req.expectativa?.costoTotalEstimadoUSD || 0)}</div>
      </button>
      <AccionGatillo req={req} etapa={etapa} onAprobar={onAprobar} onGenerarOC={onGenerarOC} onOpenDetail={onOpenDetail} />
    </div>
  );
};
