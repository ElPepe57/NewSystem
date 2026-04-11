import React from 'react';
import { cn } from '../utils';
import { surface, spacing } from '../tokens';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageShell — Wrapper estandar para todas las paginas.
 * Garantiza padding, spacing y fondo consistentes.
 */
export const PageShell: React.FC<PageShellProps> = ({ children, className }) => (
  <div className={cn('min-h-[calc(100vh-4rem)]', surface.page, spacing.pageX, spacing.pageY, spacing.sectionGap, className)}>
    {children}
  </div>
);
