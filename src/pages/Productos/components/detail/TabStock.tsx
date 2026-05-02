/**
 * TabStock · Tab "Stock" del modal detalle producto
 *
 * Mockup canónico: docs/mockups/productos/15-modal-detalle-stock.html
 *
 * Secciones (ambas en stack vertical · responsive nativo):
 *   1. Stock por almacén (lista con barra de % del total)
 *   2. Stock por variante (mini-tabla compacta)
 *   3. Banner reorden sugerido (cuando hay variante crítica)
 *
 * Nota Gap S2 #6: chart histórico ventas + movimientos viven en tab Histórico (15b · Fase 5),
 * NO en este tab.
 */

import React, { useMemo } from 'react';
import { Warehouse, Building, Globe, GitBranch, AlertTriangle } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';

interface TabStockProps {
  producto: Producto;
  hermanasGrupo: Producto[];
}

interface AlmacenStock {
  nombre: string;
  ubicacion?: string;
  uds: number;
  tipo: 'almacen' | 'casilla' | 'transito';
}

const PALETTE = ['#0d9488', '#f59e0b', '#8b5cf6', '#a855f7', '#0ea5e9'];

function getStock(p: Producto): number {
  return (p as any).stockDisponible ?? (p as any).stockTotal ?? 0;
}

function getVarianteLabel(p: Producto): string {
  return p.varianteLabel ?? p.contenido ?? p.dosaje ?? '—';
}

function getNumeroVariante(p: Producto): string {
  const label = getVarianteLabel(p);
  const m = label.match(/(\d+)/);
  return m ? m[1] : label.slice(0, 3);
}

export const TabStock: React.FC<TabStockProps> = ({ producto, hermanasGrupo }) => {
  // Sumar stock del grupo para el total general
  const variantes = hermanasGrupo.length > 0 ? hermanasGrupo : [producto];
  const stockTotalGrupo = variantes.reduce((acc, v) => acc + getStock(v), 0);

  // Stock por "almacén" · construido desde campos del Producto
  const almacenes: AlmacenStock[] = useMemo(() => {
    const lista: AlmacenStock[] = [];
    const stockPeru = (producto as any).stockPeru ?? 0;
    const stockDisponiblePeru = (producto as any).stockDisponiblePeru ?? stockPeru;
    const stockUSA = (producto as any).stockUSA ?? 0;
    const stockTransito = (producto as any).stockTransito ?? 0;

    if (stockDisponiblePeru > 0 || stockPeru > 0) {
      lista.push({
        nombre: 'Almacén Lima',
        ubicacion: 'Almacén principal Perú',
        uds: stockDisponiblePeru,
        tipo: 'almacen',
      });
    }
    if (stockUSA > 0) {
      lista.push({
        nombre: 'Casilla USA',
        ubicacion: 'Tránsito internacional',
        uds: stockUSA,
        tipo: 'casilla',
      });
    }
    if (stockTransito > 0) {
      lista.push({
        nombre: 'En tránsito',
        ubicacion: 'Marítimo · Pacífico',
        uds: stockTransito,
        tipo: 'transito',
      });
    }
    if (lista.length === 0 && stockTotalGrupo > 0) {
      // Fallback: solo Lima
      lista.push({
        nombre: 'Almacén Lima',
        ubicacion: 'Ubicación principal',
        uds: stockTotalGrupo,
        tipo: 'almacen',
      });
    }
    return lista;
  }, [producto, stockTotalGrupo]);

  const totalAlmacenes = useMemo(() => almacenes.reduce((a, x) => a + x.uds, 0), [almacenes]);

  // Variante crítica para banner
  const varianteCritica = useMemo(() => {
    return variantes.find(v => {
      const stock = getStock(v);
      const min = v.stockMinimo ?? 0;
      return min > 0 && stock <= min;
    });
  }, [variantes]);

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-4 max-h-[calc(90vh-220px)] lg:max-h-[480px] overflow-y-auto">
      {/* 1. Stock por almacén */}
      {almacenes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-violet-600" />
              Stock por almacén
            </h4>
            <span className="text-[10px] text-slate-500 tabular-nums">
              {totalAlmacenes} uds · {almacenes.length} ubicaciones
            </span>
          </div>
          <div className="space-y-2">
            {almacenes.map((a, i) => {
              const pct = totalAlmacenes > 0 ? (a.uds / totalAlmacenes) * 100 : 0;
              const config = getAlmacenStyles(a.tipo);
              const Icon = config.icon;
              return (
                <div key={i} className="flex items-center gap-3 flex-wrap">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                    <Icon className={`w-4 h-4 ${config.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{a.nombre}</div>
                    {a.ubicacion && <div className="text-[10px] text-slate-500 truncate">{a.ubicacion}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">{a.uds} uds</div>
                    <div className={`text-[10px] tabular-nums ${config.text}`}>{Math.round(pct)}%</div>
                  </div>
                  <div className="w-full sm:w-32 flex-shrink-0">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${config.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Stock por variante (mini-tabla) */}
      {variantes.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-teal-600" />
            Stock por variante
          </h4>
          <div className="space-y-1.5">
            {variantes.map((v, idx) => {
              const stock = getStock(v);
              const stockMin = v.stockMinimo ?? 0;
              const isCritico = stockMin > 0 && stock <= stockMin;
              return (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums"
                      style={{ background: PALETTE[idx % PALETTE.length] }}
                    >
                      {getNumeroVariante(v)}
                    </span>
                    <span className="text-slate-700 truncate">{getVarianteLabel(v)}</span>
                  </div>
                  <span
                    className={`font-bold tabular-nums flex items-center gap-1 flex-shrink-0 ${
                      isCritico ? 'text-rose-700' : 'text-slate-900'
                    }`}
                  >
                    {isCritico && <AlertTriangle className="w-3 h-3" />}
                    {stock} uds
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Banner reorden sugerido */}
      {varianteCritica && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-amber-900">
              Considerar reordenar variante {getVarianteLabel(varianteCritica)}
            </div>
            <div className="text-amber-700 mt-0.5">
              Solo {getStock(varianteCritica)} uds en stock. Lead time del proveedor puede demorar 22-45 días.
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío · sin stock en ningún lado */}
      {almacenes.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Warehouse className="w-6 h-6 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Sin stock disponible</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Este producto no tiene stock en ningún almacén ni casilla. Crear una OC para reabastecer.
          </p>
        </div>
      )}
    </div>
  );
};

function getAlmacenStyles(tipo: AlmacenStock['tipo']) {
  switch (tipo) {
    case 'casilla':
      return { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', icon: Globe };
    case 'transito':
      return { bg: 'bg-sky-50', text: 'text-sky-700', bar: 'bg-sky-500', icon: Building };
    case 'almacen':
    default:
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', icon: Building };
  }
}
