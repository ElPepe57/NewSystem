import React, { useMemo, useState } from 'react';
import { BarChart3, Package, Tag, AlertTriangle, TrendingUp } from 'lucide-react';
import { Modal } from '../../common';
import type { Producto } from '../../../types/producto.types';
import { TIPO_PRODUCTO_SKC_LABELS } from '../../../types/producto.types';

interface DashboardCatalogoProps {
  isOpen: boolean;
  onClose: () => void;
  productos: Producto[];
}

interface Distribucion {
  label: string;
  count: number;
  porcentaje: number;
}

function buildDistribucion(items: string[]): Distribucion[] {
  const freq: Record<string, number> = {};
  for (const item of items) {
    if (!item) continue;
    freq[item] = (freq[item] || 0) + 1;
  }
  const total = items.filter(Boolean).length || 1;
  return Object.entries(freq)
    .map(([label, count]) => ({ label, count, porcentaje: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function DistribucionChart({ data, color, emptyMessage }: { data: Distribucion[]; color: string; emptyMessage: string }) {
  if (data.length === 0) return <p className="text-xs text-gray-400 italic">{emptyMessage}</p>;
  const max = Math.max(...data.map(d => d.count));
  return (
    <div className="space-y-1.5">
      {data.slice(0, 10).map(d => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-28 truncate text-right">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-700 w-8 text-right">{d.count}</span>
          <span className="text-[10px] text-gray-400 w-10 text-right">{d.porcentaje}%</span>
        </div>
      ))}
    </div>
  );
}

export const DashboardCatalogo: React.FC<DashboardCatalogoProps> = ({ isOpen, onClose, productos }) => {
  const [tab, setTab] = useState<'SUP' | 'SKC'>('SUP');

  const productosSUP = useMemo(() => productos.filter(p => {
    const ln = (p.lineaNegocioNombre || '').toLowerCase();
    return ln.includes('suplement') || (!p.atributosSkincare && !ln.includes('skincare'));
  }), [productos]);

  const productosSKC = useMemo(() => productos.filter(p => {
    return !!p.atributosSkincare || (p.lineaNegocioNombre || '').toLowerCase().includes('skincare');
  }), [productos]);

  // === SUP Analytics ===
  const supPorPresentacion = useMemo(() => buildDistribucion(productosSUP.map(p => p.presentacion || '')), [productosSUP]);
  const supPorMarca = useMemo(() => buildDistribucion(productosSUP.map(p => p.marca || '')), [productosSUP]);
  const supPorCategoria = useMemo(() => {
    const cats = productosSUP.flatMap(p => (p.categorias || []).map((c: any) => c.nombre));
    return buildDistribucion(cats);
  }, [productosSUP]);

  // === SKC Analytics ===
  const skcPorTipo = useMemo(() => {
    return buildDistribucion(productosSKC.map(p => {
      const tipo = p.atributosSkincare?.tipoProductoSKC;
      return tipo ? (TIPO_PRODUCTO_SKC_LABELS[tipo] || tipo) : (p.presentacion || 'Sin tipo');
    }));
  }, [productosSKC]);

  const skcPorIngrediente = useMemo(() => {
    return buildDistribucion(productosSKC.map(p => p.atributosSkincare?.ingredienteClave || p.dosaje || '').filter(Boolean));
  }, [productosSKC]);

  const skcPorMarca = useMemo(() => buildDistribucion(productosSKC.map(p => p.marca || '')), [productosSKC]);

  const skcPorLineaProducto = useMemo(() => {
    return buildDistribucion(productosSKC.map(p => p.atributosSkincare?.lineaProducto || '').filter(Boolean));
  }, [productosSKC]);

  // === Gaps detection ===
  const supGaps = useMemo(() => {
    const gaps: string[] = [];
    const presentaciones = new Set(productosSUP.map(p => (p.presentacion || '').toLowerCase()));
    if (!presentaciones.has('polvo')) gaps.push('No tienes productos en polvo');
    if (!presentaciones.has('liquido')) gaps.push('No tienes productos líquidos');
    if (!presentaciones.has('gomitas') || supPorPresentacion.find(p => p.label.toLowerCase() === 'gomitas')?.count === 1) {
      if (!presentaciones.has('gomitas')) gaps.push('No tienes gomitas');
    }
    const marcaCounts = supPorMarca;
    if (marcaCounts.length > 0 && marcaCounts[0].porcentaje > 40) {
      gaps.push(`${marcaCounts[0].label} tiene ${marcaCounts[0].porcentaje}% del catálogo — considerar diversificar`);
    }
    if (productosSUP.length < 10) gaps.push('Catálogo pequeño — considerar ampliar');
    return gaps;
  }, [productosSUP, supPorPresentacion, supPorMarca]);

  const skcGaps = useMemo(() => {
    const gaps: string[] = [];
    const tipos = new Set(productosSKC.map(p => (p.atributosSkincare?.tipoProductoSKC || p.presentacion || '').toLowerCase()));
    const tiposEsperados = ['serum', 'crema', 'tonico', 'limpiador', 'protector_solar', 'mascarilla'];
    for (const t of tiposEsperados) {
      const label = TIPO_PRODUCTO_SKC_LABELS[t as keyof typeof TIPO_PRODUCTO_SKC_LABELS] || t;
      if (!tipos.has(t) && !tipos.has(label.toLowerCase())) {
        gaps.push(`No tienes ${label}`);
      }
    }
    if (skcPorTipo.length > 0 && skcPorTipo.find(t => t.label.toLowerCase().includes('protector'))?.count === 1) {
      gaps.push('Solo 1 protector solar — considerar fortalecer');
    }
    if (productosSKC.length === 0) gaps.push('Sin productos SKC — línea por desarrollar');
    return gaps;
  }, [productosSKC, skcPorTipo]);

  const activos = tab === 'SUP' ? productosSUP : productosSKC;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inteligencia de Catálogo" size="lg">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setTab('SUP')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === 'SUP' ? 'bg-blue-100 text-blue-800 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Suplementos ({productosSUP.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('SKC')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === 'SKC' ? 'bg-pink-100 text-pink-800 border-b-2 border-pink-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Skincare ({productosSKC.length})
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <Package className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-800">{activos.length}</p>
            <p className="text-[10px] text-blue-600">Productos</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Tag className="h-5 w-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-purple-800">
              {new Set(activos.map(p => p.marca)).size}
            </p>
            <p className="text-[10px] text-purple-600">Marcas</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-800">
              {activos.filter(p => p.investigacion).length}
            </p>
            <p className="text-[10px] text-green-600">Con investigación</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-800">
              {(tab === 'SUP' ? supGaps : skcGaps).length}
            </p>
            <p className="text-[10px] text-amber-600">Gaps detectados</p>
          </div>
        </div>

        {/* Distribuciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tab === 'SUP' ? (
            <>
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Presentación
                </h4>
                <DistribucionChart data={supPorPresentacion} color="bg-blue-500" emptyMessage="Sin datos" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Marca
                </h4>
                <DistribucionChart data={supPorMarca} color="bg-purple-500" emptyMessage="Sin datos" />
              </div>
              <div className="sm:col-span-2">
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Categoría
                </h4>
                <DistribucionChart data={supPorCategoria} color="bg-green-500" emptyMessage="Sin categorías asignadas" />
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Tipo
                </h4>
                <DistribucionChart data={skcPorTipo} color="bg-pink-500" emptyMessage="Sin productos SKC" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Ingrediente
                </h4>
                <DistribucionChart data={skcPorIngrediente} color="bg-green-500" emptyMessage="Sin ingredientes" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Marca
                </h4>
                <DistribucionChart data={skcPorMarca} color="bg-purple-500" emptyMessage="Sin datos" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Por Línea Producto
                </h4>
                <DistribucionChart data={skcPorLineaProducto} color="bg-blue-500" emptyMessage="Sin líneas asignadas" />
              </div>
            </>
          )}
        </div>

        {/* Gaps */}
        {(tab === 'SUP' ? supGaps : skcGaps).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Oportunidades detectadas
            </h4>
            <ul className="space-y-1">
              {(tab === 'SUP' ? supGaps : skcGaps).map((gap, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};
