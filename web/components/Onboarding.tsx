import React, { useState } from 'react';
import { UserProfile } from '../types';
import { saveUserProfile } from '../services/storageService';
import { ChevronRight, User, School, Check, Sparkles, Heart } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserProfile['role'] | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const handleRoleSelect = (r: UserProfile['role']) => {
    setRole(r);
    setTimeout(() => setStep(3), 300); // Auto advance
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const finishSetup = () => {
    if (!role) return;

    const profile: UserProfile = {
      name: 'User', // Default, can edit later
      role: role,
      ageGroup: 'Adult', // Default
      interests: selectedInterests.length > 0 ? selectedInterests : ['Bible', 'Prayer']
    };

    saveUserProfile(profile);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: 'var(--parchment)' }}>
      {/* STEP 1: WELCOME / COVER ART */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center relative animate-in fade-in duration-700" style={{ background: 'var(--parchment)' }}>
           {/* Decorative Background Pattern */}
           <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
              <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%]" style={{ background: 'radial-gradient(circle at center, rgba(182,133,48,0.3), transparent)' }} />
              <div className="absolute top-10 left-10 text-ink/30 transform rotate-12 text-4xl">✥</div>
              <div className="absolute bottom-10 right-10 text-ink/30 transform -rotate-12 text-4xl">✥</div>
           </div>

           {/* ETHIOPIAN HOLY FAMILY IMAGE PLACEHOLDER */}
           <div className="relative w-80 h-80 mb-10 drop-shadow-2xl hover:scale-105 transition-transform duration-700">
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ border: '4px solid var(--ochre)', boxShadow: '0 0 40px rgba(182,133,48,0.2)', background: 'var(--cream)' }}>
                <img
                  src="/holy-famly.webp"
                  alt="Holy Family"
                  className="w-full h-full object-cover"
                />
              </div>
           </div>

           <div className="text-center z-10 px-8 max-w-md">
              <h1 className="text-5xl font-garamond font-black text-ink mb-2 tracking-tight">Emmaus</h1>
              <div className="font-ethiopic text-2xl text-ink-mid -mt-0.5 mb-3">ኤማዉስ</div>
              <div className="h-1 w-24 bg-oxblood mx-auto mb-6 rounded-full"></div>

              <p className="text-ink font-ethiopic font-bold text-lg mb-2 leading-relaxed">
                "ዓይኖቻቸውም ተከፈቱ አወቁትም።"
              </p>
              <p className="text-ink-soft font-garamond italic mb-10 text-sm">Luke 24:31 — Catholic Amharic Bible</p>

              <button
                onClick={() => setStep(2)}
                className="group flex items-center justify-center gap-3 bg-oxblood text-parchment px-10 py-4 rounded-full font-bold shadow-sm hover:bg-oxblood/90 transition-all active:scale-95 mx-auto"
              >
                Start Journey <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>
      )}

      {/* STEP 2: ROLE SELECTION */}
      {step === 2 && (
        <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-300 max-w-lg mx-auto w-full">
           <div className="mt-8 mb-8 text-center">
              <div className="inline-block p-3 rounded-full mb-4 text-oxblood" style={{ background: 'var(--cream)' }}>
                <User size={32} />
              </div>
              <h2 className="text-3xl font-garamond font-bold text-ink mb-2">Who are you?</h2>
              <p className="text-ink-soft">This helps the AI personalize your spiritual guidance.</p>
           </div>

           <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'Layperson', label: 'Layperson (ምዕመን)', icon: User, desc: 'Seeking daily spiritual growth' },
                { id: 'Student', label: 'Student (ተማሪ)', icon: School, desc: 'Learning the faith deeply' },
                { id: 'Priest', label: 'Priest (ካህን)', icon: CrossIcon, desc: 'Pastoral & Theological study' },
                { id: 'Nun', label: 'Nun (መነኩሲት)', icon: Heart, desc: 'Devotional & Mystical focus' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleRoleSelect(item.id as any)}
                  className="flex items-center gap-4 p-4 hover:shadow-sm transition-all text-left group"
                  style={{ background: 'var(--cream)', border: '1px solid var(--rule)', borderRadius: '0.75rem' }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-ink-mid group-hover:text-oxblood transition-colors" style={{ background: 'var(--parchment)' }}>
                     <item.icon size={24} />
                  </div>
                  <div>
                     <h3 className="font-bold text-ink text-lg font-garamond">{item.label}</h3>
                     <p className="text-xs text-ink-soft font-medium">{item.desc}</p>
                  </div>
                  <ChevronRight className="ml-auto text-ink-soft group-hover:text-oxblood" size={20} />
                </button>
              ))}
           </div>
        </div>
      )}

      {/* STEP 3: INTERESTS */}
      {step === 3 && (
        <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-300 max-w-lg mx-auto w-full">
           <div className="mt-8 mb-6 text-center">
              <div className="inline-block p-3 rounded-full mb-4 text-ochre" style={{ background: 'var(--cream)' }}>
                <Sparkles size={32} />
              </div>
              <h2 className="text-3xl font-garamond font-bold text-ink mb-2">Your Interests</h2>
              <p className="text-ink-soft">Select topics you love.</p>
           </div>

           <div className="grid grid-cols-2 gap-3 mb-8">
              {['Liturgy', 'Bible Study', 'Church History', 'Apologetics', 'Saints', 'Prayer', 'Canon Law', 'Geez'].map((item) => {
                 const isSelected = selectedInterests.includes(item);
                 return (
                    <button
                      key={item}
                      onClick={() => toggleInterest(item)}
                      className={`p-4 font-bold text-sm transition-all flex flex-col items-start gap-2 h-24 justify-between ${
                        isSelected
                        ? 'bg-oxblood text-parchment shadow-sm transform scale-[1.02]'
                        : 'text-ink-mid hover:bg-rule/30'
                      }`}
                      style={isSelected ? { border: '1px solid var(--oxblood)' } : { background: 'var(--cream)', border: '1px solid var(--rule)' }}
                    >
                       <div className="w-full flex justify-between items-start">
                          <Sparkles size={18} className={isSelected ? 'text-ochre' : 'text-ink-soft'} />
                          {isSelected && <div className="bg-ochre rounded-full p-0.5"><Check size={12} className="text-ink" /></div>}
                       </div>
                       <span className="text-lg">{item}</span>
                    </button>
                 );
              })}
           </div>

           <button
             onClick={finishSetup}
             className="w-full bg-oxblood text-parchment py-4 rounded-2xl font-bold shadow-sm hover:bg-oxblood/90 transition-all mt-auto mb-8 active:scale-95 text-lg flex items-center justify-center gap-2"
           >
             Finish Setup <Check size={20} />
           </button>
        </div>
      )}
    </div>
  );
};

const CrossIcon = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2v20M7 7h10" />
  </svg>
);
