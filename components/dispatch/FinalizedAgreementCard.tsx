'use client';

import { CheckCircle } from 'lucide-react';
import { StatusCard } from './StatusCard';
import { carbon } from '@/lib/themes/carbon';
import type { TotalCostImpactResult } from '@/types/cost';

/**
 * Props for FinalizedAgreementCard component
 */
export interface FinalizedAgreementCardProps {
  /** Original appointment time (e.g., "14:00") */
  originalAppointment: string;
  /** Delay in minutes */
  delayMinutes: number;
  /** Confirmed time (e.g., "15:30") */
  confirmedTime: string;
  /** Confirmed dock (e.g., "B5") */
  confirmedDock: string;
  /** Warehouse manager name (optional) */
  warehouseManagerName?: string | null;
  /** Cost analysis (optional) */
  costAnalysis?: TotalCostImpactResult | null;
  /** Whether to animate the header */
  animateHeader?: boolean;
  /** Callback when header animation completes */
  onHeaderComplete?: () => void;
  /** Whether header animation is complete */
  headerComplete?: boolean;
  /** Whether to animate the description */
  animateDescription?: boolean;
  /** Callback when description animation completes */
  onDescriptionComplete?: () => void;
}

/**
 * Format delay for display (e.g., "1 hour 30 minutes")
 */
function formatDelay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
}

/**
 * Add minutes to a 24h time string
 */
function addMinutesToTime(time24h: string, minutes: number): string {
  const [h, m] = time24h.split(':').map(Number);
  const totalMins = h * 60 + m + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

/**
 * FinalizedAgreementCard - Shows the finalized negotiation agreement
 */
export function FinalizedAgreementCard({
  originalAppointment,
  delayMinutes,
  confirmedTime,
  confirmedDock,
  warehouseManagerName,
  costAnalysis,
  animateHeader = false,
  onHeaderComplete,
  headerComplete = true,
  animateDescription = false,
  onDescriptionComplete,
}: FinalizedAgreementCardProps) {
  const newArrivalTime = addMinutesToTime(originalAppointment, delayMinutes);

  const description = 'Voice subagent successfully negotiated the new appointment details. The rescheduled dock appointment has been confirmed and updated in the system.';

  return (
    <StatusCard
      icon={<CheckCircle className="w-6 h-6" />}
      title="Agreement Finalized"
      description={description}
      variant="success"
      animateTitle={animateHeader}
      onTitleComplete={onHeaderComplete}
      titleComplete={headerComplete}
      animateDescription={animateDescription}
      onDescriptionComplete={onDescriptionComplete}
    >
      {/* Agreement Details */}
      <div className="mt-3 space-y-3">
        <div
          className="rounded-lg p-3 space-y-1.5"
          style={{ backgroundColor: `${carbon.bgSurface2}80` }}
        >
          {/* Original Time */}
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: carbon.textTertiary }}>
              Original Time:
            </span>
            <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
              {originalAppointment}
            </span>
          </div>

          {/* Driver Delay */}
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: carbon.textTertiary }}>
              Driver Delay:
            </span>
            <span className="text-sm font-medium" style={{ color: carbon.warning }}>
              {formatDelay(delayMinutes)}
            </span>
          </div>

          {/* New Arrival Time */}
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: carbon.textTertiary }}>
              New Arrival Time:
            </span>
            <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
              {newArrivalTime}
            </span>
          </div>

          {/* Confirmed Time & Dock */}
          <div
            className="flex justify-between items-center pt-1.5 border-t"
            style={{ borderColor: `${carbon.border}80` }}
          >
            <span className="text-xs" style={{ color: carbon.textTertiary }}>
              Confirmed:
            </span>
            <span className="text-sm font-medium" style={{ color: carbon.success }}>
              {confirmedTime} at Dock {confirmedDock}
            </span>
          </div>

          {/* Warehouse Contact */}
          {warehouseManagerName && (
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: carbon.textTertiary }}>
                Warehouse Contact:
              </span>
              <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                {warehouseManagerName}
              </span>
            </div>
          )}

          {/* Cost Impact */}
          {costAnalysis && (
            <div
              className="flex justify-between items-center pt-1.5 border-t"
              style={{ borderColor: `${carbon.border}80` }}
            >
              <span className="text-xs" style={{ color: carbon.textTertiary }}>
                Total Cost Impact:
              </span>
              <span className="text-sm font-medium" style={{ color: carbon.warning }}>
                ${costAnalysis.totalCost.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </StatusCard>
  );
}
