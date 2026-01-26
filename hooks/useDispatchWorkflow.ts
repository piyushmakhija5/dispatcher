'use client';

import { useState, useCallback } from 'react';

import type {
  WorkflowStage,
  ConversationPhase,
  Retailer,
  SetupParams,
  NegotiationState,
  TentativeAgreement,
  DriverConfirmationState,
  WarehouseHoldState,
  AgreementStatus,
} from '@/types/dispatch';
import type { TotalCostImpactResult } from '@/types/cost';
import type { ExtractedContractTerms } from '@/types/contract';
import {
  createNegotiationStrategy,
  evaluateOffer,
  evaluateOfferMultiDay,
  type NegotiationStrategy,
  type OfferEvaluation,
  type OfferEvaluationMultiDay,
} from '@/lib/negotiation-strategy';
import {
  calculateTotalCostImpactWithTerms,
  calculateTotalCostImpactWithTermsMultiDay,
  convertExtractedTermsToRules,
  validateExtractedTermsForCostCalculation,
} from '@/lib/cost-engine';
import { minutesToTime } from '@/lib/time-parser';
import {
  loadCachedContract,
  saveCachedContract,
} from '@/lib/contract-cache';

// Import sub-hooks
import { useThinkingSteps, type UseThinkingStepsReturn } from './useThinkingSteps';
import { useAgenticUI, type UseAgenticUIReturn } from './useAgenticUI';
import { useChatMessages, type UseChatMessagesReturn } from './useChatMessages';
import { useConfirmedDetails, type UseConfirmedDetailsReturn } from './useConfirmedDetails';
import { useWarehouseHold, type UseWarehouseHoldReturn } from './useWarehouseHold';
import { useDriverCall, type UseDriverCallReturn } from './useDriverCall';

/**
 * Retry configuration for contract operations
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  backoffMs: [1000, 2000],
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
  useCachedContract: true,
  hosEnabled: false,
  hosPreset: 'fresh_shift',
  driverHOS: {
    remainingDriveMinutes: 660,
    remainingWindowMinutes: 840,
    remainingWeeklyMinutes: 4200,
    minutesSinceLastBreak: 0,
    weekRule: '70_in_8',
    shortHaulExempt: false,
  },
  driverDetentionRate: 50,
};

export interface UseDispatchWorkflowReturn extends
  UseThinkingStepsReturn,
  UseAgenticUIReturn,
  UseChatMessagesReturn,
  UseConfirmedDetailsReturn {
  // Workflow state
  workflowStage: WorkflowStage;
  conversationPhase: ConversationPhase;
  isProcessing: boolean;

  // Setup
  setupParams: SetupParams;
  updateSetupParams: (params: Partial<SetupParams>) => void;

  // Contract analysis
  extractedTerms: ExtractedContractTerms | null;
  contractError: string | null;
  contractFileName: string | null;
  partyName: string | null;

  // Negotiation
  negotiationStrategy: NegotiationStrategy | null;
  negotiationState: NegotiationState;
  currentCostAnalysis: TotalCostImpactResult | null;
  currentEvaluation: OfferEvaluation | null;
  incrementPushback: () => void;

  // Phase 12: Driver Confirmation Coordination
  driverConfirmation: DriverConfirmationState;
  warehouseHold: WarehouseHoldState;
  warehouseHoldActions: Omit<UseWarehouseHoldReturn, 'holdState' | 'holdStateRef'>;
  driverCallActions: Omit<UseDriverCallReturn, 'driverState' | 'driverStateRef'>;
  /** Whether driver confirmation is enabled for the current session */
  isDriverConfirmationEnabled: boolean;
  /** Enable/disable driver confirmation */
  setDriverConfirmationEnabled: (enabled: boolean) => void;
  /** Create a tentative agreement from current confirmed details
   * @param overrides - Optional overrides for time/dock if refs haven't been updated yet
   */
  createTentativeAgreement: (overrides?: { time?: string; dock?: string }) => TentativeAgreement | null;

  // Actions
  startAnalysis: () => Promise<void>;
  evaluateTimeOffer: (timeOffered: string, dayOffset?: number) => {
    costAnalysis: TotalCostImpactResult;
    evaluation: OfferEvaluation | OfferEvaluationMultiDay;
  };
  setConversationPhase: (phase: ConversationPhase) => void;
  setIsProcessing: (processing: boolean) => void;
  reset: () => void;
}

export function useDispatchWorkflow(): UseDispatchWorkflowReturn {
  // Compose sub-hooks
  const thinking = useThinkingSteps();
  const agenticUI = useAgenticUI();
  const chat = useChatMessages();
  const confirmed = useConfirmedDetails();

  // Phase 12: Driver Confirmation sub-hooks
  const warehouseHoldHook = useWarehouseHold();
  const driverCallHook = useDriverCall();

  // Workflow state
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('setup');
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>('greeting');
  const [isProcessing, setIsProcessing] = useState(false);

  // Phase 12: Driver confirmation enabled state
  const [isDriverConfirmationEnabled, setDriverConfirmationEnabled] = useState(false);

  // Setup params
  const [setupParams, setSetupParams] = useState<SetupParams>(DEFAULT_SETUP_PARAMS);

  // Contract analysis state
  const [extractedTerms, setExtractedTerms] = useState<ExtractedContractTerms | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractFileName, setContractFileName] = useState<string | null>(null);
  const [partyName, setPartyName] = useState<string | null>(null);

  // Negotiation state
  const [negotiationStrategy, setNegotiationStrategy] = useState<NegotiationStrategy | null>(null);
  const [negotiationState, setNegotiationState] = useState<NegotiationState>({ pushbackCount: 0 });
  const [currentCostAnalysis, setCurrentCostAnalysis] = useState<TotalCostImpactResult | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<OfferEvaluation | null>(null);

  // Setup params update
  const updateSetupParams = useCallback((params: Partial<SetupParams>) => {
    setSetupParams((prev) => ({ ...prev, ...params }));
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
    (timeOffered: string, dayOffset: number = 0) => {
      let costAnalysis: TotalCostImpactResult;

      if (dayOffset > 0) {
        costAnalysis = calculateTotalCostImpactWithTermsMultiDay({
          originalAppointmentTime: setupParams.originalAppointment,
          newAppointmentTime: timeOffered,
          shipmentValue: setupParams.shipmentValue,
          extractedTerms: extractedTerms || undefined,
          partyName: partyName || undefined,
          offeredDayOffset: dayOffset,
        });
      } else if (extractedTerms) {
        costAnalysis = calculateTotalCostImpactWithTerms({
          originalAppointmentTime: setupParams.originalAppointment,
          newAppointmentTime: timeOffered,
          shipmentValue: setupParams.shipmentValue,
          extractedTerms,
          partyName: partyName || undefined,
        });
      } else {
        costAnalysis = calculateTotalCostImpactWithTerms({
          originalAppointmentTime: setupParams.originalAppointment,
          newAppointmentTime: timeOffered,
          shipmentValue: setupParams.shipmentValue,
          extractedTerms: undefined,
          partyName: partyName || undefined,
        });
      }

      setCurrentCostAnalysis(costAnalysis);

      const evaluation = negotiationStrategy
        ? dayOffset > 0
          ? evaluateOfferMultiDay(timeOffered, dayOffset, costAnalysis.totalCost, negotiationStrategy, negotiationState)
          : evaluateOffer(timeOffered, costAnalysis.totalCost, negotiationStrategy, negotiationState)
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
    const { delayMinutes, originalAppointment, shipmentValue, useCachedContract, hosEnabled, driverHOS } = setupParams;

    // Reset contract state
    setContractError(null);
    setExtractedTerms(null);
    setContractFileName(null);
    setPartyName(null);

    // CHECK CACHE FIRST
    if (useCachedContract) {
      const cached = loadCachedContract();
      if (cached) {
        console.log('[Workflow] Using cached contract analysis');

        setWorkflowStage('fetching_contract');
        agenticUI.updateTaskStatus('fetch-contract', 'in_progress');

        const cacheStep = thinking.addThinkingStep('info', 'Using Cached Contract', [
          `✓ Loaded from cache: ${cached.fileName}`,
          `Cached: ${new Date(cached.cachedAt).toLocaleString()}`,
          'Skipping expensive API calls',
        ]);
        await delay(500);
        thinking.completeThinkingStep(cacheStep);
        agenticUI.updateTaskStatus('fetch-contract', 'completed');

        setWorkflowStage('analyzing_contract');
        agenticUI.updateTaskStatus('analyze-contract', 'in_progress');

        const cacheAnalysisStep = thinking.addThinkingStep('success', 'Using Cached Analysis', [
          'Skipping Claude API call (already analyzed)',
          `Parties: ${Object.values(cached.terms.parties).filter(Boolean).join(', ')}`,
          `Confidence: ${cached.terms._meta.confidence.toUpperCase()}`,
        ]);
        await delay(500);
        thinking.completeThinkingStep(cacheAnalysisStep);
        agenticUI.updateTaskStatus('analyze-contract', 'completed');

        setContractFileName(cached.fileName);
        setExtractedTerms(cached.terms);
        const extractedPartyName = cached.terms?.parties?.consignee || cached.terms?.parties?.shipper || null;
        setPartyName(extractedPartyName);

        // Continue to compute impact
        const terms = cached.terms;

        setWorkflowStage('analyzing');
        agenticUI.updateTaskStatus('compute-impact', 'in_progress');

        const origMins = originalAppointment.split(':').map(Number);
        const arrivalMins = origMins[0] * 60 + origMins[1] + delayMinutes;
        const arrivalTimeStr = minutesToTime(arrivalMins);

        const baseCostAnalysis = calculateTotalCostImpactWithTerms({
          originalAppointmentTime: originalAppointment,
          newAppointmentTime: arrivalTimeStr,
          shipmentValue,
          extractedTerms: terms || undefined,
          partyName: extractedPartyName || undefined,
        });
        const contractRulesForStrategy = convertExtractedTermsToRules(terms || undefined, extractedPartyName || undefined);

        const step4 = thinking.addThinkingStep('analysis', 'Computing Financial Impact', [
          'Calculating base delay penalty...',
          `Truck arrives at: ${arrivalTimeStr} (${delayMinutes}min late)`,
        ]);
        await delay(800);

        thinking.updateThinkingStep(step4, {
          type: 'warning',
          content: [
            `Minimum unavoidable cost: $${baseCostAnalysis.totalCost.toLocaleString()}`,
            `Time difference: ${baseCostAnalysis.calculations.timeDifference?.differenceMinutes || 0} min`,
          ],
        });
        thinking.completeThinkingStep(step4);
        agenticUI.updateTaskStatus('compute-impact', 'completed');

        const driverHOSForStrategy = hosEnabled && driverHOS ? {
          remainingDriveMinutes: driverHOS.remainingDriveMinutes,
          remainingWindowMinutes: driverHOS.remainingWindowMinutes,
          remainingWeeklyMinutes: driverHOS.remainingWeeklyMinutes,
          minutesSinceLastBreak: driverHOS.minutesSinceLastBreak,
          shortHaulExempt: driverHOS.shortHaulExempt,
          weekRule: driverHOS.weekRule,
        } : undefined;

        const strategy = createNegotiationStrategy({
          originalAppointment,
          delayMinutes,
          shipmentValue,
          retailer: (extractedPartyName || 'Walmart') as Retailer,
          contractRules: contractRulesForStrategy,
          driverHOS: driverHOSForStrategy,
        });
        setNegotiationStrategy(strategy);
        setCurrentCostAnalysis(baseCostAnalysis);

        const strategySteps = [
          `IDEAL: ${strategy.thresholds.ideal.description}`,
          `ACCEPTABLE: ${strategy.thresholds.acceptable.description}`,
          `PROBLEMATIC: ${strategy.thresholds.problematic.description}`,
        ];
        if (strategy.hosConstraints) {
          strategySteps.push(`HOS Limit: ${strategy.hosConstraints.latestFeasibleTime} (${strategy.hosConstraints.bindingConstraint})`);
        }

        const step5 = thinking.addThinkingStep('success', 'Strategy Computed', strategySteps);
        await delay(500);
        thinking.completeThinkingStep(step5);

        setWorkflowStage('negotiating');
        agenticUI.updateTaskStatus('contact', 'in_progress');

        return; // Cache hit - exit early
      }
    }

    // PHASE 1: Fetch Contract
    setWorkflowStage('fetching_contract');
    agenticUI.updateTaskStatus('fetch-contract', 'in_progress');

    const step1 = thinking.addThinkingStep('info', 'Delay Detected', [
      `Truck running ${delayMinutes} minutes late`,
      `Original appointment: ${originalAppointment}`,
      `Shipment value: $${shipmentValue.toLocaleString()}`,
    ]);
    await delay(500);
    thinking.completeThinkingStep(step1);

    const step2 = thinking.addThinkingStep('analysis', 'Fetching Contract', [
      'Connecting to Google Drive...',
      'Locating shipper-carrier agreement...',
    ]);

    let fetchedContent: string | null = null;
    let fetchedContentType: 'pdf' | 'text' = 'text';
    let fetchedFileName: string = 'Unknown';
    let fetchedFileId: string = '';
    let fetchedModifiedTime: string = '';

    try {
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
          thinking.updateThinkingStep(step2, {
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
      fetchedFileId = fetchData.file?.id || '';
      fetchedModifiedTime = fetchData.file?.modifiedTime || new Date().toISOString();
      setContractFileName(fetchedFileName);

      thinking.updateThinkingStep(step2, {
        content: [
          'Connected to Google Drive ✓',
          `Found: ${fetchedFileName}`,
          `Type: ${fetchedContentType.toUpperCase()}`,
        ],
      });
      thinking.completeThinkingStep(step2);
      agenticUI.updateTaskStatus('fetch-contract', 'completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setContractError(errorMsg);

      thinking.updateThinkingStep(step2, {
        type: 'error',
        content: [
          '❌ Failed to fetch contract from Google Drive',
          `Error: ${errorMsg}`,
          '⚠️ Cannot proceed without contract',
        ],
      });
      thinking.completeThinkingStep(step2);
      agenticUI.updateTaskStatus('fetch-contract', 'failed');
      setWorkflowStage('setup');
      return;
    }

    // PHASE 2: Analyze Contract
    setWorkflowStage('analyzing_contract');
    agenticUI.updateTaskStatus('analyze-contract', 'in_progress');

    let terms: ExtractedContractTerms | null = null;
    let extractedPartyName: string | null = null;

    const step3 = thinking.addThinkingStep('analysis', 'Analyzing Contract Terms', [
      'Sending to Claude for analysis...',
      'Extracting penalty structures...',
      'Identifying parties...',
    ]);

    try {
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
          thinking.updateThinkingStep(step3, {
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

      extractedPartyName = terms?.parties?.consignee || terms?.parties?.shipper || null;
      setPartyName(extractedPartyName);

      const validation = validateExtractedTermsForCostCalculation(terms ?? undefined);

      const partyList = Object.entries(terms?.parties || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 3);

      const penaltySummary = terms?.delayPenalties?.[0];
      const dwellInfo = penaltySummary
        ? `${penaltySummary.freeTimeMinutes / 60}hr free, then tiered rates`
        : 'No dwell penalties found';

      const otifWindow = terms?.complianceWindows?.[0]?.windowMinutes || 30;

      thinking.updateThinkingStep(step3, {
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
      thinking.completeThinkingStep(step3);
      agenticUI.updateTaskStatus('analyze-contract', 'completed');

      // Save to cache
      if (terms && fetchedContent && fetchedFileId) {
        try {
          saveCachedContract({
            fileId: fetchedFileId,
            fileName: fetchedFileName,
            modifiedTime: fetchedModifiedTime,
            content: fetchedContent,
            contentType: fetchedContentType,
            terms,
          });
        } catch (cacheError) {
          console.warn('[Workflow] Failed to save to cache:', cacheError);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setContractError(errorMsg);

      thinking.updateThinkingStep(step3, {
        type: 'error',
        content: [
          '❌ Failed to analyze contract',
          `Error: ${errorMsg}`,
          '⚠️ Cannot proceed without contract analysis',
        ],
      });
      thinking.completeThinkingStep(step3);
      agenticUI.updateTaskStatus('analyze-contract', 'failed');
      setWorkflowStage('setup');
      return;
    }

    // PHASE 3: Compute Financial Impact
    setWorkflowStage('analyzing');
    agenticUI.updateTaskStatus('compute-impact', 'in_progress');

    const origMins = originalAppointment.split(':').map(Number);
    const arrivalMins = origMins[0] * 60 + origMins[1] + delayMinutes;
    const arrivalTimeStr = minutesToTime(arrivalMins);

    const baseCostAnalysis = calculateTotalCostImpactWithTerms({
      originalAppointmentTime: originalAppointment,
      newAppointmentTime: arrivalTimeStr,
      shipmentValue,
      extractedTerms: terms || undefined,
      partyName: extractedPartyName || undefined,
    });
    const contractRulesForStrategy = convertExtractedTermsToRules(terms || undefined, extractedPartyName || undefined);

    const step4 = thinking.addThinkingStep('analysis', 'Computing Financial Impact', [
      'Calculating base delay penalty...',
      `Truck arrives at: ${arrivalTimeStr} (${delayMinutes}min late)`,
    ]);
    await delay(800);
    thinking.updateThinkingStep(step4, {
      content: [
        `Earliest dock time: ${arrivalTimeStr}`,
        `Dwell time cost: $${baseCostAnalysis.calculations.dwellTime?.total || 0}`,
        `OTIF penalties: $${baseCostAnalysis.calculations.otif?.total || 0}`,
        `Minimum unavoidable cost: $${baseCostAnalysis.totalCost}`,
      ],
    });
    thinking.completeThinkingStep(step4);
    agenticUI.updateTaskStatus('compute-impact', 'completed');

    const driverHOSForStrategy = hosEnabled && driverHOS ? {
      remainingDriveMinutes: driverHOS.remainingDriveMinutes,
      remainingWindowMinutes: driverHOS.remainingWindowMinutes,
      remainingWeeklyMinutes: driverHOS.remainingWeeklyMinutes,
      minutesSinceLastBreak: driverHOS.minutesSinceLastBreak,
      shortHaulExempt: driverHOS.shortHaulExempt,
      weekRule: driverHOS.weekRule,
    } : undefined;

    const strategy = createNegotiationStrategy({
      originalAppointment,
      delayMinutes,
      shipmentValue,
      retailer: (extractedPartyName || 'Walmart') as Retailer,
      contractRules: contractRulesForStrategy,
      driverHOS: driverHOSForStrategy,
    });
    setNegotiationStrategy(strategy);

    const strategySteps = [
      `IDEAL: Before ${strategy.display.idealBefore} (${strategy.thresholds.ideal.costImpact})`,
      `ACCEPTABLE: Before ${strategy.display.acceptableBefore} (${strategy.thresholds.acceptable.costImpact})`,
      `PROBLEMATIC: After ${strategy.display.acceptableBefore} (${strategy.thresholds.problematic.costImpact})`,
      `Max pushback attempts: ${strategy.maxPushbackAttempts}`,
    ];

    const step5 = thinking.addThinkingStep('decision', 'Creating Negotiation Strategy', strategySteps);
    await delay(800);
    thinking.completeThinkingStep(step5);

    const step6 = thinking.addThinkingStep('action', 'Initiating Warehouse Contact', [
      'Preparing to contact warehouse manager',
      'Ready to negotiate new dock appointment',
      `Mode: ${setupParams.communicationMode === 'voice' ? 'Voice Call' : 'Text Chat'}`,
      extractedPartyName ? `Contact: ${extractedPartyName}` : '',
    ].filter(Boolean));
    await delay(500);
    thinking.completeThinkingStep(step6);

    agenticUI.updateTaskStatus('contact', 'in_progress');
    setWorkflowStage('negotiating');

    if (setupParams.communicationMode === 'text') {
      await delay(500);
      chat.addChatMessage(
        'dispatcher',
        `Hey there, this is Mike from Heartland Freight. Who am I speaking with?`
      );
      setConversationPhase('awaiting_name');
    }
  }, [setupParams, thinking, agenticUI, chat]);

  // Phase 12: Create tentative agreement from current confirmed details
  // Accepts optional overrides for cases where refs haven't synced yet (React async state)
  const createTentativeAgreement = useCallback((overrides?: { time?: string; dock?: string }): TentativeAgreement | null => {
    // Use overrides if provided, otherwise fall back to refs
    const time = overrides?.time || confirmed.confirmedTimeRef.current;
    const dock = overrides?.dock || confirmed.confirmedDockRef.current;
    const cost = currentCostAnalysis?.totalCost ?? 0;
    const contact = confirmed.warehouseManagerNameRef.current;

    if (!time || !dock) {
      console.log('[Workflow] Cannot create tentative agreement - missing time or dock', {
        time,
        dock,
        overrides,
        refTime: confirmed.confirmedTimeRef.current,
        refDock: confirmed.confirmedDockRef.current,
      });
      return null;
    }

    const tentative: TentativeAgreement = {
      time,
      dock,
      costImpact: cost,
      warehouseContact: contact,
    };

    console.log('[Workflow] Created tentative agreement:', tentative);
    return tentative;
  }, [confirmed, currentCostAnalysis]);

  // Reset to initial state
  const reset = useCallback(() => {
    setWorkflowStage('setup');
    setConversationPhase('greeting');
    setIsProcessing(false);
    setSetupParams(DEFAULT_SETUP_PARAMS);
    setNegotiationStrategy(null);
    setNegotiationState({ pushbackCount: 0 });
    setCurrentCostAnalysis(null);
    setCurrentEvaluation(null);
    setExtractedTerms(null);
    setContractError(null);
    setContractFileName(null);
    setPartyName(null);
    // Reset sub-hooks
    thinking.resetThinkingSteps();
    agenticUI.resetAgenticUI();
    chat.resetChatMessages();
    confirmed.resetConfirmedDetails();
    // Phase 12: Reset driver confirmation and warehouse hold
    setDriverConfirmationEnabled(false);
    warehouseHoldHook.resetHoldState();
    driverCallHook.resetDriverState();
  }, [thinking, agenticUI, chat, confirmed, warehouseHoldHook, driverCallHook]);

  return {
    // Workflow state
    workflowStage,
    conversationPhase,
    isProcessing,

    // Setup
    setupParams,
    updateSetupParams,

    // Contract analysis
    extractedTerms,
    contractError,
    contractFileName,
    partyName,

    // Thinking steps (spread from sub-hook)
    ...thinking,

    // Chat (spread from sub-hook)
    ...chat,

    // Confirmed details (spread from sub-hook)
    ...confirmed,

    // Agentic UI (spread from sub-hook)
    ...agenticUI,

    // Negotiation
    negotiationStrategy,
    negotiationState,
    currentCostAnalysis,
    currentEvaluation,
    incrementPushback,

    // Phase 12: Driver Confirmation Coordination
    driverConfirmation: driverCallHook.driverState,
    warehouseHold: warehouseHoldHook.holdState,
    warehouseHoldActions: {
      putOnHold: warehouseHoldHook.putOnHold,
      resumeFromHold: warehouseHoldHook.resumeFromHold,
      isHoldTimedOut: warehouseHoldHook.isHoldTimedOut,
      getRemainingHoldSeconds: warehouseHoldHook.getRemainingHoldSeconds,
      resetHoldState: warehouseHoldHook.resetHoldState,
    },
    driverCallActions: {
      startDriverCall: driverCallHook.startDriverCall,
      endDriverCall: driverCallHook.endDriverCall,
      setDriverConfirmed: driverCallHook.setDriverConfirmed,
      setDriverRejected: driverCallHook.setDriverRejected,
      resetDriverState: driverCallHook.resetDriverState,
      registerCallbacks: driverCallHook.registerCallbacks,
    },
    isDriverConfirmationEnabled,
    setDriverConfirmationEnabled,
    createTentativeAgreement,

    // Actions
    startAnalysis,
    evaluateTimeOffer,
    setConversationPhase,
    setIsProcessing,
    reset,
  };
}
