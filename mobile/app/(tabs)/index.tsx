import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Settings } from 'lucide-react-native';
import { fetchTeachings, fetchComparatives, fetchDailyReadings, WikiPage, DailyReadingsData, DailyReading } from '../../src/services/api';
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
  const { data: comparatives } = useApi<WikiPage[]>(fetchComparatives);
  const { data: daily } = useApi<DailyReadingsData | null>(fetchDailyReadings);
  const [rite, setRite] = useState<'roman' | 'geez'>('roman');

  // Show first 6 teachings as featured cards
  const featured = useMemo(() => (teachings ?? []).slice(0, 6), [teachings]);
  const comparativeList = useMemo(() => comparatives ?? [], [comparatives]);

  const openArticle = (slug: string) => {
    router.push({ pathname: '/article/[slug]', params: { slug, type: 'teaching' } });
  };

  const openComparative = (slug: string) => {
    router.push({ pathname: '/article/[slug]', params: { slug, type: 'comparative' } });
  };

  const openReading = (r: DailyReading) => {
    if (!r.book || !r.chapter) return;
    router.push({
      pathname: '/bible',
      params: { book: r.book, chapter: String(r.chapter), ...(r.verses ? { verses: r.verses } : {}) },
    });
  };
  const activeRite = daily ? daily[rite] : null;

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

      {/* Greeting — Amharic-first */}
      <View style={styles.greeting}>
        <Rubric>{'Eastertide · ' + weekday}</Rubric>
        <Text style={styles.greetingTitleAm}>{'ሰላም ለአንተ ይሁን።'}</Text>
        <Text style={styles.greetingEn}>
          {greeting}, <Text style={styles.greetingName}>Friend</Text>.
        </Text>
      </View>

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

      {/* Daily Mass readings — both rites */}
      {daily && (
        <View style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <Text style={styles.dailyTitle}>የዕለቱ ንባባት</Text>
            <View style={styles.riteToggle}>
              {(['roman', 'geez'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRite(r)}
                  style={[styles.riteBtn, rite === r && styles.riteBtnActive]}
                >
                  <Text style={[styles.riteBtnText, rite === r && styles.riteBtnTextActive]}>
                    {r === 'roman' ? 'ላቲን' : 'ግዕዝ'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {rite === 'roman' ? (
            <Text style={styles.dailyContext}>
              {activeRite?.liturgical?.celebration?.nameAm ?? activeRite?.liturgical?.dayName ?? ''}
            </Text>
          ) : (
            <Text style={styles.dailyContext}>
              {[activeRite?.liturgical?.ethDateAm, activeRite?.liturgical?.fasting].filter(Boolean).join(' · ')}
            </Text>
          )}
          {activeRite?.readings ? (
            <>
              {activeRite.readings.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.dailyRow}
                  onPress={() => openReading(r)}
                  disabled={!r.book}
                >
                  <Text style={styles.dailyRowLabel}>{r.labelAm}</Text>
                  <Text style={[styles.dailyRowCitation, r.book && styles.dailyRowLink]}>{r.citation}</Text>
                </TouchableOpacity>
              ))}
              {activeRite.verified === false && (
                <Text style={styles.dailyUnverified}>ያልተረጋገጠ · unverified</Text>
              )}
            </>
          ) : (
            <Text style={styles.dailyEmpty}>ንባባት ገና አልገቡም።</Text>
          )}
        </View>
      )}

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
                {featured[0].title_am ?? featured[0].title_en ?? featured[0].slug}
              </Text>
              <Text style={styles.continueSub}>
                {featured[0].title_en ?? ''}
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
          {'ትምህርት'}{' '}
          <Text style={styles.teachingTitleEn}>· Teaching</Text>
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
                {t.title_am ?? t.title_en ?? t.slug}
              </Text>
              <Text style={styles.teachingAm} numberOfLines={1}>
                {t.title_en ?? ''}
              </Text>
              {t.sources && (
                <Text style={styles.teachingQ}>{t.sources} sources</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Comparisons — dedicated, opt-in section. Kept separate from the main
          teaching so Catholic doctrine is never diluted by other traditions. */}
      {comparativeList.length > 0 && (
        <View style={styles.cmpSection}>
          <View style={styles.cmpHeader}>
            <Text style={styles.cmpTitle}>
              {'ልዩነትና አንድነት'}{' '}
              <Text style={styles.cmpTitleEn}>· Comparisons</Text>
            </Text>
            <Text style={styles.cmpCount}>{comparativeList.length} pages</Text>
          </View>
          <Text style={styles.cmpNote}>
            የካቶሊክ ቤተክርስቲያን ትምህርት ከኢትዮጵያ ኦርቶዶክስ ተዋሕዶ፣ ከምሥራቅ ኦርቶዶክስና ከፕሮቴስታንት አብያተ ክርስቲያናት ትምህርት ጋር ያለውን ልዩነትና አንድነት የሚያሳዩ ገጾች።
          </Text>
          <Text style={styles.cmpNoteEn}>
            A separate reference layer — the main teaching above remains purely Catholic.
          </Text>
          {comparativeList.map((c) => (
            <TouchableOpacity
              key={c.slug}
              style={styles.cmpRow}
              activeOpacity={0.7}
              onPress={() => openComparative(c.slug)}
            >
              <View style={styles.cmpAccent} />
              <View style={screenBase.flex1}>
                <Text style={styles.cmpRowAm} numberOfLines={1}>
                  {c.title_am ?? c.title_en ?? c.slug}
                </Text>
                {c.title_en && (
                  <Text style={styles.cmpRowEn} numberOfLines={1}>{c.title_en}</Text>
                )}
              </View>
              <ChevronRight size={14} color={colors.inkSoft} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <OrnamentDivider w={140} py={16} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  greetingTitleAm: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 30,
    lineHeight: 40,
    color: colors.ink,
    marginTop: 6,
  },
  greetingEn: {
    fontFamily: fonts.garamond,
    fontSize: 20,
    lineHeight: 26,
    color: colors.inkMid,
    marginTop: 2,
  },
  greetingName: {
    fontFamily: fonts.garamondItalic,
    color: colors.oxblood,
    fontStyle: 'italic',
  },
  verseCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  dailyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyTitle: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 15,
    color: colors.ink,
  },
  riteToggle: { flexDirection: 'row', gap: 6 },
  riteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
  },
  riteBtnActive: { backgroundColor: colors.oxblood, borderColor: colors.oxblood },
  riteBtnText: { fontFamily: fonts.ethiopic, fontSize: 11, color: colors.inkMid },
  riteBtnTextActive: { color: colors.parchment },
  dailyContext: {
    fontFamily: fonts.ethiopic,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 10,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingVertical: 4,
  },
  dailyRowLabel: {
    fontFamily: fonts.ethiopic,
    fontSize: 11,
    color: colors.inkSoft,
    width: 92,
  },
  dailyRowCitation: {
    fontFamily: fonts.garamond,
    fontSize: 14,
    color: colors.inkMid,
    flex: 1,
  },
  dailyRowLink: { color: colors.oxblood },
  dailyUnverified: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.ochre,
    marginTop: 8,
  },
  dailyEmpty: {
    fontFamily: fonts.ethiopic,
    fontSize: 12,
    color: colors.inkSoft,
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
    fontFamily: fonts.ethiopicMedium,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  continueSub: {
    fontFamily: fonts.garamondItalic,
    fontSize: 14,
    fontStyle: 'italic',
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
    fontFamily: fonts.ethiopicMedium,
    fontSize: 22,
    color: colors.ink,
  },
  teachingTitleEn: {
    fontFamily: fonts.garamond,
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
    fontFamily: fonts.ethiopicMedium,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
    marginTop: 6,
  },
  teachingAm: {
    fontFamily: fonts.garamondItalic,
    fontSize: 14,
    fontStyle: 'italic',
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

  // Comparisons section
  cmpSection: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  cmpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  cmpTitle: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 22,
    color: colors.ink,
  },
  cmpTitleEn: {
    fontFamily: fonts.garamond,
    fontSize: 18,
    color: colors.inkMid,
  },
  cmpCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cmpNote: {
    fontFamily: fonts.ethiopic,
    fontSize: 13,
    lineHeight: 21,
    color: colors.inkMid,
  },
  cmpNoteEn: {
    fontFamily: fonts.garamondItalic,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    color: colors.inkSoft,
    marginTop: 2,
    marginBottom: 6,
  },
  cmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  cmpAccent: {
    width: 3,
    height: 28,
    backgroundColor: colors.oxblood,
  },
  cmpRowAm: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 16,
    color: colors.ink,
  },
  cmpRowEn: {
    fontFamily: fonts.garamondItalic,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.inkMid,
    marginTop: 1,
  },
});
