import React from 'react';
import { View } from '../../types';
import { CrossMark } from '../ui/ManuscriptPrimitives';

interface DesktopTopBarProps {
  currentView: View;
  setView: (view: View) => void;
  onSearchOpen: () => void;
}

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: View.DEVOTION, label: 'Home' },
  { id: View.WIKI, label: 'Teaching' },
  { id: View.READER, label: 'Emmaus' },
  { id: View.CHAT, label: 'Ask' },
  { id: View.BOOKMARKS, label: 'Bookmarks' },
];

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({ currentView, setView, onSearchOpen }) => {
  return (
    <header
      className="h-14 flex items-center px-8 border-b border-rule shrink-0"
      style={{
        background: 'rgba(244,238,221,0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* Logo */}
      <button onClick={() => setView(View.DEVOTION)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <CrossMark size={18} />
        <div className="font-garamond font-semibold text-[19px] tracking-wide">Emmaus</div>
        <span className="text-rule text-[13px] mx-1">·</span>
        <div className="font-ethiopic text-[16px] text-ink-mid">{'ኤማዉስ'}</div>
      </button>

      {/* Nav links */}
      <nav className="flex gap-7 ml-12 font-sans text-[13px]">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`pb-[18px] -mb-[18px] border-b-[1.5px] transition-colors ${
                active
                  ? 'text-ink font-medium border-oxblood'
                  : 'text-ink-soft border-transparent hover:text-ink-mid'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right: search + settings + avatar */}
      <div className="ml-auto flex items-center gap-3.5">
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 px-3 py-1.5 border border-rule rounded font-sans text-[12px] text-ink-soft w-[220px] hover:border-ink-soft transition-colors text-left"
          style={{ background: 'var(--cream)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="truncate">{`Search ጸጋ, Eucharist, Q271…`}</span>
          <span className="ml-auto font-mono text-[10px] text-ink-soft border border-rule px-1 rounded-sm shrink-0">
            {'⌘'}K
          </span>
        </button>

        {/* Settings gear */}
        <button
          onClick={() => setView(View.ADMIN_EDIT)}
          className="text-ink-soft hover:text-ink-mid transition-colors"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <div
          className="w-7 h-7 rounded-full grid place-items-center font-sans text-[11px] text-ink-mid"
          style={{ background: 'var(--vellum-dark)' }}
        >
          YA
        </div>
      </div>
    </header>
  );
};
