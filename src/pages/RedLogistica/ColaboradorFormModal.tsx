/**
 * ColaboradorFormModal — Crear/editar colaborador de la red logistica
 */
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import type { Colaborador, TipoColaborador, ColaboradorFormData, SubtipoTransportistaLocal, TramoPeso } from '../../types/colaborador.types';
import { TramosPesoSection, validarTramos } from './shared/TramosPesoSection';

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

  // S42l — Form solo con datos de contacto estándar (sin secciones de configuración por tipo)
  // Se mantiene `subtipoTransportista` porque el listado en /red-logistica separa
  // "Internos — Partners" vs "Externos — Terceros" usando este campo.
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
    subtipoTransportista: 'interno' as SubtipoTransportistaLocal,
  });

  // S52 · D-11 — Tramos de peso escalonados (solo viajero/courier_externo)
  const [tramosPeso, setTramosPeso] = useState<TramoPeso[]>([]);

  useEffect(() => {
    if (colaborador) {
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
        subtipoTransportista: colaborador.subtipoTransportista || 'interno',
      });
      setTramosPeso(colaborador.tarifas?.tarifaPorTramos || []);
    } else {
      setForm({
        nombre: '',
        tipo: tipoPreseleccionado || 'viajero',
        estado: 'activo',
        pais: tipoPreseleccionado === 'transportista_local' ? 'Peru' : 'USA',
        ciudad: '', direccion: '', telefono: '', email: '', whatsapp: '', notas: '',
        subtipoTransportista: subtipoPreseleccionado || 'interno',
      });
      setTramosPeso([]);
    }
  }, [colaborador, isOpen, tipoPreseleccionado, subtipoPreseleccionado]);

  const handleSubmit = async () => {
    if (!user || !form.nombre.trim()) return;

    // S52 · D-11 — Validar tramos si se ingresaron
    const aplicaTramos = form.tipo === 'viajero' || form.tipo === 'courier_externo';
    if (aplicaTramos && tramosPeso.length > 0) {
      const erroresTramos = validarTramos(tramosPeso);
      if (erroresTramos.length > 0) {
        toast.error(
          'Los tramos de peso tienen errores: ' + erroresTramos[0],
          'Validación'
        );
        return;
      }
    }

    setLoading(true);
    try {
      // S42c fix — omitir campos vacíos en lugar de enviarlos como `undefined`
      // (Firestore rechaza undefined en updateDoc). Solo se incluyen keys con valor.
      const data: ColaboradorFormData = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        estado: form.estado,
        pais: form.pais,
      } as any;
      if (form.ciudad.trim()) (data as any).ciudad = form.ciudad.trim();
      if (form.direccion.trim()) (data as any).direccion = form.direccion.trim();
      if (form.telefono.trim()) (data as any).telefono = form.telefono.trim();
      if (form.email.trim()) (data as any).email = form.email.trim();
      if (form.whatsapp.trim()) (data as any).whatsapp = form.whatsapp.trim();
      if (form.notas.trim()) (data as any).notas = form.notas.trim();

      // Construir tarifas según el tipo
      // S42l — Ya no se construyen tarifas ni campos detallados.
      // Solo se preserva subtipoTransportista (requerido para separar Internos/Externos en el listado).
      if (form.tipo === 'transportista_local') {
        (data as any).subtipoTransportista = form.subtipoTransportista;
      }

      // S52 · D-11 — Persistir tramos de peso solo si aplica (viajero/courier_externo)
      // y hay tramos válidos. La validación bloquea el submit más arriba.
      if (
        (form.tipo === 'viajero' || form.tipo === 'courier_externo') &&
        tramosPeso.length > 0
      ) {
        (data as any).tarifas = { tarifaPorTramos: tramosPeso };
      }

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

  // S42g — Titulo "Colaborador · [subtipo]" para mostrar el concepto paraguas
  // sin perder el rol especifico (empresa/viajero/courier/transportista).
  const tituloPorTipo: Record<TipoColaborador, string> = {
    empresa: 'Almacén propio',
    viajero: 'Viajero',
    courier_externo: 'Courier internacional',
    transportista_local: 'Transportista local',
  };
  const tituloModal = colaborador
    ? `Editar Colaborador · ${tituloPorTipo[colaborador.tipo]}`
    : `Nuevo Colaborador · ${tituloPorTipo[form.tipo]}`;

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

        {/* S42l — Subtipo solo para transportista local (distingue Internos vs Externos en listado) */}
        {form.tipo === 'transportista_local' && (
          <div>
            <label className={labelCls}>Subtipo</label>
            <select
              value={form.subtipoTransportista}
              onChange={e => setForm({ ...form, subtipoTransportista: e.target.value as SubtipoTransportistaLocal })}
              className={inputCls}
              disabled={!!subtipoPreseleccionado && !colaborador}
            >
              <option value="interno">Interno · Partner estratégico</option>
              <option value="externo">Externo · Servicio tercero</option>
            </select>
          </div>
        )}

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

        {/* S42l — Secciones "Configuración" específicas por tipo eliminadas:
             - Viajero (S42j): frecuencia + tarifa por libra
             - Courier internacional: tarifa base + tarifa por kg
             - Transportista local: subtipo + DNI + licencia + costo fijo + comisión + zona
             Ningún campo era consumido en cálculos del negocio (flete, pagos,
             reportes). El colaborador queda con solo datos de contacto estándar
             independientemente del tipo. Si en el futuro aparece un caso de uso
             real para cualquiera, los campos siguen en el modelo @deprecated. */}

        {/* S52 · D-11 — Tramos de peso para tarifa escalonada (viajero/courier) */}
        {(form.tipo === 'viajero' || form.tipo === 'courier_externo') && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <span>⚖️</span> Tarifa por tramos de peso
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-wider">
                    Opcional
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acuerdo escalonado en libras. El wizard de envíos auto-carga esta
                  tabla al elegirte como transportador.
                </p>
              </div>
            </div>
            <TramosPesoSection
              value={tramosPeso}
              onChange={setTramosPeso}
              showValidation
            />
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
