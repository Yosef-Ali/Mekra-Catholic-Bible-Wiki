import React, { useState, useEffect, useRef, useCallback } from 'react';
import { booksApi, chaptersApi } from '../services/apiClient';
import { BibleBook, UserProfile } from '../types';
import { getUserProfile } from '../services/storageService';
import { generateAndPlayAudio, stopAudioPlayback, pauseAudioPlayback, resumeAudioPlayback, setTTSPlaybackRate } from '../services/geminiService';
import { Volume2, Search, MoreHorizontal, ChevronLeft, ChevronRight, Play, Pause, Square, ChevronDown, X, PencilLine, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from './ui/Drawer';
import { IconButton } from './ui/IconButton';
import { useFooter } from '../App';
import { useScrollHideFooter } from '../hooks/useScrollHideFooter';
import TypographyEditor from './TypographyEditor';
import { useTypography } from '../contexts/TypographyContext';

interface FormattingRules {
  sections: Array<{ type: string; verseRange: [number, number]; indent?: number }>;
  hasPoetry: boolean;
  hasLists: boolean;
  primaryStyle: string;
  paragraphBreaks?: number[];
  subtitles?: Array<{ verse: number; text: string }>;
}

interface DisplayVerse {
  type: 'verse' | 'header' | 'subtitle';
  number: number;
  text?: string;
  sectionType?: 'prose' | 'poetry' | 'list';
  indent?: number;
  isNewParagraph?: boolean;
}

export const BibleReader: React.FC = () => {
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<DisplayVerse[]>([]);
  const [hasPoetry, setHasPoetry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [availableChapters, setAvailableChapters] = useState<Record<number, number[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [editorValue, setEditorValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { hideFooter, setHideFooter } = useFooter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  useScrollHideFooter(setHideFooter, scrollRef);

  // Reader settings (typography + navigation helpers)
  const { settings } = useTypography();
  const [typographyOpen, setTypographyOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpVerseValue, setJumpVerseValue] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [spotlightVerseNumber, setSpotlightVerseNumber] = useState<number | null>(null);

  // Audio/Speech states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Get formatting type for a verse using formattingRules
  const getVerseFormatting = useCallback((verseNumber: number, rules: FormattingRules | null): { type: string; indent: number } => {
    if (!rules?.sections) return { type: 'prose', indent: 0 };

    for (const section of rules.sections) {
      const [start, end] = section.verseRange || [0, 0];
      if (verseNumber >= start && verseNumber <= end) {
        return { type: (section.type || 'prose').toLowerCase(), indent: section.indent || 0 };
      }
    }
    return { type: 'prose', indent: 0 };
  }, []);

  // Parse content with formattingRules
  const parseContent = useCallback((raw: any, rules: FormattingRules | null): { verses: DisplayVerse[]; hasPoetry: boolean } => {
    if (!raw?.sections) return { verses: [], hasPoetry: false };

    const verses: DisplayVerse[] = [];
    const poetry = rules?.hasPoetry || false;
    const paragraphBreaks = rules?.paragraphBreaks || [];
    const subtitles = rules?.subtitles || [];

    // Create a map of subtitles by verse number
    const subtitleMap = new Map(subtitles.map(s => [s.verse, s.text]));

    for (const section of raw.sections) {
      if (section.title) {
        verses.push({ type: 'header', number: 0, text: section.title });
      }

      if (section.verses) {
        for (const v of section.verses) {
          const verseNum = v.verse_number || 0;

          // Check if there's a subtitle before this verse
          if (subtitleMap.has(verseNum)) {
            verses.push({ type: 'subtitle', number: verseNum, text: subtitleMap.get(verseNum) });
          }

          // Use formattingRules if available, otherwise fall back to section.type
          const formatting = rules ? getVerseFormatting(verseNum, rules) : { type: (section.type || 'prose').toLowerCase(), indent: 0 };

          // Check if this verse starts a new paragraph
          const isNewParagraph = paragraphBreaks.includes(verseNum);

          verses.push({
            type: 'verse',
            number: verseNum,
            text: v.text || '',
            sectionType: formatting.type as 'prose' | 'poetry' | 'list',
            indent: v.indent || formatting.indent || 0,
            isNewParagraph
          });
        }
      }
    }

    return { verses, hasPoetry: poetry };
  }, [getVerseFormatting]);

  const getSectionHeader = () => content.find(v => v.type === 'header')?.text || null;
  const getShortName = () => selectedBook?.amharicName?.replace(' ወንጌል', '').replace(' መጽሐፍ', '').replace('ኦሪት ', '') || '';
  const handlePrev = () => { if (chapter > 1) setChapter(chapter - 1); };
  const handleNext = () => { if (selectedBook && chapter < selectedBook.chapters) setChapter(chapter + 1); };
  const selectChapter = (book: BibleBook, ch: number) => { setSelectedBook(book); setChapter(ch); setDrawerOpen(false); setExpandedBookId(null); };
  const filteredBooks = books.filter(b => b.amharicName.includes(searchQuery) || b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isAdmin = userProfile?.role === 'Priest' || userProfile?.role === 'Theologian' || userProfile?.role === 'Catechist';

  const verseNumbers = content.filter(v => v.type === 'verse' && v.number > 0).map(v => v.number);
  const maxVerseNumber = verseNumbers.length ? Math.max(...verseNumbers) : 0;

  const openTypography = () => {
    setShowMore(false);
    setJumpOpen(false);
    setJumpError('');
    setTypographyOpen(true);
  };

  const openJumpToVerse = () => {
    setShowMore(false);
    setTypographyOpen(false);
    setJumpError('');
    setJumpVerseValue('');
    setJumpOpen(true);
  };

  const jumpToVerse = (requestedVerseNumber: number) => {
    const verseNumber = maxVerseNumber > 0 ? Math.min(requestedVerseNumber, maxVerseNumber) : requestedVerseNumber;
    const verseEl = document.getElementById(`verse-${verseNumber}`);
    if (!verseEl) {
      setJumpError(`Verse ${verseNumber} not found in this chapter.`);
      return;
    }
    verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSpotlightVerseNumber(verseNumber);
    setJumpOpen(false);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(jumpVerseValue);
    if (!Number.isFinite(n)) return;
    const verseNumber = Math.floor(n);
    if (verseNumber <= 0) return;
    jumpToVerse(verseNumber);
  };

  // Audio/Speech functions — single lock prevents duplicate playback
  const stopAudioRef = useRef(false);
  const playingLock = useRef(false);    // true while a speakVerse chain is active
  const sessionIdRef = useRef(0);       // incremented on each new play; stale chains bail out

  const totalVerses = content.filter((v: DisplayVerse) => v.type === 'verse' && v.text).length;

  const stopAudio = useCallback(() => {
    sessionIdRef.current++;           // invalidate any running chain
    stopAudioRef.current = true;
    playingLock.current = false;
    stopAudioPlayback();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentVerseIndex(-1);
  }, []);

  const speakVerse = useCallback(async (verseIndex: number, session: number) => {
    // Bail if a newer session started or stop was requested
    if (session !== sessionIdRef.current || stopAudioRef.current) {
      playingLock.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentVerseIndex(-1);
      return;
    }

    const verses = content.filter((v: DisplayVerse) => v.type === 'verse' && v.text);
    if (verseIndex >= verses.length) {
      playingLock.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentVerseIndex(-1);
      return;
    }

    const verse = verses[verseIndex];
    setCurrentVerseIndex(verseIndex);

    const verseEl = document.getElementById(`verse-${verse.number}`);
    verseEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      await generateAndPlayAudio(verse.text || '');
      if (session === sessionIdRef.current && !stopAudioRef.current) {
        speakVerse(verseIndex + 1, session);
      }
    } catch (error: any) {
      // AbortError means stop/skip was pressed — do NOT advance to next verse
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('TTS error:', error);
      if (session === sessionIdRef.current && !stopAudioRef.current) {
        speakVerse(verseIndex + 1, session);
      }
    }
  }, [content]);

  const playAudio = useCallback(() => {
    // Prevent duplicate: stop any existing chain first
    if (playingLock.current) {
      stopAudioPlayback();
    }
    stopAudioRef.current = false;
    playingLock.current = true;
    const session = ++sessionIdRef.current;
    setIsPlaying(true);
    setIsPaused(false);
    speakVerse(0, session);
  }, [speakVerse]);

  const toggleAudio = useCallback(() => {
    if (isPaused) {
      resumeAudioPlayback();
      setIsPaused(false);
    } else if (isPlaying) {
      pauseAudioPlayback();
      setIsPaused(true);
    } else {
      playAudio();
    }
  }, [isPlaying, isPaused, playAudio]);

  const skipForward = useCallback(() => {
    if (!isPlaying || currentVerseIndex < 0) return;
    stopAudioPlayback();             // stop current verse audio
    stopAudioRef.current = false;    // allow new chain
    const session = ++sessionIdRef.current;  // new session invalidates old chain
    speakVerse(currentVerseIndex + 1, session);
  }, [isPlaying, currentVerseIndex, speakVerse]);

  const skipBack = useCallback(() => {
    if (!isPlaying || currentVerseIndex <= 0) return;
    stopAudioPlayback();
    stopAudioRef.current = false;
    const session = ++sessionIdRef.current;
    speakVerse(currentVerseIndex - 1, session);
  }, [isPlaying, currentVerseIndex, speakVerse]);

  const changeSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    setTTSPlaybackRate(speed);
    setShowSpeedMenu(false);
  }, []);

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handler = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSpeedMenu]);

  // Stop audio when chapter changes
  useEffect(() => {
    stopAudio();
    setSpotlightVerseNumber(null);
    setJumpOpen(false);
    setTypographyOpen(false);
    setShowMore(false);
  }, [chapter, selectedBook, stopAudio]);

  useEffect(() => {
    if (spotlightVerseNumber === null) return;
    const t = window.setTimeout(() => setSpotlightVerseNumber(null), 2500);
    return () => window.clearTimeout(t);
  }, [spotlightVerseNumber]);

  useEffect(() => {
    if (showSearch) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showSearch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMore(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => { setUserProfile(getUserProfile()); }, []);

  const loadChapter = useCallback(async () => {
    if (!selectedBook) return;
    try {
      setLoading(true);
      setSaveMessage(''); setSaveError('');

      const { content: raw, formattingRules } = await chaptersApi.getContent(selectedBook.id, chapter);
      const rawString = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '', null, 2);
      setRawContent(rawString || '');
      setEditorValue(rawString || '');
      setIsEditing(false);

      let parsed: any = raw;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
      }

      const { verses, hasPoetry: poetry } = parseContent(parsed, formattingRules || null);
      setContent(verses);
      setHasPoetry(poetry);
    } catch (error) {
      console.error('Failed to load chapter content', error);
      setContent([]);
      setHasPoetry(false);
    } finally {
      setLoading(false);
    }
  }, [selectedBook, chapter, parseContent]);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const fetchedBooks = await booksApi.getAll();
        setBooks(fetchedBooks);
        const john = fetchedBooks.find(b => b.name === 'John') || fetchedBooks[0];
        if (john) setSelectedBook(john);
      } catch (error) { console.error('Failed to load books:', error); }
    };
    fetchBooks();
  }, []);

  useEffect(() => { loadChapter(); }, [loadChapter]);

  const handleSaveChapter = async () => {
    if (!selectedBook || !editorValue.trim()) return;
    setSaving(true); setSaveMessage(''); setSaveError('');

    let payload: any = editorValue;
    const trimmed = editorValue.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { payload = JSON.parse(editorValue); }
      catch { setSaveError('Invalid JSON.'); setSaving(false); return; }
    }

    try {
      await chaptersApi.updateContent(selectedBook.id, chapter, payload);
      setSaveMessage('Saved!');
      setIsEditing(false);
      await loadChapter();
    } catch { setSaveError('Save failed.'); }
    finally { setSaving(false); }
  };

  // Render verses with proper formatting
  const renderFormattedContent = () => {
    // Include both verses and subtitles
    const items = content.filter(v => v.type === 'verse' || v.type === 'subtitle');
    // Pre-build index map for O(1) verse lookup (used for audio highlighting)
    const verseIndexMap = new Map(
      content.filter(v => v.type === 'verse').map((v, i) => [v.number, i])
    );

    // Render subtitles first, then group verses
    const result: React.ReactNode[] = [];
    let currentParagraph: DisplayVerse[] = [];
    let currentType = 'prose';

    const flushParagraph = (groupIdx: number) => {
      if (currentParagraph.length === 0) return null;

      const groupType = currentType.toLowerCase();
      const paragraphVerses = [...currentParagraph];
      currentParagraph = [];

      if (groupType === 'poetry') {
        return (
          <div key={`p-${groupIdx}`} className="my-5 ml-4 text-left">
            {paragraphVerses.map((verse, idx) => {
              const rawLines = (verse.text || '').split(/(?<=[፦፥።])/g).filter(l => l.trim());
              const lines: string[] = [];
              let pending = '';
              for (const line of rawLines) {
                const combined = pending + (pending ? ' ' : '') + line.trim();
                const wordCount = combined.split(/\s+/).filter(w => w).length;
                if (wordCount < 2) { pending = combined; }
                else { lines.push(combined); pending = ''; }
              }
              if (pending) lines.push(pending);

              const verseIdx = verseIndexMap.get(verse.number) ?? -1;
              const isCurrentVerse = verseIdx === currentVerseIndex;
              const isSpotlight = verse.number === spotlightVerseNumber;
              const isHighlighted = isCurrentVerse || isSpotlight;

              return (
                <div key={idx} id={`verse-${verse.number}`}
                  className={`my-1 rounded-lg transition-all duration-300 ${isHighlighted ? 'bg-ochre/15 -mx-2 px-2 py-1 ring-1 ring-ochre/25' : ''}`}>
                  {lines.map((line, lineIdx) => (
                    <p key={lineIdx} style={{ paddingLeft: lineIdx === 0 ? '1.5rem' : '2.5rem', textIndent: lineIdx === 0 ? '-1.5rem' : '0' }}>
                      {lineIdx === 0 && verse.number > 0 && (
                        <sup className={`text-[10px] font-semibold mr-1.5 -ml-1 ${isHighlighted ? 'text-oxblood' : 'text-oxblood/80'}`}>{verse.number}</sup>
                      )}
                      <span className={isHighlighted ? 'text-ink font-medium' : ''}>{line.trim()}</span>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        );
      } else {
        // Prose paragraph
        return (
          <p key={`p-${groupIdx}`} className="mb-4 text-justify">
            {paragraphVerses.map((verse, idx) => {
              const verseIdx = verseIndexMap.get(verse.number) ?? -1;
              const isCurrentVerse = verseIdx === currentVerseIndex;
              const isSpotlight = verse.number === spotlightVerseNumber;
              const isHighlighted = isCurrentVerse || isSpotlight;

              return (
                <span key={idx} id={`verse-${verse.number}`}
                  className={`transition-all duration-300 ${isHighlighted ? 'bg-ochre/15 rounded px-1 ring-1 ring-ochre/25' : ''}`}>
                  {verse.number > 0 && <sup className={`text-xs font-bold mr-1 ${isHighlighted ? 'text-oxblood' : 'text-oxblood/70'}`}>{verse.number}</sup>}
                  <span className={isHighlighted ? 'font-medium' : ''}>{verse.text} </span>
                </span>
              );
            })}
          </p>
        );
      }
    };

    let paragraphIdx = 0;
    for (const item of items) {
      if (item.type === 'subtitle') {
        // Flush current paragraph before subtitle
        const para = flushParagraph(paragraphIdx++);
        if (para) result.push(para);

        // Render subtitle
        result.push(
          <h3 key={`sub-${item.number}`} className="text-oxblood font-garamond font-bold text-lg mt-6 mb-3 pb-2" style={{ borderBottom: '1px solid var(--rule)' }}>
            {item.text}
          </h3>
        );
      } else if (item.type === 'verse') {
        const sectionType = item.sectionType || 'prose';

        // Check if we need to start a new paragraph
        if (item.isNewParagraph && currentParagraph.length > 0) {
          const para = flushParagraph(paragraphIdx++);
          if (para) result.push(para);
        }

        // Check if section type changed
        if (sectionType !== currentType && currentParagraph.length > 0) {
          const para = flushParagraph(paragraphIdx++);
          if (para) result.push(para);
        }

        currentType = sectionType;
        currentParagraph.push(item);
      }
    }

    // Flush remaining
    const para = flushParagraph(paragraphIdx);
    if (para) result.push(para);

    return result;
  };

  return (
    <div className="flex flex-col h-full text-ink" style={{ background: 'var(--parchment)' }}>
      {/* Top Bar */}
	      <div className="flex items-center justify-between px-4 pt-12 pb-3 relative">
	        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--parchment), transparent)' }} />
	        <div className="flex items-center gap-2 relative">
	          <IconButton
	            tone="sepia"
	            onClick={toggleAudio}
	            title={isPlaying && !isPaused ? 'Pause' : 'Play Audio'}
	            aria-label={isPlaying && !isPaused ? 'Pause audio' : 'Play audio'}
	            className={isPlaying ? 'ring-1 ring-oxblood' : undefined}
	          >
	            {isPlaying && !isPaused ? <Pause size={20} className="text-oxblood" /> : <Volume2 size={20} className="text-ink-soft" />}
	          </IconButton>
	          {isPlaying && (
	            <IconButton tone="sepia" onClick={stopAudio} title="Stop" aria-label="Stop audio">
	              <Square size={18} className="text-ink-soft" style={{ fill: 'var(--ink)' }} />
	            </IconButton>
	          )}
	          {showSearch ? (
	            <div className="flex items-center gap-2 rounded-full px-3 py-2 backdrop-blur-xl" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
	              <Search size={18} className="text-ink-soft" />
	              <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent text-ink placeholder-ink-soft outline-none text-sm" />
	              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 rounded-full hover:bg-rule/40"><X size={16} className="text-ink-soft" /></button>
	            </div>
	          ) : (
	            <IconButton tone="sepia" onClick={() => setShowSearch(true)} title="Search" aria-label="Search">
	              <Search size={20} className="text-ink-soft" />
	            </IconButton>
	          )}
	          {isAdmin && (
	            <button className={`flex items-center gap-1 px-3 py-2 rounded-full text-ink text-xs font-semibold hover:bg-rule/30 ${isEditing ? 'ring-1 ring-oxblood' : ''}`} style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }} onClick={() => { setIsEditing((v) => !v); setEditorValue(rawContent); }}>
	              <PencilLine size={16} className="text-oxblood" />
	              <span>{isEditing ? 'Close' : 'Edit'}</span>
            </button>
          )}
        </div>
        <div className="flex-1" />
	        <div className="relative" ref={moreMenuRef}>
	          <IconButton tone="sepia" title="More" aria-label="More" onClick={() => setShowMore((v) => !v)}>
	            <MoreHorizontal size={20} className="text-ink-soft" />
	          </IconButton>
	          {showMore && (
	            <div className="absolute right-0 mt-3 w-48 py-2 z-20 backdrop-blur-xl" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', borderRadius: '0.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}>
	              <button onClick={openTypography} className="w-full flex items-center gap-2 px-4 py-2 text-left text-ink hover:bg-rule/30">
	                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-oxblood" style={{ background: 'var(--parchment)' }}>A</span>
	                <span className="text-sm">Typography</span>
	              </button>
	              <button onClick={openJumpToVerse} className="w-full flex items-center gap-2 px-4 py-2 text-left text-ink hover:bg-rule/30">
	                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-oxblood" style={{ background: 'var(--parchment)' }}>⇧</span>
	                <span className="text-sm">Jump to Verse</span>
	              </button>
	            </div>
	          )}
	        </div>
	      </div>

	      {/* Typography Drawer */}
	      <Drawer open={typographyOpen} onOpenChange={setTypographyOpen}>
	        <DrawerContent className="max-h-[85vh] text-ink sm:max-w-lg sm:mx-auto sm:rounded-2xl sm:bottom-8 sm:border-t-0 border-x border-t" style={{ background: 'var(--cream)', borderColor: 'var(--rule)' }}>
	          <DrawerHeader className="pb-2">
	            <div className="flex items-center justify-between gap-3">
	              <div>
	                <DrawerTitle className="text-ink font-garamond">Reading Settings</DrawerTitle>
	                <p className="mt-1 text-xs text-ink-soft">Tune the text for comfortable Amharic reading.</p>
	              </div>
	              <DrawerClose asChild>
	                <button
	                  type="button"
	                  className="p-2 rounded-full text-ink-soft hover:bg-rule/40"
	                  style={{ border: '1px solid var(--rule)' }}
	                  aria-label="Close"
	                >
	                  <X size={18} />
	                </button>
	              </DrawerClose>
	            </div>
	          </DrawerHeader>
	          <TypographyEditor />
	        </DrawerContent>
	      </Drawer>

	      {/* Jump To Verse Drawer */}
	      <Drawer
	        open={jumpOpen}
	        onOpenChange={(open) => {
	          setJumpOpen(open);
	          if (!open) setJumpError('');
	        }}
	      >
	        <DrawerContent className="max-h-[70vh] text-ink sm:max-w-md sm:mx-auto sm:rounded-2xl sm:bottom-8 sm:border-t-0 border-x border-t" style={{ background: 'var(--cream)', borderColor: 'var(--rule)' }}>
	          <DrawerHeader className="pb-2">
	            <div className="flex items-center justify-between gap-3">
	              <div>
	                <DrawerTitle className="text-ink font-garamond">Jump to Verse</DrawerTitle>
	                <p className="mt-1 text-xs text-ink-soft">
	                  {maxVerseNumber > 0 ? `Available: 1–${maxVerseNumber}` : 'Load a chapter to jump.'}
	                </p>
	              </div>
	              <DrawerClose asChild>
	                <button
	                  type="button"
	                  className="p-2 rounded-full text-ink-soft hover:bg-rule/40"
	                  style={{ border: '1px solid var(--rule)' }}
	                  aria-label="Close"
	                >
	                  <X size={18} />
	                </button>
	              </DrawerClose>
	            </div>
	          </DrawerHeader>

	          <form onSubmit={handleJumpSubmit} className="px-4 pb-6 space-y-3">
	            <div className="flex items-center gap-2">
	              <input
	                type="number"
	                inputMode="numeric"
	                min={1}
	                max={maxVerseNumber || undefined}
	                value={jumpVerseValue}
	                onChange={(e) => {
	                  setJumpError('');
	                  setJumpVerseValue(e.target.value);
	                }}
	                placeholder="Enter verse number"
	                className="flex-1 h-12 rounded-xl px-4 text-ink placeholder-ink-soft outline-none focus:border-oxblood/50"
	                style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}
	                autoFocus
	              />
	              <button
	                type="submit"
	                disabled={!jumpVerseValue.trim()}
	                className="h-12 px-4 rounded-xl bg-oxblood text-parchment font-bold disabled:opacity-40"
	              >
	                Go
	              </button>
	            </div>

	            {jumpError && <p className="text-xs text-red-400">{jumpError}</p>}
	          </form>
	        </DrawerContent>
	      </Drawer>

	      {/* Scrollable Content */}
	      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-6 ${hideFooter ? 'pb-28' : 'pb-36'}`}>
	        {loading ? (
	          <div className="flex items-center justify-center h-64">
	            <div className="animate-spin w-8 h-8 border-2 border-rule border-t-oxblood rounded-full" />
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="relative w-full h-48 sm:h-56 mb-8 overflow-hidden group" style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}>
              {/* Background Image - Right aligned */}
              <div className="absolute right-0 top-0 h-full w-[85%] sm:w-[60%]">
                <img
                  src={selectedBook?.heroImage || "/default_hero.jpg"}
                  alt={selectedBook?.name || "Bible Reader"}
                  className="h-full w-full object-cover object-top opacity-60 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, transparent, var(--cream) 70%)' }} />
              </div>

              {/* Content - Left Aligned */}
              <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center items-start z-10">
                 <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft mb-3 flex items-center gap-2">
                    <span className="w-8 h-[1px]" style={{ background: 'var(--rule)' }}></span>
                    የመጽሐፍ ክፍል
                 </p>
                 <h2 className="font-ethiopic text-ink text-3xl sm:text-4xl font-bold mb-2 break-normal max-w-[60%]">
                    {getShortName()}
                 </h2>
                 <span className="text-oxblood text-6xl sm:text-7xl font-black leading-none tracking-tighter font-garamond">
                    {chapter}
                 </span>
              </div>
            </div>

            {/* Poetry indicator badge */}
            {hasPoetry && (
              <div className="flex justify-center mb-5">
                <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full text-ochre font-semibold font-mono" style={{ background: 'rgba(182,133,48,0.1)', border: '1px solid rgba(182,133,48,0.3)' }}>
                  ✦ ግጥማዊ ክፍል አለው
                </span>
              </div>
            )}

            {getSectionHeader() && (
              <h3 className="text-ink text-center text-[1.08rem] font-semibold mb-7 tracking-[0.06em] font-ethiopic">{getSectionHeader()}</h3>
            )}

            {/* Admin panel */}
            {isAdmin && isEditing && (
              <div className="mx-2 mb-6 backdrop-blur-xl shadow-sm" style={{ border: '1px solid var(--rule)', background: 'var(--cream)', borderRadius: '0.75rem' }}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="text-xs text-oxblood font-mono">Editing: {getShortName()} {chapter}</p>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-ink text-xs" style={{ border: '1px solid var(--rule)' }} onClick={() => setIsEditing(false)}>Cancel</button>
                    <button className="px-3 py-1.5 rounded-lg bg-oxblood text-parchment text-xs font-bold disabled:opacity-50" onClick={handleSaveChapter} disabled={saving}>{saving ? '...' : 'Save'}</button>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <textarea value={editorValue} onChange={(e) => setEditorValue(e.target.value)} className="w-full min-h-[200px] rounded-xl text-ink p-3 text-sm font-mono resize-vertical focus:outline-none" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }} spellCheck={false} />
                </div>
                {(saveMessage || saveError) && <div className="px-4 pb-3">{saveMessage && <p className="text-xs text-green-600">{saveMessage}</p>}{saveError && <p className="text-xs text-red-500">{saveError}</p>}</div>}
              </div>
            )}

            {/* Main formatted content */}
            <div
              className="text-ink max-w-3xl mx-auto px-1 text-justify transition-all duration-200"
              style={{
                fontFamily: '"Noto Serif Ethiopic", serif',
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
                letterSpacing: settings.letterSpacing ? `${settings.letterSpacing}px` : undefined,
                wordSpacing: settings.wordSpacing ? `${settings.wordSpacing}px` : undefined,
              }}
            >
              {renderFormattedContent()}
            </div>
          </>
        )}
      </div>

      {/* Audio Controls Panel — slides in when playing */}
      {isPlaying && (
        <div className="fixed left-0 right-0 z-50 backdrop-blur-xl" style={{ bottom: hideFooter ? '0px' : '6.5rem', background: 'rgba(244,238,221,0.95)', borderTop: '1px solid var(--rule)' }}>
          <div className="max-w-3xl mx-auto px-4 py-2">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-ink-soft font-mono tabular-nums w-8 text-right">{currentVerseIndex + 1}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--rule)' }}>
                <div
                  className="h-full rounded-full bg-oxblood transition-all duration-300"
                  style={{ width: `${totalVerses > 0 ? ((currentVerseIndex + 1) / totalVerses) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-ink-soft font-mono tabular-nums w-8">{totalVerses}</span>
            </div>
            {/* Controls row */}
            <div className="flex items-center justify-center gap-5">
              {/* Speed */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  onClick={() => setShowSpeedMenu(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-oxblood hover:bg-rule/30 transition-colors"
                  title="Playback speed"
                >
                  <Gauge size={14} />
                  <span>{playbackSpeed}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 rounded-xl py-1 min-w-[4rem] z-50" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}>
                    {SPEED_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className={`block w-full text-center px-3 py-1.5 text-sm hover:bg-rule/30 transition-colors ${s === playbackSpeed ? 'text-oxblood font-bold' : 'text-ink'}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={skipBack} disabled={currentVerseIndex <= 0} className="p-2 rounded-full hover:bg-rule/30 disabled:opacity-30 transition-colors" title="Previous verse">
                <SkipBack size={20} className="text-ink" />
              </button>

              <button
                onClick={toggleAudio}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-oxblood text-parchment shadow-sm"
              >
                {isPaused ? <Play size={22} className="ml-0.5" fill="var(--parchment)" /> : <Pause size={22} fill="var(--parchment)" />}
              </button>

              <button onClick={skipForward} disabled={currentVerseIndex >= totalVerses - 1} className="p-2 rounded-full hover:bg-rule/30 disabled:opacity-30 transition-colors" title="Next verse">
                <SkipForward size={20} className="text-ink" />
              </button>

              <button onClick={stopAudio} className="p-2 rounded-full hover:bg-rule/30 transition-colors" title="Stop">
                <Square size={16} className="text-ink" style={{ fill: 'var(--ink)' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Player Bar */}

      <div className={`fixed left-0 right-0 z-40 transition-all duration-300 backdrop-blur-xl bottom-0 ${hideFooter ? 'pb-safe' : 'pb-[6.5rem]'}`} style={{ background: 'rgba(244,238,221,0.92)', borderTop: '1px solid var(--rule)' }}>
        <div className="relative max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center gap-3 relative">
            <button
              onClick={toggleAudio}
              className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-oxblood text-parchment shadow-sm"
            >
              {isPlaying && !isPaused ? <Pause size={20} fill="var(--parchment)" /> : <Play size={20} className="ml-0.5" fill="var(--parchment)" />}
            </button>
            <Drawer
              open={drawerOpen}
              onOpenChange={(open) => {
                setDrawerOpen(open);
                if (open && selectedBook) {
                  setExpandedBookId(selectedBook.id);
                  // Scroll to the selected book after a brief delay to allow drawer to open
                  setTimeout(() => {
                    const element = document.getElementById(`book-item-${selectedBook.id}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 150);
                }
              }}
            >
              <div className="flex-1 flex items-center h-12 rounded-full" style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}>
                <button onClick={handlePrev} disabled={chapter <= 1} className="px-4 h-full disabled:opacity-30"><ChevronLeft size={22} className="text-ink" /></button>
                <DrawerTrigger asChild>
                  <button className="flex-1 h-full flex items-center justify-center">
                    <span className="text-ink font-medium text-base font-ethiopic">{getShortName()} {chapter}</span>
                  </button>
                </DrawerTrigger>
                <button onClick={handleNext} disabled={!selectedBook || chapter >= selectedBook.chapters} className="px-4 h-full disabled:opacity-30"><ChevronRight size={22} className="text-ink" /></button>
              </div>
              <DrawerContent className="max-h-[85vh] text-ink sm:max-w-lg sm:mx-auto sm:rounded-2xl sm:bottom-8 sm:border-t-0 border-x border-t" style={{ background: 'var(--cream)', borderColor: 'var(--rule)' }}>
                <DrawerHeader><DrawerTitle className="font-garamond text-ink">Select Chapter</DrawerTitle></DrawerHeader>
                <div className="px-4 mb-4">
                  <div className="flex items-center gap-3 rounded-full px-4 py-3" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}>
                    <Search size={18} className="text-ink-soft" />
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-ink placeholder-ink-soft outline-none flex-1" />
                  </div>
                </div>
                <div className="overflow-y-auto px-4 pb-8 max-h-[60vh]">
                  {filteredBooks.map((book) => (
                    <div key={book.id} id={`book-item-${book.id}`} className="mb-2">
                      <button onClick={async () => {
                        if (expandedBookId === book.id) {
                          setExpandedBookId(null);
                        } else {
                          setExpandedBookId(book.id);
                          if (!availableChapters[book.id]) {
                            const chapters = await chaptersApi.getAvailableChapters(book.id);
                            setAvailableChapters(prev => ({ ...prev, [book.id]: chapters.length > 0 ? chapters : Array.from({ length: book.chapters }, (_, i) => i + 1) }));
                          }
                        }
                      }} className="w-full flex items-center justify-between py-3 px-3 hover:bg-rule/30 border border-transparent" style={{ borderRadius: '0.5rem' }}>
                        <span className="text-ink font-medium font-ethiopic">{book.amharicName}</span>
                        <div className="flex items-center gap-3">
                          <Volume2 size={18} className="text-ink-soft" />
                          <ChevronDown size={18} className={`text-ink-soft transition-transform ${expandedBookId === book.id ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {expandedBookId === book.id && (
                        <div className="grid grid-cols-5 gap-2 p-3">
                          {(availableChapters[book.id] || Array.from({ length: book.chapters }, (_, i) => i + 1)).map((ch) => (
                            <button key={ch} onClick={() => selectChapter(book, ch)} className={`aspect-square rounded-lg flex items-center justify-center font-bold ${selectedBook?.id === book.id && chapter === ch ? 'bg-oxblood text-parchment' : 'text-ink hover:bg-rule/30'}`} style={selectedBook?.id !== book.id || chapter !== ch ? { background: 'var(--parchment)' } : undefined}>{ch}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleReader;
