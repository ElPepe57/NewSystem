import React, { useState, useRef } from 'react';
import { QrCode, Upload, X } from 'lucide-react';
import { Button, Input, Select } from '../../common';
import type { EmpresaFormData } from '../../../types/configuracion.types';

interface EmpresaFormProps {
  initialData?: Partial<EmpresaFormData>;
  onSubmit: (data: EmpresaFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export const EmpresaForm: React.FC<EmpresaFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<EmpresaFormData>({
    razonSocial: initialData?.razonSocial || '',
    nombreComercial: initialData?.nombreComercial || '',
    ruc: initialData?.ruc || '',
    direccion: initialData?.direccion || '',
    telefono: initialData?.telefono || '',
    email: initialData?.email || '',
    sitioWeb: initialData?.sitioWeb || '',
    monedaPrincipal: initialData?.monedaPrincipal || 'PEN',
    // QR de Pagos
    qrPagoUrl: initialData?.qrPagoUrl || '',
    qrPagoTelefono: initialData?.qrPagoTelefono || '',
    qrPagoBanco: initialData?.qrPagoBanco || 'Yape / Plin'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Procesar imagen QR: detectar y recortar el código QR del fondo
  const processQRImage = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageData);
          return;
        }

        // Dibujar imagen original
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Obtener datos de píxeles
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Buscar los límites del área blanca (el QR)
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        const threshold = 200; // Umbral para considerar "blanco"

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];

            // Detectar píxeles blancos o muy claros
            if (r > threshold && g > threshold && b > threshold) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // Si encontramos área blanca, recortar
        if (maxX > minX && maxY > minY) {
          // Añadir pequeño padding
          const padding = 5;
          minX = Math.max(0, minX - padding);
          minY = Math.max(0, minY - padding);
          maxX = Math.min(canvas.width, maxX + padding);
          maxY = Math.min(canvas.height, maxY + padding);

          const width = maxX - minX;
          const height = maxY - minY;

          // Crear canvas para el recorte (cuadrado)
          const size = Math.max(width, height);
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = size;
          cropCanvas.height = size;
          const cropCtx = cropCanvas.getContext('2d');

          if (cropCtx) {
            // Fondo blanco
            cropCtx.fillStyle = '#FFFFFF';
            cropCtx.fillRect(0, 0, size, size);

            // Centrar el QR recortado
            const offsetX = (size - width) / 2;
            const offsetY = (size - height) / 2;
            cropCtx.drawImage(canvas, minX, minY, width, height, offsetX, offsetY, width, height);

            resolve(cropCanvas.toDataURL('image/png', 0.9));
            return;
          }
        }

        // Si no se pudo procesar, devolver original
        resolve(imageData);
      };
      img.src = imageData;
    });
  };

  // Manejar carga de imagen QR
  const handleQRImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (máximo 2MB para procesamiento)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 2MB');
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;

      // Procesar: detectar y recortar el QR
      const processedQR = await processQRImage(base64);
      setFormData(prev => ({ ...prev, qrPagoUrl: processedQR }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveQRImage = () => {
    setFormData(prev => ({ ...prev, qrPagoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Verificar si qrPagoUrl es una imagen base64
  const isBase64Image = formData.qrPagoUrl?.startsWith('data:image/');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Razón Social"
          name="razonSocial"
          value={formData.razonSocial}
          onChange={handleChange}
          required
        />
        
        <Input
          label="Nombre Comercial"
          name="nombreComercial"
          value={formData.nombreComercial}
          onChange={handleChange}
          required
        />
        
        <Input
          label="RUC"
          name="ruc"
          value={formData.ruc}
          onChange={handleChange}
          required
          maxLength={11}
        />
        
        <Select
          label="Moneda Principal"
          name="monedaPrincipal"
          value={formData.monedaPrincipal}
          onChange={handleChange}
          options={[
            { value: 'PEN', label: 'Soles (PEN)' },
            { value: 'USD', label: 'Dólares (USD)' }
          ]}
          required
        />
      </div>

      <Input
        label="Dirección"
        name="direccion"
        value={formData.direccion}
        onChange={handleChange}
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Teléfono"
          name="telefono"
          value={formData.telefono}
          onChange={handleChange}
        />

        <Input
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />

        <Input
          label="Sitio Web"
          name="sitioWeb"
          value={formData.sitioWeb}
          onChange={handleChange}
          placeholder="https://..."
        />
      </div>

      {/* Sección QR de Pagos */}
      <div className="border-t pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <QrCode className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">QR de Pagos (Yape / Plin)</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configura tu información de pago para que aparezca en los tickets de envío cuando hay cobro pendiente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Columna izquierda: Datos */}
          <div className="space-y-4">
            <Input
              label="Número de Teléfono"
              name="qrPagoTelefono"
              value={formData.qrPagoTelefono}
              onChange={handleChange}
              placeholder="999 999 999"
              hint="Número asociado a Yape/Plin"
            />

            <Input
              label="Tipo de Pago"
              name="qrPagoBanco"
              value={formData.qrPagoBanco}
              onChange={handleChange}
              placeholder="Yape / Plin"
              hint="Se muestra en el ticket"
            />
          </div>

          {/* Columna derecha: Imagen QR */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagen del QR
            </label>

            {isBase64Image ? (
              // Mostrar imagen cargada
              <div className="relative inline-block">
                <img
                  src={formData.qrPagoUrl}
                  alt="QR de Pago"
                  className="w-40 h-40 object-contain border border-gray-200 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleRemoveQRImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  title="Eliminar imagen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              // Área para subir imagen
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500 text-center px-2">
                  Subir imagen QR
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  PNG, JPG (máx. 2MB)
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleQRImageUpload}
              className="hidden"
            />

            <p className="text-xs text-gray-500 mt-2">
              El QR se recortará automáticamente
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-6 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          Guardar Información
        </Button>
      </div>
    </form>
  );
};