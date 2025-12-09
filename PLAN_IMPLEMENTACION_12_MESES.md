# 🚀 PLAN DE IMPLEMENTACIÓN COMPLETO - BMN 2.0
## Roadmap de 12 Meses para Sistema ERP Completo

---

## 📊 ESTADO ACTUAL (Baseline)

### ✅ Lo que YA está implementado (Fase 1 - 95%)

**Módulos Funcionales:**
- ✅ Productos & SKUs (100%)
- ✅ Inventario con Trazabilidad (100%)
- ✅ Órdenes de Compra (100%)
- ✅ Ventas & Cotizaciones (100%)
- ✅ Control Cambiario (100%)
- ✅ CTRU Dinámico (100%)
- ✅ Tipo de Cambio (100%)
- ✅ Configuración General (100%)
- ✅ Reportes Básicos (100%)
- ✅ Autenticación (100%)

**Líneas de código:** ~83,451 líneas en servicios
**Componentes:** 68 archivos TypeScript/TSX
**Calidad:** TypeScript strict, arquitectura profesional

### ❌ Lo que FALTA implementar

**Brechas en Fase 1 (5% faltante):**
1. ❌ Sistema de Notificaciones (email/push)
2. ❌ Exportación a Excel
3. ❌ Firestore Security Rules estrictas
4. ❌ Sistema de Roles y Permisos (RBAC)
5. ❌ Cloud Functions de validación backend
6. ❌ Dashboard con auto-refresh
7. ❌ Paginación en listados
8. ❌ Testing E2E completo
9. ❌ Deployment en producción

**Fases completas por implementar:**
- ❌ Fase 2: Comercial Avanzado (0%)
- ❌ Fase 3: Logística Completa (0%)
- ❌ Fase 4: Integraciones (0%)
- ❌ Fase 5: Finanzas y BI (0%)

---

## 🎯 ESTRATEGIA DE IMPLEMENTACIÓN

### Enfoque: **Desarrollo Iterativo con Testing Continuo**

```
┌────────────────────────────────────────────────────────┐
│  COMPLETAR → PROBAR → USAR → ITERAR → SIGUIENTE FASE  │
└────────────────────────────────────────────────────────┘
```

**Principios:**
1. ✅ **Completar cada fase al 100%** antes de pasar a la siguiente
2. 🧪 **Testing exhaustivo** en cada módulo
3. 📝 **Documentación** mientras desarrollas
4. 🔄 **Code reviews** de componentes críticos
5. 🚀 **Deploy incremental** en staging

---

# 📅 MES 1: COMPLETAR FASE 1 AL 100%

## Semana 1: Seguridad y Fundamentos (35-40 horas)

### 🔐 Día 1-2: Firestore Security Rules (8h)

**Objetivo:** Proteger la base de datos con reglas estrictas

**Tareas:**
- [ ] Crear `/firestore.rules` con reglas por colección
- [ ] Implementar validación de campos
- [ ] Restringir accesos por rol
- [ ] Testing de reglas con Firebase Emulator

**Código a implementar:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function hasRole(role) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == role;
    }

    function isOwnerOrAdmin(userId) {
      return isAuthenticated() &&
             (request.auth.uid == userId || hasRole('admin') || hasRole('socio'));
    }

    // Productos: lectura todos autenticados, escritura solo admin/socio
    match /productos/{productoId} {
      allow read: if isAuthenticated();
      allow create, update: if hasRole('admin') || hasRole('socio');
      allow delete: if hasRole('admin');
    }

    // Unidades: lectura todos, escritura solo operativo+
    match /unidades/{unidadId} {
      allow read: if isAuthenticated();
      allow create, update: if hasRole('admin') || hasRole('socio') || hasRole('operativo');
      allow delete: if hasRole('admin');
    }

    // Ventas: vendedores pueden crear, todos leer
    match /ventas/{ventaId} {
      allow read: if isAuthenticated();
      allow create: if hasRole('admin') || hasRole('socio') || hasRole('vendedor');
      allow update: if hasRole('admin') || hasRole('socio');
      allow delete: if hasRole('admin');
    }

    // Órdenes de Compra: solo admin/socio
    match /ordenesCompra/{ordenId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('admin') || hasRole('socio');
    }

    // Tipo de Cambio: todos leen, admin escribe
    match /tiposCambio/{tcId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('admin') || hasRole('socio');
    }

    // Configuración: solo admin
    match /configuracion/{configId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('admin');
    }

    // Usuarios: cada usuario su perfil, admin todo
    match /usuarios/{userId} {
      allow read: if isOwnerOrAdmin(userId);
      allow update: if isOwnerOrAdmin(userId);
      allow create, delete: if hasRole('admin');
    }

    // Proveedores: todos leen, admin/socio escriben
    match /proveedores/{proveedorId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('admin') || hasRole('socio');
    }

    // Reportes: solo lectura
    match /reportes/{reporteId} {
      allow read: if isAuthenticated();
      allow write: if false; // Generados por Cloud Functions
    }

    // Default: denegar todo
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Entregable:**
- ✅ Archivo `firestore.rules` completo
- ✅ Testing de reglas documentado
- ✅ Deploy de reglas a Firebase

---

### 👥 Día 3-4: Sistema de Roles y Permisos RBAC (12h)

**Objetivo:** Implementar control de acceso basado en roles

**Tareas:**
- [ ] Crear tipos TypeScript para roles
- [ ] Crear colección `usuarios` en Firestore
- [ ] Implementar middleware de permisos
- [ ] Crear UI de gestión de usuarios (admin)
- [ ] Integrar con Auth existente

**Tipos a crear:**
```typescript
// /src/types/auth.types.ts
export type Role = 'admin' | 'socio' | 'vendedor' | 'operativo';

export interface Permiso {
  modulo: string;
  acciones: ('crear' | 'leer' | 'editar' | 'eliminar')[];
}

export interface Usuario {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  nombre: string;
  apellido: string;
  role: Role;
  permisos: Permiso[];
  activo: boolean;
  fechaCreacion: Timestamp;
  ultimoAcceso?: Timestamp;
}

export const PERMISOS_POR_ROL: Record<Role, Permiso[]> = {
  admin: [
    { modulo: '*', acciones: ['crear', 'leer', 'editar', 'eliminar'] }
  ],
  socio: [
    { modulo: 'productos', acciones: ['crear', 'leer', 'editar', 'eliminar'] },
    { modulo: 'ventas', acciones: ['crear', 'leer', 'editar', 'eliminar'] },
    { modulo: 'ordenesCompra', acciones: ['crear', 'leer', 'editar', 'eliminar'] },
    { modulo: 'inventario', acciones: ['leer', 'editar'] },
    { modulo: 'reportes', acciones: ['leer'] },
    { modulo: 'tipoCambio', acciones: ['crear', 'leer', 'editar'] },
    { modulo: 'configuracion', acciones: ['leer', 'editar'] }
  ],
  vendedor: [
    { modulo: 'productos', acciones: ['leer'] },
    { modulo: 'ventas', acciones: ['crear', 'leer', 'editar'] },
    { modulo: 'inventario', acciones: ['leer'] },
    { modulo: 'reportes', acciones: ['leer'] }
  ],
  operativo: [
    { modulo: 'productos', acciones: ['leer'] },
    { modulo: 'inventario', acciones: ['leer', 'editar'] },
    { modulo: 'ordenesCompra', acciones: ['leer', 'editar'] },
    { modulo: 'ventas', acciones: ['leer'] }
  ]
};
```

**Servicio a crear:**
```typescript
// /src/services/usuarios.service.ts
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Usuario, Role, PERMISOS_POR_ROL } from '@/types/auth.types';

export class UsuariosService {
  private collectionName = 'usuarios';

  async createUsuario(data: {
    uid: string;
    email: string;
    nombre: string;
    apellido: string;
    role: Role;
  }): Promise<Usuario> {
    const usuario: Usuario = {
      id: data.uid,
      uid: data.uid,
      email: data.email,
      nombre: data.nombre,
      apellido: data.apellido,
      role: data.role,
      permisos: PERMISOS_POR_ROL[data.role],
      activo: true,
      fechaCreacion: Timestamp.now()
    };

    await setDoc(doc(db, this.collectionName, usuario.id), usuario);
    return usuario;
  }

  async getUsuario(uid: string): Promise<Usuario | null> {
    const docRef = doc(db, this.collectionName, uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return docSnap.data() as Usuario;
  }

  async getAllUsuarios(): Promise<Usuario[]> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    return snapshot.docs.map(doc => doc.data() as Usuario);
  }

  async updateRole(uid: string, newRole: Role): Promise<void> {
    await updateDoc(doc(db, this.collectionName, uid), {
      role: newRole,
      permisos: PERMISOS_POR_ROL[newRole]
    });
  }

  async toggleActivo(uid: string, activo: boolean): Promise<void> {
    await updateDoc(doc(db, this.collectionName, uid), { activo });
  }

  tienePermiso(usuario: Usuario, modulo: string, accion: 'crear' | 'leer' | 'editar' | 'eliminar'): boolean {
    // Admin tiene todos los permisos
    if (usuario.role === 'admin') return true;

    // Verificar permisos específicos
    const permiso = usuario.permisos.find(p => p.modulo === modulo || p.modulo === '*');
    return permiso?.acciones.includes(accion) ?? false;
  }
}

export const usuariosService = new UsuariosService();
```

**Componente UI a crear:**
```typescript
// /src/pages/Admin/Usuarios.tsx
// Listado de usuarios con gestión de roles
```

**Entregable:**
- ✅ Sistema RBAC funcional
- ✅ UI de gestión de usuarios
- ✅ Middleware de permisos integrado

---

### ⚙️ Día 5: Cloud Functions - Setup y Validaciones (8h)

**Objetivo:** Configurar Cloud Functions para lógica backend

**Tareas:**
- [ ] Inicializar Cloud Functions en el proyecto
- [ ] Configurar TypeScript para functions
- [ ] Implementar funciones de validación
- [ ] Implementar triggers automáticos

**Setup inicial:**
```bash
cd /home/user/NewSystem
firebase init functions

# Seleccionar:
# - TypeScript
# - ESLint
# - Install dependencies
```

**Funciones a implementar:**

**1. Validación de Stock al crear Venta**
```typescript
// functions/src/triggers/ventas.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validarStockAnteVenta = functions.firestore
  .document('ventas/{ventaId}')
  .onCreate(async (snap, context) => {
    const venta = snap.data();

    // Si no es venta confirmada, skip
    if (venta.estado === 'cotizacion') return;

    const db = admin.firestore();

    // Verificar stock de cada producto
    for (const item of venta.productos) {
      const unidadesQuery = db.collection('unidades')
        .where('skuId', '==', item.productoId)
        .where('estado', '==', 'disponible_peru');

      const snapshot = await unidadesQuery.get();
      const stockDisponible = snapshot.size;

      if (stockDisponible < item.cantidad) {
        // Marcar venta como ERROR
        await snap.ref.update({
          estado: 'error',
          errorMessage: `Stock insuficiente: ${item.nombreProducto}. Disponible: ${stockDisponible}, Solicitado: ${item.cantidad}`,
          fechaError: admin.firestore.FieldValue.serverTimestamp()
        });

        // Crear notificación para admin
        await db.collection('notificaciones').add({
          tipo: 'error_stock',
          titulo: 'Venta sin stock suficiente',
          mensaje: `Venta ${venta.numeroVenta} no puede procesarse por falta de stock`,
          ventaId: snap.id,
          fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
          leida: false,
          usuarios: ['admin'] // Enviar a todos los admin
        });

        return;
      }
    }
  });
```

**2. Actualizar Stock Producto cuando cambian Unidades**
```typescript
// functions/src/triggers/inventario.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const actualizarStockProducto = functions.firestore
  .document('unidades/{unidadId}')
  .onWrite(async (change, context) => {
    const db = admin.firestore();

    // Obtener el SKU afectado
    const unidadNueva = change.after.exists ? change.after.data() : null;
    const unidadAnterior = change.before.exists ? change.before.data() : null;

    const skuId = unidadNueva?.skuId || unidadAnterior?.skuId;
    if (!skuId) return;

    // Contar unidades por estado
    const unidadesSnapshot = await db.collection('unidades')
      .where('skuId', '==', skuId)
      .get();

    let stockPeru = 0;
    let stockUSA = 0;
    let stockTransito = 0;
    let stockReservado = 0;

    unidadesSnapshot.forEach(doc => {
      const unidad = doc.data();
      switch (unidad.estado) {
        case 'disponible_peru':
          stockPeru++;
          break;
        case 'recibida_usa':
          stockUSA++;
          break;
        case 'en_transito':
          stockTransito++;
          break;
        case 'asignada_pedido':
          stockReservado++;
          break;
      }
    });

    // Actualizar producto
    await db.collection('productos').doc(skuId).update({
      stockPeru,
      stockUSA,
      stockTransito,
      stockReservado,
      ultimaActualizacionStock: admin.firestore.FieldValue.serverTimestamp()
    });
  });
```

**3. Generar Unidades al recibir OC**
```typescript
// functions/src/triggers/ordenesCompra.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const generarUnidadesAlRecibirOC = functions.firestore
  .document('ordenesCompra/{ordenId}')
  .onUpdate(async (change, context) => {
    const ordenNueva = change.after.data();
    const ordenAnterior = change.before.data();

    // Detectar cambio a estado "recibida_usa"
    if (ordenAnterior.estado !== 'recibida_usa' && ordenNueva.estado === 'recibida_usa') {
      const db = admin.firestore();
      const batch = db.batch();

      // Por cada producto en la OC
      for (const item of ordenNueva.productos) {
        // Crear N unidades (N = cantidad recibida o cantidad)
        const cantidadACrear = item.cantidadRecibida || item.cantidad;

        for (let i = 0; i < cantidadACrear; i++) {
          const unidadRef = db.collection('unidades').doc();

          const unidad = {
            id: unidadRef.id,
            skuId: item.productoId,
            nombreProducto: item.nombreProducto,

            // Costos
            costoUSA: item.precioUnitario,
            tcCompra: ordenNueva.tcCompra,
            tcPago: ordenNueva.tcPago || ordenNueva.tcCompra,
            costoEnvioProrrateo: 0, // Se calcula después
            gastosOperativosProrrateo: 0,
            ctruInicial: 0, // Se calcula al llegar a Perú
            ctruDinamico: 0,

            // Estado y ubicación
            estado: 'recibida_usa',
            almacenActual: ordenNueva.almacenDestino,

            // Origen
            ordenCompraId: context.params.ordenId,
            numeroOrdenCompra: ordenNueva.numeroOrden,
            proveedorId: ordenNueva.proveedorId,

            // Fechas
            fechaOrigen: ordenNueva.fechaRecepcionUSA || admin.firestore.FieldValue.serverTimestamp(),
            fechaVencimiento: null, // Configurar manualmente después

            // Historial
            historial: [{
              fecha: admin.firestore.FieldValue.serverTimestamp(),
              tipoMovimiento: 'recepcion_usa',
              estadoAnterior: null,
              estadoNuevo: 'recibida_usa',
              almacenDestino: ordenNueva.almacenDestino,
              usuario: ordenNueva.editadoPor || 'sistema',
              notas: `Recepción de OC ${ordenNueva.numeroOrden}`
            }],

            // Metadata
            creadoPor: 'sistema',
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
          };

          batch.set(unidadRef, unidad);
        }
      }

      await batch.commit();

      // Crear notificación
      await db.collection('notificaciones').add({
        tipo: 'oc_recibida',
        titulo: 'Orden de Compra Recibida en USA',
        mensaje: `OC ${ordenNueva.numeroOrden} recibida. ${ordenNueva.productos.length} productos generaron unidades en inventario.`,
        ordenCompraId: context.params.ordenId,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        leida: false,
        usuarios: ['admin', 'socio', 'operativo']
      });
    }
  });
```

**Entregable:**
- ✅ Cloud Functions configurado
- ✅ 3 triggers implementados
- ✅ Testing local con emulador

---

### 📊 Día 6-7: Dashboard con Auto-refresh (10h)

**Objetivo:** Mejorar dashboard con actualización automática y KPIs completos

**Tareas:**
- [ ] Implementar auto-refresh cada 30 segundos
- [ ] Agregar KPIs faltantes del manual
- [ ] Mejorar gráficos con Recharts
- [ ] Agregar panel de alertas

**Componente mejorado:**
```typescript
// /src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reporteService } from '@/services/reporte.service';
import { ventaService } from '@/services/venta.service';
import { inventarioService } from '@/services/inventario.service';
import { LineChart, PieChart, BarChart } from 'recharts';

export default function Dashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Query con auto-refetch cada 30 segundos
  const { data: resumen, isLoading } = useQuery({
    queryKey: ['dashboard', 'resumen'],
    queryFn: () => reporteService.getResumenEjecutivo(),
    refetchInterval: autoRefresh ? 30000 : false,
    refetchOnWindowFocus: true
  });

  const { data: tendenciaVentas } = useQuery({
    queryKey: ['dashboard', 'tendencia'],
    queryFn: () => reporteService.getTendenciaVentas(30),
    refetchInterval: autoRefresh ? 60000 : false
  });

  const { data: alertas } = useQuery({
    queryKey: ['dashboard', 'alertas'],
    queryFn: () => reporteService.getAlertasInventario(),
    refetchInterval: autoRefresh ? 30000 : false
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="p-6 space-y-6">
      {/* Header con toggle auto-refresh */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-actualizar</span>
        </label>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Unidades Perú"
          value={resumen?.totalUnidadesPeru || 0}
          icon={<Package />}
          trend={resumen?.variacionUnidades}
        />
        <MetricCard
          title="Valor Inventario"
          value={`S/ ${resumen?.valorInventario.toFixed(2) || 0}`}
          icon={<DollarSign />}
          trend={resumen?.variacionValor}
        />
        <MetricCard
          title="Ventas del Mes"
          value={`S/ ${resumen?.ventasMes.toFixed(2) || 0}`}
          icon={<TrendingUp />}
          trend={resumen?.variacionVentas}
        />
        <MetricCard
          title="Margen Promedio"
          value={`${resumen?.margenPromedio.toFixed(1) || 0}%`}
          icon={<Percent />}
          trend={resumen?.variacionMargen}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas últimos 30 días */}
        <Card>
          <CardHeader>Tendencia de Ventas (30 días)</CardHeader>
          <CardBody>
            <LineChart width={500} height={300} data={tendenciaVentas}>
              {/* Configuración del gráfico */}
            </LineChart>
          </CardBody>
        </Card>

        {/* Distribución inventario */}
        <Card>
          <CardHeader>Distribución de Inventario</CardHeader>
          <CardBody>
            <PieChart width={500} height={300}>
              {/* Configuración del gráfico */}
            </PieChart>
          </CardBody>
        </Card>
      </div>

      {/* Panel de Alertas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-500" />
            <span>Alertas Activas ({alertas?.length || 0})</span>
          </div>
        </CardHeader>
        <CardBody>
          {alertas?.map(alerta => (
            <AlertItem key={alerta.id} alerta={alerta} />
          ))}
        </CardBody>
      </Card>

      {/* Top 5 Productos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>Más Vendidos</CardHeader>
          <CardBody>
            <TopProductosTable tipo="vendidos" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Mayor Margen</CardHeader>
          <CardBody>
            <TopProductosTable tipo="margen" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Menor Rotación</CardHeader>
          <CardBody>
            <TopProductosTable tipo="rotacion" />
          </CardBody>
        </Card>
      </div>

      {/* Actividad Reciente */}
      <Card>
        <CardHeader>Actividad Reciente</CardHeader>
        <CardBody>
          <ActividadReciente />
        </CardBody>
      </Card>
    </div>
  );
}
```

**Entregable:**
- ✅ Dashboard con auto-refresh
- ✅ Todos los KPIs del manual
- ✅ Gráficos mejorados
- ✅ Panel de alertas funcional

---

## Semana 2: Notificaciones y Exportación (35-40 horas)

### 🔔 Día 8-9: Sistema de Notificaciones (12h)

**Objetivo:** Implementar notificaciones in-app y email

**Tareas:**
- [ ] Crear colección `notificaciones` en Firestore
- [ ] Implementar servicio de notificaciones
- [ ] Crear UI de notificaciones en header
- [ ] Implementar Cloud Function para emails

**Tipos:**
```typescript
// /src/types/notificacion.types.ts
export type TipoNotificacion =
  | 'stock_critico'
  | 'producto_vencimiento'
  | 'oc_pendiente_pago'
  | 'diferencia_cambiaria'
  | 'venta_nueva'
  | 'error_stock'
  | 'oc_recibida'
  | 'cotizacion_expira';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;

  // Referencias opcionales
  productoId?: string;
  ventaId?: string;
  ordenCompraId?: string;

  // Estado
  leida: boolean;
  fechaCreacion: Timestamp;
  fechaLeida?: Timestamp;

  // Usuarios destinatarios
  usuarios: string[]; // 'admin', 'socio', etc.

  // Acciones
  urlAccion?: string; // Link para navegar

  // Metadata
  severidad: 'info' | 'warning' | 'error' | 'success';
}
```

**Servicio:**
```typescript
// /src/services/notificaciones.service.ts
export class NotificacionesService {
  async create(data: Omit<Notificacion, 'id' | 'fechaCreacion'>): Promise<Notificacion> {
    const docRef = doc(collection(db, 'notificaciones'));
    const notificacion: Notificacion = {
      id: docRef.id,
      ...data,
      fechaCreacion: Timestamp.now()
    };

    await setDoc(docRef, notificacion);
    return notificacion;
  }

  async getByUsuario(role: string, limit = 20): Promise<Notificacion[]> {
    const q = query(
      collection(db, 'notificaciones'),
      where('usuarios', 'array-contains', role),
      orderBy('fechaCreacion', 'desc'),
      limit(limit)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Notificacion);
  }

  async marcarLeida(id: string): Promise<void> {
    await updateDoc(doc(db, 'notificaciones', id), {
      leida: true,
      fechaLeida: Timestamp.now()
    });
  }

  async getCountNoLeidas(role: string): Promise<number> {
    const q = query(
      collection(db, 'notificaciones'),
      where('usuarios', 'array-contains', role),
      where('leida', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }
}
```

**Cloud Function para Emails:**
```typescript
// functions/src/notifications/emailAlerts.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password
  }
});

export const enviarEmailNotificacion = functions.firestore
  .document('notificaciones/{notifId}')
  .onCreate(async (snap, context) => {
    const notif = snap.data();

    // Solo enviar email para severidad warning o error
    if (notif.severidad !== 'warning' && notif.severidad !== 'error') {
      return;
    }

    const db = admin.firestore();

    // Obtener emails de usuarios destinatarios
    const usuariosSnapshot = await db.collection('usuarios')
      .where('role', 'in', notif.usuarios)
      .where('activo', '==', true)
      .get();

    const emails = usuariosSnapshot.docs.map(doc => doc.data().email);

    if (emails.length === 0) return;

    const mailOptions = {
      from: 'BMN System <noreply@bmn.com>',
      to: emails.join(','),
      subject: `${notif.severidad === 'error' ? '⚠️' : '⚡'} ${notif.titulo}`,
      html: `
        <h2>${notif.titulo}</h2>
        <p>${notif.mensaje}</p>
        <p><small>Fecha: ${new Date().toLocaleString('es-PE')}</small></p>
        ${notif.urlAccion ? `<a href="${notif.urlAccion}">Ver detalles</a>` : ''}
      `
    };

    await transporter.sendMail(mailOptions);
  });

// Función programada: revisar stock crítico diario
export const revisarStockCritico = functions.pubsub
  .schedule('0 9 * * *') // 9 AM diario
  .timeZone('America/Lima')
  .onRun(async (context) => {
    const db = admin.firestore();

    const productosSnapshot = await db.collection('productos')
      .where('estado', '==', 'activo')
      .get();

    const productosCriticos = [];

    for (const doc of productosSnapshot.docs) {
      const producto = doc.data();
      if (producto.stockPeru <= producto.stockMinimo) {
        productosCriticos.push(producto);
      }
    }

    if (productosCriticos.length === 0) return;

    // Crear notificación
    await db.collection('notificaciones').add({
      tipo: 'stock_critico',
      titulo: `${productosCriticos.length} productos con stock crítico`,
      mensaje: `Los siguientes productos requieren reposición: ${productosCriticos.map(p => p.nombreComercial).join(', ')}`,
      leida: false,
      usuarios: ['admin', 'socio', 'operativo'],
      severidad: 'warning',
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    });
  });
```

**UI Componente:**
```typescript
// /src/components/layout/NotificationsDropdown.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';

export function NotificationsDropdown() {
  const { data: user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: notificaciones } = useQuery({
    queryKey: ['notificaciones', user?.role],
    queryFn: () => notificacionesService.getByUsuario(user!.role),
    enabled: !!user,
    refetchInterval: 30000 // Cada 30 segundos
  });

  const { data: count } = useQuery({
    queryKey: ['notificaciones', 'count', user?.role],
    queryFn: () => notificacionesService.getCountNoLeidas(user!.role),
    enabled: !!user,
    refetchInterval: 10000 // Cada 10 segundos
  });

  const marcarLeida = useMutation({
    mutationFn: (id: string) => notificacionesService.marcarLeida(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notificaciones']);
    }
  });

  return (
    <Popover>
      <PopoverTrigger>
        <button className="relative">
          <Bell className="w-6 h-6" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Notificaciones</h3>

        {notificaciones?.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay notificaciones</p>
        ) : (
          <div className="space-y-2">
            {notificaciones?.map(notif => (
              <div
                key={notif.id}
                className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${!notif.leida ? 'bg-blue-50' : ''}`}
                onClick={() => {
                  marcarLeida.mutate(notif.id);
                  if (notif.urlAccion) {
                    window.location.href = notif.urlAccion;
                  }
                }}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1 ${
                    notif.severidad === 'error' ? 'bg-red-500' :
                    notif.severidad === 'warning' ? 'bg-yellow-500' :
                    notif.severidad === 'success' ? 'bg-green-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{notif.titulo}</p>
                    <p className="text-xs text-gray-600">{notif.mensaje}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(notif.fechaCreacion.toDate(), { locale: es, addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Entregable:**
- ✅ Sistema de notificaciones in-app
- ✅ Emails automáticos
- ✅ Funciones programadas para alertas
- ✅ UI de notificaciones en header

---

### 📥 Día 10-11: Exportación a Excel (10h)

**Objetivo:** Implementar exportación de reportes a Excel

**Tareas:**
- [ ] Instalar librería `xlsx`
- [ ] Crear servicio de exportación
- [ ] Implementar exportación en módulos
- [ ] Testing de formatos

**Instalación:**
```bash
npm install xlsx
npm install @types/xlsx --save-dev
```

**Servicio de Exportación:**
```typescript
// /src/services/export.service.ts
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export class ExportService {

  /**
   * Exportar datos a Excel
   */
  exportToExcel<T>(
    data: T[],
    nombreArchivo: string,
    nombreHoja: string = 'Datos'
  ): void {
    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Convertir datos a worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho de columnas automáticamente
    const colWidths = this.calcularAnchoColumnas(data);
    ws['!cols'] = colWidths;

    // Agregar hoja al workbook
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);

    // Generar archivo
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Descargar
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, `${nombreArchivo}_${this.getFechaActual()}.xlsx`);
  }

  /**
   * Exportar múltiples hojas
   */
  exportMultiSheet(
    hojas: Array<{ nombre: string; datos: any[] }>,
    nombreArchivo: string
  ): void {
    const wb = XLSX.utils.book_new();

    hojas.forEach(hoja => {
      const ws = XLSX.utils.json_to_sheet(hoja.datos);
      const colWidths = this.calcularAnchoColumnas(hoja.datos);
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, hoja.nombre);
    });

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, `${nombreArchivo}_${this.getFechaActual()}.xlsx`);
  }

  /**
   * Exportar reporte de ventas
   */
  async exportReporteVentas(
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<void> {
    const ventas = await ventaService.getByRangoFechas(fechaInicio, fechaFin);

    const datosExport = ventas.map(venta => ({
      'N° Venta': venta.numeroVenta,
      'Fecha': format(venta.fechaVenta.toDate(), 'dd/MM/yyyy'),
      'Cliente': venta.cliente.nombre,
      'Canal': venta.canal,
      'Estado': venta.estado,
      'Subtotal': venta.total - (venta.costoDelivery || 0),
      'Delivery': venta.costoDelivery || 0,
      'Total (S/)': venta.total,
      'Costo Total': venta.costoTotal,
      'Margen Bruto (S/)': venta.margenBruto,
      'Margen Bruto (%)': venta.margenBrutoPorcentaje,
      'Margen Neto (S/)': venta.margenNeto,
      'Margen Neto (%)': venta.margenNetoPorcentaje
    }));

    this.exportToExcel(datosExport, 'Reporte_Ventas', 'Ventas');
  }

  /**
   * Exportar inventario valorizado
   */
  async exportInventarioValorizado(): Promise<void> {
    const inventario = await reporteService.getInventarioValorizado();

    const datosExport = inventario.map(item => ({
      'SKU': item.sku,
      'Producto': item.nombreProducto,
      'Marca': item.marca,
      'Grupo': item.grupo,
      'Stock Perú': item.stockPeru,
      'Stock USA': item.stockUSA,
      'Stock Tránsito': item.stockTransito,
      'CTRU Promedio': item.ctruPromedio,
      'Valor Total (S/)': item.valorTotal,
      'Rotación Mensual': item.rotacionMensual,
      'Estado': item.estado
    }));

    this.exportToExcel(datosExport, 'Inventario_Valorizado', 'Inventario');
  }

  /**
   * Exportar órdenes de compra
   */
  async exportOrdenesCompra(
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<void> {
    const ordenes = await ordenCompraService.getByRangoFechas(fechaInicio, fechaFin);

    const datosExport = ordenes.map(oc => ({
      'N° OC': oc.numeroOrden,
      'Fecha': format(oc.fechaOrden.toDate(), 'dd/MM/yyyy'),
      'Proveedor': oc.nombreProveedor,
      'Total USD': oc.totalUSD,
      'TC Compra': oc.tcCompra,
      'TC Pago': oc.tcPago || '-',
      'Diferencia TC (%)': oc.tcPago ?
        (((oc.tcPago - oc.tcCompra) / oc.tcCompra) * 100).toFixed(2) : '-',
      'Total PEN Compra': (oc.totalUSD * oc.tcCompra).toFixed(2),
      'Total PEN Pago': oc.tcPago ? (oc.totalUSD * oc.tcPago).toFixed(2) : '-',
      'Estado': oc.estado,
      'Almacén Destino': oc.almacenDestino
    }));

    this.exportToExcel(datosExport, 'Ordenes_Compra', 'Órdenes');
  }

  /**
   * Reporte financiero completo (multi-sheet)
   */
  async exportReporteFinanciero(
    mes: number,
    ano: number
  ): Promise<void> {
    const resumen = await reporteService.getResumenEjecutivo();
    const ventas = await ventaService.getByMes(mes, ano);
    const ordenes = await ordenCompraService.getByMes(mes, ano);

    // Hoja 1: Resumen Ejecutivo
    const hojaResumen = [{
      'Métrica': 'Total Ventas',
      'Valor': `S/ ${resumen.ventasMes.toFixed(2)}`
    }, {
      'Métrica': 'Total Compras',
      'Valor': `S/ ${resumen.comprasMes.toFixed(2)}`
    }, {
      'Métrica': 'Margen Promedio',
      'Valor': `${resumen.margenPromedio.toFixed(2)}%`
    }, {
      'Métrica': 'Unidades Vendidas',
      'Valor': resumen.unidadesVendidas
    }, {
      'Métrica': 'Valor Inventario',
      'Valor': `S/ ${resumen.valorInventario.toFixed(2)}`
    }];

    // Hoja 2: Detalle Ventas
    const hojaVentas = ventas.map(v => ({
      'N° Venta': v.numeroVenta,
      'Fecha': format(v.fechaVenta.toDate(), 'dd/MM/yyyy'),
      'Cliente': v.cliente.nombre,
      'Canal': v.canal,
      'Total': v.total,
      'Margen Neto': v.margenNeto,
      'Margen %': v.margenNetoPorcentaje
    }));

    // Hoja 3: Detalle Compras
    const hojaCompras = ordenes.map(oc => ({
      'N° OC': oc.numeroOrden,
      'Fecha': format(oc.fechaOrden.toDate(), 'dd/MM/yyyy'),
      'Proveedor': oc.nombreProveedor,
      'Total USD': oc.totalUSD,
      'Total PEN': (oc.totalUSD * oc.tcPago).toFixed(2),
      'Estado': oc.estado
    }));

    this.exportMultiSheet([
      { nombre: 'Resumen', datos: hojaResumen },
      { nombre: 'Ventas', datos: hojaVentas },
      { nombre: 'Compras', datos: hojaCompras }
    ], `Reporte_Financiero_${mes}_${ano}`);
  }

  // Helpers privados
  private calcularAnchoColumnas(data: any[]): any[] {
    if (!data || data.length === 0) return [];

    const keys = Object.keys(data[0]);
    return keys.map(key => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) }; // Max 50 caracteres
    });
  }

  private getFechaActual(): string {
    return format(new Date(), 'yyyyMMdd_HHmmss');
  }
}

export const exportService = new ExportService();
```

**Integración en componentes:**
```typescript
// Ejemplo en página de Reportes
export function Reportes() {
  const [fechaInicio, setFechaInicio] = useState(startOfMonth(new Date()));
  const [fechaFin, setFechaFin] = useState(endOfMonth(new Date()));

  const handleExportVentas = async () => {
    await exportService.exportReporteVentas(fechaInicio, fechaFin);
  };

  const handleExportInventario = async () => {
    await exportService.exportInventarioValorizado();
  };

  const handleExportFinanciero = async () => {
    const mes = getMonth(fechaInicio);
    const ano = getYear(fechaInicio);
    await exportService.exportReporteFinanciero(mes, ano);
  };

  return (
    <div>
      <h1>Reportes</h1>

      {/* Selectores de fecha */}
      <DateRangePicker
        start={fechaInicio}
        end={fechaFin}
        onChange={(start, end) => {
          setFechaInicio(start);
          setFechaFin(end);
        }}
      />

      {/* Botones de exportación */}
      <div className="flex gap-4">
        <Button onClick={handleExportVentas}>
          <Download className="mr-2" />
          Exportar Ventas
        </Button>

        <Button onClick={handleExportInventario}>
          <Download className="mr-2" />
          Exportar Inventario
        </Button>

        <Button onClick={handleExportFinanciero}>
          <Download className="mr-2" />
          Reporte Financiero
        </Button>
      </div>

      {/* Resto de la UI */}
    </div>
  );
}
```

**Entregable:**
- ✅ Exportación a Excel funcional
- ✅ Reportes de ventas, inventario, OCs
- ✅ Reporte financiero multi-sheet
- ✅ Formato profesional con anchos auto

---

### 📄 Día 12-14: Paginación y Optimización (14h)

**Objetivo:** Implementar paginación en listados grandes

**Tareas:**
- [ ] Implementar paginación en ProductoService
- [ ] Implementar paginación en VentaService
- [ ] Implementar paginación en InventarioService
- [ ] Crear componente `Pagination` reutilizable
- [ ] Optimizar queries con índices

**Servicio con paginación:**
```typescript
// /src/services/producto.service.ts (mejorado)
interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  lastDoc?: any;
}

export class ProductoService {

  async getPaginados(
    page: number = 1,
    pageSize: number = 20,
    filtros?: {
      estado?: EstadoProducto;
      marca?: string;
      grupo?: string;
      busqueda?: string;
    }
  ): Promise<PaginationResult<Producto>> {

    // Construir query base
    let q = query(
      collection(db, 'productos'),
      orderBy('fechaCreacion', 'desc')
    );

    // Aplicar filtros
    if (filtros?.estado) {
      q = query(q, where('estado', '==', filtros.estado));
    }
    if (filtros?.marca) {
      q = query(q, where('marca', '==', filtros.marca));
    }
    if (filtros?.grupo) {
      q = query(q, where('grupo', '==', filtros.grupo));
    }

    // Obtener total (para calcular páginas)
    const totalSnapshot = await getDocs(q);
    const total = totalSnapshot.size;

    // Aplicar paginación
    const offset = (page - 1) * pageSize;
    q = query(q, limit(pageSize), startAt(offset));

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => doc.data() as Producto);

    // Si hay búsqueda, filtrar en memoria (no ideal, pero funciona)
    let filteredItems = items;
    if (filtros?.busqueda) {
      const termino = filtros.busqueda.toLowerCase();
      filteredItems = items.filter(p =>
        p.nombreComercial.toLowerCase().includes(termino) ||
        p.marca.toLowerCase().includes(termino) ||
        p.sku.toLowerCase().includes(termino)
      );
    }

    return {
      items: filteredItems,
      total,
      page,
      pageSize,
      hasMore: (page * pageSize) < total,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
  }
}
```

**Componente de Paginación:**
```typescript
// /src/components/common/Pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange
}: PaginationProps) {

  const totalPages = Math.ceil(totalItems / pageSize);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Generar array de páginas (mostrar max 7 páginas)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Siempre mostrar primera página
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    // Páginas alrededor de la actual
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    // Siempre mostrar última página
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      {/* Info */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>

      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Mostrando{' '}
            <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
            {' '}-{' '}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>
            {' '}de{' '}
            <span className="font-medium">{totalItems}</span>
            {' '}resultados
          </p>
        </div>

        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
            {/* Botón Anterior */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canGoPrev}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Números de página */}
            {getPageNumbers().map((pageNum, idx) => (
              pageNum === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                >
                  ...
                </span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum as number)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    pageNum === currentPage
                      ? 'z-10 bg-blue-600 text-white ring-2 ring-blue-600'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              )
            ))}

            {/* Botón Siguiente */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canGoNext}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
```

**Uso en componente:**
```typescript
// /src/pages/Productos/Productos.tsx (con paginación)
export function Productos() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filtros, setFiltros] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['productos', 'paginados', page, pageSize, filtros],
    queryFn: () => productoService.getPaginados(page, pageSize, filtros)
  });

  return (
    <div>
      <ProductoTable productos={data?.items || []} />

      {data && (
        <Pagination
          currentPage={page}
          totalItems={data.total}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

**Índices Firestore necesarios:**
```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "productos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "fechaCreacion", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "productos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "grupo", "order": "ASCENDING" },
        { "fieldPath": "fechaCreacion", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ventas",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "fechaVenta", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "unidades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "skuId", "order": "ASCENDING" },
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "fechaVencimiento", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Entregable:**
- ✅ Paginación en Productos, Ventas, Inventario
- ✅ Componente Pagination reutilizable
- ✅ Índices Firestore optimizados
- ✅ Performance mejorada

---

## Semana 3-4: Testing, Deploy y Documentación (70 horas)

### 🧪 Día 15-18: Testing E2E Completo (28h)

**Objetivo:** Probar todos los flujos end-to-end

**Tareas:**
- [ ] Setup de Firebase Emulators
- [ ] Crear datos de prueba (seed)
- [ ] Testing de flujo completo OC → Venta
- [ ] Testing de casos edge
- [ ] Documentar resultados

**Setup Emulators:**
```bash
firebase init emulators

# Seleccionar:
# - Authentication
# - Firestore
# - Functions
# - Hosting

# Puertos:
# Auth: 9099
# Firestore: 8080
# Functions: 5001
# Hosting: 5000
```

**Script de Seed Data:**
```typescript
// /scripts/seedData.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

async function seedDatabase() {
  console.log('🌱 Iniciando seed de datos...');

  // 1. Crear usuarios de prueba
  await createUserWithEmailAndPassword(auth, 'admin@bmn.com', 'admin123');
  await createUserWithEmailAndPassword(auth, 'vendedor@bmn.com', 'vendedor123');

  // 2. Crear configuración inicial
  await configuracionService.createAlmacen({
    nombre: 'Miami 1',
    tipo: 'USA',
    direccion: '...',
    activo: true
  });

  // 3. Crear 50 productos de prueba
  for (let i = 1; i <= 50; i++) {
    await productoService.create({
      marca: ['Natrol', 'NOW', 'Jarrow'][i % 3],
      nombreComercial: `Producto Test ${i}`,
      presentacion: 'capsulas',
      dosaje: '1000mg',
      contenido: '60 caps',
      grupo: 'Vitaminas',
      subgrupo: 'Vitamina D',
      enlaceProveedor: 'https://amazon.com/test',
      estado: 'activo',
      etiquetas: [],
      habilitadoML: true,
      stockMinimo: 10,
      stockMaximo: 100,
      margenMinimo: 30,
      margenObjetivo: 50
    }, 'seed-script');
  }

  console.log('✅ Seed completado');
}

seedDatabase();
```

**Plan de Testing:**

**Flujo 1: Compra USA → Venta Perú (Completo)**
```
1. Login como admin
2. Crear producto nuevo
3. Registrar TC del día
4. Crear OC con 3 productos
5. Pagar OC (TC diferente)
6. Verificar cálculo diferencia cambiaria
7. Registrar recepción USA
8. Verificar generación de unidades
9. Verificar actualización stock USA
10. Mover 5 unidades a Perú
11. Verificar cálculo CTRU inicial
12. Registrar gastos operativos
13. Verificar recálculo CTRU dinámico
14. Crear cotización
15. Verificar cálculo de margen
16. Convertir a venta
17. Verificar asignación FEFO
18. Verificar actualización stocks
19. Marcar como entregada
20. Verificar dashboard actualizado
```

**Casos Edge:**
```
- Venta sin stock → debe fallar con error
- Producto sin CTRU → debe alertar
- Margen negativo → debe alertar
- OC con TC pago muy diferente → debe alertar
- Unidades vencidas → no deben asignarse a ventas
```

**Script de testing:**
```typescript
// /tests/e2e/flujo-completo.test.ts
describe('Flujo Completo: OC → Venta', () => {

  beforeAll(async () => {
    // Iniciar emuladores
    // Cargar seed data
  });

  test('Crear producto y OC', async () => {
    // Test lógica...
  });

  test('Generar unidades al recibir OC', async () => {
    // Test lógica...
  });

  test('Asignación FEFO en venta', async () => {
    // Test lógica...
  });

  // ... más tests
});
```

**Entregable:**
- ✅ Suite de tests E2E completa
- ✅ Seed data funcional
- ✅ Documentación de tests
- ✅ Reporte de bugs encontrados y corregidos

---

### 🚀 Día 19-21: Deployment en Producción (20h)

**Objetivo:** Desplegar el sistema en Firebase

**Tareas:**
- [ ] Configurar Firebase Hosting
- [ ] Build de producción
- [ ] Deploy de Cloud Functions
- [ ] Configurar dominio custom
- [ ] Setup de backup automático
- [ ] Monitoreo y logs

**Configuración:**
```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|png|jpg|jpeg|svg|woff|woff2)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

**Script de deploy:**
```bash
#!/bin/bash
# deploy.sh

echo "🚀 Iniciando deployment..."

# 1. Build del frontend
echo "📦 Building frontend..."
npm run build

# 2. Deploy de Firestore Rules
echo "🔐 Deploying Firestore rules..."
firebase deploy --only firestore:rules

# 3. Deploy de Cloud Functions
echo "⚡ Deploying Cloud Functions..."
cd functions
npm run build
cd ..
firebase deploy --only functions

# 4. Deploy de Hosting
echo "🌐 Deploying Hosting..."
firebase deploy --only hosting

echo "✅ Deployment completado!"
echo "🔗 URL: https://bmn-erp.web.app"
```

**Variables de entorno producción:**
```bash
# .env.production
VITE_FIREBASE_API_KEY=tu_api_key_prod
VITE_FIREBASE_AUTH_DOMAIN=bmn-erp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bmn-erp
VITE_FIREBASE_STORAGE_BUCKET=bmn-erp.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Configurar dominio custom:**
```bash
# En Firebase Console:
# Hosting → Add custom domain → erp.bmn.com
# Seguir instrucciones para DNS
```

**Setup backup automático:**
```bash
# Cloud Scheduler + Cloud Functions
gcloud firestore export gs://bmn-erp-backups/$(date +%Y%m%d)
```

**Entregable:**
- ✅ Sistema desplegado en producción
- ✅ URL funcionando
- ✅ Dominio custom configurado
- ✅ Backups automáticos activos

---

### 📚 Día 22-24: Documentación Completa (22h)

**Objetivo:** Documentar todo el sistema

**Tareas:**
- [ ] README técnico del proyecto
- [ ] Manual de usuario
- [ ] Guía de administración
- [ ] Documentación de API interna
- [ ] Diagramas actualizados

**Estructura de documentación:**
```
/docs
├── README.md                    # Overview general
├── INSTALACION.md              # Setup desarrollo
├── ARQUITECTURA.md             # Arquitectura técnica
├── MANUAL_USUARIO.md           # Guía para usuarios finales
├── MANUAL_ADMIN.md             # Guía para administradores
├── API.md                      # Documentación de servicios
├── DEPLOYMENT.md               # Guía de deployment
├── TROUBLESHOOTING.md          # Solución de problemas
└── diagramas/
    ├── arquitectura.png
    ├── flujo-oc.png
    ├── flujo-venta.png
    └── base-datos.png
```

**README.md principal:**
```markdown
# BusinessMN 2.0 - Sistema ERP

Sistema de gestión empresarial para importación USA → Perú

## 🎯 Características Principales

- ✅ Gestión de productos y SKUs
- ✅ Inventario con trazabilidad unitaria
- ✅ Órdenes de compra con control cambiario
- ✅ CTRU dinámico automático
- ✅ Ventas con asignación FEFO
- ✅ Dashboard ejecutivo
- ✅ Reportes exportables

## 🛠️ Stack Tecnológico

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Firebase (Firestore + Cloud Functions)
- **State:** Zustand + React Query
- **UI:** Tailwind CSS
- **Charts:** Recharts

## 🚀 Quick Start

\`\`\`bash
# Clonar repositorio
git clone https://github.com/tu-usuario/bmn-erp.git

# Instalar dependencias
npm install

# Configurar Firebase
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Build producción
npm run build

# Deploy
npm run deploy
\`\`\`

## 📚 Documentación

- [Instalación y Setup](docs/INSTALACION.md)
- [Manual de Usuario](docs/MANUAL_USUARIO.md)
- [Manual de Administrador](docs/MANUAL_ADMIN.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [API Interna](docs/API.md)

## 📊 Estado del Proyecto

**Fase 1:** ✅ Completada (100%)
**Fase 2:** 🔄 En progreso
**Fase 3:** ⏳ Pendiente
**Fase 4:** ⏳ Pendiente
**Fase 5:** ⏳ Pendiente

## 🤝 Contribución

Este es un proyecto privado de BusinessMN.

## 📝 Licencia

Propietario - Todos los derechos reservados
```

**Manual de Usuario (excerpt):**
```markdown
# Manual de Usuario - BusinessMN 2.0

## Para Vendedores

### Crear una Venta

1. Ir a **Ventas** → **Nueva Venta**
2. Buscar o crear cliente
3. Agregar productos:
   - Buscar producto por nombre o SKU
   - Especificar cantidad
   - Ver margen en tiempo real
4. Agregar costos adicionales (delivery)
5. Confirmar venta

El sistema asignará automáticamente las unidades más próximas a vencer (FEFO).

### Ver Cotizaciones

1. Ir a **Ventas** → **Cotizaciones**
2. Filtrar por estado
3. Convertir a venta cuando cliente confirme

## Para Operativos

### Recibir una Orden de Compra en USA

1. Ir a **Compras** → **Órdenes de Compra**
2. Buscar la OC recibida
3. Click en **Registrar Recepción**
4. Ingresar cantidades recibidas (puede ser diferente a la esperada)
5. Subir foto del paquete (opcional)
6. Confirmar

El sistema generará automáticamente las unidades en el inventario.

### Mover Unidades entre Almacenes

1. Ir a **Inventario** → **Unidades**
2. Seleccionar unidades a mover
3. Click en **Mover**
4. Seleccionar almacén destino
5. Confirmar

Cada movimiento queda registrado en el historial.

[... más secciones ...]
```

**Entregable:**
- ✅ Documentación completa y profesional
- ✅ Manual de usuario por rol
- ✅ Guía de administración
- ✅ Diagramas actualizados

---

## 📊 Resumen Mes 1: Fase 1 al 100%

**Al finalizar el Mes 1 tendrás:**

✅ Sistema de Fase 1 completamente funcional
✅ Seguridad implementada (Firestore Rules + RBAC)
✅ Cloud Functions operativas
✅ Notificaciones in-app y email
✅ Exportación a Excel
✅ Paginación optimizada
✅ Dashboard mejorado con auto-refresh
✅ Testing E2E completo
✅ Desplegado en producción
✅ Documentación profesional

**Métricas esperadas:**
- 📝 100+ componentes TypeScript
- 🔧 15+ Cloud Functions
- 📊 10+ reportes exportables
- 🧪 50+ tests E2E
- 📚 200+ páginas de documentación

**Costo mes 1:**
- Firebase: $0 (Spark Plan)
- Dominio: ~$15
- **Total: ~$15**

---

# 📅 MES 2-3: FASE 2 - COMERCIAL AVANZADO

[Continúa con plan detallado de Fase 2...]

---

**Estado del documento:** Mes 1 detallado ✅
**Próximo:** Detallar Meses 2-12

¿Quieres que continúe con el plan detallado de las siguientes fases (2-5)?
