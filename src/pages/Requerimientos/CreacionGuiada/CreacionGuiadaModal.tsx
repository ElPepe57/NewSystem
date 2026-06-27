/**
 * CreacionGuiadaModal · F4+ · La creación guiada de requerimientos.
 *
 * Rediseña el "Nuevo requerimiento": de buscador en blanco → RECOMENDACIÓN PRIMERO · 4 modos.
 * Sigue siendo un FormModalV2 sobre Requerimientos (mobile = bottom-sheet · canon). El header
 * lleva el strip banking-grade (Valor · Margen · Impacto en caja + Prioridad), el body un
 * segmented selector de modo + la lista/buscador del modo activo, el footer el resumen + crear.
 *
 *   1. RESTOCK      · lista del motor de reorden (sugerenciasStock) · selección múltiple + Todo
 *   2. APUESTA      · candidatos investigados (candado cumplido) + tesis obligatoria
 *   3. MANUAL       · la búsqueda (único modo a mano · reusa el form original)
 *   4. COMPROMETIDA · cotizaciones con adelanto → demanda comprometida
 *
 * El subtipo es DERIVADO del modo (no se elige a mano). El sistema RECOMIENDA: las listas
 * primero, la búsqueda como fallback.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { ClipboardList, Check } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import type { ProductoRequerimientoSnapshot } from '../../../components/modules/entidades/ProductoSearchRequerimientos';
import { ModoSelector } from './ModoSelector';
import { StripBancarioModal } from './StripBancarioModal';
import { ModoRestock } from './ModoRestock';
import { ModoApuesta } from './ModoApuesta';
import { ModoManual } from './ModoManual';
import { ModoComprometida } from './ModoComprometida';
import {
  buildReqEfimero,
  computeStrip,
  seleccionarCandidatosApuesta,
  buildFormsRestock,
  buildFormApuesta,
  buildFormComprometida,
  type ModoCreacion,
} from './creacionGuiada.helper';
import type { SugerenciaStock, InvestigacionProducto } from '../requerimientos.types';
import type { Producto } from '../../../types/producto.types';
import type { Venta } from '../../../types/venta.types';
import type { Requerimiento, RequerimientoFormData, PrioridadRequerimiento } from '../../../types/requerimiento.types';

interface ProductoTemp {
  productoId: string;
  cantidadSolicitada: number;
  precioEstimadoUSD: number;
  precioVentaPEN: number;
  proveedorSugerido: string;
  urlReferencia: string;
}

export interface CreacionGuiadaModalProps {
  isOpen: boolean;
  onClose: () => void;

  /** Modo inicial al abrir (desde §C "Crear apuesta" abre en apuesta, etc.). */
  modoInicial?: ModoCreacion;

  // ── Fuentes de datos ──
  sugerenciasStock: SugerenciaStock[];
  loadingSugerencias: boolean;
  candidatosProductos: Producto[];
  requerimientos: Requerimiento[];
  cotizacionesConfirmadas: Venta[];
  cajaDisponiblePEN: number | null;
  tcDelDia: { venta: number; compra: number } | null;

  // ── Modo MANUAL · estado que vive en el padre (borrador/autosave) ──
  formData: Partial<RequerimientoFormData>;
  onFormDataChange: (data: Partial<RequerimientoFormData>) => void;
  productoSnapshot: ProductoRequerimientoSnapshot | null;
  onProductoSnapshotChange: (snapshot: ProductoRequerimientoSnapshot | null) => void;
  productoTemp: ProductoTemp;
  onProductoTempChange: (temp: ProductoTemp) => void;
  productos: Producto[];
  investigacionMercado: Map<string, InvestigacionProducto>;
  loadingInvestigacion: boolean;
  showHistorial: string | null;
  onShowHistorialChange: (id: string | null) => void;
  onAgregarProducto: () => void;
  onRemoverProducto: (index: number) => void;
  onAbrirCrearProducto: () => void;

  // ── Acciones ──
  isSubmitting: boolean;
  /** Crea el req del modo MANUAL desde el formData del padre (reusa el create existente). */
  onCrearManual: () => void;
  /** Crea uno o varios reqs desde forms ya armados (restock/apuesta/comprometida). */
  onCrearDesdeForms: (forms: RequerimientoFormData[]) => void;
  /** Guarda como borrador (modo manual). */
  onGuardarBorrador?: () => void;
  /** Abre la pantalla de investigación de producto (apuesta sin candidatos). */
  onInvestigar: () => void;
}

export const CreacionGuiadaModal: React.FC<CreacionGuiadaModalProps> = ({
  isOpen,
  onClose,
  modoInicial,
  sugerenciasStock,
  loadingSugerencias,
  candidatosProductos,
  requerimientos,
  cotizacionesConfirmadas,
  cajaDisponiblePEN,
  tcDelDia,
  formData,
  onFormDataChange,
  productoSnapshot,
  onProductoSnapshotChange,
  productoTemp,
  onProductoTempChange,
  productos,
  investigacionMercado,
  loadingInvestigacion,
  showHistorial,
  onShowHistorialChange,
  onAgregarProducto,
  onRemoverProducto,
  onAbrirCrearProducto,
  isSubmitting,
  onCrearManual,
  onCrearDesdeForms,
  onGuardarBorrador,
  onInvestigar,
}) => {
  const tcVenta = tcDelDia?.venta ?? 3.785;

  // ── Modo activo · default Restock (recomendación primero) ──
  const [modo, setModo] = useState<ModoCreacion>(modoInicial ?? 'restock');
  // Prioridad del strip (gobierna restock/apuesta/comprometida · manual usa formData.prioridad)
  const [prioridad, setPrioridad] = useState<PrioridadRequerimiento>('media');

  // ── Estado por modo ──
  const [restockSel, setRestockSel] = useState<Set<string>>(new Set());
  const [restockCant, setRestockCant] = useState<Record<string, number>>({});

  const [apuestaSelId, setApuestaSelId] = useState<string | null>(null);
  const [apuestaCant, setApuestaCant] = useState<number>(40);
  const [apuestaTesis, setApuestaTesis] = useState('');
  const [apuestaPrecio, setApuestaPrecio] = useState<number>(0);

  const [compSelId, setCompSelId] = useState<string | null>(null);

  // Reset al abrir/cerrar + aplicar modo inicial.
  useEffect(() => {
    if (isOpen) {
      setModo(modoInicial ?? 'restock');
      setPrioridad('media');
      setRestockSel(new Set());
      setRestockCant({});
      setApuestaSelId(null);
      setApuestaCant(40);
      setApuestaTesis('');
      setApuestaPrecio(0);
      setCompSelId(null);
    }
  }, [isOpen, modoInicial]);

  // ── Candidatos de apuesta (derivado · candado) ──
  const candidatos = useMemo(
    () => seleccionarCandidatosApuesta(candidatosProductos, requerimientos),
    [candidatosProductos, requerimientos],
  );
  const candidatoSel = candidatos.find((c) => c.producto.id === apuestaSelId) ?? null;

  // ── Strip banking-grade · derivado de la selección viva del modo ──
  const strip = useMemo(() => {
    let lineas: { precioEstimadoUSD?: number; precioVentaPEN?: number; cantidadSolicitada: number }[] = [];
    let precioVentaOverride: number | undefined;

    if (modo === 'restock') {
      lineas = sugerenciasStock
        .filter((s) => restockSel.has(s.producto.id))
        .map((s) => ({
          precioEstimadoUSD: s.precioEstimadoUSD,
          cantidadSolicitada: restockCant[s.producto.id] ?? s.cantidadSugerida ?? Math.max(s.stockMinimo - s.stockActual, 10),
        }));
    } else if (modo === 'apuesta' && candidatoSel) {
      const costoUSD = candidatoSel.proveedorMinUSD ?? candidatoSel.producto.investigacion?.precioUSAPromedio;
      lineas = [{ precioEstimadoUSD: costoUSD, precioVentaPEN: apuestaPrecio || undefined, cantidadSolicitada: apuestaCant }];
      precioVentaOverride = apuestaPrecio || undefined;
    } else if (modo === 'manual') {
      lineas = (formData.productos ?? []).map((p) => ({
        precioEstimadoUSD: p.precioEstimadoUSD,
        precioVentaPEN: p.precioVentaPEN,
        cantidadSolicitada: p.cantidadSolicitada,
      }));
      precioVentaOverride = formData.productos?.[0]?.precioVentaPEN || undefined;
    } else if (modo === 'comprometida') {
      const v = cotizacionesConfirmadas.find((c) => c.id === compSelId);
      // La comprometida no estima costo de compra (es venta) · strip de caja sobre el total de venta.
      lineas = v
        ? v.productos.map((p) => ({ precioVentaPEN: p.precioUnitario, cantidadSolicitada: p.cantidad }))
        : [];
    }

    const reqEfimero = buildReqEfimero(lineas, tcVenta);
    return computeStrip(reqEfimero, tcVenta, cajaDisponiblePEN, precioVentaOverride);
  }, [
    modo,
    sugerenciasStock,
    restockSel,
    restockCant,
    candidatoSel,
    apuestaCant,
    apuestaPrecio,
    formData.productos,
    cotizacionesConfirmadas,
    compSelId,
    tcVenta,
    cajaDisponiblePEN,
  ]);

  // ── Validación del submit por modo ──
  const { puedeCrear, resumenFooter, subtipoLabel } = useMemo(() => {
    switch (modo) {
      case 'restock': {
        const n = restockSel.size;
        return {
          puedeCrear: n > 0,
          subtipoLabel: <span className="text-sky-700 font-medium">restock (auto)</span>,
          resumenFooter: n > 0 ? `${n} producto${n !== 1 ? 's' : ''} · valor ` : 'Seleccioná al menos un producto',
        };
      }
      case 'apuesta': {
        const ok = !!candidatoSel && apuestaTesis.trim().length > 0 && apuestaCant > 0;
        return {
          puedeCrear: ok,
          subtipoLabel: <span className="text-indigo-700 font-medium">apuesta</span>,
          resumenFooter: !candidatoSel
            ? 'Seleccioná un candidato investigado'
            : apuestaTesis.trim().length === 0
              ? 'La tesis es obligatoria'
              : '1 apuesta · valor ',
        };
      }
      case 'manual': {
        const n = formData.productos?.length ?? 0;
        return {
          puedeCrear: n > 0,
          subtipoLabel: <span className="text-slate-600 font-medium">manual</span>,
          resumenFooter: n > 0 ? `${n} producto${n !== 1 ? 's' : ''} · valor ` : 'Agregá al menos un producto',
        };
      }
      case 'comprometida':
      default: {
        const ok = !!compSelId;
        return {
          puedeCrear: ok,
          subtipoLabel: <span className="text-emerald-700 font-medium">demanda comprometida</span>,
          resumenFooter: ok ? 'Cotización seleccionada · valor ' : 'Seleccioná una cotización',
        };
      }
    }
  }, [modo, restockSel, candidatoSel, apuestaTesis, apuestaCant, formData.productos, compSelId]);

  // ── Submit ──
  const handleSubmit = () => {
    if (!puedeCrear || isSubmitting) return;
    if (modo === 'manual') {
      onCrearManual();
      return;
    }
    if (modo === 'restock') {
      const sugs = sugerenciasStock.filter((s) => restockSel.has(s.producto.id));
      const forms = buildFormsRestock(sugs, restockCant).map((f) => ({ ...f, prioridad }));
      onCrearDesdeForms(forms);
      return;
    }
    if (modo === 'apuesta' && candidatoSel) {
      const form = buildFormApuesta(candidatoSel, apuestaCant, apuestaTesis, apuestaPrecio || undefined, prioridad);
      onCrearDesdeForms([form]);
      return;
    }
    if (modo === 'comprometida') {
      const v = cotizacionesConfirmadas.find((c) => c.id === compSelId);
      if (v) onCrearDesdeForms([buildFormComprometida(v)]);
      return;
    }
  };

  // Prioridad efectiva · en Manual la fuente es formData (lo consume handleCrearRequerimiento);
  // en los demás modos es el estado local `prioridad` (lo aplica handleSubmit a los forms).
  const prioridadEfectiva: PrioridadRequerimiento =
    modo === 'manual' ? (formData.prioridad ?? 'media') : prioridad;
  const setPrioridadEfectiva = (p: PrioridadRequerimiento) => {
    if (modo === 'manual') onFormDataChange({ ...formData, prioridad: p });
    else setPrioridad(p);
  };

  const valorHint = modo === 'apuesta' ? 'investigacion' : 'no_landed';
  const submitLabel = modo === 'apuesta' ? 'Crear apuesta' : 'Crear requerimiento';
  const subtituloModo =
    modo === 'restock'
      ? 'modo Restock'
      : modo === 'apuesta'
        ? 'Apuesta · producto nuevo sin cliente'
        : modo === 'manual'
          ? 'Manual · tu lectura del mercado'
          : 'Comprometida · cliente que ya se comprometió';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Nuevo requerimiento"
      subtitle={`${tcDelDia ? `TC del día: S/ ${tcDelDia.venta.toFixed(3)} · ` : ''}${subtituloModo}`}
      icon={ClipboardList}
      iconTone="blue"
      size="xl"
      submitLabel={submitLabel}
      submitIcon={Check}
      submitVariant="primary"
      loading={isSubmitting}
      disabled={!puedeCrear}
      footerExtras={
        <span className="text-[12px] text-slate-500">
          {resumenFooter}
          {puedeCrear && (
            <>
              <b className="text-amber-700 tabular-nums">$ {strip.valorUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</b>{' '}
              <span className="text-slate-400">(costo de producto · no landed)</span> · subtipo {subtipoLabel}
            </>
          )}
        </span>
      }
    >
      <div className="space-y-1">
        {/* Strip banking-grade · 3 KPIs + prioridad */}
        <StripBancarioModal strip={strip} prioridad={prioridadEfectiva} onPrioridadChange={setPrioridadEfectiva} valorHint={valorHint} />

        {/* Segmented selector de modo */}
        <div className="pt-3">
          <ModoSelector modo={modo} onChange={setModo} />
        </div>

        {/* Body del modo activo */}
        {modo === 'restock' && (
          <ModoRestock
            sugerencias={sugerenciasStock}
            loading={loadingSugerencias}
            seleccion={restockSel}
            onToggle={(id) =>
              setRestockSel((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onToggleTodo={() =>
              setRestockSel((prev) =>
                prev.size === sugerenciasStock.length ? new Set() : new Set(sugerenciasStock.map((s) => s.producto.id)),
              )
            }
            cantidades={restockCant}
            onCantidadChange={(id, cantidad) => setRestockCant((prev) => ({ ...prev, [id]: cantidad }))}
          />
        )}

        {modo === 'apuesta' && (
          <ModoApuesta
            candidatos={candidatos}
            seleccionId={apuestaSelId}
            onSelect={(id) => setApuestaSelId(id || null)}
            cantidad={apuestaCant}
            onCantidadChange={setApuestaCant}
            tesis={apuestaTesis}
            onTesisChange={setApuestaTesis}
            precioVentaPEN={apuestaPrecio}
            onPrecioVentaChange={setApuestaPrecio}
            onInvestigar={onInvestigar}
          />
        )}

        {modo === 'manual' && (
          <ModoManual
            formData={formData}
            onFormDataChange={onFormDataChange}
            productoSnapshot={productoSnapshot}
            onProductoSnapshotChange={onProductoSnapshotChange}
            productoTemp={productoTemp}
            onProductoTempChange={onProductoTempChange}
            productos={productos}
            investigacionMercado={investigacionMercado}
            loadingInvestigacion={loadingInvestigacion}
            showHistorial={showHistorial}
            onShowHistorialChange={onShowHistorialChange}
            tcDelDia={tcDelDia}
            onAgregarProducto={onAgregarProducto}
            onRemoverProducto={onRemoverProducto}
            onAbrirCrearProducto={onAbrirCrearProducto}
          />
        )}

        {modo === 'comprometida' && (
          <ModoComprometida cotizaciones={cotizacionesConfirmadas} seleccionId={compSelId} onSelect={(id) => setCompSelId(id || null)} />
        )}

        {/* Guardar borrador (canon de formularios) · solo en modos con captura propia */}
        {(modo === 'manual' || modo === 'apuesta') && onGuardarBorrador && (
          <div className="pt-2 flex justify-start">
            <button type="button" onClick={onGuardarBorrador} className="text-[12px] font-medium text-slate-600 hover:text-slate-800 px-1 py-1">
              Guardar borrador
            </button>
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

export default CreacionGuiadaModal;
