'use client';

import { useRef, useEffect } from 'react';
import {
  MessageSquare,
  PhoneCall,
  Send,
  Loader,
  CheckCircle,
  Phone,
} from 'lucide-react';
import type { ChatMessage as ChatMessageType, ConversationPhase } from '@/types/dispatch';
import type { TotalCostImpactResult } from '@/types/cost';
import { CostBreakdown, type OfferEvaluation } from './CostBreakdown';

interface ChatMessageProps {
  role: 'dispatcher' | 'warehouse';
  content: string;
  timestamp: string;
}

function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isAgent = role === 'dispatcher';

  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isAgent
            ? 'bg-slate-800/50 border border-slate-700/30'
            : 'bg-amber-500/20 border border-amber-500/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs font-medium ${
              isAgent ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isAgent ? 'Dispatcher' : 'Warehouse'}
          </span>
          <span className="text-[10px] text-slate-500">{timestamp}</span>
        </div>
        <p className="text-sm text-slate-200">{content}</p>
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

  return (
    <div
      className="bg-slate-800/20 border border-slate-700/30 rounded-2xl overflow-hidden flex-1 flex flex-col"
      style={{ minHeight: '380px' }}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <ChatMessage key={i} {...m} />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Cost Breakdown */}
      {showCostBreakdown && costAnalysis && (
        <div className="px-3 pb-2">
          <CostBreakdown costAnalysis={costAnalysis} evaluation={evaluation} />
        </div>
      )}

      {/* Input Area (Text Mode) */}
      {!isVoiceMode && (
        <div className="p-3 border-t border-white/5">
          {conversationPhase === 'done' ? (
            <button
              onClick={onFinalize}
              disabled={isProcessing}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium rounded-xl flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Save Agreement
            </button>
          ) : conversationPhase === 'confirming' ? (
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
      )}
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

export { ChatMessage };
