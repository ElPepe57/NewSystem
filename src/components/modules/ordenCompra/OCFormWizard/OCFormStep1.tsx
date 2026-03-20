import React, { useMemo } from 'react';
import { Plus, Trash2, Globe, Package, ClipboardList } from 'lucide-react';
import { usePaisOrigenStore } from '../../../../store/paisOrigenStore';
import { ProveedorAutocomplete } from '../../entidades/ProveedorAutocomplete';
import { AlmacenAutocomplete } from '../../entidades/AlmacenAutocomplete';
import { ProductoAutocomplete } from '../../entidades/ProductoAutocomplete';
import type { ProductoSnapshot } from '../../entidades/ProductoAutocomplete';
import { Input } from '../../../common/Input';
import type { Producto } from '../../../../types/producto.types';
import type { Proveedor, ProveedorFormData } from '../../../../types/ordenCompra.types';
import type { OCFormState, OCFormAction, ProductoOrdenItem } from './ocFormTypes';
import { EMPTY_PRODUCTO, getSubtotalUSD } from './ocFormTypes';

interface OCFormStep1Props {
  state: OCFormState;
  dispatch: React.Dispatch<OCFormAction>;
  productos: Producto[];
  proveedores: Proveedor[];
  onCreateProveedor: (data: ProveedorFormData) => Promise<Proveedor>;
  requerimientoId?: string;
  requerimientoNumero?: string;
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  clientesOrigen?: Array<{ requerimientoId: string; requerimientoNumero: string; clienteNombre: string }>;
}

export const OCFormStep1: React.FC<OCFormStep1Props> = ({
  state,
  dispatch,
  productos,
  proveedores,
  onCreateProveedor,
  requerimientoId,
  requerimientoNumero,
  requerimientoIds,
  requerimientoNumeros,
  clientesOrigen,
}) => {
  const { paisesActivos: paisesOrigen } = usePaisOrigenStore();

  const subtotalUSD = useMemo(() => getSubtotalUSD(state), [state.productos]);

  // --- Handlers ---

  const handleProveedorChange = (prov: { proveedorId: string; nombre: string; pais: string } | null) => {
    dispatch({ type: 'SET_PROVEEDOR', payload: prov });
    if (prov?.pais && prov.pais !== state.paisOrigenOC) {
      dispatch({ type: 'SET_PAIS_ORIGEN', payload: prov.pais });
    }
  };

  const handleProductoSelect = (index: number, snapshot: ProductoSnapshot | null) => {
    if (!snapshot) return;
    const item: ProductoOrdenItem = {
      productoId: snapshot.productoId,
      sku: snapshot.sku,
      marca: snapshot.marca,
      nombreComercial: snapshot.nombreComercial,
      presentacion: snapshot.presentacion,
      cantidad: state.productos[index]?.cantidad || 1,
      costoUnitario: state.productos[index]?.costoUnitario || 0,
    };
    dispatch({ type: 'SELECT_PRODUCTO', payload: { index, producto: item } });
  };

  const handleProductoFieldChange = (index: number, field: string, value: number) => {
    dispatch({ type: 'UPDATE_PRODUCTO', payload: { index, field, value } });
  };

  const handleAddProducto = () => {
    dispatch({ type: 'ADD_PRODUCTO' });
  };

  const handleRemoveProducto = (index: number) => {
    dispatch({ type: 'REMOVE_PRODUCTO', payload: index });
  };

  // --- Flete info ---
  const paisInfo = state.paisOrigenOC
    ? paisesOrigen.find(p => p.codigo === state.paisOrigenOC)
    : null;

  return (
    <div className="space-y-5">
      {/* Requerimiento banner */}
      {requerimientoIds && requerimientoIds.length > 0 ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-semibold text-blue-900">
              OC Consolidada desde {requerimientoIds.length} requerimiento(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {clientesOrigen?.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium"
              >
                {c.requerimientoNumero} - {c.clienteNombre}
              </span>
            ))}
          </div>
        </div>
      ) : requerimientoId ? (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-primary-600" />
          <p className="text-sm font-medium text-primary-900">
            Desde Requerimiento: {requerimientoNumero || requerimientoId}
          </p>
        </div>
      ) : null}

      {/* Section: Proveedor y Ruta */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-500" />
          Proveedor y Ruta
        </h3>

        {/* Row 1: Proveedor (full width) + País badge */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Proveedor <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ProveedorAutocomplete
                value={state.proveedor}
                onChange={handleProveedorChange}
                onCreateNew={onCreateProveedor}
                placeholder="Buscar proveedor..."
                required
                allowCreate
              />
            </div>
            {/* País badge - auto-inherited from proveedor */}
            {state.paisOrigenOC ? (
              <div className="flex-shrink-0 relative group">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-800">
                  <Globe className="h-3.5 w-3.5 text-blue-500" />
                  <span>{state.paisOrigenOC}</span>
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  País de origen (del proveedor)
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0">
                {paisesOrigen.length > 0 ? (
                  <select
                    value={state.paisOrigenOC}
                    onChange={(e) => dispatch({ type: 'SET_PAIS_ORIGEN', payload: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  >
                    <option value="">País...</option>
                    {paisesOrigen.map(p => (
                      <option key={p.id} value={p.codigo}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1 px-3 py-2 bg-gray-100 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400">
                    <Globe className="h-3.5 w-3.5" />
                    <span>País</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {state.proveedor && !state.paisOrigenOC && (
            <p className="text-[10px] text-amber-500 mt-1">
              El proveedor no tiene país asignado. Selecciona manualmente.
            </p>
          )}
        </div>

        {/* Row 2: Almacén + TC */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Almacen Destino */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Almacen Destino <span className="text-red-500">*</span>
            </label>
            <AlmacenAutocomplete
              value={state.almacenDestino}
              onChange={(alm) => dispatch({ type: 'SET_ALMACEN', payload: alm })}
              placeholder={state.paisOrigenOC ? `Almacen en ${state.paisOrigenOC}...` : 'Almacen destino...'}
              required
              filterPais={state.paisOrigenOC || undefined}
            />
            {state.paisOrigenOC && !state.almacenDestino && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Mostrando almacenes de {state.paisOrigenOC}
              </p>
            )}
          </div>

          {/* Tipo de Cambio */}
          <div>
            <Input
              label="Tipo de Cambio"
              type="number"
              required
              min="0"
              step="0.001"
              value={state.tcCompra}
              onChange={(e) => dispatch({ type: 'SET_TC', payload: parseFloat(e.target.value) || 0 })}
              className="text-sm"
            />
          </div>
        </div>

        {/* Flete info */}
        {paisInfo?.tarifaFleteEstimadaUSD && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <Package className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-[11px] text-amber-700">
              Flete estimado: <span className="font-semibold">${paisInfo.tarifaFleteEstimadaUSD}/ud</span>
              {' · '}{paisInfo.metodoEnvio || '\u2014'}
              {' · ~'}{paisInfo.tiempoTransitoDias || '?'} días
            </p>
          </div>
        )}
      </div>

      {/* Section: Productos */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Productos</span>
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
              {state.productos.filter(p => p.productoId).length}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {state.productos.map((item, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border transition-all ${
                item.productoId && item.costoUnitario > 0
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-dashed border-gray-300'
              }`}
            >
              {/* Row header: Number + SKU info + remove */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    {index + 1}
                  </div>
                  {item.productoId && (
                    <span className="text-[10px] text-gray-400">
                      {item.sku} · {item.presentacion}
                    </span>
                  )}
                </div>
                {state.productos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProducto(index)}
                    className="flex-shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Product autocomplete - full width */}
              <ProductoAutocomplete
                productos={productos}
                value={item.productoId ? {
                  productoId: item.productoId,
                  sku: item.sku,
                  marca: item.marca,
                  nombreComercial: item.nombreComercial,
                  presentacion: item.presentacion,
                } : null}
                onChange={(snapshot) => handleProductoSelect(index, snapshot)}
                proveedorSeleccionado={state.proveedor?.nombre}
                showInvestigacionSugerencia={false}
                placeholder="Buscar producto..."
                required
              />

              {/* Row 2: Cantidad, Precio, Subtotal */}
              {item.productoId && (
                <div className="flex items-center gap-2 sm:gap-3 mt-2">
                  {/* Cantidad */}
                  <div className="w-16 sm:w-20">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => handleProductoFieldChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center"
                      placeholder="Cant."
                    />
                  </div>

                  {/* Precio */}
                  <div className="flex-1 sm:w-28 sm:flex-none">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costoUnitario}
                        onChange={(e) => handleProductoFieldChange(index, 'costoUnitario', parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="w-20 sm:w-24 text-right">
                    <div className="text-xs text-gray-500">Subtotal</div>
                    <div className="text-sm sm:text-base font-semibold text-gray-900">
                      ${(item.cantidad * item.costoUnitario).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add product button */}
          <button
            type="button"
            onClick={handleAddProducto}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Agregar producto
          </button>

          {/* Subtotal footer */}
          {subtotalUSD > 0 && (
            <div className="flex justify-end pt-3 border-t border-gray-200">
              <div className="text-right">
                <span className="text-xs text-gray-500 mr-3">Subtotal:</span>
                <span className="text-base font-bold text-gray-900">${subtotalUSD.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

