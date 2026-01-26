'use client';

import { CheckCircle, PhoneCall, Loader, UserCheck } from 'lucide-react';
import { ReasoningPanel } from './ReasoningPanel';
import { StatusCard } from './StatusCard';
import { LoadingSpinner } from './LoadingSpinner';
import { FinalizedAgreementCard } from './FinalizedAgreementCard';
import { StrategyPanel } from './StrategyPanel';
import { ContractTermsDisplay } from './ContractTermsDisplay';
import { ChatInterface } from './ChatInterface';
import { carbon } from '@/lib/themes/carbon';
import type { UseDispatchWorkflowReturn } from '@/hooks/useDispatchWorkflow';
import type { DriverCallStatus, TentativeAgreement, WarehouseHoldState } from '@/types/dispatch';
import type { TwilioCallState } from '@/types/vapi';
import type { VapiCallStatus } from '@/hooks/useVapiVoiceCall';

/**
 * Props for progressive disclosure state
 */
export interface DisclosureState {
  // Summary
  showSummary: boolean;
  summaryHeaderComplete: boolean;
  summaryTypingComplete: boolean;
  setSummaryHeaderComplete: (val: boolean) => void;
  setSummaryTypingComplete: (val: boolean) => void;
  loadingSummary: boolean;
  // Strategy
  showStrategy: boolean;
  loadingStrategy: boolean;
  // Voice subagent
  showVoiceSubagent: boolean;
  voiceSubagentHeaderComplete: boolean;
  voiceSubagentTypingComplete: boolean;
  setVoiceSubagentHeaderComplete: (val: boolean) => void;
  setVoiceSubagentTypingComplete: (val: boolean) => void;
  loadingVoiceSubagent: boolean;
  // Call button
  showCallButton: boolean;
  loadingCallButton: boolean;
  // Reasoning
  reasoningCollapsed: boolean;
  // Finalized
  showFinalizedAgreement: boolean;
  finalizedHeaderComplete: boolean;
  finalizedTypingComplete: boolean;
  setFinalizedHeaderComplete: (val: boolean) => void;
  setFinalizedTypingComplete: (val: boolean) => void;
  loadingFinalized: boolean;
  // Driver confirmation
  showDriverConfirmation: boolean;
  driverConfirmHeaderComplete: boolean;
  driverConfirmTypingComplete: boolean;
  setDriverConfirmHeaderComplete: (val: boolean) => void;
  setDriverConfirmTypingComplete: (val: boolean) => void;
  loadingDriverConfirm: boolean;
}

/**
 * Props for WorkflowContent component
 */
export interface WorkflowContentProps {
  workflow: UseDispatchWorkflowReturn;
  disclosure: DisclosureState;

  // Chat state
  userInput: string;
  setUserInput: (val: string) => void;
  onSendMessage: () => void;
  onClose: () => void;
  onFinalize: () => void;

  // Call state
  callStatus: VapiCallStatus;
  onStartCall: () => void;
  onEndCall: () => void;

  // Driver confirmation
  driverCallStatus: DriverCallStatus;
  pendingTentativeAgreement: TentativeAgreement | null;

  // Twilio state (optional)
  voiceTransport?: 'web' | 'phone';
  twilioCallState?: TwilioCallState;

  // Flags
  isComplete: boolean;
}

/**
 * WorkflowContent - Main content area for the dispatch workflow
 *
 * This component renders either a split layout (left: info panels, right: chat)
 * or a single column layout depending on the workflow state.
 */
export function WorkflowContent({
  workflow,
  disclosure,
  userInput,
  setUserInput,
  onSendMessage,
  onClose,
  onFinalize,
  callStatus,
  onStartCall,
  onEndCall,
  driverCallStatus,
  pendingTentativeAgreement,
  voiceTransport = 'web',
  twilioCallState,
  isComplete,
}: WorkflowContentProps) {
  const isVoiceMode = workflow.setupParams.communicationMode === 'voice';
  const isNegotiating = workflow.workflowStage === 'negotiating';

  // Determine if we should use split layout
  const isChatActive = disclosure.showCallButton || workflow.chatMessages.length > 0 || callStatus !== 'idle';
  const shouldSplit = isChatActive && !isComplete;

  // Build shared info panels JSX
  const infoPanels = (
    <>
      {/* Collapsible Reasoning Panel */}
      {workflow.thinkingSteps.length > 0 && (
        <ReasoningPanel
          steps={workflow.thinkingSteps}
          activeStepId={workflow.activeStepId}
          expandedSteps={workflow.expandedSteps}
          onToggleStep={workflow.toggleStepExpanded}
          defaultCollapsed={disclosure.reasoningCollapsed}
        />
      )}

      {/* Loading: Reasoning → Summary */}
      {disclosure.loadingSummary && <LoadingSpinner variant="warning" />}

      {/* Summary Card */}
      {disclosure.showSummary && workflow.negotiationStrategy && (
        <StatusCard
          icon={<CheckCircle className="w-6 h-6" />}
          title="Analysis Complete"
          description={`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
          variant="success"
          animateTitle={!disclosure.summaryHeaderComplete}
          onTitleComplete={() => disclosure.setSummaryHeaderComplete(true)}
          titleComplete={disclosure.summaryHeaderComplete}
          animateDescription={!disclosure.summaryTypingComplete}
          onDescriptionComplete={() => disclosure.setSummaryTypingComplete(true)}
        />
      )}

      {/* Loading: Summary → Strategy */}
      {disclosure.loadingStrategy && <LoadingSpinner variant="info" />}

      {/* Strategy Panel */}
      {disclosure.showStrategy && workflow.negotiationStrategy && isNegotiating && (
        <div className="transition-all duration-500 ease-in-out animate-fade-in">
          <StrategyPanel
            strategy={workflow.negotiationStrategy}
            negotiationState={workflow.negotiationState}
            currentEvaluation={workflow.currentEvaluation}
            contractSource={workflow.extractedTerms ? 'extracted' : 'defaults'}
            partyName={workflow.partyName}
          />
        </div>
      )}

      {/* Contract Terms Display */}
      {disclosure.showStrategy && isNegotiating && (
        <div className="transition-all duration-500 ease-in-out animate-fade-in">
          <ContractTermsDisplay
            terms={workflow.extractedTerms}
            fileName={workflow.contractFileName}
            error={workflow.contractError}
          />
        </div>
      )}

      {/* Loading: Strategy → Voice Subagent */}
      {disclosure.loadingVoiceSubagent && <LoadingSpinner variant="info" />}

      {/* Voice Subagent Card (voice mode only) */}
      {disclosure.showVoiceSubagent && isVoiceMode && (
        <StatusCard
          icon={<PhoneCall className="w-6 h-6" />}
          title="Spinning up Voice Subagent"
          description={`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
          variant="info"
          animateTitle={!disclosure.voiceSubagentHeaderComplete}
          onTitleComplete={() => disclosure.setVoiceSubagentHeaderComplete(true)}
          titleComplete={disclosure.voiceSubagentHeaderComplete}
          animateDescription={!disclosure.voiceSubagentTypingComplete}
          onDescriptionComplete={() => disclosure.setVoiceSubagentTypingComplete(true)}
        />
      )}

      {/* Loading: Voice Subagent → Call Button */}
      {disclosure.loadingCallButton && <LoadingSpinner variant="info" />}

      {/* Driver Confirmation Loading */}
      {disclosure.loadingDriverConfirm && <LoadingSpinner variant="info" />}

      {/* Driver Confirmation Card */}
      {disclosure.showDriverConfirmation && (
        <DriverConfirmationCard
          driverCallStatus={driverCallStatus}
          tentativeAgreement={pendingTentativeAgreement}
          confirmedTime={workflow.confirmedTime}
          confirmedDock={workflow.confirmedDock}
          headerComplete={disclosure.driverConfirmHeaderComplete}
          onHeaderComplete={() => disclosure.setDriverConfirmHeaderComplete(true)}
          typingComplete={disclosure.driverConfirmTypingComplete}
          onTypingComplete={() => disclosure.setDriverConfirmTypingComplete(true)}
        />
      )}

      {/* Loading: Finalized Agreement */}
      {disclosure.loadingFinalized && <LoadingSpinner variant="success" />}

      {/* Finalized Agreement Card */}
      {disclosure.showFinalizedAgreement && workflow.confirmedTime && workflow.confirmedDock && (
        <FinalizedAgreementCard
          originalAppointment={workflow.setupParams.originalAppointment}
          delayMinutes={workflow.setupParams.delayMinutes}
          confirmedTime={workflow.confirmedTime}
          confirmedDock={workflow.confirmedDock}
          warehouseManagerName={workflow.warehouseManagerName}
          costAnalysis={workflow.currentCostAnalysis}
          animateHeader={!disclosure.finalizedHeaderComplete}
          onHeaderComplete={() => disclosure.setFinalizedHeaderComplete(true)}
          headerComplete={disclosure.finalizedHeaderComplete}
          animateDescription={!disclosure.finalizedTypingComplete}
          onDescriptionComplete={() => disclosure.setFinalizedTypingComplete(true)}
        />
      )}
    </>
  );

  // Split layout
  if (shouldSplit) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 items-start transition-all duration-500 ease-out">
        {/* Left Panel - Info Panels */}
        <div className="flex-1 space-y-4 w-full lg:max-w-2xl animate-slide-in-right">
          {infoPanels}
        </div>

        {/* Right Panel - Chat Interface */}
        <div className="w-full lg:max-w-xl animate-slide-in-left">
          <div className="lg:sticky lg:top-24">
            <ChatInterface
              messages={workflow.chatMessages}
              userInput={userInput}
              onUserInputChange={setUserInput}
              onSendMessage={onSendMessage}
              onClose={onClose}
              onFinalize={onFinalize}
              isProcessing={workflow.isProcessing}
              conversationPhase={workflow.conversationPhase}
              isVoiceMode={isVoiceMode}
              warehouseManagerName={workflow.warehouseManagerName}
              confirmedTime={workflow.confirmedTime}
              confirmedDock={workflow.confirmedDock}
              costAnalysis={workflow.currentCostAnalysis}
              evaluation={workflow.currentEvaluation}
              showCostBreakdown={isNegotiating}
              callStatus={callStatus}
              onStartCall={onStartCall}
              onEndCall={onEndCall}
              voiceTransport={voiceTransport}
              twilioCallState={twilioCallState}
              warehouseHoldState={workflow.warehouseHold}
              driverCallStatus={driverCallStatus}
              isDriverConfirmationEnabled={workflow.isDriverConfirmationEnabled}
              blockExpansion={workflow.blockExpansion}
              onToggleBlock={workflow.toggleBlockExpansion}
              onOpenArtifact={workflow.openArtifact}
            />
          </div>
        </div>
      </div>
    );
  }

  // Single column layout
  return (
    <div className="max-w-3xl mx-auto space-y-4 transition-all duration-500 ease-out">
      {infoPanels}
    </div>
  );
}

/**
 * Driver Confirmation Card - Shows driver call status during confirmation
 */
interface DriverConfirmationCardProps {
  driverCallStatus: DriverCallStatus;
  tentativeAgreement: TentativeAgreement | null;
  confirmedTime: string | null;
  confirmedDock: string | null;
  headerComplete: boolean;
  onHeaderComplete: () => void;
  typingComplete: boolean;
  onTypingComplete: () => void;
}

function DriverConfirmationCard({
  driverCallStatus,
  tentativeAgreement,
  confirmedTime,
  confirmedDock,
  headerComplete,
  onHeaderComplete,
  typingComplete,
  onTypingComplete,
}: DriverConfirmationCardProps) {
  const displayTime = tentativeAgreement?.time || confirmedTime;
  const displayDock = tentativeAgreement?.dock || confirmedDock;

  return (
    <StatusCard
      icon={<PhoneCall className="w-5 h-5" />}
      title="Calling Driver for Confirmation"
      description="Confirming availability with driver before finalizing the agreement."
      variant="info"
      animateTitle={!headerComplete}
      onTitleComplete={onHeaderComplete}
      titleComplete={headerComplete}
      animateDescription={!typingComplete}
      onDescriptionComplete={onTypingComplete}
    >
      {typingComplete && (
        <div className="space-y-2 mt-2">
          {/* Tentative Agreement Details */}
          <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: `${carbon.bgSurface2}80` }}>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: carbon.textTertiary }}>Tentative Time:</span>
              <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                {displayTime}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: carbon.textTertiary }}>Tentative Dock:</span>
              <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                {displayDock}
              </span>
            </div>
          </div>

          {/* Driver Call Status */}
          <div className="rounded-lg p-3" style={{
            backgroundColor: driverCallStatus === 'confirmed' ? `${carbon.success}15`
              : driverCallStatus === 'rejected' || driverCallStatus === 'failed' || driverCallStatus === 'timeout' ? `${carbon.critical}15`
              : `${carbon.bgSurface2}80`
          }}>
            <div className="flex items-center justify-center gap-2">
              {driverCallStatus === 'connecting' && (
                <>
                  <Loader className="w-4 h-4 animate-spin" style={{ color: carbon.accent }} />
                  <span className="text-sm" style={{ color: carbon.textSecondary }}>Connecting to driver...</span>
                </>
              )}
              {driverCallStatus === 'active' && (
                <>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: carbon.critical }} />
                  <PhoneCall className="w-4 h-4 animate-pulse" style={{ color: carbon.accent }} />
                  <span className="text-sm" style={{ color: carbon.textSecondary }}>Speaking with driver...</span>
                </>
              )}
              {driverCallStatus === 'confirmed' && (
                <>
                  <UserCheck className="w-4 h-4" style={{ color: carbon.success }} />
                  <span className="text-sm font-medium" style={{ color: carbon.success }}>Driver Confirmed!</span>
                </>
              )}
              {driverCallStatus === 'rejected' && (
                <span className="text-sm" style={{ color: carbon.critical }}>Driver unavailable</span>
              )}
              {driverCallStatus === 'timeout' && (
                <span className="text-sm" style={{ color: carbon.critical }}>Driver did not respond</span>
              )}
              {driverCallStatus === 'failed' && (
                <span className="text-sm" style={{ color: carbon.critical }}>Call failed</span>
              )}
              {driverCallStatus === 'idle' && (
                <>
                  <Loader className="w-4 h-4 animate-spin" style={{ color: carbon.textTertiary }} />
                  <span className="text-sm" style={{ color: carbon.textTertiary }}>Preparing call...</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </StatusCard>
  );
}
