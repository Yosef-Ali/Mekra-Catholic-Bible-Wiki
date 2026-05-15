import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search } from 'lucide-react-native';
import { fetchBooks, BibleBook } from '../../src/services/api';
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
  const [activeTab, setActiveTab] = useState<Section>('NT');
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);

  const { data: allBooks, loading } = useApi<BibleBook[]>(fetchBooks);

  const filteredBooks = useMemo(
    () => (allBooks ?? []).filter((b) => b.section === activeTab),
    [allBooks, activeTab],
  );

  const chapterNumbers = useMemo(
    () => (selectedBook ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1) : []),
    [selectedBook],
  );

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
                <TouchableOpacity key={n} style={styles.chapterCell} activeOpacity={0.7}>
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
});
