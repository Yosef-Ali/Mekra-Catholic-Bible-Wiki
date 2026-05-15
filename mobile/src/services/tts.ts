/**
 * TTS service for React Native
 *
 * Two modes:
 *  1. readArticle(slug) — sends slug to /api/ai/read, server extracts readable
 *     content and returns a single audio file (Gemini or Google Translate).
 *  2. speakText(text) — sends raw text to /api/ai/tts for ad-hoc playback.
 *
 * Reads user settings (provider, API key) from AsyncStorage via settings service.
 * Plays audio via expo-av Audio.Sound.
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSettings } from './settings';

// ── Resolve API base (mirrors api.ts) ──

function getDevHost(): string {
  if (Platform.OS === 'web') return 'localhost';
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }
  return '192.168.1.3';
}

const DEV_HOST = getDevHost();
const API_BASE = __DEV__
  ? `http://${DEV_HOST}:5173/api`
  : 'https://mekra.app/api';

// ── State ──

let currentSound: Audio.Sound | null = null;
let _playbackRate = 1.0;
let _aborted = false;

// ── Public API ──

export function setPlaybackRate(rate: number) {
  _playbackRate = rate;
  currentSound?.setRateAsync(rate, true).catch(() => {});
}

export async function stopTTS() {
  _aborted = true;
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {}
    currentSound = null;
  }
}

export async function pauseTTS() {
  if (currentSound) {
    try { await currentSound.pauseAsync(); } catch {}
  }
}

export async function resumeTTS() {
  if (currentSound) {
    try { await currentSound.playAsync(); } catch {}
  }
}

export function isAborted() {
  return _aborted;
}

/** Build the extra fields to send with TTS requests based on user settings */
async function getTTSParams(): Promise<{ apiKey?: string; provider?: string }> {
  const s = await getSettings();
  const params: { apiKey?: string; provider?: string } = {};
  if (s.ttsProvider !== 'auto') params.provider = s.ttsProvider;
  if (s.geminiApiKey) params.apiKey = s.geminiApiKey;
  // Apply saved playback rate
  if (s.playbackRate !== _playbackRate) {
    _playbackRate = s.playbackRate;
  }
  return params;
}

/**
 * Read a full wiki article by slug.
 * Server-side: fetches article → extracts readable content → generates audio.
 * Returns a single audio stream (WAV from Gemini, or MP3 fallback).
 */
export async function readArticle(
  slug: string,
  type?: string,
  voice?: string,
  onLoaded?: () => void,
): Promise<void> {
  _aborted = false;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
  });

  const ttsParams = await getTTSParams();

  const res = await fetch(`${API_BASE}/ai/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, type, voice, ...ttsParams }),
  });

  if (_aborted) throw new DOMException('Aborted', 'AbortError');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `TTS ${res.status}`);
  }

  const blob = await res.blob();
  if (blob.size === 0) throw new Error('Server returned empty audio');
  if (_aborted) throw new DOMException('Aborted', 'AbortError');

  const base64 = await blobToBase64(blob);
  if (_aborted) throw new DOMException('Aborted', 'AbortError');

  const { sound } = await Audio.Sound.createAsync(
    { uri: base64 },
    { shouldPlay: true, rate: _playbackRate, shouldCorrectPitch: true },
  );
  currentSound = sound;
  onLoaded?.();

  return new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if ('error' in status) reject(new Error(String(status.error)));
        return;
      }
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
        resolve();
      }
    });
  });
}

/**
 * Speak a short text snippet via /api/ai/tts.
 * Good for verse readings, single paragraphs, etc.
 */
export async function speakText(text: string): Promise<void> {
  const clean = text.replace(/\[\d+\]\s*/g, '').trim();
  if (!clean) return;

  _aborted = false;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const ttsParams = await getTTSParams();

  const res = await fetch(`${API_BASE}/ai/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean, lang: 'am', ...ttsParams }),
  });

  if (_aborted) throw new DOMException('Aborted', 'AbortError');
  if (!res.ok) throw new Error(`TTS ${res.status}`);

  const blob = await res.blob();
  if (blob.size === 0) throw new Error('TTS returned empty audio');

  const base64 = await blobToBase64(blob);
  if (_aborted) throw new DOMException('Aborted', 'AbortError');

  const { sound } = await Audio.Sound.createAsync(
    { uri: base64 },
    { shouldPlay: true, rate: _playbackRate, shouldCorrectPitch: true },
  );
  currentSound = sound;

  return new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if ('error' in status) reject(new Error(String(status.error)));
        return;
      }
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
        resolve();
      }
    });
  });
}

// ── Helpers ──

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read blob'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
