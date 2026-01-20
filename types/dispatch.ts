// Workflow and UI state types for the Dispatcher AI

/** Workflow stages the app can be in */
export type WorkflowStage = 'setup' | 'analyzing' | 'negotiating' | 'complete';

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

/** Chat message in the conversation */
export interface ChatMessage {
  role: 'dispatcher' | 'warehouse';
  content: string;
  timestamp: string;
}

/** Types of thinking blocks shown in the UI */
export type ThinkingBlockType =
  | 'analysis'
  | 'info'
  | 'action'
  | 'decision'
  | 'success'
  | 'warning';

/** A thinking step displayed in the reasoning panel */
export interface ThinkingStep {
  id: string;
  type: ThinkingBlockType;
  title: string;
  content: string | string[];
}

/** State for tracking expanded thinking steps */
export type ExpandedStepsState = Record<string, boolean>;

/** Setup form parameters */
export interface SetupParams {
  delayMinutes: number;
  originalAppointment: string;
  shipmentValue: number;
  retailer: Retailer;
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
