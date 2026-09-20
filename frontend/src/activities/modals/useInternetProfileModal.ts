import { useState, useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store';
import { safeRandom } from '@/lib/utils';

export interface InternetProfileItem {
  name: string;
  daily: Record<string, number>;
  timestamp?: number;
}

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const ECOMMERCE_PROFILE: InternetProfileItem = {
  name: 'E-Commerce Simulation',
  daily: {
    Monday: 1500,
    Tuesday: 1200,
    Wednesday: 1800,
    Thursday: 2200,
    Friday: 3500,
    Saturday: 5000,
    Sunday: 4200
  }
};

/**
 * Generates custom profile key formatted as custom-ddmmyyyyhis
 */
export const generateCustomProfileKey = (): string => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const h = String(now.getHours()).padStart(2, '0');
  const i = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `custom-${dd}${mm}${yyyy}${h}${i}${s}`;
};

/**
 * Generates randomized daily traffic values for Monday - Sunday (range 500 - 5000)
 */
export const generateRandomDailyValues = (): Record<string, number> => {
  const result: Record<string, number> = {};
  DAYS_OF_WEEK.forEach((day) => {
    // Generate random value rounded to nearest 50 between 500 and 5000 using safeRandom()
    const rand = Math.floor(safeRandom() * 91) * 50 + 500;
    result[day] = rand;
  });
  return result;
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
  const [viewMode, setViewMode] = useState<'grid' | 'details' | 'custom'>('grid');
  const [detailProfile, setDetailProfile] = useState<InternetProfileItem>(ECOMMERCE_PROFILE);
  const [isModifiedCustom, setIsModifiedCustom] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [customDailyValues, setCustomDailyValues] = useState<Record<string, number>>(() =>
    generateRandomDailyValues()
  );

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
      setViewMode('grid');
      setIsModifiedCustom(false);
    }
  }, [isOpen, fetchProfiles, selectedNode]);

  const handleStartCustomProfile = () => {
    setNewProfileName(generateCustomProfileKey());
    setCustomDailyValues(generateRandomDailyValues());
    setViewMode('custom');
  };

  const handleRandomizeCustomValues = () => {
    setCustomDailyValues(generateRandomDailyValues());
  };

  const handleUpdateCustomPoint = (day: string, newValue: number) => {
    setCustomDailyValues((prev) => ({
      ...prev,
      [day]: newValue
    }));
  };

  const activeProfile = profiles.find((p) => p.name === activeProfileName) || ECOMMERCE_PROFILE;

  const handleApplyProfile = (profileName: string, profileObj?: InternetProfileItem) => {
    const profileToApply = profileObj || profiles.find((p) => p.name === profileName) || ECOMMERCE_PROFILE;
    setActiveProfileName(profileToApply.name);
    performUpdate({
      connectionProfile: profileToApply,
      activeProfileName: profileToApply.name,
      traffic: profileToApply.daily['Monday'] || 1000
    });
  };

  const handleOpenDetails = (profileName: string) => {
    const target = profiles.find((p) => p.name === profileName) || ECOMMERCE_PROFILE;
    setDetailProfile({ ...target, daily: { ...target.daily } });
    setIsModifiedCustom(false);
    setViewMode('details');
  };

  const handleUpdateDetailPoint = (day: string, newValue: number) => {
    setDetailProfile((prev) => {
      let updatedName = prev.name;
      if (!isModifiedCustom && !prev.name.startsWith('custom-')) {
        updatedName = generateCustomProfileKey();
        setIsModifiedCustom(true);
      }
      return {
        ...prev,
        name: updatedName,
        daily: {
          ...prev.daily,
          [day]: newValue
        }
      };
    });
  };

  const handleUpdateDetailName = (newName: string) => {
    setDetailProfile((prev) => ({
      ...prev,
      name: newName
    }));
  };

  const handleSaveAndApplyDetailProfile = async () => {
    if (!detailProfile.name.trim()) return;

    const profileToSave: InternetProfileItem = {
      name: detailProfile.name.trim(),
      daily: { ...detailProfile.daily },
      timestamp: Date.now()
    };

    try {
      await window.go?.main?.App?.SaveInternetProfile?.(
        profileToSave.name,
        JSON.stringify(profileToSave)
      );
    } catch {
      // Fallback
    }

    await fetchProfiles();
    handleApplyProfile(profileToSave.name, profileToSave);
    setViewMode('grid');
  };

  const handleSaveCustomProfile = async () => {
    if (!newProfileName.trim()) return;

    const newProfile: InternetProfileItem = {
      name: newProfileName.trim(),
      daily: { ...customDailyValues },
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
    handleApplyProfile(newProfile.name, newProfile);
    setViewMode('grid');
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
    if (activeProfileName === name) {
      handleApplyProfile(ECOMMERCE_PROFILE.name);
    }
    if (detailProfile.name === name) {
      setViewMode('grid');
    }
  };

  return {
    colorMode,
    profiles,
    activeProfileName,
    activeProfile,
    viewMode,
    setViewMode,
    detailProfile,
    isModifiedCustom,
    newProfileName,
    setNewProfileName,
    customDailyValues,
    setCustomDailyValues,
    handleStartCustomProfile,
    handleRandomizeCustomValues,
    handleUpdateCustomPoint,
    handleApplyProfile,
    handleOpenDetails,
    handleUpdateDetailPoint,
    handleUpdateDetailName,
    handleSaveAndApplyDetailProfile,
    handleSaveCustomProfile,
    handleDeleteProfile
  };
};
