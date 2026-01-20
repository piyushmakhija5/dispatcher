'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Counter for unique IDs (module-level to persist across re-renders)
let thinkingStepCounter = 0;
import type {
  WorkflowStage,
  CommunicationMode,
  ConversationPhase,
  Retailer,
  SetupParams,
  ThinkingStep,
  ThinkingBlockType,
  ExpandedStepsState,
  ChatMessage,
  NegotiationState,
} from '@/types/dispatch';
import type { TotalCostImpactResult } from '@/types/cost';
import { DEFAULT_CONTRACT_RULES } from '@/types/cost';
import {
  createNegotiationStrategy,
  evaluateOffer,
  type NegotiationStrategy,
  type OfferEvaluation,
} from '@/lib/negotiation-strategy';
import { calculateTotalCostImpact } from '@/lib/cost-engine';
import { minutesToTime } from '@/lib/time-parser';

/** Initial setup parameters */
const DEFAULT_SETUP_PARAMS: SetupParams = {
  delayMinutes: 90,
  originalAppointment: '14:00',
  shipmentValue: 50000,
  retailer: 'Walmart',
  communicationMode: 'text',
};

export interface UseDispatchWorkflowReturn {
  // Workflow state
  workflowStage: WorkflowStage;
  conversationPhase: ConversationPhase;
  isProcessing: boolean;

  // Setup
  setupParams: SetupParams;
  updateSetupParams: (params: Partial<SetupParams>) => void;

  // Thinking steps
  thinkingSteps: ThinkingStep[];
  expandedSteps: ExpandedStepsState;
  activeStepId: string | null;
  toggleStepExpanded: (id: string) => void;
  addThinkingStep: (type: ThinkingBlockType, title: string, content: string | string[]) => string;
  updateThinkingStep: (id: string, updates: Partial<ThinkingStep>) => void;
  completeThinkingStep: (id: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (role: 'dispatcher' | 'warehouse', content: string) => void;

  // Negotiation
  negotiationStrategy: NegotiationStrategy | null;
  negotiationState: NegotiationState;
  currentCostAnalysis: TotalCostImpactResult | null;
  currentEvaluation: OfferEvaluation | null;
  incrementPushback: () => void;

  // Confirmed details
  confirmedTime: string | null;
  confirmedDock: string | null;
  confirmedTimeRef: React.RefObject<string | null>;
  confirmedDockRef: React.RefObject<string | null>;
  setConfirmedTime: (time: string | null) => void;
  setConfirmedDock: (dock: string | null) => void;
  warehouseManagerName: string | null;
  setWarehouseManagerName: (name: string | null) => void;

  // Final agreement
  finalAgreement: string | null;
  setFinalAgreement: (agreement: string | null) => void;

  // Actions
  startAnalysis: () => Promise<void>;
  evaluateTimeOffer: (timeOffered: string) => {
    costAnalysis: TotalCostImpactResult;
    evaluation: OfferEvaluation;
  };
  setConversationPhase: (phase: ConversationPhase) => void;
  setIsProcessing: (processing: boolean) => void;
  reset: () => void;
}

export function useDispatchWorkflow(): UseDispatchWorkflowReturn {
  // Workflow state
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('setup');
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>('greeting');
  const [isProcessing, setIsProcessing] = useState(false);

  // Setup params
  const [setupParams, setSetupParams] = useState<SetupParams>(DEFAULT_SETUP_PARAMS);

  // Thinking steps
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<ExpandedStepsState>({});
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Negotiation
  const [negotiationStrategy, setNegotiationStrategy] = useState<NegotiationStrategy | null>(null);
  const [negotiationState, setNegotiationState] = useState<NegotiationState>({ pushbackCount: 0 });
  const [currentCostAnalysis, setCurrentCostAnalysis] = useState<TotalCostImpactResult | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<OfferEvaluation | null>(null);

  // Confirmed details
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null);
  const [confirmedDock, setConfirmedDock] = useState<string | null>(null);
  const [warehouseManagerName, setWarehouseManagerName] = useState<string | null>(null);
  const [finalAgreement, setFinalAgreement] = useState<string | null>(null);

  // Refs for async state access
  const confirmedTimeRef = useRef<string | null>(null);
  const confirmedDockRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    confirmedTimeRef.current = confirmedTime;
    confirmedDockRef.current = confirmedDock;
  }, [confirmedTime, confirmedDock]);

  // Setup params update
  const updateSetupParams = useCallback((params: Partial<SetupParams>) => {
    setSetupParams((prev) => ({ ...prev, ...params }));
  }, []);

  // Thinking step management
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
    setActiveStepId((current) => (current === id ? null : current));
  }, []);

  // Chat message management
  const addChatMessage = useCallback(
    (role: 'dispatcher' | 'warehouse', content: string) => {
      setChatMessages((prev) => [
        ...prev,
        { role, content, timestamp: new Date().toLocaleTimeString() },
      ]);
    },
    []
  );

  // Negotiation state
  const incrementPushback = useCallback(() => {
    setNegotiationState((prev) => ({
      ...prev,
      pushbackCount: prev.pushbackCount + 1,
    }));
  }, []);

  // Evaluate a time offer
  const evaluateTimeOffer = useCallback(
    (timeOffered: string) => {
      const costAnalysis = calculateTotalCostImpact(
        {
          originalAppointmentTime: setupParams.originalAppointment,
          newAppointmentTime: timeOffered,
          shipmentValue: setupParams.shipmentValue,
          retailer: setupParams.retailer,
        },
        DEFAULT_CONTRACT_RULES
      );

      setCurrentCostAnalysis(costAnalysis);

      const evaluation = negotiationStrategy
        ? evaluateOffer(timeOffered, costAnalysis.totalCost, negotiationStrategy, negotiationState)
        : {
            quality: 'UNKNOWN' as const,
            shouldAccept: false,
            shouldPushback: false,
            reason: 'No strategy available',
          };

      setCurrentEvaluation(evaluation);

      return { costAnalysis, evaluation };
    },
    [setupParams, negotiationStrategy, negotiationState]
  );

  // Helper for delay
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Start analysis workflow
  const startAnalysis = useCallback(async () => {
    setWorkflowStage('analyzing');
    await delay(500);

    const { delayMinutes, originalAppointment, shipmentValue, retailer } = setupParams;

    // Step 1: Delay detected
    const step1 = addThinkingStep('info', 'Delay Detected', [
      `Truck running ${delayMinutes} minutes late`,
      `Original appointment: ${originalAppointment}`,
      `Shipment value: $${shipmentValue.toLocaleString()}`,
      `Destination retailer: ${retailer}`,
    ]);
    await delay(1000);
    completeThinkingStep(step1);

    // Step 2: Analyzing contract
    const step2 = addThinkingStep('analysis', 'Analyzing Contract Terms', [
      'Loading shipper-carrier agreement...',
      'Parsing dwell time charges',
      'Reviewing OTIF requirements',
      'Checking retailer-specific penalties',
    ]);
    await delay(1500);
    updateThinkingStep(step2, {
      content: [
        'Contract loaded successfully',
        `Dwell time: 2hr free, then $50-$75/hr`,
        `OTIF window: 30 minutes`,
        `${retailer} penalties: ${JSON.stringify(DEFAULT_CONTRACT_RULES.retailerChargebacks[retailer as Retailer])}`,
      ],
    });
    completeThinkingStep(step2);

    // Calculate worst case
    const origMins = originalAppointment.split(':').map(Number);
    const worstCaseMins = origMins[0] * 60 + origMins[1] + delayMinutes;
    const worstCaseStr = minutesToTime(worstCaseMins);

    const worstCaseAnalysis = calculateTotalCostImpact(
      {
        originalAppointmentTime: originalAppointment,
        newAppointmentTime: worstCaseStr,
        shipmentValue,
        retailer: retailer as Retailer,
      },
      DEFAULT_CONTRACT_RULES
    );

    // Step 3: Computing impact
    const step3 = addThinkingStep('analysis', 'Computing Financial Impact', [
      'Calculating worst-case scenario...',
      `If truck arrives at ${worstCaseStr} (${delayMinutes}min late):`,
    ]);
    await delay(1000);
    updateThinkingStep(step3, {
      content: [
        `Worst case arrival: ${worstCaseStr}`,
        `Dwell time cost: $${worstCaseAnalysis.calculations.dwellTime?.total || 0}`,
        `OTIF penalties: $${worstCaseAnalysis.calculations.otif?.total || 0}`,
        `TOTAL RISK: $${worstCaseAnalysis.totalCost}`,
      ],
    });
    completeThinkingStep(step3);

    // Create strategy by calculating ACTUAL costs at key time points (generic, not OTIF-specific)
    const strategy = createNegotiationStrategy({
      originalAppointment,
      delayMinutes,
      shipmentValue,
      retailer: retailer as Retailer,
      contractRules: DEFAULT_CONTRACT_RULES,
    });
    setNegotiationStrategy(strategy);

    // Step 4: Strategy - use the calculated thresholds from strategy (not hardcoded)
    const step4 = addThinkingStep('decision', 'Creating Negotiation Strategy', [
      `IDEAL: Before ${strategy.display.idealBefore} (${strategy.thresholds.ideal.costImpact})`,
      `ACCEPTABLE: Before ${strategy.display.acceptableBefore} (${strategy.thresholds.acceptable.costImpact})`,
      `PROBLEMATIC: After ${strategy.display.acceptableBefore} (${strategy.thresholds.problematic.costImpact})`,
      `Max pushback attempts: ${strategy.maxPushbackAttempts}`,
    ]);
    await delay(1200);
    completeThinkingStep(step4);

    // Step 5: Ready to contact
    const step5 = addThinkingStep('action', 'Initiating Warehouse Contact', [
      'Preparing to contact warehouse manager',
      'Ready to negotiate new dock appointment',
      `Mode: ${setupParams.communicationMode === 'voice' ? 'Voice Call' : 'Text Chat'}`,
    ]);
    await delay(800);
    completeThinkingStep(step5);

    // Transition to negotiating
    setWorkflowStage('negotiating');

    // Send initial message in text mode - matches VAPI Mike's greeting
    if (setupParams.communicationMode === 'text') {
      await delay(500);
      addChatMessage(
        'dispatcher',
        `Hey there, this is Mike from Heartland Freight. Who am I speaking with?`
      );
      setConversationPhase('awaiting_name');
    }
  }, [setupParams, addThinkingStep, updateThinkingStep, completeThinkingStep, addChatMessage]);

  // Reset to initial state
  const reset = useCallback(() => {
    setWorkflowStage('setup');
    setConversationPhase('greeting');
    setIsProcessing(false);
    setSetupParams(DEFAULT_SETUP_PARAMS);
    setThinkingSteps([]);
    setExpandedSteps({});
    setActiveStepId(null);
    setChatMessages([]);
    setNegotiationStrategy(null);
    setNegotiationState({ pushbackCount: 0 });
    setCurrentCostAnalysis(null);
    setCurrentEvaluation(null);
    setConfirmedTime(null);
    setConfirmedDock(null);
    setWarehouseManagerName(null);
    setFinalAgreement(null);
  }, []);

  return {
    // Workflow state
    workflowStage,
    conversationPhase,
    isProcessing,

    // Setup
    setupParams,
    updateSetupParams,

    // Thinking steps
    thinkingSteps,
    expandedSteps,
    activeStepId,
    toggleStepExpanded,
    addThinkingStep,
    updateThinkingStep,
    completeThinkingStep,

    // Chat
    chatMessages,
    addChatMessage,

    // Negotiation
    negotiationStrategy,
    negotiationState,
    currentCostAnalysis,
    currentEvaluation,
    incrementPushback,

    // Confirmed details
    confirmedTime,
    confirmedDock,
    confirmedTimeRef,
    confirmedDockRef,
    setConfirmedTime,
    setConfirmedDock,
    warehouseManagerName,
    setWarehouseManagerName,

    // Final agreement
    finalAgreement,
    setFinalAgreement,

    // Actions
    startAnalysis,
    evaluateTimeOffer,
    setConversationPhase,
    setIsProcessing,
    reset,
  };
}
