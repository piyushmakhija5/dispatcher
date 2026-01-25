'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseConfirmedDetailsReturn {
  // State
  confirmedTime: string | null;
  confirmedDock: string | null;
  confirmedDayOffset: number;
  warehouseManagerName: string | null;
  finalAgreement: string | null;

  // Refs for async callback access (avoid stale closure issues)
  confirmedTimeRef: React.RefObject<string | null>;
  confirmedDockRef: React.RefObject<string | null>;
  confirmedDayOffsetRef: React.RefObject<number>;
  warehouseManagerNameRef: React.RefObject<string | null>;

  // Setters
  setConfirmedTime: (time: string | null) => void;
  setConfirmedDock: (dock: string | null) => void;
  setConfirmedDayOffset: (dayOffset: number) => void;
  setWarehouseManagerName: (name: string | null) => void;
  setFinalAgreement: (agreement: string | null) => void;

  // Reset
  resetConfirmedDetails: () => void;
}

/**
 * Hook for managing confirmed negotiation details
 * Maintains both state and refs to avoid stale closure issues in async callbacks
 */
export function useConfirmedDetails(): UseConfirmedDetailsReturn {
  // State
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null);
  const [confirmedDock, setConfirmedDock] = useState<string | null>(null);
  const [confirmedDayOffset, setConfirmedDayOffset] = useState<number>(0);
  const [warehouseManagerName, setWarehouseManagerName] = useState<string | null>(null);
  const [finalAgreement, setFinalAgreement] = useState<string | null>(null);

  // Refs for async state access (prevents stale closure issues)
  const confirmedTimeRef = useRef<string | null>(null);
  const confirmedDockRef = useRef<string | null>(null);
  const confirmedDayOffsetRef = useRef<number>(0);
  const warehouseManagerNameRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    confirmedTimeRef.current = confirmedTime;
    confirmedDockRef.current = confirmedDock;
    confirmedDayOffsetRef.current = confirmedDayOffset;
    warehouseManagerNameRef.current = warehouseManagerName;
  }, [confirmedTime, confirmedDock, confirmedDayOffset, warehouseManagerName]);

  // Reset
  const resetConfirmedDetails = useCallback(() => {
    setConfirmedTime(null);
    setConfirmedDock(null);
    setConfirmedDayOffset(0);
    setWarehouseManagerName(null);
    setFinalAgreement(null);
  }, []);

  return {
    confirmedTime,
    confirmedDock,
    confirmedDayOffset,
    warehouseManagerName,
    finalAgreement,
    confirmedTimeRef,
    confirmedDockRef,
    confirmedDayOffsetRef,
    warehouseManagerNameRef,
    setConfirmedTime,
    setConfirmedDock,
    setConfirmedDayOffset,
    setWarehouseManagerName,
    setFinalAgreement,
    resetConfirmedDetails,
  };
}
