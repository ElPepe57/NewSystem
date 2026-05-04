/**
 * MarketingComercialSection · S3.2 · DEUDA-IA-001 · 2026-05-03
 *
 * Sección 6 (última) del wizard / editor de producto. Genera y edita el
 * marketing comercial de 3 niveles (tagline + beneficios + descripción)
 * usando IA (Gemini Flash 2.0) o entrada manual.
 *
 * Reglas UX (S3.2 aprobadas por usuario):
 *   - "TODA la data antes de generar" · botón disabled hasta Sec.1-5 completas
 *   - Generación es ÚNICA durante creación (one-shot) · regenerable en editor
 *   - Auditoría por campo · fuente=ia|manual|mixto · timestamps
 *   - Compliance DIGEMID/INDECOPI integrado en el prompt de la CF
 *   - Disclaimer auto en SUP (lo agrega la CF)
 *
 * Props:
 *   - value: DescripcionMarketing actual (si existe)
 *   - onChange: callback con la versión actualizada
 *   - prerequisitos: estado de las secciones previas + lista de pendientes
 *   - onGenerate: callback que invoca la CF y devuelve la nueva DescripcionMarketing
 *   - mode: 'create' | 'edit' · controla disclaimer y banner regenerar
 */

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  X,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type {
  DescripcionMarketing,
  MarketingFieldAudit,
  FuenteMarketing,
} from '../../../../types/producto.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Crea un MarketingFieldAudit vacío con fuente=manual */
function emptyAudit<T>(initial: T): MarketingFieldAudit<T> {
  return { texto: initial, fuente: 'manual' };
}

/** Detecta si un texto fue editado significativamente (≥30% diff) */
function isSignificativelyEdited(generated: string, current: string): boolean {
  if (!generated) return false;
  if (!current) return true;
  const minLen = Math.min(generated.length, current.length);
  const maxLen = Math.max(generated.length, current.length);
  if (maxLen === 0) return false;
  // Heurística simple: si el largo cambió >30% asumimos edición significativa
  if (Math.abs(generated.length - current.length) / maxLen > 0.3) return true;
  // Y si más del 30% de los caracteres cambian
  let same = 0;
  for (let i = 0; i < minLen; i++) {
    if (generated[i] === current[i]) same++;
  }
  return same / maxLen < 0.7;
}

/** Calcula la nueva fuente al editar manualmente */
function computeFuenteOnEdit(
  prevAudit: MarketingFieldAudit<any>,
  newText: string,
): FuenteMarketing {
  if (prevAudit.fuente !== 'ia') return prevAudit.fuente;
  // Era IA · si edición ≥30% → mixto, sino sigue siendo IA con marca de edición
  const prevText = typeof prevAudit.texto === 'string' ? prevAudit.texto : '';
  return isSignificativelyEdited(prevText, newText) ? 'mixto' : 'ia';
}

// ─── Tipos de Props ─────────────────────────────────────────────────────────

export interface PrerequisitoChecklist {
  /** ID corto · ej: "sec1", "sec2-skc", "sec3" */
  id: string;
  /** Texto visible · ej: "Sec.1 Identidad" */
  label: string;
  /** Si está cumplido o no */
  ok: boolean;
  /** Razón si no está OK · ej: "falta Contenido neto" */
  detalle?: string;
}

export interface MarketingComercialSectionProps {
  value?: DescripcionMarketing;
  onChange: (next: DescripcionMarketing | undefined) => void;
  /** Lista de prerequisitos · botón se habilita solo si TODOS están ok */
  prerequisitos: PrerequisitoChecklist[];
  /** Callback que invoca la CF · devuelve null si falla, o el nuevo DescripcionMarketing */
  onGenerate: () => Promise<DescripcionMarketing | null>;
  /** Modo · 'create' (one-shot al final) · 'edit' (regenerable + banner stale) */
  mode: 'create' | 'edit';
  /** Solo en modo edit · si los atributos cambiaron desde generadoEn → mostrar banner */
  datosCambiaronDesdeGeneracion?: boolean;
  /** Línea del producto · agrega disclaimer DIGEMID auto si SUP */
  lineaCodigo?: 'SKC' | 'SUP' | '';
}

// ─── Componente principal ──────────────────────────────────────────────────

export const MarketingComercialSection: React.FC<MarketingComercialSectionProps> = ({
  value,
  onChange,
  prerequisitos,
  onGenerate,
  mode,
  datosCambiaronDesdeGeneracion = false,
  lineaCodigo = '',
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todosCumplen = useMemo(
    () => prerequisitos.every(p => p.ok),
    [prerequisitos],
  );
  const pendientes = useMemo(
    () => prerequisitos.filter(p => !p.ok),
    [prerequisitos],
  );

  const yaGenerado = !!value;

  const handleGenerate = async () => {
    if (!todosCumplen || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await onGenerate();
      if (result) {
        onChange(result);
      } else {
        setError('La generación no produjo resultado · intentá de nuevo');
      }
    } catch (err: any) {
      setError(err?.message || 'Error generando con IA');
    } finally {
      setGenerating(false);
    }
  };

  // Helpers de update
  const updateTagline = (texto: string) => {
    if (!value) return;
    onChange({
      ...value,
      tagline: {
        ...value.tagline,
        texto,
        fuente: computeFuenteOnEdit(value.tagline, texto),
        editadoEn: Timestamp.now(),
      },
    });
  };

  const updateBeneficio = (idx: number, texto: string) => {
    if (!value) return;
    const items = [...value.beneficios.texto];
    items[idx] = texto;
    onChange({
      ...value,
      beneficios: {
        ...value.beneficios,
        texto: items,
        fuente: 'mixto',
        editadoEn: Timestamp.now(),
      },
    });
  };

  const removeBeneficio = (idx: number) => {
    if (!value) return;
    const items = value.beneficios.texto.filter((_, i) => i !== idx);
    onChange({
      ...value,
      beneficios: {
        ...value.beneficios,
        texto: items,
        fuente: 'mixto',
        editadoEn: Timestamp.now(),
      },
    });
  };

  const addBeneficio = () => {
    if (!value) {
      onChange({
        tagline: emptyAudit(''),
        beneficios: { ...emptyAudit<string[]>([]), texto: [''] },
        descripcion: emptyAudit(''),
      });
      return;
    }
    onChange({
      ...value,
      beneficios: {
        ...value.beneficios,
        texto: [...value.beneficios.texto, ''],
        fuente: 'mixto',
        editadoEn: Timestamp.now(),
      },
    });
  };

  const updateDescripcion = (texto: string) => {
    if (!value) return;
    onChange({
      ...value,
      descripcion: {
        ...value.descripcion,
        texto,
        fuente: computeFuenteOnEdit(value.descripcion, texto),
        editadoEn: Timestamp.now(),
      },
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const FuenteBadge: React.FC<{ fuente: FuenteMarketing }> = ({ fuente }) => {
    const cfg = {
      ia: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'IA' },
      manual: { bg: 'bg-slate-50 text-slate-700 border-slate-200', label: 'manual' },
      mixto: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'mixto' },
    }[fuente];
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${cfg.bg}`}
      >
        <Sparkles className="w-2.5 h-2.5" />
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* === Estado A · esperando data (sin generar y faltan prerequisitos) === */}
      {!todosCumplen && !yaGenerado && (
        <div className="rounded-lg bg-amber-50 border-2 border-amber-300 p-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-amber-900 mb-1">
                Esperando data completa · botón deshabilitado
              </div>
              <div className="text-[10px] text-amber-800 mb-2">
                El copy se genera UNA SOLA VEZ con TODA la data del producto · esto
                garantiza máxima calidad y evita regeneraciones repetidas durante
                creación.
              </div>
              <div className="space-y-1 text-[10px]">
                {prerequisitos.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 ${p.ok ? 'text-emerald-700' : 'text-rose-700'}`}
                  >
                    {p.ok ? (
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3 h-3 flex-shrink-0" />
                    )}
                    <span>{p.label}</span>
                    {!p.ok && p.detalle && (
                      <span className="text-rose-600 italic">· {p.detalle}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="px-3 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 cursor-not-allowed flex-shrink-0"
            >
              <Sparkles className="w-3 h-3" />
              Generar con IA
            </button>
          </div>
        </div>
      )}

      {/* === Estado B · data completa + sin generar todavía (botón habilitado) === */}
      {todosCumplen && !yaGenerado && (
        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Listo para generar · Gemini Flash 2.0 (gratis)
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5 leading-relaxed">
                Usa TODA la data del producto · {prerequisitos.length}/{prerequisitos.length}{' '}
                secciones completas · compliance DIGEMID/INDECOPI integrado · sin claims
                terapéuticos.
                {lineaCodigo === 'SUP' && (
                  <> · Disclaimer auto agregado para Suplementos.</>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-3 py-1.5 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center gap-1 shadow-sm flex-shrink-0"
            >
              <Sparkles className="w-3 h-3" />
              {generating ? 'Generando...' : 'Generar con IA'}
            </button>
          </div>
        </div>
      )}

      {/* === Banner · datos cambiaron (solo modo edit) === */}
      {mode === 'edit' && yaGenerado && datosCambiaronDesdeGeneracion && (
        <div className="rounded-lg bg-amber-50 border-2 border-amber-300 p-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-amber-900 mb-0.5">
              Datos actualizados desde la última generación
            </div>
            <div className="text-[10px] text-amber-800">
              Cambiaste atributos del producto. ¿Querés regenerar el copy comercial
              con la nueva data? Se preserva tu edición manual hasta que apretes
              "Regenerar".
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 text-[10px] font-bold text-amber-900 bg-white border border-amber-400 hover:bg-amber-100 disabled:opacity-50 rounded-lg flex items-center gap-1 flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            {generating ? 'Regenerando...' : 'Regenerar'}
          </button>
        </div>
      )}

      {/* === Estado C · ya generado · campos editables === */}
      {yaGenerado && value && (
        <>
          {/* Banner generación + botón regenerar */}
          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {mode === 'create'
                  ? 'Generado con IA · revisá y editá si querés'
                  : 'Marketing actual · regenerable si modificás atributos'}
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5">
                Compliance DIGEMID/INDECOPI · 3 niveles editables · auditoría por campo
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !todosCumplen}
              className="px-3 py-1.5 text-[10px] font-bold text-purple-600 bg-white border border-purple-300 hover:bg-purple-50 disabled:opacity-50 rounded-lg flex items-center gap-1 flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              {generating ? '...' : 'Regenerar'}
            </button>
          </div>

          {/* Nivel 1 · Frase gancho */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
              <span>1 · Frase gancho · ~10-15 palabras</span>
              <FuenteBadge fuente={value.tagline.fuente} />
            </label>
            <input
              type="text"
              value={value.tagline.texto}
              onChange={e => updateTagline(e.target.value)}
              placeholder="Hook ~10-15 palabras"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="mt-1 text-[9px] text-slate-500 italic">
              Lo primero que ve el cliente · listings, ads, MercadoLibre título extendido
            </div>
          </div>

          {/* Nivel 2 · Beneficios */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
              <span>2 · Beneficios · 3-5 bullets</span>
              <FuenteBadge fuente={value.beneficios.fuente} />
            </label>
            <div className="space-y-1.5">
              {value.beneficios.texto.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <input
                    type="text"
                    value={b}
                    onChange={e => updateBeneficio(idx, e.target.value)}
                    placeholder={`Beneficio ${idx + 1}`}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeBeneficio(idx)}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Eliminar beneficio"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBeneficio}
                className="text-[10px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 ml-5"
              >
                <Plus className="w-3 h-3" />
                Agregar beneficio
              </button>
            </div>
            <div className="mt-1 text-[9px] text-slate-500 italic">
              Bullets escaneables · página producto, banners, redes sociales
            </div>
          </div>

          {/* Nivel 3 · Descripción */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
              <span>3 · Descripción comercial · 120-180 palabras · SEO-optimized</span>
              <FuenteBadge fuente={value.descripcion.fuente} />
            </label>
            <textarea
              rows={6}
              value={value.descripcion.texto}
              onChange={e => updateDescripcion(e.target.value)}
              placeholder="Texto narrativo persuasivo · 2-3 párrafos · keyword principal en primer párrafo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="mt-1 text-[9px] text-slate-500 italic">
              Página producto · marketplaces · fichas · primer párrafo carga keyword principal + LSI
            </div>
          </div>

          {/* S3.4 · Nivel 4 · Keywords SEO (read-only · listo para meta-tags / Mercado Libre) */}
          {value.keywordsSEO?.texto && value.keywordsSEO.texto.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center justify-between">
                <span>4 · Keywords SEO · long-tail Google + Mercado Libre</span>
                <FuenteBadge fuente={value.keywordsSEO.fuente} />
              </label>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {value.keywordsSEO.texto.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-900 text-[10px] font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 text-[9px] text-emerald-800 italic">
                  Listas para meta-tags, atributos de Mercado Libre, schema.org, sitemap interno
                </div>
              </div>
            </div>
          )}

          {/* Auditoría */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center gap-2 text-[10px]">
            <ClipboardCheck className="w-3 h-3 text-slate-500" />
            <span className="text-slate-600">
              Auditoría · si editás ≥30% un campo IA pasa automáticamente a "mixto" · queda
              en historial.
            </span>
          </div>

          {/* Compliance reminder */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
            <ShieldCheck className="w-3 h-3 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-900 flex-1">
              <strong>Compliance:</strong> sin claims terapéuticos prohibidos ·
              DIGEMID/INDECOPI safe · sólo beneficios cosméticos legítimos.
              {lineaCodigo === 'SUP' && (
                <>
                  {' '}
                  En Suplementos se incluye disclaimer automático "Este producto no
                  reemplaza una dieta balanceada · consulte a su médico".
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* === Error === */}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[10px] text-rose-900">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};
