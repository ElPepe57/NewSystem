/**
 * CompetidorFormModal · Sub-modal sobre InvestigacionCompletaModal · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/38-modal-form-competidor.html (v3)
 *
 * Permite agregar o editar un competidor de la investigación, vinculándolo al
 * Gestor Maestro. Estructura final:
 *   [1] Competidor vinculado al Gestor Maestro (autocomplete + sub-form crear)
 *   [2] Plataforma (de las del competidor maestro) · Precio PEN
 *   [3] Detalles (URL del producto + Notas)
 *
 * Trigger: TabCompetencia #26 botón/input "Agregar competidor..." o click en fila.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Users as UsersIcon,
  Edit2,
  Link as LinkIcon,
  ArrowLeft,
  PlusCircle,
  Plus,
  Info,
  Trash2,
  Check,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useCompetidorStore } from '../../../../../store/competidorStore';
import { useAuthStore } from '../../../../../store/authStore';
import { useToastStore } from '../../../../../store/toastStore';
import {
  EntidadMaestraAutocomplete,
  type EntidadMaestraItem,
} from './EntidadMaestraAutocomplete';
import type {
  CompetidorFormData,
  PlataformaCompetidorData,
} from '../../../../../types/entidadesMaestras.types';

export interface CompetidorInvestigacionFormValue {
  id: string;                           // ID en la lista de la investigación
  competidorId?: string;                // Vínculo al Gestor Maestro
  competidorNombre?: string;
  competidorPais?: string;
  competidorPlataformas?: string[];     // ["Web propia", "Mercado Libre", ...]
  plataformaSeleccionada?: string;      // Cuál plataforma específica está usando esta fila
  precioPEN: number;
  url?: string;
  notas?: string;
}

interface CompetidorFormModalProps {
  open: boolean;
  /** Valor inicial · null = crear · objeto = editar */
  valor: CompetidorInvestigacionFormValue | null;
  productoSku: string;
  productoNombre: string;
  productoLineaNegocioId?: string;
  productoLineaNegocioNombre?: string;
  /** Tu precio actual (para mostrar variación %) */
  tuPrecioPEN?: number;
  modo: 'crear' | 'editar';
  onClose: () => void;
  onGuardar: (valor: CompetidorInvestigacionFormValue) => void;
  onEliminar?: () => void;
}

const PAISES = ['Perú', 'Chile', 'Colombia', 'México', 'USA', 'España', 'Otro'];

const PLATAFORMAS_PRESET: Array<{ id: string; nombre: string }> = [
  { id: 'web_propia', nombre: 'Web propia' },
  { id: 'mercado_libre', nombre: 'Mercado Libre' },
  { id: 'instagram', nombre: 'Instagram' },
  { id: 'inkafarma', nombre: 'Inkafarma' },
  { id: 'mifarma', nombre: 'MiFarma' },
  { id: 'falabella', nombre: 'Falabella' },
  { id: 'amazon', nombre: 'Amazon' },
];

export function CompetidorFormModal({
  open,
  valor,
  productoSku,
  productoNombre,
  productoLineaNegocioId,
  productoLineaNegocioNombre,
  tuPrecioPEN,
  modo,
  onClose,
  onGuardar,
  onEliminar,
}: CompetidorFormModalProps) {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore();
  const { competidoresActivos, fetchCompetidoresActivos, createCompetidor } =
    useCompetidorStore();

  // Estado del form principal
  const [competidorId, setCompetidorId] = useState<string | undefined>();
  const [competidorSnap, setCompetidorSnap] = useState<EntidadMaestraItem | undefined>();
  const [plataformaSeleccionada, setPlataformaSeleccionada] = useState<string>('');
  const [precioPEN, setPrecioPEN] = useState(0);
  const [url, setUrl] = useState('');
  const [notas, setNotas] = useState('');

  // Sub-form de creación rápida
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPais, setNuevoPais] = useState('Perú');
  const [nuevoUrl, setNuevoUrl] = useState('');
  const [nuevoPlataformasIds, setNuevoPlataformasIds] = useState<Set<string>>(new Set());
  const [nuevoPlataformaPrincipalId, setNuevoPlataformaPrincipalId] = useState<string>('');
  const [creandoEnFirestore, setCreandoEnFirestore] = useState(false);

  // Cargar competidores
  useEffect(() => {
    if (open) fetchCompetidoresActivos();
  }, [open, fetchCompetidoresActivos]);

  // Inicializar form al abrir
  useEffect(() => {
    if (!open) return;
    if (valor) {
      setCompetidorId(valor.competidorId);
      setCompetidorSnap(
        valor.competidorId
          ? {
              id: valor.competidorId,
              nombre: valor.competidorNombre ?? '',
              pais: valor.competidorPais,
              plataformasResumen: valor.competidorPlataformas,
            }
          : undefined,
      );
      setPlataformaSeleccionada(valor.plataformaSeleccionada ?? valor.competidorPlataformas?.[0] ?? '');
      setPrecioPEN(valor.precioPEN);
      setUrl(valor.url ?? '');
      setNotas(valor.notas ?? '');
    } else {
      setCompetidorId(undefined);
      setCompetidorSnap(undefined);
      setPlataformaSeleccionada('');
      setPrecioPEN(0);
      setUrl('');
      setNotas('');
    }
    setCreandoNuevo(false);
  }, [open, valor]);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (creandoNuevo) setCreandoNuevo(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, creandoNuevo]);

  // Items para el autocomplete
  const items = useMemo<EntidadMaestraItem[]>(
    () =>
      competidoresActivos.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        pais: (c as any).pais,
        plataformasResumen: (c.plataformasData ?? []).map((p) => p.nombre),
        plataformaPrincipal: (c.plataformasData ?? []).find((p) => p.esPrincipal)?.nombre,
      })),
    [competidoresActivos],
  );

  // Variación vs tu precio
  const variacionVsTuPrecio = useMemo(() => {
    if (!tuPrecioPEN || tuPrecioPEN <= 0 || precioPEN <= 0) return null;
    const pct = ((precioPEN - tuPrecioPEN) / tuPrecioPEN) * 100;
    return pct;
  }, [precioPEN, tuPrecioPEN]);

  // Handlers
  const handleSelectExistente = (item: EntidadMaestraItem) => {
    setCompetidorId(item.id);
    setCompetidorSnap(item);
    // Default: plataforma principal o primera
    const principal = item.plataformaPrincipal ?? item.plataformasResumen?.[0];
    if (principal) setPlataformaSeleccionada(principal);
  };

  const handleAbrirCrearNuevo = (queryActual: string) => {
    setNuevoNombre(queryActual);
    setNuevoPais('Perú');
    setNuevoUrl('');
    setNuevoPlataformasIds(new Set(['web_propia']));
    setNuevoPlataformaPrincipalId('web_propia');
    setCreandoNuevo(true);
  };

  const togglePlataformaNueva = (id: string) => {
    setNuevoPlataformasIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Si era la principal, limpiar
        if (id === nuevoPlataformaPrincipalId) {
          const remaining = Array.from(next);
          setNuevoPlataformaPrincipalId(remaining[0] ?? '');
        }
      } else {
        next.add(id);
        if (!nuevoPlataformaPrincipalId) setNuevoPlataformaPrincipalId(id);
      }
      return next;
    });
  };

  const handleConfirmarCreacionNueva = async () => {
    if (!user || !nuevoNombre.trim() || nuevoPlataformasIds.size === 0) return;
    setCreandoEnFirestore(true);
    try {
      const plataformasData: PlataformaCompetidorData[] = Array.from(nuevoPlataformasIds).map((id) => {
        const preset = PLATAFORMAS_PRESET.find((p) => p.id === id);
        return {
          id,
          nombre: preset?.nombre ?? id,
          esPrincipal: id === nuevoPlataformaPrincipalId,
          ...(id === nuevoPlataformaPrincipalId && nuevoUrl.trim() ? { url: nuevoUrl.trim() } : {}),
        };
      });
      const data: CompetidorFormData = {
        nombre: nuevoNombre.trim(),
        plataformasData,
        urlTienda: nuevoUrl.trim() || undefined,
        lineaNegocioIds: productoLineaNegocioId ? [productoLineaNegocioId] : undefined,
        // Heredados (default seguros)
        plataformaPrincipal: nuevoPlataformaPrincipalId as any,
        nivelAmenaza: 'medio',
        reputacion: 'desconocida',
      };
      // País fuera de CompetidorFormData formal: lo guardamos en notas como hint
      // (TODO: incluir país nativamente en CompetidorFormData)
      const nuevo = await createCompetidor(data, user.uid);
      const plataformasNombres = plataformasData.map((p) => p.nombre);
      const principal = plataformasData.find((p) => p.esPrincipal)?.nombre;

      setCompetidorId(nuevo.id);
      setCompetidorSnap({
        id: nuevo.id,
        codigo: nuevo.codigo,
        nombre: nuevo.nombre,
        pais: nuevoPais,
        plataformasResumen: plataformasNombres,
        plataformaPrincipal: principal,
      });
      if (principal) setPlataformaSeleccionada(principal);
      setCreandoNuevo(false);
      toast.success(`Competidor "${nuevo.nombre}" creado y vinculado`);
    } catch (err: any) {
      toast.error(`Error al crear competidor: ${err?.message ?? 'desconocido'}`);
    } finally {
      setCreandoEnFirestore(false);
    }
  };

  const handleGuardar = () => {
    if (!competidorId || !competidorSnap) {
      toast.warning('Seleccioná o creá un competidor antes de guardar');
      return;
    }
    if (!plataformaSeleccionada) {
      toast.warning('Elegí una plataforma');
      return;
    }
    if (precioPEN <= 0) {
      toast.warning('Ingresá un precio válido');
      return;
    }
    onGuardar({
      id: valor?.id ?? `comp-${Date.now()}`,
      competidorId,
      competidorNombre: competidorSnap.nombre,
      competidorPais: competidorSnap.pais,
      competidorPlataformas: competidorSnap.plataformasResumen,
      plataformaSeleccionada,
      precioPEN,
      url: url.trim() || undefined,
      notas: notas.trim() || undefined,
    });
  };

  if (!open) return null;

  // Vista B · Sub-form de creación rápida
  if (creandoNuevo) {
    return (
      <div
        className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 px-4 py-6"
        onClick={() => setCreandoNuevo(false)}
      >
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="bg-gradient-to-br from-amber-50 to-white border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setCreandoNuevo(false)}
                  className="p-1 hover:bg-amber-100 rounded text-amber-700 flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <PlusCircle className="w-[18px] h-[18px] text-amber-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900">
                    Nuevo competidor en Gestor Maestro
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Una vez creado quedará vinculado a esta investigación
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="p-5 space-y-3.5 overflow-y-auto">
            {productoLineaNegocioNombre && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[10px] text-amber-900">
                  Este competidor se asignará automáticamente a la{' '}
                  <strong>línea de negocio {productoLineaNegocioNombre}</strong> del producto
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Nombre <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="ej: Dermo Avanzada, DermoPlus..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  País <span className="text-rose-500">*</span>
                </label>
                <select
                  value={nuevoPais}
                  onChange={(e) => setNuevoPais(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  {PAISES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  útil para futura expansión a otros mercados
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  URL del sitio principal
                </label>
                <input
                  type="url"
                  value={nuevoUrl}
                  onChange={(e) => setNuevoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                Plataformas <span className="text-rose-500">*</span>
              </label>
              <div className="text-[9px] text-slate-500 mb-1.5">
                marcá todas las plataformas donde vende este competidor · click en una para hacerla
                principal
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLATAFORMAS_PRESET.map((p) => {
                  const activa = nuevoPlataformasIds.has(p.id);
                  const principal = nuevoPlataformaPrincipalId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (activa && !principal) {
                          // Si ya está activa y no es principal, hacerla principal
                          setNuevoPlataformaPrincipalId(p.id);
                        } else {
                          togglePlataformaNueva(p.id);
                        }
                      }}
                      className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border-2 transition-colors flex items-center gap-1.5 ${
                        principal
                          ? 'border-amber-400 bg-amber-100 text-amber-900'
                          : activa
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {activa ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {p.nombre}
                      {principal && (
                        <span className="px-1 py-0.5 rounded bg-amber-600 text-white text-[8px] font-bold">
                          PRINCIPAL
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 italic flex items-center gap-1.5 pt-1">
              <Info className="w-3 h-3" />
              Podés completar contacto, alias, redes sociales y más plataformas después en el módulo
              Gestor Maestro.
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreandoNuevo(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Volver al buscador
            </button>
            <button
              type="button"
              onClick={handleConfirmarCreacionNueva}
              disabled={
                !nuevoNombre.trim() || nuevoPlataformasIds.size === 0 || creandoEnFirestore
              }
              className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {creandoEnFirestore ? 'Creando...' : 'Crear y vincular'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vista A/C · Form principal
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-amber-50 to-white border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                {modo === 'editar' ? (
                  <Edit2 className="w-4 h-4 text-amber-700" />
                ) : (
                  <UsersIcon className="w-[18px] h-[18px] text-amber-700" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">
                  {modo === 'editar' ? 'Editar competidor' : 'Agregar competidor'}
                </h2>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="font-mono">{productoSku}</span>
                  <span>·</span>
                  <span className="truncate">{productoNombre}</span>
                  {tuPrecioPEN !== undefined && tuPrecioPEN > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-amber-700 font-semibold">
                        tu precio: S/ {tuPrecioPEN.toFixed(0)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* SECCIÓN 1 · Vínculo */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SectionNum>1</SectionNum>
              <span className="text-xs font-bold text-slate-700">Competidor</span>
              <span className="text-[10px] text-slate-500 italic">
                vinculado al Gestor Maestro
              </span>
            </div>
            <EntidadMaestraAutocomplete
              tipo="competidor"
              tema="amber"
              items={items}
              itemSeleccionadoId={competidorId}
              itemSeleccionadoSnapshot={competidorSnap}
              onSelect={handleSelectExistente}
              onSolicitarCrear={handleAbrirCrearNuevo}
              onDesvincular={() => {
                setCompetidorId(undefined);
                setCompetidorSnap(undefined);
                setPlataformaSeleccionada('');
              }}
            />
          </div>

          {/* SECCIÓN 2 · Plataforma + Precio */}
          <div className={competidorId ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center gap-2 mb-2">
              <SectionNum>2</SectionNum>
              <span className="text-xs font-bold text-slate-700">Plataforma · Precio</span>
              {!competidorId && (
                <span className="text-[10px] text-slate-500 italic">
                  se habilita al seleccionar competidor
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Plataforma <span className="text-rose-500">*</span>
                </label>
                <select
                  value={plataformaSeleccionada}
                  onChange={(e) => setPlataformaSeleccionada(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">Seleccionar...</option>
                  {(competidorSnap?.plataformasResumen ?? []).map((p) => {
                    const esPrincipal = p === competidorSnap?.plataformaPrincipal;
                    return (
                      <option key={p} value={p}>
                        {p}
                        {esPrincipal ? ' (Principal)' : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  cargado del competidor vinculado
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Precio <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    S/
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioPEN}
                    onChange={(e) => setPrecioPEN(parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 tabular-nums"
                  />
                </div>
                {variacionVsTuPrecio !== null && (
                  <div
                    className={`text-[9px] font-bold tabular-nums mt-0.5 flex items-center gap-1 ${
                      variacionVsTuPrecio < 0 ? 'text-emerald-600' : variacionVsTuPrecio > 0 ? 'text-rose-600' : 'text-slate-500'
                    }`}
                  >
                    {variacionVsTuPrecio < 0 ? (
                      <TrendingDown className="w-2.5 h-2.5" />
                    ) : variacionVsTuPrecio > 0 ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : null}
                    {variacionVsTuPrecio >= 0 ? '+' : ''}
                    {variacionVsTuPrecio.toFixed(1)}% vs tu precio (S/ {tuPrecioPEN!.toFixed(0)})
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN 3 · Detalles */}
          <div className={competidorId ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center gap-2 mb-2">
              <SectionNum>3</SectionNum>
              <span className="text-xs font-bold text-slate-700">Detalles</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  URL del producto
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones sobre este competidor..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 flex items-center justify-between gap-2">
          {modo === 'editar' && onEliminar ? (
            <button
              type="button"
              onClick={onEliminar}
              className="px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-50 rounded flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Eliminar de la investigación
            </button>
          ) : (
            <div className="text-[10px] text-slate-500 italic">
              {!competidorId && 'Selecciona o crea un competidor para continuar'}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={!competidorId || !plataformaSeleccionada || precioPEN <= 0}
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              {modo === 'editar' ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionNum({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[18px] h-[18px] rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold inline-flex items-center justify-center">
      {children}
    </span>
  );
}
