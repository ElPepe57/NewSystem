/**
 * SeccionUnidades — Sección [3] del Paso 1 del Wizard Unificado.
 *
 * Lista las unidades disponibles en la ubicación origen elegida, agrupadas
 * por producto (SKU). Cada fila tiene un stepper +/- para elegir cuántas
 * unidades de ese SKU van al envío.
 *
 * Features:
 *   - Buscador por nombre de producto / SKU / marca
 *   - Banner de pre-vendidas (D-5 legacy) con toggle "Incluir auto"
 *   - Stepper +/- con límite en cantidad disponible
 *   - Header muestra counter "X / Y seleccionadas"
 *
 * Esta sección NO se colapsa (por diseño, puede tener N selecciones activas).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useUnidadStore } from '../../../../../store/unidadStore';
import { useProductoStore } from '../../../../../store/productoStore';
import type { UseEnvioWizardStateReturn } from '../../useEnvioWizardState';

interface Props {
  wizard: UseEnvioWizardStateReturn;
  disabled: boolean;
}

// Agrupar unidades disponibles por producto (una fila por SKU)
interface GrupoProducto {
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  cantidadDisponible: number;
  cantidadPrevendida: number;
  pesoLibras?: number;
  ocReferencia?: string; // ej. "OC-2026-001 (Amazon)"
  unidadIdsRepresentativa: string[]; // IDs para el payload del servicio
}

export const SeccionUnidades: React.FC<Props> = ({ wizard, disabled }) => {
  const { state, dispatch } = wizard;
  const { unidades, fetchUnidades } = useUnidadStore();
  const { productos, fetchProductos } = useProductoStore();
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!disabled) {
      if (unidades.length === 0) fetchUnidades();
      if (productos.length === 0) fetchProductos();
    }
  }, [disabled, unidades.length, productos.length, fetchUnidades, fetchProductos]);

  // Agrupar unidades disponibles en la ubicación origen por productoId
  const grupos = useMemo<GrupoProducto[]>(() => {
    if (!state.ubicacionOrigenId) return [];
    const unidadesEnOrigen = unidades.filter(
      u =>
        (u.casillaActualId === state.ubicacionOrigenId ||
          u.almacenId === state.ubicacionOrigenId) &&
        u.estado === 'disponible'
    );
    const grupoMap = new Map<string, GrupoProducto>();
    for (const u of unidadesEnOrigen) {
      const existente = grupoMap.get(u.productoId);
      if (existente) {
        existente.cantidadDisponible += 1;
        if (u.reservadaPara) existente.cantidadPrevendida += 1;
        existente.unidadIdsRepresentativa.push(u.id);
      } else {
        const producto = productos.find(p => p.id === u.productoId);
        grupoMap.set(u.productoId, {
          productoId: u.productoId,
          productoSKU: u.productoSKU,
          productoNombre: u.productoNombre,
          cantidadDisponible: 1,
          cantidadPrevendida: u.reservadaPara ? 1 : 0,
          pesoLibras: producto?.pesoLibras,
          ocReferencia: u.ordenCompraNumero
            ? `${u.ordenCompraNumero}${u.proveedorNombre ? ` (${u.proveedorNombre})` : ''}`
            : undefined,
          unidadIdsRepresentativa: [u.id],
        });
      }
    }
    // Filtro por búsqueda
    let lista = Array.from(grupoMap.values());
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        g =>
          g.productoNombre.toLowerCase().includes(q) ||
          g.productoSKU.toLowerCase().includes(q)
      );
    }
    return lista.sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
  }, [unidades, productos, state.ubicacionOrigenId, busqueda]);

  const getCantidadSeleccionada = (productoId: string): number => {
    const u = state.unidadesSeleccionadas.find(x => x.productoId === productoId);
    return u?.cantidadSeleccionada || 0;
  };

  const handleSumar = (grupo: GrupoProducto) => {
    const actual = getCantidadSeleccionada(grupo.productoId);
    if (actual === 0) {
      // Primera vez: agregar
      dispatch({
        type: 'TOGGLE_UNIDAD',
        unidad: {
          unidadId: grupo.unidadIdsRepresentativa[0],
          productoId: grupo.productoId,
          sku: grupo.productoSKU,
          codigoUnidad: grupo.unidadIdsRepresentativa[0],
          productoNombre: grupo.productoNombre,
          pesoLibras: grupo.pesoLibras,
          esPrevendida: grupo.cantidadPrevendida > 0,
          cantidadSeleccionada: 1,
          cantidadDisponible: grupo.cantidadDisponible,
        },
      });
    } else {
      dispatch({
        type: 'SET_CANTIDAD_UNIDAD',
        productoId: grupo.productoId,
        cantidad: Math.min(actual + 1, grupo.cantidadDisponible),
      });
    }
  };

  const handleRestar = (grupo: GrupoProducto) => {
    const actual = getCantidadSeleccionada(grupo.productoId);
    if (actual <= 0) return;
    dispatch({
      type: 'SET_CANTIDAD_UNIDAD',
      productoId: grupo.productoId,
      cantidad: actual - 1,
    });
  };

  const totalDisponibles = grupos.reduce((sum, g) => sum + g.cantidadDisponible, 0);
  const totalSeleccionadas = state.unidadesSeleccionadas.reduce(
    (sum, u) => sum + u.cantidadSeleccionada,
    0
  );
  const totalPrevendidasDisponibles = grupos.reduce(
    (sum, g) => sum + g.cantidadPrevendida,
    0
  );

  if (disabled) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden opacity-60">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
            3
          </span>
          <h4 className="text-sm font-semibold text-slate-900">
            ¿Qué unidades envías?
          </h4>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-400 italic text-center py-2">
            Completá Origen y Destino para elegir las unidades.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            3
          </span>
          <h4 className="text-sm font-semibold text-slate-900">
            ¿Qué unidades envías?
          </h4>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          {totalSeleccionadas} / {totalDisponibles} seleccionadas
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-600">
          Elegí las unidades que se enviarán. Las pre-vendidas se incluyen
          automáticamente.
        </p>

        {/* Buscador */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto por nombre, SKU, marca..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
          />
        </div>

        {/* Banner pre-vendidas */}
        {totalPrevendidasDisponibles > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">🎯</span>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-emerald-900 mb-0.5">
                {totalPrevendidasDisponibles} unidades pre-vendidas disponibles
              </div>
              <p className="text-emerald-800">
                Hay clientes esperando estas unidades. Se incluirán
                automáticamente.
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-emerald-800 whitespace-nowrap">
              <input
                type="checkbox"
                checked={state.incluirPrevendidas}
                onChange={e =>
                  dispatch({
                    type: 'SET_INCLUIR_PREVENDIDAS',
                    incluir: e.target.checked,
                  })
                }
                className="rounded"
              />{' '}
              Incluir auto
            </label>
          </div>
        )}

        {/* Lista de productos con stepper */}
        {grupos.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-6 text-center">
            <div className="text-2xl mb-1">📦</div>
            <p className="text-xs text-slate-600">
              {busqueda
                ? 'Sin resultados para esa búsqueda.'
                : 'No hay unidades disponibles en esta ubicación.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {grupos.map(g => {
              const cantSelected = getCantidadSeleccionada(g.productoId);
              return (
                <div
                  key={g.productoId}
                  className="border border-slate-200 rounded-lg bg-white p-3 flex items-center gap-3"
                >
                  <span className="text-2xl flex-shrink-0">📦</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {g.productoNombre}
                      </span>
                      {g.cantidadPrevendida > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                          🎯 {g.cantidadPrevendida} pre-vendida{g.cantidadPrevendida > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      SKU: {g.productoSKU}
                      {g.ocReferencia && ` · ${g.ocReferencia}`}
                      {g.pesoLibras !== undefined && ` · ${g.pesoLibras} lb/ud`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestar(g)}
                      disabled={cantSelected <= 0}
                      className="w-7 h-7 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {cantSelected}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSumar(g)}
                      disabled={cantSelected >= g.cantidadDisponible}
                      className="w-7 h-7 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                    <span className="text-[11px] text-slate-400">
                      / {g.cantidadDisponible}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
