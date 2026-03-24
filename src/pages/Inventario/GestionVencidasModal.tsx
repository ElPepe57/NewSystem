import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  Heart,
  CheckCircle,
  Package,
  Clock,
} from 'lucide-react';
import { Modal, Button, Badge } from '../../components/common';
import { bajaInventarioService } from '../../services/bajaInventario.service';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import type { DisposicionVencida } from '../../types/unidad.types';

const OPCIONES_DISPOSICION: {
  value: DisposicionVencida;
  label: string;
  descripcion: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'baja_definitiva',
    label: 'Baja definitiva',
    descripcion: 'Destruir/descartar. Genera gasto contable (cuenta 6951).',
    icon: Trash2,
    color: 'red',
  },
  {
    value: 'donacion',
    label: 'Donación',
    descripcion: 'Donar a terceros. No genera gasto contable.',
    icon: Heart,
    color: 'purple',
  },
];

interface DecisionVencida {
  disposicion?: DisposicionVencida;
  motivo: string;
  destinatario?: string;
}

interface GestionVencidasModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const GestionVencidasModal: React.FC<GestionVencidasModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [unidadesVencidas, setUnidadesVencidas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmacion, setShowConfirmacion] = useState(false);
  const [decisiones, setDecisiones] = useState<Record<string, DecisionVencida>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const vencidas = await bajaInventarioService.getUnidadesVencidasPendientes();
        setUnidadesVencidas(vencidas);
        const init: Record<string, DecisionVencida> = {};
        vencidas.forEach((u: any) => { init[u.id] = { motivo: '' }; });
        setDecisiones(init);
      } catch {
        toast.error('Error al cargar unidades vencidas');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resueltas = unidadesVencidas.filter(u => decisiones[u.id]?.disposicion).length;
  const todasResueltas = resueltas === unidadesVencidas.length && unidadesVencidas.length > 0;

  const updateDecision = (id: string, field: keyof DecisionVencida, value: any) => {
    setDecisiones(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const getDiasVencida = (fechaVenc: any) => {
    if (!fechaVenc) return null;
    const fecha = fechaVenc.toDate ? fechaVenc.toDate() : new Date(fechaVenc);
    return Math.abs(Math.floor((Date.now() - fecha.getTime()) / 86400000));
  };

  const handleConfirmar = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const bajas = unidadesVencidas
        .filter(u => decisiones[u.id]?.disposicion)
        .map(u => ({
          unidadId: u.id,
          productoId: u.productoId,
          productoNombre: u.productoNombre || u.sku,
          sku: u.sku,
          disposicion: decisiones[u.id].disposicion!,
          motivo: decisiones[u.id].motivo || 'Producto vencido',
          costoUnidadPEN: u.ctruInicial?.costoBasePEN || u.costoBasePEN || 0,
          costoUnidadUSD: u.costoBaseUSD || u.costoUnitarioUSD || 0,
          destinatarioDonacion: decisiones[u.id].destinatario,
        }));

      const resultados = await bajaInventarioService.procesarBajasVencimientoLote(bajas, user.uid);
      const gastos = resultados.filter(r => r.gastoGenerado).length;

      let msg = `${resultados.length} unidades procesadas`;
      if (gastos > 0) msg += ` · ${gastos} gastos registrados en cuenta 6951`;

      toast.success(msg);
      onSuccess();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen onClose={onClose} title="Unidades Vencidas" size="lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
        </div>
      </Modal>
    );
  }

  if (unidadesVencidas.length === 0) {
    return (
      <Modal isOpen onClose={onClose} title="Unidades Vencidas" size="md">
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" />
          <p className="font-medium">Sin unidades vencidas</p>
          <p className="text-sm mt-1">No hay productos pendientes de gestión.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Unidades Vencidas — Pendientes de Gestión" size="lg">
      <div className="space-y-4">
        {/* Progress */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800">
                {unidadesVencidas.length} unidad{unidadesVencidas.length !== 1 ? 'es' : ''} vencida{unidadesVencidas.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Badge variant={todasResueltas ? 'success' : 'danger'}>
              {resueltas}/{unidadesVencidas.length} decididas
            </Badge>
          </div>
          <div className="w-full bg-red-200 rounded-full h-1.5 mt-2">
            <div
              className="bg-red-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(resueltas / unidadesVencidas.length) * 100}%` }}
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {unidadesVencidas.map(u => {
            const decision = decisiones[u.id];
            const isDecided = !!decision?.disposicion;
            const diasVencida = getDiasVencida(u.fechaVencimiento);

            return (
              <div
                key={u.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  isDecided ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-white'
                }`}
              >
                {/* Product info */}
                <div className="p-3 bg-gray-50 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {u.productoNombre || u.sku}
                        </p>
                        <p className="text-xs text-gray-500">{u.sku}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {diasVencida !== null && (
                        <span className="text-xs text-red-600 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          hace {diasVencida}d
                        </span>
                      )}
                      <Badge variant="danger">Vencida</Badge>
                    </div>
                  </div>
                  {u.costoBasePEN > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Costo: S/{(u.ctruInicial?.costoBasePEN || u.costoBasePEN || 0).toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Disposition */}
                <div className="p-3 space-y-3">
                  <fieldset>
                    <legend className="sr-only">Disposición para {u.sku}</legend>
                    <div className="space-y-2">
                      {OPCIONES_DISPOSICION.map(op => {
                        const isSelected = decision?.disposicion === op.value;
                        const Icon = op.icon;
                        return (
                          <label
                            key={op.value}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                              isSelected
                                ? op.color === 'red' ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'
                                : 'border-transparent hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`disposicion-${u.id}`}
                              value={op.value}
                              checked={isSelected}
                              onChange={() => updateDecision(u.id, 'disposicion', op.value)}
                              className="text-red-600 focus:ring-red-500"
                            />
                            <Icon className={`h-4 w-4 flex-shrink-0 ${
                              isSelected ? (op.color === 'red' ? 'text-red-600' : 'text-purple-600') : 'text-gray-400'
                            }`} />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{op.label}</span>
                              <span className="block text-xs text-gray-500">{op.descripcion}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Destinatario donación */}
                  {decision?.disposicion === 'donacion' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Destinatario
                      </label>
                      <input
                        type="text"
                        value={decision.destinatario || ''}
                        onChange={(e) => updateDecision(u.id, 'destinatario', e.target.value)}
                        placeholder="Ej: Cruz Roja, empleados"
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  )}

                  {/* Motivo */}
                  {decision?.disposicion && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Motivo adicional (opcional)
                      </label>
                      <input
                        type="text"
                        value={decision.motivo}
                        onChange={(e) => updateDecision(u.id, 'motivo', e.target.value)}
                        placeholder="Producto vencido"
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-red-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirmation */}
        {showConfirmacion && todasResueltas && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3" role="alertdialog">
            <p className="text-sm font-medium text-gray-900 mb-2">Acciones a ejecutar:</p>
            <ul className="space-y-1.5 text-xs text-gray-700">
              {unidadesVencidas.map(u => {
                const decision = decisiones[u.id];
                const opcion = OPCIONES_DISPOSICION.find(o => o.value === decision?.disposicion);
                return (
                  <li key={u.id} className="flex items-center gap-2">
                    <span className="font-mono text-gray-500">{u.sku}</span>
                    <span>→</span>
                    <span className="font-medium">{opcion?.label}</span>
                    {decision?.disposicion === 'baja_definitiva' && (
                      <span className="text-red-600">
                        (gasto: S/{(u.ctruInicial?.costoBasePEN || u.costoBasePEN || 0).toFixed(2)})
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t sticky bottom-0 bg-white">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {!showConfirmacion ? (
              <Button
                variant="primary"
                onClick={() => setShowConfirmacion(true)}
                disabled={!todasResueltas || submitting}
              >
                Revisar y confirmar ({resueltas}/{unidadesVencidas.length})
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setShowConfirmacion(false)} disabled={submitting}>
                  Atrás
                </Button>
                <Button variant="primary" onClick={handleConfirmar} disabled={submitting}>
                  {submitting ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Procesando...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmar todo
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
