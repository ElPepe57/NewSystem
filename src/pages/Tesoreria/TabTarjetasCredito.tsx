import React, { useEffect } from 'react';
import { CreditCard, DollarSign } from 'lucide-react';
import { useTarjetaCreditoStore } from '../../store/tarjetaCreditoStore';
import { Card, Badge } from '../../components/common';

export const TabTarjetasCredito: React.FC = () => {
  const { tarjetas, tarjetasActivas, saldoTotalUSD, loading, fetchTarjetas } = useTarjetaCreditoStore();

  useEffect(() => {
    fetchTarjetas();
  }, [fetchTarjetas]);

  if (loading && tarjetas.length === 0) {
    return <div className="text-center py-8 text-gray-500">Cargando tarjetas...</div>;
  }

  if (tarjetas.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Sin tarjetas de cr\u00e9dito registradas</p>
        <p className="text-sm mt-1">Las tarjetas se usar\u00e1n para registrar compras como pasivos y generar diferencial cambiario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-gray-500">Tarjetas activas</div>
          <div className="text-2xl font-bold text-gray-900">{tarjetasActivas.length}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-gray-500">Saldo total adeudado</div>
          <div className="text-2xl font-bold text-red-600">${saldoTotalUSD.toFixed(2)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-gray-500">Disponible total</div>
          <div className="text-2xl font-bold text-green-600">
            ${tarjetasActivas.reduce((s, t) => s + t.disponibleUSD, 0).toFixed(2)}
          </div>
        </Card>
      </div>

      {/* Lista de tarjetas */}
      <div className="space-y-3">
        {tarjetas.map(tarjeta => {
          const uso = tarjeta.limiteUSD > 0
            ? (tarjeta.saldoActualUSD / tarjeta.limiteUSD) * 100
            : 0;

          return (
            <Card key={tarjeta.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{tarjeta.nombre}</div>
                    <div className="text-xs text-gray-500">{tarjeta.banco} &middot; ****{tarjeta.ultimosDigitos}</div>
                  </div>
                </div>
                <Badge variant={tarjeta.activa ? 'success' : 'secondary'} className="text-xs">
                  {tarjeta.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              {/* Barra de uso */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Usado: ${tarjeta.saldoActualUSD.toFixed(2)}</span>
                  <span>L\u00edmite: ${tarjeta.limiteUSD.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      uso > 80 ? 'bg-red-500' : uso > 50 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(uso, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-right">
                  Disponible: ${tarjeta.disponibleUSD.toFixed(2)} ({(100 - uso).toFixed(0)}%)
                </div>
              </div>

              {/* Fechas */}
              <div className="mt-2 flex gap-4 text-xs text-gray-400">
                <span>Corte: d\u00eda {tarjeta.diaCorte}</span>
                <span>Pago: d\u00eda {tarjeta.diaPago}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
