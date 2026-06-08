# Diagnóstico 360 · Dominio PERSONAS — fragmentación del modelo "persona → relación → detalle"

> **Fecha:** 2026-06-08
> **Estado:** DIAGNÓSTICO (cero código) · pendiente de decisión de rumbo del usuario.
> **Gatillo:** investigando "el hogar de la sociedad del socio" (task #15) el usuario detectó
> que la Ficha 360 que yo analizaba **ya no existe visualmente** (está deprecada). Al re-mapear
> el flujo vivo apareció una fragmentación **sistémica** del modelo de personas: el socio —y el
> empleado, y honorarios— viven partidos entre 3 olas de "unificación" que nunca terminaron.
> **Principio rector aplicado:** documentar el alcance 360 antes de comprometer el refactor.
> El usuario eligió explícitamente "C · Primero documentar + auditar el alcance".

---

## 0. Resumen ejecutivo (3 líneas)

Hubo **3 olas** de modelado para representar "qué es una persona en el negocio". Cada ola dijo
*"reemplaza a la anterior"* pero **ninguna migró a sus consumidores**. Hoy conviven 3 capas: el
**alta** escribe en la capa nueva (`RelacionLaboral`), los **módulos operativos** (Planilla,
Inversionistas) leen las capas viejas (rol + sub-perfiles), y **nada las sincroniza** → un
empleado/socio creado por el flujo nuevo puede quedar **invisible** en su propio módulo.

---

## 1. Principio guía (definición del usuario · 2026-06-08)

Cita literal del usuario:
> *"Usuarios solo es un campo para revisar los distintos perfiles que se registran en el sistema
> y complementa si es necesario el tipo de perfil que cada usuario vaya a tener."*

Traducción a arquitectura:
- **Usuarios** = dueño de la **persona** (UserProfile) + de **qué tipo de relación** tiene con el
  negocio (empleado / socio / honorarios / externo). Es el registro central y el "qué tipo".
- **Cada módulo dueño** = el **detalle** de su tipo: Planilla → salario/comisión · Inversionistas →
  equity (% · aporte · distribuciones) · Honorarios → tarifa/retención.
- El **rol** del sistema debería **derivarse** de las relaciones vigentes, no asignarse a mano aparte.

Esto coincide con la intención original de `RelacionLaboral` (la ola 3) — que nunca se completó.

---

## 2. El árbol · 3 olas de "unificación" incompletas

| Ola | Introdujo | Para qué | Path / colección | ¿Migró a consumidores? |
|---|---|---|---|---|
| **1 · original** | `PerfilLaboral` | salario + boletas de Planilla | `/users/{uid}/private/laboral` | — |
| **2 · chk5.F2** (2026-05-24) | `DatosLaborales` + `DatosSocio` | "consolidar" sub-perfiles | `/users/{uid}/private/datosLaborales` · `…/datosSocio` | ❌ quedó sobre la ola 1 |
| **3 · chk5.PERSONAS-v5.6** (2026-05-28) | `RelacionLaboral` (1 modelo tipado) | "unificar TODO" | colección `relacionesLaborales` | ❌ solo lo usa Usuarios + Maestros |

**Evidencia de la intención de reemplazo (que no se ejecutó):**
- `relacionLaboral.types.ts:12-18` — *"REEMPLAZA en código nuevo: datosLaborales → relación · datosSocio
  → relación · socios/{uid} → relación tipo='socio'. La migración crea relaciones equivalentes y deja
  los docs legacy para backward compat hasta que todos los lectores se migren."* ← los lectores NO se migraron.
- `App.tsx:256-258` — *"rutas editar/laborales y editar/socio ELIMINADAS · modelo viejo de sub-perfiles
  reemplazado por RelacionLaboral."* ← se eliminó la UI de edición vieja, pero los módulos siguen leyendo el modelo viejo.
- `App.tsx:65-67` — `Ficha360` DEPRECATED (fallback). El flujo vivo es el `UserPanel`.

---

## 3. Inventario de representaciones (las capas que conviven)

| # | Modelo | Tipo | Service | Path/colección | Quién ESCRIBE |
|---|---|---|---|---|---|
| A | Rol | `UserProfile.roles[]` (+ `.role` legacy) | `user.service` | `/users/{uid}` | edición manual (`RolesMultiSelect`/`EditarUsuarioModal`) |
| B | `RelacionLaboral` | doc por relación (empleado/socio/honorarios/externo) | `relacionesLaborales.service` | `relacionesLaborales/{id}` | el ALTA (wizards/modales · `useCreateUserWithRelacion`) |
| C1 | `PerfilLaboral` | salario · comisión · banco | `planilla.service` | `/users/{uid}/private/laboral` | Planilla (`guardarPerfilLaboral`) |
| C2 | `DatosLaborales` | datos laborales (ola 2) | `datosLaborales.service` | `/users/{uid}/private/datosLaborales` | (UI de edición eliminada · ver §5) |
| C3 | `DatosSocio` | % · tipo · aporte de valor · vesting | `datosSocio.service` | `/users/{uid}/private/datosSocio` | Inversionistas (`EditarValorSocioModal` · `socio.service`) |

**🔴 Hallazgo crítico:** para el **empleado** existen DOS sub-perfiles laborales paralelos que nunca se
sincronizan: **C1 `laboral`** (`planilla.service.ts:62` · `PRIVATE_DOC_ID='laboral'` · el que genera boletas)
y **C2 `datosLaborales`** (`datosLaborales.service.ts:34` · `DOC_ID='datosLaborales'` · el que leía la ficha/Perfil).
Mismo dato conceptual (salario, área), dos documentos distintos.

**Nota sobre el detalle vigente en B:** `RelacionLaboral` solo tiene `montoMensualReferencia` (referencia,
"NO source of truth" · `relacionLaboral.types.ts:240`) y los snapshots de equity/salario **solo se llenan al
FINALIZAR** la relación (`DatosSocioSnapshot`/`DatosLaboralesSnapshot` · `:256-259`). No hay % ni salario
vigente en el modelo nuevo → por eso el detalle vive en los sub-perfiles viejos.

---

## 4. Inventario de consumidores (quién LEE qué · estado de migración)

| Módulo / superficie | Lee de | Modelo | Ref verificada | Estado |
|---|---|---|---|---|
| **Alta** · `useCreateUserWithRelacion` | escribe B (RelacionLaboral) | NUEVO | `useCreateUserWithRelacion.ts:122,195` | rol nace `'invitado'` · NO crea C |
| **Planilla** · `getEmpleados` | C1 `laboral` + `user.role` | VIEJO (ola 1) | `planilla.service.ts:101-119,124-127` | 100% viejo |
| **Inversionistas** · `socio.service.getAll` | A `hasRole('socio')` + C3 `datosSocio` | VIEJO (ola 2) | `socio.service.ts:90-100` | 100% viejo · ignora B |
| **Perfil** (el user se ve) | C2 `datosLaborales` + C3 `datosSocio` | VIEJO (ola 2) | `MiPerfil.tsx:44-45`, subs | 100% viejo · 3ª fuente ≠ Planilla |
| **Honorarios** | B `RelacionLaboral` | NUEVO | `Usuarios.tsx` filtra tipo='honorarios' | nuevo · **sin módulo operativo** |
| **Usuarios / UserPanel / Maestros** | B `RelacionLaboral` | NUEVO | `relacionesLaborales.service` (13 consumidores) | nuevo |
| **Ficha360** | A + C2 + C3 | VIEJO | `Ficha360.tsx` | 💀 MUERTO (deprecated) |

**Sincronización rol ↔ relación:** NO existe. `relacionesLaborales.service.create` (`:135-170`) solo escribe
el doc de la relación · no toca `UserProfile.roles`. `hasRole`/`getUserRoles` (`auth.types`) leen el array de
roles, nunca consultan `RelacionLaboral`. El rol se asigna **solo a mano** (`RolesMultiSelect`).

---

## 5. Los 3 bugs estructurales concretos

1. **🐛 Empleado/socio invisible.** El alta nueva (`NuevoEmpleadoModal`, `NuevoSocioModal`,
   `AgregarRelacionWizard`) crea la `RelacionLaboral` pero deja el rol en `'invitado'`
   (`useCreateUserWithRelacion.ts:122`) y NO crea el sub-perfil. Planilla filtra por `perfilLaboral?.activo`
   (`planilla.service.ts:124-127`) e Inversionistas por `hasRole('socio')` (`socio.service.ts:92`) → el nuevo
   **no aparece** en su módulo hasta que un admin, manualmente y por separado, le asigna el rol y crea el detalle.
   `socio.service.ts:157-160` incluso lanza error si el rol no está: *"Usuario NO tiene rol socio · agregalo
   desde la edición del user antes de crear sub-perfil."* — la fricción está documentada en el propio código.

2. **🐛 Doble sub-perfil laboral.** `laboral` (C1 · Planilla) y `datosLaborales` (C2 · Perfil/ficha) son dos
   documentos distintos para el mismo empleado. Editar uno NO actualiza el otro → Planilla y Perfil pueden mostrar
   salarios/datos distintos de la misma persona.

3. **🐛 % de socio huérfano del modelo nuevo.** El wizard de alta dice explícitamente
   (`AgregarRelacionWizard.tsx:476-485`): *"El % de participación · aporte · distribuciones se configuran después
   en /inversionistas."* Pero Inversionistas los guarda en C3 `datosSocio` (modelo viejo), no en la relación →
   el socio queda partido entre B (la relación, sin %) y C3 (el %, sin relación).

---

## 6. Estado de migración por TIPO de relación

| Tipo | Alta | Listado operativo | Detalle vigente | Veredicto |
|---|---|---|---|---|
| **empleado** | B (nuevo) | C1 `laboral` (viejo) | C1 + C2 (¡doble!) | fragmentado · doble sub-perfil |
| **socio** | B (nuevo) | A+C3 (viejo) | C3 `datosSocio` (viejo) | fragmentado · rol no sincroniza |
| **honorarios** | B (nuevo) | B (nuevo · solo en Usuarios) | `montoMensualReferencia` (B) | en modelo nuevo · sin módulo operativo |
| **externo** | B (nuevo) | B + Maestros | B + `entidadMaestroRef` | en modelo nuevo · más coherente |

Conclusión: **empleado y socio están 100% en el modelo viejo para operar**, aunque se den de alta con el nuevo.
Honorarios y externo nacieron en el nuevo. La fragmentación es **sistémica**, no exclusiva del socio.

---

## 7. Causa raíz

Tres refactors de "unificación" sucesivos (olas 1→2→3) que **agregaron** un modelo nuevo y declararon
deprecado al anterior, pero **nunca ejecutaron la migración de los lectores** (los módulos de negocio). Cada
ola dejó "backward compat temporal" que se volvió permanente. Es el mismo patrón de la **task #13 / ADR-PF-001**
(CuentaCaja/TarjetaCredito → ProductoFinanciero · migración incompleta) → hay un patrón repetido de
migraciones que paran a mitad de camino.

---

## 8. Soluciones posibles

### A · `RelacionLaboral` como fuente única (RECOMENDADA · integral)
Completar la ola 3. `RelacionLaboral` se vuelve la verdad de "quién es qué"; el rol se **deriva** de las
relaciones vigentes; Planilla e Inversionistas **leen** de ahí; el detalle (salario/equity) vive en su módulo
dueño referenciado por la relación; se eliminan los sub-perfiles duplicados. Alineada 100% con la definición de
Usuarios del §1. Es la solución del principio rector — ejecutada **por fases**, no big-bang.

### B · Capa de sincronización (pegamento)
Trigger/service que al crear `RelacionLaboral` asigne el rol y cree el sub-perfil. Arregla el "invisible" con
poco refactor, pero **mantiene las 3 capas** → la complejidad y la deuda perduran. Contradice "nunca parche".

### C · Híbrida pragmática (A por fases, con B como paso 1 defensivo)
Empezar con el sync defensivo (detiene nuevos casos rotos sin esperar el refactor completo), y avanzar las fases
de A para converger al modelo único. Pragmática y de bajo riesgo inicial.

---

## 9. Plan de migración por fases (para A · destino integral)

> Cada fase es un entregable cerrado con `tsc`+`build`+commit. Orden por dependencia y riesgo.

- **Fase 0 · Decisión de modelo (sin código).** Confirmar con el usuario: (a) ¿el detalle vigente vive en el
  módulo dueño (colección propia por dominio) o en un sub-perfil único?; (b) ¿`laboral` o `datosLaborales` es el
  canónico para fusionar?; (c) ¿el rol se deriva on-read o se materializa con un sync?
- **Fase 1 · Sync defensivo (detener el sangrado).** Que el alta materialice rol + detalle (o derivar rol de
  `RelacionLaboral` en `hasRole`/`getUserRoles`). Arregla el "invisible" ya. *Riesgo: bajo. Toca el alta + auth helpers.*
- **Fase 2 · Unificar sub-perfiles laborales.** Elegir canónico entre `laboral`/`datosLaborales`, migrar datos
  (script idempotente), reapuntar Planilla + Perfil. *Riesgo: medio · Planilla genera boletas (dinero).*
- **Fase 3 · Módulos leen `RelacionLaboral`.** `planilla.getEmpleados` y `socio.service.getAll` pasan a
  `listByTipo('empleado'|'socio')`. *Riesgo: medio-alto · cambia la fuente de la lista operativa.*
- **Fase 4 · Detalle al módulo dueño.** Equity (`datosSocio`) se consolida en el dominio Inversionistas;
  salario en Planilla (ya está). *Riesgo: medio.*
- **Fase 5 · Eliminar el modelo viejo.** Borrar `datosSocio.service`/`datosLaborales.service`/sub-perfiles
  legacy + `Ficha360` muerto. *Riesgo: bajo si 1-4 cerraron · es limpieza.*

---

## 10. Dependencias y riesgos transversales

- **Planilla toca dinero** (boletas) → cualquier cambio en cómo lee al empleado necesita UAT cuidadoso.
- **Cap table / Contabilidad** dependen del % del socio → la Fase 4 debe preservar el cuadre (patrimonio).
- **ADR-PF-001 (task #13)** es el mismo patrón de migración incompleta → conviene tratarlas con el mismo criterio.
- **Datos existentes**: hay socios/empleados creados en el modelo viejo (con rol + sub-perfil) que SÍ funcionan.
  Toda migración debe ser idempotente y no romper a los que ya están bien.

---

## 11. Verificado vs. pendiente de confirmar

**Verificado en código (archivo:línea en §3-§5).** Paths, services, quién lee/escribe, ausencia de sync de rol,
doble sub-perfil laboral, rol `'invitado'` por default, Ficha360 muerta.

**Pendiente de confirmar en Fase 0** (no bloquea el diagnóstico): (a) si algún script de migración 1x ya corrió y
dejó datos en B para los socios viejos; (b) el contenido exacto de `DatosLaborales` (C2) vs `PerfilLaboral` (C1)
para decidir el canónico; (c) si Honorarios tendrá módulo operativo propio (define si su detalle va en B o en un
sub-perfil nuevo); (d) reglas Firestore de `relacionesLaborales` para lectura por los módulos.

---

## 12. Recomendación

**Rumbo A (fuente única), ejecutado con el enfoque C (fases · Fase 1 defensiva primero).** Es lo único que
respeta el principio rector (atacar la causa estructural, no el síntoma) sin un big-bang riesgoso sobre módulos
que tocan dinero. La Fase 1 entrega valor inmediato (mata el "invisible") y compra tiempo para las fases
estructurales. **Antes de cualquier código: validar este documento y cerrar las 4 preguntas de la Fase 0.**
