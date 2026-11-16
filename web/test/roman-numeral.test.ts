import { describe, it, expect } from 'vitest';
import { romanYear } from '../services/romanNumeral';

describe('romanYear', () => {
  it('renders the years the masthead will show', () => {
    expect(romanYear(2026)).toBe('ⅯⅯⅩⅩⅤⅠ');
    expect(romanYear(2027)).toBe('ⅯⅯⅩⅩⅤⅠⅠ');
    expect(romanYear(2029)).toBe('ⅯⅯⅩⅩⅠⅩ');
    expect(romanYear(2040)).toBe('ⅯⅯⅩⅬ');
  });

  it('handles subtractive forms', () => {
    expect(romanYear(1994)).toBe('ⅯⅭⅯⅩⅭⅠⅤ');
    expect(romanYear(444)).toBe('ⅭⅮⅩⅬⅠⅤ');
  });

  it('falls back to digits outside the representable range', () => {
    expect(romanYear(0)).toBe('0');
    expect(romanYear(4000)).toBe('4000');
  });
});
