/**
 * DatosSocioForm · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * Sub-formulario para el tab "Datos de socio" en el modal /usuarios.
 *
 * Pixel-perfect contra mockup `modelo-personas-v5.2.html` ESTADO A2.3.
 *
 * Captura:
 *  - % participación
 *  - fecha ingreso al negocio
 *  - rol descriptivo en el negocio
 *  - tipo de participación (cash_puro / mixta / valor_puro) · radio cards
 *  - aporte de valor (tipos · descripción · valuación opcional · vesting opcional)
 *
 * El form maneja conversión Date↔Timestamp automáticamente.
 */

import React, { useState, useEffect } from 'react';
import {
  Lightbulb, Banknote, Puzzle, Sparkles,
  Brain, Crown, Network, Megaphone, Lightbulb as LightbulbIcon, Clock, Building, MoreHorizontal,
  CalendarClock, Eye,
} from 'lucide-react';
import { formatCurrencyPEN } from '../../../utils/format';
import type {
  DatosSocio,
  DatosSocioFormData,
  TipoParticipacionSocio,
  TipoAporteValor,
} from '../../../types/datosSocio.types';
import {
  TIPO_PARTICIPACION_LABEL,
  TIPO_PARTICIPACION_DESC,
  TIPO_VALOR_LABEL,
} from '../../../types/datosSocio.types';

interface Props {
  /** Datos existentes · undefined si es creación */
  initialData?: DatosSocio;
  /** Notify cambios al padre · usado para guardar */
  onChange: (data: DatosSocioFormData | null, isValid: boolean) => void;
}

// Mapa de iconos · necesario porque no podemos pasar componentes por string
const ICON_MAP: Record<TipoAporteValor, React.ReactNode> = {
  know_how: <Brain className="w-3.5 h-3.5" />,
  gestion_ceo: <Crown className="w-3.5 h-3.5" />,
  networking_clientes: <Network className="w-3.5 h-3.5" />,
  marca_personal: <Megaphone className="w-3.5 h-3.5" />,
  idea_original_ip: <LightbulbIcon className="w-3.5 h-3.5" />,
  tiempo_dedicacion: <Clock className="w-3.5 h-3.5" />,
  activos_no_monetarios: <Building className="w-3.5 h-3.5" />,
  otro: <MoreHorizontal className="w-3.5 h-3.5" />,
};

const TIPOS_VALOR_ORDEN: TipoAporteValor[] = [
  'know_how', 'gestion_ceo', 'networking_clientes', 'marca_personal',
  'idea_original_ip', 'tiempo_dedicacion', 'activos_no_monetarios', 'otro',
];

export default function DatosSocioForm({ initialData, onChange }: Props) {
  const [porcentaje, setPorcentaje] = useState<string>(initialData?.porcentajeParticipacion?.toString() ?? '');
  const [fechaIngreso, setFechaIngreso] = useState<string>(() => {
    if (initialData?.fechaIngresoNegocio) {
      return initialData.fechaIngresoNegocio.toDate().toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [rolNegocio, setRolNegocio] = useState<string>(initialData?.rolEnNegocio ?? '');
  const [tipoParticipacion, setTipoParticipacion] = useState<TipoParticipacionSocio>(
    initialData?.tipoParticipacion ?? 'mixta'
  );
  const [tiposValor, setTiposValor] = useState<TipoAporteValor[]>(initialData?.aporteDeValor?.tiposDeValor ?? []);
  const [descripcionValor, setDescripcionValor] = useState<string>(initialData?.aporteDeValor?.descripcion ?? '');
  const [valuacionStr, setValuacionStr] = useState<string>(
    initialData?.aporteDeValor?.valuacionEstimadaPEN?.toString() ?? ''
  );
  const [notas, setNotas] = useState<string>(initialData?.notas ?? '');

  // Vesting
  const [vestingTipo, setVestingTipo] = useState<'inmediato' | 'lineal' | 'cliff'>(
    initialData?.aporteDeValor?.vesting?.tipoVesting ?? 'inmediato'
  );
  const [vestingMeses, setVestingMeses] = useState<string>(
    initialData?.aporteDeValor?.vesting?.mesesVesting?.toString() ?? '36'
  );
  const [vestingCliff, setVestingCliff] = useState<string>(
    initialData?.aporteDeValor?.vesting?.mesesCliff?.toString() ?? '12'
  );

  // Validación y notify al padre
  useEffect(() => {
    const pct = parseFloat(porcentaje);
    const valid =
      !isNaN(pct) && pct >= 0 && pct <= 100 &&
      fechaIngreso.trim() !== '' &&
      (tipoParticipacion === 'cash_puro' ||
        (tiposValor.length > 0 && descripcionValor.trim() !== ''));

    if (!valid) {
      onChange(null, false);
      return;
    }

    const data: DatosSocioFormData = {
      porcentajeParticipacion: pct,
      fechaIngresoNegocio: new Date(fechaIngreso),
      tipoParticipacion,
    };
    if (rolNegocio.trim()) data.rolEnNegocio = rolNegocio.trim();
    if (notas.trim()) data.notas = notas.trim();

    if (tipoParticipacion !== 'cash_puro') {
      const valuacionNum = parseFloat(valuacionStr);
      data.aporteDeValor = {
        tiposDeValor: tiposValor,
        descripcion: descripcionValor.trim(),
      };
      if (!isNaN(valuacionNum) && valuacionNum > 0) {
        data.aporteDeValor.valuacionEstimadaPEN = valuacionNum;
      }
      if (vestingTipo !== 'inmediato') {
        data.aporteDeValor.vesting = {
          tipoVesting: vestingTipo,
          mesesVesting: parseInt(vestingMeses, 10) || undefined,
        };
        if (vestingTipo === 'cliff') {
          data.aporteDeValor.vesting.mesesCliff = parseInt(vestingCliff, 10) || undefined;
        }
      } else {
        data.aporteDeValor.vesting = { tipoVesting: 'inmediato' };
      }
    }

    onChange(data, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    porcentaje, fechaIngreso, rolNegocio, tipoParticipacion,
    tiposValor, descripcionValor, valuacionStr, notas,
    vestingTipo, vestingMeses, vestingCliff,
  ]);

  const toggleTipoValor = (tipo: TipoAporteValor) => {
    setTiposValor((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  const valuacionNum = parseFloat(valuacionStr) || 0;
  const showValorSection = tipoParticipacion !== 'cash_puro';

  return (
    <div className="space-y-3">
      {/* Banner pedagógico de la sección */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-amber-900">
          <strong>La participación no se mide solo en dinero · también en VALOR aportado.</strong><br />
          Ejemplo: un socio puede tener 30% del negocio aunque NO haya puesto cash · porque trae cartera de clientes,
          know-how o gestión full-time sin sueldo.
        </div>
      </div>

      {/* Datos básicos */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">% Participación *</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-violet-500 focus:outline-none"
            placeholder="ej: 60"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Fecha ingreso al negocio *</label>
          <input
            type="date"
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Rol en el negocio (descriptivo)</label>
        <input
          type="text"
          value={rolNegocio}
          onChange={(e) => setRolNegocio(e.target.value)}
          placeholder="ej: Co-fundador · CEO"
          className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-violet-500 focus:outline-none"
        />
        <div className="text-[10px] text-slate-500 mt-0.5">Cargo de negocio · NO el rol del sistema</div>
      </div>

      {/* Naturaleza de la participación · radio cards */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
          ¿Cómo se compone tu participación? *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className={`flex items-start gap-2 p-2.5 border-2 rounded-lg cursor-pointer ${tipoParticipacion === 'cash_puro' ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="tipo_participacion"
              checked={tipoParticipacion === 'cash_puro'}
              onChange={() => setTipoParticipacion('cash_puro')}
              className="mt-0.5 accent-emerald-600"
            />
            <div>
              <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                <Banknote className="w-3 h-3 text-emerald-700" />
                Cash puro
              </div>
              <div className="text-[10px] text-slate-500">Todo el aporte es dinero</div>
            </div>
          </label>
          <label className={`flex items-start gap-2 p-2.5 border-2 rounded-lg cursor-pointer ${tipoParticipacion === 'mixta' ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="tipo_participacion"
              checked={tipoParticipacion === 'mixta'}
              onChange={() => setTipoParticipacion('mixta')}
              className="mt-0.5 accent-amber-600"
            />
            <div>
              <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                <Puzzle className="w-3 h-3 text-amber-700" />
                Mixta
              </div>
              <div className="text-[10px] text-slate-500">Cash + valor (más común)</div>
            </div>
          </label>
          <label className={`flex items-start gap-2 p-2.5 border-2 rounded-lg cursor-pointer ${tipoParticipacion === 'valor_puro' ? 'bg-violet-50 border-violet-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="tipo_participacion"
              checked={tipoParticipacion === 'valor_puro'}
              onChange={() => setTipoParticipacion('valor_puro')}
              className="mt-0.5 accent-violet-600"
            />
            <div>
              <div className="text-[11px] font-bold text-violet-900 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-700" />
                Valor puro
              </div>
              <div className="text-[10px] text-slate-500">Sin cash · solo valor</div>
            </div>
          </label>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">{TIPO_PARTICIPACION_DESC[tipoParticipacion]}</p>
      </div>

      {/* Tipos de valor + descripción + valuación · solo si mixta/valor_puro */}
      {showValorSection && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
              ¿Qué tipo de valor aportás? · multi-select *
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TIPOS_VALOR_ORDEN.map((tipo) => {
                const selected = tiposValor.includes(tipo);
                return (
                  <label
                    key={tipo}
                    className={`flex items-center gap-2 p-2 border-2 rounded cursor-pointer text-[11px] ${
                      selected ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTipoValor(tipo)}
                      className="w-3.5 h-3.5 accent-amber-600"
                    />
                    <span className={selected ? 'text-amber-700' : 'text-slate-500'}>{ICON_MAP[tipo]}</span>
                    <span className={`font-semibold ${selected ? 'text-amber-900' : 'text-slate-700'}`}>
                      {TIPO_VALOR_LABEL[tipo]}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
              Describí el aporte de valor *
            </label>
            <textarea
              rows={2}
              value={descripcionValor}
              onChange={(e) => setDescripcionValor(e.target.value)}
              placeholder="ej: 20 años en industria skincare · CEO full-time sin sueldo desde Ene 2024"
              className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1 inline-flex items-center gap-1">
              Valuación estimada del valor aportado
              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">opcional</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400">S/</span>
              <input
                type="number"
                min="0"
                value={valuacionStr}
                onChange={(e) => setValuacionStr(e.target.value)}
                placeholder="ej: 200000"
                className="w-full pl-10 pr-3 py-2 text-[14px] tabular-nums border border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Si el contador o el acuerdo de socios valuó el aporte de valor, ingresalo. Permite ROI ajustado.
            </div>
          </div>

          {/* Vesting · colapsable avanzado */}
          <details className="text-[11px]">
            <summary className="cursor-pointer text-violet-700 hover:text-violet-900 inline-flex items-center gap-1 font-semibold">
              <CalendarClock className="w-3 h-3" />
              ¿Vesting? · materialización del aporte con el tiempo · avanzado
            </summary>
            <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {(['inmediato', 'lineal', 'cliff'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                    <input
                      type="radio"
                      name="vesting"
                      checked={vestingTipo === t}
                      onChange={() => setVestingTipo(t)}
                      className="accent-violet-600"
                    />
                    <span className="capitalize">{t}</span>
                  </label>
                ))}
              </div>
              {vestingTipo !== 'inmediato' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500 block">Meses vesting</label>
                    <input
                      type="number"
                      value={vestingMeses}
                      onChange={(e) => setVestingMeses(e.target.value)}
                      className="w-full px-2 py-1 text-[11px] border border-slate-300 rounded"
                    />
                  </div>
                  {vestingTipo === 'cliff' && (
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 block">Meses cliff</label>
                      <input
                        type="number"
                        value={vestingCliff}
                        onChange={(e) => setVestingCliff(e.target.value)}
                        className="w-full px-2 py-1 text-[11px] border border-slate-300 rounded"
                      />
                    </div>
                  )}
                </div>
              )}
              {vestingTipo !== 'inmediato' && (
                <div className="text-[10px] text-slate-600">
                  Tu {porcentaje || '?'}% se materializa{' '}
                  {vestingTipo === 'lineal' ? `lineal en ${vestingMeses}m` : `con cliff de ${vestingCliff}m + ${vestingMeses}m de vesting`}.
                </div>
              )}
            </div>
          </details>

          {/* Preview · cómo va a verse en Inversionistas */}
          {valuacionNum > 0 && (
            <div className="bg-violet-50/40 border border-violet-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold mb-1.5 flex items-center gap-1.5">
                <Eye className="w-3 h-3" /> Preview en módulo Inversionistas
              </div>
              <div className="text-[11px] text-slate-700">
                {TIPO_PARTICIPACION_LABEL[tipoParticipacion]} · valor estimado{' '}
                <strong className="text-violet-900">{formatCurrencyPEN(valuacionNum)}</strong>
              </div>
            </div>
          )}
        </>
      )}

      {/* Notas */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Notas internas</label>
        <textarea
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas opcionales sobre el socio..."
          className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-violet-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
