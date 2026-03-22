import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { cuentasPendientesService } from '../services/cuentasPendientes.service';
import { NotificationService } from '../services/notification.service';
import { tipoCambioService } from '../services/tipoCambio.service';
import { logger } from '../lib/logger';

/**
 * Intervalos de renotificación según nivel de alerta (en días).
 * Una alerta de nivel "critico" se repite cada 1 día, "urgente" cada 3, etc.
 */
const INTERVALO_DIAS: Record<string, number> = {
  critico: 1,
  urgente: 3,
  atencion: 5,
  seguimiento: 7
};

/**
 * Determina el nivel de alerta según los días pendientes.
 * Retorna null si no corresponde generar alerta (<=7 días).
 */
function nivelAlerta(diasPendiente: number): string | null {
  if (diasPendiente > 60) return 'critico';
  if (diasPendiente > 30) return 'urgente';
  if (diasPendiente > 15) return 'atencion';
  if (diasPendiente > 7)  return 'seguimiento';
  return null;
}

/**
 * Mapea el nivel de alerta a la prioridad del sistema de notificaciones.
 */
function prioridadPorNivel(nivel: string): 'urgente' | 'alta' | 'media' | 'baja' {
  switch (nivel) {
    case 'critico':    return 'urgente';
    case 'urgente':    return 'alta';
    case 'atencion':   return 'media';
    default:           return 'baja';
  }
}

/**
 * Etiquetas legibles para el mensaje de notificación.
 */
function etiquetaNivel(nivel: string): string {
  switch (nivel) {
    case 'critico':    return 'CRITICO';
    case 'urgente':    return 'URGENTE';
    case 'atencion':   return 'ATENCION';
    default:           return 'SEGUIMIENTO';
  }
}

/**
 * Hook de alertas automáticas de cobro vencido.
 *
 * Se ejecuta al montar el componente (Dashboard o MainLayout).
 * Solo actua para roles admin, gerente y finanzas.
 * Guard interno: no re-evalua si han pasado menos de 1 hora desde la ultima ejecucion.
 *
 * Por cada venta con mas de 7 dias pendiente:
 *  - Determina el nivel de alerta segun los dias transcurridos
 *  - Verifica que no exista ya una notificacion reciente para esa venta (anti-spam)
 *  - Crea la notificacion en Firestore usando NotificationService
 */
export const useAlertasCobro = () => {
  const userProfile = useAuthStore(state => state.userProfile);

  const ultimaEjecucion = useRef<number>(0);
  const ejecutando = useRef<boolean>(false);

  useEffect(() => {
    const rolesHabilitados = ['admin', 'gerente', 'finanzas'];
    if (!userProfile?.role || !rolesHabilitados.includes(userProfile.role)) return;

    // Guard: maximo una ejecucion cada 60 minutos
    const ahora = Date.now();
    const UNA_HORA_MS = 60 * 60 * 1000;
    if (ahora - ultimaEjecucion.current < UNA_HORA_MS) return;

    // Evitar ejecuciones concurrentes
    if (ejecutando.current) return;

    ejecutando.current = true;
    ultimaEjecucion.current = ahora;

    const evaluar = async () => {
      try {
        const tc = await tipoCambioService.resolverTCVenta();
        const pendientes = await cuentasPendientesService.getVentasPorCobrar(tc);

        let creadas = 0;
        let omitidas = 0;

        for (const pendiente of pendientes) {
          const nivel = nivelAlerta(pendiente.diasPendiente);
          if (!nivel) continue; // <=7 dias: no generar alerta

          const intervalo = INTERVALO_DIAS[nivel];
          const entidadId = pendiente.documentoId;

          // Verificar si ya existe una notificacion reciente para esta venta
          const yaExiste = await NotificationService.buscarExistente(
            'cobro_vencido',
            entidadId,
            intervalo
          );

          if (yaExiste) {
            omitidas++;
            continue;
          }

          const montoPEN = (pendiente.montoEquivalentePEN ?? pendiente.montoPendiente).toFixed(2);
          const titulo = `[${etiquetaNivel(nivel)}] Cobro vencido — ${pendiente.numeroDocumento}`;
          const mensaje = `${pendiente.contraparteNombre} — S/ ${montoPEN} pendiente hace ${pendiente.diasPendiente} días`;

          await NotificationService.crear({
            tipo: 'cobro_vencido',
            titulo,
            mensaje,
            prioridad: prioridadPorNivel(nivel),
            entidadTipo: 'venta',
            entidadId,
            ventaId: entidadId,
            metadata: {
              nivel,
              diasPendiente: pendiente.diasPendiente,
              montoPendiente: pendiente.montoPendiente,
              moneda: pendiente.moneda,
              montoPEN: parseFloat(montoPEN),
              canal: pendiente.canal ?? null
            },
            creadoPor: 'sistema'
          });

          creadas++;
        }

        logger.info(
          `[useAlertasCobro] Evaluacion completada — ${creadas} alertas creadas, ${omitidas} omitidas por duplicado`
        );
      } catch (error) {
        logger.error('[useAlertasCobro] Error al evaluar cobros vencidos:', error);
      } finally {
        ejecutando.current = false;
      }
    };

    evaluar();
  }, [userProfile?.role]);
};
