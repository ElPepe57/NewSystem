import React, { useEffect, useState } from 'react';
import { Package, Truck, MapPin, Eye, Layers } from 'lucide-react';
import { DataTable, StatusBadge, PageHeader } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { Badge } from '../../components/common';
import { envioCrudService } from '../../services/envio.crud.service';
import type { Envio, EstadoEnvio } from '../../types/envio.types';

const estadoConfig: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  borrador: { label: 'Borrador', variant: 'neutral' },
  confirmado: { label: 'Confirmado', variant: 'info' },
  en_transito: { label: 'En Transito', variant: 'warning' },
  recibida_parcial: { label: 'Parcial', variant: 'warning' },
  recibida_completa: { label: 'Recibida', variant: 'success' },
  perdida_total: { label: 'Perdida', variant: 'danger' },
  cancelada: { label: 'Cancelada', variant: 'danger' },
};

export const EnviosProveedorTab: React.FC = () => {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await envioCrudService.getByFiltros({ origenTipo: 'proveedor' });
        setEnvios(data);
      } catch (err) {
        console.error('Error cargando envios T1:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const columns: DataTableColumn<Envio>[] = [
    {
      key: 'numero',
      header: 'Envio',
      render: (env) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{env.numeroEnvio}</div>
          {env.ordenCompraNumero && (
            <div className="text-[10px] text-sky-600 font-medium">{env.ordenCompraNumero}</div>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (env) => {
        const cfg = estadoConfig[env.estado] || estadoConfig.borrador;
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'destino',
      header: 'Destino',
      render: (env) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <MapPin className="w-3 h-3" />
          {env.destinoCasillaNombre || env.destinoCasillaId}
        </div>
      ),
    },
    {
      key: 'unidades',
      header: 'Unidades',
      align: 'center',
      render: (env) => (
        <span className="text-sm font-medium">{env.totalUnidades}</span>
      ),
    },
    {
      key: 'tracking',
      header: 'Tracking',
      hideOnMobile: true,
      render: (env) => env.numeroTracking ? (
        <div className="text-xs">
          <span className="text-slate-700">{env.numeroTracking}</span>
          {env.courier && <span className="text-slate-400 ml-1">({env.courier})</span>}
        </div>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      hideOnMobile: true,
      render: (env) => {
        try {
          const d = env.fechaCreacion.toDate();
          return <span className="text-xs text-slate-500">{d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
        } catch {
          return <span className="text-xs text-slate-300">—</span>;
        }
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-teal-500 rounded-full mr-2" />
        Cargando envios...
      </div>
    );
  }

  if (envios.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No hay envios de proveedor registrados</p>
        <p className="text-xs text-slate-400 mt-1">Se crean automaticamente al confirmar una OC</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{envios.length} envio(s) de proveedor</p>
      </div>
      <DataTable<Envio>
        columns={columns}
        data={envios}
        keyExtractor={(env) => env.id}
        loading={loading}
      />
    </div>
  );
};
