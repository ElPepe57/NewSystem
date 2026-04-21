# Wizard de Envios Unificado — Documento de Diseño
**Sesion S52 · Fecha 2026-04-21 · frontend-design-specialist**

---

## 1. Diagnostico: los 6 wizards actuales

### Tabla comparativa

| Wizard | Caso | Ruta logistica | Pasos | Paso 1 | Paso 2 | Paso 3 | Paso 4 | Paso 5 |
|--------|------|---------------|-------|--------|--------|--------|--------|--------|
| WizardT2 | C | Casilla intl → Almacen Peru | 5 | Origen (casilla) | Picking (unidades de OCs) | Transporte (viajero/courier) | Costos landed (opc.) | Confirmar |
| WizardJ | J | Casilla ↔ Casilla | 5 | Origen + Picking combinado | Destino (casilla) | Transporte | Costos (opc.) | Confirmar |
| WizardE | E | Almacen Peru ↔ Almacen Peru | 4 | Origen + Picking combinado | Destino + Motivo | Detalles (opc.) | Confirmar |
| WizardF | F | Almacen Peru → Cliente | 4 | Venta (buscar venta existente) | Almacen + Picking | Detalles (opc.) | Confirmar |
| WizardI | I | Almacen propio → Almacen tercero | 4 | Origen + Picking | Tercero + Referencia | Detalles (opc.) | Confirmar |
| WizardG | G | Cliente → Almacen Peru (devolucion) | 3 | Devolucion (buscar devolucion) | Destino + Detalles | Confirmar |

### Patrones comunes detectados

Los 6 wizards comparten:
- Contenedor `WizardShell` identico (mismo shell, mismo stepper, mismo footer)
- Panel lateral de preview identico (todos reutilizan `EnvioT2WizardPreview`)
- Autoguardado 2 capas (`useWizardAutosave`) en todos
- Logica de validacion por paso (`canProceed` switch/case)
- Banner de borrador (`DraftBanner`) en todos
- Banner de error con boton de cierre en todos
- Callbacks `onCreated` / `onCancel` / `variant` en todos
- Estructura `handleConfirm` con `setCreating`/`setError`

### Problemas del modelo actual

**Deuda de escalabilidad:**
- 6 archivos de Page separados con ~200 lineas cada uno. 1,200 lineas totales de codigo casi identico.
- Si se agrega un caso H o se cambia el patron del preview, hay que tocar 6 archivos.
- El autoguardado usa el mismo tipo `'envio'` para todos, sin diferenciar por tipo de wizard. Al restaurar un borrador, el codigo actual no puede distinguir si era un T2 o un J guardado.

**Deuda de UX:**
- El usuario llega a /envios y hace clic en "Nuevo envio". Se abre un dropdown (`NuevoEnvioMenu`) con 6+ opciones. El usuario no-tecnico no sabe la diferencia entre "Caso C", "Caso J" ni "Caso I".
- Si elige el wizard equivocado, debe cancelar y empezar de nuevo. No hay forma de cambiar el tipo dentro del wizard.
- Cada wizard tiene un titulo diferente en el header del shell. El stepper tiene etiquetas distintas. La experiencia se siente fragmentada aunque el contenedor sea el mismo.

---

## 2. Propuesta de flujo unificado

### Principio rector

El modelo de OC (OCWizardV3) es el patron correcto: **un solo wizard que se adapta segun la decision del usuario en el primer paso**. El Paso 1 de la OC elige entre DDP / Via casilla / Recojo directo, y los pasos siguientes cambian en consecuencia.

Para los envios, el Paso 1 elige el **tipo de movimiento logistico** (el "caso") y los pasos siguientes se adaptan.

### Cuestion central: pasos fijos o variables?

Se evaluaron tres enfoques:

**Opcion A — Pasos fijos N=5 para todos los tipos**
- Ventaja: el stepper es visualmente identico entre tipos. El usuario sabe siempre en que parte del proceso esta.
- Desventaja: los casos G (3 pasos naturales) y E (4 pasos) tendrian pasos artificialmente vacios o combinados.
- Conclusion: viable si se nombran los pasos de forma suficientemente generica.

**Opcion B — Pasos variables, pero stepper con etiquetas dinamicas**
- Ventaja: cada tipo tiene exactamente los pasos que necesita, sin relleno.
- Desventaja: el stepper cambia segun el tipo elegido en el Paso 0. El usuario que vio "5 pasos" al elegir T2 y "3 pasos" al elegir G puede sentir que los casos mas simples son "incompletos".
- Conclusion: la variacion es demasiado visible y puede generar confusion.

**Opcion C (RECOMENDADA) — 4 pasos fijos con contenido adaptativo**

Se puede llegar a 4 pasos para TODOS los tipos con nomenclatura generica:

| Paso | Etiqueta generica | Contenido segun tipo |
|------|-------------------|---------------------|
| 0 | Tipo | Eleccion del tipo de envio (nuevo, ver mas abajo) |
| 1 | Origen | Casilla origen / Almacen origen / Venta a despachar / Devolucion a retornar |
| 2 | Destino | Casilla destino / Almacen destino / Motivo traslado / Tercero |
| 3 | Logistica | Transporte + Picking + Costos (segun tipo) |
| 4 | Confirmar | Resumen final para todos los tipos |

Nota sobre el Paso 0: el "Paso 0 — Tipo" es tecnicamente el Paso 1 visible para el usuario. Se numerara 1/5 en el stepper. Internamente es index 0.

### Por que N=5 con el Paso 0 incluido

Incluir la eleccion de tipo como primer paso del wizard es la clave de la unificacion:
- Reemplaza el dropdown `NuevoEnvioMenu` por una pantalla de seleccion rica (con descripcion, icono de ruta, casos de uso).
- El usuario puede leer y entender que hace cada tipo antes de comprometerse.
- Si el usuario elige el tipo equivocado, puede retroceder al Paso 1 sin salir del wizard.
- El panel lateral de preview se actualiza instantaneamente al elegir el tipo.

### Mapa completo de adaptacion por tipo

```
PASO 1 — Elegir tipo (TODOS)
  ↓ el usuario elige uno de los 9 tipos A-J

PASO 2 — Origen (contenido adaptado)
  - Tipos A, B    → [Generados automaticamente por OC, no necesitan wizard]
  - Tipo C        → Selector de casilla internacional (con OCs disponibles)
  - Tipo D        → No tiene wizard propio (nace al confirmar OC con "Recojo en origen")
  - Tipo E        → Selector de almacen Perú origen + picking de unidades
  - Tipo F        → Buscador de ventas pendientes de despacho
  - Tipo G        → Buscador de devoluciones aprobadas
  - Tipo I        → Selector de almacen propio + picking de unidades
  - Tipo J        → Selector de casilla origen + picking de unidades

PASO 3 — Destino (contenido adaptado)
  - Tipo C        → [Destino fijo: almacen Perú] → se salta o muestra readonly
                    contenido real: picking de unidades de la casilla
  - Tipo E        → Selector almacen Peru destino + motivo de traslado
  - Tipo F        → [Destino fijo: cliente de la venta] → muestra info del cliente
                    contenido real: picking del almacen
  - Tipo G        → Selector de almacen Peru receptor
  - Tipo I        → Selector de almacen tercero + referencia
  - Tipo J        → Selector de casilla destino

PASO 4 — Logistica (contenido adaptado)
  - Tipo C        → Transporte (viajero/courier) + Costos landed USD
  - Tipo E        → Colaborador transporte (opcional) + Costos PEN (opcional)
  - Tipo F        → Colaborador delivery (opcional) + Costos PEN (opcional)
  - Tipo G        → Colaborador recojo (opcional) + Costos PEN (opcional)
  - Tipo I        → Colaborador transporte (opcional) + Costos USD/PEN mixto
  - Tipo J        → Transporte (viajero/courier) + Costos landed USD

PASO 5 — Confirmar (TODOS, mismo layout)
  - Resumen de ruta: Origen → Destino con banderas
  - Resumen de unidades: N unidades, X productos
  - Resumen financiero: costos si los hay
  - Notas opcionales
  - Boton final: etiqueta dinamica segun tipo
```

### Que hacer con los tipos A, B, D

Estos tres tipos no necesitan wizard porque nacen automaticamente:
- **Tipo A** (Proveedor → Casilla): se crea al confirmar la OC. No tiene wizard.
- **Tipo B** (DDP directo): se crea al confirmar la OC con modo DDP. No tiene wizard.
- **Tipo D** (Recojo en origen): se crea al confirmar la OC con "Recojo en origen". No tiene wizard.

En el Paso 1 del wizard unificado, estos tres tipos aparecen como opciones informativas pero NO son seleccionables. Se muestran con un badge "Se crea automaticamente desde OC" y un link "Ver mis envios tipo A →". Esto educa al usuario sin bloquearlo.

Esto reduce los tipos seleccionables a 6: C, E, F, G, I, J.

---

## 3. Descripcion detallada de cada paso

### Paso 1 — Elegir tipo de envio

**Objetivo:** el usuario entiende que tipo de movimiento logistico va a registrar y elige el correcto.

**Layout:** grid de 3x3 tarjetas (9 tipos totales). Cada tarjeta tiene:
- Icono de ruta (ej. 📦→🇵🇪)
- Letra del caso (ej. "Caso C")
- Nombre descriptivo (ej. "Casilla internacional → Almacen Peru")
- Subtitulo con caso de uso tipico (ej. "Cuando un viajero o courier trae tu mercaderia")
- Badge "Automatico" para tipos A/B/D (no seleccionables)
- Color de fondo diferenciado por grupo:
  - Importacion (C, J): fondo teal-50
  - Operaciones Peru (E, F): fondo slate-50
  - Especiales (G, I): fondo violet-50
  - Automaticos (A, B, D): fondo slate-50 con opacity baja + icono de candado

Al seleccionar un tipo, la tarjeta se activa (border-teal-600, fondo teal-50 mas intenso). El panel lateral muestra instantaneamente la ruta logistica elegida.

El boton "Siguiente" se habilita al seleccionar cualquier tipo no-automatico.

**Decision de diseno:** el Paso 1 NO tiene "Siguiente" automatico al seleccionar. El usuario debe hacer clic en "Siguiente →" explicitamente. Esto evita que selecciones accidentales salten al paso 2 sin que el usuario pueda leer la tarjeta completa.

### Paso 2 — Origen

**Contenido por tipo:**

Tipo C (Casilla → Peru): selector de casilla internacional con tarjetas enriquecidas (pais, nombre colaborador, unidades disponibles, OCs vinculadas). Debajo, contador de OCs en la casilla seleccionada. NO incluye picking aqui (eso va en Paso 3).

Tipo E (Traslado interno): selector de almacen Peru origen con tarjetas. Debajo, lista de picking con stepper por producto (igual que T2).

Tipo F (Despacho venta): buscador de ventas. Input de busqueda con dropdown de resultados. Al seleccionar, muestra la card de la venta: cliente, distrito, productos, monto. No hay picking aqui (el picking del almacen va en Paso 3).

Tipo G (Devolucion): buscador de devoluciones aprobadas. Al seleccionar, muestra los productos de la devolucion y el usuario marca cuales unidades retorna fisicamente.

Tipo I (A tercero): selector de almacen propio + picking. Igual que Tipo E.

Tipo J (Casilla a Casilla): selector de casilla origen + picking de unidades. Igual que Tipo C pero con picking incluido aqui (como el actual WizardJ paso 0).

**Nota:** El picking en algunos tipos ocurre en Paso 2 y en otros en Paso 3. Esto es inevitable dado que algunos tipos (F) necesitan elegir primero la entidad de referencia (venta) antes de saber de que almacen hacer picking. El header del paso cambia su subtitulo para que quede claro que se espera.

### Paso 3 — Destino

**Contenido por tipo:**

Tipo C: picking de unidades de la casilla seleccionada (aqui se consolidan las N OCs). Banner de priorizacion para unidades pre-vendidas.

Tipo E: selector de almacen Peru destino + campo de motivo del traslado (dropdown: rebalanceo de stock / preparacion temporada / otro).

Tipo F: muestra la informacion del cliente de la venta (readonly: nombre, distrito, telefono). Debajo, selector de almacen origen + picking de unidades.

Tipo G: selector del almacen Peru que recibira el retorno. Opcional: notas sobre el estado esperado de las unidades.

Tipo I: selector de almacen tercero + campo de referencia del tercero (numero de guia, contrato, etc.).

Tipo J: selector de casilla destino. Badge de advertencia si es cambio de pais.

### Paso 4 — Logistica

Este paso siempre tiene la misma estructura de tres secciones colapsables:

**Seccion A — Transporte** (aplica a todos):
- Selector de tipo de transporte: Viajero / Courier externo / Transportista local / Sin especificar
- Selector de colaborador del tipo elegido
- Campo de numero de tracking (opcional)

La visibilidad y obligatoriedad varia por tipo:
- Tipo C: transporte obligatorio (viajero o courier)
- Tipos E, F, G, I, J: transporte opcional (puede no haber courier formal)

**Seccion B — Costos** (aplica segun tipo):
- Tipos C, J: costos en USD con tipo de cambio (flete internacional + adicionales)
- Tipos E, F, G: costos en PEN (delivery local + adicionales)
- Tipo I: costos mixtos USD/PEN
- Los costos siempre son opcionales en todos los tipos

**Seccion C — Informacion adicional** (aplica a todos):
- Fecha estimada de llegada (opcional)
- Notas del envio (textarea, opcional)

### Paso 5 — Confirmar

Mismo layout para todos los tipos:
- Bloque de ruta: Origen → (transporte) → Destino con banderas y nombres
- Bloque de carga: N unidades, X productos, lista expandible
- Bloque financiero: costos si los hay (con subtotales)
- Bloque de metadata: notas, tracking, fechas
- Boton de confirmacion con etiqueta especifica: "Crear envio", "Crear traslado", "Crear despacho", "Crear retorno"

---

## 4. El panel lateral de preview (persistente)

El panel lateral usa el mismo componente `EnvioT2WizardPreview` actual pero con props dinamicas segun el tipo y el paso actual.

Siempre muestra:
- Ruta logistica: Origen → Destino (con banderas, en tiempo real desde Paso 2)
- Tipo de envio elegido (badge con icono y letra del caso)
- Contador de unidades seleccionadas
- Total de costos en tiempo real
- Indicador de autoguardado

Cambia segun el tipo:
- Tipo C/J: muestra "N OCs consolidadas"
- Tipo F: muestra "Venta #VEN-XXX · Cliente: nombre"
- Tipo G: muestra "Devolucion #DEV-XXX"
- Tipo I: muestra "Ref. tercero: XXXXX"

---

## 5. Que hacer con el NuevoEnvioMenu actual

El dropdown `NuevoEnvioMenu` se convierte en un **boton unico** "Nuevo envio" que abre el wizard unificado directamente en el Paso 1 (eleccion de tipo).

Los links directos a `/envios/nuevo-t2`, `/envios/nuevo-j`, etc. siguen funcionando como shortcuts que abren el wizard con el tipo pre-seleccionado (el Paso 1 aparece con el tipo ya marcado, el usuario puede confirmar o cambiar).

Esta es la misma logica que el wizard de OC: siempre se abre en Paso 1, pero si viene de un requerimiento ya tiene el proveedor pre-cargado.

---

## 6. Anti-patrones que este diseno evita

**AP-1: Eleccion sin contexto**
El dropdown actual muestra "Caso C - Casilla a Peru" sin explicar cuando usarlo. El nuevo Paso 1 muestra tarjetas con descripcion y caso de uso tipico.

**AP-2: No poder corregir el tipo elegido**
Con 6 wizards separados, elegir el tipo equivocado implica cancelar y volver a empezar. Con el wizard unificado, el usuario vuelve al Paso 1 y cambia el tipo. El estado de origen/destino ya cargado se resetea para el nuevo tipo.

**AP-3: Experiencias visuales fragmentadas**
Cada wizard tiene un titulo diferente, labels diferentes en el stepper, y etiquetas distintas en el boton de confirmacion. El wizard unificado tiene siempre "Nuevo envio" como titulo, el stepper siempre muestra "Tipo / Origen / Destino / Logistica / Confirmar", y solo el boton final cambia de etiqueta.

**AP-4: 6 buckets de autoguardado compitiendo**
Actualmente todos los wizards usan tipo `'envio'` en el autoguardado. Si el usuario tiene un T2 a medias y empieza un J, el borrador del T2 puede pisarse. El wizard unificado usa un unico state que incluye el tipo como campo, y el autoguardado usa tipo `'envio-unificado'` sin ambiguedad.

**AP-5: Codigo duplicado**
~1,200 lineas de logica identica (autoguardado, banner de error, validacion por paso, handleConfirm) distribuidas en 6 archivos. El wizard unificado concentra toda esa logica en un solo archivo de contenedor.

---

## 7. Decisiones que el usuario debe tomar antes de codear

Las siguientes decisiones de producto NO estan cerradas en este documento de diseno. Deben aprobarse antes de iniciar la implementacion.

### D-U1: Paso 1 obligatorio o skippable

**Pregunta:** cuando el usuario llega al wizard desde un link directo como `/envios/nuevo-t2`, el Paso 1 aparece con "Caso C" pre-seleccionado. El usuario puede ver el Paso 1 y confirmar, o puede saltearlo automaticamente e ir directo al Paso 2.

**Opciones:**
- A: siempre mostrar Paso 1, incluso si el tipo viene pre-seleccionado (consistencia, el usuario confirma antes de avanzar)
- B: si el tipo viene por URL param, saltar directamente al Paso 2 (mas rapido para usuarios que saben lo que quieren)

**Recomendacion:** Opcion A. La primera vez que el usuario use el wizard unificado necesita ver el Paso 1 para aprender la nueva estructura.

### D-U2: Picking en Paso 2 o Paso 3 segun tipo

**Pregunta:** en los tipos donde picking y origen van juntos (E, I, J), el picking ocurre en el Paso 2. En los tipos donde primero hay que elegir una entidad de referencia (F: venta, G: devolucion) el picking ocurre en el Paso 3. Esto significa que el "Paso 3 — Destino" tiene contenido diferente segun el tipo.

**Opciones:**
- A: mantener esta asimetria pero con subtitulos del paso que lo aclaren ("Destino" en algunos tipos, "Picking" en otros)
- B: agregar un sexto paso "Picking" siempre, aunque en algunos tipos sea muy rapido

**Recomendacion:** Opcion A. Agregar un paso solo para mantener simetria en los tipos donde no hay picking separado seria confuso. El label del paso puede cambiar segun el tipo.

### D-U3: Estado del stepper al regresar al Paso 1

**Pregunta:** si el usuario esta en el Paso 3 y regresa al Paso 1 y cambia el tipo de envio, el estado de Paso 2 y Paso 3 se invalida (eligio una casilla de T2 que no sirve para un tipo E).

**Opciones:**
- A: resetear todo el state al cambiar el tipo (limpio pero el usuario pierde lo que cargo)
- B: intentar mapear el estado anterior al nuevo tipo donde sea posible (complejo, propenso a bugs)
- C: mostrar un dialogo de confirmacion "Si cambias el tipo, se borrara lo que cargaste. Continuar?" antes de resetear

**Recomendacion:** Opcion C. El reset silencioso (Opcion A) puede frustrar al usuario. El aviso previo da control.

### D-U4: Paso "Logistica" para tipos con transporte no requerido

**Pregunta:** para los tipos E, F, G, I el transporte es completamente opcional. Un traslado interno puede hacerse sin registrar ningun colaborador. Si no hay nada obligatorio en el Paso 4, el wizard deberia permitir saltearlo?

**Opciones:**
- A: el Paso 4 existe siempre pero el boton "Siguiente" esta habilitado desde el inicio (todo opcional)
- B: marcar el Paso 4 como "opcional" en el stepper con una etiqueta visual (como ya hace WizardT2 con "Costos")
- C: en los tipos donde todo es opcional, fusionar Paso 4 con Paso 5

**Recomendacion:** Opcion B. Ya existe el patron de paso opcional en los wizards actuales.

### D-U5: Visibilidad de tipos A, B, D en el Paso 1

**Pregunta:** mostrar los tipos automaticos (A, B, D) en el selector puede educar o confundir.

**Opciones:**
- A: mostrarlos con estado "deshabilitado" + tooltip que explica "Este tipo se crea automaticamente desde la OC"
- B: no mostrarlos en el selector, solo mostrar los 6 tipos seleccionables
- C: mostrarlos en una seccion colapsada "Tipos automaticos (no requieren wizard)"

**Recomendacion:** Opcion C. El usuario no-tecnico puede confundirse si ve tipos deshabilitados sin entender por que. Una seccion colapsada "Como nacen los envios A, B, D" educa sin bloquear el flujo principal.

### D-U6: Ruta de acceso desde NuevoEnvioMenu

**Pregunta:** la ruta `/envios/nuevo` activa el wizard unificado. Pero los 6 wizards actuales tienen sus propias rutas (`/envios/nuevo-t2`, etc.) con feature flags propios.

**Opciones:**
- A: el wizard unificado reemplaza todos los wizards individuales en una sola sesion (migracion total)
- B: el wizard unificado convive con los wizards individuales durante un periodo de transicion (feature flag `WIZARD_UNIFICADO=false`)
- C: el wizard unificado solo agrega el Paso 1 como wrapper; los pasos 2-5 siguen siendo los componentes individuales actuales (migracion gradual, 0 riesgo de regresion)

**Recomendacion:** Opcion C para la primera sesion de implementacion, Opcion A como objetivo final. La Opcion C permite validar el Paso 1 con datos reales antes de tocar los pasos que ya funcionan.

---

## 8. Metricas de exito del diseno

El diseno es exitoso si:
1. Un usuario nuevo puede crear su primer envio sin preguntar que diferencia hay entre los tipos (el Paso 1 es autoexplicativo).
2. El numero de wizards creados y cancelados en Paso 1 es menor al 10% (los usuarios eligen bien el tipo la primera vez).
3. El tiempo promedio para crear un envio tipo C no aumenta mas de 20 segundos vs. el wizard T2 actual (el Paso 0 adicional no deberia agregar friccion significativa).
4. El codebase de wizards de envios pasa de ~1,200 lineas distribuidas en 6 archivos a ~1 archivo de contenedor de ~300 lineas + componentes de paso reutilizados.

---

## 9. Estructura de archivos propuesta

```
src/pages/Envios/EnvioWizard/          (carpeta nueva, reemplaza las 6 actuales)
  WizardUnificadoPage.tsx              (contenedor principal, ~300 lineas)
  envioWizardUnificadoTypes.ts         (state unificado + reducer + selectors)
  EnvioWizardUnificadoPreview.tsx      (panel lateral, extiende EnvioT2WizardPreview)
  
  steps/
    Step1Tipo.tsx                      (selector de tipo — nuevo)
    Step2Origen.tsx                    (Origen + Picking segun tipo)
    Step3Destino.tsx                   (Destino segun tipo)
    Step4Logistica.tsx                 (Transporte + Costos segun tipo)
    Step5Confirmar.tsx                 (Confirmar segun tipo)
  
  subcomponents/                       (atomos reutilizados por los pasos)
    TipoEnvioCard.tsx                  (tarjeta del selector de tipo)
    CasillaSelector.tsx                (selector de casilla — reutilizado en Paso 2 y 3)
    AlmacenSelector.tsx                (selector de almacen Peru)
    PickingPanel.tsx                   (picking de unidades — reutilizado en Paso 2 y 3)
    TransporteSelector.tsx             (seleccion de transporte — Paso 4)
    CostosPanel.tsx                    (costos USD/PEN — Paso 4)
```

Los 6 wizards individuales (EnvioWizardT2/, EnvioWizardJ/, etc.) se mantienen mientras conviven con el unificado bajo feature flag. Se eliminan cuando el wizard unificado este validado en produccion.

---

*Documento creado por frontend-design-specialist · S52 · 2026-04-21*
*Entregable companion: `docs/mockups/wizard-envio-unificado-s52.html`*
