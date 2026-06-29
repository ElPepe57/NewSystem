/**
 * EmpujarProveedorModal · Fase 1 (Llegadas) · la ÚNICA acción de CAPTURA propia del módulo.
 *
 * Lo que abre el botón "Empujar" del radar de atrasados. Registra un seguimiento sobre el RESPONSABLE
 * de la pierna en curso — PROVEEDOR (envío aún no despachado) o VIAJERO (envío en tránsito) —
 * (Contactar / Escalar / registrar Promesa de fecha) cuando una OC en vuelo va tarde.
 *
 * PERSISTENCIA (camino más limpio · NO se inventa colección nueva): escribe una entrada en
 * `ordenesCompra/{ocId}.comentariosInternos[]` vía `arrayUnion` — el MISMO campo y patrón que
 * usa `TimelineOCPanel.agregarComentario`, de modo que el "empujón" queda en el HISTORIAL de la OC
 * (Timeline) sin tocar nada más. El texto codifica A QUIÉN se empujó (proveedor/viajero + nombre) +
 * tipo + canal + fecha-promesa + nota. El viajero NO tiene colección propia donde persistir limpio
 * → se anota igual en el comentario de la OC indicando "viajero: {nombre}".
 *
 * FormModalV2 resuelve desktop=modal / mobile=bottom-sheet automáticamente (vía el Modal base).
 */

import React, { useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { FormModalV2 } from '../../../design-system';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import {
  Megaphone, Phone, TrendingUp, CalendarClock, AlertTriangle, Calendar, ChevronDown, History,
} from 'lucide-react';
import type { FilaRadarLlegada } from '../useRadarAtrasados';
import { GRAVEDAD_META, CULPABLE_META } from '../radarLlegadas.ui';

type TipoEmpuje = 'contactar' | 'escalar' | 'promesa';
type CanalEmpuje = 'WhatsApp' | 'Email' | 'Llamada' | 'Plataforma del courier';

interface EmpujarProveedorModalProps {
  fila: FilaRadarLlegada | null;
  onClose: () => void;
  /** Avisar al padre para refrescar la OC seleccionada (el Timeline se actualiza por onSnapshot). */
  onRegistrado?: () => void;
}

const TIPO_OPTS: { value: TipoEmpuje; label: string; icon: React.ElementType }[] = [
  { value: 'contactar', label: 'Contactar', icon: Phone },
  { value: 'escalar', label: 'Escalar', icon: TrendingUp },
  { value: 'promesa', label: 'Promesa', icon: CalendarClock },
];

const CANAL_OPTS: CanalEmpuje[] = ['WhatsApp', 'Email', 'Llamada', 'Plataforma del courier'];

const TIPO_LABEL: Record<TipoEmpuje, string> = {
  contactar: 'Contacto',
  escalar: 'Escalación',
  promesa: 'Promesa de fecha',
};

export const EmpujarProveedorModal: React.FC<EmpujarProveedorModalProps> = ({
  fila, onClose, onRegistrado,
}) => {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore();
  const [tipo, setTipo] = useState<TipoEmpuje>('contactar');
  const [canal, setCanal] = useState<CanalEmpuje>('WhatsApp');
  const [promesaFecha, setPromesaFecha] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir con otra fila.
  useEffect(() => {
    if (fila) {
      setTipo('contactar');
      setCanal('WhatsApp');
      setPromesaFecha('');
      setNota('');
    }
  }, [fila?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fila) return null;

  const meta = GRAVEDAD_META[fila.gravedad];
  const culp = CULPABLE_META[fila.culpable];
  // A quién se empuja: nombre del responsable de la pierna en curso (proveedor o viajero).
  const targetNombre = fila.responsableNombre || fila.proveedor;
  // Etiqueta para el comentario · "proveedor" o "viajero: {nombre}" (el viajero no tiene colección propia).
  const targetTraza =
    fila.culpable === 'viajero' ? `viajero: ${targetNombre}` : `proveedor: ${targetNombre}`;

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Necesitás estar autenticado para registrar el seguimiento.');
      return;
    }
    setGuardando(true);
    try {
      // Texto del comentario interno = traza del empujón en el Timeline de la OC.
      // Codifica A QUIÉN se empujó (proveedor/viajero + nombre) · la pierna en curso del atraso.
      const partes = [
        `Empuje a ${targetTraza} · ${TIPO_LABEL[tipo]} (${canal})`,
        `${fila.numero} · ${fila.proveedor} · pierna ${fila.culpable} · atraso ${fila.diasEnVuelo}/${fila.leadTimeEsperado}d (${fila.gravedad})`,
        tipo === 'promesa' && promesaFecha ? `Nueva fecha prometida: ${promesaFecha}` : '',
        nota.trim() ? `Nota: ${nota.trim()}` : '',
      ].filter(Boolean);

      const comentario = {
        id: `COM-${Date.now()}`,
        texto: partes.join(' · '),
        autor: user.uid,
        autorNombre: user.displayName || user.email || undefined,
        fecha: Timestamp.now(),
      };

      // Mismo patrón que TimelineOCPanel: arrayUnion sobre comentariosInternos del doc de la OC.
      await updateDoc(doc(db, 'ordenesCompra', fila.orden.id), {
        comentariosInternos: arrayUnion(comentario),
      });

      toast.success('Empuje registrado · quedó en el historial de la OC', 'Seguimiento registrado');
      onRegistrado?.();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo registrar el seguimiento';
      toast.error(msg, 'Error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <FormModalV2
      isOpen={!!fila}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={fila.culpable === 'viajero' ? 'Empujar viajero' : 'Empujar proveedor'}
      subtitle={`${fila.numero} · ${culp.label.replace('empujar ', '')}: ${targetNombre}`}
      icon={Megaphone}
      iconTone="red"
      size="sm"
      submitLabel="Registrar empuje"
      submitIcon={Megaphone}
      submitVariant="primary"
      loading={guardando}
      footerExtras={
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <History className="w-3 h-3" /> Queda en el historial de la OC
        </span>
      }
    >
      <div className="space-y-4">
        {/* a quién se empuja · la pierna en curso del atraso (color cross-módulo N4) */}
        <div className={`rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] ${culp.chip}`}>
          <culp.icon className={`w-3.5 h-3.5 ${culp.iconColor} flex-shrink-0`} />
          <span className="font-semibold">{culp.label} · <b>{targetNombre}</b></span>
          <span className="ml-auto text-[10px] font-medium opacity-80">{culp.pierna}</span>
        </div>

        {/* contexto rápido del atraso (read-only · semántico) */}
        <div className={`${meta.banner} rounded-xl px-3 py-2.5 flex items-center gap-2 text-[11px]`}>
          <AlertTriangle className={`w-3.5 h-3.5 ${meta.bannerIcon} flex-shrink-0`} />
          <span className={meta.bannerText}>
            <b className="tabular-nums">{fila.diasEnVuelo} / {fila.leadTimeEsperado}d</b>
            {' · '}{meta.label} {fila.ratio.toFixed(1)}×
            {' · señal de tracking: pendiente'}
          </span>
        </div>

        {/* tipo de empuje (toggle group) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Tipo de empuje
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {TIPO_OPTS.map(({ value, label, icon: Icon }) => {
              const activo = tipo === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTipo(value)}
                  className={`text-[12px] font-semibold px-2 py-2 rounded-lg flex flex-col items-center gap-1 min-h-[44px] transition-colors ${
                    activo
                      ? 'text-rose-700 bg-rose-50 border border-rose-300 ring-2 ring-rose-500/30'
                      : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* canal */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Canal
          </label>
          <div className="relative">
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as CanalEmpuje)}
              className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2.5 appearance-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 min-h-[44px]"
            >
              {CANAL_OPTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* nueva fecha prometida (solo si tipo=promesa) */}
        {tipo === 'promesa' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block flex items-center gap-1.5">
              Nueva fecha prometida
              <span className="text-[9px] font-medium text-slate-400 normal-case tracking-normal">· si el proveedor se compromete</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={promesaFecha}
                onChange={(e) => setPromesaFecha(e.target.value)}
                className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2.5 tabular-nums focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 min-h-[44px]"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* nota */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Nota del seguimiento
          </label>
          <textarea
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: Pedí tracking actualizado · confirmó despacho esta semana…"
            className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300"
          />
        </div>
      </div>
    </FormModalV2>
  );
};
