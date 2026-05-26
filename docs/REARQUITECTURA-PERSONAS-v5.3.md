# REARQUITECTURA PERSONAS v5.3
## Usuarios + Planilla + Inversionistas · análisis estratégico

**Fecha:** 2026-05-26 · post-deploy chk5.F4-USERS  
**Detonante:** observación del user · tab "Planilla" dentro de /usuarios y módulo /planilla se sienten como mix raro  
**Alcance:** decisión arquitectónica global de cómo se organizan las 3 superficies que tratan con personas

---

## 1 · Diagnóstico actual (post-fase chk5.F4-USERS)

### Estado de las 3 superficies

| Módulo | Líneas | Madurez | Foco actual |
|---|---|---|---|
| `/usuarios` | 851 (post-cleanup) | ✅ Maduro · canon v5.2 purple · 5 sub-tabs | Directorio + sub-perfiles + 10 modales canon |
| `/planilla` | 61 | ❌ Sub-desarrollado · sin canon v5.2 · solo 3 tabs simples | Empleados + Boletas + Adelantos |
| `/inversionistas` | 556 + 7 sub-componentes | ✅ Maduro · canon v5.2 violet · 7 sub-tabs | "Mi Capital" · vista personal del socio |

### Problema identificado por el user

> *"Una sección de planilla, pero entiendo que es un mix entre usuarios y la sección planilla como tal."*

**Diagnóstico técnico de la duplicación:**

| Superficie | Lo que muestra | ¿Duplicado de? |
|---|---|---|
| `/usuarios` tab Planilla | KPIs (en planilla · payroll mes · modalidad) + lista corta de personas | `/planilla` tab Empleados |
| `/usuarios` tab Socios | KPIs (capital · % participación · total) + lista de socios | Parcialmente con `/inversionistas` |
| `/usuarios` tab Accesos | Sesiones globales + intentos fallidos | Parcialmente con `/auditoria` |
| `/planilla` tab Empleados | Lista de empleados con datos laborales | `/usuarios` tab Planilla |

### Root cause

Cuando implementé chk5.F4-USERS Fase 4 (5 sub-tabs en /usuarios), inyecté **KPIs operativos** (payroll mes · participación %) en los sub-tabs · convirtiéndolos en **réplicas livianas** del módulo dedicado en vez de **directorios livianos**.

El canon original del mockup integral era:
> Los sub-tabs de /usuarios son DIRECTORIOS de personas · NO operaciones.

Mi desviación: agregué información operativa duplicada · violando el **Canon de Ubicación de Funcionalidad** (CLAUDE.md 2026-05-10).

---

## 2 · Benchmarks · cómo lo resuelven empresas SaaS grandes y modernas

### Rippling (HR all-in-one · ~13B valuación)

**Filosofía:** "People is the source of truth"

- **/people** = directorio único de todas las personas del negocio
- Cada persona tiene un perfil con tabs internos: `Personal · Job · Pay · Benefits · Time off · IT · Devices`
- **Módulos operativos separados:** `Payroll Runs` · `Benefits Administration` · `IT Provisioning`
- **CERO duplicación:** cuando estás en `Payroll Runs` y necesitas info de una persona · drilldown a su perfil en /people
- **Filtro fuerte:** /people tiene filtros poderosos (rol · departamento · status · etc.)

### Gusto (payroll cloud · ~10B valuación)

**Filosofía:** "Team + Run payroll"

- **/team** = directorio de empleados con perfiles ricos
- **/payroll/run** = operación mensual (correr nómina)
- En `/payroll/run` se ven SOLO los empleados activos esa nómina · drilldown a /team si necesitas editar
- **Separación clara:** directorio (estado) vs operación (flujo del mes)

### Brex / Ramp (spend management · ~12B y ~13B)

**Filosofía:** "People as financial entities"

- **/team** = directorio compacto
- **/cards** · **/bills** · **/reimbursements** = módulos operativos
- Cada operación referencia a `team member` · pero no re-lista todo el directorio
- Drawer rápido desde una operación a la persona

### Mercury Bank (banking · ~1.6B valuación)

**Filosofía:** "Members en Settings"

- No tiene módulos operativos sobre personas (no es HR)
- **Settings → Members** es el directorio simple
- **Approvals** es flujo separado · no duplica directorio

### Linear (project management · ~1.25B)

**Filosofía:** "Members minimal"

- **Settings → Members** = directorio mínimo (nombre · email · rol)
- Toda la operación (issues · projects) referencia personas pero no re-lista
- Drilldown desde issue → perfil de persona

### Notion (workspace · ~10B)

**Filosofía:** "Database concept"

- Una "página" de persona puede aparecer en múltiples vistas/databases
- La fuente de verdad es ÚNICA · las vistas son derivadas
- Cero confusión de "dónde edito esto"

### Síntesis de patrones ganadores

| Patrón | Aplicación |
|---|---|
| **Directorio único** | Una sola entrada para "ver quién está en el sistema" |
| **Filtros poderosos** | Reemplazan necesidad de tabs duplicadas |
| **Drilldown rich** | Click en persona desde cualquier lugar abre su perfil completo |
| **Módulos con foco** | Cada módulo operativo se centra en SU operación · no re-lista personas |
| **Cross-link sutil** | Banner/link claro pero no invasivo entre directorio y operación |

---

## 3 · Filosofía propuesta para BusinessMN v5.3

### Principio rector

> **"Directorio + Operación · separados por audiencia y por flujo"**

### 3 reglas canon

1. **Una persona vive en UN lugar:** `/usuarios` es la fuente única de personas. Toda gestión (multi-rol · permisos · sub-perfiles · invitaciones) ocurre ahí.

2. **Cada módulo operativo tiene UN foco:** `/planilla` opera la nómina del mes · `/inversionistas` muestra "mi capital" del socio logueado. NO re-listan personas.

3. **Filtros reemplazan tabs duplicadas:** "Ver socios" o "Ver personal en planilla" son **filtros** en /usuarios · no tabs separados.

### Audiencias por superficie

| Superficie | Audiencia primaria | Caso de uso típico |
|---|---|---|
| `/usuarios` | Admin/gerente | "Quiero gestionar quiénes están en el sistema y sus roles" |
| `/usuarios` filtro=socio | Admin/gerente | "Quiénes son socios y cuál es su rol" |
| `/usuarios` filtro=planilla | Admin/gerente | "Quiénes están en planilla y cuál es su modalidad" |
| `/planilla` | Finanzas/RRHH | "Tengo que correr la nómina de mayo" |
| `/inversionistas` | Socio (cualquiera con rol socio) | "Cómo va mi capital · cuál es mi ROI" |

**Observación clave:** Inversionistas NO es vista admin de "todos los socios" · es vista PERSONAL del socio que loga. Por eso NO duplica con tab "Socios" de /usuarios · son cosas distintas.

---

## 4 · Diseño detallado v5.3

### 4.1 · `/usuarios` v5.3 · "Hub de personas"

**Cambios respecto a v5.2:**

| Sub-tab actual | Acción v5.3 |
|---|---|
| Resumen | ✅ MANTENER · enriquecer con **filtros chip por rol** |
| Socios | ❌ ELIMINAR · reemplazar por filtro chip "socio" + cross-link card a /inversionistas |
| Planilla | ❌ ELIMINAR · reemplazar por filtro chip "planilla" + cross-link card a /planilla |
| Accesos | ✅ MANTENER · es distinto a auditoría (sesiones en vivo vs timeline histórico) |
| Configuración | ✅ MANTENER |

**Estructura final · 3 sub-tabs:**

```
[Resumen]  [Accesos & seguridad]  [Configuración]
```

**Tab Resumen rediseñado:**

```
┌─────────────────────────────────────────────────────────────┐
│ KPI strip (Total · Activos · Pendientes · Socios · Multi-rol)│
├─────────────────────────────────────────────────────────────┤
│ Banner amber: "2 pendientes esperan aprobación → Ver"        │
├─────────────────────────────────────────────────────────────┤
│ ⚡ FILTROS RÁPIDOS por rol (chips horizontales scroll-x)     │
│ [Todos · 14] [Admin · 1] [Socio · 3] [Planilla · 8]         │
│ [Gerente · 2] [Otros · 1] [Pendientes · 2]                  │
│                                                              │
│ Cuando "Socio" está activo · aparece banner sutil:           │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 💜 Filtrando socios · Para ver cap table · ROI ·     │    │
│ │    trayectoria · ir a Inversionistas →               │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ Cuando "Planilla" está activo · aparece banner sutil:        │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 💙 Filtrando personal en planilla · Para boletas ·   │    │
│ │    adelantos · vacaciones · ir a Planilla →          │    │
│ └──────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│ Lista de cards (mismo canon F4 actual)                       │
│ - Avatar gradient por rol · chips multi-rol                  │
│ - Acciones: Ficha 360 (modal) · Editar · Más...             │
│ - Aprobar/Rechazar visible si estado=pendiente_aprobacion    │
└─────────────────────────────────────────────────────────────┘
```

**Ventajas:**
- Cero duplicación
- 1 click para ver "solo socios" o "solo planilla" (chip filter)
- Cross-link siempre visible cuando filtras (banner sutil aparece)
- Lista única de cards · cero confusión

### 4.2 · `/planilla` v5.3 · "Operación mensual de RRHH"

**Estado actual:** sub-desarrollado · 61 líneas · sin canon v5.2

**Cambios respecto al actual:**

| Sub-tab actual | Acción v5.3 |
|---|---|
| Empleados | ❌ ELIMINAR · "Para gestionar quién está en planilla · ir a Usuarios → filtro Planilla" |
| Boletas | ✅ MANTENER · canon v5.2 sky banking-grade |
| Adelantos | ✅ MANTENER · canon v5.2 |
| (NUEVO) Vacaciones & CTS | ⭐ AGREGAR · módulo no existía |
| (NUEVO) Reportes | ⭐ AGREGAR · payroll YTD · costo mes · etc. |

**Shell v5.3 (canon sky banking-grade):**

```
[Breadcrumb] Inicio › Finanzas y Contabilidad › Planilla

┌─────────────────────────────────────────────────────────────┐
│ [icon sky] Planilla                                          │
│ Operación mensual de nómina · boletas · adelantos · CTS      │
│                          [Exportar] [Cerrar mes] [+ Boleta] │
├─────────────────────────────────────────────────────────────┤
│ KPI strip 4 cards (canon N1+N2 sky):                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ PAYROLL  │ │ PERSONAL │ │ ADELANTOS│ │ PRÓXIMA  │         │
│ │   S/32K  │ │  ACTIVO  │ │ PENDIENTE│ │ NÓMINA   │         │
│ │  +5% MoM │ │    8     │ │  S/1.2K  │ │ en 12d   │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────┤
│ [Boletas del mes] [Adelantos] [Vacaciones & CTS] [Reportes] │
├─────────────────────────────────────────────────────────────┤
│ Tab activa: Boletas del mes (default)                        │
│ - Lista de boletas de la nómina actual                       │
│ - Estados (pendiente · aprobada · pagada)                    │
│ - Acción "Generar boletas del mes" (botón primary sky)       │
├─────────────────────────────────────────────────────────────┤
│ Banner cross-link sutil (no obtrusivo):                      │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 👥 Para agregar/editar personal en planilla ·        │    │
│ │    ir a Usuarios → filtrar por rol "planilla" →      │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Foco:** OPERACIÓN del mes · no directorio. Cuando un finanzas entra acá · busca correr la nómina · no editar perfiles.

### 4.3 · `/inversionistas` v5.3 · "Mi Capital · vista del socio"

**Estado actual:** ya está maduro · canon violet v5.2 · 7 sub-tabs (Resumen · Capital · Trayectoria · ROI · Distribución · Salud · Reportes)

**Cambios mínimos:**

1. **Header del shell · agregar banner sutil cross-link** (solo visible para admin/gerente · no para socios normales):

```
┌──────────────────────────────────────────────────────────────┐
│ [Banner indigo · solo admin]                                  │
│ 👤 Para agregar/editar socios y sus % participación ·         │
│    ir a Usuarios → filtrar por rol "socio" →                  │
└──────────────────────────────────────────────────────────────┘
```

2. **NO tocar las 7 tabs internas** · son la operación correcta.

3. **NO duplicar lista de socios** · es vista PERSONAL del socio que loga.

**Foco:** vista ejecutiva del CAPITAL · ROI · trayectoria. Audiencia: socios + admin que quiere ver "cap table consolidado".

---

## 5 · Decisiones canon (D-PERSONAS-v5.3)

| ID | Decisión |
|---|---|
| **D-P1** | `/usuarios` es la fuente única de personas · gestión completa (CRUD · roles · sub-perfiles · invitaciones) |
| **D-P2** | `/usuarios` se reduce de 5 a 3 sub-tabs: Resumen · Accesos & seguridad · Configuración |
| **D-P3** | Sub-tabs Socios y Planilla **eliminados** · reemplazados por filtros chip por rol en tab Resumen |
| **D-P4** | Al filtrar por rol "socio" o "planilla" · aparece banner cross-link al módulo correspondiente |
| **D-P5** | `/planilla` se centra en OPERACIÓN mensual · NO incluye tab "Empleados" como directorio |
| **D-P6** | `/planilla` se rediseña canon v5.2 sky banking-grade · 4 tabs (Boletas · Adelantos · Vacaciones & CTS · Reportes) |
| **D-P7** | `/inversionistas` se mantiene como vista PERSONAL "Mi Capital" del socio logueado · NO es directorio |
| **D-P8** | `/inversionistas` agrega banner cross-link sutil "Configurar socios en Usuarios →" (solo visible admin/gerente) |
| **D-P9** | Cross-links del directorio a los módulos operativos son **siempre claros y prominentes** (canon N8) |
| **D-P10** | Filtros chip por rol en tab Resumen tienen counts dinámicos (ej. "Socio · 3") y soportan scroll-x mobile (canon N6) |

---

## 6 · Plan de migración (sin breaking changes)

### Fase 1 · `/usuarios` v5.3 (~2h)

1. Eliminar imports y wire-up de TabSocios · TabPlanilla · TabAccesos (mantener TabConfiguracion)
2. Mantener `TabAccesos` (no es duplicación · es vista en vivo de sesiones)
3. Refactor del Tab Resumen para incluir **chips filtro por rol** con counts dinámicos
4. Agregar lógica: cuando filtro `socio` o `planilla` activo · mostrar banner cross-link
5. Reducir state `tabActiva` a `'resumen' | 'accesos' | 'configuracion'`
6. Eliminar archivos `TabSocios.tsx` · `TabPlanilla.tsx` (mantener TabAccesos)

### Fase 2 · `/planilla` v5.3 (~4h)

1. Refactor completo · canon v5.2 sky banking-grade
2. Shell con breadcrumb 3 niveles + header canon F1 + KPI strip + sub-tabs canon N6
3. 4 tabs nuevos: Boletas · Adelantos · Vacaciones & CTS · Reportes
4. Eliminar TabEmpleados.tsx
5. Crear nuevos sub-componentes:
   - TabBoletas refactor canon
   - TabAdelantos refactor canon
   - TabVacacionesCTS NUEVO
   - TabReportes NUEVO
6. Banner cross-link a `/usuarios?filterRole=planilla` en cada sub-tab

### Fase 3 · `/inversionistas` v5.3 (~30 min)

1. Agregar banner cross-link arriba del breadcrumb (solo si `hasRole(currentUser, 'admin' | 'gerente')`)
2. CTA "Configurar socios en Usuarios →"
3. Sin más cambios · módulo ya maduro

### Tiempo total estimado: ~6-7h en 1 sesión grande

---

## 7 · Trade-offs honestos

### Pros de la propuesta

✅ **Cero duplicación** · cada superficie tiene foco claro  
✅ **Coherente con benchmarks** · Rippling/Gusto/Brex hacen lo mismo  
✅ **Menos sub-tabs en /usuarios** · de 5 a 3 (más simple cognitivamente)  
✅ **Filtros chip más potentes** · 1 click vs cambio de tab  
✅ **`/planilla` finalmente canon v5.2** · módulo sub-desarrollado se moderniza  
✅ **Vacaciones & CTS + Reportes** · funcionalidad faltante se agrega  

### Cons / Riesgos

⚠ **Refactor /planilla es grande** · ~4h de trabajo · prudente validar mockup primero  
⚠ **Algunos users pueden extrañar la tab "Socios"** de /usuarios · pero el filtro chip + banner hace la misma función con 1 click  
⚠ **Necesita migración suave** · cualquier link/bookmark a /usuarios#tab-planilla puede romperse  
⚠ **Cambio cognitivo** · users que se acostumbraron a las tabs separadas necesitan re-aprender  

### Mitigaciones

- Banner informativo en /usuarios la primera vez que entrás: "Hemos simplificado el módulo · ahora los filtros chip reemplazan las pestañas"
- Mantener documentación clara
- No cambiar URLs · solo eliminar tabs · zero breaking change real

---

## 8 · Anti-patterns que EVITAMOS

❌ **Duplicar directorios de personas en cada módulo** (lo que hicimos en F4 sin querer)  
❌ **Operación mezclada con directorio** (tab "Empleados" en /planilla)  
❌ **5+ tabs por módulo cuando 3 alcanzan** (cognitivo overload)  
❌ **Cross-links escondidos o débiles** (canon N8 dice siempre visibles)  
❌ **Re-arquitectura radical (Opción C anterior)** · /planilla como sub-ruta de /usuarios · rompe links · costo > beneficio  

---

## 9 · Cómo se ve el flujo end-to-end del admin

### Escenario A · "Quiero ver quiénes son socios"

**Antes (v5.2):**  
1. Voy a /usuarios → click tab "Socios" → veo cap table preview

**Después (v5.3):**  
1. Voy a /usuarios → click chip "Socio" → veo 3 cards filtradas + banner "Ver Cap Table en Inversionistas →"

### Escenario B · "Quiero correr la nómina de mayo"

**Antes (v5.2):**  
1. Voy a /planilla → click tab "Boletas" → veo lista (interfaz simple sin canon)

**Después (v5.3):**  
1. Voy a /planilla → tab "Boletas del mes" activa por default → KPI strip muestra "Próxima nómina en 12d" + "Generar boletas del mes" como CTA primary

### Escenario C · "Quiero agregar a Pedro como personal de planilla"

**Antes (v5.2):**  
1. Voy a /planilla → tab "Empleados" → "Agregar" → form  
2. (O voy a /usuarios → busco Pedro → asigno rol planilla)  
3. (Confusión: ¿qué hago si está en ambos lugares?)

**Después (v5.3):**  
1. Voy a /usuarios → busco Pedro → Editar → asignar rol "planilla" → drill page datos laborales  
2. (Único flujo · cero confusión)

### Escenario D · "Soy socio y quiero ver mi ROI"

**Sin cambios v5.2 vs v5.3:**  
1. Voy a /inversionistas (módulo en sidebar) → veo "Mi Capital · ROI · Trayectoria · etc."  
2. Es vista PERSONAL · no directorio.

---

## 10 · Próximo paso · validación visual

Producir 3 mockups HTML para validar antes de codear:

1. `docs/mockups/usuarios-v5.3-hub.html` · /usuarios refactor (3 tabs + filtros chip)
2. `docs/mockups/planilla-v5.3-canon.html` · /planilla rewrite canon v5.2 sky
3. `docs/mockups/inversionistas-v5.3-tweaks.html` · ajustes menores

**No se toca código hasta que mockups sean aprobados visualmente.**

---

**Status:** análisis completo · esperando validación visual de los 3 mockups.
**Autor:** Claude · 2026-05-26
**Aprobación pendiente:** José LP (admin)
