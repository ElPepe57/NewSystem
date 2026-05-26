/**
 * ProcesarGratificacionModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5 · 2026-05-26
 *
 * Procesa la gratificación de Julio o Diciembre para TODOS los empleados activos.
 * Calcula proporcional simple: salarioBase * (diasEfectivos / 180).
 *
 * Workflow:
 *  1. Modal lista empleados activos con preview del monto sugerido
 *  2. User puede ajustar días efectivos y monto manualmente
 *  3. Al confirmar · crea N Gratificación en estado 'pendiente'
 *  4. Aprobación + pago en F9 (Cloud Function procesarGratificacion)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Info, Users } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { gratificacionService, calcularGratificacionProporcional } from '../../../services/gratificacion.service';
import { planillaService } from '../../../services/planilla.service';
import type {
  EmpleadoConPerfil,
  MesGratificacion,
} from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mes: MesGratificacion;
  anio: number;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

interface FilaEmpleado {
  uid: string;
  nombre: string;
  cargo?: string;
  salarioBase: number;
  diasEfectivos: number;
  monto: number;
  incluir: boolean;
}

export const ProcesarGratificacionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  mes,
  anio,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [filas, setFilas] = useState<FilaEmpleado[]>([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cargar empleados activos al abrir
  useEffect(() => {
    if (!isOpen) return;
    setLoadingEmpleados(true);
    (async () => {
      try {
        const empleados = await planillaService.getEmpleadosActivos();
        const filasIniciales: FilaEmpleado[] = empleados.map((e: EmpleadoConPerfil) => {
          const salario = e.perfilLaboral?.salarioBase ?? 0;
          // Default: 180 días (semestre completo)
          const dias = 180;
          return {
            uid: e.uid,
            nombre: e.displayName,
            cargo: e.cargo,
            salarioBase: salario,
            diasEfectivos: dias,
            monto: calcularGratificacionProporcional(salario, dias),
            incluir: salario > 0, // excluir empleados sin sueldo configurado por default
          };
        });
        setFilas(filasIniciales);
      } catch (err) {
        console.error('[ProcesarGratificacionModal] error cargando empleados:', err);
      } finally {
        setLoadingEmpleados(false);
      }
    })();
  }, [isOpen, mes, anio]);

  // Recalcular monto al cambiar días
  const actualizarDias = (uid: string, dias: number) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.uid === uid
          ? { ...f, diasEfectivos: dias, monto: calcularGratificacionProporcional(f.salarioBase, dias) }
          : f,
      ),
    );
  };

  const toggleIncluir = (uid: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.uid === uid ? { ...f, incluir: !f.incluir } : f)),
    );
  };

  const totales = useMemo(() => {
    const incluidas = filas.filter((f) => f.incluir);
    return {
      cantidad: incluidas.length,
      total: incluidas.reduce((s, f) => s + f.monto, 0),
    };
  }, [filas]);

  const handleSubmit = async () => {
    if (submitting || !userProfile) return;
    const seleccionadas = filas.filter((f) => f.incluir && f.salarioBase > 0);
    if (seleccionadas.length === 0) {
      onError?.('Seleccioná al menos un empleado con salario configurado.');
      return;
    }
    setSubmitting(true);
    try {
      // Crear gratificaciones en serie (transaccional · si falla una se reporta)
      for (const f of seleccionadas) {
        await gratificacionService.crear(
          {
            userId: f.uid,
            empleadoNombre: f.nombre,
            mes,
            anio,
            diasEfectivosEnSemestre: f.diasEfectivos,
            salarioBaseReferencia: f.salarioBase,
            montoCalculado: f.monto,
            moneda: 'PEN',
          },
          userProfile.uid,
        );
      }
      onSuccess?.(
        `${seleccionadas.length} gratificación${seleccionadas.length === 1 ? '' : 'es'} de ${mes === 7 ? 'Julio' : 'Diciembre'} ${anio} creadas · pendientes de aprobación · total ${formatCurrencyPEN(totales.total)}`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al procesar gratificaciones');
    } finally {
      setSubmitting(false);
    }
  };

  const mesLabel = mes === 7 ? 'Julio' : 'Diciembre';

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Procesar gratificación · ${mesLabel} ${anio}`}
      subtitle={`Cálculo proporcional simple · salarioBase × (díasEfectivos / 180)`}
      icon={Gift}
      iconTone="purple"
      size="xl"
      submitLabel={
        submitting
          ? 'Procesando...'
          : `Crear ${totales.cantidad} gratificación${totales.cantidad === 1 ? '' : 'es'}`
      }
      submitVariant="primary-soft"
      submitIcon={Gift}
      loading={submitting}
      disabled={totales.cantidad === 0}
    >
      {/* Banner explicativo */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-indigo-900">
          <strong>Vita Skin · sin CTS.</strong> Solo gratificaciones jul/dic.
          Ajustá los días efectivos si algún empleado ingresó durante el semestre.
          Los empleados sin salario base configurado quedan deseleccionados por default.
        </div>
      </div>

      {/* Tabla empleados */}
      {loadingEmpleados ? (
        <div className="text-center py-8 text-[12px] text-slate-500">Cargando empleados...</div>
      ) : filas.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <div className="text-[13px] font-semibold text-slate-700">Sin empleados activos</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Necesitás al menos 1 empleado con PerfilLaboral activo
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 font-bold">
                <th className="py-2 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={totales.cantidad === filas.length && filas.length > 0}
                    onChange={() => {
                      const todos = filas.every((f) => f.incluir);
                      setFilas((prev) => prev.map((f) => ({ ...f, incluir: !todos && f.salarioBase > 0 })));
                    }}
                  />
                </th>
                <th className="py-2 pr-2">Empleado</th>
                <th className="py-2 pr-2 text-right">Salario base</th>
                <th className="py-2 pr-2 text-center w-24">Días</th>
                <th className="py-2 pr-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr
                  key={f.uid}
                  className={`border-b border-slate-100 ${
                    f.salarioBase === 0 ? 'opacity-50' : f.incluir ? '' : 'bg-slate-50'
                  }`}
                >
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={f.incluir}
                      onChange={() => toggleIncluir(f.uid)}
                      disabled={f.salarioBase === 0}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <div className="font-semibold text-slate-900">{f.nombre}</div>
                    {f.cargo && <div className="text-[10px] text-slate-500">{f.cargo}</div>}
                    {f.salarioBase === 0 && (
                      <div className="text-[10px] text-rose-600">⚠ Sin salario configurado</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {f.salarioBase > 0 ? formatCurrencyPEN(f.salarioBase) : '—'}
                  </td>
                  <td className="py-2 pr-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={f.diasEfectivos}
                      onChange={(e) => actualizarDias(f.uid, Math.min(180, Math.max(0, Number(e.target.value))))}
                      className="w-16 text-[11px] tabular-nums border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      disabled={!f.incluir || f.salarioBase === 0}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-bold text-indigo-700">
                    {f.incluir && f.salarioBase > 0 ? formatCurrencyPEN(f.monto) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold">
                <td colSpan={3} className="py-2 pr-2 text-right text-[11px] uppercase text-slate-700">
                  TOTAL · {totales.cantidad} empleado{totales.cantidad === 1 ? '' : 's'}
                </td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2 text-right text-[14px] text-indigo-900">
                  {formatCurrencyPEN(totales.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </FormModalV2>
  );
};

export default ProcesarGratificacionModal;
