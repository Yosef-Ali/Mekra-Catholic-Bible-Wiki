import React, { useMemo } from 'react';
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
import { ChevronRight } from 'lucide-react-native';
import { fetchTeachings, WikiPage } from '../../src/services/api';
import { useApi } from '../../src/hooks/useApi';
import { Rubric, ScreenHeader, screenBase } from '../../src/components/Primitives';
import { colors, fonts, layout } from '../../src/theme/colors';

/** Compendium parts — derive counts from live data */
const PARTS_META = [
  { num: 'I', label: 'Profession of Faith', am: 'የእምነት ምስክርነት', qRange: [1, 217] },
  { num: 'II', label: 'Sacraments', am: 'ምሥጢራት', qRange: [218, 356] },
  { num: 'III', label: 'Life in Christ', am: 'ሕይወት በክርስቶስ', qRange: [357, 533] },
  { num: 'IV', label: 'Prayer', am: 'ጸሎት', qRange: [534, 598] },
];

function getPartNum(q: string | null): string | null {
  if (!q) return null;
  const first = parseInt(q, 10);
  if (isNaN(first)) return null;
  for (const p of PARTS_META) {
    if (first >= p.qRange[0] && first <= p.qRange[1]) return p.num;
  }
  return null;
}

const scrollContent = { paddingBottom: layout.scrollBottomPadding };

export default function TeachingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: teachings, loading } = useApi<WikiPage[]>(fetchTeachings);

  // Compute part counts from live data
  const partCounts = useMemo(() => {
    const counts: Record<string, number> = { I: 0, II: 0, III: 0, IV: 0 };
    (teachings ?? []).forEach((t) => {
      const part = getPartNum(t.compendium_q);
      if (part && counts[part] !== undefined) counts[part]++;
    });
    return counts;
  }, [teachings]);

  const openArticle = (slug: string) => {
    router.push({ pathname: '/article/[slug]', params: { slug, type: 'teaching' } });
  };

  return (
    <ScrollView
      style={[screenBase.container, { paddingTop: insets.top }]}
      contentContainerStyle={scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Teaching"
        titleAm="ትምህርት"
        subtitle={loading ? 'Loading...' : `${teachings?.length ?? 0} articles · Catholic Teaching Wiki`}
      />

      {/* Parts */}
      <View style={styles.partsSection}>
        <Rubric>Compendium Parts</Rubric>
        {PARTS_META.map((p) => (
          <TouchableOpacity key={p.num} style={styles.partRow} activeOpacity={0.7}>
            <View style={styles.partNum}>
              <Text style={styles.partNumText}>{p.num}</Text>
            </View>
            <View style={screenBase.flex1}>
              <Text style={styles.partLabel}>{p.label}</Text>
              <Text style={styles.partAm}>{p.am}</Text>
            </View>
            <Text style={styles.partCount}>{partCounts[p.num]}</Text>
            <ChevronRight size={14} color={colors.inkSoft} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Teaching list */}
      <View style={styles.listSection}>
        <Rubric>All Teachings</Rubric>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.oxblood} size="small" />
            <Text style={styles.loadingText}>Fetching teachings...</Text>
          </View>
        ) : (
          (teachings ?? []).map((t) => (
            <TouchableOpacity
              key={t.slug}
              style={styles.teachingRow}
              activeOpacity={0.7}
              onPress={() => openArticle(t.slug)}
            >
              <View style={screenBase.flex1}>
                <Text style={styles.teachingAm}>
                  {t.title_am ?? t.title_en ?? t.slug}
                </Text>
                {t.title_en && (
                  <Text style={styles.teachingEn}>{t.title_en}</Text>
                )}
              </View>
              {t.compendium_q && (
                <Text style={styles.teachingQ}>Q {t.compendium_q}</Text>
              )}
              <ChevronRight size={14} color={colors.inkSoft} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  partsSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  partNum: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partNumText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.oxblood,
  },
  partLabel: {
    fontFamily: fonts.garamond,
    fontSize: 16,
    color: colors.ink,
  },
  partAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 13,
    color: colors.inkMid,
    marginTop: 1,
  },
  partCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
  },
  listSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
  },
  teachingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  teachingAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 17,
    color: colors.ink,
  },
  teachingEn: {
    fontFamily: fonts.garamond,
    fontSize: 14,
    color: colors.inkMid,
    marginTop: 1,
  },
  teachingQ: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
  },
});
