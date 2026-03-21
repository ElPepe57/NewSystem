import React from 'react';
import { AlertTriangle, ThumbsDown } from 'lucide-react';
import { Modal, Select, Button } from '../../components/common';
import { formatCurrencyPEN } from '../../utils/format';
import type { Cotizacion, MotivoRechazo } from '../../types/cotizacion.types';

export const MOTIVOS_RECHAZO: { value: MotivoRechazo; label: string }[] = [
  { value: 'precio_alto', label: 'Precio muy alto' },
  { value: 'encontro_mejor_opcion', label: 'Encontró mejor opción' },
  { value: 'sin_presupuesto', label: 'Sin presupuesto' },
  { value: 'producto_diferente', label: 'Quería otro producto' },
  { value: 'demora_entrega', label: 'Demora en entrega' },
  { value: 'cambio_necesidad', label: 'Ya no necesita' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'otro', label: 'Otro motivo' }
];

interface RechazoModalProps {
  isOpen: boolean;
  cotizacion: Cotizacion;
  motivo: MotivoRechazo;
  descripcion: string;
  onMotivo: (v: MotivoRechazo) => void;
  onDescripcion: (v: string) => void;
  onConfirmar: () => Promise<void>;
  onClose: () => void;
}

export const RechazoModal: React.FC<RechazoModalProps> = ({
  isOpen,
  cotizacion,
  motivo,
  descripcion,
  onMotivo,
  onDescripcion,
  onConfirmar,
  onClose
}) => {
  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rechazar Cotización"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Cotización</p>
          <p className="font-semibold text-primary-600">{cotizacion.numeroCotizacion}</p>
          <p className="text-sm mt-1">{cotizacion.nombreCliente}</p>
          <p className="text-lg font-bold mt-2">{formatCurrency(cotizacion.totalPEN)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motivo del rechazo
          </label>
          <Select
            value={motivo}
            onChange={(e) => onMotivo(e.target.value as MotivoRechazo)}
            options={MOTIVOS_RECHAZO}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción adicional (opcional)
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => onDescripcion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
            placeholder="¿Qué dijo el cliente? ¿Fue a la competencia?"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Esta información se guardará para análisis de demanda
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirmar}>
            <ThumbsDown className="h-4 w-4 mr-2" />
            Confirmar Rechazo
          </Button>
        </div>
      </div>
    </Modal>
  );
};
