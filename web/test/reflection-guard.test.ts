import { describe, it, expect } from 'vitest';
import { quotesSpeech } from '../services/reflectionGuard';

describe('quotesSpeech — the reflection may not put words in Scripture\'s mouth', () => {
  it('flags quoted Amharic speech, whichever quotation marks are used', () => {
    // What the model actually produced for Luke 18:41 — its own wording, in quotes.
    expect(quotesSpeech('ክርስቶስ "ምን ላድርግልህ ትወዳለህ?" ብሎ ሲጠይቀው')).toBe(true);
    expect(quotesSpeech('ክርስቶስ “ምን ላድርግልህ ትወዳለህ?” ብሎ ሲጠይቀው')).toBe(true);
    expect(quotesSpeech('ክርስቶስ «ምን ላድርግልህ ትወዳለህ?» ብሎ ሲጠይቀው')).toBe(true);
    expect(quotesSpeech('እርሱም ‘ጌታ ሆይ ማረኝ’ አለ')).toBe(true);
  });

  it('allows a single quoted term — naming a word is not quoting a passage', () => {
    expect(quotesSpeech('ይህ “መሢሕ” የሚለው ስም')).toBe(false);
    expect(quotesSpeech('የኢጎ "Ego" ድምፅ')).toBe(false);
  });

  it('allows citations, parentheses and plain prose', () => {
    expect(quotesSpeech('በሉቃስ 18:35-43 ላይ የምናገኘው ዕውር ሰው (Luke 18:35-43) የነፍስ ምሳሌ ነው።')).toBe(false);
    expect(quotesSpeech('በዝምታና በምልከታ (Contemplation) የሚገነባ ነው።')).toBe(false);
    expect(quotesSpeech('')).toBe(false);
    expect(quotesSpeech(null)).toBe(false);
  });
});
