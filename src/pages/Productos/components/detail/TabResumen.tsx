/**
 * TabResumen · Tab "Resumen" del modal detalle producto
 *
 * Mockup canónico desktop: docs/mockups/productos/11-modal-detalle-info.html
 * Mockup canónico mobile:  docs/mockups/productos/11m-modal-detalle-mobile.html
 *
 * Layout:
 *   DESKTOP (≥lg): Grid 3 cols (col-span-2 contenido + sidebar 1-col insights)
 *   MOBILE  (<lg): Stack vertical · insights primero (apilados), luego contenido
 *
 * Secciones:
 *   - Info producto (nombre, marca, línea, tipo, descripción)
 *   - Atributos Skincare (paso, textura, tipo piel, preocupaciones) · solo SKC
 *   - Origen e importación (país, método, lead time)
 *   - Proveedores recomendados (top 3)
 *   - Sidebar insights (Precio sugerido · Punto equilibrio · Competencia)
 */

import React, { useMemo } from 'react';
import { Info, Palette, Globe, DollarSign, Award, Building, Calculator, Users, Sparkles, CalendarClock, Zap } from 'lucide-react';
import type { Producto } from '../../../../types/producto.types';
import { calcularInvestigacion } from '../../utils/investigacionCalculos';
import { calcularDuracionEnvase } from '../../utils/duracionEnvase';

interface TabResumenProps {
  producto: Producto;
}

function getPrecioVenta(producto: Producto): number {
  // Fase H+ · sin fallback a precioSugeridoCalculado legacy
  return calcularInvestigacion(producto).precioEfectivo;
}

function getMargenPct(producto: Producto): number | null {
  const precio = getPrecioVenta(producto);
  const ctru = producto.investigacion?.ctruEstimado ?? producto.ctruPromedio ?? 0;
  if (precio <= 0 || ctru <= 0) return null;
  return Math.round(((precio - ctru) / precio) * 100);
}

export const TabResumen: React.FC<TabResumenProps> = ({ producto }) => {
  const precioVenta = getPrecioVenta(producto);
  const margenPct = getMargenPct(producto);
  const ctru = producto.investigacion?.ctruEstimado ?? producto.ctruPromedio ?? 0;
  const isSkincare = (producto.lineaNegocioNombre ?? '').toLowerCase().includes('skin');

  const proveedores = useMemo(() => {
    const lista = producto.investigacion?.proveedoresUSA ?? [];
    return lista.slice(0, 3);
  }, [producto.investigacion]);

  const competidores = useMemo(() => {
    const lista = producto.investigacion?.competidoresPeru ?? [];
    return lista.slice(0, 3);
  }, [producto.investigacion]);

  const competenciaMin = useMemo(() => {
    if (!competidores.length) return null;
    return Math.min(...competidores.map((c: any) => c.precio ?? 0).filter((n: number) => n > 0));
  }, [competidores]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 p-3 lg:p-5 bg-slate-50/30">
      {/* ═══════ MOBILE: insights apilados primero · DESKTOP: van al sidebar derecho ═══════ */}
      <div className="lg:hidden space-y-3">
        <InsightCards
          precioVenta={precioVenta}
          margenPct={margenPct}
          ctru={ctru}
          competidores={competidores}
          competenciaMin={competenciaMin}
        />
      </div>

      {/* ═══════ COLUMNA IZQUIERDA · contenido principal (col-span-2 desktop) ═══════ */}
      <div className="lg:col-span-2 space-y-3 lg:space-y-4">
        {/* 1. Información del producto */}
        <Section title="Información del producto" icon={Info} iconColor="text-slate-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Nombre comercial" value={producto.nombreComercial} />
            <Field label="Marca" value={producto.marca} />
            {producto.lineaNegocioNombre && (
              <Field label="Línea de negocio" custom>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-bold">
                  {producto.lineaNegocioNombre}
                </span>
              </Field>
            )}
            {producto.tipoProducto?.nombre && (
              <Field label="Tipo de producto" value={producto.tipoProducto.nombre} />
            )}
            {/* S3.4 (2026-05-04) · Si NO hay descripcionMarketing nuevo, mostrar descripcion legacy plana.
                Cuando hay descripcionMarketing, se usa la sección "Marketing comercial" más abajo. */}
            {!producto.descripcionMarketing && (producto as any).descripcion && (
              <div className="sm:col-span-2">
                <FieldLabel>Descripción</FieldLabel>
                <div className="text-slate-700 text-sm leading-relaxed">{(producto as any).descripcion}</div>
              </div>
            )}
          </div>
        </Section>

        {/* S3.4 · Marketing comercial · 4 niveles generados por IA (DEUDA-IA-SEO-001) */}
        {producto.descripcionMarketing && (
          <MarketingSection marketing={producto.descripcionMarketing} />
        )}

        {/* S3.4 · Chip duración del envase · solo SUP */}
        {(producto.lineaNegocioNombre ?? '').toLowerCase().includes('suplem') && (
          <DuracionEnvaseRow producto={producto} />
        )}

        {/* 2. Atributos Skincare (solo si línea es skincare) */}
        {isSkincare && producto.atributosSkincare && (
          <Section title="Atributos Skincare" icon={Palette} iconColor="text-amber-600">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {producto.atributosSkincare.pasoRutina && (
                <Field label="Paso de rutina" value={producto.atributosSkincare.pasoRutina} />
              )}
              {producto.atributosSkincare.textura && (
                <Field label="Textura" value={producto.atributosSkincare.textura} />
              )}
              {producto.atributosSkincare.tipoPiel && producto.atributosSkincare.tipoPiel.length > 0 && (
                <Field label="Tipo de piel" custom>
                  <div className="flex flex-wrap gap-1">
                    {producto.atributosSkincare.tipoPiel.map((tipo: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                        {tipo}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
              {producto.atributosSkincare.preocupaciones && producto.atributosSkincare.preocupaciones.length > 0 && (
                <div className="sm:col-span-3">
                  <FieldLabel>Preocupaciones que resuelve</FieldLabel>
                  <div className="flex flex-wrap gap-1">
                    {producto.atributosSkincare.preocupaciones.map((p: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 3. Origen e importación */}
        {(producto.paisOrigen || producto.costoFleteInternacional !== undefined) && (
          <Section title="Origen e importación" icon={Globe} iconColor="text-sky-600">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {producto.paisOrigen && <Field label="País origen" value={producto.paisOrigen} />}
              {producto.costoFleteInternacional !== undefined && (
                <Field label="Flete internacional" value={`$ ${producto.costoFleteInternacional.toFixed(2)}`} mono />
              )}
              {producto.pesoLibras !== undefined && (
                <Field label="Peso unitario" value={`${producto.pesoLibras} lb`} mono />
              )}
            </div>
          </Section>
        )}

        {/* 4. Proveedores recomendados */}
        {proveedores.length > 0 && (
          <Section title="Proveedores recomendados" icon={DollarSign} iconColor="text-emerald-600">
            <div className="space-y-2">
              {proveedores.map((p: any, idx: number) => {
                const isTop = idx === 0;
                return (
                  <div
                    key={p.id ?? idx}
                    className={`rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      isTop
                        ? 'bg-emerald-50/50 border border-emerald-200 hover:bg-emerald-50'
                        : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isTop ? 'bg-emerald-100' : 'bg-slate-50'
                      }`}
                    >
                      {isTop ? <Award className="w-4 h-4 text-emerald-700" /> : <Building className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{p.nombre ?? 'Proveedor'}</span>
                        {isTop && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                            Top elección
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Costo unitario{' '}
                        <span className="font-semibold text-slate-700 tabular-nums">$ {p.precio?.toFixed(2) ?? '—'}</span>
                        {p.score !== undefined && ` · score ${p.score}/5`}
                      </div>
                    </div>
                    {p.leadTime !== undefined && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-slate-500">Lead time</div>
                        <div className="text-sm font-semibold text-slate-900 tabular-nums">{p.leadTime}d</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* ═══════ DESKTOP SIDEBAR · 3 cards insights F6.2 ═══════ */}
      <div className="hidden lg:block space-y-3">
        <InsightCards
          precioVenta={precioVenta}
          margenPct={margenPct}
          ctru={ctru}
          competidores={competidores}
          competenciaMin={competenciaMin}
        />
      </div>
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; icon: typeof Info; iconColor: string; children: React.ReactNode }> = ({
  title,
  icon: Icon,
  iconColor,
  children,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5">
    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      {title}
    </h3>
    {children}
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">{children}</div>
);

const Field: React.FC<{ label: string; value?: string; mono?: boolean; custom?: boolean; children?: React.ReactNode }> = ({
  label,
  value,
  mono,
  custom,
  children,
}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    {custom ? (
      children
    ) : (
      <div className={`text-slate-900 font-medium ${mono ? 'tabular-nums' : ''}`}>{value ?? '—'}</div>
    )}
  </div>
);

interface InsightCardsProps {
  precioVenta: number;
  margenPct: number | null;
  ctru: number;
  competidores: any[];
  competenciaMin: number | null;
}

const InsightCards: React.FC<InsightCardsProps> = ({ precioVenta, margenPct, ctru, competidores, competenciaMin }) => (
  <>
    {/* Insight 1 · Precio venta sugerido */}
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">Precio venta sugerido</div>
      {precioVenta > 0 ? (
        <>
          <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
            S/ {Math.floor(precioVenta)}
            <span className="text-base text-slate-400 font-normal">.{((precioVenta * 100) % 100).toFixed(0).padStart(2, '0')}</span>
          </div>
          {competenciaMin !== null && (
            <div className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
              Mín. competencia <span className="font-semibold text-slate-800 tabular-nums">S/ {competenciaMin}</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px]">
            {ctru > 0 && (
              <div>
                <div className="text-slate-500">Costo landed</div>
                <div className="font-semibold text-slate-900 tabular-nums">S/ {Math.round(ctru)}</div>
              </div>
            )}
            {margenPct !== null && (
              <div>
                <div className="text-slate-500">Margen</div>
                <div className="font-bold text-emerald-700 tabular-nums">{margenPct}%</div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-500 italic">Sin precio sugerido</div>
      )}
    </div>

    {/* Insight 2 · Punto de equilibrio (placeholder · trae fórmula real en Fase 9) */}
    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold mb-1">Punto de equilibrio</div>
      {ctru > 0 && precioVenta > 0 ? (
        <>
          <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
            {Math.ceil(ctru / Math.max(precioVenta - ctru, 1))} <span className="text-base text-slate-400 font-normal">unid.</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
            Recuperar inversión OC mínima
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-500 italic">Sin datos suficientes</div>
      )}
      <button className="mt-3 text-[11px] text-indigo-700 hover:text-indigo-800 font-bold inline-flex items-center gap-1">
        <Calculator className="w-3 h-3" />
        Abrir calculadora →
      </button>
    </div>

    {/* Insight 3 · Competencia en Perú */}
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-[11px] font-bold text-slate-900 mb-2 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-slate-600" />
        Competencia en Perú
      </div>
      {competidores.length > 0 ? (
        <div className="space-y-1.5 text-[11px]">
          {competidores.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-slate-600">{c.nombre ?? `Competidor ${i + 1}`}</span>
              <span className="tabular-nums font-semibold text-slate-900">S/ {c.precio ?? '—'}</span>
            </div>
          ))}
          {competenciaMin !== null && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-1">
              <span className="text-slate-600 font-semibold">Mínimo</span>
              <span className="tabular-nums font-bold text-emerald-600">S/ {competenciaMin}</span>
            </div>
          )}
          {precioVenta > 0 && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded p-1.5 mt-1">
              <span className="text-emerald-800 font-bold">Mi precio</span>
              <span className="tabular-nums font-bold text-emerald-700">S/ {Math.round(precioVenta)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-500 italic">Sin investigación de competencia</div>
      )}
    </div>
  </>
);

// ═══════ S3.4 · Marketing comercial · 4 niveles generados por IA ════════════
const MarketingSection: React.FC<{ marketing: NonNullable<Producto['descripcionMarketing']> }> = ({ marketing }) => {
  const tagline = marketing.tagline?.texto;
  const beneficios = marketing.beneficios?.texto;
  const descripcion = marketing.descripcion?.texto;
  const keywords = marketing.keywordsSEO?.texto;
  const fuente = marketing.tagline?.fuente ?? marketing.descripcion?.fuente ?? 'manual';

  // No renderizar si está completamente vacío
  if (!tagline && !descripcion && (!beneficios || beneficios.length === 0)) return null;

  const fuenteBadge =
    fuente === 'ia' ? { label: 'IA', cls: 'bg-purple-100 text-purple-700 border-purple-200' }
    : fuente === 'mixto' ? { label: 'IA + edición', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
    : { label: 'Manual', cls: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <Section title="Marketing comercial" icon={Sparkles} iconColor="text-purple-600">
      <div className="space-y-3">
        {/* Header con badge de fuente */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${fuenteBadge.cls} flex items-center gap-1`}>
            <Sparkles className="w-2.5 h-2.5" />{fuenteBadge.label}
          </span>
          {marketing.tagline?.generadoEn && (
            <span className="text-[10px] text-slate-500 italic">
              Generado: {formatTimestamp(marketing.tagline.generadoEn)}
            </span>
          )}
        </div>

        {/* Nivel 1 · Tagline (frase gancho · arranca con keyword principal) */}
        {tagline && (
          <div>
            <FieldLabel>Frase gancho</FieldLabel>
            <div className="text-slate-900 text-base font-bold leading-snug">{tagline}</div>
          </div>
        )}

        {/* Nivel 2 · Beneficios bullets */}
        {beneficios && beneficios.length > 0 && (
          <div>
            <FieldLabel>Beneficios principales</FieldLabel>
            <ul className="space-y-1">
              {beneficios.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-purple-600 font-bold mt-0.5">•</span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nivel 3 · Descripción narrativa */}
        {descripcion && (
          <div>
            <FieldLabel>Descripción</FieldLabel>
            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{descripcion}</div>
          </div>
        )}

        {/* Nivel 4 · Keywords SEO */}
        {keywords && keywords.length > 0 && (
          <div>
            <FieldLabel>Keywords SEO · long-tail Google + Mercado Libre</FieldLabel>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-900 text-[10px] font-medium">
                    {kw}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 text-[9px] text-emerald-800 italic">
                Listas para meta-tags · atributos Mercado Libre · schema.org · sitemap interno
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};

function formatTimestamp(ts: any): string {
  try {
    const date = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : null);
    if (!date) return '';
    return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// ═══════ S3.4 · Chip duración del envase (solo SUP · cara cliente) ═══════════
//
// Lazy migration: si el producto NO tiene `contenidoNeto` estructurado pero SÍ
// tiene el campo legacy `contenido` ("150 capsulas", "60 cápsulas", etc.), lo
// parseamos al vuelo para que el chip funcione también en productos legacy que
// nunca pasaron por el wizard nuevo.
function parseLegacyContenido(contenidoStr: string | undefined): { valor: number; unidad: any } | undefined {
  if (!contenidoStr) return undefined;
  const m = contenidoStr.match(/^([\d.]+)\s*(\w+)/);
  if (!m) return undefined;
  const valor = parseFloat(m[1]);
  if (!isFinite(valor) || valor <= 0) return undefined;
  const unidadRaw = m[2].toLowerCase();
  // Normalizar tildes y palabras frecuentes
  const map: Record<string, string> = {
    'cápsulas': 'capsulas', 'capsulas': 'capsulas', 'caps': 'capsulas', 'cápsula': 'capsulas',
    'tabletas': 'tabletas', 'tabs': 'tabletas', 'tableta': 'tabletas',
    'gomitas': 'gomitas', 'gomita': 'gomitas',
    'sobres': 'sobres', 'sticks': 'sticks', 'scoops': 'scoops',
    'ml': 'ml', 'g': 'g', 'gr': 'g', 'gramos': 'g', 'gramo': 'g',
    'lb': 'lb', 'libras': 'lb', 'oz': 'oz', 'kg': 'kg',
  };
  const unidad = map[unidadRaw];
  if (!unidad) return undefined;
  return { valor, unidad };
}

const DuracionEnvaseRow: React.FC<{ producto: Producto }> = ({ producto }) => {
  const contenidoNetoEfectivo = producto.contenidoNeto
    ?? parseLegacyContenido((producto as any).contenido);
  const estado = calcularDuracionEnvase({
    contenidoNeto: contenidoNetoEfectivo,
    servingsPerDay: producto.servingsPerDay,
    dosaje: producto.atributosSuplementos?.dosaje,
  });
  if (estado.tipo !== 'ok') return null;

  return (
    <Section title="Ciclo del producto" icon={CalendarClock} iconColor="text-emerald-600">
      <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold">Duración del envase</div>
          <div className="text-base font-bold text-emerald-900 tabular-nums">≈ {estado.dias} días</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">{estado.razonCalculo} · ciclo de recompra estimado</div>
        </div>
        <div className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" />auto
        </div>
      </div>
    </Section>
  );
};
