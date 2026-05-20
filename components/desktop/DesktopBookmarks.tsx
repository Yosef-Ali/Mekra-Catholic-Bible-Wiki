import React, { useState, useEffect, useMemo } from 'react';
import { Bookmark } from '../../types';
import { getBookmarks, removeBookmark } from '../../services/storageService';
import {
  Trash2,
  MessageCircle,
  BookOpen,
  BookmarkIcon,
  Calendar,
  Quote,
  SortDesc,
} from 'lucide-react';
import { CrossMark, Ornament, Meta, SectionLabel } from '../ui/ManuscriptPrimitives';

type SortMode = 'newest' | 'oldest' | 'reference';

export const DesktopBookmarks: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeTab, setActiveTab] = useState<'verse' | 'chat'>('verse');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  const handleDelete = (id: string) => {
    removeBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const verseCount = useMemo(() => bookmarks.filter((b) => b.type === 'verse').length, [bookmarks]);
  const chatCount = useMemo(() => bookmarks.filter((b) => b.type === 'chat').length, [bookmarks]);

  const sorted = useMemo(() => {
    const filtered = bookmarks.filter((b) => b.type === activeTab);
    return [...filtered].sort((a, b) => {
      if (sortMode === 'newest') return b.date.localeCompare(a.date);
      if (sortMode === 'oldest') return a.date.localeCompare(b.date);
      return a.reference.localeCompare(b.reference);
    });
  }, [bookmarks, activeTab, sortMode]);

  const selected = selectedId ? bookmarks.find((b) => b.id === selectedId) : null;

  const grouped = useMemo<Record<string, Bookmark[]>>(
    () => sorted.reduce<Record<string, Bookmark[]>>((acc, bm) => {
      const month = bm.date.slice(0, 7);
      if (!acc[month]) acc[month] = [];
      acc[month].push(bm);
      return acc;
    }, {}),
    [sorted],
  );

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  };

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '260px 1fr 320px' }}>
      {/* ── Left rail: filter & stats ── */}
      <aside className="border-r border-rule px-6 py-7 overflow-y-auto">
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4">
          Collections
        </div>

        {/* Type filter */}
        {[
          { key: 'verse' as const, label: 'Verses', am: 'ጥቅሶች', icon: BookOpen, count: verseCount },
          { key: 'chat' as const, label: 'Insights', am: 'ማስተዋሎች', icon: MessageCircle, count: chatCount },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
              className={`w-full flex items-center gap-3 py-3 px-3 mb-1.5 text-left transition-all ${
                active ? 'text-ink' : 'text-ink-mid hover:text-ink'
              }`}
              style={{
                background: active ? 'var(--cream)' : 'transparent',
                border: `1px solid ${active ? 'var(--oxblood)' : 'transparent'}`,
              }}
            >
              <tab.icon size={16} className={active ? 'text-oxblood' : 'text-ink-soft'} />
              <div className="flex-1">
                <div className="font-garamond text-[14px] font-medium">{tab.label}</div>
                <div className="font-ethiopic text-[11px] text-ink-soft">{tab.am}</div>
              </div>
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: active ? 'var(--parchment)' : 'var(--vellum-dark)',
                  color: active ? 'var(--oxblood)' : undefined,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}

        <div className="h-px my-5" style={{ background: 'var(--rule)' }} />

        {/* Sort */}
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3 flex items-center gap-1.5">
          <SortDesc size={11} /> Sort
        </div>
        {(['newest', 'oldest', 'reference'] as SortMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`block w-full text-left px-3 py-1.5 font-mono text-[11px] transition-colors ${
              sortMode === mode ? 'text-oxblood font-medium' : 'text-ink-soft hover:text-ink-mid'
            }`}
          >
            {mode === 'newest' ? 'Newest first' : mode === 'oldest' ? 'Oldest first' : 'By reference'}
          </button>
        ))}

        <div className="h-px my-5" style={{ background: 'var(--rule)' }} />

        {/* Stats */}
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3">
          Summary
        </div>
        <div className="space-y-2">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-ink-soft">Total saved</span>
            <span className="text-ink-mid">{bookmarks.length}</span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-ink-soft">Verses</span>
            <span className="text-ink-mid">{verseCount}</span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-ink-soft">Insights</span>
            <span className="text-ink-mid">{chatCount}</span>
          </div>
        </div>
      </aside>

      {/* ── Center: bookmark list ── */}
      <div className="overflow-y-auto px-10 py-8">
        {/* Header */}
        <div className="flex items-start gap-5 mb-5">
          <div
            className="w-12 h-12 rounded-full grid place-items-center shrink-0"
            style={{ background: 'var(--vellum-dark)', border: '2px solid var(--rule)' }}
          >
            <BookmarkIcon size={20} className="text-oxblood" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-garamond text-[26px] font-medium leading-tight">
              {activeTab === 'verse' ? 'Saved Verses' : 'Saved Insights'}
            </h1>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mt-0.5">
              {sorted.length} item{sorted.length !== 1 ? 's' : ''} · {activeTab === 'verse' ? 'ጥቅሶች' : 'ማስተዋሎች'}
            </div>
          </div>
        </div>

        <Ornament w={120} />

        {/* List */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-ink-soft">
            <div
              className="w-20 h-20 rounded-full grid place-items-center mb-5"
              style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}
            >
              {activeTab === 'verse' ? (
                <CrossMark size={28} color="#847B68" />
              ) : (
                <Quote size={28} className="text-ink-soft opacity-40" />
              )}
            </div>
            <p className="font-garamond text-lg italic mb-1">
              No saved {activeTab === 'verse' ? 'verses' : 'insights'} yet
            </p>
            <p className="font-mono text-[10px] tracking-wider text-ink-soft uppercase">
              {activeTab === 'verse' ? 'Bookmark verses while reading' : 'Save insights from conversations'}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            {Object.entries(grouped).map(([month, items]: [string, Bookmark[]]) => (
              <div key={month}>
                <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-soft mt-5 mb-2.5 flex items-center gap-2">
                  <Calendar size={10} />
                  {formatMonth(month)}
                </div>
                {items.map((bookmark) => {
                  const isSelected = selectedId === bookmark.id;
                  return (
                    <button
                      key={bookmark.id}
                      onClick={() => setSelectedId(bookmark.id)}
                      className={`w-full text-left p-4 mb-1.5 transition-all group ${
                        isSelected ? 'ring-1 ring-oxblood' : 'hover:ring-1 hover:ring-rule'
                      }`}
                      style={{
                        background: isSelected ? 'var(--cream)' : 'transparent',
                        border: `1px solid ${isSelected ? 'var(--oxblood)' : 'var(--rule)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {activeTab === 'verse' ? (
                          <CrossMark size={11} color={isSelected ? '#7A2522' : '#847B68'} />
                        ) : (
                          <MessageCircle size={11} className={isSelected ? 'text-oxblood' : 'text-ink-soft'} />
                        )}
                        <span className="font-mono text-[10px] tracking-[0.12em] uppercase font-medium text-oxblood">
                          {bookmark.reference}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-ink-soft">
                          {bookmark.date}
                        </span>
                      </div>
                      <p className="font-ethiopic text-[15px] text-ink leading-relaxed line-clamp-2">
                        {bookmark.content}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right rail: detail view ── */}
      <aside
        className="border-l border-rule px-7 py-8 overflow-y-auto"
        style={{ background: 'var(--cream)' }}
      >
        {selected ? (
          <>
            <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4">
              Detail
            </div>

            <div className="flex items-center gap-2 mb-4">
              {selected.type === 'verse' ? (
                <CrossMark size={14} color="#7A2522" />
              ) : (
                <MessageCircle size={14} className="text-oxblood" />
              )}
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase font-bold text-oxblood">
                {selected.reference}
              </span>
            </div>

            <div className="h-px mb-4" style={{ background: 'var(--rule)' }} />

            <p className="font-ethiopic text-[18px] text-ink leading-[1.9] mb-5">
              {selected.content}
            </p>

            {selected.note && (
              <>
                <div className="h-px mb-4" style={{ borderTop: '1px dashed var(--rule)' }} />
                <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-2">
                  Note
                </div>
                <p className="font-garamond text-[15px] text-ink-mid italic leading-relaxed mb-5">
                  {selected.note}
                </p>
              </>
            )}

            <div className="h-px mb-4" style={{ background: 'var(--rule)' }} />

            {/* Metadata */}
            <div className="space-y-2 mb-6">
              <Meta k="Saved" v={selected.date} />
              <Meta k="Type" v={selected.type} />
            </div>

            {/* Actions */}
            <button
              onClick={() => handleDelete(selected.id)}
              className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-ink-soft hover:text-red-600 transition-colors py-2 px-3 border border-rule hover:border-red-300"
              style={{ background: 'var(--parchment)' }}
            >
              <Trash2 size={13} />
              Remove bookmark
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-ink-soft">
            <div
              className="w-16 h-16 rounded-full grid place-items-center mb-4"
              style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}
            >
              <BookmarkIcon size={24} className="opacity-30" />
            </div>
            <p className="font-garamond text-[15px] italic text-center mb-1">
              Select a bookmark
            </p>
            <p className="font-mono text-[10px] tracking-wider uppercase text-center">
              to see full details
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
