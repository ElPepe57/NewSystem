# ✅ CHECKLIST DE IMPLEMENTACIÓN - FASE 1
## BusinessMN 2.0 - Roadmap Detallado

---

## 🎯 RESUMEN EJECUTIVO

**Duración total:** 8-10 semanas  
**Objetivo:** Sistema operativo funcional con los 6 módulos core  
**Resultado:** ERP básico que reemplaza Google Sheets y controla toda la operación

---

## 📅 SEMANA 1-2: SETUP & MÓDULO PRODUCTOS

### Día 1: Configuración Inicial del Proyecto

#### ✅ Setup del Proyecto React
- [ ] Crear proyecto con Vite
  ```bash
  npm create vite@latest businessmn-v2 -- --template react-ts
  cd businessmn-v2
  npm install
  ```

- [ ] Instalar dependencias principales
  ```bash
  npm install firebase zustand @tanstack/react-query
  npm install tailwindcss postcss autoprefixer
  npm install react-router-dom react-hook-form zod
  npm install @hookform/resolvers
  npm install recharts lucide-react
  npm install date-fns
  ```

- [ ] Configurar Tailwind CSS
  ```bash
  npx tailwindcss init -p
  ```
  
- [ ] Configurar estructura de carpetas base
  - [ ] Crear `/src/components`
  - [ ] Crear `/src/pages`
  - [ ] Crear `/src/services`
  - [ ] Crear `/src/hooks`
  - [ ] Crear `/src/types`
  - [ ] Crear `/src/store`
  - [ ] Crear `/src/lib`

#### ✅ Setup de Firebase
- [ ] Crear proyecto en Firebase Console
- [ ] Habilitar Authentication (Email/Password)
- [ ] Crear base de datos Firestore
- [ ] Configurar reglas básicas de seguridad
- [ ] Obtener credenciales del proyecto
- [ ] Crear archivo `/src/lib/firebase.ts`
- [ ] Configurar Firebase en el proyecto

```typescript
// /src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

---

### Día 2-3: Componentes Base y Layout

#### ✅ Componentes Comunes (UI Library interna)
- [ ] **Button Component**
  - Variantes: primary, secondary, danger, ghost
  - Tamaños: sm, md, lg
  - Estados: loading, disabled
  
- [ ] **Input Component**
  - Text, number, email, password
  - Con validación visual
  - Con iconos opcionales
  
- [ ] **Select Component**
  - Single y multiple select
  - Con búsqueda
  
- [ ] **Modal Component**
  - Tamaños: sm, md, lg, xl
  - Con backdrop
  - Animaciones suaves
  
- [ ] **Card Component**
  - Header, body, footer
  - Variantes de sombra
  
- [ ] **Badge Component**
  - Colores: success, warning, danger, info
  
- [ ] **Alert Component**
  - Tipos: success, error, warning, info
  - Con icono y cerrar
  
- [ ] **Loading Component**
  - Spinner
  - Skeleton screens

#### ✅ Layout Principal
- [ ] **Sidebar Component**
  - Navegación principal
  - Colapsable
  - Íconos con Lucide React
  
- [ ] **Header Component**
  - Logo
  - Usuario actual
  - Menú de perfil
  - Notificaciones badge
  
- [ ] **MainLayout Component**
  - Sidebar + Header + Content
  - Responsive

---

### Día 4-5: Sistema de Autenticación

#### ✅ Auth Store (Zustand)
- [ ] Crear `/src/store/authStore.ts`
- [ ] Estado: user, loading, error
- [ ] Acciones: login, logout, register
- [ ] Persistencia en localStorage

#### ✅ Servicios de Auth
- [ ] Crear `/src/services/auth.service.ts`
- [ ] Login con email/password
- [ ] Registro de usuarios
- [ ] Logout
- [ ] Password reset
- [ ] Obtener usuario actual

#### ✅ Páginas de Auth
- [ ] Login Page
  - Formulario con validación
  - "Recordar sesión"
  - Link a "Olvidé mi contraseña"
  
- [ ] Register Page (solo para testing inicial)

#### ✅ Protección de Rutas
- [ ] Crear ProtectedRoute component
- [ ] Redirect a login si no autenticado

---

### Día 6-7: Módulo Productos - Base de Datos

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/producto.types.ts`
  - Interface Producto
  - Enums: Presentacion, Estado, Etiquetas
  - Interface Investigacion
  
#### ✅ Colección Firestore
- [ ] Crear índices compuestos necesarios
  - estado + marca
  - estado + grupo
  - stockPeru (para ordenamiento)

#### ✅ Servicio de Productos
- [ ] Crear `/src/services/productos.service.ts`
- [ ] **CRUD básico:**
  - [ ] `createProducto(data)`
  - [ ] `getProducto(id)`
  - [ ] `updateProducto(id, data)`
  - [ ] `deleteProducto(id)` (soft delete)
  - [ ] `getAllProductos()`
  - [ ] `getProductosByFilters(filters)`
  
- [ ] **Funciones especiales:**
  - [ ] `generateSKU()` - Auto-generar SKU
  - [ ] `buscarProductos(query)` - Búsqueda
  - [ ] `getProductosPorGrupo(grupo)`
  - [ ] `getProductosStockCritico()`
  - [ ] `getProductosProximosVencer()`

---

### Día 8-9: Módulo Productos - UI Lista

#### ✅ Lista de Productos (Vista Principal)
- [ ] Crear `/src/pages/Productos/ProductosList.tsx`
- [ ] **Funcionalidades:**
  - [ ] Tabla de productos
  - [ ] Paginación (20 items por página)
  - [ ] Búsqueda en tiempo real
  - [ ] Filtros:
    - Estado (activo/deshabilitado)
    - Marca
    - Grupo
    - Subgrupo
    - Stock (todos/crítico/agotado)
    - Etiquetas
  - [ ] Ordenamiento por columnas
  - [ ] Botón "Nuevo Producto"
  - [ ] Acciones: Ver, Editar, Eliminar
  
- [ ] **Columnas de la tabla:**
  - SKU
  - Imagen (thumbnail)
  - Producto (marca + nombre)
  - Grupo/Subgrupo
  - Stock Perú
  - Stock USA
  - CTRU
  - Estado
  - Acciones

#### ✅ Custom Hook
- [ ] Crear `/src/hooks/useProductos.ts`
- [ ] Integrar con React Query
- [ ] Cache inteligente
- [ ] Loading states
- [ ] Error handling

---

### Día 10-11: Módulo Productos - Formulario

#### ✅ Formulario de Producto
- [ ] Crear `/src/pages/Productos/ProductoForm.tsx`
- [ ] **Secciones del formulario:**
  1. **Información Básica**
     - Marca (input + autocomplete)
     - Nombre Comercial
     - Presentación (select)
     - Dosaje
     - Contenido
     - Código UPC/EAN
     
  2. **Clasificación**
     - Grupo (select)
     - Subgrupo (select dependiente)
     - Etiquetas (multi-select)
     
  3. **Datos Comerciales**
     - Enlace Proveedor
     - Precio Sugerido
     - Margen Mínimo (%)
     - Margen Objetivo (%)
     
  4. **Inventario**
     - Stock Mínimo
     - Stock Máximo
     
  5. **Mercado Libre**
     - Habilitado para ML (checkbox)
     - Restricción ML (textarea)
     
  6. **Imagen**
     - Upload de imagen
     - Preview

- [ ] Validación con Zod
- [ ] Modo: Crear / Editar
- [ ] Botones: Guardar, Cancelar
- [ ] Loading states
- [ ] Mensajes de éxito/error

---

### Día 12-13: Módulo Productos - Detalle e Investigación

#### ✅ Detalle de Producto
- [ ] Crear `/src/pages/Productos/ProductoDetail.tsx`
- [ ] **Secciones:**
  1. **Información General**
     - Todos los datos del producto
     - Imagen grande
     - Estado
     - Etiquetas
     
  2. **Métricas**
     - CTRU actual
     - Stock disponible (Perú/USA/Tránsito)
     - Rotación mensual
     - Días para quiebre
     
  3. **Investigación de Mercado**
     - Última investigación
     - Vigencia
     - Precios USA/Perú
     - Botón "Nueva Investigación"
     
  4. **Historial**
     - Cambios recientes
     - Timeline de eventos
     
  5. **Unidades**
     - Lista de unidades activas
     - Por almacén
     - Por estado

#### ✅ Modal de Investigación
- [ ] Crear `InvestigacionModal.tsx`
- [ ] **Campos:**
  - Precio USA Mín/Máx/Promedio
  - Precio Perú Mín/Máx/Promedio
  - Presencia en ML (checkbox)
  - Notas
  - Estimación CTRU
  - Estimación Logística
  - Precio Sugerido (auto-calculado)
  
- [ ] Guardar con vigencia de 60 días
- [ ] Actualizar producto automáticamente

---

### Día 14: Testing y Refinamiento Módulo Productos

#### ✅ Testing Funcional
- [ ] Crear producto completo
- [ ] Editar producto
- [ ] Crear investigación de mercado
- [ ] Buscar y filtrar productos
- [ ] Verificar validaciones
- [ ] Verificar auto-generación de SKU
- [ ] Verificar cálculos automáticos

#### ✅ UX/UI Polish
- [ ] Animaciones suaves
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Error states
- [ ] Mobile responsive
- [ ] Keyboard shortcuts

---

## 📅 SEMANA 3-4: INVENTARIO & CONTROL CAMBIARIO

### Día 15-16: Módulo Tipo de Cambio

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/tipoCambio.types.ts`

#### ✅ Colección Firestore
- [ ] Configurar colección `tiposCambio`
- [ ] ID del documento = fecha (YYYY-MM-DD)

#### ✅ Servicio Tipo de Cambio
- [ ] Crear `/src/services/tipoCambio.service.ts`
- [ ] **Funciones:**
  - [ ] `getTipoCambioDia(fecha)`
  - [ ] `createTipoCambio(data)`
  - [ ] `updateTipoCambio(fecha, data)`
  - [ ] `getHistorialTC(fechaInicio, fechaFin)`
  - [ ] `getUltimoTC()`
  - [ ] `fetchTipoCambioAPI()` - API externa
  
#### ✅ Cloud Function - TC Automático
- [ ] Crear función programada diaria
- [ ] Se ejecuta a las 3 PM
- [ ] Obtiene TC de API
- [ ] Guarda en Firestore
- [ ] Notifica si falla

#### ✅ UI - Registro de TC
- [ ] Crear `/src/pages/TipoCambio/TipoCambioForm.tsx`
- [ ] Formulario simple:
  - Fecha (date picker)
  - TC Compra
  - TC Venta
  - Botón Guardar
  
- [ ] Mostrar último TC registrado
- [ ] Botón "Obtener de API"

#### ✅ UI - Historial TC
- [ ] Crear tabla de histórico
- [ ] Gráfico de evolución (Recharts)
- [ ] Filtro por rango de fechas

---

### Día 17-18: Módulo Almacenes

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/almacen.types.ts`

#### ✅ Servicio de Almacenes
- [ ] Crear `/src/services/almacenes.service.ts`
- [ ] CRUD básico de almacenes
- [ ] Calcular capacidad usada/disponible

#### ✅ UI - Gestión de Almacenes
- [ ] Lista de almacenes
- [ ] Formulario crear/editar
- [ ] Vista de capacidad (barra de progreso)

#### ✅ Almacenes Pre-configurados
- [ ] Seed inicial con almacenes:
  - USA-Miami1
  - USA-Miami2
  - USA-Utah
  - Peru-Principal
  - Peru-Secundario

---

### Día 19-21: Módulo Unidades (Trazabilidad)

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/unidad.types.ts`
- [ ] Interface Unidad
- [ ] Enum Estados
- [ ] Interface HistorialMovimiento

#### ✅ Servicio de Unidades
- [ ] Crear `/src/services/unidades.service.ts`
- [ ] **Funciones:**
  - [ ] `createUnidad(data)`
  - [ ] `getUnidad(id)`
  - [ ] `updateUnidad(id, data)`
  - [ ] `getUnidadesBySkuId(skuId, estados?)`
  - [ ] `getUnidadesByAlmacen(almacenId)`
  - [ ] `getUnidadesByEstado(estado)`
  - [ ] `cambiarEstadoUnidad(id, nuevoEstado, usuario, detalles)`
  - [ ] `moverUnidad(id, almacenDestino, usuario)`
  - [ ] `getHistorialUnidad(id)`
  - [ ] `seleccionarUnidadesFEFO(skuId, cantidad)` ⭐
  - [ ] `getUnidadesProximasVencer(dias)`

#### ✅ UI - Vista de Unidades
- [ ] Crear `/src/pages/Inventario/UnidadesList.tsx`
- [ ] Tabla con:
  - ID Unidad
  - SKU + Nombre Producto
  - Estado
  - Almacén actual
  - CTRU dinámico
  - Fecha origen
  - Fecha vencimiento
  - Acciones
  
- [ ] Filtros:
  - Por SKU
  - Por estado
  - Por almacén
  - Por rango de fechas

#### ✅ UI - Detalle de Unidad
- [ ] Crear `/src/pages/Inventario/UnidadDetail.tsx`
- [ ] **Secciones:**
  1. Información básica
  2. Costos detallados (desglose CTRU)
  3. Ubicación actual
  4. Timeline de movimientos (estilo vertical)
  5. Botones de acción:
     - Cambiar estado
     - Mover a otro almacén
     - Ver OC origen

---

### Día 22-24: Módulo Inventario General

#### ✅ Servicio de Inventario
- [ ] Crear `/src/services/inventario.service.ts`
- [ ] **Funciones de agregación:**
  - [ ] `getResumenInventario()` - Totales generales
  - [ ] `getInventarioPorSKU()` - Agrupado por producto
  - [ ] `getInventarioPorAlmacen(almacenId)`
  - [ ] `getStockDisponible(skuId)`
  - [ ] `getStockReservado(skuId)`
  - [ ] `verificarDisponibilidad(skuId, cantidad)`
  - [ ] `actualizarStockProducto(skuId)` ⭐
  - [ ] `getAlertasStock()` - Productos críticos
  - [ ] `getAlertasVencimiento()` - Próximos a vencer

#### ✅ UI - Inventario General
- [ ] Crear `/src/pages/Inventario/InventarioGeneral.tsx`
- [ ] **Métricas superiores:**
  - Total unidades Perú
  - Total unidades USA
  - Total en tránsito
  - Valor total inventario
  
- [ ] **Tabla agrupada por SKU:**
  - SKU + Producto
  - Stock Perú (disponible/reservado)
  - Stock USA
  - Stock Tránsito
  - CTRU promedio
  - Valor total
  - Rotación
  - Alertas (iconos)
  
- [ ] **Acciones:**
  - Ver unidades
  - Ver producto

#### ✅ UI - Inventario USA
- [ ] Crear `/src/pages/Inventario/InventarioUSA.tsx`
- [ ] Vista por almacén USA
- [ ] Capacidad de cada almacén
- [ ] Productos en cada almacén

#### ✅ UI - Inventario Perú
- [ ] Crear `/src/pages/Inventario/InventarioPeru.tsx`
- [ ] Vista por almacén Perú
- [ ] Incluir estados de unidades
- [ ] Productos por ubicación

---

### Día 25-26: Movimientos de Inventario

#### ✅ Tipos de Movimientos
- [ ] Crear `/src/types/movimiento.types.ts`
- [ ] Enum TipoMovimiento
- [ ] Interface Movimiento

#### ✅ Servicio de Movimientos
- [ ] Crear `/src/services/movimientos.service.ts`
- [ ] `registrarMovimiento(data)`
- [ ] `getMovimientos(filtros)`
- [ ] `getMovimientosByUnidad(unidadId)`

#### ✅ UI - Registrar Movimiento
- [ ] Modal de movimiento
- [ ] Seleccionar unidades
- [ ] Almacén origen/destino
- [ ] Motivo
- [ ] Validación del receptor
- [ ] Generar documento MA01

#### ✅ UI - Historial de Movimientos
- [ ] Lista de movimientos
- [ ] Filtros por fecha
- [ ] Exportar a Excel

---

### Día 27-28: Testing Inventario & TC

#### ✅ Testing Funcional Completo
- [ ] Crear unidades manualmente
- [ ] Mover unidades entre almacenes
- [ ] Cambiar estados
- [ ] Verificar FEFO
- [ ] Registrar TCs
- [ ] Verificar alertas de stock
- [ ] Verificar alertas de vencimiento

#### ✅ Integración con Módulo Productos
- [ ] Actualización automática de stocks
- [ ] Sincronización de CTRU promedio
- [ ] Alertas funcionando

---

## 📅 SEMANA 5-6: ÓRDENES DE COMPRA

### Día 29-30: OC - Base de Datos y Servicio

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/ordenCompra.types.ts`
- [ ] Interface OrdenCompra
- [ ] Interface ItemOC
- [ ] Enum EstadosOC

#### ✅ Servicio de OC
- [ ] Crear `/src/services/ordenes.service.ts`
- [ ] **CRUD:**
  - [ ] `createOrdenCompra(data)`
  - [ ] `getOrdenCompra(id)`
  - [ ] `updateOrdenCompra(id, data)`
  - [ ] `deleteOrdenCompra(id)`
  - [ ] `getAllOrdenes(filtros)`
  
- [ ] **Funciones especiales:**
  - [ ] `generateNumeroOC()` - Auto OC-2024-001
  - [ ] `registrarPago(ocId, tcPago, fecha)`
  - [ ] `registrarRecepcionUSA(ocId, data)`
  - [ ] `calcularDiferenciaCambiaria(oc)`
  - [ ] `getOrdenesAbiertas()`
  - [ ] `getOrdenesPendientesPago()`

---

### Día 31-32: OC - UI Lista y Formulario

#### ✅ UI - Lista de Órdenes
- [ ] Crear `/src/pages/Compras/OrdenesList.tsx`
- [ ] **Tabla:**
  - Número OC
  - Fecha
  - Proveedor
  - Total USD
  - TC Compra
  - TC Pago
  - Estado OC
  - Estado Pago
  - Acciones
  
- [ ] **Filtros:**
  - Estado OC
  - Estado Pago
  - Proveedor
  - Rango de fechas
  - Almacén destino
  
- [ ] **Badges de estado:**
  - Pendiente (gris)
  - Pagada (azul)
  - Recibida USA (amarillo)
  - Completada (verde)

#### ✅ UI - Formulario Nueva OC
- [ ] Crear `/src/pages/Compras/OrdenForm.tsx`
- [ ] **Secciones:**
  1. **Información General**
     - Proveedor (select + nuevo)
     - Enlace de compra
     - Almacén USA destino
     - Fecha estimada recepción
     
  2. **Productos**
     - Selector de productos (autocomplete)
     - Tabla de items:
       - Producto
       - Cantidad
       - Precio USD unitario
       - Subtotal USD
       - Acciones (eliminar)
     - Botón "Agregar producto"
     - Total USD
     
  3. **Control Cambiario**
     - TC Compra (auto del día, editable)
     - Total PEN con TC compra
     
  4. **Notas**
     - Campo de notas

- [ ] Validaciones
- [ ] Cálculos automáticos
- [ ] Botón Guardar

---

### Día 33-34: OC - Detalle y Pago

#### ✅ UI - Detalle de OC
- [ ] Crear `/src/pages/Compras/OrdenDetail.tsx`
- [ ] **Secciones:**
  1. **Header con badges de estado**
  2. **Información General**
  3. **Tabla de productos**
  4. **Control Cambiario**
     - TC Compra
     - TC Pago (si existe)
     - Diferencia cambiaria
     - Con alertas si hay pérdida
  5. **Totales**
  6. **Estados y fechas**
  7. **Botones de acción:**
     - Registrar pago
     - Registrar recepción USA
     - Editar
     - Cancelar OC

#### ✅ Modal - Registrar Pago
- [ ] Crear `PagoModal.tsx`
- [ ] **Campos:**
  - Fecha de pago
  - TC Pago (auto del día, editable)
  - Total PEN con TC pago
  - Diferencia vs TC compra (calculado)
  - Medio de pago
  - Referencia de pago
  
- [ ] Mostrar alerta si diferencia > 3%
- [ ] Botón Confirmar Pago
- [ ] Actualizar estado OC a "pagada"

---

### Día 35-36: OC - Recepción USA y Generación de Unidades

#### ✅ Modal - Recepción USA
- [ ] Crear `RecepcionUSAModal.tsx`
- [ ] **Campos:**
  - Fecha de recepción
  - Almacén USA (confirmar)
  - Tabla de productos:
    - Producto
    - Cantidad esperada
    - Cantidad recibida (editable)
    - Faltantes (calculado)
    - Dañados (input)
  - Observaciones
  - Foto (upload opcional)
  
- [ ] Validación de cantidades
- [ ] Botón Confirmar Recepción

#### ✅ Cloud Function - Generar Unidades
- [ ] Crear función trigger en `onUpdate` de OC
- [ ] Detectar cambio a estado "recibida_usa"
- [ ] **Lógica:**
  1. Por cada producto en la OC
  2. Crear N unidades (N = cantidad recibida)
  3. Cada unidad con:
     - skuId
     - ocId
     - costoUSA
     - tcCompra
     - tcPago
     - estado: 'recibida_usa'
     - almacenActual: almacén de la OC
     - ctruInicial: 0 (se calcula al llegar a Perú)
     - historial inicial
  4. Actualizar stock del producto

#### ✅ Verificación
- [ ] Crear OC de prueba
- [ ] Registrar pago
- [ ] Registrar recepción USA
- [ ] Verificar que se generaron unidades
- [ ] Verificar que se actualizó stock USA

---

### Día 37-38: Testing y Refinamiento OC

#### ✅ Testing Completo de Flujo
- [ ] Crear OC completa (3-5 productos)
- [ ] Registrar pago con TC diferente
- [ ] Verificar cálculo de diferencia cambiaria
- [ ] Registrar recepción con faltantes
- [ ] Verificar generación de unidades
- [ ] Verificar actualización de stocks
- [ ] Verificar historial de unidades

#### ✅ Reportes de OC
- [ ] Lista de OCs pendientes de pago
- [ ] Lista de OCs pendientes de recepción
- [ ] Reporte de diferencias cambiarias del mes
- [ ] Exportar a Excel

---

## 📅 SEMANA 7-8: VENTAS Y CTRU DINÁMICO

### Día 39-40: Módulo Cotizaciones

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/cotizacion.types.ts`
- [ ] Interface Cotizacion
- [ ] Interface ItemCotizacion

#### ✅ Servicio de Cotizaciones
- [ ] Crear `/src/services/cotizaciones.service.ts`
- [ ] CRUD básico
- [ ] `generarNumeroCotizacion()`
- [ ] `convertirAVenta(cotizacionId)`
- [ ] `getCotizacionesPorExpirar()`
- [ ] `marcarComoExpirada(cotizacionId)`

#### ✅ UI - Lista de Cotizaciones
- [ ] Tabla de cotizaciones
- [ ] Estados con badges
- [ ] Filtros por estado y fecha
- [ ] Acciones: Ver, Editar, Convertir a Venta

#### ✅ UI - Formulario de Cotización
- [ ] Crear `/src/pages/Ventas/CotizacionForm.tsx`
- [ ] **Secciones:**
  1. **Cliente**
     - Nombre
     - Teléfono
     - Email
     
  2. **Productos**
     - Selector de productos
     - Tabla:
       - Producto
       - Cantidad
       - CTRU actual (readonly)
       - Precio sugerido (readonly)
       - Precio ofrecido (editable)
       - Margen estimado % (calculado)
       - Subtotal
     - Botón agregar producto
     
  3. **Totales**
     - Subtotal
     - Delivery (opcional)
     - Total
     - Margen promedio %
     
  4. **Vigencia**
     - Fecha emisión (hoy)
     - Fecha expiración (+7 días, editable)
     
  5. **Notas**

- [ ] Cálculos en tiempo real
- [ ] Alertas de margen bajo
- [ ] Botón Guardar Cotización

---

### Día 41-42: Módulo Ventas

#### ✅ Tipos TypeScript
- [ ] Crear `/src/types/venta.types.ts`
- [ ] Interface Venta
- [ ] Interface ItemVenta

#### ✅ Servicio de Ventas
- [ ] Crear `/src/services/ventas.service.ts`
- [ ] **Funciones principales:**
  - [ ] `createVenta(data)`
  - [ ] `getVenta(id)`
  - [ ] `updateVenta(id, data)`
  - [ ] `getAllVentas(filtros)`
  - [ ] `generarNumeroVenta()`
  - [ ] `procesarVenta(ventaId)` ⭐
  - [ ] `calcularRentabilidad(venta)`
  - [ ] `getVentasPorCliente(clienteId)`
  - [ ] `getVentasDel Dia()`
  - [ ] `getVentasDelMes()`

#### ✅ UI - Lista de Ventas
- [ ] Tabla de ventas
- [ ] Columnas:
  - Número venta
  - Fecha
  - Cliente
  - Canal
  - Total
  - Margen neto
  - Estado
  - Acciones
  
- [ ] Filtros:
  - Canal
  - Estado
  - Rango de fechas
  - Cliente
  
- [ ] Métricas superiores:
  - Ventas del día
  - Ventas del mes
  - Margen promedio

---

### Día 43-44: Venta - Formulario y Asignación FEFO

#### ✅ UI - Formulario de Venta
- [ ] Crear `/src/pages/Ventas/VentaForm.tsx`
- [ ] **Modo dual:**
  - Desde cero
  - Desde cotización (pre-llenado)
  
- [ ] **Secciones:**
  1. **Cliente**
     - Búsqueda/Crear nuevo
     - Autocompletar si existe
     
  2. **Canal de Venta**
     - Radio buttons: Retail, Mayorista, ML
     - Origen: WhatsApp, Local, ML, Teléfono
     
  3. **Productos**
     - Selector de productos (con stock disponible)
     - Tabla items:
       - Producto
       - Stock disponible
       - Cantidad
       - CTRU
       - Precio unitario
       - Margen %
       - Subtotal
     - Validación de stock en tiempo real
     - Botón agregar
     
  4. **Asignación de Unidades** (modal)
     - Al agregar producto, abrir modal
     - Mostrar unidades disponibles ordenadas por FEFO
     - Seleccionar automáticamente las primeras N
     - Permitir cambio manual
     - Mostrar fecha vencimiento
     - Marcar unidades como "asignada_pedido"
     
  5. **Costos Adicionales**
     - Delivery (input)
     - Empaque (auto o manual)
     - Comisión ML (auto si canal = ML)
     
  6. **Totales y Rentabilidad**
     - Subtotal
     - Costos adicionales
     - Total
     - Costo total (suma CTRUs)
     - Margen bruto (PEN y %)
     - Margen neto (PEN y %)
     - Alertas de margen bajo
     
  7. **Estado de Pago**
     - Radio: Pagada, Adelanto, Pendiente
     - Si adelanto: monto del adelanto
     
  8. **Entrega**
     - Fecha estimada
     - Dirección (si delivery)

- [ ] Cálculos dinámicos
- [ ] Validaciones completas
- [ ] Botón Confirmar Venta

#### ✅ Proceso de Venta (Backend)
- [ ] Al confirmar venta:
  1. Crear documento venta
  2. Actualizar estado unidades a "asignada_pedido"
  3. Actualizar stock disponible del producto
  4. Si adelanto, crear registro en finanzas
  5. Si ML, activar prioridad de despacho

---

### Día 45-47: Sistema CTRU Dinámico

#### ✅ Servicio CTRU
- [ ] Crear `/src/services/ctru.service.ts`
- [ ] **Funciones principales:**
  - [ ] `calcularCTRUInicial(unidadId)` ⭐
  - [ ] `recalcularCTRUDinamico()` ⭐
  - [ ] `prorratearCostoLogistica(unidadId)`
  - [ ] `calcularGastosProrrateados(unidadId)`
  - [ ] `actualizarCTRUPromedioSKUs()`
  - [ ] `getCTRUDesglosado(unidadId)`

#### ✅ Módulo Gastos
- [ ] Crear `/src/types/gasto.types.ts`
- [ ] Crear `/src/services/gastos.service.ts`
- [ ] UI simple para registrar gastos:
  - Tipo
  - Monto
  - Moneda
  - TC (si USD)
  - Es prorrateable
  - Concepto
  - Fecha

#### ✅ Cloud Function - Recálculo CTRU
- [ ] Función trigger en onCreate de gastos
- [ ] Si gasto es prorrateable:
  1. Obtener todas las unidades disponibles
  2. Calcular gasto por unidad
  3. Actualizar ctruDinamico de cada unidad
  4. Actualizar ctruPromedio de cada SKU

#### ✅ Cloud Function - CTRU al llegar a Perú
- [ ] Función trigger en onUpdate de unidad
- [ ] Detectar cambio de estado a "disponible_peru"
- [ ] Calcular CTRU inicial:
  - Costo USA en PEN
  - Logística prorrateada
  - Gastos operativos/admin del mes
- [ ] Guardar como ctruInicial
- [ ] Copiar a ctruDinamico

#### ✅ UI - Vista CTRU Desglosado
- [ ] Componente para mostrar desglose de CTRU
- [ ] Usado en:
  - Detalle de unidad
  - Formulario de venta
  - Detalle de venta

---

### Día 48-49: Testing CTRU y Ventas

#### ✅ Testing Flujo Completo
1. **Crear OC y recibir en USA**
2. **Mover unidades a Perú**
   - Verificar cálculo CTRU inicial
3. **Registrar gastos operativos**
   - Verificar recálculo CTRU dinámico
4. **Crear cotización**
   - Verificar cálculo de margen
5. **Convertir a venta**
   - Verificar asignación FEFO
   - Verificar actualización stocks
6. **Completar venta**
   - Verificar rentabilidad final

#### ✅ Testing de Casos Edge
- [ ] Venta sin stock disponible
- [ ] Producto sin CTRU
- [ ] Margen negativo
- [ ] Gastos no prorrateables
- [ ] Multiple ventas del mismo producto (FEFO)

---

## 📅 SEMANA 9-10: DASHBOARD Y DEPLOYMENT

### Día 50-52: Dashboard Ejecutivo

#### ✅ Servicio Dashboard
- [ ] Crear `/src/services/dashboard.service.ts`
- [ ] **Métricas:**
  - [ ] `getMetricasGenerales()`
  - [ ] `getVentasPorDia(ultimosDias)`
  - [ ] `getVentasPorMes(mes, ano)`
  - [ ] `getProductosMasVendidos(limite)`
  - [ ] `getProductosStockCritico()`
  - [ ] `getRentabilidadPorCanal()`
  - [ ] `getCTRUPromedio()`
  - [ ] `getDiferenciasCambiarias Mes()`

#### ✅ UI - Dashboard Principal
- [ ] Crear `/src/pages/Dashboard.tsx`
- [ ] **Layout:**
  1. **KPIs Principales** (4 cards)
     - Total Unidades Perú
     - Valor Inventario
     - Ventas del Mes
     - Margen Promedio Mes
     
  2. **Gráfico de Ventas** (Recharts)
     - Línea temporal últimos 30 días
     - Comparación con mes anterior
     
  3. **Gráfico de Inventario**
     - Distribución USA/Perú/Tránsito
     - Por grupos de productos
     
  4. **Panel de Alertas**
     - Stock crítico
     - Productos próximos vencer
     - Cotizaciones por expirar
     - OCs pendientes pago
     - Diferencias cambiarias altas
     
  5. **Top 5 Productos**
     - Más vendidos
     - Mayor margen
     - Menor rotación
     
  6. **Actividad Reciente**
     - Últimas ventas
     - Últimas OCs
     - Movimientos recientes

#### ✅ Componentes de Gráficos
- [ ] `SalesChart.tsx` - Recharts LineChart
- [ ] `InventoryChart.tsx` - Recharts PieChart
- [ ] `MetricCard.tsx` - Card con icono y número
- [ ] `AlertPanel.tsx` - Lista de alertas
- [ ] `TopProductos.tsx` - Tabla compacta

---

### Día 53-54: Sistema de Notificaciones

#### ✅ Colección Notificaciones
- [ ] Crear colección en Firestore
- [ ] Tipos de notificaciones
- [ ] Estados: no leída, leída

#### ✅ Servicio de Notificaciones
- [ ] Crear `/src/services/notificaciones.service.ts`
- [ ] `createNotificacion(data)`
- [ ] `getNotificacionesUsuario(userId)`
- [ ] `marcarComoLeida(notifId)`
- [ ] `getCountNoLeidas(userId)`

#### ✅ UI - Notificaciones
- [ ] Badge en Header con count
- [ ] Dropdown con lista de notificaciones
- [ ] Click en notificación → navegar
- [ ] Marcar como leída al abrir

---

### Día 55-56: Reportes y Exportación

#### ✅ Módulo de Reportes
- [ ] Reporte de Ventas (Excel)
  - Por rango de fechas
  - Por canal
  - Desglose de productos
  - Rentabilidad
  
- [ ] Reporte de Inventario (Excel)
  - Estado actual por SKU
  - Valorización
  - Rotación
  
- [ ] Reporte de OCs (Excel)
  - Órdenes del mes
  - Diferencias cambiarias
  - Estado de pagos
  
- [ ] Reporte Financiero (Excel)
  - Ventas vs Compras
  - Márgenes
  - CTRUs promedio

#### ✅ Librería de Export
- [ ] Instalar `xlsx`
- [ ] Crear función genérica de export
- [ ] Formatos: Excel, CSV, PDF

---

### Día 57-58: Testing Integral

#### ✅ Testing de Integración E2E
- [ ] **Flujo completo:**
  1. Crear productos
  2. Investigar mercado
  3. Crear OC
  4. Pagar OC
  5. Recibir en USA
  6. Enviar a Perú
  7. Recibir en Perú
  8. Registrar gastos
  9. Crear cotización
  10. Convertir a venta
  11. Despachar
  12. Ver métricas en dashboard

#### ✅ Testing de Performance
- [ ] Cargar 100+ productos
- [ ] Crear 50+ OCs
- [ ] 200+ unidades
- [ ] Verificar tiempos de carga
- [ ] Optimizar queries lentas

#### ✅ Testing de Seguridad
- [ ] Reglas de Firestore
- [ ] Validaciones backend
- [ ] Protección de rutas

---

### Día 59-60: Deployment y Documentación

#### ✅ Deployment
- [ ] **Firebase Hosting**
  - Configurar firebase.json
  - Build de producción
  - Deploy
  
- [ ] **Cloud Functions**
  - Deploy de todas las funciones
  - Verificar logs
  - Testing en producción

#### ✅ Configuración de Producción
- [ ] Variables de entorno
- [ ] Configurar dominio custom
- [ ] SSL habilitado
- [ ] Backup automático de Firestore

#### ✅ Documentación
- [ ] README del proyecto
- [ ] Guía de instalación
- [ ] Guía de uso para usuarios
- [ ] Documentación técnica
- [ ] Diagramas actualizados

---

## 🎉 ENTREGABLES FINALES

### ✅ Sistema Funcional con:
- [ ] Módulo de Productos completo
- [ ] Módulo de Inventario con trazabilidad
- [ ] Módulo de Órdenes de Compra
- [ ] Módulo de Ventas y Cotizaciones
- [ ] Control Cambiario multicapa
- [ ] Cálculo CTRU dinámico automático
- [ ] Dashboard ejecutivo con métricas
- [ ] Sistema de alertas
- [ ] Reportes exportables
- [ ] Deployed en producción

### ✅ Documentación:
- [ ] Manual de usuario
- [ ] Documentación técnica
- [ ] Guías de procesos operativos

### ✅ Testing:
- [ ] Todos los flujos probados
- [ ] Performance optimizada
- [ ] Seguridad validada

---

## 🚀 PRÓXIMAS FASES

### Fase 2 (Meses 3-4):
- Gestión Comercial completa
- Requerimientos y seguimiento
- Pre-ventas con bloqueo
- WhatsApp Business integration
- Clientes y clasificación ABC

### Fase 3 (Meses 5-6):
- Logística completa
- Tracking courier
- Incidencias
- Alertas avanzadas

### Fase 4 (Meses 7-9):
- Integración ML API completa
- Sincronización automática
- Investigación de productos
- Forecasting demanda

### Fase 5 (Meses 10-12):
- Finanzas completas
- Auditoría cruzada
- Análisis avanzados
- BI y reporting ejecutivo

---

**¿LISTO PARA COMENZAR? 💪🔥**

Este checklist será tu mapa de ruta. Marca cada tarea conforme la completes y mantén el momentum. ¡Éxito!
