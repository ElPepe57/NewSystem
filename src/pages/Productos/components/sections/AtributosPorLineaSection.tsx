/**
 * AtributosPorLineaSection · S3.2 · 2026-05-03
 *
 * Componente compartido para renderizar los atributos cerrados de una línea
 * de negocio (SKC o SUP). Extraído de WizardSimple.tsx (líneas 632-998).
 *
 * Reusable en:
 *   - WizardProductoV2 (Sec.2 del wizard nuevo)
 *   - ProductoEditModalV2 (Sec.3 del editor nuevo)
 *
 * Props · controlado:
 *   - lineaCodigo: 'SKC' | 'SUP' | '' (define qué bloque se renderiza)
 *   - skc / sup: objetos value
 *   - onChangeSKC / onChangeSUP: callbacks (partial update)
 *
 * NO incluye el selector de Línea de negocio (vive en Sec.1 Identidad del padre).
 */

import React, { useMemo } from 'react';
import { X, Sun, Pill, Droplets } from 'lucide-react';
import type {
  TipoProductoSKC,
  PasoRutinaSKC,
  TexturaSKC,
  PresentacionSUP,
  TomaConComida,
  EdadRecomendada,
} from '../../../../types/producto.types';
import {
  TIPO_PRODUCTO_SKC_LABELS,
  PASO_RUTINA_LABELS,
  TEXTURA_LABELS,
  TIPO_PIEL_OPTIONS,
  PREOCUPACIONES_OPTIONS,
  ZONA_APLICACION_OPTIONS,
  MOMENTO_DIA_OPTIONS,
  TOMA_CON_COMIDA_LABELS,
  EDAD_RECOMENDADA_LABELS,
  RESTRICCIONES_SUGERIDAS,
  SABORES_SUGERIDOS,
} from '../../../../types/producto.types';
import {
  ChipsCerrados,
  type ChipCerradoOption,
} from '../maestros';

// ─── Tipos de Props ─────────────────────────────────────────────────────────

export type LineaCodigo = 'SKC' | 'SUP' | '';

export interface AtributosLineaSKCValue {
  tipo?: TipoProductoSKC | '';
  ingredienteClave?: string;
  lineaProducto?: string;
  tipoPiel?: string[];
  preocupaciones?: string[];
  pasoRutina?: PasoRutinaSKC | '';
  textura?: TexturaSKC | '';
  zona?: string[];
  spf?: string;
  pa?: string;
}

export interface AtributosLineaSUPValue {
  presentacion?: PresentacionSUP | '';
  servingsDia?: string;
  sabor?: string;
  restricciones?: string[];
  momentoDia?: string[];
  tomaConComida?: TomaConComida | '';
  edad?: EdadRecomendada | '';
  advertencias?: string;
  dosaje?: string;
}

export interface AtributosPorLineaSectionProps {
  lineaCodigo: LineaCodigo;
  /** Estado SKC · solo se usa si lineaCodigo='SKC' */
  skc?: AtributosLineaSKCValue;
  /** Estado SUP · solo se usa si lineaCodigo='SUP' */
  sup?: AtributosLineaSUPValue;
  /** Patch update SKC · merge con estado actual */
  onChangeSKC?: (patch: Partial<AtributosLineaSKCValue>) => void;
  /** Patch update SUP · merge con estado actual */
  onChangeSUP?: (patch: Partial<AtributosLineaSUPValue>) => void;
}

// ─── Field helper local ─────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, className = '', children }) => (
  <div className={className}>
    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
      {label}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

// ─── Componente principal ──────────────────────────────────────────────────

export const AtributosPorLineaSection: React.FC<AtributosPorLineaSectionProps> = ({
  lineaCodigo,
  skc = {},
  sup = {},
  onChangeSKC,
  onChangeSUP,
}) => {
  const esSKC = lineaCodigo === 'SKC';
  const esSUP = lineaCodigo === 'SUP';
  const tieneAtributos = esSKC || esSUP;

  // ─── Opciones memorizadas (idénticas al wizard legacy) ────────────────────
  const opcionesTipoSKC = useMemo<ChipCerradoOption[]>(
    () => Object.entries(TIPO_PRODUCTO_SKC_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesTipoPiel = useMemo<ChipCerradoOption[]>(
    () => TIPO_PIEL_OPTIONS.map(o => ({ value: o, label: o, destacado: o === 'Todo tipo' })),
    [],
  );
  const opcionesPreocupaciones = useMemo<ChipCerradoOption[]>(
    () => PREOCUPACIONES_OPTIONS.map(o => ({ value: o, label: o })),
    [],
  );
  const opcionesPasoRutina = useMemo<ChipCerradoOption[]>(
    () => Object.entries(PASO_RUTINA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesTextura = useMemo<ChipCerradoOption[]>(
    () => Object.entries(TEXTURA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesZona = useMemo<ChipCerradoOption[]>(
    () => ZONA_APLICACION_OPTIONS.map(o => ({ value: o, label: o })),
    [],
  );
  // S3.4 (2026-05-04) · `opcionesPresentacionSUP` y `PRESENTACION_SUP_LABELS`
  // ELIMINADAS: la presentación SUP se infiere de la unidad de Sec.3.
  const opcionesMomentoDia = useMemo<ChipCerradoOption[]>(
    () => MOMENTO_DIA_OPTIONS.map(o => ({ value: o, label: o })),
    [],
  );
  const opcionesTomaConComida = useMemo<ChipCerradoOption[]>(
    () => Object.entries(TOMA_CON_COMIDA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const opcionesEdad = useMemo<ChipCerradoOption[]>(
    () => Object.entries(EDAD_RECOMENDADA_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  // Es protector solar · activa SPF/PA
  const esProtectorSolar = skc.tipo === 'protector_solar';

  // ─── Estado vacío · sin línea ─────────────────────────────────────────────
  if (!tieneAtributos) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 italic">
        Selecciona una línea de negocio (Sec.1) para desbloquear los atributos cerrados específicos (Skincare o Suplementos).
      </div>
    );
  }

  // ─── SKC ──────────────────────────────────────────────────────────────────
  if (esSKC) {
    const setSkc = (patch: Partial<AtributosLineaSKCValue>) => onChangeSKC?.(patch);
    return (
      <div className="space-y-4 border-l-2 border-amber-300 pl-3">
        <div className="flex items-center gap-2 text-amber-800 font-bold text-[11px]">
          <Droplets className="w-3.5 h-3.5" />
          Línea Skincare detectada · 8 atributos cerrados disponibles
        </div>

        {/* Tipo SKC · single rect */}
        <ChipsCerrados
          label="Tipo SKC"
          required
          modo="single"
          variante="rect"
          tema="amber"
          options={opcionesTipoSKC}
          value={skc.tipo ?? ''}
          onChange={(v) => setSkc({ tipo: v as TipoProductoSKC })}
        />

        {/* Ingrediente clave + Línea de marca · grid 2 cols (Volumen movido a Sec.3 Contenido neto S3.2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ingrediente clave">
            <input
              type="text"
              value={skc.ingredienteClave ?? ''}
              onChange={e => setSkc({ ingredienteClave: e.target.value })}
              placeholder="ej. Vitamina C 15% · TECA + Colágeno"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </Field>
          <Field label="Línea de marca">
            <input
              type="text"
              value={skc.lineaProducto ?? ''}
              onChange={e => setSkc({ lineaProducto: e.target.value })}
              placeholder="ej. C E Ferulic · Madeca Cream"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </Field>
        </div>

        {/* Tipo de piel · multi pill */}
        <ChipsCerrados
          label="Tipo de piel"
          modo="multi"
          variante="pill"
          tema="amber"
          options={opcionesTipoPiel}
          value={skc.tipoPiel ?? []}
          onChange={(v) => setSkc({ tipoPiel: v as string[] })}
        />

        {/* Preocupaciones · multi pill */}
        <ChipsCerrados
          label="Preocupaciones que aborda"
          modo="multi"
          variante="pill"
          tema="amber"
          options={opcionesPreocupaciones}
          value={skc.preocupaciones ?? []}
          onChange={(v) => setSkc({ preocupaciones: v as string[] })}
          helperText="Beneficios principales · sirve para matchear con preocupaciones del cliente"
        />

        {/* Paso rutina + Textura · grid 2 cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChipsCerrados
            label="Paso de rutina"
            modo="single"
            variante="rect"
            tema="amber"
            options={opcionesPasoRutina}
            value={skc.pasoRutina ?? ''}
            onChange={(v) => setSkc({ pasoRutina: v as PasoRutinaSKC })}
            helperText="Sin orden numérico · etapa flexible"
          />
          <ChipsCerrados
            label="Textura"
            modo="single"
            variante="rect"
            tema="amber"
            options={opcionesTextura}
            value={skc.textura ?? ''}
            onChange={(v) => setSkc({ textura: v as TexturaSKC })}
          />
        </div>

        {/* Zona aplicación · multi pill */}
        <ChipsCerrados
          label="Zona de aplicación"
          modo="multi"
          variante="pill"
          tema="amber"
          options={opcionesZona}
          value={skc.zona ?? []}
          onChange={(v) => setSkc({ zona: v as string[] })}
        />

        {/* SPF + PA · solo si Tipo = Protector Solar */}
        {esProtectorSolar && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold text-[11px]">
              <Sun className="w-3.5 h-3.5" />
              Campos de Protección Solar
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SPF">
                <input
                  type="number"
                  value={skc.spf ?? ''}
                  onChange={e => setSkc({ spf: e.target.value })}
                  placeholder="50"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </Field>
              <Field label="PA">
                <input
                  type="text"
                  value={skc.pa ?? ''}
                  onChange={e => setSkc({ pa: e.target.value })}
                  placeholder="PA++++"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── SUP ──────────────────────────────────────────────────────────────────
  if (esSUP) {
    const setSup = (patch: Partial<AtributosLineaSUPValue>) => onChangeSUP?.(patch);
    const restricciones = sup.restricciones ?? [];
    const advertencias = sup.advertencias ?? '';
    return (
      <div className="space-y-4 border-l-2 border-indigo-300 pl-3">
        <div className="flex items-center gap-2 text-indigo-800 font-bold text-[11px]">
          <Pill className="w-3.5 h-3.5" />
          Línea Suplementos detectada · 7 atributos · presentación se infiere de la unidad en Sec.3
        </div>

        {/* S3.4 (2026-05-04) · Presentación SUP ELIMINADA del wizard/editor.
            La unidad del Contenido neto en Sec.3 (cápsulas/tabletas/polvo/ml/g)
            ya define la presentación física. El campo `presentacion` en
            AtributosSuplementos quedó @deprecated pero sigue disponible para
            lectura de productos legacy. */}

        {/* Servings/día + Sabor · grid 2 cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Servings/día">
            <div className="relative">
              <input
                type="number"
                min="1"
                value={sup.servingsDia ?? '1'}
                onChange={e => setSup({ servingsDia: e.target.value })}
                className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                /día
              </span>
            </div>
          </Field>
          <Field label="Sabor">
            <input
              type="text"
              value={sup.sabor ?? ''}
              onChange={e => setSup({ sabor: e.target.value })}
              placeholder="ej. Limón · sin sabor"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <div className="mt-1 flex flex-wrap gap-1 items-center">
              <span className="text-[9px] text-slate-500 italic">Más usados:</span>
              {SABORES_SUGERIDOS.slice(0, 5).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSup({ sabor: s })}
                  className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] border border-amber-200"
                >
                  + {s}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Dosaje · TEXT+SUG (S3.2 movido desde top-level) */}
        <Field label="Dosaje (composición)">
          <input
            type="text"
            value={sup.dosaje ?? ''}
            onChange={e => setSup({ dosaje: e.target.value })}
            placeholder='ej. "5000 IU D3 + 100 mcg K2 (MK-7)"'
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <div className="text-[9px] text-slate-500 mt-1 italic">
            Ingredientes activos por serving
          </div>
        </Field>

        {/* Restricciones · chips creables */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            Restricciones / certificaciones
          </label>
          <div className="border border-amber-300 rounded-lg p-2 bg-white min-h-[34px]">
            <div className="flex flex-wrap gap-1.5 items-center">
              {restricciones.map(r => (
                <span
                  key={r}
                  className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1"
                >
                  ✓ {r}
                  <button
                    type="button"
                    onClick={() => setSup({ restricciones: restricciones.filter(x => x !== r) })}
                    className="hover:text-amber-900"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {restricciones.length === 0 && (
                <span className="text-[10px] text-slate-400 italic">
                  Sin restricciones · usa los chips de abajo
                </span>
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 items-center">
            <span className="text-[9px] text-slate-500 italic">Más usadas:</span>
            {RESTRICCIONES_SUGERIDAS.filter(r => !restricciones.includes(r))
              .slice(0, 7)
              .map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSup({ restricciones: [...restricciones, r] })}
                  className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] border border-amber-200"
                >
                  + {r}
                </button>
              ))}
          </div>
        </div>

        {/* Momento del día · multi pill */}
        <ChipsCerrados
          label="Momento del día"
          modo="multi"
          variante="pill"
          tema="indigo"
          options={opcionesMomentoDia}
          value={sup.momentoDia ?? []}
          onChange={(v) => setSup({ momentoDia: v as string[] })}
          helperText="ej: Mañana + Noche · multi-select"
        />

        {/* Toma con/sin comida + Edad · grid 2 cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChipsCerrados
            label="Toma con/sin comida"
            modo="single"
            variante="pill"
            tema="indigo"
            options={opcionesTomaConComida}
            value={sup.tomaConComida ?? ''}
            onChange={(v) => setSup({ tomaConComida: v as TomaConComida })}
          />
          <ChipsCerrados
            label="Edad recomendada"
            modo="single"
            variante="pill"
            tema="indigo"
            options={opcionesEdad}
            value={sup.edad ?? ''}
            onChange={(v) => setSup({ edad: v as EdadRecomendada })}
          />
        </div>

        {/* Advertencias · textarea + sugerencias */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
            Advertencias
          </label>
          <textarea
            rows={2}
            value={advertencias}
            onChange={e => setSup({ advertencias: e.target.value })}
            placeholder="ej: no recomendado en embarazo · contraindicado con anticoagulantes..."
            className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <div className="mt-1 flex flex-wrap gap-1 items-center">
            <span className="text-[9px] text-slate-500 italic">Sugerencias:</span>
            {[
              'no en embarazo',
              'no en lactancia',
              'puede causar somnolencia',
              'consultar con médico',
            ].map(s => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSup({ advertencias: advertencias ? `${advertencias} · ${s}` : s })
                }
                className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] border border-rose-200"
              >
                + {s}
              </button>
            ))}
          </div>
          <div className="text-[9px] text-slate-500 mt-1 italic">
            Aparece en la card del producto · investigación · etiqueta de salida
          </div>
        </div>
      </div>
    );
  }

  return null;
};
