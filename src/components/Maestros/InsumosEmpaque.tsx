import React, { useEffect } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { useInsumoStore } from '../../store/insumoStore';
import { Card, Badge } from '../common';

export const InsumosEmpaque: React.FC = () => {
  const { insumos, insumosStockBajo, loading, fetchInsumos } = useInsumoStore();

  useEffect(() => {
    fetchInsumos();
  }, [fetchInsumos]);

  if (loading && insumos.length === 0) {
    return <div className="text-center py-8 text-gray-500">Cargando insumos...</div>;
  }

  if (insumos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Sin insumos registrados</p>
        <p className="text-sm mt-1">Los insumos de empaque se configurar\u00e1n en una pr\u00f3xima actualizaci\u00f3n.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerta de stock bajo */}
      {insumosStockBajo.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">{insumosStockBajo.length} insumo(s) con stock bajo:</span>
            {' '}{insumosStockBajo.map(i => i.nombre).join(', ')}
          </div>
        </div>
      )}

      {/* Lista de insumos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insumos.map(insumo => (
          <Card key={insumo.id} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900 text-sm">{insumo.nombre}</div>
                <div className="text-xs text-gray-500 mt-0.5">{insumo.codigo} &middot; {insumo.tipo}</div>
              </div>
              <Badge
                variant={insumo.stockActual < insumo.stockMinimo ? 'danger' : 'success'}
                className="text-xs"
              >
                {insumo.stockActual} {insumo.unidadMedida}
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>Min: {insumo.stockMinimo}</span>
              <span>S/{insumo.costoUnitarioPEN.toFixed(2)}/{insumo.unidadMedida}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
