import { useState, useEffect } from 'react';

/**
 * Progressive Disclosure State Machine
 * Manages the step-by-step reveal of UI sections with loading states
 */
export function useProgressiveDisclosure(
  workflowStage: 'setup' | 'analyzing' | 'negotiating' | 'complete',
  activeStepId: string | null,
  hasNegotiationStrategy: boolean
) {
  // Visibility states
  const [showSummary, setShowSummary] = useState(false);
  const [summaryHeaderComplete, setSummaryHeaderComplete] = useState(false);
  const [summaryTypingComplete, setSummaryTypingComplete] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showVoiceSubagent, setShowVoiceSubagent] = useState(false);
  const [voiceSubagentHeaderComplete, setVoiceSubagentHeaderComplete] = useState(false);
  const [voiceSubagentTypingComplete, setVoiceSubagentTypingComplete] = useState(false);
  const [showCallButton, setShowCallButton] = useState(false);
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [loadingVoiceSubagent, setLoadingVoiceSubagent] = useState(false);
  const [loadingCallButton, setLoadingCallButton] = useState(false);

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
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up summary timer');
        clearTimeout(timer);
      };
    }
  }, [reasoningCollapsed, showSummary]);

  // Step 3: Summary typing complete → Loading → Show strategy panel
  useEffect(() => {
    if (summaryTypingComplete && !showStrategy) {
      console.log('⏳ Step 3a: Loading strategy...');
      setLoadingStrategy(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 3b: Showing strategy');
        setLoadingStrategy(false);
        setShowStrategy(true);
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up strategy timer');
        clearTimeout(timer);
      };
    }
  }, [summaryTypingComplete, showStrategy]);

  // Reset all states when workflow resets
  useEffect(() => {
    if (workflowStage === 'setup') {
      setShowSummary(false);
      setSummaryHeaderComplete(false);
      setSummaryTypingComplete(false);
      setShowStrategy(false);
      setShowVoiceSubagent(false);
      setVoiceSubagentHeaderComplete(false);
      setVoiceSubagentTypingComplete(false);
      setShowCallButton(false);
      setReasoningCollapsed(false);
      setLoadingSummary(false);
      setLoadingStrategy(false);
      setLoadingVoiceSubagent(false);
      setLoadingCallButton(false);
    }
  }, [workflowStage]);

  return {
    // Visibility states
    showSummary,
    summaryHeaderComplete,
    summaryTypingComplete,
    showStrategy,
    showVoiceSubagent,
    voiceSubagentHeaderComplete,
    voiceSubagentTypingComplete,
    showCallButton,
    reasoningCollapsed,

    // Loading states
    loadingSummary,
    loadingStrategy,
    loadingVoiceSubagent,
    loadingCallButton,

    // Setters for typewriter completion
    setSummaryHeaderComplete,
    setSummaryTypingComplete,
    setVoiceSubagentHeaderComplete,
    setVoiceSubagentTypingComplete,

    // Control functions
    setShowVoiceSubagent,
    setLoadingVoiceSubagent,
    setShowCallButton,
    setLoadingCallButton,
  };
}
