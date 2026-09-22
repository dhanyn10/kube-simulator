import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useInternetProfileModal,
  generateCustomProfileKey,
  generateRandomHourlyValues,
  ECOMMERCE_PROFILE
} from '@/activities/modals/useInternetProfileModal';
import { HOURS_OF_DAY } from '@/activities/modals/internetProfileChartHelpers';

vi.mock('@/lib/wailsRuntime', () => ({
  SaveInternetProfile: vi.fn().mockResolvedValue(true),
  GetInternetProfiles: vi.fn().mockResolvedValue([]),
  DeleteInternetProfile: vi.fn().mockResolvedValue(true)
}));

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

  it('handles apply profile and deselect toggle', () => {
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

  it('handles opening details and updating detail point', () => {
    const { result } = renderHook(() =>
      useInternetProfileModal(true, dummyNode, mockPerformUpdate, mockOnClose)
    );

    act(() => {
      result.current.handleOpenDetails(ECOMMERCE_PROFILE.name);
    });

    expect(result.current.viewMode).toBe('details');

    act(() => {
      result.current.handleUpdateDetailPoint('00:00', 2500);
    });

    expect(result.current.detailProfile.hourly['00:00']).toBe(2500);
    expect(result.current.detailProfile.name).toMatch(/^custom-\d{14}$/);
  });

  it('handles custom profile workflow with graph randomization', () => {
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
  });

  it('handles saving custom profile', async () => {
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
    expect(mockPerformUpdate).toHaveBeenCalled();
  });
});
