/**
 * ProductoEditModal · Modal Editar Producto V2 · Fase D
 *
 * Mockup canónico: docs/mockups/productos/40-modal-editar-producto.html (v3)
 *
 * Implementa GAP-020 + GAP-060 (botón Editar no editaba · solo toast).
 *
 * Estructura · 4 secciones (sin Stock + Precio):
 *   [1] Origen        · read-only · línea + país (afectan referencias)
 *   [2] Básico        · marca · nombre comercial · presentación · contenido · UPC
 *   [3] Atributos     · condicional según línea (SKC vs SUP)
 *   [4] Clasificación · marca + tipo + categorías + etiquetas (placeholder · Fase E)
 *
 * Stock + Precio NO viven acá (decisión arquitectural confirmada por usuario):
 *   - Stock min/max → módulo Stock (sugerencias automáticas)
 *   - Precio venta → Investigación de mercado (re-investigar para ajustar)
 *   - CTRU/costo → derivado automático de compras
 *
 * Sistema de cambios:
 *   - Diff visual: border amber + dot pulsante en campos modificados
 *   - "Antes: [valor tachado]" + botón Revertir granular
 *   - Footer sticky con badge "X cambios sin guardar"
 *   - Modal de confirmación al guardar con resumen
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Edit2,
  Lock,
  Info,
  Package,
  DollarSign,
  Calculator,
  Search,
  History,
  Undo2,
  CheckCircle2,
  Check,
  ArrowLeft,
  ClipboardCheck,
  FlaskConical,
} from 'lucide-react';
import type { Producto, ProductoFormData } from '../../../../types/producto.types';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import { ProductoService } from '../../../../services/producto.service';
import { useProductoStore } from '../../../../store/productoStore';

interface ProductoEditModalProps {
  open: boolean;
  producto: Producto | null;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNombreLinea(p: Producto | null): string {
  if (!p) return '';
  return (p as any).lineaNegocioNombre ?? '—';
}

function esLineaSkincare(p: Producto | null): boolean {
  const l = getNombreLinea(p).toLowerCase();
  return l.includes('skin');
}

// ─── Componente principal ──────────────────────────────────────────────────

export const ProductoEditModal: React.FC<ProductoEditModalProps> = ({
  open,
  producto,
  onClose,
}) => {
  const toast = useToastStore();
  const user = useAuthStore(s => s.user);
  const { fetchProductos } = useProductoStore();

  // Estado del form · campos editables
  const [marca, setMarca] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [contenido, setContenido] = useState('');
  const [dosaje, setDosaje] = useState('');
  const [codigoUPC, setCodigoUPC] = useState('');
  // Atributos SKC (solo si línea = Skincare)
  const [ingredienteClave, setIngredienteClave] = useState('');
  const [lineaProducto, setLineaProducto] = useState('');

  // Modal confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pre-cargar valores del producto al abrir
  useEffect(() => {
    if (!open || !producto) return;
    setMarca(producto.marca ?? '');
    setNombreComercial((producto as any).nombreComercial ?? '');
    setContenido(producto.contenido ?? '');
    setDosaje(producto.dosaje ?? '');
    setCodigoUPC(producto.codigoUPC ?? '');
    setIngredienteClave((producto as any).atributosSkincare?.ingredienteClave ?? '');
    setLineaProducto((producto as any).atributosSkincare?.lineaProducto ?? '');
    setShowConfirm(false);
    setMotivoCambio('');
  }, [open, producto]);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirm) setShowConfirm(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, showConfirm]);

  // Detectar cambios respecto al producto original
  const cambios = useMemo(() => {
    if (!producto) return [];
    const list: { campo: string; antes: string; ahora: string; seccion: string }[] = [];
    if (marca !== (producto.marca ?? '')) {
      list.push({ campo: 'Marca', antes: producto.marca ?? '', ahora: marca, seccion: 'Básico' });
    }
    if (nombreComercial !== ((producto as any).nombreComercial ?? '')) {
      list.push({
        campo: 'Nombre comercial',
        antes: (producto as any).nombreComercial ?? '',
        ahora: nombreComercial,
        seccion: 'Básico',
      });
    }
    if (contenido !== (producto.contenido ?? '')) {
      list.push({ campo: 'Contenido', antes: producto.contenido ?? '', ahora: contenido, seccion: 'Básico' });
    }
    if (dosaje !== (producto.dosaje ?? '')) {
      list.push({ campo: 'Dosaje', antes: producto.dosaje ?? '', ahora: dosaje, seccion: 'Básico' });
    }
    if (codigoUPC !== (producto.codigoUPC ?? '')) {
      list.push({ campo: 'Código UPC', antes: producto.codigoUPC ?? '', ahora: codigoUPC, seccion: 'Básico' });
    }
    if (esLineaSkincare(producto)) {
      const ing0 = (producto as any).atributosSkincare?.ingredienteClave ?? '';
      if (ingredienteClave !== ing0) {
        list.push({
          campo: 'Ingrediente clave',
          antes: ing0,
          ahora: ingredienteClave,
          seccion: 'Atributos Skincare',
        });
      }
      const lin0 = (producto as any).atributosSkincare?.lineaProducto ?? '';
      if (lineaProducto !== lin0) {
        list.push({
          campo: 'Línea de marca',
          antes: lin0,
          ahora: lineaProducto,
          seccion: 'Atributos Skincare',
        });
      }
    }
    return list;
  }, [producto, marca, nombreComercial, contenido, dosaje, codigoUPC, ingredienteClave, lineaProducto]);

  const cantidadCambios = cambios.length;

  // Helpers de modificación
  const isMod = (campo: string) => cambios.some(c => c.campo === campo);

  const revertir = (campo: string) => {
    if (!producto) return;
    switch (campo) {
      case 'Marca':
        setMarca(producto.marca ?? '');
        break;
      case 'Nombre comercial':
        setNombreComercial((producto as any).nombreComercial ?? '');
        break;
      case 'Contenido':
        setContenido(producto.contenido ?? '');
        break;
      case 'Dosaje':
        setDosaje(producto.dosaje ?? '');
        break;
      case 'Código UPC':
        setCodigoUPC(producto.codigoUPC ?? '');
        break;
      case 'Ingrediente clave':
        setIngredienteClave((producto as any).atributosSkincare?.ingredienteClave ?? '');
        break;
      case 'Línea de marca':
        setLineaProducto((producto as any).atributosSkincare?.lineaProducto ?? '');
        break;
    }
  };

  const handleAbrirConfirmar = () => {
    if (cantidadCambios === 0) {
      toast.warning('No hay cambios para guardar');
      return;
    }
    setShowConfirm(true);
  };

  const handleGuardar = async () => {
    if (!producto || !user) return;
    setSubmitting(true);
    try {
      const data: Partial<ProductoFormData> = {
        marca,
        nombreComercial,
        contenido,
        dosaje,
        codigoUPC,
      };
      // Atributos Skincare si aplica
      if (esLineaSkincare(producto)) {
        const skc = { ...((producto as any).atributosSkincare ?? {}) };
        skc.ingredienteClave = ingredienteClave;
        skc.lineaProducto = lineaProducto;
        (data as any).atributosSkincare = skc;
      }
      await ProductoService.update(producto.id, data);
      toast.success(
        `${cantidadCambios} cambio${cantidadCambios === 1 ? '' : 's'} guardado${cantidadCambios === 1 ? '' : 's'} en "${nombreComercial}"`,
      );
      await fetchProductos();
      setShowConfirm(false);
      onClose();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err?.message ?? 'desconocido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDescartar = () => {
    if (cantidadCambios > 0) {
      const ok = window.confirm(`Descartar ${cantidadCambios} cambio${cantidadCambios === 1 ? '' : 's'} sin guardar?`);
      if (!ok) return;
    }
    onClose();
  };

  if (!open || !producto) return null;

  // ─── Vista B · Modal de confirmación ─────────────────────────────────────
  if (showConfirm) {
    const tieneImpacto = false; // por ahora ningún campo descriptivo tiene impacto · futuro: precio venta
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 py-6"
        onClick={() => setShowConfirm(false)}
      >
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gradient-to-br from-emerald-50 to-white border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Confirmar cambios</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {(producto as any).nombreComercial ?? 'Producto'} ·{' '}
                    <span className="font-mono">{producto.sku}</span>
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* RESUMEN DE CAMBIOS */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Resumen de cambios · {cantidadCambios}
                </span>
              </div>
              <div className="space-y-2">
                {cambios.map((c, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-slate-900">
                          {c.seccion} → {c.campo}
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <div className="text-slate-500 italic">Antes</div>
                            <div className="text-slate-700 line-through truncate">{c.antes || <span className="text-slate-400">vacío</span>}</div>
                          </div>
                          <div>
                            <div className="text-emerald-700 italic font-bold">Ahora</div>
                            <div className="text-slate-900 font-bold truncate">{c.ahora || <span className="text-slate-400">vacío</span>}</div>
                          </div>
                        </div>
                        <div className="mt-1.5 text-[9px] text-emerald-700 italic flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Sin impacto en otros módulos · es un atributo descriptivo
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AUDITORÍA */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center gap-1">
                <ClipboardCheck className="w-3 h-3" />
                Información que se registra en historial
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-700">
                <div>
                  👤 <strong>Usuario:</strong> {user?.email ?? 'sin sesión'}
                </div>
                <div>
                  📅 <strong>Fecha:</strong> {new Date().toLocaleString('es-PE')}
                </div>
                <div>
                  📝 <strong>Cambios:</strong> {cantidadCambios} campo{cantidadCambios === 1 ? '' : 's'}
                </div>
                <div>
                  ✅ <strong>Con impacto:</strong> ninguno · solo descriptivos
                </div>
              </div>
            </div>

            {/* MOTIVO opcional */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Motivo del cambio <span className="text-slate-400 lowercase normal-case">(opcional · queda en historial)</span>
              </label>
              <textarea
                rows={2}
                value={motivoCambio}
                onChange={e => setMotivoCambio(e.target.value)}
                placeholder="ej: actualización de fórmula del proveedor · corrección de tipeo..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver a editar
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDescartar}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={handleGuardar}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {submitting ? 'Guardando...' : 'Confirmar y guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista A · Form principal ─────────────────────────────────────────────
  const skincare = esLineaSkincare(producto);
  const ultimaEdicion = (producto as any).ultimaEdicion?.toDate?.()?.toLocaleDateString?.('es-PE');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={handleDescartar}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-teal-50 to-white border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Edit2 className="w-5 h-5 text-teal-700" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 mb-0.5">
                  {getNombreLinea(producto)} · Editar producto
                </div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span className="truncate">{(producto as any).nombreComercial ?? 'Producto'}</span>
                  {cantidadCambios > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {cantidadCambios} cambio{cantidadCambios === 1 ? '' : 's'} sin guardar
                    </span>
                  )}
                </h2>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  <span className="font-mono">{producto.sku}</span>
                  {ultimaEdicion && <> · última edición: {ultimaEdicion}</>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                title="Historial de cambios (próximamente)"
                onClick={() => toast.info('Drawer historial · próximamente')}
              >
                <History className="w-4 h-4" />
              </button>
              <button onClick={handleDescartar} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* BANNER · campos read-only + alcance del modal */}
        <div className="bg-purple-50 border-b border-purple-200 px-5 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
            <div className="text-[10px] text-purple-900 flex-1">
              <strong>Campos no editables:</strong> SKU, Línea de negocio y País de origen. Cambian referencias en OCs/Ventas/Stock — para modificarlos hay que duplicar el producto.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
            <div className="text-[10px] text-blue-900 flex-1">
              <strong>Stock min/max y precio venta NO se editan acá</strong> · viven en módulo Stock · Investigación de mercado
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Sección 1 · Origen READ-ONLY */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold inline-flex items-center justify-center">
                <Lock className="w-3 h-3" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Origen <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">READ-ONLY</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Línea: <strong>{getNombreLinea(producto)}</strong>
                  {(producto as any).paisOrigen && <> · País: <strong>{(producto as any).paisOrigen}</strong></>}
                </div>
              </div>
            </div>
          </div>

          {/* Sección 2 · Información Básica */}
          <SectionCard
            num={2}
            titulo="Información básica"
            modificada={isMod('Marca') || isMod('Nombre comercial') || isMod('Contenido') || isMod('Dosaje') || isMod('Código UPC')}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ModField label="Marca" required modificado={isMod('Marca')} antes={producto.marca ?? ''} onRevert={() => revertir('Marca')}>
                  <input
                    type="text"
                    value={marca}
                    onChange={e => setMarca(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      isMod('Marca')
                        ? 'border-2 border-amber-400 bg-amber-50/50'
                        : 'border border-slate-300'
                    }`}
                  />
                </ModField>
                <ModField label="Código UPC" modificado={isMod('Código UPC')} antes={producto.codigoUPC ?? ''} onRevert={() => revertir('Código UPC')}>
                  <input
                    type="text"
                    value={codigoUPC}
                    onChange={e => setCodigoUPC(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono ${
                      isMod('Código UPC')
                        ? 'border-2 border-amber-400 bg-amber-50/50'
                        : 'border border-slate-300'
                    }`}
                  />
                </ModField>
              </div>
              <ModField label="Nombre comercial" required modificado={isMod('Nombre comercial')} antes={(producto as any).nombreComercial ?? ''} onRevert={() => revertir('Nombre comercial')}>
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={e => setNombreComercial(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    isMod('Nombre comercial')
                      ? 'border-2 border-amber-400 bg-amber-50/50'
                      : 'border border-slate-300'
                  }`}
                />
              </ModField>
              <div className="grid grid-cols-2 gap-3">
                <ModField label="Contenido" modificado={isMod('Contenido')} antes={producto.contenido ?? ''} onRevert={() => revertir('Contenido')}>
                  <input
                    type="text"
                    value={contenido}
                    onChange={e => setContenido(e.target.value)}
                    placeholder="ej: 30 ml · 90 caps"
                    className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      isMod('Contenido')
                        ? 'border-2 border-amber-400 bg-amber-50/50'
                        : 'border border-slate-300'
                    }`}
                  />
                </ModField>
                <ModField label="Dosaje" modificado={isMod('Dosaje')} antes={producto.dosaje ?? ''} onRevert={() => revertir('Dosaje')}>
                  <input
                    type="text"
                    value={dosaje}
                    onChange={e => setDosaje(e.target.value)}
                    placeholder="ej: 5000 IU · 1000mg"
                    className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      isMod('Dosaje')
                        ? 'border-2 border-amber-400 bg-amber-50/50'
                        : 'border border-slate-300'
                    }`}
                  />
                </ModField>
              </div>
            </div>
          </SectionCard>

          {/* Sección 3 · Atributos Skincare (solo si línea SKC) */}
          {skincare && (
            <SectionCard
              num={3}
              titulo="Atributos Skincare"
              tema="amber"
              modificada={isMod('Ingrediente clave') || isMod('Línea de marca')}
              subtitulo="Vocabulario controlado · resto de atributos próximamente"
            >
              <div className="grid grid-cols-2 gap-3">
                <ModField label="Ingrediente clave" modificado={isMod('Ingrediente clave')} antes={(producto as any).atributosSkincare?.ingredienteClave ?? ''} onRevert={() => revertir('Ingrediente clave')}>
                  <input
                    type="text"
                    value={ingredienteClave}
                    onChange={e => setIngredienteClave(e.target.value)}
                    placeholder="ej: Vitamina C 15%"
                    className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      isMod('Ingrediente clave')
                        ? 'border-2 border-amber-400 bg-amber-50/50'
                        : 'border border-slate-300'
                    }`}
                  />
                </ModField>
                <ModField label="Línea de la marca" modificado={isMod('Línea de marca')} antes={(producto as any).atributosSkincare?.lineaProducto ?? ''} onRevert={() => revertir('Línea de marca')}>
                  <input
                    type="text"
                    value={lineaProducto}
                    onChange={e => setLineaProducto(e.target.value)}
                    placeholder="ej: C E Ferulic"
                    className={`w-full px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      isMod('Línea de marca')
                        ? 'border-2 border-amber-400 bg-amber-50/50'
                        : 'border border-slate-300'
                    }`}
                  />
                </ModField>
              </div>
              <div className="text-[10px] text-amber-700 italic mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Tipo SKC · Volumen · Tipo piel · Preocupaciones · Paso rutina · Textura · Zona aplicación · disponibles en Fase E
              </div>
            </SectionCard>
          )}

          {/* Sección 4 · Clasificación · placeholder Fase E */}
          <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold inline-flex items-center justify-center">
              {skincare ? '4' : '3'}
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-900">Clasificación</div>
              <div className="text-[10px] text-slate-500">
                Marca · Tipo · Categorías · Etiquetas · disponibles en Fase E (Wizards completos con maestros)
              </div>
            </div>
          </div>

          {/* CARD INFORMATIVA · Stock + Precio + CTRU viven en otros módulos */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Info className="w-4 h-4 text-blue-700" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-blue-900">Stock y precio viven en módulos operativos · NO en este editor</div>
                <div className="text-[10px] text-blue-800 mt-1">
                  Estos datos requieren información REAL (velocidad de venta, lead times, investigación de mercado) que no está disponible al editar atributos descriptivos.
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="rounded-lg bg-white border border-blue-200 px-2.5 py-2 text-left">
                    <div className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                      <Package className="w-2.5 h-2.5" />Stock min/max
                    </div>
                    <div className="text-[9px] text-blue-700 mt-0.5">→ módulo Stock</div>
                  </div>
                  <div className="rounded-lg bg-white border border-blue-200 px-2.5 py-2 text-left">
                    <div className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                      <Search className="w-2.5 h-2.5" />Precio venta
                    </div>
                    <div className="text-[9px] text-blue-700 mt-0.5">→ Investigación · re-investigar</div>
                  </div>
                  <div className="rounded-lg bg-white border border-blue-200 px-2.5 py-2 text-left">
                    <div className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                      <Calculator className="w-2.5 h-2.5" />CTRU / costo
                    </div>
                    <div className="text-[9px] text-blue-700 mt-0.5">→ derivado de compras</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          className={`border-t-2 px-5 py-3 flex items-center justify-between gap-3 ${
            cantidadCambios > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5 text-[11px]">
            {cantidadCambios > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-900">
                  <strong>
                    {cantidadCambios} cambio{cantidadCambios === 1 ? '' : 's'} sin guardar
                  </strong>{' '}
                  · {cambios.map(c => c.campo).join(' · ')}
                </span>
              </>
            ) : (
              <span className="text-slate-500 italic">Sin cambios pendientes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDescartar}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {cantidadCambios > 0 ? 'Descartar cambios' : 'Cerrar'}
            </button>
            <button
              type="button"
              onClick={handleAbrirConfirmar}
              disabled={cantidadCambios === 0}
              className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Revisar y guardar{cantidadCambios > 0 ? ` (${cantidadCambios})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes ────────────────────────────────────────────────────────

interface SectionCardProps {
  num: number;
  titulo: string;
  subtitulo?: string;
  tema?: 'teal' | 'amber';
  modificada?: boolean;
  children: React.ReactNode;
}

function SectionCard({ num, titulo, subtitulo, tema = 'teal', modificada, children }: SectionCardProps) {
  const borderClr = modificada
    ? 'border-2 border-amber-400'
    : tema === 'amber'
      ? 'border-2 border-amber-200'
      : 'border border-slate-200';
  const headerBg = modificada
    ? 'bg-amber-50'
    : tema === 'amber'
      ? 'bg-amber-50/40'
      : 'bg-slate-50';
  return (
    <div className={`${borderClr} rounded-xl overflow-hidden`}>
      <div className={`px-4 py-3 ${headerBg} flex items-center gap-2.5`}>
        <span
          className={`w-[18px] h-[18px] rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
            modificada
              ? 'bg-amber-500 text-white'
              : tema === 'amber'
                ? 'bg-amber-200 text-amber-900'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {num}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
            {titulo}
            {modificada && (
              <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-bold">
                modificada
              </span>
            )}
          </div>
          {subtitulo && <div className="text-[10px] text-slate-500 mt-0.5">{subtitulo}</div>}
        </div>
      </div>
      <div className="p-4 bg-white">{children}</div>
    </div>
  );
}

interface ModFieldProps {
  label: string;
  required?: boolean;
  modificado?: boolean;
  antes?: string;
  onRevert?: () => void;
  children: React.ReactNode;
}

function ModField({ label, required, modificado, antes, onRevert, children }: ModFieldProps) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {label}
          {required && <span className="text-rose-500">*</span>}
          {modificado && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[9px] text-amber-700 font-bold normal-case">MODIFICADO</span>
            </>
          )}
        </span>
      </label>
      {children}
      {modificado && (
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <Undo2 className="w-3 h-3 text-slate-400" />
          <span className="text-slate-500 italic">Antes:</span>
          <span className="text-slate-700 line-through truncate">{antes || 'vacío'}</span>
          {onRevert && (
            <button
              type="button"
              onClick={onRevert}
              className="ml-auto px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium"
            >
              ↻ Revertir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
