import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  children: React.ReactNode;
}

/**
 * Wrapper sobre ErrorBoundary con UI específica para módulos/páginas.
 * Muestra el nombre del módulo que falló para facilitar el diagnóstico.
 */
export const ModuleErrorBoundary: React.FC<ModuleErrorBoundaryProps> = ({
  moduleName,
  children,
}) => {
  return (
    <ErrorBoundary
      fallbackMessage={`Algo salió mal en el módulo "${moduleName}"`}
      onError={(error, errorInfo) => {
        console.error(`[ModuleErrorBoundary][${moduleName}] Error:`, error.message);
        console.error(`[ModuleErrorBoundary][${moduleName}] Stack:`, errorInfo.componentStack);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
