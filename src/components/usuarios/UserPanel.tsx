/**
 * UserPanel.tsx · chk5.PERSONAS-v5.7 · E3.1 Shell (2026-05-28)
 *
 * Drawer canon F6-E (slide-in derecha en desktop · bottom-sheet en mobile).
 *
 * COMPONENTE COMPARTIDO entre:
 *   · /usuarios     (hub maestro · todos los tabs disponibles)
 *   · /planilla     (tabs operativos destacados · Boletas · Pagos · Incentivos)
 *   · /honorarios   (cuando exista · tabs Recibos · Retenciones)
 *   · /inversionistas (tabs Cap table · Distribuciones · Aportes)
 *
 * El componente padre invoca el panel pasando:
 *   - userId · qué persona mostrar
 *   - tabInicial? · qué tab abrir por default (default 'resumen')
 *   - tabsAdicionales? · array de tabs contextuales del módulo padre (lazy)
 *
 * E3.1 entrega: shell + header + tabs nav + state activeTab + ESC + click overlay.
 * E3.2-E3.4 llenan el contenido de cada tab.
 *
 * CANONS APLICADOS:
 *   - F6-E (drawer lateral · NO drill page)
 *   - N8 (cross-link siempre visible · banner con "Abrir en X")
 *   - Responsive desde sm: (640px) · mobile bottom-sheet
 *   - Tabular-nums en métricas
 *   - Lucide icons únicos · sin emojis en chrome de UI
 *   - Color semántico v8.0 N1: teal=empleado · sky=honorarios · purple=socio · amber=externo
 */

import React, { useEffect, useState, useMemo } from 'react';
import { X, User, Briefcase, FileText, Shield, History, Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../../config/collections';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import type { UserProfile } from '../../types/auth.types';
import type { RelacionLaboral } from '../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
  getRelacionesActivas,
  esMultiRelacion,
} from '../../types/relacionLaboral.types';
// E3.2 · TabResumen real
import { TabResumen } from './userPanel/TabResumen';
// E3.3 · TabRelaciones PROTAGONISTA (canon v5.6 multi-relación)
import { TabRelaciones } from './userPanel/TabRelaciones';
// E3.4 · Tabs restantes
import { TabDatos } from './userPanel/TabDatos';
import { TabPermisos } from './userPanel/TabPermisos';
import { TabHistorico } from './userPanel/TabHistorico';
import { TabVinculacion } from './userPanel/TabVinculacion';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS DE TABS
// ═════════════════════════════════════════════════════════════════════════

/** Tabs core · siempre disponibles */
export type CoreTabId = 'resumen' | 'relaciones' | 'datos' | 'permisos' | 'historico';

/** Tab condicional v5.8 · aparece solo si user tiene relación externa con entidadMaestroRef */
export type VinculacionTabId = 'vinculacion';

/** Tabs contextuales del módulo padre · lazy · el padre los define */
export interface TabContextual {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  /** Componente lazy a renderizar · recibe userId como prop */
  render: (userId: string) => React.ReactNode;
}

export type TabId = CoreTabId | VinculacionTabId | string;

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface UserPanelProps {
  /** UID del User a mostrar · null/undefined cierra el panel */
  userId: string | null;
  /** Callback al cerrar (X · ESC · click overlay) */
  onClose: () => void;
  /** Tab inicial · default 'resumen' */
  tabInicial?: TabId;
  /** Tabs contextuales del módulo padre (ej. /planilla agrega 'boletas' · 'pagos' · 'incentivos') */
  tabsContextuales?: TabContextual[];
  // ── Callbacks de acciones sobre relaciones · E5 conecta modales reales ─────
  /** Click "+ Agregar relación" desde el tab Relaciones */
  onAgregarRelacion?: (userId: string) => void;
  /** Click "Editar" en una RelacionCard */
  onEditarRelacion?: (r: import('../../types/relacionLaboral.types').RelacionLaboral) => void;
  /** Click "Pausar" · vigente → pausada */
  onPausarRelacion?: (r: import('../../types/relacionLaboral.types').RelacionLaboral) => void;
  /** Click "Reanudar" · pausada → vigente */
  onReanudarRelacion?: (r: import('../../types/relacionLaboral.types').RelacionLaboral) => void;
  /** Click "Reclasificar" · transición atómica */
  onReclasificarRelacion?: (r: import('../../types/relacionLaboral.types').RelacionLaboral) => void;
  /** Click "Finalizar" · vigente → finalizada (snapshot) */
  onFinalizarRelacion?: (r: import('../../types/relacionLaboral.types').RelacionLaboral) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER · Color del avatar según rol principal o tipo de primera relación
// ═════════════════════════════════════════════════════════════════════════

function getAvatarGradient(user: UserProfile | null, relaciones: RelacionLaboral[]): string {
  if (!user) return 'from-slate-400 to-slate-600';
  // Si tiene relación 'empleado' vigente · teal
  const activas = getRelacionesActivas(relaciones);
  if (activas.some(r => r.tipo === 'empleado')) return 'from-teal-400 to-teal-600';
  if (activas.some(r => r.tipo === 'socio')) return 'from-purple-400 to-purple-600';
  if (activas.some(r => r.tipo === 'honorarios')) return 'from-sky-400 to-sky-600';
  if (activas.some(r => r.tipo === 'externo')) return 'from-amber-400 to-orange-600';
  return 'from-slate-400 to-slate-600';
}

function getIniciales(displayName: string | undefined): string {
  if (!displayName) return '?';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const UserPanel: React.FC<UserPanelProps> = ({
  userId,
  onClose,
  tabInicial = 'resumen',
  tabsContextuales = [],
  onAgregarRelacion,
  onEditarRelacion,
  onPausarRelacion,
  onReanudarRelacion,
  onReclasificarRelacion,
  onFinalizarRelacion,
}) => {
  // ── Data loading state ─────────────────────────────────────────────────
  const [user, setUser] = useState<UserProfile | null>(null);
  const [relaciones, setRelaciones] = useState<RelacionLaboral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Tab activo · state local ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>(tabInicial);

  // ── Reset tab cuando cambia userId (panel se abre con otro user) ────────
  useEffect(() => {
    setActiveTab(tabInicial);
  }, [userId, tabInicial]);

  // ── Fetch user + relaciones cuando el panel se abre ─────────────────────
  useEffect(() => {
    if (!userId) {
      setUser(null);
      setRelaciones([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getDoc(doc(db, COLLECTIONS.USERS, userId)),
      relacionesLaboralesService.listByUser(userId),
    ])
      .then(([userSnap, rels]) => {
        if (cancelled) return;
        if (!userSnap.exists()) {
          setError('Usuario no encontrado');
          setUser(null);
          setRelaciones([]);
        } else {
          setUser({ uid: userSnap.id, ...userSnap.data() } as UserProfile);
          setRelaciones(rels);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[UserPanel] error cargando user/relaciones:', err);
        setError(err.message || 'Error al cargar el panel');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── ESC key handler para cerrar ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [userId, onClose]);

  // ── Detección · ¿mostrar tab Vinculación? (v5.8) ────────────────────────
  const mostrarTabVinculacion = useMemo(() => {
    return relaciones.some(
      r => r.estado !== 'finalizada' && r.tipo === 'externo' && r.entidadMaestroRef,
    );
  }, [relaciones]);

  // ── Computed: relaciones activas + multi-flag ───────────────────────────
  const relacionesActivas = useMemo(() => getRelacionesActivas(relaciones), [relaciones]);
  const isMulti = useMemo(() => esMultiRelacion(relaciones), [relaciones]);

  // Panel cerrado · no renderizar nada
  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-stretch sm:justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-panel-title"
    >
      <aside
        className="bg-white rounded-t-2xl sm:rounded-none sm:max-w-[600px] w-full sm:h-full flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ HEADER ═══ */}
        <div className="border-b border-slate-100 px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-32" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-48" />
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : error || !user ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div className="flex-1">
                <div id="user-panel-title" className="text-sm font-bold text-rose-900">
                  Error al cargar
                </div>
                <div className="text-xs text-rose-700">{error || 'Usuario no encontrado'}</div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {/* Avatar */}
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(user, relaciones)} text-white flex items-center justify-center font-bold text-sm`}
                >
                  {getIniciales(user.displayName)}
                </div>
              )}

              {/* Identidad + chips */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span id="user-panel-title" className="text-base font-bold text-slate-900 truncate">
                    {user.displayName}
                  </span>
                  {isMulti && (
                    <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                      MULTI
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
                {/* Chips de relaciones vigentes */}
                {relacionesActivas.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {relacionesActivas.map((r) => {
                      const colors = TIPO_RELACION_COLORS[r.tipo];
                      return (
                        <span
                          key={r.id}
                          className={`text-[10px] ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1`}
                          title={r.cargoDisplay ?? TIPO_RELACION_LABELS[r.tipo]}
                        >
                          <span>{TIPO_RELACION_ICONS[r.tipo]}</span>
                          <span className="truncate max-w-[140px]">
                            {r.cargoDisplay ?? TIPO_RELACION_LABELS[r.tipo]}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Close X */}
              <button
                onClick={onClose}
                className="w-8 h-8 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
                aria-label="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ═══ TABS NAV ═══ */}
        {!loading && !error && user && (
          <div className="px-5 border-b border-slate-100 flex items-center gap-1 overflow-x-auto scroll-hide flex-shrink-0">
            {/* Core tabs */}
            <TabButton
              id="resumen"
              icon={User}
              label="Resumen"
              active={activeTab === 'resumen'}
              onClick={setActiveTab}
            />
            <TabButton
              id="relaciones"
              icon={Briefcase}
              label={`Relaciones · ${relacionesActivas.length}`}
              active={activeTab === 'relaciones'}
              onClick={setActiveTab}
              highlight // protagonista
            />
            <TabButton
              id="datos"
              icon={FileText}
              label="Datos"
              active={activeTab === 'datos'}
              onClick={setActiveTab}
            />
            <TabButton
              id="permisos"
              icon={Shield}
              label="Permisos"
              active={activeTab === 'permisos'}
              onClick={setActiveTab}
            />
            <TabButton
              id="historico"
              icon={History}
              label="Histórico"
              active={activeTab === 'historico'}
              onClick={setActiveTab}
            />

            {/* Tab Vinculación · condicional v5.8 */}
            {mostrarTabVinculacion && (
              <TabButton
                id="vinculacion"
                icon={LinkIcon}
                label="Vinculación"
                active={activeTab === 'vinculacion'}
                onClick={setActiveTab}
              />
            )}

            {/* Separator visual antes de tabs contextuales */}
            {tabsContextuales.length > 0 && (
              <span className="w-px h-5 bg-slate-300 mx-1 flex-shrink-0" />
            )}

            {/* Tabs contextuales del módulo padre */}
            {tabsContextuales.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabButton
                  key={tab.id}
                  id={tab.id}
                  icon={Icon}
                  label={tab.label}
                  active={activeTab === tab.id}
                  onClick={setActiveTab}
                  contextual
                />
              );
            })}
          </div>
        )}

        {/* ═══ CONTENIDO TAB ACTIVO ═══ */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : error || !user ? (
            <div className="p-5">
              <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-4 text-sm text-rose-900">
                {error || 'No se pudo cargar el usuario.'}
              </div>
            </div>
          ) : (
            <TabContent
              activeTab={activeTab}
              user={user}
              relaciones={relaciones}
              tabsContextuales={tabsContextuales}
              onClose={onClose}
              onChangeTab={setActiveTab}
              onAgregarRelacion={onAgregarRelacion}
              onEditarRelacion={onEditarRelacion}
              onPausarRelacion={onPausarRelacion}
              onReanudarRelacion={onReanudarRelacion}
              onReclasificarRelacion={onReclasificarRelacion}
              onFinalizarRelacion={onFinalizarRelacion}
            />
          )}
        </div>
      </aside>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE · TabButton (botón de tab con estados active/highlight)
// ═════════════════════════════════════════════════════════════════════════

interface TabButtonProps {
  id: TabId;
  icon: React.FC<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: (id: TabId) => void;
  /** Si es el tab protagonista (Relaciones) · destaque visual sutil */
  highlight?: boolean;
  /** Si es contextual del módulo padre · color teal vs slate */
  contextual?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({
  id,
  icon: Icon,
  label,
  active,
  onClick,
  highlight,
  contextual,
}) => {
  return (
    <button
      onClick={() => onClick(id)}
      className={`
        px-3 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-1.5
        transition-all duration-150 border-b-2
        ${active
          ? contextual
            ? 'text-teal-700 border-teal-600 font-semibold'
            : 'text-slate-900 border-purple-600 font-semibold'
          : 'text-slate-500 border-transparent hover:text-slate-900'
        }
        ${highlight && !active ? 'text-slate-700' : ''}
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE · TabContent (router de contenido según tab activo)
// E3.2-E3.4 reemplazan los placeholders con componentes reales
// ═════════════════════════════════════════════════════════════════════════

interface TabContentProps {
  activeTab: TabId;
  user: UserProfile;
  relaciones: RelacionLaboral[];
  tabsContextuales: TabContextual[];
  onClose: () => void;
  onChangeTab: (tabId: TabId) => void;
  onAgregarRelacion?: (userId: string) => void;
  onEditarRelacion?: (r: RelacionLaboral) => void;
  onPausarRelacion?: (r: RelacionLaboral) => void;
  onReanudarRelacion?: (r: RelacionLaboral) => void;
  onReclasificarRelacion?: (r: RelacionLaboral) => void;
  onFinalizarRelacion?: (r: RelacionLaboral) => void;
}

const TabContent: React.FC<TabContentProps> = ({
  activeTab,
  user,
  relaciones,
  tabsContextuales,
  onClose,
  onChangeTab,
  onAgregarRelacion,
  onEditarRelacion,
  onPausarRelacion,
  onReanudarRelacion,
  onReclasificarRelacion,
  onFinalizarRelacion,
}) => {
  // Tabs contextuales del padre · lazy render
  const contextual = tabsContextuales.find((t) => t.id === activeTab);
  if (contextual) {
    return <div className="p-5">{contextual.render(user.uid)}</div>;
  }

  switch (activeTab) {
    case 'resumen':
      return <TabResumen user={user} relaciones={relaciones} onAfterNavigate={onClose} />;
    case 'relaciones':
      return (
        <TabRelaciones
          userId={user.uid}
          relaciones={relaciones}
          onAgregarRelacion={onAgregarRelacion}
          onEditarRelacion={onEditarRelacion}
          onPausarRelacion={onPausarRelacion}
          onReanudarRelacion={onReanudarRelacion}
          onReclasificarRelacion={onReclasificarRelacion}
          onFinalizarRelacion={onFinalizarRelacion}
          onVerVinculacion={() => onChangeTab('vinculacion')}
        />
      );
    case 'datos':
      return <TabDatos user={user} />;
    case 'permisos':
      return <TabPermisos user={user} />;
    case 'historico':
      return <TabHistorico user={user} relaciones={relaciones} />;
    case 'vinculacion':
      return <TabVinculacion relaciones={relaciones} onAfterNavigate={onClose} />;
    default:
      return <PlaceholderTab label="Tab desconocido" subtitle={String(activeTab)} />;
  }
};

const PlaceholderTab: React.FC<{ label: string; subtitle: string }> = ({ label, subtitle }) => (
  <div className="p-5">
    <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-8 text-center">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
        E3.1 placeholder
      </div>
      <div className="text-base font-bold text-slate-700">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  </div>
);

export default UserPanel;
