import type { Entrega } from '../types/entrega.types';

/**
 * Servicio de generación de documentos PDF para entregas
 * Usa el API de impresión del navegador para generar PDFs
 */

interface EmpresaConfig {
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  qrCuenta?: string;
  qrTelefono?: string;
}

// Configuración de la empresa (podría venir de configuración)
const EMPRESA_CONFIG: EmpresaConfig = {
  nombre: 'BusinessMN',
  ruc: '20XXXXXXXXX',
  direccion: 'Lima, Perú',
  telefono: '+51 999 999 999',
  qrCuenta: '999999999', // Número de cuenta/teléfono para pagos
  qrTelefono: '+51 999 999 999'
};

/**
 * Genera un código QR como URL de imagen
 * Usa la API gratuita de QR Server
 */
function generarQRUrl(texto: string, tamaño: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${tamaño}x${tamaño}&data=${encodeURIComponent(texto)}`;
}

/**
 * Genera el contenido de datos para el QR de pago
 */
function generarDatosQRPago(monto: number, referencia: string): string {
  // Formato simple para Yape/Plin
  return `Pago: S/${monto.toFixed(2)} - Ref: ${referencia} - Tel: ${EMPRESA_CONFIG.qrTelefono}`;
}

/**
 * Genera el HTML para la guía de entrega del transportista
 */
function generarHTMLGuiaTransportista(entrega: Entrega): string {
  const fechaFormateada = entrega.fechaProgramada?.toDate().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) || 'Sin fecha';

  const productosHTML = entrega.productos.map(p => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${p.sku}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${p.marca} ${p.nombreComercial}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.cantidad}</td>
    </tr>
  `).join('');

  const cobroHTML = entrega.cobroPendiente && entrega.montoPorCobrar ? `
    <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 20px;">
      <h3 style="color: #b45309; margin: 0 0 12px 0; font-size: 18px;">
        COBRO PENDIENTE
      </h3>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="margin: 4px 0; font-size: 24px; font-weight: bold; color: #92400e;">
            S/ ${entrega.montoPorCobrar.toFixed(2)}
          </p>
          <p style="margin: 4px 0; color: #78350f;">
            Método esperado: ${entrega.metodoPagoEsperado || 'Cualquiera'}
          </p>
        </div>
        <div style="text-align: center;">
          <img src="${generarQRUrl(generarDatosQRPago(entrega.montoPorCobrar, entrega.codigo), 120)}"
               alt="QR de Pago"
               style="width: 120px; height: 120px; border: 2px solid #d97706; border-radius: 4px;" />
          <p style="margin: 4px 0; font-size: 12px; color: #78350f;">
            Escanear para pagar
          </p>
        </div>
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Guía de Entrega - ${entrega.codigo}</title>
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .codigo { font-size: 20px; font-weight: bold; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .info-box { background: #f9fafb; padding: 12px; border-radius: 8px; }
        .info-label { font-size: 12px; color: #6b7280; }
        .info-value { font-size: 16px; font-weight: 500; color: #1f2937; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 12px 8px; text-align: left; font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; }
        .firma-box { margin-top: 40px; border-top: 2px dashed #d1d5db; padding-top: 20px; }
        .firma-line { border-bottom: 1px solid #1f2937; width: 250px; margin-top: 40px; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <div class="logo">${EMPRESA_CONFIG.nombre}</div>
            <div style="font-size: 12px; color: #6b7280;">Guía de Entrega para Transportista</div>
          </div>
          <div class="codigo">${entrega.codigo}</div>
        </div>

        <div class="section">
          <div class="section-title">Información de Entrega</div>
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Fecha Programada</div>
              <div class="info-value">${fechaFormateada}</div>
              ${entrega.horaProgramada ? `<div style="color: #6b7280; font-size: 14px;">Horario: ${entrega.horaProgramada}</div>` : ''}
            </div>
            <div class="info-box">
              <div class="info-label">Venta</div>
              <div class="info-value">${entrega.numeroVenta}</div>
              <div style="color: #6b7280; font-size: 14px;">Entrega ${entrega.numeroEntrega}${entrega.totalEntregas ? ` de ${entrega.totalEntregas}` : ''}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Cliente</div>
          <div class="info-box" style="background: #f0f9ff;">
            <div style="font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 8px;">
              ${entrega.nombreCliente}
            </div>
            ${entrega.telefonoCliente ? `<div style="color: #3b82f6; margin-bottom: 4px;">Tel: ${entrega.telefonoCliente}</div>` : ''}
            <div style="font-size: 14px; color: #1f2937; margin-top: 8px;">
              <strong>Dirección:</strong> ${entrega.direccionEntrega}
            </div>
            ${entrega.distrito ? `<div style="font-size: 14px; color: #6b7280;">Distrito: ${entrega.distrito}</div>` : ''}
            ${entrega.referencia ? `<div style="font-size: 14px; color: #6b7280;">Referencia: ${entrega.referencia}</div>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Productos a Entregar</div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th style="text-align: center;">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${productosHTML}
            </tbody>
          </table>
          <div style="text-align: right; margin-top: 8px; font-weight: bold;">
            Total Items: ${entrega.cantidadItems}
          </div>
        </div>

        ${cobroHTML}

        ${entrega.observaciones ? `
          <div class="section" style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <div class="section-title" style="color: #92400e;">Observaciones</div>
            <p style="margin: 0; color: #78350f;">${entrega.observaciones}</p>
          </div>
        ` : ''}

        <div class="firma-box">
          <div style="display: flex; justify-content: space-between;">
            <div>
              <div class="firma-line"></div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Firma del Cliente</div>
            </div>
            <div>
              <div class="firma-line"></div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Fecha y Hora de Entrega</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>${EMPRESA_CONFIG.nombre} | RUC: ${EMPRESA_CONFIG.ruc} | ${EMPRESA_CONFIG.telefono}</p>
          <p>Documento generado el ${new Date().toLocaleString('es-PE')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera el HTML para el cargo de entrega del cliente
 */
function generarHTMLCargoCliente(entrega: Entrega): string {
  const fechaFormateada = entrega.fechaProgramada?.toDate().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) || 'Sin fecha';

  const productosHTML = entrega.productos.map(p => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${p.marca} ${p.nombreComercial}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.cantidad}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">S/ ${p.precioUnitario.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">S/ ${p.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  const qrPagoHTML = entrega.cobroPendiente && entrega.montoPorCobrar ? `
    <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
      <h3 style="color: #166534; margin: 0 0 12px 0;">Pago Digital</h3>
      <img src="${generarQRUrl(generarDatosQRPago(entrega.montoPorCobrar, entrega.codigo), 150)}"
           alt="QR de Pago"
           style="width: 150px; height: 150px; border-radius: 8px;" />
      <p style="margin: 12px 0 0 0; color: #166534; font-size: 14px;">
        Escanea este código para pagar con Yape o Plin
      </p>
      <p style="margin: 4px 0 0 0; color: #166534; font-size: 12px;">
        ${EMPRESA_CONFIG.qrTelefono}
      </p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cargo de Entrega - ${entrega.codigo}</title>
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #10b981; }
        .subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; }
        .codigo { font-size: 16px; font-weight: bold; color: #374151; margin-top: 8px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
        .cliente-box { background: #ecfdf5; padding: 16px; border-radius: 8px; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f3f4f6; padding: 10px; text-align: left; font-size: 12px; font-weight: bold; color: #6b7280; }
        .totales { background: #f0fdf4; padding: 16px; border-radius: 8px; margin-top: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .total-final { font-size: 20px; font-weight: bold; color: #166534; border-top: 2px solid #86efac; padding-top: 12px; margin-top: 8px; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${EMPRESA_CONFIG.nombre}</div>
          <div class="subtitle">Comprobante de Entrega</div>
          <div class="codigo">${entrega.codigo}</div>
        </div>

        <div class="section">
          <div class="cliente-box">
            <div style="font-size: 18px; font-weight: bold; color: #065f46;">
              ${entrega.nombreCliente}
            </div>
            <div style="font-size: 14px; color: #047857; margin-top: 4px;">
              ${fechaFormateada}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Productos Recibidos</div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align: center;">Cant.</th>
                <th style="text-align: right;">P.Unit.</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${productosHTML}
            </tbody>
          </table>

          <div class="totales">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>S/ ${entrega.subtotalPEN.toFixed(2)}</span>
            </div>
            ${entrega.costoEnvio ? `
              <div class="total-row">
                <span>Envío:</span>
                <span>S/ ${entrega.costoEnvio.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row total-final">
              <span>TOTAL:</span>
              <span>S/ ${(entrega.subtotalPEN + (entrega.costoEnvio || 0)).toFixed(2)}</span>
            </div>
            ${entrega.cobroPendiente && entrega.montoPorCobrar ? `
              <div class="total-row" style="color: #dc2626; font-weight: bold; margin-top: 8px;">
                <span>Pendiente de Pago:</span>
                <span>S/ ${entrega.montoPorCobrar.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        ${qrPagoHTML}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed #d1d5db;">
          <div style="text-align: center; font-size: 12px; color: #6b7280; margin-bottom: 40px;">
            Firma de conformidad de recepción
          </div>
          <div style="width: 200px; margin: 0 auto; border-bottom: 1px solid #1f2937;"></div>
          <div style="text-align: center; font-size: 12px; color: #6b7280; margin-top: 8px;">
            ${entrega.nombreCliente}
          </div>
        </div>

        <div class="footer">
          <p><strong>${EMPRESA_CONFIG.nombre}</strong></p>
          <p>RUC: ${EMPRESA_CONFIG.ruc} | ${EMPRESA_CONFIG.direccion} | ${EMPRESA_CONFIG.telefono}</p>
          <p style="margin-top: 8px;">Gracias por su preferencia</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export const entregaPdfService = {
  /**
   * Genera y abre la guía de entrega para el transportista
   */
  generarGuiaTransportista(entrega: Entrega): void {
    const html = generarHTMLGuiaTransportista(entrega);
    this.abrirVentanaImpresion(html, `Guia-${entrega.codigo}`);
  },

  /**
   * Genera y abre el cargo de entrega para el cliente
   */
  generarCargoCliente(entrega: Entrega): void {
    const html = generarHTMLCargoCliente(entrega);
    this.abrirVentanaImpresion(html, `Cargo-${entrega.codigo}`);
  },

  /**
   * Genera ambos documentos (guía y cargo)
   */
  generarDocumentosEntrega(entrega: Entrega): void {
    // Abre ambos documentos en ventanas separadas
    this.generarGuiaTransportista(entrega);
    setTimeout(() => {
      this.generarCargoCliente(entrega);
    }, 500);
  },

  /**
   * Abre una ventana de impresión con el HTML proporcionado
   */
  abrirVentanaImpresion(html: string, titulo: string): void {
    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) {
      alert('Por favor permite las ventanas emergentes para generar el PDF');
      return;
    }

    ventana.document.write(html);
    ventana.document.close();
    ventana.document.title = titulo;

    // Esperar a que carguen las imágenes (QR) antes de imprimir
    ventana.onload = () => {
      setTimeout(() => {
        ventana.focus();
        ventana.print();
      }, 500);
    };
  },

  /**
   * Actualiza la configuración de la empresa
   */
  actualizarConfiguracion(config: Partial<EmpresaConfig>): void {
    Object.assign(EMPRESA_CONFIG, config);
  }
};
