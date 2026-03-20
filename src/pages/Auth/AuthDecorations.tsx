import React from 'react';

// SVG Logo inline (gotero + hoja en círculo)
export const VitaSkinLogo: React.FC<{ className?: string }> = ({ className = 'h-16 w-16' }) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Círculo exterior */}
    <circle cx="60" cy="60" r="56" stroke="url(#logoGrad1)" strokeWidth="4" fill="white" />
    {/* Fondo orgánico */}
    <circle cx="68" cy="62" r="30" fill="#f9e4d4" opacity="0.6" />
    {/* Hoja grande */}
    <path d="M30 70C30 70 35 35 55 28C55 28 42 55 30 70Z" fill="url(#logoGrad2)" />
    <path d="M36 62C36 62 42 42 55 28" stroke="#14693d" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {/* Gotero */}
    <rect x="62" y="20" width="10" height="28" rx="2" fill="#3b8c6e" opacity="0.85" />
    <rect x="59" y="16" width="16" height="8" rx="3" fill="#4aa07e" />
    <path d="M64 48 L67 58 L70 48Z" fill="#1a9d5a" />
    {/* Gota */}
    <ellipse cx="67" cy="65" rx="5" ry="7" fill="url(#logoGrad3)" />
    <ellipse cx="65.5" cy="63" rx="1.5" ry="2" fill="white" opacity="0.5" />
    {/* Gradientes */}
    <defs>
      <linearGradient id="logoGrad1" x1="0" y1="0" x2="120" y2="120">
        <stop offset="0%" stopColor="#1a9d5a" />
        <stop offset="100%" stopColor="#14693d" />
      </linearGradient>
      <linearGradient id="logoGrad2" x1="30" y1="70" x2="55" y2="28">
        <stop offset="0%" stopColor="#1a9d5a" />
        <stop offset="100%" stopColor="#34d47a" />
      </linearGradient>
      <linearGradient id="logoGrad3" x1="67" y1="58" x2="67" y2="72">
        <stop offset="0%" stopColor="#6ee7a0" />
        <stop offset="100%" stopColor="#1a9d5a" />
      </linearGradient>
    </defs>
  </svg>
);

// Decoraciones temáticas (hojas flotantes)
export const LeafDecoration: React.FC = () => (
  <>
    {/* Hoja superior izquierda */}
    <svg className="absolute top-10 left-10 h-20 w-20 text-primary-300/30 animate-pulse" viewBox="0 0 80 80" fill="currentColor">
      <path d="M40 5C40 5 15 25 10 50C10 50 25 40 40 45C55 40 70 50 70 50C65 25 40 5 40 5Z" />
    </svg>
    {/* Hoja inferior derecha */}
    <svg className="absolute bottom-10 right-10 h-24 w-24 text-primary-200/25 rotate-45" viewBox="0 0 80 80" fill="currentColor">
      <path d="M40 5C40 5 15 25 10 50C10 50 25 40 40 45C55 40 70 50 70 50C65 25 40 5 40 5Z" />
    </svg>
    {/* Gotitas decorativas */}
    <svg className="absolute top-1/4 right-20 h-8 w-8 text-primary-400/20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 4 12 4 16C4 20.4183 7.58172 24 12 24C16.4183 24 20 20.4183 20 16C20 12 12 2 12 2Z" />
    </svg>
    <svg className="absolute bottom-1/3 left-16 h-6 w-6 text-primary-300/15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 4 12 4 16C4 20.4183 7.58172 24 12 24C16.4183 24 20 20.4183 20 16C20 12 12 2 12 2Z" />
    </svg>
    {/* Círculos orgánicos sutiles */}
    <div className="absolute top-20 right-1/3 h-32 w-32 rounded-full bg-primary-200/10 blur-2xl" />
    <div className="absolute bottom-20 left-1/4 h-40 w-40 rounded-full bg-emerald-200/10 blur-3xl" />
  </>
);

// Wrapper de página de auth con fondo gradiente y decoraciones
export const AuthPageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4 relative overflow-hidden">
    <LeafDecoration />
    {children}
  </div>
);

// Separador con gota decorativa
export const DropletDivider: React.FC = () => (
  <div className="flex items-center justify-center gap-1.5 mt-2">
    <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary-300" />
    <svg className="h-3 w-3 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 4 12 4 16C4 20.4183 7.58172 24 12 24C16.4183 24 20 20.4183 20 16C20 12 12 2 12 2Z" />
    </svg>
    <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary-300" />
  </div>
);
