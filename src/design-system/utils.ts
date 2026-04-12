import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with deduplication.
 * Combines clsx (conditional) + tailwind-merge (dedup conflicting classes).
 *
 * Usage:
 *   cn('px-4 py-2', isActive && 'bg-teal-50', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
