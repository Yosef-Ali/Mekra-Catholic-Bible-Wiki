/**
 * User settings — persisted via AsyncStorage.
 *
 * Stores:
 *  - ttsProvider: 'auto' | 'gemini' | 'translate'
 *  - geminiApiKey: optional user-provided key for Gemini TTS
 *  - playbackRate: 0.5 – 2.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ttsProvider: '@mekra/tts-provider',
  geminiApiKey: '@mekra/gemini-api-key',
  playbackRate: '@mekra/playback-rate',
} as const;

export type TTSProvider = 'auto' | 'gemini' | 'translate';

export interface AppSettings {
  ttsProvider: TTSProvider;
  geminiApiKey: string;
  playbackRate: number;
}

const DEFAULTS: AppSettings = {
  ttsProvider: 'auto',
  geminiApiKey: '',
  playbackRate: 1.0,
};

let _cache: AppSettings | null = null;

/** Load all settings (cached after first call) */
export async function getSettings(): Promise<AppSettings> {
  if (_cache) return _cache;
  try {
    const [provider, key, rate] = await AsyncStorage.multiGet([
      KEYS.ttsProvider,
      KEYS.geminiApiKey,
      KEYS.playbackRate,
    ]);
    _cache = {
      ttsProvider: (provider[1] as TTSProvider) || DEFAULTS.ttsProvider,
      geminiApiKey: key[1] || DEFAULTS.geminiApiKey,
      playbackRate: rate[1] ? parseFloat(rate[1]) : DEFAULTS.playbackRate,
    };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

/** Update one or more settings */
export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };

  const pairs: [string, string][] = [];
  if ('ttsProvider' in partial) pairs.push([KEYS.ttsProvider, updated.ttsProvider]);
  if ('geminiApiKey' in partial) pairs.push([KEYS.geminiApiKey, updated.geminiApiKey]);
  if ('playbackRate' in partial) pairs.push([KEYS.playbackRate, String(updated.playbackRate)]);

  if (pairs.length > 0) {
    await AsyncStorage.multiSet(pairs);
  }
  _cache = updated;
  return updated;
}

/** Clear cache (call when you want a fresh read from storage) */
export function invalidateCache() {
  _cache = null;
}
