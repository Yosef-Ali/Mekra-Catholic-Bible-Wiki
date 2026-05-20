import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamChatResponse, generateAndPlayAudio, generateChatSuggestions, getInitialLiturgicalSuggestions } from '../services/geminiService';
import { saveBookmark, saveChatSession, getChatSessions, deleteChatSession, saveUserProfile, getUserProfile } from '../services/storageService';
import { ChatMessage, ChatSession, UserProfile } from '../types';
import { Send, User, Sparkles, Languages, ExternalLink, RefreshCcw, Mic, Volume2, Copy, BookOpen, Heart, History, Loader2, Lightbulb, Bookmark, BookmarkCheck, Menu, Plus, Trash2, X, UserCog, Settings } from 'lucide-react';
import { useFooter } from '../App';
import { useScrollHideFooter } from '../hooks/useScrollHideFooter';
import { IconButton } from './ui/IconButton';
import { CrossMark } from './ui/ManuscriptPrimitives';

interface ExtendedChatMessage extends ChatMessage {
  englishText?: string;
  groundingLinks?: { title: string; url: string }[];
}

type ChatMode = 'default' | 'theologian' | 'pastoral' | 'historian';

const FALLBACK_SUGGESTIONS = [
  "የዛሬው የቅዳሴ ምንባባት",       // Today's Mass Readings
  "መዝሙረ ዳዊት 23 አብራራልኝ",    // Explain Psalm 23
  "ስለ እመቤታችን ንገረኝ",         // Tell me about Our Lady
  "ካቶሊኮች ለምን ለካህን ይናዘዛሉ?", // Why do Catholics confess to priests? (Apologetics)
  "ዐቢይ ጾም ምንድነው?",           // What is Lent?
];

const MODES: { id: ChatMode; label: string; icon: any; prompt: string }[] = [
  { id: 'default', label: 'Study Guide', icon: Sparkles, prompt: '' },
  { id: 'theologian', label: 'Theologian', icon: BookOpen, prompt: '[Tone: Theologian/Doctrinal - Cite CCC and Fathers] ' },
  { id: 'pastoral', label: 'Pastoral', icon: Heart, prompt: '[Tone: Pastoral/Comforting - Focus on spiritual growth] ' },
  { id: 'historian', label: 'Historian', icon: History, prompt: '[Tone: Historical/Contextual] ' },
];

export const ChatAssistant: React.FC = () => {
  // --- STATE ---
  const [currentSessionId, setCurrentSessionId] = useState<string>(Date.now().toString());
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([{
      id: 'welcome',
      role: 'model',
      text: 'ሰላም! እኔ የካቶሊክ መጽሐፍ ቅዱስ ረዳትዎ ነኝ። ስለ መጽሐፍ ቅዱስ፣ ስለ ካቶሊክ አስተምህሮ ወይም ስለ እለቱ ምንባባት (Calendar) ማንኛውንም ጥያቄ መጠየቅ ይችላሉ።'
  }]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('default');

  // History Sidebar & Profile
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Suggestions & UI
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [savedMessages, setSavedMessages] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { hideFooter, setHideFooter } = useFooter();

  // Use global scroll hide hook
  useScrollHideFooter(setHideFooter, scrollContainerRef);

  // Define scrollToBottom before usage
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // Load sessions
    setChatSessions(getChatSessions());
    // Load profile
    const profile = getUserProfile();
    setUserProfile(profile);
    if (!profile) {
      // First time? Maybe show modal or just let it be null
      // setShowProfileModal(true); // Optional: Force setup
    }

    // Load dynamic suggestions
    const loadInitialSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const dynamic = await getInitialLiturgicalSuggestions();
        if (dynamic && dynamic.length > 0) setSuggestions(dynamic);
        else setSuggestions(FALLBACK_SUGGESTIONS);
      } catch (e) {
        setSuggestions(FALLBACK_SUGGESTIONS);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadInitialSuggestions();
  }, []);

  useEffect(scrollToBottom, [messages]);

  // --- SESSION MANAGEMENT ---
  const createNewChat = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setMessages([{
        id: 'welcome',
        role: 'model',
        text: 'ሰላም! አዲስ ውይይት ጀምረናል። ምን ልርዳዎት?'
    }]);
    setSuggestions(FALLBACK_SUGGESTIONS);
    setSidebarOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteChatSession(id);
    setChatSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
        createNewChat();
    }
  };

  const saveCurrentSession = (msgs: ExtendedChatMessage[]) => {
    // Only save if we have actual user interaction
    if (msgs.length <= 1) return;

    // Generate a title based on first user message
    const firstUserMsg = msgs.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.text.substring(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '') : 'New Chat';

    const session: ChatSession = {
        id: currentSessionId,
        title: title,
        date: new Date().toISOString(),
        preview: msgs[msgs.length - 1].text.substring(0, 50),
        messages: msgs
    };

    saveChatSession(session);
    setChatSessions(prev => {
        const existing = prev.findIndex(s => s.id === session.id);
        if (existing >= 0) {
            const copy = [...prev];
            copy[existing] = session;
            return copy;
        }
        return [session, ...prev];
    });
  };

  // --- PROFILE MANAGEMENT ---
  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newProfile: UserProfile = {
        name: formData.get('name') as string,
        role: formData.get('role') as any,
        ageGroup: formData.get('ageGroup') as any,
        interests: (formData.get('interests') as string).split(',').map(s => s.trim())
    };
    saveUserProfile(newProfile);
    setUserProfile(newProfile);
    setShowProfileModal(false);

    // Reset chat to apply new persona
    setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Profile Updated! I will now speak to you as a ${newProfile.role} (${newProfile.ageGroup}).`
    }]);
  };

  // --- CHAT LOGIC ---
  const handleSubmit = async (textInput: string = input) => {
    if (!textInput.trim() || isTyping) return;

    // Determine context based on mode + userProfile
    const currentMode = MODES.find(m => m.id === mode) || MODES[0];
    const promptText = currentMode.prompt + textInput;

    const userMessage: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textInput
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);
    setSuggestions([]);

    // Save session optimistically
    saveCurrentSession(newMessages);

    const history = newMessages.map(m => ({
      role: m.role,
      parts: [{ text: m.text + (m.englishText ? ` ||| ${m.englishText}` : '') }]
    }));

    const aiMessageId = (Date.now() + 1).toString();
    const placeholderMsg: ExtendedChatMessage = { id: aiMessageId, role: 'model', text: '', isLoading: true };
    setMessages(prev => [...prev, placeholderMsg]);

    let fullRawText = "";
    let groundingLinks: { title: string; url: string }[] = [];

    try {
      // Pass UserProfile to service
      const stream = streamChatResponse(promptText, history, userProfile);

      for await (const chunk of stream) {
        const chunkText = chunk.text || "";
        fullRawText += chunkText;

        // Extract Links
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
            chunks.forEach((c: any) => {
                if (c.web?.uri && c.web?.title) {
                    if (!groundingLinks.find(l => l.url === c.web.uri)) {
                        groundingLinks.push({ title: c.web.title, url: c.web.uri });
                    }
                }
            });
        }

        const parts = fullRawText.split('|||');
        const amharicPart = parts[0].trim();
        const englishPart = parts.length > 1 ? parts[1].trim() : undefined;

        setMessages(prev => {
            const updated = prev.map(msg =>
                msg.id === aiMessageId
                    ? {
                        ...msg,
                        text: amharicPart,
                        englishText: englishPart,
                        groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined,
                        isLoading: false
                    }
                    : msg
            );
            return updated;
        });
      }

      // Save complete session
      const finalMessages = [...newMessages, {
          id: aiMessageId,
          role: 'model' as const,
          text: fullRawText.split('|||')[0].trim(),
          englishText: fullRawText.split('|||')[1]?.trim(),
          groundingLinks
      }];
      saveCurrentSession(finalMessages);

      // Generate suggestions based on profile
      setLoadingSuggestions(true);
      const newSuggestions = await generateChatSuggestions(fullRawText, userProfile);
      setSuggestions(newSuggestions);
      setLoadingSuggestions(false);

    } catch (err) {
      console.error(err);
      setSuggestions(FALLBACK_SUGGESTIONS);
    } finally {
      setIsTyping(false);
    }
  };

  // --- ACTIONS ---
  const startListening = () => {
    // Check for speech recognition support
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Voice input is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    // If already listening, stop
    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();

    // Try Amharic first, fallback to English
    recognition.lang = 'am-ET';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 3;

    let finalTranscript = '';
    let silenceTimer: NodeJS.Timeout | null = null;

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscript = '';
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);

      // If Amharic fails, try English
      if (event.error === 'language-not-supported' || event.error === 'no-speech') {
        const enRecognition = new SpeechRecognitionAPI();
        enRecognition.lang = 'en-US';
        enRecognition.interimResults = true;
        enRecognition.continuous = true;

        enRecognition.onstart = () => setIsListening(true);
        enRecognition.onend = () => setIsListening(false);
        enRecognition.onerror = () => setIsListening(false);
        enRecognition.onresult = (e: any) => {
          let transcript = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            transcript += e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              setInput(prev => prev ? `${prev} ${transcript}` : transcript);
            }
          }
        };

        try {
          enRecognition.start();
        } catch (err) {
          console.error('Fallback recognition failed:', err);
        }
      }
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + ' ';
          setInput(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
        } else {
          interimTranscript += transcript;
        }
      }

      // Auto-stop after 2 seconds of silence
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        recognition.stop();
      }, 2000);
    };

    // Store recognition instance for potential stop
    (window as any).__currentRecognition = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    const recognition = (window as any).__currentRecognition;
    if (recognition) {
      recognition.stop();
      (window as any).__currentRecognition = null;
    }
    setIsListening(false);
  };

  const speakText = async (text: string, msgId: string) => {
    if (playingAudioId === msgId) return;
    setPlayingAudioId(msgId);
    try { await generateAndPlayAudio(text); }
    catch (error) { console.error(error); }
    finally { setPlayingAudioId(null); }
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const handleSaveMessage = (text: string, id: string) => {
    saveBookmark({ type: 'chat', content: text, reference: 'AI Guidance' });
    setSavedMessages(prev => new Set(prev).add(id));
  };

  // --- RENDER HELPERS (Typography) ---
  const parseInlineStyles = (text: string, isUser: boolean) => {
    const boldClass = isUser ? 'font-black text-parchment' : 'font-black text-ink';
    const italicClass = isUser ? 'italic text-parchment/80 font-medium' : 'italic text-oxblood font-medium';
    const verseClass = isUser ? 'text-parchment font-bold text-xs bg-parchment/10 px-1.5 py-0.5 rounded mx-1' : 'text-oxblood font-bold text-xs bg-oxblood/20 px-1.5 py-0.5 rounded mx-1';
    const supClass = isUser ? 'text-parchment/60 font-black text-[0.65em] mx-0.5' : 'text-oxblood/70 font-black text-[0.65em] mx-0.5';

    return text
      .replace(/\*\*(.*?)\*\*/g, `<strong class="${boldClass}">$1</strong>`)
      .replace(/__(.*?)__/g, `<strong class="${boldClass}">$1</strong>`)
      .replace(/(?<!\*)\*(?!\*)(.*?)\*/g, `<em class="${italicClass}">$1</em>`)
      .replace(/(\(.*?\d+:\d+.*?\))/g, `<span class="${verseClass}">$1</span>`)
      .replace(/\[(\d+)\]/g, `<sup class="${supClass}">$1</sup>`);
  };

  const FormatMessage = ({ text, isUser }: { text: string, isUser: boolean }) => {
    if (!text) return null;
    const lines = text.split('\n');
    const textColor = isUser ? 'text-parchment' : 'text-ink';

    return (
        <div className={`space-y-4 font-serif text-[1.05rem] leading-8 ${textColor}`}>
            {lines.map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={index} className="h-1" />;
                if (trimmed.startsWith('## ')) return <h2 key={index} className="text-xl font-black mt-4" dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed.substring(3), isUser) }} />;
                if (trimmed.startsWith('### ')) return <h3 key={index} className="text-lg font-bold mt-2" dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed.substring(4), isUser) }} />;
                if (trimmed.startsWith('> ')) return <blockquote key={index} className={`border-l-4 ${isUser ? 'border-parchment/30' : 'border-oxblood/40'} pl-4 italic`}><div dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed.substring(2), isUser) }} /></blockquote>;
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) return <div key={index} className="flex gap-2 ml-4"><span className={isUser ? 'text-parchment/60' : 'text-oxblood'}>●</span><span dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed.substring(2), isUser) }} /></div>;
                return <p key={index} dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed, isUser) }} />;
            })}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: 'var(--parchment)' }}>

      {/* SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR - Manuscript Modern */}
      <div className={`fixed inset-y-0 left-0 w-72 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: 'var(--cream)', borderRight: '1px solid var(--rule)' }}>
         <div className="p-4 flex justify-between items-center" style={{ background: 'var(--parchment)', borderBottom: '1px solid var(--rule)' }}>
            <h2 className="font-garamond font-semibold text-ink flex items-center gap-2">
                <History size={18} className="text-oxblood" /> History
            </h2>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-rule/40 rounded-full text-ink-soft">
                <X size={18} />
            </button>
         </div>

         {/* New Chat Button */}
         <div className="p-4">
            <button
                onClick={createNewChat}
                className="w-full flex items-center justify-center gap-2 bg-oxblood text-parchment py-3 rounded-xl font-bold shadow-sm hover:bg-oxblood/90 transition-all"
            >
                <Plus size={18} /> New Chat
            </button>
         </div>

         {/* Profile Button */}
         <div className="px-4 pb-4">
            <button
                onClick={() => { setShowProfileModal(true); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-ink hover:bg-rule/30 transition-all text-sm font-bold"
                style={{ border: '1px solid var(--rule)' }}
            >
                <UserCog size={18} className="text-oxblood" />
                {userProfile ? 'Edit Profile' : 'Set My Profile'}
            </button>
         </div>

         {/* History List */}
         <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {chatSessions.length === 0 && (
                <p className="text-center text-ink-soft text-xs mt-10 font-garamond italic">No history yet.</p>
            )}
            {chatSessions.map(session => (
                <div
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-rule/30 border-l-4 border-oxblood' : 'hover:bg-rule/20'}`}
                >
                    <div className="overflow-hidden">
                        <h4 className="font-bold text-ink text-sm truncate">{session.title}</h4>
                        <p className="text-ink-soft text-[10px] truncate">{new Date(session.date).toLocaleDateString()}</p>
                    </div>
                    <button
                        onClick={(e) => deleteSession(e, session.id)}
                        className="text-ink-soft/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
         </div>
      </div>

      {/* USER PROFILE MODAL - Dark Theme */}
      {showProfileModal && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
                <div className="bg-oxblood p-6 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold font-garamond text-parchment">Who are you?</h2>
                        <p className="text-parchment/70 text-sm mt-1">Help the AI follow your spiritual journey.</p>
                    </div>
                    <button onClick={() => setShowProfileModal(false)} className="text-parchment/60 hover:text-parchment">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleProfileSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-oxblood uppercase font-mono mb-1">Name (Optional)</label>
                        <input name="name" defaultValue={userProfile?.name} className="w-full p-3 rounded-xl text-ink placeholder-ink-soft focus:ring-2 focus:ring-oxblood/50 outline-none" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }} placeholder="Enter your name" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-oxblood uppercase font-mono mb-1">Role / Vocation</label>
                            <select name="role" defaultValue={userProfile?.role || 'Layperson'} className="w-full p-3 rounded-xl text-ink focus:ring-2 focus:ring-oxblood/50 outline-none" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}>
                                <option value="Layperson">Layperson (ምዕመን)</option>
                                <option value="Student">Student (ተማሪ)</option>
                                <option value="Priest">Priest (ካህን)</option>
                                <option value="Nun">Nun (መነኩሲት)</option>
                                <option value="Catechist">Catechist (ስብከተ ወንጌል)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-oxblood uppercase font-mono mb-1">Age Group</label>
                            <select name="ageGroup" defaultValue={userProfile?.ageGroup || 'Adult'} className="w-full p-3 rounded-xl text-ink focus:ring-2 focus:ring-oxblood/50 outline-none" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}>
                                <option value="Child">Child (ህጻን)</option>
                                <option value="Youth">Youth (ወጣት)</option>
                                <option value="Adult">Adult (ጎልማሳ)</option>
                                <option value="Elder">Elder (ሽማግሌ)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-oxblood uppercase font-mono mb-1">Interests (Comma separated)</label>
                        <input name="interests" defaultValue={userProfile?.interests.join(', ') || 'Prayer, Bible'} className="w-full p-3 rounded-xl text-ink placeholder-ink-soft focus:ring-2 focus:ring-oxblood/50 outline-none" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }} placeholder="e.g. Liturgy, History, Saints" />
                    </div>

                    <button type="submit" className="w-full bg-oxblood text-parchment py-3 rounded-xl font-bold hover:bg-oxblood/90 shadow-sm mt-2 transition-all">
                        Save Profile
                    </button>
                </form>
            </div>
         </div>
      )}

      {/* HEADER - Manuscript Modern */}
      <div className="sticky top-0 z-30" style={{ background: 'rgba(244,238,221,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid var(--rule)' }}>
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-ink-soft hover:text-ink transition-colors" aria-label="Open chat history">
                  <Menu size={20} />
                </button>

                <div className="flex flex-col items-center">
                    <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-oxblood" style={{ fontVariant: 'small-caps' }}>Ask Emmaus</div>
                    <div className="font-sans text-[10px] text-ink-soft">grounded · {messages.length > 1 ? `${messages.length - 1} turns` : 'new'}</div>
                </div>
            </div>

            <div className="flex gap-2 items-center">
                <button onClick={createNewChat} className="p-1.5 text-ink-soft hover:text-ink transition-colors" title="New Chat" aria-label="New chat">
                  <Plus size={20} />
                </button>
                <button
                    onClick={() => setShowEnglish(!showEnglish)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        showEnglish ? 'bg-ink text-parchment border-ink' : 'text-ink-mid border-rule hover:border-ink-soft'
                    }`}
                >
                    <Languages size={14} />
                    <span className="hidden sm:inline">EN</span>
                </button>
            </div>
        </div>
      </div>

      {/* MESSAGES LIST - Manuscript Modern */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto space-y-6 scroll-smooth ${
          hideFooter ? 'pb-56' : 'pb-72'
        }`}
      >
      <div className="max-w-4xl mx-auto p-4 w-full">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isPlaying = playingAudioId === msg.id;
          const isSaved = savedMessages.has(msg.id);

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
              <div className={`flex flex-col max-w-[95%] md:max-w-[85%] gap-1 ${isUser ? 'items-end' : 'items-start'}`}>

                <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${
                    isUser ? 'bg-ink text-parchment' : 'bg-oxblood text-parchment'
                    }`}>
                    {isUser ? <User size={13} /> : <CrossMark size={12} color="#F4EEDD" />}
                    </div>

                    <div className={`relative p-4 md:p-5 text-sm md:text-base transition-all ${
                    isUser
                        ? 'bg-ink text-parchment rounded-[14px_14px_4px_14px]'
                        : 'text-ink rounded-[14px] rounded-tl-[4px]'
                    }`} style={!isUser ? { background: 'var(--cream)', border: '1px solid var(--rule)' } : {}}>

                    {msg.isLoading ? (
                        <div className="flex items-center gap-2 text-ink-soft py-2">
                            <Loader2 className="animate-spin" size={16} />
                            <span className="text-xs font-garamond italic">Thinking...</span>
                        </div>
                    ) : (
                         <FormatMessage text={msg.text} isUser={isUser} />
                    )}

                    {msg.englishText && showEnglish && (
                        <div className={`mt-4 pt-3 border-t font-garamond italic text-sm ${isUser ? 'border-parchment/20 text-parchment/70' : 'text-ink-mid'}`} style={!isUser ? { borderColor: 'var(--rule)' } : {}}>
                            <span className="font-mono not-italic text-[9px] uppercase tracking-[0.12em] opacity-70 block mb-1 flex items-center gap-1">
                                <Languages size={10} /> English
                            </span>
                            {msg.englishText}
                        </div>
                    )}
                    </div>
                </div>

                {!isUser && !msg.isLoading && (
                    <div className="ml-10 mt-2 flex flex-wrap gap-x-3 gap-y-2 items-center">
                        <div className="flex gap-1.5">
                             <button onClick={() => speakText(msg.text, msg.id)} disabled={isPlaying} className={`p-1.5 border border-rule rounded-full hover:bg-parchment-dark/20 flex items-center gap-1 transition-all ${isPlaying ? 'text-oxblood w-auto px-3' : 'text-ink-soft'}`} title="Read Aloud">
                                {isPlaying ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                                {isPlaying && <span className="text-xs font-mono">Reading…</span>}
                            </button>
                            <button onClick={() => handleSaveMessage(msg.text, msg.id)} className={`p-1.5 border rounded-full transition-all ${isSaved ? 'bg-ochre/10 border-ochre text-ochre' : 'border-rule text-ink-soft hover:text-ink'}`} title={isSaved ? "Saved" : "Save to Bookmarks"}>
                                {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                            </button>
                            <button onClick={() => copyToClipboard(msg.text)} className="p-1.5 border border-rule rounded-full text-ink-soft hover:text-ink transition-all" title="Copy Text">
                                <Copy size={14} />
                            </button>
                        </div>
                        {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 border-l border-rule pl-2">
                                {msg.groundingLinks.map((link, idx) => (
                                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] border border-rule text-ink-mid px-2 py-1 rounded-full hover:border-ink-soft transition-colors" style={{ background: 'var(--parchment)' }}>
                                        <ExternalLink size={10} className="text-oxblood" /> {link.title || 'Source'}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      </div>

      {/* INPUT AREA - Manuscript Modern */}
      <div
        className={`fixed left-0 right-0 px-4 pt-3 pb-4 pb-safe z-40 transition-all duration-300 ${
          hideFooter ? 'bottom-4' : 'bottom-[70px]'
        }`}
        style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)' }}
      >
        {/* Suggestion Pills */}
        {(suggestions.length > 0 || loadingSuggestions) && !isTyping && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Sparkles size={12} className="text-ochre" />
              <span className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.14em]">Try next</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
              {loadingSuggestions ? (
                <div className="flex items-center gap-2 px-4 py-2 border border-rule text-xs text-ink-soft" style={{ background: 'var(--cream)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="font-garamond">Loading…</span>
                </div>
              ) : (
                suggestions.map((s, idx) => (
                  <button
                    key={`${idx}-${s}`}
                    onClick={() => handleSubmit(s)}
                    className="flex-shrink-0 snap-start px-3 py-2 border border-rule font-garamond text-[13.5px] text-ink-mid hover:border-ink-soft active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
                    style={{ background: 'var(--parchment)' }}
                  >
                    ↳ {s}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="max-w-4xl mx-auto relative">
          <div className={`flex items-center gap-2 p-2 rounded-lg border transition-all duration-300 ${
            isListening
              ? 'border-red-400 ring-2 ring-red-200'
              : 'border-rule focus-within:border-ink-soft'
          }`} style={{ background: 'var(--cream)' }}>
            {/* Voice Button */}
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`relative p-2.5 rounded-md transition-all duration-300 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Mic size={18} />
              {isListening && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full animate-bounce" />
              )}
            </button>

            {/* Input Field */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening…" : "Ask a follow-up…"}
              className="flex-1 py-2.5 px-1 bg-transparent text-ink placeholder-ink-soft/60 outline-none font-garamond text-[14px]"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-[30px] h-[30px] rounded-md bg-oxblood text-parchment flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            >
              <Send size={14} />
            </button>
          </div>

          {/* Voice Status Indicator */}
          {isListening && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-in slide-in-from-bottom-2 duration-200">
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_infinite]" />
                <span className="w-1 h-4 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_0.1s_infinite]" />
                <span className="w-1 h-2 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_0.2s_infinite]" />
                <span className="w-1 h-5 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_0.3s_infinite]" />
                <span className="w-1 h-3 bg-white rounded-full animate-[soundwave_0.5s_ease-in-out_0.4s_infinite]" />
              </span>
              <span>Recording...</span>
              <button onClick={stopListening} className="ml-1 p-0.5 hover:bg-red-600 rounded">
                <X size={12} />
              </button>
            </div>
          )}
        </form>

        {/* Grounding source chips — matches MobileAskAI design */}
        <div className="mt-1.5 flex gap-1.5 max-w-4xl mx-auto">
          {['✓ Compendium', '✓ Scripture', "Ge'ez"].map((c, i) => (
            <span
              key={c}
              className="font-sans text-[10px] px-2 py-0.5 rounded-full"
              style={{
                border: `1px solid ${i < 2 ? 'var(--ink)' : 'var(--rule)'}`,
                background: i < 2 ? 'var(--ink)' : 'transparent',
                color: i < 2 ? 'var(--parchment)' : 'var(--ink-mid)',
              }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* AI Disclaimer */}
        <p className="text-center font-mono text-[9px] text-ink-soft mt-2 tracking-[0.06em]">
          AI ስህተት ሊሠራ ስለሚችል እባክዎ መረጃውን ያረጋግጡ።
        </p>
      </div>
    </div>
  );
};
