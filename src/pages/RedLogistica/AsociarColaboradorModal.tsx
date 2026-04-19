/**
 * AsociarColaboradorModal — asocia un colaborador existente a una casilla
 * como secundario (comparte la misma dirección física).
 *
 * S42h: alternativa ligera al CasillaFormModal cuando solo se quiere
 * agregar un colaborador más a una casilla existente sin editar el resto.
 */
import React, { useMemo, useState } from 'react';
import { Users, X, Check } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { casillaCrudService } from '../../services/casilla.crud.service';
import { useAuthStore } from '../../store/authStore';
import { useColaboradorStore } from '../../store/colaboradorStore';
import { useToastStore } from '../../store/toastStore';
import type { Casilla } from '../../types/casilla.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  casilla: Casilla | null;
  onSaved: () => void;
}

export const AsociarColaboradorModal: React.FC<Props> = ({ isOpen, onClose, casilla, onSaved }) => {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { colaboradores } = useColaboradorStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Colaboradores disponibles: activos, no principal, no ya asociados
  const disponibles = useMemo(() => {
    if (!casilla) return [];
    const yaAsociados = new Set([
      casilla.colaboradorId,
      ...(casilla.colaboradoresSecundariosIds ?? []),
    ]);
    return colaboradores.filter((c) => c.estado === 'activo' && !yaAsociados.has(c.id));
  }, [colaboradores, casilla]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!user || !casilla || selectedIds.length === 0) return;
    setLoading(true);
    try {
      const nuevosSecundarios = [
        ...(casilla.colaboradoresSecundariosIds ?? []),
        ...selectedIds,
      ];
      await casillaCrudService.actualizar(
        casilla.id,
        { colaboradoresSecundariosIds: nuevosSecundarios },
        user.uid
      );
      toast.success(
        selectedIds.length === 1
          ? `Colaborador asociado a ${casilla.nombre}`
          : `${selectedIds.length} colaboradores asociados a ${casilla.nombre}`
      );
      setSelectedIds([]);
      onSaved();
    } catch (error: any) {
      toast.error(error.message, 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (!casilla) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asociar colaboradores" size="md">
      <div className="space-y-4">
        {/* Contexto de la casilla */}
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-100">
          <p className="text-xs text-teal-700 font-medium">Casilla destino</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{casilla.nombre}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {casilla.direccion}{casilla.ciudad ? `, ${casilla.ciudad}` : ''}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Principal: <b>{casilla.colaboradorNombre}</b>
            {casilla.colaboradoresSecundariosNombres && casilla.colaboradoresSecundariosNombres.length > 0 && (
              <> · Ya comparten: <b>{casilla.colaboradoresSecundariosNombres.join(', ')}</b></>
            )}
          </p>
        </div>

        {/* Lista de colaboradores disponibles */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            <Users className="inline w-3.5 h-3.5 mr-1" />
            Selecciona los colaboradores que comparten esta dirección
          </label>
          {disponibles.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 italic border border-slate-200 rounded-lg">
              No hay más colaboradores disponibles.
            </div>
          ) : (
            <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {disponibles.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleId(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-teal-600 border-teal-600' : 'bg-white border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{c.nombre}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.tipo} · {c.pais}
                        {c.ciudad && ` · ${c.ciudad}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chips selección */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const c = colaboradores.find((x) => x.id === id);
              if (!c) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs bg-teal-600 text-white rounded-full"
                >
                  {c.nombre}
                  <button
                    type="button"
                    onClick={() => toggleId(id)}
                    className="p-0.5 hover:bg-teal-700 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={selectedIds.length === 0}>
            Asociar {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
