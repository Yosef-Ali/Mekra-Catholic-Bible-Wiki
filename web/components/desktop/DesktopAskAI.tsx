import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, ChatMessage, ChatSession, UserProfile } from '../../types';
import { Rubric, CrossMark } from '../ui/ManuscriptPrimitives';
import { streamChatResponse, generateChatSuggestions, getInitialLiturgicalSuggestions } from '../../services/geminiService';
import { getChatSessions, saveChatSession, deleteChatSession, getUserProfile } from '../../services/storageService';

const FALLBACK_SUGGESTIONS = [
  "የዛሬው የቅዳሴ ምንባባት",
  "መዝሙረ ዳዊት 23 አብራራልኝ",
  "ስለ እመቤታችን ንገረኝ",
  "ካቶሊኮች ለምን ለካህን ይናዘዛሉ?",
  "ዐቢይ ጾም ምንድነው?",
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: 'ሰላም! እኔ የካቶሊክ መጽሐፍ ቅዱስ ረዳትዎ ነኝ። ስለ መጽሐፍ ቅዱስ፣ ስለ ካቶሊክ አስተምህሮ ወይም ስለ እለቱ ምንባባት ማንኛውንም ጥያቄ መጠየቅ ይችላሉ።',
};

const GROUNDING_DEFAULTS = [
  { l: 'Ground on Compendium', on: true },
  { l: 'Quote scripture', on: true },
  { l: "Ge'ez sources", on: false },
];

interface DesktopAskAIProps {
  setView: (view: View) => void;
}

export const DesktopAskAI: React.FC<DesktopAskAIProps> = ({ setView }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [groundingOptions, setGroundingOptions] = useState(GROUNDING_DEFAULTS);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(Date.now().toString());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions, profile, suggestions on mount
  useEffect(() => {
    setSessions(getChatSessions());
    setUserProfile(getUserProfile());

    let cancelled = false;
    setLoadingSuggestions(true);
    getInitialLiturgicalSuggestions()
      .then((s) => {
        if (!cancelled) setSuggestions(s && s.length > 0 ? s : FALLBACK_SUGGESTIONS);
      })
      .catch(() => { if (!cancelled) setSuggestions(FALLBACK_SUGGESTIONS); })
      .finally(() => { if (!cancelled) setLoadingSuggestions(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleGrounding = (index: number) => {
    setGroundingOptions((prev) =>
      prev.map((g, i) => (i === index ? { ...g, on: !g.on } : g))
    );
  };

  const saveSession = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length <= 1) return;
    const firstUser = msgs.find((m) => m.role === 'user');
    const title = firstUser
      ? firstUser.text.substring(0, 40) + (firstUser.text.length > 40 ? '…' : '')
      : 'New Chat';
    const session: ChatSession = {
      id: currentSessionId,
      title,
      date: new Date().toISOString(),
      preview: msgs[msgs.length - 1].text.substring(0, 60),
      messages: msgs,
    };
    saveChatSession(session);
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = session;
        return copy;
      }
      return [session, ...prev];
    });
  }, [currentSessionId]);

  const handleSubmit = useCallback(async (textInput: string = input) => {
    if (!textInput.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);
    setSuggestions([]);
    saveSession(newMessages);

    const history = newMessages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const aiId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: aiId, role: 'model', text: '', isLoading: true }]);

    let fullText = '';
    let groundingLinks: { title: string; url: string }[] = [];

    try {
      const stream = streamChatResponse(textInput, history, userProfile);

      for await (const chunk of stream) {
        fullText += chunk.text || '';
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          for (const c of chunk.candidates[0].groundingMetadata.groundingChunks) {
            if (c.web?.uri && c.web?.title && !groundingLinks.find((l) => l.url === c.web.uri)) {
              groundingLinks.push({ title: c.web.title, url: c.web.uri });
            }
          }
        }

        const parts = fullText.split('|||');
        const amPart = parts[0].trim();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, text: amPart, groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined, isLoading: false }
              : m
          )
        );
      }

      // Save completed session
      const finalMsgs = [
        ...newMessages,
        { id: aiId, role: 'model' as const, text: fullText.split('|||')[0].trim(), groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined },
      ];
      saveSession(finalMsgs);

      // Generate follow-up suggestions
      generateChatSuggestions(fullText.split('|||')[0].trim(), userProfile)
        .then((s) => { if (s && s.length > 0) setSuggestions(s); })
        .catch(() => {});
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId ? { ...m, text: 'ይቅርታ — ስህተት ተከስቷል። እባክዎ ዳግም ይሞክሩ።', isLoading: false } : m
        )
      );
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, messages, userProfile, saveSession]);

  const createNewChat = useCallback(() => {
    setCurrentSessionId(Date.now().toString());
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    setSuggestions(FALLBACK_SUGGESTIONS);
  }, []);

  const loadSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
  }, []);

  const handleDeleteSession = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteChatSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) createNewChat();
  }, [currentSessionId, createNewChat]);

  // Gather grounding links from all messages for the sources panel
  const allGroundingLinks = messages
    .flatMap((m) => m.groundingLinks || [])
    .filter((link, i, arr) => arr.findIndex((l) => l.url === link.url) === i);

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '300px 1fr 320px' }}>
      {/* ── Left — session history ── */}
      <aside className="border-r border-rule px-6 py-7 overflow-y-auto">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3.5">
          <Rubric>Ask Emmaus</Rubric>
        </div>
        <button
          onClick={createNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-ink text-parchment rounded font-sans text-[13px] font-medium mb-5 hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New question
          <span className="ml-auto font-mono text-[10px] opacity-50">{'⌘'}N</span>
        </button>

        {sessions.length > 0 && (
          <>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2.5">History</div>
            {sessions.slice(0, 20).map((s) => {
              const active = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => loadSession(s)}
                  className={`group px-3 py-2.5 mb-1.5 rounded font-garamond text-sm leading-snug text-ink-mid cursor-pointer transition-colors flex items-start gap-2 ${
                    active
                      ? 'bg-parchment-dark border-l-2 border-oxblood'
                      : 'border-l-2 border-transparent hover:bg-parchment-dark'
                  }`}
                >
                  <span className="flex-1 truncate">{s.title}</span>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-ink-soft"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </aside>

      {/* ── Center — conversation ── */}
      <main className="flex flex-col overflow-hidden">
        <div className="px-16 pt-10 flex-1 overflow-y-auto">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-oxblood mb-3.5">
            <Rubric>{`Conversation · ${messages.filter((m) => m.role === 'user').length} turns`}</Rubric>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className="mb-7">
              {msg.role === 'user' ? (
                <>
                  <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2">You</div>
                  <div className="font-garamond text-[22px] leading-[1.3] text-ink">{msg.text}</div>
                </>
              ) : (
                <div className="flex gap-4">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-oxblood grid place-items-center mt-1">
                    <CrossMark size={14} color="#F4EEDD" />
                  </div>
                  <div className="flex-1">
                    <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2">Emmaus</div>
                    {msg.isLoading && !msg.text ? (
                      <div className="flex gap-1.5 py-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-oxblood/40 animate-pulse"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="font-garamond text-[17px] leading-[1.62] text-ink whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Suggestions */}
          {suggestions.length > 0 && !isTyping && messages.length <= 1 && (
            <div className="mt-4 mb-8">
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3">
                Suggested questions
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    className="px-3 py-2 border border-rule font-ethiopic text-[14px] text-ink-mid cursor-pointer hover:border-ink-soft transition-colors"
                    style={{ background: 'var(--cream)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up suggestions after conversation */}
          {suggestions.length > 0 && !isTyping && messages.length > 1 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    className="px-3 py-1.5 border border-rule font-ethiopic text-[13px] text-ink-mid cursor-pointer hover:border-ink-soft transition-colors"
                    style={{ background: 'var(--cream)' }}
                  >
                    {'↳ '}{s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div
          className="px-16 py-5 border-t border-rule"
          style={{ background: 'linear-gradient(180deg, transparent, var(--parchment) 30%)' }}
        >
          <div className="border border-rule p-4 flex flex-col gap-2.5" style={{ background: 'var(--cream)' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder={isTyping ? 'Thinking…' : 'Ask a question…'}
              disabled={isTyping}
              className="font-garamond text-base text-ink bg-transparent outline-none placeholder:text-ink-soft w-full disabled:opacity-50"
            />
            <div className="flex items-center gap-2">
              {groundingOptions.map((c, idx) => (
                <div
                  key={c.l}
                  onClick={() => toggleGrounding(idx)}
                  className={`px-2.5 py-0.5 font-sans text-[10px] rounded-full border cursor-pointer transition-colors ${
                    c.on
                      ? 'border-ink bg-ink text-parchment'
                      : 'border-rule text-ink-mid hover:border-ink-soft'
                  }`}
                >
                  {c.on ? '✓ ' : ''}{c.l}
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2.5 font-mono text-[10px] text-ink-soft">
                <span>amharic · english</span>
                <button
                  onClick={() => handleSubmit()}
                  disabled={isTyping || !input.trim()}
                  className="px-3 py-1.5 bg-oxblood text-parchment rounded font-sans text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isTyping ? 'Thinking…' : 'Ask →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Right — sources panel ── */}
      <aside
        className="border-l border-rule px-7 py-8 overflow-y-auto"
        style={{ background: 'var(--cream)' }}
      >
        <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-3.5">
          <Rubric>Sources cited</Rubric>
        </div>

        {allGroundingLinks.length > 0 ? (
          allGroundingLinks.map((link, i) => (
            <div
              key={link.url}
              className={`py-3 ${i < allGroundingLinks.length - 1 ? 'border-b border-dashed border-rule' : ''}`}
            >
              <div className="flex gap-2.5 items-baseline">
                <span className="font-mono text-[10px] text-oxblood">[{i + 1}]</span>
                <div className="flex-1">
                  <div className="font-garamond text-[15px] font-medium">{link.title}</div>
                  <div className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.12em] mt-0.5 truncate">
                    {link.url.replace(/^https?:\/\//, '').split('/')[0]}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="font-garamond italic text-[13px] text-ink-soft">
            Sources will appear here as the conversation progresses.
          </div>
        )}

        {/* Follow-up suggestions in sidebar when present */}
        {suggestions.length > 0 && !isTyping && messages.length > 1 && (
          <>
            <div className="mt-7 font-sans text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-3.5">
              <Rubric>Suggested follow-ups</Rubric>
            </div>
            {suggestions.map((q) => (
              <div
                key={q}
                onClick={() => handleSubmit(q)}
                className="px-3 py-2.5 mb-1.5 border border-rule font-ethiopic text-[13.5px] leading-snug text-ink-mid cursor-pointer hover:border-ink-soft transition-colors"
                style={{ background: 'var(--parchment)' }}
              >
                {'↳ '}{q}
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  );
};
