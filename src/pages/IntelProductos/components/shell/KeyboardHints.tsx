/**
 * KeyboardHints · banner con atajos · Cost Intelligence
 *
 * Discovery de atajos · pattern Linear/Notion.
 * Solo se muestran los atajos efectivamente implementados en MVP.
 * Los diferidos se incluyen apagados con tooltip "pronto".
 */

import React from 'react';

export const KeyboardHints: React.FC = () => {
  return (
    <div className="bg-slate-900 text-white rounded-lg p-3 text-xs flex items-center gap-3 flex-wrap">
      <span className="font-bold">Atajos:</span>
      <Hint k="1-5" desc="cambiar workspace" />
      <Hint k="/" desc="búsqueda" diferido />
      <Hint k="j" desc="bajar" diferido />
      <Hint k="k" desc="subir" diferido />
      <Hint k="⏎" desc="drill-down" diferido />
      <Hint k="esc" desc="volver" diferido />
      <Hint k="⌘k" desc="command palette" diferido />
    </div>
  );
};

interface HintProps { k: string; desc: string; diferido?: boolean }
const Hint: React.FC<HintProps> = ({ k, desc, diferido }) => (
  <span
    className={`flex items-center gap-1 ${diferido ? 'opacity-50' : ''}`}
    title={diferido ? 'Pronto' : undefined}
  >
    <kbd className="font-mono font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded text-[10px]">
      {k}
    </kbd>
    <span>{desc}</span>
  </span>
);
