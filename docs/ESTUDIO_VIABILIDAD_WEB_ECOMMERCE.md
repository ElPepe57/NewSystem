# ESTUDIO DE VIABILIDAD: INTEGRACION WEB E-COMMERCE CON ERP BMN SYSTEM

## Documento Tecnico Completo
**Fecha:** Enero 2026
**Version:** 1.0
**Autor:** Analisis de Arquitectura de Software

---

# SECCION 1: RESUMEN EJECUTIVO

## 1.1 Objetivo del Estudio

Evaluar la viabilidad tecnica, estrategica y operativa de integrar una pagina web e-commerce al sistema ERP BusinessMN existente, incluyendo:
- Tienda online con carrito de compras
- Agente/Bot de IA para ventas
- Sistema de recomendaciones inteligentes
- Experiencia de usuario optimizada (UI/UX)
- Promocion automatizada de productos

## 1.2 Veredicto General

| Aspecto | Viabilidad | Puntuacion |
|---------|-----------|------------|
| **Tecnico** | ALTA | 9/10 |
| **Datos** | ALTA | 9/10 |
| **Integracion** | ALTA | 8/10 |
| **Infraestructura** | ALTA | 9/10 |
| **IA/ML** | ALTA | 8/10 |
| **GENERAL** | **MUY VIABLE** | **8.6/10** |

### Por que es viable:

1. **Stack Tecnologico Alineado**: React + Firebase ya estan en produccion
2. **Datos Ricos**: Modelos de datos robustos con precios, competencia, clientes
3. **Logica de Negocio Existente**: Cotizaciones, reservas, inventario en tiempo real
4. **Analytics Avanzados**: Sistema de competidores, RFM de clientes ya implementado
5. **Arquitectura Escalable**: Firebase escala automaticamente

---

# SECCION 2: ANALISIS DE ARQUITECTURA ACTUAL

## 2.1 Stack Tecnologico Existente

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18+)                      │
├─────────────────────────────────────────────────────────────┤
│  Vite | TypeScript | TailwindCSS | Zustand | React Query    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE SERVICES                         │
├──────────────────┬──────────────────┬───────────────────────┤
│   Firestore      │  Authentication  │     Storage           │
│   (Database)     │  (Auth)          │     (Files)           │
├──────────────────┼──────────────────┼───────────────────────┤
│   Hosting        │  Functions       │     Security Rules    │
│   (Deploy)       │  (Serverless)    │     (Access Control)  │
└──────────────────┴──────────────────┴───────────────────────┘
```

## 2.2 Modelos de Datos Clave para E-commerce

### Producto (ya existente - 100% reutilizable)
```typescript
interface Producto {
  id: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: Presentacion;  // tabletas, capsulas, etc.
  dosaje: string;
  contenido: string;
  sabor?: string;

  // CLASIFICACION (perfecto para filtros web)
  tipoProducto: TipoProductoSnapshot;      // Aceite de Oregano, Omega 3
  categorias: CategoriaSnapshot[];         // Sistema Inmune, Digestivo
  etiquetasData: EtiquetaSnapshot[];       // vegano, organico, best-seller

  // PRECIOS (critico para e-commerce)
  ctruPromedio: number;        // Costo real (CMV)
  precioSugerido: number;      // Precio venta
  margenMinimo: number;
  margenObjetivo: number;

  // STOCK (en tiempo real)
  stockDisponible: number;
  stockReservado: number;
  stockPeru: number;

  // ML (habilitacion de canales)
  habilitadoML: boolean;
  restriccionML: string;

  // INVESTIGACION DE MERCADO (inteligencia de precios)
  investigacion?: InvestigacionMercado;

  // CICLO DE RECOMPRA (para remarketing)
  cicloRecompraDias?: number;
}
```

### Cliente (CRM existente - ideal para personalizacion)
```typescript
interface Cliente {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;

  // SEGMENTACION RFM (ya implementado!)
  clasificacionABC: 'A' | 'B' | 'C' | 'nuevo';
  segmento: SegmentoCliente;  // vip, premium, frecuente, etc.
  analisisRFM: {
    recencia: number;           // Dias desde ultima compra
    frecuencia: number;         // Compras en 365 dias
    valorMonetario: number;     // Monto total
    scoreRecencia: number;      // 1-5
    scoreFrecuencia: number;    // 1-5
    scoreMonetario: number;     // 1-5
  };

  // METRICAS (para recomendaciones)
  metricas: {
    totalCompras: number;
    ticketPromedio: number;
    productosFavoritos?: string[];  // IDs de productos mas comprados
  };
}
```

### Venta (flujo completo ya implementado)
```typescript
interface Venta {
  // ESTADOS COMPLETOS
  estado: 'cotizacion' | 'reservada' | 'confirmada' | 'parcial' |
          'asignada' | 'en_entrega' | 'entregada';

  // PRE-VENTA con bloqueo de stock (perfecto para carrito)
  stockReservado?: {
    activo: boolean;
    tipoReserva: 'fisica' | 'virtual';
    vigenciaHasta: Timestamp;     // Expiracion de carrito
    productosReservados: ProductoReservado[];
  };

  // PAGOS MULTIPLES
  pagos: PagoVenta[];
  metodoPago: MetodoPago;  // yape, plin, transferencia, tarjeta, etc.
}
```

### Investigacion de Mercado (inteligencia de precios)
```typescript
interface InvestigacionMercado {
  // PROVEEDORES USA
  proveedoresUSA: ProveedorUSA[];
  precioUSAPromedio: number;

  // COMPETENCIA PERU
  competidoresPeru: CompetidorPeru[];
  precioPERUMin: number;
  precioPERUPromedio: number;

  // ANALISIS
  nivelCompetencia: 'baja' | 'media' | 'alta' | 'saturada';
  demandaEstimada: 'baja' | 'media' | 'alta';
  tendencia: 'subiendo' | 'bajando' | 'estable';

  // RECOMENDACIONES AUTOMATICAS
  recomendacion: 'importar' | 'investigar_mas' | 'descartar';
  puntuacionViabilidad: number;  // 0-100
  precioEntrada: number;         // Precio competitivo calculado
}
```

## 2.3 Servicios Reutilizables (50+ servicios)

| Servicio | Lineas | Uso en Web |
|----------|--------|------------|
| producto.service.ts | 1,280 | Catalogo, busqueda, filtros |
| venta.service.ts | 2,574 | Carrito, checkout, pagos |
| cliente.service.ts | ~800 | Auth, perfil, historial |
| inventario.service.ts | ~1,000 | Stock en tiempo real |
| cotizacion.service.ts | 1,566 | Cotizaciones online |
| competidor.analytics.service.ts | 1,119 | Precios competitivos |
| priceIntelligence.service.ts | Nuevo | Precios dinamicos |

---

# SECCION 3: ARQUITECTURA PROPUESTA PARA WEB

## 3.1 Diagrama de Arquitectura Completa

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE PRESENTACION                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────┐    ┌─────────────────────┐                    │
│   │    ERP ADMIN        │    │    WEB TIENDA       │                    │
│   │  (Sistema Actual)   │    │   (Nueva - B2C)     │                    │
│   │                     │    │                     │                    │
│   │  - Dashboard        │    │  - Home/Landing     │                    │
│   │  - Inventario       │    │  - Catalogo         │                    │
│   │  - Ventas           │    │  - Carrito          │                    │
│   │  - Tesoreria        │    │  - Checkout         │                    │
│   │  - Reportes         │    │  - Mi Cuenta        │                    │
│   │                     │    │  - Chat IA          │                    │
│   └─────────────────────┘    └─────────────────────┘                    │
│            │                          │                                  │
│            │    ┌────────────────────┐│                                  │
│            └────│   SHARED SERVICES  │┘                                  │
│                 │   (React Context)  │                                   │
│                 └────────────────────┘                                   │
│                          │                                               │
└──────────────────────────│───────────────────────────────────────────────┘
                           │
┌──────────────────────────│───────────────────────────────────────────────┐
│                  CAPA DE LOGICA DE NEGOCIO                               │
├──────────────────────────│───────────────────────────────────────────────┤
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    FIREBASE FUNCTIONS                           │   │
│   │                    (Backend Serverless)                         │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │                                                                 │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│   │  │  API REST    │  │  Webhooks    │  │  Triggers    │          │   │
│   │  │  /products   │  │  /payments   │  │  onWrite     │          │   │
│   │  │  /cart       │  │  /shipping   │  │  onUpdate    │          │   │
│   │  │  /orders     │  │  /stock      │  │  onCreate    │          │   │
│   │  │  /users      │  │              │  │              │          │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│   │                                                                 │   │
│   │  ┌─────────────────────────────────────────────────────────┐   │   │
│   │  │               AGENTE IA DE VENTAS                       │   │   │
│   │  │  - Consultas de productos                               │   │   │
│   │  │  - Recomendaciones personalizadas                       │   │   │
│   │  │  - Asistencia de compra                                 │   │   │
│   │  │  - FAQ automatizadas                                    │   │   │
│   │  │  - Seguimiento de pedidos                               │   │   │
│   │  └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                          │                                               │
└──────────────────────────│───────────────────────────────────────────────┘
                           │
┌──────────────────────────│───────────────────────────────────────────────┐
│                     CAPA DE DATOS                                        │
├──────────────────────────│───────────────────────────────────────────────┤
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      FIREBASE                                    │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │                                                                 │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│   │  │  Firestore   │  │    Auth      │  │   Storage    │          │   │
│   │  │              │  │              │  │              │          │   │
│   │  │  productos   │  │  usuarios    │  │  imagenes    │          │   │
│   │  │  clientes    │  │  roles       │  │  archivos    │          │   │
│   │  │  ventas      │  │  sesiones    │  │  thumbnails  │          │   │
│   │  │  inventario  │  │              │  │              │          │   │
│   │  │  carritos    │  │              │  │              │          │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│   │                                                                 │   │
│   │  ┌─────────────────────────────────────────────────────────┐   │   │
│   │  │            INTEGRACIONES EXTERNAS                       │   │   │
│   │  │  - Pasarelas de pago (Culqi, Izipay, MercadoPago)       │   │   │
│   │  │  - Shipping APIs (Olva, Shalom, etc.)                   │   │   │
│   │  │  - Analytics (GA4, Mixpanel)                            │   │   │
│   │  │  - Claude/OpenAI API (Agente IA)                        │   │   │
│   │  └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Estrategia de Implementacion: Monorepo

```
businessmn-v2/
├── packages/
│   ├── shared/                    # Codigo compartido
│   │   ├── types/                 # Tipos TypeScript (reutilizar)
│   │   ├── services/              # Servicios Firebase (reutilizar)
│   │   ├── utils/                 # Utilidades comunes
│   │   └── hooks/                 # Hooks compartidos
│   │
│   ├── admin/                     # ERP actual (migrar)
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── web/                       # Nueva tienda web
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Catalogo.tsx
│   │   │   │   ├── Producto.tsx
│   │   │   │   ├── Carrito.tsx
│   │   │   │   ├── Checkout.tsx
│   │   │   │   └── MiCuenta.tsx
│   │   │   ├── components/
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── CartWidget.tsx
│   │   │   │   ├── AIChat.tsx
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── functions/                 # Firebase Functions
│       ├── src/
│       │   ├── api/
│       │   ├── triggers/
│       │   └── ai-agent/
│       └── package.json
│
├── firebase.json
└── package.json                   # Workspace config
```

---

# SECCION 4: SISTEMA DE CARRITO DE COMPRAS

## 4.1 Arquitectura del Carrito

### Flujo Completo
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE CARRITO                                  │
└─────────────────────────────────────────────────────────────────────────┘

     USUARIO                    SISTEMA                      FIREBASE
        │                          │                            │
        │  1. Agregar producto     │                            │
        ├─────────────────────────>│                            │
        │                          │  2. Verificar stock        │
        │                          ├───────────────────────────>│
        │                          │<───────────────────────────┤
        │                          │  3. Si hay stock:          │
        │                          │     - Crear/actualizar     │
        │                          │       carrito              │
        │                          │     - Reservar stock       │
        │                          │       (48h default)        │
        │                          ├───────────────────────────>│
        │  4. Confirmar            │                            │
        │<─────────────────────────┤                            │
        │                          │                            │
        │  5. Proceder a checkout  │                            │
        ├─────────────────────────>│                            │
        │                          │  6. Validar carrito        │
        │                          │  7. Calcular totales       │
        │                          │  8. Aplicar descuentos     │
        │                          │                            │
        │  9. Seleccionar pago     │                            │
        ├─────────────────────────>│                            │
        │                          │  10. Procesar pago         │
        │                          ├───────────────────────────>│
        │                          │<───────────────────────────┤
        │                          │  11. Crear venta           │
        │                          │  12. Confirmar stock       │
        │                          ├───────────────────────────>│
        │ 13. Confirmacion         │                            │
        │<─────────────────────────┤                            │
        │                          │                            │
```

## 4.2 Modelo de Datos del Carrito

```typescript
// NUEVO: Carrito para web
interface CarritoWeb {
  id: string;

  // Identificacion
  usuarioId?: string;           // Si esta logueado
  sessionId: string;            // Para usuarios anonimos

  // Productos
  items: CarritoItem[];

  // Totales (calculados en tiempo real)
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;

  // Estado de reserva (reutilizar logica existente de StockReservado)
  reservaActiva: boolean;
  vigenciaReserva: Timestamp;

  // Metadatos
  fechaCreacion: Timestamp;
  ultimaActualizacion: Timestamp;

  // Conversion
  convertidoAVenta?: string;    // ID de venta si se convirtio
}

interface CarritoItem {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  imagen?: string;

  cantidad: number;
  precioUnitario: number;
  subtotal: number;

  // Stock
  stockDisponible: number;
  unidadesReservadas?: string[]; // IDs de unidades bloqueadas

  // Promociones
  descuentoAplicado?: number;
  promocionId?: string;
}
```

## 4.3 Logica de Reserva de Stock (YA EXISTE!)

El sistema actual ya tiene implementado un sofisticado sistema de reserva:

```typescript
// EXISTENTE en venta.types.ts - 100% reutilizable
interface StockReservado {
  activo: boolean;
  tipoReserva: 'fisica' | 'virtual';
  fechaReserva: Timestamp;
  vigenciaHasta: Timestamp;              // Default 48h
  horasVigenciaOriginal: number;
  extensiones?: ExtensionReserva[];      // Max 3 extensiones
  adelantoId: string;
  productosReservados: ProductoReservado[];

  stockVirtual?: {
    productosVirtuales: ProductoStockVirtual[];
    requerimientoGenerado?: string;
    fechaEstimadaStock?: Timestamp;
  };
}
```

**Ventaja competitiva**: El carrito web puede reservar stock REAL, evitando el problema comun de "producto agotado al pagar".

---

# SECCION 5: AGENTE IA DE VENTAS

## 5.1 Arquitectura del Agente

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     AGENTE IA DE VENTAS - ARQUITECTURA                    │
└──────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────┐
                    │         INTERFAZ CHAT           │
                    │      (Widget en la web)         │
                    └───────────────┬─────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          FIREBASE FUNCTION                                 │
│                          /api/ai-agent                                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    PROCESADOR DE INTENCIONES                        │ │
│  │                                                                     │ │
│  │  - consulta_producto: Buscar informacion de productos               │ │
│  │  - recomendacion: Sugerir productos basado en perfil               │ │
│  │  - comparar: Comparar productos entre si                           │ │
│  │  - estado_pedido: Consultar estado de compra                       │ │
│  │  - ayuda_compra: Asistir en proceso de checkout                    │ │
│  │  - faq: Responder preguntas frecuentes                             │ │
│  │  - disponibilidad: Verificar stock                                 │ │
│  │  - precio: Consultar precios y promociones                         │ │
│  │                                                                     │ │
│  └──────────────────────────┬──────────────────────────────────────────┘ │
│                             │                                             │
│  ┌──────────────────────────▼──────────────────────────────────────────┐ │
│  │                    CONTEXTO ENRIQUECIDO                             │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │ │
│  │  │  Productos  │  │   Cliente   │  │  Historial  │                 │ │
│  │  │  (Catalogo) │  │   (Perfil)  │  │  (Compras)  │                 │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │ │
│  │  │ Inventario  │  │ Competencia │  │  Promociones│                 │ │
│  │  │   (Stock)   │  │  (Precios)  │  │  (Ofertas)  │                 │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │ │
│  │                                                                     │ │
│  └──────────────────────────┬──────────────────────────────────────────┘ │
│                             │                                             │
│  ┌──────────────────────────▼──────────────────────────────────────────┐ │
│  │                    MODELO DE LENGUAJE                               │ │
│  │                    (Claude API / GPT-4)                             │ │
│  │                                                                     │ │
│  │  System Prompt:                                                     │ │
│  │  "Eres un asistente de ventas experto en suplementos y vitaminas.   │ │
│  │   Tienes acceso al catalogo de productos, precios, stock y perfil   │ │
│  │   del cliente. Tu objetivo es ayudar a encontrar los productos      │ │
│  │   ideales basandote en sus necesidades de salud."                   │ │
│  │                                                                     │ │
│  └──────────────────────────┬──────────────────────────────────────────┘ │
│                             │                                             │
└─────────────────────────────│─────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────────┐
                    │         RESPUESTA               │
                    │   (Texto + Acciones + UI)       │
                    └─────────────────────────────────┘
```

## 5.2 Capacidades del Agente IA

### Consultas de Productos
```typescript
// El agente puede consultar el catalogo existente
async function consultaProducto(query: string) {
  // Usar ProductoService.search() existente
  const resultados = await ProductoService.search(query);

  // Enriquecer con datos de investigacion de mercado
  return resultados.map(p => ({
    ...p,
    precioCompetitivo: p.investigacion?.precioEntrada,
    disponibilidad: p.stockDisponible > 0 ? 'disponible' : 'agotado',
    tiempoRecompra: p.cicloRecompraDias
  }));
}
```

### Recomendaciones Personalizadas
```typescript
// Usar datos de cliente existentes
async function recomendarProductos(clienteId: string) {
  const cliente = await ClienteService.getById(clienteId);

  // Usar analisis RFM existente
  const { analisisRFM, metricas } = cliente;
  const productosFavoritos = metricas.productosFavoritos || [];

  // Logica de recomendacion basada en:
  // 1. Historial de compras
  // 2. Segmento del cliente (vip, premium, etc)
  // 3. Productos relacionados
  // 4. Ciclo de recompra
  // 5. Tendencias de demanda

  return generarRecomendaciones(cliente, productosFavoritos);
}
```

### Comparacion de Precios
```typescript
// Usar datos de competidores existentes
async function compararPrecios(productoId: string) {
  const producto = await ProductoService.getById(productoId);
  const investigacion = producto.investigacion;

  return {
    nuestroPrecio: producto.precioSugerido,
    precioMercado: {
      minimo: investigacion.precioPERUMin,
      promedio: investigacion.precioPERUPromedio,
      maximo: investigacion.precioPERUMax
    },
    competidores: investigacion.competidoresPeru,
    ventaja: producto.precioSugerido < investigacion.precioPERUPromedio
      ? 'mejor_precio' : 'precio_premium',
    ahorro: investigacion.precioPERUPromedio - producto.precioSugerido
  };
}
```

## 5.3 Implementacion del Chat

```typescript
// Componente React para el chat
interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;

  // Acciones sugeridas
  actions?: {
    type: 'add_to_cart' | 'view_product' | 'compare' | 'checkout';
    productId?: string;
    label: string;
  }[];

  // Productos relacionados
  products?: {
    id: string;
    sku: string;
    nombre: string;
    precio: number;
    imagen: string;
  }[];
}

// Firebase Function para procesar mensajes
export const aiAgentEndpoint = functions.https.onCall(async (data, context) => {
  const { message, conversationId, clienteId } = data;

  // 1. Obtener contexto del cliente
  const cliente = clienteId ? await getCliente(clienteId) : null;
  const historial = await getConversationHistory(conversationId);

  // 2. Construir prompt con contexto
  const systemPrompt = buildSystemPrompt(cliente);

  // 3. Llamar a Claude API con tool use
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...historial, { role: 'user', content: message }],
    tools: [
      { name: 'buscar_productos', ... },
      { name: 'verificar_stock', ... },
      { name: 'obtener_recomendaciones', ... },
      { name: 'comparar_precios', ... },
      { name: 'agregar_carrito', ... }
    ]
  });

  // 4. Procesar respuesta y ejecutar tools
  return processResponse(response);
});
```

---

# SECCION 6: SISTEMA DE RECOMENDACIONES INTELIGENTES

## 6.1 Tipos de Recomendaciones

### 1. Basadas en Historial (Collaborative Filtering)
```typescript
interface RecomendacionHistorial {
  tipo: 'recompra' | 'similar' | 'complementario';
  productos: Producto[];
  razon: string;
  confianza: number;  // 0-100
}

// Ejemplo de implementacion
async function getRecomendacionesHistorial(clienteId: string) {
  const cliente = await ClienteService.getById(clienteId);
  const ventas = await VentaService.getByCliente(clienteId);

  const recomendaciones: RecomendacionHistorial[] = [];

  // 1. Productos para recompra (basado en cicloRecompraDias)
  const productosComprados = extraerProductosUnicos(ventas);
  for (const prod of productosComprados) {
    const diasDesdeCompra = calcularDiasDesde(prod.ultimaCompra);
    if (diasDesdeCompra >= prod.cicloRecompraDias * 0.8) {
      recomendaciones.push({
        tipo: 'recompra',
        productos: [prod],
        razon: `Es momento de reponer tu ${prod.nombreComercial}`,
        confianza: 90
      });
    }
  }

  // 2. Productos similares
  // 3. Productos complementarios

  return recomendaciones;
}
```

### 2. Basadas en Segmento (RFM ya implementado)
```typescript
async function getRecomendacionesSegmento(cliente: Cliente) {
  const { segmento, clasificacionABC } = cliente;

  switch (segmento) {
    case 'vip':
    case 'premium':
      // Productos premium, novedades, ediciones limitadas
      return getProductosPremium();

    case 'frecuente':
    case 'regular':
      // Productos con mejor relacion precio-calidad
      return getProductosBestValue();

    case 'en_riesgo':
    case 'inactivo':
      // Productos con descuento para reactivar
      return getProductosConOferta();

    default:
      // Productos mas vendidos
      return getProductosPopulares();
  }
}
```

### 3. Basadas en Contexto (Inteligencia de Precios)
```typescript
async function getRecomendacionesContexto(categoria: string) {
  const productos = await ProductoService.getByCategoria(categoria);

  return productos
    .filter(p => p.investigacion?.estaVigente)
    .map(p => ({
      ...p,
      // Usar datos de investigacion de mercado existentes
      ventajaCompetitiva: calcularVentaja(p),
      demanda: p.investigacion.demandaEstimada,
      tendencia: p.investigacion.tendencia
    }))
    .sort((a, b) => {
      // Priorizar: alta demanda + tendencia subiendo + ventaja de precio
      return calcularScoreRecomendacion(b) - calcularScoreRecomendacion(a);
    });
}
```

## 6.2 Motor de Promociones Inteligentes

```typescript
interface PromocionInteligente {
  id: string;
  tipo: 'descuento' | 'bundle' | '2x1' | 'envio_gratis' | 'gift';

  // Condiciones
  condiciones: {
    segmentosObjetivo?: SegmentoCliente[];
    montoMinimo?: number;
    productosRequeridos?: string[];
    fechaInicio: Date;
    fechaFin: Date;
  };

  // Beneficio
  beneficio: {
    descuentoPorcentaje?: number;
    descuentoFijo?: number;
    productoGratis?: string;
    envioGratis?: boolean;
  };

  // Optimizacion automatica
  metricas: {
    impresiones: number;
    conversiones: number;
    tasaConversion: number;
    ingresoGenerado: number;
  };
}

// Seleccion inteligente de promociones
async function seleccionarPromocion(
  cliente: Cliente | null,
  carrito: CarritoWeb
): Promise<PromocionInteligente | null> {
  const promocionesActivas = await getPromocionesActivas();

  // Filtrar por elegibilidad
  const elegibles = promocionesActivas.filter(p =>
    esElegible(p, cliente, carrito)
  );

  // Ordenar por impacto esperado
  elegibles.sort((a, b) =>
    calcularImpactoEsperado(b, carrito) - calcularImpactoEsperado(a, carrito)
  );

  return elegibles[0] || null;
}
```

---

# SECCION 7: EXPERIENCIA DE USUARIO (UI/UX)

## 7.1 Mapa de Navegacion Web

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAPA DE NAVEGACION WEB                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │    HOME     │
                              │  (Landing)  │
                              └──────┬──────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
    ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
    │  CATALOGO   │           │  CATEGORIAS │           │   OFERTAS   │
    │  (Todos)    │           │  (Filtros)  │           │ (Promociones)│
    └──────┬──────┘           └──────┬──────┘           └──────┬──────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  PRODUCTO   │
                              │  (Detalle)  │
                              └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
             ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
             │   AGREGAR   │  │    CHAT     │  │  COMPARAR   │
             │  A CARRITO  │  │     IA      │  │  PRODUCTOS  │
             └──────┬──────┘  └─────────────┘  └─────────────┘
                    │
                    ▼
             ┌─────────────┐
             │   CARRITO   │
             │  (Resumen)  │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │  CHECKOUT   │
             │  (3 pasos)  │
             └──────┬──────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
     ▼              ▼              ▼
┌─────────┐  ┌─────────────┐  ┌─────────┐
│ DATOS   │  │   ENVIO     │  │  PAGO   │
│CONTACTO │  │ (Direccion) │  │(Metodo) │
└─────────┘  └─────────────┘  └─────────┘
                    │
                    ▼
             ┌─────────────┐
             │CONFIRMACION │
             │  (Exito)    │
             └─────────────┘


═══════════════════════════════════════════════════════════════════════════════

                           AREA DE USUARIO

             ┌─────────────┐
             │  MI CUENTA  │
             │  (Portal)   │
             └──────┬──────┘
                    │
     ┌──────────────┼──────────────┬──────────────┐
     │              │              │              │
     ▼              ▼              ▼              ▼
┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌─────────────┐
│ PERFIL  │  │   PEDIDOS   │  │FAVORITOS│  │ DIRECCIONES │
│ (Datos) │  │ (Historial) │  │ (Lista) │  │  (Envio)    │
└─────────┘  └─────────────┘  └─────────┘  └─────────────┘
```

## 7.2 Wireframes de Pantallas Clave

### HOME - Landing Page
```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]    Catalogo  Ofertas  Mi Cuenta    [Buscar]  [Carrito] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    HERO BANNER                           │ │
│  │          "Suplementos de Calidad USA"                    │ │
│  │              [Ver Catalogo]                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ═══════════════ CATEGORIAS DESTACADAS ════════════════════  │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Sistema  │  │  Omega   │  │Vitaminas │  │ Energia  │      │
│  │  Inmune  │  │    3     │  │    D     │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                │
│  ═══════════════ PRODUCTOS DESTACADOS ═════════════════════  │
│                                                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ [IMG]   │  │ [IMG]   │  │ [IMG]   │  │ [IMG]   │          │
│  │ Nombre  │  │ Nombre  │  │ Nombre  │  │ Nombre  │          │
│  │ S/XX.XX │  │ S/XX.XX │  │ S/XX.XX │  │ S/XX.XX │          │
│  │[Agregar]│  │[Agregar]│  │[Agregar]│  │[Agregar]│          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                │
│  ═══════════════ OFERTAS ESPECIALES ═══════════════════════  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [Banner Promocion]  HASTA 30% OFF EN OMEGA 3          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [💬 Chat con IA]  <- Widget flotante                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CATALOGO - Lista de Productos
```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]    Catalogo  Ofertas  Mi Cuenta    [Buscar]  [Carrito] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Inicio > Catalogo > Sistema Inmune                            │
│                                                                │
│  ┌─────────────────┐  ┌────────────────────────────────────┐  │
│  │    FILTROS      │  │         RESULTADOS (24)            │  │
│  │                 │  │                                    │  │
│  │  Categoria      │  │  Ordenar: [Relevancia v]  [Grid]   │  │
│  │  [ ] Sistema    │  │                                    │  │
│  │  [ ] Omega      │  │  ┌─────────┐  ┌─────────┐          │  │
│  │  [ ] Vitaminas  │  │  │ [IMG]   │  │ [IMG]   │          │  │
│  │                 │  │  │ Nombre  │  │ Nombre  │          │  │
│  │  Marca          │  │  │ Marca   │  │ Marca   │          │  │
│  │  [ ] NOW Foods  │  │  │ ★★★★☆   │  │ ★★★★★   │          │  │
│  │  [ ] Nature     │  │  │ S/89.90 │  │ S/125   │          │  │
│  │  [ ] Nordic     │  │  │[Agregar]│  │[Agregar]│          │  │
│  │                 │  │  └─────────┘  └─────────┘          │  │
│  │  Precio         │  │                                    │  │
│  │  S/0 ──●── S/300│  │  ┌─────────┐  ┌─────────┐          │  │
│  │                 │  │  │ [IMG]   │  │ [IMG]   │          │  │
│  │  Presentacion   │  │  │ Nombre  │  │ Nombre  │          │  │
│  │  [ ] Capsulas   │  │  │ Marca   │  │ Marca   │          │  │
│  │  [ ] Tabletas   │  │  │ ★★★★☆   │  │ ★★★☆☆   │          │  │
│  │  [ ] Liquido    │  │  │ S/75.00 │  │ S/65.00 │          │  │
│  │                 │  │  │[Agregar]│  │[Agregar]│          │  │
│  │  Etiquetas      │  │  └─────────┘  └─────────┘          │  │
│  │  [ ] Vegano     │  │                                    │  │
│  │  [ ] Organico   │  │  [1] [2] [3] ... [8] [>]           │  │
│  │  [ ] Sin Gluten │  │                                    │  │
│  └─────────────────┘  └────────────────────────────────────┘  │
│                                                                │
│  [💬]                                                          │
└────────────────────────────────────────────────────────────────┘
```

### PRODUCTO - Detalle
```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]    Catalogo  Ofertas  Mi Cuenta    [Buscar]  [Carrito] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Inicio > Sistema Inmune > Aceite de Oregano                   │
│                                                                │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐│
│  │                     │  │  NOW Foods                        ││
│  │      [IMAGEN]       │  │  ACEITE DE OREGANO 181mg          ││
│  │                     │  │  90 Softgels                       ││
│  │    [img] [img]      │  │                                    ││
│  │                     │  │  ★★★★★ (128 reseñas)               ││
│  └─────────────────────┘  │                                    ││
│                           │  ┌────────────────────────────┐   ││
│                           │  │  S/ 89.90                  │   ││
│                           │  │  ̶S̶/̶ ̶1̶1̶0̶ ̶ ̶ -18%              │   ││
│                           │  │                            │   ││
│                           │  │  vs Mercado: S/95 - S/140  │   ││
│                           │  │  ✓ Mejor precio del mercado│   ││
│                           │  └────────────────────────────┘   ││
│                           │                                    ││
│                           │  Cantidad: [-] 1 [+]               ││
│                           │                                    ││
│                           │  [    AGREGAR AL CARRITO    ]      ││
│                           │  [      COMPRAR AHORA       ]      ││
│                           │                                    ││
│                           │  ✓ Stock disponible (23 unidades)  ││
│                           │  ✓ Envio: 24-48 horas Lima         ││
│                           │  ✓ Garantia: Producto original     ││
│                           └──────────────────────────────────┘│
│                                                                │
│  ═══════════════════ DESCRIPCION ════════════════════════════ │
│                                                                │
│  El Aceite de Oregano de NOW Foods es un suplemento natural... │
│                                                                │
│  Beneficios:                                                   │
│  • Sistema inmune fortalecido                                  │
│  • Propiedades antioxidantes                                   │
│  • Salud digestiva                                             │
│                                                                │
│  ═══════════════ PRODUCTOS RELACIONADOS ════════════════════  │
│                                                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ [IMG]   │  │ [IMG]   │  │ [IMG]   │  │ [IMG]   │          │
│  │ Vitamina│  │ Zinc    │  │ Probio- │  │ Vitamin │          │
│  │ C 1000  │  │ Picolinat│  │ ticos   │  │ D3 5000 │          │
│  │ S/45.00 │  │ S/35.00 │  │ S/89.00 │  │ S/55.00 │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                │
│  [💬 Pregunta sobre este producto]                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CARRITO - Sidebar
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                         ┌──────────────────────────┐           │
│                         │      TU CARRITO (3)      │           │
│                         │          [X]             │           │
│                         ├──────────────────────────┤           │
│                         │                          │           │
│                         │  ┌──────────────────┐    │           │
│                         │  │[img] Aceite Oreg │    │           │
│                         │  │      NOW Foods   │    │           │
│                         │  │      [-] 1 [+]   │    │           │
│                         │  │      S/ 89.90    │    │           │
│                         │  └──────────────────┘    │           │
│                         │                          │           │
│                         │  ┌──────────────────┐    │           │
│                         │  │[img] Omega 3     │    │           │
│                         │  │      Nordic Nat  │    │           │
│                         │  │      [-] 2 [+]   │    │           │
│                         │  │      S/ 250.00   │    │           │
│                         │  └──────────────────┘    │           │
│                         │                          │           │
│                         │  ┌──────────────────┐    │           │
│                         │  │[img] Vitamin D3  │    │           │
│                         │  │      NOW Foods   │    │           │
│                         │  │      [-] 1 [+]   │    │           │
│                         │  │      S/ 55.00    │    │           │
│                         │  └──────────────────┘    │           │
│                         │                          │           │
│                         ├──────────────────────────┤           │
│                         │                          │           │
│                         │  Subtotal:    S/ 394.90  │           │
│                         │  Envio:       S/   9.90  │           │
│                         │  ─────────────────────── │           │
│                         │  TOTAL:       S/ 404.80  │           │
│                         │                          │           │
│                         │  ⚡ Stock reservado 48h   │           │
│                         │                          │           │
│                         │  [  IR A CHECKOUT  ]     │           │
│                         │                          │           │
│                         │  [Seguir comprando]      │           │
│                         │                          │           │
│                         └──────────────────────────┘           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CHECKOUT - Proceso de 3 Pasos
```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]                                        Pago Seguro 🔒  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│         ●────────────────●────────────────○                    │
│      Contacto          Envio            Pago                   │
│                                                                │
│  ┌────────────────────────────┐  ┌────────────────────────┐   │
│  │                            │  │      TU PEDIDO         │   │
│  │   DATOS DE CONTACTO        │  │                        │   │
│  │                            │  │  ┌────────────────┐    │   │
│  │   Nombre completo *        │  │  │ Aceite Oregano │    │   │
│  │   [____________________]   │  │  │ x1  S/ 89.90   │    │   │
│  │                            │  │  └────────────────┘    │   │
│  │   Email *                  │  │  ┌────────────────┐    │   │
│  │   [____________________]   │  │  │ Omega 3        │    │   │
│  │                            │  │  │ x2  S/ 250.00  │    │   │
│  │   Telefono (WhatsApp) *    │  │  └────────────────┘    │   │
│  │   [____________________]   │  │  ┌────────────────┐    │   │
│  │                            │  │  │ Vitamin D3     │    │   │
│  │   DNI/RUC (opcional)       │  │  │ x1  S/ 55.00   │    │   │
│  │   [____________________]   │  │  └────────────────┘    │   │
│  │                            │  │                        │   │
│  │   [ ] Guardar para futuro  │  │  ──────────────────    │   │
│  │                            │  │  Subtotal   S/ 394.90  │   │
│  │   [     CONTINUAR     ]    │  │  Envio      S/   9.90  │   │
│  │                            │  │  ──────────────────    │   │
│  └────────────────────────────┘  │  TOTAL     S/ 404.80   │   │
│                                  │                        │   │
│                                  │  🔒 Compra segura       │   │
│                                  │  ✓ Productos originales │   │
│                                  │  ✓ Envio rastreable     │   │
│                                  └────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CHAT IA - Widget
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                              ┌─────────────────────────────┐   │
│                              │  💬 Asistente Virtual       │   │
│                              │          [_]  [X]           │   │
│                              ├─────────────────────────────┤   │
│                              │                             │   │
│                              │  Hola! Soy tu asistente     │   │
│                              │  de compras. En que puedo   │   │
│                              │  ayudarte hoy?              │   │
│                              │                             │   │
│                              │  Sugerencias rapidas:       │   │
│                              │  [Buscar producto]          │   │
│                              │  [Ver ofertas]              │   │
│                              │  [Estado de pedido]         │   │
│                              │                             │   │
│                              ├─────────────────────────────┤   │
│                              │  > Busco algo para el       │   │
│                              │    sistema inmune           │   │
│                              ├─────────────────────────────┤   │
│                              │                             │   │
│                              │  Excelente! Tenemos         │   │
│                              │  varias opciones para       │   │
│                              │  fortalecer tu sistema      │   │
│                              │  inmune:                    │   │
│                              │                             │   │
│                              │  ┌───────────────────────┐  │   │
│                              │  │ 🏆 Aceite de Oregano  │  │   │
│                              │  │    NOW Foods          │  │   │
│                              │  │    S/ 89.90           │  │   │
│                              │  │    [Ver] [Agregar]    │  │   │
│                              │  └───────────────────────┘  │   │
│                              │                             │   │
│                              │  ┌───────────────────────┐  │   │
│                              │  │ Vitamina C 1000mg     │  │   │
│                              │  │ Nature Made           │  │   │
│                              │  │ S/ 45.00              │  │   │
│                              │  │ [Ver] [Agregar]       │  │   │
│                              │  └───────────────────────┘  │   │
│                              │                             │   │
│                              ├─────────────────────────────┤   │
│                              │  [Escribe tu mensaje...]    │   │
│                              │                     [Enviar]│   │
│                              └─────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

# SECCION 8: INTEGRACIONES EXTERNAS

## 8.1 Pasarelas de Pago

### Opciones Recomendadas para Peru

| Pasarela | Comision | Metodos | Integracion | Recomendacion |
|----------|----------|---------|-------------|---------------|
| **Culqi** | 3.99% + IGV | Tarjetas, Yape | API REST | ⭐ Recomendado |
| **Izipay** | 3.45% + IGV | Tarjetas, PagoEfectivo | SDK | Bueno |
| **MercadoPago** | 4.49% + IGV | Todo | SDK | Si ya vendes en ML |
| **Niubiz** | ~3.5% + IGV | Tarjetas | API | Corporativo |
| **PayPal** | 5.4% + fijo | Internacional | SDK | Para USD |

### Integracion Propuesta: Culqi

```typescript
// Firebase Function para procesar pago
export const processPayment = functions.https.onCall(async (data, context) => {
  const { token, amount, email, orderId } = data;

  const culqi = new Culqi(CULQI_SECRET_KEY);

  try {
    // Crear cargo
    const charge = await culqi.charges.create({
      amount: Math.round(amount * 100), // En centimos
      currency_code: 'PEN',
      email,
      source_id: token,
      metadata: {
        orderId,
        userId: context.auth?.uid
      }
    });

    if (charge.outcome.type === 'venta_exitosa') {
      // Registrar pago en el sistema existente
      await VentaService.registrarPago(orderId, {
        monto: amount,
        metodoPago: 'tarjeta',
        referencia: charge.id,
        fecha: Timestamp.now()
      });

      // Confirmar stock reservado
      await VentaService.confirmarVenta(orderId);

      return { success: true, chargeId: charge.id };
    }

    return { success: false, error: charge.outcome.user_message };
  } catch (error) {
    console.error('Error procesando pago:', error);
    throw new functions.https.HttpsError('internal', 'Error procesando pago');
  }
});
```

## 8.2 Integracion con WhatsApp Business

```typescript
// Notificaciones automaticas via WhatsApp
interface WhatsAppNotification {
  to: string;           // Numero de telefono
  template: string;     // Nombre del template aprobado
  components: any[];    // Variables del template
}

// Templates sugeridos:
// 1. order_confirmation - Confirmacion de pedido
// 2. shipping_update - Actualizacion de envio
// 3. delivery_complete - Entrega completada
// 4. restock_alert - Producto disponible nuevamente
// 5. reorder_reminder - Recordatorio de recompra

async function enviarNotificacionWhatsApp(
  venta: Venta,
  tipo: 'confirmacion' | 'envio' | 'entrega' | 'recompra'
) {
  const templates = {
    confirmacion: 'order_confirmation',
    envio: 'shipping_update',
    entrega: 'delivery_complete',
    recompra: 'reorder_reminder'
  };

  await whatsappApi.sendTemplate({
    to: venta.telefonoCliente,
    template: templates[tipo],
    components: buildTemplateComponents(venta, tipo)
  });
}
```

## 8.3 Analytics y Tracking

```typescript
// Eventos de e-commerce para Google Analytics 4
const trackingEvents = {
  view_item: (product: Producto) => ({
    event: 'view_item',
    ecommerce: {
      items: [{
        item_id: product.sku,
        item_name: product.nombreComercial,
        item_brand: product.marca,
        item_category: product.categorias?.[0]?.nombre,
        price: product.precioSugerido
      }]
    }
  }),

  add_to_cart: (product: Producto, quantity: number) => ({
    event: 'add_to_cart',
    ecommerce: {
      items: [{
        item_id: product.sku,
        item_name: product.nombreComercial,
        price: product.precioSugerido,
        quantity
      }]
    }
  }),

  begin_checkout: (cart: CarritoWeb) => ({
    event: 'begin_checkout',
    ecommerce: {
      items: cart.items.map(item => ({
        item_id: item.sku,
        item_name: item.nombre,
        price: item.precioUnitario,
        quantity: item.cantidad
      })),
      value: cart.total,
      currency: 'PEN'
    }
  }),

  purchase: (order: Venta) => ({
    event: 'purchase',
    ecommerce: {
      transaction_id: order.numeroVenta,
      value: order.totalPEN,
      currency: 'PEN',
      shipping: order.costoEnvio,
      items: order.productos.map(p => ({
        item_id: p.sku,
        item_name: p.nombreComercial,
        price: p.precioUnitario,
        quantity: p.cantidad
      }))
    }
  })
};
```

---

# SECCION 9: ROADMAP DE IMPLEMENTACION

## 9.1 Fases del Proyecto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ROADMAP DE IMPLEMENTACION                         │
└─────────────────────────────────────────────────────────────────────────┘

FASE 1: FUNDAMENTOS
═══════════════════════════════════════════════════════════════════════════

  Semana 1-2                   Semana 3-4                   Semana 5-6
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ ARQUITECTURA    │         │ CATALOGO WEB    │         │ CARRITO         │
│                 │         │                 │         │                 │
│ • Setup monorepo│  ──────>│ • Lista productos│ ──────>│ • Cart store    │
│ • Shared types  │         │ • Filtros       │         │ • Reserva stock │
│ • Firebase rules│         │ • Busqueda      │         │ • Persistencia  │
│ • CI/CD config  │         │ • Detalle prod  │         │ • UI carrito    │
└─────────────────┘         └─────────────────┘         └─────────────────┘


FASE 2: TRANSACCIONES
═══════════════════════════════════════════════════════════════════════════

  Semana 7-8                   Semana 9-10                  Semana 11-12
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ CHECKOUT        │         │ PAGOS           │         │ MI CUENTA       │
│                 │         │                 │         │                 │
│ • Flujo 3 pasos │  ──────>│ • Culqi integ   │ ──────>│ • Auth Firebase │
│ • Form contacto │         │ • Yape/Plin     │         │ • Perfil        │
│ • Selec. envio  │         │ • Confirmacion  │         │ • Historial     │
│ • Resumen orden │         │ • Emails        │         │ • Favoritos     │
└─────────────────┘         └─────────────────┘         └─────────────────┘


FASE 3: INTELIGENCIA
═══════════════════════════════════════════════════════════════════════════

  Semana 13-14                 Semana 15-16                 Semana 17-18
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ AGENTE IA       │         │ RECOMENDACIONES │         │ PROMOCIONES     │
│                 │         │                 │         │                 │
│ • Chat widget   │  ──────>│ • Motor recom   │ ──────>│ • Sistema promo │
│ • Claude API    │         │ • Historial     │         │ • Codigos desc  │
│ • Intent detect │         │ • Cross-sell    │         │ • Bundles       │
│ • Product search│         │ • Recompra      │         │ • Flash sales   │
└─────────────────┘         └─────────────────┘         └─────────────────┘


FASE 4: OPTIMIZACION
═══════════════════════════════════════════════════════════════════════════

  Semana 19-20                 Semana 21-22                 Semana 23-24
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ ANALYTICS       │         │ NOTIFICACIONES  │         │ LANZAMIENTO     │
│                 │         │                 │         │                 │
│ • GA4 eventos   │  ──────>│ • WhatsApp API  │ ──────>│ • QA final      │
│ • Dashboard     │         │ • Email market  │         │ • SEO           │
│ • Conversion    │         │ • Push notif    │         │ • Performance   │
│ • A/B testing   │         │ • Recordatorios │         │ • Go-live       │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## 9.2 Entregables por Fase

### FASE 1: Fundamentos (6 semanas)
- [ ] Monorepo configurado con pnpm workspaces
- [ ] Tipos compartidos extraidos
- [ ] Firebase Security Rules para web publica
- [ ] Pagina de catalogo con filtros
- [ ] Pagina de detalle de producto
- [ ] Carrito funcional con reserva de stock
- [ ] UI responsiva mobile-first

### FASE 2: Transacciones (6 semanas)
- [ ] Checkout de 3 pasos completo
- [ ] Integracion Culqi funcionando
- [ ] Pagos con Yape/Plin (QR)
- [ ] Emails transaccionales (SendGrid)
- [ ] Autenticacion de usuarios
- [ ] Portal "Mi Cuenta" basico
- [ ] Historial de pedidos

### FASE 3: Inteligencia (6 semanas)
- [ ] Widget de chat IA
- [ ] Integracion Claude API con tools
- [ ] Sistema de recomendaciones basico
- [ ] Recomendaciones por recompra
- [ ] Sistema de promociones
- [ ] Codigos de descuento

### FASE 4: Optimizacion (6 semanas)
- [ ] Tracking GA4 completo
- [ ] Dashboard de metricas
- [ ] Notificaciones WhatsApp
- [ ] Email marketing (Mailchimp)
- [ ] SEO on-page
- [ ] Performance optimization
- [ ] Lanzamiento produccion

---

# SECCION 10: ESTIMACION DE COSTOS

## 10.1 Costos de Desarrollo

| Concepto | Horas Est. | Tarifa/Hora | Total |
|----------|------------|-------------|-------|
| Arquitectura y Setup | 40h | $40 | $1,600 |
| Frontend Web (pages) | 120h | $35 | $4,200 |
| Backend Functions | 80h | $45 | $3,600 |
| Integracion Pagos | 40h | $45 | $1,800 |
| Agente IA | 60h | $50 | $3,000 |
| Recomendaciones | 40h | $45 | $1,800 |
| Testing y QA | 40h | $30 | $1,200 |
| DevOps y Deploy | 20h | $40 | $800 |
| **TOTAL DESARROLLO** | **440h** | - | **$18,000** |

## 10.2 Costos Operativos Mensuales

| Servicio | Plan | Costo/Mes |
|----------|------|-----------|
| Firebase (Blaze) | Pay-as-you-go | ~$50-150 |
| Claude API | Por uso | ~$30-100 |
| Culqi | Por transaccion | ~3.99% ventas |
| SendGrid | Free-25K | $0-20 |
| WhatsApp Business | Por mensaje | ~$50-100 |
| Dominio + SSL | Anual | ~$5 |
| **TOTAL MENSUAL** | - | **$135-375** |

## 10.3 ROI Esperado

### Escenario Conservador
- Inversion inicial: $18,000
- Costos mensuales: $250
- Ventas mensuales web: $5,000 (15% del total)
- Margen promedio: 30%
- Ganancia mensual: $1,500
- **Punto de equilibrio: ~14 meses**

### Escenario Optimista
- Ventas mensuales web: $15,000 (30% del total)
- Margen promedio: 35%
- Ganancia mensual: $5,250
- **Punto de equilibrio: ~4 meses**

---

# SECCION 11: SEGURIDAD Y CUMPLIMIENTO

## 11.1 Seguridad de Datos

### Firebase Security Rules (Web Publica)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Productos: lectura publica, escritura admin
    match /productos/{productoId} {
      allow read: if true;
      allow write: if request.auth != null &&
                      get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }

    // Carritos: usuario autenticado o sesion anonima
    match /carritos/{carritoId} {
      allow read, write: if request.auth != null &&
                            request.auth.uid == resource.data.usuarioId;
      allow create: if true; // Carritos anonimos
    }

    // Ventas: usuario puede ver las suyas
    match /ventas/{ventaId} {
      allow read: if request.auth != null &&
                    (request.auth.uid == resource.data.usuarioId ||
                     get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin');
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
                       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }

    // Clientes: admin only
    match /clientes/{clienteId} {
      allow read, write: if request.auth != null &&
                            get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }
  }
}
```

## 11.2 Cumplimiento Legal Peru

### Requisitos
- [ ] Terminos y Condiciones
- [ ] Politica de Privacidad (Ley 29733)
- [ ] Libro de Reclamaciones Virtual
- [ ] Politica de Devoluciones
- [ ] Facturacion Electronica (SUNAT)

---

# SECCION 12: METRICAS DE EXITO

## 12.1 KPIs Principales

| Metrica | Objetivo Inicial | Objetivo 6 meses |
|---------|-----------------|------------------|
| Tasa de conversion | 1.5% | 3% |
| Ticket promedio | S/150 | S/200 |
| Abandono carrito | <70% | <60% |
| NPS | >30 | >50 |
| Tiempo en sitio | >3 min | >5 min |
| Tasa rebote | <50% | <40% |
| Engagement chat IA | 10% | 25% |

## 12.2 Dashboard de Metricas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     DASHBOARD E-COMMERCE - METRICAS                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   VISITAS       │  │    VENTAS       │  │  CONVERSION     │  │   INGRESOS      │
│                 │  │                 │  │                 │  │                 │
│    15,234       │  │      456        │  │     2.99%       │  │   S/ 68,400     │
│    ↑ 12%        │  │    ↑ 23%        │  │    ↑ 0.5%       │  │    ↑ 18%        │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘

┌───────────────────────────────────────────┐  ┌───────────────────────────────┐
│         EMBUDO DE CONVERSION               │  │    TOP PRODUCTOS              │
│                                           │  │                               │
│  Visitas        ████████████████ 15,234   │  │  1. Aceite Oregano   S/8,990  │
│  Ver producto   ████████████     8,140    │  │  2. Omega 3          S/7,500  │
│  Agregar carrito████████         3,200    │  │  3. Vitamina D       S/5,500  │
│  Iniciar checkout████            890      │  │  4. Probioticos      S/4,450  │
│  Compra         ███              456      │  │  5. Zinc             S/3,200  │
│                                           │  │                               │
└───────────────────────────────────────────┘  └───────────────────────────────┘

┌───────────────────────────────────────────┐  ┌───────────────────────────────┐
│         CHAT IA - METRICAS                 │  │    SATISFACCION               │
│                                           │  │                               │
│  Conversaciones:     1,234                │  │       ⭐⭐⭐⭐⭐                │
│  Resueltas sin humano: 89%                │  │        4.7/5                  │
│  Productos recomendados: 3,456            │  │                               │
│  Agregados a carrito via chat: 23%        │  │  NPS: +45                     │
│  Tiempo promedio: 2.3 min                 │  │  Reseñas: 234                 │
│                                           │  │                               │
└───────────────────────────────────────────┘  └───────────────────────────────┘
```

---

# SECCION 13: CONCLUSION Y RECOMENDACIONES

## 13.1 Viabilidad Confirmada

El analisis exhaustivo confirma que **la integracion de una pagina web e-commerce es altamente viable** debido a:

### Fortalezas del Sistema Actual
1. **Datos ricos**: Modelos de producto, cliente, venta completamente desarrollados
2. **Logica de negocio**: Reserva de stock, cotizaciones, pagos ya implementados
3. **Analytics**: Sistema de competidores, RFM de clientes, inteligencia de precios
4. **Arquitectura**: React + Firebase permite expansion natural
5. **Infraestructura**: Firebase escala automaticamente

### Oportunidades Unicas
1. **Ventaja competitiva**: Reserva de stock REAL (no otros e-commerce)
2. **Personalizacion**: Datos RFM permiten experiencia unica por cliente
3. **Precios inteligentes**: Investigacion de mercado ya captura competencia
4. **Agente IA**: Datos existentes hacen posible asistente muy informado

## 13.2 Recomendaciones Estrategicas

### Prioridad ALTA
1. **Empezar por MVP**: Catalogo + Carrito + Checkout basico
2. **Reutilizar logica**: No reinventar reserva de stock, usar existente
3. **Mobile-first**: 70%+ del trafico sera movil

### Prioridad MEDIA
4. **Agente IA en Fase 2**: Despues de validar conversion basica
5. **WhatsApp primero**: Antes de email marketing (Peru = WhatsApp)
6. **Culqi como pasarela**: Mejor balance costo/funcionalidad

### Prioridad BAJA
7. **A/B testing**: Despues de trafico estable
8. **Integracion ML**: Si ya venden en MercadoLibre, considerar sync

## 13.3 Siguiente Paso Recomendado

**Crear un MVP en 8 semanas** que incluya:
- Catalogo web responsivo
- Carrito con reserva de stock
- Checkout con Culqi
- Portal "Mi Cuenta" basico

Este MVP validara la demanda antes de invertir en las fases avanzadas (IA, recomendaciones, promociones).

---

# ANEXOS

## A. Glosario Tecnico

| Termino | Definicion |
|---------|------------|
| CTRU | Costo Total Real Unitario (CMV en PEN) |
| RFM | Recency, Frequency, Monetary (segmentacion) |
| MVP | Minimum Viable Product |
| PWA | Progressive Web App |
| SSR | Server-Side Rendering |
| CSR | Client-Side Rendering |

## B. Referencias

- Firebase Documentation: https://firebase.google.com/docs
- Culqi API: https://docs.culqi.com
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
- Claude API: https://docs.anthropic.com
- Google Analytics 4: https://developers.google.com/analytics

---

**Documento preparado para BusinessMN - Enero 2026**

*Este estudio de viabilidad fue generado mediante analisis exhaustivo del codebase existente y mejores practicas de e-commerce.*
