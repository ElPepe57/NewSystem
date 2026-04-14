/**
 * ColaboradorFormModal — Crear/editar colaborador de la red logistica
 */
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import type { Colaborador, TipoColaborador, ColaboradorFormData, SubtipoTransportistaLocal, CourierExterno } from '../../types/colaborador.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  colaborador: Colaborador | null;
  /** Tipo preseleccionado cuando se crea desde un boton de seccion */
  tipoPreseleccionado?: TipoColaborador;
  /** Subtipo preseleccionado (solo para transportista_local) */
  subtipoPreseleccionado?: SubtipoTransportistaLocal;
}

const TIPOS: { value: TipoColaborador; label: string }[] = [
  { value: 'empresa', label: 'Empresa (almacén propio)' },
  { value: 'viajero', label: 'Viajero' },
  { value: 'courier_externo', label: 'Courier internacional' },
  { value: 'transportista_local', label: 'Transportista local' },
];

const COURIERS: { value: CourierExterno; label: string }[] = [
  { value: 'olva', label: 'Olva Courier' },
  { value: 'mercado_envios', label: 'Mercado Envíos' },
  { value: 'urbano', label: 'Urbano' },
  { value: 'shalom', label: 'Shalom' },
  { value: 'otro', label: 'Otro' },
];

const PAISES = ['USA', 'Peru', 'China', 'Corea'];

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export const ColaboradorFormModal: React.FC<Props> = ({
  isOpen, onClose, onSaved, colaborador, tipoPreseleccionado, subtipoPreseleccionado,
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { crearColaborador, actualizarColaborador } = useColaboradorStore();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    tipo: 'viajero' as TipoColaborador,
    estado: 'activo' as 'activo' | 'inactivo' | 'suspendido',
    pais: 'USA',
    ciudad: '',
    direccion: '',
    telefono: '',
    email: '',
    whatsapp: '',
    notas: '',
    // Viajero
    frecuenciaViaje: '' as string,
    tarifaPorLibraUSD: '',
    // Courier externo internacional
    tarifaBasePorEnvioUSD: '',
    tarifaPorKgUSD: '',
    // Transportista local
    subtipoTransportista: 'interno' as SubtipoTransportistaLocal,
    courierExterno: 'otro' as CourierExterno,
    costoFijo: '',
    comisionPorcentaje: '',
    dni: '',
    licencia: '',
    zonaCobertura: '',
  });

  useEffect(() => {
    if (colaborador) {
      // Modo edicion
      setForm({
        nombre: colaborador.nombre || '',
        tipo: colaborador.tipo,
        estado: colaborador.estado,
        pais: colaborador.pais || 'USA',
        ciudad: colaborador.ciudad || '',
        direccion: colaborador.direccion || '',
        telefono: colaborador.telefono || '',
        email: colaborador.email || '',
        whatsapp: colaborador.whatsapp || '',
        notas: colaborador.notas || '',
        frecuenciaViaje: colaborador.frecuenciaViaje || '',
        tarifaPorLibraUSD: colaborador.tarifas?.tarifaPorLibraUSD?.toString() || '',
        tarifaBasePorEnvioUSD: colaborador.tarifas?.tarifaBasePorEnvioUSD?.toString() || '',
        tarifaPorKgUSD: colaborador.tarifas?.tarifaPorKgUSD?.toString() || '',
        subtipoTransportista: colaborador.subtipoTransportista || 'interno',
        courierExterno: colaborador.courierExterno || 'otro',
        costoFijo: colaborador.tarifas?.costoFijo?.toString() || '',
        comisionPorcentaje: colaborador.tarifas?.comisionPorcentaje?.toString() || '',
        dni: colaborador.dni || '',
        licencia: colaborador.licencia || '',
        zonaCobertura: colaborador.tarifas?.zonaCobertura || '',
      });
    } else {
      // Modo crear: usar preselecciones si llegaron
      setForm({
        nombre: '',
        tipo: tipoPreseleccionado || 'viajero',
        estado: 'activo',
        pais: tipoPreseleccionado === 'transportista_local' ? 'Peru' : 'USA',
        ciudad: '', direccion: '', telefono: '', email: '', whatsapp: '', notas: '',
        frecuenciaViaje: '', tarifaPorLibraUSD: '',
        tarifaBasePorEnvioUSD: '', tarifaPorKgUSD: '',
        subtipoTransportista: subtipoPreseleccionado || 'interno',
        courierExterno: 'otro',
        costoFijo: '', comisionPorcentaje: '', dni: '', licencia: '', zonaCobertura: '',
      });
    }
  }, [colaborador, isOpen, tipoPreseleccionado, subtipoPreseleccionado]);

  const handleSubmit = async () => {
    if (!user || !form.nombre.trim()) return;
    setLoading(true);
    try {
      const data: ColaboradorFormData = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        estado: form.estado,
        pais: form.pais,
        ciudad: form.ciudad || undefined,
        direccion: form.direccion || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        whatsapp: form.whatsapp || undefined,
        notas: form.notas || undefined,
      } as any;

      // Construir tarifas según el tipo
      const tarifas: Record<string, number | string> = {};
      if (form.tipo === 'viajero') {
        if (form.frecuenciaViaje) (data as any).frecuenciaViaje = form.frecuenciaViaje;
        if (form.tarifaPorLibraUSD) tarifas.tarifaPorLibraUSD = parseFloat(form.tarifaPorLibraUSD);
      } else if (form.tipo === 'courier_externo') {
        if (form.tarifaBasePorEnvioUSD) tarifas.tarifaBasePorEnvioUSD = parseFloat(form.tarifaBasePorEnvioUSD);
        if (form.tarifaPorKgUSD) tarifas.tarifaPorKgUSD = parseFloat(form.tarifaPorKgUSD);
      } else if (form.tipo === 'transportista_local') {
        (data as any).subtipoTransportista = form.subtipoTransportista;
        if (form.subtipoTransportista === 'externo') {
          (data as any).courierExterno = form.courierExterno;
        }
        if (form.subtipoTransportista === 'interno') {
          if (form.dni) (data as any).dni = form.dni;
          if (form.licencia) (data as any).licencia = form.licencia;
        }
        if (form.costoFijo) tarifas.costoFijo = parseFloat(form.costoFijo);
        if (form.comisionPorcentaje) tarifas.comisionPorcentaje = parseFloat(form.comisionPorcentaje);
        if (form.zonaCobertura) tarifas.zonaCobertura = form.zonaCobertura;
      }
      if (Object.keys(tarifas).length > 0) (data as any).tarifas = tarifas;

      if (colaborador) {
        await actualizarColaborador(colaborador.id, data, user.uid);
        toast.success('Colaborador actualizado');
      } else {
        await crearColaborador(data, user.uid);
        toast.success('Colaborador creado');
      }
      onSaved();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Titulo contextual
  const tituloPorTipo: Record<TipoColaborador, string> = {
    empresa: 'Almacén propio',
    viajero: 'Viajero',
    courier_externo: 'Courier internacional',
    transportista_local: 'Transportista local',
  };
  const tituloModal = colaborador
    ? `Editar ${tituloPorTipo[colaborador.tipo]}`
    : `Nuevo ${tituloPorTipo[form.tipo]}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tituloModal} size="lg">
      <div className="space-y-4">
        {/* Tipo y estado — si hay preseleccion, tipo queda bloqueado */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value as TipoColaborador })}
              className={inputCls}
              disabled={!!tipoPreseleccionado && !colaborador}
            >
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as any })} className={inputCls}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className={labelCls}>Nombre</label>
          <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputCls} placeholder="Ej: Angie Price" />
        </div>

        {/* Ubicacion */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>País</label>
            <select value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })} className={inputCls}>
              {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ciudad</label>
            <input type="text" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} className={inputCls} placeholder="Lima" />
          </div>
          <div>
            <label className={labelCls}>Dirección</label>
            <input type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} className={inputCls} />
          </div>
        </div>

        {/* Contacto */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Teléfono</label>
            <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp</label>
            <input type="text" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} />
          </div>
        </div>

        {/* ── Campos específicos por tipo ── */}

        {/* Viajero */}
        {form.tipo === 'viajero' && (
          <div className="p-3 bg-teal-50/50 rounded-lg border border-teal-100 space-y-3">
            <div className="text-xs font-medium text-teal-700">Configuración de viajero</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Frecuencia de viaje</label>
                <select value={form.frecuenciaViaje} onChange={e => setForm({ ...form, frecuenciaViaje: e.target.value })} className={inputCls}>
                  <option value="">Sin definir</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                  <option value="bimestral">Bimestral</option>
                  <option value="variable">Variable</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Tarifa por libra (USD)</label>
                <input type="number" step="0.01" value={form.tarifaPorLibraUSD} onChange={e => setForm({ ...form, tarifaPorLibraUSD: e.target.value })} className={inputCls} placeholder="5.00" />
              </div>
            </div>
          </div>
        )}

        {/* Courier internacional */}
        {form.tipo === 'courier_externo' && (
          <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100 space-y-3">
            <div className="text-xs font-medium text-amber-700">Configuración de courier internacional</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tarifa base por envío (USD)</label>
                <input type="number" step="0.01" value={form.tarifaBasePorEnvioUSD} onChange={e => setForm({ ...form, tarifaBasePorEnvioUSD: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tarifa por kg (USD)</label>
                <input type="number" step="0.01" value={form.tarifaPorKgUSD} onChange={e => setForm({ ...form, tarifaPorKgUSD: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Transportista local */}
        {form.tipo === 'transportista_local' && (
          <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-100 space-y-3">
            <div className="text-xs font-medium text-sky-700">Configuración de transportista local</div>

            {/* Subtipo interno/externo */}
            <div>
              <label className={labelCls}>¿Es interno o externo?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, subtipoTransportista: 'interno' })}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    form.subtipoTransportista === 'interno'
                      ? 'bg-sky-100 border-sky-400 text-sky-800 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  disabled={!!subtipoPreseleccionado && !colaborador}
                >
                  Interno · Partner estratégico
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, subtipoTransportista: 'externo' })}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    form.subtipoTransportista === 'externo'
                      ? 'bg-sky-100 border-sky-400 text-sky-800 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  disabled={!!subtipoPreseleccionado && !colaborador}
                >
                  Externo · Servicio tercero
                </button>
              </div>
            </div>

            {/* Si externo: selector de courier */}
            {form.subtipoTransportista === 'externo' && (
              <div>
                <label className={labelCls}>Courier / Empresa</label>
                <select value={form.courierExterno} onChange={e => setForm({ ...form, courierExterno: e.target.value as CourierExterno })} className={inputCls}>
                  {COURIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}

            {/* Si interno: DNI y licencia */}
            {form.subtipoTransportista === 'interno' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>DNI</label>
                  <input type="text" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Licencia</label>
                  <input type="text" value={form.licencia} onChange={e => setForm({ ...form, licencia: e.target.value })} className={inputCls} />
                </div>
              </div>
            )}

            {/* Costos */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Costo fijo (S/)</label>
                <input type="number" step="0.01" value={form.costoFijo} onChange={e => setForm({ ...form, costoFijo: e.target.value })} className={inputCls} placeholder="15.00" />
              </div>
              <div>
                <label className={labelCls}>Comisión (%)</label>
                <input type="number" step="0.01" value={form.comisionPorcentaje} onChange={e => setForm({ ...form, comisionPorcentaje: e.target.value })} className={inputCls} placeholder="5" />
              </div>
              <div>
                <label className={labelCls}>Zona de cobertura</label>
                <input type="text" value={form.zonaCobertura} onChange={e => setForm({ ...form, zonaCobertura: e.target.value })} className={inputCls} placeholder="Lima Norte" />
              </div>
            </div>
          </div>
        )}

        {/* Notas */}
        <div>
          <label className={labelCls}>Notas</label>
          <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className={inputCls} rows={2} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!form.nombre.trim()}>
            {colaborador ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
