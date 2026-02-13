# IMPLEMENTACION COMPLETA - PARTE 2: TIPOS Y SERVICIOS

---

# 4. TIPOS NUEVOS PARA WEB

## 4.1 carrito.types.ts

```typescript
import { Timestamp } from 'firebase/firestore';

// Estado del carrito
export type CartStatus = 'active' | 'abandoned' | 'converted' | 'expired';

// Item del carrito
export interface CartItem {
  id: string;
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
  unidadesReservadas?: string[];  // IDs de unidades bloqueadas

  // Promociones aplicadas
  descuentoAplicado?: number;
  promocionId?: string;
  precioOriginal?: number;

  // Metadata
  fechaAgregado: Timestamp;
}

// Carrito principal
export interface CarritoWeb {
  id: string;

  // Identificacion
  usuarioId?: string;           // Si esta logueado
  sessionId: string;            // Para anonimos

  // Items
  items: CartItem[];

  // Totales
  subtotal: number;
  descuentoTotal: number;
  costoEnvio: number;
  total: number;

  // Reserva de stock
  reservaActiva: boolean;
  vigenciaReserva: Timestamp;
  horasReserva: number;         // Default 48

  // Promociones
  codigoPromocion?: string;
  promocionAplicada?: {
    id: string;
    tipo: string;
    descuento: number;
  };

  // Estado
  status: CartStatus;

  // Metadata
  fechaCreacion: Timestamp;
  ultimaActualizacion: Timestamp;

  // Conversion
  ventaId?: string;             // Si se convirtio en venta
  fechaConversion?: Timestamp;

  // Analytics
  origen?: string;              // utm_source
  dispositivo?: 'mobile' | 'desktop' | 'tablet';
}

// Input para agregar al carrito
export interface AddToCartInput {
  productoId: string;
  cantidad: number;
  sessionId: string;
  usuarioId?: string;
}

// Respuesta de operaciones del carrito
export interface CartOperationResult {
  success: boolean;
  cart?: CarritoWeb;
  error?: string;
  stockInsuficiente?: boolean;
  cantidadDisponible?: number;
}
```

## 4.2 promocion.types.ts

```typescript
import { Timestamp } from 'firebase/firestore';

export type TipoPromocion =
  | 'porcentaje'      // 20% off
  | 'monto_fijo'      // S/20 off
  | '2x1'             // Lleva 2 paga 1
  | '3x2'             // Lleva 3 paga 2
  | 'envio_gratis'    // Envio gratis
  | 'bundle'          // Pack especial
  | 'regalo';         // Producto gratis

export type CondicionPromocion =
  | 'monto_minimo'    // Compra minima S/X
  | 'cantidad_minima' // Minimo X productos
  | 'producto_especifico'
  | 'categoria_especifica'
  | 'cliente_nuevo'
  | 'cliente_vip'
  | 'primera_compra'
  | 'codigo_requerido';

export interface Promocion {
  id: string;

  // Identificacion
  nombre: string;
  descripcion: string;
  codigo?: string;              // Codigo de descuento

  // Tipo
  tipo: TipoPromocion;

  // Valor del descuento
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  productoGratisId?: string;

  // Condiciones
  condiciones: {
    tipo: CondicionPromocion;
    valor: any;
  }[];

  // Aplicabilidad
  aplicaA: 'todo' | 'productos' | 'categorias';
  productosIds?: string[];
  categoriasIds?: string[];

  // Limites
  usosMaximos?: number;
  usosPorCliente?: number;
  usosActuales: number;

  // Vigencia
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  activa: boolean;

  // Visibilidad
  mostrarEnHome: boolean;
  mostrarBanner: boolean;
  bannerImagen?: string;

  // Segmentos objetivo
  segmentosObjetivo?: string[]; // vip, premium, etc

  // Metricas
  metricas: {
    impresiones: number;
    clicks: number;
    conversiones: number;
    ingresoGenerado: number;
  };

  // Metadata
  creadoPor: string;
  fechaCreacion: Timestamp;
}
```

## 4.3 ai-agent.types.ts

```typescript
import { Timestamp } from 'firebase/firestore';

// Tipos de acciones que puede sugerir el agente
export type AgentActionType =
  | 'add_to_cart'
  | 'view_product'
  | 'view_category'
  | 'compare_products'
  | 'checkout'
  | 'contact_human'
  | 'track_order';

// Producto mostrado en el chat
export interface ChatProduct {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  precio: number;
  precioOriginal?: number;
  imagen?: string;
  stockDisponible: number;
  badge?: string;
}

// Accion sugerida por el agente
export interface AgentAction {
  type: AgentActionType;
  label: string;
  productId?: string;
  categoryId?: string;
  url?: string;
}

// Mensaje en la conversacion
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
  products?: ChatProduct[];
  actions?: AgentAction[];
  isLoading?: boolean;
  error?: string;
}

// Conversacion completa
export interface AIConversation {
  id: string;
  usuarioId?: string;
  sessionId: string;
  messages: ChatMessage[];

  contexto: {
    paginaActual?: string;
    productoViendose?: string;
    carritoItems?: number;
    segmentoCliente?: string;
  };

  metricas: {
    productosRecomendados: number;
    productosAgregados: number;
    conversionACompra: boolean;
  };

  activa: boolean;
  fechaInicio: Timestamp;
  ultimaActividad: Timestamp;
}

// Input para enviar mensaje al agente
export interface SendMessageInput {
  conversationId?: string;
  message: string;
  sessionId: string;
  usuarioId?: string;
  contexto?: {
    paginaActual?: string;
    productoViendose?: string;
  };
}
```

## 4.4 checkout.types.ts

```typescript
import { Timestamp } from 'firebase/firestore';

export type CheckoutStep = 'contact' | 'shipping' | 'payment' | 'confirmation';

export interface ContactData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documento?: {
    tipo: 'dni' | 'ruc' | 'ce';
    numero: string;
  };
  aceptaTerminos: boolean;
  suscribirNewsletter: boolean;
}

export interface ShippingData {
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  codigoPostal?: string;
  referencia?: string;
  metodoEnvio: 'delivery' | 'recojo_tienda';
  costoEnvio: number;
  tiempoEstimado: string;
  instrucciones?: string;
}

export interface PaymentData {
  metodo: string;
  culqiToken?: string;
  comprobanteUrl?: string;
  numeroReferencia?: string;
}

export interface CheckoutState {
  step: CheckoutStep;
  carritoId: string;
  contact?: ContactData;
  shipping?: ShippingData;
  payment?: PaymentData;
  subtotal: number;
  descuentos: number;
  costoEnvio: number;
  total: number;
  promocion?: {
    codigo: string;
    descuento: number;
  };
  procesando: boolean;
  error?: string;
}

export interface CheckoutResult {
  success: boolean;
  ventaId?: string;
  numeroVenta?: string;
  error?: string;
  redirectUrl?: string;
  resumen?: {
    productos: number;
    total: number;
    metodoPago: string;
    tiempoEntrega: string;
  };
}
```

---

# 5. SERVICIOS NUEVOS PARA WEB

## 5.1 carrito.service.ts (Completo)

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  CarritoWeb,
  CartItem,
  AddToCartInput,
  CartOperationResult
} from '../types/carrito.types';

const COLLECTION = 'carritos_web';
const HORAS_RESERVA_DEFAULT = 48;

export class CarritoService {

  /**
   * Obtener carrito activo
   */
  static async getCarrito(
    sessionId: string,
    usuarioId?: string
  ): Promise<CarritoWeb | null> {
    try {
      // Buscar por usuario si esta logueado
      if (usuarioId) {
        const userQuery = query(
          collection(db, COLLECTION),
          where('usuarioId', '==', usuarioId),
          where('status', '==', 'active')
        );
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          return { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as CarritoWeb;
        }
      }

      // Buscar por sessionId
      const sessionQuery = query(
        collection(db, COLLECTION),
        where('sessionId', '==', sessionId),
        where('status', '==', 'active')
      );
      const sessionSnap = await getDocs(sessionQuery);

      if (!sessionSnap.empty) {
        const carrito = {
          id: sessionSnap.docs[0].id,
          ...sessionSnap.docs[0].data()
        } as CarritoWeb;

        // Vincular si ahora hay usuario
        if (usuarioId && !carrito.usuarioId) {
          await this.vincularCarritoAUsuario(carrito.id, usuarioId);
          carrito.usuarioId = usuarioId;
        }

        return carrito;
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo carrito:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo carrito
   */
  static async crearCarrito(
    sessionId: string,
    usuarioId?: string
  ): Promise<CarritoWeb> {
    const ahora = Timestamp.now();
    const vigencia = new Date();
    vigencia.setHours(vigencia.getHours() + HORAS_RESERVA_DEFAULT);

    const nuevoCarrito: Omit<CarritoWeb, 'id'> = {
      sessionId,
      usuarioId,
      items: [],
      subtotal: 0,
      descuentoTotal: 0,
      costoEnvio: 0,
      total: 0,
      reservaActiva: false,
      vigenciaReserva: Timestamp.fromDate(vigencia),
      horasReserva: HORAS_RESERVA_DEFAULT,
      status: 'active',
      fechaCreacion: ahora,
      ultimaActualizacion: ahora
    };

    const docRef = doc(collection(db, COLLECTION));
    await setDoc(docRef, nuevoCarrito);

    return { id: docRef.id, ...nuevoCarrito };
  }

  /**
   * Agregar producto al carrito con reserva de stock
   */
  static async agregarProducto(
    input: AddToCartInput
  ): Promise<CartOperationResult> {
    return await runTransaction(db, async (transaction) => {
      // 1. Obtener o crear carrito
      let carrito = await this.getCarrito(input.sessionId, input.usuarioId);
      if (!carrito) {
        carrito = await this.crearCarrito(input.sessionId, input.usuarioId);
      }

      // 2. Obtener producto
      const productoRef = doc(db, 'productos', input.productoId);
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists()) {
        return { success: false, error: 'Producto no encontrado' };
      }

      const producto = productoSnap.data();

      // 3. Verificar stock
      const stockReservado = producto.stockReservado || 0;
      const stockDisponible = (producto.stockDisponible || 0) - stockReservado;

      const itemExistente = carrito.items.find(
        item => item.productoId === input.productoId
      );
      const cantidadActual = itemExistente?.cantidad || 0;
      const cantidadTotal = cantidadActual + input.cantidad;

      if (cantidadTotal > stockDisponible + cantidadActual) {
        return {
          success: false,
          error: 'Stock insuficiente',
          stockInsuficiente: true,
          cantidadDisponible: stockDisponible
        };
      }

      // 4. Actualizar items
      let nuevosItems: CartItem[];

      if (itemExistente) {
        nuevosItems = carrito.items.map(item => {
          if (item.productoId === input.productoId) {
            return {
              ...item,
              cantidad: cantidadTotal,
              subtotal: cantidadTotal * item.precioUnitario
            };
          }
          return item;
        });
      } else {
        const nuevoItem: CartItem = {
          id: `item-${Date.now()}`,
          productoId: input.productoId,
          sku: producto.sku,
          nombre: producto.nombreComercial,
          marca: producto.marca,
          imagen: producto.imagenes?.[0],
          cantidad: input.cantidad,
          precioUnitario: producto.precioSugerido,
          subtotal: input.cantidad * producto.precioSugerido,
          stockDisponible: stockDisponible + cantidadActual,
          fechaAgregado: Timestamp.now()
        };
        nuevosItems = [...carrito.items, nuevoItem];
      }

      // 5. Recalcular totales
      const subtotal = nuevosItems.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal - (carrito.descuentoTotal || 0) + (carrito.costoEnvio || 0);

      // 6. Actualizar carrito
      const carritoRef = doc(db, COLLECTION, carrito.id);
      transaction.update(carritoRef, {
        items: nuevosItems,
        subtotal,
        total,
        reservaActiva: true,
        ultimaActualizacion: serverTimestamp()
      });

      // 7. Reservar stock
      transaction.update(productoRef, {
        stockReservado: stockReservado + input.cantidad
      });

      return {
        success: true,
        cart: { ...carrito, items: nuevosItems, subtotal, total }
      };
    });
  }

  /**
   * Actualizar cantidad de item
   */
  static async actualizarCantidad(
    carritoId: string,
    itemId: string,
    nuevaCantidad: number
  ): Promise<CartOperationResult> {
    if (nuevaCantidad <= 0) {
      return this.eliminarItem(carritoId, itemId);
    }

    return await runTransaction(db, async (transaction) => {
      const carritoRef = doc(db, COLLECTION, carritoId);
      const carritoSnap = await transaction.get(carritoRef);

      if (!carritoSnap.exists()) {
        return { success: false, error: 'Carrito no encontrado' };
      }

      const carrito = { id: carritoSnap.id, ...carritoSnap.data() } as CarritoWeb;
      const item = carrito.items.find(i => i.id === itemId);

      if (!item) {
        return { success: false, error: 'Item no encontrado' };
      }

      // Verificar stock
      const productoRef = doc(db, 'productos', item.productoId);
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists()) {
        return { success: false, error: 'Producto no encontrado' };
      }

      const producto = productoSnap.data();
      const diferencia = nuevaCantidad - item.cantidad;
      const stockReservadoActual = producto.stockReservado || 0;
      const stockDisponibleReal = (producto.stockDisponible || 0) - stockReservadoActual + item.cantidad;

      if (nuevaCantidad > stockDisponibleReal) {
        return {
          success: false,
          error: 'Stock insuficiente',
          stockInsuficiente: true,
          cantidadDisponible: stockDisponibleReal
        };
      }

      // Actualizar items
      const nuevosItems = carrito.items.map(i => {
        if (i.id === itemId) {
          return {
            ...i,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * i.precioUnitario
          };
        }
        return i;
      });

      const subtotal = nuevosItems.reduce((sum, i) => sum + i.subtotal, 0);
      const total = subtotal - carrito.descuentoTotal + carrito.costoEnvio;

      // Actualizar carrito
      transaction.update(carritoRef, {
        items: nuevosItems,
        subtotal,
        total,
        ultimaActualizacion: serverTimestamp()
      });

      // Actualizar reserva de stock
      transaction.update(productoRef, {
        stockReservado: stockReservadoActual + diferencia
      });

      return {
        success: true,
        cart: { ...carrito, items: nuevosItems, subtotal, total }
      };
    });
  }

  /**
   * Eliminar item del carrito
   */
  static async eliminarItem(
    carritoId: string,
    itemId: string
  ): Promise<CartOperationResult> {
    return await runTransaction(db, async (transaction) => {
      const carritoRef = doc(db, COLLECTION, carritoId);
      const carritoSnap = await transaction.get(carritoRef);

      if (!carritoSnap.exists()) {
        return { success: false, error: 'Carrito no encontrado' };
      }

      const carrito = { id: carritoSnap.id, ...carritoSnap.data() } as CarritoWeb;
      const item = carrito.items.find(i => i.id === itemId);

      if (!item) {
        return { success: false, error: 'Item no encontrado' };
      }

      const nuevosItems = carrito.items.filter(i => i.id !== itemId);
      const subtotal = nuevosItems.reduce((sum, i) => sum + i.subtotal, 0);
      const total = subtotal - carrito.descuentoTotal + carrito.costoEnvio;

      // Actualizar carrito
      transaction.update(carritoRef, {
        items: nuevosItems,
        subtotal,
        total,
        reservaActiva: nuevosItems.length > 0,
        ultimaActualizacion: serverTimestamp()
      });

      // Liberar stock reservado
      const productoRef = doc(db, 'productos', item.productoId);
      const productoSnap = await transaction.get(productoRef);

      if (productoSnap.exists()) {
        const stockReservado = productoSnap.data().stockReservado || 0;
        transaction.update(productoRef, {
          stockReservado: Math.max(0, stockReservado - item.cantidad)
        });
      }

      return {
        success: true,
        cart: { ...carrito, items: nuevosItems, subtotal, total }
      };
    });
  }

  /**
   * Vincular carrito a usuario
   */
  static async vincularCarritoAUsuario(
    carritoId: string,
    usuarioId: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION, carritoId), {
      usuarioId,
      ultimaActualizacion: serverTimestamp()
    });
  }

  /**
   * Convertir carrito a venta (llamar al completar checkout)
   */
  static async convertirAVenta(
    carritoId: string,
    ventaId: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION, carritoId), {
      status: 'converted',
      ventaId,
      fechaConversion: serverTimestamp()
    });
  }

  /**
   * Obtener tiempo restante de reserva
   */
  static getTiempoRestante(carrito: CarritoWeb): {
    horas: number;
    minutos: number;
    expirado: boolean;
  } {
    const ahora = new Date();
    const vigencia = carrito.vigenciaReserva.toDate();
    const diff = vigencia.getTime() - ahora.getTime();

    if (diff <= 0) {
      return { horas: 0, minutos: 0, expirado: true };
    }

    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { horas, minutos, expirado: false };
  }
}
```

## 5.2 checkout.service.ts

```typescript
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  CheckoutState,
  CheckoutResult,
  ContactData,
  ShippingData,
  PaymentData
} from '../types/checkout.types';
import type { CarritoWeb } from '../types/carrito.types';
import { CarritoService } from './carrito.service';
import { VentaService } from './venta.service';
import { ClienteService } from './cliente.service';

export class CheckoutService {

  /**
   * Iniciar proceso de checkout
   */
  static async iniciarCheckout(carritoId: string): Promise<CheckoutState> {
    const carritoRef = doc(db, 'carritos_web', carritoId);
    const carritoSnap = await getDoc(carritoRef);

    if (!carritoSnap.exists()) {
      throw new Error('Carrito no encontrado');
    }

    const carrito = carritoSnap.data() as CarritoWeb;

    // Verificar que el carrito tiene items
    if (!carrito.items || carrito.items.length === 0) {
      throw new Error('El carrito esta vacio');
    }

    // Verificar reserva activa
    const tiempoRestante = CarritoService.getTiempoRestante(carrito as any);
    if (tiempoRestante.expirado) {
      throw new Error('La reserva de stock ha expirado');
    }

    return {
      step: 'contact',
      carritoId,
      subtotal: carrito.subtotal,
      descuentos: carrito.descuentoTotal,
      costoEnvio: 0,
      total: carrito.total,
      procesando: false
    };
  }

  /**
   * Guardar datos de contacto
   */
  static async guardarContacto(
    carritoId: string,
    contact: ContactData
  ): Promise<CheckoutState> {
    await updateDoc(doc(db, 'carritos_web', carritoId), {
      'checkoutData.contact': contact,
      ultimaActualizacion: serverTimestamp()
    });

    const carritoSnap = await getDoc(doc(db, 'carritos_web', carritoId));
    const carrito = carritoSnap.data() as CarritoWeb;

    return {
      step: 'shipping',
      carritoId,
      contact,
      subtotal: carrito.subtotal,
      descuentos: carrito.descuentoTotal,
      costoEnvio: 0,
      total: carrito.total,
      procesando: false
    };
  }

  /**
   * Guardar datos de envio y calcular costo
   */
  static async guardarEnvio(
    carritoId: string,
    shipping: ShippingData
  ): Promise<CheckoutState> {
    // Calcular costo de envio basado en distrito
    const costoEnvio = this.calcularCostoEnvio(shipping);
    shipping.costoEnvio = costoEnvio;

    await updateDoc(doc(db, 'carritos_web', carritoId), {
      'checkoutData.shipping': shipping,
      costoEnvio,
      ultimaActualizacion: serverTimestamp()
    });

    const carritoSnap = await getDoc(doc(db, 'carritos_web', carritoId));
    const carrito = carritoSnap.data() as CarritoWeb;
    const checkoutData = (carrito as any).checkoutData || {};

    const total = carrito.subtotal - carrito.descuentoTotal + costoEnvio;

    return {
      step: 'payment',
      carritoId,
      contact: checkoutData.contact,
      shipping,
      subtotal: carrito.subtotal,
      descuentos: carrito.descuentoTotal,
      costoEnvio,
      total,
      procesando: false
    };
  }

  /**
   * Calcular costo de envio
   */
  private static calcularCostoEnvio(shipping: ShippingData): number {
    if (shipping.metodoEnvio === 'recojo_tienda') {
      return 0;
    }

    // Distritos de Lima con delivery gratuito
    const distritosGratis = [
      'miraflores', 'san isidro', 'surco', 'la molina',
      'san borja', 'barranco', 'magdalena'
    ];

    const distritoNormalizado = shipping.distrito.toLowerCase();

    if (distritosGratis.includes(distritoNormalizado)) {
      return 9.90;  // Delivery estandar Lima
    }

    // Lima metropolitana
    if (shipping.departamento.toLowerCase() === 'lima') {
      return 14.90;
    }

    // Provincias
    return 24.90;
  }

  /**
   * Procesar pago y completar orden
   */
  static async procesarPago(
    carritoId: string,
    payment: PaymentData
  ): Promise<CheckoutResult> {
    try {
      return await runTransaction(db, async (transaction) => {
        // 1. Obtener carrito con datos de checkout
        const carritoRef = doc(db, 'carritos_web', carritoId);
        const carritoSnap = await transaction.get(carritoRef);

        if (!carritoSnap.exists()) {
          return { success: false, error: 'Carrito no encontrado' };
        }

        const carrito = carritoSnap.data() as CarritoWeb & {
          checkoutData?: { contact?: ContactData; shipping?: ShippingData }
        };
        const checkoutData = carrito.checkoutData;

        if (!checkoutData?.contact || !checkoutData?.shipping) {
          return { success: false, error: 'Datos de checkout incompletos' };
        }

        // 2. Verificar stock nuevamente
        for (const item of carrito.items) {
          const productoRef = doc(db, 'productos', item.productoId);
          const productoSnap = await transaction.get(productoRef);

          if (!productoSnap.exists()) {
            return { success: false, error: `Producto ${item.sku} no encontrado` };
          }

          const producto = productoSnap.data();
          if ((producto.stockDisponible || 0) < item.cantidad) {
            return {
              success: false,
              error: `Stock insuficiente para ${item.nombre}`
            };
          }
        }

        // 3. Crear o actualizar cliente
        let clienteId: string;

        const clienteExistente = await ClienteService.buscarPorEmail(
          checkoutData.contact.email
        );

        if (clienteExistente) {
          clienteId = clienteExistente.id;
        } else {
          const nuevoCliente = await ClienteService.create({
            nombre: `${checkoutData.contact.nombre} ${checkoutData.contact.apellido}`,
            email: checkoutData.contact.email,
            telefono: checkoutData.contact.telefono,
            documento: checkoutData.contact.documento,
            direcciones: [{
              etiqueta: 'Principal',
              ...checkoutData.shipping
            }],
            origen: 'web'
          }, 'sistema');

          clienteId = nuevoCliente.id;
        }

        // 4. Crear venta en el ERP
        const ventaData = {
          clienteId,
          canal: 'web',
          productos: carrito.items.map(item => ({
            productoId: item.productoId,
            sku: item.sku,
            nombreComercial: item.nombre,
            marca: item.marca,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal
          })),
          subtotalPEN: carrito.subtotal,
          descuentoPEN: carrito.descuentoTotal,
          costoEnvioPEN: carrito.costoEnvio,
          totalPEN: carrito.total,
          metodoPago: payment.metodo,
          datosEnvio: checkoutData.shipping,
          datosContacto: checkoutData.contact,
          estado: 'confirmada',
          fechaVenta: Timestamp.now()
        };

        const venta = await VentaService.create(ventaData, 'sistema');

        // 5. Actualizar stock (descontar del disponible, ya esta reservado)
        for (const item of carrito.items) {
          const productoRef = doc(db, 'productos', item.productoId);
          const productoSnap = await transaction.get(productoRef);
          const producto = productoSnap.data()!;

          transaction.update(productoRef, {
            stockDisponible: (producto.stockDisponible || 0) - item.cantidad,
            stockReservado: Math.max(0, (producto.stockReservado || 0) - item.cantidad)
          });
        }

        // 6. Marcar carrito como convertido
        transaction.update(carritoRef, {
          status: 'converted',
          ventaId: venta.id,
          fechaConversion: serverTimestamp()
        });

        // 7. Registrar pago si es necesario
        if (payment.metodo === 'tarjeta' && payment.culqiToken) {
          // Procesar con Culqi (ver integracion de pagos)
        }

        return {
          success: true,
          ventaId: venta.id,
          numeroVenta: venta.numeroVenta,
          resumen: {
            productos: carrito.items.length,
            total: carrito.total,
            metodoPago: payment.metodo,
            tiempoEntrega: checkoutData.shipping.tiempoEstimado
          }
        };
      });
    } catch (error) {
      console.error('Error procesando checkout:', error);
      return {
        success: false,
        error: 'Error al procesar el pedido'
      };
    }
  }
}
```

## 5.3 promocion.service.ts

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Promocion, TipoPromocion } from '../types/promocion.types';
import type { CarritoWeb } from '../types/carrito.types';

const COLLECTION = 'promociones';

export class PromocionService {

  /**
   * Obtener promociones activas
   */
  static async getPromocionesActivas(): Promise<Promocion[]> {
    const ahora = Timestamp.now();

    const q = query(
      collection(db, COLLECTION),
      where('activa', '==', true),
      where('fechaInicio', '<=', ahora),
      where('fechaFin', '>=', ahora)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Promocion));
  }

  /**
   * Obtener promociones para home (banners)
   */
  static async getPromocionesHome(): Promise<Promocion[]> {
    const activas = await this.getPromocionesActivas();
    return activas.filter(p => p.mostrarEnHome);
  }

  /**
   * Validar y aplicar codigo de promocion
   */
  static async aplicarCodigo(
    codigo: string,
    carrito: CarritoWeb,
    usuarioId?: string
  ): Promise<{
    valido: boolean;
    promocion?: Promocion;
    descuento?: number;
    error?: string;
  }> {
    // 1. Buscar promocion por codigo
    const q = query(
      collection(db, COLLECTION),
      where('codigo', '==', codigo.toUpperCase()),
      where('activa', '==', true)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      return { valido: false, error: 'Codigo de promocion no valido' };
    }

    const promocion = { id: snap.docs[0].id, ...snap.docs[0].data() } as Promocion;

    // 2. Verificar vigencia
    const ahora = Timestamp.now();
    if (promocion.fechaInicio > ahora || promocion.fechaFin < ahora) {
      return { valido: false, error: 'Promocion expirada' };
    }

    // 3. Verificar usos maximos
    if (promocion.usosMaximos && promocion.usosActuales >= promocion.usosMaximos) {
      return { valido: false, error: 'Promocion agotada' };
    }

    // 4. Verificar condiciones
    for (const condicion of promocion.condiciones) {
      const cumple = await this.verificarCondicion(condicion, carrito, usuarioId);
      if (!cumple.valido) {
        return { valido: false, error: cumple.error };
      }
    }

    // 5. Calcular descuento
    const descuento = this.calcularDescuento(promocion, carrito);

    return { valido: true, promocion, descuento };
  }

  /**
   * Verificar condicion de promocion
   */
  private static async verificarCondicion(
    condicion: { tipo: string; valor: any },
    carrito: CarritoWeb,
    usuarioId?: string
  ): Promise<{ valido: boolean; error?: string }> {
    switch (condicion.tipo) {
      case 'monto_minimo':
        if (carrito.subtotal < condicion.valor) {
          return {
            valido: false,
            error: `Compra minima de S/${condicion.valor} requerida`
          };
        }
        break;

      case 'cantidad_minima':
        const cantidadTotal = carrito.items.reduce((sum, i) => sum + i.cantidad, 0);
        if (cantidadTotal < condicion.valor) {
          return {
            valido: false,
            error: `Minimo ${condicion.valor} productos requeridos`
          };
        }
        break;

      case 'producto_especifico':
        const tieneProducto = carrito.items.some(
          i => condicion.valor.includes(i.productoId)
        );
        if (!tieneProducto) {
          return {
            valido: false,
            error: 'Esta promocion es para productos especificos'
          };
        }
        break;

      case 'cliente_nuevo':
        // Verificar si el usuario ha comprado antes
        if (usuarioId) {
          // Logica para verificar historial
        }
        break;
    }

    return { valido: true };
  }

  /**
   * Calcular descuento segun tipo de promocion
   */
  private static calcularDescuento(
    promocion: Promocion,
    carrito: CarritoWeb
  ): number {
    switch (promocion.tipo) {
      case 'porcentaje':
        return carrito.subtotal * (promocion.descuentoPorcentaje! / 100);

      case 'monto_fijo':
        return Math.min(promocion.descuentoMonto!, carrito.subtotal);

      case '2x1':
        // El producto mas barato es gratis
        const precios = carrito.items
          .flatMap(i => Array(i.cantidad).fill(i.precioUnitario))
          .sort((a, b) => a - b);
        const productosGratis = Math.floor(precios.length / 2);
        return precios.slice(0, productosGratis).reduce((sum, p) => sum + p, 0);

      case '3x2':
        const precios3x2 = carrito.items
          .flatMap(i => Array(i.cantidad).fill(i.precioUnitario))
          .sort((a, b) => a - b);
        const gratis3x2 = Math.floor(precios3x2.length / 3);
        return precios3x2.slice(0, gratis3x2).reduce((sum, p) => sum + p, 0);

      case 'envio_gratis':
        return carrito.costoEnvio;

      default:
        return 0;
    }
  }

  /**
   * Registrar uso de promocion
   */
  static async registrarUso(promocionId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, promocionId), {
      usosActuales: increment(1),
      'metricas.conversiones': increment(1)
    });
  }

  /**
   * Registrar impresion de promocion
   */
  static async registrarImpresion(promocionId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, promocionId), {
      'metricas.impresiones': increment(1)
    });
  }
}
```
