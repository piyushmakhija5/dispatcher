// VAPI (Voice API) types for the Dispatcher AI

/** Status of a VAPI voice call */
export type VapiCallStatus = 'idle' | 'connecting' | 'active' | 'ended';

/** VAPI event types */
export type VapiEventType =
  | 'call-start'
  | 'call-end'
  | 'speech-start'
  | 'speech-end'
  | 'speech-update'
  | 'message'
  | 'error';

/** Role in a VAPI transcript */
export type VapiTranscriptRole = 'user' | 'assistant';

/** Type of transcript (partial or final) */
export type VapiTranscriptType = 'partial' | 'final';

/** VAPI transcript message */
export interface VapiTranscriptMessage {
  type: 'transcript';
  transcriptType: VapiTranscriptType;
  role: VapiTranscriptRole;
  transcript: string;
}

/** Generic VAPI message (can be extended) */
export interface VapiMessage {
  type: string;
  [key: string]: unknown;
}

/** VAPI error event */
export interface VapiError {
  message: string;
  code?: string;
  [key: string]: unknown;
}

/** Dynamic variables passed to VAPI warehouse assistant */
export interface VapiVariableValues {
  original_appointment: string;
  delay_minutes: string;
  shipment_value: string;
  retailer: string;
}

/** Variables passed specifically to the driver confirmation assistant (Phase 12) */
export interface VapiDriverVariableValues {
  /** The tentative time being confirmed (12h format for speech) */
  proposed_time: string;
  /** The tentative time in 24h format */
  proposed_time_24h: string;
  /** The dock number being confirmed */
  proposed_dock: string;
  /** The warehouse name/facility */
  warehouse_name: string;
  /** Original appointment time */
  original_appointment: string;
  /** Driver's remaining HOS window (if HOS enabled) */
  hos_remaining_window?: string;
}

/** Options for starting a VAPI call */
export interface VapiStartOptions {
  variableValues: VapiVariableValues | VapiDriverVariableValues;
}

/** Transcript data passed to handlers */
export interface VapiTranscriptData {
  role: 'warehouse' | 'dispatcher';
  content: string;
  timestamp: string;
}

/** Props for the VapiCallInterface component */
export interface VapiCallInterfaceProps {
  onTranscript: (data: VapiTranscriptData) => void;
  onCallEnd: () => void;
  onCallStatusChange: (
    status: VapiCallStatus,
    endCallFn: () => void,
    speakMessageFn: (message: string) => void
  ) => void;
  assistantId: string;
  isActive: boolean;
  originalAppointment: string;
  delayMinutes: number;
  shipmentValue: number;
  retailer: string;
  /** Called when assistant starts speaking */
  onAssistantSpeechStart?: () => void;
  /** Called when assistant finishes speaking */
  onAssistantSpeechEnd?: () => void;
}

// ============================================================================
// PHASE 12: VAPI CONTROL MESSAGE TYPES
// ============================================================================

/** Control actions that can be sent to VAPI */
export type VapiControlAction =
  | 'mute-assistant'     // Mute the assistant's audio output
  | 'unmute-assistant';  // Unmute the assistant's audio output

/** Control message sent via VAPI send() method */
export interface VapiControlMessage {
  type: 'control';
  control: VapiControlAction;
}

/** Generic message that can be sent via VAPI send() method */
export type VapiSendMessage = VapiControlMessage;

/** VAPI client interface (subset of @vapi-ai/web) */
export interface VapiClient {
  on(event: VapiEventType, callback: (data?: unknown) => void): void;
  off(event: VapiEventType, callback: (data?: unknown) => void): void;
  start(assistantId: string, options?: VapiStartOptions): Promise<void>;
  stop(): void;
  say(message: string): void;
  // Phase 12: Mute and control methods for simulated hold
  /** Mute/unmute the user's microphone */
  setMuted(muted: boolean): void;
  /** Send control messages to VAPI (e.g., mute/unmute assistant) */
  send(message: VapiSendMessage): void;
  /** Check if the user's microphone is muted */
  isMuted(): boolean;
}

/** VAPI SDK constructor type */
export type VapiConstructor = new (publicKey: string) => VapiClient;

// ============================================================================
// PHASE 12: DRIVER CALL SPECIFIC TYPES
// ============================================================================

/** Options for starting a driver confirmation call */
export interface VapiDriverStartOptions {
  variableValues: VapiDriverVariableValues;
}

/** Callback types for driver call events */
export interface DriverCallCallbacks {
  /** Called when driver confirms the proposed time */
  onDriverConfirm: () => void;
  /** Called when driver rejects the proposed time */
  onDriverReject: (reason?: string) => void;
  /** Called when driver call times out */
  onTimeout: () => void;
  /** Called when driver call fails to connect */
  onError: (error: string) => void;
  /** Called when driver call ends (for any reason) */
  onCallEnd: () => void;
}
