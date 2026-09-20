import { useState, useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store';

export interface InternetProfileItem {
  name: string;
  daily: Record<string, number>;
  timestamp?: number;
}

export const DAYS_OF_WEEK = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const ECOMMERCE_PROFILE: InternetProfileItem = {
  name: 'E-Commerce Simulation',
  daily: {
    Senin: 1500,
    Selasa: 1200,
    Rabu: 1800,
    Kamis: 2200,
    Jumat: 3500,
    Sabtu: 5000,
    Minggu: 4200
  }
};

/**
 * Custom hook providing business logic for Internet Connection Profile Simulation Modal.
 */
export const useInternetProfileModal = (
  isOpen: boolean,
  selectedNode: any,
  performUpdate: (updates: any) => void,
  onClose: () => void
) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const [profiles, setProfiles] = useState<InternetProfileItem[]>([ECOMMERCE_PROFILE]);
  const [activeProfileName, setActiveProfileName] = useState<string>(
    selectedNode?.data?.activeProfileName || ECOMMERCE_PROFILE.name
  );
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newDailyValues, setNewDailyValues] = useState<Record<string, number>>({
    Senin: 1000,
    Selasa: 1000,
    Rabu: 1000,
    Kamis: 1000,
    Jumat: 1000,
    Sabtu: 1000,
    Minggu: 1000
  });

  const fetchProfiles = useCallback(async () => {
    try {
      const savedProfiles = await window.go?.main?.App?.GetInternetProfiles?.();
      if (Array.isArray(savedProfiles) && savedProfiles.length > 0) {
        const merged = [
          ECOMMERCE_PROFILE,
          ...savedProfiles.filter((p) => p.name !== ECOMMERCE_PROFILE.name)
        ];
        setProfiles(merged);
      } else {
        setProfiles([ECOMMERCE_PROFILE]);
      }
    } catch {
      setProfiles([ECOMMERCE_PROFILE]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      setActiveProfileName(selectedNode?.data?.activeProfileName || ECOMMERCE_PROFILE.name);
    }
  }, [isOpen, fetchProfiles, selectedNode]);

  const activeProfile = profiles.find((p) => p.name === activeProfileName) || ECOMMERCE_PROFILE;

  const handleSelectProfile = (name: string) => {
    setActiveProfileName(name);
  };

  const handleSaveCustomProfile = async () => {
    if (!newProfileName.trim()) return;

    const newProfile: InternetProfileItem = {
      name: newProfileName.trim(),
      daily: { ...newDailyValues },
      timestamp: Date.now()
    };

    try {
      await window.go?.main?.App?.SaveInternetProfile?.(
        newProfile.name,
        JSON.stringify(newProfile)
      );
    } catch {
      // Fallback
    }

    await fetchProfiles();
    setActiveProfileName(newProfile.name);
    setIsCreating(false);
    setNewProfileName('');
  };

  const handleDeleteProfile = async (name: string) => {
    if (name === ECOMMERCE_PROFILE.name) return;

    try {
      await window.go?.main?.App?.DeleteInternetProfile?.(name);
    } catch {
      // Fallback
    }

    await fetchProfiles();
    setActiveProfileName(ECOMMERCE_PROFILE.name);
  };

  const handleActivateProfile = () => {
    const profileToActivate = profiles.find((p) => p.name === activeProfileName) || ECOMMERCE_PROFILE;
    performUpdate({
      connectionProfile: profileToActivate,
      activeProfileName: profileToActivate.name,
      traffic: profileToActivate.daily['Senin'] || 1000
    });
    onClose();
  };

  return {
    colorMode,
    profiles,
    activeProfileName,
    activeProfile,
    isCreating,
    setIsCreating,
    newProfileName,
    setNewProfileName,
    newDailyValues,
    setNewDailyValues,
    handleSelectProfile,
    handleSaveCustomProfile,
    handleDeleteProfile,
    handleActivateProfile
  };
};
