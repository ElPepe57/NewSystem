/**
 * ProductoDetalleModal — Imp-L2 · Refactor visual S58e (mockup M2)
 *
 * Modal banking-grade pixel-perfect que muestra el detalle completo de un
 * producto financiero. Replica el patrón de OrdenCompraCard + EnvioDetailModal
 * (referencias canónicas S54.x).
 *
 * Estructura:
 *   - Header hero gradiente (teal cuentas / indigo TC)
 *   - KPI row de 4 KPIs adaptados al tipo
 *   - Tabs sticky (Resumen / Movimientos / Canales / TC Cargos / TC Pagos / Auditoría)
 *   - Footer con acciones (Editar / Eliminar / TC: Cargar / TC: Pagar EC)
 *
 * Para TC: los wizards CargarTarjetaWizard y PagarEstadoCuentaWizard se
 * lanzan desde los botones del footer (Q-A6 confirmado).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Trash2, Plus, Banknote, ArrowDownLeft } from 'lucide-react';
import { useTesoreriaStore } from '../../../store/tesoreriaStore';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';
import { HeaderHero } from './HeaderHero';
import { KpiRow } from './KpiRow';
import { TabResumen } from './TabResumen';
import { TabMovimientos } from './TabMovimientos';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

type TabKey = 'resumen' | 'movimientos' | 'canales' | 'auditoria' | 'tc_cargos' | 'tc_pagos';

interface TabDef {
  key: TabKey;
  label: string;
  /** Solo visible si el predicate retorna true */
  visible: (c: CuentaCaja) => boolean;
}

const TABS: TabDef[] = [
  { key: 'resumen', label: 'Resumen', visible: () => true },
  { key: 'movimientos', label: 'Movimientos', visible: () => true },
  {
    key: 'canales',
    label: 'Canales',
    visible: (c) => c.tipo === 'banco' && (c.canalesDigitales?.length ?? 0) > 0,
  },
  {
    key: 'tc_cargos',
    label: 'TC: Cargos',
    visible: (c) => c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_credito',
  },
  {
    key: 'tc_pagos',
    label: 'TC: Pagos',
    visible: (c) => c.tipo === 'credito' && c.productoFinanciero === 'tarjeta_credito',
  },
  { key: 'auditoria', label: 'Auditoría', visible: () => true },
];

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export interface ProductoDetalleModalProps {
  isOpen: boolean;
  cuenta: CuentaCaja | null;
  onClose: () => void;
  onEditar?: (c: CuentaCaja) => void;
  onEliminar?: (c: CuentaCaja) => void;
  /** Solo TC: lanzar wizard CargarTarjetaWizard (TX-1) */
  onCargarTC?: (c: CuentaCaja) => void;
  /** Solo TC: lanzar wizard PagarEstadoCuentaWizard (TX-2) */
  onPagarECTC?: (c: CuentaCaja) => void;
}

export const ProductoDetalleModal: React.FC<ProductoDetalleModalProps> = ({
  isOpen,
  cuenta,
  onClose,
  onEditar,
  onEliminar,
  onCargarTC,
  onPagarECTC,
}) => {
  const movimientos = useTesoreriaStore((s) => s.movimientos);

  const [tab, setTab] = useState<TabKey>('resumen');

  // Reset tab al abrir
  useEffect(() => {
    if (isOpen) setTab('resumen');
  }, [isOpen]);

  // ESC para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Tabs visibles según el producto
  const tabsVisibles = useMemo(() => {
    if (!cuenta) return [];
    return TABS.filter((t) => t.visible(cuenta));
  }, [cuenta]);

  // KPIs derivados de movimientos
  const movimientosMes = useMemo(() => {
    if (!cuenta) return 0;
    const ahora = new Date();
    const mes = ahora.getMonth();
    const año = ahora.getFullYear();
    return movimientos.filter((m) => {
      if (m.cuentaOrigen !== cuenta.id && m.cuentaDestino !== cuenta.id) return false;
      const d = m.fecha?.toDate?.();
      if (!d) return false;
      return d.getMonth() === mes && d.getFullYear() === año;
    }).length;
  }, [movimientos, cuenta]);

  const totalMovidoPEN = useMemo(() => {
    if (!cuenta) return 0;
    const ahora = new Date();
    return movimientos
      .filter((m) => {
        if (m.cuentaOrigen !== cuenta.id && m.cuentaDestino !== cuenta.id) return false;
        const d = m.fecha?.toDate?.();
        if (!d) return false;
        return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
      })
      .reduce((sum, m) => sum + (m.montoEquivalentePEN || m.monto), 0);
  }, [movimientos, cuenta]);

  if (!isOpen || !cuenta) return null;

  const esTC = cuenta.tipo === 'credito' && cuenta.productoFinanciero === 'tarjeta_credito';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header hero */}
        <HeaderHero
          cuenta={cuenta}
          codigo={cuenta.id.slice(0, 8).toUpperCase()}
          onClose={onClose}
        />

        {/* KPI row */}
        <KpiRow
          cuenta={cuenta}
          movimientosMes={movimientosMes}
          totalMovidoPEN={totalMovidoPEN}
        />

        {/* Tabs sticky */}
        <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex overflow-x-auto px-4 hide-scrollbar">
            {tabsVisibles.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
                  tab === t.key
                    ? 'text-teal-700 border-teal-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido del tab */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'resumen' && <TabResumen cuenta={cuenta} />}
          {tab === 'movimientos' && (
            <TabMovimientos cuenta={cuenta} movimientos={movimientos} />
          )}
          {tab === 'canales' && (
            <div className="p-6 text-sm text-slate-500 text-center">
              Tab Canales — detalle expandido de Yape/Plin/SIP/Ágora/BIM.
              <div className="text-xs mt-2 italic">
                Implementación detallada pendiente. Por ahora ver el preview en
                tab Resumen.
              </div>
            </div>
          )}
          {tab === 'tc_cargos' && (
            <div className="p-6 text-sm text-slate-500 text-center">
              Lista de CargoTarjeta vinculados (S58d v2). Implementación
              pendiente · DEUDA-PF-001 (cleanup TC).
            </div>
          )}
          {tab === 'tc_pagos' && (
            <div className="p-6 text-sm text-slate-500 text-center">
              Historial de pagos de estado de cuenta (TX-2). Implementación
              pendiente · DEUDA-PF-001 (cleanup TC).
            </div>
          )}
          {tab === 'auditoria' && (
            <div className="p-6 space-y-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Auditoría
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Creado por</span>
                  <span className="font-mono text-slate-800">{cuenta.creadoPor || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha creación</span>
                  <span className="text-slate-800">
                    {cuenta.fechaCreacion?.toDate?.().toLocaleString('es-PE') ?? '—'}
                  </span>
                </div>
                {cuenta.actualizadoPor && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Última edición</span>
                      <span className="font-mono text-slate-800">{cuenta.actualizadoPor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha edición</span>
                      <span className="text-slate-800">
                        {cuenta.fechaActualizacion?.toDate?.().toLocaleString('es-PE') ?? '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer acciones */}
        <div className="border-t border-slate-200 px-5 py-3 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {onEditar && (
              <button
                type="button"
                onClick={() => onEditar(cuenta)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
            {onEliminar && (
              <button
                type="button"
                onClick={() => onEliminar(cuenta)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            )}
          </div>

          {/* Botones TC */}
          {esTC && (
            <div className="flex items-center gap-2 flex-wrap">
              {onCargarTC && (
                <button
                  type="button"
                  onClick={() => onCargarTC(cuenta)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cargar a TC
                </button>
              )}
              {onPagarECTC && (
                <button
                  type="button"
                  onClick={() => onPagarECTC(cuenta)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Pagar estado de cuenta
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
