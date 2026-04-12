import React from 'react';
import { Plus, Trash2, DollarSign, Tag, Receipt } from 'lucide-react';
import { cn } from '../../../../design-system';
import type { CargoOC, DescuentoOC, ImpuestoOC } from '../../../../types/ordenCompra.types';

interface WizardStepCargosProps {
  cargos: CargoOC[];
  descuentos: DescuentoOC[];
  impuestos: ImpuestoOC[];
  subtotalProductos: number;
  onAddCargo: (cargo: CargoOC) => void;
  onRemoveCargo: (id: string) => void;
  onUpdateCargo: (cargo: CargoOC) => void;
  onAddDescuento: (descuento: DescuentoOC) => void;
  onRemoveDescuento: (id: string) => void;
  onUpdateDescuento: (descuento: DescuentoOC) => void;
  onAddImpuesto: (impuesto: ImpuestoOC) => void;
  onRemoveImpuesto: (id: string) => void;
  onUpdateImpuesto: (impuesto: ImpuestoOC) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function LineItem<T extends { id: string; concepto: string; montoUSD: number }>({
  item,
  onUpdate,
  onRemove,
  color,
  showProrrateo,
}: {
  item: T;
  onUpdate: (updated: T) => void;
  onRemove: (id: string) => void;
  color: string;
  showProrrateo?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={item.concepto}
        onChange={e => onUpdate({ ...item, concepto: e.target.value })}
        placeholder="Concepto..."
        className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
      />
      <div className="relative w-32 flex-shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input
          type="number"
          step="0.01"
          value={item.montoUSD || ''}
          onChange={e => onUpdate({ ...item, montoUSD: parseFloat(e.target.value) || 0 })}
          placeholder="0.00"
          className={cn(
            'w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-200 text-right font-medium',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
            color
          )}
        />
      </div>
      {showProrrateo && 'metodoProrrateo' in item && (
        <select
          value={(item as CargoOC).metodoProrrateo}
          onChange={e => onUpdate({ ...item, metodoProrrateo: e.target.value as CargoOC['metodoProrrateo'] } as T)}
          className="w-28 flex-shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-xs focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        >
          <option value="por_valor">Por valor</option>
          <option value="por_peso">Por peso</option>
          <option value="por_cantidad">Por cant.</option>
        </select>
      )}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  color,
  children,
  onAdd,
  addLabel,
}: {
  title: string;
  icon: typeof DollarSign;
  color: string;
  children: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', color)} />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {addLabel}
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export const WizardStepCargos: React.FC<WizardStepCargosProps> = ({
  cargos, descuentos, impuestos, subtotalProductos,
  onAddCargo, onRemoveCargo, onUpdateCargo,
  onAddDescuento, onRemoveDescuento, onUpdateDescuento,
  onAddImpuesto, onRemoveImpuesto, onUpdateImpuesto,
}) => {
  const totalCargos = cargos.reduce((s, c) => s + (c.montoUSD || 0), 0);
  const totalDescuentos = descuentos.reduce((s, d) => s + (d.montoUSD || 0), 0);
  const totalImpuestos = impuestos.reduce((s, i) => s + (i.montoUSD || 0), 0);
  const grandTotal = subtotalProductos + totalCargos - totalDescuentos + totalImpuestos;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Cargos, Descuentos e Impuestos</h2>
        <p className="text-sm text-slate-500 mt-1">Agrega los conceptos de la factura del proveedor (estilo Amazon)</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Cargos */}
        <Section
          title="Cargos adicionales"
          icon={DollarSign}
          color="text-amber-600"
          onAdd={() => onAddCargo({ id: generateId(), concepto: '', montoUSD: 0, metodoProrrateo: 'por_valor' })}
          addLabel="Agregar cargo"
        >
          {cargos.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Sin cargos adicionales (ej: Shipping &amp; Handling)</p>
          ) : (
            cargos.map(c => (
              <LineItem key={c.id} item={c} onUpdate={onUpdateCargo} onRemove={onRemoveCargo} color="text-amber-700" showProrrateo />
            ))
          )}
        </Section>

        {/* Descuentos */}
        <Section
          title="Descuentos"
          icon={Tag}
          color="text-emerald-600"
          onAdd={() => onAddDescuento({ id: generateId(), concepto: '', montoUSD: 0, metodoProrrateo: 'proporcional' })}
          addLabel="Agregar descuento"
        >
          {descuentos.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Sin descuentos (ej: Subscribe &amp; Save)</p>
          ) : (
            descuentos.map(d => (
              <LineItem key={d.id} item={d} onUpdate={onUpdateDescuento} onRemove={onRemoveDescuento} color="text-emerald-700" />
            ))
          )}
        </Section>

        {/* Impuestos */}
        <Section
          title="Impuestos del proveedor"
          icon={Receipt}
          color="text-sky-600"
          onAdd={() => onAddImpuesto({ id: generateId(), concepto: '', montoUSD: 0 })}
          addLabel="Agregar impuesto"
        >
          {impuestos.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Sin impuestos (ej: Sales Tax CA)</p>
          ) : (
            impuestos.map(i => (
              <LineItem key={i.id} item={i} onUpdate={onUpdateImpuesto} onRemove={onRemoveImpuesto} color="text-sky-700" />
            ))
          )}
        </Section>

        {/* Total */}
        <div className="border-t-2 border-slate-200 pt-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal productos</span>
              <span className="font-medium">${subtotalProductos.toFixed(2)}</span>
            </div>
            {totalCargos > 0 && (
              <div className="flex justify-between text-sm text-amber-700">
                <span>+ Cargos</span>
                <span className="font-medium">${totalCargos.toFixed(2)}</span>
              </div>
            )}
            {totalDescuentos > 0 && (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>- Descuentos</span>
                <span className="font-medium">-${totalDescuentos.toFixed(2)}</span>
              </div>
            )}
            {totalImpuestos > 0 && (
              <div className="flex justify-between text-sm text-sky-700">
                <span>+ Impuestos</span>
                <span className="font-medium">${totalImpuestos.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total OC</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
