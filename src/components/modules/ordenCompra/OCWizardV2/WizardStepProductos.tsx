import React, { useEffect, useMemo } from 'react';
import { Globe, Package, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../../design-system';
import { useProductoStore } from '../../../../store/productoStore';
import { useTipoCambioStore } from '../../../../store/tipoCambioStore';
import { ProveedorAutocomplete } from '../../entidades/ProveedorAutocomplete';
import { ProductoAutocomplete } from '../../entidades/ProductoAutocomplete';
import type { ProductoSnapshot } from '../../entidades/ProductoAutocomplete';
import type { ProveedorSnapshot } from '../../entidades/ProveedorAutocomplete';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';

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
}) => {
  const { productos: catalogoProductos, fetchProductos, loading: loadingProductos } = useProductoStore();
  const { getTCDelDia } = useTipoCambioStore();

  // Load productos catalog on mount
  useEffect(() => {
    if (catalogoProductos.length === 0) {
      fetchProductos();
    }
  }, []);

  // Auto-populate TC if not set
  useEffect(() => {
    if (tcCompra === 0) {
      getTCDelDia().then((tc) => {
        if (tc?.venta) onSetTC(tc.venta);
      });
    }
  }, []);

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
                  onChange={(e) => onSetTC(parseFloat(e.target.value) || 0)}
                  placeholder="3.750"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900"
                />
              </div>
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
