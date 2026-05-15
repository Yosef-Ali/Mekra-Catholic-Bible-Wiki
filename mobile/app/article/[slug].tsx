import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Volume2, Pause, Square } from 'lucide-react-native';
import { fetchWikiPage, WikiPage } from '../../src/services/api';
import { useApi } from '../../src/hooks/useApi';
import { readArticle, stopTTS, pauseTTS, resumeTTS } from '../../src/services/tts';
import { Rubric, Ornament, OrnamentDivider, Meta, screenBase } from '../../src/components/Primitives';
import { colors, fonts, layout } from '../../src/theme/colors';

// ─── Parsing helpers ────────────────────────────────────────

function parseFrontmatterFromBody(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^\*\*([^*]+)\*\*:\s*(.+)$/);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

function getArticleBody(body: string): string {
  const lines = body.split('\n');
  const cleaned: string[] = [];
  let pastFrontmatter = false;
  for (const line of lines) {
    if (line.startsWith('# ')) continue;
    if (/^\*\*[^*]+\*\*:\s*.+$/.test(line)) continue;
    if (!pastFrontmatter && line.trim() === '') continue;
    pastFrontmatter = true;
    cleaned.push(line);
  }
  return cleaned.join('\n').trim();
}

/** Clean inline markdown: bold, italic, wiki links, CCC refs */
function cleanInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // strip bold markers
    .replace(/\*([^*]+)\*/g, '$1')              // strip italic markers
    .replace(/\[\[([^\]]+)\]\]/g, (_m, link: string) => {
      // [[concepts/ጸጋ]] → ጸጋ, [[teaching/baptism]] → baptism
      const parts = link.split('/');
      const label = parts[parts.length - 1].replace(/-/g, ' ');
      return label;
    });
}

/** Check if a line is a Q label like "**Q:** ..." or "Q: ..." */
function isQLine(line: string): boolean {
  return /^\*?\*?Q:?\*?\*?\s/.test(line);
}

/** Check if a line is an A label like "**A:** ..." or "A: ..." */
function isALine(line: string): boolean {
  return /^\*?\*?A:?\*?\*?\s/.test(line);
}

/** Check if line is a CCC reference like "[CCC 1213-1216]" */
function isCCCRef(line: string): boolean {
  return /^\[CCC\s[\d,\s–-]+\]\s*$/.test(line.trim());
}

/** Check if line is a source/reference list item */
function isSourceLine(line: string): boolean {
  return /^- `raw\//.test(line) || /^- Compendium of/.test(line) || /^- Catechism of/.test(line);
}

// ─── Markdown renderer ──────────────────────────────────────

function MarkdownSection({ text, router }: { text: string; router: ReturnType<typeof useRouter> }) {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Section headings ──
    if (line.startsWith('## ')) {
      const title = line.replace('## ', '');
      nodes.push(
        <View key={key++} style={s.sectionHeading}>
          <View style={s.sectionRule} />
          <Text style={s.h2}>{title}</Text>
        </View>
      );
      i++;
      continue;
    }

    // ── Q number headings like ### Q252 ──
    if (line.startsWith('### ')) {
      const title = line.replace('### ', '');
      nodes.push(
        <View key={key++} style={s.qHeading}>
          <Text style={s.h3}>{title}</Text>
        </View>
      );
      i++;
      continue;
    }

    // ── Blockquotes — merge consecutive > lines ──
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].replace(/^>\s*/, ''));
        i++;
      }
      const quoteText = cleanInline(quoteLines.join('\n'));
      // Check if last line is attribution (starts with —)
      const attrMatch = quoteText.match(/\n(—\s*.+)$/);
      const body = attrMatch ? quoteText.replace(attrMatch[0], '') : quoteText;
      const attribution = attrMatch ? attrMatch[1] : null;
      nodes.push(
        <View key={key++} style={s.blockquote}>
          <View style={s.blockquoteBar} />
          <View style={s.blockquoteInner}>
            <Text style={s.blockquoteText}>{body}</Text>
            {attribution && (
              <Text style={s.blockquoteAttr}>{attribution}</Text>
            )}
          </View>
        </View>
      );
      continue;
    }

    // ── CCC reference tags like [CCC 1213-1216] ──
    if (isCCCRef(line)) {
      nodes.push(
        <Text key={key++} style={s.cccRef}>{line.trim()}</Text>
      );
      i++;
      continue;
    }

    // ── Source/reference lines ──
    if (isSourceLine(line)) {
      // Skip raw source file references, they're not useful to readers
      i++;
      continue;
    }

    // ── Q: question lines ──
    if (isQLine(line)) {
      const qText = cleanInline(line.replace(/^\*?\*?Q:?\*?\*?\s*/, ''));
      nodes.push(
        <View key={key++} style={s.qaBlock}>
          <Text style={s.qLabel}>Q</Text>
          <Text style={s.qText}>{qText}</Text>
        </View>
      );
      i++;
      continue;
    }

    // ── A: answer lines ──
    if (isALine(line)) {
      // Gather continuation lines (lines that don't start a new section)
      const aLines: string[] = [line.replace(/^\*?\*?A:?\*?\*?\s*/, '')];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('>') &&
        !isQLine(lines[i]) &&
        !isCCCRef(lines[i])
      ) {
        aLines.push(lines[i]);
        i++;
      }
      const aText = cleanInline(aLines.join(' '));
      nodes.push(
        <View key={key++} style={s.qaBlock}>
          <Text style={s.aLabel}>A</Text>
          <Text style={s.aText}>{aText}</Text>
        </View>
      );
      continue;
    }

    // ── Empty lines → vertical space ──
    if (line.trim() === '') {
      nodes.push(<View key={key++} style={s.paraSpacer} />);
      i++;
      continue;
    }

    // ── Open questions section header ──
    if (line.startsWith('- ') && !isSourceLine(line)) {
      const bulletText = cleanInline(line.replace(/^-\s*/, ''));
      nodes.push(
        <View key={key++} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{bulletText}</Text>
        </View>
      );
      i++;
      continue;
    }

    // ── Regular paragraph text ──
    // Gather continuation lines into one paragraph
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('- ') &&
      !isQLine(lines[i]) &&
      !isALine(lines[i]) &&
      !isCCCRef(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const para = cleanInline(paraLines.join(' '));
    nodes.push(
      <Text key={key++} style={s.bodyText}>{para}</Text>
    );
  }

  return <>{nodes}</>;
}

// ─── Screen component ────────────────────────────────────────

export default function ArticleScreen() {
  const { slug, type } = useLocalSearchParams<{ slug: string; type?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: page, loading } = useApi<WikiPage | null>(
    () => fetchWikiPage(slug, type),
    [slug, type],
  );

  const fm = page?.frontmatter ?? (page?.body_md ? parseFrontmatterFromBody(page.body_md) : {});
  const body = page?.body_md ? getArticleBody(page.body_md) : '';

  // ── Audio state ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopTTS();
    };
  }, []);

  const [audioLoading, setAudioLoading] = useState(false);

  const toggleAudio = useCallback(async () => {
    if (isPaused) {
      resumeTTS();
      setIsPaused(false);
      return;
    }
    if (isPlaying) {
      pauseTTS();
      setIsPaused(true);
      return;
    }
    if (!slug) return;

    setIsPlaying(true);
    setIsPaused(false);
    setAudioLoading(true);
    try {
      // readArticle fetches audio from server, then plays it.
      // Loading state clears once the promise settles (audio finishes or fails).
      await readArticle(slug, type, undefined, () => {
        if (mountedRef.current) setAudioLoading(false);
      });
    } catch (e: any) {
      if (__DEV__ && e?.name !== 'AbortError') console.warn('[TTS]', e);
    }
    if (mountedRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      setAudioLoading(false);
    }
  }, [isPlaying, isPaused, slug, type]);

  const handleStop = useCallback(() => {
    stopTTS();
    setIsPlaying(false);
    setIsPaused(false);
    setAudioLoading(false);
  }, []);

  return (
    <View style={[screenBase.container, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ChevronLeft size={22} strokeWidth={1.6} color={colors.inkSoft} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View style={s.headerRight}>
          {/* Audio controls */}
          {body.length > 0 && (
            <View style={s.audioRow}>
              <TouchableOpacity
                onPress={toggleAudio}
                style={[s.audioBtn, isPlaying && !isPaused && s.audioBtnActive]}
                activeOpacity={0.7}
                disabled={audioLoading}
              >
                {audioLoading ? (
                  <ActivityIndicator size="small" color={colors.oxblood} />
                ) : isPlaying && !isPaused ? (
                  <Pause size={16} color={colors.parchment} />
                ) : (
                  <Volume2 size={16} color={isPlaying ? colors.parchment : colors.inkSoft} />
                )}
              </TouchableOpacity>
              {isPlaying && (
                <TouchableOpacity onPress={handleStop} style={s.stopBtn} activeOpacity={0.7}>
                  <Square size={14} color={colors.inkSoft} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <Text style={s.headerType}>{page?.page_type ?? ''}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.oxblood} />
          <Text style={s.loadingText}>Loading article...</Text>
        </View>
      ) : !page ? (
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Article not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.retryBtn}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: layout.scrollBottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          {/* Title block */}
          <View style={s.titleBlock}>
            {page.title_am && (
              <Text style={s.titleAm}>{page.title_am}</Text>
            )}
            <Text style={s.titleEn}>
              {page.title_en ?? page.title_am ?? slug.replace(/-/g, ' ')}
            </Text>
            {page.compendium_q && (
              <View style={s.compQBadge}>
                <Text style={s.compQText}>Compendium Q {page.compendium_q}</Text>
              </View>
            )}
          </View>

          {/* Metadata bar */}
          <View style={s.metaBlock}>
            {fm.Part && <Meta k="Part" v={fm.Part} />}
            {fm.CCC && <Meta k="CCC" v={fm.CCC} />}
            {(fm.Sources || page.sources) && (
              <Meta k="Sources" v={fm.Sources ?? page.sources ?? ''} />
            )}
            {page.bible_ref_count > 0 && (
              <Meta k="Bible refs" v={String(page.bible_ref_count)} />
            )}
          </View>

          {/* Divider */}
          <View style={s.dividerWrap}>
            <Ornament w={80} />
          </View>

          {/* Body content */}
          <View style={s.content}>
            <MarkdownSection text={body} router={router} />
          </View>

          {/* Bible references */}
          {page.bible_refs && page.bible_refs.length > 0 && (
            <View style={s.refsSection}>
              <View style={s.sectionRule} />
              <Rubric>Scripture References</Rubric>
              <View style={s.refsGrid}>
                {page.bible_refs.map((ref: any, idx: number) => (
                  <View key={idx} style={s.refChip}>
                    <Text style={s.refChipText}>
                      {typeof ref === 'string' ? ref : `${ref.book} ${ref.chapter}:${ref.verses}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Related links */}
          {page.links && page.links.length > 0 && (
            <View style={s.linksSection}>
              <Rubric>Related</Rubric>
              <View style={s.linksList}>
                {page.links.map((link) => {
                  const parts = link.split('/');
                  const linkSlug = parts[parts.length - 1];
                  const linkType = parts.length > 1 ? parts[0] : undefined;
                  // Decode URI-like slugs for display
                  const label = decodeURIComponent(linkSlug).replace(/-/g, ' ');
                  return (
                    <TouchableOpacity
                      key={link}
                      style={s.linkChip}
                      onPress={() => router.push({
                        pathname: '/article/[slug]',
                        params: { slug: linkSlug, type: linkType },
                      })}
                      activeOpacity={0.7}
                    >
                      {linkType && (
                        <Text style={s.linkChipType}>{linkType}</Text>
                      )}
                      <Text style={s.linkChipLabel}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <OrnamentDivider w={100} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
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
  },
  backText: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.inkSoft,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  audioBtnActive: {
    backgroundColor: colors.oxblood,
    borderColor: colors.oxblood,
  },
  stopBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  headerType: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingRight: 4,
  },

  // Loading / Error
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
  },
  errorText: {
    fontFamily: fonts.garamond,
    fontSize: 18,
    color: colors.inkMid,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 4,
  },
  retryText: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.ink,
  },

  // Title
  titleBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 14,
  },
  titleAm: {
    fontFamily: fonts.ethiopicMedium,
    fontSize: 30,
    lineHeight: 40,
    color: colors.ink,
    marginBottom: 2,
  },
  titleEn: {
    fontFamily: fonts.garamond,
    fontSize: 20,
    color: colors.inkMid,
    lineHeight: 26,
  },
  compQBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 3,
  },
  compQText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.oxblood,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Meta
  metaBlock: {
    paddingHorizontal: 24,
    gap: 3,
    paddingBottom: 4,
  },

  dividerWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  // Content area
  content: {
    paddingHorizontal: 24,
  },

  // ── Section headings ──
  sectionHeading: {
    marginTop: 28,
    marginBottom: 12,
  },
  sectionRule: {
    height: 1,
    backgroundColor: colors.rule,
    marginBottom: 10,
  },
  h2: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 0.3,
  },

  // ── Q headings (### Q252) ──
  qHeading: {
    marginTop: 24,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  h3: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 18,
    color: colors.oxblood,
  },

  // ── Body text (synthesis paragraphs) ──
  bodyText: {
    fontFamily: fonts.ethiopic,
    fontSize: 16,
    lineHeight: 28,
    color: colors.ink,
    marginBottom: 4,
  },

  paraSpacer: {
    height: 12,
  },

  // ── Q&A formatting ──
  qaBlock: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  qLabel: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 18,
    color: colors.oxblood,
    width: 22,
    lineHeight: 28,
  },
  qText: {
    flex: 1,
    fontFamily: fonts.ethiopicMedium,
    fontSize: 16,
    lineHeight: 28,
    color: colors.ink,
  },
  aLabel: {
    fontFamily: fonts.garamondSemiBold,
    fontSize: 18,
    color: colors.teal,
    width: 22,
    lineHeight: 28,
  },
  aText: {
    flex: 1,
    fontFamily: fonts.ethiopic,
    fontSize: 15,
    lineHeight: 26,
    color: colors.inkMid,
  },

  // ── CCC references ──
  cccRef: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
    marginBottom: 14,
    paddingLeft: 32,
  },

  // ── Blockquotes (scripture) ──
  blockquote: {
    flexDirection: 'row',
    marginVertical: 12,
    marginLeft: 4,
  },
  blockquoteBar: {
    width: 3,
    backgroundColor: colors.ochre,
    borderRadius: 1.5,
  },
  blockquoteInner: {
    flex: 1,
    paddingLeft: 14,
  },
  blockquoteText: {
    fontFamily: fonts.garamondItalic,
    fontSize: 16,
    lineHeight: 26,
    color: colors.inkMid,
    fontStyle: 'italic',
  },
  blockquoteAttr: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.oxblood,
    marginTop: 6,
    letterSpacing: 0.5,
  },

  // ── Bullet lists ──
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    fontFamily: fonts.garamond,
    fontSize: 16,
    color: colors.inkSoft,
    lineHeight: 26,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.garamond,
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMid,
  },

  // ── Scripture references ──
  refsSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  refsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  refChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  refChipText: {
    fontFamily: fonts.ethiopic,
    fontSize: 13,
    color: colors.ink,
  },

  // ── Related links ──
  linksSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  linksList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  linkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 4,
  },
  linkChipType: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  linkChipLabel: {
    fontFamily: fonts.ethiopic,
    fontSize: 13,
    color: colors.ink,
  },
});
