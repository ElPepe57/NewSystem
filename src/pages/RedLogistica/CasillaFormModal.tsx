/**
 * CasillaFormModal — Crear/editar casilla de un colaborador
 */
import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, Check } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useAlmacenStore } from '../../store/casillaStore';
import { useAuthStore } from '../../store/authStore';
import { casillaCrudService } from '../../services/casilla.crud.service';
import type { Casilla, TipoCasilla, PaisCasilla, CasillaFormData } from '../../types/casilla.types';
import { useToastStore } from '../../store/toastStore';
import {
  useGeocoder,
  MapProvider,
  MapContainer,
  MarkersLayer,
  COUNTRY_COLORS,
  type MapPoint,
} from '../../design-system/maps';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  casilla: Casilla | null;
  colaboradorId: string;
}

const TIPOS: { value: TipoCasilla; label: string }[] = [
  { value: 'casilla_viajero', label: 'Casilla de viajero' },
  { value: 'almacen_propio', label: 'Almacen propio' },
  { value: 'punto_courier', label: 'Punto courier' },
  { value: 'ubicacion_proveedor', label: 'Ubicacion proveedor' },
];

const PAISES: { value: PaisCasilla; label: string }[] = [
  { value: 'USA', label: 'USA' },
  { value: 'Peru', label: 'Peru' },
  { value: 'China', label: 'China' },
  { value: 'Corea', label: 'Corea' },
  { value: 'Peru_local', label: 'Peru (local)' },
];

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export const CasillaFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, casilla, colaboradorId }) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);

  const { geocode, isGeocoding } = useGeocoder();
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);

  const [form, setForm] = useState({
    nombre: '',
    tipo: 'casilla_viajero' as TipoCasilla,
    estado: 'activa' as 'activa' | 'inactiva',
    pais: 'USA' as PaisCasilla,
    direccion: '',
    ciudad: '',
    codigoPostal: '',
    capacidadUnidades: '',
    esPrincipal: false,
    notas: '',
  });

  useEffect(() => {
    if (casilla) {
      setForm({
        nombre: casilla.nombre || '',
        tipo: casilla.tipo,
        estado: casilla.estado,
        pais: casilla.pais,
        direccion: casilla.direccion || '',
        ciudad: casilla.ciudad || '',
        codigoPostal: casilla.codigoPostal || '',
        capacidadUnidades: casilla.capacidadUnidades?.toString() || '',
        esPrincipal: casilla.esPrincipal || false,
        notas: casilla.notas || '',
      });
      setCoordenadas(casilla.coordenadas ?? null);
    } else {
      setForm({
        nombre: '', tipo: 'casilla_viajero', estado: 'activa', pais: 'USA',
        direccion: '', ciudad: '', codigoPostal: '', capacidadUnidades: '',
        esPrincipal: false, notas: '',
      });
      setCoordenadas(null);
    }
  }, [casilla, isOpen]);

  // S42d — Geocoding on-blur de dirección: cuando el usuario termina de
  // escribir la dirección, consultamos Google y guardamos coordenadas.
  const handleGeocode = async () => {
    const dir = form.direccion.trim();
    if (!dir) return;
    // Construir query con ciudad + país para precisión
    const paisLabel = form.pais === 'Peru_local' ? 'Peru' : form.pais;
    const query = [dir, form.ciudad.trim(), paisLabel].filter(Boolean).join(', ');
    const result = await geocode(query);
    if (result) {
      setCoordenadas(result.coordenadas);
      toast.success('Dirección geolocalizada');
    } else {
      toast.warning('No se pudo geolocalizar la dirección');
    }
  };

  const handleSubmit = async () => {
    if (!user || !form.nombre.trim()) return;
    setLoading(true);
    try {
      // S42c fix — omitir campos vacíos (Firestore rechaza undefined en updateDoc)
      const data: CasillaFormData = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        estado: form.estado,
        pais: form.pais,
        colaboradorId,
        esPrincipal: form.esPrincipal,
      } as CasillaFormData;
      if (form.direccion.trim()) data.direccion = form.direccion.trim();
      if (form.ciudad.trim()) data.ciudad = form.ciudad.trim();
      if (form.codigoPostal.trim()) data.codigoPostal = form.codigoPostal.trim();
      if (form.capacidadUnidades) data.capacidadUnidades = parseInt(form.capacidadUnidades);
      if (form.notas.trim()) data.notas = form.notas.trim();
      if (coordenadas) data.coordenadas = coordenadas;

      if (casilla) {
        await casillaCrudService.actualizar(casilla.id, data, user.uid);
        toast.success('Casilla actualizada');
      } else {
        await casillaCrudService.crear(data, user.uid);
        toast.success('Casilla creada');
      }
      onSaved();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={casilla ? 'Editar Casilla' : 'Nueva Casilla'} size="lg">
      <div className="space-y-4">
        {/* Tipo, estado, principal */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoCasilla })} className={inputCls}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as any })} className={inputCls}>
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Pais</label>
            <select value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value as PaisCasilla })} className={inputCls}>
              {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className={labelCls}>Nombre de la casilla</label>
          <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputCls} placeholder="Ej: Casa California, Almacen Lima" />
        </div>

        {/* Ubicacion */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Direccion</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={form.direccion}
                onChange={e => { setForm({ ...form, direccion: e.target.value }); setCoordenadas(null); }}
                onBlur={handleGeocode}
                className={inputCls}
                placeholder="123 Main St"
              />
              <button
                type="button"
                onClick={handleGeocode}
                disabled={isGeocoding || !form.direccion.trim()}
                className="flex-shrink-0 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 hover:text-teal-700 transition-colors"
                title="Geolocalizar dirección"
              >
                {isGeocoding
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : coordenadas
                    ? <Check className="w-4 h-4 text-emerald-600" />
                    : <MapPin className="w-4 h-4" />}
              </button>
            </div>
            {coordenadas && (
              <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Coordenadas: {coordenadas.lat.toFixed(4)}, {coordenadas.lng.toFixed(4)}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Ciudad</label>
            <input
              type="text"
              value={form.ciudad}
              onChange={e => { setForm({ ...form, ciudad: e.target.value }); setCoordenadas(null); }}
              onBlur={handleGeocode}
              className={inputCls}
              placeholder="Miami"
            />
          </div>
        </div>

        {/* S42e — Mini-mapa preview: feedback visual de la geocodificación */}
        {coordenadas && (
          <div>
            <label className={labelCls}>Ubicación en mapa</label>
            <div className="h-[200px] rounded-lg overflow-hidden border border-slate-200">
              <MapProvider>
                <MapContainer
                  center={coordenadas}
                  zoom={15}
                  autoFit={false}
                  minHeight="200px"
                  cleanStyles
                >
                  <MarkersLayer<{ nombre: string; pais: string }>
                    points={[{
                      id: 'preview',
                      coordenadas,
                      nombre: form.nombre || 'Casilla',
                      metadata: { nombre: form.nombre, pais: form.pais },
                    } as MapPoint<{ nombre: string; pais: string }>]}
                    colorBy={() => COUNTRY_COLORS[form.pais === 'Peru_local' ? 'Peru' : form.pais] ?? '#14B8A6'}
                    scaleBy={() => 10}
                  />
                </MapContainer>
              </MapProvider>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Si la ubicación es incorrecta, edita la dirección o ciudad y se recalculará automáticamente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Codigo postal</label>
            <input type="text" value={form.codigoPostal} onChange={e => setForm({ ...form, codigoPostal: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Capacidad (unidades)</label>
            <input type="number" value={form.capacidadUnidades} onChange={e => setForm({ ...form, capacidadUnidades: e.target.value })} className={inputCls} placeholder="200" />
          </div>
        </div>

        {/* Principal toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.esPrincipal}
            onChange={e => setForm({ ...form, esPrincipal: e.target.checked })}
            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
          />
          <span className="text-sm text-slate-700">Casilla principal de este colaborador</span>
        </label>

        {/* Notas */}
        <div>
          <label className={labelCls}>Notas</label>
          <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className={inputCls} rows={2} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!form.nombre.trim()}>
            {casilla ? 'Guardar cambios' : 'Crear casilla'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
