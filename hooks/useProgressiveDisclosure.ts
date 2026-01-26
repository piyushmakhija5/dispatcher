import { useState, useEffect, useCallback, useRef } from 'react';
import type { DriverCallStatus } from '@/types/dispatch';

/**
 * Configuration for progressive disclosure
 */
export interface ProgressiveDisclosureConfig {
  /** Delay between steps in milliseconds */
  stepDelay?: number;
  /** Communication mode (affects which steps are shown) */
  communicationMode?: 'voice' | 'text';
  /** Whether driver confirmation is enabled */
  isDriverConfirmationEnabled?: boolean;
}

const DEFAULT_STEP_DELAY = 1000;

/**
 * Progressive Disclosure State Machine
 * Manages the step-by-step reveal of UI sections with loading states
 *
 * Flow:
 * 1. Analysis completes → Collapse reasoning
 * 2. Reasoning collapsed → Show summary (with typewriter)
 * 3. Summary complete → Show strategy panel
 * 4. Strategy shown → Show voice subagent (voice mode) OR call button (text mode)
 * 5. Voice subagent complete → Show call button
 * 6. Call ends → Show finalized agreement
 * 7. (Optional) Driver confirmation → Show driver confirmation UI
 */
export function useProgressiveDisclosure(
  workflowStage: 'setup' | 'analyzing' | 'negotiating' | 'complete' | string,
  activeStepId: string | null,
  hasNegotiationStrategy: boolean,
  config: ProgressiveDisclosureConfig = {}
) {
  const {
    stepDelay = DEFAULT_STEP_DELAY,
    communicationMode = 'voice',
    isDriverConfirmationEnabled = false,
  } = config;

  const isVoiceMode = communicationMode === 'voice';

  // =========================================================================
  // VISIBILITY STATES
  // =========================================================================

  // Summary section
  const [showSummary, setShowSummary] = useState(false);
  const [summaryHeaderComplete, setSummaryHeaderComplete] = useState(false);
  const [summaryTypingComplete, setSummaryTypingComplete] = useState(false);

  // Strategy section
  const [showStrategy, setShowStrategy] = useState(false);

  // Voice subagent section (voice mode only)
  const [showVoiceSubagent, setShowVoiceSubagent] = useState(false);
  const [voiceSubagentHeaderComplete, setVoiceSubagentHeaderComplete] = useState(false);
  const [voiceSubagentTypingComplete, setVoiceSubagentTypingComplete] = useState(false);

  // Call button
  const [showCallButton, setShowCallButton] = useState(false);

  // Reasoning panel
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

  // Finalized agreement section (after call ends)
  const [showFinalizedAgreement, setShowFinalizedAgreement] = useState(false);
  const [finalizedHeaderComplete, setFinalizedHeaderComplete] = useState(false);
  const [finalizedTypingComplete, setFinalizedTypingComplete] = useState(false);

  // Driver confirmation section (Phase 12)
  const [showDriverConfirmation, setShowDriverConfirmation] = useState(false);
  const [driverConfirmHeaderComplete, setDriverConfirmHeaderComplete] = useState(false);
  const [driverConfirmTypingComplete, setDriverConfirmTypingComplete] = useState(false);

  // =========================================================================
  // LOADING STATES
  // =========================================================================

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [loadingVoiceSubagent, setLoadingVoiceSubagent] = useState(false);
  const [loadingCallButton, setLoadingCallButton] = useState(false);
  const [loadingFinalized, setLoadingFinalized] = useState(false);
  const [loadingDriverConfirm, setLoadingDriverConfirm] = useState(false);

  // =========================================================================
  // AUTOMATIC STEP TRANSITIONS
  // =========================================================================

  // Step 1: Analysis completes → Collapse reasoning panel
  useEffect(() => {
    if (workflowStage === 'negotiating' && !activeStepId && !reasoningCollapsed) {
      console.log('✅ Step 1: Analysis complete → Collapsing reasoning');
      setReasoningCollapsed(true);
    }
  }, [workflowStage, activeStepId, reasoningCollapsed]);

  // Step 2: Reasoning collapsed → Loading → Show summary
  useEffect(() => {
    if (reasoningCollapsed && !showSummary) {
      console.log('⏳ Step 2a: Loading summary...');
      setLoadingSummary(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 2b: Showing summary');
        setLoadingSummary(false);
        setShowSummary(true);
      }, stepDelay);

      return () => clearTimeout(timer);
    }
  }, [reasoningCollapsed, showSummary, stepDelay]);

  // Step 3: Summary typing complete → Loading → Show strategy panel
  useEffect(() => {
    if (summaryTypingComplete && !showStrategy) {
      console.log('⏳ Step 3a: Loading strategy...');
      setLoadingStrategy(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 3b: Showing strategy');
        setLoadingStrategy(false);
        setShowStrategy(true);
      }, stepDelay);

      return () => clearTimeout(timer);
    }
  }, [summaryTypingComplete, showStrategy, stepDelay]);

  // Step 4: Strategy shown → Show voice subagent (voice) or call button (text)
  useEffect(() => {
    if (showStrategy && !showVoiceSubagent && !showCallButton) {
      if (isVoiceMode) {
        console.log('⏳ Step 4a: Loading voice subagent...');
        setLoadingVoiceSubagent(true);

        const timer = setTimeout(() => {
          console.log('✅ Step 4b: Showing voice subagent');
          setLoadingVoiceSubagent(false);
          setShowVoiceSubagent(true);
        }, stepDelay);

        return () => clearTimeout(timer);
      } else {
        console.log('⏳ Step 4a: Loading call button (text mode)...');
        setLoadingCallButton(true);

        const timer = setTimeout(() => {
          console.log('✅ Step 4b: Showing call button');
          setLoadingCallButton(false);
          setShowCallButton(true);
        }, stepDelay);

        return () => clearTimeout(timer);
      }
    }
  }, [showStrategy, showVoiceSubagent, showCallButton, isVoiceMode, stepDelay]);

  // Step 5: Voice subagent typing complete → Show call button (voice mode only)
  useEffect(() => {
    if (voiceSubagentTypingComplete && !showCallButton) {
      console.log('⏳ Step 5a: Loading call button...');
      setLoadingCallButton(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 5b: Showing call button');
        setLoadingCallButton(false);
        setShowCallButton(true);
      }, stepDelay);

      return () => clearTimeout(timer);
    }
  }, [voiceSubagentTypingComplete, showCallButton, stepDelay]);

  // =========================================================================
  // RESET FUNCTION
  // =========================================================================

  // Reset all states when workflow resets
  useEffect(() => {
    if (workflowStage === 'setup') {
      // Summary
      setShowSummary(false);
      setSummaryHeaderComplete(false);
      setSummaryTypingComplete(false);
      // Strategy
      setShowStrategy(false);
      // Voice subagent
      setShowVoiceSubagent(false);
      setVoiceSubagentHeaderComplete(false);
      setVoiceSubagentTypingComplete(false);
      // Call button
      setShowCallButton(false);
      // Reasoning
      setReasoningCollapsed(false);
      // Finalized agreement
      setShowFinalizedAgreement(false);
      setFinalizedHeaderComplete(false);
      setFinalizedTypingComplete(false);
      // Driver confirmation
      setShowDriverConfirmation(false);
      setDriverConfirmHeaderComplete(false);
      setDriverConfirmTypingComplete(false);
      // Loading states
      setLoadingSummary(false);
      setLoadingStrategy(false);
      setLoadingVoiceSubagent(false);
      setLoadingCallButton(false);
      setLoadingFinalized(false);
      setLoadingDriverConfirm(false);
    }
  }, [workflowStage]);

  // =========================================================================
  // MANUAL TRIGGERS
  // =========================================================================

  /**
   * Trigger finalized agreement section to show (after call ends)
   */
  const triggerFinalizedAgreement = useCallback(() => {
    console.log('⏳ Triggering finalized agreement...');
    setLoadingFinalized(true);

    setTimeout(() => {
      console.log('✅ Showing finalized agreement');
      setLoadingFinalized(false);
      setShowFinalizedAgreement(true);
    }, stepDelay);
  }, [stepDelay]);

  /**
   * Trigger driver confirmation section to show (Phase 12)
   */
  const triggerDriverConfirmation = useCallback(() => {
    console.log('⏳ Triggering driver confirmation UI...');
    setLoadingDriverConfirm(true);

    setTimeout(() => {
      console.log('✅ Showing driver confirmation UI');
      setLoadingDriverConfirm(false);
      setShowDriverConfirmation(true);
    }, 500); // Shorter delay for driver confirmation
  }, []);

  return {
    // =========================================================================
    // VISIBILITY STATES
    // =========================================================================

    // Summary
    showSummary,
    summaryHeaderComplete,
    summaryTypingComplete,

    // Strategy
    showStrategy,

    // Voice subagent
    showVoiceSubagent,
    voiceSubagentHeaderComplete,
    voiceSubagentTypingComplete,

    // Call button
    showCallButton,

    // Reasoning
    reasoningCollapsed,

    // Finalized agreement
    showFinalizedAgreement,
    finalizedHeaderComplete,
    finalizedTypingComplete,

    // Driver confirmation
    showDriverConfirmation,
    driverConfirmHeaderComplete,
    driverConfirmTypingComplete,

    // =========================================================================
    // LOADING STATES
    // =========================================================================

    loadingSummary,
    loadingStrategy,
    loadingVoiceSubagent,
    loadingCallButton,
    loadingFinalized,
    loadingDriverConfirm,

    // =========================================================================
    // TYPEWRITER COMPLETION SETTERS
    // =========================================================================

    setSummaryHeaderComplete,
    setSummaryTypingComplete,
    setVoiceSubagentHeaderComplete,
    setVoiceSubagentTypingComplete,
    setFinalizedHeaderComplete,
    setFinalizedTypingComplete,
    setDriverConfirmHeaderComplete,
    setDriverConfirmTypingComplete,

    // =========================================================================
    // MANUAL TRIGGERS
    // =========================================================================

    triggerFinalizedAgreement,
    triggerDriverConfirmation,

    // =========================================================================
    // LEGACY SETTERS (for backward compatibility)
    // =========================================================================

    setShowVoiceSubagent,
    setLoadingVoiceSubagent,
    setShowCallButton,
    setLoadingCallButton,
  };
}
