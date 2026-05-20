import React from 'react';
import { View } from '../../types';
import { ROLES, ALL_INTERESTS } from '../../constants';
import { useProfileEditor } from '../../hooks/useProfileEditor';
import { BookOpen, ChevronRight, LogOut, Pencil, Check, X, Info, Palette, Shield } from 'lucide-react';
import { Ornament, Rubric, Meta, SectionLabel } from '../ui/ManuscriptPrimitives';

interface DesktopSettingsProps {
  setView: (view: View) => void;
}

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: Pencil },
  { id: 'role', label: 'Role', icon: Shield },
  { id: 'interests', label: 'Interests', icon: Palette },
  { id: 'tools', label: 'Tools', icon: BookOpen },
  { id: 'about', label: 'About', icon: Info },
];

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
