/**
 * LogisticaAlertasSection — S40 Bloque F
 *
 * Alertas operativas detectadas en tiempo real sobre envíos/incidencias/reclamos.
 * Client-side (calculadas al cargar la vista) — la versión server-side con Cloud Function
 * está en `functions/src/alertasLogistica.ts` como scaffolding (no deployado).
 *
 * Umbrales configurables:
 *   ADUANA_DIAS_CRITICO = 10  (envío retenido más de 10 días)
 *   INCIDENCIA_DIAS_SIN_RESOLVER = 14
 *   RECLAMO_SIN_RESPUESTA_DIAS = 21
 *   FILL_RATE_UMBRAL = 70  (%)
 */
import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  Gavel,
  TrendingDown,
  CheckCircle,
} from 'lucide-react';
import { useEnvioStore } from '../../../store/envioStore';
import { useReclamoStore } from '../../../store/reclamoStore';
import type { Envio, IncidenciaEnvio } from '../../../types/envio.types';
import type { Reclamo } from '../../../types/reclamo.types';

// ─── Umbrales (configurables en un solo lugar) ──────────────────────────

const ADUANA_DIAS_CRITICO = 10;
const INCIDENCIA_DIAS_SIN_RESOLVER = 14;
const RECLAMO_SIN_RESPUESTA_DIAS = 21;
const FILL_RATE_UMBRAL = 70;

type Severidad = 'critica' | 'alta' | 'media' | 'baja';

interface Alerta {
  id: string;
  severidad: Severidad;
  tipo: 'aduana' | 'incidencia' | 'reclamo' | 'fill_rate';
  titulo: string;
  descripcion: string;
  accion?: string;
  entidadId?: string;  // envioId, reclamoId, etc.
  entidadRef?: string; // numero para mostrar
  diasTranscurridos?: number;
}

export const LogisticaAlertasSection: React.FC = () => {
  const { envios } = useEnvioStore();
  const { reclamos } = useReclamoStore();

  const alertas = useMemo<Alerta[]>(() => {
    const now = Date.now();
    const DIA_MS = 24 * 60 * 60 * 1000;
    const out: Alerta[] = [];

    // 1. ADUANA: envíos con incidencias aduana sin resolver > N días
    for (const envio of envios) {
      for (const inc of (envio.incidencias || [])) {
        if (inc.tipo !== 'aduana' || inc.resuelta) continue;
        const inicio = inc.fechaRetencion?.toMillis() || inc.fechaRegistro.toMillis();
        const dias = Math.floor((now - inicio) / DIA_MS);
        if (dias >= ADUANA_DIAS_CRITICO) {
          out.push({
            id: `aduana-${envio.id}-${inc.id}`,
            severidad: dias >= ADUANA_DIAS_CRITICO * 2 ? 'critica' : 'alta',
            tipo: 'aduana',
            titulo: `Retención aduana crítica`,
            descripcion: `Envío ${envio.numeroEnvio} tiene unidad ${inc.sku || 'SKU'} retenida en aduana desde hace ${dias} días.`,
            accion: 'Liberar aduana o descartar como pérdida',
            entidadId: envio.id,
            entidadRef: envio.numeroEnvio,
            diasTranscurridos: dias,
          });
        }
      }
    }

    // 2. INCIDENCIAS: dañadas/perdidas sin resolver > N días
    for (const envio of envios) {
      for (const inc of (envio.incidencias || [])) {
        if (inc.resuelta) continue;
        if (inc.tipo !== 'danada' && inc.tipo !== 'faltante') continue;
        const dias = Math.floor((now - inc.fechaRegistro.toMillis()) / DIA_MS);
        if (dias >= INCIDENCIA_DIAS_SIN_RESOLVER) {
          out.push({
            id: `inc-${envio.id}-${inc.id}`,
            severidad: dias >= INCIDENCIA_DIAS_SIN_RESOLVER * 2 ? 'alta' : 'media',
            tipo: 'incidencia',
            titulo: `Incidencia sin resolver`,
            descripcion: `${inc.tipo === 'danada' ? 'Dañada' : 'Perdida'} en ${envio.numeroEnvio} (${inc.sku || 'SKU'}) pendiente hace ${dias} días.`,
            accion: 'Gestionar disposición o crear reclamo',
            entidadId: envio.id,
            entidadRef: envio.numeroEnvio,
            diasTranscurridos: dias,
          });
        }
      }
    }

    // 3. RECLAMOS: enviados sin respuesta > N días
    for (const reclamo of reclamos) {
      if (reclamo.estado !== 'enviado' && reclamo.estado !== 'en_disputa') continue;
      const ref = reclamo.fechaEnvio || reclamo.fechaCreacion;
      const dias = Math.floor((now - ref.toMillis()) / DIA_MS);
      if (dias >= RECLAMO_SIN_RESPUESTA_DIAS) {
        out.push({
          id: `rec-${reclamo.id}`,
          severidad: dias >= RECLAMO_SIN_RESPUESTA_DIAS * 2 ? 'alta' : 'media',
          tipo: 'reclamo',
          titulo: `Reclamo sin respuesta`,
          descripcion: `${reclamo.numeroReclamo} a ${reclamo.destinatarioNombre} sin respuesta hace ${dias} días. Monto: S/ ${reclamo.montoReclamadoPEN.toFixed(2)}`,
          accion: 'Escalar o cerrar sin cobrar',
          entidadId: reclamo.id,
          entidadRef: reclamo.numeroReclamo,
          diasTranscurridos: dias,
        });
      }
    }

    // 4. FILL RATE: completadas con % bajo umbral
    const completadas = envios.filter(e => e.estado === 'recibida_completa' || e.estado === 'recibida_parcial');
    let totalEsperadas = 0;
    let totalRecibidas = 0;
    for (const e of completadas) {
      totalEsperadas += e.totalUnidades || 0;
      totalRecibidas += e.totalUnidadesRecibidas || 0;
    }
    const fillRate = totalEsperadas > 0 ? (totalRecibidas / totalEsperadas) * 100 : 100;
    if (completadas.length > 0 && fillRate < FILL_RATE_UMBRAL) {
      out.push({
        id: 'fill-rate-global',
        severidad: fillRate < FILL_RATE_UMBRAL * 0.7 ? 'critica' : 'alta',
        tipo: 'fill_rate',
        titulo: `Fill Rate bajo umbral`,
        descripcion: `Fill Rate global: ${fillRate.toFixed(1)}% (umbral: ${FILL_RATE_UMBRAL}%). ${totalRecibidas} de ${totalEsperadas} unidades recibidas en ${completadas.length} envíos completados.`,
        accion: 'Revisar envíos con mayor pérdida de unidades',
      });
    }

    // Ordenar por severidad
    const ordenSeveridad = { critica: 0, alta: 1, media: 2, baja: 3 };
    out.sort((a, b) => ordenSeveridad[a.severidad] - ordenSeveridad[b.severidad]);
    return out;
  }, [envios, reclamos]);

  if (alertas.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-emerald-900">Sin alertas operativas</p>
          <p className="text-sm text-emerald-700">No hay retenciones aduana prolongadas, incidencias sin resolver ni reclamos pendientes fuera de umbral.</p>
        </div>
      </div>
    );
  }

  // Agrupar por severidad
  const porSev = alertas.reduce((acc, a) => {
    (acc[a.severidad] = acc[a.severidad] || []).push(a);
    return acc;
  }, {} as Record<Severidad, Alerta[]>);

  const contSev = {
    critica: porSev.critica?.length || 0,
    alta: porSev.alta?.length || 0,
    media: porSev.media?.length || 0,
    baja: porSev.baja?.length || 0,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-slate-900">Alertas operativas</h3>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {contSev.critica > 0 && <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-semibold">{contSev.critica} crítica{contSev.critica !== 1 ? 's' : ''}</span>}
          {contSev.alta > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white font-semibold">{contSev.alta} alta{contSev.alta !== 1 ? 's' : ''}</span>}
          {contSev.media > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 font-semibold">{contSev.media} media{contSev.media !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {alertas.map(alerta => (
          <AlertaRow key={alerta.id} alerta={alerta} />
        ))}
      </div>

      <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-500">
        Umbrales: aduana ≥{ADUANA_DIAS_CRITICO}d · incidencias ≥{INCIDENCIA_DIAS_SIN_RESOLVER}d · reclamos ≥{RECLAMO_SIN_RESPUESTA_DIAS}d · fill rate &lt;{FILL_RATE_UMBRAL}%
      </div>
    </div>
  );
};

// ─── Fila de alerta ───────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severidad, { bg: string; border: string; text: string; dot: string }> = {
  critica: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', dot: 'bg-red-600' },
  alta: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', dot: 'bg-orange-500' },
  media: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', dot: 'bg-amber-400' },
  baja: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', dot: 'bg-slate-400' },
};

const TIPO_ICON: Record<Alerta['tipo'], React.ElementType> = {
  aduana: ShieldAlert,
  incidencia: AlertTriangle,
  reclamo: Gavel,
  fill_rate: TrendingDown,
};

const AlertaRow: React.FC<{ alerta: Alerta }> = ({ alerta }) => {
  const sev = SEV_CONFIG[alerta.severidad];
  const Icon = TIPO_ICON[alerta.tipo];
  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${sev.bg}`}>
      <div className="flex-shrink-0 pt-0.5">
        <Icon className={`w-4 h-4 ${sev.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${sev.dot}`} />
          <span className={`text-sm font-semibold ${sev.text}`}>{alerta.titulo}</span>
          {alerta.entidadRef && (
            <span className="text-xs font-mono text-slate-500">{alerta.entidadRef}</span>
          )}
          {alerta.diasTranscurridos !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${sev.bg} ${sev.text} border ${sev.border}`}>
              <Clock className="inline w-3 h-3 mr-0.5" />
              {alerta.diasTranscurridos}d
            </span>
          )}
        </div>
        <p className="text-xs text-slate-700 mt-1">{alerta.descripcion}</p>
        {alerta.accion && (
          <p className="text-xs text-slate-500 mt-0.5 italic">→ {alerta.accion}</p>
        )}
      </div>
    </div>
  );
};
