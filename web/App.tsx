import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { View } from './types';
import { Navigation } from './components/Navigation';
import { getUserProfile } from './services/storageService';
import { TypographyProvider } from './contexts/TypographyContext';
import { FooterContext } from './contexts/FooterContext';
import { useIsDesktop } from './hooks/useIsDesktop';
import { DesktopTopBar } from './components/desktop/DesktopTopBar';
import { DesktopContentWrapper } from './components/desktop/DesktopContentWrapper';
import { SearchPalette } from './components/desktop/SearchPalette';

// Each view is its own chunk, fetched the first time it is shown. A phone
// never downloads the desktop layouts (or the reverse), and nobody downloads
// the 1,200-line content editor unless they open it. On a slow connection
// that is the difference between the home screen appearing and not.
const view = <T extends Record<string, React.ComponentType<any>>, K extends keyof T>(
  load: () => Promise<T>,
  name: K,
) => lazy(() => load().then((m) => ({ default: m[name] })));

const DailyDevotion = view(() => import('./components/DailyDevotion'), 'DailyDevotion');
const BibleReader = view(() => import('./components/BibleReader'), 'BibleReader');
const ChatAssistant = view(() => import('./components/ChatAssistant'), 'ChatAssistant');
const Bookmarks = view(() => import('./components/Bookmarks'), 'Bookmarks');
const WikiViewer = view(() => import('./components/WikiViewer'), 'WikiViewer');
const Onboarding = view(() => import('./components/Onboarding'), 'Onboarding');
const AdminEditMode = view(() => import('./components/AdminEditMode'), 'AdminEditMode');
const AdminGate = view(() => import('./components/AdminGate'), 'AdminGate');
const SettingsPage = view(() => import('./components/SettingsPage'), 'SettingsPage');
const DesktopHome = view(() => import('./components/desktop/DesktopHome'), 'DesktopHome');
const DesktopArticle = view(() => import('./components/desktop/DesktopArticle'), 'DesktopArticle');
const DesktopAskAI = view(() => import('./components/desktop/DesktopAskAI'), 'DesktopAskAI');
const DesktopBibleSelector = view(() => import('./components/desktop/DesktopBibleSelector'), 'DesktopBibleSelector');
const DesktopBookmarks = view(() => import('./components/desktop/DesktopBookmarks'), 'DesktopBookmarks');
const DesktopSettings = view(() => import('./components/desktop/DesktopSettings'), 'DesktopSettings');

/** Shown while a view's chunk is loading. */
const ViewLoading: React.FC = () => (
  <div
    className="h-full w-full flex items-center justify-center"
    style={{ background: 'var(--parchment)' }}
    role="status"
    aria-label="Loading"
  >
    <div className="flex gap-1.5">
      <span className="w-1.5 h-1.5 bg-oxblood/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-oxblood/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-oxblood/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);


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
      case View.DEVOTION: return <DailyDevotion onOpenSettings={() => setView(View.ADMIN_EDIT)} openBibleRef={openBibleRef} onOpenTeaching={() => setView(View.WIKI)} />;
      case View.READER: return <TypographyProvider><BibleReader initialRef={pendingBibleRef} onRefConsumed={() => setPendingBibleRef(null)} /></TypographyProvider>;
      case View.CHAT: return <ChatAssistant />;
      case View.BOOKMARKS: return <Bookmarks />;
      case View.WIKI: return <WikiViewer />;
      case View.ADMIN_EDIT: return <SettingsPage setView={setView} />;
      case View.CONTENT_EDITOR: return <AdminGate><AdminEditMode /></AdminGate>;
      default: return <DailyDevotion onOpenSettings={() => setView(View.ADMIN_EDIT)} openBibleRef={openBibleRef} onOpenTeaching={() => setView(View.WIKI)} />;
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
            <AdminGate><AdminEditMode /></AdminGate>
          </DesktopContentWrapper>
        );
      default:
        return <DesktopHome setView={setView} openWikiPage={openWikiPage} openBibleRef={openBibleRef} />;
    }
  };

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <div className="h-screen h-[100dvh] w-screen">
        <Suspense fallback={<ViewLoading />}>
          <Onboarding onComplete={handleOnboardingComplete} />
        </Suspense>
      </div>
    );
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
              <Suspense fallback={<ViewLoading />}>{renderDesktopView()}</Suspense>
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
            <Suspense fallback={<ViewLoading />}>{renderMobileView()}</Suspense>
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
