import React, { useState, useEffect } from 'react';
import { View } from '../../types';
import { Ornament, Rubric, CrossMark } from '../ui/ManuscriptPrimitives';
import { wikiApi, WikiPageListItem } from '../../services/apiClient';
import { getDailyMassReadings } from '../../services/geminiService';
import { DailyMassContent } from '../../types';

/* Compendium parts — static structure with first teaching slug for navigation */
const PARTS = [
  { num: 'I',   label: 'Profession of Faith', am: 'የእምነት ምስክርነት',   slug: 'faith-and-revelation' },
  { num: 'II',  label: 'Sacraments',           am: 'ምሥጢራት',          slug: 'sacramental-order' },
  { num: 'III', label: 'Life in Christ',       am: 'ሕይወት በክርስቶስ',  slug: 'human-dignity' },
  { num: 'IV',  label: 'Prayer',               am: 'ጸሎት',             slug: 'prayer-in-christian-life' },
];

const PART_COLORS = ['var(--oxblood)', 'var(--ochre)', 'var(--teal, #2C4A52)', 'var(--oxblood)'];

interface DesktopHomeProps {
  setView: (view: View) => void;
  openWikiPage: (slug: string) => void;
}

export const DesktopHome: React.FC<DesktopHomeProps> = ({ setView, openWikiPage }) => {
  const [teachings, setTeachings] = useState<WikiPageListItem[]>([]);
  const [concepts, setConcepts] = useState<WikiPageListItem[]>([]);
  const [liturgy, setLiturgy] = useState<WikiPageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyMassContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      wikiApi.list('teaching').catch(() => []),
      wikiApi.list('concept').catch(() => []),
      wikiApi.list('liturgical').catch(() => []),
      getDailyMassReadings(new Date()).catch(() => null),
    ]).then(([t, c, lit, d]) => {
      if (cancelled) return;
      setTeachings(t);
      setConcepts(c);
      setLiturgy(lit);
      setDaily(d);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const verse = daily?.readings?.[0];
  const verseText = verse ? verse.text.split(/[።፡]/)[0] + '።' : '';

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '260px 1fr 300px' }}>
      {/* ── Left rail ── */}
      <aside className="border-r border-rule px-6 py-7 overflow-y-auto">
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3.5">
          The Compendium
        </div>
        {PARTS.map((p, i) => (
          <div
            key={p.num}
            onClick={() => openWikiPage(p.slug)}
            className={`flex items-baseline gap-3 py-2.5 cursor-pointer hover:bg-parchment-dark transition-colors ${i < 3 ? 'border-b border-dashed border-rule' : ''}`}
          >
            <span className="font-mono text-[10px] text-oxblood w-[22px]">{p.num}</span>
            <div className="flex-1">
              <div className="font-garamond text-[15px] font-medium">{p.label}</div>
              <div className="font-ethiopic text-[13px] text-ink-mid">{p.am}</div>
            </div>
          </div>
        ))}

        {/* Liturgical week */}
        {daily && (
          <>
            <div className="mt-9 font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3.5">
              Today
            </div>
            <div className="font-garamond text-sm leading-relaxed">
              <div className="flex gap-2.5 mb-2.5">
                <div className="w-1 bg-oxblood rounded-sm" />
                <div>
                  <div className="font-ethiopic text-sm">{daily.liturgicalFeast}</div>
                  <div className="font-mono text-[10px] text-ink-soft">{daily.date}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── Center ── */}
      <main className="px-14 py-10 overflow-y-auto">
        {/* Hero */}
        <div className="flex items-end gap-8 mb-9">
          <div className="flex-1">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase mb-3">
              <Rubric>{'Vol. I  ·  Eastertide  ·  Anno Domini ⅯⅯⅩⅩⅥ'}</Rubric>
            </div>
            <h1 className="font-ethiopic font-medium text-[60px] leading-[1.05] m-0">
              {'ከመጽሐፍ ቅዱስ '}<span className="text-oxblood">{'እስከ'}</span>{' ቅዳሴ።'}
            </h1>
            <div className="font-garamond text-[34px] leading-[1.04] mt-2 text-ink-mid -tracking-[0.015em]">
              An Amharic-first <em className="text-oxblood italic">Catholic</em> wiki
            </div>
          </div>
          <div className="w-[220px] font-sans text-xs text-ink-mid leading-relaxed pb-2">
            Seeded by the Amharic Compendium of the Catechism — <Rubric>{teachings.length || '…'} teaching pages</Rubric> linked to Scripture, concepts, and the Ethiopian liturgical year.
          </div>
        </div>

        <Ornament w={140} />

        {/* Teaching grid — real data */}
        <div className="flex items-baseline justify-between mt-8 mb-4">
          <h2 className="font-ethiopic font-medium text-[22px] m-0">
            {'ትምህርት'} <span className="font-garamond text-ink-mid">· Teaching</span>
          </h2>
          <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
            {teachings.length} pages
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-5 pb-4 border border-rule min-h-[156px] animate-pulse" style={{ background: 'var(--cream)' }}>
                <div className="h-3 w-20 bg-rule/40 rounded mb-3" />
                <div className="h-7 w-32 bg-rule/50 rounded mb-2" />
                <div className="h-5 w-24 bg-rule/30 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {teachings.slice(0, 9).map((t, i) => (
              <div
                key={t.slug}
                onClick={() => openWikiPage(t.slug)}
                className="relative p-5 pb-4 border border-rule min-h-[156px] cursor-pointer hover:border-ink-soft transition-colors"
                style={{ background: 'var(--cream)' }}
              >
                <div
                  className="absolute top-0 left-0 w-[3px] h-7"
                  style={{ background: PART_COLORS[i % PART_COLORS.length] }}
                />
                <div className="font-mono text-[9px] tracking-[0.16em] text-ink-soft uppercase mb-2.5">
                  {t.page_type} {t.compendium_q ? `· Q ${t.compendium_q}` : ''}
                </div>
                <div className="font-ethiopic text-[26px] leading-[1.12] font-medium">
                  {t.title_am || t.title_en || t.slug}
                </div>
                {t.title_am && t.title_en && (
                  <div className="font-garamond text-[19px] italic text-ink-mid mt-1 leading-[1.05]">{t.title_en}</div>
                )}
                <div className="absolute bottom-3.5 left-5 right-5 flex justify-between font-mono text-[9px] text-ink-soft">
                  <span>{t.sources ? `${t.sources} sources` : ''}</span>
                  <span className="hover:text-oxblood transition-colors">{'READ →'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Concepts row — real data */}
        {concepts.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-10 mb-3.5">
              <h2 className="font-ethiopic font-medium text-[22px] m-0">
                {'ፅንሰ ሐሳቦች'} <span className="font-garamond text-ink-mid">· Concepts</span>
              </h2>
              <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
                {concepts.length} entries
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-rule">
              {concepts.slice(0, 6).map((c, i) => (
                <div
                  key={c.slug}
                  onClick={() => openWikiPage(c.slug)}
                  className={`py-3.5 flex items-baseline gap-3.5 cursor-pointer hover:bg-parchment-dark transition-colors ${
                    (i % 3) !== 2 ? 'border-r border-rule' : ''
                  } border-b border-rule`}
                  style={{ paddingLeft: (i % 3) === 0 ? 0 : 18, paddingRight: (i % 3) === 2 ? 0 : 18 }}
                >
                  <div className="font-ethiopic text-2xl text-ink min-w-[90px]">{c.title_am || c.slug}</div>
                  <div className="flex-1">
                    <div className="font-garamond text-[15px] italic">{c.title_en || c.slug}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Liturgy — the Mass, prayers, feasts, and seasons of the Ethiopian
            liturgical year. Surfaced from wiki/liturgical/. */}
        {liturgy.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-12 mb-1.5">
              <h2 className="font-ethiopic font-medium text-[22px] m-0">
                {'አምልኮና ጸሎት'} <span className="font-garamond text-ink-mid">· Liturgy</span>
              </h2>
              <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
                {liturgy.length} pages
              </div>
            </div>
            <div className="font-garamond text-[13px] italic text-ink-soft mb-3.5 max-w-[640px] leading-snug">
              የቅዳሴ ስርዓት፣ ጸሎቶች፣ በዓላትና የቤተክርስቲያን ወቅቶች።
              <span className="not-italic text-ink-soft/80"> — The Mass, prayers, feasts, and seasons of the Ethiopian liturgical year.</span>
            </div>
            <div className="grid grid-cols-3 border-t border-rule">
              {liturgy.map((c, i) => (
                <div
                  key={c.slug}
                  onClick={() => openWikiPage(c.slug)}
                  className={`py-3.5 flex items-baseline gap-3.5 cursor-pointer hover:bg-parchment-dark transition-colors ${
                    (i % 3) !== 2 ? 'border-r border-rule' : ''
                  } border-b border-rule`}
                  style={{ paddingLeft: (i % 3) === 0 ? 0 : 18, paddingRight: (i % 3) === 2 ? 0 : 18 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-ethiopic text-[18px] leading-[1.2] text-ink truncate">{c.title_am || c.title_en || c.slug}</div>
                    {c.title_en && (
                      <div className="font-garamond text-[13px] italic text-ink-mid truncate">{c.title_en}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Right rail ── */}
      <aside className="border-l border-rule px-7 py-8 overflow-y-auto" style={{ background: 'var(--cream)' }}>
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3.5">
          Verse of the day
        </div>
        {verse ? (
          <>
            <div className="font-ethiopic text-[19px] leading-[1.6] text-ink">
              {verseText.length > 200 ? verseText.substring(0, 200) + '…' : verseText}
            </div>
            <div className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em] mt-3.5">
              {verse.reference}
            </div>
          </>
        ) : (
          <div className="font-ethiopic text-[19px] leading-[1.6] text-ink-soft animate-pulse">
            Loading…
          </div>
        )}

        <div className="h-px bg-rule my-7" />

        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3.5">
          Content status
        </div>
        <div className="font-mono text-[11px] leading-8 text-ink-mid">
          <div className="flex justify-between">
            <span>Teaching pages</span><span className="text-ink">{teachings.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Concepts</span><span className="text-ink">{concepts.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Liturgy</span><span className="text-ink">{liturgy.length}</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
