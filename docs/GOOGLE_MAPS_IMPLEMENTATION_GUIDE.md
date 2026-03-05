# Guia de Implementacion: Google Maps Address Input

## Contexto del Proyecto

Proyecto: **BusinessMN v2 (Vita Skin Peru)**
Stack: React + TypeScript + Firebase/Firestore + Vite + Tailwind CSS
Estado: El componente `GoogleMapsAddressInput` ya esta implementado y funcionando en el modulo de Entregas (`ProgramarEntregaModal`). Se necesita reutilizar en otros formularios que requieran direccion del cliente.

---

## Archivos Existentes (NO modificar, solo reutilizar)

### 1. Hook: `src/hooks/useGoogleMaps.ts`
- Carga dinamica del SDK de Google Maps (singleton, una sola vez)
- Lee la API key de `VITE_GOOGLE_MAPS_API_KEY` en `.env`
- Exporta `useGoogleMaps()` hook y `extractAddressFields()` utility
- `extractAddressFields()` parsea `address_components` de Google para Peru:
  - Distrito -> `sublocality_level_1`
  - Provincia -> `administrative_area_level_2`
  - Codigo Postal -> `postal_code`

### 2. Componente: `src/components/common/GoogleMapsAddressInput.tsx`
Componente reutilizable que incluye:
- Buscador con Google Places Autocomplete (restringido a Peru)
- Mapa interactivo (click para mover pin)
- Marker draggable con reverse geocoding automatico
- Boton de ubicacion actual (GPS del dispositivo)
- Campos editables auto-llenados: direccion, distrito, provincia, codigo postal, referencia
- Centro default: Lima (-12.0464, -77.0428)

### 3. Re-export: `src/components/common/index.ts`
Ya exporta:
```tsx
export { GoogleMapsAddressInput } from './GoogleMapsAddressInput';
export type { AddressData } from './GoogleMapsAddressInput';
```

### 4. Variable de entorno requerida
```env
VITE_GOOGLE_MAPS_API_KEY=<key>
```
APIs habilitadas: Maps JavaScript API, Places API, Geocoding API

---

## Interface de Datos

```tsx
// Importar desde components/common
import { GoogleMapsAddressInput, type AddressData } from '../../components/common';

interface AddressData {
  direccion: string;
  distrito: string;
  provincia: string;
  codigoPostal: string;
  referencia: string;
  coordenadas: {
    lat: number;
    lng: number;
  } | null;
  placeId?: string;
}
```

---

## Como Integrar en un Nuevo Formulario

### Paso 1: Importar
```tsx
import { GoogleMapsAddressInput, type AddressData } from '../../components/common';
```

### Paso 2: Estado
```tsx
const [addressData, setAddressData] = useState<AddressData>({
  direccion: '',    // o pre-poblar con dato existente
  distrito: '',
  provincia: '',
  codigoPostal: '',
  referencia: '',
  coordenadas: null,
});
```

Si hay datos previos (ej: editar una cotizacion existente):
```tsx
const [addressData, setAddressData] = useState<AddressData>({
  direccion: cotizacion.direccionEntrega || '',
  distrito: cotizacion.distrito || '',
  provincia: cotizacion.provincia || '',
  codigoPostal: cotizacion.codigoPostal || '',
  referencia: cotizacion.referencia || '',
  coordenadas: cotizacion.coordenadas || null,
});
```

### Paso 3: Renderizar en JSX
```tsx
<div className="bg-white border border-gray-200 rounded-lg p-4">
  <GoogleMapsAddressInput
    value={addressData}
    onChange={setAddressData}
    initialAddress={datoExistente?.direccion}  // opcional, para geocodificar al abrir
  />
</div>
```

### Paso 4: Extraer datos al guardar
```tsx
const handleSubmit = () => {
  const dataToSave = {
    // ... otros campos del formulario
    direccionEntrega: addressData.direccion,
    distrito: addressData.distrito || undefined,
    provincia: addressData.provincia || undefined,
    codigoPostal: addressData.codigoPostal || undefined,
    referencia: addressData.referencia || undefined,
    coordenadas: addressData.coordenadas || undefined,
  };
  // guardar en Firestore...
};
```

---

## Ejemplo Real: Uso en ProgramarEntregaModal (referencia)

Archivo: `src/components/modules/venta/ProgramarEntregaModal.tsx`

```tsx
// Import
import { GoogleMapsAddressInput, type AddressData } from '../../common/GoogleMapsAddressInput';

// State
const [addressData, setAddressData] = useState<AddressData>({
  direccion: venta.direccionEntrega || '',
  distrito: '',
  provincia: '',
  codigoPostal: '',
  referencia: '',
  coordenadas: null,
});

// JSX
<GoogleMapsAddressInput
  value={addressData}
  onChange={setAddressData}
  initialAddress={venta.direccionEntrega}
/>

// Al enviar
const entregaData = {
  productos: [...],
  direccionEntrega: addressData.direccion,
  distrito: addressData.distrito || undefined,
  provincia: addressData.provincia || undefined,
  codigoPostal: addressData.codigoPostal || undefined,
  referencia: addressData.referencia || undefined,
  coordenadas: addressData.coordenadas || undefined,
  fechaProgramada: new Date(fechaProgramada),
};
```

---

## Bonus: QR de Google Maps en PDFs

El `pdf.service.ts` ya tiene un metodo que genera URLs de Google Maps para QR codes:

```tsx
// En pdf.service.ts
private generarGoogleMapsUrl(entrega: Entrega): string | null {
  // Con coordenadas -> URL de navegacion directa (mas precisa)
  if (entrega.coordenadas?.lat && entrega.coordenadas?.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  // Solo con direccion -> URL de busqueda (fallback)
  if (entrega.direccionEntrega) {
    const query = [direccion, distrito, 'Peru'].join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return null;
}
```

Si el formulario de Cotizacion guarda `coordenadas`, el PDF de la Guia Transportista automaticamente generara un QR con navegacion directa.

---

## Tipos en Firestore

Para que las coordenadas se guarden correctamente, los tipos del documento en Firestore deben incluir:

```tsx
// En el tipo de Cotizacion/Venta/etc
interface MiDocumento {
  // ... otros campos
  direccionEntrega: string;
  distrito?: string;
  provincia?: string;
  codigoPostal?: string;
  referencia?: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
}
```

---

## Checklist de Implementacion

- [ ] Verificar que `VITE_GOOGLE_MAPS_API_KEY` existe en `.env`
- [ ] Importar `GoogleMapsAddressInput` y `AddressData` desde `components/common`
- [ ] Crear state con `useState<AddressData>({...})`
- [ ] Agregar `<GoogleMapsAddressInput value={...} onChange={...} />` al JSX
- [ ] Mapear `addressData` a los campos del documento al guardar
- [ ] Verificar que el tipo del documento acepta `coordenadas?: { lat, lng }`
- [ ] Probar: buscar direccion, click en mapa, drag del marker, boton GPS
