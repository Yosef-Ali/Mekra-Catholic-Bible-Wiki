/** Manuscript Modern — design tokens */

export const colors = {
  parchment: '#F4EEDD',
  parchmentTranslucent: 'rgba(244,238,221,0.92)',
  parchmentMuted: 'rgba(244,238,221,0.6)',
  cream: '#EDE6D0',
  vellumDark: '#DDD5BD',
  ink: '#1F1B14',
  inkMid: '#6B6354',
  inkSoft: '#847B68',
  oxblood: '#7A2522',
  ochre: '#B68530',
  teal: '#2C4A52',
  rule: '#C9C0A8',
} as const;

export const fonts = {
  garamond: 'EBGaramond_500Medium',
  garamondSemiBold: 'EBGaramond_600SemiBold',
  garamondItalic: 'EBGaramond_500Medium_Italic',
  ethiopic: 'NotoSerifEthiopic_400Regular',
  ethiopicMedium: 'NotoSerifEthiopic_500Medium',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  mono: 'JetBrainsMono_400Regular',
} as const;

/** Shared layout values */
export const layout = {
  scrollBottomPadding: 120,
} as const;
