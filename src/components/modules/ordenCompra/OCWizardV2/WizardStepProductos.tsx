import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Package, Plus, Trash2, RefreshCw, Layers, AlertTriangle } from 'lucide-react';
import { cn } from '../../../../design-system';
import { useProductoStore } from '../../../../store/productoStore';
import { useTipoCambioStore } from '../../../../store/tipoCambioStore';
import { ProveedorAutocomplete } from '../../entidades/ProveedorAutocomplete';
import { ProductoAutocomplete } from '../../entidades/ProductoAutocomplete';
import type { ProductoSnapshot } from '../../entidades/ProductoAutocomplete';
import type { ProveedorSnapshot } from '../../entidades/ProveedorAutocomplete';
import type { ProductoOrden, SubOrdenCompra } from '../../../../types/ordenCompra.types';

// ---- Constants ----

const PAISES_ORIGEN = ['USA', 'China', 'Corea', 'Peru', 'Otro'] as const;

// ---- Props ----

interface WizardStepProductosProps {
  proveedorId: string;
  proveedorNombre: string;
  paisOrigen: string;
  tcCompra: number;
  productos: ProductoOrden[];
  onSetProveedor: (id: string, nombre: string) => void;
  onSetPaisOrigen: (pais: string) => void;
  onSetTC: (tc: number) => void;
  onAddProducto: (producto: ProductoOrden) => void;
  onRemoveProducto: (index: number) => void;
  onUpdateProducto: (index: number, producto: ProductoOrden) => void;
  useSubOrdenes: boolean;
  subOrdenes: SubOrdenCompra[];
  onToggleSubOrdenes: () => void;
  onSetSubOrdenes: (subOrdenes: SubOrdenCompra[]) => void;
}

// ---- Component ----

export const WizardStepProductos: React.FC<WizardStepProductosProps> = ({
  proveedorId,
  proveedorNombre,
  paisOrigen,
  tcCompra,
  productos,
  onSetProveedor,
  onSetPaisOrigen,
  onSetTC,
  onAddProducto,
  onRemoveProducto,
  onUpdateProducto,
  useSubOrdenes,
  subOrdenes,
  onToggleSubOrdenes,
  onSetSubOrdenes,
}) => {
  const { productos: catalogoProductos, fetchProductos, loading: loadingProductos } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const [tcAutoLoaded, setTcAutoLoaded] = useState(false);
  const [loadingTC, setLoadingTC] = useState(false);

  // Sub-ordenes: assignment map — product index → subOrden id ('' = sin asignar)
  const [subOrdenAssignment, setSubOrdenAssignment] = useState<Record<number, string>>({});

  // When sub-ordenes are toggled ON, initialize first sub-orden with all products
  const handleToggleSubOrdenes = () => {
    if (!useSubOrdenes && productos.length >= 2) {
      // Turning ON: create default sub-orden 1 and assign all products to it
      const defaultId = 'SUB-1';
      const defaultSub: SubOrdenCompra = {
        id: defaultId,
        referenciaProveedor: '',
        productos: [...productos],
        totalUSD: productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0),
      };
      const initAssignment: Record<number, string> = {};
      productos.forEach((_, i) => { initAssignment[i] = defaultId; });
      setSubOrdenAssignment(initAssignment);
      onToggleSubOrdenes();
      // Call parent with the initial sub-orden array (after toggle the parent state flips to true)
      // We need to push the subOrdenes up — do it after the toggle resolves via effect
      // Use a small workaround: call onSetSubOrdenes directly
      onSetSubOrdenes([defaultSub]);
    } else {
      // Turning OFF
      setSubOrdenAssignment({});
      onToggleSubOrdenes();
    }
  };

  // Rebuild sub-ordenes whenever assignment or products change
  const rebuildSubOrdenes = (
    assignment: Record<number, string>,
    currentSubOrdenes: SubOrdenCompra[],
    currentProductos: ProductoOrden[],
  ): SubOrdenCompra[] => {
    return currentSubOrdenes.map((sub) => {
      const assignedProds = currentProductos.filter((_, idx) => assignment[idx] === sub.id);
      const totalUSD = assignedProds.reduce(
        (s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0),
        0,
      );
      return { ...sub, productos: assignedProds, totalUSD };
    });
  };

  const handleAssignmentChange = (productIndex: number, subOrdenId: string) => {
    const newAssignment = { ...subOrdenAssignment, [productIndex]: subOrdenId };
    setSubOrdenAssignment(newAssignment);
    onSetSubOrdenes(rebuildSubOrdenes(newAssignment, subOrdenes, productos));
  };

  const handleAddSubOrden = () => {
    const nextNum = subOrdenes.length + 1;
    const newSub: SubOrdenCompra = {
      id: `SUB-${nextNum}`,
      referenciaProveedor: '',
      productos: [],
      totalUSD: 0,
    };
    onSetSubOrdenes([...subOrdenes, newSub]);
  };

  const handleRemoveSubOrden = (subId: string) => {
    if (subOrdenes.length <= 1) return; // keep at least one
    // Unassign products that were in this sub-orden
    const newAssignment = { ...subOrdenAssignment };
    Object.keys(newAssignment).forEach((k) => {
      if (newAssignment[Number(k)] === subId) newAssignment[Number(k)] = '';
    });
    setSubOrdenAssignment(newAssignment);
    const remaining = subOrdenes.filter((s) => s.id !== subId);
    onSetSubOrdenes(rebuildSubOrdenes(newAssignment, remaining, productos));
  };

  const handleSubOrdenRefChange = (subId: string, ref: string) => {
    const updated = subOrdenes.map((s) => s.id === subId ? { ...s, referenciaProveedor: ref } : s);
    onSetSubOrdenes(updated);
  };

  // Products not assigned to any sub-orden
  const unassignedIndices = useSubOrdenes
    ? productos.map((_, i) => i).filter((i) => !subOrdenAssignment[i])
    : [];

  // Load productos catalog on mount
  useEffect(() => {
    if (catalogoProductos.length === 0) {
      fetchProductos();
    }
  }, []);

  // Auto-populate TC if not set
  useEffect(() => {
    if (tcCompra === 0) {
      setLoadingTC(true);
      getTCDelDia().then((tc) => {
        if (tc?.venta) {
          onSetTC(tc.venta);
          setTcAutoLoaded(true);
        }
      }).finally(() => setLoadingTC(false));
    }
  }, []);

  const handleRefreshTC = async () => {
    setLoadingTC(true);
    const tc = await getTCDelDia();
    if (tc?.venta) {
      onSetTC(tc.venta);
      setTcAutoLoaded(true);
    }
    setLoadingTC(false);
  };

  const subtotal = useMemo(
    () => productos.reduce((sum, p) => sum + (p.costoUnitario || 0) * (p.cantidad || 0), 0),
    [productos],
  );

  // ---- Handlers ----

  const handleProveedorChange = (snapshot: ProveedorSnapshot | null) => {
    if (!snapshot) {
      onSetProveedor('', '');
      return;
    }
    onSetProveedor(snapshot.proveedorId, snapshot.nombre);
    // Auto-inherit país from provider if current is empty
    if (snapshot.pais && !paisOrigen) {
      const normalised = PAISES_ORIGEN.find(
        (p) => p.toLowerCase() === snapshot.pais.toLowerCase(),
      );
      onSetPaisOrigen(normalised ?? snapshot.pais);
    }
  };

  const handleSelectProducto = (snapshot: ProductoSnapshot | null) => {
    if (!snapshot) return;
    const nuevo: ProductoOrden = {
      productoId: snapshot.productoId,
      sku: snapshot.sku,
      marca: snapshot.marca,
      nombreComercial: snapshot.nombreComercial,
      presentacion: snapshot.presentacion,
      cantidad: 1,
      costoUnitario: 0,
      subtotal: 0,
    };
    onAddProducto(nuevo);
  };

  const handleFieldChange = (
    index: number,
    field: 'cantidad' | 'costoUnitario',
    raw: string,
  ) => {
    const p = productos[index];
    const value = field === 'cantidad' ? parseInt(raw, 10) || 0 : parseFloat(raw) || 0;
    const updated: ProductoOrden = {
      ...p,
      [field]: value,
      subtotal:
        field === 'cantidad'
          ? value * (p.costoUnitario || 0)
          : (p.cantidad || 0) * value,
    };
    onUpdateProducto(index, updated);
  };

  // Derived proveedor snapshot for ProveedorAutocomplete
  const proveedorValue: ProveedorSnapshot | null =
    proveedorId
      ? { proveedorId, nombre: proveedorNombre, pais: paisOrigen }
      : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Proveedor y Productos</h2>
        <p className="text-sm text-slate-500 mt-1">¿A quién le compras y qué productos?</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-5">
        {/* ---- Section: Proveedor ---- */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-400" />
            Proveedor y Origen
          </h3>

          {/* Proveedor autocomplete */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <ProveedorAutocomplete
              value={proveedorValue}
              onChange={handleProveedorChange}
              placeholder="Buscar proveedor..."
              required
            />
          </div>

          {/* País Origen + TC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                País Origen
              </label>
              <select
                value={paisOrigen}
                onChange={(e) => onSetPaisOrigen(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-slate-900"
              >
                <option value="">Seleccionar...</option>
                {PAISES_ORIGEN.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo de Cambio (S//$) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                  S/
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={tcCompra || ''}
                  onChange={(e) => { onSetTC(parseFloat(e.target.value) || 0); setTcAutoLoaded(false); }}
                  placeholder="3.750"
                  className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleRefreshTC}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                  title="Obtener TC del día"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loadingTC && 'animate-spin')} />
                </button>
              </div>
              {tcAutoLoaded && tcCompra > 0 && (
                <p className="text-[10px] text-teal-600 mt-0.5">TC del día (auto)</p>
              )}
            </div>
          </div>
        </div>

        {/* ---- Section: Productos ---- */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Productos</span>
              {productos.length > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                  {productos.length}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Existing product rows */}
            {productos.map((item, index) => (
              <div
                key={`${item.productoId}-${index}`}
                className={cn(
                  'p-3 rounded-lg border transition-all',
                  item.costoUnitario > 0
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-50 border-dashed border-slate-300',
                )}
              >
                {/* Header row: index + sku info + remove */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-medium text-teal-700">
                      {index + 1}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-900">{item.nombreComercial}</span>
                      <span className="text-xs text-slate-400 ml-2">{item.sku} · {item.presentacion}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveProducto(index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Eliminar producto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Quantity + Price + Subtotal */}
                <div className="flex items-center gap-3 mt-2">
                  {/* Cantidad */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => handleFieldChange(index, 'cantidad', e.target.value)}
                      className="w-20 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                    />
                  </div>

                  {/* Costo Unitario */}
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-0.5">Precio USD / ud.</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costoUnitario || ''}
                        onChange={(e) => handleFieldChange(index, 'costoUnitario', e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-right"
                      />
                    </div>
                  </div>

                  {/* Subtotal display */}
                  <div className="text-right min-w-[70px]">
                    <div className="text-[10px] text-slate-500">Subtotal</div>
                    <div className="text-sm font-semibold text-slate-900">
                      ${((item.cantidad || 0) * (item.costoUnitario || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add product via autocomplete */}
            <div className="pt-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Agregar producto
              </label>
              {loadingProductos ? (
                <div className="w-full py-3 text-sm text-slate-400 text-center border border-dashed border-slate-300 rounded-lg">
                  Cargando catalogo...
                </div>
              ) : (
                <ProductoAutocomplete
                  productos={catalogoProductos}
                  value={null}
                  onChange={handleSelectProducto}
                  placeholder="Buscar producto por nombre, SKU o marca..."
                  showInvestigacionSugerencia={false}
                  proveedorSeleccionado={proveedorNombre || undefined}
                />
              )}
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" />
                Seleccionar agrega el producto a la lista
              </p>
            </div>

            {/* Subtotal footer */}
            {subtotal > 0 && (
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-sm text-slate-500">Subtotal productos</span>
                <span className="text-base font-bold text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ---- Section: Sub-Ordenes ---- */}
        {productos.length >= 2 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Header / toggle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Sub-Ordenes</span>
                <span className="text-xs text-slate-400">
                  (divide esta OC en órdenes separadas del proveedor)
                </span>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                onClick={handleToggleSubOrdenes}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                  useSubOrdenes ? 'bg-teal-600' : 'bg-slate-200',
                )}
                aria-label="Dividir en sub-órdenes"
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                    useSubOrdenes ? 'translate-x-4' : 'translate-x-1',
                  )}
                />
              </button>
            </div>

            {useSubOrdenes && (
              <div className="p-4 space-y-4">
                {/* Assignment dropdowns per product */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Asignar productos a sub-órdenes
                  </p>
                  {productos.map((prod, idx) => (
                    <div
                      key={`assign-${prod.productoId}-${idx}`}
                      className="py-2 px-3 bg-slate-50 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-medium text-teal-700 flex-shrink-0">
                            {idx + 1}
                          </div>
                          <span className="text-sm text-slate-700 truncate">{prod.nombreComercial}</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">{prod.sku}</span>
                        </div>
                        <select
                          value={subOrdenAssignment[idx] || ''}
                          onChange={(e) => handleAssignmentChange(idx, e.target.value)}
                          className={cn(
                            'text-xs border rounded-lg px-2 py-1 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white flex-shrink-0',
                            !subOrdenAssignment[idx]
                              ? 'border-amber-300 text-amber-700'
                              : 'border-slate-300 text-slate-900',
                          )}
                        >
                          <option value="">Sin asignar</option>
                          {subOrdenes.map((sub, sIdx) => (
                            <option key={sub.id} value={sub.id}>
                              Sub-orden {sIdx + 1}
                              {sub.referenciaProveedor ? ` — ${sub.referenciaProveedor}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Editable quantity + price */}
                      <div className="flex items-center gap-2 pl-7">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">Cant:</label>
                          <input
                            type="number"
                            min="1"
                            value={prod.cantidad}
                            onChange={(e) => handleFieldChange(idx, 'cantidad', e.target.value)}
                            className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">$:</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={prod.costoUnitario || ''}
                            onChange={(e) => handleFieldChange(idx, 'costoUnitario', e.target.value)}
                            placeholder="0.00"
                            className="w-20 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-right"
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700 ml-auto">
                          ${((prod.cantidad || 0) * (prod.costoUnitario || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Unassigned warning */}
                {unassignedIndices.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {unassignedIndices.length === 1
                      ? '1 producto sin asignar a ninguna sub-orden'
                      : `${unassignedIndices.length} productos sin asignar a ninguna sub-orden`}
                  </div>
                )}

                {/* Sub-orden cards */}
                <div className="space-y-3">
                  {subOrdenes.map((sub, sIdx) => (
                    <div
                      key={sub.id}
                      className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                            Sub-orden {sIdx + 1}
                          </span>
                        </div>
                        {subOrdenes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubOrden(sub.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Eliminar sub-orden"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Referencia proveedor */}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">
                          Referencia proveedor (ej. "Amazon Order #111-222")
                        </label>
                        <input
                          type="text"
                          value={sub.referenciaProveedor}
                          onChange={(e) => handleSubOrdenRefChange(sub.id, e.target.value)}
                          placeholder="Número de orden / factura del proveedor"
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 bg-white"
                        />
                      </div>

                      {/* Products in this sub-orden */}
                      {sub.productos.length > 0 ? (
                        <div className="space-y-1">
                          {sub.productos.map((p, pIdx) => (
                            <div
                              key={`${sub.id}-prod-${pIdx}`}
                              className="flex items-center justify-between text-xs text-slate-600 bg-white border border-slate-100 rounded-lg px-2 py-1"
                            >
                              <span className="truncate">{p.nombreComercial}</span>
                              <span className="text-slate-400 flex-shrink-0 ml-2">
                                x{p.cantidad} · ${((p.cantidad || 0) * (p.costoUnitario || 0)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Sin productos asignados</p>
                      )}

                      {/* Subtotal */}
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-xs text-slate-500">Subtotal sub-orden</span>
                        <span className="text-sm font-semibold text-slate-900">
                          ${sub.totalUSD.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add sub-orden button */}
                <button
                  type="button"
                  onClick={handleAddSubOrden}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-teal-300 rounded-xl text-sm text-teal-600 hover:bg-teal-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Agregar sub-orden
                </button>
              </div>
            )}
          </div>
        )}

        {/* Validation hint */}
        {productos.length === 0 && (
          <p className="text-center text-sm text-amber-600">
            Agrega al menos un producto para continuar
          </p>
        )}
        {productos.some((p) => p.costoUnitario === 0) && productos.length > 0 && (
          <p className="text-center text-xs text-slate-400">
            Ingresa el precio de costo unitario en los productos marcados
          </p>
        )}
      </div>
    </div>
  );
};
