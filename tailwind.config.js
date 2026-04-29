/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
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
