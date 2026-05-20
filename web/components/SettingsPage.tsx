import React from 'react';
import { View } from '../types';
import { ROLES, ALL_INTERESTS } from '../constants';
import { useProfileEditor } from '../hooks/useProfileEditor';
import { BookOpen, ChevronRight, LogOut, Pencil, Check, X } from 'lucide-react';
import { Ornament, Rubric, Meta, SectionLabel } from './ui/ManuscriptPrimitives';

interface SettingsPageProps {
  setView: (view: View) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ setView }) => {
  const {
    profile, editingName, setEditingName, nameValue, setNameValue,
    updateProfile, toggleInterest, saveName, handleReset, roleInfo,
  } = useProfileEditor();

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
        <p className="text-ink-soft font-garamond text-lg italic">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto text-ink pb-32" style={{ background: 'var(--parchment)' }}>
      <div className="max-w-2xl mx-auto px-6 pt-14 space-y-0">

        {/* Profile header */}
        <div className="flex items-start gap-5 mb-8">
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

        {/* Role */}
        <div className="mt-8 mb-8">
          <SectionLabel>Role</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = profile.role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => updateProfile({ role: r.id })}
                  className={`text-left py-3 px-4 transition-all ${
                    active
                      ? 'border-oxblood text-ink'
                      : 'border-rule text-ink-mid hover:border-ink-soft'
                  }`}
                  style={{
                    background: active ? 'var(--cream)' : 'transparent',
                    border: `1px solid ${active ? 'var(--oxblood)' : 'var(--rule)'}`,
                  }}
                >
                  <div className="font-garamond text-[15px] font-medium">{r.label}</div>
                  <div className="font-ethiopic text-[13px] text-ink-soft">{r.am}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interests */}
        <div className="mb-8">
          <SectionLabel>Interests</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {ALL_INTERESTS.map((interest) => {
              const active = profile.interests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3.5 py-1.5 font-sans text-[13px] transition-all ${
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

        {/* Tools */}
        <div className="mt-8 mb-8">
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

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        {/* About */}
        <div className="mt-8 mb-6">
          <SectionLabel>About</SectionLabel>
          <div className="space-y-1.5">
            <Meta k="App" v="Emmaus · ኤማዉስ" />
            <Meta k="Version" v="0.2.0" />
            <Meta k="Source" v="Amharic Catholic Bible (Emmaus Edition)" />
            <Meta k="Teaching" v="Compendium of the Catechism" />
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        {/* Reset */}
        <div className="mt-8 pb-8">
          <button
            onClick={handleReset}
            className="flex items-center gap-2.5 font-sans text-[13px] text-ink-soft hover:text-red-600 transition-colors"
          >
            <LogOut size={15} />
            Reset all data & restart onboarding
          </button>
        </div>
      </div>
    </div>
  );
};
