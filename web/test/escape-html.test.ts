import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../services/escapeHtml';

describe('escapeHtml', () => {
  it('neutralises markup in untrusted chat text', () => {
    const out = escapeHtml('<img src=x onerror="alert(1)">');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('leaves Amharic text and the markdown markers the chat formatter needs', () => {
    const text = '**ቁርባን** (ዮሐንስ 6:51) [3] *ምስጢር*';
    expect(escapeHtml(text)).toBe(text);
  });
});
