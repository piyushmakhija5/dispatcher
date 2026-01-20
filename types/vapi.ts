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

/** Dynamic variables passed to VAPI assistant */
export interface VapiVariableValues {
  original_appointment: string;
  delay_minutes: string;
  shipment_value: string;
  retailer: string;
}

/** Options for starting a VAPI call */
export interface VapiStartOptions {
  variableValues: VapiVariableValues;
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

/** VAPI client interface (subset of @vapi-ai/web) */
export interface VapiClient {
  on(event: VapiEventType, callback: (data?: unknown) => void): void;
  start(assistantId: string, options?: VapiStartOptions): Promise<void>;
  stop(): void;
  say(message: string): void;
}

/** VAPI SDK constructor type */
export type VapiConstructor = new (publicKey: string) => VapiClient;
