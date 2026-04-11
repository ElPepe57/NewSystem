import React from 'react';
import { cn } from '../utils';

interface KPIBarProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const colsMap = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

/**
 * KPIBar — Grid responsive de StatCards.
 */
export const KPIBar: React.FC<KPIBarProps> = ({ children, columns = 4, className }) => (
  <div className={cn('grid gap-4', colsMap[columns], className)}>
    {children}
  </div>
);
