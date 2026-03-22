/**
 * DevolucionDetailModal.tsx
 *
 * Modal de detalle completo de una devolución.
 * Muestra el estado actual, historial del flujo y botones de acción
 * según el estado y el rol del usuario.
 *
 * Flujo de botones:
 *   solicitada  → [Aprobar] [Rechazar]  (solo admin/gerente)
 *   aprobada    → [Ejecutar Recepción]  (formulario de condición)
 *   ejecutada   → [Devolver Dinero]     (formulario de pago)
 *   completada/rechazada/cancelada → solo lectura
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Modal, Button, useConfirmDialog, ConfirmDialog } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { devolucionService } from '../../services/devolucion.service';
import { logger } from '../../lib/logger';
import { formatCurrencyPEN } from '../../utils/format';
import type { Devolucion, CondicionProductoDevuelto } from '../../types/devolucion.types';
import type { MetodoPago } from '../../types/venta.types';

// ================================================================
// CONSTANTES
// ================================================================

const LABEL_MOTIVO: Record<string, string> = {
  producto_danado: 'Producto llegó dañado',
  producto_equivocado: 'Producto equivocado enviado',
  no_cumple_expectativa: 'No cumple expectativa del cliente',
  vencido_proximo: 'Producto próximo a vencer',
  duplicado: 'Pedido duplicado',
  error_pedido: 'Error en el pedido',
  otro: 'Otro motivo',
};

const LABEL_METODO_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta',
  mercado_pago: 'Mercado Pago',
  paypal: 'PayPal',
  zelle: 'Zelle',
  otro: 'Otro',
};

const METODOS_PAGO: Array<{ value: MetodoPago; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'otro', label: 'Otro' },
];

// ================================================================
// BADGE DE ESTADO
// ================================================================

function BadgeEstado({ estado }: { estado: string }) {
  const clases: Record<string, string> = {
    solicitada: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    aprobada: 'bg-blue-100 text-blue-800 border border-blue-200',
    ejecutada: 'bg-purple-100 text-purple-800 border border-purple-200',
    completada: 'bg-green-100 text-green-800 border border-green-200',
    rechazada: 'bg-red-100 text-red-800 border border-red-200',
    cancelada: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  const etiquetas: Record<string, string> = {
    solicitada: 'Solicitada',
    aprobada: 'Aprobada',
    ejecutada: 'Ejecutada',
    completada: 'Completada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${clases[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {etiquetas[estado] ?? estado}
    </span>
  );
}

// ================================================================
// HELPER: formatear Timestamp de Firestore
// ================================================================

function formatFecha(ts: any): string {
  if (!ts) return '—';
  const date = ts?.toDate?.() ?? new Date(ts);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ================================================================
// PROPS
// ================================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  devolucion: Devolucion;
  onActualizar?: () => void;
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export const DevolucionDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  devolucion,
  onActualizar,
}) => {
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const toast = useToastStore();
  const { dialogProps, confirm } = useConfirmDialog();

  const [submitting, setSubmitting] = useState(false);

  // Sub-formulario: Recepción física (aprobada → ejecutada)
  const [mostrarFormRecepcion, setMostrarFormRecepcion] = useState(false);
  const [condiciones, setCondiciones] = useState<Record<string, CondicionProductoDevuelto>>({});
  const [unidadesInput, setUnidadesInput] = useState<Record<string, string>>({});

  // Sub-formulario: Devolución de dinero (ejecutada → completada)
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [montoPago, setMontoPago] = useState(devolucion.montoDevolucion);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [notasPago, setNotasPago] = useState('');

  // Roles que pueden aprobar/rechazar
  const esAdminOGerente =
    userProfile?.role === 'admin' || userProfile?.role === 'gerente';

  // ---------------------------------------------------------------
  // APROBAR
  // ---------------------------------------------------------------
  const handleAprobar = async () => {
    if (!user) return;
    const ok = await confirm({
      title: 'Aprobar devolución',
      message: `¿Confirma que aprueba la devolución ${devolucion.numeroDevolucion}? El almacén procederá a recibir los productos del cliente.`,
      confirmText: 'Aprobar',
      variant: 'info',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      await devolucionService.aprobar(devolucion.id, user.uid);
      toast.success(`Devolución ${devolucion.numeroDevolucion} aprobada`, 'Aprobada');
      onActualizar?.();
      onClose();
    } catch (error: any) {
      logger.error('[DevolucionDetailModal.aprobar]', error);
      toast.error(error.message || 'Error al aprobar la devolución');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // RECHAZAR
  // ---------------------------------------------------------------
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [mostrarFormRechazo, setMostrarFormRechazo] = useState(false);

  const handleRechazar = async () => {
    if (!user || !motivoRechazo.trim()) {
      toast.error('El motivo de rechazo es obligatorio');
      return;
    }
    setSubmitting(true);
    try {
      await devolucionService.rechazar(devolucion.id, motivoRechazo.trim(), user.uid);
      toast.success(`Devolución ${devolucion.numeroDevolucion} rechazada`, 'Rechazada');
      onActualizar?.();
      onClose();
    } catch (error: any) {
      logger.error('[DevolucionDetailModal.rechazar]', error);
      toast.error(error.message || 'Error al rechazar la devolución');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // EJECUTAR RECEPCIÓN
  // ---------------------------------------------------------------
  const handleEjecutar = async () => {
    if (!user) return;

    // Validar que cada producto tenga condición y al menos un ID de unidad
    for (const prod of devolucion.productos) {
      if (!condiciones[prod.productoId]) {
        toast.error(`Falta la condición del producto "${prod.nombreProducto}"`);
        return;
      }
      const ids = (unidadesInput[prod.productoId] ?? '').split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        toast.error(`Falta el ID de unidad para "${prod.nombreProducto}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const productosRecibidos = devolucion.productos.map(prod => ({
        productoId: prod.productoId,
        unidadesIds: (unidadesInput[prod.productoId] ?? '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        condicion: condiciones[prod.productoId],
      }));

      await devolucionService.ejecutar(
        { devolucionId: devolucion.id, productosRecibidos },
        user.uid
      );
      toast.success(`Recepción ejecutada — inventario actualizado`, 'Ejecutada');
      onActualizar?.();
      onClose();
    } catch (error: any) {
      logger.error('[DevolucionDetailModal.ejecutar]', error);
      toast.error(error.message || 'Error al ejecutar la recepción');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // DEVOLVER DINERO
  // ---------------------------------------------------------------
  const handleDevolverDinero = async () => {
    if (!user) return;
    if (montoPago <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      await devolucionService.devolverDinero(
        {
          devolucionId: devolucion.id,
          monto: montoPago,
          metodoPago,
          referencia: referenciaPago.trim() || undefined,
          notas: notasPago.trim() || undefined,
        },
        user.uid
      );
      toast.success(
        `${formatCurrencyPEN(montoPago)} devueltos al cliente`,
        'Devolución Completada'
      );
      onActualizar?.();
      onClose();
    } catch (error: any) {
      logger.error('[DevolucionDetailModal.devolverDinero]', error);
      toast.error(error.message || 'Error al registrar la devolución de dinero');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // CANCELAR
  // ---------------------------------------------------------------
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [mostrarFormCancelacion, setMostrarFormCancelacion] = useState(false);

  const handleCancelar = async () => {
    if (!user || !motivoCancelacion.trim()) {
      toast.error('El motivo de cancelación es obligatorio');
      return;
    }
    setSubmitting(true);
    try {
      await devolucionService.cancelar(devolucion.id, motivoCancelacion.trim(), user.uid);
      toast.success(`Devolución ${devolucion.numeroDevolucion} cancelada`);
      onActualizar?.();
      onClose();
    } catch (error: any) {
      logger.error('[DevolucionDetailModal.cancelar]', error);
      toast.error(error.message || 'Error al cancelar la devolución');
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Detalle de Devolución"
        size="xl"
      >
        <div className="space-y-6">
          {/* ---- HEADER ---- */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <RotateCcw className="h-5 w-5 text-gray-500" />
                <h2 className="text-xl font-bold text-gray-900">
                  {devolucion.numeroDevolucion}
                </h2>
                <BadgeEstado estado={devolucion.estado} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Creada el {formatFecha(devolucion.fechaCreacion)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Monto a devolver</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrencyPEN(devolucion.montoDevolucion)}
              </p>
              {devolucion.montoDevuelto > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  Devuelto: {formatCurrencyPEN(devolucion.montoDevuelto)}
                </p>
              )}
            </div>
          </div>

          {/* ---- VENTA ORIGEN ---- */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Venta Origen</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Numero:</span>{' '}
                <span className="font-medium">{devolucion.ventaNumero}</span>
              </div>
              <div>
                <span className="text-gray-500">Cliente:</span>{' '}
                <span className="font-medium">{devolucion.clienteNombre}</span>
              </div>
              <div>
                <span className="text-gray-500">Motivo:</span>{' '}
                <span className="font-medium">
                  {LABEL_MOTIVO[devolucion.motivo] ?? devolucion.motivo}
                </span>
              </div>
              {devolucion.detalleMotivo && (
                <div className="col-span-2">
                  <span className="text-gray-500">Detalle:</span>{' '}
                  <span className="font-medium">{devolucion.detalleMotivo}</span>
                </div>
              )}
            </div>
          </div>

          {/* ---- PRODUCTOS DEVUELTOS ---- */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              Productos devueltos
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 text-gray-500 font-medium">Producto</th>
                    <th className="pb-2 text-gray-500 font-medium text-center">Cant.</th>
                    <th className="pb-2 text-gray-500 font-medium text-right">P. Unit.</th>
                    <th className="pb-2 text-gray-500 font-medium text-right">Subtotal</th>
                    <th className="pb-2 text-gray-500 font-medium text-center">Condición</th>
                  </tr>
                </thead>
                <tbody>
                  {devolucion.productos.map(prod => (
                    <tr key={prod.productoId} className="border-b border-gray-100">
                      <td className="py-2">
                        <p className="font-medium text-gray-900">{prod.nombreProducto}</p>
                        <p className="text-xs text-gray-400">{prod.sku}</p>
                      </td>
                      <td className="py-2 text-center text-gray-700">{prod.cantidad}</td>
                      <td className="py-2 text-right text-gray-700">
                        {formatCurrencyPEN(prod.precioUnitarioOriginal)}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {formatCurrencyPEN(prod.subtotalDevolucion)}
                      </td>
                      <td className="py-2 text-center">
                        {prod.condicion ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              prod.condicion === 'vendible'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {prod.condicion === 'vendible' ? 'Vendible' : 'Danado'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- HISTORIAL DEL FLUJO ---- */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              Historial del flujo
            </h3>
            <ol className="relative border-l border-gray-200 space-y-4 ml-3">
              {/* Creación */}
              <li className="pl-6">
                <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-100 ring-2 ring-white">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                </span>
                <p className="text-sm font-medium text-gray-800">Solicitud creada</p>
                <p className="text-xs text-gray-500">{formatFecha(devolucion.fechaCreacion)}</p>
                <p className="text-xs text-gray-500">Por: {devolucion.creadoPor}</p>
              </li>

              {/* Aprobación */}
              {devolucion.fechaAprobacion && (
                <li className="pl-6">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 ring-2 ring-white">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                  </span>
                  <p className="text-sm font-medium text-gray-800">Aprobada</p>
                  <p className="text-xs text-gray-500">{formatFecha(devolucion.fechaAprobacion)}</p>
                  {devolucion.aprobadoPor && (
                    <p className="text-xs text-gray-500">Por: {devolucion.aprobadoPor}</p>
                  )}
                </li>
              )}

              {/* Rechazo */}
              {devolucion.fechaRechazo && (
                <li className="pl-6">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 ring-2 ring-white">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                  </span>
                  <p className="text-sm font-medium text-gray-800">Rechazada</p>
                  <p className="text-xs text-gray-500">{formatFecha(devolucion.fechaRechazo)}</p>
                  {devolucion.motivoRechazo && (
                    <p className="text-xs text-red-600">Motivo: {devolucion.motivoRechazo}</p>
                  )}
                </li>
              )}

              {/* Ejecución */}
              {devolucion.fechaEjecucion && (
                <li className="pl-6">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-purple-100 ring-2 ring-white">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                  </span>
                  <p className="text-sm font-medium text-gray-800">Producto recibido</p>
                  <p className="text-xs text-gray-500">{formatFecha(devolucion.fechaEjecucion)}</p>
                </li>
              )}

              {/* Completada */}
              {devolucion.fechaCompletado && (
                <li className="pl-6">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-green-100 ring-2 ring-white">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  <p className="text-sm font-medium text-gray-800">Dinero devuelto</p>
                  <p className="text-xs text-gray-500">{formatFecha(devolucion.fechaCompletado)}</p>
                  {devolucion.metodoPago && (
                    <p className="text-xs text-gray-500">
                      Via: {LABEL_METODO_PAGO[devolucion.metodoPago] ?? devolucion.metodoPago}
                      {devolucion.referenciaPago && ` — Ref: ${devolucion.referenciaPago}`}
                    </p>
                  )}
                </li>
              )}
            </ol>
          </div>

          {/* ================================================================
              ACCIONES SEGÚN ESTADO
          ================================================================ */}

          {/* SOLICITADA → Aprobar / Rechazar / Cancelar */}
          {devolucion.estado === 'solicitada' && (
            <div className="border-t border-gray-200 pt-4 space-y-4">
              {/* Formulario de rechazo */}
              {mostrarFormRechazo ? (
                <div className="bg-red-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">Motivo de rechazo</p>
                  <textarea
                    value={motivoRechazo}
                    onChange={e => setMotivoRechazo(e.target.value)}
                    rows={3}
                    placeholder="Explica por qué se rechaza esta devolución..."
                    className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setMostrarFormRechazo(false)}
                      disabled={submitting}
                    >
                      Volver
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleRechazar}
                      disabled={!motivoRechazo.trim() || submitting}
                      loading={submitting}
                    >
                      Confirmar Rechazo
                    </Button>
                  </div>
                </div>
              ) : mostrarFormCancelacion ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Motivo de cancelación</p>
                  <textarea
                    value={motivoCancelacion}
                    onChange={e => setMotivoCancelacion(e.target.value)}
                    rows={2}
                    placeholder="Explica por qué se cancela esta solicitud..."
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setMostrarFormCancelacion(false)}
                      disabled={submitting}
                    >
                      Volver
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleCancelar}
                      disabled={!motivoCancelacion.trim() || submitting}
                      loading={submitting}
                    >
                      Confirmar Cancelación
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setMostrarFormCancelacion(true)}
                    disabled={submitting}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancelar solicitud
                  </Button>
                  {esAdminOGerente && (
                    <>
                      <Button
                        variant="danger"
                        onClick={() => setMostrarFormRechazo(true)}
                        disabled={submitting}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rechazar
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleAprobar}
                        disabled={submitting}
                        loading={submitting}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprobar
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* APROBADA → Ejecutar recepción */}
          {devolucion.estado === 'aprobada' && (
            <div className="border-t border-gray-200 pt-4 space-y-4">
              {mostrarFormRecepcion ? (
                <div className="bg-purple-50 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-semibold text-purple-700">
                    Registrar recepción física
                  </p>
                  <p className="text-xs text-purple-600">
                    Para cada producto, indica los IDs de las unidades recibidas y su condición.
                    Puedes encontrar los IDs en el módulo de Inventario.
                  </p>
                  {devolucion.productos.map(prod => (
                    <div key={prod.productoId} className="bg-white rounded-lg p-3 space-y-2 border border-purple-200">
                      <p className="text-sm font-medium text-gray-800">{prod.nombreProducto}</p>
                      <p className="text-xs text-gray-500">
                        Cantidad a recibir: {prod.cantidad}
                      </p>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          IDs de unidades (separados por coma)
                        </label>
                        <input
                          type="text"
                          value={unidadesInput[prod.productoId] ?? ''}
                          onChange={e =>
                            setUnidadesInput(prev => ({
                              ...prev,
                              [prod.productoId]: e.target.value,
                            }))
                          }
                          placeholder="ej: unit001, unit002"
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Condición del producto
                        </label>
                        <div className="flex gap-4">
                          {(['vendible', 'danado'] as const).map(cond => (
                            <label
                              key={cond}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`cond-${prod.productoId}`}
                                value={cond}
                                checked={condiciones[prod.productoId] === cond}
                                onChange={() =>
                                  setCondiciones(prev => ({
                                    ...prev,
                                    [prod.productoId]: cond,
                                  }))
                                }
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              <span className={`text-sm ${cond === 'vendible' ? 'text-green-700' : 'text-red-700'}`}>
                                {cond === 'vendible' ? 'Vendible' : 'Danado'}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setMostrarFormRecepcion(false)}
                      disabled={submitting}
                    >
                      Volver
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleEjecutar}
                      disabled={submitting}
                      loading={submitting}
                    >
                      <Package className="h-4 w-4 mr-1" />
                      Confirmar Recepción
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => setMostrarFormRecepcion(true)}
                    disabled={submitting}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Ejecutar Recepción
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* EJECUTADA → Devolver dinero */}
          {devolucion.estado === 'ejecutada' && (
            <div className="border-t border-gray-200 pt-4 space-y-4">
              {mostrarFormPago ? (
                <div className="bg-green-50 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-semibold text-green-700">
                    Registrar devolución de dinero
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Monto */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Monto a devolver (S/)
                      </label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={montoPago}
                        onChange={e => setMontoPago(parseFloat(e.target.value) || 0)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* Método de pago */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Método de pago
                      </label>
                      <select
                        value={metodoPago}
                        onChange={e => setMetodoPago(e.target.value as MetodoPago)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {METODOS_PAGO.map(m => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Referencia */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Referencia / número de operación{' '}
                      <span className="text-gray-400">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={referenciaPago}
                      onChange={e => setReferenciaPago(e.target.value)}
                      placeholder="Ej: OP-123456"
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Notas{' '}
                      <span className="text-gray-400">(opcional)</span>
                    </label>
                    <textarea
                      value={notasPago}
                      onChange={e => setNotasPago(e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setMostrarFormPago(false)}
                      disabled={submitting}
                    >
                      Volver
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleDevolverDinero}
                      disabled={montoPago <= 0 || submitting}
                      loading={submitting}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Confirmar Devolución de Dinero
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Productos recibidos. Falta registrar la devolución del dinero al cliente.
                    </span>
                  </div>
                  <Button
                    variant="success"
                    onClick={() => setMostrarFormPago(true)}
                    disabled={submitting}
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Devolver Dinero
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* COMPLETADA */}
          {devolucion.estado === 'completada' && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">
                  Devolución completada. {formatCurrencyPEN(devolucion.montoDevuelto)} devueltos al cliente
                  {devolucion.metodoPago
                    ? ` via ${LABEL_METODO_PAGO[devolucion.metodoPago] ?? devolucion.metodoPago}`
                    : ''}.
                </span>
              </div>
            </div>
          )}

          {/* RECHAZADA */}
          {devolucion.estado === 'rechazada' && devolucion.motivoRechazo && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Devolución rechazada</p>
                  <p className="mt-1">Motivo: {devolucion.motivoRechazo}</p>
                </div>
              </div>
            </div>
          )}

          {/* CANCELADA */}
          {devolucion.estado === 'cancelada' && devolucion.motivoCancelacion && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Devolución cancelada</p>
                  <p className="mt-1">Motivo: {devolucion.motivoCancelacion}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog {...dialogProps} />
    </>
  );
};
