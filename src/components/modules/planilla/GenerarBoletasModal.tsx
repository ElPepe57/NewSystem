/**
 * GenerarBoletasModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5.C · 2026-05-26
 *
 * Modal canon FormModalV2 sky para generar boletas del mes en lote.
 * Delega a planillaService.generarBoletasMes (existente · canon legacy
 * preservado por backward-compat).
 */
import React, { useEffect, useState } from 'react';
import { FileText, Calendar, Users, Info } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { planillaService } from '../../../services/planilla.service';
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

export const GenerarBoletasModal: React.FC<Props> = ({
  isOpen,
  onClose,
  mes,
  anio,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [empleadosActivos, setEmpleadosActivos] = useState(0);
  const [yaExisten, setYaExisten] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const [emps, boletas] = await Promise.all([
          planillaService.getEmpleadosActivos(),
          planillaService.getBoletasPorPeriodo(mes, anio),
        ]);
        setEmpleadosActivos(emps.length);
        setYaExisten(boletas.length);
      } catch (err) {
        console.error('[GenerarBoletasModal] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, mes, anio]);

  const handleSubmit = async () => {
    if (submitting || !userProfile) return;
    setSubmitting(true);
    try {
      const resultado = await planillaService.generarBoletasMes(mes, anio, userProfile.uid);
      const generadas = Array.isArray(resultado) ? resultado.length : 0;
      onSuccess?.(
        `${generadas} boleta${generadas === 1 ? '' : 's'} generada${generadas === 1 ? '' : 's'} para ${MES_NOMBRE[mes - 1]} ${anio}`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al generar boletas');
    } finally {
      setSubmitting(false);
    }
  };

  const porGenerar = Math.max(0, empleadosActivos - yaExisten);

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Generar boletas · ${MES_NOMBRE[mes - 1]} ${anio}`}
      subtitle="Crea boletas borrador para todos los empleados activos"
      icon={FileText}
      iconTone="sky"
      size="md"
      submitLabel={
        submitting
          ? 'Generando...'
          : porGenerar === 0 && yaExisten > 0
            ? 'Todas las boletas ya existen'
            : `Generar ${porGenerar} boleta${porGenerar === 1 ? '' : 's'}`
      }
      submitVariant="primary-soft"
      submitIcon={FileText}
      loading={submitting}
      disabled={loading || porGenerar === 0}
    >
      <div className="space-y-4">
        <div className="bg-sky-50 border border-sky-200 rounded p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-sky-900">
            Las boletas se generan en estado <strong>borrador</strong>. Comisiones, adelantos y
            bonificaciones de incentivos se calculan automáticamente. Podés ajustar manualmente
            antes de aprobar.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-sky-50 ring-1 ring-sky-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-sky-700 font-bold mb-1">
              <Users className="w-3 h-3" />
              Empleados activos
            </div>
            <div className="text-2xl font-bold tabular-nums text-sky-900">{empleadosActivos}</div>
          </div>
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-1">
              <Calendar className="w-3 h-3" />
              Ya existen
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">{yaExisten}</div>
          </div>
        </div>

        {porGenerar > 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-[12px] text-emerald-900 text-center">
            Se generarán <strong>{porGenerar}</strong> boleta{porGenerar === 1 ? '' : 's'} nueva
            {porGenerar === 1 ? '' : 's'} para {MES_NOMBRE[mes - 1]} {anio}.
          </div>
        ) : empleadosActivos > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-[11px] text-amber-900">
            Todas las boletas del mes ya están generadas. Si necesitás regenerar alguna · andá al
            tab Boletas y eliminala antes.
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded p-3 text-[11px] text-rose-900">
            No hay empleados con PerfilLaboral activo. Configurá perfiles laborales en /usuarios
            antes de generar boletas.
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

export default GenerarBoletasModal;
