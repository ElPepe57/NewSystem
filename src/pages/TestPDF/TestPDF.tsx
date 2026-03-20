import React, { useState } from 'react';
import { pdfService } from '../../services/pdf.service';
import type { Entrega } from '../../types/entrega.types';

// Datos de muestra para la guía de transportista
const SAMPLE_ENTREGA_COBRO: Entrega = {
  id: 'test-001',
  ventaId: 'venta-test',
  codigo: 'ENT-2026-015',
  numeroVenta: 'VT-2026-041',
  numeroEntrega: 1,
  totalEntregas: 1,
  nombreCliente: 'Ruth Cavero Contreras',
  telefonoCliente: '951234567',
  nombreTransportista: 'Shalom - Av Lima Cuadra 38',
  direccionEntrega: 'Pje. San Felipe lt. 1, Piura 20009',
  distrito: 'Piura',
  provincia: 'Piura',
  codigoPostal: '20009',
  referencia: 'Frente al parque central, casa celeste con rejas negras',
  coordenadas: { lat: -5.1813, lng: -80.6317 },
  fechaProgramada: new Date('2026-03-01'),
  horaProgramada: '08:00-12:00',
  productos: [
    { productoId: 'p1', marca: 'Horbaach', nombreComercial: 'Melena de Leon', cantidad: 1, precioUnitario: 45.00, subtotal: 45.00 },
    { productoId: 'p2', marca: 'NatureBell', nombreComercial: 'Ashwagandha 1300mg', cantidad: 2, precioUnitario: 35.00, subtotal: 70.00 },
  ],
  cantidadItems: 3,
  subtotalPEN: 115.00,
  cobroPendiente: true,
  montoPorCobrar: 65.00,
  metodoPagoEsperado: 'yape',
  observaciones: 'Llamar antes de llegar al destino',
  estado: 'programada',
  creadoPor: 'test',
  creadoEn: new Date(),
} as any;

const SAMPLE_ENTREGA_PAGADO: Entrega = {
  ...SAMPLE_ENTREGA_COBRO,
  id: 'test-002',
  codigo: 'ENT-2026-016',
  nombreCliente: 'Carlos Martinez Lopez',
  telefonoCliente: '987654321',
  direccionEntrega: 'Av. Arequipa 1234, Dpto 501',
  distrito: 'Lince',
  provincia: 'Lima',
  codigoPostal: '15001',
  referencia: 'Edificio azul esquina con Jr. Huancavelica',
  coordenadas: { lat: -12.0820, lng: -77.0365 },
  nombreTransportista: 'Olva Courier - Ag. Central Lima',
  cobroPendiente: false,
  montoPorCobrar: 0,
  metodoPagoEsperado: 'transferencia',
  observaciones: '',
} as any;

export const TestPDF: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGenerar = async (tipo: 'cobro' | 'pagado') => {
    setLoading(tipo);
    try {
      const entrega = tipo === 'cobro' ? SAMPLE_ENTREGA_COBRO : SAMPLE_ENTREGA_PAGADO;
      const doc = await pdfService.generarGuiaTransportista(entrega);
      const filename = tipo === 'cobro' ? 'muestra-COBRO-PENDIENTE' : 'muestra-PAGADO';
      pdfService.save(doc, filename);
    } catch (err: any) {
      console.error('Error generando PDF:', err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Test - Guia Transportista PDF
      </h1>
      <p className="text-gray-500 mb-8">
        Genera PDFs de muestra para revisar el formato de la guia de transportista.
      </p>

      <div className="space-y-4">
        <button
          onClick={() => handleGenerar('cobro')}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading === 'cobro' ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span className="text-xl">💰</span>
          )}
          <div className="text-left">
            <div>Generar con COBRO PENDIENTE</div>
            <div className="text-sm font-normal opacity-80">Muestra QR Yape/Plin + monto a cobrar</div>
          </div>
        </button>

        <button
          onClick={() => handleGenerar('pagado')}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading === 'pagado' ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span className="text-xl">✅</span>
          )}
          <div className="text-left">
            <div>Generar PAGADO (sin cobro)</div>
            <div className="text-sm font-normal opacity-80">Sin cobro pendiente en esta entrega</div>
          </div>
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-2">Datos de muestra:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Cobro Pendiente:</strong> Ruth Cavero - Piura - S/ 65.00 por cobrar (Yape)</li>
          <li><strong>Pagado:</strong> Carlos Martinez - Lince, Lima - Sin cobro</li>
          <li>Ambos incluyen QR de Google Maps para navegacion</li>
        </ul>
      </div>
    </div>
  );
};

export default TestPDF;
