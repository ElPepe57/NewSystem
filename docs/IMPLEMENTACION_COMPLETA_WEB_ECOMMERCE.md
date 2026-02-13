# IMPLEMENTACION COMPLETA: WEB E-COMMERCE BMN SYSTEM

## Documento Tecnico de Implementacion
**Version:** 1.0 | **Fecha:** Enero 2026

---

# INDICE

1. [Arquitectura de Codigo](#1-arquitectura-de-codigo)
2. [Estructura de Archivos Completa](#2-estructura-de-archivos)
3. [Configuracion del Monorepo](#3-configuracion-monorepo)
4. [Modulo: Catalogo Web](#4-modulo-catalogo)
5. [Modulo: Carrito de Compras](#5-modulo-carrito)
6. [Modulo: Checkout y Pagos](#6-modulo-checkout)
7. [Modulo: Autenticacion Web](#7-modulo-autenticacion)
8. [Modulo: Mi Cuenta](#8-modulo-mi-cuenta)
9. [Modulo: Agente IA de Ventas](#9-modulo-agente-ia)
10. [Modulo: Recomendaciones](#10-modulo-recomendaciones)
11. [Modulo: Promociones](#11-modulo-promociones)
12. [Firebase Functions](#12-firebase-functions)
13. [Integraciones Externas](#13-integraciones)
14. [Security Rules](#14-security-rules)
15. [Testing](#15-testing)
16. [Despliegue](#16-despliegue)

---

# 1. ARQUITECTURA DE CODIGO

## 1.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MONOREPO BMN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        packages/shared                               │   │
│  │  (Codigo compartido entre admin y web)                               │   │
│  │                                                                      │   │
│  │  ├── types/          # Todos los tipos TypeScript                    │   │
│  │  ├── services/       # Servicios Firebase (producto, venta, etc)     │   │
│  │  ├── hooks/          # Hooks compartidos                             │   │
│  │  ├── utils/          # Utilidades (formateo, validacion)             │   │
│  │  └── constants/      # Constantes globales                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    │               │               │                       │
│                    ▼               ▼               ▼                       │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐           │
│  │  packages/admin  │ │  packages/web    │ │ packages/functions│           │
│  │  (ERP actual)    │ │  (Tienda B2C)    │ │ (Backend)        │           │
│  │                  │ │                  │ │                  │           │
│  │  - Dashboard     │ │  - Home          │ │  - API REST      │           │
│  │  - Inventario    │ │  - Catalogo      │ │  - Webhooks      │           │
│  │  - Ventas        │ │  - Producto      │ │  - Triggers      │           │
│  │  - Compras       │ │  - Carrito       │ │  - AI Agent      │           │
│  │  - Tesoreria     │ │  - Checkout      │ │  - Cron Jobs     │           │
│  │  - Maestros      │ │  - Mi Cuenta     │ │                  │           │
│  │  - Reportes      │ │  - Chat IA       │ │                  │           │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Tecnologias por Paquete

### packages/shared
```
- TypeScript 5.x
- Firebase SDK 10.x
- Zod (validacion)
```

### packages/admin (existente)
```
- React 18+
- Vite
- TailwindCSS
- Zustand
- React Query
- React Router 6
```

### packages/web (nuevo)
```
- React 18+ (o Next.js 14 para SSR/SEO)
- Vite / Next.js
- TailwindCSS
- Zustand
- React Query
- Framer Motion (animaciones)
```

### packages/functions
```
- Node.js 18+
- Firebase Functions v2
- Express (API)
- Anthropic SDK (Claude)
```

---

# 2. ESTRUCTURA DE ARCHIVOS

## 2.1 Estructura Completa del Monorepo

```
businessmn-v2/
│
├── packages/
│   │
│   ├── shared/                          # CODIGO COMPARTIDO
│   │   ├── src/
│   │   │   ├── types/                   # Tipos TypeScript
│   │   │   │   ├── producto.types.ts
│   │   │   │   ├── cliente.types.ts
│   │   │   │   ├── venta.types.ts
│   │   │   │   ├── carrito.types.ts     # NUEVO
│   │   │   │   ├── promocion.types.ts   # NUEVO
│   │   │   │   ├── ai-agent.types.ts    # NUEVO
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── services/                # Servicios Firebase
│   │   │   │   ├── producto.service.ts
│   │   │   │   ├── cliente.service.ts
│   │   │   │   ├── venta.service.ts
│   │   │   │   ├── inventario.service.ts
│   │   │   │   ├── carrito.service.ts   # NUEVO
│   │   │   │   ├── promocion.service.ts # NUEVO
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── hooks/                   # Hooks compartidos
│   │   │   │   ├── useProductos.ts
│   │   │   │   ├── useCarrito.ts        # NUEVO
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── utils/                   # Utilidades
│   │   │   │   ├── formatters.ts
│   │   │   │   ├── validators.ts
│   │   │   │   ├── price.utils.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── constants/               # Constantes
│   │   │   │   ├── categorias.ts
│   │   │   │   ├── metodos-pago.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── lib/                     # Configuracion
│   │   │       ├── firebase.ts
│   │   │       └── analytics.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── admin/                           # ERP ADMIN (migrar actual)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── store/
│   │   │   └── ...
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── web/                             # TIENDA WEB (NUEVO)
│   │   ├── src/
│   │   │   ├── components/              # Componentes React
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── Footer.tsx
│   │   │   │   │   ├── Navigation.tsx
│   │   │   │   │   ├── MobileMenu.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── producto/
│   │   │   │   │   ├── ProductCard.tsx
│   │   │   │   │   ├── ProductGrid.tsx
│   │   │   │   │   ├── ProductDetail.tsx
│   │   │   │   │   ├── ProductGallery.tsx
│   │   │   │   │   ├── ProductPrice.tsx
│   │   │   │   │   ├── ProductBadge.tsx
│   │   │   │   │   ├── ProductReviews.tsx
│   │   │   │   │   ├── RelatedProducts.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── catalogo/
│   │   │   │   │   ├── CatalogoFilters.tsx
│   │   │   │   │   ├── CatalogoSort.tsx
│   │   │   │   │   ├── CatalogoPagination.tsx
│   │   │   │   │   ├── CategoriaNav.tsx
│   │   │   │   │   ├── SearchBar.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── carrito/
│   │   │   │   │   ├── CartSidebar.tsx
│   │   │   │   │   ├── CartItem.tsx
│   │   │   │   │   ├── CartSummary.tsx
│   │   │   │   │   ├── CartEmpty.tsx
│   │   │   │   │   ├── CartTimer.tsx
│   │   │   │   │   ├── MiniCart.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── checkout/
│   │   │   │   │   ├── CheckoutStepper.tsx
│   │   │   │   │   ├── ContactForm.tsx
│   │   │   │   │   ├── ShippingForm.tsx
│   │   │   │   │   ├── PaymentForm.tsx
│   │   │   │   │   ├── OrderSummary.tsx
│   │   │   │   │   ├── PaymentMethods.tsx
│   │   │   │   │   ├── CulqiCheckout.tsx
│   │   │   │   │   ├── YapePayment.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── cuenta/
│   │   │   │   │   ├── AccountSidebar.tsx
│   │   │   │   │   ├── ProfileForm.tsx
│   │   │   │   │   ├── OrderHistory.tsx
│   │   │   │   │   ├── OrderDetail.tsx
│   │   │   │   │   ├── AddressList.tsx
│   │   │   │   │   ├── AddressForm.tsx
│   │   │   │   │   ├── Favorites.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── ai-chat/
│   │   │   │   │   ├── ChatWidget.tsx
│   │   │   │   │   ├── ChatWindow.tsx
│   │   │   │   │   ├── ChatMessage.tsx
│   │   │   │   │   ├── ChatInput.tsx
│   │   │   │   │   ├── ChatProductCard.tsx
│   │   │   │   │   ├── ChatSuggestions.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── home/
│   │   │   │   │   ├── HeroBanner.tsx
│   │   │   │   │   ├── FeaturedProducts.tsx
│   │   │   │   │   ├── CategoryShowcase.tsx
│   │   │   │   │   ├── PromoBanner.tsx
│   │   │   │   │   ├── Testimonials.tsx
│   │   │   │   │   ├── Newsletter.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── promociones/
│   │   │   │   │   ├── PromoCard.tsx
│   │   │   │   │   ├── PromoCountdown.tsx
│   │   │   │   │   ├── CouponInput.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   └── ui/                  # Componentes UI base
│   │   │   │       ├── Button.tsx
│   │   │   │       ├── Input.tsx
│   │   │   │       ├── Select.tsx
│   │   │   │       ├── Modal.tsx
│   │   │   │       ├── Toast.tsx
│   │   │   │       ├── Skeleton.tsx
│   │   │   │       ├── Badge.tsx
│   │   │   │       ├── Spinner.tsx
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── pages/                   # Paginas
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Catalogo.tsx
│   │   │   │   ├── Categoria.tsx
│   │   │   │   ├── Producto.tsx
│   │   │   │   ├── Busqueda.tsx
│   │   │   │   ├── Carrito.tsx
│   │   │   │   ├── Checkout.tsx
│   │   │   │   ├── CheckoutSuccess.tsx
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   ├── RecuperarPassword.tsx
│   │   │   │   ├── MiCuenta.tsx
│   │   │   │   ├── MisPedidos.tsx
│   │   │   │   ├── PedidoDetalle.tsx
│   │   │   │   ├── Favoritos.tsx
│   │   │   │   ├── Direcciones.tsx
│   │   │   │   ├── Ofertas.tsx
│   │   │   │   ├── Contacto.tsx
│   │   │   │   ├── FAQ.tsx
│   │   │   │   ├── Terminos.tsx
│   │   │   │   ├── Privacidad.tsx
│   │   │   │   ├── LibroReclamaciones.tsx
│   │   │   │   └── NotFound.tsx
│   │   │   │
│   │   │   ├── store/                   # Estado Zustand
│   │   │   │   ├── cartStore.ts
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── uiStore.ts
│   │   │   │   ├── chatStore.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── hooks/                   # Hooks especificos web
│   │   │   │   ├── useCart.ts
│   │   │   │   ├── useCheckout.ts
│   │   │   │   ├── useAIChat.ts
│   │   │   │   ├── useRecommendations.ts
│   │   │   │   ├── useSearch.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── styles/
│   │   │   │   ├── globals.css
│   │   │   │   └── tailwind.css
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── routes.tsx
│   │   │
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── favicon.ico
│   │   │
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   │
│   └── functions/                       # FIREBASE FUNCTIONS
│       ├── src/
│       │   ├── api/                     # Endpoints REST
│       │   │   ├── products.ts
│       │   │   ├── cart.ts
│       │   │   ├── checkout.ts
│       │   │   ├── orders.ts
│       │   │   ├── user.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── webhooks/                # Webhooks externos
│       │   │   ├── culqi.webhook.ts
│       │   │   ├── whatsapp.webhook.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── triggers/                # Firestore triggers
│       │   │   ├── onOrderCreate.ts
│       │   │   ├── onCartExpire.ts
│       │   │   ├── onStockChange.ts
│       │   │   ├── onClienteUpdate.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── scheduled/               # Cron jobs
│       │   │   ├── cleanExpiredCarts.ts
│       │   │   ├── sendReorderReminders.ts
│       │   │   ├── updatePromoStatus.ts
│       │   │   ├── calculateRFM.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── ai-agent/                # Agente IA
│       │   │   ├── agent.ts
│       │   │   ├── tools/
│       │   │   │   ├── searchProducts.ts
│       │   │   │   ├── checkStock.ts
│       │   │   │   ├── getRecommendations.ts
│       │   │   │   ├── addToCart.ts
│       │   │   │   ├── getOrderStatus.ts
│       │   │   │   └── index.ts
│       │   │   ├── prompts/
│       │   │   │   ├── system.prompt.ts
│       │   │   │   └── templates.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── payments/                # Integracion pagos
│       │   │   ├── culqi.ts
│       │   │   ├── yape.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── notifications/           # Notificaciones
│       │   │   ├── email.ts
│       │   │   ├── whatsapp.ts
│       │   │   ├── push.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── recommendations/         # Motor recomendaciones
│       │   │   ├── engine.ts
│       │   │   ├── reorder.ts
│       │   │   ├── crossSell.ts
│       │   │   ├── rfmBased.ts
│       │   │   └── index.ts
│       │   │
│       │   └── index.ts                 # Entry point
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── firebase.json                        # Config Firebase
├── firestore.rules                      # Security rules
├── firestore.indexes.json               # Indices
├── .firebaserc                          # Proyecto Firebase
├── package.json                         # Root package.json
├── pnpm-workspace.yaml                  # Workspace config
└── turbo.json                           # Turborepo config
```

---

# 3. CONFIGURACION MONOREPO

## 3.1 Root package.json

```json
{
  "name": "businessmn-monorepo",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "dev:admin": "turbo run dev --filter=admin",
    "dev:web": "turbo run dev --filter=web",
    "build": "turbo run build",
    "build:admin": "turbo run build --filter=admin",
    "build:web": "turbo run build --filter=web",
    "deploy": "turbo run build && firebase deploy",
    "deploy:web": "turbo run build --filter=web && firebase deploy --only hosting:web",
    "deploy:functions": "turbo run build --filter=functions && firebase deploy --only functions",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@8.10.0",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 3.2 pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

## 3.3 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

## 3.4 packages/shared/package.json

```json
{
  "name": "@bmn/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "firebase": "^10.7.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

## 3.5 packages/web/package.json

```json
{
  "name": "@bmn/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@bmn/shared": "workspace:*",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "framer-motion": "^10.16.0",
    "lucide-react": "^0.294.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

## 3.6 packages/functions/package.json

```json
{
  "name": "@bmn/functions",
  "version": "1.0.0",
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log",
    "clean": "rm -rf lib"
  },
  "engines": {
    "node": "18"
  },
  "dependencies": {
    "@bmn/shared": "workspace:*",
    "firebase-admin": "^11.11.0",
    "firebase-functions": "^4.5.0",
    "@anthropic-ai/sdk": "^0.10.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "nodemailer": "^6.9.0",
    "culqi-node": "^2.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/nodemailer": "^6.4.0",
    "typescript": "^5.3.0"
  }
}
```
