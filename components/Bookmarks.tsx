import React, { useState, useEffect, useRef } from 'react';
import { Bookmark } from '../types';
import { getBookmarks, removeBookmark } from '../services/storageService';
import { Trash2, MessageCircle, BookOpen, Quote, Calendar, BookmarkIcon } from 'lucide-react';
import { useFooter } from '../App';
import { useScrollHideFooter } from '../hooks/useScrollHideFooter';
import { CrossMark, Ornament, SectionLabel } from './ui/ManuscriptPrimitives';

export const Bookmarks: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeTab, setActiveTab] = useState<'verse' | 'chat'>('verse');
  const { setHideFooter } = useFooter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useScrollHideFooter(setHideFooter, scrollRef);

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  const handleDelete = (id: string) => {
    removeBookmark(id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const filteredBookmarks = bookmarks.filter(b => b.type === activeTab);
  const verseCount = bookmarks.filter(b => b.type === 'verse').length;
  const chatCount = bookmarks.filter(b => b.type === 'chat').length;

  return (
    <div className="h-full w-full overflow-y-auto text-ink pb-32" ref={scrollRef} style={{ background: 'var(--parchment)' }}>
      <div className="max-w-2xl mx-auto px-6 pt-14 space-y-0">

        {/* ── Header ── */}
        <div className="flex items-start gap-5 mb-6">
          <div
            className="w-14 h-14 rounded-full grid place-items-center shrink-0"
            style={{ background: 'var(--vellum-dark)', border: '2px solid var(--rule)' }}
          >
            <BookmarkIcon size={22} className="text-oxblood" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="font-garamond text-[28px] font-medium leading-tight">Saved</h1>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mt-1">
              {bookmarks.length} item{bookmarks.length !== 1 ? 's' : ''} · ዕልባት
            </div>
          </div>
        </div>

        <Ornament w={120} />

        {/* ── Tab selector ── */}
        <div className="mt-8 mb-6">
          <div className="flex gap-2">
            {[
              { key: 'verse' as const, label: 'Verses', am: 'ጥቅሶች', icon: BookOpen, count: verseCount },
              { key: 'chat' as const, label: 'Insights', am: 'ማስተዋሎች', icon: MessageCircle, count: chatCount },
            ].map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-3 px-4 text-left transition-all ${
                    active ? 'text-ink' : 'text-ink-mid hover:text-ink'
                  }`}
                  style={{
                    background: active ? 'var(--cream)' : 'transparent',
                    border: `1px solid ${active ? 'var(--oxblood)' : 'var(--rule)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <tab.icon size={16} className={active ? 'text-oxblood' : 'text-ink-soft'} />
                    <span className="font-garamond text-[15px] font-medium">{tab.label}</span>
                    <span
                      className="ml-auto font-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{
                        background: active ? 'var(--parchment)' : 'var(--vellum-dark)',
                        color: active ? 'var(--oxblood)' : 'var(--ink-soft, #847B68)',
                      }}
                    >
                      {tab.count}
                    </span>
                  </div>
                  <div className="font-ethiopic text-[12px] text-ink-soft">{tab.am}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        {/* ── Bookmark list ── */}
        <div className="mt-6 mb-8">
          <SectionLabel>{activeTab === 'verse' ? 'Saved Verses' : 'Saved Insights'}</SectionLabel>

          {filteredBookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-ink-soft">
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
              <p className="font-garamond text-lg italic text-ink-soft mb-1">
                No saved {activeTab === 'verse' ? 'verses' : 'insights'} yet
              </p>
              <p className="font-mono text-[10px] tracking-wider text-ink-soft uppercase">
                {activeTab === 'verse' ? 'Bookmark verses while reading' : 'Save insights from conversations'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group relative"
                  style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}
                >
                  {/* Reference bar */}
                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: '1px solid var(--rule)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      {activeTab === 'verse' ? (
                        <CrossMark size={12} color="#7A2522" />
                      ) : (
                        <MessageCircle size={12} className="text-oxblood" />
                      )}
                      <span className="font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-oxblood">
                        {bookmark.reference}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-soft tracking-wider">
                      <Calendar size={10} />
                      {bookmark.date}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-4 pt-4 pb-3">
                    <p className="font-ethiopic text-ink leading-[1.8] text-[17px]">
                      {bookmark.content}
                    </p>

                    {bookmark.note && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--rule)' }}>
                        <p className="font-garamond text-[14px] text-ink-mid italic leading-relaxed">
                          {bookmark.note}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end px-4 pb-3">
                    <button
                      onClick={() => handleDelete(bookmark.id)}
                      className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-ink-soft hover:text-red-600 transition-colors py-1 px-2"
                      title="Remove"
                      aria-label="Remove bookmark"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
