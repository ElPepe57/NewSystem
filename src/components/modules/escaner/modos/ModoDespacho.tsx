import React, { useState, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { ShoppingBag, FileText, ShoppingCart } from 'lucide-react';
import { DespachoML, type DespachoMLHandle } from './DespachoML';
import { DespachoCotizacion, type DespachoCotizacionHandle } from './DespachoCotizacion';
import { DespachoVentaDirecta, type DespachoVentaDirectaHandle } from './DespachoVentaDirecta';
import type { DespachoTipo } from '../../../../types/escanerModos.types';

export interface ModoDespachoHandle {
  handleScan: (barcode: string, format?: string) => void;
}

const SUB_TABS: { id: DespachoTipo; label: string; icon: React.ReactNode }[] = [
  { id: 'ml_order', label: 'ML', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  { id: 'cotizacion', label: 'Cotizacion', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'venta_directa', label: 'Venta', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
];

export const ModoDespacho = forwardRef<ModoDespachoHandle>((_props, ref) => {
  const [activeTab, setActiveTab] = useState<DespachoTipo>('ml_order');

  const mlRef = useRef<DespachoMLHandle>(null);
  const cotizacionRef = useRef<DespachoCotizacionHandle>(null);
  const ventaDirectaRef = useRef<DespachoVentaDirectaHandle>(null);

  const handleScan = useCallback((barcode: string, format?: string) => {
    switch (activeTab) {
      case 'ml_order':
        mlRef.current?.handleScan(barcode, format);
        break;
      case 'cotizacion':
        cotizacionRef.current?.handleScan(barcode, format);
        break;
      case 'venta_directa':
        ventaDirectaRef.current?.handleScan(barcode, format);
        break;
    }
  }, [activeTab]);

  useImperativeHandle(ref, () => ({ handleScan }), [handleScan]);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active sub-component — conditional render to avoid eager data loading */}
      {activeTab === 'ml_order' && <DespachoML ref={mlRef} />}
      {activeTab === 'cotizacion' && <DespachoCotizacion ref={cotizacionRef} />}
      {activeTab === 'venta_directa' && <DespachoVentaDirecta ref={ventaDirectaRef} />}
    </div>
  );
});

ModoDespacho.displayName = 'ModoDespacho';
