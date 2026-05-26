# ROADMAP IMPLEMENTACIÓN · Personas v5.x
## Usuarios + Planilla + Inversionistas · tareas minuciosas

**Fecha:** 2026-05-26  
**Alcance:** implementar la rearquitectura aprobada en mockups v5.3 (Usuarios + Inversionistas) y v5.4 (Planilla)  
**Total estimado:** **~28h** distribuidas en 10 fases secuenciales  
**Sin breaking changes:** todo es additive · rollback simple si algo falla  

---

## 📊 Resumen ejecutivo · 10 fases

| Fase | Tema | Horas | Riesgo |
|---|---|---|---|
| 0 | Pre-flight · backup · branch | 0.25h | Bajo |
| 1 | **Inversionistas v5.3** · banner cross-link sutil | 0.5h | Mínimo |
| 2 | **Usuarios v5.3** · 5→3 tabs + chips filtro | 2h | Bajo |
| 3 | **Planilla v5.4 · Backend** · types + services + migración | 4h | Medio |
| 4 | **Planilla v5.4 · Shell + 5 tabs** UI canon | 5h | Medio |
| 5 | **Planilla v5.4 · 15 modales** canon FormModalV2 | 6h | Bajo |
| 6 | **Planilla v5.4 · Cross-links 360** · integración Gastos/CashFlow/P&L | 2h | Medio |
| 7 | **Planilla v5.4 · Cálculos automáticos** · 4 tipos incentivo | 3h | Medio |
| 8 | **Usuarios v5.x · ajuste Ficha 360** · histórico salarial | 1h | Bajo |
| 9 | **Cloud Functions nuevas** · cron + ejecutar liquidación | 3h | Medio |
| 10 | **Tests + build + deploy** · validación E2E | 2h | Bajo |

**Total: 28h · ~4 sesiones de trabajo grandes (~7h c/u)**

---

## 🎯 Estrategia de implementación

### Orden de prioridad (por valor entregado / riesgo)

1. **PRIMERO Inversionistas** (Fase 1) · cambio chico · valor inmediato · cero riesgo
2. **SEGUNDO Usuarios** (Fases 2 + 8) · refactor que el user pidió primero · alto impacto visual
3. **TERCERO Planilla** (Fases 3-7) · módulo grande · sub-desarrollado · más trabajo

### Dependencias entre fases

```
F0 (pre-flight)
  ├─→ F1 (inversionistas · independiente)
  ├─→ F2 (usuarios shell · independiente)
  │     └─→ F8 (ficha 360 histórico salarial · depende de F3)
  └─→ F3 (planilla backend · types/services)
        ├─→ F4 (planilla UI shell · depende de F3)
        │     └─→ F5 (planilla modales · depende de F4)
        ├─→ F6 (cross-links · depende de F3 y de /gastos existente)
        ├─→ F7 (cálculos auto · depende de F3)
        └─→ F9 (Cloud Functions · depende de F3 + F7)
              └─→ F10 (tests + deploy · depende de TODO)
```

---

## FASE 0 · Pre-flight (0.25h)

### 0.1 · Backup Firestore (5 min)
```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
gcloud firestore export "gs://businessmn-269c9.firebasestorage.app/backups/pre-personas-v5x-${TIMESTAMP}"
```

### 0.2 · Verificar build verde actual (5 min)
```bash
npm run build  # debe exitar 0
```

### 0.3 · Confirmar mockups aprobados visualmente
- ✅ usuarios-v5.3-hub.html
- ✅ usuarios-v5.3-tabs-completas.html
- ✅ inversionistas-v5.3-tweaks.html
- ✅ planilla-v5.4-completo.html

### 0.4 · Branch (opcional · recomendado)
```bash
git checkout -b chk5.PERSONAS-v5x-impl
# o continuar en main si preferís push directo
```

---

## FASE 1 · `/inversionistas` v5.3 · banner cross-link (0.5h)

**Objetivo:** agregar banner cross-link sutil entre header y KPI strip · visible solo para admin/gerente.

### 1.1 · Modificar `src/pages/Inversionistas/Inversionistas.tsx` (15 min)

**Cambio:** insertar componente `BannerCrossLinkAdmin` entre `<PageHeader>` y `<KpiStripCanon>`.

```tsx
// Nuevo import
import { Link as RouterLink } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';

// Dentro del JSX, después del header y antes del KPI strip:
{hasAnyRole(currentUser, ['admin', 'gerente']) && (
  <div className="mx-6 mt-2 mb-3 bg-gradient-to-r from-purple-50 to-indigo-50 ring-1 ring-purple-200 rounded-xl p-3 flex items-center gap-3">
    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <Users className="w-4 h-4 text-purple-700" />
    </div>
    <div className="flex-1 text-[11px] text-slate-700">
      <strong>Admin/Gerente:</strong> para configurar socios · % participación · aportes de valor · ir a Usuarios.
    </div>
    <RouterLink
      to="/usuarios?filterRole=socio"
      className="bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 text-[11px] font-bold px-3 py-1 rounded-lg whitespace-nowrap flex items-center gap-1"
    >
      Configurar socios
      <ArrowRight className="w-3 h-3" />
    </RouterLink>
  </div>
)}
```

### 1.2 · Verificar `hasAnyRole` ya disponible (5 min)

Confirmar import `import { hasAnyRole } from '../../types/auth.types';` ya presente · si no, agregar.

### 1.3 · Build + commit (10 min)
```bash
npm run build
# si OK
git add src/pages/Inversionistas/Inversionistas.tsx
git commit -m "chk5.PERSONAS-v5.3 · Fase 1 · /inversionistas banner cross-link admin"
git push origin main
```

**Validación:**
- Ver `/inversionistas` como admin → banner aparece
- Ver como socio normal → banner NO aparece

**Riesgos:** mínimos · cambio puramente aditivo.

---

## FASE 2 · `/usuarios` v5.3 · refactor a 3 tabs + chips filtro (2h)

**Objetivo:** eliminar tabs Socios y Planilla · reemplazar por filtros chip multi-rol con banner cross-link dinámico.

### 2.1 · Modificar `src/pages/Usuarios/Usuarios.tsx` · state (15 min)

**Cambios:**
```tsx
// Cambiar tipo TabActiva
type TabActiva = 'resumen' | 'accesos' | 'configuracion';  // antes 5 valores

// Agregar state nuevo para chip filter
const [filterChipRole, setFilterChipRole] = useState<UserRole | 'todos' | 'pendientes' | 'suspendidos'>('todos');
```

### 2.2 · Modificar `Usuarios.tsx` · eliminar 2 tabs del TabsRow (10 min)

Eliminar las opciones `socios` y `planilla` del array de tabs. Quedar solo 3:
```tsx
const tabs = [
  { id: 'resumen' as TabActiva, label: 'Resumen', Icon: LayoutDashboard },
  { id: 'accesos' as TabActiva, label: 'Accesos & seguridad', Icon: ShieldCheck },
  { id: 'configuracion' as TabActiva, label: 'Configuración', Icon: SettingsIcon },
];
```

### 2.3 · Agregar componente FiltroChipsRol entre filtros existentes (30 min)

**Nuevo archivo:** `src/components/modules/usuarios/FiltroChipsRol.tsx`

```tsx
interface Props {
  usuarios: UserProfile[];
  selected: UserRole | 'todos' | 'pendientes' | 'suspendidos';
  onChange: (v: UserRole | 'todos' | 'pendientes' | 'suspendidos') => void;
}

export default function FiltroChipsRol({ usuarios, selected, onChange }: Props) {
  // Calcular counts dinámicos
  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: usuarios.length };
    usuarios.forEach((u) => {
      getUserRoles(u).forEach((r) => {
        map[r] = (map[r] || 0) + 1;
      });
    });
    return map;
  }, [usuarios]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      <button onClick={() => onChange('todos')} className={...}>Todos · {counts.todos}</button>
      <button onClick={() => onChange('admin')} className={...}>Admin · {counts.admin || 0}</button>
      <button onClick={() => onChange('socio')} className={...}>Socio · {counts.socio || 0}</button>
      <button onClick={() => onChange('planilla')} className={...}>...</button>
      // etc para todos los roles
    </div>
  );
}
```

### 2.4 · Banner cross-link dinámico cuando filtro=socio/planilla (20 min)

En `Usuarios.tsx` antes de la lista de cards:

```tsx
{filterChipRole === 'socio' && (
  <BannerCrossLinkInversionistas />
)}
{filterChipRole === 'planilla' && (
  <BannerCrossLinkPlanilla />
)}
```

Componentes nuevos en `src/components/modules/usuarios/banners/`:
- `BannerCrossLinkInversionistas.tsx`
- `BannerCrossLinkPlanilla.tsx`

### 2.5 · Adaptar filtro `filteredUsuarios` para incluir chip (10 min)

```tsx
const filteredUsuarios = useMemo(() => {
  let result = [...usuarios];

  // Chip filter
  if (filterChipRole !== 'todos') {
    if (filterChipRole === 'pendientes') {
      result = result.filter((u) => getUserEstado(u) === 'pendiente_aprobacion');
    } else if (filterChipRole === 'suspendidos') {
      result = result.filter((u) => getUserEstado(u) === 'suspendido');
    } else {
      // Es UserRole
      result = result.filter((u) => hasRole(u, filterChipRole as UserRole));
    }
  }

  // Búsqueda + filtros existentes
  result = result.filter(/* ... lógica existente ... */);
  return result;
}, [usuarios, searchTerm, filterRole, filterStatus, filterChipRole]);
```

### 2.6 · Eliminar archivos legacy (10 min)

```bash
rm src/components/modules/usuarios/TabSocios.tsx
rm src/components/modules/usuarios/TabPlanilla.tsx
rm src/components/modules/usuarios/TabAccesos.tsx  # se mantiene · NO eliminar
```

**Solo TabSocios y TabPlanilla.** TabAccesos se queda · esa tab sigue siendo distinta a /auditoria.

Actualizar imports en `Usuarios.tsx` (quitar imports de TabSocios · TabPlanilla).

### 2.7 · Verificar wire-up del render condicional (10 min)

En `Usuarios.tsx`:
```tsx
{tabActiva === 'resumen' && (<>
  {/* Banner pendientes + KPI strip + chips filtro + búsqueda + lista cards */}
</>)}
{tabActiva === 'accesos' && <TabAccesos />}  // Existente
{tabActiva === 'configuracion' && <TabConfiguracion />}  // Existente
```

### 2.8 · Build + commit (15 min)
```bash
npm run build
git add -A
git commit -m "chk5.PERSONAS-v5.3 · Fase 2 · /usuarios 5→3 tabs + chips filtro multi-rol"
git push origin main
```

**Validación:**
- 3 sub-tabs visibles
- Click chip "Socio" → lista filtrada · banner violet aparece
- Click chip "Planilla" → lista filtrada · banner sky aparece
- Click "Todos" → todos · sin banner

**Riesgos:** medio · cambio estructural · validar que filtro chip funciona correctamente.

---

## FASE 3 · `/planilla` v5.4 · Backend · types + services + migración (4h)

**Objetivo:** crear toda la capa de datos del nuevo módulo · sin tocar UI todavía.

### 3.1 · Nuevos types (45 min)

**Archivo `src/types/historialSalarial.types.ts`** (NUEVO):
```typescript
export interface HistorialSalarial {
  id: string;
  uid: string;
  sueldoAnterior: number;
  sueldoNuevo: number;
  porcentajeCambio: number;
  monedaActual: 'PEN' | 'USD';
  fechaEfectiva: Timestamp;
  motivo: 'aumento_periodico' | 'promocion' | 'reajuste_negocio' | 'reduccion' | 'correccion' | 'alta_inicial';
  aprobadoPor: string;
  notas?: string;
  fechaRegistro: Timestamp;
}
```

**Archivo `src/types/esquemaIncentivo.types.ts`** (NUEVO):
```typescript
export type TipoIncentivo = 'comision' | 'bono_meta' | 'bono_kpi' | 'bono_fijo';
export type EstadoEsquema = 'activo' | 'pausado' | 'archivado';

export interface EsquemaIncentivo {
  id: string;
  nombre: string;
  tipo: TipoIncentivo;
  aplicableA: {
    roles?: UserRole[];
    usuariosEspecificos?: string[];
    area?: string;
  };
  configuracion: ConfigComision | ConfigBonoMeta | ConfigBonoKPI | ConfigBonoFijo;
  estado: EstadoEsquema;
  fechaInicio: Timestamp;
  fechaFin?: Timestamp;
  creadoPor: string;
  fechaCreacion: Timestamp;
}

// Configs por tipo:
export interface ConfigComision {
  aplicarSobre: 'venta_total' | 'utilidad_bruta';
  modelo: 'lineal' | 'escalonado';
  porcentaje?: number;  // lineal
  escalas?: Array<{ desdeMonto: number; hastaMonto?: number; porcentaje: number }>;
}
export interface ConfigBonoMeta {
  metricaTracked: 'oc_recibidas_en_tiempo' | 'rotacion_stock' | 'entregas_a_tiempo' | 'requerimientos_aprobados';
  objetivoMensual: number;
  bonoSiCumple: number;
  bonoBonusSiSupera?: { threshold: number; bono: number };
  dividirEntreEquipo: boolean;
}
export interface ConfigBonoKPI {
  metricaTracked: 'cobros_vencidos_porcentaje' | 'margen_neto_mes' | 'liquidez_corriente';
  formula: string;  // ej. 'metricaTracked <= 5'
  bonoSiCumple: number;
}
export interface ConfigBonoFijo {
  monto: number;
  moneda: 'PEN' | 'USD';
  frecuencia: 'unico' | 'mensual' | 'anual_diciembre' | 'anual_julio';
}
```

**Archivo `src/types/calculoIncentivo.types.ts`** (NUEVO):
```typescript
export type EstadoCalculo = 'pendiente' | 'aprobado' | 'rechazado' | 'pagado';

export interface CalculoIncentivoMes {
  id: string;
  esquemaId: string;
  esquemaNombre: string;
  esquemaTipo: TipoIncentivo;
  userId: string;
  userDisplayName: string;
  mes: number;
  anio: number;
  metricaCalculada: number;
  bonoCalculado: number;
  monedaBono: 'PEN' | 'USD';
  estado: EstadoCalculo;
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
  motivoRechazo?: string;
  documentosReferencia?: string[];
  notas?: string;
  fechaCalculo: Timestamp;
  // Cuando estado='pagado'
  boletaIdReflejada?: string;
}
```

**Archivo `src/types/liquidacionEmpleado.types.ts`** (NUEVO):
```typescript
export type TipoBaja =
  | 'renuncia_voluntaria'
  | 'despido_justificado'
  | 'despido_arbitrario'
  | 'termino_contrato_plazo_fijo'
  | 'jubilacion'
  | 'cese_acuerdo_mutuo'
  | 'fallecimiento';

export interface LiquidacionEmpleado {
  id: string;
  uid: string;
  userDisplayName: string;
  tipoBaja: TipoBaja;
  fechaEfectiva: Timestamp;
  conceptos: {
    sueldoProporcional: number;
    vacacionesNoGozadas: { dias: number; monto: number };
    gratificacionProporcional?: { mesProyectado: 'julio' | 'diciembre'; monto: number };
    comisionesPendientes: number;
    indemnizacion?: { motivo: string; monto: number };
    adelantosDescontar: number;
    ajustesManuales?: Array<{ concepto: string; monto: number; motivo: string }>;
  };
  netoALiquidar: number;
  moneda: 'PEN' | 'USD';
  estado: 'borrador' | 'aprobada' | 'pagada' | 'cancelada';
  boletaLiquidacionId?: string;
  notas?: string;
  creadoPor: string;
  fechaCreacion: Timestamp;
  ejecutadaPor?: string;
  fechaEjecucion?: Timestamp;
}
```

**Modificar `src/types/planilla.types.ts`** (existente):
```typescript
// Agregar campo a Boleta:
export interface Boleta {
  // ... campos existentes ...
  bonificacionesIncentivo?: Array<{
    calculoIncentivoId: string;
    esquemaNombre: string;
    monto: number;
  }>;
  // ELIMINAR campos relacionados a CTS si los hubiera
}
```

### 3.2 · Nuevas colecciones en `src/config/collections.ts` (10 min)

```typescript
// === chk5.PERSONAS-v5.4 · planilla expandido ===
HISTORIAL_SALARIAL: 'historialSalarial',
ESQUEMAS_INCENTIVO: 'esquemasIncentivo',
CALCULOS_INCENTIVO_MES: 'calculosIncentivoMes',
LIQUIDACIONES_EMPLEADO: 'liquidacionesEmpleado',
```

### 3.3 · Service `historialSalarial.service.ts` (30 min)

**Archivo NUEVO:** `src/services/historialSalarial.service.ts`

Funciones:
- `getHistorialByUser(uid)` · timeline ordenado desc
- `registrarCambio(uid, data, actorUid)` · crea + actualiza datosLaborales con nuevo sueldo
- `getUltimoSueldo(uid)` · helper

### 3.4 · Service `esquemaIncentivo.service.ts` (40 min)

**Archivo NUEVO:** `src/services/esquemaIncentivo.service.ts`

Funciones:
- `listAll()` · todos los esquemas
- `listActivos()` · solo estado=activo
- `getById(id)`
- `crear(esquema, actorUid)`
- `actualizar(id, partial, actorUid)`
- `pausar(id, actorUid)` / `activar(id, actorUid)` / `archivar(id, actorUid)`
- `obtenerAplicablesParaUsuario(uid, roles)` · filtra esquemas que aplican

### 3.5 · Service `calculoIncentivo.service.ts` (45 min)

**Archivo NUEVO:** `src/services/calculoIncentivo.service.ts`

Funciones:
- `calcularMes(mes, anio, actorUid)` · ejecuta todos los esquemas activos
  - Por cada esquema activo:
    - Por cada usuario que aplica:
      - Pull métricas de módulos correspondientes
      - Calcular bono según config
      - Crear `CalculoIncentivoMes` estado=pendiente
- `aprobar(calculoId, actorUid)` · cambia a 'aprobado'
- `rechazar(calculoId, motivo, actorUid)`
- `marcarPagado(calculoId, boletaId)` · cuando se incluye en boleta
- `listByMes(mes, anio)` · todos los del período
- `listByUser(uid, mes?, anio?)` · histórico de un user

### 3.6 · Service `liquidacion.service.ts` (45 min)

**Archivo NUEVO:** `src/services/liquidacion.service.ts`

Funciones:
- `calcularLiquidacion(uid, tipoBaja, fechaEfectiva)` · pure function que calcula conceptos
- `crear(liquidacion, actorUid)` · estado=borrador
- `aprobar(id, ajustesManuales?, actorUid)` · estado=aprobada
- `ejecutar(id, actorUid)` · genera boleta + actualiza UserProfile (estado=baja) + datosLaborales (fechaSalida) + audit log

### 3.7 · Helpers de cálculo · `src/utils/incentivoCalculadores.ts` (45 min)

**Archivo NUEVO:** funciones puras para cada tipo:

```typescript
// TIPO A · Comisión
export async function calcularComision(
  uid: string,
  config: ConfigComision,
  mes: number,
  anio: number
): Promise<number> {
  // Pull /ventas filtrado por vendedorId=uid y mes
  // Aplicar lineal o escalonado
  // Retornar monto bono
}

// TIPO B · Bono meta
export async function calcularBonoMeta(
  uids: string[],
  config: ConfigBonoMeta,
  mes: number,
  anio: number
): Promise<Record<string, number>> {
  // Pull métricas (oc_en_tiempo o entregas etc)
  // Comparar con objetivo
  // Calcular y dividir entre uids
}

// TIPO C · Bono KPI
export async function calcularBonoKPI(
  uid: string,
  config: ConfigBonoKPI,
  mes: number,
  anio: number
): Promise<number> {
  // Pull KPI específico
  // Evaluar fórmula
  // Retornar bono si cumple
}

// TIPO D · Bono fijo
export function calcularBonoFijo(
  config: ConfigBonoFijo,
  mes: number,
  anio: number
): number {
  // Lógica simple según frecuencia
}
```

### 3.8 · Firestore rules · agregar reglas para nuevas colecciones (20 min)

En `firestore.rules`:

```javascript
match /historialSalarial/{docId} {
  allow read: if hasAnyRole(['admin', 'gerente']) ||
              (request.auth != null && resource.data.uid == request.auth.uid);
  allow write: if hasAnyRole(['admin', 'gerente']);
}

match /esquemasIncentivo/{docId} {
  allow read: if isActiveUser();
  allow write: if hasAnyRole(['admin', 'gerente']);
}

match /calculosIncentivoMes/{docId} {
  allow read: if hasAnyRole(['admin', 'gerente']) ||
              (request.auth != null && resource.data.userId == request.auth.uid);
  allow write: if hasAnyRole(['admin', 'gerente']);
}

match /liquidacionesEmpleado/{docId} {
  allow read: if hasAnyRole(['admin', 'gerente', 'finanzas']);
  allow write: if hasAnyRole(['admin', 'gerente']);
}
```

### 3.9 · Migración (opcional · ~10 min)

Si hay boletas existentes · NO requiere migración (campo nuevo `bonificacionesIncentivo` es opcional).

Eliminar CTS · solo si hay docs viejos con campos CTS en boletas. Script idempotente.

### 3.10 · Build + commit (15 min)

```bash
npm run build
git add -A
git commit -m "chk5.PERSONAS-v5.4 · Fase 3 · Planilla backend (types + services + rules)"
git push origin main
```

**Riesgos:** medio · estructura nueva grande · validar imports + tsc clean.

---

## FASE 4 · `/planilla` v5.4 · Shell + 5 sub-tabs UI canon (5h)

**Objetivo:** refactor completo de la página /planilla a canon v5.2 banking-grade sky.

### 4.1 · Refactor `src/pages/Planilla/Planilla.tsx` · shell completo (45 min)

- Reemplazar `<PageHeader>` simple por shell banking-grade canon F1
- Breadcrumb 3 niveles (Dashboard > Finanzas y Contabilidad > Planilla)
- Header con icon sky gradient + h1 + 3-tier acciones (Exportar · Cerrar mes · Nueva boleta)
- KPI strip 4 cards canon N1+N2 sky
- TabsRow canon N6 scroll-x · 5 sub-tabs (sin tab "Empleados")
- State `tabActiva: 'boletas' | 'adelantos' | 'incentivos' | 'vacaciones' | 'analisis'`

### 4.2 · Tab Boletas · rewrite canon (1h)

**Archivo:** `src/pages/Planilla/components/TabBoletas.tsx` (modificar existente)

- Selector de mes en sub-header sticky
- Sub-header: estado "mes abierto" / "mes cerrado"
- Botón "Generar boletas del mes" (CTA primary sky)
- Tabla densa Stripe-style con boletas
- Footer con totales
- Quitar la lógica de "agregar empleado" · ya no aplica

### 4.3 · Tab Adelantos · rewrite canon (45 min)

**Archivo:** `src/pages/Planilla/components/TabAdelantos.tsx` (modificar existente)

- Cards canon amber para cada adelanto pendiente
- Botones inline Aprobar/Rechazar
- Tabla histórico de adelantos (todos los estados)

### 4.4 · Tab Incentivos & Comisiones · NUEVO (1h 15min)

**Archivo NUEVO:** `src/pages/Planilla/components/TabIncentivos.tsx`

Estructura:
- KPI mini · 4 cards (Bonos YTD · Esquemas activos · Cobertura · Próximo cálculo)
- Botones header (Calcular bonos del mes · Nuevo esquema)
- Lista de esquemas (cards) con accionables (editar · pausar · archivar)
- Tabla de cálculos del mes (pendientes · aprobados · rechazados)
- Banner amber "X bonos esperan aprobación"

### 4.5 · Tab Vacaciones & Gratificaciones · renamed (45 min)

**Archivo NUEVO:** `src/pages/Planilla/components/TabVacacionesGratificaciones.tsx`

Estructura:
- KPI · 3 cards (Días vacaciones pendientes · Próxima gratificación · Solicitudes pendientes)
- Sección 1 · Vacaciones · tabla por empleado
- Sección 2 · Gratificaciones · cards para julio y diciembre proyectados
- Banner explicativo "Vita Skin NO paga CTS · solo gratificaciones jul/dic"

(Eliminar referencias a CTS del existente)

### 4.6 · Tab Análisis & Reportes · NUEVO (1h)

**Archivo NUEVO:** `src/pages/Planilla/components/TabAnalisisReportes.tsx`

Estructura:
- Sección 1 · 4 KPI ejecutivos (Payroll YTD · % sobre ingresos · Incentivos YTD · Costo promedio/empleado)
- Sección 2 · Breakdown por área (barras horizontales)
- Sección 3 · Breakdown por tipo de pago (table)
- Sección 4 · **4 cross-link cards 360°** (a Gastos · Cash Flow · P&L · Inversionistas Salud)
- Sección 5 · Exports (CSV payroll · PDF ejecutivo · reporte por área)

### 4.7 · Verificar wire-up + build + commit (30 min)

```bash
npm run build
git add -A
git commit -m "chk5.PERSONAS-v5.4 · Fase 4 · Planilla shell canon + 5 tabs UI"
git push origin main
```

**Riesgos:** medio · varias vistas nuevas · validar canon v5.2 estricto.

---

## FASE 5 · `/planilla` v5.4 · 15 modales canon FormModalV2 (6h)

**Objetivo:** todos los modales internos del módulo canon banking-grade sky.

### 5.1 · GenerarBoletasModal · CTA principal (30 min)

**Archivo NUEVO:** `src/components/modules/planilla/GenerarBoletasModal.tsx`

Form:
- Selector mes/año
- Lista checkboxes de empleados (default todos)
- Checkboxes "Incluir comisiones" · "Aplicar adelantos pendientes"
- Estimación en vivo
- Action: crea N boletas estado=borrador

### 5.2 · NuevaBoletaModal · manual (30 min)

**Archivo NUEVO:** `src/components/modules/planilla/NuevaBoletaModal.tsx`

Form completo · empleado · mes · tipo · sueldo base · bonificaciones · descuentos · notas. Cálculo en vivo de neto.

### 5.3 · BoletaDetalleModal · drill F6.A (45 min)

**Archivo NUEVO:** `src/components/modules/planilla/BoletaDetalleModal.tsx`

Modal grande max-w-3xl con tabs internas:
- Tab "Detalle" (default) · cards conceptos + neto destacado
- Tab "Comisiones" · breakdown de ventas que generaron comisión
- Tab "Histórico" · estados pasados de la boleta

Footer · Anular · Editar · Marcar pagada.

### 5.4 · CerrarMesModal · typed-confirm (20 min)

**Archivo NUEVO:** `src/components/modules/planilla/CerrarMesModal.tsx`

- Resumen del mes
- Typed-confirm "CERRAR [MES]"
- Variant amber

### 5.5 · NuevoAdelantoForm refactor (30 min)

**Archivo:** `src/pages/Planilla/components/AdelantoForm.tsx` (refactor existente)

Migrar de FormModal legacy a FormModalV2 canon · agregar campo "Razón visible al empleado".

### 5.6 · AprobarAdelantoModal (20 min)

**Archivo NUEVO:** `src/components/modules/planilla/AprobarAdelantoModal.tsx`

Info del adelanto · ajustar monto opcional · checkbox "descontar próxima boleta" · variant success-soft.

### 5.7 · RechazarAdelantoModal (20 min)

**Archivo NUEVO:** `src/components/modules/planilla/RechazarAdelantoModal.tsx`

Typed-confirm "RECHAZAR" + motivo obligatorio (min 10 chars).

### 5.8 · NuevoEsquemaIncentivoModal · wizard (1h)

**Archivo NUEVO:** `src/components/modules/planilla/NuevoEsquemaIncentivoModal.tsx`

Wizard 3 pasos:
- Paso 1 · Tipo de esquema (A/B/C/D)
- Paso 2 · Aplicable a (roles vs usuarios específicos)
- Paso 3 · Configuración según tipo (form dinámico)

### 5.9 · EditarEsquemaIncentivoModal (30 min)

Similar al crear · pero pre-cargado · respeta cambios de aplicableA solo si esquema no tiene cálculos pasados.

### 5.10 · CalcularBonosMesModal (30 min)

**Archivo NUEVO:** `src/components/modules/planilla/CalcularBonosMesModal.tsx`

Confirma cálculo masivo · selector de mes · checkbox "incluir esquemas pausados" (no) · estimación cantidad cálculos.

### 5.11 · AprobarBonoModal + RechazarBonoModal (30 min)

Similar a adelantos · canon emerald y rose.

### 5.12 · ProgramarVacacionesModal (30 min)

**Archivo NUEVO:** `src/components/modules/planilla/ProgramarVacacionesModal.tsx`

Form · empleado · fechas inicio/fin · cálculo días hábiles · validación saldo · selector backup.

### 5.13 · ProcesarGratificacionModal (30 min)

**Archivo NUEVO:** `src/components/modules/planilla/ProcesarGratificacionModal.tsx`

Lista de empleados elegibles · monto calculado c/u · seleccionar todos · generar boletas especiales "Gratificación · julio 2026".

### 5.14 · WizardBajaEmpleadoModal · 4 pasos (1h)

**Archivo NUEVO:** `src/components/modules/planilla/WizardBajaEmpleadoModal.tsx`

4 pasos con stepper visual:
1. Motivo · tipo de baja · fecha efectiva
2. Liquidación automática (tabla calculada)
3. Revisión · permite ajustes manuales con justificación
4. Confirmar · ejecuta + genera boleta de liquidación

### 5.15 · AjustarSalarioModal (20 min)

**Archivo NUEVO:** `src/components/modules/usuarios/AjustarSalarioModal.tsx` (vive en /usuarios porque se abre desde Ficha 360)

Form · nuevo monto · motivo · fecha efectiva · notas. Crea registro en historialSalarial + actualiza datosLaborales.

### 5.16 · ExportPayrollModal (20 min)

Selector período · filtros · formato CSV/PDF · scope.

### 5.17 · Build + commit (30 min)

```bash
npm run build
git add -A
git commit -m "chk5.PERSONAS-v5.4 · Fase 5 · Planilla 16 modales canon FormModalV2"
git push origin main
```

**Riesgos:** bajo · muchos modales pero patrón consistente.

---

## FASE 6 · `/planilla` v5.4 · Cross-links 360 e integración (2h)

**Objetivo:** integrar planilla con /gastos · /finanzas · /contabilidad.

### 6.1 · En `pagarBoleta` · crear gasto automático (45 min)

Modificar `usePlanillaStore.pagarBoleta`:
```typescript
async pagarBoleta(boletaId, datosPago) {
  await actualizarBoletaEstado(boletaId, 'pagada');

  // NUEVO · crear gasto en /gastos
  const boleta = await getBoleta(boletaId);
  await gastoService.crear({
    fecha: serverTimestamp(),
    descripcion: `Sueldo · ${boleta.userDisplayName} · ${boleta.mesAnio}`,
    monto: boleta.netoAPagar,
    moneda: boleta.moneda,
    categoriaId: 'gasto_planilla',
    subcategoria: boleta.area || 'general',
    referenciaTipoBoleta: 'planilla_boleta',
    referenciaId: boletaId,
    pagadoPor: currentUser.uid,
  });

  // crear movimiento financiero
  await movimientoFinancieroService.crear({
    tipo: 'pago_planilla',
    cuentaOrigen: cuentaSeleccionada,
    monto: boleta.netoAPagar,
    descripcion: `Pago boleta ${boleta.userDisplayName}`,
    referenciaBoleta: boletaId,
  });
}
```

### 6.2 · Wire-up cross-link cards en TabAnalisisReportes (30 min)

Los 4 botones de cross-link deben usar `useNavigate` con query params:

```tsx
<button onClick={() => navigate('/gastos?categoriaId=gasto_planilla')}>Ver en /gastos</button>
<button onClick={() => navigate('/finanzas/cash-flow?categoria=planilla')}>Ver en cash-flow</button>
<button onClick={() => navigate('/contabilidad?tab=pyl&fila=gastos_personal')}>Ver en P&L</button>
<button onClick={() => navigate('/inversionistas?tab=salud')}>Ver en Inversionistas Salud</button>
```

### 6.3 · Cash flow projection ya tiene planilla? · validar (15 min)

Si NO · agregar entrada en `cashFlowProjectionService`:
```typescript
// Egresos programados de planilla (sueldo + gratificaciones)
const proyeccionPayroll = await calcularProyeccion12mPayroll();
// proyeccionPayroll incluye sueldo base · gratificaciones jul/dic estimadas
```

### 6.4 · Tab Análisis pulls real-time YTD (15 min)

Service de agregaciones `src/services/planillaAnalytics.service.ts` NUEVO:
- `getPayrollYTD()` · suma boletas pagadas del año
- `getBreakdownPorArea(mes, anio)` · agrupa por user.area
- `getBreakdownPorTipo(mes, anio)` · sueldos vs bonos vs comisiones

### 6.5 · Build + commit (15 min)

```bash
npm run build
git add -A
git commit -m "chk5.PERSONAS-v5.4 · Fase 6 · Planilla cross-links 360 + integración gastos/cashflow"
git push origin main
```

**Riesgos:** medio · toca módulos externos · validar que /gastos acepta la nueva categoría.

---

## FASE 7 · `/planilla` v5.4 · Cálculos automáticos 4 tipos (3h)

**Objetivo:** funciones puras que calculan bonos pulling data del sistema.

### 7.1 · TIPO A · Calculador de comisiones (45 min)

`src/utils/incentivoCalculadores.ts` · `calcularComision()`:
- Query a `/ventas` con filtro `vendedorId === uid && mes`
- Suma según `aplicarSobre` (venta_total o utilidad_bruta)
- Aplica modelo lineal o escalonado
- Retorna monto

### 7.2 · TIPO B · Calculador de bonos meta (45 min)

`calcularBonoMeta()`:
- Query a `/ordenesCompra` o `/envios` según `metricaTracked`
- Computa porcentaje cumplimiento
- Compara con `objetivoMensual`
- Si cumple · divide bono entre equipo

### 7.3 · TIPO C · Calculador de bonos KPI (30 min)

`calcularBonoKPI()`:
- Query al servicio correspondiente (`/finanzas/cc` para cartera vencida)
- Evalúa fórmula simple
- Retorna monto si cumple

### 7.4 · TIPO D · Calculador bono fijo (15 min)

`calcularBonoFijo()`:
- Solo lógica de frecuencia (¿es el mes correcto?)
- Retorna monto fijo

### 7.5 · Test manual de cada calculador (30 min)

Con data real de Vita Skin:
- Crear esquema TIPO A · ejecutar calcularMes · verificar monto Ana R.
- Crear esquema TIPO B · ejecutar calcularMes · verificar bono Diego+Pedro
- Crear esquema TIPO C · ejecutar calcularMes · verificar bono María
- Crear esquema TIPO D · ejecutar calcularMes · verificar bono diciembre

### 7.6 · Build + commit (15 min)

```bash
npm run build
git add -A
git commit -m "chk5.PERSONAS-v5.4 · Fase 7 · Calculadores 4 tipos incentivo"
git push origin main
```

**Riesgos:** medio · queries cross-módulo · validar tipos y filtros.

---

## FASE 8 · `/usuarios` ajuste · Histórico salarial en Ficha 360 (1h)

**Objetivo:** mostrar histórico salarial en Ficha 360 modal · agregar acción "Ajustar salario".

### 8.1 · Modificar `Ficha360Modal.tsx` · tab Sub-perfiles (30 min)

En la sección "Datos laborales" del tab sub-perfiles · agregar drill secundario:
```tsx
{datosLab && (
  <button onClick={() => setSubTabActiva('historial-salarial')}>
    Ver histórico salarial →
  </button>
)}
```

### 8.2 · Crear sub-componente `HistorialSalarialTimeline.tsx` (20 min)

**Archivo NUEVO:** `src/components/modules/usuarios/HistorialSalarialTimeline.tsx`

Timeline visual con todos los cambios · usando `historialSalarialService.getHistorialByUser`.

### 8.3 · Wire-up AjustarSalarioModal desde Ficha 360 (10 min)

Botón "Ajustar salario" en el header del modal Ficha 360 (visible solo admin/gerente) abre `AjustarSalarioModal`.

**Riesgos:** mínimo · cambio aditivo.

---

## FASE 9 · Cloud Functions nuevas (3h)

**Objetivo:** funciones serverless para operaciones que requieren admin SDK.

### 9.1 · `scheduledCalcularBonosMes` · cron mensual (45 min)

**Archivo:** `functions/src/planilla/planilla.cron.ts` (NUEVO)

```typescript
export const scheduledCalcularBonosMes = functions
  .pubsub.schedule('0 1 1 * *')  // 1 AM día 1 de cada mes
  .timeZone('America/Lima')
  .onRun(async () => {
    const mesPasado = obtenerMesPasado();
    await calcularMesParaTodosEsquemas(mesPasado.mes, mesPasado.anio);
    // Notificar a admins por email
  });
```

### 9.2 · `ejecutarLiquidacion` callable (45 min)

**Archivo:** `functions/src/planilla/planilla.liquidacion.ts` (NUEVO)

```typescript
export const ejecutarLiquidacion = functions.https.onCall(async (data, context) => {
  // Validar permisos admin/gerente
  // Generar boleta especial de liquidación
  // Cambiar UserProfile.estado = 'baja'
  // Actualizar datosLaborales.fechaSalida
  // Crear gasto en /gastos
  // Crear movimiento financiero
  // Audit log
});
```

### 9.3 · `procesarGratificacion` callable (30 min)

Genera boletas especiales de gratificación para todos los elegibles · ejecuta pago bulk.

### 9.4 · Update `functions/src/index.ts` con exports (15 min)

```typescript
export {
  scheduledCalcularBonosMes,
  ejecutarLiquidacion,
  procesarGratificacion,
} from './planilla';
```

### 9.5 · Update Firestore rules · permitir CFs (30 min)

Reglas para colecciones nuevas + permitir admin SDK bypass (default).

### 9.6 · Build functions + commit (15 min)

```bash
cd functions && npm run build
cd ..
git add -A
git commit -m "chk5.PERSONAS-v5.4 · Fase 9 · Cloud Functions cron + liquidación + gratificación"
git push origin main
```

**Riesgos:** medio · CFs nuevas · validar despliegue.

---

## FASE 10 · Tests + build + deploy (2h)

**Objetivo:** validación E2E + deploy a producción.

### 10.1 · `npm run build` clean (15 min)

```bash
npm run build  # debe exitar 0 · resolver cualquier error
```

### 10.2 · Smoke test E2E manual (45 min)

Checklist:
- [ ] /usuarios · 3 sub-tabs · click chip "Socio" → banner violet
- [ ] /usuarios · click chip "Planilla" → banner sky
- [ ] /usuarios · click chip "Todos" → todos los usuarios
- [ ] /inversionistas · admin ve banner cross-link
- [ ] /inversionistas · socio normal NO ve banner
- [ ] /planilla · shell canon sky v5.2
- [ ] /planilla · tab Boletas · generar boletas funciona
- [ ] /planilla · tab Adelantos · aprobar/rechazar funciona
- [ ] /planilla · tab Incentivos · crear esquema TIPO A
- [ ] /planilla · tab Incentivos · calcular bonos del mes
- [ ] /planilla · tab Vacaciones · NO menciona CTS
- [ ] /planilla · tab Análisis · 4 cross-links funcionan
- [ ] Ficha 360 · admin ve "Ajustar salario" · histórico salarial visible
- [ ] Wizard baja · 4 pasos funcionan · genera liquidación

### 10.3 · Deploy a producción (30 min)

```bash
# Firestore rules
firebase deploy --only firestore:rules

# Cloud Functions nuevas
firebase deploy --only functions:scheduledCalcularBonosMes,functions:ejecutarLiquidacion,functions:procesarGratificacion

# Verificar logs
firebase functions:log --lines 30
```

### 10.4 · Commit final + tag (15 min)

```bash
git add -A
git commit -m "chk5.PERSONAS-v5.x · COMPLETO · Usuarios v5.3 + Inversionistas v5.3 + Planilla v5.4 deployed"
git tag -a v5.4-personas -m "Release v5.4 · rearquitectura personas completa"
git push origin main --tags
```

### 10.5 · Actualizar REGISTRO_IMPLEMENTACION.md (15 min)

Agregar entrada con resumen de la implementación · decisiones canon · deudas restantes.

**Riesgos:** bajo · solo validación + deploy.

---

## 📝 DEUDAS DECLARADAS · futuro (post v5.x)

### 1. Sistema de incentivos custom con lógica (TODO #87)

Permitir que admin escriba expresiones lógicas tipo:
```
IF venta_total > 50000 AND cliente_es_recurrente THEN bono = venta * 0.05
IF entregas_a_tiempo >= 95 AND volumen_total > 100 THEN bono = 800
```

Requiere:
- Mini-lenguaje DSL para expresiones
- Validador sintaxis + sandbox seguro
- UI builder visual (drag-drop conditionals)
- Tests exhaustivos
- Estimado: ~12h

### 2. Reportes ejecutivos avanzados de planilla

- Comparativos YoY
- Forecasting de payroll con escenarios
- Análisis predictivo de rotación

### 3. Notificaciones automáticas

- Email a empleado cuando cambia su sueldo
- Email a admin cuando vence gratificación
- Email a finanzas cuando se procesan liquidaciones

### 4. Bonificaciones en cripto/USD

Esquemas de incentivo en USD para evitar inflación · o tokens propios. Post-MVP.

### 5. Integración con planilla SUNAT/AFP

Reportes oficiales · descuentos AFP · ESSALUD · etc. Compliance Perú · ~20h.

---

## 🎯 Cómo trabajar este roadmap

### Opción A · Todo en una sola sesión maratónica (~28h en 2 días)

Pros: termina rápido · momentum
Cons: cansancio · errores · zero break para validar

### Opción B · 4 sesiones de ~7h (recomendado)

- **Sesión 1:** Fases 0 + 1 + 2 + 8 (Inversionistas + Usuarios) · ~4h
- **Sesión 2:** Fase 3 + 4 (Planilla backend + UI shell) · ~9h
- **Sesión 3:** Fases 5 + 6 + 7 (Modales + cross-links + cálculos) · ~11h
- **Sesión 4:** Fases 9 + 10 (Cloud Functions + tests + deploy) · ~5h

Pros: validás entre sesiones · feedback temprano
Cons: ~1 semana en total

### Opción C · Por módulo (más conservador)

- **Semana 1:** Solo Inversionistas + Usuarios · validar 1 semana en producción
- **Semana 2:** Solo Planilla backend + shell
- **Semana 3:** Modales + cross-links + deploy

Pros: rollback fácil si algo falla
Cons: más demora total

**Mi recomendación: Opción B**

---

## ✅ Definition of Done · v5.x personas

Cada fase está completa cuando:

1. ✅ `tsc -b && vite build` exit 0
2. ✅ Smoke test del feature funciona (test manual del checklist correspondiente)
3. ✅ Commit canon con mensaje detallado
4. ✅ Push a `origin/main`
5. ✅ Sin warnings nuevos en build (excepto los pre-existentes de bundle size)
6. ✅ Tasks correspondientes marcadas como completed
7. ✅ Si toca producción: deploy + verificación logs

### Sistema completo "done" cuando:

1. ✅ Las 10 fases completadas
2. ✅ Smoke test E2E de 14 puntos pasa
3. ✅ Deploy a producción ejecutado
4. ✅ REGISTRO_IMPLEMENTACION.md actualizado
5. ✅ Mockups quedan como referencia visual canonizada
6. ✅ Decisiones canon D-P1..D-PL10 documentadas

---

## 📊 Resumen final · archivos a crear/modificar

### TOTAL · ~35 archivos nuevos + ~12 archivos modificados

**Types NUEVOS (4):**
- historialSalarial.types.ts
- esquemaIncentivo.types.ts
- calculoIncentivo.types.ts
- liquidacionEmpleado.types.ts

**Services NUEVOS (5):**
- historialSalarial.service.ts
- esquemaIncentivo.service.ts
- calculoIncentivo.service.ts
- liquidacion.service.ts
- planillaAnalytics.service.ts

**Utils NUEVOS (1):**
- incentivoCalculadores.ts

**Components NUEVOS (16+):**
- usuarios/FiltroChipsRol.tsx
- usuarios/banners/BannerCrossLinkInversionistas.tsx
- usuarios/banners/BannerCrossLinkPlanilla.tsx
- usuarios/HistorialSalarialTimeline.tsx
- usuarios/AjustarSalarioModal.tsx
- planilla/GenerarBoletasModal.tsx
- planilla/NuevaBoletaModal.tsx
- planilla/BoletaDetalleModal.tsx
- planilla/CerrarMesModal.tsx
- planilla/AprobarAdelantoModal.tsx
- planilla/RechazarAdelantoModal.tsx
- planilla/NuevoEsquemaIncentivoModal.tsx
- planilla/EditarEsquemaIncentivoModal.tsx
- planilla/CalcularBonosMesModal.tsx
- planilla/AprobarBonoModal.tsx
- planilla/RechazarBonoModal.tsx
- planilla/ProgramarVacacionesModal.tsx
- planilla/ProcesarGratificacionModal.tsx
- planilla/WizardBajaEmpleadoModal.tsx
- planilla/ExportPayrollModal.tsx

**Pages COMPONENTS NUEVOS (3):**
- Planilla/components/TabIncentivos.tsx
- Planilla/components/TabVacacionesGratificaciones.tsx
- Planilla/components/TabAnalisisReportes.tsx

**Cloud Functions NUEVAS (4):**
- planilla.cron.ts (scheduledCalcularBonosMes)
- planilla.liquidacion.ts (ejecutarLiquidacion)
- planilla.gratificacion.ts (procesarGratificacion)
- planilla.helpers.ts (sharedFunctions)

**Modificaciones:**
- src/pages/Usuarios/Usuarios.tsx (5 → 3 tabs + filtro chips)
- src/pages/Inversionistas/Inversionistas.tsx (banner cross-link)
- src/pages/Planilla/Planilla.tsx (shell completo refactor)
- src/pages/Planilla/components/TabBoletas.tsx (rewrite canon)
- src/pages/Planilla/components/TabAdelantos.tsx (rewrite canon)
- src/pages/Planilla/components/AdelantoForm.tsx (migrar FormModalV2)
- src/pages/Usuarios/Ficha360/Ficha360Modal.tsx (histórico salarial)
- src/types/planilla.types.ts (agregar bonificacionesIncentivo · eliminar CTS)
- src/config/collections.ts (4 nuevas)
- src/store/planillaStore.ts (cross-link integration)
- firestore.rules (4 nuevas reglas)
- functions/src/index.ts (exports CFs)
- (Eliminar: TabSocios.tsx · TabPlanilla.tsx · TabEmpleados.tsx · EmpleadoForm.tsx)

---

**Status:** roadmap completo · 28h estimadas · listo para arrancar implementación cuando user lo confirme.  
**Próximo paso:** validar este roadmap → arrancar Fase 0 → seguir secuencial hasta Fase 10.

---

**Autor:** Claude · 2026-05-26  
**Versión:** v1.0 · primer roadmap minucioso de personas v5.x
