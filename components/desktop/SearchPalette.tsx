import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View } from '../../types';
import { Rubric, CrossMark } from '../ui/ManuscriptPrimitives';
import { CATHOLIC_BOOKS } from '../../constants';
import { wikiApi, WikiPageListItem } from '../../services/apiClient';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  setView: (view: View) => void;
  openWikiPage?: (slug: string) => void;
}

type ResultKind = 'nav' | 'book' | 'concept' | 'compendium';

interface SearchResult {
  kind: ResultKind;
  label: string;
  am?: string;
  detail?: string;
  action: () => void;
}

const NAV_RESULTS: { label: string; am: string; view: View }[] = [
  { label: 'Home',      am: 'ዋና ገጽ',    view: View.DEVOTION },
  { label: 'Teaching',  am: 'ትምህርት',    view: View.WIKI },
  { label: 'Bible',     am: 'መጽሐፍ ቅዱስ', view: View.READER },
  { label: 'Ask Emmaus', am: 'ጠይቅ',      view: View.CHAT },
  { label: 'Bookmarks', am: 'ዕልባቶች',    view: View.BOOKMARKS },
  { label: 'Settings',  am: 'ቅንብሮች',    view: View.ADMIN_EDIT },
];

// Wiki pages cached on first open
let wikiCache: WikiPageListItem[] | null = null;

export const SearchPalette: React.FC<SearchPaletteProps> = ({ open, onClose, setView, openWikiPage }) => {
  const [query, setQuery] = useState('');
  const [wikiPages, setWikiPages] = useState<WikiPageListItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch wiki pages once on first open
  useEffect(() => {
    if (!open) return;
    if (wikiCache) {
      setWikiPages(wikiCache);
      return;
    }
    Promise.all([
      wikiApi.list('teaching').catch(() => []),
      wikiApi.list('concept').catch(() => []),
    ]).then(([t, c]) => {
      const all = [...t, ...c];
      wikiCache = all;
      setWikiPages(all);
    });
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  const q = query.toLowerCase().trim();

  // Build results
  const results: SearchResult[] = [];

  // Nav matches
  NAV_RESULTS.forEach((n) => {
    if (!q || n.label.toLowerCase().includes(q) || (n.am && n.am.includes(query))) {
      results.push({
        kind: 'nav',
        label: n.label,
        am: n.am,
        detail: 'Navigation',
        action: () => { setView(n.view); onClose(); },
      });
    }
  });

  // Wiki page matches (teaching + concept — real data)
  wikiPages.forEach((p) => {
    const labelEn = p.title_en || p.slug;
    const labelAm = p.title_am || '';
    if (!q || labelEn.toLowerCase().includes(q) || labelAm.includes(query) || p.slug.includes(q)) {
      results.push({
        kind: p.page_type === 'concept' ? 'concept' : 'compendium',
        label: labelEn,
        am: labelAm || undefined,
        detail: `${p.page_type}${p.compendium_q ? ` · Q ${p.compendium_q}` : ''}`,
        action: () => {
          if (openWikiPage) openWikiPage(p.slug);
          else { setView(View.WIKI); }
          onClose();
        },
      });
    }
  });

  // Bible book matches
  if (q) {
    CATHOLIC_BOOKS.forEach((b) => {
      if (b.name.toLowerCase().includes(q) || b.amharicName.includes(query)) {
        results.push({
          kind: 'book',
          label: b.name,
          am: b.amharicName,
          detail: `${b.chapters} chapters · ${b.section}`,
          action: () => { setView(View.READER); onClose(); },
        });
      }
    });
  }

  const shown = results.slice(0, 12);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-[560px] border border-rule rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ background: 'var(--parchment)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-rule">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-soft shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ጸጋ, Eucharist, Q271, Luke…"
            className="flex-1 bg-transparent font-garamond text-lg text-ink outline-none placeholder:text-ink-soft"
          />
          <kbd className="font-mono text-[10px] text-ink-soft border border-rule px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {shown.length === 0 && q && (
            <div className="px-5 py-8 text-center font-sans text-sm text-ink-soft">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {shown.map((r, i) => (
            <button
              key={`${r.kind}-${r.label}-${i}`}
              onClick={r.action}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-parchment-dark transition-colors"
            >
              {/* Kind icon */}
              <div className="w-6 h-6 shrink-0 rounded grid place-items-center bg-parchment-dark text-ink-soft">
                {r.kind === 'nav' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
                )}
                {r.kind === 'book' && <CrossMark size={12} color="var(--oxblood)" />}
                {r.kind === 'concept' && (
                  <span className="text-[10px] font-mono text-oxblood">C</span>
                )}
                {r.kind === 'compendium' && (
                  <span className="text-[10px] font-mono text-oxblood">Q</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-garamond text-[15px] font-medium text-ink truncate">
                    {r.label}
                  </span>
                  {r.am && (
                    <span className="font-ethiopic text-[13px] text-ink-mid truncate">
                      {r.am}
                    </span>
                  )}
                </div>
                {r.detail && (
                  <div className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.12em] mt-0.5">
                    {r.detail}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-rule flex items-center gap-4 font-mono text-[10px] text-ink-soft">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
};
