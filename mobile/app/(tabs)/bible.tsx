import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import {
  fetchBooks,
  fetchChapterContent,
  parseVerses,
  parseVerseRange,
  matchBook,
  BibleBook,
  DisplayVerse,
} from '../../src/services/api';
import { useApi } from '../../src/hooks/useApi';
import { Rubric, screenBase } from '../../src/components/Primitives';
import { colors, fonts, layout } from '../../src/theme/colors';

type Section = 'NT' | 'OT' | 'Apocrypha';

const TABS: { key: Section; l: string; am: string }[] = [
  { key: 'NT', l: 'New Testament', am: 'አዲስ ኪዳን' },
  { key: 'OT', l: 'Old Testament', am: 'ብሉይ ኪዳን' },
  { key: 'Apocrypha', l: 'Deuterocanon', am: 'መጻሕፍተ ሰሎሞን' },
];

const scrollContent = { paddingBottom: layout.scrollBottomPadding };

export default function BibleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verses?: string }>();
  const [activeTab, setActiveTab] = useState<Section>('NT');
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);

  // Reader state
  const [readerChapter, setReaderChapter] = useState<number | null>(null);
  const [readerVerses, setReaderVerses] = useState<DisplayVerse[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const [highlight, setHighlight] = useState<Set<number>>(new Set());

  const { data: allBooks, loading } = useApi<BibleBook[]>(fetchBooks);

  const filteredBooks = useMemo(
    () => (allBooks ?? []).filter((b) => b.section === activeTab),
    [allBooks, activeTab],
  );

  const chapterNumbers = useMemo(
    () => (selectedBook ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1) : []),
    [selectedBook],
  );

  // Open the reader for a given book + chapter, optionally highlighting verses.
  const openReader = useCallback(
    async (book: BibleBook, chapter: number, highlightVerses?: string) => {
      setSelectedBook(book);
      setReaderChapter(chapter);
      setHighlight(parseVerseRange(highlightVerses));
      setReaderLoading(true);
      setReaderVerses([]);
      const result = await fetchChapterContent(book.id, chapter);
      setReaderVerses(result ? parseVerses(result.content, result.formattingRules) : []);
      setReaderLoading(false);
    },
    [],
  );

  const closeReader = useCallback(() => {
    setReaderChapter(null);
    setReaderVerses([]);
    setHighlight(new Set());
  }, []);

  // Consume an incoming scripture deep-link (book + chapter + verses params).
  // Guard against re-running for the same link on re-render.
  const consumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!params.book || !params.chapter || !allBooks?.length) return;
    const key = `${params.book}|${params.chapter}|${params.verses ?? ''}`;
    if (consumedRef.current === key) return;
    const match = matchBook(allBooks, params.book);
    if (!match) return;
    consumedRef.current = key;
    setActiveTab(match.section as Section);
    openReader(match, parseInt(params.chapter, 10) || 1, params.verses);
  }, [params.book, params.chapter, params.verses, allBooks, openReader]);

  // ── Reader view ──
  if (readerChapter !== null && selectedBook) {
    return (
      <View style={[screenBase.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={closeReader} hitSlop={12} style={styles.readerBack}>
            <ChevronLeft size={22} strokeWidth={1.6} color={colors.inkSoft} />
            <Text style={styles.readerBackText}>Chapters</Text>
          </TouchableOpacity>
          <Rubric>{`${selectedBook.amharicName} ${readerChapter}`}</Rubric>
          <View style={{ width: 60 }} />
        </View>
        {readerLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.oxblood} size="small" />
          </View>
        ) : readerVerses.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.emptyText}>This chapter isn't available yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.readerTitleBlock}>
              <Text style={styles.readerBookAm}>{selectedBook.amharicName}</Text>
              <Text style={styles.readerChapterNum}>{`Chapter ${readerChapter} · ${selectedBook.name}`}</Text>
            </View>
            <View style={styles.readerBody}>
              {readerVerses.map((v, idx) => {
                if (v.type === 'header') {
                  return <Text key={idx} style={styles.verseSectionTitle}>{v.text}</Text>;
                }
                if (v.type === 'subtitle') {
                  return <Text key={idx} style={styles.verseSubtitle}>{v.text}</Text>;
                }
                const isHit = highlight.has(v.number);
                return (
                  <View
                    key={idx}
                    style={[
                      styles.verseRow,
                      v.isNewParagraph && styles.verseParaBreak,
                      isHit && styles.verseRowHit,
                    ]}
                  >
                    <Text style={[styles.verseNum, isHit && styles.verseNumHit]}>{v.number}</Text>
                    <Text style={[styles.verseText, isHit && styles.verseTextHit]}>{v.text}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[screenBase.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronLeft size={22} strokeWidth={1.6} color={colors.inkSoft} />
        <Rubric>{'Emmaus · መጽሐፍ ቅዱስ'}</Rubric>
        <Search size={20} strokeWidth={1.6} color={colors.inkSoft} />
      </View>

      <ScrollView
        contentContainerStyle={scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Selected book breadcrumb */}
        {selectedBook && (
          <View style={styles.breadcrumb}>
            <View style={[styles.breadcrumbItem, screenBase.flex1]}>
              <Text style={styles.breadcrumbLabel}>Book</Text>
              <Text style={styles.breadcrumbValueAm}>{selectedBook.amharicName}</Text>
            </View>
            <View style={[styles.breadcrumbItem, styles.breadcrumbChapter]}>
              <Text style={styles.breadcrumbLabel}>Chapters</Text>
              <Text style={styles.breadcrumbValueNum}>{selectedBook.chapters}</Text>
            </View>
          </View>
        )}

        {/* Section tabs */}
        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => { setActiveTab(t.key); setSelectedBook(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                {t.l} <Text style={styles.tabAm}>{'· ' + t.am}</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Book count */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {loading ? 'Loading...' : `${filteredBooks.length} books`}
          </Text>
        </View>

        {/* Book list */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.oxblood} size="small" />
          </View>
        ) : (
          <View style={styles.bookList}>
            {filteredBooks.map((book) => {
              const active = selectedBook?.id === book.id;
              return (
                <TouchableOpacity
                  key={book.id}
                  style={[styles.bookRow, active && styles.bookRowActive]}
                  onPress={() => setSelectedBook(active ? null : book)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bookAm, active && styles.bookAmActive]}>
                    {book.amharicName}
                  </Text>
                  <Text style={[styles.bookEn, active && styles.bookEnActive]}>
                    {book.name}
                  </Text>
                  <Text style={[styles.bookChapters, active && styles.bookChaptersActive]}>
                    {book.chapters} ch.
                  </Text>
                  {active && <Text style={styles.bookSelected}>SELECTED</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Chapter grid (shown when a book is selected) */}
        {selectedBook && (
          <View style={styles.chapterSection}>
            <View style={styles.chapterSectionHeader}>
              <Text style={styles.chapterSectionLabel}>
                Chapters · {selectedBook.name}
              </Text>
              <Text style={styles.chapterSectionCount}>
                {selectedBook.chapters} total
              </Text>
            </View>
            <View style={styles.chapterGrid}>
              {chapterNumbers.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.chapterCell}
                  activeOpacity={0.7}
                  onPress={() => selectedBook && openReader(selectedBook, n)}
                >
                  <Text style={styles.chapterCellText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  breadcrumb: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  breadcrumbItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  breadcrumbChapter: { width: 90 },
  breadcrumbLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  breadcrumbValueAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 16,
    color: colors.ink,
  },
  breadcrumbValueNum: {
    fontFamily: fonts.garamond,
    fontSize: 20,
    color: colors.ink,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.rule,
  },
  tabActive: {
    borderBottomColor: colors.oxblood,
  },
  tabText: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.inkSoft,
  },
  tabTextActive: {
    color: colors.ink,
    fontWeight: '500',
  },
  tabAm: {
    fontFamily: fonts.ethiopic,
  },
  countRow: {
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  countText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  bookList: {
    paddingHorizontal: 22,
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  bookRowActive: {
    backgroundColor: colors.ink,
  },
  bookAm: {
    fontFamily: fonts.ethiopic,
    fontSize: 16,
    color: colors.ink,
    minWidth: 90,
    flex: 1,
  },
  bookAmActive: {
    color: colors.parchment,
  },
  bookEn: {
    fontFamily: fonts.garamondItalic,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.inkSoft,
    flex: 1,
  },
  bookEnActive: {
    color: colors.parchmentMuted,
  },
  bookChapters: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
  },
  bookChaptersActive: {
    color: colors.parchmentMuted,
  },
  bookSelected: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.ochre,
  },
  chapterSection: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  chapterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chapterSectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  chapterSectionCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  chapterCell: {
    width: '9.4%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.parchment,
  },
  chapterCellText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
  },

  // ── Reader ──
  readerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  readerBackText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
  },
  emptyText: {
    fontFamily: fonts.garamondItalic,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  readerTitleBlock: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  readerBookAm: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 26,
    color: colors.ink,
  },
  readerChapterNum: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  readerBody: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  verseSectionTitle: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 18,
    color: colors.oxblood,
    marginTop: 18,
    marginBottom: 8,
  },
  verseSubtitle: {
    fontFamily: fonts.garamondItalic,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.inkMid,
    marginTop: 10,
    marginBottom: 4,
  },
  verseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  verseParaBreak: {
    marginTop: 12,
  },
  verseRowHit: {
    backgroundColor: colors.cream,
    borderLeftWidth: 3,
    borderLeftColor: colors.ochre,
    paddingLeft: 8,
    paddingVertical: 4,
    marginLeft: -11,
    borderRadius: 2,
  },
  verseNum: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.ochre,
    lineHeight: 28,
    minWidth: 18,
    textAlign: 'right',
  },
  verseNumHit: {
    color: colors.oxblood,
  },
  verseText: {
    flex: 1,
    fontFamily: fonts.ethiopic,
    fontSize: 16,
    lineHeight: 28,
    color: colors.ink,
  },
  verseTextHit: {
    color: colors.ink,
  },
});
