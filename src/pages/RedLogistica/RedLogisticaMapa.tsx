/**
 * RedLogisticaMapa — visualización geográfica de casillas en el mapa mundial.
 * Primer consumidor real del MapKit.
 *
 * Renderiza markers de todas las casillas que tienen coordenadas, coloreados
 * por país, con tooltip mostrando colaborador y métricas.
 */
import React, { useMemo } from 'react';
import {
  MapProvider,
  MapContainer,
  MarkersLayer,
  MapTooltip,
  MapLegend,
  MAP_CENTERS,
  COUNTRY_COLORS,
  type MapPoint,
} from '../../design-system/maps';
import type { Casilla } from '../../types/casilla.types';
import type { Colaborador } from '../../types/colaborador.types';
import { formatCurrency } from '../../utils/format';

interface RedLogisticaMapaProps {
  casillas: Casilla[];
  colaboradoresMap: Map<string, Colaborador>;
}

type CasillaMeta = Casilla & { colaborador?: Colaborador };

const TIPO_LABEL: Record<string, string> = {
  casilla_viajero: 'Casilla de viajero',
  almacen_propio: 'Almacén propio',
  punto_courier: 'Punto courier',
  ubicacion_proveedor: 'Ubicación proveedor',
};

export const RedLogisticaMapa: React.FC<RedLogisticaMapaProps> = ({ casillas, colaboradoresMap }) => {
  // Solo casillas con coordenadas
  const puntos = useMemo<MapPoint<CasillaMeta>[]>(() => {
    return casillas
      .filter((c) => c.coordenadas && c.estado === 'activa')
      .map((c) => ({
        id: c.id,
        coordenadas: c.coordenadas!,
        nombre: c.nombre,
        categoria: c.pais,
        metadata: { ...c, colaborador: colaboradoresMap.get(c.colaboradorId) },
      }));
  }, [casillas, colaboradoresMap]);

  // Conteo por país para leyenda
  const leyenda = useMemo(() => {
    const counts = puntos.reduce<Record<string, number>>((acc, p) => {
      const pais = p.metadata?.pais ?? 'Otro';
      acc[pais] = (acc[pais] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([pais, count]) => ({
        label: pais === 'Peru_local' ? 'Perú (local)' : pais,
        color: COUNTRY_COLORS[pais === 'Peru_local' ? 'Peru' : pais] ?? '#64748B',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [puntos]);

  const sinDatos = casillas.filter((c) => c.estado === 'activa').length === 0;
  const sinCoordenadas = !sinDatos && puntos.length === 0;

  return (
    <div className="relative w-full h-[560px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
      {sinDatos ? (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6">
          <div>
            <p className="text-sm font-medium text-slate-700">Sin casillas activas</p>
            <p className="text-xs text-slate-500 mt-1">
              Crea colaboradores y casillas desde el listado para verlas en el mapa.
            </p>
          </div>
        </div>
      ) : sinCoordenadas ? (
        <div className="absolute inset-0 flex items-center justify-center text-center p-6">
          <div className="max-w-sm">
            <p className="text-sm font-medium text-slate-700">Casillas sin geolocalizar</p>
            <p className="text-xs text-slate-500 mt-2">
              Abre cualquier casilla y usa el botón <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px]">📍</span> junto a la dirección para geolocalizarla. Las casillas con coordenadas aparecerán aquí.
            </p>
          </div>
        </div>
      ) : (
        <MapProvider>
          <MapContainer
            center={MAP_CENTERS.AMERICAS}
            zoom={3}
            autoFit
            autoFitPadding={80}
            minHeight="560px"
          >
            <MarkersLayer<CasillaMeta>
              points={puntos}
              colorBy={(p) =>
                COUNTRY_COLORS[p.metadata?.pais === 'Peru_local' ? 'Peru' : (p.metadata?.pais ?? '')] ?? '#64748B'
              }
              scaleBy={(p) => {
                // Escala entre 8 y 14 según unidades actuales
                const u = p.metadata?.unidadesActuales ?? 0;
                return Math.min(14, 8 + Math.log10(u + 1) * 2);
              }}
              renderTooltip={(p) => {
                const c = p.metadata!;
                const colab = c.colaborador;
                // S42g — Si hay colaboradores secundarios, listarlos en el tooltip
                const colaboradoresTexto = c.colaboradoresSecundariosNombres?.length
                  ? `${colab?.nombre ?? c.colaboradorNombre} + ${c.colaboradoresSecundariosNombres.join(', ')}`
                  : colab?.nombre ?? c.colaboradorNombre ?? '—';
                return (
                  <MapTooltip
                    title={c.nombre}
                    subtitle={
                      c.colaboradoresSecundariosIds?.length
                        ? `${TIPO_LABEL[c.tipo] ?? c.tipo} · Casilla compartida`
                        : TIPO_LABEL[c.tipo] ?? c.tipo
                    }
                    kpis={[
                      { label: 'Colaboradores', value: colaboradoresTexto },
                      { label: 'País', value: c.pais === 'Peru_local' ? 'Perú' : c.pais },
                      { label: 'Ciudad', value: c.ciudad ?? '—' },
                      { label: 'Unidades', value: c.unidadesActuales ?? 0 },
                      { label: 'Valor inv.', value: formatCurrency(c.valorInventarioUSD ?? 0, 'USD') },
                    ]}
                  />
                );
              }}
            />
            <MapLegend items={leyenda} title="Casillas por país" position="top-right" />
          </MapContainer>
        </MapProvider>
      )}
    </div>
  );
};
