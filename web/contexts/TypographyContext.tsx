import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface TypographySettings {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  paragraphSpacing: number;
}

const DEFAULT_SETTINGS: TypographySettings = {
  fontSize: 20,       // Slightly larger for Amharic readability
  lineHeight: 2.0,    // More generous for complex Amharic characters
  letterSpacing: 0,
  wordSpacing: 0,     // Natural word spacing (browser default) - prevents rivers
  paragraphSpacing: 20,
};

interface TypographyContextType {
  settings: TypographySettings;
  updateSettings: (settings: Partial<TypographySettings>) => void;
  resetSettings: () => void;
}

const TypographyContext = createContext<TypographyContextType | undefined>(undefined);

const STORAGE_KEY = 'amharic-bible-typography';

export function TypographyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TypographySettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load typography settings:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save typography settings:', error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<TypographySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <TypographyContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const context = useContext(TypographyContext);
  if (!context) {
    throw new Error('useTypography must be used within TypographyProvider');
  }
  return context;
}
