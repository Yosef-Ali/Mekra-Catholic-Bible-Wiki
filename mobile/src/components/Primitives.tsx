import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../theme/colors';

/** Ethiopian cross ornament */
export const CrossMark = React.memo<{ size?: number; color?: string }>(
  ({ size = 14, color = colors.oxblood }) => (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.4}>
      <Path d="M12 3v18M3 12h18" />
      <Path d="M8 8l-2-2M16 8l2-2M8 16l-2 2M16 16l2 2" strokeLinecap="round" />
    </Svg>
  ),
);

/** Ochre decorative divider */
export const Ornament = React.memo<{ w?: number; color?: string }>(
  ({ w = 80, color = colors.ochre }) => (
    <Svg viewBox="0 0 80 8" width={w} height={8} fill="none" stroke={color} strokeWidth={0.8}>
      <Path d="M0 4h30" />
      <Circle cx={34} cy={4} r={1.5} fill={color} stroke="none" />
      <Path d="M38 4 l2 -3 l2 3 l-2 3 z" fill={color} stroke="none" />
      <Circle cx={46} cy={4} r={1.5} fill={color} stroke="none" />
      <Path d="M50 4h30" />
    </Svg>
  ),
);

/** Rubric text — oxblood small-caps style */
export const Rubric: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.rubric}>{children}</Text>
);

/** Section label — muted mono small-caps (like Rubric but inkSoft) */
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

/** Reusable screen header — Garamond title + Ethiopic + subtitle */
export const ScreenHeader: React.FC<{
  title: string;
  titleAm: string;
  subtitle: string;
}> = ({ title, titleAm, subtitle }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>
      {titleAm} <Text style={styles.headerTitleEn}>{'· ' + title}</Text>
    </Text>
    <Text style={styles.headerSubtitle}>{subtitle}</Text>
  </View>
);

/** Mono metadata pair */
export const Meta: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <View style={styles.metaRow}>
    <Text style={styles.metaKey}>{k}</Text>
    <Text style={styles.metaVal}>{v}</Text>
  </View>
);

/** Ornament centered in a padded wrapper */
export const OrnamentDivider: React.FC<{ w?: number; py?: number }> = ({
  w = 100,
  py = 24,
}) => (
  <View style={[styles.ornamentWrap, { paddingVertical: py }]}>
    <Ornament w={w} />
  </View>
);

/**
 * Shown when a request failed (as opposed to returning nothing). Says so
 * plainly and offers a retry — on an unreliable connection the honest
 * message is "couldn't reach the server", not an empty screen.
 */
export const LoadError: React.FC<{ onRetry: () => void; message?: string }> = ({
  onRetry,
  message = "Couldn't reach the server. Check your connection.",
}) => (
  <View style={styles.loadError} accessibilityRole="alert">
    <Text style={styles.loadErrorAm}>መገናኘት አልተቻለም።</Text>
    <Text style={styles.loadErrorText}>{message}</Text>
    <TouchableOpacity
      onPress={onRetry}
      style={styles.loadErrorBtn}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Try again"
    >
      <Text style={styles.loadErrorBtnText}>Try again · እንደገና ሞክር</Text>
    </TouchableOpacity>
  </View>
);

/** Common base screen style */
export const screenBase = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parchment },
  flex1: { flex: 1 },
});

const styles = StyleSheet.create({
  rubric: {
    color: colors.oxblood,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 10,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  headerTitle: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 24,
    color: colors.ink,
  },
  headerTitleEn: {
    fontFamily: fonts.garamond,
    fontSize: 18,
    color: colors.inkMid,
  },
  headerSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaKey: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    minWidth: 92,
    lineHeight: 19,
  },
  metaVal: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkMid,
    lineHeight: 19,
  },
  ornamentWrap: {
    alignItems: 'center',
  },
  loadError: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 8,
  },
  loadErrorAm: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 16,
    color: colors.ink,
  },
  loadErrorText: {
    fontFamily: fonts.garamond,
    fontSize: 15,
    color: colors.inkMid,
    textAlign: 'center',
  },
  loadErrorBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.oxblood,
    minHeight: 44,
    justifyContent: 'center',
  },
  loadErrorBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.oxblood,
  },
});
