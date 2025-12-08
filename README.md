# 🚀 BusinessMN 2.0

Sistema ERP completo para gestión de importación USA → Perú con control cambiario multicapa, trazabilidad de inventario y CTRU dinámico.

## 📋 Características

### ✅ Implementado (Día 1)
- 🔐 Sistema de autenticación (Firebase Auth)
- 🎨 UI Components base (Button, Input, Card, Badge)
- 📱 Layout responsive con Sidebar y Header  
- 🛣️ Routing configurado (React Router)
- 💾 State management (Zustand)
- 🔥 Firebase configurado
- 🎨 Tailwind CSS configurado

### 🚧 En Desarrollo (Fase 1)
- 📦 Módulo de Productos
- 📊 Módulo de Inventario
- 🛒 Módulo de Compras (OC)
- 💰 Módulo de Ventas
- 💱 Control Cambiario
- 📈 Dashboard con métricas

## 🛠️ Stack Tecnológico

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Data Fetching:** TanStack Query
- **Routing:** React Router v6
- **Backend:** Firebase (Auth + Firestore + Storage)
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React
- **Charts:** Recharts

## 📦 Instalación

### Prerequisitos
- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase

### Paso 1: Instalar dependencias

```bash
npm install
```

### Paso 2: Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto (o usa uno existente)
3. Habilita Authentication → Email/Password
4. Crea una base de datos Firestore
5. Habilita Storage
6. Ve a Project Settings → General
7. En "Your apps" crea una Web App
8. Copia las credenciales

### Paso 3: Configurar variables de entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` y pega tus credenciales de Firebase

### Paso 4: Iniciar el servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en: http://localhost:5173

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

## 📚 Documentación

Ver archivos en `/mnt/user-data/outputs/`:
- BMN_FASE_1_ARQUITECTURA.md
- BMN_DIAGRAMAS_Y_FLUJOS.md
- BMN_CHECKLIST_IMPLEMENTACION.md

---

**Versión:** 2.0.0  
**Estado:** En desarrollo activo 🚀
