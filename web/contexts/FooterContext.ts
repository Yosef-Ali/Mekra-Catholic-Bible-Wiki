import { createContext, useContext } from 'react';

/**
 * Footer (bottom navigation) visibility, shared between the app shell and
 * the mobile views that hide it while scrolling.
 *
 * Lives in its own module rather than App.tsx so the lazily-loaded view
 * chunks do not have to import the app shell back to reach it.
 */
export const FooterContext = createContext<{
  hideFooter: boolean;
  setHideFooter: (hide: boolean) => void;
}>({ hideFooter: false, setHideFooter: () => {} });

export const useFooter = () => useContext(FooterContext);
