import React from 'react';
import { useTypography } from '../contexts/TypographyContext';

export default function TypographyEditor() {
  const { settings, updateSettings, resetSettings } = useTypography();

  return (
    <div className="space-y-6 p-4 text-ink">
      {/* Font Size */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink">Font Size</label>
          <span className="text-sm text-ink-soft font-mono">{settings.fontSize}px</span>
        </div>
        <input
          type="range"
          value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
          min={12}
          max={32}
          step={1}
          className="w-full accent-[#7A2522]"
        />
      </div>

      {/* Line Height */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink">Line Height</label>
          <span className="text-sm text-ink-soft font-mono">{settings.lineHeight.toFixed(1)}</span>
        </div>
        <input
          type="range"
          value={settings.lineHeight}
          onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })}
          min={1.2}
          max={3.0}
          step={0.1}
          className="w-full accent-[#7A2522]"
        />
      </div>

      {/* Letter Spacing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink">Letter Spacing</label>
          <span className="text-sm text-ink-soft font-mono">{settings.letterSpacing}px</span>
        </div>
        <input
          type="range"
          value={settings.letterSpacing}
          onChange={(e) => updateSettings({ letterSpacing: Number(e.target.value) })}
          min={-2}
          max={4}
          step={0.5}
          className="w-full accent-[#7A2522]"
        />
      </div>

      {/* Word Spacing - Removed: Natural spacing now used for better typography */}

      {/* Paragraph Spacing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink">Paragraph Spacing</label>
          <span className="text-sm text-ink-soft font-mono">{settings.paragraphSpacing}px</span>
        </div>
        <input
          type="range"
          value={settings.paragraphSpacing}
          onChange={(e) => updateSettings({ paragraphSpacing: Number(e.target.value) })}
          min={0}
          max={40}
          step={2}
          className="w-full accent-[#7A2522]"
        />
      </div>

      {/* Reset Button */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
        <button
          onClick={resetSettings}
          className="w-full py-2.5 px-4 rounded-xl hover:bg-rule/30 transition-colors font-semibold text-ink"
          style={{ border: '1px solid var(--rule)' }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
