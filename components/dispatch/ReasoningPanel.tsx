'use client';

import { Brain, Loader } from 'lucide-react';
import { ThinkingBlock } from './ThinkingBlock';
import { carbon } from '@/lib/themes/carbon';
import type { ThinkingStep } from '@/types/dispatch';

/**
 * Props for ReasoningPanel component
 */
export interface ReasoningPanelProps {
  /** Thinking steps to display */
  steps: ThinkingStep[];
  /** Currently active step ID */
  activeStepId: string | null;
  /** Map of expanded step IDs */
  expandedSteps: Record<string, boolean>;
  /** Callback when a step is toggled */
  onToggleStep: (stepId: string) => void;
  /** Whether the panel should be collapsed by default */
  defaultCollapsed?: boolean;
  /** Maximum height of the scrollable content */
  maxHeight?: string;
}

/**
 * ReasoningPanel - Collapsible panel showing AI reasoning steps
 *
 * This component displays the thinking/analysis steps that the AI
 * goes through during contract analysis and strategy computation.
 */
export function ReasoningPanel({
  steps,
  activeStepId,
  expandedSteps,
  onToggleStep,
  defaultCollapsed = false,
  maxHeight = '300px',
}: ReasoningPanelProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <details
      open={!defaultCollapsed}
      className="group rounded-xl overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        backgroundColor: `${carbon.bgSurface1}4d`,
        border: `1px solid ${carbon.borderSubtle}`,
      }}
    >
      {/* Summary/Header */}
      <summary
        className="px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors list-none"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `${carbon.bgSurface1}80`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Brain className="w-4 h-4" style={{ color: carbon.warning }} />
        <span className="text-sm font-medium" style={{ color: carbon.textSecondary }}>
          Reasoning
        </span>
        <span className="text-xs ml-1" style={{ color: carbon.textTertiary }}>
          ({steps.length} steps)
        </span>
        {activeStepId && (
          <Loader className="w-3 h-3 animate-spin ml-2" style={{ color: carbon.warning }} />
        )}
        <svg
          className="w-4 h-4 ml-auto transition-transform duration-300 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: carbon.textTertiary }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>

      {/* Content */}
      <div
        className="transition-all duration-300 ease-in-out p-3 pt-0 space-y-2 overflow-y-auto border-t"
        style={{ borderColor: carbon.borderSubtle, maxHeight }}
      >
        {steps.map((step) => (
          <ThinkingBlock
            key={step.id}
            {...step}
            isExpanded={expandedSteps[step.id] ?? false}
            onToggle={() => onToggleStep(step.id)}
            isActive={activeStepId === step.id}
          />
        ))}
      </div>
    </details>
  );
}
