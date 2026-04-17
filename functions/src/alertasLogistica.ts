/**
 * alertasLogistica.ts — S40 Bloque F
 *
 * SCAFFOLD (NO DEPLOYADO — requiere revisión antes de agregar a index.ts).
 *
 * Cloud Function programada que escanea periódicamente envíos, incidencias y reclamos
 * para generar notificaciones cuando detecta situaciones fuera de umbral:
 *   - Retenciones aduanas > N días sin resolver
 *   - Incidencias dañadas/perdidas > N días sin resolver
 *   - Reclamos enviados sin respuesta > N días
 *   - Fill rate mensual bajo umbral
 *
 * Las notificaciones se guardan en la colección `notificaciones` con:
 *   - destinatarioUserId: opcional (null = global, visible a todos los admins)
 *   - categoria: 'logistica'
 *   - severidad: 'critica' | 'alta' | 'media' | 'baja'
 *   - tipo: 'aduana' | 'incidencia' | 'reclamo' | 'fill_rate'
 *   - entidadId: referencia (envioId, reclamoId)
 *   - leida: false
 *
 * Frecuencia sugerida: cada 6 horas (06:00, 12:00, 18:00, 00:00 Lima).
 * Deduplica: solo genera una notificación por (tipo + entidadId + dia) para no spammear.
 *
 * Para activar:
 *   1. Revisar umbrales y lógica
 *   2. Agregar `export * from './alertasLogistica'` en `functions/src/index.ts`
 *   3. Descomentar trigger scheduledAlertasLogistica
 *   4. `firebase deploy --only functions:scheduledAlertasLogistica`
 */
import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ─── Umbrales (mantener sincronizado con LogisticaAlertasSection.tsx) ──

const ADUANA_DIAS_CRITICO = 10;
const INCIDENCIA_DIAS_SIN_RESOLVER = 14;
const RECLAMO_SIN_RESPUESTA_DIAS = 21;
const FILL_RATE_UMBRAL = 70;

type Severidad = 'critica' | 'alta' | 'media' | 'baja';

interface AlertaNotif {
  categoria: 'logistica';
  severidad: Severidad;
  tipo: 'aduana' | 'incidencia' | 'reclamo' | 'fill_rate';
  titulo: string;
  descripcion: string;
  accion?: string;
  entidadId?: string;
  entidadRef?: string;
  diasTranscurridos?: number;
  fingerprint: string;  // para deduplicación
}

function hashFingerprint(tipo: string, entidadId: string | undefined): string {
  const fecha = new Date().toISOString().substring(0, 10);  // YYYY-MM-DD
  return `${tipo}:${entidadId || 'global'}:${fecha}`;
}

// ─── Detectores ────────────────────────────────────────────────────────

async function detectarAlertas(): Promise<AlertaNotif[]> {
  const now = Date.now();
  const DIA_MS = 24 * 60 * 60 * 1000;
  const out: AlertaNotif[] = [];

  // Leer envíos activos (no completados ni cancelados para aduana/incidencia)
  const enviosSnap = await db.collection('envios')
    .where('estado', 'in', ['en_transito', 'retenida_aduana', 'recibida_parcial', 'recibida_completa'])
    .get();
  const envios = enviosSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // 1. ADUANA
  for (const envio of envios) {
    for (const inc of (envio.incidencias || [])) {
      if (inc.tipo !== 'aduana' || inc.resuelta) continue;
      const inicio = inc.fechaRetencion?.toMillis?.() || inc.fechaRegistro?.toMillis?.() || 0;
      if (!inicio) continue;
      const dias = Math.floor((now - inicio) / DIA_MS);
      if (dias >= ADUANA_DIAS_CRITICO) {
        out.push({
          categoria: 'logistica',
          severidad: dias >= ADUANA_DIAS_CRITICO * 2 ? 'critica' : 'alta',
          tipo: 'aduana',
          titulo: 'Retención aduana crítica',
          descripcion: `Envío ${envio.numeroEnvio} retenido ${dias} días (SKU ${inc.sku || 'N/A'})`,
          accion: 'Liberar aduana o descartar como pérdida',
          entidadId: envio.id,
          entidadRef: envio.numeroEnvio,
          diasTranscurridos: dias,
          fingerprint: hashFingerprint('aduana', `${envio.id}-${inc.id}`),
        });
      }
    }
  }

  // 2. INCIDENCIAS
  for (const envio of envios) {
    for (const inc of (envio.incidencias || [])) {
      if (inc.resuelta || (inc.tipo !== 'danada' && inc.tipo !== 'faltante')) continue;
      const dias = Math.floor((now - (inc.fechaRegistro?.toMillis?.() || 0)) / DIA_MS);
      if (dias >= INCIDENCIA_DIAS_SIN_RESOLVER) {
        out.push({
          categoria: 'logistica',
          severidad: dias >= INCIDENCIA_DIAS_SIN_RESOLVER * 2 ? 'alta' : 'media',
          tipo: 'incidencia',
          titulo: 'Incidencia sin resolver',
          descripcion: `${inc.tipo === 'danada' ? 'Dañada' : 'Perdida'} en ${envio.numeroEnvio} pendiente hace ${dias} días`,
          accion: 'Gestionar disposición o crear reclamo',
          entidadId: envio.id,
          entidadRef: envio.numeroEnvio,
          diasTranscurridos: dias,
          fingerprint: hashFingerprint('incidencia', `${envio.id}-${inc.id}`),
        });
      }
    }
  }

  // 3. RECLAMOS
  const reclamosSnap = await db.collection('reclamos')
    .where('estado', 'in', ['enviado', 'en_disputa'])
    .get();
  for (const doc of reclamosSnap.docs) {
    const r = doc.data() as any;
    const ref = r.fechaEnvio || r.fechaCreacion;
    if (!ref?.toMillis) continue;
    const dias = Math.floor((now - ref.toMillis()) / DIA_MS);
    if (dias >= RECLAMO_SIN_RESPUESTA_DIAS) {
      out.push({
        categoria: 'logistica',
        severidad: dias >= RECLAMO_SIN_RESPUESTA_DIAS * 2 ? 'alta' : 'media',
        tipo: 'reclamo',
        titulo: 'Reclamo sin respuesta',
        descripcion: `${r.numeroReclamo} a ${r.destinatarioNombre} sin respuesta hace ${dias} días (S/ ${(r.montoReclamadoPEN || 0).toFixed(2)})`,
        accion: 'Escalar o cerrar sin cobrar',
        entidadId: doc.id,
        entidadRef: r.numeroReclamo,
        diasTranscurridos: dias,
        fingerprint: hashFingerprint('reclamo', doc.id),
      });
    }
  }

  // 4. FILL RATE (global mensual)
  const enviosCompletadosSnap = await db.collection('envios')
    .where('estado', 'in', ['recibida_completa', 'recibida_parcial'])
    .get();
  let totalEsperadas = 0, totalRecibidas = 0;
  for (const doc of enviosCompletadosSnap.docs) {
    const e = doc.data() as any;
    totalEsperadas += e.totalUnidades || 0;
    totalRecibidas += e.totalUnidadesRecibidas || 0;
  }
  const fillRate = totalEsperadas > 0 ? (totalRecibidas / totalEsperadas) * 100 : 100;
  if (enviosCompletadosSnap.size > 0 && fillRate < FILL_RATE_UMBRAL) {
    out.push({
      categoria: 'logistica',
      severidad: fillRate < FILL_RATE_UMBRAL * 0.7 ? 'critica' : 'alta',
      tipo: 'fill_rate',
      titulo: 'Fill Rate bajo umbral',
      descripcion: `Fill Rate global: ${fillRate.toFixed(1)}% (umbral ${FILL_RATE_UMBRAL}%). ${totalRecibidas}/${totalEsperadas} uds en ${enviosCompletadosSnap.size} envíos.`,
      accion: 'Revisar envíos con mayor pérdida',
      fingerprint: hashFingerprint('fill_rate', 'global'),
    });
  }

  return out;
}

/**
 * Persiste alertas en la colección `notificaciones` usando el fingerprint como id
 * para evitar duplicados dentro del mismo día.
 */
async function persistirAlertas(alertas: AlertaNotif[]): Promise<{ creadas: number; existentes: number }> {
  let creadas = 0;
  let existentes = 0;
  const now = admin.firestore.Timestamp.now();

  for (const alerta of alertas) {
    const ref = db.collection('notificaciones').doc(alerta.fingerprint);
    const existing = await ref.get();
    if (existing.exists) {
      existentes++;
      continue;
    }
    await ref.set({
      ...alerta,
      destinatarioUserId: null,  // null = todos los admins
      leida: false,
      fechaCreacion: now,
      esAutomatica: true,
      origen: 'cron-alertasLogistica',
    });
    creadas++;
  }
  return { creadas, existentes };
}

// ─── Scheduled trigger (DESCOMENTAR PARA DEPLOY) ───────────────────────

/*
export const scheduledAlertasLogistica = functions.scheduler.onSchedule(
  {
    schedule: '0 6,12,18,0 * * *',  // cada 6h Lima time
    timeZone: 'America/Lima',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    console.log('[alertasLogistica] Escaneando...');
    const alertas = await detectarAlertas();
    const { creadas, existentes } = await persistirAlertas(alertas);
    console.log(`[alertasLogistica] Detectadas: ${alertas.length} · Creadas: ${creadas} · Ya existían: ${existentes}`);
  }
);
*/

// ─── Trigger callable (para testing manual) ────────────────────────────

/*
export const runAlertasLogisticaManual = functions.https.onCall(
  { region: 'us-central1' },
  async (_data, context) => {
    // Opcional: requerir admin
    // if (!context.auth?.token?.admin) throw new functions.https.HttpsError('permission-denied', 'Solo admins');
    const alertas = await detectarAlertas();
    const { creadas, existentes } = await persistirAlertas(alertas);
    return { detectadas: alertas.length, creadas, existentes };
  }
);
*/

export { detectarAlertas, persistirAlertas };
