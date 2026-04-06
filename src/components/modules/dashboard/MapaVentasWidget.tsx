import { useEffect, useState } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COLLECTIONS } from '../../../config/collections';
import { useLineaFilter } from '../../../hooks/useLineaFilter';

interface GeoStats {
  distritosActivos: number;
  provinciasActivas: number;
  ventasGeo: number;
  ventasTotal: number;
}

export function MapaVentasWidget() {
  const [stats, setStats] = useState<GeoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, COLLECTIONS.VENTAS),
          where('fechaCreacion', '>=', Timestamp.fromDate(inicioMes))
        );
        const snap = await getDocs(q);

        const distritos = new Set<string>();
        const provincias = new Set<string>();
        let ventasGeo = 0;

        snap.docs.forEach(d => {
          const data = d.data();
          if (data.estado === 'cancelada') return;
          if (data.coordenadas?.lat) {
            ventasGeo++;
            if (data.distrito) distritos.add(data.distrito);
            if (data.provincia) provincias.add(data.provincia);
          }
        });

        setStats({
          distritosActivos: distritos.size,
          provinciasActivas: provincias.size,
          ventasGeo,
          ventasTotal: snap.size
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  return (
    <Link
      to="/mapa-ventas"
      className="block bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <MapPin className="h-4 w-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-800 text-sm">Mapa de Ventas</h3>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-400" />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-blue-100 rounded w-2/3" />
          <div className="h-4 bg-blue-100 rounded w-1/2" />
        </div>
      ) : stats && stats.ventasGeo > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xl font-bold text-blue-700">{stats.distritosActivos}</p>
            <p className="text-[10px] text-gray-500">distritos activos</p>
          </div>
          <div>
            <p className="text-xl font-bold text-indigo-700">{stats.provinciasActivas}</p>
            <p className="text-[10px] text-gray-500">provincias</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500">
              {stats.ventasGeo} ventas geolocalizadas este mes
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Las ventas con dirección aparecerán en el mapa automáticamente
        </p>
      )}
    </Link>
  );
}
