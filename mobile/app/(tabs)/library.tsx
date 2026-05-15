import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, MessageSquare } from 'lucide-react-native';
import { Rubric, OrnamentDivider, ScreenHeader, screenBase } from '../../src/components/Primitives';
import { colors, fonts, layout } from '../../src/theme/colors';

const BOOKMARKS = [
  { type: 'verse' as const, ref: 'ዮሐንስ 1:16', text: 'ከእርሱ ሙላት ሁላችን ተቀብለናል፣ ጸጋ በጸጋ ላይ።', date: 'Today' },
  { type: 'verse' as const, ref: 'ሉቃስ 22:19', text: 'ይህ ስለ እናንተ የሚሰጥ ሥጋዬ ነው።', date: 'Yesterday' },
  { type: 'chat' as const, ref: 'AI Guidance', text: 'ቅዱስ ቁርባን የክርስቲያናዊ ሕይወት ምንጭና ቁንጮ ነው...', date: '2 days ago' },
];

const VERSE_COUNT = BOOKMARKS.filter((b) => b.type === 'verse').length;
const CHAT_COUNT = BOOKMARKS.filter((b) => b.type === 'chat').length;

const scrollContent = { paddingBottom: layout.scrollBottomPadding };

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[screenBase.container, { paddingTop: insets.top }]}
      contentContainerStyle={scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Library"
        titleAm="ቤተ መጻሕፍት"
        subtitle={`${BOOKMARKS.length} saved items`}
      />

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Bookmark size={14} color={colors.oxblood} />
          <Text style={styles.statNum}>{VERSE_COUNT}</Text>
          <Text style={styles.statLabel}>Verses</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MessageSquare size={14} color={colors.ochre} />
          <Text style={styles.statNum}>{CHAT_COUNT}</Text>
          <Text style={styles.statLabel}>Chats</Text>
        </View>
      </View>

      <View style={styles.list}>
        <Rubric>Recent</Rubric>
        {BOOKMARKS.map((b) => (
          <TouchableOpacity key={b.ref} style={styles.row} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              {b.type === 'verse' ? (
                <Bookmark size={14} color={colors.oxblood} />
              ) : (
                <MessageSquare size={14} color={colors.ochre} />
              )}
            </View>
            <View style={screenBase.flex1}>
              <Text style={styles.rowRef}>{b.ref}</Text>
              <Text style={styles.rowText} numberOfLines={2}>
                {b.text}
              </Text>
            </View>
            <Text style={styles.rowDate}>{b.date}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <OrnamentDivider w={100} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statNum: {
    fontFamily: fonts.garamond,
    fontSize: 20,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.rule,
    marginHorizontal: 24,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowRef: {
    fontFamily: fonts.garamond,
    fontSize: 15,
    color: colors.ink,
  },
  rowText: {
    fontFamily: fonts.ethiopic,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMid,
    marginTop: 2,
  },
  rowDate: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
