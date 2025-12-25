import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, XCircle, Calendar, Package } from 'lucide-react';
import { Card, Badge } from '../../common';
import { useInventarioStore } from '../../../store/inventarioStore';
import { useProductoStore } from '../../../store/productoStore';

interface VencimientosWidgetProps {
  maxItems?: number;
}

interface UnidadPorVencer {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  almacenNombre: string;
  cantidad: number;
  diasRestantes: number;
  fechaVencimiento: Date;
  estado: 'vencido' | 'critico' | 'proximo' | 'normal';
}

export const VencimientosWidget: React.FC<VencimientosWidgetProps> = ({
  maxItems = 8
}) => {
  const { inventario } = useInventarioStore();
  const { productos } = useProductoStore();

  const unidadesPorVencer = useMemo(() => {
    const resultado: UnidadPorVencer[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const inv of inventario || []) {
      const producto = productos?.find(p => p.id === inv.productoId);
      if (!producto) continue;

      // Revisar cada unidad en el inventario
      // El inventario agregado tiene campos de vencimiento
      if (inv.vencidas > 0) {
        resultado.push({
          productoId: inv.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          almacenNombre: inv.almacenNombre,
          cantidad: inv.vencidas,
          diasRestantes: -1,
          fechaVencimiento: new Date(),
          estado: 'vencido'
        });
      }

      if (inv.proximasAVencer30Dias > 0) {
        // Aproximar fecha de vencimiento dentro de los próximos 30 días
        const fechaAprox = new Date(hoy);
        fechaAprox.setDate(fechaAprox.getDate() + 15); // Promedio

        const diasRestantes = Math.ceil((fechaAprox.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        resultado.push({
          productoId: inv.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          almacenNombre: inv.almacenNombre,
          cantidad: inv.proximasAVencer30Dias,
          diasRestantes,
          fechaVencimiento: fechaAprox,
          estado: diasRestantes <= 7 ? 'critico' : 'proximo'
        });
      }
    }

    // Ordenar por urgencia
    return resultado.sort((a, b) => {
      const ordenEstado = { vencido: 0, critico: 1, proximo: 2, normal: 3 };
      return ordenEstado[a.estado] - ordenEstado[b.estado];
    });
  }, [inventario, productos]);

  const estadisticas = useMemo(() => {
    return {
      vencidos: unidadesPorVencer.filter(u => u.estado === 'vencido').reduce((sum, u) => sum + u.cantidad, 0),
      criticos: unidadesPorVencer.filter(u => u.estado === 'critico').reduce((sum, u) => sum + u.cantidad, 0),
      proximos: unidadesPorVencer.filter(u => u.estado === 'proximo').reduce((sum, u) => sum + u.cantidad, 0)
    };
  }, [unidadesPorVencer]);

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'vencido':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'critico':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'proximo':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-500" />;
    }
  };

  const getEstadoBg = (estado: string) => {
    switch (estado) {
      case 'vencido':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'critico':
        return 'bg-orange-50 border-l-4 border-orange-500';
      case 'proximo':
        return 'bg-yellow-50 border-l-4 border-yellow-500';
      default:
        return 'bg-gray-50';
    }
  };

  const getEstadoBadge = (estado: string, diasRestantes: number) => {
    switch (estado) {
      case 'vencido':
        return <Badge variant="danger">Vencido</Badge>;
      case 'critico':
        return <Badge variant="warning">{diasRestantes}d</Badge>;
      case 'proximo':
        return <Badge variant="info">{diasRestantes}d</Badge>;
      default:
        return <Badge variant="default">{diasRestantes}d</Badge>;
    }
  };

  const hayAlertas = estadisticas.vencidos > 0 || estadisticas.criticos > 0 || estadisticas.proximos > 0;

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-warning-500" />
          Control de Vencimientos
        </h3>
        <Link to="/inventario" className="text-sm text-primary-600 hover:text-primary-700">
          Ver inventario →
        </Link>
      </div>

      {/* Resumen de vencimientos */}
      {hayAlertas && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className={`p-2 rounded-lg text-center ${estadisticas.vencidos > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
            <div className={`text-xl font-bold ${estadisticas.vencidos > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {estadisticas.vencidos}
            </div>
            <div className="text-xs text-gray-500">Vencidos</div>
          </div>
          <div className={`p-2 rounded-lg text-center ${estadisticas.criticos > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}>
            <div className={`text-xl font-bold ${estadisticas.criticos > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {estadisticas.criticos}
            </div>
            <div className="text-xs text-gray-500">&lt;7 días</div>
          </div>
          <div className={`p-2 rounded-lg text-center ${estadisticas.proximos > 0 ? 'bg-yellow-100' : 'bg-gray-50'}`}>
            <div className={`text-xl font-bold ${estadisticas.proximos > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
              {estadisticas.proximos}
            </div>
            <div className="text-xs text-gray-500">&lt;30 días</div>
          </div>
        </div>
      )}

      {unidadesPorVencer.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay productos próximos a vencer</p>
          <p className="text-xs text-success-600 mt-1">Inventario en buen estado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {unidadesPorVencer.slice(0, maxItems).map((item, index) => (
            <Link
              key={`${item.productoId}-${item.almacenNombre}-${index}`}
              to={`/inventario?producto=${item.productoId}`}
              className="block"
            >
              <div className={`flex items-center justify-between p-3 rounded-lg ${getEstadoBg(item.estado)} hover:opacity-80 transition-opacity`}>
                <div className="flex items-center gap-3">
                  {getEstadoIcon(item.estado)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {item.marca} {item.nombreComercial}
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.sku} • {item.almacenNombre} • {item.cantidad} uds
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {getEstadoBadge(item.estado, item.diasRestantes)}
                </div>
              </div>
            </Link>
          ))}

          {unidadesPorVencer.length > maxItems && (
            <Link
              to="/inventario"
              className="block text-center text-sm text-primary-600 hover:text-primary-700 py-2"
            >
              Ver {unidadesPorVencer.length - maxItems} más →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
};
