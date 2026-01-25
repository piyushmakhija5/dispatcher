'use client';

import { useState, useCallback } from 'react';
import type {
  ThinkingStep,
  ThinkingBlockType,
  ExpandedStepsState,
} from '@/types/dispatch';

// Counter for unique IDs (module-level to persist across re-renders)
let thinkingStepCounter = 0;

export interface UseThinkingStepsReturn {
  thinkingSteps: ThinkingStep[];
  expandedSteps: ExpandedStepsState;
  activeStepId: string | null;
  toggleStepExpanded: (id: string) => void;
  addThinkingStep: (type: ThinkingBlockType, title: string, content: string | string[]) => string;
  updateThinkingStep: (id: string, updates: Partial<ThinkingStep>) => void;
  completeThinkingStep: (id: string) => void;
  resetThinkingSteps: () => void;
}

/**
 * Hook for managing thinking step UI state
 * Used to show progressive reasoning blocks to the user
 */
export function useThinkingSteps(): UseThinkingStepsReturn {
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<ExpandedStepsState>({});
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const toggleStepExpanded = useCallback((id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const addThinkingStep = useCallback(
    (type: ThinkingBlockType, title: string, content: string | string[]): string => {
      // Use counter + timestamp to ensure unique IDs even when called rapidly
      thinkingStepCounter += 1;
      const id = `${Date.now()}-${thinkingStepCounter}`;
      setThinkingSteps((prev) => [...prev, { id, type, title, content }]);
      setExpandedSteps((prev) => ({ ...prev, [id]: true }));
      setActiveStepId(id);
      return id;
    },
    []
  );

  const updateThinkingStep = useCallback((id: string, updates: Partial<ThinkingStep>) => {
    setThinkingSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const completeThinkingStep = useCallback((id: string) => {
    // Auto-collapse when completing
    setExpandedSteps((prev) => ({ ...prev, [id]: false }));
    setActiveStepId((current) => (current === id ? null : current));
  }, []);

  const resetThinkingSteps = useCallback(() => {
    setThinkingSteps([]);
    setExpandedSteps({});
    setActiveStepId(null);
  }, []);

  return {
    thinkingSteps,
    expandedSteps,
    activeStepId,
    toggleStepExpanded,
    addThinkingStep,
    updateThinkingStep,
    completeThinkingStep,
    resetThinkingSteps,
  };
}
