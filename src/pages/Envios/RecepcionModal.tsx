import React, { useState, useMemo } from "react";
import {
  CheckCircle,
  Minus,
  Plus,
  ChevronRight,
  ChevronDown,
  ScanLine,
  X as XIcon,
  Calendar,
  Trash2,
  ShieldAlert,
  PackageCheck,
} from "lucide-react";
import { FormModalV2 } from "../../design-system";
import { BarcodeScanner } from "../../components/common/BarcodeScanner";
import type { Envio, RecepcionEnvioFormData } from "../../types/envio.types";
import type { Producto } from "../../types/producto.types";
import { getDescripcionProducto } from "../../utils/producto.helpers";

interface RecepcionModalProps {
  transferencia: Envio;
  productosMap: Map<string, Producto>;
  onClose: () => void;
  /**
   * S40: onConfirm puede recibir opcionalmente los gastos de liberación aduanera pagados
   * en esta recepción. Si vienen, el caller debe crear el CostoLanded correspondiente.
   */
  onConfirm: (
    data: RecepcionEnvioFormData,
    extras?: { gastosAduanaPEN?: number; gastosAduanaDescripcion?: string }
  ) => Promise<void>;
}

/**
 * S40 — ¿El envío cruza frontera hacia Perú? Determina si aplica el flujo de aduana.
 * - Envío con destino Perú Y origen fuera de Perú → cruza frontera
 * - Envío interna_origen (no va a Perú) → no aplica aduana
 */
function envioCruzaFronteraPeru(envio: Envio): boolean {
  if (envio.destinoCasillaPais !== 'Peru') return false;
  if (envio.origenTipo === 'proveedor') {
    return (envio.origenProveedorPais || 'USA') !== 'Peru';
  }
  return (envio.origenCasillaPais || 'USA') !== 'Peru';
}

// ---- Helpers ----
const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const currentYear = new Date().getFullYear();
const ANIOS = Array.from({ length: 6 }, (_, i) => currentYear + i);

/** Último día del mes (ej: mes=3, anio=2027 → 31) */
function ultimoDiaMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate();
}

/** Convierte mes/año a YYYY-MM-DD (último día del mes) */
function mesAnioToDateStr(mes: number, anio: number): string {
  const dia = ultimoDiaMes(mes, anio);
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Calcula días hasta vencimiento desde mes/año */
function diasHastaVencimiento(mes: number, anio: number): number {
  const fecha = new Date(anio, mes - 1, ultimoDiaMes(mes, anio));
  return Math.ceil((fecha.getTime() - Date.now()) / 86400000);
}

// ---- Grupo de vencimiento para la UI ----
interface LoteInput {
  mes: number;   // 1-12
  anio: number;
  cantidad: number;
}

export const RecepcionModal: React.FC<RecepcionModalProps> = ({
  transferencia,
  productosMap,
  onClose,
  onConfirm,
}) => {
  const unidadesPendientes = (transferencia.unidades ?? []).filter(
    u => u.estadoEnvio === 'enviada' || u.estadoEnvio === 'faltante'
      || u.estadoEnvio === 'pendiente' || u.estadoEnvio === 'preparada'
      || u.estadoEnvio === 'retenida'
  );
  const recepcionNumero = (transferencia.recepciones?.length ?? 0) + 1;

  // S40: ¿Aplica aduana en este envío?
  const cruzaFronteraPeru = useMemo(() => envioCruzaFronteraPeru(transferencia), [transferencia]);
  // Hay unidades previamente retenidas que podrían liberarse en esta recepción
  const tienePreviasRetenidas = useMemo(
    () => (transferencia.unidades ?? []).some(u => u.estadoEnvio === 'retenida'),
    [transferencia]
  );

  const productosAgrupados = useMemo(() => {
    const map = new Map<string, typeof unidadesPendientes>();
    for (const u of unidadesPendientes) {
      const arr = map.get(u.productoId) || [];
      arr.push(u);
      map.set(u.productoId, arr);
    }
    return [...map.entries()].map(([productoId, unids]) => {
      const pSummary = transferencia.productosSummary.find(p => p.productoId === productoId);
      const totalEnvio = pSummary?.cantidad || unids.length;
      const yaRecibido = (transferencia.unidades ?? []).filter(u => u.productoId === productoId && u.estadoEnvio === 'recibida').length;
      const costoFleteUnit = unids[0].costoFleteUSD || 0;
      const costoFleteTotal = unids.reduce((s, u) => s + (u.costoFleteUSD || 0), 0);
      return {
        productoId,
        nombreFallback: pSummary?.nombre || unids[0].sku,
        sku: unids[0].sku,
        costoFleteUnit,
        costoFleteTotal,
        unidades: unids,
        totalEnvio,
        yaRecibido,
        pendiente: unids.length
      };
    });
  }, [transferencia, unidadesPendientes]);

  // ---- Estado: cantidad a recibir por producto ----
  const [cantidadRecibir, setCantidadRecibir] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    return init;
  });

  // S39: contadores de dañadas, perdidas y retenidas por producto
  const [cantidadDanada, setCantidadDanada] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    return init;
  });
  const [cantidadPerdida, setCantidadPerdida] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    return init;
  });
  const [cantidadRetenida, setCantidadRetenida] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    productosAgrupados.forEach(p => { init[p.productoId] = 0; });
    return init;
  });

  // ---- Estado: lotes por producto (multi-lote con mes/año) ----
  const [lotesPorProducto, setLotesPorProducto] = useState<Record<string, LoteInput[]>>(() => {
    const init: Record<string, LoteInput[]> = {};
    const mesActual = new Date().getMonth() + 1;
    productosAgrupados.forEach(p => {
      init[p.productoId] = [{
        mes: mesActual,
        anio: currentYear + 1,
        cantidad: 0
      }];
    });
    return init;
  });

  const [observaciones, setObservaciones] = useState('');
  const [costoRecojoPEN, setCostoRecojoPEN] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showRecepcionScanner, setShowRecepcionScanner] = useState(false);
  const [productosExpandidos, setProductosExpandidos] = useState<Set<string>>(new Set());

  // S40: Gastos de liberación aduanera pagados en esta recepción (opcional)
  const [gastosAduanaPEN, setGastosAduanaPEN] = useState<string>('');
  const [descripcionGastosAduana, setDescripcionGastosAduana] = useState<string>('');

  const totalARecibir = Object.values(cantidadRecibir).reduce((s, v) => s + v, 0);
  const totalDanadas = Object.values(cantidadDanada).reduce((s, v) => s + v, 0);
  const totalPerdidas = Object.values(cantidadPerdida).reduce((s, v) => s + v, 0);
  // S40: si no cruza frontera, las retenidas son 0 aunque estén en el estado (defensa)
  const totalRetenidas = cruzaFronteraPeru
    ? Object.values(cantidadRetenida).reduce((s, v) => s + v, 0)
    : 0;
  const totalProcesadas = totalARecibir + totalDanadas + totalPerdidas + totalRetenidas;
  const totalPendiente = unidadesPendientes.length;

  // S40: ¿Mostrar bloque de gastos de liberación aduanera?
  const mostrarBloqueAduana = cruzaFronteraPeru && (totalRetenidas > 0 || tienePreviasRetenidas);

  // Validar: cada producto con cantidad > 0 debe tener lotes que sumen = cantidad
  const productosConErrorLotes = productosAgrupados.filter(p => {
    const cant = cantidadRecibir[p.productoId] || 0;
    if (cant === 0) return false;
    const lotes = lotesPorProducto[p.productoId] || [];
    const sumaLotes = lotes.reduce((s, l) => s + l.cantidad, 0);
    return sumaLotes !== cant || lotes.some(l => !l.mes || !l.anio);
  });
  const hayErrorLotes = productosConErrorLotes.length > 0;

  // ---- Handlers ----
  const handleRecibirTodo = (checked: boolean) => {
    const next: Record<string, number> = {};
    productosAgrupados.forEach(p => {
      next[p.productoId] = checked ? p.pendiente : 0;
    });
    setCantidadRecibir(next);

    // Auto-asignar cantidad al primer lote
    if (checked) {
      setLotesPorProducto(prev => {
        const updated = { ...prev };
        productosAgrupados.forEach(p => {
          const lotes = updated[p.productoId] || [];
          if (lotes.length > 0) {
            const sumaOtros = lotes.slice(1).reduce((s, l) => s + l.cantidad, 0);
            updated[p.productoId] = [
              { ...lotes[0], cantidad: p.pendiente - sumaOtros },
              ...lotes.slice(1)
            ];
          }
        });
        return updated;
      });
    }
  };

  const toggleExpandirProductoRecepcion = (productoId: string) => {
    setProductosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

  const handleRecepcionBarcodeScan = (barcode: string) => {
    const prod = productosAgrupados.find(p => {
      const pFull = productosMap.get(p.productoId);
      return p.sku === barcode || (pFull as any)?.codigoBarras === barcode || (pFull as any)?.upc === barcode || (pFull as any)?.codigoUPC === barcode;
    });
    if (prod) {
      const current = cantidadRecibir[prod.productoId] || 0;
      if (current < prod.pendiente) {
        const newCant = current + 1;
        setCantidadRecibir(prev => ({ ...prev, [prod.productoId]: newCant }));
        // Auto-asignar al primer lote
        setLotesPorProducto(prev => {
          const lotes = prev[prod.productoId] || [];
          if (lotes.length > 0) {
            const sumaOtros = lotes.slice(1).reduce((s, l) => s + l.cantidad, 0);
            return {
              ...prev,
              [prod.productoId]: [
                { ...lotes[0], cantidad: newCant - sumaOtros },
                ...lotes.slice(1)
              ]
            };
          }
          return prev;
        });
      }
    }
  };

  const handleCantidadChange = (productoId: string, nuevaCant: number) => {
    setCantidadRecibir(prev => ({ ...prev, [productoId]: nuevaCant }));
    // Ajustar primer lote
    setLotesPorProducto(prev => {
      const lotes = prev[productoId] || [];
      if (lotes.length > 0) {
        const sumaOtros = lotes.slice(1).reduce((s, l) => s + l.cantidad, 0);
        return {
          ...prev,
          [productoId]: [
            { ...lotes[0], cantidad: Math.max(0, nuevaCant - sumaOtros) },
            ...lotes.slice(1)
          ]
        };
      }
      return prev;
    });
  };

  const handleAgregarLote = (productoId: string) => {
    setLotesPorProducto(prev => ({
      ...prev,
      [productoId]: [
        ...(prev[productoId] || []),
        { mes: new Date().getMonth() + 1, anio: currentYear + 1, cantidad: 0 }
      ]
    }));
  };

  const handleEliminarLote = (productoId: string, idx: number) => {
    setLotesPorProducto(prev => {
      const lotes = [...(prev[productoId] || [])];
      const removed = lotes.splice(idx, 1)[0];
      // Re-asignar cantidad del lote eliminado al primero
      if (lotes.length > 0) {
        lotes[0] = { ...lotes[0], cantidad: lotes[0].cantidad + removed.cantidad };
      }
      return { ...prev, [productoId]: lotes };
    });
  };

  const handleLoteFieldChange = (productoId: string, idx: number, field: keyof LoteInput, value: number | string) => {
    setLotesPorProducto(prev => {
      const lotes = [...(prev[productoId] || [])];
      lotes[idx] = { ...lotes[idx], [field]: value };
      return { ...prev, [productoId]: lotes };
    });
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    if (totalProcesadas === 0) return;
    setSubmitting(true);
    try {
      const unidadesRecibidas: RecepcionEnvioFormData['unidadesRecibidas'] = [];
      const fechasVencimiento: Record<string, string> = {};

      for (const prod of productosAgrupados) {
        const cantRec = cantidadRecibir[prod.productoId] || 0;
        const cantDan = cantidadDanada[prod.productoId] || 0;
        const cantPer = cantidadPerdida[prod.productoId] || 0;
        const cantRet = cantidadRetenida[prod.productoId] || 0;
        const lotes = lotesPorProducto[prod.productoId] || [];

        // S39: Asignar unidades en orden: recibidas → dañadas → perdidas → retenidas → faltantes
        let unidadIdx = 0;

        // 1. Recibidas OK (con lotes de vencimiento)
        for (const lote of lotes) {
          for (let i = 0; i < lote.cantidad && unidadIdx < cantRec; i++) {
            const u = prod.unidades[unidadIdx];
            unidadesRecibidas.push({ unidadId: u.unidadId, recibida: true, danada: false });
            fechasVencimiento[u.unidadId] = mesAnioToDateStr(lote.mes, lote.anio);
            unidadIdx++;
          }
        }

        // 2. Dañadas (llegaron pero con daño — recibida=true, danada=true)
        for (let i = 0; i < cantDan && unidadIdx < prod.unidades.length; i++) {
          unidadesRecibidas.push({
            unidadId: prod.unidades[unidadIdx].unidadId,
            recibida: true,
            danada: true,
            incidencia: 'Unidad recibida con daño físico'
          });
          unidadIdx++;
        }

        // 3. Perdidas (no llegaron y se dan por perdidas)
        for (let i = 0; i < cantPer && unidadIdx < prod.unidades.length; i++) {
          unidadesRecibidas.push({
            unidadId: prod.unidades[unidadIdx].unidadId,
            recibida: false,
            danada: false,
            perdida: true,
            incidencia: 'Unidad perdida en tránsito'
          });
          unidadIdx++;
        }

        // 4. Retenidas en aduana (pendientes de liberación)
        for (let i = 0; i < cantRet && unidadIdx < prod.unidades.length; i++) {
          unidadesRecibidas.push({
            unidadId: prod.unidades[unidadIdx].unidadId,
            recibida: false,
            danada: false,
            incidencia: 'Retenida en aduana — pendiente de liberación'
          });
          unidadIdx++;
        }

        // 5. Resto = faltantes (pueden llegar después)
        for (; unidadIdx < prod.unidades.length; unidadIdx++) {
          unidadesRecibidas.push({
            unidadId: prod.unidades[unidadIdx].unidadId,
            recibida: false,
            danada: false
          });
        }
      }

      // S40: Parse gastos aduana si el bloque está visible
      const gastosAduanaParsed = mostrarBloqueAduana && gastosAduanaPEN
        ? parseFloat(gastosAduanaPEN.replace(',', '.'))
        : undefined;
      const extras = gastosAduanaParsed && gastosAduanaParsed > 0
        ? {
            gastosAduanaPEN: gastosAduanaParsed,
            gastosAduanaDescripcion: descripcionGastosAduana || undefined,
          }
        : undefined;

      await onConfirm({
        envioId: transferencia.id,
        unidadesRecibidas,
        fechasVencimiento: Object.keys(fechasVencimiento).length > 0 ? fechasVencimiento : undefined,
        costoRecojoPEN: costoRecojoPEN ? parseFloat(costoRecojoPEN) : undefined,
        observaciones
      }, extras);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Submit label dinámico ----
  const submitLabel = hayErrorLotes
    ? `Asignar vencimientos (${productosConErrorLotes.length})`
    : [
        `Registrar #${recepcionNumero}`,
        totalARecibir > 0 && `${totalARecibir} OK`,
        totalDanadas > 0 && `${totalDanadas} dañ.`,
        totalPerdidas > 0 && `${totalPerdidas} perd.`,
        totalRetenidas > 0 && `${totalRetenidas} aduana`,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <FormModalV2
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Registrar recepción"
      subtitle={`${transferencia.numeroEnvio} · ${totalPendiente} uds esperadas`}
      icon={PackageCheck}
      iconTone="orange"
      color="orange"
      size="lg"
      submitLabel={submitLabel}
      submitIcon={PackageCheck}
      loading={submitting}
      disabled={submitting || totalProcesadas === 0 || hayErrorLotes}
    >
      <div className="space-y-4">

        {/* Barra de progreso + controles de selección */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[12px] font-semibold text-orange-900">
                {totalARecibir} de {totalPendiente} pendientes
              </span>
              <span className="text-[11px] text-orange-700 ml-1.5">· Recepción #{recepcionNumero}</span>
            </div>
            <span className="text-[15px] font-bold tabular-nums text-orange-700">
              {totalPendiente > 0 ? Math.round((totalARecibir / totalPendiente) * 100) : 0}%
            </span>
          </div>
          <div className="w-full bg-orange-200 rounded-full h-1.5">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all"
              style={{ width: `${totalPendiente > 0 ? (totalARecibir / totalPendiente) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-orange-200">
            <button
              type="button"
              onClick={() => setShowRecepcionScanner(!showRecepcionScanner)}
              className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                showRecepcionScanner
                  ? 'bg-orange-200 text-orange-800 border-orange-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Escanear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRecibirTodo(totalARecibir !== totalPendiente)}
                className="text-[12px] text-orange-700 hover:text-orange-900 font-medium"
              >
                Seleccionar todas ({totalPendiente})
              </button>
              {totalARecibir > 0 && (
                <>
                  <span className="text-orange-300 text-[11px]">|</span>
                  <button
                    type="button"
                    onClick={() => handleRecibirTodo(false)}
                    className="text-[12px] text-orange-700 hover:text-orange-900 font-medium"
                  >
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>

          {showRecepcionScanner && (
            <div className="mt-2.5 p-3 bg-white border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-slate-700">Escanear producto</span>
                <button
                  type="button"
                  onClick={() => setShowRecepcionScanner(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <BarcodeScanner onScan={handleRecepcionBarcodeScan} mode="both" compact />
            </div>
          )}
        </div>

        {/* Lista de productos agrupados */}
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
          {productosAgrupados.map((prod) => {
            const cant = cantidadRecibir[prod.productoId] || 0;
            const todoRecibido = cant === prod.pendiente;
            const estaExpandido = productosExpandidos.has(prod.productoId);
            const pFull = productosMap.get(prod.productoId);
            const lotes = lotesPorProducto[prod.productoId] || [];
            const sumaLotes = lotes.reduce((s, l) => s + l.cantidad, 0);
            const lotesValidos = cant > 0 && sumaLotes === cant;

            return (
              <div key={prod.productoId} className="bg-white">
                {/* Fila principal del producto */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    {/* Info producto */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={todoRecibido}
                        onChange={() => handleCantidadChange(prod.productoId, todoRecibido ? 0 : prod.pendiente)}
                        className="h-4 w-4 rounded border-slate-300 accent-orange-600 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-slate-700 truncate">
                          {pFull?.nombreComercial || prod.nombreFallback}
                          <span className="text-slate-400 font-normal"> · {prod.sku}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {pFull?.marca && (
                            <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                              {pFull.marca}
                            </span>
                          )}
                          {pFull && getDescripcionProducto(pFull) && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {getDescripcionProducto(pFull)}
                            </span>
                          )}
                          {prod.costoFleteUnit > 0 && (
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Flete: ${prod.costoFleteUnit.toFixed(2)}/u
                            </span>
                          )}
                          {prod.yaRecibido > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-emerald-700">
                              <CheckCircle className="h-3 w-3" />
                              {prod.yaRecibido} ya recibidas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stepper + expand */}
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCantidadChange(prod.productoId, Math.max(0, cant - 1));
                          }}
                          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-50 border-r border-slate-200"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          value={cant}
                          onChange={(e) => {
                            const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), prod.pendiente);
                            handleCantidadChange(prod.productoId, val);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-10 text-center text-[13px] tabular-nums font-bold text-slate-900 py-1 border-0 focus:ring-0 focus:outline-none"
                          min="0"
                          max={prod.pendiente}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCantidadChange(prod.productoId, Math.min(prod.pendiente, cant + 1));
                          }}
                          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-50 border-l border-slate-200"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <span className={`text-[11px] tabular-nums flex-shrink-0 ${todoRecibido ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                        {cant}/{prod.pendiente}
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleExpandirProductoRecepcion(prod.productoId)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        {estaExpandido
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* S39/S40: Contadores de dañadas/perdidas/retenidas */}
                  {(() => {
                    const dan = cantidadDanada[prod.productoId] || 0;
                    const per = cantidadPerdida[prod.productoId] || 0;
                    const ret = cruzaFronteraPeru ? (cantidadRetenida[prod.productoId] || 0) : 0;
                    const disponibles = prod.pendiente - cant;
                    const maxDan = disponibles - per - ret;
                    const maxPer = disponibles - dan - ret;
                    const maxRet = disponibles - dan - per;
                    if (disponibles <= 0 && dan === 0 && per === 0 && ret === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 pl-6">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Excepciones:</span>
                        {/* Dañadas — semántico red */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCantidadDanada(p => ({ ...p, [prod.productoId]: Math.max(0, dan - 1) })); }}
                            className="px-1 py-0.5 text-red-400 hover:bg-red-50 rounded text-[11px]"
                          >−</button>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${dan > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-400'}`}>
                            {dan} dañ.
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (dan < maxDan) setCantidadDanada(p => ({ ...p, [prod.productoId]: dan + 1 })); }}
                            className="px-1 py-0.5 text-red-400 hover:bg-red-50 rounded text-[11px]"
                          >+</button>
                        </div>
                        {/* Perdidas — semántico amber (faltantes) */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCantidadPerdida(p => ({ ...p, [prod.productoId]: Math.max(0, per - 1) })); }}
                            className="px-1 py-0.5 text-amber-500 hover:bg-amber-50 rounded text-[11px]"
                          >−</button>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${per > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-400'}`}>
                            {per} perd.
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (per < maxPer) setCantidadPerdida(p => ({ ...p, [prod.productoId]: per + 1 })); }}
                            className="px-1 py-0.5 text-amber-500 hover:bg-amber-50 rounded text-[11px]"
                          >+</button>
                        </div>
                        {/* Retenidas aduana — solo si el envío cruza frontera a Perú */}
                        {cruzaFronteraPeru && (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCantidadRetenida(p => ({ ...p, [prod.productoId]: Math.max(0, ret - 1) })); }}
                              className="px-1 py-0.5 text-amber-400 hover:bg-amber-50 rounded text-[11px]"
                            >−</button>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${ret > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-400'}`}>
                              {ret} aduana
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (ret < maxRet) setCantidadRetenida(p => ({ ...p, [prod.productoId]: ret + 1 })); }}
                              className="px-1 py-0.5 text-amber-400 hover:bg-amber-50 rounded text-[11px]"
                            >+</button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Sección de lotes con mes/año — visible cuando hay cantidad > 0 */}
                  {cant > 0 && (
                    <div className={`mt-2.5 p-3 rounded-lg border ${lotesValidos ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <label
                          className="flex items-center gap-1.5 text-[11px] font-medium"
                          style={{ color: lotesValidos ? '#166534' : '#92400E' }}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Vencimiento {lotes.length > 1 ? `(${lotes.length} fechas)` : ''}
                        </label>
                        {!lotesValidos && (
                          <span className="text-[11px] text-red-600 tabular-nums">
                            {sumaLotes}/{cant} uds asignadas
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {lotes.map((lote, idx) => {
                          const dias = lote.mes && lote.anio ? diasHastaVencimiento(lote.mes, lote.anio) : null;
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              {/* Mes */}
                              <select
                                value={lote.mes}
                                onChange={(e) => handleLoteFieldChange(prod.productoId, idx, 'mes', parseInt(e.target.value))}
                                className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-20"
                              >
                                {MESES.map((m, i) => (
                                  <option key={i} value={i + 1}>{m}</option>
                                ))}
                              </select>
                              {/* Año */}
                              <select
                                value={lote.anio}
                                onChange={(e) => handleLoteFieldChange(prod.productoId, idx, 'anio', parseInt(e.target.value))}
                                className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-20"
                              >
                                {ANIOS.map(a => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                              {/* Cantidad */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={lote.cantidad || ''}
                                  onChange={(e) => handleLoteFieldChange(prod.productoId, idx, 'cantidad', Math.max(0, parseInt(e.target.value) || 0))}
                                  className="text-[12px] tabular-nums border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-14 text-center"
                                  min="0"
                                  placeholder="0"
                                />
                                <span className="text-[11px] text-slate-400">uds</span>
                              </div>
                              {/* Eliminar lote (solo si hay más de 1) */}
                              {lotes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleEliminarLote(prod.productoId, idx)}
                                  className="p-1 text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {/* Indicador de días */}
                              {dias !== null && (
                                <span className={`text-[10px] whitespace-nowrap tabular-nums ${
                                  dias < 0 ? 'text-red-600' : dias < 90 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {dias < 0 ? 'Vencido' : `${dias}d`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Agregar lote */}
                      <button
                        type="button"
                        onClick={() => handleAgregarLote(prod.productoId)}
                        className="mt-2 text-[11px] text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Otra fecha de vencimiento
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel expandido · unidades individuales */}
                {estaExpandido && (
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border-t border-slate-100">
                    {prod.unidades.map((unidad, idx) => (
                      <div
                        key={unidad.unidadId}
                        className={`flex items-center justify-between px-3 py-2 ${
                          idx < cant ? 'bg-orange-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${idx < cant ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded tabular-nums">
                                #{idx + 1}
                              </span>
                              {unidad.lote && (
                                <span className="text-[12px] text-slate-700">Lote: {unidad.lote}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              {unidad.estadoEnvio === 'faltante' && (
                                <span className="text-amber-600 font-medium">Prev. faltante</span>
                              )}
                              <span>Estado: {unidad.estadoEnvio}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          idx < cant ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {idx < cant ? 'Se recibirá' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumen de excepciones — semántico */}
        {(totalDanadas > 0 || totalPerdidas > 0 || totalRetenidas > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {totalARecibir > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="h-3 w-3" />
                {totalARecibir} OK
              </span>
            )}
            {totalDanadas > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                {totalDanadas} dañadas
              </span>
            )}
            {totalPerdidas > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {totalPerdidas} perdidas
              </span>
            )}
            {totalRetenidas > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {totalRetenidas} aduana
              </span>
            )}
          </div>
        )}

        {/* Costo de recojo en Peru */}
        {transferencia.tipo === 'internacional_peru' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="block text-[12px] font-medium text-amber-800 mb-1">
              Costo de recojo en Perú (S/) — opcional
            </label>
            <p className="text-[11px] text-amber-700 mb-2">
              Taxi, mensajero u otro costo para recoger del courier/viajero al almacén.
              Se prorratea entre las <span className="tabular-nums font-medium">{totalARecibir}</span> unidades de esta recepción.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={costoRecojoPEN}
                onChange={(e) => setCostoRecojoPEN(e.target.value)}
                className="w-36 px-3 py-1.5 text-[12px] tabular-nums border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
                placeholder="Ej: 15.00"
              />
              {costoRecojoPEN && parseFloat(costoRecojoPEN) > 0 && totalARecibir > 0 && (
                <span className="text-[11px] text-amber-700 tabular-nums">
                  = S/ {(parseFloat(costoRecojoPEN) / totalARecibir).toFixed(2)} por unidad
                </span>
              )}
            </div>
          </div>
        )}

        {/* S40: Gastos de liberación aduanera — solo si envío cruza frontera Y hay retenidas */}
        {mostrarBloqueAduana && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <label className="block text-[12px] font-medium text-amber-800">
                  Gastos de liberación aduanera (S/) — opcional
                </label>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Tasas, aranceles o brokerage pagados a la aduana.
                  Se registrará como <strong>Costo Landed categoría Aduana</strong> y se prorrateará entre las unidades del envío.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pl-6">
              <input
                type="text"
                inputMode="decimal"
                value={gastosAduanaPEN}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*[.,]?\d*$/.test(v)) setGastosAduanaPEN(v);
                }}
                className="w-36 px-3 py-1.5 text-[12px] tabular-nums border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
                placeholder="Ej: 85.00"
              />
              <input
                type="text"
                value={descripcionGastosAduana}
                onChange={(e) => setDescripcionGastosAduana(e.target.value)}
                className="flex-1 px-3 py-1.5 text-[12px] border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
                placeholder="Descripción (ej: DUA simplificada, agente)"
              />
            </div>
            {gastosAduanaPEN && parseFloat(gastosAduanaPEN.replace(',', '.')) > 0 && transferencia.unidades.length > 0 && (
              <p className="text-[11px] text-amber-700 mt-2 pl-6 tabular-nums">
                ≈ S/ {(parseFloat(gastosAduanaPEN.replace(',', '.')) / transferencia.unidades.length).toFixed(2)} por unidad (prorrateado entre {transferencia.unidades.length} uds)
              </p>
            )}
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder:text-slate-400 resize-none"
            placeholder="Notas de la recepción…"
          />
        </div>

      </div>
    </FormModalV2>
  );
};
