# IMPLEMENTACION COMPLETA - PARTE 4: COMPONENTES, PAGOS Y DESPLIEGUE

---

# 8. COMPONENTES REACT CLAVE PARA WEB

## 8.1 ChatWidget - Agente IA

```tsx
// packages/web/src/components/ai-chat/ChatWidget.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { ChatWindow } from './ChatWindow';
import { useChatStore } from '../../store/chatStore';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { unreadCount } = useChatStore();

  return (
    <>
      {/* Boton flotante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-purple-600
                       text-white rounded-full shadow-lg hover:bg-purple-700
                       transition-colors flex items-center justify-center z-50"
          >
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500
                              rounded-full text-xs flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Ventana de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 60 : 500
            }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl
                       shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Asistente BMN</h3>
                  <p className="text-xs text-purple-200">En linea</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-purple-500 rounded"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-purple-500 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat window */}
            {!isMinimized && <ChatWindow />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

```tsx
// packages/web/src/components/ai-chat/ChatWindow.tsx

import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSuggestions } from './ChatSuggestions';
import { useChatStore } from '../../store/chatStore';
import { useAIChat } from '../../hooks/useAIChat';

export function ChatWindow() {
  const { messages, isLoading } = useChatStore();
  const { sendMessage } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al ultimo mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <div className="flex flex-col h-[440px]">
      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Hola! Soy tu asistente de compras. En que puedo ayudarte?
            </p>
            <ChatSuggestions onSelect={handleSend} />
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onProductClick={(productId) => {
                // Navegar a producto o agregar al carrito
              }}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
            </div>
            <span className="text-sm">Escribiendo...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

```tsx
// packages/web/src/components/ai-chat/ChatMessage.tsx

import { motion } from 'framer-motion';
import type { ChatMessage as ChatMessageType } from '@bmn/shared/types/ai-agent.types';
import { ChatProductCard } from './ChatProductCard';

interface Props {
  message: ChatMessageType;
  onProductClick?: (productId: string) => void;
}

export function ChatMessage({ message, onProductClick }: Props) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Burbuja del mensaje */}
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? 'bg-purple-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Productos recomendados */}
        {message.products && message.products.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.products.map((product) => (
              <ChatProductCard
                key={product.id}
                product={product}
                onAddToCart={() => onProductClick?.(product.id)}
              />
            ))}
          </div>
        )}

        {/* Acciones sugeridas */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (action.type === 'add_to_cart' && action.productId) {
                    onProductClick?.(action.productId);
                  }
                }}
                className="text-xs bg-purple-100 text-purple-700 px-3 py-1
                           rounded-full hover:bg-purple-200 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp?.toDate?.()?.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </motion.div>
  );
}
```

## 8.2 ProductCard - Tarjeta de Producto

```tsx
// packages/web/src/components/producto/ProductCard.tsx

import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Producto } from '@bmn/shared/types/producto.types';
import { ProductBadge } from './ProductBadge';
import { ProductPrice } from './ProductPrice';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';

interface Props {
  producto: Producto;
}

export function ProductCard({ producto }: Props) {
  const { addToCart, isAdding } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  const stockDisponible = producto.stockDisponible - (producto.stockReservado || 0);
  const agotado = stockDisponible <= 0;

  // Determinar badges
  const badges: string[] = [];
  if (stockDisponible > 0 && stockDisponible <= 5) {
    badges.push(`Ultimas ${stockDisponible}!`);
  }
  if (producto.investigacion?.estaVigente) {
    const inv = producto.investigacion;
    if (producto.precioSugerido < (inv.precioPERUMin || 0)) {
      badges.push('Mejor precio');
    }
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!agotado) {
      await addToCart(producto.id, 1);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(producto.id);
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group bg-white rounded-xl shadow-sm hover:shadow-lg
                 transition-shadow overflow-hidden"
    >
      <Link to={`/producto/${producto.sku}`}>
        {/* Imagen */}
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {producto.imagenes?.[0] ? (
            <img
              src={producto.imagenes[0]}
              alt={producto.nombreComercial}
              className="w-full h-full object-contain p-4
                         group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Sin imagen
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {badges.map((badge, idx) => (
              <ProductBadge key={idx} text={badge} />
            ))}
          </div>

          {/* Quick actions */}
          <div className="absolute top-2 right-2 flex flex-col gap-2
                          opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-full shadow-md transition-colors ${
                isFavorite(producto.id)
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Heart className="w-4 h-4" fill={isFavorite(producto.id) ? 'currentColor' : 'none'} />
            </button>
            <Link
              to={`/producto/${producto.sku}`}
              className="p-2 bg-white rounded-full shadow-md text-gray-600 hover:bg-gray-100"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>

          {/* Overlay si agotado */}
          {agotado && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-gray-800 px-4 py-2 rounded-full font-medium">
                Agotado
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          {/* Marca */}
          <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">
            {producto.marca}
          </p>

          {/* Nombre */}
          <h3 className="font-medium text-gray-900 mt-1 line-clamp-2 min-h-[48px]">
            {producto.nombreComercial}
          </h3>

          {/* Presentacion */}
          <p className="text-sm text-gray-500 mt-1">
            {producto.presentacion} {producto.contenido}
          </p>

          {/* Precio */}
          <ProductPrice
            precio={producto.precioSugerido}
            precioOriginal={producto.investigacion?.precioPERUPromedio}
            className="mt-3"
          />

          {/* Boton agregar */}
          <button
            onClick={handleAddToCart}
            disabled={agotado || isAdding}
            className={`w-full mt-3 py-2.5 rounded-lg font-medium text-sm
                       flex items-center justify-center gap-2 transition-colors ${
              agotado
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            {isAdding ? 'Agregando...' : agotado ? 'Agotado' : 'Agregar al carrito'}
          </button>
        </div>
      </Link>
    </motion.div>
  );
}
```

## 8.3 CartSidebar - Carrito Lateral

```tsx
// packages/web/src/components/carrito/CartSidebar.tsx

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, ShoppingBag, Trash2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CartItem } from './CartItem';
import { CartTimer } from './CartTimer';
import { useCartStore } from '../../store/cartStore';
import { formatCurrency } from '@bmn/shared/utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CartSidebar({ isOpen, onClose }: Props) {
  const { cart, isLoading } = useCartStore();

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        {/* Sidebar */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-4 border-b">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5" />
                        Tu Carrito
                        {cart && cart.items.length > 0 && (
                          <span className="bg-purple-100 text-purple-700 text-sm px-2 py-0.5 rounded-full">
                            {cart.items.length}
                          </span>
                        )}
                      </Dialog.Title>
                      <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Timer de reserva */}
                    {cart && cart.reservaActiva && (
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                        <CartTimer vigenciaReserva={cart.vigenciaReserva} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                      {isEmpty ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                          <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Tu carrito esta vacio
                          </h3>
                          <p className="text-gray-500 mb-6">
                            Agrega productos para comenzar tu compra
                          </p>
                          <Link
                            to="/catalogo"
                            onClick={onClose}
                            className="bg-purple-600 text-white px-6 py-2 rounded-lg
                                     hover:bg-purple-700 transition-colors"
                          >
                            Ver catalogo
                          </Link>
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {cart!.items.map((item) => (
                            <CartItem key={item.id} item={item} />
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Footer con totales */}
                    {!isEmpty && cart && (
                      <div className="border-t px-4 py-4 space-y-4">
                        {/* Subtotales */}
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>{formatCurrency(cart.subtotal)}</span>
                          </div>
                          {cart.descuentoTotal > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Descuento</span>
                              <span>-{formatCurrency(cart.descuentoTotal)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-600">
                            <span>Envio</span>
                            <span>
                              {cart.costoEnvio > 0
                                ? formatCurrency(cart.costoEnvio)
                                : 'Calculado en checkout'}
                            </span>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between text-lg font-semibold border-t pt-4">
                          <span>Total</span>
                          <span className="text-purple-600">{formatCurrency(cart.total)}</span>
                        </div>

                        {/* Stock reservado info */}
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                          <Clock className="w-4 h-4" />
                          <span>Tu stock esta reservado. No lo pierdas!</span>
                        </div>

                        {/* Botones */}
                        <div className="space-y-2">
                          <Link
                            to="/checkout"
                            onClick={onClose}
                            className="block w-full bg-purple-600 text-white text-center py-3
                                     rounded-lg font-medium hover:bg-purple-700 transition-colors"
                          >
                            Ir a pagar
                          </Link>
                          <button
                            onClick={onClose}
                            className="block w-full text-purple-600 text-center py-2
                                     hover:underline"
                          >
                            Seguir comprando
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
```

## 8.4 CheckoutStepper - Proceso de Checkout

```tsx
// packages/web/src/components/checkout/CheckoutStepper.tsx

import { Check } from 'lucide-react';
import type { CheckoutStep } from '@bmn/shared/types/checkout.types';

interface Props {
  currentStep: CheckoutStep;
}

const steps = [
  { id: 'contact', name: 'Contacto' },
  { id: 'shipping', name: 'Envio' },
  { id: 'payment', name: 'Pago' }
];

export function CheckoutStepper({ currentStep }: Props) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.id === currentStep;

          return (
            <li
              key={step.id}
              className={`relative ${index !== steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="flex items-center">
                {/* Circulo del paso */}
                <div
                  className={`relative flex h-10 w-10 items-center justify-center
                             rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-purple-600 bg-purple-600'
                      : isCurrent
                      ? 'border-purple-600 bg-white'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <span
                      className={`text-sm font-medium ${
                        isCurrent ? 'text-purple-600' : 'text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Linea conectora */}
                {index !== steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 ${
                      isCompleted ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>

              {/* Nombre del paso */}
              <p
                className={`absolute -bottom-6 left-0 text-sm font-medium ${
                  isCompleted || isCurrent ? 'text-purple-600' : 'text-gray-500'
                }`}
              >
                {step.name}
              </p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

---

# 9. INTEGRACION DE PAGOS

## 9.1 Integracion Culqi

```typescript
// packages/functions/src/payments/culqi.ts

import Culqi from 'culqi-node';
import * as functions from 'firebase-functions';

const culqi = new Culqi({
  privateKey: process.env.CULQI_PRIVATE_KEY!
});

export interface CulqiChargeParams {
  token: string;
  amount: number;          // En centimos (S/100.00 = 10000)
  email: string;
  orderId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CulqiChargeResult {
  success: boolean;
  chargeId?: string;
  error?: string;
  errorCode?: string;
}

export async function createCharge(params: CulqiChargeParams): Promise<CulqiChargeResult> {
  const { token, amount, email, orderId, description, metadata } = params;

  try {
    const charge = await culqi.charges.create({
      amount,
      currency_code: 'PEN',
      email,
      source_id: token,
      description: description || `Orden ${orderId}`,
      antifraud_details: {
        address: metadata?.direccion,
        address_city: metadata?.ciudad,
        country_code: 'PE',
        first_name: metadata?.nombre,
        last_name: metadata?.apellido,
        phone_number: metadata?.telefono
      },
      metadata: {
        order_id: orderId,
        ...metadata
      }
    });

    if (charge.outcome?.type === 'venta_exitosa') {
      return {
        success: true,
        chargeId: charge.id
      };
    }

    return {
      success: false,
      error: charge.outcome?.user_message || 'Error en el pago',
      errorCode: charge.outcome?.code
    };

  } catch (error: any) {
    console.error('Error Culqi:', error);

    // Errores comunes de Culqi
    const errorMessages: Record<string, string> = {
      'invalid_token': 'Token de tarjeta invalido',
      'card_declined': 'Tarjeta rechazada',
      'insufficient_funds': 'Fondos insuficientes',
      'stolen_card': 'Tarjeta reportada como robada',
      'lost_card': 'Tarjeta reportada como perdida',
      'expired_card': 'Tarjeta expirada',
      'processing_error': 'Error de procesamiento'
    };

    return {
      success: false,
      error: errorMessages[error.code] || error.user_message || 'Error procesando el pago',
      errorCode: error.code
    };
  }
}

// Webhook para eventos de Culqi
export const culqiWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const event = req.body;

  try {
    switch (event.type) {
      case 'charge.creation.succeeded':
        // Pago exitoso - ya manejado en el flujo normal
        console.log('Pago exitoso:', event.data.id);
        break;

      case 'charge.creation.failed':
        // Pago fallido
        console.log('Pago fallido:', event.data.id);
        break;

      case 'refund.creation.succeeded':
        // Reembolso procesado
        console.log('Reembolso exitoso:', event.data.id);
        // Actualizar estado de la venta
        break;

      default:
        console.log('Evento no manejado:', event.type);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook Culqi:', error);
    res.status(500).send('Error');
  }
});
```

## 9.2 Componente de Pago con Culqi

```tsx
// packages/web/src/components/checkout/CulqiCheckout.tsx

import { useEffect, useState } from 'react';
import { CreditCard, Lock } from 'lucide-react';

interface Props {
  amount: number;
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    Culqi: any;
    culqi: () => void;
  }
}

export function CulqiCheckout({ amount, onSuccess, onError }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Cargar script de Culqi
    const script = document.createElement('script');
    script.src = 'https://checkout.culqi.com/js/v4';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.Culqi.publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY;
      window.Culqi.settings({
        title: 'BMN Suplementos',
        currency: 'PEN',
        amount: Math.round(amount * 100), // Centimos
        order: `order-${Date.now()}`
      });

      window.Culqi.options({
        lang: 'es',
        installments: false,
        paymentMethods: {
          tarjeta: true,
          yape: true
        }
      });

      // Callback de Culqi
      window.culqi = function() {
        if (window.Culqi.token) {
          onSuccess(window.Culqi.token.id);
        } else if (window.Culqi.error) {
          onError(window.Culqi.error.user_message);
        }
        setIsLoading(false);
      };
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [amount]);

  const handlePay = () => {
    setIsLoading(true);
    window.Culqi.open();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handlePay}
        disabled={isLoading}
        className="w-full bg-purple-600 text-white py-4 rounded-lg font-medium
                   hover:bg-purple-700 transition-colors flex items-center
                   justify-center gap-3 disabled:opacity-50"
      >
        <CreditCard className="w-5 h-5" />
        {isLoading ? 'Procesando...' : `Pagar S/${amount.toFixed(2)}`}
      </button>

      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <Lock className="w-4 h-4" />
        <span>Pago seguro procesado por Culqi</span>
      </div>

      {/* Logos de tarjetas */}
      <div className="flex items-center justify-center gap-4">
        <img src="/images/visa.svg" alt="Visa" className="h-6" />
        <img src="/images/mastercard.svg" alt="Mastercard" className="h-6" />
        <img src="/images/amex.svg" alt="Amex" className="h-6" />
        <img src="/images/yape.svg" alt="Yape" className="h-6" />
      </div>
    </div>
  );
}
```

---

# 10. FIREBASE SECURITY RULES

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Funciones auxiliares
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // ============================================
    // PRODUCTOS - Lectura publica, escritura admin
    // ============================================
    match /productos/{productoId} {
      // Cualquiera puede leer productos activos
      allow read: if resource.data.estado == 'activo' || isAdmin();

      // Solo admin puede escribir
      allow write: if isAdmin();
    }

    // ============================================
    // CATEGORIAS, ETIQUETAS, TIPOS - Lectura publica
    // ============================================
    match /categorias/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /etiquetas/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /tiposProducto/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /marcas/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ============================================
    // CARRITOS WEB - Usuario puede acceder al suyo
    // ============================================
    match /carritos_web/{carritoId} {
      // Leer: usuario autenticado (su carrito) o por sessionId
      allow read: if isAuthenticated() && resource.data.usuarioId == request.auth.uid;

      // Crear: cualquiera (para carritos anonimos)
      allow create: if true;

      // Actualizar: usuario dueno o sesion correcta
      allow update: if (isAuthenticated() && resource.data.usuarioId == request.auth.uid)
                    || resource.data.sessionId == request.resource.data.sessionId;

      // Eliminar: solo admin
      allow delete: if isAdmin();
    }

    // ============================================
    // VENTAS - Usuario ve las suyas, admin todas
    // ============================================
    match /ventas/{ventaId} {
      // Leer: usuario dueno o admin
      allow read: if isAdmin()
                  || (isAuthenticated() && resource.data.clienteId == request.auth.uid);

      // Crear: sistema o admin (via Functions)
      allow create: if isAdmin();

      // Actualizar: solo admin
      allow update: if isAdmin();

      // Eliminar: nadie (soft delete)
      allow delete: if false;
    }

    // ============================================
    // CLIENTES - Usuario ve el suyo, admin todos
    // ============================================
    match /clientes/{clienteId} {
      allow read: if isAdmin() || isOwner(clienteId);
      allow create: if isAdmin() || isAuthenticated();
      allow update: if isAdmin() || isOwner(clienteId);
      allow delete: if isAdmin();
    }

    // ============================================
    // CONVERSACIONES IA - Usuario ve las suyas
    // ============================================
    match /conversaciones_ia/{convId} {
      allow read: if isAuthenticated() && resource.data.usuarioId == request.auth.uid;
      allow create: if true;  // Permitir crear para anonimos
      allow update: if (isAuthenticated() && resource.data.usuarioId == request.auth.uid)
                    || resource.data.sessionId == request.resource.data.sessionId;
      allow delete: if isAdmin();
    }

    // ============================================
    // PROMOCIONES - Lectura publica activas
    // ============================================
    match /promociones/{promoId} {
      allow read: if resource.data.activa == true || isAdmin();
      allow write: if isAdmin();
    }

    // ============================================
    // FAVORITOS - Usuario dueno
    // ============================================
    match /favoritos/{favId} {
      allow read, write: if isAuthenticated() && resource.data.usuarioId == request.auth.uid;
      allow create: if isAuthenticated();
    }

    // ============================================
    // DIRECCIONES GUARDADAS - Usuario dueno
    // ============================================
    match /direcciones/{dirId} {
      allow read, write: if isAuthenticated() && resource.data.usuarioId == request.auth.uid;
      allow create: if isAuthenticated();
    }

    // ============================================
    // SESIONES WEB - Sistema
    // ============================================
    match /sesiones_web/{sessionId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if isAdmin();
    }

    // ============================================
    // COLECCIONES ADMIN-ONLY
    // ============================================
    match /competidores/{docId} {
      allow read, write: if isAdmin();
    }

    match /proveedores/{docId} {
      allow read, write: if isAdmin();
    }

    match /ordenesCompra/{docId} {
      allow read, write: if isAdmin();
    }

    match /gastos/{docId} {
      allow read, write: if isAdmin();
    }

    match /tesoreria/{docId} {
      allow read, write: if isAdmin();
    }

    match /usuarios/{userId} {
      allow read: if isAdmin() || isOwner(userId);
      allow write: if isAdmin();
    }

    match /auditoria/{docId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

---

# 11. CONFIGURACION DE FIREBASE HOSTING

```json
// firebase.json

{
  "hosting": [
    {
      "target": "admin",
      "public": "packages/admin/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        }
      ]
    },
    {
      "target": "web",
      "public": "packages/web/dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "/api/**",
          "function": "api"
        },
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        },
        {
          "source": "**",
          "headers": [
            {
              "key": "X-Frame-Options",
              "value": "DENY"
            },
            {
              "key": "X-Content-Type-Options",
              "value": "nosniff"
            },
            {
              "key": "X-XSS-Protection",
              "value": "1; mode=block"
            }
          ]
        }
      ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "packages/functions",
    "runtime": "nodejs18",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log"
    ]
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "hosting": {
      "port": 5000
    },
    "ui": {
      "enabled": true
    }
  }
}
```

---

# 12. SCRIPTS DE DESPLIEGUE

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Iniciando despliegue..."

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
pnpm install

# 2. Build de todos los paquetes
echo "🔨 Construyendo paquetes..."
pnpm run build

# 3. Ejecutar tests
echo "🧪 Ejecutando tests..."
pnpm run test

# 4. Deploy a Firebase
echo "☁️ Desplegando a Firebase..."

# Deploy functions primero
firebase deploy --only functions

# Deploy hosting (admin y web)
firebase deploy --only hosting

# Deploy rules
firebase deploy --only firestore:rules

echo "✅ Despliegue completado!"
```

```bash
#!/bin/bash
# scripts/deploy-web-only.sh

set -e

echo "🌐 Desplegando solo tienda web..."

# Build web
cd packages/web
pnpm run build
cd ../..

# Deploy
firebase deploy --only hosting:web

echo "✅ Tienda web desplegada!"
```

---

# 13. VARIABLES DE ENTORNO

```env
# .env.local (NO commitear)

# Firebase
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=bmn-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bmn-system
VITE_FIREBASE_STORAGE_BUCKET=bmn-system.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Culqi
VITE_CULQI_PUBLIC_KEY=pk_test_...

# Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

```env
# packages/functions/.env (NO commitear)

# Firebase Admin (usa credenciales del proyecto)

# Culqi
CULQI_PRIVATE_KEY=sk_test_...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxx...

# WhatsApp Business
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/123456789
WHATSAPP_TOKEN=EAAx...
```

---

# 14. CHECKLIST DE IMPLEMENTACION

## Fase 1: Fundamentos
- [ ] Configurar monorepo con pnpm workspaces
- [ ] Extraer tipos a packages/shared
- [ ] Extraer servicios a packages/shared
- [ ] Migrar admin a packages/admin
- [ ] Crear packages/web con estructura base
- [ ] Configurar Firebase Hosting para web
- [ ] Actualizar Security Rules

## Fase 2: Catalogo
- [ ] ProductCard component
- [ ] ProductGrid component
- [ ] CatalogoFilters component
- [ ] SearchBar component
- [ ] Pagina Catalogo
- [ ] Pagina Producto detalle
- [ ] Pagina Categoria

## Fase 3: Carrito
- [ ] CartService en shared
- [ ] CartStore en web
- [ ] CartSidebar component
- [ ] CartItem component
- [ ] CartTimer component
- [ ] Trigger onCartExpire
- [ ] Cron cleanExpiredCarts

## Fase 4: Checkout
- [ ] CheckoutService
- [ ] ContactForm
- [ ] ShippingForm
- [ ] Integracion Culqi
- [ ] PaymentForm
- [ ] Pagina Checkout
- [ ] Pagina CheckoutSuccess
- [ ] Trigger onOrderCreate

## Fase 5: Autenticacion
- [ ] AuthStore
- [ ] Login page
- [ ] Register page
- [ ] RecuperarPassword page
- [ ] Vincular carrito a usuario

## Fase 6: Mi Cuenta
- [ ] AccountSidebar
- [ ] ProfileForm
- [ ] OrderHistory
- [ ] AddressList
- [ ] Favorites

## Fase 7: Agente IA
- [ ] ChatWidget
- [ ] ChatWindow
- [ ] ChatMessage
- [ ] AI Agent Function
- [ ] Tools implementation
- [ ] System prompts

## Fase 8: Recomendaciones
- [ ] Motor de recomendaciones
- [ ] Recompra reminders
- [ ] Cross-sell suggestions
- [ ] Cron sendReorderReminders

## Fase 9: Promociones
- [ ] PromocionService
- [ ] PromoCard
- [ ] CouponInput
- [ ] Sistema de banners
- [ ] Promociones automaticas

## Fase 10: Notificaciones
- [ ] Email templates
- [ ] Integracion SendGrid
- [ ] WhatsApp templates
- [ ] Integracion WhatsApp API

## Fase 11: Analytics
- [ ] GA4 setup
- [ ] Eventos de e-commerce
- [ ] Dashboard de metricas

## Fase 12: Optimizacion
- [ ] SEO basico
- [ ] Performance audit
- [ ] Lazy loading
- [ ] Image optimization

---

**FIN DEL DOCUMENTO DE IMPLEMENTACION COMPLETA**
