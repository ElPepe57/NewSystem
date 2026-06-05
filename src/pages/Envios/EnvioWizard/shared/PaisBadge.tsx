/**
 * PaisBadge — Representación canónica del país en el Wizard de Envíos.
 *
 * Reemplaza las banderas emoji (🇵🇪🇺🇸🇨🇳) que en Windows se renderizan como las
 * 2 letras sueltas ("PE", "US") — feo e inconsistente. En su lugar usa el código
 * ISO de 2 letras en un badge con el color de SECCIÓN (orange · grupo inventario).
 *
 * Fuente ÚNICA (DRY): antes había 4 copias de paisBandera/paisEmoji en
 * RutaVerticalSidebar, SeccionOrigen, SeccionDestino y Paso4Confirmar.
 */
import React from 'react';
import { Globe } from 'lucide-react';

const CODIGO_PAIS: Record<string, string> = {
  USA: 'US',
  Peru: 'PE',
  'Perú': 'PE',
  China: 'CN',
  Corea: 'KR',
  'Japón': 'JP',
  Japon: 'JP',
};

/** Código ISO de 2 letras del país (PE/US/CN/KR/JP). '' si no se reconoce. */
export function codigoPais(pais?: string | null): string {
  return (pais && CODIGO_PAIS[pais]) || '';
}

interface PaisBadgeProps {
  pais?: string | null;
  /** sm = inline junto a texto · md = dentro de un avatar/cuadro. Default 'md'. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Badge del país en código (orange). Si el país es desconocido/internacional,
 * muestra un ícono Globe (orange) en vez del código.
 */
export const PaisBadge: React.FC<PaisBadgeProps> = ({ pais, size = 'md', className = '' }) => {
  const codigo = codigoPais(pais);
  if (!codigo) {
    return <Globe className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-orange-600 ${className}`} />;
  }
  return (
    <span className={`${size === 'sm' ? 'text-[10px]' : 'text-sm'} font-bold text-orange-700 tracking-tight tabular-nums ${className}`}>
      {codigo}
    </span>
  );
};
