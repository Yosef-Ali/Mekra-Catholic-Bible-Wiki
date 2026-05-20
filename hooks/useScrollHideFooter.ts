import { useEffect, useRef } from 'react';

export const useScrollHideFooter = (
  setHideFooter: (hide: boolean) => void,
  scrollRef: React.RefObject<HTMLElement | null>
) => {
  const lastScrollY = useRef(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      
      // Simple toggle: DOWN = hide, UP = show
      if (currentScrollY > lastScrollY.current) {
        // Scrolling DOWN - hide footer
        setHideFooter(true);
      } else {
        // Scrolling UP - show footer
        setHideFooter(false);
      }
      
      lastScrollY.current = currentScrollY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      setHideFooter(false);
    };
  }, [setHideFooter, scrollRef]);
};
