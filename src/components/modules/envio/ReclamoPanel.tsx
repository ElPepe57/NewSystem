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
import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { Modal, Button, Badge } from '../../common';
import type {
  Reclamo,
  ReclamoFormData,
  TipoReclamo,
  DestinatarioReclamo,
  EstadoReclamo,
} from '../../../types/reclamo.types';
import type { Envio, IncidenciaEnvio } from '../../../types/envio.types';
import type { MetodoTesoreria } from '../../../types/tesoreria.types';
import { useReclamoStore } from '../../../store/reclamoStore';
import { useToastStore } from '../../../store/toastStore';

interface ReclamoPanelProps {
  /** Si viene: modo ver/avanzar. Si no: modo crear */
  reclamo?: Reclamo;
  /** Envío asociado — requerido para crear, opcional para ver */
  envio?: Envio;
  /** Incidencias preseleccionadas (cuando se abre desde GestionIncidenciasModal) */
  incidenciasSugeridas?: IncidenciaEnvio[];
  userId: string;
  onClose: () => void;
  onSuccess?: () => void;
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

  const [tipo, setTipo] = useState<TipoReclamo>(() => {
    // Inferir tipo del primer incidente sugerido
    const primera = unidadesSugeridas[0];
    if (primera?.tipo === 'danada') return 'danada';
    if (primera?.tipo === 'faltante') return 'perdida';
    if (primera?.tipo === 'aduana') return 'aduana_timeout';
    return 'otro';
  });

  const [destinatario, setDestinatario] = useState<DestinatarioReclamo>(() => {
    if (envio?.colaboradorTipo === 'courier_externo' || envio?.colaboradorTipo === 'courier_interno') return 'courier';
    if (envio?.origenTipo === 'proveedor') return 'proveedor';
    return 'courier';
  });

  const [destinatarioNombre, setDestinatarioNombre] = useState<string>(() => {
    return envio?.colaboradorNombre || envio?.origenProveedorNombre || '';
  });

  const [montoReclamadoPEN, setMontoReclamadoPEN] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // ─── Estado modo VER/AVANZAR ────────────────────────────────────────────

  const [actionPending, setActionPending] = useState<string | null>(null);
  const [mostrarDisputaForm, setMostrarDisputaForm] = useState(false);
  const [mostrarAceptarForm, setMostrarAceptarForm] = useState(false);
  const [mostrarCobroForm, setMostrarCobroForm] = useState(false);
  const [mostrarRechazoForm, setMostrarRechazoForm] = useState(false);

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

    setSubmittingCreate(true);
    try {
      const data: ReclamoFormData = {
        envioId: envio.id,
        envioNumero: envio.numeroEnvio,
        ordenCompraId: envio.ordenCompraId,
        ordenCompraNumero: envio.ordenCompraNumero,
        tipo,
        destinatario,
        destinatarioNombre: destinatarioNombre.trim(),
        destinatarioId: destinatario === 'courier' ? envio.colaboradorId : envio.origenProveedorId,
        unidadesIds,
        montoReclamadoPEN: monto,
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

            {/* Tipo + Destinatario */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de reclamo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoReclamo)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="danada">{TIPO_LABELS.danada}</option>
                  <option value="perdida">{TIPO_LABELS.perdida}</option>
                  <option value="aduana_timeout">{TIPO_LABELS.aduana_timeout}</option>
                  <option value="otro">{TIPO_LABELS.otro}</option>
                </select>
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

            {/* Nombre destinatario */}
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

            {/* Monto + notas */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Monto reclamado (S/) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={montoReclamadoPEN}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*[.,]?\d*$/.test(v)) setMontoReclamadoPEN(v);
                }}
                className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Contexto, nº tracking, referencia de caso..."
              />
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

            {/* Acciones principales según estado */}
            {!isEstadoFinal && !mostrarDisputaForm && !mostrarAceptarForm && !mostrarCobroForm && !mostrarRechazoForm && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                {reclamo.estado === 'borrador' && (
                  <>
                    <Button variant="primary" onClick={handleEnviar} disabled={actionPending === 'enviar'}>
                      <Send className="w-4 h-4 mr-1.5" />
                      Enviar reclamo
                    </Button>
                    <Button variant="danger" onClick={handleEliminar} disabled={actionPending === 'eliminar'}>
                      <X className="w-4 h-4 mr-1.5" />
                      Eliminar
                    </Button>
                  </>
                )}

                {(reclamo.estado === 'enviado' || reclamo.estado === 'en_disputa') && (
                  <>
                    {reclamo.estado === 'enviado' && (
                      <Button variant="secondary" onClick={() => setMostrarDisputaForm(true)}>
                        <ShieldAlert className="w-4 h-4 mr-1.5" />
                        Marcar en disputa
                      </Button>
                    )}
                    <Button variant="primary" onClick={() => { setMontoAcordado(reclamo.montoReclamadoPEN.toFixed(2)); setMostrarAceptarForm(true); }}>
                      <ThumbsUp className="w-4 h-4 mr-1.5" />
                      Aceptar
                    </Button>
                    <Button variant="danger" onClick={() => setMostrarRechazoForm(true)}>
                      <Ban className="w-4 h-4 mr-1.5" />
                      Rechazar
                    </Button>
                  </>
                )}

                {reclamo.estado === 'aceptado' && (
                  <>
                    <Button variant="primary" onClick={() => {
                      setMontoCobrado((reclamo.montoAcordadoPEN || reclamo.montoReclamadoPEN).toFixed(2));
                      setMostrarCobroForm(true);
                    }}>
                      <DollarSign className="w-4 h-4 mr-1.5" />
                      Registrar cobro
                    </Button>
                    <Button variant="danger" onClick={() => setMostrarRechazoForm(true)}>
                      <Ban className="w-4 h-4 mr-1.5" />
                      Rechazar
                    </Button>
                  </>
                )}
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
          </div>
        )}

        {/* Footer crear */}
        {esCreacion && (
          <div className="flex justify-between pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose} disabled={submittingCreate}>Cancelar</Button>
            <Button variant="primary" onClick={handleCrear} disabled={submittingCreate || !envio}>
              {submittingCreate ? 'Creando...' : 'Crear reclamo'}
            </Button>
          </div>
        )}

        {!esCreacion && isEstadoFinal && (
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
