'use client';

import { Loader } from 'lucide-react';
import { carbon } from '@/lib/themes/carbon';

/**
 * Loading spinner color variants
 */
export type SpinnerVariant = 'success' | 'info' | 'warning' | 'error' | 'muted';

/**
 * Props for LoadingSpinner component
 */
export interface LoadingSpinnerProps {
  /** Visual variant */
  variant?: SpinnerVariant;
  /** Custom size class (w-X h-X) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name */
  className?: string;
}

/**
 * Get color for variant
 */
function getVariantColor(variant: SpinnerVariant): string {
  switch (variant) {
    case 'success':
      return carbon.success;
    case 'info':
      return carbon.accent;
    case 'warning':
      return carbon.warning;
    case 'error':
      return carbon.critical;
    case 'muted':
      return carbon.textTertiary;
    default:
      return carbon.warning;
  }
}

/**
 * Get size classes
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'w-4 h-4';
    case 'md':
      return 'w-6 h-6';
    case 'lg':
      return 'w-8 h-8';
    default:
      return 'w-6 h-6';
  }
}

/**
 * LoadingSpinner - A centered loading spinner with consistent styling
 */
export function LoadingSpinner({
  variant = 'warning',
  size = 'md',
  className = '',
}: LoadingSpinnerProps) {
  const color = getVariantColor(variant);
  const sizeClasses = getSizeClasses(size);

  return (
    <div className={`flex items-center justify-center py-6 ${className}`}>
      <Loader
        className={`${sizeClasses} animate-spin`}
        style={{ color }}
      />
    </div>
  );
}

/**
 * Inline loading spinner (without centering container)
 */
export function InlineSpinner({
  variant = 'warning',
  size = 'sm',
  className = '',
}: LoadingSpinnerProps) {
  const color = getVariantColor(variant);
  const sizeClasses = getSizeClasses(size);

  return (
    <Loader
      className={`${sizeClasses} animate-spin ${className}`}
      style={{ color }}
    />
  );
}
