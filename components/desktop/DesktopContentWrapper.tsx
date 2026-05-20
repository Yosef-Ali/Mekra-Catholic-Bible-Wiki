import React from 'react';

/**
 * Centers mobile-designed content within the desktop viewport.
 * Used for views that don't yet have a dedicated desktop layout
 * (Bookmarks, Settings, Content Editor).
 */
export const DesktopContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full flex justify-center overflow-y-auto" style={{ background: 'var(--cream)' }}>
    <div className="w-full max-w-[480px] min-h-full" style={{ background: 'var(--parchment)' }}>
      {children}
    </div>
  </div>
);
