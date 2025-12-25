import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Bell,
  TrendingDown,
  Package,
  DollarSign,
  Clock
} from 'lucide-react';
import type { AlertaInvestigacion } from '../../../types/producto.types';
import type { Timestamp } from 'firebase/firestore';

interface AlertasInvestigacionProps {
  alertas: AlertaInvestigacion[];
  onMarcarLeida?: (alertaId: string) => void;
  onMarcarTodasLeidas?: () => void;
  compact?: boolean;
}

export const AlertasInvestigacion: React.FC<AlertasInvestigacionProps> = ({
  alertas,
  onMarcarLeida,
  onMarcarTodasLeidas,
  compact = false
}) => {
  const alertasNoLeidas = alertas.filter(a => !a.leida);
  const alertasLeidas = alertas.filter(a => a.leida);

  const getAlertaIcon = (tipo: AlertaInvestigacion['tipo']) => {
    switch (tipo) {
      case 'vigencia':
        return <Clock className="h-4 w-4" />;
      case 'margen_bajo':
        return <TrendingDown className="h-4 w-4" />;
      case 'precio_competidor':
        return <DollarSign className="h-4 w-4" />;
      case 'sin_stock':
        return <Package className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeveridadStyles = (severidad: AlertaInvestigacion['severidad']) => {
    switch (severidad) {
      case 'danger':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-500',
          text: 'text-red-800',
          badge: 'bg-red-100 text-red-700'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-500',
          text: 'text-yellow-800',
          badge: 'bg-yellow-100 text-yellow-700'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-500',
          text: 'text-blue-800',
          badge: 'bg-blue-100 text-blue-700'
        };
    }
  };

  const formatFecha = (fecha: Timestamp) => {
    const date = fecha?.toDate?.() || new Date();
    const ahora = new Date();
    const diff = ahora.getTime() - date.getTime();
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const dias = Math.floor(horas / 24);

    if (horas < 1) return 'Hace menos de 1 hora';
    if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    if (dias < 7) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  const getTipoLabel = (tipo: AlertaInvestigacion['tipo']) => {
    switch (tipo) {
      case 'vigencia': return 'Vigencia';
      case 'margen_bajo': return 'Margen';
      case 'precio_competidor': return 'Precio';
      case 'sin_stock': return 'Stock';
      default: return tipo;
    }
  };

  if (alertas.length === 0) {
    return (
      <div className="text-center text-gray-500 py-6">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Sin alertas</p>
        <p className="text-xs mt-1">Las alertas se generan automáticamente al guardar</p>
      </div>
    );
  }

  // Modo compacto para mostrar en cards
  if (compact) {
    if (alertasNoLeidas.length === 0) return null;

    return (
      <div className="flex items-center gap-2">
        {alertasNoLeidas.slice(0, 3).map(alerta => {
          const styles = getSeveridadStyles(alerta.severidad);
          return (
            <div
              key={alerta.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${styles.badge}`}
              title={alerta.mensaje}
            >
              {getAlertaIcon(alerta.tipo)}
              <span>{getTipoLabel(alerta.tipo)}</span>
            </div>
          );
        })}
        {alertasNoLeidas.length > 3 && (
          <span className="text-xs text-gray-500">+{alertasNoLeidas.length - 3}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {alertasNoLeidas.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-700">
              {alertasNoLeidas.length} alerta{alertasNoLeidas.length > 1 ? 's' : ''} activa{alertasNoLeidas.length > 1 ? 's' : ''}
            </span>
          </div>
          {onMarcarTodasLeidas && alertasNoLeidas.length > 1 && (
            <button
              type="button"
              onClick={onMarcarTodasLeidas}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
      )}

      {/* Alertas no leídas */}
      <div className="space-y-2">
        {alertasNoLeidas.map(alerta => {
          const styles = getSeveridadStyles(alerta.severidad);

          return (
            <div
              key={alerta.id}
              className={`relative rounded-lg border p-3 ${styles.bg} ${styles.border}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${styles.icon}`}>
                  {alerta.severidad === 'danger' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : alerta.severidad === 'warning' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <Info className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles.badge}`}>
                      {getTipoLabel(alerta.tipo)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatFecha(alerta.fecha)}
                    </span>
                  </div>
                  <p className={`text-sm ${styles.text}`}>
                    {alerta.mensaje}
                  </p>
                </div>

                {onMarcarLeida && (
                  <button
                    type="button"
                    onClick={() => onMarcarLeida(alerta.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Marcar como leída"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alertas leídas (colapsadas) */}
      {alertasLeidas.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            {alertasLeidas.length} alerta{alertasLeidas.length > 1 ? 's' : ''} anterior{alertasLeidas.length > 1 ? 'es' : ''}
          </summary>
          <div className="mt-2 space-y-2 opacity-60">
            {alertasLeidas.map(alerta => {
              const styles = getSeveridadStyles(alerta.severidad);

              return (
                <div
                  key={alerta.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`${styles.icon}`}>
                      {getAlertaIcon(alerta.tipo)}
                    </span>
                    <span className="text-xs text-gray-600 flex-1 truncate">
                      {alerta.mensaje}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFecha(alerta.fecha)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
};
