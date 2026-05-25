/**
 * DatosLaboralesForm · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * Sub-formulario para el tab "Datos laborales" en el modal /usuarios.
 *
 * Captura los datos de relación laboral entre la persona y el negocio.
 * Solo se muestra si el user tiene al menos 1 rol de planilla.
 *
 * Reusa PerfilLaboral base (existente) + agrega campos sub-perfil (contrato · área · vacaciones).
 */

import React, { useState, useEffect } from 'react';
import { Briefcase, Info } from 'lucide-react';
import type { DatosLaborales, DatosLaboralesFormData } from '../../../types/datosLaborales.types';
import type { TipoEmpleado } from '../../../types/planilla.types';

interface Props {
  initialData?: DatosLaborales;
  onChange: (data: DatosLaboralesFormData | null, isValid: boolean) => void;
}

export default function DatosLaboralesForm({ initialData, onChange }: Props) {
  const [tipo, setTipo] = useState<TipoEmpleado>(initialData?.tipo ?? 'empleado');
  const [salarioBase, setSalarioBase] = useState<string>(initialData?.salarioBase?.toString() ?? '');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>(initialData?.monedaSalario ?? 'PEN');
  const [activo, setActivo] = useState<boolean>(initialData?.activo ?? true);

  const [cargo, setCargo] = useState<string>(''); // viene del UserProfile.cargo en realidad
  const [fechaIngreso, setFechaIngreso] = useState<string>(() => {
    if (initialData?.fechaIngreso) return initialData.fechaIngreso.toDate().toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  });
  const [tipoContrato, setTipoContrato] = useState<DatosLaborales['tipoContrato']>(
    initialData?.tipoContrato ?? 'indefinido'
  );
  const [modalidad, setModalidad] = useState<DatosLaborales['modalidad']>(
    initialData?.modalidad ?? 'presencial'
  );
  const [area, setArea] = useState<string>(initialData?.area ?? '');
  const [vacaciones, setVacaciones] = useState<string>(initialData?.vacacionesDisponibles?.toString() ?? '');
  const [notas, setNotas] = useState<string>(initialData?.notas ?? '');

  useEffect(() => {
    const valid = fechaIngreso.trim() !== '' && (tipo !== 'empleado' || salarioBase.trim() !== '');
    if (!valid) {
      onChange(null, false);
      return;
    }
    const data: DatosLaboralesFormData = {
      tipo,
      monedaSalario: moneda,
      activo,
      fechaIngreso: new Date(fechaIngreso),
    };
    const salarioNum = parseFloat(salarioBase);
    if (!isNaN(salarioNum) && salarioNum > 0) data.salarioBase = salarioNum;
    if (tipoContrato) data.tipoContrato = tipoContrato;
    if (modalidad) data.modalidad = modalidad;
    if (area.trim()) data.area = area.trim();
    const vacNum = parseInt(vacaciones, 10);
    if (!isNaN(vacNum) && vacNum > 0) data.vacacionesDisponibles = vacNum;
    if (notas.trim()) data.notas = notas.trim();

    onChange(data, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, salarioBase, moneda, activo, fechaIngreso, tipoContrato, modalidad, area, vacaciones, notas]);

  return (
    <div className="space-y-3">
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-sky-900">
          Estos datos viven en <strong>/users/{`{uid}`}/private/datosLaborales</strong>. Solo aparecen
          si el usuario tiene un rol de planilla. Se consultan automáticamente desde el módulo Planilla.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEmpleado)} className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg bg-white focus:border-sky-500 focus:outline-none">
            <option value="empleado">Empleado · sueldo fijo</option>
            <option value="comisionista">Comisionista · sin sueldo fijo</option>
            <option value="externo">Externo · honorarios</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Estado</label>
          <select value={activo ? 'true' : 'false'} onChange={(e) => setActivo(e.target.value === 'true')} className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg bg-white focus:border-sky-500 focus:outline-none">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Salario base mensual {tipo === 'empleado' ? '*' : '(opcional)'}</label>
          <input type="number" min="0" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} className="w-full px-3 py-2 text-[12px] tabular-nums border border-slate-300 rounded-lg focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Moneda</label>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')} className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg bg-white focus:border-sky-500 focus:outline-none">
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Fecha de ingreso *</label>
          <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Tipo de contrato</label>
          <select value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value as DatosLaborales['tipoContrato'])} className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg bg-white focus:border-sky-500 focus:outline-none">
            <option value="indefinido">Indefinido</option>
            <option value="plazo_fijo">Plazo fijo</option>
            <option value="locacion_servicios">Locación de servicios</option>
            <option value="practicas">Prácticas</option>
            <option value="recibo_honorarios">Recibo honorarios</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Modalidad</label>
          <select value={modalidad} onChange={(e) => setModalidad(e.target.value as DatosLaborales['modalidad'])} className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg bg-white focus:border-sky-500 focus:outline-none">
            <option value="presencial">Presencial</option>
            <option value="hibrido">Híbrido</option>
            <option value="remoto">Remoto</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Área</label>
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="ej: Ventas" className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Vacaciones disponibles</label>
          <input type="number" min="0" value={vacaciones} onChange={(e) => setVacaciones(e.target.value)} placeholder="días" className="w-full px-3 py-2 text-[12px] tabular-nums border border-slate-300 rounded-lg focus:border-sky-500 focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Notas internas</label>
        <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas opcionales..." className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg focus:border-sky-500 focus:outline-none" />
      </div>
    </div>
  );
}
