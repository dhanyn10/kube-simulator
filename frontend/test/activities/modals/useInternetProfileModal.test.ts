import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useInternetProfileModal,
  generateCustomProfileKey,
  generateRandomHourlyValues,
  ECOMMERCE_PROFILE,
  InternetProfileItem
} from '@/activities/modals/useInternetProfileModal';
import { HOURS_OF_DAY } from '@/activities/modals/internetProfileChartHelpers';

const mockGetInternetProfiles = vi.fn();
const mockSaveInternetProfile = vi.fn();
const mockDeleteInternetProfile = vi.fn();

// Mock window.go
beforeEach(() => {
  (window as any).go = {
    main: {
      App: {
        GetInternetProfiles: mockGetInternetProfiles,
        SaveInternetProfile: mockSaveInternetProfile,
        DeleteInternetProfile: mockDeleteInternetProfile
      }
    }
  };
});

describe('useInternetProfileModal', () => {
  const mockPerformUpdate = vi.fn();
  const mockOnClose = vi.fn();

  const dummyNode = {
    id: 'node-internet-1',
    data: {
      label: 'Internet Connection',
      activeProfileName: ECOMMERCE_PROFILE.name,
      connectionProfile: ECOMMERCE_PROFILE
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternetProfiles.mockResolvedValue([]);
    mockSaveInternetProfile.mockResolvedValue(true);
    mockDeleteInternetProfile.mockResolvedValue(true);
  });

  it('generateCustomProfileKey generates timestamped custom key string', () => {
    const key = generateCustomProfileKey();
    expect(key).toMatch(/^custom-\d{14}$/);
  });

  it('generateRandomHourlyValues generates random values for all 24 hours of the day', () => {
    const randoms = generateRandomHourlyValues();
    HOURS_OF_DAY.forEach((hour) => {
      expect(randoms[hour]).toBeGreaterThanOrEqual(500);
      expect(randoms[hour]).toBeLessThanOrEqual(5000);
      expect(randoms[hour] % 50).toBe(0);
    });
  });

  it('initializes default state correctly', () => {
    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    expect(result.current.viewMode).toBe('grid');
    expect(result.current.activeProfileName).toBe(ECOMMERCE_PROFILE.name);
    expect(result.current.profiles.length).toBeGreaterThan(0);
  });

  it('fetches and normalizes saved custom profiles from Wails backend including legacy daily profiles', async () => {
    const custom1: InternetProfileItem = {
      name: 'Custom 1',
      hourly: HOURS_OF_DAY.reduce((acc, h) => ({ ...acc, [h]: 1200 }), {})
    };

    const legacyProfile = {
      name: 'Legacy Daily Profile',
      daily: { Mon: 800, Tue: 900 }
    };

    mockGetInternetProfiles.mockResolvedValue([custom1, legacyProfile]);

    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    await act(async () => {
      // Trigger effect
    });

    expect(result.current.profiles).toHaveLength(3);
    expect(result.current.profiles.find((p) => p.name === 'Custom 1')).toBeDefined();
    const normalizedLegacy = result.current.profiles.find((p) => p.name === 'Legacy Daily Profile');
    expect(normalizedLegacy).toBeDefined();
    expect(normalizedLegacy?.hourly['00:00']).toBe(800);
  });

  it('handles backend error during fetchProfiles gracefully', async () => {
    mockGetInternetProfiles.mockRejectedValue(new Error('Backend error'));

    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    await act(async () => {});

    expect(result.current.profiles).toEqual([ECOMMERCE_PROFILE]);
  });

  it('handles apply profile when profileObj is provided, omitted, or missing hourly 00:00', () => {
    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    const customProfile: InternetProfileItem = {
      name: 'Direct Custom',
      hourly: {}
    };

    // Apply with profileObj directly provided (hourly 00:00 is missing, falls back to 1000)
    act(() => {
      result.current.handleApplyProfile('Direct Custom', customProfile);
    });

    expect(mockPerformUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProfileName: 'Direct Custom',
        traffic: 1000
      })
    );

    // Apply by profileName finding in profiles list (fallback to ECOMMERCE_PROFILE if not found)
    act(() => {
      result.current.handleApplyProfile('NonExistentProfile');
    });

    expect(mockPerformUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeProfileName: ECOMMERCE_PROFILE.name
      })
    );
  });

  it('handles apply profile and deselect toggle when active profile clicked again', () => {
    const inactiveNode = {
      id: 'node-internet-1',
      data: {
        label: 'Internet Connection',
        activeProfileName: '',
        connectionProfile: undefined
      }
    };

    const { result } = renderHook(() =>
      useInternetProfileModal(true, inactiveNode, mockPerformUpdate, mockOnClose)
    );

    act(() => {
      result.current.handleApplyProfile(ECOMMERCE_PROFILE.name);
    });

    expect(mockPerformUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProfileName: ECOMMERCE_PROFILE.name
      })
    );

    // Clicking again on active profile toggles it OFF (deselect)
    act(() => {
      result.current.handleApplyProfile(ECOMMERCE_PROFILE.name);
    });

    expect(mockPerformUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeProfileName: '',
        connectionProfile: undefined
      })
    );
  });

  it('handles opening details, updating detail point (already custom vs non-custom), updating detail name, and saving detail profile', async () => {
    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    act(() => {
      result.current.handleOpenDetails(ECOMMERCE_PROFILE.name);
    });

    expect(result.current.viewMode).toBe('details');

    // Update detail name directly
    act(() => {
      result.current.handleUpdateDetailName('Updated Detail Name');
    });
    expect(result.current.detailProfile.name).toBe('Updated Detail Name');

    // Update point on non-custom profile (starts with non-custom, generates custom key)
    act(() => {
      result.current.handleUpdateDetailPoint('00:00', 2500);
    });

    expect(result.current.detailProfile.hourly['00:00']).toBe(2500);
    expect(result.current.detailProfile.name).toMatch(/^custom-\d{14}$/);

    // Update point again when already modified (isModifiedCustom is true)
    act(() => {
      result.current.handleUpdateDetailPoint('01:00', 3000);
    });
    expect(result.current.detailProfile.hourly['01:00']).toBe(3000);

    // Save empty detail name (no-op)
    act(() => {
      result.current.handleUpdateDetailName('   ');
    });
    await act(async () => {
      await result.current.handleSaveAndApplyDetailProfile();
    });
    expect(mockSaveInternetProfile).not.toHaveBeenCalled();

    // Save valid detail name
    act(() => {
      result.current.handleUpdateDetailName('Valid Custom Detail');
    });
    await act(async () => {
      await result.current.handleSaveAndApplyDetailProfile();
    });
    expect(mockSaveInternetProfile).toHaveBeenCalledWith('Valid Custom Detail', expect.any(String));
  });

  it('handles backend error during handleSaveAndApplyDetailProfile gracefully', async () => {
    mockSaveInternetProfile.mockRejectedValue(new Error('Save failed'));

    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    act(() => {
      result.current.handleOpenDetails(ECOMMERCE_PROFILE.name);
    });

    await act(async () => {
      await result.current.handleSaveAndApplyDetailProfile();
    });

    expect(result.current.viewMode).toBe('grid');
  });

  it('handles custom profile workflow with graph randomization and saving empty/valid profile names', async () => {
    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    act(() => {
      result.current.handleStartCustomProfile();
    });

    expect(result.current.viewMode).toBe('custom');
    expect(result.current.newProfileName).toMatch(/^custom-\d{14}$/);

    act(() => {
      result.current.handleRandomizeCustomValues();
    });

    expect(result.current.customHourlyValues).toBeDefined();

    act(() => {
      result.current.handleUpdateCustomPoint('00:00', 4000);
    });

    expect(result.current.customHourlyValues['00:00']).toBe(4000);

    // Save with empty name (no-op)
    act(() => {
      result.current.setNewProfileName('   ');
    });
    await act(async () => {
      await result.current.handleSaveCustomProfile();
    });
    expect(mockSaveInternetProfile).not.toHaveBeenCalled();

    // Save with valid name
    act(() => {
      result.current.setNewProfileName('New Saved Custom');
    });
    await act(async () => {
      await result.current.handleSaveCustomProfile();
    });

    expect(mockSaveInternetProfile).toHaveBeenCalledWith('New Saved Custom', expect.any(String));
    expect(result.current.viewMode).toBe('grid');
    expect(mockPerformUpdate).toHaveBeenCalled();
  });

  it('handles backend error during handleSaveCustomProfile gracefully', async () => {
    mockSaveInternetProfile.mockRejectedValue(new Error('Save failed'));

    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    act(() => {
      result.current.handleStartCustomProfile();
    });

    await act(async () => {
      await result.current.handleSaveCustomProfile();
    });

    expect(result.current.viewMode).toBe('grid');
  });

  it('handles deleting profiles (preventing default, active profile fallback, and detail view reset)', async () => {
    const custom1: InternetProfileItem = {
      name: 'Custom To Delete',
      hourly: {}
    };
    mockGetInternetProfiles.mockResolvedValue([custom1]);

    const activeCustomNode = {
      ...dummyNode,
      data: {
        ...dummyNode.data,
        activeProfileName: 'Custom To Delete'
      }
    };

    const { result } = renderHook(() =>
      useInternetProfileModal(true, activeCustomNode, mockPerformUpdate, mockOnClose)
    );

    await act(async () => {});

    // Try deleting ECOMMERCE_PROFILE (early return no-op)
    await act(async () => {
      await result.current.handleDeleteProfile(ECOMMERCE_PROFILE.name);
    });
    expect(mockDeleteInternetProfile).not.toHaveBeenCalled();

    // Open detail for 'Custom To Delete'
    act(() => {
      result.current.handleOpenDetails('Custom To Delete');
    });
    expect(result.current.viewMode).toBe('details');

    // Delete active custom profile
    await act(async () => {
      await result.current.handleDeleteProfile('Custom To Delete');
    });

    expect(mockDeleteInternetProfile).toHaveBeenCalledWith('Custom To Delete');
    expect(mockPerformUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProfileName: ECOMMERCE_PROFILE.name
      })
    );
    expect(result.current.viewMode).toBe('grid');
  });

  it('handles backend error during handleDeleteProfile gracefully', async () => {
    mockDeleteInternetProfile.mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    await act(async () => {
      await result.current.handleDeleteProfile('Some Custom');
    });

    expect(mockGetInternetProfiles).toHaveBeenCalled();
  });
});
