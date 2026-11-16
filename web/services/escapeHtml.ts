/**
 * Escape text for insertion into HTML.
 *
 * Use this before building markup that will be passed to
 * dangerouslySetInnerHTML: chat messages and model output are untrusted, and
 * an unescaped `<img onerror=…>` in either would run as script in the page.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
