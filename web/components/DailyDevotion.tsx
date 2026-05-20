import React, { useEffect, useState, useRef } from 'react';
import { getDailyMassReadings } from '../services/geminiService';
import { getUserProfile } from '../services/storageService';
import { DailyMassContent } from '../types';
import { ChevronRight, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useFooter } from '../App';
import { useScrollHideFooter } from '../hooks/useScrollHideFooter';
import { CrossMark, Ornament, Rubric } from './ui/ManuscriptPrimitives';

/* ── sample teaching cards (matches design) ── */
const TEACHING_CHAPTERS = [
  { slug: 'baptism', en: 'Baptism', am: 'ጥምቀት', part: 'II', q: '252–264', color: '#7A2522' },
  { slug: 'confirmation', en: 'Confirmation', am: 'ሜሮን', part: 'II', q: '265–270', color: '#B68530' },
  { slug: 'eucharist', en: 'Eucharist', am: 'ቁርባን', part: 'II', q: '271–294', color: '#7A2522' },
  { slug: 'penance', en: 'Penance', am: 'ንስሐ', part: 'II', q: '295–312', color: '#2C4A52' },
];

interface DailyDevotionProps {
  onOpenSettings?: () => void;
}

export const DailyDevotion: React.FC<DailyDevotionProps> = ({ onOpenSettings }) => {
  const [data, setData] = useState<DailyMassContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReflectionExpanded, setIsReflectionExpanded] = useState(false);

  const { setHideFooter } = useFooter();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHideFooter(setHideFooter, scrollRef);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      const result = await getDailyMassReadings(new Date());
      setData(result);
      setLoading(false);
    };
    fetchContent();
  }, []);

  const getVerseOfDay = () => {
    if (!data?.readings?.[0]) return null;
    const reading = data.readings[0];
    const text = reading.text.split(/[።፡]/)[0] + '።';
    return {
      reference: reading.reference,
      text: text.length > 200 ? text.substring(0, 200) + '...' : text,
    };
  };

  const verse = getVerseOfDay();
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
          <Rubric>Eastertide · {new Date().toLocaleDateString('en', { weekday: 'long' })}</Rubric>
        </div>
        <h1 className="font-garamond text-[32px] leading-[1.08] font-medium text-ink m-0">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},
          <br />
          <em className="text-oxblood italic">{userName}</em>.
        </h1>
        <div className="font-ethiopic text-[17px] text-ink-mid mt-1">ሰላም ለአንተ ይሁን።</div>
      </div>

      {/* ── Verse of the Day Card ── */}
      <div
        className="mx-5 mb-4 p-5 relative"
        style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}
      >
        <div className="absolute top-0 left-0 w-[3px] h-7" style={{ background: 'var(--oxblood)' }} />
        <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-2.5">
          Verse of the day · {verse?.reference || 'ዮሐንስ 1:16'}
        </div>
        <div className="font-ethiopic text-[17px] leading-[1.55] text-ink">
          {verse?.text || (
            <>
              «ከእርሱ ሙላት ሁላችን ተቀብለናል፣{' '}
              <span className="text-oxblood">ጸጋ በጸጋ ላይ።»</span>
            </>
          )}
        </div>
        {!verse && (
          <div className="font-garamond italic text-ink-mid mt-2 text-[13px] leading-[1.45]">
            "From his fullness we have all received, grace upon grace."
          </div>
        )}
      </div>

      {/* ── Continue Reading ── */}
      <div className="px-6 pb-3">
        <div className="flex justify-between items-baseline mb-2.5">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase text-ink-soft">
            <Rubric>Continue</Rubric>
          </div>
          <div className="font-mono text-[10px] text-ink-soft">62%</div>
        </div>
        <div
          className="py-3.5 flex items-center gap-3.5"
          style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}
        >
          <div
            className="w-11 h-14 flex items-center justify-center font-ethiopic text-[26px] text-ink"
            style={{ background: 'var(--vellum-dark)', borderLeft: '3px solid var(--oxblood)' }}
          >
            ቁ
          </div>
          <div className="flex-1">
            <div className="font-garamond text-[19px] font-medium leading-[1.1]">The Eucharist</div>
            <div className="font-ethiopic text-[14px] text-ink-mid mt-0.5">ቁርባን · Q 271–294</div>
          </div>
          <ChevronRight size={16} className="text-ink-soft" />
        </div>
      </div>

      {/* ── Teaching Section ── */}
      <div className="px-6 pt-2.5 pb-2">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-garamond text-[22px] font-medium m-0">
            Teaching{' '}
            <span className="font-ethiopic text-ink-mid text-[18px]">· ትምህርት</span>
          </h2>
          <div className="font-mono text-[10px] text-ink-soft">All ›</div>
        </div>
      </div>

      <div className="pl-6 flex gap-3 overflow-x-auto no-scrollbar pb-5">
        {TEACHING_CHAPTERS.map((c) => (
          <div
            key={c.slug}
            className="min-w-[168px] p-4 pt-4 pb-3.5 relative flex-shrink-0"
            style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-[22px]" style={{ background: c.color }} />
            <div className="font-mono text-[9px] text-ink-soft tracking-[0.14em] uppercase">Part {c.part}</div>
            <div className="font-garamond text-[22px] font-medium leading-[1.05] mt-1.5">{c.en}</div>
            <div className="font-ethiopic text-[17px] text-ink-mid mt-0.5">{c.am}</div>
            <div className="font-mono text-[9px] text-ink-soft mt-3.5 tracking-[0.1em]">Q {c.q}</div>
          </div>
        ))}
      </div>

      <div className="px-6 py-2">
        <Ornament w={140} />
      </div>

      {/* ── Today's Readings Section ── */}
      {data?.readings && data.readings.length > 0 && (
        <div className="px-6 pb-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-garamond text-[22px] font-medium m-0">
              Readings{' '}
              <span className="font-ethiopic text-ink-mid text-[18px]">· ንባብ</span>
            </h2>
            <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
              {data.readings.length} passages
            </div>
          </div>

          <div className="space-y-0 divide-y" style={{ borderTop: '1px solid var(--rule)', borderColor: 'var(--rule)' }}>
            {data.readings.map((reading, idx) => (
              <div
                key={idx}
                className="py-3 flex items-center gap-3 cursor-pointer"
                style={{ borderColor: 'var(--rule)' }}
              >
                <div className="flex items-center">
                  <CrossMark size={11} color="#B68530" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-garamond text-[15px] font-medium">{reading.reference}</div>
                  <div className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.12em] mt-0.5">
                    {reading.type}
                  </div>
                </div>
                <ChevronRight size={14} className="text-ink-soft" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reflection ── */}
      {data?.reflection && (
        <div className="px-6 pb-32">
          <div className="font-sans text-[11px] tracking-[0.18em] uppercase text-ink-soft font-medium mb-3">
            <Rubric>§ Today's Reflection</Rubric>
          </div>
          <div className="p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
            <div className="font-mono text-[9px] text-ink-soft uppercase tracking-[0.14em] mb-2">
              {data.reflection.authorStyle || 'Daily Homily'}
            </div>
            <h3 className="font-garamond text-[22px] font-medium leading-tight mb-3 text-ink">
              {data.reflection.title}
            </h3>
            <p className="font-ethiopic text-[16px] leading-[1.7] text-ink m-0">
              {isReflectionExpanded
                ? data.reflection.content
                : `${data.reflection.content.substring(0, 200)}…`}
            </p>
            <button
              onClick={() => setIsReflectionExpanded(!isReflectionExpanded)}
              className="mt-4 font-mono text-[10px] text-oxblood uppercase tracking-[0.14em] flex items-center gap-1"
            >
              {isReflectionExpanded ? 'Show less' : 'Read more'}
              {isReflectionExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyDevotion;
