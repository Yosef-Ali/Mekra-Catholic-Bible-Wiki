import React from 'react';

/**
 * Manuscript Modern — shared design primitives
 * Ethiopian cross, ornament divider, rubricated text, metadata row
 */

/** Subtle Ethiopian cross ornament */
export const CrossMark: React.FC<{ size?: number; color?: string; className?: string }> = ({
  size = 14,
  color = '#7A2522',
  className,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth="1.4"
    className={className}
  >
    <path d="M12 3v18M3 12h18" />
    <path d="M8 8l-2-2M16 8l2-2M8 16l-2 2M16 16l2 2" strokeLinecap="round" />
  </svg>
);

/** Ochre diamond ornament / section divider */
export const Ornament: React.FC<{ w?: number; color?: string }> = ({
  w = 80,
  color = '#B68530',
}) => (
  <svg viewBox="0 0 80 8" width={w} height="8" fill="none" stroke={color} strokeWidth="0.8">
    <path d="M0 4h30" />
    <circle cx="34" cy="4" r="1.5" fill={color} stroke="none" />
    <path d="M38 4 l2 -3 l2 3 l-2 3 z" fill={color} stroke="none" />
    <circle cx="46" cy="4" r="1.5" fill={color} stroke="none" />
    <path d="M50 4h30" />
  </svg>
);

/** Rubricated small-caps text (oxblood) */
export const Rubric: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span
    className={`text-oxblood tracking-wider font-medium ${className}`}
    style={{ fontVariant: 'small-caps' }}
  >
    {children}
  </span>
);

/** Metadata key/value row in monospace */
export const Meta: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex gap-3 font-mono text-[11px] leading-relaxed">
    <span className="text-ink-soft uppercase tracking-widest min-w-[92px]">{k}</span>
    <span className="text-ink-mid">{v}</span>
  </div>
);

/** Section label — uppercase monospace rubric */
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-oxblood mb-2.5">
    <Rubric>{children}</Rubric>
  </div>
);

/** Section heading — Garamond + Ethiopic subtitle */
export const SectionHeading: React.FC<{
  children: React.ReactNode;
  am?: string;
  count?: string;
}> = ({ children, am, count }) => (
  <div className="flex items-baseline justify-between mb-3">
    <h2 className="font-garamond text-[22px] font-medium m-0">
      {children}
      {am && (
        <span className="font-ethiopic text-ink-mid ml-2">· {am}</span>
      )}
    </h2>
    {count && (
      <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
        {count}
      </div>
    )}
  </div>
);
