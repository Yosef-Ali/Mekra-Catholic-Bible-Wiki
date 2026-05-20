import React from 'react';
import { cn } from './cn';

export type UiTone = 'sepia' | 'dark' | 'light';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const toneClasses: Record<UiTone, string> = {
  sepia:
    'border-rule bg-parchment-dark/80 text-ink-soft hover:bg-rule/40 focus-visible:ring-oxblood/60 focus-visible:ring-offset-parchment',
  dark:
    'border-rule bg-parchment-dark/80 text-ink-soft hover:bg-rule/40 focus-visible:ring-oxblood/60 focus-visible:ring-offset-parchment',
  light:
    'border-rule bg-parchment text-ink-mid hover:bg-rule/30 focus-visible:ring-oxblood/40 focus-visible:ring-offset-parchment',
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
};

export function IconButton({
  tone = 'sepia',
  size = 'md',
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: UiTone;
  size?: IconButtonSize;
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-full border transition-all duration-200',
        'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        sizeClasses[size],
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

