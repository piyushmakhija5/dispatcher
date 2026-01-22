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
  ArtifactState,
  ArtifactType,
  BlockExpansionState,
  Task,
  TaskStatus,
  ToolCall,
} from '@/types/dispatch';
import type { TotalCostImpactResult } from '@/types/cost';
import type { ExtractedContractTerms } from '@/types/contract';
import {
  createNegotiationStrategy,
  evaluateOffer,
  type NegotiationStrategy,
  type OfferEvaluation,
} from '@/lib/negotiation-strategy';
import {
  calculateTotalCostImpact,
  calculateTotalCostImpactWithTerms,
  convertExtractedTermsToRules,
  validateExtractedTermsForCostCalculation,
} from '@/lib/cost-engine';
import { minutesToTime } from '@/lib/time-parser';

/**
 * Retry configuration for contract operations
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  backoffMs: [1000, 2000], // Exponential backoff: 1s, 2s
};

/**
 * Execute an async operation with exponential backoff retry
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  config: { maxRetries: number; backoffMs: number[] },
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < config.maxRetries) {
        const backoffTime = config.backoffMs[attempt] || config.backoffMs[config.backoffMs.length - 1];
        onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }
  
  throw lastError;
}

/** Initial setup parameters */
const DEFAULT_SETUP_PARAMS: SetupParams = {
  delayMinutes: 90,
  originalAppointment: '14:00',
  shipmentValue: 50000,
  communicationMode: 'voice',
};

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

export interface UseDispatchWorkflowReturn {
  // Workflow state
  workflowStage: WorkflowStage;
  conversationPhase: ConversationPhase;
  isProcessing: boolean;

  // Setup
  setupParams: SetupParams;
  updateSetupParams: (params: Partial<SetupParams>) => void;

  // Contract analysis (Phase 7.6)
  extractedTerms: ExtractedContractTerms | null;
  contractError: string | null;
  contractFileName: string | null;
  partyName: string | null;  // Extracted consignee/party for cost calculations

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
  addAgentMessage: (
    content: string,
    options?: {
      thinkingSteps?: ThinkingStep[];
      toolCalls?: ToolCall[];
    }
  ) => string;
  updateMessageToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;

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

  // Agentic UI: Block expansion
  blockExpansion: BlockExpansionState;
  toggleBlockExpansion: (blockId: string) => void;

  // Agentic UI: Artifact panel
  artifact: ArtifactState;
  openArtifact: (type: ArtifactType, data: unknown) => void;
  closeArtifact: () => void;

  // Agentic UI: Task progress
  tasks: Task[];
  currentTaskId: string | null;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;

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

  // Contract analysis state (Phase 7.6)
  const [extractedTerms, setExtractedTerms] = useState<ExtractedContractTerms | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractFileName, setContractFileName] = useState<string | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);

  // Agentic UI state
  const [blockExpansion, setBlockExpansion] = useState<BlockExpansionState>({});
  const [artifact, setArtifact] = useState<ArtifactState>(DEFAULT_ARTIFACT_STATE);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

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
    // Auto-collapse when completing
    setExpandedSteps((prev) => ({ ...prev, [id]: false }));
    setActiveStepId((current) => (current === id ? null : current));
  }, []);

  // Chat message management
  const addChatMessage = useCallback(
    (role: 'dispatcher' | 'warehouse', content: string) => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setChatMessages((prev) => [
        ...prev,
        { id, role, content, timestamp: new Date().toLocaleTimeString() },
      ]);
    },
    []
  );

  // Add agent message with embedded thinking/tool calls
  const addAgentMessage = useCallback(
    (
      content: string,
      options?: {
        thinkingSteps?: ThinkingStep[];
        toolCalls?: ToolCall[];
      }
    ): string => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id,
          role: 'dispatcher' as const,
          content,
          timestamp: new Date().toLocaleTimeString(),
          thinkingSteps: options?.thinkingSteps,
          toolCalls: options?.toolCalls,
        },
      ]);
      return id;
    },
    []
  );

  // Update a tool call within a message
  const updateMessageToolCall = useCallback(
    (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => {
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId || !msg.toolCalls) return msg;
          return {
            ...msg,
            toolCalls: msg.toolCalls.map((tc) =>
              tc.id === toolCallId ? { ...tc, ...updates } : tc
            ),
          };
        })
      );
    },
    []
  );

  // Agentic UI: Block expansion
  const toggleBlockExpansion = useCallback((blockId: string) => {
    setBlockExpansion((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  }, []);

  // Agentic UI: Artifact panel
  const openArtifact = useCallback((type: ArtifactType, data: unknown) => {
    setArtifact({ isOpen: true, type, data });
  }, []);

  const closeArtifact = useCallback(() => {
    setArtifact((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Agentic UI: Task progress
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
      // Phase 7.6: Use extracted contract terms if available
      let costAnalysis: TotalCostImpactResult;

      if (extractedTerms) {
        // Use dynamically extracted contract terms
        costAnalysis = calculateTotalCostImpactWithTerms({
          originalAppointmentTime: setupParams.originalAppointment,
          newAppointmentTime: timeOffered,
          shipmentValue: setupParams.shipmentValue,
          extractedTerms,
          partyName: partyName || undefined,
        });
        console.log('[Workflow] Using extracted contract terms for cost calculation');
      } else {
        // No extracted terms - use empty rules (missing sections = $0 cost)
        // We do NOT use fake "default" values as that would lead to incorrect analysis
        costAnalysis = calculateTotalCostImpactWithTerms({
          originalAppointmentTime: setupParams.originalAppointment,
          newAppointmentTime: timeOffered,
          shipmentValue: setupParams.shipmentValue,
          extractedTerms: undefined, // This will use empty rules
          partyName: partyName || undefined,
        });
        console.log('[Workflow] No extracted terms - using empty rules (costs based only on available data)');
      }

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
    [setupParams, negotiationStrategy, negotiationState, extractedTerms, partyName]
  );

  // Helper for delay
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Start analysis workflow
  const startAnalysis = useCallback(async () => {
    const { delayMinutes, originalAppointment, shipmentValue } = setupParams;

    // Reset contract state at start
    setContractError(null);
    setExtractedTerms(null);
    setContractFileName(null);
    setPartyName(null);

    // ========================================
    // PHASE 1: Fetch Contract from Google Drive
    // ========================================
    setWorkflowStage('fetching_contract');
    updateTaskStatus('fetch-contract', 'in_progress');

    // Step 1: Delay detected
    const step1 = addThinkingStep('info', 'Delay Detected', [
      `Truck running ${delayMinutes} minutes late`,
      `Original appointment: ${originalAppointment}`,
      `Shipment value: $${shipmentValue.toLocaleString()}`,
    ]);
    await delay(500);
    completeThinkingStep(step1);

    // Step 2: Fetching contract (with retry)
    const step2 = addThinkingStep('analysis', 'Fetching Contract', [
      'Connecting to Google Drive...',
      'Locating shipper-carrier agreement...',
    ]);

    let fetchedContent: string | null = null;
    let fetchedContentType: 'pdf' | 'text' = 'text';
    let fetchedFileName: string = 'Unknown';
    let fetchFailed = false;

    try {
      console.log('[Workflow] Fetching contract from Google Drive...');
      
      const fetchData = await withRetry(
        async () => {
          const fetchResponse = await fetch('/api/contract/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await fetchResponse.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to fetch contract');
          }
          return data;
        },
        RETRY_CONFIG,
        (attempt, error) => {
          console.log(`[Workflow] Contract fetch attempt ${attempt} failed: ${error.message}, retrying...`);
          updateThinkingStep(step2, {
            content: [
              'Connecting to Google Drive...',
              `Attempt ${attempt} failed: ${error.message}`,
              `Retrying in ${RETRY_CONFIG.backoffMs[attempt - 1] / 1000}s...`,
            ],
          });
        }
      );

      fetchedContent = fetchData.content;
      fetchedContentType = fetchData.contentType;
      fetchedFileName = fetchData.file?.name || 'Unknown';
      setContractFileName(fetchedFileName);

      updateThinkingStep(step2, {
        content: [
          'Connected to Google Drive ✓',
          `Found: ${fetchedFileName}`,
          `Type: ${fetchedContentType.toUpperCase()}`,
        ],
      });
      completeThinkingStep(step2);
      updateTaskStatus('fetch-contract', 'completed');
      console.log(`[Workflow] Contract fetched: ${fetchedFileName}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Workflow] Contract fetch failed after all retries:', errorMsg);
      setContractError(errorMsg);
      fetchFailed = true;

      updateThinkingStep(step2, {
        type: 'error',
        content: [
          '❌ Failed to fetch contract from Google Drive',
          `Error: ${errorMsg}`,
          'Tried 3 times with exponential backoff',
          '',
          '⚠️ Cannot proceed without contract',
        ],
      });
      completeThinkingStep(step2);
      updateTaskStatus('fetch-contract', 'failed');
      
      // STOP the workflow - we cannot proceed without a contract
      setWorkflowStage('setup');
      return;
    }

    // ========================================
    // PHASE 2: Analyze Contract with Claude (with retry)
    // ========================================
    setWorkflowStage('analyzing_contract');
    updateTaskStatus('analyze-contract', 'in_progress');

    let terms: ExtractedContractTerms | null = null;
    let extractedPartyName: string | null = null;

    const step3 = addThinkingStep('analysis', 'Analyzing Contract Terms', [
      'Sending to Claude for analysis...',
      'Extracting penalty structures...',
      'Identifying parties...',
    ]);

    try {
      console.log('[Workflow] Analyzing contract with Claude...');
      
      const analyzeData = await withRetry(
        async () => {
          const analyzeResponse = await fetch('/api/contract/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: fetchedContent,
              contentType: fetchedContentType,
              fileName: fetchedFileName,
            }),
          });
          const data = await analyzeResponse.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to analyze contract');
          }
          return data;
        },
        RETRY_CONFIG,
        (attempt, error) => {
          console.log(`[Workflow] Contract analysis attempt ${attempt} failed: ${error.message}, retrying...`);
          updateThinkingStep(step3, {
            content: [
              'Analyzing contract with Claude...',
              `Attempt ${attempt} failed: ${error.message}`,
              `Retrying in ${RETRY_CONFIG.backoffMs[attempt - 1] / 1000}s...`,
            ],
          });
        }
      );

      terms = analyzeData.terms;
      setExtractedTerms(terms);

      // Extract party name (prefer consignee, then shipper)
      extractedPartyName = terms?.parties?.consignee || terms?.parties?.shipper || null;
      setPartyName(extractedPartyName);

      // Validate extracted terms (convert null to undefined for type compatibility)
      const validation = validateExtractedTermsForCostCalculation(terms ?? undefined);

      // Build analysis summary
      const partyList = Object.entries(terms?.parties || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 3);

      const penaltySummary = terms?.delayPenalties?.[0];
      const dwellInfo = penaltySummary
        ? `${penaltySummary.freeTimeMinutes / 60}hr free, then tiered rates`
        : 'No dwell penalties found';

      const otifWindow = terms?.complianceWindows?.[0]?.windowMinutes || 30;

      updateThinkingStep(step3, {
        type: validation.valid ? 'success' : 'warning',
        content: [
          `Contract analyzed successfully ✓`,
          `Parties: ${partyList.join(', ') || 'Not specified'}`,
          `Dwell time: ${dwellInfo}`,
          `OTIF window: ±${otifWindow} minutes`,
          `Confidence: ${terms?._meta?.confidence?.toUpperCase() || 'UNKNOWN'}`,
          ...(validation.warnings.length > 0 ? [`⚠ ${validation.warnings.length} warnings`] : []),
        ],
      });
      completeThinkingStep(step3);
      updateTaskStatus('analyze-contract', 'completed');

      console.log('[Workflow] Contract analysis complete:', {
        parties: terms?.parties,
        delayPenalties: terms?.delayPenalties?.length || 0,
        partyPenalties: terms?.partyPenalties?.length || 0,
        confidence: terms?._meta?.confidence,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Workflow] Contract analysis failed after all retries:', errorMsg);
      setContractError(errorMsg);

      updateThinkingStep(step3, {
        type: 'error',
        content: [
          '❌ Failed to analyze contract',
          `Error: ${errorMsg}`,
          'Tried 3 times with exponential backoff',
          '',
          '⚠️ Cannot proceed without contract analysis',
        ],
      });
      completeThinkingStep(step3);
      updateTaskStatus('analyze-contract', 'failed');
      
      // STOP the workflow - we cannot proceed without contract analysis
      setWorkflowStage('setup');
      return;
    }

    // ========================================
    // PHASE 3: Compute Financial Impact
    // ========================================
    setWorkflowStage('analyzing');
    updateTaskStatus('compute-impact', 'in_progress');

    // Calculate worst case using extracted terms or defaults
    const origMins = originalAppointment.split(':').map(Number);
    const worstCaseMins = origMins[0] * 60 + origMins[1] + delayMinutes;
    const worstCaseStr = minutesToTime(worstCaseMins);

    let worstCaseAnalysis: TotalCostImpactResult;
    let contractRulesForStrategy;

    // Calculate cost impact using extracted terms (or empty rules if none)
    // NOTE: We do NOT use fake "default" values - missing data = $0 cost for that category
    worstCaseAnalysis = calculateTotalCostImpactWithTerms({
      originalAppointmentTime: originalAppointment,
      newAppointmentTime: worstCaseStr,
      shipmentValue,
      extractedTerms: terms || undefined,
      partyName: extractedPartyName || undefined,
    });
    contractRulesForStrategy = convertExtractedTermsToRules(terms || undefined, extractedPartyName || undefined);
    
    if (terms) {
      console.log('[Workflow] Using extracted contract terms for cost calculation');
    } else {
      console.log('[Workflow] No extracted terms - costs based only on available data (missing = $0)');
    }

    // Step: Computing impact
    const step4 = addThinkingStep('analysis', 'Computing Financial Impact', [
      'Calculating worst-case scenario...',
      `If truck arrives at ${worstCaseStr} (${delayMinutes}min late):`,
    ]);
    await delay(800);
    updateThinkingStep(step4, {
      content: [
        `Worst case arrival: ${worstCaseStr}`,
        `Dwell time cost: $${worstCaseAnalysis.calculations.dwellTime?.total || 0}`,
        `OTIF penalties: $${worstCaseAnalysis.calculations.otif?.total || 0}`,
        `TOTAL RISK: $${worstCaseAnalysis.totalCost}`,
      ],
    });
    completeThinkingStep(step4);
    updateTaskStatus('compute-impact', 'completed');

    // Create negotiation strategy with appropriate contract rules
    const strategy = createNegotiationStrategy({
      originalAppointment,
      delayMinutes,
      shipmentValue,
      retailer: (extractedPartyName || 'Walmart') as Retailer,
      contractRules: contractRulesForStrategy,
    });
    setNegotiationStrategy(strategy);

    // Step: Strategy
    const step5 = addThinkingStep('decision', 'Creating Negotiation Strategy', [
      `IDEAL: Before ${strategy.display.idealBefore} (${strategy.thresholds.ideal.costImpact})`,
      `ACCEPTABLE: Before ${strategy.display.acceptableBefore} (${strategy.thresholds.acceptable.costImpact})`,
      `PROBLEMATIC: After ${strategy.display.acceptableBefore} (${strategy.thresholds.problematic.costImpact})`,
      `Max pushback attempts: ${strategy.maxPushbackAttempts}`,
    ]);
    await delay(800);
    completeThinkingStep(step5);

    // Step: Ready to contact
    const step6 = addThinkingStep('action', 'Initiating Warehouse Contact', [
      'Preparing to contact warehouse manager',
      'Ready to negotiate new dock appointment',
      `Mode: ${setupParams.communicationMode === 'voice' ? 'Voice Call' : 'Text Chat'}`,
      extractedPartyName ? `Contact: ${extractedPartyName}` : '',
    ].filter(Boolean));
    await delay(500);
    completeThinkingStep(step6);

    // Mark contact starting
    updateTaskStatus('contact', 'in_progress');

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
  }, [setupParams, addThinkingStep, updateThinkingStep, completeThinkingStep, addChatMessage, updateTaskStatus]);

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
    // Reset contract state (Phase 7.6)
    setExtractedTerms(null);
    setContractError(null);
    setContractFileName(null);
    setPartyName(null);
    // Reset agentic UI state
    setBlockExpansion({});
    setArtifact(DEFAULT_ARTIFACT_STATE);
    setTasks(INITIAL_TASKS);
    setCurrentTaskId(null);
  }, []);

  return {
    // Workflow state
    workflowStage,
    conversationPhase,
    isProcessing,

    // Setup
    setupParams,
    updateSetupParams,

    // Contract analysis (Phase 7.6)
    extractedTerms,
    contractError,
    contractFileName,
    partyName,

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
    addAgentMessage,
    updateMessageToolCall,

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

    // Agentic UI: Block expansion
    blockExpansion,
    toggleBlockExpansion,

    // Agentic UI: Artifact panel
    artifact,
    openArtifact,
    closeArtifact,

    // Agentic UI: Task progress
    tasks,
    currentTaskId,
    updateTaskStatus,

    // Actions
    startAnalysis,
    evaluateTimeOffer,
    setConversationPhase,
    setIsProcessing,
    reset,
  };
}
