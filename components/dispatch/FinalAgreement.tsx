'use client';

import { CheckCircle, Download } from 'lucide-react';
import { carbon } from '@/lib/themes/carbon';
import { formatTimeWithDayOffset } from '@/lib/time-parser';

interface FinalAgreementProps {
  agreementText: string;
  originalAppointment: string;
  confirmedTime: string;
  confirmedDock: string;
  delayMinutes: number;
  totalCost: number;
  /** Day offset of confirmed time (0 = today, 1 = tomorrow) */
  confirmedDayOffset?: number;
}

export function FinalAgreement({
  agreementText,
  originalAppointment,
  confirmedTime,
  confirmedDock,
  delayMinutes,
  totalCost,
  confirmedDayOffset = 0,
}: FinalAgreementProps) {
  // Format confirmed time with day offset for display
  const formattedConfirmedTime = formatTimeWithDayOffset(confirmedTime, confirmedDayOffset);

  const exportCSV = () => {
    const csv = `Date,Original Time,New Time,Dock,Delay (min),Cost Impact,Day Offset,Status
${new Date().toLocaleDateString()},${originalAppointment},${formattedConfirmedTime},${confirmedDock},${delayMinutes},${totalCost},${confirmedDayOffset},CONFIRMED`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dock-appointment-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 border rounded-2xl p-4" style={{
      backgroundColor: carbon.successBg,
      borderColor: carbon.successBorder
    }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5" style={{ color: carbon.success }} />
        <span className="font-semibold" style={{ color: carbon.success }}>Done</span>
      </div>

      {/* Agreement Details */}
      <pre className="text-xs font-mono whitespace-pre-wrap rounded-lg p-3 max-h-40 overflow-y-auto mb-3" style={{
        backgroundColor: `${carbon.bgBase}33`,
        color: carbon.textSecondary
      }}>
        {agreementText}
      </pre>

      {/* Export Button */}
      <button
        onClick={exportCSV}
        className="w-full py-2.5 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
        style={{
          backgroundColor: carbon.success,
          color: carbon.bgBase
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = carbon.successDark}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = carbon.success}
      >
        <Download className="w-4 h-4" />
        Export
      </button>
    </div>
  );
}

/** Helper to generate agreement text */
export function generateAgreementText(params: {
  originalTime: string;
  newTime: string;
  dock: string;
  delayMinutes: number;
  costImpact: number;
  warehouseContact: string | null;
  /** Day offset of confirmed time (0 = today, 1 = tomorrow) */
  dayOffset?: number;
}): string {
  const formattedNewTime = formatTimeWithDayOffset(params.newTime, params.dayOffset ?? 0);
  const dayInfo = params.dayOffset && params.dayOffset > 0
    ? `\nScheduled For: ${params.dayOffset === 1 ? 'Tomorrow' : `Day ${params.dayOffset + 1}`}`
    : '';
  return `DOCK APPOINTMENT UPDATE
Date: ${new Date().toLocaleDateString()}
Original Time: ${params.originalTime}
New Time: ${formattedNewTime}${dayInfo}
Dock: ${params.dock}
Delay: ${params.delayMinutes} minutes
Cost Impact: $${params.costImpact}
Warehouse Contact: ${params.warehouseContact || 'N/A'}
Status: CONFIRMED`;
}
