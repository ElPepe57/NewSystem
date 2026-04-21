/**
 * NuevoEnvioMenu — Menú selector del tipo de envío a crear (Bloque E diferido
 * de S47, ejecutado en S52/realineación visual).
 *
 * Reemplaza los 7 botones apilados en el header por UN solo botón que abre
 * este menú con todos los tipos disponibles (A-J) ordenados por afinidad.
 * Cada opción muestra: código + icono + nombre + descripción corta.
 *
 * Las opciones se filtran por el flag correspondiente (WIZARD_T2/J/E/F/I/G).
 * El "Nuevo envío" clásico (setShowCreateModal) queda como fallback genérico
 * al final cuando no hay flags activos o el tipo no existe aún.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ArrowRightLeft, Package, Truck, Gavel, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common';
import { cn } from '../../design-system';
import { INFO_TIPO_RUTA, type TipoRutaLogistica } from '../../utils/envio.tipoRuta.helpers';
import {
  isWizardT2Enabled,
  isWizardJEnabled,
  isWizardEEnabled,
  isWizardFEnabled,
  isWizardIEnabled,
  isWizardGEnabled,
} from '../../config/features';

export interface NuevoEnvioMenuProps {
  /** Fallback cuando se elige "Nuevo envío (genérico)" o no hay wizards activos */
  onNuevoGenerico: () => void;
}

interface OpcionWizard {
  codigo: TipoRutaLogistica;
  enabled: boolean;
  ruta: string;
  nombre: string;
  descripcion: string;
}

export const NuevoEnvioMenu: React.FC<NuevoEnvioMenuProps> = ({ onNuevoGenerico }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const opciones: OpcionWizard[] = [
    {
      codigo: 'C',
      enabled: isWizardT2Enabled(),
      ruta: '/envios/nuevo-t2',
      nombre: 'Casilla Intl → Perú',
      descripcion: 'Consolidar unidades de una casilla internacional y enviarlas al almacén Perú (T2)',
    },
    {
      codigo: 'J',
      enabled: isWizardJEnabled(),
      ruta: '/envios/nuevo-j',
      nombre: 'Casilla ↔ Casilla Internacional',
      descripcion: 'Mover unidades entre dos casillas internacionales (mismo colaborador o entre colaboradores)',
    },
    {
      codigo: 'E',
      enabled: isWizardEEnabled(),
      ruta: '/envios/nuevo-e',
      nombre: 'Traslado interno Perú',
      descripcion: 'Mover unidades entre dos almacenes propios en Perú (consolidación, capacidad, etc.)',
    },
    {
      codigo: 'F',
      enabled: isWizardFEnabled(),
      ruta: '/envios/nuevo-f',
      nombre: 'Despacho venta → cliente',
      descripcion: 'Despachar una venta existente desde almacén Perú al cliente final',
    },
    {
      codigo: 'G',
      enabled: isWizardGEnabled(),
      ruta: '/envios/nuevo-g',
      nombre: 'Retorno devolución',
      descripcion: 'Registrar el retorno físico de una devolución existente (cliente → almacén Perú)',
    },
    {
      codigo: 'I',
      enabled: isWizardIEnabled(),
      ruta: '/envios/nuevo-i',
      nombre: 'Envío a tercero',
      descripcion: 'Enviar a FBA Amazon, consignación o distribución (stock bloqueado D-10)',
    },
  ];

  const opcionesActivas = opciones.filter((o) => o.enabled);
  const opcionesInactivas = opciones.filter((o) => !o.enabled);

  const handleSelect = (opt: OpcionWizard) => {
    setOpen(false);
    navigate(opt.ruta);
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4 mr-2" />
        Nuevo envío
        <ChevronDown className="h-3.5 w-3.5 ml-1.5 -mr-0.5 opacity-80" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-h-[32rem] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-900">¿Cómo nace este envío?</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Elige el tipo de ruta logística según origen y destino
            </div>
          </div>

          {/* Opciones activas (con flag) */}
          {opcionesActivas.length > 0 && (
            <div className="py-1">
              {opcionesActivas.map((opt) => {
                const info = INFO_TIPO_RUTA[opt.codigo];
                return (
                  <button
                    key={opt.codigo}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors group flex items-start gap-2.5"
                  >
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 text-lg',
                        info.color === 'slate' && 'bg-slate-100 text-slate-700',
                        info.color === 'sky' && 'bg-sky-100 text-sky-700',
                        info.color === 'teal' && 'bg-teal-100 text-teal-700',
                        info.color === 'amber' && 'bg-amber-100 text-amber-700',
                        info.color === 'orange' && 'bg-orange-100 text-orange-700',
                        info.color === 'yellow' && 'bg-yellow-100 text-yellow-700',
                        info.color === 'fuchsia' && 'bg-fuchsia-100 text-fuchsia-700',
                        info.color === 'violet' && 'bg-violet-100 text-violet-700'
                      )}
                    >
                      {info.icono}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400 font-semibold">
                          {opt.codigo}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                          {opt.nombre}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        {opt.descripcion}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Fallback genérico */}
          <div className="border-t border-slate-100 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNuevoGenerico();
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2.5 group"
            >
              <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 inline-flex items-center justify-center flex-shrink-0">
                <ArrowRightLeft className="w-4 h-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 group-hover:text-teal-700">
                  Envío genérico (modal clásico)
                </div>
                <div className="text-[11px] text-slate-500">
                  Flujo antiguo · útil mientras se activan los nuevos wizards
                </div>
              </div>
            </button>
          </div>

          {/* Tipos aún sin wizard / flag apagado — informativo */}
          {opcionesInactivas.length > 0 && (
            <div className="border-t border-slate-100 py-1 bg-slate-50/50">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Tipos con wizard pendiente / flag off
              </div>
              {opcionesInactivas.map((opt) => {
                const info = INFO_TIPO_RUTA[opt.codigo];
                return (
                  <div
                    key={opt.codigo}
                    className="px-3 py-1.5 flex items-center gap-2 opacity-60"
                  >
                    <span className="text-base">{info.icono}</span>
                    <span className="font-mono text-[10px] text-slate-400 font-semibold">
                      {opt.codigo}
                    </span>
                    <span className="text-xs text-slate-500 flex-1 truncate">{opt.nombre}</span>
                    <span className="text-[10px] text-slate-400 italic">
                      {!opt.enabled ? 'flag off' : 'pendiente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helpers para dar acceso rápido a los íconos usados en los botones aislados
// (mantienen el import en el barrel limpio)
export const _iconsUsed = { ArrowRightLeft, Package, Truck, Gavel, RefreshCw };
