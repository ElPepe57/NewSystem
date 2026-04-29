/**
 * ReclamoPanel — S40 Bloque B
 *
 * Modal dual que sirve para:
 *  - CREAR un reclamo nuevo desde un envío (si `reclamo` no viene)
 *  - VER/avanzar el estado de un reclamo existente (si `reclamo` viene)
 *
 * Acciones disponibles según estado:
 *  - borrador  → [Editar monto/notas] [Enviar] [Eliminar]
 *  - enviado   → [Marcar en disputa] [Aceptar (con monto)] [Rechazar]
 *  - en_disputa→ [Aceptar] [Rechazar]
 *  - aceptado  → [Registrar cobro] [Rechazar]
 *  - cobrado / rechazado / cerrado_sin_cobrar → solo lectura
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  FileText,
  Send,
  X,
  ShieldAlert,
  Ban,
  ThumbsUp,
  AlertOctagon,
  Package,
  Lock,
  Link2,
  ArrowRight,
  Reply,
  Truck,
  Hourglass,
} from 'lucide-react';
import { Modal, Button, Badge } from '../../common';
import type {
  Reclamo,
  ReclamoFormData,
  TipoReclamo,
  DestinatarioReclamo,
  EstadoReclamo,
} from '../../../types/reclamo.types';
import type {
  Envio,
  IncidenciaEnvio,
  ResponsableDano,
} from '../../../types/envio.types';
import type { MetodoTesoreria } from '../../../types/tesoreria.types';
import type { Unidad } from '../../../types/unidad.types';
import { useReclamoStore } from '../../../store/reclamoStore';
import { useToastStore } from '../../../store/toastStore';
// S45 — Flujo de reemplazo físico (D-16)
import {
  ResolverReclamoModal,
  type ResolverReclamoModalResult,
} from '../../../pages/Envios/SubEnviosT1';
import { reclamoService } from '../../../services/reclamo.service';
import { isSubenviosT1Enabled } from '../../../config/features';
// S54.x (D-REC-4) — Timeline procedural de eventos del reclamo.
import { ReclamoTimeline } from './ReclamoTimeline';
// BUG-INC-011 fix (S54.x) — Pre-cargar monto reclamado desde el CTRU de las
// unidades afectadas. Usamos getDoc directo en vez del store para que funcione
// también con unidades creadas on-the-fly por el fix INC-001.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COLLECTIONS } from '../../../config/collections';

interface ReclamoPanelProps {
  /** Si viene: modo ver/avanzar. Si no: modo crear */
  reclamo?: Reclamo;
  /** Envío asociado — requerido para crear, opcional para ver */
  envio?: Envio;
  /** Incidencias preseleccionadas (cuando se abre desde GestionIncidenciasModal) */
  incidenciasSugeridas?: IncidenciaEnvio[];
  /**
   * BUG-INC-002 fix (S54.x) — Responsable elegido en GestionIncidenciasModal.
   * Si viene, lo usamos para precargar destinatario + nombre correctos en el form
   * de creación de reclamo (en vez de adivinarlos del envío).
   *
   * Mapeo:
   *   'proveedor'        → destinatario='proveedor', nombre=envio.origenProveedorNombre
   *   'viajero'          → destinatario='courier',   nombre=envio.colaboradorNombre || envio.courier
   *   'sin_responsable'  → no se debería abrir reclamo (filtrado upstream)
   */
  responsableSugerido?: ResponsableDano;
  userId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * BUG-INC-003 fix (S54.x) — Mapea el responsable elegido al destinatario del
 * reclamo. Esta es la fuente de verdad del mapeo: cualquier cambio acá afecta
 * a quién se le dirige el reclamo.
 */
function mapResponsableToDestinatario(
  responsable: ResponsableDano | undefined,
  envio: Envio | undefined
): { destinatario: DestinatarioReclamo; nombre: string; id?: string } {
  if (!envio) return { destinatario: 'otro', nombre: '' };

  if (responsable === 'proveedor') {
    return {
      destinatario: 'proveedor',
      nombre: envio.origenProveedorNombre || '',
      id: envio.origenProveedorId,
    };
  }
  if (responsable === 'viajero') {
    return {
      destinatario: 'courier',
      nombre: envio.colaboradorNombre || envio.courier || '',
      id: envio.colaboradorId,
    };
  }
  // Fallback: inferir del envío como antes
  if (envio.colaboradorTipo === 'courier_externo' || envio.colaboradorTipo === 'courier_interno') {
    return {
      destinatario: 'courier',
      nombre: envio.colaboradorNombre || envio.courier || '',
      id: envio.colaboradorId,
    };
  }
  if (envio.origenTipo === 'proveedor') {
    return {
      destinatario: 'proveedor',
      nombre: envio.origenProveedorNombre || '',
      id: envio.origenProveedorId,
    };
  }
  return { destinatario: 'courier', nombre: envio.colaboradorNombre || '' };
}

const TIPO_LABELS: Record<TipoReclamo, string> = {
  danada: 'Unidad dañada',
  perdida: 'Unidad perdida',
  aduana_timeout: 'Aduana — timeout',
  otro: 'Otro',
};

const DESTINATARIO_LABELS: Record<DestinatarioReclamo, string> = {
  proveedor: 'Proveedor',
  courier: 'Courier',
  seguro: 'Seguro',
  otro: 'Otro',
};

// BUG-INC-003 helper — color del avatar según destinatario.
function cnDestinatarioAvatar(destinatario: DestinatarioReclamo): string {
  const base =
    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0';
  if (destinatario === 'proveedor') return `${base} bg-teal-100 text-teal-700`;
  if (destinatario === 'courier') return `${base} bg-sky-100 text-sky-700`;
  if (destinatario === 'seguro') return `${base} bg-purple-100 text-purple-700`;
  return `${base} bg-slate-100 text-slate-700`;
}

const ESTADO_CONFIG: Record<EstadoReclamo, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'info' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'info' },
  en_disputa: { label: 'En disputa', variant: 'warning' },
  aceptado: { label: 'Aceptado', variant: 'warning' },
  cobrado: { label: 'Cobrado', variant: 'success' },
  rechazado: { label: 'Rechazado', variant: 'danger' },
  cerrado_sin_cobrar: { label: 'Cerrado sin cobrar', variant: 'danger' },
};

export const ReclamoPanel: React.FC<ReclamoPanelProps> = ({
  reclamo,
  envio,
  incidenciasSugeridas,
  responsableSugerido,
  userId,
  onClose,
  onSuccess,
}) => {
  const esCreacion = !reclamo;
  const toast = useToastStore();
  const {
    crearReclamo,
    enviarReclamo,
    marcarEnDisputa,
    aceptarReclamo,
    registrarCobro,
    rechazarReclamo,
    eliminarReclamo,
  } = useReclamoStore();

  // ─── Estado modo CREAR ──────────────────────────────────────────────────

  const unidadesSugeridas = useMemo(() => {
    if (!envio) return [];
    if (!incidenciasSugeridas || incidenciasSugeridas.length === 0) {
      // Sugerir todas las incidencias no resueltas del envío
      return (envio.incidencias || []).filter(i => !i.resuelta && !!i.unidadId);
    }
    return incidenciasSugeridas.filter(i => !!i.unidadId);
  }, [envio, incidenciasSugeridas]);

  const [selectedUnidades, setSelectedUnidades] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const inc of unidadesSugeridas) {
      if (inc.unidadId) init[inc.unidadId] = true;
    }
    return init;
  });

  // BUG-INC-002 fix (S54.x) — Tipo inferido de la incidencia.
  // Si todas las incidencias sugeridas son del mismo tipo, queda BLOQUEADO
  // (el caller ya decidió el contexto). Si son mixtas, queda editable.
  const tipoInferido = useMemo<TipoReclamo>(() => {
    const primera = unidadesSugeridas[0];
    if (primera?.tipo === 'danada') return 'danada';
    if (primera?.tipo === 'faltante') return 'perdida';
    if (primera?.tipo === 'aduana') return 'aduana_timeout';
    return 'otro';
  }, [unidadesSugeridas]);
  const tipoBloqueado = useMemo(() => {
    if (unidadesSugeridas.length === 0) return false;
    const tipos = new Set(unidadesSugeridas.map((i) => i.tipo));
    return tipos.size === 1; // único tipo → bloqueamos selector
  }, [unidadesSugeridas]);
  const [tipo, setTipo] = useState<TipoReclamo>(tipoInferido);

  // BUG-INC-002 + INC-003 fix — Destinatario derivado del responsable
  // sugerido (si vino). Si vino, queda BLOQUEADO. Si no, editable.
  const destinatarioInferido = useMemo(
    () => mapResponsableToDestinatario(responsableSugerido, envio),
    [responsableSugerido, envio]
  );
  const destinatarioBloqueado = !!responsableSugerido && responsableSugerido !== 'sin_responsable';
  const [destinatario, setDestinatario] = useState<DestinatarioReclamo>(destinatarioInferido.destinatario);
  const [destinatarioNombre, setDestinatarioNombre] = useState<string>(destinatarioInferido.nombre);

  const [montoReclamadoPEN, setMontoReclamadoPEN] = useState<string>('');
  // BUG-INC-012 fix (S54.x) — Reclamo en moneda de origen.
  // Las OCs internacionales nacen en USD; el reclamo al proveedor debe
  // expresarse en USD (su moneda) y se guarda equivalente PEN para
  // contabilidad local. TC viene de la OC.
  const [montoReclamadoUSD, setMontoReclamadoUSD] = useState<string>('');
  const [tcUsado, setTcUsado] = useState<number>(0);
  const [notas, setNotas] = useState<string>('');
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // BUG-INC-011 fix (S54.x) — Auto-carga del monto reclamado desde el CTRU
  // de las unidades seleccionadas.
  //
  // Estrategia (en orden de preferencia):
  //   1. `incidencia.montoReclamoPEN` — si ya fue calculado en el flujo de
  //      Dañadas (bajaInventarioService lo escribe al procesar devolucion).
  //   2. Sumar `Unidad.ctruDinamico` (preferido) o `ctruInicial` (fallback)
  //      de las unidades afectadas, fetch directo a Firestore.
  //
  // Solo se auto-carga mientras el usuario NO haya tipeado manualmente.
  // Una vez que toca el campo, queda libre.
  const userEditedMonto = useRef(false);
  const [autoCalculandoMonto, setAutoCalculandoMonto] = useState(false);
  const [recalcTrigger, setRecalcTrigger] = useState(0); // counter para forzar recálculo

  useEffect(() => {
    if (!esCreacion) return; // Solo aplica en modo crear
    if (userEditedMonto.current) return;

    const selectedIds = Object.entries(selectedUnidades)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (selectedIds.length === 0) {
      setMontoReclamadoPEN('');
      setMontoReclamadoUSD('');
      return;
    }

    // Estrategia 1: tomar monto pre-calculado de las incidencias (flujo Dañadas).
    // Está en PEN; si tenemos TC del envío/OC, derivamos USD.
    const incsForSelected = unidadesSugeridas.filter(
      (i) => i.unidadId && selectedIds.includes(i.unidadId)
    );
    const sumFromIncs = incsForSelected.reduce(
      (s, i) => s + (i.montoReclamoPEN || 0),
      0
    );
    if (sumFromIncs > 0) {
      setMontoReclamadoPEN(sumFromIncs.toFixed(2));
      // Derivar USD si tenemos TC
      const tcLocal = (envio as { tcCompra?: number })?.tcCompra || 0;
      if (tcLocal > 0) {
        setTcUsado(tcLocal);
        setMontoReclamadoUSD((sumFromIncs / tcLocal).toFixed(2));
      }
      return;
    }

    // Estrategia 2: fetch directo de las Unidades y sumar CTRU
    // Estrategia 3 (fallback): si las Unidades no existen o tienen CTRU=0,
    //   derivar el costo desde la OC (producto.costoUnitario USD * TC + flete).
    //   Crítico para FALTANTES que nunca tuvieron doc Unidad creado.
    setAutoCalculandoMonto(true);
    let cancelled = false;
    Promise.all(
      selectedIds.map((uid) => getDoc(doc(db, COLLECTIONS.UNIDADES, uid)))
    )
      .then(async (snaps) => {
        if (cancelled) return;

        // Estrategia 2: sumar CTRU de las unidades existentes (en PEN).
        // Si tenemos TC, derivamos USD para el campo de moneda original.
        const sumFromUnidades = snaps.reduce((s, snap) => {
          if (!snap.exists()) return s;
          const u = snap.data() as Unidad;
          return s + (u.ctruDinamico || u.ctruInicial || 0);
        }, 0);

        if (sumFromUnidades > 0) {
          if (!userEditedMonto.current) {
            setMontoReclamadoPEN(sumFromUnidades.toFixed(2));
            // Buscar TC para derivar USD
            const tcUnidad = snaps
              .map((s) => (s.exists() ? (s.data() as Unidad).tcCompra : 0))
              .find((t) => t && t > 0);
            const tcLocal = tcUnidad || (envio as { tcCompra?: number })?.tcCompra || 0;
            if (tcLocal > 0) {
              setTcUsado(tcLocal);
              setMontoReclamadoUSD((sumFromUnidades / tcLocal).toFixed(2));
            }
          }
          return;
        }

        // Estrategia 3: fallback desde la OC.
        // Útil cuando: (a) la unidad no existe (faltante), o (b) la unidad
        // existe pero tiene costos en 0 (creada on-the-fly por BUG-INC-001 fix).
        // BUG-INC-012 fix: en este caso el costo nace en USD (moneda de OC),
        // que es exactamente la moneda en la que se debería abrir el reclamo
        // si el destinatario es proveedor extranjero.
        if (!envio?.ordenCompraId) return;
        try {
          const ocSnap = await getDoc(
            doc(db, COLLECTIONS.ORDENES_COMPRA, envio.ordenCompraId)
          );
          if (cancelled || !ocSnap.exists()) return;
          const oc = ocSnap.data() as {
            productos?: Array<{ productoId: string; costoUnitario: number }>;
            tcCompra?: number;
          };
          const tc = (envio as { tcCompra?: number }).tcCompra || oc.tcCompra || 0;

          const envioUnidades = (envio.unidades || []).filter((u) =>
            selectedIds.includes(u.unidadId)
          );
          const sumUSD = envioUnidades.reduce((s, eu) => {
            const prod = oc.productos?.find((p) => p.productoId === eu.productoId);
            const productCost = prod?.costoUnitario || 0;
            const fleteCost = eu.costoFleteUSD || 0;
            return s + productCost + fleteCost;
          }, 0);

          if (sumUSD > 0 && !userEditedMonto.current) {
            setMontoReclamadoUSD(sumUSD.toFixed(2));
            if (tc > 0) {
              setTcUsado(tc);
              setMontoReclamadoPEN((sumUSD * tc).toFixed(2));
            }
          }
        } catch {
          // Silencioso: si falla la lookup de OC, queda en blanco
        }
      })
      .catch(() => {
        // Silencioso: si falla la carga, queda en blanco y el usuario completa
      })
      .finally(() => {
        if (!cancelled) setAutoCalculandoMonto(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUnidades, unidadesSugeridas, esCreacion, recalcTrigger, envio]);

  // ─── Estado modo VER/AVANZAR ────────────────────────────────────────────

  const [actionPending, setActionPending] = useState<string | null>(null);
  const [mostrarDisputaForm, setMostrarDisputaForm] = useState(false);
  const [mostrarAceptarForm, setMostrarAceptarForm] = useState(false);
  const [mostrarCobroForm, setMostrarCobroForm] = useState(false);
  const [mostrarRechazoForm, setMostrarRechazoForm] = useState(false);
  // S45 — Modal de resolución con 3 salidas (D-16)
  const [mostrarResolverModal, setMostrarResolverModal] = useState(false);
  const subenviosT1Flag = useMemo(() => isSubenviosT1Enabled(), []);

  // S54.x — Sub-modal "Registrar respuesta" (D-REC-5).
  // Reemplaza la fila plana de botones cuando el reclamo está en estado
  // 'enviado' o 'en_disputa'. Una sola CTA "Registrar respuesta" abre este
  // modal con 4 opciones radio: aceptar reembolso · aceptar reemplazo ·
  // cuestionar · rechazar.
  // S55 Fase 6 — Agregada opción 'credito_a_favor' (acepta sin cash, queda saldo CC).
  type RespuestaTipo = 'reembolso' | 'credito_a_favor' | 'reemplazo' | 'disputa' | 'rechazo';
  const [mostrarRespuestaModal, setMostrarRespuestaModal] = useState(false);
  const [respuestaTipo, setRespuestaTipo] = useState<RespuestaTipo>('reembolso');
  const [respuestaMontoAcordado, setRespuestaMontoAcordado] = useState('');
  const [respuestaMotivo, setRespuestaMotivo] = useState('');

  const [motivoDisputa, setMotivoDisputa] = useState('');
  const [montoAcordado, setMontoAcordado] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // Cobro
  const [cuentaCobroId, setCuentaCobroId] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoTesoreria>('transferencia_bancaria');
  const [montoCobrado, setMontoCobrado] = useState('');
  const [referenciaCobro, setReferenciaCobro] = useState('');

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleCrear = async () => {
    if (!envio) {
      toast.error('Falta el envío asociado');
      return;
    }
    const unidadesIds = Object.entries(selectedUnidades).filter(([, v]) => v).map(([k]) => k);
    if (unidadesIds.length === 0) {
      toast.error('Selecciona al menos una unidad');
      return;
    }
    if (!destinatarioNombre.trim()) {
      toast.error('Indica el destinatario del reclamo');
      return;
    }
    const monto = parseFloat(montoReclamadoPEN.replace(',', '.'));
    if (!monto || monto <= 0) {
      toast.error('Monto reclamado inválido');
      return;
    }
    // BUG-INC-012 fix (S54.x) — Capturar también el monto USD y el TC usado.
    const montoUSD = parseFloat(montoReclamadoUSD.replace(',', '.'));
    const montoUSDValido = !isNaN(montoUSD) && montoUSD > 0 ? montoUSD : undefined;
    const tcValido = tcUsado > 0 ? tcUsado : undefined;

    setSubmittingCreate(true);
    try {
      // BUG-INC-003 fix (S54.x) — destinatarioId calculado por mapeo correcto:
      //   courier → envio.colaboradorId
      //   proveedor → envio.origenProveedorId
      //   seguro/otro → undefined (no hay vínculo a entidad)
      const destinatarioIdCalculado =
        destinatario === 'courier'
          ? envio.colaboradorId
          : destinatario === 'proveedor'
            ? envio.origenProveedorId
            : undefined;

      const data: ReclamoFormData = {
        envioId: envio.id,
        envioNumero: envio.numeroEnvio,
        ordenCompraId: envio.ordenCompraId,
        ordenCompraNumero: envio.ordenCompraNumero,
        tipo,
        destinatario,
        destinatarioNombre: destinatarioNombre.trim(),
        destinatarioId: destinatarioIdCalculado,
        unidadesIds,
        montoReclamadoPEN: monto,
        montoReclamadoUSD: montoUSDValido,
        tipoCambio: tcValido,
        notas: notas.trim() || undefined,
        lineaNegocioId: envio.lineaNegocioId,
      };
      await crearReclamo(data, userId);
      toast.success('Reclamo creado en borrador');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear reclamo';
      toast.error(msg);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const runAction = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setActionPending(key);
    try {
      await fn();
      toast.success(successMsg);
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    } finally {
      setActionPending(null);
    }
  };

  const handleEnviar = () => reclamo && runAction('enviar', () => enviarReclamo(reclamo.id, userId), 'Reclamo enviado');
  const handleEliminar = () => reclamo && runAction('eliminar', () => eliminarReclamo(reclamo.id, userId), 'Reclamo eliminado');

  const handleMarcarDisputa = () => {
    if (!reclamo || !motivoDisputa.trim()) return;
    return runAction('disputa', () => marcarEnDisputa(reclamo.id, motivoDisputa.trim(), userId), 'Reclamo marcado en disputa');
  };

  const handleAceptar = () => {
    if (!reclamo) return;
    const monto = parseFloat(montoAcordado.replace(',', '.'));
    if (!monto || monto <= 0) {
      toast.error('Monto acordado inválido');
      return;
    }
    return runAction('aceptar', () => aceptarReclamo(reclamo.id, monto, userId), `Reclamo aceptado por S/ ${monto.toFixed(2)}`);
  };

  const handleRegistrarCobro = () => {
    if (!reclamo) return;
    const monto = parseFloat(montoCobrado.replace(',', '.'));
    if (!monto || monto <= 0) {
      toast.error('Monto cobrado inválido');
      return;
    }
    if (!cuentaCobroId.trim()) {
      toast.error('Indica la cuenta donde se recibió el cobro');
      return;
    }
    return runAction(
      'cobro',
      () => registrarCobro(reclamo.id, {
        cuentaId: cuentaCobroId.trim(),
        metodoPago,
        montoCobradoPEN: monto,
        fecha: new Date(),
        referencia: referenciaCobro || undefined,
      }, userId),
      `Cobro S/ ${monto.toFixed(2)} registrado`,
    );
  };

  const handleRechazar = () => {
    if (!reclamo || !motivoRechazo.trim()) {
      toast.error('Indica el motivo del rechazo');
      return;
    }
    return runAction('rechazar', () => rechazarReclamo(reclamo.id, motivoRechazo.trim(), userId), 'Reclamo rechazado — merma registrada');
  };

  // S54.x (D-REC-5) — Handler del sub-modal "Registrar respuesta".
  // Pre-carga monto acordado con el monto reclamado (lo común es aceptar el
  // total) y abre el modal con la opción "reembolso" pre-seleccionada.
  const abrirRegistrarRespuesta = () => {
    if (!reclamo) return;
    setRespuestaTipo('reembolso');
    setRespuestaMontoAcordado(reclamo.montoReclamadoPEN.toFixed(2));
    setRespuestaMotivo('');
    setMostrarRespuestaModal(true);
  };

  const handleConfirmarRespuesta = async () => {
    if (!reclamo) return;

    if (respuestaTipo === 'reembolso') {
      const monto = parseFloat(respuestaMontoAcordado.replace(',', '.'));
      if (!monto || monto <= 0) {
        toast.error('Monto acordado inválido');
        return;
      }
      await runAction(
        'respuesta-reembolso',
        () => aceptarReclamo(reclamo.id, monto, userId),
        `Aceptado · pendiente cobro de S/ ${monto.toFixed(2)}`,
      );
    } else if (respuestaTipo === 'credito_a_favor') {
      // S55 Fase 6 — Acepta sin cash, crea credito_reclamo en CC del destinatario
      const monto = parseFloat(respuestaMontoAcordado.replace(',', '.'));
      if (!monto || monto <= 0) {
        toast.error('Monto acordado inválido');
        return;
      }
      await runAction(
        'respuesta-credito',
        async () => {
          await reclamoService.aceptarConCreditoAFavor(
            reclamo.id,
            monto,
            userId,
            respuestaMotivo.trim() || undefined,
          );
        },
        `Aceptado con crédito a favor · S/ ${monto.toFixed(2)} aplicable a futuras transacciones`,
      );
    } else if (respuestaTipo === 'reemplazo') {
      // Cierra este modal y abre el ResolverReclamoModal completo (S45 D-16),
      // que pide los datos de la sub-tanda de reemplazo (tracking, fecha).
      setMostrarRespuestaModal(false);
      setMostrarResolverModal(true);
    } else if (respuestaTipo === 'disputa') {
      if (!respuestaMotivo.trim()) {
        toast.error('Indicá qué está cuestionando el destinatario');
        return;
      }
      await runAction(
        'respuesta-disputa',
        () => marcarEnDisputa(reclamo.id, respuestaMotivo.trim(), userId),
        'Reclamo marcado en disputa',
      );
    } else if (respuestaTipo === 'rechazo') {
      if (!respuestaMotivo.trim()) {
        toast.error('Indicá el motivo del rechazo');
        return;
      }
      await runAction(
        'respuesta-rechazo',
        () => rechazarReclamo(reclamo.id, respuestaMotivo.trim(), userId),
        'Reclamo rechazado · merma registrada',
      );
    }
  };

  // S45 (D-16) — Handler del ResolverReclamoModal: delega según tipoResolucion
  const handleResolverReclamo = async (result: ResolverReclamoModalResult) => {
    if (!reclamo) return;

    if (result.tipoResolucion === 'reembolso') {
      // Flujo estándar: aceptar con monto + registrar cobro (si hay cuenta)
      const monto = (result.montoAcordadoUSD ?? 0) * (reclamo.tipoCambio ?? 1);
      await runAction(
        'resolver-reembolso',
        async () => {
          await aceptarReclamo(reclamo.id, monto > 0 ? monto : reclamo.montoReclamadoPEN, userId);
          if (result.cuentaCobroId) {
            await registrarCobro(reclamo.id, {
              cuentaId: result.cuentaCobroId,
              metodoPago: 'transferencia_bancaria' as MetodoTesoreria,
              montoCobradoPEN: monto > 0 ? monto : reclamo.montoReclamadoPEN,
              fecha: result.fechaCobroEstimada ?? new Date(),
            }, userId);
          }
        },
        'Reclamo resuelto con reembolso'
      );
    } else if (result.tipoResolucion === 'reemplazo') {
      // S45 D-16: crear sub-tanda de reemplazo en el envío padre + actualizar reclamo
      await runAction(
        'resolver-reemplazo',
        async () => {
          await reclamoService.resolverConReemplazo(
            reclamo.id,
            {
              reemplazoTracking: result.reemplazoTracking,
              reemplazoFechaEstimada: result.reemplazoFechaEstimada,
              notas: result.notas,
            },
            userId
          );
        },
        'Reclamo resuelto con reemplazo — sub-tanda creada en el envío'
      );
    } else if (result.tipoResolucion === 'merma') {
      // Flujo estándar: rechazar con motivo (merma contable)
      const motivo = result.notas?.trim() || 'Destinatario no asume — merma contable';
      await runAction(
        'resolver-merma',
        () => rechazarReclamo(reclamo.id, motivo, userId),
        'Reclamo resuelto como merma'
      );
    }

    setMostrarResolverModal(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const isEstadoFinal = reclamo && (reclamo.estado === 'cobrado' || reclamo.estado === 'rechazado' || reclamo.estado === 'cerrado_sin_cobrar');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={esCreacion ? 'Crear reclamo' : `Reclamo ${reclamo?.numeroReclamo}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Header reclamo existente */}
        {reclamo && (
          <div className="flex items-start justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={ESTADO_CONFIG[reclamo.estado].variant}>{ESTADO_CONFIG[reclamo.estado].label}</Badge>
                <span className="text-sm text-slate-500">{TIPO_LABELS[reclamo.tipo]}</span>
              </div>
              <div className="mt-1 text-sm text-slate-700">
                <strong>{DESTINATARIO_LABELS[reclamo.destinatario]}:</strong> {reclamo.destinatarioNombre}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Envío: {reclamo.envioNumero}
                {reclamo.ordenCompraNumero && <> · OC: {reclamo.ordenCompraNumero}</>}
                {' · '}{reclamo.cantidadUnidades} unidad{reclamo.cantidadUnidades !== 1 ? 'es' : ''}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-slate-500">Reclamado</div>
              <div className="text-lg font-bold text-slate-900">S/ {reclamo.montoReclamadoPEN.toFixed(2)}</div>
              {reclamo.montoAcordadoPEN && reclamo.montoAcordadoPEN !== reclamo.montoReclamadoPEN && (
                <div className="text-xs text-amber-700">Acordado: S/ {reclamo.montoAcordadoPEN.toFixed(2)}</div>
              )}
              {reclamo.montoCobradoPEN && (
                <div className="text-xs text-emerald-700">Cobrado: S/ {reclamo.montoCobradoPEN.toFixed(2)}</div>
              )}
            </div>
          </div>
        )}

        {/* Modo CREAR */}
        {esCreacion && envio && (
          <div className="space-y-4">
            {/* S54.x — Banner clarificador del ciclo procedural (D-REC-1).
                 Aclara que crear un reclamo NO genera devolución, abono ni
                 movimiento contable. Es solo un registro interno; el ciclo
                 (enviar → aceptar → cobrar) se completa en pasos posteriores. */}
            <div className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <strong>Esto crea un BORRADOR.</strong> No genera devolución, abono ni movimiento contable
                  hasta que el destinatario lo acepte y se registre el cobro efectivo. El proceso completo
                  suele tomar entre 2 y 8 semanas.
                </div>
              </div>
            </div>

            {/* Banner envío */}
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm">
              <div className="font-medium text-sky-900">Reclamo sobre envío {envio.numeroEnvio}</div>
              <div className="text-xs text-sky-700 mt-0.5">
                {envio.origenProveedorNombre || envio.origenCasillaNombre || '—'}
                {' → '}
                {envio.destinoCasillaNombre}
                {envio.colaboradorNombre && <> · Courier: {envio.colaboradorNombre}</>}
              </div>
            </div>

            {/* BUG-INC-002 + INC-003 fix (S54.x) — Bloque "A quién se reclama".
                 Si vino responsableSugerido del modal de gestión, mostramos un
                 banner read-only con avatar + tipo + nombre real (proveedor o
                 courier según el responsable elegido). Si NO vino, mostramos
                 los selectores editables (modo standalone). */}
            {destinatarioBloqueado ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
                  Reclamo dirigido a
                </div>
                <div className="flex items-center gap-3">
                  <div className={cnDestinatarioAvatar(destinatario)}>
                    {destinatarioNombre.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {destinatarioNombre || '(sin nombre)'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {DESTINATARIO_LABELS[destinatario]} · Tipo:{' '}
                      <span className="font-medium">{TIPO_LABELS[tipo]}</span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-amber-700 mt-2 italic">
                  Decidido en el paso anterior. Si necesitás cambiarlo, cancelá y volvé a Gestionar incidencias.
                </div>
              </div>
            ) : (
              <>
                {/* Tipo + Destinatario (modo standalone, editables) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de reclamo</label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as TipoReclamo)}
                      disabled={tipoBloqueado}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${tipoBloqueado ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                    >
                      <option value="danada">{TIPO_LABELS.danada}</option>
                      <option value="perdida">{TIPO_LABELS.perdida}</option>
                      <option value="aduana_timeout">{TIPO_LABELS.aduana_timeout}</option>
                      <option value="otro">{TIPO_LABELS.otro}</option>
                    </select>
                    {tipoBloqueado && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Inferido de las incidencias seleccionadas.
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Destinatario</label>
                    <select
                      value={destinatario}
                      onChange={(e) => setDestinatario(e.target.value as DestinatarioReclamo)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="proveedor">{DESTINATARIO_LABELS.proveedor}</option>
                      <option value="courier">{DESTINATARIO_LABELS.courier}</option>
                      <option value="seguro">{DESTINATARIO_LABELS.seguro}</option>
                      <option value="otro">{DESTINATARIO_LABELS.otro}</option>
                    </select>
                  </div>
                </div>

                {/* Nombre destinatario (editable cuando NO vino del flujo de gestión) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre del destinatario</label>
                  <input
                    type="text"
                    value={destinatarioNombre}
                    onChange={(e) => setDestinatarioNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ej: FedEx, AmazonBasics, Pacífico Seguros"
                  />
                </div>
              </>
            )}

            {/* S54.x — Tracking heredado del envío (D-REC-6).
                 Se muestra como bloque read-only con candado. El tracking se
                 captura al crear el envío original; no se pide ni edita acá.
                 Solo aparece si el envío tiene tracking registrado. */}
            {envio.numeroTracking && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  <Link2 className="w-3 h-3" />
                  Tracking del envío original
                </div>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-slate-200">
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-slate-800 truncate">
                      {envio.numeroTracking}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Capturado al crear {envio.numeroEnvio}
                      {(envio.colaboradorNombre || envio.courier) && ` · ${envio.colaboradorNombre || envio.courier}`}
                    </div>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-2" aria-label="Solo lectura" />
                </div>
                <div className="text-[10px] text-slate-400 italic mt-1.5">
                  Se hereda automáticamente del envío. No se edita acá.
                </div>
              </div>
            )}

            {/* Unidades */}
            {unidadesSugeridas.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Unidades afectadas ({Object.values(selectedUnidades).filter(Boolean).length} / {unidadesSugeridas.length})
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {unidadesSugeridas.map(inc => {
                    const uId = inc.unidadId!;
                    const unidad = envio.unidades.find(u => u.unidadId === uId);
                    return (
                      <label key={inc.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={!!selectedUnidades[uId]}
                          onChange={(e) => setSelectedUnidades(prev => ({ ...prev, [uId]: e.target.checked }))}
                          className="h-4 w-4 text-teal-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-700">{unidad?.codigoUnidad || uId.slice(0, 8)}</span>
                            {inc.sku && <span className="text-xs text-slate-500">{inc.sku}</span>}
                            <Badge variant={inc.tipo === 'danada' ? 'warning' : inc.tipo === 'aduana' ? 'info' : 'danger'} size="sm">
                              {inc.tipo}
                            </Badge>
                          </div>
                          {inc.productoNombre && <div className="text-xs text-slate-500 truncate">{inc.productoNombre}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {unidadesSugeridas.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  Este envío no tiene incidencias no resueltas. Asegúrate de registrar la recepción con unidades dañadas/perdidas antes de crear un reclamo.
                </div>
              </div>
            )}

            {/* Monto reclamado en USD + equivalente en PEN — BUG-INC-012 fix.
                 USD es la moneda de origen del costo (la OC nació en USD para
                 proveedores extranjeros), entonces el reclamo se abre en USD.
                 PEN se calcula con el TC de la OC para registro contable local. */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Monto reclamado <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* USD — moneda de origen */}
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      US$ (moneda OC)
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold pointer-events-none">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoReclamadoUSD}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*[.,]?\d*$/.test(v)) {
                          userEditedMonto.current = true;
                          setMontoReclamadoUSD(v);
                          // Auto-derivar PEN si tenemos TC
                          if (tcUsado > 0) {
                            const usdNum = parseFloat(v.replace(',', '.')) || 0;
                            setMontoReclamadoPEN(
                              usdNum > 0 ? (usdNum * tcUsado).toFixed(2) : ''
                            );
                          }
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {/* PEN — equivalente en moneda local */}
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Equivalente S/
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold pointer-events-none">
                      S/
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoReclamadoPEN}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*[.,]?\d*$/.test(v)) {
                          userEditedMonto.current = true;
                          setMontoReclamadoPEN(v);
                          // Auto-derivar USD si tenemos TC
                          if (tcUsado > 0) {
                            const penNum = parseFloat(v.replace(',', '.')) || 0;
                            setMontoReclamadoUSD(
                              penNum > 0 ? (penNum / tcUsado).toFixed(2) : ''
                            );
                          }
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Indicadores de estado */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {autoCalculandoMonto && (
                  <span className="text-[11px] text-slate-400 italic">Calculando...</span>
                )}
                {!autoCalculandoMonto && !userEditedMonto.current && montoReclamadoUSD && parseFloat(montoReclamadoUSD) > 0 && (
                  <span className="text-[11px] text-emerald-700 italic flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Auto-calculado desde CTRU
                  </span>
                )}
                {tcUsado > 0 && (
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    TC = S/ {tcUsado.toFixed(4)} / US$
                  </span>
                )}
                {userEditedMonto.current && (
                  <button
                    type="button"
                    onClick={() => {
                      userEditedMonto.current = false;
                      setRecalcTrigger((c) => c + 1);
                    }}
                    className="text-[11px] text-teal-600 hover:underline"
                  >
                    Recalcular automático
                  </button>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Sugerido = costo total real (CTRU) en USD desde la OC. Editás
                cualquier campo y el otro se ajusta con el TC.
              </div>
              {/* S54.x — Aclaración del modelo de monto reclamado (D-REC-6).
                   El monto reclamado siempre toma el valor ORIGINAL al momento
                   de la recepción (CTRU inicial). Los descuentos comerciales
                   solo existen al vender, no aplican al reclamar costo. */}
              <div className="text-[10px] text-slate-500 mt-1.5 flex items-start gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded">
                <AlertTriangle className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>
                  El monto se toma del <strong>costo original registrado</strong> (CTRU inicial = costo OC + flete prorrateado).
                  No incluye descuentos comerciales (esos sólo existen al vender) ni se recalcula con CTRUs posteriores.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Contexto, número de caso, persona de contacto..."
              />
            </div>

            {/* S54.x — Próximos pasos esperados (D-REC-2).
                 Lista numerada que clarifica el ciclo procedural completo.
                 Refuerza el banner amarillo de arriba: crear ≠ ejecutar. */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-semibold uppercase text-slate-600 mb-2">
                Después de crear este reclamo
              </div>
              <ol className="space-y-1.5 text-[12px] text-slate-700">
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                  Quedará en estado <strong>borrador</strong>. Lo podés editar o eliminar.
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                  Cuando contactes al destinatario, hacé clic en <strong>"Enviar reclamo"</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                  Cuando responda, registrá la respuesta: <strong>aceptar / cuestionar / rechazar</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>
                  Si acepta y abona, registrá el cobro <strong>cuando el dinero llegue a la cuenta</strong>.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Modo VER/AVANZAR */}
        {reclamo && (
          <div className="space-y-3">
            {/* Notas existentes */}
            {reclamo.notas && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Notas
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{reclamo.notas}</div>
              </div>
            )}

            {/* Motivo disputa/rechazo */}
            {reclamo.motivoDisputa && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-xs text-amber-800 font-medium">Motivo de disputa</div>
                <div className="text-sm text-amber-900 mt-0.5">{reclamo.motivoDisputa}</div>
              </div>
            )}
            {reclamo.motivoRechazo && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs text-red-800 font-medium">Motivo de rechazo</div>
                <div className="text-sm text-red-900 mt-0.5">{reclamo.motivoRechazo}</div>
              </div>
            )}

            {/* Forms contextuales según acción */}
            {mostrarDisputaForm && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <label className="block text-xs font-medium text-amber-900">Motivo de disputa</label>
                <textarea
                  value={motivoDisputa}
                  onChange={(e) => setMotivoDisputa(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                  placeholder="Ej: cuestionan el monto, piden evidencia adicional..."
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleMarcarDisputa} disabled={actionPending === 'disputa' || !motivoDisputa.trim()}>
                    Confirmar disputa
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setMostrarDisputaForm(false); setMotivoDisputa(''); }}>Cancelar</Button>
                </div>
              </div>
            )}

            {mostrarAceptarForm && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <label className="block text-xs font-medium text-emerald-900">Monto acordado (S/)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoAcordado}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*[.,]?\d*$/.test(v)) setMontoAcordado(v);
                  }}
                  className="w-40 px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white"
                  placeholder={reclamo.montoReclamadoPEN.toFixed(2)}
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleAceptar} disabled={actionPending === 'aceptar'}>
                    <ThumbsUp className="w-4 h-4 mr-1.5" />
                    Confirmar aceptación
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setMostrarAceptarForm(false); setMontoAcordado(''); }}>Cancelar</Button>
                </div>
              </div>
            )}

            {mostrarCobroForm && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 mb-1">Cuenta de tesorería (ID)</label>
                    <input
                      type="text"
                      value={cuentaCobroId}
                      onChange={(e) => setCuentaCobroId(e.target.value)}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white"
                      placeholder="ID de cuenta donde se recibió"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 mb-1">Método</label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value as MetodoTesoreria)}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white"
                    >
                      <option value="transferencia_bancaria">Transferencia bancaria</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="yape">Yape</option>
                      <option value="plin">Plin</option>
                      <option value="mercado_pago">Mercado Pago</option>
                      <option value="paypal">PayPal</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-900 mb-1">Monto cobrado (S/)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montoCobrado}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*[.,]?\d*$/.test(v)) setMontoCobrado(v);
                    }}
                    className="w-40 px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white"
                    placeholder={(reclamo.montoAcordadoPEN || reclamo.montoReclamadoPEN).toFixed(2)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-900 mb-1">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={referenciaCobro}
                    onChange={(e) => setReferenciaCobro(e.target.value)}
                    className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white"
                    placeholder="Nº voucher, operación..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleRegistrarCobro} disabled={actionPending === 'cobro'}>
                    <DollarSign className="w-4 h-4 mr-1.5" />
                    Registrar cobro
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setMostrarCobroForm(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {mostrarRechazoForm && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <div className="text-xs text-red-900 font-medium flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Al confirmar se registrará automáticamente un gasto tipo merma por S/ {reclamo.montoReclamadoPEN.toFixed(2)}.
                </div>
                <label className="block text-xs font-medium text-red-900">Motivo</label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-white"
                  placeholder="Courier rechazó, seguro no cubre..."
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={handleRechazar} disabled={actionPending === 'rechazar' || !motivoRechazo.trim()}>
                    <Ban className="w-4 h-4 mr-1.5" />
                    Confirmar rechazo
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setMostrarRechazoForm(false); setMotivoRechazo(''); }}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* S54.x — Card "Próximo paso esperado" (D-REC-3).
                 Reemplaza la fila plana de 3-5 botones sueltos por una card
                 destacada que indica qué hacer ahora según el estado actual,
                 con un CTA principal y CTAs secundarios. Reduce confusión.
                 Solo visible si NO hay un sub-form abierto y el reclamo no
                 está en estado final. */}
            {!isEstadoFinal && !mostrarDisputaForm && !mostrarAceptarForm && !mostrarCobroForm && !mostrarRechazoForm && (
              <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
                    {reclamo.estado === 'borrador' && <Send className="w-4 h-4" />}
                    {(reclamo.estado === 'enviado' || reclamo.estado === 'en_disputa') && <Hourglass className="w-4 h-4" />}
                    {reclamo.estado === 'aceptado' && <DollarSign className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                      Próximo paso esperado
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {reclamo.estado === 'borrador' && 'Enviar el reclamo al destinatario'}
                      {reclamo.estado === 'enviado' && 'Esperando respuesta del destinatario'}
                      {reclamo.estado === 'en_disputa' && 'En negociación · esperando acuerdo'}
                      {reclamo.estado === 'aceptado' && 'Esperando cobro del monto acordado'}
                    </div>
                    <div className="text-[12px] text-slate-700 mt-1">
                      {reclamo.estado === 'borrador' &&
                        'El reclamo está guardado pero no se ha notificado al destinatario. Cuando lo contactes (email, llamada, sistema del courier), hacé clic en "Enviar reclamo" para iniciar el ciclo formal.'}
                      {reclamo.estado === 'enviado' &&
                        `Reclamo notificado a ${reclamo.destinatarioNombre}. Cuando responda (acepta · cuestiona · rechaza), registrá la decisión acá para avanzar el ciclo.`}
                      {reclamo.estado === 'en_disputa' &&
                        'El destinatario cuestionó algo del reclamo. Cuando lleguen a un acuerdo, registrá la respuesta final.'}
                      {reclamo.estado === 'aceptado' &&
                        `${reclamo.destinatarioNombre} aceptó pagar S/ ${(reclamo.montoAcordadoPEN || reclamo.montoReclamadoPEN).toFixed(2)}. Cuando el dinero llegue efectivamente a tu cuenta, registrá el cobro para cerrar el reclamo y crear el ingreso de tesorería.`}
                    </div>

                    {/* CTAs contextuales por estado */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {reclamo.estado === 'borrador' && (
                        <>
                          <Button variant="primary" size="sm" onClick={handleEnviar} disabled={actionPending === 'enviar'}>
                            <Send className="w-4 h-4 mr-1.5" />
                            Enviar reclamo
                          </Button>
                          <Button variant="danger" size="sm" onClick={handleEliminar} disabled={actionPending === 'eliminar'}>
                            <X className="w-4 h-4 mr-1.5" />
                            Eliminar borrador
                          </Button>
                        </>
                      )}

                      {(reclamo.estado === 'enviado' || reclamo.estado === 'en_disputa') && (
                        <>
                          <Button variant="primary" size="sm" onClick={abrirRegistrarRespuesta}>
                            <Reply className="w-4 h-4 mr-1.5" />
                            Registrar respuesta
                          </Button>
                          {/* S45 (D-16) — botón legacy de reemplazo (cuando el flag está activo).
                              El flujo nuevo lo cubre desde "Registrar respuesta", pero dejamos
                              acceso directo al ResolverReclamoModal completo si se prefiere. */}
                          {subenviosT1Flag && (
                            <Button variant="secondary" size="sm" onClick={() => setMostrarResolverModal(true)}>
                              <Package className="w-4 h-4 mr-1.5" />
                              Resolver (avanzado)
                            </Button>
                          )}
                        </>
                      )}

                      {reclamo.estado === 'aceptado' && (
                        <>
                          <Button variant="primary" size="sm" onClick={() => {
                            setMontoCobrado((reclamo.montoAcordadoPEN || reclamo.montoReclamadoPEN).toFixed(2));
                            setMostrarCobroForm(true);
                          }}>
                            <DollarSign className="w-4 h-4 mr-1.5" />
                            Registrar cobro
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setMostrarRechazoForm(true)}>
                            <Ban className="w-4 h-4 mr-1.5" />
                            Rechazar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Estados finales */}
            {isEstadoFinal && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-slate-400" />
                Reclamo cerrado.
                {reclamo.fechaCierre && (
                  <span className="text-xs text-slate-500">
                    ({reclamo.fechaCierre.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })})
                  </span>
                )}
              </div>
            )}

            {/* S54.x (D-REC-4) — Timeline procedural del reclamo.
                 Muestra todos los eventos del ciclo (creado, enviado, aceptado,
                 cobrado, etc.) con timestamp y usuario. Compatible con reclamos
                 legacy (sin historial[]) — los reconstruye desde timestamps. */}
            <ReclamoTimeline reclamo={reclamo} />
          </div>
        )}

        {/* Footer crear */}
        {esCreacion && (
          <div className="flex justify-between pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose} disabled={submittingCreate}>Cancelar</Button>
            <Button variant="primary" onClick={handleCrear} disabled={submittingCreate || !envio}>
              {submittingCreate ? 'Creando...' : 'Crear borrador'}
            </Button>
          </div>
        )}

        {!esCreacion && isEstadoFinal && (
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>

      {/* S54.x (D-REC-5) — Sub-modal "Registrar respuesta del destinatario".
           4 opciones radio que cubren todas las salidas del ciclo:
            - reembolso → aceptar() con monto, queda 'aceptado' → cobro luego
            - reemplazo → cierra este modal y abre ResolverReclamoModal (S45)
            - disputa  → marcarEnDisputa() con motivo
            - rechazo  → rechazar() con motivo, registra gasto merma */}
      {reclamo && (
        <Modal
          isOpen={mostrarRespuestaModal}
          onClose={() => setMostrarRespuestaModal(false)}
          title="Registrar respuesta del destinatario"
          size="md"
        >
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              ¿Cómo respondió <strong>{reclamo.destinatarioNombre}</strong> al reclamo?
            </div>

            {/* Opción 1: aceptado con reembolso */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                respuestaTipo === 'reembolso'
                  ? 'border-2 border-emerald-300 bg-emerald-50/40'
                  : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="respuesta-tipo"
                checked={respuestaTipo === 'reembolso'}
                onChange={() => setRespuestaTipo('reembolso')}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-sm text-slate-900">Aceptó · va a reembolsar</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Se aceptará el reclamo y quedará pendiente de cobro. Cuando el dinero llegue a tu cuenta,
                  registrás el cobro por separado (no se crea movimiento de tesorería todavía).
                </div>
                {respuestaTipo === 'reembolso' && (
                  <div className="mt-2">
                    <label className="block text-[10px] font-medium text-emerald-900 uppercase tracking-wider mb-1">
                      Monto acordado (S/)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={respuestaMontoAcordado}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*[.,]?\d*$/.test(v)) setRespuestaMontoAcordado(v);
                      }}
                      className="w-40 px-2 py-1 text-sm border border-emerald-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder={reclamo.montoReclamadoPEN.toFixed(2)}
                    />
                    <span className="text-[10px] text-slate-500 ml-2">
                      Reclamado: S/ {reclamo.montoReclamadoPEN.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </label>

            {/* Opción nueva (S55 Fase 6): Crédito a favor — sin cash, queda saldo CC.
                Solo aplica a destinatarios proveedor/courier (con destinatarioId). */}
            {(reclamo.destinatario === 'proveedor' || reclamo.destinatario === 'courier') &&
              reclamo.destinatarioId && (
              <label
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  respuestaTipo === 'credito_a_favor'
                    ? 'border-2 border-teal-300 bg-teal-50/40'
                    : 'border border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="respuesta-tipo"
                  checked={respuestaTipo === 'credito_a_favor'}
                  onChange={() => setRespuestaTipo('credito_a_favor')}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-600" />
                    <span className="font-semibold text-sm text-slate-900">Aceptó · crédito a favor (sin cash)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    El destinatario reconoce la deuda pero NO paga cash ahora.
                    Queda como saldo a favor en su Cuenta Corriente, aplicable
                    a próximas {reclamo.destinatario === 'proveedor' ? 'OCs' : 'envíos / fletes'}.
                  </div>
                  {respuestaTipo === 'credito_a_favor' && (
                    <div className="mt-2">
                      <label className="block text-[10px] font-medium text-teal-900 uppercase tracking-wider mb-1">
                        Monto del crédito (S/)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={respuestaMontoAcordado}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d*[.,]?\d*$/.test(v)) setRespuestaMontoAcordado(v);
                        }}
                        className="w-40 px-2 py-1 text-sm border border-teal-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder={reclamo.montoReclamadoPEN.toFixed(2)}
                      />
                      <span className="text-[10px] text-slate-500 ml-2">
                        Reclamado: S/ {reclamo.montoReclamadoPEN.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </label>
            )}

            {/* Opción 2: aceptado con reemplazo (S45 D-16) */}
            {subenviosT1Flag && (
              <label
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  respuestaTipo === 'reemplazo'
                    ? 'border-2 border-sky-300 bg-sky-50/40'
                    : 'border border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="respuesta-tipo"
                  checked={respuestaTipo === 'reemplazo'}
                  onChange={() => setRespuestaTipo('reemplazo')}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-600" />
                    <span className="font-semibold text-sm text-slate-900">Aceptó · va a enviar reemplazo físico</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Crea sub-tanda de reemplazo dentro del envío original. Sin movimiento $.
                    Al confirmar abrirá el formulario para registrar tracking del reemplazo.
                  </div>
                </div>
              </label>
            )}

            {/* Opción 3: en disputa */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                respuestaTipo === 'disputa'
                  ? 'border-2 border-amber-300 bg-amber-50/40'
                  : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="respuesta-tipo"
                checked={respuestaTipo === 'disputa'}
                onChange={() => setRespuestaTipo('disputa')}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-sm text-slate-900">Está cuestionando · pide más info</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Pasa a "en disputa". Podés volver a registrar respuesta cuando llegue la decisión final.
                </div>
                {respuestaTipo === 'disputa' && (
                  <div className="mt-2">
                    <label className="block text-[10px] font-medium text-amber-900 uppercase tracking-wider mb-1">
                      Motivo de la disputa
                    </label>
                    <textarea
                      value={respuestaMotivo}
                      onChange={(e) => setRespuestaMotivo(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 text-sm border border-amber-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Ej: cuestionan el monto, piden evidencia adicional..."
                    />
                  </div>
                )}
              </div>
            </label>

            {/* Opción 4: rechazó */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                respuestaTipo === 'rechazo'
                  ? 'border-2 border-red-300 bg-red-50/40'
                  : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="respuesta-tipo"
                checked={respuestaTipo === 'rechazo'}
                onChange={() => setRespuestaTipo('rechazo')}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-600" />
                  <span className="font-semibold text-sm text-slate-900">Rechazó · no asume</span>
                </div>
                <div className="text-[11px] text-red-700 mt-1">
                  ⚠️ Al confirmar se registrará automáticamente un gasto tipo merma por
                  S/ {reclamo.montoReclamadoPEN.toFixed(2)}.
                </div>
                {respuestaTipo === 'rechazo' && (
                  <div className="mt-2">
                    <label className="block text-[10px] font-medium text-red-900 uppercase tracking-wider mb-1">
                      Motivo del rechazo
                    </label>
                    <textarea
                      value={respuestaMotivo}
                      onChange={(e) => setRespuestaMotivo(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 text-sm border border-red-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Ej: courier no asume, seguro no cubre, fuera de plazo..."
                    />
                  </div>
                )}
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMostrarRespuestaModal(false)}
                disabled={actionPending?.startsWith('respuesta-') ?? false}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmarRespuesta}
                disabled={actionPending?.startsWith('respuesta-') ?? false}
              >
                {actionPending?.startsWith('respuesta-') ? 'Procesando...' : 'Confirmar respuesta'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* S45 (D-16) — Modal "Resolver reclamo" con 3 salidas (reembolso/reemplazo/merma) */}
      {reclamo && (
        <ResolverReclamoModal
          isOpen={mostrarResolverModal}
          onClose={() => setMostrarResolverModal(false)}
          reclamo={{
            numeroReclamo: reclamo.numeroReclamo,
            envioNumero: reclamo.envioNumero,
            unidadesCount: reclamo.cantidadUnidades,
            unidadLabel: envio?.productosSummary?.[0]?.nombre,
            montoReclamadoUSD: reclamo.montoReclamadoUSD ?? reclamo.montoReclamadoPEN,
            montoReclamadoPEN: reclamo.montoReclamadoPEN,
            destinatarioNombre: reclamo.destinatarioNombre,
          }}
          onConfirm={handleResolverReclamo}
          loading={
            actionPending === 'resolver-reembolso' ||
            actionPending === 'resolver-reemplazo' ||
            actionPending === 'resolver-merma'
          }
        />
      )}
    </Modal>
  );
};
