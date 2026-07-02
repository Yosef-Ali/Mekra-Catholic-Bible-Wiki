import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Volume2, Pause, Square, Copy, Check, Printer, Share2 } from 'lucide-react';
import { View, BibleBook } from '../../types';
import { Rubric, CrossMark } from '../ui/ManuscriptPrimitives';
import { booksApi, chaptersApi } from '../../services/apiClient';
import {
  generateAndPlayAudio,
  pauseAudioPlayback,
  resumeAudioPlayback,
  stopAudioPlayback,
} from '../../services/geminiService';
import { CATHOLIC_BOOKS } from '../../constants';

interface FormattingRules {
  sections: Array<{ type: string; verseRange: [number, number]; indent?: number }>;
  hasPoetry: boolean;
  subtitles?: Array<{ verse: number; text: string }>;
  paragraphBreaks?: number[];
}

interface DisplayVerse {
  type: 'verse' | 'header' | 'subtitle';
  number: number;
  text: string;
  sectionType?: 'prose' | 'poetry' | 'list';
  isNewParagraph?: boolean;
  indent?: number;
}

interface DesktopBibleSelectorProps {
  setView: (view: View) => void;
  initialRef?: { book: string; chapter: number; verses?: string } | null;
  onRefConsumed?: () => void;
}

export const DesktopBibleSelector: React.FC<DesktopBibleSelectorProps> = ({ setView, initialRef, onRefConsumed }) => {
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<string>('Genesis');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerseStart, setSelectedVerseStart] = useState(1);
  const [selectedVerseEnd, setSelectedVerseEnd] = useState(1);
  const [versePreview, setVersePreview] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [audio, setAudio] = useState<'idle' | 'active' | 'paused'>('idle');

  // Reader mode state
  const [readerMode, setReaderMode] = useState(false);
  const [readerVerses, setReaderVerses] = useState<DisplayVerse[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);

  // Fetch books from API, fallback to constants
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    booksApi.getAll()
      .then((data) => {
        if (!cancelled) {
          setBooks(data);
          if (data.length > 0) setSelectedBook(data[0].name);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBooks(CATHOLIC_BOOKS as any);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const otBooks = useMemo(() => books.filter((b) => b.section === 'OT' || b.section === 'Apocrypha'), [books]);
  const ntBooks = useMemo(() => books.filter((b) => b.section === 'NT'), [books]);
  const activeBookData = useMemo(() => books.find((b) => b.name === selectedBook), [books, selectedBook]);
  const totalChapters = activeBookData?.chapters ?? 50;
  const amName = activeBookData?.amharicName ?? '';
  const chapterNumbers = useMemo(() => Array.from({ length: totalChapters }, (_, i) => i + 1), [totalChapters]);

  // Get formatting type for a verse from formattingRules
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

  // Parse structured content with formattingRules into DisplayVerse[]
  const parseContent = useCallback((raw: any, rules: FormattingRules | null): DisplayVerse[] => {
    if (!raw) return [];

    // Structured format: { sections: [{ verses: [...] }] }
    if (raw.sections && Array.isArray(raw.sections)) {
      const verses: DisplayVerse[] = [];
      const paragraphBreaks = rules?.paragraphBreaks || [];
      const subtitles = rules?.subtitles || [];
      const subtitleMap = new Map(subtitles.map((s: any) => [s.verse, s.text]));

      for (const section of raw.sections) {
        if (section.title) {
          verses.push({ type: 'header', number: 0, text: section.title });
        }

        if (section.verses && Array.isArray(section.verses)) {
          for (const v of section.verses) {
            const verseNum = v.verse_number || 0;

            // Insert subtitle before this verse if one exists
            if (subtitleMap.has(verseNum)) {
              verses.push({ type: 'subtitle', number: verseNum, text: subtitleMap.get(verseNum)! });
            }

            const formatting = rules
              ? getVerseFormatting(verseNum, rules)
              : { type: (section.type || 'prose').toLowerCase(), indent: 0 };

            verses.push({
              type: 'verse',
              number: verseNum,
              text: (v.text || '').replace(/^[፩-፼]+/, ''),
              sectionType: formatting.type as 'prose' | 'poetry' | 'list',
              isNewParagraph: paragraphBreaks.includes(verseNum) || v.is_new_paragraph,
              indent: v.indent || formatting.indent || 0,
            });
          }
        }
      }
      return verses;
    }

    // Array format
    if (Array.isArray(raw)) {
      return raw.map((v: any) => ({
        type: 'verse' as const,
        number: v.verse_number || v.number || 0,
        text: (v.text || '').replace(/^[፩-፼]+/, ''),
        sectionType: 'prose' as const,
      }));
    }

    // Plain string
    if (typeof raw === 'string') {
      return [{ type: 'verse', number: 1, text: raw, sectionType: 'prose' }];
    }
    return [];
  }, [getVerseFormatting]);

  // Apply initial Bible reference (from wiki scripture link) — jump straight to content
  useEffect(() => {
    if (!initialRef || books.length === 0) return;
    const refBook = initialRef.book.trim();
    const match = books.find(
      (b) => b.name === refBook
        || b.amharicName === refBook
        || b.amharicName?.includes(refBook)
        || b.name.toLowerCase() === refBook.toLowerCase()
    );
    if (match) {
      setSelectedBook(match.name);
      setSelectedChapter(initialRef.chapter);
      setReaderMode(true);
      setReaderLoading(true);
      setReaderVerses([]);
      chaptersApi.getContent(match.id, initialRef.chapter)
        .then(({ content, formattingRules }) => {
          setReaderVerses(parseContent(content, formattingRules || null));
        })
        .catch(() => setReaderVerses([]))
        .finally(() => setReaderLoading(false));
      onRefConsumed?.();
    }
  }, [initialRef, books, onRefConsumed, parseContent]);

  // Fetch verse preview when book/chapter changes (selector mode)
  useEffect(() => {
    if (!activeBookData?.id || readerMode) return;
    let cancelled = false;
    setPreviewLoading(true);
    chaptersApi.getContent(activeBookData.id, selectedChapter)
      .then(({ content, formattingRules }) => {
        if (cancelled) return;
        const verses = parseContent(content, formattingRules || null);
        const textVerses = verses.filter((v) => v.type === 'verse');
        if (textVerses.length > 0) {
          const target = textVerses.find((v) => v.number === selectedVerseStart) || textVerses[0];
          setVersePreview(target.text);
        } else if (typeof content === 'string' && content) {
          setVersePreview(content.substring(0, 300));
        } else {
          setVersePreview('');
        }
      })
      .catch(() => { if (!cancelled) setVersePreview(''); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [activeBookData?.id, selectedChapter, selectedVerseStart, readerMode, parseContent]);

  // Fetch full chapter content for reader mode
  const openReader = useCallback(() => {
    if (!activeBookData?.id) return;
    setReaderMode(true);
    setReaderLoading(true);
    setReaderVerses([]);
    chaptersApi.getContent(activeBookData.id, selectedChapter)
      .then(({ content, formattingRules }) => {
        setReaderVerses(parseContent(content, formattingRules || null));
      })
      .catch(() => setReaderVerses([]))
      .finally(() => setReaderLoading(false));
  }, [activeBookData?.id, selectedChapter, parseContent]);

  // Navigate chapters in reader mode
  const goToChapter = useCallback((ch: number) => {
    if (!activeBookData?.id || ch < 1 || ch > totalChapters) return;
    setSelectedChapter(ch);
    setReaderLoading(true);
    setReaderVerses([]);
    chaptersApi.getContent(activeBookData.id, ch)
      .then(({ content, formattingRules }) => setReaderVerses(parseContent(content, formattingRules || null)))
      .catch(() => setReaderVerses([]))
      .finally(() => setReaderLoading(false));
  }, [activeBookData?.id, totalChapters, parseContent]);

  const handleCopyVerse = useCallback(async () => {
    if (!versePreview) return;
    try {
      await navigator.clipboard.writeText(`${amName} ${selectedChapter}:${selectedVerseStart} — ${versePreview}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [amName, selectedChapter, selectedVerseStart, versePreview]);

  // ── Reader-mode chapter: plain text for copy / print / share ──
  const readerText = useMemo(() => {
    if (!readerVerses.length) return '';
    const header = `${amName} · ምዕራፍ ${selectedChapter}`;
    const body = readerVerses
      .filter((v) => v.type === 'verse' && v.text)
      .map((v) => `${v.number}. ${v.text}`)
      .join('\n');
    return `${header}\n\n${body}`;
  }, [readerVerses, amName, selectedChapter]);

  const handleCopyChapter = useCallback(async () => {
    if (!readerText) return;
    try {
      await navigator.clipboard.writeText(readerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [readerText]);

  const handlePrint = useCallback(() => window.print(), []);

  const handleShareChapter = useCallback(async () => {
    const data = {
      title: `${amName} ${selectedChapter} — Emmaus Catholic Bible`,
      text: readerText.slice(0, 800),
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${data.title}\n${data.url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* cancelled / unsupported */ }
  }, [amName, selectedChapter, readerText]);

  const toolBtn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule font-mono text-[10px] tracking-[0.08em] uppercase text-ink-mid hover:border-ink-soft hover:text-oxblood transition-colors';

  // ── Reader audio: read the chapter verse-by-verse (fast start) ──
  const audioSessionRef = useRef(0);
  const audioStoppedRef = useRef(false);

  const verseTexts = useMemo(
    () => readerVerses.filter((v) => v.type === 'verse' && v.text).map((v) => v.text as string),
    [readerVerses],
  );

  const speakVerse = useCallback(
    async (i: number, session: number) => {
      if (session !== audioSessionRef.current || audioStoppedRef.current || i >= verseTexts.length) {
        if (session === audioSessionRef.current) setAudio('idle');
        return;
      }
      try {
        await generateAndPlayAudio(verseTexts[i]);
        if (session === audioSessionRef.current && !audioStoppedRef.current) speakVerse(i + 1, session);
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // stop pressed
        if (session === audioSessionRef.current && !audioStoppedRef.current) speakVerse(i + 1, session);
      }
    },
    [verseTexts],
  );

  // Stop audio when the chapter/book changes or when leaving reader mode.
  useEffect(() => {
    audioSessionRef.current++;
    audioStoppedRef.current = true;
    stopAudioPlayback();
    setAudio('idle');
    return () => { audioSessionRef.current++; audioStoppedRef.current = true; stopAudioPlayback(); };
  }, [selectedBook, selectedChapter, readerMode]);

  const handleListen = () => {
    if (audio === 'active') { pauseAudioPlayback(); setAudio('paused'); return; }
    if (audio === 'paused') { resumeAudioPlayback(); setAudio('active'); return; }
    if (!verseTexts.length) return;
    audioStoppedRef.current = false;
    const session = ++audioSessionRef.current;
    setAudio('active');
    speakVerse(0, session);
  };

  const handleStopAudio = () => {
    audioSessionRef.current++;
    audioStoppedRef.current = true;
    stopAudioPlayback();
    setAudio('idle');
  };

  // Dynamic verse count for the grid (based on actual chapter content)
  const verseNumbers = useMemo(() => {
    if (readerVerses.length > 0) {
      const max = Math.max(...readerVerses.map((v) => v.number));
      return Array.from({ length: max }, (_, i) => i + 1);
    }
    return Array.from({ length: 32 }, (_, i) => i + 1);
  }, [readerVerses]);

  // Render verses with proper formatting: subtitles, poetry, paragraph breaks
  const renderFormattedContent = () => {
    const items = readerVerses.filter((v) => v.type === 'verse' || v.type === 'subtitle');
    const result: React.ReactNode[] = [];
    let currentParagraph: DisplayVerse[] = [];
    let currentType = 'prose';
    let paragraphIdx = 0;

    const flushParagraph = (idx: number) => {
      if (currentParagraph.length === 0) return null;
      const groupType = currentType.toLowerCase();
      const verses = [...currentParagraph];
      currentParagraph = [];

      if (groupType === 'poetry') {
        // Poetry: each verse is a block with line-splitting on Ethiopic punctuation
        return (
          <div key={`p-${idx}`} className="my-6 ml-8 border-l-2 border-ochre/30 pl-6">
            {verses.map((verse) => {
              const rawLines = (verse.text || '').split(/(?<=[፦፥።])/g).filter((l) => l.trim());
              const lines: string[] = [];
              let pending = '';
              for (const line of rawLines) {
                const combined = pending + (pending ? ' ' : '') + line.trim();
                const wordCount = combined.split(/\s+/).filter((w) => w).length;
                if (wordCount < 2) { pending = combined; }
                else { lines.push(combined); pending = ''; }
              }
              if (pending) lines.push(pending);

              return (
                <div key={verse.number} id={`verse-${verse.number}`} className="my-1.5">
                  {lines.map((line, lineIdx) => (
                    <p
                      key={lineIdx}
                      className="font-ethiopic text-[18px] leading-[1.7] text-ink"
                      style={{
                        paddingLeft: lineIdx === 0 ? '1.5rem' : '2.5rem',
                        textIndent: lineIdx === 0 ? '-1.5rem' : '0',
                      }}
                    >
                      {lineIdx === 0 && verse.number > 0 && (
                        <sup className="text-oxblood font-mono text-[10px] font-semibold mr-1.5">{verse.number}</sup>
                      )}
                      {line.trim()}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        );
      }

      // Prose: inline spans within a paragraph block
      return (
        <p key={`p-${idx}`} className="font-ethiopic text-[19px] leading-[1.75] text-ink mb-5 text-justify">
          {verses.map((verse) => (
            <span key={verse.number} id={`verse-${verse.number}`}>
              {verse.number > 0 && (
                <sup className="text-oxblood font-mono text-[10px] font-semibold mr-1">{verse.number}</sup>
              )}
              {verse.text}{' '}
            </span>
          ))}
        </p>
      );
    };

    for (const item of items) {
      if (item.type === 'subtitle') {
        // Flush before subtitle
        const para = flushParagraph(paragraphIdx++);
        if (para) result.push(para);

        // Render subtitle heading
        result.push(
          <h3
            key={`sub-${item.number}`}
            className="font-garamond font-semibold text-[20px] text-oxblood mt-8 mb-3 pb-2 border-b border-rule"
          >
            {item.text}
          </h3>
        );
      } else if (item.type === 'verse') {
        const sectionType = item.sectionType || 'prose';

        // New paragraph break
        if (item.isNewParagraph && currentParagraph.length > 0) {
          const para = flushParagraph(paragraphIdx++);
          if (para) result.push(para);
        }

        // Section type changed (e.g. prose → poetry)
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

  /* ──────────────────── READER MODE ──────────────────── */
  if (readerMode) {
    return (
      <div className="grid h-full print:block" style={{ gridTemplateColumns: '260px 1fr 300px' }}>
        {/* ── Left — book list ── */}
        <aside className="border-r border-rule px-5 py-7 overflow-y-auto print:hidden">
          <div
            onClick={() => setReaderMode(false)}
            className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4 cursor-pointer hover:text-ink-mid transition-colors"
          >
            {'← Book selector'}
          </div>
          <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2.5">
            Books
          </div>
          <div className="space-y-0.5">
            {books.map((book) => {
              const active = book.name === selectedBook;
              return (
                <div
                  key={book.name}
                  onClick={() => {
                    setSelectedBook(book.name);
                    setSelectedChapter(1);
                    setSelectedVerseStart(1);
                    setSelectedVerseEnd(1);
                    // Fetch new book's first chapter
                    if (book.id) {
                      setReaderLoading(true);
                      setReaderVerses([]);
                      chaptersApi.getContent(book.id, 1)
                        .then(({ content, formattingRules }) => setReaderVerses(parseContent(content, formattingRules || null)))
                        .catch(() => setReaderVerses([]))
                        .finally(() => setReaderLoading(false));
                    }
                  }}
                  className={`px-2.5 py-1 flex items-baseline gap-2 cursor-pointer rounded-sm transition-colors text-sm ${
                    active
                      ? 'bg-ink text-parchment'
                      : 'hover:bg-parchment-dark text-ink-mid'
                  }`}
                >
                  <span className="font-ethiopic text-[13px]">{book.amharicName}</span>
                  <span className={`font-garamond text-xs italic ml-auto ${active ? 'text-parchment/65' : 'text-ink-soft'}`}>
                    {book.name}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Center — reading pane ── */}
        <main className="px-16 py-10 overflow-y-auto print:overflow-visible print:px-0 print:py-0">
          {/* Header */}
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-oxblood mb-3">
            <Rubric>{'Emmaus Catholic Edition · Amharic'}</Rubric>
          </div>
          <div className="flex items-baseline gap-4 mb-1">
            <h1 className="font-garamond font-medium text-[48px] leading-[1.02] m-0">
              {amName}
            </h1>
            <span className="font-garamond text-[28px] text-ink-mid italic">{selectedBook}</span>
          </div>
          <div className="font-mono text-[11px] text-ink-soft mb-6">
            Chapter {selectedChapter} of {totalChapters}
          </div>

          {/* Reading toolbar — listen, copy, print, share */}
          {readerVerses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6 print:hidden">
              <button onClick={handleListen} className={toolBtn} style={{ background: 'var(--parchment)' }}>
                {audio === 'active' ? <Pause size={13} /> : <Volume2 size={13} />}
                {audio === 'active' ? 'Pause' : audio === 'paused' ? 'Resume' : 'Listen'}
              </button>
              {audio !== 'idle' && (
                <button onClick={handleStopAudio} className={toolBtn} style={{ background: 'var(--parchment)' }}>
                  <Square size={12} /> Stop
                </button>
              )}
              <button onClick={handleCopyChapter} className={toolBtn} style={{ background: 'var(--parchment)' }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={handlePrint} className={toolBtn} style={{ background: 'var(--parchment)' }}>
                <Printer size={13} /> Print
              </button>
              <button onClick={handleShareChapter} className={toolBtn} style={{ background: 'var(--parchment)' }}>
                <Share2 size={13} /> Share
              </button>
            </div>
          )}

          {/* Chapter nav */}
          <div className="flex items-center gap-3 mb-8 border-b border-rule pb-4 print:hidden">
            <button
              onClick={() => goToChapter(selectedChapter - 1)}
              disabled={selectedChapter <= 1}
              className="px-3 py-1.5 border border-rule font-sans text-xs text-ink-mid hover:border-ink-soft transition-colors disabled:opacity-30"
              style={{ background: 'var(--parchment)' }}
            >
              {'← Prev'}
            </button>
            <div className="flex-1 font-garamond text-[15px] text-ink-mid text-center">
              {amName} · ምዕራፍ {selectedChapter}
            </div>
            <button
              onClick={() => goToChapter(selectedChapter + 1)}
              disabled={selectedChapter >= totalChapters}
              className="px-3 py-1.5 border border-rule font-sans text-xs text-ink-mid hover:border-ink-soft transition-colors disabled:opacity-30"
              style={{ background: 'var(--parchment)' }}
            >
              {'Next →'}
            </button>
          </div>

          {/* Verses */}
          {readerLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-6 bg-rule/25 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          ) : readerVerses.length > 0 ? (
            <div className="max-w-[680px]">
              {renderFormattedContent()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CrossMark size={28} color="var(--rule)" />
              <p className="text-ink-soft font-garamond text-lg mt-4 mb-2">No content available</p>
              <p className="text-ink-soft/60 text-sm max-w-xs">
                This chapter has not been processed yet. Content will appear once OCR/formatting is complete.
              </p>
            </div>
          )}

          {/* Bottom nav */}
          {readerVerses.length > 0 && (
            <div className="flex items-center gap-3 mt-10 pt-4 border-t border-rule print:hidden">
              <button
                onClick={() => goToChapter(selectedChapter - 1)}
                disabled={selectedChapter <= 1}
                className="px-4 py-2 border border-rule font-sans text-xs text-ink-mid hover:border-ink-soft transition-colors disabled:opacity-30"
                style={{ background: 'var(--parchment)' }}
              >
                {'← '}Previous chapter
              </button>
              <div className="flex-1" />
              <button
                onClick={() => goToChapter(selectedChapter + 1)}
                disabled={selectedChapter >= totalChapters}
                className="px-4 py-2 bg-ink text-parchment font-sans text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                Next chapter{' →'}
              </button>
            </div>
          )}
        </main>

        {/* ── Right — chapter picker ── */}
        <aside className="border-l border-rule px-7 py-10 overflow-y-auto print:hidden" style={{ background: 'var(--cream)' }}>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-oxblood">
            <Rubric>{amName}{' · '}{selectedBook}</Rubric>
          </div>
          <div className="font-sans text-[11px] text-ink-soft mt-1 mb-5">
            {totalChapters} chapters · {readerVerses.length} verses
          </div>

          <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2.5">
            Chapter
          </div>
          <div className="grid grid-cols-8 gap-1 mb-6">
            {chapterNumbers.map((n) => {
              const active = n === selectedChapter;
              return (
                <div
                  key={n}
                  onClick={() => goToChapter(n)}
                  className={`aspect-square grid place-items-center font-mono text-[11px] cursor-pointer transition-colors border ${
                    active
                      ? 'bg-oxblood text-parchment border-oxblood'
                      : 'bg-parchment text-ink-mid border-rule hover:border-ink-soft'
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => setReaderMode(false)}
              className="w-full py-2 text-center border border-rule font-sans text-xs text-ink-mid hover:border-ink-soft transition-colors"
              style={{ background: 'var(--parchment)' }}
            >
              Back to book selector
            </button>
          </div>
        </aside>
      </div>
    );
  }

  /* ──────────────────── SELECTOR MODE ──────────────────── */
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '1fr 380px' }}>
      {/* ── Main content ── */}
      <main className="px-14 py-10 overflow-y-auto">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-oxblood mb-3">
          <Rubric>{'Emmaus Catholic Edition · Amharic'}</Rubric>
        </div>
        <div className="flex items-baseline gap-4 mb-1.5">
          <h1 className="font-garamond font-medium text-[48px] leading-[1.02] m-0">
            Open a passage
          </h1>
          <div className="font-ethiopic text-[32px] text-ink-mid">{'· መጽሐፍ ቅዱስ'}</div>
        </div>
        <div className="font-garamond text-[15px] italic text-ink-mid mt-1">
          {books.length} books · queried live from the Emmaus DB.
        </div>

        {/* Breadcrumb selector */}
        <div className="mt-7 flex items-stretch border border-rule" style={{ background: 'var(--cream)' }}>
          <div className="flex-1 px-4 py-3.5 border-r border-rule">
            <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">Book</div>
            <div className="font-ethiopic text-[22px] text-ink mt-0.5">{amName}</div>
            <div className="font-garamond italic text-[13px] text-ink-mid">{selectedBook}</div>
          </div>
          <div className="w-[100px] px-4 py-3.5 border-r border-rule">
            <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">Chapter</div>
            <div className="font-garamond text-[28px] text-ink font-medium">{selectedChapter}</div>
          </div>
          <div className="w-[140px] px-4 py-3.5 border-r border-rule">
            <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">Verses</div>
            <div className="font-garamond text-[28px] text-ink font-medium">
              {selectedVerseStart} – {selectedVerseEnd}
            </div>
          </div>
          <button
            onClick={openReader}
            className="px-5 grid place-items-center bg-oxblood text-parchment font-sans text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            {'Open passage →'}
          </button>
        </div>

        {/* Book grid */}
        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-10">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="h-6 w-40 bg-rule/40 rounded mb-4" />
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="h-4 bg-rule/25 rounded" style={{ width: `${60 + j * 5}%` }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-10">
            {[
              { title: 'Old Testament', am: 'ብሉይ ኪዳን', books: otBooks },
              { title: 'New Testament', am: 'አዲስ ኪዳን',  books: ntBooks },
            ].map((section) => (
              <div key={section.title}>
                <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-rule">
                  <div>
                    <span className="font-garamond text-[18px] font-medium">{section.title}</span>
                    <span className="font-ethiopic text-[15px] text-ink-mid ml-2">· {section.am}</span>
                  </div>
                  <div className="font-mono text-[10px] text-ink-soft">{section.books.length}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {section.books.map((book) => {
                    const active = book.name === selectedBook;
                    return (
                      <div
                        key={book.name}
                        onClick={() => {
                          setSelectedBook(book.name);
                          setSelectedChapter(1);
                          setSelectedVerseStart(1);
                          setSelectedVerseEnd(1);
                        }}
                        className={`px-2.5 py-1 flex items-baseline gap-2.5 cursor-pointer rounded-sm transition-colors ${
                          active
                            ? 'bg-ink text-parchment'
                            : 'hover:bg-parchment-dark'
                        }`}
                      >
                        <span className="font-ethiopic text-sm">{book.amharicName}</span>
                        <span
                          className={`font-garamond text-xs italic ml-auto ${
                            active ? 'text-parchment/65' : 'text-ink-soft'
                          }`}
                        >
                          {book.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Right — chapter + verse picker ── */}
      <aside
        className="border-l border-rule px-7 py-10 overflow-y-auto"
        style={{ background: 'var(--cream)' }}
      >
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-oxblood">
          <Rubric>{amName}{' · '}{selectedBook}</Rubric>
        </div>
        <div className="font-sans text-[11px] text-ink-soft mt-1">
          {totalChapters} chapters
        </div>

        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mt-5 mb-2.5">
          Chapter
        </div>
        <div className="grid grid-cols-8 gap-1">
          {chapterNumbers.map((n) => {
            const active = n === selectedChapter;
            return (
              <div
                key={n}
                onClick={() => {
                  setSelectedChapter(n);
                  setSelectedVerseStart(1);
                  setSelectedVerseEnd(1);
                }}
                className={`aspect-square grid place-items-center font-mono text-[11px] cursor-pointer transition-colors border ${
                  active
                    ? 'bg-oxblood text-parchment border-oxblood'
                    : 'bg-parchment text-ink-mid border-rule hover:border-ink-soft'
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-baseline mt-6 mb-2.5">
          <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft">
            Verses · {selectedVerseStart}–{selectedVerseEnd} selected
          </div>
        </div>
        <div className="grid grid-cols-8 gap-[3px]">
          {verseNumbers.map((n) => {
            const inRange = n >= selectedVerseStart && n <= selectedVerseEnd;
            return (
              <div
                key={n}
                onClick={() => {
                  setSelectedVerseStart(n);
                  setSelectedVerseEnd(n);
                }}
                className={`aspect-square grid place-items-center font-mono text-[10px] cursor-pointer transition-colors border ${
                  inRange
                    ? 'bg-ink text-parchment border-ink'
                    : 'bg-parchment text-ink-soft border-rule hover:border-ink-soft'
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>

        {/* Verse preview — real data */}
        <div className="mt-5 p-4 border border-rule" style={{ background: 'var(--parchment)' }}>
          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-2">
            Preview · {amName} {selectedChapter}:{selectedVerseStart}
          </div>
          {previewLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-rule/30 rounded w-full" />
              <div className="h-4 bg-rule/30 rounded w-4/5" />
            </div>
          ) : versePreview ? (
            <div className="font-ethiopic text-[15px] leading-[1.6] text-ink">
              <sup className="text-oxblood font-mono text-[9px] mr-1">{selectedVerseStart}</sup>
              {versePreview.length > 300 ? versePreview.substring(0, 300) + '…' : versePreview}
            </div>
          ) : (
            <div className="font-garamond italic text-[13px] text-ink-soft">
              No content available for this chapter yet.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCopyVerse}
            className="flex-1 py-2 text-center border border-rule font-sans text-xs text-ink-mid hover:border-ink-soft transition-colors"
            style={{ background: 'var(--parchment)' }}
          >
            {copied ? '✓ Copied' : 'Copy verse'}
          </button>
          <button
            onClick={openReader}
            className="flex-1 py-2 text-center bg-ink text-parchment font-sans text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Open in reader
          </button>
        </div>
      </aside>
    </div>
  );
};
