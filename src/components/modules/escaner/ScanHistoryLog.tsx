import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Trash2, Clock } from 'lucide-react';
import type { ScanResult } from '../../../types/escaner.types';

interface ScanHistoryLogProps {
  history: ScanResult[];
  onClear: () => void;
  onSelectItem: (result: ScanResult) => void;
  onDeleteItem?: (result: ScanResult) => void;
}

export const ScanHistoryLog: React.FC<ScanHistoryLogProps> = ({
  history,
  onClear,
  onSelectItem,
  onDeleteItem
}) => {
  if (history.length === 0) return null;

  const found = history.filter(h => h.status === 'found').length;
  const notFound = history.filter(h => h.status === 'not_found').length;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusIcon = (status: ScanResult['status']) => {
    switch (status) {
      case 'found':
        return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
      case 'not_found':
        return <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">
              Historial ({history.length})
            </span>
          </div>
          <div className="flex gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
            <span className="text-green-600 font-medium">{found} ok</span>
            <span className="text-gray-300">|</span>
            <span className="text-red-400 font-medium">{notFound} no</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          <span className="hidden sm:inline">Limpiar</span>
        </button>
      </div>

      {/* List - taller touch targets on mobile */}
      <div className="max-h-48 sm:max-h-60 overflow-y-auto divide-y divide-gray-100">
        {history.map((result, index) => (
          <div
            key={`${result.barcode}-${index}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectItem(result)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(result); }}
            className="w-full px-3 py-3 sm:px-4 sm:py-2.5 flex items-center gap-2.5 sm:gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
          >
            {getStatusIcon(result.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-mono text-xs sm:text-sm text-gray-800 truncate">
                  {result.barcode}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">
                  {result.format}
                </span>
              </div>
              {result.productoNombre && (
                <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                  {result.productoSKU && <span className="font-medium">{result.productoSKU}</span>}
                  {result.productoSKU && ' · '}
                  {result.productoNombre}
                </p>
              )}
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0 tabular-nums">
              {formatTime(result.timestamp)}
            </span>
            {onDeleteItem && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteItem(result); }}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
