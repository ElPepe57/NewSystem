/**
 * src/utils/passwordStrength.ts
 * chk5.F4-USERS (2026-05-25) · Helper de password strength indicator.
 *
 * Evalúa la fuerza de la password en 4 niveles (0-3 segmentos llenos)
 * según política simple. Server-side se valida más estricto con
 * configUsuariosService.validatePassword().
 */

export type PasswordStrength = 'muy_debil' | 'debil' | 'media' | 'fuerte';

export interface PasswordStrengthResult {
  level: PasswordStrength;
  /** Cantidad de segmentos llenos (0-4) para UI bar */
  filled: 0 | 1 | 2 | 3 | 4;
  /** Color Tailwind del último segmento lleno */
  color: 'rose' | 'amber' | 'sky' | 'emerald';
  /** Mensaje user-friendly */
  message: string;
  /** Sugerencias específicas para subir nivel */
  hints: string[];
}

const COMUNES = [
  'password', '12345678', 'qwerty', 'abc123', 'admin123', '111111',
  'letmein', 'welcome', 'monkey', 'iloveyou',
];

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      level: 'muy_debil',
      filled: 0,
      color: 'rose',
      message: 'Ingresá una contraseña',
      hints: [],
    };
  }

  let score = 0;
  const hints: string[] = [];

  // Length
  if (password.length >= 8) score++;
  else hints.push('Mínimo 8 caracteres');
  if (password.length >= 12) score++;

  // Mayúscula
  if (/[A-Z]/.test(password)) score++;
  else hints.push('Agregá una mayúscula');

  // Número
  if (/[0-9]/.test(password)) score++;
  else hints.push('Agregá un número');

  // Caracter especial
  if (/[!@#$%^&*()_+\-=[\]{};:'"\\|,.<>/?]/.test(password)) score++;

  // Penalty: passwords comunes
  if (COMUNES.some((c) => password.toLowerCase().includes(c))) {
    score = Math.max(0, score - 2);
    hints.unshift('Evitá secuencias comunes (password, 12345, etc.)');
  }

  // Mapeo score → level
  if (score <= 1) {
    return {
      level: 'muy_debil',
      filled: 1,
      color: 'rose',
      message: 'Muy débil',
      hints,
    };
  }
  if (score === 2) {
    return {
      level: 'debil',
      filled: 2,
      color: 'amber',
      message: 'Débil',
      hints,
    };
  }
  if (score === 3) {
    return {
      level: 'media',
      filled: 3,
      color: 'sky',
      message: 'Media · podría mejorar',
      hints,
    };
  }
  return {
    level: 'fuerte',
    filled: 4,
    color: 'emerald',
    message: 'Fuerte · cumple política',
    hints: [],
  };
}

/**
 * Mapeo de color → clase Tailwind para el indicador de strength.
 */
export function strengthBarColor(color: PasswordStrengthResult['color']): string {
  switch (color) {
    case 'rose': return 'bg-rose-400';
    case 'amber': return 'bg-amber-400';
    case 'sky': return 'bg-sky-400';
    case 'emerald': return 'bg-emerald-400';
  }
}

export function strengthTextColor(color: PasswordStrengthResult['color']): string {
  switch (color) {
    case 'rose': return 'text-rose-700';
    case 'amber': return 'text-amber-700';
    case 'sky': return 'text-sky-700';
    case 'emerald': return 'text-emerald-700';
  }
}
