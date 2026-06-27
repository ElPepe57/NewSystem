/**
 * ModoSelector · F4+ · Creación guiada.
 *
 * El segmented selector de los 4 modos (mockup acto 2 · líneas ~206-211):
 * Restock · Apuesta · Manual · Comprometida. El modo activo se viste con el color
 * SEMÁNTICO de su lente (sky=restock · amber/indigo=apuesta · slate=manual ·
 * emerald=comprometida · igual que OrigenBadge). En mobile va en scroll-x (acto 8).
 */
import React from 'react';
import { Cpu, Target, Hand, UserCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModoCreacion } from './creacionGuiada.helper';

interface ModoDef {
  id: ModoCreacion;
  label: string;
  icon: LucideIcon;
  activoCls: string;
}

const MODOS: ModoDef[] = [
  { id: 'restock', label: 'Restock', icon: Cpu, activoCls: 'bg-sky-600 text-white' },
  { id: 'apuesta', label: 'Apuesta', icon: Target, activoCls: 'bg-amber-600 text-white' },
  { id: 'manual', label: 'Manual', icon: Hand, activoCls: 'bg-slate-700 text-white' },
  { id: 'comprometida', label: 'Comprometida', icon: UserCheck, activoCls: 'bg-emerald-600 text-white' },
];

interface Props {
  modo: ModoCreacion;
  onChange: (m: ModoCreacion) => void;
}

export const ModoSelector: React.FC<Props> = ({ modo, onChange }) => (
  <div className="flex items-center gap-2 flex-wrap mb-4 overflow-x-auto scrollbar-none -mx-1 px-1">
    {MODOS.map((m) => {
      const Icon = m.icon;
      const activo = modo === m.id;
      return (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`text-[12px] font-semibold rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 whitespace-nowrap min-h-[44px] sm:min-h-0 ${
            activo
              ? m.activoCls
              : 'font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon className="w-3.5 h-3.5" /> {m.label}
        </button>
      );
    })}
  </div>
);

export default ModoSelector;
