'use client';

import { useRef, useEffect } from 'react';
import {
  MessageSquare,
  PhoneCall,
  Send,
  Loader,
  CheckCircle,
  Phone,
  PhoneOff,
  Mic,
} from 'lucide-react';
import type { ChatMessage as ChatMessageType, ConversationPhase, BlockExpansionState, ThinkingStep, ToolCall } from '@/types/dispatch';
import type { TotalCostImpactResult } from '@/types/cost';
import { AgentMessage, type ArtifactType } from '@/components/ui/AgentMessage';
import { CostBadge, type OfferQuality } from '@/components/ui/CostBadge';

interface OfferEvaluation {
  quality: OfferQuality;
  shouldAccept: boolean;
  shouldPushback: boolean;
  reason: string;
}

/** Simple warehouse message bubble with optional inline cost analysis */
function WarehouseMessage({
  content,
  timestamp,
  costAnalysis,
  evaluation,
}: {
  content: string;
  timestamp: string;
  costAnalysis?: TotalCostImpactResult;
  evaluation?: OfferEvaluation;
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-2">
        {/* Message bubble */}
        <div className="rounded-2xl px-4 py-2.5 bg-amber-500/20 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-amber-400">Warehouse</span>
            <span className="text-[10px] text-slate-500">{timestamp}</span>
          </div>
          <p className="text-sm text-slate-200">{content}</p>
        </div>

        {/* Inline cost analysis */}
        {costAnalysis && evaluation && (
          <div className="rounded-xl px-3 py-2 bg-slate-800/60 border border-slate-600/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                  Cost Analysis
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-mono font-semibold ${
                    evaluation.quality === 'IDEAL'
                      ? 'text-emerald-400'
                      : evaluation.quality === 'ACCEPTABLE'
                      ? 'text-blue-400'
                      : evaluation.quality === 'SUBOPTIMAL'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  ${costAnalysis.totalCost.toFixed(2)}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
                    evaluation.quality === 'IDEAL'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : evaluation.quality === 'ACCEPTABLE'
                      ? 'bg-blue-500/20 text-blue-300'
                      : evaluation.quality === 'SUBOPTIMAL'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {evaluation.quality}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  userInput: string;
  onUserInputChange: (value: string) => void;
  onSendMessage: () => void;
  onClose: () => void;
  onFinalize: () => void;
  isProcessing: boolean;
  conversationPhase: ConversationPhase;
  isVoiceMode: boolean;
  warehouseManagerName: string | null;
  confirmedTime: string | null;
  confirmedDock: string | null;
  costAnalysis: TotalCostImpactResult | null;
  evaluation: OfferEvaluation | null;
  showCostBreakdown: boolean;
  // Voice call props
  callStatus?: 'idle' | 'connecting' | 'active' | 'ended';
  onStartCall?: () => void;
  onEndCall?: (() => void) | null;
  // Agentic UI props
  blockExpansion: BlockExpansionState;
  onToggleBlock: (blockId: string) => void;
  onOpenArtifact: (type: ArtifactType, data: unknown) => void;
}

export function ChatInterface({
  messages,
  userInput,
  onUserInputChange,
  onSendMessage,
  onClose,
  onFinalize,
  isProcessing,
  conversationPhase,
  isVoiceMode,
  warehouseManagerName,
  confirmedTime,
  confirmedDock,
  costAnalysis,
  evaluation,
  showCostBreakdown,
  callStatus = 'idle',
  onStartCall,
  onEndCall,
  blockExpansion,
  onToggleBlock,
  onOpenArtifact,
}: ChatInterfaceProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSendMessage();
    }
  };

  const handleOpenCostBreakdown = () => {
    if (costAnalysis) {
      onOpenArtifact('cost-breakdown', { costAnalysis, evaluation });
    }
  };

  return (
    <div
      className="bg-slate-800/20 border border-slate-700/30 rounded-2xl overflow-hidden flex flex-col shadow-xl"
      style={{ height: 'calc(100vh - 144px)', maxHeight: '800px', minHeight: '400px' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isVoiceMode ? (
            <PhoneCall className="w-4 h-4 text-purple-400" />
          ) : (
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-sm font-medium">
            {warehouseManagerName
              ? `Warehouse: ${warehouseManagerName}`
              : 'Warehouse Contact'}
          </span>
        </div>
        <div className="flex gap-1">
          {confirmedTime && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
              {confirmedTime}
            </span>
          )}
          {confirmedDock && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
              {confirmedDock}
            </span>
          )}
        </div>
      </div>

      {/* Messages - Using AgentMessage for dispatcher, simple bubble for warehouse */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          const messageId = msg.id || `msg-${i}`;

          if (msg.role === 'dispatcher') {
            return (
              <AgentMessage
                key={messageId}
                id={messageId}
                role="dispatcher"
                content={msg.content}
                timestamp={msg.timestamp}
                thinkingSteps={msg.thinkingSteps}
                toolCalls={msg.toolCalls}
                expandedBlocks={blockExpansion}
                onToggleBlock={onToggleBlock}
                onOpenArtifact={onOpenArtifact}
                isVoiceMode={isVoiceMode}
              />
            );
          }

          return (
            <WarehouseMessage
              key={messageId}
              content={msg.content}
              timestamp={msg.timestamp}
              costAnalysis={msg.costAnalysis}
              evaluation={msg.evaluation}
            />
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/5">
        {conversationPhase === 'done' ? (
          <button
            onClick={onFinalize}
            disabled={isProcessing}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Call Ended
          </button>
        ) : isVoiceMode ? (
          // Voice Mode Controls
          <>
            {callStatus === 'idle' && onStartCall && (
              <button
                onClick={onStartCall}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <Phone className="w-5 h-5" />
                Start Voice Call
              </button>
            )}
            {callStatus === 'connecting' && (
              <div className="flex items-center justify-center gap-3 py-3">
                <Loader className="w-5 h-5 text-purple-400 animate-spin" />
                <span className="text-sm text-purple-300">Connecting to warehouse...</span>
              </div>
            )}
            {callStatus === 'active' && (
              <>
                {/* Active call indicator */}
                <div className="bg-black/20 rounded-lg p-3 mb-2 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-400 font-medium">LIVE CALL</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Mic className="w-5 h-5 text-purple-400 animate-pulse" />
                  </div>
                  <p className="text-xs text-slate-500">
                    Speak naturally with the warehouse manager
                  </p>
                </div>
                {/* End Call button */}
                {onEndCall && (
                  <button
                    onClick={onEndCall}
                    className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    End Call
                  </button>
                )}
              </>
            )}
            {callStatus === 'ended' && (
              <div className="text-center py-3">
                <CheckCircle className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <p className="text-sm text-slate-300">Call ended</p>
              </div>
            )}
          </>
        ) : conversationPhase === 'confirming' ? (
          // Text Mode - Confirming phase
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-xl flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
            End Conversation
          </button>
        ) : (
          // Text Mode - Regular input
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => onUserInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholderForPhase(conversationPhase)}
              disabled={isProcessing}
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm placeholder-slate-600"
            />
            <button
              onClick={onSendMessage}
              disabled={isProcessing || !userInput.trim()}
              className="px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-900 disabled:text-slate-500 rounded-xl"
            >
              {isProcessing ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to get contextual placeholder text based on conversation phase
function getPlaceholderForPhase(phase: ConversationPhase): string {
  switch (phase) {
    case 'greeting':
    case 'awaiting_name':
      return "e.g. 'Hey, this is Sarah from receiving'";
    case 'explaining':
    case 'negotiating_time':
      return "e.g. 'Let me check... I can do 3pm' or 'Best I got is 4:30'";
    case 'awaiting_dock':
      return "e.g. 'Dock 7' or 'Pull into bay 12'";
    case 'confirming':
      return "e.g. 'Sounds good' or 'See you then'";
    default:
      return "Type warehouse response...";
  }
}

export { WarehouseMessage };
