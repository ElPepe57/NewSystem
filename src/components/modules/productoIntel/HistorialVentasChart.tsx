import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Calendar, TrendingUp, Package, DollarSign } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Venta } from '../../../types/venta.types';

interface HistorialVentasChartProps {
  productoId: string;
  nombreProducto: string;
  periodoMeses?: number;
}

interface DatoSemanal {
  semana: string;
  semanaNum: number;
  unidades: number;
  ventasPEN: number;
  cantidadVentas: number;
}

interface DatoMensual {
  mes: string;
  mesNum: number;
  unidades: number;
  ventasPEN: number;
  cantidadVentas: number;
  margenPromedio: number;
}

export const HistorialVentasChart: React.FC<HistorialVentasChartProps> = ({
  productoId,
  nombreProducto,
  periodoMeses = 6
}) => {
  const [loading, setLoading] = useState(true);
  const [datosMensuales, setDatosMensuales] = useState<DatoMensual[]>([]);
  const [datosSemanales, setDatosSemanales] = useState<DatoSemanal[]>([]);
  const [vista, setVista] = useState<'mensual' | 'semanal'>('mensual');
  const [metrica, setMetrica] = useState<'unidades' | 'ventasPEN'>('unidades');

  useEffect(() => {
    cargarHistorial();
  }, [productoId, periodoMeses]);

  const cargarHistorial = async () => {
    setLoading(true);
    try {
      // Obtener ventas del periodo
      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - periodoMeses);

      const ventasRef = collection(db, 'ventas');
      const q = query(
        ventasRef,
        where('fechaCreacion', '>=', Timestamp.fromDate(fechaInicio)),
        orderBy('fechaCreacion', 'asc')
      );

      let ventas: Venta[] = [];
      try {
        const snapshot = await getDocs(q);
        ventas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venta));
      } catch {
        // Fallback sin indice
        const allSnapshot = await getDocs(ventasRef);
        ventas = allSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Venta))
          .filter(v => {
            const fecha = v.fechaCreacion?.toDate?.() || new Date(0);
            return fecha >= fechaInicio;
          });
      }

      // Filtrar ventas que contienen este producto y estan confirmadas
      const estadosValidos = ['confirmada', 'asignada', 'en_entrega', 'entrega_parcial', 'entregada'];
      const ventasProducto = ventas.filter(v =>
        estadosValidos.includes(v.estado) &&
        v.productos?.some(p => p.productoId === productoId)
      );

      // Agrupar por mes
      const porMes = new Map<string, DatoMensual>();
      const porSemana = new Map<string, DatoSemanal>();

      for (const venta of ventasProducto) {
        const fecha = venta.fechaCreacion?.toDate?.() || new Date();
        const producto = venta.productos?.find(p => p.productoId === productoId);
        if (!producto) continue;

        // Clave mensual
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const mesLabel = fecha.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });

        if (!porMes.has(mesKey)) {
          porMes.set(mesKey, {
            mes: mesLabel,
            mesNum: fecha.getMonth() + 1,
            unidades: 0,
            ventasPEN: 0,
            cantidadVentas: 0,
            margenPromedio: 0
          });
        }
        const datoMes = porMes.get(mesKey)!;
        datoMes.unidades += producto.cantidad;
        datoMes.ventasPEN += producto.subtotal;
        datoMes.cantidadVentas += 1;
        if (producto.margenReal) {
          datoMes.margenPromedio = (datoMes.margenPromedio * (datoMes.cantidadVentas - 1) + producto.margenReal) / datoMes.cantidadVentas;
        }

        // Clave semanal (ultimas 12 semanas)
        const inicioSemana = new Date(fecha);
        inicioSemana.setDate(fecha.getDate() - fecha.getDay());
        const semanaKey = `${inicioSemana.getFullYear()}-W${getWeekNumber(inicioSemana)}`;
        const semanaLabel = `${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1}`;

        if (!porSemana.has(semanaKey)) {
          porSemana.set(semanaKey, {
            semana: semanaLabel,
            semanaNum: getWeekNumber(inicioSemana),
            unidades: 0,
            ventasPEN: 0,
            cantidadVentas: 0
          });
        }
        const datoSemana = porSemana.get(semanaKey)!;
        datoSemana.unidades += producto.cantidad;
        datoSemana.ventasPEN += producto.subtotal;
        datoSemana.cantidadVentas += 1;
      }

      // Convertir a arrays ordenados
      const mesesOrdenados = Array.from(porMes.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, datos]) => datos);

      const semanasOrdenadas = Array.from(porSemana.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12) // Ultimas 12 semanas
        .map(([_, datos]) => datos);

      setDatosMensuales(mesesOrdenados);
      setDatosSemanales(semanasOrdenadas);
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoading(false);
    }
  };

  // Obtener numero de semana del año
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Calcular estadisticas
  const totalUnidades = datosMensuales.reduce((sum, d) => sum + d.unidades, 0);
  const totalVentas = datosMensuales.reduce((sum, d) => sum + d.ventasPEN, 0);
  const promedioMensual = datosMensuales.length > 0 ? totalUnidades / datosMensuales.length : 0;
  const tendencia = datosMensuales.length >= 2
    ? ((datosMensuales[datosMensuales.length - 1]?.unidades || 0) - (datosMensuales[0]?.unidades || 0))
    : 0;

  const datos = vista === 'mensual' ? datosMensuales : datosSemanales;
  const xKey = vista === 'mensual' ? 'mes' : 'semana';

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Historial de Ventas</h3>
            <p className="text-xs text-gray-500">{nombreProducto}</p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2">
          {/* Vista */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setVista('mensual')}
              className={`px-2 py-1 text-xs rounded ${vista === 'mensual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              Mensual
            </button>
            <button
              onClick={() => setVista('semanal')}
              className={`px-2 py-1 text-xs rounded ${vista === 'semanal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              Semanal
            </button>
          </div>

          {/* Metrica */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setMetrica('unidades')}
              className={`px-2 py-1 text-xs rounded ${metrica === 'unidades' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              <Package className="h-3 w-3 inline mr-1" />
              Uds
            </button>
            <button
              onClick={() => setMetrica('ventasPEN')}
              className={`px-2 py-1 text-xs rounded ${metrica === 'ventasPEN' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              <DollarSign className="h-3 w-3 inline mr-1" />
              S/
            </button>
          </div>
        </div>
      </div>

      {/* KPIs rapidos */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">Total {periodoMeses}m</p>
          <p className="font-bold text-gray-900">{totalUnidades} uds</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">Ventas</p>
          <p className="font-bold text-gray-900">S/{totalVentas.toFixed(0)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">Prom/mes</p>
          <p className="font-bold text-gray-900">{promedioMensual.toFixed(1)} uds</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-500">Tendencia</p>
          <p className={`font-bold ${tendencia > 0 ? 'text-green-600' : tendencia < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {tendencia > 0 ? '+' : ''}{tendencia} uds
          </p>
        </div>
      </div>

      {/* Grafico */}
      {datos.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">Sin datos de ventas en este periodo</p>
          </div>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => metrica === 'ventasPEN' ? `S/${value}` : value}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [
                  metrica === 'ventasPEN' ? `S/${value.toFixed(0)}` : `${value} unidades`,
                  metrica === 'ventasPEN' ? 'Ventas' : 'Unidades'
                ]}
              />
              <Bar
                dataKey={metrica}
                fill={metrica === 'unidades' ? '#6366f1' : '#10b981'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Mostrando {vista === 'mensual' ? `ultimos ${periodoMeses} meses` : 'ultimas 12 semanas'}
          {' • '}
          {datos.reduce((sum, d) => sum + d.cantidadVentas, 0)} ventas totales
        </p>
      </div>
    </div>
  );
};
