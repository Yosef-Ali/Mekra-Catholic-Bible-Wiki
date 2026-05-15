import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search as SearchIcon } from 'lucide-react-native';
import { searchWiki, WikiPage } from '../../src/services/api';
import { SectionLabel, screenBase } from '../../src/components/Primitives';
import { colors, fonts, layout } from '../../src/theme/colors';

const scrollContent = { paddingBottom: layout.scrollBottomPadding };

/** Type badge color based on page_type */
function typeColor(type: string): string {
  switch (type) {
    case 'teaching': return colors.oxblood;
    case 'concept': return colors.teal;
    case 'figure': return colors.ochre;
    case 'apologetics': return '#6B4226';
    case 'liturgical': return '#5B4A8A';
    default: return colors.inkSoft;
  }
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikiPage[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — 300ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchWiki(query.trim());
      setResults(data);
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const openResult = (page: WikiPage) => {
    router.push({
      pathname: '/article/[slug]',
      params: { slug: page.slug, type: page.page_type },
    });
  };

  // First result as "top match"
  const topMatch = results.length > 0 ? results[0] : null;
  const otherResults = results.slice(1);

  return (
    <ScrollView
      style={[screenBase.container, { paddingTop: insets.top }]}
      contentContainerStyle={scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <SearchIcon size={15} color={colors.inkSoft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={styles.searchField}
              placeholder="Search teachings, concepts, saints..."
              placeholderTextColor={colors.inkSoft}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.cancelText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Loading */}
        {searching && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.oxblood} size="small" />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {/* Empty state */}
        {!searching && query.length > 0 && results.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No results for "{query}"</Text>
            <Text style={styles.emptyHint}>Try searching in Amharic or English</Text>
          </View>
        )}

        {/* No query hint */}
        {query.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyHint}>
              Search across all teachings, concepts, saints, prayers, and apologetics
            </Text>
          </View>
        )}

        {/* Top match */}
        {topMatch && !searching && (
          <>
            <SectionLabel>
              {'Top match · ' + (topMatch.title_am ?? topMatch.title_en ?? topMatch.slug)}
            </SectionLabel>
            <TouchableOpacity
              style={styles.topMatchCard}
              activeOpacity={0.7}
              onPress={() => openResult(topMatch)}
            >
              <View style={styles.topMatchTitle}>
                {topMatch.title_am && (
                  <Text style={styles.topMatchAm}>{topMatch.title_am}</Text>
                )}
                {topMatch.title_en && (
                  <Text style={styles.topMatchEn}>{topMatch.title_en}</Text>
                )}
              </View>
              <View style={styles.topMatchMeta}>
                <View style={[styles.typeBadge, { backgroundColor: typeColor(topMatch.page_type) }]}>
                  <Text style={styles.typeBadgeText}>{topMatch.page_type}</Text>
                </View>
                {topMatch.compendium_q && (
                  <Text style={styles.topMatchQ}>Q {topMatch.compendium_q}</Text>
                )}
              </View>
              {topMatch.preview && (
                <Text style={styles.topMatchDesc} numberOfLines={3}>
                  {topMatch.preview.replace(/^#[^\n]+\n/, '').replace(/\*\*[^*]+\*\*:[^\n]+\n/g, '').trim().slice(0, 200)}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Other results */}
        {otherResults.length > 0 && !searching && (
          <>
            <SectionLabel>Also matching ({otherResults.length})</SectionLabel>
            {otherResults.map((r) => (
              <TouchableOpacity
                key={r.slug + r.page_type}
                style={styles.resultRow}
                activeOpacity={0.7}
                onPress={() => openResult(r)}
              >
                <View style={styles.resultTop}>
                  <View style={[styles.typeDot, { backgroundColor: typeColor(r.page_type) }]} />
                  <Text style={styles.resultAm} numberOfLines={1}>
                    {r.title_am ?? r.title_en ?? r.slug}
                  </Text>
                </View>
                {r.title_en && r.title_am && (
                  <Text style={styles.resultEn} numberOfLines={1}>{r.title_en}</Text>
                )}
                <Text style={styles.resultTopic}>
                  {r.page_type}
                  {r.compendium_q ? ` · Q ${r.compendium_q}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
  },
  searchField: {
    flex: 1,
    fontFamily: fonts.ethiopic,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },
  cancelText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.oxblood,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: fonts.garamond,
    fontSize: 16,
    color: colors.inkMid,
    marginBottom: 6,
  },
  emptyHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 16,
  },
  topMatchCard: {
    padding: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    marginBottom: 20,
  },
  topMatchTitle: {
    marginBottom: 6,
  },
  topMatchAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 24,
    color: colors.ink,
  },
  topMatchEn: {
    fontFamily: fonts.garamondItalic,
    fontSize: 16,
    color: colors.inkMid,
    fontStyle: 'italic',
    marginTop: 2,
  },
  topMatchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  topMatchQ: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topMatchDesc: {
    fontFamily: fonts.garamond,
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkMid,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.parchment,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  resultRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultAm: {
    flex: 1,
    fontFamily: fonts.ethiopic,
    fontSize: 15,
    color: colors.ink,
  },
  resultEn: {
    fontFamily: fonts.garamondItalic,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.inkMid,
    marginTop: 2,
    paddingLeft: 14,
  },
  resultTopic: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    paddingLeft: 14,
  },
});
