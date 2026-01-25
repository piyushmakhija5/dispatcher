'use client';

import { useState, useCallback } from 'react';
import type {
  ArtifactState,
  ArtifactType,
  BlockExpansionState,
  Task,
  TaskStatus,
} from '@/types/dispatch';

/** Default artifact state */
const DEFAULT_ARTIFACT_STATE: ArtifactState = {
  isOpen: false,
  type: null,
  data: null,
};

/** Initial negotiation tasks */
const INITIAL_TASKS: Task[] = [
  { id: 'fetch-contract', label: 'Fetch contract', status: 'pending' },
  { id: 'analyze-contract', label: 'Analyze terms', status: 'pending' },
  { id: 'compute-impact', label: 'Compute impact', status: 'pending' },
  { id: 'contact', label: 'Contact warehouse', status: 'pending' },
  { id: 'negotiate', label: 'Negotiate slot', status: 'pending' },
  { id: 'confirm-dock', label: 'Confirm dock', status: 'pending' },
  { id: 'finalize', label: 'Finalize', status: 'pending' },
];

export interface UseAgenticUIReturn {
  // Block expansion
  blockExpansion: BlockExpansionState;
  toggleBlockExpansion: (blockId: string) => void;

  // Artifact panel
  artifact: ArtifactState;
  openArtifact: (type: ArtifactType, data: unknown) => void;
  closeArtifact: () => void;

  // Task progress
  tasks: Task[];
  currentTaskId: string | null;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;

  // Reset
  resetAgenticUI: () => void;
}

/**
 * Hook for managing agentic UI state
 * Handles block expansion, artifact panel, and task progress
 */
export function useAgenticUI(): UseAgenticUIReturn {
  const [blockExpansion, setBlockExpansion] = useState<BlockExpansionState>({});
  const [artifact, setArtifact] = useState<ArtifactState>(DEFAULT_ARTIFACT_STATE);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // Block expansion
  const toggleBlockExpansion = useCallback((blockId: string) => {
    setBlockExpansion((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  }, []);

  // Artifact panel
  const openArtifact = useCallback((type: ArtifactType, data: unknown) => {
    setArtifact({ isOpen: true, type, data });
  }, []);

  const closeArtifact = useCallback(() => {
    setArtifact((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Task progress
  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    if (status === 'in_progress') {
      setCurrentTaskId(taskId);
    } else if (status === 'completed') {
      setCurrentTaskId((current) => (current === taskId ? null : current));
    }
  }, []);

  // Reset
  const resetAgenticUI = useCallback(() => {
    setBlockExpansion({});
    setArtifact(DEFAULT_ARTIFACT_STATE);
    setTasks(INITIAL_TASKS);
    setCurrentTaskId(null);
  }, []);

  return {
    blockExpansion,
    toggleBlockExpansion,
    artifact,
    openArtifact,
    closeArtifact,
    tasks,
    currentTaskId,
    updateTaskStatus,
    resetAgenticUI,
  };
}
