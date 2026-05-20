import React from 'react';
import { cn } from './cn';
import type { UiTone } from './IconButton';

type SegmentedSize = 'sm' | 'md' | 'lg';

const containerTone: Record<UiTone, string> = {
  sepia: 'bg-parchment-dark border-rule',
  dark: 'bg-parchment-dark border-rule',
  light: 'bg-parchment-dark border-rule',
};

const activeTone: Record<UiTone, string> = {
  sepia: 'bg-parchment text-ink shadow-sm',
  dark: 'bg-parchment text-ink shadow-sm',
  light: 'bg-parchment text-ink shadow-sm',
};

const inactiveTone: Record<UiTone, string> = {
  sepia: 'text-ink-soft hover:text-ink',
  dark: 'text-ink-soft hover:text-ink',
  light: 'text-ink-soft hover:text-ink',
};

const sizeContainer: Record<SegmentedSize, string> = {
  sm: 'p-1 rounded-xl',
  md: 'p-1.5 rounded-2xl',
  lg: 'p-1.5 rounded-[20px]',
};

const sizeButton: Record<SegmentedSize, string> = {
  sm: 'h-9 rounded-lg text-sm',
  md: 'h-10 rounded-xl text-sm',
  lg: 'h-11 rounded-2xl text-base',
};

const focusRingOffset: Record<UiTone, string> = {
  sepia: 'focus-visible:ring-offset-parchment-dark',
  dark: 'focus-visible:ring-offset-parchment-dark',
  light: 'focus-visible:ring-offset-parchment-dark',
};

export function SegmentedTabs<T extends string>({
  tone = 'sepia',
  size = 'md',
  value,
  onValueChange,
  options,
  className,
  ariaLabel,
}: {
  tone?: UiTone;
  size?: SegmentedSize;
  value: T;
  onValueChange: (next: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel || 'Tabs'}
      className={cn('grid grid-cols-2 gap-1 border', containerTone[tone], sizeContainer[size], className)}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-3 font-semibold transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/60 focus-visible:ring-offset-2',
              focusRingOffset[tone],
              'active:scale-[0.99]',
              sizeButton[size],
              isActive ? activeTone[tone] : inactiveTone[tone]
            )}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
