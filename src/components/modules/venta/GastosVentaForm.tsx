import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { AutocompleteInput, Button } from '../../common';
import type { Venta } from '../../../types/venta.types';
import type { Gasto, TipoGasto, CategoriaGasto } from '../../../types/gasto.types';
import { CATEGORIAS_GASTO, CATEGORIAS_GASTO_VENTA, TIPOS_GASTO_LABELS } from '../../../types/gasto.types';
import { gastoService } from '../../../services/gasto.service';
import { useGastoStore } from '../../../store/gastoStore';

interface GastoItem {
  id: string;
  tipo: string;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;
}

interface GastosVentaFormProps {
  venta: Venta;
  onSubmit: (gastos: GastoItem[]) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const GastosVentaForm: React.FC<GastosVentaFormProps> = ({
  venta,
  onSubmit,
  onCancel,
  loading = false
}) => {
  // Estado para gastos existentes (ya registrados en BD)
  const [gastosExistentes, setGastosExistentes] = useState<Gasto[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(true);
  const [errorGastos, setErrorGastos] = useState<string | null>(null);

  // Estado para nuevos gastos a agregar
  const [nuevosGastos, setNuevosGastos] = useState<GastoItem[]>([]);

  // Estado del formulario para agregar un nuevo item
  const [nuevaCategoria, setNuevaCategoria] = useState<CategoriaGasto>('GV');
  const [nuevoTipo, setNuevoTipo] = useState<string>('');
  const [nuevoMonto, setNuevoMonto] = useState<string>('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState<string>('');

  // Obtener gastos del sistema para sugerencias compartidas
  const { gastos: todosLosGastos, fetchGastos } = useGastoStore();

  useEffect(() => {
    if (todosLosGastos.length === 0) fetchGastos();
  }, []);

  // Construir sugerencias dinámicas (mismo patrón que GastoForm.tsx)
  const sugerenciasPorCategoria = useMemo(() => {
    const result: Record<string, string[]> = { GV: [], GD: [] };

    // 1. Tipos ya usados en gastos existentes del sistema
    todosLosGastos.forEach(g => {
      if (g.categoria && g.tipo && (g.categoria === 'GV' || g.categoria === 'GD')) {
        if (!result[g.categoria].includes(g.tipo)) {
          result[g.categoria].push(g.tipo);
        }
      }
    });

    // 2. Agregar ejemplos predefinidos que no estén ya
    (['GV', 'GD'] as CategoriaGasto[]).forEach(cat => {
      const ejemplos = CATEGORIAS_GASTO[cat]?.ejemplos || [];
      ejemplos.forEach(ej => {
        if (!result[cat].includes(ej)) result[cat].push(ej);
      });
    });

    return result;
  }, [todosLosGastos]);

  // Cargar gastos existentes de esta venta
  useEffect(() => {
    const cargarGastosExistentes = async () => {
      if (!venta.id) {
        setLoadingGastos(false);
        return;
      }

      try {
        setLoadingGastos(true);
        setErrorGastos(null);
        const gastos = await gastoService.getGastosVenta(venta.id);
        setGastosExistentes(gastos);
      } catch (error: any) {
        console.error('Error al cargar gastos existentes:', error);
        setErrorGastos('No se pudieron cargar los gastos registrados');
      } finally {
        setLoadingGastos(false);
      }
    };

    cargarGastosExistentes();
  }, [venta.id]);

  // Limpiar tipo cuando cambia la categoría
  useEffect(() => {
    setNuevoTipo('');
  }, [nuevaCategoria]);

  // Calcular totales
  const totalGastosExistentes = gastosExistentes.reduce((sum, g) => sum + g.montoPEN, 0);
  const totalNuevosGastos = nuevosGastos.reduce((sum, g) => sum + g.monto, 0);
  const totalGeneral = totalGastosExistentes + totalNuevosGastos;

  // Utilidad proyectada
  const utilidadBruta = venta.utilidadBrutaPEN || 0;
  const utilidadNeta = utilidadBruta - totalGeneral;
  const margenNeto = venta.totalPEN > 0 ? (utilidadNeta / venta.totalPEN) * 100 : 0;

  // Agregar nuevo gasto a la lista
  const handleAgregarGasto = () => {
    if (!nuevoTipo.trim() || !nuevoMonto || Number(nuevoMonto) <= 0) return;

    const nuevoItem: GastoItem = {
      id: `temp-${Date.now()}`,
      tipo: nuevoTipo.trim(),
      categoria: nuevaCategoria,
      descripcion: nuevaDescripcion || `${nuevoTipo.trim()} - ${venta.numeroVenta} - ${venta.nombreCliente}`,
      monto: Number(nuevoMonto)
    };

    setNuevosGastos([...nuevosGastos, nuevoItem]);

    // Limpiar formulario (mantener categoría)
    setNuevoTipo('');
    setNuevoMonto('');
    setNuevaDescripcion('');
  };

  // Color para cada categoría (GV/GD/GA/GO)
  const getCategoriaColor = (cat: CategoriaGasto): string => {
    const colors: Record<CategoriaGasto, string> = {
      GV: 'bg-purple-100 text-purple-700 border-purple-200',
      GD: 'bg-blue-100 text-blue-700 border-blue-200',
      GA: 'bg-amber-100 text-amber-700 border-amber-200',
      GO: 'bg-green-100 text-green-700 border-green-200'
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  // Quitar gasto de la lista de nuevos
  const handleQuitarGasto = (id: string) => {
    setNuevosGastos(nuevosGastos.filter(g => g.id !== id));
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevosGastos.length === 0) return;
    await onSubmit(nuevosGastos);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header con resumen de venta */}
      <div className="bg-gray-50 rounded-lg p-4 border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Venta {venta.numeroVenta}</h4>
            <p className="text-sm text-gray-500">{venta.nombreCliente}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Venta</p>
            <p className="text-lg font-semibold">S/ {venta.totalPEN.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Gastos ya registrados */}
      {loadingGastos ? (
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          <span className="text-sm text-gray-600">Cargando gastos registrados...</span>
        </div>
      ) : errorGastos ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600">{errorGastos}</span>
        </div>
      ) : gastosExistentes.length > 0 ? (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <h4 className="font-medium text-purple-900 flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-purple-600" />
            Gastos registrados ({gastosExistentes.length})
          </h4>
          <div className="space-y-2">
            {gastosExistentes.map((gasto) => (
              <div
                key={gasto.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    {gasto.numeroGasto}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {TIPOS_GASTO_LABELS[gasto.tipo as TipoGasto] || gasto.tipo}
                    </p>
                    <p className="text-xs text-gray-500">{gasto.descripcion}</p>
                  </div>
                </div>
                <span className="font-medium text-purple-700">
                  S/ {gasto.montoPEN.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-purple-200">
              <span className="text-sm font-medium text-purple-900">Subtotal registrado:</span>
              <span className="font-bold text-purple-700">S/ {totalGastosExistentes.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4 border text-center">
          <p className="text-sm text-gray-500">No hay gastos registrados para esta venta</p>
        </div>
      )}

      {/* Formulario para agregar nuevo gasto */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar nuevo gasto
        </h4>

        {/* Selector de categoría */}
        <div className="flex gap-2 mb-4">
          {CATEGORIAS_GASTO_VENTA.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setNuevaCategoria(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                nuevaCategoria === cat
                  ? getCategoriaColor(cat)
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat === 'GV' ? 'Gasto de Venta (GV)' : 'Distribución (GD)'}
            </button>
          ))}
        </div>

        <div className={`p-3 rounded-lg border mb-4 ${nuevaCategoria === 'GD' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}>
          <div className="flex items-start gap-2">
            <Info className={`h-4 w-4 flex-shrink-0 mt-0.5 ${nuevaCategoria === 'GD' ? 'text-blue-600' : 'text-purple-600'}`} />
            <div>
              {nuevaCategoria === 'GV' ? (
                <>
                  <p className="text-sm font-medium text-purple-800">Gastos de Venta (GV)</p>
                  <p className="text-xs text-purple-600 mt-0.5">
                    Comisiones, pasarelas de pago, fees de plataformas, marketing directo
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-blue-800">Gastos de Distribución (GD)</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Costos adicionales de transporte, recargos, empaque extra
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <AutocompleteInput
              label="Tipo de gasto"
              value={nuevoTipo}
              onChange={(value) => setNuevoTipo(value)}
              suggestions={sugerenciasPorCategoria[nuevaCategoria] || []}
              placeholder="Escribe o selecciona..."
              allowCreate={true}
              createLabel="Crear tipo"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto (S/)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={nuevoMonto}
              onChange={(e) => setNuevoMonto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={nuevaDescripcion}
              onChange={(e) => setNuevaDescripcion(e.target.value)}
              placeholder="Detalle del gasto..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleAgregarGasto}
              disabled={!nuevoTipo.trim() || !nuevoMonto || Number(nuevoMonto) <= 0}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de nuevos gastos a registrar */}
      {nuevosGastos.length > 0 && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="font-medium text-green-900 mb-3">
            Nuevos gastos a registrar ({nuevosGastos.length})
          </h4>
          <div className="space-y-2">
            {nuevosGastos.map((gasto) => (
              <div
                key={gasto.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${getCategoriaColor(gasto.categoria)}`}>
                    {gasto.categoria}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {TIPOS_GASTO_LABELS[gasto.tipo as TipoGasto] || gasto.tipo}
                    </p>
                    <p className="text-xs text-gray-500">{gasto.descripcion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-green-700">
                    S/ {gasto.monto.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuitarGasto(gasto.id)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-green-200">
              <span className="text-sm font-medium text-green-900">Subtotal nuevos:</span>
              <span className="font-bold text-green-700">S/ {totalNuevosGastos.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de impacto */}
      <div className="bg-gradient-to-r from-primary-50 to-success-50 rounded-lg p-4 border border-primary-200">
        <h4 className="font-medium text-gray-900 mb-3">Impacto en Rentabilidad</h4>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Utilidad Bruta:</span>
            <span className="font-medium">S/ {utilidadBruta.toFixed(2)}</span>
          </div>
          {totalGastosExistentes > 0 && (
            <div className="flex justify-between text-purple-600">
              <span>Gastos ya registrados:</span>
              <span className="font-medium">- S/ {totalGastosExistentes.toFixed(2)}</span>
            </div>
          )}
          {totalNuevosGastos > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Nuevos gastos:</span>
              <span className="font-medium">- S/ {totalNuevosGastos.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium text-gray-900">Utilidad Neta Proyectada:</span>
            <span className={`font-bold ${utilidadNeta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              S/ {utilidadNeta.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Margen Neto:</span>
            <span className={`font-medium ${margenNeto >= 20 ? 'text-success-600' : margenNeto >= 10 ? 'text-warning-600' : 'text-danger-600'}`}>
              {margenNeto.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || nuevosGastos.length === 0}
        >
          {loading ? 'Guardando...' : `Registrar ${nuevosGastos.length} gasto(s)`}
        </Button>
      </div>
    </form>
  );
};
