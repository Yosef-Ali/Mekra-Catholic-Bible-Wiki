import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { View } from './types';
import { Navigation } from './components/Navigation';
import { DailyDevotion } from './components/DailyDevotion';
import { BibleReader } from './components/BibleReader';
import { ChatAssistant } from './components/ChatAssistant';
import { Bookmarks } from './components/Bookmarks';
import { WikiViewer } from './components/WikiViewer';
import { Onboarding } from './components/Onboarding';
import { AdminEditMode } from './components/AdminEditMode';
import { SettingsPage } from './components/SettingsPage';
import { getUserProfile } from './services/storageService';
import { TypographyProvider } from './contexts/TypographyContext';
import { useIsDesktop } from './hooks/useIsDesktop';
import { DesktopTopBar } from './components/desktop/DesktopTopBar';
import { DesktopHome } from './components/desktop/DesktopHome';
import { DesktopArticle } from './components/desktop/DesktopArticle';
import { DesktopAskAI } from './components/desktop/DesktopAskAI';
import { DesktopBibleSelector } from './components/desktop/DesktopBibleSelector';
import { DesktopContentWrapper } from './components/desktop/DesktopContentWrapper';
import { DesktopBookmarks } from './components/desktop/DesktopBookmarks';
import { DesktopSettings } from './components/desktop/DesktopSettings';
import { SearchPalette } from './components/desktop/SearchPalette';

// Footer visibility context
export const FooterContext = createContext<{
  hideFooter: boolean;
  setHideFooter: (hide: boolean) => void;
}>({ hideFooter: false, setHideFooter: () => {} });

export const useFooter = () => useContext(FooterContext);

// Main app content (protected)
const AppContent: React.FC = () => {
  const [currentView, setView] = useState<View>(View.DEVOTION);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hideFooter, setHideFooter] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedWikiSlug, setSelectedWikiSlug] = useState<string | null>(null);
  const [pendingBibleRef, setPendingBibleRef] = useState<{ book: string; chapter: number; verses?: string } | null>(null);
  const isDesktop = useIsDesktop();

  // Navigate to a wiki article by slug
  const openWikiPage = useCallback((slug: string) => {
    setSelectedWikiSlug(slug);
    setView(View.WIKI);
  }, []);

  // Navigate to a specific Bible verse
  const openBibleRef = useCallback((ref: { book: string; chapter: number; verses?: string }) => {
    setPendingBibleRef(ref);
    setView(View.READER);
  }, []);

  useEffect(() => {
    setHideFooter((prev) => (prev ? false : prev));
  }, [currentView]);

  useEffect(() => {
    const profile = getUserProfile();
    if (!profile) setShowOnboarding(true);
  }, []);

  // ⌘K / Ctrl+K keyboard shortcut for search palette
  useEffect(() => {
    if (!isDesktop) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isDesktop]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setView(View.DEVOTION);
  };

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const footerCtx = useMemo(() => ({ hideFooter, setHideFooter }), [hideFooter]);

  /* ── Mobile view renderer (existing) ── */
  const renderMobileView = () => {
    switch (currentView) {
      case View.DEVOTION: return <DailyDevotion onOpenSettings={() => setView(View.ADMIN_EDIT)} />;
      case View.READER: return <TypographyProvider><BibleReader /></TypographyProvider>;
      case View.CHAT: return <ChatAssistant />;
      case View.BOOKMARKS: return <Bookmarks />;
      case View.WIKI: return <WikiViewer />;
      case View.ADMIN_EDIT: return <SettingsPage setView={setView} />;
      case View.CONTENT_EDITOR: return <AdminEditMode />;
      default: return <DailyDevotion onOpenSettings={() => setView(View.ADMIN_EDIT)} />;
    }
  };

  /* ── Desktop view renderer (Manuscript Modern) ── */
  const renderDesktopView = () => {
    switch (currentView) {
      case View.DEVOTION:
        return <DesktopHome setView={setView} openWikiPage={openWikiPage} openBibleRef={openBibleRef} />;
      case View.WIKI:
        return <DesktopArticle setView={setView} slug={selectedWikiSlug} onSelectSlug={setSelectedWikiSlug} openBibleRef={openBibleRef} />;
      case View.CHAT:
        return <DesktopAskAI setView={setView} />;
      case View.READER:
        return <DesktopBibleSelector setView={setView} initialRef={pendingBibleRef} onRefConsumed={() => setPendingBibleRef(null)} />;
      case View.BOOKMARKS:
        return <DesktopBookmarks />;
      case View.ADMIN_EDIT:
        return <DesktopSettings setView={setView} />;
      case View.CONTENT_EDITOR:
        return (
          <DesktopContentWrapper>
            <AdminEditMode />
          </DesktopContentWrapper>
        );
      default:
        return <DesktopHome setView={setView} openWikiPage={openWikiPage} openBibleRef={openBibleRef} />;
    }
  };

  // Show onboarding for new users
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  /* ── Desktop layout ── */
  if (isDesktop) {
    return (
      <FooterContext.Provider value={footerCtx}>
        <div
          className="h-screen w-screen overflow-hidden flex flex-col font-garamond text-ink"
          style={{
            background: 'var(--parchment)',
            backgroundImage: 'radial-gradient(ellipse at top left, rgba(182,133,48,0.04), transparent 60%), radial-gradient(ellipse at bottom right, rgba(122,37,34,0.03), transparent 60%)',
          }}
        >
          <DesktopTopBar currentView={currentView} setView={setView} onSearchOpen={openSearch} />
          <main className="flex-1 min-h-0">
            <div key={currentView} className="h-full animate-in fade-in duration-300">
              {renderDesktopView()}
            </div>
          </main>
          <SearchPalette open={searchOpen} onClose={closeSearch} setView={setView} openWikiPage={openWikiPage} />
        </div>
      </FooterContext.Provider>
    );
  }

  /* ── Mobile layout (unchanged) ── */
  return (
    <FooterContext.Provider value={footerCtx}>
      <div
        className="h-screen h-[100dvh] w-screen overflow-hidden flex flex-col font-garamond text-ink"
        style={{
          background: 'var(--parchment)',
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(182,133,48,0.04), transparent 60%), radial-gradient(ellipse at bottom right, rgba(122,37,34,0.03), transparent 60%)',
        }}
      >
        <main className="flex-1 h-full relative">
          <div key={currentView} className="h-full animate-in fade-in duration-300">
            {renderMobileView()}
          </div>
        </main>
        <Navigation
          currentView={currentView}
          setView={setView}
          hidden={hideFooter}
        />
      </div>
    </FooterContext.Provider>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
