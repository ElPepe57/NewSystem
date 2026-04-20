import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  Percent,
  DollarSign,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type {
  OrdenCompra,
  SubOrdenCompra,
  ProductoOrden,
  CargoOC,
  DescuentoOC,
  ImpuestoOC,
} from '../../../types/ordenCompra.types';

// ════════════════════════════════════════════════════════════════════════════
// ConfirmarOCModal — reescritura S41 (mockup sub-órdenes Flujo 2)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-subordenes-s41.html` pane-modal:
 *
 *   Header — "Confirmar orden" + "OC-XXX · Proveedor · $Total"
 *            + toggle "¿Dividir en sub-órdenes?" (botón No / Sí)
 *
 *   Si NO divide: botón directo "Confirmar OC sin sub-órdenes"
 *
 *   Si SÍ divide:
 *     Sección 1: TABLA MATRIZ Asignación productos
 *       - Cols: Producto · OC original · SUB-A · SUB-B · SUB-C · Asignado · ✓
 *       - Fila roja cuando no cuadra
 *       - Icono check/alerta por fila
 *       - Banner error si hay faltantes
 *       - Botón "+ Agregar sub-orden"
 *
 *     Sección 2: TABLA MATRIZ Distribución cargos (si OC tiene cargos/desc/imp)
 *       - Cols: Concepto + pill · OC original · SUB-A · SUB-B · SUB-C · Distribuido · ✓
 *       - Validación: suma debe coincidir con cargo de OC padre
 *
 *     Totales por sub-orden (grid 3-col cards con cálculo explícito)
 *
 *     Reconciliación: "SUMA SUB-ÓRDENES: $X de $TOTAL OC"
 *
 *     Footer: botón confirmar disabled si hay errores
 */

export interface ConfirmarOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenCompra;
  onConfirmar: (subOrdenes?: SubOrdenCompra[]) => Promise<void>;
  isSubmitting: boolean;
  /** S42av — Renderiza el contenido sin el overlay/wrapper fixed. Usado
   *  cuando se embebe dentro de otro modal (ej. Detalles de Orden) para
   *  evitar el efecto "modal sobre modal". */
  embedded?: boolean;
}

// ─── Estado interno ─────────────────────────────────────────────────────────

/** Cantidad asignada de un producto a una sub-orden */
type AsignacionProductos = Record<string, Record<number, number>>;
//    subOrdenId → productIndex → cantidad

/** Monto distribuido de un cargo/descuento/impuesto a una sub-orden */
type DistribucionCargos = Record<string, Record<string, number>>;
//    subOrdenId → cargoId → monto

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════

export const ConfirmarOCModal: React.FC<ConfirmarOCModalProps> = ({
  isOpen,
  onClose,
  orden,
  onConfirmar,
  isSubmitting,
  embedded = false,
}) => {
  // Flujo: 'question' pregunta inicial | 'dividir' edición de sub-órdenes
  const [flujo, setFlujo] = useState<'question' | 'dividir'>('question');

  // Sub-órdenes simuladas (IDs temporales hasta confirmar)
  const [subOrdenIds, setSubOrdenIds] = useState<string[]>([]);
  const [asignacion, setAsignacion] = useState<AsignacionProductos>({});
  const [distribucion, setDistribucion] = useState<DistribucionCargos>({});
  const [refsProveedor, setRefsProveedor] = useState<Record<string, string>>({});
  // S42at — Override del modo de cada impuesto en el modal. Permite al usuario
  // decidir aquí si quiere % auto o $ manual, independiente de cómo se creó
  // en el wizard. Clave: impuesto.id → modo efectivo.
  const [modoImpuestoOverride, setModoImpuestoOverride] = useState<
    Record<string, 'porcentaje' | 'fijo'>
  >({});
  // S42au — Override del porcentaje por impuesto. Permite al usuario editar el
  // % directamente en el modal (ej. cambiar de 3% a 5%) y que se recalcule
  // auto. Si undefined, se usa el porcentaje original/derivado.
  const [porcentajeOverride, setPorcentajeOverride] = useState<
    Record<string, number>
  >({});

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setFlujo('question');
      setSubOrdenIds([]);
      setAsignacion({});
      setDistribucion({});
      setRefsProveedor({});
      setModoImpuestoOverride({});
      setPorcentajeOverride({});
    }
  }, [isOpen]);

  // S42ar — Return temprano MOVIDO al final de todos los hooks (ver línea
  // ~cerca del render). Antes estaba aquí y causaba "Rendered more hooks
  // than during the previous render" cuando isOpen cambiaba de false → true
  // en un componente ya montado, porque los useMemo de abajo se ejecutaban
  // condicionalmente.

  // ─── Derivados ─────────────────────────────────────────────────────────
  const productos = orden.productos ?? [];
  const cargos = orden.cargosOC ?? [];
  const descuentos = orden.descuentosOC ?? [];
  const impuestos = orden.impuestosOC ?? [];
  const tieneCargos = cargos.length + descuentos.length + impuestos.length > 0;

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleElegirNo = async () => {
    await onConfirmar();
  };

  const handleElegirSi = () => {
    // Inicializa con 2 sub-órdenes vacías (mínimo para dividir)
    const ids = [generarSubOrdenId(0), generarSubOrdenId(1)];
    setSubOrdenIds(ids);

    // Todas las cantidades inicialmente en la primera sub-orden
    const asignInicial: AsignacionProductos = {};
    ids.forEach((id) => (asignInicial[id] = {}));
    productos.forEach((p, idx) => {
      asignInicial[ids[0]][idx] = p.cantidad || 0;
    });
    setAsignacion(asignInicial);

    // Todos los cargos inicialmente en la primera sub-orden
    const distInicial: DistribucionCargos = {};
    ids.forEach((id) => (distInicial[id] = {}));
    cargos.forEach((c) => (distInicial[ids[0]][c.id] = c.montoUSD));
    descuentos.forEach((d) => (distInicial[ids[0]][d.id] = d.montoUSD));
    impuestos.forEach((i) => (distInicial[ids[0]][i.id] = i.montoUSD));
    setDistribucion(distInicial);

    setFlujo('dividir');
  };

  const handleAgregarSubOrden = () => {
    const nuevoId = generarSubOrdenId(subOrdenIds.length);
    setSubOrdenIds([...subOrdenIds, nuevoId]);
    setAsignacion({ ...asignacion, [nuevoId]: {} });
    setDistribucion({ ...distribucion, [nuevoId]: {} });
  };

  const handleQuitarSubOrden = (subId: string) => {
    if (subOrdenIds.length <= 2) return; // mínimo 2
    const nuevosIds = subOrdenIds.filter((id) => id !== subId);
    const nuevaAsign = { ...asignacion };
    const nuevaDist = { ...distribucion };
    delete nuevaAsign[subId];
    delete nuevaDist[subId];
    const nuevasRefs = { ...refsProveedor };
    delete nuevasRefs[subId];
    setSubOrdenIds(nuevosIds);
    setAsignacion(nuevaAsign);
    setDistribucion(nuevaDist);
    setRefsProveedor(nuevasRefs);
  };

  const handleSetCantidad = (
    subId: string,
    productoIdx: number,
    cantidad: number
  ) => {
    setAsignacion((prev) => ({
      ...prev,
      [subId]: { ...prev[subId], [productoIdx]: Math.max(0, cantidad) },
    }));
  };

  const handleSetDistribucion = (
    subId: string,
    cargoId: string,
    monto: number
  ) => {
    setDistribucion((prev) => ({
      ...prev,
      [subId]: { ...prev[subId], [cargoId]: monto },
    }));
  };

  // ─── Validaciones ──────────────────────────────────────────────────────
  const validacionPorProducto = useMemo(
    () =>
      productos.map((p, idx) => {
        const asignadoTotal = subOrdenIds.reduce(
          (s, id) => s + (asignacion[id]?.[idx] ?? 0),
          0
        );
        const esperado = p.cantidad || 0;
        return {
          productoIdx: idx,
          esperado,
          asignado: asignadoTotal,
          delta: asignadoTotal - esperado,
          valido: asignadoTotal === esperado,
        };
      }),
    [productos, asignacion, subOrdenIds]
  );

  const hayErroresProductos = validacionPorProducto.some((v) => !v.valido);

  // S42as — Helper dual para impuestos (actualizado en S42at con override):
  //   - modo efectivo 'porcentaje' → auto-calculado sobre base gravable de la
  //     sub-orden. Readonly visualmente.
  //   - modo efectivo 'fijo' → distribución manual via el input.
  //
  // S42at — Modo efectivo = override del modal > modo original del impuesto.

  // Modo efectivo de un impuesto (override o el original)
  const getModoEfectivo = (impuesto: typeof impuestos[number]): 'porcentaje' | 'fijo' => {
    return modoImpuestoOverride[impuesto.id] ?? impuesto.modo ?? 'fijo';
  };

  // Porcentaje efectivo de un impuesto (prioridad):
  //   1. Override del usuario en el modal (porcentajeOverride)
  //   2. Porcentaje original del impuesto (impuesto.porcentaje)
  //   3. Derivado: montoUSD / baseGravableOC × 100 (si se creó en $ fijo)
  const getPorcentajeEfectivo = (impuesto: typeof impuestos[number]): number => {
    // S42au — Override manual tiene prioridad
    const override = porcentajeOverride[impuesto.id];
    if (override !== undefined && override >= 0) return override;
    if (impuesto.porcentaje && impuesto.porcentaje > 0) return impuesto.porcentaje;
    // Derivar desde montoUSD vs base gravable de la OC total
    const subtotalOC = productos.reduce(
      (s, p) => s + (p.cantidad || 0) * (p.costoUnitario || 0),
      0
    );
    const sumCargosOC = cargos.reduce((s, c) => s + c.montoUSD, 0);
    const sumDescOC = descuentos.reduce((s, d) => s + d.montoUSD, 0);
    const baseOC = Math.max(0.01, subtotalOC + sumCargosOC - sumDescOC);
    return Number(((impuesto.montoUSD / baseOC) * 100).toFixed(4));
  };

  // S42au — Handler para editar el % en el modal
  const handleSetPorcentajeImpuesto = (impuesto: typeof impuestos[number], pct: number) => {
    setPorcentajeOverride((prev) => ({ ...prev, [impuesto.id]: Math.max(0, pct) }));
    // Al cambiar el %, asegurar que el modo efectivo sea 'porcentaje'
    if (getModoEfectivo(impuesto) !== 'porcentaje') {
      setModoImpuestoOverride((prev) => ({ ...prev, [impuesto.id]: 'porcentaje' }));
    }
  };

  const getMontoImpuestoSub = (subId: string, impuesto: typeof impuestos[number]): number => {
    const modoEfectivo = getModoEfectivo(impuesto);
    if (modoEfectivo !== 'porcentaje') {
      // Modo fijo: leer del estado distribucion (manual)
      return distribucion[subId]?.[impuesto.id] ?? 0;
    }
    // Modo porcentaje: calcular sobre base gravable de ESTA sub-orden
    const pct = getPorcentajeEfectivo(impuesto);
    const asig = asignacion[subId] ?? {};
    const dist = distribucion[subId] ?? {};
    const subtotalProds = productos.reduce(
      (s, p, idx) => s + (asig[idx] ?? 0) * (p.costoUnitario || 0),
      0
    );
    const sumCargosSub = cargos.reduce((s, c) => s + (dist[c.id] ?? 0), 0);
    const sumDescSub = descuentos.reduce((s, d) => s + (dist[d.id] ?? 0), 0);
    const baseGravable = Math.max(0, subtotalProds + sumCargosSub - sumDescSub);
    return Number(((baseGravable * pct) / 100).toFixed(2));
  };

  // Handler del toggle %/$ — al cambiar de $ a %, también pre-puebla la dist
  // manual con los valores auto-calculados (para que si vuelve a $ tenga algo).
  const handleToggleModoImpuesto = (
    impuesto: typeof impuestos[number],
    nuevoModo: 'porcentaje' | 'fijo'
  ) => {
    if (nuevoModo === 'fijo') {
      // Al pasar de % a $, persistir los valores actuales auto-calculados en
      // el estado distribucion para que queden como punto de partida editable.
      const nuevaDist = { ...distribucion };
      subOrdenIds.forEach((subId) => {
        const montoAuto = getMontoImpuestoSub(subId, impuesto);
        nuevaDist[subId] = { ...(nuevaDist[subId] ?? {}), [impuesto.id]: montoAuto };
      });
      setDistribucion(nuevaDist);
    }
    setModoImpuestoOverride((prev) => ({ ...prev, [impuesto.id]: nuevoModo }));
  };

  const validacionPorCargo = useMemo(() => {
    const items: Array<{
      id: string;
      concepto: string;
      tipo: 'cargo' | 'descuento' | 'impuesto';
      montoOC: number;
      distribuido: number;
      delta: number;
      valido: boolean;
    }> = [];
    cargos.forEach((c) => {
      const distribuido = subOrdenIds.reduce(
        (s, id) => s + (distribucion[id]?.[c.id] ?? 0),
        0
      );
      items.push({
        id: c.id,
        concepto: c.concepto,
        tipo: 'cargo',
        montoOC: c.montoUSD,
        distribuido,
        delta: distribuido - c.montoUSD,
        valido: Math.abs(distribuido - c.montoUSD) < 0.01,
      });
    });
    descuentos.forEach((d) => {
      const distribuido = subOrdenIds.reduce(
        (s, id) => s + (distribucion[id]?.[d.id] ?? 0),
        0
      );
      items.push({
        id: d.id,
        concepto: d.concepto,
        tipo: 'descuento',
        montoOC: d.montoUSD,
        distribuido,
        delta: distribuido - d.montoUSD,
        valido: Math.abs(distribuido - d.montoUSD) < 0.01,
      });
    });
    impuestos.forEach((i) => {
      const modoEfectivo = getModoEfectivo(i);
      // S42as/at — % usa helper auto; $ lee distribucion manual.
      const distribuido = subOrdenIds.reduce(
        (s, id) => s + getMontoImpuestoSub(id, i),
        0
      );
      items.push({
        id: i.id,
        concepto: i.concepto,
        tipo: 'impuesto',
        montoOC: i.montoUSD,
        distribuido,
        delta: distribuido - i.montoUSD,
        // Para impuestos %: tolerancia 0.05 (redondeos). Para $: cuadre estricto.
        valido: modoEfectivo === 'porcentaje'
          ? Math.abs(distribuido - i.montoUSD) < 0.05
          : Math.abs(distribuido - i.montoUSD) < 0.01,
      });
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargos, descuentos, impuestos, distribucion, subOrdenIds, asignacion, productos, modoImpuestoOverride, porcentajeOverride]);

  const hayErroresCargos = tieneCargos && validacionPorCargo.some((v) => !v.valido);

  // ─── Totales por sub-orden ──────────────────────────────────────────────
  const totalesPorSubOrden = useMemo(() => {
    const cargoPorId = new Map<string, 'cargo' | 'descuento' | 'impuesto'>();
    cargos.forEach((c) => cargoPorId.set(c.id, 'cargo'));
    descuentos.forEach((d) => cargoPorId.set(d.id, 'descuento'));
    impuestos.forEach((i) => cargoPorId.set(i.id, 'impuesto'));

    return subOrdenIds.map((subId) => {
      const asig = asignacion[subId] ?? {};
      const dist = distribucion[subId] ?? {};

      const subtotalProductos = productos.reduce((s, p, idx) => {
        const cant = asig[idx] ?? 0;
        return s + cant * (p.costoUnitario || 0);
      }, 0);

      let sumCargos = 0;
      let sumDesc = 0;
      let sumImp = 0;
      // Cargos + descuentos: leen de dist directo. Impuestos fijos también.
      Object.entries(dist).forEach(([id, monto]) => {
        const tipo = cargoPorId.get(id);
        if (tipo === 'cargo') sumCargos += monto;
        else if (tipo === 'descuento') sumDesc += monto;
      });
      // S42as — Impuestos: usar helper dual (% auto / fijo manual).
      impuestos.forEach((i) => {
        sumImp += getMontoImpuestoSub(subId, i);
      });

      const total = subtotalProductos + sumCargos - sumDesc + sumImp;

      return {
        subOrdenId: subId,
        subtotalProductos,
        sumCargos,
        sumDesc,
        sumImp,
        total,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subOrdenIds, asignacion, distribucion, productos, cargos, descuentos, impuestos, modoImpuestoOverride, porcentajeOverride]);

  const sumaSubOrdenes = totalesPorSubOrden.reduce((s, t) => s + t.total, 0);
  const totalOC = orden.totalUSD;
  const deltaReconciliacion = sumaSubOrdenes - totalOC;

  const puedeConfirmar = !hayErroresProductos && !hayErroresCargos && !isSubmitting;

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleConfirmarConSubOrdenes = async () => {
    if (!puedeConfirmar) return;

    const subOrdenesFinales: SubOrdenCompra[] = subOrdenIds.map((subId, subIdx) => {
      const asig = asignacion[subId] ?? {};
      const dist = distribucion[subId] ?? {};

      // Construir productos de la sub-orden con cantidad asignada
      const productosSub: ProductoOrden[] = [];
      productos.forEach((p, idx) => {
        const cant = asig[idx] ?? 0;
        if (cant > 0) {
          productosSub.push({
            ...p,
            cantidad: cant,
            subtotal: cant * (p.costoUnitario || 0),
          });
        }
      });

      const subtotalProductos = productosSub.reduce((s, p) => s + p.subtotal, 0);
      let sumCargos = 0;
      let sumDesc = 0;
      let sumImp = 0;
      cargos.forEach((c) => (sumCargos += dist[c.id] ?? 0));
      descuentos.forEach((d) => (sumDesc += dist[d.id] ?? 0));
      // S42as — Impuestos dual: % auto-calculado, fijo desde dist[]
      impuestos.forEach((i) => (sumImp += getMontoImpuestoSub(subId, i)));

      const totalSub = subtotalProductos + sumCargos - sumDesc + sumImp;

      return {
        id: `SUB-${orden.numeroOrden}-${String.fromCharCode(65 + subIdx)}`, // SUB-OC-A, SUB-OC-B, etc.
        referenciaProveedor: refsProveedor[subId] ?? '',
        productos: productosSub,
        subtotalProductosUSD: subtotalProductos,
        shippingUSD: sumCargos > 0 ? sumCargos : undefined,
        descuentoUSD: sumDesc > 0 ? sumDesc : undefined,
        impuestoUSD: sumImp > 0 ? sumImp : undefined,
        totalUSD: totalSub,
        estado: 'borrador',
        estadoPago: 'pendiente',
      };
    });

    await onConfirmar(subOrdenesFinales);
  };

  // S42ar — Return temprano AL FINAL de todos los hooks (antes estaba en
  // línea ~102 y violaba las reglas de hooks cuando isOpen cambiaba de
  // false → true en un componente ya montado).
  if (!isOpen) return null;

  // ═══ Render ═══════════════════════════════════════════════════════════
  // S42av — Contenido del modal. Se envuelve en overlay fixed solo si
  // !embedded. Cuando embedded=true se renderiza inline (ej. dentro del
  // modal de Detalles de Orden para dar sensación de flujo integrado).
  const contenido = (
    <div className={cn(
      embedded
        ? 'bg-white'
        : 'max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200'
    )}>
        {/* ─── Header interno ─── */}
        <div className={cn(
          'px-6 py-4 bg-slate-50',
          !embedded && 'border-b border-slate-200'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Confirmar orden</div>
              <div className="text-lg font-semibold text-slate-800">
                <span className="font-mono">{orden.numeroOrden}</span> ·{' '}
                {orden.nombreProveedor} ·{' '}
                <span className="tabular-nums">${orden.totalUSD.toFixed(2)}</span>
              </div>
            </div>
            {/* Botón cerrar: cuando embedded, actúa como "volver a detalles"; cuando no, cierra el modal */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label={embedded ? 'Volver a detalles' : 'Cerrar'}
              title={embedded ? 'Volver a detalles' : 'Cerrar'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toggle ¿Dividir? */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500">¿Dividir en sub-órdenes?</span>
            <button
              type="button"
              onClick={() => {
                setFlujo('question');
                setSubOrdenIds([]);
                setAsignacion({});
                setDistribucion({});
              }}
              disabled={isSubmitting}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                flujo === 'question'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              )}
            >
              No, mantener como OC única
            </button>
            <button
              type="button"
              onClick={() => (flujo === 'question' ? handleElegirSi() : undefined)}
              disabled={isSubmitting}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                flujo === 'dividir'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              )}
            >
              Sí, dividir en{' '}
              {flujo === 'dividir' ? `${subOrdenIds.length} sub-órdenes` : 'sub-órdenes'}
            </button>
          </div>
        </div>

        {/* ─── Cuerpo del modal ─── */}
        <div className="p-6 space-y-6">
          {/* Si no divide — explicación */}
          {flujo === 'question' && (
            <div className="py-8 text-center space-y-3">
              <Layers className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="text-sm text-slate-700 max-w-xl mx-auto">
                Puedes confirmar esta OC tal cual, o dividirla en sub-órdenes si el
                proveedor las separará en tandas. Si eliges dividir, podrás asignar
                productos y distribuir cargos entre cada sub-orden.
              </div>
            </div>
          )}

          {/* Si divide — las 2 tablas matriz + totales + reconciliación */}
          {flujo === 'dividir' && (
            <>
              {/* Sección 1: Asignación productos */}
              <MatrizProductos
                productos={productos}
                subOrdenIds={subOrdenIds}
                asignacion={asignacion}
                onChangeCantidad={handleSetCantidad}
                onAgregarSubOrden={handleAgregarSubOrden}
                onQuitarSubOrden={handleQuitarSubOrden}
                refsProveedor={refsProveedor}
                onChangeRef={(subId, ref) =>
                  setRefsProveedor((prev) => ({ ...prev, [subId]: ref }))
                }
                validaciones={validacionPorProducto}
              />

              {/* Sección 2: Distribución cargos (solo si hay cargos) */}
              {tieneCargos && (
                <MatrizCargos
                  cargos={cargos}
                  descuentos={descuentos}
                  impuestos={impuestos}
                  subOrdenIds={subOrdenIds}
                  distribucion={distribucion}
                  onChangeDistribucion={handleSetDistribucion}
                  validaciones={validacionPorCargo}
                  getMontoImpuestoSub={getMontoImpuestoSub}
                  getModoEfectivoImpuesto={getModoEfectivo}
                  getPorcentajeEfectivoImpuesto={getPorcentajeEfectivo}
                  onToggleModoImpuesto={handleToggleModoImpuesto}
                  onSetPorcentajeImpuesto={handleSetPorcentajeImpuesto}
                />
              )}

              {/* Totales por sub-orden */}
              <TotalesPorSubOrden
                totales={totalesPorSubOrden}
                subOrdenIds={subOrdenIds}
                sumaSubOrdenes={sumaSubOrdenes}
                totalOC={totalOC}
                deltaReconciliacion={deltaReconciliacion}
              />
            </>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {flujo === 'dividir' && (hayErroresProductos || hayErroresCargos) && (
              <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Resolver validaciones para confirmar
              </div>
            )}
            {flujo === 'question' && (
              <button
                type="button"
                onClick={handleElegirNo}
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar OC
              </button>
            )}
            {flujo === 'dividir' && (
              <button
                type="button"
                onClick={handleConfirmarConSubOrdenes}
                disabled={!puedeConfirmar}
                className={cn(
                  'px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2',
                  puedeConfirmar
                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                    : 'bg-slate-300 text-white cursor-not-allowed'
                )}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar con {subOrdenIds.length} sub-órdenes
              </button>
            )}
          </div>
        </div>
      </div>
  );

  // S42av — Modo embedded: sin overlay fixed (se renderiza inline dentro
  // de otro modal). Modo normal: overlay fixed full-screen como modal.
  if (embedded) return contenido;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      {contenido}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MatrizProductos — tabla de asignación productos × sub-órdenes
// ════════════════════════════════════════════════════════════════════════════

interface ValidacionProducto {
  productoIdx: number;
  esperado: number;
  asignado: number;
  delta: number;
  valido: boolean;
}

const MatrizProductos: React.FC<{
  productos: ProductoOrden[];
  subOrdenIds: string[];
  asignacion: AsignacionProductos;
  onChangeCantidad: (subId: string, productoIdx: number, cantidad: number) => void;
  onAgregarSubOrden: () => void;
  onQuitarSubOrden: (subId: string) => void;
  refsProveedor: Record<string, string>;
  onChangeRef: (subId: string, ref: string) => void;
  validaciones: ValidacionProducto[];
}> = ({
  productos,
  subOrdenIds,
  asignacion,
  onChangeCantidad,
  onAgregarSubOrden,
  onQuitarSubOrden,
  refsProveedor,
  onChangeRef,
  validaciones,
}) => {
  const hayError = validaciones.some((v) => !v.valido);
  const productosConError = validaciones.filter((v) => !v.valido);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            1. Asigna productos a cada sub-orden
          </div>
          <div className="text-xs text-slate-500">
            Las cantidades asignadas deben sumar exactamente las de la OC original
          </div>
        </div>
        <button
          type="button"
          onClick={onAgregarSubOrden}
          className="px-2.5 py-1 text-xs text-teal-600 hover:bg-teal-50 rounded border border-teal-200 flex items-center gap-1 font-medium"
        >
          <Plus className="w-3 h-3" />
          Agregar sub-orden
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2 font-semibold">Producto</th>
              <th className="text-right p-2 font-semibold whitespace-nowrap">
                OC original
              </th>
              {subOrdenIds.map((subId, idx) => (
                <th
                  key={subId}
                  className="text-right p-2 font-semibold bg-teal-50 whitespace-nowrap min-w-[6rem]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>SUB-{String.fromCharCode(65 + idx)}</span>
                    {subOrdenIds.length > 2 && (
                      <button
                        type="button"
                        onClick={() => onQuitarSubOrden(subId)}
                        className="text-slate-400 hover:text-red-600"
                        title="Quitar sub-orden"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="text-right p-2 font-semibold whitespace-nowrap">
                Asignado
              </th>
              <th className="text-center p-2 font-semibold w-8">✓</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p, idx) => {
              const v = validaciones[idx];
              return (
                <tr
                  key={`${p.productoId}-${idx}`}
                  className={cn(
                    'border-t border-slate-100',
                    !v.valido && 'bg-red-50'
                  )}
                >
                  <td className="p-2 font-medium">
                    <div className="font-medium">{p.nombreComercial}</div>
                    {p.sku && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        {p.sku}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-right text-slate-500 tabular-nums">
                    {p.cantidad}
                  </td>
                  {subOrdenIds.map((subId) => (
                    <td key={subId} className="p-2 text-right">
                      <input
                        type="number"
                        value={asignacion[subId]?.[idx] ?? 0}
                        onChange={(e) =>
                          onChangeCantidad(subId, idx, Number(e.target.value) || 0)
                        }
                        min={0}
                        max={p.cantidad}
                        className={cn(
                          'w-12 text-right border rounded px-1 py-0.5 bg-white tabular-nums',
                          v.valido
                            ? 'border-slate-200 focus:border-teal-500'
                            : 'border-red-300 focus:border-red-500'
                        )}
                      />
                    </td>
                  ))}
                  <td
                    className={cn(
                      'p-2 text-right font-semibold tabular-nums',
                      v.valido ? 'text-emerald-700' : 'text-red-700'
                    )}
                  >
                    {v.asignado}
                    {!v.valido && (
                      <span className="text-xs ml-1">
                        ({v.delta > 0 ? '+' : ''}
                        {v.delta})
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {v.valido ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Referencias del proveedor por sub-orden (opcional) */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {subOrdenIds.map((subId, idx) => (
          <div key={subId} className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-500 uppercase w-14 flex-shrink-0">
              SUB-{String.fromCharCode(65 + idx)}
            </label>
            <input
              type="text"
              value={refsProveedor[subId] ?? ''}
              onChange={(e) => onChangeRef(subId, e.target.value)}
              placeholder="Ref. proveedor (opcional)"
              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-teal-500"
            />
          </div>
        ))}
      </div>

      {/* Banner error */}
      {hayError && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-2.5 border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Cantidades no cuadran.</strong>{' '}
            {productosConError.map((v, i) => {
              const nombre = productos[v.productoIdx].nombreComercial;
              return (
                <span key={v.productoIdx}>
                  {i > 0 && ', '}
                  <b>{nombre}</b> (
                  {v.delta > 0 ? `sobran ${v.delta}` : `faltan ${-v.delta}`})
                </span>
              );
            })}
            . Debes distribuir las cantidades originales exactas.
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MatrizCargos — tabla de distribución de cargos/descuentos/impuestos
// ════════════════════════════════════════════════════════════════════════════

interface ValidacionCargo {
  id: string;
  concepto: string;
  tipo: 'cargo' | 'descuento' | 'impuesto';
  montoOC: number;
  distribuido: number;
  delta: number;
  valido: boolean;
}

const MatrizCargos: React.FC<{
  cargos: CargoOC[];
  descuentos: DescuentoOC[];
  impuestos: ImpuestoOC[];
  subOrdenIds: string[];
  distribucion: DistribucionCargos;
  onChangeDistribucion: (subId: string, cargoId: string, monto: number) => void;
  validaciones: ValidacionCargo[];
  /** S42as — Helper dual para impuestos: auto-calcula % sobre base gravable. */
  getMontoImpuestoSub: (subId: string, impuesto: ImpuestoOC) => number;
  /** S42at — Modo efectivo del impuesto (override del modal o original). */
  getModoEfectivoImpuesto: (impuesto: ImpuestoOC) => 'porcentaje' | 'fijo';
  /** S42at — Porcentaje efectivo (derivado si no está en el modelo). */
  getPorcentajeEfectivoImpuesto: (impuesto: ImpuestoOC) => number;
  /** S42at — Cambia el modo del impuesto en el modal. */
  onToggleModoImpuesto: (impuesto: ImpuestoOC, nuevoModo: 'porcentaje' | 'fijo') => void;
  /** S42au — Edita el porcentaje del impuesto en vivo. */
  onSetPorcentajeImpuesto: (impuesto: ImpuestoOC, pct: number) => void;
}> = ({
  impuestos,
  subOrdenIds,
  distribucion,
  onChangeDistribucion,
  validaciones,
  getMontoImpuestoSub,
  getModoEfectivoImpuesto,
  getPorcentajeEfectivoImpuesto,
  onToggleModoImpuesto,
  onSetPorcentajeImpuesto,
}) => {
  // Mapa rápido para buscar el impuesto original por ID
  const impuestosMap = new Map(impuestos.map((i) => [i.id, i]));
  const hayError = validaciones.some((v) => !v.valido);

  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-800">
          2. Distribuye los cargos de la OC entre sub-órdenes
        </div>
        <div className="text-xs text-slate-500">
          La suma de cada cargo debe coincidir con el total de la OC original
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2 font-semibold">Concepto</th>
              <th className="text-right p-2 font-semibold whitespace-nowrap">
                OC original
              </th>
              {subOrdenIds.map((_, idx) => (
                <th
                  key={idx}
                  className="text-right p-2 font-semibold bg-teal-50 whitespace-nowrap min-w-[6rem]"
                >
                  SUB-{String.fromCharCode(65 + idx)}
                </th>
              ))}
              <th className="text-right p-2 font-semibold whitespace-nowrap">
                Distribuido
              </th>
              <th className="text-center p-2 font-semibold w-8">✓</th>
            </tr>
          </thead>
          <tbody>
            {validaciones.map((v) => {
              const signoMonto = v.tipo === 'descuento' ? '−$' : '$';
              // S42as/at — Dual con toggle: detectar modo efectivo actual
              const impuestoRef = v.tipo === 'impuesto' ? impuestosMap.get(v.id) : undefined;
              const modoEfectivo = impuestoRef ? getModoEfectivoImpuesto(impuestoRef) : undefined;
              const esImpuesto = !!impuestoRef;
              const esImpuestoPct = esImpuesto && modoEfectivo === 'porcentaje';
              const pctEfectivo = impuestoRef ? getPorcentajeEfectivoImpuesto(impuestoRef) : 0;
              return (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TipoPill tipo={v.tipo} />
                      <span className="font-medium">{v.concepto}</span>
                      {/* S42at/au — Toggle %/$ + input editable del % */}
                      {esImpuesto && impuestoRef && (
                        <div
                          className="inline-flex items-center bg-slate-100 rounded p-0.5 ml-1"
                          title="Cambia entre cálculo automático por porcentaje (editable) o distribución manual por monto"
                        >
                          <button
                            type="button"
                            onClick={() => onToggleModoImpuesto(impuestoRef, 'porcentaje')}
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors inline-flex items-center gap-0.5',
                              modoEfectivo === 'porcentaje'
                                ? 'bg-white text-purple-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            )}
                          >
                            <Percent className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleModoImpuesto(impuestoRef, 'fijo')}
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors inline-flex items-center',
                              modoEfectivo === 'fijo'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            )}
                          >
                            <DollarSign className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      {/* S42au — Input editable del %, visible solo en modo porcentaje */}
                      {esImpuestoPct && impuestoRef && (
                        <div className="inline-flex items-center gap-1 ml-0.5">
                          <input
                            type="number"
                            value={pctEfectivo}
                            onChange={(e) =>
                              onSetPorcentajeImpuesto(
                                impuestoRef,
                                Number(e.target.value) || 0
                              )
                            }
                            step="0.01"
                            min={0}
                            max={100}
                            className="w-14 px-1 py-0.5 text-xs text-right border border-purple-200 rounded bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-100 tabular-nums text-purple-900 font-semibold"
                            title="Edita el porcentaje — se recalcula automáticamente en cada sub-orden"
                          />
                          <span className="text-[10px] text-purple-600 font-semibold">%</span>
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-200"
                            title="Cálculo automático sobre la base gravable (subtotal + cargos − descuentos) de cada sub-orden"
                          >
                            auto
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-right text-slate-500 tabular-nums">
                    {signoMonto}
                    {v.montoOC.toFixed(2)}
                  </td>
                  {subOrdenIds.map((subId) => {
                    // Impuesto %: celda readonly con valor auto-calculado
                    if (esImpuestoPct && impuestoRef) {
                      const montoAuto = getMontoImpuestoSub(subId, impuestoRef);
                      return (
                        <td key={subId} className="p-2 text-right">
                          <div
                            className="w-20 ml-auto text-right border rounded px-1 py-0.5 bg-purple-50 border-purple-200 tabular-nums text-purple-900 font-medium"
                            title={`${impuestoRef.porcentaje}% sobre la base gravable de esta sub-orden`}
                          >
                            {montoAuto.toFixed(2)}
                          </div>
                        </td>
                      );
                    }
                    // Cargo, descuento, o impuesto fijo: input editable normal
                    return (
                      <td key={subId} className="p-2 text-right">
                        <input
                          type="number"
                          value={distribucion[subId]?.[v.id] ?? 0}
                          onChange={(e) =>
                            onChangeDistribucion(
                              subId,
                              v.id,
                              Number(e.target.value) || 0
                            )
                          }
                          step="0.01"
                          min={0}
                          className={cn(
                            'w-20 text-right border rounded px-1 py-0.5 bg-white tabular-nums',
                            v.valido
                              ? 'border-slate-200 focus:border-teal-500'
                              : 'border-red-300 focus:border-red-500'
                          )}
                        />
                      </td>
                    );
                  })}
                  <td
                    className={cn(
                      'p-2 text-right font-semibold tabular-nums',
                      v.valido ? 'text-emerald-700' : 'text-red-700'
                    )}
                  >
                    {signoMonto}
                    {v.distribuido.toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    {v.valido ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hayError && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-2.5 border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Hay cargos cuya suma no coincide con el total de la OC original. Ajusta las
            distribuciones.
          </span>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Totales por sub-orden + Reconciliación
// ════════════════════════════════════════════════════════════════════════════

interface TotalSubOrden {
  subOrdenId: string;
  subtotalProductos: number;
  sumCargos: number;
  sumDesc: number;
  sumImp: number;
  total: number;
}

const TotalesPorSubOrden: React.FC<{
  totales: TotalSubOrden[];
  subOrdenIds: string[];
  sumaSubOrdenes: number;
  totalOC: number;
  deltaReconciliacion: number;
}> = ({ totales, subOrdenIds, sumaSubOrdenes, totalOC, deltaReconciliacion }) => {
  const reconciliado = Math.abs(deltaReconciliacion) < 0.01;

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-500 mb-3 tracking-wide">
        TOTALES POR SUB-ORDEN
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {totales.map((t, idx) => {
          const subId = subOrdenIds[idx];
          const formula =
            `$${t.subtotalProductos.toFixed(0)}` +
            (t.sumCargos > 0 ? ` + $${t.sumCargos.toFixed(2)}` : '') +
            (t.sumDesc > 0 ? ` − $${t.sumDesc.toFixed(2)}` : '') +
            (t.sumImp > 0 ? ` + $${t.sumImp.toFixed(2)}` : '');

          return (
            <div
              key={subId}
              className="bg-white rounded-lg p-3 border border-slate-200"
            >
              <div className="text-xs text-slate-500 mb-1 font-mono">
                SUB-{String.fromCharCode(65 + idx)}
              </div>
              <div className="text-xs text-slate-400 tabular-nums">{formula} =</div>
              <div className="text-base font-semibold text-slate-800 tabular-nums">
                ${t.total.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reconciliación */}
      <div
        className={cn(
          'mt-3 flex items-center justify-between rounded-lg p-2.5 border',
          reconciliado
            ? 'bg-teal-50 border-teal-200'
            : 'bg-amber-50 border-amber-200'
        )}
      >
        <span
          className={cn(
            'text-xs font-semibold tracking-wide',
            reconciliado ? 'text-teal-900' : 'text-amber-900'
          )}
        >
          SUMA SUB-ÓRDENES:
        </span>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            reconciliado ? 'text-teal-900' : 'text-amber-900'
          )}
        >
          ${sumaSubOrdenes.toFixed(2)}{' '}
          <span className="text-xs font-normal">de ${totalOC.toFixed(2)} OC</span>
          {!reconciliado && (
            <span className="text-xs ml-1">
              ({deltaReconciliacion > 0 ? '+' : ''}
              {deltaReconciliacion.toFixed(2)})
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════════════════════

const TipoPill: React.FC<{ tipo: 'cargo' | 'descuento' | 'impuesto' }> = ({
  tipo,
}) => {
  const conf = {
    cargo: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Cargo' },
    descuento: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Desc.' },
    impuesto: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Imp.' },
  }[tipo];

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
        conf.bg,
        conf.text
      )}
    >
      {conf.label}
    </span>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function generarSubOrdenId(index: number): string {
  return `tmp-sub-${Date.now()}-${index}`;
}
