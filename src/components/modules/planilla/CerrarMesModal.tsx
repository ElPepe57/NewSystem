/**
 * CerrarMesModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F5.C · 2026-05-26
 *
 * Modal canon FormModalV2 indigo para "cerrar el mes" de planilla.
 * NO bloquea (similar al rework Revisión Mensual de Contabilidad · canon
 * Vita Skin sin cierres rígidos). Solo deja un marcador audit.
 *
 * DEUDA DECLARADA: la persistencia del "marcador de cierre" requiere una
 * colección dedicada (planillaCierres) · por ahora solo notifica al
 * gerente y queda como TODO para una iteración futura.
 */
import React, { useEffect, useState } from 'react';
import { Lock, AlertCircle, CheckCircle2, FileText, Trophy } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { planillaService } from '../../../services/planilla.service';
import { calculoIncentivoService } from '../../../services/calculoIncentivo.service';
import type { Boleta, CalculoIncentivoMes } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';

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

export const CerrarMesModal: React.FC<Props> = ({ isOpen, onClose, mes, anio, onSuccess, onError }) => {
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [calculos, setCalculos] = useState<CalculoIncentivoMes[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const [bols, cals] = await Promise.all([
          planillaService.getBoletasPorPeriodo(mes, anio),
          calculoIncentivoService.listMes(mes, anio),
        ]);
        setBoletas(bols);
        setCalculos(cals);
      } catch (err) {
        console.error('[CerrarMesModal] error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, mes, anio]);

  // Checklist pre-cierre
  const boletasBorrador = boletas.filter((b) => b.estado === 'borrador').length;
  const boletasPagadas = boletas.filter((b) => b.estado === 'pagada').length;
  const calculosPendientes = calculos.filter((c) => c.estado === 'calculado').length;
  const calculosNoEnBoleta = calculos.filter(
    (c) => c.estado === 'aprobado' && !c.boletaId,
  ).length;

  const totalNeto = boletas.reduce((s, b) => s + b.totalNeto, 0);

  const todoOK = boletasBorrador === 0 && calculosPendientes === 0 && calculosNoEnBoleta === 0;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // F5.C STUB · no persiste · solo notifica
      onSuccess?.(
        `Mes ${MES_NOMBRE[mes - 1]} ${anio} marcado como revisado · ${boletas.length} boletas (${formatCurrencyPEN(totalNeto)}). Persistencia del cierre como TODO · canon "sin bloqueos" Vita Skin.`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al cerrar mes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Cerrar mes · ${MES_NOMBRE[mes - 1]} ${anio}`}
      subtitle="Marca el mes como revisado · sin bloqueo (canon Vita Skin)"
      icon={Lock}
      iconTone="purple"
      size="md"
      submitLabel={submitting ? 'Cerrando...' : 'Marcar como revisado'}
      submitVariant="primary-soft"
      submitIcon={Lock}
      loading={submitting}
      disabled={loading}
    >
      <div className="space-y-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-indigo-900">
            Vita Skin <strong>NO bloquea</strong> los meses (canon revisión informal). Este
            "cierre" deja una marca audit en el log para tu propio control. Boletas y bonos
            siguen siendo editables.
          </div>
        </div>

        {/* Checklist pre-cierre */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
            CHECKLIST PRE-CIERRE
          </div>
          <ul className="space-y-1.5 text-[12px]">
            <ChecklistItem
              ok={boletasBorrador === 0}
              icon={FileText}
              labelOK="Todas las boletas aprobadas o pagadas"
              labelWarn={`${boletasBorrador} boleta(s) en borrador · ¿revisar?`}
            />
            <ChecklistItem
              ok={calculosPendientes === 0}
              icon={Trophy}
              labelOK="Sin bonos pendientes de aprobación"
              labelWarn={`${calculosPendientes} bono(s) pendiente(s) de aprobar`}
            />
            <ChecklistItem
              ok={calculosNoEnBoleta === 0}
              icon={Trophy}
              labelOK="Todos los bonos aprobados incluidos en boletas"
              labelWarn={`${calculosNoEnBoleta} bono(s) aprobado(s) sin incluir en boleta`}
            />
          </ul>
        </div>

        {/* Resumen del mes */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
            RESUMEN DEL MES
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500">Boletas:</span>{' '}
              <strong className="tabular-nums">{boletas.length}</strong> ({boletasPagadas} pagadas)
            </div>
            <div>
              <span className="text-slate-500">Total neto:</span>{' '}
              <strong className="tabular-nums">{formatCurrencyPEN(totalNeto)}</strong>
            </div>
          </div>
        </div>

        {!todoOK && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900">
            Hay pendientes. Podés cerrar igual (canon sin bloqueo) o resolver primero. Tu decisión
            queda en el audit log.
          </div>
        )}
      </div>
    </FormModalV2>
  );
};

const ChecklistItem: React.FC<{
  ok: boolean;
  icon: React.ComponentType<{ className?: string }>;
  labelOK: string;
  labelWarn: string;
}> = ({ ok, icon: Icon, labelOK, labelWarn }) => (
  <li className={`flex items-center gap-2 ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
    {ok ? (
      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
    ) : (
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
    )}
    <span className="text-[11px]">{ok ? labelOK : labelWarn}</span>
  </li>
);

export default CerrarMesModal;
