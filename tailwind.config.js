/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ════════════════════════════════════════════════════════════════════════
  // ESCALA CANÓNICA L0 (Design System · canon E). Fuente de objetos: src/design-system/tokens.ts
  // Tailwind YA trae estos valores como defaults · NO se sobrescriben (hacerlo
  // recolorearía/redimensionaría toda la app). Aquí solo se DOCUMENTA la escala
  // que el sistema usa, para que coincida con tokens.ts y el canon:
  //   • Radios:   rounded-lg 8px (controles) · rounded-xl 12px (cards) ·
  //               rounded-2xl 16px (shell/KPI) · rounded-full (pills).
  //               Regla: un hijo NUNCA más redondo que su padre.
  //   • Sombras:  (sin sombra) plano · shadow-sm card en reposo · shadow-lg overlay.
  //   • Tipo:     text-2xl héroe · text-lg título · text-sm subtítulo ·
  //               text-[12px] cuerpo · text-[11px] meta · text-[10px] label-upper.
  //   • Spacing:  base 4px (p-1=4px · gap-3=12px · gap-4=16px).
  //   • Breakpoints (mobile-first): sm 640 · md 768 (aparece sidebar) · lg 1024.
  // El COLOR de identidad por módulo NO vive aquí ni en tokens: vive en
  // src/design-system/grupoColor.ts (heredado por grupo del sidebar · Modelo A).
  // ════════════════════════════════════════════════════════════════════════
  theme: {
    extend: {
      colors: {
        // ============================================================
        // BRAND — Controlado desde CSS variables en src/index.css
        // Cambiar --brand-* en :root cambia TODA la app
        // ============================================================
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover) / <alpha-value>)',
          light: 'rgb(var(--brand-light) / <alpha-value>)',
          text: 'rgb(var(--brand-text) / <alpha-value>)',
        },
        surface: {
          page: 'rgb(var(--surface-page) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
        },
        // Todos los demas colores usan Tailwind nativo:
        // teal (marca), slate (neutral), emerald (success),
        // amber (warning), red (danger), sky (info)
      },
    },
  },
  plugins: [
    // S54 — Container queries: permiten que componentes respondan al
    // ancho de su CONTENEDOR PADRE, no al viewport global. Esencial
    // para cards que viven en distintas páginas/modales con sidebars
    // variables. Usar `@container` en el wrapper + `@md:`/`@lg:` en hijos.
    require('@tailwindcss/container-queries'),
  ],
}
