# Diagnóstico 360 · Inversionistas = dueño del Capital Y la Sociedad

> **Fecha:** 2026-06-06
> **Origen:** sesión de cierre del "hogar del capital del socio" (task #14). El usuario
> detectó que el dominio de Inversionistas tiene **dos dimensiones** —**capital** (lo que
> el socio aporta) y **sociedad** (participación, distribución)— y que varias piezas
> societarias o se crean desde otros módulos o quedaron **huérfanas** tras reworks.

## Principio rector aplicado · AUTORÍA POR CATEGORÍA

> **Cada módulo es el dueño único de la *creación* de su categoría de información.
> La info se *origina* solo desde su módulo dueño; los demás la *leen* o *referencian*,
> pero no la *crean*.**

- **Capital + Sociedad** → se crean/gestionan solo en **Inversionistas**.
- **Cuenta / saldo (contenedor)** → se crean en **Finanzas** (Inversionistas opera sobre cuentas existentes, nunca las crea).
- **Persona / cuenta de usuario** → se crea en **Usuarios**.

---

## El dominio en 2 dimensiones

### 1. CAPITAL (lo que el socio APORTA)
| Pieza | Dónde se crea HOY | Estado | Acción |
|---|---|---|---|
| Aporte cash | Inversionistas (`MovimientoCapitalModal` · G) | ✅ | — |
| Retiro | Inversionistas (G) | ✅ | — |
| TC (deuda · 80%) · crear cuenta | Finanzas (CuentaWizard) | ✅ | sigue en Finanzas (es la cuenta) |
| TC · **atribuir a socio** | Finanzas (wizard Paso 2) **+** atajo Inversionistas | ⚠️ | **mover atribución a Inversionistas** |
| Capital fundacional (saldo inicial → socio) | Finanzas (wizard Paso 3 · F6) | ⚠️ | **mover a Inversionistas** |
| Aporte de valor (no-monetario) | `DatosSocioForm` (huérfano · reconectado hoy F4) | ⚠️ | consolidar en Inversionistas |

### 2. SOCIEDAD (la estructura societaria)
| Pieza | Dónde se crea HOY | Estado | Acción |
|---|---|---|---|
| **% participación** | `DatosSocioForm` (**huérfano** desde rework UserPanel · reconectado hoy F4) | 🚩 | consolidar acceso en Inversionistas |
| Rol (founder/co-fundador) | `DatosSocioForm` (huérfano) | 🚩 | idem |
| Tipo de participación (cash/mixta/valor) | `DatosSocioForm` (huérfano) | 🚩 | idem |
| Alta de socio | `NuevoSocioModal` → `DatosSocioFields` (cargo/subTipo · **SIN %**) | ⚠️ | unificar: el alta debe capturar participación |
| **Distribución de utilidades** | inferida de **retiros** (no usa %) | 🟡 | declarar dividendos = utilidad × % |
| **Dividendos declarados** | **no existe** | ❌ | crear el flujo |

---

## Gaps (qué rompe el principio o falta)

1. **Capital fundacional + atribución TC** → se crean desde **Finanzas** (CuentaWizard). Deben originarse en Inversionistas (sobre cuentas existentes).
2. **Gestión societaria del socio huérfana** → el `DatosSocioForm` (% · rol · tipo · valor) quedó **desconectado** cuando el viejo Ficha360Modal se reemplazó por el UserPanel (edición "diferida" nunca reimplementada). Hoy solo se reconecta vía el `EditarValorSocioModal` que se creó en F4 (sin probar aún). El dato **existe y se ve read-only en Usuarios → Ficha 360**, pero la **edición** estaba perdida.
3. **Alta de socio incompleta** → `NuevoSocioModal` no captura % ni participación · el socio nace sin su dimensión societaria.
4. **Distribución no usa el %** → la tab Distribución se basa en retiros reales + un proxy del 30% (estimado). No hay reparto formal por participación.
5. **Sin dividendos declarados** → no existe el acto societario "se reparten S/X · a cada socio según %".

---

## Clarificaciones del modelo (usuario · 2026-06-08)

1. **Cuentas de cash arrancan en 0** → no hay capital fundacional de cash. El cash se crea solo con
   **aportes** (suben el saldo desde 0). El selector de socio en el saldo inicial (F6) se revierte.
2. **TC = línea de deuda variable** · el límite es alto pero **NO es capital** · el capital comprometido
   del socio = la **deuda vigente** (`utilizado`), que sube al consumir (compras con TC) y baja al pagar.
3. **Negocio 100% apalancado es válido** · sin aporte de cash, el patrimonio arranca en ~0 y crece con
   las utilidades (margen). El "aporte" del socio es el **apalancamiento** (su TC), no cash.
4. **Doble lectura de la deuda TC** (no se contradicen): Contabilidad = **pasivo** (resta del patrimonio ·
   meta 0) · Inversionistas = parte del **capital comprometido** (lo que el socio arriesgó). Conviene
   rotular claro en la UI que la TC es **deuda a liberar**, no capital positivo.
5. **Patrimonio negativo debe VERSE** · hoy algunos ratios usan guard `patrimonio > 0 ? … : 0` y lo
   ocultan en 0 · afinar para que un patrimonio negativo se muestre real.

---

## Plan integral por fases (todo desde Inversionistas)

### Fase A · REVERTIR F6 (simplificada · clarificación 2026-06-08)
> El usuario aclaró: las cuentas de **cash arrancan en 0** → NO hay saldos fundacionales
> que atribuir. El concepto "atribuir capital existente" **NO aplica** · el mockup
> `inversionistas-atribuir-capital-existente-v1` queda **DESCARTADO**.
- **Revertir F6**: quitar del CuentaWizard el selector de socio del saldo inicial (Paso 3)
  + (cuando aplique) la opción "socio" de titularidad para TC (Paso 2). Finanzas solo crea cuentas.
- **Cash** = solo **Aporte** (sube desde 0) · ya existe (G).
- **TC** = ya modelada como **deuda variable** (`utilizado`, NO el límite · validado: Inversionistas
  suma `utilizado`; Contabilidad la trata como **pasivo** · "TC en 0 = sin deudas = patrimonio limpio").
  Ya existe · solo **afinar visualización** (incluido el patrimonio negativo que hoy un guard oculta).
- Fase A queda como tarea de **código** (revertir F6) · **sin mockup nuevo**.

### Fase B · Consolidar la SOCIEDAD del socio en Inversionistas
- Reconectar formalmente la edición de **% · rol · tipo de participación · aporte de valor** (hoy solo en el modal F4). Que sea un acceso claro desde el tab Capital/Sociedad del socio.
- **Unificar el alta**: `NuevoSocioModal` debe capturar la participación (o forzar completarla al crear), para que el socio no nazca sin %.
- Evaluar si el dato societario migra de `datosSocio` (privado, en Usuarios) a un modelo del dominio Inversionistas, o se sigue orquestando con permiso (respetando privacidad).

### Fase C · Distribución societaria FORMAL
- Flujo **"Declarar distribución de utilidades"** en Inversionistas: monto a repartir → aplica `% participación` → **dividendo por socio**.
- El **retiro** (ya existe · G) pasa a ser el **pago** del dividendo declarado.
- La tab Distribución deja de inferir (retiros + proxy 30%) y muestra lo **declarado vs pagado** por socio.

---

## Estado de lo ya hecho (task #14 · base sobre la que se construye)
- Aporte/Retiro/TC desde Inversionistas (`MovimientoCapitalModal`) · "Registrar capital" primary.
- Capital sacado de Finanzas (origen único · F5).
- Tab "Capital" del socio en el UserPanel (cash + TC + valor + fundacional read-only).
- `EditarValorSocioModal` (F4) reconectó el `DatosSocioForm` huérfano.

## Riesgo / dependencia
- Coordinar con **ADR-PF-001** (task #13): la migración CuentaCaja→ProductoFinanciero toca el mismo modelo de cuentas/TC. La Fase A debe alinearse (sobre todo `lineaCredito` para la deuda TC · D1).
