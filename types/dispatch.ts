// Workflow and UI state types for the Dispatcher AI

/** Workflow stages the app can be in */
export type WorkflowStage =
  | 'setup'              // Initial setup form
  | 'fetching_contract'  // Fetching contract from Google Drive
  | 'analyzing_contract' // Analyzing contract with Claude
  | 'analyzing'          // Computing cost impact (legacy name for backward compat)
  | 'negotiating'        // Active negotiation
  | 'complete';          // Workflow complete

/** Communication mode selection */
export type CommunicationMode = 'text' | 'voice';

/** Voice transport layer: 'web' (browser WebRTC) or 'phone' (Twilio outbound) */
export type VoiceTransport = 'web' | 'phone';

/** Conversation phase during negotiation - matches VAPI assistant flow */
export type ConversationPhase =
  | 'greeting'        // Initial greeting, asking who they're speaking with
  | 'awaiting_name'   // Waiting for warehouse person to give their name
  | 'explaining'      // Explaining the delay situation
  | 'negotiating_time'// Negotiating time slot (using check_slot_cost logic)
  | 'awaiting_dock'   // Got acceptable time, asking for dock number
  | 'confirming'      // Confirming both time and dock
  | 'done'            // Conversation complete
  // Phase 12: Driver Confirmation Coordination
  | 'putting_on_hold'        // Mike says "let me confirm" message to warehouse
  | 'warehouse_on_hold'      // Warehouse call ended, waiting for driver call
  | 'driver_call_connecting' // Driver call is being initiated
  | 'driver_call_active'     // Speaking with driver
  | 'returning_to_warehouse' // (Legacy - not used in sequential approach)
  | 'final_confirmation'     // Driver confirmed, showing success
  | 'driver_failed';         // Driver rejected/timeout, showing failure

/** Supported retailers with specific chargeback rules */
export type Retailer = 'Walmart' | 'Target' | 'Amazon' | 'Costco' | 'Kroger';

// ============================================================================
// AGENTIC UI TYPES - Tool calls, artifacts, and enhanced messages
// ============================================================================

/** Tool call execution status */
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error';

/** Available tool names for the agent */
export type ToolName = 'check_slot_cost' | 'extract_slot' | 'evaluate_offer';

/** Tool call tracking for agentic UI */
export interface ToolCall {
  id: string;
  toolName: ToolName;
  description: string;
  status: ToolCallStatus;
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  result?: {
    summary: string;
    data?: unknown;
  };
  error?: string;
}

/** Artifact types that can be displayed in the side panel */
export type ArtifactType = 'cost-breakdown' | 'strategy' | 'agreement';

/** Artifact panel state */
export interface ArtifactState {
  isOpen: boolean;
  type: ArtifactType | null;
  data: unknown;
}

/** Block expansion state for collapsible UI elements */
export type BlockExpansionState = Record<string, boolean>;

/** Task status for progress tracking */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** Task item for progress tracking */
export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
}

/** Chat message in the conversation - extended for agentic UI */
export interface ChatMessage {
  id?: string;                    // Unique identifier for the message
  role: 'dispatcher' | 'warehouse';
  content: string;
  timestamp: string;
  thinkingSteps?: ThinkingStep[]; // Embedded thinking for agent messages
  toolCalls?: ToolCall[];         // Embedded tool calls for agent messages
  isStreaming?: boolean;          // Whether content is still streaming
  costAnalysis?: import('@/types/cost').TotalCostImpactResult; // Cost analysis attached to warehouse messages that triggered evaluation
  evaluation?: import('@/lib/negotiation-strategy').OfferEvaluation;  // Evaluation of the time offer
}

/** Types of thinking blocks shown in the UI */
export type ThinkingBlockType =
  | 'analysis'
  | 'info'
  | 'action'
  | 'decision'
  | 'success'
  | 'warning'
  | 'error';

/** A thinking step displayed in the reasoning panel */
export interface ThinkingStep {
  id: string;
  type: ThinkingBlockType;
  title: string;
  content: string | string[];
  isActive?: boolean;  // Whether this step is currently being processed
}

/** State for tracking expanded thinking steps */
export type ExpandedStepsState = Record<string, boolean>;

// Re-export HOS types for convenience
import type { HOSWeekRule, HOSPresetKey } from './hos';
export type { HOSWeekRule, HOSPresetKey };

/** Driver HOS input parameters for setup form */
export interface DriverHOSInput {
  /** Remaining driving time in current shift (0-660 minutes / 11 hours) */
  remainingDriveMinutes: number;
  /** Remaining on-duty window time (0-840 minutes / 14 hours) */
  remainingWindowMinutes: number;
  /** Remaining weekly on-duty time (0-3600/4200 minutes for 60/70 hour rules) */
  remainingWeeklyMinutes: number;
  /** Driving time since last qualifying 30-min break (0-480 minutes / 8 hours) */
  minutesSinceLastBreak: number;
  /** Weekly limit rule: 60h/7d or 70h/8d */
  weekRule: HOSWeekRule;
  /** If true, driver is exempt from 30-min break requirement */
  shortHaulExempt: boolean;
}

/** Setup form parameters */
export interface SetupParams {
  delayMinutes: number;
  originalAppointment: string;
  shipmentValue: number;
  communicationMode: CommunicationMode;
  useCachedContract: boolean; // Use cached contract analysis (avoids expensive API calls)

  // Voice transport (when communicationMode is 'voice')
  /** Voice transport layer: 'web' (browser WebRTC) or 'phone' (Twilio outbound) */
  voiceTransport: VoiceTransport;

  // HOS fields (Phase 10)
  /** Enable HOS constraint checking */
  hosEnabled: boolean;
  /** Selected HOS preset */
  hosPreset: HOSPresetKey;
  /** Driver HOS status (when hosEnabled is true) */
  driverHOS?: DriverHOSInput;
  /** Driver detention rate per hour (for next-shift cost calculation) */
  driverDetentionRate: number;
}

/** Negotiation tracking state */
export interface NegotiationState {
  pushbackCount: number;
}

// ============================================================================
// PHASE 12: DRIVER CONFIRMATION COORDINATION TYPES
// ============================================================================

/** Status of the driver confirmation call */
export type DriverCallStatus =
  | 'idle'           // No driver call initiated
  | 'connecting'     // Driver call is being established
  | 'active'         // Driver call is active
  | 'confirmed'      // Driver confirmed the time
  | 'rejected'       // Driver rejected the time
  | 'timeout'        // Driver call timed out (60 seconds)
  | 'failed';        // Driver call failed to connect

/** Result of the driver confirmation attempt */
export type DriverConfirmationResult = 'confirmed' | 'rejected' | 'timeout' | 'failed';

/** Warehouse hold state for simulated hold via VAPI mute */
export interface WarehouseHoldState {
  /** Whether the warehouse call is currently on hold */
  isOnHold: boolean;
  /** Timestamp when hold started (for timeout tracking) */
  holdStartedAt: string | null;
  /** The tentative agreement being confirmed with driver */
  tentativeAgreement: TentativeAgreement | null;
}

/** Tentative agreement reached with warehouse, pending driver confirmation */
export interface TentativeAgreement {
  /** Agreed time slot (24h format, e.g., "15:30") */
  time: string;
  /** Assigned dock number */
  dock: string;
  /** Cost impact at this time */
  costImpact: number;
  /** Warehouse manager name if captured */
  warehouseContact: string | null;
}

/** Driver confirmation state */
export interface DriverConfirmationState {
  /** Current status of the driver call */
  status: DriverCallStatus;
  /** Whether driver confirmation is enabled for this session */
  isEnabled: boolean;
  /** Result of the driver confirmation attempt */
  result: DriverConfirmationResult | null;
  /** Error message if driver call failed */
  error: string | null;
  /** Timestamp when driver call started */
  callStartedAt: string | null;
  /** Remaining seconds before timeout (for UI display) */
  timeoutSecondsRemaining: number | null;
}

/** Final agreement details after successful negotiation */
export interface FinalAgreement {
  date: string;
  originalTime: string;
  newTime: string;
  dock: string;
  delayMinutes: number;
  costImpact: number;
  warehouseContact: string | null;
  status: AgreementStatus;
}

/** Possible statuses for a final agreement */
export type AgreementStatus =
  | 'CONFIRMED'           // Successfully confirmed (with or without driver check)
  | 'DRIVER_UNAVAILABLE'  // Driver rejected or timed out
  | 'DRIVER_CONFIRMED'    // Explicitly confirmed by driver (Phase 12)
  | 'FAILED';             // General failure

/** Confirmed appointment details */
export interface ConfirmedAppointment {
  time: string | null;
  dock: string | null;
}

/** Complete workflow state */
export interface WorkflowState {
  stage: WorkflowStage;
  communicationMode: CommunicationMode;
  conversationPhase: ConversationPhase;
  setupParams: SetupParams;
  thinkingSteps: ThinkingStep[];
  expandedSteps: ExpandedStepsState;
  activeStepId: string | null;
  chatMessages: ChatMessage[];
  negotiationState: NegotiationState;
  confirmed: ConfirmedAppointment;
  warehouseManagerName: string | null;
  finalAgreement: FinalAgreement | null;
  isProcessing: boolean;
  // Agentic UI state
  blockExpansion: BlockExpansionState;  // Track expanded blocks in messages
  artifact: ArtifactState;               // Artifact panel state
  tasks: Task[];                         // Progress tracking
  currentTaskId: string | null;          // Currently active task
  // Phase 12: Driver Confirmation Coordination
  driverConfirmation: DriverConfirmationState;  // Driver call state
  warehouseHold: WarehouseHoldState;            // Warehouse hold state
}

/** Props for the ThinkingBlock component */
export interface ThinkingBlockProps {
  id: string;
  type: ThinkingBlockType;
  title: string;
  content: string | string[];
  isExpanded: boolean;
  onToggle: () => void;
  isActive: boolean;
}

/** Props for the ChatMessage component */
export interface ChatMessageProps {
  role: 'dispatcher' | 'warehouse';
  content: string;
  timestamp: string;
}

/** Extraction result from LLM parsing of warehouse messages */
export interface SlotExtractionResult {
  time: string | null;
  dock: string | null;
  confidence: 'high' | 'medium' | 'low';
  /** Day offset: 0 = today, 1 = tomorrow, 2 = day after tomorrow */
  dayOffset?: number;
  /** Detected date indicator from message (e.g., "tomorrow", "next_day") */
  dateIndicator?: string | null;
}
