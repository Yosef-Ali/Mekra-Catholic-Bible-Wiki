import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { wikiApi, WikiPageListItem, WikiPage } from '../services/apiClient';
import { ChevronLeft, Search, BookOpen, X } from 'lucide-react';
import { useFooter } from '../App';
import { useScrollHideFooter } from '../hooks/useScrollHideFooter';

type Tab = 'teaching' | 'concept' | 'figure' | 'qa';

const TABS: { id: Tab; label_en: string; label_am: string; ready: boolean }[] = [
  { id: 'teaching', label_en: 'Teaching', label_am: 'ትምህርት', ready: true },
  { id: 'concept',  label_en: 'Concepts', label_am: 'ጽንሰ ሐሳቦች', ready: false },
  { id: 'figure',   label_en: 'Figures',  label_am: 'ሰዎች', ready: false },
  { id: 'qa',       label_en: 'Q&A',      label_am: 'ጥያቄና መልስ', ready: false },
];

export const WikiViewer: React.FC = () => {
  const [tab, setTab] = useState<Tab>('teaching');
  const [list, setList] = useState<WikiPageListItem[]>([]);
  const [selected, setSelected] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPageListItem[] | null>(null);
  const { setHideFooter } = useFooter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useScrollHideFooter(setHideFooter, scrollRef);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    wikiApi
      .list(tab)
      .then((d) => { if (!cancelled) setList(d); })
      .catch((e) => console.error(e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  async function openPage(item: WikiPageListItem) {
    setLoading(true);
    try {
      const full = await wikiApi.get(item.slug, item.page_type);
      setSelected(full);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) { setSearchResults(null); return; }
    setLoading(true);
    try {
      const r = await wikiApi.search(query.trim());
      setSearchResults(r);
    } finally {
      setLoading(false);
    }
  }

  // Strip metadata block from top of body_md (already shown in header).
  // Only remove known frontmatter fields, NOT Q&A content.
  const cleanBody = useMemo(() => {
    if (!selected) return '';
    const metaFields = 'Type|Amharic|English|Part|Role|Compendium Q|CCC|Sources|Last updated|Related';
    // Ethiopic numerals: ፩–፱, ፲, ፳, ፴…፺, ፻, ፼
    const ETHIOPIC_NUM = '[\u1369-\u137C]';
    return selected.body_md
      // Remove title line that repeats the page name
      .replace(/^#\s+.+\n*/, '')
      // Remove only known metadata fields
      .replace(new RegExp(`^\\*\\*(${metaFields}):\\*\\*\\s*.+$`, 'gm'), '')
      // Remove italic placeholder lines like "*(To be written ...)*" or "*(Synthesis ...)*"
      .replace(/^\*\(.*?\)\*\s*$/gm, '')
      // Remove stub sections that only contain placeholder text or bullet items
      .replace(/^##\s+(Synthesis|In the Compendium|In Scripture|Open questions|Sources)\n+(?:[-*].*\n|See Q&As:.*\n|Refer to .*\n|Compendium of .*\n)*/gm, '')
      // Drop entire Q&A blocks where the Q or A value is literally "none"
      // (e.g. OCR-missed entries). Matches "### Q148\n\n**Q:** none …" up to
      // the next heading or end-of-doc.
      .replace(/^###\s+Q\d+[^\n]*\n+\*\*Q:\*\*\s*none\b[\s\S]*?(?=^###\s+Q\d+|^##\s|$)/gim, '')
      .replace(/^###\s+Q\d+[^\n]*\n+\*\*Q:\*\*[^\n]*\n+\*\*A:\*\*\s*none\b[\s\S]*?(?=^###\s+Q\d+|^##\s|$)/gim, '')
      // Strip redundant Ethiopic-numeral prefix from Q lines, e.g.
      // "**Q:** ፩፻፶፯. actual question" → "**Q:** actual question"
      // (the Q number already appears in the "### Q157" heading above).
      .replace(new RegExp(`(\\*\\*Q:\\*\\*\\s*)${ETHIOPIC_NUM}+[.\\s]+`, 'g'), '$1')
      // Strip the redundant HTML header block on some A lines:
      //   "**A:** <p><strong>፯፻፺፪-፯፻፺፭</strong></p> <p>actual answer…</p>"
      // The <strong> portion is an Ethiopic-numeral CCC range that already
      // appears in the "[CCC …]" line below each answer.
      .replace(
        new RegExp(`(\\*\\*A:\\*\\*\\s*)<p><strong>[\\s${ETHIOPIC_NUM}\\-–,<br\\/>\\s]+<\\/strong><\\/p>\\s*`, 'g'),
        '$1'
      )
      // Unwrap remaining <p>…</p> wrappers left in A content.
      .replace(/<\/?p>/g, '')
      // Strip trailing OCR reference numbers injected after Amharic full-stop:
      //   "ይኖርባቸዋል:: # 363"  →  "ይኖርባቸዋል::"
      // Matches "# <digits>" at the end of any line.
      .replace(/\s*#\s*\d+\s*$/gm, '')
      // Strip Amharic section headings that bled into an answer line:
      //   "ትደግፋለች:: # ክርስቲያናዊ ሥርዓተ ቀብሮች"  →  "ትደግፋለች::"
      .replace(/::\s*#\s*[\u1200-\u137F][^\n]*/g, '::')
      // Strip "# 567 ምዕራፍ ሦስት …" style OCR breadcrumbs that bled into a
      // Q&A line. Lookbehind requires preceding text so standalone headings survive.
      .replace(/(?<=\S)\s*#\s*\d+\s+[\u1200-\u137F][^\n]*/g, '')
      // Break sentences after Ethiopic full stop ("::" / "።") into separate
      // paragraphs so long Amharic prose breathes. We pair this with
      // text-align-last:justify on Amharic paragraphs so single-sentence
      // paragraphs still justify across the full width. Skip blockquotes
      // (verse citations) and bullet items (Q&A cards), which would lose
      // structure if their inner text gets paragraph-broken.
      .split('\n')
      .map((line) => {
        if (/^\s*(?:>|[-*]\s)/.test(line)) return line;
        return line.replace(/(::|።)\s*(?=\S)/g, '$1\n\n');
      })
      .join('\n')
      // Pull inline [CCC ...] refs out of A/Q paragraphs onto their own line so
      // the renderer can style them consistently as badges.
      // e.g. "answer text. [CCC 774-776, 780] more text" → two lines
      .replace(/\s*(\[CCC\s[^\]]+\])/g, '\n\n$1')
      // Convert [[wiki-link]] syntax → markdown link with #wiki: scheme so the
      // anchor override can intercept it and call openPage.
      // e.g. "[[teaching/baptism]]" → "[teaching/baptism](#wiki:teaching/baptism)"
      .replace(/\[\[([^\]]+)\]\]/g, (_m, p) => `[${p}](#wiki:${p})`)
      // Split verse blockquote from its citation line so we can style them
      // separately. Pattern: "> «verse»\n> — Citation" → "> «verse»\n>\n> — Citation"
      // (a blank ">" line splits them into two paragraphs inside one <blockquote>).
      .replace(/^(>[^\n]*?)\n(>\s*[—–-]\s+[^\n]+)$/gm, '$1\n>\n$2')
      // Collapse excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, [selected]);

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex flex-col h-full text-ink" style={{ background: 'var(--parchment)' }}>
        {/* Article Header */}
        <div className="sticky top-0 z-30 px-6 pt-12 pb-4" style={{ background: 'rgba(244,238,221,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid var(--rule)' }}>
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition-colors mb-3"
          >
            <ChevronLeft size={16} /> Back
          </button>
          {selected.title_am && (
            <h1 className="font-garamond text-3xl font-medium text-ink leading-tight" lang="am">
              {selected.title_am}
            </h1>
          )}
          {selected.title_en && selected.title_en !== selected.title_am && (
            <p className="font-ethiopic text-lg text-ink-mid mt-1">{selected.title_en}</p>
          )}
          {(selected.frontmatter.compendium_q || selected.frontmatter.sources) && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {selected.frontmatter.compendium_q &&
                (() => {
                  const raw = String(selected.frontmatter.compendium_q).replace(/[*_]/g, '').trim();
                  const looksLikeRange = /^[\d፩-፼]/.test(raw);
                  if (!looksLikeRange) return null;
                  return (
                    <span className="font-mono text-[10px] px-2.5 py-0.5 text-oxblood uppercase tracking-wider" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
                      Q {raw}
                    </span>
                  );
                })()
              }
              {selected.frontmatter.ccc && (
                <span className="font-mono text-[10px] px-2.5 py-0.5 text-ink-soft uppercase tracking-wider" style={{ border: '1px solid var(--rule)' }}>
                  CCC {selected.frontmatter.ccc}
                </span>
              )}
              {selected.frontmatter.sources && (
                <span className="font-mono text-[10px] px-2.5 py-0.5 text-ink-soft tracking-wider" style={{ border: '1px solid var(--rule)' }}>
                  {selected.frontmatter.sources} sources
                </span>
              )}
            </div>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 pb-32">
          <div className="max-w-3xl mx-auto">
            {/* Empty state for stub pages */}
            {!cleanBody && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen size={40} className="text-rule mb-4" />
                <p className="text-ink-soft font-garamond text-lg mb-2">Content coming soon</p>
                <p className="text-ink-soft/60 text-sm max-w-xs">
                  This page is a placeholder. Full Amharic content will be added in a future update.
                </p>
                {selected.frontmatter.compendium_q && (
                  <p className="text-oxblood/60 text-xs mt-4 font-mono">
                    See teaching pages for Q {selected.frontmatter.compendium_q}
                  </p>
                )}
              </div>
            )}

            {cleanBody && <article
              className="prose max-w-none
                         prose-headings:font-garamond prose-headings:text-ink
                         prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:pb-2 prose-h2:border-b prose-h2:border-rule
                         prose-h3:text-lg prose-h3:mt-7 prose-h3:mb-2 prose-h3:text-oxblood
                         prose-p:leading-[1.9] prose-p:text-ink/80 prose-p:text-[15px] prose-p:my-5
                         prose-blockquote:border-l-[3px] prose-blockquote:border-oxblood
                         prose-blockquote:bg-parchment-light prose-blockquote:py-3 prose-blockquote:px-4
                         prose-blockquote:text-ink prose-blockquote:not-italic prose-blockquote:my-5
                         prose-strong:text-ink prose-strong:font-semibold
                         prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline
                         prose-ul:my-5 prose-ul:space-y-4 prose-ul:pl-0 prose-ul:list-none
                         prose-li:text-ink/80 prose-li:text-[15px] prose-li:leading-[1.9] prose-li:marker:text-oxblood/50
                         prose-hr:border-rule"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Q number headings like "### Q486" — add top border separator
                  h3: ({ children, ...props }) => {
                    const text = String(children ?? '');
                    if (/^Q\d+/.test(text.trim())) {
                      return (
                        <div className="mt-10 pt-6 first:mt-0 first:pt-0 first:border-0" style={{ borderTop: '1px solid var(--rule)' }}>
                          <span className="inline-block text-[11px] px-2.5 py-0.5 font-mono tracking-wider mb-2 text-oxblood" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
                            {children}
                          </span>
                        </div>
                      );
                    }
                    return <h3 {...props}>{children}</h3>;
                  },
                  // Bilingual-aware paragraph rendering. Amharic-first paragraphs
                  // get the Amharic font stack + lang="am" so the language switch
                  // doesn't look unprofessional when the page mixes scripts.
                  p: ({ children, ...props }) => {
                    const text = String(children ?? '');
                    // CCC reference lines like "[CCC 751-752, 777-804]" → pill badges
                    const cccMatch = text.trim().match(/^\[CCC\s+([^\]]+)\]$/);
                    if (cccMatch) {
                      // Split on commas OR on whitespace between numeric ranges
                      // (some sources use "2534-2540 2551-2554" with no comma).
                      const refs = cccMatch[1]
                        .split(/(?:,\s*|\s+(?=\d))/)
                        .map((r) => r.trim())
                        .filter(Boolean);
                      return (
                        <div className="flex flex-wrap gap-1.5 mt-2 mb-0 not-prose">
                          {refs.map((ref, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-ochre/10 text-ochre font-mono tracking-wide"
                              style={{ border: '1px solid rgba(182,133,48,0.2)' }}
                            >
                              CCC {ref.trim()}
                            </span>
                          ))}
                        </div>
                      );
                    }
                    // Q-bullet "Q: ..." (rare path, kept for compat)
                    if (/^Q:\s/.test(text.trim())) {
                      return (
                        <p className="text-ink font-semibold mt-2 mb-2 text-[15px] leading-relaxed text-justify" lang="am" style={{ textJustify: 'inter-character' as React.CSSProperties['textJustify'], textAlignLast: 'justify' }} {...props}>
                          {children}
                        </p>
                      );
                    }
                    if (/^A:\s/.test(text.trim())) {
                      return (
                        <p className="text-ink/80 text-[15px] leading-[1.9] mb-0 pl-0 text-justify" lang="am" style={{ textJustify: 'inter-character' as React.CSSProperties['textJustify'], textAlignLast: 'justify' }} {...props}>
                          {children}
                        </p>
                      );
                    }
                    // Detect Amharic-script paragraphs (Ethiopic block U+1200-U+137F)
                    // and tag them so the font / line-height tuning is right.
                    const stripped = text.trim();
                    const firstChar = stripped.charCodeAt(0);
                    const isAmharic = firstChar >= 0x1200 && firstChar <= 0x137F;
                    if (isAmharic) {
                      return (
                        <p lang="am" className="font-ethiopic text-ink leading-[2] text-[15.5px] text-justify" style={{ textJustify: 'inter-character' as React.CSSProperties['textJustify'], textAlignLast: 'justify', hyphens: 'auto' }} {...props}>
                          {children}
                        </p>
                      );
                    }
                    return <p {...props}>{children}</p>;
                  },
                  // Q&A bullet items: "- **Q257** — Amharic question?\n  Summary: gloss"
                  // Render as a card with a Q chip, the question, and a muted gloss.
                  li: ({ children, ...props }) => {
                    // Walk children to detect the "**Q###** —" pattern up front.
                    const arr = React.Children.toArray(children);
                    const first = arr[0];
                    const firstIsQStrong =
                      React.isValidElement(first) &&
                      (first as React.ReactElement<{ children?: React.ReactNode }>).type === 'strong' &&
                      /^Q\d+$/i.test(String((first as React.ReactElement<{ children?: React.ReactNode }>).props.children ?? '').trim());
                    if (firstIsQStrong) {
                      const qLabel = String((first as React.ReactElement<{ children?: React.ReactNode }>).props.children ?? '').trim();
                      const rest = arr.slice(1);
                      // Split rest content on "Summary:" label so we can style the gloss differently.
                      const restText = rest.map((c) => (typeof c === 'string' ? c : '')).join('');
                      const summaryIdx = restText.indexOf('Summary:');
                      let body: React.ReactNode = rest;
                      let summary: React.ReactNode = null;
                      if (summaryIdx >= 0) {
                        // Naive split on the string children (works for the canonical
                        // "- **Q###** — text. Summary: gloss" shape).
                        const joined = restText;
                        const beforeSummary = joined.slice(0, summaryIdx).replace(/^\s*[—–-]\s*/, '').trim();
                        const afterSummary = joined.slice(summaryIdx + 'Summary:'.length).trim();
                        body = beforeSummary;
                        summary = afterSummary;
                      } else {
                        // No summary — strip leading em-dash from the question line.
                        body = restText.replace(/^\s*[—–-]\s*/, '').trim();
                      }
                      return (
                        <li className="list-none pl-0 not-prose px-4 py-3" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', borderRadius: '0.5rem' }} {...props}>
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-ochre/10 text-ochre font-mono tracking-wider mb-2" style={{ border: '1px solid rgba(182,133,48,0.2)' }}>
                            {qLabel}
                          </span>
                          <p className="text-ink text-[15.5px] leading-[1.9] m-0 text-justify" lang="am" style={{ textJustify: 'inter-character' as React.CSSProperties['textJustify'], textAlignLast: 'justify' }}>
                            {body}
                          </p>
                          {summary && (
                            <p className="text-ink-soft text-[13px] leading-[1.7] mt-2 mb-0 italic" lang="en">
                              <span className="not-italic uppercase tracking-wider text-[10px] text-ochre/50 mr-1.5">EN</span>
                              {summary}
                            </p>
                          )}
                        </li>
                      );
                    }
                    return <li {...props}>{children}</li>;
                  },
                  // Internal [[wiki-link]] anchors (rewritten in cleanBody to
                  // href="#wiki:type/slug"). Render as a styled inline anchor
                  // that calls openPage when clicked — no full navigation.
                  a: ({ href, children, ...props }) => {
                    if (href && href.startsWith('#wiki:')) {
                      const target = href.slice('#wiki:'.length);
                      const slashIdx = target.indexOf('/');
                      const page_typeRaw = slashIdx >= 0 ? target.slice(0, slashIdx) : 'teaching';
                      const slugRaw = slashIdx >= 0 ? target.slice(slashIdx + 1) : target;
                      // Decode percent-encoded Amharic so labels read natively.
                      const safeDecode = (s: string) => {
                        try { return decodeURIComponent(s); } catch { return s; }
                      };
                      const page_type = safeDecode(page_typeRaw);
                      const slug = safeDecode(slugRaw);
                      // Type singular form for API (concept, figure, teaching…).
                      const apiType = page_type.replace(/s$/, '');
                      // Detect if the slug is Amharic — adjust font for readability.
                      const isAmharicSlug = /[\u1200-\u137F]/.test(slug);
                      return (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openPage({ page_type: apiType, slug } as WikiPageListItem);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-ochre/5 text-ochre text-[13px] hover:bg-ochre/15 transition-colors no-underline cursor-pointer"
                          style={{ border: '1px solid rgba(182,133,48,0.3)' }}
                        >
                          <span className="text-ochre/40 text-[10px] uppercase tracking-wider mr-0.5">{apiType}</span>
                          <span lang={isAmharicSlug ? 'am' : 'en'} className={isAmharicSlug ? 'font-serif' : ''}>{slug}</span>
                        </a>
                      );
                    }
                    return <a href={href} {...props}>{children}</a>;
                  },
                  // Bible-verse blockquote: split into verse line + citation line.
                  // The cleanBody pre-processor inserts a blank ">" between them,
                  // so React receives two <p> children — verse first, citation
                  // second (the one starting with "—"/"–").
                  blockquote: ({ children, ...props }) => {
                    const kids = React.Children.toArray(children).filter(
                      (c) => !(typeof c === 'string' && c.trim() === '')
                    );
                    // Detect the citation paragraph: starts with em-dash.
                    const isCitation = (node: React.ReactNode): boolean => {
                      const text = (function extract(n: React.ReactNode): string {
                        if (typeof n === 'string') return n;
                        if (Array.isArray(n)) return n.map(extract).join('');
                        if (React.isValidElement(n)) {
                          const props = (n as React.ReactElement<{ children?: React.ReactNode }>).props;
                          return extract(props?.children);
                        }
                        return '';
                      })(node).trim();
                      return /^[—–-]\s/.test(text);
                    };
                    const verseNodes: React.ReactNode[] = [];
                    const citationNodes: React.ReactNode[] = [];
                    kids.forEach((k) => (isCitation(k) ? citationNodes : verseNodes).push(k));
                    return (
                      <blockquote
                        {...props}
                        className="not-prose my-7 pl-5 pr-4 py-4 border-l-2 border-ochre/50 bg-gradient-to-r from-ochre/[0.06] to-transparent rounded-r-lg relative"
                      >
                        <BookOpen
                          size={14}
                          className="absolute -left-[8px] top-4 text-ochre/70 rounded-full p-0.5" style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}
                        />
                        <div className="font-ethiopic text-[16.5px] leading-[2] text-ink" lang="am">
                          {verseNodes}
                        </div>
                        {citationNodes.length > 0 && (
                          <div className="mt-3 pt-2 text-[11px] uppercase tracking-[0.15em] text-ochre/70 font-medium not-italic" style={{ borderTop: '1px solid var(--rule)' }}>
                            {citationNodes.map((c, i) => (
                              <span key={i}>
                                {React.isValidElement(c)
                                  ? (() => {
                                      const props = (c as React.ReactElement<{ children?: React.ReactNode }>).props;
                                      return props?.children;
                                    })()
                                  : c}
                              </span>
                            ))}
                          </div>
                        )}
                      </blockquote>
                    );
                  },
                }}
              >
                {cleanBody}
              </ReactMarkdown>
            </article>}

            {selected.bible_refs.length > 0 && (
              <footer className="mt-10 pt-5" style={{ borderTop: '1px solid var(--rule)' }}>
                <p className="text-[10px] text-ink-soft uppercase tracking-wider mb-3 font-mono">
                  Bible references ({selected.bible_refs.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.bible_refs.slice(0, 20).map((r, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2.5 py-1 rounded-full text-ink-mid font-mono" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}
                    >
                      {r.book} {r.chapter}:{r.verses}
                    </span>
                  ))}
                  {selected.bible_refs.length > 20 && (
                    <span className="text-[11px] px-2.5 py-1 text-ink-soft">
                      +{selected.bible_refs.length - 20} more
                    </span>
                  )}
                </div>
              </footer>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────
  const items = searchResults ?? list;

  return (
    <div className="flex flex-col h-full text-ink" style={{ background: 'var(--parchment)' }}>
      <div className="sticky top-0 z-30 px-6 pt-12 pb-4" style={{ background: 'rgba(244,238,221,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid var(--rule)' }}>
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="font-ethiopic text-2xl font-medium text-ink leading-tight mb-0.5">
            {'ትምህርት'} <span className="font-garamond text-ink-mid text-lg">· Teaching</span>
          </h1>
          <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em] mb-4">Catholic Teaching Wiki</p>

          {/* Search */}
          <form onSubmit={runSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ጸጋ, Eucharist, Q271…"
                className="w-full pl-9 pr-3 py-2.5 text-sm text-ink placeholder-ink-soft/50
                           focus:outline-none transition-colors font-sans"
                style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}
              />
            </div>
            {searchResults && (
              <button
                type="button"
                onClick={() => { setSearchResults(null); setQuery(''); }}
                className="text-sm text-ink-soft hover:text-ink px-2 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </form>

          {/* Tabs */}
          {!searchResults && (
            <nav className="flex gap-1 -mb-4 overflow-x-auto">
              {TABS.filter(t => t.ready).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 font-sans ${
                    tab === t.id
                      ? 'border-oxblood text-ink'
                      : 'border-transparent text-ink-soft hover:text-ink-mid'
                  }`}
                >
                  <span className="font-ethiopic">{t.label_am}</span>
                  <span className="text-ink-soft ml-1.5">· {t.label_en}</span>
                </button>
              ))}
              {TABS.some(t => !t.ready) && (
                <span className="px-3 py-2.5 text-[11px] text-ink-soft/40 self-center whitespace-nowrap font-mono">
                  More coming soon
                </span>
              )}
            </nav>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto w-full px-6 pt-4">
          {loading && (
            <p className="text-sm text-ink-soft py-8 text-center font-garamond italic">Loading…</p>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-ink-soft py-8 text-center font-garamond italic">No pages found.</p>
          )}

          <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {items.map((item) => (
              <li key={`${item.page_type}/${item.slug}`}>
                <button
                  onClick={() => openPage(item)}
                  className="w-full text-left py-3.5 px-3 -mx-3 hover:bg-rule/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {item.title_am && (
                        <p className="font-ethiopic text-[17px] text-ink truncate" lang="am">
                          {item.title_am}
                        </p>
                      )}
                      {item.title_en && item.title_en !== item.title_am && (
                        <p className="font-garamond text-sm text-ink-mid truncate">{item.title_en}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {searchResults && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                          {item.page_type}
                        </span>
                      )}
                      {item.compendium_q && (
                        <p className="font-mono text-[10px] text-ink-soft mt-0.5">Q {item.compendium_q}</p>
                      )}
                      {item.bible_ref_count > 0 && (
                        <p className="text-xs text-ochre mt-0.5 flex items-center gap-1 justify-end">
                          <BookOpen size={11} /> {item.bible_ref_count}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WikiViewer;
