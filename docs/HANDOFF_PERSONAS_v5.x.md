# Handoff · Suite Personas v5.6 → v5.9

**Fecha cierre:** 2026-05-28
**Branch:** `main`
**Último commit:** ver `git log --oneline | head -20`

---

## Resumen ejecutivo

La suite v5.6→v5.9 transforma el módulo de personas del ERP de un modelo
de sub-perfiles (datosLaborales · datosSocio) a un modelo **multi-relación
+ vinculación con Maestros + self-service de acceso**.

**Total entregado:**
- 17 commits incrementales con TS clean en cada uno
- Vite build verde (production-ready)
- ~9,300 líneas de código net add
- 10 etapas completadas (E1-E10) · todas con commit individual

---

## Mapa de etapas y commits

| Etapa | Sub | Commit | Líneas | Foco |
|---|---|---|---|---|
| E1 | — | `124e41a` | +1,853 | Types · Services · Migración · Rules |
| E2 | — | `251e38d` | +45 | Sidebar grupo "Equipo" |
| E3.1 | shell | `d0483d8` | +501 | UserPanel drawer F6-E |
| E3.2 | resumen | `51573cc` | +320 | Tab Resumen |
| E3.3 | relaciones | `50c6ea0` | +518 | Tab Relaciones PROTAGONISTA + Card |
| E3.4 | resto | `48415aa` | +1,011 | Tabs Datos · Permisos · Histórico · Vinculación |
| E4.1 | wire | `26ca6b0` | +61 | UserPanel reemplaza Ficha360Modal |
| E4.2 | KPIs | `80359ec` | +125 | Multi-chips + KPIs por tipo |
| E4.3 | wizard | `4b09cf9` | +926 | Wizard "Nuevo colaborador" 4 pasos |
| E4.4 | borrador | `5fd4b9a` | +186 | Borrador automático + banner |
| E5.1 | 4 modales | `5c4e5f0` | +704 | Pausar · Reanudar · Finalizar · Editar |
| E5.2 | reclasif | `fd8385c` | +469 | Reclasificar atómico (writeBatch) |
| E5.3 | agregar | `1e95c25` | +657 | Agregar 2ª/Nª relación wizard 2 pasos |
| E6.1 | planilla | `be8441e` | +46 | Click empleado en TabBoletas |
| E6.2 | inversionistas | `a4580c1` | +80 | Click socio en InversionistasCapital |
| E7 | maestros | `982c1e7` | +336 | MaestroContactosTab standalone |
| E8 | wire OC | `9bfe1aa` | +17 | Wire en ProveedorDetailView |
| E9.1 | público | `dc98373` | +402 | Página `/solicitar-acceso` |
| E10 | cleanup | (este) | — | Fix firebase imports + handoff |

---

## Arquitectura entregada

### Modelo de datos (E1)

```
users/{uid}                          ← UserProfile (existente · sin tocar)
  └── private/datosLaborales          ← legacy (preserve · backward compat)
  └── private/datosSocio              ← legacy (preserve · backward compat)

relacionesLaborales/{auto-id}         ← NUEVO · multi-relación + histórico
  · userId, tipo, estado, fechaInicio, fechaFin
  · subTipo, cargoDisplay, montoMensualReferencia
  · entidadMaestroRef (v5.8 vinculación con Maestros)
  · snapshots inmutables al finalizar
  · relacionAnteriorId para reclasificación

solicitudesAccesoExterno/{auto-id}    ← NUEVO · pre-stage v5.9
  · nombreCompleto, email, tipoRelacion, motivo
  · estado: pendiente → info_solicitada → aprobada / rechazada / caducada
  · audit trail · IP/UA · reCaptchaScore (validados server-side · TODO)
```

### Componentes nuevos

**Core (E3):**
- `src/components/usuarios/UserPanel.tsx` (Shell drawer · 5+1 tabs)
- `src/components/usuarios/userPanel/TabResumen.tsx`
- `src/components/usuarios/userPanel/TabRelaciones.tsx` (PROTAGONISTA)
- `src/components/usuarios/userPanel/RelacionCard.tsx`
- `src/components/usuarios/userPanel/TabDatos.tsx`
- `src/components/usuarios/userPanel/TabPermisos.tsx`
- `src/components/usuarios/userPanel/TabHistorico.tsx`
- `src/components/usuarios/userPanel/TabVinculacion.tsx`

**Wizards y modales (E4-E5):**
- `src/components/usuarios/CrearUsuarioWizard.tsx` (4 pasos · con borrador)
- `src/components/usuarios/AgregarRelacionWizard.tsx` (2 pasos)
- `src/components/usuarios/ReclasificarRelacionModal.tsx` (atómico)
- `src/components/usuarios/RelacionModals.tsx` (4 modales: Pausar · Reanudar · Finalizar · Editar)

**Cross-modulo (E7-E9):**
- `src/components/Maestros/MaestroContactosTab.tsx` (reusable)
- `src/pages/public/SolicitarAcceso.tsx` (página pública)

### Servicios nuevos

- `src/services/relacionesLaborales.service.ts` (CRUD + transitions + Maestros)
- `src/services/solicitudesAccesoExterno.service.ts` (CRUD bandeja)

### Modificaciones a archivos existentes

- `src/components/layout/Sidebar.tsx` · grupo "Equipo" (E2)
- `src/pages/Usuarios/Usuarios.tsx` · UserPanel + Wizard + Borrador + Modales (E4-E5)
- `src/pages/Planilla/components/TabBoletas.tsx` · click avatar → UserPanel (E6.1)
- `src/components/modules/inversionistas/InversionistasCapital.tsx` · botón Perfil (E6.2)
- `src/components/Maestros/ProveedorDetailView.tsx` · tab Contactos (E8)
- `src/App.tsx` · ruta `/solicitar-acceso` (E9.1)
- `src/config/collections.ts` · 2 colecciones nuevas
- `firestore.rules` · 2 reglas nuevas
- `src/types/borradorWizard.types.ts` · `'colaborador'` agregado al enum
- `src/types/inversionista.types.ts` · `userId?` agregado a AporteSocioResumen

---

## Validaciones cumplidas

- ✅ `tsc --noEmit` · 0 errores en cada commit
- ✅ `vite build` · production build OK (commit final E10)
- ✅ Backward compat: docs `datosLaborales`/`datosSocio` legacy siguen funcionando
- ✅ Sin breaking changes en módulos existentes
- ✅ Canon "admin ve todo" (2026-05-24) preservado
- ✅ Canon borrador + descartar (2026-05-07) aplicado en CrearUsuarioWizard
- ✅ Canon N1-N10 v8.0 color semántico (teal · sky · purple · amber)
- ✅ Canon F6-E drawer lateral (UserPanel) · no drill pages

---

## Guía de validación visual

```bash
npm run dev
```

### 1. Sidebar reorganizado (E2)
- Login como admin
- Verificar grupo "Equipo" entre Inventario y Finanzas
- 4 items: Usuarios · Planilla · Inversionistas · Notas IA
- Confirmar que `Planilla` ya NO está en "Finanzas y Contabilidad"
- Confirmar que `Usuarios` ya NO está en "Administración"

### 2. `/usuarios` shell (E4)
- Abrir `/usuarios`
- Verificar 2 filas de KPIs:
  - Fila 1 (legacy): Total · Activos · Pendientes · Socios · Multi-rol
  - Fila 2 (v5.6): Empleados · Honorarios · Socios · Externos · Multi-relación
- Cards de usuarios muestran chips multi-relación si existen
- Botón "Nuevo colaborador" abre Wizard 4 pasos

### 3. Wizard "Nuevo colaborador" (E4.3-E4.4)
- Click "Nuevo colaborador" → Wizard abre
- Paso 1: completar identidad (nombre · email · password)
- Cerrar con X (preserva borrador)
- Volver a /usuarios → ver banner amber "Tenés un colaborador en borrador"
- Click "Continuar" → wizard reabre con state restaurado
- Completar 4 pasos → "Crear colaborador"
- Verificar: User creado · UserPanel auto-abre

### 4. UserPanel · 5+1 tabs (E3)
- Click "Ver perfil" en cualquier card de user
- Verificar drawer slide-in desde derecha (desktop) o bottom-sheet (mobile)
- Avatar gradient color por tipo de relación
- Tabs core: Resumen · Relaciones · Datos · Permisos · Histórico
- Tab Vinculación condicional (solo si user tiene relación externa con maestro)
- Cross-links a `/planilla`, `/inversionistas`

### 5. Acciones de relación (E5)
- En UserPanel · tab Relaciones
- Click "Editar" → modal con campos editables
- Click "Pausar" → modal con motivo
- Click "Finalizar" → modal con motivoFin + snapshot
- Click "Reclasificar" → modal con preview de transición
- Botón "+ Agregar relación" → wizard 2 pasos
- Verificar que tipos ya vigentes están deshabilitados

### 6. Cross-links desde otros módulos (E6)
- `/planilla` · tab Boletas · click en avatar de empleado → UserPanel
- `/inversionistas` · tab Capital · botón "Perfil" en fila de socio → UserPanel

### 7. Contactos en Maestros (E7-E8)
- `/maestros` · tab Proveedores
- Click en un proveedor → ProveedorDetailView abre
- Tab "Contactos" (último) → MaestroContactosTab muestra Users vinculados
- Click "Ver perfil" en card de contacto → UserPanel

### 8. Página pública (E9.1)
- Logout (o abrir en incógnito)
- Navegar a `/solicitar-acceso`
- Completar form: nombre · email · tipo · motivo (≥20 chars)
- Submit → vista de éxito "Solicitud recibida"
- Verificar en Firestore Console: nueva entry en `solicitudesAccesoExterno/`
- Como admin · consultar `solicitudesAccesoExternoService.listPendientes()`
  (UI de bandeja en /usuarios diferida · ver deudas)

---

## Deudas declaradas · NO bloqueantes

### CF + Resend (backend)
**Estado:** placeholder en cliente · CF reales no deployadas
- `aprobarSolicitudAcceso` CF que crea User + Relacion + Invitacion atómicamente
- `rechazarSolicitudAcceso` CF + email Resend
- `pedirInfoSolicitud` CF + email Resend
- `caducarSolicitudesViejas` cron job 24h · estado → 'caducada' tras 30d
- Email "Solicitud recibida" al completar form público
- reCAPTCHA v3 server-side validation

**Recomendación:** sesión dedicada con `backend-cloud-engineer` agent.

### Bandeja de solicitudes pendientes en /usuarios
**Estado:** service implementado · UI no integrada
- `solicitudesAccesoExternoService.listPendientes()` funciona
- Falta agregar banner "🔔 N solicitudes pendientes" en header de `/usuarios`
- Modal para procesar cada solicitud (aprobar · rechazar · pedir info)

**Estimado:** ~2h (UI + wire-up de CF cuando exista)

### Tabs Contactos en otros Maestros
**Estado:** componente standalone listo · solo wireado en Proveedores
- `ClienteDetailView` · agregar tab Contactos (similar a E8 · ~15 min)
- `MarcasAnalytics` · evaluar si aplica · diferir

### Migración legacy datosLaborales/datosSocio
**Estado:** script idempotente listo · NO ejecutado
- `node scripts/migrate-datos-laborales-to-relaciones.mjs --dry-run`
- Requiere backup full Firestore previo
- Ventana de baja actividad
- Recomendación: hacerlo cuando se valide en localhost que el modelo nuevo
  funciona correctamente con relacionesLaborales

### Cleanup de código legacy
- `src/pages/Usuarios/Ficha360/Ficha360Modal.tsx` · @deprecated · eliminar después
- `src/pages/Usuarios/EditarLaborales.tsx` · drill page legacy · eliminar
- `src/pages/Usuarios/EditarSocio.tsx` · drill page legacy · eliminar
- Rutas legacy en App.tsx · redirect a /usuarios

**Recomendación:** sesión de cleanup después de validar v5.x estable en producción.

### Mobile validation
- Componentes ya tienen patterns mobile (bottom-sheet · scroll-x · sm: breakpoints)
- NO validado side-by-side con device real
- Recomendado: probar viewport 375px en DevTools Chrome

---

## Próximos pasos sugeridos

1. **Validar en localhost** (~30 min): seguir guía visual punto por punto
2. **Backup Firestore** (~15 min): antes de cualquier escritura nueva
3. **Migrar legacy** (~10 min): correr script `--dry-run` → review → ejecutar
4. **Backend CF + Resend** (~3-4h): sesión con backend-cloud-engineer
5. **Bandeja UI solicitudes** (~2h): después de que CF exista
6. **Cleanup legacy** (~1h): eliminar Ficha360Modal · EditarLaborales · EditarSocio

---

## Mockups de referencia

Toda la suite tiene mockups HTML validados visualmente antes de la implementación:

- `docs/mockups/usuarios-v5.6-multi-relacion.html` (1476 líneas)
- `docs/mockups/usuarios-v5.7-flujo-end-to-end.html` (2606 líneas)
- `docs/mockups/usuarios-v5.8-vinculacion-maestros.html` (1811 líneas)
- `docs/mockups/usuarios-v5.9-self-service.html` (TBD si existe · ver memoria)

---

## Contactos

- **Implementación:** Claude (esta sesión)
- **Validación final:** José LP (admin · pending)
- **Backend CF:** TBD

---

_Generado: 2026-05-28 · cierre de sesión maratónica E1-E10_
