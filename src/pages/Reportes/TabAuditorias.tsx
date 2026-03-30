import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, Download, TrendingUp, Loader2 } from 'lucide-react';
import { conteoInventarioService } from '../../services/conteoInventario.service';
import type { AuditoriaSession } from '../../types/escanerModos.types';

export const TabAuditorias: React.FC = () => {
  const [sesiones, setSesiones] = useState<AuditoriaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAlmacen, setFiltroAlmacen] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    conteoInventarioService.getRecent(50)
      .then(setSesiones)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const almacenes = useMemo(() =>
    [...new Set(sesiones.map(s => s.almacenNombre))],
    [sesiones]
  );

  const sesionesFiltradas = filtroAlmacen
    ? sesiones.filter(s => s.almacenNombre === filtroAlmacen)
    : sesiones;

  // KPIs globales
  const kpis = useMemo(() => {
    if (sesionesFiltradas.length === 0) return null;
    const totalProductos = sesionesFiltradas.reduce((s, ses) => s + ses.resumen.totalProductos, 0);
    const totalCoincidencias = sesionesFiltradas.reduce((s, ses) => s + ses.resumen.coincidencias, 0);
    const totalFaltantes = sesionesFiltradas.reduce((s, ses) => s + ses.resumen.faltantes, 0);
    const totalSobrantes = sesionesFiltradas.reduce((s, ses) => s + ses.resumen.sobrantes, 0);
    const precision = totalProductos > 0 ? (totalCoincidencias / totalProductos) * 100 : 0;

    // Productos con discrepancias frecuentes
    const discrepanciasPorProducto = new Map<string, { nombre: string; veces: number; totalDisc: number }>();
    for (const ses of sesionesFiltradas) {
      for (const item of ses.items) {
        if (item.discrepancia !== 0) {
          const prev = discrepanciasPorProducto.get(item.productoId) || { nombre: item.nombre, veces: 0, totalDisc: 0 };
          prev.veces++;
          prev.totalDisc += Math.abs(item.discrepancia);
          discrepanciasPorProducto.set(item.productoId, prev);
        }
      }
    }
    const topDiscrepancias = [...discrepanciasPorProducto.values()]
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 5);

    return { totalAuditorias: sesionesFiltradas.length, precision, totalFaltantes, totalSobrantes, topDiscrepancias };
  }, [sesionesFiltradas]);

  const handleExportCSV = (session: AuditoriaSession) => {
    const csv = conteoInventarioService.exportarCSV(session.items, session.almacenNombre);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fecha = session.fecha && 'toDate' in session.fecha
      ? (session.fecha as any).toDate().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    link.download = `auditoria-${fecha}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-600 font-medium">Auditorias realizadas</p>
            <p className="text-2xl font-bold text-blue-900">{kpis.totalAuditorias}</p>
          </div>
          <div className={`rounded-xl p-4 ${kpis.precision >= 95 ? 'bg-green-50' : kpis.precision >= 80 ? 'bg-amber-50' : 'bg-red-50'}`}>
            <p className="text-xs font-medium" style={{ color: kpis.precision >= 95 ? '#166534' : kpis.precision >= 80 ? '#92400E' : '#991B1B' }}>Precision inventario</p>
            <p className="text-2xl font-bold text-gray-900">{kpis.precision.toFixed(1)}%</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs text-red-600 font-medium">Faltantes acum.</p>
            <p className="text-2xl font-bold text-red-900">{kpis.totalFaltantes}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs text-amber-600 font-medium">Sobrantes acum.</p>
            <p className="text-2xl font-bold text-amber-900">{kpis.totalSobrantes}</p>
          </div>
        </div>
      )}

      {/* Productos con discrepancias frecuentes */}
      {kpis && kpis.topDiscrepancias.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-red-500" />
            Productos con discrepancias frecuentes
          </h4>
          <div className="space-y-2">
            {kpis.topDiscrepancias.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate flex-1">{p.nombre}</span>
                <span className="text-red-600 font-medium shrink-0 ml-2">{p.veces} auditorias con diferencia</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtro + Historial */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary-600" />
            Historial de Auditorias ({sesionesFiltradas.length})
          </h3>
          <select
            value={filtroAlmacen}
            onChange={e => setFiltroAlmacen(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Todos los almacenes</option>
            {almacenes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {sesionesFiltradas.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No hay auditorias registradas</p>
        ) : (
          <div className="divide-y">
            {sesionesFiltradas.map(session => {
              const isExpanded = expandedId === session.id;
              const fecha = session.fecha && 'toDate' in session.fecha
                ? (session.fecha as any).toDate()
                : new Date(session.fecha as any);
              const r = session.resumen;
              const todoOK = r.faltantes === 0 && r.sobrantes === 0;

              return (
                <div key={session.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : session.id!)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      todoOK ? 'bg-green-100' : r.faltantes > 0 ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      {todoOK ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : r.faltantes > 0 ? <XCircle className="h-4 w-4 text-red-600" />
                        : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{session.almacenNombre}</span>
                        <span className="text-xs text-gray-400">
                          {fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' '}
                          {fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <span className="text-gray-500">{r.totalProductos} prod.</span>
                        {r.coincidencias > 0 && <span className="text-green-600">{r.coincidencias} OK</span>}
                        {r.sobrantes > 0 && <span className="text-amber-600">+{r.sobrantes}</span>}
                        {r.faltantes > 0 && <span className="text-red-600">{r.faltantes} falt.</span>}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50/50 space-y-3">
                      <div className="grid grid-cols-4 gap-1.5">
                        <div className="bg-white rounded p-2 text-center border"><p className="text-sm font-bold">{r.totalProductos}</p><p className="text-[9px] text-gray-500">Total</p></div>
                        <div className="bg-green-50 rounded p-2 text-center border border-green-100"><p className="text-sm font-bold text-green-700">{r.coincidencias}</p><p className="text-[9px] text-green-600">OK</p></div>
                        <div className="bg-amber-50 rounded p-2 text-center border border-amber-100"><p className="text-sm font-bold text-amber-700">{r.sobrantes}</p><p className="text-[9px] text-amber-600">Sobr.</p></div>
                        <div className="bg-red-50 rounded p-2 text-center border border-red-100"><p className="text-sm font-bold text-red-700">{r.faltantes}</p><p className="text-[9px] text-red-600">Falt.</p></div>
                      </div>

                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {session.items.map((item, idx) => {
                          const disc = item.discrepancia;
                          return (
                            <div key={`${item.productoId}-${idx}`} className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs ${
                              disc === 0 ? 'bg-white border border-gray-100' : disc > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-red-50 border border-red-100'
                            }`}>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">{item.nombre}</p>
                                <p className="text-gray-400">{item.sku}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-gray-600"><span className="font-medium">{item.cantidadFisica}</span><span className="text-gray-400"> / {item.stockSistema}</span></p>
                                {disc === 0 ? <span className="text-green-600">OK</span> : <span className={disc > 0 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'}>{disc > 0 ? '+' : ''}{disc}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button type="button" onClick={() => handleExportCSV(session)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
                        <Download className="h-3.5 w-3.5" /> Exportar CSV
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
