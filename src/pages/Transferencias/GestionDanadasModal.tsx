import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Trash2,
  RotateCcw,
  Wrench,
  CheckCircle,
  Image,
  Package,
} from 'lucide-react';
import { Modal, Button, Badge } from '../../components/common';
import { bajaInventarioService } from '../../services/bajaInventario.service';
import type { BajaDanoData } from '../../services/bajaInventario.service';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import type {
  Transferencia,
  IncidenciaTransferencia,
  DisposicionDanada,
  ResponsableDano,
} from '../../types/transferencia.types';
import type { Producto } from '../../types/producto.types';

interface GestionDanadasModalProps {
  transferencia: Transferencia;
  productosMap: Map<string, Producto>;
  onClose: () => void;
  onSuccess: () => void;
}

const OPCIONES_DISPOSICION: {
  value: DisposicionDanada;
  label: string;
  descripcion: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'baja_definitiva',
    label: 'Baja definitiva',
    descripcion: 'Destruir/descartar. Genera gasto contable.',
    icon: Trash2,
    color: 'red',
  },
  {
    value: 'devolucion_proveedor',
    label: 'Devolución / Reclamo',
    descripcion: 'Reclamo al viajero o proveedor.',
    icon: RotateCcw,
    color: 'amber',
  },
  {
    value: 'reparacion_reingreso',
    label: 'Reparar y reingresar',
    descripcion: 'Limpieza/relabelado. Vuelve a disponible.',
    icon: Wrench,
    color: 'green',
  },
];

const OPCIONES_RESPONSABLE: { value: ResponsableDano; label: string }[] = [
  { value: 'viajero', label: 'Viajero' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'sin_responsable', label: 'Sin responsable' },
];

interface DecisionUnidad {
  disposicion?: DisposicionDanada;
  responsable: ResponsableDano;
  motivo: string;
}

export const GestionDanadasModal: React.FC<GestionDanadasModalProps> = ({
  transferencia,
  productosMap,
  onClose,
  onSuccess,
}) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  // Get unresolved damaged incidencias
  const incidenciasDanadas = useMemo(() => {
    return (transferencia.incidencias || []).filter(
      (inc) => inc.tipo === 'danada' && !inc.resuelta
    );
  }, [transferencia]);

  // State: decisions per incidencia
  const [decisiones, setDecisiones] = useState<Record<string, DecisionUnidad>>(() => {
    const init: Record<string, DecisionUnidad> = {};
    incidenciasDanadas.forEach((inc) => {
      init[inc.id] = { responsable: 'sin_responsable', motivo: '' };
    });
    return init;
  });

  const [submitting, setSubmitting] = useState(false);
  const [showConfirmacion, setShowConfirmacion] = useState(false);

  // Count resolved
  const resueltas = incidenciasDanadas.filter(
    (inc) => decisiones[inc.id]?.disposicion
  ).length;
  const todasResueltas = resueltas === incidenciasDanadas.length;

  // Update a decision
  const updateDecision = (incId: string, field: keyof DecisionUnidad, value: any) => {
    setDecisiones((prev) => ({
      ...prev,
      [incId]: { ...prev[incId], [field]: value },
    }));
  };

  // Get unidad info from transferencia
  const getUnidadInfo = (inc: IncidenciaTransferencia) => {
    const unidad = transferencia.unidades.find((u) => u.unidadId === inc.unidadId);
    const producto = productosMap.get(inc.productoId || unidad?.productoId || '');
    return { unidad, producto };
  };

  // Handle confirm all
  const handleConfirmar = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const bajas: BajaDanoData[] = incidenciasDanadas.map((inc) => {
        const decision = decisiones[inc.id];
        const { unidad, producto } = getUnidadInfo(inc);

        return {
          unidadId: inc.unidadId || unidad?.unidadId || '',
          transferenciaId: transferencia.id,
          incidenciaId: inc.id,
          productoId: inc.productoId || unidad?.productoId || '',
          productoNombre: producto?.nombreComercial || inc.productoNombre || inc.sku || '',
          sku: inc.sku || unidad?.sku || '',
          disposicion: decision.disposicion!,
          motivo: decision.motivo || 'Sin motivo adicional',
          responsable: decision.responsable,
          costoUnidadPEN: unidad?.costoBasePEN || unidad?.ctruInicial?.costoBasePEN || 0,
          costoUnidadUSD: unidad?.costoBaseUSD || 0,
          evidenciaURL: inc.evidenciaURL,
        };
      });

      const resultados = await bajaInventarioService.procesarBajasLote(bajas, user.uid);

      const gastosGenerados = resultados.filter((r) => r.gastoGenerado).length;
      const reclamosGenerados = resultados.filter((r) => r.reclamoGenerado).length;

      let msg = `${resultados.length} unidades procesadas`;
      if (gastosGenerados > 0) msg += ` · ${gastosGenerados} gastos registrados`;
      if (reclamosGenerados > 0) msg += ` · ${reclamosGenerados} reclamos generados`;

      toast.success(msg);
      onSuccess();
    } catch (err: any) {
      toast.error(`Error procesando bajas: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (incidenciasDanadas.length === 0) {
    return (
      <Modal isOpen onClose={onClose} title="Unidades con Incidencia" size="md">
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" />
          <p className="font-medium">No hay incidencias pendientes</p>
          <p className="text-sm mt-1">Todas las unidades dañadas ya fueron procesadas.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Unidades con Incidencia — ${transferencia.numeroTransferencia}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Progress header */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                {incidenciasDanadas.length} unidad{incidenciasDanadas.length !== 1 ? 'es' : ''} dañada{incidenciasDanadas.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Badge variant={todasResueltas ? 'success' : 'warning'}>
              {resueltas}/{incidenciasDanadas.length} decididas
            </Badge>
          </div>
          <div className="w-full bg-amber-200 rounded-full h-1.5 mt-2">
            <div
              className="bg-amber-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(resueltas / incidenciasDanadas.length) * 100}%` }}
            />
          </div>
        </div>

        {/* List of damaged units */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {incidenciasDanadas.map((inc) => {
            const { producto } = getUnidadInfo(inc);
            const decision = decisiones[inc.id];
            const isDecided = !!decision?.disposicion;

            return (
              <div
                key={inc.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  isDecided ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Product info */}
                <div className="p-3 bg-gray-50 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {producto?.marca} — {producto?.nombreComercial || inc.productoNombre}
                        </p>
                        <p className="text-xs text-gray-500">{inc.sku}</p>
                      </div>
                    </div>
                    {inc.evidenciaURL && (
                      <a
                        href={inc.evidenciaURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
                      >
                        <Image className="h-3.5 w-3.5" />
                        Evidencia
                      </a>
                    )}
                  </div>
                  {inc.descripcion && (
                    <p className="text-xs text-gray-600 mt-1 italic">"{inc.descripcion}"</p>
                  )}
                </div>

                {/* Disposition selection */}
                <div className="p-3 space-y-3">
                  <fieldset>
                    <legend className="sr-only">
                      Disposición para {inc.sku}
                    </legend>
                    <div className="space-y-2">
                      {OPCIONES_DISPOSICION.map((op) => {
                        const isSelected = decision?.disposicion === op.value;
                        const Icon = op.icon;
                        return (
                          <label
                            key={op.value}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                              isSelected
                                ? `bg-${op.color}-50 border-${op.color}-200`
                                : 'border-transparent hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`disposicion-${inc.id}`}
                              value={op.value}
                              checked={isSelected}
                              onChange={() => updateDecision(inc.id, 'disposicion', op.value)}
                              className="text-amber-600 focus:ring-amber-500"
                            />
                            <Icon className={`h-4 w-4 flex-shrink-0 ${
                              isSelected ? `text-${op.color}-600` : 'text-gray-400'
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

                  {/* Responsable (only if devolucion selected) */}
                  {decision?.disposicion === 'devolucion_proveedor' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Responsable del daño
                      </label>
                      <select
                        value={decision.responsable}
                        onChange={(e) => updateDecision(inc.id, 'responsable', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-400"
                      >
                        {OPCIONES_RESPONSABLE.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Motivo adicional */}
                  {decision?.disposicion && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Motivo adicional (opcional)
                      </label>
                      <input
                        type="text"
                        value={decision.motivo}
                        onChange={(e) => updateDecision(inc.id, 'motivo', e.target.value)}
                        placeholder="Ej: Tapa rota durante el vuelo"
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirmation panel */}
        {showConfirmacion && todasResueltas && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3" role="alertdialog">
            <p className="text-sm font-medium text-gray-900 mb-2">Vas a ejecutar las siguientes acciones:</p>
            <ul className="space-y-1.5 text-xs text-gray-700">
              {incidenciasDanadas.map((inc) => {
                const decision = decisiones[inc.id];
                const opcion = OPCIONES_DISPOSICION.find((o) => o.value === decision?.disposicion);
                return (
                  <li key={inc.id} className="flex items-center gap-2">
                    <span className="font-mono text-gray-500">{inc.sku}</span>
                    <span>→</span>
                    <span className="font-medium">{opcion?.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Action buttons */}
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
                Revisar y confirmar ({resueltas}/{incidenciasDanadas.length})
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirmacion(false)}
                  disabled={submitting}
                >
                  Atrás
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmar}
                  disabled={submitting}
                >
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
