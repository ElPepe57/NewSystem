import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  AuditLog,
  AuditLogCreate,
  AuditLogFiltros,
  AuditLogStats,
  CambioDetectado,
  ModuloAuditoria
} from '../types/auditoria.types';
import { useAuthStore } from '../store/authStore';

const COLLECTION_NAME = 'audit_logs';

class AuditoriaService {
  private collectionRef = collection(db, COLLECTION_NAME);

  /**
   * Registrar una acción en el log de auditoría
   */
  async registrar(data: AuditLogCreate): Promise<AuditLog | null> {
    try {
      const { userProfile } = useAuthStore.getState();

      if (!userProfile) {
        console.warn('No hay usuario autenticado para registrar auditoría');
        return null;
      }

      // Detectar cambios si hay datos anteriores y nuevos
      let cambios: CambioDetectado[] | undefined;
      if (data.datosAnteriores && data.datosNuevos) {
        cambios = this.detectarCambios(data.datosAnteriores, data.datosNuevos);
      }

      // Construir objeto base (campos requeridos)
      const auditLog: Record<string, any> = {
        usuarioId: userProfile.uid,
        usuarioEmail: userProfile.email,
        usuarioNombre: userProfile.displayName,
        usuarioRol: userProfile.role,
        accion: data.accion,
        modulo: data.modulo,
        nivel: data.nivel || 'info',
        descripcion: data.descripcion,
        fechaCreacion: Timestamp.now()
      };

      // Agregar campos opcionales solo si tienen valor (Firestore no acepta undefined)
      if (data.entidadTipo) auditLog.entidadTipo = data.entidadTipo;
      if (data.entidadId) auditLog.entidadId = data.entidadId;
      if (data.entidadNombre) auditLog.entidadNombre = data.entidadNombre;
      if (data.datosAnteriores) auditLog.datosAnteriores = data.datosAnteriores;
      if (data.datosNuevos) auditLog.datosNuevos = data.datosNuevos;
      if (cambios && cambios.length > 0) auditLog.cambios = cambios;
      if (data.metadata) auditLog.metadata = data.metadata;

      const docRef = await addDoc(this.collectionRef, auditLog);

      return {
        id: docRef.id,
        ...auditLog
      } as AuditLog;
    } catch (error: any) {
      console.error('Error al registrar auditoría:', error);
      return null;
    }
  }

  /**
   * Detectar cambios entre dos objetos
   */
  private detectarCambios(anterior: Record<string, any>, nuevo: Record<string, any>): CambioDetectado[] {
    const cambios: CambioDetectado[] = [];
    const todasLasKeys = new Set([...Object.keys(anterior), ...Object.keys(nuevo)]);

    for (const key of todasLasKeys) {
      // Ignorar campos de auditoría internos
      if (['fechaActualizacion', 'actualizadoPor', 'id'].includes(key)) continue;

      const valorAnterior = anterior[key];
      const valorNuevo = nuevo[key];

      // Comparar valores (simplificado)
      if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
        cambios.push({
          campo: key,
          valorAnterior: this.simplificarValor(valorAnterior),
          valorNuevo: this.simplificarValor(valorNuevo)
        });
      }
    }

    return cambios;
  }

  /**
   * Simplificar valores para almacenamiento
   */
  private simplificarValor(valor: any): any {
    if (valor === undefined) return null;
    if (valor === null) return null;
    if (valor instanceof Timestamp) return valor.toDate().toISOString();
    if (typeof valor === 'object' && valor.toDate) return valor.toDate().toISOString();
    if (Array.isArray(valor)) return `[${valor.length} elementos]`;
    if (typeof valor === 'object') return '[objeto]';
    return valor;
  }

  /**
   * Obtener logs con filtros y paginación
   */
  async getLogs(
    filtros: AuditLogFiltros = {},
    limite: number = 50,
    ultimoDoc?: DocumentSnapshot
  ): Promise<{ logs: AuditLog[]; ultimoDoc: DocumentSnapshot | null }> {
    try {
      let q = query(this.collectionRef, orderBy('fechaCreacion', 'desc'));

      // Aplicar filtros
      if (filtros.usuarioId) {
        q = query(q, where('usuarioId', '==', filtros.usuarioId));
      }
      if (filtros.modulo) {
        q = query(q, where('modulo', '==', filtros.modulo));
      }
      if (filtros.accion) {
        q = query(q, where('accion', '==', filtros.accion));
      }
      if (filtros.nivel) {
        q = query(q, where('nivel', '==', filtros.nivel));
      }
      if (filtros.entidadId) {
        q = query(q, where('entidadId', '==', filtros.entidadId));
      }

      // Paginación
      if (ultimoDoc) {
        q = query(q, startAfter(ultimoDoc));
      }

      q = query(q, limit(limite));

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));

      // Filtrar por fecha si es necesario (Firestore no permite múltiples orderBy con where en campos diferentes)
      let logsFiltrados = logs;
      if (filtros.fechaDesde) {
        logsFiltrados = logsFiltrados.filter(log =>
          log.fechaCreacion.toDate() >= filtros.fechaDesde!
        );
      }
      if (filtros.fechaHasta) {
        logsFiltrados = logsFiltrados.filter(log =>
          log.fechaCreacion.toDate() <= filtros.fechaHasta!
        );
      }

      const nuevoUltimoDoc = snapshot.docs.length > 0
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;

      return { logs: logsFiltrados, ultimoDoc: nuevoUltimoDoc };
    } catch (error: any) {
      console.error('Error al obtener logs:', error);
      return { logs: [], ultimoDoc: null };
    }
  }

  /**
   * Obtener logs recientes (últimas 24 horas)
   */
  async getLogsRecientes(limite: number = 20): Promise<AuditLog[]> {
    try {
      const hace24h = new Date();
      hace24h.setHours(hace24h.getHours() - 24);

      const q = query(
        this.collectionRef,
        where('fechaCreacion', '>=', Timestamp.fromDate(hace24h)),
        orderBy('fechaCreacion', 'desc'),
        limit(limite)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
    } catch (error: any) {
      console.error('Error al obtener logs recientes:', error);
      return [];
    }
  }

  /**
   * Obtener logs de una entidad específica
   */
  async getLogsPorEntidad(entidadTipo: string, entidadId: string): Promise<AuditLog[]> {
    try {
      const q = query(
        this.collectionRef,
        where('entidadTipo', '==', entidadTipo),
        where('entidadId', '==', entidadId),
        orderBy('fechaCreacion', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
    } catch (error: any) {
      console.error('Error al obtener logs por entidad:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas de auditoría
   */
  async getStats(): Promise<AuditLogStats> {
    try {
      const ahora = new Date();
      const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const inicioSemana = new Date(ahora);
      inicioSemana.setDate(ahora.getDate() - 7);
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

      // Obtener logs del mes para calcular estadísticas
      const q = query(
        this.collectionRef,
        where('fechaCreacion', '>=', Timestamp.fromDate(inicioMes)),
        orderBy('fechaCreacion', 'desc')
      );

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));

      // Calcular estadísticas
      const stats: AuditLogStats = {
        totalHoy: 0,
        totalSemana: 0,
        totalMes: logs.length,
        porModulo: {} as Record<ModuloAuditoria, number>,
        porAccion: {},
        porUsuario: [],
        errores: 0,
        warnings: 0
      };

      const usuariosCont: Record<string, { nombre: string; cantidad: number }> = {};

      for (const log of logs) {
        const fecha = log.fechaCreacion.toDate();

        if (fecha >= inicioHoy) stats.totalHoy++;
        if (fecha >= inicioSemana) stats.totalSemana++;

        // Por módulo
        stats.porModulo[log.modulo] = (stats.porModulo[log.modulo] || 0) + 1;

        // Por acción
        stats.porAccion[log.accion] = (stats.porAccion[log.accion] || 0) + 1;

        // Por usuario
        if (!usuariosCont[log.usuarioId]) {
          usuariosCont[log.usuarioId] = { nombre: log.usuarioNombre, cantidad: 0 };
        }
        usuariosCont[log.usuarioId].cantidad++;

        // Errores y warnings
        if (log.nivel === 'error' || log.nivel === 'critical') stats.errores++;
        if (log.nivel === 'warning') stats.warnings++;
      }

      // Convertir usuarios a array ordenado
      stats.porUsuario = Object.entries(usuariosCont)
        .map(([usuarioId, data]) => ({ usuarioId, ...data }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

      return stats;
    } catch (error: any) {
      console.error('Error al obtener estadísticas:', error);
      return {
        totalHoy: 0,
        totalSemana: 0,
        totalMes: 0,
        porModulo: {} as Record<ModuloAuditoria, number>,
        porAccion: {},
        porUsuario: [],
        errores: 0,
        warnings: 0
      };
    }
  }

  // === MÉTODOS DE CONVENIENCIA PARA ACCIONES COMUNES ===

  async logLogin(exitoso: boolean = true) {
    return this.registrar({
      accion: exitoso ? 'login' : 'login_fallido',
      modulo: 'auth',
      nivel: exitoso ? 'info' : 'warning',
      descripcion: exitoso ? 'Inicio de sesión exitoso' : 'Intento de inicio de sesión fallido'
    });
  }

  async logLogout() {
    return this.registrar({
      accion: 'logout',
      modulo: 'auth',
      nivel: 'info',
      descripcion: 'Cierre de sesión'
    });
  }

  async logCrear(modulo: ModuloAuditoria, entidadTipo: string, entidadId: string, entidadNombre: string, datos?: Record<string, any>) {
    return this.registrar({
      accion: 'crear',
      modulo,
      nivel: 'info',
      descripcion: `Creación de ${entidadTipo}: ${entidadNombre}`,
      entidadTipo,
      entidadId,
      entidadNombre,
      datosNuevos: datos
    });
  }

  async logActualizar(modulo: ModuloAuditoria, entidadTipo: string, entidadId: string, entidadNombre: string, datosAnteriores?: Record<string, any>, datosNuevos?: Record<string, any>) {
    return this.registrar({
      accion: 'actualizar',
      modulo,
      nivel: 'info',
      descripcion: `Actualización de ${entidadTipo}: ${entidadNombre}`,
      entidadTipo,
      entidadId,
      entidadNombre,
      datosAnteriores,
      datosNuevos
    });
  }

  async logEliminar(modulo: ModuloAuditoria, entidadTipo: string, entidadId: string, entidadNombre: string) {
    return this.registrar({
      accion: 'eliminar',
      modulo,
      nivel: 'warning',
      descripcion: `Eliminación de ${entidadTipo}: ${entidadNombre}`,
      entidadTipo,
      entidadId,
      entidadNombre
    });
  }

  async logVenta(ventaId: string, numeroVenta: string, accion: 'registrar_venta' | 'cancelar_venta' | 'entregar_venta', total?: number) {
    const descripciones = {
      registrar_venta: `Nueva venta registrada: ${numeroVenta}${total ? ` por S/ ${total.toFixed(2)}` : ''}`,
      cancelar_venta: `Venta cancelada: ${numeroVenta}`,
      entregar_venta: `Venta entregada: ${numeroVenta}`
    };

    return this.registrar({
      accion,
      modulo: 'ventas',
      nivel: accion === 'cancelar_venta' ? 'warning' : 'info',
      descripcion: descripciones[accion],
      entidadTipo: 'venta',
      entidadId: ventaId,
      entidadNombre: numeroVenta,
      metadata: total ? { total } : undefined
    });
  }

  async logInventario(productoId: string, productoNombre: string, accion: 'ingreso_inventario' | 'salida_inventario' | 'ajuste_inventario', cantidad: number, almacen?: string) {
    return this.registrar({
      accion,
      modulo: 'inventario',
      nivel: 'info',
      descripcion: `${accion === 'ingreso_inventario' ? 'Ingreso' : accion === 'salida_inventario' ? 'Salida' : 'Ajuste'} de ${cantidad} unidades de ${productoNombre}${almacen ? ` en ${almacen}` : ''}`,
      entidadTipo: 'producto',
      entidadId: productoId,
      entidadNombre: productoNombre,
      metadata: { cantidad, almacen }
    });
  }

  async logUsuario(usuarioId: string, usuarioNombre: string, accion: 'crear_usuario' | 'modificar_usuario' | 'cambiar_rol' | 'desactivar_usuario' | 'resetear_password', detalles?: string) {
    return this.registrar({
      accion,
      modulo: 'usuarios',
      nivel: accion === 'desactivar_usuario' ? 'warning' : 'info',
      descripcion: `${this.getDescripcionUsuario(accion)} ${usuarioNombre}${detalles ? `: ${detalles}` : ''}`,
      entidadTipo: 'usuario',
      entidadId: usuarioId,
      entidadNombre: usuarioNombre
    });
  }

  private getDescripcionUsuario(accion: string): string {
    switch (accion) {
      case 'crear_usuario': return 'Usuario creado:';
      case 'modificar_usuario': return 'Usuario modificado:';
      case 'cambiar_rol': return 'Rol cambiado para:';
      case 'desactivar_usuario': return 'Usuario desactivado:';
      case 'resetear_password': return 'Contraseña reseteada para:';
      default: return 'Acción sobre usuario:';
    }
  }
}

export const auditoriaService = new AuditoriaService();
