import React, { useMemo, useState } from 'react';
import { AlertTriangle, Trash2, Eye, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Modal, Button, Card } from '../../common';
import type { Producto } from '../../../types/producto.types';

interface GrupoDuplicados {
  key: string;
  productos: Producto[];
  tipo: 'exacto' | 'similar';
  razon: string;
}

interface DuplicadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  productos: Producto[];
  onVerProducto: (producto: Producto) => void;
  onEliminarProducto: (producto: Producto) => void;
}

export const DuplicadosModal: React.FC<DuplicadosModalProps> = ({
  isOpen,
  onClose,
  productos,
  onVerProducto,
  onEliminarProducto
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'exacto' | 'similar'>('todos');

  // Detectar duplicados
  const gruposDuplicados = useMemo((): GrupoDuplicados[] => {
    const grupos: GrupoDuplicados[] = [];
    const productosArr = Array.isArray(productos) ? productos : [];

    // 1. Duplicados EXACTOS por Marca + Nombre + Dosaje + Contenido
    const porClaveExacta = new Map<string, Producto[]>();
    productosArr.forEach(p => {
      const marca = (p.marca ?? '').toLowerCase().trim();
      const nombre = (p.nombreComercial ?? '').toLowerCase().trim();
      const dosaje = (p.dosaje ?? '').toLowerCase().trim();
      const contenido = (p.contenido ?? '').toLowerCase().trim();
      const key = `${marca}|${nombre}|${dosaje}|${contenido}`;

      if (!porClaveExacta.has(key)) {
        porClaveExacta.set(key, []);
      }
      porClaveExacta.get(key)!.push(p);
    });

    porClaveExacta.forEach((prods, key) => {
      if (prods.length > 1) {
        const [marca, nombre] = key.split('|');
        grupos.push({
          key: `exacto-${key}`,
          productos: prods,
          tipo: 'exacto',
          razon: `Misma marca, nombre, dosaje y contenido`
        });
      }
    });

    // 2. Duplicados por SKU (si hay SKUs repetidos)
    const porSKU = new Map<string, Producto[]>();
    productosArr.forEach(p => {
      const sku = (p.sku ?? '').toLowerCase().trim();
      if (!sku) return;

      if (!porSKU.has(sku)) {
        porSKU.set(sku, []);
      }
      porSKU.get(sku)!.push(p);
    });

    porSKU.forEach((prods, sku) => {
      if (prods.length > 1) {
        // Verificar que no esté ya en duplicados exactos
        const yaExiste = grupos.some(g =>
          g.tipo === 'exacto' &&
          g.productos.every(p => prods.some(p2 => p2.id === p.id))
        );
        if (!yaExiste) {
          grupos.push({
            key: `sku-${sku}`,
            productos: prods,
            tipo: 'exacto',
            razon: `Mismo SKU: ${sku.toUpperCase()}`
          });
        }
      }
    });

    // 3. Similares: Misma marca + nombre similar (sin considerar dosaje/contenido)
    const porMarcaNombre = new Map<string, Producto[]>();
    productosArr.forEach(p => {
      const marca = (p.marca ?? '').toLowerCase().trim();
      const nombre = (p.nombreComercial ?? '').toLowerCase().trim();
      const key = `${marca}|${nombre}`;

      if (!porMarcaNombre.has(key)) {
        porMarcaNombre.set(key, []);
      }
      porMarcaNombre.get(key)!.push(p);
    });

    porMarcaNombre.forEach((prods, key) => {
      if (prods.length > 1) {
        // Verificar que no sean todos del mismo grupo exacto
        const todosEnExacto = prods.every(p =>
          grupos.some(g => g.tipo === 'exacto' && g.productos.some(gp => gp.id === p.id))
        );

        if (!todosEnExacto) {
          // Verificar si tienen diferentes dosajes (variaciones legítimas)
          const dosajes = new Set(prods.map(p => `${p.dosaje}-${p.contenido}`));
          if (dosajes.size < prods.length) {
            // Hay algunos con mismo dosaje = posibles duplicados
            const [marca, nombre] = key.split('|');
            grupos.push({
              key: `similar-${key}`,
              productos: prods,
              tipo: 'similar',
              razon: `Misma marca y nombre, verificar variaciones`
            });
          }
        }
      }
    });

    return grupos;
  }, [productos]);

  // Filtrar grupos según el filtro seleccionado
  const gruposFiltrados = useMemo(() => {
    if (filtroTipo === 'todos') return gruposDuplicados;
    return gruposDuplicados.filter(g => g.tipo === filtroTipo);
  }, [gruposDuplicados, filtroTipo]);

  // Contar totales
  const totalExactos = gruposDuplicados.filter(g => g.tipo === 'exacto').length;
  const totalSimilares = gruposDuplicados.filter(g => g.tipo === 'similar').length;
  const totalProductosAfectados = gruposDuplicados.reduce((sum, g) => sum + g.productos.length, 0);

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const expandirTodos = () => {
    setExpandedGroups(new Set(gruposFiltrados.map(g => g.key)));
  };

  const contraerTodos = () => {
    setExpandedGroups(new Set());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detección de Productos Duplicados"
      size="xl"
    >
      <div className="space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4">
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-red-600">{totalExactos}</div>
            <div className="text-xs text-gray-600">Duplicados Exactos</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-amber-600">{totalSimilares}</div>
            <div className="text-xs text-gray-600">Posibles Similares</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-gray-700">{totalProductosAfectados}</div>
            <div className="text-xs text-gray-600">Productos Afectados</div>
          </Card>
        </div>

        {gruposDuplicados.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-green-500 text-5xl mb-3">✓</div>
            <h3 className="text-lg font-medium text-gray-900">No se encontraron duplicados</h3>
            <p className="text-gray-600 mt-1">Tu catálogo está limpio de productos duplicados.</p>
          </div>
        ) : (
          <>
            {/* Filtros y acciones */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setFiltroTipo('todos')}
                  className={`px-3 py-1 text-sm rounded-full ${
                    filtroTipo === 'todos'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todos ({gruposDuplicados.length})
                </button>
                <button
                  onClick={() => setFiltroTipo('exacto')}
                  className={`px-3 py-1 text-sm rounded-full ${
                    filtroTipo === 'exacto'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  Exactos ({totalExactos})
                </button>
                <button
                  onClick={() => setFiltroTipo('similar')}
                  className={`px-3 py-1 text-sm rounded-full ${
                    filtroTipo === 'similar'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Similares ({totalSimilares})
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={expandirTodos}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  Expandir todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={contraerTodos}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  Contraer todos
                </button>
              </div>
            </div>

            {/* Lista de duplicados */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {gruposFiltrados.map(grupo => (
                <div
                  key={grupo.key}
                  className={`border rounded-lg overflow-hidden ${
                    grupo.tipo === 'exacto' ? 'border-red-200' : 'border-amber-200'
                  }`}
                >
                  {/* Header del grupo */}
                  <button
                    onClick={() => toggleGroup(grupo.key)}
                    className={`w-full px-4 py-3 flex items-center justify-between ${
                      grupo.tipo === 'exacto' ? 'bg-red-50' : 'bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${
                        grupo.tipo === 'exacto' ? 'text-red-500' : 'text-amber-500'
                      }`} />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">
                          {grupo.productos[0].marca} - {grupo.productos[0].nombreComercial}
                        </div>
                        <div className="text-xs text-gray-600">
                          {grupo.razon} • {grupo.productos.length} productos
                        </div>
                      </div>
                    </div>
                    {expandedGroups.has(grupo.key) ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {/* Contenido expandido */}
                  {expandedGroups.has(grupo.key) && (
                    <div className="divide-y divide-gray-100">
                      {grupo.productos.map((producto, idx) => (
                        <div
                          key={producto.id}
                          className="px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                                {producto.sku || 'Sin SKU'}
                              </span>
                              {idx === 0 && grupo.tipo === 'exacto' && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  Conservar
                                </span>
                              )}
                              {idx > 0 && grupo.tipo === 'exacto' && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  Posible eliminar
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-900 mt-1">
                              {producto.marca} - {producto.nombreComercial}
                            </div>
                            <div className="text-xs text-gray-500">
                              {producto.dosaje} • {producto.contenido} • {producto.presentacion}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onVerProducto(producto)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                              title="Ver producto"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Eliminar "${producto.marca} ${producto.nombreComercial}"?`)) {
                                  onEliminarProducto(producto);
                                }
                              }}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar producto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Advertencia */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Nota:</strong> Los duplicados "exactos" tienen la misma marca, nombre, dosaje y contenido.
              Los "similares" podrían ser variaciones legítimas del mismo producto (diferente dosaje o presentación).
              Revisa cuidadosamente antes de eliminar.
            </div>
          </>
        )}

        {/* Acciones */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
