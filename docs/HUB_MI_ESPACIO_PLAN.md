# Plan · Unificación del hub "Mi Espacio" (/perfil)

> Estado: **verificado (recon wf_9c55297c · 4 agentes) · listo para ejecutar.**
> Spec visual: `docs/mockups/mi-espacio-hub-completo-v2.html`.
> Origen: el usuario pidió que el hub `/perfil` aglomere la bandeja (y las demás sub-páginas) como tabs.
> Hoy: `/perfil` = hub con 3 tabs reales · las sub-páginas (planilla/histórico/capital/bandeja) son **rutas separadas**
> (`/perfil/mi-X`) que se alcanzan desde el sidebar. Esto las unifica como **tabs del hub**.

## Enfoque (decidido): EXTRAER CONTENIDO

Único enfoque que respeta las 2 restricciones duras: **(1) no doble-shell** y **(2) las 3 tabs reales intactas**.
Cada sub-página rinde su contenido **sin shell** (sin `max-w-6xl`, sin card `rounded-2xl`, sin `BackArrowHeader`) — vía un
prop `embedded?: boolean` (default false = standalone con shell · el hub pasa `embedded`). El hub `MiPerfil` lo monta en su
§D body (`div p-6 space-y-5`), heredando UN solo shell canon. **NO** nested routes (`<Outlet/>` reintroduce doble header).
**NO** route-tabs (re-montaría el shell en cada cambio).

## Las 7 tabs (role-adaptivas)

| Tab | Gating | Body |
|---|---|---|
| Resumen | siempre | **intacto** (ResumenAdmin→Vendedor→Empleado→Socio + banners + pendientes + MisAreas) |
| Mi información | siempre | **intacto** (Identidad + MultiRol + DatosLaborales si empleado + MiCapitalSocio si socio + permisos) |
| Actividad & seguridad | siempre | **intacto** (Contraseña + Métodos + Sesiones + timeline) |
| Mi planilla | `hasDatosLaborales` (disabled-pedagógico si multi-rol sin datos) | `MiPlanillaPersonal embedded` (conserva sus 5 sub-tabs **toggle interno**) |
| Mi histórico | `hasDatosLaborales` | `MiHistorialPersonal embedded` (timeline · sin sub-tabs) |
| Mi capital | `isSocio` | `MiCapitalPersonal embedded` (hero + aportes/distribuciones) |
| Bandeja (+badge) | `canManageUsers \|\| isSocio` | `MiBandejaPersonal embedded` (conserva bifurcación admin/socio + KPI + 6 sub-tabs **toggle interno**) |

## Decisiones (todas con recomendación del recon)

1. **Tab activa en URL** (`/perfil?tab=mi-bandeja` · `useSearchParams`) → preserva F5/bookmark/compartir + habilita los redirects.
2. **Rutas `/perfil/mi-X` se mantienen como REDIRECT** a `/perfil?tab=mi-X` (`<Navigate replace>`) → cero deep-links rotos.
3. **`BackArrowHeader` fuera del body** (es el doble-shell) · su `navigate('/perfil')` de empty-states → `setTabActiva('resumen')` (o se oculta cuando `embedded`).
4. **Bandeja = UN body** con su bifurcación admin/socio interna (NO partir en 2 tabs · rompería el multi-rol admin+socio).
5. **KPI strip de Bandeja vive DENTRO de su tab** (el hub no tiene KPI strip global · su "KPI" es el header con avatar).
6. **Fuente ÚNICA de gating** compartida hub↔sidebar (extraer el criterio de `useMiEspacioItems`) → evita la "estructura divergente".
7. **Lazy por tab** (montar el body solo cuando su tab está activa) → no dispara 4 fetches en el mount del hub.
8. **DIFERIDO** (scope incremental · no bloquea): sub-tab "Mis aprobaciones dadas" + permiso `APROBAR_EGRESO` por socio que pide el v2.

## Pasos (en orden · cada uno verificable + side-by-side M4)

1. **Fuente única de gating**: extraer el criterio role-adaptivo de `useMiEspacioItems` a un helper/hook compartido (`hasDatosLaborales`/`isSocio`/`canManageUsers`/`bandejaCount`/disabled) que el sidebar y el hub consuman.
2. **`embedded` en las 4 sub-páginas**: cada una acepta `embedded?` y, cuando true, rinde solo el contenido (sin `max-w` + card + `BackArrowHeader`). Helper local `wrap()` para no duplicar. Empezar por **Mi histórico** (la más limpia · 3 returns) → **Mi capital** → **Mi planilla** (conservar 5 sub-tabs) → **Mi bandeja** (la difícil: bifurcación admin/socio + KPI + 6 sub-tabs + early-returns → empty-states sin shell).
3. **Hub `MiPerfil.tsx`**: extender `TabActiva` a los 7 ids · construir `TABS` desde la fuente única (gating) · leer/escribir `?tab=` con `useSearchParams` (init desde URL · `setTab` escribe replace) · agregar los 4 condicionales `tabActiva==='mi-X' && <MiXPersonal embedded/>` en §D body. **NO tocar** los 3 bodies reales.
4. **Routing `App.tsx`**: las 4 rutas `/perfil/mi-X` → `<Navigate to="/perfil?tab=mi-X" replace/>`.
5. **Sidebar `MiEspacioGroup`/`useMiEspacioItems`**: `isActive` contempla `?tab=` (o los items apuntan directo a `/perfil?tab=mi-X`).
6. **Tab disabled-pedagógica** (multi-rol sin datosLaborales) coherente con el item disabled del sidebar.
7. **Validación**: side-by-side de las 7 tabs (canon v9.0 M4) + **matriz de roles** (admin · socio · empleado · vendedor · multi-rol admin+socio · sin-rol · vacío). Recién entonces eliminar las 4 sub-páginas viejas con knip + verificar `BackArrowHeader` dead-code.

## Riesgos (con mitigación)

- **Doble shell** (el más grave): un body que conserve su `max-w`+card+`BackArrowHeader` → 2 breadcrumbs/headers. → el body arranca directo en el contenido · validar M4 tab por tab.
- **Deep-links rotos**: → redirect `Navigate(replace)` en las 4 rutas.
- **Subir los toggles internos** (Planilla 5 · Bandeja 6) al nivel del shell (anti-canon TABS-vs-TOGGLE) o perder su estado. → estado de sub-tab vive DENTRO del body.
- **Divergencia gating hub↔sidebar** (= la "estructura inventada"). → fuente única.
- **Bandeja multi-rol** (admin+socio debe ver RRHH + egresos juntos). → matriz de prueba con los 4 perfiles + vacío.
- **Perf en el mount** (4 fetches simultáneos). → montaje condicional por tab activa.
- **`BackArrowHeader` dead-code mal borrado**. → verificar otros usos (knip) antes de borrar.
