/**
 * PerfilFDespacho — Última milla (Caso F · despacho de venta).
 *
 * Superficies del perfil "Despacho de venta" del detalle de envío que absorben
 * lo que hacía la entidad `Entrega`:
 *   - TabRepartoF   · info de reparto (dirección, ventana, estado, foto/firma, fallo)
 *   - TabCobroCODF  · cobro contra-entrega (monto, método, conciliación COD − flete)
 *   - 4 modales de acción (FormModalV2) que orquestan el motor `envioDespachoService`:
 *       ProgramarDespachoFModal  · borrador → programada
 *       DespacharEnCaminoFModal  · programada/reprogramada → en_camino (+ gasto flete)
 *       RegistrarEntregaFModal   · en_camino → entregada (+ cobro COD)
 *       ReprogramarFalloFModal   · → fallida | reprogramada
 *
 * El detalle (EnvioDetailModal) monta estos componentes de forma condicional
 * (`esPerfilF`) sin alterar el flujo de importación.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin, Clock, CalendarClock, Camera, PenLine, AlertTriangle, HandCoins,
  Truck, CheckCircle2, Store, Landmark, Info,
} from 'lucide-react';
import { FormModalV2 } from '../../design-system';
import { cn } from '../../design-system';
import { envioDespachoService } from '../../services/envio.despacho.service';
import { tesoreriaService } from '../../services/tesoreria.service';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useToastStore } from '../../store/toastStore';
import type { Envio, MotivoFallo } from '../../types/envio.types';
import type { MetodoPago } from '../../types/venta.types';
import type { CuentaCaja } from '../../types/tesoreria.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const money = (n: number | undefined): string =>
  `S/ ${(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Fecha local YYYY-MM-DD de hoy (+offset días) · evita el corrimiento UTC de toISOString(). */
const localDateStr = (offsetDias = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Parsea 'YYYY-MM-DD' como fecha LOCAL (no UTC) · evita el off-by-one en zonas UTC−. */
const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const METODOS_COD: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta (POS)' },
];

const MOTIVOS_FALLO: { value: MotivoFallo; label: string }[] = [
  { value: 'no_encontrado', label: 'Dirección no encontrada' },
  { value: 'ausente', label: 'Cliente ausente' },
  { value: 'rechazo', label: 'Cliente rechazó la entrega' },
  { value: 'producto_danado', label: 'Producto dañado' },
  { value: 'pago_rechazado', label: 'Pago rechazado' },
  { value: 'otro', label: 'Otro' },
];

// Estilos de campo comunes (alineados a los modales existentes de Envíos)
const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500';
const labelCls = 'text-xs font-medium text-slate-700 mb-1.5 block';

// ═══════════════════════════════════════════════════════════════════════════
// TAB · Reparto (vista)
// ═══════════════════════════════════════════════════════════════════════════

export const TabRepartoF: React.FC<{ envio: Envio }> = ({ envio }) => {
  const direccion = [envio.destinoClienteDireccion, envio.destinoClienteDistrito]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <MapPin className="w-3.5 h-3.5" /> Dirección
          </div>
          <div className="text-sm text-slate-800">{direccion || '—'}</div>
          {envio.destinoClienteTelefono && (
            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">{envio.destinoClienteTelefono}</div>
          )}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <Clock className="w-3.5 h-3.5" /> Ventana de entrega
          </div>
          <div className="text-sm text-slate-800">{envio.horaProgramada || 'Sin ventana fijada'}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
            <CalendarClock className="w-3.5 h-3.5" /> Reparto
          </div>
          <div className="text-sm text-amber-900">
            {envio.numeroEntrega ? `Entrega #${envio.numeroEntrega}` : 'Entrega única'}
            {envio.estado === 'reprogramada' ? ' · reprogramada' : ''}
          </div>
          <div className="text-xs text-amber-700 mt-0.5">Reprogramable si falla</div>
        </div>
      </div>

      {/* Confirmaciones de entrega (foto / firma) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            <Camera className="w-3.5 h-3.5" /> Foto de entrega
          </div>
          {envio.fotoEntrega ? (
            <a href={envio.fotoEntrega} target="_blank" rel="noreferrer" className="text-xs text-orange-700 hover:underline break-all">
              Ver foto ↗
            </a>
          ) : (
            <div className="text-xs text-slate-400 italic">Se captura al registrar la entrega</div>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            <PenLine className="w-3.5 h-3.5" /> Firma del cliente
          </div>
          <div className="text-xs text-slate-600">{envio.firmaCliente || <span className="text-slate-400 italic">Pendiente</span>}</div>
        </div>
      </div>

      {/* Motivo de fallo (si aplica) */}
      {(envio.estado === 'fallida' || envio.estado === 'reprogramada') && envio.motivoFallo && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Motivo del último intento
          </div>
          <div className="text-sm text-rose-900">
            {MOTIVOS_FALLO.find((m) => m.value === envio.motivoFallo)?.label ?? envio.motivoFallo}
          </div>
          {envio.descripcionFallo && <div className="text-xs text-rose-700 mt-0.5">{envio.descripcionFallo}</div>}
        </div>
      )}

      {envio.notasEntregaDetalles && (
        <div className="text-xs text-slate-500 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
          <span>{envio.notasEntregaDetalles}</span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB · Cobro COD (vista)
// ═══════════════════════════════════════════════════════════════════════════

export const TabCobroCODF: React.FC<{ envio: Envio }> = ({ envio }) => {
  const porCobrar = envio.montoPorCobrar ?? 0;
  const recaudado = envio.montoRecaudado ?? 0;
  const flete = envio.costoDeliveryPEN ?? 0;
  const cobrado = !!envio.cobroRealizado;
  const neto = (cobrado ? recaudado : porCobrar) - flete;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card principal */}
      <div className="md:col-span-2 bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/60 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-[13px] font-bold text-rose-900">
            <HandCoins className="w-4 h-4" /> Cobro contra entrega (COD)
          </div>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
              cobrado ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            )}
          >
            {cobrado ? 'Cobrado' : 'Pendiente'}
          </span>
        </div>
        <div className="text-3xl font-bold tabular-nums text-rose-900 mt-1">{money(cobrado ? recaudado : porCobrar)}</div>
        <div className="text-[12px] text-rose-700 mt-1">
          {cobrado
            ? `Recaudado · método ${METODOS_COD.find((m) => m.value === envio.metodoPagoRecibido)?.label ?? envio.metodoPagoRecibido ?? '—'}`
            : `Se recauda al entregar · método esperado: ${METODOS_COD.find((m) => m.value === envio.metodoPagoEsperado)?.label ?? 'efectivo'}`}
        </div>
        <div className="mt-3 bg-white/70 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">¿Cómo funciona el COD?</div>
          <ol className="space-y-1.5 text-[12px] text-slate-600">
            <li className="flex gap-2">
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              El courier entrega y cobra {money(porCobrar)} al cliente.
            </li>
            <li className="flex gap-2">
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              El monto entra a la cuenta de cobro (si es caja del courier, el courier nos lo debe).
            </li>
            <li className="flex gap-2">
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              Al conciliar se descuenta su flete y se liquida el neto a Tesorería.
            </li>
          </ol>
        </div>
      </div>

      {/* Conciliación */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5" /> Conciliación
        </div>
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">COD a recaudar</span>
            <span className="tabular-nums font-semibold text-slate-900">{money(cobrado ? recaudado : porCobrar)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">− Flete courier</span>
            <span className="tabular-nums font-semibold text-slate-900">{money(flete)}</span>
          </div>
          <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
            <span className="text-slate-700 font-medium">Neto a liquidar</span>
            <span className="tabular-nums font-bold text-emerald-700">{money(Math.max(0, neto))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Modales de acción — props comunes
// ═══════════════════════════════════════════════════════════════════════════

interface FModalProps {
  envio: Envio;
  userId: string | undefined;
  onClose: () => void;
  onDone: () => void;
}

// ─── Programar despacho (borrador → programada) ─────────────────────────────

export const ProgramarDespachoFModal: React.FC<FModalProps> = ({ envio, userId, onClose, onDone }) => {
  const { colaboradores, fetchColaboradores } = useColaboradorStore();
  const toast = useToastStore();
  const [colaboradorId, setColaboradorId] = useState(envio.colaboradorId ?? '');
  const [fecha, setFecha] = useState(localDateStr());
  const [hora, setHora] = useState('');
  const [flete, setFlete] = useState<string>(envio.costoDeliveryPEN ? String(envio.costoDeliveryPEN) : '');
  const [cobroPendiente, setCobroPendiente] = useState<boolean>(envio.cobroPendiente ?? true);
  const [montoCobro, setMontoCobro] = useState<string>(envio.montoPorCobrar ? String(envio.montoPorCobrar) : '');
  const [metodoEsperado, setMetodoEsperado] = useState<MetodoPago>(envio.metodoPagoEsperado ?? 'efectivo');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
  }, [colaboradores.length, fetchColaboradores]);

  const couriers = useMemo(
    () => colaboradores.filter((c) => c.estado !== 'inactivo'),
    [colaboradores]
  );

  const handleSubmit = async () => {
    if (!userId) { toast.error('Usuario no identificado'); return; }
    if (cobroPendiente && !(Number(montoCobro) > 0)) { toast.error('Ingresá el monto a cobrar (COD)'); return; }
    setLoading(true);
    try {
      await envioDespachoService.programarDespacho(
        envio.id,
        {
          colaboradorTransporteId: colaboradorId || undefined,
          fechaProgramada: parseLocalDate(fecha),
          horaProgramada: hora || undefined,
          cobroPendiente,
          montoPorCobrar: cobroPendiente ? Number(montoCobro) : undefined,
          metodoPagoEsperado: cobroPendiente ? metodoEsperado : undefined,
          costoDeliveryPEN: flete !== '' ? Number(flete) : undefined,
        },
        userId
      );
      toast.success(`Despacho ${envio.numeroEnvio} programado`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al programar el despacho');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalV2
      isOpen
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Programar despacho"
      subtitle={`${envio.numeroEnvio} · ${envio.destinoClienteNombre ?? 'cliente'}`}
      icon={Store}
      iconTone="orange"
      color="orange"
      submitLabel="Programar"
      submitIcon={Truck}
      loading={loading}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Courier / repartidor</label>
          <select className={inputCls} value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            <option value="">Sin asignar aún</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fecha programada</label>
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Ventana (opcional)</label>
            <input type="text" placeholder="10:00 – 14:00" className={inputCls} value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Flete del courier (S/)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00" className={inputCls} value={flete} onChange={(e) => setFlete(e.target.value)} />
          <div className="text-[11px] text-slate-400 mt-1">Se registra como gasto de delivery al marcar en camino.</div>
        </div>
        {/* COD */}
        <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cobroPendiente} onChange={(e) => setCobroPendiente(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/40" />
            <span className="text-sm font-medium text-rose-900 flex items-center gap-1.5"><HandCoins className="w-4 h-4" /> Cobra contra entrega (COD)</span>
          </label>
          {cobroPendiente && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Monto a cobrar (S/)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" className={inputCls} value={montoCobro} onChange={(e) => setMontoCobro(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Método esperado</label>
                <select className={inputCls} value={metodoEsperado} onChange={(e) => setMetodoEsperado(e.target.value as MetodoPago)}>
                  {METODOS_COD.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </FormModalV2>
  );
};

// ─── Despachar (programada/reprogramada → en_camino) ────────────────────────

export const DespacharEnCaminoFModal: React.FC<FModalProps> = ({ envio, userId, onClose, onDone }) => {
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!userId) { toast.error('Usuario no identificado'); return; }
    setLoading(true);
    try {
      await envioDespachoService.marcarEnCaminoEnvio(envio.id, userId);
      toast.success(`${envio.numeroEnvio} en camino`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al despachar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalV2
      isOpen
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Despachar · en camino"
      subtitle={`${envio.numeroEnvio} · ${envio.colaboradorNombre ?? 'courier'}`}
      icon={Truck}
      iconTone="sky"
      color="orange"
      submitLabel="Marcar en camino"
      submitIcon={Truck}
      loading={loading}
      size="sm"
    >
      <div className="space-y-3 text-sm text-slate-600">
        <p>
          El courier sale hacia <b className="text-slate-800">{envio.destinoClienteNombre ?? 'el cliente'}</b>.
          El envío pasa a <span className="font-semibold text-sky-700">En camino</span>.
        </p>
        {(envio.costoDeliveryPEN ?? 0) > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">Se registra el gasto de flete</span>
            <span className="text-sm font-bold tabular-nums text-slate-900">{money(envio.costoDeliveryPEN)}</span>
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

// ─── Registrar entrega (en_camino → entregada) + cobro COD ──────────────────

export const RegistrarEntregaFModal: React.FC<FModalProps> = ({ envio, userId, onClose, onDone }) => {
  const toast = useToastStore();
  const [fecha, setFecha] = useState(localDateStr());
  const [foto, setFoto] = useState('');
  const [firma, setFirma] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const esCOD = !!envio.cobroPendiente;
  const [cobroRealizado, setCobroRealizado] = useState<boolean>(esCOD);
  const [montoRecaudado, setMontoRecaudado] = useState<string>(envio.montoPorCobrar ? String(envio.montoPorCobrar) : '');
  const [metodoRecibido, setMetodoRecibido] = useState<MetodoPago>(envio.metodoPagoEsperado ?? 'efectivo');
  const [cuentaId, setCuentaId] = useState('');
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);

  useEffect(() => {
    if (!esCOD) return;
    let alive = true;
    tesoreriaService.getCuentas().then((cs) => {
      if (!alive) return;
      const activas = cs.filter((c) => c.activa !== false);
      setCuentas(activas);
      if (activas[0]) setCuentaId((prev) => prev || activas[0].id);
    }).catch(() => { if (alive) useToastStore.getState().error('No se pudieron cargar las cuentas de cobro'); });
    return () => { alive = false; };
  }, [esCOD]);

  const codIncompleto = esCOD && cobroRealizado && (!(Number(montoRecaudado) > 0) || !cuentaId);

  const handleSubmit = async () => {
    if (!userId) { toast.error('Usuario no identificado'); return; }
    if (codIncompleto) { toast.error('Completá el monto y la cuenta del cobro'); return; }
    setLoading(true);
    try {
      await envioDespachoService.registrarEntregaExitosa(
        envio.id,
        {
          fechaEntrega: parseLocalDate(fecha),
          fotoEntrega: foto || undefined,
          firmaCliente: firma || undefined,
          notasEntrega: notas || undefined,
          ...(esCOD && cobroRealizado
            ? {
                cobroRealizado: true,
                montoRecaudado: Number(montoRecaudado) || 0,
                metodoPagoRecibido: metodoRecibido,
                cuentaDestinoId: cuentaId,
              }
            : { cobroRealizado: false }),
        },
        userId
      );
      toast.success(`${envio.numeroEnvio} entregado${esCOD && cobroRealizado ? ' · COD cobrado' : ''}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar la entrega');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalV2
      isOpen
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Registrar entrega"
      subtitle={`${envio.numeroEnvio} · ${envio.destinoClienteNombre ?? 'cliente'}`}
      icon={CheckCircle2}
      iconTone="emerald"
      color="orange"
      submitLabel="Confirmar entrega"
      submitIcon={CheckCircle2}
      loading={loading}
      disabled={codIncompleto}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fecha de entrega</label>
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Firma / recibido por</label>
            <input type="text" placeholder="Nombre de quien recibe" className={inputCls} value={firma} onChange={(e) => setFirma(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Foto de entrega (URL · opcional)</label>
          <input type="text" placeholder="https://..." className={inputCls} value={foto} onChange={(e) => setFoto(e.target.value)} />
        </div>

        {esCOD && (
          <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cobroRealizado} onChange={(e) => setCobroRealizado(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/40" />
              <span className="text-sm font-medium text-rose-900 flex items-center gap-1.5"><HandCoins className="w-4 h-4" /> Se cobró el COD ({money(envio.montoPorCobrar)})</span>
            </label>
            {cobroRealizado && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Monto recaudado (S/)</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={montoRecaudado} onChange={(e) => setMontoRecaudado(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Método</label>
                    <select className={inputCls} value={metodoRecibido} onChange={(e) => setMetodoRecibido(e.target.value as MetodoPago)}>
                      {METODOS_COD.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Cuenta de cobro</label>
                  <select className={inputCls} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                    <option value="">Seleccioná una cuenta…</option>
                    {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <div className="text-[11px] text-slate-400 mt-1">Si es la caja del courier, queda como saldo que él nos debe hasta la liquidación.</div>
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label className={labelCls}>Notas (opcional)</label>
          <textarea rows={2} className={inputCls} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>
    </FormModalV2>
  );
};

// ─── Reprogramar / marcar fallo (→ fallida | reprogramada) ──────────────────

export const ReprogramarFalloFModal: React.FC<FModalProps> = ({ envio, userId, onClose, onDone }) => {
  const toast = useToastStore();
  const [motivo, setMotivo] = useState<MotivoFallo>('ausente');
  const [descripcion, setDescripcion] = useState('');
  const [reprogramar, setReprogramar] = useState(true);
  const [nuevaFecha, setNuevaFecha] = useState(localDateStr(1));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!userId) { toast.error('Usuario no identificado'); return; }
    setLoading(true);
    try {
      await envioDespachoService.marcarEntregaFallida(
        envio.id,
        {
          motivoFallo: motivo,
          descripcionFallo: descripcion || undefined,
          reprogramar,
          nuevaFechaProgramada: reprogramar ? parseLocalDate(nuevaFecha) : undefined,
        },
        userId
      );
      toast.success(reprogramar ? `${envio.numeroEnvio} reprogramado` : `${envio.numeroEnvio} marcado como fallido`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar el fallo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModalV2
      isOpen
      onClose={onClose}
      onSubmit={handleSubmit}
      title={reprogramar ? 'Reprogramar entrega' : 'Marcar entrega fallida'}
      subtitle={`${envio.numeroEnvio} · ${envio.destinoClienteNombre ?? 'cliente'}`}
      icon={CalendarClock}
      iconTone="amber"
      color="orange"
      submitLabel={reprogramar ? 'Reprogramar' : 'Marcar fallida'}
      loading={loading}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Motivo</label>
          <select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoFallo)}>
            {MOTIVOS_FALLO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Detalle (opcional)</label>
          <textarea rows={2} className={inputCls} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={reprogramar} onChange={(e) => setReprogramar(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/40" />
          <span className="text-sm font-medium text-slate-700">Reprogramar para otro día (si no, se libera el stock)</span>
        </label>
        {reprogramar && (
          <div>
            <label className={labelCls}>Nueva fecha</label>
            <input type="date" className={inputCls} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
          </div>
        )}
        {!reprogramar && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Se anula el gasto de flete y las {envio.unidades?.length ?? 0} unidades vuelven a stock.
          </div>
        )}
      </div>
    </FormModalV2>
  );
};
