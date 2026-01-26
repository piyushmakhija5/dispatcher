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
