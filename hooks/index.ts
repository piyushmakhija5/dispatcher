// Hooks barrel export
export { useDispatchWorkflow, type UseDispatchWorkflowReturn } from './useDispatchWorkflow';
export {
  useCostCalculation,
  formatCost,
  getCostSeverity,
  getCostColorClass,
} from './useCostCalculation';
export {
  useAutoEndCall,
  extractWarehouseManagerName,
} from './useVapiCall';

// Sub-hooks (can be used independently if needed)
export { useThinkingSteps, type UseThinkingStepsReturn } from './useThinkingSteps';
export { useAgenticUI, type UseAgenticUIReturn } from './useAgenticUI';
export { useChatMessages, type UseChatMessagesReturn } from './useChatMessages';
export { useConfirmedDetails, type UseConfirmedDetailsReturn } from './useConfirmedDetails';

// Progressive Disclosure (UI state machine)
export {
  useProgressiveDisclosure,
  type ProgressiveDisclosureConfig,
} from './useProgressiveDisclosure';

// VAPI Voice Call Management
export {
  useVapiVoiceCall,
  type VapiCallStatus,
  type VapiTranscriptData,
  type VapiCallbacks,
  type VapiCallConfig,
  type UseVapiVoiceCallReturn,
} from './useVapiVoiceCall';

// Phase 12: Driver Confirmation Coordination
export {
  useWarehouseHold,
  type UseWarehouseHoldReturn,
} from './useWarehouseHold';
export {
  useDriverCall,
  shouldContinueDriverFlow,
  isDriverFlowComplete,
  isDriverConfirmationSuccessful,
  type UseDriverCallReturn,
} from './useDriverCall';

// Twilio/Phone Transport
export {
  useTwilioCall,
  type UseTwilioCallReturn,
} from './useTwilioCall';
