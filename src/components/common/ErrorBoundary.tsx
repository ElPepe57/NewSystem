import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** JSX completo para reemplazar la UI de error por defecto */
  fallback?: React.ReactNode;
  /** Mensaje de error corto que se muestra en el fallback por defecto */
  fallbackMessage?: string;
  /** Callback legacy — se invoca al hacer click en Reintentar */
  onReset?: () => void;
  /** Callback invocado cuando se captura un error (para logging externo futuro) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Error capturado:', error.message);
    console.error('[ErrorBoundary] Stack del componente:', errorInfo.componentStack);
    console.error('[ErrorBoundary] Stack del error:', error.stack);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Si se pasó un fallback JSX personalizado, usarlo directamente
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const message = this.props.fallbackMessage || 'Algo salió mal en este módulo';

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" aria-hidden="true" />
          </div>

          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {message}
          </h3>

          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {this.state.error?.message
              ? `Detalle: ${this.state.error.message}`
              : 'Se produjo un error inesperado. Puedes reintentar o volver al inicio.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
