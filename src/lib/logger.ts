/**
 * Logger simple para el sistema
 * En producción, estos logs se pueden desactivar o enviar a un servicio externo
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log informativo - solo en desarrollo
   */
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  },

  /**
   * Log de éxito - solo en desarrollo
   */
  success: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`✅ ${message}`, ...args);
    }
  },

  /**
   * Log de advertencia - siempre visible
   */
  warn: (message: string, ...args: unknown[]) => {
    console.warn(message, ...args);
  },

  /**
   * Log de error - siempre visible
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args);
  },

  /**
   * Log de debug - solo en desarrollo
   */
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(message, ...args);
    }
  }
};
