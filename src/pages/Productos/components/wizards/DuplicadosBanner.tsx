/**
 * DuplicadosBanner · Banner amber de detección de productos similares (Fase H · #45)
 *
 * Aparece DENTRO del WizardSimple cuando se detecta similitud >= 70%.
 *
 * Algoritmo de similitud (helper extraído):
 *   - Match 90-100%: misma marca + nombre normalizado idéntico + presentación + dosaje
 *   - Match 70-89%: misma marca + nombre similar (Levenshtein) + algunos atributos
 *   - Match <70%: NO se muestra (evita ruido)
 *
 * Trigger: debounced 500ms después de cambios en nombre/marca/presentación.
 *
 * Acciones por candidato:
 *   - "Es variante de este" → callback onConvertirAVariante (padre redirige)
 *   - "Ver detalle" → callback onVerDetalle (padre abre modal)
 *
 * Footer: "Ignorar y continuar" cierra el banner.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, GitBranch, Eye, X, Pill, Droplets, Info } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';

export interface CandidatoSimilar {
  producto: Producto;
  matchPct: number;
  razon: string;
}

interface DuplicadosBannerProps {
  candidatos: CandidatoSimilar[];
  /** Callback al click "Es variante de este" */
  onConvertirAVariante?: (producto: Producto) => void;
  /** Callback al click "Ver detalle" */
  onVerDetalle?: (producto: Producto) => void;
  /** Si querés ocultarlo manualmente */
  onIgnorar?: () => void;
}

export const DuplicadosBanner: React.FC<DuplicadosBannerProps> = ({
  candidatos,
  onConvertirAVariante,
  onVerDetalle,
  onIgnorar,
}) => {
  const [oculto, setOculto] = useState(false);

  const handleIgnorar = () => {
    setOculto(true);
    onIgnorar?.();
  };

  if (oculto || candidatos.length === 0) return null;

  const ordenados = useMemo(
    () => [...candidatos].sort((a, b) => b.matchPct - a.matchPct).slice(0, 3),
    [candidatos],
  );

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-bold text-amber-900">
              ¿Es este producto similar a uno que ya tenés?
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-bold">
              {candidatos.length} candidato{candidatos.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[10px] text-amber-800">
            Detectamos productos parecidos en tu catálogo. Revisá antes de crear · puede ser una variante o un duplicado.
          </div>
        </div>
        <button
          type="button"
          onClick={handleIgnorar}
          className="p-1 hover:bg-amber-100 rounded text-amber-600"
          title="Cerrar este aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista de candidatos */}
      <div className="mt-3 space-y-2">
        {ordenados.map(({ producto: p, matchPct, razon }) => {
          const altoMatch = matchPct >= 90;
          const linea = (p.lineaNegocioNombre ?? '').toLowerCase();
          const Icon = linea.includes('skin') ? Droplets : Pill;
          return (
            <div
              key={p.id}
              className={`rounded-lg bg-white p-2.5 flex items-center gap-3 ${
                altoMatch ? 'border-2 border-amber-300' : 'border border-slate-200'
              }`}
            >
              <div className={`w-1 h-12 rounded-full ${altoMatch ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <div className={`w-9 h-9 rounded-lg ${linea.includes('skin') ? 'bg-amber-100' : 'bg-indigo-100'} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${linea.includes('skin') ? 'text-amber-700' : 'text-indigo-700'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 truncate">{p.nombreComercial}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    altoMatch ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {matchPct}% match
                  </span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                  <span className="font-mono">{p.sku}</span> · {p.marca} · {razon}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onConvertirAVariante && altoMatch && (
                  <button
                    type="button"
                    onClick={() => onConvertirAVariante(p)}
                    className="px-2.5 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded flex items-center gap-1"
                  >
                    <GitBranch className="w-2.5 h-2.5" />
                    Es variante de este
                  </button>
                )}
                {onVerDetalle && (
                  <button
                    type="button"
                    onClick={() => onVerDetalle(p)}
                    className="px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-1"
                  >
                    <Eye className="w-2.5 h-2.5" />
                    Ver detalle
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-amber-800 italic flex items-center gap-1">
          <Info className="w-3 h-3" />
          Si tu producto es realmente distinto, ignorá este aviso y continuá.
        </div>
        <button
          type="button"
          onClick={handleIgnorar}
          className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline"
        >
          Ignorar y continuar →
        </button>
      </div>
    </div>
  );
};

// ─── Helper · detección de similitud ─────────────────────────────────────────

/**
 * Calcula la distancia de Levenshtein entre dos strings (normalizada).
 * Devuelve % de similitud (0-100) basado en la longitud máxima.
 */
function similaridadString(a: string, b: string): number {
  const sa = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const sb = b.toLowerCase().trim().replace(/\s+/g, ' ');
  if (sa === sb) return 100;
  if (!sa || !sb) return 0;

  const max = Math.max(sa.length, sb.length);
  const matrix: number[][] = Array.from({ length: sa.length + 1 }, () => new Array(sb.length + 1).fill(0));
  for (let i = 0; i <= sa.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= sb.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= sa.length; i++) {
    for (let j = 1; j <= sb.length; j++) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const dist = matrix[sa.length][sb.length];
  return Math.round((1 - dist / max) * 100);
}

/**
 * Detecta candidatos similares dentro de una lista de productos.
 *
 * Reglas (mockup #45):
 *   - Match 90-100%: misma marca + nombre normalizado idéntico + presentación + dosaje
 *   - Match 70-89%: misma marca + nombre similar + algunos atributos
 *   - Match <70%: NO se devuelve (evita ruido falso)
 */
export function detectarDuplicados(
  busqueda: { nombre: string; marca?: string; presentacion?: string; dosaje?: string },
  catalogo: Producto[],
): CandidatoSimilar[] {
  const nombreNorm = busqueda.nombre.trim().toLowerCase();
  if (nombreNorm.length < 4) return []; // muy corto · no detectar

  const marcaNorm = busqueda.marca?.trim().toLowerCase() ?? '';

  const resultados: CandidatoSimilar[] = [];
  for (const p of catalogo) {
    const pNombre = (p.nombreComercial ?? '').toLowerCase();
    const pMarca = (p.marca ?? '').toLowerCase();

    // Score base · similitud del nombre
    let score = similaridadString(nombreNorm, pNombre);

    // Bonus +15 si misma marca (exacta o muy similar)
    const marcaSim = marcaNorm && pMarca ? similaridadString(marcaNorm, pMarca) : 0;
    if (marcaSim >= 90) score = Math.min(100, score + 15);

    // Bonus +5 si misma presentación
    if (busqueda.presentacion && p.presentacion === busqueda.presentacion) {
      score = Math.min(100, score + 5);
    }

    // Bonus +5 si mismo dosaje (ej: "1000mg")
    if (busqueda.dosaje && p.dosaje &&
        busqueda.dosaje.trim().toLowerCase() === p.dosaje.trim().toLowerCase()) {
      score = Math.min(100, score + 5);
    }

    // Filtrar threshold
    if (score < 70) continue;

    // Construir razón legible
    const razones: string[] = [];
    if (marcaSim >= 90) razones.push('misma marca');
    if (busqueda.presentacion && p.presentacion === busqueda.presentacion) razones.push('mismo formato');
    if (busqueda.dosaje && p.dosaje &&
        busqueda.dosaje.trim().toLowerCase() === p.dosaje.trim().toLowerCase()) razones.push('mismo dosaje');
    if (score >= 90) razones.unshift('nombre casi idéntico');
    else if (score >= 70) razones.unshift('nombre similar');
    const razon = razones.join(' · ') || 'similitud moderada';

    resultados.push({ producto: p, matchPct: score, razon });
  }

  // Ordenar por mejor match · max 5
  return resultados.sort((a, b) => b.matchPct - a.matchPct).slice(0, 5);
}
