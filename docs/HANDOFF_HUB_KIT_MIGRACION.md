# HANDOFF · Migrar un módulo al Hub Kit (DS Fase 4)

> Cómo arrancar una sesión para migrar el siguiente módulo al **Hub Kit** con los
> parámetros y el canon ya establecidos. Última actualización: 2026-06-01.

---

## 📍 Estado actual (qué ya existe)

- **Design System** con fuente única en `src/design-system/`:
  - `grupoColor.ts` — color de identidad POR GRUPO del sidebar (heredado · `chromeDe(grupo)`).
    teal=Finanzas/Contab · violet=Equipo · blue=Comercial · orange=Inventario · indigo=Análisis · slate=Administración.
  - `tokens.ts` — escala canónica L0 (radios · tipografía por rol · sombras · spacing · breakpoints).
- **Hub Kit (L5) · COMPLETO** en `src/design-system/components/hub/` (6 blocks):
  `HubShell · HubTopBar · HubHeader · HubKpiStrip · HubTabs · HubBody`.
  Se re-exportan desde el barrel `'../../design-system'`.
- **Spec visual validada**: `docs/mockups/hub-kit-implementacion-v1.html`
  (sírvela en `http://localhost:5178/docs/mockups/hub-kit-implementacion-v1.html`).
- **Migrados (7 de 7)** ✅ **MIGRACIÓN HUB KIT COMPLETA**: `Stock` (piloto · `InventarioPageV2.tsx`) ·
  `Gastos` · `Inversionistas` · `Planilla` · `Usuarios` · `Contabilidad` · `Finanzas`.
  Cualquiera sirve de referencia. Casos útiles:
  - KPIs que quedan INLINE (no van a HubKpiStrip) → Usuarios/Contabilidad/Finanzas.
  - `HubBody flush` (contenido auto-paddea) → Planilla/Usuarios/Finanzas.
  - selector/acciones custom en header (`extraActions`) → Inversionistas/Contabilidad/Finanzas.
  - adaptación a `max-w-6xl` sin reformatear tablas/charts → Contabilidad/Finanzas.
  - **shell adaptativo router-based** (header/KPIs/acciones override por sub-ruta · `HubTabs` adaptado
    a router con `activa`=ruta + `onChange`=navigate) → **Finanzas** (`FinanzasLayout.tsx`).

### Pendientes
Ninguno · los 7 módulos hub están migrados. Próximo foco: deploy de checkpoint (Inter es global ·
validar en prod) + F2 restante del DS (consolidar L1-L4 · crear HubCard/SmartSearch/BulkActionsToolbar).

---

## 🚀 Prompt de arranque (copy-paste al inicio de la sesión)

```
Sesión: migrar el módulo <NOMBRE> al Hub Kit (DS Fase 4).

Antes de tocar código, lee para tener el contexto:
1. La memoria del proyecto (MEMORY.md · "ESTADO ACTUAL") — Design System, Hub Kit y piloto Stock.
2. docs/HANDOFF_HUB_KIT_MIGRACION.md — el patrón de migración (este doc).
3. docs/mockups/hub-kit-implementacion-v1.html — la spec del kit (validada) + sus PAUTAS CANÓNICAS §0-§7 al tope (LEER PRIMERO: ubicación/anatomía/layout 2:1/color/tipografía Inter/componentes/pixel-perfect/validación).
4. El módulo ya migrado de referencia: src/pages/Inventario/components/shell/InventarioPageV2.tsx.

Luego, siguiendo el principio rector (diagnóstico 360 + plan, yo decido antes de codear):
- Diagnostica el shell actual de <NOMBRE> y mapea cada parte → al block del kit.
- Detecta micro-diferencias (texto/padding/API de KPIs) y propón el plan. Enfoque:
  "el kit reproduce el look actual del módulo · cero regresión visual".
- Migra ensamblando <HubShell><HubTopBar/><HubHeader/><HubKpiStrip/><HubTabs/><HubBody>…</HubBody></HubShell>.
- Color heredado del grupo del módulo (grupoColor.ts · NO inventar color).
- Valida con `npm run build` (tsc -b · NO solo tsc --noEmit) + screenshot M4 side-by-side.
- Commit + push al validar. No toques otros módulos.
```

Reemplaza `<NOMBRE>` por el módulo (ej. "Gastos", "Contabilidad").

---

## 🔧 Patrón de migración (lo que se hizo con Stock)

1. **Diagnóstico 360**: leer el shell actual del módulo. Identificar:
   - Wrapper `max-w-6xl` (se queda en la página, envuelve el HubShell).
   - Top-bar (breadcrumb + chip rol) → `HubTopBar`.
   - Header (icono + h1 + subtítulo + acciones) → `HubHeader`.
   - KPI strip → `HubKpiStrip` (mapear cada KPI a `{label, valor, sufijo?, tono, icon, delta}`).
   - Tabs → `HubTabs` (array a `HubTab[]` · `icon` debe ser `LucideIcon`, no `<Icon/>`).
   - Body + su cierre → `HubBody` (con `aside` = Layout A · sin aside = Layout B).
2. **Ensamblar** el shell desde el kit. El color sale del grupo: `grupo="<grupo-del-módulo>"`.
3. **Lógica de subtítulos condicionales** de KPIs → calcular como variable antes del return,
   pasar como `delta` (string). Ver `reservadasSubtitle` en InventarioPageV2.
4. **Limpiar**: si el módulo tenía `HeaderV2`/`KpiStripV2` page-scoped propios, quedan
   muertos tras migrar → eliminarlos (verificar 0 uso con grep antes de borrar).
5. **Validar** (checklist de cierre abajo).

### Mapeo de color (semántico vs identidad)
- **Chrome** (topbar chip · header icono/primary · tab activo) → color del GRUPO (heredado).
- **Datos** (KPIs · badges) → paleta SEMÁNTICA fija (amber=dinero · rose=urgencia ·
  emerald=positivo · indigo=fijo · sky=parcial/info · violet=capital · slate=neutral).
  El color de grupo NUNCA pisa al semántico.

---

## ✅ Checklist de cierre (antes de declarar el módulo migrado)

1. `npm run build` → EXIT 0 (NO basta `tsc --noEmit` · el build con `tsc -b` es más estricto).
2. Screenshot M4 side-by-side: el render debe verse IGUAL que antes (cero regresión).
3. DOM check: breadcrumb · chip rol · KPIs · tabs · sin viteError.
4. Dead code: eliminar HeaderV2/KpiStripV2 propios del módulo si quedaron huérfanos.
5. Commit + push. (commits terminan con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`)
6. Actualizar MEMORY.md con el cierre.

## ⚠️ Aprendizajes (no repetir errores)
- **`npm run build` ≠ `tsc --noEmit`**: el build detecta errores de tipo que el check directo no.
  Validar SIEMPRE con `npm run build` antes de deploy.
- **`hasRole` recibe `userProfile`** (de `useAuthStore(s => s.userProfile)`), NO `state.user`
  (Firebase Auth, sin `.role`). Patrón: `const esAdmin = hasRole(userProfile, 'admin')`.
- **Verificar hallazgos de subagentes Explore** con grep exacto antes de borrar (se equivocan).
- **Deploy**: `npm run build` → `npx firebase deploy --only hosting` (sirve `dist/` · proyecto
  businessmn-269c9 · URL https://vitaskinperu.web.app). `--only hosting` no toca functions/rules.
