import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useInventarioStore } from '../store/inventarioStore';
import { useProductoStore } from '../store/productoStore';
import { notificacionService } from '../services/notificacion.service';

/**
 * Hook para generar notificaciones automáticas basadas en el estado del inventario
 * Solo se ejecuta para usuarios con rol admin
 * El servicio de notificaciones maneja la prevención de duplicados en Firestore
 */
export const useNotificacionesAuto = () => {
  const { userProfile } = useAuthStore();
  const { inventario } = useInventarioStore();
  const { productos } = useProductoStore();

  // Ref para evitar verificaciones muy frecuentes
  const ultimaVerificacion = useRef<number>(0);
  const verificando = useRef<boolean>(false);

  useEffect(() => {
    // Solo ejecutar para admins
    if (userProfile?.role !== 'admin') return;

    // Evitar verificaciones muy frecuentes (mínimo 10 minutos entre verificaciones)
    const ahora = Date.now();
    if (ahora - ultimaVerificacion.current < 10 * 60 * 1000) return;

    // Evitar ejecuciones concurrentes
    if (verificando.current) return;

    if (!inventario || !productos || inventario.length === 0) return;

    verificando.current = true;
    ultimaVerificacion.current = ahora;

    const verificarYNotificar = async () => {
      try {
        for (const inv of inventario) {
          const producto = productos.find(p => p.id === inv.productoId);
          if (!producto || producto.estado !== 'activo') continue;

          const nombreProducto = `${producto.marca} ${producto.nombreComercial}`;

          // === STOCK CRÍTICO ===
          // Solo notificar si está realmente bajo (menos de la mitad del mínimo o agotado)
          if (producto.stockMinimo && inv.disponibles <= producto.stockMinimo) {
            if (inv.disponibles === 0 || inv.disponibles < producto.stockMinimo * 0.5) {
              // El servicio verifica duplicados automáticamente
              await notificacionService.notificarStockCritico(
                inv.productoId,
                producto.sku,
                nombreProducto,
                inv.disponibles,
                producto.stockMinimo
              );
            }
          }

          // === PRODUCTOS POR VENCER (30 días) ===
          if (inv.proximasAVencer30Dias > 0) {
            // El servicio verifica duplicados automáticamente
            await notificacionService.notificarProductoPorVencer(
              inv.productoId,
              producto.sku,
              nombreProducto,
              inv.proximasAVencer30Dias,
              30
            );
          }
        }
      } catch (error) {
        console.error('Error generando notificaciones automáticas:', error);
      } finally {
        verificando.current = false;
      }
    };

    verificarYNotificar();
  }, [userProfile?.role, inventario, productos]);
};

/**
 * Hook simplificado para usar en el layout principal
 */
export const useNotificacionesAutoInit = () => {
  useNotificacionesAuto();
};
