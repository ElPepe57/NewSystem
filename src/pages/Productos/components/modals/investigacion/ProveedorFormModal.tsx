/**
 * ProveedorFormModal · Sub-modal sobre InvestigacionCompletaModal · F6(A)
 *
 * Mockup canónico: docs/mockups/productos/37-modal-form-proveedor.html (v3)
 *
 * Permite agregar o editar un proveedor de la investigación, vinculándolo al
 * Gestor Maestro. Estructura final:
 *   [1] Proveedor vinculado al Gestor Maestro (autocomplete + sub-form crear)
 *   [2] Costos (Costo unitario USD + Tax con toggle inline %/$)
 *   [3] Detalles (URL del producto + Notas)
 *
 * Trigger: TabProveedores #25 botón "+ Agregar proveedor" o click en card existente.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  DollarSign,
  Edit2,
  Calculator,
  Link as LinkIcon,
  ArrowLeft,
  PlusCircle,
  Plus,
  Info,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { useProveedorStore } from '../../../../../store/proveedorStore';
import { useAuthStore } from '../../../../../store/authStore';
import { useToastStore } from '../../../../../store/toastStore';
import {
  EntidadMaestraAutocomplete,
  type EntidadMaestraItem,
} from './EntidadMaestraAutocomplete';
import type { ProveedorFormData, TipoProveedor } from '../../../../../types/ordenCompra.types';

export interface ProveedorInvestigacionFormValue {
  id: string;                      // ID en la lista de la investigación
  proveedorId?: string;            // Vínculo al Gestor Maestro
  proveedorNombre?: string;        // Snapshot para mostrar
  proveedorTipo?: string;          // Snapshot
  proveedorPais?: string;          // Snapshot
  proveedorMetricasOC?: number;    // Snapshot
  costoUnitarioUSD: number;
  taxValor: number;
  taxModo: '%' | '$';
  url?: string;
  notas?: string;
}

interface ProveedorFormModalProps {
  open: boolean;
  /** Valor inicial · null = crear nuevo · objeto = editar existente */
  valor: ProveedorInvestigacionFormValue | null;
  /** Producto contexto (para herencia de país, line negocio) */
  productoSku: string;
  productoNombre: string;
  productoPaisOrigen?: string;
  productoLineaNegocioId?: string;
  productoLineaNegocioNombre?: string;
  /** Modo: crear o editar */
  modo: 'crear' | 'editar';
  onClose: () => void;
  onGuardar: (valor: ProveedorInvestigacionFormValue) => Promise<void> | void;
  onEliminar?: () => void;
}

// Defaults sugeridos de tax por país
const TAX_POR_PAIS: Record<string, number> = {
  USA: 8.25,
  Perú: 18,
  Peru: 18,
  Corea: 0,
  China: 0,
  España: 21,
  Spain: 21,
  Colombia: 19,
  México: 16,
  Mexico: 16,
};

const TIPOS_PROVEEDOR: Array<{ value: TipoProveedor; label: string }> = [
  { value: 'distribuidor', label: 'Distribuidor' },
  { value: 'fabricante', label: 'Fabricante' },
  { value: 'mayorista', label: 'Mayorista' },
  { value: 'minorista', label: 'Minorista' },
];

const PAISES = ['USA', 'Corea', 'China', 'Perú', 'España', 'Otro'];

export function ProveedorFormModal({
  open,
  valor,
  productoSku,
  productoNombre,
  productoPaisOrigen,
  productoLineaNegocioId,
  productoLineaNegocioNombre,
  modo,
  onClose,
  onGuardar,
  onEliminar,
}: ProveedorFormModalProps) {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore();
  const { proveedoresActivos, loading, fetchProveedoresActivos, createProveedor } =
    useProveedorStore();

  // Estado del form
  const [proveedorId, setProveedorId] = useState<string | undefined>();
  const [proveedorSnap, setProveedorSnap] = useState<EntidadMaestraItem | undefined>();
  const [costoUnitarioUSD, setCostoUnitarioUSD] = useState(0);
  const [taxValor, setTaxValor] = useState(0);
  const [taxModo, setTaxModo] = useState<'%' | '$'>('%');
  const [url, setUrl] = useState('');
  const [notas, setNotas] = useState('');

  // Sub-form de creación rápida
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<TipoProveedor>('distribuidor');
  const [nuevoPais, setNuevoPais] = useState(productoPaisOrigen ?? 'USA');
  const [nuevoUrl, setNuevoUrl] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [creandoEnFirestore, setCreandoEnFirestore] = useState(false);
  // Loading state al guardar (espera al padre que persiste a Firestore + refresca)
  const [submitting, setSubmitting] = useState(false);

  // Cargar proveedores
  useEffect(() => {
    if (open) fetchProveedoresActivos();
  }, [open, fetchProveedoresActivos]);

  // Inicializar form al abrir/cambiar valor
  useEffect(() => {
    if (!open) {
      // Reset submitting cuando se cierra el modal · evita estado pegado al reabrir
      setSubmitting(false);
      return;
    }
    if (valor) {
      setProveedorId(valor.proveedorId);
      setProveedorSnap(
        valor.proveedorId
          ? {
              id: valor.proveedorId,
              nombre: valor.proveedorNombre ?? '',
              tipo: valor.proveedorTipo,
              pais: valor.proveedorPais,
              metricasOC: valor.proveedorMetricasOC,
            }
          : undefined,
      );
      setCostoUnitarioUSD(valor.costoUnitarioUSD);
      setTaxValor(valor.taxValor);
      setTaxModo(valor.taxModo);
      setUrl(valor.url ?? '');
      setNotas(valor.notas ?? '');
    } else {
      // Reset a vacío para crear
      setProveedorId(undefined);
      setProveedorSnap(undefined);
      setCostoUnitarioUSD(0);
      setTaxValor(productoPaisOrigen ? TAX_POR_PAIS[productoPaisOrigen] ?? 0 : 0);
      setTaxModo('%');
      setUrl('');
      setNotas('');
    }
    setCreandoNuevo(false);
  }, [open, valor, productoPaisOrigen]);

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
      proveedoresActivos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        tipo: p.tipo,
        pais: p.pais,
        metricasOC: (p.metricas as any)?.ordenesCompra,
      })),
    [proveedoresActivos],
  );

  // Cálculo total con tax
  const costoTotalConTax = useMemo(() => {
    if (taxModo === '%') {
      return costoUnitarioUSD + (costoUnitarioUSD * taxValor) / 100;
    }
    return costoUnitarioUSD + taxValor;
  }, [costoUnitarioUSD, taxValor, taxModo]);

  // Handlers
  const handleSelectExistente = (item: EntidadMaestraItem) => {
    setProveedorId(item.id);
    setProveedorSnap(item);
    // Sugerir tax por país si no hay valor todavía
    if (item.pais && taxValor === 0 && taxModo === '%') {
      const sugerido = TAX_POR_PAIS[item.pais];
      if (sugerido !== undefined) setTaxValor(sugerido);
    }
  };

  const handleAbrirCrearNuevo = (queryActual: string) => {
    setNuevoNombre(queryActual);
    setNuevoTipo('distribuidor');
    setNuevoPais(productoPaisOrigen ?? 'USA');
    setNuevoUrl('');
    setNuevoEmail('');
    setCreandoNuevo(true);
  };

  const handleConfirmarCreacionNueva = async () => {
    if (!user || !nuevoNombre.trim()) return;
    setCreandoEnFirestore(true);
    try {
      const data: ProveedorFormData = {
        nombre: nuevoNombre.trim(),
        tipo: nuevoTipo,
        pais: nuevoPais,
        url: nuevoUrl.trim() || '',
        email: nuevoEmail.trim() || undefined,
        lineaNegocioIds: productoLineaNegocioId ? [productoLineaNegocioId] : undefined,
      };
      const nuevoId = await createProveedor(data, user.uid);
      // Vincular automáticamente
      setProveedorId(nuevoId);
      setProveedorSnap({
        id: nuevoId,
        nombre: data.nombre,
        tipo: data.tipo,
        pais: data.pais,
        metricasOC: 0,
      });
      // Sugerir tax del país del nuevo
      const sugerido = TAX_POR_PAIS[nuevoPais];
      if (sugerido !== undefined && taxValor === 0 && taxModo === '%') {
        setTaxValor(sugerido);
      }
      setCreandoNuevo(false);
      toast.success(`Proveedor "${data.nombre}" creado y vinculado`);
    } catch (err: any) {
      toast.error(`Error al crear proveedor: ${err?.message ?? 'desconocido'}`);
    } finally {
      setCreandoEnFirestore(false);
    }
  };

  const handleGuardar = async () => {
    if (submitting) return; // protección doble click
    if (!proveedorId || !proveedorSnap) {
      toast.warning('Seleccioná o creá un proveedor antes de guardar');
      return;
    }
    if (costoUnitarioUSD <= 0) {
      toast.warning('Ingresá un costo unitario válido');
      return;
    }
    setSubmitting(true);
    try {
      await onGuardar({
        id: valor?.id ?? `prov-${Date.now()}`,
        proveedorId,
        proveedorNombre: proveedorSnap.nombre,
        proveedorTipo: proveedorSnap.tipo,
        proveedorPais: proveedorSnap.pais,
        proveedorMetricasOC: proveedorSnap.metricasOC,
        costoUnitarioUSD,
        taxValor,
        taxModo,
        url: url.trim() || undefined,
        notas: notas.trim() || undefined,
      });
      // Si el padre no cerró el modal en su success, lo dejamos abierto
      // (el padre cierra · este try termina y se resetea submitting al desmontar)
    } catch (err) {
      // El padre ya muestra toast.error · solo restauramos el botón
      setSubmitting(false);
    }
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
          <div className="bg-gradient-to-br from-teal-50 to-white border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setCreandoNuevo(false)}
                  className="p-1 hover:bg-teal-100 rounded text-teal-700 flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <PlusCircle className="w-[18px] h-[18px] text-teal-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900">
                    Nuevo proveedor en Gestor Maestro
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
              <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div className="text-[10px] text-teal-900">
                  Este proveedor se asignará automáticamente a la{' '}
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
                placeholder="ej: iHerb, Vital Proteins..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Tipo <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {TIPOS_PROVEEDOR.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setNuevoTipo(t.value)}
                      className={`px-2 py-1.5 text-[10px] font-bold rounded border transition-colors ${
                        nuevoTipo === t.value
                          ? 'bg-sky-100 text-sky-800 border-sky-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  País <span className="text-rose-500">*</span>
                </label>
                <select
                  value={nuevoPais}
                  onChange={(e) => setNuevoPais(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                >
                  {PAISES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  default = país del producto · editable según el caso
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  URL del sitio
                </label>
                <input
                  type="url"
                  value={nuevoUrl}
                  onChange={(e) => setNuevoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Email contacto
                </label>
                <input
                  type="email"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  placeholder="contacto@..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 italic flex items-center gap-1.5 pt-1">
              <Info className="w-3 h-3" />
              Podés completar contacto, dirección y otros datos después en el módulo Gestor Maestro.
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
              disabled={!nuevoNombre.trim() || creandoEnFirestore}
              className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
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
        <div className="bg-gradient-to-br from-teal-50 to-white border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                {modo === 'editar' ? (
                  <Edit2 className="w-4 h-4 text-teal-700" />
                ) : (
                  <DollarSign className="w-[18px] h-[18px] text-teal-700" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">
                  {modo === 'editar' ? 'Editar proveedor' : 'Agregar proveedor'}
                </h2>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="font-mono">{productoSku}</span>
                  <span>·</span>
                  <span className="truncate">{productoNombre}</span>
                  {productoPaisOrigen && (
                    <>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold">
                        {productoPaisOrigen}
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
              <span className="text-xs font-bold text-slate-700">Proveedor</span>
              <span className="text-[10px] text-slate-500 italic">
                vinculado al Gestor Maestro
              </span>
            </div>
            <EntidadMaestraAutocomplete
              tipo="proveedor"
              tema="teal"
              items={items}
              loading={loading}
              filtroPais={productoPaisOrigen}
              itemSeleccionadoId={proveedorId}
              itemSeleccionadoSnapshot={proveedorSnap}
              onSelect={handleSelectExistente}
              onSolicitarCrear={handleAbrirCrearNuevo}
              onDesvincular={() => {
                setProveedorId(undefined);
                setProveedorSnap(undefined);
              }}
            />
          </div>

          {/* SECCIÓN 2 · Costos */}
          <div className={proveedorId ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center gap-2 mb-2">
              <SectionNum>2</SectionNum>
              <span className="text-xs font-bold text-slate-700">Costos</span>
              {!proveedorId && (
                <span className="text-[10px] text-slate-500 italic">
                  se habilita al seleccionar proveedor
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Costo unitario <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoUnitarioUSD}
                    onChange={(e) => setCostoUnitarioUSD(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 tabular-nums"
                  />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">USD · sin tax</div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                  Impuesto / Tax
                </label>
                <div className="flex items-stretch border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-400 focus-within:border-teal-500">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxValor}
                    onChange={(e) => setTaxValor(parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-1.5 text-sm tabular-nums focus:outline-none border-0 min-w-0"
                  />
                  <div className="flex border-l border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTaxModo('%')}
                      className={`px-2.5 py-1 text-xs font-bold transition-colors ${
                        taxModo === '%' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxModo('$')}
                      className={`px-2.5 py-1 text-xs font-bold border-l border-slate-200 transition-colors ${
                        taxModo === '$' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  default sugerido por país · USA 8.25% · PE 18% · Corea 0%
                </div>
              </div>
            </div>
            <div className="text-[10px] text-teal-700 font-semibold mt-2 tabular-nums flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              Costo total con tax: <span className="font-bold">$ {costoTotalConTax.toFixed(2)}</span>
              <span className="text-slate-400 font-normal">
                ($ {costoUnitarioUSD.toFixed(2)} {taxModo === '%' ? `+ ${taxValor}%` : `+ $${taxValor.toFixed(2)}`})
              </span>
            </div>
          </div>

          {/* SECCIÓN 3 · Detalles */}
          <div className={proveedorId ? '' : 'opacity-50 pointer-events-none'}>
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
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono text-xs"
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
                  placeholder="Observaciones sobre este proveedor..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
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
              {!proveedorId && 'Selecciona o crea un proveedor para continuar'}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={!proveedorId || costoUnitarioUSD <= 0 || submitting}
              className="px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm min-w-[110px] justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {modo === 'editar' ? 'Guardar cambios' : 'Guardar'}
                </>
              )}
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
