/**
 * BankLogo — Imp-L1.1.1 · Refactor visual S58e
 *
 * Logo SVG inline para los bancos peruanos principales (BCP, BBVA, IBK,
 * Scotiabank, BN). Fallback a iniciales con color para bancos no listados.
 *
 * Uso:
 *   <BankLogo banco="BCP" size="md" />
 *   <BankLogo banco="ScotiaBank" bancoNombreCompleto="Scotiabank Perú" />
 *
 * Tamaños: sm (24px) · md (28px) · lg (40px)
 */

import React from 'react';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE BANCOS PERUANOS
// ═════════════════════════════════════════════════════════════════════════

interface BancoConfig {
  /** Iniciales que se muestran cuando no hay logo */
  iniciales: string;
  /** Color hex del fondo del logo */
  bgColor: string;
  /** Color del texto/iniciales */
  textColor: string;
}

/**
 * Mapping de banco → config de logo. Buscamos por substring del nombre
 * (case-insensitive) para tolerar variaciones tipográficas.
 */
const BANCOS_PE: Array<{
  match: RegExp;
  config: BancoConfig;
}> = [
  {
    match: /^(bcp|banco de cr[eé]dito)/i,
    config: { iniciales: 'BCP', bgColor: '#0046ad', textColor: '#fff' },
  },
  {
    match: /^(bbva|continental)/i,
    config: { iniciales: 'BBV', bgColor: '#1e3a8a', textColor: '#fff' },
  },
  {
    match: /^(ibk|interbank)/i,
    config: { iniciales: 'IBK', bgColor: '#00a651', textColor: '#fff' },
  },
  {
    match: /^(scotia|scotiabank)/i,
    config: { iniciales: 'SCO', bgColor: '#dc2626', textColor: '#fff' },
  },
  {
    match: /^(bn|banco de la naci[oó]n)/i,
    config: { iniciales: 'BN', bgColor: '#0c4a6e', textColor: '#fff' },
  },
  {
    match: /^(financiera oh)/i,
    config: { iniciales: 'OH', bgColor: '#7c3aed', textColor: '#fff' },
  },
  {
    match: /^(pichincha)/i,
    config: { iniciales: 'PIC', bgColor: '#fbbf24', textColor: '#1f2937' },
  },
];

/**
 * Fallback genérico para bancos no catalogados.
 * Usa el banco como string para iniciales, color slate.
 */
const FALLBACK_CONFIG: BancoConfig = {
  iniciales: '',
  bgColor: '#475569',
  textColor: '#fff',
};

function resolveBancoConfig(banco: string): BancoConfig {
  for (const { match, config } of BANCOS_PE) {
    if (match.test(banco)) return config;
  }
  // Fallback: usa hasta 3 primeras letras como iniciales
  return {
    ...FALLBACK_CONFIG,
    iniciales: banco
      .replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñ]/g, '')
      .slice(0, 3)
      .toUpperCase() || '?',
  };
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export type BankLogoSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<BankLogoSize, { box: string; text: string }> = {
  sm: { box: 'w-6 h-6 rounded',    text: 'text-[8px]' },
  md: { box: 'w-7 h-7 rounded-md', text: 'text-[9px]' },
  lg: { box: 'w-10 h-10 rounded-lg', text: 'text-xs' },
};

export interface BankLogoProps {
  /** Alias corto del banco (BCP, BBVA, IBK, etc.) o nombre completo */
  banco: string;
  size?: BankLogoSize;
  className?: string;
  /** Si se quiere forzar config custom (override) */
  iniciales?: string;
  bgColor?: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({
  banco,
  size = 'md',
  className,
  iniciales: inicialesOverride,
  bgColor: bgColorOverride,
}) => {
  const config = resolveBancoConfig(banco);
  const iniciales = inicialesOverride ?? config.iniciales;
  const bgColor = bgColorOverride ?? config.bgColor;
  const textColor = config.textColor;
  const { box, text } = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        box,
        'flex items-center justify-center flex-shrink-0',
        className,
      )}
      style={{ backgroundColor: bgColor }}
      aria-label={`Logo ${banco}`}
    >
      <span
        className={cn(text, 'font-bold tracking-tight')}
        style={{ color: textColor }}
      >
        {iniciales}
      </span>
    </div>
  );
};
