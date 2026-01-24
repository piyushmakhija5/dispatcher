/**
 * Contract Analysis Types
 *
 * These types define the structure for dynamically extracted contract terms.
 * The LLM extracts these from actual contract documents, replacing hardcoded rules.
 */

/**
 * Extracted contract terms from LLM analysis
 * Schema is flexible to handle various contract structures
 */
export interface ExtractedContractTerms {
  /**
   * Parties identified from contract document
   * Replaces hardcoded retailer dropdowns
   */
  parties: {
    shipper?: string;
    carrier?: string;
    consignee?: string;
    warehouse?: string;
    // Allow for other party types found in contract
    [key: string]: string | undefined;
  };

  /**
   * Compliance windows (OTIF, delivery windows, etc.)
   * Defines time windows for on-time delivery
   */
  complianceWindows?: {
    name: string;           // e.g., "OTIF", "Delivery Window"
    windowMinutes: number;  // ±30 minutes = 60 total window
    description?: string;   // Additional context
  }[];

  /**
   * Delay penalties (dwell time, detention, demurrage, etc.)
   * Tiered penalty structures based on delay duration
   */
  delayPenalties?: {
    name: string;           // e.g., "Dwell Time", "Detention", "Demurrage"
    freeTimeMinutes: number; // Grace period before charges start
    tiers: {
      fromMinutes: number;    // Start of this tier (relative to arrival)
      toMinutes: number | null; // End of tier (null = no upper limit)
      ratePerHour: number;    // Charge per hour in this tier
    }[];
  }[];

  /**
   * Party-specific penalties (dynamic, not hardcoded)
   * Penalties that apply to specific parties
   */
  partyPenalties?: {
    partyName: string;      // Extracted from document (e.g., "Walmart", "Shipper")
    penaltyType: string;    // Type of penalty (e.g., "OTIF Violation", "Chargeback")
    percentage?: number;    // Percentage-based penalty
    flatFee?: number;       // Fixed fee penalty
    perOccurrence?: number; // Per-incident penalty
    conditions?: string;    // When this penalty applies
  }[];

  /**
   * Catch-all for other penalty types
   * Captures penalties that don't fit standard categories
   */
  otherTerms?: {
    name: string;
    description: string;
    financialImpact?: string; // e.g., "Up to $500", "2% of shipment value"
    rawText?: string;         // Original text from contract
  }[];

  /**
   * HOS-related requirements extracted from contract (Phase 10)
   * Driver rest requirements, detention rates, etc.
   */
  hosRequirements?: {
    /** Maximum continuous driving hours allowed */
    maxContinuousDrivingHours?: number;
    /** Required rest hours between shifts */
    requiredRestHours?: number;
    /** Break requirements description */
    breakRequirements?: string;
    /** Driver detention rate per hour (when driver waits) */
    driverDetentionRatePerHour?: number;
    /** Layover daily rate (for overnight stays) */
    layoverDailyRate?: number;
    /** Description of HOS clause from contract */
    hosClauseDescription?: string;
    /** Raw text from contract */
    rawText?: string;
  };

  /**
   * HOS-related penalties extracted from contract (Phase 10)
   * Violations and penalties for HOS non-compliance
   */
  hosPenalties?: {
    name: string;             // e.g., "HOS Violation", "Driver Fatigue Incident"
    violationType: string;    // Type of violation
    penaltyAmount?: number;   // Fixed penalty amount
    penaltyPercentage?: number; // Percentage-based penalty
    description?: string;     // Additional context
  }[];

  /**
   * Extraction metadata
   * Provides context about the extraction quality
   */
  _meta: {
    documentName: string;
    extractedAt: string;      // ISO timestamp
    confidence: 'high' | 'medium' | 'low';
    warnings?: string[];      // Issues during extraction
  };
}

/**
 * Request payload for contract analysis
 */
export interface ContractAnalysisRequest {
  content: string;          // Contract text or base64 PDF
  contentType: 'text' | 'pdf';
  fileName: string;
  options?: {
    includeRawText?: boolean; // Include raw text snippets in otherTerms
    strictValidation?: boolean; // Require high confidence
  };
}

/**
 * Response from contract analysis
 */
export interface ContractAnalysisResponse {
  success: boolean;
  terms?: ExtractedContractTerms;
  error?: string;
  debug?: {
    modelUsed: string;
    tokensUsed?: number;
    extractionTimeMs: number;
  };
}

/**
 * Validation result for extracted terms
 */
export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
