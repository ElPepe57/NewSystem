/**
 * EmpujarLogisticaModal · F2 (rework detalle OC) · la ÚNICA acción de CAPTURA propia del módulo.
 *
 * RE-SEMANTIZADO (Opción A · decisión del titular 2026-07-02 · antes: EmpujarProveedorModal):
 * el "empujar" es un COMUNICADO INTERNO — el destinatario es PERSONAL PROPIO de logística
 * (usuario del sistema · `userService.getActivos()`), quien persigue a los TERCEROS del tramo
 * (proveedor/viajero/casilla). El tercero de `fila.culpable` ya NO es destinatario: se muestra
 * como CONTEXTO ("tramo a perseguir: proveedor/viajero: {nombre}").
 *
 * DEEP-LINK (Opción A · la app NO envía sola): al confirmar, según canal →
 *   · WhatsApp → window.open(`https://wa.me/{telefonoNormalizado}?text={mensaje}`) (patrón Maestros/CRM)
 *   · Email    → window.open(`mailto:{email}?subject=...&body={mensaje}`)
 *   · Llamada / Plataforma del courier → solo registro (sin deep-link).
 * El deep-link se abre ANTES del await de Firestore (dentro del gesto del click · evita popup-blocker).
 *
 * PERSISTENCIA (sin cambios · NO se inventa colección nueva): escribe una entrada en
 * `ordenesCompra/{ocId}.comentariosInternos[]` vía `arrayUnion` — el MISMO campo y patrón que
 * usa `TimelineOCPanel.agregarComentario`, de modo que el empujón queda en el HISTORIAL de la OC
 * (Timeline). El texto codifica "interno: {nombre}" + el tramo "{culpable}: {nombre}" + tipo +
 * canal + fecha-promesa + nota, unido con ' · ' (formato que el Timeline renderiza tal cual).
 *
 * Chrome BLUE (Comercial · grupoColor) · semántico solo en el dato (gravedad rose/amber).
 * Spec visual: docs/mockups/compras-master-v1.html · modal "Empujar logística".
 * FormModalV2 resuelve desktop=modal / mobile=bottom-sheet automáticamente (vía el Modal base).
 */

import React, { useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { FormModalV2 } from '../../../design-system';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { userService } from '../../../services/user.service';
import { getUserRoles, type UserProfile } from '../../../types/auth.types';
import {
  Megaphone, Phone, TrendingUp, CalendarClock, AlertTriangle, Calendar, ChevronDown, History,
  Mail, MessageCircle, Globe, ExternalLink, Search, User as UserIcon, type LucideIcon,
} from 'lucide-react';
import type { FilaRadarLlegada } from '../useRadarAtrasados';
import { GRAVEDAD_META, CULPABLE_META } from '../radarLlegadas.ui';

type TipoEmpuje = 'contactar' | 'escalar' | 'promesa';
type CanalEmpuje = 'WhatsApp' | 'Email' | 'Llamada' | 'Plataforma del courier';

interface EmpujarLogisticaModalProps {
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

/** Canales · WhatsApp/Email abren deep-link (Opción A) · Llamada/Plataforma son solo registro. */
const CANAL_OPTS: { value: CanalEmpuje; icon: LucideIcon; deepLink: boolean }[] = [
  { value: 'WhatsApp', icon: MessageCircle, deepLink: true },
  { value: 'Email', icon: Mail, deepLink: true },
  { value: 'Llamada', icon: Phone, deepLink: false },
  { value: 'Plataforma del courier', icon: Globe, deepLink: false },
];

const TIPO_LABEL: Record<TipoEmpuje, string> = {
  contactar: 'Contacto',
  escalar: 'Escalación',
  promesa: 'Promesa de fecha',
};

/**
 * Normalización de teléfono para wa.me · patrón existente en Maestros/CRM
 * (`ClientesCRM`/`Cotizaciones`: solo dígitos + prefijo 51 Perú cuando viene local de 9 dígitos).
 */
const telefonoWhatsApp = (telefono: string): string => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 9 ? `51${digitos}` : digitos;
};

/** Mensaje prellenado (editable) · referencia OC + tramo + atraso · tono operativo del mockup. */
const construirMensaje = (fila: FilaRadarLlegada, destinatario: UserProfile | null): string => {
  const tercero = fila.responsableNombre || fila.proveedor;
  const tramo = fila.culpable === 'viajero' ? `viajero: ${tercero}` : `proveedor: ${tercero}`;
  const nombre = destinatario?.displayName?.split(' ')[0];
  const saludo = nombre ? `${nombre}, ` : '';
  return (
    `${saludo}la ${fila.orden.numeroOrden} lleva ${fila.diasEnVuelo} días en la pierna ${fila.culpable} ` +
    `vs ${fila.leadTimeEsperado}d esperados (atraso ${fila.gravedad}). ` +
    `¿Puedes perseguir el tramo (${tramo}) y confirmarme estatus + nueva ETA? ` +
    `Registra el tracking del salto cuando lo tengas.`
  );
};

export const EmpujarLogisticaModal: React.FC<EmpujarLogisticaModalProps> = ({
  fila, onClose, onRegistrado,
}) => {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore();
  const [tipo, setTipo] = useState<TipoEmpuje>('contactar');
  const [canal, setCanal] = useState<CanalEmpuje>('WhatsApp');
  const [promesaFecha, setPromesaFecha] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [mensajeEditado, setMensajeEditado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // ── Destinatario INTERNO · usuarios activos del sistema (userService.getActivos) ──
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [errorUsuarios, setErrorUsuarios] = useState(false);
  const [destinatario, setDestinatario] = useState<UserProfile | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [dropdownAbierto, setDropdownAbierto] = useState(false);

  // Reset al abrir con otra fila + carga de usuarios activos.
  useEffect(() => {
    if (fila) {
      setTipo('contactar');
      setCanal('WhatsApp');
      setPromesaFecha('');
      setMensaje(construirMensaje(fila, null));
      setMensajeEditado(false);
      setDestinatario(null);
      setBusqueda('');
      setDropdownAbierto(false);
      setCargandoUsuarios(true);
      setErrorUsuarios(false);
      userService
        .getActivos()
        .then((lista) =>
          setUsuarios(
            [...lista].sort((a, b) =>
              (a.displayName || a.email).localeCompare(b.displayName || b.email, 'es'),
            ),
          ),
        )
        .catch(() => setErrorUsuarios(true))
        .finally(() => setCargandoUsuarios(false));
    }
  }, [fila?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-prellenar el mensaje al elegir destinatario (solo si el usuario no lo editó a mano).
  useEffect(() => {
    if (fila && !mensajeEditado) setMensaje(construirMensaje(fila, destinatario));
  }, [destinatario?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fila) return null;

  const meta = GRAVEDAD_META[fila.gravedad];
  const culp = CULPABLE_META[fila.culpable];
  // El TERCERO del tramo (proveedor/viajero) · ya NO es destinatario · es CONTEXTO a perseguir.
  const targetNombre = fila.responsableNombre || fila.proveedor;
  const targetTraza =
    fila.culpable === 'viajero' ? `viajero: ${targetNombre}` : `proveedor: ${targetNombre}`;

  const busquedaNorm = busqueda.trim().toLowerCase();
  const usuariosFiltrados = busquedaNorm
    ? usuarios.filter((u) =>
        `${u.displayName || ''} ${u.email} ${getUserRoles(u).join(' ')}`
          .toLowerCase()
          .includes(busquedaNorm),
      )
    : usuarios;

  // WhatsApp solo si el interno elegido tiene teléfono registrado (hint si no).
  const whatsappBloqueado = !!destinatario && !destinatario.telefono;
  const abreCanal = canal === 'WhatsApp' || canal === 'Email';

  const elegirDestinatario = (u: UserProfile) => {
    setDestinatario(u);
    setDropdownAbierto(false);
    setBusqueda('');
    if (!u.telefono && canal === 'WhatsApp') setCanal('Email'); // fallback · sin teléfono no hay wa.me
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Necesitás estar autenticado para registrar el seguimiento.');
      return;
    }
    if (!destinatario) {
      toast.error('Elegí al responsable interno de logística a empujar.');
      return;
    }

    // Deep-link Opción A · BITÁCORA PRIMERO: si Firestore falla, NO se abre el canal
    // (evita comunicar sin registro). Para no perder el gesto del click (popup-blocker),
    // se pre-abre una ventana en blanco SÍNCRONA y recién tras el write se navega;
    // si el write falla, se cierra sin comunicar. mailto no necesita popup (navegación).
    const cuerpo = mensaje.trim();
    let winWhatsApp: Window | null = null;
    if (canal === 'WhatsApp' && destinatario.telefono) {
      winWhatsApp = window.open('', '_blank');
    }
    const abrirCanal = () => {
      if (canal === 'WhatsApp' && destinatario.telefono) {
        const url = `https://wa.me/${telefonoWhatsApp(destinatario.telefono)}?text=${encodeURIComponent(cuerpo)}`;
        if (winWhatsApp) winWhatsApp.location.href = url;
        else window.open(url, '_blank'); // fallback si el blocker impidió la pre-apertura
      } else if (canal === 'Email') {
        const asunto = `Empuje logístico · ${fila.orden.numeroOrden} · atraso ${fila.diasEnVuelo}/${fila.leadTimeEsperado}d`;
        window.location.href = `mailto:${destinatario.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      }
    };

    setGuardando(true);
    try {
      // Texto del comentario interno = traza del comunicado en el Timeline de la OC (join ' · ').
      // Codifica al INTERNO empujado + el tramo a perseguir + tipo/canal/promesa/nota (como hoy).
      const nombreInterno = destinatario.displayName || destinatario.email;
      const partes = [
        `Empuje logístico · interno: ${nombreInterno} · ${TIPO_LABEL[tipo]} (${canal})`,
        `tramo a perseguir · ${targetTraza}`,
        `${fila.numero} · ${fila.proveedor} · pierna ${fila.culpable} · atraso ${fila.diasEnVuelo}/${fila.leadTimeEsperado}d (${fila.gravedad})`,
        tipo === 'promesa' && promesaFecha ? `Nueva fecha prometida: ${promesaFecha}` : '',
        cuerpo ? `Nota: ${cuerpo}` : '',
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

      // Bitácora registrada → recién ahora se abre el canal de comunicación.
      abrirCanal();
      toast.success('Comunicado interno registrado · quedó en el historial de la OC', 'Empuje registrado');
      onRegistrado?.();
      onClose();
    } catch (e: unknown) {
      // El write falló → NO se comunica (se cierra la ventana pre-abierta).
      winWhatsApp?.close();
      const msg = e instanceof Error ? e.message : 'No se pudo registrar el seguimiento';
      toast.error(`${msg} · el canal NO se abrió (sin registro no hay comunicado)`, 'Error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <FormModalV2
      isOpen={!!fila}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Empujar logística · ${fila.orden.numeroOrden}`}
      subtitle={`${destinatario ? destinatario.displayName || destinatario.email : 'Coordinación logística (interno)'} · ${culp.pierna}`}
      icon={Megaphone}
      iconTone="blue"
      size="sm"
      submitLabel={
        canal === 'WhatsApp'
          ? 'Abrir WhatsApp y registrar'
          : canal === 'Email'
            ? 'Abrir correo y registrar'
            : 'Registrar empuje'
      }
      submitIcon={abreCanal ? ExternalLink : Megaphone}
      submitVariant="primary"
      loading={guardando}
      disabled={!destinatario}
      footerExtras={
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <History className="w-3 h-3" /> Queda en el historial de la OC
        </span>
      }
    >
      <div className="space-y-4">
        {/* destinatario INTERNO · personal propio de logística (usuario del sistema) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Responsable interno a empujar
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownAbierto((o) => !o)}
              className={`w-full text-[13px] bg-white border rounded-lg px-3 py-2.5 min-h-[44px] flex items-center gap-2 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 ${
                dropdownAbierto ? 'border-blue-300 ring-2 ring-blue-500/30' : 'border-slate-200'
              }`}
            >
              <UserIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
              {destinatario ? (
                <span className="min-w-0 truncate text-left text-slate-700">
                  <b>{destinatario.displayName || destinatario.email}</b>
                  <span className="text-slate-400"> · {getUserRoles(destinatario).join(' · ') || 'sin rol'}</span>
                </span>
              ) : (
                <span className="text-slate-400 text-left">Elegí al personal interno de logística…</span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0" />
            </button>

            {dropdownAbierto && (
              <>
                {/* click-afuera cierra */}
                <div className="fixed inset-0 z-10" onClick={() => setDropdownAbierto(false)} />
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-slate-100 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      autoFocus
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre o rol…"
                      className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {cargandoUsuarios ? (
                      <div className="px-3 py-2.5 text-[11px] text-slate-400">Cargando usuarios activos…</div>
                    ) : errorUsuarios ? (
                      <div className="px-3 py-2.5 text-[11px] text-rose-600">No se pudieron cargar los usuarios · cerrá y reintentá.</div>
                    ) : usuariosFiltrados.length === 0 ? (
                      <div className="px-3 py-2.5 text-[11px] text-slate-400">Sin resultados para “{busqueda}”.</div>
                    ) : (
                      usuariosFiltrados.map((u) => (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => elegirDestinatario(u)}
                          className={`w-full text-left px-3 py-2 hover:bg-blue-50/60 transition-colors ${
                            destinatario?.uid === u.uid ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="text-[12px] font-semibold text-slate-800 truncate">
                            {u.displayName || u.email}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {getUserRoles(u).join(' · ') || 'sin rol'}
                            {!u.telefono && <span className="text-amber-600"> · sin teléfono (WhatsApp no disponible)</span>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* el TERCERO del tramo · CONTEXTO a perseguir (ya no destinatario) · color cross-módulo N4 */}
        <div className={`rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] ${culp.chip}`}>
          <culp.icon className={`w-3.5 h-3.5 ${culp.iconColor} flex-shrink-0`} />
          <span className="font-semibold">tramo a perseguir · <b>{targetTraza}</b></span>
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

        {/* tipo de empuje (toggle group · chrome blue Comercial) */}
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
                      ? 'text-blue-700 bg-blue-50 border border-blue-300 ring-2 ring-blue-500/30'
                      : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* canal (toggle · WhatsApp/Email abren deep-link · Llamada/Plataforma solo registro) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Canal
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {CANAL_OPTS.map(({ value, icon: Icon, deepLink }) => {
              const activo = canal === value;
              const bloqueado = value === 'WhatsApp' && whatsappBloqueado;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setCanal(value)}
                  title={bloqueado ? 'El interno elegido no tiene teléfono registrado' : undefined}
                  className={`flex items-center justify-center gap-1.5 text-[12px] font-semibold px-2 py-2 rounded-lg min-h-[44px] transition-colors ${
                    bloqueado
                      ? 'text-slate-300 bg-slate-50 border border-slate-200 cursor-not-allowed'
                      : activo
                        ? 'text-blue-700 bg-blue-50 border border-blue-200'
                        : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {value}
                  {deepLink && !bloqueado && <ExternalLink className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </div>
          {whatsappBloqueado && (
            <p className="mt-1.5 text-[10px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {destinatario?.displayName || 'El interno elegido'} no tiene teléfono registrado · WhatsApp deshabilitado.
            </p>
          )}
        </div>

        {/* nueva fecha prometida (solo si tipo=promesa) */}
        {tipo === 'promesa' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block flex items-center gap-1.5">
              Nueva fecha prometida
              <span className="text-[9px] font-medium text-slate-400 normal-case tracking-normal">· si el tramo se compromete</span>
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

        {/* mensaje prellenado editable · cuerpo del deep-link (WhatsApp/Email) + nota de la bitácora */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Mensaje
          </label>
          <textarea
            rows={4}
            value={mensaje}
            onChange={(e) => {
              setMensaje(e.target.value);
              setMensajeEditado(true);
            }}
            placeholder="Mensaje al responsable interno · referencia OC + tramo + atraso…"
            className="w-full text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300"
          />
          {abreCanal && (
            <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              Se abre prellenado en {canal === 'WhatsApp' ? 'WhatsApp' : 'tu correo'} · la app no envía sola.
            </p>
          )}
        </div>
      </div>
    </FormModalV2>
  );
};
