import React, { useMemo, useState } from 'react';
import {
  ShoppingCart, Package, Search, CheckSquare, Square,
  AlertCircle, ArrowRight, X, Layers,
} from 'lucide-react';
import { Button } from '../../common/Button';
import { Modal } from '../../common/Modal';
import type { Requerimiento, ProductoRequerimiento } from '../../../types/requerimiento.types';

interface PendienteItem {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  pendienteTotal: number;
  costoEstimadoUSD: number;
  proveedorSugerido?: string;
  origenes: Array<{
    requerimientoId: string;
    requerimientoNumero: string;
    clienteNombre: string;
    cantidad: number;
    cotizacionId?: string;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requerimientos: Requerimiento[];
  onEnviarAlBuilder: (requerimientos: Requerimiento[]) => void;
}

export const PendientesCompraPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  requerimientos,
  onEnviarAlBuilder,
}) => {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Build pending items from all requerimientos with pending products
  const pendientes = useMemo<PendienteItem[]>(() => {
    const map = new Map<string, PendienteItem>();

    for (const req of requerimientos) {
      // Only aprobado or parcial states
      if (req.estado !== 'aprobado' && req.estado !== 'parcial') continue;
      if (!req.productos) continue;

      for (const p of req.productos) {
        const cantidadEnOC = p.cantidadEnOC || 0;
        const pendiente = p.cantidadSolicitada - cantidadEnOC;
        if (pendiente <= 0) continue;

        const existing = map.get(p.productoId);
        const origen = {
          requerimientoId: req.id!,
          requerimientoNumero: req.numeroRequerimiento,
          clienteNombre: req.nombreSolicitante || req.nombreClienteSolicitante || 'Admin',
          cantidad: pendiente,
          cotizacionId: req.cotizacionId || (req as any).ventaRelacionadaId,
        };

        if (existing) {
          existing.pendienteTotal += pendiente;
          existing.origenes.push(origen);
          if (p.precioEstimadoUSD && p.precioEstimadoUSD > existing.costoEstimadoUSD) {
            existing.costoEstimadoUSD = p.precioEstimadoUSD;
          }
        } else {
          map.set(p.productoId, {
            productoId: p.productoId,
            sku: p.sku,
            marca: p.marca,
            nombreComercial: p.nombreComercial,
            presentacion: p.presentacion || '',
            pendienteTotal: pendiente,
            costoEstimadoUSD: p.precioEstimadoUSD || 0,
            proveedorSugerido: p.proveedorSugerido,
            origenes: [origen],
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.pendienteTotal - a.pendienteTotal);
  }, [requerimientos]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return pendientes;
    const term = searchTerm.toLowerCase();
    return pendientes.filter(p =>
      p.sku.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term) ||
      p.nombreComercial.toLowerCase().includes(term) ||
      p.proveedorSugerido?.toLowerCase().includes(term)
    );
  }, [pendientes, searchTerm]);

  const toggleProduct = (productoId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      next.has(productoId) ? next.delete(productoId) : next.add(productoId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProductIds.size === filtered.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filtered.map(p => p.productoId)));
    }
  };

  const handleEnviar = () => {
    if (selectedProductIds.size === 0) return;

    // Find all reqs that have at least one selected product with pending items
    const selectedItems = pendientes.filter(p => selectedProductIds.has(p.productoId));
    const reqIdsNeeded = new Set<string>();
    for (const item of selectedItems) {
      for (const o of item.origenes) {
        reqIdsNeeded.add(o.requerimientoId);
      }
    }

    const reqsToSend = requerimientos.filter(r => reqIdsNeeded.has(r.id!));
    onEnviarAlBuilder(reqsToSend);
    setSelectedProductIds(new Set());
    onClose();
  };

  // Stats
  const totalPendiente = pendientes.reduce((s, p) => s + p.pendienteTotal, 0);
  const totalEstimadoUSD = pendientes.reduce((s, p) => s + p.pendienteTotal * p.costoEstimadoUSD, 0);
  const selectedCount = selectedProductIds.size;
  const selectedUnits = pendientes
    .filter(p => selectedProductIds.has(p.productoId))
    .reduce((s, p) => s + p.pendienteTotal, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pendientes de Compra"
      subtitle={`${pendientes.length} productos · ${totalPendiente} uds · ~$${totalEstimadoUSD.toFixed(0)} USD`}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-sm text-gray-500">
            {selectedCount > 0 ? (
              <span className="text-primary-600 font-medium">
                {selectedCount} producto(s), {selectedUnits} uds seleccionadas
              </span>
            ) : (
              'Selecciona productos para enviar al OC Builder'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            <Button
              variant="primary"
              onClick={handleEnviar}
              disabled={selectedCount === 0}
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Enviar al OC Builder
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {pendientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No hay productos pendientes</p>
            <p className="text-xs mt-1">Todos los productos de requerimientos aprobados ya tienen OC</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por SKU, marca, nombre..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Select all */}
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600"
              >
                {selectedProductIds.size === filtered.length && filtered.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-primary-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Seleccionar todos
              </button>
              <span className="text-xs text-gray-400">({filtered.length} productos)</span>
            </div>

            {/* Product list */}
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {filtered.map(item => {
                const isSelected = selectedProductIds.has(item.productoId);
                return (
                  <div
                    key={item.productoId}
                    onClick={() => toggleProduct(item.productoId)}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary-600" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-400 font-mono">{item.sku}</span>
                          {item.proveedorSugerido && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              {item.proveedorSugerido}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.marca} - {item.nombreComercial}
                        </p>

                        {/* Origenes */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.origenes.map((o, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                            >
                              <span className="font-medium">{o.requerimientoNumero}</span>
                              <span className="text-gray-400">·</span>
                              <span>{o.cantidad} ud</span>
                              {o.clienteNombre && (
                                <>
                                  <span className="text-gray-400">·</span>
                                  <span className="truncate max-w-[80px]">{o.clienteNombre}</span>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {item.pendienteTotal} ud
                        </div>
                        {item.costoEstimadoUSD > 0 && (
                          <div className="text-xs text-gray-500">
                            ~${(item.pendienteTotal * item.costoEstimadoUSD).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
