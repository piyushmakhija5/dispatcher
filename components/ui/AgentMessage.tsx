'use client';

import { Phone, MessageSquare } from 'lucide-react';
import { CollapsibleThinking, ThinkingBlockType } from './CollapsibleThinking';
import { ToolCallBlock, ToolCallStatus, ToolName } from './ToolCallBlock';

export interface ThinkingStep {
  id: string;
  type: ThinkingBlockType;
  title: string;
  content: string | string[];
  isActive?: boolean;
}

export interface ToolCall {
  id: string;
  toolName: ToolName;
  description: string;
  status: ToolCallStatus;
  result?: {
    summary: string;
    data?: unknown;
  };
  error?: string;
}

export type ArtifactType = 'cost-breakdown' | 'strategy' | 'agreement';

interface AgentMessageProps {
  id: string;
  role: 'dispatcher' | 'warehouse';
  content: string;
  timestamp: string;
  thinkingSteps?: ThinkingStep[];
  toolCalls?: ToolCall[];
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (blockId: string) => void;
  onOpenArtifact?: (type: ArtifactType, data: unknown) => void;
  isVoiceMode?: boolean;
}

export function AgentMessage({
  id,
  role,
  content,
  timestamp,
  thinkingSteps = [],
  toolCalls = [],
  expandedBlocks,
  onToggleBlock,
  onOpenArtifact,
  isVoiceMode = false,
}: AgentMessageProps) {
  const isDispatcher = role === 'dispatcher';
  const hasCollapsibleContent = thinkingSteps.length > 0 || toolCalls.length > 0;

  if (!isDispatcher) {
    // Simple warehouse message (right-aligned)
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-amber-400">Warehouse</span>
          </div>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{content}</p>
          <div className="text-[10px] text-slate-500 mt-1.5 text-right">{timestamp}</div>
        </div>
      </div>
    );
  }

  // Dispatcher (agent) message with collapsible sections
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {/* Collapsible Thinking Steps */}
        {thinkingSteps.length > 0 && (
          <div className="space-y-1.5">
            {thinkingSteps.map((step) => (
              <CollapsibleThinking
                key={step.id}
                id={step.id}
                title={step.title}
                content={step.content}
                type={step.type}
                isExpanded={expandedBlocks[step.id] ?? false}
                isActive={step.isActive}
                onToggle={() => onToggleBlock(step.id)}
              />
            ))}
          </div>
        )}

        {/* Collapsible Tool Calls */}
        {toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {toolCalls.map((tool) => (
              <ToolCallBlock
                key={tool.id}
                id={tool.id}
                toolName={tool.toolName}
                description={tool.description}
                status={tool.status}
                result={tool.result}
                error={tool.error}
                isExpanded={expandedBlocks[tool.id] ?? false}
                onToggle={() => onToggleBlock(tool.id)}
                onViewDetails={
                  tool.toolName === 'check_slot_cost' && onOpenArtifact
                    ? () => onOpenArtifact('cost-breakdown', tool.result?.data)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* Divider (only if has collapsible content above) */}
        {hasCollapsibleContent && content && (
          <div className="h-px bg-gradient-to-r from-slate-700/50 via-slate-600/30 to-transparent my-1" />
        )}

        {/* Main Response Content */}
        {content && (
          <div className="rounded-2xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              {isVoiceMode ? (
                <Phone className="w-3 h-3 text-emerald-400" />
              ) : (
                <MessageSquare className="w-3 h-3 text-emerald-400" />
              )}
              <span className="text-xs font-medium text-emerald-400">
                Mike (Dispatcher)
              </span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{content}</p>
            <div className="text-[10px] text-slate-500 mt-1.5">{timestamp}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentMessage;
