/**
 * Contract Analyzer
 *
 * Uses Claude Sonnet with structured outputs to extract contract terms
 * from transportation/logistics agreements.
 *
 * Features:
 * - PDF and text document support (Claude handles PDFs natively)
 * - Self-validation in prompt
 * - Graceful handling of partial extractions
 * - Flexible schema for various contract structures
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ExtractedContractTerms,
  ContractAnalysisRequest,
  ContractAnalysisResponse,
  ContractValidationResult,
} from '@/types/contract';

// Lazy initialization
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Schema definition for Claude's structured output
 * This instructs Claude on the expected JSON structure
 */
const CONTRACT_TERMS_SCHEMA = {
  name: 'extract_contract_terms',
  description: 'Extract structured transportation contract terms including parties, compliance windows, and penalties',
  input_schema: {
    type: 'object' as const,
    properties: {
      parties: {
        type: 'object',
        description: 'All parties mentioned in the contract',
        properties: {
          shipper: { type: 'string', description: 'The party shipping goods' },
          carrier: { type: 'string', description: 'The transportation carrier' },
          consignee: { type: 'string', description: 'The party receiving goods (e.g., Walmart, Target)' },
          warehouse: { type: 'string', description: 'The warehouse or distribution center' },
        },
        additionalProperties: { type: 'string' },
      },
      complianceWindows: {
        type: 'array',
        description: 'Time windows for on-time delivery (OTIF, delivery windows)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the compliance window (e.g., OTIF)' },
            windowMinutes: { type: 'number', description: 'Total window in minutes (e.g., ±30 min = 60 total)' },
            description: { type: 'string', description: 'Additional context about this window' },
          },
          required: ['name', 'windowMinutes'],
        },
      },
      delayPenalties: {
        type: 'array',
        description: 'Penalties for delays (dwell time, detention, demurrage)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Type of penalty (e.g., Dwell Time, Detention)' },
            freeTimeMinutes: { type: 'number', description: 'Grace period before charges start' },
            tiers: {
              type: 'array',
              description: 'Tiered penalty structure',
              items: {
                type: 'object',
                properties: {
                  fromMinutes: { type: 'number', description: 'Start of tier in minutes after arrival' },
                  toMinutes: { type: ['number', 'null'], description: 'End of tier (null = no upper limit)' },
                  ratePerHour: { type: 'number', description: 'Hourly rate for this tier' },
                },
                required: ['fromMinutes', 'toMinutes', 'ratePerHour'],
              },
            },
          },
          required: ['name', 'freeTimeMinutes', 'tiers'],
        },
      },
      partyPenalties: {
        type: 'array',
        description: 'Penalties specific to certain parties',
        items: {
          type: 'object',
          properties: {
            partyName: { type: 'string', description: 'Name of the party this applies to' },
            penaltyType: { type: 'string', description: 'Type of penalty' },
            percentage: { type: 'number', description: 'Percentage-based penalty' },
            flatFee: { type: 'number', description: 'Fixed fee penalty' },
            perOccurrence: { type: 'number', description: 'Per-incident penalty' },
            conditions: { type: 'string', description: 'When this penalty applies' },
          },
          required: ['partyName', 'penaltyType'],
        },
      },
      otherTerms: {
        type: 'array',
        description: 'Other financial terms that do not fit standard categories',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the term' },
            description: { type: 'string', description: 'What this term covers' },
            financialImpact: { type: 'string', description: 'Estimated financial impact (e.g., "Up to $500")' },
            rawText: { type: 'string', description: 'Original text from contract' },
          },
          required: ['name', 'description'],
        },
      },
      _meta: {
        type: 'object',
        description: 'Metadata about the extraction',
        properties: {
          documentName: { type: 'string' },
          extractedAt: { type: 'string', description: 'ISO timestamp' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          warnings: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issues encountered during extraction',
          },
        },
        required: ['documentName', 'extractedAt', 'confidence'],
      },
    },
    required: ['parties', '_meta'],
  },
} as const satisfies Anthropic.Tool;

/**
 * System prompt for contract analysis
 * Includes self-validation instructions
 */
const SYSTEM_PROMPT = `You are an expert contract analyst specializing in transportation and logistics agreements.

Your task is to extract structured information from carrier-shipper transportation contracts, focusing on:
1. Parties involved (shipper, carrier, consignee, warehouse)
2. Compliance windows (OTIF, delivery windows)
3. Delay penalties (dwell time, detention, demurrage)
4. Party-specific penalties (chargebacks, fees)
5. Other financial terms

CRITICAL INSTRUCTIONS:

1. SELF-VALIDATION:
   - Only extract information that is EXPLICITLY stated in the contract
   - Verify that all numbers you extract match the source document
   - If you're uncertain about a value, include it in warnings
   - Do not infer or assume penalty structures

2. GRACEFUL PARTIAL EXTRACTION:
   - If some sections are missing or unclear, extract what you can
   - Use the "otherTerms" array for terms that don't fit standard categories
   - Include warnings about missing or ambiguous sections
   - Set confidence level based on clarity of information

3. PARTY IDENTIFICATION:
   - Extract exact party names as they appear in the contract
   - Common consignees: Walmart, Target, Amazon, Costco, Kroger, etc.
   - Don't assume - only extract what's explicitly mentioned

4. PENALTY STRUCTURES:
   - For tiered penalties, extract all tiers accurately
   - Convert time periods to minutes (e.g., "2 hours" → 120)
   - Preserve rate information exactly (e.g., "$75/hour")
   - If free time is mentioned, capture it in freeTimeMinutes

5. CONFIDENCE LEVELS:
   - high: Clear, explicit terms with specific numbers
   - medium: Terms present but some ambiguity or missing details
   - low: Significant ambiguity or very limited information

6. WARNINGS TO INCLUDE:
   - Missing sections (e.g., "No OTIF window found")
   - Ambiguous terms (e.g., "Dwell time rate unclear")
   - Conflicting information (e.g., "Multiple penalty rates mentioned")
   - Partial extraction (e.g., "Could not extract all penalty tiers")

Remember: It's better to extract partial information with warnings than to guess or assume.`;

/**
 * Analyze a contract document and extract structured terms
 *
 * @param request - Contract analysis request with content and metadata
 * @returns Extracted contract terms with metadata
 */
export async function analyzeContract(
  request: ContractAnalysisRequest
): Promise<ContractAnalysisResponse> {
  const startTime = Date.now();

  try {
    const client = getClient();

    // Build content array based on content type
    const content: Array<Anthropic.DocumentBlockParam | Anthropic.TextBlockParam> = [];

    if (request.contentType === 'pdf') {
      // Claude can process PDFs natively via document content type
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: request.content,
        },
      });
    } else {
      // Plain text content
      content.push({
        type: 'text',
        text: request.content,
      });
    }

    // Add extraction instruction
    content.push({
      type: 'text',
      text: `Please analyze this transportation contract and extract all relevant terms using the extract_contract_terms tool.

Document: ${request.fileName}
Current time: ${new Date().toISOString()}

Extract:
- All parties mentioned (shipper, carrier, consignee, warehouse)
- Compliance windows (OTIF, delivery windows) with time ranges
- Delay penalties (dwell time, detention) with rates and tiers
- Party-specific penalties with amounts and conditions
- Any other financial terms

Remember to:
✓ Verify all numbers match the source document
✓ Include warnings for missing or ambiguous sections
✓ Set appropriate confidence level
✓ Use otherTerms for unusual penalty structures`,
    });

    // Call Claude with structured output tool
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      tools: [CONTRACT_TERMS_SCHEMA],
      tool_choice: { type: 'tool', name: 'extract_contract_terms' },
    });

    // Extract tool use result
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse || toolUse.name !== 'extract_contract_terms') {
      throw new Error('No tool use found in response');
    }

    const extractedTerms = toolUse.input as ExtractedContractTerms;

    // Validate the extracted terms
    const validation = validateExtractedTerms(extractedTerms);
    if (!validation.valid) {
      console.warn('Contract extraction validation warnings:', validation.warnings);
      // Add validation warnings to extracted terms
      if (!extractedTerms._meta.warnings) {
        extractedTerms._meta.warnings = [];
      }
      extractedTerms._meta.warnings.push(...validation.warnings);
    }

    const extractionTimeMs = Date.now() - startTime;

    return {
      success: true,
      terms: extractedTerms,
      debug: {
        modelUsed: 'claude-sonnet-4-5',
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        extractionTimeMs,
      },
    };
  } catch (error) {
    console.error('Contract analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during contract analysis',
      debug: {
        modelUsed: 'claude-sonnet-4-5',
        extractionTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Validate extracted contract terms
 * Checks for common issues and provides warnings
 *
 * @param terms - Extracted contract terms
 * @returns Validation result with errors and warnings
 */
export function validateExtractedTerms(
  terms: ExtractedContractTerms
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!terms.parties || Object.keys(terms.parties).length === 0) {
    errors.push('No parties extracted from contract');
  }

  if (!terms._meta) {
    errors.push('Missing metadata');
  } else {
    if (!terms._meta.documentName) {
      warnings.push('Document name not set');
    }
    if (!terms._meta.confidence) {
      warnings.push('Confidence level not set');
    }
  }

  // Check for empty but defined arrays (might indicate parsing issues)
  if (terms.complianceWindows && terms.complianceWindows.length === 0) {
    warnings.push('complianceWindows array is empty');
  }

  if (terms.delayPenalties && terms.delayPenalties.length === 0) {
    warnings.push('delayPenalties array is empty - contract may not specify delay penalties');
  }

  // Validate delay penalty tiers
  if (terms.delayPenalties) {
    terms.delayPenalties.forEach((penalty, idx) => {
      if (!penalty.tiers || penalty.tiers.length === 0) {
        warnings.push(`delayPenalties[${idx}] (${penalty.name}) has no tiers`);
      }

      penalty.tiers?.forEach((tier, tierIdx) => {
        if (tier.fromMinutes < 0) {
          errors.push(
            `delayPenalties[${idx}].tiers[${tierIdx}] has negative fromMinutes: ${tier.fromMinutes}`
          );
        }
        if (tier.toMinutes !== null && tier.toMinutes <= tier.fromMinutes) {
          warnings.push(
            `delayPenalties[${idx}].tiers[${tierIdx}] has toMinutes <= fromMinutes`
          );
        }
        if (tier.ratePerHour < 0) {
          warnings.push(
            `delayPenalties[${idx}].tiers[${tierIdx}] has negative rate: ${tier.ratePerHour}`
          );
        }
      });
    });
  }

  // Validate compliance windows
  if (terms.complianceWindows) {
    terms.complianceWindows.forEach((window, idx) => {
      if (window.windowMinutes <= 0) {
        warnings.push(
          `complianceWindows[${idx}] (${window.name}) has invalid windowMinutes: ${window.windowMinutes}`
        );
      }
    });
  }

  // Check for low confidence
  if (terms._meta?.confidence === 'low') {
    warnings.push(
      'Extraction confidence is LOW - review extracted terms carefully'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick validation check - returns true if terms are usable
 */
export function areTermsUsable(terms: ExtractedContractTerms): boolean {
  const validation = validateExtractedTerms(terms);
  return validation.valid && terms._meta?.confidence !== 'low';
}
