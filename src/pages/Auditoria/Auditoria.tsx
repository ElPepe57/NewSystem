import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Package,
  ShoppingCart,
  Warehouse,
  Users,
  Settings,
  FileText,
  DollarSign,
  Truck
} from 'lucide-react';
import { Card, Badge, Button } from '../../components/common';
import { auditoriaService } from '../../services/auditoria.service';
import type { AuditLog, AuditLogFiltros, AuditLogStats, ModuloAuditoria, NivelAuditoria } from '../../types/auditoria.types';

export const Auditoria: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModulo, setFilterModulo] = useState<ModuloAuditoria | ''>('');
  const [filterNivel, setFilterNivel] = useState<NivelAuditoria | ''>('');
  const [filterFecha, setFilterFecha] = useState<'hoy' | 'semana' | 'mes' | 'todo'>('semana');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        auditoriaService.getLogs({}, 100),
        auditoriaService.getStats()
      ]);
      setLogs(logsResult.logs);
      setStats(statsResult);
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filtro por búsqueda (con validación segura)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => {
        const descripcion = (log.descripcion ?? '').toLowerCase();
        const usuarioNombre = (log.usuarioNombre ?? '').toLowerCase();
        const usuarioEmail = (log.usuarioEmail ?? '').toLowerCase();
        const entidadNombre = (log.entidadNombre ?? '').toLowerCase();
        return descripcion.includes(term) ||
               usuarioNombre.includes(term) ||
               usuarioEmail.includes(term) ||
               entidadNombre.includes(term);
      });
    }

    // Filtro por módulo
    if (filterModulo) {
      result = result.filter(log => log.modulo === filterModulo);
    }

    // Filtro por nivel
    if (filterNivel) {
      result = result.filter(log => log.nivel === filterNivel);
    }

    // Filtro por fecha
    const ahora = new Date();
    if (filterFecha !== 'todo') {
      let fechaLimite: Date;
      switch (filterFecha) {
        case 'hoy':
          fechaLimite = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
          break;
        case 'semana':
          fechaLimite = new Date(ahora);
          fechaLimite.setDate(ahora.getDate() - 7);
          break;
        case 'mes':
          fechaLimite = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
          break;
        default:
          fechaLimite = new Date(0);
      }
      result = result.filter(log => log.fechaCreacion.toDate() >= fechaLimite);
    }

    return result;
  }, [logs, searchTerm, filterModulo, filterNivel, filterFecha]);

  const getModuloIcon = (modulo: ModuloAuditoria) => {
    switch (modulo) {
      case 'productos': return <Package className="h-4 w-4" />;
      case 'inventario': return <Warehouse className="h-4 w-4" />;
      case 'ventas': return <ShoppingCart className="h-4 w-4" />;
      case 'usuarios': return <Users className="h-4 w-4" />;
      case 'configuracion': return <Settings className="h-4 w-4" />;
      case 'reportes': return <FileText className="h-4 w-4" />;
      case 'gastos': return <DollarSign className="h-4 w-4" />;
      case 'transferencias': return <Truck className="h-4 w-4" />;
      case 'auth': return <User className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getNivelIcon = (nivel: NivelAuditoria) => {
    switch (nivel) {
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-700" />;
      default: return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getNivelBadge = (nivel: NivelAuditoria) => {
    switch (nivel) {
      case 'info': return <Badge variant="info">Info</Badge>;
      case 'warning': return <Badge variant="warning">Warning</Badge>;
      case 'error': return <Badge variant="danger">Error</Badge>;
      case 'critical': return <Badge variant="danger">Crítico</Badge>;
      default: return <Badge variant="default">{nivel}</Badge>;
    }
  };

  const formatFecha = (timestamp: any) => {
    if (!timestamp?.toDate) return '-';
    const fecha = timestamp.toDate();
    return fecha.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFechaRelativa = (timestamp: any) => {
    if (!timestamp?.toDate) return '-';
    const fecha = timestamp.toDate();
    const ahora = new Date();
    const diffMs = ahora.getTime() - fecha.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return fecha.toLocaleDateString('es-PE');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterModulo('');
    setFilterNivel('');
    setFilterFecha('semana');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary-600" />
            Auditoría del Sistema
          </h1>
          <p className="text-gray-600 mt-1">
            Registro de actividades y cambios en el sistema
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalHoy}</div>
              <div className="text-xs text-gray-500">Hoy</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalSemana}</div>
              <div className="text-xs text-gray-500">Esta semana</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalMes}</div>
              <div className="text-xs text-gray-500">Este mes</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
              <div className="text-xs text-gray-500">Warnings</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.errores}</div>
              <div className="text-xs text-gray-500">Errores</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{stats.porUsuario.length}</div>
              <div className="text-xs text-gray-500">Usuarios activos</div>
            </div>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-4">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descripción, usuario, entidad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Filtro módulo */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={filterModulo}
              onChange={(e) => setFilterModulo(e.target.value as ModuloAuditoria | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos los módulos</option>
              <option value="auth">Autenticación</option>
              <option value="usuarios">Usuarios</option>
              <option value="productos">Productos</option>
              <option value="inventario">Inventario</option>
              <option value="ventas">Ventas</option>
              <option value="ordenes_compra">Órdenes</option>
              <option value="transferencias">Transferencias</option>
              <option value="gastos">Gastos</option>
              <option value="configuracion">Configuración</option>
            </select>
          </div>

          {/* Filtro nivel */}
          <select
            value={filterNivel}
            onChange={(e) => setFilterNivel(e.target.value as NivelAuditoria | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los niveles</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Crítico</option>
          </select>

          {/* Filtro fecha */}
          <select
            value={filterFecha}
            onChange={(e) => setFilterFecha(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="hoy">Hoy</option>
            <option value="semana">Última semana</option>
            <option value="mes">Este mes</option>
            <option value="todo">Todo</option>
          </select>

          {/* Limpiar filtros */}
          {(searchTerm || filterModulo || filterNivel || filterFecha !== 'semana') && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>

        <div className="mt-3 text-sm text-gray-500">
          {filteredLogs.length} registros encontrados
        </div>
      </Card>

      {/* Lista de logs */}
      <Card padding="none">
        <div className="divide-y divide-gray-100">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No hay registros de actividad</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="flex items-start gap-4 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  {/* Icono de expansión */}
                  <div className="mt-1">
                    {expandedLog === log.id ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>

                  {/* Icono de nivel */}
                  <div className="mt-1">
                    {getNivelIcon(log.nivel)}
                  </div>

                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {log.descripcion}
                      </span>
                      {getNivelBadge(log.nivel)}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.usuarioNombre}
                      </span>
                      <span className="flex items-center gap-1">
                        {getModuloIcon(log.modulo)}
                        {log.modulo}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatFechaRelativa(log.fechaCreacion)}
                      </span>
                    </div>
                  </div>

                  {/* Rol del usuario */}
                  <Badge variant="default" className="flex-shrink-0">
                    {log.usuarioRol}
                  </Badge>
                </div>

                {/* Detalles expandidos */}
                {expandedLog === log.id && (
                  <div className="mt-4 ml-12 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Fecha completa:</span>
                        <span className="ml-2 text-gray-900">{formatFecha(log.fechaCreacion)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Acción:</span>
                        <span className="ml-2 text-gray-900">{log.accion}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Usuario:</span>
                        <span className="ml-2 text-gray-900">{log.usuarioEmail}</span>
                      </div>
                      {log.entidadNombre && (
                        <div>
                          <span className="text-gray-500">Entidad:</span>
                          <span className="ml-2 text-gray-900">{log.entidadTipo}: {log.entidadNombre}</span>
                        </div>
                      )}
                    </div>

                    {/* Cambios detectados */}
                    {log.cambios && log.cambios.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">Cambios realizados:</div>
                        <div className="space-y-1">
                          {log.cambios.map((cambio, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <span className="font-medium text-gray-600">{cambio.campo}:</span>
                              <span className="text-red-500 line-through">{String(cambio.valorAnterior)}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600">{String(cambio.valorNuevo)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">Información adicional:</div>
                        <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
