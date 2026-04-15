import React from 'react';
import { Package, Truck, UserCheck, Send, ShoppingBag, DollarSign, MapPin } from 'lucide-react';
import { cn, DataTable } from '../../../../design-system';
import type { DataTableColumn } from '../../../../design-system';
import type { OCWizardState } from './ocWizardTypes';
import { deriveDeliveryConfig } from './ocWizardTypes';
import type { ProductoOrden } from '../../../../types/ordenCompra.types';

interface WizardStepConfirmProps {
  state: OCWizardState;
}

const modoLabels: Record<string, string> = {
  ddp_directo: 'Envío directo del proveedor',
  via_viajero: 'Traído por viajero',
  via_courier: 'Courier internacional',
  recojo_propio: 'Recojo en origen',
};

const fleteLabels: Record<string, string> = {
  proveedor: 'Incluido por el proveedor',
  comprador: 'Pagado por el comprador',
  viajero: 'Cobrado por el viajero',
};

const modoIcons: Record<string, typeof Truck> = {
  ddp_directo: Truck,
  via_viajero: UserCheck,
  via_courier: Send,
  recojo_propio: ShoppingBag,
};

export const WizardStepConfirm: React.FC<WizardStepConfirmProps> = ({ state }) => {
  const config = deriveDeliveryConfig(state.modoEntregaDetallado, state.quienPagaFlete);
  const ModoIcon = state.modoEntregaDetallado ? modoIcons[state.modoEntregaDetallado] : Package;

  const subtotal = state.productos.reduce((s, p) => s + (p.costoUnitario || 0) * (p.cantidad || 0), 0);
  const totalCargos = state.cargosOC.reduce((s, c) => s + (c.montoUSD || 0), 0);
  const totalDescuentos = state.descuentosOC.reduce((s, d) => s + (d.montoUSD || 0), 0);
  const totalImpuestos = state.impuestosOC.reduce((s, i) => s + (i.montoUSD || 0), 0);
  const grandTotal = subtotal + totalCargos - totalDescuentos + totalImpuestos;
  const totalPEN = state.tcCompra > 0 ? grandTotal * state.tcCompra : 0;

  const prodColumns: DataTableColumn<ProductoOrden>[] = [
    { key: 'sku', header: 'SKU', render: p => <span className="font-mono text-xs">{p.sku}</span> },
    { key: 'producto', header: 'Producto', render: p => (
      <div>
        <span className="font-medium text-slate-900">{p.nombreComercial}</span>
        {p.marca && <span className="text-xs text-slate-500 ml-1">({p.marca})</span>}
      </div>
    )},
    { key: 'cantidad', header: 'Cant.', align: 'center', render: p => p.cantidad },
    { key: 'precio', header: 'Precio USD', align: 'right', render: p => `$${(p.costoUnitario || 0).toFixed(2)}` },
    { key: 'subtotal', header: 'Subtotal', align: 'right', render: p => (
      <span className="font-medium">${((p.costoUnitario || 0) * (p.cantidad || 0)).toFixed(2)}</span>
    )},
  ];

  // Suppress unused variable warning — config is derived for potential future use
  void config;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Resumen de la Orden</h2>
        <p className="text-sm text-slate-500 mt-1">Revisa los datos antes de guardar</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Delivery + Provider info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                <ModoIcon className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Modo de entrega</p>
                <p className="text-sm font-semibold text-slate-900">
                  {state.modoEntregaDetallado ? modoLabels[state.modoEntregaDetallado] : '-'}
                </p>
              </div>
            </div>
            {state.quienPagaFlete && (
              <div className="flex items-center gap-2 text-xs text-slate-600 pl-[52px]">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Flete: {fleteLabels[state.quienPagaFlete]}
              </div>
            )}
            {state.colaboradorNombre && (
              <div className="flex items-center gap-2 text-xs text-slate-600 pl-[52px] mt-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                {state.colaboradorNombre}
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Proveedor</p>
                <p className="text-sm font-semibold text-slate-900">{state.proveedorNombre || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 pl-[52px] mt-2">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {state.paisOrigen || '-'}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                TC: {state.tcCompra > 0 ? state.tcCompra.toFixed(3) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Products table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Productos ({state.productos.length})
            </h3>
          </div>
          <DataTable
            columns={prodColumns}
            data={state.productos}
            keyExtractor={(p) => p.productoId || p.sku}
            compact
            emptyMessage="Sin productos"
          />
        </div>

        {/* Totals */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal productos</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          {state.cargosOC.map(c => (
            <div key={c.id} className="flex justify-between text-sm text-amber-700">
              <span>+ {c.concepto || 'Cargo'}</span>
              <span>${c.montoUSD.toFixed(2)}</span>
            </div>
          ))}
          {state.descuentosOC.map(d => (
            <div key={d.id} className="flex justify-between text-sm text-emerald-700">
              <span>- {d.concepto || 'Descuento'}</span>
              <span>-${d.montoUSD.toFixed(2)}</span>
            </div>
          ))}
          {state.impuestosOC.map(i => (
            <div key={i.id} className="flex justify-between text-sm text-sky-700">
              <span>+ {i.concepto || 'Impuesto'}</span>
              <span>${i.montoUSD.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200">
            <span>Total USD</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
          {totalPEN > 0 && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>Estimado PEN (TC {state.tcCompra.toFixed(3)})</span>
              <span>S/ {totalPEN.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Observations */}
        {state.observaciones && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <p className="text-xs text-sky-800 font-medium mb-1">Observaciones</p>
            <p className="text-sm text-sky-900">{state.observaciones}</p>
          </div>
        )}
      </div>
    </div>
  );
};
