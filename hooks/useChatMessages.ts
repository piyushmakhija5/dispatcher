'use client';

import { useState, useCallback } from 'react';
import type {
  ChatMessage,
  ThinkingStep,
  ToolCall,
} from '@/types/dispatch';
import type { TotalCostImpactResult } from '@/types/cost';
import type { OfferEvaluation } from '@/lib/negotiation-strategy';

export interface UseChatMessagesReturn {
  chatMessages: ChatMessage[];
  addChatMessage: (role: 'dispatcher' | 'warehouse', content: string) => void;
  addAgentMessage: (
    content: string,
    options?: {
      thinkingSteps?: ThinkingStep[];
      toolCalls?: ToolCall[];
    }
  ) => string;
  updateMessageToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;
  attachCostAnalysisToLastMessage: (costAnalysis: TotalCostImpactResult, evaluation: OfferEvaluation) => void;
  resetChatMessages: () => void;
}

/**
 * Hook for managing chat messages
 * Handles dispatcher and warehouse messages with embedded thinking/tool calls
 */
export function useChatMessages(): UseChatMessagesReturn {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const addChatMessage = useCallback(
    (role: 'dispatcher' | 'warehouse', content: string) => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setChatMessages((prev) => [
        ...prev,
        { id, role, content, timestamp: new Date().toLocaleTimeString() },
      ]);
    },
    []
  );

  // Add agent message with embedded thinking/tool calls
  const addAgentMessage = useCallback(
    (
      content: string,
      options?: {
        thinkingSteps?: ThinkingStep[];
        toolCalls?: ToolCall[];
      }
    ): string => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id,
          role: 'dispatcher' as const,
          content,
          timestamp: new Date().toLocaleTimeString(),
          thinkingSteps: options?.thinkingSteps,
          toolCalls: options?.toolCalls,
        },
      ]);
      return id;
    },
    []
  );

  // Update a tool call within a message
  const updateMessageToolCall = useCallback(
    (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => {
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId || !msg.toolCalls) return msg;
          return {
            ...msg,
            toolCalls: msg.toolCalls.map((tc) =>
              tc.id === toolCallId ? { ...tc, ...updates } : tc
            ),
          };
        })
      );
    },
    []
  );

  // Attach cost analysis to the most recent warehouse message
  const attachCostAnalysisToLastMessage = useCallback(
    (costAnalysis: TotalCostImpactResult, evaluation: OfferEvaluation) => {
      setChatMessages((prev) => {
        const lastWarehouseIndex = prev.map((m, i) => (m.role === 'warehouse' ? i : -1))
          .filter(i => i !== -1)
          .pop();

        if (lastWarehouseIndex === undefined) return prev;

        return prev.map((msg, index) => {
          if (index !== lastWarehouseIndex) return msg;
          return {
            ...msg,
            costAnalysis,
            evaluation,
          };
        });
      });
    },
    []
  );

  const resetChatMessages = useCallback(() => {
    setChatMessages([]);
  }, []);

  return {
    chatMessages,
    addChatMessage,
    addAgentMessage,
    updateMessageToolCall,
    attachCostAnalysisToLastMessage,
    resetChatMessages,
  };
}
