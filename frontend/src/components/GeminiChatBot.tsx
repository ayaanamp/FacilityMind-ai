import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  Trash2,
  FileEdit,
  Minimize2,
  ChevronUp,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';

import { GeminiChatMessage, GeminiChatResponse, GeminiChatAction } from '../types';
import { sendGeminiChatMessage } from '../services/api';

interface GeminiChatBotProps {
  onDraftComplaint?: (draft: {
    equipment_type: string;
    location: string;
    severity: string;
    raw_complaint: string;
  }) => void;
  onNavigateTab?: (tab: string) => void;
  activeComplaintId?: number;
}

const DEFAULT_SUGGESTIONS = [
  '📝 How to file a complaint?',
  '📊 How many complaints in database?',
  '🤖 Explain 6-Agent AI pipeline',
  '❄️ Check AC failures & repair costs',
  '👷 Show technician roster & rates',
  '⚡ Check Generator & Power status'
];

/**
 * Lightweight formatting helper for Gemini markdown in chat messages.
 */
function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-zinc-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Heading: ### Header
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

        // Bullet point: • or -
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[•\-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
              <span className="text-emerald-400 font-bold select-none">•</span>
              <div className="flex-1">{parseInlineMarkdown(content)}</div>
            </div>
          );
        }

        // Numbered list: 1. or 2.
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
              <span className="text-emerald-400 font-semibold select-none">{numberedMatch[1]}.</span>
              <div className="flex-1">{parseInlineMarkdown(numberedMatch[2])}</div>
            </div>
          );
        }

        // Standard line
        return <p key={idx}>{parseInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

/**
 * Parse inline bold (**bold**), code (`code`), and currency (₹...)
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to match **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-white">
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={index}
          className="px-1 py-0.5 bg-zinc-800 text-emerald-300 rounded font-mono text-[11px]"
        >
          {codeText}
        </code>
      );
    }
    return part;
  });
}

export const GeminiChatBot: React.FC<GeminiChatBotProps> = ({
  onDraftComplaint,
  onNavigateTab,
  activeComplaintId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [messages, setMessages] = useState<
    Array<
      GeminiChatMessage & {
        source?: string;
        draft?: any;
        actions?: Array<GeminiChatAction | string>;
      }
    >
  >([
    {
      role: 'assistant',
      content:
        '### 🤖 Welcome to FacilityMind AI Copilot\n\n' +
        'I am powered by **Google Gemini** & **Live Campus Telemetry**.\n\n' +
        'Here is what I can help you with:\n' +
        '• **Step-by-step guidance**: Ask *"How do I file a complaint?"*\n' +
        '• **Real-time database checks**: Ask *"How many complaints are in the database?"*\n' +
        '• **Multi-Agent Architecture**: Ask *"Explain the 6-agent AI workflow"*\n' +
        '• **Equipment Diagnostics & Costs**: Ask *"Check AC failures & repair costs"*\n' +
        '• **Labor & Technicians**: Ask *"Show technician roster & labor rates"*\n\n' +
        'Ask any question below or click a quick suggestion!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
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

    const userMsg: GeminiChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res: GeminiChatResponse = await sendGeminiChatMessage({
        message: text,
        history,
        context_complaint_id: activeComplaintId
      });

      const draftObj = res.complaint_draft || res.draft_complaint || null;

      const assistantMsg = {
        role: 'assistant' as const,
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: res.source === 'gemini' ? 'Gemini 2.5 Flash' : 'Campus Knowledge RAG',
        draft: draftObj,
        actions: res.suggested_actions || []
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Failed to connect to AI Assistant. Error: ${err?.message || 'Network Timeout'}. Please verify backend status.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleApplyDraft = (draft: any) => {
    if (onDraftComplaint && draft) {
      onDraftComplaint({
        equipment_type: draft.equipment_type || draft.equipment || 'General Facility',
        location: draft.location || 'Computer Lab 3',
        severity: draft.severity || draft.urgency || 'Medium',
        raw_complaint: draft.raw_complaint || draft.symptoms || draft.complaint || ''
      });
      setIsOpen(false);
    }
  };

  const handleActionClick = (action: GeminiChatAction | string, draft?: any) => {
    if (typeof action === 'string') {
      handleSendMessage(action);
      return;
    }

    if (action.action_type === 'draft_complaint') {
      const payload = action.payload || draft || {};
      handleApplyDraft(payload);
    } else if (action.action_type === 'navigate_tab' && onNavigateTab) {
      const tab = action.payload?.tab;
      if (tab) {
        onNavigateTab(tab);
      }
    } else if (action.label) {
      handleSendMessage(action.label);
    }
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: '### 🧹 Chat History Cleared\n\nHow can I assist you with campus facilities or diagnostics today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 px-5 py-3.5 bg-black border border-emerald-500/40 text-white rounded-full shadow-2xl hover:border-emerald-400 hover:shadow-emerald-950/60 active:scale-95 transition-all duration-200"
          title="Open AI Copilot"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-black" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
              AI Copilot <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">Gemini</span>
            </p>
            <p className="text-[11px] text-zinc-400">Campus Diagnostics & Assist</p>
          </div>
        </button>
      )}

      {/* Main Chat Drawer */}
      {isOpen && (
        <div
          className={`w-[95vw] sm:w-[440px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isMinimized ? 'h-16' : 'h-[600px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 bg-black border-b border-zinc-800 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-wide">FacilityMind Copilot</h3>
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                    Live RAG
                  </span>
                </div>
                <p className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Google Gemini &bull; Real-Time Telemetry
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
                title="Clear Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              {/* Message List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/90 scrollbar-thin scrollbar-thumb-zinc-800">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500">
                      {msg.role === 'user' ? (
                        <>
                          <span>You</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 text-emerald-400" />
                          <span className="text-zinc-400 font-medium">FacilityMind AI</span>
                          {msg.source && (
                            <span className="bg-zinc-800 text-zinc-300 px-1 rounded text-[9px]">
                              {msg.source}
                            </span>
                          )}
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs leading-relaxed relative group ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                          : 'bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-bl-none shadow-sm'
                      }`}
                    >
                      {/* Copy button for assistant responses */}
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handleCopyMessage(msg.content, idx)}
                          className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                          title="Copy response"
                        >
                          {copiedIdx === idx ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}

                      {/* Content rendering */}
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <FormattedMessage text={msg.content} />
                      )}

                      {/* Draft Action Card if Assistant generated a draft */}
                      {msg.draft && onDraftComplaint && (
                        <div className="mt-3 p-3 bg-black/70 rounded-xl border border-emerald-500/40">
                          <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                            <FileEdit className="w-3.5 h-3.5" /> Auto-Generated Complaint Ticket Draft:
                          </p>
                          <div className="text-[11px] text-zinc-300 space-y-1 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                            <div>
                              <span className="text-zinc-500">Equipment:</span>{' '}
                              <span className="text-white font-medium">
                                {msg.draft.equipment_type || msg.draft.equipment || 'General Hardware'}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Location:</span>{' '}
                              <span className="text-white">{msg.draft.location || 'Computer Lab 3'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Severity:</span>{' '}
                              <span className="text-amber-400 font-medium">{msg.draft.severity || 'Medium'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleApplyDraft(msg.draft)}
                            className="mt-2.5 w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Transfer to Complaint Form & Run AI
                          </button>
                        </div>
                      )}

                      {/* Suggested Navigation and Action Chips */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-zinc-800 flex flex-wrap gap-1.5">
                          {msg.actions.map((act, actIdx) => {
                            const label = typeof act === 'string' ? act : act.label;
                            return (
                              <button
                                key={actIdx}
                                onClick={() => handleActionClick(act, msg.draft)}
                                className="text-[10px] px-2.5 py-1 bg-zinc-800/90 hover:bg-zinc-700 text-emerald-300 hover:text-white rounded-md border border-zinc-700 flex items-center gap-1 transition-colors"
                              >
                                <span>{label}</span>
                                <ArrowRight className="w-2.5 h-2.5 opacity-70" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Synthesizing live SQLite metrics & Gemini reasoning...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions Quick Chips */}
              <div className="p-2 bg-black border-t border-zinc-800/80 overflow-x-auto flex gap-1.5 no-scrollbar">
                {DEFAULT_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion.replace(/^[^\s]+ /, ''))}
                    className="whitespace-nowrap text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1 rounded-full border border-zinc-800 hover:border-emerald-500/40 transition-colors flex-shrink-0"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Input Footer */}
              <div className="p-3 bg-black border-t border-zinc-800 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Gemini: 'how to file', 'how many complaints', 'check AC'..."
                  disabled={isLoading}
                  className="flex-1 bg-zinc-900 border border-zinc-700/60 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold rounded-xl transition-all active:scale-95 flex-shrink-0"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

