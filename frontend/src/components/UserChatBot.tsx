import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  ChevronRight,
  FileEdit,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { sendUserChatMessage } from '../services/api';
import { GeminiChatAction, GeminiChatResponse } from '../types';

interface UserChatBotProps {
  userPhone?: string;
  onNavigateTab?: (tab: string) => void;
  onTrackTicket?: (trackingCode: string) => void;
  onDraftComplaint?: (draft: {
    equipment_type: string;
    location: string;
    severity: string;
    raw_complaint: string;
    building?: string;
    floor?: string;
    room?: string;
  }) => void;
}

/**
 * Lightweight inline markdown parser for bold (**text**), code (`code`), and currency.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="px-1 py-0.5 bg-zinc-800 text-emerald-300 rounded font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Formatted message renderer supporting headings, bullet points, numbered lists, and paragraphs.
 */
function FormattedUserBotMessage({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-zinc-200 font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="text-xs font-bold text-emerald-400 tracking-wide pt-1 pb-0.5 flex items-center gap-1.5"
            >
              {parseInlineMarkdown(trimmed.replace('### ', ''))}
            </h4>
          );
        }

        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[•\-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
              <span className="text-emerald-400 font-bold select-none">•</span>
              <div className="flex-1">{parseInlineMarkdown(content)}</div>
            </div>
          );
        }

        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
              <span className="text-emerald-400 font-semibold select-none">{numberedMatch[1]}.</span>
              <div className="flex-1">{parseInlineMarkdown(numberedMatch[2])}</div>
            </div>
          );
        }

        return <p key={idx}>{parseInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

export const UserChatBot: React.FC<UserChatBotProps> = ({
  userPhone,
  onNavigateTab,
  onTrackTicket,
  onDraftComplaint,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      draft?: any;
      actions?: Array<GeminiChatAction | string>;
    }>
  >([
    {
      role: 'assistant',
      content:
        '### 👋 Welcome to Campus Facility Assistant!\n\n' +
        'I am your AI assistant for repairs, facility support, and ticket tracking.\n\n' +
        '• **Report an Issue**: Say *"AC in Lab 3 is leaking water"* and I will draft a ticket.\n' +
        '• **Track Status**: Ask *"Check ticket FM-0001"* or *"Show my complaints"*.\n' +
        '• **Operating Hours & FAQs**: Ask about facility rules, timing, or policies.\n\n' +
        'How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [suggestedActions, setSuggestedActions] = useState<Array<GeminiChatAction | string>>([
    { label: '📝 Report Broken AC in Lab 3', action_type: 'draft_complaint', payload: { equipment_type: 'Air Conditioner', location: 'Science Wing, Floor 2, Room 204', severity: 'High', raw_complaint: 'Central AC in Science Wing Room 204 is making severe rattling sounds and blowing warm air.' } },
    { label: '🔍 Track My Complaints', action_type: 'navigate_tab', payload: { tab: 'my-complaints' } },
    { label: '🕒 Support Operating Hours', action_type: 'info', payload: {} },
    { label: '⚡ Report Water / Power Outage', action_type: 'draft_complaint', payload: { equipment_type: 'UPS System', location: 'Academic Quad', severity: 'Critical', raw_complaint: 'Emergency power failure and UPS tripping in Academic Quad.' } },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg = {
      role: 'user' as const,
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const response: GeminiChatResponse = await sendUserChatMessage({
        message: text,
        history: historyPayload,
        user_phone: userPhone,
      });

      const draftObj = response.complaint_draft || response.draft_complaint || null;

      const assistantMsg = {
        role: 'assistant' as const,
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        draft: draftObj,
        actions: response.suggested_actions || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (response.suggested_actions && response.suggested_actions.length > 0) {
        setSuggestedActions(response.suggested_actions);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "⚠️ I am having trouble connecting to facility services right now. You can still use the **Submit Complaint** form to file your request directly.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyDraft = (draft: any) => {
    if (onDraftComplaint && draft) {
      onDraftComplaint({
        equipment_type: draft.equipment_type || draft.equipment || 'General Facility',
        location: draft.location || 'Main Campus',
        severity: draft.severity || draft.urgency || 'Medium',
        raw_complaint: draft.raw_complaint || draft.symptoms || '',
        building: draft.building,
        floor: draft.floor,
        room: draft.room,
      });
      setIsOpen(false);
    }
  };

  const handleActionClick = (action: GeminiChatAction | string) => {
    if (typeof action === 'string') {
      handleSendMessage(action);
      return;
    }

    if (action.action_type === 'draft_complaint' && action.payload) {
      handleApplyDraft(action.payload);
      return;
    }

    if (action.action_type === 'track_ticket' && action.payload?.tracking_code && onTrackTicket) {
      onTrackTicket(action.payload.tracking_code);
      setIsOpen(false);
      return;
    }

    if (action.action_type === 'navigate_tab' && action.payload?.tab && onNavigateTab) {
      onNavigateTab(action.payload.tab);
      setIsOpen(false);
      return;
    }

    handleSendMessage(action.label);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: '### 🧹 Conversation Reset\n\nHow can I help you with campus repairs, ticket tracking, or facility support today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Facility Help AI Assistant"
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white p-3.5 rounded-full shadow-2xl shadow-emerald-500/30 flex items-center gap-2.5 border border-emerald-400/40 hover:scale-105 active:scale-95 transition-all group font-sans select-none"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-300 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <span className="font-semibold text-xs tracking-wide pr-1">Facility AI Bot</span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className={`fixed right-3 sm:right-6 bottom-3 sm:bottom-6 z-50 w-[95vw] sm:w-[430px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col transition-all overflow-hidden font-sans ${
            isMinimized ? 'h-16' : 'h-[600px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border-b border-zinc-800 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Campus Facility Assistant
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Student Bot
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-400">Instant answers, incident drafts & ticket status</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                title="Clear Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-zinc-950/80">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500">
                      {m.role === 'user' ? (
                        <>
                          <span>You</span>
                          <span>•</span>
                          <span>{m.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 text-emerald-400" />
                          <span className="text-zinc-400 font-medium">FacilityBot</span>
                          <span>•</span>
                          <span>{m.timestamp}</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 leading-relaxed shadow-sm ${
                        m.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-zinc-900 text-zinc-200 border border-zinc-800/90 rounded-bl-none'
                      }`}
                    >
                      {m.role === 'user' ? (
                        <div className="whitespace-pre-wrap font-sans text-xs">{m.content}</div>
                      ) : (
                        <FormattedUserBotMessage text={m.content} />
                      )}

                      {/* Interactive Draft Card */}
                      {m.draft && onDraftComplaint && (
                        <div className="mt-3 p-3 bg-black/80 rounded-xl border border-emerald-500/50">
                          <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                            <FileEdit className="w-3.5 h-3.5" /> One-Click Complaint Draft Ready:
                          </p>
                          <div className="text-[11px] text-zinc-300 space-y-1 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                            <div>
                              <span className="text-zinc-500">Equipment:</span>{' '}
                              <span className="text-white font-medium">
                                {m.draft.equipment_type || m.draft.equipment || 'General Facility'}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Location:</span>{' '}
                              <span className="text-white">{m.draft.location || 'Main Campus'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Urgency:</span>{' '}
                              <span className="text-amber-400 font-medium">{m.draft.severity || 'Medium'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleApplyDraft(m.draft)}
                            className="mt-2.5 w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-98"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Fill in Complaint Form & Submit
                          </button>
                        </div>
                      )}

                      {/* Suggested actions inside message */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-800 flex flex-wrap gap-1.5">
                          {m.actions.map((act, actIdx) => {
                            const label = typeof act === 'string' ? act : act.label;
                            return (
                              <button
                                key={actIdx}
                                onClick={() => handleActionClick(act)}
                                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-emerald-950 text-zinc-300 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-700 text-[10px] transition-colors flex items-center gap-1"
                              >
                                <span>{label}</span>
                                <ChevronRight className="w-3 h-3 text-emerald-400" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
                    <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>FacilityBot is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestion Chips */}
              {suggestedActions.length > 0 && (
                <div className="p-2 border-t border-zinc-850 bg-zinc-900/70 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {suggestedActions.map((action, idx) => {
                    const label = typeof action === 'string' ? action : action.label;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleActionClick(action)}
                        className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-[11px] whitespace-nowrap transition-colors flex items-center gap-1 shrink-0"
                      >
                        <span>{label}</span>
                        <ChevronRight className="w-3 h-3 text-emerald-400" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Input Footer */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Report a problem, track ticket FM-XXXX, or ask a question..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl transition-all shadow-md shadow-emerald-600/20 shrink-0"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
