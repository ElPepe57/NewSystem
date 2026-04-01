import React, { useState, useEffect } from 'react';
import { Button, Modal, AutocompleteInput } from '../../components/common';
import type {
  CuentaCaja,
  CuentaCajaFormData,
  MonedaTesoreria,
} from '../../types/tesoreria.types';

const PRODUCTOS = [
  { value: 'cuenta_ahorros', label: 'Cuenta de Ahorros' },
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
  { value: 'tarjeta_credito', label: 'Tarjeta de Crédito' },
  { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bancoNombre: string;
  cuentaEditando?: CuentaCaja | null;
  onGuardar: (data: CuentaCajaFormData) => void;
  isSubmitting: boolean;
  titularesExistentes: string[];
}

export const CuentaBancoForm: React.FC<Props> = ({
  isOpen, onClose, bancoNombre, cuentaEditando, onGuardar, isSubmitting, titularesExistentes,
}) => {
  const [nombre, setNombre] = useState('');
  const [titular, setTitular] = useState('');
  const [titularidad, setTitularidad] = useState<'empresa' | 'personal'>('empresa');
  const [producto, setProducto] = useState('cuenta_ahorros');
  const [moneda, setMoneda] = useState<MonedaTesoreria>('PEN');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cci, setCci] = useState('');
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [saldoMinimo, setSaldoMinimo] = useState<number | undefined>();
  const [lineaLimite, setLineaLimite] = useState(0);
  const [lineaTasa, setLineaTasa] = useState(0);
  const [lineaCorte, setLineaCorte] = useState(0);
  const [lineaPago, setLineaPago] = useState(0);

  const esEdicion = !!cuentaEditando;
  const esCredito = producto === 'tarjeta_credito';

  useEffect(() => {
    if (cuentaEditando) {
      setNombre(cuentaEditando.nombre);
      setTitular(cuentaEditando.titular || '');
      setTitularidad(cuentaEditando.titularidad || 'empresa');
      setProducto(cuentaEditando.productoFinanciero || 'cuenta_ahorros');
      setMoneda(cuentaEditando.moneda);
      setNumeroCuenta(cuentaEditando.numeroCuenta || '');
      setCci(cuentaEditando.cci || '');
      setSaldoInicial(cuentaEditando.saldoActual || 0);
      setSaldoMinimo(cuentaEditando.saldoMinimo);
      setLineaLimite(cuentaEditando.lineaCredito?.limiteTotal || 0);
      setLineaTasa(cuentaEditando.lineaCredito?.tasaInteres || 0);
      setLineaCorte(cuentaEditando.lineaCredito?.fechaCorte || 0);
      setLineaPago(cuentaEditando.lineaCredito?.fechaPago || 0);
    } else {
      reset();
    }
  }, [cuentaEditando]);

  const handleGuardar = () => {
    if (!nombre || !titular.trim()) return;
    const tipo = esCredito ? 'credito' as const : 'banco' as const;
    onGuardar({
      nombre,
      titular: titular.trim(),
      tipo,
      banco: bancoNombre,
      bancoNombreCompleto: cuentaEditando?.bancoNombreCompleto,
      moneda,
      esBiMoneda: false,
      saldoInicial: esEdicion ? 0 : saldoInicial,
      saldoMinimo: saldoMinimo || undefined,
      numeroCuenta: numeroCuenta || undefined,
      cci: cci || undefined,
      productoFinanciero: producto as any,
      titularidad,
      lineaCreditoLimite: esCredito ? lineaLimite : undefined,
      lineaCreditoTasa: esCredito ? lineaTasa : undefined,
      lineaCreditoFechaCorte: esCredito ? lineaCorte : undefined,
      lineaCreditoFechaPago: esCredito ? lineaPago : undefined,
    });
  };

  const reset = () => {
    setNombre(''); setTitular(''); setTitularidad('empresa'); setProducto('cuenta_ahorros');
    setMoneda('PEN'); setNumeroCuenta(''); setCci(''); setSaldoInicial(0);
    setSaldoMinimo(undefined); setLineaLimite(0); setLineaTasa(0); setLineaCorte(0); setLineaPago(0);
  };

  const ic = 'w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500';

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!esEdicion) reset(); onClose(); }}
      title={esEdicion ? `Editar cuenta — ${bancoNombre}` : `Nueva cuenta — ${bancoNombre}`} size="md">
      <div className="space-y-4">
        <div className="px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-800 font-medium">
          Banco: {bancoNombre}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la cuenta *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className={ic}
              placeholder="Ej: Cuenta Ahorros PEN" />
          </div>
          <div>
            <AutocompleteInput
              label="Titular *"
              value={titular}
              onChange={setTitular}
              suggestions={titularesExistentes}
              allowCreate
              createLabel="Usar nuevo titular"
              placeholder="Buscar o crear titular"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <select value={producto} onChange={e => setProducto(e.target.value)} className={ic}>
              {PRODUCTOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select value={moneda} onChange={e => setMoneda(e.target.value as MonedaTesoreria)}
              className={ic} disabled={esEdicion}>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titularidad</label>
            <select value={titularidad} onChange={e => setTitularidad(e.target.value as any)} className={ic}>
              <option value="empresa">Empresa</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>

        {/* Número de cuenta + CCI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de cuenta</label>
            <input type="text" value={numeroCuenta}
              onChange={e => setNumeroCuenta(e.target.value)}
              className={ic} placeholder="Ej: 191-12345678-0-01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CCI (opcional)</label>
            <input type="text" value={cci}
              onChange={e => setCci(e.target.value)}
              className={ic} placeholder="Código interbancario" />
          </div>
        </div>

        {/* Saldos */}
        {!esEdicion ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{moneda === 'USD' ? '$' : 'S/'}</span>
              <input type="number" step="0.01" value={saldoInicial || ''}
                onChange={e => setSaldoInicial(parseFloat(e.target.value) || 0)}
                className={ic + ' pl-8'} placeholder="0.00" />
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Saldo actual:</span>{' '}
              <span className="text-lg font-bold text-gray-900">
                {moneda === 'PEN' ? 'S/ ' : '$ '}
                {(cuentaEditando?.saldoActual || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">Solo se modifica mediante movimientos</p>
          </div>
        )}

        {/* Línea de crédito */}
        {esCredito && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
            <h4 className="text-sm font-medium text-amber-800">Línea de Crédito</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Límite</label>
                <input type="number" step="0.01" value={lineaLimite || ''}
                  onChange={e => setLineaLimite(+e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-gray-300 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tasa anual (%)</label>
                <input type="number" step="0.1" value={lineaTasa || ''}
                  onChange={e => setLineaTasa(+e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-gray-300 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Día corte</label>
                <input type="number" min="1" max="28" value={lineaCorte || ''}
                  onChange={e => setLineaCorte(+e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-gray-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Día pago</label>
                <input type="number" min="1" max="28" value={lineaPago || ''}
                  onChange={e => setLineaPago(+e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-gray-300 text-sm" />
              </div>
            </div>
            {cuentaEditando?.lineaCredito && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200">
                <div className="text-center">
                  <span className="text-xs text-gray-500">Utilizado</span>
                  <p className="text-sm font-bold text-amber-700">
                    {moneda === 'USD' ? '$' : 'S/'} {(cuentaEditando.lineaCredito.utilizado || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500">Disponible</span>
                  <p className="text-sm font-bold text-green-600">
                    {moneda === 'USD' ? '$' : 'S/'} {(cuentaEditando.lineaCredito.disponible || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Saldo mínimo */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Alerta saldo mínimo (opcional)</label>
          <input type="number" step="0.01" value={saldoMinimo || ''}
            onChange={e => setSaldoMinimo(parseFloat(e.target.value) || undefined)}
            className="w-full px-3 py-2 rounded-md border-gray-300 text-sm" placeholder="0" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => { if (!esEdicion) reset(); onClose(); }}>Cancelar</Button>
          <Button variant="primary" onClick={handleGuardar}
            disabled={isSubmitting || !nombre || !titular.trim()}>
            {isSubmitting ? 'Guardando...' : esEdicion ? 'Guardar Cambios' : 'Crear Cuenta'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
