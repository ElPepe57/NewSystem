/**
 * DatosBancariosPanel — F-DatosBanc · S58c
 *
 * Panel reusable que muestra y gestiona la lista de cuentas bancarias
 * pasivas de una entidad (Proveedor / Cliente / Colaborador / Empleado).
 *
 * - Cards visuales con icono según tipo
 * - Botón "Agregar cuenta" que abre el modal
 * - Click en card → editar
 * - Botón papelera → eliminar (con confirm)
 * - Marca visual del principal
 * - Mensaje de placeholder cuando vacío
 *
 * El panel es PURO (state-less): recibe la lista, expone callbacks. El
 * caller persiste a su BD según el contexto.
 */

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Star, Banknote } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type {
  DatoBancarioPasivo,
  DatoBancarioPasivoFormData,
} from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';
import { DatoBancarioFormModal } from './DatoBancarioFormModal';
import {
  TIPO_LABEL,
  TIPO_ICON,
  TIPO_COLOR_CLASSES,
  describirDatoBancario,
  generarDatoBancarioId,
} from './helpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface DatosBancariosPanelProps {
  /** Lista actual de datos bancarios (puede venir vacía o undefined). */
  datos: DatoBancarioPasivo[] | undefined;
  /**
   * Callback al cambiar la lista (agregar / editar / eliminar / marcar principal).
   * El padre persiste el array completo en su entidad (Firestore o donde sea).
   */
  onChange: (nuevos: DatoBancarioPasivo[]) => void | Promise<void>;
  /** Tipo de entidad dueña, para personalizar copy. */
  entidadTipo?: 'proveedor' | 'cliente' | 'colaborador' | 'empleado';
  /** ID del usuario actual para auditoría de los datos creados. */
  userId: string;
  /** Si true, el panel es solo lectura (sin botones de editar/eliminar). */
  readOnly?: boolean;
  /** Título del panel. Default: "Cuentas bancarias". */
  title?: string;
  /** Subtítulo opcional bajo el título. */
  subtitle?: string;
  /** className extra para el container. */
  className?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const DatosBancariosPanel: React.FC<DatosBancariosPanelProps> = ({
  datos,
  onChange,
  entidadTipo,
  userId,
  readOnly,
  title = 'Cuentas bancarias',
  subtitle,
  className,
}) => {
  const lista = datos ?? [];
  const [showForm, setShowForm] = useState(false);
  const [datoEditar, setDatoEditar] = useState<DatoBancarioPasivo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const yaTienePrincipal = lista.some((d) => d.esPrincipal);
  const principal = lista.find((d) => d.esPrincipal);

  // ── Handlers ──
  const abrirAgregar = () => {
    setDatoEditar(null);
    setShowForm(true);
  };

  const abrirEditar = (d: DatoBancarioPasivo) => {
    setDatoEditar(d);
    setShowForm(true);
  };

  const handleSave = async (formData: DatoBancarioPasivoFormData) => {
    let nuevaLista: DatoBancarioPasivo[];

    if (datoEditar) {
      // Editar existente
      nuevaLista = lista.map((d) =>
        d.id === datoEditar.id
          ? {
              ...datoEditar,
              ...formData,
              ultimaEdicion: Timestamp.now(),
              editadoPor: userId,
            }
          : // Si el editado pasa a ser principal, los demás dejan de serlo
            formData.esPrincipal
            ? { ...d, esPrincipal: false }
            : d,
      );
    } else {
      // Agregar nuevo
      const nuevo: DatoBancarioPasivo = {
        id: generarDatoBancarioId(),
        ...formData,
        creadoPor: userId,
        fechaCreacion: Timestamp.now(),
      };
      // Si nuevo es principal, los demás dejan de serlo
      nuevaLista = formData.esPrincipal
        ? [...lista.map((d) => ({ ...d, esPrincipal: false })), nuevo]
        : [...lista, nuevo];
    }

    await onChange(nuevaLista);
  };

  const handleEliminar = async (id: string) => {
    const nueva = lista.filter((d) => d.id !== id);
    await onChange(nueva);
    setConfirmDelete(null);
  };

  const togglePrincipal = async (id: string) => {
    const nueva = lista.map((d) => ({
      ...d,
      esPrincipal: d.id === id ? !d.esPrincipal : false,
    }));
    await onChange(nueva);
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={abrirAgregar}
            className="text-[11px] px-2.5 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded-md font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            <Plus className="w-3 h-3" />
            Agregar cuenta
          </button>
        )}
      </div>

      {/* Empty state */}
      {lista.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg">
          <Banknote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-[12px] text-slate-500">
            Sin cuentas bancarias registradas
          </p>
          {!readOnly && (
            <p className="text-[11px] text-slate-400 mt-1">
              Agrega una para usarla como referencia al hacer pagos
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((d) => {
            const Icon = TIPO_ICON[d.tipo];
            const colors = TIPO_COLOR_CLASSES[d.tipo];
            const desc = describirDatoBancario(d);
            return (
              <div
                key={d.id}
                className={cn(
                  'border rounded-lg p-3 transition-colors',
                  d.esPrincipal
                    ? 'border-teal-200 bg-teal-50/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50/50',
                  d.promovidaACuentaCajaId && 'opacity-75',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0',
                      colors.bg,
                      colors.border,
                      colors.text,
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-900 truncate">
                        {d.etiqueta}
                      </span>
                      {d.esPrincipal && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-bold uppercase tracking-wider">
                          Principal
                        </span>
                      )}
                      {d.promovidaACuentaCajaId && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase tracking-wider">
                          Promovida a CuentaCaja
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {desc}
                    </div>
                    {d.cci && d.tipo === 'banco' && (
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                        CCI: {d.cci}
                      </div>
                    )}
                    {d.notas && (
                      <div className="text-[11px] text-slate-500 italic mt-1 truncate">
                        {d.notas}
                      </div>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => togglePrincipal(d.id)}
                        className={cn(
                          'p-1.5 rounded transition-colors',
                          d.esPrincipal
                            ? 'text-amber-500 hover:bg-amber-50'
                            : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50',
                        )}
                        title={
                          d.esPrincipal
                            ? 'Quitar como principal'
                            : 'Marcar como principal'
                        }
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5',
                            d.esPrincipal && 'fill-current',
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEditar(d)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Confirm delete inline */}
                {confirmDelete === d.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-red-700">
                      ¿Eliminar esta cuenta?
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="text-[11px] px-2 py-0.5 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(d.id)}
                        className="text-[11px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer hint */}
      {lista.length > 0 && !readOnly && (
        <p className="text-[10px] text-slate-400 mt-2 italic">
          Datos pasivos · sin saldo trackeado.
          {entidadTipo === 'proveedor' &&
            ' Si el proveedor empieza a recibir dinero del negocio, podrás promover una cuenta a CuentaCaja para trackear saldo.'}
          {principal &&
            ` Cuenta principal: ${principal.etiqueta} · se sugerirá por defecto al hacer pagos.`}
        </p>
      )}

      {/* Modal de form */}
      <DatoBancarioFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        datoEditar={datoEditar}
        entidadTipo={entidadTipo}
        yaTienePrincipal={yaTienePrincipal}
      />
    </div>
  );
};
