import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getDailyReflection, DailyReflection } from '../services/geminiService';
import { getUserProfile, getLastRead } from '../services/storageService';
import { readingsApi, booksApi, chaptersApi, DailyReadingsData, DailyReading } from '../services/apiClient';
import { pickVerse } from '../services/verseText';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useFooter } from '../contexts/FooterContext';
import { useScrollHideFooter } from '../hooks/useScrollHideFooter';
import { CrossMark, Ornament, Rubric } from './ui/ManuscriptPrimitives';

/* ── teaching shortcuts ── */
const TEACHING_CHAPTERS = [
  { slug: 'baptism', en: 'Baptism', am: 'ጥምቀት', part: 'II', q: '252–264', color: '#7A2522' },
  { slug: 'confirmation', en: 'Confirmation', am: 'ሜሮን', part: 'II', q: '265–270', color: '#B68530' },
  { slug: 'eucharist', en: 'Eucharist', am: 'ቁርባን', part: 'II', q: '271–294', color: '#7A2522' },
  { slug: 'penance', en: 'Penance', am: 'ንስሐ', part: 'II', q: '295–312', color: '#2C4A52' },
];

type BibleRef = { book: string; chapter: number; verses?: string };

interface DailyDevotionProps {
  onOpenSettings?: () => void;
  /** Open the reader at a passage. */
  openBibleRef?: (ref: BibleRef) => void;
  /** Open the teaching section. */
  onOpenTeaching?: () => void;
}

/**
 * Home screen for phone-width browsers.
 *
 * Everything scriptural here comes from the server: the day's readings from
 * the lectionary table (/api/readings) and the verse text from the Bible
 * database (/api/chapters). The one AI-written piece is the reflection, which
 * is labelled as such. This screen used to ask a model for the readings and
 * their full text and show whatever came back as Scripture.
 */
export const DailyDevotion: React.FC<DailyDevotionProps> = ({ onOpenSettings, openBibleRef, onOpenTeaching }) => {
  const [daily, setDaily] = useState<DailyReadingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [verse, setVerse] = useState<{ reference: string; text: string; ref: BibleRef } | null>(null);
  const [reflection, setReflection] = useState<DailyReflection | null>(null);
  const [isReflectionExpanded, setIsReflectionExpanded] = useState(false);

  const { setHideFooter } = useFooter();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHideFooter(setHideFooter, scrollRef);

  // 1. The day: liturgical context and reading citations.
  useEffect(() => {
    let cancelled = false;
    readingsApi.get('today')
      .then((d) => { if (!cancelled) setDaily(d); })
      .catch(() => { if (!cancelled) setOffline(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const readings: DailyReading[] = useMemo(() => daily?.roman.readings ?? [], [daily]);
  const season: string | null = daily?.roman.liturgical?.season ?? null;
  const celebration: string | null = daily?.roman.celebration ?? daily?.roman.liturgical?.dayName ?? null;

  // 2. Verse of the day: the opening verse of the Gospel, read from the
  //    Bible database. If any step fails the card is simply not shown —
  //    there is no stand-in text.
  useEffect(() => {
    const gospel = readings.find((r) => r.type === 'gospel' && r.book && r.chapter)
      ?? readings.find((r) => r.book && r.chapter);
    if (!gospel?.book || !gospel.chapter) return;
    let cancelled = false;
    (async () => {
      try {
        const books = await booksApi.getAll();
        const book = books.find((b) => b.name === gospel.book);
        if (!book) return;
        const { content } = await chaptersApi.getContent(book.id, gospel.chapter!);
        const found = pickVerse(content, gospel.verses);
        if (cancelled || !found) return;
        setVerse({
          reference: `${book.amharicName} ${gospel.chapter}:${found.number}`,
          text: found.text,
          ref: { book: gospel.book!, chapter: gospel.chapter!, verses: String(found.number) },
        });
      } catch { /* no verse card */ }
    })();
    return () => { cancelled = true; };
  }, [readings]);

  // 3. Reflection: AI commentary on those readings. Never blocks the page.
  useEffect(() => {
    if (!daily || readings.length === 0) return;
    let cancelled = false;
    getDailyReflection(daily.date, readings.map((r) => r.citation), celebration)
      .then((r) => { if (!cancelled) setReflection(r); });
    return () => { cancelled = true; };
  }, [daily, readings, celebration]);

  const lastRead = useMemo(() => getLastRead(), []);
  const openReading = (r: DailyReading) => {
    if (r.book && r.chapter && openBibleRef) openBibleRef({ book: r.book, chapter: r.chapter, verses: r.verses });
  };

  const profile = getUserProfile();
  const userName = profile?.name || 'Friend';
  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  /* ── Loading skeleton (Manuscript Modern style) ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--parchment)' }}>
        <div className="px-6 pt-16 pb-4 flex items-center gap-2">
          <div className="h-5 w-5 bg-rule/50 rounded animate-pulse" />
          <div className="h-6 w-16 bg-rule/50 rounded animate-pulse" />
        </div>
        <div className="px-6 space-y-2 mb-6">
          <div className="h-3 w-32 bg-rule/40 rounded animate-pulse" />
          <div className="h-10 w-48 bg-rule/50 rounded animate-pulse" />
          <div className="h-5 w-36 bg-rule/30 rounded animate-pulse" />
        </div>
        <div className="mx-5 p-5 border border-rule bg-parchment-light rounded-none mb-5">
          <div className="h-3 w-40 bg-rule/40 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            <div className="h-5 w-full bg-rule/30 rounded animate-pulse" />
            <div className="h-5 w-5/6 bg-rule/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-6">
          <div className="h-4 w-24 bg-rule/40 rounded animate-pulse mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-w-[168px] h-[140px] border border-rule bg-parchment-light animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-end justify-center pb-32">
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 bg-oxblood/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-oxblood/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-oxblood/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto no-scrollbar" style={{ background: 'var(--parchment)' }}>
      {/* ── Header ── */}
      <div className="px-6 pt-14 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CrossMark size={16} />
          <span className="font-garamond text-[19px] font-semibold text-ink">Emmaus</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-full flex items-center justify-center font-sans text-[11px] text-ink-mid"
          style={{ background: 'var(--vellum-dark)' }}
          aria-label="Settings"
        >
          {initials}
        </button>
      </div>

      {/* ── Greeting ── */}
      <div className="px-6 pt-3 pb-4">
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-oxblood mb-1.5">
          <Rubric>{[season, new Date().toLocaleDateString('en', { weekday: 'long' })].filter(Boolean).join(' · ')}</Rubric>
        </div>
        <h1 className="font-garamond text-[32px] leading-[1.08] font-medium text-ink m-0">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},
          <br />
          <em className="text-oxblood italic">{userName}</em>.
        </h1>
        <div className="font-ethiopic text-[17px] text-ink-mid mt-1">ሰላም ለአንተ ይሁን።</div>
        {celebration && (
          <div className="font-garamond italic text-[15px] text-ink-mid mt-2">{celebration}</div>
        )}
      </div>

      {offline && (
        <div className="mx-5 mb-4 p-4 font-garamond text-[15px] text-ink-mid" style={{ border: '1px solid var(--rule)' }} role="status">
          Couldn't load today's readings. Check your connection — the Bible and teaching sections may still open.
        </div>
      )}

      {/* ── Verse of the Day (Bible database) ── */}
      {verse && (
        <button
          type="button"
          onClick={() => openBibleRef?.(verse.ref)}
          className="mx-5 mb-4 p-5 relative text-left block"
          style={{ background: 'var(--cream)', border: '1px solid var(--rule)', width: 'calc(100% - 2.5rem)' }}
          aria-label={`Verse of the day, ${verse.reference}. Open in the reader.`}
        >
          <div className="absolute top-0 left-0 w-[3px] h-7" style={{ background: 'var(--oxblood)' }} />
          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-2.5">
            Verse of the day · {verse.reference}
          </div>
          <div className="font-ethiopic text-[17px] leading-[1.55] text-ink">{verse.text}</div>
        </button>
      )}

      {/* ── Continue Reading (real position, shown once there is one) ── */}
      {lastRead && (
        <div className="px-6 pb-3">
          <div className="mb-2.5">
            <Rubric>Continue</Rubric>
          </div>
          <button
            type="button"
            onClick={() => openBibleRef?.({ book: lastRead.book, chapter: lastRead.chapter })}
            className="w-full py-3.5 flex items-center gap-3.5 text-left"
            style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}
          >
            <div
              className="w-11 h-14 flex items-center justify-center font-garamond text-[22px] text-ink"
              style={{ background: 'var(--vellum-dark)', borderLeft: '3px solid var(--oxblood)' }}
              aria-hidden="true"
            >
              {lastRead.chapter}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-ethiopic text-[17px] leading-[1.2] text-ink truncate">{lastRead.amharicName || lastRead.book}</div>
              <div className="font-garamond text-[14px] text-ink-mid mt-0.5">{`${lastRead.book} · chapter ${lastRead.chapter}`}</div>
            </div>
            <ChevronRight size={16} className="text-ink-soft" />
          </button>
        </div>
      )}

      {/* ── Teaching Section ── */}
      <div className="px-6 pt-2.5 pb-2">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-garamond text-[22px] font-medium m-0">
            Teaching{' '}
            <span className="font-ethiopic text-ink-mid text-[18px]">· ትምህርት</span>
          </h2>
          <button type="button" onClick={onOpenTeaching} className="font-mono text-[10px] text-ink-soft py-2 pl-3">All ›</button>
        </div>
      </div>

      <div className="pl-6 flex gap-3 overflow-x-auto no-scrollbar pb-5 flex-shrink-0">
        {TEACHING_CHAPTERS.map((c) => (
          <button
            type="button"
            key={c.slug}
            onClick={onOpenTeaching}
            className="min-w-[168px] p-4 pt-4 pb-3.5 relative flex-shrink-0 text-left"
            style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-[22px]" style={{ background: c.color }} />
            <div className="font-mono text-[9px] text-ink-soft tracking-[0.14em] uppercase">Part {c.part}</div>
            <div className="font-garamond text-[22px] font-medium leading-[1.05] mt-1.5">{c.en}</div>
            <div className="font-ethiopic text-[17px] text-ink-mid mt-0.5">{c.am}</div>
            <div className="font-mono text-[9px] text-ink-soft mt-3.5 tracking-[0.1em]">Q {c.q}</div>
          </button>
        ))}
      </div>

      <div className="px-6 py-2">
        <Ornament w={140} />
      </div>

      {/* ── Today's Readings (lectionary table) ── */}
      {readings.length > 0 && (
        <div className="px-6 pb-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-garamond text-[22px] font-medium m-0">
              Readings{' '}
              <span className="font-ethiopic text-ink-mid text-[18px]">· ንባብ</span>
            </h2>
            <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
              {daily?.roman.verified ? `${readings.length} passages` : 'unverified'}
            </div>
          </div>

          <div className="space-y-0 divide-y" style={{ borderTop: '1px solid var(--rule)', borderColor: 'var(--rule)' }}>
            {readings.map((reading, idx) => {
              const canOpen = !!(reading.book && reading.chapter && openBibleRef);
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => openReading(reading)}
                  disabled={!canOpen}
                  className="w-full py-3 flex items-center gap-3 text-left disabled:cursor-default"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <div className="flex items-center">
                    <CrossMark size={11} color="#B68530" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-garamond text-[15px] font-medium">{reading.citation}</div>
                    <div className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.12em] mt-0.5">
                      {reading.label} · <span className="font-ethiopic normal-case tracking-normal">{reading.labelAm}</span>
                    </div>
                  </div>
                  {canOpen && <ChevronRight size={14} className="text-ink-soft" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Reflection (AI-written, and labelled so) ── */}
      {reflection ? (
        <div className="px-6 pb-32">
          <div className="font-sans text-[11px] tracking-[0.18em] uppercase text-ink-soft font-medium mb-3">
            <Rubric>§ Today's Reflection</Rubric>
          </div>
          <div className="p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
            <div className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.14em] mb-2">
              AI-generated reflection · not a homily
            </div>
            <h3 className="font-garamond text-[22px] font-medium leading-tight mb-3 text-ink">
              {reflection.title}
            </h3>
            <p className="font-ethiopic text-[16px] leading-[1.7] text-ink m-0 whitespace-pre-line">
              {isReflectionExpanded || reflection.content.length <= 200
                ? reflection.content
                : `${reflection.content.substring(0, 200)}…`}
            </p>
            {reflection.content.length > 200 && (
              <button
                type="button"
                onClick={() => setIsReflectionExpanded(!isReflectionExpanded)}
                className="mt-4 py-2 font-mono text-[10px] text-oxblood uppercase tracking-[0.14em] flex items-center gap-1"
                aria-expanded={isReflectionExpanded}
              >
                {isReflectionExpanded ? 'Show less' : 'Read more'}
                {isReflectionExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pb-32" />
      )}
    </div>
  );
};

export default DailyDevotion;
