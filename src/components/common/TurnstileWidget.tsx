/**
 * src/components/common/TurnstileWidget.tsx
 * chk5.F4-USERS (2026-05-25) · Captcha de Cloudflare Turnstile.
 *
 * Carga el script oficial de CF y renderiza el widget. Cuando el user
 * resuelve el captcha · CF llama al callback `onSuccess(token)` y ese
 * token se valida server-side en CF `validateSelfSignup`.
 *
 * Site Key se lee de VITE_TURNSTILE_SITE_KEY (frontend OK · es pública).
 */
import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpired,
  theme = 'light',
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onExpiredRef = useRef(onExpired);

  // Mantener refs sincronizados con props
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onExpiredRef.current = onExpired; }, [onExpired]);

  useEffect(() => {
    if (!SITE_KEY) {
      console.warn('[TurnstileWidget] VITE_TURNSTILE_SITE_KEY no configurado');
      return;
    }

    // Cargar script si no existe
    if (!document.querySelector(`script[src*="turnstile/v0/api.js"]`)) {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Renderizar widget cuando esté disponible
    const tryRender = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token) => onSuccessRef.current(token),
          'error-callback': () => onErrorRef.current?.(),
          'expired-callback': () => onExpiredRef.current?.(),
        });
      }
    };

    // Reintentar hasta que el script cargue
    if (window.turnstile) {
      tryRender();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          tryRender();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [theme]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      }
    };
  }, []);

  // Helper público para resetear widget desde el parent (ej. después de un error)
  // Disponible vía window solo en desarrollo · para testing
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as Window & { __turnstileReset?: () => void }).__turnstileReset = () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    };
  }

  if (!SITE_KEY) {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 ${className}`}>
        <strong>⚠ Turnstile no configurado.</strong> Agregá <code>VITE_TURNSTILE_SITE_KEY</code> en .env
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
