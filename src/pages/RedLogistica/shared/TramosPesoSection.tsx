/**
 * TramosPesoSection — Editor de tramos de peso escalonados para tarifa de flete
 *
 * S52 · D-11: cada viajero/courier puede tener una tabla de tramos preset
 * que el wizard de envíos auto-carga al elegirlo como transportador.
 *
 * Formato del acuerdo:
 *   0 lb  - 0.5 lb  → $5 por unidad
 *   0.5 lb - 1.0 lb → $6 por unidad
 *   1.0 lb - 1.5 lb → $7 por unidad
 *   2.0 lb - ∞      → $10 por unidad (último tramo siempre pesoHasta: null)
 */
import React from 'react';
import type { TramoPeso } from '../../../types/colaborador.types';

interface Props {
  value: TramoPeso[];
  onChange: (tramos: TramoPeso[]) => void;
  /** Muestra validación de integridad inline */
  showValidation?: boolean;
}

const inputCls =
  'w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none tabular-nums';

/**
 * Valida integridad de la tabla de tramos.
 * Retorna array de errores (vacío si está ok).
 */
export function validarTramos(tramos: TramoPeso[]): string[] {
  const errors: string[] = [];
  if (tramos.length === 0) return errors;

  // Orden ascendente por pesoDesde
  for (let i = 1; i < tramos.length; i++) {
    if (tramos[i].pesoDesde < tramos[i - 1].pesoDesde) {
      errors.push(`Tramo ${i + 1}: el peso debe ser mayor al tramo anterior.`);
    }
  }

  // Sin gaps (pesoHasta de tramo i = pesoDesde de tramo i+1)
  for (let i = 0; i < tramos.length - 1; i++) {
    const actual = tramos[i];
    const siguiente = tramos[i + 1];
    if (actual.pesoHasta === null) {
      errors.push(
        `Tramo ${i + 1}: solo el último tramo puede tener "Hasta" = ∞.`
      );
    } else if (actual.pesoHasta !== siguiente.pesoDesde) {
      errors.push(
        `Tramo ${i + 1}→${i + 2}: gap entre ${actual.pesoHasta} lb y ${
          siguiente.pesoDesde
        } lb.`
      );
    }
  }

  // Último tramo debe ser infinito
  const ultimo = tramos[tramos.length - 1];
  if (ultimo.pesoHasta !== null) {
    errors.push(
      'El último tramo debe tener "Hasta" = ∞ (para cubrir pesos altos).'
    );
  }

  // Costos no negativos
  tramos.forEach((t, i) => {
    if (t.costoUnitario < 0) {
      errors.push(`Tramo ${i + 1}: costo no puede ser negativo.`);
    }
  });

  return errors;
}

export const TramosPesoSection: React.FC<Props> = ({
  value,
  onChange,
  showValidation = true,
}) => {
  const tramos = value || [];
  const errors = showValidation ? validarTramos(tramos) : [];

  const handleAgregar = () => {
    const ultimo = tramos[tramos.length - 1];
    const nuevoDesde = ultimo
      ? ultimo.pesoHasta === null
        ? ultimo.pesoDesde + 0.5
        : ultimo.pesoHasta
      : 0;
    // Convertir el antiguo último a no-infinito si había
    const tramosActualizados =
      ultimo && ultimo.pesoHasta === null
        ? tramos.slice(0, -1).concat({ ...ultimo, pesoHasta: nuevoDesde })
        : tramos;
    const nuevo: TramoPeso = {
      pesoDesde: nuevoDesde,
      pesoHasta: null,
      costoUnitario: 0,
    };
    onChange([...tramosActualizados, nuevo]);
  };

  const handleEliminar = (idx: number) => {
    const nuevos = tramos.filter((_, i) => i !== idx);
    // Asegurar que el último siempre tenga pesoHasta: null
    if (nuevos.length > 0) {
      nuevos[nuevos.length - 1] = { ...nuevos[nuevos.length - 1], pesoHasta: null };
    }
    onChange(nuevos);
  };

  const handleCambio = (
    idx: number,
    campo: keyof TramoPeso,
    valor: number | null
  ) => {
    const nuevos = tramos.map((t, i) =>
      i === idx ? { ...t, [campo]: valor } : t
    );
    onChange(nuevos);
  };

  return (
    <div className="space-y-3">
      {tramos.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          <div className="text-3xl mb-2">⚖️</div>
          <p className="text-sm text-slate-600 mb-3">
            Sin tramos configurados. Agregá el primer tramo para habilitar la
            tarifa escalonada por peso.
          </p>
          <button
            type="button"
            onClick={handleAgregar}
            className="text-sm font-medium px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            + Agregar primer tramo
          </button>
        </div>
      ) : (
        <>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Desde (lb)</th>
                  <th className="px-3 py-2 text-left font-semibold">Hasta (lb)</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Costo por unidad (USD)
                  </th>
                  <th className="px-3 py-2 text-right font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tramos.map((tramo, idx) => {
                  const esUltimo = idx === tramos.length - 1;
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={tramo.pesoDesde}
                          onChange={e =>
                            handleCambio(
                              idx,
                              'pesoDesde',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className={inputCls}
                          disabled={idx === 0}
                          title={idx === 0 ? 'El primer tramo siempre parte de 0' : ''}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {esUltimo ? (
                          <div className="flex items-center gap-1.5 text-slate-600 px-2 py-1.5 bg-slate-50 rounded">
                            <span className="text-base">∞</span>
                            <span className="text-[11px]">infinito</span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="0.1"
                            min={tramo.pesoDesde}
                            value={tramo.pesoHasta ?? 0}
                            onChange={e => {
                              const nuevo = parseFloat(e.target.value) || 0;
                              handleCambio(idx, 'pesoHasta', nuevo);
                              // Autoajustar el pesoDesde del tramo siguiente
                              if (idx < tramos.length - 1) {
                                const nuevos = [...tramos];
                                nuevos[idx] = { ...nuevos[idx], pesoHasta: nuevo };
                                nuevos[idx + 1] = {
                                  ...nuevos[idx + 1],
                                  pesoDesde: nuevo,
                                };
                                onChange(nuevos);
                              }
                            }}
                            className={inputCls}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tramo.costoUnitario}
                            onChange={e =>
                              handleCambio(
                                idx,
                                'costoUnitario',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={inputCls + ' pl-5'}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {tramos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEliminar(idx)}
                            className="text-slate-400 hover:text-red-600 text-sm"
                            title="Eliminar tramo"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleAgregar}
            className="text-xs font-medium text-teal-700 hover:text-teal-900"
          >
            + Agregar tramo
          </button>

          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-amber-900">
                ⚠️ Problemas de integridad en los tramos:
              </div>
              <ul className="text-[11px] text-amber-800 list-disc pl-5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
