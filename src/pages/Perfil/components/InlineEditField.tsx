/**
 * InlineEditField · F10.F.1.J-SIDEBAR.3 · 2026-05-27
 *
 * Componente reutilizable para edición inline tipo Notion.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 5 (líneas 605-636).
 *
 * Patrón:
 *   - Vista normal: label + valor + icon edit (opacity 0 · group-hover:opacity-100)
 *   - Click → input editable con autofocus
 *   - Enter o blur → guardar · Escape → cancelar
 *   - Si readOnly · solo muestra label + valor (sin icon)
 *
 * Uso:
 *   <InlineEditField
 *     label="Teléfono"
 *     value={profile.telefono}
 *     onSave={(v) => userService.updateProfile(uid, { telefono: v })}
 *     placeholder="Sin teléfono · click para agregar"
 *     tabular
 *   />
 */
import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, RefreshCw, CheckCircle } from 'lucide-react';

interface Props {
  /** Label del campo · ej: "Teléfono" · "DNI" · "Cargo" */
  label: string;
  /** Valor actual · puede ser undefined si no está seteado */
  value?: string;
  /** Callback de guardado · debe ser async · retorna void o throw error */
  onSave?: (newValue: string) => Promise<void>;
  /** Placeholder si valor vacío */
  placeholder?: string;
  /** Si true · usa font-tabular para números (DNI · teléfono) */
  tabular?: boolean;
  /** Si true · el campo NO es editable (solo lectura) */
  readOnly?: boolean;
  /** Si true · muestra icon de verificación junto al valor (email verificado) */
  verified?: boolean;
  /** Validación opcional · retorna error string o null si OK */
  validate?: (value: string) => string | null;
  /** Tipo de input · default 'text' */
  inputType?: 'text' | 'tel' | 'email';
  /** maxLength opcional */
  maxLength?: number;
}

export const InlineEditField: React.FC<Props> = ({
  label,
  value,
  onSave,
  placeholder = 'Sin valor · click para agregar',
  tabular = false,
  readOnly = false,
  verified = false,
  validate,
  inputType = 'text',
  maxLength,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (readOnly || !onSave) return;
    setDraft(value || '');
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(value || '');
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!onSave) return;
    const trimmed = draft.trim();
    if (trimmed === (value || '')) {
      setIsEditing(false);
      return;
    }
    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 group gap-2">
        <span className="text-slate-500 text-[12px] flex-shrink-0">{label}</span>
        <div className="flex items-center gap-1.5 flex-1 max-w-[220px]">
          <input
            ref={inputRef}
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxLength}
            disabled={saving}
            className={`flex-1 min-w-0 px-2 py-1 text-[12px] border ${error ? 'border-rose-300' : 'border-purple-300'} rounded focus:outline-none focus:ring-2 focus:ring-purple-200 font-semibold text-slate-900 ${tabular ? 'tabular-nums' : ''}`}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0"
            aria-label="Guardar"
          >
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 flex-shrink-0"
            aria-label="Cancelar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {error && <div className="text-[10px] text-rose-600 ml-2 flex-shrink-0">{error}</div>}
      </div>
    );
  }

  const isEmpty = !value || value.trim() === '';

  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 pb-2 group ${
        !readOnly && onSave ? 'cursor-pointer' : ''
      }`}
      onClick={!readOnly && onSave ? handleStartEdit : undefined}
    >
      <span className="text-slate-500 text-[12px]">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`font-semibold text-[12px] ${tabular ? 'tabular-nums' : ''} ${isEmpty ? 'text-slate-400 italic' : 'text-slate-900'}`}>
          {isEmpty ? placeholder : value}
        </span>
        {verified && <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
        {!readOnly && onSave && !verified && (
          <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>
    </div>
  );
};

export default InlineEditField;
