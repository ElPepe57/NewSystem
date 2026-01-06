import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  Percent,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Modal, Button, Badge, Input, Select } from '../../common';
import type { Producto } from '../../../types/producto.types';
import type { Unidad } from '../../../types/unidad.types';

interface PromocionModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: Producto | null;
  unidadesAfectadas?: Unidad[];
  valorOriginal?: number;
  diasParaVencer?: number;
  onCrearPromocion?: (promocion: PromocionData) => void;
}

export interface PromocionData {
  productoId: string;
  porcentajeDescuento: number;
  fechaInicio: string;
  fechaFin: string;
  motivo: 'vencimiento' | 'liquidacion' | 'temporada' | 'otro';
  notas: string;
  valorOriginal: number;
  valorConDescuento: number;
  unidadesAfectadas: number;
}

// Descuentos sugeridos según días para vencer
const calcularDescuentoSugerido = (dias?: number): number => {
  if (dias === undefined) return 20;
  if (dias <= 7) return 40;
  if (dias <= 15) return 30;
  if (dias <= 30) return 20;
  return 10;
};

export const PromocionModal: React.FC<PromocionModalProps> = ({
  isOpen,
  onClose,
  producto,
  unidadesAfectadas = [],
  valorOriginal = 0,
  diasParaVencer,
  onCrearPromocion
}) => {
  const descuentoInicial = calcularDescuentoSugerido(diasParaVencer);

  const [porcentajeDescuento, setPorcentajeDescuento] = useState(descuentoInicial);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(() => {
    const fin = new Date();
    fin.setDate(fin.getDate() + (diasParaVencer || 30));
    return fin.toISOString().split('T')[0];
  });
  const [motivo, setMotivo] = useState<'vencimiento' | 'liquidacion' | 'temporada' | 'otro'>(
    diasParaVencer ? 'vencimiento' : 'liquidacion'
  );
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cálculos
  const valorConDescuento = useMemo(() =>
    valorOriginal * (1 - porcentajeDescuento / 100),
    [valorOriginal, porcentajeDescuento]
  );

  const ahorro = useMemo(() =>
    valorOriginal - valorConDescuento,
    [valorOriginal, valorConDescuento]
  );

  // Formato de moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Handler para guardar
  const handleGuardar = async () => {
    if (!producto) return;

    setGuardando(true);
    try {
      const promocion: PromocionData = {
        productoId: producto.id,
        porcentajeDescuento,
        fechaInicio,
        fechaFin,
        motivo,
        notas,
        valorOriginal,
        valorConDescuento,
        unidadesAfectadas: unidadesAfectadas.length
      };

      onCrearPromocion?.(promocion);
      onClose();
    } catch (error) {
      console.error('Error al crear promoción:', error);
    } finally {
      setGuardando(false);
    }
  };

  // Descuentos rápidos
  const descuentosRapidos = [10, 20, 30, 40, 50];

  if (!producto) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Promoción"
      size="lg"
    >
      <div className="space-y-6">
        {/* Info del Producto */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Megaphone className="h-6 w-6 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-mono text-lg font-bold text-gray-900">{producto.sku}</h4>
              <p className="text-sm text-gray-600">{producto.marca} · {producto.nombreComercial}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="default" size="sm">
                  {unidadesAfectadas.length} unidades
                </Badge>
                {diasParaVencer !== undefined && (
                  <Badge variant={diasParaVencer <= 15 ? 'danger' : 'warning'} size="sm">
                    <Clock className="h-3 w-3 mr-1" />
                    Vence en {diasParaVencer} días
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selector de Descuento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Porcentaje de Descuento
          </label>

          {/* Botones de descuento rápido */}
          <div className="flex gap-2 mb-3">
            {descuentosRapidos.map(d => (
              <button
                key={d}
                onClick={() => setPorcentajeDescuento(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  porcentajeDescuento === d
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {d}%
              </button>
            ))}
          </div>

          {/* Slider de descuento */}
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="70"
              value={porcentajeDescuento}
              onChange={(e) => setPorcentajeDescuento(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex items-center gap-1 bg-primary-100 rounded-lg px-3 py-2">
              <Percent className="h-4 w-4 text-primary-600" />
              <span className="text-xl font-bold text-primary-700">{porcentajeDescuento}</span>
            </div>
          </div>
        </div>

        {/* Cálculo de Valores */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-sm text-gray-500 mb-1">Valor Original</div>
            <div className="text-lg font-bold text-gray-900 line-through decoration-red-400">
              {formatCurrency(valorOriginal)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
            <div className="text-sm text-green-600 mb-1">Valor con Descuento</div>
            <div className="text-xl font-bold text-green-700">
              {formatCurrency(valorConDescuento)}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200">
            <div className="text-sm text-amber-600 mb-1">Recuperas</div>
            <div className="text-xl font-bold text-amber-700">
              {formatCurrency(valorConDescuento)}
            </div>
            <div className="text-xs text-amber-600">vs. perder {formatCurrency(valorOriginal)}</div>
          </div>
        </div>

        {/* Fechas y Motivo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              min={fechaInicio}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="vencimiento">Próximo a vencer</option>
              <option value="liquidacion">Liquidación de stock</option>
              <option value="temporada">Fin de temporada</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: Publicar en redes sociales, ofrecer a clientes frecuentes..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Recomendación */}
        {diasParaVencer !== undefined && diasParaVencer <= 30 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Recomendación para productos próximos a vencer:
                </p>
                <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                  <li>Publicar oferta en redes sociales</li>
                  <li>Enviar promoción a clientes frecuentes por WhatsApp</li>
                  <li>Considerar crear bundles con otros productos</li>
                  {diasParaVencer <= 7 && (
                    <li className="font-semibold">⚡ Promoción flash de 24-48 horas</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleGuardar}
            disabled={guardando}
          >
            {guardando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Crear Promoción
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PromocionModal;
