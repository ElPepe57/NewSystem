import React, { useState, useMemo } from 'react';
import { Link2, Search, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../../common';
import { ProductoService } from '../../../services/producto.service';
import { useProductoStore } from '../../../store/productoStore';
import { useToastStore } from '../../../store/toastStore';
import type { Producto } from '../../../types/producto.types';

interface VincularUPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onLinked: (producto: Producto) => void;
}

export const VincularUPCModal: React.FC<VincularUPCModalProps> = ({
  isOpen,
  onClose,
  barcode,
  onLinked,
}) => {
  const toast = useToastStore();
  const { productos } = useProductoStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return productos
      .filter(p => p.estado === 'activo')
      .filter(p =>
        p.sku?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q) ||
        p.nombreComercial?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [search, productos]);

  const handleVincular = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await ProductoService.update(selected.id, { codigoUPC: barcode });
      toast.success(`UPC vinculado a ${selected.marca} ${selected.nombreComercial}`);
      const updated = { ...selected, codigoUPC: barcode };
      onLinked(updated);
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al vincular UPC');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelected(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Vincular Codigo de Barras" size="md">
      <div className="space-y-4">
        {/* Barcode info */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Link2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">Codigo a vincular</p>
            <p className="font-mono text-sm text-blue-700">{barcode}</p>
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar producto existente
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="SKU, marca o nombre..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
        </div>

        {/* Results list */}
        {filtered.length > 0 && !selected && (
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.marca} {p.nombreComercial}
                  </p>
                  <p className="text-xs text-gray-500">
                    SKU: {p.sku}
                    {p.codigoUPC && <span className="ml-2 text-amber-600">UPC: {p.codigoUPC}</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && filtered.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No se encontraron productos</p>
        )}

        {/* Selected product */}
        {selected && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-900">
              {selected.marca} {selected.nombreComercial}
            </p>
            <p className="text-xs text-green-700">SKU: {selected.sku}</p>

            {selected.codigoUPC && (
              <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Este producto ya tiene UPC: <span className="font-mono">{selected.codigoUPC}</span>. Se reemplazara.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleVincular}
            disabled={!selected || saving}
          >
            {saving ? 'Vinculando...' : 'Vincular'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
