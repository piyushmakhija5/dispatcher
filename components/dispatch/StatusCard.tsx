'use client';

import { ReactNode } from 'react';
import { Loader } from 'lucide-react';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { carbon } from '@/lib/themes/carbon';

/**
 * Status card variants
 */
export type StatusCardVariant = 'success' | 'info' | 'warning' | 'error';

/**
 * Props for StatusCard component
 */
export interface StatusCardProps {
  /** The icon to display */
  icon: ReactNode;
  /** Title text (supports typewriter animation) */
  title: string;
  /** Description text (supports typewriter animation) */
  description?: string;
  /** Visual variant */
  variant?: StatusCardVariant;
  /** Whether to animate the title with typewriter effect */
  animateTitle?: boolean;
  /** Callback when title animation completes */
  onTitleComplete?: () => void;
  /** Whether title animation is complete (controls description visibility) */
  titleComplete?: boolean;
  /** Whether to animate the description with typewriter effect */
  animateDescription?: boolean;
  /** Callback when description animation completes */
  onDescriptionComplete?: () => void;
  /** Additional content to render below description */
  children?: ReactNode;
  /** Custom class name */
  className?: string;
  /** Whether to show loading indicator on icon */
  loading?: boolean;
}

/**
 * Get colors for a variant
 */
function getVariantColors(variant: StatusCardVariant) {
  switch (variant) {
    case 'success':
      return {
        bg: carbon.successBg,
        border: carbon.successBorder,
        iconBg: `${carbon.success}33`,
        text: carbon.success,
      };
    case 'info':
      return {
        bg: carbon.accentBg,
        border: carbon.accentBorder,
        iconBg: `${carbon.accent}33`,
        text: carbon.accent,
      };
    case 'warning':
      return {
        bg: carbon.warningBg,
        border: carbon.warningBorder,
        iconBg: `${carbon.warning}33`,
        text: carbon.warning,
      };
    case 'error':
      return {
        bg: carbon.criticalBg,
        border: carbon.criticalBorder,
        iconBg: `${carbon.critical}33`,
        text: carbon.critical,
      };
    default:
      return {
        bg: carbon.successBg,
        border: carbon.successBorder,
        iconBg: `${carbon.success}33`,
        text: carbon.success,
      };
  }
}

/**
 * StatusCard - A reusable card component for displaying status messages
 *
 * Used for: Analysis complete, Voice subagent, Finalized agreement, Driver confirmation
 */
export function StatusCard({
  icon,
  title,
  description,
  variant = 'success',
  animateTitle = false,
  onTitleComplete,
  titleComplete = true,
  animateDescription = false,
  onDescriptionComplete,
  children,
  className = '',
  loading = false,
}: StatusCardProps) {
  const colors = getVariantColors(variant);

  return (
    <div
      className={`border rounded-xl p-5 transition-all duration-500 ease-in-out animate-in fade-in ${className}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.iconBg }}
        >
          {loading ? (
            <Loader className="w-6 h-6 animate-spin" style={{ color: colors.text }} />
          ) : (
            <div style={{ color: colors.text }}>{icon}</div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Title */}
          <h3 className="text-base font-semibold mb-1.5" style={{ color: colors.text }}>
            {animateTitle && !titleComplete ? (
              <TypewriterText
                text={title}
                speed={30}
                onComplete={onTitleComplete}
              />
            ) : (
              title
            )}
          </h3>

          {/* Description - only show after title completes */}
          {titleComplete && description && (
            animateDescription ? (
              <div style={{ color: carbon.textSecondary }}>
                <TypewriterText
                  text={description}
                  speed={15}
                  className="text-sm"
                  as="p"
                  onComplete={onDescriptionComplete}
                />
              </div>
            ) : (
              <p className="text-sm" style={{ color: carbon.textSecondary }}>
                {description}
              </p>
            )
          )}

          {/* Additional content */}
          {titleComplete && children}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact variant of StatusCard for smaller displays
 */
export interface StatusCardCompactProps extends Omit<StatusCardProps, 'children'> {
  /** Details to show in a compact format */
  details?: Array<{ label: string; value: string; highlight?: 'success' | 'warning' | 'error' }>;
}

export function StatusCardCompact({
  icon,
  title,
  description,
  variant = 'success',
  animateTitle = false,
  onTitleComplete,
  titleComplete = true,
  animateDescription = false,
  onDescriptionComplete,
  details,
  className = '',
  loading = false,
}: StatusCardCompactProps) {
  const colors = getVariantColors(variant);

  return (
    <div
      className={`border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in ${className}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.iconBg }}
        >
          {loading ? (
            <Loader className="w-5 h-5 animate-spin" style={{ color: colors.text }} />
          ) : (
            <div style={{ color: colors.text }}>{icon}</div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Title */}
          <h3 className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
            {animateTitle && !titleComplete ? (
              <TypewriterText
                text={title}
                speed={30}
                onComplete={onTitleComplete}
              />
            ) : (
              title
            )}
          </h3>

          {/* Description */}
          {titleComplete && description && (
            animateDescription ? (
              <div style={{ color: carbon.textSecondary }}>
                <TypewriterText
                  text={description}
                  speed={15}
                  className="text-xs"
                  as="p"
                  onComplete={onDescriptionComplete}
                />
              </div>
            ) : (
              <p className="text-xs" style={{ color: carbon.textSecondary }}>
                {description}
              </p>
            )
          )}

          {/* Details */}
          {titleComplete && details && details.length > 0 && (
            <div
              className="rounded-lg p-3 mt-2 space-y-1.5"
              style={{ backgroundColor: `${carbon.bgSurface2}80` }}
            >
              {details.map((detail, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: carbon.textTertiary }}>
                    {detail.label}:
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: detail.highlight === 'success'
                        ? carbon.success
                        : detail.highlight === 'warning'
                        ? carbon.warning
                        : detail.highlight === 'error'
                        ? carbon.critical
                        : carbon.textPrimary,
                    }}
                  >
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
