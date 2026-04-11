# Guia de Colores — Design System BusinessMN

## Regla principal
**Usar `slate` en vez de `gray` para TODOS los neutrales.**
Slate es mas calido y profesional que gray puro.

## Paleta de referencia

### Neutrales (slate)
| Uso | Clase | Ejemplo |
|-----|-------|---------|
| Texto principal | `text-slate-900` | Titulos, valores, nombres |
| Texto secundario | `text-slate-700` | Subtitulos, labels de formulario |
| Texto body | `text-slate-600` | Descripciones, texto informativo |
| Texto caption | `text-slate-500` | Timestamps, helpers, metadatos |
| Texto deshabilitado | `text-slate-400` | Placeholders, iconos inactivos |
| Fondo pagina | `bg-slate-50` | PageShell background |
| Fondo card | `bg-white` | Cards, modales, panels |
| Fondo sutil | `bg-slate-100` | Inputs focus, areas colapsadas |
| Borde default | `border-slate-200` | Cards, inputs, separadores |
| Borde sutil | `border-slate-100` | Divisores entre items, rows |
| Hover | `hover:bg-slate-50` | Filas de tabla, items clickeables |

### Brand (indigo)
| Uso | Clase |
|-----|-------|
| Acento principal | `text-indigo-600` / `bg-indigo-600` |
| Acento hover | `hover:bg-indigo-700` |
| Fondo tint | `bg-indigo-50` |
| Texto sobre tint | `text-indigo-700` |
| Focus ring | `ring-indigo-500` |
| Border accent | `border-indigo-500` |

### Semanticos
| Significado | Fondo | Texto | Borde | Dot/Icon |
|-------------|-------|-------|-------|----------|
| Success | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | `bg-emerald-500` |
| Warning | `bg-amber-50` | `text-amber-700` | `border-amber-200` | `bg-amber-500` |
| Danger | `bg-red-50` | `text-red-700` | `border-red-200` | `bg-red-500` |
| Info | `bg-sky-50` | `text-sky-700` | `border-sky-200` | `bg-sky-500` |

### NO usar
- `text-gray-*` → usar `text-slate-*`
- `bg-gray-*` → usar `bg-slate-*`
- `border-gray-*` → usar `border-slate-*`
- `text-primary-*` → usar `text-indigo-*` (primary se eliminara)
- `bg-gradient-to-*` → no usar gradientes (diseño plano)
- Colores hardcodeados en JSX → importar desde tokens.ts

### Tipografia (tokens)
| Token | Clases |
|-------|--------|
| display | `text-xl sm:text-2xl font-bold tracking-tight text-slate-900` |
| heading | `text-base sm:text-lg font-semibold text-slate-900` |
| subheading | `text-sm font-semibold text-slate-700` |
| body | `text-sm text-slate-600` |
| bodyStrong | `text-sm font-medium text-slate-900` |
| caption | `text-xs text-slate-500` |
| label | `text-xs font-medium uppercase tracking-wider text-slate-500` |
| metric | `text-2xl font-bold tabular-nums text-slate-900` |
