import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { getUserProfile, saveUserProfile } from '../services/storageService';
import { ROLES } from '../constants';

/**
 * Shared profile-editing logic used by both SettingsPage (mobile)
 * and DesktopSettings (desktop). Handles load, update, name editing,
 * interest toggling, and reset.
 */
export function useProfileEditor() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    if (p) setNameValue(p.name);
  }, []);

  const updateProfile = (patch: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...patch };
    saveUserProfile(updated);
    setProfile(updated);
  };

  const toggleInterest = (interest: string) => {
    if (!profile) return;
    const current = profile.interests || [];
    const next = current.includes(interest)
      ? current.filter((i) => i !== interest)
      : [...current, interest];
    updateProfile({ interests: next });
  };

  const saveName = () => {
    if (nameValue.trim()) updateProfile({ name: nameValue.trim() });
    setEditingName(false);
  };

  const handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  const roleInfo = profile
    ? ROLES.find((r) => r.id === profile.role) || ROLES[0]
    : ROLES[0];

  return {
    profile,
    editingName,
    setEditingName,
    nameValue,
    setNameValue,
    updateProfile,
    toggleInterest,
    saveName,
    handleReset,
    roleInfo,
  };
}
