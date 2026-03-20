import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, Package, DollarSign, User, FileText, ArrowRight } from 'lucide-react';
import { Button, Modal } from '../../common';
import type { Venta, EditarVentaData } from '../../../types/venta.types';

interface EditarVentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (cambios: EditarVentaData) => Promise<void>;
  venta: Venta;
  loading?: boolean;
}

interface ProductoEditable {
  productoId: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  precioUnitario: number;
  cantidad: number;
  precioOriginal: number;
  cantidadOriginal: number;
}

export const EditarVentaModal: React.FC<EditarVentaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  venta,
  loading = false
}) => {
  const esEstadoTemprano = ['cotizacion', 'confirmada'].includes(venta.estado);

  // --- Estado del formulario ---
  const [productos, setProductos] = useState<ProductoEditable[]>([]);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [descuento, setDescuento] = useState(0);
  const [incluyeEnvio, setIncluyeEnvio] = useState(true);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [distrito, setDistrito] = useState('');
  const [provincia, setProvincia] = useState('');
  const [dniRuc, setDniRuc] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Inicializar valores cuando se abre
  useEffect(() => {
    if (isOpen && venta) {
      setProductos(venta.productos.map(p => ({
        productoId: p.productoId,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        precioUnitario: p.precioUnitario,
        cantidad: p.cantidad,
        precioOriginal: p.precioUnitario,
        cantidadOriginal: p.cantidad,
      })));
      setCostoEnvio(venta.costoEnvio || 0);
      setDescuento(venta.descuento || 0);
      setIncluyeEnvio(venta.incluyeEnvio);
      setNombreCliente(venta.nombreCliente || '');
      setTelefonoCliente(venta.telefonoCliente || '');
      setEmailCliente(venta.emailCliente || '');
      setDireccionEntrega(venta.direccionEntrega || '');
      setDistrito(venta.distrito || '');
      setProvincia(venta.provincia || '');
      setDniRuc(venta.dniRuc || '');
      setObservaciones(venta.observaciones || '');
    }
  }, [isOpen, venta]);

  // --- Calculos en vivo ---
  const subtotalNuevo = useMemo(
    () => productos.reduce((sum, p) => sum + p.cantidad * p.precioUnitario, 0),
    [productos]
  );

  const totalNuevo = useMemo(
    () => subtotalNuevo - descuento + (incluyeEnvio ? 0 : costoEnvio),
    [subtotalNuevo, descuento, costoEnvio, incluyeEnvio]
  );

  const totalCambio = totalNuevo !== venta.totalPEN;

  // --- Diff detection ---
  const numeroCambios = useMemo(() => {
    let count = 0;
    productos.forEach(p => {
      if (p.precioUnitario !== p.precioOriginal) count++;
      if (p.cantidad !== p.cantidadOriginal) count++;
    });
    if (costoEnvio !== (venta.costoEnvio || 0)) count++;
    if (descuento !== (venta.descuento || 0)) count++;
    if (incluyeEnvio !== venta.incluyeEnvio) count++;
    if (nombreCliente !== (venta.nombreCliente || '')) count++;
    if (telefonoCliente !== (venta.telefonoCliente || '')) count++;
    if (emailCliente !== (venta.emailCliente || '')) count++;
    if (direccionEntrega !== (venta.direccionEntrega || '')) count++;
    if (distrito !== (venta.distrito || '')) count++;
    if (provincia !== (venta.provincia || '')) count++;
    if (dniRuc !== (venta.dniRuc || '')) count++;
    if (observaciones !== (venta.observaciones || '')) count++;
    return count;
  }, [productos, costoEnvio, descuento, incluyeEnvio, nombreCliente, telefonoCliente, emailCliente, direccionEntrega, distrito, provincia, dniRuc, observaciones, venta]);

  const buildCambios = (): EditarVentaData => {
    const cambios: EditarVentaData = {};

    const productosConCambios = productos.filter(
      p => p.precioUnitario !== p.precioOriginal || p.cantidad !== p.cantidadOriginal
    ).map(p => ({
      productoId: p.productoId,
      precioUnitario: p.precioUnitario,
      cantidad: p.cantidad,
    }));
    if (productosConCambios.length > 0) cambios.productos = productosConCambios;

    if (costoEnvio !== (venta.costoEnvio || 0)) cambios.costoEnvio = costoEnvio;
    if (descuento !== (venta.descuento || 0)) cambios.descuento = descuento;
    if (incluyeEnvio !== venta.incluyeEnvio) cambios.incluyeEnvio = incluyeEnvio;

    if (esEstadoTemprano) {
      if (nombreCliente !== (venta.nombreCliente || '')) cambios.nombreCliente = nombreCliente;
      if (telefonoCliente !== (venta.telefonoCliente || '')) cambios.telefonoCliente = telefonoCliente;
      if (emailCliente !== (venta.emailCliente || '')) cambios.emailCliente = emailCliente;
      if (direccionEntrega !== (venta.direccionEntrega || '')) cambios.direccionEntrega = direccionEntrega;
      if (distrito !== (venta.distrito || '')) cambios.distrito = distrito;
      if (provincia !== (venta.provincia || '')) cambios.provincia = provincia;
      if (dniRuc !== (venta.dniRuc || '')) cambios.dniRuc = dniRuc;
    }

    if (observaciones !== (venta.observaciones || '')) cambios.observaciones = observaciones;

    return cambios;
  };

  const handleSubmit = async () => {
    if (numeroCambios === 0) return;
    const cambios = buildCambios();
    await onSubmit(cambios);
  };

  const updateProducto = (index: number, field: 'precioUnitario' | 'cantidad', value: number) => {
    setProductos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar ${venta.numeroVenta}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {numeroCambios > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                <Pencil className="h-3 w-3" />
                {numeroCambios} cambio{numeroCambios !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-gray-400 text-xs">Sin cambios</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={numeroCambios === 0 || loading}
              loading={loading}
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Productos */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <Package className="h-4 w-4 text-primary-500" />
            Productos
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-medium text-gray-600">Producto</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 w-24">Cant.</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 w-32">Precio Unit.</th>
                  <th className="text-right py-2 pl-3 font-medium text-gray-600 w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((prod, idx) => {
                  const subtotalProd = prod.cantidad * prod.precioUnitario;
                  const precioChanged = prod.precioUnitario !== prod.precioOriginal;
                  const cantidadChanged = prod.cantidad !== prod.cantidadOriginal;

                  return (
                    <tr key={prod.productoId} className="border-b border-gray-100">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900 text-xs">{prod.marca}</div>
                        <div className="text-gray-500 text-xs">{prod.nombreComercial} - {prod.presentacion}</div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="1"
                          value={prod.cantidad}
                          onChange={(e) => updateProducto(idx, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                          disabled={!esEstadoTemprano}
                          className={`w-full text-center text-sm border rounded-md px-2 py-1.5 ${
                            cantidadChanged ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                          } ${!esEstadoTemprano ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-primary-500 focus:border-primary-500'}`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">S/</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={prod.precioUnitario}
                            onChange={(e) => updateProducto(idx, 'precioUnitario', Math.max(0, parseFloat(e.target.value) || 0))}
                            className={`w-full text-right text-sm border rounded-md pl-7 pr-2 py-1.5 ${
                              precioChanged ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                            } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                          />
                        </div>
                      </td>
                      <td className="py-2 pl-3 text-right font-medium text-gray-900">
                        S/ {subtotalProd.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Costos y Descuentos */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <DollarSign className="h-4 w-4 text-primary-500" />
            Costos y Descuentos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Costo de Envío (S/)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costoEnvio}
                onChange={(e) => setCostoEnvio(parseFloat(e.target.value) || 0)}
                className={`w-full text-sm border rounded-md px-3 py-2 ${
                  costoEnvio !== (venta.costoEnvio || 0) ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descuento (S/)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={descuento}
                onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)}
                className={`w-full text-sm border rounded-md px-3 py-2 ${
                  descuento !== (venta.descuento || 0) ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
              />
            </div>
          </div>
          {costoEnvio > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-gray-50 p-3 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Quién paga el envío:</span>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="tipoEnvioEdit"
                    checked={incluyeEnvio}
                    onChange={() => setIncluyeEnvio(true)}
                    className="mr-2 text-primary-600"
                  />
                  <span className="text-sm text-gray-600">Nosotros (gratis para cliente)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="tipoEnvioEdit"
                    checked={!incluyeEnvio}
                    onChange={() => setIncluyeEnvio(false)}
                    className="mr-2 text-primary-600"
                  />
                  <span className="text-sm text-gray-600">Cliente paga</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Datos del Cliente - solo estados tempranos */}
        {esEstadoTemprano && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <User className="h-4 w-4 text-primary-500" />
              Datos del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    nombreCliente !== (venta.nombreCliente || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">DNI/RUC</label>
                <input
                  type="text"
                  value={dniRuc}
                  onChange={(e) => setDniRuc(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    dniRuc !== (venta.dniRuc || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    telefonoCliente !== (venta.telefonoCliente || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="text"
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    emailCliente !== (venta.emailCliente || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Dirección de Entrega</label>
                <input
                  type="text"
                  value={direccionEntrega}
                  onChange={(e) => setDireccionEntrega(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    direccionEntrega !== (venta.direccionEntrega || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Distrito</label>
                <input
                  type="text"
                  value={distrito}
                  onChange={(e) => setDistrito(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    distrito !== (venta.distrito || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provincia</label>
                <input
                  type="text"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  className={`w-full text-sm border rounded-md px-3 py-2 ${
                    provincia !== (venta.provincia || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <FileText className="h-4 w-4 text-primary-500" />
            Observaciones
          </h3>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            className={`w-full text-sm border rounded-md px-3 py-2 resize-none ${
              observaciones !== (venta.observaciones || '') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
            } focus:ring-1 focus:ring-primary-500 focus:border-primary-500`}
            placeholder="Notas adicionales..."
          />
        </div>

        {/* Resumen de totales */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">S/ {subtotalNuevo.toFixed(2)}</span>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Descuento:</span>
              <span className="text-red-600">- S/ {descuento.toFixed(2)}</span>
            </div>
          )}
          {costoEnvio > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Envío {incluyeEnvio ? '(gratis)' : '(cobrado)'}:
              </span>
              <span className={incluyeEnvio ? 'text-gray-400 line-through' : 'text-gray-900'}>
                {incluyeEnvio ? '' : '+ '}S/ {costoEnvio.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
            <span>Total:</span>
            <div className="flex items-center gap-2">
              {totalCambio && (
                <>
                  <span className="text-gray-400 line-through text-sm font-normal">
                    S/ {venta.totalPEN.toFixed(2)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                </>
              )}
              <span className={totalCambio ? 'text-amber-700' : 'text-gray-900'}>
                S/ {totalNuevo.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

    </Modal>
  );
};
