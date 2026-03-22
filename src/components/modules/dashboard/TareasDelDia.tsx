/**
 * Widget "Tareas del Día"
 * Muestra los pendientes operativos más urgentes del día en el Dashboard.
 * Los datos se calculan a partir de los stores ya cargados — sin queries adicionales.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  DollarSign,
  Truck,
  FileText,
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { Card, Badge } from '../../common';
import { useVentaStore } from '../../../store/ventaStore';
import { useOrdenCompraStore } from '../../../store/ordenCompraStore';
import { useCotizacionStore } from '../../../store/cotizacionStore';
import { useRequerimientoStore } from '../../../store/requerimientoStore';
import { useTransferenciaStore } from '../../../store/transferenciaStore';
import { useAuthStore } from '../../../store/authStore';
import { calcularTareasDia } from '../../../services/tareasDia.service';
import { formatCurrency } from '../../../utils/format';
import type { TareaDia, PrioridadTarea, CategoriaTarea } from '../../../types/tareasDia.types';
import type { UserRole } from '../../../types/auth.types';

const MAX_VISIBLE = 5;

// ============================================================
// HELPERS VISUALES
// ============================================================

function getIconoCategoria(categoria: CategoriaTarea): React.ReactNode {
  const cls = 'h-4 w-4 flex-shrink-0';
  switch (categoria) {
    case 'entrega_pendiente':
      return <Package className={cls} />;
    case 'cobro_vencido':
      return <DollarSign className={cls} />;
    case 'oc_por_recibir':
      return <Truck className={cls} />;
    case 'cotizacion_por_vencer':
      return <FileText className={cls} />;
    case 'requerimiento_urgente':
      return <AlertTriangle className={cls} />;
    case 'transferencia_por_recibir':
      return <ArrowRightLeft className={cls} />;
  }
}

function getColorPrioridad(prioridad: PrioridadTarea): {
  borde: string;
  fondo: string;
  icono: string;
  badge: 'danger' | 'warning' | 'info' | 'default';
  etiqueta: string;
} {
  switch (prioridad) {
    case 'critica':
      return {
        borde: 'border-l-4 border-red-500',
        fondo: 'bg-red-50 hover:bg-red-100',
        icono: 'text-red-500',
        badge: 'danger',
        etiqueta: 'Critica',
      };
    case 'alta':
      return {
        borde: 'border-l-4 border-orange-500',
        fondo: 'bg-orange-50 hover:bg-orange-100',
        icono: 'text-orange-500',
        badge: 'warning',
        etiqueta: 'Alta',
      };
    case 'media':
      return {
        borde: 'border-l-4 border-blue-400',
        fondo: 'bg-blue-50 hover:bg-blue-100',
        icono: 'text-blue-500',
        badge: 'info',
        etiqueta: 'Media',
      };
    case 'baja':
    default:
      return {
        borde: 'border-l-4 border-gray-300',
        fondo: 'bg-gray-50 hover:bg-gray-100',
        icono: 'text-gray-400',
        badge: 'default',
        etiqueta: 'Baja',
      };
  }
}

// ============================================================
// SUB-COMPONENTE: Fila de tarea
// ============================================================

interface TareaRowProps {
  tarea: TareaDia;
  onNavegar: (ruta: string) => void;
}

const TareaRow: React.FC<TareaRowProps> = ({ tarea, onNavegar }) => {
  const colores = getColorPrioridad(tarea.prioridad);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${colores.fondo} ${colores.borde}`}
      onClick={() => onNavegar(tarea.rutaDestino)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onNavegar(tarea.rutaDestino);
      }}
      aria-label={`${tarea.titulo} — prioridad ${tarea.prioridad}. Ir a ${tarea.rutaDestino}`}
    >
      {/* Icono de categoria */}
      <span className={colores.icono}>
        {getIconoCategoria(tarea.categoria)}
      </span>

      {/* Texto principal */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{tarea.titulo}</p>
        <p className="text-xs text-gray-500 truncate">
          {tarea.subtitulo}
          {tarea.monto !== undefined && (
            <span className="ml-1 font-medium text-gray-700">
              {' '}· {formatCurrency(tarea.monto, tarea.moneda === 'USD' ? 'USD' : 'PEN')}
            </span>
          )}
        </p>
      </div>

      {/* Badge de prioridad */}
      <div className="flex-shrink-0">
        <Badge variant={colores.badge}>{colores.etiqueta}</Badge>
      </div>

      {/* Flecha de accion */}
      <span className="text-gray-400 text-xs flex-shrink-0">Ir</span>
    </div>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export const TareasDelDia: React.FC = () => {
  const navigate = useNavigate();
  const [expandido, setExpandido] = useState(true);
  const [mostrarTodo, setMostrarTodo] = useState(false);

  // Datos de los stores ya cargados en el Dashboard
  const ventas = useVentaStore(state => state.ventas);
  const ordenes = useOrdenCompraStore(state => state.ordenes);
  const cotizaciones = useCotizacionStore(state => state.cotizaciones);
  const fetchCotizaciones = useCotizacionStore(state => state.fetchCotizaciones);
  const requerimientos = useRequerimientoStore(state => state.requerimientos);
  const fetchRequerimientos = useRequerimientoStore(state => state.fetchRequerimientos);
  const transferencias = useTransferenciaStore(state => state.transferencias);
  const fetchTransferencias = useTransferenciaStore(state => state.fetchTransferencias);
  const userProfile = useAuthStore(state => state.userProfile);

  // Carga lazy de stores que el Dashboard no inicializa por defecto.
  // Solo dispara si el store está vacío para no duplicar queries.
  useEffect(() => {
    if (cotizaciones.length === 0) {
      fetchCotizaciones().catch(() => undefined);
    }
    if (requerimientos.length === 0) {
      fetchRequerimientos().catch(() => undefined);
    }
    if (transferencias.length === 0) {
      fetchTransferencias().catch(() => undefined);
    }
    // Se ejecuta una sola vez al montar el widget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rol: UserRole = (userProfile?.role ?? 'invitado') as UserRole;

  const resultado = useMemo(
    () =>
      calcularTareasDia({
        ventas,
        ordenes,
        cotizaciones,
        requerimientos,
        transferencias,
        rol,
      }),
    [ventas, ordenes, cotizaciones, requerimientos, transferencias, rol],
  );

  const { tareas, resumen } = resultado;
  const tareasVisibles = mostrarTodo ? tareas : tareas.slice(0, MAX_VISIBLE);
  const hayMas = tareas.length > MAX_VISIBLE;

  function handleNavegar(ruta: string) {
    navigate(ruta);
  }

  return (
    <Card padding="md">
      {/* Header del widget */}
      <div className="flex items-center justify-between mb-3">
        <button
          className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          onClick={() => setExpandido(prev => !prev)}
          aria-expanded={expandido}
          aria-controls="tareas-dia-contenido"
        >
          <ClipboardList className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <h3 className="text-base font-semibold text-gray-900">
            Tareas del Dia
          </h3>
          {expandido ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {/* Contadores de prioridad */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {resumen.criticas > 0 && (
            <Badge variant="danger">{resumen.criticas} critica{resumen.criticas > 1 ? 's' : ''}</Badge>
          )}
          {resumen.altas > 0 && (
            <Badge variant="warning">{resumen.altas} alta{resumen.altas > 1 ? 's' : ''}</Badge>
          )}
          {resumen.total > 0 && resumen.criticas === 0 && resumen.altas === 0 && (
            <Badge variant="info">{resumen.total} pendiente{resumen.total > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>

      {/* Contenido colapsable */}
      {expandido && (
        <div id="tareas-dia-contenido">
          {tareas.length === 0 ? (
            /* Estado vacio */
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle2 className="h-10 w-10 mb-2 text-green-300" />
              <p className="text-sm font-medium text-gray-500">Todo al dia</p>
              <p className="text-xs text-gray-400 mt-1">No hay tareas urgentes pendientes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tareasVisibles.map(tarea => (
                <TareaRow
                  key={tarea.id}
                  tarea={tarea}
                  onNavegar={handleNavegar}
                />
              ))}

              {/* Ver mas / Ver menos */}
              {hayMas && (
                <button
                  className="w-full text-center text-sm text-primary-600 hover:text-primary-700 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                  onClick={() => setMostrarTodo(prev => !prev)}
                >
                  {mostrarTodo
                    ? 'Ver menos'
                    : `Ver ${tareas.length - MAX_VISIBLE} tarea${tareas.length - MAX_VISIBLE > 1 ? 's' : ''} mas`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
