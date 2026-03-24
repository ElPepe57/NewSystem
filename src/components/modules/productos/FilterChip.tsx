import React from 'react';
import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, value, onRemove }) => (
  <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs sm:text-sm font-medium">
    <span className="text-primary-400 text-[10px] sm:text-xs">{label}:</span>
    <span className="truncate max-w-[100px] sm:max-w-[150px]">{value}</span>
    <button
      type="button"
      onClick={onRemove}
      className="ml-0.5 p-0.5 rounded-full hover:bg-primary-200 transition-colors"
      aria-label={`Quitar filtro ${label}: ${value}`}
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);
