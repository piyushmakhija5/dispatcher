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

/** Conversation phase during negotiation - matches VAPI assistant flow */
export type ConversationPhase =
  | 'greeting'        // Initial greeting, asking who they're speaking with
  | 'awaiting_name'   // Waiting for warehouse person to give their name
  | 'explaining'      // Explaining the delay situation
  | 'negotiating_time'// Negotiating time slot (using check_slot_cost logic)
  | 'awaiting_dock'   // Got acceptable time, asking for dock number
  | 'confirming'      // Confirming both time and dock
  | 'done';           // Conversation complete

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

/** Setup form parameters */
export interface SetupParams {
  delayMinutes: number;
  originalAppointment: string;
  shipmentValue: number;
  communicationMode: CommunicationMode;
}

/** Negotiation tracking state */
export interface NegotiationState {
  pushbackCount: number;
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
  status: 'CONFIRMED';
}

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
}
