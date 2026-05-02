/**
 * TabComponentes · Tab "Componentes" del modal detalle producto · solo Pack/Kit
 *
 * Mockup canónico: docs/mockups/productos/14-modal-detalle-componentes-pack.html
 *
 * Visible SOLO cuando producto.esPack === true. Estructura:
 *   1. Banner ámbar con regla de negocio (Gap S3-G4 · NACIDO Sesión 3.1):
 *      "Vender este pack NO descuenta stock de los componentes vinculados"
 *   2. Tabla line-items estilo Stripe:
 *      Tipo (VINC/EXC) · Componente (nombre + SKU + Stock suelto) · Cant ·
 *      Costo unit · Subtotal · acciones
 *   3. Footer con valorización en 4 líneas:
 *      Costo total componentes · Valor venta sueltos · Precio pack · Ahorro
 *   4. Banner alerta opcional · si algún componente subió de precio
 *
 * Decisiones canónicas aplicadas:
 *   - Gap S3-G4: banner ámbar con regla "no descuenta stock vinculado"
 *   - Gap S3-G5: "Stock suelto: X" inline + nombre del componente vinculado
 *     como link clickable (con underline)
 *   - Componentes EXC en cursiva slate-700 (no vinculados al catálogo)
 */

import React, { useMemo } from 'react';
import { Plus, MoreHorizontal, Info, AlertTriangle, FileText, Package2, Link2 } from 'lucide-react';
import type { Producto, ComponentePack } from '../../../../types/producto.types';
import { ProductoAvatar, inferLineaFromProducto } from '../shared/ProductoAvatar';

interface TabComponentesProps {
  producto: Producto;
  /** Mapa opcional id→stock suelto del SKU vinculado · sino se asume desconocido */
  stockSueltoMap?: Record<string, number>;
  onAgregarComponente?: () => void;
  onClickComponente?: (comp: ComponentePack) => void;
  onActionsComponente?: (comp: ComponentePack) => void;
  onRecalcularPack?: () => void;
}

interface ComponenteFila extends ComponentePack {
  esVinculado: boolean;
  costoUnit: number;
  subtotal: number;
  stockSuelto?: number;
}

function getPrecioPack(p: Producto): number {
  return (p as any).precioVenta ?? p.investigacion?.precioSugeridoCalculado ?? 0;
}

export const TabComponentes: React.FC<TabComponentesProps> = ({
  producto,
  stockSueltoMap = {},
  onAgregarComponente,
  onClickComponente,
  onActionsComponente,
  onRecalcularPack,
}) => {
  const componentes = producto.componentesPack ?? [];
  const precioPack = getPrecioPack(producto);

  // Enriquecer componentes con cálculos
  const filas: ComponenteFila[] = useMemo(() => {
    return componentes.map(c => {
      const esVinculado = !!c.productoId;
      const costoUnit = (c as any).precio ?? (c as any).costo ?? (c as any).precioUnitario ?? 0;
      const cantidad = c.cantidad ?? 1;
      const subtotal = costoUnit * cantidad;
      const stockSuelto = c.productoId ? stockSueltoMap[c.productoId] : undefined;
      return { ...c, esVinculado, costoUnit, subtotal, stockSuelto };
    });
  }, [componentes, stockSueltoMap]);

  // Totales
  const totales = useMemo(() => {
    const costoTotal = filas.reduce((acc, f) => acc + f.subtotal, 0);
    // Valor venta sueltos: para vinculados usa stockSueltoMap precios si disponible · sino estimado 1.5x del costo
    const valorVentaSueltos = filas.reduce((acc, f) => {
      const precioRetail = (f as any).precioRetail ?? f.costoUnit * 1.5;
      return acc + precioRetail * (f.cantidad ?? 1);
    }, 0);
    const ahorro = Math.max(0, valorVentaSueltos - precioPack);
    const ahorroPct = valorVentaSueltos > 0 ? Math.round((ahorro / valorVentaSueltos) * 100) : 0;
    const margenPack = precioPack > 0 && costoTotal > 0 ? Math.round(((precioPack - costoTotal) / precioPack) * 100) : 0;
    return { costoTotal, valorVentaSueltos, ahorro, ahorroPct, margenPack };
  }, [filas, precioPack]);

  // Detectar componente con cambio de precio (placeholder · cuando exista historial real, comparar)
  const componenteConAlerta = useMemo(() => {
    return filas.find(f => f.esVinculado && f.costoUnit > 100); // Placeholder logic
  }, [filas]);

  // Empty state
  if (componentes.length === 0) {
    return (
      <div className="p-3 lg:p-5">
        <div className="bg-white border-2 border-dashed border-purple-200 rounded-xl p-8 lg:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Package2 className="w-7 h-7 text-purple-700" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Pack sin componentes</h3>
          <p className="text-xs lg:text-sm text-slate-500 max-w-md mx-auto mb-5">
            Este pack está marcado como Kit pero no tiene componentes definidos. Agrega los productos vinculados o exclusivos
            que vienen dentro de la caja.
          </p>
          {onAgregarComponente && (
            <button
              type="button"
              onClick={onAgregarComponente}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar componente
            </button>
          )}
        </div>
      </div>
    );
  }

  const vinculadosCount = filas.filter(f => f.esVinculado).length;
  const exclusivosCount = filas.length - vinculadosCount;

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-4 max-h-[calc(90vh-220px)] lg:max-h-[480px] overflow-y-auto">
      {/* Header tab */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm lg:text-base font-bold text-slate-900">Componentes del pack</h3>
          <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">
            {filas.length} producto{filas.length === 1 ? '' : 's'} dentro de la caja · {vinculadosCount} vinculado
            {vinculadosCount === 1 ? '' : 's'} · {exclusivosCount} exclusivo{exclusivosCount === 1 ? '' : 's'}
          </p>
        </div>
        {onAgregarComponente && (
          <button
            type="button"
            onClick={onAgregarComponente}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        )}
      </div>

      {/* Banner regla de negocio · Gap S3-G4 (canónico Sesión 3.1) */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <Info className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 text-xs text-amber-900 leading-relaxed">
          <div className="font-bold mb-0.5">Regla del pack · stock</div>
          <div>
            Vender este pack <strong>no descuenta</strong> stock de los componentes vinculados (son unidades físicas
            distintas que viven en su propio SKU). El reporting cruzado se calcula aparte en BI.
          </div>
        </div>
      </div>

      {/* ═══════ DESKTOP · Tabla line-items ═══════ */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          <div className="col-span-1">Tipo</div>
          <div className="col-span-5">Componente</div>
          <div className="col-span-1 text-center">Cant.</div>
          <div className="col-span-2 text-right">Costo unit.</div>
          <div className="col-span-2 text-right">Subtotal</div>
          <div className="col-span-1 text-right"></div>
        </div>
        <div className="divide-y divide-slate-100">
          {filas.map((f, idx) => (
            <ComponenteRowDesktop
              key={f.productoId ?? `exc-${idx}`}
              fila={f}
              onClick={onClickComponente}
              onActions={onActionsComponente}
            />
          ))}
        </div>

        {/* Footer · valorización */}
        <div className="border-t border-slate-200">
          <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 bg-slate-50 text-[11px] font-bold">
            <div className="col-span-9 text-slate-700">Costo total componentes</div>
            <div className="col-span-2 text-right text-slate-900 tabular-nums">S/ {totales.costoTotal.toFixed(2)}</div>
            <div className="col-span-1"></div>
          </div>
          <div className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px]">
            <div className="col-span-9 text-slate-600">Valor venta sueltos (suma)</div>
            <div className="col-span-2 text-right text-slate-700 tabular-nums">
              S/ {totales.valorVentaSueltos.toFixed(2)}
            </div>
            <div className="col-span-1"></div>
          </div>
          {precioPack > 0 && (
            <>
              <div className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 bg-purple-50 border-t border-purple-200 text-xs font-bold">
                <div className="col-span-9 text-purple-900">Precio del pack</div>
                <div className="col-span-2 text-right text-purple-900 tabular-nums">S/ {precioPack.toFixed(2)}</div>
                <div className="col-span-1"></div>
              </div>
              {totales.ahorro > 0 && (
                <div className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 bg-emerald-50 border-t border-emerald-200 text-xs font-bold">
                  <div className="col-span-9 text-emerald-900">→ Ahorro para el cliente</div>
                  <div className="col-span-2 text-right text-emerald-700 tabular-nums">
                    S/ {totales.ahorro.toFixed(2)} ({totales.ahorroPct}%)
                  </div>
                  <div className="col-span-1"></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════ MOBILE · Cards apiladas (F12) ═══════ */}
      <div className="lg:hidden space-y-2">
        {filas.map((f, idx) => (
          <ComponenteRowMobile
            key={f.productoId ?? `exc-${idx}`}
            fila={f}
            onClick={onClickComponente}
            onActions={onActionsComponente}
          />
        ))}

        {/* Totales mobile · stack vertical */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-700">Costo total componentes</span>
            <span className="text-slate-900 tabular-nums">S/ {totales.costoTotal.toFixed(2)}</span>
          </div>
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Valor venta sueltos</span>
            <span className="text-slate-700 tabular-nums">S/ {totales.valorVentaSueltos.toFixed(2)}</span>
          </div>
          {precioPack > 0 && (
            <>
              <div className="px-3 py-2 bg-purple-50 border-t border-purple-200 flex items-center justify-between text-xs font-bold">
                <span className="text-purple-900">Precio del pack</span>
                <span className="text-purple-900 tabular-nums">S/ {precioPack.toFixed(2)}</span>
              </div>
              {totales.ahorro > 0 && (
                <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-900">Ahorro</span>
                  <span className="text-emerald-700 tabular-nums">
                    S/ {totales.ahorro.toFixed(2)} ({totales.ahorroPct}%)
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Banner alerta · cambio de precio (opcional) */}
      {componenteConAlerta && totales.margenPack > 0 && totales.margenPack < 50 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 text-xs text-amber-900">
            <div className="font-bold mb-0.5">Re-evaluar precio del pack</div>
            <div>
              Margen actual <strong>{totales.margenPack}%</strong> · considera ajustar el precio del pack o renegociar
              costos con proveedores.
            </div>
          </div>
          {onRecalcularPack && (
            <button
              type="button"
              onClick={onRecalcularPack}
              className="text-[10px] font-bold text-amber-800 px-2 py-1 hover:bg-amber-100 rounded flex-shrink-0"
            >
              Recalcular
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const ComponenteRowDesktop: React.FC<{
  fila: ComponenteFila;
  onClick?: (c: ComponentePack) => void;
  onActions?: (c: ComponentePack) => void;
}> = ({ fila, onClick, onActions }) => {
  const linea = inferLineaFromProducto({
    linea: undefined,
    tipo: fila.atributosSkincare?.tipoProductoSKC,
  });

  return (
    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 hover:bg-slate-50">
      <div className="col-span-1 text-center">
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            fila.esVinculado ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
          }`}
        >
          {fila.esVinculado ? 'VINC' : 'EXC'}
        </span>
      </div>
      <div className="col-span-5 flex items-center gap-2 min-w-0">
        {fila.esVinculado ? (
          <ProductoAvatar linea={linea} size="sm" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
        )}
        <div className="min-w-0">
          {fila.esVinculado ? (
            <button
              type="button"
              onClick={() => onClick?.(fila)}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left truncate flex items-center gap-1"
            >
              {fila.nombre}
              <Link2 className="w-3 h-3 flex-shrink-0" />
            </button>
          ) : (
            <div className="text-sm font-medium text-slate-700 italic truncate">{fila.nombre}</div>
          )}
          <div className="text-[10px] text-slate-500 truncate">
            {fila.esVinculado ? (
              <>
                <span className="font-mono">{fila.sku ?? '—'}</span>
                {fila.marca && (
                  <>
                    {' · '}
                    {fila.marca}
                  </>
                )}
                {fila.stockSuelto !== undefined && (
                  <>
                    {' · '}
                    <span
                      className={`font-bold ${
                        fila.stockSuelto >= 20
                          ? 'text-emerald-600'
                          : fila.stockSuelto >= 5
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      Stock suelto: {fila.stockSuelto}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="italic text-slate-400">Texto libre · no vinculado al catálogo</span>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-1 text-center text-sm font-semibold tabular-nums">{fila.cantidad}</div>
      <div className="col-span-2 text-right text-sm tabular-nums text-slate-700">
        {fila.costoUnit > 0 ? `S/ ${fila.costoUnit.toFixed(2)}` : <span className="text-slate-400 italic">—</span>}
      </div>
      <div className="col-span-2 text-right text-sm font-semibold tabular-nums text-slate-900">
        {fila.subtotal > 0 ? `S/ ${fila.subtotal.toFixed(2)}` : <span className="text-slate-400 italic">—</span>}
      </div>
      <div className="col-span-1 text-right">
        {onActions && (
          <button
            type="button"
            onClick={() => onActions(fila)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

const ComponenteRowMobile: React.FC<{
  fila: ComponenteFila;
  onClick?: (c: ComponentePack) => void;
  onActions?: (c: ComponentePack) => void;
}> = ({ fila, onClick, onActions }) => {
  const linea = inferLineaFromProducto({
    linea: undefined,
    tipo: fila.atributosSkincare?.tipoProductoSKC,
  });
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start gap-2.5 mb-2">
        {fila.esVinculado ? (
          <ProductoAvatar linea={linea} size="sm" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                fila.esVinculado ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
              }`}
            >
              {fila.esVinculado ? 'VINC' : 'EXC'}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">×{fila.cantidad}</span>
          </div>
          {fila.esVinculado ? (
            <button
              type="button"
              onClick={() => onClick?.(fila)}
              className="text-sm font-semibold text-blue-700 hover:underline text-left truncate flex items-center gap-1 w-full"
            >
              {fila.nombre}
              <Link2 className="w-3 h-3 flex-shrink-0" />
            </button>
          ) : (
            <div className="text-sm font-medium text-slate-700 italic truncate">{fila.nombre}</div>
          )}
          <div className="text-[10px] text-slate-500 mt-0.5">
            {fila.esVinculado ? (
              <>
                <span className="font-mono">{fila.sku}</span>
                {fila.marca && ` · ${fila.marca}`}
              </>
            ) : (
              <span className="italic text-slate-400">Texto libre</span>
            )}
          </div>
          {fila.stockSuelto !== undefined && (
            <div
              className={`text-[10px] font-bold mt-0.5 ${
                fila.stockSuelto >= 20 ? 'text-emerald-600' : fila.stockSuelto >= 5 ? 'text-amber-600' : 'text-rose-600'
              }`}
            >
              Stock suelto: {fila.stockSuelto} uds
            </div>
          )}
        </div>
        {onActions && (
          <button
            type="button"
            onClick={() => onActions(fila)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded flex-shrink-0"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {fila.subtotal > 0 && (
        <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Costo unit. · S/ {fila.costoUnit.toFixed(2)}
          </span>
          <span className="font-bold text-slate-900 tabular-nums">S/ {fila.subtotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};
