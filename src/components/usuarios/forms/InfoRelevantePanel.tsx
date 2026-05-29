/**
 * InfoRelevantePanel.tsx · chk5.PERSONAS-v5.9 · E4 (2026-05-28)
 *
 * Panel de alertas contextuales que se muestra en Modo B (user existente
 * seleccionado en autocomplete, SIN relación vigente del tipo del modal).
 *
 * Tres alertas independientes (no mutuamente excluyentes):
 *
 *   1. AlertaReContratacion  · amber · relación previa finalizada del mismo tipo
 *   2. AlertaMultiRol        · sky   · relaciones vigentes de OTROS tipos
 *   3. AlertaDatosIncompletos · amber · teléfono vacío en UserProfile
 *
 * Las alertas se colapsan en mobile cuando hay más de una visible:
 * el panel tiene un toggle "Ver todas" para expandirlas.
 *
 * Decisión de diseño (Completar teléfono):
 *   Opción "inline edit" descartada por complejidad del submit coordinado.
 *   Se usa el patrón "pendingTelefono" · el modal padre recibe el valor vía
 *   onTelefonoPending y lo aplica junto al submit principal. El botón
 *   "Completar ahora" expande un input inline que setea el pending value.
 *   NO dispara updateProfile de inmediato (evita un write extra y la complicación
 *   de coordinar errores en dos writes distintos).
 *
 * Constraints:
 *   - Canon F7 · tabular-nums en montos
 *   - Canon F8 · iconos lucide únicos, sin emojis en chrome UI
 *   - Canon v8.0 N1-N4 · warning=amber, info=sky
 *   - listByUser se llama UNA sola vez al cambiar el user (useEffect con uid dep)
 *   - relacionesVigentes se recibe desde el padre (ya cargadas por PersonaAutocomplete)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Info,
  Phone,
  RotateCcw,
} from 'lucide-react';
import { relacionesLaboralesService } from '../../../services/relacionesLaborales.service';
import { formatFecha } from '../../../utils/dateFormatters';
import type { UserProfile } from '../../../types/auth.types';
import type {
  DatosLaboralesSnapshot,
  DatosSocioSnapshot,
  RelacionLaboral,
  TipoRelacion,
} from '../../../types/relacionLaboral.types';
import {
  MOTIVO_FIN_LABELS,
  TIPO_RELACION_COLORS,
  TIPO_RELACION_LABELS,
} from '../../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═════════════════════════════════════════════════════════════════════════

/** Formatea meses con fallback "mes pasado" / "hace N meses" */
function mesesAtras(ms: number): string {
  const meses = Math.floor(ms / (1000 * 60 * 60 * 24 * 30));
  if (meses <= 0) return 'Este mes';
  if (meses === 1) return 'Hace 1 mes';
  return `Hace ${meses} meses`;
}

/** Formatea sueldo con moneda */
function formatSueldo(monto: number, moneda: 'PEN' | 'USD'): string {
  const simbolo = moneda === 'USD' ? '$' : 'S/';
  return `${simbolo}${monto.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${moneda}`;
}

// ═════════════════════════════════════════════════════════════════════════
// TIPOS PÚBLICOS
// ═════════════════════════════════════════════════════════════════════════

export interface InfoRelevantePanelProps {
  /** User seleccionado en el autocomplete. null = panel no renderiza nada. */
  user: UserProfile | null;
  /** Tipo del modal que llama (empleado | socio | etc.). */
  tipoModal: TipoRelacion;
  /**
   * Relaciones vigentes del user — ya cargadas por PersonaAutocomplete.
   * El panel las usa para AlertaMultiRol sin un fetch extra.
   */
  relacionesVigentes: RelacionLaboral[];
  /**
   * Callback cuando el usuario hace click en "Pre-rellenar" (Alerta 1).
   * El modal padre recibe el snapshot y setea cargo + sueldo + moneda.
   */
  onPrefillFromHistory: (
    snapshot: DatosLaboralesSnapshot | DatosSocioSnapshot,
    tipo: TipoRelacion,
  ) => void;
  /**
   * Callback cuando el usuario confirma un teléfono en el inline form (Alerta 3).
   * El modal padre guarda el valor como pending y lo envía junto con el submit.
   * Si undefined, el botón "Completar ahora" no se muestra.
   */
  onTelefonoPending?: (telefono: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE: AlertaReContratacion
// ═════════════════════════════════════════════════════════════════════════

interface AlertaReContratacionProps {
  relacionFinalizada: RelacionLaboral;
  tipoModal: TipoRelacion;
  onPrefill: (snapshot: DatosLaboralesSnapshot | DatosSocioSnapshot) => void;
}

const AlertaReContratacion: React.FC<AlertaReContratacionProps> = ({
  relacionFinalizada,
  tipoModal,
  onPrefill,
}) => {
  // Determinar snapshot disponible según tipo
  const snapshot =
    tipoModal === 'empleado'
      ? relacionFinalizada.datosLaboralesSnapshot
      : tipoModal === 'socio'
      ? relacionFinalizada.datosSocioSnapshot
      : undefined;

  const tieneSnapshot = !!snapshot;

  const fechaFin = relacionFinalizada.fechaFin;
  const fechaFinDate = fechaFin ? fechaFin.toDate() : null;
  const mesesStr = fechaFinDate
    ? mesesAtras(Date.now() - fechaFinDate.getTime())
    : '';
  const fechaFinStr = fechaFin ? formatFecha(fechaFin) : '—';
  const motivoLabel = relacionFinalizada.motivoFin
    ? MOTIVO_FIN_LABELS[relacionFinalizada.motivoFin]
    : '—';

  // Datos del snapshot según tipo para mostrar en el card
  let cargoSnapshot = '—';
  let sueldoStr = '';

  if (tipoModal === 'empleado' && relacionFinalizada.datosLaboralesSnapshot) {
    const s = relacionFinalizada.datosLaboralesSnapshot;
    cargoSnapshot = s.cargo || '—';
    if (s.salarioBruto > 0) {
      sueldoStr = formatSueldo(s.salarioBruto, s.monedaSalario);
    }
  } else if (tipoModal === 'socio' && relacionFinalizada.datosSocioSnapshot) {
    const s = relacionFinalizada.datosSocioSnapshot;
    cargoSnapshot = relacionFinalizada.cargoDisplay || '—';
    if (s.porcentajeParticipacion > 0) {
      sueldoStr = `${s.porcentajeParticipacion}% participación`;
    }
  } else {
    // Sin snapshot específico: usar datos genéricos de la relación
    cargoSnapshot = relacionFinalizada.cargoDisplay || '—';
    if (relacionFinalizada.montoMensualReferencia && relacionFinalizada.montoMensualReferencia > 0) {
      sueldoStr = formatSueldo(
        relacionFinalizada.montoMensualReferencia,
        relacionFinalizada.monedaReferencia ?? 'PEN',
      );
    }
  }

  const handlePrefill = () => {
    if (!tieneSnapshot) return;
    onPrefill(snapshot!);
  };

  return (
    <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-amber-900">
            Tuvo una relaci&oacute;n {TIPO_RELACION_LABELS[tipoModal].toLowerCase()} previa
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            Finalizada el {fechaFinStr}
            {mesesStr ? ` · ${mesesStr}` : ''} · Motivo: {motivoLabel}
          </p>
        </div>
      </div>

      {/* Datos del snapshot */}
      <div className="mx-3 mb-2.5 bg-white/60 rounded-md px-2.5 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">
            {tipoModal === 'socio' ? 'Rol anterior' : 'Cargo anterior'}
          </p>
          <p className="text-[12px] font-semibold text-amber-900 truncate">{cargoSnapshot}</p>
        </div>
        {sueldoStr && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">
              {tipoModal === 'socio' ? 'Participaci&oacute;n' : 'Sueldo anterior'}
            </p>
            <p className="text-[12px] font-semibold tabular-nums text-amber-900">{sueldoStr}</p>
          </div>
        )}
      </div>

      {/* Botón prefill */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handlePrefill}
          disabled={!tieneSnapshot}
          title={
            tieneSnapshot
              ? 'Pre-rellenar el formulario con los datos de la relación anterior'
              : 'No hay datos guardados de esa relación'
          }
          className={[
            'flex items-center gap-1.5 text-[11px] font-semibold rounded-md px-2.5 py-1.5',
            'transition-colors',
            tieneSnapshot
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          ].join(' ')}
        >
          <RotateCcw className="w-3 h-3" />
          Pre-rellenar con datos anteriores
          {!tieneSnapshot && (
            <span className="font-normal text-slate-400">(sin datos guardados)</span>
          )}
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE: AlertaMultiRol
// ═════════════════════════════════════════════════════════════════════════

interface AlertaMultiRolProps {
  relacionesVigentes: RelacionLaboral[];
  tipoModal: TipoRelacion;
  uid: string;
  displayName: string;
}

const AlertaMultiRol: React.FC<AlertaMultiRolProps> = ({
  relacionesVigentes,
  tipoModal,
  uid,
  displayName,
}) => {
  const navigate = useNavigate();
  const otrasRelaciones = relacionesVigentes.filter((r) => r.tipo !== tipoModal);

  if (otrasRelaciones.length === 0) return null;

  const handleVerPerfil = () => {
    navigate('/usuarios', { state: { openUid: uid } });
  };

  return (
    <div className="bg-sky-50 ring-1 ring-sky-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-sky-900">
            Esta persona tambi&eacute;n tiene otros v&iacute;nculos activos
          </p>
          <p className="text-[11px] text-sky-700 mt-0.5">
            Ser&aacute; una persona con {otrasRelaciones.length + 1} relaciones simult&aacute;neas
          </p>
        </div>
      </div>

      {/* Lista de otras relaciones */}
      <div className="mx-3 mb-2.5 space-y-1">
        {otrasRelaciones.map((r) => {
          const colors = TIPO_RELACION_COLORS[r.tipo];
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 bg-white/60 rounded-md px-2.5 py-1.5"
            >
              <span
                className={[
                  'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ring-1',
                  colors.bg,
                  colors.text,
                  colors.ring,
                ].join(' ')}
              >
                {TIPO_RELACION_LABELS[r.tipo]}
              </span>
              {r.cargoDisplay && (
                <span className="text-[11px] text-sky-800 truncate">{r.cargoDisplay}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Aviso fiscal + CTA */}
      <div className="px-3 pb-3 space-y-2">
        <p className="text-[11px] text-sky-700">
          La compensaci&oacute;n combinada puede tener implicancias fiscales. Valid&aacute; con contabilidad.
        </p>
        <button
          type="button"
          onClick={handleVerPerfil}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-700
                     hover:text-sky-900 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Ver perfil completo de {displayName}
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE: AlertaDatosIncompletos
// ═════════════════════════════════════════════════════════════════════════

interface AlertaDatosIncompletosProps {
  user: UserProfile;
  onTelefonoPending?: (telefono: string) => void;
}

const AlertaDatosIncompletos: React.FC<AlertaDatosIncompletosProps> = ({
  user,
  onTelefonoPending,
}) => {
  const [expandido, setExpandido] = useState(false);
  const [telefonoInput, setTelefonoInput] = useState('');
  const [confirmado, setConfirmado] = useState(false);

  const faltaTelefono = !user.telefono?.trim();

  // Solo mostrar si realmente faltan campos
  if (!faltaTelefono) return null;

  const handleConfirmar = () => {
    if (!telefonoInput.trim()) return;
    onTelefonoPending?.(telefonoInput.trim());
    setConfirmado(true);
    setExpandido(false);
  };

  if (confirmado) {
    return (
      <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
        <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-[12px] text-emerald-800 font-medium">
          Tel&eacute;fono {telefonoInput} ser&aacute; guardado al confirmar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-amber-900">
            Datos de contacto incompletos
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            Sin tel&eacute;fono no podr&aacute;s contactarlo para temas operativos (turnos, urgencias, etc.).
          </p>
        </div>
      </div>

      {/* Lista de campos faltantes */}
      <div className="mx-3 mb-2.5 bg-white/60 rounded-md px-2.5 py-2">
        {faltaTelefono && (
          <div className="flex items-center gap-2 text-[12px]">
            <Phone className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-amber-900">Tel&eacute;fono — no registrado</span>
          </div>
        )}
      </div>

      {/* CTA expandible o deshabilitado si no hay callback */}
      {onTelefonoPending ? (
        <div className="px-3 pb-3">
          {!expandido ? (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="flex items-center gap-1.5 text-[11px] font-semibold rounded-md
                         px-2.5 py-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
            >
              <Phone className="w-3 h-3" />
              Completar ahora
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={telefonoInput}
                  onChange={(e) => setTelefonoInput(e.target.value)}
                  placeholder="+51 999 000 000"
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 border border-amber-300 rounded-md
                             text-[12px] focus:ring-2 focus:ring-amber-400 focus:border-transparent
                             bg-white"
                />
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={!telefonoInput.trim()}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-md bg-amber-600
                             text-white hover:bg-amber-700 disabled:opacity-50
                             disabled:cursor-not-allowed transition-colors"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => { setExpandido(false); setTelefonoInput(''); }}
                  className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md
                             bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[10px] text-amber-600">
                Se guardar&aacute; al confirmar el formulario principal.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 pb-3">
          <p className="text-[11px] text-amber-600">
            Actualizalo desde el perfil del usuario.
          </p>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: InfoRelevantePanel
// ═════════════════════════════════════════════════════════════════════════

export const InfoRelevantePanel: React.FC<InfoRelevantePanelProps> = ({
  user,
  tipoModal,
  relacionesVigentes,
  onPrefillFromHistory,
  onTelefonoPending,
}) => {
  // ── Estado de relaciones históricas (se carga una vez por user.uid) ────
  const [relacionesHistoricas, setRelacionesHistoricas] = useState<RelacionLaboral[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  // Evitar re-fetch si ya se cargó para este uid
  const loadedUidRef = useRef<string | null>(null);

  // ── Estado de colapso mobile ───────────────────────────────────────────
  const [expandido, setExpandido] = useState(false);

  // ─── Fetch historial una sola vez al cambiar el user ──────────────────
  useEffect(() => {
    if (!user) {
      setRelacionesHistoricas([]);
      loadedUidRef.current = null;
      return;
    }
    if (loadedUidRef.current === user.uid) return; // Ya cargado

    loadedUidRef.current = user.uid;
    setLoadingHistorico(true);
    setRelacionesHistoricas([]); // Reset mientras carga

    void relacionesLaboralesService
      .listByUser(user.uid)
      .then((todas) => {
        setRelacionesHistoricas(todas.filter((r) => r.estado === 'finalizada'));
      })
      .catch((err) => {
        console.warn('[InfoRelevantePanel] error cargando historial:', err);
      })
      .finally(() => {
        setLoadingHistorico(false);
      });
  }, [user?.uid]);

  // Reset expandido al cambiar el user
  useEffect(() => {
    setExpandido(false);
  }, [user?.uid]);

  // ── No renderizar si no hay user ──────────────────────────────────────
  if (!user) return null;

  // ── Derivar datos para cada alerta ─────────────────────────────────────

  // Alerta 1: relación finalizada más reciente del mismo tipo
  const relacionFinalizadaDelTipo = relacionesHistoricas
    .filter((r) => r.tipo === tipoModal)
    .sort((a, b) => {
      const bMs = b.fechaFin?.toMillis() ?? 0;
      const aMs = a.fechaFin?.toMillis() ?? 0;
      return bMs - aMs;
    })[0] ?? null;

  // Alerta 2: relaciones vigentes de OTROS tipos
  const otrasRelacionesVigentes = relacionesVigentes.filter((r) => r.tipo !== tipoModal);

  // Alerta 3: datos incompletos
  const faltaTelefono = !user.telefono?.trim();
  const hayDatosIncompletos = faltaTelefono;

  // Contar alertas visibles
  const alertasVisibles = [
    relacionFinalizadaDelTipo !== null,
    otrasRelacionesVigentes.length > 0,
    hayDatosIncompletos,
  ].filter(Boolean).length;

  // Si no hay ninguna alerta relevante y no está cargando, no renderizar nada
  if (!loadingHistorico && alertasVisibles === 0) return null;

  // Mientras carga el historial, mostrar skeleton pequeño
  if (loadingHistorico) {
    return (
      <div className="space-y-2">
        <div className="h-16 bg-amber-50/60 rounded-lg ring-1 ring-amber-100 animate-pulse" />
      </div>
    );
  }

  // ── Determinar si mostrar toggle de colapso mobile ────────────────────
  // Solo colapsamos si hay 3 alertas (máxima carga cognitiva)
  const usarColapso = alertasVisibles >= 3;
  const mostrarToggle = usarColapso;

  const handlePrefill = useCallback(
    (snapshot: DatosLaboralesSnapshot | DatosSocioSnapshot) => {
      onPrefillFromHistory(snapshot, tipoModal);
    },
    [onPrefillFromHistory, tipoModal],
  );

  // ── Render completo ───────────────────────────────────────────────────
  const alertasJSX = (
    <div className="space-y-2">
      {/* Título de sección */}
      {alertasVisibles > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">
          <ClipboardList className="w-3 h-3" />
          Informaci&oacute;n relevante
          {alertasVisibles > 0 && (
            <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
              {alertasVisibles}
            </span>
          )}
        </div>
      )}

      {/* Alerta 1: Re-contratación */}
      {relacionFinalizadaDelTipo && (
        <AlertaReContratacion
          relacionFinalizada={relacionFinalizadaDelTipo}
          tipoModal={tipoModal}
          onPrefill={handlePrefill}
        />
      )}

      {/* Alerta 2: Multi-rol */}
      {otrasRelacionesVigentes.length > 0 && (
        <AlertaMultiRol
          relacionesVigentes={relacionesVigentes}
          tipoModal={tipoModal}
          uid={user.uid}
          displayName={user.displayName}
        />
      )}

      {/* Alerta 3: Datos incompletos */}
      {hayDatosIncompletos && (
        <AlertaDatosIncompletos
          user={user}
          onTelefonoPending={onTelefonoPending}
        />
      )}
    </div>
  );

  // Sin colapso: render directo
  if (!mostrarToggle) return alertasJSX;

  // Con colapso: mostrar solo primera alerta + toggle
  const primeraAlerta = (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">
        <ClipboardList className="w-3 h-3" />
        Informaci&oacute;n relevante
        <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
          {alertasVisibles}
        </span>
      </div>

      {/* Primera alerta siempre visible */}
      {relacionFinalizadaDelTipo ? (
        <AlertaReContratacion
          relacionFinalizada={relacionFinalizadaDelTipo}
          tipoModal={tipoModal}
          onPrefill={handlePrefill}
        />
      ) : otrasRelacionesVigentes.length > 0 ? (
        <AlertaMultiRol
          relacionesVigentes={relacionesVigentes}
          tipoModal={tipoModal}
          uid={user.uid}
          displayName={user.displayName}
        />
      ) : (
        <AlertaDatosIncompletos
          user={user}
          onTelefonoPending={onTelefonoPending}
        />
      )}

      {/* Toggle "Ver más" */}
      <button
        type="button"
        onClick={() => setExpandido(true)}
        className="w-full flex items-center justify-center gap-1.5
                   text-[11px] font-semibold text-slate-500 hover:text-slate-700
                   py-1.5 rounded-lg border border-dashed border-slate-200
                   hover:border-slate-300 transition-colors"
      >
        <ChevronDown className="w-3.5 h-3.5" />
        Ver las {alertasVisibles - 1} alertas adicionales
      </button>
    </div>
  );

  if (!expandido) return primeraAlerta;

  // Expandido: mostrar todo + botón colapsar
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">
          <ClipboardList className="w-3 h-3" />
          Informaci&oacute;n relevante
          <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
            {alertasVisibles}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpandido(false)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
          Colapsar
        </button>
      </div>

      {relacionFinalizadaDelTipo && (
        <AlertaReContratacion
          relacionFinalizada={relacionFinalizadaDelTipo}
          tipoModal={tipoModal}
          onPrefill={handlePrefill}
        />
      )}

      {otrasRelacionesVigentes.length > 0 && (
        <AlertaMultiRol
          relacionesVigentes={relacionesVigentes}
          tipoModal={tipoModal}
          uid={user.uid}
          displayName={user.displayName}
        />
      )}

      {hayDatosIncompletos && (
        <AlertaDatosIncompletos
          user={user}
          onTelefonoPending={onTelefonoPending}
        />
      )}
    </div>
  );
};
