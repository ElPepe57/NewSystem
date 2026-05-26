/**
 * CalcularBonosMesModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5 · 2026-05-26
 *
 * Modal canon FormModalV2 violet para ejecutar el cálculo automático de
 * bonos del mes. Procesa TODOS los esquemas activos × empleados aplicables.
 *
 * Workflow:
 *  1. Modal muestra preview: esquemas vigentes + empleados aplicables
 *  2. Botón "Ejecutar cálculo" llama al motor (utils/incentivoCalculadores)
 *  3. Persiste batch de CalculoIncentivoMes en estado 'calculado'
 *  4. Refresca el tab Incentivos al cerrar
 *
 * STUB del motor en F5 · F7 implementa lógica real de los 4 tipos.
 */
import React, { useEffect, useState } from 'react';
import { Zap, AlertCircle, Info, Trophy } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { esquemaIncentivoService } from '../../../services/esquemaIncentivo.service';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import { planillaService } from '../../../services/planilla.service';
import { calcularBonosDelMes, empleadosAplicables } from '../../../utils/incentivoCalculadores';
import type { DatosFuenteMes } from '../../../utils/incentivoCalculadores';
import type {
  EsquemaIncentivo,
  EmpleadoConPerfil,
} from '../../../types/planilla.types';
import { TIPO_INCENTIVO_LABELS } from '../../../types/planilla.types';
import { VentaService } from '../../../services/venta.service';
import { envioCrudService } from '../../../services/envio.crud.service';
import { OrdenCompraService } from '../../../services/ordenCompra.service';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mes: number;
  anio: number;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const MES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const CalcularBonosMesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  mes,
  anio,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [esquemas, setEsquemas] = useState<EsquemaIncentivo[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoConPerfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [yaExistenCalculos, setYaExistenCalculos] = useState(false);
  // chk5.PERSONAS-v5.4 · F7 · pre-load fuentes para motor de cálculo real
  const [datosFuente, setDatosFuente] = useState<DatosFuenteMes>({
    ventas: [],
    envios: [],
    ordenesCompra: [],
  });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const fecha = new Date(anio, mes - 1, 15);
        const [esqVigentes, emps, calculosExistentes, ventas, envios, ocs] = await Promise.all([
          esquemaIncentivoService.listVigentesEn(fecha),
          planillaService.getEmpleadosActivos(),
          calculoIncentivoService.listMes(mes, anio),
          // F7: cargar fuentes del mes para motor real (límite generoso · 1 mes
          // realista no excede 500 docs en cada categoría para Vita Skin)
          VentaService.getAll(500),
          envioCrudService.getAll(),
          OrdenCompraService.getAll(),
        ]);
        setEsquemas(esqVigentes);
        setEmpleados(emps);
        setYaExistenCalculos(calculosExistentes.length > 0);
        setDatosFuente({ ventas, envios, ordenesCompra: ocs });
      } catch (err) {
        console.error('[CalcularBonosMesModal] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, mes, anio]);

  // Preview: por cada esquema · empleados aplicables
  const preview = esquemas.map((esq) => ({
    esquema: esq,
    aplicables: empleadosAplicables(esq, empleados),
  }));

  const totalCalculosAGenerar = preview.reduce((s, p) => s + p.aplicables.length, 0);

  const handleSubmit = async () => {
    if (submitting || !userProfile) return;
    if (esquemas.length === 0) {
      onError?.('No hay esquemas vigentes en este mes. Crea esquemas primero.');
      return;
    }
    if (totalCalculosAGenerar === 0) {
      onError?.('Ningún empleado aplica a los esquemas vigentes.');
      return;
    }
    setSubmitting(true);
    try {
      // F7: pasar datos pre-cargados al motor para cálculos reales
      const calculos = calcularBonosDelMes(esquemas, empleados, mes, anio, userProfile.uid, datosFuente);
      await calculoIncentivoService.guardarBatch(calculos);
      const totalPagar = calculos.reduce((s, c) => s + c.bonoCalculado, 0);
      onSuccess?.(
        `${calculos.length} cálculo${calculos.length === 1 ? '' : 's'} de incentivo generado${calculos.length === 1 ? '' : 's'} para ${MES_NOMBRE[mes - 1]} ${anio} · total estimado S/ ${totalPagar.toLocaleString('es-PE', { minimumFractionDigits: 2 })}. Pendientes de aprobación gerencial.`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al calcular bonos');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Calcular bonos · ${MES_NOMBRE[mes - 1]} ${anio}`}
      subtitle="Procesa esquemas vigentes × empleados aplicables"
      icon={Zap}
      iconTone="purple"
      size="lg"
      submitLabel={
        submitting
          ? 'Procesando...'
          : totalCalculosAGenerar === 0
            ? 'Sin cálculos por generar'
            : `Generar ${totalCalculosAGenerar} cálculo${totalCalculosAGenerar === 1 ? '' : 's'}`
      }
      submitVariant="primary-soft"
      submitIcon={Zap}
      loading={submitting}
      disabled={totalCalculosAGenerar === 0 || loading}
    >
      {/* F7: motor de cálculo REAL · pre-carga ventas/envíos/OCs del mes */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-emerald-900">
          <strong>Motor de cálculo activo.</strong> Comisiones se calculan sobre ventas del mes
          (creadoPor=empleado). Bonos meta sobre envíos/OCs reales del mes. Bonos KPI requieren
          validación gerencial manual (devuelve S/ 0 + nota). Bonos fijos aplican según
          frecuencia (mensual/trimestral/semestral/anual).
        </div>
      </div>

      {/* Alerta cálculos previos */}
      {yaExistenCalculos && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-rose-900">
            <strong>Ya hay cálculos para este mes.</strong> Re-ejecutar agregará nuevos cálculos
            sin eliminar los previos. Cancelá si no es lo que querés.
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[12px] text-slate-500">Cargando esquemas...</div>
      ) : esquemas.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <div className="text-[12px] font-semibold text-slate-700">Sin esquemas vigentes</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Crea esquemas de incentivo primero (botón "Nuevo esquema" del tab)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-[12px] font-bold text-slate-900">
            {esquemas.length} esquema{esquemas.length === 1 ? '' : 's'} vigente
            {esquemas.length === 1 ? '' : 's'} · {totalCalculosAGenerar} cálculo
            {totalCalculosAGenerar === 1 ? '' : 's'} a generar
          </h4>
          {preview.map(({ esquema, aplicables }) => (
            <div
              key={esquema.id}
              className="bg-white border border-slate-200 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-slate-900 truncate">
                    {esquema.nombre}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {TIPO_INCENTIVO_LABELS[esquema.tipo]}
                  </div>
                </div>
                <span className="text-[11px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded whitespace-nowrap">
                  {aplicables.length} empleado{aplicables.length === 1 ? '' : 's'}
                </span>
              </div>
              {aplicables.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {aplicables.slice(0, 5).map((e) => (
                    <span
                      key={e.uid}
                      className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                    >
                      {e.displayName}
                    </span>
                  ))}
                  {aplicables.length > 5 && (
                    <span className="text-[10px] text-slate-500">
                      + {aplicables.length - 5} más
                    </span>
                  )}
                </div>
              )}
              {aplicables.length === 0 && (
                <div className="text-[10px] text-rose-600 italic">
                  ⚠ Ningún empleado activo aplica a este esquema
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </FormModalV2>
  );
};

export default CalcularBonosMesModal;
