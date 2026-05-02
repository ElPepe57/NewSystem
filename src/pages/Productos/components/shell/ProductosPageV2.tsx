/**
 * ProductosPageV2 · Shell principal del módulo Productos · Etapa 4 Fase 1
 *
 * Reemplazo pixel-perfect de la página `/productos` legacy cuando el flag
 * PRODUCTOS_V2 está activo. Esta versión cubre los mockups 01-05:
 *
 *   - 01: listado normal con datos
 *   - 02: empty state · sin productos en BD
 *   - 03: empty state · búsqueda sin resultados
 *   - 04: loading skeleton
 *   - 05: vista mobile (responsive del mismo shell)
 *
 * Este componente es SHELL · todavía NO contiene:
 *   - Filtros barra completos (Fase 2)
 *   - Bulk actions (Fase 2)
 *   - Tabla de productos / cards (Fase 3) → placeholder por ahora
 *   - Modales (Fase 4-9)
 *
 * Mientras tanto, el slot del listado muestra un placeholder visible que el
 * usuario puede ver al activar el flag para validar shell + estados.
 *
 * Flag: localStorage.setItem('FEATURE_PRODUCTOS_V2', 'true') + reload
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useToastStore } from '../../../../store/toastStore';
import { useProductoStore } from '../../../../store/productoStore';
import { useAuthStore } from '../../../../store/authStore';
import { HeaderV2 } from './HeaderV2';
import { KpiStripV2 } from './KpiStripV2';
import { LoadingState } from './LoadingState';
import { EmptyStateBd } from './EmptyStateBd';
import { EmptyStateBusqueda } from './EmptyStateBusqueda';
import { Package } from 'lucide-react';

export const ProductosPageV2: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const toast = useToastStore();
  const { productos, archivados, loading, fetchProductos, fetchArchivados } = useProductoStore();

  const [searchTerm] = useState(''); // futuro: useSearchParams
  // Filtros adicionales se agregarán en Fase 2

  // Cargar productos al montar
  useEffect(() => {
    if (user) {
      fetchProductos();
      fetchArchivados();
    }
  }, [user, fetchProductos, fetchArchivados]);

  // Lista visible (apenas filtra por búsqueda · Fase 2 traerá filtros completos)
  const productosFiltered = useMemo(() => {
    const list = Array.isArray(productos) ? productos : [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (p: any) =>
        p.nombre?.toLowerCase().includes(term) ||
        p.marca?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term)
    );
  }, [productos, searchTerm]);

  // KPIs derivados
  const kpis = useMemo(() => {
    const list = Array.isArray(productos) ? productos : [];
    const activos = list.filter((p: any) => p.estado !== 'archivado').length;
    const totales = list.length;

    // Productos nuevos del mes (creados en últimos 30 días)
    const haceUnMes = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const nuevosMes = list.filter((p: any) => {
      const created = p.fechaCreacion?.toDate?.()?.getTime?.() ?? 0;
      return created >= haceUnMes;
    }).length;

    // Variantes totales (suma de variantes en productos con variantes)
    let variantesTotal = 0;
    let conVariantes = 0;
    list.forEach((p: any) => {
      const numVar = (p.variantes?.length ?? 0) || (p.variantesCount ?? 0);
      if (numVar > 0) {
        variantesTotal += numVar;
        conVariantes++;
      } else {
        variantesTotal += 1; // un producto sin variantes cuenta como 1 SKU
      }
    });

    // Stock crítico
    const stockCriticoList = list.filter((p: any) => {
      const stock = p.stockTotal ?? p.stock ?? 0;
      const minimo = p.stockMinimo ?? 0;
      return minimo > 0 && stock <= minimo;
    });
    const sinInvestigar = stockCriticoList.filter((p: any) => !p.ultimaInvestigacion).length;

    // Margen promedio
    const conMargen = list.filter((p: any) => {
      const inv = p.investigacion?.[0];
      return inv?.ctruEstimado > 0 && p.precioVenta > 0;
    });
    const margenPromedio =
      conMargen.length === 0
        ? 0
        : Math.round(
            conMargen.reduce((acc: number, p: any) => {
              const inv = p.investigacion[0];
              const ctru = inv.ctruEstimado;
              const precioVenta = p.precioVenta;
              return acc + ((precioVenta - ctru) / precioVenta) * 100;
            }, 0) / conMargen.length
          );

    return {
      activos,
      totales,
      nuevosMes,
      variantesTotal,
      conVariantes,
      stockCritico: stockCriticoList.length,
      stockCriticoSinInvestigar: sinInvestigar,
      margenPromedio,
    };
  }, [productos]);

  const archivadosCount = Array.isArray(archivados) ? archivados.length : 0;
  const hayProductos = (Array.isArray(productos) ? productos.length : 0) > 0;

  // ─── Handlers (placeholder hasta Fase 7+) ────────────────────────────────
  const handleNuevo = () => {
    toast.info('Wizard de creación · disponible en Fase 7');
  };
  const handleArchivo = () => {
    toast.info('Modal Papelera · disponible en Fase 8');
  };
  const handleCalculadora = () => {
    toast.info('Productos Intel · disponible en Fase 9');
  };
  const handleSugerencias = () => {
    toast.info('Sugerencias del día · disponible en Fase 9');
  };

  // ─── Render: prioridad de estados ────────────────────────────────────────
  // 1. Loading inicial → skeleton completo
  // 2. Sin productos en BD → onboarding
  // 3. Hay productos pero búsqueda/filtros sin resultados → empty búsqueda
  // 4. Hay productos visibles → header + KPI strip + placeholder de tabla (Fase 2-3)

  if (loading && !hayProductos) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LoadingState />
      </div>
    );
  }

  if (!hayProductos) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <HeaderV2
          archivadosCount={archivadosCount}
          onClickNuevo={handleNuevo}
          onClickArchivo={archivadosCount > 0 ? handleArchivo : undefined}
        />
        <EmptyStateBd
          onClickCrearSimple={handleNuevo}
          onClickCrearConVariantes={handleNuevo}
          onClickCrearPack={handleNuevo}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <HeaderV2
        archivadosCount={archivadosCount}
        onClickCalculadora={handleCalculadora}
        onClickSugerencias={handleSugerencias}
        onClickArchivo={archivadosCount > 0 ? handleArchivo : undefined}
        onClickImportar={handleNuevo}
        onClickExportar={handleNuevo}
        onClickNuevo={handleNuevo}
      />

      <KpiStripV2
        productosActivos={kpis.activos}
        productosTotales={kpis.totales}
        productosNuevosMes={kpis.nuevosMes}
        variantesSkusTotal={kpis.variantesTotal}
        productosConVariantes={kpis.conVariantes}
        stockCritico={kpis.stockCritico}
        stockCriticoSinInvestigar={kpis.stockCriticoSinInvestigar}
        margenPromedio={kpis.margenPromedio}
      />

      {/* Empty búsqueda dentro del shell con KPIs visibles */}
      {searchTerm.trim() && productosFiltered.length === 0 ? (
        <EmptyStateBusqueda searchTerm={searchTerm} onLimpiarBusqueda={() => undefined} onCrearProducto={handleNuevo} />
      ) : (
        // PLACEHOLDER · Fases 2-3 traerán filtros + tabla de cards
        <div className="bg-white border-2 border-dashed border-indigo-300 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-indigo-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">Productos V2 · shell desplegado</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-1">
            <strong>{productosFiltered.length} productos</strong> en BD listos para mostrarse.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            La tabla pixel-perfect llega en <strong>Fase 3</strong> (Card de producto · 6 estados). Los filtros llegan en{' '}
            <strong>Fase 2</strong>.
          </p>
          <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-4">
            ✓ Header banking-grade · ✓ KPI strip canónico · ✓ Estados vacíos/loading
          </div>
        </div>
      )}
    </div>
  );
};
