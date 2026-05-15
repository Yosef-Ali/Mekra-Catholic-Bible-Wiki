import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Eye, EyeOff } from 'lucide-react-native';
import { getSettings, updateSettings, TTSProvider, AppSettings } from '../src/services/settings';
import { setPlaybackRate } from '../src/services/tts';
import { Rubric, screenBase } from '../src/components/Primitives';
import { colors, fonts } from '../src/theme/colors';

const TTS_OPTIONS: { value: TTSProvider; label: string; desc: string }[] = [
  { value: 'auto', label: 'Auto', desc: 'Gemini if key provided, otherwise Google Translate' },
  { value: 'gemini', label: 'Gemini Flash', desc: 'Natural voice, requires API key' },
  { value: 'translate', label: 'Google Translate', desc: 'No key needed, robotic voice' },
];

const RATE_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setApiKey(s.geminiApiKey);
    });
  }, []);

  const saveSetting = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = await updateSettings(partial);
    setSettings(updated);
    if (partial.playbackRate !== undefined) {
      setPlaybackRate(partial.playbackRate);
    }
  }, []);

  const saveApiKey = useCallback(async () => {
    const trimmed = apiKey.trim();
    await updateSettings({ geminiApiKey: trimmed });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKey]);

  const clearApiKey = useCallback(async () => {
    Alert.alert('Clear API Key?', 'Gemini TTS will stop working until you add a new key.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setApiKey('');
          await updateSettings({ geminiApiKey: '' });
        },
      },
    ]);
  }, []);

  if (!settings) return null;

  return (
    <View style={[screenBase.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ChevronLeft size={22} strokeWidth={1.6} color={colors.inkSoft} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* ── TTS Provider ── */}
        <View style={s.section}>
          <Rubric>Text-to-Speech</Rubric>
          <Text style={s.sectionDesc}>
            Choose how articles are read aloud
          </Text>
          <View style={s.optionGroup}>
            {TTS_OPTIONS.map((opt) => {
              const active = settings.ttsProvider === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.optionRow, active && s.optionRowActive]}
                  onPress={() => saveSetting({ ttsProvider: opt.value })}
                  activeOpacity={0.7}
                >
                  <View style={s.optionLeft}>
                    <Text style={[s.optionLabel, active && s.optionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={s.optionDesc}>{opt.desc}</Text>
                  </View>
                  {active && <Check size={18} color={colors.oxblood} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Gemini API Key ── */}
        <View style={s.section}>
          <Rubric>Gemini API Key</Rubric>
          <Text style={s.sectionDesc}>
            Get a free key from Google AI Studio to enable natural Gemini voice
          </Text>

          <View style={s.keyRow}>
            <TextInput
              style={s.keyInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="AIzaSy..."
              placeholderTextColor={colors.inkSoft}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <TouchableOpacity onPress={() => setShowKey(!showKey)} style={s.eyeBtn}>
              {showKey ? (
                <EyeOff size={18} color={colors.inkSoft} />
              ) : (
                <Eye size={18} color={colors.inkSoft} />
              )}
            </TouchableOpacity>
          </View>

          <View style={s.keyActions}>
            <TouchableOpacity
              style={[s.saveBtn, saved && s.saveBtnDone]}
              onPress={saveApiKey}
              activeOpacity={0.7}
            >
              <Text style={[s.saveBtnText, saved && s.saveBtnTextDone]}>
                {saved ? '✓ Saved' : 'Save Key'}
              </Text>
            </TouchableOpacity>
            {settings.geminiApiKey.length > 0 && (
              <TouchableOpacity onPress={clearApiKey} activeOpacity={0.7}>
                <Text style={s.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.hint}>
            Free tier: 1,500 requests/day. Get yours at aistudio.google.com/apikey
          </Text>
        </View>

        {/* ── Playback Speed ── */}
        <View style={s.section}>
          <Rubric>Playback Speed</Rubric>
          <View style={s.rateRow}>
            {RATE_OPTIONS.map((rate) => {
              const active = settings.playbackRate === rate;
              return (
                <TouchableOpacity
                  key={rate}
                  style={[s.rateChip, active && s.rateChipActive]}
                  onPress={() => saveSetting({ playbackRate: rate })}
                  activeOpacity={0.7}
                >
                  <Text style={[s.rateText, active && s.rateTextActive]}>
                    {rate === 1.0 ? '1×' : `${rate}×`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  backText: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.inkSoft,
  },
  headerTitle: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 18,
    color: colors.ink,
  },
  scroll: {
    padding: 24,
    paddingBottom: 60,
  },
  section: {
    marginBottom: 32,
  },
  sectionDesc: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },

  // TTS options
  optionGroup: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    backgroundColor: colors.parchment,
  },
  optionRowActive: {
    borderColor: colors.oxblood,
    backgroundColor: colors.cream,
  },
  optionLeft: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: colors.ink,
  },
  optionLabelActive: {
    color: colors.oxblood,
  },
  optionDesc: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // API key
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    backgroundColor: colors.parchment,
    overflow: 'hidden',
  },
  keyInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.oxblood,
    borderRadius: 4,
  },
  saveBtnDone: {
    backgroundColor: colors.teal,
  },
  saveBtnText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.parchment,
  },
  saveBtnTextDone: {
    color: colors.parchment,
  },
  clearText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.oxblood,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 10,
    letterSpacing: 0.3,
  },

  // Rate
  rateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 20,
    backgroundColor: colors.parchment,
  },
  rateChipActive: {
    borderColor: colors.oxblood,
    backgroundColor: colors.oxblood,
  },
  rateText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
  },
  rateTextActive: {
    color: colors.parchment,
  },
});
