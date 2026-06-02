/**
 * EnviosDeOC — S40 Bloque E
 *
 * Sección embebida en el detalle de una OC que lista los envíos vinculados.
 * Reemplaza conceptualmente al botón "Recepción Parcial" — la recepción ahora
 * se gestiona desde el Envío asociado (flujo canónico post-S38).
 *
 * Cada envío se muestra como card con:
 *  - Número + estado + tipo
 *  - Courier/tracking (si está despachado)
 *  - Progress bar de recepción
 *  - Link "Abrir en Envíos →" que navega con deep-link `/envios?envioId=X`
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Badge } from '../../common';
import { envioCrudService } from '../../../services/envio.crud.service';
import type { Envio, EstadoEnvio } from '../../../types/envio.types';

interface EnviosDeOCProps {
  ordenCompraId: string;
  /** Si se pasa, se llama al click en card en lugar de navegar (permite modal inline). */
  onAbrirEnvio?: (envio: Envio) => void;
}

const ESTADO_CONFIG: Record<EstadoEnvio, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'info'; icon: React.ElementType }> = {
  borrador: { label: 'Borrador', variant: 'default', icon: Clock },
  confirmado: { label: 'Confirmado', variant: 'warning', icon: CheckCircle },
  en_transito: { label: 'En tránsito', variant: 'info', icon: Truck },
  retenida_aduana: { label: 'Aduana', variant: 'danger', icon: ShieldAlert },
  recibida_parcial: { label: 'Parcial', variant: 'warning', icon: AlertTriangle },
  recibida_completa: { label: 'Completado', variant: 'success', icon: CheckCircle },
  perdida_total: { label: 'Perdido', variant: 'danger', icon: XCircle },
  cancelada: { label: 'Cancelado', variant: 'danger', icon: XCircle },
};

export const EnviosDeOC: React.FC<EnviosDeOCProps> = ({
  ordenCompraId,
  onAbrirEnvio,
}) => {
  const navigate = useNavigate();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    envioCrudService.getByFiltros({ ordenCompraId })
      .then(list => {
        if (!cancelled) {
          // Orden: no cancelados primero, luego por fecha creación desc
          const ordenados = [...list].sort((a, b) => {
            if (a.estado === 'cancelada' && b.estado !== 'cancelada') return 1;
            if (b.estado === 'cancelada' && a.estado !== 'cancelada') return -1;
            return b.fechaCreacion.toMillis() - a.fechaCreacion.toMillis();
          });
          setEnvios(ordenados);
        }
      })
      .catch(() => { if (!cancelled) setEnvios([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ordenCompraId]);

  const resumen = useMemo(() => {
    const activos = envios.filter(e => e.estado !== 'cancelada');
    const recibidas = activos.reduce((s, e) => s + (e.totalUnidadesRecibidas || 0), 0);
    const esperadas = activos.reduce((s, e) => s + (e.totalUnidades || 0), 0);
    const completos = activos.filter(e => e.estado === 'recibida_completa').length;
    return { totalEnvios: activos.length, recibidas, esperadas, completos };
  }, [envios]);

  const handleAbrir = (envio: Envio) => {
    if (onAbrirEnvio) {
      onAbrirEnvio(envio);
    } else {
      navigate(`/envios?envioId=${envio.id}`);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400" />
          Cargando envíos…
        </div>
      </div>
    );
  }

  if (envios.length === 0) {
    // OC sin envíos: probablemente legacy pre-S37 o borrador sin confirmar
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header con resumen */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-slate-500" />
            Envíos de esta OC ({resumen.totalEnvios})
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {resumen.recibidas} de {resumen.esperadas} unidades recibidas
            {resumen.completos > 0 && ` · ${resumen.completos} envío(s) completados`}
          </p>
        </div>
      </div>

      {/* Banner explicativo */}
      <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-200 rounded-lg">
        <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800">
          <strong>La recepción se gestiona desde cada envío.</strong> Click en un envío para abrir su detalle completo y registrar recepciones, incidencias o liberaciones aduaneras.
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {envios.map(envio => {
          const cfg = ESTADO_CONFIG[envio.estado] || ESTADO_CONFIG.borrador;
          const Icon = cfg.icon;
          const recibidas = envio.totalUnidadesRecibidas || 0;
          const total = envio.totalUnidades || 0;
          const pct = total > 0 ? Math.round((recibidas / total) * 100) : 0;
          const hayIncidencias = (envio.incidencias || []).filter(i => !i.resuelta).length;
          const esActivo = envio.estado !== 'cancelada';

          return (
            <button
              key={envio.id}
              type="button"
              onClick={() => handleAbrir(envio)}
              className={`text-left p-3 rounded-lg border transition-colors group ${
                esActivo
                  ? 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">{envio.numeroEnvio}</span>
                    <Badge variant={cfg.variant} size="sm">
                      <Icon className="w-3 h-3 mr-1" />
                      {cfg.label}
                    </Badge>
                    {envio.subOrdenId && (
                      <Badge variant="default" size="sm">sub-orden</Badge>
                    )}
                  </div>
                  {/* S42bg — BUG FIX consistente con EnvioDetailModal/EnvioCard:
                      antes se mostraba `envio.colaboradorNombre` con icono
                      Truck como si fuera transportador, pero el colaborador
                      normalmente es el DUEÑO DE LA CASILLA DESTINO. El
                      transportador real vive en `envio.courier` (seteado al
                      despachar). Ahora solo se muestra si hay courier real. */}
                  {envio.courier && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      <Truck className="inline w-3 h-3 mr-0.5" />
                      {envio.courier}
                      {envio.numeroTracking && <span className="ml-1 font-mono text-slate-400">· {envio.numeroTracking}</span>}
                    </div>
                  )}
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 flex-shrink-0" />
              </div>

              {/* Progress bar */}
              {esActivo && (
                <>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        pct >= 100 ? 'bg-emerald-500'
                        : pct > 0 ? 'bg-amber-500'
                        : 'bg-slate-300'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{recibidas}/{total} unidades ({pct}%)</span>
                    {hayIncidencias > 0 && (
                      <span className="text-red-600 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {hayIncidencias} incidencia{hayIncidencias !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
