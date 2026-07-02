import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, Pause, Square, Copy, Check, Printer, Share2 } from 'lucide-react';
import { View } from '../../types';
import { Rubric, Meta, CrossMark } from '../ui/ManuscriptPrimitives';
import { wikiApi, WikiPageListItem, WikiPage } from '../../services/apiClient';
import {
  generateAndPlayAudio,
  pauseAudioPlayback,
  resumeAudioPlayback,
  stopAudioPlayback,
} from '../../services/geminiService';

interface DesktopArticleProps {
  setView: (view: View) => void;
  slug: string | null;
  onSelectSlug: (slug: string | null) => void;
  openBibleRef?: (ref: { book: string; chapter: number; verses?: string }) => void;
}

export const DesktopArticle: React.FC<DesktopArticleProps> = ({ setView, slug, onSelectSlug, openBibleRef }) => {
  const [list, setList] = useState<WikiPageListItem[]>([]);
  const [page, setPage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [audio, setAudio] = useState<'idle' | 'active' | 'paused'>('idle');
  const [copied, setCopied] = useState(false);

  // Fetch teaching list for sidebar
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    wikiApi.list('teaching')
      .then((d) => { if (!cancelled) setList(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch selected page (no type filter — supports teaching, concept, figure, etc.)
  useEffect(() => {
    if (!slug) {
      setPage(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    wikiApi.get(slug)
      .then((d) => { if (!cancelled) setPage(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // Auto-select first teaching if no slug
  useEffect(() => {
    if (!slug && list.length > 0 && !page) {
      onSelectSlug(list[0].slug);
    }
  }, [slug, list, page, onSelectSlug]);

  // Clean body markdown
  const cleanBody = useMemo(() => {
    if (!page) return '';
    return page.body_md
      .replace(/^#\s+.+\n*/, '')
      .replace(/^\*\*(?:Type|Amharic|English|Part|Role|Compendium Q|CCC|Sources|Last updated|Related):\*\*\s*.+$/gm, '')
      .replace(/^\*\(.*?\)\*\s*$/gm, '')
      .replace(/<\/?p>/g, '')
      .replace(/\[\[([^\]]+)\]\]/g, (_m: string, p: string) => `[${p}](#wiki:${p})`)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, [page]);

  // Plain, readable text (markdown stripped) for audio / copy / share.
  const readableText = useMemo(() => {
    if (!page) return '';
    const title = [page.title_am, page.title_en].filter(Boolean).join(' — ');
    const prose = cleanBody
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) -> text
      .replace(/[#>*`_]/g, '')                 // markdown syntax
      .replace(/\n{2,}/g, '\n')
      .trim();
    return title ? `${title}\n\n${prose}` : prose;
  }, [page, cleanBody]);

  // ── Article audio: play in segments so playback starts fast ──
  // (one big TTS call would synthesize the whole article before any sound;
  //  chaining sentence-sized calls lets the first segment play in ~1s.)
  const sessionRef = useRef(0);
  const stoppedRef = useRef(false);

  const segments = useMemo(
    () =>
      readableText
        .split(/(?<=[።?!])\s+|\n+/) // Amharic full stop / sentence ends / newlines
        .map((s) => s.trim())
        .filter((s) => s.length > 1),
    [readableText],
  );

  const speakSegment = useCallback(
    async (i: number, session: number) => {
      if (session !== sessionRef.current || stoppedRef.current || i >= segments.length) {
        if (session === sessionRef.current) setAudio('idle');
        return;
      }
      try {
        await generateAndPlayAudio(segments[i]);
        if (session === sessionRef.current && !stoppedRef.current) speakSegment(i + 1, session);
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // stop pressed — do not advance
        if (session === sessionRef.current && !stoppedRef.current) speakSegment(i + 1, session);
      }
    },
    [segments],
  );

  // Stop playback when switching pages or unmounting.
  useEffect(() => {
    sessionRef.current++;
    stoppedRef.current = true;
    stopAudioPlayback();
    setAudio('idle');
    return () => { sessionRef.current++; stoppedRef.current = true; stopAudioPlayback(); };
  }, [slug]);

  const handleListen = () => {
    if (audio === 'active') { pauseAudioPlayback(); setAudio('paused'); return; }
    if (audio === 'paused') { resumeAudioPlayback(); setAudio('active'); return; }
    if (!segments.length) return;
    stoppedRef.current = false;
    const session = ++sessionRef.current;
    setAudio('active');
    speakSegment(0, session);
  };

  const handleStopAudio = () => {
    sessionRef.current++;
    stoppedRef.current = true;
    stopAudioPlayback();
    setAudio('idle');
  };

  const flashCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(readableText); flashCopied(); } catch { /* ignore */ }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const data = {
      title: page?.title_en || page?.title_am || 'Mekra Catholic Wiki',
      text: readableText.slice(0, 800),
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(`${data.title}\n${data.url}`); flashCopied(); }
    } catch { /* user cancelled or unsupported */ }
  };

  const toolBtn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule font-mono text-[10px] tracking-[0.08em] uppercase text-ink-mid hover:border-ink-soft hover:text-oxblood transition-colors';

  return (
    <div className="grid h-full print:block" style={{ gridTemplateColumns: '260px 1fr 320px' }}>
      {/* ── Left rail — Teaching list ── */}
      <aside className="border-r border-rule px-6 py-7 overflow-y-auto print:hidden">
        <div
          onClick={() => setView(View.DEVOTION)}
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3 cursor-pointer hover:text-ink-mid transition-colors"
        >
          {'← Home'}
        </div>

        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2.5">
          Teaching pages
        </div>

        {listLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-5 bg-rule/30 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="text-ink-mid">
            <div className="pl-3 border-l border-rule space-y-2.5">
              {list.map((item) => {
                const active = item.slug === slug;
                const am = item.title_am;
                const en = item.title_en;
                return (
                  <div
                    key={item.slug}
                    onClick={() => onSelectSlug(item.slug)}
                    className={`cursor-pointer transition-colors ${
                      active
                        ? 'text-ink -ml-3 pl-[9px] border-l-[3px] border-oxblood'
                        : 'hover:text-ink'
                    }`}
                  >
                    <div className={`font-ethiopic text-[15px] leading-[1.25] truncate ${active ? 'font-medium' : ''}`}>
                      {am || en || item.slug}
                    </div>
                    {am && en && (
                      <div className="font-sans text-[11px] leading-tight text-ink-soft truncate">{en}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* ── Article body ── */}
      <main className="px-[72px] py-12 overflow-y-auto relative print:overflow-visible print:px-0 print:py-0">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-3 w-48 bg-rule/40 rounded" />
            <div className="h-14 w-64 bg-rule/50 rounded" />
            <div className="h-8 w-48 bg-rule/30 rounded" />
            <div className="h-px bg-rule my-4" />
            <div className="space-y-3 mt-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 bg-rule/25 rounded" style={{ width: `${80 - i * 8}%` }} />
              ))}
            </div>
          </div>
        ) : page ? (
          <>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-oxblood mb-3.5">
              <Rubric>{`${page.page_type} ${page.frontmatter?.part ? `· Part ${page.frontmatter.part}` : ''}`}</Rubric>
            </div>

            <h1 className="font-ethiopic font-medium text-[52px] leading-[1.12] m-0">
              {page.title_am || page.title_en || page.slug}
            </h1>
            {page.title_am && page.title_en && (
              <div className="font-garamond italic text-[32px] text-ink-mid mt-2 leading-[1.05] -tracking-[0.015em]">
                {page.title_en}
              </div>
            )}

            {/* Metadata grid */}
            <div className="mt-5 py-4 border-t border-b border-rule grid grid-cols-2 gap-x-8 gap-y-1.5">
              {page.frontmatter?.part && <Meta k="Part" v={page.frontmatter.part} />}
              {page.compendium_q && <Meta k="Compendium" v={`Q ${page.compendium_q}`} />}
              {page.frontmatter?.ccc && <Meta k="CCC" v={page.frontmatter.ccc} />}
              {page.sources && <Meta k="Sources" v={`${page.sources} verified`} />}
              {page.wiki_updated_at && <Meta k="Last updated" v={page.wiki_updated_at.split('T')[0]} />}
            </div>

            {/* Reading toolbar — listen (Amharic TTS), copy, print, share */}
            <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
              <button onClick={handleListen} className={toolBtn} style={{ background: 'var(--cream)' }}>
                {audio === 'active' ? <Pause size={13} /> : <Volume2 size={13} />}
                {audio === 'active' ? 'Pause' : audio === 'paused' ? 'Resume' : 'Listen'}
              </button>
              {audio !== 'idle' && (
                <button onClick={handleStopAudio} className={toolBtn} style={{ background: 'var(--cream)' }}>
                  <Square size={12} /> Stop
                </button>
              )}
              <button onClick={handleCopy} className={toolBtn} style={{ background: 'var(--cream)' }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={handlePrint} className={toolBtn} style={{ background: 'var(--cream)' }}>
                <Printer size={13} /> Print
              </button>
              <button onClick={handleShare} className={toolBtn} style={{ background: 'var(--cream)' }}>
                <Share2 size={13} /> Share
              </button>
            </div>

            {/* Article content */}
            <div className="mt-8 prose-wiki">
              {cleanBody ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 className="font-sans text-[11px] tracking-[0.18em] uppercase text-ink-soft mt-9 mb-3.5 font-medium">
                        <Rubric>{`§ ${children}`}</Rubric>
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-garamond text-xl font-medium mt-7 mb-2 text-ink">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="font-ethiopic text-lg leading-[1.7] text-ink mt-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-medium text-ink">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-oxblood">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                      <div className="flex gap-4 my-6 py-4 border-t border-b border-rule">
                        <div className="w-[3px] bg-oxblood shrink-0" />
                        <div className="font-ethiopic text-xl leading-[1.4] text-ink">{children}</div>
                      </div>
                    ),
                    a: ({ href, children }) => {
                      if (href?.startsWith('#wiki:')) {
                        const wikiSlug = href.replace('#wiki:', '').replace(/^(teaching|concepts?|figure)\//, '');
                        return (
                          <span
                            onClick={() => onSelectSlug(wikiSlug)}
                            className="text-oxblood cursor-pointer hover:underline"
                          >
                            {children}
                          </span>
                        );
                      }
                      return <span className="text-oxblood">{children}</span>;
                    },
                  }}
                >
                  {cleanBody}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-ink-soft font-garamond text-lg mb-2">Content coming soon</p>
                  <p className="text-ink-soft/60 text-sm max-w-xs">
                    This teaching page is a placeholder. Full Amharic content will be added in a future update.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-ink-soft font-garamond text-lg">
            Select a teaching from the sidebar
          </div>
        )}
      </main>

      {/* ── Right rail — bible refs + related ── */}
      <aside
        className="border-l border-rule px-7 py-10 overflow-y-auto print:hidden"
        style={{ background: 'var(--cream)' }}
      >
        {page && (
          <>
            {/* Bible references */}
            {page.bible_refs && page.bible_refs.length > 0 && (
              <>
                <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-3.5">
                  <Rubric>Scripture references</Rubric>
                </div>
                {page.bible_refs.slice(0, 8).map((ref) => (
                  <div
                    key={`${ref.book}-${ref.chapter}-${ref.verses}`}
                    onClick={() => openBibleRef ? openBibleRef(ref) : setView(View.READER)}
                    className="py-3 border-b border-dashed border-rule flex gap-3 cursor-pointer hover:bg-parchment/30 transition-colors"
                  >
                    <CrossMark size={11} color="var(--ochre)" />
                    <div className="flex-1">
                      <div className="font-garamond text-[15px] font-medium">
                        {ref.book} {ref.chapter}{ref.verses ? `:${ref.verses}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Links to other pages */}
            {page.links && page.links.length > 0 && (
              <>
                <div className="mt-7 font-sans text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-3.5">
                  <Rubric>Related pages</Rubric>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {page.links.slice(0, 10).map((link) => {
                    const cleanSlug = link.replace(/^(teaching|concepts?|figure)\//, '');
                    return (
                      <div
                        key={link}
                        onClick={() => onSelectSlug(cleanSlug)}
                        className="font-sans text-sm px-2.5 py-1 border border-rule cursor-pointer hover:border-ink-soft transition-colors"
                        style={{ background: 'var(--parchment)' }}
                      >
                        {cleanSlug}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Frontmatter metadata */}
            {page.compendium_q && (
              <div className="mt-7">
                <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-2">
                  <Rubric>Compendium</Rubric>
                </div>
                <div className="font-mono text-[11px] text-oxblood">Q {page.compendium_q}</div>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
};
