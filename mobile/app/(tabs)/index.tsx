import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Settings } from 'lucide-react-native';
import Constants from 'expo-constants';
import { fetchTeachings, WikiPage } from '../../src/services/api';
import { useApi } from '../../src/hooks/useApi';
import { CrossMark, OrnamentDivider, Rubric, screenBase } from '../../src/components/Primitives';
import { colors, fonts, layout } from '../../src/theme/colors';

const ACCENT_COLORS = [colors.oxblood, colors.ochre, colors.teal, colors.oxblood, colors.ochre, colors.teal];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getWeekday() {
  return new Date().toLocaleDateString('en', { weekday: 'long' });
}

const scrollContent = { paddingBottom: layout.scrollBottomPadding };
const teachingScrollContent = { paddingLeft: 24, paddingRight: 12 };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const greeting = useMemo(() => getGreeting(), []);
  const weekday = useMemo(() => getWeekday(), []);

  const { data: teachings, loading, error } = useApi<WikiPage[]>(fetchTeachings);

  // Show first 6 teachings as featured cards
  const featured = useMemo(() => (teachings ?? []).slice(0, 6), [teachings]);

  // Debug: show API connection status
  const [debugInfo, setDebugInfo] = useState('');
  useEffect(() => {
    const hostUri = Constants.expoConfig?.hostUri ?? 'none';
    const devHost = Platform.OS === 'web' ? 'localhost' : (hostUri.split(':')[0] || '192.168.1.3');
    const apiBase = `http://${devHost}:5173/api`;
    const status = loading ? 'loading...' : error ? `ERROR: ${error}` : `OK (${teachings?.length ?? 0} items)`;
    setDebugInfo(`API: ${apiBase}\nStatus: ${status}\nhostUri: ${hostUri}`);
  }, [loading, error, teachings]);

  const openArticle = (slug: string) => {
    router.push({ pathname: '/article/[slug]', params: { slug, type: 'teaching' } });
  };

  return (
    <ScrollView
      style={[screenBase.container, { paddingTop: insets.top }]}
      contentContainerStyle={scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CrossMark size={16} />
          <Text style={styles.logoText}>Emmaus</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          hitSlop={12}
        >
          <Settings size={20} strokeWidth={1.6} color={colors.inkSoft} />
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greeting}>
        <Rubric>{'Eastertide · ' + weekday}</Rubric>
        <Text style={styles.greetingTitle}>
          {greeting},{'\n'}
          <Text style={styles.greetingName}>Friend</Text>.
        </Text>
        <Text style={styles.greetingAmharic}>{'ሰላም ለአንተ ይሁን።'}</Text>
      </View>

      {/* Debug banner — remove once data works */}
      {__DEV__ && (
        <View style={styles.debugBanner}>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      )}

      {/* Verse of the Day */}
      <View style={styles.verseCard}>
        <View style={styles.verseAccent} />
        <Text style={styles.verseLabel}>{'Verse of the day · ዮሐንስ 1:16'}</Text>
        <Text style={styles.verseText}>
          {'«ከእርሱ ሙላት ሁላችን ተቀበልነል፣ '}
          <Text style={styles.verseHighlight}>{'ጸጋ በጸጋ ላይ።»'}</Text>
        </Text>
        <Text style={styles.verseEnglish}>
          "From his fullness we have all received, grace upon grace."
        </Text>
      </View>

      {/* Continue Reading */}
      {featured.length > 0 && (
        <View style={styles.continueSection}>
          <View style={styles.continueHeader}>
            <Rubric>Continue</Rubric>
          </View>
          <TouchableOpacity
            style={styles.continueRow}
            activeOpacity={0.7}
            onPress={() => openArticle(featured[0].slug)}
          >
            <View style={styles.continueIcon}>
              <Text style={styles.continueIconText}>
                {featured[0].title_am?.charAt(0) ?? 'ት'}
              </Text>
            </View>
            <View style={screenBase.flex1}>
              <Text style={styles.continueTitle}>
                {featured[0].title_en ?? featured[0].slug}
              </Text>
              <Text style={styles.continueSub}>
                {featured[0].title_am ?? ''}
                {featured[0].compendium_q ? ` · Q ${featured[0].compendium_q}` : ''}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.inkSoft} />
          </TouchableOpacity>
        </View>
      )}

      {/* Teaching Section */}
      <View style={styles.teachingHeader}>
        <Text style={styles.teachingTitle}>
          Teaching{' '}
          <Text style={styles.teachingTitleAm}>{'· ትምህርት'}</Text>
        </Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/teaching')}>
          <Text style={styles.allLink}>
            {loading ? '...' : `All ${teachings?.length ?? 0} ›`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.oxblood} size="small" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={teachingScrollContent}
        >
          {featured.map((t, i) => (
            <TouchableOpacity
              key={t.slug}
              style={styles.teachingCard}
              activeOpacity={0.7}
              onPress={() => openArticle(t.slug)}
            >
              <View style={[styles.teachingAccent, { backgroundColor: ACCENT_COLORS[i % ACCENT_COLORS.length] }]} />
              {t.compendium_q && (
                <Text style={styles.teachingPart}>Q {t.compendium_q}</Text>
              )}
              <Text style={styles.teachingName} numberOfLines={2}>
                {t.title_en ?? t.slug}
              </Text>
              <Text style={styles.teachingAm} numberOfLines={1}>
                {t.title_am ?? ''}
              </Text>
              {t.sources && (
                <Text style={styles.teachingQ}>{t.sources} sources</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <OrnamentDivider w={140} py={16} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  debugBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFCC02',
    borderRadius: 6,
  },
  debugText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    color: '#333',
    lineHeight: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 19,
    color: colors.ink,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  greetingTitle: {
    fontFamily: fonts.garamond,
    fontSize: 32,
    lineHeight: 34,
    color: colors.ink,
    marginTop: 6,
  },
  greetingName: {
    fontFamily: fonts.garamondItalic,
    color: colors.oxblood,
    fontStyle: 'italic',
  },
  greetingAmharic: {
    fontFamily: fonts.ethiopic,
    fontSize: 17,
    color: colors.inkMid,
    marginTop: 4,
  },
  verseCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  verseAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: 28,
    backgroundColor: colors.oxblood,
  },
  verseLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 10,
  },
  verseText: {
    fontFamily: fonts.ethiopic,
    fontSize: 17,
    lineHeight: 26,
    color: colors.ink,
  },
  verseHighlight: {
    color: colors.oxblood,
  },
  verseEnglish: {
    fontFamily: fonts.garamondItalic,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMid,
    marginTop: 8,
    fontStyle: 'italic',
  },
  continueSection: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  continueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.rule,
  },
  continueIcon: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.vellumDark,
    borderLeftWidth: 3,
    borderLeftColor: colors.oxblood,
  },
  continueIconText: {
    fontFamily: fonts.ethiopic,
    fontSize: 26,
    color: colors.ink,
  },
  continueTitle: {
    fontFamily: fonts.garamond,
    fontSize: 19,
    lineHeight: 21,
    color: colors.ink,
  },
  continueSub: {
    fontFamily: fonts.ethiopic,
    fontSize: 14,
    color: colors.inkMid,
    marginTop: 2,
  },
  teachingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    paddingTop: 10,
    marginBottom: 12,
  },
  teachingTitle: {
    fontFamily: fonts.garamond,
    fontSize: 22,
    color: colors.ink,
  },
  teachingTitleAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 18,
    color: colors.inkMid,
  },
  allLink: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
  },
  loadingRow: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  teachingCard: {
    width: 168,
    padding: 16,
    paddingBottom: 14,
    marginRight: 12,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  teachingAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: 22,
  },
  teachingPart: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  teachingName: {
    fontFamily: fonts.garamond,
    fontSize: 20,
    lineHeight: 22,
    color: colors.ink,
    marginTop: 6,
  },
  teachingAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 15,
    color: colors.inkMid,
    marginTop: 2,
  },
  teachingQ: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    letterSpacing: 0.9,
    marginTop: 14,
  },
});
