import React from 'react';
import { View } from '../types';
import { Home, Search, Library } from 'lucide-react';
import { CrossMark } from './ui/ManuscriptPrimitives';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
  hidden?: boolean;
}

// Teaching "T" icon matching the design mockup (open book with vertical spine)
const TeachingIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    className={active ? 'text-oxblood' : 'text-ink-soft'}>
    <path d="M4 4h6a3 3 0 013 3v13M20 4h-6a3 3 0 00-3 3" />
  </svg>
);

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, hidden }) => {
  const navItems = [
    { id: View.DEVOTION, label: 'Home', icon: (active: boolean) => <Home size={22} strokeWidth={1.6} className={active ? 'text-oxblood' : 'text-ink-soft'} /> },
    { id: View.WIKI, label: 'Teaching', icon: (active: boolean) => <TeachingIcon active={active} /> },
    { id: View.CHAT, label: 'Search', icon: (active: boolean) => <Search size={22} strokeWidth={1.6} className={active ? 'text-oxblood' : 'text-ink-soft'} /> },
    { id: View.READER, label: 'Emmaus', icon: (active: boolean) => <CrossMark size={20} color={active ? '#7A2522' : '#847B68'} /> },
    { id: View.BOOKMARKS, label: 'Library', icon: (active: boolean) => <Library size={22} strokeWidth={1.6} className={active ? 'text-oxblood' : 'text-ink-soft'} /> },
  ];

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-500 ease-out ${
        hidden ? 'translate-y-[140%] opacity-0' : 'translate-y-0 opacity-100'
      }`}
      aria-label="Primary"
    >
      <div
        className="border-t border-rule pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'rgba(244,238,221,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex justify-around items-start pt-2.5 px-4 pb-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setView(item.id)}
                className="flex flex-col items-center gap-1 min-w-[48px] focus-visible:outline-none"
              >
                {item.icon(isActive)}
                <span
                  className={`font-sans text-[10px] tracking-[0.04em] transition-colors ${
                    isActive ? 'text-oxblood font-medium' : 'text-ink-soft'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
