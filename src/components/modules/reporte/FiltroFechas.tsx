import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '../../common';

export type PeriodoPreset = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'anio' | 'custom';

interface FiltroFechasProps {
  onFiltroChange: (fechaInicio: Date, fechaFin: Date, periodo: PeriodoPreset) => void;
  periodoInicial?: PeriodoPreset;
}

export const FiltroFechas: React.FC<FiltroFechasProps> = ({
  onFiltroChange,
  periodoInicial = 'mes'
}) => {
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoPreset>(periodoInicial);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [mostrarCustom, setMostrarCustom] = useState(false);

  const calcularFechas = (periodo: PeriodoPreset): { inicio: Date; fin: Date } => {
    const ahora = new Date();
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
    let inicio: Date;

    switch (periodo) {
      case 'hoy':
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
        break;
      case 'semana':
        inicio = new Date(ahora);
        inicio.setDate(ahora.getDate() - 7);
        inicio.setHours(0, 0, 0, 0);
        break;
      case 'mes':
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        break;
      case 'trimestre':
        inicio = new Date(ahora);
        inicio.setMonth(ahora.getMonth() - 3);
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);
        break;
      case 'anio':
        inicio = new Date(ahora.getFullYear(), 0, 1);
        break;
      case 'custom':
        inicio = fechaInicio ? new Date(fechaInicio) : new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        break;
      default:
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    }

    return { inicio, fin };
  };

  const handlePeriodoClick = (periodo: PeriodoPreset) => {
    if (periodo === 'custom') {
      setMostrarCustom(true);
      return;
    }

    setMostrarCustom(false);
    setPeriodoActivo(periodo);
    const { inicio, fin } = calcularFechas(periodo);
    onFiltroChange(inicio, fin, periodo);
  };

  const handleCustomApply = () => {
    if (!fechaInicio || !fechaFin) return;

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    setPeriodoActivo('custom');
    onFiltroChange(inicio, fin, 'custom');
  };

  const periodos: { key: PeriodoPreset; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: '7 dias' },
    { key: 'mes', label: 'Este mes' },
    { key: 'trimestre', label: '3 meses' },
    { key: 'anio', label: 'Este año' },
    { key: 'custom', label: 'Personalizado' }
  ];

  const formatRango = () => {
    const { inicio, fin } = calcularFechas(periodoActivo);
    const opciones: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };

    if (periodoActivo === 'hoy') {
      return inicio.toLocaleDateString('es-PE', { ...opciones, year: 'numeric' });
    }

    return `${inicio.toLocaleDateString('es-PE', opciones)} - ${fin.toLocaleDateString('es-PE', { ...opciones, year: 'numeric' })}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-gray-600 mr-2">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">Periodo:</span>
        </div>

        {/* Botones de periodo */}
        <div className="flex flex-wrap gap-1">
          {periodos.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handlePeriodoClick(key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                periodoActivo === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Rango activo */}
        <div className="ml-auto text-sm text-gray-500">
          {formatRango()}
        </div>
      </div>

      {/* Selector personalizado */}
      {mostrarCustom && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCustomApply}
            disabled={!fechaInicio || !fechaFin}
          >
            Aplicar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarCustom(false)}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
};
