import React, { useState, useEffect, useCallback } from 'react';
import { View } from '../../types';
import { ROLES, ALL_INTERESTS } from '../../constants';
import { useProfileEditor } from '../../hooks/useProfileEditor';
import { BookOpen, ChevronRight, LogOut, Pencil, Check, X, Info, Palette, Shield, CalendarDays, Plus, Trash2, Loader2 } from 'lucide-react';
import { Ornament, Rubric, Meta, SectionLabel } from '../ui/ManuscriptPrimitives';
import { readingsApi, DailyReading } from '../../services/apiClient';

interface DesktopSettingsProps {
  setView: (view: View) => void;
}

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: Pencil },
  { id: 'role', label: 'Role', icon: Shield },
  { id: 'interests', label: 'Interests', icon: Palette },
  { id: 'readings', label: 'Daily Readings', icon: CalendarDays },
  { id: 'tools', label: 'Tools', icon: BookOpen },
  { id: 'about', label: 'About', icon: Info },
];

const READING_TYPES: { value: string; label: string }[] = [
  { value: 'first', label: 'First Reading · መጀመሪያ ንባብ' },
  { value: 'psalm', label: 'Responsorial Psalm · መዝሙር' },
  { value: 'second', label: 'Second Reading · ሁለተኛ ንባብ' },
  { value: 'gospel', label: 'Gospel · ወንጌል' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Admin panel: review, correct, and verify the (mostly AI/lectionary-sourced,
 *  unverified) daily Mass readings before they're trusted on the home page. */
const DailyReadingsPanel: React.FC = () => {
  const [date, setDate] = useState(todayIso());
  const [rite, setRite] = useState<'roman' | 'geez'>('roman');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [liturgicalLabel, setLiturgicalLabel] = useState('');
  const [celebration, setCelebration] = useState('');
  const [source, setSource] = useState('');
  const [wasVerified, setWasVerified] = useState(false);
  const [rows, setRows] = useState<{ type: string; citation: string }[]>([]);

  const load = useCallback((d: string, r: 'roman' | 'geez') => {
    setLoading(true);
    setSaveMsg('');
    setSaveErr('');
    readingsApi.get(d)
      .then((data) => {
        const rd = data[r];
        setLiturgicalLabel(
          r === 'roman'
            ? (rd.liturgical?.celebration?.nameAm ?? rd.liturgical?.dayName ?? '')
            : (rd.liturgical?.ethDateAm ?? '')
        );
        setCelebration(rd.celebration ?? '');
        setSource(rd.source ?? '');
        setWasVerified(rd.verified === true);
        setRows(
          (rd.readings ?? []).map((x: DailyReading) => ({ type: x.type, citation: x.citation }))
        );
      })
      .catch(() => {
        setLiturgicalLabel('');
        setCelebration('');
        setSource('');
        setWasVerified(false);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date, rite); }, [date, rite, load]);

  const updateRow = (i: number, field: 'type' | 'citation', value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setRows((prev) => [...prev, { type: 'first', citation: '' }]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    setSaveErr('');
    try {
      const cleanRows = rows.filter((r) => r.citation.trim().length > 0);
      await readingsApi.update(date, {
        rite,
        celebration: celebration.trim() || null,
        readings: cleanRows,
        verified: true,
        source: 'manual',
      });
      setSaveMsg('Saved and marked verified.');
      setSource('manual');
      setWasVerified(true);
    } catch (e: any) {
      setSaveErr(e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-[13px] text-ink bg-transparent outline-none focus:border-oxblood/50 transition-colors';
  const inputStyle = { background: 'var(--parchment)', border: '1px solid var(--rule)' };

  return (
    <div className="mt-8 mb-8" id="readings">
      <SectionLabel>Daily Readings</SectionLabel>
      <p className="font-sans text-[12px] text-ink-soft mb-4 -mt-1">
        Review, correct, and verify the Mass readings shown on the home page. Most days are
        imported from a lectionary dataset or an AI lookup and start unverified.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 font-mono text-[13px] text-ink outline-none"
          style={inputStyle}
        />
        <div className="flex gap-1">
          {(['roman', 'geez'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRite(r)}
              className={`px-3 py-2 font-mono text-[11px] tracking-wide border transition-colors ${
                rite === r ? 'bg-oxblood text-parchment border-oxblood' : 'border-rule text-ink-mid hover:border-ink-soft'
              }`}
            >
              {r === 'roman' ? 'ላቲን · Roman' : 'ግዕዝ · Geʽez'}
            </button>
          ))}
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-ink-soft" />}

        <div className="ml-auto flex items-center gap-2">
          {wasVerified ? (
            <span className="font-mono text-[10px] px-2 py-1 rounded-sm" style={{ background: 'rgba(60,120,60,0.12)', color: '#3a6b3a' }}>
              ✓ verified{source ? ` · ${source}` : ''}
            </span>
          ) : (
            <span className="font-mono text-[10px] px-2 py-1 rounded-sm text-ochre" style={{ background: 'rgba(182,133,48,0.1)' }}>
              ያልተረጋገጠ · unverified{source ? ` · ${source}` : ''}
            </span>
          )}
        </div>
      </div>

      {liturgicalLabel && (
        <div className="font-ethiopic text-[13px] text-ink-mid mb-3">{liturgicalLabel}</div>
      )}

      <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-soft mb-1">
        Celebration / label
      </label>
      <input
        value={celebration}
        onChange={(e) => setCelebration(e.target.value)}
        placeholder="e.g. Feast of St Thomas the Apostle"
        className={`${inputCls} mb-4`}
        style={inputStyle}
      />

      <div className="space-y-2 mb-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={row.type}
              onChange={(e) => updateRow(i, 'type', e.target.value)}
              className="px-2 py-2 font-sans text-[12px] text-ink outline-none w-[220px] shrink-0"
              style={inputStyle}
            >
              {READING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              value={row.citation}
              onChange={(e) => updateRow(i, 'citation', e.target.value)}
              placeholder="e.g. Ephesians 2:19-22"
              className={inputCls}
              style={inputStyle}
            />
            <button
              onClick={() => removeRow(i)}
              className="p-2 text-ink-soft hover:text-oxblood transition-colors shrink-0"
              title="Remove reading"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 font-mono text-[11px] text-ink-soft hover:text-oxblood transition-colors mb-5"
      >
        <Plus size={13} /> Add reading
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || rows.every((r) => !r.citation.trim())}
          className="px-4 py-2 rounded-lg bg-oxblood text-parchment text-[13px] font-bold disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save as verified'}
        </button>
        {saveMsg && <p className="font-sans text-[12px] text-green-700">{saveMsg}</p>}
        {saveErr && <p className="font-sans text-[12px] text-red-500">{saveErr}</p>}
      </div>
    </div>
  );
};

export const DesktopSettings: React.FC<DesktopSettingsProps> = ({ setView }) => {
  const {
    profile, editingName, setEditingName, nameValue, setNameValue,
    updateProfile, toggleInterest, saveName, handleReset, roleInfo,
  } = useProfileEditor();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
        <p className="text-ink-soft font-garamond text-lg italic">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '260px 1fr 320px' }}>
      {/* Left rail: section nav */}
      <aside className="border-r border-rule px-6 py-7 overflow-y-auto">
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4">
          Settings
        </div>

        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className="w-full flex items-center gap-3 py-2.5 px-3 mb-1 text-left text-ink-mid hover:text-ink transition-all"
          >
            <item.icon size={15} className="text-ink-soft" />
            <span className="font-garamond text-[14px] font-medium">{item.label}</span>
          </button>
        ))}

        <div className="h-px my-5" style={{ background: 'var(--rule)' }} />

        <div className="flex items-center gap-3 px-3">
          <div
            className="w-10 h-10 rounded-full grid place-items-center shrink-0"
            style={{ background: 'var(--vellum-dark)', border: '1.5px solid var(--rule)' }}
          >
            <span className="font-garamond text-lg font-semibold text-ink">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-garamond text-[14px] font-medium truncate">{profile.name}</div>
            <div className="font-mono text-[10px] text-ink-soft uppercase tracking-wider">
              {roleInfo.label}
            </div>
          </div>
        </div>

        <div className="h-px my-5" style={{ background: 'var(--rule)' }} />

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 font-mono text-[11px] text-ink-soft hover:text-red-600 transition-colors"
        >
          <LogOut size={13} />
          Reset all data
        </button>
      </aside>

      {/* Center: main content */}
      <div className="overflow-y-auto px-10 py-8">
        <div className="flex items-start gap-5 mb-6" id="profile">
          <div
            className="w-16 h-16 rounded-full grid place-items-center shrink-0"
            style={{ background: 'var(--vellum-dark)', border: '2px solid var(--rule)' }}
          >
            <span className="font-garamond text-2xl font-semibold text-ink">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="font-garamond text-[28px] font-medium bg-transparent border-b-2 border-oxblood outline-none w-full text-ink"
                />
                <button onClick={saveName} className="text-oxblood"><Check size={18} /></button>
                <button onClick={() => setEditingName(false)} className="text-ink-soft"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-baseline gap-2.5">
                <h1 className="font-garamond text-[28px] font-medium leading-tight">{profile.name}</h1>
                <button onClick={() => setEditingName(true)} className="text-ink-soft hover:text-oxblood transition-colors">
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft mt-1">
              {roleInfo.label} · {roleInfo.am}
            </div>
          </div>
        </div>

        <Ornament w={120} />

        <div className="mt-8 mb-8" id="role">
          <SectionLabel>Role</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => {
              const active = profile.role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => updateProfile({ role: r.id })}
                  className={`text-left py-3 px-4 transition-all ${
                    active ? 'text-ink' : 'text-ink-mid hover:text-ink'
                  }`}
                  style={{
                    background: active ? 'var(--cream)' : 'transparent',
                    border: `1px solid ${active ? 'var(--oxblood)' : 'var(--rule)'}`,
                  }}
                >
                  <div className="font-garamond text-[15px] font-medium">{r.label}</div>
                  <div className="font-ethiopic text-[13px] text-ink-soft">{r.am}</div>
                  <div className="font-mono text-[10px] text-ink-soft mt-1">{r.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8" id="interests">
          <SectionLabel>Interests</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {ALL_INTERESTS.map((interest) => {
              const active = profile.interests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-4 py-2 font-sans text-[13px] transition-all ${
                    active ? 'text-parchment' : 'text-ink-mid hover:text-ink'
                  }`}
                  style={{
                    background: active ? 'var(--oxblood)' : 'transparent',
                    border: `1px solid ${active ? 'var(--oxblood)' : 'var(--rule)'}`,
                  }}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        <DailyReadingsPanel />

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        <div className="mt-8 mb-8" id="tools">
          <SectionLabel>Tools</SectionLabel>
          <button
            onClick={() => setView(View.CONTENT_EDITOR)}
            className="w-full flex items-center gap-4 p-4 text-left group transition-colors"
            style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}
          >
            <div
              className="w-10 h-10 rounded-full grid place-items-center shrink-0"
              style={{ background: 'var(--parchment)', border: '1px solid var(--rule)' }}
            >
              <BookOpen size={18} className="text-oxblood" />
            </div>
            <div className="flex-1">
              <div className="font-garamond text-[16px] font-medium group-hover:text-oxblood transition-colors">
                Bible Content Editor
              </div>
              <div className="font-sans text-[12px] text-ink-soft">
                Manage books, chapters, proofread content
              </div>
            </div>
            <ChevronRight size={16} className="text-ink-soft" />
          </button>
        </div>
      </div>

      {/* Right rail: about & info */}
      <aside
        className="border-l border-rule px-7 py-8 overflow-y-auto"
        style={{ background: 'var(--cream)' }}
        id="about"
      >
        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4">
          About
        </div>

        <div className="space-y-2 mb-6">
          <Meta k="App" v="Emmaus · ኤማዉስ" />
          <Meta k="Version" v="0.2.0" />
          <Meta k="Source" v="Amharic Catholic Bible (Emmaus Edition)" />
          <Meta k="Teaching" v="Compendium of the Catechism" />
        </div>

        <div className="h-px mb-6" style={{ background: 'var(--rule)' }} />

        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4">
          Your Profile
        </div>

        <div className="space-y-2 mb-6">
          <Meta k="Name" v={profile.name} />
          <Meta k="Role" v={`${roleInfo.label} (${roleInfo.am})`} />
          <Meta k="Interests" v={profile.interests.length > 0 ? profile.interests.join(', ') : 'None selected'} />
        </div>

        <div className="h-px mb-6" style={{ background: 'var(--rule)' }} />

        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-4">
          AI Personalization
        </div>

        <p className="font-garamond text-[14px] text-ink-mid leading-relaxed mb-4">
          Your role and interests help the AI assistant give more relevant spiritual guidance. A priest gets pastoral depth, a student gets foundational explanations.
        </p>

        <div className="h-px mb-6" style={{ background: 'var(--rule)' }} />

        <div className="font-sans text-[10px] tracking-[0.14em] uppercase text-ink-soft mb-3">
          Keyboard Shortcuts
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="px-1.5 py-0.5 border border-rule rounded-sm text-[10px] text-ink-soft bg-parchment min-w-[32px] text-center">
            ⌘K
          </span>
          <span className="text-ink-mid">Search palette</span>
        </div>
      </aside>
    </div>
  );
};
