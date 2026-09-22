import { useState, useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store';
import { safeRandom } from '@/lib/utils';
import { HOURS_OF_DAY, InternetProfileItem } from './internetProfileChartHelpers';

export type { InternetProfileItem };

const DEFAULT_HOURLY_PATTERN = [
  500, 300, 200, 150, 100, 200, 500, 1200,
  2200, 3100, 3800, 4200, 4500, 4300, 4000, 3800,
  3600, 3900, 4800, 5200, 4500, 3200, 2000, 1100
];

export const ECOMMERCE_PROFILE: InternetProfileItem = {
  name: 'E-Commerce Simulation',
  hourly: HOURS_OF_DAY.reduce((acc, hour, idx) => {
    acc[hour] = DEFAULT_HOURLY_PATTERN[idx];
    return acc;
  }, {} as Record<string, number>)
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
 * Generates randomized hourly traffic values for 00:00 - 23:00 (range 500 - 5000)
 */
export const generateRandomHourlyValues = (): Record<string, number> => {
  const result: Record<string, number> = {};
  HOURS_OF_DAY.forEach((hour) => {
    // Generate random value rounded to nearest 50 between 500 and 5000 using safeRandom()
    const rand = Math.floor(safeRandom() * 91) * 50 + 500;
    result[hour] = rand;
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
    selectedNode?.data?.activeProfileName || ''
  );
  const [viewMode, setViewMode] = useState<'grid' | 'details' | 'custom'>('grid');
  const [detailProfile, setDetailProfile] = useState<InternetProfileItem>(ECOMMERCE_PROFILE);
  const [isModifiedCustom, setIsModifiedCustom] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [customHourlyValues, setCustomHourlyValues] = useState<Record<string, number>>(() =>
    generateRandomHourlyValues()
  );

  const normalizeProfile = useCallback((p: any): InternetProfileItem => {
    if (p.hourly && Object.keys(p.hourly).length > 0) {
      return p as InternetProfileItem;
    }
    // Backward compatibility for legacy daily profiles
    const hourly: Record<string, number> = {};
    const legacyValues = p.daily ? Object.values(p.daily) as number[] : [];
    HOURS_OF_DAY.forEach((hour, idx) => {
      hourly[hour] = legacyValues[idx % Math.max(1, legacyValues.length)] || 1000;
    });
    return { name: p.name, hourly, timestamp: p.timestamp };
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const savedProfiles = await window.go?.main?.App?.GetInternetProfiles?.();
      if (Array.isArray(savedProfiles) && savedProfiles.length > 0) {
        const normalizedSaved = savedProfiles.map(normalizeProfile);
        const merged = [
          ECOMMERCE_PROFILE,
          ...normalizedSaved.filter((p) => p.name !== ECOMMERCE_PROFILE.name)
        ];
        setProfiles(merged);
      } else {
        setProfiles([ECOMMERCE_PROFILE]);
      }
    } catch {
      setProfiles([ECOMMERCE_PROFILE]);
    }
  }, [normalizeProfile]);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      setActiveProfileName(selectedNode?.data?.activeProfileName || '');
      setViewMode('grid');
      setIsModifiedCustom(false);
    }
  }, [isOpen, fetchProfiles, selectedNode]);

  const handleStartCustomProfile = () => {
    setNewProfileName(generateCustomProfileKey());
    setCustomHourlyValues(generateRandomHourlyValues());
    setViewMode('custom');
  };

  const handleRandomizeCustomValues = () => {
    setCustomHourlyValues(generateRandomHourlyValues());
  };

  const handleUpdateCustomPoint = (hour: string, newValue: number) => {
    setCustomHourlyValues((prev) => ({
      ...prev,
      [hour]: newValue
    }));
  };

  const activeProfile = profiles.find((p) => p.name === activeProfileName) || null;

  const handleApplyProfile = (profileName: string, profileObj?: InternetProfileItem) => {
    // If clicking on already active profile, toggle OFF (deselect)
    if (activeProfileName === profileName && !profileObj) {
      setActiveProfileName('');
      performUpdate({
        connectionProfile: undefined,
        activeProfileName: '',
        traffic: selectedNode?.data?.traffic || 1000
      });
      return;
    }

    const profileToApply = profileObj || profiles.find((p) => p.name === profileName) || ECOMMERCE_PROFILE;
    setActiveProfileName(profileToApply.name);
    performUpdate({
      connectionProfile: profileToApply,
      activeProfileName: profileToApply.name,
      traffic: profileToApply.hourly['00:00'] || 1000
    });
  };

  const handleOpenDetails = (profileName: string) => {
    const target = profiles.find((p) => p.name === profileName) || ECOMMERCE_PROFILE;
    setDetailProfile({ ...target, hourly: { ...target.hourly } });
    setIsModifiedCustom(false);
    setViewMode('details');
  };

  const handleUpdateDetailPoint = (hour: string, newValue: number) => {
    setDetailProfile((prev) => {
      let updatedName = prev.name;
      if (!isModifiedCustom && !prev.name.startsWith('custom-')) {
        updatedName = generateCustomProfileKey();
        setIsModifiedCustom(true);
      }
      return {
        ...prev,
        name: updatedName,
        hourly: {
          ...prev.hourly,
          [hour]: newValue
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
      hourly: { ...detailProfile.hourly },
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
      hourly: { ...customHourlyValues },
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
    customHourlyValues,
    setCustomHourlyValues,
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
